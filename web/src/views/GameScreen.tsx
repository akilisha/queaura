import type { ComponentChildren } from 'preact';
import { Banner } from '../components/Banner';
import { Logo } from '../components/Logo';
import { Screen } from '../components/Screen';
import * as store from '../state/store';

/** Every in-game view sits in this: title, connection badge, paused and notice banners. */
export function GameScreen({ children }: { children: ComponentChildren }) {
  const g = store.game.value;
  const me = store.you.value;
  const isTv = store.mode.value === 'tv';
  return (
    <Screen title={isTv ? <Logo size="small" /> : me ? `${me.emoji} ${me.name}` : <Logo size="small" />} status={store.connection.value} fit={isTv}>
      {g?.paused && <Banner tone="warning">Paused by the host</Banner>}
      {store.notice.value && <Banner tone="info">{store.notice.value}</Banner>}
      {children}
    </Screen>
  );
}
