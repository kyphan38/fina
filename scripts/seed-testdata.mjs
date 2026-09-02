// ---------------------------------------------------------------------------
// fina - Dung bo du lieu test mach lac.
//
//   node --import ./scripts/register.mjs --env-file=.env.local \
//     scripts/seed-testdata.mjs --uid <UID> [--commit]
//
// XOA sach transactions / covers / cycles roi ghi lai mot bo co y nghia:
// mot chu ky da dong (2026-08) va chu ky dang chay (2026-09).
// KHONG dung buckets va meta.
//
// Mac dinh chi in ra. Them --commit moi ghi that.
// ---------------------------------------------------------------------------

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { cycleOf, cycleRange } from '@/lib/cycle';

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

const K = 1000;
const at = (iso) => new Date(iso).getTime();

// [ngay, bucket, nghin dong, ghi chu, chieu]
const TX = [
  // ---- Chu ky 2026-08 (25/7 -> 24/8), da dong ----
  ['2026-07-25T08:10', 'food', 65, 'Bun bo'],
  ['2026-07-26T12:30', 'food', 340, 'Di cho'],
  ['2026-07-28T19:00', 'social', 480, 'An voi team'],
  ['2026-07-30T07:40', 'food', 120, 'Ca phe + banh'],
  ['2026-08-02T11:00', 'beauty', 380, 'Serum'],
  ['2026-08-03T18:20', 'food', 520, 'Sieu thi'],
  ['2026-08-05T09:15', 'tech', 490, 'Gemini + Claude'],
  ['2026-08-07T20:00', 'social', 670, 'Happy hour'],
  ['2026-08-09T08:00', 'utilities', 100, 'Card dien thoai'],
  ['2026-08-11T16:45', 'food', 780, 'An uong tich luy'],
  ['2026-08-14T10:00', 'beauty', 600, 'Skincare'],
  ['2026-08-16T13:30', 'buffer', 200, 'Sach'],
  ['2026-08-18T09:00', 'travel', 1200, 'Ve xe Da Lat'],
  ['2026-08-20T15:00', 'purchases', 800, 'Do an cho cho'],
  ['2026-08-22T12:00', 'food', 1025, 'An uong tich luy'],

  // ---- Chu ky 2026-09 (25/8 -> 24/9), dang chay, hom nay 2/9 ----
  ['2026-08-25T08:30', 'food', 45, 'Pho'],
  ['2026-08-26T07:50', 'food', 120, 'Ca phe'],
  ['2026-08-27T19:30', 'social', 850, 'Picnic - minh ung tien'],
  ['2026-08-28T21:00', 'social', 430, 'Anh em tra lai', 'in'],
  ['2026-08-29T12:00', 'food', 310, 'Di cho'],
  ['2026-08-30T10:00', 'etf', 3425, 'Nap VPS', 'in'],
  ['2026-08-31T18:00', 'beauty', 380, 'Thuoc tri mun'],
  ['2026-09-01T08:00', 'utilities', 100, 'Card dien thoai'],
  ['2026-09-01T13:00', 'purchases', 1400, 'Ghe'],
  ['2026-09-02T07:30', 'tech', 300, 'Gemini'],
  ['2026-09-02T09:50', 'food', 765, 'An uong tich luy'],
];

const BANK = {
  food: 'VCB', beauty: 'VCB', social: 'VCB', tech: 'VCB', utilities: 'VCB', buffer: 'VCB',
  healthFund: 'BIDV', purchases: 'BIDV', travel: 'BIDV', reserve: 'BIDV', emergency: 'BIDV',
  etf: 'VPS',
};

// So du quy dat thang. Xem ghi chu o cuoi file ve viec app CHUA co duong
// nao cong tien vao quy theo chu ky.
const FUND_BALANCE = {
  healthFund: 4500 * K, purchases: 5200 * K, travel: 6400 * K,
  reserve: 3800 * K, emergency: 1500 * K, etf: 181139 * K,
};

const rows = TX.map(([iso, bucketId, k, note, dir], n) => ({
  id: `test-${String(n + 1).padStart(3, '0')}`,
  occurredAt: at(iso),
  cycle: cycleOf(new Date(at(iso))),
  bucketId,
  bank: BANK[bucketId],
  amountVnd: k * K,
  direction: dir ?? 'out',
  note,
}));

// Mot lan bu: Social vuot han muc o chu ky 8, bu tu Buffer.
const augSocial = rows.filter((r) => r.cycle === '2026-08' && r.bucketId === 'social');
const augSocialTotal = augSocial.reduce((a, b) => a + b.amountVnd, 0);
const socialOver = Math.max(0, augSocialTotal - 1000 * K);
const cover = socialOver > 0 ? {
  id: 'test-cover-001',
  txId: augSocial[augSocial.length - 1].id,
  cycle: '2026-08',
  toBucketId: 'social',
  fromBucketId: 'buffer',
  amountVnd: socialOver,
  needsTransfer: false,
  status: 'done',
  createdAt: at('2026-08-07T20:05'),
  confirmedAt: at('2026-08-07T20:05'),
} : null;

// ---- Bao cao ----
const f = (v) => (v / K).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const byCycle = {};
for (const r of rows) {
  byCycle[r.cycle] ??= {};
  const signed = r.direction === 'in' ? -r.amountVnd : r.amountVnd;
  byCycle[r.cycle][r.bucketId] = (byCycle[r.cycle][r.bucketId] ?? 0) + signed;
}
for (const [cyc, buckets] of Object.entries(byCycle)) {
  console.log(`\n${cyc}  (${rows.filter((r) => r.cycle === cyc).length} giao dich)`);
  for (const [b, v] of Object.entries(buckets)) console.log(`   ${b.padEnd(12)} ${f(v).padStart(8)}`);
}
if (cover) console.log(`\nCover: social vuot ${f(cover.amountVnd)} -> bu tu buffer`);
console.log('\nSo du quy dat thang:');
for (const [b, v] of Object.entries(FUND_BALANCE)) console.log(`   ${b.padEnd(12)} ${f(v).padStart(10)}`);

if (!COMMIT) {
  console.log('\nDry run. Them --commit de ghi that (SE XOA du lieu cu).');
  process.exit(0);
}

// ---- Xoa cu ----
for (const c of ['transactions', 'covers', 'cycles']) {
  const snap = await db.collection(`users/${UID}/${c}`).get();
  for (let n = 0; n < snap.docs.length; n += 400) {
    const batch = db.batch();
    for (const d of snap.docs.slice(n, n + 400)) batch.delete(d.ref);
    await batch.commit();
  }
  console.log(`xoa ${c}: ${snap.size}`);
}

// ---- Ghi moi ----
const now = Date.now();
let batch = db.batch();
for (const r of rows) {
  batch.set(db.doc(`users/${UID}/transactions/${r.id}`), {
    occurredAt: r.occurredAt, cycle: r.cycle, bucketId: r.bucketId, bank: r.bank,
    amountVnd: r.amountVnd, direction: r.direction, note: r.note,
    source: 'web', createdAt: now, updatedAt: now,
  });
}
if (cover) batch.set(db.doc(`users/${UID}/covers/${cover.id}`), cover);
await batch.commit();

// Han muc = standard hien tai, dong bang vao ca hai chu ky.
const buckets = await db.collection(`users/${UID}/buckets`).get();
const limits = {};
for (const d of buckets.docs) {
  const b = d.data();
  if (b.kind === 'budget' && b.active !== false) limits[d.id] = b.standardVnd ?? 0;
}

batch = db.batch();
for (const [id, closed] of [['2026-08', true], ['2026-09', false]]) {
  const { startAt, endAt } = cycleRange(id);
  batch.set(db.doc(`users/${UID}/cycles/${id}`), {
    startAt, endAt,
    incomeVnd: 39065 * K,
    limits,
    status: closed ? 'closed' : 'open',
    closedAt: closed ? at('2026-08-25T07:00') : null,
    surplusVnd: null,
    surplusTo: null,
  });
}
for (const [id, v] of Object.entries(FUND_BALANCE)) {
  batch.update(db.doc(`users/${UID}/buckets/${id}`), { balanceVnd: v, updatedAt: now });
}
await batch.commit();

console.log(`\nDa ghi ${rows.length} giao dich, 2 chu ky, ${cover ? 1 : 0} cover.`);
