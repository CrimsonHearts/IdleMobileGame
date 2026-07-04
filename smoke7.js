/* smoke7.js — Round 10: Bug Fix Regression Tests */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
const window = global;

// ---- Minimal stubs ----------------------------------------------------------
const TimeService = { now() { return Date.now(); } };
const GameNumbers = { formatNumber: n => String(n), formatDuration: s => s + 's' };
const GameData = {
  artifacts: {
    slots: [{ id: 'weapon' }, { id: 'robe' }, { id: 'talisman' }, { id: 'ring' }],
    rarities: [{ id: 'common', weight: 50, statMult: 1 }],
    sets: [{ id: 'iron' }],
    slotWeights: { weapon: { atk: 2, hp: 0.5, qi: 0.3 }, robe: { atk: 0.5, hp: 2, qi: 0.3 }, talisman: { atk: 1, hp: 1, qi: 0.6 }, ring: { atk: 1, hp: 1, qi: 0.6 } },
    invCap: 20,
    dropChance: 0.1,
    bossDropChance: 0.5,
    setBonus: { two: { combat: 0.05, qi: 0.02 }, four: { combat: 0.15, qi: 0.06 } },
  },
};

const Game = {
  state: {
    realm: 0, spiritStones: 100000, beastEggs: 99,
    pets: { owned: {}, active: [] },
    combat: { zone: 1, wave: 1, playerHp: 100, paused: false },
    artifacts: { inventory: [], equipped: { weapon: null, robe: null, talisman: null, ring: null } },
    heirloom: { id: null, stacks: 0 },
    blood: { essence: 99999 },
    weeklyChallenge: { weekId: 0, claimed: false },
    boosters: {},
  },
  persist() {},
  _today() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); },
  _addQi() {},
  karmaLootMult() { return 1; },
  combatUnlocked() { return true; },
};

const Sect = { lootMult() { return 1; }, combatMult() { return 1; }, petBonusMult() { return 1; }, addContribution() {} };
const Spirit = { luckMult() { return 1; } };

eval(require('fs').readFileSync('www/js/enchanting.js', 'utf8'));
eval(require('fs').readFileSync('www/js/artifacts.js', 'utf8'));
eval(require('fs').readFileSync('www/js/pets.js', 'utf8'));

// Minimal Challenges stubs — replaced per test
let _trialHard = false;
const Challenges = {
  trialHard()   { return _trialHard; },
  stoneMult()   { return 1; },
  bloodMult()   { return 1; },
  eggMult()     { return 1; },
  enchantDiscount() { return 0; },
};
// Expose stubs on window (= global) so module guards like `window.Challenges &&` resolve
window.Challenges = Challenges;
window.Sect = Sect;
window.Spirit = Spirit;
window.Blood = { gain() {} };

eval(require('fs').readFileSync('www/js/combat.js', 'utf8'));

// ── Helper: build a minimal artifact and add it to inventory ──────────────────
function makeArtifact(id) {
  return { id, slot: 'weapon', rarity: 'common', set: 'iron', atk: 10, hp: 20, qi: 0.01 };
}

console.log('Testing Round 10 bug fixes...');

// ════════════════════════════════════════════════════════════════════════
// BUG 1 — Trial of Steel: loot should be 4× base, not 12× (3×HP × 4)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Bug 1: Trial of Steel loot multiplier');

_trialHard = false;
Combat.spawnMob();
const normalMob  = Combat.mob();
const normalBase = normalMob.baseHp;
assert(normalMob.baseHp === normalMob.maxHp, 'baseHp == maxHp when trial off');

_trialHard = true;
Combat.spawnMob();
const trialMob = Combat.mob();
assert(trialMob.maxHp === trialMob.baseHp * 3, 'maxHp is 3× baseHp under Trial of Steel');
assert(trialMob.baseHp === normalBase, 'baseHp unchanged by Trial of Steel');

// Simulate loot: stones are based on baseHp × 4 (not maxHp × 4 = 12×)
Game.state.spiritStones = 0;
Combat._loot(trialMob);
const trialStones = Game.state.spiritStones;

_trialHard = false;
Combat.spawnMob();
Game.state.spiritStones = 0;
Combat._loot(Combat.mob());
const normalStones = Game.state.spiritStones;

// Trial loot should be ~4× normal, NOT 12×
const ratio = trialStones / normalStones;
assert(ratio >= 3.8 && ratio <= 4.2, `Trial loot ratio should be ~4× (got ${ratio.toFixed(2)}×) — was 12× before fix`);
console.log(`    Trial loot ratio: ${ratio.toFixed(2)}× ✓ (expected 4×)`);

// ════════════════════════════════════════════════════════════════════════
// BUG 2 — Pet evolution: evolved pet must not lose stats (no level reset)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Bug 2: Pet evolution stat regression');

// Set up: own a crane at level MAX (30), 1 star
Game.state.pets.owned = {};
Game.state.pets.active = [];
Game.state.pets.owned['crane'] = { level: 30, star: 1 };
const atkBefore = Pets.atkOf('crane');
assert(atkBefore > 0, 'crane has ATK before evolution');

// Evolve
Game.state.beastEggs = 5;
Game.state.spiritStones = 999999;
const ok = Pets.evolve('crane');
assert(ok, 'evolve() returns true');
assert(Pets.starOf('crane') === 2, 'star incremented to 2');
assert(Pets.levelOf('crane') === 30, 'level remains at 30 after evolution (was reset to 1 before fix)');

const atkAfter = Pets.atkOf('crane');
assert(atkAfter > atkBefore, `evolved crane ATK (${atkAfter.toFixed(1)}) > pre-evolution (${atkBefore.toFixed(1)})`);
console.log(`    ATK before: ${atkBefore.toFixed(1)}, after: ${atkAfter.toFixed(1)} ✓`);

// ════════════════════════════════════════════════════════════════════════
// BUG 3 — Heirloom orphaning on salvage
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Bug 3: Heirloom orphan on salvage');

// 3a. Manual salvage
const artA = makeArtifact('art-aaa');
Game.state.artifacts.inventory = [artA];
Game.state.artifacts.equipped  = { weapon: null, robe: null, talisman: null, ring: null };
Enchanting.setHeirloom('art-aaa');
Game.state.heirloom.stacks = 3; // simulate 3 reincarnations
assert(Enchanting.heirloomId() === 'art-aaa', 'heirloom set');

Artifacts.salvage('art-aaa');
assert(Enchanting.heirloomId() === null, 'heirloom id cleared after salvage');
assert(Enchanting.heirloomStacks() === 3, 'stacks preserved (lifetime progress, not tied to artifact)');
console.log('    Manual salvage clears heirloom id, preserves stacks ✓');

// 3b. Auto-trim salvage (_trimToCap)
const artB = makeArtifact('art-bbb');
Game.state.artifacts.inventory = [];
Game.state.artifacts.equipped  = { weapon: null, robe: null, talisman: null, ring: null };
// fill inventory past cap with high-score items, plus artB as the worst
for (let i = 0; i < GameData.artifacts.invCap; i++) {
  Game.state.artifacts.inventory.push({ id: 'filler-' + i, slot: 'weapon', rarity: 'common', set: 'iron', atk: 9999, hp: 9999, qi: 0.99 });
}
Game.state.artifacts.inventory.push(artB); // this is the weakest, will be trimmed
Game.state.heirloom = { id: 'art-bbb', stacks: 2 };

Artifacts.add(makeArtifact('trigger-trim')); // adding one more triggers trim
assert(Enchanting.heirloomId() === null, 'heirloom id cleared when artifact auto-salvaged by trim');
assert(Enchanting.heirloomStacks() === 2, 'stacks preserved through auto-trim');
console.log('    Auto-trim salvage clears heirloom id, preserves stacks ✓');

// 3c. Equipped artifact cannot be salvaged via Artifacts.salvage (inventory only) — verify no crash
Game.state.artifacts.equipped.weapon = makeArtifact('art-equipped');
Game.state.heirloom = { id: 'art-equipped', stacks: 1 };
const result = Artifacts.salvage('art-equipped'); // not in inventory, should return false
assert(result === false, 'salvage returns false for equipped artifact (not in inventory)');
assert(Enchanting.heirloomId() === 'art-equipped', 'heirloom id untouched when salvage is a no-op');
console.log('    Salvage no-op on equipped artifact does not corrupt heirloom state ✓');

console.log('\n✓ All smoke7 tests passed.');
