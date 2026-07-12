/* ===========================================================================
 * time.js — Trusted time + anti-cheat for offline progression.
 *
 * Defends against the classic idle-game exploit of changing the device clock:
 *   1. Trusted online time  — when online, read the server's Date header
 *      instead of trusting the device clock.
 *   2. Monotonic session clock — performance.now() can't be moved by the user,
 *      used for the live game loop so mid-session tampering does nothing.
 *   3. Backward-jump detection — handled in game.js: if wall-clock < lastSaved,
 *      we grant ZERO offline Qi (you can't go back in time honestly).
 *   4. Offline cap — also in game.js: earnings capped at GameData.offline.
 *
 * CAVEAT on (1): sync() below HEADs `window.location.href` — the app's own
 * origin. On the web that's a real remote server with its own clock. On the
 * packaged Capacitor/Android build (this game's actual distribution target)
 * that origin is the local in-app webview server, so a successful sync can
 * just echo the device's own clock back — it is NOT proof of an independent,
 * unmanipulable time source there. isSynced() must never be treated as an
 * unforgeable signal in anti-cheat logic (it's also a plain, unencapsulated
 * property — trivially overridable from devtools or a patched build). If
 * this ever points at a real backend (see the comment on sync() below),
 * that caveat goes away and isSynced() becomes meaningful again.
 * ========================================================================= */

const TimeService = {
  _serverOffset: 0,        // (trustedNow - Date.now()) in ms, if we synced
  _synced: false,

  /** Monotonic clock in ms since page load — immune to clock changes. */
  monotonicNow() {
    return (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();
  },

  /**
   * Best estimate of true wall-clock time (ms epoch).
   * Uses the synced server offset if we have one, else the device clock.
   */
  now() {
    return Date.now() + this._serverOffset;
  },

  isSynced() { return this._synced; },

  /**
   * Try to sync with a trusted server clock. Best-effort: if offline or the
   * request fails, we silently fall back to the device clock (the cap +
   * backward-jump checks still protect us).
   *
   * Uses a HEAD request to the app's own origin and reads the `Date` header.
   * When packaged with Capacitor you can point this at your own backend or a
   * time API for an authoritative source.
   */
  async sync(timeout = 4000) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(window.location.href, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(t);
      const dateHeader = res.headers.get('date');
      if (dateHeader) {
        const serverMs = new Date(dateHeader).getTime();
        if (!isNaN(serverMs)) {
          this._serverOffset = serverMs - Date.now();
          this._synced = true;
          return true;
        }
      }
    } catch (_) {
      // Offline or blocked — fine, fall back to device clock.
    }
    this._synced = false;
    return false;
  },
};

window.TimeService = TimeService;
