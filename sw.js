const C = 'theory-trainer-v3';
const CORE = ['./', './index.html', './Theory%20Trainer.dc.html', './support.js', './signs.js', './sync.js', './manifest.json',
  './questions-1.json', './questions-2.json', './questions-3.json', './questions-4.json', './questions-5.json',
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
