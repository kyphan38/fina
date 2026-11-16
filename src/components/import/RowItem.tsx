'use client';

import NoteInput from '@/components/import/NoteInput';
import { bucketAccent } from '@/lib/bucket-color';
import { formatVnd } from '@/lib/money';
import { timeOf, type ImportRow } from '@/lib/momo-import';
import type { Bucket } from '@/types/fina';

export default function RowItem({
  row,
  choices,
  byId,
  onPatch,
  onRemove,
}: {
  row: ImportRow;
  choices: Bucket[];
  byId: Map<string, Bucket>;
  onPatch: (change: Partial<ImportRow>) => void;
  onRemove: () => void;
}) {
  const isIn = row.direction === 'in';
  const warning =
    row.flag === 'self'
      ? 'Money back to your own bank - probably not spending.'
      : row.flag === 'income'
        ? 'Money in - saved as IN.'
        : row.flag === 'manual' && row.lookalike
          ? `Looks like ${byId.get(row.lookalike.bucketId)?.name ?? row.lookalike.bucketId} ${formatVnd(row.amountVnd)} you logged at ${timeOf(row.lookalike.occurredAt)}.`
          : null;

  return (
    <li
      className="group border-l-[3px] px-3 py-2"
      style={{ borderLeftColor: bucketAccent(row.bucketId) }}
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px]">{row.title || '·'}</span>
        <span className={`shrink-0 text-[13px] font-medium ${isIn ? 'text-muted' : ''}`}>
          {isIn ? '+' : ''}
          {formatVnd(row.amountVnd)}
        </span>
        {/* With a mouse, only shown on hover. Phones have no hover, so it is
            always shown, just faint to reduce clutter. */}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${row.title} ${formatVnd(row.amountVnd)}`}
          className="-mr-1 shrink-0 px-1 text-[15px] leading-none text-faint hover:text-over focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
        >
          ×
        </button>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="w-10 shrink-0 text-[11px] text-faint">{timeOf(row.occurredAt)}</span>
        <select
          value={row.bucketId}
          onChange={(e) => onPatch({ bucketId: e.target.value })}
          aria-label="Bucket"
          className="w-[108px] shrink-0 rounded-md border border-line bg-surface-2 px-1.5 py-1 text-xs"
        >
          {choices.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <NoteInput value={row.note} onCommit={(note) => onPatch({ note })} />
      </div>
      {warning && <p className="mt-1 text-[11px] text-up">{warning}</p>}
    </li>
  );
}
