// ============================================================
// fina - Chỉ số, do CODE tính
//
// Nguyên tắc chi phối cả Stage 7, một dòng:
//   Code làm phép tính. Model chỉ chọn cái đáng nói.
//
// Không có gì trong file này gọi mạng. Model không bao giờ được giao việc
// cộng trừ, nên mọi con số nó nói ra đều phải xuất hiện ở đây trước.
// ============================================================

import type { Bucket } from '@/types/fina';

/** Ngưỡng để gọi một giao dịch là bất thường so với chính bucket đó. */
export const OUTLIER_MULTIPLE = 3;
/** Số chu kỳ liên tiếp tăng thì mới gọi là xu hướng. */
export const RISING_RUN = 3;
/** Quỹ im lặng bao nhiêu chu kỳ thì đáng nhắc. */
export const IDLE_CYCLES = 3;

export interface CycleFacts {
  id: string;
  closed: boolean;
  byBucket: Record<string, number>;
  limits: Record<string, number>;
}

export interface BucketSignal {
  bucketId: string;
  name: string;
  /** Chi tiêu chu kỳ này. */
  currentVnd: number;
  medianVnd: number;
  /** Lệch so với trung vị, %. null khi chưa đủ dữ liệu để so. */
  deviationPct: number | null;
  limitVnd: number | null;
  /** Vượt hạn mức bao nhiêu chu kỳ, trên tổng bao nhiêu chu kỳ đã đóng. */
  overCount: number;
  overOf: number;
  /** Tăng liên tiếp RISING_RUN chu kỳ. */
  rising: boolean;
}

export interface PaceSignal {
  bucketId: string;
  name: string;
  /** % của chu kỳ đã trôi qua. */
  elapsedPct: number;
  /** % hạn mức đã tiêu. */
  spentPct: number;
}

export interface Signals {
  cycleId: string;
  day: number;
  totalDays: number;
  buckets: BucketSignal[];
  pace: PaceSignal[];
  outliers: { bucketId: string; name: string; amountVnd: number; medianVnd: number }[];
  idleFunds: { bucketId: string; name: string; balanceVnd: number; idleCycles: number }[];
  negativeFunds: { bucketId: string; name: string; balanceVnd: number }[];
  /** Số chu kỳ đã đóng dùng để so. Dưới 3 thì đừng nói gì về xu hướng. */
  closedCount: number;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function pct(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return Math.round((part / whole) * 100);
}

/**
 * `cycles` xếp CŨ TRƯỚC, phần tử cuối là chu kỳ đang chạy.
 * `amounts` là số tiền từng giao dịch của chu kỳ hiện tại, để tìm khoản lạc loài.
 */
export function computeSignals(args: {
  cycles: CycleFacts[];
  buckets: Bucket[];
  amounts: { bucketId: string; amountVnd: number }[];
  day: number;
  totalDays: number;
}): Signals {
  const { cycles, buckets, amounts, day, totalDays } = args;
  const current = cycles[cycles.length - 1];
  const past = cycles.filter((c) => c.closed && c.id !== current?.id);

  const byId = new Map(buckets.map((b) => [b.id, b]));
  const budgets = buckets.filter((b) => b.kind === 'budget' && b.active);
  const funds = buckets.filter((b) => b.kind === 'fund' && b.active && b.id !== 'etf');

  const bucketSignals: BucketSignal[] = budgets.map((b) => {
    const history = past.map((c) => c.byBucket[b.id] ?? 0);
    const med = median(history);
    const currentVnd = current?.byBucket[b.id] ?? 0;
    const limitVnd = current?.limits[b.id] ?? null;

    const overCount = past.filter((c) => {
      const lim = c.limits[b.id];
      return lim !== undefined && (c.byBucket[b.id] ?? 0) > lim;
    }).length;

    // Tăng liên tiếp: chỉ tính khi có đủ số chu kỳ để nói.
    const tail = [...history.slice(-(RISING_RUN - 1)), currentVnd];
    const rising =
      tail.length === RISING_RUN && tail.every((v, i) => i === 0 || v > tail[i - 1]);

    return {
      bucketId: b.id,
      name: b.name,
      currentVnd,
      medianVnd: med,
      deviationPct: med > 0 ? pct(currentVnd - med, med) : null,
      limitVnd,
      overCount,
      overOf: past.filter((c) => c.limits[b.id] !== undefined).length,
      rising,
    };
  });

  // Nhịp chỉ áp cho bucket tiêu đều. Health và Purchases đến theo cục, so với
  // nhịp tuyến tính sẽ kêu sai mỗi tháng cho tới khi không ai nhìn nữa.
  const elapsedPct = totalDays > 0 ? Math.round((day / totalDays) * 100) : 0;
  const pace: PaceSignal[] = budgets
    .filter((b) => b.evenlySpent)
    .map((b) => {
      const lim = current?.limits[b.id] ?? 0;
      return {
        bucketId: b.id,
        name: b.name,
        elapsedPct,
        spentPct: lim > 0 ? Math.round(((current?.byBucket[b.id] ?? 0) / lim) * 100) : 0,
      };
    });

  const outliers = amounts
    .map((t) => {
      const b = byId.get(t.bucketId);
      const med = median(past.map((c) => c.byBucket[t.bucketId] ?? 0));
      return { bucketId: t.bucketId, name: b?.name ?? t.bucketId, amountVnd: t.amountVnd, medianVnd: med };
    })
    .filter((o) => o.medianVnd > 0 && o.amountVnd > o.medianVnd * OUTLIER_MULTIPLE)
    .sort((a, b) => b.amountVnd - a.amountVnd)
    .slice(0, 3);

  const idleFunds = funds
    .map((b) => {
      let idle = 0;
      for (let i = cycles.length - 1; i >= 0; i--) {
        if ((cycles[i].byBucket[b.id] ?? 0) !== 0) break;
        idle++;
      }
      return { bucketId: b.id, name: b.name, balanceVnd: b.balanceVnd, idleCycles: idle };
    })
    .filter((x) => x.idleCycles >= IDLE_CYCLES && x.balanceVnd > 0);

  const negativeFunds = funds
    .filter((b) => b.balanceVnd < 0)
    .map((b) => ({ bucketId: b.id, name: b.name, balanceVnd: b.balanceVnd }));

  return {
    cycleId: current?.id ?? '',
    day,
    totalDays,
    buckets: bucketSignals,
    pace,
    outliers,
    idleFunds,
    negativeFunds,
    closedCount: past.length,
  };
}

/** Đủ dữ liệu để nói gì chưa. Dưới 3 chu kỳ đã đóng thì không. */
export function canAnalyze(s: Signals): boolean {
  return s.closedCount >= 3;
}
