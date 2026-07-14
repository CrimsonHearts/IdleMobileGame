/* smoke25.js — Round 27 "Beyond the Door" regression tests.
 *
 * User feedback: "the reincarnation is getting boring and the battle cap
 * has been hit." Two real content ceilings: (1) Heavenly Perks (the
 * reincarnation meta-currency sink) had only 6 flat entries, fully maxed in
 * ~20-30 lives, after which Merit had nothing left to buy; (2) combat's last
 * zone band was `maxZone: Infinity` starting at zone 15, and the last named
 * Rift Guardian was at zone 20 — pushing further was pure repetition.
 *
 * This round:
 *   1. A 5th mob band ("Uncounted Reaches", zone 26+) — Void-Touched is now
 *      capped at zone 25 instead of running forever.
 *   2. Two new Rift Guardians (Cartographer @ zone 24, First Voice @ zone
 *      28), gated behind quest completion (`after`) in addition to zone —
 *      Act IV can't be encountered before Act III's finale actually closes.
 *   3. Act IV quest chain (quests.js order 32-36).
 *   4. Three new Heavenly Perks (gameData.js), two of them gated behind a
 *      Guardian kill (`reqGuardian`) — ties late-game combat progress
 *      directly to late-game reincarnation depth. `samsara_mastery` raises
 *      the per-life stacking RATE itself via a new `lifeBonusPer` effect key,
 *      so reincarnating stays meaningful indefinitely instead of the per-life
 *      bonus being a fixed 10% forever.
 */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
const window = global;

// ---- Minimal stubs ----------------------------------------------------------
const GameNumbers = { formatNumber: n => String(n) };
const Sect = { lootMult() { return 1; }, combatMult() { return 1; }, addContribution() {} };
window.Sect = Sect;

const fs = require('fs');

console.log('Testing Round 27 Beyond the Door: 5th zone band, Act IV Guardians, quest chain, reincarnation depth...');

// ════════════════════════════════════════════════════════════════════════
// PART A — combat.js + quests.js (self-contained, mirrors smoke24's pattern)
// ════════════════════════════════════════════════════════════════════════
{
  const Game = { state: null, persist() {}, _addQi() {} };
  window.Game = Game;
  eval(fs.readFileSync('www/js/combat.js', 'utf8'));

  function freshCombatState() {
    Game.state = {
      combat: { zone: 1, wave: 1, highestZone: 1, playerHp: null, paused: false },
      fracture: { resonance: {}, riftsSealed: 0, guardiansDefeated: {} },
      quests: { completed: {} },
      spiritStones: 0, lifetimeStones: 0, lifetimeKills: 0, lifetimeBossKills: 0, beastEggs: 0,
    };
    Combat._mob = null;
    Combat.log = [];
  }

  // TEST 1 — Void-Touched is capped at zone 25; zone 26+ is the new band.
  console.log('\n  Test 1: Void-Touched capped at 25, Uncounted Reaches starts at 26');
  {
    freshCombatState();
    const voidTouched = ['Void Reaver', 'Starless Wraith', 'Fracture Abomination', 'Heaven-Eater Wisp'];
    const uncounted = ["Cartographer's Echo", 'Unmapped Wraith', 'Threshold Remnant', 'Silent Cartograph'];

    Game.state.combat.zone = 25; Game.state.combat.wave = 3;
    const m25 = Combat.spawnMob();
    assert(voidTouched.includes(m25.name), `zone 25 still Void-Touched (got '${m25.name}')`);

    Game.state.combat.zone = 26; Game.state.combat.wave = 3;
    const m26 = Combat.spawnMob();
    assert(uncounted.includes(m26.name), `zone 26 rolls over into Uncounted Reaches (got '${m26.name}')`);

    Game.state.combat.zone = 90; Game.state.combat.wave = 3;
    const m90 = Combat.spawnMob();
    assert(uncounted.includes(m90.name), `zone 90 (far endgame) still resolves to Uncounted Reaches (got '${m90.name}')`);
  }
  console.log('    Band 4 is finite, band 5 covers the open-ended tail ✓');

  // TEST 2 — Uncounted Reaches boss pool.
  console.log('\n  Test 2: Uncounted Reaches boss pool (non-guardian zones)');
  {
    freshCombatState();
    Game.state.combat.zone = 30; Game.state.combat.wave = 10; // avoids guardian zones 24/28
    const b = Combat.spawnMob();
    assert(b.boss, 'wave 10 is a boss wave');
    assert(['Boundless Surveyor', 'The Uncounted'].includes(b.name), `zone 30 boss is band 5 (got '${b.name}')`);
  }
  console.log('    Band 5 boss roster is distinct from band 4 ✓');

  // TEST 3 — Cartographer is withheld until threshold_crossed is completed,
  // even at zone 24 on a boss wave.
  console.log('\n  Test 3: Act IV Guardians are gated by quest completion, not just zone');
  {
    freshCombatState();
    Game.state.combat.zone = 24; Game.state.combat.wave = 10;
    const early = Combat.spawnMob();
    assert(!early.guardianId, 'Cartographer does not spawn before threshold_crossed is completed');
    // Zone 24 is still inside band 4 (Void-Touched, capped at zone 25) — the
    // fallback boss is band 4's, not band 5's (band 5 only starts at zone 26).
    assert(['Void Sovereign', 'The Unraveling'].includes(early.name), `falls back to band-4 boss (got '${early.name}')`);

    Game.state.quests.completed.threshold_crossed = true;
    Combat._mob = null;
    const gated = Combat.spawnMob();
    assert(gated.guardianId === 'cartographer', `Cartographer spawns once threshold_crossed is complete (got '${gated.guardianId}')`);
    assert(gated.name === 'The Cartographer', `mob name is 'The Cartographer' (got '${gated.name}')`);
  }
  console.log('    Guardian `after` gate withholds spawn until its prerequisite quest completes ✓');

  // TEST 4 — First Voice is further gated behind the Cartographer's OWN
  // defeat quest, chaining the two new Guardians in story order.
  console.log('\n  Test 4: First Voice additionally gated behind Cartographer\'s defeat quest');
  {
    freshCombatState();
    Game.state.quests.completed.threshold_crossed = true;
    Game.state.combat.zone = 28; Game.state.combat.wave = 10;
    const early = Combat.spawnMob();
    assert(!early.guardianId, 'First Voice withheld — guardian_cartographer_defeat not yet completed');

    Game.state.quests.completed.guardian_cartographer_defeat = true;
    Combat._mob = null;
    const gated = Combat.spawnMob();
    assert(gated.guardianId === 'firstvoice', `First Voice spawns once its prerequisite completes (got '${gated.guardianId}')`);
  }
  console.log('    First Voice respects its own, later, quest gate ✓');

  // TEST 5 — guardianDef() lookup helper (used by ui.js for locked-perk hints).
  console.log('\n  Test 5: Combat.guardianDef() lookup');
  {
    const def = Combat.guardianDef('firstvoice');
    assert(def && def.name === 'The First Voice', 'guardianDef resolves a known id');
    assert(Combat.guardianDef('nonexistent') === null, 'guardianDef returns null for an unknown id');
  }
  console.log('    guardianDef() resolves known ids and null otherwise ✓');

  // TEST 6 — Defeating both new Guardians flags them independently and permanently.
  console.log('\n  Test 6: Act IV Guardian defeat flags are independent and permanent');
  {
    freshCombatState();
    Game.state.quests.completed.threshold_crossed = true;
    Game.state.quests.completed.guardian_cartographer_defeat = true;
    Game.state.combat.zone = 24; Game.state.combat.wave = 10;
    const cart = Combat.spawnMob();
    Combat._loot(cart);
    assert(Game.state.fracture.guardiansDefeated.cartographer === true, 'cartographer flagged defeated');
    assert(!Game.state.fracture.guardiansDefeated.firstvoice, 'defeating cartographer does not affect firstvoice flag');

    Combat._mob = null;
    const cart2 = Combat.spawnMob();
    assert(!cart2.guardianId, 'cartographer does not respawn once defeated');
  }
  console.log('    Act IV Guardian defeats are independent, one-time flags ✓');

  // TEST 7 — Act IV quest chain: gating, ordering, dialogue shape.
  console.log('\n  Test 7: Act IV quest chain (quests.js order 32-36)');
  {
    eval(fs.readFileSync('www/js/quests.js', 'utf8'));

    function freshQuestState() {
      Game.state = {
        realm: 8,
        combat: { zone: 1, wave: 1, highestZone: 1 },
        fracture: { guardiansDefeated: { ledger: true, choir: true, shadow: true } },
        quests: Quests.fresh(),
      };
      Game.state.quests.completed['threshold_crossed'] = true;
    }

    // 7a — cartographer_intro requires the after-gate (already true) + zone 24.
    freshQuestState();
    let done = Quests.checkAll();
    assert(!done.some(q => q.id === 'guardian_cartographer_intro'), 'cartographer intro withheld before zone 24');

    Game.state.combat.highestZone = 24;
    done = Quests.checkAll();
    assert(done.some(q => q.id === 'guardian_cartographer_intro'), 'cartographer intro fires at zone 24');
    const introQ = Quests.defs.find(q => q.id === 'guardian_cartographer_intro');
    assert(introQ.dialogue[0].name === 'Lu Heng · Jiutian Holdings', 'cartographer intro spoken by Lu Heng');

    // 7b — defeat quest requires the guardiansDefeated flag.
    done = Quests.checkAll();
    assert(!done.some(q => q.id === 'guardian_cartographer_defeat'), 'cartographer defeat withheld before the flag is set');
    Game.state.fracture.guardiansDefeated.cartographer = true;
    done = Quests.checkAll();
    assert(done.some(q => q.id === 'guardian_cartographer_defeat'), 'cartographer defeat fires once flagged');
    const defeatQ = Quests.defs.find(q => q.id === 'guardian_cartographer_defeat');
    assert(defeatQ.dialogue[0].speaker === 'void', 'cartographer defeat dialogue spoken by the Voice');

    // 7c — first voice chain gated behind cartographer defeat + its own zone.
    assert(!done.some(q => q.id === 'guardian_firstvoice_intro'), 'first voice intro withheld — zone 28 not reached yet');
    Game.state.combat.highestZone = 28;
    done = Quests.checkAll();
    assert(done.some(q => q.id === 'guardian_firstvoice_intro'), 'first voice intro fires once zone 28 reached');
    assert(!done.some(q => q.id === 'guardian_firstvoice_defeat'), 'first voice defeat withheld — not yet flagged');
    assert(!done.some(q => q.id === 'act4_beyond_the_door'), 'Act IV finale nowhere close yet');

    Game.state.fracture.guardiansDefeated.firstvoice = true;
    done = Quests.checkAll();
    assert(done.some(q => q.id === 'guardian_firstvoice_defeat'), 'first voice defeat fires once flagged');
    assert(done.some(q => q.id === 'act4_beyond_the_door'), 'Act IV finale cascades in the same call once both flags are true');

    const finale = Quests.defs.find(q => q.id === 'act4_beyond_the_door');
    assert(finale.dialogue.length === 3, `Act IV finale carries all 3 speakers (got ${finale.dialogue.length})`);
    assert(finale.dialogue.map(d => d.speaker).join(',') === 'antagonist,void,mentor', 'Act IV finale speaker order is Lu Heng, then Voice, then Granny Su');
    assert(finale.reward.permanentBonus === 0.12, 'Act IV finale grants the documented permanent production bonus');
  }
  console.log('    Act IV quest chain gates and orders correctly, dialogue intact ✓');
}

// ════════════════════════════════════════════════════════════════════════
// PART B — game.js + gameData.js: reincarnation depth (new perks + gating)
// ════════════════════════════════════════════════════════════════════════
{
  // game.js is a single `const Game = {...}; window.Game = Game;` — no
  // top-level code runs at eval time beyond that object-literal creation,
  // so it's safe to eval without Storage/TimeService/UI stubs as long as we
  // never call the methods (init, persist, tick, ...) that touch them.
  eval(fs.readFileSync('www/js/gameData.js', 'utf8'));
  eval(fs.readFileSync('www/js/game.js', 'utf8'));

  function freshGameState() {
    Game.state = {
      reincarnations: 0,
      heavenlyMerit: 1e9, // effectively unlimited, isolates the gate check from affordability
      heavenlyPerks: {},
      fracture: { guardiansDefeated: {} },
    };
  }

  // TEST 8 — reqGuardian-gated perks are unbuyable (and reported locked)
  // before the Guardian is defeated, regardless of Merit on hand.
  console.log('\n  Test 8: Guardian-gated Heavenly Perks stay locked until the Guardian falls');
  {
    freshGameState();
    assert(!Game.perkUnlocked('void_attunement'), 'void_attunement reports locked before shadow is defeated');
    assert(!Game.canBuyHeavenlyPerk('void_attunement'), 'void_attunement is unbuyable before shadow is defeated, despite ample Merit');
    assert(!Game.perkUnlocked('void_harvest'), 'void_harvest reports locked before firstvoice is defeated');

    Game.state.fracture.guardiansDefeated.shadow = true;
    assert(Game.perkUnlocked('void_attunement'), 'void_attunement unlocks once shadow is defeated');
    assert(Game.canBuyHeavenlyPerk('void_attunement'), 'void_attunement becomes buyable once unlocked (Merit is ample)');
    assert(!Game.perkUnlocked('void_harvest'), 'void_harvest still locked — firstvoice unrelated to shadow');

    Game.state.fracture.guardiansDefeated.firstvoice = true;
    assert(Game.perkUnlocked('void_harvest'), 'void_harvest unlocks once firstvoice is defeated');
  }
  console.log('    Guardian-gated perks are correctly withheld and unlocked independently ✓');

  // TEST 9 — ungated perks (old + samsara_mastery) are unaffected by the gate.
  console.log('\n  Test 9: Ungated perks are unaffected by reqGuardian logic');
  {
    freshGameState();
    assert(Game.perkUnlocked('soul_memory'), 'pre-existing ungated perk always reports unlocked');
    assert(Game.canBuyHeavenlyPerk('soul_memory'), 'pre-existing ungated perk is buyable from the start');
    assert(Game.perkUnlocked('samsara_mastery'), 'samsara_mastery has no reqGuardian gate');
    assert(Game.canBuyHeavenlyPerk('samsara_mastery'), 'samsara_mastery is buyable from the start');
  }
  console.log('    Ungated perks (including the new samsara_mastery) need no Guardian ✓');

  // TEST 10 — samsara_mastery raises the per-life RATE, compounding with
  // reincarnation count, not just adding a flat one-off bonus.
  console.log('\n  Test 10: Samsara Mastery raises the per-life stacking rate itself');
  {
    freshGameState();
    Game.state.reincarnations = 10;
    const baseline = Game.reincarnationMult();
    assert(Math.abs(baseline - (1 + 10 * GameData.reincarnationBonusPer)) < 1e-9,
      `baseline reincarnationMult with 0 perk levels matches the unmodified 10%/life rate (got ${baseline})`);

    Game.state.heavenlyPerks.samsara_mastery = 5; // +5% to the per-life rate (0.01 × 5)
    const boosted = Game.reincarnationMult();
    const expectedRate = GameData.reincarnationBonusPer + 0.05;
    assert(Math.abs(boosted - (1 + 10 * expectedRate)) < 1e-9,
      `reincarnationMult reflects the perk-boosted per-life rate (got ${boosted}, expected ${1 + 10 * expectedRate})`);
    assert(boosted > baseline, 'boosted multiplier exceeds the baseline');

    // The effect compounds with MORE lives, not just a flat add — a veteran
    // with more reincarnations gains proportionally more from the same perk level.
    Game.state.reincarnations = 20;
    const boostedMore = Game.reincarnationMult();
    const gainAt10 = boosted - baseline;
    const gainAt20 = boostedMore - (1 + 20 * GameData.reincarnationBonusPer);
    assert(gainAt20 > gainAt10, 'the perk\'s absolute contribution grows with reincarnation count (it scales the rate, not a flat sum)');
  }
  console.log('    Samsara Mastery compounds with reincarnation count as designed ✓');

  // TEST 11 — reincarnationBonusPer() UI helper reflects the live rate.
  console.log('\n  Test 11: reincarnationBonusPer() helper matches the rate used by reincarnationMult()');
  {
    freshGameState();
    Game.state.heavenlyPerks.samsara_mastery = 3;
    const rate = Game.reincarnationBonusPer();
    assert(Math.abs(rate - (GameData.reincarnationBonusPer + 0.03)) < 1e-9, `helper returns the boosted rate (got ${rate})`);
  }
  console.log('    UI-facing rate helper stays in sync with the engine calculation ✓');
}

console.log('\n✓ All smoke25 tests passed.');
