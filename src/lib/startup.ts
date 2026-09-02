// ============================================================
// fina - Đo tốc độ mở app
//
// Mốc phải đạt (roadmap nguyên tắc #12): từ chạm icon tới lúc gõ được số
//   <= 1,5s khi app còn trong RAM
//   <= 2,5s khi iOS đã kill app
//
// Đo tới LẦN CHẠM ĐẦU TIÊN VÀO NUMPAD, không phải tới lúc render xong -
// render xong mà chưa bấm được thì chưa tính là dùng được.
// ============================================================

const KEY = 'fina.startup';
const KEEP = 5;

let recorded = false;
// Giữ nguyên tham chiếu mảng giữa các lần đọc: useSyncExternalStore so sánh
// bằng Object.is, trả mảng mới mỗi lần sẽ render vô hạn.
let cache: number[] | null = null;

export function markInteractive(): void {
  if (recorded) return;
  recorded = true;

  try {
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (!nav) return;

    const ms = Math.round(performance.now() - nav.startTime);
    const next = [ms, ...readStartupTimes()].slice(0, KEEP);
    localStorage.setItem(KEY, JSON.stringify(next));
    cache = next;
    listeners.forEach((fn) => fn());
  } catch {
    // Không đo được thì thôi, đây là công cụ chẩn đoán chứ không phải tính năng.
  }
}

const EMPTY: number[] = [];
const listeners = new Set<() => void>();

export function readStartupTimes(): number[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    cache = EMPTY;
  }
  return cache ?? EMPTY;
}

export const startupStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get: readStartupTimes,
  getServer: () => EMPTY,
};
