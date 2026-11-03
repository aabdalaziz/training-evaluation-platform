// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P42-أ «بابٌ واحد لكل دور» — الأدوار بالدعوة.
 *  المبدأ: الأدمن يرسل دعوة للمنسوب (بريد + صفة أو صفات + جهة اختيارية)، والمنسوب يدخل من الباب الواحد /login ويقبلها، فتصبح منحة.
 *  طبقة الأدوار الجديدة (portal_roles / portal_role_grants) تعلو ENUM القديم في profiles.role ولا تهدمه:
 *   · قراءة الأدوار: المنح النشطة + ترجمة القديم تلقائيًا (LEGACY_TO_ROLE).
 *   · الجسر: قبول دور «طاقم» يرفع profiles.role إلى أدنى دور قديم يفتح صفحاته (ترقية فقط) حتى تعمل /admin القديمة فورًا.
 *  المنطق هنا خالص (يُختبر وحده)؛ قاعدة البيانات في الدوال التي تأخذ db.
 */
import { createHash, randomBytes } from 'crypto';

export type Scope = 'platform' | 'org' | 'personal';
export type Role = { code: string; name_ar: string; name_en: string; scope: Scope; landing: string; permissions: string[]; is_staff: boolean; legacy_role: string | null; is_system: boolean; active: boolean; sort: number };
export type Grant = { id: string; user_id: string | null; email: string; role_code: string; org_id: string | null; source: string; expires_at: string | null; revoked_at: string | null; created_at: string; note?: string | null };
export type Invite = { id: string; email: string | null; full_name: string | null; role_codes: string[]; org_id: string | null; message: string | null; expires_at: string; accepted_at: string | null; revoked_at: string | null; created_at: string; kind?: 'personal' | 'group'; max_uses?: number; uses?: number; label?: string | null };
export const GROUP_MAX_SEATS = 500;

/** الأدوار النظامية — نسخة الكود من سجلّ SQL (للعرض قبل تحميل القاعدة ولمنطق الاختبارات) */
export const SYSTEM_ROLES: Role[] = [
  { code: 'ADMIN', name_ar: 'مدير النظام', name_en: 'System administrator', scope: 'platform', landing: '/dashboard', permissions: ['*'], is_staff: true, legacy_role: 'ADMIN', is_system: true, active: true, sort: 10 },
  { code: 'LEADERSHIP', name_ar: 'القيادة', name_en: 'Leadership', scope: 'platform', landing: '/hub/leadership', permissions: ['reports.read', 'observatory.read', 'impact.read', 'finance.read'], is_staff: true, legacy_role: 'QUALITY_ANALYST', is_system: true, active: true, sort: 20 },
  { code: 'EXEC_PROGRAMS', name_ar: 'المشرف التنفيذي للبرامج', name_en: 'Executive supervisor — programs', scope: 'platform', landing: '/hub/programs', permissions: ['programs.write', 'sessions.write', 'enrollments.write', 'placements.write', 'reports.read'], is_staff: true, legacy_role: 'PROGRAM_MANAGER', is_system: true, active: true, sort: 30 },
  { code: 'EXEC_DIPLOMAS', name_ar: 'المشرف التنفيذي للدبلومات', name_en: 'Executive supervisor — diplomas', scope: 'platform', landing: '/hub/diplomas', permissions: ['programs.write', 'sessions.write', 'enrollments.write', 'credentials.write', 'reports.read'], is_staff: true, legacy_role: 'PROGRAM_MANAGER', is_system: true, active: true, sort: 31 },
  { code: 'EXEC_ARABIC', name_ar: 'المشرف التنفيذي لتعليم العربية', name_en: 'Executive supervisor — Arabic', scope: 'platform', landing: '/hub/programs', permissions: ['programs.write', 'sessions.write', 'miaar.write', 'reports.read'], is_staff: true, legacy_role: 'PROGRAM_MANAGER', is_system: true, active: true, sort: 32 },
  { code: 'QUALITY_MANAGER', name_ar: 'مدير الجودة', name_en: 'Quality manager', scope: 'platform', landing: '/hub/quality', permissions: ['reports.read', 'evidence.write', 'observatory.read', 'inclusion.write', 'loop.write'], is_staff: true, legacy_role: 'QUALITY_ANALYST', is_system: true, active: true, sort: 40 },
  { code: 'TEST_AUTHOR', name_ar: 'معدّ الاختبارات', name_en: 'Assessment author', scope: 'platform', landing: '/admin/miaar/bank', permissions: ['miaar.bank.write', 'miaar.forms.write'], is_staff: true, legacy_role: 'QUALITY_ANALYST', is_system: true, active: true, sort: 45 },
  { code: 'RATER', name_ar: 'المصحّح', name_en: 'Rater', scope: 'platform', landing: '/admin/miaar/rating', permissions: ['miaar.rate'], is_staff: true, legacy_role: null, is_system: true, active: true, sort: 56 }, /* م4-ج: غرفة التصحيح فقط — لا جسر إلى ENUM القديم */
  { code: 'ADMIN_SUPERVISOR', name_ar: 'المشرف الإداري', name_en: 'Administrative supervisor', scope: 'platform', landing: '/hub/operations', permissions: ['enrollments.write', 'placements.write', 'attendance.write', 'invites.write', 'inbox.write'], is_staff: true, legacy_role: 'PROGRAM_MANAGER', is_system: true, active: true, sort: 50 },
  { code: 'FINANCE_MANAGER', name_ar: 'المدير المالي', name_en: 'Finance manager', scope: 'platform', landing: '/hub/finance', permissions: ['payments.write', 'invoices.write', 'contracts.read', 'reports.read'], is_staff: true, legacy_role: 'PROGRAM_MANAGER', is_system: true, active: true, sort: 60 },
  { code: 'CONSULTANT', name_ar: 'المستشار', name_en: 'Consultant', scope: 'platform', landing: '/hub/expert', permissions: ['consulting.write', 'directory.self'], is_staff: false, legacy_role: null, is_system: true, active: true, sort: 70 },
  { code: 'EXPERT', name_ar: 'الخبير', name_en: 'Expert', scope: 'platform', landing: '/hub/expert', permissions: ['directory.self', 'councils.chair', 'onair.answer'], is_staff: false, legacy_role: null, is_system: true, active: true, sort: 71 },
  { code: 'TRAINER', name_ar: 'المدرّب', name_en: 'Trainer', scope: 'platform', landing: '/hub/trainer', permissions: ['sessions.host', 'rooms.host', 'attendance.write', 'directory.self'], is_staff: true, legacy_role: 'TRAINER', is_system: true, active: true, sort: 72 },
  { code: 'ORG_ADMIN', name_ar: 'مسؤول المؤسسة', name_en: 'Organization administrator', scope: 'org', landing: '/org', permissions: ['org.members', 'org.reports', 'org.invites'], is_staff: false, legacy_role: null, is_system: true, active: true, sort: 80 },
  { code: 'PARTICIPANT', name_ar: 'المشارك', name_en: 'Participant', scope: 'personal', landing: '/me', permissions: ['me'], is_staff: false, legacy_role: null, is_system: true, active: true, sort: 90 },
  { code: 'TRAINEE', name_ar: 'المتدرّب', name_en: 'Trainee', scope: 'personal', landing: '/me', permissions: ['me'], is_staff: false, legacy_role: null, is_system: true, active: true, sort: 91 },
  { code: 'STUDENT', name_ar: 'الطالب', name_en: 'Student', scope: 'personal', landing: '/me', permissions: ['me', 'miaar'], is_staff: false, legacy_role: null, is_system: true, active: true, sort: 92 },
];
export const ROLE_BY_CODE: Record<string, Role> = Object.fromEntries(SYSTEM_ROLES.map(r => [r.code, r]));
export const LEGACY_TO_ROLE: Record<string, string> = { PLATFORM_ADMIN: 'ADMIN', SUPER_ADMIN: 'ADMIN', ADMIN: 'ADMIN', PROGRAM_MANAGER: 'EXEC_PROGRAMS', QUALITY_ANALYST: 'QUALITY_MANAGER', TRAINER: 'TRAINER' };
/** ترتيب القوة في ENUM القديم — الجسر يرقّي ولا يخفّض */
export const LEGACY_RANK: Record<string, number> = { TRAINEE: 0, STUDENT: 0, LEARNER: 0, TRAINER: 1, QUALITY_ANALYST: 2, PROGRAM_MANAGER: 3, ADMIN: 4, SUPER_ADMIN: 5, PLATFORM_ADMIN: 6 };
export const INVITE_DAYS = 14;
export const MAX_ROLES_PER_INVITE = 5;

export const roleCodeOk = (c: string) => /^[A-Z][A-Z0-9_]{1,39}$/.test(c);
export const normEmail = (e: string) => String(e || '').trim().toLowerCase();
export const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length <= 160;

/** يُنتج رمز دعوة (يُرسل) وبصمته (تُحفظ) — الرمز لا يُخزَّن أبدًا */
export function newInviteToken(): { token: string; hash: string } { const token = randomBytes(24).toString('base64url'); return { token, hash: hashToken(token) }; }
export const hashToken = (token: string) => createHash('sha256').update(String(token || '')).digest('hex');
export const inviteUrl = (site: string, token: string) => `${site.replace(/\/+$/, '')}/join/${token}`;

/** حالة الدعوة للعرض */
export type InviteState = 'pending' | 'accepted' | 'expired' | 'revoked';
export function inviteState(i: Pick<Invite, 'accepted_at' | 'revoked_at' | 'expires_at'> & { kind?: string; max_uses?: number; uses?: number }, nowIso: string): InviteState {
  if (i.revoked_at) return 'revoked';
  if (i.kind === 'group') { if (i.expires_at <= nowIso) return 'expired'; return (i.uses || 0) >= (i.max_uses || 1) ? 'accepted' : 'pending'; }
  if (i.accepted_at) return 'accepted'; if (i.expires_at <= nowIso) return 'expired'; return 'pending';
}
/** المقاعد المتبقية في دعوة جماعية */
export const seatsLeft = (i: { max_uses?: number; uses?: number }) => Math.max(0, (i.max_uses || 1) - (i.uses || 0));
export const INVITE_STATE_AR: Record<InviteState, string> = { pending: 'بانتظار القبول', accepted: 'مقبولة', expired: 'منتهية', revoked: 'ملغاة' };
export const GROUP_STATE_AR: Record<InviteState, string> = { pending: 'مفتوحة', accepted: 'اكتملت المقاعد', expired: 'منتهية', revoked: 'ملغاة' };

/** المنح النشطة فقط */
export const activeGrants = (grants: Grant[], nowIso: string) => grants.filter(g => !g.revoked_at && (!g.expires_at || g.expires_at > nowIso));

/** أدوار المستخدم من المنح + القديم + عضوية مؤسسة */
export function rolesOf(p: { grants: Grant[]; legacyRole?: string | null; orgAdmin?: boolean; nowIso: string; catalog?: Role[] }): string[] {
  const cat = new Map((p.catalog || SYSTEM_ROLES).filter(r => r.active).map(r => [r.code, r] as const));
  const set = new Set<string>();
  for (const g of activeGrants(p.grants, p.nowIso)) if (cat.has(g.role_code)) set.add(g.role_code);
  /* الجسر القديم: مستوى المدير يُحتسب دائمًا؛ وغيره فقط لمن لا منحة طاقم له (المنح هي المرجع متى وُجدت — حتى لا ينعكس جسر ENUM صفةً وهمية) */
  /* P42-ب: منحة شخصية (مدرّب/خبير من هيئة أَثَر، مشارك من دعوة جماعية) لا تُنزِل موظفًا قائمًا — الجسر يسقط فقط أمام منحة طاقم */
  const staffGrant = [...set].some(c => cat.get(c)?.is_staff && c !== 'TRAINER');
  const L = LEGACY_TO_ROLE[String(p.legacyRole || '').toUpperCase()]; if (L && (L === 'ADMIN' || !staffGrant)) set.add(L);
  if (p.orgAdmin) set.add('ORG_ADMIN');
  if (!set.size) set.add('PARTICIPANT');   // كل داخل مشارك على الأقل
  return [...set].sort((a, b) => (cat.get(a)?.sort ?? 999) - (cat.get(b)?.sort ?? 999));
}
export const isStaffRoles = (codes: string[], catalog: Role[] = SYSTEM_ROLES) => codes.some(c => catalog.find(r => r.code === c)?.is_staff && c !== 'TRAINER');
export const isAdminRoles = (codes: string[]) => codes.includes('ADMIN');
export function hasPermission(codes: string[], perm: string, catalog: Role[] = SYSTEM_ROLES): boolean {
  for (const c of codes) { const r = catalog.find(x => x.code === c); if (!r) continue; if (r.permissions.includes('*') || r.permissions.includes(perm)) return true; const [ns] = perm.split('.'); if (r.permissions.includes(`${ns}.*`)) return true; }
  return false;
}
/** الوجهة بعد الدخول: مدير النظام → /dashboard؛ دور واحد → بابه؛ أدوار عدّة → /hub للاختيار؛ لا أدوار → /me */
export function landingFor(codes: string[], catalog: Role[] = SYSTEM_ROLES, preferred?: string | null): string {
  const cat = new Map(catalog.map(r => [r.code, r] as const));
  if (preferred && codes.includes(preferred) && cat.get(preferred)) return cat.get(preferred)!.landing;
  if (codes.includes('ADMIN')) return cat.get('ADMIN')?.landing || '/dashboard';   // مدير النظام: لوحته هي الباب الأم (كل الأبواب داخلها)
  const distinct = [...new Set(codes.map(c => cat.get(c)?.landing).filter(Boolean))] as string[];
  if (distinct.length === 1) return distinct[0]; if (distinct.length === 0) return '/me'; return '/hub';
}
/** أعلى دور قديم تتطلبه هذه الأدوار (للجسر) — null إن لم تتطلب شيئًا */
export function legacyNeededFor(codes: string[], catalog: Role[] = SYSTEM_ROLES): string | null {
  let best: string | null = null;
  for (const c of codes) { const l = catalog.find(r => r.code === c)?.legacy_role || null; if (l && (best == null || (LEGACY_RANK[l] ?? 0) > (LEGACY_RANK[best] ?? 0))) best = l; }
  return best;
}
export const shouldUpgradeLegacy = (current: string | null | undefined, needed: string | null) => !!needed && (LEGACY_RANK[needed] ?? 0) > (LEGACY_RANK[String(current || '').toUpperCase()] ?? 0);

/** تحقق مدخلات الدعوة */
export function validateInvite(body: any, catalog: Role[]): { ok: true; email: string; roles: string[]; full_name: string | null; message: string | null; org_id: string | null; kind: 'personal' | 'group'; max_uses: number; label: string | null } | { ok: false; error: string } {
  const kind: 'personal' | 'group' = body?.kind === 'group' ? 'group' : 'personal';
  const email = kind === 'group' ? '' : normEmail(body?.email); if (kind === 'personal' && !emailOk(email)) return { ok: false, error: 'بريد غير صالح' };
  const max_uses = kind === 'group' ? Math.floor(Number(body?.max_uses)) : 1; if (kind === 'group' && !(max_uses >= 2 && max_uses <= GROUP_MAX_SEATS)) return { ok: false, error: `عدد المقاعد بين 2 و${GROUP_MAX_SEATS}` };
  const label = kind === 'group' ? String(body?.label || '').trim().slice(0, 80) : null; if (kind === 'group' && (label || '').length < 2) return { ok: false, error: 'اكتب اسم المجموعة (مثل: ورشة مدرّبي الرياض — نوفمبر)' };
  const roles = [...new Set((Array.isArray(body?.roles) ? body.roles : [body?.role]).map((x: any) => String(x || '').toUpperCase()).filter(Boolean))] as string[];
  if (!roles.length) return { ok: false, error: 'اختر صفة واحدة على الأقل' }; if (roles.length > MAX_ROLES_PER_INVITE) return { ok: false, error: `حتى ${MAX_ROLES_PER_INVITE} صفات في الدعوة الواحدة` };
  const bad = roles.filter(r => !catalog.some(c => c.code === r && c.active)); if (bad.length) return { ok: false, error: `صفة غير معروفة: ${bad.join(', ')}` };
  const org_id = body?.org_id ? String(body.org_id) : null; if (org_id && !/^[0-9a-f-]{36}$/i.test(org_id)) return { ok: false, error: 'معرّف جهة غير صالح' };
  if (roles.includes('ORG_ADMIN') && !org_id) return { ok: false, error: 'صفة «مسؤول المؤسسة» تحتاج اختيار الجهة' };
  if (kind === 'group' && roles.includes('ADMIN')) return { ok: false, error: 'صفة مدير النظام لا تُمنح بدعوة جماعية' };
  return { ok: true, email, roles, full_name: body?.full_name ? String(body.full_name).trim().slice(0, 120) : null, message: body?.message ? String(body.message).trim().slice(0, 600) : null, org_id, kind, max_uses, label };
}
/** تحقق دور مخصّص جديد */
export function validateRole(body: any): { ok: true; role: Omit<Role, 'is_system' | 'active' | 'sort'> } | { ok: false; error: string } {
  const code = String(body?.code || '').toUpperCase().trim().replace(/[\s-]+/g, '_'); if (!roleCodeOk(code)) return { ok: false, error: 'الرمز: حروف لاتينية كبيرة وأرقام وشرطة سفلية (مثل EXEC_QUALITY)' };
  if (ROLE_BY_CODE[code]) return { ok: false, error: 'هذا رمز دور نظامي' };
  const name_ar = String(body?.name_ar || '').trim().slice(0, 80), name_en = String(body?.name_en || '').trim().slice(0, 80); if (name_ar.length < 2) return { ok: false, error: 'الاسم الرسمي بالعربية مطلوب' };
  const scope = (['platform', 'org', 'personal'] as Scope[]).includes(body?.scope) ? body.scope as Scope : 'platform';
  const landing = /^\/[a-z0-9/_-]*$/i.test(String(body?.landing || '')) ? String(body.landing) : '/hub';
  const permissions = [...new Set((Array.isArray(body?.permissions) ? body.permissions : String(body?.permissions || '').split(/[,\s]+/)).map((p: any) => String(p || '').trim().toLowerCase()).filter((p: string) => /^[a-z_]+(\.[a-z_*]+)?$/.test(p)))] as string[];
  const is_staff = !!body?.is_staff; const legacy_role = is_staff ? (['TRAINER', 'QUALITY_ANALYST', 'PROGRAM_MANAGER', 'ADMIN'].includes(String(body?.legacy_role || '')) ? String(body.legacy_role) : 'QUALITY_ANALYST') : null;
  return { ok: true, role: { code, name_ar, name_en: name_en || code, scope, landing, permissions, is_staff, legacy_role } };
}

/* ---------- قاعدة البيانات (بصلاحية الخدمة) ---------- */
const safe = async <T,>(p: PromiseLike<{ data: T | null; error?: unknown }>, fb: T): Promise<T> => { try { const { data, error } = await p; return error || data == null ? fb : data; } catch { return fb; } };
export const loadCatalog = async (db: any): Promise<Role[]> => { const rows = await safe<Role[]>(db.from('portal_roles').select('*').order('sort'), []); return rows.length ? rows : SYSTEM_ROLES; };

/** أدوار شخص: يربط منح البريد بحسابه عند أول دخول، ثم يقرأ الكل */
export async function myRoles(db: any, user: { id: string; email: string }, catalog?: Role[]): Promise<{ roles: string[]; grants: Grant[]; legacyRole: string | null; landing: string }> {
  const cat = catalog || await loadCatalog(db); const now = new Date().toISOString(); const email = normEmail(user.email);
  if (email) await safe(db.from('portal_role_grants').update({ user_id: user.id }).is('user_id', null).ilike('email', email).select('id'), []);
  const [grants, prof, member] = await Promise.all([
    safe<Grant[]>(db.from('portal_role_grants').select('*').or(`user_id.eq.${user.id},email.ilike.${email || 'x@x'}`).is('revoked_at', null).limit(100), []),
    safe<any>(db.from('profiles').select('role').eq('id', user.id).maybeSingle(), null),
    safe<any[]>(db.from('portal_org_members').select('role').eq('user_id', user.id).eq('role', 'org_admin').limit(1), []),
  ]);
  const roles = rolesOf({ grants, legacyRole: prof?.role || null, orgAdmin: member.length > 0, nowIso: now, catalog: cat });
  return { roles, grants: activeGrants(grants, now), legacyRole: prof?.role || null, landing: landingFor(roles, cat) };
}

/** قبول دعوة: تحقق البصمة والبريد والصلاحية → منح + جسر ENUM + ختم الدعوة */
export async function acceptInvite(db: any, token: string, user: { id: string; email: string; full_name?: string | null }, catalog?: Role[]): Promise<{ ok: true; roles: string[]; landing: string } | { ok: false; error: string; code: string }> {
  const cat = catalog || await loadCatalog(db); const now = new Date().toISOString();
  const inv = await safe<any>(db.from('portal_role_invites').select('*').eq('token_hash', hashToken(token)).maybeSingle(), null);
  if (!inv) return { ok: false, error: 'الدعوة غير موجودة', code: 'not_found' };
  const st = inviteState(inv, now); if (st !== 'pending') return { ok: false, error: st === 'accepted' ? 'هذه الدعوة قُبلت من قبل' : st === 'expired' ? 'انتهت صلاحية الدعوة — اطلب دعوة جديدة' : 'أُلغيت هذه الدعوة', code: st };
  const roles: string[] = (inv.role_codes || []).filter((c: string) => cat.some(r => r.code === c && r.active));
  if (inv.kind === 'group') {
    /* دعوة جماعية: أي داخل يأخذ مقعدًا مرة واحدة؛ المنحة ببريده هو؛ تُختم عند اكتمال المقاعد */
    const mineAlready = await safe<any[]>(db.from('portal_role_grants').select('id').eq('invite_id', inv.id).ilike('email', normEmail(user.email)).limit(1), []);
    if (!mineAlready.length) {
      const granted = await grantRoles(db, { email: user.email, user_id: user.id, full_name: user.full_name || null, roles, source: 'group', granted_by: inv.created_by || null, org_id: inv.org_id || null, invite_id: inv.id, note: inv.label ? `دعوة جماعية: ${inv.label}` : null }, cat);
      const uses = (inv.uses || 0) + 1; await db.from('portal_role_invites').update({ uses, accepted_at: uses >= (inv.max_uses || 1) ? now : null }).eq('id', inv.id);
      if (!granted.length) await bridgeLegacy(db, user, roles, cat);
    }
    const all = await myRoles(db, user, cat);
    return { ok: true, roles: all.roles, landing: landingFor(all.roles, cat) };
  }
  if (normEmail(inv.email || '') !== normEmail(user.email)) return { ok: false, error: `هذه الدعوة موجَّهة إلى ${inv.email} — ادخل بالبريد نفسه`, code: 'email_mismatch' };
  for (const role_code of roles) {
    const exists = await safe<any[]>(db.from('portal_role_grants').select('id').ilike('email', normEmail(inv.email || '')).eq('role_code', role_code).is('revoked_at', null).limit(1), []);
    if (!exists.length) await db.from('portal_role_grants').insert({ user_id: user.id, email: normEmail(inv.email || ''), role_code, org_id: inv.org_id || null, granted_by: inv.created_by || null, source: 'invite', invite_id: inv.id });
  }
  await db.from('portal_role_invites').update({ accepted_at: now, accepted_by: user.id }).eq('id', inv.id);
  await bridgeLegacy(db, user, roles, cat);
  if (inv.org_id && roles.includes('ORG_ADMIN')) { const m = await safe<any[]>(db.from('portal_org_members').select('id').eq('user_id', user.id).eq('organization_id', inv.org_id).limit(1), []); if (m.length) await db.from('portal_org_members').update({ role: 'org_admin' }).eq('id', m[0].id); else await safe(db.from('portal_org_members').insert({ user_id: user.id, organization_id: inv.org_id, email: normEmail(user.email), role: 'org_admin', status: 'confirmed', source: 'admin', full_name: user.full_name || null }).select('id'), []); }
  const all = await myRoles(db, user, cat);
  return { ok: true, roles: all.roles, landing: landingFor(all.roles, cat) };
}

/** منح صفات مباشرة (بلا دعوة): من مدير النظام («منح مباشر») أو من النظام (اعتماد هيئة أَثَر → المدرّب/الخبير، دعوة جماعية).
 *  لا يكرّر منحة فعّالة؛ يجسر ENUM القديم إن كان الحساب معروفًا؛ يعيد ما مُنح فعلًا. */
export async function grantRoles(db: any, p: { email: string; user_id?: string | null; full_name?: string | null; roles: string[]; source: 'manual' | 'system' | 'directory' | 'group'; granted_by?: string | null; org_id?: string | null; note?: string | null; invite_id?: string | null }, catalog?: Role[]): Promise<string[]> {
  const cat = catalog || await loadCatalog(db); const email = normEmail(p.email); if (!email) return [];
  const roles = [...new Set(p.roles)].filter(c => cat.some(r => r.code === c && r.active)); const granted: string[] = [];
  for (const role_code of roles) {
    const exists = await safe<any[]>(db.from('portal_role_grants').select('id,revoked_at,expires_at').ilike('email', email).eq('role_code', role_code).is('revoked_at', null).limit(1), []);
    if (exists.length) continue;
    const { error } = await db.from('portal_role_grants').insert({ user_id: p.user_id || null, email, role_code, org_id: p.org_id || null, granted_by: p.granted_by || null, source: p.source, note: p.note || null, invite_id: p.invite_id || null });
    if (!error) granted.push(role_code);
  }
  if (granted.length && p.user_id) await bridgeLegacy(db, { id: p.user_id, email, full_name: p.full_name || null }, granted, cat);
  return granted;
}
/** صفات هيئة أَثَر بحسب الوجوه: expert → EXPERT · trainer → TRAINER */
export const rolesForFaces = (faces: string[] | null | undefined): string[] => (faces || []).map(f => f === 'trainer' ? 'TRAINER' : f === 'expert' ? 'EXPERT' : '').filter(Boolean);

/** الجسر إلى ENUM القديم: ترقية فقط (ولا تمسّ من هو ADMIN أصلًا) + ضمان صف profiles */
export async function bridgeLegacy(db: any, user: { id: string; email: string; full_name?: string | null }, roles: string[], catalog: Role[]): Promise<string | null> {
  const needed = legacyNeededFor(roles, catalog); if (!needed) return null;
  const prof = await safe<any>(db.from('profiles').select('id,role,full_name').eq('id', user.id).maybeSingle(), null);
  if (!prof) { await safe(db.from('profiles').insert({ id: user.id, email: normEmail(user.email), full_name: user.full_name || normEmail(user.email).split('@')[0], role: needed }).select('id'), []); return needed; }
  if (shouldUpgradeLegacy(prof.role, needed)) { await db.from('profiles').update({ role: needed }).eq('id', user.id); return needed; }
  return null;
}
