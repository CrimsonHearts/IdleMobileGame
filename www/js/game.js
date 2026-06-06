/* ===========================================================================
 * game.js — Core game engine: state, economy, tick loop, offline progress,
 * breakthroughs (prestige). Theme-agnostic logic driven by gameData.js.
 * ========================================================================= */

const Game = {
  state: null,
  _lastTickMono: 0,      // monotonic timestamp of last tick (ms)
  _saveAccumulator: 0,   // seconds since last autosave

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
      spiritualRoot: GameData.spiritualRoots[0], // {key,name,nameCN,mult,...}

      qi: 0,
      lifetimeQi: 0,        // total Qi earned across ALL runs (stats)
      runQi: 0,             // total Qi earned THIS run (drives breakthrough)
      owned,
      upgrades: {},         // id -> true
      realm: 0,             // major realm index into GameData.realms
      stage: 0,             // minor stage index within the current realm
      stagesCleared: 0,     // lifetime count of minor breakthroughs (Cultivation Base 修为)
      daoComprehension: 0,  // prestige currency (permanent multiplier)

      // -- RPG systems --------------------------------------------------
      spiritStones: 0,      // 灵石 — combat currency (level pets, sect shop)
      beastEggs: 0,         // 兽蛋 — tame spirit beasts
      sect: null,           // { id, contribution, joinedAt } or null
      pets: { owned: {}, active: [] },           // owned: {id:{level}}, active:[ids]
      combat: { zone: 1, wave: 1, highestZone: 1, playerHp: null, paused: false },
      lastSaved: TimeService.now(),
      createdAt: TimeService.now(),
      // Anti-cheat audit fields:
      maxSeenTime: TimeService.now(), // highest wall-clock ever observed
      cheatFlags: 0,                  // count of suspicious backward jumps
    };
  },

  init(loaded) {
    this.state = loaded || this.newState();
    // Backfill any new generators / fields added in updates.
    GameData.generators.forEach(g => {
      if (this.state.owned[g.id] === undefined) this.state.owned[g.id] = 0;
    });
    if (!this.state.upgrades) this.state.upgrades = {};
    if (this.state.stage === undefined) this.state.stage = 0;
    if (this.state.stagesCleared === undefined) this.state.stagesCleared = 0;
    if (this.state.characterCreated === undefined) this.state.characterCreated = false;
    if (!this.state.spiritualRoot) this.state.spiritualRoot = GameData.spiritualRoots[0];
    if (this.state.spiritStones === undefined) this.state.spiritStones = 0;
    if (this.state.beastEggs === undefined) this.state.beastEggs = 0;
    if (this.state.sect === undefined) this.state.sect = null;
    if (!this.state.pets) this.state.pets = { owned: {}, active: [] };
    if (!this.state.combat) this.state.combat = { zone: 1, wave: 1, highestZone: 1, playerHp: null, paused: false };
    this._lastTickMono = TimeService.monotonicNow();
  },

  /** Finalise character creation. */
  createCharacter(gender, name, root) {
    this.state.gender = (gender === 'female') ? 'female' : 'male';
    this.state.name = (name && name.trim()) ? name.trim().slice(0, 20) : 'Nameless Cultivator';
    this.state.spiritualRoot = root || GameData.rollSpiritualRoot();
    this.state.characterCreated = true;
    this.persist();
  },

  genderInfo() { return GameData.genders[this.state.gender] || GameData.genders.male; },

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------
  multipliers() {
    const m = { tapMult: 1, allMult: 1, offlineBonus: 0 };
    GameData.upgrades.forEach(u => {
      if (this.state.upgrades[u.id]) u.effect(m);
    });
    // Permanent power vectors:
    m.root  = this.state.spiritualRoot ? this.state.spiritualRoot.mult : 1;   // Spiritual Root 灵根
    m.stage = 1 + this.state.stagesCleared * GameData.stageBonusPerStage;      // Cultivation Base 修为
    m.dao   = 1 + this.state.daoComprehension * GameData.daoBonusPerPoint;     // Dao Comprehension 道韵
    m.sect  = (window.Sect && Sect.qiMult) ? Sect.qiMult() : 1;                // Sect 宗门 bonus
    m.pet   = (window.Pets && Pets.qiMult) ? Pets.qiMult() : 1;                // Spirit Beast 灵兽 bond
    return m;
  },

  /** Combined permanent global multiplier. */
  globalMult() {
    const m = this.multipliers();
    return m.root * m.stage * m.dao * m.sect * m.pet;
  },

  /** Qi per second from all generators, with all multipliers applied. */
  qiPerSecond() {
    const m = this.multipliers();
    let base = 0;
    GameData.generators.forEach(g => {
      base += g.baseProd * this.state.owned[g.id];
    });
    return base * m.allMult * m.root * m.stage * m.dao * m.sect * m.pet;
  },

  /** Qi gained per manual meditate tap. */
  qiPerTap() {
    const m = this.multipliers();
    return GameData.tap.baseGain * m.tapMult * m.root * m.stage * m.dao * m.sect * m.pet;
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
    const gain = this.qiPerTap();
    this._addQi(gain);
    return gain;
  },

  buyGenerator(id, count = 1) {
    const g = GameData.generators.find(x => x.id === id);
    if (!g) return false;
    const cost = this.generatorCost(g, count);
    if (this.state.qi < cost) return false;
    this.state.qi -= cost;
    this.state.owned[id] += count;
    return true;
  },

  /** How many of generator `id` the player can currently afford (for "buy max"). */
  maxAffordable(id) {
    const g = GameData.generators.find(x => x.id === id);
    if (!g) return 0;
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
    return true;
  },

  // -------------------------------------------------------------------------
  // Cultivation tiers: minor stages (no reset) + major realms (prestige)
  // -------------------------------------------------------------------------
  currentRealm() { return GameData.realms[this.state.realm]; },
  nextRealm()    { return GameData.realms[this.state.realm + 1] || null; },

  /** Number of minor stages in the current realm. */
  stageCount() { return this.currentRealm().stages.length; },

  /** True once every minor stage of the current realm has been cleared. */
  realmComplete() { return this.state.stage >= this.stageCount(); },

  /** RunQi needed for the NEXT minor stage (or null if realm minor-complete). */
  nextStageReq() {
    if (this.realmComplete()) return null;
    return GameData.stageReq(this.state.realm, this.state.stage);
  },

  canAdvanceStage() {
    const req = this.nextStageReq();
    return req !== null && this.state.runQi >= req;
  },

  /** Advance one minor stage: permanent +5% Cultivation Base, no reset. */
  advanceStage() {
    if (!this.canAdvanceStage()) return false;
    this.state.stage += 1;
    this.state.stagesCleared += 1;
    return {
      realm: this.currentRealm(),
      stageIndex: this.state.stage - 1,
    };
  },

  /** Label for the cultivator's current tier, e.g. "Foundation Establishment · Middle Stage". */
  tierLabel() {
    const realm = this.currentRealm();
    const idx = Math.min(this.state.stage, realm.stages.length - 1);
    const done = this.realmComplete();
    return {
      realm: realm.name, realmCN: realm.nameCN,
      stage: done ? 'Great Perfection' : realm.stages[idx],
      stageCN: done ? '大圆满' : realm.stagesCN[idx],
      complete: done,
    };
  },

  // -- Major breakthrough (Heavenly Tribulation = prestige) -----------------
  canBreakThrough() {
    return this.realmComplete() && !!this.nextRealm();
  },

  /** Dao Comprehension that a Tribulation would currently award. */
  pendingDaoGain() {
    return GameData.daoGainFor(this.state.runQi);
  },

  breakThrough() {
    if (!this.canBreakThrough()) return false;
    const gain = this.pendingDaoGain();
    this.state.daoComprehension += gain;
    this.state.realm += 1;
    this.state.stage = 0;            // re-enter the new realm at its first stage
    // Soft reset this run (keep lifetime stats, dao, realm, stagesCleared, upgrades, character).
    this.state.qi = 0;
    this.state.runQi = 0;
    GameData.generators.forEach(g => { this.state.owned[g.id] = 0; });
    return { gain, realm: GameData.realms[this.state.realm] };
  },

  // -------------------------------------------------------------------------
  // Core helpers
  // -------------------------------------------------------------------------
  _addQi(amount) {
    if (amount <= 0) return;
    this.state.qi += amount;
    this.state.runQi += amount;
    this.state.lifetimeQi += amount;
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

    // Idle combat advances while the app is open.
    if (window.Combat) Combat.tick(dtSec);

    // Passive sect contribution, scaled to cultivation pace.
    if (window.Sect && this.state.sect) {
      Sect.addContribution(Math.max(1, Math.sqrt(this.qiPerSecond())) * dtSec);
    }

    // Track the highest wall-clock time we've seen (anti-cheat baseline).
    const wall = TimeService.now();
    if (wall > this.state.maxSeenTime) this.state.maxSeenTime = wall;

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
    if (now < maxSeen - 60 * 1000) { // 60s grace for tz/DST/jitter
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

    const m = this.multipliers();
    const sectOffline = (window.Sect && Sect.offlineBonus) ? Sect.offlineBonus() : 0;
    const efficiency = Math.min(1, GameData.offline.efficiency + m.offlineBonus + sectOffline);
    const gained = this.qiPerSecond() * effective * efficiency;

    this._addQi(gained);
    this.state.lastSaved = now;
    if (now > this.state.maxSeenTime) this.state.maxSeenTime = now;

    return { seconds: elapsed, gained, capped, cheated: false };
  },

  persist() {
    this.state.lastSaved = TimeService.now();
    if (this.state.lastSaved > this.state.maxSeenTime) {
      this.state.maxSeenTime = this.state.lastSaved;
    }
    Storage.save(this.state);
  },

  hardReset() {
    Storage.wipe();
    this.state = this.newState();
    this._lastTickMono = TimeService.monotonicNow();
  },
};

window.Game = Game;
