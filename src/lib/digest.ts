// ============================================================
// fina - Pack the stats into small JSON for the model
//
// Raw transactions NEVER leave the device. No notes, no expense names, no
// dates. Only numbers that `signals.ts` has already computed.
// ============================================================

import { formatVnd } from '@/lib/money';
import type { Signals } from '@/lib/signals';

export interface Digest {
  cycle: string;
  day: number;
  totalDays: number;
  buckets: {
    name: string;
    spent: number;
    median: number;
    limit: number | null;
    deviationPct: number | null;
    over: string | null;
    rising: boolean;
  }[];
  pace: { name: string; elapsedPct: number; spentPct: number }[];
  outliers: { name: string; amount: number; median: number }[];
  idleFunds: { name: string; balance: number; cycles: number }[];
  negativeFunds: { name: string; balance: number }[];
}

/** Amounts go to the model in THOUSANDS, the unit the user reads on screen. */
const k = (v: number) => Math.round(v / 1000);

export function buildDigest(s: Signals): Digest {
  return {
    cycle: s.cycleId,
    day: s.day,
    totalDays: s.totalDays,
    buckets: s.buckets.map((b) => ({
      name: b.name,
      spent: k(b.currentVnd),
      median: k(b.medianVnd),
      limit: b.limitVnd === null ? null : k(b.limitVnd),
      deviationPct: b.deviationPct,
      over: b.overOf > 0 ? `${b.overCount}/${b.overOf}` : null,
      rising: b.rising,
    })),
    pace: s.pace.map((p) => ({ name: p.name, elapsedPct: p.elapsedPct, spentPct: p.spentPct })),
    outliers: s.outliers.map((o) => ({ name: o.name, amount: k(o.amountVnd), median: k(o.medianVnd) })),
    idleFunds: s.idleFunds.map((f) => ({ name: f.name, balance: k(f.balanceVnd), cycles: f.idleCycles })),
    negativeFunds: s.negativeFunds.map((f) => ({ name: f.name, balance: k(f.balanceVnd) })),
  };
}

/**
 * Every number the model may mention, raw and formatted.
 * A sentence with a number outside this set is one the model made up.
 */
export function allowedNumbers(d: Digest): Set<string> {
  const out = new Set<string>();
  const add = (v: number | null) => {
    if (v === null || !Number.isFinite(v)) return;
    const n = Math.round(Math.abs(v));
    out.add(String(n));
    out.add(formatVnd(n * 1000).replace(/[^\d]/g, ''));
    out.add(formatVnd(n * 1000));
  };

  add(d.day);
  add(d.totalDays);
  for (const b of d.buckets) {
    add(b.spent); add(b.median); add(b.limit); add(b.deviationPct);
    if (b.over) b.over.split('/').forEach((x) => add(Number(x)));
  }
  for (const p of d.pace) { add(p.elapsedPct); add(p.spentPct); }
  for (const o of d.outliers) { add(o.amount); add(o.median); }
  for (const f of d.idleFunds) { add(f.balance); add(f.cycles); }
  for (const f of d.negativeFunds) add(f.balance);
  return out;
}

/** Same data, same hash - no repeat API call. */
export function digestHash(d: Digest): string {
  const json = JSON.stringify(d);
  let h = 0;
  for (let i = 0; i < json.length; i++) {
    h = (h << 5) - h + json.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}
