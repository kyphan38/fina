import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allowedNumbers, buildDigest, digestHash, type Digest } from '@/lib/digest';
import { sanitizeInsight } from '@/lib/insight-sanitize';
import { computeSignals, type CycleFacts } from '@/lib/signals';
import { SEED_BUCKETS, type Bucket } from '@/types/fina';

const K = 1000;
const buckets: Bucket[] = SEED_BUCKETS.map((s) => ({
  ...s, balanceVnd: 0, active: true, createdAt: 0, updatedAt: 0,
}));

const cycle = (id: string, food: number, closed = true): CycleFacts => ({
  id, closed,
  byBucket: { food: food * K }, limits: { food: 3_000 * K },
});

const signals = computeSignals({
  cycles: [cycle('2026-06', 1_000), cycle('2026-07', 2_000), cycle('2026-08', 3_000), cycle('2026-09', 1_890, false)],
  buckets, amounts: [], day: 9, totalDays: 30,
});
const digest = buildDigest(signals);

test('digest gửi tiền theo NGHÌN, không gửi ghi chú hay ngày', () => {
  const food = digest.buckets.find((b) => b.name === 'Food')!;
  assert.equal(food.spent, 1_890);
  assert.equal(food.limit, 3_000);
  const json = JSON.stringify(digest);
  assert.ok(!/note|occurredAt|bucketId/.test(json), 'digest lộ trường không được gửi');
});

test('digestHash: cùng dữ liệu cùng hash, khác dữ liệu khác hash', () => {
  assert.equal(digestHash(digest), digestHash(buildDigest(signals)));
  const other: Digest = { ...digest, day: 10 };
  assert.notEqual(digestHash(digest), digestHash(other));
});

test('giữ câu chỉ nhắc số có trong digest', () => {
  const r = sanitizeInsight(
    ['Food is at 1.890 of 3.000 on day 9 of 30.'],
    digest,
  );
  assert.equal(r.kept.length, 1);
  assert.equal(r.dropped.length, 0);
});

test('vứt câu có con số model tự nghĩ ra', () => {
  const r = sanitizeInsight(['Food is at 4.567 of 3.000.'], digest);
  assert.equal(r.kept.length, 0);
  assert.match(r.dropped[0].reason, /not in digest/);
});

test('vứt suy luận nhân quả', () => {
  const r = sanitizeInsight(['Food rose because you ate out more.'], digest);
  assert.equal(r.kept.length, 0);
  assert.equal(r.dropped[0].reason, 'causal claim');
});

test('vứt phán xét', () => {
  for (const line of [
    'You should cut back on Food.',
    'That is too much for one cycle.',
    'Spending here looks wasteful.',
  ]) {
    const r = sanitizeInsight([line], digest);
    assert.equal(r.kept.length, 0, line);
    assert.equal(r.dropped[0].reason, 'judgement');
  }
});

test('vứt mọi thứ dính tới lời khuyên đầu tư', () => {
  const r = sanitizeInsight(['Consider putting more into your portfolio.'], digest);
  assert.equal(r.kept.length, 0);
  assert.equal(r.dropped[0].reason, 'investment advice');
});

test('vứt ngôn ngữ y khoa', () => {
  const r = sanitizeInsight(['This pattern suggests burnout.'], digest);
  assert.equal(r.kept.length, 0);
  assert.equal(r.dropped[0].reason, 'medical language');
});

test('viết số kiểu nào cũng khớp, miễn giá trị có thật', () => {
  for (const line of ['Food at 1.890.', 'Food at 1,890.', 'Food at 1890.']) {
    assert.equal(sanitizeInsight([line], digest).kept.length, 1, line);
  }
});

test('vứt hết là kết quả hợp lệ, không phải lỗi', () => {
  const r = sanitizeInsight(['You should spend less.', 'It rose because of travel.'], digest);
  assert.deepEqual(r.kept, []);
  assert.equal(r.dropped.length, 2);
});

test('allowedNumbers gồm cả phần trăm và tỉ số vượt hạn mức', () => {
  const a = allowedNumbers(digest);
  const food = digest.buckets.find((b) => b.name === 'Food')!;
  assert.ok(a.has(String(food.spent)));
  if (food.over) for (const part of food.over.split('/')) assert.ok(a.has(part));
});
