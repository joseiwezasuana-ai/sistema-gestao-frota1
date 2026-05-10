// Basic Service Worker for PWA compatibility
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through for now, can be used for caching later
  event.respondWith(fetch(event.request));
});
