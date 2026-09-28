// 离线缓存：安装后无网络也能使用。更新文件时修改 VERSION。
var VERSION = 'yi-v2';
var FILES = ['./', 'index.html', 'style.css', 'js/core.js', 'js/app.js', 'data/text.js', 'data/plain.js',
  'data/plain-2.js', 'data/plain-3.js', 'data/plain-4.js', 'data/plain-5.js', 'data/plain-6.js', 'data/plain-7.js', 'data/plain-8.js',
  'icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// 优先用网络（拿到最新版本），断网时用缓存
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(function (res) {
    var copy = res.clone();
    caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
    return res;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
