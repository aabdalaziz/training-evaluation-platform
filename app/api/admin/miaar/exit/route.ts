// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/miaar/exit — م6 «عُبور»: اختبار نهاية المستوى المعياري (CEFR) للطاقم
 *  GET ?classroom=<id>            → الدعوات المفتوحة للقاعة + مستوى القاعة + عدد المقيّدين + فحص السلال للمستوى
 *  GET ?invite=<id>[&live=1]      → لوحة المجموعة (الصفوف · العدّاد · النافذة · القاعة) — live يعيد الخفيف للاستطلاع كل 15 ث
 *  GET ?pool=<level>              → فحص «السلّة الضيّقة» (الفكرة ط)
 *  POST {action}
 *    create       {classroom_id, level, label_ar?, opens_at?, expires_at?, max_seats?, program_id?, force_new?} → الدعوة (تُعاد المفتوحة نفسها للقاعة والمستوى)
 *    close        {invite_id}
 *    promote      {report_ids[], note?, classroom_id?}  → قرار عبور (تسكين «ترقية») بتوقيع بشري — لا يُرقّى أحد تلقائيًا
 *    skill_retake {report_id}                           → دعوة شخصية لإعادة مهارة واحدة خلال 14 يومًا
 *  لا يقرّر الذكاء الاصطناعي هنا شيئًا.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../../lib/shield/body';
import { normalizeSite } from '../../../../../lib/portal/open';
import { loadApprovedPool } from '../../../../../lib/miaar/bank';
import { loadApprovedTasks } from '../../../../../lib/miaar/bank';
import { setInviteStatus, inviteUrl } from '../../../../../lib/miaar/invites';
import { EXIT_SPEC, EXIT_TITLE, SPEC_VERSION, isExitLevel, levelFromRoom, poolCheck, specTable, exitInviteLabel } from '../../../../../lib/miaar/exit';
import { findOrCreateExitInvite, boardFor, promoteReports, skillRetakeInvite } from '../../../../../lib/miaar/exitflow';
import { listUnits, approvedFor, coverage } from '../../../../../lib/miaar/syllabus'; /* م6-ب */
import { liveFor, WITNESS_MODE_AR, isWitnessMode, resolveMode, defaultWitnessMode } from '../../../../../lib/miaar/witness'; /* م8 · م8-ب */
import { noticeReach } from '../../../../../lib/portal/notices'; /* P39 */

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const NO = { 'Cache-Control': 'no-store' };
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-zA-Z-]{2,40}$/.test(v);
async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!STAFF.includes(role)) return { error: bad('غير مصرّح — للطاقم فقط', 403) };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), role } };
}

/** عدد البنود/المهام المعتمدة لكل خلية (مستوى:مهارة) */
async function availability(db: any): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try { const pool = await loadApprovedPool(db); for (const it of pool) { const k = `${it.level}:${it.skill}`; out[k] = (out[k] || 0) + 1; } } catch { /* فارغ */ }
  try { const tasks = await loadApprovedTasks(db); for (const t of tasks) { const k = `${t.level}:${t.skill}`; out[k] = (out[k] || 0) + 1; } } catch { /* فارغ */ }
  return out;
}
async function roomInfo(db: any, classroomId: string) {
  const { data: c } = await db.from('classrooms').select('id, code, name, level, level_id, program_id, section_name').eq('id', classroomId).maybeSingle(); if (!c) return null;
  let lvl: any = null; if (c.level_id) { const { data } = await db.from('program_levels').select('id, code, name_ar, name_en').eq('id', c.level_id).maybeSingle(); lvl = data || null; }
  const level = levelFromRoom(lvl?.code || c.level, `${lvl?.name_ar || ''} ${c.level || ''}`);
  let roster = 0; try { const { count } = await db.from('portal_enrollments').select('id', { count: 'exact', head: true }).eq('classroom_id', classroomId).in('status', ['approved', 'active', 'enrolled']); roster = count || 0; } catch { roster = 0; }
  if (!roster) { try { const { count } = await db.from('portal_enrollments').select('id', { count: 'exact', head: true }).eq('classroom_id', classroomId); roster = count || 0; } catch { roster = 0; } }
  let program: any = null; if (c.program_id) { const { data } = await db.from('programs').select('id, name_ar').eq('id', c.program_id).maybeSingle(); program = data || null; }
  return { classroom: { id: c.id, code: c.code, name: c.name, section_name: c.section_name, label: `${c.section_name || c.name || c.code}${lvl?.code ? ` — ${lvl.code}` : ''}`, program_id: c.program_id, program_name: program?.name_ar || '' }, level, level_row: lvl, roster };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c; const site = siteOf(req); const u = new URL(req.url);
  const classroom = u.searchParams.get('classroom'); const invite = u.searchParams.get('invite'); const pool = u.searchParams.get('pool');
  if (classroom) {
    if (!isId(classroom)) return bad('قاعة غير صالحة');
    const info = await roomInfo(db, classroom); if (!info) return bad('القاعة غير موجودة', 404);
    const { data: invs } = await db.from('placement_invites').select('*').eq('classroom_id', classroom).eq('purpose', 'level_exit').order('created_at', { ascending: false }).limit(20);
    const rows = (Array.isArray(invs) ? invs : []).map((r: any) => ({ ...r, url: inviteUrl(site, r.code) }));
    const avail = await availability(db); const level = info.level && isExitLevel(info.level) ? info.level : null;
    /* م6-ب: وحدات المستوى المعتمدة (لخيار «ما دُرّس فقط») وتغطيتها في البنك */
    let units: any[] = []; let unit_coverage: any = null;
    if (level) { try { const all = await listUnits(db); units = approvedFor(all, level).map((x) => ({ code: x.code, title_ar: x.title_ar, title_en: x.title_en })); unit_coverage = coverage(all, level, await loadApprovedPool(db)); } catch { units = []; } }
    return NextResponse.json({ success: true, site, ...info, invites: rows, pool: level ? poolCheck(level, avail) : null, spec: level ? specTable(level) : null, official: EXIT_TITLE, version: SPEC_VERSION, levels: Object.keys(EXIT_SPEC), units, unit_coverage }, { headers: NO });
  }
  if (invite) {
    if (!isId(invite)) return bad('دعوة غير صالحة');
    const b = await boardFor(db, invite); if (!b) return bad('الدعوة غير موجودة', 404);
    const level = isExitLevel(b.invite.level_target) ? b.invite.level_target : null;
    const url = inviteUrl(site, b.invite.code);
    /* م8 «شاهِد»: آخر لقطة ومستوى الإشارات لكل جلسة — فقط حين تستخدم الدعوة الكاميرا أو وُجدت أحداث */
    const witnessMode = resolveMode(null, b.invite as any, await defaultWitnessMode(db)); /* م8-ب: الدعوة إن حدّدت، وإلا الافتراضي العام */
    const witness = await liveFor(db, b.rows.map((r: any) => r.session_id).filter(Boolean)).catch(() => ({}));
    if (u.searchParams.get('live')) return NextResponse.json({ success: true, rows: b.rows, summary: b.summary, window: b.window, witness, at: new Date().toISOString() }, { headers: NO });
    /* م7: دعوة خدمة لجهة → سجلّ الخدمة معها (بلا رموز) */
    let order: any = null; if ((b.invite as any).service_mode === 'external') { const { data: o } = await db.from('miaar_service_orders').select('id, client_name, client_contact, level, seats, seats_used, status, note, proctor_name, proctor_signed_at, delivered_at, invoiced_at, created_at').eq('invite_id', b.invite.id).maybeSingle(); order = o || null; }
    const inv = { ...b.invite, proctor_pin_hash: undefined, client_token_hash: undefined, has_pin: !!(b.invite as any).proctor_pin_hash, has_client_link: !!(b.invite as any).client_token_hash };
    /* P39: «أُبلغ؟» — لكل متعلّم: عدد إشعاراته · هل دُفع له · هل له اشتراك «نبّهني» */
    const reach = await noticeReach(db, b.rows.map((r: any) => String(r.email || ''))).catch(() => ({}));
    return NextResponse.json({ success: true, site, url, ...b, invite: inv, order, witness, reach, witness_mode: witnessMode, witness_mode_ar: WITNESS_MODE_AR[(isWitnessMode(witnessMode) ? witnessMode : 'room') as keyof typeof WITNESS_MODE_AR], spec: level ? specTable(level) : null, official: EXIT_TITLE }, { headers: NO });
  }
  if (pool) { if (!isExitLevel(pool)) return bad('مستوى غير صالح'); const avail = await availability(db); let unit_coverage: any = null; try { unit_coverage = coverage(await listUnits(db), pool, await loadApprovedPool(db)); } catch { unit_coverage = null; } return NextResponse.json({ success: true, pool: poolCheck(pool, avail), spec: specTable(pool), unit_coverage }, { headers: NO }); }
  return bad('استعلام غير معروف');
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const site = siteOf(req);
  const j = await readJson(req, { maxBytes: 256 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>;
  const action = String(b.action || '');
  if (action === 'create') {
    if (!isId(b.classroom_id)) return bad('اختر قاعة');
    const info = await roomInfo(db, b.classroom_id); if (!info) return bad('القاعة غير موجودة', 404);
    const level = isExitLevel(b.level) ? b.level : info.level && isExitLevel(info.level) ? info.level : null; if (!level) return bad('حدّد المستوى (A1–C1) — مستوى القاعة غير معروف');
    const seats = Number(b.max_seats); const roster = info.roster || 0;
    const r = await findOrCreateExitInvite(db, {
      classroom_id: b.classroom_id, level, label_ar: typeof b.label_ar === 'string' && b.label_ar.trim().length >= 3 ? b.label_ar.trim() : exitInviteLabel(info.classroom.label, level),
      opens_at: typeof b.opens_at === 'string' ? b.opens_at : null, expires_at: typeof b.expires_at === 'string' ? b.expires_at : null,
      max_seats: Number.isInteger(seats) && seats > 0 ? seats : roster > 0 ? roster + Math.ceil(roster * 0.2) : null, program_id: info.classroom.program_id || null, lang: 'ar', force_new: b.force_new === true,
      location: typeof b.location === 'string' ? b.location.slice(0, 120) : null, /* م8-ب */
      proctor_mode: isWitnessMode(b.proctor_mode) ? b.proctor_mode : null, witness_interval: Number.isInteger(Number(b.witness_interval)) && Number(b.witness_interval) >= 20 ? Number(b.witness_interval) : null, /* م8 */
      unit_scope: Array.isArray(b.unit_scope) ? (b.unit_scope as string[]) : null, /* م6-ب «ما دُرّس فقط» */
    }, user.id, site);
    if (!r.ok) return bad(r.error === 'blueprint_missing' ? 'مخطّط SYS-EXIT غير موجود — نفّذ ترحيل م6 أولًا' : r.error);
    const avail = await availability(db);
    return NextResponse.json({ success: true, invite: r.invite, url: r.url, reused: r.reused, level, spec: specTable(level), pool: poolCheck(level, avail), roster, classroom: info.classroom }, { headers: NO });
  }
  if (action === 'close') { if (!isId(b.invite_id)) return bad('دعوة غير صالحة'); const ok = await setInviteStatus(db, b.invite_id, 'closed'); return ok ? NextResponse.json({ success: true }, { headers: NO }) : bad('تعذّر الإغلاق'); }
  if (action === 'promote') {
    const ids = (Array.isArray(b.report_ids) ? b.report_ids : [b.report_ids]).filter(isId) as string[]; if (!ids.length) return bad('لا نتائج محدّدة');
    const r = await promoteReports(db, ids, user.id, typeof b.note === 'string' ? b.note.slice(0, 300) : null, isId(b.classroom_id) ? b.classroom_id : null);
    try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: user.role, action: 'miaar_exit_promote', entity_type: 'miaar_exit', entity_id: ids[0], entity_label: 'قرار عبور نهاية المستوى', source: 'admin', metadata: { n: ids.length, ...r } }); } catch { /* تحسيني */ }
    return NextResponse.json({ success: true, ...r }, { headers: NO });
  }
  if (action === 'skill_retake') {
    if (!isId(b.report_id)) return bad('نتيجة غير صالحة');
    const r = await skillRetakeInvite(db, b.report_id, user.id, site);
    if (!r.ok) { const m: Record<string, string> = { not_exit_report: 'ليست نتيجة نهاية مستوى', not_conditional: 'الإعادة الذكية تخصّ «الاجتياز المشروط» فقط', retake_exhausted: 'استُنفدت إعادة المهارة لهذه النتيجة', retake_invite_exists: 'للمتعلّم دعوة إعادة مفتوحة بالفعل', blueprint_create_failed: 'تعذّر إنشاء مخطّط الإعادة' }; return bad(m[r.error] || r.error); }
    return NextResponse.json({ success: true, url: r.url, skill: r.skill, expires_at: r.expires_at, invite: { id: r.invite.id, code: r.invite.code } }, { headers: NO });
  }
  return bad('إجراء غير معروف');
}
