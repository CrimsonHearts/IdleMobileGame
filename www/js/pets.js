/* ===========================================================================
 * pets.js — Spirit Beasts. Collectible companions that:
 *   • passively enhance cultivation (Qi production) — bonus from ALL owned beasts
 *   • fight alongside you in Trials — ATK/HP from your ACTIVE beasts (max 3)
 * Tamed with Beast Eggs, levelled with Spirit Stones.
 * ========================================================================= */

const PET_RARITY = {
  common: { name: 'Mortal',   color: '#9c9488', weight: 50 },
  rare:   { name: 'Spirit',   color: '#6fb594', weight: 28 },
  epic:   { name: 'King',     color: '#5aa9e6', weight: 14 },
  legend: { name: 'Saint',    color: '#e7c878', weight: 7 },
  mythic: { name: 'Divine',   color: '#c8503f', weight: 1 },
};

const PETS_DATA = [
  { id: 'crane',   name: 'Immortal Crane',  icon: 'ic-crane',   rarity: 'common', qiBonus: 0.04, atk: 6,   hp: 40,  desc: 'A serene crane whose cries clear the cultivator’s mind.' },
  { id: 'fox',     name: 'Spirit Fox',      icon: 'ic-fox',     rarity: 'rare',   qiBonus: 0.08, atk: 14,  hp: 55,  desc: 'A nine-tailed fox brimming with cunning and spiritual energy.' },
  { id: 'tortoise',name: 'Black Tortoise',  icon: 'ic-tortoise',rarity: 'rare',   qiBonus: 0.05, atk: 5,   hp: 150, desc: 'An ancient tortoise of the north — an unyielding shield.' },
  { id: 'tiger',   name: 'Flame Tiger',     icon: 'ic-tiger',   rarity: 'epic',   qiBonus: 0.06, atk: 32,  hp: 90,  desc: 'A blazing tiger whose roar scatters demonic beasts.' },
  { id: 'serpent', name: 'Thunder Serpent', icon: 'ic-serpent', rarity: 'epic',   qiBonus: 0.07, atk: 36,  hp: 70,  desc: 'A serpent wreathed in lightning, swift and deadly.' },
  { id: 'qilin',   name: 'Auspicious Qilin',icon: 'ic-qilin',   rarity: 'legend', qiBonus: 0.15, atk: 52,  hp: 165, desc: 'A divine qilin said to herald the birth of sages.' },
  { id: 'phoenix', name: 'Vermillion Phoenix', icon: 'ic-phoenix', rarity: 'legend', qiBonus: 0.14, atk: 62, hp: 125, desc: 'Reborn from flame, its plumage burns away all impurity.' },
  { id: 'dragon',  name: 'Azure Dragon',    icon: 'ic-dragon',  rarity: 'mythic', qiBonus: 0.25, atk: 105, hp: 270, desc: 'A true dragon of the eastern seas — sovereign of all beasts.' },
];

const MAX_ACTIVE_PETS = 3;
const MAX_PET_LEVEL = 30;
const MAX_PET_STAR = 5;

const Pets = {
  data: PETS_DATA,
  rarity: PET_RARITY,
  MAX_ACTIVE: MAX_ACTIVE_PETS,
  MAX_LEVEL: MAX_PET_LEVEL,

  get(id) { return PETS_DATA.find(p => p.id === id); },
  _owned() { return Game.state.pets.owned; },
  isOwned(id) { return !!this._owned()[id]; },
  levelOf(id) { const o = this._owned()[id]; return o ? o.level : 0; },
  active() { return Game.state.pets.active || []; },
  isActive(id) { return this.active().includes(id); },

  // -- Stat scaling ---------------------------------------------------------
  qiBonusOf(id) { const p = this.get(id), l = this.levelOf(id); return l ? p.qiBonus * (1 + 0.08 * (l - 1)) * this.starMult(id) : 0; },
  atkOf(id)     { const p = this.get(id), l = this.levelOf(id); return l ? p.atk    * (1 + 0.15 * (l - 1)) * this.starMult(id) : 0; },
  hpOf(id)      { const p = this.get(id), l = this.levelOf(id); return l ? p.hp     * (1 + 0.15 * (l - 1)) * this.starMult(id) : 0; },

  /** Global Qi multiplier from ALL owned beasts (the "spirit beast bond"). */
  qiMult() {
    let sum = 0;
    for (const id in this._owned()) sum += this.qiBonusOf(id);
    const sect = (window.Sect && Sect.petBonusMult) ? Sect.petBonusMult() : 1;
    return 1 + sum * sect;
  },

  /** Combat contribution from ACTIVE beasts only. */
  combatAtk() {
    const sect = (window.Sect && Sect.petBonusMult) ? Sect.petBonusMult() : 1;
    return this.active().reduce((s, id) => s + this.atkOf(id), 0) * sect;
  },
  combatHp() {
    return this.active().reduce((s, id) => s + this.hpOf(id), 0);
  },

  // -- Taming (gacha with Beast Eggs) --------------------------------------
  rollPet() {
    const total = PETS_DATA.reduce((s, p) => s + PET_RARITY[p.rarity].weight, 0);
    let n = Math.random() * total;
    for (const p of PETS_DATA) { if ((n -= PET_RARITY[p.rarity].weight) <= 0) return p; }
    return PETS_DATA[0];
  },

  tame() {
    if (Game.state.beastEggs < 1) return null;
    Game.state.beastEggs -= 1;
    const p = this.rollPet();
    const owned = this._owned();
    let duplicate = false;
    if (owned[p.id]) { // dupe → +1 level (capped)
      if (owned[p.id].level < MAX_PET_LEVEL) owned[p.id].level += 1;
      duplicate = true;
    }
    else {
      owned[p.id] = { level: 1 };
      if (this.active().length < MAX_ACTIVE_PETS) Game.state.pets.active.push(p.id);
    }
    Game.persist();
    return { pet: p, duplicate };
  },

  levelUpCost(id) {
    const p = this.get(id), l = this.levelOf(id);
    const rf = { common: 1, rare: 2, epic: 4, legend: 8, mythic: 16 }[p.rarity];
    return Math.floor(40 * rf * Math.pow(1.18, l));
  },

  levelUp(id) {
    if (!this.isOwned(id) || this.levelOf(id) >= MAX_PET_LEVEL) return false;
    const cost = this.levelUpCost(id);
    if (Game.state.spiritStones < cost) return false;
    Game.state.spiritStones -= cost;
    this._owned()[id].level += 1;
    Game.persist();
    return true;
  },

  toggleActive(id) {
    if (!this.isOwned(id)) return;
    const a = Game.state.pets.active;
    const i = a.indexOf(id);
    if (i >= 0) a.splice(i, 1);
    else if (a.length < MAX_ACTIVE_PETS) a.push(id);
    Game.persist();
  },

  // -- Star Evolution -------------------------------------------------------
  MAX_STAR: MAX_PET_STAR,
  starOf(id)   { const o = this._owned()[id]; return (o && o.star) || 1; },
  starMult(id) { return 1 + (this.starOf(id) - 1) * 0.5; },

  evolveCost(id) {
    const p = this.get(id);
    if (!p) return Infinity;
    const rf = { common: 1, rare: 2, epic: 4, legend: 8, mythic: 16 }[p.rarity] || 1;
    return Math.floor(200 * rf * Math.pow(2, this.starOf(id) - 1));
  },

  canEvolve(id) {
    if (!this.isOwned(id)) return false;
    if (this.levelOf(id) < MAX_PET_LEVEL) return false;
    if (this.starOf(id) >= MAX_PET_STAR) return false;
    return Game.state.beastEggs >= 1 && Game.state.spiritStones >= this.evolveCost(id);
  },

  evolve(id) {
    if (!this.canEvolve(id)) return false;
    Game.state.beastEggs -= 1;
    Game.state.spiritStones -= this.evolveCost(id);
    this._owned()[id].star = this.starOf(id) + 1;
    // level intentionally kept — resetting to 1 would make the evolved pet weaker than pre-evolution
    Game.persist();
    return true;
  },
};

window.Pets = Pets;
window.PET_RARITY = PET_RARITY;
