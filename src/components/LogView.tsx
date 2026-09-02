'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import BucketTile from '@/components/BucketTile';
import Numpad from '@/components/Numpad';
import { useLogData } from '@/hooks/useLogData';
import { useLogKeyboard } from '@/hooks/useLogKeyboard';
import { cycleLabel, cycleProgress } from '@/lib/cycle';
import { formatVnd, pressKey, toVnd } from '@/lib/money';
import { addTransaction, deleteTransaction } from '@/lib/transactions';
import { overflowOf } from '@/lib/overflow';
import CoverSheet, { type CoverRequest } from '@/components/CoverSheet';
import { markReady } from '@/lib/startup';
import { fundsOpenStore } from '@/lib/prefs';
import type { Bucket, Transaction } from '@/types/fina';

export default function LogView() {
  const { uid, cycle, buckets, monthly, funds, spent, covered, limitOf, monthlyLeft, loading } =
    useLogData();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [buf, setBuf] = useState('');
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  // Vài giây để rút lại nếu vừa bấm nhầm. Chỉ có khi giao dịch không kéo
  // theo một lần bù - gỡ giao dịch mà để cover mồ côi là tệ hơn.
  const [undo, setUndo] = useState<{ tx: Transaction; kind: Bucket['kind'] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [coverReq, setCoverReq] = useState<CoverRequest | null>(null);
  // Tiền được hoàn lại: ứng tiền đi picnic rồi bạn bè trả lại. Luôn trả về
  // 'out' sau mỗi lần Save để không bao giờ lỡ để bật.
  const [direction, setDirection] = useState<'out' | 'in'>('out');
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


  const fundsRef = useRef<HTMLDivElement | null>(null);

  const toggleFunds = () => {
    const opening = !fundsOpen;
    fundsOpenStore.set(opening);
    if (opening) {
      // Vùng cuộn có thể chỉ cao hơn 100px trên Safari (thanh địa chỉ ăn mất
      // chỗ). Không cuộn tới thì các ô quỹ nằm ngay dưới mép và trông như
      // section rỗng.
      requestAnimationFrame(() => {
        fundsRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
      });
    }
  };

  const all: Bucket[] = [...monthly, ...funds];

  // Numpad đã có mặt và nhận được chạm kể từ đây.
  const ready = !loading && all.length > 0;
  useEffect(() => {
    if (ready) markReady();
  }, [ready]);
  const selected = all.find((b) => b.id === selectedId) ?? null;
  const amountVnd = toVnd(buf);
  const canSave = Boolean(uid && selected && amountVnd !== null && !saving);

  const onKey = useCallback((key: string) => {
    setBuf((cur) => pressKey(cur, key));
  }, []);

  const save = async () => {
    if (!uid || !selected || amountVnd === null) return;
    setSaving(true);
    const trimmed = note.trim();

    // Tính phần vượt bằng trạng thái TRƯỚC khi ghi. Tính sau thì listener có
    // thể đã cộng chính giao dịch này vào và phần vượt bị đếm hai lần.
    const overflowVnd = direction === 'in' ? 0 : overflowOf({
      bucketId: selected.id,
      kind: selected.kind,
      limitVnd: selected.kind === 'budget' ? limitOf(selected) : undefined,
      spentVnd: (spent[selected.id] ?? 0) + (covered[selected.id] ?? 0),
      balanceVnd: selected.balanceVnd,
      amountVnd,
    });

    try {
      const { id: txId, occurredAt } = await addTransaction(
        uid,
        selected,
        amountVnd,
        trimmed || null,
        direction,
      );

      const isFund = selected.kind === 'fund';
      const after = isFund
        ? `${formatVnd(selected.balanceVnd - amountVnd)} left in fund`
        : (() => {
            const left = limitOf(selected) - (spent[selected.id] ?? 0) - amountVnd;
            return left < 0
              ? `over by ${formatVnd(-left)}`
              : `${formatVnd(left)} of ${formatVnd(limitOf(selected))} left`;
          })();

      const saved: Transaction = {
        id: txId,
        occurredAt,
        cycle,
        bucketId: selected.id,
        bank: selected.bank,
        amountVnd,
        direction,
        note: trimmed || null,
        source: 'web',
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };

      setToast(
        `${selected.name} · ${direction === 'in' ? '+' : ''}${formatVnd(amountVnd)} · ${after}`,
      );
      setUndo(overflowVnd > 0 ? null : { tx: saved, kind: selected.kind });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => {
        setToast(null);
        setUndo(null);
      }, 6000);

      // Giữ nguyên bucket đang chọn - hay log liên tiếp cùng một nhóm.
      setBuf('');
      setNote('');
      setDirection('out');

      // Hộp thoại bù đến SAU khi giao dịch đã nằm trong Firestore.
      if (overflowVnd > 0) {
        setCoverReq({
          txId,
          cycle,
          toBucket: selected,
          amountVnd: overflowVnd,
          tx: {
            id: txId,
            occurredAt,
            cycle,
            bucketId: selected.id,
            bank: selected.bank,
            amountVnd,
            direction,
            note: trimmed || null,
            source: 'web',
            createdAt: occurredAt,
            updatedAt: occurredAt,
          },
        });
      }
    } catch {
      setToast('Could not save. Check your connection.');
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  useLogKeyboard({
    tiles: all,
    selectedId,
    onSelect: setSelectedId,
    onKey,
    onSave: () => {
      if (canSave) void save();
    },
    onClear: () => setBuf(''),
    onFlip: () => setDirection((d) => (d === 'out' ? 'in' : 'out')),
  });

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
    // Trên Mac: lưới bucket bên trái, vùng nhập bên phải. Không còn lý do
    // nào để nút Save phải nằm dưới đáy khi màn hình rộng gấp ba lần.
    <div className="flex h-full flex-col min-[900px]:flex-row min-[900px]:gap-7">
      <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-end justify-between border-b border-line pb-2.5 pt-3">
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

      {/* Chỉ vùng này cuộn. Thêm bucket bao nhiêu cũng không đẩy Save đi đâu. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
      <Section title="Monthly">
        <div className="grid grid-cols-3 gap-1.5">
          {monthly.map((b) => (
            <BucketTile
              key={b.id}
              bucket={b}
              spentVnd={spent[b.id] ?? 0}
              coveredVnd={covered[b.id] ?? 0}
              limitVnd={limitOf(b)}
              selected={b.id === selectedId}
              onSelect={() => setSelectedId(b.id)}
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
            className="ml-auto flex items-center gap-1.5 text-[11px] uppercase tracking-[0.09em] text-faint min-[900px]:hidden"
          >
            {fundsOpen ? 'Hide' : 'Show'}
            <span className={fundsOpen ? '' : '-rotate-90'}>▼</span>
          </button>
        }
      >
        {/* Trên Mac luôn hiện: có chỗ, và gập lại chẳng tiết kiệm được gì. */}
        <div
          ref={fundsRef}
          className={`grid-cols-3 gap-1.5 ${fundsOpen ? 'grid' : 'hidden min-[900px]:grid'}`}
        >
            {funds.map((b) => (
              <BucketTile
                key={b.id}
                bucket={b}
                spentVnd={spent[b.id] ?? 0}
                selected={b.id === selectedId}
                onSelect={() => setSelectedId(b.id)}
              />
            ))}
        </div>
      </Section>
      </div>
      </div>

      <div className="relative shrink-0 border-t border-line pt-2.5 min-[900px]:w-[330px] min-[900px]:border-t-0 min-[900px]:pt-4">
        <div className="flex items-baseline justify-between gap-2.5 px-1 pb-2">
          {/* Không hiện gợi ý ở đây: màn hình nhập là chỗ chật nhất, và gợi ý
              chỉ cần lúc đang cấu hình. Nó nằm ở Settings. */}
          <span className={`min-w-0 flex-1 truncate text-xs ${selected ? 'font-semibold' : 'text-faint'}`}>
            {selected ? selected.name : 'Pick a bucket'}
          </span>
          <span className="flex shrink-0 items-baseline gap-2">
            <button
              type="button"
              onClick={() => setDirection((d) => (d === 'out' ? 'in' : 'out'))}
              aria-label={direction === 'in' ? 'Money in' : 'Money out'}
              className={`rounded-md border px-2 py-0.5 text-sm font-semibold ${
                direction === 'in' ? 'border-ink bg-ink text-bg' : 'border-line text-faint'
              }`}
            >
              {direction === 'in' ? '+' : '−'}
            </button>
            <span
              className={`text-[34px] leading-none font-medium [@media(max-height:720px)]:text-[27px] ${
                buf ? '' : 'text-faint'
              }`}
            >
              {buf || '0'}
            </span>
          </span>
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          enterKeyHint="done"
          className="mb-1.5 w-full rounded-[9px] border border-line bg-surface-2 px-3 py-2 text-[13px] placeholder:text-faint [@media(max-height:720px)]:py-1.5"
        />

        <Numpad onKey={onKey} onSave={save} canSave={canSave} />

        <p className="hidden pb-3 text-center text-[11px] text-faint min-[900px]:block">
          Type to enter · arrows pick a bucket · Enter saves · Esc clears · − flips
        </p>

        {coverReq && uid && (
        <CoverSheet
          uid={uid}
          request={coverReq}
          buckets={buckets}
          bufferLimitVnd={limitOf(buckets.find((b) => b.id === 'buffer') ?? coverReq.toBucket)}
          bufferUsedVnd={(spent.buffer ?? 0) + (covered.buffer ?? 0)}
          onDone={() => setCoverReq(null)}
        />
      )}

      {toast && (
          <p
            role="status"
            className="absolute inset-x-0 bottom-full mb-1.5 flex items-center gap-3 rounded-[9px] bg-ink px-3.5 py-2.5 text-[12.5px] text-bg"
          >
            <span className="min-w-0 flex-1 truncate">{toast}</span>
            {undo && (
              <button
                type="button"
                onClick={async () => {
                  const target = undo;
                  setUndo(null);
                  setToast(null);
                  if (toastTimer.current) clearTimeout(toastTimer.current);
                  await deleteTransaction(uid!, target.tx, target.kind);
                }}
                className="shrink-0 font-semibold underline"
              >
                Undo
              </button>
            )}
          </p>
        )}
      </div>
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
    <section className="pt-3">
      <h2 className="flex items-center px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
        {title}
        {action}
      </h2>
      {children}
    </section>
  );
}
