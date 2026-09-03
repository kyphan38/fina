// ============================================================
// fina - Đăng ký service worker
//
// File này KHÔNG import gì cả, cố ý.
//
// Trước đây hàm này nằm trong `push.ts`, nơi import `firebase/messaging`.
// Nghĩa là phần cache app-shell - thứ quyết định app mở nhanh hay chậm - lại
// phụ thuộc vào SDK push tải và khởi tạo được. Hai việc không liên quan gì
// tới nhau, và cái quan trọng hơn lại đứng sau cái ít quan trọng hơn.
// ============================================================

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    // Safari private mode và một vài ngữ cảnh khác từ chối. App vẫn chạy,
    // chỉ là không có cache và không nhận được push.
    return null;
  }
}
