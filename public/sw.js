// ============================================================
// fina - Service worker
//
// Hai việc, không hơn: nhận push, và cache vỏ app cho nhanh.
// ============================================================

const CACHE_VERSION = 'fina-v1';

// --- Cache -------------------------------------------------
//
// /_next/static/*  cache-first vĩnh viễn. Tên file có hash nội dung, nên
//                  bản build mới là tên file mới - không bao giờ cũ.
// HTML             network-first. Cache-first ở đây là cách chắc chắn nhất
//                  để một hôm nào đó người dùng nhìn vào build tuần trước
//                  mà không hiểu vì sao.
// API / Firestore  KHÔNG đụng vào. Dữ liệu không bao giờ được phục vụ từ
//                  bản cũ.

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_VERSION));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStatic(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/');
}

function isNeverCached(url) {
  return (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/__/')
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (isNeverCached(url)) return;

  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit ?? caches.match('/log'))),
    );
  }
});

// --- Push --------------------------------------------------
//
// Function gửi data-only. Gửi kèm `notification` payload nữa thì iOS hiện
// HAI thông báo cho cùng một lời nhắc.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const payload = data.data ?? data;

  event.waitUntil(
    // title mang cả nội dung: iOS đã hiện tên app ở trên rồi.
    self.registration.showNotification(payload.title || 'fina', {
      body: payload.body || undefined,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag || 'fina-reminder',
      data: { url: payload.url || '/log' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/log';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(target) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
