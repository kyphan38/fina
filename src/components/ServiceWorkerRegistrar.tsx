'use client';

import { useEffect } from 'react';

import { registerServiceWorker } from '@/lib/sw';

/**
 * Registers the service worker for the WHOLE app.
 *
 * This call used to live in `PushCard`, which only renders on the Settings
 * tab - so Stage 6's app-shell cache sat idle for anyone who had not opened
 * Settings, and the 1.5s/2.5s speed targets were measured with no cache.
 *
 * Renders nothing. Lives in the root layout so it runs on the sign-in screen too.
 *
 * Imports from `@/lib/sw`, not `@/lib/push`: push pulls in all of
 * `firebase/messaging`, and the app-shell cache should not wait for it.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}
