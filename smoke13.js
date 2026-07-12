/* smoke13.js — Monetization: ad-removal must actually stop rewarded-ad prompts.
 *
 * Regression for: after purchasing "Remove Ads", every rewarded-ad call site
 * (boosters, stage aid, offline double, meet-destined, qi boost) still showed
 * the ad-watch prompt. showRewardedAd() had no adsRemoved check at all — the
 * shop card's own copy documented this as intentional ("rewarded ads
 * remain"), but that's not what a "Remove Ads" purchase should mean.
 */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
const window = global;

// ---- Minimal stubs ----------------------------------------------------------
const _store = {};
global.localStorage = {
  getItem: k => (k in _store ? _store[k] : null),
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: k => { delete _store[k]; },
};
let _confirmResponse = true;
let _confirmCallCount = 0;
global.confirm = () => { _confirmCallCount++; return _confirmResponse; };
// window.Capacitor is undefined by default here, simulating a plain browser
// (non-native) session — the SIMULATED purchase/ad path this file exercises.

eval(require('fs').readFileSync('www/js/monetization.js', 'utf8'));

console.log('Testing Round: Monetization — ad-removal gating...');

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — Before ad removal: showRewardedAd() shows the (simulated) prompt
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: Rewarded ad prompts before ad removal');

Monetization.adsRemoved = false;
_confirmCallCount = 0;
_confirmResponse = true;

Monetization.showRewardedAd('test').then(watched => {
  assert(watched === true, 'watched=true when the simulated confirm() is accepted');
  assert(_confirmCallCount === 1, `confirm() shown exactly once before ad removal (got ${_confirmCallCount})`);
  console.log('    Prompt shown before purchase OK ✓');
  runTest2();
});

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — Declining the ad prompt returns false (sanity: gating isn't a
// blanket "always true", it genuinely reads the user's answer pre-purchase)
// ════════════════════════════════════════════════════════════════════════
function runTest2() {
  console.log('\n  Test 2: Declining the pre-purchase prompt returns false');
  _confirmCallCount = 0;
  _confirmResponse = false;
  Monetization.showRewardedAd('test').then(watched => {
    assert(watched === false, 'watched=false when the simulated confirm() is declined');
    assert(_confirmCallCount === 1, 'confirm() was still shown once');
    console.log('    Decline path OK ✓');
    runTest3();
  });
}

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — _grant('remove_ads') sets adsRemoved and persists it
// ════════════════════════════════════════════════════════════════════════
function runTest3() {
  console.log('\n  Test 3: Purchasing ad removal sets and persists the flag');
  assert(Monetization.adsRemoved === false, 'adsRemoved false before purchase');
  Monetization._grant(IAP_PRODUCTS.removeAds);
  assert(Monetization.adsRemoved === true, 'adsRemoved true immediately after _grant');
  assert(localStorage.getItem('ads_removed') === '1', 'ads_removed persisted to localStorage');
  console.log('    Purchase grants + persists OK ✓');
  runTest4();
}

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — After ad removal: showRewardedAd() grants instantly, NO prompt
// (the actual regression this file exists to catch)
// ════════════════════════════════════════════════════════════════════════
function runTest4() {
  console.log('\n  Test 4: No rewarded-ad prompt after ad removal — instant grant');
  _confirmCallCount = 0;
  _confirmResponse = false; // even if a prompt WOULD appear and be declined...
  Monetization.showRewardedAd('booster_qiSurge').then(watched => {
    assert(watched === true, 'showRewardedAd() resolves true after ad removal, regardless of confirm() response');
    assert(_confirmCallCount === 0, `confirm() must NOT be called after ad removal (got ${_confirmCallCount} calls)`);
    console.log('    Instant grant, zero prompts OK ✓');
    runTest5();
  });
}

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — adsRemoved survives a fresh Monetization.init() (simulating reload)
// ════════════════════════════════════════════════════════════════════════
function runTest5() {
  console.log('\n  Test 5: adsRemoved reloaded correctly from localStorage on next boot');
  Monetization.adsRemoved = false; // simulate a fresh module instance pre-init
  Monetization.init().then(() => {
    assert(Monetization.adsRemoved === true, 'adsRemoved restored from localStorage on init()');
    console.log('    Reload persistence OK ✓');

    console.log('\n✓ All smoke13 tests passed.');
  });
}
