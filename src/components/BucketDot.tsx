import { bucketAccent, hasAccent } from '@/lib/bucket-color';

/**
 * The only place a bucket's color shows: a small dot before its name.
 * Funds have no color, so they get an empty spot of the same width when
 * `keepSpace` is set, and names in a list still line up.
 */
export default function BucketDot({ id, keepSpace = false }: { id: string; keepSpace?: boolean }) {
  if (!hasAccent(id)) {
    return keepSpace ? <span aria-hidden="true" className="w-2 shrink-0" /> : null;
  }
  return (
    <span
      aria-hidden="true"
      className="size-2 shrink-0 rounded-full"
      style={{ background: bucketAccent(id) }}
    />
  );
}
