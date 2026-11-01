# Usability test results

## Phase 1 test

Run by the owner with first-time testers on the Phase 1 build (spec §1 protocol).

**Overall:** testers found it intuitive to operate without a manual, and a pleasant experience.

| Finding | Severity | What we did |
|---|---|---|
| After the host stopped a game, players' phones stayed on the final scores until the host also pressed "End session". It wasn't obvious why they were still "in". | Low: confusing, not blocking | Cause: the "Play another?" window (spec §5.6) keeps players connected for 60 s so the host can start another game without everyone rescanning; players only saw "Waiting for the host…". Their final screen and the TV now show "Another game, or lights out, in 47" with a live countdown, and "Stay for another round with the same players, or you're free to go." The window and its length are unchanged. |

Timings against the benchmarks (host about 2 minutes to a running game with players joined;
player under 15 seconds from scan to answering) were not recorded for this run. Record them in the
next run with the table in [USABILITY_TEST.md](USABILITY_TEST.md).
