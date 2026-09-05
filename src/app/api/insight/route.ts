import { NextResponse, type NextRequest } from 'next/server';

import { adminDb } from '@/lib/firebase-admin';
import { getSessionUser } from '@/lib/server-auth';
import { sanitizeInsight } from '@/lib/insight-sanitize';
import type { Digest } from '@/lib/digest';

const MODEL = 'gemini-3.8-flash';
const WINDOW_MS = 5 * 60_000;
const MAX_CALLS = 10;

/**
 * Model chỉ được diễn đạt lại những con số đã có sẵn. Nó không được tính,
 * không được đoán nguyên nhân, không được khuyên.
 */
const SYSTEM = `You describe a personal budget in plain, flat sentences.

Rules, all absolute:
- Use ONLY numbers that appear in the JSON. Never compute a new one.
- Never explain why something happened. You cannot know.
- Never judge, advise, or suggest. No "should", no "too much".
- Never mention investing, portfolios, or returns.
- Never use medical or emotional language.
- Amounts are in thousands of dong. Write them as they appear.
- At most 4 sentences. One fact each. If nothing stands out, reply exactly:
  Nothing notable in this period.`;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Giới hạn tần suất lưu ở Firestore, không phải trong bộ nhớ.
 *
 * Serverless mỗi request có thể rơi vào một instance khác, nên bộ đếm trong
 * RAM gần như không chặn được gì. Một document là đủ, và lời gọi này vốn hiếm.
 */
async function overLimit(uid: string): Promise<boolean> {
  const ref = adminDb.doc(`users/${uid}/meta/rateLimit`);
  const now = Date.now();
  const data = (await ref.get()).data() ?? {};
  const hits: number[] = Array.isArray(data.insight) ? data.insight : [];
  const recent = hits.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_CALLS) return true;
  await ref.set({ insight: [...recent, now] }, { merge: true });
  return false;
}

export async function POST(req: NextRequest) {
  // Kiểm session TRƯỚC mọi việc khác. API này gọi Gemini nên đáng để chờ
  // thêm một vòng kiểm tra thu hồi phiên.
  const user = await getSessionUser({ checkRevoked: true });
  if (!user) return fail('Unauthorized.', 401);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail('GEMINI_API_KEY is not set.', 503);

  if (await overLimit(user.uid)) return fail('Too many requests. Try again shortly.', 429);

  let digest: Digest;
  try {
    digest = (await req.json()).digest;
    if (!digest || typeof digest !== 'object') throw new Error('bad');
  } catch {
    return fail('Invalid request body.', 400);
  }

  let text: string;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(digest) }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
        }),
      },
    );
    if (!res.ok) throw new Error(String(res.status));
    const body = await res.json();
    text = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  } catch (err) {
    // Chỉ ghi tên lỗi. Digest không bao giờ được log ở production.
    console.error('[insight] model call failed:', (err as Error).message);
    return fail('Could not reach the model.', 502);
  }

  // Lọc ở SERVER: bản thô của model không bao giờ tới được client.
  const { kept, dropped } = sanitizeInsight(text.split('\n'), digest);
  return NextResponse.json({ lines: kept, droppedCount: dropped.length });
}
