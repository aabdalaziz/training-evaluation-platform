// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/miaar/ledger — «سجلّ مِعيار» للطاقم (م5-أ)
 *  GET ?from&to&invite&tag&level&status=active|archived|all&decision=all|none|review|approved|auto&q&form&limit → القائمة + العدّادات (+ يشغّل التسكين التلقائي الكسول للمستحقّ)
 *  GET ?csv=1 (+المرشّحات نفسها)      → ملف CSV (UTF-8 BOM) — «صدّر أولًا» قبل أي حذف
 *  GET ?email=<بريد>                   → «سجلّ المتقدّم»: المحاولات والأذون والتسجيلات
 *  GET ?programs=1                     → البرامج لقائمة الاختيار (مع المقاعد المتبقية) + «توزيع الشُّعب»
 *  POST {action}
 *   archive {ids|filter, note} · unarchive {ids}
 *   delete {ids, confirm}              → حذف فوري بلا سلّة (مدير النظام فقط؛ الجماعي يحتاج كتابة العدد)
 *   tag {ids, tag}                     → وسم مجموعة (لتصفية ومقارنة المجموعات في م5-ب)
 *   retake {emails|report_ids, reason, days, invite_id?, program_id?} · retake_revoke {email}
 *   decide {report_ids, level: 'each'|PRE_A1…C2, program_id?, note?} · decision_clear {report_id}
 *   deadline {invite_id, hours|null, level_programs?} → مهلة التسكين التلقائي وخريطة «المستوى → البرنامج» للدعوة
 *  لا يقرّر الذكاء الاصطناعي هنا شيئًا؛ كل قرار يُقيَّد في درع أَثَر.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../../lib/shield/body';
import { ledgerList, ledgerCsv, parseFilter, archiveReports, deleteReports, idsByFilter, grantRetake, revokeRetake, decidePlacement, clearDecision, autoPlaceDue, candidateHistory, programsForPicker, sectionsPanel, DELETE_ROLES, LEDGER_LEVELS, isLedgerLevel } from '../../../../../lib/miaar/ledger';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const NO = { 'Cache-Control': 'no-store' };
async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!STAFF.includes(role)) return { error: bad('غير مصرّح — للطاقم فقط', 403) };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), role } };
}
const uuid = (v: unknown) => (typeof v === 'string' && /^[0-9a-zA-Z-]{2,40}$/.test(v) ? v : '');

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const u = new URL(req.url); const sp = u.searchParams;
  if (sp.get('email')) { const h = await candidateHistory(db, sp.get('email')).catch(() => null); return h ? NextResponse.json({ success: true, history: h }, { headers: NO }) : bad('بريد غير صالح'); }
  if (sp.get('programs')) { const [programs, sections] = await Promise.all([programsForPicker(db).catch(() => []), sectionsPanel(db).catch(() => [])]); return NextResponse.json({ success: true, programs, sections, levels: LEDGER_LEVELS }, { headers: NO }); }
  const f = parseFilter(sp);
  let auto = { placed: 0, review: 0 }; if (!sp.get('csv')) { try { auto = await autoPlaceDue(db, { limit: 50 }); } catch { /* كسول */ } }
  let list; try { list = await ledgerList(db, f); } catch (e) { return bad(`تعذّرت قراءة السجلّ — هل شُغّلت هجرة م5-أ؟ (${(e as Error).message})`, 500); }
  if (sp.get('csv')) return new NextResponse(ledgerCsv(list.rows), { headers: { ...NO, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="miaar-ledger-${new Date().toISOString().slice(0, 10)}.csv"` } });
  /* م11 «مِران البداية»: ملخّص خطّة التمرين لكل صفّ (إن وُجدت) — بلا بنود */
  let practice: Record<string, any> = {}; try { const { summariesForReports } = await import('../../../../../lib/miaar/practice'); practice = await summariesForReports(db, list.rows.map((r: any) => ({ id: String(r.id) }))); } catch { practice = {}; }
  return NextResponse.json({ success: true, ...list, practice, auto, can_delete: DELETE_ROLES.includes(user.role), filter: f }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const j = await readJson(req, { maxBytes: 256 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>;
  const action = String(b.action || '');
  const idsOf = async () => Array.isArray(b.ids) && b.ids.length ? b.ids : b.filter && typeof b.filter === 'object' ? await idsByFilter(db, parseFilter(b.filter as Record<string, unknown>)) : [];
  if (action === 'archive' || action === 'unarchive') { const r = await archiveReports(db, await idsOf(), user, b.note, action === 'unarchive'); return r.ok ? NextResponse.json({ success: true, n: r.n, note_ar: action === 'archive' ? `أُرشفت ${r.n} نتيجة — بطاقاتها تعمل بشارة «نتيجة مؤرشفة»` : `أُعيدت ${r.n} نتيجة إلى السجلّ النشط` }, { headers: NO }) : bad(r.error); }
  if (action === 'delete') { const r = await deleteReports(db, b.ids, user, b.confirm); return r.ok ? NextResponse.json({ success: true, n: r.n, failed: r.failed, note_ar: r.failed.length ? `حُذفت ${r.n} وتعذّر حذف ${r.failed.length}` : `حُذفت ${r.n} نتيجة نهائيًّا — القيد في درع أَثَر` }, { headers: NO }) : bad(r.error, r.error.startsWith('الحذف لمدير') ? 403 : 400); }
  if (action === 'tag') { const ids = (Array.isArray(b.ids) ? b.ids : []).map(uuid).filter(Boolean); const tag = String(b.tag || '').trim().slice(0, 60) || null; if (!ids.length) return bad('لا نتائج محدّدة'); const r = await db.from('placement_reports').update({ group_tag: tag }).in('id', ids); return r.error ? bad(r.error.message) : NextResponse.json({ success: true, n: ids.length, note_ar: tag ? `وُسمت ${ids.length} نتيجة بـ «${tag}»` : `أُزيل الوسم عن ${ids.length} نتيجة` }, { headers: NO }); }
  if (action === 'retake') { const r = await grantRetake(db, { emails: b.emails, report_ids: b.report_ids, reason: b.reason, days: b.days, invite_id: b.invite_id, program_id: b.program_id, kind: b.kind }, user); return r.ok ? NextResponse.json({ success: true, n: r.n, emails: r.emails, note_ar: r.n ? `أُذن لـ ${r.n} متقدّمًا بإعادة الاختبار مرة واحدة — وستُربط المحاولة الجديدة بالسابقة` : 'الأذون مفتوحة من قبل — لا جديد' }, { headers: NO }) : bad(r.error); }
  if (action === 'retake_revoke') { const ok = await revokeRetake(db, b.email, user); return ok ? NextResponse.json({ success: true, note_ar: 'سُحب الإذن' }, { headers: NO }) : bad('تعذّر السحب'); }
  if (action === 'decide') { const r = await decidePlacement(db, { report_ids: b.report_ids, level: b.level, program_id: b.program_id, note: b.note }, user); return r.ok ? NextResponse.json({ success: true, ...r, note_ar: `اعتُمد قرار ${r.n} نتيجة${r.overrides ? ` (منها ${r.overrides} بمستوى يخالف التوصية)` : ''}${r.placed ? ` — وسُكِّن ${r.placed} في شُعب` : ''}` }, { headers: NO }) : bad(r.error); }
  if (action === 'decision_clear') { const ok = await clearDecision(db, b.report_id, user); return ok ? NextResponse.json({ success: true, note_ar: 'أُلغي القرار — عادت النتيجة «بلا قرار»' }, { headers: NO }) : bad('تعذّر الإلغاء'); }
  if (action === 'deadline') {
    const id = uuid(b.invite_id); if (!id) return bad('دعوة غير صالحة'); const hours = b.hours === null || b.hours === '' ? null : Number(b.hours); if (hours !== null && !(Number.isInteger(hours) && hours >= 1 && hours <= 720)) return bad('المهلة بين 1 و720 ساعة، أو فارغة لتعطيل التسكين التلقائي');
    const lp: Record<string, string> = {}; if (b.level_programs && typeof b.level_programs === 'object') for (const [k, v] of Object.entries(b.level_programs as Record<string, unknown>)) if (isLedgerLevel(k) && uuid(v)) lp[k] = String(v);
    const r = await db.from('placement_invites').update({ decision_deadline_hours: hours, level_programs: lp, updated_at: new Date().toISOString() }).eq('id', id); return r.error ? bad(r.error.message) : NextResponse.json({ success: true, note_ar: hours === null ? 'عُطّل التسكين التلقائي لهذه الدعوة — القرار لإنسان دائمًا' : `مهلة القرار ${hours} ساعة — بعدها يُسكَّن غير المحسوم على توصيته (عدا المنطقة الرمادية)` }, { headers: NO });
  }
  return bad('إجراء غير معروف');
}
