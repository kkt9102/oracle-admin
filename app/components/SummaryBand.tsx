import styles from "./SummaryBand.module.css";

type SummaryItem = {
  label: string;
  value: string;
};

type SummaryBandProps = {
  items: SummaryItem[];
};

export default function SummaryBand({ items }: SummaryBandProps) {
  return (
    <section className={styles.summary_band}>
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </section>
  );
}
