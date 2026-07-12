/* ===========================================================================
 * dailies.js — Daily Mission Board (Round 11).
 * Five missions generated each day from a deterministic seed (the date string).
 * Completing all five claims a 2-hour Cultivation Seal (+2× Qi production).
 * A 7-day consecutive streak unlocks a weekly artifact chest.
 * ========================================================================= */

const MISSION_TEMPLATES = [
  { type: 'kills',    label: n => `Defeat ${n} enemies in Trials`,       targets: [20,  50,  100] },
  { type: 'boss',     label: n => `Defeat ${n} Trial boss(es)`,          targets: [1,   2,   3]   },
  { type: 'stones',   label: n => `Collect ${n.toLocaleString()} Stones`,targets: [500, 2000,8000] },
  { type: 'booster',  label: n => `Activate a Booster ${n} time(s)`,    targets: [1,   2,   3]   },
  { type: 'equip',    label: n => `Equip an artifact ${n} time(s)`,      targets: [1,   2,   3]   },
  { type: 'pet_lvl',  label: n => `Level up a pet ${n} time(s)`,         targets: [1,   3,   5]   },
  { type: 'enchant',  label: n => `Enchant an artifact ${n} time(s)`,    targets: [1,   2,   3]   },
];

const SEAL_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
const WEEK_STREAK      = 7;                   // consecutive days required

const Dailies = {
  _today() { return Game._today(); },

  // -- Seeded deterministic PRNG (LCG) ---------------------------------------
  _hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return h >>> 0; // unsigned 32-bit
  },
  _lcg(seed) { return ((Math.imul(1664525, seed) + 1013904223) >>> 0); },

  // -- Mission generation ----------------------------------------------------
  _generate(day) {
    let seed = this._hash(day);
    const tier = Math.min(2, Math.floor((Game.state.realm || 0) / 3));
    const pool = MISSION_TEMPLATES.slice(); // work on a copy
    const result = [];

    while (result.length < 5 && pool.length > 0) {
      seed = this._lcg(seed);
      const idx = seed % pool.length;
      const tmpl = pool.splice(idx, 1)[0];
      const target = tmpl.targets[Math.min(tier, tmpl.targets.length - 1)];
      result.push({ type: tmpl.type, label: tmpl.label(target), target, progress: 0, completed: false });
    }
    return result;
  },

  // -- State access + daily rollover ----------------------------------------
  _s() { return Game.state.dailies; },

  _ensureDay() {
    const s  = this._s();
    const td = this._today();
    if (s.day !== td) {
      const todayNum = Game._dayNumber(TimeService.now());
      // Extend the streak only if the last tracked day was truly yesterday —
      // a multi-day gap (player away a week) must not silently preserve it.
      // Saves from before this check existed have no dayNum yet — grandfather
      // that ONE transition (trust the old allComplete-only signal) instead of
      // wiping an honest player's in-progress streak the moment they update;
      // dayNum gets backfilled below, so every transition after this is strict.
      const consecutive = s.dayNum === undefined ? true : s.dayNum === todayNum - 1;
      if (s.day !== null) {
        if (s.allComplete && consecutive) {
          s.streak = (s.streak || 0) + 1;
          if (s.streak >= WEEK_STREAK && !s.weekClaimed) s.weekReady = true;
        } else {
          s.streak    = 0;
          s.weekReady = false;
        }
      }
      s.day        = td;
      s.dayNum     = todayNum;
      s.missions   = this._generate(td);
      s.allComplete = false;
      s.sealClaimed = false;
      Game.persist();
    }
    return s;
  },

  missions()    { return this._ensureDay().missions; },
  streak()      { return this._ensureDay().streak || 0; },
  allComplete() { return !!this._ensureDay().allComplete; },
  sealClaimed() { return !!this._ensureDay().sealClaimed; },
  sealActive()  { return (this._s().sealEndsAt || 0) > TimeService.now(); },
  sealTimeLeft(){ return Math.max(0, Math.ceil(((this._s().sealEndsAt || 0) - TimeService.now()) / 1000)); },
  qiMult()      { return this.sealActive() ? 2 : 1; },

  weekReady()   { return !!(this._ensureDay().weekReady && !this._s().weekClaimed); },

  // -- Progress tracking -----------------------------------------------------
  _inc(type, n) {
    const s = this._ensureDay();
    let changed = false;
    for (const m of s.missions) {
      if (m.type === type && !m.completed) {
        m.progress = Math.min(m.target, m.progress + n);
        if (m.progress >= m.target) m.completed = true;
        changed = true;
        break; // only advance the first incomplete mission of this type per event
      }
    }
    if (changed) {
      s.allComplete = s.missions.every(m => m.completed);
      Game.persist();
    }
  },

  onKill()           { this._inc('kills',   1); },
  onBossKill()       { this._inc('boss',    1); },
  onStonesGained(n)  { this._inc('stones',  n); },
  onBooster()        { this._inc('booster', 1); },
  onEquip()          { this._inc('equip',   1); },
  onPetLevelUp()     { this._inc('pet_lvl', 1); },
  onEnchant()        { this._inc('enchant', 1); },

  // -- Rewards ---------------------------------------------------------------
  claimSeal() {
    const s = this._ensureDay();
    if (!s.allComplete || s.sealClaimed) return false;
    // Stack onto any existing seal time.
    s.sealEndsAt  = Math.max(s.sealEndsAt || 0, TimeService.now()) + SEAL_DURATION_MS;
    s.sealClaimed = true;
    Game.persist();
    return true;
  },

  claimWeekReward() {
    const s = this._ensureDay();
    if (!s.weekReady || s.weekClaimed) return false;
    // Grant 3 artifact rolls at a slightly elevated tier.
    if (window.Artifacts) {
      for (let i = 0; i < 3; i++) Artifacts.add(Artifacts.roll((Game.state.realm || 0) + 2));
    }
    s.weekReady   = false;
    // Reset weekClaimed alongside streak — weekClaimed only guards against
    // re-triggering weekReady WITHIN the current streak; leaving it true
    // would permanently lock out every future 7-day chest.
    s.weekClaimed = false;
    s.streak      = 0; // reset streak; start a fresh cycle
    Game.persist();
    return true;
  },
};
window.Dailies = Dailies;
