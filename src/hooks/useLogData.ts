'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { watchBuckets } from '@/lib/buckets';
import { spentByBucket, watchCycleTransactions } from '@/lib/transactions';
import { cycleOf } from '@/lib/cycle';
import { clockStore } from '@/lib/clock';
import type { Bucket, Transaction } from '@/types/fina';

/**
 * Hai listener cho cả màn hình Log: buckets (12 doc) và giao dịch của chu kỳ
 * hiện tại (một query). Cả hai đều huỷ khi unmount.
 */
export function useLogData() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);

  // Đồng hồ dùng chung nhịp mỗi phút, nên app đang mở sẵn lúc nửa đêm ngày
  // 25 vẫn tự sang chu kỳ mới. Chuỗi cycle không đổi thì listener không
  // đăng ký lại.
  const now = useSyncExternalStore(clockStore.subscribe, clockStore.get, clockStore.getServer);
  const cycle = useMemo(() => cycleOf(new Date(now)), [now]);

  useEffect(() => {
    if (!uid) return;
    return watchBuckets(uid, setBuckets);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return watchCycleTransactions(uid, cycle, setTxs);
  }, [uid, cycle]);

  const spent = useMemo(() => spentByBucket(txs), [txs]);

  const { monthly, funds } = useMemo(() => {
    const active = (buckets ?? []).filter((b) => b.active);
    return {
      monthly: active.filter((b) => b.kind === 'budget'),
      // ETF nằm ngoài lưới Log: tiền chỉ ĐI VÀO nó, không đi ra. Ghi một
      // giao dịch vào ETF sẽ trừ số dư - ngược hoàn toàn. Khoản nạp ETF do
      // Generator và bước đóng sổ lo (Stage 3).
      funds: active.filter((b) => b.kind === 'fund' && b.id !== 'etf'),
    };
  }, [buckets]);

  const monthlyLeft = useMemo(
    () => monthly.reduce((sum, b) => sum + Math.max(0, b.baselineVnd - (spent[b.id] ?? 0)), 0),
    [monthly, spent],
  );

  return {
    uid,
    cycle,
    buckets,
    monthly,
    funds,
    spent,
    monthlyLeft,
    /** null = chưa tải xong; mảng rỗng = đã tải và chưa seed bucket nào. */
    loading: buckets === null,
  };
}
