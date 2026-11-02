import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';

/** Who is calling: the account id (the Clerk user id), or null if not signed in. */
export type Authenticator = (req: Request) => Promise<string | null>;

/** Without Clerk settings every signed-in route refuses; the server still runs (health checks). */
export const notConfigured: Authenticator = async () => null;

/**
 * Checks the Clerk session token the app sends as `Authorization: Bearer <token>`. With the JWT
 * public key it needs no network call; with only the secret key it fetches Clerk's keys (cached).
 */
export function clerkAuthenticator(options: { jwtKey?: string; secretKey?: string }): Authenticator {
  return async (req) => {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return null;
    try {
      // Throws on a forged, expired or malformed token.
      const payload = await verifyToken(token, { ...options, clockSkewInMs: 10_000 });
      return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
    } catch (e) {
      // Why a token was refused (expired, wrong key, wrong instance); never the token itself.
      console.warn(JSON.stringify({ level: 'warn', message: 'sign-in token refused', reason: e instanceof Error ? e.message : String(e) }));
      return null;
    }
  };
}
