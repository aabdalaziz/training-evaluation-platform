// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر في الجيب (P19) — الطبقة النقية: صندوق الأدلة الميداني، سياسات الكاش، قرار التثبيت، بطاقة القدرة، نبض الجيب
 *  • الصندوق: عناصر تُلتقط بلا اتصال (ردّ موقف اليوم، دليل مهمة بملف، تفاعل إشعار) بمفتاح idempotency = معرّف العنصر؛ المزامنة لا تكرّر ولا تخترع تواريخ
 *  • الصدق بلا اتصال: كل عرض محلي يحمل «آخر تحديث» ونصًّا صريحًا بما لم يُفحص
 *  • صفر اعتماديات: المعرّفات من crypto.randomUUID (أو بديل)، لا مكتبات
 */

export const POCKET_VERSION = 'athar-sw-v2';
export type OutboxKind = 'daily' | 'mission' | 'push_action';
export type OutboxItem = { id: string; kind: OutboxKind; captured_at: string; tries: number; last_error: string | null; payload: Record<string, any>; size: number };
export type SyncResult = { id: string; ok: boolean; duplicate?: boolean; error?: string | null; retry?: boolean };

export const LIMITS = { file_bytes: 4 * 1024 * 1024, image_bytes: 1.5 * 1024 * 1024, audio_bytes: 3 * 1024 * 1024, text_chars: 4000, outbox_items: 50, max_tries: 8, stale_hours: 48 } as const;
export const OUTBOX_LABEL: Record<OutboxKind, { ar: string; en: string }> = { daily: { ar: 'ردّ موقف اليوم', en: 'Daily case response' }, mission: { ar: 'دليل مهمة من قلب العمل', en: 'Mission evidence' }, push_action: { ar: 'تفاعل إشعار', en: 'Notification action' } };

export function newId(): string { const c: any = (globalThis as any).crypto; if (c?.randomUUID) return c.randomUUID(); const h = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1); return `${h()}${h()}-${h()}-4${h().slice(1)}-${h()}-${h()}${h()}${h()}`; }
export function newItem(kind: OutboxKind, payload: Record<string, any>, now = new Date(), size = 0): OutboxItem { return { id: newId(), kind, captured_at: now.toISOString(), tries: 0, last_error: null, payload, size }; }

/** هل يجوز إدخال العنصر إلى الصندوق؟ (حدود الحجم والعدد) */
export function canQueue(kind: OutboxKind, opts: { size?: number; mime?: string | null; count: number; textChars?: number }): { ok: boolean; reason_ar?: string } {
  if (opts.count >= LIMITS.outbox_items) return { ok: false, reason_ar: `الصندوق ممتلئ (${LIMITS.outbox_items} عنصرًا) — اتصل بالشبكة لإرسال ما فيه أولًا` };
  if ((opts.textChars || 0) > LIMITS.text_chars) return { ok: false, reason_ar: `النص أطول من ${LIMITS.text_chars} حرفًا` };
  const size = opts.size || 0; const mime = String(opts.mime || '');
  if (size > LIMITS.file_bytes) return { ok: false, reason_ar: 'الملف أكبر من 4 ميجابايت' };
  if (mime.startsWith('image/') && size > LIMITS.image_bytes) return { ok: false, reason_ar: 'الصورة أكبر من 1.5 ميجابايت بلا اتصال — صغّرها أو انتظر الشبكة' };
  if (mime.startsWith('audio/') && size > LIMITS.audio_bytes) return { ok: false, reason_ar: 'التسجيل أطول مما يُحفظ بلا اتصال (3 ميجابايت)' };
  if (kind === 'mission' && !opts.mime && !(opts.textChars || 0)) return { ok: false, reason_ar: 'لا دليل لحفظه' };
  return { ok: true };
}
/** ترتيب المزامنة: الأقدم أولًا، والعناصر التي فشلت كثيرًا في النهاية؛ ما تجاوز الحد لا يُعاد */
export function syncPlan(items: OutboxItem[]): { send: OutboxItem[]; dead: OutboxItem[] } {
  const dead = items.filter(i => i.tries >= LIMITS.max_tries); const send = items.filter(i => i.tries < LIMITS.max_tries).sort((a, b) => a.tries - b.tries || a.captured_at.localeCompare(b.captured_at));
  return { send, dead };
}
/** دمج نتيجة المزامنة: نجاح/مكرر → يُحذف؛ خطأ قابل للإعادة → tries+1؛ خطأ نهائي → يُحذف مع سبب */
export function applySync(items: OutboxItem[], results: SyncResult[]): { keep: OutboxItem[]; removed: { item: OutboxItem; why: 'ok' | 'duplicate' | 'rejected' }[] } {
  const byId = new Map(results.map(r => [r.id, r])); const keep: OutboxItem[] = []; const removed: { item: OutboxItem; why: 'ok' | 'duplicate' | 'rejected' }[] = [];
  for (const it of items) {
    const r = byId.get(it.id); if (!r) { keep.push(it); continue; }
    if (r.ok) { removed.push({ item: it, why: r.duplicate ? 'duplicate' : 'ok' }); continue; }
    if (r.retry === false) { removed.push({ item: it, why: 'rejected' }); continue; }
    keep.push({ ...it, tries: it.tries + 1, last_error: r.error || 'خطأ' });
  }
  return { keep, removed };
}
export const isStale = (iso: string | null | undefined, now = new Date(), hours = LIMITS.stale_hours) => !iso || now.getTime() - new Date(iso).getTime() > hours * 3600000;

// ---------- سياسات الكاش (جدول قرار يُطبّقه sw.js حرفيًا) ----------
export type CachePolicy = 'static' | 'api_swr' | 'navigate' | 'bypass' | 'share';
const API_CACHEABLE = ['/api/pocket?view=bundle', '/api/vc?view=mine', '/api/daily', '/api/observatory', '/.well-known/did.json', '/api/vc?status=1', '/api/missions', '/api/m?token='];
export function cachePolicy(url: string, method = 'GET', mode: 'navigate' | 'same-origin' | 'cors' | 'no-cors' = 'same-origin', origin = 'https://athar-portal.vercel.app'): CachePolicy {
  let u: URL; try { u = new URL(url, origin); } catch { return 'bypass'; }
  if (u.origin !== new URL(origin).origin) return 'bypass';
  if (method === 'POST' && u.pathname === '/share') return 'share';
  if (method !== 'GET') return 'bypass';
  if (u.pathname.startsWith('/_next/static/') || u.pathname.startsWith('/icons/') || u.pathname === '/manifest.webmanifest' || u.pathname.startsWith('/logos/')) return 'static';
  if (mode === 'navigate') return 'navigate';
  const key = u.pathname + (u.search ? u.search : '');
  if (API_CACHEABLE.some(p => key === p || key.startsWith(p + '&') || (p.endsWith('=') && key.startsWith(p)) || (p.indexOf('?') < 0 && key.startsWith(p + '?')))) return 'api_swr';
  if (u.pathname.startsWith('/api/')) return 'bypass';
  return 'bypass';
}
/** نص صريح لحالة البيانات المحلية */
export function offlineLine(cachedAt: string | null | undefined, online: boolean, lang: 'ar' | 'en' = 'ar', now = new Date()): string {
  if (online && !cachedAt) return lang === 'ar' ? 'متصل — بيانات حيّة' : 'Online — live data';
  if (!cachedAt) return lang === 'ar' ? 'بلا اتصال — لا نسخة محلية بعد' : 'Offline — no local copy yet';
  const mins = Math.max(0, Math.round((now.getTime() - new Date(cachedAt).getTime()) / 60000)); const ago = mins < 60 ? `${mins} ${lang === 'ar' ? 'دقيقة' : 'min'}` : mins < 1440 ? `${Math.round(mins / 60)} ${lang === 'ar' ? 'ساعة' : 'h'}` : `${Math.round(mins / 1440)} ${lang === 'ar' ? 'يوم' : 'd'}`;
  return online ? (lang === 'ar' ? `متصل — نسخة محلية عمرها ${ago} تُحدَّث الآن` : `Online — local copy ${ago} old, refreshing`) : (lang === 'ar' ? `بلا اتصال — آخر تحديث قبل ${ago}؛ الإلغاء والتغييرات الجديدة لم تُفحص` : `Offline — last update ${ago} ago; revocation and new changes not checked`);
}

// ---------- قرار التثبيت الذكي ----------
export type InstallCtx = { standalone: boolean; ios: boolean; canPrompt: boolean; dismissedAt: string | null; valueMoments: number; now?: Date };
export type InstallDecision = 'none' | 'prompt' | 'ios_hint';
export function installDecision(c: InstallCtx): InstallDecision {
  if (c.standalone) return 'none'; if (c.valueMoments < 1) return 'none';
  if (c.dismissedAt && (c.now || new Date()).getTime() - new Date(c.dismissedAt).getTime() < 30 * 86400000) return 'none';
  if (c.ios) return 'ios_hint'; return c.canPrompt ? 'prompt' : 'none';
}
/** لحظات القيمة التي تستحق اقتراح التثبيت بعدها */
export const VALUE_MOMENTS = ['credential_issued', 'snapshot_issued', 'daily_answered', 'mission_submitted', 'session_attended'] as const;

// ---------- بطاقة القدرة ----------
export type CardLevel = { name_ar: string; name_en?: string | null; level: number; approved: boolean };
export type CardInput = { name: string; email: string; levels: CardLevel[]; snapshot: { code: string; issued_at: string; expires_at?: string | null } | null; fingerprint: string | null; site: string; now?: Date };
export type CapabilityCard = { name: string; initials: string; top: CardLevel[]; verify_url: string | null; code: string | null; valid_until: string | null; fingerprint: string | null; issued_line_ar: string; note_ar: string };
export const LEVEL_NAME_AR = ['', 'مبتدئ', 'متقدم مبتدئ', 'كفء', 'متمكن', 'خبير'];
export function capabilityCard(inp: CardInput): CapabilityCard {
  const top = [...inp.levels].sort((a, b) => Number(b.approved) - Number(a.approved) || b.level - a.level).slice(0, 3);
  const initials = inp.name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('') || (inp.email[0] || '؟').toUpperCase();
  const snap = inp.snapshot; const code = snap?.code || null;
  return { name: inp.name || inp.email, initials, top, code, verify_url: code ? `${inp.site}/verify/vc?code=${encodeURIComponent(code)}` : null, valid_until: snap?.expires_at ? snap.expires_at.slice(0, 10) : null, fingerprint: inp.fingerprint,
    issued_line_ar: snap ? `لقطة قدرة موقَّعة · ${snap.issued_at.slice(0, 10)}` : 'لا لقطة موقَّعة بعد — أصدرها من محفظتك',
    note_ar: top.some(t => t.approved) ? 'المستويات المعتمَدة بشريًا تتقدّم على المحسوبة' : 'مستويات محسوبة من الأدلة — بانتظار اعتماد بشري' };
}
/** SVG للبطاقة (يعمل بلا خطوط خارجية) — يُحوَّل إلى PNG في المتصفح */
export function cardSvg(c: CapabilityCard, qrSvgInner: string | null): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  const rows = c.top.map((t, i) => `<text x="560" y="${165 + i * 44}" font-size="19" fill="#e2e8f0" text-anchor="start" direction="rtl" unicode-bidi="embed" font-family="Tahoma,Arial">${esc(cut(t.name_ar, 26))} <tspan fill="#c9a24b" font-weight="700">${LEVEL_NAME_AR[Math.round(t.level)] || t.level}</tspan>${t.approved ? ' <tspan fill="#5eead4">✓</tspan>' : ''}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340" viewBox="0 0 600 340"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f2a4e"/><stop offset="1" stop-color="#0b8a83"/></linearGradient></defs><rect width="600" height="340" rx="28" fill="url(#g)"/><text x="560" y="56" font-size="16" fill="#c9a24b" text-anchor="start" direction="rtl" unicode-bidi="embed" font-family="Tahoma,Arial" font-weight="700">أَثَر · بطاقة القدرة</text><text x="560" y="100" font-size="30" fill="#fff" text-anchor="start" direction="rtl" unicode-bidi="embed" font-family="Tahoma,Arial" font-weight="700">${esc(c.name)}</text><text x="560" y="128" font-size="14" fill="#cbd5e1" text-anchor="start" direction="rtl" unicode-bidi="embed" font-family="Tahoma,Arial">${esc(c.issued_line_ar)}</text>${rows}${qrSvgInner ? `<g transform="translate(40,120)"><rect x="-8" y="-8" width="156" height="156" rx="12" fill="#fff"/>${qrSvgInner}</g>` : ''}<text x="40" y="310" font-size="12" fill="#cbd5e1" font-family="Tahoma,Arial" direction="ltr">${c.code ? esc(c.code) : ''}${c.fingerprint ? ` · key ${esc(c.fingerprint)}` : ''}</text><text x="560" y="310" font-size="12" fill="#cbd5e1" text-anchor="start" direction="rtl" unicode-bidi="embed" font-family="Tahoma,Arial">${c.valid_until ? `صالحة حتى ${c.valid_until}` : esc(c.note_ar)}</text></svg>`;
}

// ---------- نبض الجيب (إدارة) ----------
export type PulseEvent = { verb: string; object_type: string; at: string; context?: any };
export type Pulse = { installs: number; synced: number; late: number; rejected: number; push_acted: number; push_sent: number; act_rate: number | null; versions: Record<string, number>; last_sync: string | null };
export function pulseOf(events: PulseEvent[], now = new Date()): Pulse {
  const p: Pulse = { installs: 0, synced: 0, late: 0, rejected: 0, push_acted: 0, push_sent: 0, act_rate: null, versions: {}, last_sync: null };
  for (const e of events) {
    if (e.object_type === 'pwa' && e.verb === 'installed') p.installs++;
    if (e.object_type === 'pwa' && e.verb === 'activated') { const v = String(e.context?.version || '?'); p.versions[v] = (p.versions[v] || 0) + 1; }
    if (e.object_type === 'pocket' && e.verb === 'synced') { p.synced++; if (!p.last_sync || e.at > p.last_sync) p.last_sync = e.at; const cap = e.context?.captured_at; if (cap && new Date(e.at).getTime() - new Date(cap).getTime() > LIMITS.stale_hours * 3600000) p.late++; }
    if (e.object_type === 'pocket' && e.verb === 'rejected') p.rejected++;
    if (e.object_type === 'push' && e.verb === 'acted') p.push_acted++;
    if (e.object_type === 'push' && e.verb === 'sent') p.push_sent += Number(e.context?.count || 1);
  }
  p.act_rate = p.push_sent ? Math.round((p.push_acted / p.push_sent) * 100) : null; void now; return p;
}
