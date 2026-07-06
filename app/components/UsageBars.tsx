import type { UsageHistory, UsageMetric } from "../lib/systemUsage";
import styles from "./UsageBars.module.css";

function getLatestMetric(history: UsageHistory, key: UsageMetric["key"]) {
  return history.snapshots.at(-1)?.metrics.find((metric) => metric.key === key);
}

function formatMetric(metric: UsageMetric) {
  if (metric.key === "load") {
    return `${metric.used.toFixed(1)}${metric.unit}`;
  }

  return `${metric.used.toFixed(1)} / ${metric.limit.toFixed(1)}${metric.unit}`;
}

type MiniHistoryChartProps = {
  history: UsageHistory;
  metricKey: UsageMetric["key"];
};

function MiniHistoryChart({ history, metricKey }: MiniHistoryChartProps) {
  const samples = history.snapshots.slice(-336);

  return (
    <div className={styles.chart} aria-label="최근 7일 사용량 그래프">
      {samples.map((snapshot) => {
        const metric = snapshot.metrics.find((item) => item.key === metricKey);
        const height = Math.max(4, metric?.percent || 0);

        return (
          <span
            className={styles.bar}
            key={`${snapshot.generatedAt}-${metricKey}`}
            style={{ height: `${height}%` }}
            title={`${new Date(snapshot.generatedAt).toLocaleString("ko-KR")} ${metric?.percent ?? 0}%`}
          />
        );
      })}
    </div>
  );
}

type UsageBarsProps = {
  history: UsageHistory;
};

export default function UsageBars({ history }: UsageBarsProps) {
  const metrics = ["memory", "disk", "load"]
    .map((key) => getLatestMetric(history, key as UsageMetric["key"]))
    .filter((metric): metric is UsageMetric => Boolean(metric));

  return (
    <div className={styles.grid}>
      {metrics.map((metric) => (
        <article className={styles.card} key={metric.key}>
          <div className={styles.card_header}>
            <div>
              <h3>{metric.label}</h3>
              <p>{metric.description}</p>
            </div>
            <strong className={styles[metric.level]}>{metric.percent.toFixed(1)}%</strong>
          </div>

          <div className={styles.track} aria-hidden="true">
            <span
              className={`${styles.fill} ${styles[metric.level]}`}
              style={{ width: `${metric.percent}%` }}
            />
          </div>

          <div className={styles.metric_footer}>
            <span>{formatMetric(metric)}</span>
            <span>다음 갱신 {new Date(history.nextRefreshAt).toLocaleTimeString("ko-KR")}</span>
          </div>

          <MiniHistoryChart history={history} metricKey={metric.key} />
        </article>
      ))}
    </div>
  );
}
