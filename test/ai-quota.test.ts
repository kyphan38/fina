import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isQuotaStatus } from '@/lib/ai-quota';

test('402 and 429 mean the AI credit is used up', () => {
  assert.equal(isQuotaStatus('402'), true);
  assert.equal(isQuotaStatus('429'), true);
  assert.equal(isQuotaStatus('500'), false);
  assert.equal(isQuotaStatus('bad'), false);
});
