'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { watchBuckets } from '@/lib/buckets';
import { clockStore } from '@/lib/clock';
import { historyCycleStore } from '@/lib/prefs';
import { cycleOf } from '@/lib/cycle';
import { listCycles } from '@/lib/cycles';
import { watchCycleTransactions } from '@/lib/transactions';
import { netSpending } from '@/lib/cashflow';
import type { Bucket, Transaction } from '@/types/fina';

export function useHistory() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const now = useSyncExternalStore(clockStore.subscribe, clockStore.get, clockStore.getServer);
  const currentCycle = useMemo(() => cycleOf(new Date(now)), [now]);

  const cycle = useSyncExternalStore(
    historyCycleStore.subscribe,
    historyCycleStore.get,
    historyCycleStore.getServer,
  );
  const setCycle = (next: string | null) => historyCycleStore.set(next);
  const [cycleIds, setCycleIds] = useState<string[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [bucketFilter, setBucketFilter] = useState<string | null>(null);
  // Khoản chia lương vào quỹ ngày 25 không phải thứ bạn muốn lướt qua mỗi
  // ngày. Ẩn mặc định, bật lên khi cần đối chiếu.
  const [showAllocations, setShowAllocations] = useState(false);

  const selected = cycle ?? currentCycle;

  useEffect(() => {
    if (!uid) return;
    return watchBuckets(uid, setBuckets);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return watchCycleTransactions(uid, selected, setTxs);
  }, [uid, selected]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void listCycles(uid).then((cs) => {
      if (cancelled) return;
      const ids = cs.map((c) => c.id);
      // Chu kỳ hiện tại có thể chưa có document (chưa mở Summary lần nào).
      setCycleIds(ids.includes(currentCycle) ? ids : [currentCycle, ...ids]);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, currentCycle]);

  const byId = useMemo(() => new Map(buckets.map((b) => [b.id, b])), [buckets]);

  const allocationCount = useMemo(
    () => txs.filter((t) => t.source === 'allocation').length,
    [txs],
  );

  const rows = useMemo(() => {
    let filtered = showAllocations ? txs : txs.filter((t) => t.source !== 'allocation');
    if (bucketFilter) filtered = filtered.filter((t) => t.bucketId === bucketFilter);
    return [...filtered].sort((a, b) => b.occurredAt - a.occurredAt);
  }, [txs, bucketFilter, showAllocations]);

  /**
   * Tổng ròng của những khoản THẬT SỰ là chi tiêu.
   *
   * Dùng chung một luật với bảng Cash flow ở Summary - hai chỗ tính chi tiêu
   * theo hai cách là hai chỗ sẽ lệch nhau.
   */
  const total = useMemo(() => netSpending(rows), [rows]);

  return {
    uid,
    buckets,
    byId,
    cycle: selected,
    cycleIds,
    setCycle,
    bucketFilter,
    setBucketFilter,
    showAllocations,
    setShowAllocations,
    allocationCount,
    rows,
    total,
  };
}
