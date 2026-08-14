const C = 'theory-trainer-v2';
const CORE = ['./', './index.html', './Theory%20Trainer.dc.html', './support.js', './signs.js', './sync.js', './manifest.json',
  './data/questions-1.json', './data/questions-2.json', './data/questions-3.json', './data/questions-4.json', './data/questions-5.json',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icon.png'];
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
