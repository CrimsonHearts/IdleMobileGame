/* ===========================================================================
 * blood.js — Blood Essence (Jing): the body-refinement layer beneath Qi.
 * Earned from blood spilled in Trials, spent on permanent Body Refinement
 * ranks. Unlike Techniques there's no equip cap — every rank you buy stays
 * active, since Jing is foundational tempering, not a tactical loadout.
 * ========================================================================= */

const BLOOD_DATA = [
  { id: 'tempered_flesh', name: 'Tempered Flesh', icon: '💪', stat: 'atk',  perRank: 0.02, desc: '+{v}% ATK.' },
  { id: 'iron_bones',     name: 'Iron Bones',      icon: '🦴', stat: 'hp',   perRank: 0.02, desc: '+{v}% max HP.' },
  { id: 'vital_pulse',    name: 'Vital Pulse',     icon: '❤️', stat: 'heal', perRank: 0.03, desc: '+{v}% healing on wave clear.' },
  { id: 'dragons_blood',  name: "Dragon's Blood",  icon: '🐉', stat: 'qi',   perRank: 0.01, desc: '+{v}% Qi (refined Jing feeds Qi).' },
];

const MAX_BLOOD_RANK = 20;

const Blood = {
  data: BLOOD_DATA,
  MAX_RANK: MAX_BLOOD_RANK,

  unlocked() { return Game.combatUnlocked(); },
  get(id) { return BLOOD_DATA.find(b => b.id === id); },
  rankOf(id) { return (Game.state.blood.refine[id]) || 0; },
  magnitudeAt(id, rank) { const b = this.get(id); return b && rank > 0 ? b.perRank * rank : 0; },
  effectText(id) { const b = this.get(id); return b.desc.replace('{v}', Math.round(this.magnitudeAt(id, this.rankOf(id)) * 100)); },

  _sumStat(stat) {
    let sum = 0;
    for (const b of BLOOD_DATA) if (b.stat === stat) sum += this.magnitudeAt(b.id, this.rankOf(b.id));
    return sum;
  },
  atkMult()  { return 1 + this._sumStat('atk'); },
  hpMult()   { return 1 + this._sumStat('hp'); },
  qiMult()   { return 1 + this._sumStat('qi'); },
  healBonus() { return this._sumStat('heal'); },

  refineCost(id) { return Math.floor(80 * Math.pow(1.28, this.rankOf(id))); },

  /** Spend Blood Essence to permanently raise a refinement rank. */
  refine(id) {
    const b = this.get(id);
    if (!b || !this.unlocked() || this.rankOf(id) >= MAX_BLOOD_RANK) return false;
    const cost = this.refineCost(id);
    if (Game.state.blood.essence < cost) return false;
    Game.state.blood.essence -= cost;
    Game.state.blood.refine[id] = this.rankOf(id) + 1;
    Game.persist();
    return true;
  },

  /** Called by Combat on every kill — blood spilled in battle. */
  gain(amount) {
    if (!this.unlocked() || amount <= 0) return;
    Game.state.blood.essence += amount;
  },
};

window.Blood = Blood;
