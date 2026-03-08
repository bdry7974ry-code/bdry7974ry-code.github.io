const CACHE_NAME = 'slovograi-v15';

const ASSETS = [
  './',
  './index.html',
  './game.html',
  './style.css',
  './main.js',
  './level.js',
  './logic.js',
  './grid.js',
  './generator.js',
  './templates.js',
  './manifest.json',
  './icon-192-v2.png',
  './icon-512-v2.png',
  './assets/dict/core.json',
  './assets/dict/hard.json',
  './assets/dict/bonus.txt',
  './assets/bgm1.mp3',
  './assets/bgm2.mp3',
  './assets/bgm3.mp3',
  './assets/bgm4.mp3',
  './assets/bgm5.mp3',
  './assets/bgm6.mp3',
  './assets/bgm7.mp3'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});