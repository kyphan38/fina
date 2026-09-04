// ---------------------------------------------------------------------------
// fina - Dung lai balanceVnd cua moi quy tu toan bo lich su giao dich.
//
//   node --import ./scripts/register.mjs --env-file=.env.local \
//     scripts/recompute-balances.mjs --uid <UID> [--commit]
//
// balanceVnd la so denormalize (de khoi cong ca lich su moi lan mo app).
// Day la cach kiem tra no con khop khong, va sua lai khi lech.
//
// Tu khi Generator ghi khoan chia luong thanh giao dich `allocation`, moi
// dong tien vao quy deu la mot ban ghi - nen phep cong o day la day du.
// Truoc do quy chi bao gio giam, va chay script nay se xoa sach so du.
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

// Chieu nam o `direction`. Ban ghi cu chua co field do: ETF la tien vao,
// con lai la tien ra.
const computed = {};
for (const d of txs.docs) {
  const t = d.data();
  const dir = t.direction ?? (t.bucketId === 'etf' ? 'in' : 'out');
  computed[t.bucketId] = (computed[t.bucketId] ?? 0) + (dir === 'in' ? 1 : -1) * t.amountVnd;
}

// Moi lan bu DA XONG cung di chuyen tien that: ra khoi quy nguon, vao quy
// dich. Bo qua chung o day thi script se dap lai dung cai loi no phai sua -
// quy dich ket o so am du da co tien chuyen vao.
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
