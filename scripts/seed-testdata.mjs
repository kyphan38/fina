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
// Mac dinh chi in ra. Ghi that can CA HAI co:
//   --commit --i-know-this-wipes-everything
//
// Hai co chu khong phai mot: script nay xoa sach transactions, covers, cycles
// va income. Sau khi dung du lieu that, mot lan go nham `--commit` la mat
// het. Co thu hai bat phai go ra dieu do.
// ---------------------------------------------------------------------------

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { cycleOf, cycleRange } from '@/lib/cycle';

const COMMIT =
  process.argv.includes('--commit') && process.argv.includes('--i-know-this-wipes-everything');

if (process.argv.includes('--commit') && !COMMIT) {
  console.error(
    '\nScript nay XOA transactions, covers, cycles va income.\n' +
      'Them --i-know-this-wipes-everything neu that su muon.\n',
  );
  process.exit(1);
}
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

// Luong moi chu ky.
const SALARY = 39065 * K;

// Quy duoc nap bang giao dich `allocation` nhu app that lam, khong dat tay.
// So du cuoi cung = allocation cong lai, tru phan da tieu.
const ALLOC = {
  healthFund: 3000 * K, purchases: 3000 * K, travel: 2000 * K,
  reserve: 2000 * K, emergency: 500 * K,
};

// So du quy CO SAN truoc khi bo du lieu test bat dau.
//
// Ghi thanh GIAO DICH chu khong dat thang vao balanceVnd: neu mot dong nao
// trong quy khong co ban ghi, recompute-balances se xoa mat no. Moi dong
// trong quy phai truy nguoc duoc.
const OPENING = {
  healthFund: 1500 * K, purchases: 1400 * K, travel: 3600 * K,
  reserve: 0, emergency: 500 * K, etf: 177714 * K,
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
// Chia luong dau moi chu ky: mot ban ghi thu nhap + mot giao dich vao moi quy.
const CYCLES = ['2026-08', '2026-09'];
const allocRows = [];
const incomeRows = [];
// So du mo dau: mot giao dich `in` truoc chu ky dau tien.
const OPENING_AT = at('2026-07-24T23:00');
for (const [bucketId, amountVnd] of Object.entries(OPENING)) {
  if (amountVnd <= 0) continue;
  allocRows.push({
    id: `opening-${bucketId}`,
    occurredAt: OPENING_AT,
    cycle: cycleOf(new Date(OPENING_AT)),
    bucketId,
    bank: bucketId === 'etf' ? 'VPS' : 'BIDV',
    amountVnd,
    direction: 'in',
    note: 'Opening balance',
    // 'opening' chu khong phai 'allocation': day la trang thai ban dau, phai
    // nam ngoai moi phep tinh dong tien.
    source: 'opening',
  });
}

for (const cyc of CYCLES) {
  const { startAt } = cycleRange(cyc);
  incomeRows.push({
    id: `income-${cyc}-salary`, occurredAt: startAt, cycle: cyc,
    amountVnd: SALARY, kind: 'salary', note: `Salary ${cyc}`,
  });
  for (const [bucketId, amountVnd] of Object.entries(ALLOC)) {
    allocRows.push({
      id: `alloc-${cyc}-${bucketId}`, occurredAt: startAt, cycle: cyc,
      bucketId, bank: 'BIDV', amountVnd, direction: 'in',
      note: `Allocation ${cyc}`, source: 'allocation',
    });
  }
}

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
console.log(`\nThu nhap: ${CYCLES.length} ky x ${f(SALARY)}`);
console.log('Phan bo vao quy moi ky:');
for (const [b, v] of Object.entries(ALLOC)) console.log(`   ${b.padEnd(12)} ${f(v).padStart(8)}`);

// So du cuoi = mo dau + tong allocation - tong da tieu (theo chieu)
// Cong tu chinh cac ban ghi - dung cach recompute-balances lam.
const FUND_BALANCE = {};
for (const b of Object.keys(OPENING)) {
  const signed = (r) => (r.direction === 'in' ? r.amountVnd : -r.amountVnd);
  FUND_BALANCE[b] =
    allocRows.filter((r) => r.bucketId === b).reduce((a, r) => a + signed(r), 0) +
    rows.filter((r) => r.bucketId === b).reduce((a, r) => a + signed(r), 0);
}
console.log('\nSo du quy sau khi cong het:');
for (const [b, v] of Object.entries(FUND_BALANCE)) console.log(`   ${b.padEnd(12)} ${f(v).padStart(10)}`);

if (!COMMIT) {
  console.log(
    '\nDry run. Ghi that: --commit --i-know-this-wipes-everything (SE XOA du lieu cu).',
  );
  process.exit(0);
}

// ---- Xoa cu ----
for (const c of ['transactions', 'covers', 'cycles', 'income']) {
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
for (const r of allocRows) {
  batch.set(db.doc(`users/${UID}/transactions/${r.id}`), {
    occurredAt: r.occurredAt, cycle: r.cycle, bucketId: r.bucketId, bank: r.bank,
    amountVnd: r.amountVnd, direction: r.direction, note: r.note,
    source: r.source, createdAt: now, updatedAt: now,
  });
}
for (const r of incomeRows) {
  batch.set(db.doc(`users/${UID}/income/${r.id}`), {
    occurredAt: r.occurredAt, cycle: r.cycle, amountVnd: r.amountVnd,
    kind: r.kind, note: r.note, createdAt: now, updatedAt: now,
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

// Chu ky chua so du mo dau cung phai co document, neu khong nhung giao dich
// do vo hinh trong History - bo chon chu ky chi liet ke chu ky co document.
const openingCycle = allocRows.find((r) => r.id.startsWith('opening-'))?.cycle;
if (openingCycle) {
  const { startAt, endAt } = cycleRange(openingCycle);
  batch.set(db.doc(`users/${UID}/cycles/${openingCycle}`), {
    startAt, endAt, limits: {}, status: 'closed', closedAt: now,
    surplusVnd: null, surplusTo: null, closedTotals: null,
  });
}

for (const [id, closed] of [['2026-08', true], ['2026-09', false]]) {
  const { startAt, endAt } = cycleRange(id);
  batch.set(db.doc(`users/${UID}/cycles/${id}`), {
    startAt, endAt,
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

console.log(`\nDa ghi ${rows.length} giao dich + ${allocRows.length} allocation, ` +
  `${incomeRows.length} ban ghi thu nhap, 2 chu ky, ${cover ? 1 : 0} cover.`);
