// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/miaar — «مِعيار — من أَثَر» للمتقدّم (بلا حساب؛ وإن كان داخلًا رُبط التقرير بحسابه)
 *  GET ?probe=1[&seen=رموز]     → بنود «مِسبار» الخمسة — متجدّدة من البنك في كل زيارة (م2-ب)، خيارات مخلوطة، بلا مفاتيح
 *  GET ?doors=1                 → أبواب الاختبار العامة (المخطّطات النشطة المعلنة) — م2-ب
 *  GET ?intro=1                 → الأبواب + النبض في ردّ واحد (خِفّة م3-د)
 *  GET ?trust=1                 → «سجلّ الصدق»: موثوقية كل مستوى (ضوء · n · k · SEM · ثبات القرار) بلا بنود ولا أشخاص — م3
 *  GET ?pulse=1                 → «نبض مِعيار»: أعداد مجهّلة (الآن/اليوم/الأسبوع) وآخر المستويات المُثبتة بلا أسماء — لا يُعرض شيء دون 5 تقارير في الأسبوع — م2-ب
 *  POST probe_band {probeAnswers} → {score, band} مؤشر أولي بعد الحلقات (بلا جلسة) — م2-ب
 *  GET ?invite=<code>&t=<token> → ما تعنيه الدعوة (الاسم · اللغة · النمط · المستلم إن كانت شخصية)
 *  GET ?result=<ML-code>        → النتيجة برمزها (بلا بريد/هاتف)
 *  GET ?journey=<ML-code>       → م5-ب: رحلة المتقدّم (المحاولات والمقارنة) برمز النتيجة
 *  POST {action}
 *   start  {candidate, examMode, probeAnswers?, access?, invite?: {code, t?}}  → جلسة آمنة (كوكي miaar_placement_session) + النموذج
 *   resume · answer {questionId, selectedOptionId, finalize?} · finish {reason}
 *  التصحيح والمفاتيح على الخادم فقط (كما في مِعيار). حدّ: 10 بدايات/ساعة لكل IP.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enterRoom, saveDraft, submitPerformance, skipPerformance } from '../../../lib/miaar/room';
import { readJson, crossSiteBrowserWrite } from '../../../lib/shield/body';
import { rateLimit, ipOf, tooMany } from '../../../lib/shield/ratelimit';
import { COOKIE_NAME, probePublic, isResultCode, MIAAR_NAMES_AR } from '../../../lib/miaar/registry';
import { startSession, loadSession, resumeSession, answerSession, finishSession, resultByCode } from '../../../lib/miaar/engine';
import { journeyByCode, setGrowthPublic } from '../../../lib/miaar/growth'; /* م5-ب */
import { normalizeSite } from '../../../lib/portal/open';
const siteUrl = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
import { trustSummary } from '../../../lib/miaar/balance';
import { stopwatch, slowLine } from '../../../lib/miaar/timing';
import { openInvite } from '../../../lib/miaar/invites';
import { loadApprovedPool, loadPassages, signedMediaUrl, isReferencedMediaPath } from '../../../lib/miaar/bank';
import { probeFromPool, publicDoors, probeScoreFrom } from '../../../lib/miaar/blueprint';
import { probeBand } from '../../../lib/miaar/registry';
const ROOM_MAX_BYTES = 4 * 1024 * 1024; /* تسجيل التحدّث base64 (≤ 90 ث) — تحت سقف Vercel 4.5 م.ب */

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const NO = { 'Cache-Control': 'no-store' };
const bad = (code: string, status = 400) => NextResponse.json({ ok: false, error: code }, { status, headers: NO });
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false } }) : null; };
async function userOf(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return null;
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; if (!U || !A) return null;
  try { const { data } = await createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }).auth.getUser(token); return data?.user?.id || null; } catch { return null; }
}
function cookieOf(req: Request): string {
  const raw = req.headers.get('cookie') || ''; for (const part of raw.split(';')) { const [k, ...v] = part.trim().split('='); if (k === COOKIE_NAME) return decodeURIComponent(v.join('=')); } return '';
}
const withCookie = (res: NextResponse, token: string | null, expiresAt?: string) => {
  if (token) res.cookies.set(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: expiresAt ? new Date(new Date(expiresAt).getTime() + 2 * 3600 * 1000) : undefined });
  else res.cookies.set(COOKIE_NAME, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
};

/* نبض مِعيار — ذاكرة دقيقة واحدة حتى لا تُثقل الصفحة الأولى قاعدة البيانات */
let PULSE_CACHE: { at: number; body: unknown } | null = null;
const PULSE_MIN = 5;  /* قاعدة «أَثَر للجميع»/الخصوصية: لا أرقام ولا آثار دون خمسة تقارير في الأسبوع */
async function pulse(db: any) {  /* eslint-disable-line @typescript-eslint/no-explicit-any */
  if (PULSE_CACHE && Date.now() - PULSE_CACHE.at < 60_000) return PULSE_CACHE.body;
  const now = Date.now(); const iso = (ms: number) => new Date(now - ms).toISOString();
  const [live, today, week, month, recent, growth] = await Promise.all([
    db.from('placement_secure_sessions').select('id', { count: 'exact', head: true }).eq('status', 'active').gte('started_at', iso(20 * 60_000)),
    db.from('placement_reports').select('id', { count: 'exact', head: true }).gte('created_at', iso(24 * 3600_000)),
    db.from('placement_reports').select('id', { count: 'exact', head: true }).gte('created_at', iso(7 * 24 * 3600_000)),
    db.from('placement_reports').select('id', { count: 'exact', head: true }).gte('created_at', iso(30 * 24 * 3600_000)),
    db.from('placement_reports').select('report, created_at').order('created_at', { ascending: false }).limit(8),
    db.from('placement_reports').select('id', { count: 'exact', head: true }).eq('growth_public', true),  /* م5-ب: «ختم النموّ» باختيار أصحابه */
  ]);
  const weekN = week.count || 0;
  const ok = weekN >= PULSE_MIN;
  const items = ok ? (recent.data || []).map((r: any) => { const rep = r.report || {}; const level = String(rep['المستوى_العام'] || ''); const lang = String(rep?.['بيانات_المتقدم']?.['اللغة_الأم'] || ''); return /^(A1|A2|B1|B2|C1|C2)$/.test(level) ? { level, lang: lang && lang !== '—' ? lang : null, minutes: Math.max(1, Math.round((now - new Date(r.created_at).getTime()) / 60_000)) } : null; }).filter(Boolean) : [];
  const body = { ok: true, now: ok ? live.count || 0 : null, today: ok ? today.count || 0 : null, week: ok ? weekN : null, month: ok ? month.count || 0 : null, recent: items, growth: ok && (growth.count || 0) >= 3 ? growth.count || 0 : null };
  PULSE_CACHE = { at: Date.now(), body }; return body;
}

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('server_not_configured', 500);
  const u = new URL(req.url);
  if (u.searchParams.get('trust')) return NextResponse.json(await trustSummary(db).catch(() => ({ levels: [], sessions: 0, computed_at: null })), { headers: { 'Cache-Control': 'public, max-age=300' } });   /* م3: «سجلّ الصدق» — أضواء المستويات فقط */
  if (u.searchParams.get('pulse')) return NextResponse.json(await pulse(db).catch(() => ({ ok: true, now: null, today: null, week: null, month: null, recent: [] })), { headers: { 'Cache-Control': 'public, max-age=60' } });
  if (u.searchParams.get('probe')) {
    /* م2-ب: بنود متجدّدة من البنك المعتمد في كل زيارة (بذرة عشوائية) مع استبعاد ما رآه الزائر مؤخرًا (?seen=رمز,رمز) — والبنود الثابتة احتياط */
    const seen = String(u.searchParams.get('seen') || '').split(',').map((c) => c.trim()).filter(Boolean).slice(0, 30);
    const seed = `${ipOf(req)}:${Date.now()}:${Math.random()}`;
    const pool = await loadApprovedPool(db).catch(() => null);
    const items = pool && pool.length ? probeFromPool(pool, seed, seen) : probePublic(seed);
    return NextResponse.json({ ok: true, name_ar: MIAAR_NAMES_AR.probe, official_ar: MIAAR_NAMES_AR.probe_official, items }, { headers: NO });
  }
  /* «سرعة مِعيار»: الأبواب والنبض بيانات عامة بلا جلسة — تُخدَم من حافة Vercel دقيقة كاملة (stale-while-revalidate) فتصل الصفحة الأولى في أجزاء الثانية */
  const EDGE = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' };
  if (u.searchParams.get('media')) {
    /* «سرعة مِعيار»: مقطع/صورة من المخزن الخاص — يُوقَّع لحظة التشغيل فقط (302) ومن الذاكرة بعد أول مرة؛ ولا يُوقَّع إلا ما يشير إليه محتوى معتمد */
    const path = String(u.searchParams.get('media') || '').trim().slice(0, 300);
    const [passages, pool] = await Promise.all([loadPassages(db).catch(() => new Map()), loadApprovedPool(db).catch(() => [])]);
    if (!isReferencedMediaPath(path, passages as any, pool)) return bad('not_found', 404);
    const url = await signedMediaUrl(db, path); if (!url) return bad('media_unavailable', 503);
    return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'private, max-age=1800' } });
  }
  if (u.searchParams.get('doors')) return NextResponse.json({ ok: true, doors: await publicDoors(db) }, { headers: EDGE });
  /* م3-د (خِفّة): المقدّمة تطلب الأبواب والنبض معًا في طلب واحد */
  if (u.searchParams.get('intro')) { const [doors, p] = await Promise.all([publicDoors(db).catch(() => []), pulse(db).catch(() => null)]); return NextResponse.json({ ok: true, doors, pulse: p }, { headers: EDGE }); }
  if (u.searchParams.get('invite')) { const r = await openInvite(db, u.searchParams.get('invite'), u.searchParams.get('t') || null); return r.ok ? NextResponse.json({ ok: true, invite: r.invite }, { headers: NO }) : bad(`invite_${r.error}`, r.error === 'not_found' ? 404 : 410); }
  if (u.searchParams.get('result')) { const code = String(u.searchParams.get('result') || '').toUpperCase(); if (!isResultCode(code)) return bad('invalid_code', 400);
    const rl = await rateLimit(db, `miaar_result:${ipOf(req)}`, 3600, 60); if (!rl.allowed) return tooMany(rl, 'محاولات كثيرة');  /* الرمز سرّ حامله — لا تخمين */
    const r = await resultByCode(db, code); return r ? NextResponse.json({ ok: true, ...r }, { headers: NO }) : bad('not_found', 404); }
  /* م5-ب: «رحلة المتقدّم» برمز النتيجة — الاسم الأول فقط، بلا بريد ولا بنود */
  if (u.searchParams.get('journey')) { const code = String(u.searchParams.get('journey') || '').toUpperCase(); if (!isResultCode(code)) return bad('invalid_code', 400);
    const rl = await rateLimit(db, `miaar_result:${ipOf(req)}`, 3600, 60); if (!rl.allowed) return tooMany(rl, 'محاولات كثيرة');
    const j = await journeyByCode(db, code, siteUrl(req)); return j ? NextResponse.json({ ok: true, journey: j }, { headers: NO }) : bad('not_found', 404); }
  return bad('unknown_query', 400);
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('server_not_configured', 500);
  if (crossSiteBrowserWrite(req)) return bad('origin_not_allowed', 403);
  const j = await readJson(req, { maxBytes: ROOM_MAX_BYTES }); if (!j.ok) return bad(j.status === 413 ? 'payload_too_large' : 'invalid_json', j.status === 413 ? 413 : 400); const body = j.body as Record<string, unknown>;
  const action = String(body.action || '');
  /* م5-ب: «ختم النموّ» — المتقدّم (حامل الرمز) يختار إظهار نموّه في «نبض مِعيار» العلني بلا اسم */
  if (action === 'growth_public') { const code = String(body.code || '').toUpperCase(); if (!isResultCode(code)) return bad('invalid_code', 400);
    const rl = await rateLimit(db, `miaar_result:${ipOf(req)}`, 3600, 60); if (!rl.allowed) return tooMany(rl, 'محاولات كثيرة');
    const ok = await setGrowthPublic(db, code, !!body.on); return ok ? NextResponse.json({ ok: true, public: !!body.on }, { headers: NO }) : bad('not_found', 404); }
  if (action === 'probe_band') {
    /* م2-ب: مؤشر أولي بعد الحلقات (بلا جلسة ولا اسم) — التصحيح على الخادم، والنتيجة فرقة تقديرية فقط */
    const rl = await rateLimit(db, `miaar_probe:${ipOf(req)}`, 3600, 60); if (!rl.allowed) return tooMany(rl, 'محاولات كثيرة');
    const pool = await loadApprovedPool(db).catch(() => [] as Awaited<ReturnType<typeof loadApprovedPool>>);
    const score = probeScoreFrom(pool, body.probeAnswers); return NextResponse.json({ ok: true, score, band: probeBand(score) }, { headers: NO });
  }
  if (action === 'start') {
    const sw = stopwatch();  /* «سرعة مِعيار»: مراحل البدء في Server-Timing + سطر سجلّ إن تجاوز 2.5 ث */
    const rl = await rateLimit(db, `miaar_start:${ipOf(req)}`, 3600, 10); if (!rl.allowed) return tooMany(rl, 'محاولات بدء كثيرة'); sw.mark('ratelimit');
    let invite: { id: string; label_ar: string; exam_mode: 'adaptive' | 'comprehensive'; recipient_id?: string | null; blueprint_id?: string | null } | null = null;
    const inv = body.invite as Record<string, unknown> | undefined;
    if (inv && typeof inv === 'object' && inv.code) {
      const r = await openInvite(db, inv.code, inv.t || null); if (!r.ok) return bad(`invite_${r.error}`, 410);
      invite = { id: r.row.id, label_ar: r.row.label_ar, exam_mode: r.row.exam_mode, recipient_id: r.recipient?.id || null, blueprint_id: r.row.blueprint_id || null };
      if (r.recipient && body.candidate && typeof body.candidate === 'object') (body.candidate as Record<string, unknown>).email = r.recipient.email;  /* الدعوة الشخصية تثبّت البريد */
    }
    const userId = await userOf(req); sw.mark('auth');
    const r = await startSession(db, { candidate: body.candidate, examMode: body.examMode, probeAnswers: body.probeAnswers, access: body.access, invite, userId, blueprint: body.blueprint }, sw);
    const slow = slowLine('start', sw); if (slow) console.warn(slow);
    if (!r.ok) return bad(r.code, r.status);
    return withCookie(NextResponse.json({ ok: true, session: r.value.session, invite: invite ? { label_ar: invite.label_ar } : null }, { headers: { ...NO, 'Server-Timing': sw.header() } }), r.value.token, r.value.session.expiresAt);
  }
  const sw = stopwatch();
  const token = cookieOf(req); if (!token) return action === 'resume' ? NextResponse.json({ ok: false, error: 'missing_session' }, { headers: NO }) : bad('missing_session', 401); /* الاستئناف بلا جلسة حالة عادية (أول زيارة) لا خطأ */
  const loaded = await loadSession(db, token, action !== 'answer'); if (!loaded) return withCookie(bad('invalid_session', 401), null); sw.mark('session');
  const { session, answers } = loaded;
  if (action === 'resume') { const r = await resumeSession(db, session, answers); return r.ok ? NextResponse.json({ ok: true, session: r.value }, { headers: NO }) : bad(r.code, r.status); }
  if (action === 'answer') { const r = await answerSession(db, session, body, sw); sw.mark('decide'); const slow = slowLine('answer', sw, 1500); if (slow) console.warn(slow); return r.ok ? NextResponse.json({ ok: true, ...r.value }, { headers: { ...NO, 'Server-Timing': sw.header() } }) : bad(r.code, r.status); }
  if (action === 'finish') {
    let label: string | null = null; if (session.invite_id) { const { data } = await db.from('placement_invites').select('label_ar').eq('id', session.invite_id).maybeSingle(); label = data?.label_ar || null; }
    const r = await finishSession(db, session, answers, body.reason, label); if (!r.ok) return bad(r.code, r.status);
    /* الكعكة تبقى حتى انتهاء مدّتها: إعادة تحميل الصفحة تعيد البطاقة نفسها (finish idempotent) */
    return NextResponse.json({ ok: true, report: r.value.report, access_code: r.value.access_code, result_url: r.value.access_code ? `/miaar/result/${r.value.access_code}` : null }, { headers: NO });
  }
  /* م4-ب «غرفة الأداء»: بعد اكتمال الاستقبالي — مهمّتان بمستوى المتقدّم؛ النص في الجدول والصوت في الدلو الخاص؛ لا درجة قبل اعتماد إنسان */
  if (action === 'room_enter') { const r = await enterRoom(db, session); return r.ok ? NextResponse.json({ ok: true, room: r.value }, { headers: NO }) : bad(r.code, r.status); }
  if (action === 'room_draft') { const r = await saveDraft(db, session, body.skill, body.text); return r.ok ? NextResponse.json({ ok: true, ...r.value }, { headers: NO }) : bad(r.code, r.status); }
  if (action === 'room_submit') {
    const rl = await rateLimit(db, `miaar_room:${ipOf(req)}`, 3600, 12); if (!rl.allowed) return tooMany(rl, 'محاولات تسليم كثيرة');
    const r = await submitPerformance(db, session, body as any); return r.ok ? NextResponse.json({ ok: true, ...r.value }, { headers: NO }) : bad(r.code, r.status);
  }
  if (action === 'room_skip') { const r = await skipPerformance(db, session, body.skill); return r.ok ? NextResponse.json({ ok: true, ...r.value }, { headers: NO }) : bad(r.code, r.status); }
  return bad('unknown_action', 400);
}
