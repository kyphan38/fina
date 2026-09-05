'use client';

import { useEffect } from 'react';

import type { Bucket } from '@/types/fina';

/**
 * Bàn phím thật trên Mac.
 *
 * Numpad tự vẽ sinh ra để giải quyết bàn phím iOS. Trên Mac nó thành thứ cản
 * trở - có bàn phím ngay đó mà phải đưa tay ra chuột.
 *
 * Plan ban đầu định dùng phím `1`–`9` để chọn bucket. Không được: số là thứ
 * cần gõ nhiều nhất, và một phím không thể vừa là "4" vừa là "chọn Tech".
 * Dùng phím mũi tên để di chuyển trong lưới, số dành trọn cho số tiền.
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
}) {
  const { tiles, selectedId, onSelect, onKey, onSave, onClear, onFlip } = args;
  const columns = args.columns ?? 3;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Đang gõ trong ô Note thì bàn phím thuộc về ô đó.
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
        // '-' và '+' là phép tính, không phải đảo chiều tiền: numpad đã có
        // hai phím đó để gộp nhiều khoản. Đảo chiều dời sang 'f' (flip).
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
  }, [tiles, selectedId, onSelect, onKey, onSave, onClear, onFlip, columns]);
}
