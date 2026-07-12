/* smoke14.js — Round 15: Family Depth Regression Tests
 * Courtship stakes (exclusivity/rivals/milestone scenes), marriage that stays
 * alive (bond, spousal events, widowhood), children who grow up (life stages,
 * paths, heir eligibility), and the Ancestor Hall (lineage log, house rep).
 */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
const window = global;

// ---- Minimal stubs ----------------------------------------------------------
let _now = Date.now();
const TimeService = { now() { return _now; }, monotonicNow() { return _now; } };
const GameNumbers  = { formatNumber: n => String(n) };

eval(require('fs').readFileSync('www/js/gameData.js', 'utf8')); // real data tables

const toasts = [];
const UI = {
  toast(msg) { toasts.push(msg); },
  renderResources() {},
  _modalOpen() { return false; },
  showSpousalEvent() {},
  showWidowEvent() {},
  showCourtshipScene() {},
};
window.UI = UI;

const Game = {
  state: null,
  persist() {},
  _addQi(n) { this.state.qi += n; },
  qiPerSecond() { return 10; },
  modVal(k) { return k === 'childCd' ? 1 : 1; },
  karmaTier() { return 'neutral'; },
  multipliers() { return { allMult: 1 }; },
  passToHeir() {},
};
window.Game = Game;

const Life = {
  s() { return Game.state.life; },
};
window.Life = Life;

eval(require('fs').readFileSync('www/js/family.js', 'utf8'));

function freshState() {
  return {
    qi: 0, realm: 3, name: 'TestCultivator', gender: 'male',
    spiritualRoot: GameData.spiritualRoots[0], daoComprehension: 0,
    traits: [], generation: 1, legacyBonus: 0, lineage: [], houseReputation: 0,
    life: { money: 1000000, age: 18, ageAcc: 0, intellect: 0, charm: 0, talent: 0, education: 0, study: null, jobId: null, jobXp: 0 },
    family: null,
  };
}

console.log('Testing Round 15: Family Depth...');

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — Life stages: stageOf() boundaries match GameData.childStages
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: Child life stages');
Game.state = freshState();
Family.init();
assert(Family.stageOf(0).key === 'infant', 'age 0 = infant');
assert(Family.stageOf(2).key === 'infant', 'age 2 = infant');
assert(Family.stageOf(3).key === 'child', 'age 3 = child');
assert(Family.stageOf(8).key === 'child', 'age 8 = child');
assert(Family.stageOf(9).key === 'youth', 'age 9 = youth');
assert(Family.stageOf(15).key === 'youth', 'age 15 = youth');
assert(Family.stageOf(16).key === 'adult', 'age 16 = adult');
assert(Family.stageOf(50).key === 'adult', 'age 50 = adult');
console.log('    Life stage boundaries OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — Heir eligibility: gated on reaching Youth stage
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: Heir eligibility gating');
const infant = { age: 1, root: GameData.spiritualRoots[0] };
const child  = { age: 5, root: GameData.spiritualRoots[0] };
const youth  = { age: 10, root: GameData.spiritualRoots[0] };
const adult  = { age: 20, root: GameData.spiritualRoots[0] };
assert(!Family.isHeirEligible(infant), 'infant not heir-eligible');
assert(!Family.isHeirEligible(child), 'child not heir-eligible');
assert(Family.isHeirEligible(youth), 'youth IS heir-eligible');
assert(Family.isHeirEligible(adult), 'adult IS heir-eligible');
console.log('    Heir eligibility gating OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — Child paths: selection gating + bonuses
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: Child path selection and bonuses');
Game.state = freshState();
Family.init();
Game.state.family.spouse = { name: 'Spouse', gender: 'female', root: GameData.spiritualRoots[0], trait: 'Kind', traits: [], bond: 0, marriedAtAge: 18 };
Game.state.family.children = [
  { name: 'Kid A', age: 5, root: GameData.spiritualRoots[0], traits: [], nurture: 0, path: null, lastStage: 'child' },
  { name: 'Kid B', age: 12, root: GameData.spiritualRoots[0], traits: [], nurture: 0, path: null, lastStage: 'youth' },
];
assert(!Family.canChoosePath(Game.state.family.children[0]), 'child (age 5) cannot choose a path yet');
assert(Family.canChoosePath(Game.state.family.children[1]), 'youth (age 12) can choose a path');
assert(!Family.choosePath(0, 'cultivation'), 'choosePath fails for an ineligible child');
assert(Family.choosePath(1, 'cultivation'), 'choosePath succeeds for an eligible child');
assert(Game.state.family.children[1].path === 'cultivation', 'path recorded on the child');
assert(!Family.canChoosePath(Game.state.family.children[1]), 'cannot re-choose a path once set');
assert(!Family.choosePath(1, 'martial'), 'choosePath rejects a second selection');
assert(Math.abs(Family.childCultivationBonus() - 0.03) < 1e-9, 'childCultivationBonus reflects the one cultivation-path child');

Game.state.family.children.push({ name: 'Kid C', age: 20, root: GameData.spiritualRoots[0], traits: [], nurture: 0, path: 'martial', lastStage: 'adult' });
assert(Math.abs(Family.combatBonus() - 0.04) < 1e-9, 'combatBonus reflects the martial-path child');
console.log('    Child paths OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — ageUp(): fires a stage-transition event exactly on the crossing
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: Stage-transition flavour events');
Game.state = freshState();
Family.init();
Game.state.family.spouse = { name: 'Spouse', gender: 'female', root: GameData.spiritualRoots[0], trait: 'Kind', traits: [], bond: 0, marriedAtAge: 18 };
Game.state.family.children = [{ name: 'Newborn', age: 2, root: GameData.spiritualRoots[0], traits: [], nurture: 0, path: null, lastStage: 'infant' }];
let events = Family.ageUp(); // age 2 -> 3: infant -> child
assert(Game.state.family.children[0].age === 3, 'child aged up to 3');
assert(events.length === 1, `stage-transition event fires exactly once on crossing (got ${events.length})`);
assert(Game.state.family.children[0].lastStage === 'child', 'lastStage updated to child');
events = Family.ageUp(); // age 3 -> 4: still child, no transition
assert(events.length === 0, 'no event on a non-crossing age-up');
console.log('    Stage-transition events OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — Marriage bond: spendTimeWithSpouse + spouseBondBonus scaling
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5: Spouse bond building');
Game.state = freshState();
Family.init();
Game.state.family.spouse = { name: 'Spouse', gender: 'female', root: GameData.spiritualRoots[0], trait: 'Kind', traits: [], bond: 0, marriedAtAge: 18 };
assert(Family.spouseBondBonus() === 0, 'bond bonus 0 at bond 0');
assert(Family.canSpendTimeWithSpouse(), 'can spend time initially');
assert(Family.spendTimeWithSpouse(), 'spendTimeWithSpouse succeeds');
assert(Game.state.family.spouse.bond === 6, 'bond incremented by 6');
assert(!Family.canSpendTimeWithSpouse(), 'on cooldown immediately after');
Game.state.family.spouse.bond = 100;
assert(Math.abs(Family.spouseBondBonus() - 0.15) < 1e-9, 'bond bonus caps at +15% at bond 100');
console.log('    Spouse bond OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 6 — familyMult() includes both bond bonus and child path bonus
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 6: familyMult() integrates bond + path bonuses');
Game.state = freshState();
Family.init();
const baseMult = Family.familyMult();
assert(baseMult === 1, 'familyMult is 1 with no spouse/children');
Game.state.family.spouse = { name: 'Spouse', gender: 'female', root: GameData.spiritualRoots[0], trait: 'Kind', traits: [], bond: 50, marriedAtAge: 18 };
const withSpouse = Family.familyMult();
assert(withSpouse > baseMult, 'spouse increases familyMult');
Game.state.family.children = [{ name: 'Kid', age: 20, root: GameData.spiritualRoots[0], traits: [], nurture: 0, path: 'cultivation', lastStage: 'adult' }];
const withChild = Family.familyMult();
assert(withChild > withSpouse + 0.049, 'cultivation-path child adds its 3% on top of the base 5%');
console.log(`    familyMult: ${baseMult} -> ${withSpouse.toFixed(3)} -> ${withChild.toFixed(3)} ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 7 — Spousal events: resolveSpousalEvent grants bond, spends cost,
// rejects when unaffordable
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 7: Spousal event resolution');
Game.state = freshState();
Family.init();
Game.state.family.spouse = { name: 'Spouse', gender: 'female', root: GameData.spiritualRoots[0], trait: 'Kind', traits: [], bond: 0, marriedAtAge: 18 };
const freeEvent = GameData.spousalEvents.find(e => !e.options.some(o => o.cost));
const res1 = Family.resolveSpousalEvent(freeEvent, 0);
assert(res1.ok, 'free spousal event option resolves ok');
assert(Game.state.family.spouse.bond === freeEvent.options[0].bond, 'bond incremented by the option amount');

const paidEvent = GameData.spousalEvents.find(e => e.options.some(o => o.cost));
Game.state.life.money = 100; // not enough
const paidOptIdx = paidEvent.options.findIndex(o => o.cost);
const res2 = Family.resolveSpousalEvent(paidEvent, paidOptIdx);
assert(!res2.ok && res2.reason === 'cost', 'insufficient funds rejects the paid option');
console.log('    Spousal event resolution OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 8 — Widowhood: gated on years married; endMarriage() resets state
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 8: Widowhood gating and endMarriage()');
Game.state = freshState();
Family.init();
Game.state.family.spouse = { name: 'Spouse', gender: 'female', root: GameData.spiritualRoots[0], trait: 'Kind', traits: [], bond: 20, marriedAtAge: 18 };
Game.state.life.age = 20; // only 2 years married
assert(Family._tryWidowRoll() === null, 'widowhood cannot roll before the minimum years-married threshold');
Game.state.life.age = 30; // 12 years married, past the threshold — roll is now POSSIBLE (probabilistic)
let anyRoll = false;
for (let i = 0; i < 500; i++) { if (Family._tryWidowRoll()) { anyRoll = true; break; } }
assert(anyRoll, 'widowhood can roll after the minimum years-married threshold (sampled 500 attempts)');

Family.endMarriage();
assert(Game.state.family.spouse === null, 'spouse cleared after endMarriage()');
assert(Game.state.family.candidates.length > 0, 'courtship pool reseeded after endMarriage()');
console.log('    Widowhood + endMarriage OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 9 — Courtship exclusivity: primary tracking + rival decay/departure
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 9: Courtship exclusivity and rival departure');
Game.state = freshState();
Family.init();
Game.state.family.candidates = [
  Family._makeCandidate('free', 20, false),
  Family._makeCandidate('free', 20, false),
];
const [candA, candB] = Game.state.family.candidates;
candA.affinity = 60; // above the primary threshold
Family._updatePrimary(candA);
assert(Family.isPrimary(candA.id), 'candA becomes primary at 60 affinity');
assert(!Family.isPrimary(candB.id), 'candB is not primary');

candB.affinity = 5;
for (let i = 0; i < 2000; i++) Family.tick(1); // large dt sweep: decay + eventual departure roll
assert(candB.affinity === 0 || !Game.state.family.candidates.some(c => c.id === candB.id),
  'non-primary candidate decays to 0 and is eventually removed from the pool');
assert(Game.state.family.candidates.some(c => c.id === candA.id), 'primary candidate is never removed by decay');
assert(Game.state.family.candidates.length >= 3, 'pool is replenished after a departure');
console.log('    Courtship exclusivity OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 10 — Courtship milestone scenes: trigger once per scene, resolve
// applies the affinity delta
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 10: Courtship milestone scenes');
Game.state = freshState();
Family.init();
Game.state.family.candidates = [Family._makeCandidate('free', 20, false)];
const cand = Game.state.family.candidates[0];
cand.affinity = 24;
Family._gain(cand, 1); // crosses 25 -> triggers the first courtship scene
assert(Family._pendingCourtshipScene, 'a courtship scene is queued on crossing the milestone');
const pending = Family._pendingCourtshipScene;
Family._pendingCourtshipScene = null;
const before = cand.affinity;
const sceneRes = Family.resolveCourtshipScene(pending.scene, pending.candId, 0);
assert(sceneRes.ok, 'courtship scene resolves ok');
assert(cand.affinity === Math.min(100, before + pending.scene.options[0].affinity), 'affinity delta applied');
// Re-gaining affinity across the SAME milestone must not re-trigger it.
Family._gain(cand, 1);
assert(!Family._pendingCourtshipScene, 'the same milestone scene does not fire twice');
console.log('    Courtship milestone scenes OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 11 — Lineage: summaryForLineage() shape
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 11: Lineage summary shape');
Game.state = freshState();
Family.init();
Game.state.family.spouse = { name: 'Spouse', gender: 'female', root: GameData.spiritualRoots[0], trait: 'Kind', traits: [], bond: 40, marriedAtAge: 18 };
Game.state.family.children = [{ name: 'Heir Kid', age: 12, root: GameData.spiritualRoots[0], traits: [], nurture: 0, path: null, lastStage: 'youth' }];
const heir = Game.state.family.children[0];
const summary = Family.summaryForLineage(heir);
assert(summary.generation === 1, 'summary captures generation');
assert(summary.spouseName === 'Spouse', 'summary captures spouse name');
assert(summary.childCount === 1, 'summary captures child count');
assert(summary.heirName === 'Heir Kid', 'summary captures the chosen heir');
console.log('    Lineage summary shape OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 12 — Migration: init() backfills every Round-15 sub-field on saves
// that predate this round
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 12: Round-15 migration backfill');
Game.state = freshState();
Game.state.family = {
  candidates: [{ id: 'c1', name: 'Old Candidate', affinity: 10 }], // no milestonesSeen
  spouse: { name: 'Old Spouse', root: GameData.spiritualRoots[0] }, // no bond/marriedAtAge
  children: [{ name: 'Old Kid', age: 7, root: GameData.spiritualRoots[0] }], // no path/lastStage
  childCooldown: 0,
  // no primaryCandidateId / spousalEventAcc
};
Family.init(); // must not throw
assert(Game.state.family.primaryCandidateId === null, 'primaryCandidateId backfilled');
assert(Game.state.family.spousalEventAcc === 0, 'spousalEventAcc backfilled');
assert(Game.state.family.spouse.bond === 0, 'spouse.bond backfilled');
assert(Game.state.family.spouse.marriedAtAge === 18, 'spouse.marriedAtAge backfilled from life.age');
assert(Game.state.family.children[0].path === null, 'child.path backfilled');
assert(Game.state.family.children[0].lastStage === 'child', 'child.lastStage backfilled from current age');
assert(Game.state.family.children[0].spouse === null, 'child.spouse backfilled');
assert(Array.isArray(Game.state.family.candidates[0].milestonesSeen), 'candidate.milestonesSeen backfilled');
Family.tick(1); // must not throw on the migrated shape
console.log('    Round-15 migration OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 13 — Child marriage: eligibility gating (stage + affordability)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 13: Child marriage eligibility gating');
Game.state = freshState();
Family.init();
Game.state.life.money = 100000;
const kidChild = { name: 'Kid Child', age: 5, root: GameData.spiritualRoots[0], traits: [], nurture: 0, path: null, lastStage: 'child', spouse: null };
const kidYouth = { name: 'Kid Youth', age: 12, root: GameData.spiritualRoots[0], traits: [], nurture: 0, path: null, lastStage: 'youth', spouse: null };
const kidAdult = { name: 'Kid Adult', age: 20, root: GameData.spiritualRoots[0], traits: [], nurture: 0, path: null, lastStage: 'adult', spouse: null };
Game.state.family.children = [kidChild, kidYouth, kidAdult];
assert(!Family.canArrangeMarriage(kidChild), 'a Child-stage kid cannot be married off');
assert(!Family.canArrangeMarriage(kidYouth), 'a Youth-stage kid cannot be married off');
assert(Family.canArrangeMarriage(kidAdult), 'an Adult-stage kid CAN be married off');
Game.state.life.money = 0;
assert(!Family.canArrangeMarriage(kidAdult), 'insufficient funds blocks arranging a marriage');
console.log('    Child marriage eligibility OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 14 — Child marriage: arrangeMarriage() deducts cost, grants a
// root-scaled gift, sets child.spouse, and feeds familyMult()
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 14: arrangeMarriage() end-to-end');
Game.state = freshState();
Family.init();
Game.state.life.money = 100000;
Game.state.family.children = [{ name: 'Marriageable', age: 20, root: GameData.spiritualRoots[0], traits: [], nurture: 0, path: null, lastStage: 'adult', spouse: null }];
const moneyBefore = Game.state.life.money;
const daoBefore = Game.state.daoComprehension;
const multBefore = Family.familyMult();
const marriageRes = Family.arrangeMarriage(0);
assert(marriageRes, 'arrangeMarriage returns a result object on success');
assert(Game.state.family.children[0].spouse !== null, 'child.spouse is now set');
assert(Game.state.family.children[0].spouse.name === marriageRes.spouse.name, 'result matches the assigned spouse');
const expectedMoney = moneyBefore - 2500 + marriageRes.gift; // CHILD_MARRIAGE_COST
assert(Game.state.life.money === expectedMoney, `money = before - cost + gift (got ${Game.state.life.money}, expected ${expectedMoney})`);
assert(Game.state.daoComprehension > daoBefore, 'dao comprehension gifted from the in-laws');
assert(!Family.canArrangeMarriage(Game.state.family.children[0]), 'cannot arrange a second marriage for the same child');
assert(Family.arrangeMarriage(0) === null, 'arrangeMarriage rejects an already-married child');
assert(Family.familyMult() > multBefore, 'familyMult() increases once a child is married');
console.log(`    arrangeMarriage: gift=¥${marriageRes.gift}, familyMult ${multBefore.toFixed(3)} -> ${Family.familyMult().toFixed(3)} ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 15 — Child marriage feeds the Ancestor Hall's marriedChildCount
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 15: summaryForLineage() reports married children');
Game.state = freshState();
Family.init();
Game.state.life.money = 100000;
Game.state.family.children = [
  { name: 'Married Kid', age: 20, root: GameData.spiritualRoots[0], traits: [], nurture: 0, path: null, lastStage: 'adult', spouse: null },
  { name: 'Single Kid',  age: 20, root: GameData.spiritualRoots[0], traits: [], nurture: 0, path: null, lastStage: 'adult', spouse: null },
];
Family.arrangeMarriage(0);
const lineageSummary = Family.summaryForLineage(null);
assert(lineageSummary.childCount === 2, 'summary counts all children');
assert(lineageSummary.marriedChildCount === 1, 'summary counts only the married child');
console.log('    marriedChildCount OK ✓');

console.log('\n✓ All smoke14 tests passed.');
