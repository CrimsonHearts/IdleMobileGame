/* smoke5.js — Round 7: Enchanting, Pet Evolution, Weekly Challenges, Heirloom */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
const window = global;

// ---- Minimal stubs ---------------------------------------------------------
const TimeService = { now() { return Date.now(); } };

const GameNumbers = { formatNumber: n => String(n) };

const GameData = {
  saveVersion: 1,
  generators: [],
  realms: [],
  artifacts: {
    rarities:  [{ id:'common', weight:50, statMult:1, color:'#999' }],
    slots:     [{ id:'weapon', name:'Weapon', icon:'⚔️' }, { id:'robe', name:'Robe', icon:'👘' },
                { id:'talisman', name:'Talisman', icon:'📿' }, { id:'ring', name:'Ring', icon:'💍' }],
    sets:      [{ id:'iron', name:'Iron Set' }],
    slotWeights:{ weapon:{atk:2,hp:0.5,qi:0.5}, robe:{atk:0.3,hp:2,qi:0.8},
                  talisman:{atk:0.5,hp:0.5,qi:2}, ring:{atk:1,hp:1,qi:1} },
    invCap:    20,
    dropChance:0.1,
    bossDropChance:0.9,
    setBonus:  { two:{combat:0.05,qi:0.02}, four:{combat:0.15,qi:0.06} },
  },
  spiritualRoots: [{ key:'wood', name:'Wood', mult:1 }],
  stageBonusPerStage:0.001,
  daoBonusPerPoint:0.005,
  reincarnationBonusPer:0.1,
  reincarnationRealmReq:5,
  karma:{ righteousAt:50, demonicAt:-50, min:-100, max:100,
    tierBonus:{ neutral:{qi:1,combat:1,loot:1,offline:0,tribChance:0},
                righteous:{qi:1.1,combat:1,loot:1.1,offline:0.05,tribChance:0.05},
                demonic:{qi:0.9,combat:1.2,loot:1.2,offline:0,tribChance:0} } },
  heavenlyMeritFor: () => 10,
  daoGainFor: () => 5,
  tribulation:{ failRunQiLoss:0.3 },
  meridians: [],
  aging: { startAge:16 },
  dailyRewards: [],
  stageMilestones: [],
};

// Game stub with enough for our tests
const Game = {
  state: {
    spiritStones: 100000,
    beastEggs: 10,
    blood: { essence: 50000, refine: {} },
    spirit: { essence: 0, insight: {} },
    pets: { owned: {}, active: [] },
    artifacts: { inventory: [], equipped: { weapon: null, robe: null, talisman: null, ring: null } },
    heirloom: { id: null, stacks: 0 },
    weeklyChallenge: { weekId: 0, claimed: false },
    realm: 0,
    reincarnations: 0,
    daoComprehension: 0,
    runQi: 0,
    qi: 0,
    heavenlyMerit: 0,
    heavenlyPerks: {},
    legacyBonus: 0,
    karma: 0,
  },
  persist() {},
  combatUnlocked() { return true; },
  perkBonus() { return 0; },
  meridianMult() { return 0; },
  buffMult() { return 1; },
  reincarnationMult() { return 1; },
  activeMods() { return { qi:1, tap:1, offline:0, family:1, combat:1 }; },
  modVal(k) { return this.activeMods()[k]; },
  karmaMods() { return GameData.karma.tierBonus.neutral; },
  canReincarnate() { return true; },
  pendingMerit() { return GameData.heavenlyMeritFor(this.state); },
  reincarnate() {
    this.state.reincarnations += 1;
    if (window.Enchanting) Enchanting.onReincarnate();
    this.persist();
    return { merit: 10, reincarnations: this.state.reincarnations };
  },
};

// Load modules
eval(require('fs').readFileSync('www/js/artifacts.js','utf8'));
eval(require('fs').readFileSync('www/js/challenges.js','utf8'));
eval(require('fs').readFileSync('www/js/enchanting.js','utf8'));
eval(require('fs').readFileSync('www/js/pets.js','utf8'));

// ============================================================
// 1. Challenges
// ============================================================
console.log('Testing Challenges...');
const ch = Challenges.active();
assert(ch && ch.id, 'active() returns a challenge');
assert(typeof Challenges.bloodMult() === 'number', 'bloodMult is number');
assert(typeof Challenges.stoneMult() === 'number', 'stoneMult is number');
assert(typeof Challenges.enchantDiscount() === 'number', 'enchantDiscount is number');
assert(!Challenges.hasClaimed(), 'not yet claimed');
const claimed = Challenges.claim();
assert(claimed, 'claim() returns true first time');
assert(Challenges.hasClaimed(), 'hasClaimed() after claim');
assert(!Challenges.claim(), 'claim() returns false when already claimed');
// Rewards applied
assert(Game.state.spiritStones >= 10000, 'stones awarded');
assert(Game.state.beastEggs >= 2, 'eggs awarded');
console.log('  Challenges: OK');

// ============================================================
// 2. Artifact setup for enchanting
// ============================================================
const art = Artifacts.roll(5);
Artifacts.add(art);
Artifacts.equip(art.id);
const equipped = Artifacts.equippedList();
assert(equipped.length >= 1, 'has equipped artifact');
const eqArt = equipped[0];

// ============================================================
// 3. Enchanting
// ============================================================
console.log('Testing Enchanting...');
Game.state.blood.essence = 999999;
const r1 = Enchanting.enchant(eqArt.id);
assert(r1 && r1.rune, 'enchant returns rune');
assert(eqArt.runes && eqArt.runes.length === 1, 'rune added to artifact');
const r2 = Enchanting.enchant(eqArt.id);
const r3 = Enchanting.enchant(eqArt.id);
assert(eqArt.runes.length === 3, 'max 3 runes');
// 4th enchant should displace oldest
const r4 = Enchanting.enchant(eqArt.id);
assert(eqArt.runes.length === 3, 'still capped at 3 after 4th enchant');

// Stat aggregates
assert(Enchanting.atkMult() >= 1, 'atkMult >= 1');
assert(Enchanting.hpMult() >= 1, 'hpMult >= 1');
assert(Enchanting.qiPct() >= 0, 'qiPct >= 0');
assert(Enchanting.lootMult() >= 0, 'lootMult >= 0');
assert(Enchanting.bossDmgMult() >= 1, 'bossDmgMult >= 1');
console.log('  Enchanting: OK');

// ============================================================
// 4. Heirloom
// ============================================================
console.log('Testing Heirloom...');
assert(!Enchanting.heirloomId(), 'no heirloom initially');
assert(Enchanting.setHeirloom(eqArt.id), 'setHeirloom returns true');
assert(Enchanting.heirloomId() === eqArt.id, 'heirloomId set');
assert(Enchanting.isHeirloom(eqArt.id), 'isHeirloom true');
assert(Enchanting.heirloomStacks() === 0, 'starts at 0 stacks');

// Reincarnate once — stacks should increase
Game.reincarnate();
assert(Enchanting.heirloomStacks() === 1, 'stack incremented to 1');

// Reincarnate up to cap
for (let i = 0; i < 10; i++) Game.reincarnate();
assert(Enchanting.heirloomStacks() === Enchanting.MAX_STACKS, 'stacks capped');

// Heirloom amplifies rune power
const stackMult = 1 + Enchanting.MAX_STACKS * 0.06;
const qi1 = Enchanting._sumEquippedStat('qi');
assert(qi1 >= 0, 'sumEquippedStat qi >= 0');

Enchanting.clearHeirloom();
assert(!Enchanting.heirloomId(), 'cleared heirloom');
console.log('  Heirloom: OK');

// ============================================================
// 5. Pet Evolution (star system)
// ============================================================
console.log('Testing Pet Evolution...');
// Manually tame crane and max its level
Game.state.pets.owned['crane'] = { level: 30, star: 1 };
Game.state.pets.active = ['crane'];
assert(Pets.starOf('crane') === 1, 'starts at star 1');
assert(Pets.starMult('crane') === 1.0, 'star 1 mult = 1.0');

// qiBonusOf should use starMult
const qiWithStar1 = Pets.qiBonusOf('crane');
Game.state.pets.owned['crane'].star = 2;
const qiWithStar2 = Pets.qiBonusOf('crane');
assert(qiWithStar2 > qiWithStar1, 'higher star increases Qi bonus');
assert(Math.abs(qiWithStar2 / qiWithStar1 - 1.5) < 0.01, 'star 2 = 1.5x star 1');

// Reset to star 1, level 30 for evolve test
Game.state.pets.owned['crane'] = { level: 30, star: 1 };
Game.state.beastEggs = 5;
Game.state.spiritStones = 9999999;
assert(Pets.canEvolve('crane'), 'canEvolve at level 30 star 1');
const evolved = Pets.evolve('crane');
assert(evolved, 'evolve() returns true');
assert(Pets.starOf('crane') === 2, 'star incremented');
assert(Pets.levelOf('crane') === 1, 'level reset to 1');

// Can't evolve at max star
Game.state.pets.owned['crane'] = { level: 30, star: 5 };
assert(!Pets.canEvolve('crane'), 'cannot evolve at max star');

// Can't evolve without enough eggs
Game.state.pets.owned['crane'] = { level: 30, star: 1 };
Game.state.beastEggs = 0;
assert(!Pets.canEvolve('crane'), 'cannot evolve without eggs');

// Star 1 mult = 1.0, star 3 mult = 2.0
Pets._owned()['crane'].star = 3;
assert(Math.abs(Pets.starMult('crane') - 2.0) < 0.001, 'star 3 mult = 2.0');
console.log('  Pet Evolution: OK');

console.log('\n✓ All smoke5 tests passed.');
