/* © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
 * أَثَر — عامل الخدمة (PWA · P13-ب): صفحة بلا اتصال، كاش خفيف للأيقونات، واستقبال إشعارات «موقف اليوم».
 * لا يخزّن صفحات التطبيق ولا الـ API (الحداثة أهم من السرعة هنا)؛ يسلّم /offline عند انقطاع الشبكة للتنقل فقط.
 */
const VERSION = 'athar-sw-v1';
const SHELL = ['/offline', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/badge-72.png'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') { e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; }))); return; }
  if (req.mode === 'navigate') { e.respondWith(fetch(req).catch(() => caches.match('/offline'))); }
});

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: 'أَثَر', body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'أَثَر';
  const opts = { body: data.body || '', icon: data.icon || '/icons/icon-192.png', badge: data.badge || '/icons/badge-72.png', tag: data.tag || 'athar', renotify: true, lang: data.lang || 'ar', dir: 'rtl', data: { url: data.url || '/' } };
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => { for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } } return self.clients.openWindow(url); }));
});
