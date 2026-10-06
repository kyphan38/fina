// ============================================================
// fina - Service worker registration
//
// This file imports NOTHING, on purpose.
//
// This function used to live in `push.ts`, which imports `firebase/messaging`.
// So the app-shell cache - what decides how fast the app opens - depended on
// the push SDK loading and starting. Two unrelated jobs, and the more
// important one waited behind the less important one.
// ============================================================

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    // Safari private mode and some other contexts refuse. The app still
    // works, just without the cache and push.
    return null;
  }
}
