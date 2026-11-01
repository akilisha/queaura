import styles from './Logo.module.css';

/** "Que" in violet, "aura" in gold: the name shows its two halves (spec §2.3). */
export function Logo({ size = 'normal' }: { size?: 'small' | 'normal' | 'large' }) {
  return (
    <span class={`${styles.logo} ${styles[size]}`} aria-label="Queaura">
      <span class={styles.que} aria-hidden="true">Que</span>
      <span class={styles.aura} aria-hidden="true">aura</span>
    </span>
  );
}
