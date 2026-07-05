import { execFile } from "node:child_process";
import { promisify } from "node:util";

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
  available: boolean;
  source: "ss";
  message: string;
  ports: ListeningPort[];
};

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

export async function getListeningPorts(): Promise<PortStatus> {
  const generatedAt = new Date().toISOString();

  if (process.platform !== "linux") {
    return {
      generatedAt,
      available: false,
      source: "ss",
      message: "포트 조회는 배포된 Linux 서버에서 사용할 수 있습니다.",
      ports: [],
    };
  }

  try {
    const { stdout } = await execFileAsync("ss", ["-H", "-lntup"], {
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 1024 * 1024,
    });

    return {
      generatedAt,
      available: true,
      source: "ss",
      message: "현재 서버에서 연결을 기다리는 TCP·UDP 포트입니다.",
      ports: parseListeningPorts(stdout),
    };
  } catch {
    return {
      generatedAt,
      available: false,
      source: "ss",
      message: "포트 정보를 조회할 수 없습니다. 서버에 iproute 패키지와 실행 권한이 있는지 확인해 주세요.",
      ports: [],
    };
  }
}
