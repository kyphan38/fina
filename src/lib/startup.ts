// ============================================================
// fina - Đo tốc độ mở app
//
// Mốc phải đạt (roadmap nguyên tắc #12): từ chạm icon tới lúc gõ được số
//   <= 1,5s khi app còn trong RAM
//   <= 2,5s khi iOS đã kill app
//
// Hai lần trước đo sai, ghi lại để khỏi lặp:
//
//  1. Bản đầu đo ở lần chạm phím đầu tiên -> ra 28 giây, gần như toàn bộ là
//     thời gian người dùng nhìn quanh.
//  2. Bản thứ hai đo tới lúc numpad vẽ xong, nhưng vẫn ra 82s và 17s xen với
//     1.02s. Vì iOS ĐÁNH THỨC PWA đang treo mà không tạo navigation mới:
//     navigationStart vẫn là lần mở gốc, còn performance.now() đếm cả thời
//     gian máy nằm trong túi.
//
// Nên bây giờ chỉ ghi mẫu nào mà trang LIÊN TỤC HIỂN THỊ từ lúc điều hướng
// tới lúc numpad vẽ xong. Trang từng bị ẩn giữa chừng thì bỏ mẫu, và nói rõ
// là đã bỏ bao nhiêu - im lặng vứt đi thì con số trông đẹp mà không thật.
// ============================================================

const KEY = 'fina.startup';
const SKIPPED_KEY = 'fina.startupSkipped';
const KEEP = 8;

export interface StartupSample {
  /** ms từ lúc bắt đầu điều hướng tới lúc numpad vẽ xong. */
  ms: number;
  /** false = phục vụ từ cache (app còn ấm). true = tải thật qua mạng. */
  network: boolean;
  at: number;
}

let recorded = false;
let cache: StartupSample[] | null = null;
const EMPTY: StartupSample[] = [];
const listeners = new Set<() => void>();

// Trang có bị ẩn lúc nào trong lượt tải này không.
let everHidden = typeof document !== 'undefined' && document.visibilityState !== 'visible';

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') everHidden = true;
  });
}

function bumpSkipped() {
  try {
    const n = Number(localStorage.getItem(SKIPPED_KEY) ?? '0') + 1;
    localStorage.setItem(SKIPPED_KEY, String(n));
  } catch {
    // ignore
  }
}

/** Gọi ngay sau khi khung nhập đã vẽ xong lần đầu. An toàn khi gọi nhiều lần. */
export function markReady(): void {
  if (recorded) return;
  recorded = true;

  // Hai khung hình: khung đầu là lúc trình duyệt bố trí, khung sau là lúc
  // pixel thật sự lên màn hình.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        if (everHidden || document.visibilityState !== 'visible') {
          bumpSkipped();
          return;
        }

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
    cache =
      Array.isArray(raw) && raw.every((s) => typeof s === 'object' && s !== null)
        ? (raw as StartupSample[])
        : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache ?? EMPTY;
}

export function readSkippedCount(): number {
  try {
    return Number(localStorage.getItem(SKIPPED_KEY) ?? '0');
  } catch {
    return 0;
  }
}

export function clearStartupTimes(): void {
  cache = EMPTY;
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(SKIPPED_KEY);
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
