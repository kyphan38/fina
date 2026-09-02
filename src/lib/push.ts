'use client';

import { doc, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

import { app, db } from '@/lib/firebase-client';

export type PushState =
  /** Đang mở trong tab trình duyệt. iOS chỉ gửi push cho PWA đã cài. */
  | 'not_installed'
  /** Trình duyệt không có Push API. */
  | 'not_supported'
  /** Người dùng đã từ chối - phải sửa trong Cài đặt hệ thống, không hỏi lại được. */
  | 'blocked'
  /** Thiếu NEXT_PUBLIC_FIREBASE_VAPID_KEY. */
  | 'no_key'
  | 'off'
  | 'on';

/** iOS: đã Add to Home Screen chưa. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Ba khả năng "không bật được" là ba việc phải làm khác hẳn nhau. Gộp thành
 * một dòng "không hỗ trợ" là cách chắc chắn để nửa năm sau không ai biết
 * vì sao.
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

/** Đăng ký service worker. Gọi được nhiều lần. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

/**
 * Xin quyền và lưu token. Dùng chung service worker với phần cache - không
 * cần firebase-messaging-sw.js riêng, vì ta gửi data-only và tự vẽ thông báo.
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

/** Tắt nhắc. Quyền hệ thống không thu hồi được từ web - chỉ xoá token. */
export async function disablePush(uid: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'meta', 'fcm'), { token: null, updatedAt: Date.now() });
}
