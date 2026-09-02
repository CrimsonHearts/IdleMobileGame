/* smoke28.js — Round 32: portrait catalogue + player-chosen portrait.
 *
 * User asked for a customizable UI, specifically "pick your own portrait"
 * and "more portraits generated in the future". Previously a portrait was
 * DERIVED from gender × spirit root with no way to choose, hard-capping the
 * art at 10. Now GameData.portraitCatalog is the source of truth and
 * Game.state.chosenPortraitId overrides the derived default.
 */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
const window = global;
const fs = require('fs');

console.log('Testing Round 32 portrait catalogue + chosen-portrait override...');

const TimeService = { now: () => 1721000000000, monotonicNow: () => 0 };
window.TimeService = TimeService;
const Storage = { save: () => true, load: () => null, wipe: () => {} };
window.Storage = Storage;
eval(fs.readFileSync('www/js/gameData.js', 'utf8'));
eval(fs.readFileSync('www/js/game.js', 'utf8'));

function freshState(overrides) {
  Game.init(Object.assign({ realm: 0, owned: {} }, overrides));
  return Game.state;
}

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — catalogue integrity
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: portraitCatalog integrity');
{
  const cat = GameData.portraitCatalog;
  assert(Array.isArray(cat) && cat.length >= 10, 'catalogue exists with at least the 10 base portraits');
  const ids = cat.map(p => p.id);
  assert(new Set(ids).size === ids.length, 'every catalogue id is unique');
  cat.forEach(p => {
    assert(p.id && p.file && p.name, `entry ${p.id} has id/file/name`);
    assert(/\.(jpg|jpeg|png|webp)$/i.test(p.file), `entry ${p.id} points at an image file`);
  });
  // Settings groups the picker by gender, so every entry's gender must be
  // a known key or null ("Other") — a typo like 'Female' would silently
  // drop that portrait out of every group in the UI.
  const validGenders = Object.keys(GameData.genders);
  cat.forEach(p => {
    assert(p.gender === null || p.gender === undefined || validGenders.includes(p.gender),
      `entry ${p.id} has a groupable gender (got ${JSON.stringify(p.gender)})`);
    assert(p.root === null || p.root === undefined || GameData.spiritualRoots.some(r => r.key === p.root),
      `entry ${p.id} has a known root (got ${JSON.stringify(p.root)})`);
  });
  // Every gender × root combo must still have a default, or new characters
  // would boot with a broken portrait.
  const genders = Object.keys(GameData.genders);
  GameData.spiritualRoots.forEach(r => genders.forEach(g => {
    assert(cat.some(p => p.gender === g && p.root === r.key),
      `catalogue covers the ${g}/${r.key} default`);
  }));
}
console.log('    Catalogue is well-formed and covers every gender x root default ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — default (no choice) still derives from gender x root
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: with no choice made, behaviour is unchanged');
{
  freshState({ gender: 'female', spiritualRoot: GameData.spiritualRoots.find(r => r.key === 'chaos') });
  assert(Game.state.chosenPortraitId === null, 'a fresh save has no chosen portrait');
  assert(Game.chosenPortrait() === null, 'chosenPortrait() is null when nothing is chosen');
  assert(Game.portraitSrc() === 'assets/portraits/female-chaos.jpg',
    `derives from gender x root (got ${Game.portraitSrc()})`);
}
console.log('    Auto mode reproduces the original gender x root derivation ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — choosing a portrait overrides the derived default
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: a chosen portrait wins over gender x root');
{
  freshState({ gender: 'female', spiritualRoot: GameData.spiritualRoots.find(r => r.key === 'chaos') });
  assert(Game.setChosenPortrait('male-heaven') === true, 'setChosenPortrait accepts a valid id');
  assert(Game.state.chosenPortraitId === 'male-heaven', 'choice is stored on state (so it persists)');
  assert(Game.portraitSrc() === 'assets/portraits/male-heaven.jpg',
    `portraitSrc() honours the choice (got ${Game.portraitSrc()})`);
  assert(Game.chosenPortrait().name === 'Lunar', 'chosenPortrait() returns the catalogue entry');
  // Crucially: the choice is NOT restricted by the character's own gender/root.
  assert(Game.state.gender === 'female', 'character gender is untouched by the portrait choice');
}
console.log('    Any portrait can be chosen regardless of gender or spirit root ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — reverting to auto
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: reverting to auto');
{
  freshState({ gender: 'male', spiritualRoot: GameData.spiritualRoots.find(r => r.key === 'saint') });
  Game.setChosenPortrait('female-true');
  assert(Game.portraitSrc() === 'assets/portraits/female-true.jpg', 'choice applied');
  assert(Game.setChosenPortrait(null) === true, 'null reverts to auto');
  assert(Game.state.chosenPortraitId === null, 'stored choice cleared');
  assert(Game.portraitSrc() === 'assets/portraits/male-saint.jpg',
    `back to the derived default (got ${Game.portraitSrc()})`);
  Game.setChosenPortrait('female-true');
  assert(Game.setChosenPortrait('auto') === true, "the string 'auto' also reverts");
  assert(Game.state.chosenPortraitId === null, "'auto' cleared the stored choice");
}
console.log('    Auto revert works via both null and "auto" ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — unknown ids are rejected without corrupting state
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5: unknown portrait ids are rejected safely');
{
  freshState({ gender: 'male', spiritualRoot: GameData.spiritualRoots.find(r => r.key === 'mortal') });
  Game.setChosenPortrait('male-chaos');
  assert(Game.setChosenPortrait('does-not-exist') === false, 'unknown id returns false');
  assert(Game.state.chosenPortraitId === 'male-chaos', 'the previous valid choice is left intact');
  assert(Game.portraitSrc() === 'assets/portraits/male-chaos.jpg', 'portrait unchanged after a rejected set');
}
console.log('    Bad ids rejected without clobbering the existing choice ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 6 — explicit args still return the derived default (creation preview)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 6: explicit gender/root args bypass the choice');
{
  freshState({ gender: 'male', spiritualRoot: GameData.spiritualRoots.find(r => r.key === 'mortal') });
  Game.setChosenPortrait('female-chaos');
  // Character creation previews a root being rolled — it must show THAT
  // root's art, not whatever the player picked in Settings.
  assert(Game.portraitSrc('female', 'saint') === 'assets/portraits/female-saint.jpg',
    `explicit args win (got ${Game.portraitSrc('female', 'saint')})`);
  assert(Game.portraitSrc() === 'assets/portraits/female-chaos.jpg', 'no-arg call still honours the choice');
}
console.log('    Creation-preview path is unaffected by the Settings choice ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 7 — migration: old saves and stale ids
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 7: old saves migrate, stale ids degrade gracefully');
{
  // A save written before this feature existed has no chosenPortraitId.
  const legacy = { realm: 0, owned: {}, gender: 'female',
                   spiritualRoot: GameData.spiritualRoots.find(r => r.key === 'true') };
  delete legacy.chosenPortraitId;
  Game.init(legacy);
  assert(Game.state.chosenPortraitId === null, 'legacy save backfills chosenPortraitId to null');
  assert(Game.portraitSrc() === 'assets/portraits/female-true.jpg', 'legacy save still renders its derived portrait');

  // A save referencing art that was later removed from the catalogue.
  Game.state.chosenPortraitId = 'portrait-that-was-deleted';
  assert(Game.chosenPortrait() === null, 'stale id resolves to null rather than throwing');
  assert(Game.portraitSrc() === 'assets/portraits/female-true.jpg',
    `stale id falls back to the derived default (got ${Game.portraitSrc()})`);
}
console.log('    Legacy saves and stale catalogue ids both degrade safely ✓');

console.log('\n✓ All smoke28 tests passed.');
