# 仙途 · Path to Immortality

A **Chinese cultivation (xianxia) idle game** built with web tech and wrapped
for **Android & iOS** via [Capacitor](https://capacitorjs.com/). Meditate to
gather **Qi (气)**, build a cultivation sect, ascend through the **cultivation
realms** (Qi Condensation → Foundation → Core Formation → … → Immortal
Ascension), and grow stronger each life through **Dao Comprehension (道韵)**.

> Status: **playable prototype**. Core loop, generators, upgrades, prestige
> (breakthrough), offline progress with anti-cheat, save system, and
> ads/IAP hooks (simulated) are all in place.

---

## ▶️ Play it right now (no install)

It's just a web page — open it in any browser:

```bash
# from the project root
npm run serve          # serves www/ at http://localhost:8080
# ...or simply open www/index.html directly in a browser
```

Save data is stored in the browser's `localStorage`.

---

## 🗂 Project structure

```
www/                  # the entire game (this is what ships inside the app)
  index.html
  css/styles.css      # ink-wash (水墨) xianxia theme
  js/
    numbers.js        # big-number formatting (1.23M, 9.87Qa …)
    gameData.js       # ★ all balance & theme content — edit here to tune
    time.js           # trusted time + anti-cheat clock
    storage.js        # save / load
    game.js           # core engine (economy, tick, offline, breakthrough)
    monetization.js   # ★ ads + in-app purchases (AdMob / Play Billing hooks)
    ui.js             # DOM rendering & interactions
    main.js           # boot + game loop
capacitor.config.json # native app config
package.json          # helper scripts
docs/
  privacy-policy.md   # draft privacy policy (required by both stores)
  STORE-CHECKLIST.md  # step-by-step launch checklist
```

To **re-balance** the game, edit `www/js/gameData.js` (costs, production,
realms, upgrades). To **change monetization**, edit `www/js/monetization.js`.

---

## 🛡 Anti-cheat: clock tampering

Idle games are commonly cheated by setting the device clock forward to fake
offline earnings. Defenses (in `time.js` + `game.js`):

1. **Offline cap** — earnings capped at 8h regardless of elapsed time.
2. **Backward-jump detection** — if the clock reads earlier than the latest
   time ever observed, offline earnings are **denied** and the attempt flagged.
3. **Trusted online time** — when online, the server `Date` header is used
   instead of the device clock.
4. **Monotonic session clock** — the live loop uses `performance.now()`, which
   the user can't change.
5. **Offline efficiency 50%** — also doubles as a rewarded-ad hook.

---

## 💰 Monetization (already wired, runs simulated until you add IDs)

`www/js/monetization.js` is the single integration point.

- **Rewarded ads** — e.g. *"Watch ad → claim the other 50% of offline Qi"*
  (already hooked into the Welcome-Back popup).
- **Interstitial ads** — shown after a breakthrough.
- **Banner ads** — bottom of screen on native.
- **In-app purchases** — `remove_ads`, `qi_pouch_small`, `permanent_double`.

It currently uses **Google's official test ad IDs** and simulated purchase
dialogs, so everything works in the browser with no accounts. To go live:

1. `npm i @capacitor-community/admob` (ads) and an IAP plugin
   (`@capacitor-community/in-app-purchases` or RevenueCat).
2. Uncomment the `// --- REAL ---` blocks in `monetization.js`.
3. Replace the test IDs in `AD_CONFIG` with your **AdMob** unit IDs.
4. Define the IAP products in the Play Console / App Store Connect using the
   IDs in `IAP_PRODUCTS`.

---

## 📱 Turning this into Android & iOS apps (Capacitor)

You need [Node.js](https://nodejs.org/). For Android you also need
**Android Studio**; for iOS you need a **Mac with Xcode**.

```bash
# one-time setup
npm install
npm run cap:init            # creates the native config
npm run cap:add:android     # adds the Android project (any OS)
npm run cap:add:ios         # adds the iOS project (Mac only)

# whenever you change the game
npm run cap:sync

# open the native projects to build / run
npm run open:android        # → build a signed .aab in Android Studio
npm run open:ios            # → archive & upload in Xcode (Mac only)
```

See **`docs/STORE-CHECKLIST.md`** for the full publishing walkthrough.

---

## 🧭 Roadmap

- [x] Core idle loop (meditate, generators, cost scaling, QPS)
- [x] Offline progress + clock anti-cheat
- [x] Prestige (breakthrough / realms / Dao Comprehension)
- [x] Upgrades / techniques
- [x] Save system + autosave
- [x] Ink-wash xianxia UI
- [x] Ads + IAP hooks (simulated)
- [ ] Real AdMob + Play Billing integration (needs your accounts)
- [ ] Cloud save (Play Games / Game Center)
- [ ] More content: sub-realms, alchemy minigame, sect/disciples, events
- [ ] Illustrated art assets, sound, music
- [ ] App icons & store screenshots
- [ ] Localization (English ⇄ 中文)
```
