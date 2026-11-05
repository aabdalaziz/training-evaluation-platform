// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «دعوات مِعيار» (خادم فقط): دعوة جماعية (رابط/باركود واحد لدفعة أو جهة) أو شخصية (رابط لمرة واحدة لكل بريد).
 *  الرابط: /miaar/d/<رمز 8> للجماعية · /miaar/d/<رمز 8>?t=<رمز شخصي> للشخصية. الباركود = الرابط نفسه (مولّد أَثَر lib/certificates/qr).
 *  ما يراه المتقدّم: اسم الدعوة ولغتها ونمطها؛ ما يراه الطاقم: فتح/بدء/إنهاء ومستوى كل مشارك.
 */
import { createHash, randomBytes } from 'node:crypto';
import { shortCode, isShortCode, cleanText, isExamMode } from './registry';
import type { ExamMode } from './registry';

export type InviteRow = { id: string; code: string; kind: 'group' | 'personal'; label_ar: string; org_id: string | null; program_id: string | null; lang: string; exam_mode: ExamMode; blueprint_id?: string | null; purpose: string | null; expires_at: string | null; max_seats: number | null; status: 'open' | 'closed'; note: string | null; created_by: string | null; created_at: string;
  /* م6 «عُبور» */ classroom_id?: string | null; opens_at?: string | null; level_target?: string | null; reuse_key?: string | null; retake_of?: string | null };
export type RecipientRow = { id: string; invite_id: string; email: string; name: string | null; opened_at: string | null; started_at: string | null; report_id: string | null; created_at: string };
export type InvitePublic = { code: string; kind: 'group' | 'personal'; label_ar: string; lang: string; exam_mode: ExamMode; blueprint_id?: string | null; purpose: string | null; expires_at: string | null; recipient: { id: string; email: string; name: string | null; used: boolean } | null;
  /* م6: معلومات اختبار نهاية المستوى (إن كانت الدعوة له) */ exit?: { level: string; minutes: number; counts: Record<string, number>; opens_at: string | null; official_ar: string; official_en: string; retake_skill?: string | null } | null };

const hash = (t: string) => createHash('sha256').update(t).digest('hex');
export const inviteUrl = (site: string, code: string, token?: string | null) => `${site.replace(/\/$/, '')}/miaar/d/${code}${token ? `?t=${encodeURIComponent(token)}` : ''}`;
const LANGS = new Set(['ar', 'az', 'bn', 'bs', 'de', 'en', 'es', 'fa', 'fil', 'fr', 'ha', 'hi', 'id', 'it', 'ku', 'ms', 'nl', 'pl', 'ps', 'pt', 'ro', 'ru', 'so', 'sq', 'sw', 'tr', 'uk', 'ur', 'uz', 'zh']);

export type CreateInput = { kind?: unknown; label_ar?: unknown; org_id?: unknown; program_id?: unknown; lang?: unknown; exam_mode?: unknown; purpose?: unknown; expires_at?: unknown; max_seats?: unknown; note?: unknown; recipients?: unknown; blueprint_id?: unknown; classroom_id?: unknown; opens_at?: unknown; level_target?: unknown; reuse_key?: unknown; retake_of?: unknown };
export function validateCreate(b: CreateInput): { ok: true; row: Omit<InviteRow, 'id' | 'code' | 'created_at' | 'created_by' | 'status'>; recipients: Array<{ email: string; name: string | null }> } | { ok: false; error: string } {
  const kind = b.kind === 'personal' ? 'personal' : 'group'; const label_ar = cleanText(b.label_ar, 120);
  if (label_ar.length < 3) return { ok: false, error: 'اسم الدعوة من ثلاثة أحرف على الأقل (مثل: جامعة أَثَر — دفعة يناير 2027)' };
  const id = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
  const lang = typeof b.lang === 'string' && LANGS.has(b.lang) ? b.lang : 'en'; const exam_mode: ExamMode = isExamMode(b.exam_mode) ? b.exam_mode : 'adaptive';
  const expires_at = typeof b.expires_at === 'string' && !Number.isNaN(Date.parse(b.expires_at)) ? new Date(b.expires_at).toISOString() : null;
  const seats = Number(b.max_seats); const max_seats = Number.isInteger(seats) && seats > 0 && seats <= 5000 ? seats : null;
  const recipients: Array<{ email: string; name: string | null }> = []; const seen = new Set<string>();
  if (kind === 'personal') {
    const raw = typeof b.recipients === 'string' ? b.recipients.split(/\r?\n|;/) : Array.isArray(b.recipients) ? b.recipients.map(String) : [];
    for (const line of raw) {
      const t = line.trim(); if (!t) continue; const m = t.match(/([^\s,<>]+@[^\s,<>]+\.[^\s,<>]{2,})/); if (!m) continue;
      const email = m[1].toLowerCase(); if (seen.has(email)) continue; seen.add(email);
      const name = cleanText(t.replace(m[1], '').replace(/[<>,;]/g, ' '), 120) || null; recipients.push({ email, name });
    }
    if (!recipients.length) return { ok: false, error: 'الدعوة الشخصية تحتاج قائمة بُرُد (سطر لكل شخص: الاسم ثم البريد)' };
    if (recipients.length > 500) return { ok: false, error: 'حتى 500 بريد في الدعوة الواحدة' };
  }
  /* م6: أعمدة الدعوة المرتبطة بالقاعة — تُرسل فقط إن وُجدت (حتى لا تكسر مخطّطًا أقدم) */
  const opens_at = typeof b.opens_at === 'string' && !Number.isNaN(Date.parse(b.opens_at)) ? new Date(b.opens_at).toISOString() : null;
  if (opens_at && expires_at && Date.parse(opens_at) >= Date.parse(expires_at)) return { ok: false, error: 'نافذة الاختبار: موعد الفتح يجب أن يسبق موعد الإغلاق' };
  const level_target = typeof b.level_target === 'string' && /^(A1|A2|B1|B2|C1|C2)$/.test(b.level_target) ? b.level_target : null;
  const extra: Record<string, unknown> = {};
  if (typeof b.classroom_id === 'string' && /^[0-9a-z_-]{1,64}$/i.test(b.classroom_id)) extra.classroom_id = b.classroom_id; /* معرّف القاعة كما هو (uuid في الإنتاج) */ if (opens_at) extra.opens_at = opens_at; if (level_target) extra.level_target = level_target;
  if (typeof b.reuse_key === 'string' && b.reuse_key.length <= 120) extra.reuse_key = b.reuse_key; if (id(b.retake_of)) extra.retake_of = id(b.retake_of);
  return { ok: true, row: { kind, label_ar, org_id: id(b.org_id), program_id: id(b.program_id), lang, exam_mode, blueprint_id: id(b.blueprint_id), purpose: cleanText(b.purpose, 60) || null, expires_at, max_seats, note: cleanText(b.note, 500) || null, ...extra }, recipients };
}

export async function createInvite(db: any, b: CreateInput, userId: string, site: string): Promise<{ ok: true; invite: InviteRow; url: string; links: Array<{ email: string; name: string | null; url: string }> } | { ok: false; error: string }> {
  const v = validateCreate(b); if (!v.ok) return v;
  let created: InviteRow | null = null;
  for (let i = 0; i < 4 && !created; i += 1) {
    const code = shortCode(8); const r = await db.from('placement_invites').insert({ ...v.row, code, created_by: userId }).select('*').single();
    if (r.error) { if (String(r.error.code) === '23505') continue; return { ok: false, error: r.error.message }; }
    created = r.data as InviteRow;
  }
  if (!created) return { ok: false, error: 'تعذّر توليد رمز فريد — أعد المحاولة' };
  const links: Array<{ email: string; name: string | null; url: string }> = [];
  if (v.recipients.length) {
    const rows = v.recipients.map((rcp) => { const token = randomBytes(12).toString('base64url'); links.push({ email: rcp.email, name: rcp.name, url: inviteUrl(site, created!.code, token) }); return { invite_id: created!.id, email: rcp.email, name: rcp.name, token_hash: hash(token) }; });
    const ins = await db.from('placement_invite_recipients').insert(rows); if (ins.error) return { ok: false, error: `أُنشئت الدعوة لكن تعذّر حفظ المستلمين: ${ins.error.message}` };
  }
  return { ok: true, invite: created, url: inviteUrl(site, created.code), links };
}

/** م6: إن كانت الدعوة لاختبار نهاية المستوى (أو إعادة مهارة) نعيد ما يُعرض للمتقدّم قبل البدء */
async function exitInfo(db: any, row: InviteRow): Promise<InvitePublic['exit']> {
  if (!row.blueprint_id || (row.purpose !== 'level_exit' && row.purpose !== 'skill_retake')) return null;
  const { data } = await db.from('question_bank_blueprints').select('code, level, duration_minutes, requirements').eq('id', row.blueprint_id).maybeSingle(); if (!data) return null;
  const { EXIT_TITLE, isExitLevel } = await import('./exit');
  const level = isExitLevel(data.level) ? data.level : isExitLevel(row.level_target) ? row.level_target : null; if (!level) return null;
  const req = (data.requirements || {}) as Record<string, any>; const c = (req.counts?.[level] || {}) as Record<string, number>; const p = (req.productive?.[level] || {}) as Record<string, number>;
  return { level, minutes: Number(data.duration_minutes) || 0, counts: { listening: Number(c.listening) || 0, reading: Number(c.reading) || 0, grammar_vocab: Number(c.grammar_vocab) || 0, writing: Number(p.writing) || 0, speaking: Number(p.speaking) || 0 }, opens_at: row.opens_at || null, official_ar: EXIT_TITLE.ar, official_en: EXIT_TITLE.en, retake_skill: typeof req.retake_skill === 'string' ? req.retake_skill : null };
}
/** ما يراه المتقدّم عند فتح الرابط (ويُسجَّل الفتح للشخصية) */
export async function openInvite(db: any, code: unknown, token: unknown): Promise<{ ok: true; invite: InvitePublic; row: InviteRow; recipient: RecipientRow | null } | { ok: false; error: 'not_found' | 'closed' | 'expired' | 'full' | 'used' | 'bad_token' | 'not_open' }> {
  if (!isShortCode(code)) return { ok: false, error: 'not_found' };
  const { data } = await db.from('placement_invites').select('*').eq('code', code).maybeSingle(); if (!data) return { ok: false, error: 'not_found' };
  const row = data as InviteRow;
  if (row.status !== 'open') return { ok: false, error: 'closed' };
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) return { ok: false, error: 'expired' };
  if (row.opens_at && Date.parse(row.opens_at) > Date.now()) return { ok: false, error: 'not_open' };   /* م6: نافذة البدء */
  let recipient: RecipientRow | null = null;
  if (row.kind === 'personal') {
    if (typeof token !== 'string' || token.length < 8) return { ok: false, error: 'bad_token' };
    const r = await db.from('placement_invite_recipients').select('*').eq('token_hash', hash(token)).eq('invite_id', row.id).maybeSingle(); if (!r.data) return { ok: false, error: 'bad_token' };
    recipient = r.data as RecipientRow;
    if (recipient.report_id) return { ok: false, error: 'used' };
    if (!recipient.opened_at) await db.from('placement_invite_recipients').update({ opened_at: new Date().toISOString() }).eq('id', recipient.id);
  } else if (row.max_seats) {
    const { count } = await db.from('placement_secure_sessions').select('id', { count: 'exact', head: true }).eq('invite_id', row.id);
    if ((count || 0) >= row.max_seats) return { ok: false, error: 'full' };
  }
  const exit = await exitInfo(db, row).catch(() => null);
  return { ok: true, row, recipient, invite: { code: row.code, kind: row.kind, label_ar: row.label_ar, lang: row.lang, exam_mode: row.exam_mode, blueprint_id: row.blueprint_id || null, purpose: row.purpose, expires_at: row.expires_at, recipient: recipient ? { id: recipient.id, email: recipient.email, name: recipient.name, used: !!recipient.report_id } : null, exit } };
}

/** قائمة الطاقم: لكل دعوة عدّادات (فُتحت · بدأت · أُنهيت) وتوزيع المستويات */
export async function listInvites(db: any, site: string) {
  const { data: invites } = await db.from('placement_invites').select('*').order('created_at', { ascending: false }).limit(200);
  const rows = (invites || []) as InviteRow[]; if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [{ data: sessions }, { data: reports }, { data: recipients }] = await Promise.all([
    db.from('placement_secure_sessions').select('invite_id, status').in('invite_id', ids),
    db.from('placement_reports').select('invite_id, report').in('invite_id', ids),
    db.from('placement_invite_recipients').select('invite_id, email, name, opened_at, started_at, report_id').in('invite_id', ids),
  ]);
  return rows.map((r) => {
    const s = ((sessions || []) as any[]).filter((x) => x.invite_id === r.id); const rp = ((reports || []) as any[]).filter((x) => x.invite_id === r.id);
    const levels: Record<string, number> = {}; for (const x of rp) { const lv = String(x.report?.ملخص_التسكين?.مستوى_الالتحاق_المقترح || x.report?.المستوى_العام || '—'); levels[lv] = (levels[lv] || 0) + 1; }
    const rc = ((recipients || []) as any[]).filter((x) => x.invite_id === r.id);
    return { ...r, url: inviteUrl(site, r.code), started: s.length, finished: rp.length, levels, recipients: r.kind === 'personal' ? rc.map((x) => ({ email: x.email, name: x.name, opened: !!x.opened_at, started: !!x.started_at, finished: !!x.report_id })) : undefined, opened: rc.filter((x) => x.opened_at).length };
  });
}
export async function setInviteStatus(db: any, id: unknown, status: unknown): Promise<boolean> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || (status !== 'open' && status !== 'closed')) return false;
  const r = await db.from('placement_invites').update({ status, updated_at: new Date().toISOString() }).eq('id', id); return !r.error;
}
/** نص جاهز للواتساب/البريد بلغة الدعوة (عربية/إنجليزية؛ بقية اللغات إنجليزية) */
export function shareText(invite: Pick<InviteRow, 'label_ar' | 'lang' | 'expires_at'>, url: string): string {
  const until = invite.expires_at ? new Date(invite.expires_at).toISOString().slice(0, 10) : null;
  if (invite.lang === 'ar') return `السلام عليكم، هذه دعوتك لاختبار تحديد المستوى في اللغة العربية «مِعيار — من أَثَر» (${invite.label_ar}).\nافتح الرابط وابدأ — لا يحتاج حسابًا، ومدّته نحو 30–50 دقيقة:\n${url}${until ? `\nآخر موعد: ${until}` : ''}`;
  return `Hello! This is your invitation to the Arabic placement test "Mi'yar — by Athar" (${invite.label_ar}).\nOpen the link and start — no account needed, about 30–50 minutes:\n${url}${until ? `\nDeadline: ${until}` : ''}`;
}
