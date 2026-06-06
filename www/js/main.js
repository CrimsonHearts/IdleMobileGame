/* ===========================================================================
 * main.js — Boots the game: sync time, load save, apply offline, start loop.
 * ========================================================================= */

(async function boot() {
  // 1. Try to get trusted time (best-effort; falls back to device clock).
  await TimeService.sync();

  // 2. Init monetization (ads/IAP — simulated on web, native via Capacitor).
  await Monetization.init();

  // 3. Load save (or start fresh) and initialise the engine.
  const saved = Storage.load();
  Game.init(saved);

  // 3. Apply offline progress with anti-cheat checks.
  const offline = Game.applyOffline();

  // 4. Build & render UI.
  UI.init();
  UI.showWelcomeBack(offline);

  // 5. Main loop via requestAnimationFrame (falls back to setInterval).
  let lastRender = 0;
  function frame(ts) {
    Game.tick();
    // Throttle DOM updates to ~10fps for battery; game math runs every frame.
    if (ts - lastRender > 100) {
      lastRender = ts;
      UI.renderResources();
      UI.renderShop();
      UI.renderUpgrades();
      UI.renderRealm();
    }
    requestAnimationFrame(frame);
  }
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(frame);
  } else {
    setInterval(() => { Game.tick(); UI.renderAll(); }, 200);
  }

  // 6. Save when the app is backgrounded / closed (mobile-critical).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Game.persist();
  });
  window.addEventListener('pagehide', () => Game.persist());
  window.addEventListener('beforeunload', () => Game.persist());

  // 7. Re-apply offline when returning to a backgrounded tab/app.
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
      await TimeService.sync();
      const result = Game.applyOffline();
      UI.showWelcomeBack(result);
      UI.renderAll();
    }
  });

  // Expose for debugging / future ad & IAP hooks.
  window.__game = Game;
})();
