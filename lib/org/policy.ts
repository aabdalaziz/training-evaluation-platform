// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P67 «سياسة الجهة — الاسم يدخل من الباب»
 *  الجهة (قيادة/إدارة) تقرّر بنفسها ما الذي يصل إلى أَثَر: هوية مستعارة · دخول بالرمز · لا وجوه عامة · لا خيوط في الرئيسية ·
 *  لا صوت · لا وسائط · تحقّق أدنى · وضع الكشك. كل مفتاح له نقطة اختناق واحدة في الخادم (انظر POLICY_KEYS[].enforce_ar).
 *  المنطق النقي هنا (يُختبر وحده) + دوال القاعدة التي تأخذ db. الختم ATH-OP يوقَّع بمفتاح الموقع نفسه (signReceipt).
 */
import { randomBytes } from 'crypto';
import { signReceipt, sha256 } from '../vault/subject';
import { canonical } from '../shield/seal';
import { securityEvent } from '../shield/guard';

export type PolicyKey = 'pseudonymous' | 'code_login' | 'public_faces_off' | 'home_threads_off' | 'voice_off' | 'media_off' | 'verify_minimal';
export type OrgPolicy = Record<PolicyKey, boolean> & { kiosk_minutes: number };
export const POLICY_FLAGS: PolicyKey[] = ['pseudonymous', 'code_login', 'public_faces_off', 'home_threads_off', 'voice_off', 'media_off', 'verify_minimal'];
export const DEFAULT_POLICY: OrgPolicy = { pseudonymous: false, code_login: false, public_faces_off: false, home_threads_off: false, voice_off: false, media_off: false, verify_minimal: false, kiosk_minutes: 0 };
export const KIOSK_CHOICES = [0, 5, 10, 20, 30];

/** الكتالوج: العنوان · ما يعنيه للجهة · أين يُنفَّذ في الخادم (نقطة اختناق واحدة لكل مفتاح) */
export const POLICY_KEYS: { key: PolicyKey; title_ar: string; title_en: string; desc_ar: string; enforce_ar: string; implies?: PolicyKey[] }[] = [
  { key: 'pseudonymous', title_ar: 'هوية مستعارة', title_en: 'Pseudonymous', desc_ar: 'منسوبو الجهة يُعرَفون في أَثَر برقمهم التدريبي فقط — لا اسم ولا بريد حقيقي. جدول «الرقم ↔ الشخص» يبقى عند الجهة.', enforce_ar: 'إنشاء الحسابات من قائمة الأرقام (بريد مصطنع) · شارة «هوية مستعارة» في قوائم الطاقم · التقارير بالأرقام', implies: ['code_login'] },
  { key: 'code_login', title_ar: 'الدخول بالرمز', title_en: 'Code login', desc_ar: 'الدخول من /enter بالرقم التدريبي ورقم سري من 6 أرقام (بلا بريد ولا رسائل). قفل مؤقت بعد 5 محاولات.', enforce_ar: '/api/enter (signInWithPassword على بريد مصطنع) · القفل في portal_org_codes + حدث درع' },
  { key: 'public_faces_off', title_ar: 'لا وجوه عامة', title_en: 'No public faces', desc_ar: 'لا يظهر أي منسوب للجهة في صفحة عامة (الملف العام/الدليل) ولا تظهر الجهة كعقدة في الرسم العام.', enforce_ar: 'portal_public_profile (SQL) · loadSources للرسم البياني' },
  { key: 'home_threads_off', title_ar: 'لا خيوط في الرئيسية', title_en: 'No homepage threads', desc_ar: 'أحداث تعلّم منسوبي الجهة لا تدخل «خيوط الأثر» العامة ولا أي تجميع عام — حتى لو كانت مجهَّلة.', enforce_ar: 'loadSources في evidence-cron يستثني أحداث المنسوبين قبل بناء الرسم' },
  { key: 'voice_off', title_ar: 'لا صوت', title_en: 'No voice', desc_ar: 'يختفي زرّ «نادِ» والأمانة الصوتية وأي رفع صوتي لمنسوبي الجهة — تبقى الكتابة.', enforce_ar: '/api/me/voice-reply · /api/media (kind=audio) · Nadi.tsx يخفي الزرّ' },
  { key: 'media_off', title_ar: 'لا وسائط', title_en: 'No media', desc_ar: 'لا تسجيلات أداء (فيديو/صوت/صورة) من منسوبي الجهة — الدليل كتابي ومن المشرف فقط.', enforce_ar: '/api/media POST → 403' },
  { key: 'verify_minimal', title_ar: 'تحقّق أدنى', title_en: 'Minimal verify', desc_ar: 'صفحات التحقّق العامة (شهادة التخرّج · خريطة الأثر) تُظهر صحّة الوثيقة فقط — بلا وجه ولا سطر شخصي.', enforce_ar: 'verifyGrad · verifyMap (store) تحجب face/live_public' },
];

const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';
/** تطبيع jsonb قادم من القاعدة أو من النموذج إلى سياسة كاملة (المفاتيح المجهولة تُهمَل؛ «هوية مستعارة» تستلزم «دخول بالرمز») */
export function normalizePolicy(raw: unknown): OrgPolicy {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const p: OrgPolicy = { ...DEFAULT_POLICY };
  for (const k of POLICY_FLAGS) p[k] = asBool(r[k]);
  if (p.pseudonymous) p.code_login = true;
  const km = Number(r.kiosk_minutes) || 0; p.kiosk_minutes = KIOSK_CHOICES.includes(km) ? km : (km > 0 ? Math.min(60, Math.max(1, Math.round(km))) : 0);
  return p;
}
/** ما يُخزَّن: المفاتيح المفعَّلة فقط (jsonb نظيف — {} يعني «لا سياسة») */
export function compactPolicy(p: OrgPolicy): Record<string, boolean | number> {
  const out: Record<string, boolean | number> = {};
  for (const k of POLICY_FLAGS) if (p[k]) out[k] = true;
  if (p.kiosk_minutes > 0) out.kiosk_minutes = p.kiosk_minutes;
  return out;
}
export const isEmptyPolicy = (p: OrgPolicy) => POLICY_FLAGS.every(k => !p[k]) && !p.kiosk_minutes;
/** المفاتيح التي تغيّرت بين سياستين (للختم والحدث) */
export function policyDiff(a: OrgPolicy, b: OrgPolicy): string[] {
  const d: string[] = []; for (const k of POLICY_FLAGS) if (!!a[k] !== !!b[k]) d.push(k); if ((a.kiosk_minutes || 0) !== (b.kiosk_minutes || 0)) d.push('kiosk_minutes'); return d;
}
/** دمج سياسات عدّة جهات ينتمي إليها المستخدم: أي «إغلاق» يغلب (الأكثر حماية) · أقصر كشك يغلب */
export function mergePolicies(list: OrgPolicy[]): OrgPolicy {
  const p: OrgPolicy = { ...DEFAULT_POLICY };
  for (const x of list) { for (const k of POLICY_FLAGS) if (x[k]) p[k] = true; if (x.kiosk_minutes > 0 && (!p.kiosk_minutes || x.kiosk_minutes < p.kiosk_minutes)) p.kiosk_minutes = x.kiosk_minutes; }
  return p;
}
/** بيان عربي موجز للسياسة (للختم وصفحة التحقّق) */
export function policyStatementAr(p: OrgPolicy, orgName: string): string {
  const on = POLICY_KEYS.filter(k => p[k.key]).map(k => k.title_ar); const parts = [...on]; if (p.kiosk_minutes) parts.push(`وضع الكشك ${p.kiosk_minutes} دقائق`);
  return parts.length ? `قرّرت «${orgName}» في أَثَر: ${parts.join(' · ')}. ما أُغلق هنا لا يفتحه أحد من داخل أَثَر — الفتح قرار الجهة وحدها ويُختم مثل الإغلاق.` : `«${orgName}» تعمل في أَثَر بالإعدادات الافتراضية (لا قيود إضافية).`;
}
/** الرسالة الإنسانية 403 — نفس أسلوب 423 التجميد: لا لوم للمتعلّم، والقرار منسوب لجهته */
export const POLICY_BLOCK_AR: Record<PolicyKey, string> = {
  pseudonymous: 'جهتك اختارت الهوية المستعارة — هذه الخاصية تعمل بالاسم فتبقى مغلقة هنا.',
  code_login: 'جهتك تدخل بالرمز من /enter.',
  public_faces_off: 'جهتك أغلقت الوجوه العامة — ملفك يبقى لك ولمشرفك ولا يُنشر.',
  home_threads_off: 'جهتك أغلقت الخيوط العامة — أثرك يبقى داخل جهتك.',
  voice_off: 'جهتك أغلقت الصوت — اكتب ما كنت ستقوله، فالكتابة تصل بالقوّة نفسها.',
  media_off: 'جهتك أغلقت الوسائط — الدليل هنا كتابي ومن مشرفك.',
  verify_minimal: 'جهتك اختارت التحقّق الأدنى — تظهر صحّة الوثيقة فقط.',
};

/* ───────────── القاعدة ───────────── */
type Db = any;
/** يلفّ الاستعلام كلّه (بناءً وتنفيذًا) — فلا يُسقط قاعدةُ وهمية ناقصة في الاختبارات أي مسار تحقّق */
const safe = async <T,>(q: () => PromiseLike<{ data: T | null; error?: any }>, fb: T): Promise<T> => { try { const r = await q(); return (r && !r.error && r.data != null ? r.data : fb) as T; } catch { return fb; } };

export async function orgPolicy(db: Db, orgId: string): Promise<OrgPolicy> {
  const row = await safe<any>(() => db.from('portal_organizations').select('policy').eq('id', orgId).maybeSingle(), null);
  return normalizePolicy(row?.policy);
}
export type UserPolicy = { policy: OrgPolicy; orgs: { id: string; name_ar: string; slug: string | null }[]; code_user: boolean };
/** سياسة المستخدم = دمج سياسات جهاته المؤكَّدة (+ هل هو حساب رمز؟). استعلامان فقط. */
export async function userPolicy(db: Db, user: { id: string; email?: string | null }): Promise<UserPolicy> {
  const em = String(user.email || '').toLowerCase();
  const ms = await safe<any[]>(() => db.from('portal_org_members').select('organization_id').eq('status', 'confirmed').or(`user_id.eq.${user.id}${em ? `,email.ilike.${em}` : ''}`).limit(50), []);
  const ids = Array.from(new Set(ms.map(m => m.organization_id).filter(Boolean)));
  if (!ids.length) return { policy: { ...DEFAULT_POLICY }, orgs: [], code_user: isSyntheticEmail(em) };
  const orgs = await safe<any[]>(() => db.from('portal_organizations').select('id,name_ar,slug,policy').in('id', ids), []);
  return { policy: mergePolicies(orgs.map(o => normalizePolicy(o.policy))), orgs: orgs.map(o => ({ id: o.id, name_ar: o.name_ar, slug: o.slug || null })), code_user: isSyntheticEmail(em) };
}
/** هل مفتاح معيّن مفعَّل على أي جهة لمستخدم؟ (نقطة اختناق للمخازن: verifyGrad/verifyMap/voice/media) */
export async function userFlag(db: Db, userId: string | null | undefined, key: PolicyKey, email?: string | null): Promise<boolean> {
  if (!userId && !email) return false;
  const p = await userPolicy(db, { id: userId || '00000000-0000-0000-0000-000000000000', email: email || null }); return !!p.policy[key];
}
/** معرّفات أعضاء الجهات التي فعّلت مفتاحًا (لاستثنائهم من الرسم العام) — مجموعة user_id + بريد (مُصغَّر) */
export async function membersWithFlag(db: Db, key: PolicyKey): Promise<{ users: Set<string>; emails: Set<string>; orgs: Set<string> }> {
  const out = { users: new Set<string>(), emails: new Set<string>(), orgs: new Set<string>() };
  const orgs = await safe<any[]>(() => db.from('portal_organizations').select('id,policy').neq('policy', '{}').limit(500), []);
  for (const o of orgs) if (normalizePolicy(o.policy)[key]) out.orgs.add(o.id);
  if (!out.orgs.size) return out;
  const ms = await safe<any[]>(() => db.from('portal_org_members').select('user_id,email').in('organization_id', Array.from(out.orgs)).eq('status', 'confirmed').limit(20000), []);
  for (const m of ms) { if (m.user_id) out.users.add(m.user_id); if (m.email) out.emails.add(String(m.email).toLowerCase()); }
  return out;
}

/* ───────────── الدخول بالرمز: البريد المصطنع ───────────── */
export const ID_DOMAIN = 'id.athar-portal.sa';
export const SLUG_RE = /^[a-z][a-z0-9-]{1,23}$/;
export const TRAINING_NO_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
export const PIN_RE = /^\d{6}$/;
/** بريد مصطنع لا يُراسَل أبدًا: <الرقم>@<slug>.id.athar-portal.sa (النطاق محجوز — لا MX) */
export const syntheticEmail = (slug: string, trainingNo: string) => `${trainingNo.trim().toLowerCase()}@${slug.trim().toLowerCase()}.${ID_DOMAIN}`;
export const isSyntheticEmail = (email: string | null | undefined) => new RegExp(`@[a-z0-9-]+\\.${ID_DOMAIN.replace(/\./g, '\\.')}$`, 'i').test(String(email || ''));
export function parseSyntheticEmail(email: string): { training_no: string; slug: string } | null {
  const m = String(email || '').toLowerCase().match(new RegExp(`^([a-z0-9][a-z0-9._-]{0,31})@([a-z][a-z0-9-]{1,23})\\.${ID_DOMAIN.replace(/\./g, '\\.')}$`)); return m ? { training_no: m[1], slug: m[2] } : null;
}
/** رقم سري من 6 أرقام (crypto) — لا يبدأ بـ 0 ولا يكون كلّه رقمًا واحدًا */
export function genPin(rand: (n: number) => Buffer = randomBytes): string {
  for (let i = 0; i < 20; i++) { const n = 100000 + (rand(4).readUInt32BE(0) % 900000); const s = String(n); if (!/^(\d)\1{5}$/.test(s) && s !== '123456' && s !== '654321') return s; }
  return '735194';
}
/** قائمة الأرقام من نصّ (سطر لكل رقم أو فواصل) — تنظيف · تفرّد · رفض غير الصالح */
export function parseRoster(text: string, max = 500): { ok: string[]; bad: string[] } {
  const seen = new Set<string>(); const ok: string[] = []; const bad: string[] = [];
  for (const raw of String(text || '').split(/[\s,;،]+/)) { const t = raw.trim(); if (!t) continue; if (!TRAINING_NO_RE.test(t)) { if (bad.length < 50) bad.push(t.slice(0, 40)); continue; } const k = t.toLowerCase(); if (seen.has(k)) continue; seen.add(k); if (ok.length < max) ok.push(t); }
  return { ok, bad };
}
/** قفل المحاولات: 5 فاشلة → 15 دقيقة (ثم تتضاعف حتى ساعتين) */
export const LOCK = { attempts: 5, baseMin: 15, maxMin: 120 };
export function lockAfter(failed: number, now = new Date()): string | null {
  if (failed < LOCK.attempts) return null; const rounds = Math.floor(failed / LOCK.attempts); const mins = Math.min(LOCK.maxMin, LOCK.baseMin * Math.pow(2, rounds - 1)); return new Date(now.getTime() + mins * 60000).toISOString();
}

/* ★4 «الرمز يتكلّم»: القائمة في ./epithets (نقية — تُستورد من المتصفح) */
export { EPITHETS, epithetById } from './epithets';

/* ───────────── الختم ATH-OP ───────────── */
export const OP_PREFIX = 'ATH-OP';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function opCode(rand: (n: number) => Buffer = randomBytes): string { const b = rand(8); let s = ''; for (let i = 0; i < 8; i++) s += ALPHABET[b[i] % ALPHABET.length]; return `${OP_PREFIX}-${s.slice(0, 4)}-${s.slice(4)}`; }
export const isOpCode = (c: string) => /^ATH-OP-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(String(c || '').trim().toUpperCase());
export function opDigest(body: any): string { const { proof: _p, hash: _h, ...base } = body || {}; void _p; void _h; return 'sha256:' + sha256(canonical(base)); }

export type SaveResult = { ok: boolean; error?: string; policy?: OrgPolicy; changed?: string[]; seal?: { code: string; issued_at: string; signed: boolean } | null };
/** حفظ السياسة + ختم ATH-OP + حدث درع. لا يكتب شيئًا إن لم يتغيّر شيء (ولا يُصدر ختمًا فارغًا). */
export async function savePolicy(db: Db, p: { org_id: string; policy: unknown; by: { id: string; email?: string | null }; env?: Record<string, string | undefined>; site?: string; rand?: (n: number) => Buffer }): Promise<SaveResult> {
  const org = await safe<any>(() => db.from('portal_organizations').select('id,name_ar,slug,policy').eq('id', p.org_id).maybeSingle(), null); if (!org) return { ok: false, error: 'الجهة غير موجودة' };
  const before = normalizePolicy(org.policy); const after = normalizePolicy(p.policy); const changed = policyDiff(before, after).sort(); /* ترتيب ثابت + نسخ مستقلة حتى لا تتغيّر الوثيقة بعد الختم */
  if (!changed.length) return { ok: true, policy: after, changed: [], seal: null };
  if ((after.code_login || after.pseudonymous) && !org.slug) return { ok: false, error: 'حدّد مُعرِّف الجهة (slug) أولًا — هو عنوان باب الدخول /enter?o=…' };
  const now = new Date().toISOString();
  const { error } = await db.from('portal_organizations').update({ policy: compactPolicy(after), policy_updated_at: now, policy_updated_by: p.by.id }).eq('id', p.org_id); if (error) return { ok: false, error: String(error.message || error).slice(0, 160) };
  const code = opCode(p.rand);
  const body = await signReceipt({ type: 'AtharOrgPolicySeal', kind: 'org_policy_seal', code, organization: org.name_ar, slug: org.slug || null, policy: compactPolicy(after), changed: [...changed], statement_ar: policyStatementAr(after, org.name_ar), issued_at: now }, p.env || process.env, p.site);
  const row = { organization_id: p.org_id, code, issued_at: now, issued_by: p.by.id, policy: compactPolicy(after), changed: [...changed], digest: opDigest(body), body };
  const ins = await db.from('portal_org_policy_seals').insert(row).select('id').maybeSingle(); const sealed = !ins?.error;
  await securityEvent(db, { severity: 'warn', kind: 'org_policy', actor: p.by.email || p.by.id, user_id: p.by.id, meta: { org_id: p.org_id, org: org.name_ar, changed, code: sealed ? code : null } }, p.env || process.env);
  return { ok: true, policy: after, changed: [...changed], seal: sealed ? { code, issued_at: now, signed: !!(body as any)?.proof } : null };
}
export async function listSeals(db: Db, orgId: string, limit = 12): Promise<{ code: string; issued_at: string; changed: string[]; policy: Record<string, unknown>; signed: boolean }[]> {
  const rows = await safe<any[]>(() => db.from('portal_org_policy_seals').select('code,issued_at,changed,policy,body').eq('organization_id', orgId).order('issued_at', { ascending: false }).limit(limit), []);
  return rows.map(r => ({ code: r.code, issued_at: r.issued_at, changed: r.changed || [], policy: r.policy || {}, signed: !!r.body?.proof }));
}
/** تحقّق عام بالرمز: موجود؟ سليم؟ (بلا أشخاص — اسم الجهة والمفاتيح والبيان فقط) */
export async function verifyOpSeal(db: Db, code: string): Promise<{ valid: boolean; intact?: boolean; seal?: { code: string; issued_at: string; organization: string; policy: Record<string, unknown>; changed: string[]; statement_ar: string; signed: boolean; latest: boolean } }> {
  const c = String(code || '').trim().toUpperCase(); if (!isOpCode(c)) return { valid: false };
  const r = await safe<any>(() => db.from('portal_org_policy_seals').select('organization_id,code,issued_at,policy,changed,digest,body').eq('code', c).maybeSingle(), null); if (!r) return { valid: false };
  const newer = await safe<any[]>(() => db.from('portal_org_policy_seals').select('id').eq('organization_id', r.organization_id).gt('issued_at', r.issued_at).limit(1), []);
  return { valid: true, intact: opDigest(r.body) === r.digest, seal: { code: r.code, issued_at: r.issued_at, organization: String(r.body?.organization || ''), policy: r.policy || {}, changed: r.changed || [], statement_ar: String(r.body?.statement_ar || ''), signed: !!r.body?.proof, latest: !newer.length } };
}

/* ───────────── ★1 «كما يراني الزائر»: ما الذي يظهر من الجهة الآن في الأماكن العامة ───────────── */
export type VisitorItem = { id: string; title_ar: string; visible: boolean; count: number; controlled_by: PolicyKey | null; where_ar: string };
export async function visitorView(db: Db, orgId: string): Promise<VisitorItem[]> {
  const p = await orgPolicy(db, orgId);
  const ms = await safe<any[]>(() => db.from('portal_org_members').select('user_id').eq('organization_id', orgId).eq('status', 'confirmed').limit(5000), []);
  const uids = ms.map(m => m.user_id).filter(Boolean);
  const pubProfiles = uids.length ? await safe<any[]>(() => db.from('portal_profiles').select('user_id').in('user_id', uids.slice(0, 1000)).in('share_mode', ['link', 'public']).limit(1000), []) : [];
  const gradFaces = uids.length ? await safe<any[]>(() => db.from('portal_grad_pages').select('id').in('user_id', uids.slice(0, 1000)).eq('live_public', true).limit(1000), []) : [];
  const letters = await safe<any[]>(() => db.from('portal_org_letters').select('id').eq('organization_id', orgId).limit(100), []);
  const node = await safe<any[]>(() => db.from('portal_graph_nodes').select('id').eq('id', `org:${orgId}`).limit(1), []);
  return [
    { id: 'profiles', title_ar: 'ملفات عامة لمنسوبين (رابط/عام)', count: pubProfiles.length, visible: pubProfiles.length > 0 && !p.public_faces_off, controlled_by: 'public_faces_off', where_ar: '/p/<معرّف> — الملف المهاري العام' },
    { id: 'faces', title_ar: 'وجوه في صفحات التحقّق (شهادة التخرّج)', count: gradFaces.length, visible: gradFaces.length > 0 && !p.verify_minimal, controlled_by: 'verify_minimal', where_ar: '/verify/grad?code=…' },
    { id: 'graph', title_ar: 'الجهة كعقدة في رسم الأثر', count: node.length, visible: node.length > 0 && !p.public_faces_off, controlled_by: 'public_faces_off', where_ar: 'كوكبة الأثر (طاقم) + تجميعات' },
    { id: 'threads', title_ar: 'أحداث منسوبين داخل خيوط الرئيسية (مجهَّلة، k≥5)', count: uids.length, visible: uids.length > 0 && !p.home_threads_off, controlled_by: 'home_threads_off', where_ar: 'الصفحة الرئيسية — «خيوط الأثر»' },
    { id: 'letters', title_ar: 'رسائل الشهر القابلة للتحقّق (بقرار الجهة ورمزها)', count: letters.length, visible: letters.length > 0, controlled_by: null, where_ar: '/verify/letter?code=… — لا تُنشر إلا بمشاركة الجهة للرمز' },
  ];
}
