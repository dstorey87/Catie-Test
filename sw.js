// Theory Trainer service worker.
// BUMP VERSION in every deploy that changes any file in CORE — the cache name is
// the only update signal existing installs get. Merging without a bump ships a
// stale shell to every install that is currently offline.
const VERSION = 'v6-2026-08-19';
const C = 'theory-trainer-' + VERSION;
const CORE = ['./', './index.html', './Theory%20Trainer.dc.html', './support.js', './signs.js',
  './config.js', './backend.js', './manifest.json', './questions-free.json'];
const EXTRAS = ['./icon-180.png', './icon-192.png', './icon-512.png', './icon.png'];

// The paid bank must never enter this cache: once the public files are removed
// from the repo, a cached copy would keep serving it to accountless installs.
const NEVER_CACHE = /\/questions-\d+\.json$/;

self.addEventListener('install', e => {
  // {cache:'reload'} bypasses the HTTP cache, so the precache can't be filled
  // with stale bytes the Pages CDN was still serving. The shell precaches
  // atomically or the install FAILS — the old worker and its working cache
  // then stay in charge until the next attempt, instead of activate purging
  // a good cache in favour of an empty one. Icons are best-effort.
  e.waitUntil((async () => {
    const c = await caches.open(C);
    await c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })));
    await Promise.all(EXTRAS.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  // Deleting every other cache is also what purges old copies of the paid bank.
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // Account, billing and question-bank calls go to the server every time so
  // access changes take effect immediately; the paid bank is never cached.
  if (e.request.method !== 'GET' || u.origin !== location.origin || NEVER_CACHE.test(u.pathname)) return;

  if (e.request.mode === 'navigate') {
    // Network-first: a deploy reaches every install on its next open, instead
    // of always being one full load behind. But only with a short patience
    // window — a connected-but-dead link must not blank an app whose complete
    // shell sits in the cache (it would hang until the OS socket timeout).
    e.respondWith((async () => {
      const net = fetch(e.request.url, { cache: 'no-cache' }).then(res => {
        if (res && res.ok) { const cl = res.clone(); caches.open(C).then(c => c.put(e.request, cl)); }
        return res;
      });
      const winner = await Promise.race([
        net.catch(() => undefined),
        new Promise(r => setTimeout(() => r(undefined), 3500))
      ]);
      if (winner) return winner;
      const hit = await caches.match(e.request) || await caches.match('./Theory%20Trainer.dc.html');
      return hit || net.catch(() =>
        new Response('You are offline and no saved copy is available yet.',
          { status: 503, headers: { 'Content-Type': 'text/plain' } }));
    })());
    return;
  }

  // Everything else: serve from cache, refresh from the origin in the background.
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request, { cache: 'no-cache' }).then(res => {
        if (res && res.ok) { const cl = res.clone(); caches.open(C).then(c => c.put(e.request, cl)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

// ---------- daily reminders ----------
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  const title = d.title || 'Theory Trainer';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || 'Time for a quick practice.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'tt-daily',
    renotify: false,
    data: { url: d.url || './index.html' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes('Theory') || c.url.endsWith('/')) { await c.focus(); return; }
    }
    await clients.openWindow(target);
  })());
});
