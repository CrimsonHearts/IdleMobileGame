/* smoke6.js — Round 9: Cultivation Boosters */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
const window = global;

// ---- Minimal stubs ---------------------------------------------------------
let fakeNow = 1000 * 24 * 3600 * 1000; // arbitrary day-aligned epoch
const TimeService = { now() { return fakeNow; } };
const GameNumbers = { formatNumber: n => String(n), formatDuration: s => s + 's' };

const Game = {
  state: { spiritStones: 100000, realm: 0, boosters: {} },
  persist() {},
  _today() { const d = new Date(TimeService.now()); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); },
};

eval(require('fs').readFileSync('www/js/boosters.js', 'utf8'));

console.log('Testing Boosters...');

// 1. Defaults
assert(Boosters.data.length === 4, 'has 4 booster types');
assert(!Boosters.isActive('qiSurge'), 'inactive by default');
assert(Boosters.qiMult() === 1, 'qiMult neutral when inactive');
assert(Boosters.lootMult() === 1, 'lootMult neutral when inactive');
assert(Boosters.combatMult() === 1, 'combatMult neutral when inactive');
assert(Boosters.luckMult() === 1, 'luckMult neutral when inactive');

// 2. Activate via ad
assert(Boosters.adsLeftToday('qiSurge') === Boosters.ADS_PER_DAY, 'full ad count at start');
assert(Boosters.activateViaAd('qiSurge'), 'activateViaAd succeeds');
assert(Boosters.isActive('qiSurge'), 'active after ad');
assert(Boosters.qiMult() === 2, 'qiMult = 2 while Qi Surge active');
assert(Boosters.adsLeftToday('qiSurge') === Boosters.ADS_PER_DAY - 1, 'ad count decremented');

// 3. Re-activating extends, doesn't reset below current
const left1 = Boosters.timeLeft('qiSurge');
Boosters.activateViaAd('qiSurge');
const left2 = Boosters.timeLeft('qiSurge');
assert(left2 >= left1, 'reactivating extends duration');

// 4. Daily ad cap
for (let i = 0; i < 10; i++) Boosters.activateViaAd('qiSurge');
assert(Boosters.adsLeftToday('qiSurge') === 0, 'ad count floors at 0');
assert(!Boosters.activateViaAd('qiSurge'), 'activateViaAd fails once daily cap hit');

// 5. Independent boosters stack (different stats)
assert(Boosters.activateViaAd('lootRush'), 'lootRush activates independently');
assert(Boosters.lootMult() === 2, 'lootMult = 2 while Loot Rush active');
assert(Boosters.qiMult() === 2, 'qiMult still 2 (unaffected by lootRush)');

// 6. Stone activation + cost scaling
Game.state.spiritStones = 100000;
const cost1 = Boosters.stoneCost('battleFury');
assert(Boosters.activateWithStones('battleFury'), 'activateWithStones succeeds');
assert(Boosters.isActive('battleFury'), 'battleFury active after stone purchase');
assert(Boosters.combatMult() === 1.5, 'combatMult = 1.5 while Battle Fury active');
const cost2 = Boosters.stoneCost('battleFury');
assert(cost2 > cost1, 'stone cost rises with same-day use');
assert(Game.state.spiritStones === 100000 - cost1, 'stones deducted by cost');

// 7. Insufficient stones fails cleanly
Game.state.spiritStones = 0;
assert(!Boosters.activateWithStones('luckyStar'), 'activateWithStones fails when poor');
assert(!Boosters.isActive('luckyStar'), 'luckyStar stays inactive');

// 8. Day rollover resets ad/stone counters
fakeNow += 25 * 3600 * 1000; // advance past a day boundary
assert(Boosters.adsLeftToday('qiSurge') === Boosters.ADS_PER_DAY, 'ad count resets next day');

console.log('  Boosters: OK');
console.log('\n✓ All smoke6 tests passed.');
