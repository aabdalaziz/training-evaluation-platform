// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P66 «أيام التدريب وفترات التطبيق» — صفحة المتدرّب «سطري» (الاسم الرسمي: سجلّ التعلّم والتطبيق للمتدرّب)
 *  GET  /api/me/line                                  → شُعبي · طور اليوم (تدريب / «البرنامج معك في موقعك» / استراحة) · ما يُسمح بكتابته · سطوري · التزامي المفتوح
 *  POST /api/me/line { action:'line', classroom_id, kind:'learn'|'apply'|'commit', body_ar, blocker_ar? } → سطر اليوم (يوم تدريب) · سطر التطبيق (أسبوعي) · التزامي حتى نلتقي (آخر يوم الكتلة)
 *  POST /api/me/line { action:'commit', id, done:'yes'|'part'|'no', note_ar? }  → إجابة الالتزام يوم العودة (يُفتح لصاحبه وحده)
 *  POST /api/me/line { action:'delete', id }                                     → حذف فوري
 *  المبدأ: لا درجة ولا تقييم؛ المدرّب يرى المجمَّع فقط (k ≥ 5)؛ لا ذكاء اصطناعي. المصادقة: Bearer (المتعلّم بنفسه) · الحدّ: 40 كتابة/ساعة
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, tooMany } from '../../../../lib/shield/ratelimit';
import { myLinePage, writeLine, answerCommit, deleteLine } from '../../../../lib/calendar/store';
import { LINE_FOOT_AR, FIELD_CASE_PATH } from '../../../../lib/calendar/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO = { 'Cache-Control': 'private, no-store' };
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO });
const noStore: typeof fetch = (i, init) => fetch(i, { ...(init || {}), cache: 'no-store' });

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('سجّل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user?.email) return { error: bad('جلسة الدخول غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false }, global: { fetch: noStore } });
  const name = String((data.user.user_metadata as any)?.full_name || (data.user.user_metadata as any)?.name || '').trim();
  return { db, user: { id: data.user.id, email: String(data.user.email).toLowerCase(), name: name || undefined } };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const page = await myLinePage(db, user, new Date());
  return NextResponse.json({ success: true, ...page, foot_ar: LINE_FOOT_AR, field_case_path: FIELD_CASE_PATH }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  let body: any; try { body = await req.json(); } catch { return bad('JSON غير صالح'); }
  const action = String(body.action || ''); const now = new Date();
  const rl = await rateLimit(db, `line:${user.id}`, 3600, 40); if (!rl.allowed) return tooMany(rl);
  if (action === 'line') { const r = await writeLine(db, user, body, now); if (!r.ok) return bad(r.error, r.status); return NextResponse.json({ success: true, line: r.line, updated: r.updated }, { headers: NO }); }
  if (action === 'commit') { const r = await answerCommit(db, user, body, now); if (!r.ok) return bad(r.error, r.status); return NextResponse.json({ success: true, line: r.line }, { headers: NO }); }
  if (action === 'delete') { const r = await deleteLine(db, user, Number(body.id)); if (!r.ok) return bad(r.error, r.status); return NextResponse.json({ success: true }, { headers: NO }); }
  return bad('إجراء غير معروف');
}
