/* smoke17.js — Round 17 "Academy & Career Depth" + Round 18 "per-job
 * progress memory" regression tests.
 *
 * Covers the four Round 17 pillars added in response to "for the work and
 * study I would like to also have more layers":
 *   1. Elective grid (4 paths × 3 tiers + mastery capstone), unlocked at
 *      University education, sharing the single `study` slot with the base
 *      course ladder via a `kind` tag.
 *   2. Career promotion Ranks (one-time pay bonuses, catch-up-safe for
 *      offline jobXp jumps) + a permanent Specialization choice at Expert.
 *   3. Active-play skill-check events for both Study and Work.
 *   4. GameData relocation (COURSES/JOBS moved out of life.js local consts).
 * Plus the Round 18 fix: switching jobs used to reset level/rank/
 * specialization to zero every time — level/rank/specialization now live
 * per-job in life.jobProgress[jobId], so switching away and back resumes
 * exactly where you left off (Test 7, Test 12) and old saves migrate their
 * previously-flat progress into the new shape without losing it (Test 11b).
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
  Life.jobProgress('exec').xp = 40 * 60;
  const moneyBefore = Game.state.life.money;
  Life._checkJobRank();
  assert(Life.jobRankTitle() === 'Expert', `catches up to Expert in one pass (got ${Life.jobRankTitle()})`);
  assert(Life.jobProgress('exec').rankClaimed === GameData.jobRanks.findIndex(r => r.title === 'Expert'), 'rankClaimed index matches Expert');
  assert(Game.state.life.money > moneyBefore, 'cumulative bonus money from all 3 skipped ranks was granted');

  // Re-checking at the same level must not re-grant anything.
  const moneyAfterCatchup = Game.state.life.money;
  Life._checkJobRank();
  assert(Game.state.life.money === moneyAfterCatchup, 'no double-grant when rank is re-checked at the same level');
}
console.log('    Multi-rank catch-up grants cumulative bonuses exactly once ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 7 — Specialization: gated until Expert, permanent, and (Round 18)
// per-job — switching away and back resumes the same rank/specialization
// instead of resetting, while an untouched job still starts at Trainee.
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 7: Specialization gating, permanence, and per-job memory');
{
  freshGame();
  Game.state.life.education = 5; Game.state.life.money = 0;
  Life.takeJob('exec');
  assert(!Life.canChooseSpecialization(), 'cannot choose before reaching Expert');
  assert(!Life.chooseSpecialization('climber'), 'chooseSpecialization refuses before Expert');

  Life.jobProgress('exec').xp = 40 * 60; // -> Expert
  Life._checkJobRank();
  assert(Life.canChooseSpecialization(), 'can choose once Expert is reached');
  const payBefore = Life.jobPayRate();
  assert(Life.chooseSpecialization('climber'), 'chooseSpecialization succeeds at Expert');
  assert(Life.jobProgress('exec').specialization === 'climber', 'specialization recorded on the exec job record');
  assert(Math.abs(Life.jobPayRate() / payBefore - 1.25) < 1e-9, 'climber grants exactly +25% pay');
  assert(!Life.canChooseSpecialization(), 'cannot choose again once already chosen');
  assert(!Life.chooseSpecialization('connector'), 'a second choice is refused (permanent)');

  // Round 18: switching to a DIFFERENT (never-held) job starts fresh at Trainee...
  Life.takeJob('alchemist');
  assert(Life.jobRankTitle() === 'Trainee', 'a never-held job starts at Trainee');
  assert(!Life.canChooseSpecialization(), 'no specialization available yet on the new job');

  // ...but exec's own progress is untouched and waiting.
  assert(Life.jobProgress('exec').rankClaimed === GameData.jobRanks.findIndex(r => r.title === 'Expert'), "exec's rank survives the switch away");
  assert(Life.jobProgress('exec').specialization === 'climber', "exec's specialization survives the switch away");

  // Switching BACK to exec resumes exactly where it left off.
  Life.takeJob('exec');
  assert(Life.jobRankTitle() === 'Expert', 'switching back to exec resumes at Expert (no reset)');
  assert(Math.abs(Life.jobPayRate() / payBefore - 1.25) < 1e-9, 'switching back also resumes the specialization pay bonus');
}
console.log('    Specialization locked behind Expert, permanent, and now survives switching jobs and back ✓');

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
console.log('\n  Test 10: passToHeir() resets electives/jobProgress/events');
{
  freshGame();
  Game.state.life.education = 5; Game.state.life.money = 1e9;
  Life.takeJob('exec');
  Life.jobProgress('exec').xp = 40 * 60;
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
  assert(Object.keys(l.jobProgress).length === 0, 'jobProgress reset to {} on passToHeir — the heir starts every job fresh');
  assert(l.studyEventAcc === 0 && l.workEventAcc === 0, 'event accumulators reset to 0');
  assert(l.jobId === null, 'job reset (pre-existing behavior, still intact)');
  assert(l.study === null, 'study slot cleared (pre-existing behavior, still intact)');
}
console.log('    All Round 17/18 life fields reset correctly on bloodline succession ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 11 — Backward-compat: two generations of old saves self-heal
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 11: Old-save backfill/migration');
{
  // (a) Pre-Round-17 save: only the very original fields exist, no jobXp
  // of any kind. Must backfill cleanly with no NaN.
  Game.state = Game.newState();
  Game.state.life = { money: 500, age: 30, ageAcc: 0, intellect: 10, charm: 5, talent: 20,
                       education: 3, study: null, jobId: 'clerk' };
  Life.init();
  assert(typeof Game.state.life.electives === 'object', 'electives backfilled');
  assert(typeof Game.state.life.jobProgress === 'object', 'jobProgress backfilled to {}');
  assert(Game.state.life.studyEventAcc === 0 && Game.state.life.workEventAcc === 0, 'event accumulators backfilled to 0');
  assert(Game.state.life.money === 500, 'pre-existing fields preserved, not clobbered');
  assert(!isNaN(Life.jobPayRate()) && Life.jobPayRate() > 0, 'jobPayRate() computes cleanly on a backfilled old save');
  assert(Life.jobRankTitle() === 'Trainee', 'jobRankTitle() computes cleanly on a backfilled old save');
}
{
  // (b) Round-17-shaped save: has the flat jobXp/jobRankClaimed/
  // jobSpecialization fields this exact update replaces. Must MIGRATE that
  // progress into jobProgress[jobId], not discard it.
  Game.state = Game.newState();
  Game.state.life = { money: 500, age: 30, ageAcc: 0, intellect: 10, charm: 5, talent: 20,
                       education: 5, study: null, jobId: 'exec',
                       jobXp: 40 * 60, jobRankClaimed: 3, jobSpecialization: 'climber' };
  Life.init();
  assert(Game.state.life.jobXp === undefined, 'flat jobXp field removed after migration');
  assert(Game.state.life.jobRankClaimed === undefined, 'flat jobRankClaimed field removed after migration');
  assert(Game.state.life.jobSpecialization === undefined, 'flat jobSpecialization field removed after migration');
  const prog = Life.jobProgress('exec');
  assert(prog.xp === 40 * 60, 'xp carried over into jobProgress.exec (not reset to 0)');
  assert(prog.rankClaimed === 3, 'rankClaimed carried over into jobProgress.exec');
  assert(prog.specialization === 'climber', 'specialization carried over into jobProgress.exec');
  assert(Life.jobRankTitle() === 'Expert', 'jobRankTitle() reflects the migrated rank, not Trainee');
}
console.log('    Both pre-Round-17 and Round-17-shaped saves migrate cleanly, no lost progress ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 12 — The reported bug, directly: switching jobs must NOT reset level
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 12: Switching jobs no longer resets job level (user-reported bug)');
{
  freshGame();
  Game.state.life.education = 5; Game.state.life.money = 0;
  Life.takeJob('clerk');
  Life.jobProgress('clerk').xp = 15 * 60; // level 15, well short of any rank threshold
  const levelBefore = Life.jobLevel();
  assert(levelBefore === 15, `sanity: clerk sits at level 15 (got ${levelBefore})`);

  Life.takeJob('engineer'); // switch away
  assert(Life.jobLevel() === 0, 'the newly-taken engineer job starts at level 0, not clerk\'s level');

  Life.takeJob('clerk'); // switch back
  assert(Life.jobLevel() === 15, `switching back to clerk restores level 15 exactly, not reset to 0 (got ${Life.jobLevel()})`);
}
console.log('    Switching jobs and back preserves the exact level — bug fixed ✓');

console.log('\n✓ All smoke17 tests passed.');
