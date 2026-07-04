/* ===========================================================================
 * boosters.js — Round 9: Cultivation Boosters, a stacking timed-buff layer.
 * Four independent buffs (Qi / Loot / Combat / Luck) can each be activated by
 * watching a rewarded ad (free, capped per day) or spending Spirit Stones
 * (uncapped, but pricier with each same-day use). Multiple different
 * boosters can run at once; re-activating one before it expires extends it.
 * ========================================================================= */

const BOOSTER_TYPES = [
  { id: 'qiSurge',    name: 'Qi Surge',    icon: '⚡', stat: 'qi',     mult: 2,   desc: '2× Qi production' },
  { id: 'lootRush',   name: 'Loot Rush',   icon: '💰', stat: 'loot',   mult: 2,   desc: '2× Spirit Stones & Blood Essence from Trials' },
  { id: 'battleFury', name: 'Battle Fury', icon: '🗡️', stat: 'combat', mult: 1.5, desc: '1.5× Combat ATK' },
  { id: 'luckyStar',  name: 'Lucky Star',  icon: '🍀', stat: 'luck',   mult: 2,   desc: '2× Beast Egg & Artifact drop chance' },
];

const BOOSTER_DURATION_MS = 5 * 60 * 1000; // 5 min per activation, matches the existing ad-boost convention
const BOOSTER_ADS_PER_DAY = 3;             // free activations per booster per day
const BOOSTER_STONE_BASE = 200;            // base Spirit Stone cost, scales with realm + same-day use count

const Boosters = {
  data: BOOSTER_TYPES,
  DURATION_MS: BOOSTER_DURATION_MS,
  ADS_PER_DAY: BOOSTER_ADS_PER_DAY,

  get(id) { return BOOSTER_TYPES.find(b => b.id === id); },

  _today() { return Game._today(); },

  _state(id) {
    if (!Game.state.boosters) Game.state.boosters = {};
    if (!Game.state.boosters[id]) Game.state.boosters[id] = { endsAt: 0, adsToday: 0, stonesToday: 0, day: null };
    const s = Game.state.boosters[id];
    if (s.day !== this._today()) { s.day = this._today(); s.adsToday = 0; s.stonesToday = 0; }
    return s;
  },

  isActive(id) { return this._state(id).endsAt > TimeService.now(); },
  timeLeft(id) { return Math.max(0, Math.ceil((this._state(id).endsAt - TimeService.now()) / 1000)); },
  adsLeftToday(id) { return Math.max(0, BOOSTER_ADS_PER_DAY - this._state(id).adsToday); },

  stoneCost(id) {
    const s = this._state(id);
    return Math.floor(BOOSTER_STONE_BASE * (1 + Game.state.realm) * Math.pow(1.6, s.stonesToday));
  },

  _extend(id) {
    const s = this._state(id);
    const base = Math.max(s.endsAt, TimeService.now());
    s.endsAt = base + BOOSTER_DURATION_MS;
  },

  /** Called after a rewarded ad completes successfully. */
  activateViaAd(id) {
    if (!this.get(id) || this.adsLeftToday(id) <= 0) return false;
    this._state(id).adsToday += 1;
    this._extend(id);
    Game.state.lifetimeBoosterActivations = (Game.state.lifetimeBoosterActivations || 0) + 1;
    if (window.Dailies) Dailies.onBooster();
    Game.persist();
    return true;
  },

  /** Spend Spirit Stones for an instant activation. */
  activateWithStones(id) {
    if (!this.get(id)) return false;
    const cost = this.stoneCost(id);
    if (Game.state.spiritStones < cost) return false;
    Game.state.spiritStones -= cost;
    this._state(id).stonesToday += 1;
    this._extend(id);
    Game.state.lifetimeBoosterActivations = (Game.state.lifetimeBoosterActivations || 0) + 1;
    if (window.Dailies) Dailies.onBooster();
    Game.persist();
    return true;
  },

  _mult(stat) {
    let mult = 1;
    for (const b of BOOSTER_TYPES) if (b.stat === stat && this.isActive(b.id)) mult *= b.mult;
    return mult;
  },
  qiMult()     { return this._mult('qi'); },
  lootMult()   { return this._mult('loot'); },
  combatMult() { return this._mult('combat'); },
  luckMult()   { return this._mult('luck'); },
};

window.Boosters = Boosters;
