import { promises as fs } from "node:fs";
import path from "node:path";
import {
  getOciConfig,
  listIngressPorts,
  listInstances,
  type OciIngressPort,
  type OciInstance,
} from "./oci";
import { addErrorNotification } from "./errorNotifications";

type SignalStatus = "normal" | "progress" | "stopped" | "unknown";

type CloudCheck = {
  label: string;
  status: SignalStatus;
  detail: string | string[];
};

type CloudStatus = {
  cacheVersion: number;
  generatedAt: string;
  expiresAt: string;
  cacheHit: boolean;
  tenancy: {
    configured: boolean;
    region: string | null;
    tenancyIdSet: boolean;
    userIdSet: boolean;
    fingerprintSet: boolean;
    privateKeySet: boolean;
    compartmentIdSet: boolean;
  };
  checks: CloudCheck[];
  resources: {
    instances: CloudCheck[];
    openPorts: CloudCheck[];
    metrics: CloudCheck[];
    announcements: CloudCheck[];
  };
};

const CACHE_INTERVAL_MS = 30 * 60 * 1000;
const FAILURE_CACHE_INTERVAL_MS = 5 * 60 * 1000;
const CACHE_VERSION = 3;
const cacheFilePath = path.join(
  process.env.ORACLE_ADMIN_CACHE_DIR || "/tmp/oracle-admin-cache",
  "oci-status.json",
);
let refreshPromise: Promise<CloudStatus> | null = null;

function hasEnv(name: string) {
  return Boolean(process.env[name]);
}

function getConfiguredTenancy() {
  const tenancyIdSet = hasEnv("OCI_TENANCY_ID");
  const userIdSet = hasEnv("OCI_USER_ID");
  const fingerprintSet = hasEnv("OCI_FINGERPRINT");
  const privateKeySet = hasEnv("OCI_PRIVATE_KEY");
  const compartmentIdSet = hasEnv("OCI_COMPARTMENT_ID");
  const region = process.env.OCI_REGION || null;
  const configured = Boolean(
    tenancyIdSet && userIdSet && fingerprintSet && privateKeySet && region,
  );

  return {
    configured,
    region,
    tenancyIdSet,
    userIdSet,
    fingerprintSet,
    privateKeySet,
    compartmentIdSet,
  };
}

function getInstanceStatus(instance: OciInstance): SignalStatus {
  if (instance.lifecycleState === "RUNNING") {
    return "normal";
  }

  if (
    ["STARTING", "STOPPING", "PROVISIONING", "TERMINATING"].includes(
      instance.lifecycleState,
    )
  ) {
    return "progress";
  }

  if (["STOPPED", "TERMINATED"].includes(instance.lifecycleState)) {
    return "stopped";
  }

  return "unknown";
}

function summarizeInstances(instances: OciInstance[]): CloudCheck {
  if (instances.length === 0) {
    return {
      label: "Compute 인스턴스",
      status: "unknown",
      detail: "이 compartment에서 조회된 인스턴스가 없습니다.",
    };
  }

  const running = instances.filter(
    (instance) => instance.lifecycleState === "RUNNING",
  ).length;
  const stopped = instances.filter((instance) =>
    ["STOPPED", "TERMINATED"].includes(instance.lifecycleState),
  ).length;
  const changing = instances.length - running - stopped;

  return {
    label: "Compute 인스턴스",
    status: running > 0 ? "normal" : changing > 0 ? "progress" : "stopped",
    detail: [
      `전체 ${instances.length}대`,
      `정상 ${running}대`,
      `진행 중 ${changing}대`,
      `정지 ${stopped}대`,
    ],
  };
}

function formatPortSummary(ports: OciIngressPort[]) {
  return ports
    .slice(0, 8)
    .map((port) => `${port.protocol} ${port.portRange} (${port.ruleSource})`);
}

function createFallbackStatus(errorMessage?: string): CloudStatus {
  const tenancy = getConfiguredTenancy();
  const configured = tenancy.configured;
  const generatedAt = Date.now();

  return {
    cacheVersion: CACHE_VERSION,
    generatedAt: new Date(generatedAt).toISOString(),
    expiresAt: new Date(
      generatedAt +
        (errorMessage ? FAILURE_CACHE_INTERVAL_MS : CACHE_INTERVAL_MS),
    ).toISOString(),
    cacheHit: false,
    tenancy,
    checks: [
      {
        label: "OCI API 연결",
        status:
          configured && !errorMessage
            ? "normal"
            : configured
              ? "unknown"
              : "stopped",
        detail: configured
          ? errorMessage || "서버에서 OCI API를 호출할 준비가 되어 있습니다."
          : "OCI_TENANCY_ID, OCI_USER_ID, OCI_FINGERPRINT, OCI_PRIVATE_KEY, OCI_REGION 설정이 필요합니다.",
      },
      {
        label: "Compute 상태",
        status: configured ? "progress" : "stopped",
        detail: configured
          ? "OCI API 응답을 기다리고 있습니다."
          : "OCI 설정을 완료하면 인스턴스 상태를 조회합니다.",
      },
      {
        label: "클라우드 방화벽",
        status: configured ? "progress" : "stopped",
        detail: configured
          ? "Security List와 NSG 규칙 조회를 준비 중입니다."
          : "OCI 설정을 완료하면 외부 허용 포트를 조회합니다.",
      },
      {
        label: "사용량 모니터링",
        status: "progress",
        detail:
          "서버 내부 사용량은 표시 중이며, OCI 무료 티어 한도는 추후 Limit/Monitoring API로 확장합니다.",
      },
    ],
    resources: {
      instances: [
        {
          label: "Compute 인스턴스",
          status: configured ? "progress" : "stopped",
          detail: configured
            ? "OCI API 조회 결과가 아직 없습니다."
            : "OCI 설정이 필요합니다.",
        },
      ],
      openPorts: [
        {
          label: "외부 허용 포트",
          status: configured ? "progress" : "stopped",
          detail: configured
            ? "Security List와 NSG 규칙 조회 결과가 아직 없습니다."
            : "OCI 설정이 필요합니다.",
        },
      ],
      metrics: [
        {
          label: "무료 티어 한도",
          status: "progress",
          detail: "OCI Limit/Usage API 연결 후 한도 대비 사용량을 표시합니다.",
        },
      ],
      announcements: [
        {
          label: "OCI 공지",
          status: "progress",
          detail: "Oracle Cloud 공지 API 연결 후 점검/장애 정보를 표시합니다.",
        },
      ],
    },
  };
}

async function readCachedStatus() {
  try {
    const raw = await fs.readFile(cacheFilePath, "utf8");
    const parsed = JSON.parse(raw) as CloudStatus;

    if (parsed.cacheVersion !== CACHE_VERSION) {
      return null;
    }

    const generatedAt = new Date(parsed.generatedAt).getTime();
    const expiresAt = parsed.expiresAt
      ? new Date(parsed.expiresAt).getTime()
      : generatedAt +
        (parsed.checks?.[0]?.status === "normal"
          ? CACHE_INTERVAL_MS
          : FAILURE_CACHE_INTERVAL_MS);

    if (
      Number.isFinite(generatedAt) &&
      Number.isFinite(expiresAt) &&
      Date.now() < expiresAt
    ) {
      return { ...parsed, cacheHit: true };
    }
  } catch {
    return null;
  }

  return null;
}

async function writeCachedStatus(status: CloudStatus) {
  try {
    await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
    await fs.writeFile(cacheFilePath, JSON.stringify(status, null, 2), "utf8");
  } catch (error) {
    const errorDetail =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";

    await addErrorNotification(
      "서버 캐시",
      `OCI 상태 캐시를 저장할 수 없습니다. ${errorDetail}`,
    );
  }
}

async function refreshCloudStatus(): Promise<CloudStatus> {
  const config = getOciConfig();

  if (!config) {
    return createFallbackStatus();
  }

  try {
    const [instances, ports] = await Promise.all([
      listInstances(config),
      listIngressPorts(config),
    ]);
    const generatedAt = Date.now();
    const status: CloudStatus = {
      cacheVersion: CACHE_VERSION,
      generatedAt: new Date(generatedAt).toISOString(),
      expiresAt: new Date(generatedAt + CACHE_INTERVAL_MS).toISOString(),
      cacheHit: false,
      tenancy: getConfiguredTenancy(),
      checks: [
        {
          label: "OCI API 연결",
          status: "normal",
          detail: "OCI API 호출에 성공했습니다.",
        },
        summarizeInstances(instances),
        {
          label: "클라우드 방화벽",
          status: ports.length > 0 ? "normal" : "unknown",
          detail:
            ports.length > 0
              ? `외부 허용 규칙 ${ports.length}개를 확인했습니다.`
              : "외부 허용 규칙이 없거나 조회되지 않았습니다.",
        },
        {
          label: "사용량 모니터링",
          status: "progress",
          detail:
            "서버 내부 사용량은 표시 중이며, OCI 무료 티어 한도는 추후 Limit/Monitoring API로 확장합니다.",
        },
      ],
      resources: {
        instances: instances.map((instance) => ({
          label: instance.displayName,
          status: getInstanceStatus(instance),
          detail: `${instance.lifecycleState} / ${instance.shape} / ${instance.availabilityDomain}`,
        })),
        openPorts: [
          {
            label: "외부 허용 포트",
            status: ports.length > 0 ? "normal" : "unknown",
            detail:
              ports.length > 0
                ? formatPortSummary(ports)
                : "Security List 또는 NSG에서 외부 허용 포트를 찾지 못했습니다.",
          },
        ],
        metrics: [
          {
            label: "무료 티어 한도",
            status: "progress",
            detail:
              "OCI Limit/Usage API 연결 후 한도 대비 사용량을 표시합니다.",
          },
        ],
        announcements: [
          {
            label: "OCI 공지",
            status: "progress",
            detail:
              "Oracle Cloud 공지 API 연결 후 점검/장애 정보를 표시합니다.",
          },
        ],
      },
    };

    await writeCachedStatus(status);
    return status;
  } catch (error) {
    const errorDetail =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";

    await addErrorNotification(
      "OCI API",
      `OCI API 호출에 실패했습니다. ${errorDetail}`,
    );

    const fallbackStatus = createFallbackStatus(
      error instanceof Error
        ? `OCI API 호출에 실패했습니다. 설정과 IAM 권한을 확인해 주세요. (${error.message.slice(0, 140)})`
        : "OCI API 호출에 실패했습니다. 설정과 IAM 권한을 확인해 주세요.",
    );

    await writeCachedStatus(fallbackStatus);
    return fallbackStatus;
  }
}

export async function getCloudStatus(): Promise<CloudStatus> {
  const cached = await readCachedStatus();

  if (cached) {
    return cached;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  const request = refreshCloudStatus();
  refreshPromise = request;

  try {
    return await request;
  } finally {
    if (refreshPromise === request) {
      refreshPromise = null;
    }
  }
}
