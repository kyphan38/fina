'use client';

import { useEffect, useState } from 'react';

import { updateBucket } from '@/lib/buckets';
import { createGoal, setGoalsMonthly, swapGoalOrder, watchGoalsMonthly } from '@/lib/goal-store';
import { DEFAULT_GOALS_MONTHLY_VND, openGoals, parseMonth, savingMonthlyTotal } from '@/lib/goals';
import { formatVnd, fromVnd, toVnd } from '@/lib/money';
import type { Bucket, Goal } from '@/types/fina';

const INPUT =
  'w-full min-w-0 rounded-md border border-line bg-surface-2 px-2 py-1 text-right text-sm';

/** '' and '0' mean zero here; toVnd() rejects zero because it is for entries. */
function amountOrZero(raw: string): number | null {
  const t = raw.trim();
  return t === '' || t === '0' ? 0 : toVnd(t);
}

/** '' means "not known yet" for a target price. */
function amountOrNull(raw: string): number | null | undefined {
  const t = raw.trim();
  if (t === '') return null;
  return toVnd(t) ?? undefined;
}

export default function GoalsCard({ uid, buckets }: { uid: string; buckets: Bucket[] }) {
  const goals = openGoals(buckets);
  const [budget, setBudget] = useState(DEFAULT_GOALS_MONTHLY_VND);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => watchGoalsMonthly(uid, setBudget), [uid]);

  const used = savingMonthlyTotal(buckets);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(`Could not save (${(err as { code?: string })?.code ?? 'unknown'}).`);
    }
  };

  const saveGoal = (b: Bucket, patch: Partial<Goal>) =>
    run(() => updateBucket(uid, b.id, { goal: { ...b.goal!, ...patch } }));

  return (
    <section className="rounded-xl border border-line bg-surface px-4 py-3">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Goals</h2>

      {goals.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {goals.map((b, i) => (
            <li key={b.id} className="py-2.5">
              <div className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.name}</span>
                <span className="text-xs text-muted">{formatVnd(b.balanceVnd)} saved</span>
                <span className="flex gap-1">
                  <OrderButton
                    label={`Move ${b.name} up`}
                    disabled={i === 0}
                    onClick={() => run(() => swapGoalOrder(uid, b, goals[i - 1]))}
                  >
                    ↑
                  </OrderButton>
                  <OrderButton
                    label={`Move ${b.name} down`}
                    disabled={i === goals.length - 1}
                    onClick={() => run(() => swapGoalOrder(uid, b, goals[i + 1]))}
                  >
                    ↓
                  </OrderButton>
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 min-[600px]:grid-cols-4">
                <Field label="Target">
                  <input
                    defaultValue={b.goal?.targetVnd ? fromVnd(b.goal.targetVnd) : ''}
                    inputMode="decimal"
                    placeholder="-"
                    aria-label={`${b.name} target`}
                    onBlur={(e) => {
                      const v = amountOrNull(e.target.value);
                      if (v !== undefined && v !== b.goal?.targetVnd) void saveGoal(b, { targetVnd: v });
                    }}
                    className={INPUT}
                  />
                </Field>
                <Field label="Month">
                  <input
                    type="month"
                    defaultValue={b.goal?.targetMonth ?? ''}
                    aria-label={`${b.name} month`}
                    onBlur={(e) => {
                      const v = parseMonth(e.target.value);
                      if (v !== undefined && v !== b.goal?.targetMonth) void saveGoal(b, { targetMonth: v });
                    }}
                    className={INPUT}
                  />
                </Field>
                <Field label="Per month">
                  <input
                    defaultValue={fromVnd(b.standardVnd)}
                    inputMode="decimal"
                    aria-label={`${b.name} per month`}
                    onBlur={(e) => {
                      const v = amountOrZero(e.target.value);
                      if (v !== null && v !== b.standardVnd) {
                        void run(() => updateBucket(uid, b.id, { standardVnd: v }));
                      }
                    }}
                    className={INPUT}
                  />
                </Field>
                <Field label="Status">
                  <select
                    value={b.goal?.status ?? 'saving'}
                    aria-label={`${b.name} status`}
                    onChange={(e) => void saveGoal(b, { status: e.target.value as Goal['status'] })}
                    className={INPUT}
                  >
                    <option value="saving">Saving</option>
                    <option value="later">Later</option>
                  </select>
                </Field>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <NewGoalForm
          onCancel={() => setAdding(false)}
          onAdd={(input) =>
            run(async () => {
              await createGoal(uid, buckets, input);
              setAdding(false);
            })
          }
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 rounded-lg border border-line px-3 py-1.5 text-xs"
        >
          New goal
        </button>
      )}

      <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
        <span className="flex-1 text-sm">Goals per month</span>
        <input
          key={budget}
          defaultValue={fromVnd(budget)}
          inputMode="decimal"
          aria-label="Goals per month"
          onBlur={(e) => {
            const v = amountOrZero(e.target.value);
            if (v !== null && v !== budget) void run(() => setGoalsMonthly(uid, v));
          }}
          className="w-24 shrink-0 rounded-md border border-line bg-surface-2 px-2 py-1 text-right text-sm"
        />
      </div>
      <p className={`mt-1.5 text-xs ${used > budget ? 'font-medium text-over' : 'text-muted'}`}>
        Saving goals use {formatVnd(used)} of {formatVnd(budget)}
        {used > budget ? ` - over by ${formatVnd(used - budget)}` : ''}
      </p>

      {error && <p className="mt-2 text-xs font-medium text-over">{error}</p>}
    </section>
  );
}

function NewGoalForm({
  onAdd,
  onCancel,
}: {
  onAdd: (input: {
    name: string;
    targetVnd: number | null;
    targetMonth: string | null;
    standardVnd: number;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [month, setMonth] = useState('');
  const [perMonth, setPerMonth] = useState('');

  const targetVnd = amountOrNull(target);
  const targetMonth = parseMonth(month);
  const standardVnd = amountOrZero(perMonth);
  const valid =
    name.trim() !== '' && targetVnd !== undefined && targetMonth !== undefined && standardVnd !== null;

  return (
    <div className="mt-2 rounded-lg border border-line p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        aria-label="Goal name"
        autoFocus
        className="w-full rounded-md border border-line bg-surface-2 px-2 py-1 text-sm"
      />
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Field label="Target">
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            inputMode="decimal"
            placeholder="-"
            aria-label="New goal target"
            className={INPUT}
          />
        </Field>
        <Field label="Month">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="New goal month"
            className={INPUT}
          />
        </Field>
        <Field label="Per month">
          <input
            value={perMonth}
            onChange={(e) => setPerMonth(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            aria-label="New goal per month"
            className={INPUT}
          />
        </Field>
      </div>
      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          disabled={!valid}
          onClick={() =>
            valid &&
            onAdd({
              name: name.trim(),
              targetVnd: targetVnd ?? null,
              targetMonth: targetMonth ?? null,
              standardVnd: standardVnd ?? 0,
            })
          }
          className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-bg disabled:opacity-30"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-line px-3 py-1.5 text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-faint">{label}</span>
      {children}
    </label>
  );
}

function OrderButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-line px-1.5 text-xs leading-5 text-faint disabled:opacity-30"
    >
      {children}
    </button>
  );
}
