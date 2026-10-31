import type { ConnectionStatus } from '../state/store';
import styles from './StatusBadge.module.css';

const LABELS: Record<ConnectionStatus, string> = {
  connecting: 'Connecting',
  open: 'Connected',
  reconnecting: 'Reconnecting',
  replaced: 'Opened elsewhere',
};

export function StatusBadge({ status }: { status: ConnectionStatus }) {
  return (
    <span class={`${styles.badge} ${styles[status]}`} role="status">
      <span class={styles.dot} aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
