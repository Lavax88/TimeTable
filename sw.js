const CACHE_NAME = 'timetable-cache-v0';

// All the files your app needs to run offline
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/timetable.js',
  './js/notifications.js',
  './manifest.json',
  './logo.png',
  './data.json'
];

// 1. Install Event: Cache all assets and force waiting worker to become active
self.addEventListener('install', event => {
  self.skipWaiting(); // Forces the new service worker to activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Fetch Event: Serve from cache first, then network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return the cached version if found
        if (response) {
          return response;
        }
        // Otherwise, fetch it from the network
        return fetch(event.request);
      })
  );
});

// 3. Activate Event: Clean up old caches when you update the version number
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
});
