type CloudCheck = {
  label: string;
  status: "ready" | "missing" | "planned";
  detail: string;
};

type CloudStatus = {
  generatedAt: string;
  tenancy: {
    configured: boolean;
    region: string | null;
    tenancyIdSet: boolean;
    userIdSet: boolean;
    fingerprintSet: boolean;
    privateKeySet: boolean;
  };
  checks: CloudCheck[];
  resources: {
    instances: CloudCheck[];
    openPorts: CloudCheck[];
    metrics: CloudCheck[];
    announcements: CloudCheck[];
  };
};

function hasEnv(name: string) {
  return Boolean(process.env[name]);
}

export function getCloudStatus(): CloudStatus {
  const tenancyIdSet = hasEnv("OCI_TENANCY_ID");
  const userIdSet = hasEnv("OCI_USER_ID");
  const fingerprintSet = hasEnv("OCI_FINGERPRINT");
  const privateKeySet = hasEnv("OCI_PRIVATE_KEY");
  const region = process.env.OCI_REGION || null;
  const configured = Boolean(
    tenancyIdSet && userIdSet && fingerprintSet && privateKeySet && region,
  );

  return {
    generatedAt: new Date().toISOString(),
    tenancy: {
      configured,
      region,
      tenancyIdSet,
      userIdSet,
      fingerprintSet,
      privateKeySet,
    },
    checks: [
      {
        label: "OCI API credentials",
        status: configured ? "ready" : "missing",
        detail: configured
          ? "Server-side OCI credentials are present."
          : "Set OCI_TENANCY_ID, OCI_USER_ID, OCI_FINGERPRINT, OCI_PRIVATE_KEY, and OCI_REGION.",
      },
      {
        label: "Compute status",
        status: configured ? "planned" : "missing",
        detail: "Next step: connect the Compute API to list Always Free instances and lifecycle states.",
      },
      {
        label: "Cloud firewall ports",
        status: configured ? "planned" : "missing",
        detail: "Next step: read VNIC, Security List, and NSG ingress rules for externally allowed ports.",
      },
      {
        label: "Monitoring metrics",
        status: configured ? "planned" : "missing",
        detail: "Next step: query Monitoring metrics for CPU, network, and availability signals.",
      },
    ],
    resources: {
      instances: [
        {
          label: "Compute instances",
          status: "planned",
          detail: "OCI Compute API integration will populate RUNNING, STOPPED, and shape details.",
        },
      ],
      openPorts: [
        {
          label: "Allowed ingress ports",
          status: "planned",
          detail: "Security List and NSG rules will show cloud-level open ports, not internal listening ports.",
        },
      ],
      metrics: [
        {
          label: "Recent health metrics",
          status: "planned",
          detail: "Monitoring API data will fill CPU utilization and network throughput cards.",
        },
      ],
      announcements: [
        {
          label: "OCI announcements",
          status: "planned",
          detail: "Announcements API integration will show outages, maintenance, and required actions.",
        },
      ],
    },
  };
}
