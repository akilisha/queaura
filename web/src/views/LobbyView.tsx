import { Card } from '../components/Card';
import { QRCode } from '../components/QRCode';
import { ScoreList } from '../components/ScoreList';
import * as store from '../state/store';
import { GameScreen } from './GameScreen';
import styles from './views.module.css';

export function LobbyView() {
  const g = store.game.value!;
  const online = g.scores.filter((p) => p.online).length;
  const me = store.you.value;
  const players = <ScoreList players={g.scores} highlightId={me?.id} metric="none" />;

  if (store.mode.value === 'tv') {
    const url = `http://${location.host}/`;
    return (
      <GameScreen>
        <div class={styles.board}>
          <Card fill>
            <div class={styles.join}>
              <QRCode text={url} label={`Join at ${url}`} />
              <p class={styles.lead}>Scan to join</p>
              <p class={styles.address}>{location.host}</p>
            </div>
          </Card>
          <Card title={`Players (${online})`} fill>
            {players}
          </Card>
        </div>
      </GameScreen>
    );
  }

  return (
    <GameScreen>
      <Card>
        <p class={styles.lead}>You're in!</p>
        <p class={styles.muted}>Waiting for the host to start the game.</p>
      </Card>
      <Card title={`Players (${online})`}>{players}</Card>
    </GameScreen>
  );
}
