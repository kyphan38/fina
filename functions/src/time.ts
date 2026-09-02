// ============================================================
// fina functions - Giờ Việt Nam
//
// Function chạy theo UTC trên máy chủ Google. Mọi so sánh về "22:00" hay
// "hôm nay" phải quy về Asia/Ho_Chi_Minh, không được tin đồng hồ máy chủ.
//
// functions/ deploy riêng và KHÔNG import được code trong src/ của app.
// Đây là bản sao duy nhất, và test/functions-time.test.ts đối chiếu nó với
// Intl giờ này qua giờ khác - đổi một bên mà quên bên kia thì test đỏ.
// ============================================================

export const TIMEZONE = 'Asia/Ho_Chi_Minh';

export interface VnParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function vnParts(date: Date): VnParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // en-GB trả 24:00 cho nửa đêm ở một số bản ICU; quy về 0.
  const hour = get('hour') % 24;

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
  };
}

/** '2026-09-02' theo giờ Việt Nam. Dùng làm khoá chống gửi trùng. */
export function dayKey(date: Date): string {
  const p = vnParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * Đã tới giờ nhắc trong khung chạy hiện tại chưa.
 *
 * Job chạy mỗi `windowMinutes` phút, nên "đúng 22:00" gần như không bao giờ
 * rơi trúng. Bắt cả khung [22:00, 22:00 + window).
 */
export function isReminderWindow(date: Date, hour: number, windowMinutes: number): boolean {
  const p = vnParts(date);
  return p.hour === hour && p.minute < windowMinutes;
}

/** Số ngày trọn vẹn giữa hai mốc. */
export function daysBetween(fromMs: number, toMs: number): number {
  return Math.floor((toMs - fromMs) / 86_400_000);
}
