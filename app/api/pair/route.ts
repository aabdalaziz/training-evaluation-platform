// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/pair — العهد المتقابل (P29 · «عهدان متقابلان — خطوة لك وخطوة لي»)
 *  GET                                   (مستخدم)   → أهليتي · عهدي الحيّ (بزاويتي) · دعواتي الواردة/الصادرة · الدربان (حالة صاحبي فقط) · المرآة · المراجعة · القواعد
 *  GET  ?view=summary                    (مستخدم/وكيل wallet:read) → ملخص للوكلاء (داخل my_horizon) — بلا أسماء
 *  POST { action:'invite', email, why_ar, name_mode? }               → دعوة زميل من دائرتي (الردّ واحد دائمًا — لا يكشف عضوية أحد)
 *  POST { action:'cancel', confirm:true }                            → سحب دعوتي الصادرة
 *  POST { action:'accept', id, name_mode?, confirm:true }            → قبول الدعوة (يلزم 3 فصول) → مرحلة الاقتراح
 *  POST { action:'decline', id, confirm:true }                       → رفض بلا تعليل
 *  POST { action:'suggest' }                                          → خيارات المنصة لخطوة صاحبي (من فصوله هو)
 *  POST { action:'propose', index, title_ar?, why_ar }               → «خطوة أطلبها منك» لصاحبي
 *  POST { action:'rework', confirm:true }                             → «اطلب مني غيرها» (مرة واحدة)
 *  POST { action:'sign', title_ar?, confirm:true }                    → أوقّع على ما طُلب مني — حين يوقّع الطرفان تُصدر وثيقة ATH-MP واحدة
 *  POST { action:'revoke', confirm:true }                             → سحب العهد من أيّ طرف (تُسحب الوثيقة)
 *  POST { action:'review', note_ar, decision:'renew'|'close', confirm:true } → مراجعتي المشتركة — كلمات صاحبي تُفتح بعد كلماتي
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { delegateFromHeaders } from '../../../lib/portal/oauth';
import { normalizeSite } from '../../../lib/portal/open';
import { randomCode } from '../../../lib/portal/profile';
import { signerFromEnv } from '../../../lib/portal/vc-server';
import { didWeb } from '../../../lib/portal/vc';
import { notify } from '../../../lib/portal/notify';
import { limitFor, tooMany, ipOf } from '../../../lib/shield/ratelimit';
import { lower } from '../../../lib/councils/registry';
import { loadPairState, resolvePerson, findCircle, personChapters, loadMyPairs, splitPairs } from '../../../lib/pair/load';
import { activatePair, revokePair } from '../../../lib/pair/pledge';
import { PAIR_VERSION, PAIR_MIN_CHAPTERS, PAIR_INVITE_DAYS, PAIR_PROPOSE_DAYS, PAIR_PLEDGE_DAYS, PAIR_REVIEW_WINDOW_DAYS, PAIR_WHY_MIN, PAIR_WHY_MAX, PAIR_TITLE_MAX, PAIR_REVIEW_MIN, PAIR_REVIEW_MAX, PAIR_REWORK_MAX, PAIR_COLS, PAIR_KIND_AR, CIRCLE_AR, PRIVACY_PAIR_AR, sideOf, other, nameFor, stepFor, pairEligibility, suggestForPartner, validateInvite, validateProposal, validateSign, validatePairReview, pairMirror, pairReviewText, meetsHorizon, jointDecision, reviewOpen, viewFor, pairSummary, stepState } from '../../../lib/pair/registry';
import type { Pair, Side, PairStep } from '../../../lib/pair/registry';
import type { PledgeOption } from '../../../lib/horizon/registry';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false } }) : null; };
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
const NIL = '00000000-0000-0000-0000-000000000000';
type Who = { id: string; email: string; name: string; delegate: boolean };
async function who(req: Request, db: any): Promise<Who | null> {
  const dg = delegateFromHeaders(req.headers, process.env); if (dg && (dg.scopes as string[]).includes('wallet:read')) return { id: dg.id, email: lower(dg.email), name: dg.name, delegate: true };
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !U || !A) return null; const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('full_name').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: lower(data.user.email), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || ''), delegate: false };
}
const RULES = { version: PAIR_VERSION, min_chapters: PAIR_MIN_CHAPTERS, invite_days: PAIR_INVITE_DAYS, propose_days: PAIR_PROPOSE_DAYS, pledge_days: PAIR_PLEDGE_DAYS, review_window_days: PAIR_REVIEW_WINDOW_DAYS, why_min: PAIR_WHY_MIN, why_max: PAIR_WHY_MAX, title_max: PAIR_TITLE_MAX, review_min: PAIR_REVIEW_MIN, review_max: PAIR_REVIEW_MAX, rework_max: PAIR_REWORK_MAX, kinds_ar: PAIR_KIND_AR, circles_ar: CIRCLE_AR, privacy: PRIVACY_PAIR_AR };
const INVITE_REPLY = `أُرسلت دعوتك. إن كان زميلك في دائرتك وكانت رحلته تسمح، سيصلك ردّه خلال ${PAIR_INVITE_DAYS} يومًا — وإلا انقضت الدعوة بصمت.`;
const partyOf = (p: Pair, s: Side) => (s === 'a' ? { email: p.a_email, name: p.a_name } : { email: p.b_email, name: p.b_name });
const fmtD = (iso: string) => new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'long' });
const inviteView = (p: Pair, me: Who) => { const s = sideOf(p, me); return { id: p.id, status: p.status, invited_at: p.invited_at, circle_kind: p.circle_kind, circle_title: p.circle_title, why_ar: p.invite_why_ar, from_name: nameFor(p, 'a'), from_email: s === 'b' ? p.a_email : null, to_email: s === 'a' ? p.b_email : null, expires_at: new Date(new Date(p.invited_at).getTime() + PAIR_INVITE_DAYS * 864e5).toISOString() }; };

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const u = new URL(req.url); const site = siteOf(req); const now = Date.now();
  const me = await who(req, db); if (!me) return bad('سجّل الدخول', 401);
  const st = await loadPairState(db, me, now);
  if (u.searchParams.get('view') === 'summary') return NextResponse.json({ success: true, summary: pairSummary(st.live, st.side, st.my_state, st.partner_state, st.invites_in.length) }, { headers: { 'Cache-Control': 'no-store' } });
  const p = st.live; const side = st.side;
  const view = p && side ? viewFor(p, side) : null;
  const rOpen = !!p && reviewOpen(p, now); const myStep = p && side ? stepFor(p, side) : null; const ptStep = p && side ? stepFor(p, other(side)) : null;
  const review_text = rOpen && p && side && myStep && ptStep && p.signed_at ? pairReviewText({ name: nameFor(p, side), step: myStep, state: st.my_state || stepState(null) }, { name: nameFor(p, other(side)), step: ptStep, state: st.partner_state || stepState(null) }, p.signed_at, Number(p.meta?.chapters_then?.[side] ?? 0), st.chapters) : null;
  const mirror = p && side && p.signed_at && st.my_state && st.partner_state ? pairMirror(p.signed_at, st.my_state, st.partner_state, nameFor(p, other(side)), now) : null;
  const options = p && side && p.status === 'proposing' ? ((p.meta || {})[`options_for_${other(side)}`] || null) : null;
  return NextResponse.json({ success: true, me: { id: me.id, email: me.email, name: me.name, delegate: me.delegate }, eligible: st.eligible, chapters: st.chapters,
    pair: view ? { ...view, verify_url: view.vc_issuance_id && view.code ? `${site}/verify/vc?code=${encodeURIComponent(view.code)}` : null, options, my_rework_left: Math.max(0, PAIR_REWORK_MAX - Number((p!.meta || {})[`rework_${side}`] || 0)) } : null,
    invites_in: st.invites_in.map(i => inviteView(i, me)), invite_out: st.invite_out ? inviteView(st.invite_out, me) : null,
    my_path: st.my_path, my_state: st.my_state, partner_state: st.partner_state, mirror, review_open: rOpen, review_text, meets_horizon: meetsHorizon(myStep, st.horizon_kind), horizon_kind: st.horizon_kind,
    past: st.past.map(x => { const s = sideOf(x, me) || 'a'; const v = viewFor(x, s); return { id: v.id, status: v.status, code: v.code, circle_kind: v.circle_kind, circle_title: v.circle_title, partner_name: v.partner_name, my_step: stepFor(x, s), partner_step: stepFor(x, other(s)), signed_at: v.signed_at, reviewed_at: v.reviewed_at, my_review_ar: s === 'a' ? v.a_review_ar : v.b_review_ar, partner_review_ar: v.partner_review_ar, my_decision: s === 'a' ? v.a_decision : v.b_decision, verify_url: v.vc_issuance_id && v.code ? `${site}/verify/vc?code=${encodeURIComponent(v.code)}` : null }; }),
    rules: RULES }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const site = siteOf(req); const url = `${site}/me/pair`;
  const me = await who(req, db); if (!me) return bad('سجّل الدخول', 401); if (me.delegate) return bad('الوكيل يقرأ العهد فقط — الدعوة والتوقيع لصاحبه', 403);
  { const rl = await limitFor(db, 'council_write_ip', ipOf(req)); if (!rl.allowed) return tooMany(rl); }
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ } const action = String(body.action || ''); const now = new Date(); const iso = now.toISOString();
  const st = await loadPairState(db, me, now.getTime()); const p = st.live; const side = st.side;
  const tell = (to: { email: string; name: string | null }, kind: string, subject: string, text: string, ref: string) => notify(db, { kind, to, subject, text: `${text}\n\n${url}`, url, ref }, { now }).then(() => null, () => null);
  const save = async (id: string, patch: Record<string, unknown>) => { const { data, error } = await db.from('portal_pair_pledges').update({ ...patch, updated_at: iso }).eq('id', id).select(PAIR_COLS).single(); return { row: data as Pair | null, error }; };

  if (action === 'invite') {
    if (!st.eligible.ok) return bad(st.eligible.read_ar, 409);
    if (p) return bad('لديك عهد متقابل حيّ — عهد واحد في كل مرة', 409); if (st.invite_out) return bad('لديك دعوة قائمة — اسحبها أولًا أو انتظر ردّها', 409);
    const err = validateInvite(body, me.email); if (err) return bad(err);
    const email = lower(String(body.email)); const nameMode = String(body.name_mode || 'first');
    const person = await resolvePerson(db, email);
    const circle = person.found ? await findCircle(db, me, person) : null;
    let blind: string | null = !person.found ? 'not_found' : !circle ? 'not_in_circle' : null;
    if (!blind) { const pm = { id: person.id, email: person.email }; const theirs = splitPairs(await loadMyPairs(db, pm), pm, now.getTime()); if (theirs.live) blind = 'already_paired'; else { const ch = await personChapters(db, person); if (!pairEligibility(ch.chapters).ok) blind = 'not_eligible'; } }
    const row = { status: 'invited', circle_kind: circle?.kind || 'org', circle_id: circle?.id || NIL, circle_title: circle?.title || null, a_user_id: me.id, a_email: me.email, a_name: me.name || null, a_name_mode: nameMode, b_user_id: person.found ? person.id : null, b_email: email, b_name: person.name, invite_why_ar: String(body.why_ar).trim(), invited_at: iso, meta: { version: PAIR_VERSION, ...(blind ? { blind: true, blind_reason: blind } : {}), a_chapters: st.chapters } };
    const { data, error } = await db.from('portal_pair_pledges').insert(row).select(PAIR_COLS).single(); if (error || !data) return bad(error?.message || 'تعذّر إرسال الدعوة', 500);
    if (!blind) await tell({ email, name: person.name }, 'pair_invite', `${nameFor(data as Pair, 'a')} يدعوك إلى عهد متقابل`, `${person.name ? `${person.name}، ` : ''}${nameFor(data as Pair, 'a')} — من ${CIRCLE_AR[(data as Pair).circle_kind]}${(data as Pair).circle_title ? ` «${(data as Pair).circle_title}»` : ''} — يدعوك إلى عهد متقابل لسنة: خطوة يطلبها منك وخطوة تطلبها منه. كتب لك: «${row.invite_why_ar}». الدعوة مفتوحة ${PAIR_INVITE_DAYS} يومًا.`, `pair:${(data as Pair).id}:invite`);
    return NextResponse.json({ success: true, invite: inviteView(data as Pair, me), message: INVITE_REPLY });
  }
  if (action === 'cancel') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (!st.invite_out) return bad('لا دعوة قائمة', 409);
    const { error } = await save(st.invite_out.id, { status: 'expired', meta: { ...(st.invite_out.meta || {}), cancelled_at: iso } }); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true, message: 'سُحبت الدعوة بصمت.' });
  }
  if (action === 'accept' || action === 'decline') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح'); const inv = st.invites_in.find(i => i.id === String(body.id || '')); if (!inv) return bad('الدعوة غير موجودة أو انقضت', 404);
    if (action === 'decline') { const { error } = await save(inv.id, { status: 'declined', meta: { ...(inv.meta || {}), declined_at: iso } }); if (error) return bad(error.message, 500); await tell(partyOf(inv, 'a'), 'pair_declined', 'لم يكتمل العهد هذه المرة', `${inv.a_name ? `${inv.a_name}، ` : ''}لم يكتمل عهدك المتقابل هذه المرة. الدعوة تبقى لك متى شئت — مع زميل آخر من دائرتك.`, `pair:${inv.id}:declined`); return NextResponse.json({ success: true, message: 'رُفضت الدعوة بلا تعليل — وهذا حقك.' }); }
    if (!st.eligible.ok) return bad(st.eligible.read_ar, 409); if (p) return bad('لديك عهد متقابل حيّ — عهد واحد في كل مرة', 409);
    if (body.name_mode !== undefined && !['full', 'first', 'anon'].includes(String(body.name_mode))) return bad('وضع الاسم: full أو first أو anon');
    const { row, error } = await save(inv.id, { status: 'proposing', accepted_at: iso, b_user_id: me.id, b_name: me.name || inv.b_name, b_name_mode: String(body.name_mode || 'first'), meta: { ...(inv.meta || {}), b_chapters: st.chapters } }); if (error || !row) return bad(error?.message || 'تعذّر القبول', 500);
    await tell(partyOf(row, 'a'), 'pair_accepted', `${nameFor(row, 'b')} قبل دعوتك`, `${row.a_name ? `${row.a_name}، ` : ''}قبل ${nameFor(row, 'b')} دعوتك إلى العهد المتقابل. الآن: اقترح له خطوة واحدة من الخطوات التي تشهدها المنصة، واكتب لماذا — ولديكما ${PAIR_PROPOSE_DAYS} يومًا حتى يكتمل التوقيعان.`, `pair:${row.id}:accepted`);
    return NextResponse.json({ success: true, pair: viewFor(row, 'b'), message: `قبلتَ. الآن اقترح لـ${nameFor(row, 'a')} خطوة واحدة — وهو يقترح لك.` });
  }
  if (!p || !side) return bad('لا عهد متقابل حيًّا لديك', 409);
  const o = other(side); const partner = partyOf(p, o); const pName = nameFor(p, o);
  if (action === 'suggest') {
    if (p.status !== 'proposing') return bad('مرحلة الاقتراح انتهت', 409); if (stepFor(p, o)) return bad(`اقترحتَ خطوة لـ${pName} بالفعل`, 409);
    const cached = (p.meta || {})[`options_for_${o}`]; if (Array.isArray(cached) && cached.length) return NextResponse.json({ success: true, options: cached });
    const other_ = o === 'a' ? { id: p.a_user_id, email: p.a_email } : { id: p.b_user_id || NIL, email: p.b_email };
    const ch = await personChapters(db, other_); const options = suggestForPartner(ch.chapters, ch.input);
    await save(p.id, { meta: { ...(p.meta || {}), [`options_for_${o}`]: options } });
    return NextResponse.json({ success: true, options });
  }
  if (action === 'propose') {
    if (p.status !== 'proposing') return bad('مرحلة الاقتراح انتهت', 409); if (stepFor(p, o)) return bad(`اقترحتَ خطوة لـ${pName} بالفعل — انتظر توقيعه أو طلبه غيرها`, 409);
    const options = ((p.meta || {})[`options_for_${o}`] || []) as PledgeOption[]; if (!options.length) return bad('اطلب خيارات الخطوة أولًا', 409);
    const err = validateProposal(body, options); if (err) return bad(err);
    const opt = options[Number(body.index)]; const step: PairStep = { kind: opt.kind, title_ar: body.title_ar ? String(body.title_ar).trim() : opt.title_ar, why_ar: String(body.why_ar).trim(), target: opt.target, proposed_by: side, proposed_at: iso, accepted_at: null, rework: Number((p.meta || {})[`rework_${o}`] || 0) };
    const { row, error } = await save(p.id, { [`${o}_step`]: step }); if (error || !row) return bad(error?.message || 'تعذّر حفظ الاقتراح', 500);
    await tell(partner, 'pair_proposed', `${nameFor(p, side)} يطلب منك خطوة`, `${partner.name ? `${partner.name}، ` : ''}${nameFor(p, side)} يطلب منك لسنة: «${step.title_ar}». وكتب لك: «${step.why_ar}». اقرأ، ثم وقّع — أو اطلب غيرها مرة واحدة.`, `pair:${p.id}:proposed:${o}`);
    return NextResponse.json({ success: true, pair: viewFor(row, side), message: `أُرسلت خطوتك لـ${pName}. ${stepFor(p, side) ? 'والآن وقّع على ما طلبه منك.' : `وننتظر ما يطلبه منك.`}` });
  }
  if (action === 'rework') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (p.status !== 'proposing') return bad('مرحلة الاقتراح انتهت', 409);
    const mine = stepFor(p, side); if (!mine) return bad('لم يطلب منك شيء بعد', 409); if (mine.accepted_at) return bad('وقّعتَ بالفعل', 409);
    const used = Number((p.meta || {})[`rework_${side}`] || 0); if (used >= PAIR_REWORK_MAX) return bad('طلبتَ غيرها من قبل — هذه المرة إمّا توقيع وإمّا سحب', 409);
    const { row, error } = await save(p.id, { [`${side}_step`]: null, meta: { ...(p.meta || {}), [`rework_${side}`]: used + 1, [`rework_${side}_was`]: mine } }); if (error || !row) return bad(error?.message || 'تعذّر', 500);
    await tell(partner, 'pair_rework', `${nameFor(p, side)} يطلب خطوة غيرها`, `${partner.name ? `${partner.name}، ` : ''}قرأ ${nameFor(p, side)} ما طلبتَه: «${mine.title_ar}» — ويطلب منك خطوة غيرها (مرة واحدة). اقترح من جديد.`, `pair:${p.id}:rework:${side}`);
    return NextResponse.json({ success: true, pair: viewFor(row, side), message: `طلبتَ من ${pName} خطوة غيرها — مرة واحدة.` });
  }
  if (action === 'sign') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (p.status !== 'proposing') return bad('العهد ليس في مرحلة التوقيع', 409);
    const mine = stepFor(p, side); if (!mine) return bad(`لم يطلب منك ${pName} خطوة بعد`, 409); if (mine.accepted_at) return bad('وقّعتَ بالفعل — ننتظر توقيع صاحبك', 409);
    const err = validateSign(body); if (err) return bad(err);
    const step: PairStep = { ...mine, accepted_at: iso, title_ar: body.title_ar ? String(body.title_ar).trim() : mine.title_ar };
    const bothSigned = !!(o === 'a' ? p.a_signed_at : p.b_signed_at);
    const { row, error } = await save(p.id, { [`${side}_step`]: step, [`${side}_signed_at`]: iso, meta: { ...(p.meta || {}), chapters_then: { ...((p.meta || {}).chapters_then || {}), [side]: st.chapters } } }); if (error || !row) return bad(error?.message || 'تعذّر التوقيع', 500);
    if (!bothSigned) { await tell(partner, 'pair_signed', `${nameFor(p, side)} وقّع`, `${partner.name ? `${partner.name}، ` : ''}وقّع ${nameFor(p, side)} على ما طلبتَه منه. بقي توقيعك${stepFor(row, o) ? '' : ' — بعد أن يطلب منك خطوته'}.`, `pair:${p.id}:signed:${side}`); return NextResponse.json({ success: true, pair: viewFor(row, side), signed: 'one', message: `وقّعتَ على خطوتك. حين يوقّع ${pName} تُصدر وثيقتكما الواحدة.` }); }
    const r = await activatePair(db, row, signerFromEnv(process.env, site), site, didWeb(site), () => randomCode(4), now); if (!r.ok) return bad(r.error, 500);
    for (const s of ['a', 'b'] as Side[]) await tell(partyOf(r.pair, s), 'pair_active', 'وُقّع عهدكما — وثيقة واحدة بتوقيعين', `${partyOf(r.pair, s).name ? `${partyOf(r.pair, s).name}، ` : ''}اكتمل التوقيعان. عهدك مع ${nameFor(r.pair, other(s))} حيّ حتى ${fmtD(r.pair.review_at!)} — والدرب يُكتب من أفعالكما لا من أقوالكما.${r.verify_url ? `\nالوثيقة: ${r.verify_url}` : ''}`, `pair:${p.id}:active:${s}`);
    return NextResponse.json({ success: true, pair: { ...viewFor(r.pair, side), verify_url: r.verify_url }, signed: 'both', signed_vc: r.signed_vc, message: `وُقّع عهدكما — المراجعة المشتركة في ${fmtD(r.pair.review_at!)}.` });
  }
  if (action === 'revoke') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح'); const r = await revokePair(db, p, now); if (!r.ok) return bad(r.error || 'تعذّر', 409);
    await tell(partner, 'pair_revoked', `${nameFor(p, side)} سحب العهد`, `${partner.name ? `${partner.name}، ` : ''}سحب ${nameFor(p, side)} عهدكما المتقابل${p.code ? ` (${p.code})` : ''}. سُحبت الوثيقة. لا تعليل مطلوب — والدعوة تبقى لكما متى شئتما.`, `pair:${p.id}:revoked`);
    await db.from('portal_learning_events').insert({ user_id: me.id, email: me.email, verb: 'revoked', object_type: 'pair', object_id: p.id, skills: [], context: { code: p.code } }).then(() => null, () => null);
    return NextResponse.json({ success: true, message: 'سُحب العهد وسُحبت الوثيقة.' });
  }
  if (action === 'review') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (!reviewOpen(p, now.getTime())) return bad('المراجعة المشتركة تُفتح بعد سنة من التوقيع', 409);
    if (side === 'a' ? p.a_reviewed_at : p.b_reviewed_at) return bad('كتبتَ مراجعتك بالفعل', 409);
    const err = validatePairReview(body); if (err) return bad(err);
    const decision = body.decision as 'renew' | 'close'; const patch: Record<string, unknown> = { status: 'review', [`${side}_review_ar`]: String(body.note_ar).trim(), [`${side}_reviewed_at`]: iso, [`${side}_decision`]: decision, meta: { ...(p.meta || {}), review_opened_at: (p.meta || {}).review_opened_at || iso } };
    const joint = jointDecision(side === 'a' ? decision : p.a_decision, side === 'b' ? decision : p.b_decision);
    if (joint) { patch.status = joint === 'renew' ? 'renewed' : 'closed'; patch.reviewed_at = iso; }
    const { row, error } = await save(p.id, patch); if (error || !row) return bad(error?.message || 'تعذّر حفظ المراجعة', 500);
    await db.from('portal_learning_events').insert({ user_id: me.id, email: me.email, verb: 'reviewed', object_type: 'pair', object_id: p.id, skills: [], context: { code: p.code, decision, complete: !!st.my_state?.complete, circle: p.circle_kind } }).then(() => null, () => null);
    let next: Pair | null = null;
    if (joint === 'renew') {
      const { data } = await db.from('portal_pair_pledges').insert({ status: 'proposing', circle_kind: row.circle_kind, circle_id: row.circle_id, circle_title: row.circle_title, a_user_id: row.a_user_id, a_email: row.a_email, a_name: row.a_name, a_name_mode: row.a_name_mode, b_user_id: row.b_user_id, b_email: row.b_email, b_name: row.b_name, b_name_mode: row.b_name_mode, invite_why_ar: 'تجديد بعد سنة — قرّرتما معًا', invited_at: iso, accepted_at: iso, meta: { version: PAIR_VERSION, renewed_from: row.id } }).select(PAIR_COLS).single(); next = (data as Pair) || null;
      for (const s of ['a', 'b'] as Side[]) await tell(partyOf(row, s), 'pair_renewed', 'قرّرتما التجديد — سنة جديدة، خطوتان جديدتان', `${partyOf(row, s).name ? `${partyOf(row, s).name}، ` : ''}قرّرتما معًا تجديد عهدكما. اقترح لصاحبك خطوة جديدة لسنة جديدة — ولديكما ${PAIR_PROPOSE_DAYS} يومًا.`, `pair:${row.id}:renewed:${s}`);
    } else if (joint === 'close') { for (const s of ['a', 'b'] as Side[]) await tell(partyOf(row, s), 'pair_closed', 'طُوي عهدكما — بكلماتكما', `${partyOf(row, s).name ? `${partyOf(row, s).name}، ` : ''}اكتملت مراجعتكما وطُوي العهد. ما كتبه كلٌّ منكما للآخر محفوظ لكما في «عهودي السابقة».`, `pair:${row.id}:closed:${s}`); }
    else await tell(partner, 'pair_reviewed', `${nameFor(p, side)} كتب مراجعته`, `${partner.name ? `${partner.name}، ` : ''}كتب ${nameFor(p, side)} ما تغيّر فيه بسببك — ولن تقرأه حتى تكتب ما تغيّر فيك بسببه. ${PAIR_REVIEW_WINDOW_DAYS} يومًا من فتح المراجعة.`, `pair:${p.id}:reviewed:${side}`);
    const v = viewFor(row, side);
    return NextResponse.json({ success: true, pair: v, partner_review_ar: v.partner_review_ar, joint, next: next ? viewFor(next, side) : null, message: joint === 'renew' ? 'قرّرتما التجديد — عهد جديد في مرحلة الاقتراح.' : joint === 'close' ? 'طُوي العهد بكلماتكما.' : `حُفظت كلماتك. تُفتح كلمات ${pName} حين يكتب.` });
  }
  return bad('إجراء غير معروف');
}
