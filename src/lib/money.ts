// ============================================================
// fina - Money
//
// The DB stores INTEGER VND. The user types and reads in THOUSANDS.
//   type "25"      -> 25_000 đ
//   type "155.36"  -> 155_360 đ
//   show 155_360   -> "155,36"   (VN locale: '.' groups thousands, ',' is decimal)
//
// Why not floats: summing many floats drifts
// (25.3 + 155.36 + 5020.4 = 5201.060000000001) and cannot be undone.
// ============================================================

/** 1 typed unit = 1.000 đ */
const UNIT = 1000;

/** .001 thousand = 1 đ. Nothing smaller exists. */
const MAX_DECIMALS = 3;

/**
 * Parses what the user typed into integer VND.
 * Accepts both '.' and ',' as the decimal mark - the Vietnamese iOS keyboard forces ','.
 * Returns null when it is not a valid number, or is 0.
 */
export function toVnd(input: string): number | null {
  const raw = input.trim().replace(',', '.');
  if (raw === '' || raw === '.') return null;
  if (!/^\d*\.?\d*$/.test(raw)) return null;

  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;

  // '0.0004' is a valid positive number but rounds to 0đ. A 0-dong
  // transaction means nothing, and Firestore rules also reject amountVnd <= 0.
  const vnd = Math.round(n * UNIT);
  return vnd > 0 ? vnd : null;
}

/**
 * Integer VND -> string for retyping / round-trip. '.' as the decimal mark,
 * no thousands grouping. 155_360 -> '155.36'
 */
export function fromVnd(vnd: number): string {
  const units = vnd / UNIT;
  // toFixed, then trim trailing zeros: 155.360 -> '155.36', 25.000 -> '25'
  return units
    .toFixed(MAX_DECIMALS)
    .replace(/\.?0+$/, '');
}

/**
 * Integer VND -> display string in the VN locale.
 * 155_360 -> '155,36' ; 2_975_000 -> '2.975' ; -300_000 -> '-300'
 */
export function formatVnd(vnd: number): string {
  return (vnd / UNIT).toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: MAX_DECIMALS,
  });
}

/** The amount being typed - the part after the last plus/minus. */
function lastTerm(s: string): string {
  const at = Math.max(s.lastIndexOf('+'), s.lastIndexOf('-'));
  return at === -1 ? s : s.slice(at + 1);
}

/**
 * Appends one numpad key to the string being typed.
 * Keeps all typing rules in one place so components know nothing about money.
 *
 * Every limit (digit count, one decimal mark) applies to EACH amount, not the
 * whole string: '25.5+3.2' is two valid amounts, not one number with two dots.
 */
export function pressKey(current: string, key: string): string {
  if (key === 'del') return current.slice(0, -1);

  if (key === '+' || key === '-') {
    // No leading sign: the field is an amount of money, not a negative number.
    if (current === '') return current;
    // A sign right after another sign = changed mind, replace instead of append.
    if (/[+-]$/.test(current)) return current.slice(0, -1) + key;
    // '25.' is not a finished amount yet.
    if (current.endsWith('.')) return current;
    return current + key;
  }

  if (key === '.') {
    const term = lastTerm(current);
    if (term === '' || term.includes('.')) return current;
    return `${current}.`;
  }

  if (!/^\d$/.test(key)) return current;

  const term = lastTerm(current);
  const [whole, decimals] = term.split('.');
  // Block it while typing, instead of silently rounding on save.
  if (decimals !== undefined && decimals.length >= MAX_DECIMALS) return current;
  if (decimals === undefined && whole.length >= 7) return current;
  // '0' -> '05' is meaningless; replace it.
  if (term === '0') return current.slice(0, -1) + key;

  return current + key;
}

/** One amount inside an expression. Allows 0, unlike `toVnd`. */
function termToVnd(term: string): number | null {
  const raw = term.trim();
  if (raw === '' || raw === '.') return null;
  if (!/^\d*\.?\d*$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * UNIT);
}

/**
 * Combines several small amounts in ONE entry: '25+30.5-4' -> 51.500đ.
 *
 * Three coffees in a morning are three app opens; typing '25+30+18' is one.
 *
 * Sums in INTEGER VND, rounding each amount BEFORE adding - never adds floats
 * and then multiplies by 1000. In JS 0.1 + 0.2 is 0.30000000000000004, and
 * money must not drift (see the top of the file).
 *
 * Returns null when the string is unfinished ('25+'), malformed, or the total
 * is <= 0 - same rule as `toVnd`, so Save stays locked until typing is done.
 */
export function evalAmount(input: string): number | null {
  const raw = input.trim().replace(/,/g, '.');
  if (raw === '') return null;
  if (/^[+-]/.test(raw)) return null;

  let total = 0;
  // Split but KEEP the signs: '25+30-4' -> ['25', '+30', '-4']
  for (const part of raw.split(/(?=[+-])/)) {
    const signed = /^[+-]/.test(part);
    const value = termToVnd(signed ? part.slice(1) : part);
    if (value === null) return null;
    total += (part.startsWith('-') ? -1 : 1) * value;
  }
  return total > 0 ? total : null;
}
