import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WordFilter } from '../src/moderation/wordFilter.ts';

const server = new URL('../../server/src/main/resources/moderation/', import.meta.url);
const cases = JSON.parse(readFileSync(new URL('../../server/src/test/resources/moderation-cases.json', import.meta.url), 'utf8'));
const filter = WordFilter.load();

describe('word filter (same cases as the server)', () => {
  it('carries the same lists as the server', () => {
    for (const name of ['en.txt', 'exclusions.txt', 'roots.txt']) {
      const ours = readFileSync(new URL(`../moderation/${name}`, import.meta.url), 'utf8');
      expect(ours, `backend/moderation/${name} differs from the server's copy`).toBe(readFileSync(new URL(name, server), 'utf8'));
    }
  });
  it('catches words, phrases and the usual disguises', () => {
    for (const text of cases.blocked) expect(filter.find(text), text).not.toBeNull();
    for (const [text, word] of Object.entries(cases.found)) expect(filter.find(text)).toBe(word);
  });
  it('passes ordinary trivia', () => {
    for (const text of cases.clean) expect(filter.find(text), text).toBeNull();
  });
});
