/* smoke22.js — Round 24 "Auto-Enhance" regression tests.
 *
 * User request: "I would also like to auto enhance" (a follow-up to
 * Round 23's auto-equip/bulk-sell/unlockable-slots work). "Enhance" here
 * means Enchanting — spending Blood Essence to roll a random rune onto an
 * EQUIPPED artifact (only equipped gear's runes contribute to stats, per
 * enchanting.js's own header comment; unequipped inventory items are
 * never touched by auto-enhance for that reason).
 *
 * Enchanting.autoEnchant() repeatedly enchants whichever equipped piece is
 * currently CHEAPEST to enchant until Blood Essence runs out — this
 * maximizes rune rolls per Essence spent, mirroring the "spend to the
 * max" convention already used by Auto-Equip Best / Brew Max / Use Max /
 * Market MAX. Enchanting.autoEnchantPreview() is a non-mutating dry run
 * of the same logic, used to show a live "(N)" count on the UI button
 * before the player commits.
 */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };

global.window = global;
const _store = {};
global.localStorage = {
  getItem: k => (k in _store ? _store[k] : null),
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: k => { delete _store[k]; },
};
global.navigator = { onLine: false };
global.document = undefined;

const fs = require('fs');
['gameData', 'time', 'game', 'artifacts', 'enchanting'].forEach(m => {
  eval(fs.readFileSync(`www/js/${m}.js`, 'utf8'));
});
global.Storage = { save: () => true, wipe: () => {} };

console.log('Testing Round 24 Auto-Enhance...');

function freshGame() {
  Game.state = Game.newState();
  Game.state.spiritStones = 1e9;
  return Game;
}
function equipInSlot(slot, overrides) {
  const a = Object.assign({ id: 'a' + Math.random().toString(36).slice(2), slot, rarity: 'common', set: 'azure', atk: 10, hp: 10, qi: 0 }, overrides);
  Artifacts.add(a);
  Artifacts.equip(a.id);
  return a;
}

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — autoEnchant() with nothing equipped and/or no Essence is a safe no-op
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: Safe no-ops (nothing equipped / no Essence)');
{
  freshGame();
  assert(Enchanting.autoEnchant() === 0, 'nothing equipped -> 0 rolls');
  assert(Enchanting.autoEnchantPreview() === 0, 'preview also reports 0 with nothing equipped');

  equipInSlot('weapon');
  Game.state.blood.essence = 0;
  assert(Enchanting.autoEnchant() === 0, 'zero Essence -> 0 rolls even with gear equipped');
  assert(Enchanting.autoEnchantPreview() === 0, 'preview reports 0 with zero Essence');
}
console.log('    No-op cases handled safely ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — autoEnchant() only ever touches EQUIPPED gear, never inventory
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: Auto-enhance never enchants unequipped inventory items');
{
  freshGame();
  const equipped = equipInSlot('weapon');
  const bagged = { id: 'bagged-item', slot: 'robe', rarity: 'common', set: 'azure', atk: 5, hp: 5, qi: 0 };
  Artifacts.add(bagged); // sits in inventory, never equipped
  Game.state.blood.essence = 1e9;

  Enchanting.autoEnchant();
  assert((equipped.runes || []).length > 0, 'the equipped weapon gained runes');
  assert(!bagged.runes || bagged.runes.length === 0, 'the unequipped inventory item was never touched');
}
console.log('    Only equipped gear is ever enchanted ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — Cheapest-first prioritization: with two equipped pieces of
// different rarity, the cheaper (lower-rarity) one gets enchanted first
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: Cheapest-equipped-piece-first prioritization');
{
  freshGame();
  const cheap = equipInSlot('weapon', { rarity: 'common' });   // cost 300 * 1 = 300
  const pricey = equipInSlot('robe', { rarity: 'mythic' });    // cost 300 * 16 = 4800
  // Exactly enough for ONE common-tier roll, nowhere near a mythic one.
  Game.state.blood.essence = 350;

  const n = Enchanting.autoEnchant();
  assert(n === 1, `exactly 1 roll affordable (got ${n})`);
  assert((cheap.runes || []).length === 1, 'the cheap (common) piece was the one enchanted');
  assert(!pricey.runes || pricey.runes.length === 0, 'the expensive (mythic) piece was left alone — too costly to be "cheapest"');
}
console.log('    Always picks the currently-cheapest equipped piece ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — Essence is spent exactly, autoEnchant() stops precisely when
// the next roll (whichever is now cheapest) is unaffordable
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: Essence spending is exact, stops precisely at the affordability boundary');
{
  freshGame();
  equipInSlot('weapon', { rarity: 'common' }); // cost 300 for the first roll (0 runes)
  Game.state.blood.essence = 300; // enough for exactly 1 roll (next would cost 300*2=600, since count->1)

  const before = Game.state.blood.essence;
  const n = Enchanting.autoEnchant();
  assert(n === 1, `exactly 1 roll happened (got ${n})`);
  assert(Game.state.blood.essence === before - 300, `spent exactly 300 Essence (got ${before - Game.state.blood.essence} spent)`);
}
console.log('    Spends exactly what each roll costs, stops cleanly at the boundary ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — autoEnchantPreview() matches what autoEnchant() actually does,
// WITHOUT mutating any real state (the dry-run guarantee the UI relies on)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5: autoEnchantPreview() is an accurate, non-mutating dry run');
{
  freshGame();
  const a = equipInSlot('weapon', { rarity: 'rare' });
  Game.state.blood.essence = 5000;

  const essenceBefore = Game.state.blood.essence;
  const runesBefore = (a.runes || []).length;
  const predicted = Enchanting.autoEnchantPreview();

  assert(Game.state.blood.essence === essenceBefore, 'preview does not spend any Essence');
  assert((a.runes || []).length === runesBefore, 'preview does not add any runes to the real artifact');

  const actual = Enchanting.autoEnchant();
  assert(actual === predicted, `the real run matches the preview exactly (predicted ${predicted}, actual ${actual})`);
}
console.log('    Preview exactly predicts the real outcome and never touches real state ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 6 — Rune count caps at MAX_RUNES (3) per piece; cost plateaus once
// capped rather than growing forever (oldest rune replaced, not stacked)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 6: Rune count caps at MAX_RUNES, cost plateaus');
{
  freshGame();
  const a = equipInSlot('weapon', { rarity: 'common' });
  Game.state.blood.essence = 1e9;
  Enchanting.autoEnchant();
  assert(a.runes.length === Enchanting.MAX_RUNES, `runes capped at MAX_RUNES=${Enchanting.MAX_RUNES} (got ${a.runes.length})`);
  const costAtCap = Enchanting.enchantCost(a);
  const expectedCapCost = 300 * 1 /* common */ * Math.pow(2, Enchanting.MAX_RUNES);
  assert(costAtCap === expectedCapCost, `cost plateaus at rarity*2^MAX_RUNES once capped (expected ${expectedCapCost}, got ${costAtCap})`);
}
console.log('    Rune count and cost both plateau correctly once a piece is fully enchanted ✓');

console.log('\n✓ All smoke22 tests passed.');
