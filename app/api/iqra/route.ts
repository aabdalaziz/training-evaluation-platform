// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/iqra — «اقْرَأْ — من أَثَر» (ق1): واجهة المتعلّم
 *  الهوية: حساب أَثَر (Bearer) أو رمز نتيجة مِعيار (?code=ML-XXXX-XXXX) — كلاهما يفضي إلى البريد المطبَّع، وهو مفتاح الرِّواق.
 *  البوّابة: لا رِواق إلا بقرار تسكين معتمد من مِعيار (gate: none | pending | enrolled).
 *  GET  ?view=home                → الرِّواق: المنازل والحلقات المعتمدة · خطواتي · أيامي · أراجع المستحقّ · سؤال اليوم
 *  GET  ?view=lesson&id=<uuid>    → الحلقة: المحطّات الخمس (بلا مفاتيح الإجابة)
 *  GET  ?view=reviews             → بطاقات «أراجع» المستحقّة اليوم
 *  GET  ?view=notebook            → «دفتري»: كلماتي ونسبة الإتقان
 *  POST {action:'answer', lesson_id, item_id, answer:{option|pairs|order}}   → تصحيح على الخادم + شرح (الخطأ يدخل «أراجع»)
 *  POST {action:'daily',  item_id, answer}                                   → تصحيح سؤال اليوم (بلا حفظ)
 *  POST {action:'finish', lesson_id}                                         → إغلاق الحلقة (≥70% = تمّت وتُفتح البطاقات في «أراجع»)
 *  POST {action:'review', review_id, result:'again'|'good'|'easy'}           → التكرار المتباعد 1·3·7·14·30
 *  لا درجة رسمية · لا أثر على التقييم أو الشهادة · لا أسماء · لا ذكاء اصطناعي في هذا المسار.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson, crossSiteBrowserWrite } from '../../../lib/shield/body';
import { rateLimit, ipOf, tooMany } from '../../../lib/shield/ratelimit';
import { normEmail } from '../../../lib/portal/roles';
import { isResultCode } from '../../../lib/miaar/registry';
import { IQRA_NAMES_AR, IQRA_LIMITS, UI_AR } from '../../../lib/iqra/registry';
import { gate, learnerHome, lessonView, answerItem, finishLesson, reviewsDue, reviewAnswer, notebook } from '../../../lib/iqra/store';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 30;
const NO = { 'Cache-Control': 'private, no-store' };
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: NO });
const noStore: typeof fetch = (i, init) => fetch(i, { ...(init || {}), cache: 'no-store' });

async function ctx(req: Request, code: string) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('server_not_configured', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false }, global: { fetch: noStore } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token) {
    const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token);
    if (data?.user?.email) return { db, email: normEmail(data.user.email), userId: data.user.id, via: 'account' as const };
  }
  if (isResultCode(code)) {
    const { data: rep } = await db.from('placement_reports').select('id, candidate_email, user_id').eq('access_code', code).maybeSingle();
    if (rep?.candidate_email) return { db, email: normEmail(rep.candidate_email), userId: (rep.user_id as string) || null, via: 'code' as const };
    return { error: bad('invalid_code', 404) };
  }
  return { error: bad('sign_in_or_code', 401) };
}
const gateJson = (g: { state: string }) => NextResponse.json({ ok: true, gate: g.state, title: IQRA_NAMES_AR, copy: g.state === 'none' ? { title: UI_AR.gate_title, body: UI_AR.gate_body, cta: UI_AR.gate_cta, href: '/miaar' } : { title: UI_AR.pending_title, body: UI_AR.pending_body } }, { headers: NO });

export async function GET(req: Request) {
  const u = new URL(req.url); const code = String(u.searchParams.get('code') || '').toUpperCase();
  const c = await ctx(req, code); if ('error' in c) return c.error;
  const rl = await rateLimit(c.db, `iqra_read:${ipOf(req)}`, 3600, 600); if (!rl.allowed) return tooMany(rl, 'محاولات كثيرة');
  const g = await gate(c.db, c.email, c.userId); if (g.state !== 'enrolled') return gateJson(g);
  const view = String(u.searchParams.get('view') || 'home');
  if (view === 'home') return NextResponse.json({ ok: true, gate: 'enrolled', via: c.via, title: IQRA_NAMES_AR, ...(await learnerHome(c.db, g.enrolment)) }, { headers: NO });
  if (view === 'lesson') { const v = await lessonView(c.db, g.enrolment, String(u.searchParams.get('id') || '')); return v ? NextResponse.json({ ok: true, gate: 'enrolled', حلقة: v }, { headers: NO }) : bad('lesson_not_found', 404); }
  if (view === 'reviews') return NextResponse.json({ ok: true, gate: 'enrolled', ...(await reviewsDue(c.db, g.enrolment)) }, { headers: NO });
  if (view === 'notebook') return NextResponse.json({ ok: true, gate: 'enrolled', ...(await notebook(c.db, g.enrolment)) }, { headers: NO });
  return bad('unknown_view');
}

export async function POST(req: Request) {
  if (crossSiteBrowserWrite(req)) return bad('origin_not_allowed', 403);
  const j = await readJson(req, { maxBytes: 32 * 1024 }); if (!j.ok) return bad('invalid_json'); const b = j.body as Record<string, unknown>;
  const c = await ctx(req, String(b.code || '').toUpperCase()); if ('error' in c) return c.error;
  const rl = await rateLimit(c.db, `iqra_write:${ipOf(req)}`, 3600, IQRA_LIMITS.writes_per_hour); if (!rl.allowed) return tooMany(rl, 'محاولات كثيرة');
  const g = await gate(c.db, c.email, c.userId); if (g.state !== 'enrolled') return gateJson(g);
  const action = String(b.action || '');
  const codeOf = (e: string) => (e === 'lesson_unavailable' || e === 'item_unavailable' || e === 'not_found' ? 404 : 400);
  if (action === 'answer') { const r = await answerItem(c.db, g.enrolment, { lesson_id: b.lesson_id, item_id: b.item_id, answer: (b.answer || {}) as any }); return r.ok ? NextResponse.json(r, { headers: NO }) : bad(r.error, codeOf(r.error)); }
  if (action === 'daily') { const r = await answerItem(c.db, g.enrolment, { item_id: b.item_id, answer: (b.answer || {}) as any, daily: true }); return r.ok ? NextResponse.json(r, { headers: NO }) : bad(r.error, codeOf(r.error)); }
  if (action === 'finish') { const r = await finishLesson(c.db, g.enrolment, b.lesson_id); return r.ok ? NextResponse.json(r, { headers: NO }) : bad(r.error, codeOf(r.error)); }
  if (action === 'review') { const r = await reviewAnswer(c.db, g.enrolment, b.review_id, b.result); return r.ok ? NextResponse.json(r, { headers: NO }) : bad(r.error, codeOf(r.error)); }
  return bad('unknown_action');
}
