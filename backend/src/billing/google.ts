import { createHash } from 'node:crypto';
import { JWT, OAuth2Client } from 'google-auth-library';

// Google Play (spec §8): confirming purchases with Google before crediting AI games, and checking
// that purchase notifications really come from Google. Calls are plain HTTPS to the Play
// Developer API, signed in as a service account.

/** What Google says about a one-time purchase. */
export interface ProductPurchase {
  /** 0 purchased, 1 cancelled, 2 pending. */
  purchaseState: number;
  /** The id the app attached at purchase time (see [purchaseAccountId]). */
  obfuscatedExternalAccountId?: string;
  orderId?: string;
}

export interface GooglePlay {
  /** Null when Google has no such purchase. */
  productPurchase(productId: string, purchaseToken: string): Promise<ProductPurchase | null>;
}

const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

/**
 * [test] points the client at a local fake of Google's API, with its own sign-in headers, so tests
 * need neither Google nor a real service account.
 */
export function googlePlay(serviceAccountJson: string, packageName: string, test?: { baseUrl: string; headers: () => Promise<Record<string, string>> }): GooglePlay {
  const key = JSON.parse(serviceAccountJson) as { client_email: string; private_key: string };
  const auth = new JWT({ email: key.client_email, key: key.private_key, scopes: [SCOPE] });
  const baseUrl = test?.baseUrl ?? 'https://androidpublisher.googleapis.com';
  return {
    async productPurchase(productId, purchaseToken) {
      const url = `${baseUrl}/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
      const res = await fetch(url, { headers: test ? await test.headers() : await auth.getRequestHeaders(url) });
      if (res.status === 404 || res.status === 400 || res.status === 410) return null;
      if (!res.ok) throw new Error(`Google Play ${res.status}: ${await res.text()}`);
      return (await res.json()) as ProductPurchase;
    },
  };
}

/**
 * The id the app sends with each purchase so Google returns it with the purchase: our account,
 * without revealing it (Google allows up to 64 characters and asks that it not be personal data).
 */
export function purchaseAccountId(accountId: string): string {
  return createHash('sha256').update(`queaura:${accountId}`).digest('base64url');
}

/**
 * Checks a Pub/Sub push request's signed token: issued by Google for our endpoint, from the
 * service account the push subscription uses.
 */
export function pushVerifier(audience: string, serviceAccountEmail: string): (authorization: string | undefined) => Promise<boolean> {
  const client = new OAuth2Client();
  return async (authorization) => {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) return false;
    try {
      const payload = (await client.verifyIdToken({ idToken: token, audience })).getPayload();
      return payload?.email === serviceAccountEmail && payload.email_verified === true;
    } catch {
      return false;
    }
  };
}
