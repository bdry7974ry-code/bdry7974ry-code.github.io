const CACHE_NAME = 'slovosvit-v5';

const ASSETS = [
  './',
  './index.html',
  './landing.html',
  './game.html',
  './privacy.html',
  './style.css',
  './main.js',
  './grid.js',
  './logic.js',
  './level.js',
  './generator.js',
  './templates.js',
  './manifest.json',
  './favicon.ico',
  './icon-192-v2.png',
  './icon-512-v2.png',
  './assets/dict/core.json',
  './assets/dict/bonus.txt',
  './assets/dict/hard.json',
  './assets/bgm.mp3',
  './assets/bgm1.mp3',
  './assets/bgm2.mp3',
  './assets/bgm3.mp3',
  './assets/bgm4.mp3',
  './assets/bgm5.mp3',
  './assets/bgm6.mp3',
  './assets/bgm7.mp3',
  './assets/bgm8.mp3',
  './assets/bgm9.mp3',
  './assets/ui/Menu_Finish.png',
  './assets/ui/Menu_Finish1.png',
  './assets/ui/Level_normal.png',
  './assets/ui/btn_exit_disabled.png',
  './assets/ui/btn_exit_normal.png',
  './assets/ui/btn_exit_pressed.png',
  './assets/ui/btn_hover.png',
  './assets/ui/btn_modals.png',
  './assets/ui/btn_normal.png',
  './assets/ui/btn_pressed.png',
  './assets/ui/btn_primary_disabled.png',
  './assets/ui/btn_primary_normal.png',
  './assets/ui/btn_primary_pressed.png',
  './assets/ui/btn_secondary_disabled.png',
  './assets/ui/btn_secondary_normal.png',
  './assets/ui/btn_secondary_pressed.png',
  './assets/ui/chip_normal.png',
  './assets/ui/game_bg.png',
  './assets/ui/goal-stats.png',
  './assets/ui/house.png',
  './assets/ui/menu_bg.png',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
