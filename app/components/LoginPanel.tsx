import { loginAction } from "../actions";
import styles from "./LoginPanel.module.css";

type LoginPanelProps = {
  authConfigured: boolean;
  error?: string;
};

export default function LoginPanel({ authConfigured, error }: LoginPanelProps) {
  return (
    <main className={styles.login_page}>
      <section className={styles.login_panel}>
        <div className={styles.brand_block}>
          <p className={styles.eyebrow}>Oracle Cloud Free Tier</p>
          <h1>개인 관리자 로그인</h1>
          <p>
            이 화면은 서버 상태와 OCI 리소스 정보를 확인하기 위한 개인용 관리자
            페이지입니다.
          </p>
        </div>

        <form action={loginAction} className={styles.login_form}>
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
            <p className={styles.error_text}>아이디 또는 비밀번호를 확인해 주세요.</p>
          ) : null}
          {!authConfigured ? (
            <p className={styles.warning_text}>
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
