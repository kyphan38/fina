'use client';

import { useState } from 'react';

import Numpad from '@/components/Numpad';
import { coverOptions, createCover } from '@/lib/covers';
import { deleteTransaction } from '@/lib/transactions';
import type { Transaction } from '@/types/fina';
import { evalAmount, formatVnd, fromVnd, pressKey } from '@/lib/money';
import type { Bucket } from '@/types/fina';

export interface CoverRequest {
  txId: string;
  cycle: string;
  toBucket: Bucket;
  /** The overage, not the whole transaction. */
  amountVnd: number;
  /** The transaction just saved - enough to delete it if the user picks Discard. */
  tx: Transaction;
}

/**
 * Cover dialog. Shows AFTER the transaction is saved - closing it loses no
 * record, only leaves a reminder strip.
 */
export default function CoverSheet({
  uid,
  request,
  buckets,
  bufferLimitVnd,
  bufferUsedVnd,
  onDone,
}: {
  uid: string;
  request: CoverRequest;
  buckets: Bucket[];
  bufferLimitVnd: number;
  bufferUsedVnd: number;
  onDone: () => void;
}) {
  // The shortfall is only a SUGGESTION. The real transfer is the user's call:
  // short 500 but sending 505 to round it, or a bit extra to avoid opening
  // the bank app again.
  const [amountVnd, setAmountVnd] = useState(request.amountVnd);
  const [editing, setEditing] = useState(false);
  const [buf, setBuf] = useState('');

  const [picked, setPicked] = useState<Bucket | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = coverOptions({
    buckets,
    toBucketId: request.toBucket.id,
    bufferLimitVnd,
    bufferUsedVnd,
    // A new amount means "enough or not" is checked against the NEW number,
    // not the original shortfall.
    neededVnd: amountVnd,
  });

  const draft = evalAmount(buf);
  const combining = /[+-]/.test(buf);
  const diff = amountVnd - request.amountVnd;

  const commit = async (from: Bucket) => {
    setBusy(true);
    setError(null);
    try {
      await createCover(uid, {
        txId: request.txId,
        cycle: request.cycle,
        to: request.toBucket,
        from,
        amountVnd,
      });
      onDone();
    } catch (err) {
      setError(`Could not save (${(err as { code?: string })?.code ?? 'unknown'}).`);
      setBusy(false);
    }
  };

  return (
    // No tap-outside and no close button: the money already left the account,
    // so either say where it came from, or drop the record.
    <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/40">
      <div className="flex-1" />
      <div className="max-h-[88dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface px-4 pb-4 pt-4">
        <h2 className="text-sm font-semibold">
          {request.toBucket.name} over by {formatVnd(request.amountVnd)}
        </h2>

        {discarding ? (
          <>
            <p className="mb-4 mt-2 text-sm">
              Delete this entry instead of covering it?
            </p>
            <p className="mb-4 text-xs text-muted">
              The money still left your account. Your balance in fina will no longer
              match the bank.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await deleteTransaction(uid, request.tx, request.toBucket.kind);
                  onDone();
                } catch (err) {
                  setError(`Could not delete (${(err as { code?: string })?.code ?? 'unknown'}).`);
                  setBusy(false);
                }
              }}
              className="w-full rounded-[10px] bg-over py-3 text-sm font-semibold text-bg disabled:opacity-30"
            >
              {busy ? 'Deleting…' : 'Delete the entry'}
            </button>
            <button
              type="button"
              onClick={() => setDiscarding(false)}
              className="mt-1 w-full py-2 text-xs text-muted"
            >
              Back
            </button>
          </>
        ) : editing ? (
          <>
            {/* Same numpad as Log, so '500+5' gives 505 - no mental math and
                retyping. */}
            <div className="mb-1 mt-3 flex items-baseline justify-between px-1">
              <span className="text-xs text-muted">Move</span>
              <span className="flex flex-col items-end">
                {combining && (
                  <span className="max-w-[190px] truncate text-[11px] leading-tight text-faint">
                    {buf}
                  </span>
                )}
                <span
                  className={`text-[30px] leading-none font-medium ${buf ? '' : 'text-faint'}`}
                >
                  {combining ? (draft === null ? '…' : formatVnd(draft)) : buf || '0'}
                </span>
              </span>
            </div>
            <Numpad
              ops
              onKey={(k) => setBuf((c) => pressKey(c, k))}
              onSave={() => {
                if (draft === null) return;
                setAmountVnd(draft);
                setEditing(false);
              }}
              canSave={draft !== null}
              saveLabel="Done"
            />
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="w-full py-2 text-xs text-muted"
            >
              Back
            </button>
          </>
        ) : picked === null ? (
          <>
            <p className="mb-3 mt-1 text-xs text-muted">
              The money is already gone. Say where it came from.
            </p>

            {/* Dashed border so it is not mistaken for a source in the list below. */}
            <button
              type="button"
              onClick={() => {
                setBuf(fromVnd(amountVnd));
                setEditing(true);
              }}
              className="mb-2 flex w-full items-baseline justify-between rounded-[10px] border border-dashed border-line px-3 py-2.5 text-left"
            >
              <span className="text-xs text-muted">Move</span>
              <span className="flex items-baseline gap-2">
                <b className="text-sm font-semibold">{formatVnd(amountVnd)}</b>
                <span className="text-[10px] uppercase tracking-wider text-faint">Adjust</span>
              </span>
            </button>

            {diff !== 0 && (
              <p className="mb-2 px-1 text-[11px] text-faint">
                {diff > 0
                  ? `${formatVnd(diff)} more than the gap.`
                  : `${request.toBucket.name} stays ${formatVnd(-diff)} over after this.`}
              </p>
            )}

            <ul className="flex flex-col gap-1.5">
              {options.map((o) => (
                <li key={o.bucket.id}>
                  <button
                    type="button"
                    disabled={!o.enough || busy}
                    // A different bank means the transfer strip asks again, so
                    // go straight in. Same bank is final on tap - this is the
                    // last chance to change your mind, so ask once.
                    onClick={() =>
                      o.bucket.bank === request.toBucket.bank
                        ? setPicked(o.bucket)
                        : void commit(o.bucket)
                    }
                    className="flex w-full items-baseline justify-between rounded-[10px] border border-line px-3 py-3 text-left disabled:opacity-30"
                  >
                    <span className="text-sm">
                      {o.bucket.name}
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-faint">
                        {o.bucket.bank}
                      </span>
                    </span>
                    <span className="text-xs text-muted">{formatVnd(o.availableVnd)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="mb-4 mt-2 text-sm">
              Take {formatVnd(amountVnd)} from{' '}
              <b className="font-semibold">{picked.name}</b>?
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void commit(picked)}
              className="w-full rounded-[10px] bg-ink py-3 text-sm font-semibold text-bg disabled:opacity-30"
            >
              {busy ? 'Saving…' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="mt-1 w-full py-2 text-xs text-muted"
            >
              Back
            </button>
          </>
        )}

        {error && <p className="mt-3 text-xs font-medium text-over">{error}</p>}

        {!discarding && !editing && picked === null && (
          <button
            type="button"
            onClick={() => setDiscarding(true)}
            className="mt-3 w-full py-2 text-xs text-muted"
          >
            Discard this entry instead
          </button>
        )}
      </div>
    </div>
  );
}
