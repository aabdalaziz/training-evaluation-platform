// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * م6-ج «جلسة التعويض — من خريطة المنهج» — واجهة الطاقم
 *  GET  ?invite=<id>                      → الوحدات الحمراء · الوحدة البرنامجية المقابلة · الافتراضيات (موعد/مدّة/منصّة/مدرّس) · جلسات التعويض القائمة مع «أثر التعويض»
 *  POST {action:'draft',   invite_id, unit_codes[], duration_min}            → خطّة محلية من الواصفات وأخطاء المجموعة (بلا ذكاء)
 *  POST {action:'improve', invite_id, unit_codes[], plan}                    → تحسين بالذكاء (miaar_remedial_plan · 20/يوم) — لا يُحفظ حتى يعتمده المدرّس
 *  POST {action:'create',  invite_id, unit_codes[], starts_at, duration_min, provider, join_url, trainer_id, title_ar, description_ar, force?} → صفّ portal_sessions بنوع remedial (409 عند التعارض ما لم يُفرض)
 *  POST {action:'cancel',  session_id}                                       → إلغاء جلسة تعويض (المديرون أو من أنشأها)
 *  الصلاحيات: الطاقم كلّه يرى ويُنشئ؛ الإلغاء للمديرين أو المُنشئ. يُسجَّل كل إنشاء/إلغاء في audit_logs.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../../lib/shield/body';
import { runAi, aiUsage, logAi } from '../../../../../lib/ai/athar';
import { loadApprovedPool } from '../../../../../lib/miaar/bank';
import { boardFor } from '../../../../../lib/miaar/exitflow';
import { isExitLevel } from '../../../../../lib/miaar/exit';
import { listUnits, approvedFor } from '../../../../../lib/miaar/syllabus';
import { conflicts, atharRoomUrl } from '../../../../../lib/portal/live';
import type { LiveSession } from '../../../../../lib/portal/live';
import { REMEDIAL_KIND, REMEDIAL_TITLE, REMEDIAL_DEFAULT_MIN, REMEDIAL_MAX_UNITS, nextWorkdayAt, remedialTitle, mistakesFor, draftPlan, validateCreate, effectFor, effectText, programUnitFor, listRemedials, joinedEmails, unitsOfItemMap, titlesOf, PLAN_SYSTEM, planPrompt, parsePlan } from '../../../../../lib/miaar/remedial';
import type { EffectIn } from '../../../../../lib/miaar/remedial';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const ADMINS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'];
const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ success: false, error, ...extra }, { status });
const NO = { 'Cache-Control': 'no-store' };
const isId = (v: unknown) => /^[0-9a-zA-Z_-]{1,64}$/.test(String(v || ''));
async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!STAFF.includes(role)) return { error: bad('غير مصرّح — للطاقم فقط', 403) };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), role, name: String((prof as any)?.full_name || '') } };
}
async function audit(db: any, user: { id: string; email: string; role: string }, action: string, entityId: string, label: string, metadata: Record<string, unknown>) {
  try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: user.role, action, entity_type: 'miaar_remedial', entity_id: entityId, entity_label: label, source: 'admin', metadata }); } catch { /* تحسيني */ }
}
async function ready(db: any): Promise<boolean> { try { const r = await db.from('portal_sessions').select('id, miaar_unit_codes, source_invite_id').limit(1); return !r.error; } catch { return false; } }

/** سياق الدعوة: اللوحة (الوحدات الحمراء) · القاعة · المدرّس · وحدات المستوى المعتمدة */
async function inviteCtx(db: any, inviteId: string) {
  const b = await boardFor(db, inviteId); if (!b) return null;
  const level = isExitLevel(b.invite.level_target) ? b.invite.level_target : null; if (!level) return { b, level: null as string | null, units: [] as any[], classroom: null as any, trainer: null as any };
  const all = await listUnits(db); const units = approvedFor(all, level);
  const classroom = b.classroom ? { ...(b.classroom as any) } : null;
  let extra: any = null; if (classroom?.id) { try { const { data } = await db.from('classrooms').select('id, code, name, section_name, trainer_id, provider, join_url, program_id').eq('id', classroom.id).maybeSingle(); extra = data || null; } catch { extra = null; } }
  const room = classroom ? { ...classroom, ...(extra || {}) } : null;
  let trainer: any = null; if (room?.trainer_id) { try { const { data } = await db.from('trainers').select('id, full_name, name, email').eq('id', room.trainer_id).maybeSingle(); trainer = data ? { id: data.id, name: String(data.full_name || data.name || data.email || '') } : null; } catch { trainer = null; } }
  return { b, level, units, classroom: room, trainer };
}
/** الوحدة البرنامجية المقابلة لكل وحدة حمراء (إن رُبطت من بطاقة الدبلوم) */
async function programUnits(db: any, programId: string | null): Promise<any[]> {
  if (!programId) return []; try { const { data, error } = await db.from('portal_program_units').select('idx, title_ar, starts_on, miaar_unit_codes').eq('program_id', programId).is('archived_at', null).order('idx', { ascending: true }).limit(60); return error ? [] : (data || []); } catch { return []; }
}
/** «قبل/بعد» لكل متعلّم: تقرير العبور الأصلي ← تقرير إعادة المهارة (دعوة retake_of) */
async function effectRows(db: any, inviteId: string, joined: Set<string>): Promise<EffectIn[]> {
  const { data: origs } = await db.from('placement_reports').select('id, candidate_email, report').eq('invite_id', inviteId).limit(500); const os: any[] = Array.isArray(origs) ? origs : [];
  if (!os.length) return [];
  const { data: rinv } = await db.from('placement_invites').select('id, retake_of').in('retake_of', os.map((o) => o.id)).limit(500); const ri: any[] = Array.isArray(rinv) ? rinv : [];
  if (!ri.length) return os.map((o) => ({ email: String(o.candidate_email || '').toLowerCase(), before: o.report?.الوحدات, after: null, attended: joined.has(String(o.candidate_email || '').toLowerCase()) }));
  const { data: rreps } = await db.from('placement_reports').select('invite_id, report, created_at').in('invite_id', ri.map((r) => r.id)).limit(500); const rr: any[] = Array.isArray(rreps) ? rreps : [];
  const byInvite = new Map<string, any>(); for (const r of rr.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) byInvite.set(r.invite_id, r); /* آخر إعادة */
  const afterOf = new Map<string, any>(); for (const r of ri) { const rep = byInvite.get(r.id); if (rep) afterOf.set(r.retake_of, rep.report?.الوحدات || null); }
  return os.map((o) => { const email = String(o.candidate_email || '').toLowerCase(); return { email, before: o.report?.الوحدات, after: afterOf.get(o.id) || null, attended: joined.has(email) }; });
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c;
  const u = new URL(req.url); const inviteId = String(u.searchParams.get('invite') || ''); if (!isId(inviteId)) return bad('دعوة غير صالحة');
  const ok = await ready(db); const ic = await inviteCtx(db, inviteId); if (!ic) return bad('الدعوة غير موجودة', 404);
  const { b, level, units, classroom, trainer } = ic; if (!level) return bad('هذه ليست دعوة اختبار نهاية المستوى');
  const heat: any[] = Array.isArray((b as any).units) ? (b as any).units : [];
  const pus = await programUnits(db, classroom?.program_id || b.invite.program_id || null);
  const weak = heat.filter((h) => h.state === 'weak').slice(0, REMEDIAL_MAX_UNITS).map((h) => ({ code: h.code, title_ar: h.title_ar, percent: h.percent, n_students: h.n_students, program_unit: programUnitFor(h.code, pus) }));
  const heatBy = new Map(heat.map((h) => [h.code, h]));
  const unitsOut = units.map((x) => ({ code: x.code, title_ar: x.title_ar, title_en: x.title_en, percent: heatBy.get(x.code)?.percent ?? null, state: heatBy.get(x.code)?.state ?? null, program_unit: programUnitFor(x.code, pus) }));
  const sessions = ok ? await listRemedials(db, inviteId) : []; const joinedMap = await joinedEmails(db, sessions.map((s: any) => s.id));
  const allJoined = new Set<string>(); for (const s of joinedMap.values()) for (const e of s) allJoined.add(e);
  const rows = sessions.length ? await effectRows(db, inviteId, allJoined) : [];
  const ix = new Map(units.map((x) => [x.code, x.title_ar]));
  const out = sessions.map((s: any) => { const codes: string[] = s.miaar_unit_codes || []; const eff = effectFor(rows.map((r) => ({ ...r, attended: joinedMap.get(s.id)?.has(r.email) || false })), codes);
    return { ...s, joined: joinedMap.get(s.id)?.size || 0, effect: eff.map((e) => ({ ...e, title_ar: ix.get(e.code) || e.code, text: effectText(e, ix.get(e.code) || e.code) })) }; });
  const defaults = { starts_at: nextWorkdayAt(new Date()), duration_min: REMEDIAL_DEFAULT_MIN, provider: classroom?.provider || 'teams', join_url: classroom?.join_url || '', trainer_id: trainer?.id || classroom?.trainer_id || null, title_ar: remedialTitle(titlesOf(weak.map((w) => w.code), units)) };
  return NextResponse.json({ success: true, ready: ok, title: REMEDIAL_TITLE, invite: { id: b.invite.id, code: b.invite.code, label_ar: b.invite.label_ar, level, classroom_id: classroom?.id || null, program_id: classroom?.program_id || b.invite.program_id || null }, classroom: classroom ? { id: classroom.id, code: classroom.code, name: classroom.name || classroom.section_name || null } : null, trainer, weak, units: unitsOut, defaults, sessions: out, max_units: REMEDIAL_MAX_UNITS }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const body = await readJson(req, { maxBytes: 64 * 1024 }); if (!body.ok) return bad(body.error, body.status); const b: any = body.body; const action = String(b.action || '');
  if (action === 'cancel') {
    const sid = String(b.session_id || ''); if (!isId(sid)) return bad('جلسة غير صالحة');
    const { data: s } = await db.from('portal_sessions').select('id, created_by, status, source_invite_id, title_ar').eq('id', sid).eq('kind', REMEDIAL_KIND).maybeSingle(); if (!s) return bad('الجلسة غير موجودة', 404);
    if (!ADMINS.includes(user.role) && s.created_by !== user.id) return bad('الإلغاء لمن أنشأ الجلسة أو للمديرين', 403);
    if (s.status === 'cancelled') return NextResponse.json({ success: true, already: true }, { headers: NO });
    const { error } = await db.from('portal_sessions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', sid); if (error) return bad(error.message, 500);
    await audit(db, user, 'miaar_remedial_cancel', sid, s.title_ar, { invite_id: s.source_invite_id }); return NextResponse.json({ success: true }, { headers: NO });
  }
  const inviteId = String(b.invite_id || ''); if (!isId(inviteId)) return bad('دعوة غير صالحة');
  const ic = await inviteCtx(db, inviteId); if (!ic) return bad('الدعوة غير موجودة', 404); const { b: board, level, units, classroom, trainer } = ic; if (!level) return bad('هذه ليست دعوة اختبار نهاية المستوى');
  const allowed = new Set(units.map((x) => x.code)); const codes: string[] = [...new Set<string>((Array.isArray(b.unit_codes) ? b.unit_codes : []).map(String).filter((x: string) => allowed.has(x)))].slice(0, REMEDIAL_MAX_UNITS);
  if (action === 'draft' || action === 'improve') {
    if (!codes.length) return bad('اختر وحدة واحدة على الأقل');
    const chosen = titlesOf(codes, units);
    if (action === 'draft') {
      const [{ data: reps }, pool] = await Promise.all([db.from('placement_reports').select('report').eq('invite_id', inviteId).limit(500), loadApprovedPool(db).catch(() => [])]);
      const reports = ((Array.isArray(reps) ? reps : []) as any[]).map((r) => r.report || {});
      const mistakes = mistakesFor(reports, unitsOfItemMap(pool as any), codes);
      let descriptors: Map<string, string> | undefined; try { const dcodes = [...new Set(chosen.flatMap((u) => u.descriptor_codes))]; if (dcodes.length) { const { data } = await db.from('miaar_descriptors').select('code, text_ar').in('code', dcodes); descriptors = new Map(((data || []) as any[]).map((d) => [d.code, String(d.text_ar || '')])); } } catch { descriptors = undefined; }
      const plan = draftPlan({ units: chosen, mistakes, descriptors, duration_min: Number(b.duration_min) || REMEDIAL_DEFAULT_MIN, level, group_label: classroom?.code || null });
      return NextResponse.json({ success: true, plan, title_ar: remedialTitle(chosen), mistakes, source: 'local' }, { headers: NO });
    }
    const draft = String(b.plan || '').trim(); if (draft.length < 80) return bad('ابدأ بالمسوَّدة المحلية أولًا');
    const usage = await aiUsage(db, user.id, 'miaar_remedial_plan'); if (!usage.allowed) return bad(`بلغت حدّ التحسين الآلي اليومي (${usage.limit}) — المسوَّدة المحلية تبقى صالحة`, 429);
    const r = await runAi<string>({ system: PLAN_SYSTEM, user: planPrompt(draft, level), parse: parsePlan, local: () => draft, budgetMs: 25000 });
    await logAi(db, { user_id: user.id, email: user.email, role: user.role, purpose: 'miaar_remedial_plan', result: r, context: { invite_id: inviteId, units: codes } });
    return NextResponse.json({ success: true, plan: r.data, source: r.source === 'ai' ? 'ai' : 'local', note: r.source === 'ai' ? null : 'الذكاء غير متاح الآن — بقيت المسوَّدة المحلية' }, { headers: NO });
  }
  if (action === 'create') {
    if (!(await ready(db))) return bad('شغّل هجرة م6-ج أولًا (20270203_portal_miaar_m6c_remedial.sql)', 503);
    const v = validateCreate({ ...b, invite_id: inviteId }, allowed); if (!v.ok) return bad(v.error); const inp = v.value;
    const programId = classroom?.program_id || board.invite.program_id || null; const classroomId = classroom?.id || null; const trainerId = inp.trainer_id || trainer?.id || null;
    /* تعارض المدرّس/القاعة كما في «البثّ المباشر» */
    const from = new Date(new Date(inp.starts_at).getTime() - 12 * 3600000).toISOString(); const to = new Date(new Date(inp.starts_at).getTime() + 12 * 3600000).toISOString();
    let existing: LiveSession[] = []; try { const { data } = await db.from('portal_sessions').select('id, title_ar, starts_at, duration_min, trainer_id, classroom_id, status').gte('starts_at', from).lte('starts_at', to).neq('status', 'cancelled').limit(200); existing = (data || []) as LiveSession[]; } catch { existing = []; }
    const clash = conflicts(existing, { starts_at: inp.starts_at, duration_min: inp.duration_min, trainer_id: trainerId, classroom_id: classroomId });
    if (clash.length && !b.force) return bad('تعارض مع جلسة أخرى للمدرّس أو القاعة في الوقت نفسه', 409, { conflicts: clash.map((x) => ({ id: x.id, title_ar: x.title_ar, starts_at: x.starts_at, duration_min: x.duration_min })) });
    const chosen = titlesOf(inp.unit_codes, units);
    const row: any = { program_id: programId, classroom_id: classroomId, trainer_id: trainerId, kind: REMEDIAL_KIND, title_ar: inp.title_ar, title_en: remedialTitle(chosen, 'en'), description_ar: inp.description_ar || null,
      starts_at: inp.starts_at, duration_min: inp.duration_min, provider: inp.provider, join_url: inp.provider === 'athar' ? null : inp.join_url, access: 'program', skills: [], status: 'scheduled', created_by: user.id, miaar_unit_codes: inp.unit_codes, source_invite_id: inviteId };
    const { data: ins, error } = await db.from('portal_sessions').insert(row).select('id').single(); if (error || !ins) return bad(error?.message || 'تعذّر إنشاء الجلسة', 500);
    if (inp.provider === 'athar') { try { await db.from('portal_sessions').update({ join_url: atharRoomUrl(String(ins.id), inp.title_ar) }).eq('id', ins.id); } catch { /* اختياري */ } }
    await audit(db, user, 'miaar_remedial_create', String(ins.id), inp.title_ar, { invite_id: inviteId, units: inp.unit_codes, starts_at: inp.starts_at, duration_min: inp.duration_min, provider: inp.provider, forced: !!b.force && clash.length > 0, plan_chars: inp.description_ar.length });
    return NextResponse.json({ success: true, session_id: ins.id, conflicts: clash.length, live_url: '/admin/live' }, { headers: NO });
  }
  return bad('إجراء غير معروف');
}
