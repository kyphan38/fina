// ============================================================
// fina - Shared clock
//
// React 19 forbids Date.now() during render: the result changes per render
// and nobody can predict when a component re-renders.
//
// Read the time in one place, update every minute, expose it via
// useSyncExternalStore - render stays pure, and the app still notices the
// cycle turning at midnight on the 25th even when left open.
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
  // The server has no correct "now" for the client - return 0 and let the
  // render after hydration fill in the real value.
  getServer: () => 0,
};
