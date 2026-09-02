// ============================================================
// fina - Dòng tiền: vào bao nhiêu, ra bao nhiêu, còn lại bao nhiêu
//
// Ba chỗ loại trừ dưới đây là toàn bộ phần dễ sai của app, nên chúng nằm ở
// một hàm thuần có test chứ không rải vào component. Đã có một lỗi thật:
// tổng ở History từng trừ khoản nạp ETF, làm tháng 9 hiện 415 trong khi
// thực tiêu 3.840.
// ============================================================

import type { Income, Transaction } from '@/types/fina';

export const ETF_BUCKET = 'etf';

export interface CashFlow {
  inVnd: number;
  salaryVnd: number;
  otherVnd: number;
  /** Chi tiêu ròng: đã trừ khoản được hoàn, đã bỏ phân bổ và đầu tư. */
  outVnd: number;
  investedVnd: number;
  /** Tiền còn trong tài khoản: chưa tiêu và chưa đem đầu tư. */
  leftVnd: number;
}

/** Giao dịch này có tính là chi tiêu không. */
export function isSpending(tx: Transaction): boolean {
  // Chia lương sang BIDV là chuyển tiền giữa hai hũ của chính mình.
  if (tx.source === 'allocation') return false;
  // Đầu tư có dòng riêng, không phải tiêu.
  if (tx.bucketId === ETF_BUCKET) return false;
  return true;
}

/** Chi tiêu ròng: `out` cộng vào, `in` (được hoàn) trừ ra. */
export function netSpending(txs: Transaction[]): number {
  return txs
    .filter(isSpending)
    .reduce((sum, t) => sum + (t.direction === 'in' ? -t.amountVnd : t.amountVnd), 0);
}

/** Tổng đã chuyển sang đầu tư. Rút ra trở lại thì trừ đi. */
export function invested(txs: Transaction[]): number {
  return txs
    .filter((t) => t.bucketId === ETF_BUCKET)
    .reduce((sum, t) => sum + (t.direction === 'in' ? t.amountVnd : -t.amountVnd), 0);
}

export function cashFlow(income: Income[], txs: Transaction[]): CashFlow {
  const salaryVnd = income
    .filter((i) => i.kind === 'salary')
    .reduce((a, i) => a + i.amountVnd, 0);
  const otherVnd = income
    .filter((i) => i.kind !== 'salary')
    .reduce((a, i) => a + i.amountVnd, 0);

  const inVnd = salaryVnd + otherVnd;
  const outVnd = netSpending(txs);
  const investedVnd = invested(txs);

  return { inVnd, salaryVnd, otherVnd, outVnd, investedVnd, leftVnd: inVnd - outVnd - investedVnd };
}

/** Cộng nhiều chu kỳ lại. Dùng cho bảng theo năm. */
export function sumCashFlow(parts: CashFlow[]): CashFlow {
  return parts.reduce(
    (a, p) => ({
      inVnd: a.inVnd + p.inVnd,
      salaryVnd: a.salaryVnd + p.salaryVnd,
      otherVnd: a.otherVnd + p.otherVnd,
      outVnd: a.outVnd + p.outVnd,
      investedVnd: a.investedVnd + p.investedVnd,
      leftVnd: a.leftVnd + p.leftVnd,
    }),
    { inVnd: 0, salaryVnd: 0, otherVnd: 0, outVnd: 0, investedVnd: 0, leftVnd: 0 },
  );
}
