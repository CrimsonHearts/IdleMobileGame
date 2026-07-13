/* smoke23.js — Round 25 "Chronicle" event log regression.
 *
 * User report: "the toast is covering everything on the ui" (a real bug —
 * .toast/.story-toast had no pointer-events:none, so a notification
 * blocked clicks on whatever was underneath it for its whole ~3.6s
 * lifetime, and .story-toast had no max-height so a long dialogue entry
 * could grow tall enough to dominate the screen — both fixed in CSS,
 * verified visually via Playwright, not covered here since this file
 * only exercises JS logic) plus "ideally all the events can be logged as
 * a storyline for the user to read in the future" — a new persisted
 * Game.state.eventLog fed by hooking the two central notification
 * chokepoints (UI.toast() and UI._advanceDialogue()) rather than each of
 * the ~69 individual call sites, so every existing and future
 * toast/dialogue is captured automatically.
 */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };

global.window = global;
// Minimal DOM stub — ui.js is a single object literal assigned to
// window.UI with no top-level DOM calls, so it eval()s cleanly; these
// stubs only need to not crash when toast()/_advanceDialogue() reach for
// document.createElement/body.appendChild during their (out-of-scope-for-
// this-file) visual side effects. The synchronous logging side effect
// (_logEvent, called before any DOM work) is what's under test.
const fakeEl = () => ({
  classList: { add() {}, remove() {} }, style: {},
  addEventListener() {}, appendChild() {}, remove() {},
  querySelectorAll: () => [], querySelector: () => null, setAttribute() {},
});
global.document = {
  createElement: () => fakeEl(),
  body: { appendChild() {} },
  getElementById: () => null,
  querySelectorAll: () => [],
  querySelector: () => null,
};
global.navigator = { onLine: false, vibrate: undefined };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
// ui.js reads/writes the Game global throughout its method bodies (it's
// provided by game.js in the real app) — not loaded here since only the
// logging chokepoints are under test, so a minimal stand-in is enough.
global.Game = { state: null, persist() {} };

const fs = require('fs');
eval(fs.readFileSync('www/js/time.js', 'utf8'));
eval(fs.readFileSync('www/js/ui.js', 'utf8'));

console.log('Testing Round 25 Chronicle event log...');

function freshState() {
  Game.state = { eventLog: [] };
}

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — _logEvent() appends newest-first and is exposed with the
// expected shape ({text, at})
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: _logEvent() appends newest-first with the right shape');
{
  freshState();
  UI._logEvent('First event');
  UI._logEvent('Second event');
  assert(Game.state.eventLog.length === 2, `two entries logged (got ${Game.state.eventLog.length})`);
  assert(Game.state.eventLog[0].text === 'Second event', 'newest entry is at index 0 (unshift, not push)');
  assert(Game.state.eventLog[1].text === 'First event', 'older entry follows');
  assert(typeof Game.state.eventLog[0].at === 'number', 'each entry carries a numeric timestamp');
}
console.log('    Newest-first ordering and entry shape correct ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — Every UI.toast() call is automatically logged, with zero
// changes needed at any of the ~69 existing call sites (the whole point
// of hooking the chokepoint function instead of each call site)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: UI.toast() logs automatically');
{
  freshState();
  UI._toastQueue = []; UI._toastShowing = false; // reset any cross-test queue state
  UI.toast('⚡ Auto-equipped 4 upgrades!');
  assert(Game.state.eventLog.length === 1, 'toast() logged exactly one entry');
  assert(Game.state.eventLog[0].text === '⚡ Auto-equipped 4 upgrades!', 'logged text matches the toast message verbatim');
}
console.log('    toast() logs its message with no per-call-site changes required ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — _advanceDialogue() logs narrative dialogue too (speaker name +
// combined lines), not just plain toasts
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: Story dialogue is logged too');
{
  freshState();
  UI._dialogueQueue = []; UI._dialogueShowing = false;
  UI.showDialogue([{ speaker: 'mentor', icon: '🧙', name: 'Granny Su', lines: ['Did you feel that?', 'A tremor in the Heavenly Law.'] }]);
  assert(Game.state.eventLog.length === 1, 'one dialogue entry logged');
  const logged = Game.state.eventLog[0].text;
  assert(logged.includes('Granny Su'), `logged text includes the speaker name (got '${logged}')`);
  assert(logged.includes('Did you feel that?') && logged.includes('A tremor in the Heavenly Law.'), 'logged text includes all dialogue lines');
}
console.log('    Narrative dialogue is captured in the same log as plain toasts ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — The log is capped (EVENT_LOG_CAP) so a very long playthrough
// can't grow the save file unboundedly; oldest entries are dropped first
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: Log is capped, oldest entries dropped first');
{
  freshState();
  const cap = UI.EVENT_LOG_CAP;
  for (let i = 0; i < cap + 50; i++) UI._logEvent(`event #${i}`);
  assert(Game.state.eventLog.length === cap, `log never exceeds EVENT_LOG_CAP=${cap} (got ${Game.state.eventLog.length})`);
  assert(Game.state.eventLog[0].text === `event #${cap + 49}`, 'the most recent event is still at index 0');
  assert(Game.state.eventLog[cap - 1].text === `event #50`, 'the oldest SURVIVING event is the 50th pushed — the first 50 were correctly dropped as the cap was exceeded');
}
console.log('    Cap enforced correctly, oldest entries pruned, newest always kept ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — _relTime() produces sane, monotonically-coarser buckets
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5: _relTime() formatting');
{
  const now = TimeService.now();
  assert(UI._relTime(now) === 'just now', 'a just-logged event reads "just now"');
  assert(UI._relTime(now - 5 * 60 * 1000) === '5m ago', `5 minutes ago reads "5m ago" (got '${UI._relTime(now - 5*60*1000)}')`);
  assert(UI._relTime(now - 3 * 3600 * 1000) === '3h ago', `3 hours ago reads "3h ago" (got '${UI._relTime(now - 3*3600*1000)}')`);
  assert(UI._relTime(now - 2 * 86400 * 1000) === '2d ago', `2 days ago reads "2d ago" (got '${UI._relTime(now - 2*86400*1000)}')`);
}
console.log('    Relative-time buckets read naturally at every scale ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 6 — _logEvent() is defensive: no Game.state, empty text, or a save
// missing eventLog entirely must never throw (matches this codebase's
// established per-field save-migration safety pattern)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 6: _logEvent() defensive guards');
{
  const savedState = Game.state;
  Game.state = null;
  UI._logEvent('should not throw'); // no Game.state at all
  Game.state = savedState;

  freshState();
  UI._logEvent(''); // falsy text
  assert(Game.state.eventLog.length === 0, 'an empty-string message is not logged');

  Game.state = { /* eventLog intentionally missing, e.g. an old save */ };
  UI._logEvent('backfills eventLog on the fly');
  assert(Array.isArray(Game.state.eventLog) && Game.state.eventLog.length === 1, 'a save missing eventLog entirely self-heals instead of throwing');
}
console.log('    No Game.state, empty messages, and missing eventLog all handled safely ✓');

console.log('\n✓ All smoke23 tests passed.');
process.exit(0); // avoid hanging on any dangling setTimeout from toast()/_advanceDialogue()'s DOM-animation side effects
