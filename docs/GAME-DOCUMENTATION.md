# Path to Immortality — Master Documentation

A complete reference for the game's design, mechanics, architecture, balance,
art pipeline, and how to extend it. This is the single source of truth; the
other files in `docs/` cover narrow topics (AdMob, store submission, etc.).

- **Type:** Idle / incremental + life-sim, Chinese cultivation (xianxia) theme
- **Tech:** Vanilla HTML/CSS/JS, wrapped for Android/iOS via **Capacitor**
- **App ID:** `com.crimsonhearts.xianxiaidle` · **App name:** Path to Immortality
- **Persistence:** `localStorage` (single save, key `xianxia_idle_save_v2`,
  save-shape `version: 7`), offline progress + clock anti-cheat

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

A wide set of parallel loops all ultimately feed back into Qi/sec or combat
power, so the game reads as "everything is connected" rather than a pile of
disconnected minigames:

- **Life sim** (Study → Work → Romance → Family) earns ¥, Talent/Intellect/
  Charm, and — via Study's elective grid — direct Qi/pay/courtship bonuses.
- **Trials** (idle combat) earns Spirit Stones, Blood Essence, Beast Eggs,
  Stellar Shards, Sect Contribution, and Artifact drops; player power in turn
  depends on almost every other system (gear, runes, pets, sect, meridians,
  perks, Dao Path, karma, boosters, family).
- **Spirit Beasts / Sect / Sect Guild** convert Trials output into more
  production and combat bonuses.
- **Artifacts + Enchanting** turn combat loot into a gear/loadout metagame,
  with set bonuses and a reincarnation-surviving Heirloom mechanic.
- **Blood (Jing) / Spirit (Shen)** are two parallel "body & soul refinement"
  stat trees that sit beneath/above Qi in classical cultivation theory, both
  fed by combat/passive income and spent on uncapped permanent ranks.
- **Celestial Fracture** is a second prestige-adjacent meta-layer (Stellar
  Shards, a Resonance Tree, tiered Rift events) that is *also* the game's
  main story vehicle — the same rift-sealing progress that unlocks
  Resonance nodes is what advances the Fracture story quests.
- **Alchemy** turns Spirit Stones into timed buffs; **Secret Realm** turns
  combat power into a once-daily reward burst; **Market** is a ¥→Spirit
  Stones (and other goods) trading sink with drifting prices.
- **Quests** are the connective narrative tissue across almost everything
  above — an onboarding chain plus a three-act story (Celestial Fracture)
  that culminates in named boss fights inside Trials itself.

---

## 2. Tech Stack & Architecture

- **No framework / no build step** — plain ES (browser) JS loaded via
  `<script>` tags in dependency order. Each system is a global singleton
  object (`Game`, `UI`, `Life`, `Family`, `Pets`, `Sect`, `SectGuild`,
  `Combat`, `Quests`, `Artifacts`, `Enchanting`, `Blood`, `Spirit`,
  `Techniques`, `Fracture`, `Market`, `Boosters`, `Achievements`, `Dailies`,
  `Challenges`, `Monetization`, `Onboarding`, `GameData`, `Storage`,
  `TimeService`, `GameNumbers`).
- **Data/logic/UI split:**
  - `gameData.js` — most balance values & theme content (edit here to
    re-tune the *xianxia* flavor and numbers). At 67 KB it's the single
    largest data file.
  - `game.js` — core engine: state shape (`newState()`), the full
    multiplier stack (`multipliers()`), tick loop, offline progress,
    breakthrough/reincarnation logic. Theme-agnostic; driven by `gameData.js`.
  - System files (one per feature: `life`, `family`, `pets`, `sect`,
    `sectguild`, `combat`, `artifacts`, `enchanting`, `blood`, `spirit`,
    `techniques`, `fracture`, `market`, `boosters`, `achievements`,
    `dailies`, `challenges`, `events`, `quests`) — each owns its own state
    sub-object, logic, and (for most) its own render helpers called from
    `ui.js`.
  - `ui.js` — top-level rendering, tab routing, modals, toasts/dialogue,
    effects. At 165 KB it's by far the largest file in the codebase.
  - `onboarding.js` — progressive feature-unlock gating + guided tutorial,
    layered on top of everything else without those systems needing to
    know about it.
- **Game loop:** `main.js` boots the app (trusted-time sync → Monetization
  init → optional Sect online mode → load save → start the loop) and runs
  `requestAnimationFrame`; `Game.tick()` advances the economy every frame;
  DOM updates are throttled to ~10fps for battery.
- **Time:** `TimeService` provides monotonic + wall-clock time and a
  best-effort trusted-time sync, used for offline calc and anti-cheat.

### Script load order (`www/index.html`, right before `</body>`)

```
quests → numbers → gameData → time → storage → life → family → pets
→ techniques → blood → spirit → sect → combat → events → artifacts
→ challenges → enchanting → boosters → sectguild → achievements → dailies
→ fracture → market → game → monetization → ui → onboarding → main
```
28 `<script>` tags total. Nothing runs game logic at parse time (every file
just assigns an object literal to `window.X`), so load order mostly only
matters in that `main.js` — the only file that actually *calls* into the
loaded systems — must load last.

### File inventory (`www/js/*.js`, 27 files)

| File | Purpose |
|---|---|
| `gameData.js` | ★ Most balance & content (theme-specific numbers, names, flavor text) |
| `game.js` | Core engine: state shape, full multiplier stack, tick loop, prestige |
| `ui.js` | Renders game state to DOM, tab routing, modals, toasts/dialogue |
| `quests.js` | Story/achievement/hidden quest definitions + tracking (45 quests) |
| `numbers.js` | Big-number formatting ("1234567" → "1.23M") |
| `time.js` | Trusted-time + anti-cheat clock service |
| `storage.js` | `localStorage` save/load/migration |
| `life.js` | Study (Academy + electives) + Work (Career, ranks, specializations) |
| `family.js` | Romance, courtship, marriage/Bond, children, life stages, child marriage |
| `pets.js` | Spirit Beasts: tame/level/star-evolve/active-slot roster |
| `techniques.js` | Combat Techniques: 5 martial-art passives, max 3 equipped |
| `blood.js` | Blood Essence (Jing) body-refinement stat tree |
| `spirit.js` | Spirit (Shen) soul-refinement stat tree, unlocks at Nascent Soul |
| `sect.js` | Join a sect for permanent bonuses; Contribution rank ladder; online-sect backend abstraction |
| `combat.js` | Trials idle auto-battler: zones/waves/bosses, zone-banded rosters, Rift Guardians |
| `events.js` | Karma (Righteous/Demonic) life-event popups |
| `artifacts.js` | Equipment: 6 slots (2 unlockable), rarities, sets, auto-equip, bulk salvage |
| `challenges.js` | Weekly rotating global combat/economy modifier |
| `enchanting.js` | Artifact rune enchanting + reincarnation-surviving Heirloom mechanic |
| `boosters.js` | 4 stacking timed buffs, ad- or Spirit-Stone-activated |
| `sectguild.js` | Per-sect research tree, Contribution Store, Offerings |
| `achievements.js` | 31 milestone achievements across 6 categories |
| `dailies.js` | Seeded daily mission board, streak + weekly chest |
| `fracture.js` | Celestial Fracture: Stellar Shards, Resonance Tree, tiered Rifts, Rift Guardian story hook |
| `market.js` | ¥-sink trading post with drifting prices |
| `monetization.js` | Ads + IAP integration point (simulated in-browser) |
| `onboarding.js` | Progressive feature unlocks + guided tutorial |
| `main.js` | Boot sequence + `requestAnimationFrame` loop |

---

## 3. Project Structure

```
IdleMobileGame/
├── CLAUDE.md                 # dev-session notes (build limitations, smoke-test conventions)
├── README.md
├── package.json              # name: xianxia-idle · Capacitor + AdMob deps
├── capacitor.config.json     # appId, appName, webDir
├── Dockerfile / docker-compose.yml
├── www/                      # the web app (webDir — served as-is, Capacitor loads this)
│   ├── index.html            # markup, tab panels, 28 script tags
│   ├── css/styles.css        # all styling (single file)
│   ├── js/                   # 27 files, see inventory above
│   └── assets/
│       ├── portraits/        # painted character art  <gender>-<root>.jpg
│       ├── realms/           # painted realm vistas    realm-<0..9>.jpg
│       ├── icon-*.png        # app icons
│       └── *.svg             # vector fallbacks / generator sprites
├── android/                  # Capacitor-generated native Android project (gitignored)
├── tools/
│   ├── static-server.mjs     # zero-dep dev server (PORT env, default 8080)
│   ├── build-apk.sh          # produces a sideload-able v2/v3-signed .apk
│   ├── gen-portraits.mjs     # ComfyUI/Leonardo character art generator
│   ├── gen-realms.mjs        # ComfyUI realm-vista generator
│   ├── gen-icon.py           # app-icon generator (Pillow)
│   ├── run-android.sh
│   └── test-onboarding.mjs
├── smoke5.js … smoke24.js    # 20 hand-rolled regression scripts at repo root
│                              # (no smoke1-4; see CLAUDE.md for the convention)
├── docs/                     # this file + focused guides
└── android/, node_modules/   # generated/vendored, not hand-edited
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
> signs with the **legacy v1 (JAR) scheme only**, and since the app targets a
> modern Android `targetSdk`, Android **refuses to install v1-only APKs**
> ("App not installed"). `tools/build-apk.sh` signs with **apksigner
> (v2+v3)**, which is required. Verify any APK with:
> `$ANDROID_HOME/build-tools/<ver>/apksigner verify <apk>` → v2/v3 must be `true`.

### Play Store (AAB)
```bash
npx cap sync android && cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```
For an `.aab` the v1-only issue doesn't apply — **Play App Signing** re-signs
the delivered APKs as v2/v3. Requires Java + Android SDK/build-tools locally.
Bump `versionCode` in `android/app/build.gradle` per release.
See `docs/STORE-CHECKLIST.md`.

> **Always run `npx cap sync` after changing `www/`** — it copies web assets
> into `android/app/src/main/assets/public/`. (`tools/build-apk.sh` does this
> for you.)

> **Note:** `android/`/`ios/` are gitignored by design — generated locally per
> dev via `npm run cap:add:android`, never committed. A **Claude Code
> remote/sandboxed session cannot build the APK** (no Android SDK, and the
> network policy blocks Google's Maven repo) — see `CLAUDE.md` for the full
> explanation and what to tell a user who asks for a build from such a session.

---

## 5. Currencies & Resources

| Resource | Symbol | Earned from | Spent on |
|---|---|---|---|
| **Qi** | ☯ | meditate, generators (idle) | generators, Qi-cost techniques |
| **Dao Comprehension** | ☯ | major Breakthrough (prestige) | Meridian nodes, some techniques |
| **Money** | ¥ | Work (jobs) | Study, dating, children, Spirit Market |
| **Spirit Stones** | 💠 | Trials, Secret Realm, Sect shop, ¥ market | level Beasts, learn Techniques, brew Pills, unlock gear slots |
| **Beast Eggs** | 🥚 | Trials, Sect shop, Fortune Pill, Secret Realm | tame Spirit Beasts, evolve stars |
| **Blood Essence** | 🩸 | Trials kills (~1% of mob power) | Blood (Jing) refinement ranks, Enchanting |
| **Spirit** | 🌌 | passively condensed (0.2% of every Qi gain) | Spirit (Shen) insight ranks |
| **Stellar Shards** | ✦ | Trials (zone 3+), Rift events | Fracture Resonance Tree, Shard Investments |
| **Sect Contribution** | — | passive while in a sect, Trials | Sect rank-up, Sect Guild research/store, Offerings |
| **Heavenly Merit** | 🌟 | Reincarnation, day-7 daily, Secret Realm | Heavenly Perks |

`runQi` (Qi earned *this life*) drives stage/breakthrough requirements;
`lifetimeQi` (all-time) feeds Heavenly Merit and various stats/quests.

---

## 6. Core Cultivation Loop

- **Meditate tap:** `GameData.tap.baseGain` (1) × tap multipliers. Can **crit**
  ×10 if you have the Radiant-Soul meridian crit chance (Sudden Insight node).
- **Generators (15):** each produces `baseProd` Qi/sec per unit; cost grows
  `baseCost × 1.16^owned` for every generator. Buy **×1 / ×5 / MAX** (the
  standardized buy-quantity convention used across the game — see §14).

| # | Generator | baseCost | baseProd/sec | Gate |
|---|---|---|---|---|
| 1 | Meditation App | 15 | 0.138 | — |
| 2 | Hydroponic Spirit Garden | 100 | 1.38 | — |
| 3 | Spirit Crystal Rig | 1,100 | 11.04 | — |
| 4 | Auto-Alchemy Lab | 12,000 | 64.86 | — |
| 5 | Cloud Scripture Server | 130,000 | 358.8 | — |
| 6 | Sword-Drone Bay | 1.4M | 1,932 | — |
| 7 | Qi Fusion Reactor | 20M | 10,764 | — |
| 8 | Dragon-Vein Power Plant | 330M | 60,720 | — |
| 9 | Orbital Star Collector | 5.1B | 358,800 | — |
| 10 | Dao Quantum Core | 75B | 2.208M | — |
| 11 | Rift Extraction Array | 1.125T | 13.248M | realm ≥4 |
| 12 | Jiutian Seized Reactor | 16.875T | 79.488M | realm ≥5 |
| 13 | Nine Heavens Bridge | 253.125T | 476.928M | realm ≥6 |
| 14 | Star-Devouring Engine | 3.797Qa | 2.862B | realm ≥7 |
| 15 | Ascendant Dao Engine | 56.953Qa | 17.169B | realm ≥8 |

The last 5 generators are a later addition, gated behind reaching the
matching realm — they exist so the mid-to-late game keeps introducing new
"grounds" instead of just re-scaling the same 10.

- **Ownership milestones:** crossing **10/25/50/100/150/200/300/400/500 /
  750/1000/1500/2000** owned multiplies that generator's output by
  **1.8×** each time (compounding across every threshold crossed).
- **Spirit Synergy:** each generator at **25+** owned ("mastered") grants
  **+11% global Qi** (shown as a banner). Rewards depth + breadth.

> These constants (`costGrowth`, `genMilestoneMult`, `synergyBonusPer`) were
> deliberately trimmed in a rebalance pass — see §18 for the full before/after
> and the reasoning (economy was cut ~35% Qi/s / ~54% cost, not more).

---

## 7. Production Math

`Game.qiPerSecond()`:

```
base = Σ_generators( baseProd × owned × genMilestoneMultiplier(owned) )
base *= synergyMult()                 # 1 + masteredCount × 0.11

qiPerSecond = base × allMult × root × stage × dao × sect × pet × talent × family × legacy
```

`Game.multipliers()` builds `allMult` (and the power vectors) by folding in,
roughly in this order:

1. Purchased passive **Techniques** (`GameData.upgrades`, Arts ▸ Techniques) —
   each has an `effect(m)` mutating `tapMult` / `allMult` / `offlineBonus`.
2. **Dao Path** + trait mods (own + spouse), **karma** alignment mods.
3. System multipliers: `Sect.qiMult()` (folds in SectGuild research
   automatically), `Pets.qiMult()`, `Life.talentMult()`,
   `Family.familyMult()`, `Blood.qiMult()`, `Spirit.qiMult()` +
   `Spirit.offlineBonus()`, `Artifacts.qiPct()`, `Enchanting.qiPct()`,
   `Life.qiStudyMult()` (the Qi Refinement Science elective path),
   `Fracture.qiMult()` (Stellar Qi resonance path).
4. Time-limited stacks: `Challenges.qiMult()` (weekly modifier),
   `Boosters.qiMult()` (Qi Surge), `Dailies.qiMult()` (Cultivation Seal).
5. **Meridian tree** (`qi`/`tap`/`offline`/`pet` nodes).
6. **Heavenly Perk** Soul Memory, **reincarnation** bonus (+10%/past life),
   active **alchemy pills**, **IAP** permanent ×2 / rewarded-ad ×2 /
   Cultivation-Insight ×2, **quest** permanent bonuses, **foundation-quality**
   bonuses, **spirit-pack** IAP bonus, **stage-milestone** bonuses, **House
   Reputation** (capped +25%), and the flat **+7%/realm** bonus.

Power vectors used in the final multiply:
- `root` = Spiritual Root mult (1.0 → 8.0)
- `stage` = 1 + stagesCleared × **0.045**
- `dao` = 1 + daoComprehension × **0.018**
- `sect`, `pet`, `talent`, `family`, `legacy` = each system's own multiplier

`qiPerTap()` reuses the same trailing chain (`root·stage·dao·sect·pet·talent·
family·legacy`) times `tapMult × (1 + focusBonus())`.

**Combat power** follows an analogous (separate) accumulation in
`Combat.playerAtk()`/`playerHpMax()` — see §10.

---

## 8. Progression Systems

### Realms & minor stages
10 major **realms**: Mortal → Qi Condensation → Foundation Establishment →
Core Formation → Nascent Soul → Soul Formation → Void Refinement →
Body Integration → Great Ascension → Immortal Ascension. Each has minor
**stages**; clearing a stage = permanent **+4.5% Cultivation Base** (no
reset). Minor-stage naming is **not uniform** across realms — a deliberate
nod to real xianxia numerology conventions:
- Mortal: a custom 2-stage intro (`Mortal Body`, `Qi Sensing`)
- Qi Condensation: the classic **9 Layers** (`1st Layer`…`9th Layer`)
- Foundation Establishment → Great Ascension (7 realms): a shared 4-stage
  set (`Early / Middle / Late Stage`, `Great Perfection`)
- Immortal Ascension (final realm): a unique 4-stage finale
  (`Tribulation`, `Half-Immortal`, `True Immortal`, `Golden Immortal`)

### Spiritual Roots & the opening gacha
5 roots (Mortal ×1.0 → True ×1.6 → Heavenly ×2.6 → Saint ×4.5 → Chaos ×8.0).
Character creation gives **100 free rolls** (weighted 50/28/14/6/2) — keep
your best; leftover rolls convert to Qi + Stones. **5 IAP packs**
($2.99–$19.99) guarantee stronger roots + bonuses (`GameData.spiritRootPacks`),
with their own steeper weighting (15/35/28/16/6) favoring mid-tier roots.

### Hidden breakthrough mechanics
- **Foundation Quality** — on a major Breakthrough, `runQi / realm.reqQi`
  ratio yields a permanent bonus tier (Cracked 0% → Solid 6% → Flawless 12%
  → Perfect 20%). Previewed in the Tribulation modal so you can choose to wait.
- **Stage Milestones** — clearing culturally significant lifetime stage counts
  (3,7,9,13,18,27,36,49,72,81,99,108) fires a one-time bonus + Dao
  (`GameData.stageMilestones`, 17 entries with distinct flavor text).
- **Breakthrough Conditions** — 4 once-only hidden bonuses (Prodigy / Pure
  Cultivation / Dao-Enriched / Lightning) checked each Tribulation.

---

## 9. The Two Prestige Layers

### Layer 1 — Breakthrough (Tribulation) → Dao Comprehension
Available once all minor stages of a realm are cleared. A Tribulation
succeeds at `min(0.92, 0.55 + talent×0.0008 + intellect×0.0004 + mods +
karma mods + Spirit bonus)` — realms with no pill cost (the tutorial realm)
always succeed. **Failure** consumes the pill and costs **30% of runQi**
with no realm advance.

Success resets Qi, generators, and the run; grants **Dao Comprehension**:
```
0                                          if lifetimeQiThisRun < 10,000
floor( (lifetimeQiThisRun / 10,000) ^ 0.22 )   otherwise
```
scaled further by `(1 + meridian daoGain + perk daoGain)` then by the active
weekly Challenge's Dao multiplier. Dao is both a permanent global multiplier
**and** the currency for Meridian nodes & some techniques.

### Meridian Tree (spend Dao)
**3 paths × 5 tiered nodes = 15 nodes** (`GameData.meridians`). Each node
needs its predecessor. **Full Respec** refunds all spent Dao.
- **Verdant Mind** (Qi) — Opening Meridian → Flowing Channels → Verdant Core
  → Boundless Spring → World Tree Dao
- **Azure Body** (combat / offline / pet) — Iron Skin → Tireless Body →
  Diamond Sinews → Beast Kinship → Indestructible
- **Radiant Soul** (tap / crit / Dao gain) — Clear Heart → Sudden Insight →
  Enlightened Palm → Dao Resonance → Heaven's Favour

Crit tap multiplier (Sudden Insight): **×10**.

### Layer 2 — Reincarnation → Heavenly Merit
Unlocks at the peak realm (index 9, Immortal Ascension). Full cultivation
reset (realm, Dao, generators, meridians, milestones, breakthrough
conditions) — **keeps** beasts, sect, gear, family, IAP, perks, Blood/Spirit
ranks. Grants **Heavenly Merit**:
```
fromDao = daoComprehension ^ 0.42 × 0.6
veteran = 1 + reincarnations × 0.10
merit   = max(10, floor(fromDao × veteran)) × (1 + perk merit bonus)
```
and a permanent **+10% production per past life** (`reincarnationMult`,
stacks forever). Reincarnating is also the trigger for Enchanting's
Ancestral Heirloom system to gain a stack (see §10).

### Heavenly Perks (spend Merit, persist across all lives)
9 leveled perks (`GameData.heavenlyPerks`): Soul Memory (+25%/lvl Qi, max
10), Heaven's Insight (+20%/lvl Dao gain, max 8), Immortal Body (+30%/lvl
combat, max 8), Eternal Foundation (+5 starting stages/lvl, max 5), Karmic
Wealth (+1,000 starting Spirit Stones/lvl, max 5), Swift Samsara (+20%/lvl
Merit gain, max 5). Round 27 added three more, aimed at keeping the sink
meaningful past the original 6's ~20-30-life cap: Samsara Mastery (+1%/lvl
to the per-life production RATE itself — `Game.reincarnationMult()` reads
`GameData.reincarnationBonusPer + perkBonus('lifeBonusPer')`, so it
compounds with reincarnation count instead of being a flat bonus, max 10,
no gate), Void Attunement (+20%/lvl combat, max 10, gated behind sealing
Su Wan's Shadow) and Void Harvest (+35%/lvl Merit gain, max 6, gated behind
sealing The First Voice). A perk's optional `reqGuardian` field ties it to
`Game.state.fracture.guardiansDefeated[id]`; `Game.perkUnlocked()` /
`canBuyHeavenlyPerk()` check it and the Heaven tab renders a locked perk
with a 🔒 badge and no buy button until its Guardian falls — see §10 Trials.

---

## 10. Side Systems

### Trials (combat) — `combat.js`
Idle auto-battler. Player **ATK** = `(baseAtk + Pets.combatAtk + Artifacts.atk)
× Sect.combatMult × meridian × perk × pill × path × boost × fracture × family`,
where `path` alone bundles Dao Path/trait mods, a temporary duel buff,
Artifact set bonuses, equipped Combat Techniques, Blood refinement, and
Enchanting runes. Player **HP** follows an analogous formula. Boss waves get
extra multipliers from Techniques/Enchanting/SectGuild "boss damage" stats.

Zones × waves; every 10th wave is a **boss**; clearing a boss opens the next
zone (and any earlier-cleared zone can be revisited freely via
Retreat/Advance). Loot: Spirit Stones, Qi, Blood Essence, Sect Contribution,
Stellar Shards (zone 3+), Beast Egg chance, and Artifact drops. Defeat just
resets to Wave 1 of the current zone with a full heal — no permanent loss.
Unlocks at **Qi Condensation** (`Game.combatUnlocked()`, realm ≥1 or
stagesCleared ≥2).

**Zone-banded rosters** — five bands (Round 27 added the 5th; Void-Touched
used to run to `Infinity`, meaning zone 21+ was pure repetition with no new
named content — it's now capped at 25 and handed off to a genuinely new
band), each with its own 4 mobs + 2 bosses, keyed to the Fracture's own
rift-tier zone thresholds so combat visibly escalates in step with the story:

| Band | Zones | Theme | Example mobs | Bosses |
|---|---|---|---|---|
| Mortal Wilds | 1–4 | — | Demonic Wolf, Corpse Ghoul | Demon General, Ghost King |
| Rift-Touched | 5–9 | Minor Rifts begin | Rift-Touched Hound, Voidling Swarm | Rift Warden, Corrupted Elder |
| Deep Rift | 10–14 | Major Rifts begin | Hollow Sentinel, Jiutian Enforcer Drone | Jiutian Enforcer Captain, Colossus Prime |
| Void-Touched | 15–25 | Grand Rifts begin | Void Reaver, Fracture Abomination | Void Sovereign, The Unraveling |
| Uncounted Reaches | 26+ | Round 27, Act IV | Cartographer's Echo, Threshold Remnant | Boundless Surveyor, The Uncounted |

**Rift Guardians** — five named, one-time story bosses that override the
normal boss spawn at their exact zone (no RNG gate) until defeated once,
tying combat directly into the Act III/IV quest chains (§12). The two Round
27 additions carry an extra `after` gate (a prerequisite quest id, checked
in `Combat._guardianForZone()`) on top of the zone check — they can't be
encountered before Act III's finale (`threshold_crossed`) actually closes,
and First Voice can't be encountered before Cartographer's own defeat quest
completes:

| Guardian | Zone | Gate | Identity |
|---|---|---|---|
| The Ledger 📋 | 16 | zone only | A Jiutian Holdings audit-construct |
| The Hollow Choir 🎭 | 18 | zone only | Failed early attempts by "the Voice" to speak |
| Su Wan's Shadow 🕳️ | 20 | zone only | A corrupted echo of the mentor's own 300-year-old near-miss |
| The Cartographer 🗺️ | 24 | zone + `threshold_crossed` | Something that was surveying the Fracture before Jiutian existed |
| The First Voice 🔮 | 28 | zone + `guardian_cartographer_defeat` | The entity that taught "the Voice" (the game's `void` narrator) to speak |

### Artifacts / Gear — `artifacts.js`
**6 equipment slots**: `weapon`/`robe`/`talisman`/`ring` are free from the
start; `boots` (6,000 Spirit Stones) and `amulet` (20,000) are locked until
purchased via `Artifacts.unlockSlot()` — the game's first "spend to raise a
capacity" mechanic (everywhere else, caps like pet/technique/child slots are
flat constants). **5 rarities** (Common → Rare → Epic → Legendary → Mythic,
weighted roll) and **4 cosmetic item sets** (Azure Dragon, Vermilion Phoenix,
Black Tortoise, White Tiger) with 2-piece (+15% combat/+5% Qi) and 4-piece
(+45% combat/+15% Qi) bonuses that stack across sets. **Satchel cap: 40**,
auto-salvaging the weakest overflow on pickup.

- **Auto-Equip Best** — fills every unlocked slot with the highest-scoring
  bag candidate; **never downgrades** an already-equipped piece.
- **Bulk Salvage** — sell every bagged item below a chosen rarity threshold
  in one action, with a live preview of count/value before committing.

### Enchanting — `enchanting.js`
**5 rune types** (Swift Kill/atk, Resilience/hp, Qi Resonance/qi, Stone
Find/loot, Soul Brand/bossDmg), **max 3 per item** (a 4th roll replaces the
oldest). Cost scales with rarity and current rune count, paid in Blood
Essence. **Ancestral Heirloom**: designate one artifact as heirloom; it
gains an **Inheritance Stack** (max 5, +6% rune power each) every time you
reincarnate — stacks are permanent progress that survive both reincarnation
and salvaging the physical item, so re-designating a new heirloom keeps
prior stack progress. **Auto-Enchant** spends on whichever equipped piece is
currently cheapest to maximize total rolls per Blood Essence spent, with a
non-mutating preview.

### Blood (Jing) & Spirit (Shen) — `blood.js` / `spirit.js`
Two parallel permanent stat trees, both **uncapped-active** (every rank
bought stays permanently on, unlike Combat Techniques' equip cap):

| | Blood Essence (Jing) | Spirit (Shen) |
|---|---|---|
| Unlocks | combat unlocked | realm ≥4 (Nascent Soul) |
| Currency source | ~1% of mob power per kill | 0.2% of every Qi gain |
| Stats (4 each, max rank 20) | Tempered Flesh (atk), Iron Bones (hp), Vital Pulse (post-wave heal), Dragon's Blood (qi) | Lucid Clarity (qi), Foresight (tribulation success), Fortune's Eye (drop chance), Tranquil Mind (offline efficiency) |

### Combat Techniques — `techniques.js`
Distinct from the passive Qi techniques in `GameData.upgrades` (Arts tab).
**5 martial techniques**, rank 1–10, but only **3 may be equipped at once**
— forces a real build choice (e.g. Iron Body + Guardian's Ward for tanking
vs. Piercing Strike + Doom Strike for boss-burst): Iron Body Art (hp),
Piercing Strike (atk), Vital Drain (lifesteal), Guardian's Ward
(damage mitigation, capped 75%), Doom Strike (boss damage).

### Spirit Beasts — `pets.js`
**8 collectible beasts** across 5 rarities (Mortal → Divine). **Tame** with
Beast Eggs (gacha; a duplicate pull auto-levels instead of wasting the
roll). **Level** to a cap of 30 with Spirit Stones. **Star-evolve** (max 5
stars) once at max level for a further +50%/star. Every owned beast
contributes a passive Qi bond bonus; up to **3 active** beasts also fight
in Trials.

### Sects — `sect.js`
**5 sects**, each karma-gated (orthodox sects reject demonic-tier karma;
the demonic sect rejects righteous-tier) with a distinct bonus profile
(Azure Cloud Sword / Cinnabar Pill / Myriad Beast / Grand Void Talisman /
Blood Demon). Earn **Contribution** (passive + combat) to climb a **6-rank
ladder** (Outer Disciple → Sect Master), each rank worth +3% global Qi.
Joining a different sect forfeits your current Contribution (defection
penalty). Online cross-player sects are abstracted behind a swappable
`SectBackend` (`LocalBackend` ships with flavor NPC rosters; `CloudBackend`
is a stub — see `docs/SECT-ONLINE.md`).

### Sect Guild — `sectguild.js`
A per-sect **research tree**: 2 branches × 3 tiers = **30 nodes total**
across all 5 sects, tier-gated sequentially, paid in Contribution. Also a
5-item **Contribution Store** (Beast Eggs, Stones, a Sect Qi Pill, a
Mystery Artifact roll) and **Offerings** — a direct Spirit-Stones-or-Blood-
Essence → Contribution conversion. Shares an almost identical shape with
the Fracture Resonance Tree (see below) — both use the same tier-prereq +
`all`-stat-spread aggregation pattern.

### Celestial Fracture — `fracture.js`
The game's second meta-progression layer, wired directly into the main
story. **Resonance Tree**: 4 paths × 3 tiers = **12 nodes**, paid in
Stellar Shards — Void Combat, Stellar Qi, Fracture Harvest, Fate Weave (the
4th, priciest path spreads to `all` stats). Completing a full path grants an
extra **Path Mastery** bonus. **Tiered Rift events** trigger on boss clears
at zone thresholds: Minor (zone 5+, 15% chance, ×1.0 shards), Major (zone
10+, 12%, ×2.0), Grand (zone 15+, 10%, ×3.5). **4 Shard Investments** are
one-time permanent purchases (500–6,000 shards) for flat global bonuses.
Rift-sealing progress (`riftsSealed`/`majorRiftsSealed`/`grandRiftsSealed`)
also drives the Act I–III story quest chain (§12), and Round 26 added the
**Rift Guardians** — named story bosses inside Trials — as the connective
tissue between this system and combat.

### Pill Alchemy — Arts ▸ Alchemy
Brew 5 pills from Spirit Stones (`GameData.pills`): timed buffs (2×/3× Qi,
2× combat) and instants (Beast Egg, Foundation Pill = +25% of next stage
req). Buy quantity uses the same ×1/×5/MAX convention as the Shop and
Market; brewing/using more of the same pill extends its timer, a different
pill of the same kind stacks its multiplier on top.

### Secret Realm — World ▸ Realm
Once-daily expedition. Your **Combat Rating** (`playerAtk + 0.2×
playerHpMax`, including a Berserk pill buff) sets how many floors you clear.
Rewards scale with depth: Spirit Stones (compounding), a Beast Egg every 5
floors, Heavenly Merit every 10, **+50% on a new record**.

### Spirit Market — World ▸ Market
A ¥-sink with **4 tradeable goods** (Spirit Stones, Beast Egg, Breakthrough
Pill, Qi Infusion — the last grants 1 hour of Qi output instantly). Only
Spirit Stones sell back, at 70% of the current buy price. Prices random-walk
±10% every 60 seconds within a 0.55×–1.6× band around a base that itself
scales ×1.8 per realm reached — a genuine timing decision, not a flat shop.

### Boosters — World ▸ Boost
**4 stacking timed buffs** (Qi Surge, Loot Rush, Battle Fury, Lucky Star),
each lasting 5 minutes and extending (not resetting) on re-activation.
Activate via a rewarded ad (3 free/day per booster) or Spirit Stones (price
escalates 1.6× per same-day use of that booster).

### Achievements — World ▸ Feats
**31 milestone achievements** across 6 categories (Cultivation, Combat,
Spirit Stones, Spirit Beasts, Artifacts, Engagement), rewarding Spirit
Stones and/or Beast Eggs. Checked periodically; unlock and claim are
separate steps, some show a live progress bar.

---

## 11. Life Sim

### Study (Academy) — `life.js`
**Base ladder**: 5 courses (Self-Study → Immortal Institute), taken strictly
in order, raising **Talent** (cultivation speed), **Intellect** (salary),
**Charm** (romance).

**Elective grid** (unlocks once University-tier education is done): a
**4-path × 3-tier grid (12 nodes)**, deliberately mirroring the Fracture
Resonance Tree's shape — Cultivation Theory (talent), Qi Refinement Science
(global Qi), Business Studies (career pay rate), Arts & Diplomacy
(courtship affinity gain). Completing all 3 tiers of a path grants a
**mastery capstone** on top. Only one activity (base course or elective)
runs at a time; electives don't replace the base ladder, they extend it.

### Work (Career) — `life.js`
**5 jobs**, gated by education level, pay scaling with Intellect and
on-the-job level (+10%/level, capped at level 50). A shared **rank ladder**
(Trainee → Associate → Senior → Expert → Master) grants one-time pay
bonuses as you level within any job; reaching **Expert** unlocks a
permanent, per-job **Specialization** choice (The Climber: +25% pay: The
Connector: +12% pay + one-time Charm). **Per-job progress is remembered** —
switching jobs no longer resets level/rank/specialization; each job keeps
its own progress record, and returning to a previous job resumes exactly
where you left off.

Both Study and Work also fire rare active-play **skill-check events** with
risk/reward branching options.

### Romance & Family — `family.js`
Meet 4 base candidates (each with a procedurally generated encounter +
backstory), plus a 5th karma-flavored candidate if your alignment has
committed to Righteous or Demonic. Build **Affinity** via Chat / Date(¥200)
/ Gift(¥1K) — boosted by Charm and the Arts & Diplomacy elective. A rewarded
ad can summon a rare "Destined" partner. At 50 affinity a candidate becomes
primary; others decay and can depart. **Branching courtship scenes** fire at
25/50/75 affinity.

At 100 affinity, **propose**. Marriage tracks a separate **Bond** stat
(0–100, grown via "Spend Time Together" and 5 possible **spousal events**),
feeding up to +15% household cultivation as Bond approaches 100. After 8+
years married, a small per-check chance can **end the marriage** (a low-bond
departure or a high-bond peaceful passing), reopening courtship.

**Up to 6 children**: inherit the better parental Spiritual Root (with a
chance to ascend a tier) plus inherited traits, and progress through 4 life
stages (Infant → Child → Youth → Adult) on the same aging clock as the
player. At Youth+, choose one of 4 **career paths** (Cultivation / Scholar /
Dao trickle / Merchant ¥ trickle / Martial combat bonus). **Tutor** a child
(up to 5 levels) to boost the eventual heir's stats. Once Adult, a child can
be **arranged into marriage** — a lightweight, single-click system
deliberately distinct from the multi-step player romance flow (a flat cost,
no affinity grind, a small permanent household bonus per married-off child).

`Life.tick` also **ages** the cultivator (+1 year / 150s), gating some
hidden bonuses (e.g., Prodigy breakthrough at age ≤ 25).

---

## 12. Quests & Hidden Mechanics

### Quests — `quests.js`
**45 quests total**: **36 story** (ordered, chained), **5 achievement**
(standalone milestones), **4 hidden** (`desc: '???'` until discovered).
Completion is checked continuously; rewards (Qi/Dao/¥/Charm/Shards/
permanent %) are **claimed manually** from the Quest Log (📜), which shows a
progress bar, per-category counts, **Claim All**, and hides claimed quests.

**The story arc** is the game's main hand-authored narrative, delivered
almost entirely through this quest chain:

- **Onboarding chain (12 quests)** — the tutorial spine (meditate → first
  generator → first stage → first Tribulation → study → job → romance →
  marriage → Core Formation → Nascent Soul → Immortal Ascension), each
  narrated mostly by the mentor **Granny Su** 🍵.
- **Act I: Celestial Fracture (6 quests)** — Premonition → First Rift → Cold
  Calculations → The Voice Speaks → Fracture Spreads → Act I Ends Here.
  Introduces the antagonist **Lu Heng · Jiutian Holdings** 🏢 and the
  mystery entity **the Voice from the Fracture** 🔮.
- **Act II: Void Surge (6 quests)** — The Deepening → Ancient Memory →
  Escalation → Lu Heng's Gambit → Grand Collapse → Act II: Threshold.
  Escalates rift-sealing counts (10→30) and reveals Granny Su's own
  300-year-old near-miss with the Voice.
- **Act III: The Door (7 quests)** — delivered through combat: an
  intro/defeat dialogue pair for each of the three named Rift Guardians
  (§10), plus a finale ("The Door, Opened") gated on realm ≥8 and all three
  Guardians defeated, closing with a three-way dialogue from all three
  recurring characters.
- **Act IV: Beyond the Door (5 quests, Round 27)** — picks up exactly where
  Act III's finale left off (gated on `threshold_crossed`), continuing the
  same delivered-through-combat pattern for the two Round 27 Guardians (§10):
  an intro/defeat pair each for The Cartographer and The First Voice, then a
  closing quest ("Past Every Door There Is") once both are sealed. The First
  Voice reveals that "the Voice from the Fracture" — the recurring `void`
  narrator from Acts I-III — was itself taught by an older entity, giving
  that character a real origin instead of remaining a permanently mysterious
  guide.

**Dialogue delivery**: story quests can carry a `dialogue` array of
speaker-attributed lines. On completion, `UI.onQuestCompleted()` routes
these through `UI.showDialogue()` — a lightweight, auto-dismissing banner
(styled per speaker: mentor/antagonist/void), not a blocking modal — instead
of the plain toast used for non-narrative quest completions. Every dialogue
line and toast is also mirrored into the Chronicle (§14).

### Other hidden mechanics
- **Cultivation Insight** — 0.5% chance per meditate tap → 60s of 2× production.
- **Lucky 8888** — resonating at auspicious Qi values triggers a hidden reward.

---

## 13. Daily & Live Content

- **Daily Rewards (🎁):** a 7-day streak calendar (`GameData.dailyRewards`).
  Streak continues if you return the next day, resets if you miss one. Day 7
  is a gold finale (Heavenly Merit ×3). Auto-pops on launch when claimable;
  badge on the Daily button.
- **Daily Missions (World ▸ Dailies):** 5 missions/day, seeded
  deterministically from the date (identical for every player, reproducible)
  and drawn from a 7-template pool. Completing all 5 claims a **Cultivation
  Seal** (2× Qi for 2 hours). A **7-day streak** — which resets on any gap,
  including a gap on a day that was itself fully completed — unlocks a
  weekly chest (3 artifact rolls at realm+2 tier), then resets to start a
  fresh cycle.
- **Weekly Challenge (World ▸ Fracture-adjacent):** a single global modifier
  active for the whole week, deterministic by wall-clock week number (so
  the rotation is predictable, not random), drawn from an 8-template pool
  (Blood Frenzy, Spirit Surge, Stone Rush, Qi Flood, Trial of Steel, Beast
  Bounty, Dao Insight, Rune Resonance). A fixed once-per-week reward is
  claimable regardless of which modifier is active.
- **Karma / Life Events:** roughly every 4 minutes of active play there's a
  50% chance a moral-dilemma popup fires — 10 events total (6 general, 2
  Righteous-gated, 2 Demonic-gated), each with 2–3 branching options trading
  karma delta for resources. Karma sits on a −100..+100 scale with
  Righteous/Neutral/Demonic tiers at ±40, each carrying its own passive
  bonus (Righteous: +10% Qi/+10% offline/+5% tribulation chance; Demonic:
  +25% combat/+20% loot) and gating Sect membership + the 5th romance
  candidate.
- **Secret Realm:** the once-daily combat expedition (see §10).

---

## 14. UI & Navigation Map

**Top bar:** avatar, name, root chip, realm/stage, Age, Dao.
**Quick actions:** 🛒 Shop · 📜 Quests · 🎁 Daily.
**Currency strip:** Qi (+ /s), ¥, Stellar Shards, Cultivation %.
**Stage FABs (Cultivate tab):** Story/Chronicle 📖, plus quick-action shortcuts.

**Bottom nav (6 tabs):**
| Tab | `data-tab` | Sub-nav |
|---|---|---|
| 🧘 **Cultivate** | `cultivate` | — realm progress, breakthrough, meditate orb, ad boosts, generator shop |
| 🎓 **Study** | `study` | — Academy courses + elective grid |
| 💼 **Work** | `work` | — career / jobs |
| ❤️ **Life** | `life` | 💕 Partner · 🏛 Lineage (Ancestor Hall) |
| ⚔️ **World** | `world` | ⚔️ Trials · 🐉 Beasts · 📜 Skills · 🏯 Sect · ⚜️ Gear · 🏪 Market · 🌀 Realm · ⚡ Boost · 🏆 Feats · 📋 Dailies · 🌌 Fracture (11 subtabs) |
| 📜 **Arts** | `techniques` | 📜 Techniques · 🧬 Meridians · 🩸 Blood · 🌌 Spirit · ☁️ Heaven · ⚗️ Alchemy (6 subtabs) |

Per-realm **atmospheric backdrop** (themed gradient + drifting motes + painted
vista) cross-fades as you ascend; the meditate-orb aura & breakthrough flash
re-tint to the realm accent.

### Buy-quantity convention (×1 / ×5 / MAX)
Standardized across the Cultivate generator shop, Spirit Market, and
Alchemy: a fixed tier (×1/×5) always transacts exactly that count and the
action button disables if unaffordable; **MAX** computes the current
affordable count and buys/brews up to it. Sell/Use actions instead *clamp*
the fixed tier down to however many you actually own, rather than
disabling. Gear's bulk-salvage row reuses the same visual pattern for a
**rarity-tier selector** instead of a quantity picker — related styling,
different semantics.

### Chronicle event log (📖 Story)
A persisted, capped (300 entries) feed of *everything that's happened* —
`Game.state.eventLog`, newest-first. Populated automatically by hooking the
two central notification chokepoints (`toast()` and the dialogue advance
function) rather than each individual call site, so every toast and every
piece of quest dialogue is captured game-wide with zero per-call-site work,
past and future. Opened via the Story FAB on the Cultivate tab; shows
relative timestamps ("5m ago", "3h ago").

- **`UI.toast(msg)`** — plain single-line, auto-dismissing, queued
  sequentially. Used for the overwhelming majority of feedback.
- **`UI.showDialogue(entries)`** — speaker-attributed, richer banner, used
  only for quest narrative dialogue; queued independently of toasts,
  click-to-dismiss or auto-dismiss scaled to text length.

### Onboarding: tutorial + progressive feature unlocks (`onboarding.js`)

New players start with **only the Cultivate tab**; everything else reveals
itself as state-based milestones are hit, each with a celebration (modal for
tabs, toast for quick-actions) and a pulsing **NEW** dot until first visited:

| Feature | Unlocks when |
|---|---|
| 📜 Quests (quick action) | first generator owned |
| 🎓 Study | first minor stage cleared |
| 💼 Work | first course completed (education ≥ 1) |
| 📜 Arts | 250 lifetime Qi |
| ⚔️ World | combat unlocked (`Game.combatUnlocked()`) |
| ❤️ Life · 🛒 Shop · 🎁 Daily | first major breakthrough (realm ≥ 1) |

A **guided tutorial** (non-blocking spotlight + tooltip, skippable) walks the
first minutes: meditate → buy a generator → advance a stage → first
Tribulation. A one-time **contextual hint** explains the Breakthrough-Pill
gate when it first appears at the Foundation Establishment tribulation.

Progress persists in `state.onboarding` (`unlocked/seen/steps/hints/skipped`).
Saves created before this system are **grandfathered**: everything unlocks
silently. Conditions are pure functions of state — add a feature by
appending to `Onboarding.FEATURES`. Headless test: `node tools/test-onboarding.mjs`.

---

## 15. Save State Schema

Saved to `localStorage` under `GameData.saveKey` (`xianxia_idle_save_v2`,
`version: 7`). Migrations are additive — `Game.init()` backfills any missing
field, so old saves load safely, with `R<N> migration:` comments in the code
tracing which round added which field. Fields returned directly by
`Game.newState()`:

```js
{
  version, characterCreated, name, gender, spiritualRoot,
  qi, lifetimeQi, runQi, owned{genId:n}, upgrades{id:true},
  realm, stage, stagesCleared, daoComprehension,
  spiritStones, beastEggs, sect{id,contribution,joinedAt}|null,
  pets{owned:{id:{level}}, active:[ids]},
  techniques{owned:{id:rank}, active:[ids]},           // max 3 active
  blood{essence, refine:{id:rank}},                    // Jing
  spirit{essence, insight:{id:rank}},                  // Shen, realm-gated
  combat{zone, wave, highestZone, playerHp, paused},
  lastSaved, createdAt,
  permanentDouble, qiBoostEndsAt,                       // monetization
  questPermanentBonus, insightEndsAt, foundationBonuses[],
  freeRollsLeft, milestonesUnlocked[], packProductionBonus, breakthroughConditionsHit[],
  meridians{id:true},
  heavenlyMerit, heavenlyPerks{id:lvl}, reincarnations,
  breakthroughPills, generation, legacyBonus,
  lineage[{generation,name,root,realmReached,spouseName,childCount,heirName,endedAtAge}],
  houseReputation, daoPath, traits, karma, eventAcc, combatBuffEndsAt,
  tutorialDone, dailyStreak, lastDailyDay,               // 7-day daily-reward calendar
  pillBag{id:n}, buffs[{buff,mult,endsAt}], secretRealm{lastRunDay,highestFloor},
  artifacts{ inventory:[], equipped:{weapon,robe,talisman,ring,boots,amulet}, unlockedSlots:[] },
  heirloom{id, stacks},
  weeklyChallenge{weekId, claimed},
  boosters{ id:{endsAt,adsToday,stonesToday,day} },
  sectGuild{research:{}},
  stellarShards, fracture{ resonance:{}, riftsSealed, majorRiftsSealed,
                            grandRiftsSealed, investments:{}, guardiansDefeated:{} },
  achievements{id:claimed},
  lifetimeKills, lifetimeBossKills, lifetimeStones, lifetimeBoosterActivations,
  dailies{ day, missions:[], allComplete, sealClaimed, sealEndsAt, streak, weekReady, weekClaimed },
  market,                                                // populated by Market.init()
  onboarding{ ready, unlocked:{}, seen:{}, steps:{}, hints:{}, skipped },
  totalTaps,
  eventLog[],                                            // Chronicle, capped at 300
  maxSeenTime, cheatFlags                                // anti-cheat
}
```

**Lazily-added fields** (not in `newState()`'s literal, but added by each
system's own `init()`/`fresh()` on first boot, so present on every real
save): `life` (`Life.fresh()` — money, age, stats, study, jobId,
`jobProgress{}`, electives), `family` (`Family.fresh()` — candidates,
spouse, children, childCooldown), `quests` (`Quests.fresh()` — completed,
claimed, hidden-mechanic counters), `market` (`Market.fresh()` — prices,
trend, lastDrift).

**Offline & anti-cheat (`game.js`):** earnings capped at 8h at 50%
efficiency (raised by offline techniques/sect/Spirit). Backward clock jumps
beyond a 60s grace are flagged and grant nothing; `maxSeenTime` is sticky.

**Rough chronology by round** (from migration-tag comments): R2 meridians ·
R3 reincarnation/perks/daily streak · R4 pill alchemy/secret realm · R5 Dao
Path/karma/events · R6 artifacts base · R7 heirloom/weekly challenge · R8
market · R9 boosters · R11 achievements/dailies/lifetime counters · R12 sect
guild · R13 Fracture Act I · R14 Fracture Act II · R15 family depth · R17
Academy/Career electives · R18 per-job progress restructure · R23 artifact
boots/amulet slots + auto-equip/salvage · R25 Chronicle event log · R26
Fracture Act III (Rift Guardians) + combat zone bands · R27 Act IV (2 more
Guardians, 5th zone band) + 3 new Heavenly Perks (2 Guardian-gated, 1 that
raises the per-life reincarnation rate itself).

---

## 16. Monetization

`monetization.js` is the single integration point. **Simulated in the browser**
(confirm dialogs) and real via Capacitor plugins on device.
- **Ads (AdMob):** rewarded (2× Qi boost, Stage Aid, Destined partner,
  booster activations) + interstitial (every 3rd breakthrough). Test ad
  units used while `AD_CONFIG.useLiveAds = false` — **keep false in dev** to
  avoid bans.
- **IAP:** `remove_ads` ($10.99), `permanent_double` ($4.99), `qi_pouch_small`,
  and 5 spirit-root packs ($2.99–$19.99). Grant logic in `Monetization._grant`.

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

All in `gameData.js` unless noted — change these to re-tune without touching
logic.

| Constant | Value | Meaning |
|---|---|---|
| `tap.baseGain` | 1 | Qi per meditate tap (pre-mult) |
| `offline.maxSeconds` | 28,800 | offline cap (8h) |
| `offline.efficiency` | 0.5 | base offline rate |
| generator `costGrowth` | 1.16 | per-unit cost growth, all 15 generators |
| `genMilestones` | 10…2,000 | 13 ownership milestone thresholds |
| `genMilestoneMult` | 1.8 | × per milestone crossed |
| `synergyThreshold` | 25 | "mastered" owned count |
| `synergyBonusPer` | 0.11 | +11% global per mastered generator |
| `stageBonusPerStage` | 0.045 | +4.5% per stage cleared |
| `daoBonusPerPoint` | 0.018 | +1.8% global per Dao |
| `realmBonusPerLevel` | 0.07 | +7% global per realm index |
| `daoGainFor` | `floor((lifetimeQiThisRun/1e4)^0.22)` | Dao per breakthrough |
| `reincarnationRealmReq` | 9 | realm index to reincarnate |
| `reincarnationBonusPer` | 0.10 | +10% production per past life |
| `meridianCritMult` | 10 | crit tap multiplier |
| `MAX_RUNES` (enchanting.js) | 3 | runes per equipped item |
| `MAX_HEIRLOOM_STACKS` (enchanting.js) | 5 | +6%/stack rune power |
| `MAX_ACTIVE_TECHNIQUES` (techniques.js) | 3 | equipped combat techniques |
| `MAX_ACTIVE_PETS` (pets.js) | 3 | beasts fighting in Trials |
| `MAX_CHILDREN` (family.js) | 6 | household cap |

> **Round 22 rebalance note**: `costGrowth`, `genMilestoneMult`,
> `stageBonusPerStage`, `daoBonusPerPoint`, `realmBonusPerLevel`, and
> `synergyBonusPer` were all trimmed together in one pass in response to the
> economy feeling "a bit fast." The first draft (measured at a representative
> mid-game state) cut Qi/s by ~58% and raised costs ~2.4×, which was judged
> too severe for the feedback given — the shipped values land at ~35%
> Qi/s reduction and ~54% cost increase at the same reference state.

Content counts: **15 generators** · 15 passive techniques (Arts tab) · 5
combat Techniques (max 3 equipped) · 10 realms · 5 roots · 5 spirit-root
packs · 17 stage milestones · 4 breakthrough conditions · 4 foundation
tiers · 3 meridian paths / 15 nodes · 9 heavenly perks (2 Guardian-gated) ·
7 daily rewards · 5 pills · 8 beasts · 5 sects (30 Sect Guild research
nodes) · 4 Fracture Resonance paths / 12 nodes · 4 Shard Investments · 5
courses · 4 elective paths / 12 nodes · 5 jobs · 6 equipment slots · 5
artifact rarities · 4 artifact sets · 5 rune types · 5 zone bands · 5 Rift
Guardians · **45 quests** (36 story / 5 achievement / 4
hidden) · 31 achievements · 10 karma life events · 8 weekly-challenge
templates · 4 boosters.

---

## 19. How to Extend

All content is data-driven; the UI iterates the arrays, so adding entries is
usually a `gameData.js`-only change (or the matching system file's own data
constant, for the newer systems that keep their tables local — e.g.
`GUARDIANS`/`MOB_BANDS` in `combat.js`, `RUNE_TYPES` in `enchanting.js`).

- **New generator:** add to `GameData.generators` (id, name, icon, baseCost,
  costGrowth, baseProd, desc, optional `reqRealm`). Add an SVG sprite
  `#ic-<id>` or it shows a blank icon tile.
- **New passive technique:** push to `GameData.upgrades` with an `effect(m)`
  that mutates `tapMult` / `allMult` / `offlineBonus`. Auto-renders in
  Arts ▸ Techniques.
- **New realm:** add to the `realms` array (name, reqQi, stages). Add a
  `#app[data-realm="N"]` theme block in `styles.css` and a `realm-N.jpg` vista.
- **New meridian node / heavenly perk / pill / daily reward / sect / beast /
  course / job / elective / quest / achievement:** add to the matching
  `GameData` array (or the system's own data constant) — each renderer
  iterates it.
- **New Rift Guardian / zone band:** extend `GUARDIANS`/`MOB_BANDS` in
  `combat.js`; give the Guardian an `intro`/`defeat` quest pair in
  `quests.js` gated on `Game.state.fracture.guardiansDefeated.<id>`, and a
  distinct icon key in `UI._mobEmoji`.
- **New multiplier source:** compute it in `Game.multipliers()` (Qi) or
  `Combat.playerAtk()`/`playerHpMax()` (combat) and fold into the
  appropriate power vector so `qiPerSecond`/`qiPerTap`/combat power pick it up.

**Regression testing**: this project uses hand-rolled Node smoke tests
(`smoke5.js`…`smoke24.js` at the repo root), not a test framework — each
`eval()`s the relevant `www/js/*.js` source with minimal stubs. Run the full
suite plus `node --check www/js/*.js` before considering any change done;
see `CLAUDE.md` for the exact convention, plus its guidance on reproducing
live-gameplay bugs with Playwright when a fix needs empirical (not just
unit) verification.

After any `www/` change for mobile: `npx cap sync android` then rebuild.

---

## 20. Related Docs
- `CLAUDE.md` — dev-session notes: Android build limitations in sandboxed
  environments, the smoke-test regression convention, live-gameplay-bug
  reproduction guidance (Playwright, viewport/numeric-scale sweeps)
- `docs/LOCAL-SETUP.md` — local dev + ComfyUI setup
- `docs/CHARACTER-ART.md` — portrait art details
- `docs/ADMOB-SETUP.md` — native ad/IAP wiring
- `docs/SECT-ONLINE.md` — enabling real cross-player sects
- `docs/STORE-CHECKLIST.md` — Play Store / App Store submission
- `docs/privacy-policy.md` — privacy policy (host before submitting)
- `docs/BALANCE.md` — deeper balance-tuning notes
- `README.md` — quick start
