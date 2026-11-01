import { Logo } from '../components/Logo';
import { Screen } from '../components/Screen';
import { connection, mode } from '../state/store';
import styles from './views.module.css';

/** Connecting, removed, thanks for playing: the sign, a headline and one line. */
export function NoticeView({ title, message }: { title: string; message: string }) {
  return (
    <Screen title={null} status={connection.value} fit={mode.value === 'tv'}>
      <div class={styles.notice}>
        <Logo size="large" />
        <p class={styles.headline}>{title}</p>
        <p class={styles.muted}>{message}</p>
      </div>
    </Screen>
  );
}
