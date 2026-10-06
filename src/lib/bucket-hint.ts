// ============================================================
// fina - A bucket's description (hint): what belongs in it.
//
// Kept out of buckets.ts so tests do not load Firebase.
// The length cap must match validBucket in firestore.rules.
// ============================================================

export const HINT_MAX_LENGTH = 200;

/**
 * Trim the typed text. Empty means no description (null), so Settings shows
 * "No description" instead of an empty bubble.
 */
export function normalizeHint(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}
