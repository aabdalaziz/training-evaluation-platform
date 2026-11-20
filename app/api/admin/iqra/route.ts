// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/iqra — «اقْرَأْ» (ق1) للطاقم: اعتماد الحلقات · استيراد حزم المحتوى · تسكين يدوي
 *  GET  ?level=A1              → نظرة عامّة (حلقات كل مستوى بحالاتها · المتعلّمون k≥5) + حلقات المستوى
 *  GET  ?lesson=<uuid>         → الحلقة كاملةً للمراجعة (المحتوى · البطاقات · المِران مع مفاتيحه)
 *  POST {action:'status', id, status:'draft'|'in_review'|'approved'|'archived', note?}  (مديرون) — اعتماد الحلقة يعتمد مِرانها
 *       {action:'import', pack}                 (الطاقم) حزمة iqra-pack-1 → مسوَّدات (الحلقة المعتمدة لا تُمَسّ)
 *       {action:'validate', pack}               (الطاقم) فحص الحزمة بلا كتابة
 *       {action:'enrol', email, level, note?}   (مديرون) تسكين يدوي — يُسجَّل في التدقيق
 *  الخطوة 2: GET ?library=<uuid> نصّ مكتبة · GET يعيد hours (ساعات المستويات k≥5) و library للمستوى · POST {action:'library_status', id, status} (مديرون)
 *            validate/import تقبل iqra-pack-2 (حلقات بمهارة و«أستطيع أن…» و30 تمرينًا من 9 أنواع + مكتبة) وتعيد تحذيرات القالب والإنصاف.
 *  ق٢ (2026-11-17): GET ?threshold=1 → مكتب العَتَبة (الطلبات الحيّة · المنتهية · دعوات المستوى المفتوحة · إحصاء k≥5) · GET ?produce=queue|done → طابور «أُنتج» (الطاقم + RATER)
 *       POST {action:'threshold_accept', id, invite_id?, opens_at?, note?} (مديرون) → دعوة «عُبور» شخصية أو ضمّ إلى دعوة مفتوحة · {action:'threshold_defer', id, note} (مديرون)
 *       POST {action:'produce_review', id, rubric:{content,organisation,vocabulary,accuracy 1..4}, comment, rewritten?} (الطاقم + RATER)
 *  C2 ج٤ (2026-11-20): GET ?licence=1 → «إجازة أَثَر»: من رُوجع مشروعه الختاميّ ولم يُجَز · الصادرة · POST {action:'licence_issue', email} (مديرون) → إصدارها مرّة واحدة
 *  كل كتابة تُسجَّل في audit_logs. لا ذكاء اصطناعي هنا.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../lib/shield/body';
import { normEmail } from '../../../../lib/portal/roles';
import { IQRA_NAMES_AR, LEVEL_META, isIqraLevel } from '../../../../lib/iqra/registry';
import { normalizePack } from '../../../../lib/iqra/content';
import { adminOverview, adminLessons, adminLesson, setLessonStatus, importPack, manualEnrol, adminLibrary, setLibraryStatus, adminHours } from '../../../../lib/iqra/store';
import { adminThresholds, acceptThreshold, deferThreshold, adminProduce, reviewProduce, licenceQueue, issueLicence } from '../../../../lib/iqra/q2';
import { HOURS_TARGET, SKILL_META } from '../../../../lib/iqra/registry';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const RATERS = [...STAFF, 'RATER']; /* ق٢: مصحّحو مِعيار يقرؤون طابور «أُنتج» فقط */
const ADMINS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'];
const NO = { 'Cache-Control': 'no-store' };
const LIC_ERR_AR: Record<string, string> = { bad_input: 'أدخل بريد المتعلّم', not_enrolled: 'المتعلّم غير مسكَّن في اقْرَأْ', not_c2: 'الإجازة لمن في المتقن C2 فقط', already_issued: 'صدرت إجازته من قبل', no_lesson: 'حلقة الإجازة (C2-U08-L05) لم تُستورد بعد', project_not_reviewed: 'لم يُراجَع مشروعه الختاميّ بعد', db: 'تعذّر الحفظ' }; /* C2 ج٤ */
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO });
async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!RATERS.includes(role)) return { error: bad('غير مصرّح — للطاقم فقط', 403) };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), role }, raterOnly: !STAFF.includes(role) };
}
async function audit(db: any, user: { id: string; email: string; role: string }, action: string, entityId: string, label: string, metadata: Record<string, unknown>) {
  try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: user.role, action, entity_type: 'iqra', entity_id: entityId, entity_label: label, source: 'admin', metadata }); } catch { /* التدقيق لا يوقف العمل */ }
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  const u = new URL(req.url); const lessonId = u.searchParams.get('lesson');
  /* ق٢ */
  const produce = u.searchParams.get('produce'); if (produce) return NextResponse.json({ success: true, ...(await adminProduce(c.db, produce === 'done' ? 'done' : 'queue')) }, { headers: NO });
  if (c.raterOnly) return bad('غير مصرّح — للطاقم فقط', 403);
  if (u.searchParams.get('threshold')) return NextResponse.json({ success: true, ...(await adminThresholds(c.db)) }, { headers: NO });
  if (u.searchParams.get('licence')) return NextResponse.json({ success: true, ...(await licenceQueue(c.db)) }, { headers: NO }); /* C2 ج٤: «إجازة أَثَر» */
  if (lessonId) { const l = await adminLesson(c.db, lessonId); return l ? NextResponse.json({ success: true, lesson: l }, { headers: NO }) : bad('الحلقة غير موجودة', 404); }
  const libId = u.searchParams.get('library'); if (libId) { const x = await adminLibrary(c.db, libId); return x ? NextResponse.json({ success: true, text: x }, { headers: NO }) : bad('النصّ غير موجود', 404); }
  const level = isIqraLevel(u.searchParams.get('level')) ? (u.searchParams.get('level') as any) : 'A1';
  const [overview, lv, hours] = await Promise.all([adminOverview(c.db), adminLessons(c.db, level), adminHours(c.db).catch(() => ({}))]);
  return NextResponse.json({ success: true, title: IQRA_NAMES_AR, levels: LEVEL_META, skills: SKILL_META, hours_target: HOURS_TARGET, overview, hours, level, units: lv.units, lessons: lv.lessons, library: lv.library }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  const j = await readJson(req, { maxBytes: 2 * 1024 * 1024 }); if (!j.ok) return bad('JSON غير صالح'); const b = j.body as Record<string, unknown>;
  const action = String(b.action || '');
  /* ق٢ */
  if (action === 'produce_review') {
    const r = await reviewProduce(c.db, b.id, c.user, { rubric: b.rubric, comment: b.comment, rewritten: b.rewritten }); if (!r.ok) return bad(r.error);
    await audit(c.db, c.user, 'iqra.produce.review', String(b.id), 'مراجعة نصّ «أُنتج»', { score: r.score }); return NextResponse.json({ success: true, score: r.score }, { headers: NO });
  }
  if (c.raterOnly) return bad('غير مصرّح — للطاقم فقط', 403);
  if (action === 'threshold_accept' || action === 'threshold_defer') {
    if (!ADMINS.includes(c.user.role)) return bad('قرار العَتَبة للمديرين', 403);
    const site = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
    const r = action === 'threshold_accept' ? await acceptThreshold(c.db, b.id, c.user, site, { invite_id: b.invite_id, opens_at: b.opens_at, note: b.note }) : await deferThreshold(c.db, b.id, b.note, c.user);
    if (!r.ok) return bad(r.error);
    await audit(c.db, c.user, `iqra.${action}`, String(b.id), 'طلب العَتَبة', { invite_id: (r as any).invite_id || b.invite_id || null }); return NextResponse.json({ success: true, ...r }, { headers: NO });
  }
  if (action === 'licence_issue') { /* C2 ج٤: «إجازة أَثَر» — بعد اعتماد المشروع الختاميّ */
    if (!ADMINS.includes(c.user.role)) return bad('إصدار الإجازة للمديرين', 403);
    const r = await issueLicence(c.db, b.email, c.user); if (!r.ok) return bad(LIC_ERR_AR[r.error] || r.error);
    await audit(c.db, c.user, 'iqra.licence.issue', String(b.email || ''), 'إجازة أَثَر', { id: r.licence.id }); return NextResponse.json({ success: true, ...r }, { headers: NO });
  }
  if (action === 'status') {
    if (!ADMINS.includes(c.user.role)) return bad('اعتماد الحلقات للمديرين', 403);
    const note = typeof b.note === 'string' ? b.note.trim().slice(0, 300) || null : null;
    const r = await setLessonStatus(c.db, b.id, b.status, c.user, note); if (!r.ok) return bad(r.error);
    await audit(c.db, c.user, `iqra.lesson.${String(b.status)}`, String(b.id), 'حلقة اقْرَأْ', { note }); return NextResponse.json({ success: true }, { headers: NO });
  }
  if (action === 'validate' || action === 'import') {
    const n = normalizePack(b.pack); if (!n.ok) return NextResponse.json({ success: false, error: 'الحزمة غير صالحة', problems: n.problems.slice(0, 60) }, { status: 400, headers: NO });
    const summary = { source: n.pack.source, version: n.pack.version, units: (n.pack.units || []).length, lessons: n.pack.lessons.length, cards: n.pack.lessons.reduce((s, l) => s + l.cards.length, 0), exercises: n.pack.lessons.reduce((s, l) => s + l.exercises.length, 0), library: (n.pack.library || []).length, kinds: [...new Set(n.pack.lessons.flatMap((l) => l.exercises.map((e) => e.kind)))], fairness_warnings: n.warnings.filter((w) => w.msg.startsWith('الإنصاف')).length, warnings: n.warnings.slice(0, 60) };
    if (action === 'validate') return NextResponse.json({ success: true, summary }, { headers: NO });
    const batchId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}`) as string;
    const replaceApproved = b.replace_approved === true && ADMINS.includes(c.user.role); /* ت٣: تحديث الحلقات المعتمدة — للمديرين فقط */
    const report = await importPack(c.db, n.pack, c.user, batchId, { replaceApproved });
    await audit(c.db, c.user, 'iqra.import', batchId, `استيراد حزمة اقْرَأْ (${n.pack.source})${replaceApproved ? ' — مع تحديث المعتمدة' : ''}`, { ...report, lessons: n.pack.lessons.length, replace_approved: replaceApproved });
    return NextResponse.json({ success: true, summary, report, batch_id: batchId }, { headers: NO });
  }
  if (action === 'library_status') {
    if (!ADMINS.includes(c.user.role)) return bad('اعتماد نصوص المكتبة للمديرين', 403);
    const r = await setLibraryStatus(c.db, b.id, b.status, c.user); if (!r.ok) return bad(r.error);
    await audit(c.db, c.user, `iqra.library.${String(b.status)}`, String(b.id), 'نصّ مكتبة اقْرَأْ', {}); return NextResponse.json({ success: true }, { headers: NO });
  }
  if (action === 'enrol') {
    if (!ADMINS.includes(c.user.role)) return bad('التسكين اليدوي للمديرين', 403);
    const email = normEmail(String(b.email || '')); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad('بريد غير صالح'); if (!isIqraLevel(b.level)) return bad('مستوى غير صالح');
    const ok = await manualEnrol(c.db, email, b.level, c.user.email, typeof b.note === 'string' ? b.note.slice(0, 300) : null); if (!ok) return bad('تعذّر التسكين');
    await audit(c.db, c.user, 'iqra.enrol.manual', email, 'تسكين يدوي في اقْرَأْ', { level: b.level }); return NextResponse.json({ success: true }, { headers: NO });
  }
  return bad('إجراء غير معروف');
}
