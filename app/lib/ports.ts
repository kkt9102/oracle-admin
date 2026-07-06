import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { addErrorNotification } from "./errorNotifications";

const execFileAsync = promisify(execFile);

export type ListeningPort = {
  protocol: "tcp" | "udp";
  port: number;
  address: string;
  binding: "all" | "loopback" | "interface";
  service: string;
  processName: string | null;
  processId: number | null;
};

export type PortStatus = {
  generatedAt: string;
  expiresAt: string;
  cacheHit: boolean;
  available: boolean;
  source: "ss";
  message: string;
  ports: ListeningPort[];
};

const PORT_CACHE_INTERVAL_MS = 5 * 60 * 1000;
const cacheFilePath = path.join(
  process.env.ORACLE_ADMIN_CACHE_DIR || "/tmp/oracle-admin-cache",
  "ports-status.json",
);
let refreshPromise: Promise<PortStatus> | null = null;

const knownServices = new Map<number, string>([
  [22, "SSH"],
  [53, "DNS"],
  [80, "HTTP"],
  [443, "HTTPS"],
  [3000, "Next.js"],
  [3306, "MySQL"],
  [5432, "PostgreSQL"],
  [6379, "Redis"],
  [8080, "HTTP 대체 포트"],
]);

function splitEndpoint(endpoint: string) {
  const ipv6Match = endpoint.match(/^\[([^\]]+)]:(\d+|\*)$/);

  if (ipv6Match) {
    return { address: ipv6Match[1], port: ipv6Match[2] };
  }

  const separatorIndex = endpoint.lastIndexOf(":");

  if (separatorIndex < 0) {
    return null;
  }

  return {
    address: endpoint.slice(0, separatorIndex),
    port: endpoint.slice(separatorIndex + 1),
  };
}

function getBinding(address: string): ListeningPort["binding"] {
  if (address === "*" || address === "0.0.0.0" || address === "::") {
    return "all";
  }

  if (address === "::1" || address.startsWith("127.")) {
    return "loopback";
  }

  return "interface";
}

function parseProcess(processText: string) {
  const name = processText.match(/\(\("([^"]+)"/)?.[1] || null;
  const processIdRaw = processText.match(/,pid=(\d+)/)?.[1];

  return {
    processName: name,
    processId: processIdRaw ? Number(processIdRaw) : null,
  };
}

export function parseListeningPorts(output: string): ListeningPort[] {
  const ports = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const columns = line.split(/\s+/);
      const protocol = columns[0]?.toLowerCase();
      const localEndpoint = columns[4];

      if ((protocol !== "tcp" && protocol !== "udp") || !localEndpoint) {
        return [];
      }

      const endpoint = splitEndpoint(localEndpoint);
      const port = endpoint ? Number(endpoint.port) : Number.NaN;

      if (!endpoint || !Number.isInteger(port) || port < 1 || port > 65535) {
        return [];
      }

      const process = parseProcess(columns.slice(6).join(" "));

      const listeningPort: ListeningPort = {
        protocol,
        port,
        address: endpoint.address,
        binding: getBinding(endpoint.address),
        service: knownServices.get(port) || process.processName || "알 수 없음",
        ...process,
      };

      return [listeningPort];
    });

  return ports.sort((left, right) =>
    left.port - right.port || left.protocol.localeCompare(right.protocol),
  );
}

async function readCachedPortStatus() {
  try {
    const raw = await fs.readFile(cacheFilePath, "utf8");
    const parsed = JSON.parse(raw) as PortStatus;
    const expiresAt = new Date(parsed.expiresAt).getTime();

    if (Number.isFinite(expiresAt) && Date.now() < expiresAt) {
      return { ...parsed, cacheHit: true };
    }
  } catch {
    return null;
  }

  return null;
}

async function writeCachedPortStatus(status: PortStatus) {
  try {
    await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
    await fs.writeFile(cacheFilePath, JSON.stringify(status, null, 2), "utf8");
  } catch (error) {
    const errorDetail =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

    await addErrorNotification(
      "서버 캐시",
      `포트 상태 캐시를 저장할 수 없습니다. ${errorDetail}`,
    );
  }
}

function createPortStatus(
  available: boolean,
  message: string,
  ports: ListeningPort[],
): PortStatus {
  const generatedAt = Date.now();

  return {
    generatedAt: new Date(generatedAt).toISOString(),
    expiresAt: new Date(generatedAt + PORT_CACHE_INTERVAL_MS).toISOString(),
    cacheHit: false,
    available,
    source: "ss",
    message,
    ports,
  };
}

async function refreshListeningPorts(): Promise<PortStatus> {
  if (process.platform !== "linux") {
    return createPortStatus(
      false,
      "포트 조회는 배포된 Linux 서버에서 사용할 수 있습니다.",
      [],
    );
  }

  try {
    const { stdout } = await execFileAsync("ss", ["-H", "-lntup"], {
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 1024 * 1024,
    });

    const status = createPortStatus(
      true,
      "현재 서버에서 연결을 기다리는 TCP·UDP 포트입니다.",
      parseListeningPorts(stdout),
    );

    await writeCachedPortStatus(status);
    return status;
  } catch (error) {
    const errorDetail =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

    await addErrorNotification(
      "서버 포트",
      `포트 정보를 조회할 수 없습니다. ${errorDetail}`,
    );

    const status = createPortStatus(
      false,
      "포트 정보를 조회할 수 없습니다. 서버에 iproute 패키지와 실행 권한이 있는지 확인해 주세요.",
      [],
    );

    await writeCachedPortStatus(status);
    return status;
  }
}

export async function getListeningPorts(): Promise<PortStatus> {
  const cached = await readCachedPortStatus();

  if (cached) {
    return cached;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  const request = refreshListeningPorts();
  refreshPromise = request;

  try {
    return await request;
  } finally {
    if (refreshPromise === request) {
      refreshPromise = null;
    }
  }
}
