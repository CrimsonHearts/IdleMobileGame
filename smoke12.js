/* smoke12.js — Full-game integration regression.
 *
 * Unlike smoke7–11 (which stub siblings and eval one module), this suite
 * loads EVERY logic module in the exact index.html order with only the
 * browser environment stubbed (localStorage, window), then drives the real
 * engine end-to-end: fresh boot, economy, combat with rifts, quests with the
 * chain gate, save round-trip, an old-save migration, and offline catch-up.
 * A wiring bug between modules that the per-round suites can't see fails here.
 */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };

// ── Browser environment stubs ────────────────────────────────────────────────
global.window = global;
const _store = {};
global.localStorage = {
  getItem: k => (k in _store ? _store[k] : null),
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: k => { delete _store[k]; },
};
global.navigator = { onLine: false };
global.document = undefined; // logic modules must not touch the DOM at load

// ── Load every logic module in index.html order (UI/boot layers excluded) ────
const fs = require('fs');
const MODULES = [
  'quests', 'numbers', 'gameData', 'time', 'storage', 'life', 'family',
  'pets', 'techniques', 'blood', 'spirit', 'sect', 'combat', 'events',
  'artifacts', 'challenges', 'enchanting', 'boosters', 'sectguild',
  'achievements', 'dailies', 'fracture', 'market', 'game',
];
MODULES.forEach(m => {
  try { (0, eval)(fs.readFileSync(`www/js/${m}.js`, 'utf8')); }
  catch (e) { throw new Error(`module ${m}.js failed to load: ${e.message}`); }
});
console.log(`Loaded ${MODULES.length} modules cleanly.`);

console.log('\nsmoke12: full-game integration regression');

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — Fresh boot: init, module inits, one tick, no exceptions
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: Fresh boot');
Game.init(null);
Life.init(); Family.init(); Quests.init();
assert(Game.state.stellarShards === 0, 'fresh save starts with 0 shards');
assert(Game.state.fracture && Game.state.fracture.investments, 'fracture state present with investments');
Game.tick();
assert(Game.qiPerSecond() >= 0 && Game.qiPerTap() > 0, 'economy functions return sane values');
console.log('    Fresh boot OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — Economy: meditate, buy generator, produce Qi
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: Economy loop');
Game.meditate();
assert(Game.state.qi > 0, 'meditate grants qi');
Game.state.qi = 1e6;
assert(Game.buyGenerator('mat', 1), 'can buy first generator');
assert(Game.state.owned.mat === 1, 'generator owned');
assert(Game.qiPerSecond() > 0, 'qi/s positive with a generator');
console.log('    Economy OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — Combat integration: 500 ticks at zone 5+, shards + rifts accrue
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: Combat with Fracture integration');
Game.state.realm = 5; Game.state.stagesCleared = 40;   // strong enough to farm
Game.state.combat = { zone: 5, wave: 1, highestZone: 6, playerHp: null, paused: false };
Combat._mob = null;
const shards0 = Game.state.stellarShards, stones0 = Game.state.spiritStones;
for (let i = 0; i < 500; i++) Combat.tick(1);
assert(Game.state.spiritStones > stones0, 'combat produces stones');
assert(Game.state.stellarShards > shards0, 'zone-5 combat produces stellar shards');
assert(Game.state.lifetimeKills > 0, 'lifetime kills tracked');
console.log(`    Combat OK — +${Game.state.spiritStones - stones0} stones, +${Game.state.stellarShards - shards0} shards, ${Fracture.riftsSealed()} rifts ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — Quests: chain gate + shards reward through the REAL claim path
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: Quest chain + shards reward');
let done = Quests.checkAll().map(q => q.id);
assert(done.includes('fracture_premonition'), 'premonition completes at realm 5');
assert(!done.includes('fracture_cold_calculations') || done.includes('fracture_first_rift'),
  'cold_calculations only completes after first_rift (chain gate)');
const shardsBeforeClaim = Game.state.stellarShards;
assert(Quests.claim('fracture_premonition'), 'claim succeeds');
assert(Game.state.stellarShards === shardsBeforeClaim + 20, 'shards reward (+20) applied');
assert(!Quests.claim('fracture_premonition'), 'double-claim rejected');
console.log('    Quests OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — Fracture research through real state
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5: Fracture research end-to-end');
Game.state.stellarShards = 5000;
assert(Fracture.research('fc_b1'), 'research fc_b1');
const qpsBefore = Game.qiPerSecond();
assert(Fracture.research('fc_b2'), 'research fc_b2');
const qpsAfter = Game.qiPerSecond();
assert(qpsAfter > qpsBefore, 'Stellar Qi research raises real qi/s through Game.multipliers');
console.log(`    Research raises qi/s: ${qpsBefore.toFixed(1)} → ${qpsAfter.toFixed(1)} ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 6 — Save round-trip: persist → load → init, state fully intact
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 6: Save round-trip');
Game.persist();
const loaded = Storage.load();
assert(loaded, 'save loads back');
const snapshot = {
  shards: Game.state.stellarShards, stones: Game.state.spiritStones,
  rifts: Game.state.fracture.riftsSealed, resonance: Object.keys(Game.state.fracture.resonance).length,
  kills: Game.state.lifetimeKills, realm: Game.state.realm,
};
Game.init(loaded); Quests.init();
assert(Game.state.stellarShards === snapshot.shards, 'shards survive round-trip');
assert(Game.state.fracture.riftsSealed === snapshot.rifts, 'rift count survives round-trip');
assert(Object.keys(Game.state.fracture.resonance).length === snapshot.resonance, 'research survives round-trip');
assert(Game.state.lifetimeKills === snapshot.kills, 'lifetime kills survive round-trip');
assert(Quests.state.claimed['fracture_premonition'], 'quest claims survive round-trip');
console.log('    Round-trip OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 7 — Old-save migration: strip all post-R10 fields, init, run clean
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 7: Old-save (pre-Round-11) migration');
const oldSave = JSON.parse(JSON.stringify(Game.state));
['achievements', 'lifetimeKills', 'lifetimeBossKills', 'lifetimeStones',
 'lifetimeBoosterActivations', 'dailies', 'sectGuild', 'stellarShards',
 'fracture', 'boosters'].forEach(k => { delete oldSave[k]; });
Game.init(oldSave); Quests.init();
assert(Game.state.stellarShards === 0, 'stellarShards backfilled');
assert(Game.state.fracture && Game.state.fracture.resonance && Game.state.fracture.investments, 'fracture backfilled');
assert(Game.state.sectGuild && Game.state.sectGuild.research, 'sectGuild backfilled');
assert(Game.state.dailies && Array.isArray(Game.state.dailies.missions), 'dailies backfilled');
// Migrated save must run the full loop without throwing:
Game.tick();
for (let i = 0; i < 100; i++) Combat.tick(1);
Quests.checkAll();
if (window.Achievements) Achievements.checkAll();
console.log('    Migration OK — old save ticks cleanly ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 8 — Offline catch-up: 2h away at zone 5+, no crash, gains applied
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 8: Offline catch-up (2h, combat + rifts in the loop)');
Game.state.lastSaved = TimeService.now() - 2 * 3600 * 1000;
Game.state.maxSeenTime = Game.state.lastSaved;
const preOffline = { qi: Game.state.qi, shards: Game.state.stellarShards };
const res = Game.applyOffline();
assert(res && !res.cheated, 'offline not flagged as cheating');
assert(res.seconds > 7000, `offline seconds ≈ 7200 (got ${Math.round(res.seconds)})`);
assert(Game.state.qi >= preOffline.qi, 'offline qi applied');
assert(Game.state.stellarShards >= preOffline.shards, 'offline combat shards accrued');
console.log(`    Offline OK — +${Math.round(Game.state.qi - preOffline.qi)} qi, +${Game.state.stellarShards - preOffline.shards} shards ✓`);

// ════════════════════════════════════════════════════════════════════════
// TEST 9 — Corrupt save resilience
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 9: Corrupt save resilience');
localStorage.setItem(GameData.saveKey, '{not valid json!!!');
assert(Storage.load() === null, 'corrupt JSON returns null (fresh start), no throw');
localStorage.setItem(GameData.saveKey, '"just a string"');
assert(Storage.load() === null, 'non-object save returns null');
console.log('    Corrupt save OK ✓');

console.log('\n✓ All smoke12 integration tests passed.');
