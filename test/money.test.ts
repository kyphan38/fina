import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evalAmount, formatVnd, fromVnd, pressKey, toVnd } from '@/lib/money';

test('toVnd - typed in thousands, stored as integer VND', () => {
  assert.equal(toVnd('25'), 25_000);
  assert.equal(toVnd('155.36'), 155_360);
  assert.equal(toVnd('0.5'), 500);
  assert.equal(toVnd('5020.4'), 5_020_400);
});

test('toVnd - accepts a comma too (Vietnamese iOS keyboard)', () => {
  assert.equal(toVnd('155,36'), toVnd('155.36'));
  assert.equal(toVnd('32,142'), 32_142);
});

test('toVnd - rounds to whole dong, no fractions left', () => {
  assert.equal(toVnd('25.3456'), 25_346);
  assert.equal(Number.isInteger(toVnd('123.456')), true);
});

test('toVnd - rejects junk and zero', () => {
  // '0.0004' is positive but rounds to 0đ - must still be rejected.
  for (const bad of ['', ' ', '.', 'abc', '12abc', '-5', '1.2.3', '0', '0.0', '0.0004']) {
    assert.equal(toVnd(bad), null, `must reject: "${bad}"`);
  }
});

test('fromVnd - trims trailing zeros', () => {
  assert.equal(fromVnd(25_000), '25');
  assert.equal(fromVnd(155_360), '155.36');
  assert.equal(fromVnd(500), '0.5');
  assert.equal(fromVnd(32_142), '32.142');
});

test('round-trip on 20 real values from Budget.numbers', () => {
  const real = [
    15_000, 272_093, 5_020_400, 155_360, 32_142, 4_205_471, 990_000, 25_000,
    197_963, 302_200, 637_600, 163_098, 2_266_800, 168_150, 77_250, 175_513,
    434_962, 2_112_525, 213_213, 248_540,
  ];
  for (const vnd of real) {
    assert.equal(toVnd(fromVnd(vnd)), vnd, `round-trip broke at ${vnd}`);
  }
});

test('formatVnd - VN locale: dot groups thousands, comma is decimal', () => {
  assert.equal(formatVnd(155_360), '155,36');
  assert.equal(formatVnd(2_975_000), '2.975');
  assert.equal(formatVnd(25_000), '25');
  assert.equal(formatVnd(-300_000), '-300');
});

test('pressKey - normal digits', () => {
  assert.equal(pressKey('', '2'), '2');
  assert.equal(pressKey('2', '5'), '25');
  assert.equal(pressKey('25', '.'), '25.');
  assert.equal(pressKey('25.', '3'), '25.3');
});

test('pressKey - backspace', () => {
  assert.equal(pressKey('25.3', 'del'), '25.');
  assert.equal(pressKey('2', 'del'), '');
  assert.equal(pressKey('', 'del'), '');
});

test('pressKey - blocks a second dot and a leading dot', () => {
  assert.equal(pressKey('25.3', '.'), '25.3');
  assert.equal(pressKey('', '.'), '');
});

test('pressKey - at most 3 decimals, at most 7 integer digits', () => {
  assert.equal(pressKey('1.234', '5'), '1.234');
  assert.equal(pressKey('1234567', '8'), '1234567');
  assert.equal(pressKey('123456', '7'), '1234567');
});

test('pressKey - a leading 0 is replaced, never "05"', () => {
  assert.equal(pressKey('0', '5'), '5');
  assert.equal(pressKey('0', '.'), '0.');
});

// ---------------------------------------------------------------
// Combining several small amounts in one entry
// ---------------------------------------------------------------

test('evalAmount - adds several amounts: three coffees in a morning', () => {
  assert.equal(evalAmount('25+30+18'), 73_000);
});

test('evalAmount - can subtract, for taking back a mistake', () => {
  assert.equal(evalAmount('100-25'), 75_000);
  assert.equal(evalAmount('25+30.5-4'), 51_500);
});

test('evalAmount - a plain number gives the same as toVnd', () => {
  assert.equal(evalAmount('155.36'), toVnd('155.36'));
  assert.equal(evalAmount('25'), 25_000);
});

test('evalAmount - rounds EACH amount before adding, no float drift', () => {
  // In JS 0.1 + 0.2 is 0.30000000000000004. Adding floats then multiplying
  // by 1000 gives 300.00000000000006, and Firestore rules reject non-integers.
  const v = evalAmount('0.1+0.2');
  assert.equal(v, 300);
  assert.ok(Number.isInteger(v));
});

test('evalAmount - a comma is a decimal mark too (Vietnamese keyboard)', () => {
  assert.equal(evalAmount('25,5+4,5'), 30_000);
});

test('evalAmount - an unfinished string cannot be saved yet', () => {
  assert.equal(evalAmount('25+'), null);
  assert.equal(evalAmount('25+-'), null);
  assert.equal(evalAmount(''), null);
});

test('evalAmount - no leading sign, and the total must be positive', () => {
  // The direction lives on the OUT/IN button, not in the number's sign.
  assert.equal(evalAmount('-25'), null);
  assert.equal(evalAmount('25-25'), null);
  assert.equal(evalAmount('25-30'), null);
});

test('pressKey - the decimal mark counts per amount, not per string', () => {
  // '25.5+3.2' is two valid amounts, not one number with two dots.
  assert.equal(pressKey('25.5+3', '.'), '25.5+3.');
  assert.equal(pressKey('25.5+3.2', '.'), '25.5+3.2');
});

test('pressKey - no leading sign; two signs in a row replace, not append', () => {
  assert.equal(pressKey('', '+'), '');
  assert.equal(pressKey('25+', '-'), '25-');
  assert.equal(pressKey('25.', '+'), '25.');
});

test('pressKey - the digit limit applies to the current amount, not the string', () => {
  assert.equal(pressKey('1234567+12', '3'), '1234567+123');
  assert.equal(pressKey('25+0', '5'), '25+5');
});
