'use client';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;

/**
 * Bàn phím số tự vẽ, KHÔNG dùng bàn phím iOS.
 *
 * iOS không cho tự mở bàn phím khi app vừa mở (phải có cử chỉ chạm trước),
 * và animation bàn phím tốn ~250ms. Tự vẽ thì phím đã nằm sẵn ngay khi
 * màn hình hiện ra - đó là toàn bộ lý do app này tồn tại.
 */
export default function Numpad({
  onKey,
  onSave,
  canSave,
  saveLabel = 'Save',
}: {
  onKey: (key: string) => void;
  onSave: () => void;
  canSave: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          aria-label={k === 'del' ? 'Delete' : k}
          className="rounded-[10px] border border-line bg-surface-2 py-3 text-[19px] active:bg-sunk [@media(max-height:720px)]:py-2"
        >
          {k === 'del' ? '⌫' : k}
        </button>
      ))}
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        className="col-span-3 mt-0.5 mb-2 rounded-[10px] bg-ink py-3.5 text-sm font-semibold text-bg disabled:opacity-30 [@media(max-height:720px)]:py-2.5"
      >
        {saveLabel}
      </button>
    </div>
  );
}
