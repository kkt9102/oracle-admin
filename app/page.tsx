import Header from "./components/Header";
import LoginPanel from "./components/LoginPanel";
import PortTable from "./components/PortTable";
import StatusPill from "./components/StatusPill";
import SummaryBand from "./components/SummaryBand";
import UsageBars from "./components/UsageBars";
import { isAuthConfigured, isAuthenticated } from "./lib/auth";
import { getCloudStatus } from "./lib/cloud";
import { getListeningPorts } from "./lib/ports";
import { getUsageHistory } from "./lib/systemUsage";
import styles from "./page.module.css";

type SearchParams = Promise<{
  error?: string;
}>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const [{ error }, authenticated] = await Promise.all([
    searchParams,
    isAuthenticated(),
  ]);

  if (!authenticated) {
    return <LoginPanel authConfigured={isAuthConfigured()} error={error} />;
  }

  const [cloudStatus, portStatus, usageHistory] = await Promise.all([
    getCloudStatus(),
    getListeningPorts(),
    getUsageHistory(),
  ]);

  return (
    <main className={styles.dashboard}>
      <Header activePath="dashboard" />

      <SummaryBand
        items={[
          {
            label: "OCI 연결",
            value: cloudStatus.tenancy.configured ? "설정됨" : "설정 필요",
          },
          {
            label: "리전",
            value: cloudStatus.tenancy.region || "미설정",
          },
          {
            label: "업데이트",
            value: `${new Date(cloudStatus.generatedAt).toLocaleString("ko-KR")}${cloudStatus.cacheHit ? " (캐시)" : ""}`,
          },
          {
            label: "리스닝 포트",
            value: portStatus.available ? `${portStatus.ports.length}개` : "조회 불가",
          },
        ]}
      />

      <section className={styles.portSection} aria-labelledby="port-section-title">
        <div className={styles.sectionHeader}>
          <h2 id="port-section-title">현재 사용 중인 포트</h2>
          <p>{portStatus.message}</p>
          <p className={styles.sectionNote}>
            모든 인터페이스에 바인딩되어도 OCI Security List 또는 NSG에서 허용되지 않으면 외부에서 접근할 수 없습니다.
          </p>
        </div>

        <PortTable portStatus={portStatus} />
      </section>

      <section className={styles.grid}>
        {cloudStatus.checks.map((check) => (
          <article className={styles.card} key={check.label}>
            <div className={styles.cardHeader}>
              <h2>{check.label}</h2>
              <StatusPill status={check.status} />
            </div>
            <p>{check.detail}</p>
          </article>
        ))}
      </section>

      <section className={styles.usageSection} aria-labelledby="usage-section-title">
        <div className={styles.sectionHeader}>
          <h2 id="usage-section-title">서버 사용량</h2>
          <p>
            자동 갱신은 30분 단위로 제한하고, 최대 7일치 스냅샷을 서버 캐시에 저장합니다.
          </p>
          <p className={styles.sectionNote}>
            현재는 Linux 서버에서 직접 확인 가능한 메모리, 디스크, 부하를 보여줍니다. OCI 무료 티어 전체 한도는 Monitoring/Limit API 연결 후 확장합니다.
          </p>
        </div>

        <UsageBars history={usageHistory} />
      </section>

      <section className={styles.resourceSection}>
        <div className={styles.sectionHeader}>
          <h2>상태 관리 항목</h2>
          <p>OCI API 연결 후 이 영역에 실제 리소스 상태가 채워집니다.</p>
        </div>
        <div className={styles.resourceGrid}>
          {Object.entries(cloudStatus.resources).map(([group, items]) => (
            <article className={styles.resourceCard} key={group}>
              {items.map((item) => (
                <div key={item.label}>
                  <div className={styles.cardHeader}>
                    <h3>{item.label}</h3>
                    <StatusPill status={item.status} />
                  </div>
                  <p>{item.detail}</p>
                </div>
              ))}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
