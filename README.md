# Triviocity

A LAN trivia game. The host runs the game from an Android app; players join from their phone's
browser by scanning a QR code; a TV can show the game to the room. Product decisions live in
[DESIGN_SPEC.md](DESIGN_SPEC.md).

| Folder | What |
|---|---|
| `app/` | Host app (Expo, React Native). `modules/game-server` wraps the server in an Android foreground service. |
| `server/` | Game server in plain Kotlin: engine, scoring, protocol, HTTP + WebSocket. Compiled into the app; unit-tested on a desktop JVM. |
| `web/` | Player and TV pages (Preact), served by the host device. |
| `protocol/` | TypeScript types for the messages between them. |
| `tools/` | `simulate.ts`: bot players and a scripted host for testing. |
| `spike/` | Phase 0 spike (throwaway) and its results. |

## Build and run on the phone

Needs Node 22+, JDK 17+, the Android SDK, and the phone connected over USB with USB debugging on.

The web client is built into the app, so build it first (and again whenever it changes):

```bash
cd web && npm install && npm run build
```

Then the app:

```bash
cd app && npm install && npx expo run:android --device
```

Choose the phone (not an emulator) at the prompt. If Expo can't reach its servers, set
`EXPO_OFFLINE=1`.

## Tests

```bash
cd server && gradle test
```

```bash
cd web && npm test
```

```bash
cd app && npm test
```

## Run the server on a computer (no phone)

```bash
cd web && npm run build
```

```bash
cd server && gradle devServer
```

Open `http://localhost:8080` as a player or `http://localhost:8080/?mode=tv` as the TV. The
server prints a host key; play a starter game with bots:

```bash
cd tools && npm install && node simulate.ts 127.0.0.1 8 <host-key>
```
