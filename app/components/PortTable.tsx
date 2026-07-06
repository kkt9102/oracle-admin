import type { ListeningPort, PortStatus } from "../lib/ports";
import styles from "./PortTable.module.css";

function getBindingLabel(binding: ListeningPort["binding"]) {
  return {
    all: "모든 인터페이스",
    loopback: "서버 내부 전용",
    interface: "특정 인터페이스",
  }[binding];
}

type PortTableProps = {
  portStatus: PortStatus;
};

export default function PortTable({ portStatus }: PortTableProps) {
  if (!portStatus.available || portStatus.ports.length === 0) {
    return (
      <div className={styles.empty_state}>
        {portStatus.available
          ? "현재 확인된 리스닝 포트가 없습니다."
          : "OCI Linux 서버에 배포한 뒤 포트 정보를 확인할 수 있습니다."}
      </div>
    );
  }

  return (
    <div className={styles.table_wrapper}>
      <table className={styles.port_table}>
        <thead>
          <tr>
            <th scope="col">포트</th>
            <th scope="col">프로토콜</th>
            <th scope="col">서비스</th>
            <th scope="col">바인딩 주소</th>
            <th scope="col">접근 범위</th>
            <th scope="col">프로세스</th>
          </tr>
        </thead>
        <tbody>
          {portStatus.ports.map((port, index) => (
            <tr key={`${port.protocol}-${port.address}-${port.port}-${index}`}>
              <td>
                <strong>{port.port}</strong>
              </td>
              <td>
                <span className={styles.protocol_badge}>
                  {port.protocol.toUpperCase()}
                </span>
              </td>
              <td>{port.service}</td>
              <td>
                <code>{port.address}</code>
              </td>
              <td>{getBindingLabel(port.binding)}</td>
              <td>
                {port.processName
                  ? `${port.processName}${port.processId ? ` (PID ${port.processId})` : ""}`
                  : "권한 없음"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
