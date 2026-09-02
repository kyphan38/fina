'use client';

import { useState } from 'react';

import CycleClose from '@/components/CycleClose';
import GeneratorSheet from '@/components/GeneratorSheet';
import AmountSheet from '@/components/AmountSheet';
import { useSummary } from '@/hooks/useSummary';
import { cycleLabel, cycleProgress } from '@/lib/cycle';
import { formatVnd } from '@/lib/money';
import { addEtfDeposit } from '@/lib/transactions';
import type { Bucket } from '@/types/fina';

export default function SummaryView() {
  const s = useSummary();
  const [sheet, setSheet] = useState<'none' | 'generator' | 'etf'>('none');

  if (s.loading) return <p className="pt-6 text-sm text-muted">Loading…</p>;
  if (s.monthly.length === 0) {
    return (
      <p className="pt-6 text-sm text-muted">
        No buckets yet. Open <span className="font-medium text-ink">Settings</span> first.
      </p>
    );
  }

  if (s.needsClose && s.cycle) {
    return (
      <CycleClose
        uid={s.uid!}
        cycle={s.cycle}
        monthly={s.monthly}
        spent={s.spent}
        covered={s.covered}
        surplusVnd={s.surplus}
        pendingCount={s.pendingCovers.length}
      />
    );
  }

  const { month } = cycleLabel(s.cycleId);
  const { day, total } = cycleProgress(s.cycleId);
  const hasLimits = Object.keys(s.limits).length > 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-6">
      <header className="flex items-end justify-between border-b border-line pb-2.5 pt-3">
        <h1 className="text-lg font-semibold">{month}</h1>
        <p className="text-xs text-muted">
          Day {day} of {total}
        </p>
      </header>

      <Block title="VCB — Monthly">
        {!hasLimits && (
          <p className="pb-2 text-xs text-faint">No limits recorded for this cycle.</p>
        )}
        <ul className="flex flex-col gap-2">
          {s.monthly.map((b) => (
            <BudgetRow
              key={b.id}
              bucket={b}
              spentVnd={s.spent[b.id] ?? 0}
              coveredVnd={s.covered[b.id] ?? 0}
              limit={s.limits[b.id]}
            />
          ))}
        </ul>
        <Totals
          left={`Spent ${formatVnd(s.monthlySpent)}`}
          right={
            hasLimits
              ? `Left ${formatVnd(s.monthlyLimit - s.monthlySpent)} / ${formatVnd(s.monthlyLimit)}`
              : ''
          }
        />
      </Block>

      <Block title="BIDV — Funds">
        <ul className="flex flex-col gap-2">
          {s.funds.map((b) => (
            <FundRow key={b.id} bucket={b} />
          ))}
        </ul>
        <Totals left="Total" right={formatVnd(s.fundsTotal)} />
      </Block>

      <Block title="VPS">
        <div className="flex items-center justify-between">
          <span className="text-sm">ETF</span>
          <span className="flex items-center gap-3">
            <b className="text-sm font-semibold">{formatVnd(s.etf?.balanceVnd ?? 0)}</b>
            <button
              type="button"
              onClick={() => setSheet('etf')}
              className="rounded-lg border border-line px-3 py-1.5 text-xs"
            >
              Add deposit
            </button>
          </span>
        </div>
      </Block>

      <button
        type="button"
        onClick={() => setSheet('generator')}
        className="mt-5 w-full rounded-[10px] border border-line py-3 text-sm font-medium"
      >
        Plan next cycle →
      </button>

      {sheet === 'generator' && (
        <GeneratorSheet
          buckets={s.buckets}
          incomeVnd={s.cycle?.incomeVnd ?? null}
          onClose={() => setSheet('none')}
        />
      )}

      {sheet === 'etf' && (
        <AmountSheet
          title="Add ETF deposit"
          confirmLabel="Add"
          onCancel={() => setSheet('none')}
          onConfirm={async (amountVnd, note) => {
            if (s.uid) await addEtfDeposit(s.uid, amountVnd, note);
            setSheet('none');
          }}
        />
      )}
    </div>
  );
}

function BudgetRow({
  bucket,
  spentVnd,
  coveredVnd,
  limit,
}: {
  bucket: Bucket;
  spentVnd: number;
  /** Phần đã rút khỏi bucket này để bù cho bucket khác. */
  coveredVnd: number;
  limit: number | undefined;
}) {
  // Buffer bị rút để bù chỗ khác vẫn là "đã dùng", dù không có giao dịch nào.
  const used = spentVnd + coveredVnd;
  const over = limit !== undefined && used > limit;
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <li>
      <div className="flex items-baseline justify-between text-sm">
        <span>{bucket.name}</span>
        <span className={over ? 'text-over' : 'text-muted'}>
          {formatVnd(used)}
          {limit !== undefined && ` / ${formatVnd(limit)}`}
          {over && ` · −${formatVnd(used - limit)}`}
        </span>
      </div>
      <span className="mt-1 block h-1 w-full rounded-full bg-sunk">
        <span
          className={`block h-full rounded-full ${over ? 'bg-over' : 'bg-muted'}`}
          style={{ width: `${over ? 100 : pct}%` }}
        />
      </span>
    </li>
  );
}

function FundRow({ bucket }: { bucket: Bucket }) {
  const goal = bucket.goal;
  const pct = goal && goal.targetVnd > 0 ? Math.min(100, (bucket.balanceVnd / goal.targetVnd) * 100) : null;

  return (
    <li>
      <div className="flex items-baseline justify-between text-sm">
        <span>{bucket.name}</span>
        <span className={bucket.balanceVnd < 0 ? 'text-over' : 'text-muted'}>
          {formatVnd(bucket.balanceVnd)}
        </span>
      </div>
      {goal && (
        <>
          <p className="mt-0.5 text-[11px] text-faint">
            Goal {formatVnd(goal.targetVnd)} · {goal.targetDate}
          </p>
          <span className="mt-1 block h-1 w-full rounded-full bg-sunk">
            <span className="block h-full rounded-full bg-muted" style={{ width: `${pct}%` }} />
          </span>
        </>
      )}
    </li>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-xl border border-line bg-surface px-4 py-3">
      <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Totals({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-3 flex justify-between border-t border-line pt-2 text-xs font-medium">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}
