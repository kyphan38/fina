import { isGoal, needPerMonth, openGoals } from '@/lib/goals';
import type { Bucket } from '@/types/fina';

/** Lệch quá ngưỡng này so với chuẩn thì tô đậm cho dễ thấy. */
export const DEVIATION_THRESHOLD = 0.2;

export interface Allocation {
  bucket: Bucket;
  amountVnd: number;
  /** Phần trăm của lương. Là KẾT QUẢ tính ra, không phải đầu vào. */
  percent: number;
  /** Mức chuẩn, để so. */
  standardVnd: number;
  /** amountVnd − standardVnd. 0 nghĩa là đang đúng chuẩn. */
  deltaVnd: number;
  /** true khi lệch quá 20% so với chuẩn - đáng nhìn kỹ. */
  farFromStandard: boolean;
  /** Goals only: what reaches the target on time. null without target or month. */
  needVnd: number | null;
  /** Goals only: the amount is below `needVnd`, so the goal falls behind. */
  belowNeed: boolean;
}

export interface GeneratorResult {
  monthly: Allocation[];
  funds: Allocation[];
  /** Saving goals only. Later and done goals get nothing. */
  goals: Allocation[];
  monthlyTotalVnd: number;
  fundsTotalVnd: number;
  goalsTotalVnd: number;
  /** Phần còn dư sau khi trừ hết. Âm nghĩa là lương không đủ. */
  etfVnd: number;
  etfPercent: number;
}

/**
 * Phân bổ lương.
 *
 * Các nhóm lấy từ `standardVnd`; ETF ăn phần còn dư. Người dùng sửa được
 * từng số ngay trong Generator - sửa ở đó là ngắn hạn, chỉ cho chu kỳ này.
 * Phần trăm chỉ để nhìn - không bao giờ là đầu vào.
 */
export function allocate(
  salaryVnd: number,
  buckets: Bucket[],
  /** Số người dùng sửa tay trong Generator. Chỉ cho chu kỳ này, không ghi
   *  ngược vào Settings - đó là lý do nó ở đây chứ không phải trong bucket. */
  overrides: Record<string, number> = {},
  /**
   * When goal needs are measured. Pass the moment just before the cycle
   * starts, so the allocation being planned counts as one of the months left.
   */
  needAt: Date = new Date(),
): GeneratorResult {
  const pct = (v: number) => (salaryVnd > 0 ? (v / salaryVnd) * 100 : 0);
  const row = (b: Bucket): Allocation => {
    const amountVnd = overrides[b.id] ?? b.standardVnd;
    const deltaVnd = amountVnd - b.standardVnd;
    const needVnd = isGoal(b) ? needPerMonth(b, needAt) : null;
    return {
      bucket: b,
      amountVnd,
      percent: pct(amountVnd),
      standardVnd: b.standardVnd,
      deltaVnd,
      farFromStandard:
        b.standardVnd > 0 && Math.abs(deltaVnd) / b.standardVnd > DEVIATION_THRESHOLD,
      needVnd,
      belowNeed: needVnd !== null && amountVnd < needVnd,
    };
  };

  const monthly = buckets.filter((b) => b.active && b.kind === 'budget').map(row);
  const funds = buckets
    .filter((b) => b.active && b.kind === 'fund' && b.id !== 'etf' && !isGoal(b))
    .map(row);
  const goals = openGoals(buckets)
    .filter((b) => b.goal?.status === 'saving')
    .map(row);
  const sum = (xs: Allocation[]) => xs.reduce((a, x) => a + x.amountVnd, 0);

  const monthlyTotalVnd = sum(monthly);
  const fundsTotalVnd = sum(funds);
  const goalsTotalVnd = sum(goals);
  const etfVnd = salaryVnd - monthlyTotalVnd - fundsTotalVnd - goalsTotalVnd;

  return {
    monthly,
    funds,
    goals,
    monthlyTotalVnd,
    fundsTotalVnd,
    goalsTotalVnd,
    etfVnd,
    etfPercent: pct(etfVnd),
  };
}
