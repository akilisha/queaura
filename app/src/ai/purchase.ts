import type { PurchaseConfirmation } from 'expo-iap';

// Buying AI games (spec §8). The packs on sale, and how the backend's answer about a purchase
// becomes the store library's verdict. Pure, so tests cover it.

/** Google Play product ids, in the order shown; the backend maps each to its AI games. */
export const PACKS = ['ai_games_1', 'ai_games_5', 'ai_games_10'] as const;

/**
 * The backend's answer to POST /v1/purchases as the store library's verdict. Only "entitled"
 * finishes (consumes) the purchase, so a pack is never used up without its AI games credited.
 * Anything temporary throws instead, so the library tries again later (on the next launch too).
 */
export function confirmationFrom(status: number, body: unknown): PurchaseConfirmation {
  const b = (body ?? {}) as { credited?: boolean; pending?: boolean };
  if (status === 200) return { status: 'entitled', alreadyGranted: b.credited === false };
  if (status === 202) return { status: 'store_pending' };
  if (status === 403) return { status: 'ownership_conflict', alreadyGranted: false };
  if (status === 400) return { status: 'invalid' };
  throw new Error(`The purchase couldn't be confirmed yet (status ${status}).`);
}

/**
 * What to tell the host when Google Play's purchase sheet fails, by the store library's error code.
 * Plain and safe: never the library's own text, which means nothing to a host and says more
 * than it should. Null means say nothing (they cancelled).
 */
export function purchaseErrorMessage(error: unknown): string | null {
  const code = String((error as { code?: unknown } | null)?.code ?? '');
  switch (code) {
    case 'user-cancelled':
      return null;
    case 'deferred-payment':
    case 'pending':
      return 'Your payment is pending. The AI games are added as soon as Google Play confirms it.';
    case 'already-owned':
    case 'duplicate-purchase':
      return "Your last purchase is still being confirmed. It's added shortly, and you won't be charged twice.";
    case 'network-error':
    case 'service-disconnected':
    case 'service-timeout':
    case 'connection-closed':
    case 'init-connection':
      return "Couldn't reach Google Play. Check that this phone is online, then try again. You weren't charged.";
    case 'item-unavailable':
    case 'sku-not-found':
      return "That pack isn't available right now. You weren't charged.";
    default:
      return "The purchase didn't go through, so you weren't charged. Check your payment method in Google Play, or try again.";
  }
}
