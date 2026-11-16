// ============================================================
// fina - Salary screen lock state
//
// A SCREEN GUARD, not security: it stops someone holding the phone with the
// app open. Unlocking is Face ID / Touch ID (lib/passkey.ts) since 2026-11-16;
// the old typed password is gone.
// ============================================================

/** The unlock lives in THIS tab only. Closing the tab locks it. */
const SESSION_KEY = 'fina.salary.unlocked';

/**
 * Unlock state as an external store, like `prefs.ts`: reading sessionStorage
 * in useEffect renders differently on server and client, and React 19
 * forbids setState directly in an effect.
 *
 * `getServer` always returns LOCKED. The server knows nothing of the browser
 * session, and guessing "open" by mistake flashes the salary table.
 */
type Listener = () => void;

function makeGateStore() {
  const listeners = new Set<Listener>();
  let cache: boolean | undefined;

  const read = (): boolean => {
    if (cache !== undefined) return cache;
    try {
      cache = sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      // Safari blocks storage in private mode. Treat as locked.
      cache = false;
    }
    return cache;
  };

  const write = (next: boolean) => {
    cache = next;
    try {
      if (next) sessionStorage.setItem(SESSION_KEY, '1');
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // If it cannot be remembered, retype each time - still usable.
    }
    listeners.forEach((fn) => fn());
  };

  return {
    subscribe(fn: Listener) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get: read,
    getServer: () => false,
    unlock: () => write(true),
    lock: () => write(false),
  };
}

export const gateStore = makeGateStore();
