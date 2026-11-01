import { openDatabaseSync } from 'expo-sqlite';
import { STARTER_VERSION, starterBank, starterGames } from '../starter/starter';
import type { QuestionnaireResult } from '../results/results';
import type { BankQuestion, GameFormat } from './types';

// The question bank and game formats live on this device only (spec §4). Rows hold JSON; the
// data is small and always read whole.

const db = openDatabaseSync('queaura.db');

export function initDatabase(): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, json TEXT NOT NULL, updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, json TEXT NOT NULL, updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS results (id TEXT PRIMARY KEY, json TEXT NOT NULL, updated INTEGER NOT NULL);
  `);
  seedStarter();
}

/**
 * Adds the starter content this device hasn't seen yet. Items already added are never rewritten
 * or brought back, so a host's edits and deletions of built-ins stick.
 */
function seedStarter(): void {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', 'starterVersion');
  const seen = row ? Number(row.value) : 0;
  if (seen >= STARTER_VERSION) return;
  db.withTransactionSync(() => {
    for (const q of starterBank(seen)) put('questions', q.id, q);
    for (const g of starterGames(seen)) put('games', g.id, g);
    db.runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', 'starterVersion', String(STARTER_VERSION));
  });
}

type Table = 'questions' | 'games' | 'results';

function put(table: Table, id: string, value: object): void {
  db.runSync(`INSERT OR REPLACE INTO ${table} (id, json, updated) VALUES (?, ?, ?)`, id, JSON.stringify(value), Date.now());
}

function all<T>(table: Table): T[] {
  return db.getAllSync<{ json: string }>(`SELECT json FROM ${table} ORDER BY updated DESC`).map((r) => JSON.parse(r.json) as T);
}

/** Small app settings and one-time flags. */
export const meta = {
  get: (key: string): string | null => db.getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key)?.value ?? null,
  set: (key: string, value: string) => db.runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value),
};

export const questions = {
  all: () => all<BankQuestion>('questions'),
  save: (q: BankQuestion) => put('questions', q.id, q),
  remove: (id: string) => db.runSync('DELETE FROM questions WHERE id = ?', id),
};

export const games = {
  all: () => all<GameFormat>('games'),
  save: (g: GameFormat) => put('games', g.id, g),
  remove: (id: string) => db.runSync('DELETE FROM games WHERE id = ?', id),
};

/** Saved questionnaire answers (spec §6.4), newest first. */
export const results = {
  all: () => all<QuestionnaireResult>('results'),
  save: (r: QuestionnaireResult) => put('results', r.id, r),
  remove: (id: string) => db.runSync('DELETE FROM results WHERE id = ?', id),
};
