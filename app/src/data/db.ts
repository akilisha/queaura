import { openDatabaseSync } from 'expo-sqlite';
import { STARTER_VERSION, starterBank, starterGames } from '../starter/starter';
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
  `);
  seedStarter();
}

/** Adds or refreshes the built-in questions and games when the app ships new starter content. */
function seedStarter(): void {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', 'starterVersion');
  if (row && Number(row.value) >= STARTER_VERSION) return;
  db.withTransactionSync(() => {
    for (const q of starterBank()) put('questions', q.id, q);
    for (const g of starterGames()) put('games', g.id, g);
    db.runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', 'starterVersion', String(STARTER_VERSION));
  });
}

function put(table: 'questions' | 'games', id: string, value: object): void {
  db.runSync(`INSERT OR REPLACE INTO ${table} (id, json, updated) VALUES (?, ?, ?)`, id, JSON.stringify(value), Date.now());
}

function all<T>(table: 'questions' | 'games'): T[] {
  return db.getAllSync<{ json: string }>(`SELECT json FROM ${table} ORDER BY updated DESC`).map((r) => JSON.parse(r.json) as T);
}

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
