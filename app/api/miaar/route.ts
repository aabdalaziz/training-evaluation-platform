// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/miaar — «مِعيار — من أَثَر» للمتقدّم (بلا حساب؛ وإن كان داخلًا رُبط التقرير بحسابه)
 *  GET ?probe=1[&seen=رموز]     → بنود «مِسبار» الخمسة — متجدّدة من البنك في كل زيارة (م2-ب)، خيارات مخلوطة، بلا مفاتيح
 *  GET ?doors=1                 → أبواب الاختبار العامة (المخطّطات النشطة المعلنة) — م2-ب
 *  GET ?invite=<code>&t=<token> → ما تعنيه الدعوة (الاسم · اللغة · النمط · المستلم إن كانت شخصية)
 *  GET ?result=<ML-code>        → النتيجة برمزها (بلا بريد/هاتف)
 *  POST {action}
 *   start  {candidate, examMode, probeAnswers?, access?, invite?: {code, t?}}  → جلسة آمنة (كوكي miaar_placement_session) + النموذج
 *   resume · answer {questionId, selectedOptionId, finalize?} · finish {reason}
 *  التصحيح والمفاتيح على الخادم فقط (كما في مِعيار). حدّ: 10 بدايات/ساعة لكل IP.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson, crossSiteBrowserWrite } from '../../../lib/shield/body';
import { rateLimit, ipOf, tooMany } from '../../../lib/shield/ratelimit';
import { COOKIE_NAME, probePublic, isResultCode, MIAAR_NAMES_AR } from '../../../lib/miaar/registry';
import { startSession, loadSession, resumeSession, answerSession, finishSession, resultByCode } from '../../../lib/miaar/engine';
import { openInvite } from '../../../lib/miaar/invites';
import { loadApprovedPool } from '../../../lib/miaar/bank';
import { probeFromPool, publicDoors } from '../../../lib/miaar/blueprint';

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

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('server_not_configured', 500);
  const u = new URL(req.url);
  if (u.searchParams.get('probe')) {
    /* م2-ب: بنود متجدّدة من البنك المعتمد في كل زيارة (بذرة عشوائية) مع استبعاد ما رآه الزائر مؤخرًا (?seen=رمز,رمز) — والبنود الثابتة احتياط */
    const seen = String(u.searchParams.get('seen') || '').split(',').map((c) => c.trim()).filter(Boolean).slice(0, 30);
    const seed = `${ipOf(req)}:${Date.now()}:${Math.random()}`;
    const pool = await loadApprovedPool(db).catch(() => null);
    const items = pool && pool.length ? probeFromPool(pool, seed, seen) : probePublic(seed);
    return NextResponse.json({ ok: true, name_ar: MIAAR_NAMES_AR.probe, official_ar: MIAAR_NAMES_AR.probe_official, items }, { headers: NO });
  }
  if (u.searchParams.get('doors')) return NextResponse.json({ ok: true, doors: await publicDoors(db) }, { headers: NO });
  if (u.searchParams.get('invite')) { const r = await openInvite(db, u.searchParams.get('invite'), u.searchParams.get('t') || null); return r.ok ? NextResponse.json({ ok: true, invite: r.invite }, { headers: NO }) : bad(`invite_${r.error}`, r.error === 'not_found' ? 404 : 410); }
  if (u.searchParams.get('result')) { const code = String(u.searchParams.get('result') || '').toUpperCase(); if (!isResultCode(code)) return bad('invalid_code', 400);
    const rl = await rateLimit(db, `miaar_result:${ipOf(req)}`, 3600, 60); if (!rl.allowed) return tooMany(rl, 'محاولات كثيرة');  /* الرمز سرّ حامله — لا تخمين */
    const r = await resultByCode(db, code); return r ? NextResponse.json({ ok: true, ...r }, { headers: NO }) : bad('not_found', 404); }
  return bad('unknown_query', 400);
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('server_not_configured', 500);
  if (crossSiteBrowserWrite(req)) return bad('origin_not_allowed', 403);
  const j = await readJson(req); if (!j.ok) return bad('invalid_json', 400); const body = j.body as Record<string, unknown>;
  const action = String(body.action || '');
  if (action === 'start') {
    const rl = await rateLimit(db, `miaar_start:${ipOf(req)}`, 3600, 10); if (!rl.allowed) return tooMany(rl, 'محاولات بدء كثيرة');
    let invite: { id: string; label_ar: string; exam_mode: 'adaptive' | 'comprehensive'; recipient_id?: string | null; blueprint_id?: string | null } | null = null;
    const inv = body.invite as Record<string, unknown> | undefined;
    if (inv && typeof inv === 'object' && inv.code) {
      const r = await openInvite(db, inv.code, inv.t || null); if (!r.ok) return bad(`invite_${r.error}`, 410);
      invite = { id: r.row.id, label_ar: r.row.label_ar, exam_mode: r.row.exam_mode, recipient_id: r.recipient?.id || null, blueprint_id: r.row.blueprint_id || null };
      if (r.recipient && body.candidate && typeof body.candidate === 'object') (body.candidate as Record<string, unknown>).email = r.recipient.email;  /* الدعوة الشخصية تثبّت البريد */
    }
    const userId = await userOf(req);
    const r = await startSession(db, { candidate: body.candidate, examMode: body.examMode, probeAnswers: body.probeAnswers, access: body.access, invite, userId, blueprint: body.blueprint });
    if (!r.ok) return bad(r.code, r.status);
    return withCookie(NextResponse.json({ ok: true, session: r.value.session, invite: invite ? { label_ar: invite.label_ar } : null }, { headers: NO }), r.value.token, r.value.session.expiresAt);
  }
  const token = cookieOf(req); if (!token) return bad('missing_session', 401);
  const loaded = await loadSession(db, token); if (!loaded) return withCookie(bad('invalid_session', 401), null);
  const { session, answers } = loaded;
  if (action === 'resume') { const r = await resumeSession(db, session, answers); return r.ok ? NextResponse.json({ ok: true, session: r.value }, { headers: NO }) : bad(r.code, r.status); }
  if (action === 'answer') { const r = await answerSession(db, session, body); return r.ok ? NextResponse.json({ ok: true, ...r.value }, { headers: NO }) : bad(r.code, r.status); }
  if (action === 'finish') {
    let label: string | null = null; if (session.invite_id) { const { data } = await db.from('placement_invites').select('label_ar').eq('id', session.invite_id).maybeSingle(); label = data?.label_ar || null; }
    const r = await finishSession(db, session, answers, body.reason, label); if (!r.ok) return bad(r.code, r.status);
    /* الكعكة تبقى حتى انتهاء مدّتها: إعادة تحميل الصفحة تعيد البطاقة نفسها (finish idempotent) */
    return NextResponse.json({ ok: true, report: r.value.report, access_code: r.value.access_code, result_url: r.value.access_code ? `/miaar/result/${r.value.access_code}` : null }, { headers: NO });
  }
  return bad('unknown_action', 400);
}
