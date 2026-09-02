// ============================================================
// fina - Chu kỳ tài chính
//
// Chu kỳ bắt đầu ngày 25 (ngày nhận lương). Chi ngày 25/08 thuộc chu kỳ
// tháng 9. Mọi truy vấn phải đi qua đây, không bao giờ dùng tháng lịch thô.
// ============================================================

import { CYCLE_START_DAY } from '@/types/fina';

/** '2026-09' */
export type CycleId = string;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Chu kỳ chứa thời điểm `d`.
 *
 * Từ ngày 25 trở đi thuộc về chu kỳ mang tên tháng SAU. Ngày 25/12/2026
 * rơi vào chu kỳ '2027-01' - đây là ca dễ sai nhất, có test riêng.
 */
export function cycleOf(d: Date, startDay: number = CYCLE_START_DAY): CycleId {
  let year = d.getFullYear();
  // getMonth() đếm từ 0, nên +1 ở đây cho ra số tháng 1-12 của chính tháng đó.
  let month = d.getMonth() + 1;
  if (d.getDate() >= startDay) month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Tách '2026-09' thành số. Ném lỗi nếu sai định dạng - không đoán. */
export function parseCycle(cycle: CycleId): { year: number; month: number } {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(cycle);
  if (!m) throw new Error(`[cycle] Invalid cycle id: ${cycle}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

/**
 * Khoảng thời gian của chu kỳ: [startAt, endAt).
 * Chu kỳ '2026-09' chạy từ 00:00 ngày 25/08 tới 00:00 ngày 25/09.
 */
export function cycleRange(
  cycle: CycleId,
  startDay: number = CYCLE_START_DAY,
): { startAt: number; endAt: number } {
  const { year, month } = parseCycle(cycle);
  // Tháng trước của tên chu kỳ. new Date() tự xử lý tháng 0 -> tháng 12 năm trước.
  const startAt = new Date(year, month - 2, startDay, 0, 0, 0, 0).getTime();
  const endAt = new Date(year, month - 1, startDay, 0, 0, 0, 0).getTime();
  return { startAt, endAt };
}

/** Tên tháng và năm để hiển thị. Không lưu trong DB - luôn suy ra từ cycle. */
export function cycleLabel(cycle: CycleId): { month: string; year: number } {
  const { year, month } = parseCycle(cycle);
  return { month: MONTH_NAMES[month - 1], year };
}

/**
 * Đang là ngày thứ mấy trên tổng bao nhiêu ngày của chu kỳ.
 * Ngày đầu tiên là 1. Trước chu kỳ thì kẹp về 1, sau chu kỳ kẹp về total.
 */
export function cycleProgress(
  cycle: CycleId,
  now: Date = new Date(),
  startDay: number = CYCLE_START_DAY,
): { day: number; total: number } {
  const { startAt, endAt } = cycleRange(cycle, startDay);
  const DAY = 86_400_000;
  const total = Math.round((endAt - startAt) / DAY);
  const elapsed = Math.floor((now.getTime() - startAt) / DAY) + 1;
  return { day: Math.min(Math.max(elapsed, 1), total), total };
}

/** Chu kỳ liền trước. '2026-01' -> '2025-12' */
export function previousCycle(cycle: CycleId): CycleId {
  const { year, month } = parseCycle(cycle);
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, '0')}`;
}

/** Chu kỳ liền sau. '2026-12' -> '2027-01' */
export function nextCycle(cycle: CycleId): CycleId {
  const { year, month } = parseCycle(cycle);
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`;
}
