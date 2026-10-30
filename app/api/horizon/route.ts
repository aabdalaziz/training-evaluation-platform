// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/horizon — أفق الممارس (P27 · «رسالتي من 2036»)
 *  GET                                   (مستخدم)   → الأهلية · الأفق الجاري · العهد · الدرب · الآفاق السابقة · القواعد
 *  GET  ?view=summary                    (مستخدم/وكيل wallet:read) → ملخص للوكلاء (my_horizon) — بلا نص الأفق
 *  POST { action:'draft', use_ai? }                                  → مسودة «أنا في 2036» (ذكاء اصطناعي من كلماتي أو محلية) — لا تُحفظ
 *  POST { action:'scenario', scenario_ar, source? }                  → حفظ/تحديث الأفق (يُنشئ أفقًا جديدًا إن لم يوجد)
 *  POST { action:'options' }                                          → المهمات الثلاث (تُحفظ على الأفق حتى يُختار منها)
 *  POST { action:'pledge', index, title_ar?, confirm:true }           → توقيع عهد واحد (وثيقة ATH-HZ · 365 يومًا) — الأفق يصبح نشطًا
 *  POST { action:'pledge_revoke', confirm:true }                      → سحب العهد (تُلغى الوثيقة) — الأفق يعود مسودة
 *  POST { action:'review', note_ar, decision:'renew'|'archive', confirm:true } → المراجعة السنوية (ما تغيّر) ثم تجديد أو طيّ
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { delegateFromHeaders } from '../../../lib/portal/oauth';
import { normalizeSite } from '../../../lib/portal/open';
import { randomCode } from '../../../lib/portal/profile';
import { signerFromEnv } from '../../../lib/portal/vc-server';
import { didWeb } from '../../../lib/portal/vc';
import { limitFor, tooMany, ipOf } from '../../../lib/shield/ratelimit';
import { lower } from '../../../lib/councils/registry';
import { loadHorizonState, scenarioDraft } from '../../../lib/horizon/load';
import { signPledge, revokePledge } from '../../../lib/horizon/pledge';
import { HORIZON_VERSION, HORIZON_MIN_CHAPTERS, HORIZON_YEARS, PLEDGE_DAYS, REVIEW_WINDOW_DAYS, MAX_SCENARIO_CHARS, MIN_SCENARIO_CHARS, MAX_REVIEW_CHARS, MAX_PLEDGE_TITLE, PLEDGE_OPTIONS, HORIZON_COLS, PRIVACY_HORIZON_AR, PLEDGE_KIND_AR, addDays, yearTarget, proposePledges, validateScenario, validatePledgeChoice, validateReview, horizonSummary, reviewText } from '../../../lib/horizon/registry';
import type { PledgeOption } from '../../../lib/horizon/registry';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false } }) : null; };
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
type Who = { id: string; email: string; name: string; delegate: boolean };
async function who(req: Request, db: any): Promise<Who | null> {
  const dg = delegateFromHeaders(req.headers, process.env); if (dg && (dg.scopes as string[]).includes('wallet:read')) return { id: dg.id, email: lower(dg.email), name: dg.name, delegate: true };
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !U || !A) return null; const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('full_name').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: lower(data.user.email), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || ''), delegate: false };
}
const RULES = { version: HORIZON_VERSION, min_chapters: HORIZON_MIN_CHAPTERS, years: HORIZON_YEARS, pledge_days: PLEDGE_DAYS, review_window_days: REVIEW_WINDOW_DAYS, scenario_min: MIN_SCENARIO_CHARS, scenario_max: MAX_SCENARIO_CHARS, review_max: MAX_REVIEW_CHARS, pledge_title_max: MAX_PLEDGE_TITLE, options: PLEDGE_OPTIONS, kinds_ar: PLEDGE_KIND_AR, privacy_ar: PRIVACY_HORIZON_AR };

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const u = new URL(req.url); const site = siteOf(req);
  const me = await who(req, db); if (!me) return bad('سجّل الدخول', 401);
  const st = await loadHorizonState(db, me);
  if (u.searchParams.get('view') === 'summary') return NextResponse.json({ success: true, summary: horizonSummary(st.horizon, st.pledge, st.path, st.elig) }, { headers: { 'Cache-Control': 'no-store' } });
  const reviewOpen = !!st.horizon && (st.horizon.status === 'review' || (st.horizon.status === 'active' && !!st.horizon.review_at && new Date(st.horizon.review_at).getTime() <= Date.now()));
  const review_text = reviewOpen && st.pledge && st.path ? (st.horizon?.meta?.review_text || reviewText(me.name, st.pledge, st.path, Number(st.horizon?.meta?.chapters_then ?? 0), st.chapters.length)) : null;
  return NextResponse.json({ success: true, me: { id: me.id, email: me.email, name: me.name, delegate: me.delegate }, eligible: st.elig, year_target: st.horizon?.year_target || yearTarget(), horizon: st.horizon, pledge: st.pledge ? { ...st.pledge, verify_url: st.pledge.vc_issuance_id && st.pledge.code ? `${site}/verify/vc?code=${encodeURIComponent(st.pledge.code)}` : null } : null, path: st.path, review_open: reviewOpen, review_text, past: st.past, chapters: st.chapters.length, rules: { ...RULES, signing_ready: !!process.env.VC_SIGNING_KEY } }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const site = siteOf(req);
  const me = await who(req, db); if (!me) return bad('سجّل الدخول', 401); if (me.delegate) return bad('الوكيل يقرأ الأفق فقط — الكتابة والعهد لصاحبه', 403);
  { const rl = await limitFor(db, 'council_write_ip', ipOf(req)); if (!rl.allowed) return tooMany(rl); }
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ } const action = String(body.action || ''); const now = new Date();
  const st = await loadHorizonState(db, me, now.getTime()); const h = st.horizon;
  if (action === 'draft') {
    if (!st.elig.ok) return bad(st.elig.read_ar, 409);
    const { data: notes } = await db.from('portal_journey_notes').select('body_ar').eq('user_id', me.id).limit(50);
    const r = await scenarioDraft(db, me, st.chapters, ((notes || []) as any[]).map(n => String(n.body_ar || '')), h?.year_target || yearTarget(now.getTime()), body.use_ai !== false);
    return NextResponse.json({ success: true, draft: r, note_ar: r.source === 'ai' ? 'صيغت بالذكاء الاصطناعي من فصولك وكلماتك — عدّل كل كلمة قبل أن تعتمدها؛ لا تُحفظ إلا بقرارك.' : 'صيغت محليًا من فصولك وكلماتك — عدّلها كما تشاء.' });
  }
  if (action === 'scenario') {
    if (!st.elig.ok) return bad(st.elig.read_ar, 409);
    const err = validateScenario(body); if (err) return bad(err);
    const source = body.source === 'ai' || body.source === 'local' ? body.source : 'own'; const text = String(body.scenario_ar).trim();
    if (h) { const { data, error } = await db.from('portal_horizons').update({ scenario_ar: text, scenario_source: source, updated_at: now.toISOString() }).eq('id', h.id).select(HORIZON_COLS).single(); if (error) return bad(error.message, 500); return NextResponse.json({ success: true, horizon: data, message: 'حُفظ أفقك — بصوتك، ولا يراه غيرك.' }); }
    const { data, error } = await db.from('portal_horizons').insert({ user_id: me.id, email: me.email, full_name: me.name || null, year_target: yearTarget(now.getTime()), scenario_ar: text, scenario_source: source, status: 'draft', options: [], meta: { chapters_at_write: st.chapters.length } }).select(HORIZON_COLS).single();
    if (error || !data) return bad(error?.message || 'تعذّر الحفظ', 500);
    await db.from('portal_learning_events').insert({ user_id: me.id, email: me.email, verb: 'wrote', object_type: 'horizon', object_id: String((data as any).id), skills: [], context: { year: (data as any).year_target, chars: text.length, source } }).then(() => null, () => null);
    return NextResponse.json({ success: true, horizon: data, message: `كُتب أفقك لسنة ${(data as any).year_target} — الخطوة التالية: ثلاث خطوات لسنة واحدة.` });
  }
  if (action === 'options') {
    if (!h) return bad('اكتب أفقك أولًا — لا خطوات بلا أفق', 409); if (h.status !== 'draft') return bad('لديك عهد نشط — المهمات تُقترح بعد المراجعة', 409);
    const options = proposePledges(st.chapters, st.input); const { data, error } = await db.from('portal_horizons').update({ options, updated_at: now.toISOString() }).eq('id', h.id).select(HORIZON_COLS).single(); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true, horizon: data, options, note_ar: 'ثلاث خطوات تعرفها المنصة — اختر واحدة فقط، وعدّل صياغتها إن شئت.' });
  }
  if (action === 'pledge') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (!h) return bad('اكتب أفقك أولًا', 409); if (h.status !== 'draft') return bad('لديك عهد نشط بالفعل — عهد واحد في كل سنة', 409);
    const options = (h.options || []) as PledgeOption[]; if (!options.length) return bad('اطلب المهمات الثلاث أولًا', 409);
    const err = validatePledgeChoice(body, options); if (err) return bad(err);
    const opt = { ...options[Number(body.index)] }; if (body.title_ar) opt.title_ar = String(body.title_ar).trim();
    const r = await signPledge(db, me, h.id, opt, h.year_target, signerFromEnv(process.env, site), site, didWeb(site), () => randomCode(4), now); if (!r.ok) return bad(r.error, 409);
    const review_at = addDays(now, PLEDGE_DAYS);
    const { data } = await db.from('portal_horizons').update({ status: 'active', activated_at: now.toISOString(), review_at, updated_at: now.toISOString(), meta: { ...(h.meta || {}), chapters_then: st.chapters.length, pledge_code: r.pledge.code } }).eq('id', h.id).select(HORIZON_COLS).single();
    return NextResponse.json({ success: true, horizon: data, pledge: { ...r.pledge, verify_url: r.verify_url }, signed_vc: r.signed_vc, message: `وُقّع عهدك — المراجعة في ${new Date(review_at).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'long' })}. الدرب يُكتب من أفعالك لا من أقوالك.` });
  }
  if (action === 'pledge_revoke') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (!h || !st.pledge) return bad('لا عهد نشط', 409);
    const r = await revokePledge(db, me, st.pledge.id, now); if (!r.ok) return bad(r.error || 'تعذّر', 409);
    await db.from('portal_horizons').update({ status: 'draft', activated_at: null, review_at: null, updated_at: now.toISOString(), meta: { ...(h.meta || {}), revoked_pledge_at: now.toISOString() } }).eq('id', h.id);
    return NextResponse.json({ success: true, message: 'سُحب العهد وأُلغيت وثيقته — أفقك باقٍ لك.' });
  }
  if (action === 'review') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (!h || !st.pledge) return bad('لا عهد يُراجَع', 409);
    const open = h.status === 'review' || (h.status === 'active' && !!h.review_at && new Date(h.review_at).getTime() <= now.getTime()); if (!open) return bad(`المراجعة تُفتح في ${h.review_at ? new Date(h.review_at).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'long' }) : 'موعدها'}`, 409);
    const err = validateReview(body); if (err) return bad(err);
    const note = String(body.note_ar).trim(); const decision = body.decision as 'renew' | 'archive'; const path = st.path;
    const { error } = await db.from('portal_horizons').update({ status: decision === 'renew' ? 'renewed' : 'archived', decision, reviewed_at: now.toISOString(), review_note_ar: note, updated_at: now.toISOString(), meta: { ...(h.meta || {}), path_at_review: path, chapters_now: st.chapters.length } }).eq('id', h.id); if (error) return bad(error.message, 500);
    await db.from('portal_horizon_pledges').update({ status: 'reviewed' }).eq('id', st.pledge.id);
    await db.from('portal_learning_events').insert({ user_id: me.id, email: me.email, verb: 'reviewed', object_type: 'horizon', object_id: h.id, skills: [], context: { decision, complete: !!path?.complete, title: st.pledge.title_ar, note_ar: note.slice(0, 220) } }).then(() => null, () => null);
    let next: any = null;
    if (decision === 'renew') { const { data } = await db.from('portal_horizons').insert({ user_id: me.id, email: me.email, full_name: me.name || null, year_target: h.year_target, scenario_ar: h.scenario_ar, scenario_source: 'own', status: 'draft', options: [], meta: { renewed_from: h.id, chapters_at_write: st.chapters.length } }).select(HORIZON_COLS).single(); next = data; }
    return NextResponse.json({ success: true, horizon: next, message: decision === 'renew' ? 'راجعتَ عهدك وجدّدت أفقك — عدّل الأفق إن شئت ثم اختر عهد السنة القادمة.' : 'راجعتَ عهدك وطويتَ هذا الأفق — صار فصلًا في رحلتك. يمكنك كتابة أفق جديد متى شئت.' });
  }
  return bad('إجراء غير معروف');
}
