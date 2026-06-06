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
  const tier = Math.floor(Math.log10(value) / 3);

  if (tier < NUMBER_SUFFIXES.length) {
    const scaled = value / Math.pow(1000, tier);
    return (negative ? '-' : '') + scaled.toFixed(decimals) + NUMBER_SUFFIXES[tier];
  }

  // Beyond our suffix table: fall back to scientific notation.
  return (negative ? '-' : '') + value.toExponential(decimals);
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
