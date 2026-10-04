'use client';

import { useEffect, useEffectEvent } from 'react';

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
  ops = false,
  keyboard = true,
}: {
  onKey: (key: string) => void;
  onSave: () => void;
  canSave: boolean;
  saveLabel?: string;
  /** Hiện phím + và − để gộp nhiều khoản nhỏ trong một lần gõ. */
  ops?: boolean;
  /**
   * Nhận phím từ bàn phím thật trên Mac. Tắt ở màn Log - ở đó
   * useLogKeyboard đã lo, và còn dùng thêm phím mũi tên để chọn bucket.
   */
  keyboard?: boolean;
}) {
  // useEffectEvent: luôn đọc onKey/canSave mới nhất mà không phải gỡ rồi gắn
  // lại listener sau mỗi phím gõ.
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    // Đang gõ trong ô Note, ô ngày, hay ô chọn thì phím thuộc về ô đó.
    const el = document.activeElement;
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (/^[0-9]$/.test(e.key)) onKey(e.key);
    else if (e.key === '.' || e.key === ',') onKey('.');
    else if (e.key === 'Backspace') onKey('del');
    else if (ops && (e.key === '+' || e.key === '-')) onKey(e.key);
    else if (e.key === 'Enter') {
      if (canSave) onSave();
    } else return;
    // Chặn cả Enter: nút numpad vừa bấm chuột vẫn đang giữ focus, để mặc định
    // thì Enter "bấm" lại nút đó và gõ thêm một chữ số.
    e.preventDefault();
  });

  useEffect(() => {
    if (!keyboard) return;
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [keyboard]);

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
      {/* Hàng riêng, KHÔNG chen vào lưới số: mười hai phím kia đã nằm đúng
          chỗ ngón tay quen từ lâu, xê dịch chúng để nhét thêm hai phím là
          đánh đổi tệ. Ở đây cũng tách bạch phép tính khỏi con số. */}
      {ops && (
        <div className="col-span-3 grid grid-cols-2 gap-1.5">
          {(['+', '-'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onKey(k)}
              aria-label={k === '+' ? 'Plus' : 'Minus'}
              className="rounded-[10px] border border-line bg-surface-2 py-2.5 text-[19px] active:bg-sunk [@media(max-height:720px)]:py-1.5"
            >
              {k === '-' ? '−' : k}
            </button>
          ))}
        </div>
      )}

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
