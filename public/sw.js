/* © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
 * أَثَر — عامل الخدمة v2 («أَثَر في الجيب» · P19)
 *  1) الهيكل الثابت (_next/static، الأيقونات) كاش أولًا — لا يتغيّر إلا بتغيّر الـ hash
 *  2) التنقل: الشبكة أولًا → نسخة الصفحة المحفوظة → /offline
 *  3) واجهات API مسموح بها (المحفظة، موقف اليوم، المرصد، did.json): الشبكة أولًا؛ وعند الانقطاع نسخة محلية موسومة X-Athar-Cache: stale مع وقت حفظها
 *  4) share_target: POST /share يستقبل صورًا/تسجيلات من تطبيقات الجهاز ويحفظها في IndexedDB ثم يحوّل إلى صفحة الاختيار
 *  5) Background Sync (وسم athar-outbox): إيقاظ الصفحة لمزامنة الصندوق، أو إشعار «أدلة بانتظار الإرسال»
 *  6) الإشعارات: أزرار تفاعل (افتح / قرأته) تُسجَّل في الخادم بمعرّف الاشتراك — بلا كشف هوية
 *  7) رسالة logout تمسح كاش API؛ SKIP_WAITING للتحديث الفوري
 */
const VERSION = 'athar-sw-v2';
const STATIC = VERSION + ':static'; const PAGES = VERSION + ':pages'; const API = VERSION + ':api';
const SHELL = ['/offline', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/badge-72.png'];
const API_ALLOW = ['/api/pocket?view=bundle', '/api/vc?view=mine', '/api/vc?status=1', '/api/daily', '/api/observatory', '/api/missions', '/api/m?token=', '/.well-known/did.json'];
const PAGE_ALLOW = (p) => p === '/' || p === '/offline' || p === '/share' || p.startsWith('/me/') || p.startsWith('/m/') || p === '/observatory' || p === '/verify/vc';
const API_MAX_AGE_MS = 7 * 86400000;

self.addEventListener('install', (e) => { e.waitUntil(caches.open(STATIC).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()).then(() => broadcast({ type: 'athar-version', version: VERSION })).then(() => warmPages(['/share', '/me/card', '/offline'])));
});
/* يسبق تخزين صفحات الجيب وأجزاء JS التي تشير إليها، لتعمل أول مرة بلا اتصال حتى لو لم تُزر */
async function warmPages(paths) {
  const pages = await caches.open(PAGES); const st = await caches.open(STATIC);
  for (const p of paths) {
    try {
      const res = await fetch(p, { credentials: 'same-origin' }); if (!res.ok) continue; const html = await res.clone().text(); await pages.put(p, res);
      const assets = Array.from(new Set((html.match(/\/_next\/static\/[^"'\s)]+/g) || []).map((a) => a.replace(/&amp;/g, '&'))));
      await Promise.all(assets.map((a) => st.match(a).then((hit) => hit || fetch(a).then((r) => r.ok && st.put(a, r)).catch(() => null))));
    } catch { /* لاحقًا */ }
  }
}
self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  if (d.type === 'logout') e.waitUntil(Promise.all([caches.delete(API), caches.delete(PAGES)]));
  if (d.type === 'warm' && Array.isArray(d.urls)) e.waitUntil(Promise.all(d.urls.map((u) => fetch(u, { headers: d.headers || {} }).then((r) => r.ok && putApi(new Request(u), r)).catch(() => null))));
  if (d.type === 'warm-pages' && Array.isArray(d.paths)) e.waitUntil(warmPages(d.paths));
});

function broadcast(msg) { return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => list.forEach((c) => c.postMessage(msg))); }
function apiKey(url) { return url.pathname + url.search; }
function isApiAllowed(url) { const k = apiKey(url); return API_ALLOW.some((p) => k === p || k.startsWith(p + '&') || (p.endsWith('=') && k.startsWith(p)) || (p.indexOf('?') < 0 && k.startsWith(p + '?'))); }
async function putApi(req, res) {
  const h = new Headers(res.headers); h.set('X-Athar-Cached-At', new Date().toISOString()); h.delete('Set-Cookie');
  const body = await res.clone().arrayBuffer(); const c = await caches.open(API);
  await c.put(cacheReq(req), new Response(body, { status: 200, statusText: 'OK', headers: h }));
}
/* نفس الطلب بلا ترويسة Authorization (يُخزَّن بالمسار فقط؛ المحفظة خاصة بالجهاز) */
function cacheReq(req) { const u = new URL(req.url); return new Request(u.pathname + u.search, { method: 'GET' }); }
async function fromApiCache(req) {
  const c = await caches.open(API); const r = await c.match(cacheReq(req)); if (!r) return null;
  const at = r.headers.get('X-Athar-Cached-At'); if (at && Date.now() - new Date(at).getTime() > API_MAX_AGE_MS) return null;
  const h = new Headers(r.headers); h.set('X-Athar-Cache', 'stale'); return new Response(await r.arrayBuffer(), { status: 200, headers: h });
}

self.addEventListener('fetch', (e) => {
  const req = e.request; let url; try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;
  if (req.method === 'POST' && url.pathname === '/share') { e.respondWith(receiveShare(req)); return; }
  if (req.method !== 'GET') return;
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/logos/') || url.pathname === '/manifest.webmanifest') {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(STATIC).then((c) => c.put(req, copy)); } return res; }))); return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { if (res.ok && PAGE_ALLOW(url.pathname)) { const copy = res.clone(); caches.open(PAGES).then((c) => c.put(url.pathname, copy)); } return res; })
      .catch(async () => (await caches.match(url.pathname, { cacheName: PAGES })) || (await caches.match('/offline')) || new Response('offline', { status: 503 })));
    return;
  }
  if (isApiAllowed(url)) {
    e.respondWith(fetch(req).then((res) => { if (res.ok) putApi(req, res).catch(() => null); return res; })
      .catch(async () => (await fromApiCache(req)) || new Response(JSON.stringify({ success: false, offline: true, error: 'بلا اتصال ولا نسخة محلية' }), { status: 503, headers: { 'Content-Type': 'application/json', 'X-Athar-Cache': 'miss' } })));
  }
});

/* ---------- share_target ---------- */
function openDb() { return new Promise((res, rej) => { const r = indexedDB.open('athar-pocket', 1); r.onupgradeneeded = () => { const d = r.result; ['outbox', 'kv', 'keys'].forEach((s) => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, s === 'outbox' ? { keyPath: 'id' } : undefined); }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function kvPut(k, v) { return openDb().then((d) => new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => { d.close(); res(); }; t.onerror = () => { d.close(); rej(t.error); }; })); }
function outboxCount() { return openDb().then((d) => new Promise((res) => { const t = d.transaction('outbox', 'readonly'); const q = t.objectStore('outbox').count(); q.onsuccess = () => { d.close(); res(q.result || 0); }; q.onerror = () => { d.close(); res(0); }; })).catch(() => 0); }
async function receiveShare(req) {
  try {
    const fd = await req.formData(); const files = [];
    for (const f of fd.getAll('files')) { if (f && typeof f.arrayBuffer === 'function' && f.size > 0 && f.size <= 4 * 1024 * 1024) files.push({ name: f.name || 'shared', type: f.type || 'application/octet-stream', buf: await f.arrayBuffer() }); }
    await kvPut('shared', { files, title: String(fd.get('title') || ''), text: String(fd.get('text') || ''), at: new Date().toISOString() });
  } catch { /* نحوّل على أي حال */ }
  return Response.redirect('/share?received=1', 303);
}

/* ---------- Background Sync ---------- */
self.addEventListener('sync', (e) => {
  if (e.tag !== 'athar-outbox') return;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (list.length) { list.forEach((c) => c.postMessage({ type: 'athar-sync' })); return; }
    const n = await outboxCount(); if (!n) return;
    await self.registration.showNotification('أَثَر — أدلة بانتظار الإرسال', { body: `عاد الاتصال وفي صندوقك ${n} ${n === 1 ? 'عنصر' : 'عناصر'}. افتح أَثَر لإرسالها.`, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', tag: 'athar-outbox', lang: 'ar', dir: 'rtl', data: { url: '/?sync=1' } });
  })());
});

/* ---------- Push ---------- */
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: 'أَثَر', body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'أَثَر';
  const actions = Array.isArray(data.actions) ? data.actions : [{ action: 'open', title: 'افتح الموقف' }, { action: 'done', title: 'قرأته' }];
  const opts = { body: data.body || '', icon: data.icon || '/icons/icon-192.png', badge: data.badge || '/icons/badge-72.png', tag: data.tag || 'athar', renotify: true, lang: data.lang || 'ar', dir: 'rtl', actions, data: { url: data.url || '/', tag: data.tag || 'athar' } };
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close(); const d = e.notification.data || {}; const act = e.action || 'open';
  e.waitUntil((async () => {
    try { const sub = await self.registration.pushManager.getSubscription(); if (sub) await fetch('/api/pocket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'push_action', endpoint: sub.endpoint, act, tag: d.tag || null }) }); } catch { /* صامت */ }
    if (act === 'done') return;
    const url = d.url || '/'; const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } } return self.clients.openWindow(url);
  })());
});
