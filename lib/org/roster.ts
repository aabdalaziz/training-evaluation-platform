// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P67 — قائمة الأرقام التدريبية والدخول بالرمز (خادم فقط: يحتاج مفتاح الخدمة لإنشاء حسابات Auth)
 *  createCodes : أرقام → حسابات مصطنعة (بريد <رقم>@<slug>.id.athar-portal.sa + رقم سري 6) + عضوية مؤكَّدة + صفّ portal_org_codes
 *                الأرقام السرية تُعاد مرّة واحدة في الاستجابة (لبطاقات الدخول) ولا تُخزَّن في أي جدول — ★3 «جدول الربط لا يُخزَّن»
 *  resetPin    : رقم سري جديد (مدير الجهة) · changePin: المتعلّم يغيّر رقمه بنفسه · revokeCode: إيقاف الرمز
 *  enterWithCode: الدخول (slug + رقم + رقم سري) → جلسة Supabase · قفل بعد 5 محاولات · حدث درع عند القفل
 */
import { createClient } from '@supabase/supabase-js';
import { syntheticEmail, genPin, TRAINING_NO_RE, PIN_RE, SLUG_RE, lockAfter, LOCK, normalizePolicy } from './policy';
import { epithetById } from './epithets';
import type { OrgPolicy } from './policy';
import { securityEvent } from '../shield/guard';

type Db = any;
const nowIso = () => new Date().toISOString();
const safe = async <T,>(q: () => PromiseLike<{ data: T | null; error?: any }>, fb: T): Promise<T> => { try { const r = await q(); return (r && !r.error && r.data != null ? r.data : fb) as T; } catch { return fb; } };

export type OrgLite = { id: string; name_ar: string; name_en?: string | null; slug: string | null; policy: OrgPolicy; frozen?: boolean };
export async function orgById(db: Db, id: string): Promise<OrgLite | null> {
  const o = await safe<any>(() => db.from('portal_organizations').select('id,name_ar,name_en,slug,policy,frozen_at').eq('id', id).maybeSingle(), null);
  return o ? { id: o.id, name_ar: o.name_ar, name_en: o.name_en || null, slug: o.slug || null, policy: normalizePolicy(o.policy), frozen: !!o.frozen_at } : null;
}
export async function orgBySlug(db: Db, slug: string): Promise<OrgLite | null> {
  const s = String(slug || '').trim().toLowerCase(); if (!SLUG_RE.test(s)) return null;
  const o = await safe<any>(() => db.from('portal_organizations').select('id,name_ar,name_en,slug,policy,frozen_at,active').ilike('slug', s).limit(1).maybeSingle(), null);
  return o && o.active !== false ? { id: o.id, name_ar: o.name_ar, name_en: o.name_en || null, slug: o.slug, policy: normalizePolicy(o.policy), frozen: !!o.frozen_at } : null;
}
/** تعيين/تغيير مُعرِّف الجهة (slug) — فريد؛ تغييره لا يكسر الحسابات القائمة (البريد المصطنع يحمل القديم، لكن الدخول يبحث بالرقم + الجهة) */
export async function setSlug(db: Db, orgId: string, slug: string): Promise<{ ok: boolean; error?: string }> {
  const s = String(slug || '').trim().toLowerCase(); if (!SLUG_RE.test(s)) return { ok: false, error: 'المُعرِّف: حروف إنجليزية صغيرة وأرقام وشرطة، يبدأ بحرف، 2–24' };
  const { error } = await db.from('portal_organizations').update({ slug: s }).eq('id', orgId);
  if (error) return { ok: false, error: /uniq|duplicate|23505/i.test(String(error.message || error.code || '')) ? 'هذا المُعرِّف محجوز لجهة أخرى' : String(error.message || error).slice(0, 120) };
  return { ok: true };
}

export type CodeRow = { id: number; organization_id: string; training_no: string; user_id: string | null; created_at: string; pin_set_at: string; pin_changed: boolean; first_login_at: string | null; last_login_at: string | null; failed: number; locked_until: string | null; revoked_at: string | null };
export async function listCodes(db: Db, orgId: string, limit = 2000): Promise<CodeRow[]> {
  return safe<CodeRow[]>(() => db.from('portal_org_codes').select('id,organization_id,training_no,user_id,created_at,pin_set_at,pin_changed,first_login_at,last_login_at,failed,locked_until,revoked_at').eq('organization_id', orgId).order('training_no').limit(limit), []);
}
export function codesSummary(rows: CodeRow[]) {
  const active = rows.filter(r => !r.revoked_at); const now = Date.now();
  return { total: rows.length, active: active.length, entered: active.filter(r => r.first_login_at).length, changed_pin: active.filter(r => r.pin_changed).length, locked: active.filter(r => r.locked_until && new Date(r.locked_until).getTime() > now).length, revoked: rows.length - active.length };
}

/** إنشاء الحسابات — يُعيد الأرقام السرية مرّة واحدة. الموجود مسبقًا يُتجاوز (skipped) ولا يُعاد تعيين رقمه. */
export async function createCodes(db: Db, p: { org: OrgLite; numbers: string[]; by: { id: string; email?: string | null }; env?: Record<string, string | undefined>; rand?: (n: number) => Buffer }): Promise<{ created: { training_no: string; pin: string }[]; skipped: string[]; failed: { training_no: string; error: string }[] }> {
  const out = { created: [] as { training_no: string; pin: string }[], skipped: [] as string[], failed: [] as { training_no: string; error: string }[] };
  if (!p.org.slug) { for (const n of p.numbers) out.failed.push({ training_no: n, error: 'لا مُعرِّف للجهة' }); return out; }
  const existing = await listCodes(db, p.org.id); const have = new Set(existing.map(r => r.training_no.toLowerCase()));
  for (const raw of p.numbers.slice(0, 500)) {
    const no = String(raw).trim(); if (!TRAINING_NO_RE.test(no)) { out.failed.push({ training_no: no.slice(0, 40), error: 'رقم غير صالح' }); continue; }
    if (have.has(no.toLowerCase())) { out.skipped.push(no); continue; }
    const email = syntheticEmail(p.org.slug, no); const pin = genPin(p.rand);
    try {
      const { data, error } = await db.auth.admin.createUser({ email, password: pin, email_confirm: true, user_metadata: { full_name: no, training_no: no, org_slug: p.org.slug, pseudonymous: true, code_login: true } });
      if (error || !data?.user?.id) { out.failed.push({ training_no: no, error: String(error?.message || 'تعذّر إنشاء الحساب').slice(0, 100) }); continue; }
      const uid = data.user.id;
      await db.from('portal_org_members').insert({ organization_id: p.org.id, user_id: uid, email, full_name: no, role: 'learner', status: 'confirmed', source: 'admin', confirmed_by: p.by.id, confirmed_at: nowIso(), invited_by: p.by.id, note: 'P67 code' });
      const { error: e2 } = await db.from('portal_org_codes').insert({ organization_id: p.org.id, training_no: no, user_id: uid, created_by: p.by.id, pin_set_at: nowIso(), pin_changed: false, failed: 0 });
      if (e2) { out.failed.push({ training_no: no, error: String(e2.message || e2).slice(0, 100) }); continue; }
      have.add(no.toLowerCase()); out.created.push({ training_no: no, pin });
    } catch (e: any) { out.failed.push({ training_no: no, error: String(e?.message || e).slice(0, 100) }); }
  }
  if (out.created.length) await securityEvent(db, { severity: 'info', kind: 'org_codes', actor: p.by.email || p.by.id, user_id: p.by.id, meta: { org_id: p.org.id, created: out.created.length, skipped: out.skipped.length, failed: out.failed.length, note: 'pins returned once — not stored' } }, p.env || process.env);
  return out;
}
async function codeOf(db: Db, orgId: string, trainingNo: string): Promise<CodeRow | null> {
  return safe<CodeRow | null>(() => db.from('portal_org_codes').select('id,organization_id,training_no,user_id,created_at,pin_set_at,pin_changed,first_login_at,last_login_at,failed,locked_until,revoked_at').eq('organization_id', orgId).ilike('training_no', String(trainingNo).trim()).limit(1).maybeSingle(), null);
}
/** إعادة تعيين الرقم السري (مدير الجهة) — رقم جديد يُعاد مرّة واحدة */
export async function resetPin(db: Db, p: { org: OrgLite; training_no: string; by: { id: string; email?: string | null }; env?: Record<string, string | undefined>; rand?: (n: number) => Buffer }): Promise<{ ok: boolean; pin?: string; error?: string }> {
  const row = await codeOf(db, p.org.id, p.training_no); if (!row || !row.user_id) return { ok: false, error: 'الرقم غير موجود في هذه الجهة' };
  if (row.revoked_at) return { ok: false, error: 'هذا الرمز موقوف' };
  const pin = genPin(p.rand);
  const { error } = await db.auth.admin.updateUserById(row.user_id, { password: pin }); if (error) return { ok: false, error: String(error.message || error).slice(0, 120) };
  await db.from('portal_org_codes').update({ pin_set_at: nowIso(), pin_changed: false, failed: 0, locked_until: null }).eq('id', row.id);
  await securityEvent(db, { severity: 'info', kind: 'org_pin_reset', actor: p.by.email || p.by.id, user_id: p.by.id, meta: { org_id: p.org.id, code_id: row.id } }, p.env || process.env);
  return { ok: true, pin };
}
/** إيقاف/إعادة تشغيل رمز (المتعلّم غادر الجهة): حظر الحساب في Auth + علامة في الصفّ */
export async function revokeCode(db: Db, p: { org: OrgLite; training_no: string; by: { id: string; email?: string | null }; restore?: boolean; env?: Record<string, string | undefined> }): Promise<{ ok: boolean; error?: string }> {
  const row = await codeOf(db, p.org.id, p.training_no); if (!row || !row.user_id) return { ok: false, error: 'الرقم غير موجود في هذه الجهة' };
  const { error } = await db.auth.admin.updateUserById(row.user_id, { ban_duration: p.restore ? 'none' : '876000h' }); if (error) return { ok: false, error: String(error.message || error).slice(0, 120) };
  await db.from('portal_org_codes').update({ revoked_at: p.restore ? null : nowIso() }).eq('id', row.id);
  await securityEvent(db, { severity: 'info', kind: p.restore ? 'org_code_restored' : 'org_code_revoked', actor: p.by.email || p.by.id, user_id: p.by.id, meta: { org_id: p.org.id, code_id: row.id } }, p.env || process.env);
  return { ok: true };
}
/** المتعلّم يغيّر رقمه السري بنفسه (يحتاج الرقم الحالي) */
export async function changePin(db: Db, p: { user: { id: string; email: string }; current: string; next: string; url: string; anon: string; signIn?: SignIn }): Promise<{ ok: boolean; error?: string }> {
  if (!PIN_RE.test(p.next)) return { ok: false, error: 'الرقم السري الجديد: 6 أرقام' }; if (/^(\d)\1{5}$/.test(p.next) || p.next === '123456') return { ok: false, error: 'اختر رقمًا أصعب من هذا' };
  const { data: d1, error: e1 } = await (p.signIn || anonSignIn(p.url, p.anon))(p.user.email, p.current).catch((e: any) => ({ data: null, error: e })); if (e1 || !d1?.session) return { ok: false, error: 'الرقم السري الحالي غير صحيح' };
  const { error } = await db.auth.admin.updateUserById(p.user.id, { password: p.next }); if (error) return { ok: false, error: String(error.message || error).slice(0, 120) };
  await db.from('portal_org_codes').update({ pin_changed: true, pin_set_at: nowIso() }).eq('user_id', p.user.id);
  return { ok: true };
}
/** ★4 «الرمز يتكلّم»: كُنية من القائمة المغلقة تصبح اسم العرض (user_metadata.full_name) — الرقم يبقى في training_no */
export async function setEpithet(db: Db, user: { id: string }, epithetId: string, lang: 'ar' | 'en' = 'ar'): Promise<{ ok: boolean; name?: string; error?: string }> {
  const e = epithetById(epithetId); if (!e && epithetId !== 'none') return { ok: false, error: 'كُنية غير معروفة' };
  const u = await db.auth.admin.getUserById(user.id); const meta = (u?.data?.user?.user_metadata || {}) as Record<string, unknown>; const no = String(meta.training_no || meta.full_name || '');
  const name = e ? (lang === 'en' ? e.en : e.ar) : no;
  const { error } = await db.auth.admin.updateUserById(user.id, { user_metadata: { ...meta, full_name: name, epithet: e ? e.id : null } }); if (error) return { ok: false, error: String(error.message || error).slice(0, 120) };
  return { ok: true, name };
}

export type EnterResult = { ok: true; access_token: string; refresh_token: string; expires_in: number; first_login: boolean; pin_changed: boolean; org: { id: string; name_ar: string; name_en: string | null; slug: string; kiosk_minutes: number }; epithet: string | null }
  | { ok: false; status: number; error: string; locked_until?: string | null; remaining?: number };
/** الدخول بالرمز: الجهة (slug) + الرقم + الرقم السري → جلسة. القفل بعد 5 محاولات متتالية (15 دقيقة ثم يتضاعف حتى ساعتين). */
export type SignIn = (email: string, password: string) => Promise<{ data?: { session?: any; user?: any } | null; error?: any }>;
const anonSignIn = (url: string, anon: string): SignIn => (email, password) => createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } }).auth.signInWithPassword({ email, password }) as any;
export async function enterWithCode(db: Db, p: { slug: string; training_no: string; pin: string; url: string; anon: string; ip?: string; env?: Record<string, string | undefined>; now?: Date; signIn?: SignIn }): Promise<EnterResult> {
  const now = p.now || new Date(); const no = String(p.training_no || '').trim(); const pin = String(p.pin || '').trim();
  if (!TRAINING_NO_RE.test(no) || !PIN_RE.test(pin)) return { ok: false, status: 400, error: 'الرقم التدريبي أو الرقم السري بصيغة غير صحيحة' };
  const org = await orgBySlug(db, p.slug); if (!org) return { ok: false, status: 404, error: 'لا توجد جهة بهذا المُعرِّف' };
  if (!org.policy.code_login) return { ok: false, status: 403, error: 'هذه الجهة لا تستخدم الدخول بالرمز — ادخل من /login' };
  if (org.frozen) return { ok: false, status: 423, error: 'جهتك في وضع القراءة فقط مؤقتًا — عد لاحقًا' };
  const row = await codeOf(db, org.id, no);
  const generic = 'الرقم التدريبي أو الرقم السري غير صحيح';
  if (!row || !row.user_id || row.revoked_at) return { ok: false, status: 401, error: generic };
  if (row.locked_until && new Date(row.locked_until).getTime() > now.getTime()) return { ok: false, status: 423, error: 'أُغلق هذا الرمز مؤقتًا بعد محاولات كثيرة — حاول بعد قليل أو اطلب من مشرفك إعادة تعيين الرقم السري', locked_until: row.locked_until };
  const email = syntheticEmail(org.slug || p.slug, no);
  const { data, error } = await (p.signIn || anonSignIn(p.url, p.anon))(email, pin).catch((e: any) => ({ data: null, error: e }));
  if (error || !data?.session) {
    const failed = (row.failed || 0) + 1; const locked = lockAfter(failed, now);
    await db.from('portal_org_codes').update({ failed, locked_until: locked }).eq('id', row.id);
    if (locked) await securityEvent(db, { severity: 'warn', kind: 'org_code_locked', ip: p.ip || null, meta: { org_id: org.id, code_id: row.id, failed } }, p.env || process.env);
    return { ok: false, status: locked ? 423 : 401, error: locked ? 'أُغلق هذا الرمز مؤقتًا بعد محاولات كثيرة — حاول بعد قليل أو اطلب من مشرفك إعادة تعيين الرقم السري' : generic, locked_until: locked, remaining: locked ? 0 : Math.max(0, LOCK.attempts - failed) };
  }
  const first = !row.first_login_at;
  await db.from('portal_org_codes').update({ failed: 0, locked_until: null, last_login_at: now.toISOString(), ...(first ? { first_login_at: now.toISOString() } : {}) }).eq('id', row.id);
  const meta = (data.user?.user_metadata || {}) as Record<string, unknown>;
  return { ok: true, access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_in: Number(data.session.expires_in || 3600), first_login: first, pin_changed: !!row.pin_changed, org: { id: org.id, name_ar: org.name_ar, name_en: org.name_en || null, slug: org.slug || p.slug, kiosk_minutes: org.policy.kiosk_minutes }, epithet: typeof meta.epithet === 'string' ? meta.epithet : null };
}
