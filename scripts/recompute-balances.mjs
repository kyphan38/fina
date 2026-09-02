// ---------------------------------------------------------------------------
// fina - Dung lai balanceVnd cua moi quy tu toan bo lich su giao dich.
//
//   node --import ./scripts/register.mjs --env-file=.env.local \
//     scripts/recompute-balances.mjs --uid <UID> [--commit]
//
// balanceVnd la so denormalize (de khoi cong ca lich su moi lan mo app).
// Day la cach kiem tra no con khop khong, va sua lai khi lech.
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

// Moi quy la tien di ra. ETF la ngoai le: tien chi di vao.
const computed = {};
for (const d of txs.docs) {
  const t = d.data();
  const sign = t.bucketId === 'etf' ? 1 : -1;
  computed[t.bucketId] = (computed[t.bucketId] ?? 0) + sign * t.amountVnd;
}

const f = (v) => (v / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const fixes = [];

for (const d of buckets.docs) {
  const b = d.data();
  if (b.kind !== 'fund') continue;
  const want = computed[d.id] ?? 0;
  const have = Number(b.balanceVnd ?? 0);
  if (want !== have) fixes.push([d.id, have, want]);
  console.log(`${want === have ? 'ok  ' : 'LECH'} ${d.id.padEnd(12)} luu ${f(have).padStart(10)}  tinh ${f(want).padStart(10)}`);
}

if (fixes.length === 0) {
  console.log('\nMoi so du deu khop.');
  process.exit(0);
}

if (!COMMIT) {
  console.log(`\n${fixes.length} quy lech. Them --commit de ghi lai.`);
  process.exit(0);
}

const batch = db.batch();
for (const [id, , want] of fixes) {
  batch.update(db.doc(`users/${UID}/buckets/${id}`), { balanceVnd: want, updatedAt: Date.now() });
}
await batch.commit();
console.log(`\nDa sua ${fixes.length} quy.`);
