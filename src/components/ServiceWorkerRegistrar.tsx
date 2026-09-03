'use client';

import { useEffect } from 'react';

import { registerServiceWorker } from '@/lib/sw';

/**
 * Đăng ký service worker cho TOÀN APP.
 *
 * Trước đây lời gọi này nằm trong `PushCard`, mà PushCard chỉ render ở tab
 * Settings - nên phần cache app-shell của Stage 6 nằm im với bất kỳ ai chưa
 * mở Settings, và mốc tốc độ 1,5s/2,5s được đo trên một app không có cache.
 *
 * Không render gì. Đặt ở root layout để nó chạy kể cả trên màn hình đăng nhập.
 *
 * Import từ `@/lib/sw` chứ không phải `@/lib/push`: push kéo theo cả
 * `firebase/messaging`, và cache app-shell không có lý do gì phải chờ nó.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}
