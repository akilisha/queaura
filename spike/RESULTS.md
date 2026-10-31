# Phase 0 results

Fill in during testing (see README.md for the script). Attach `log.jsonl` and `stats.json` from
each soak run next to this file.

## Devices

| Role | Device | OS / browser version |
|---|---|---|
| Host | Samsung Galaxy S21 | |
| TV | Samsung TV (2025) | |
| Players | | |

## Browser diagnostics (`?mode=diag`)

| Browser | Chromium version | Wake Lock over HTTP | Other notes |
|---|---|---|---|
| Desktop Chrome (Windows), used as the TV display | 155 | no | Secure context no; crypto.randomUUID, Clipboard API, service worker unavailable; WebSocket, localStorage, CSS custom properties and grid available |
| Samsung TV 2025 (Tizen 10, Samsung Browser 9.0) | 130.0.6723.116 | no | Viewport 1536 × 749 @1.25x. Secure context no; crypto.randomUUID, Clipboard API, service worker unavailable; WebSocket, localStorage, CSS custom properties and grid available |
| Android Chrome | | | |
| Samsung Internet | | | |
| iOS Safari | | | |

## Results per network

| Measurement | Home Wi-Fi | Phone hotspot | LocalOnlyHotspot |
|---|---|---|---|
| Join time, stopwatch (median) | Under 15 s (owner's observation, scan to Tap button) | | |
| Join time, page (`joinMs` median) | 9.2 s (one join): page ready to type at 1.3 s, 7.9 s typing, 48 ms submit to seat | | |
| Round trip (`rttMs` median / p95) | 13 ms / 73 ms | | |
| Reconnect: refresh | | | |
| Reconnect: tab reopened | | | |
| Reconnect: Wi-Fi off 5 s | | | |
| Reconnect: airplane mode blip | | | |
| Soak duration, players (real + simulated) | 54 min, 1 real player (Jo, S25) + desktop Chrome as TV, no simulated players | | |
| Reconnect after screen sleep + unlock | 2.8 s after ~54 min asleep, same seat (about 2.2 s of it before the phone's connection reached the server) | | |
| Soak `unexpectedCloses` (network drops) | 2, both the desktop browser (TV and diag tabs), within 45 s of it waking from a 39 min sleep; server heartbeat got no reply for ~22 s. Not Jo, not the server | | |
| Soak `sleepCloses` (screen-sleep drops) | 2: Jo once, the desktop TV tab once (hidden 13 min). Jo's second sleep came after the stats snapshot and was also a clean sleep drop | | |
| Soak `tickLateMs` max | 2.2 ms over 3,233 ticks | | |
| Joined through the network | Yes | Not tested | Yes (Wi-Fi QR, then game QR) |
| TV worked | Yes, desktop Chrome and Samsung TV. The TV view needed scrolling at 749 px tall; fixed so it fits, confirmed on the Samsung TV (see findings) | | |

## Findings to carry into Phase 1

- **Latency spikes with the host screen off.** Round trips are mostly 6–50 ms but spike to
  250–1,270 ms roughly every 40 s. Likely the host phone's Wi-Fi power saving: Android only
  honors the low-latency Wi-Fi lock while the app is in the foreground with the screen on.
  Server-receive timing (§6.2) makes such a spike count against a player in fastest finger and
  time-weighted scoring. Needs a decision before fastest finger (Phase 2).
- **Waking a phone takes ~2 s before its connection reaches the server.** The seat comes back
  automatically, but the player sees "Reconnecting" for that long.
- **TV view must fit the screen.** At the Samsung's 749 CSS px height the original single
  column pushed the player list below the fold. Now: counter and join address beside a
  multi-column player list, type sized from the viewport height, page never scrolls (spec §7.3).
  Checked at 1536 × 749, 1920 × 945 and 1280 × 720 with 30 players. Past ~30 players the list
  is clipped at 749 px; Phase 1 needs a design for large rooms (for example top N plus a count).
- **Measurement quirks (spike only):** a browser tab left open from an earlier server run
  reported its old 8-hour outage as a reconnect (157 s resume), and a tab that never reported
  "hidden" (the desktop asleep) reports the whole outage as its resume time (39 min).

## Keeping player screens on (plain HTTP, so no Wake Lock API)

| Phone / browser | Variant | Screen stayed on by itself? |
|---|---|---|
| Galaxy S25 / Chrome | `tiny` (2 px, near-invisible, muted) | **No**: turned off at the normal timeout |
| Galaxy S25 / Chrome | `disc` (visible 4rem spinning disc, muted) | **No**: turned off at the normal timeout |

Conclusion: on Chrome for Android, a muted video, visible or not, does not keep the screen on.
Over plain HTTP the game cannot keep a Chrome player's screen awake. Decision (spec §3.4): plain
HTTP, screens may sleep, players are never penalized for it. The keep-awake code was removed
from the spike.

## Baseline (desktop JVM, before device testing)

The server core was run on a desktop JVM in the development container against 40 simulated
players for 2 minutes: 0 drops, round trip median 1 ms (p95 2 ms), tick lateness max 1.1 ms,
and a browser refresh resumed the seat in under 100 ms. This only proves the code works; the
device runs above are what count.

## Decisions (update DESIGN_SPEC.md in the same change)

- §3.3 hotspot fallback: **decided, LocalOnlyHotspot** (spec updated). A player joined through it
  on the S21; the regular hotspot was not tested.
- §3.4 HTTP vs HTTPS: **decided, plain HTTP** (spec updated). Muted video cannot keep Chrome
  Android screens on, Path A is rejected, screen sleep is accepted with no penalty to the player.
- §12.3 server implementation: **native Kotlin module confirmed**; no instability seen, so no
  embedded Node.js (spec updated).
- Scale soak (10 phones, 30 min): **waived by the owner** (spec §11 updated).
- Vite legacy target (§2.2): **decided**, keep the Chromium 56 legacy bundle; no minimum TV model
  year (spec updated). The 2025 Samsung TV (Chromium 130) gets the modern bundle.
