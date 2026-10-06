import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HINT_MAX_LENGTH, normalizeHint } from '@/lib/bucket-hint';
import { SEED_BUCKETS } from '@/types/fina';

test('hint is trimmed', () => {
  assert.equal(normalizeHint('  Meals, coffee  '), 'Meals, coffee');
});

test('empty or blank hint becomes null', () => {
  assert.equal(normalizeHint(''), null);
  assert.equal(normalizeHint('   \n '), null);
});

// Rules reject a longer hint, which would fail the whole seed batch.
test('seed hints fit the rules limit', () => {
  for (const b of SEED_BUCKETS) {
    assert.ok((b.hint ?? '').length <= HINT_MAX_LENGTH, `${b.id} hint too long`);
  }
});
