// ---------------------------------------------------------------------------
// fina - Import lich su tu Budget.numbers
//
//   node --import ./scripts/register.mjs --env-file=.env.local \
//     scripts/import-numbers.mjs --file overview.csv --uid <UID>
//
// Mac dinh CHI DEM (dry run). Them --commit moi ghi that.
// Chay lai nhieu lan duoc: id sinh tu noi dung dong, ghi de dung document cu.
//
// Bang map va con so phai khop: roadmap/STAGE-4-DETAILED.md
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { parseCsv } from './lib/csv.mjs';
import { mapRow, parseNumbersDate, SKIP_TRANSFER, SKIP_UNKNOWN } from './lib/map-rows.mjs';
// Dung THANG ham cua app, khong chep lai: mot ban sao la mot cho de troi.
import { toVnd } from '@/lib/money';
import { cycleOf, cycleRange } from '@/lib/cycle';

const COMMIT = process.argv.includes('--commit');
const flag = (name) => {
  const i = process.argv.indexOf(name);
  const v = i === -1 ? null : process.argv[i + 1];
  if (!v || v.startsWith('--')) throw new Error(`Thieu ${name} <gia tri>`);
  return v;
};

const FILE = flag('--file');
const UID = flag('--uid');

const BANK = {
  food: 'VCB', beauty: 'VCB', social: 'VCB', tech: 'VCB', utilities: 'VCB', buffer: 'VCB',
  healthFund: 'BIDV', purchases: 'BIDV', travel: 'BIDV', reserve: 'BIDV', emergency: 'BIDV',
  etf: 'VPS',
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const rows = parseCsv(readFileSync(FILE, 'utf8'));
const header = rows[0].map((h) => h.trim().toLowerCase());
const col = (name) => {
  const i = header.indexOf(name);
  if (i === -1) throw new Error(`CSV thieu cot "${name}". Co: ${header.join(', ')}`);
  return i;
};
const [iDate, iMonth, iCat, iAmt, iNote] = ['date', 'month', 'category', 'amount', 'note'].map(col);

const out = [];
const skipped = { [SKIP_TRANSFER]: [], [SKIP_UNKNOWN]: [] };
const problems = [];
const cycleMismatch = [];

for (const [n, r] of rows.slice(1).entries()) {
  const line = n + 2;
  const date = parseNumbersDate(r[iDate] ?? '');
  const amountVnd = toVnd((r[iAmt] ?? '').trim());
  const category = (r[iCat] ?? '').trim();
  const note = (r[iNote] ?? '').trim();

  if (!date) { problems.push([line, `ngay khong doc duoc: "${r[iDate]}"`]); continue; }
  if (amountVnd === null) { problems.push([line, `so tien khong doc duoc: "${r[iAmt]}"`]); continue; }

  const bucketId = mapRow(category, note);
  if (bucketId === null) {
    problems.push([line, `khong luat nao khop - category "${category}", note "${note || '(rong)'}"`]);
    continue;
  }
  if (bucketId === SKIP_TRANSFER || bucketId === SKIP_UNKNOWN) {
    skipped[bucketId].push({ line, amountVnd, note });
    continue;
  }

  const cycle = cycleOf(date);
  // Cot Month chi de DOI CHIEU. Lech nghia la luat ngay 25 dang hieu sai.
  const claimed = (r[iMonth] ?? '').trim();
  if (claimed && MONTHS[Number(cycle.slice(5)) - 1] !== claimed) {
    cycleMismatch.push([line, claimed, cycle]);
  }

  const id = createHash('sha1')
    .update([r[iDate], category, r[iAmt], note].join(' '))
    .digest('hex')
    .slice(0, 20);

  out.push({ id, occurredAt: date.getTime(), cycle, bucketId, bank: BANK[bucketId], amountVnd, note: note || null });
}

const f = (v) => (v / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const byBucket = {};
for (const t of out) {
  byBucket[t.bucketId] ??= { n: 0, sum: 0 };
  byBucket[t.bucketId].n++;
  byBucket[t.bucketId].sum += t.amountVnd;
}

console.log(`\nDoc ${rows.length - 1} dong tu ${FILE}\n`);
console.log('bucket           dong      tong (nghin)');
for (const [b, v] of Object.entries(byBucket).sort((a, c) => c[1].sum - a[1].sum)) {
  console.log(b.padEnd(16), String(v.n).padStart(3), f(v.sum).padStart(12));
}
console.log('-'.repeat(42));
console.log('import'.padEnd(16), String(out.length).padStart(3), f(out.reduce((a, t) => a + t.amountVnd, 0)).padStart(12));
console.log('bo - chuyen quy'.padEnd(16), String(skipped[SKIP_TRANSFER].length).padStart(3));
console.log('bo - khong nho'.padEnd(16), String(skipped[SKIP_UNKNOWN].length).padStart(3));

if (cycleMismatch.length) {
  console.log('\n[!] Cot Month lech voi chu ky tinh ra - luat ngay 25 co the sai:');
  for (const [line, claimed, got] of cycleMismatch) console.log(`   dong ${line}: CSV noi "${claimed}", tinh ra ${got}`);
}

if (problems.length) {
  console.log(`\n[X] ${problems.length} dong can ban quyet, script DUNG o day:`);
  for (const [line, why] of problems) console.log(`   dong ${line}: ${why}`);
  console.log('\nThem luat vao scripts/lib/map-rows.mjs roi chay lai. Khong doan ho.');
  process.exit(1);
}

if (!COMMIT) {
  console.log('\nDry run. Them --commit de ghi that.');
  process.exit(0);
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore(app);
const now = Date.now();

let written = 0;
for (let i = 0; i < out.length; i += 400) {
  const batch = db.batch();
  for (const t of out.slice(i, i + 400)) {
    batch.set(db.doc(`users/${UID}/transactions/${t.id}`), {
      occurredAt: t.occurredAt, cycle: t.cycle, bucketId: t.bucketId, bank: t.bank,
      amountVnd: t.amountVnd, direction: 'out', note: t.note, source: 'import',
      createdAt: now, updatedAt: now,
    });
    written++;
  }
  await batch.commit();
}

// Chu ky lich su: KHONG bia han muc bang baseline hom nay - ta khong biet
// han muc cu la bao nhieu.
const cycles = [...new Set(out.map((t) => t.cycle))];
for (const id of cycles) {
  const ref = db.doc(`users/${UID}/cycles/${id}`);
  if ((await ref.get()).exists) continue;
  const { startAt, endAt } = cycleRange(id);
  await ref.set({ startAt, endAt, incomeVnd: null, limits: {}, status: 'closed', closedAt: now, surplusVnd: null, surplusTo: null });
}

console.log(`\nDa ghi ${written} giao dich, ${cycles.length} chu ky.`);
console.log(`Chay tiep: node --import ./scripts/register.mjs --env-file=.env.local scripts/recompute-balances.mjs --uid ${UID}`);
