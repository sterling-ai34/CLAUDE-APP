// Service worker: permite instalar la app y abrirla rápido.
// Solo guarda los archivos de la app; los datos (TMDB, noticias) siempre se piden en vivo.
const VERSION = 'galions-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/app.js',
  './assets/js/api.js',
  './assets/js/store.js',
  './assets/js/ui.js',
  './assets/js/icons.js',
  './assets/js/recs.js',
  './assets/js/notify.js',
  './assets/js/sync.js',
  './assets/js/views/home.js',
  './assets/js/views/explore.js',
  './assets/js/views/search.js',
  './assets/js/views/detail.js',
  './assets/js/views/person.js',
  './assets/js/views/foryou.js',
  './assets/js/views/following.js',
  './assets/js/views/news.js',
  './assets/js/views/library.js',
  './assets/js/views/settings.js',
  './assets/js/views/onboard.js',
  './assets/img/logo.svg',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// Archivos de la app: primero la red (para tener siempre la última versión) y, sin conexión, la copia guardada.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
  );
});

// Al tocar una notificación, abre la app.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const c = list.find((x) => 'focus' in x);
      return c ? c.focus() : self.clients.openWindow('./');
    }),
  );
});
