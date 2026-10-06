import 'server-only';

import { adminDb } from '@/lib/firebase-admin';

/**
 * Rate limits are stored in Firestore, not in memory.
 *
 * In serverless each request may hit a different instance, so an in-RAM
 * counter blocks almost nothing. One document is enough, and these calls are
 * rare. Each API has its own field in the same document.
 */
export async function overLimit(
  uid: string,
  field: string,
  maxCalls: number,
  windowMs: number,
): Promise<boolean> {
  const ref = adminDb.doc(`users/${uid}/meta/rateLimit`);
  const now = Date.now();
  const data = (await ref.get()).data() ?? {};
  const hits: number[] = Array.isArray(data[field]) ? data[field] : [];
  const recent = hits.filter((t) => now - t < windowMs);

  if (recent.length >= maxCalls) return true;
  await ref.set({ [field]: [...recent, now] }, { merge: true });
  return false;
}
