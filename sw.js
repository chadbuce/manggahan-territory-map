/* Territory Map service worker: lets the app open offline and install cleanly.
   Strategy: network-first (so GitHub updates show up right away), falling back to the saved copy
   when offline or when the network takes longer than 4 seconds. */
const CACHE = 'territory-map-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './manggahan.svg', './payatas.svg',
  './icons/favicon.svg', './icons/favicon-32.png', './icons/apple-touch-icon.png',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => {}))))   // one missing file won't block install
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fromCache(req){
  return caches.match(req, {ignoreSearch:true})
    .then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : null));
}

function networkFirst(req){
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if(!done){ done = true; resolve(r); } };
    const timer = setTimeout(() => fromCache(req).then(r => { if(r) finish(r); }), 4000);
    fetch(req).then(res => {
      clearTimeout(timer);
      if(res && res.status === 200){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      finish(res);
    }).catch(() => {
      clearTimeout(timer);
      fromCache(req).then(r => finish(r || Response.error()));
    });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  if(new URL(req.url).origin !== self.location.origin) return;   // weather + QR image go straight to the network
  e.respondWith(networkFirst(req));
});
