// 1MM 보고서 서비스 워커 — 화면 파일은 먼저 인터넷에서 새로 받고, 끊기면 저장해 둔 것을 씁니다.
const CACHE = 'mm1-v7';
const SHELL = [
  './', './index.html', './css/app.css?v=6', './js/app.js?v=6',
  './js/util.js', './js/fb.js', './js/schema.js', './js/render.js', './js/editor.js', './js/sources.js',
  './img/logo_h.png', './img/logo_v.png', './icons/icon-192.png', './icons/favicon.png', './manifest.webmanifest'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // 같은 주소의 파일만 다룹니다 (Firebase · 깃허브 요청은 건드리지 않음)
  const same = url.origin === self.location.origin;
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const lib = url.hostname === 'cdnjs.cloudflare.com' || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'));
  if (!same && !font && !lib) return;
  if (font || lib) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
    })));
    return;
  }
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html'))));
});
