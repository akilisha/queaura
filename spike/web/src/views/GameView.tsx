import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { KeyValueList } from '../components/KeyValueList';
import { ScoreList } from '../components/ScoreList';
import { Screen } from '../components/Screen';
import { Stat } from '../components/Stat';
import { tap } from '../state/actions';
import * as store from '../state/store';
import styles from './GameView.module.css';

const ms = (value: number | null) => (value === null ? '–' : `${value} ms`);

/**
 * The one game screen for players and the TV. The TV is this tree with the input and the
 * per-device metrics left out (spec §2.2), plus the join address.
 */
export function GameView() {
  const isPlayer = store.mode.value === 'player';
  const me = store.me.value;

  return (
    <Screen title={me ? `${me.emoji} ${me.name}` : 'Queaura'} status={store.connection.value} fit={!isPlayer}>
      <div class={isPlayer ? styles.column : styles.board}>
        <Card fill={!isPlayer}>
          <div class={styles.stats}>
            <Stat label="Counter" value={store.counter.value} size="display" />
            <Stat label={isPlayer ? 'Your taps' : 'Room taps'} value={isPlayer ? (me?.taps ?? 0) : store.totalTaps.value} />
          </div>
          {isPlayer && (
            <div class={styles.tap}>
              <Button size="huge" onClick={tap} disabled={store.connection.value !== 'open'}>
                Tap
              </Button>
            </div>
          )}
          {!isPlayer && <p class={styles.joinHint}>Join at {location.host}</p>}
        </Card>
        <Card title={`Players (${store.playersOnline.value} online)`} fill={!isPlayer}>
          <ScoreList players={store.players.value} highlightId={store.myId.value} />
        </Card>
      </div>
      {isPlayer && (
        <Card title="Connection">
          <KeyValueList
            rows={[
              ['Round trip', ms(store.rttMs.value)],
              ['Join time', ms(store.joinMs.value)],
              ['Reconnects', String(store.reconnects.value)],
              ['Last reconnect', ms(store.lastReconnectMs.value)],
              ['Longest tick gap', ms(store.maxTickGapMs.value || null)],
              ['Screen slept', String(store.screenSleeps.value)],
            ]}
          />
        </Card>
      )}
    </Screen>
  );
}
