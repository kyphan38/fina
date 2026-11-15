import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Backup } from '@/lib/backup';
import { chunks, missingRows, parseBackup } from '@/lib/restore';

const backup: Backup = {
  app: 'fina',
  version: 1,
  exportedAt: 0,
  uid: 'u',
  buckets: [{ id: 'b1' }, { id: 'b2' }],
  transactions: [{ id: 7, amount: 1 }],
  cycles: [],
  covers: [],
};

test('parseBackup accepts a fina export and refuses anything else', () => {
  assert.equal(parseBackup(JSON.stringify(backup)).uid, 'u');
  assert.throws(() => parseBackup(JSON.stringify({ app: 'logi' })));
  assert.throws(() => parseBackup('not json'));
  assert.throws(() => parseBackup('null'));
});

test('missingRows keeps only ids not in the database, numeric ids included', () => {
  assert.deepEqual(missingRows(backup, 'buckets', new Set(['b1'])), [{ id: 'b2' }]);
  assert.deepEqual(missingRows(backup, 'transactions', new Set(['7'])), []);
  assert.deepEqual(missingRows({ ...backup, covers: undefined as never }, 'covers', new Set()), []);
});

test('chunks splits rows into batches under the Firestore limit', () => {
  const rows = Array.from({ length: 801 }, (_, i) => i);
  assert.deepEqual(chunks(rows).map((c) => c.length), [400, 400, 1]);
  assert.deepEqual(chunks([]), []);
});
