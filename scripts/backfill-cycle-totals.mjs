// ---------------------------------------------------------------------------
// fina - Chup lai tong cua cac chu ky da dong.
//
//   node --import ./scripts/register.mjs --env-file=.env.local \
//     scripts/backfill-cycle-totals.mjs --uid <UID> [--commit]
//
// closedTotals chi duoc ghi tu khi buoc dong so co no. Chu ky import va chu
// ky seed khong co, nen Trend o Insights khong ve duoc.
//
// Tinh bang CHINH spending.ts - khong chep lai cong thuc.
// ---------------------------------------------------------------------------

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { isSpending } from '@/lib/spending';

const COMMIT = process.argv.includes('--commit');
const i = process.argv.indexOf('--uid');
const UID = i === -1 ? null : process.argv[i + 1];
if (!UID) throw new Error('Thieu --uid <UID>');

const app = initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
})});
const db = getFirestore(app);
const f = (v) => (v / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 0 });

const cycles = await db.collection(`users/${UID}/cycles`).get();
const updates = [];

for (const d of cycles.docs) {
  const c = d.data();
  if (c.status !== 'closed') continue;

  const txSnap = await db
    .collection(`users/${UID}/transactions`)
    .where('cycle', '==', d.id)
    .get();
  const txs = txSnap.docs.map((t) => ({ id: t.id, ...t.data() }));

  const byBucket = {};
  for (const t of txs) {
    if (!isSpending(t)) continue;
    const signed = t.direction === 'in' ? -t.amountVnd : t.amountVnd;
    byBucket[t.bucketId] = (byBucket[t.bucketId] ?? 0) + signed;
  }

  const have = c.closedTotals?.byBucket;
  const already =
    have !== undefined && JSON.stringify(have) === JSON.stringify(byBucket);

  const tieu = Object.values(byBucket).reduce((a, b) => a + b, 0);
  console.log(`${already ? 'ok  ' : 'GHI '} ${d.id}  tieu ${f(tieu).padStart(10)}`);
  if (!already) updates.push([d.id, { closedTotals: { byBucket } }]);
}

if (updates.length === 0) {
  console.log('\nKhong co gi phai ghi.');
  process.exit(0);
}
if (!COMMIT) {
  console.log(`\n${updates.length} chu ky can ghi. Them --commit.`);
  process.exit(0);
}

const batch = db.batch();
for (const [id, patch] of updates) batch.update(db.doc(`users/${UID}/cycles/${id}`), patch);
await batch.commit();
console.log(`\nDa ghi ${updates.length} chu ky.`);
