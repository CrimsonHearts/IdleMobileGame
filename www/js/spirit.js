/* ===========================================================================
 * spirit.js — Spirit (Shen): the soul-cultivation layer above Qi, unlocked
 * at Nascent Soul. A sliver of every Qi gain condenses into Spirit (the
 * classical Jing → Qi → Shen refinement order) — no separate grind, just a
 * slow trickle spent on Spirit Insight ranks.
 * ========================================================================= */

const SPIRIT_REALM_REQ = 4; // Nascent Soul

const SPIRIT_DATA = [
  { id: 'clarity',     name: 'Lucid Clarity', icon: '🔮', stat: 'qi',      perRank: 0.015, desc: '+{v}% Qi.' },
  { id: 'foresight',   name: 'Foresight',     icon: '👁️', stat: 'trib',    perRank: 0.01,  desc: '+{v}% Tribulation success chance.' },
  { id: 'fortune',     name: "Fortune's Eye", icon: '🍀', stat: 'luck',    perRank: 0.03,  desc: '+{v}% Beast Egg & Artifact drop chance.' },
  { id: 'tranquility', name: 'Tranquil Mind', icon: '☯️', stat: 'offline', perRank: 0.02,  desc: '+{v}% offline cultivation efficiency.' },
];

const MAX_SPIRIT_RANK = 20;
const SPIRIT_QI_FRACTION = 0.002; // 0.2% of every Qi gain condenses into Spirit

const Spirit = {
  data: SPIRIT_DATA,
  MAX_RANK: MAX_SPIRIT_RANK,
  REALM_REQ: SPIRIT_REALM_REQ,

  unlocked() { return Game.state.realm >= SPIRIT_REALM_REQ; },
  get(id) { return SPIRIT_DATA.find(s => s.id === id); },
  rankOf(id) { return (Game.state.spirit.insight[id]) || 0; },
  magnitudeAt(id, rank) { const s = this.get(id); return s && rank > 0 ? s.perRank * rank : 0; },
  effectText(id) { const s = this.get(id); return s.desc.replace('{v}', Math.round(this.magnitudeAt(id, this.rankOf(id)) * 100)); },

  _sumStat(stat) {
    let sum = 0;
    for (const s of SPIRIT_DATA) if (s.stat === stat) sum += this.magnitudeAt(s.id, this.rankOf(s.id));
    return sum;
  },
  qiMult()       { return 1 + this._sumStat('qi'); },
  tribBonus()    { return this._sumStat('trib'); },
  luckMult()     { return 1 + this._sumStat('luck'); },
  offlineBonus() { return this._sumStat('offline'); },

  insightCost(id) { return Math.floor(40 * Math.pow(1.3, this.rankOf(id))); },

  /** Spend Spirit to permanently raise an insight rank. */
  refine(id) {
    const s = this.get(id);
    if (!s || !this.unlocked() || this.rankOf(id) >= MAX_SPIRIT_RANK) return false;
    const cost = this.insightCost(id);
    if (Game.state.spirit.essence < cost) return false;
    Game.state.spirit.essence -= cost;
    Game.state.spirit.insight[id] = this.rankOf(id) + 1;
    Game.persist();
    return true;
  },

  /** Called from Game._addQi: a sliver of every Qi gain condenses into Spirit. */
  onQiGain(amount) {
    if (!this.unlocked() || amount <= 0) return;
    const mult = window.Challenges ? Challenges.spiritMult() : 1;
    Game.state.spirit.essence += amount * SPIRIT_QI_FRACTION * mult;
  },
};

window.Spirit = Spirit;
