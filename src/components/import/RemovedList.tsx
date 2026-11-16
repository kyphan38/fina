import { formatVnd } from '@/lib/money';
import { timeOf } from '@/lib/momo-import';
import type { DraftRow } from '@/lib/import-draft';

/** Rows taken out of the table (by hand, or already imported), with Add back. */
export default function RemovedList({ rows, onAddBack }: { rows: DraftRow[]; onAddBack: (id: string) => void }) {
  if (rows.length === 0) return null;
  return (
    <section className="pt-5">
      <h2 className="px-1 pb-1.5 text-[13px] font-medium text-muted">
        Removed
      </h2>
      <ul className="divide-y divide-line rounded-[10px] border border-dashed border-line">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2.5 px-3 py-2 text-[12px] text-faint">
            <span className="w-[74px] shrink-0">
              {timeOf(r.occurredAt)} · {new Date(r.occurredAt).getDate()}/
              {new Date(r.occurredAt).getMonth() + 1}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {r.removed === 'imported' && (
                <b className="font-semibold text-muted">Already imported · </b>
              )}
              {r.title}
            </span>
            <span className="shrink-0">
              {r.direction === 'in' ? '+' : ''}
              {formatVnd(r.amountVnd)}
            </span>
            <button
              type="button"
              onClick={() => onAddBack(r.id)}
              className="shrink-0 font-semibold text-ink"
            >
              Add back
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
