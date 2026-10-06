// ============================================================
// fina - Measuring app start speed
//
// Target (roadmap rule #12): from icon tap to being able to type a number
//   <= 1.5s while the app is still in RAM
//   <= 2.5s after iOS killed the app
//
// The first two attempts measured wrong, noted here so it does not happen again:
//
//  1. The first version measured at the first key tap -> 28 seconds, almost
//     all of it the user looking around.
//  2. The second measured until the numpad painted, but still gave 82s and
//     17s mixed with 1.02s. Because iOS WAKES a suspended PWA without a new
//     navigation: navigationStart is still the original open, and
//     performance.now() counts the time the phone sat in a pocket.
//
// So now a sample counts only if the page stayed VISIBLE THE WHOLE TIME from
// navigation to numpad paint. If it was hidden at any point the sample is
// dropped, and the count of dropped samples is shown - silently dropping them
// makes the number look good but not true.
// ============================================================

const KEY = 'fina.startup';
const SKIPPED_KEY = 'fina.startupSkipped';
const KEEP = 8;

export interface StartupSample {
  /** ms from navigation start to numpad paint. */
  ms: number;
  /** false = served from cache (warm app). true = a real network load. */
  network: boolean;
  at: number;
}

let recorded = false;
let cache: StartupSample[] | null = null;
const EMPTY: StartupSample[] = [];
const listeners = new Set<() => void>();

// Whether the page was ever hidden during this load.
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

/** Call right after the entry frame first paints. Safe to call many times. */
export function markReady(): void {
  if (recorded) return;
  recorded = true;

  // Two frames: the first is layout, the second is pixels actually on screen.
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
        // Cannot measure, never mind - this is a diagnostic tool, not a feature.
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
