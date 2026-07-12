/* smoke16.js — Round 16 "Qi Generation Expansion" regression tests.
 *
 * Covers the three pieces added in response to "revise more qi generating
 * methods... add more and also steps and bonuses especially when going to
 * higher levels":
 *   1. Five new realm-gated late-game generators (rift/reactor/bridge/maw/
 *      ascend), and the reqRealm gate itself in buyGenerator()/maxAffordable().
 *   2. The focus-combo active-tap mechanic (qiPerTap()-only, never idle/offline).
 *   3. The realm-scaling Qi bonus in multipliers(), plus the extended
 *      genMilestones/stageMilestones tables that let those systems keep
 *      paying out at higher levels instead of running dry.
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
['gameData', 'time', 'game'].forEach(m => {
  eval(fs.readFileSync(`www/js/${m}.js`, 'utf8'));
});
// Minimal Storage stub — persist()/save flows are covered by smoke12's real
// Storage module; here we just need buyGenerator()'s persist() call to not throw.
global.Storage = { save: () => true, wipe: () => {} };

console.log('Testing Round 16 Qi Generation Expansion...');

function freshGame() {
  Game.state = Game.newState();
  Game._focusCombo = 0;
  Game._lastTapMono = 0;
  return Game;
}

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — Five new generators exist with sane, monotonically scaling cost/prod
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: New generators exist and scale sensibly');
const NEW_GEN_IDS = ['rift', 'reactor', 'bridge', 'maw', 'ascend'];
NEW_GEN_IDS.forEach(id => {
  const g = GameData.generators.find(x => x.id === id);
  assert(g, `generator '${id}' exists in GameData.generators`);
  assert(typeof g.reqRealm === 'number' && g.reqRealm > 0, `${id}: has a positive reqRealm`);
  assert(g.baseCost > 0 && g.baseProd > 0, `${id}: positive baseCost/baseProd`);
});
for (let i = 1; i < NEW_GEN_IDS.length; i++) {
  const prev = GameData.generators.find(x => x.id === NEW_GEN_IDS[i - 1]);
  const cur = GameData.generators.find(x => x.id === NEW_GEN_IDS[i]);
  assert(cur.baseCost > prev.baseCost, `${cur.id} costs more than ${prev.id}`);
  assert(cur.baseProd > prev.baseProd, `${cur.id} produces more than ${prev.id}`);
  assert(cur.reqRealm >= prev.reqRealm, `${cur.id}.reqRealm (${cur.reqRealm}) >= ${prev.id}.reqRealm (${prev.reqRealm})`);
}
// New generators must be strictly the priciest/most-productive tier.
const oldGens = GameData.generators.filter(g => !NEW_GEN_IDS.includes(g.id));
const cheapestNew = Math.min(...NEW_GEN_IDS.map(id => GameData.generators.find(g => g.id === id).baseCost));
const priciestOld = Math.max(...oldGens.map(g => g.baseCost));
assert(cheapestNew > priciestOld, 'cheapest new generator costs more than the priciest pre-existing one');
console.log(`    ${NEW_GEN_IDS.length} new generators present, costs/prod/reqRealm all monotonic ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — reqRealm gates buyGenerator() and maxAffordable()
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: reqRealm gating in buyGenerator()/maxAffordable()');
{
  freshGame();
  const g = GameData.generators.find(x => x.id === 'rift');
  Game.state.realm = g.reqRealm - 1;
  Game.state.qi = 1e30; // plenty of currency — the gate, not affordability, must block this
  assert(Game.maxAffordable('rift') === 0, 'maxAffordable is 0 below reqRealm even when rich');
  assert(Game.buyGenerator('rift', 1) === false, 'buyGenerator refuses below reqRealm');
  assert(Game.state.owned.rift === 0, 'nothing was bought');
  assert(Game.state.qi === 1e30, 'qi untouched by the refused purchase');

  Game.state.realm = g.reqRealm;
  assert(Game.maxAffordable('rift') > 0, 'maxAffordable > 0 once realm requirement is met');
  assert(Game.buyGenerator('rift', 1) === true, 'buyGenerator succeeds once realm requirement is met');
  assert(Game.state.owned.rift === 1, 'generator recorded as owned');
}
console.log('    reqRealm correctly blocks/unblocks both purchase paths ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — Focus combo: builds on rapid taps, resets on a gap, caps at max
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: Focus combo build-up, reset, and cap');
{
  freshGame();
  const now = TimeService.monotonicNow();
  // Simulate 5 taps in quick succession by advancing _lastTapMono manually
  // rather than sleeping — _updateFocusCombo() only compares elapsed time.
  Game._lastTapMono = 0;
  Game._focusCombo = 0;
  for (let i = 0; i < 5; i++) {
    Game._lastTapMono = TimeService.monotonicNow() - 10; // well within focusWindowMs
    Game._updateFocusCombo();
  }
  assert(Game._focusCombo === 5, `combo builds to 5 after 5 rapid taps (got ${Game._focusCombo})`);

  // A gap longer than focusWindowMs resets the streak to 1.
  Game._lastTapMono = TimeService.monotonicNow() - (GameData.tap.focusWindowMs + 500);
  const afterGap = Game._updateFocusCombo();
  assert(afterGap === 1, `combo resets to 1 after a gap > focusWindowMs (got ${afterGap})`);

  // Cap: combo never exceeds focusMaxCombo even with many rapid taps.
  Game._focusCombo = 0; Game._lastTapMono = 0;
  for (let i = 0; i < GameData.tap.focusMaxCombo + 20; i++) {
    Game._lastTapMono = TimeService.monotonicNow() - 10;
    Game._updateFocusCombo();
  }
  assert(Game._focusCombo === GameData.tap.focusMaxCombo, `combo caps at focusMaxCombo (got ${Game._focusCombo}, cap ${GameData.tap.focusMaxCombo})`);
}
console.log('    Combo builds, resets on gap, and respects the cap ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — Focus combo boosts qiPerTap() but never qiPerSecond() (idle/offline)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: Focus combo affects only active taps, never idle production');
{
  freshGame();
  Game.state.owned.mat = 10; // some idle production to compare against
  const idleBefore = Game.qiPerSecond();
  const tapBefore = Game.qiPerTap();

  Game._focusCombo = 20;
  Game._lastTapMono = TimeService.monotonicNow();
  const idleAfter = Game.qiPerSecond();
  const tapAfter = Game.qiPerTap();

  assert(tapAfter > tapBefore, `qiPerTap() increases with an active combo (${tapBefore} -> ${tapAfter})`);
  assert(idleAfter === idleBefore, `qiPerSecond() is unaffected by combo state (${idleBefore} vs ${idleAfter})`);
  const expectedBonus = 1 + Math.min(GameData.tap.focusMaxCombo, 20) * GameData.tap.focusBonusPerStack;
  assert(Math.abs(tapAfter / tapBefore - expectedBonus) < 1e-9, `qiPerTap() scales by exactly (1 + combo*focusBonusPerStack) (expected x${expectedBonus.toFixed(4)}, got x${(tapAfter / tapBefore).toFixed(4)})`);
}
console.log('    Combo bonus isolated to active taps, magnitude matches formula exactly ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — meditate() runs the combo update BEFORE computing gain, and
// returns the combo value alongside gain/crit
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5: meditate() return shape includes combo, ordering is correct');
{
  freshGame();
  const r1 = Game.meditate();
  assert(typeof r1 === 'object' && 'combo' in r1 && 'gain' in r1 && 'crit' in r1, 'meditate() returns {gain, crit, combo}');
  assert(r1.combo === 1, `first tap combo === 1 (got ${r1.combo})`);
  // Immediately-following tap (still within window) should read combo === 2
  // and its gain must reflect the BUMPED combo (i.e. the update happens
  // before qiPerTap() is evaluated, not after).
  const r2 = Game.meditate();
  assert(r2.combo === 2, `second rapid tap combo === 2 (got ${r2.combo})`);
  assert(r2.gain > r1.gain, `second tap's gain reflects its own (higher) combo bonus (${r1.gain} -> ${r2.gain})`);
}
console.log('    meditate() combo bookkeeping correct ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 6 — Realm bonus scales multipliers() and compounds with realm/stage
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 6: Realm-scaling Qi bonus in multipliers()');
{
  freshGame();
  Game.state.realm = 0;
  const m0 = Game.multipliers();
  Game.state.realm = 5;
  const m5 = Game.multipliers();
  const expectedRatio = (1 + 5 * GameData.realmBonusPerLevel) / (1 + 0 * GameData.realmBonusPerLevel);
  assert(Math.abs(m5.allMult / m0.allMult - expectedRatio) < 1e-9,
    `allMult scales by exactly (1+realm*realmBonusPerLevel) between realm 0 and 5 (expected x${expectedRatio.toFixed(4)}, got x${(m5.allMult / m0.allMult).toFixed(4)})`);
}
console.log('    Realm bonus compounds into allMult exactly as documented ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 7 — Extended stageMilestones fire correctly past the old ceiling (108),
// exactly once each, with no double-firing on repeated advanceStage() calls
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 7: Extended stage milestones fire once each past stage 108');
{
  freshGame();
  Game.state.qi = 1e50;
  Game.state.stagesCleared = 167; // one short of the new 168 milestone
  Game.state.stage = 0;
  const daoBefore = Game.state.daoComprehension;
  // Force advanceStage() to succeed regardless of realm progress curve —
  // stub the requirement check the way canAdvanceStage() would allow it.
  const origReq = Game.nextStageReq;
  Game.nextStageReq = () => 1; // trivially affordable
  const origCan = Game.canAdvanceStage;
  Game.canAdvanceStage = () => true;

  const res168 = Game.advanceStage();
  assert(res168.milestone && res168.milestone.at === 168, `stage 168 milestone fires (got ${res168.milestone && res168.milestone.at})`);
  assert(Game.state.milestonesUnlocked.includes(168), '168 recorded in milestonesUnlocked');
  assert(Game.state.daoComprehension === daoBefore + 18, 'dao bonus (18) from the 168 milestone applied');

  // Jump straight to one-short-of the final new milestone (999) and confirm
  // it fires too — proves the table isn't silently truncated somewhere.
  Game.state.stagesCleared = 998;
  const res999 = Game.advanceStage();
  assert(res999.milestone && res999.milestone.at === 999, `stage 999 milestone fires (got ${res999.milestone && res999.milestone.at})`);
  assert(Game.state.milestonesUnlocked.includes(999), '999 recorded in milestonesUnlocked');

  // Re-triggering the exact same stagesCleared count (simulating a duplicate
  // advanceStage-adjacent call) must not re-grant the milestone.
  const daoAt999 = Game.state.daoComprehension;
  Game.state.stagesCleared = 998; // back up one so the next call re-hits 999
  const resDup = Game.advanceStage();
  assert(!resDup.milestone, 'the same milestone number does not fire a second time');
  assert(Game.state.daoComprehension === daoAt999, 'no duplicate dao grant on repeat');

  Game.nextStageReq = origReq;
  Game.canAdvanceStage = origCan;
}
console.log('    Extended milestones (168..999) fire exactly once each, in order ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 8 — Extended genMilestones compound correctly past the old ceiling (500)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 8: Extended generator milestones compound past 500 owned');
{
  const multAt = owned => GameData.genMilestoneMultiplier(owned);
  const m499 = multAt(499);
  const m500 = multAt(500);
  const m2000 = multAt(2000);
  assert(m500 > m499, 'crossing the 500 threshold increases the multiplier');
  assert(m2000 > m500, 'the new 2000 threshold multiplier is higher still');
  // Multiplier is Math.pow(genMilestoneMult, reachedCount) — 2000 owned should
  // have reached all 13 thresholds now (was maxing out at 9 pre-Round-16).
  const reachedAt2000 = GameData.genMilestones.filter(t => 2000 >= t).length;
  assert(reachedAt2000 === GameData.genMilestones.length, `2000 owned clears every milestone threshold (${reachedAt2000}/${GameData.genMilestones.length})`);
  assert(Math.abs(m2000 - Math.pow(GameData.genMilestoneMult, reachedAt2000)) < 1e-9, 'multiplier formula matches Math.pow(genMilestoneMult, thresholdsReached) at the new ceiling');
}
console.log('    genMilestones extension compounds correctly through 2000 owned ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 9 — Synergy dynamically scales to include all 15 generators
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 9: Synergy scales to the full 15-generator roster');
{
  freshGame();
  assert(GameData.generators.length === 15, `roster is 15 generators total (got ${GameData.generators.length})`);
  GameData.generators.forEach(g => { Game.state.owned[g.id] = GameData.synergyThreshold; });
  assert(Game.synergyCount() === 15, `synergyCount() reaches 15 when every generator is mastered (got ${Game.synergyCount()})`);
  const expectedSynergyMult = 1 + 15 * GameData.synergyBonusPer;
  assert(Math.abs(Game.synergyMult() - expectedSynergyMult) < 1e-9, `synergyMult() = 1 + 15*synergyBonusPer (expected ${expectedSynergyMult}, got ${Game.synergyMult()})`);
}
console.log('    Synergy count/mult scale to all 15 generators, no hardcoded ceiling ✓');

console.log('\n✓ All smoke16 tests passed.');
