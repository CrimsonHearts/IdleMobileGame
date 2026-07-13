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

  /** Called when the heirloom artifact is salvaged. Clears only the id — Inheritance Stacks
   *  are lifetime progress and survive losing the physical artifact. */
  clearHeirloomArtifact(id) {
    if (!this.isHeirloom(id)) return;
    if (Game.state.heirloom) Game.state.heirloom.id = null;
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

  /** `runeCountOverride` lets autoEnchantPreview() cost out a hypothetical
   *  future rune count without mutating the real artifact. */
  enchantCost(artifact, runeCountOverride) {
    const runeCount = runeCountOverride !== undefined ? runeCountOverride : (artifact.runes || []).length;
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
    if (window.Dailies) Dailies.onEnchant();
    Game.persist();
    return { rune, value };
  },

  /** Repeatedly enchants whichever EQUIPPED piece is currently cheapest to
   *  enchant, until Blood Essence runs out (or nothing's equipped). Only
   *  equipped gear's runes count toward stats — see the file header — so
   *  auto-enhance never touches the inventory. "Cheapest first" maximizes
   *  the number of rolls per Blood Essence spent, mirroring the "spend to
   *  the max" convention already used by Auto-Equip/Brew Max/Use Max.
   *  Bounded to 1000 rolls/call — costs plateau once a piece hits
   *  MAX_RUNES (further rolls replace the oldest at the same cost), so an
   *  unbounded loop against a very large Essence pool could otherwise run
   *  a very long time for no real gameplay benefit. */
  autoEnchant() {
    let count = 0;
    for (let i = 0; i < 1000; i++) {
      const equipped = Artifacts.equippedList();
      if (!equipped.length) break;
      let cheapest = null, cheapestCost = Infinity;
      equipped.forEach(a => {
        const cost = this.enchantCost(a);
        if (cost < cheapestCost) { cheapestCost = cost; cheapest = a; }
      });
      if (!cheapest || Game.state.blood.essence < cheapestCost) break;
      if (!this.enchant(cheapest.id)) break;
      count++;
    }
    return count;
  },
  /** Non-mutating dry run of autoEnchant() — how many rolls the current
   *  Blood Essence affords right now, for the UI button's live preview. */
  autoEnchantPreview() {
    const equipped = Artifacts.equippedList();
    if (!equipped.length) return 0;
    let essence = Game.state.blood.essence;
    const virtualRuneCount = {};
    equipped.forEach(a => { virtualRuneCount[a.id] = (a.runes || []).length; });
    let count = 0;
    for (let i = 0; i < 1000; i++) {
      let cheapest = null, cheapestCost = Infinity;
      equipped.forEach(a => {
        const cost = this.enchantCost(a, virtualRuneCount[a.id]);
        if (cost < cheapestCost) { cheapestCost = cost; cheapest = a; }
      });
      if (!cheapest || essence < cheapestCost) break;
      essence -= cheapestCost;
      virtualRuneCount[cheapest.id] = Math.min(MAX_RUNES, virtualRuneCount[cheapest.id] + 1);
      count++;
    }
    return count;
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
