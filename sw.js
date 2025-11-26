
const CACHE_NAME = 'scanorder-pro-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
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
  // If user navigates to the app while offline, return index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((response) => {
        return response || fetch(event.request).catch(() => {
           return caches.match('/');
        });
      })
    );
    return;
  }

  // 2. Asset Caching Strategy (Cache First, Network Fallback)
  if (
    requestUrl.hostname.includes('esm.sh') || 
    requestUrl.hostname.includes('aistudiocdn.com') ||
    requestUrl.hostname.includes('cdn.tailwindcss.com') ||
    requestUrl.hostname.includes('flaticon.com') || // Crucial: Cache icons for offline usage
    STATIC_ASSETS.includes(requestUrl.pathname)
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          // Check for valid response
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
            return networkResponse;
          }

          // Clone response to cache it
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        }).catch(() => {
            // Network failed and not in cache
            return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
    );
  } else {
    // 3. API/Other Strategy (Network Only)
    event.respondWith(fetch(event.request));
  }
});
