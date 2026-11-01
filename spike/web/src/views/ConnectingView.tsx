import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { connection } from '../state/store';

export function ConnectingView() {
  return (
    <Screen title="Queaura" status={connection.value}>
      <Card>
        <p>Connecting to the game…</p>
      </Card>
    </Screen>
  );
}
