import type { AnswerType, AnswerValue, Choice } from '../../../protocol/src';

// A questionnaire's answers (spec §6.4): read from the file the server writes as answers arrive,
// kept on this phone once saved, and exported as CSV. Pure, so tests cover it.

export interface ResultQuestion {
  id: string;
  text: string;
  answerType: AnswerType;
  choices: Choice[];
}

export interface ResultPlayer {
  id: number;
  name: string;
  emoji: string;
}

export interface QuestionnaireResult {
  id: string;
  gameId: string;
  title: string;
  startedAt: number;
  /** When the host ended it; null if the app stopped first and this was recovered. */
  endedAt: number | null;
  questions: ResultQuestion[];
  /** In the order they first answered. */
  players: ResultPlayer[];
  /** responses[playerId][questionId], the latest answer for each (spec §4). */
  responses: Record<number, Record<string, AnswerValue>>;
}

/**
 * Reads a questionnaire file: a start line, answer lines, and an end line if the host ended it.
 * A line cut short by a crash is skipped. Returns null when there is no start line to go on.
 */
export function parseJournal(id: string, text: string): QuestionnaireResult | null {
  let result: QuestionnaireResult | null = null;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.kind === 'start') {
      result = {
        id,
        gameId: String(entry.gameId),
        title: String(entry.title),
        startedAt: Number(entry.startedAt),
        endedAt: null,
        questions: (entry.questions ?? []).map((q: any) => ({ id: q.id, text: q.text, answerType: q.answerType, choices: q.choices ?? [] })),
        players: [],
        responses: {},
      };
    } else if (result && entry.kind === 'answer') {
      const playerId = Number(entry.playerId);
      const player = result.players.find((p) => p.id === playerId);
      if (player) Object.assign(player, { name: entry.name, emoji: entry.emoji });
      else result.players.push({ id: playerId, name: String(entry.name), emoji: String(entry.emoji) });
      (result.responses[playerId] ??= {})[entry.questionId] = entry.value;
    } else if (result && entry.kind === 'end') {
      result.endedAt = Number(entry.at);
    }
  }
  return result;
}

/** How many players answered at least one question, and how many answered them all. */
export function counts(r: QuestionnaireResult): { players: number; complete: number } {
  const complete = r.players.filter((p) => r.questions.every((q) => r.responses[p.id]?.[q.id] !== undefined)).length;
  return { players: r.players.length, complete };
}

/** An answer as a person reads it: the number, the chosen answer's words, or what they typed. */
export function answerText(q: ResultQuestion, value: AnswerValue | undefined): string {
  if (!value) return '';
  if ('number' in value) return String(value.number);
  if ('choice' in value) return q.choices.find((c) => c.id === value.choice)?.text ?? value.choice;
  return value.text;
}

/**
 * One row per player, one column per question (RFC 4180, with a byte-order mark so spreadsheet
 * apps read emoji and accents correctly). Text a player typed that a spreadsheet would run as a
 * formula (starting with = + - or @) gets a leading apostrophe, so opening the file is safe.
 */
export function toCsv(r: QuestionnaireResult): string {
  const header = ['Player', ...r.questions.map((q) => q.text)];
  const rows = r.players.map((p) => [
    safeText(p.name),
    ...r.questions.map((q) => {
      const value = r.responses[p.id]?.[q.id];
      return value && 'number' in value ? String(value.number) : safeText(answerText(q, value));
    }),
  ]);
  return '﻿' + [header.map(safeText), ...rows].map((row) => row.map(field).join(',')).join('\r\n') + '\r\n';
}

/** "Team feedback 2026-11-01.csv": only characters every share target accepts in a file name. */
export function csvName(r: QuestionnaireResult): string {
  const date = new Date(r.startedAt);
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const title = r.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ._-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Questionnaire';
  return `${title} ${day}.csv`;
}

function safeText(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function field(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
