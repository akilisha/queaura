import { useAuth, useClerk } from '@clerk/expo';
import { router } from 'expo-router';
import { describeBalance } from '../ai/api';
import { aiConfigured } from '../ai/settings';
import { useBalance } from '../ai/useBalance';
import { Body, Button, Card, ErrorText, Muted } from './ui';

/** Where a host signs in for AI questions and sees their AI games (spec §8). */
export function AiAccount() {
  if (!aiConfigured) return null;
  return <Account />;
}

function Account() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut, status } = useClerk();
  const { balance, error } = useBalance();
  // Never vanish: a host looking for sign-in should always find this card and learn why it waits.
  if (status === 'error') {
    return (
      <Card title="AI questions">
        <ErrorText>Sign-in couldn't load. Check that this phone is online, then close and reopen the app.</ErrorText>
      </Card>
    );
  }
  if (!isLoaded) {
    return (
      <Card title="AI questions">
        <Muted>Connecting to sign-in…</Muted>
      </Card>
    );
  }
  if (!isSignedIn) {
    return (
      <Card title="AI questions">
        <Body>Let AI write questions for you on any topic. Sign in to get your free AI games.</Body>
        <Button label="Sign in" onPress={() => router.push('/sign-in')} />
      </Card>
    );
  }
  return (
    <Card title="AI questions">
      {balance && <Body>{describeBalance(balance)}</Body>}
      {!balance && !error && <Muted>Checking your AI games…</Muted>}
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Write questions with AI" onPress={() => router.push('/ai-write')} />
      <Button tone="secondary" label="Get more AI games" onPress={() => router.push('/get-ai-games')} />
      <Button tone="secondary" label="Sign out" onPress={() => void signOut()} />
    </Card>
  );
}
