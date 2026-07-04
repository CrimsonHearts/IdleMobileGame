/* smoke9.js — Round 12: Sect Guild System Regression Tests */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
const window = global;

// ---- Minimal stubs ----------------------------------------------------------
const TimeService = { now() { return Date.now(); }, monotonicNow() { return Date.now(); } };
const GameNumbers  = { formatNumber: n => String(n) };
const GameData     = { realms: [{ name: 'Mortal' }, { name: 'Qi Condensation' }, { name: 'Core Formation' }] };

const Game = {
  state: null,
  persist() {},
  _today() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate(); },
};

// Stub Sect (simplified — mirrors actual Sect methods needed by SectGuild)
const Sect = {
  _current() { return Game.state.sect ? Game.state.sect : null; },
  current() {
    const SECTS = {
      sword:    { id:'sword',    qiMult:1.10, combatMult:1.30, petMult:1.0, offlineBonus:0, lootMult:1 },
      pill:     { id:'pill',     qiMult:1.15, combatMult:1.0,  petMult:1.0, offlineBonus:0.25, lootMult:1 },
      beast:    { id:'beast',    qiMult:1.0,  combatMult:1.15, petMult:1.35, offlineBonus:0, lootMult:1 },
      talisman: { id:'talisman', qiMult:1.25, combatMult:1.0,  petMult:1.0, offlineBonus:0, lootMult:1 },
      demon:    { id:'demon',    qiMult:0.90, combatMult:1.50, petMult:1.0, offlineBonus:0, lootMult:1.30 },
    };
    return Game.state.sect ? SECTS[Game.state.sect.id] : null;
  },
  contribution() { return Game.state.sect ? Game.state.sect.contribution : 0; },
  addContribution(n) { if (Game.state.sect) Game.state.sect.contribution += n; },
  qiMult() {
    const s = this.current();
    if (!s) return 1;
    const research = window.SectGuild ? SectGuild.qiMult() : 1;
    return s.qiMult * research;
  },
  combatMult() {
    const s = this.current();
    const research = window.SectGuild ? SectGuild.combatMult() : 1;
    return s ? s.combatMult * research : 1;
  },
  petBonusMult() {
    const s = this.current();
    const research = window.SectGuild ? SectGuild.petMult() : 1;
    return s ? (s.petMult || 1) * research : 1;
  },
  offlineBonus() {
    const s = this.current();
    const research = window.SectGuild ? SectGuild.offlineBonus() : 0;
    return (s ? (s.offlineBonus || 0) : 0) + research;
  },
  lootMult() {
    const s = this.current();
    const research = window.SectGuild ? SectGuild.lootMult() : 1;
    return s ? (s.lootMult || 1) * research : 1;
  },
};
window.Sect = Sect;

eval(require('fs').readFileSync('www/js/sectguild.js', 'utf8'));

// ---- Fresh game state -------------------------------------------------------
function freshState(sectId) {
  return {
    sect:      sectId ? { id: sectId, contribution: 100000 } : null,
    sectGuild: { research: {} },
    spiritStones: 10000,
    beastEggs: 0,
    blood: { essence: 500 },
    buffs: [],
    realm: 2,
  };
}

console.log('Testing Round 12: Sect Guild System...');

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — Research prerequisite: tier 2 locked until tier 1 researched
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: Research prerequisite chain');

Game.state = freshState('sword');
assert(!SectGuild.researched('sw_a1'), 'sw_a1 not yet researched');
assert(!SectGuild.canResearch('sw_a2'), 'sw_a2 requires sw_a1 first — should be locked');

// Research tier 1
assert(SectGuild.canResearch('sw_a1'), 'sw_a1 available (prereq met, enough contribution)');
const ok1 = SectGuild.research('sw_a1');
assert(ok1, 'research(sw_a1) returns true');
assert(SectGuild.researched('sw_a1'), 'sw_a1 marked researched');

// Now tier 2 should be available (contribution still >> cost)
assert(SectGuild.canResearch('sw_a2'), 'sw_a2 now available after sw_a1');
console.log('    Research prerequisite chain OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — Research deducts Contribution
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: Research deducts Contribution');

Game.state = freshState('sword');
const contribBefore = Sect.contribution();
SectGuild.research('sw_a1'); // costs 600
assert(Sect.contribution() === contribBefore - 600, 'contribution reduced by node cost (600)');

// Double-research returns false
const again = SectGuild.research('sw_a1');
assert(again === false, 'second research of same node returns false');
assert(Sect.contribution() === contribBefore - 600, 'contribution unchanged on second attempt');
console.log('    Contribution deduction OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — Bonus aggregation: researched qi bonus reflected in qiMult()
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: Bonus aggregation');

Game.state = freshState('sword');
const qiBase = SectGuild.qiMult();
assert(qiBase === 1, 'SectGuild.qiMult() is 1 before any research');

SectGuild.research('sw_b1'); // +10% qi, cost 400
assert(Math.abs(SectGuild.qiMult() - 1.10) < 0.001, `qiMult after sw_b1 = ${SectGuild.qiMult().toFixed(3)} (expected 1.10)`);

SectGuild.research('sw_b2'); // +16% qi, cost 5000
assert(Math.abs(SectGuild.qiMult() - 1.26) < 0.001, `qiMult after sw_b2 = ${SectGuild.qiMult().toFixed(3)} (expected 1.26)`);
console.log(`    qi mult: 1.00 → 1.10 → ${SectGuild.qiMult().toFixed(2)} ✓`);

// Combat bonus independent of qi
const combatBefore = SectGuild.combatMult();
assert(combatBefore === 1, 'combat mult 1 before any combat research');
SectGuild.research('sw_a1'); // +12% combat
assert(Math.abs(SectGuild.combatMult() - 1.12) < 0.001, 'combat mult 1.12 after sw_a1');
console.log('    Bonus aggregation OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — Talisman "all" bonus applies to qi AND combat
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: Talisman all-stat bonus');

Game.state = freshState('talisman');
SectGuild.research('ta_b1'); // bonus: { all: 0.08 }
assert(Math.abs(SectGuild.qiMult()     - 1.08) < 0.001, 'talisman all bonus → qi mult 1.08');
assert(Math.abs(SectGuild.combatMult() - 1.08) < 0.001, 'talisman all bonus → combat mult 1.08');
assert(Math.abs(SectGuild.petMult()    - 1.08) < 0.001, 'talisman all bonus → pet mult 1.08');
assert(Math.abs(SectGuild.lootMult()   - 1.08) < 0.001, 'talisman all bonus → loot mult 1.08');
// offline does NOT receive 'all' spread
assert(Math.abs(SectGuild.offlineBonus()) < 0.001, 'talisman all bonus does NOT spread to offline');
console.log('    Talisman all-stat bonus OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — Sect.qiMult() includes SectGuild research (integration)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5: Sect.qiMult() includes research bonuses');

Game.state = freshState('pill');
const sectQiBase = Sect.qiMult(); // 1.15 base
SectGuild.research('pi_a1'); // +12% qi
const sectQiAfter = Sect.qiMult();
// Expected: 1.15 * 1.12 = 1.288
assert(Math.abs(sectQiAfter - sectQiBase * 1.12) < 0.001,
  `Sect.qiMult after research: ${sectQiAfter.toFixed(4)} (expected ${(sectQiBase * 1.12).toFixed(4)})`);
console.log(`    Sect.qiMult: ${sectQiBase.toFixed(3)} → ${sectQiAfter.toFixed(3)} ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 6 — Demon sect: stonesMult()
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 6: Demon sect stones research');

Game.state = freshState('demon');
assert(SectGuild.stonesMult() === 1, 'stonesMult is 1 before research');
SectGuild.research('de_b1'); // +20% stones
assert(Math.abs(SectGuild.stonesMult() - 1.20) < 0.001, 'stonesMult 1.20 after de_b1');
SectGuild.research('de_b2'); // +30% stones
assert(Math.abs(SectGuild.stonesMult() - 1.50) < 0.001, 'stonesMult 1.50 after de_b2');
console.log(`    stonesMult: ${SectGuild.stonesMult().toFixed(2)}× ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 7 — Store: buy deducts contribution
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 7: Contribution Store purchase');

Game.state = freshState('sword');
const contrib0 = Sect.contribution(); // 100000
assert(SectGuild.canBuy('egg'), 'can buy egg (500)');
const bought = SectGuild.buy('egg');
assert(bought, 'buy(egg) returns true');
assert(Game.state.beastEggs === 1, 'beastEggs incremented');
assert(Sect.contribution() === contrib0 - 500, 'contribution reduced by 500');

// Can't buy when not enough contribution
Game.state.sect.contribution = 100; // too little for egg (500)
assert(!SectGuild.canBuy('egg'), 'cannot buy egg with 100 contribution');
assert(!SectGuild.buy('egg'), 'buy returns false when insufficient');
console.log('    Store purchase OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 8 — Offerings: stones donation
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 8: Offerings');

Game.state = freshState('sword');
Game.state.spiritStones = 5000;
const ctBefore = Sect.contribution();
assert(SectGuild.canOffer('stones'), 'can offer stones (have 5000, cost 1000)');
const gained = SectGuild.offer('stones');
assert(gained === 80, `offering returns 80 contribution (got ${gained})`);
assert(Game.state.spiritStones === 4000, 'stones reduced by 1000');
assert(Sect.contribution() === ctBefore + 80, 'contribution increased by 80');

// Blood offering
assert(SectGuild.canOffer('blood'), 'can offer blood (have 500, cost 50)');
const gainedBlood = SectGuild.offer('blood');
assert(gainedBlood === 80, 'blood offering also returns 80 contribution');
assert(Game.state.blood.essence === 450, 'blood essence reduced by 50');

// Can't offer when insufficient resources
Game.state.spiritStones = 500; // less than 1000 required
assert(!SectGuild.canOffer('stones'), 'cannot offer stones when below cost');
console.log('    Offerings OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 9 — No sect: all bonus methods return neutral values
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 9: No sect — neutral bonus values');

Game.state = freshState(null); // no sect
assert(SectGuild.qiMult()      === 1, 'qiMult() = 1 when no sect');
assert(SectGuild.combatMult()  === 1, 'combatMult() = 1 when no sect');
assert(SectGuild.petMult()     === 1, 'petMult() = 1 when no sect');
assert(SectGuild.lootMult()    === 1, 'lootMult() = 1 when no sect');
assert(SectGuild.offlineBonus()=== 0, 'offlineBonus() = 0 when no sect');
assert(SectGuild.stonesMult()  === 1, 'stonesMult() = 1 when no sect');
assert(SectGuild.bossDmgMult() === 1, 'bossDmgMult() = 1 when no sect');
assert(!SectGuild.canResearch('sw_a1'), 'canResearch false when no sect');
assert(!SectGuild.canBuy('egg'),        'canBuy false when no sect');
assert(!SectGuild.canOffer('stones'),   'canOffer false when no sect');
console.log('    No-sect neutral values OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 10 — Pill offline: research bonus flows through Sect.offlineBonus()
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 10: Offline bonus integration');

Game.state = freshState('pill');
const offBase = Sect.offlineBonus(); // pill base is 0.25
SectGuild.research('pi_b1'); // +0.18 offline
const offAfter = Sect.offlineBonus();
assert(Math.abs(offAfter - (offBase + 0.18)) < 0.001,
  `Sect.offlineBonus: ${offBase.toFixed(2)} → ${offAfter.toFixed(2)} (expected ${(offBase+0.18).toFixed(2)})`);
console.log(`    Offline bonus: ${offBase.toFixed(2)} → ${offAfter.toFixed(2)} ✓`);

console.log('\n✓ All smoke9 tests passed.');
