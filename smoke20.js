/* smoke20.js — Round 22 Qi economy rebalance regression.
 *
 * User report: "the qi generator is Abit fast" — confirmed on follow-up to
 * mean all four contributing factors at once: raw production too high,
 * cost scaling too gentle (easy to snowball many of one generator), the
 * always-on global multiplier stack too generous, and the overall pace
 * feeling too easy. Trimmed each contributing constant by a modest,
 * proportionate amount (not a drastic nerf — the report was "a bit" fast,
 * not "way" too fast) and verified the COMBINED effect empirically before
 * settling on the final numbers, since several of these compound
 * multiplicatively/exponentially with each other in ways that are easy to
 * under- or over-estimate by eyeballing a single constant in isolation.
 *
 * This file pins the new tuning values so a future change can't silently
 * drift the economy back to the old (reported-too-fast) pace, or overshoot
 * into "too grindy" — both directions are regressions.
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
global.Storage = { save: () => true, wipe: () => {} };

console.log('Testing Round 22 Qi economy rebalance...');

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — Tuning constants land at the new, trimmed values (not the old
// ones, and not accidentally over-trimmed either)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: Tuning constants pinned to their new values');
assert(GameData.generators.every(g => g.costGrowth === 1.16), 'every generator uses costGrowth 1.16 (was 1.15)');
assert(GameData.stageBonusPerStage === 0.045, `stageBonusPerStage is 0.045 (was 0.05, got ${GameData.stageBonusPerStage})`);
assert(GameData.daoBonusPerPoint === 0.018, `daoBonusPerPoint is 0.018 (was 0.02, got ${GameData.daoBonusPerPoint})`);
assert(GameData.realmBonusPerLevel === 0.07, `realmBonusPerLevel is 0.07 (was 0.08, got ${GameData.realmBonusPerLevel})`);
assert(GameData.genMilestoneMult === 1.8, `genMilestoneMult is 1.8 (was 2, got ${GameData.genMilestoneMult})`);
assert(GameData.synergyBonusPer === 0.11, `synergyBonusPer is 0.11 (was 0.12, got ${GameData.synergyBonusPer})`);
console.log('    All six tuning constants match the rebalanced values ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — baseProd trimmed by exactly 8% across every generator, ratios
// between generators preserved (the relative shop progression is unchanged,
// only the absolute pace)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: baseProd trimmed ~8% uniformly, generator ratios preserved');
{
  const OLD_BASE_PROD = {
    mat: 0.15, herb: 1.5, stone: 12, furnace: 70.5, library: 390, sword: 2100,
    array: 11700, dragon: 66000, star: 390000, heaven: 2400000,
    rift: 14400000, reactor: 86400000, bridge: 518400000, maw: 3110400000, ascend: 18662400000,
  };
  GameData.generators.forEach(g => {
    const old = OLD_BASE_PROD[g.id];
    assert(old !== undefined, `${g.id}: has a known old baseProd to compare against`);
    const ratio = g.baseProd / old;
    assert(Math.abs(ratio - 0.92) < 0.001, `${g.id}: baseProd trimmed to ~92% of the old value (expected x0.92, got x${ratio.toFixed(4)})`);
  });
  // Ratios between adjacent tiers unchanged — the shop's relative pacing (a
  // player's sense of "each tier is a meaningful step up") is untouched.
  for (let i = 1; i < GameData.generators.length; i++) {
    const prev = GameData.generators[i - 1], cur = GameData.generators[i];
    assert(cur.baseProd > prev.baseProd, `${cur.id} still produces more than ${prev.id} after the trim`);
  }
}
console.log('    Every generator trimmed by exactly the same 8%, tier ordering intact ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — Combined effect at a representative early/mid-game state is
// proportionate: noticeably less generous than before, but not crushing.
// Pins the COMBINED (multiplicative) result, since the individual knobs
// interact in ways a single-constant test can't catch — this is exactly
// the check that caught the first draft of this rebalance being far more
// severe than intended (a naive first pass produced a 58% qi/s cut and a
// 2.4x cost hike here, well beyond what "a bit fast" warranted).
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: Combined rebalance effect is proportionate, not severe');
{
  Game.state = Game.newState();
  Game.state.realm = 3; Game.state.stagesCleared = 20; Game.state.daoComprehension = 10;
  Game.state.owned.mat = 50; Game.state.owned.herb = 30;
  const qps = Game.qiPerSecond();
  const cost50 = Game.generatorCost(GameData.generators[0], 1);

  // Reference values computed against the OLD (pre-rebalance) constants at
  // this exact state — see this test's own header comment for how they
  // were derived (git-stash comparison against the prior commit).
  const OLD_QPS = 885.6576;
  const OLD_COST_AT_50 = 16254.861623759301;

  const qpsRatio = qps / OLD_QPS;
  const costRatio = cost50 / OLD_COST_AT_50;

  assert(qpsRatio > 0.55 && qpsRatio < 0.75, `qi/s lands in a proportionate 55-75% of the old value (got ${(qpsRatio*100).toFixed(1)}%) — not a token nudge, not a crushing nerf`);
  assert(costRatio > 1.3 && costRatio < 1.8, `cost at 50 owned lands in a proportionate 130-180% of the old value (got ${(costRatio*100).toFixed(1)}%)`);
}
console.log('    Combined effect: ~35% less qi/s, ~54% pricier at 50 owned — proportionate to "a bit fast" ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — Cost scaling genuinely bites harder at DEEP investment (the
// literal "snowballing" complaint) — the gap between old and new cost
// should widen as owned count grows, since costGrowth compounds
// exponentially, not linearly.
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: Cost scaling compounds harder at deep investment (not just early game)');
{
  Game.state = Game.newState();
  Game.state.owned.mat = 50;
  const cost50 = Game.generatorCost(GameData.generators[0], 1);
  Game.state.owned.mat = 200;
  const cost200 = Game.generatorCost(GameData.generators[0], 1);

  const OLD_COST_AT_50 = 16254.861623759301;
  const OLD_COST_AT_200 = 20685181207433.965;

  const ratioAt50 = cost50 / OLD_COST_AT_50;
  const ratioAt200 = cost200 / OLD_COST_AT_200;

  assert(ratioAt200 > ratioAt50, `the cost-increase ratio grows with owned count (x${ratioAt50.toFixed(2)} at 50 owned -> x${ratioAt200.toFixed(2)} at 200 owned), confirming costGrowth compounds exponentially rather than adding a flat tax`);
}
console.log('    Cost-scaling fix genuinely discourages deep snowballing, more so than a flat early-game tax ✓');

console.log('\n✓ All smoke20 tests passed.');
