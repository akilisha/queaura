import { useState } from 'preact/hooks';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmojiPicker } from '../components/EmojiPicker';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { join } from '../state/actions';
import { connection, joining, notice } from '../state/store';

const EMOJIS = ['🦊', '🐼', '🐸', '🦉', '🐙', '🦄', '🐝', '🐢', '🦁', '🐧', '🐳', '🦖', '🌵', '🍕', '🚀', '⚡'];
const MAX_NAME = 20;

/** Nickname (required) and a randomly preselected emoji; nothing else (spec §7.1). */
export function JoinView() {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(() => EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
  const canJoin = name.trim().length > 0 && !joining.value && connection.value === 'open';

  const submit = (e: Event) => {
    e.preventDefault();
    if (canJoin) join(name.trim(), emoji);
  };

  return (
    <Screen title="Join the game" status={connection.value}>
      <form onSubmit={submit}>
        <Card>
          <TextField label="Your nickname" value={name} onInput={setName} maxLength={MAX_NAME} autoFocus />
          <EmojiPicker options={EMOJIS} value={emoji} onChange={setEmoji} />
          {notice.value && <Banner tone="info">{notice.value}</Banner>}
          <Button type="submit" disabled={!canJoin}>
            {joining.value ? 'Joining…' : 'Join'}
          </Button>
        </Card>
      </form>
    </Screen>
  );
}
