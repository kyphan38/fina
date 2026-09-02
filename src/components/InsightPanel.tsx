'use client';

import { useState } from 'react';

import { buildDigest } from '@/lib/digest';
import { canAnalyze, type Signals } from '@/lib/signals';
import { readInsight, saveInsight, type StoredInsight } from '@/lib/insights-store';

/**
 * Nút chạy nhận xét. Cache theo `digestHash`, nên mở lại mà không sửa gì thì
 * không có request nào.
 */
export default function InsightPanel({ uid, signals }: { uid: string; signals: Signals }) {
  const [result, setResult] = useState<StoredInsight | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = canAnalyze(signals);

  const run = async (force: boolean) => {
    setBusy(true);
    setError(null);
    const digest = buildDigest(signals);
    try {
      if (!force) {
        const cached = await readInsight(uid, signals.cycleId, digest);
        if (cached) {
          setResult(cached);
          return;
        }
      }
      const res = await fetch('/api/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digest }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? 'Could not analyse this period.');
        return;
      }
      setResult(await saveInsight(uid, signals.cycleId, digest, body.lines, body.droppedCount));
    } catch {
      setError('Could not analyse this period.');
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <p className="mt-5 text-xs text-muted">
        Written notes need three closed cycles; there {signals.closedCount === 1 ? 'is' : 'are'}{' '}
        {signals.closedCount}. Two points make a line but not a trend.
      </p>
    );
  }

  return (
    <section className="mt-5 rounded-xl border border-line bg-surface px-4 py-3">
      <h2 className="mb-2.5 flex items-center text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
        Notes
        {result && (
          <button
            type="button"
            onClick={() => void run(true)}
            disabled={busy}
            className="ml-auto text-[11px] uppercase tracking-[0.09em] text-faint"
          >
            Refresh
          </button>
        )}
      </h2>

      {result === null ? (
        <button
          type="button"
          onClick={() => void run(false)}
          disabled={busy}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg disabled:opacity-30"
        >
          {busy ? 'Reading…' : 'Analyse this cycle'}
        </button>
      ) : result.lines.length === 0 ? (
        <p className="text-sm text-muted">Nothing notable in this period.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {result.lines.map((line, n) => (
            <li key={n} className="text-sm leading-relaxed">
              {line}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-xs text-over">{error}</p>}

      {result && result.droppedCount > 0 && (
        <p className="mt-2.5 text-[11px] text-faint">
          {result.droppedCount} sentence{result.droppedCount > 1 ? 's' : ''} discarded for
          quoting a number that is not in the data, or for advising.
        </p>
      )}
    </section>
  );
}
