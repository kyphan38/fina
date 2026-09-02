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

/** Section Funds trên màn hình Log. Mặc định gập; mở ra thì giữ nguyên. */
export const fundsOpenStore = makeFlagStore('fina.fundsOpen', false);
