// ---------------------------------------------------------------------------
// fina - Move the loans logged as bucket "in" entries to People (PLAN-people.md, step 5).
//
//   node --env-file=.env.local scripts/move-loans-to-people.mjs [--uid <UID>] [--commit]
//
// Without --commit it only prints what it would do. Each loan becomes an
// `in` entry on a person (bucketId 'people'); the fund it sat in loses the
// amount it had added, and the person's balance goes negative (you owe).
// ---------------------------------------------------------------------------

import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const COMMIT = process.argv.includes('--commit');
const i = process.argv.indexOf('--uid');

// Matched on the note, case-insensitive. Edit here if a note differs.
const LOANS = [
  { match: /mượn anh/i, person: 'Anh', bank: null },
  { match: /mượn mẹ/i, person: 'Mẹ', bank: 'Cash' },
  { match: /mượn dv/i, person: 'DV', bank: null },
];

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore(app);

let UID = i === -1 ? null : process.argv[i + 1];
if (!UID) {
  const users = await db.collection('users').listDocuments();
  if (users.length !== 1) throw new Error(`Found ${users.length} users; pass --uid`);
  UID = users[0].id;
}

const f = (v) => (v / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const buckets = Object.fromEntries((await db.collection(`users/${UID}/buckets`).get()).docs.map((d) => [d.id, d.data()]));
const cycles = Object.fromEntries((await db.collection(`users/${UID}/cycles`).get()).docs.map((d) => [d.id, d.data()]));
const people = (await db.collection(`users/${UID}/people`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const txs = (await db.collection(`users/${UID}/transactions`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

const plan = [];
for (const loan of LOANS) {
  const hits = txs.filter((t) => !t.personId && t.direction === 'in' && loan.match.test(String(t.note ?? '')));
  if (hits.length === 0) console.log(`MISS  no "in" entry matches ${loan.match} (${loan.person})`);
  for (const t of hits) plan.push({ loan, t });
}

for (const { loan, t } of plan) {
  const b = buckets[t.bucketId];
  const c = cycles[t.cycle];
  console.log(
    `MOVE  ${new Date(t.occurredAt).toISOString().slice(0, 10)}  ${String(b?.name ?? t.bucketId).padEnd(10)} +${f(t.amountVnd).padStart(7)}  "${t.note}"` +
      `  -> from ${loan.person}, bank ${loan.bank ?? t.bank}` +
      `${b?.kind === 'fund' ? `, ${b.name} fund ${f(b.balanceVnd)} -> ${f(b.balanceVnd - t.amountVnd)}` : ''}` +
      `${c?.status === 'closed' ? `  (cycle ${t.cycle} is CLOSED: its saved totals stay as they are)` : ''}`,
  );
}

const owe = {};
for (const { loan, t } of plan) owe[loan.person] = (owe[loan.person] ?? 0) - t.amountVnd;
for (const [name, v] of Object.entries(owe)) {
  const had = people.find((p) => p.name === name);
  console.log(`PERSON ${name.padEnd(6)} ${had ? 'exists' : 'new   '} balance ${f(had?.balanceVnd ?? 0)} -> ${f((had?.balanceVnd ?? 0) + v)}`);
}

if (!COMMIT) {
  console.log(`\n${plan.length} entries. Nothing written. Add --commit to apply.`);
  process.exit(0);
}

const now = Date.now();
const batch = db.batch();
const idOf = {};
for (const name of Object.keys(owe)) {
  const had = people.find((p) => p.name === name);
  if (had) {
    idOf[name] = had.id;
    batch.update(db.doc(`users/${UID}/people/${had.id}`), { balanceVnd: FieldValue.increment(owe[name]), updatedAt: now });
  } else {
    const ref = db.collection(`users/${UID}/people`).doc();
    idOf[name] = ref.id;
    batch.set(ref, { name, balanceVnd: owe[name], archived: false, createdAt: now, updatedAt: now });
  }
}
for (const { loan, t } of plan) {
  batch.update(db.doc(`users/${UID}/transactions/${t.id}`), {
    bucketId: 'people',
    personId: idOf[loan.person],
    bank: loan.bank ?? t.bank,
    updatedAt: now,
  });
  if (buckets[t.bucketId]?.kind === 'fund') {
    batch.update(db.doc(`users/${UID}/buckets/${t.bucketId}`), { balanceVnd: FieldValue.increment(-t.amountVnd), updatedAt: now });
  }
}
await batch.commit();
console.log(`\nMoved ${plan.length} entries to People.`);
