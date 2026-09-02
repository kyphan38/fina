// ---------------------------------------------------------------------------
// fina - Ap bo so chuan moi len cac bucket da co trong Firestore.
//
//   node --import ./scripts/register.mjs --env-file=.env.local \
//     scripts/apply-standards.mjs --uid <UID> [--commit]
//
// Mac dinh CHI IN RA (dry run). Doc thang SEED_BUCKETS cua app, khong chep lai.
// Chi dung name / baselineVnd / standardVnd / hint / goal.
// KHONG dung balanceVnd, active, order - do la du lieu nguoi dung.
// ---------------------------------------------------------------------------

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { SEED_BUCKETS } from '@/types/fina';

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

const f = (v) => (v / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const col = db.collection(`users/${UID}/buckets`);
const existing = new Map((await col.get()).docs.map((d) => [d.id, d.data()]));

const changes = [];
for (const seed of SEED_BUCKETS) {
  const cur = existing.get(seed.id);
  if (!cur) {
    changes.push({ id: seed.id, why: 'CHUA CO - tao moi', patch: null });
    continue;
  }
  const patch = {};
  if (cur.name !== seed.name) patch.name = seed.name;
  if (cur.baselineVnd !== seed.baselineVnd) patch.baselineVnd = seed.baselineVnd;
  if (cur.standardVnd !== seed.standardVnd) patch.standardVnd = seed.standardVnd;
  if (cur.hint !== seed.hint) patch.hint = seed.hint;
  if (JSON.stringify(cur.goal ?? null) !== JSON.stringify(seed.goal)) patch.goal = seed.goal;

  if (Object.keys(patch).length > 0) {
    changes.push({ id: seed.id, why: null, patch, before: cur });
  }
}

if (changes.length === 0) {
  console.log('Khong co gi phai doi.');
  process.exit(0);
}

console.log(`\n${changes.length} bucket se doi:\n`);
for (const c of changes) {
  if (!c.patch) {
    console.log(`  ${c.id.padEnd(12)} ${c.why}`);
    continue;
  }
  console.log(`  ${c.id}`);
  for (const [k, v] of Object.entries(c.patch)) {
    const before = c.before[k];
    const show = (x) =>
      k.endsWith('Vnd') ? f(Number(x ?? 0)) : x === null ? 'null' : JSON.stringify(x);
    console.log(`    ${k.padEnd(12)} ${show(before)}  ->  ${show(v)}`);
  }
}

if (!COMMIT) {
  console.log('\nDry run. Them --commit de ghi that.');
  process.exit(0);
}

const batch = db.batch();
for (const c of changes) {
  const seed = SEED_BUCKETS.find((s) => s.id === c.id);
  if (!c.patch) {
    batch.set(col.doc(c.id), {
      ...seed,
      balanceVnd: 0,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  } else {
    batch.update(col.doc(c.id), { ...c.patch, updatedAt: Date.now() });
  }
}
await batch.commit();
console.log(`\nDa cap nhat ${changes.length} bucket.`);
