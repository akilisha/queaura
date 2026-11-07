import { useAuth, useClerk } from '@clerk/expo';
import { router } from 'expo-router';
import { useState } from 'react';
import { AiError, deleteAccount, describeBalance } from '../ai/api';
import { aiConfigured } from '../ai/settings';
import { useBackend, useBalance } from '../ai/useBalance';
import { useConfirm } from './ConfirmDialog';
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
  const backend = useBackend();
  const [dialog, confirm] = useConfirm();
  const [deleted, setDeleted] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Asked twice: it can't be undone, and unused AI games are lost with it.
  const askDelete = () =>
    confirm({
      title: 'Delete your account?',
      message: 'Your AI games, including any you bought and haven\'t used, are deleted with it. Your questions and games stay on this phone.',
      confirmLabel: 'Delete account',
      cancelLabel: 'Keep it',
      danger: true,
      onConfirm: () =>
        confirm({
          title: 'Delete it for good?',
          message: 'This cannot be undone.',
          confirmLabel: 'Delete for good',
          cancelLabel: 'Keep it',
          danger: true,
          onConfirm: () => {
            setDeleteError(null);
            deleteAccount(backend)
              .then(() => {
                setDeleted(true);
                return signOut();
              })
              .catch((e: unknown) => setDeleteError(e instanceof AiError ? e.message : 'Something went wrong. Please try again.'));
          },
        }),
    });
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
        {deleted && <Muted>Your account was deleted.</Muted>}
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
      <Button tone="secondary" label="Delete my account" onPress={askDelete} />
      {deleteError && <ErrorText>{deleteError}</ErrorText>}
      {dialog}
    </Card>
  );
}
