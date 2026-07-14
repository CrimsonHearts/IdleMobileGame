/* smoke26.js — Round 28 "full gameplay review" regression tests.
 *
 * User request: "review again the full game play." Four parallel research
 * agents (economy, combat/meta-progression, quests/story, life-sim) plus a
 * live Playwright playthrough surfaced several real, verified bugs. The
 * most severe (Rift Guardian soft-lock) has its own tests folded into
 * smoke25.js (Tests 3/4/6b/7d, updated in place since it directly
 * contradicted assertions written for the Round 27 version of the same
 * feature). This file covers the remaining four fixes:
 *
 *   1. game.js init(): a save with `dailies.weekClaimed` stuck at `true`
 *      (the exact state the original Round-11 bug — since fixed for future
 *      claims — could have left behind, since it set weekClaimed=true and
 *      never reset it) is now force-cleared on load, since the field can
 *      never legitimately be observably true in a persisted save under the
 *      current code (dailies.js flips it true→false atomically within one
 *      synchronous claimWeekReward() call, before persist() ever runs).
 *   2. game.js init(): `maxSeenTime`/`cheatFlags` (the offline-farming
 *      anti-cheat high-water mark) are now backfilled like every other
 *      newState() field, instead of being silently skipped — every site
 *      that's supposed to raise `maxSeenTime` uses a strict `>` comparison
 *      against it, and `x > undefined` is always false, so a save missing
 *      the field could never have it set at all.
 *   3. market.js buy(): the Qi Infusion good's flat "+50 Qi" bonus was
 *      added AFTER the `* qty` multiplication instead of scaling with it —
 *      buying qty=1 five separate times granted 5×50=250 flat bonus Qi for
 *      the same money as one qty=5 purchase (which granted only 50).
 *   4. game.js buyPill(): the only currency-spending mutator in the file
 *      missing a trailing persist() call — a crash/force-quit within the
 *      10s autosave window could lose the money spent (already deducted in
 *      memory) without the pill gained ever reaching disk.
 */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
const window = global;
const fs = require('fs');

console.log('Testing Round 28 full-gameplay-review fixes: migration gaps + market exploit + buyPill persist...');

// ════════════════════════════════════════════════════════════════════════
// PART A — game.js init() migration gaps (weekClaimed stuck-true, maxSeenTime)
// ════════════════════════════════════════════════════════════════════════
{
  const TimeService = { now: () => 1721000000000, monotonicNow: () => 0 };
  window.TimeService = TimeService;
  const Storage = { save: () => true, load: () => null, wipe: () => {} };
  window.Storage = Storage;
  eval(fs.readFileSync('www/js/gameData.js', 'utf8'));
  eval(fs.readFileSync('www/js/game.js', 'utf8'));

  // TEST 1 — a save with dailies.weekClaimed stuck at `true` (simulating a
  // save that hit the original, since-fixed Round-11 bug and was never
  // migrated) is force-cleared on init(), un-softlocking the weekly chest.
  console.log('\n  Test 1: init() force-clears a stuck dailies.weekClaimed=true');
  {
    const staleSave = {
      realm: 2, owned: {}, dailies: {
        day: '2026-01-01', missions: [], allComplete: false, sealClaimed: false, sealEndsAt: 0,
        streak: 7, weekReady: false, weekClaimed: true, // the stuck bad state
      },
    };
    Game.init(staleSave);
    assert(Game.state.dailies.weekClaimed === false, 'weekClaimed was force-reset to false by the migration');
  }
  console.log('    Stuck weekClaimed=true is corrected on load, un-softlocking the 7-day chest ✓');

  // TEST 2 — a fresh/undefined dailies object still backfills normally (the
  // migration must not require the field to already exist).
  console.log('\n  Test 2: init() still backfills a totally-missing dailies object correctly');
  {
    const bareSave = { realm: 0, owned: {} };
    Game.init(bareSave);
    assert(Game.state.dailies.weekClaimed === false, 'weekClaimed defaults to false when dailies was entirely absent');
    assert(Game.state.dailies.weekReady === false, 'weekReady defaults to false when dailies was entirely absent');
  }
  console.log('    Totally-absent dailies still backfills to sane defaults ✓');

  // TEST 3 — maxSeenTime/cheatFlags are backfilled for a save predating the
  // anti-cheat feature (field entirely absent, not just falsy).
  console.log('\n  Test 3: init() backfills a missing maxSeenTime/cheatFlags');
  {
    const preAntiCheatSave = { realm: 3, owned: {} }; // no maxSeenTime/cheatFlags at all
    Game.init(preAntiCheatSave);
    assert(Game.state.maxSeenTime === 1721000000000, `maxSeenTime backfilled from TimeService.now() (got ${Game.state.maxSeenTime})`);
    assert(Game.state.cheatFlags === 0, `cheatFlags backfilled to 0 (got ${Game.state.cheatFlags})`);
  }
  console.log('    A save missing the anti-cheat fields entirely gets them backfilled, not left undefined forever ✓');

  // TEST 4 — a save that legitimately already has these fields keeps its
  // real values — the migration must not stomp real anti-cheat state.
  console.log('\n  Test 4: init() does not clobber a save\'s real maxSeenTime/cheatFlags');
  {
    const realSave = { realm: 4, owned: {}, maxSeenTime: 1700000000000, cheatFlags: 3 };
    Game.init(realSave);
    assert(Game.state.maxSeenTime === 1700000000000, 'existing maxSeenTime is preserved, not overwritten');
    assert(Game.state.cheatFlags === 3, 'existing cheatFlags count is preserved, not reset');
  }
  console.log('    Real anti-cheat state on an existing save is left untouched ✓');
}

// ════════════════════════════════════════════════════════════════════════
// PART B — market.js Qi Infusion flat-bonus scaling exploit
// ════════════════════════════════════════════════════════════════════════
{
  const addQiCalls = [];
  const Game = {
    state: {
      life: { money: 1e15 }, spiritStones: 0, beastEggs: 0, breakthroughPills: 0, realm: 0,
      market: { prices: { qi_infusion: 1 }, trend: {}, lastDrift: 0 }, // no drift, price = base exactly
    },
    qiPerSecond: () => 100, // fixed, deterministic rate for the math below
    _addQi: (n) => { addQiCalls.push(n); },
    persist: () => {},
  };
  window.Game = Game;
  const GameData = {
    market: {
      realmScale: 1, sellRate: 0.5,
      goods: [{ id: 'qi_infusion', give: { qiHours: 1 }, base: 10 }],
      sellable: [],
    },
  };
  window.GameData = GameData;
  const fs2 = require('fs');
  eval(fs2.readFileSync('www/js/market.js', 'utf8'));

  // TEST 5 — a qty=5 purchase and five separate qty=1 purchases cost the
  // same total money, and must now grant the SAME total flat bonus Qi too
  // (50 total, not 250) — the bug scaled the flat +50 term per CALL instead
  // of per UNIT, rewarding spam-clicking the smallest quantity.
  console.log('\n  Test 5: Qi Infusion flat bonus scales with quantity, not with call count');
  {
    addQiCalls.length = 0;
    Market.buy('qi_infusion', 5);
    const qty5Total = addQiCalls.reduce((a, b) => a + b, 0);
    // qiPerSecond=100, 3600s/hr, qiHours=1 → base = 360000; flat bonus should be 50*5=250.
    assert(qty5Total === 100 * 3600 * 1 * 5 + 50 * 5, `qty=5 in one call grants base×5 + 50×5 (got ${qty5Total})`);

    addQiCalls.length = 0;
    for (let i = 0; i < 5; i++) Market.buy('qi_infusion', 1);
    const fiveQty1Total = addQiCalls.reduce((a, b) => a + b, 0);
    assert(fiveQty1Total === qty5Total, `five qty=1 calls grant the SAME total as one qty=5 call (got ${fiveQty1Total} vs ${qty5Total})`);
  }
  console.log('    Flat +50/unit bonus no longer rewards spam-clicking the smallest quantity ✓');
}

// ════════════════════════════════════════════════════════════════════════
// PART C — game.js buyPill() persists (was the only spend-mutator that didn't)
// ════════════════════════════════════════════════════════════════════════
{
  const TimeService = { now: () => 1721000000000, monotonicNow: () => 0 };
  window.TimeService = TimeService;
  const Storage = { save: () => true, load: () => null, wipe: () => {} };
  window.Storage = Storage;
  eval(fs.readFileSync('www/js/gameData.js', 'utf8'));
  eval(fs.readFileSync('www/js/game.js', 'utf8'));

  console.log('\n  Test 6: buyPill() calls persist() like every other spend mutator');
  {
    Game.init({ realm: 1, owned: {}, life: { money: 1e9 }, breakthroughPills: 0 });
    let persisted = false;
    Game.persist = () => { persisted = true; };
    const ok = Game.buyPill();
    assert(ok === true, 'buyPill() succeeds with ample money');
    assert(persisted === true, 'buyPill() calls this.persist() after a successful purchase');
  }
  console.log('    buyPill() no longer skips persist() — a crash right after buying can\'t lose the purchase ✓');
}

console.log('\n✓ All smoke26 tests passed.');
