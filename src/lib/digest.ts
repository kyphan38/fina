// ============================================================
// fina - Gói chỉ số thành JSON nhỏ để gửi model
//
// Giao dịch thô KHÔNG BAO GIỜ rời máy. Không gửi ghi chú, không gửi tên
// khoản chi, không gửi ngày. Chỉ những con số mà `signals.ts` đã tính.
// ============================================================

import { formatVnd } from '@/lib/money';
import type { Signals } from '@/lib/signals';

export interface Digest {
  cycle: string;
  day: number;
  totalDays: number;
  buckets: {
    name: string;
    spent: number;
    median: number;
    limit: number | null;
    deviationPct: number | null;
    over: string | null;
    rising: boolean;
  }[];
  pace: { name: string; elapsedPct: number; spentPct: number }[];
  outliers: { name: string; amount: number; median: number }[];
  idleFunds: { name: string; balance: number; cycles: number }[];
  negativeFunds: { name: string; balance: number }[];
  cashflow: {
    in: number;
    out: number;
    invested: number;
    left: number;
    investedPct: number | null;
    leftDeviationPct: number | null;
  };
}

/** Số tiền gửi model theo NGHÌN, đúng đơn vị người dùng đọc trên màn hình. */
const k = (v: number) => Math.round(v / 1000);

export function buildDigest(s: Signals): Digest {
  return {
    cycle: s.cycleId,
    day: s.day,
    totalDays: s.totalDays,
    buckets: s.buckets.map((b) => ({
      name: b.name,
      spent: k(b.currentVnd),
      median: k(b.medianVnd),
      limit: b.limitVnd === null ? null : k(b.limitVnd),
      deviationPct: b.deviationPct,
      over: b.overOf > 0 ? `${b.overCount}/${b.overOf}` : null,
      rising: b.rising,
    })),
    pace: s.pace.map((p) => ({ name: p.name, elapsedPct: p.elapsedPct, spentPct: p.spentPct })),
    outliers: s.outliers.map((o) => ({ name: o.name, amount: k(o.amountVnd), median: k(o.medianVnd) })),
    idleFunds: s.idleFunds.map((f) => ({ name: f.name, balance: k(f.balanceVnd), cycles: f.idleCycles })),
    negativeFunds: s.negativeFunds.map((f) => ({ name: f.name, balance: k(f.balanceVnd) })),
    cashflow: {
      in: k(s.cashflow.inVnd),
      out: k(s.cashflow.outVnd),
      invested: k(s.cashflow.investedVnd),
      left: k(s.cashflow.leftVnd),
      investedPct: s.cashflow.investedPct,
      leftDeviationPct: s.cashflow.leftDeviationPct,
    },
  };
}

/**
 * Mọi con số model được phép nhắc tới, ở cả dạng thô lẫn dạng đã định dạng.
 * Câu nào chứa số ngoài tập này là câu model tự nghĩ ra.
 */
export function allowedNumbers(d: Digest): Set<string> {
  const out = new Set<string>();
  const add = (v: number | null) => {
    if (v === null || !Number.isFinite(v)) return;
    const n = Math.round(Math.abs(v));
    out.add(String(n));
    out.add(formatVnd(n * 1000).replace(/[^\d]/g, ''));
    out.add(formatVnd(n * 1000));
  };

  add(d.day);
  add(d.totalDays);
  for (const b of d.buckets) {
    add(b.spent); add(b.median); add(b.limit); add(b.deviationPct);
    if (b.over) b.over.split('/').forEach((x) => add(Number(x)));
  }
  for (const p of d.pace) { add(p.elapsedPct); add(p.spentPct); }
  for (const o of d.outliers) { add(o.amount); add(o.median); }
  for (const f of d.idleFunds) { add(f.balance); add(f.cycles); }
  for (const f of d.negativeFunds) add(f.balance);
  const c = d.cashflow;
  add(c.in); add(c.out); add(c.invested); add(c.left);
  add(c.investedPct); add(c.leftDeviationPct);
  return out;
}

/** Cùng dữ liệu thì cùng hash - không gọi lại API. */
export function digestHash(d: Digest): string {
  const json = JSON.stringify(d);
  let h = 0;
  for (let i = 0; i < json.length; i++) {
    h = (h << 5) - h + json.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}
