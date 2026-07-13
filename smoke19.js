/* smoke19.js — Round 20 number-formatting regression.
 *
 * User report: "there are a lot of ui bugs to be resolve as it went out of
 * the screen ... some of them are out of shape." Root-caused (via a
 * Playwright sweep at a narrower 375px viewport, the common small-phone
 * width) to GameNumbers.formatNumber() producing strings too long for the
 * 4-chip header resource strip once Qi/money climbed into the compound-
 * suffix tiers ('Dc'/'Vg', tier 10+): a value like 999.99e35 rendered as
 * "999.99Dc" or a rounding edge case like 9.999e23 rendered as "1000.00Sx"
 * (rounded up across a tier boundary without bumping the suffix) — both
 * overflow a chip that only has ~60px for the value text.
 *
 * Fixed by capping the mantissa+decimals budget to ~3 significant digits
 * (fewer decimals as the mantissa's own digit count grows), dropping
 * decimals entirely for the longest (4-character) compound suffixes, and
 * correctly bumping to the next tier when rounding pushes a mantissa to
 * "1000" — including at the very last table entry, where it now falls
 * through to the (also-compacted) scientific-notation fallback instead of
 * displaying an out-of-range 4-digit mantissa.
 */
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };

global.window = global;
eval(require('fs').readFileSync('www/js/numbers.js', 'utf8'));

console.log('Testing Round 20 number-formatting fix...');

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — Normal-range formatting is unchanged (the vast majority of
// what players actually see during real play)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 1: Normal-range formatting unchanged');
assert(formatNumber(0) === '0', 'zero');
assert(formatNumber(9.5) === '9.5', 'sub-10 one-decimal');
assert(formatNumber(999) === '999', 'sub-1000 whole');
assert(formatNumber(1234) === '1.23K', 'K tier, 2 decimals');
assert(formatNumber(1000000) === '1.00M', 'M tier, exact');
assert(formatNumber(1500000000) === '1.50B', 'B tier');
assert(formatNumber(-5000) === '-5.00K', 'negative sign preserved');
console.log('    Everyday-range values format exactly as before ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — No formatted string exceeds a safe length across the entire
// realistic-to-extreme range, at every mantissa shape (round numbers,
// near-tier-boundary numbers, and rounding-edge-case numbers)
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 2: Formatted length is bounded across the full range');
{
  let maxLen = 0, worst = '';
  for (let e = 0; e <= 320; e += 0.17) {
    for (const mult of [1, 1.5, 9.999, 99.99, 999.999, 5.5, 9.9994, 9.9995, 9.9996, 999.9996]) {
      const v = mult * Math.pow(10, e);
      if (!isFinite(v)) continue;
      const s = formatNumber(v);
      if (s.length > maxLen) { maxLen = s.length; worst = `${v} -> ${s}`; }
    }
  }
  // 7 chars is what empirically fits the tightest real chip (the 4-chip
  // header strip at a 375px viewport) with margin to spare; see round19's
  // Playwright verification. Regressing past this silently reintroduces
  // the clipping bug.
  assert(maxLen <= 7, `no formatted number exceeds 7 characters (worst: ${worst}, len ${maxLen})`);
}
console.log('    Max formatted length stays <=7 chars across the whole exponent range ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — Rounding across a tier boundary bumps the suffix instead of
// producing an out-of-range 4-digit mantissa
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 3: Rounding-boundary values bump tier correctly');
{
  const cases = [
    [9999, 'K'],       // 9.999K would round to "10.0K" — must not show "10.00K" or overflow
    [999999, 'M'],     // 999.999K rounds up -> bumps to M
    [9.999e23, 'Sp'],  // 999.9Sx rounds up -> bumps to Sp (the actual reported bug)
  ];
  cases.forEach(([v, expectSuffix]) => {
    const s = formatNumber(v);
    assert(s.endsWith(expectSuffix), `${v} formats with the bumped suffix '${expectSuffix}' (got '${s}')`);
    assert(!/1000/.test(s), `${v} never shows a literal "1000" mantissa (got '${s}')`);
  });
}
console.log('    Tier-boundary rounding bumps the suffix, never shows an out-of-range mantissa ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 4 — Rounding past the very last suffix table entry falls through to
// scientific notation instead of an invalid mantissa
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 4: Rounding past the last tier falls through to scientific notation');
{
  const s = formatNumber(9.999e92); // rounds to 1000 at the NoVg (last) tier
  assert(/^\d+e\+\d+$/.test(s), `rounds past the last suffix into scientific notation (got '${s}')`);
  assert(!s.includes('NoVg'), 'does not display an invalid "1000NoVg"');
}
console.log('    Last-tier rounding overflow falls through cleanly ✓');

// ════════════════════════════════════════════════════════════════════════
// TEST 5 — formatRate()/formatDuration() still delegate correctly
// ════════════════════════════════════════════════════════════════════════
console.log('\n  Test 5: formatRate() and formatDuration() unaffected');
assert(formatRate(1500) === '1.50K/s', 'formatRate appends /s to formatNumber output');
assert(formatDuration(3725) === '1h 2m 5s', 'formatDuration unaffected by the numbers.js changes');
console.log('    formatRate()/formatDuration() still work correctly ✓');

console.log('\n✓ All smoke19 tests passed.');
