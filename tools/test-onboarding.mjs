/* Headless smoke test for onboarding.js — progressive unlocks + tutorial.
 * Run: node tools/test-onboarding.mjs */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- Minimal DOM / env stubs ------------------------------------------------
const stubEl = () => {
  const el = {
    style: {}, dataset: {}, children: [], innerHTML: '', display: '',
    classList: { _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { on === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (on ? this._s.add(c) : this._s.delete(c)); },
      contains(c) { return this._s.has(c); } },
    addEventListener() {}, appendChild() {}, remove() {},
    querySelector() { return stubEl(); }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 10, height: 10, bottom: 10 }; },
    offsetParent: null, offsetHeight: 0,
  };
  return el;
};
let modalOpen = null; // simulate .modal-overlay presence
const navBtns = {};   // selector -> element
global.window = global;
global.document = {
  getElementById: () => null,
  querySelector: sel => sel === '.modal-overlay' ? modalOpen : (navBtns[sel] || null),
  querySelectorAll: () => [],
  createElement: () => stubEl(),
  body: { appendChild: el => { if (el.innerHTML.includes('modal-overlay') || el.className === 'modal-overlay') modalOpen = el; } },
};
global.performance = { now: () => Date.now() };
global.TimeService = { now: () => Date.now(), monotonicNow: () => Date.now(), sync: async () => {} };
global.Storage = { save() {}, load() { return null; }, wipe() {} };
const calls = { toasts: [], modals: [] };
global.UI = { activeTab: 'cultivate',
  toast: m => calls.toasts.push(m),
  modal: (t, h) => calls.modals.push(t),
  spawnParticles() {} };

const load = f => (0, eval)(readFileSync(join(root, 'www/js', f), 'utf8'));
load('gameData.js');
load('game.js');
load('onboarding.js');

// Track unlock-modal celebrations.
const origDrain = Onboarding._drainQueue.bind(Onboarding);
Onboarding._drainQueue = function () {
  while (this._queue.length) calls.modals.push('UNLOCK:' + this._queue.shift().id);
};

let failed = 0;
const assert = (cond, msg) => {
  console.log((cond ? '  ✓ ' : '  ✗ FAIL ') + msg);
  if (!cond) failed++;
};

// ---- 1. Fresh player: everything starts locked ------------------------------
console.log('\n[1] Fresh save');
Game.init(null);
Onboarding.init();
assert(Game.state.onboarding.ready, 'onboarding marked ready');
assert(Onboarding.FEATURES.every(f => !Onboarding.isUnlocked(f.id)), 'all features locked before character creation');
Onboarding.tick(); // characterCreated=false → no-op
assert(Onboarding.FEATURES.every(f => !Onboarding.isUnlocked(f.id)), 'tick before creation unlocks nothing');

// ---- 2. Progression unlocks -------------------------------------------------
console.log('\n[2] Progression unlocks');
Game.createCharacter('male', 'Tester', GameData.spiritualRoots[0]);
Game.state.life = { money: 0, age: 18, ageAcc: 0, intellect: 0, charm: 0, talent: 0, education: 0, study: null, jobId: null, jobXp: 0 };
Onboarding.tick();
assert(Onboarding.FEATURES.every(f => !Onboarding.isUnlocked(f.id)), 'nothing unlocked at zero progress');

Game.state.owned.mat = 1;
Onboarding.tick();
assert(Onboarding.isUnlocked('quests'), 'quests unlock on first generator');
assert(calls.toasts.some(t => t.includes('Quest Log')), 'quests celebrated via toast');
assert(!Onboarding.isUnlocked('study'), 'study still locked');

Game.state.stagesCleared = 1;
Onboarding.tick();
assert(Onboarding.isUnlocked('study'), 'study unlocks on first stage');
assert(calls.modals.includes('UNLOCK:study'), 'study celebrated via modal');

Game.state.life.education = 1;
Onboarding.tick();
assert(Onboarding.isUnlocked('work'), 'work unlocks after first course');

Game.state.lifetimeQi = 250;
Onboarding.tick();
assert(Onboarding.isUnlocked('arts'), 'arts unlock at 250 lifetime Qi');

Game.state.stagesCleared = 2;
Onboarding.tick();
assert(Onboarding.isUnlocked('world'), 'world unlocks with combat (2 stages)');
assert(!Onboarding.isUnlocked('life') && !Onboarding.isUnlocked('shop') && !Onboarding.isUnlocked('daily'),
  'life/shop/daily still locked at realm 0');

Game.state.realm = 1;
Onboarding.tick();
assert(Onboarding.isUnlocked('life') && Onboarding.isUnlocked('shop') && Onboarding.isUnlocked('daily'),
  'life + shop + daily unlock at realm 1');

// ---- 3. Tutorial step sequencing --------------------------------------------
console.log('\n[3] Tutorial steps');
Game.init(null);
Onboarding.init(); // boot order: init runs before character creation
Game.createCharacter('female', 'Stepper', GameData.spiritualRoots[0]);
const ob = Game.state.onboarding;
Onboarding._runTutorial();
assert(!ob.steps.tap, 'tap step active (not yet done)');
Game._addQi(20); // can afford first generator
Onboarding._runTutorial();
assert(ob.steps.tap, 'tap step completes at 15 Qi');
assert(!ob.steps.gen, 'gen step active next');
Game.state.owned.mat = 1;
Onboarding._runTutorial();
assert(ob.steps.gen, 'gen step completes on purchase');
assert(!ob.steps.stage, 'stage step waits for affordable stage');
Game._addQi(100); // first stage costs ~10 Qi
Onboarding._runTutorial();
assert(!ob.steps.stage, 'stage step active while unspent');
Game.advanceStage();
Onboarding._runTutorial();
assert(ob.steps.stage, 'stage step completes on advance');
// Skip works
ob.skipped = false;
Onboarding._ensureSpotEls();
ob.skipped = true;
Onboarding._runTutorial();
assert(!Onboarding._spot.style.display || Onboarding._spot.style.display === 'none', 'spotlight hidden when skipped');

// ---- 4. Pill-gate hint -------------------------------------------------------
console.log('\n[4] Contextual hint');
modalOpen = null;
calls.modals.length = 0;
Game.state.realm = 1;
Game.state.stage = GameData.realms[1].stages.length; // realm complete
Game.state.breakthroughPills = 0;
Onboarding._checkHints();
assert(calls.modals.some(m => m.includes('Pill Gate')), 'pill-gate hint fires at Foundation tribulation');
calls.modals.length = 0;
Onboarding._checkHints();
assert(calls.modals.length === 0, 'pill-gate hint fires only once');

// ---- 5. Veteran grandfathering ----------------------------------------------
console.log('\n[5] Veteran save migration');
const veteran = Game.newState();
veteran.characterCreated = true;
veteran.realm = 4;
delete veteran.onboarding; // pre-onboarding save shape
Game.init(JSON.parse(JSON.stringify(veteran)));
Onboarding.init();
assert(Onboarding.FEATURES.every(f => Onboarding.isUnlocked(f.id)), 'veteran save: all features unlocked silently');
assert(Onboarding.STEPS.every(s => Game.state.onboarding.steps[s.id]), 'veteran save: tutorial marked done');
assert(Onboarding.HINTS.every(h => Game.state.onboarding.hints[h.id]), 'veteran save: hints marked done');

console.log(failed ? `\n${failed} FAILURE(S)` : '\nAll onboarding assertions passed.');
process.exit(failed ? 1 : 0);
