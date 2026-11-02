// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/miaar/balance — «ميزان مِعيار» للطاقم (م3)
 *  GET            → ملخّص الميزان: أضواء المستويات والنماذج · إحصاءات البنود · «بنود تحتاج نظرة» · المستنزَفة · حال المعايرة
 *  GET ?invite=id → «الميزان في الدعوة»: أداء مجموعة واحدة (مجمّع، ≥ 5 جلسات)
 *  POST {action}
 *   reweigh                       → إعادة الوزن الآن (كل الجلسات المنتهية حتى 3000)
 *   accept_move {item_code, to}   → اعتماد نقل بند إلى مستوى اقترحته المعايرة (قرار بشري مسجَّل)
 *   dismiss {item_code}           → رفض الاقتراح (لا يعود للمستوى نفسه)
 *   anchor {item_code, anchor}    → تعيين/إلغاء بند مرساة
 *   sibling {item_code}           → «بنك يتنفّس»: شقيق مسودة لبند مستنزَف (الذكاء الاصطناعي يقترح، المعدّ يعتمد)
 *  لا اسم ولا بريد في أي استجابة.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../../lib/shield/body';
import { balanceSummary, reweigh, inviteReport, acceptMove, dismissSuggestion, setAnchor } from '../../../../../lib/miaar/balance';
import { makeSibling } from '../../../../../lib/miaar/sibling';
import { isBankLevel } from '../../../../../lib/miaar/registry';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
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
const code = (v: unknown) => (typeof v === 'string' && /^[A-Z0-9][A-Z0-9-]{1,39}$/i.test(v.trim()) ? v.trim() : '');

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c; const u = new URL(req.url);
  const invite = u.searchParams.get('invite');
  if (invite) { if (!/^[0-9a-f-]{36}$/i.test(invite)) return bad('معرّف دعوة غير صالح'); const r = await inviteReport(db, invite).catch((e: any) => ({ ok: false as const, reason: String(e?.message || e), sessions: 0 })); return NextResponse.json({ success: true, report: r }, { headers: { 'Cache-Control': 'no-store' } }); }
  const summary = await balanceSummary(db).catch(() => null); if (!summary) return bad('تعذّرت قراءة الميزان — هل شُغّلت هجرة م3؟', 500);
  return NextResponse.json({ success: true, ...summary }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const j = await readJson(req, { maxBytes: 64 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>;
  const action = String(b.action || '');
  if (action === 'reweigh') { try { const r = await reweigh(db); return NextResponse.json({ success: true, ...r, note_ar: r.sessions ? `وُزن ${r.items} بندًا من ${r.sessions} جلسة (${r.responses} إجابة) · معايَر ${r.calibrated} · اقتراحات ${r.suggestions} · ${r.ms} م.ث` : 'لا جلسات منتهية بعد — الميزان يبدأ مع أول المتقدّمين' }); } catch (e: any) { return bad('تعذّر الوزن: ' + String(e?.message || e), 500); } }
  const item = code(b.item_code); if (!item) return bad('رمز بند غير صالح');
  if (action === 'accept_move') { const to = String(b.to || ''); if (!isBankLevel(to)) return bad('مستوى غير صالح'); const r = await acceptMove(db, item, to, user.id); return r.ok ? NextResponse.json({ success: true, note_ar: `نُقل ${item} إلى ${to} — سُجّل القرار باسمك` }) : bad(r.error || 'تعذّر النقل'); }
  if (action === 'dismiss') { const ok = await dismissSuggestion(db, item); return ok ? NextResponse.json({ success: true, note_ar: 'رُفض الاقتراح ولن يعود للمستوى نفسه' }) : bad('لا اقتراح قائمًا لهذا البند'); }
  if (action === 'anchor') { const ok = await setAnchor(db, item, b.anchor === true); return ok ? NextResponse.json({ success: true, note_ar: b.anchor === true ? `${item} صار بند مرساة — يبقى ثابتًا بين النماذج` : `أُلغيت مرساة ${item}` }) : bad('تعذّر التعديل'); }
  if (action === 'sibling') { const r = await makeSibling(db, item, user); return r.ok ? NextResponse.json({ success: true, code: r.code, source: r.source, id: r.id, note_ar: r.source === 'ai' ? `أُنشئ الشقيق ${r.code} مسودةً — راجعه في بنك الأسئلة قبل الاعتماد` : `أُنشئ هيكل الشقيق ${r.code} (الذكاء الاصطناعي غير متاح) — أكمله في بنك الأسئلة` }) : bad(r.error); }
  return bad('إجراء غير معروف');
}
