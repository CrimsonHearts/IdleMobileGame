/* smoke11.js — Round 14: Celestial Fracture Act II Regression Tests */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
const window = global;

const TimeService = { now() { return Date.now(); }, monotonicNow() { return Date.now(); } };
const GameNumbers  = { formatNumber: n => String(n) };

const Game = { state: null, persist() {} };
window.Game = Game;

eval(require('fs').readFileSync('www/js/fracture.js', 'utf8'));

function freshState(shards) {
  return {
    stellarShards: shards || 0,
    fracture: { resonance: {}, riftsSealed: 0, majorRiftsSealed: 0, grandRiftsSealed: 0, investments: {} },
  };
}

console.log('Testing Round 14: Celestial Fracture Act II...');

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — Tiered rifts: zone 6 → minor, zone 10 → major, zone 15 → grand
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: Rift tier selection by zone');

assert(Fracture._riftTierForZone(4)  === null,     'zone 4 = no tier');
assert(Fracture._riftTierForZone(5).key  === 'minor', 'zone 5 = minor');
assert(Fracture._riftTierForZone(9).key  === 'minor', 'zone 9 = minor');
assert(Fracture._riftTierForZone(10).key === 'major', 'zone 10 = major');
assert(Fracture._riftTierForZone(14).key === 'major', 'zone 14 = major');
assert(Fracture._riftTierForZone(15).key === 'grand', 'zone 15 = grand');
assert(Fracture._riftTierForZone(30).key === 'grand', 'zone 30 = grand');
console.log('    Rift tier selection OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — Minor rift probability ~15% (unchanged from R13)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: Minor rift probability');

Game.state = freshState(0);
let count = 0;
for (let i = 0; i < 2000; i++) { if (Fracture.tryRiftEvent(6) > 0) count++; }
const rate = count / 2000;
assert(rate > 0.08 && rate < 0.25, `minor rift rate ${(rate*100).toFixed(1)}% (expected ~15%)`);
console.log(`    Minor rift rate: ${(rate*100).toFixed(1)}% ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — Major rift probability ~12%; shards scaled ×2.0
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: Major rift probability and shard multiplier');

Game.state = freshState(0);
let majCount = 0, majShards = 0;
for (let i = 0; i < 2000; i++) {
  const s = Fracture.tryRiftEvent(10);
  if (s > 0) { majCount++; majShards += s; }
}
const majRate = majCount / 2000;
assert(majRate > 0.05 && majRate < 0.22, `major rift rate ${(majRate*100).toFixed(1)}% (expected ~12%)`);
// Compare per-event avg to minor at same zone (minor shardMult=1, major shardMult=2)
const avgMajor = majCount > 0 ? majShards / majCount : 0;
// Minor rift base at zone 10: Math.max(5, round(10 * 5 * 1.0)) = 50
// Major rift base at zone 10: Math.max(5, round(10 * 5 * 2.0)) = 100
assert(avgMajor >= 95 && avgMajor <= 105, `major rift avg shards ≈100 at zone 10 (got ${avgMajor.toFixed(1)})`);
assert(Game.state.fracture.majorRiftsSealed === majCount, 'majorRiftsSealed tracks correctly');
console.log(`    Major rift: rate=${(majRate*100).toFixed(1)}%, avg=${avgMajor.toFixed(0)} shards ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — Grand rift probability ~10%; shards scaled ×3.5
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: Grand rift probability and shard multiplier');

Game.state = freshState(0);
let grdCount = 0, grdShards = 0;
for (let i = 0; i < 3000; i++) {
  const s = Fracture.tryRiftEvent(15);
  if (s > 0) { grdCount++; grdShards += s; }
}
const grdRate = grdCount / 3000;
assert(grdRate > 0.04 && grdRate < 0.18, `grand rift rate ${(grdRate*100).toFixed(1)}% (expected ~10%)`);
// Grand at zone 15: Math.max(5, round(15 * 5 * 3.5)) = 263
const avgGrand = grdCount > 0 ? grdShards / grdCount : 0;
assert(avgGrand >= 255 && avgGrand <= 270, `grand rift avg shards ≈263 at zone 15 (got ${avgGrand.toFixed(1)})`);
assert(Game.state.fracture.grandRiftsSealed === grdCount, 'grandRiftsSealed tracks correctly');
console.log(`    Grand rift: rate=${(grdRate*100).toFixed(1)}%, avg=${avgGrand.toFixed(0)} shards ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — lastRiftIcon / lastRiftName reflect triggered tier
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5: lastRiftIcon / lastRiftName');

Game.state = freshState(0);
// Force a minor rift by patching Math.random temporarily
const origRandom = Math.random;
Math.random = () => 0.01; // always trigger
Fracture.tryRiftEvent(6);
assert(Fracture.lastRiftIcon() === '🌌', `minor icon: ${Fracture.lastRiftIcon()}`);
assert(Fracture.lastRiftName() === 'Minor Rift', `minor name: ${Fracture.lastRiftName()}`);
Fracture.tryRiftEvent(10);
assert(Fracture.lastRiftIcon() === '💫', `major icon: ${Fracture.lastRiftIcon()}`);
Fracture.tryRiftEvent(15);
assert(Fracture.lastRiftIcon() === '🌠', `grand icon: ${Fracture.lastRiftIcon()}`);
Math.random = origRandom;
console.log('    lastRiftIcon/Name OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 6 — pathMastered: false until all 3 tiers researched
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 6: pathMastered');

Game.state = freshState(10000);
assert(!Fracture.pathMastered('a'), 'path a not mastered at start');
Fracture.research('fc_a1');
assert(!Fracture.pathMastered('a'), 'not mastered after tier 1 only');
Fracture.research('fc_a2');
assert(!Fracture.pathMastered('a'), 'not mastered after tier 1+2');
Fracture.research('fc_a3');
assert(Fracture.pathMastered('a'), 'mastered after all 3 tiers');
assert(!Fracture.pathMastered('b'), 'path b still not mastered');
console.log('    pathMastered OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 7 — Mastery bonus activates on path completion (+20% combat for path A)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 7: Path mastery bonus');

Game.state = freshState(10000);
// Two tiers only — mastery not yet active; 1 + 0.15 + 0.25 = 1.40
Fracture.research('fc_a1'); Fracture.research('fc_a2');
assert(Math.abs(Fracture.combatMult() - 1.40) < 0.001, `combat after 2 tiers: ${Fracture.combatMult().toFixed(3)}`);
// Third tier completes path → mastery activates immediately; 1 + 0.80 + 0.20 = 2.00
Fracture.research('fc_a3');
assert(Math.abs(Fracture.combatMult() - 2.00) < 0.001, `combat with mastery: ${Fracture.combatMult().toFixed(3)}`);
console.log(`    Path A mastery: combatMult = ${Fracture.combatMult().toFixed(2)} ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 8 — Path D mastery spreads 'all' bonus to qi/combat/loot/shardGain
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 8: Fate Weave mastery all-stat spread');

Game.state = freshState(10000);
// Research all of path D: +8+14+22 = +44% all
Fracture.research('fc_d1'); Fracture.research('fc_d2'); Fracture.research('fc_d3');
// Mastery adds +15% all → total node all = 44%, mastery all = 15% → spread to qi/combat/loot/shardGain
const expectedAll = 1 + 0.44 + 0.15; // 1.59
assert(Math.abs(Fracture.qiMult()       - expectedAll) < 0.001, `qi after D mastery: ${Fracture.qiMult().toFixed(3)}`);
assert(Math.abs(Fracture.combatMult()   - expectedAll) < 0.001, `combat after D mastery: ${Fracture.combatMult().toFixed(3)}`);
assert(Math.abs(Fracture.lootMult()     - expectedAll) < 0.001, `loot after D mastery: ${Fracture.lootMult().toFixed(3)}`);
assert(Math.abs(Fracture.shardGainMult()- expectedAll) < 0.001, `shardGain after D mastery: ${Fracture.shardGainMult().toFixed(3)}`);
console.log(`    Fate Weave mastery spread: allMult = ${Fracture.qiMult().toFixed(2)} ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 9 — Shard Investments: canInvest / invest / invested
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 9: Shard Investments');

Game.state = freshState(100); // not enough for si_qi (costs 500)
assert(!Fracture.canInvest('si_qi'), 'cannot invest si_qi with only 100 shards');

Game.state = freshState(10000);
assert(Fracture.canInvest('si_qi'),    'can invest si_qi with 10000 shards');
assert(!Fracture.invested('si_qi'),    'not invested yet');

const ok = Fracture.invest('si_qi');
assert(ok, 'invest(si_qi) returns true');
assert(Fracture.invested('si_qi'), 'si_qi now invested');
assert(Game.state.stellarShards === 9500, 'shards reduced by 500');

const again = Fracture.invest('si_qi');
assert(!again, 'second invest returns false');
assert(Game.state.stellarShards === 9500, 'shards unchanged on double invest');
console.log('    Shard Investments OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 10 — Investment bonuses apply to multipliers
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 10: Investment bonus aggregation');

Game.state = freshState(100000);
const qiBefore = Fracture.qiMult(); // 1.0 with no research
Fracture.invest('si_qi');   // +8% qi
assert(Math.abs(Fracture.qiMult() - 1.08) < 0.001, `qi after si_qi: ${Fracture.qiMult().toFixed(3)}`);

Fracture.invest('si_combat'); // +12% combat
assert(Math.abs(Fracture.combatMult() - 1.12) < 0.001, `combat after si_combat: ${Fracture.combatMult().toFixed(3)}`);

Fracture.invest('si_all');    // +12% all
// qi should now be 1 + 0.08(si_qi) + 0.12(si_all) = 1.20
assert(Math.abs(Fracture.qiMult()     - 1.20) < 0.001, `qi after si_all: ${Fracture.qiMult().toFixed(3)}`);
// combat: 1 + 0.12(si_combat) + 0.12(si_all) = 1.24
assert(Math.abs(Fracture.combatMult() - 1.24) < 0.001, `combat after si_all: ${Fracture.combatMult().toFixed(3)}`);
console.log(`    Investment bonus: qi=${Fracture.qiMult().toFixed(2)}, combat=${Fracture.combatMult().toFixed(2)} ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 11 — Full stack: nodes + mastery + investments all compound
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 11: Full bonus stack (nodes + mastery + investments)');

Game.state = freshState(100000);
// Path B (Stellar Qi) full: +15+25+40 = +80%
Fracture.research('fc_b1'); Fracture.research('fc_b2'); Fracture.research('fc_b3');
// Path B mastery: +20% qi → total qi from nodes+mastery = 80+20 = 100%
// si_qi investment: +8%
Fracture.invest('si_qi');
// Expected: 1 + 1.00 + 0.08 = 2.08
assert(Math.abs(Fracture.qiMult() - 2.08) < 0.001, `full qi stack: ${Fracture.qiMult().toFixed(3)}`);
console.log(`    Full qi stack = ${Fracture.qiMult().toFixed(2)}× ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 12 — riftsSealed totals include all tiers
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 12: riftsSealed() = minor + major + grand');

Game.state = freshState(0);
const origRand = Math.random;
Math.random = () => 0.01; // always trigger
Fracture.tryRiftEvent(6);   // minor
Fracture.tryRiftEvent(10);  // major
Fracture.tryRiftEvent(15);  // grand
Math.random = origRand;
const total = Fracture.riftsSealed();
const maj   = Fracture.majorRiftsSealed();
const grd   = Fracture.grandRiftsSealed();
const min   = total - maj - grd;
assert(total === 3, `riftsSealed should be 3 (got ${total})`);
assert(maj   === 1, `majorRiftsSealed should be 1 (got ${maj})`);
assert(grd   === 1, `grandRiftsSealed should be 1 (got ${grd})`);
assert(min   === 1, `minor = total - maj - grand should be 1 (got ${min})`);
console.log(`    riftsSealed: ${total} total (${min} minor, ${maj} major, ${grd} grand) ✓`);

console.log('\n✓ All smoke11 tests passed.');
