/* smoke17.js — Round 17 "Academy & Career Depth" regression tests.
 *
 * Covers the four pillars added in response to "for the work and study I
 * would like to also have more layers":
 *   1. Elective grid (4 paths × 3 tiers + mastery capstone), unlocked at
 *      University education, sharing the single `study` slot with the base
 *      course ladder via a `kind` tag.
 *   2. Career promotion Ranks (one-time pay bonuses, catch-up-safe for
 *      offline jobXp jumps) + a permanent Specialization choice at Expert.
 *   3. Active-play skill-check events for both Study and Work.
 *   4. GameData relocation (COURSES/JOBS moved out of life.js local consts).
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
['gameData', 'time', 'game', 'life'].forEach(m => {
  eval(fs.readFileSync(`www/js/${m}.js`, 'utf8'));
});
global.Storage = { save: () => true, wipe: () => {} };

console.log('Testing Round 17 Academy & Career Depth...');

function freshGame() {
  Game.state = Game.newState();
  Life.init();
  return Game;
}

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — GameData relocation: courses/jobs live in GameData, Life mirrors them
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: COURSES/JOBS relocated into GameData');
assert(Array.isArray(GameData.courses) && GameData.courses.length === 5, 'GameData.courses has 5 entries');
assert(Array.isArray(GameData.jobs) && GameData.jobs.length === 5, 'GameData.jobs has 5 entries');
assert(Life.courses === GameData.courses, 'Life.courses is the same array as GameData.courses');
assert(Life.jobs === GameData.jobs, 'Life.jobs is the same array as GameData.jobs');
console.log('    Base tables relocated and mirrored correctly ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — Elective data integrity: 4 paths × 3 tiers, ascending cost/dur
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: Elective grid shape (4 paths × 3 tiers)');
const paths = Object.keys(GameData.electivePathLabels);
assert(paths.length === 4, `4 elective paths defined (got ${paths.length})`);
paths.forEach(path => {
  const nodes = GameData.electiveNodes.filter(n => n.path === path).sort((a, b) => a.tier - b.tier);
  assert(nodes.length === 3, `path '${path}' has exactly 3 tiers (got ${nodes.length})`);
  for (let i = 1; i < nodes.length; i++) {
    assert(nodes[i].cost > nodes[i - 1].cost, `${path} tier ${nodes[i].tier} costs more than tier ${nodes[i-1].tier}`);
    assert(nodes[i].dur > nodes[i - 1].dur, `${path} tier ${nodes[i].tier} takes longer than tier ${nodes[i-1].tier}`);
  }
  assert(GameData.electiveMastery[path], `path '${path}' has a mastery capstone entry`);
});
console.log('    4 paths × 3 tiers, monotonic cost/duration, mastery capstones present ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — Elective gating: locked below electiveMinEdu, tier prereqs enforced
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: Elective enrollment gating');
{
  freshGame();
  Game.state.life.money = 1e9;
  Game.state.life.education = GameData.study.electiveMinEdu - 1;
  assert(!Life.electivesUnlocked(), 'electives locked below electiveMinEdu');
  assert(!Life.canEnrollElective('el_cul1'), 'cannot enroll tier1 while locked, even flush with cash');

  Game.state.life.education = GameData.study.electiveMinEdu;
  assert(Life.electivesUnlocked(), 'electives unlock at electiveMinEdu');
  assert(Life.canEnrollElective('el_cul1'), 'tier1 enrollable once unlocked');
  assert(!Life.canEnrollElective('el_cul2'), 'tier2 blocked until tier1 is done (prereq)');
  assert(Life.enrollElective('el_cul1'), 'enroll tier1 succeeds');
  assert(Life.isStudying() && Game.state.life.study.kind === 'elective', 'study slot now holds the elective, tagged correctly');
  assert(!Life.canEnrollElective('el_cul2'), 'cannot start a second activity while one is in progress');
}
console.log('    Locked below threshold, tier2 gated on tier1, single-activity slot enforced ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — Elective completion, path mastery, and bonus aggregation math
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: Elective completion + mastery bonus aggregation');
{
  freshGame();
  Game.state.life.money = 1e9;
  Game.state.life.education = GameData.study.electiveMinEdu;
  const path = 'refinement';
  const nodes = GameData.electiveNodes.filter(n => n.path === path).sort((a, b) => a.tier - b.tier);

  nodes.forEach((n, i) => {
    assert(Life.enrollElective(n.id), `enroll ${n.id} (tier ${n.tier})`);
    Game.state.life.study.endsAt = 0; // force-complete instantly
    Life.tick(0.001);
    assert(Life.electiveDone(n.id), `${n.id} marked done after completion`);
    assert(Life.electivePathMastered(path) === (i === nodes.length - 1), `path mastered only after the final tier (i=${i})`);
  });

  const expectedQiSum = nodes.reduce((s, n) => s + (n.bonus.qi || 0), 0) + GameData.electiveMastery[path].bonus.qi;
  assert(Math.abs(Life._electiveSum('qi') - expectedQiSum) < 1e-9, `_electiveSum('qi') = sum of tiers + mastery capstone (expected ${expectedQiSum}, got ${Life._electiveSum('qi')})`);
  assert(Math.abs(Life.qiStudyMult() - (1 + expectedQiSum)) < 1e-9, 'qiStudyMult() = 1 + summed qi bonus');
}
console.log('    Tier completion, mastery detection, and bonus-sum math all correct ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — Cross-system hooks: talentMult / jobPayRate / courtshipMult read elective bonuses
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5: Elective bonuses feed talentMult/jobPayRate/courtshipMult');
{
  freshGame();
  const baseTalentMult = Life.talentMult();
  const baseCourtship = Life.courtshipMult();
  Game.state.life.electives['el_cul1'] = true; // cultivation tier1: +0.03 talent
  Game.state.life.electives['el_art1'] = true; // arts tier1: +0.08 courtship
  assert(Math.abs(Life.talentMult() - (baseTalentMult + 0.03)) < 1e-9, 'talentMult() increases by the exact tier bonus');
  assert(Math.abs(Life.courtshipMult() - (baseCourtship + 0.08)) < 1e-9, 'courtshipMult() increases by the exact tier bonus');

  // jobPayRate: take a job, confirm business elective bonus multiplies pay.
  Game.state.life.education = 5; Game.state.life.money = 1e9;
  Life.takeJob('clerk');
  const payBefore = Life.jobPayRate();
  Game.state.life.electives['el_biz1'] = true; // business tier1: +0.05 pay
  const payAfter = Life.jobPayRate();
  assert(Math.abs(payAfter / payBefore - 1.05) < 1e-9, `jobPayRate scales by exactly (1+pay bonus) (expected x1.05, got x${(payAfter/payBefore).toFixed(4)})`);
}
console.log('    Cross-system multiplier hooks all read elective bonuses correctly ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 6 — Job rank catch-up: a large jobXp jump crosses multiple ranks at
// once (simulating an offline gain) without skipping any bonus
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 6: Job rank catch-up across a large jobXp jump');
{
  freshGame();
  Game.state.life.education = 5; Game.state.life.money = 0;
  Life.takeJob('exec');
  assert(Life.jobRankTitle() === 'Trainee', 'starts at Trainee');

  // Jump jobXp straight to level 40 (past Associate/Senior/Expert in one go).
  Game.state.life.jobXp = 40 * 60;
  const moneyBefore = Game.state.life.money;
  Life._checkJobRank();
  assert(Life.jobRankTitle() === 'Expert', `catches up to Expert in one pass (got ${Life.jobRankTitle()})`);
  assert(Game.state.life.jobRankClaimed === GameData.jobRanks.findIndex(r => r.title === 'Expert'), 'jobRankClaimed index matches Expert');
  assert(Game.state.life.money > moneyBefore, 'cumulative bonus money from all 3 skipped ranks was granted');

  // Re-checking at the same level must not re-grant anything.
  const moneyAfterCatchup = Game.state.life.money;
  Life._checkJobRank();
  assert(Game.state.life.money === moneyAfterCatchup, 'no double-grant when rank is re-checked at the same level');
}
console.log('    Multi-rank catch-up grants cumulative bonuses exactly once ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 7 — Specialization: gated until Expert, permanent, affects pay
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 7: Specialization gating and permanence');
{
  freshGame();
  Game.state.life.education = 5; Game.state.life.money = 0;
  Life.takeJob('exec');
  assert(!Life.canChooseSpecialization(), 'cannot choose before reaching Expert');
  assert(!Life.chooseSpecialization('climber'), 'chooseSpecialization refuses before Expert');

  Game.state.life.jobXp = 40 * 60; // -> Expert
  Life._checkJobRank();
  assert(Life.canChooseSpecialization(), 'can choose once Expert is reached');
  const payBefore = Life.jobPayRate();
  assert(Life.chooseSpecialization('climber'), 'chooseSpecialization succeeds at Expert');
  assert(Game.state.life.jobSpecialization === 'climber', 'specialization recorded');
  assert(Math.abs(Life.jobPayRate() / payBefore - 1.25) < 1e-9, 'climber grants exactly +25% pay');
  assert(!Life.canChooseSpecialization(), 'cannot choose again once already chosen');
  assert(!Life.chooseSpecialization('connector'), 'a second choice is refused (permanent)');

  // Switching jobs resets rank + specialization.
  Life.takeJob('alchemist');
  assert(Game.state.life.jobSpecialization === null, 'specialization resets on job switch');
  assert(Game.state.life.jobRankClaimed === 0, 'rank resets on job switch');
}
console.log('    Specialization locked behind Expert, permanent, resets on job switch ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 8 — Skill-check event resolution: success/fail branches + safe option
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 8: resolveLifeSkillEvent success/fail/safe branches');
{
  freshGame();
  const origRandom = Math.random;

  Math.random = () => 0; // always "succeeds" (0 < any successChance > 0)
  let res = Life.resolveLifeSkillEvent('study', 'se_debate', 0);
  assert(res.won === true, 'forced-low random rolls a success');
  assert(Game.state.life.talent === 10 && Game.state.life.intellect === 5, 'success effects applied (se_debate: +10 talent, +5 intellect)');

  Math.random = () => 0.999; // always "fails"
  Game.state.life.money = 100;
  res = Life.resolveLifeSkillEvent('study', 'se_debate', 0);
  assert(res.won === false, 'forced-high random rolls a failure');
  assert(Game.state.life.money === 0, 'fail effect (-¥300) clamps money at 0, never negative');

  // Safe option (index 1, no successChance) ignores RNG entirely.
  const talentBefore = Game.state.life.talent;
  res = Life.resolveLifeSkillEvent('study', 'se_debate', 1);
  assert(res.won === null, 'safe option reports no win/loss roll');
  assert(Game.state.life.talent === talentBefore, 'safe option applies its own (empty) effects, no side effects from the risk branch');

  Math.random = origRandom;
}
console.log('    Success/fail rolls and the safe fallback all resolve correctly, money clamps at 0 ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 9 — jobBonusSeconds effect scales with current job pay (Client Pitch event)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 9: jobBonusSeconds effect scales with jobPayRate()');
{
  freshGame();
  Game.state.life.education = 5; Game.state.life.money = 0;
  Life.takeJob('exec');
  const rate = Life.jobPayRate();
  const origRandom = Math.random;
  Math.random = () => 0; // success
  Life.resolveLifeSkillEvent('work', 'we_pitch', 0);
  assert(Math.abs(Game.state.life.money - rate * 600) < 1e-6, `we_pitch success grants exactly jobPayRate()*600 (expected ${rate*600}, got ${Game.state.life.money})`);
  Math.random = origRandom;
}
console.log('    jobBonusSeconds effect auto-scales with the current job\'s pay rate ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 10 — Reincarnation (passToHeir) resets all Round 17 life fields
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 10: passToHeir() resets electives/rank/specialization/events');
{
  freshGame();
  Game.state.life.education = 5; Game.state.life.money = 1e9;
  Life.takeJob('exec');
  Game.state.life.jobXp = 40 * 60;
  Life._checkJobRank();
  Life.chooseSpecialization('climber');
  Life.enrollElective('el_cul1');
  Game.state.life.studyEventAcc = 55; Game.state.life.workEventAcc = 77;

  assert(Object.keys(Game.state.life.electives).length === 0, 'sanity: el_cul1 still mid-progress, not yet in electives map');
  Game.state.life.study.endsAt = 0; Life.tick(0.001); // finish the elective so electives map is non-empty
  assert(Game.state.life.electives['el_cul1'], 'sanity: elective completed before reincarnating');

  Game.passToHeir(null);
  const l = Game.state.life;
  assert(Object.keys(l.electives).length === 0, 'electives reset to {} on passToHeir');
  assert(l.jobRankClaimed === 0, 'jobRankClaimed reset to 0');
  assert(l.jobSpecialization === null, 'jobSpecialization reset to null');
  assert(l.studyEventAcc === 0 && l.workEventAcc === 0, 'event accumulators reset to 0');
  assert(l.jobId === null && l.jobXp === 0, 'job reset (pre-existing behavior, still intact)');
  assert(l.study === null, 'study slot cleared (pre-existing behavior, still intact)');
}
console.log('    All Round 17 life fields reset correctly on bloodline succession ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 11 — Backward-compat: a save missing every Round 17 field self-heals
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 11: Old-save backfill for Round 17 fields');
{
  Game.state = Game.newState();
  // Simulate a pre-Round-17 save: only the original fields exist.
  Game.state.life = { money: 500, age: 30, ageAcc: 0, intellect: 10, charm: 5, talent: 20,
                       education: 3, study: null, jobId: 'clerk', jobXp: 700 };
  Life.init();
  assert(typeof Game.state.life.electives === 'object', 'electives backfilled');
  assert(Game.state.life.jobRankClaimed === 0, 'jobRankClaimed backfilled to 0');
  assert(Game.state.life.jobSpecialization === null, 'jobSpecialization backfilled to null');
  assert(Game.state.life.studyEventAcc === 0 && Game.state.life.workEventAcc === 0, 'event accumulators backfilled to 0');
  // Pre-existing fields must survive backfill untouched.
  assert(Game.state.life.money === 500 && Game.state.life.jobXp === 700, 'pre-existing fields preserved, not clobbered');
  // And derived getters must not throw/NaN on the backfilled state.
  assert(!isNaN(Life.jobPayRate()) && Life.jobPayRate() > 0, 'jobPayRate() computes cleanly on a backfilled old save');
  assert(Life.jobRankTitle() === 'Trainee', 'jobRankTitle() computes cleanly on a backfilled old save');
}
console.log('    Old saves backfill cleanly with no NaN/throws ✓');

console.log('\n✓ All smoke17 tests passed.');
