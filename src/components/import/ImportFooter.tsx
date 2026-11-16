import { bucketAccent } from '@/lib/bucket-color';
import { formatVnd } from '@/lib/money';
import type { Bucket } from '@/types/fina';

/** Per-bucket totals, the last error, Discard (tap twice) and Save. */
export default function ImportFooter({
  totals,
  byId,
  error,
  entries,
  saving,
  confirmDiscard,
  onDiscard,
  onDiscardBlur,
  onSave,
}: {
  totals: [string, number][];
  byId: Map<string, Bucket>;
  error: string | null;
  entries: number;
  saving: boolean;
  confirmDiscard: boolean;
  onDiscard: () => void;
  onDiscardBlur: () => void;
  onSave: () => void;
}) {
  return (
      <footer className="shrink-0 border-t border-line pb-3 pt-2.5">
        {totals.length > 0 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 px-1 pb-2 text-xs">
            {totals.map(([id, vnd]) => (
              <li key={id} className="flex items-center gap-1.5">
                <i
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: bucketAccent(id) }}
                />
                {byId.get(id)?.name ?? id}
                <b className="font-semibold">{formatVnd(vnd)}</b>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="pb-2 text-xs font-medium text-over">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDiscard}
            onBlur={onDiscardBlur}
            className={`rounded-[10px] border px-4 py-3 text-sm ${
              confirmDiscard ? 'border-over bg-over font-semibold text-bg' : 'border-line text-muted'
            }`}
          >
            {confirmDiscard ? 'Tap again' : 'Discard'}
          </button>
          <button
            type="button"
            disabled={entries === 0 || saving}
            onClick={onSave}
            className="flex-1 rounded-[10px] bg-ink py-3 text-sm font-semibold text-bg disabled:opacity-30"
          >
            {saving
              ? 'Saving…'
              : `Save ${entries} ${entries === 1 ? 'entry' : 'entries'}`}
          </button>
        </div>
      </footer>
  );
}
