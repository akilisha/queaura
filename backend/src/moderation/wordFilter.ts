import { readFileSync } from 'node:fs';

// The on-device word list tier (spec §9), ported from the server's Kotlin WordFilter so the
// backend checks AI output and topics the same way. Both read the same lists and pass the same
// cases (server/src/test/resources/moderation-cases.json). Keep the two in step.

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's' };

export class WordFilter {
  private readonly words = new Set<string>();
  private readonly phrases: string[][] = [];
  /** Entries with no letters or digits, like an emoji, matched anywhere in the text. */
  private readonly symbols: string[] = [];
  private readonly roots: string[];

  constructor(blocked: string[], excluded: string[], roots: string[]) {
    const skip = new Set(excluded.map((e) => e.toLowerCase()));
    this.roots = roots;
    for (const raw of blocked) {
      const entry = raw.trim().toLowerCase();
      if (!entry || skip.has(entry)) continue;
      const t = tokens(entry);
      if (t.length === 0) this.symbols.push(entry);
      else if (t.length === 1) this.words.add(t[0]);
      else this.phrases.push(t);
    }
  }

  /** The first blocked word or phrase in [text], or null if it is clean. */
  find(text: string): string | null {
    for (const s of this.symbols) if (text.includes(s)) return s;
    const toks = tokens(text).map(variants);
    for (const vs of toks) {
      for (const v of vs) if (this.words.has(v)) return v;
      for (const v of vs) for (const r of this.roots) if (v.includes(r)) return r;
    }
    for (const phrase of this.phrases) {
      for (let start = 0; start + phrase.length <= toks.length; start++) {
        if (phrase.every((p, i) => toks[start + i].has(p))) return phrase.join(' ');
      }
    }
    return null;
  }

  /** The shipped list with our exclusions (moderation/, see its README). */
  static load(dir = new URL('../../moderation/', import.meta.url)): WordFilter {
    const lines = (name: string) =>
      readFileSync(new URL(name, dir), 'utf8')
        .split('\n')
        .map((l) => l.split('#')[0].trim())
        .filter(Boolean);
    return new WordFilter(lines('en.txt'), lines('exclusions.txt'), lines('roots.txt'));
  }
}

/** Lowercase words without accents; letters typed one at a time ("f u c k") are joined back. */
export function tokens(text: string): string[] {
  const plain = text.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase();
  const raw = plain.match(/[\p{L}\p{N}@$]+/gu) ?? [];
  const out: string[] = [];
  let letters = '';
  for (const t of raw) {
    if ([...t].length === 1 && /\p{L}/u.test(t)) {
      letters += t;
      continue;
    }
    if (letters) {
      out.push(letters);
      letters = '';
    }
    out.push(t);
  }
  if (letters) out.push(letters);
  return out;
}

/** The word as typed, with digits read as letters, and with stretched letters shortened. */
function variants(token: string): Set<string> {
  const base = [token];
  if (/\p{L}/u.test(token) && [...token].some((c) => c in LEET)) base.push([...token].map((c) => LEET[c] ?? c).join(''));
  const out = new Set<string>();
  for (const b of base) {
    out.add(b);
    out.add(b.replace(/(.)\1{2,}/gu, '$1'));
    out.add(b.replace(/(.)\1{2,}/gu, '$1$1'));
  }
  return out;
}
