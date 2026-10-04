// ============================================================
// fina - Số liệu cho widget iPhone (Scriptable)
//
// Hàm thuần, không đụng Firestore: route /api/widget đọc dữ liệu rồi đưa
// vào đây. Con số PHẢI khớp với màn hình Summary - widget nói "còn 4.550"
// mà app nói "còn 4.300" thì cả hai đều mất tin tưởng.
//
//   left  = tổng limits của chu kỳ - tổng đã tiêu ròng của các hũ budget
//   used  (từng hũ) = đã tiêu + phần đã rút đi bù hũ khác  (giống BudgetRow)
//
// Lương không bao giờ đi qua đây.
// ============================================================

import { cycleOf, cycleProgress } from '@/lib/cycle';
import type { Bucket, Cover, Transaction } from '@/types/fina';

export interface WidgetBucket {
  name: string;
  usedVnd: number;
  /** null khi chu kỳ chưa có hạn mức cho hũ này. */
  limitVnd: number | null;
}

export interface WidgetData {
  cycle: string;
  day: number;
  totalDays: number;
  limitVnd: number;
  spentVnd: number;
  leftVnd: number;
  /** Còn lại chia đều cho các ngày còn lại, tính cả hôm nay. Âm thì về 0. */
  perDayVnd: number;
  buckets: WidgetBucket[];
}

/**
 * Giờ Việt Nam dưới dạng Date "giờ địa phương".
 *
 * Server Vercel chạy UTC, còn cycleOf/cycleProgress đọc getDate() theo giờ
 * máy. Dựng lại Date từ các phần của giờ VN thì hai hàm đó cho đúng kết quả
 * dù máy chạy ở múi giờ nào. Sáng 01:00 ngày 25 giờ VN vẫn là 18:00 ngày 24
 * giờ UTC - không làm bước này thì widget mở chu kỳ mới trễ 7 tiếng.
 */
export function vnWallClock(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
}

export function widgetData(args: {
  now: Date;
  buckets: Bucket[];
  txs: Transaction[];
  limits: Record<string, number>;
  covered: Record<string, number>;
}): WidgetData {
  const { now, buckets, txs, limits, covered } = args;
  const cycle = cycleOf(now);
  const { day, total } = cycleProgress(cycle, now);

  const spent: Record<string, number> = {};
  for (const tx of txs) {
    const signed = tx.direction === 'in' ? -tx.amountVnd : tx.amountVnd;
    spent[tx.bucketId] = (spent[tx.bucketId] ?? 0) + signed;
  }

  const monthly = buckets
    .filter((b) => b.active && b.kind === 'budget')
    .sort((a, b) => a.order - b.order);

  const limitVnd = Object.values(limits).reduce((a, b) => a + b, 0);
  const spentVnd = monthly.reduce((sum, b) => sum + (spent[b.id] ?? 0), 0);
  const leftVnd = limitVnd - spentVnd;
  const daysLeft = total - day + 1;

  return {
    cycle,
    day,
    totalDays: total,
    limitVnd,
    spentVnd,
    leftVnd,
    perDayVnd: Math.max(0, Math.floor(leftVnd / daysLeft)),
    buckets: monthly.map((b) => ({
      name: b.name,
      usedVnd: (spent[b.id] ?? 0) + (covered[b.id] ?? 0),
      limitVnd: limits[b.id] ?? null,
    })),
  };
}

/** Giống coveredByBucket trong covers.ts, nhưng file đó kéo theo Firebase client. */
export function coveredOf(covers: Cover[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of covers) {
    if (c.status !== 'done') continue;
    out[c.fromBucketId] = (out[c.fromBucketId] ?? 0) + c.amountVnd;
    out[c.toBucketId] = (out[c.toBucketId] ?? 0) - c.amountVnd;
  }
  return out;
}
