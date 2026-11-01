import type { ComponentChildren } from 'preact';
import type { ConnectionStatus } from '../state/store';
import { StatusBadge } from './StatusBadge';
import styles from './Screen.module.css';

interface Props {
  title: ComponentChildren;
  status: ConnectionStatus;
  children: ComponentChildren;
  /** Exactly fill the viewport and never scroll (the TV, which has no way to scroll). */
  fit?: boolean;
}

export function Screen({ title, status, children, fit }: Props) {
  return (
    <main class={`${styles.screen} ${fit ? styles.fit : ''}`}>
      <header class={styles.header}>
        <h1 class={styles.title}>{title}</h1>
        <StatusBadge status={status} />
      </header>
      <div class={styles.body}>{children}</div>
    </main>
  );
}
