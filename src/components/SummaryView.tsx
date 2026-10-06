'use client';

import { useState } from 'react';

import CycleClose from '@/components/CycleClose';
import GeneratorSheet from '@/components/GeneratorSheet';
import AmountSheet from '@/components/AmountSheet';
import MoveSheet from '@/components/MoveSheet';
import { useSummary } from '@/hooks/useSummary';
import { cycleLabel, cycleProgress } from '@/lib/cycle';
import { formatVnd, fromVnd, toVnd } from '@/lib/money';
import { bucketAccent } from '@/lib/bucket-color';
import { overrideCycleLimits } from '@/lib/cycles';
import { addEtfDeposit, addFundTopUp } from '@/lib/transactions';
import {
  etaMonth,
  goalProgress,
  monthLabel,
  needPerMonth,
  savingMonthlyTotal,
} from '@/lib/goals';
import type { Bucket } from '@/types/fina';

export default function SummaryView() {
  const s = useSummary();
  const [sheet, setSheet] = useState<'none' | 'generator' | 'etf' | 'move'>('none');
  const [topUp, setTopUp] = useState<Bucket | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [etfOpen, setEtfOpen] = useState(false);

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
        snapshot={{ byBucket: s.spent }}
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

      {/* Trên Mac ba khối đứng cạnh nhau; trên điện thoại vẫn xếp dọc. */}
      <div className="min-[900px]:grid min-[900px]:grid-cols-3 min-[900px]:items-start min-[900px]:gap-5">
      <Block
        title="VCB - Monthly"
        action={
          hasLimits && s.cycle?.status === 'open' ? (
            <button
              type="button"
              onClick={() => {
                setDraft(
                  Object.fromEntries(s.monthly.map((b) => [b.id, fromVnd(s.limits[b.id] ?? 0)])),
                );
                setEditing((v) => !v);
              }}
              className="ml-auto text-[11px] uppercase tracking-[0.09em] text-faint"
            >
              {editing ? 'Cancel' : 'Edit limits'}
            </button>
          ) : null
        }
      >
        {!hasLimits && (
          <p className="pb-2 text-xs text-faint">No limits recorded for this cycle.</p>
        )}

        {editing && (
          <>
            <p className="pb-2 text-xs text-muted">
              This cycle only. Standard amounts in Settings are untouched.
            </p>
            <ul className="flex flex-col gap-1.5">
              {s.monthly.map((b) => (
                <li key={b.id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm">{b.name}</span>
                  <input
                    value={draft[b.id] ?? ''}
                    inputMode="decimal"
                    aria-label={`${b.name} limit`}
                    onChange={(e) => setDraft((d) => ({ ...d, [b.id]: e.target.value }))}
                    className="w-24 rounded-md border border-line bg-surface-2 px-2 py-1 text-right text-sm"
                  />
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={async () => {
                if (!s.uid) return;
                const next: Record<string, number> = {};
                for (const b of s.monthly) {
                  const raw = (draft[b.id] ?? '').trim();
                  next[b.id] = raw === '' || raw === '0' ? 0 : (toVnd(raw) ?? s.limits[b.id] ?? 0);
                }
                await overrideCycleLimits(s.uid, s.cycleId, next);
                setEditing(false);
              }}
              className="mt-3 w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-bg"
            >
              Save limits
            </button>
          </>
        )}
        {!editing && (
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
        )}
        <Totals
          left={`Spent ${formatVnd(s.monthlySpent)}`}
          right={
            hasLimits
              ? `Left ${formatVnd(s.monthlyLimit - s.monthlySpent)} / ${formatVnd(s.monthlyLimit)}`
              : ''
          }
        />
      </Block>

      <Block
        title="BIDV - Funds"
        action={
          <button
            type="button"
            onClick={() => setSheet('move')}
            className="ml-auto text-[11px] uppercase tracking-[0.09em] text-faint"
          >
            Move
          </button>
        }
      >
        <ul className="flex flex-col gap-2">
          {s.funds.map((b) => (
            <FundRow key={b.id} bucket={b} onTopUp={() => setTopUp(b)} />
          ))}
        </ul>
        <Totals left={s.goals.length > 0 ? 'Total incl. goals' : 'Total'} right={formatVnd(s.fundsTotal)} />
      </Block>

      {s.goals.length > 0 && (
        <Block title="Goals">
          <ul className="flex flex-col gap-3">
            {s.goals.map((b) => (
              <GoalRow key={b.id} bucket={b} now={new Date(s.now)} onTopUp={() => setTopUp(b)} />
            ))}
          </ul>
          <Totals
            left="Per month"
            right={`${formatVnd(savingMonthlyTotal(s.goals))} / ${formatVnd(s.goalsBudget)}`}
          />
        </Block>
      )}

      <Block
        title="VPS"
        action={
          s.etfDeposits.length > 0 ? (
            <button
              type="button"
              onClick={() => setEtfOpen((v) => !v)}
              className="ml-auto text-[11px] uppercase tracking-[0.09em] text-faint"
            >
              {etfOpen ? 'Hide' : `${s.etfDeposits.length} deposits`}
            </button>
          ) : null
        }
      >
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

        {etfOpen && (
          <ul className="mt-3 flex flex-col divide-y divide-line border-t border-line">
            {s.etfDeposits.map((d) => (
              <li key={d.id} className="flex items-baseline gap-3 py-1.5 text-xs">
                <span className="w-24 shrink-0 text-faint">
                  {new Date(d.occurredAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: '2-digit',
                  })}
                </span>
                <span className="font-medium">{formatVnd(d.amountVnd)}</span>
                <span className="ml-auto truncate text-muted">{d.note ?? ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Block>

      </div>

      <button
        type="button"
        onClick={() => setSheet('generator')}
        className="mt-5 w-full rounded-[10px] border border-line py-3 text-sm font-medium"
      >
        Plan next cycle →
      </button>

      {sheet === 'generator' && (
        <GeneratorSheet
          uid={s.uid!}
          cycleId={s.cycleId}
          cycleClosed={s.cycle?.status === 'closed'}
          buckets={s.buckets}
          onClose={() => setSheet('none')}
        />
      )}

      {topUp && (
        <AmountSheet
          title={`Add to ${topUp.name}`}
          confirmLabel="Add"
          withDate
          onCancel={() => setTopUp(null)}
          onConfirm={async (amountVnd, note, occurredAt) => {
            if (s.uid) await addFundTopUp(s.uid, topUp, amountVnd, note, occurredAt);
            setTopUp(null);
          }}
        />
      )}

      {sheet === 'move' && s.uid && (
        <MoveSheet uid={s.uid} buckets={s.buckets} onClose={() => setSheet('none')} />
      )}

      {sheet === 'etf' && (
        <AmountSheet
          title="Add ETF deposit"
          confirmLabel="Add"
          onCancel={() => setSheet('none')}
          withDate
          onConfirm={async (amountVnd, note, occurredAt) => {
            if (s.uid && s.etf) await addEtfDeposit(s.uid, s.etf, amountVnd, note, occurredAt);
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
        <span className={over ? 'font-medium text-over' : 'text-muted'}>
          {formatVnd(used)}
          {limit !== undefined && ` / ${formatVnd(limit)}`}
          {over && ` · ${formatVnd(used - limit)} over`}
        </span>
      </div>
      <span className="mt-1 block h-1 w-full rounded-full bg-sunk">
        <span
          className="block h-full rounded-full"
          style={{
            width: `${over ? 100 : pct}%`,
            background: over ? 'var(--over)' : bucketAccent(bucket.id),
          }}
        />
      </span>
    </li>
  );
}

function GoalRow({ bucket, now, onTopUp }: { bucket: Bucket; now: Date; onTopUp: () => void }) {
  const g = bucket.goal!;
  const progress = goalProgress(bucket, now);
  const need = needPerMonth(bucket, now);
  const eta = progress === 'behind' ? etaMonth(bucket, now) : null;
  const pct =
    g.targetVnd && g.targetVnd > 0
      ? Math.max(0, Math.min(100, (bucket.balanceVnd / g.targetVnd) * 100))
      : null;

  const details = [
    g.targetMonth ? monthLabel(g.targetMonth) : null,
    progress === 'later' || progress === 'ready'
      ? null
      : need !== null
        ? `needs ${formatVnd(need)}/mo`
        : `${formatVnd(bucket.standardVnd)}/mo`,
    progress === 'behind'
      ? `set ${formatVnd(bucket.standardVnd)}${eta ? `, done ${monthLabel(eta)}` : ''}`
      : null,
    progress,
  ].filter(Boolean);

  return (
    <li className={progress === 'later' ? 'text-faint' : ''}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{bucket.name}</span>
        <span className="flex items-baseline gap-3">
          <span className={bucket.balanceVnd < 0 ? 'font-medium text-over' : 'text-muted'}>
            {formatVnd(bucket.balanceVnd)}
            {g.targetVnd ? ` / ${formatVnd(g.targetVnd)}` : ''}
          </span>
          <button
            type="button"
            onClick={onTopUp}
            aria-label={`Add to ${bucket.name}`}
            className="rounded-md border border-line px-1.5 text-xs leading-5 text-faint"
          >
            +
          </button>
        </span>
      </div>
      {pct !== null && progress !== 'later' && (
        <span className="mt-1 block h-1 w-full rounded-full bg-sunk">
          <span className="block h-full rounded-full bg-muted" style={{ width: `${pct}%` }} />
        </span>
      )}
      <p
        className={`mt-1 text-xs ${progress === 'behind' ? 'font-medium text-ink' : 'text-faint'}`}
      >
        {details.join(' · ')}
      </p>
    </li>
  );
}

function FundRow({ bucket, onTopUp }: { bucket: Bucket; onTopUp: () => void }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{bucket.name}</span>
        <span className="flex items-baseline gap-3">
          <span className={bucket.balanceVnd < 0 ? 'font-medium text-over' : 'text-muted'}>
            {bucket.balanceVnd < 0
              ? `${formatVnd(-bucket.balanceVnd)} over`
              : formatVnd(bucket.balanceVnd)}
          </span>
          <button
            type="button"
            onClick={onTopUp}
            aria-label={`Add to ${bucket.name}`}
            className="rounded-md border border-line px-1.5 text-xs leading-5 text-faint"
          >
            +
          </button>
        </span>
      </div>
    </li>
  );
}

function Block({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 rounded-xl border border-line bg-surface px-4 py-3">
      <h2 className="mb-2.5 flex items-center text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
        {title}
        {action}
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
