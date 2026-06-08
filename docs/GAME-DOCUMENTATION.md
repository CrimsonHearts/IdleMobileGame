# Path to Immortality — Master Documentation

A complete reference for the game's design, mechanics, architecture, balance,
art pipeline, and how to extend it. This is the single source of truth; the
other files in `docs/` cover narrow topics (AdMob, store submission, etc.).

- **Type:** Idle / incremental + life-sim, Chinese cultivation (xianxia) theme
- **Tech:** Vanilla HTML/CSS/JS, wrapped for Android/iOS via **Capacitor**
- **App ID:** `com.crimsonhearts.xianxiaidle`
- **Persistence:** `localStorage` (single save), offline progress + clock anti-cheat

---

## Table of Contents
1. [Concept & Game Loop](#1-concept--game-loop)
2. [Tech Stack & Architecture](#2-tech-stack--architecture)
3. [Project Structure](#3-project-structure)
4. [Running, Building & Shipping](#4-running-building--shipping)
5. [Currencies & Resources](#5-currencies--resources)
6. [Core Cultivation Loop](#6-core-cultivation-loop)
7. [Production Math (how Qi/sec is computed)](#7-production-math)
8. [Progression Systems](#8-progression-systems)
9. [The Two Prestige Layers](#9-the-two-prestige-layers)
10. [Side Systems](#10-side-systems)
11. [Life Sim](#11-life-sim)
12. [Quests & Hidden Mechanics](#12-quests--hidden-mechanics)
13. [Daily & Live Content](#13-daily--live-content)
14. [UI & Navigation Map](#14-ui--navigation-map)
15. [Save State Schema](#15-save-state-schema)
16. [Monetization](#16-monetization)
17. [Art Pipeline (ComfyUI)](#17-art-pipeline-comfyui)
18. [Balance Constants Reference](#18-balance-constants-reference)
19. [How to Extend](#19-how-to-extend)
20. [Related Docs](#20-related-docs)

---

## 1. Concept & Game Loop

You play a modern-day cultivator. The minute-to-minute loop:

```
Meditate / idle  →  earn Qi  →  buy generators & techniques  →  more Qi/sec
        →  clear minor Stages  →  Breakthrough (prestige) → Dao Comprehension
        →  spend Dao on Meridians  →  reach the peak realm
        →  Reincarnate (meta-prestige) → Heavenly Merit → permanent Perks
```

Parallel loops feed the core:
- **Life sim** (Study → Work → Romance → Family) earns ¥ and Talent/Charm.
- **Trials** (idle combat) earn Spirit Stones + Beast Eggs.
- **Beasts/Sect** convert those into production & combat bonuses.
- **Alchemy** turns Spirit Stones into timed buffs.
- **Secret Realm** turns combat power into a daily reward burst.

Everything ultimately multiplies Qi/sec or combat power.

---

## 2. Tech Stack & Architecture

- **No framework / no build step** — plain ES (browser) JS loaded via `<script>`
  tags in dependency order. Each system is a global singleton object
  (`Game`, `UI`, `Life`, `Family`, `Pets`, `Sect`, `Combat`, `Quests`,
  `Monetization`, `GameData`, `Storage`, `TimeService`, `GameNumbers`).
- **Data/logic/UI split:**
  - `gameData.js` — *all* balance values & content (edit here to re-tune).
  - `game.js` — core engine: state, economy math, tick loop, prestige.
  - System files (`life/family/pets/sect/combat/quests`) — feature logic + their own render helpers.
  - `ui.js` — top-level rendering, tab routing, modals, effects.
- **Game loop:** `main.js` runs `requestAnimationFrame`; `Game.tick()` advances
  the economy every frame; DOM updates are throttled to ~10fps for battery.
- **Time:** `TimeService` provides monotonic + wall-clock time and a best-effort
  trusted-time sync, used for offline calc and anti-cheat.

### Script load order (in `index.html`)
```
quests → numbers → gameData → time → storage → life → family
→ pets → sect → combat → game → monetization → ui → main
```
> Order matters: `game.js`/`ui.js` reference the system globals at runtime, so
> systems must be defined first.

---

## 3. Project Structure

```
IdleMobileGame/
├── www/                      # the web app (served as-is)
│   ├── index.html            # markup, tab panels, script tags
│   ├── css/styles.css        # all styling (single file)
│   ├── js/
│   │   ├── gameData.js       # ★ all balance & content
│   │   ├── game.js           # core engine (state, economy, prestige, ticks)
│   │   ├── ui.js             # rendering, navigation, modals, effects
│   │   ├── life.js           # Study (academy) + Work (career)
│   │   ├── family.js         # Romance + Family (+ Destined ad-unlock)
│   │   ├── pets.js           # Spirit Beasts (collect/level/deploy)
│   │   ├── sect.js           # Sects (join/rank/bonuses + online backend stub)
│   │   ├── combat.js         # Trials (idle auto-battler)
│   │   ├── quests.js         # quest definitions + tracking
│   │   ├── monetization.js   # AdMob + IAP (simulated in browser)
│   │   ├── numbers.js        # number/duration formatting
│   │   ├── storage.js        # localStorage save/load/wipe
│   │   └── time.js           # monotonic + trusted time
│   └── assets/
│       ├── portraits/        # painted character art  <gender>-<root>.jpg
│       ├── realms/           # painted realm vistas    realm-<0..9>.jpg
│       ├── icon-*.png        # app icons
│       └── *.svg             # vector fallbacks / generator sprites
├── android/                  # Capacitor Android project
├── tools/
│   ├── static-server.mjs     # zero-dep dev server (PORT env, default 8080)
│   ├── gen-portraits.mjs     # ComfyUI/Leonardo character art generator
│   ├── gen-realms.mjs        # ComfyUI realm-vista generator
│   └── gen-icon.py           # app-icon generator (Pillow)
├── docs/                     # this file + focused guides
└── capacitor.config.json     # appId, appName, webDir
```

---

## 4. Running, Building & Shipping

### Local dev
```bash
node tools/static-server.mjs        # → http://localhost:8080  (PORT env to change)
# or: npm run serve
```
No build step — edit files and refresh.

### Android APK (testing on a device) — use the build script
```bash
bash tools/build-apk.sh     # → ~/Desktop/PathToImmortality.apk (v2+v3 signed)
```
Install: `adb install -r <apk>` (`-r` keeps the existing save), or transfer the
file to the phone and tap it.

> 🚨 **Do NOT use `npx cap build android --keystore...` for sideload APKs.** It
> signs with the **legacy v1 (JAR) scheme only**, and since the app targets
> **SDK 36** Android **refuses to install v1-only APKs** ("App not installed").
> `tools/build-apk.sh` signs with **apksigner (v2+v3)**, which is required.
> Verify any APK with:
> `$ANDROID_HOME/build-tools/35.0.0/apksigner verify <apk>` → v2/v3 must be `true`.

### Play Store (AAB)
```bash
npx cap sync android && cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```
For an `.aab` the v1-only issue doesn't apply — **Play App Signing** re-signs the
delivered APKs as v2/v3. Requirements: Java 21, Android SDK (API 35) +
build-tools. Bump `versionCode` in `android/app/build.gradle` per release.
See `docs/STORE-CHECKLIST.md`.

> **Always run `npx cap sync` after changing `www/`** — it copies web assets
> into `android/app/src/main/assets/public/`. (`tools/build-apk.sh` does this
> for you.)

---

## 5. Currencies & Resources

| Resource | Symbol | Earned from | Spent on |
|---|---|---|---|
| **Qi** | ☯ | meditate, generators (idle) | generators, Qi-cost techniques |
| **Dao Comprehension** | ☯ | major Breakthrough (prestige) | Dao-cost techniques, Meridian nodes |
| **Money** | ¥ | jobs (Work) | study, dating, children, Spirit Market |
| **Spirit Stones** | 💠 | Trials, Secret Realm, Sect shop, ¥ market | level Beasts, brew Pills |
| **Beast Eggs** | 🥚 | Trials, Sect shop, Fortune Pill, Secret Realm | tame Spirit Beasts |
| **Heavenly Merit** | 🌟 | Reincarnation, day-7 daily, Secret Realm | Heavenly Perks |
| **Sect Contribution** | — | passive while in a sect, Trials | Sect exchange (eggs/stones) |

`runQi` (Qi earned *this life*) drives stage/breakthrough requirements;
`lifetimeQi` (all-time) feeds Heavenly Merit and stats.

---

## 6. Core Cultivation Loop

- **Meditate tap:** `GameData.tap.baseGain` (1) × tap multipliers. Can **crit**
  ×10 if you have the Radiant-Soul meridian crit chance.
- **Generators (10):** each produces `baseProd` Qi/sec per unit; cost grows
  `baseCost × 1.15^owned`. Buy ×1 / ×10 / Max.

| # | Generator | baseCost | baseProd/sec |
|---|---|---|---|
| 1 | Meditation App | 15 | 0.1 |
| 2 | Hydroponic Spirit Garden | 100 | 1 |
| 3 | Spirit Crystal Rig | 1,100 | 8 |
| 4 | Auto-Alchemy Lab | 12,000 | 47 |
| 5 | Cloud Scripture Server | 130,000 | 260 |
| 6 | Sword-Drone Bay | 1.4M | 1,400 |
| 7 | Qi Fusion Reactor | 20M | 7,800 |
| 8 | Dragon-Vein Power Plant | 330M | 44,000 |
| 9 | Orbital Star Collector | 5.1B | 260,000 |
| 10 | Dao Quantum Core | 75B | 1.6M |

- **Ownership milestones:** crossing **10/25/50/100/150/200/300/400/500** owned
  **doubles** that generator's output each time (compounding — ×16 at 120 owned).
- **Spirit Synergy:** each generator at **25+** owned grants **+12% global Qi**
  (shown as a banner). Rewards depth + breadth.

---

## 7. Production Math

`Game.qiPerSecond()` =

```
Σ_generators( baseProd × owned × genMilestoneMultiplier(owned) )
  × synergyMult                      # 1 + masteredCount × 0.12
  × allMult                          # see below
  × root × stage × dao × sect × pet × talent × family
```

`allMult` accumulates (multiplicatively unless noted):
- one-time **techniques** (`+50%/×2/×3…`)
- Meridian **qi** nodes `(1 + Σ)`
- Heavenly perk **Soul Memory** `(1 + 0.25×lvl)`
- **Reincarnation** bonus `(1 + reincarnations × 0.10)`
- active **Qi-buff pills** `(×2 / ×3)`
- IAP permanent ×2, rewarded-ad ×2, Cultivation-Insight ×2, quest bonuses,
  foundation-quality bonuses, spirit-pack bonus, stage-milestone bonuses.

Power vectors:
- `root` = Spiritual Root mult (1.0 → 8.0)
- `stage` = 1 + stagesCleared × **0.05**
- `dao` = 1 + daoComprehension × **0.02**
- `sect`, `pet`, `talent`, `family` = each system's multiplier

`qiPerTap()` uses `tapMult` instead of the generator sum.

---

## 8. Progression Systems

### Realms & minor stages
10 major **realms** (Mortal → Qi Condensation → Foundation Establishment →
Core Formation → Nascent Soul → Soul Formation → Void Refinement →
Body Integration → Great Ascension → Immortal Ascension). Each has minor
**stages**; clearing a stage = permanent **+5% Cultivation Base** (no reset).
Stage requirements are spread geometrically between realm anchors
(`GameData.stageReq`).

### Spiritual Roots & the opening gacha
5 roots (Mortal ×1.0 → Chaos ×8.0). Character creation gives **100 free rolls**
(weighted 50/28/14/6/2) — keep your best; leftover rolls convert to Qi + Stones.
**5 IAP packs** ($2.99–$19.99) guarantee stronger roots + bonuses
(`GameData.spiritRootPacks`).

### Hidden breakthrough mechanics
- **Foundation Quality** — on a major Breakthrough, `runQi / realm.reqQi` ratio
  yields a permanent bonus tier (Cracked 0% → Solid 6% → Flawless 12% →
  Perfect 20%). Previewed in the Tribulation modal so you can choose to wait.
- **Stage Milestones** — clearing culturally significant lifetime stage counts
  (3,7,9,13,18,27,36,49,72,81,99,108) fires a one-time bonus + Dao
  (`GameData.stageMilestones`).
- **Breakthrough Conditions** — 4 once-only hidden bonuses (Prodigy / Pure
  Cultivation / Dao-Enriched / Lightning) checked each Tribulation.

---

## 9. The Two Prestige Layers

### Layer 1 — Breakthrough (Tribulation) → Dao Comprehension
Available once all minor stages of a realm are cleared. Resets Qi, generators,
and the run; grants **Dao Comprehension** = `floor((runQi/1000)^0.4)` ×
`(1 + meridian daoGain + perk daoGain)`. Dao is a permanent global multiplier
**and** the currency for Meridian nodes & some techniques.

### Meridian Tree (spend Dao)
3 paths × 5 tiered nodes (`GameData.meridians`). Each node needs its
predecessor. Effects: `qi, tap, offline, combat, pet, daoGain, crit`.
**Full Respec** refunds all spent Dao.
- **Verdant Mind** — Qi production
- **Azure Body** — combat / offline / beast bonuses
- **Radiant Soul** — tap, crit (×10 taps), Dao gain

### Layer 2 — Reincarnation → Heavenly Merit
Unlocks at the peak realm (index 9). Full cultivation reset (realm, Dao,
generators, meridians, milestones) — **keeps** beasts, sect, family, IAP, perks.
Grants **Heavenly Merit** = `floor(daoComprehension^0.75 + (lifetimeQi/1e6)^0.3)`
× `(1 + perk merit)` and a permanent **+10% production per past life** (stacks
forever).

### Heavenly Perks (spend Merit, persist across all lives)
6 leveled perks (`GameData.heavenlyPerks`): Soul Memory (+25% Qi),
Heaven's Insight (+20% Dao gain), Immortal Body (+30% combat),
Eternal Foundation (start each life with +5 stages), Karmic Wealth
(start with Spirit Stones), Swift Samsara (+20% Merit).

---

## 10. Side Systems

### Trials (combat) — `combat.js`
Idle auto-battler. Player ATK/HP scale with realm + stages, plus active beasts,
sect, meridian/perk/pill combat bonuses. Zones × waves; every 10th wave is a
boss; clearing a boss opens the next zone. Loot: Spirit Stones, Qi, Beast Eggs,
Sect Contribution. Unlocks at **Qi Condensation** (`Game.combatUnlocked()`).

### Spirit Beasts — `pets.js`
8 collectible beasts across 5 rarities. **Tame** with Beast Eggs (gacha;
duplicates auto-level). **Level** with Spirit Stones. Owned beasts give a global
Qi bonus; up to **3 active** beasts also fight in Trials. ¥→Stones "Spirit
Market" lives on this tab.

### Sects — `sect.js`
Pledge to 1 of 6 sects for permanent bonuses (Qi / combat / pet / offline /
loot). Earn **Contribution** (passive + combat) to rank up (6 ranks). A
contribution exchange buys Eggs/Stones. Online cross-player sects are
abstracted behind `SectBackend` (`LocalBackend` ships; `CloudBackend` is a stub
— see `docs/SECT-ONLINE.md`).

### Pill Alchemy — Arts ▸ Alchemy
Brew 5 pills from Spirit Stones (`GameData.pills`): timed buffs (2×/3× Qi,
2× combat) and instants (Beast Egg, Foundation Pill = +25% of next stage req).
Active buffs show live countdowns and integrate into production/combat.

### Secret Realm — World ▸ Realm
Once-daily expedition. Your **Combat Rating** (`playerAtk + 0.2×playerHpMax`,
including a Berserk pill) sets how many floors you clear. Rewards scale with
depth: Spirit Stones (compounding), a Beast Egg every 5 floors, Heavenly Merit
every 10, **+50% on a new record**.

---

## 11. Life Sim

### Study (Academy) — `life.js`
5 courses (Self-Study → Immortal Institute) raise **Talent** (cultivation
speed), **Intellect** (salary), **Charm** (romance). Taken in order; cost ¥ +
real-time duration.

### Work (Career) — `life.js`
5 jobs gated by education. Pay scales with Intellect and on-the-job level
(+10%/level). Earns ¥ passively while the app is open.

### Romance & Family — `family.js`
Meet 4 candidates (each with a generated **encounter + backstory**). Build
**Affinity** via Chat / Date(¥200) / Gift(¥1K) — boosted by Charm. At 100
Affinity you may **propose**. Spouse's Spiritual Root strengthens the household
(`familyMult`); children **inherit** a root (chance to ascend a tier) and each
adds +5% cultivation.
- **Watch Ad → Meet a Destined One:** rewarded ad summons a rare partner rolled
  `min_heaven` (Heavenly root or better) with high Charm, shown as a glowing
  gold "Destined" card.

`Life.tick` also **ages** the cultivator (+1 year / 150s) which gates some
hidden bonuses (e.g., Prodigy breakthrough at age ≤ 25).

---

## 12. Quests & Hidden Mechanics

### Quests — `quests.js`
19 quests in 3 categories: **Story** (10, ordered), **Achievement** (5),
**Hidden** (4). Completion is checked every tick; rewards (Qi/Dao/¥/Charm/
permanent %) are **claimed manually**. The Quest Log (📜) shows a progress bar,
per-category counts, **Claim All**, and **hides claimed quests** so only active
ones remain.

### Other hidden mechanics
- **Cultivation Insight** — 0.5% chance per meditate tap → 60s of 2× production.
- **Lucky 8888** — resonating at auspicious Qi values triggers a hidden reward
  (`Quests.checkLuckyNumbers`).

---

## 13. Daily & Live Content

- **Daily Rewards (🎁):** a 7-day streak calendar (`GameData.dailyRewards`).
  Streak continues if you return the next day, resets if you miss one. Day 7 is a
  gold finale (Heavenly Merit ×3). Auto-pops on launch when claimable; badge on
  the Daily button.
- **Secret Realm:** the daily combat expedition (see §10).

---

## 14. UI & Navigation Map

**Top bar:** avatar, name, root chip, realm/stage, Age, Dao.
**Quick actions:** 🛒 Shop · 📜 Quests · 🎁 Daily.
**Currency strip:** Qi (+ /s), ¥, Cultivation %.

**Bottom nav (6 tabs):**
| Tab | Contents |
|---|---|
| 🧘 **Cultivate** | realm progress, breakthrough, meditate orb, ad boosts, generators (with synergy banner) |
| 🎓 **Study** | academy courses |
| 💼 **Work** | career / jobs |
| ❤️ **Life** | romance → family (+ Destined ad) |
| ⚔️ **World** | sub-nav: Trials · Beasts · Sect · Realm |
| 📜 **Arts** | sub-nav: Techniques · Meridians · Heaven (reincarnation+perks) · Alchemy |

Per-realm **atmospheric backdrop** (themed gradient + drifting motes + painted
vista) cross-fades as you ascend; the meditate-orb aura & breakthrough flash
re-tint to the realm accent.

---

## 15. Save State Schema

Saved to `localStorage` under `GameData.saveKey` (`xianxia_idle_save_v1`).
Migrations are additive — `Game.init()` backfills any missing field, so old
saves load safely. Key fields (`Game.newState()`):

```js
{
  version, characterCreated, name, gender, spiritualRoot,
  qi, lifetimeQi, runQi, owned{genId:n}, upgrades{id:true},
  realm, stage, stagesCleared, daoComprehension,
  spiritStones, beastEggs, sect, pets{owned,active}, combat{zone,wave,...},
  life{...}, family{...},               // life-sim sub-states
  // monetization
  permanentDouble, qiBoostEndsAt,
  // quests / hidden
  questPermanentBonus, insightEndsAt, foundationBonuses[],
  // gacha + hidden milestones
  freeRollsLeft, milestonesUnlocked[], packProductionBonus, breakthroughConditionsHit[],
  // R2
  meridians{id:true},
  // R3
  heavenlyMerit, heavenlyPerks{id:lvl}, reincarnations, dailyStreak, lastDailyDay,
  // R4
  pillBag{id:n}, buffs[{buff,mult,endsAt}], secretRealm{lastRunDay,highestFloor},
  // anti-cheat
  lastSaved, createdAt, maxSeenTime, cheatFlags
}
```

**Offline & anti-cheat (`game.js`):** earnings capped at 8h at 50% efficiency
(raised by offline techniques/sect). Backward clock jumps beyond a 60s grace are
flagged and grant nothing; `maxSeenTime` is sticky.

---

## 16. Monetization

`monetization.js` is the single integration point. **Simulated in the browser**
(confirm dialogs) and real via Capacitor plugins on device.
- **Ads (AdMob):** rewarded (2× Qi boost, Stage Aid, Destined partner) +
  interstitial (every 3rd breakthrough). Test ad units used while
  `AD_CONFIG.useLiveAds = false` — **keep false in dev** to avoid bans.
- **IAP:** `remove_ads` ($10.99), `permanent_double` ($4.99), `qi_pouch_small`,
  and the 5 spirit-root packs. Grant logic in `Monetization._grant`.

See `docs/ADMOB-SETUP.md` for native wiring and real ad-unit IDs.

---

## 17. Art Pipeline (ComfyUI)

Local **ComfyUI** at `http://127.0.0.1:8188` with **GuoFeng4 XL**
(`4Guofeng4XL_v12.safetensors`) + LoRAs.

- **Character portraits** — `node tools/gen-portraits.mjs`
  Uses `girl_20` + `Xianxia_Style` LoRAs → `www/assets/portraits/<gender>-<root>.jpg`.
- **Realm vistas** — `node tools/gen-realms.mjs`
  Uses **only** `Xianxia_Style` (drops the character LoRA) and **pins an XL
  checkpoint** (GuoFeng3 is SD1.5 and forces a person into the scene).
  832×1216, people-free landscapes → `www/assets/realms/realm-<0..9>.jpg`.
  `--only=N` re-rolls a single realm.
- **App icon** — `python3 tools/gen-icon.py` (Pillow) → `www/assets/icon-*.png`.

> Missing art falls back gracefully (vector emblems / gradient backdrop), so the
> game is fully playable without running the generators.

---

## 18. Balance Constants Reference

All in `gameData.js` — change these to re-tune without touching logic.

| Constant | Value | Meaning |
|---|---|---|
| `tap.baseGain` | 1 | Qi per meditate tap (pre-mult) |
| `offline.maxSeconds` | 28,800 | offline cap (8h) |
| `offline.efficiency` | 0.5 | base offline rate |
| generator `costGrowth` | 1.15 | per-unit cost growth |
| `genMilestones` | 10…500 | ownership milestone thresholds |
| `genMilestoneMult` | 2 | × per milestone |
| `synergyThreshold` | 25 | "mastered" owned count |
| `synergyBonusPer` | 0.12 | +12% global per mastered generator |
| `stageBonusPerStage` | 0.05 | +5% per stage cleared |
| `daoBonusPerPoint` | 0.02 | +2% global per Dao |
| `daoGainFor` | `floor((runQi/1e3)^0.4)` | Dao per breakthrough |
| `reincarnationRealmReq` | 9 | realm index to reincarnate |
| `reincarnationBonusPer` | 0.10 | +10% production per past life |
| `meridianCritMult` | 10 | crit tap multiplier |

Content counts: 10 generators · 15 techniques · 10 realms · 5 roots · 5 packs ·
12 stage milestones · 4 breakthrough conditions · 4 foundation tiers ·
3 meridian paths/15 nodes · 6 heavenly perks · 7 daily rewards · 5 pills ·
8 beasts · 6 sects · 5 courses · 5 jobs · 19 quests.

---

## 19. How to Extend

All content is data-driven; the UI iterates the arrays, so adding entries is
usually a `gameData.js`-only change.

- **New generator:** add to `GameData.generators` (id, name, icon, baseCost,
  costGrowth, baseProd, desc). Add an SVG sprite `#ic-<id>` or it shows a blank
  icon tile.
- **New technique:** push to `GameData.upgrades` with an `effect(m)` that mutates
  `tapMult` / `allMult` / `offlineBonus`. Auto-renders in Arts ▸ Techniques.
- **New realm:** add to the `realms` array (name, reqQi, stages). Add a
  `#app[data-realm="N"]` theme block in `styles.css` and a `realm-N.jpg` vista.
- **New meridian node / heavenly perk / pill / daily reward / sect / beast /
  course / job / quest:** add to the matching `GameData` array (or the system's
  data constant) — each renderer iterates it.
- **New multiplier source:** compute it in `Game.multipliers()` and fold into the
  appropriate power vector so `qiPerSecond`/`qiPerTap` pick it up.

After any `www/` change for mobile: `npx cap sync android` then rebuild.

---

## 20. Related Docs
- `docs/LOCAL-SETUP.md` — local dev + ComfyUI setup
- `docs/CHARACTER-ART.md` — portrait art details
- `docs/ADMOB-SETUP.md` — native ad/IAP wiring
- `docs/SECT-ONLINE.md` — enabling real cross-player sects
- `docs/STORE-CHECKLIST.md` — Play Store / App Store submission
- `docs/privacy-policy.md` — privacy policy (host before submitting)
- `README.md` — quick start
