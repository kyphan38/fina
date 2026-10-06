// ---------------------------------------------------------------------------
// fina - Rebuild each fund's balanceVnd from its full transaction history.
//
//   node --import ./scripts/register.mjs --env-file=.env.local \
//     scripts/recompute-balances.mjs --uid <UID> [--commit]
//
// balanceVnd is denormalized (so the app does not re-add all history on open).
// This checks that it still matches, and fixes it when it drifts.
//
// Since the Generator writes salary splits as `allocation` transactions, every
// inflow to a fund is a record - so the sum here is complete. Before that,
// funds only ever went down, and running this script would wipe the balances.
// ---------------------------------------------------------------------------

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const COMMIT = process.argv.includes('--commit');
const i = process.argv.indexOf('--uid');
const UID = i === -1 ? null : process.argv[i + 1];
if (!UID) throw new Error('Thieu --uid <UID>');

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore(app);

const buckets = await db.collection(`users/${UID}/buckets`).get();
const txs = await db.collection(`users/${UID}/transactions`).get();
const covers = await db.collection(`users/${UID}/covers`).get();

const kindOf = {};
for (const d of buckets.docs) kindOf[d.id] = d.data().kind;

// Direction lives in `direction`. Old records lack it: ETF is money in,
// everything else money out.
const computed = {};
for (const d of txs.docs) {
  const t = d.data();
  const dir = t.direction ?? (t.bucketId === 'etf' ? 'in' : 'out');
  computed[t.bucketId] = (computed[t.bucketId] ?? 0) + (dir === 'in' ? 1 : -1) * t.amountVnd;
}

// Every COMPLETED cover also moves real money: out of the source fund, into
// the target. Skipping them here would bring back the very bug this script
// fixes - a target fund stuck negative even after money moved in.
for (const d of covers.docs) {
  const c = d.data();
  if (c.status !== 'done') continue;
  if (kindOf[c.fromBucketId] === 'fund') {
    computed[c.fromBucketId] = (computed[c.fromBucketId] ?? 0) - c.amountVnd;
  }
  if (kindOf[c.toBucketId] === 'fund') {
    computed[c.toBucketId] = (computed[c.toBucketId] ?? 0) + c.amountVnd;
  }
}

const f = (v) => (v / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const fixes = [];

for (const d of buckets.docs) {
  const b = d.data();
  if (b.kind !== 'fund') continue;
  const want = computed[d.id] ?? 0;
  const have = Number(b.balanceVnd ?? 0);
  if (want !== have) fixes.push([d.id, have, want]);
  console.log(`${want === have ? 'ok  ' : 'OFF '} ${d.id.padEnd(12)} stored ${f(have).padStart(10)}  computed ${f(want).padStart(10)}`);
}

if (fixes.length === 0) {
  console.log('\nEvery balance matches.');
  process.exit(0);
}

if (!COMMIT) {
  console.log(`\n${fixes.length} funds off. Add --commit to rewrite.`);
  process.exit(0);
}

const batch = db.batch();
for (const [id, , want] of fixes) {
  batch.update(db.doc(`users/${UID}/buckets/${id}`), { balanceVnd: want, updatedAt: Date.now() });
}
await batch.commit();
console.log(`\nFixed ${fixes.length} funds.`);
