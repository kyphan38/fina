'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import AmountSheet from '@/components/AmountSheet';
import SalaryGate from '@/components/SalaryGate';
import { useAuth } from '@/contexts/AuthContext';
import { clockStore } from '@/lib/clock';
import { cycleLabel, cycleOf } from '@/lib/cycle';
import { gateStore } from '@/lib/gate';
import { formatVnd } from '@/lib/money';
import { average, byYear, removeSalary, setSalary, watchSalaries } from '@/lib/salary';
import type { Salary } from '@/types/fina';

export default function SalaryView() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  // Server luôn render KHOÁ; client đọc phiên thật ngay sau khi hydrate.
  const unlocked = useSyncExternalStore(
    gateStore.subscribe,
    gateStore.get,
    gateStore.getServer,
  );

  const [rows, setRows] = useState<Salary[]>([]);
  const [editing, setEditing] = useState<string | null>(null);

  const now = useSyncExternalStore(clockStore.subscribe, clockStore.get, clockStore.getServer);
  const currentCycle = useMemo(() => cycleOf(new Date(now)), [now]);

  useEffect(() => {
    if (!uid || !unlocked) return;
    return watchSalaries(uid, setRows);
  }, [uid, unlocked]);

  const years = useMemo(() => byYear(rows), [rows]);
  const avg = useMemo(() => average(rows), [rows]);
  const thisCycle = rows.find((r) => r.cycle === currentCycle) ?? null;

  if (!unlocked) return <SalaryGate />;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-6">
      <header className="flex items-center justify-between border-b border-line pb-2.5 pt-3">
        <h1 className="text-lg font-semibold">Salary</h1>
        <button
          type="button"
          onClick={() => {
            gateStore.lock();
            setRows([]);
          }}
          className="text-[11px] uppercase tracking-[0.09em] text-faint"
        >
          Lock
        </button>
      </header>

      <Block title={cycleLabel(currentCycle).month}>
        <div className="flex items-baseline justify-between">
          <span className="text-[26px] font-semibold">
            {thisCycle ? formatVnd(thisCycle.amountVnd) : '-'}
          </span>
          <button
            type="button"
            onClick={() => setEditing(currentCycle)}
            className="rounded-[10px] border border-line px-3 py-1.5 text-xs"
          >
            {thisCycle ? 'Change' : 'Add'}
          </button>
        </div>
        {thisCycle?.note && <p className="mt-1 text-xs text-muted">{thisCycle.note}</p>}
      </Block>

      {rows.length > 0 && (
        <Block title="By month">
          <Chart rows={rows} />
        </Block>
      )}

      {years.length > 0 && (
        <Block title="By year">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="text-faint">
                <th className="pb-1.5 text-left font-medium">Year</th>
                <th className="pb-1.5 font-medium">Months</th>
                <th className="pb-1.5 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.year} className="border-t border-line">
                  <td className="py-1.5 text-left">{y.year}</td>
                  <td>{y.months}</td>
                  <td className="font-semibold">{formatVnd(y.totalVnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-faint">
            Average of the {rows.length} month{rows.length === 1 ? '' : 's'} recorded:{' '}
            {formatVnd(avg)}. Months you never entered are left out, not counted as zero.
          </p>
        </Block>
      )}

      <Block title="All entries">
        {rows.length === 0 ? (
          <p className="text-xs text-muted">Nothing recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-xs">
            {rows.map((r) => {
              const { month, year } = cycleLabel(r.cycle);
              return (
                <li key={r.cycle} className="flex items-baseline gap-2.5 border-t border-line pt-1.5">
                  <span className="w-20 shrink-0 text-muted">
                    {month.slice(0, 3)} {year}
                  </span>
                  <span className="font-medium">{formatVnd(r.amountVnd)}</span>
                  <span className="ml-auto flex shrink-0 gap-3">
                    <button
                      type="button"
                      onClick={() => setEditing(r.cycle)}
                      className="text-faint underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => uid && void removeSalary(uid, r.cycle)}
                      className="text-faint underline"
                    >
                      Delete
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Block>

      {editing && (
        <AmountSheet
          title={`Salary for ${cycleLabel(editing).month}`}
          confirmLabel="Save"
          onCancel={() => setEditing(null)}
          onConfirm={async (amountVnd, note) => {
            if (uid) await setSalary(uid, editing, amountVnd, note);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Cột là con TRỰC TIẾP của khung cao cố định - `height: %` chỉ có mốc để so
 * khi cha có chiều cao xác định. Bọc thêm một lớp cao auto là mọi cột tụt
 * xuống bằng nhau và biểu đồ trông như không có dữ liệu.
 */
function Chart({ rows }: { rows: Salary[] }) {
  // Cũ trước, đọc từ trái sang phải. Tối đa 12 tháng gần nhất cho vừa màn hình.
  const recent = [...rows].reverse().slice(-12);
  const peak = Math.max(...recent.map((r) => r.amountVnd), 1);

  return (
    <>
      <div className="flex h-28 items-end gap-1.5">
        {recent.map((r) => (
          <span
            key={r.cycle}
            title={`${cycleLabel(r.cycle).month}: ${formatVnd(r.amountVnd)}`}
            className="flex-1 rounded-t-[3px]"
            style={{
              height: `${Math.max(0, (r.amountVnd / peak) * 100)}%`,
              minHeight: r.amountVnd > 0 ? 3 : 0,
              background: 'var(--b6)',
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {recent.map((r) => (
          <span key={r.cycle} className="flex-1 text-center text-[10px] text-faint">
            {cycleLabel(r.cycle).month.slice(0, 3)}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-faint">
        Peak is {formatVnd(peak)}. Bars are what you typed in, nothing derived.
      </p>
    </>
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
