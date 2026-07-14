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

  // TEST 3 — Cartographer spawns purely from reaching zone 24 on a boss
  // wave, with ZERO quest-completion prerequisite. An earlier version of
  // this feature gated the Act IV Guardians behind `after: <quest id>` in
  // addition to zone, but realm (which threshold_crossed required) and
  // Trials zone are independent progression axes (realm resets on
  // reincarnate(), zone does not) — a player could outrun the quest gate,
  // silently fight a generic boss at zone 24 instead of the Guardian, and
  // permanently miss the Act IV quest chain with no in-game signal anything
  // was skipped. Fixed to match the proven zone-only mechanic Act III's
  // three Guardians already used (unskippable by construction, since
  // clearing a zone's boss wave is what advances the zone in the first
  // place — see TEST 6 below for the actual unskippability proof).
  console.log('\n  Test 3: Cartographer spawns from zone 24 alone, no quest prerequisite');
  {
    freshCombatState();
    Game.state.combat.zone = 24; Game.state.combat.wave = 10;
    const mob = Combat.spawnMob();
    assert(mob.guardianId === 'cartographer', `Cartographer spawns at zone 24 with no quests completed at all (got '${mob.guardianId}')`);
    assert(mob.name === 'The Cartographer', `mob name is 'The Cartographer' (got '${mob.name}')`);
  }
  console.log('    Guardian spawn depends on zone number only, never on quest state ✓');

  // TEST 4 — First Voice likewise spawns purely from zone 28, independent
  // of the Cartographer's OWN defeat quest (only the Cartographer's
  // in-combat DEFEAT FLAG, not any quest, could ever matter here — and even
  // that's a different guardian's flag, so it's irrelevant to First Voice).
  console.log('\n  Test 4: First Voice spawns from zone 28 alone, no quest prerequisite');
  {
    freshCombatState();
    Game.state.combat.zone = 28; Game.state.combat.wave = 10;
    const mob = Combat.spawnMob();
    assert(mob.guardianId === 'firstvoice', `First Voice spawns at zone 28 with no quests completed at all (got '${mob.guardianId}')`);
  }
  console.log('    First Voice spawn also depends on zone number only ✓');

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

  // TEST 6b — Proves the actual safety claim behind removing the quest
  // gate: an undefeated Guardian overrides EVERY boss wave at its zone, with
  // no way to draw a generic boss instead — so a player literally cannot
  // clear that zone (and thus cannot advance past it, since clearing the
  // zone's boss wave is the only thing that ever advances the zone) without
  // fighting the Guardian at least once. Checked across several consecutive
  // boss-wave "attempts" (spawnMob() called fresh each time, as if a defeat
  // sent the player back to wave 1 and they climbed to another boss wave).
  console.log('\n  Test 6b: an undefeated Guardian is unskippable — every boss wave at its zone IS the Guardian');
  {
    freshCombatState();
    Game.state.combat.zone = 24;
    for (const wave of [10, 20, 30]) {
      Game.state.combat.wave = wave;
      Combat._mob = null;
      const mob = Combat.spawnMob();
      assert(mob.guardianId === 'cartographer', `wave ${wave} boss at zone 24 is still the Cartographer while undefeated (got '${mob.guardianId}')`);
    }
  }
  console.log('    No generic-boss substitute exists while the Guardian is alive — zone 24/28 cannot be cleared around it ✓');

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

    // 7d — the actual Round 28 fix, end to end: the Guardian can be
    // defeated in COMBAT before its quest's own `after` prerequisite
    // (threshold_crossed, which needs realm >= 8) has completed — combat no
    // longer cares. The dialogue quest must simply wait and cascade in once
    // threshold_crossed eventually completes, rather than being permanently
    // missable the way the old `after`-gated-in-combat.js version could be.
    Game.state = {
      realm: 7, // one short of threshold_crossed's own realm requirement
      combat: { zone: 1, wave: 1, highestZone: 24 }, // already reached zone 24
      fracture: { guardiansDefeated: { ledger: true, choir: true, shadow: true, cartographer: true } }, // defeated in combat already
      quests: Quests.fresh(),
    };
    // Seed threshold_crossed's own `after` chain as already complete (Act I-III
    // dialogue) so only its check()'s realm>=8 requirement is left pending —
    // isolates the one condition this sub-test cares about.
    ['fracture_act2_end','guardian_ledger_intro','guardian_ledger_defeat',
     'guardian_choir_intro','guardian_choir_defeat','guardian_shadow_intro','guardian_shadow_defeat']
      .forEach(id => { Game.state.quests.completed[id] = true; });
    done = Quests.checkAll();
    assert(!done.some(q => q.id === 'guardian_cartographer_intro'), 'dialogue withheld — threshold_crossed has not completed yet (realm 7)');
    assert(!done.some(q => q.id === 'guardian_cartographer_defeat'), 'defeat dialogue also withheld — it chains behind the intro quest');

    Game.state.realm = 8; // threshold_crossed's own conditions are now met
    done = Quests.checkAll();
    assert(done.some(q => q.id === 'threshold_crossed'), 'threshold_crossed itself fires now that realm 8 is reached');
    assert(done.some(q => q.id === 'guardian_cartographer_intro'), 'cartographer intro cascades in immediately after, in the same checkAll()');
    assert(done.some(q => q.id === 'guardian_cartographer_defeat'), 'defeat dialogue cascades too — the Guardian was already dead, nothing was lost');
  }
  console.log('    Act IV quest chain gates and orders correctly, dialogue intact ✓');
  console.log('    Combat-side defeat ahead of the quest gate is never lost — dialogue just cascades in once the gate catches up ✓');
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
