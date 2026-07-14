/* smoke27.js — Round 30 "Auto-Runner" regression tests.
 *
 * User request: "an auto runner mode in purchase where by it will buy and
 * clear everything itself moving forward figure out the best way to auto
 * upgrade ideally." Scoped (per the user's own AskUserQuestion answers) to
 * the core grind — generators, one-time upgrades, minor stage advances, and
 * major realm breakthroughs — with a greedy marginal-ROI purchase strategy
 * for generators (buy whichever affordable generator gives the most
 * production per Qi spent right now, not just "cheapest" or "first").
 *
 * Off by default; www/js/autorunner.js's AutoRunner.tick() is called from
 * Game.tick() and is a complete no-op unless Game.state.autoRunner.enabled.
 */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
const window = global;
const fs = require('fs');

console.log('Testing Round 30 Auto-Runner: marginal-ROI purchases, stage/breakthrough automation...');

const TimeService = { now: () => 1721000000000, monotonicNow: () => 0 };
window.TimeService = TimeService;
const Storage = { save: () => true, load: () => null, wipe: () => {} };
window.Storage = Storage;
eval(fs.readFileSync('www/js/gameData.js', 'utf8'));
eval(fs.readFileSync('www/js/game.js', 'utf8'));
eval(fs.readFileSync('www/js/autorunner.js', 'utf8'));

const toasts = [];
const UI = { toast: (msg) => toasts.push(msg), renderAll: () => {}, renderShop: () => {} };
window.UI = UI;
const GameNumbers = { formatNumber: n => String(n) };
window.GameNumbers = GameNumbers;

function freshState(overrides) {
  toasts.length = 0;
  Game.init(Object.assign({ realm: 0, owned: {} }, overrides));
  return Game.state;
}

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — enabled()/setEnabled()/toggle() state management
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: enable/disable state management');
{
  freshState();
  assert(AutoRunner.enabled() === false, 'starts disabled by default');
  AutoRunner.setEnabled(true);
  assert(AutoRunner.enabled() === true, 'setEnabled(true) enables it');
  assert(toasts.some(t => t.includes('engaged')), 'toasts on enable');
  AutoRunner.toggle();
  assert(AutoRunner.enabled() === false, 'toggle() flips it back off');
  assert(toasts.some(t => t.includes('stopped')), 'toasts on disable');
}
console.log('    Toggle state persists and notifies correctly ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — tick() is a complete no-op while disabled
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: disabled Auto-Runner never touches state');
{
  freshState({ qi: 1e9 });
  const qiBefore = Game.state.qi;
  const ownedBefore = JSON.stringify(Game.state.owned);
  AutoRunner.tick();
  assert(Game.state.qi === qiBefore, 'Qi untouched while disabled');
  assert(JSON.stringify(Game.state.owned) === ownedBefore, 'no generators bought while disabled');
  assert(toasts.length === 0, 'no toasts while disabled');
}
console.log('    tick() is a true no-op when Auto-Runner is off ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — _generatorMarginalValue(): gating and math
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: generator marginal-value calculation');
{
  freshState({ qi: 0, realm: 0 });
  const g = GameData.generators[0]; // 'mat' — Meditation App, no reqRealm
  assert(AutoRunner._generatorMarginalValue(g) === null, 'unaffordable (qi=0) generator returns null');

  Game.state.qi = 1e6;
  const v = AutoRunner._generatorMarginalValue(g);
  assert(v !== null, 'affordable generator returns a value object');
  assert(v.cost === Game.generatorCost(g, 1), 'cost matches Game.generatorCost(g,1)');
  const expectedGain = g.baseProd * 1 * GameData.genMilestoneMultiplier(1) - g.baseProd * 0 * GameData.genMilestoneMultiplier(0);
  assert(Math.abs(v.gain - expectedGain) < 1e-9, `gain matches the milestone-aware delta (got ${v.gain}, expected ${expectedGain})`);
  assert(Math.abs(v.efficiency - v.gain / v.cost) < 1e-9, 'efficiency = gain / cost');

  // reqRealm gating: a late generator should be null below its realm requirement.
  const gated = GameData.generators.find(x => x.reqRealm);
  assert(gated, 'fixture assumption: at least one generator has reqRealm');
  Game.state.qi = 1e30;
  Game.state.realm = gated.reqRealm - 1;
  assert(AutoRunner._generatorMarginalValue(gated) === null, `${gated.id} withheld below its reqRealm even with ample Qi`);
  Game.state.realm = gated.reqRealm;
  assert(AutoRunner._generatorMarginalValue(gated) !== null, `${gated.id} becomes valid at its reqRealm`);
}
console.log('    Marginal value respects affordability, reqRealm gating, and milestone-aware math ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — marginal value spikes across a milestone threshold
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: crossing a genMilestones threshold spikes marginal value');
{
  freshState({ qi: 1e30, realm: 0 });
  const g = GameData.generators[0];
  const firstMilestone = GameData.genMilestones[0]; // 10
  Game.state.owned[g.id] = firstMilestone - 2; // buying 1 does NOT cross it
  const normal = AutoRunner._generatorMarginalValue(g);
  Game.state.owned[g.id] = firstMilestone - 1; // buying 1 DOES cross it (-1 -> exactly at threshold)
  const spike = AutoRunner._generatorMarginalValue(g);
  assert(spike.gain > normal.gain * 1.5, `crossing the ${firstMilestone}-owned milestone meaningfully spikes the marginal gain (normal=${normal.gain}, spike=${spike.gain})`);
}
console.log('    Greedy ranking will naturally prioritize pushing a generator through a milestone ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — _buyGeneratorsGreedy(): picks best efficiency, drains Qi correctly
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5: greedy generator buying');
{
  freshState({ qi: 1e8, realm: 0 });
  const bought = AutoRunner._buyGeneratorsGreedy();
  assert(bought > 0, 'bought at least one generator with ample Qi');
  assert(Game.state.qi < 1e8, 'Qi was spent');
  assert(Game.state.qi >= 0, 'Qi never goes negative');
  // Nothing more affordable now for THIS generator only if truly out of
  // budget — re-running should buy 0 more (idempotent at exhaustion).
  const before = Game.state.qi;
  const boughtAgain = AutoRunner._buyGeneratorsGreedy();
  if (boughtAgain === 0) assert(Game.state.qi === before, 'no more purchases possible, Qi unchanged');
}
console.log('    Greedy buyer spends down available Qi without going negative ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 6 — tick(): stage advances loop and are toasted as ONE summary
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 6: tick() clears multiple minor stages in one call, one summary toast');
{
  freshState({ qi: 1e30, realm: 0, stage: 0 });
  AutoRunner.setEnabled(true);
  toasts.length = 0;
  const stageBefore = Game.state.stage;
  AutoRunner.tick();
  assert(Game.state.stage > stageBefore, `stage advanced at least once (was ${stageBefore}, now ${Game.state.stage})`);
  const stageToasts = toasts.filter(t => t.includes('advanced') && t.includes('stage'));
  assert(stageToasts.length === 1, `exactly ONE stage-advance summary toast even if multiple stages cleared (got ${stageToasts.length}: ${JSON.stringify(toasts)})`);
}
console.log('    Multiple stage advances in one tick are batched into a single toast ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 7 — tick(): generator purchases never toast individually (or at all)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 7: generator purchases stay silent, matching manual buyGen() convention');
{
  // Realm complete AND breakthrough blocked (pill-required realm, no pill
  // in hand) so neither the breakthrough nor stage-advance branches fire —
  // isolates the generator-buying branch as the only toast source.
  const pillRealm = GameData.realms.findIndex(r => r.pillCost > 0);
  freshState({ qi: 1e12, realm: pillRealm, stage: GameData.realms[pillRealm].stages.length, breakthroughPills: 0 });
  AutoRunner.setEnabled(true);
  toasts.length = 0;
  AutoRunner.tick();
  assert(!Game.canBreakThrough(), 'fixture check: breakthrough correctly blocked (no pill)');
  const genToasts = toasts.filter(t => /generator|Ground/i.test(t));
  assert(genToasts.length === 0, `no generator-purchase toasts fired (got ${JSON.stringify(toasts)})`);
}
console.log('    Generator purchases produce zero toasts, same as manual play ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 8 — tick(): upgrades bought and summarized
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 8: tick() buys every affordable upgrade, one summary toast');
{
  // Same isolation trick as Test 7 — pill-required realm, no pill, so
  // breakthrough can't short-circuit the tick before reaching upgrades.
  const pillRealm = GameData.realms.findIndex(r => r.pillCost > 0);
  freshState({ qi: 1e30, realm: pillRealm, stage: GameData.realms[pillRealm].stages.length, breakthroughPills: 0, daoComprehension: 1e9 });
  AutoRunner.setEnabled(true);
  toasts.length = 0;
  AutoRunner.tick();
  const anyLearned = GameData.upgrades.some(u => Game.state.upgrades[u.id]);
  assert(anyLearned, 'at least one upgrade was purchased');
  const upgToasts = toasts.filter(t => t.includes('learned') && t.includes('manual'));
  assert(upgToasts.length <= 1, `upgrade purchases are batched into at most one toast per tick (got ${upgToasts.length})`);
}
console.log('    Upgrade purchases (both qi and dao currency) are batched into one toast ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 9 — tick(): breakthrough takes priority and short-circuits the tick
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 9: breakthrough pre-empts stage/generator purchases in the same tick');
{
  // Mortal realm (index 0) has pillCost 0 -> pillRequired() false ->
  // tribulationChance() === 1 (guaranteed, see game.js) — deterministic.
  freshState({ qi: 1e30, realm: 0, stage: 2, runQi: 1e6 }); // stage=2 = realmComplete for Mortal (2 stages)
  AutoRunner.setEnabled(true);
  toasts.length = 0;
  const realmBefore = Game.state.realm;
  AutoRunner.tick();
  assert(Game.state.realm === realmBefore + 1, `breakthrough fired this tick (realm ${realmBefore} -> ${Game.state.realm})`);
  assert(Game.state.qi === 0, 'breakthrough reset Qi (generators wiped too)');
  assert(toasts.some(t => t.includes('ascended')), 'breakthrough toast fired');
  assert(!toasts.some(t => t.includes('advanced') && t.includes('stage')), 'no stage-advance toast in the SAME tick as a breakthrough (it returns early)');
}
console.log('    Breakthrough short-circuits the tick — no double-dipping stage/generator logic the same tick ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 10 — canBreakThrough() gating still applies (pill-required realms)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 10: Auto-Runner respects pill-required breakthroughs — never bypasses the gate');
{
  // Foundation Establishment (index 2) has a real pillCost, per gameData.js.
  const pillRealm = GameData.realms.findIndex(r => r.pillCost > 0);
  assert(pillRealm > 0, 'fixture assumption: some realm requires a pill');
  freshState({ qi: 1e30, realm: pillRealm, stage: GameData.realms[pillRealm].stages.length, breakthroughPills: 0 });
  AutoRunner.setEnabled(true);
  toasts.length = 0;
  const realmBefore = Game.state.realm;
  AutoRunner.tick();
  assert(Game.state.realm === realmBefore, 'no breakthrough without a pill in hand — Auto-Runner does not auto-buy pills (out of scope)');
  assert(!toasts.some(t => t.includes('ascended')), 'no ascension toast fired');
}
console.log('    Pill-gated realms correctly block auto-breakthrough (Auto-Runner never auto-buys pills) ✓');

console.log('\n✓ All smoke27 tests passed.');
