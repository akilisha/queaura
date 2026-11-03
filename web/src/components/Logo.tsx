import styles from './Logo.module.css';

/** "Que" in violet, "Aura" in gold: the name shows its two halves (spec §2.3). */
export function Logo({ size = 'normal' }: { size?: 'small' | 'normal' | 'large' }) {
  return (
    <span class={`${styles.logo} ${styles[size]}`} aria-label="QueAura">
      <span class={styles.que} aria-hidden="true">Que</span>
      <span class={styles.aura} aria-hidden="true">Aura</span>
    </span>
  );
}
