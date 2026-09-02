import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toVnd, fromVnd, formatVnd, pressKey } from '@/lib/money';

test('toVnd - gõ theo nghìn, lưu ra VND nguyên', () => {
  assert.equal(toVnd('25'), 25_000);
  assert.equal(toVnd('155.36'), 155_360);
  assert.equal(toVnd('0.5'), 500);
  assert.equal(toVnd('5020.4'), 5_020_400);
});

test('toVnd - nhận cả dấu phẩy (bàn phím iOS tiếng Việt)', () => {
  assert.equal(toVnd('155,36'), toVnd('155.36'));
  assert.equal(toVnd('32,142'), 32_142);
});

test('toVnd - làm tròn về đồng, không để lại số lẻ', () => {
  assert.equal(toVnd('25.3456'), 25_346);
  assert.equal(Number.isInteger(toVnd('123.456')), true);
});

test('toVnd - từ chối rác và số 0', () => {
  // '0.0004' là số dương nhưng làm tròn về 0đ - vẫn phải từ chối.
  for (const bad of ['', ' ', '.', 'abc', '12abc', '-5', '1.2.3', '0', '0.0', '0.0004']) {
    assert.equal(toVnd(bad), null, `phải từ chối: "${bad}"`);
  }
});

test('fromVnd - cắt số 0 thừa', () => {
  assert.equal(fromVnd(25_000), '25');
  assert.equal(fromVnd(155_360), '155.36');
  assert.equal(fromVnd(500), '0.5');
  assert.equal(fromVnd(32_142), '32.142');
});

test('round-trip trên 20 giá trị thật từ Budget.numbers', () => {
  const real = [
    15_000, 272_093, 5_020_400, 155_360, 32_142, 4_205_471, 990_000, 25_000,
    197_963, 302_200, 637_600, 163_098, 2_266_800, 168_150, 77_250, 175_513,
    434_962, 2_112_525, 213_213, 248_540,
  ];
  for (const vnd of real) {
    assert.equal(toVnd(fromVnd(vnd)), vnd, `round-trip hỏng ở ${vnd}`);
  }
});

test('formatVnd - locale VN: dấu chấm nhóm nghìn, phẩy thập phân', () => {
  assert.equal(formatVnd(155_360), '155,36');
  assert.equal(formatVnd(2_975_000), '2.975');
  assert.equal(formatVnd(25_000), '25');
  assert.equal(formatVnd(-300_000), '-300');
});

test('pressKey - gõ số bình thường', () => {
  assert.equal(pressKey('', '2'), '2');
  assert.equal(pressKey('2', '5'), '25');
  assert.equal(pressKey('25', '.'), '25.');
  assert.equal(pressKey('25.', '3'), '25.3');
});

test('pressKey - xoá lùi', () => {
  assert.equal(pressKey('25.3', 'del'), '25.');
  assert.equal(pressKey('2', 'del'), '');
  assert.equal(pressKey('', 'del'), '');
});

test('pressKey - chặn dấu chấm thứ hai và dấu chấm mở đầu', () => {
  assert.equal(pressKey('25.3', '.'), '25.3');
  assert.equal(pressKey('', '.'), '');
});

test('pressKey - tối đa 3 số lẻ, tối đa 7 số nguyên', () => {
  assert.equal(pressKey('1.234', '5'), '1.234');
  assert.equal(pressKey('1234567', '8'), '1234567');
  assert.equal(pressKey('123456', '7'), '1234567');
});

test('pressKey - số 0 mở đầu bị thay, không thành "05"', () => {
  assert.equal(pressKey('0', '5'), '5');
  assert.equal(pressKey('0', '.'), '0.');
});
