'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import BucketTile from '@/components/BucketTile';
import Numpad from '@/components/Numpad';
import { useLogData } from '@/hooks/useLogData';
import { useLogKeyboard } from '@/hooks/useLogKeyboard';
import { cycleLabel, cycleProgress } from '@/lib/cycle';
import { evalAmount, formatTyped, formatVnd, pressKey } from '@/lib/money';
import { addTransaction, deleteTransaction } from '@/lib/transactions';
import { overflowOf } from '@/lib/overflow';
import CoverSheet, { type CoverRequest } from '@/components/CoverSheet';
import Settle from '@/components/Settle';
import ToastBar, { type ToastData } from '@/components/ToastBar';
import TopBar from '@/components/TopBar';
import BucketDot from '@/components/BucketDot';
import DirectionToggle from '@/components/DirectionToggle';
import SectionTitle, { WORD } from '@/components/SectionTitle';
import { markReady } from '@/lib/startup';
import { fundsOpenStore } from '@/lib/prefs';
import type { Bucket, Transaction } from '@/types/fina';

export default function LogView() {
  const {
    uid,
    cycle,
    buckets,
    monthly,
    funds,
    goals,
    spent,
    covered,
    limitOf,
    monthlyLeft,
    budgetLeftVnd,
    loading,
    settled,
  } = useLogData();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [buf, setBuf] = useState('');
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastSeq = useRef(0);
  const showToast = (text: string, undoable: boolean) =>
    setToast({ id: ++toastSeq.current, text, undoable });
  // A few seconds to take back a mistap. Only when the transaction does not
  // trigger a cover - removing it and leaving an orphan cover is worse.
  const [undo, setUndo] = useState<{ tx: Transaction; kind: Bucket['kind'] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [coverReq, setCoverReq] = useState<CoverRequest | null>(null);
  // Money refunded: you paid for a picnic and friends paid you back. Always
  // back to 'out' after each Save so it is never left on by accident.
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  // Collapsed by default. Once opened it STAYS open until closed - a week of
  // travel does not mean reopening it every time.
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
      // The scroll area may be only ~100px taller on Safari (the address bar
      // eats space). Without scrolling, the fund tiles sit just below the
      // edge and the section looks empty.
      requestAnimationFrame(() => {
        fundsRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
      });
    }
  };

  const all: Bucket[] = [...monthly, ...funds, ...goals];

  // From here the numpad is on screen and accepts taps.
  const ready = !loading && all.length > 0;
  useEffect(() => {
    if (ready) markReady();
  }, [ready]);
  const selected = all.find((b) => b.id === selectedId) ?? null;
  const amountVnd = evalAmount(buf);
  // With a plus/minus, the big number is the TOTAL and the expression is small
  // above it - combining small amounts without a total means mental math.
  const combining = /[+-]/.test(buf);
  const canSave = Boolean(uid && selected && amountVnd !== null && !saving);

  const onKey = useCallback((key: string) => {
    setBuf((cur) => pressKey(cur, key));
  }, []);

  const save = async () => {
    if (!uid || !selected || amountVnd === null) return;
    setSaving(true);
    const trimmed = note.trim();

    // Compute the overage from the state BEFORE writing. After, the listener
    // may already include this transaction and count the overage twice.
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

      showToast(
        `${selected.name} · ${direction === 'in' ? '+' : ''}${formatVnd(amountVnd)} · ${after}`,
        overflowVnd === 0,
      );
      // A short tap on Android; iPhone ignores it.
      navigator.vibrate?.(10);
      setUndo(overflowVnd > 0 ? null : { tx: saved, kind: selected.kind });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => {
        setToast(null);
        setUndo(null);
      }, 6000);

      // Keep the selected bucket - you often log several in a row.
      setBuf('');
      setNote('');
      setDirection('out');

      // The cover dialog comes AFTER the transaction is in Firestore.
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
      showToast('Could not save. Check your connection.', false);
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
    // CoverSheet has its own numpad that takes keys. If both listened, digits
    // typed for the cover would land in the Log amount too.
    enabled: !coverReq,
  });

  const { month } = cycleLabel(cycle);
  const { day, total } = cycleProgress(cycle);

  if (loading) {
    return <p className="pt-6 text-sm text-muted">Loading…</p>;
  }

  if (all.length === 0) {
    return (
      <div>
        <TopBar>
          <h1 className="text-xl font-semibold">Log</h1>
        </TopBar>
        <p className="pt-3 text-sm text-muted">
          No buckets yet. Open <span className="font-medium text-ink">Settings</span> and tap{' '}
          <span className="font-medium text-ink">Initialize buckets</span>.
        </p>
      </div>
    );
  }

  return (
    // On Mac: bucket grid on the left, input on the right. No reason for Save
    // to sit at the bottom on a screen three times wider.
    <div className="flex h-full flex-col">
      {/* Same two rows as Summary: cycle name and gear, then day and money left. */}
      <TopBar>
        <h1 className="text-xl font-semibold">Log</h1>
      </TopBar>
      <div className="flex min-h-0 flex-1 flex-col min-[900px]:flex-row min-[900px]:gap-7">
      <div className="flex min-h-0 flex-1 flex-col">
      {/* Quiet on purpose: the amount being typed is the one big number here. */}
      <p className="flex min-h-10 shrink-0 items-center justify-between gap-3 text-[13px] text-muted">
        <span>
          {month.slice(0, 3)} · day {day} of {total}
        </span>
        <span>
          <b className="font-semibold text-ink">
            <Settle value={monthlyLeft} settled={settled}>
              {formatVnd(monthlyLeft)}
            </Settle>
          </b>{' '}
          left
        </span>
      </p>

      {/* Only this area scrolls. More buckets never push Save away. */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none">
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
              settled={settled}
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
            className={`${WORD} min-[900px]:hidden`}
          >
            {fundsOpen ? 'hide' : 'show'}
          </button>
        }
      >
        {/* Always shown on Mac: there is room, and collapsing saves nothing. */}
        <div ref={fundsRef} className={fundsOpen ? 'block' : 'hidden min-[900px]:block'}>
          <div className="grid grid-cols-3 gap-1.5">
            {funds.map((b) => (
              <BucketTile
                key={b.id}
                bucket={b}
                spentVnd={spent[b.id] ?? 0}
                selected={b.id === selectedId}
                settled={settled}
                onSelect={() => setSelectedId(b.id)}
              />
            ))}
          </div>
          {goals.length > 0 && (
            <>
              <SectionTitle className="pt-2">Goals</SectionTitle>
              <div className="grid grid-cols-3 gap-1.5">
                {goals.map((b) => (
                  <BucketTile
                    key={b.id}
                    bucket={b}
                    spentVnd={spent[b.id] ?? 0}
                    selected={b.id === selectedId}
                    settled={settled}
                    onSelect={() => setSelectedId(b.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </Section>
      </div>
      </div>

      <div className="relative shrink-0 border-t border-line pt-2.5 min-[900px]:w-[330px] min-[900px]:border-t-0 min-[900px]:pt-4">
        <div className="flex items-baseline justify-between gap-2.5 px-1 pb-2">
          {/* No hint here: the entry screen is the most crowded, and hints only
              matter while configuring. They live in Settings. */}
          <span
            className={`flex min-w-0 flex-1 items-center gap-2 text-[15px] ${selected ? 'font-medium' : 'text-faint'}`}
          >
            {selected && <BucketDot id={selected.id} />}
            <span className="truncate">{selected ? selected.name : 'Pick a bucket'}</span>
          </span>
          <span className="flex shrink-0 items-baseline gap-3.5">
            {/* out / in words, not −/+: the numpad has + and − keys for
                adding amounts, and one screen cannot give one symbol two
                meanings. */}
            <DirectionToggle direction={direction} onFlip={() => setDirection((d) => (d === 'out' ? 'in' : 'out'))} />
            <span className="flex flex-col items-end">
              {combining && (
                <span className="max-w-[190px] truncate text-[11px] leading-tight text-faint">
                  {formatTyped(buf)}
                </span>
              )}
              <span
                className={`text-[30px] leading-none font-medium ${buf ? '' : 'text-faint'}`}
              >
                {combining ? (amountVnd === null ? '…' : formatVnd(amountVnd)) : formatTyped(buf) || '0'}
              </span>
            </span>
          </span>
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note"
          enterKeyHint="done"
          className="mb-1.5 w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] placeholder:text-faint [@media(max-height:720px)]:py-1.5"
        />

        <Numpad onKey={onKey} onSave={save} canSave={canSave} ops keyboard={false} />

        <p className="hidden pb-3 text-center text-[11px] text-faint min-[900px]:block">
          Type to enter · + − combine · arrows pick a bucket · Enter saves · Esc clears · f flips
        </p>

        {coverReq && uid && (
        <CoverSheet
          uid={uid}
          request={coverReq}
          buckets={buckets}
          bufferLimitVnd={limitOf(buckets.find((b) => b.id === 'buffer') ?? coverReq.toBucket)}
          bufferUsedVnd={(spent.buffer ?? 0) + (covered.buffer ?? 0)}
          budgetLeftVnd={budgetLeftVnd}
          onDone={() => setCoverReq(null)}
        />
      )}

      <ToastBar
        toast={toast}
        onUndo={
          undo
            ? async () => {
                const target = undo;
                setUndo(null);
                setToast(null);
                if (toastTimer.current) clearTimeout(toastTimer.current);
                await deleteTransaction(uid!, target.tx, target.kind);
              }
            : null
        }
      />
      </div>
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
    <section className="pt-2">
      <SectionTitle action={action}>{title}</SectionTitle>
      {children}
    </section>
  );
}

