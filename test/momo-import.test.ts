import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  appendRows,
  buildDrafts,
  checkAgainstExisting,
  flagOf,
  importKey,
  mergeScreenshots,
  parseAmountText,
  parseWhen,
  sanitizeRows,
  type ImportRow,
  type RawRow,
} from '@/lib/momo-import';
import type { Transaction } from '@/types/fina';

const NOW = new Date(2026, 9, 4, 14, 7); // 04/10/2026 14:07

const raw = (title: string, amount: number, time: string, date: string): RawRow => ({
  title, amount, time, date,
});

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't', occurredAt: 0, cycle: '2026-10', bucketId: 'food', bank: 'VCB',
  amountVnd: 25_000, direction: 'out', note: null, source: 'web',
  createdAt: 0, updatedAt: 0, ...over,
});

test('parseWhen - năm lấy theo hôm nay', () => {
  assert.equal(parseWhen('04/10', '13:57', NOW), new Date(2026, 9, 4, 13, 57).getTime());
});

test('parseWhen - ngày ở tương lai thì lùi một năm', () => {
  const jan = new Date(2027, 0, 3, 9, 0);
  assert.equal(parseWhen('28/12', '20:00', jan), new Date(2026, 11, 28, 20, 0).getTime());
});

test('parseWhen - chữ đọc sai thì trả null, không đoán', () => {
  assert.equal(parseWhen('31/02', '10:00', NOW), null);
  assert.equal(parseWhen('4-10', '10:00', NOW), null);
  assert.equal(parseWhen('04/10', '25:00', NOW), null);
});

test('flagOf - tiền về tài khoản mình và tiền vào', () => {
  assert.equal(flagOf('Hoàn tiền về Vietcombank', -80_000), 'self');
  assert.equal(flagOf('Rút tiền về VCB', -100_000), 'self');
  assert.equal(flagOf('Nhận tiền từ A', 50_000), 'income');
  assert.equal(flagOf('Thanh toán cho LE THANH NHO (Vietcombank)', -38_000), null);
  // Nạp tiền điện thoại là chi tiêu thật
  assert.equal(flagOf('Nạp tiền điện thoại Viettel', -50_000), null);
});

test('mergeScreenshots - dòng chồng giữa hai ảnh chỉ tính một lần', () => {
  const a = [
    raw('Chuyển đến NGUYEN THI LANG (MBBank)', -25_000, '13:57', '04/10'),
    raw('Thanh toán cho LE THANH NHO (Vietcombank)', -38_000, '12:08', '03/10'),
  ];
  // Ảnh sau cắt tên khác đi, nhưng vẫn là cùng một dòng
  const b = [
    raw('Thanh toán cho LE THANH NHO (Vietcom…', -38_000, '12:08', '03/10'),
    raw('Thanh toán cho NGUYEN THI LANG (MBBank)', -30_000, '09:09', '03/10'),
  ];
  const r = mergeScreenshots([a, b], NOW);
  assert.equal(r.rows.length, 3);
  assert.equal(r.overlapCount, 1);
  // Mới nhất trước, như MoMo
  assert.deepEqual(r.rows.map((x) => x.amountVnd), [25_000, 38_000, 30_000]);
  assert.ok(r.rows.every((x) => x.bucketId === 'food' && x.direction === 'out'));
});

test('mergeScreenshots - hai dòng giống hệt TRONG một ảnh là hai giao dịch thật', () => {
  const a = [raw('X', -15_000, '08:10', '02/10'), raw('X', -15_000, '08:10', '02/10')];
  const b = [raw('X', -15_000, '08:10', '02/10')];
  const r = mergeScreenshots([a, b], NOW);
  assert.equal(r.rows.length, 2);
  assert.notEqual(r.rows[0].id, r.rows[1].id);
  assert.equal(r.overlapCount, 1);
});

test('mergeScreenshots - dòng không đọc được bị đếm và bỏ', () => {
  const r = mergeScreenshots([[raw('X', -15_000, '??', '02/10')]], NOW);
  assert.equal(r.rows.length, 0);
  assert.equal(r.unreadable, 1);
});

test('checkAgainstExisting - đã import trước thì tách ra', () => {
  const { rows } = mergeScreenshots(
    [[raw('A', -25_000, '13:57', '04/10'), raw('B', -30_000, '09:09', '03/10')]],
    NOW,
  );
  const prev = tx({
    source: 'import',
    amountVnd: 55_000,
    importKeys: [importKey(new Date(2026, 9, 4, 13, 57).getTime(), 'out', 25_000)],
  });
  const r = checkAgainstExisting(rows, [prev]);
  assert.deepEqual(r.imported.map((x) => x.title), ['A']);
  assert.deepEqual(r.kept.map((x) => x.title), ['B']);
});

test('checkAgainstExisting - giống giao dịch nhập tay thì giữ, chỉ gắn nhãn, mỗi cái một lần', () => {
  const { rows } = mergeScreenshots(
    [[raw('A', -35_000, '12:00', '04/10'), raw('B', -35_000, '11:50', '04/10')]],
    NOW,
  );
  const manual = tx({ id: 'm1', amountVnd: 35_000, occurredAt: new Date(2026, 9, 4, 12, 30).getTime() });
  const r = checkAgainstExisting(rows, [manual]);
  assert.equal(r.imported.length, 0);
  assert.equal(r.kept.length, 2);
  assert.equal(r.kept[0].flag, 'manual');
  assert.equal(r.kept[0].lookalike?.occurredAt, manual.occurredAt);
  assert.equal(r.kept[1].flag, null);
});

test('checkAgainstExisting - lệch quá 3 giờ thì không coi là giống', () => {
  const { rows } = mergeScreenshots([[raw('A', -35_000, '08:00', '04/10')]], NOW);
  const manual = tx({ amountVnd: 35_000, occurredAt: new Date(2026, 9, 4, 12, 0).getTime() });
  assert.equal(checkAgainstExisting(rows, [manual]).kept[0].flag, null);
});

const row = (over: Partial<ImportRow>): ImportRow => ({
  id: Math.random().toString(), key: 'k', occurredAt: new Date(2026, 9, 3, 10, 0).getTime(),
  title: 'x', amountVnd: 10_000, direction: 'out', bucketId: 'food', note: '',
  flag: null, lookalike: null, ...over,
});

test('buildDrafts - gộp theo mục, dòng có note giữ riêng', () => {
  const rows = [
    row({ key: 'a', amountVnd: 25_000 }),
    row({ key: 'b', amountVnd: 38_000, occurredAt: new Date(2026, 9, 4, 9, 0).getTime() }),
    row({ key: 'c', amountVnd: 50_000, bucketId: 'social' }),
    row({ key: 'd', amountVnd: 100_000, note: 'Khách sạn Cà Si' }),
  ];
  const d = buildDrafts(rows, true);
  assert.equal(d.length, 3);
  const food = d.find((x) => x.bucketId === 'food' && x.note?.startsWith('MoMo'))!;
  assert.equal(food.amountVnd, 63_000);
  assert.deepEqual(food.importKeys, ['a', 'b']);
  assert.equal(food.occurredAt, new Date(2026, 9, 4, 9, 0).getTime());
  assert.ok(d.some((x) => x.note === 'Khách sạn Cà Si' && x.amountVnd === 100_000));
  assert.ok(d.some((x) => x.bucketId === 'social' && x.note === null));
});

test('buildDrafts - gộp tách theo chu kỳ (ngày 24 và 25)', () => {
  const rows = [
    row({ key: 'a', occurredAt: new Date(2026, 9, 24, 20, 0).getTime() }),
    row({ key: 'b', occurredAt: new Date(2026, 9, 25, 8, 0).getTime() }),
  ];
  assert.equal(buildDrafts(rows, true).length, 2);
});

test('buildDrafts - tiền vào không gộp chung với tiền ra', () => {
  const rows = [row({ key: 'a' }), row({ key: 'b', direction: 'in' })];
  assert.equal(buildDrafts(rows, true).length, 2);
});

test('buildDrafts - tách từng dòng giữ đủ note', () => {
  const rows = [row({ key: 'a' }), row({ key: 'b', note: ' trà ' })];
  const d = buildDrafts(rows, false);
  assert.equal(d.length, 2);
  assert.ok(d.some((x) => x.note === 'trà'));
  assert.ok(d.some((x) => x.note === null));
});

test('parseAmountText - chữ tiền MoMo ra số có dấu', () => {
  assert.equal(parseAmountText('-330.000đ'), -330_000);
  assert.equal(parseAmountText('-11.200đ'), -11_200);
  assert.equal(parseAmountText('+1.200.000đ'), 1_200_000);
  assert.equal(parseAmountText('\u2212 25.000 ₫'), -25_000);
  // Không có dấu: MoMo luôn in '+' cho tiền vào, nên đây là tiền ra
  assert.equal(parseAmountText('50.000đ'), -50_000);
  assert.equal(parseAmountText('-25.5đ'), null);
  assert.equal(parseAmountText('-0đ'), null);
  assert.equal(parseAmountText('abc'), null);
});

test('sanitizeRows - bỏ dòng sai hình dạng', () => {
  const out = sanitizeRows({
    rows: [
      { title: 'ok', amount: '-25.000đ', time: '13:57', date: '04/10' },
      { title: 'number', amount: -25000, time: '13:57', date: '04/10' },
      { title: 'zero', amount: '0đ', time: '13:57', date: '04/10' },
      { amount: '-1.000đ', time: '13:57', date: '04/10' },
      null,
    ],
  });
  assert.deepEqual(out.map((r) => [r.title, r.amount]), [['ok', -25_000]]);
  assert.deepEqual(sanitizeRows('nonsense'), []);
});

test('appendRows - upload thêm ảnh: dòng đã có trong bảng không lặp lại', () => {
  const first = mergeScreenshots([[raw('A', -25_000, '13:57', '04/10'), raw('B', -35_000, '21:14', '03/10')]], NOW).rows;
  const more = mergeScreenshots([[raw('B', -35_000, '21:14', '03/10'), raw('C', -15_000, '08:10', '02/10')]], NOW).rows;
  assert.deepEqual(appendRows(first, more).map((r) => r.title), ['C']);
});

test('appendRows - khoá có thêm bản thứ hai thì thêm, với id mới không trùng', () => {
  const first = mergeScreenshots([[raw('X', -15_000, '08:10', '02/10')]], NOW).rows;
  const more = mergeScreenshots([[raw('X', -15_000, '08:10', '02/10'), raw('X', -15_000, '08:10', '02/10')]], NOW).rows;
  const added = appendRows(first, more);
  assert.equal(added.length, 1);
  assert.notEqual(added[0].id, first[0].id);
});
