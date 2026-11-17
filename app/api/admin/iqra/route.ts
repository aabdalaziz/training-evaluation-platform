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
 *  كل كتابة تُسجَّل في audit_logs. لا ذكاء اصطناعي هنا.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../lib/shield/body';
import { normEmail } from '../../../../lib/portal/roles';
import { IQRA_NAMES_AR, LEVEL_META, isIqraLevel } from '../../../../lib/iqra/registry';
import { normalizePack } from '../../../../lib/iqra/content';
import { adminOverview, adminLessons, adminLesson, setLessonStatus, importPack, manualEnrol, adminLibrary, setLibraryStatus, adminHours } from '../../../../lib/iqra/store';
import { HOURS_TARGET, SKILL_META } from '../../../../lib/iqra/registry';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const ADMINS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'];
const NO = { 'Cache-Control': 'no-store' };
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO });
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
async function audit(db: any, user: { id: string; email: string; role: string }, action: string, entityId: string, label: string, metadata: Record<string, unknown>) {
  try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: user.role, action, entity_type: 'iqra', entity_id: entityId, entity_label: label, source: 'admin', metadata }); } catch { /* التدقيق لا يوقف العمل */ }
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  const u = new URL(req.url); const lessonId = u.searchParams.get('lesson');
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
    const report = await importPack(c.db, n.pack, c.user, batchId);
    await audit(c.db, c.user, 'iqra.import', batchId, `استيراد حزمة اقْرَأْ (${n.pack.source})`, { ...report, lessons: n.pack.lessons.length });
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
