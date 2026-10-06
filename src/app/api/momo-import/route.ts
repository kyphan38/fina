import { NextResponse, type NextRequest } from 'next/server';

import { getSessionUser } from '@/lib/server-auth';
import { overLimit } from '@/lib/rate-limit';
import { sanitizeRows, type RawRow } from '@/lib/momo-import';

const MODEL = 'gemini-3.8-flash';
const WINDOW_MS = 10 * 60_000;
const MAX_CALLS = 10;
const MAX_IMAGES = 5;
/** Client-shrunk images are ~150-300 KB. 3 MB of base64 is plenty. */
const MAX_IMAGE_CHARS = 3_000_000;
const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** The model only copies the text on the image. Sorting and dedup happen on the client. */
const PROMPT = `This is a screenshot of the transaction history in MoMo, a Vietnamese e-wallet.

Extract every transaction row in the list, top to bottom.

Rules:
- Ignore the "Giao dịch đáng chú ý" / "Lịch sắp tới" cards. They are upcoming bills, not transactions.
- Ignore headers, month labels, the search bar, and the bottom navigation.
- Skip a row if its amount, or its "HH:MM - DD/MM" line, is cut off at the top or bottom edge.
- title: the row title exactly as shown, with Vietnamese accents. Keep "..." if it is truncated.
- amount: copy the amount text character by character, exactly as shown, including the sign,
  the dots and the "đ". Do not convert it to a number. Example: "-330.000đ".
- time: "HH:MM". date: "DD/MM".
- If there are no rows, return an empty list.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    rows: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          amount: { type: 'STRING' },
          time: { type: 'STRING' },
          date: { type: 'STRING' },
        },
        required: ['title', 'amount', 'time', 'date'],
      },
    },
  },
  required: ['rows'],
};

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

interface ImageIn {
  mimeType: string;
  data: string;
}

async function readImage(key: string, image: ImageIn): Promise<RawRow[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: image.mimeType, data: image.data } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
        },
      }),
    },
  );
  if (!res.ok) throw new Error(String(res.status));
  const body = await res.json();
  const text: string = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return sanitizeRows(JSON.parse(text));
}

/**
 * Reads MoMo history screenshots. Returns rows PER IMAGE - the client needs
 * to know which row came from which image to drop the overlap between
 * neighboring images.
 *
 * Images are never stored and never logged.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser({ checkRevoked: true });
  if (!user) return fail('Unauthorized.', 401);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail('GEMINI_API_KEY is not set.', 503);

  let images: ImageIn[];
  try {
    images = (await req.json()).images;
    if (!Array.isArray(images) || images.length === 0 || images.length > MAX_IMAGES) {
      throw new Error('bad');
    }
    for (const img of images) {
      if (!MIME_TYPES.includes(img?.mimeType)) throw new Error('bad');
      if (typeof img.data !== 'string' || img.data.length > MAX_IMAGE_CHARS) throw new Error('bad');
    }
  } catch {
    return fail(`Send 1 to ${MAX_IMAGES} images.`, 400);
  }

  if (await overLimit(user.uid, 'momoImport', MAX_CALLS, WINDOW_MS)) {
    return fail('Too many requests. Try again in a few minutes.', 429);
  }

  try {
    // One call per image, in parallel: one call for all 5 images makes the
    // model mix rows across images, and the client loses track of them.
    const perImage = await Promise.all(images.map((img) => readImage(key, img)));
    return NextResponse.json({ images: perImage });
  } catch (err) {
    console.error('[momo-import] model call failed:', (err as Error).message);
    return fail('Could not read the screenshots. Try again.', 502);
  }
}
