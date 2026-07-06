import Header from "../components/Header";
import LoginPanel from "../components/LoginPanel";
import { isAuthConfigured, isAuthenticated } from "../lib/auth";
import styles from "./settings.module.css";

export default async function SettingsPage() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return <LoginPanel authConfigured={isAuthConfigured()} />;
  }

  return (
    <main className={styles.page}>
      <Header activePath="settings" />

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>설정</h2>
          <p>추후 OCI, DB, 서버 실행 방식 설정을 관리할 영역입니다.</p>
        </div>

        <div className={styles.settingGrid}>
          <article className={styles.settingCard}>
            <h3>OCI API</h3>
            <p>테넌시, 사용자, API key, compartment 정보를 점검하는 설정을 연결합니다.</p>
          </article>
          <article className={styles.settingCard}>
            <h3>데이터베이스</h3>
            <p>같은 서버 또는 private network 안의 PostgreSQL 연결 상태를 확인합니다.</p>
          </article>
          <article className={styles.settingCard}>
            <h3>배포/프로세스</h3>
            <p>실행 포트, reverse proxy, 서비스 관리 상태를 확인하는 화면을 붙입니다.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
