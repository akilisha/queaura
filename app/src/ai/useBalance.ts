import { useAuth } from '@clerk/expo';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useStore } from './Store';
import { AI_BACKEND_URL } from './settings';
import { AiError, getBalance, type Backend, type Balance } from './api';

/** The backend as the signed-in host. */
export function useBackend(): Backend {
  const { getToken } = useAuth();
  return { baseUrl: AI_BACKEND_URL, getToken: () => getToken() };
}

/** The host's AI games, refreshed whenever the screen comes into view. */
export function useBalance() {
  const { isSignedIn } = useAuth();
  const backend = useBackend();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => {
    if (!isSignedIn) return;
    setError(null);
    getBalance(backend)
      .then(setBalance)
      .catch((e: unknown) => setError(e instanceof AiError ? e.message : 'Something went wrong. Please try again.'));
    // The backend object is rebuilt each render; the sign-in state is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);
  useFocusEffect(refresh);
  // A purchase just added AI games: show them straight away.
  const purchases = useStore()?.version ?? 0;
  useEffect(() => {
    if (purchases > 0) refresh();
  }, [purchases, refresh]);
  return { balance, error, refresh };
}
