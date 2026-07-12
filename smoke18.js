/* smoke18.js — Round 19 "Pill Alchemy stacking + brew/use max" regression.
 *
 * Covers two fixes requested together ("for consuming pill i would like to
 * be able to stack the pill i eat and also for fortune pill i would like
 * to be allowed to buy max too and use max"):
 *   1. Real buff stacking: usePill() used to dedupe active buffs by BUFF
 *      KEY ('qi'/'combat'), so a second, different pill sharing that key
 *      (e.g. Enlightenment Pill after Spirit Gathering Pill) silently
 *      overwrote the first instead of stacking, and re-using the SAME pill
 *      only refreshed the timer to the pill's own duration instead of
 *      extending it. Fixed to dedupe by PILL ID instead — mirrors how
 *      boosters.js already stacks (see Boosters._extend/_mult): the same
 *      pill extends its own timer additively; different pills sharing a
 *      buff key get independent entries whose multipliers compound via
 *      buffMult()'s existing "multiply every matching entry" loop.
 *   2. craftPill()/usePill() gained a `count` param and Game.
 *      maxAffordablePills(id), generalized to every pill (not just Fortune
 *      Pill) since the UI can't sensibly offer "Max" for only one pill.
 */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };

global.window = global;
const _store = {};
global.localStorage = {
  getItem: k => (k in _store ? _store[k] : null),
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: k => { delete _store[k]; },
};
global.navigator = { onLine: false };
global.document = undefined;

const fs = require('fs');
['gameData', 'time', 'game'].forEach(m => {
  eval(fs.readFileSync(`www/js/${m}.js`, 'utf8'));
});
global.Storage = { save: () => true, wipe: () => {} };

console.log('Testing Pill Alchemy stacking + brew/use max...');

function freshGame() {
  Game.state = Game.newState();
  Game.state.spiritStones = 1e9;
  return Game;
}

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — Re-using the SAME buff pill extends its own timer additively
// (not just Math.max-refreshed to the pill's own duration)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: Same pill reused extends duration additively');
{
  freshGame();
  const p = Game.pillDef('qi_pill'); // Spirit Gathering Pill: ×2 Qi, 600s
  Game.craftPill('qi_pill', 2);
  Game.usePill('qi_pill', 1);
  const firstEndsAt = Game.state.buffs.find(b => b.pillId === 'qi_pill').endsAt;
  Game.usePill('qi_pill', 1);
  const secondEndsAt = Game.state.buffs.find(b => b.pillId === 'qi_pill').endsAt;
  assert(secondEndsAt === firstEndsAt + p.durationSec * 1000, `second use ADDS a full duration on top (expected +${p.durationSec}s, got +${(secondEndsAt-firstEndsAt)/1000}s)`);
  assert(Game.buffMult('qi') === 2, 'mult stays ×2 for the same pill reused (duration stacks, magnitude does not)');
}
console.log('    Same-pill reuse stacks duration, not magnitude ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — Two DIFFERENT pills sharing a buff key stack multiplicatively
// (the actual bug: Enlightenment Pill used to silently overwrite Spirit
// Gathering Pill's buff instead of combining with it)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: Different pills sharing a buff key compound');
{
  freshGame();
  Game.craftPill('qi_pill', 1);     // ×2 Qi
  Game.craftPill('insight_pill', 1); // ×3 Qi
  Game.usePill('qi_pill', 1);
  assert(Game.buffMult('qi') === 2, 'only Spirit Gathering active so far: ×2');
  Game.usePill('insight_pill', 1);
  assert(Game.buffMult('qi') === 6, `both active together compound multiplicatively: ×2 * ×3 = ×6 (got ×${Game.buffMult('qi')})`);
  assert(Game.state.buffs.length === 2, 'two independent buff entries exist, neither overwrote the other');
  assert(Game.activeBuffs().length === 2, 'activeBuffs() reports both as active');
}
console.log('    Different same-category pills stack multiplicatively instead of overwriting ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — Different buff KEYS (qi vs combat) never cross-contaminate
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: Independent buff keys stay independent');
{
  freshGame();
  Game.craftPill('qi_pill', 1);
  Game.craftPill('berserk_pill', 1);
  Game.usePill('qi_pill', 1);
  Game.usePill('berserk_pill', 1);
  assert(Game.buffMult('qi') === 2, 'qi buff unaffected by the combat pill');
  assert(Game.buffMult('combat') === 2, 'combat buff active independently');
}
console.log('    qi/combat buff keys remain independent ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — craftPill(id, count) brews N at once for N× the flat cost
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: craftPill() bulk brewing');
{
  freshGame();
  Game.state.spiritStones = 1000;
  const p = Game.pillDef('qi_pill'); // cost 200
  assert(Game.craftPill('qi_pill', 4), 'can afford exactly 4 (4*200=800 <= 1000)');
  assert(Game.pillCount('qi_pill') === 4, 'pillBag incremented by exactly 4');
  assert(Game.state.spiritStones === 200, 'spent exactly 4*cost, no partial/rounding error');
  assert(!Game.craftPill('qi_pill', 2), 'refuses when the requested count is unaffordable (only 200 stones left, needs 400)');
  assert(Game.pillCount('qi_pill') === 4, 'a refused bulk brew does not partially apply');
}
console.log('    Bulk brewing charges exactly count*cost, refuses cleanly when unaffordable ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — Game.maxAffordablePills() matches the flat-cost math exactly
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5: maxAffordablePills()');
{
  freshGame();
  Game.state.spiritStones = 999; // Fortune Pill costs 400 -> floor(999/400) = 2
  assert(Game.maxAffordablePills('fortune_pill') === 2, `999 stones affords exactly 2 Fortune Pills (got ${Game.maxAffordablePills('fortune_pill')})`);
  Game.state.spiritStones = 0;
  assert(Game.maxAffordablePills('fortune_pill') === 0, '0 stones affords 0');
}
console.log('    maxAffordablePills() matches floor(stones/cost) exactly ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 6 — usePill(id, count) on an instant pill (Fortune Pill) applies the
// effect N times in one call — the user's literal "use max" request
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 6: Bulk-using an instant pill (Fortune Pill = Beast Eggs)');
{
  freshGame();
  Game.craftPill('fortune_pill', 5);
  const eggsBefore = Game.state.beastEggs;
  const res = Game.usePill('fortune_pill', 5);
  assert(res && res.count === 5, 'usePill reports the count actually consumed');
  assert(Game.state.beastEggs === eggsBefore + 5, `5 Fortune Pills grant exactly 5 Beast Eggs in one call (expected ${eggsBefore+5}, got ${Game.state.beastEggs})`);
  assert(Game.pillCount('fortune_pill') === 0, 'all 5 consumed from the bag');
  assert(!Game.usePill('fortune_pill', 1), 'refuses to use more than owned (bag is now empty)');
}
console.log('    Bulk-using Fortune Pill grants N eggs in a single action ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 7 — usePill(id, count) on a buff pill stacks N durations in one call
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 7: Bulk-using a buff pill (Use Max) stacks N durations at once');
{
  freshGame();
  const p = Game.pillDef('qi_pill');
  Game.craftPill('qi_pill', 3);
  const before = TimeService.now();
  Game.usePill('qi_pill', 3);
  const buff = Game.state.buffs.find(b => b.pillId === 'qi_pill');
  assert(Math.abs(buff.endsAt - (before + p.durationSec * 1000 * 3)) < 2000, `using 3 at once stacks 3 full durations (~${p.durationSec*3}s, got ${(buff.endsAt-before)/1000}s)`);
  assert(Game.buffMult('qi') === 2, 'magnitude is still just ×2 (duration stacks, not power)');
}
console.log('    "Use Max" on a buff pill stacks all owned copies\' durations in one action ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 8 — Foundation Pill (runqi instant) also scales correctly with count
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 8: Bulk-using Foundation Pill (instant runqi) scales with count');
{
  freshGame();
  Game.state.realm = 2; Game.state.stage = 1; // ensure nextStageReq() is well-defined
  Game.craftPill('foundation_pill', 3);
  const qiBefore = Game.state.qi;
  const req = Game.nextStageReq();
  Game.usePill('foundation_pill', 3);
  const expectedGain = req * 0.25 * 3;
  assert(Math.abs((Game.state.qi - qiBefore) - expectedGain) < 1e-6, `3 Foundation Pills grant exactly 3x the single-pill Qi gain (expected +${expectedGain}, got +${Game.state.qi-qiBefore})`);
}
console.log('    Foundation Pill instant-Qi effect scales linearly with count ✓');

console.log('\n✓ All smoke18 tests passed.');
