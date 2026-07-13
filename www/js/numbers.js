/* ===========================================================================
 * numbers.js — Big-number formatting for the idle game.
 * Turns 1234567 into "1.23M", 1.5e15 into "1.50Qa", etc.
 * Uses plain JS doubles (good up to ~1e308). If the game economy ever needs
 * to exceed that, swap in break_infinity.js — formatNumber() is the only
 * place the UI reads numbers, so the rest of the code won't need changes.
 * ========================================================================= */

// Suffixes for the "short scale" naming used by most idle games.
const NUMBER_SUFFIXES = [
  '', 'K', 'M', 'B', 'T',
  'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No',
  'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc',
  'Vg', 'UVg', 'DVg', 'TVg', 'QaVg', 'QiVg', 'SxVg', 'SpVg', 'OcVg', 'NoVg',
];

/**
 * Format a mantissa (1 <= scaled < 1000) at a decimal count that keeps the
 * whole mantissa+decimals string to ~3 significant digits, and is stable
 * under rounding: toFixed() can round a mantissa up across a digit-count
 * boundary (9.999 -> "10.00" at 2 decimals, or 999.5 -> "1000" at 0), which
 * would otherwise silently produce a too-long or out-of-range string. This
 * re-checks the digit count of the ROUNDED result and drops a decimal (or
 * signals a tier bump via `null`) until it's stable.
 * @returns {string|null} the formatted mantissa, or null if it rounds to
 *   >=1000 with no decimals left (caller must bump to the next tier).
 */
function formatMantissa(scaled, maxDecimals) {
  let d = maxDecimals;
  for (let i = 0; i < 4; i++) {
    const digits = Math.floor(parseFloat(scaled.toFixed(d))).toString().length;
    const nd = Math.max(0, Math.min(maxDecimals, 3 - digits));
    if (nd === d) break;
    d = nd;
  }
  const str = scaled.toFixed(d);
  return parseFloat(str) >= 1000 ? null : str;
}

/**
 * Format a number for display.
 * @param {number} value
 * @param {number} decimals  How many decimals for the mantissa (default 2).
 * @returns {string}
 */
function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return '0';
  if (!isFinite(value)) return '∞';

  const negative = value < 0;
  value = Math.abs(value);

  // Small numbers: show whole, or one decimal under 10.
  if (value < 1000) {
    if (value < 10 && value % 1 !== 0) {
      return (negative ? '-' : '') + value.toFixed(1);
    }
    return (negative ? '-' : '') + Math.floor(value).toString();
  }

  // Pick the right suffix tier (1000^tier).
  let tier = Math.floor(Math.log10(value) / 3);

  if (tier < NUMBER_SUFFIXES.length) {
    // The compound suffixes from 'Dc' onward run 3-4 characters ("QaDc",
    // "NoVg") — long enough that even a short 1-digit mantissa at full
    // decimal precision ("1.32QaDc") can overflow tight UI (the header
    // strip). Cap decimals a bit further whenever the suffix itself is long.
    const maxDFor = t => (NUMBER_SUFFIXES[t].length >= 4 ? 0 : decimals);
    let str = formatMantissa(value / Math.pow(1000, tier), maxDFor(tier));
    // Rounding pushed the mantissa to "1000" with nothing left to trim —
    // bump to the next tier and reformat there instead (999.5 -> "1.00" of
    // the next suffix, not an out-of-range "1000" of this one).
    if (str === null && tier + 1 < NUMBER_SUFFIXES.length) {
      tier += 1;
      str = formatMantissa(value / Math.pow(1000, tier), maxDFor(tier));
    }
    if (str !== null) return (negative ? '-' : '') + str + NUMBER_SUFFIXES[tier];
    // At the very last tier, rounding still has nowhere to go — fall
    // through to the scientific-notation path below.
  }

  // Beyond our suffix table: fall back to scientific notation, always compact
  // (an exponent can run to 3 digits, so there's no room for a mantissa decimal).
  return (negative ? '-' : '') + value.toExponential(0);
}

/**
 * Format a per-second rate, e.g. "12.50M/s".
 */
function formatRate(value) {
  return formatNumber(value) + '/s';
}

/**
 * Format a duration in seconds into a human string, e.g. "2h 13m 5s".
 */
function formatDuration(totalSeconds) {
  totalSeconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts = [];
  if (h > 0) parts.push(h + 'h');
  if (m > 0) parts.push(m + 'm');
  parts.push(s + 's');
  return parts.join(' ');
}

window.GameNumbers = { formatNumber, formatRate, formatDuration };
