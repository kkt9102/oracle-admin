import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000;
const HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type UsageLevel = "normal" | "warning" | "critical" | "unknown";

export type UsageMetric = {
  key: "memory" | "disk" | "load";
  label: string;
  unit: string;
  used: number;
  limit: number;
  percent: number;
  level: UsageLevel;
  description: string;
};

export type UsageSnapshot = {
  generatedAt: string;
  metrics: UsageMetric[];
};

export type UsageHistory = {
  generatedAt: string;
  cacheHit: boolean;
  nextRefreshAt: string;
  snapshots: UsageSnapshot[];
};

const cacheFilePath = path.join(
  process.env.ORACLE_ADMIN_CACHE_DIR || "/tmp/oracle-admin-cache",
  "usage-history.json",
);

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getLevel(percent: number): UsageLevel {
  if (!Number.isFinite(percent)) {
    return "unknown";
  }

  if (percent >= 90) {
    return "critical";
  }

  if (percent >= 70) {
    return "warning";
  }

  return "normal";
}

function createMetric(
  key: UsageMetric["key"],
  label: string,
  unit: string,
  used: number,
  limit: number,
  description: string,
): UsageMetric {
  const percent = limit > 0 ? Math.min(100, Math.max(0, (used / limit) * 100)) : 0;

  return {
    key,
    label,
    unit,
    used: round(used),
    limit: round(limit),
    percent: round(percent),
    level: getLevel(percent),
    description,
  };
}

async function getDiskMetric() {
  if (process.platform !== "linux") {
    return createMetric(
      "disk",
      "디스크",
      "GB",
      0,
      0,
      "디스크 사용량은 배포된 Linux 서버에서 확인할 수 있습니다.",
    );
  }

  try {
    const { stdout } = await execFileAsync("df", ["-Pk", "/"], {
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 1024 * 1024,
    });
    const line = stdout.trim().split(/\r?\n/)[1];
    const columns = line?.trim().split(/\s+/);
    const totalKb = Number(columns?.[1]);
    const usedKb = Number(columns?.[2]);

    return createMetric(
      "disk",
      "디스크",
      "GB",
      usedKb / 1024 / 1024,
      totalKb / 1024 / 1024,
      "서버 루트 디스크 사용량입니다.",
    );
  } catch {
    return createMetric(
      "disk",
      "디스크",
      "GB",
      0,
      0,
      "디스크 사용량을 조회할 수 없습니다.",
    );
  }
}

async function createUsageSnapshot(): Promise<UsageSnapshot> {
  const totalMemoryGb = os.totalmem() / 1024 / 1024 / 1024;
  const usedMemoryGb = (os.totalmem() - os.freemem()) / 1024 / 1024 / 1024;
  const cpuCount = os.cpus().length || 1;
  const loadRatio = os.loadavg()[0] / cpuCount;
  const diskMetric = await getDiskMetric();

  return {
    generatedAt: new Date().toISOString(),
    metrics: [
      createMetric(
        "memory",
        "메모리",
        "GB",
        usedMemoryGb,
        totalMemoryGb,
        "서버가 현재 사용 중인 메모리입니다.",
      ),
      diskMetric,
      createMetric(
        "load",
        "서버 부하",
        "%",
        loadRatio * 100,
        100,
        "CPU 코어 수 대비 1분 평균 부하입니다.",
      ),
    ],
  };
}

async function readHistory(): Promise<UsageSnapshot[]> {
  try {
    const raw = await fs.readFile(cacheFilePath, "utf8");
    const parsed = JSON.parse(raw) as { snapshots?: UsageSnapshot[] };
    return Array.isArray(parsed.snapshots) ? parsed.snapshots : [];
  } catch {
    return [];
  }
}

async function writeHistory(snapshots: UsageSnapshot[]) {
  await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
  await fs.writeFile(
    cacheFilePath,
    JSON.stringify({ snapshots }, null, 2),
    "utf8",
  );
}

export async function getUsageHistory(): Promise<UsageHistory> {
  const now = Date.now();
  const history = await readHistory();
  const retained = history.filter((snapshot) => {
    const generatedAt = new Date(snapshot.generatedAt).getTime();
    return Number.isFinite(generatedAt) && now - generatedAt <= HISTORY_RETENTION_MS;
  });
  const latest = retained.at(-1);
  const latestTime = latest ? new Date(latest.generatedAt).getTime() : 0;
  const cacheHit = Boolean(latest && now - latestTime < SNAPSHOT_INTERVAL_MS);
  const snapshots = cacheHit ? retained : [...retained, await createUsageSnapshot()];

  if (!cacheHit) {
    await writeHistory(snapshots);
  }

  const newest = snapshots.at(-1);
  const nextRefreshAt = new Date(
    (newest ? new Date(newest.generatedAt).getTime() : now) + SNAPSHOT_INTERVAL_MS,
  ).toISOString();

  return {
    generatedAt: newest?.generatedAt || new Date(now).toISOString(),
    cacheHit,
    nextRefreshAt,
    snapshots,
  };
}
