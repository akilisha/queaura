import { computed, signal } from '@preact/signals';
import type { GameState } from '../../../protocol/src';

export type Mode = 'player' | 'tv';
export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'replaced';

function readMode(): Mode {
  return new URLSearchParams(location.search).get('mode') === 'tv' ? 'tv' : 'player';
}

/** The single client store. The transport writes it; views read it. */
export const mode = signal<Mode>(readMode());
export const connection = signal<ConnectionStatus>('connecting');

/** The latest state from the server, and when it arrived on this device's stopwatch. */
export const game = signal<GameState | null>(null);
export const receivedAt = signal(0);

/** Player seat. */
export const needsJoin = signal(false);
export const joining = signal(false);
export const playerId = signal<number | null>(null);
export const kicked = signal(false);
export const sessionEnded = signal(false);

/** The last message the server refused something with, shown briefly. */
export const notice = signal<string | null>(null);

export const you = computed(() => game.value?.you ?? null);
export const phase = computed(() => game.value?.phase ?? null);
