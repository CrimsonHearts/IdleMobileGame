/* ===========================================================================
 * techniques.js — Combat Techniques. Passive martial arts learned with
 * Spirit Stones and ranked up over time (max rank 10 each). Only up to
 * MAX_ACTIVE techniques can be equipped at once, so the player must pick a
 * build instead of just stacking every bonus — equip Iron Body + Guardian's
 * Ward to tank deep Zones, or Piercing Strike + Doom Strike to burn through
 * Bosses fast.
 * ========================================================================= */

const TECHNIQUES_DATA = [
  { id: 'iron_body',   name: 'Iron Body Art',   icon: '🛡️', stat: 'hp',         perRank: 0.06, desc: '+{v}% max HP.' },
  { id: 'piercing',    name: 'Piercing Strike',  icon: '⚔️', stat: 'atk',        perRank: 0.05, desc: '+{v}% ATK.' },
  { id: 'vital_drain', name: 'Vital Drain',      icon: '🩸', stat: 'lifesteal',  perRank: 0.02, desc: 'Heal {v}% of damage dealt.' },
  { id: 'ward',        name: "Guardian's Ward",  icon: '🌀', stat: 'mitigation', perRank: 0.02, desc: '-{v}% incoming damage.' },
  { id: 'doom_strike', name: 'Doom Strike',      icon: '💀', stat: 'bossDmg',    perRank: 0.08, desc: '+{v}% damage to Bosses.' },
];

const MAX_ACTIVE_TECHNIQUES = 3;
const MAX_TECHNIQUE_RANK = 10;
const MITIGATION_CAP = 0.75;

const Techniques = {
  data: TECHNIQUES_DATA,
  MAX_ACTIVE: MAX_ACTIVE_TECHNIQUES,
  MAX_RANK: MAX_TECHNIQUE_RANK,

  get(id) { return TECHNIQUES_DATA.find(t => t.id === id); },
  _owned() { return Game.state.techniques.owned; },
  rankOf(id) { return this._owned()[id] || 0; },
  isLearned(id) { return this.rankOf(id) > 0; },
  active() { return Game.state.techniques.active || []; },
  isActive(id) { return this.active().includes(id); },

  /** Magnitude of a technique's effect at a given rank (0 = not learned). */
  magnitudeAt(id, rank) {
    const t = this.get(id);
    return t && rank > 0 ? t.perRank * rank : 0;
  },
  /** Human-readable effect text with {v} filled in (percentage at the given rank). */
  effectText(id, rank) {
    const t = this.get(id);
    return t.desc.replace('{v}', Math.round(this.magnitudeAt(id, rank) * 100));
  },

  /** Only EQUIPPED (active) techniques affect combat. */
  _sumActiveStat(stat) {
    let sum = 0;
    for (const t of TECHNIQUES_DATA) if (t.stat === stat && this.isActive(t.id)) sum += this.magnitudeAt(t.id, this.rankOf(t.id));
    return sum;
  },
  hpMult()         { return 1 + this._sumActiveStat('hp'); },
  atkMult()        { return 1 + this._sumActiveStat('atk'); },
  lifestealFrac()  { return this._sumActiveStat('lifesteal'); },
  mitigationFrac() { return Math.min(MITIGATION_CAP, this._sumActiveStat('mitigation')); },
  bossDmgMult()    { return 1 + this._sumActiveStat('bossDmg'); },

  learnCost(id) {
    return Math.floor(150 * Math.pow(1.35, this.rankOf(id)));
  },

  /** Learn (rank 0→1) or rank up an already-learned technique. Newly-learned
   *  techniques auto-equip if there's a free active slot. */
  learn(id) {
    const t = this.get(id);
    if (!t || this.rankOf(id) >= MAX_TECHNIQUE_RANK) return false;
    const cost = this.learnCost(id);
    if (Game.state.spiritStones < cost) return false;
    Game.state.spiritStones -= cost;
    const owned = this._owned();
    const wasNew = !owned[id];
    owned[id] = (owned[id] || 0) + 1;
    if (wasNew && this.active().length < MAX_ACTIVE_TECHNIQUES) Game.state.techniques.active.push(id);
    Game.persist();
    return true;
  },

  toggleActive(id) {
    if (!this.isLearned(id)) return;
    const a = Game.state.techniques.active;
    const i = a.indexOf(id);
    if (i >= 0) a.splice(i, 1);
    else if (a.length < MAX_ACTIVE_TECHNIQUES) a.push(id);
    Game.persist();
  },
};

window.Techniques = Techniques;
