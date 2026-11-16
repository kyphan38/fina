'use client';

import { useState } from 'react';

import CycleClose from '@/components/CycleClose';
import GeneratorSheet from '@/components/GeneratorSheet';
import AmountSheet from '@/components/AmountSheet';
import MoveSheet from '@/components/MoveSheet';
import CloseGoalSheet from '@/components/CloseGoalSheet';
import NotesBlock from '@/components/NotesBlock';
import PaydayButton from '@/components/PaydayButton';
import TopBar from '@/components/TopBar';
import Page from '@/components/Page';
import BucketDot from '@/components/BucketDot';
import SheetShell from '@/components/SheetShell';
import { WORD, WORD_GO } from '@/components/SectionTitle';
import { useSummary } from '@/hooks/useSummary';
import { cycleLabel, cycleProgress, cycleRange } from '@/lib/cycle';
import { runOutAt } from '@/lib/run-out';
import Settle from '@/components/Settle';
import { formatVnd, fromVnd, toVnd } from '@/lib/money';
import { overrideCycleLimits } from '@/lib/cycles';
import { addEtfDeposit, addFundTopUp } from '@/lib/transactions';
import { savingMonthlyTotal } from '@/lib/goals';
import type { Bucket } from '@/types/fina';
import { Block, BudgetRow, FundRow, GoalRow, TOP_UP, Totals } from '@/components/SummaryRows';

export default function SummaryView() {
  const s = useSummary();
  const [sheet, setSheet] = useState<'none' | 'generator' | 'etf' | 'move'>('none');
  const [topUp, setTopUp] = useState<Bucket | null>(null);
  const [closing, setClosing] = useState<Bucket | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [etfOpen, setEtfOpen] = useState(false);

  if (s.loading) return <p className="pt-6 text-sm text-muted">Loading…</p>;
  if (s.monthly.length === 0) {
    return (
      <div>
        <TopBar>
          <h1 className="text-xl font-semibold">Summary</h1>
        </TopBar>
        <p className="pt-3 text-sm text-muted">
          No buckets yet. Open <span className="font-medium text-ink">Settings</span> first.
        </p>
      </div>
    );
  }

  if (s.closing) {
    return (
      <CycleClose
        uid={s.uid!}
        cycle={s.closing.cycle}
        monthly={s.monthly}
        spent={s.closing.spent}
        covered={s.closing.covered}
        surplusVnd={s.closing.surplus}
        snapshot={{ byBucket: s.closing.spent }}
        pendingCount={s.closing.pendingCount}
      />
    );
  }

  const { month } = cycleLabel(s.cycleId);
  const { day, total } = cycleProgress(s.cycleId);
  const hasLimits = Object.keys(s.limits).length > 0;

  const monthlyLeft = s.monthlyLimit - s.monthlySpent;

  return (
    <Page
      top={
        <TopBar>
          <h1 className="text-xl font-semibold">Summary</h1>
        </TopBar>
      }
    >
      <div className="flex min-h-10 items-center gap-3 text-[13px] text-muted">
        <p>
          {month.slice(0, 3)} · day {day} of {total}
        </p>
        {s.uid && <PaydayButton uid={s.uid} now={s.now} />}
      </div>

      {/* The one number the page is for. Spent sits beside it, small. */}
      {hasLimits ? (
        <div className="pb-2">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <b className={`text-[30px] leading-tight font-semibold ${monthlyLeft < 0 ? 'text-over' : ''}`}>
              <Settle value={monthlyLeft} settled={s.settled}>
                {formatVnd(Math.abs(monthlyLeft))}
              </Settle>
            </b>
            <span className="text-[13px] text-muted">
              {monthlyLeft < 0 ? 'over' : 'left'} of {formatVnd(s.monthlyLimit)}
            </span>
          </p>
          <p className="text-[13px] text-faint">Spent {formatVnd(s.monthlySpent)}</p>
        </div>
      ) : (
        <p className="pb-2 text-[13px] text-faint">Spent {formatVnd(s.monthlySpent)}</p>
      )}

      {/* On Mac the three blocks sit side by side; on a phone they stack. */}
      <div className="min-[900px]:grid min-[900px]:grid-cols-3 min-[900px]:items-start min-[900px]:gap-5">
      <Block
        first
        title="Monthly · VCB"
        action={
          hasLimits && s.cycle?.status === 'open' ? (
            <button
              type="button"
              onClick={() => {
                setDraft(
                  Object.fromEntries(s.monthly.map((b) => [b.id, fromVnd(s.limits[b.id] ?? 0)])),
                );
                setEditing(true);
              }}
              className={WORD}
            >
              edit limits
            </button>
          ) : null
        }
      >
        {!hasLimits && (
          <p className="pb-2 text-[13px] text-faint">No limits recorded for this cycle.</p>
        )}
        <ul className="flex flex-col gap-2">
          {s.monthly.map((b) => (
            <BudgetRow
              key={b.id}
              bucket={b}
              spentVnd={s.spent[b.id] ?? 0}
              coveredVnd={s.covered[b.id] ?? 0}
              limit={s.limits[b.id]}
              settled={s.settled}
              runOut={
                b.evenlySpent && s.limits[b.id] !== undefined
                  ? runOutAt({
                      usedVnd: (s.spent[b.id] ?? 0) + (s.covered[b.id] ?? 0),
                      limitVnd: s.limits[b.id],
                      ...cycleRange(s.cycleId),
                      now: s.now,
                    })
                  : null
              }
            />
          ))}
        </ul>
      </Block>

      <Block
        title="Funds · BIDV"
        action={
          <button type="button" onClick={() => setSheet('move')} className={WORD}>
            move
          </button>
        }
      >
        <ul className="flex flex-col gap-2">
          {s.funds.map((b) => (
            <FundRow key={b.id} bucket={b} settled={s.settled} onTopUp={() => setTopUp(b)} />
          ))}
        </ul>
        <Totals
          settled={s.settled}
          left={s.goals.length > 0 ? 'Total incl. goals' : 'Total'}
          right={formatVnd(s.fundsTotal)}
        />
      </Block>

      {s.goals.length > 0 && (
        <Block title="Goals">
          <ul className="flex flex-col gap-3">
            {s.goals.map((b) => (
              <GoalRow
                key={b.id}
                bucket={b}
                now={new Date(s.now)}
                settled={s.settled}
                onTopUp={() => setTopUp(b)}
                onClose={() => setClosing(b)}
              />
            ))}
          </ul>
          <Totals
            settled={s.settled}
            left="Per month"
            right={`${formatVnd(savingMonthlyTotal(s.goals))} / ${formatVnd(s.goalsBudget)}`}
          />
        </Block>
      )}

      <Block
        title="Investments · VPS"
        action={
          s.etfDeposits.length > 0 ? (
            <button type="button" onClick={() => setEtfOpen((v) => !v)} className={WORD}>
              {etfOpen ? 'hide' : `${s.etfDeposits.length} deposits`}
            </button>
          ) : null
        }
      >
        <div className="flex items-center justify-between gap-3 text-[15px]">
          <span>ETF</span>
          <span className="flex items-baseline gap-3">
            <b className="font-semibold">{formatVnd(s.etf?.balanceVnd ?? 0)}</b>
            <button type="button" onClick={() => setSheet('etf')} className={TOP_UP}>
              add
            </button>
          </span>
        </div>

        {etfOpen && (
          <ul className="mt-3 flex flex-col divide-y divide-line border-t border-line">
            {s.etfDeposits.map((d) => (
              <li key={d.id} className="flex items-baseline gap-3 py-1.5 text-[13px]">
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

      <p className="mt-6">
        <button type="button" onClick={() => setSheet('generator')} className={`${WORD_GO} text-[15px]`}>
          Plan next cycle
        </button>
      </p>

      {s.uid && <NotesBlock uid={s.uid} />}

      {editing && (
        <LimitsSheet
          monthly={s.monthly}
          draft={draft}
          setDraft={setDraft}
          onCancel={() => setEditing(false)}
          onSave={async () => {
            if (!s.uid) return;
            const next: Record<string, number> = {};
            for (const b of s.monthly) {
              const raw = (draft[b.id] ?? '').trim();
              next[b.id] = raw === '' || raw === '0' ? 0 : (toVnd(raw) ?? s.limits[b.id] ?? 0);
            }
            await overrideCycleLimits(s.uid, s.cycleId, next);
            setEditing(false);
          }}
        />
      )}

      {sheet === 'generator' && (
        <GeneratorSheet
          uid={s.uid!}
          cycleId={s.cycleId}
          cycleClosed={s.cycle?.status === 'closed'}
          buckets={s.buckets}
          goalsBudgetVnd={s.goalsBudget}
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

      {closing && s.uid && (
        <CloseGoalSheet
          uid={s.uid}
          goal={closing}
          buckets={s.buckets}
          onClose={() => setClosing(null)}
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
    </Page>
  );
}

/** This cycle's limits. Settings keeps the standard amounts. */
function LimitsSheet({
  monthly,
  draft,
  setDraft,
  onCancel,
  onSave,
}: {
  monthly: Bucket[];
  draft: Record<string, string>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onCancel: () => void;
  onSave: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <SheetShell
      onClose={onCancel}
      label="Edit limits"
      locked={busy}
      className="max-h-[92dvh] overflow-y-auto overflow-x-hidden rounded-t-[10px] border-t border-line bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
      header={
        <div className="pb-1">
          <p className="text-[15px] font-semibold">Edit limits</p>
          <p className="text-[13px] text-faint">This cycle only.</p>
        </div>
      }
    >
      <ul className="flex flex-col divide-y divide-line">
        {monthly.map((b) => (
          <li key={b.id} className="flex items-center gap-3 py-2">
            <span className="flex flex-1 items-center gap-2 text-[15px]">
              <BucketDot id={b.id} />
              {b.name}
            </span>
            <input
              value={draft[b.id] ?? ''}
              inputMode="decimal"
              aria-label={`${b.name} limit`}
              onChange={(e) => setDraft((d) => ({ ...d, [b.id]: e.target.value }))}
              className="w-28 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-right text-[15px]"
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onSave();
          } finally {
            setBusy(false);
          }
        }}
        className="mt-3 w-full rounded-[10px] bg-ink py-3 text-[15px] font-semibold text-bg disabled:opacity-30"
      >
        {busy ? 'Saving…' : 'Save limits'}
      </button>
      <button type="button" onClick={onCancel} className={`${WORD} w-full py-3 text-center`}>
        Cancel
      </button>
    </SheetShell>
  );
}
