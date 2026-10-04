'use strict';

// Offline-first service worker for the PKU Tracker PWA.
// Flutter 3.47's built-in service worker self-unregisters, so we ship our own
// cache-first worker to make the app installable and usable offline on iOS
// Safari, Android Chrome, and desktop browsers.

const CACHE_NAME = 'pku-tracker-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './flutter_bootstrap.js',
  './main.dart.js',
  './manifest.json',
  './favicon.png',
  './icons/Icon-192.png',
  './icons/Icon-512.png',
  './icons/Icon-maskable-192.png',
  './icons/Icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Ignore individual failures so a single missing asset cannot abort install.
      Promise.allSettled(CORE_ASSETS.map((url) => cache.add(url))),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only cache same-origin resources; let CDN/API requests go to the network.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) {
        // Serve from cache, refresh in background.
        event.waitUntil(
          fetch(request)
            .then((response) => {
              if (response && response.ok) cache.put(request, response.clone());
            })
            .catch(() => {}),
        );
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      } catch (error) {
        // Navigation requests fall back to the cached shell when offline.
        if (request.mode === 'navigate') {
          const shell = await cache.match('./index.html');
          if (shell) return shell;
        }
        throw error;
      }
    })(),
  );
});
