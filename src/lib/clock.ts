// ============================================================
// fina - Đồng hồ dùng chung
//
// React 19 cấm gọi Date.now() trong lúc render: kết quả đổi mỗi lần render
// và không ai đoán được component sẽ render lại lúc nào.
//
// Đọc giờ ở một chỗ duy nhất, cập nhật mỗi phút, và trả về qua
// useSyncExternalStore - render trở lại thuần tuý, mà app vẫn tự nhận ra
// khi chu kỳ sang trang lúc nửa đêm ngày 25 dù đang mở sẵn.
// ============================================================

const TICK_MS = 60_000;

let now = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

export const clockStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    if (!timer) {
      timer = setInterval(() => {
        now = Date.now();
        listeners.forEach((l) => l());
      }, TICK_MS);
    }
    return () => {
      listeners.delete(fn);
      if (listeners.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  },
  get: () => now,
  // Server không có "bây giờ" nào đúng cho client - trả 0 và để lần render
  // sau khi hydrate điền giá trị thật.
  getServer: () => 0,
};
