const CACHE = 'exp3ndable-v32';
const FILES = ['./', './index.html', './style.css', './game.js', './renderer.js', './engine.js', './difficulty.js', './arsenal.js', './creatures.js', './creature-art.js', './audio.js', './fx.js', './records.js', './checkpoint.js', './dialogue.js', './art.js', './icon.svg', './apple-touch-icon.png', './icon-192.png', './icon-512.png', './manifest.webmanifest'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(file => new Request(file, { cache:'reload' }))))); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const old = keys.filter(key => (key.startsWith('exp3ndable-') || key.startsWith('expendable-')) && key !== CACHE);
    await Promise.all(old.map(key => caches.delete(key)));
    await self.clients.claim();
    // Native waiting activation happens after old clients close. Never navigate a live run.
  })());
});
// Revalidate install metadata online; retain the last valid manifest offline.
async function manifestResponse(request) {
  try {
    const response = await fetch(request, {cache:'no-cache'});
    if(response.ok && response.headers.get('Content-Type')?.includes('json')) {
      const metadata = await response.clone().json();
      if(typeof metadata?.name === 'string' && metadata.name.trim()) {
        try {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        } catch {}
        return response;
      }
    }
  } catch {}
  return (await caches.match(request)) || Response.error();
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(event.request.method !== 'GET' || url.origin !== self.location.origin)return;
  event.respondWith(url.pathname === new URL('./manifest.webmanifest', self.location).pathname
    ? manifestResponse(event.request)
    : caches.match(event.request).then(cached => cached || fetch(event.request)));
});
