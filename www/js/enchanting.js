/* ===========================================================================
 * enchanting.js — Artifact Rune Enchanting + Ancestral Heirloom.
 *
 * Enchanting: spend Blood Essence to roll a random rune onto an equipped
 * artifact (max 3 runes per piece; oldest rune is replaced when full).
 * Only runes on EQUIPPED artifacts contribute to stats.
 *
 * Heirloom: designate one artifact as your ancestral heirloom. It gains an
 * Inheritance Stack each time you reincarnate, amplifying its rune power.
 * ========================================================================= */

const RUNE_TYPES = [
  { id: 'swift_kill',   name: 'Swift Kill',   icon: '⚔️', stat: 'atk',     range: [0.02, 0.06], desc: '+{v}% ATK.' },
  { id: 'resilience',   name: 'Resilience',   icon: '🛡️', stat: 'hp',      range: [0.02, 0.06], desc: '+{v}% HP.' },
  { id: 'qi_resonance', name: 'Qi Resonance', icon: '🌀', stat: 'qi',      range: [0.01, 0.04], desc: '+{v}% Qi.' },
  { id: 'stone_find',   name: 'Stone Find',   icon: '💠', stat: 'loot',    range: [0.03, 0.10], desc: '+{v}% Spirit Stones.' },
  { id: 'soul_brand',   name: 'Soul Brand',   icon: '💀', stat: 'bossDmg', range: [0.04, 0.12], desc: '+{v}% Boss Damage.' },
];

const MAX_RUNES = 3;
const MAX_HEIRLOOM_STACKS = 5;
const HEIRLOOM_BONUS_PER_STACK = 0.06; // +6% rune power per stack on the heirloom piece

const Enchanting = {
  types: RUNE_TYPES,
  MAX_RUNES,
  MAX_STACKS: MAX_HEIRLOOM_STACKS,

  // -- Heirloom helpers -------------------------------------------------------
  heirloomId()     { return Game.state.heirloom ? Game.state.heirloom.id : null; },
  heirloomStacks() { return (Game.state.heirloom && Game.state.heirloom.stacks) || 0; },
  isHeirloom(artifactId) { return this.heirloomId() === artifactId; },

  setHeirloom(artifactId) {
    if (!this._findArtifact(artifactId)) return false;
    const stacks = Game.state.heirloom ? Game.state.heirloom.stacks : 0;
    Game.state.heirloom = { id: artifactId, stacks };
    Game.persist();
    return true;
  },

  clearHeirloom() {
    Game.state.heirloom = { id: null, stacks: 0 };
    Game.persist();
  },

  /** Called from Game.reincarnate() — the heirloom grows stronger each life. */
  onReincarnate() {
    if (!this.heirloomId()) return;
    if (!this._findArtifact(this.heirloomId())) return; // was salvaged
    Game.state.heirloom.stacks = Math.min(MAX_HEIRLOOM_STACKS, this.heirloomStacks() + 1);
  },

  // -- Enchanting cost -------------------------------------------------------
  _rarityMult(rarity) {
    return { common: 1, rare: 2, epic: 4, legend: 8, mythic: 16 }[rarity] || 1;
  },

  enchantCost(artifact) {
    const runeCount = (artifact.runes || []).length;
    const discount = window.Challenges ? Challenges.enchantDiscount() : 0;
    return Math.floor(300 * this._rarityMult(artifact.rarity) * Math.pow(2, runeCount) * (1 - discount));
  },

  // -- Roll a rune -----------------------------------------------------------
  enchant(artifactId) {
    const artifact = this._findArtifact(artifactId);
    if (!artifact) return false;
    const cost = this.enchantCost(artifact);
    if (Game.state.blood.essence < cost) return false;
    Game.state.blood.essence -= cost;

    const rune = RUNE_TYPES[Math.floor(Math.random() * RUNE_TYPES.length)];
    const [min, max] = rune.range;
    const value = +((min + Math.random() * (max - min)).toFixed(3));

    if (!artifact.runes) artifact.runes = [];
    if (artifact.runes.length >= MAX_RUNES) artifact.runes.shift();
    artifact.runes.push({ id: rune.id, value });
    Game.persist();
    return { rune, value };
  },

  _findArtifact(id) {
    const s = Game.state.artifacts;
    return Object.values(s.equipped).find(a => a && a.id === id)
        || s.inventory.find(a => a.id === id);
  },

  // -- Aggregate bonuses (only from EQUIPPED artifacts' runes) ---------------
  _sumEquippedStat(stat) {
    let sum = 0;
    const stackMult = 1 + this.heirloomStacks() * HEIRLOOM_BONUS_PER_STACK;
    Artifacts.equippedList().forEach(a => {
      if (!a.runes) return;
      const isHL = this.isHeirloom(a.id);
      a.runes.forEach(r => {
        const rt = RUNE_TYPES.find(t => t.id === r.id);
        if (rt && rt.stat === stat) sum += r.value * (isHL ? stackMult : 1);
      });
    });
    return sum;
  },

  atkMult()    { return 1 + this._sumEquippedStat('atk'); },
  hpMult()     { return 1 + this._sumEquippedStat('hp'); },
  qiPct()      { return this._sumEquippedStat('qi'); },
  lootMult()   { return this._sumEquippedStat('loot'); },
  bossDmgMult(){ return 1 + this._sumEquippedStat('bossDmg'); },
};

window.Enchanting = Enchanting;
