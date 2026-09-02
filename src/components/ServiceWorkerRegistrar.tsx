'use client';

import { useEffect } from 'react';

import { registerServiceWorker } from '@/lib/push';

/**
 * Đăng ký service worker cho TOÀN APP.
 *
 * Trước đây lời gọi này nằm trong `PushCard`, mà PushCard chỉ render ở tab
 * Settings - nên phần cache app-shell của Stage 6 nằm im với bất kỳ ai chưa
 * mở Settings, và mốc tốc độ 1,5s/2,5s được đo trên một app không có cache.
 *
 * Không render gì. Đặt ở root layout để nó chạy kể cả trên màn hình đăng nhập.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}
