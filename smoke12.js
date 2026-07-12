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
// TEST 4b — Regression: Act II quest gates must not be trivially satisfied
// the instant their `after` predecessor unlocks them (redundant-condition
// bugs: ancient_memory used realm>=6, weaker than its own ancestor
// act1_end's realm>=7; major_rift's zone fallback duplicated fracture_
// spreads' exact zone>=10 gate, so it always auto-passed).
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4b: Act II quest gates require genuine forward progress');

// Mark every quest through fracture_deepening as already completed (as the
// `after` chain requires) without satisfying ancient_memory's OWN condition yet.
['fracture_premonition', 'fracture_first_rift', 'fracture_cold_calculations',
 'fracture_the_voice', 'fracture_spreads', 'fracture_act1_end', 'fracture_deepening']
  .forEach(id => { Quests.state.completed[id] = true; });
Game.state.fracture.riftsSealed = 10; // exactly deepening's own threshold, not yet ancient_memory's
let done2 = Quests.checkAll().map(q => q.id);
assert(!done2.includes('fracture_ancient_memory'),
  'ancient_memory does NOT auto-complete the instant its gate opens (needs riftsSealed>=15, not just the chain)');
Game.state.fracture.riftsSealed = 15;
done2 = Quests.checkAll().map(q => q.id);
assert(done2.includes('fracture_ancient_memory'), 'ancient_memory completes once riftsSealed actually reaches 15');

// Now do the same for major_rift's zone fallback.
Quests.state.completed['fracture_ancient_memory'] = true;
Game.state.fracture.majorRiftsSealed = 0;
Game.state.combat.highestZone = 10; // satisfies the OLD buggy fallback; must NOT be enough now
let done3 = Quests.checkAll().map(q => q.id);
assert(!done3.includes('fracture_major_rift'),
  'major_rift does NOT auto-complete at zone 10 (that threshold belongs to its ancestor fracture_spreads)');
Game.state.combat.highestZone = 13;
done3 = Quests.checkAll().map(q => q.id);
assert(done3.includes('fracture_major_rift'), 'major_rift completes once genuinely past zone 13');
console.log('    Act II quest gates OK ✓');

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
// TEST 5b — Regression: meridian pet bonus must not create a free Qi
// multiplier when the player owns zero pets (m.pet baseline bug)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5b: Meridian pet bonus does not affect zero-pet baseline');
Game.state.pets = { owned: {}, active: [] }; // own nothing
const mBefore = Game.multipliers();
assert(mBefore.pet === 1, 'm.pet is 1 with zero pets and no meridian node');
Game.state.meridians['az4'] = true; // Beast Kinship: +25% spirit-beast bonuses
const mAfter = Game.multipliers();
assert(Math.abs(mAfter.pet - 1) < 1e-9, `m.pet stays 1 with zero pets even after opening a +pet meridian node (got ${mAfter.pet})`);
delete Game.state.meridians['az4'];
console.log('    Meridian pet baseline OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5c — Regression: Pets.combatHp() applies the same sect bonus as
// combatAtk()/qiMult() instead of silently skipping pet HP
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5c: Pets.combatHp() applies sect bonus like combatAtk()');
// Pull a real pet id straight from the pets module's own data table.
const somePetId = Pets.rollPet().id;
Game.state.pets = { owned: { [somePetId]: { level: 5, star: 1 } }, active: [somePetId] };
const rawHp = Pets.hpOf(somePetId);
const sectMult = (window.Sect && Sect.petBonusMult) ? Sect.petBonusMult() : 1;
assert(Math.abs(Pets.combatHp() - rawHp * sectMult) < 1e-6,
  `combatHp() = rawHp * sect.petBonusMult() (got ${Pets.combatHp().toFixed(2)}, expected ${(rawHp * sectMult).toFixed(2)})`);
console.log('    Pets.combatHp() sect parity OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5d — Regression: Trial of Steel challenge must not inflate Qi-per-kill
// or Sect contribution by the 3× mob-HP multiplier (matches the Round 10 fix
// already applied to stones/blood — Qi & contribution had been missed)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5d: Trial of Steel does not inflate Qi/contribution');
const realTrialHard = Challenges.trialHard;
Game.state.sect = { id: 'sword', contribution: 0 };
Combat._mob = null;
Game.state.combat = { zone: 3, wave: 1, highestZone: 3, playerHp: null, paused: false };
Challenges.trialHard = () => false;
Combat.spawnMob();
const mobNormal = Combat._mob;
const qiBefore = Game.state.qi, contribBefore = Sect.contribution();
Combat._loot(mobNormal);
const qiGainNormal = Game.state.qi - qiBefore, contribGainNormal = Sect.contribution() - contribBefore;

Challenges.trialHard = () => true;
Combat._mob = null;
Combat.spawnMob(); // same zone/wave → same baseHp, this time with 3× HP inflation applied on top
const mobHard = Combat._mob;
assert(mobHard.baseHp === mobNormal.baseHp, 'baseHp unaffected by trialHard (sanity)');
assert(mobHard.maxHp > mobNormal.maxHp, 'maxHp inflated 3× under Trial of Steel (sanity)');
const qiBefore2 = Game.state.qi, contribBefore2 = Sect.contribution();
Combat._loot(mobHard);
const qiGainHard = Game.state.qi - qiBefore2, contribGainHard = Sect.contribution() - contribBefore2;
Challenges.trialHard = realTrialHard;

assert(Math.abs(qiGainHard - qiGainNormal) < 1e-6,
  `Qi-per-kill unaffected by Trial of Steel HP inflation (normal ${qiGainNormal}, hard ${qiGainHard})`);
assert(Math.abs(contribGainHard - contribGainNormal) < 1e-6,
  `Sect contribution unaffected by Trial of Steel HP inflation (normal ${contribGainNormal}, hard ${contribGainHard})`);
console.log('    Trial of Steel Qi/contribution OK ✓');

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
// TEST 8b — Anti-cheat: a large backward clock jump is flagged regardless
// of TimeService.isSynced(). A prior version of this check trusted
// isSynced() to bypass the flag, but on the packaged Capacitor/Android
// build sync() just HEADs the app's own local origin (not a real external
// clock), and isSynced() is a plain mutable property trivially forced true
// from devtools or a patched build — trusting it would have reopened the
// exact rollback-then-fast-forward offline-farming exploit this guards
// against. Verify a forced-true isSynced() grants NO exemption.
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 8b: Backward clock jump flagged even with isSynced() forced true');
const realIsSynced = TimeService.isSynced;
TimeService.isSynced = () => true; // simulate a spoofed/forced "synced" flag
const flagsBefore = Game.state.cheatFlags || 0;
Game.state.maxSeenTime = TimeService.now() + 3600 * 1000; // 1h "in the future"
Game.state.lastSaved   = Game.state.maxSeenTime;
const cheatRes = Game.applyOffline();
assert(cheatRes.cheated === true, 'backward jump flagged even when isSynced() reports true');
assert((Game.state.cheatFlags || 0) === flagsBefore + 1, 'cheatFlags incremented');
assert(cheatRes.gained === 0, 'zero Qi granted on a flagged jump');
TimeService.isSynced = realIsSynced;
console.log('    isSynced() spoofing does not bypass detection OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 8c — Anti-cheat: the widened grace window absorbs realistic clock
// drift (small dip, no flag) while still catching anything beyond it —
// verifies the actual fix for the original false-positive bug (an honest
// player's slightly-fast device clock) without trusting any spoofable signal.
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 8c: Grace window absorbs small drift but still catches large jumps');
const trueNow = TimeService.now();

// Small dip (10 min) — within the grace window: not flagged, no punishment.
Game.state.maxSeenTime = trueNow + 10 * 60 * 1000;
Game.state.lastSaved   = Game.state.maxSeenTime;
const flagsBefore2 = Game.state.cheatFlags || 0;
const smallDipRes = Game.applyOffline();
assert(smallDipRes.cheated === false, '10-minute dip is within the grace window — not flagged');
assert((Game.state.cheatFlags || 0) === flagsBefore2, 'cheatFlags NOT incremented on small drift');

// Large dip (1h) — well beyond the grace window: still flagged.
Game.state.maxSeenTime = trueNow + 3600 * 1000;
Game.state.lastSaved   = Game.state.maxSeenTime;
const largeDipRes = Game.applyOffline();
assert(largeDipRes.cheated === true, '1-hour dip is well beyond the grace window — flagged');
console.log('    Grace window sizing OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 9 — Corrupt / malformed save resilience
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 9: Corrupt save resilience');
localStorage.setItem(GameData.saveKey, '{not valid json!!!');
assert(Storage.load() === null, 'corrupt JSON returns null (fresh start), no throw');
localStorage.setItem(GameData.saveKey, '"just a string"');
assert(Storage.load() === null, 'non-object save returns null');
localStorage.setItem(GameData.saveKey, '[1,2,3]');
assert(Storage.load() === null, 'array save rejected (JSON.stringify would silently drop named props)');
console.log('    Corrupt save OK ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 9b — A save missing `owned` entirely must not crash Game.init
// (regression: this was an unguarded dereference that bricked boot)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 9b: Malformed save (missing `owned`) self-heals instead of crashing');
Game.init({ qi: 42, version: GameData.saveVersion }); // no `owned` field at all
assert(Game.state.owned && typeof Game.state.owned === 'object', 'owned backfilled to {}');
assert(Game.state.qi === 42, 'other fields from the malformed save are preserved');
// Mirror main.js's real boot order (Quests/Life/Family/Market init after Game.init)
// before ticking, matching how the app actually recovers from a bad save.
Life.init(); Family.init(); Quests.init();
Game.tick(); // must not throw
console.log('    Malformed-save self-heal OK ✓');

console.log('\n✓ All smoke12 integration tests passed.');
