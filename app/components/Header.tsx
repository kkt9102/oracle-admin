import Link from "next/link";
import { logoutAction } from "../actions";
import { getErrorNotifications } from "../lib/errorNotifications";
import ErrorNotificationCenter from "./ErrorNotificationCenter";
import styles from "./Header.module.css";

type HeaderProps = {
  activePath?: "dashboard" | "settings";
};

export default async function Header({ activePath = "dashboard" }: HeaderProps) {
  const notifications = await getErrorNotifications();

  return (
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Oracle Admin</p>
        <h1>무료 티어 서버 상태</h1>
      </div>
      <nav className={styles.nav} aria-label="주요 메뉴">
        <ErrorNotificationCenter initialNotifications={notifications} />
        <Link
          className={activePath === "dashboard" ? styles.active_link : styles.link}
          href="/"
        >
          대시보드
        </Link>
        <Link
          className={activePath === "settings" ? styles.active_link : styles.link}
          href="/settings"
        >
          설정
        </Link>
        <form action={logoutAction}>
          <button className={styles.logout_button} type="submit">
            로그아웃
          </button>
        </form>
      </nav>
    </header>
  );
}
