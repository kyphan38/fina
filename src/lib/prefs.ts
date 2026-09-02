// ============================================================
// fina - Tuỳ chọn lưu ở localStorage
//
// Viết dạng external store thay vì đọc localStorage trong useEffect:
// đọc trong effect gây hydration mismatch (server render một đằng, client
// một nẻo) và React 19 cũng cấm setState thẳng trong effect.
//
// useSyncExternalStore lo đúng cả hai: server dùng giá trị mặc định,
// client đọc giá trị thật ngay sau khi hydrate.
// ============================================================

type Listener = () => void;

function makeFlagStore(key: string, fallback: boolean) {
  const listeners = new Set<Listener>();
  let cache: boolean | null = null;

  const read = (): boolean => {
    if (cache !== null) return cache;
    try {
      const raw = localStorage.getItem(key);
      cache = raw === null ? fallback : raw === '1';
    } catch {
      // Safari private mode chặn localStorage.
      cache = fallback;
    }
    return cache;
  };

  return {
    subscribe(fn: Listener) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get: read,
    getServer: () => fallback,
    set(next: boolean) {
      cache = next;
      try {
        localStorage.setItem(key, next ? '1' : '0');
      } catch {
        // ignore
      }
      listeners.forEach((fn) => fn());
    },
  };
}

/**
 * Lưu một chuỗi trong PHIÊN làm việc.
 *
 * sessionStorage chứ không phải localStorage: chuyển tab rồi quay lại thì
 * giữ nguyên chỗ đang xem, nhưng mở app mới ngày hôm sau thì về mặc định.
 * Chọn chu kỳ tháng 8 hôm nay không có nghĩa là tuần sau vẫn muốn xem tháng 8.
 */
function makeValueStore(key: string) {
  const listeners = new Set<Listener>();
  let cache: string | null | undefined;

  const read = (): string | null => {
    if (cache !== undefined) return cache;
    try {
      cache = sessionStorage.getItem(key);
    } catch {
      cache = null;
    }
    return cache;
  };

  return {
    subscribe(fn: Listener) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get: read,
    getServer: (): string | null => null,
    set(next: string | null) {
      cache = next;
      try {
        if (next === null) sessionStorage.removeItem(key);
        else sessionStorage.setItem(key, next);
      } catch {
        // ignore
      }
      listeners.forEach((fn) => fn());
    },
  };
}

/** Section Funds trên màn hình Log. Mặc định gập; mở ra thì giữ nguyên. */
export const fundsOpenStore = makeFlagStore('fina.fundsOpen', false);

/**
 * Chu kỳ đang xem ở History.
 *
 * Trước đây nó là useState trong HistoryView, nên mỗi lần chuyển sang tab
 * khác rồi quay lại là React unmount component và chu kỳ nhảy về tháng hiện
 * tại - đang soi tháng 8 mà sửa một dòng xong là mất chỗ.
 */
export const historyCycleStore = makeValueStore('fina.historyCycle');
