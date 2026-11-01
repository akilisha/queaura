import { useMemo, useSyncExternalStore } from 'react';
import GameServer from '../../modules/game-server/src/GameServerModule';
import { results } from '../data/db';
import { counts, parseJournal, type QuestionnaireResult } from './results';

// Questionnaire answers waiting on the host's save-or-discard choice, and the saved ones
// (spec §6.4). The server writes each answer to a file as it arrives; saving turns that file
// into a row here and removes the file, discarding just removes it.

let version = 0;
const listeners = new Set<() => void>();

function changed(): void {
  version++;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-renders when results are saved, discarded or deleted. */
export function useResultsVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

export interface Pending {
  file: string;
  /** Null when the file could not be read; it can only be discarded. */
  result: QuestionnaireResult | null;
}

/** Finished or interrupted questionnaires not yet saved or discarded, oldest first. */
export function pendingResults(): Pending[] {
  return GameServer.listQuestionnaires()
    .filter((f) => !f.active)
    .map((f) => ({ file: f.name, result: read(f.name) }));
}

/** [pendingResults], re-read whenever a choice is made (the files only change through those). */
export function usePendingResults(): Pending[] {
  const version = useResultsVersion();
  return useMemo(() => pendingResults(), [version]);
}

function read(file: string): QuestionnaireResult | null {
  try {
    return parseJournal(file.replace(/\.jsonl$/, ''), GameServer.readQuestionnaire(file));
  } catch {
    return null;
  }
}

export function savePending(p: Pending): void {
  if (p.result) results.save(p.result);
  GameServer.deleteQuestionnaire(p.file);
  changed();
}

export function discardPending(p: Pending): void {
  GameServer.deleteQuestionnaire(p.file);
  changed();
}

export function deleteResult(id: string): void {
  results.remove(id);
  changed();
}

/** "3 people answered, 2 finished." */
export function summary(r: QuestionnaireResult): string {
  const { players, complete } = counts(r);
  if (players === 0) return 'Nobody answered.';
  return `${players} ${players === 1 ? 'person' : 'people'} answered, ${complete} answered every question.`;
}
