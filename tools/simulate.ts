// Simulated room for development and load tests. Joins bot players and, given the host key,
// acts as the host: starts a starter game and lets it play out.
//
//   node simulate.ts <host-ip> [bots=8] [hostKey] [gameId=s-game-warmup] [httpPort=8080]
//
// Without a host key the bots just join and answer whatever the real host runs.
// The desktop dev server (cd server && gradle devServer) prints its host key.

import { readFileSync } from 'node:fs';
import WebSocket from 'ws';
import { resolveGame } from '../app/src/game/resolve.ts';

const [host = '127.0.0.1', botsArg = '8', hostKey, gameId = 's-game-warmup', httpPort = '8080'] = process.argv.slice(2);
const config = (await (await fetch(`http://${host}:${httpPort}/config.json`)).json()) as { wsPort: number };
const url = `ws://${host}:${config.wsPort}`;

type Msg = Record<string, any>;

function bot(index: number) {
  let lastSeq = -1;
  const ws = new WebSocket(url);
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', role: 'player', hidden: false })));
  ws.on('message', (data) => {
    const msg: Msg = JSON.parse(String(data));
    if (msg.t === 'needJoin') ws.send(JSON.stringify({ t: 'join', name: `Bot ${index + 1}`, emoji: '🤖' }));
    if (msg.t === 'state' && msg.phase === 'question' && msg.you?.canAnswer && msg.question.seq !== lastSeq) {
      lastSeq = msg.question.seq;
      const q = msg.question;
      // Answer somewhere in the first half of the window, like a person would.
      setTimeout(() => {
        const answer = q.answerType === 'multipleChoice'
          ? { choice: q.choices[Math.floor(Math.random() * q.choices.length)].id }
          : { number: Math.round(Math.random() * 2000) };
        ws.send(JSON.stringify({ t: 'answer', seq: q.seq, ...answer }));
      }, Math.random() * (q.readingMs + q.answerMs / 2));
    }
  });
  setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: 'ping', c: performance.now() })), 2000);
  return ws;
}

for (let i = 0; i < Number(botsArg); i++) bot(i);

if (hostKey) {
  const starter = JSON.parse(readFileSync(new URL('../app/src/starter/starter.json', import.meta.url), 'utf8'));
  const bank = new Map(starter.questions.map((q: Msg) => [q.id, { ...q, source: 'manual' }]));
  const format = starter.games.find((g: Msg) => g.id === gameId);
  const game = resolveGame({ ...format, rounds: format.rounds.map((r: Msg) => ({ style: r.style, slots: r.questionIds })) }, bank as any);
  const ws = new WebSocket(url);
  let lastPhase = '';
  ws.on('open', () => {
    ws.send(JSON.stringify({ t: 'hello', role: 'host', hostKey, hidden: false }));
    setTimeout(() => ws.send(JSON.stringify({ t: 'host', cmd: 'start', game })), 1500);
  });
  ws.on('message', (data) => {
    const msg: Msg = JSON.parse(String(data));
    if (msg.t === 'error') console.log('server refused:', msg.message);
    if (msg.t !== 'state' || msg.phase === lastPhase) return;
    lastPhase = msg.phase;
    const where = msg.question ? ` r${msg.round.number} q${msg.question.number}` : '';
    const leader = msg.scores[0] ? ` leader ${msg.scores[0].name} ${msg.scores[0].total}` : '';
    console.log(`${new Date().toISOString().slice(11, 19)} ${msg.phase}${where}${leader}`);
    if (msg.phase === 'finalScores') setTimeout(() => process.exit(0), 1000);
  });
}
