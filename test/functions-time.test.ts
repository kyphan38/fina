import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayKey, daysBetween, isReminderWindow, vnParts } from '../functions/src/time.ts';

/**
 * functions/ deploy riêng và không import được code trong src/, nên nó giữ
 * bản sao của luật giờ. Test này đối chiếu bản sao đó với Intl giờ này qua
 * giờ khác - đổi một bên mà quên bên kia thì đây là chỗ báo.
 */
const UTC7 = 7 * 3600_000;

test('vnParts khớp với Intl suốt 48 giờ liên tiếp', () => {
  const start = Date.UTC(2026, 8, 1, 0, 0, 0);
  for (let h = 0; h < 48; h++) {
    const d = new Date(start + h * 3600_000);
    const p = vnParts(d);
    // Việt Nam là UTC+7 cố định, không có giờ mùa hè.
    const shifted = new Date(d.getTime() + UTC7);
    assert.equal(p.year, shifted.getUTCFullYear(), `giờ ${h}`);
    assert.equal(p.month, shifted.getUTCMonth() + 1, `giờ ${h}`);
    assert.equal(p.day, shifted.getUTCDate(), `giờ ${h}`);
    assert.equal(p.hour, shifted.getUTCHours(), `giờ ${h}`);
  }
});

test('vnParts qua biên năm mới', () => {
  // 31/12/2026 18:00 UTC = 01/01/2027 01:00 giờ Việt Nam
  const p = vnParts(new Date(Date.UTC(2026, 11, 31, 18, 0)));
  assert.deepEqual(
    { year: p.year, month: p.month, day: p.day, hour: p.hour },
    { year: 2027, month: 1, day: 1, hour: 1 },
  );
});

test('nửa đêm giờ Việt Nam ra hour 0, không phải 24', () => {
  // 17:00 UTC = 00:00 hôm sau ở VN
  assert.equal(vnParts(new Date(Date.UTC(2026, 8, 1, 17, 0))).hour, 0);
});

test('dayKey theo ngày Việt Nam, không theo UTC', () => {
  // 01/09 18:00 UTC vẫn là 02/09 ở Việt Nam
  assert.equal(dayKey(new Date(Date.UTC(2026, 8, 1, 18, 0))), '2026-09-02');
  assert.equal(dayKey(new Date(Date.UTC(2026, 8, 1, 16, 0))), '2026-09-01');
});

test('isReminderWindow bắt trọn khung 15 phút quanh 22:00 VN', () => {
  // 22:00 VN = 15:00 UTC
  const at = (h: number, m: number) => new Date(Date.UTC(2026, 8, 2, h, m));
  assert.equal(isReminderWindow(at(15, 0), 22, 15), true);
  assert.equal(isReminderWindow(at(15, 14), 22, 15), true);
  assert.equal(isReminderWindow(at(15, 15), 22, 15), false);
  assert.equal(isReminderWindow(at(14, 59), 22, 15), false);
  assert.equal(isReminderWindow(at(16, 0), 22, 15), false);
});

test('daysBetween đếm ngày trọn vẹn', () => {
  const d = 86_400_000;
  assert.equal(daysBetween(0, d * 2), 2);
  assert.equal(daysBetween(0, d * 2 - 1), 1);
  assert.equal(daysBetween(0, 0), 0);
});
