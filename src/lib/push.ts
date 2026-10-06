'use client';

import { doc, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

import { app, db } from '@/lib/firebase-client';
import { isStandalone } from '@/lib/standalone';
import { registerServiceWorker } from '@/lib/sw';

export type PushState =
  /** Open in a browser tab. iOS only sends push to an installed PWA. */
  | 'not_installed'
  /** The browser has no Push API. */
  | 'not_supported'
  /** The user said no - must be fixed in system settings, cannot ask again. */
  | 'blocked'
  /** NEXT_PUBLIC_FIREBASE_VAPID_KEY is missing. */
  | 'no_key'
  | 'off'
  | 'on';


/**
 * The three ways "cannot enable" happens need three different fixes. Merging
 * them into one "not supported" line guarantees nobody knows why six months later.
 */
export async function pushState(): Promise<PushState> {
  if (typeof window === 'undefined') return 'not_supported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return isStandalone() ? 'not_supported' : 'not_installed';
  }
  if (!(await isSupported())) return 'not_supported';
  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) return 'no_key';
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' ? 'on' : 'off';
}

/**
 * Asks for permission and stores the token. Shares the service worker with
 * the cache - no separate firebase-messaging-sw.js, since we send data-only
 * and draw the notification ourselves.
 */
export async function enablePush(uid: string): Promise<PushState> {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) return 'no_key';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';

  const registration = await registerServiceWorker();
  if (!registration) return 'not_supported';

  const token = await getToken(getMessaging(app), {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) return 'off';

  await setDoc(doc(db, 'users', uid, 'meta', 'fcm'), {
    token,
    platform: navigator.userAgent.slice(0, 120),
    updatedAt: Date.now(),
  });
  return 'on';
}

/** Turns reminders off. The web cannot revoke the system permission - it only deletes the token. */
export async function disablePush(uid: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'meta', 'fcm'), { token: null, updatedAt: Date.now() });
}
