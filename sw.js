// TENDIDO 039 · Service Worker · permite abrir la app sin internet
const CACHE = 'tendido039-v1';
const APP_SHELL = ['./TENDIDO_039_APP.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Firestore y Google Auth: nunca cachear (la sincronización la maneja Firebase)
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('identitytoolkit') ||
      url.hostname.includes('securetoken')) return;

  // HTML de la app: primero red (para recibir actualizaciones), si no hay señal usa la copia guardada
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(req)
        .then(r => { const cl = r.clone(); caches.open(CACHE).then(c => c.put(req, cl)); return r; })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  // Recursos (Firebase SDK, fuentes, Tesseract): primero caché, si no existe lo descarga y lo guarda
  e.respondWith(
    caches.match(req).then(hit =>
      hit || fetch(req).then(r => {
        if (r && (r.status === 200 || r.type === 'opaque')) {
          const cl = r.clone();
          caches.open(CACHE).then(c => c.put(req, cl));
        }
        return r;
      })
    )
  );
});
