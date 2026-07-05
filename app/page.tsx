import { loginAction, logoutAction } from "./actions";
import { isAuthConfigured, isAuthenticated } from "./lib/auth";
import { getCloudStatus } from "./lib/cloud";
import { getListeningPorts, type ListeningPort } from "./lib/ports";
import styles from "./page.module.css";

type SearchParams = Promise<{
  error?: string;
}>;

function StatusPill({ status }: { status: "ready" | "missing" | "planned" }) {
  const label = {
    ready: "Ready",
    missing: "Missing",
    planned: "Next",
  }[status];

  return <span className={`${styles.pill} ${styles[status]}`}>{label}</span>;
}

function getBindingLabel(binding: ListeningPort["binding"]) {
  return {
    all: "모든 인터페이스",
    loopback: "서버 내부 전용",
    interface: "특정 인터페이스",
  }[binding];
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const [{ error }, authenticated] = await Promise.all([
    searchParams,
    isAuthenticated(),
  ]);
  const authConfigured = isAuthConfigured();

  if (!authenticated) {
    return (
      <main className={styles.loginPage}>
        <section className={styles.loginPanel}>
          <div className={styles.brandBlock}>
            <p className={styles.eyebrow}>Oracle Cloud Free Tier</p>
            <h1>개인 관리자 로그인</h1>
            <p>
              이 화면은 서버 상태와 OCI 리소스 정보를 확인하기 위한 개인용
              관리자 페이지입니다.
            </p>
          </div>

          <form action={loginAction} className={styles.loginForm}>
            <label>
              <span>아이디</span>
              <input
                name="username"
                type="text"
                autoComplete="username"
                placeholder="admin"
                required
              />
            </label>
            <label>
              <span>비밀번호</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            {error === "invalid" ? (
              <p className={styles.errorText}>아이디 또는 비밀번호를 확인해 주세요.</p>
            ) : null}
            {!authConfigured ? (
              <p className={styles.warningText}>
                ADMIN_USERNAME과 ADMIN_PASSWORD 환경변수를 먼저 설정해야 합니다.
              </p>
            ) : null}
            <button type="submit" disabled={!authConfigured}>
              로그인
            </button>
          </form>
        </section>
      </main>
    );
  }

  const [cloudStatus, portStatus] = await Promise.all([
    Promise.resolve(getCloudStatus()),
    getListeningPorts(),
  ]);

  return (
    <main className={styles.dashboard}>
      <header className={styles.topbar}>
        <div>
          <p className={styles.eyebrow}>Oracle Admin</p>
          <h1>무료 티어 서버 상태</h1>
        </div>
        <form action={logoutAction}>
          <button className={styles.secondaryButton} type="submit">
            로그아웃
          </button>
        </form>
      </header>

      <section className={styles.summaryBand}>
        <div>
          <span>OCI 연결</span>
          <strong>{cloudStatus.tenancy.configured ? "설정됨" : "설정 필요"}</strong>
        </div>
        <div>
          <span>리전</span>
          <strong>{cloudStatus.tenancy.region || "미설정"}</strong>
        </div>
        <div>
          <span>업데이트</span>
          <strong>{new Date(cloudStatus.generatedAt).toLocaleString("ko-KR")}</strong>
        </div>
        <div>
          <span>리스닝 포트</span>
          <strong>{portStatus.available ? `${portStatus.ports.length}개` : "조회 불가"}</strong>
        </div>
      </section>

      <section className={styles.port_section} aria-labelledby="port-section-title">
        <div className={styles.sectionHeader}>
          <h2 id="port-section-title">현재 사용 중인 포트</h2>
          <p>{portStatus.message}</p>
          <p className={styles.section_note}>
            모든 인터페이스에 바인딩되어도 OCI Security List 또는 NSG에서 허용되지 않으면 외부에서 접근할 수 없습니다.
          </p>
        </div>

        {portStatus.available && portStatus.ports.length > 0 ? (
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
                    <td><strong>{port.port}</strong></td>
                    <td><span className={styles.protocol_badge}>{port.protocol.toUpperCase()}</span></td>
                    <td>{port.service}</td>
                    <td><code>{port.address}</code></td>
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
        ) : (
          <div className={styles.empty_state}>
            {portStatus.available
              ? "현재 확인된 리스닝 포트가 없습니다."
              : "OCI Linux 서버에 배포한 뒤 포트 정보를 확인할 수 있습니다."}
          </div>
        )}
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
