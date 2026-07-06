export type OciSettingsSummary = {
  configured: boolean;
  tenancyId: string;
  userId: string;
  fingerprint: string;
  region: string;
  compartmentId: string;
  privateKeyConfigured: boolean;
};

function maskValue(value: string | undefined, visibleStart = 14, visibleEnd = 8) {
  if (!value) {
    return "미설정";
  }

  if (value.length <= visibleStart + visibleEnd) {
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }

  return `${value.slice(0, visibleStart)}...${value.slice(-visibleEnd)}`;
}

export function getOciSettingsSummary(): OciSettingsSummary {
  const tenancyId = process.env.OCI_TENANCY_ID;
  const userId = process.env.OCI_USER_ID;
  const fingerprint = process.env.OCI_FINGERPRINT;
  const region = process.env.OCI_REGION;
  const compartmentId = process.env.OCI_COMPARTMENT_ID || tenancyId;
  const privateKeyConfigured = Boolean(process.env.OCI_PRIVATE_KEY);

  return {
    configured: Boolean(
      tenancyId && userId && fingerprint && region && privateKeyConfigured,
    ),
    tenancyId: maskValue(tenancyId),
    userId: maskValue(userId),
    fingerprint: maskValue(fingerprint, 5, 5),
    region: region || "미설정",
    compartmentId: maskValue(compartmentId),
    privateKeyConfigured,
  };
}
