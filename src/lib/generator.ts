import type { Bucket } from '@/types/fina';

export interface Allocation {
  bucket: Bucket;
  amountVnd: number;
  /** Phần trăm của lương. Là KẾT QUẢ tính ra, không phải đầu vào. */
  percent: number;
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
 * Các nhóm là SỐ TIỀN CỐ ĐỊNH (`baselineVnd`); ETF ăn phần còn dư.
 * Phần trăm chỉ để nhìn - không bao giờ là đầu vào.
 */
export function allocate(salaryVnd: number, buckets: Bucket[]): GeneratorResult {
  const pct = (v: number) => (salaryVnd > 0 ? (v / salaryVnd) * 100 : 0);
  const of = (kind: Bucket['kind'], skipEtf: boolean) =>
    buckets
      .filter((b) => b.active && b.kind === kind && (!skipEtf || b.id !== 'etf'))
      .map((b) => ({ bucket: b, amountVnd: b.baselineVnd, percent: pct(b.baselineVnd) }));

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
