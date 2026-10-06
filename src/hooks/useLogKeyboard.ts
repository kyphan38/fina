'use client';

import { useEffect } from 'react';

import type { Bucket } from '@/types/fina';

/**
 * The real keyboard on Mac.
 *
 * The self-drawn numpad exists to avoid the iOS keyboard. On Mac it gets in
 * the way - the keyboard is right there, yet you reach for the mouse.
 *
 * The first plan used keys `1`–`9` to pick a bucket. That fails: digits are
 * what you type most, and one key cannot be both "4" and "pick Tech".
 * Arrow keys move around the grid; digits are only for amounts.
 */
export function useLogKeyboard(args: {
  tiles: Bucket[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onKey: (key: string) => void;
  onSave: () => void;
  onClear: () => void;
  onFlip: () => void;
  columns?: number;
  /** Off while a sheet with its own numpad is open, so keys do not go to two places. */
  enabled?: boolean;
}) {
  const { tiles, selectedId, onSelect, onKey, onSave, onClear, onFlip } = args;
  const enabled = args.enabled ?? true;
  const columns = args.columns ?? 3;

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      // Typing in the Note field: the keyboard belongs to that field.
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (el instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const move = (delta: number) => {
        if (tiles.length === 0) return;
        const at = tiles.findIndex((b) => b.id === selectedId);
        const next = at === -1 ? 0 : Math.min(tiles.length - 1, Math.max(0, at + delta));
        onSelect(tiles[next].id);
      };

      switch (e.key) {
        case 'ArrowRight': move(1); break;
        case 'ArrowLeft': move(-1); break;
        case 'ArrowDown': move(columns); break;
        case 'ArrowUp': move(-columns); break;
        case 'Enter': onSave(); break;
        case 'Escape': onClear(); break;
        case 'Backspace': onKey('del'); break;
        // '-' and '+' are math, not a direction flip: the numpad has those two
        // keys for combining amounts. Flipping moved to 'f'.
        case '-':
        case '+': onKey(e.key); break;
        case 'f':
        case 'F': onFlip(); break;
        case '.':
        case ',': onKey('.'); break;
        default:
          if (!/^[0-9]$/.test(e.key)) return;
          onKey(e.key);
      }
      e.preventDefault();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tiles, selectedId, onSelect, onKey, onSave, onClear, onFlip, columns, enabled]);
}
