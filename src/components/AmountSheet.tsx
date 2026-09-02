'use client';

import { useState } from 'react';

import Numpad from '@/components/Numpad';
import { pressKey, toVnd } from '@/lib/money';

/**
 * Sheet nhập một số tiền, dùng chung numpad với màn hình Log.
 * Cùng một cách gõ ở mọi nơi trong app - không có chỗ nào bắt dùng bàn phím iOS.
 */
/** yyyy-mm-ddThh:mm cho <input type="datetime-local"> theo giờ máy. */
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AmountSheet({
  title,
  confirmLabel,
  withDate = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  confirmLabel: string;
  /** Nạp bù cho hôm trước là chuyện thường, nên ETF cần chọn ngày. */
  withDate?: boolean;
  onConfirm: (
    amountVnd: number,
    note: string | null,
    occurredAt: number,
  ) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [buf, setBuf] = useState('');
  const [note, setNote] = useState('');
  const [when, setWhen] = useState(() => toLocalInput(Date.now()));
  const [busy, setBusy] = useState(false);

  const amountVnd = toVnd(buf);

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end bg-black/30">
      <button type="button" aria-label="Close" className="flex-1" onClick={onCancel} />
      <div className="rounded-t-2xl border-t border-line bg-surface px-4 pt-3">
        <div className="flex items-baseline justify-between pb-2">
          <span className="text-xs font-semibold">{title}</span>
          <span className={`text-[30px] leading-none font-medium ${buf ? '' : 'text-faint'}`}>
            {buf || '0'}
          </span>
        </div>
        {withDate && (
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            aria-label="Date and time"
            className="mb-1.5 w-full rounded-[9px] border border-line bg-surface-2 px-3 py-2 text-[13px]"
          />
        )}

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="mb-1.5 w-full rounded-[9px] border border-line bg-surface-2 px-3 py-2 text-[13px] placeholder:text-faint"
        />
        <Numpad
          onKey={(k) => setBuf((cur) => pressKey(cur, k))}
          canSave={amountVnd !== null && !busy}
          saveLabel={confirmLabel}
          onSave={async () => {
            if (amountVnd === null) return;
            setBusy(true);
            try {
              await onConfirm(amountVnd, note.trim() || null, new Date(when).getTime());
            } finally {
              setBusy(false);
            }
          }}
        />
        <button
          type="button"
          onClick={onCancel}
          className="mb-3 w-full py-2 text-center text-xs text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
