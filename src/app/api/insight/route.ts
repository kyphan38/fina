import { NextResponse, type NextRequest } from 'next/server';

import { overLimit } from '@/lib/rate-limit';
import { getSessionUser } from '@/lib/server-auth';
import { sanitizeInsight } from '@/lib/insight-sanitize';
import type { Digest } from '@/lib/digest';

const MODEL = 'gemini-3.8-flash';
const WINDOW_MS = 5 * 60_000;
const MAX_CALLS = 10;

/**
 * The model may only reword numbers that already exist. It must not
 * calculate, guess causes or give advice.
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

export async function POST(req: NextRequest) {
  // Check the session BEFORE anything else. This API calls Gemini, so an
  // extra revocation check is worth the wait.
  const user = await getSessionUser({ checkRevoked: true });
  if (!user) return fail('Unauthorized.', 401);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail('GEMINI_API_KEY is not set.', 503);

  if (await overLimit(user.uid, 'insight', MAX_CALLS, WINDOW_MS)) {
    return fail('Too many requests. Try again shortly.', 429);
  }

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
    // Log the error name only. The digest is never logged in production.
    console.error('[insight] model call failed:', (err as Error).message);
    return fail('Could not reach the model.', 502);
  }

  // Filter on the SERVER: the model's raw output never reaches the client.
  const { kept, dropped } = sanitizeInsight(text.split('\n'), digest);
  return NextResponse.json({ lines: kept, droppedCount: dropped.length });
}
