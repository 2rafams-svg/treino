const CACHE = 'tl-v1';

self.addEventListener('install', e => {
  const base = self.registration.scope;
  const shell = [
    base,
    base + 'index.html',
    base + 'app.js',
    base + 'app.css',
    base + 'offline.html',
    base + 'manifest.json',
    base + 'icon-192.png',
    base + 'icon-512.png',
    base + 'apple-touch-icon.png',
  ];
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(shell)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.matchAll({includeUncontrolled: true, type: 'window'}))
      .then(clients => clients.forEach(c => c.postMessage({type: 'SW_UPDATED'})))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if(url.origin !== location.origin) return;

  if(e.request.mode === 'navigate'){
    e.respondWith(
      fetch(e.request)
        .then(res => {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request)
          .then(r => r || caches.match(self.registration.scope + 'offline.html'))
        )
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(res => {
        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
