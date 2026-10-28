// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — الإبلاغ متعدد القنوات «نبض الوصول» (P16)
 *  رسالة واحدة تُكتب مرة وتصل بأي قناة متاحة: واتساب (Cloud API) ← بريد (Resend) ← إشعار فوري (Web Push) ← «قائمة اليد».
 *  المبادئ: لا رسالة تضيع بصمت · الحالة المعروضة هي حالة المزوّد الفعلية · لا واتساب بلا موافقة ولا في ساعات الهدوء ·
 *           غياب مفاتيح قناة يعني «غير مضبوطة» لا عطلًا · صفر اعتماديات خارجية.
 */
import { sendWhatsAppTemplate, waConfig } from './whatsapp';
import { sendPush, vapidFromEnv } from './push';
import { waParams, templateFor } from './messages';

export type Channel = 'whatsapp' | 'email' | 'push' | 'manual';
export type Status = 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'manual' | 'done';
export const CHANNEL_AR: Record<Channel, string> = { whatsapp: 'واتساب', email: 'بريد', push: 'إشعار فوري', manual: 'تسليم يدوي' };
export const STATUS_AR: Record<Status, string> = { queued: 'قيد الإرسال', sent: 'أُرسلت', delivered: 'وصلت', read: 'قُرئت', failed: 'فشلت', manual: 'بانتظار اليد', done: 'سُلّمت يدويًا' };
export const CHANNEL_ORDER: Channel[] = ['whatsapp', 'email', 'push'];

export type Prefs = { email: string; user_id?: string | null; phone_e164?: string | null; whatsapp_opt_in?: boolean | null; preferred_channel?: Channel | null; quiet_from?: string | null; quiet_to?: string | null; push_ok?: boolean | null };
export type ChannelEnv = { whatsapp: boolean; email: boolean; emailTest: boolean; push: boolean; from: string; adminPhone: string | null; site: string };
export type OutMessage = {
  kind: string; to: { email?: string | null; phone?: string | null; name?: string | null }; subject: string;
  html?: string; text?: string | null; url?: string | null; ref?: string | null; params?: Record<string, string>;
  attachments?: { filename: string; content: string }[]; replyTo?: string;
};
export type LogRow = {
  id: number; kind: string; ref_id: string | null; to_email: string | null; to_phone: string | null; to_name: string | null; subject: string;
  channel: Channel; status: Status; plan: Channel[]; attempts: number; errors: { channel: Channel; error: string; at: string }[]; provider_id: string | null;
  payload: { text?: string; url?: string | null; html?: string; wa?: { template: string; params: string[] } | null }; next_at: string | null;
  created_at: string; sent_at: string | null; delivered_at: string | null; read_at: string | null; manual_done_at: string | null; manual_by: string | null;
};
export type Delivery = { ok: boolean; channel: Channel; status: Status; id: number | null; provider_id?: string | null; error?: string | null; plan: Channel[]; duplicate?: boolean };

// ====================================================================== البيئة
export const DEFAULT_FROM = 'Training Evaluation Platform <onboarding@resend.dev>';
export function fromAddress(env: NodeJS.ProcessEnv = process.env): string { return String(env.REPORTS_FROM_EMAIL || '').trim() || DEFAULT_FROM; }
export function channelEnv(env: NodeJS.ProcessEnv = process.env): ChannelEnv {
  const from = fromAddress(env);
  return {
    whatsapp: !!waConfig(env), email: !!String(env.RESEND_API_KEY || '').trim(), emailTest: /resend\.dev/i.test(from), push: !!vapidFromEnv(env),
    from, adminPhone: normalizePhone(env.OUTREACH_ADMIN_PHONE || ''), site: String(env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, ''),
  };
}

// ====================================================================== أدوات
/** تطبيع رقم الهاتف إلى أرقام E.164 بلا «+» (السعودية افتراضًا): 05xxxxxxxx → 9665xxxxxxxx */
export function normalizePhone(raw: string | null | undefined, defaultCountry = '966'): string | null {
  let d = String(raw || '').replace(/\D/g, ''); if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('0')) d = defaultCountry + d.slice(1);
  else if (d.length === 9 && d.startsWith('5')) d = defaultCountry + d;
  if (d.length < 8 || d.length > 15) return null;
  return d;
}
/** نص مقروء من HTML البريد (للنسخ وواتساب والإشعار) مع إبقاء الروابط */
export function textFromHtml(html: string | null | undefined, max = 900): string {
  let s = String(html || '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, inner) => `${String(inner).replace(/<[^>]+>/g, '').trim()} ${href}`);
  s = s.replace(/<(br|\/?p|\/?div|\/?li|\/?h[1-6]|\/?tr|\/?ul|\/?ol|\/?table)\b[^>]*>/gi, '\n').replace(/<\/?(td|th)\b[^>]*>/gi, ' ').replace(/<[^>]+>/g, '');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  s = s.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
export function extractUrl(html: string | null | undefined, site = ''): string | null {
  const all = Array.from(String(html || '').matchAll(/href="(https?:\/\/[^"]+)"/gi)).map(m => m[1]);
  if (!all.length) return null;
  return (site && all.find(u => u.startsWith(site))) || all[0];
}
/** رابط «افتح في واتساب» من هاتف الإداري نفسه — يعمل بلا أي حساب Cloud API */
export function waLink(phone: string | null | undefined, text: string): string {
  const p = normalizePhone(phone); return `https://wa.me/${p || ''}?text=${encodeURIComponent(text)}`;
}
/** هل الآن داخل ساعات الهدوء (بتوقيت الرياض)؟ 'HH:MM' → 'HH:MM'، ويدعم العبور عبر منتصف الليل */
export function inQuietHours(p: Pick<Prefs, 'quiet_from' | 'quiet_to'> | null | undefined, now = new Date(), tz = 'Asia/Riyadh'): boolean {
  const f = parseHM(p?.quiet_from), t = parseHM(p?.quiet_to); if (f === null || t === null || f === t) return false;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const h = Number(parts.find(x => x.type === 'hour')?.value || 0) % 24, m = Number(parts.find(x => x.type === 'minute')?.value || 0); const cur = h * 60 + m;
  return f < t ? cur >= f && cur < t : cur >= f || cur < t;
}
function parseHM(s: string | null | undefined): number | null { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim()); if (!m) return null; const h = Number(m[1]), mi = Number(m[2]); if (h > 23 || mi > 59) return null; return h * 60 + mi; }
/** موعد انتهاء الهدوء (ISO) — لإعادة المحاولة من الكرون */
export function quietEnds(p: Pick<Prefs, 'quiet_to'> | null | undefined, now = new Date(), tz = 'Asia/Riyadh'): string {
  const t = parseHM(p?.quiet_to); if (t === null) return new Date(now.getTime() + 3600000).toISOString();
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const cur = (Number(parts.find(x => x.type === 'hour')?.value || 0) % 24) * 60 + Number(parts.find(x => x.type === 'minute')?.value || 0);
  let delta = t - cur; if (delta <= 0) delta += 24 * 60; return new Date(now.getTime() + delta * 60000).toISOString();
}

/** حسم ترتيب القنوات لشخص: المفضّلة أولًا ثم البقية — فقط المضبوطة والمتاحة له — وتنتهي دائمًا بـ«اليد» */
export function planChannels(p: Prefs | null | undefined, env: ChannelEnv, opts: { hasPush?: boolean; phone?: string | null } = {}): Channel[] {
  const phone = p?.phone_e164 || normalizePhone(opts.phone);
  const can: Record<Channel, boolean> = {
    whatsapp: env.whatsapp && !!phone && !!p?.whatsapp_opt_in,
    email: env.email && !!p?.email,
    push: env.push && !!opts.hasPush && p?.push_ok !== false,
    manual: true,
  };
  const pref = (p?.preferred_channel && CHANNEL_ORDER.includes(p.preferred_channel) ? [p.preferred_channel] : []) as Channel[];
  const order = [...pref, ...CHANNEL_ORDER.filter(c => !pref.includes(c))];
  return [...order.filter(c => can[c]), 'manual'];
}

// ====================================================================== المحوّلات (adapters)
export async function sendEmailRaw(payload: { to: string[]; subject: string; html: string; attachments?: { filename: string; content: string }[]; replyTo?: string; tags?: { name: string; value: string }[] }, env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): Promise<{ id?: string }> {
  const key = env.RESEND_API_KEY; if (!key) throw new Error('RESEND_API_KEY غير مضبوط في Vercel');
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromAddress(env), to: payload.to, subject: payload.subject, html: payload.html, reply_to: payload.replyTo, attachments: payload.attachments?.map(a => ({ filename: a.filename, content: a.content })), tags: payload.tags }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) { const msg = String(json?.message || json?.error || `Resend HTTP ${res.status}`); throw new Error(/testing emails|own email address/i.test(msg) ? 'البريد في وضع الاختبار (resend.dev) — لا يصل إلا لصاحب حساب Resend. اضبط REPORTS_FROM_EMAIL بنطاق متحقَّق' : msg); }
  return json as { id?: string };
}

async function pushSubsFor(db: any, email: string, userId: string | null | undefined): Promise<any[]> {
  try {
    let uid = userId || null;
    if (!uid) { const { data: p } = await db.from('profiles').select('id').eq('email', email).maybeSingle(); uid = (p as any)?.id || null; }
    if (!uid) return [];
    const { data } = await db.from('portal_push_subscriptions').select('id,endpoint,p256dh,auth,lang').eq('user_id', uid).eq('active', true).limit(5);
    return (data || []) as any[];
  } catch { return []; }
}

// ====================================================================== المحرك
export type NotifyOpts = { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; now?: Date };
/** يرسل رسالة واحدة لشخص واحد عبر أول قناة تنجح، ويسجّل كل محاولة. لا يرمي أخطاء أبدًا. */
export async function notify(db: any, msg: OutMessage, opts: NotifyOpts = {}): Promise<Delivery> {
  const env = channelEnv(opts.env || process.env); const now = opts.now || new Date(); const fetchImpl = opts.fetchImpl || fetch;
  const email = String(msg.to.email || '').trim().toLowerCase() || null;
  let prefs: Prefs | null = null;
  if (email) { try { const { data } = await db.from('portal_contact_prefs').select('*').eq('email', email).maybeSingle(); prefs = (data as Prefs) || null; } catch { prefs = null; } }
  if (!prefs && email) prefs = { email };
  const phone = prefs?.phone_e164 || normalizePhone(msg.to.phone) || null;
  const subs = email && env.push ? await pushSubsFor(db, email, prefs?.user_id) : [];
  const plan = planChannels(prefs, env, { hasPush: subs.length > 0, phone });
  const text = msg.text || textFromHtml(msg.html); const url = msg.url || extractUrl(msg.html, env.site);
  const tpl = templateFor(msg.kind); const wa = { template: tpl.name, params: waParams(msg.kind, { name: msg.to.name || '', subject: msg.subject, url: url || env.site, ...(msg.params || {}) }) };
  // لا تكرار في قائمة اليد: الرسالة نفسها (النوع + المستلم + الموضوع) المنتظرة تسليمًا يدويًا خلال 7 أيام لا تُدرج مرتين (المرسِلون القدامى يعيدون المحاولة يوميًا)
  if (email) { try { const { data: dup } = await db.from('portal_message_log').select('id,plan').eq('to_email', email).eq('kind', msg.kind).eq('subject', msg.subject).eq('status', 'manual').gte('created_at', new Date(now.getTime() - 7 * 86400000).toISOString()).limit(1); const d = ((dup || []) as any[])[0]; if (d) return { ok: true, channel: 'manual', status: 'manual', id: Number(d.id), plan: d.plan || plan, error: 'موجودة في قائمة اليد مسبقًا', duplicate: true }; } catch { /* ignore */ } }
  const row: Partial<LogRow> = { kind: msg.kind, ref_id: msg.ref || null, to_email: email, to_phone: phone, to_name: msg.to.name || null, subject: msg.subject, channel: 'manual', status: 'queued', plan, attempts: 0, errors: [], payload: { text, url, html: msg.html ? String(msg.html).slice(0, 20000) : undefined, wa }, created_at: now.toISOString() };
  let id: number | null = null;
  try { const { data } = await db.from('portal_message_log').insert(row).select('id').single(); id = Number((data as any)?.id) || null; } catch { id = null; }
  const r = await attempt(db, { ...(row as LogRow), id: id || 0 }, { prefs, subs, env, raw: opts.env || process.env, fetchImpl, now, attachments: msg.attachments, replyTo: msg.replyTo });
  return { ...r, id, plan };
}

/** محاولة التسليم عبر خطة الصف (تُستخدم من notify ومن إعادة المحاولة في الكرون) */
export async function attempt(db: any, row: LogRow, c: { prefs: Prefs | null; subs: any[]; env: ChannelEnv; raw: NodeJS.ProcessEnv; fetchImpl: typeof fetch; now: Date; attachments?: { filename: string; content: string }[]; replyTo?: string }): Promise<Omit<Delivery, 'id' | 'plan'>> {
  const errors = [...(row.errors || [])]; const quiet = inQuietHours(c.prefs, c.now); let deferred = false;
  const patch = async (p: Record<string, unknown>) => { if (row.id) { try { await db.from('portal_message_log').update(p).eq('id', row.id); } catch { /* ignore */ } } };
  const tried = new Set(errors.map(e => e.channel));
  for (const ch of row.plan.filter(x => x !== 'manual')) {
    if (tried.has(ch)) continue;
    if (quiet && (ch === 'whatsapp' || ch === 'push')) { deferred = true; continue; }
    try {
      let providerId: string | null = null;
      if (ch === 'email') { const r = await sendEmailRaw({ to: [row.to_email!], subject: row.subject, html: row.payload.html || `<div dir="rtl">${row.payload.text || ''}</div>`, attachments: c.attachments, replyTo: c.replyTo, tags: [{ name: 'kind', value: row.kind.slice(0, 50) }] }, c.raw, c.fetchImpl); providerId = r.id || null; }
      else if (ch === 'whatsapp') { const cfg = waConfig(c.raw)!; const r = await sendWhatsAppTemplate(cfg, row.to_phone!, row.payload.wa!.template, row.payload.wa!.params, c.fetchImpl); if (!r.ok) throw new Error(r.error || 'whatsapp'); providerId = r.id || null; }
      else if (ch === 'push') {
        const keys = vapidFromEnv(c.raw)!; let ok = false, err = '';
        for (const s of c.subs) { const r = await sendPush(s, { title: 'أَثَر', body: row.subject, url: row.payload.url || undefined, tag: row.kind }, keys, { fetchImpl: c.fetchImpl, ttl: 24 * 3600 }); if (r.ok) ok = true; else err = r.error || `HTTP ${r.status}`; }
        if (!ok) throw new Error(err || 'لا اشتراك فعّال');
      }
      await patch({ channel: ch, status: 'sent', provider_id: providerId, attempts: (row.attempts || 0) + 1, errors, sent_at: c.now.toISOString(), next_at: null });
      return { ok: true, channel: ch, status: 'sent', provider_id: providerId };
    } catch (e: any) { errors.push({ channel: ch, error: String(e?.message || e).slice(0, 300), at: c.now.toISOString() }); }
  }
  if (deferred && (row.attempts || 0) < 3) { await patch({ status: 'queued', attempts: (row.attempts || 0) + 1, errors, next_at: quietEnds(c.prefs, c.now) }); return { ok: true, channel: 'manual', status: 'queued', error: 'مؤجَّلة حتى انتهاء ساعات الهدوء' }; }
  const err = errors.length ? errors.map(e => `${CHANNEL_AR[e.channel]}: ${e.error}`).join(' · ') : 'لا قناة آلية مضبوطة لهذا الشخص';
  await patch({ channel: 'manual', status: 'manual', attempts: (row.attempts || 0) + 1, errors, next_at: null });
  return { ok: true, channel: 'manual', status: 'manual', error: err };
}

// ====================================================================== نبض الوصول
export type Reach = { email: string; level: 'green' | 'yellow' | 'grey'; label: string; why: string };
export function reachOf(email: string, prefs: Prefs | null | undefined, env: ChannelEnv, recent: Pick<LogRow, 'status' | 'channel'>[]): Reach {
  const confirmed = recent.some(r => r.status === 'delivered' || r.status === 'read');
  const waReady = env.whatsapp && !!prefs?.phone_e164 && !!prefs?.whatsapp_opt_in;
  if (confirmed || waReady) return { email, level: 'green', label: 'يصله', why: confirmed ? 'تأكد وصول رسالة خلال 30 يومًا' : 'واتساب مفعَّل بموافقته' };
  const sentOk = recent.some(r => r.status === 'sent' && r.channel !== 'manual');
  if ((env.email && !env.emailTest) || sentOk) return { email, level: 'yellow', label: 'بريد فقط', why: sentOk ? 'أُرسلت له رسالة ولم يُؤكَّد وصولها' : 'لا هاتف ولا موافقة واتساب — البريد هو القناة الوحيدة' };
  return { email, level: 'grey', label: 'لا قناة', why: env.emailTest ? 'البريد في وضع الاختبار ولا هاتف مسجَّل — سيصل عبر قائمة اليد' : 'لا قناة آلية مضبوطة — سيصل عبر قائمة اليد' };
}

// ====================================================================== ما تتعلمه الحلقة عن القنوات
export const MIN_PEOPLE = 5;
/** هل تحرّك القناة الناس؟ نسبة تسليم الدليل بعد رسالة إسناد مهمة، لكل قناة — لا يُعرض إلا لمجموعات ≥ 5 */
export function channelEffect(logs: Pick<LogRow, 'kind' | 'ref_id' | 'channel' | 'status'>[], missions: { id: string; status: string; submitted_at?: string | null }[]): { lines: string[]; enough: boolean } {
  const byRef = new Map(missions.map(m => [m.id, m])); const g = new Map<Channel, { n: number; done: number }>();
  for (const l of logs) {
    if (l.kind !== 'mission_assigned' || !l.ref_id) continue; const m = byRef.get(l.ref_id); if (!m) continue;
    const ch: Channel = l.status === 'done' ? 'manual' : l.channel; const e = g.get(ch) || { n: 0, done: 0 }; e.n++; if (m.submitted_at || ['submitted', 'confirmed'].includes(m.status)) e.done++; g.set(ch, e);
  }
  const lines: string[] = [];
  for (const [ch, e] of g) if (e.n >= MIN_PEOPLE) lines.push(`${CHANNEL_AR[ch]}: ${Math.round(100 * e.done / e.n)}% سلّموا الدليل بعد الرسالة (${e.n} أشخاص)`);
  return { lines, enough: lines.length > 0 };
}
