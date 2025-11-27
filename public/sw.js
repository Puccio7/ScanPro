const CACHE_NAME = 'scanorder-pro-v10';
// CRITICAL FIX: All paths must be relative (./) to work on GitHub Pages
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force activation
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Take control immediately
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 1. Navigation Fallback (For SPA offline support)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      // CRITICAL FIX: Look for relative index.html
      caches.match('./index.html').then((response) => {
        return response || fetch(event.request).catch(() => {
           // Fallback to root relative
           return caches.match('./');
        });
      })
    );
    return;
  }

  // 2. Asset Caching Strategy
  if (
    requestUrl.hostname.includes('esm.sh') || 
    requestUrl.hostname.includes('aistudiocdn.com') ||
    requestUrl.hostname.includes('cdn.tailwindcss.com') ||
    requestUrl.hostname.includes('flaticon.com') || 
    // Check if the path matches one of our relative assets (ignoring the base domain)
    requestUrl.pathname.endsWith('index.html') ||
    requestUrl.pathname.endsWith('manifest.json')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
            return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
    );
  } else {
    event.respondWith(fetch(event.request));
  }
});