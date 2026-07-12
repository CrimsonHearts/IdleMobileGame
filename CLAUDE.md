# CLAUDE.md

Project-specific notes for Claude Code sessions working in this repo. Read
this before attempting anything build-related — it saves re-discovering the
same environment limits from scratch every time.

## ⚠️ The Android APK CANNOT be built in a Claude Code remote/sandboxed session

**Don't attempt it, don't re-diagnose it — tell the user to build locally.**

Confirmed (2026-07-11) in a Claude Code web/remote environment:

- No Android SDK is pre-installed (no `ANDROID_HOME`, no `sdkmanager`).
- The environment's outbound network policy blocks `dl.google.com` and its
  alias `maven.google.com` (`403` on `CONNECT`) — this is where the Android
  Gradle Plugin, AndroidX, and all Google Maven artifacts live. Without it,
  Gradle can't resolve the build classpath even if the SDK were present.
- The Gradle **wrapper**'s own distribution download also fails (403) — it
  fetches from a GitHub release asset URL, which this proxy blocks too. The
  system-installed `gradle` binary (`/opt/gradle`, matches the wrapper's
  pinned version) can be used directly to route around *that specific*
  failure, but it doesn't matter — the classpath resolution against Google's
  Maven repo fails regardless, and that's the hard blocker.
- `npx cap add android` (scaffolding the native project) **does** work fine —
  it's pure file templating, no SDK/network needed for the Google-hosted
  bits. Confirmed to complete successfully. It's the compile step
  (`./gradlew assembleDebug`/`assembleRelease`) that's impossible here.
- `android/` and `ios/` are gitignored in this repo by design (see
  `.gitignore`) — they're meant to be generated locally by each dev via
  `npm run cap:add:android`, never committed. So there's nothing to commit
  even from the scaffolding step above.

**What to tell the user:** they need to build on their own machine (or any
environment with real internet access + the Android SDK). The exact commands
are already documented:

- `README.md` → "📱 Turning this into Android & iOS apps (Capacitor)" for
  the general Capacitor workflow (`cap:add:android`, `cap:sync`,
  `open:android`).
- `tools/build-apk.sh` → the correct way to produce a **sideload-able signed
  `.apk`**. Written for macOS (`/opt/homebrew` JAVA_HOME, `~/Library/Android/sdk`
  ANDROID_HOME) — adjust those two exports for Linux/Windows. It exists
  specifically because `npx cap build android --keystore...` only signs with
  the legacy v1 scheme, which modern Android (targetSdk ≥ 30) refuses to
  install — this script does zipalign + apksigner v2/v3 correctly.
- `docs/STORE-CHECKLIST.md` → full Play Store submission checklist,
  including the keystore setup, if the user wants a signed `.aab` for
  Play Console upload instead of/alongside a sideload APK.
- `npm run release:android` → produces an **AAB** (Play Store upload
  bundle), not an APK. Don't confuse the two if the user specifically asks
  for "an APK" — that means `assembleDebug` (quick, unsigned, installable
  as-is for testing) or the signed flow in `tools/build-apk.sh`
  (`assembleRelease` + zipalign + apksigner).

If a future environment turns out to have Android SDK + unblocked Google
Maven access, this whole section is moot — just verify with
`curl -I https://dl.google.com` before assuming the block still applies.

## Regression testing

This project uses hand-rolled Node smoke tests, not a test framework —
`smoke5.js` through `smoke17.js` in the repo root (numbered by the feature
round that introduced them; earlier `smoke1–4` were superseded/folded in).
Each `eval()`s the relevant `www/js/*.js` source directly with minimal stubs.

Run them all before considering any change done:

```bash
for t in smoke5 smoke6 smoke7 smoke8 smoke9 smoke10 smoke11 smoke12 smoke13 smoke14 smoke15 smoke16 smoke17; do
  node $t.js || echo "FAILED: $t"
done
```

`smoke12.js` is the odd one out — a full-game integration suite that loads
**every** `www/js` module together (in `index.html`'s real load order) and
drives the real, wired-together engine end-to-end (boot, economy, combat,
quests, save round-trip, migration, offline catch-up, corrupt-save
resilience), rather than stubbing sibling modules. Prefer adding
cross-module regression coverage there; add narrowly-scoped module tests to
a new `smokeN.js` (or the relevant existing one) for single-module logic.

Also run `node --check www/js/*.js` — this repo has shipped at least one
regression where corrupted string-quote characters silently broke a file's
syntax without any smoke test catching it (nothing evals every file).

## Reproducing a live-gameplay bug report

The smoke suites stub every sibling module, so they can't catch a bug that
only shows up when the REAL boot sequence runs in a REAL browser (DOM,
localStorage, confirm() dialogs, etc.). When a user reports something like
"X keeps happening" or "Y purchase doesn't work," don't just read code and
guess — reproduce it empirically:

```bash
node tools/static-server.mjs &          # serves the game at :8080
```

Playwright isn't a project dependency (don't add it to package.json for a
one-off repro) — install it into the scratchpad dir instead:
`npm install playwright --prefix <scratchpad>`. The pre-installed Chromium
at `/opt/pw-browsers/chromium-<N>/chrome-linux/chrome` is usually a
DIFFERENT build number than whatever `playwright`'s own npm version expects
by default (`chromium.launch()` looks for a `chromium_headless_shell-<M>`
that isn't there) — pass `executablePath` explicitly pointing at the
`chrome` binary under whichever `/opt/pw-browsers/chromium-*` dir actually
exists (`ls /opt/pw-browsers`), rather than trying to get Playwright to
auto-detect it.

Drive the page with `page.evaluate()` to call real game functions
(`Game.buyGenerator(...)`, `Monetization.showRewardedAd(...)`, etc.) and
inspect real state — this catches classes of bug the stubbed smoke tests
structurally cannot: exceptions thrown by the real boot try/catch chain in
main.js, localStorage persistence gaps, and anything gated on
`window.Capacitor`/`confirm()`/DOM APIs the Node harness doesn't have. Two
real bugs were caught exactly this way and would NOT have been caught by
the existing smoke suites: a save-shape edge case that silently wiped the
player's save on every boot, and a rewarded-ad prompt that kept showing
after the "Remove Ads" purchase.
