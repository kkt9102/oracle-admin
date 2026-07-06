type CloudCheck = {
  label: string;
  status: "normal" | "progress" | "stopped" | "unknown";
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
        label: "OCI API 연결",
        status: configured ? "normal" : "stopped",
        detail: configured
          ? "서버에서 OCI API를 호출할 준비가 되어 있습니다."
          : "OCI_TENANCY_ID, OCI_USER_ID, OCI_FINGERPRINT, OCI_PRIVATE_KEY, OCI_REGION 설정이 필요합니다.",
      },
      {
        label: "Compute 상태",
        status: configured ? "progress" : "stopped",
        detail: "OCI Compute API를 연결하면 인스턴스 실행/정지 상태를 신호등으로 표시합니다.",
      },
      {
        label: "클라우드 방화벽",
        status: configured ? "progress" : "stopped",
        detail: "Security List와 NSG 규칙을 연결하면 외부 허용 포트를 확인합니다.",
      },
      {
        label: "사용량 모니터링",
        status: configured ? "progress" : "stopped",
        detail: "Monitoring API를 연결하면 무료 티어 한도 대비 사용량을 표시합니다.",
      },
    ],
    resources: {
      instances: [
        {
          label: "Compute 인스턴스",
          status: "progress",
          detail: "RUNNING은 정상, STARTING/STOPPING은 진행 중, STOPPED는 정지로 표시할 예정입니다.",
        },
      ],
      openPorts: [
        {
          label: "외부 허용 포트",
          status: "progress",
          detail: "서버 내부 포트와 OCI 방화벽 허용 포트를 분리해서 보여줄 예정입니다.",
        },
      ],
      metrics: [
        {
          label: "최근 사용량",
          status: "progress",
          detail: "현재는 서버 내부 사용량을 30분 단위로 저장하고, 추후 OCI metric을 연결합니다.",
        },
      ],
      announcements: [
        {
          label: "OCI 공지",
          status: "progress",
          detail: "Oracle Cloud 점검, 장애, required action 공지를 연결할 예정입니다.",
        },
      ],
    },
  };
}
