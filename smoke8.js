/* smoke8.js — Round 11: Achievement & Daily Mission Regression Tests */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
const window = global;

// ---- Minimal stubs ----------------------------------------------------------
let _now = Date.now();
const TimeService = {
  now()          { return _now; },
  monotonicNow() { return _now; },
};
const GameNumbers = { formatNumber: n => String(n) };
const GameData = {
  artifacts: {
    slots: [{ id: 'weapon' }],
    rarities: [{ id: 'common', weight: 50, statMult: 1 }],
    sets: [{ id: 'iron' }],
    slotWeights: { weapon: { atk: 2, hp: 0.5, qi: 0.3 } },
    invCap: 20, dropChance: 0, bossDropChance: 0,
    setBonus: { two: { combat: 0.05, qi: 0.02 }, four: { combat: 0.15, qi: 0.06 } },
  },
};

function todayStr() {
  const d = new Date(_now);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

const Game = {
  state: null,
  persist() {},
  _today() { return todayStr(); },
  _dayNumber(now) { return Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / 86400000); },
  _addQi() {},
  karmaLootMult() { return 1; },
  combatUnlocked() { return true; },
};

const Sect    = { lootMult() { return 1; }, combatMult() { return 1; }, petBonusMult() { return 1; }, addContribution() {} };
const Spirit  = { luckMult() { return 1; } };
const Blood   = { gain() {} };
const Challenges = { trialHard() { return false; }, stoneMult() { return 1; }, bloodMult() { return 1; }, eggMult() { return 1; }, enchantDiscount() { return 0; } };

window.Sect = Sect; window.Spirit = Spirit; window.Blood = Blood; window.Challenges = Challenges;

eval(require('fs').readFileSync('www/js/enchanting.js', 'utf8'));
eval(require('fs').readFileSync('www/js/artifacts.js', 'utf8'));
eval(require('fs').readFileSync('www/js/pets.js', 'utf8'));
eval(require('fs').readFileSync('www/js/combat.js', 'utf8'));
eval(require('fs').readFileSync('www/js/achievements.js', 'utf8'));
eval(require('fs').readFileSync('www/js/dailies.js', 'utf8'));

// ---- Fresh minimal game state -----------------------------------------------
function freshState() {
  return {
    realm: 0, spiritStones: 100000, beastEggs: 10,
    pets: { owned: {}, active: [] },
    combat: { zone: 1, wave: 1, highestZone: 1, playerHp: 100, paused: false },
    artifacts: { inventory: [], equipped: { weapon: null, robe: null, talisman: null, ring: null } },
    heirloom: { id: null, stacks: 0 },
    blood: { essence: 99999 },
    weeklyChallenge: { weekId: 0, claimed: false },
    boosters: {},
    quests: { claimed: {} },
    lifetimeKills: 0,
    lifetimeBossKills: 0,
    lifetimeStones: 0,
    lifetimeBoosterActivations: 0,
    stagesCleared: 0,
    reincarnations: 0,
    achievements: {},
    dailies: { day: null, missions: [], allComplete: false, sealClaimed: false, sealEndsAt: 0, streak: 0, weekReady: false, weekClaimed: false },
  };
}

console.log('Testing Round 11: Achievement & Daily Mission Layer...');

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — Daily missions: generated deterministically from the date
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: Deterministic daily mission generation');

Game.state = freshState();
const day1 = Dailies.missions();
assert(day1.length === 5, 'exactly 5 missions generated');
// All types must be unique within a day.
const types1 = day1.map(m => m.type);
assert(new Set(types1).size === 5, 'all 5 mission types are unique for the day');

// Calling missions() again returns the same set (idempotent).
const day1b = Dailies.missions();
assert(JSON.stringify(day1) === JSON.stringify(day1b), 'missions() is idempotent same day');

// Different calendar day must produce a different set (extremely unlikely to match).
const savedDay = Game.state.dailies.day;
Game.state.dailies.day = '2020-01-01'; // force a different day to be generated
Game.state.dailies.missions = [];       // clear so _ensureDay regenerates
Game.state.dailies.day = '2020-01-01'; // still old date
const forcedDay = Dailies._generate('2020-01-01');
const types2 = forcedDay.map(m => m.type);
// Both are valid 5-unique-type sets; just check length.
assert(forcedDay.length === 5, 'generation from arbitrary date yields 5 missions');

// Restore
Game.state.dailies.day = savedDay;
Game.state.dailies.missions = day1;
console.log('    Deterministic generation OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — Progress tracking: onKill() increments the kills mission
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: Progress tracking via onKill()');

Game.state = freshState();
// Force a kills mission to be first in the list for easy testing.
const killsMission = { type: 'kills', label: 'Defeat 20 enemies', target: 20, progress: 0, completed: false };
Game.state.dailies = {
  day: todayStr(), missions: [killsMission],
  allComplete: false, sealClaimed: false, sealEndsAt: 0, streak: 0, weekReady: false, weekClaimed: false,
};

Dailies.onKill();
assert(Game.state.dailies.missions[0].progress === 1, 'progress incremented to 1 after onKill');
Dailies.onKill();
assert(Game.state.dailies.missions[0].progress === 2, 'progress incremented to 2 after second onKill');

// Drive to completion
for (let i = 0; i < 18; i++) Dailies.onKill();
assert(Game.state.dailies.missions[0].progress === 20, 'progress capped at target (20)');
assert(Game.state.dailies.missions[0].completed === true, 'mission marked completed at target');
assert(Dailies.allComplete() === true, 'allComplete true when sole mission done');
// Over-shooting does not exceed target
Dailies.onKill();
assert(Game.state.dailies.missions[0].progress === 20, 'progress does not exceed target');
console.log('    Kill tracking & completion OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — Seal claim + timed buff
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: Seal claim and timed 2× Qi buff');

// State from previous test — allComplete is true, sealClaimed false.
assert(Dailies.allComplete() === true, 'allComplete still true');
assert(Dailies.sealClaimed() === false, 'seal not yet claimed');
assert(Dailies.qiMult() === 1, 'qiMult is 1 before claim');

const claimed = Dailies.claimSeal();
assert(claimed === true, 'claimSeal() returns true');
assert(Dailies.sealClaimed() === true, 'sealClaimed() true after claim');
assert(Dailies.sealActive() === true, 'seal is active immediately after claim');
assert(Dailies.qiMult() === 2, 'qiMult is 2 while seal active');

// Claiming twice returns false
const claimedAgain = Dailies.claimSeal();
assert(claimedAgain === false, 'second claimSeal() returns false');

// Advance time past the seal expiry.
_now += 2 * 60 * 60 * 1000 + 1000; // 2 hours + 1 second
assert(Dailies.sealActive() === false, 'seal inactive after 2h+1s');
assert(Dailies.qiMult() === 1, 'qiMult back to 1 after seal expires');
_now -= 2 * 60 * 60 * 1000 + 1000; // restore time
console.log('    Seal claim & 2× Qi buff OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — Day rollover: streak increments, missions regenerate
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: Day rollover and streak tracking');

const todayNum = Game._dayNumber(TimeService.now());

Game.state = freshState();
// Simulate a completed day that really was yesterday (consecutive).
Game.state.dailies.day       = 'yesterday';
Game.state.dailies.dayNum    = todayNum - 1;
Game.state.dailies.allComplete = true;
Game.state.dailies.streak    = 0;

// Calling missions() on a new day triggers rollover.
const newMissions = Dailies.missions();
assert(Game.state.dailies.day === todayStr(), 'day updated to today on rollover');
assert(newMissions.length === 5, '5 new missions generated');
assert(Game.state.dailies.streak === 1, 'streak incremented to 1 after completed consecutive day');
assert(Game.state.dailies.allComplete === false, 'allComplete reset to false');
assert(Game.state.dailies.sealClaimed === false, 'sealClaimed reset to false');
console.log('    Day rollover & streak increment OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — Streak breaks when previous day was incomplete
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5: Streak resets when day incomplete');

Game.state = freshState();
Game.state.dailies.day       = 'yesterday';
Game.state.dailies.dayNum    = todayNum - 1;
Game.state.dailies.allComplete = false; // incomplete!
Game.state.dailies.streak    = 5;

Dailies.missions(); // trigger rollover
assert(Game.state.dailies.streak === 0, 'streak reset to 0 after incomplete day');
console.log('    Streak reset on incomplete day OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5b — Streak breaks on a multi-day gap even if that last day was
// completed (regression: streak previously survived any-length gaps)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5b: Streak resets on non-consecutive gap');

Game.state = freshState();
Game.state.dailies.day       = 'five days ago';
Game.state.dailies.dayNum    = todayNum - 5; // NOT yesterday — a real gap
Game.state.dailies.allComplete = true;        // that day WAS fully completed
Game.state.dailies.streak    = 5;

Dailies.missions(); // rollover
assert(Game.state.dailies.streak === 0, 'streak resets to 0 across a multi-day gap, even if allComplete was true');
console.log('    Non-consecutive gap resets streak OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 6 — Weekly reward: weekReady fires at streak 7
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 6: Weekly reward unlocks at 7-day streak');

Game.state = freshState();
Game.state.dailies.day       = 'yesterday';
Game.state.dailies.dayNum    = todayNum - 1;
Game.state.dailies.allComplete = true;
Game.state.dailies.streak    = 6; // one more will hit 7

Dailies.missions(); // rollover → streak becomes 7
assert(Game.state.dailies.streak === 7, 'streak is 7');
assert(Game.state.dailies.weekReady === true, 'weekReady set to true');
assert(Dailies.weekReady() === true, 'weekReady() accessor returns true');
console.log('    Weekly reward flag OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 6b — Weekly reward can be earned again after a second 7-day streak
// (regression: weekClaimed used to lock the chest out forever after one claim)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 6b: Weekly chest re-earnable after a second streak');

assert(Dailies.claimWeekReward() === true, 'first weekly chest claims successfully');
assert(Game.state.dailies.weekClaimed === false, 'weekClaimed resets after claim, not stuck true');
assert(Game.state.dailies.streak === 0, 'streak reset to 0 to start a fresh cycle');

// Play out 7 more consecutive completed days.
let n = Game._dayNumber(TimeService.now());
for (let i = 1; i <= 7; i++) {
  Game.state.dailies.day       = 'cycle-2-day-' + i;
  Game.state.dailies.dayNum    = n + i - 1;
  Game.state.dailies.allComplete = true;
  _now += 24 * 3600 * 1000; // advance the clock so _today()/dayNumber both roll forward
  Dailies.missions(); // trigger rollover
}
assert(Game.state.dailies.streak === 7, `second streak reaches 7 (got ${Game.state.dailies.streak})`);
assert(Dailies.weekReady() === true, 'weekReady true again after a second full streak');
assert(Dailies.claimWeekReward() === true, 'second weekly chest claims successfully — not locked out');
console.log('    Weekly chest re-earnable OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 7 — Achievements: unlock + claim lifecycle
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 7: Achievement unlock and claim');

Game.state = freshState();

// first_kill achievement requires lifetimeKills >= 1.
assert(!Achievements.isUnlocked('first_kill'), 'first_kill not yet unlocked');
Game.state.lifetimeKills = 1;
const newlyUnlocked = Achievements.checkAll();
assert(Achievements.isUnlocked('first_kill'), 'first_kill unlocked after checkAll');
assert(newlyUnlocked.some(d => d.id === 'first_kill'), 'checkAll returns newly unlocked defs');

// Claim it.
const stonesBefore = Game.state.spiritStones;
const ok = Achievements.claim('first_kill');
assert(ok === true, 'claim() returns true');
assert(Achievements.isClaimed('first_kill'), 'first_kill marked claimed');
assert(Game.state.spiritStones > stonesBefore, 'spirit stones increased after claim');
const expected = Achievements.defs.find(d => d.id === 'first_kill').reward.stones;
assert(Game.state.spiritStones === stonesBefore + expected, `got correct stone reward (${expected})`);

// Double-claim returns false.
assert(!Achievements.claim('first_kill'), 'second claim() returns false');
console.log('    Achievement unlock + claim OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 8 — Achievement progress tracking (kills_100)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 8: Achievement progress reporting');

Game.state = freshState();
Game.state.lifetimeKills = 55;

const prog = Achievements.progress('kills_100');
assert(prog !== null, 'progress() returns non-null for progressive achievement');
assert(prog.cur === 55, 'progress.cur matches lifetimeKills');
assert(prog.max === 100, 'progress.max is 100');

// Not unlocked yet.
Achievements.checkAll();
assert(!Achievements.isUnlocked('kills_100'), 'kills_100 not unlocked at 55');

Game.state.lifetimeKills = 100;
Achievements.checkAll();
assert(Achievements.isUnlocked('kills_100'), 'kills_100 unlocked at 100');
console.log('    Achievement progress OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 9 — Combat.js: lifetimeKills + lifetimeStones incremented on kill
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 9: Combat tracking increments lifetime counters');

Game.state = freshState();
// inject Dailies stub for hooks
window.Dailies = Dailies;

Combat.spawnMob();
const mob = Combat.mob();
assert(!mob.boss, 'regular mob spawned');
Game.state.lifetimeKills = 0;
Game.state.spiritStones  = 0;
Game.state.lifetimeStones = 0;
Combat._loot(mob);

assert(Game.state.lifetimeKills === 1, 'lifetimeKills incremented to 1 on regular kill');
assert(Game.state.lifetimeStones > 0, 'lifetimeStones incremented after loot');
assert(Game.state.lifetimeStones === Game.state.spiritStones, 'lifetimeStones equals spiritStones (start from 0)');
console.log(`    lifetimeKills: 1, lifetimeStones: ${Game.state.lifetimeStones} ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 10 — unclaimedCount reflects claimable achievements
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 10: unclaimedCount');

Game.state = freshState();
Game.state.lifetimeKills = 10;
Game.state.spiritStones  = 1000;
Game.state.lifetimeStones = 1000;
Achievements.checkAll();
const unclaimed = Achievements.unclaimedCount();
assert(unclaimed >= 2, `at least 2 unclaimed achievements (got ${unclaimed}): first_kill and stones_1k`);
console.log(`    unclaimedCount: ${unclaimed} ✓`);

console.log('\n✓ All smoke8 tests passed.');
