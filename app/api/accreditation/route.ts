// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/accreditation — P48-أ «ملف الاعتماد الحيّ» (الرسمي: ملف الدراسة الذاتية للاعتماد البرامجي)
 *  GET  ?meta=1                      أسماء · أطر · حالات التغطية
 *  GET  ?program=<pid>               (مدرّب في البرنامج أو الطاقم) الملف: التغطية · الأدلة · ما ينقص · الفقرات · خريطة الكفايات · شروط التأهّل
 *  GET  ?scope=1                     برامج المستخدم التي له فيها ملف (من نطاق التقارير)
 *  GET  ?admin=1                     (الطاقم) كل الملفات موجزةً + أضعف معيار عبر البرامج + سجلّ المعايير
 *  POST narrative_draft {program_id, code, local?}      مسودّة فقرة معيار رئيس (ذكاء → محلي) — لا تُحفظ
 *  POST narrative_sign  {program_id, framework?, code, text_ar, source?}   حفظ موقَّع (≥ 40 حرفًا)
 *  POST skill_map       {program_id, map}               خريطة كفايات البرنامج → معايير المعلّم العامة
 *  POST standard_update {framework, code, title_ar?, text_ar?, source?}  (الطاقم) تحديث نصّ معيار بلا نشر كود
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { P48_NAMES_AR, FRAMEWORKS, COVERAGE_AR, EVIDENCE_KIND_AR, NARRATIVE_MIN, NARRATIVE_MAX, missingTasks } from '../../../lib/accreditation/registry';
import { fileFor, draftNarrative, signNarrative, saveSkillMap, updateStandard, adminFiles, freezeFile, verifySnapshot, publicStrip, orgRollup } from '../../../lib/accreditation/load';
import { P48B_NAMES_AR, NOTE_MAX } from '../../../lib/accreditation/registry';
import { myScope, type Me } from '../../../lib/reports/load';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 30;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST']; const ADMINS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status: error === 'غير مصرّح' ? 403 : status });
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false } }) : null; };
const lower = (s: unknown) => String(s || '').trim().toLowerCase(); const ID = /^[0-9a-z-]{1,40}$/i;
const META = { p48_ar: P48_NAMES_AR, p48b_ar: P48B_NAMES_AR, frameworks: FRAMEWORKS, coverage_ar: COVERAGE_AR, evidence_kind_ar: EVIDENCE_KIND_AR, narrative_min: NARRATIVE_MIN, narrative_max: NARRATIVE_MAX, note_max: NOTE_MAX };
const CODE = /^[A-Z0-9]{6,12}$/;
async function isOrgAdmin(db: any, me: Me, orgId: string): Promise<boolean> { const m = await db.from('portal_org_members').select('role,status').eq('organization_id', orgId).or(`user_id.eq.${me.id},email.eq.${me.email}`).limit(5); return ((m?.data || []) as any[]).some(r => String(r.role || '').toLowerCase() === 'org_admin' && String(r.status || 'confirmed').toLowerCase() === 'confirmed'); }
async function who(req: Request, db: any): Promise<Me | null> {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !U || !A) return null; const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('full_name,role').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: lower(data.user.email), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || '').trim(), staff: STAFF.includes(String((prof as any)?.role || '').toUpperCase()), admin: ADMINS.includes(String((prof as any)?.role || '').toUpperCase()) };
}
export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const sp = new URL(req.url).searchParams;
  if (sp.get('meta')) return NextResponse.json({ success: true, ...META });
  if (sp.get('verify')) { const code = String(sp.get('verify') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); const v = CODE.test(code) ? await verifySnapshot(db, code) : null; return NextResponse.json({ success: true, snapshot: v, ...META }, { headers: { 'Cache-Control': 'no-store' } }); }   // P48-ب: عام
  if (sp.get('strip')) { const pid = String(sp.get('strip') || ''); if (!ID.test(pid)) return bad('معرّف غير صالح'); const st = await publicStrip(db, pid); return NextResponse.json({ success: true, strip: st, p48b_ar: P48B_NAMES_AR }, { headers: { 'Cache-Control': 'no-store' } }); }   // P48-ب: عام (بعد التجميد فقط)
  const me = await who(req, db); if (!me) return bad('يلزم تسجيل الدخول', 401);
  if (sp.get('org')) { const oid = String(sp.get('org') || ''); if (!ID.test(oid)) return bad('معرّف غير صالح'); if (!me.staff && !(await isOrgAdmin(db, me, oid))) return bad('غير مصرّح', 403); return NextResponse.json({ success: true, org: await orgRollup(db, oid), ...META }, { headers: { 'Cache-Control': 'no-store' } }); }   // P48-ب: /org
  if (sp.get('admin')) { const r = await adminFiles(db, me); if (!r.ok) return bad(r.error, 403); return NextResponse.json({ success: true, ...r, ...META }); }
  if (sp.get('scope')) { const sc = await myScope(db, me); return NextResponse.json({ success: true, programs: sc.programs, staff: me.staff, ...META }); }
  const pid = String(sp.get('program') || ''); if (!ID.test(pid)) return bad('معرّف غير صالح');
  const f = await fileFor(db, me, pid); if (!f.ok) return bad(f.error, 403); const { _cov, _facts, ...pub } = f as any;
  return NextResponse.json({ success: true, ...pub, tasks: missingTasks(f.coverage), ...META }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const me = await who(req, db); if (!me) return bad('يلزم تسجيل الدخول', 401);
  let body: any = {}; try { body = await req.json(); } catch { return bad('جسم الطلب غير صالح'); } const action = String(body.action || ''); const pid = String(body.program_id || '');
  if (action === 'standard_update') { const r = await updateStandard(db, me, body); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true }); }
  if (!ID.test(pid)) return bad('معرّف غير صالح');
  if (action === 'narrative_draft') { const r = await draftNarrative(db, me, { program_id: pid, code: body.code, local: !!body.local }); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, text_ar: r.text_ar, source: r.source }); }
  if (action === 'narrative_sign') { const r = await signNarrative(db, me, { program_id: pid, framework: body.framework, code: body.code, text_ar: body.text_ar, source: body.source }); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, narrative: r.narrative }); }
  if (action === 'freeze') { const r = await freezeFile(db, me, { program_id: pid, note_ar: body.note_ar }); if (!r.ok) return NextResponse.json({ success: false, error: r.error, missing: r.missing || [] }, { status: r.error === 'غير مصرّح' ? 403 : 400 }); return NextResponse.json({ success: true, snapshot: r.snapshot, diff: r.diff }); }
  if (action === 'skill_map') { const r = await saveSkillMap(db, me, { program_id: pid, map: body.map }); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, map: r.map }); }
  return bad('إجراء غير معروف');
}
