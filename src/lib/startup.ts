// ============================================================
// fina - Đo tốc độ mở app
//
// Mốc phải đạt (roadmap nguyên tắc #12): từ chạm icon tới lúc gõ được số
//   <= 1,5s khi app còn trong RAM
//   <= 2,5s khi iOS đã kill app
//
// ĐO TỚI LÚC NUMPAD VẼ XONG VÀ NHẬN ĐƯỢC CHẠM, không phải tới lúc người
// dùng thật sự chạm. Bản đầu tiên đo ở lần chạm phím đầu tiên và ra 28
// giây - gần như toàn bộ là thời gian người dùng nhìn quanh. Một chỉ số
// phụ thuộc vào việc người dùng nhanh tay hay không thì không đo được gì.
// ============================================================

const KEY = 'fina.startup';
const KEEP = 8;

export interface StartupSample {
  /** ms từ lúc bắt đầu điều hướng tới lúc numpad vẽ xong. */
  ms: number;
  /** false = phục vụ từ cache (app còn ấm). true = tải thật qua mạng. */
  network: boolean;
  at: number;
}

let recorded = false;
// Giữ nguyên tham chiếu mảng giữa các lần đọc: useSyncExternalStore so sánh
// bằng Object.is, trả mảng mới mỗi lần sẽ render vô hạn.
let cache: StartupSample[] | null = null;
const EMPTY: StartupSample[] = [];
const listeners = new Set<() => void>();

/**
 * Gọi ngay sau khi khung nhập đã vẽ xong lần đầu. An toàn khi gọi nhiều lần -
 * chỉ lần đầu của mỗi lượt tải trang được ghi.
 */
export function markReady(): void {
  if (recorded) return;
  recorded = true;

  // Hai khung hình: khung đầu là lúc trình duyệt bố trí, khung sau là lúc
  // pixel thật sự lên màn hình.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        const nav = performance.getEntriesByType('navigation')[0] as
          | PerformanceNavigationTiming
          | undefined;
        if (!nav) return;

        const sample: StartupSample = {
          ms: Math.round(performance.now() - nav.startTime),
          network: nav.transferSize > 0,
          at: Date.now(),
        };
        const next = [sample, ...readStartupTimes()].slice(0, KEEP);
        localStorage.setItem(KEY, JSON.stringify(next));
        cache = next;
        listeners.forEach((fn) => fn());
      } catch {
        // Không đo được thì thôi - đây là công cụ chẩn đoán, không phải tính năng.
      }
    });
  });
}

export function readStartupTimes(): StartupSample[] {
  if (cache) return cache;
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    // Bản đo cũ lưu mảng số. Bỏ đi thay vì cố cứu - nó đo sai thứ.
    cache = Array.isArray(raw) && raw.every((s) => typeof s === 'object' && s !== null)
      ? (raw as StartupSample[])
      : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache ?? EMPTY;
}

export function clearStartupTimes(): void {
  cache = EMPTY;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  listeners.forEach((fn) => fn());
}

export const startupStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get: readStartupTimes,
  getServer: () => EMPTY,
};
