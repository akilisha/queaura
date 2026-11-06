import type { Kysely } from 'kysely';
import { credit, purchaseOf } from '../credits/ledger.ts';
import type { Database } from '../db/database.ts';
import type { GooglePlay } from './google.ts';

// Taking back the AI games of a refunded or charged-back purchase (spec §8). Google tells us by
// notification, and the check below asks Google's list of voided purchases as well, so a missed
// or late notification is caught too. Each refund counts once however often it is seen.

/** Takes back a purchase's AI games; false if unknown to us or already taken back. */
export async function applyRefund(db: Kysely<Database>, purchaseToken: string, source: 'notification' | 'check', orderId?: string): Promise<boolean> {
  const purchase = await purchaseOf(db, purchaseToken);
  if (!purchase) return false;
  const applied = await credit(db, purchase.accountId, -purchase.aiGames, 'refund', purchaseToken);
  if (applied) console.log(JSON.stringify({ level: 'info', message: 'refund', source, aiGames: purchase.aiGames, orderId }));
  return applied;
}

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

/** Asks Google for every purchase voided in the last 30 days and applies any not yet applied. */
export async function checkRefunds(db: Kysely<Database>, play: GooglePlay, now = Date.now()): Promise<{ voided: number; applied: number }> {
  const voided = await play.voidedPurchases(now - THIRTY_DAYS + 60_000);
  let applied = 0;
  for (const v of voided) if (await applyRefund(db, v.purchaseToken, 'check', v.orderId)) applied++;
  return { voided: voided.length, applied };
}
