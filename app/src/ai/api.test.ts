import { describe, expect, it } from 'vitest';
import { AiError, call, describeBalance } from './api';

const backend = (reply: () => Promise<Response>, token: string | null = 'tok') => {
  const seen: { url: string; init: RequestInit }[] = [];
  return {
    seen,
    backend: {
      baseUrl: 'https://api.test',
      getToken: async () => token,
      fetch: (async (url: string, init: RequestInit) => {
        seen.push({ url, init });
        return reply();
      }) as unknown as typeof fetch,
    },
  };
};
const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

describe('call', () => {
  it('sends the session token and the body as JSON', async () => {
    const { backend: b, seen } = backend(json(200, { ok: 1 }));
    expect(await call(b, '/v1/generate', { topic: 'Space' })).toEqual({ ok: 1 });
    expect(seen[0].url).toBe('https://api.test/v1/generate');
    expect(seen[0].init).toMatchObject({ method: 'POST', headers: { authorization: 'Bearer tok', 'content-type': 'application/json' }, body: '{"topic":"Space"}' });
  });
  it("passes on the backend's plain-language message", async () => {
    const { backend: b } = backend(json(402, { error: 'You have no AI games left.' }));
    await expect(call(b, '/v1/generate', {})).rejects.toEqual(new AiError(402, 'You have no AI games left.'));
  });
  it('explains being offline and being signed out, without calling', async () => {
    const offline = backend(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(call(offline.backend, '/v1/balance')).rejects.toMatchObject({ status: 0, message: expect.stringContaining('online') });
    const signedOut = backend(json(200, {}), null);
    await expect(call(signedOut.backend, '/v1/balance')).rejects.toMatchObject({ status: 401 });
    expect(signedOut.seen).toHaveLength(0);
  });
});

it('describes a balance', () => {
  expect(describeBalance({ aiGames: 2, questionsLeft: 0, questionsPerAiGame: 50 })).toBe('2 AI games left');
  expect(describeBalance({ aiGames: 1, questionsLeft: 1, questionsPerAiGame: 50 })).toBe('1 AI game left (plus 1 question left in the current one)');
});
