// TENDIDO 039 · Service Worker · v5 · network-first CON LÍMITE DE TIEMPO en HTML,
// con respaldo en caché para no quedarse pegado cuando la señal está lenta (no caída, solo lenta).
// v5: sube la versión del caché para forzar limpieza del HTML viejo en dispositivos ya instalados.
const CACHE = 'tendido039-v5';
const HTML_TIMEOUT_MS = 4000; // si la red no responde en 4s, usa la última copia guardada

self.addEventListener('install', e => {
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

  // sw.js mismo: nunca cachear
  if (url.pathname.endsWith('sw.js')) return;

  // HTML principal: red primero, PERO con límite de tiempo — si la señal está lenta,
  // no se queda pegado esperando: usa la última versión guardada mientras la red responde,
  // y esa respuesta lenta, cuando llegue, actualiza la caché para la próxima vez.
  const esHTML = (
    req.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('/')
  );
  if (esHTML) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const fetchFresco = fetch(req, { cache: 'no-store' }).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);

      const conLimite = Promise.race([
        fetchFresco,
        new Promise(resolve => setTimeout(() => resolve(null), HTML_TIMEOUT_MS))
      ]);

      const rapido = await conLimite;
      if (rapido) return rapido; // la red respondió a tiempo: úsala (más reciente)

      // La red tardó más de lo normal (o falló): usa lo último guardado para no colgar la pantalla
      const guardado = await cache.match(req, { ignoreSearch: true });
      if (guardado) return guardado;

      // Sin caché previa (primera vez que se abre sin buena señal): esperar la red aunque tarde
      const tardia = await fetchFresco;
      if (tardia) return tardia;
      return new Response('Sin señal y sin versión guardada todavía. Conéctate una vez con buena señal para dejar la app lista para usarse sin internet.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })());
    return;
  }

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
