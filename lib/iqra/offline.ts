// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «اقْرَأْ — من أَثَر» ق٢ (د٣) — «المَنزِلة في جيبي»: عميل بلا اتصال (offline-first للحلقة المحمَّلة فقط)
 *  • التحميل لكلّ مَنزِلة: Cache Storage باسم `athar-iqra:<unit_code>` يحوي JSON الحلقات (نفس مفتاح /api/iqra?view=lesson&id=… بلا ترويسة Authorization)
 *    + الشريط الصوتي والمؤشّرات (/iqra/audio/<code>.mp3 + .cues.json) + سجلّ وصفي `/__iqra-unit/<unit_code>`. سقف مَنزِلتين على الجهاز.
 *    عامل الخدمة (public/sw.js v3) يخدم هذه المفاتيح عند انقطاع الشبكة (network-first → cache fallback) — صفحة /iqra نفسها تُسخَّن (warm-pages).
 *  • صندوق الصادر (outbox): IndexedDB `athar-iqra` → store `outbox` (FIFO). يُقبل فيه: answer · finish · tick · produce (حفظ) · library_answer.
 *    يُعاد إرساله بالترتيب عند عودة الاتصال (حدث online أو رسالة athar-sync من Background Sync بوسم athar-outbox). 4xx تُسقط العنصر (قاعدة الخادم أولى)؛
 *    انقطاع الشبكة يوقف الإعادة إلى المرّة التالية. النبضات تُدمَج حتى 60 ث للعنصر (سقف الخادم) وبسقف 60 عنصرًا (ساعة مقيسة لكلّ انقطاع — صادقة لا سخيّة).
 *  • حيّ فقط (لا يدخل الصندوق): أراجع · سؤال اليوم · إرسال «أُنتج» للمراجعة · طلب العَتَبة · الساعات الخارجية.
 */
export const IQRA_UNIT_CAP = 2;
export const OFFLINE_ACTIONS = ['answer', 'finish', 'tick', 'produce', 'library_answer'] as const;
const CACHE_PREFIX = 'athar-iqra:';
const META = (unit: string) => `/__iqra-unit/${unit}`;
const DB = 'athar-iqra'; const STORE = 'outbox'; const TICK_CAP = 60; const TICK_ITEMS_CAP = 60;

export type UnitMeta = { unit: string; at: string; lessons: number; files: number; bytes: number };
export type OutboxItem = { id?: number; at: string; body: Record<string, unknown>; headers: Record<string, string> };

const hasCaches = () => typeof window !== 'undefined' && 'caches' in window;
const key = (path: string) => new Request(path, { method: 'GET' });

/** المَنازل المحمَّلة على هذا الجهاز */
export async function listUnits(): Promise<UnitMeta[]> {
  if (!hasCaches()) return [];
  const out: UnitMeta[] = [];
  for (const k of await caches.keys()) {
    if (!k.startsWith(CACHE_PREFIX)) continue; const unit = k.slice(CACHE_PREFIX.length);
    const c = await caches.open(k); const m = await c.match(key(META(unit))); const j = m ? await m.json().catch(() => null) : null;
    out.push(j && j.unit ? j : { unit, at: '', lessons: 0, files: 0, bytes: 0 });
  }
  return out.sort((a, b) => a.unit.localeCompare(b.unit));
}

/** تحميل مَنزِلة: الحلقات (JSON) + الصوت والمؤشّرات؛ onProgress(done,total) · يرفض عند السقف (cap) أو غياب Cache API (unsupported) */
export async function downloadUnit(unit: string, lessons: { id: string; code: string }[], headers: Record<string, string>, lessonUrl: (id: string) => string, onProgress?: (done: number, total: number) => void): Promise<{ ok: true; meta: UnitMeta } | { ok: false; error: 'cap' | 'unsupported' | 'network' }> {
  if (!hasCaches()) return { ok: false, error: 'unsupported' };
  const have = await listUnits(); if (!have.some((u) => u.unit === unit) && have.length >= IQRA_UNIT_CAP) return { ok: false, error: 'cap' };
  const name = CACHE_PREFIX + unit; const c = await caches.open(name);
  const jobs: { path: string; auth: boolean; optional: boolean }[] = [];
  for (const l of lessons) { jobs.push({ path: lessonUrl(l.id), auth: true, optional: false }); jobs.push({ path: `/iqra/audio/${l.code}.cues.json`, auth: false, optional: true }); jobs.push({ path: `/iqra/audio/${l.code}.mp3`, auth: false, optional: true }); }
  let done = 0; let bytes = 0; let files = 0;
  for (const j of jobs) {
    try {
      const r = await fetch(j.path, { headers: j.auth ? headers : {}, cache: 'no-store' });
      if (r.ok) { const buf = await r.arrayBuffer(); bytes += buf.byteLength; files += 1; const h = new Headers(); h.set('Content-Type', r.headers.get('Content-Type') || 'application/octet-stream'); h.set('X-Athar-Cached-At', new Date().toISOString()); await c.put(key(j.path), new Response(buf, { status: 200, headers: h })); }
      else if (!j.optional) { await caches.delete(name); return { ok: false, error: 'network' }; }
    } catch { if (!j.optional) { await caches.delete(name); return { ok: false, error: 'network' }; } }
    done += 1; onProgress?.(done, jobs.length);
  }
  const meta: UnitMeta = { unit, at: new Date().toISOString(), lessons: lessons.length, files, bytes };
  await c.put(key(META(unit)), new Response(JSON.stringify(meta), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  return { ok: true, meta };
}

export async function removeUnit(unit: string): Promise<boolean> { if (!hasCaches()) return false; return caches.delete(CACHE_PREFIX + unit); }

/** صيغة الحجم للعرض: «7.4 م.ب» */
export const fmtBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} م.ب` : `${Math.max(1, Math.round(n / 1024))} ك.ب`);

/* ---------- صندوق الصادر ---------- */
function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') { rej(new Error('no-idb')); return; }
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return openDb().then((d) => new Promise<T>((res, rej) => { const t = d.transaction(STORE, mode); const q = fn(t.objectStore(STORE)); let out: T; if (q) q.onsuccess = () => { out = q.result; }; t.oncomplete = () => { d.close(); res(out); }; t.onerror = () => { d.close(); rej(t.error); }; }));
}
export const outboxAll = (): Promise<OutboxItem[]> => tx<OutboxItem[]>('readonly', (s) => s.getAll() as IDBRequest<OutboxItem[]>).catch(() => []);
export const outboxCount = (): Promise<number> => tx<number>('readonly', (s) => s.count()).catch(() => 0);
const outboxDel = (id: number) => tx<undefined>('readwrite', (s) => { s.delete(id); }).catch(() => undefined);
const outboxPut = (it: OutboxItem) => tx<IDBValidKey>('readwrite', (s) => s.put(it)).catch(() => undefined);

/** إدراج عنصر؛ النبضات تُدمَج في آخر نبضة (≤ 60 ث) وبسقف 60 عنصرًا */
export async function enqueue(body: Record<string, unknown>, headers: Record<string, string>): Promise<boolean> {
  if (!OFFLINE_ACTIONS.includes(String(body.action) as any)) return false;
  if (body.action === 'tick') {
    const all = await outboxAll(); const last = all[all.length - 1];
    if (last && last.body.action === 'tick' && last.body.activity === body.activity && Number(last.body.seconds || 0) + Number(body.seconds || 0) <= TICK_CAP) { last.body.seconds = Number(last.body.seconds || 0) + Number(body.seconds || 0); await outboxPut(last); return true; }
    if (all.filter((x) => x.body.action === 'tick').length >= TICK_ITEMS_CAP) return false;
  }
  await outboxPut({ at: new Date().toISOString(), body, headers }); return true;
}

/** إعادة الإرسال بالترتيب؛ تُعيد عدد ما أُرسل وما بقي. تتوقّف عند أوّل انقطاع شبكة؛ 4xx/5xx تُسقط العنصر */
export async function flush(url = '/api/iqra'): Promise<{ sent: number; left: number }> {
  let sent = 0; const items = await outboxAll();
  for (const it of items) {
    try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...it.headers }, body: JSON.stringify(it.body) }); }
    catch { break; }
    await outboxDel(it.id as number); sent += 1;
  }
  return { sent, left: await outboxCount() };
}

/** طلب إيقاظ Background Sync (إن توفّر) — وإلّا يكفي حدث online في الصفحة */
export async function requestSync(): Promise<void> { try { const reg = await navigator.serviceWorker?.ready; await (reg as any)?.sync?.register('athar-outbox'); } catch { /* بلا Background Sync */ } }
export const isNetworkError = (e: unknown) => e instanceof TypeError;
