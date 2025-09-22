const CACHE_NAME = 'adeerhr-cache-v1';
const OFFLINE_QUEUE_KEY = 'adeerhr-offline-attendance-queue';
const CORE_ASSETS = [
  '/',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, copy);
        });
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

async function flushQueue() {
  const allClients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of allClients) {
    client.postMessage({ type: 'FLUSH_ATTENDANCE_QUEUE' });
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'flush-attendance') {
    event.waitUntil(flushQueue());
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'REQUEST_FLUSH') {
    flushQueue();
  }
});
