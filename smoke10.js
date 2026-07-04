/* smoke10.js — Round 13: Celestial Fracture Regression Tests */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
const window = global;

// ---- Minimal stubs ----------------------------------------------------------
const TimeService = { now() { return Date.now(); }, monotonicNow() { return Date.now(); } };
const GameNumbers  = { formatNumber: n => String(n) };

const Game = {
  state: null,
  persist() {},
};
window.Game = Game;

eval(require('fs').readFileSync('www/js/fracture.js', 'utf8'));

// ---- Fresh fracture state ---------------------------------------------------
function freshState(shards) {
  return {
    stellarShards: shards || 0,
    fracture: { resonance: {}, riftsSealed: 0 },
    combat: { zone: 1, wave: 1, highestZone: 1, playerHp: null, paused: false },
  };
}

console.log('Testing Round 13: Celestial Fracture...');

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — Research prerequisite: tier 2 locked until tier 1 researched
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: Research prerequisite chain');

Game.state = freshState(10000);
assert(!Fracture.researched('fc_a1'), 'fc_a1 not yet researched');
assert(!Fracture.canResearch('fc_a2'), 'fc_a2 requires fc_a1 first');

assert(Fracture.canResearch('fc_a1'), 'fc_a1 available with enough shards');
const ok = Fracture.research('fc_a1');
assert(ok, 'research(fc_a1) returns true');
assert(Fracture.researched('fc_a1'), 'fc_a1 marked researched');
assert(Fracture.canResearch('fc_a2'), 'fc_a2 now available after fc_a1');
console.log('    Prerequisite chain OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — Research deducts Stellar Shards
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: Shard deduction');

Game.state = freshState(10000);
const before = Game.state.stellarShards;
Fracture.research('fc_a1'); // cost 50
assert(Game.state.stellarShards === before - 50, `shards reduced by 50 (got ${Game.state.stellarShards})`);

const again = Fracture.research('fc_a1');
assert(again === false, 'second research of same node returns false');
assert(Game.state.stellarShards === before - 50, 'shards unchanged on double research');
console.log('    Shard deduction OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — Insufficient shards: canResearch returns false
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: Insufficient shards');

Game.state = freshState(10); // only 10 shards
assert(!Fracture.canResearch('fc_a1'), 'fc_a1 locked when shards < 50');
assert(Fracture.research('fc_a1') === false, 'research fails with insufficient shards');
console.log('    Insufficient shards OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — qiMult / combatMult / lootMult / shardGainMult accumulation
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: Bonus accumulation');

Game.state = freshState(10000);
assert(Fracture.qiMult()       === 1, 'qiMult 1 before research');
assert(Fracture.combatMult()   === 1, 'combatMult 1 before research');
assert(Fracture.lootMult()     === 1, 'lootMult 1 before research');
assert(Fracture.shardGainMult()=== 1, 'shardGainMult 1 before research');

Fracture.research('fc_b1'); // +15% qi
assert(Math.abs(Fracture.qiMult() - 1.15) < 0.001, `qiMult after fc_b1: ${Fracture.qiMult()}`);
assert(Fracture.combatMult() === 1, 'combatMult unaffected by qi node');

Fracture.research('fc_a1'); // +15% combat
assert(Math.abs(Fracture.combatMult() - 1.15) < 0.001, `combatMult after fc_a1: ${Fracture.combatMult()}`);

Fracture.research('fc_c1'); // +20% loot, +25% shardGain
assert(Math.abs(Fracture.lootMult()      - 1.20) < 0.001, `lootMult after fc_c1: ${Fracture.lootMult()}`);
assert(Math.abs(Fracture.shardGainMult() - 1.25) < 0.001, `shardGainMult after fc_c1: ${Fracture.shardGainMult()}`);
console.log('    Bonus accumulation OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — 'all' bonus from Path D spreads to qi, combat, loot, shardGain
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5: Fate Weave "all" stat spread');

Game.state = freshState(10000);
Fracture.research('fc_d1'); // +8% all
assert(Math.abs(Fracture.qiMult()       - 1.08) < 0.001, 'all bonus → qi 1.08');
assert(Math.abs(Fracture.combatMult()   - 1.08) < 0.001, 'all bonus → combat 1.08');
assert(Math.abs(Fracture.lootMult()     - 1.08) < 0.001, 'all bonus → loot 1.08');
assert(Math.abs(Fracture.shardGainMult()- 1.08) < 0.001, 'all bonus → shardGain 1.08');
console.log('    Fate Weave spread OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 6 — onMobKill: no drops below zone 3
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 6: onMobKill zone gate');

Game.state = freshState(0);
let dropped = Fracture.onMobKill(2, false);
assert(dropped === 0, 'no shard drop in zone 2');
assert(Game.state.stellarShards === 0, 'shards unchanged in zone 2');

dropped = Fracture.onMobKill(3, false);
assert(dropped >= 1, `zone 3 drops at least 1 shard (got ${dropped})`);
assert(Game.state.stellarShards === dropped, 'shards added to state');
console.log('    onMobKill zone gate OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 7 — onMobKill: boss drops more than regular
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 7: Boss shard drop bonus');

Game.state = freshState(0);
const regular = Fracture.onMobKill(5, false);
Game.state = freshState(0);
const boss = Fracture.onMobKill(5, true);
assert(boss > regular, `boss (${boss}) drops more than regular (${regular})`);
console.log(`    Boss drop: ${boss} vs regular: ${regular} ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 8 — shardGainMult applies to onMobKill
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 8: shardGainMult multiplies onMobKill');

Game.state = freshState(10000);
const baseDropState = freshState(0);
// Determine base drop without any research
const baseDrop = Math.max(1, Math.round(Math.round(5 * 0.6) * 1)); // zone 5, no boss, mult 1
// Now research Path C tier 1 for +25% shardGain
Fracture.research('fc_c1'); // requires 50 shards, we have 10000
const multExpected = Fracture.shardGainMult();
assert(Math.abs(multExpected - 1.25) < 0.001, `shardGainMult is 1.25 after fc_c1`);
// The drop should scale
const enhancedDrop = Fracture.onMobKill(5, false);
const expectedDrop = Math.max(1, Math.round(Math.round(5 * 0.6) * 1.25));
assert(enhancedDrop === expectedDrop, `enhanced drop ${enhancedDrop} === expected ${expectedDrop}`);
console.log(`    shardGainMult applied: ${enhancedDrop} shards at zone 5 ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 9 — tryRiftEvent: no event below zone 5
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 9: tryRiftEvent zone gate');

Game.state = freshState(0);
// Zone 4 never triggers
let totalRift = 0;
for (let i = 0; i < 200; i++) totalRift += Fracture.tryRiftEvent(4);
assert(totalRift === 0, 'no rift events in zone 4 after 200 attempts');
assert(Game.state.fracture.riftsSealed === 0, 'riftsSealed stays 0 below zone 5');
console.log('    Rift zone gate OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 10 — tryRiftEvent: zone 5+ triggers rifts ~15% of the time
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 10: tryRiftEvent probability + state update');

Game.state = freshState(0);
let riftCount = 0, riftShards = 0;
const TRIES = 2000;
for (let i = 0; i < TRIES; i++) {
  const s = Fracture.tryRiftEvent(6);
  if (s > 0) { riftCount++; riftShards += s; }
}
const rate = riftCount / TRIES;
assert(rate > 0.08 && rate < 0.25, `rift rate ${rate.toFixed(3)} should be ~0.15`);
assert(Game.state.fracture.riftsSealed === riftCount, 'riftsSealed counter matches events');
assert(Game.state.stellarShards === riftShards, 'shards from rifts added to state');
assert(riftShards > 0, 'rift events award shards');
console.log(`    Rift probability: ${(rate*100).toFixed(1)}% (${riftCount}/${TRIES}), riftsSealed = ${Game.state.fracture.riftsSealed} ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 11 — riftsSealed() reads from state correctly
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 11: riftsSealed() accessor');

Game.state = freshState(0);
assert(Fracture.riftsSealed() === 0, 'riftsSealed() is 0 on fresh state');
Game.state.fracture.riftsSealed = 7;
assert(Fracture.riftsSealed() === 7, 'riftsSealed() reflects updated state');
console.log('    riftsSealed() accessor OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 12 — Full path unlock: tier 1 → 2 → 3 sequence
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 12: Full path unlock sequence (Path B — Stellar Qi)');

Game.state = freshState(10000);
assert(!Fracture.canResearch('fc_b3'), 'tier 3 locked at start');
Fracture.research('fc_b1');
assert(!Fracture.canResearch('fc_b3'), 'tier 3 still locked after tier 1 only');
Fracture.research('fc_b2');
assert(Fracture.canResearch('fc_b3'), 'tier 3 available after tier 1 + 2');
Fracture.research('fc_b3');
// Completing path B activates Stellar Torrent mastery (+20% qi from R14).
// Nodes: 1 + 0.15 + 0.25 + 0.40 = 1.80. Mastery: +0.20 → total 2.00.
const expected = 1 + 0.15 + 0.25 + 0.40 + 0.20;
assert(Math.abs(Fracture.qiMult() - expected) < 0.001, `qiMult full path: ${Fracture.qiMult().toFixed(3)} === ${expected}`);
console.log(`    Full path unlock: qiMult = ${Fracture.qiMult().toFixed(2)} ✓`);

console.log('\n✓ All smoke10 tests passed.');
