import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayKey, daysBetween, isReminderWindow, vnParts } from '../functions/src/time.ts';

/**
 * functions/ deploys separately and cannot import code from src/, so it keeps
 * a copy of the time rules. This test checks that copy against Intl hour by
 * hour - change one side and forget the other, and this is where it fails.
 */
const UTC7 = 7 * 3600_000;

test('vnParts matches Intl for 48 hours in a row', () => {
  const start = Date.UTC(2026, 8, 1, 0, 0, 0);
  for (let h = 0; h < 48; h++) {
    const d = new Date(start + h * 3600_000);
    const p = vnParts(d);
    // Vietnam is fixed UTC+7, no daylight saving.
    const shifted = new Date(d.getTime() + UTC7);
    assert.equal(p.year, shifted.getUTCFullYear(), `hour ${h}`);
    assert.equal(p.month, shifted.getUTCMonth() + 1, `hour ${h}`);
    assert.equal(p.day, shifted.getUTCDate(), `hour ${h}`);
    assert.equal(p.hour, shifted.getUTCHours(), `hour ${h}`);
  }
});

test('vnParts across New Year', () => {
  // 31/12/2026 18:00 UTC = 01/01/2027 01:00 Vietnam time
  const p = vnParts(new Date(Date.UTC(2026, 11, 31, 18, 0)));
  assert.deepEqual(
    { year: p.year, month: p.month, day: p.day, hour: p.hour },
    { year: 2027, month: 1, day: 1, hour: 1 },
  );
});

test('midnight in Vietnam is hour 0, not 24', () => {
  // 17:00 UTC = 00:00 the next day in Vietnam
  assert.equal(vnParts(new Date(Date.UTC(2026, 8, 1, 17, 0))).hour, 0);
});

test('dayKey follows the Vietnam date, not UTC', () => {
  // 01/09 18:00 UTC is already 02/09 in Vietnam
  assert.equal(dayKey(new Date(Date.UTC(2026, 8, 1, 18, 0))), '2026-09-02');
  assert.equal(dayKey(new Date(Date.UTC(2026, 8, 1, 16, 0))), '2026-09-01');
});

test('isReminderWindow catches the whole 15-minute window around 22:00 VN', () => {
  // 22:00 VN = 15:00 UTC
  const at = (h: number, m: number) => new Date(Date.UTC(2026, 8, 2, h, m));
  assert.equal(isReminderWindow(at(15, 0), 22, 15), true);
  assert.equal(isReminderWindow(at(15, 14), 22, 15), true);
  assert.equal(isReminderWindow(at(15, 15), 22, 15), false);
  assert.equal(isReminderWindow(at(14, 59), 22, 15), false);
  assert.equal(isReminderWindow(at(16, 0), 22, 15), false);
});

test('daysBetween counts whole days', () => {
  const d = 86_400_000;
  assert.equal(daysBetween(0, d * 2), 2);
  assert.equal(daysBetween(0, d * 2 - 1), 1);
  assert.equal(daysBetween(0, 0), 0);
});
