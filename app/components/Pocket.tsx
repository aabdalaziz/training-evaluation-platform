'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر في الجيب (P19) — مزوّد الجيب: يوضع في app/layout.tsx مكان PwaRegister
 *  • يسجّل sw.js v2 ويستقبل رسائله (مزامنة · إصدار جديد)
 *  • حالة الاتصال + صندوق الأدلة الميداني (useOutbox): إدخال، عدّ، مزامنة عند عودة الاتصال/الظهور/البدء
 *  • تثبيت ذكي: يُقترح بعد لحظة قيمة (حدث نافذة athar:value) لا عند أول زيارة؛ تلميح iOS
 *  • شريط تحديث «نسخة جديدة» · تدفئة الكاش بحزمة الجيب بعد تسجيل الدخول · مسح الجيب عند الخروج
 *  • شريط الجيب العائم: بلا اتصال / عناصر بانتظار الإرسال / أُرسلت
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { POCKET_VERSION, applySync, canQueue, installDecision, newItem, syncPlan, type OutboxItem, type OutboxKind, type SyncResult } from '../../lib/portal/pocket';
import { clearPocket, countItems, fileToBase64, getFile, hasPocket, kvGet, kvSet, listItems, patchItem, persistStorage, putItem, removeItem } from '../../lib/portal/pocket-db';
import { isIosNotStandalone } from './Pwa';

type Ctx = { online: boolean; supported: boolean; items: OutboxItem[]; count: number; syncing: boolean; lastSync: string | null; lastReport: string; swVersion: string | null;
  enqueue: (kind: OutboxKind, payload: Record<string, any>, file?: Blob | null) => Promise<{ ok: boolean; reason_ar?: string; id?: string }>; sync: () => Promise<void>; remove: (id: string) => Promise<void>; refresh: () => Promise<void>; valueMoment: (kind: string) => void };
const PocketCtx = createContext<Ctx | null>(null);
export const useOutbox = () => { const c = useContext(PocketCtx); if (!c) throw new Error('PocketProvider مفقود'); return c; };
export const VALUE_EVENT = 'athar:value';
/** تُستدعى من الصفحات بعد لحظة قيمة (إصدار شهادة، ردّ موقف، تسليم دليل) */
export function valueMoment(kind: string) { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(VALUE_EVENT, { detail: kind })); }
/** جلسة سريعة: getSession قد تعلّق بلا اتصال (محاولات تجديد الرمز) — نسابقها بمهلة ثم نقرأ الرمز المخزَّن محليًا (يكفي لقراءة الكاش) */
export async function fastToken(db: ReturnType<typeof supabase>, ms = 3500): Promise<string> {
  // الجلسة لدى @supabase/ssr في كعكات sb-<ref>-auth-token(.0,.1…) بقيمة JSON أو base64-JSON؛ وبعض العملاء في localStorage
  const parse = (raw: string) => { try { let r = raw; if (r.startsWith('base64-')) { const b = r.slice(7).replace(/-/g, '+').replace(/_/g, '/'); r = new TextDecoder().decode(Uint8Array.from(atob(b.padEnd(b.length + ((4 - (b.length % 4)) % 4), '=')), c => c.charCodeAt(0))); } const v = JSON.parse(r); return String(v?.access_token || v?.currentSession?.access_token || ''); } catch { return ''; } };
  const stored = () => {
    try { const jar: Record<string, string> = {}; document.cookie.split(';').forEach(c => { const i = c.indexOf('='); if (i > 0) jar[c.slice(0, i).trim()] = c.slice(i + 1).trim(); });
      const names = Object.keys(jar).filter(k => k.startsWith('sb-') && k.includes('-auth-token') && !k.includes('code-verifier')); if (names.length) { const base = names[0].replace(/\.\d+$/, ''); const chunks = names.filter(n => n === base || n.startsWith(base + '.')).sort((a, b) => (Number(a.split('.').pop()) || 0) - (Number(b.split('.').pop()) || 0)); const t = parse(decodeURIComponent(chunks.map(n => jar[n]).join(''))); if (t) return t; } } catch { /* ignore */ }
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) || ''; if (k.startsWith('sb-') && k.endsWith('-auth-token')) { const t = parse(localStorage.getItem(k) || ''); if (t) return t; } } } catch { /* ignore */ }
    return '';
  };
  try { const r = await Promise.race([db.auth.getSession().then(x => x.data.session?.access_token || ''), new Promise<null>(res => setTimeout(() => res(null), ms))]); return r === null ? stored() : (r || stored()); } catch { return stored(); }
}
export const isStandalone = () => typeof window !== 'undefined' && ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone === true);

export function PocketProvider({ children }: { children: React.ReactNode }) {
  const db = useMemo(() => supabase(), []);
  const [online, setOnline] = useState(true); const [items, setItems] = useState<OutboxItem[]>([]); const [syncing, setSyncing] = useState(false); const [lastSync, setLastSync] = useState<string | null>(null); const [lastReport, setLastReport] = useState('');
  const [swVersion, setSwVersion] = useState<string | null>(null); const [waiting, setWaiting] = useState<ServiceWorker | null>(null); const [install, setInstall] = useState<'none' | 'prompt' | 'ios_hint'>('none'); const [toast, setToast] = useState('');
  const promptRef = useRef<any>(null); const wantReload = useRef(false); const supported = typeof window !== 'undefined' && hasPocket(); const busy = useRef(false);
  const token = useCallback(() => fastToken(db), [db]);

  const refresh = useCallback(async () => { if (!supported) return; try { setItems(await listItems()); } catch { /* ignore */ } }, [supported]);
  const sync = useCallback(async () => {
    if (!supported || busy.current || !navigator.onLine) return; busy.current = true; setSyncing(true);
    try {
      const all = await listItems(); const { send } = syncPlan(all); if (!send.length) return;
      const tok = await token(); const hdr: Record<string, string> = { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) };
      const results: SyncResult[] = [];
      const post = async (batch: any[]) => { const r = await fetch('/api/pocket', { method: 'POST', headers: hdr, body: JSON.stringify({ action: 'sync', items: batch }) }); const j = await r.json().catch(() => ({})); if (!r.ok || !j.success) { for (const b of batch) results.push({ id: b.id, ok: false, retry: r.status >= 500 || r.status === 0, error: j.error || `HTTP ${r.status}` }); return; } for (const x of (j.results || [])) results.push(x); };
      const light = send.filter(i => !i.payload._has_file).map(i => ({ id: i.id, kind: i.kind, captured_at: i.captured_at, payload: strip(i.payload) }));
      for (let i = 0; i < light.length; i += 10) await post(light.slice(i, i + 10));
      for (const it of send.filter(i => i.payload._has_file)) { const f = await getFile(it.id); const p: any = { ...strip(it.payload) }; if (f) { p.file_b64 = await fileToBase64(f); p.file_type = f.type; p.file_name = it.payload._file_name || 'evidence'; } await post([{ id: it.id, kind: it.kind, captured_at: it.captured_at, payload: p }]); }
      const { keep, removed } = applySync(all, results);
      for (const r of removed) await removeItem(r.item.id); for (const k of keep) { const prev = all.find(a => a.id === k.id); if (prev && (prev.tries !== k.tries || prev.last_error !== k.last_error)) await patchItem(k.id, { tries: k.tries, last_error: k.last_error }); }
      const okN = removed.filter(r => r.why !== 'rejected').length; const rej = removed.filter(r => r.why === 'rejected').length; const now = new Date().toISOString();
      if (removed.length) { setLastSync(now); await kvSet('last_sync', now); const msg = `${okN ? `أُرسل ${okN} من صندوقك ✓` : ''}${rej ? ` · رُفض ${rej}` : ''}${keep.length ? ` · بقي ${keep.length}` : ''}`.trim(); setLastReport(msg); setToast(msg); setTimeout(() => setToast(''), 6000); }
      setItems(keep.sort((a, b) => a.captured_at.localeCompare(b.captured_at)));
    } catch { /* ستُعاد المحاولة */ } finally { busy.current = false; setSyncing(false); }
  }, [supported, token]);

  const enqueue = useCallback<Ctx['enqueue']>(async (kind, payload, file) => {
    if (!supported) return { ok: false, reason_ar: 'هذا المتصفح لا يدعم الحفظ بلا اتصال' };
    const count = await countItems(); const check = canQueue(kind, { count, size: file?.size || 0, mime: file?.type || null, textChars: String(payload.response || payload.evidence?.text || '').length });
    if (!check.ok) return check;
    const it = newItem(kind, payload, new Date(), file?.size || 0); await putItem(it, file || null); persistStorage(); await refresh();
    try { const reg = await navigator.serviceWorker?.ready; await (reg as any)?.sync?.register('athar-outbox'); } catch { /* بلا Background Sync — الصفحة ستزامن */ }
    if (navigator.onLine) setTimeout(() => { sync(); }, 300);
    return { ok: true, id: it.id };
  }, [supported, refresh, sync]);
  const remove = useCallback(async (id: string) => { await removeItem(id); await refresh(); }, [refresh]);

  // تسجيل عامل الخدمة + رسائله + التحديث
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMsg = (e: MessageEvent) => { const d = e.data || {}; if (d.type === 'athar-sync') sync(); if (d.type === 'athar-version') setSwVersion(String(d.version || '')); };
    navigator.serviceWorker.addEventListener('message', onMsg);
    const t = setTimeout(async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener('updatefound', () => { const nw = reg.installing; nw?.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller && reg.waiting === nw) setWaiting(nw); if (nw.state === 'activated' || nw.state === 'redundant') setWaiting(w => (w === nw ? null : w)); }); });
        const done = await kvGet<string>('activated').catch(() => undefined); if (done !== POCKET_VERSION) { await kvSet('activated', POCKET_VERSION).catch(() => undefined); const tok = await token(); fetch('/api/pocket', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: JSON.stringify({ action: 'activated', version: POCKET_VERSION, standalone: isStandalone(), platform: /iphone|ipad/i.test(navigator.userAgent) ? 'ios' : /android/i.test(navigator.userAgent) ? 'android' : 'desktop' }) }).catch(() => null); }
      } catch { /* بلا PWA */ }
    }, 1200);
    // إعادة التحميل فقط حين يطلب المستخدم التحديث (لا عند أول تثبيت لعامل الخدمة — claim لا يجب أن يقطع الصفحة)
    const onCtrl = () => { setWaiting(null); if (!wantReload.current) return; wantReload.current = false; location.reload(); }; navigator.serviceWorker.addEventListener('controllerchange', onCtrl);
    return () => { clearTimeout(t); navigator.serviceWorker.removeEventListener('message', onMsg); navigator.serviceWorker.removeEventListener('controllerchange', onCtrl); };
  }, [sync, token]);

  // الاتصال · الظهور · البدء · تدفئة الكاش · الخروج
  useEffect(() => {
    if (typeof window === 'undefined') return; setOnline(navigator.onLine);
    const up = () => { setOnline(true); sync(); }; const down = () => setOnline(false); const vis = () => { if (document.visibilityState === 'visible' && navigator.onLine) sync(); };
    window.addEventListener('online', up); window.addEventListener('offline', down); document.addEventListener('visibilitychange', vis);
    refresh(); kvGet<string>('last_sync').then(v => v && setLastSync(v)).catch(() => undefined);
    (async () => { const tok = await token(); if (tok && navigator.onLine) { try { if ('serviceWorker' in navigator) await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(r, 6000))]); } catch { /* بلا SW */ } const warmAt = await kvGet<string>('warm_at').catch(() => undefined); if (!warmAt || Date.now() - new Date(warmAt).getTime() > 20 * 60000) { const h = { Authorization: `Bearer ${tok}` }; await Promise.all(['/api/pocket?view=bundle', '/api/vc?view=mine', '/api/daily', '/api/missions'].map(u => fetch(u, { headers: h }).catch(() => null))); fetch('/.well-known/did.json').catch(() => null); await kvSet('warm_at', new Date().toISOString()).catch(() => undefined); } setTimeout(() => sync(), 800); } })();
    const { data: sub } = db.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { clearPocket().catch(() => undefined); setItems([]); navigator.serviceWorker?.controller?.postMessage({ type: 'logout' }); } });
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); document.removeEventListener('visibilitychange', vis); sub?.subscription?.unsubscribe(); };
  }, [db, refresh, sync, token]);

  // التثبيت الذكي
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onBip = (e: any) => { e.preventDefault(); promptRef.current = e; };
    const decide = async () => { const moments = Number((await kvGet<number>('value_moments').catch(() => 0)) || 0); const dismissed = (await kvGet<string>('install_dismissed').catch(() => undefined)) || null; setInstall(installDecision({ standalone: isStandalone(), ios: isIosNotStandalone(), canPrompt: !!promptRef.current, dismissedAt: dismissed, valueMoments: moments })); };
    const onValue = async () => { const n = Number((await kvGet<number>('value_moments').catch(() => 0)) || 0) + 1; await kvSet('value_moments', n).catch(() => undefined); decide(); };
    const onInstalled = async () => { setInstall('none'); const tok = await token(); fetch('/api/pocket', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: JSON.stringify({ action: 'installed', version: POCKET_VERSION, platform: /iphone|ipad/i.test(navigator.userAgent) ? 'ios' : /android/i.test(navigator.userAgent) ? 'android' : 'desktop' }) }).catch(() => null); };
    window.addEventListener('beforeinstallprompt', onBip); window.addEventListener(VALUE_EVENT, onValue); window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onBip); window.removeEventListener(VALUE_EVENT, onValue); window.removeEventListener('appinstalled', onInstalled); };
  }, [token]);
  const doInstall = async () => { const p = promptRef.current; if (!p) { setInstall('none'); return; } try { p.prompt(); const r = await p.userChoice; if (r?.outcome !== 'accepted') { await kvSet('install_dismissed', new Date().toISOString()); } } catch { /* ignore */ } promptRef.current = null; setInstall('none'); };
  const dismissInstall = async () => { await kvSet('install_dismissed', new Date().toISOString()).catch(() => undefined); setInstall('none'); };

  const value: Ctx = { online, supported, items, count: items.length, syncing, lastSync, lastReport, swVersion, enqueue, sync, remove, refresh, valueMoment };
  const showBar = !online || items.length > 0 || !!toast || !!waiting || install !== 'none';
  return (
    <PocketCtx.Provider value={value}>
      {children}
      {showBar && (
        <div dir="rtl" data-testid="pocket-bar" style={{ position: 'fixed', bottom: 12, insetInlineStart: 12, insetInlineEnd: 12, zIndex: 60, display: 'grid', gap: 6, justifyItems: 'center', pointerEvents: 'none' }}>
          {waiting && <div style={pill('#0f2a4e')}><span>نسخة جديدة من أَثَر جاهزة</span><button onClick={() => { wantReload.current = true; try { waiting.postMessage({ type: 'SKIP_WAITING' }); } catch { /* ignore */ } setTimeout(() => { if (wantReload.current) { wantReload.current = false; location.reload(); } }, 1500); }} style={btn} data-testid="sw-update">حدّث الآن</button></div>}
          {install === 'prompt' && <div style={pill('#0b8a83')} data-testid="install-prompt"><span>ثبّت أَثَر في جيبك — محفظتك وصندوق أدلتك يعملان بلا اتصال</span><button onClick={doInstall} style={btn}>تثبيت</button><button onClick={dismissInstall} style={{ ...btn, background: 'transparent', color: '#fff' }}>لاحقًا</button></div>}
          {install === 'ios_hint' && <div style={pill('#0b8a83')} data-testid="install-ios"><span>على iPhone: زر المشاركة ثم «إضافة إلى الشاشة الرئيسية» — لتعمل المحفظة والصندوق بلا اتصال</span><button onClick={dismissInstall} style={btn}>فهمت</button></div>}
          {!online && <div style={pill('#7c2d12')} data-testid="offline-pill"><span>بلا اتصال — ما تكتبه يُحفظ في صندوق الأدلة ويُرسل تلقائيًا حين يعود الاتصال</span>{items.length > 0 && <b>{items.length}</b>}</div>}
          {online && items.length > 0 && <div style={pill('#334155')} data-testid="outbox-pill"><span>{syncing ? 'جارٍ إرسال صندوق الأدلة…' : `${items.length} في صندوق الأدلة بانتظار الإرسال`}</span>{!syncing && <button onClick={() => sync()} style={btn}>أرسل الآن</button>}</div>}
          {toast && <div style={pill('#166534')} data-testid="pocket-toast">{toast}</div>}
        </div>
      )}
    </PocketCtx.Provider>
  );
}
const strip = (p: Record<string, any>) => { const { _has_file, _file_type, _file_name, ...rest } = p; void _has_file; void _file_type; void _file_name; return rest; };
const pill = (bg: string): React.CSSProperties => ({ pointerEvents: 'auto', background: bg, color: '#fff', borderRadius: 999, padding: '8px 14px', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', boxShadow: '0 6px 24px rgba(15,42,78,.25)', maxWidth: 'min(96vw, 720px)', lineHeight: 1.6 });
const btn: React.CSSProperties = { background: '#c9a24b', color: '#0f2a4e', border: 0, borderRadius: 999, padding: '4px 12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
