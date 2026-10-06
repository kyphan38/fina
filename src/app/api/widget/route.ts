import { createHash, timingSafeEqual } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';

import { cycleOf } from '@/lib/cycle';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { coveredOf, vnWallClock, widgetData } from '@/lib/widget';
import type { Bucket, Cover, Transaction } from '@/types/fina';

// ============================================================
// GET /api/widget - numbers for the Scriptable widget on iPhone.
//
// The widget has no session cookie, so the gate here is a separate token
// (WIDGET_TOKEN) in the Authorization header. It only opens this endpoint,
// and the endpoint only READS: a leaked token shows spending numbers, but
// cannot change anything and never shows salary. Changing the token on
// Vercel revokes it at once.
// ============================================================

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Constant-time compare. Hash first so both sides always have the same length. */
function sameToken(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function GET(req: NextRequest) {
  const expected = process.env.WIDGET_TOKEN;
  if (!expected) return fail('WIDGET_TOKEN is not set.', 503);

  const header = req.headers.get('authorization') ?? '';
  const got = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!got || !sameToken(got, expected)) return fail('Unauthorized.', 401);

  // The app has one user: the owner of ALLOWED_USER_EMAIL.
  const email = process.env.ALLOWED_USER_EMAIL;
  if (!email) return fail('ALLOWED_USER_EMAIL is not set.', 503);

  let uid: string;
  try {
    uid = (await adminAuth.getUserByEmail(email)).uid;
  } catch {
    return fail('User not found.', 404);
  }

  const now = vnWallClock(new Date());
  const user = adminDb.collection('users').doc(uid);
  const cycle = cycleOf(now);

  const [bucketSnap, txSnap, cycleSnap, coverSnap] = await Promise.all([
    user.collection('buckets').get(),
    user.collection('transactions').where('cycle', '==', cycle).get(),
    user.collection('cycles').doc(cycle).get(),
    user.collection('covers').where('cycle', '==', cycle).get(),
  ]);

  const buckets = bucketSnap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      name: String(x.name ?? d.id),
      kind: x.kind === 'fund' ? 'fund' : 'budget',
      order: Number(x.order ?? 0),
      active: x.active !== false,
    } as Bucket;
  });

  const txs = txSnap.docs.map((d) => {
    const x = d.data();
    return {
      bucketId: String(x.bucketId ?? ''),
      amountVnd: Number(x.amountVnd ?? 0),
      direction: x.direction === 'in' ? 'in' : 'out',
    } as Transaction;
  });

  const covers = coverSnap.docs.map((d) => {
    const x = d.data();
    return {
      fromBucketId: String(x.fromBucketId ?? ''),
      toBucketId: String(x.toBucketId ?? ''),
      amountVnd: Number(x.amountVnd ?? 0),
      status: x.status === 'done' ? 'done' : 'pending',
    } as Cover;
  });

  const limits = (cycleSnap.data()?.limits as Record<string, number> | undefined) ?? {};

  const data = widgetData({ now, buckets, txs, limits, covered: coveredOf(covers) });

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
