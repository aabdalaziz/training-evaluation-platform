// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — محوّل واتساب الرسمي (WhatsApp Business Cloud API · Graph v26.0) + التحقق من توقيعات Webhooks (Meta و Resend/Svix)
 *  بلا اعتماديات: fetch + node:crypto فقط. خارج نافذة 24 ساعة لا يُرسل إلا قالب معتمد (template) — وهذا كل ما نرسله.
 */
import { createHmac, timingSafeEqual } from 'crypto';

export const GRAPH_VERSION = 'v26.0';
export type WaConfig = { token: string; phoneId: string; lang: string; appSecret: string; verifyToken: string; version: string };
export function waConfig(env: NodeJS.ProcessEnv = process.env): WaConfig | null {
  const token = String(env.WHATSAPP_TOKEN || '').trim(); const phoneId = String(env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  if (!token || !phoneId) return null;
  return { token, phoneId, lang: String(env.WHATSAPP_TEMPLATE_LANG || 'ar').trim() || 'ar', appSecret: String(env.WHATSAPP_APP_SECRET || '').trim(), verifyToken: String(env.WHATSAPP_VERIFY_TOKEN || '').trim(), version: String(env.WHATSAPP_GRAPH_VERSION || GRAPH_VERSION).trim() };
}

/** حمولة رسالة قالب (المتغيرات نصية بالترتيب {{1}}…{{n}}) */
export function templatePayload(to: string, template: string, params: string[], lang = 'ar') {
  const clean = params.map(p => String(p ?? '').replace(/[\n\t]+/g, ' ').replace(/ {5,}/g, '    ').trim().slice(0, 1000) || '—');
  return { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'template', template: { name: template, language: { code: lang }, ...(clean.length ? { components: [{ type: 'body', parameters: clean.map(text => ({ type: 'text', text })) }] } : {}) } };
}

export async function sendWhatsAppTemplate(cfg: WaConfig, to: string, template: string, params: string[], fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetchImpl(`https://graph.facebook.com/${cfg.version}/${cfg.phoneId}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(templatePayload(to, template, params, cfg.lang)) });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: String(j?.error?.message || `Graph HTTP ${res.status}`) + (j?.error?.code ? ` (${j.error.code})` : '') };
    return { ok: true, id: String(j?.messages?.[0]?.id || '') || undefined };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

// ====================================================================== Webhooks
/** Meta: X-Hub-Signature-256 = sha256=HEX(HMAC-SHA256(app_secret, raw_body)) */
export function verifyMetaSignature(rawBody: string, header: string | null | undefined, appSecret: string): boolean {
  if (!appSecret || !header) return false;
  const given = String(header).replace(/^sha256=/, '').trim(); const exp = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  return safeEq(given, exp);
}
/** Resend (Svix): svix-id · svix-timestamp · svix-signature "v1,BASE64 …"؛ السر whsec_BASE64؛ المحتوى `${id}.${ts}.${body}` */
export function verifyResendSignature(rawBody: string, h: { id?: string | null; timestamp?: string | null; signature?: string | null }, secret: string, now = Date.now(), toleranceSec = 300): boolean {
  if (!secret || !h.id || !h.timestamp || !h.signature) return false;
  const ts = Number(h.timestamp); if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > toleranceSec) return false;
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  const exp = createHmac('sha256', key).update(`${h.id}.${h.timestamp}.${rawBody}`, 'utf8').digest('base64');
  return String(h.signature).split(/\s+/).some(part => { const [v, sig] = part.split(','); return v === 'v1' && !!sig && safeEq(sig, exp); });
}
function safeEq(a: string, b: string): boolean { const A = Buffer.from(a), B = Buffer.from(b); return A.length === B.length && timingSafeEqual(A, B); }

export type ProviderStatus = { provider_id: string; status: 'sent' | 'delivered' | 'read' | 'failed'; error?: string | null; at: string };
/** حالات واتساب: entry[].changes[].value.statuses[] */
export function parseWhatsAppStatuses(body: any): ProviderStatus[] {
  const out: ProviderStatus[] = [];
  for (const en of (body?.entry || [])) for (const ch of (en?.changes || [])) for (const s of (ch?.value?.statuses || [])) {
    const st = String(s?.status || ''); if (!['sent', 'delivered', 'read', 'failed'].includes(st) || !s?.id) continue;
    const err = Array.isArray(s?.errors) && s.errors.length ? [s.errors[0]?.title, s.errors[0]?.message || s.errors[0]?.error_data?.details].filter(Boolean).join(' — ') : null;
    out.push({ provider_id: String(s.id), status: st as ProviderStatus['status'], error: err, at: s?.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString() });
  }
  return out;
}
/** أحداث Resend: email.sent | email.delivered | email.delivery_delayed | email.bounced | email.complained */
export function parseResendEvent(body: any): ProviderStatus | null {
  const id = String(body?.data?.email_id || ''); const t = String(body?.type || ''); if (!id || !t.startsWith('email.')) return null;
  const at = String(body?.created_at || new Date().toISOString());
  if (t === 'email.delivered') return { provider_id: id, status: 'delivered', at };
  if (t === 'email.bounced') return { provider_id: id, status: 'failed', error: String(body?.data?.bounce?.message || body?.data?.bounce?.subType || 'ارتدّ البريد (bounce)'), at };
  if (t === 'email.complained') return { provider_id: id, status: 'failed', error: 'أبلغ المستلم عن الرسالة كبريد مزعج', at };
  if (t === 'email.sent') return { provider_id: id, status: 'sent', at };
  return null;
}
/** تطبيق حالة مزوّد على السجل (لا تتراجع الحالة: read > delivered > sent) */
export async function applyStatuses(db: any, list: ProviderStatus[]): Promise<number> {
  let n = 0; const rank: Record<string, number> = { queued: 0, manual: 0, failed: 0, sent: 1, delivered: 2, read: 3, done: 3 };
  for (const s of list) {
    const { data } = await db.from('portal_message_log').select('id,status,errors').eq('provider_id', s.provider_id).limit(1); const row = ((data || []) as any[])[0]; if (!row) continue;
    if (s.status === 'failed') { await db.from('portal_message_log').update({ status: 'failed', errors: [...(row.errors || []), { channel: 'provider', error: s.error || 'failed', at: s.at }] }).eq('id', row.id); n++; continue; }
    if ((rank[s.status] ?? 0) <= (rank[row.status] ?? 0)) continue;
    await db.from('portal_message_log').update({ status: s.status, ...(s.status === 'delivered' ? { delivered_at: s.at } : {}), ...(s.status === 'read' ? { read_at: s.at, delivered_at: s.at } : {}) }).eq('id', row.id); n++;
  }
  return n;
}
