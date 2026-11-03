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
