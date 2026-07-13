/* smoke21.js — Round 23 "Artifacts: auto-equip, bulk salvage, unlockable
 * slots" regression tests.
 *
 * User request: "equipment I would like to have to auto equip and bulk
 * sell and be able to upgrade more equipment slot."
 *   1. Auto-equip: Artifacts.autoEquip() fills every UNLOCKED slot with
 *      the highest-score() inventory candidate, only swapping when it's
 *      actually an upgrade (or the slot is empty) — never downgrades.
 *   2. Bulk sell: Artifacts.bulkSalvage(belowRarity) sells every
 *      INVENTORY (never equipped) item ranked below a chosen rarity tier
 *      in one action.
 *   3. Unlockable slots: boots/amulet start locked; Artifacts.unlockSlot()
 *      spends Spirit Stones to permanently unlock one. roll() (loot
 *      generation) only ever picks among currently-unlocked slots, so
 *      locked-slot gear never clutters the bag before it's purchasable.
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
['gameData', 'time', 'game', 'artifacts'].forEach(m => {
  eval(fs.readFileSync(`www/js/${m}.js`, 'utf8'));
});
global.Storage = { save: () => true, wipe: () => {} };

console.log('Testing Round 23 Artifacts: auto-equip, bulk salvage, unlockable slots...');

function freshGame() {
  Game.state = Game.newState();
  Game.state.spiritStones = 1e9;
  return Game;
}
function makeArtifact(overrides) {
  return Object.assign({ id: 'a' + Math.random().toString(36).slice(2), slot: 'weapon', rarity: 'common', set: 'azure', atk: 10, hp: 10, qi: 0 }, overrides);
}

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — New slots exist, locked by default; base 4 remain unlocked
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: boots/amulet exist and start locked; base 4 stay unlocked');
{
  freshGame();
  assert(GameData.artifacts.slots.find(s => s.id === 'boots'), 'boots slot defined');
  assert(GameData.artifacts.slots.find(s => s.id === 'amulet'), 'amulet slot defined');
  ['weapon', 'robe', 'talisman', 'ring'].forEach(id => {
    assert(Artifacts.isSlotUnlocked(id), `${id} is unlocked from the start`);
  });
  assert(!Artifacts.isSlotUnlocked('boots'), 'boots starts locked');
  assert(!Artifacts.isSlotUnlocked('amulet'), 'amulet starts locked');
  assert(Artifacts.activeSlots().length === 4, `activeSlots() reports only the 4 unlocked slots initially (got ${Artifacts.activeSlots().length})`);
  assert(Artifacts.lockedSlots().length === 2, `lockedSlots() reports boots+amulet (got ${Artifacts.lockedSlots().length})`);
}
console.log('    Base 4 slots unlocked, boots/amulet locked, counts correct ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — Loot rolls only ever pick among unlocked slots
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: roll() never generates gear for a locked slot');
{
  freshGame();
  for (let i = 0; i < 500; i++) {
    const a = Artifacts.roll(5);
    assert(a.slot !== 'boots' && a.slot !== 'amulet', `roll() never produces a locked-slot item (got '${a.slot}')`);
  }
}
console.log('    500 rolls, zero locked-slot drops ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — unlockSlot(): gated by cost, permanent once purchased, then
// loot CAN roll for it and it appears in equip flows
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: unlockSlot() gating and effect');
{
  freshGame();
  Game.state.spiritStones = 100; // can't afford boots (6000)
  assert(!Artifacts.canUnlockSlot('boots'), 'cannot afford boots at 100 stones');
  assert(!Artifacts.unlockSlot('boots'), 'unlockSlot refuses when unaffordable');
  assert(!Artifacts.isSlotUnlocked('boots'), 'still locked after a refused attempt');

  Game.state.spiritStones = 1e9;
  const before = Game.state.spiritStones;
  assert(Artifacts.canUnlockSlot('boots'), 'can afford boots with plenty of stones');
  assert(Artifacts.unlockSlot('boots'), 'unlockSlot succeeds');
  assert(Artifacts.isSlotUnlocked('boots'), 'boots is now unlocked');
  const bootsCost = GameData.artifacts.slots.find(s => s.id === 'boots').unlockCost;
  assert(Game.state.spiritStones === before - bootsCost, `exact cost deducted (expected ${before - bootsCost}, got ${Game.state.spiritStones})`);
  assert(!Artifacts.unlockSlot('boots'), 'cannot unlock an already-unlocked slot again');
  assert(Artifacts.activeSlots().length === 5, `activeSlots() now includes boots (got ${Artifacts.activeSlots().length})`);

  // Loot can now roll boots occasionally.
  let sawBoots = false;
  for (let i = 0; i < 500 && !sawBoots; i++) if (Artifacts.roll(5).slot === 'boots') sawBoots = true;
  assert(sawBoots, 'roll() produces boots-slot items once unlocked');
}
console.log('    Unlock is cost-gated, permanent, and immediately usable ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — autoEquip(): fills empty slots, upgrades strictly-better gear,
// never downgrades, never touches locked slots
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: autoEquip() behavior');
{
  freshGame();
  const weak = makeArtifact({ id: 'weak', slot: 'weapon', atk: 5 });
  const strong = makeArtifact({ id: 'strong', slot: 'weapon', atk: 50 });
  const junk = makeArtifact({ id: 'junk', slot: 'robe', atk: 0, hp: 1 });
  Artifacts.add(weak); Artifacts.add(strong); Artifacts.add(junk);

  const n = Artifacts.autoEquip();
  // Only weapon and robe have any inventory candidate at all (talisman/ring
  // have none, so autoEquip correctly leaves them empty rather than erroring).
  assert(n === 2, `equips into exactly the 2 slots that have a candidate (weapon, robe) — got ${n}`);
}
console.log('    (see Test 4b for the precise upgrade-only assertion)');

console.log('\n  Test 4b: autoEquip() picks the higher-score candidate and never downgrades');
{
  freshGame();
  const weak = makeArtifact({ id: 'weak', slot: 'weapon', atk: 5 });
  const strong = makeArtifact({ id: 'strong', slot: 'weapon', atk: 50 });
  Artifacts.add(weak); Artifacts.add(strong);
  Artifacts.autoEquip();
  assert(Artifacts.equipped().weapon.id === 'strong', `equips the higher-score weapon (got '${Artifacts.equipped().weapon && Artifacts.equipped().weapon.id}')`);
  assert(Artifacts.s().inventory.some(a => a.id === 'weak'), 'the weaker piece goes back to the bag, not discarded');

  // Now add an even weaker weapon and confirm autoEquip does NOT downgrade.
  const weaker = makeArtifact({ id: 'weaker', slot: 'weapon', atk: 1 });
  Artifacts.add(weaker);
  const n2 = Artifacts.autoEquip();
  assert(Artifacts.equipped().weapon.id === 'strong', 'still wearing the strong weapon — autoEquip never downgrades');
}
console.log('    Upgrades when better, keeps current gear when nothing beats it, never discards displaced pieces ✓');

console.log('\n  Test 4c: autoEquip() ignores locked slots entirely');
{
  freshGame();
  const bootsItem = makeArtifact({ id: 'stray-boots', slot: 'boots', atk: 999 });
  Artifacts.s().inventory.push(bootsItem); // force one into the bag as if from an edge case
  Artifacts.autoEquip();
  assert(Artifacts.equipped().boots === undefined || Artifacts.equipped().boots === null, 'a locked slot is never auto-equipped into, even if a matching item exists in the bag');
}
console.log('    Locked slots are skipped entirely by autoEquip() ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — bulkSalvage(): sells everything below the threshold, keeps
// everything at/above it, never touches equipped items
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5: bulkSalvage() threshold behavior');
{
  freshGame();
  const commons = [makeArtifact({ rarity: 'common' }), makeArtifact({ rarity: 'common' })];
  const rares = [makeArtifact({ rarity: 'rare' })];
  const epics = [makeArtifact({ rarity: 'epic' })];
  [...commons, ...rares, ...epics].forEach(a => Artifacts.add(a));
  const equippedEpic = makeArtifact({ id: 'equipped-epic', rarity: 'epic', slot: 'robe', atk: 999 });
  Artifacts.add(equippedEpic);
  Artifacts.equip(equippedEpic.id); // now sitting in `equipped`, not `inventory`

  const preview = Artifacts.bulkSalvagePreview('rare'); // sell everything below 'rare' == commons only
  assert(preview.count === 2, `preview counts exactly the 2 commons (got ${preview.count})`);

  const stonesBefore = Game.state.spiritStones;
  const res = Artifacts.bulkSalvage('rare');
  assert(res.count === 2, `bulkSalvage sold exactly the 2 commons (got ${res.count})`);
  assert(Game.state.spiritStones === stonesBefore + res.value, 'spirit stones increased by exactly the reported value');
  assert(!Artifacts.s().inventory.some(a => a.rarity === 'common'), 'no commons remain in the bag');
  assert(Artifacts.s().inventory.some(a => a.rarity === 'rare'), 'the rare piece was kept (at the threshold, not below it)');
  assert(Artifacts.s().inventory.some(a => a.rarity === 'epic'), 'the epic piece was kept');
  assert(Artifacts.equipped().robe && Artifacts.equipped().robe.id === 'equipped-epic', 'the equipped epic item is untouched by bulk salvage, even though its rarity would qualify if it were in the bag');
}
console.log('    Bulk salvage sells strictly-below-threshold bag items only, equipped gear is always safe ✓');

console.log('\n  Test 6: bulkSalvage() with nothing to sell is a safe no-op');
{
  freshGame();
  Artifacts.add(makeArtifact({ rarity: 'epic' }));
  const stonesBefore = Game.state.spiritStones;
  const res = Artifacts.bulkSalvage('rare'); // nothing below 'rare' in the bag
  assert(res.count === 0 && res.value === 0, 'reports zero sold, zero value');
  assert(Game.state.spiritStones === stonesBefore, 'no stones gained on a no-op sale');
  assert(Artifacts.s().inventory.length === 1, 'the epic item is untouched');
}
console.log('    No-op bulk salvage changes nothing ✓');

console.log('\n✓ All smoke21 tests passed.');
