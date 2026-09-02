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
  /** Tiền còn lại của chu kỳ: chưa tiêu và chưa đem đầu tư. */
  leftVnd: number;

  // --- Tách `left` ra làm hai, vì hai nửa này khác nhau về bản chất ---

  /** Đã chuyển sang quỹ BIDV trong chu kỳ này. */
  allocatedVnd: number;
  /** Phần của `allocated` chưa bị tiêu: tiền đã có việc, đang nằm ở quỹ. */
  inFundsVnd: number;
  /**
   * Tiền vào VCB mà CHƯA được giao việc gì: chưa tiêu, chưa vào quỹ, chưa
   * lên VPS. Khoản thưởng giữa chu kỳ nằm ở đây.
   *
   * `inFundsVnd + unallocatedVnd === leftVnd` - luôn đúng, có test.
   */
  unallocatedVnd: number;
}

/** Số dư có sẵn từ trước: trạng thái ban đầu, không phải dòng tiền. */
export function isOpening(tx: Transaction): boolean {
  return tx.source === 'opening';
}

/** Giao dịch này có tính là chi tiêu không. */
export function isSpending(tx: Transaction): boolean {
  if (isOpening(tx)) return false;
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
    .filter((t) => t.bucketId === ETF_BUCKET && !isOpening(t))
    .reduce((sum, t) => sum + (t.direction === 'in' ? t.amountVnd : -t.amountVnd), 0);
}

/** Tiền chuyển từ VCB sang quỹ BIDV trong chu kỳ. */
export function allocated(txs: Transaction[]): number {
  return txs
    .filter((t) => t.source === 'allocation' && !isOpening(t))
    .reduce((sum, t) => sum + (t.direction === 'in' ? t.amountVnd : -t.amountVnd), 0);
}

/** Chi tiêu ròng, chỉ tính các bucket nằm ở một ngân hàng. */
function spendingAt(txs: Transaction[], bank: Transaction['bank']): number {
  return txs
    .filter((t) => isSpending(t) && t.bank === bank)
    .reduce((sum, t) => sum + (t.direction === 'in' ? -t.amountVnd : t.amountVnd), 0);
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
  const allocatedVnd = allocated(txs);

  const inFundsVnd = allocatedVnd - spendingAt(txs, 'BIDV');
  const unallocatedVnd = inVnd - allocatedVnd - spendingAt(txs, 'VCB') - investedVnd;

  return {
    inVnd,
    salaryVnd,
    otherVnd,
    outVnd,
    investedVnd,
    leftVnd: inVnd - outVnd - investedVnd,
    allocatedVnd,
    inFundsVnd,
    unallocatedVnd,
  };
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
      allocatedVnd: a.allocatedVnd + p.allocatedVnd,
      inFundsVnd: a.inFundsVnd + p.inFundsVnd,
      unallocatedVnd: a.unallocatedVnd + p.unallocatedVnd,
    }),
    {
      inVnd: 0, salaryVnd: 0, otherVnd: 0, outVnd: 0, investedVnd: 0, leftVnd: 0,
      allocatedVnd: 0, inFundsVnd: 0, unallocatedVnd: 0,
    },
  );
}
