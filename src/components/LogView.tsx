'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import BucketTile from '@/components/BucketTile';
import Numpad from '@/components/Numpad';
import { useLogData } from '@/hooks/useLogData';
import { cycleLabel, cycleProgress } from '@/lib/cycle';
import { formatVnd, pressKey, toVnd } from '@/lib/money';
import { addTransaction } from '@/lib/transactions';
import { markInteractive } from '@/lib/startup';
import { fundsOpenStore } from '@/lib/prefs';
import type { Bucket } from '@/types/fina';

export default function LogView() {
  const { uid, cycle, monthly, funds, spent, monthlyLeft, loading } = useLogData();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [buf, setBuf] = useState('');
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Mặc định gập. Mở ra rồi thì GIỮ NGUYÊN cho tới khi tự đóng - đi du lịch
  // cả tuần không phải mở lại mỗi lần.
  const fundsOpen = useSyncExternalStore(
    fundsOpenStore.subscribe,
    fundsOpenStore.get,
    fundsOpenStore.getServer,
  );

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const toggleFunds = () => fundsOpenStore.set(!fundsOpen);

  const all: Bucket[] = [...monthly, ...funds];
  const selected = all.find((b) => b.id === selectedId) ?? null;
  const amountVnd = toVnd(buf);
  const canSave = Boolean(uid && selected && amountVnd !== null && !saving);

  const onKey = useCallback((key: string) => {
    // Lần chạm đầu tiên vào numpad = lúc app thật sự dùng được.
    markInteractive();
    setBuf((cur) => pressKey(cur, key));
  }, []);

  const save = async () => {
    if (!uid || !selected || amountVnd === null) return;
    setSaving(true);
    const trimmed = note.trim();
    try {
      await addTransaction(uid, selected, amountVnd, trimmed || null);

      const isFund = selected.kind === 'fund';
      const after = isFund
        ? `${formatVnd(selected.balanceVnd - amountVnd)} left in fund`
        : (() => {
            const left = selected.baselineVnd - (spent[selected.id] ?? 0) - amountVnd;
            return left < 0
              ? `over by ${formatVnd(-left)}`
              : `${formatVnd(left)} of ${formatVnd(selected.baselineVnd)} left`;
          })();

      setToast(`${selected.name} · ${formatVnd(amountVnd)} · ${after}`);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 2600);

      // Giữ nguyên bucket đang chọn - hay log liên tiếp cùng một nhóm.
      setBuf('');
      setNote('');
    } catch {
      setToast('Could not save. Check your connection.');
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  const { month } = cycleLabel(cycle);
  const { day, total } = cycleProgress(cycle);

  if (loading) {
    return <p className="pt-6 text-sm text-muted">Loading…</p>;
  }

  if (all.length === 0) {
    return (
      <div className="pt-6">
        <p className="text-sm text-muted">
          No buckets yet. Open <span className="font-medium text-ink">Settings</span> and tap{' '}
          <span className="font-medium text-ink">Initialize buckets</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="relative pt-3">
      <header className="flex items-end justify-between border-b border-line pb-3">
        <p className="text-xs leading-snug text-muted">
          Cycle <b className="font-semibold text-ink">{month}</b>
          <br />
          Day {day} of {total}
        </p>
        <p className="text-right">
          <span className="block text-[11px] text-faint">Monthly left</span>
          <b className="text-[19px] font-semibold">{formatVnd(monthlyLeft)}</b>
        </p>
      </header>

      <Section title="Monthly">
        <div className="grid grid-cols-3 gap-1.5">
          {monthly.map((b) => (
            <BucketTile
              key={b.id}
              bucket={b}
              spentVnd={spent[b.id] ?? 0}
              selected={b.id === selectedId}
              onSelect={() => {
                setSelectedId(b.id);
                setBuf('');
              }}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Funds"
        action={
          <button
            type="button"
            onClick={toggleFunds}
            aria-expanded={fundsOpen}
            className="ml-auto flex items-center gap-1.5 text-[11px] uppercase tracking-[0.09em] text-faint"
          >
            {fundsOpen ? 'Hide' : 'Show'}
            <span className={fundsOpen ? '' : '-rotate-90'}>▼</span>
          </button>
        }
      >
        {fundsOpen && (
          <div className="grid grid-cols-3 gap-1.5">
            {funds.map((b) => (
              <BucketTile
                key={b.id}
                bucket={b}
                spentVnd={spent[b.id] ?? 0}
                selected={b.id === selectedId}
                onSelect={() => {
                  setSelectedId(b.id);
                  setBuf('');
                }}
              />
            ))}
          </div>
        )}
      </Section>

      <div className="mt-3 border-t border-line pt-3">
        <div className="flex items-baseline justify-between gap-2.5 px-1 pb-2.5">
          <span className={`text-xs ${selected ? 'font-semibold' : 'text-faint'}`}>
            {selected ? selected.name : 'Pick a bucket'}
          </span>
          <span className={`text-[34px] leading-none font-medium ${buf ? '' : 'text-faint'}`}>
            {buf || '0'}
          </span>
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          enterKeyHint="done"
          className="mb-2 w-full rounded-[9px] border border-line bg-surface-2 px-3 py-2.5 text-[13px] placeholder:text-faint"
        />

        <Numpad onKey={onKey} onSave={save} canSave={canSave} />
      </div>

      {toast && (
        <p
          role="status"
          className="pointer-events-none sticky bottom-2 mt-2 rounded-[9px] bg-ink px-3.5 py-2.5 text-[12.5px] text-bg"
        >
          {toast}
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-4">
      <h2 className="flex items-center px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
        {title}
        {action}
      </h2>
      {children}
    </section>
  );
}
