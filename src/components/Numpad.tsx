'use client';

import { useEffect, useEffectEvent } from 'react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;

/**
 * A self-drawn number pad, NOT the iOS keyboard.
 *
 * iOS will not open the keyboard when the app opens (it needs a tap first),
 * and the keyboard animation costs ~250ms. Drawing our own means the keys
 * are there the moment the screen shows - the whole reason the app exists.
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
  /** Show + and − keys to combine several small amounts in one entry. */
  ops?: boolean;
  /**
   * Takes keys from a real keyboard on Mac. Off on the Log screen - there
   * useLogKeyboard handles it, and also uses arrow keys to pick a bucket.
   */
  keyboard?: boolean;
}) {
  // useEffectEvent: always reads the latest onKey/canSave without removing
  // and re-adding the listener after every key.
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    // Typing in the Note, date or select field: the key belongs to that field.
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
    // Block Enter too: a numpad button just clicked still has focus, and by
    // default Enter would "press" it again and add a digit.
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
      {/* A separate row, NOT squeezed into the digit grid: the twelve keys sit
          where the fingers have long expected them, and moving them to fit two
          more is a bad trade. It also keeps the operation apart from the number. */}
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
