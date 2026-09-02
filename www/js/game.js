/* ===========================================================================
 * game.js — Core game engine: state, economy, tick loop, offline progress,
 * breakthroughs (prestige). Theme-agnostic logic driven by gameData.js.
 * ========================================================================= */

const Game = {
  state: null,
  _lastTickMono: 0,      // monotonic timestamp of last tick (ms)
  _saveAccumulator: 0,   // seconds since last autosave
  // Focus combo (Round 16): purely active/session state, never persisted —
  // any reload implies more than focusWindowMs passed, so it should reset.
  _focusCombo: 0,
  _lastTapMono: 0,

  // -------------------------------------------------------------------------
  // State setup
  // -------------------------------------------------------------------------
  newState() {
    const owned = {};
    GameData.generators.forEach(g => { owned[g.id] = 0; });
    return {
      version: GameData.saveVersion,
      // Character (set during creation).
      characterCreated: false,
      name: 'Nameless Cultivator',
      gender: 'male',
      spiritualRoot: GameData.spiritualRoots[0], // {key,name,mult,...}

      qi: 0,
      lifetimeQi: 0,        // total Qi earned across ALL runs (stats)
      runQi: 0,             // total Qi earned THIS run (drives breakthrough)
      owned,
      upgrades: {},         // id -> true
      realm: 0,             // major realm index into GameData.realms
      stage: 0,             // minor stage index within the current realm
      stagesCleared: 0,     // lifetime count of minor breakthroughs (Cultivation Base)
      daoComprehension: 0,  // prestige currency (permanent multiplier)

      // -- RPG systems --------------------------------------------------
      spiritStones: 0,      // combat currency (level pets, sect shop)
      beastEggs: 0,         // tame spirit beasts
      sect: null,           // { id, contribution, joinedAt } or null
      pets: { owned: {}, active: [] },           // owned: {id:{level}}, active:[ids]
      techniques: { owned: {}, active: [] },     // owned: {id:rank}, active:[ids] (max 3 equipped)
      blood: { essence: 0, refine: {} },         // Blood Essence (Jing): refine:{id:rank}
      spirit: { essence: 0, insight: {} },       // Spirit (Shen): insight:{id:rank}, realm-gated
      combat: { zone: 1, wave: 1, highestZone: 1, playerHp: null, paused: false },
      lastSaved: TimeService.now(),
      createdAt: TimeService.now(),
      // Monetization flags
      permanentDouble: false,  // set true after "permanent_double" IAP
      qiBoostEndsAt: 0,        // wall-clock ms; 2× production while active

      // Quest / hidden mechanic state
      questPermanentBonus: 0,  // sum of all permanent bonuses from quest rewards
      insightEndsAt: 0,        // wall-clock ms; 2× production during Cultivation Insight
      foundationBonuses: [],   // [{ realm, bonus }] from quality breakthroughs

      // Gacha system state
      freeRollsLeft: 100,      // 100 free spirit-root rolls at start
      milestonesUnlocked: [],  // stage numbers whose milestone bonus has been claimed
      packProductionBonus: 0,  // permanent production % from spirit-root packs
      breakthroughConditionsHit: [], // ids of hidden conditions triggered

      // Auto-Runner (Round 30): hands-off core-grind automation — see autorunner.js.
      autoRunner: { enabled: false },

      // Chosen portrait id from GameData.portraitCatalog (Round 32).
      // null = auto (derive from gender × spirit root, as before).
      chosenPortraitId: null,

      // Meridian tree (Round 2): id -> true for each opened node.
      meridians: {},

      // Reincarnation / Heavenly Dao (Round 3)
      heavenlyMerit: 0,        // meta-currency, persists across lives
      heavenlyPerks: {},       // perk id -> level
      reincarnations: 0,       // number of past lives

      // Progression 2.0: tribulation pills + bloodline generations
      breakthroughPills: 0,    // consumables for tribulation attempts (bought with ¥)
      generation: 1,           // which generation of the bloodline is playing
      legacyBonus: 0,          // permanent multiplier accumulated from past lives

      // Family depth (Round 15): Ancestor Hall lineage log + house reputation
      lineage: [],             // [{generation, name, root, realmReached, spouseName, childCount, heirName, endedAtAge}]
      houseReputation: 0,      // slow-growing prestige stat from generational milestones

      // Depth (Round 5): Dao Path, inherited traits, karma & life events
      daoPath: null,           // chosen path id (locked for this life)
      traits: [],              // innate traits inherited from being born an heir
      karma: 0,                // Righteous(+) / Demonic(−) alignment
      eventAcc: 0,             // seconds accumulated toward the next life event
      combatBuffEndsAt: 0,     // wall-clock ms; +50% combat while active
      tutorialDone: false,     // first-session onboarding shown

      // Daily rewards (Round 3)
      dailyStreak: 0,          // consecutive days claimed
      lastDailyDay: null,      // YYYY-MM-DD string of last claim

      // Pill Alchemy + Secret Realm (Round 4)
      pillBag: {},             // pill id -> count owned
      buffs: [],               // [{ buff, mult, endsAt }]
      secretRealm: { lastRunDay: null, highestFloor: 0 },

      // Artifacts / equipment (Round 6; boots/amulet + unlockedSlots Round 23)
      artifacts: { inventory: [], equipped: { weapon: null, robe: null, talisman: null, ring: null, boots: null, amulet: null }, unlockedSlots: [] },

      // Ancestral Heirloom (Round 7)
      heirloom: { id: null, stacks: 0 },

      // Weekly Cultivation Challenge (Round 7)
      weeklyChallenge: { weekId: 0, claimed: false },

      // Cultivation Boosters (Round 9): id -> { endsAt, adsToday, stonesToday, day }
      boosters: {},

      // Sect Guild: research tree (Round 12)
      sectGuild: { research: {} },

      // Celestial Fracture (Round 13)
      stellarShards: 0,
      fracture: { resonance: {}, riftsSealed: 0, guardiansDefeated: {} },

      // Achievements + Daily Missions (Round 11)
      achievements: {},
      lifetimeKills: 0,
      lifetimeBossKills: 0,
      lifetimeStones: 0,
      lifetimeBoosterActivations: 0,
      dailies: { day: null, missions: [], allComplete: false, sealClaimed: false, sealEndsAt: 0, streak: 0, weekReady: false, weekClaimed: false },

      // Market (Round 8): drifting prices
      market: null,

      // Onboarding: progressive feature unlocks + guided tutorial progress
      onboarding: { ready: false, unlocked: {}, seen: {}, steps: {}, hints: {}, skipped: false },

      totalTaps: 0,                  // lifetime meditate taps (stats)

      // Chronicle (Round 25): a persisted, readable feed of everything that
      // has happened — every toast and story-dialogue line, newest first.
      // Capped at EVENT_LOG_CAP (see UI._logEvent) so the save can't grow
      // unbounded over a long playthrough.
      eventLog: [],

      // Anti-cheat audit fields:
      maxSeenTime: TimeService.now(), // highest wall-clock ever observed
      cheatFlags: 0,                  // count of suspicious backward jumps
    };
  },

  init(loaded) {
    this.state = loaded || this.newState();
    // A malformed/partial save (or a save from a build predating `owned`)
    // must self-heal here rather than crash the generator backfill below.
    if (!this.state.owned || typeof this.state.owned !== 'object' || Array.isArray(this.state.owned)) {
      this.state.owned = {};
    }
    // Backfill any new generators / fields added in updates.
    GameData.generators.forEach(g => {
      if (this.state.owned[g.id] === undefined) this.state.owned[g.id] = 0;
    });
    if (!this.state.upgrades) this.state.upgrades = {};
    // realm is dereferenced unguarded all over the codebase (currentRealm(),
    // lifespan(), combat scaling…) and that lookup happens OUTSIDE this
    // module's own try/catch boot recovery (main.js's UI.init() runs after
    // it) — a missing/invalid realm here would crash the whole app with no
    // fallback at all, not just trigger a save wipe.
    if (this.state.realm == null || isNaN(this.state.realm) || !GameData.realms[this.state.realm]) this.state.realm = 0;
    if (this.state.stage === undefined) this.state.stage = 0;
    if (this.state.stagesCleared === undefined) this.state.stagesCleared = 0;
    if (this.state.characterCreated === undefined) this.state.characterCreated = false;
    if (!this.state.spiritualRoot) this.state.spiritualRoot = GameData.spiritualRoots[0];
    // Old saves stored the root as a string key — resolve to the object.
    if (typeof this.state.spiritualRoot === 'string') {
      this.state.spiritualRoot = GameData.spiritualRoots.find(r => r.key === this.state.spiritualRoot) || GameData.spiritualRoots[0];
    }
    if (this.state.spiritStones === undefined) this.state.spiritStones = 0;
    if (this.state.beastEggs === undefined) this.state.beastEggs = 0;
    if (this.state.sect === undefined) this.state.sect = null;
    if (!this.state.pets) this.state.pets = { owned: {}, active: [] };
    if (!this.state.techniques) this.state.techniques = { owned: {}, active: [] };
    if (!this.state.blood) this.state.blood = { essence: 0, refine: {} };
    if (!this.state.spirit) this.state.spirit = { essence: 0, insight: {} };
    if (!this.state.combat) this.state.combat = { zone: 1, wave: 1, highestZone: 1, playerHp: null, paused: false };
    if (this.state.permanentDouble === undefined) this.state.permanentDouble = false;
    if (this.state.qiBoostEndsAt === undefined) this.state.qiBoostEndsAt = 0;
    if (this.state.questPermanentBonus === undefined) this.state.questPermanentBonus = 0;
    if (this.state.insightEndsAt === undefined) this.state.insightEndsAt = 0;
    if (!this.state.foundationBonuses) this.state.foundationBonuses = [];
    if (this.state.freeRollsLeft === undefined) this.state.freeRollsLeft = 100;
    if (!this.state.milestonesUnlocked) this.state.milestonesUnlocked = [];
    if (this.state.packProductionBonus === undefined) this.state.packProductionBonus = 0;
    if (!this.state.breakthroughConditionsHit) this.state.breakthroughConditionsHit = [];
    if (!this.state.autoRunner) this.state.autoRunner = { enabled: false };
    if (this.state.autoRunner.enabled === undefined) this.state.autoRunner.enabled = false;
    if (this.state.chosenPortraitId === undefined) this.state.chosenPortraitId = null;
    if (!this.state.meridians) this.state.meridians = {};
    if (this.state.heavenlyMerit === undefined) this.state.heavenlyMerit = 0;
    if (!this.state.heavenlyPerks) this.state.heavenlyPerks = {};
    if (this.state.reincarnations === undefined) this.state.reincarnations = 0;
    if (this.state.breakthroughPills === undefined) this.state.breakthroughPills = 0;
    // Anti-cheat high-water mark: every site that's supposed to raise it uses
    // a strict `>` comparison against the field itself (tick()/persist()),
    // and `x > undefined` is always false — so a save missing this field
    // (pre-anti-cheat, or hand-edited) could never set it, silently
    // defeating the "sticky" clock-rollback guard applyOffline() relies on.
    if (this.state.maxSeenTime === undefined) this.state.maxSeenTime = TimeService.now();
    if (this.state.cheatFlags  === undefined) this.state.cheatFlags  = 0;
    if (this.state.generation === undefined) this.state.generation = 1;
    if (this.state.legacyBonus === undefined) this.state.legacyBonus = 0;
    if (!Array.isArray(this.state.lineage)) this.state.lineage = [];
    if (this.state.houseReputation === undefined) this.state.houseReputation = 0;
    if (this.state.daoPath === undefined) this.state.daoPath = null;
    if (!this.state.traits) this.state.traits = [];
    if (this.state.karma === undefined) this.state.karma = 0;
    if (this.state.eventAcc === undefined) this.state.eventAcc = 0;
    if (this.state.combatBuffEndsAt === undefined) this.state.combatBuffEndsAt = 0;
    if (this.state.tutorialDone === undefined) this.state.tutorialDone = false;
    if (this.state.dailyStreak === undefined) this.state.dailyStreak = 0;
    if (this.state.lastDailyDay === undefined) this.state.lastDailyDay = null;
    if (!this.state.pillBag) this.state.pillBag = {};
    if (!this.state.buffs) this.state.buffs = [];
    if (!this.state.secretRealm) this.state.secretRealm = { lastRunDay: null, highestFloor: 0 };
    if (!this.state.artifacts) this.state.artifacts = { inventory: [], equipped: { weapon: null, robe: null, talisman: null, ring: null, boots: null, amulet: null }, unlockedSlots: [] };
    // Round 23: backfill sub-fields individually — a save that already had
    // `artifacts` (so the line above didn't fire) predates boots/amulet and
    // must not crash on the missing equipped.boots/.amulet keys or the
    // missing unlockedSlots array.
    if (this.state.artifacts.equipped.boots === undefined) this.state.artifacts.equipped.boots = null;
    if (this.state.artifacts.equipped.amulet === undefined) this.state.artifacts.equipped.amulet = null;
    if (!this.state.artifacts.unlockedSlots) this.state.artifacts.unlockedSlots = [];
    if (!this.state.heirloom) this.state.heirloom = { id: null, stacks: 0 };
    if (!this.state.weeklyChallenge) this.state.weeklyChallenge = { weekId: 0, claimed: false };
    if (!this.state.boosters) this.state.boosters = {};
    // R12 migration: sect guild research state
    if (!this.state.sectGuild) this.state.sectGuild = { research: {} };
    if (!this.state.sectGuild.research) this.state.sectGuild.research = {};
    // R13 migration: Celestial Fracture state
    if (this.state.stellarShards === undefined) this.state.stellarShards = 0;
    if (!this.state.fracture) this.state.fracture = { resonance: {}, riftsSealed: 0 };
    if (!this.state.fracture.resonance) this.state.fracture.resonance = {};
    if (this.state.fracture.riftsSealed === undefined) this.state.fracture.riftsSealed = 0;
    // R14 migration: tiered rift counters + investments
    if (this.state.fracture.majorRiftsSealed === undefined) this.state.fracture.majorRiftsSealed = 0;
    if (this.state.fracture.grandRiftsSealed === undefined) this.state.fracture.grandRiftsSealed = 0;
    if (!this.state.fracture.investments) this.state.fracture.investments = {};
    delete this.state.fracture.lastRiftTierKey; // transient log data, no longer persisted
    // R26 migration: Act III Rift Guardians
    if (!this.state.fracture.guardiansDefeated) this.state.fracture.guardiansDefeated = {};
    // R11 migrations: achievements + daily missions + lifetime counters
    if (!this.state.achievements) this.state.achievements = {};
    if (this.state.lifetimeKills              === undefined) this.state.lifetimeKills              = 0;
    if (this.state.lifetimeBossKills          === undefined) this.state.lifetimeBossKills          = 0;
    if (this.state.lifetimeStones             === undefined) this.state.lifetimeStones             = 0;
    if (this.state.lifetimeBoosterActivations === undefined) this.state.lifetimeBoosterActivations = 0;
    if (!this.state.dailies) this.state.dailies = { day: null, missions: [], allComplete: false, sealClaimed: false, sealEndsAt: 0, streak: 0, weekReady: false, weekClaimed: false };
    if (this.state.dailies.weekReady  === undefined) this.state.dailies.weekReady  = false;
    if (this.state.dailies.weekClaimed=== undefined) this.state.dailies.weekClaimed= false;
    // R28 migration: under the current code weekClaimed is only ever set true
    // then immediately false again within the SAME claimWeekReward() call
    // (see dailies.js) — it should never be observably true in a persisted
    // save. A save from before that reset was added (the original bug: it
    // set weekClaimed=true and never reset it) can still carry a stuck
    // `true`, which permanently blocks the 7-day chest with no in-game way
    // to recover (weekReady can never be re-armed while weekClaimed is
    // true, and claiming requires weekReady). Safe to force-clear.
    if (this.state.dailies.weekClaimed === true) this.state.dailies.weekClaimed = false;
    // R10 migration: clear orphaned heirloom id from saves where the artifact was salvaged
    if (this.state.heirloom && this.state.heirloom.id) {
      const s = this.state.artifacts;
      const hlId = this.state.heirloom.id;
      const exists = s && (Object.values(s.equipped).some(a => a && a.id === hlId) || s.inventory.some(a => a.id === hlId));
      if (!exists) this.state.heirloom.id = null;
    }
    if (window.Market) Market.init();
    if (!this.state.onboarding) this.state.onboarding = { ready: false, unlocked: {}, seen: {}, steps: {}, hints: {}, skipped: false };
    if (this.state.totalTaps === undefined) this.state.totalTaps = 0;
    if (!Array.isArray(this.state.eventLog)) this.state.eventLog = [];
    // Numeric null-guards: old saves could store null instead of 0.
    if (this.state.qi == null || isNaN(this.state.qi)) this.state.qi = 0;
    if (this.state.lifetimeQi == null || isNaN(this.state.lifetimeQi)) this.state.lifetimeQi = 0;
    if (this.state.money == null || isNaN(this.state.money)) this.state.money = 0;
    if (this.state.runQi == null || isNaN(this.state.runQi)) this.state.runQi = 0;
    if (this.state.daoComprehension == null || isNaN(this.state.daoComprehension)) this.state.daoComprehension = 0;
    // Life field migrations: age added after initial life system shipped.
    if (this.state.life && this.state.life.age === undefined) this.state.life.age = GameData.aging.startAge;
    if (this.state.life && this.state.life.age === null) this.state.life.age = GameData.aging.startAge;
    // jobId renamed from job in older saves.
    if (this.state.life && this.state.life.jobId === undefined) {
      this.state.life.jobId = this.state.life.job || null;
      delete this.state.life.job;
    }
    this._lastTickMono = TimeService.monotonicNow();
  },

  /** Finalise character creation. */
  createCharacter(gender, name, root, packBonus) {
    this.state.gender = (gender === 'female') ? 'female' : 'male';
    this.state.name = (name && name.trim()) ? name.trim().slice(0, 20) : 'Nameless Cultivator';
    this.state.spiritualRoot = root || GameData.rollSpiritualRoot('free');
    if (packBonus) this.state.packProductionBonus = (this.state.packProductionBonus || 0) + packBonus;
    this.state.characterCreated = true;
    this.persist();
  },

  genderInfo() { return GameData.genders[this.state.gender] || GameData.genders.male; },

  // -------------------------------------------------------------------------
  // Depth (Round 5): Dao Paths, trait/path modifiers, karma & life events
  // -------------------------------------------------------------------------
  _MULT_KEYS: ['qi','combat','money','family','charm','courseCost','pillCost','tap','trialQi','stageCost','childCd'],
  _ADD_KEYS:  ['tribChance','lifespan','offline','talentGain','luck'],

  currentPath() { return this.state.daoPath ? GameData.daoPaths.find(p => p.id === this.state.daoPath) : null; },
  canChoosePath() { return !this.state.daoPath && this.state.realm >= GameData.daoPathRealmReq; },
  choosePath(id) {
    if (!this.canChoosePath()) return false;
    if (!GameData.daoPaths.some(p => p.id === id)) return false;
    this.state.daoPath = id;
    this.persist();
    return true;
  },
  _trait(id) { return GameData.traits.find(t => t.id === id); },

  /** Combined Dao-Path + inherited-trait + spouse-trait modifiers. */
  activeMods() {
    const out = {};
    this._MULT_KEYS.forEach(k => out[k] = 1);
    this._ADD_KEYS.forEach(k => out[k] = 0);
    const apply = mods => {
      if (!mods) return;
      for (const k in mods) {
        if (this._MULT_KEYS.includes(k)) out[k] *= mods[k];
        else if (this._ADD_KEYS.includes(k)) out[k] += mods[k];
      }
    };
    const p = this.currentPath(); if (p) apply(p.mods);
    (this.state.traits || []).forEach(id => { const t = this._trait(id); if (t) apply(t.mods); });
    const sp = this.state.family && this.state.family.spouse;
    if (sp && sp.traits) sp.traits.forEach(id => { const t = this._trait(id); if (t) apply(t.mods); });
    return out;
  },
  modVal(key) { return this.activeMods()[key]; },

  /** External combat multiplier (path + traits + duel buff) read by Combat. */
  combatExternalMult() {
    const buff = (this.state.combatBuffEndsAt && TimeService.now() < this.state.combatBuffEndsAt) ? 1.5 : 1;
    const gear = window.Artifacts ? Artifacts.combatMult() : 1; // artifact set bonuses
    const tech = window.Techniques ? Techniques.atkMult() : 1; // equipped technique bonuses
    const blood = window.Blood ? Blood.atkMult() : 1; // Blood Essence body refinement
    const rune = window.Enchanting ? Enchanting.atkMult() : 1; // rune enchanting bonuses
    return this.modVal('combat') * buff * gear * tech * blood * rune * (this.karmaMods().combat || 1);
  },
  /** Flat combat stats from equipped artifacts (read by Combat). */
  gearAtk() { return window.Artifacts ? Artifacts.atk() : 0; },
  gearHp()  { return window.Artifacts ? Artifacts.hp() : 0; },
  /** HP multiplier from equipped techniques (read by Combat). */
  hpExternalMult() {
    return (window.Techniques ? Techniques.hpMult() : 1) * (window.Blood ? Blood.hpMult() : 1) * (window.Enchanting ? Enchanting.hpMult() : 1);
  },
  moneyMult() { return this.modVal('money'); },

  // -- Karma & life events --------------------------------------------------
  karmaTier() {
    const k = this.state.karma || 0;
    if (k >= GameData.karma.righteousAt) return 'righteous';
    if (k <= GameData.karma.demonicAt) return 'demonic';
    return 'neutral';
  },
  addKarma(d) {
    this.state.karma = Math.max(GameData.karma.min, Math.min(GameData.karma.max, (this.state.karma || 0) + d));
  },
  /** Passive bonuses from the current karma tier (read by multipliers/combat). */
  karmaMods() {
    return GameData.karma.tierBonus[this.karmaTier()] || GameData.karma.tierBonus.neutral;
  },
  karmaLootMult() { return this.karmaMods().loot || 1; },
  /** Apply a life-event option's effects (mutates state). */
  applyEventEffects(eff) {
    if (!eff) return;
    if (eff.money && this.state.life) this.state.life.money = Math.max(0, this.state.life.money + eff.money);
    if (eff.talent && this.state.life) this.state.life.talent += eff.talent;
    if (eff.qiPct) this.state.questPermanentBonus = (this.state.questPermanentBonus || 0) + eff.qiPct;
    if (eff.qiHours) this._addQi(this.qiPerSecond() * 3600 * eff.qiHours + 100);
    if (eff.combatBuffSec) this.state.combatBuffEndsAt = TimeService.now() + eff.combatBuffSec * 1000;
    if (eff.lifespanLoss && this.state.life) this.state.life.age += eff.lifespanLoss;
    if (eff.adopt && window.Family && Family.adoptChild) Family.adoptChild();
    // Round 17 — Study/Work skill-check event effects.
    if (eff.intellect && this.state.life) this.state.life.intellect = Math.max(0, this.state.life.intellect + eff.intellect);
    if (eff.charm && this.state.life) this.state.life.charm = Math.max(0, this.state.life.charm + eff.charm);
    if (eff.jobXp && this.state.life && this.state.life.jobId && window.Life) {
      const prog = Life.jobProgress(this.state.life.jobId);
      prog.xp = Math.max(0, prog.xp + eff.jobXp);
    }
    // Money granted/deducted as N seconds' worth of the current job's pay
    // rate, so a flat-looking event reward auto-scales across job tiers.
    if (eff.jobBonusSeconds && this.state.life) {
      const amt = (window.Life ? Life.jobPayRate() : 0) * eff.jobBonusSeconds;
      this.state.life.money = Math.max(0, this.state.life.money + amt);
    }
  },
  payEventCost(cost) {
    if (!cost) return true;
    if (cost.money) {
      if (!this.state.life || this.state.life.money < cost.money) return false;
      this.state.life.money -= cost.money;
    }
    return true;
  },

  /** Painted portrait path for a character (falls back to the vector emblem).
   *  With no args this honours the player's chosen portrait (Settings >
   *  Appearance, Round 32); passing gender/rootKey explicitly still returns
   *  the derived default, which is what character creation previews use. */
  portraitSrc(gender, rootKey) {
    if (!gender && !rootKey) {
      const chosen = this.chosenPortrait();
      if (chosen) return GameData.portraitDir + chosen.file;
    }
    return GameData.portraitDir + (gender || this.state.gender) + '-' + (rootKey || (this.state.spiritualRoot && this.state.spiritualRoot.key)) + '.jpg';
  },

  /** The catalogue entry the player explicitly picked, or null for "auto"
   *  (derive from gender × spirit root, the original behaviour). */
  chosenPortrait() {
    const id = this.state.chosenPortraitId;
    if (!id) return null;
    return GameData.portraitCatalog.find(p => p.id === id) || null;
  },

  /** Choose a portrait by catalogue id, or null/'auto' to go back to the
   *  gender × root default. Returns false for an unknown id. */
  setChosenPortrait(id) {
    if (!id || id === 'auto') {
      this.state.chosenPortraitId = null;
      this.persist();
      return true;
    }
    if (!GameData.portraitCatalog.some(p => p.id === id)) return false;
    this.state.chosenPortraitId = id;
    this.persist();
    return true;
  },

  /** Painted Rift Guardian art path (falls back to the mob's emoji icon). */
  guardianPortraitSrc(guardianId) {
    return GameData.guardianPortraitDir + guardianId + '.jpg';
  },

  /** Painted art path for a regular mob, keyed off its icon id
   *  ('ic-mob-wolf' -> 'assets/mobs/wolf.jpg'). Falls back to the emoji. */
  mobArtSrc(iconId) {
    if (!iconId) return null;
    return GameData.mobArtDir + String(iconId).replace(/^ic-mob-/, '') + '.jpg';
  },

  // -------------------------------------------------------------------------
  // Meridian tree (Round 2)
  // -------------------------------------------------------------------------
  meridianNode(id) { return GameData.meridians.find(n => n.id === id); },
  meridianOpen(id) { return !!this.state.meridians[id]; },

  /** Summed fraction for an effect key across all opened meridian nodes. */
  meridianMult(key) {
    let sum = 0;
    for (const id in this.state.meridians) {
      if (!this.state.meridians[id]) continue;
      const n = this.meridianNode(id);
      if (n && n.effect && n.effect[key]) sum += n.effect[key];
    }
    return sum;
  },
  meridianTotalSpent() {
    let dao = 0;
    for (const id in this.state.meridians) {
      if (this.state.meridians[id]) { const n = this.meridianNode(id); if (n) dao += n.cost; }
    }
    return dao;
  },
  canOpenMeridian(id) {
    const n = this.meridianNode(id);
    if (!n || this.meridianOpen(id)) return false;
    if (n.requires && !this.meridianOpen(n.requires)) return false;
    return this.state.daoComprehension >= n.cost;
  },
  openMeridian(id) {
    if (!this.canOpenMeridian(id)) return false;
    const n = this.meridianNode(id);
    this.state.daoComprehension -= n.cost;
    this.state.meridians[id] = true;
    this.persist();
    return true;
  },
  /** Refund all Dao spent on meridians and clear the tree. */
  respecMeridians() {
    const refund = this.meridianTotalSpent();
    this.state.daoComprehension += refund;
    this.state.meridians = {};
    this.persist();
    return refund;
  },

  // -------------------------------------------------------------------------
  // Reincarnation / Heavenly Dao (Round 3)
  // -------------------------------------------------------------------------
  perkDef(id) { return GameData.heavenlyPerks.find(p => p.id === id); },
  perkLevel(id) { return this.state.heavenlyPerks[id] || 0; },
  /** Summed bonus across all perks with the given effect key (per × level). */
  perkBonus(effectKey) {
    let sum = 0;
    GameData.heavenlyPerks.forEach(p => {
      if (p.effect === effectKey) sum += p.per * this.perkLevel(p.id);
    });
    return sum;
  },
  heavenlyPerkCost(id) {
    const p = this.perkDef(id);
    if (!p) return Infinity;
    return Math.floor(p.baseCost * Math.pow(p.costGrowth, this.perkLevel(id)));
  },
  canBuyHeavenlyPerk(id) {
    const p = this.perkDef(id);
    if (!p || this.perkLevel(id) >= p.maxLevel) return false;
    if (!this.perkUnlocked(id)) return false;
    return this.state.heavenlyMerit >= this.heavenlyPerkCost(id);
  },
  buyHeavenlyPerk(id) {
    if (!this.canBuyHeavenlyPerk(id)) return false;
    this.state.heavenlyMerit -= this.heavenlyPerkCost(id);
    this.state.heavenlyPerks[id] = this.perkLevel(id) + 1;
    this.persist();
    return true;
  },

  /** +X global production from all past lives. Samsara Mastery (Round 27)
   * raises the per-life RATE itself via lifeBonusPer, so it compounds with
   * every life instead of being a one-off flat bonus. */
  reincarnationMult() {
    const perLife = GameData.reincarnationBonusPer + this.perkBonus('lifeBonusPer');
    return 1 + (this.state.reincarnations || 0) * perLife;
  },
  /** Current per-life production rate (for UI display). */
  reincarnationBonusPer() { return GameData.reincarnationBonusPer + this.perkBonus('lifeBonusPer'); },

  canReincarnate() { return this.state.realm >= GameData.reincarnationRealmReq; },
  pendingMerit() {
    return Math.floor(GameData.heavenlyMeritFor(this.state) * (1 + this.perkBonus('merit')));
  },
  /** Whether a perk gated behind a Rift Guardian (Round 27) is unlocked yet. */
  perkUnlocked(id) {
    const p = this.perkDef(id);
    if (!p || !p.reqGuardian) return true;
    const defeated = this.state.fracture && this.state.fracture.guardiansDefeated;
    return !!(defeated && defeated[p.reqGuardian]);
  },

  reincarnate() {
    if (!this.canReincarnate()) return false;
    const merit = this.pendingMerit();
    this.state.heavenlyMerit += merit;
    this.state.reincarnations += 1;

    // Full cultivation reset (collections & meta persist).
    this.state.realm = 0;
    this.state.qi = 0;
    this.state.runQi = 0;
    this.state.daoComprehension = 0;
    this.state.upgrades = {};
    this.state.meridians = {};
    this.state.foundationBonuses = [];
    this.state.milestonesUnlocked = [];
    this.state.breakthroughConditionsHit = [];
    GameData.generators.forEach(g => { this.state.owned[g.id] = 0; });

    // Per-life head-start perks.
    this.state.stage = 0;
    this.state.stagesCleared = this.perkBonus('startStages'); // perk gives flat stages
    const startStones = this.perkBonus('startStones');
    if (startStones) this.state.spiritStones = (this.state.spiritStones || 0) + startStones;

    if (window.Enchanting) Enchanting.onReincarnate();
    this.persist();
    return { merit, reincarnations: this.state.reincarnations };
  },

  // -------------------------------------------------------------------------
  // Daily login rewards (Round 3)
  // -------------------------------------------------------------------------
  _today() {
    const d = new Date(TimeService.now());
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  },
  _dayNumber(now) { return Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / 86400000); },
  /** true if a daily reward can be claimed right now. */
  dailyAvailable() { return this.state.lastDailyDay !== this._today(); },
  /** The reward definition for the streak day that would be claimed next. */
  pendingDailyReward() {
    const idx = (this.state.dailyStreak % GameData.dailyRewards.length);
    return GameData.dailyRewards[idx];
  },
  claimDaily() {
    if (!this.dailyAvailable()) return null;
    // Streak continues if last claim was yesterday; otherwise it resets.
    const today = this._dayNumber(TimeService.now());
    const last = this.state._lastDailyNum;
    if (last === today - 1) this.state.dailyStreak += 1;
    else this.state.dailyStreak = 1;
    this.state._lastDailyNum = today;
    this.state.lastDailyDay = this._today();

    const reward = GameData.dailyRewards[(this.state.dailyStreak - 1) % GameData.dailyRewards.length];
    const g = reward.grant;
    if (g.qiHours) this._addQi(this.qiPerSecond() * 3600 * g.qiHours + 500);
    if (g.stones)  this.state.spiritStones = (this.state.spiritStones || 0) + g.stones;
    if (g.money && this.state.life) this.state.life.money += g.money;
    if (g.eggs)    this.state.beastEggs = (this.state.beastEggs || 0) + g.eggs;
    if (g.merit)   this.state.heavenlyMerit += g.merit;
    this.persist();
    return { reward, streak: this.state.dailyStreak };
  },

  // -------------------------------------------------------------------------
  // Pill Alchemy (Round 4)
  // -------------------------------------------------------------------------
  pillDef(id) { return GameData.pills.find(p => p.id === id); },
  pillCount(id) { return this.state.pillBag[id] || 0; },

  craftPill(id, count = 1) {
    const p = this.pillDef(id);
    if (!p || count < 1) return false;
    const totalCost = p.cost * count;
    if (this.state.spiritStones < totalCost) return false;
    this.state.spiritStones -= totalCost;
    this.state.pillBag[id] = this.pillCount(id) + count;
    this.persist();
    return true;
  },
  /** How many of a pill can be brewed right now (flat cost, so no geometric series like generators). */
  maxAffordablePills(id) {
    const p = this.pillDef(id);
    if (!p || p.cost <= 0) return 0;
    return Math.floor(this.state.spiritStones / p.cost);
  },

  /** Consume `count` of a pill at once. Buff pills stack the same way
   *  Boosters do: reusing the SAME pill extends its own timer additively
   *  (Math.max(endsAt, now) + duration*count); a DIFFERENT pill sharing the
   *  same buff key gets its own tracked entry, so its multiplier compounds
   *  with the first via buffMult()'s existing "multiply every matching
   *  entry" loop — e.g. Spirit Gathering Pill (×2 Qi) and Enlightenment
   *  Pill (×3 Qi) active together give ×6 Qi, not one overwriting the other. */
  usePill(id, count = 1) {
    const p = this.pillDef(id);
    if (!p || count < 1 || this.pillCount(id) < count) return false;
    this.state.pillBag[id] -= count;
    if (p.type === 'buff') {
      const now = TimeService.now();
      const existing = this.state.buffs.find(b => b.pillId === p.id);
      const base = existing ? Math.max(existing.endsAt, now) : now;
      const endsAt = base + p.durationSec * 1000 * count;
      if (existing) { existing.mult = p.mult; existing.endsAt = endsAt; }
      else this.state.buffs.push({ buff: p.buff, mult: p.mult, endsAt, pillId: p.id });
    } else if (p.instant === 'eggs') {
      this.state.beastEggs = (this.state.beastEggs || 0) + (p.amount || 1) * count;
    } else if (p.instant === 'runqi') {
      const req = this.nextStageReq();
      const add = (req ? req * (p.frac || 0.25) : this.qiPerSecond() * 600) * count;
      this._addQi(add);
    }
    this.persist();
    return { pill: p, count };
  },

  /** Product of active buff multipliers of a given key (prunes expired). */
  buffMult(key) {
    const now = TimeService.now();
    let mult = 1;
    let changed = false;
    this.state.buffs = (this.state.buffs || []).filter(b => {
      if (b.endsAt <= now) { changed = true; return false; }
      return true;
    });
    this.state.buffs.forEach(b => { if (b.buff === key) mult *= b.mult; });
    if (changed) { /* expired buffs pruned */ }
    return mult;
  },
  activeBuffs() {
    const now = TimeService.now();
    return (this.state.buffs || []).filter(b => b.endsAt > now);
  },

  // -------------------------------------------------------------------------
  // Secret Realm (Round 4)
  // -------------------------------------------------------------------------
  /** Combined combat rating used for Secret Realm depth. */
  secretRealmPower() {
    if (!window.Combat) return 0;
    return Combat.playerAtk() + Combat.playerHpMax() * 0.2;
  },
  /** Deepest floor clearable at the given power. */
  secretRealmMaxFloor(power) {
    const cfg = GameData.secretRealm;
    let floor = 0;
    while (floor < 200) {
      const req = cfg.floorBaseReq * Math.pow(cfg.floorGrowth, floor);
      if (power >= req) floor++; else break;
    }
    return floor;
  },
  secretRealmAvailable() { return this.state.secretRealm.lastRunDay !== this._today(); },

  /** Run the Secret Realm: clears floors by power, grants scaled rewards. */
  enterSecretRealm() {
    if (!this.secretRealmAvailable()) return null;
    const cfg = GameData.secretRealm;
    const power = this.secretRealmPower();
    const floors = this.secretRealmMaxFloor(power);
    this.state.secretRealm.lastRunDay = this._today();
    const isRecord = floors > (this.state.secretRealm.highestFloor || 0);
    if (isRecord) this.state.secretRealm.highestFloor = floors;

    // Rewards.
    let stones = 0;
    for (let f = 1; f <= floors; f++) stones += cfg.stoneBase * Math.pow(cfg.stoneGrowth, f - 1);
    stones = Math.floor(stones);
    const eggs  = Math.floor(floors / cfg.eggEvery);
    const merit = Math.floor(floors / cfg.meritEvery);
    if (isRecord && floors > 0) stones = Math.floor(stones * 1.5); // first-clear bonus

    this.state.spiritStones += stones;
    this.state.beastEggs = (this.state.beastEggs || 0) + eggs;
    this.state.heavenlyMerit = (this.state.heavenlyMerit || 0) + merit;
    this.persist();
    return { floors, stones, eggs, merit, isRecord, power };
  },

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------
  multipliers() {
    const m = { tapMult: 1, allMult: 1, offlineBonus: 0 };
    GameData.upgrades.forEach(u => {
      if (this.state.upgrades[u.id]) u.effect(m);
    });
    // Permanent power vectors:
    m.root  = this.state.spiritualRoot ? this.state.spiritualRoot.mult : 1;   // Spiritual Root
    m.stage = 1 + this.state.stagesCleared * GameData.stageBonusPerStage;      // Cultivation Base
    m.dao   = 1 + this.state.daoComprehension * GameData.daoBonusPerPoint;     // Dao Comprehension
    m.sect  = (window.Sect && Sect.qiMult) ? Sect.qiMult() : 1;                // Sect bonus (legacy)
    m.pet   = (window.Pets && Pets.qiMult) ? Pets.qiMult() : 1;                // Spirit Beast bond (legacy)
    m.talent= (window.Life && this.state.life) ? Life.talentMult() : 1;        // Study → Talent
    m.family= (window.Family && this.state.family) ? Family.familyMult() : 1;  // Spouse + children
    m.legacy= 1 + (this.state.legacyBonus || 0);                               // Bloodline generations
    // Dao Path + trait modifiers (Round 5 depth)
    const mods = this.activeMods();
    m.allMult     *= mods.qi;
    m.tapMult     *= mods.tap;
    m.offlineBonus += mods.offline;
    m.family      *= mods.family;
    // Artifacts: equipped Qi% + set bonuses (Round 6)
    if (window.Artifacts) m.allMult *= (1 + Artifacts.qiPct());
    // Karma alignment perks (Round 7)
    const km = this.karmaMods();
    m.allMult *= km.qi;
    m.offlineBonus += km.offline;
    // Blood Essence (Jing) + Spirit (Shen): the qi/offline layers beneath/above Qi.
    if (window.Blood) m.allMult *= Blood.qiMult();
    if (window.Spirit) { m.allMult *= Spirit.qiMult(); m.offlineBonus += Spirit.offlineBonus(); }
    // Rune enchanting + Weekly challenge Qi bonuses (Round 7)
    if (window.Enchanting) m.allMult *= (1 + Enchanting.qiPct());
    if (window.Challenges) m.allMult *= Challenges.qiMult();
    // Cultivation Boosters: stacking timed Qi buff (Round 9)
    if (window.Boosters) m.allMult *= Boosters.qiMult();
    // Daily Cultivation Seal: timed 2× Qi buff (Round 11)
    if (window.Dailies) m.allMult *= Dailies.qiMult();
    // Fracture Resonance: Stellar Qi path (Round 13)
    if (window.Fracture) m.allMult *= Fracture.qiMult();
    // Elective "Qi Refinement Science" path (Round 17)
    if (window.Life && this.state.life) m.allMult *= Life.qiStudyMult();
    // Meridian tree (Round 2): Qi, tap, offline, beast bonuses.
    m.allMult    *= (1 + this.meridianMult('qi'));
    m.tapMult    *= (1 + this.meridianMult('tap'));
    m.offlineBonus += this.meridianMult('offline');
    // Beast Kinship scales the pet-bond FRACTION, not the baseline 1 — a player
    // with zero pets must not get a free Qi multiplier from this node.
    m.pet        = 1 + (m.pet - 1) * (1 + this.meridianMult('pet'));
    // Reincarnation (Round 3): Heavenly perk Qi + per-life stacking bonus.
    m.allMult *= (1 + this.perkBonus('qi'));
    m.allMult *= this.reincarnationMult();
    // Alchemy (Round 4): active Qi-buff pills.
    m.allMult *= this.buffMult('qi');
    // IAP: Permanent 2× production
    if (this.state.permanentDouble) m.allMult *= 2;
    // Rewarded-ad timed boost: 2× production
    if (this.state.qiBoostEndsAt && TimeService.now() < this.state.qiBoostEndsAt) m.allMult *= 2;
    // Hidden: Cultivation Insight timed boost: 2× production
    if (this.state.insightEndsAt && TimeService.now() < this.state.insightEndsAt) m.allMult *= 2;
    // Quest rewards: permanent bonus fraction
    if (this.state.questPermanentBonus) m.allMult *= (1 + this.state.questPermanentBonus);
    // Foundation quality bonuses (stacking, per realm)
    if (this.state.foundationBonuses && this.state.foundationBonuses.length) {
      const fb = this.state.foundationBonuses.reduce((s, b) => s + b.bonus, 0);
      m.allMult *= (1 + fb);
    }
    // Spirit Root Pack production bonus
    if (this.state.packProductionBonus) m.allMult *= (1 + this.state.packProductionBonus);
    // Stage milestone bonuses
    if (this.state.milestonesUnlocked && this.state.milestonesUnlocked.length) {
      const milestoneBonus = GameData.stageMilestones
        .filter(ms => this.state.milestonesUnlocked.includes(ms.at))
        .reduce((s, ms) => s + ms.bonus, 0);
      if (milestoneBonus) m.allMult *= (1 + milestoneBonus);
    }
    // House reputation (Round 15): a slow-growing, generation-spanning
    // prestige bonus — capped so it stays a long-term flourish, not a wall.
    if (this.state.houseReputation) m.allMult *= (1 + Math.min(0.25, this.state.houseReputation * 0.001));
    // Realm bonus (Round 16): scales with the current MAJOR realm, distinct
    // from m.stage (lifetime minor stages cleared) below.
    m.allMult *= (1 + this.state.realm * GameData.realmBonusPerLevel);
    return m;
  },

  /** Combined permanent global multiplier. */
  globalMult() {
    const m = this.multipliers();
    return m.root * m.stage * m.dao * m.sect * m.pet * m.talent * m.family * m.legacy;
  },

  /** Number of generators owned at the "mastered" depth (for synergy). */
  synergyCount() {
    return GameData.generators.reduce((n, g) =>
      n + ((this.state.owned[g.id] || 0) >= GameData.synergyThreshold ? 1 : 0), 0);
  },
  /** Compounding global production multiplier from generator synergy. */
  synergyMult() {
    return 1 + this.synergyCount() * GameData.synergyBonusPer;
  },

  /** Qi per second from all generators, with milestones, synergy & all multipliers. */
  qiPerSecond() {
    const m = this.multipliers();
    let base = 0;
    GameData.generators.forEach(g => {
      const owned = this.state.owned[g.id];
      if (owned) base += g.baseProd * owned * GameData.genMilestoneMultiplier(owned);
    });
    base *= this.synergyMult();
    return base * m.allMult * m.root * m.stage * m.dao * m.sect * m.pet * m.talent * m.family * m.legacy;
  },

  /** Qi gained per manual meditate tap. */
  qiPerTap() {
    const m = this.multipliers();
    return GameData.tap.baseGain * m.tapMult * (1 + this.focusBonus()) * m.root * m.stage * m.dao * m.sect * m.pet * m.talent * m.family * m.legacy;
  },

  /** Current focus-combo bonus fraction (Round 16) — active-tap-only, not
   *  applied to idle/offline production. See _updateFocusCombo(). */
  focusBonus() {
    return Math.min(GameData.tap.focusMaxCombo, this._focusCombo) * GameData.tap.focusBonusPerStack;
  },
  /** Advances the tap combo: a gap under focusWindowMs since the last tap
   *  extends it, a longer gap starts a fresh one. Called once per tap. */
  _updateFocusCombo() {
    const now = TimeService.monotonicNow();
    if (this._lastTapMono && (now - this._lastTapMono) <= GameData.tap.focusWindowMs) {
      this._focusCombo = Math.min(GameData.tap.focusMaxCombo, this._focusCombo + 1);
    } else {
      this._focusCombo = 1;
    }
    this._lastTapMono = now;
    return this._focusCombo;
  },

  generatorCost(g, count = 1) {
    // Sum of geometric series for buying `count` units.
    const owned = this.state.owned[g.id];
    const r = g.costGrowth;
    const first = g.baseCost * Math.pow(r, owned);
    if (count === 1) return first;
    return first * (Math.pow(r, count) - 1) / (r - 1);
  },

  // -------------------------------------------------------------------------
  // Player actions
  // -------------------------------------------------------------------------
  meditate() {
    const combo = this._updateFocusCombo(); // must run BEFORE qiPerTap() so gain reflects this tap's combo
    let gain = this.qiPerTap();
    // Meridian crit (Radiant Soul): chance for a ×N tap.
    let crit = false;
    const critChance = this.meridianMult('crit');
    if (critChance > 0 && Math.random() < critChance) {
      crit = true;
      gain *= GameData.meridianCritMult;
    }
    this._addQi(gain);
    this.state.totalTaps = (this.state.totalTaps || 0) + 1;
    // Hidden mechanic: 0.5% chance of Cultivation Insight (2× production for 60s).
    if (!this.state.insightEndsAt || TimeService.now() >= this.state.insightEndsAt) {
      if (Math.random() < 0.005) {
        this.state.insightEndsAt = TimeService.now() + 60 * 1000;
        if (window.Quests) Quests.onInsight();
        if (window.UI) UI.showInsight();
      }
    }
    return { gain, crit, combo };
  },

  buyGenerator(id, count = 1) {
    const g = GameData.generators.find(x => x.id === id);
    if (!g) return false;
    if (g.reqRealm && this.state.realm < g.reqRealm) return false;
    const cost = this.generatorCost(g, count);
    if (this.state.qi < cost) return false;
    this.state.qi -= cost;
    this.state.owned[id] += count;
    this.persist();
    return true;
  },

  /** How many of generator `id` the player can currently afford (for "buy max"). */
  maxAffordable(id) {
    const g = GameData.generators.find(x => x.id === id);
    if (!g) return 0;
    if (g.reqRealm && this.state.realm < g.reqRealm) return 0;
    const owned = this.state.owned[id];
    const r = g.costGrowth;
    const first = g.baseCost * Math.pow(r, owned);
    // Solve geometric series <= qi for n.
    const qi = this.state.qi;
    if (qi < first) return 0;
    const n = Math.floor(Math.log(qi * (r - 1) / first + 1) / Math.log(r));
    return Math.max(0, n);
  },

  buyUpgrade(id) {
    const u = GameData.upgrades.find(x => x.id === id);
    if (!u || this.state.upgrades[id]) return false;
    if (u.currency === 'dao') {
      if (this.state.daoComprehension < u.cost) return false;
      this.state.daoComprehension -= u.cost;
    } else {
      if (this.state.qi < u.cost) return false;
      this.state.qi -= u.cost;
    }
    this.state.upgrades[id] = true;
    this.persist();
    return true;
  },

  // -------------------------------------------------------------------------
  // Cultivation tiers: minor stages (no reset) + major realms (prestige)
  // -------------------------------------------------------------------------
  currentRealm() { return GameData.realms[this.state.realm]; },
  nextRealm()    { return GameData.realms[this.state.realm + 1] || null; },

  /** Trials (combat) unlock once you sense Qi (reach Qi Condensation). */
  combatUnlocked() { return this.state.realm >= 1 || this.state.stagesCleared >= 2; },

  /** Number of minor stages in the current realm. */
  stageCount() { return this.currentRealm().stages.length; },

  /** True once every minor stage of the current realm has been cleared. */
  realmComplete() { return this.state.stage >= this.stageCount(); },

  /** Qi needed for the NEXT minor stage (or null if realm minor-complete).
   *  Body Refinement path raises this (×stageCost). */
  nextStageReq() {
    if (this.realmComplete()) return null;
    return GameData.stageReq(this.state.realm, this.state.stage) * this.modVal('stageCost');
  },

  canAdvanceStage() {
    const req = this.nextStageReq();
    return req !== null && this.state.qi >= req;
  },

  /** Advance one minor stage: CONSUMES the Qi (spend on power vs economy),
   *  grants permanent +5% Cultivation Base, no reset. */
  advanceStage() {
    if (!this.canAdvanceStage()) return false;
    this.state.qi -= this.nextStageReq();
    this.state.stage += 1;
    this.state.stagesCleared += 1;
    const result = {
      realm: this.currentRealm(),
      stageIndex: this.state.stage - 1,
      milestone: null,
    };
    // Check stage milestone (culturally significant numbers)
    const stageNum = this.state.stagesCleared; // lifetime stages cleared
    const ms = GameData.stageMilestones && GameData.stageMilestones.find(m => m.at === stageNum);
    if (ms && !this.state.milestonesUnlocked.includes(stageNum)) {
      this.state.milestonesUnlocked.push(stageNum);
      if (ms.dao) this.state.daoComprehension += ms.dao;
      result.milestone = ms;
    }
    return result;
  },

  /** Label for the cultivator's current tier, e.g. "Foundation Establishment · Middle Stage". */
  tierLabel() {
    const realm = this.currentRealm();
    const idx = Math.min(this.state.stage, realm.stages.length - 1);
    const done = this.realmComplete();
    return {
      realm: realm.name,
      stage: done ? 'Great Perfection' : realm.stages[idx],
      complete: done,
    };
  },

  // -- Major breakthrough (Heavenly Tribulation = prestige) -----------------
  /** All minor stages cleared and a next realm exists (pill checked separately). */
  realmReadyForTribulation() {
    return this.realmComplete() && !!this.nextRealm();
  },

  /** Does ascending to the next realm require a Breakthrough Pill? */
  pillRequired() {
    const next = this.nextRealm();
    return !!next && next.pillCost > 0;
  },

  hasPill() { return (this.state.breakthroughPills || 0) > 0; },

  /** ¥ price of the next Breakthrough Pill (Pill Dao discounts it). */
  pillPrice() {
    const next = this.nextRealm();
    return next ? Math.ceil(next.pillCost * this.modVal('pillCost')) : 0;
  },
  buyPill() {
    const next = this.nextRealm();
    if (!next || next.pillCost <= 0) return false;
    const life = this.state.life;
    const price = this.pillPrice();
    if (!life || life.money < price) return false;
    life.money -= price;
    this.state.breakthroughPills = (this.state.breakthroughPills || 0) + 1;
    this.persist();
    return true;
  },

  /** Success chance for the tribulation attempt (raised by Talent/Intellect). */
  tribulationChance() {
    const t = GameData.tribulation;
    if (!this.pillRequired()) return 1; // tutorial realms are guaranteed
    const life = this.state.life || {};
    const c = t.baseChance + (life.talent || 0) * t.talentBonus + (life.intellect || 0) * t.intellectBonus
            + this.modVal('tribChance') + (this.karmaMods().tribChance || 0)
            + (window.Spirit ? Spirit.tribBonus() : 0);
    return Math.min(t.maxChance, c);
  },

  /** Pill in hand (or not needed) + realm complete = may attempt. */
  canBreakThrough() {
    return this.realmReadyForTribulation() && (!this.pillRequired() || this.hasPill());
  },

  /** Dao Comprehension that a Tribulation would currently award. */
  pendingDaoGain() {
    const base = GameData.daoGainFor(this.state.runQi);
    // Meridian (Dao Resonance) + Heavenly perk (Heaven's Insight) boost rewards.
    const dao = Math.floor(base * (1 + this.meridianMult('daoGain') + this.perkBonus('daoGain')));
    return Math.floor(dao * (window.Challenges ? Challenges.daoMult() : 1));
  },

  breakThrough() {
    if (!this.canBreakThrough()) return false;

    // The Tribulation is risky: consume the pill, then roll for success.
    if (this.pillRequired()) this.state.breakthroughPills -= 1;
    if (Math.random() > this.tribulationChance()) {
      this.state.runQi *= (1 - GameData.tribulation.failRunQiLoss);
      this.persist();
      return { failed: true };
    }

    const runQiAtBreak = this.state.runQi;
    const realmIndex   = this.state.realm;

    // Hidden mechanic: evaluate Foundation Quality before resetting runQi.
    let quality = null;
    if (window.Quests) quality = Quests.onBreakthrough(runQiAtBreak, realmIndex);
    if (quality && quality.bonus > 0) {
      this.state.foundationBonuses.push({ realm: realmIndex, bonus: quality.bonus });
    }

    // Check hidden breakthrough conditions
    const conditionsHit = [];
    if (GameData.breakthroughConditions) {
      GameData.breakthroughConditions.forEach(cond => {
        if (this.state.breakthroughConditionsHit.includes(cond.id)) return;
        let met = false;
        try {
          met = cond.check ? cond.check(this.state) : false;
        } catch (e) { /* ignore */ }
        if (met) {
          conditionsHit.push(cond);
          this.state.breakthroughConditionsHit.push(cond.id);
          // Apply production bonus (all conditions use `bonus` field)
          if (cond.bonus) this.state.packProductionBonus = (this.state.packProductionBonus || 0) + cond.bonus;
        }
      });
    }

    const gain = this.pendingDaoGain();
    this.state.daoComprehension += gain;
    this.state.realm += 1;
    this.state.stage = 0;
    // Soft reset this run.
    this.state.qi = 0;
    this.state.runQi = 0;
    GameData.generators.forEach(g => { this.state.owned[g.id] = 0; });
    this.persist();
    return { gain, realm: GameData.realms[this.state.realm], quality, conditionsHit };
  },

  // -------------------------------------------------------------------------
  // Lifespan & bloodline succession (distinct from voluntary Reincarnation):
  // each realm caps your age; outlive it and the bloodline continues through
  // a chosen heir, who inherits their root, part of the estate, and a legacy.
  // -------------------------------------------------------------------------
  lifespan() { return Math.round(this.currentRealm().lifespan + this.modVal('lifespan') * this.state.realm); },

  isDying() {
    const life = this.state.life;
    return !!life && life.age >= this.lifespan();
  },

  /** Legacy bonus the CURRENT character would leave behind on death. */
  pendingLegacyGain(heir) {
    const L = GameData.legacy;
    const fam = this.state.family || { children: [] };
    const siblings = Math.max(0, fam.children.length - (heir ? 1 : 0));
    let gain = this.state.realm * L.perRealm
             + siblings * L.perSibling
             + Math.floor(this.state.stagesCleared / 5) * L.perFiveStages;
    if (!heir) gain *= L.descendantFactor; // dao scatters without a bloodline heir
    return gain;
  },

  /** Die and continue as `heir` (a child object) or, with no children, as a
   *  distant descendant. Keeps: dao, merit, perks, meridians, legacy, money
   *  share. Resets: body cultivation, education, career, family. */
  passToHeir(heir) {
    const L = GameData.legacy;
    this.state.legacyBonus = (this.state.legacyBonus || 0) + this.pendingLegacyGain(heir);

    // Ancestor Hall: log the generation that just ended (BEFORE incrementing
    // the counter below, and before family state gets wiped further down —
    // summaryForLineage reads the current generation/spouse/children).
    if (window.Family) {
      if (!Array.isArray(this.state.lineage)) this.state.lineage = [];
      const summary = Family.summaryForLineage(heir);
      this.state.lineage.push(summary);
      this.state.houseReputation = (this.state.houseReputation || 0)
        + 2 + this.state.realm + Math.min(summary.childCount, 6);
    }
    this.state.generation = (this.state.generation || 1) + 1;

    // New body inherits the heir's identity, root & traits (or rolls a descendant).
    let nurtureLvl = 0;
    if (heir) {
      this.state.name = heir.name;
      this.state.gender = heir.gender;
      this.state.spiritualRoot = heir.root;
      this.state.traits = (heir.traits || []).slice();
      nurtureLvl = heir.nurture || 0;
    } else {
      this.state.spiritualRoot = GameData.rollSpiritualRoot();
      this.state.traits = [];
    }

    // Cultivation dies with the body; dao + legacy persist in the bloodline.
    this.state.realm = 0; this.state.stage = 0; this.state.stagesCleared = 0;
    this.state.qi = 0; this.state.runQi = 0;
    this.state.upgrades = {};
    this.state.breakthroughPills = 0;
    this.state.daoPath = null;          // the heir forges their own path
    this.state.combatBuffEndsAt = 0;
    GameData.generators.forEach(g => { this.state.owned[g.id] = 0; });

    // Life restarts young, with an inheritance and the fruits of upbringing.
    if (this.state.life) {
      const N = GameData.nurture;
      this.state.life.money *= L.inheritMoney;
      this.state.life.age = GameData.aging.startAge;
      this.state.life.ageAcc = 0;
      this.state.life.education = Math.min((window.Life && Life.courses ? Life.courses.length : 5),
        Math.round(nurtureLvl * N.eduChancePerLevel));
      this.state.life.study = null;
      this.state.life.jobId = null;
      this.state.life.jobProgress = {}; // Round 18: every job's progress is earned this-lifetime
      this.state.life.intellect = 0; this.state.life.charm = 0;
      this.state.life.talent = nurtureLvl * N.talentPerLevel; // tutoring pays off
      // Round 17: electives are earned this-lifetime, same as education —
      // the heir starts their own academic career.
      this.state.life.electives = {};
      this.state.life.studyEventAcc = 0;
      this.state.life.workEventAcc = 0;
    }
    if (window.Family) this.state.family = Family.fresh();
    if (window.Family) Family.init();
    this.persist();
    return { generation: this.state.generation, legacy: this.state.legacyBonus };
  },

  // -------------------------------------------------------------------------
  // Core helpers
  // -------------------------------------------------------------------------
  _addQi(amount) {
    if (amount <= 0) return;
    this.state.qi += amount;
    this.state.runQi += amount;
    this.state.lifetimeQi += amount;
    if (window.Spirit) Spirit.onQiGain(amount); // Jing → Qi → Shen: Spirit condenses from Qi gained
  },

  // -------------------------------------------------------------------------
  // Tick loop (called from main.js requestAnimationFrame)
  // -------------------------------------------------------------------------
  tick() {
    const nowMono = TimeService.monotonicNow();
    let dtSec = (nowMono - this._lastTickMono) / 1000;
    this._lastTickMono = nowMono;

    // Clamp: never apply huge or negative deltas in the live loop.
    if (!(dtSec > 0)) dtSec = 0;
    if (dtSec > 5) dtSec = 5;

    this._addQi(this.qiPerSecond() * dtSec);

    // Auto-Runner (Round 30): hands-off core-grind automation, right after
    // this tick's Qi lands so it's spending freshly-earned income, same as
    // a player would.
    if (window.AutoRunner) AutoRunner.tick();

    // Life-sim systems advance while the app is open.
    if (window.Life && this.state.life) Life.tick(dtSec);
    if (window.Family && this.state.family) Family.tick(dtSec);

    // Trials (idle auto-battler) advance while the app is open, once unlocked.
    if (window.Combat && this.combatUnlocked()) Combat.tick(dtSec);

    // Passive sect contribution while you hold membership.
    if (window.Sect && this.state.sect) Sect.addContribution(dtSec * 1);

    // Karma life events: roll on a timer once the character exists.
    if (window.Events && this.state.characterCreated) Events.tick(dtSec);

    // Market prices drift on their own cadence.
    if (window.Market && this.state.market) Market.drift(false);

    // Hidden mechanic: lucky number check.
    if (window.Quests) Quests.checkLuckyNumbers();

    // Track the highest wall-clock time we've seen (anti-cheat baseline).
    const wall = TimeService.now();
    if (wall > this.state.maxSeenTime) this.state.maxSeenTime = wall;

    // Achievement scan every 5s (Round 11). Toast here — the periodic scan
    // beats the Feats panel's own checkAll() to marking unlocks, so without
    // this the panel's toast-on-unlock path never actually fires them.
    this._achievementTick = (this._achievementTick || 0) + dtSec;
    if (this._achievementTick >= 5) {
      this._achievementTick = 0;
      if (window.Achievements) {
        const unlocked = Achievements.checkAll();
        if (unlocked.length && window.UI) {
          unlocked.forEach(d => UI.toast(`🏆 Achievement Unlocked: ${d.name}!`));
        }
      }
    }

    // Autosave every 10s.
    this._saveAccumulator += dtSec;
    if (this._saveAccumulator >= 10) {
      this._saveAccumulator = 0;
      this.persist();
    }
  },

  // -------------------------------------------------------------------------
  // Offline progress + anti-cheat
  // -------------------------------------------------------------------------
  /**
   * Compute offline earnings since lastSaved. Returns
   * { seconds, gained, capped, cheated } and applies the Qi.
   */
  applyOffline() {
    const now = TimeService.now();
    const lastSaved = this.state.lastSaved || now;
    const maxSeen = this.state.maxSeenTime || lastSaved;

    // --- Anti-cheat: backward time jump --------------------------------
    // If the clock now reads EARLIER than the latest time we ever saw, the
    // user almost certainly rolled their clock back. Grant nothing and flag.
    //
    // NOTE: an earlier version of this check trusted TimeService.isSynced()
    // to distinguish "honest clock-drift correction" from "actual rollback,"
    // exempting synced readings from the flag. That was reverted: on the
    // packaged Capacitor/Android build (this game's actual distribution
    // target — see CLAUDE.md), TimeService.sync() HEADs the app's OWN local
    // origin, so a "synced" reading can just be the device's own clock
    // echoed back — it proves nothing. Worse, isSynced() is a plain mutable
    // property with no encapsulation, trivially forced true from devtools or
    // a patched APK, which would have reopened the exact rollback-then-
    // fast-forward offline-farming exploit maxSeenTime exists to prevent.
    // Instead we widen the flat grace window generously (15 min covers real
    // clock drift / sync jitter) without trusting any spoofable signal —
    // the same bounded, already-accepted risk category as the original 60s
    // grace, just larger, capped well below anything worth exploiting
    // against an 8h offline-earnings ceiling (GameData.offline.maxSeconds).
    const CLOCK_GRACE_MS = 15 * 60 * 1000;
    if (now < maxSeen - CLOCK_GRACE_MS) {
      this.state.cheatFlags = (this.state.cheatFlags || 0) + 1;
      this.state.lastSaved = now;
      // Don't lower maxSeenTime — keeps the cheat "sticky".
      return { seconds: 0, gained: 0, capped: false, cheated: true };
    }

    let elapsed = (now - lastSaved) / 1000; // seconds
    if (!(elapsed > 0)) elapsed = 0;

    // --- Anti-cheat: hard cap on offline time --------------------------
    const cap = GameData.offline.maxSeconds;
    const capped = elapsed > cap;
    const effective = Math.min(elapsed, cap);

    // --- Qi from generators (at reduced offline efficiency) ------------
    const m = this.multipliers();
    const sectOffline = (window.Sect && Sect.offlineBonus) ? Sect.offlineBonus() : 0;
    const efficiency = Math.min(1, GameData.offline.efficiency + m.offlineBonus + sectOffline);
    const gained = this.qiPerSecond() * effective * efficiency;
    this._addQi(gained);

    // --- Career: salary is contractual — full pay while away ------------
    let money = 0;
    if (window.Life && this.state.life && this.state.life.jobId) {
      money = Life.jobPayRate() * effective;
      this.state.life.money += money;
      Life.jobProgress(this.state.life.jobId).xp += effective; // job experience accrues too
    }
    // (Study completion needs no handling here: course endsAt is wall-clock,
    //  so Life.tick finishes any due course on the first tick after boot.
    //  Aging is intentionally active-only — you never return to find
    //  yourself dead; in seclusion, time flows differently.)

    // --- Trials: your cultivator kept fighting (full simulation) --------
    let stones = 0, eggs = 0, zones = 0, artifacts = 0;
    if (window.Combat && this.combatUnlocked() && !this.state.combat.paused && effective >= 10) {
      const s0 = this.state.spiritStones, e0 = this.state.beastEggs, z0 = this.state.combat.zone;
      const a0 = window.Artifacts ? this.state.artifacts.inventory.length : 0;
      for (let i = 0; i < Math.floor(effective); i++) Combat.tick(1);
      stones = this.state.spiritStones - s0;
      eggs = this.state.beastEggs - e0;
      zones = this.state.combat.zone - z0;
      artifacts = window.Artifacts ? (this.state.artifacts.inventory.length - a0) : 0;
    }

    // --- Sect contribution + family timers ------------------------------
    let contribution = 0;
    if (window.Sect && this.state.sect) { contribution = effective; Sect.addContribution(effective); }
    if (this.state.family && this.state.family.childCooldown > 0) {
      this.state.family.childCooldown = Math.max(0, this.state.family.childCooldown - effective);
    }

    this.state.lastSaved = now;
    if (now > this.state.maxSeenTime) this.state.maxSeenTime = now;

    return { seconds: elapsed, gained, money, stones, eggs, zones, artifacts, contribution, capped, cheated: false };
  },

  persist() {
    this.state.lastSaved = TimeService.now();
    if (this.state.lastSaved > this.state.maxSeenTime) {
      this.state.maxSeenTime = this.state.lastSaved;
    }
    const ok = Storage.save(this.state);
    // Surface (once, not on every failed autosave) so a full-storage/private-mode
    // player knows progress isn't reaching disk instead of silently losing it.
    if (!ok && !this._saveFailureWarned && window.UI) {
      this._saveFailureWarned = true;
      UI.toast('⚠ Could not save your progress — your device storage may be full.');
    } else if (ok) {
      this._saveFailureWarned = false;
    }
  },

  hardReset() {
    Storage.wipe();
    this.state = this.newState();
    this._lastTickMono = TimeService.monotonicNow();
  },
};

window.Game = Game;
