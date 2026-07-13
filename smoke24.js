/* smoke24.js — Round 26 "Act III: The Door" regression tests.
 *
 * User request: "review the entire game for me ideally I would like the
 * story to have even more indepth content currently alot of the feature
 * are very basic." A research pass found one real narrative asset (the
 * 24-quest Celestial Fracture story) that was an "island" — nothing outside
 * the quest chain ever referenced it, and it had no more content once
 * finished — plus a combat system that reused just 4 mob types and 2 boss
 * types forever regardless of how deep a player pushed.
 *
 * This round:
 *   1. Zone-banded mob/boss pools (combat.js MOB_BANDS) — 4 bands across
 *      the zone range, each with its own 4 mobs + 2 bosses, so pushing
 *      deeper actually looks different instead of recycling the same 6
 *      enemies forever.
 *   2. Three named Rift Guardians (combat.js GUARDIANS) — one-time story
 *      bosses that override the normal boss spawn at their exact zone
 *      (16/18/20) until defeated, flip Game.state.fracture.guardiansDefeated,
 *      and never respawn afterward.
 *   3. Act III of the main quest chain (quests.js order 25-31) — an
 *      intro/defeat dialogue pair per Guardian plus a finale, continuing
 *      the Su Wan / Lu Heng / Voice story past where it previously ended.
 */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
const window = global;

// ---- Minimal stubs ----------------------------------------------------------
const GameNumbers = { formatNumber: n => String(n) };
const Sect = { lootMult() { return 1; }, combatMult() { return 1; }, addContribution() {} };
window.Sect = Sect;

const Game = {
  state: null,
  persist() {},
  _addQi() {},
};
window.Game = Game;

const fs = require('fs');
eval(fs.readFileSync('www/js/combat.js', 'utf8'));

function freshCombatState() {
  Game.state = {
    combat: { zone: 1, wave: 1, highestZone: 1, playerHp: null, paused: false },
    fracture: { resonance: {}, riftsSealed: 0, guardiansDefeated: {} },
    spiritStones: 0, lifetimeStones: 0, lifetimeKills: 0, lifetimeBossKills: 0, beastEggs: 0,
  };
  Combat._mob = null;
  Combat.log = [];
}

console.log('Testing Round 26 Act III: zone bands, Rift Guardians, quest chain...');

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — Zone-banded mob pools: each band produces only its own roster
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: Zone-banded mob pools');
{
  freshCombatState();
  const band1Names = ['Demonic Wolf', 'Corpse Ghoul', 'Venom Scorpion', 'Blood Bat'];
  const band2Names = ['Rift-Touched Hound', 'Fractured Wraith', 'Voidling Swarm', 'Corrupted Cultivator'];
  const band3Names = ['Hollow Sentinel', 'Cracked Colossus', 'Whispering Shade', 'Jiutian Enforcer Drone'];
  const band4Names = ['Void Reaver', 'Starless Wraith', 'Fracture Abomination', 'Heaven-Eater Wisp'];

  Game.state.combat.zone = 1; Game.state.combat.wave = 1;
  const m1 = Combat.spawnMob();
  assert(band1Names.includes(m1.name), `zone 1 wave 1 mob is from band 1 (got '${m1.name}')`);

  Game.state.combat.zone = 6; Game.state.combat.wave = 3;
  const m2 = Combat.spawnMob();
  assert(band2Names.includes(m2.name), `zone 6 mob is from band 2 (got '${m2.name}')`);

  Game.state.combat.zone = 12; Game.state.combat.wave = 7;
  const m3 = Combat.spawnMob();
  assert(band3Names.includes(m3.name), `zone 12 mob is from band 3 (got '${m3.name}')`);

  Game.state.combat.zone = 22; Game.state.combat.wave = 4;
  const m4 = Combat.spawnMob();
  assert(band4Names.includes(m4.name), `zone 22 mob is from band 4 (got '${m4.name}')`);
}
console.log('    Each zone band produces only its own mob roster ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — Zone-banded (non-guardian) boss pools
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: Zone-banded boss pools');
{
  freshCombatState();
  Game.state.combat.zone = 1; Game.state.combat.wave = 10;
  const b1 = Combat.spawnMob();
  assert(b1.boss, 'wave 10 is a boss wave');
  assert(['Demon General', 'Ghost King'].includes(b1.name), `zone 1 boss is band 1 (got '${b1.name}')`);

  Game.state.combat.zone = 9; Game.state.combat.wave = 10;
  const b2 = Combat.spawnMob();
  assert(['Rift Warden', 'Corrupted Elder'].includes(b2.name), `zone 9 boss is band 2 (got '${b2.name}')`);

  Game.state.combat.zone = 14; Game.state.combat.wave = 10;
  const b3 = Combat.spawnMob();
  assert(['Jiutian Enforcer Captain', 'Colossus Prime'].includes(b3.name), `zone 14 boss is band 3 (got '${b3.name}')`);

  // Zone 22 avoids the guardian-reserved 16/18/20 zones — pure band-4 boss check.
  Game.state.combat.zone = 22; Game.state.combat.wave = 10;
  const b4 = Combat.spawnMob();
  assert(['Void Sovereign', 'The Unraveling'].includes(b4.name), `zone 22 boss is band 4 (got '${b4.name}')`);
}
console.log('    Each zone band produces only its own boss roster ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — Rift Guardian overrides the normal boss at its exact zone
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: Guardian spawns instead of the normal boss');
{
  freshCombatState();
  Game.state.combat.zone = 16; Game.state.combat.wave = 10;
  const mob = Combat.spawnMob();
  assert(mob.guardianId === 'ledger', `zone 16 boss wave spawns The Ledger (got guardianId='${mob.guardianId}')`);
  assert(mob.name === 'The Ledger', `mob name is 'The Ledger' (got '${mob.name}')`);

  // Guardian HP is inflated well beyond a plain zone-16 boss (band4 boss
  // would just be 6x mob hp; Ledger's hpMult=2.5 stacks on top of that).
  const plainBossHp = 40 * 16 * Math.pow(1.22, 10) * 6;
  assert(mob.maxHp > plainBossHp * 2, `guardian HP (${Math.round(mob.maxHp)}) is well above a plain zone boss's HP (${Math.round(plainBossHp)})`);
}
console.log('    Guardian overrides the normal boss with inflated stats ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — Guardian is NOT spawned on non-boss waves at its zone
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: Guardian only appears on the boss wave, not regular waves');
{
  freshCombatState();
  Game.state.combat.zone = 16; Game.state.combat.wave = 5;
  const mob = Combat.spawnMob();
  assert(!mob.guardianId, 'no guardian on a non-boss wave at the guardian zone');
  assert(['Void Reaver', 'Starless Wraith', 'Fracture Abomination', 'Heaven-Eater Wisp'].includes(mob.name),
    `regular band-4 mob spawns instead (got '${mob.name}')`);
}
console.log('    Guardian is boss-wave-only ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — Defeating a Guardian flags it permanently; it never respawns
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5: Guardian defeat flags state and never respawns');
{
  freshCombatState();
  Game.state.combat.zone = 16; Game.state.combat.wave = 10;
  const mob = Combat.spawnMob();
  assert(mob.guardianId === 'ledger', 'Ledger spawned');
  assert(!Game.state.fracture.guardiansDefeated.ledger, 'not yet flagged defeated');

  Combat._loot(mob);
  assert(Game.state.fracture.guardiansDefeated.ledger === true, 'guardiansDefeated.ledger flagged true after _loot()');
  assert(Combat.log.some(l => l.includes('The Ledger has fallen')), 'a distinct defeat log line was pushed');

  // Re-spawning at the same zone/wave now falls back to the normal band boss.
  const mob2 = Combat.spawnMob();
  assert(!mob2.guardianId, 'guardian does not respawn once defeated');
  assert(['Void Sovereign', 'The Unraveling'].includes(mob2.name), `falls back to band-4 boss (got '${mob2.name}')`);
}
console.log('    Guardian defeat is permanent and one-time ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 6 — All three Guardians are independently gated by zone + defeat flag
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 6: Choir (18) and Shadow (20) gate independently of Ledger');
{
  freshCombatState();
  Game.state.combat.zone = 18; Game.state.combat.wave = 10;
  const choir = Combat.spawnMob();
  assert(choir.guardianId === 'choir' && choir.name === 'The Hollow Choir', `zone 18 spawns The Hollow Choir (got '${choir.name}')`);
  Combat._loot(choir);
  assert(Game.state.fracture.guardiansDefeated.choir === true, 'choir flagged defeated');
  assert(!Game.state.fracture.guardiansDefeated.ledger, 'defeating choir does not affect ledger flag');
  assert(!Game.state.fracture.guardiansDefeated.shadow, 'defeating choir does not affect shadow flag');

  Game.state.combat.zone = 20; Game.state.combat.wave = 10;
  const shadow = Combat.spawnMob();
  assert(shadow.guardianId === 'shadow' && shadow.name === "Su Wan's Shadow", `zone 20 spawns Su Wan's Shadow (got '${shadow.name}')`);
}
console.log('    Each Guardian is independently gated by its own zone + flag ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 7 — Act III quest chain: gating, ordering, and dialogue shape
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 7: Act III quest chain (quests.js order 25-31)');
{
  // quests.js only needs a bare Game.state + persist/_addQi — reuse the
  // same Game stub combat.js already installed above.
  eval(fs.readFileSync('www/js/quests.js', 'utf8'));

  function freshQuestState() {
    Game.state = {
      realm: 0,
      combat: { zone: 1, wave: 1, highestZone: 1 },
      fracture: { guardiansDefeated: {} },
      quests: Quests.fresh(),
    };
    // Seed the chain as if Act I & II are already complete — order 25's
    // `after: 'fracture_act2_end'` gate only checks completedness, not a
    // re-run of that quest's own condition.
    Game.state.quests.completed['fracture_act2_end'] = true;
  }

  // 7a — guardian_ledger_intro requires BOTH the after-gate and highestZone>=16.
  freshQuestState();
  let done = Quests.checkAll();
  assert(!done.some(q => q.id === 'guardian_ledger_intro'), 'ledger intro does not fire before reaching zone 16');

  Game.state.combat.highestZone = 16;
  done = Quests.checkAll();
  assert(done.some(q => q.id === 'guardian_ledger_intro'), 'ledger intro fires once highestZone reaches 16');
  const introQ = Quests.defs.find(q => q.id === 'guardian_ledger_intro');
  assert(introQ.dialogue[0].name === 'Lu Heng · Jiutian Holdings', 'ledger intro dialogue is spoken by Lu Heng');

  // 7b — defeat quest requires the guardiansDefeated flag, not just proximity.
  done = Quests.checkAll();
  assert(!done.some(q => q.id === 'guardian_ledger_defeat'), 'ledger defeat quest does not fire before the flag is set');
  Game.state.fracture.guardiansDefeated.ledger = true;
  done = Quests.checkAll();
  assert(done.some(q => q.id === 'guardian_ledger_defeat'), 'ledger defeat quest fires once guardiansDefeated.ledger is true');

  // 7c — chain ordering: choir intro is gated behind ledger's defeat quest via
  // `after`, tracked through a realistic progression (checkAll() cascades
  // instantly through any prerequisites whose conditions are ALREADY met at
  // call time, so this drives zone/flag state forward between calls exactly
  // as real play would, instead of pre-seeding everything at once).
  freshQuestState();
  Game.state.combat.highestZone = 16;
  done = Quests.checkAll();
  assert(done.some(q => q.id === 'guardian_ledger_intro'), 'ledger intro fires at zone 16');
  assert(!done.some(q => q.id === 'guardian_choir_intro'), 'choir intro cannot fire yet — zone 18 not reached AND ledger_defeat not complete');

  Game.state.fracture.guardiansDefeated.ledger = true;
  done = Quests.checkAll();
  assert(done.some(q => q.id === 'guardian_ledger_defeat'), 'ledger defeat fires once the flag is set');
  assert(!done.some(q => q.id === 'guardian_choir_intro'), 'choir intro still withheld — highestZone is only 16, not 18');

  Game.state.combat.highestZone = 18;
  done = Quests.checkAll();
  assert(done.some(q => q.id === 'guardian_choir_intro'), 'choir intro unlocked only after BOTH ledger_defeat completed AND zone 18 reached');
  assert(!done.some(q => q.id === 'guardian_choir_defeat'), 'choir defeat withheld — guardiansDefeated.choir is still false');
  assert(!done.some(q => q.id === 'threshold_crossed'), 'finale nowhere close — shadow guardian not even reached yet');

  // 7d — finale requires realm >= 8 AND all three guardiansDefeated flags.
  freshQuestState();
  Game.state.combat.highestZone = 20;
  Game.state.fracture.guardiansDefeated = { ledger: true, choir: true, shadow: true };
  Game.state.realm = 7; // one short of the realm-8 requirement
  // Fast-forward the whole chain by completing every predecessor directly.
  ['guardian_ledger_intro','guardian_ledger_defeat','guardian_choir_intro','guardian_choir_defeat',
   'guardian_shadow_intro','guardian_shadow_defeat'].forEach(id => { Game.state.quests.completed[id] = true; });
  done = Quests.checkAll();
  assert(!done.some(q => q.id === 'threshold_crossed'), 'finale withheld at realm 7 despite every guardian defeated');

  Game.state.realm = 8;
  done = Quests.checkAll();
  assert(done.some(q => q.id === 'threshold_crossed'), 'finale fires once realm 8 is reached with every guardian defeated');
  const finale = Quests.defs.find(q => q.id === 'threshold_crossed');
  assert(finale.dialogue.length === 3, `finale carries all 3 speakers (got ${finale.dialogue.length})`);
  assert(finale.dialogue.map(d => d.speaker).join(',') === 'void,antagonist,mentor', 'finale speaker order is Voice, then Lu Heng, then Granny Su');
}
console.log('    Act III quest chain gates and orders correctly, dialogue intact ✓');

console.log('\n✓ All smoke24 tests passed.');
