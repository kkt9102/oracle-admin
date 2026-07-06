"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import type { ErrorNotification } from "../lib/errorNotifications";
import styles from "./ErrorNotificationCenter.module.css";

type ErrorNotificationCenterProps = {
  initialNotifications: ErrorNotification[];
};

function formatOccurredAt(occurredAt: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(occurredAt));
}

export default function ErrorNotificationCenter({
  initialNotifications,
}: ErrorNotificationCenterProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  async function deleteNotification(id: string) {
    setDeletingId(id);
    setDeleteError(null);

    try {
      const response = await fetch(
        `/api/error-notifications?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        throw new Error("오류 메시지를 삭제하지 못했습니다.");
      }

      setNotifications((current) =>
        current.filter((notification) => notification.id !== id),
      );
    } catch {
      setDeleteError("삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={styles.notification_center} ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`오류 알림 ${notifications.length}개`}
        className={styles.notification_button}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <Bell aria-hidden="true" size={20} />
        {notifications.length > 0 && (
          <span className={styles.notification_count}>
            {notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          aria-label="오류 알림함"
          className={styles.notification_panel}
          role="dialog"
        >
          <div className={styles.panel_header}>
            <div>
              <strong>오류 알림</strong>
              <p>최근 오류를 최대 20개까지 보관합니다.</p>
            </div>
            <span>{notifications.length}개</span>
          </div>

          {deleteError && (
            <p className={styles.delete_error} role="alert">
              {deleteError}
            </p>
          )}

          {notifications.length === 0 ? (
            <p className={styles.empty_message}>보관된 오류가 없습니다.</p>
          ) : (
            <ol className={styles.notification_list}>
              {notifications.map((notification) => (
                <li className={styles.notification_item} key={notification.id}>
                  <div className={styles.item_meta}>
                    <strong>{notification.source}</strong>
                    <time dateTime={notification.occurredAt}>
                      {formatOccurredAt(notification.occurredAt)}
                    </time>
                  </div>
                  <p>{notification.message}</p>
                  <div className={styles.item_footer}>
                    <span>{notification.occurrenceCount}회 발생</span>
                    <button
                      aria-label={`${notification.source} 오류 삭제`}
                      disabled={deletingId === notification.id}
                      onClick={() => deleteNotification(notification.id)}
                      title="오류 삭제"
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
