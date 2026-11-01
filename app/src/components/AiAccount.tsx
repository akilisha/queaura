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
  const { signOut } = useClerk();
  const { balance, error } = useBalance();
  if (!isLoaded) return null;
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
      <Button tone="secondary" label="Sign out" onPress={() => void signOut()} />
    </Card>
  );
}
