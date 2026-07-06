import styles from "./StatusPill.module.css";

export type StatusType =
  | "normal"
  | "progress"
  | "stopped"
  | "unknown"
  | "ready"
  | "missing"
  | "planned";

type StatusPillProps = {
  status: StatusType;
};

export default function StatusPill({ status }: StatusPillProps) {
  const label = {
    normal: "정상",
    progress: "진행 중",
    stopped: "정지",
    unknown: "확인 필요",
    ready: "정상",
    missing: "정지",
    planned: "진행 중",
  }[status];

  return <span className={`${styles.pill} ${styles[status]}`}>{label}</span>;
}
