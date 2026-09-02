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
}

export interface GeneratorResult {
  monthly: Allocation[];
  funds: Allocation[];
  monthlyTotalVnd: number;
  fundsTotalVnd: number;
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
): GeneratorResult {
  const pct = (v: number) => (salaryVnd > 0 ? (v / salaryVnd) * 100 : 0);
  const of = (kind: Bucket['kind'], skipEtf: boolean) =>
    buckets
      .filter((b) => b.active && b.kind === kind && (!skipEtf || b.id !== 'etf'))
      .map((b) => {
        const amountVnd = overrides[b.id] ?? b.standardVnd;
        const deltaVnd = amountVnd - b.standardVnd;
        return {
          bucket: b,
          amountVnd,
          percent: pct(amountVnd),
          standardVnd: b.standardVnd,
          deltaVnd,
          farFromStandard:
            b.standardVnd > 0 && Math.abs(deltaVnd) / b.standardVnd > DEVIATION_THRESHOLD,
        };
      });

  const monthly = of('budget', false);
  const funds = of('fund', true);
  const sum = (xs: Allocation[]) => xs.reduce((a, x) => a + x.amountVnd, 0);

  const monthlyTotalVnd = sum(monthly);
  const fundsTotalVnd = sum(funds);
  const etfVnd = salaryVnd - monthlyTotalVnd - fundsTotalVnd;

  return {
    monthly,
    funds,
    monthlyTotalVnd,
    fundsTotalVnd,
    etfVnd,
    etfPercent: pct(etfVnd),
  };
}
