'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { watchBuckets } from '@/lib/buckets';
import { computeSurplus, ensureCycle, watchCycle } from '@/lib/cycles';
import { coveredByBucket, coveredFromOutside, watchCycleCovers } from '@/lib/covers';
import { cycleOf } from '@/lib/cycle';
import { clockStore } from '@/lib/clock';
import { spentByBucket, watchCycleTransactions } from '@/lib/transactions';
import { watchCycleIncome } from '@/lib/income';
import { cashFlow } from '@/lib/cashflow';
import type { Bucket, Cover, Cycle, Income, Transaction } from '@/types/fina';

export function useSummary() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [covers, setCovers] = useState<Cover[]>([]);
  const [income, setIncome] = useState<Income[]>([]);

  const now = useSyncExternalStore(clockStore.subscribe, clockStore.get, clockStore.getServer);
  // Trên server now = 0 -> cycleId là '1970-01', vô hại: lúc đó chưa có
  // bucket nào nên màn hình chỉ hiện Loading. Client render đầu tiên đã có
  // giờ thật.
  const cycleId = useMemo(() => cycleOf(new Date(now)), [now]);

  useEffect(() => {
    if (!uid) return;
    return watchBuckets(uid, setBuckets);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return watchCycleTransactions(uid, cycleId, setTxs);
  }, [uid, cycleId]);

  useEffect(() => {
    if (!uid) return;
    return watchCycle(uid, cycleId, setCycle);
  }, [uid, cycleId]);

  // Tạo document chu kỳ lần đầu, đóng băng limits từ baseline hiện tại.
  // Chỉ cho chu kỳ HIỆN TẠI - chu kỳ quá khứ không có document nghĩa là nó
  // có trước khi app tồn tại, hạn mức cũ không ai biết.
  useEffect(() => {
    if (!uid || !buckets || buckets.length === 0 || cycle !== null) return;
    void ensureCycle(uid, cycleId, buckets).catch(() => {
      // Listener sẽ nhận document khi ghi xong; lỗi mạng thì lần mở sau thử lại.
    });
  }, [uid, buckets, cycle, cycleId]);

  useEffect(() => {
    if (!uid) return;
    return watchCycleCovers(uid, cycleId, setCovers);
  }, [uid, cycleId]);

  const etfDeposits = useMemo(
    () => txs.filter((t) => t.bucketId === 'etf').sort((a, b) => b.occurredAt - a.occurredAt),
    [txs],
  );

  useEffect(() => {
    if (!uid) return;
    return watchCycleIncome(uid, cycleId, setIncome);
  }, [uid, cycleId]);

  const flow = useMemo(() => cashFlow(income, txs), [income, txs]);

  const spent = useMemo(() => spentByBucket(txs), [txs]);
  const covered = useMemo(() => coveredByBucket(covers), [covers]);
  const pendingCovers = useMemo(() => covers.filter((c) => c.status === 'pending'), [covers]);

  const active = useMemo(() => (buckets ?? []).filter((b) => b.active), [buckets]);
  const monthly = useMemo(() => active.filter((b) => b.kind === 'budget'), [active]);
  const funds = useMemo(
    () => active.filter((b) => b.kind === 'fund' && b.id !== 'etf'),
    [active],
  );
  const etf = useMemo(() => active.find((b) => b.id === 'etf') ?? null, [active]);

  const limits = useMemo(() => cycle?.limits ?? {}, [cycle]);
  const monthlySpent = useMemo(
    () => monthly.reduce((sum, b) => sum + (spent[b.id] ?? 0), 0),
    [monthly, spent],
  );
  const monthlyLimit = useMemo(
    () => Object.values(limits).reduce((a, b) => a + b, 0),
    [limits],
  );
  const fundsTotal = useMemo(() => funds.reduce((s, b) => s + b.balanceVnd, 0), [funds]);
  // Chỉ tiền từ BIDV chảy VÀO một hũ VCB mới làm tổng đổi. Bù trong cùng
  // một ngân hàng chỉ là di chuyển nội bộ.
  const surplus = useMemo(
    () => computeSurplus(limits, spent) + coveredFromOutside(covers, buckets ?? []),
    [limits, spent, covers, buckets],
  );

  const needsClose = Boolean(cycle && cycle.status === 'open' && now > 0 && now >= cycle.endAt);

  return {
    uid,
    cycleId,
    cycle,
    buckets: buckets ?? [],
    monthly,
    funds,
    etf,
    etfDeposits,
    income,
    flow,
    /** Lương đã ghi cho chu kỳ này, lấy từ bản ghi income - không phải từ
     *  một field trùng lặp trên document chu kỳ. */
    salaryVnd: flow.salaryVnd > 0 ? flow.salaryVnd : null,
    spent,
    covered,
    covers,
    pendingCovers,
    limits,
    monthlySpent,
    monthlyLimit,
    fundsTotal,
    surplus,
    needsClose,
    loading: buckets === null,
  };
}
