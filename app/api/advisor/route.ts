// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/advisor — «مستشارك: اسأل وأنا أجيب» (بوابة أَثَر · P10)
 *  GET                                           → حقائق عامة للصفحة الحيّة {feed_programs, feed_sessions, counters}
 *  POST { question, name?, email?, page?, lang? } → إجابة من الحقائق الحيّة فقط (برامج/جلسات/خدمات) عبر الذكاء الاصطناعي أو بديل محلي؛ تُسجَّل في portal_advisor_questions
 *  POST { action:'handoff', question_id?, question, answer?, name, email, phone? } → تحويل إلى مستشار بشري (صندوق الوارد portal_contact_messages بموضوع advisor)
 *  الحوكمة: لا وعود خارج الحقائق، تحويل بشري عند الشك، حدّ 20 سؤالًا/ساعة لكل IP، بلا تخزين لبيانات غير ضرورية.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAi, logAi } from '../../../lib/ai/athar';
import { buildAdvisorPrompt, parseAdvisor, localAdvisor, parseJsonLoose } from '../../../lib/ai/prompts';
import type { AdvisorAnswer } from '../../../lib/ai/prompts';
import { advisorFacts } from '../../../lib/portal/home';
import type { Lang } from '../../../lib/portal/content';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const langOf = (v: unknown): Lang => (v === 'en' ? 'en' : 'ar');
const hits = new Map<string, { n: number; t: number }>();
function allow(ip: string, limit = 20): boolean { const now = Date.now(); const h = hits.get(ip); if (!h || now - h.t > 3600000) { hits.set(ip, { n: 1, t: now }); return true; } h.n++; return h.n <= limit; }
const ipOf = (req: Request) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
const S = (v: unknown, n: number) => String(v ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const PROG_COLS = 'id,name_ar,name_en,start_date,end_date,registration_open,registration_deadline,fee,delivery_mode,program_type,intro_ar,audience_ar,status,archived_at,is_public,seats';
const SESS_COLS = 'id,kind,title_ar,title_en,speaker_name,starts_at,duration_min,access,status,description_ar,provider,capacity';

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { db, user: null as null | { id: string; email: string; name: string } };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { db, user: null };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String(data.user.user_metadata?.full_name || '') } };
}
/** الحقائق الحيّة: برامج عامة، جلسات قادمة، عدّادات */
async function liveFacts(db: any) {
  const nowIso = new Date().toISOString();
  let progRes = await db.from('programs').select(PROG_COLS).eq('is_public', true).is('archived_at', null).order('start_date', { ascending: true }).limit(60);
  if (progRes.error) progRes = await db.from('programs').select('id,name_ar,name_en,start_date,end_date,delivery_mode,intro_ar,audience_ar,status,archived_at,is_public').is('archived_at', null).order('start_date', { ascending: true }).limit(60);
  const [{ data: sessions }, { count: resources }, { count: creds }, { count: sims }] = await Promise.all([
    db.from('portal_sessions').select(SESS_COLS).eq('access', 'public').neq('status', 'cancelled').gte('starts_at', new Date(Date.now() - 3 * 3600000).toISOString()).order('starts_at').limit(12),
    db.from('portal_resources').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    db.from('portal_credentials').select('id', { count: 'exact', head: true }),
    db.from('portal_sim_runs').select('id', { count: 'exact', head: true }),
  ]);
  return { nowIso, programs: (progRes.data || []) as any[], sessions: (sessions || []) as any[], counters: { resources: resources || 0, credentials: creds || 0, sims: sims || 0 } };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  const f = await liveFacts(c.db);
  return NextResponse.json({ success: true, now: f.nowIso, programs: f.programs, sessions: f.sessions, counters: f.counters }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' } });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const lang = langOf(body.lang); const page = S(body.page, 120) || '/';

  if (body.action === 'handoff') {
    const email = S(body.email, 160).toLowerCase(); const name = S(body.name, 120); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad('أدخل بريدًا صالحًا');
    const question = S(body.question, 1500); if (!question) return bad('اكتب سؤالك');
    const message = `سؤال عبر «مستشارك»:\n${question}${body.answer ? `\n\nإجابة المساعد (للمراجعة):\n${S(body.answer, 1500)}` : ''}`;
    const { error } = await db.from('portal_contact_messages').insert({ name: name || email, email, phone: S(body.phone, 40) || null, organization: S(body.organization, 160) || null, subject: 'advisor', message, lang, status: 'new', page });
    if (error) return bad(error.message);
    if (body.question_id) await db.from('portal_advisor_questions').update({ handoff: true, email, name: name || null }).eq('id', String(body.question_id));
    return NextResponse.json({ success: true });
  }

  const question = S(body.question, 600); if (question.length < 3) return bad('اكتب سؤالك');
  if (!user && !allow(ipOf(req))) return bad('بلغت حدّ الأسئلة لهذه الساعة — اترك بريدك وسيجيبك مستشار بشري', 429);
  const f = await liveFacts(db); const facts = advisorFacts(f.programs, f.sessions, f.counters.resources, f.nowIso, lang);
  const p = buildAdvisorPrompt(question, facts, lang, 'advisor');
  const res = await runAi<AdvisorAnswer>({ system: p.system, user: p.user, parse: raw => parseAdvisor(parseJsonLoose(raw), facts), local: () => localAdvisor(question, facts), budgetMs: 18000 });
  if (user) await logAi(db, { user_id: user.id, email: user.email, role: 'USER', purpose: 'advisor', result: res, context: { page } });
  const id = (globalThis as any).crypto?.randomUUID ? (globalThis as any).crypto.randomUUID() : `${Date.now()}`;
  await db.from('portal_advisor_questions').insert({ id, name: S(body.name, 120) || null, email: user?.email || S(body.email, 160).toLowerCase() || null, question, answer: res.data.answer_ar, source: res.source, model: res.model, handoff: res.data.handoff, lang, page, user_id: user?.id || null });
  return NextResponse.json({ success: true, id, answer: res.data.answer_ar, links: res.data.links, handoff: res.data.handoff, confidence: res.data.confidence, source: res.source });
}
