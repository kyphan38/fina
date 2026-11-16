import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bidvBalance } from '@/lib/bidv';

test('BIDV total adds the balances of BIDV funds and goals only', () => {
  const b = (bank: 'VCB' | 'BIDV' | 'VPS', kind: 'budget' | 'fund', balanceVnd: number) => ({ bank, kind, balanceVnd });
  assert.equal(
    bidvBalance([b('BIDV', 'fund', 2_000_000), b('BIDV', 'fund', 500_000), b('VPS', 'fund', 9_000_000), b('VCB', 'budget', 100)]),
    2_500_000,
  );
  assert.equal(bidvBalance([]), 0);
});
