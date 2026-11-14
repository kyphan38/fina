'use client';

import { useState } from 'react';

import { buildDigest } from '@/lib/digest';
import { canAnalyze, type Signals } from '@/lib/signals';
import { readInsight, saveInsight, type StoredInsight } from '@/lib/insights-store';
import SectionTitle, { WORD } from '@/components/SectionTitle';

/**
 * Runs the notes. Cached by `digestHash`, so reopening without changes sends
 * no request.
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
      <p className="mt-6 text-[13px] text-muted">
        Needs 3 closed cycles (now {signals.closedCount}).
      </p>
    );
  }

  return (
    <section className="mt-7">
      <SectionTitle
        className="mb-1.5"
        action={
          result && (
            <button type="button" onClick={() => void run(true)} disabled={busy} className={WORD}>
              refresh
            </button>
          )
        }
      >
        Notes
      </SectionTitle>

      {result === null ? (
        <button
          type="button"
          onClick={() => void run(false)}
          disabled={busy}
          className="rounded-[10px] bg-ink px-4 py-2.5 text-[15px] font-semibold text-bg disabled:opacity-30"
        >
          {busy ? 'Reading…' : 'Analyse this cycle'}
        </button>
      ) : result.lines.length === 0 ? (
        <p className="text-[15px] text-muted">Nothing notable in this period.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {result.lines.map((line, n) => (
            <li key={n} className="text-[15px] leading-relaxed">
              {line}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-[13px] font-medium text-over">{error}</p>}

      {result && result.droppedCount > 0 && (
        <p className="mt-2.5 text-[13px] text-faint">
          {result.droppedCount} sentence{result.droppedCount > 1 ? 's' : ''} removed (wrong
          number or advice).
        </p>
      )}
    </section>
  );
}
