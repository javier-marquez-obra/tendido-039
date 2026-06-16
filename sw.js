// TENDIDO 039 · Service Worker · v3 · network-first en HTML, nunca cachea navegación
const CACHE = 'tendido039-v3';

// Solo recursos estáticos pesados que casi nunca cambian
const PRECACHE = [
  // No precacheamos el HTML — siempre lo jalamos de la red
];

self.addEventListener('install', e => {
  // skipWaiting inmediato: el nuevo SW toma control sin esperar cierre de pestañas
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(
        ks.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Firebase / Google Auth: NUNCA interceptar
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken') ||
    url.hostname.includes('googleapis.com')
  ) return;

  // HTML principal: SIEMPRE red primero, sin guardar en caché
  // Esto garantiza que GitHub Pages entregue la versión más reciente
  if (
    req.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('/')
  ) {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  // sw.js mismo: nunca cachear
  if (url.pathname.endsWith('sw.js')) return;

  // Recursos estáticos (CDN Firebase SDK, fuentes, íconos):
  // caché primero → si no existe, descarga y guarda
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
