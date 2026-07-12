/* smoke15.js — Spirit Root Pack odds & floor-tier gating regression tests.
 *
 * Covers the pure data-layer logic behind two fixes:
 *   1. Buying a guaranteed/tier-restricted Spirit Root Pack must set a
 *      "floor tier" that excludes lower tiers from all future rolls in the
 *      same character-creation session (not just the one purchased root).
 *   2. The roll odds shown to the player must be auto-calculated from the
 *      same weight table rollSpiritualRoot() actually draws from — never a
 *      separately hand-typed percentage that could drift out of sync.
 *
 * The DOM/UI orchestration side of this (showCharacterCreation session
 * state, showPackGrantResult modal sequencing) was verified end-to-end
 * through a real headless browser per CLAUDE.md's live-gameplay-bug
 * guidance, not here — this file covers the parts that ARE cleanly
 * testable without a DOM: the weight math itself.
 */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
global.window = global;

eval(require('fs').readFileSync('www/js/gameData.js', 'utf8'));

console.log('Testing Spirit Root Pack odds & floor-tier gating...');

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — rollOdds() percentages sum to 100 and match hand-computed values
// for every non-guaranteed mode
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: rollOdds() percentages are correct and sum to 100');

const expected = {
  free:       { mortal: 50.0, true: 28.0, heaven: 14.0, saint: 6.0, chaos: 2.0 },
  min_true:   { true: 41.176, heaven: 32.941, saint: 18.824, chaos: 7.059 },
  min_heaven: { heaven: 56.0, saint: 32.0, chaos: 12.0 },
  min_saint:  { saint: 72.727, chaos: 27.273 },
};
for (const [mode, exp] of Object.entries(expected)) {
  const odds = GameData.rollOdds(mode);
  const total = odds.reduce((s, o) => s + o.pct, 0);
  assert(Math.abs(total - 100) < 0.01, `${mode}: percentages sum to 100 (got ${total.toFixed(2)})`);
  odds.forEach(o => {
    const e = exp[o.root.key];
    assert(e !== undefined, `${mode}: unexpected root '${o.root.key}' in pool`);
    assert(Math.abs(o.pct - e) < 0.01, `${mode}: ${o.root.key} = ${o.pct.toFixed(2)}% (expected ${e}%)`);
  });
  assert(Object.keys(exp).length === odds.length, `${mode}: pool size matches (got ${odds.length}, expected ${Object.keys(exp).length})`);
}
console.log('    All 4 rollable modes match hand-computed odds ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — rollOdds() for a guaranteed mode returns exactly 100% for that root
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: Guaranteed modes report 100%');
['chaos', 'saint', 'heaven'].forEach(mode => {
  const odds = GameData.rollOdds(mode);
  assert(odds.length === 1, `${mode}: exactly one entry`);
  assert(odds[0].root.key === mode, `${mode}: the guaranteed root itself`);
  assert(odds[0].pct === 100, `${mode}: reported as 100%`);
});
console.log('    Guaranteed-mode odds OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — rollOdds() stays in sync with rollSpiritualRoot()'s actual pool:
// sample 5000 rolls per mode and confirm the observed distribution roughly
// matches the auto-calculated percentages (catches any pool/weight drift
// between the two functions).
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: rollOdds() matches rollSpiritualRoot()\'s actual draw distribution');
['free', 'min_true', 'min_heaven', 'min_saint'].forEach(mode => {
  const counts = {};
  const N = 5000;
  for (let i = 0; i < N; i++) {
    const r = GameData.rollSpiritualRoot(mode);
    counts[r.key] = (counts[r.key] || 0) + 1;
  }
  const odds = GameData.rollOdds(mode);
  odds.forEach(o => {
    const observed = (counts[o.root.key] || 0) / N * 100;
    // Generous tolerance (±6 percentage points) — this is a statistical
    // sanity check for gross drift, not a precision test (Test 1 covers that).
    assert(Math.abs(observed - o.pct) < 6, `${mode}/${o.root.key}: observed ${observed.toFixed(1)}% vs calculated ${o.pct.toFixed(1)}% (drifted too far)`);
  });
});
console.log('    Observed roll distribution matches calculated odds within tolerance ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — rollModeForFloor() maps every tier correctly, including the
// max-tier (chaos -> null) terminal case
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: rollModeForFloor() tier mapping');
assert(GameData.rollModeForFloor('mortal') === 'free', 'mortal floor -> free pool (no restriction)');
assert(GameData.rollModeForFloor('true') === 'min_true', 'true floor -> min_true pool');
assert(GameData.rollModeForFloor('heaven') === 'min_heaven', 'heaven floor -> min_heaven pool');
assert(GameData.rollModeForFloor('saint') === 'min_saint', 'saint floor -> min_saint pool');
assert(GameData.rollModeForFloor('chaos') === null, 'chaos floor -> null (max tier, nothing left to roll for)');
console.log('    Floor-tier mapping OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — Floor-gated rolling never produces a root below the floor
// (the actual mechanic the fix protects: buying a min_true/min_saint pack
// must remove lower tiers from every subsequent roll, not just the one
// the pack itself granted)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5: Floor-gated rolls never dip below the purchased floor');
const rootRank = key => ['mortal', 'true', 'heaven', 'saint', 'chaos'].indexOf(key);
['true', 'heaven', 'saint'].forEach(floorKey => {
  const mode = GameData.rollModeForFloor(floorKey);
  const floorRank = rootRank(floorKey);
  for (let i = 0; i < 500; i++) {
    const r = GameData.rollSpiritualRoot(mode);
    assert(rootRank(r.key) >= floorRank, `floor='${floorKey}': rolled '${r.key}' is below the floor (rank ${rootRank(r.key)} < ${floorRank})`);
  }
});
console.log('    500 rolls per floor tier, zero leaks below the floor ✓');

console.log('\n✓ All smoke15 tests passed.');
