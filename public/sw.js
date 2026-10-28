// ============================================================
// fina - Service worker
//
// Two jobs, nothing more: receive push, and cache the app shell for speed.
// ============================================================

// v2: HTML moved to stale-while-revalidate, keyed by pathname.
const CACHE_VERSION = 'fina-v2';

// --- Cache -------------------------------------------------
//
// /_next/static/*  cache-first forever. File names hash their content, so a
//                  new build means new names - never stale.
// HTML             stale-while-revalidate, key = pathname. Pages are static
//                  (auth is checked in the browser), so last build's HTML is
//                  still correct and the app opens without waiting for the
//                  network. The new build is fetched in the background, with
//                  its JS/CSS, and shows on the next open.
// API / Firestore  not touched. Data is never served from an old copy.

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
    const key = url.pathname;
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const hit = await cache.match(key);
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok) event.waitUntil(store(cache, key, res.clone()));
            return res;
          })
          .catch(() => null);
        if (hit) {
          event.waitUntil(fresh);
          return hit;
        }
        return (await fresh) || (await cache.match('/log')) || Response.error();
      }),
    );
  }
});

// Save the HTML, then fetch the JS/CSS it needs now, so the next open (which
// uses this HTML) does not hit the network or a removed old build file.
async function store(cache, key, res) {
  const html = await res.clone().text();
  await cache.put(key, res);
  const urls = new Set();
  for (const m of html.matchAll(/["'(](\/_next\/static\/[^"'()\s]+)/g)) urls.add(m[1]);
  await Promise.all(
    [...urls].map((u) =>
      cache.match(u).then((hit) => hit || fetch(u).then((r) => r.ok && cache.put(u, r)).catch(() => {})),
    ),
  );
}

// --- Push --------------------------------------------------
//
// The function sends data-only. Adding a `notification` payload makes iOS show
// TWO notifications for one reminder.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const payload = data.data ?? data;

  event.waitUntil(
    // title carries the message: iOS already shows the app name above it.
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
