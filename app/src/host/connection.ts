import { useSyncExternalStore } from 'react';
import type { GameDefinition, GameState, HostCommand, ServerMessage } from '../../../protocol/src';

// The host app talks to its own server over the same WebSocket protocol as players, proving
// itself with the host key. This module is the only place that touches that socket.

export interface HostSnapshot {
  connected: boolean;
  state: GameState | null;
  /** When `state` arrived, on this device's stopwatch, for countdowns. */
  receivedAt: number;
  /** The last thing the server refused (for example "Round 2 has no questions"). */
  error: string | null;
}

let snapshot: HostSnapshot = { connected: false, state: null, receivedAt: 0, error: null };
const listeners = new Set<() => void>();
let socket: WebSocket | null = null;
let target: { wsPort: number; hostKey: string } | null = null;
let retry: ReturnType<typeof setTimeout> | undefined;

function update(patch: Partial<HostSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

/** Connects (or reconnects) to the server on this device. Safe to call repeatedly. */
export function connectHost(wsPort: number, hostKey: string): void {
  if (target?.hostKey === hostKey && socket) return;
  disconnectHost();
  target = { wsPort, hostKey };
  open();
}

function open() {
  if (!target) return;
  const ws = new WebSocket(`ws://127.0.0.1:${target.wsPort}`);
  socket = ws;
  ws.onopen = () => {
    ws.send(JSON.stringify({ t: 'hello', role: 'host', hostKey: target!.hostKey, hidden: false }));
    update({ connected: true });
  };
  ws.onmessage = (event) => {
    const msg = JSON.parse(String(event.data)) as ServerMessage;
    if (msg.t === 'state') update({ state: msg, receivedAt: performance.now() });
    if (msg.t === 'error') update({ error: msg.message });
  };
  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    update({ connected: false });
    // The server is on this device; if it is still meant to run, come straight back.
    if (target) retry = setTimeout(open, 500);
  };
}

export function disconnectHost(): void {
  clearTimeout(retry);
  target = null;
  const ws = socket;
  socket = null;
  ws?.close();
  snapshot = { connected: false, state: null, receivedAt: 0, error: null };
  listeners.forEach((l) => l());
}

export function sendHost(command: HostCommand): void {
  update({ error: null });
  socket?.send(JSON.stringify({ t: 'host', ...command }));
}

export const host = {
  start: (game: GameDefinition) => sendHost({ cmd: 'start', game }),
  pause: () => sendHost({ cmd: 'pause' }),
  resume: () => sendHost({ cmd: 'resume' }),
  skip: () => sendHost({ cmd: 'skip' }),
  stop: () => sendHost({ cmd: 'stop' }),
  kick: (playerId: number) => sendHost({ cmd: 'kick', playerId }),
  playAnother: () => sendHost({ cmd: 'playAnother' }),
  endSession: () => sendHost({ cmd: 'endSession' }),
};

export function useHost(): HostSnapshot {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
  );
}
