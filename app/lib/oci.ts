import { createHash, createSign } from "node:crypto";

type OciConfig = {
  tenancyId: string;
  userId: string;
  fingerprint: string;
  privateKey: string;
  region: string;
  compartmentId: string;
};

type OciRequestOptions = {
  method?: "GET" | "POST";
  service?: "iaas" | "telemetry";
  path: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
};

export type OciInstance = {
  id: string;
  displayName: string;
  lifecycleState: string;
  shape: string;
  availabilityDomain: string;
  timeCreated?: string;
};

export type OciIngressPort = {
  source: string;
  protocol: string;
  portRange: string;
  ruleSource: "Security List" | "NSG";
  ruleName: string;
};

type OciListResponse<T> = T[];

type RawInstance = {
  id: string;
  displayName?: string;
  "display-name"?: string;
  lifecycleState?: string;
  "lifecycle-state"?: string;
  shape?: string;
  availabilityDomain?: string;
  "availability-domain"?: string;
  timeCreated?: string;
  "time-created"?: string;
};

type RawVnicAttachment = {
  vnicId?: string;
  "vnic-id"?: string;
};

type RawVnic = {
  subnetId?: string;
  "subnet-id"?: string;
  nsgIds?: string[];
  "nsg-ids"?: string[];
};

type RawSubnet = {
  securityListIds?: string[];
  "security-list-ids"?: string[];
};

type RawSecurityRule = {
  protocol?: string;
  source?: string;
  tcpOptions?: {
    destinationPortRange?: { min?: number; max?: number };
    "destination-port-range"?: { min?: number; max?: number };
  };
  udpOptions?: {
    destinationPortRange?: { min?: number; max?: number };
    "destination-port-range"?: { min?: number; max?: number };
  };
};

type RawSecurityList = {
  displayName?: string;
  "display-name"?: string;
  ingressSecurityRules?: RawSecurityRule[];
  "ingress-security-rules"?: RawSecurityRule[];
};

type RawNsgRule = RawSecurityRule & {
  direction?: "INGRESS" | "EGRESS";
};

export function getOciConfig() {
  const tenancyId = process.env.OCI_TENANCY_ID;
  const userId = process.env.OCI_USER_ID;
  const fingerprint = process.env.OCI_FINGERPRINT;
  const privateKey = process.env.OCI_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const region = process.env.OCI_REGION;
  const compartmentId = process.env.OCI_COMPARTMENT_ID || tenancyId;

  if (
    !tenancyId ||
    !userId ||
    !fingerprint ||
    !privateKey ||
    !region ||
    !compartmentId
  ) {
    return null;
  }

  return {
    tenancyId,
    userId,
    fingerprint,
    privateKey,
    region,
    compartmentId,
  } satisfies OciConfig;
}

function getHost(service: OciRequestOptions["service"], region: string) {
  const subdomain = service === "telemetry" ? "telemetry" : "iaas";
  return `${subdomain}.${region}.oraclecloud.com`;
}

function getQueryString(query?: OciRequestOptions["query"]) {
  if (!query) {
    return "";
  }

  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

function getAuthorizationHeader(
  config: OciConfig,
  method: string,
  pathWithQuery: string,
  host: string,
  date: string,
  bodyText?: string,
) {
  const headers = ["date", "(request-target)", "host"];
  const signingParts = [
    `date: ${date}`,
    `(request-target): ${method.toLowerCase()} ${pathWithQuery}`,
    `host: ${host}`,
  ];

  if (bodyText !== undefined) {
    const bodyHash = createHash("sha256").update(bodyText).digest("base64");
    headers.push("x-content-sha256", "content-type", "content-length");
    signingParts.push(`x-content-sha256: ${bodyHash}`);
    signingParts.push("content-type: application/json");
    signingParts.push(`content-length: ${Buffer.byteLength(bodyText)}`);
  }

  const signature = createSign("RSA-SHA256")
    .update(signingParts.join("\n"))
    .sign(config.privateKey, "base64");

  return `Signature version="1",keyId="${config.tenancyId}/${config.userId}/${config.fingerprint}",algorithm="rsa-sha256",headers="${headers.join(" ")}",signature="${signature}"`;
}

async function ociRequest<T>(config: OciConfig, options: OciRequestOptions) {
  const method = options.method || "GET";
  const service = options.service || "iaas";
  const host = getHost(service, config.region);
  const queryString = getQueryString(options.query);
  const pathWithQuery = `${options.path}${queryString}`;
  const url = `https://${host}${pathWithQuery}`;
  const date = new Date().toUTCString();
  const bodyText = options.body ? JSON.stringify(options.body) : undefined;
  const headers: Record<string, string> = {
    date,
    host,
    authorization: getAuthorizationHeader(
      config,
      method,
      pathWithQuery,
      host,
      date,
      bodyText,
    ),
  };

  if (bodyText !== undefined) {
    headers["content-type"] = "application/json";
    headers["content-length"] = String(Buffer.byteLength(bodyText));
    headers["x-content-sha256"] = createHash("sha256")
      .update(bodyText)
      .digest("base64");
  }

  const response = await fetch(url, {
    method,
    headers,
    body: bodyText,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `OCI ${method} ${pathWithQuery} failed: ${response.status} ${text}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function listInstances(config: OciConfig): Promise<OciInstance[]> {
  const instances = await ociRequest<OciListResponse<RawInstance>>(config, {
    path: "/20160918/instances",
    query: { compartmentId: config.compartmentId },
  });

  return instances.map((instance) => ({
    id: instance.id,
    displayName:
      instance.displayName || instance["display-name"] || "이름 없음",
    lifecycleState:
      instance.lifecycleState || instance["lifecycle-state"] || "UNKNOWN",
    shape: instance.shape || "알 수 없음",
    availabilityDomain:
      instance.availabilityDomain ||
      instance["availability-domain"] ||
      "알 수 없음",
    timeCreated: instance.timeCreated || instance["time-created"],
  }));
}

function getPortRange(rule: RawSecurityRule) {
  const tcpRange =
    rule.tcpOptions?.destinationPortRange ||
    rule.tcpOptions?.["destination-port-range"];
  const udpRange =
    rule.udpOptions?.destinationPortRange ||
    rule.udpOptions?.["destination-port-range"];
  const range = tcpRange || udpRange;

  if (!range?.min || !range?.max) {
    return "전체";
  }

  return range.min === range.max
    ? String(range.min)
    : `${range.min}-${range.max}`;
}

function getProtocol(protocol?: string) {
  if (protocol === "6") {
    return "TCP";
  }

  if (protocol === "17") {
    return "UDP";
  }

  if (protocol === "1") {
    return "ICMP";
  }

  return protocol || "전체";
}

export async function listIngressPorts(
  config: OciConfig,
): Promise<OciIngressPort[]> {
  const attachments = await ociRequest<OciListResponse<RawVnicAttachment>>(
    config,
    {
      path: "/20160918/vnicAttachments",
      query: { compartmentId: config.compartmentId },
    },
  );
  const ports: OciIngressPort[] = [];
  const securityListIds = new Set<string>();
  const nsgIds = new Set<string>();

  for (const attachment of attachments.slice(0, 10)) {
    const vnicId = attachment.vnicId || attachment["vnic-id"];

    if (!vnicId) {
      continue;
    }

    const vnic = await ociRequest<RawVnic>(config, {
      path: `/20160918/vnics/${encodeURIComponent(vnicId)}`,
    });
    const subnetId = vnic.subnetId || vnic["subnet-id"];

    (vnic.nsgIds || vnic["nsg-ids"] || []).forEach((id) => nsgIds.add(id));

    if (subnetId) {
      const subnet = await ociRequest<RawSubnet>(config, {
        path: `/20160918/subnets/${encodeURIComponent(subnetId)}`,
      });
      (subnet.securityListIds || subnet["security-list-ids"] || []).forEach(
        (id) => securityListIds.add(id),
      );
    }
  }

  for (const securityListId of securityListIds) {
    const securityList = await ociRequest<RawSecurityList>(config, {
      path: `/20160918/securityLists/${encodeURIComponent(securityListId)}`,
    });
    const ruleName =
      securityList.displayName ||
      securityList["display-name"] ||
      "Security List";
    const rules =
      securityList.ingressSecurityRules ||
      securityList["ingress-security-rules"] ||
      [];

    rules.forEach((rule) => {
      ports.push({
        source: rule.source || "알 수 없음",
        protocol: getProtocol(rule.protocol),
        portRange: getPortRange(rule),
        ruleSource: "Security List",
        ruleName,
      });
    });
  }

  for (const nsgId of nsgIds) {
    const rules = await ociRequest<OciListResponse<RawNsgRule>>(config, {
      path: `/20160918/networkSecurityGroups/${encodeURIComponent(nsgId)}/securityRules`,
      query: { direction: "INGRESS" },
    });

    rules
      .filter((rule) => !rule.direction || rule.direction === "INGRESS")
      .forEach((rule) => {
        ports.push({
          source: rule.source || "알 수 없음",
          protocol: getProtocol(rule.protocol),
          portRange: getPortRange(rule),
          ruleSource: "NSG",
          ruleName: nsgId.slice(-8),
        });
      });
  }

  return ports;
}
