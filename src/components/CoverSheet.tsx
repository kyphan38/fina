'use client';

import { useState } from 'react';

import { coverOptions, createCover } from '@/lib/covers';
import { deleteTransaction } from '@/lib/transactions';
import type { Transaction } from '@/types/fina';
import { formatVnd } from '@/lib/money';
import type { Bucket } from '@/types/fina';

export interface CoverRequest {
  txId: string;
  cycle: string;
  toBucket: Bucket;
  /** Phần vượt, không phải cả giao dịch. */
  amountVnd: number;
  /** Giao dịch vừa ghi - cần đủ để xoá nếu người dùng chọn Discard. */
  tx: Transaction;
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
}: {
  uid: string;
  request: CoverRequest;
  buckets: Bucket[];
  bufferLimitVnd: number;
  bufferUsedVnd: number;
  onDone: () => void;
}) {
  const [picked, setPicked] = useState<Bucket | null>(null);
  const [discarding, setDiscarding] = useState(false);
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
      await createCover(uid, {
        txId: request.txId,
        cycle: request.cycle,
        toBucketId: request.toBucket.id,
        from,
        amountVnd: request.amountVnd,
      });
      onDone();
    } catch (err) {
      setError(`Could not save (${(err as { code?: string })?.code ?? 'unknown'}).`);
      setBusy(false);
    }
  };

  return (
    // Không có nền bấm-để-tắt và không có nút đóng: tiền đã rời tài khoản
    // rồi, nên phải chỉ ra nó đến từ đâu, hoặc bỏ hẳn bản ghi.
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
        ) : picked === null ? (
          <>
            <p className="mb-3 mt-1 text-xs text-muted">
              The money is already gone. Say where it came from.
            </p>
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

        {!discarding && picked === null && (
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
