// ============================================================
// fina - Options stored in localStorage
//
// Written as an external store instead of reading localStorage in useEffect:
// reading in an effect causes a hydration mismatch (server and client render
// differently), and React 19 forbids setState directly in an effect.
//
// useSyncExternalStore handles both: the server uses the default, the client
// reads the real value right after hydration.
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
      // Safari private mode blocks localStorage.
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
 * Stores a string for the SESSION.
 *
 * sessionStorage, not localStorage: switching tabs and back keeps your place,
 * but opening the app the next day starts fresh. Picking August today does
 * not mean you still want August next week.
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

/** The Funds section on the Log screen. Collapsed by default; stays open once opened. */
export const fundsOpenStore = makeFlagStore('fina.fundsOpen', false);

/**
 * The cycle being viewed in History.
 *
 * It used to be useState in HistoryView, so switching tabs and back made
 * React unmount the component and jump to the current month - studying
 * August, editing one row, and losing your place.
 */
export const historyCycleStore = makeValueStore('fina.historyCycle');

// ------------------------------------------------------------
// Theme (system · light · dark), stored per device.
//
// Must exist BEFORE the first paint, so the layout runs THEME_SCRIPT inline
// in <head>; this store only serves the Theme row in Settings.
// ------------------------------------------------------------

export type Theme = 'system' | 'light' | 'dark';

const THEME_KEY = 'fina.theme';

function makeThemeStore() {
  const listeners = new Set<Listener>();
  let cache: Theme | null = null;

  const read = (): Theme => {
    if (cache !== null) return cache;
    try {
      const raw = localStorage.getItem(THEME_KEY);
      cache = raw === 'light' || raw === 'dark' ? raw : 'system';
    } catch {
      cache = 'system';
    }
    return cache;
  };

  return {
    subscribe(fn: Listener) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get: read,
    getServer: (): Theme => 'system',
    set(next: Theme) {
      cache = next;
      try {
        if (next === 'system') localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, next);
      } catch {
        // ignore
      }
      applyTheme(next);
      listeners.forEach((fn) => fn());
    },
  };
}

export const themeStore = makeThemeStore();

/** Status bar color (theme-color) - matches --bg in globals.css. */
export const BG_LIGHT = '#fafafa';
export const BG_DARK = '#111111';

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  const dark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute('content', dark ? BG_DARK : BG_LIGHT));
}

/**
 * Runs synchronously in <head>, before the first paint: no white flash in dark
 * mode. The theme-color tag may come after the script, so wait for
 * DOMContentLoaded to update it. Handwritten ES5 because it skips the bundler.
 */
export const THEME_SCRIPT = `(function(){try{
var t=localStorage.getItem('${THEME_KEY}');
if(t!=='light'&&t!=='dark')return;
document.documentElement.setAttribute('data-theme',t);
document.addEventListener('DOMContentLoaded',function(){
var m=document.querySelectorAll('meta[name="theme-color"]');
for(var i=0;i<m.length;i++)m[i].setAttribute('content',t==='dark'?'${BG_DARK}':'${BG_LIGHT}');
});
}catch(e){}})();`;
