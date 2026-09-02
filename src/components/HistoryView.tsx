'use client';

import { useState } from 'react';

import TxEditSheet from '@/components/TxEditSheet';
import { useHistory } from '@/hooks/useHistory';
import { cycleLabel } from '@/lib/cycle';
import { formatVnd } from '@/lib/money';
import { bucketAccent, hasAccent } from '@/lib/bucket-color';
import type { Transaction } from '@/types/fina';

const DAY_FMT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };

export default function HistoryView() {
  const h = useHistory();
  const [editing, setEditing] = useState<Transaction | null>(null);

  const groups = groupByDay(h.rows);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-6">
      <header className="flex items-center gap-2 border-b border-line pb-2.5 pt-3">
        <select
          value={h.cycle}
          onChange={(e) => h.setCycle(e.target.value)}
          aria-label="Cycle"
          className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-xs"
        >
          {h.cycleIds.map((id) => {
            const { month, year } = cycleLabel(id);
            return (
              <option key={id} value={id}>
                {month} {year}
              </option>
            );
          })}
        </select>

        <select
          value={h.bucketFilter ?? ''}
          onChange={(e) => h.setBucketFilter(e.target.value || null)}
          aria-label="Bucket filter"
          className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-xs"
        >
          <option value="">All buckets</option>
          {h.buckets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        {h.allocationCount > 0 && (
          <button
            type="button"
            onClick={() => h.setShowAllocations(!h.showAllocations)}
            className="rounded-lg border border-line px-2 py-1.5 text-[11px] text-faint"
          >
            {h.showAllocations ? 'Hide' : `+${h.allocationCount}`}
          </button>
        )}

        <span className="ml-auto text-xs text-muted">
          {h.rows.length} · {formatVnd(h.total)}
        </span>
      </header>

      {h.rows.length === 0 ? (
        <p className="pt-6 text-sm text-muted">Nothing logged in this cycle.</p>
      ) : (
        groups.map(([day, txs]) => (
          <section key={day} className="pt-4">
            <h2 className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
              {day}
            </h2>
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {txs.map((t) => {
                const b = h.byId.get(t.bucketId);
                const isIn = t.direction === 'in';
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(t)}
                      className="flex w-full items-baseline gap-2.5 border-l-[3px] px-3 py-2.5 text-left"
                      style={{
                        borderLeftColor: hasAccent(t.bucketId)
                          ? bucketAccent(t.bucketId)
                          : 'transparent',
                      }}
                    >
                      <span className="w-10 shrink-0 text-[11px] text-faint min-[900px]:w-16">
                        {new Date(t.occurredAt).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="w-20 shrink-0 truncate text-[13px] min-[900px]:w-32">
                        {b?.name ?? t.bucketId}
                      </span>
                      <span
                        className={`shrink-0 text-[13px] font-medium ${isIn ? 'text-muted' : ''}`}
                      >
                        {isIn ? '+' : ''}
                        {formatVnd(t.amountVnd)}
                      </span>
                      <span className="ml-auto truncate text-right text-[12px] text-muted">
                        {t.note ?? ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {editing && h.uid && (
        <TxEditSheet
          uid={h.uid}
          tx={editing}
          buckets={h.buckets}
          beforeKind={h.byId.get(editing.bucketId)?.kind ?? 'budget'}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function groupByDay(rows: Transaction[]): [string, Transaction[]][] {
  const map = new Map<string, Transaction[]>();
  for (const t of rows) {
    const key = new Date(t.occurredAt).toLocaleDateString('en-GB', DAY_FMT);
    const list = map.get(key);
    if (list) list.push(t);
    else map.set(key, [t]);
  }
  return [...map.entries()];
}
