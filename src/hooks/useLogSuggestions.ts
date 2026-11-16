'use client';

import { useEffect, useMemo, useState } from 'react';

import { SUGGEST_DAYS, topAmounts, topNotes } from '@/lib/suggest';
import { listTransactionsBetween } from '@/lib/transactions';
import type { Transaction } from '@/types/fina';

/**
 * Amounts and notes often logged for the selected bucket (Log's suggestion row).
 * The last 60 days are read once when the screen opens, not watched: a few
 * hundred docs on every change is not worth it. `remember` adds a just-saved entry.
 */
export function useLogSuggestions(uid: string | null, selectedId: string | null) {
  const [history, setHistory] = useState<{ txs: Transaction[]; at: number }>({ txs: [], at: 0 });

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const now = Date.now();
    listTransactionsBetween(uid, now - SUGGEST_DAYS * 86_400_000, now)
      .then((txs) => {
        if (!cancelled) setHistory({ txs, at: now });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const amounts = useMemo(
    () => (selectedId ? topAmounts(history.txs, selectedId, history.at) : []),
    [history, selectedId],
  );
  const notes = useMemo(
    () => (selectedId ? topNotes(history.txs, selectedId, history.at) : []),
    [history, selectedId],
  );
  const remember = (tx: Transaction) => setHistory((h) => ({ ...h, txs: [...h.txs, tx] }));

  return { amounts, notes, remember };
}
