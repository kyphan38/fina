// ---------------------------------------------------------------------------
// fina - Nhap du lieu THAT: lich su tu Budget.numbers + chu ky 2026-09.
//
//   node --import ./scripts/register.mjs --env-file=.env.local \
//     scripts/import-real.mjs --uid <UID> [--commit --i-know-this-wipes-everything]
//
// XOA sach transactions / covers / cycles / income roi ghi lai.
// So du quy la SO CAN BANG: tinh nguoc tu so du hien tai nguoi dung doc ra,
// tru di nhung gi lich su da tieu. Khong ai biet quy co bao nhieu truoc do.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { parseCsv } from './lib/csv.mjs';
import { mapRow, parseNumbersDate, SKIP_TRANSFER, SKIP_UNKNOWN } from './lib/map-rows.mjs';
import { toVnd } from '@/lib/money';
import { cycleOf, cycleRange } from '@/lib/cycle';

const COMMIT =
  process.argv.includes('--commit') && process.argv.includes('--i-know-this-wipes-everything');
const arg = (n) => { const i = process.argv.indexOf(n); return i === -1 ? null : process.argv[i + 1]; };
const UID = arg('--uid');
const FILE = arg('--file');
if (!UID || !FILE) throw new Error('Can --uid <UID> --file <csv>');

const K = 1000;
const at = (s) => new Date(s).getTime();
const BANK = { food:'VCB', beauty:'VCB', social:'VCB', tech:'VCB', utilities:'VCB', buffer:'VCB',
  healthFund:'BIDV', purchases:'BIDV', travel:'BIDV', reserve:'BIDV', emergency:'BIDV', etf:'VPS' };

// ---- Chu ky 2026-09: han muc cu 12.298,793 chia sang category moi ----
const SEP_LIMITS = {
  food: 4000*K, social: 2000*K, beauty: 2900*K,
  tech: 1500*K, utilities: 500*K, buffer: 1398.793*K,
};

// ---- Chi tieu 2026-09, tu ghi chu nguoi dung ----
const SEP = [
  ['2026-08-25T12:00','social',100,'An toi voi LH'],
  ['2026-08-25T12:30','food',36,''], ['2026-08-25T13:00','food',80,''], ['2026-08-25T13:30','food',90,''],
  ['2026-08-27T19:00','social',338,'Moi anh em, happy hour'],
  ['2026-08-27T21:00','social',232,'Moi anh em, happy hour'],
  ['2026-08-28T09:00','food',15,'Ca phe'], ['2026-08-28T15:00','food',25,'Ca phe'],
  ['2026-08-28T19:00','social',1000,'Nhau voi anh em'],
  ['2026-08-28T18:30','buffer',75,'Grab den quan'],
  ['2026-08-28T23:30','buffer',80,'Grab ve'],
  ['2026-08-29T07:30','food',60,'An sang, ca phe'],
  ['2026-08-29T10:00','utilities',100,'Nap card dien thoai'],
  ['2026-08-29T19:00','food',271,'An toi ngoai'], ['2026-08-29T19:10','food',54,'An toi ngoai'],
  ['2026-08-29T19:20','food',145,'An toi ngoai'],
  ['2026-08-30T08:00','food',72,''], ['2026-08-30T10:00','food',130,''],
  ['2026-08-30T12:00','food',182,''], ['2026-08-30T15:00','food',25,''],
  ['2026-08-30T18:00','food',48,''], ['2026-08-30T20:00','food',78.5,''],
  ['2026-08-31T08:00','food',7,''], ['2026-08-31T12:00','food',10,''], ['2026-08-31T18:00','food',20,''],
  ['2026-09-01T09:00','food',18,'Nuoc uong'], ['2026-09-01T11:00','food',18,'Nuoc uong'],
  ['2026-09-01T14:00','food',100,'Nuoc uong'], ['2026-09-01T16:00','food',13,'Nuoc uong'],
  ['2026-09-01T19:00','food',95,'Nuoc uong'],
  ['2026-09-02T09:00','tech',46.097,'Google monthly'],
  ['2026-09-02T09:05','tech',1350,'Google charge chu dong'],
  ['2026-09-02T10:00','food',15,'Cf'],
  ['2026-09-02T18:00','social',25,'Mua nhau cho anh em'],
  ['2026-09-02T18:05','social',90,'Mua nhau cho anh em'],
  ['2026-09-02T18:10','social',65,'Mua nhau cho anh em'],
  ['2026-09-02T18:15','social',40,'Mua nhau cho anh em'],
];

// ---- ETF: nap tay theo tung moc ----
const ETF_OPENING = 167825*K;
const ETF_DEPOSITS = [
  ['2026-07-24T12:00', 9037.2], ['2026-07-29T12:00', 852],
  ['2026-08-09T12:00', 3425],  ['2026-08-25T12:00', 21012.8],
];

// ---- So du quy HIEN TAI nguoi dung doc ra ----
const FUND_NOW = { travel: 7400*K, purchases: 3097.589*K, emergency: 250*K, healthFund: 0, reserve: 0 };

// ---- Doc lich su ----
const rows = parseCsv(readFileSync(FILE, 'utf8'));
const head = rows[0].map((h) => h.trim().toLowerCase());
const col = (n) => head.indexOf(n);
const [iD,,iC,iA,iN] = ['date','month','category','amount','note'].map(col);

const history = [];
const problems = [];
for (const [n, r] of rows.slice(1).entries()) {
  const date = parseNumbersDate(r[iD] ?? '');
  const amountVnd = toVnd((r[iA] ?? '').trim());
  const bucketId = mapRow((r[iC] ?? '').trim(), (r[iN] ?? '').trim());
  if (!date || amountVnd === null) { problems.push([n+2, 'khong doc duoc']); continue; }
  if (bucketId === SKIP_TRANSFER || bucketId === SKIP_UNKNOWN) continue;
  if (!bucketId) { problems.push([n+2, `khong luat nao khop: "${r[iC]}" / "${r[iN]}"`]); continue; }
  history.push({
    id: 'h-' + createHash('sha1').update([r[iD], r[iC], r[iA], r[iN]].join(' ')).digest('hex').slice(0,16),
    occurredAt: date.getTime(), cycle: cycleOf(date), bucketId, bank: BANK[bucketId],
    amountVnd, direction: 'out', note: (r[iN] ?? '').trim() || null, source: 'import',
  });
}
if (problems.length) {
  console.log('DUNG - can quyet:'); for (const [l,w] of problems) console.log(`  dong ${l}: ${w}`);
  process.exit(1);
}

const sep = SEP.map(([iso,b,k,note], n) => ({
  id: `s-${String(n+1).padStart(3,'0')}`, occurredAt: at(iso), cycle: cycleOf(new Date(at(iso))),
  bucketId: b, bank: BANK[b], amountVnd: Math.round(k*K), direction: 'out',
  note: note || null, source: 'web',
}));

const etf = ETF_DEPOSITS.map(([iso,k], n) => ({
  id: `etf-${n+1}`, occurredAt: at(iso), cycle: cycleOf(new Date(at(iso))),
  bucketId: 'etf', bank: 'VPS', amountVnd: Math.round(k*K), direction: 'in',
  note: 'Nap VPS', source: 'web',
}));

// ---- So du mo dau: can nguoc de so du hien tai ra dung ----
const spent = {};
for (const t of [...history, ...sep]) {
  if (BANK[t.bucketId] !== 'BIDV') continue;
  spent[t.bucketId] = (spent[t.bucketId] ?? 0) + t.amountVnd;
}
const OPEN_AT = at('2026-03-27T00:00');
const opening = [];
for (const [b, now] of Object.entries(FUND_NOW)) {
  const amountVnd = now + (spent[b] ?? 0);
  if (amountVnd <= 0) continue;
  opening.push({ id:`open-${b}`, occurredAt: OPEN_AT, cycle: cycleOf(new Date(OPEN_AT)),
    bucketId: b, bank: 'BIDV', amountVnd, direction: 'in', note: 'Opening balance', source: 'opening' });
}
opening.push({ id:'open-etf', occurredAt: OPEN_AT, cycle: cycleOf(new Date(OPEN_AT)),
  bucketId:'etf', bank:'VPS', amountVnd: ETF_OPENING, direction:'in', note:'Opening balance', source:'opening' });

const all = [...opening, ...history, ...sep, ...etf];

// ---- Bao cao ----
const f = (v) => (v/K).toLocaleString('vi-VN',{maximumFractionDigits:0});
const byCycle = {};
for (const t of all) { (byCycle[t.cycle] ??= []).push(t); }

console.log(`\nLich su ${history.length} dong · thang 9 ${sep.length} dong · ETF ${etf.length} lan nap · mo dau ${opening.length}\n`);
console.log('Chi tieu chu ky 2026-09:');
const sepByBucket = {};
for (const t of sep) sepByBucket[t.bucketId] = (sepByBucket[t.bucketId] ?? 0) + t.amountVnd;
let sepTotal = 0;
for (const [b, v] of Object.entries(sepByBucket).sort((a,c)=>c[1]-a[1])) {
  sepTotal += v;
  console.log(`  ${b.padEnd(11)} ${f(v).padStart(8)} / ${f(SEP_LIMITS[b] ?? 0).padStart(8)}`);
}
console.log(`  ${'TONG'.padEnd(11)} ${f(sepTotal).padStart(8)} / ${f(Object.values(SEP_LIMITS).reduce((a,b)=>a+b,0)).padStart(8)}`);
console.log(`  Con lai   ${f(Object.values(SEP_LIMITS).reduce((a,b)=>a+b,0) - sepTotal).padStart(10)}   (ban doc ra: 7.173)`);

console.log('\nSo du quy sau khi cong het:');
const bal = {};
for (const t of all) {
  if (t.bank === 'VCB') continue;
  bal[t.bucketId] = (bal[t.bucketId] ?? 0) + (t.direction === 'in' ? t.amountVnd : -t.amountVnd);
}
for (const [b,v] of Object.entries(bal)) console.log(`  ${b.padEnd(11)} ${f(v).padStart(10)}`);
console.log(`  ${'BIDV tong'.padEnd(11)} ${f(Object.entries(bal).filter(([b])=>BANK[b]==='BIDV').reduce((a,[,v])=>a+v,0)).padStart(10)}   (ban doc ra: 10.748)`);

if (!COMMIT) { console.log('\nDry run. Ghi that: --commit --i-know-this-wipes-everything'); process.exit(0); }

// ---- Ghi ----
const app = initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g,'\n'),
})});
const db = getFirestore(app);

for (const c of ['transactions','covers','cycles','income']) {
  const snap = await db.collection(`users/${UID}/${c}`).get();
  for (let i=0;i<snap.docs.length;i+=400) {
    const b=db.batch(); for (const d of snap.docs.slice(i,i+400)) b.delete(d.ref); await b.commit();
  }
  console.log(`xoa ${c}: ${snap.size}`);
}

const now = Date.now();
for (let i=0;i<all.length;i+=400) {
  const b = db.batch();
  for (const t of all.slice(i,i+400)) {
    const { id, ...rest } = t;
    b.set(db.doc(`users/${UID}/transactions/${id}`), { ...rest, createdAt: now, updatedAt: now });
  }
  await b.commit();
}

const b2 = db.batch();
for (const id of Object.keys(byCycle)) {
  const { startAt, endAt } = cycleRange(id);
  const current = id === '2026-09';
  b2.set(db.doc(`users/${UID}/cycles/${id}`), {
    startAt, endAt,
    limits: current ? SEP_LIMITS : {},
    status: current ? 'open' : 'closed',
    closedAt: current ? null : now,
    surplusVnd: null, surplusTo: null, closedTotals: null, closedIncomeVnd: null,
  });
}
for (const [b,v] of Object.entries(bal)) {
  b2.update(db.doc(`users/${UID}/buckets/${b}`), { balanceVnd: v, updatedAt: now });
}
await b2.commit();
console.log(`\nDa ghi ${all.length} giao dich, ${Object.keys(byCycle).length} chu ky.`);
