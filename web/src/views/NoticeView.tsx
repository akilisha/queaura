import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { connection, mode } from '../state/store';

export function NoticeView({ title, message }: { title: string; message: string }) {
  return (
    <Screen title={title} status={connection.value} fit={mode.value === 'tv'}>
      <Card>
        <p>{message}</p>
      </Card>
    </Screen>
  );
}
