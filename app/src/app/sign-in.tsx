import { useSignIn, useSignUp } from '@clerk/expo';
import { router } from 'expo-router';
import { useState } from 'react';
import { Field } from '../components/form';
import { Body, Button, Card, ErrorText, Muted, Screen } from '../components/ui';

/**
 * Sign-in for AI questions (spec §8), and only for them: the rest of the app needs no account.
 * One flow for new and returning hosts: an email address, then the code Clerk emails to it.
 */
export default function SignIn() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  // Returning hosts sign in; an address Clerk doesn't know yet signs up instead.
  const [mode, setMode] = useState<'signIn' | 'signUp' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (step: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await step();
    } catch {
      setError('Something went wrong. Check that this phone is online, then try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      const address = email.trim();
      const sent = await signIn.emailCode.sendCode({ emailAddress: address });
      if (!sent.error) return setMode('signIn');
      if (!isUnknownAddress(sent.error)) return setError(messageOf(sent.error));
      const created = await signUp.create({ emailAddress: address });
      if (created.error) return setError(messageOf(created.error));
      const signUpSent = await signUp.verifications.sendEmailCode();
      if (signUpSent.error) return setError(messageOf(signUpSent.error));
      setMode('signUp');
    });

  const verify = () =>
    run(async () => {
      const entered = code.trim();
      if (mode === 'signIn') {
        const result = await signIn.emailCode.verifyCode({ code: entered });
        if (result.error) return setError(messageOf(result.error));
        if (signIn.status !== 'complete') return setError("This account needs a sign-in step this app doesn't support yet.");
        const done = await signIn.finalize();
        if (done.error) return setError(messageOf(done.error));
      } else {
        const result = await signUp.verifications.verifyEmailCode({ code: entered });
        if (result.error) return setError(messageOf(result.error));
        if (signUp.status !== 'complete') return setError("Signing up needs a step this app doesn't support yet.");
        const done = await signUp.finalize();
        if (done.error) return setError(messageOf(done.error));
      }
      router.back();
    });

  return (
    <Screen form>
      <Card title="Sign in for AI questions">
        <Body>AI writes questions for you. Signing in keeps track of your AI games. Everything else in the app works without an account.</Body>
        {mode === null ? (
          <>
            <Field
              label="Email address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoFocus
            />
            <Button big label={busy ? 'Sending…' : 'Email me a code'} onPress={sendCode} disabled={busy || !email.includes('@')} />
          </>
        ) : (
          <>
            <Muted>We emailed a code to {email.trim()}. It can take a minute; check spam if it doesn't arrive.</Muted>
            <Field label="Code" value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" autoComplete="one-time-code" autoFocus />
            <Button big label={busy ? 'Checking…' : 'Sign in'} onPress={verify} disabled={busy || code.trim().length < 4} />
            <Button
              tone="secondary"
              label="Use a different email"
              onPress={() => {
                setMode(null);
                setCode('');
                setError(null);
              }}
            />
          </>
        )}
        {error && <ErrorText>{error}</ErrorText>}
      </Card>
    </Screen>
  );
}

/** Clerk says the address has no account yet (so this is a sign-up). */
function isUnknownAddress(error: { code: string }): boolean {
  const inner = (error as { errors?: { code?: string }[] }).errors ?? [];
  return error.code === 'form_identifier_not_found' || inner.some((e) => e.code === 'form_identifier_not_found');
}

/** Clerk's own message for the host (wrong code, expired code, invalid address), or a plain fallback. */
function messageOf(error: { message: string; longMessage?: string }): string {
  const inner = (error as { errors?: { longMessage?: string; message?: string }[] }).errors?.[0];
  return inner?.longMessage ?? inner?.message ?? error.longMessage ?? 'That did not work. Please try again.';
}
