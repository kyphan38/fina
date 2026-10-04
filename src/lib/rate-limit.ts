import 'server-only';

import { adminDb } from '@/lib/firebase-admin';

/**
 * Giới hạn tần suất lưu ở Firestore, không phải trong bộ nhớ.
 *
 * Serverless mỗi request có thể rơi vào một instance khác, nên bộ đếm trong
 * RAM gần như không chặn được gì. Một document là đủ, và các lời gọi này vốn
 * hiếm. Mỗi API một field riêng trong cùng document.
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
