// ============================================================
// fina - Bucket identity colors
//
// Six hues, tied to EACH BUCKET, not to position. Reorder the display and
// Food stays blue - the color follows the thing, not its rank.
//
// Only these six hues passed the color-blind validator. A seventh bucket gets
// a neutral color, NOT a reused hue: reuse falsely says two buckets are related.
//
// Funds have no color on purpose. The dashed border already marks them as a
// different group, and that section is opened only a few times a month.
// ============================================================

const ACCENT: Record<string, string> = {
  food: 'var(--b1)',
  beauty: 'var(--b2)',
  social: 'var(--b3)',
  tech: 'var(--b4)',
  utilities: 'var(--b5)',
  buffer: 'var(--b6)',
};

/** The bucket's color, or a neutral color when it has none. */
export function bucketAccent(bucketId: string): string {
  return ACCENT[bucketId] ?? 'var(--muted)';
}

/** Whether this bucket has its own color. Decides whether to draw the color bar. */
export function hasAccent(bucketId: string): boolean {
  return bucketId in ACCENT;
}
