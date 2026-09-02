import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cycleOf,
  cycleRange,
  cycleLabel,
  cycleProgress,
  parseCycle,
  previousCycle,
  nextCycle,
} from '@/lib/cycle';

const at = (s: string) => new Date(`${s}T12:00:00`);

test('cycleOf - các mốc lấy từ Budget.numbers thật', () => {
  // Dữ liệu thật: 24 Jul ghi "July", 27 Jul ghi "August"
  assert.equal(cycleOf(at('2026-07-24')), '2026-07');
  assert.equal(cycleOf(at('2026-07-25')), '2026-08');
  assert.equal(cycleOf(at('2026-07-27')), '2026-08');
  assert.equal(cycleOf(at('2026-08-24')), '2026-08');
  assert.equal(cycleOf(at('2026-08-25')), '2026-09');
  assert.equal(cycleOf(at('2026-09-02')), '2026-09');
  assert.equal(cycleOf(at('2026-04-25')), '2026-05');
  assert.equal(cycleOf(at('2026-03-28')), '2026-04');
});

test('cycleOf - qua năm mới, ca dễ sai nhất', () => {
  assert.equal(cycleOf(at('2026-12-24')), '2026-12');
  assert.equal(cycleOf(at('2026-12-25')), '2027-01');
  assert.equal(cycleOf(at('2026-12-31')), '2027-01');
  assert.equal(cycleOf(at('2027-01-01')), '2027-01');
  assert.equal(cycleOf(at('2027-01-24')), '2027-01');
  assert.equal(cycleOf(at('2027-01-25')), '2027-02');
});

test('cycleOf - biên của ngày, không phụ thuộc giờ', () => {
  assert.equal(cycleOf(new Date('2026-08-24T23:59:59')), '2026-08');
  assert.equal(cycleOf(new Date('2026-08-25T00:00:00')), '2026-09');
});

test('cycleOf - đổi được ngày bắt đầu chu kỳ', () => {
  assert.equal(cycleOf(at('2026-08-01'), 1), '2026-09');
  assert.equal(cycleOf(at('2026-07-31'), 1), '2026-08');
  assert.equal(cycleOf(at('2026-08-14'), 15), '2026-08');
  assert.equal(cycleOf(at('2026-08-15'), 15), '2026-09');
});

test('parseCycle - từ chối rác thay vì đoán', () => {
  assert.deepEqual(parseCycle('2026-09'), { year: 2026, month: 9 });
  for (const bad of ['2026-9', '2026-13', '2026-00', 'September', '', '2026/09']) {
    assert.throws(() => parseCycle(bad), /Invalid cycle id/);
  }
});

test('cycleRange - chu kỳ tháng 9 chạy 25/08 -> 25/09', () => {
  const { startAt, endAt } = cycleRange('2026-09');
  assert.equal(new Date(startAt).toDateString(), new Date(2026, 7, 25).toDateString());
  assert.equal(new Date(endAt).toDateString(), new Date(2026, 8, 25).toDateString());
});

test('cycleRange - tháng 1 lùi về tháng 12 năm trước', () => {
  const { startAt } = cycleRange('2027-01');
  assert.equal(new Date(startAt).getFullYear(), 2026);
  assert.equal(new Date(startAt).getMonth(), 11);
  assert.equal(new Date(startAt).getDate(), 25);
});

test('cycleRange - khớp với cycleOf ở cả hai đầu', () => {
  for (const cycle of ['2026-01', '2026-02', '2026-09', '2026-12', '2027-01']) {
    const { startAt, endAt } = cycleRange(cycle);
    assert.equal(cycleOf(new Date(startAt)), cycle, `đầu chu kỳ ${cycle}`);
    assert.equal(cycleOf(new Date(endAt - 1)), cycle, `cuối chu kỳ ${cycle}`);
    assert.equal(cycleOf(new Date(endAt)), nextCycle(cycle), `sau chu kỳ ${cycle}`);
  }
});

test('cycleLabel - suy ra tên tháng, không lưu trong DB', () => {
  assert.deepEqual(cycleLabel('2026-09'), { month: 'September', year: 2026 });
  assert.deepEqual(cycleLabel('2027-01'), { month: 'January', year: 2027 });
});

test('cycleProgress - ngày thứ mấy / tổng bao nhiêu', () => {
  // Chu kỳ tháng 9: 25/08 -> 25/09 = 31 ngày
  assert.deepEqual(cycleProgress('2026-09', at('2026-08-25')), { day: 1, total: 31 });
  assert.deepEqual(cycleProgress('2026-09', at('2026-09-02')), { day: 9, total: 31 });
  assert.deepEqual(cycleProgress('2026-09', at('2026-09-24')), { day: 31, total: 31 });
  // Kẹp hai đầu
  assert.equal(cycleProgress('2026-09', at('2026-01-01')).day, 1);
  assert.equal(cycleProgress('2026-09', at('2027-01-01')).day, 31);
});

test('previousCycle / nextCycle - qua biên năm', () => {
  assert.equal(previousCycle('2026-01'), '2025-12');
  assert.equal(nextCycle('2026-12'), '2027-01');
  assert.equal(nextCycle(previousCycle('2026-09')), '2026-09');
});
