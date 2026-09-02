'use client';

import { useState } from 'react';

import { coverOptions, createCover } from '@/lib/covers';
import { formatVnd } from '@/lib/money';
import type { Bucket, Cover } from '@/types/fina';

export interface CoverRequest {
  txId: string;
  cycle: string;
  toBucket: Bucket;
  amountVnd: number;
}

/**
 * Hộp thoại bù tiền. Hiện SAU khi giao dịch đã lưu - tắt nó đi cũng không
 * mất record, chỉ còn lại một dải nhắc.
 */
export default function CoverSheet({
  uid,
  request,
  buckets,
  bufferLimitVnd,
  bufferUsedVnd,
  onDone,
  onDismiss,
}: {
  uid: string;
  request: CoverRequest;
  buckets: Bucket[];
  bufferLimitVnd: number;
  bufferUsedVnd: number;
  onDone: (cover: Cover) => void;
  onDismiss: () => void;
}) {
  const [picked, setPicked] = useState<Bucket | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = coverOptions({
    buckets,
    toBucketId: request.toBucket.id,
    bufferLimitVnd,
    bufferUsedVnd,
    neededVnd: request.amountVnd,
  });

  const commit = async (from: Bucket) => {
    setBusy(true);
    setError(null);
    try {
      const cover = await createCover(uid, {
        txId: request.txId,
        cycle: request.cycle,
        toBucketId: request.toBucket.id,
        from,
        amountVnd: request.amountVnd,
      });
      onDone(cover);
    } catch (err) {
      setError(`Could not save (${(err as { code?: string })?.code ?? 'unknown'}).`);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/30">
      <button type="button" aria-label="Dismiss" className="flex-1" onClick={onDismiss} />
      <div className="max-h-[88dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface px-4 pb-4 pt-4">
        <h2 className="text-sm font-semibold">
          {request.toBucket.name} over by {formatVnd(request.amountVnd)}
        </h2>

        {picked === null ? (
          <>
            <p className="mb-3 mt-1 text-xs text-muted">Cover it from where?</p>
            <ul className="flex flex-col gap-1.5">
              {options.map((o) => (
                <li key={o.bucket.id}>
                  <button
                    type="button"
                    disabled={!o.enough || busy}
                    onClick={() =>
                      o.bucket.bank === 'VCB' ? setPicked(o.bucket) : void commit(o.bucket)
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
              Take {formatVnd(request.amountVnd)} from{' '}
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

        {error && <p className="mt-3 text-xs text-over">{error}</p>}

        <button type="button" onClick={onDismiss} className="mt-2 w-full py-2 text-xs text-muted">
          Decide later
        </button>
      </div>
    </div>
  );
}
