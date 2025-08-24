// Nazwa naszej pamięci podręcznej (cache)
const CACHE_NAME = 'password-manager-v1';

// Lista plików, które chcemy zapisać w cache, aby aplikacja działała offline
const FILES_TO_CACHE = [
    './', // Reprezentuje plik startowy, czyli index.html
    './index.html',
    './style.css',
    './app.js',
    './icon-192x192.png',
    './icon-512x512.png'
];

// 1. Instalacja Service Workera i zapisanie plików w cache
self.addEventListener('install', (evt) => {
    console.log('[ServiceWorker] Instalacja...');
    // Czekamy, aż wszystkie pliki zostaną dodane do cache
    evt.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] Zapisywanie plików aplikacji do cache...');
            return cache.addAll(FILES_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// 2. Aktywacja Service Workera i czyszczenie starych wersji cache
self.addEventListener('activate', (evt) => {
    console.log('[ServiceWorker] Aktywacja...');
    evt.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[ServiceWorker] Usuwanie starej wersji cache:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

// 3. Przechwytywanie żądań (fetch) i dostarczanie zasobów z cache
self.addEventListener('fetch', (evt) => {
    console.log('[ServiceWorker] Przechwycono żądanie:', evt.request.url);
    // Odpowiadamy na żądanie, sprawdzając najpierw cache
    evt.respondWith(
        caches.match(evt.request).then((response) => {
            // Jeśli zasób jest w cache, zwracamy go. W przeciwnym razie próbujemy pobrać z sieci.
            return response || fetch(evt.request);
        })
    );
});