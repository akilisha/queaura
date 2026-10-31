import type { ComponentChildren } from 'preact';
import styles from './Banner.module.css';

export function Banner({ tone, children }: { tone: 'info' | 'warning'; children: ComponentChildren }) {
  return (
    <div class={`${styles.banner} ${styles[tone]}`} role="status">
      {children}
    </div>
  );
}
