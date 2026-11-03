import { useAuth } from '@clerk/expo';
import { createPurchaseFlow, useIAP, type Product, type PurchaseFlowOutcome, type Purchase } from 'expo-iap';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AI_BACKEND_URL } from './settings';
import { getBalance, type Backend } from './api';
import { confirmationFrom, PACKS } from './purchase';

// The Google Play store connection, one for the whole app (spec §8). It lives at the root so a
// purchase the app didn't finish (closed mid-purchase, offline) is confirmed on the next launch,
// not only when the purchase screen is open.

interface Store {
  /** Connected to Google Play; false in builds not installed from Play, or offline. */
  connected: boolean;
  /** The packs, with Google's own names and prices in the host's currency. */
  products: Product[];
  buy: (productId: string) => Promise<void>;
  /** The last purchase's outcome, for the purchase screen to explain. */
  outcome: PurchaseFlowOutcome<Purchase> | null;
  /** Goes up whenever AI games are added, so balances refresh. */
  version: number;
}

const Context = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, userId, getToken } = useAuth();
  const backend: Backend = { baseUrl: AI_BACKEND_URL, getToken: () => getToken() };
  const backendRef = useRef(backend);
  backendRef.current = backend;
  const [outcome, setOutcome] = useState<PurchaseFlowOutcome<Purchase> | null>(null);
  const [version, setVersion] = useState(0);
  const accountIdRef = useRef<string | null>(null);

  // One flow per signed-in account: it confirms each purchase with our backend before finishing it.
  const flow = useMemo(
    () =>
      isSignedIn
        ? createPurchaseFlow({
            isConsumable: () => true,
            confirmTimeoutMs: 30_000,
            confirmWithBackend: async (purchase) => {
              const token = await backendRef.current.getToken();
              if (!token) throw new Error('Not signed in');
              const res = await fetch(`${AI_BACKEND_URL}/v1/purchases`, {
                method: 'POST',
                headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
                body: JSON.stringify({ productId: purchase.productId, purchaseToken: purchase.purchaseToken }),
              });
              return confirmationFrom(res.status, await res.json().catch(() => null));
            },
          })
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSignedIn, userId],
  );
  useEffect(() => () => flow?.dispose(), [flow]);

  const { connected, products, fetchProducts, requestPurchase } = useIAP({
    purchaseFlow: flow,
    onPurchaseFlowOutcome: (o) => {
      setOutcome(o);
      if (o.status.status === 'entitled') setVersion((v) => v + 1);
    },
  });

  useEffect(() => {
    if (connected && isSignedIn) void fetchProducts({ skus: [...PACKS], type: 'in-app' });
  }, [connected, isSignedIn, fetchProducts]);

  const buy = async (productId: string) => {
    setOutcome(null);
    // The account id Google returns with the purchase, so the backend can match it to this host.
    if (!accountIdRef.current) accountIdRef.current = (await getBalance(backendRef.current)).purchaseAccountId ?? null;
    await requestPurchase({ type: 'in-app', request: { google: { skus: [productId], obfuscatedAccountId: accountIdRef.current } } });
  };

  const ordered = [...products].sort((a, b) => PACKS.indexOf(a.id as (typeof PACKS)[number]) - PACKS.indexOf(b.id as (typeof PACKS)[number]));
  return <Context.Provider value={{ connected, products: ordered, buy, outcome, version }}>{children}</Context.Provider>;
}

export function useStore(): Store | null {
  return useContext(Context);
}
