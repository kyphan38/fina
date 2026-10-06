import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HINT_MAX_LENGTH, normalizeHint } from '@/lib/bucket-hint';
import { SEED_BUCKETS } from '@/types/fina';

test('hint bỏ khoảng trắng hai đầu', () => {
  assert.equal(normalizeHint('  Meals, coffee  '), 'Meals, coffee');
});

test('hint rỗng hoặc chỉ có khoảng trắng thành null', () => {
  assert.equal(normalizeHint(''), null);
  assert.equal(normalizeHint('   \n '), null);
});

// Rules chặn hint dài hơn giới hạn. Seed vượt thì cả batch khởi tạo bị từ chối.
test('hint trong seed không vượt giới hạn của rules', () => {
  for (const b of SEED_BUCKETS) {
    assert.ok((b.hint ?? '').length <= HINT_MAX_LENGTH, `${b.id} hint quá dài`);
  }
});
