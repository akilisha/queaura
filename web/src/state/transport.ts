import type { ClientMessage, ServerMessage } from '../../../protocol/src';
import * as store from './store';
import { loadToken, saveToken } from './storage';

// The only module that touches the WebSocket.

const BACKOFF_MS = [250, 500, 1000, 2000];
const PING_EVERY_MS = 2000;
/** Pongs arrive every 2 s, so this much silence means the connection is dead. */
const SILENCE_LIMIT_MS = 6000;
const NOTICE_MS = 4000;
const CLOSE_REPLACED = 4000;
const CLOSE_KICKED = 4001;

let socket: WebSocket | null = null;
let wsUrl: string | null = null;
let attempts = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let lastMessageAt = 0;

export function start(): void {
  connect();
  setInterval(watchdog, 1000);
  setInterval(() => send({ t: 'ping', c: performance.now() }), PING_EVERY_MS);
  window.addEventListener('online', reconnectNow);
  document.addEventListener('visibilitychange', () => {
    const hidden = document.visibilityState === 'hidden';
    // Tell the server first: on screen lock the page freezes right after this event.
    send({ t: 'visibility', hidden });
    if (!hidden) reconnectNow();
  });
  // Close cleanly on refresh or tab close, so the server can tell these apart from real drops.
  window.addEventListener('pagehide', () => socket?.close(1000, 'pagehide'));
}

export function send(message: ClientMessage): void {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

async function resolveUrl(): Promise<string> {
  if (wsUrl) return wsUrl;
  const response = await fetch('/config.json', { cache: 'no-store' });
  const config: { wsPort: number } = await response.json();
  wsUrl = `ws://${location.hostname}:${config.wsPort}`;
  return wsUrl;
}

async function connect(): Promise<void> {
  clearTimeout(retryTimer);
  let url: string;
  try {
    url = await resolveUrl();
  } catch {
    lost();
    return;
  }
  const ws = new WebSocket(url);
  socket = ws;
  ws.onopen = () => {
    lastMessageAt = performance.now();
    attempts = 0;
    send({
      t: 'hello',
      role: store.mode.value,
      token: store.mode.value === 'player' ? loadToken() : null,
      hidden: document.visibilityState === 'hidden',
    });
  };
  ws.onmessage = (event) => {
    lastMessageAt = performance.now();
    handle(JSON.parse(event.data as string) as ServerMessage);
  };
  ws.onclose = (event) => {
    if (socket !== ws) return;
    socket = null;
    if (event.code === CLOSE_REPLACED) {
      store.connection.value = 'replaced';
      return;
    }
    if (event.code === CLOSE_KICKED) {
      store.kicked.value = true;
      return;
    }
    lost();
  };
}

/** Forgets the current socket so nothing it does later reaches the store. */
function detach(): void {
  const ws = socket;
  socket = null;
  if (!ws) return;
  ws.onopen = ws.onmessage = ws.onclose = null;
  try {
    ws.close();
  } catch {
    // Already closing.
  }
}

function lost(): void {
  detach();
  if (store.kicked.value) return;
  store.connection.value = 'reconnecting';
  const delay = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
  attempts++;
  clearTimeout(retryTimer);
  retryTimer = setTimeout(connect, delay);
}

function reconnectNow(): void {
  if (store.connection.value === 'replaced' || store.kicked.value) return;
  const silent = performance.now() - lastMessageAt > SILENCE_LIMIT_MS / 2;
  if (socket && socket.readyState === WebSocket.OPEN && !silent) return;
  if (socket && socket.readyState === WebSocket.CONNECTING) return;
  detach();
  attempts = 0;
  connect();
}

function watchdog(): void {
  if (socket && socket.readyState === WebSocket.OPEN && performance.now() - lastMessageAt > SILENCE_LIMIT_MS) lost();
}

function showNotice(message: string): void {
  store.notice.value = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => (store.notice.value = null), NOTICE_MS);
}

function handle(message: ServerMessage): void {
  switch (message.t) {
    case 'welcome':
      store.connection.value = 'open';
      if (message.role === 'player') {
        saveToken(message.token);
        store.playerId.value = message.playerId;
        store.needsJoin.value = false;
        store.joining.value = false;
      }
      return;
    case 'needJoin':
      store.connection.value = 'open';
      store.playerId.value = null;
      store.needsJoin.value = true;
      return;
    case 'kicked':
      store.kicked.value = true;
      return;
    case 'ended':
      store.connection.value = 'open';
      store.sessionEnded.value = true;
      return;
    case 'error':
      store.joining.value = false;
      showNotice(message.message);
      return;
    case 'state':
      store.receivedAt.value = performance.now();
      store.game.value = message;
      return;
    case 'cue':
    case 'pong':
      // Cues are for sound later (spec §10); pongs only keep the watchdog fed.
      return;
  }
}
