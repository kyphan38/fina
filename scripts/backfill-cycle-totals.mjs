// ---------------------------------------------------------------------------
// fina - Chup lai tong cua cac chu ky da dong.
//
//   node --import ./scripts/register.mjs --env-file=.env.local \
//     scripts/backfill-cycle-totals.mjs --uid <UID> [--commit]
//
// closedTotals chi duoc ghi tu khi buoc dong so co no. Chu ky import va chu
// ky seed khong co, nen bang dong tien theo nam khong doc duoc.
//
// Tinh bang CHINH cashflow.ts - khong chep lai cong thuc.
// ---------------------------------------------------------------------------

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { cashFlow, isSpending } from '@/lib/cashflow';

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

  const [txSnap, incSnap] = await Promise.all([
    db.collection(`users/${UID}/transactions`).where('cycle', '==', d.id).get(),
    db.collection(`users/${UID}/income`).where('cycle', '==', d.id).get(),
  ]);
  const txs = txSnap.docs.map((t) => ({ id: t.id, ...t.data() }));
  const flow = cashFlow(incSnap.docs.map((x) => x.data()), txs);

  const byBucket = {};
  for (const t of txs) {
    if (!isSpending(t)) continue;
    const signed = t.direction === 'in' ? -t.amountVnd : t.amountVnd;
    byBucket[t.bucketId] = (byBucket[t.bucketId] ?? 0) + signed;
  }

  const already =
    c.closedTotals?.outVnd === flow.outVnd &&
    c.closedTotals?.investedVnd === flow.investedVnd &&
    c.closedIncomeVnd === flow.inVnd &&
    c.closedTotals?.byBucket !== undefined;

  console.log(
    `${already ? 'ok  ' : 'GHI '} ${d.id}  in ${f(flow.inVnd).padStart(8)}  ` +
      `out ${f(flow.outVnd).padStart(8)}  invested ${f(flow.investedVnd).padStart(8)}`,
  );
  if (!already) {
    updates.push([d.id, {
      closedTotals: { outVnd: flow.outVnd, investedVnd: flow.investedVnd, byBucket },
      closedIncomeVnd: flow.inVnd,
    }]);
  }
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
