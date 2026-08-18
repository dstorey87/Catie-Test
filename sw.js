const C = 'theory-trainer-v5';
const CORE = ['./', './index.html', './Theory%20Trainer.dc.html', './support.js', './signs.js',
  './config.js', './backend.js', './manifest.json', './questions-free.json',
  './icon-180.png', './icon-192.png', './icon-512.png', './icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(CORE)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // Only the app shell is cached. Account, billing and question-bank calls go to
  // the server every time so access changes take effect immediately.
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(res => {
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
