// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر في الجيب (P19) — مخزن الجهاز (IndexedDB «athar-pocket»)
 *  • outbox: عناصر الصندوق مشفَّرة AES-GCM بمفتاح جهاز غير قابل للاستخراج (يُولَّد مرة ويُحفظ في مخزن keys)
 *  • kv: بيانات صغيرة (آخر مزامنة، لحظات القيمة، ملفات المشاركة العابرة من share_target)
 *  • يُمسح كله عند تسجيل الخروج (clearPocket)
 *  متصفح فقط — لا يُستورد من الخادم.
 */
import type { OutboxItem } from './pocket';

const DB = 'athar-pocket'; const VER = 1;
type Stored = { id: string; kind: string; captured_at: string; tries: number; last_error: string | null; size: number; iv: ArrayBuffer; data: ArrayBuffer; fiv?: ArrayBuffer; file?: ArrayBuffer; file_type?: string; file_name?: string };

export const hasPocket = () => typeof indexedDB !== 'undefined' && typeof crypto !== 'undefined' && !!crypto.subtle;
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'id' }); if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); if (!d.objectStoreNames.contains('keys')) d.createObjectStore('keys'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return open().then(d => new Promise<T>((res, rej) => { const t = d.transaction(store, mode); const s = t.objectStore(store); let out: any; const q = fn(s); if (q) q.onsuccess = () => { out = q.result; }; t.oncomplete = () => { d.close(); res(out); }; t.onerror = () => { d.close(); rej(t.error); }; t.onabort = () => { d.close(); rej(t.error); }; }));
}
async function deviceKey(): Promise<CryptoKey> {
  const k = await tx<CryptoKey | undefined>('keys', 'readonly', s => s.get('device'));
  if (k) return k;
  const nk = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await tx('keys', 'readwrite', s => { s.put(nk, 'device'); });
  return nk;
}
async function seal(buf: ArrayBuffer): Promise<{ iv: ArrayBuffer; data: ArrayBuffer }> { const key = await deviceKey(); const iv = crypto.getRandomValues(new Uint8Array(12)); const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buf); return { iv: iv.buffer, data }; }
async function unseal(iv: ArrayBuffer, data: ArrayBuffer): Promise<ArrayBuffer> { const key = await deviceKey(); return crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, data); }
const enc = (o: any) => new TextEncoder().encode(JSON.stringify(o)).buffer as ArrayBuffer; const dec = (b: ArrayBuffer) => JSON.parse(new TextDecoder().decode(b));

export async function putItem(item: OutboxItem, file?: Blob | null): Promise<void> {
  const p = await seal(enc(item.payload)); const row: Stored = { id: item.id, kind: item.kind, captured_at: item.captured_at, tries: item.tries, last_error: item.last_error, size: item.size, iv: p.iv, data: p.data };
  if (file) { const f = await seal(await file.arrayBuffer()); row.fiv = f.iv; row.file = f.data; row.file_type = file.type; row.file_name = (file as any).name || 'evidence'; }
  await tx('outbox', 'readwrite', s => { s.put(row); });
}
export async function listItems(): Promise<OutboxItem[]> {
  const rows = (await tx<Stored[]>('outbox', 'readonly', s => s.getAll())) || []; const out: OutboxItem[] = [];
  for (const r of rows) { try { out.push({ id: r.id, kind: r.kind as any, captured_at: r.captured_at, tries: r.tries, last_error: r.last_error, size: r.size, payload: { ...dec(await unseal(r.iv, r.data)), _has_file: !!r.file, _file_type: r.file_type || null, _file_name: r.file_name || null } }); } catch { /* مفتاح مختلف أو تلف — يُتجاهل */ } }
  return out.sort((a, b) => a.captured_at.localeCompare(b.captured_at));
}
export async function getFile(id: string): Promise<Blob | null> { const r = await tx<Stored | undefined>('outbox', 'readonly', s => s.get(id)); if (!r?.file || !r.fiv) return null; try { return new Blob([await unseal(r.fiv, r.file)], { type: r.file_type || 'application/octet-stream' }); } catch { return null; } }
export const removeItem = (id: string) => tx('outbox', 'readwrite', s => { s.delete(id); });
export async function patchItem(id: string, patch: Partial<Pick<OutboxItem, 'tries' | 'last_error'>>): Promise<void> { const r = await tx<Stored | undefined>('outbox', 'readonly', s => s.get(id)); if (!r) return; await tx('outbox', 'readwrite', s => { s.put({ ...r, ...patch }); }); }
export const countItems = () => tx<number>('outbox', 'readonly', s => s.count());
export const kvGet = <T = any>(k: string) => tx<T | undefined>('kv', 'readonly', s => s.get(k));
export const kvSet = (k: string, v: any) => tx('kv', 'readwrite', s => { s.put(v, k); });
export const kvDel = (k: string) => tx('kv', 'readwrite', s => { s.delete(k); });
/** ملفات وصلت عبر share_target (يكتبها sw.js خامًا ومؤقتًا) */
export async function takeShared(): Promise<{ name: string; type: string; buf: ArrayBuffer; title?: string; text?: string }[]> { const v = (await kvGet<any>('shared')) || null; if (v) await kvDel('shared'); return v?.files || []; }
export async function clearPocket(): Promise<void> {
  if (!hasPocket()) return;
  await Promise.all(['outbox', 'kv', 'keys'].map(s => tx(s, 'readwrite', st => { st.clear(); }).catch(() => undefined)));
}
export async function persistStorage(): Promise<boolean> { try { if (navigator.storage?.persist) return await navigator.storage.persist(); } catch { /* ignore */ } return false; }
export async function fileToBase64(b: Blob): Promise<string> { const buf = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + 0x8000))); return btoa(s); }
