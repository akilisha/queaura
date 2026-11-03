# QueAura

A LAN trivia game. The host runs the game from an Android app; players join from their phone's
browser by scanning a QR code; a TV can show the game to the room. Product decisions live in
[DESIGN_SPEC.md](DESIGN_SPEC.md).

| Folder | What |
|---|---|
| `app/` | Host app (Expo, React Native). `modules/game-server` wraps the server in an Android foreground service. |
| `server/` | Game server in plain Kotlin: engine, scoring, protocol, HTTP + WebSocket. Compiled into the app; unit-tested on a desktop JVM. |
| `web/` | Player and TV pages (Preact), served by the host device. |
| `backend/` | Cloud backend for AI questions and AI-game balances (Node, Express, Postgres). Gameplay never touches it. |
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

If the app on the phone shows "Host unreachable" or `NoRouteToHostException` at start, Metro
handed it a network address the phone cannot reach (on Windows often a virtual adapter's, from WSL,
Hyper-V, Docker or a VPN). Serve over the USB cable instead, then press `a` in the Metro window:

```bash
cd app && npx expo start --localhost
```

```bash
adb reverse tcp:8081 tcp:8081
```

`app/android/` is generated from `app/app.json` the first time and then reused. After a change to
`app.json` (the app's name, icon, ID or plugins), regenerate it, or the old values stay:

```bash
cd app && npx expo prebuild --platform android --clean
```

## AI questions (optional)

The app works without them. To turn them on in your build, copy `app/.env.example` to
`app/.env.local`, fill in the Clerk publishable key and the backend's address, then rebuild. The
backend is in `backend/` (see its README).

In the Clerk dashboard, sign-in must allow **email address** with **email verification code**,
for both sign-in and sign-up, and require nothing else (no password, no username). Google
sign-in also needs `EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID` (see `app/.env.example`) and Google
set up in Clerk.

## Build for Google Play

Play only accepts apps signed with your own **upload key**. Create it once and keep it (and its
passwords) safe and out of the repository; losing it means asking Google to reset it.

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore queaura-upload.jks -alias queaura-upload -keyalg RSA -keysize 2048 -validity 10000
```

Tell Gradle where it is in `~/.gradle/gradle.properties` (on Windows,
`C:\Users\<you>\.gradle\gradle.properties`), with forward slashes in the path:

```
QUEAURA_UPLOAD_STORE_FILE=D:/keys/queaura-upload.jks
QUEAURA_UPLOAD_STORE_PASSWORD=...
QUEAURA_UPLOAD_KEY_ALIAS=queaura-upload
QUEAURA_UPLOAD_KEY_PASSWORD=...
```

`app/plugins/withReleaseSigning.js` makes release builds use it (without those settings they stay
on the debug key). Raise `android.versionCode` in `app/app.json` for every upload, then build the
bundle Play wants:

```bash
cd web && npm run build
```

```bash
cd app && npx expo prebuild --platform android --clean
```

```bash
cd app/android && ./gradlew bundleRelease
```

The file to upload is `app/android/app/build/outputs/bundle/release/app-release.aab`. Purchases
only work in a build installed from Play (internal testing is enough), by a license tester.

## Installable test build (no laptop needed)

```bash
cd app && npx expo run:android --variant release --device
```

The APK lands in `app/android/app/build/outputs/apk/release/`. Running a usability test:
[docs/USABILITY_TEST.md](docs/USABILITY_TEST.md).

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
