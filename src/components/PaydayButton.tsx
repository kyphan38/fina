'use client';

import { useState } from 'react';

import { cycleLabel, earlyPaydayCycle } from '@/lib/cycle';
import { startCycleToday } from '@/lib/payday';

/**
 * "Salary came early" for the rare case the payday rule does not know
 * (Tet, a holiday). Shown only in the week before the next cycle starts.
 */
export default function PaydayButton({ uid, now }: { uid: string; now: number }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = now > 0 ? earlyPaydayCycle(new Date(now)) : null;
  if (!next) return null;
  const { month } = cycleLabel(next);

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="ml-auto text-xs text-faint underline-offset-4 hover:text-ink hover:underline"
      >
        Paid today?
      </button>
    );
  }

  return (
    <span className="ml-auto flex items-center gap-3 text-xs">
      <span className="text-muted">Start {month} today?</span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await startCycleToday(uid, new Date());
            setAsking(false);
          } catch (err) {
            setError(`Could not start (${(err as { code?: string })?.code ?? 'unknown'}).`);
          } finally {
            setBusy(false);
          }
        }}
        className="font-semibold text-ink disabled:opacity-30"
      >
        Start
      </button>
      <button type="button" onClick={() => setAsking(false)} className="text-faint">
        Cancel
      </button>
      {error && <span className="text-over">{error}</span>}
    </span>
  );
}
