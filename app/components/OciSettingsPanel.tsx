"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, ExternalLink, KeyRound, X } from "lucide-react";
import type { OciSettingsSummary } from "../lib/ociSettings";
import styles from "./OciSettingsPanel.module.css";

type OciSettingsPanelProps = {
  summary: OciSettingsSummary;
};

const OCI_KEY_DETAIL_URL =
  "https://cloud.oracle.com/identity/domains/my-profile/auth-tokens";

export default function OciSettingsPanel({ summary }: OciSettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const keyDetailUrl =
    summary.region === "미설정"
      ? OCI_KEY_DETAIL_URL
      : `${OCI_KEY_DETAIL_URL}?region=${encodeURIComponent(summary.region)}`;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const rows = [
    { label: "Tenancy OCID", value: summary.tenancyId },
    { label: "User OCID", value: summary.userId },
    { label: "Fingerprint", value: summary.fingerprint },
    { label: "Region", value: summary.region },
    { label: "Compartment OCID", value: summary.compartmentId },
    {
      label: "Private Key",
      value: summary.privateKeyConfigured ? "설정됨" : "미설정",
    },
  ];

  return (
    <>
      <button
        aria-haspopup="dialog"
        className={styles.setting_button}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <span className={styles.setting_icon}>
          <KeyRound aria-hidden="true" size={20} />
        </span>
        <span className={styles.setting_content}>
          <span className={styles.setting_title_row}>
            <strong>OCI API</strong>
            <span
              className={
                summary.configured
                  ? styles.configured_badge
                  : styles.missing_badge
              }
            >
              {summary.configured ? "설정됨" : "확인 필요"}
            </span>
          </span>
          <span className={styles.setting_description}>
            API 인증 정보와 연결 리전을 확인합니다.
          </span>
        </span>
        <ChevronRight aria-hidden="true" className={styles.chevron} size={20} />
      </button>

      {isOpen && (
        <div
          className={styles.modal_backdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <section
            aria-labelledby="oci_api_dialog_title"
            aria-modal="true"
            className={styles.modal_panel}
            role="dialog"
          >
            <div className={styles.modal_header}>
              <div>
                <p>OCI 연결 설정</p>
                <h2 id="oci_api_dialog_title">OCI API</h2>
              </div>
              <button
                aria-label="OCI API 설정 닫기"
                className={styles.close_button}
                onClick={() => setIsOpen(false)}
                ref={closeButtonRef}
                title="닫기"
                type="button"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            <dl className={styles.value_list}>
              {rows.map((row) => (
                <div className={styles.value_row} key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>

            <div className={styles.modal_footer}>
              <a
                href={keyDetailUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                키 상세보기
                <ExternalLink aria-hidden="true" size={16} />
              </a>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
