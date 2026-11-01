import { createSign, generateKeyPairSync } from 'node:crypto';
import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { clerkAuthenticator } from '../src/auth.ts';

// Session tokens signed with a throwaway key, checked the way production checks Clerk's (with
// the JWT public key, no network call).

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

function token(claims: object, key = privateKey): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'RS256', typ: 'JWT', kid: 'ins_test' })}.${b64({ sub: 'user_123', iat: now, nbf: now - 5, exp: now + 60, iss: 'https://clerk.example.com', ...claims })}`;
  return `${body}.${createSign('RSA-SHA256').update(body).sign(key).toString('base64url')}`;
}
const req = (authorization?: string) => ({ header: (name: string) => (name === 'authorization' ? authorization : undefined) }) as unknown as Request;
const authenticate = clerkAuthenticator({ jwtKey: pem });

describe('Clerk sign-in', () => {
  it('accepts a valid session token and names the account', async () => {
    expect(await authenticate(req(`Bearer ${token({})}`))).toBe('user_123');
  });
  it('refuses missing, forged, expired and malformed tokens', async () => {
    const now = Math.floor(Date.now() / 1000);
    expect(await authenticate(req())).toBeNull();
    expect(await authenticate(req(token({})))).toBeNull(); // no "Bearer"
    expect(await authenticate(req(`Bearer ${token({}, other.privateKey)}`))).toBeNull();
    expect(await authenticate(req(`Bearer ${token({ exp: now - 120 })}`))).toBeNull();
    expect(await authenticate(req('Bearer not.a.token'))).toBeNull();
  });
});
