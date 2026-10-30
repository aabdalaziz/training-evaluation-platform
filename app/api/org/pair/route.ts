// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/org/pair — عهد الممارس وجهته (P30 · «خطوة مني وخطوة من جهتي»)
 *  GET  ?mine=1 (افتراضي)       (منسوب/وكيل wallet:read) → جهتي وميثاقها · أهليتي · عهدي الحيّ (بزاوية المنسوب) · طلبي الصادر · دعوة الجهة الواردة · دربي كاملًا وحالة خطوة الجهة · المرآة · المراجعة · السابقة · القواعد
 *  GET  ?view=summary           → ملخص للوكلاء (داخل my_horizon)
 *  GET  ?org=<id>               (مدير الجهة أو الطاقم للقراءة) → عهود الجهة كلها بزاوية الجهة (حالة خطوة المنسوب فقط) · طلبات المنسوبين · منسوبون يمكن دعوتهم · القواعد
 *  POST { as:'member', action }  request{why_ar,name_mode} · cancel · accept{id,name_mode} · decline{id} · suggest · propose{index,title_ar?,why_ar} · rework · sign{title_ar?} · revoke · review{note_ar,decision}
 *  POST { as:'org', org, action } invite{member_email,why_ar} · cancel{id} · accept{id} · decline{id} · suggest{id} · propose{id,index,title_ar?,why_ar} · rework{id} · sign{id,title_ar?} · revoke{id} · review{id,note_ar,decision}
 *  كل ما يوقّع/يسحب/يراجع يتطلب confirm:true. الطاقم يقرأ ولا يكتب. مدير الجهة لا يوقّع عهدًا هو منسوبه.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { delegateFromHeaders } from '../../../../lib/portal/oauth';
import { normalizeSite } from '../../../../lib/portal/open';
import { randomCode } from '../../../../lib/portal/profile';
import { signerFromEnv } from '../../../../lib/portal/vc-server';
import { didWeb } from '../../../../lib/portal/vc';
import { notify } from '../../../../lib/portal/notify';
import { limitFor, tooMany, ipOf } from '../../../../lib/shield/ratelimit';
import { lower } from '../../../../lib/councils/registry';
import { orgCtx, isOrgAdmin } from '../../../../lib/org-impact/auth';
import { loadMemberOrgPairState, loadOrgLite, loadOrgPairs, splitOrgPairs, isConfirmedMember, memberChapters, orgPairPaths, orgAdmins, loadMemberOrgPairs } from '../../../../lib/org-pair/load';
import { activateOrgPair, revokeOrgPair } from '../../../../lib/org-pair/pledge';
import { ORG_PAIR_VERSION, ORG_PAIR_MIN_CHAPTERS, ORG_PAIR_INVITE_DAYS, ORG_PAIR_PROPOSE_DAYS, ORG_PAIR_PLEDGE_DAYS, ORG_PAIR_REVIEW_WINDOW_DAYS, ORG_PAIR_WHY_MIN, ORG_PAIR_WHY_MAX, ORG_PAIR_TITLE_MAX, ORG_PAIR_REVIEW_MIN, ORG_PAIR_REVIEW_MAX, ORG_PAIR_REWORK_MAX, ORG_PAIR_MISSION_SLA_DAYS, ORG_PAIR_COLS, MEMBER_KIND_AR, ORG_STEP_KIND_AR, PRIVACY_ORG_PAIR_AR, memberName, orgName, memberEligibility, orgEligibility, suggestForMember, suggestForOrg, validateOrgInvite, validateOrgProposal, validateOrgSign, validateOrgReview, orgPairMirror, orgPairReviewText, orgReviewOpen, orgViewFor, orgPairSummary, stepState, jointDecision, stepOf, signedOf, reviewedOf, otherSide } from '../../../../lib/org-pair/registry';
import type { OrgPair, OrgSide, MemberStep, OrgStep } from '../../../../lib/org-pair/registry';

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
const RULES = { version: ORG_PAIR_VERSION, min_chapters: ORG_PAIR_MIN_CHAPTERS, invite_days: ORG_PAIR_INVITE_DAYS, propose_days: ORG_PAIR_PROPOSE_DAYS, pledge_days: ORG_PAIR_PLEDGE_DAYS, review_window_days: ORG_PAIR_REVIEW_WINDOW_DAYS, why_min: ORG_PAIR_WHY_MIN, why_max: ORG_PAIR_WHY_MAX, title_max: ORG_PAIR_TITLE_MAX, review_min: ORG_PAIR_REVIEW_MIN, review_max: ORG_PAIR_REVIEW_MAX, rework_max: ORG_PAIR_REWORK_MAX, mission_sla_days: ORG_PAIR_MISSION_SLA_DAYS, member_kinds_ar: MEMBER_KIND_AR, org_kinds_ar: ORG_STEP_KIND_AR, privacy: PRIVACY_ORG_PAIR_AR };
const ORG_INVITE_REPLY = `أُرسلت دعوة الجهة. إن سمحت رحلة المنسوب، سيصلكم ردّه خلال ${ORG_PAIR_INVITE_DAYS} يومًا — وإلا انقضت بصمت.`;
const fmtD = (iso: string) => new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'long' });
const expiresOf = (p: OrgPair) => new Date(new Date(p.invited_at).getTime() + ORG_PAIR_INVITE_DAYS * 864e5).toISOString();
const inviteView = (p: OrgPair) => ({ id: p.id, status: p.status, invited_by: p.invited_by, invited_at: p.invited_at, expires_at: expiresOf(p), why_ar: p.invite_why_ar, member_name: memberName(p), member_email: p.member_email, org_name: orgName(p), organization_id: p.organization_id });
const verifyUrl = (site: string, p: OrgPair) => (p.vc_issuance_id && p.code ? `${site}/verify/vc?code=${encodeURIComponent(p.code)}` : null);
/** عرض عهد لطرف: الطرف الآخر يرى حالة الخطوة فقط */
async function pairView(db: any, p: OrgPair, side: OrgSide, site: string, now: number, chaptersNow: number | null) {
  const paths = await orgPairPaths(db, p, now);
  const { meta: _meta, ...v } = orgViewFor(p, side); const rOpen = orgReviewOpen(p, now);
  const mState = paths.member_state || stepState(null), oState = paths.org_state || stepState(null);
  const mirror = p.signed_at && paths.member_state && paths.org_state ? orgPairMirror(p.signed_at, mState, oState, memberName(p), orgName(p), side, now) : null;
  const review_text = rOpen && p.signed_at && p.member_step && p.org_step ? orgPairReviewText(side, p, mState, oState, Number(p.meta?.chapters_then ?? 0), chaptersNow ?? Number(p.meta?.chapters_then ?? 0)) : null;
  const options = p.status === 'proposing' ? ((p.meta || {})[side === 'member' ? 'options_for_org' : 'options_for_member'] || null) : null;
  return { ...v, verify_url: verifyUrl(site, p), options, my_rework_left: Math.max(0, ORG_PAIR_REWORK_MAX - Number((p.meta || {})[`rework_${side}`] || 0)),
    my_path: side === 'member' ? paths.member_path : paths.org_path, my_state: side === 'member' ? paths.member_state : paths.org_state, partner_state: side === 'member' ? paths.org_state : paths.member_state, mirror, review_open: rOpen, review_text };
}
const pastView = (p: OrgPair, side: OrgSide, site: string) => { const v = orgViewFor(p, side); return { id: v.id, status: v.status, code: v.code, org_name: orgName(p), member_name: memberName(p), member_step: p.member_step, org_step: p.org_step, signed_at: p.signed_at, reviewed_at: p.reviewed_at, my_review_ar: side === 'member' ? p.member_review_ar : p.org_review_ar, partner_review_ar: v.partner_review_ar, my_decision: side === 'member' ? p.member_decision : p.org_decision, verify_url: verifyUrl(site, p) }; };

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const u = new URL(req.url); const site = siteOf(req); const now = Date.now(); const orgId = u.searchParams.get('org');
  if (orgId) {
    const c = await orgCtx(req, orgId); if ('error' in c) return c.error;
    const org = await loadOrgLite(db, orgId); const rows = await loadOrgPairs(db, orgId); const { live: _l, invites, past } = splitOrgPairs(rows, now);
    const lives = rows.filter(p => (p.status === 'proposing' || p.status === 'active' || p.status === 'review'));
    const views = []; for (const p of lives) views.push(await pairView(db, p, 'org', site, now, null));
    const { data: mem } = await db.from('portal_org_members').select('email,full_name,user_id,role').eq('organization_id', orgId).eq('status', 'confirmed').limit(500);
    const busy = new Set(rows.filter(p => p.status === 'invited' || p.status === 'proposing' || p.status === 'active' || p.status === 'review').map(p => lower(p.member_email)));
    const members = ((mem || []) as any[]).filter(m => lower(m.email) !== c.me.email && !busy.has(lower(m.email))).map(m => ({ email: lower(m.email), name: m.full_name || null })).slice(0, 300);
    return NextResponse.json({ success: true, org: org ? { id: org.id, name_ar: org.name_ar, charter: org.charter } : null, org_eligible: orgEligibility(org?.charter || null, now), can_write: !c.me.staff || await isOrgAdmin(db, orgId, c.me), me: { email: c.me.email, name: c.me.name },
      pairs: views, requests_in: invites.filter(p => p.invited_by === 'member').map(inviteView), invites_out: invites.filter(p => p.invited_by === 'org').map(inviteView), past: past.map(p => pastView(p, 'org', site)), members, rules: RULES }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const me = await who(req, db); if (!me) return bad('سجّل الدخول', 401);
  const st = await loadMemberOrgPairState(db, me, now);
  if (u.searchParams.get('view') === 'summary') return NextResponse.json({ success: true, summary: orgPairSummary(st.live, st.paths.member_state, st.paths.org_state, st.invites_in.length) }, { headers: { 'Cache-Control': 'no-store' } });
  const view = st.live ? await pairView(db, st.live, 'member', site, now, st.chapters) : null;
  return NextResponse.json({ success: true, me: { id: me.id, email: me.email, name: me.name, delegate: me.delegate }, org: st.org ? { id: st.org.id, name_ar: st.org.name_ar, charter_ok: st.org_eligible.ok } : null, is_org_admin: st.is_org_admin,
    eligible: st.eligible, org_eligible: st.org_eligible, chapters: st.chapters, chapter_kinds: st.chapter_kinds, pair: view,
    invites_in: st.invites_in.map(inviteView), invite_out: st.invite_out ? inviteView(st.invite_out) : null, past: st.past.map(p => pastView(p, 'member', site)), rules: RULES }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const site = siteOf(req); const mUrl = `${site}/me/pair`;
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ } const action = String(body.action || ''); const as: OrgSide = body.as === 'org' ? 'org' : 'member'; const now = new Date(); const iso = now.toISOString();
  { const rl = await limitFor(db, 'council_write_ip', ipOf(req)); if (!rl.allowed) return tooMany(rl); }
  const save = async (id: string, patch: Record<string, unknown>) => { const { data, error } = await db.from('portal_org_pair_pledges').update({ ...patch, updated_at: iso }).eq('id', id).select(ORG_PAIR_COLS).single(); return { row: data as OrgPair | null, error }; };
  const tellMember = (p: OrgPair, kind: string, subject: string, text: string, ref: string) => notify(db, { kind, to: { email: p.member_email, name: p.member_name }, subject, text: `${text}\n\n${mUrl}`, url: mUrl, ref }, { now }).then(() => null, () => null);
  const tellOrg = async (p: OrgPair, kind: string, subject: string, text: string, ref: string) => { const url = `${site}/org?tab=horizon&org=${p.organization_id}`; for (const a of await orgAdmins(db, p.organization_id)) await notify(db, { kind, to: { email: a.email, name: a.name }, subject, text: `${text}\n\n${url}`, url, ref: `${ref}:${a.email}` }, { now }).then(() => null, () => null); };
  const evt = (p: OrgPair, verb: string, context: any) => db.from('portal_learning_events').insert({ user_id: p.member_user_id, email: lower(p.member_email), verb, object_type: 'org_pair', object_id: p.id, skills: [], context }).then(() => null, () => null);

  // ───────── زاوية الجهة ─────────
  if (as === 'org') {
    const orgId = String(body.org || ''); const c = await orgCtx(req, orgId); if ('error' in c) return c.error;
    if (!(await isOrgAdmin(db, orgId, c.me))) return bad('الطاقم يقرأ عهود الجهة ولا يوقّع عنها — التوقيع لمدير الجهة', 403);
    const org = await loadOrgLite(db, orgId); const oe = orgEligibility(org?.charter || null, now.getTime()); const rows = await loadOrgPairs(db, orgId);
    const byId = (id: unknown) => rows.find(p => p.id === String(id || '')) || null;
    if (action === 'invite') {
      if (!oe.ok) return bad(oe.read_ar, 409);
      const email = lower(String(body.member_email || '')); if (!email.includes('@')) return bad('اختر منسوبًا من قائمة المنسوبين المؤكَّدين');
      if (email === c.me.email) return bad('مدير الجهة لا يعاهد نفسه — العهد مع منسوب آخر', 409);
      const err = validateOrgInvite({ why_ar: body.why_ar }); if (err) return bad(err);
      const mem = await isConfirmedMember(db, orgId, { id: NIL, email }); if (!mem.ok) return bad('هذا البريد ليس منسوبًا مؤكَّدًا في الجهة', 404);
      if (rows.some(p => lower(p.member_email) === email && (p.status === 'invited' || p.status === 'proposing' || p.status === 'active' || p.status === 'review'))) return bad('لهذا المنسوب عهد أو دعوة قائمة مع الجهة', 409);
      const ch = await memberChapters(db, { id: mem.user_id || NIL, email }); const el = memberEligibility(ch.chapters); const blind = el.ok ? null : 'not_eligible';
      const row = { organization_id: orgId, org_name: org?.name_ar || null, status: 'invited', invited_by: 'org', member_user_id: mem.user_id, member_email: email, member_name: mem.name, invite_why_ar: String(body.why_ar).trim(), invited_at: iso, meta: { version: ORG_PAIR_VERSION, invited_by_email: c.me.email, ...(blind ? { blind: true, blind_reason: blind } : {}) } };
      const { data, error } = await db.from('portal_org_pair_pledges').insert(row).select(ORG_PAIR_COLS).single(); if (error || !data) return bad(error?.message || 'تعذّر إرسال الدعوة', 500);
      if (!blind) await tellMember(data as OrgPair, 'org_pair_invite', `${orgName(data as OrgPair)} تدعوك إلى عهد: خطوة منك وخطوة منها`, `${mem.name ? `${mem.name}، ` : ''}جهتك «${orgName(data as OrgPair)}» تدعوك إلى عهد لسنة: خطوة تطلبها منك وخطوة تطلبها أنت منها. كتبت لك: «${row.invite_why_ar}». الدعوة مفتوحة ${ORG_PAIR_INVITE_DAYS} يومًا.`, `org_pair:${(data as OrgPair).id}:invite`);
      return NextResponse.json({ success: true, invite: inviteView(data as OrgPair), message: ORG_INVITE_REPLY });
    }
    const p = byId(body.id); if (!p) return bad('العهد غير موجود', 404);
    if (action === 'cancel') { if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (p.status !== 'invited' || p.invited_by !== 'org') return bad('لا دعوة قائمة', 409); const { error } = await save(p.id, { status: 'expired', meta: { ...(p.meta || {}), cancelled_at: iso } }); if (error) return bad(error.message, 500); return NextResponse.json({ success: true, message: 'سُحبت دعوة الجهة بصمت.' }); }
    if (action === 'accept' || action === 'decline') {
      if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (p.status !== 'invited' || p.invited_by !== 'member') return bad('لا طلب قائمًا من هذا المنسوب', 409);
      if (action === 'decline') { const { error } = await save(p.id, { status: 'declined', meta: { ...(p.meta || {}), declined_at: iso, declined_by: c.me.email } }); if (error) return bad(error.message, 500); await tellMember(p, 'org_pair_declined', 'لم يكتمل العهد مع جهتك هذه المرة', `${p.member_name ? `${p.member_name}، ` : ''}لم تكتمل خطوتك مع جهتك هذه المرة. الطلب يبقى لك متى شئت.`, `org_pair:${p.id}:declined`); return NextResponse.json({ success: true, message: 'اعتذرت الجهة بلا تعليل.' }); }
      if (!oe.ok) return bad(oe.read_ar, 409); if (lower(p.member_email) === c.me.email) return bad('مدير الجهة لا يقبل طلبه هو — يقبله مدير آخر', 409);
      const { row, error } = await save(p.id, { status: 'proposing', accepted_at: iso, meta: { ...(p.meta || {}), accepted_by: c.me.email } }); if (error || !row) return bad(error?.message || 'تعذّر القبول', 500);
      await tellMember(row, 'org_pair_accepted', `${orgName(row)} قبلت طلبك`, `${row.member_name ? `${row.member_name}، ` : ''}قبلت جهتك طلبك. الآن: اقترح لها خطوة واحدة لك من الخطوات التي تشهدها المنصة، واكتب لماذا — ولديكما ${ORG_PAIR_PROPOSE_DAYS} يومًا حتى يكتمل التوقيعان.`, `org_pair:${row.id}:accepted`);
      return NextResponse.json({ success: true, pair: await pairView(db, row, 'org', site, now.getTime(), null), message: `قبلتم. الآن اقترحوا لـ${memberName(row)} خطوة واحدة — وهو يقترح لكم.` });
    }
    if (!(p.status === 'proposing' || p.status === 'active' || p.status === 'review')) return bad('العهد ليس حيًّا', 409);
    if (lower(p.member_email) === c.me.email) return bad('مدير الجهة لا يتصرّف عن الجهة في عهده هو', 409);
    const mName = memberName(p);
    if (action === 'suggest') {
      if (p.status !== 'proposing') return bad('مرحلة الاقتراح انتهت', 409); if (p.member_step) return bad(`اقترحتم خطوة لـ${mName} بالفعل`, 409);
      const cached = (p.meta || {}).options_for_member; if (Array.isArray(cached) && cached.length) return NextResponse.json({ success: true, options: cached });
      const ch = await memberChapters(db, { id: p.member_user_id || NIL, email: p.member_email }); const options = suggestForMember(ch.chapters, ch.input);
      await save(p.id, { meta: { ...(p.meta || {}), options_for_member: options } }); return NextResponse.json({ success: true, options });
    }
    if (action === 'propose') {
      if (p.status !== 'proposing') return bad('مرحلة الاقتراح انتهت', 409); if (p.member_step) return bad(`اقترحتم خطوة لـ${mName} بالفعل — انتظروا توقيعه أو طلبه غيرها`, 409);
      const options = ((p.meta || {}).options_for_member || []) as any[]; if (!options.length) return bad('اطلبوا خيارات الخطوة أولًا', 409);
      const err = validateOrgProposal(body, options); if (err) return bad(err);
      const opt = options[Number(body.index)]; const step: MemberStep = { kind: opt.kind, title_ar: body.title_ar ? String(body.title_ar).trim() : opt.title_ar, why_ar: String(body.why_ar).trim(), target: opt.target, proposed_by: 'org', proposed_at: iso, accepted_at: null, rework: Number((p.meta || {}).rework_member || 0) };
      const { row, error } = await save(p.id, { member_step: step, meta: { ...(p.meta || {}), proposed_by_email: c.me.email } }); if (error || !row) return bad(error?.message || 'تعذّر حفظ الاقتراح', 500);
      await tellMember(row, 'org_pair_proposed', `${orgName(row)} تطلب منك خطوة`, `${row.member_name ? `${row.member_name}، ` : ''}جهتك تطلب منك لسنة: «${step.title_ar}». وكتبت لك: «${step.why_ar}». اقرأ، ثم وقّع — أو اطلب غيرها مرة واحدة.`, `org_pair:${p.id}:proposed:member`);
      return NextResponse.json({ success: true, pair: await pairView(db, row, 'org', site, now.getTime(), null), message: `أُرسلت خطوتكم لـ${mName}. ${p.org_step ? 'والآن وقّعوا على ما طلبه منكم.' : 'وننتظر ما يطلبه منكم.'}` });
    }
    if (action === 'rework') {
      if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (p.status !== 'proposing') return bad('مرحلة الاقتراح انتهت', 409); if (!p.org_step) return bad('لم يطلب منكم شيء بعد', 409); if (p.org_step.accepted_at) return bad('وقّعتم بالفعل', 409);
      const used = Number((p.meta || {}).rework_org || 0); if (used >= ORG_PAIR_REWORK_MAX) return bad('طلبتم غيرها من قبل — هذه المرة إمّا توقيع وإمّا سحب', 409);
      const { row, error } = await save(p.id, { org_step: null, meta: { ...(p.meta || {}), rework_org: used + 1, rework_org_was: p.org_step, options_for_org: null } }); if (error || !row) return bad(error?.message || 'تعذّر', 500);
      await tellMember(row, 'org_pair_rework', `${orgName(row)} تطلب خطوة غيرها`, `${row.member_name ? `${row.member_name}، ` : ''}قرأت جهتك ما طلبتَه: «${p.org_step.title_ar}» — وتطلب خطوة غيرها (مرة واحدة). اقترح من جديد.`, `org_pair:${p.id}:rework:org`);
      return NextResponse.json({ success: true, pair: await pairView(db, row, 'org', site, now.getTime(), null), message: `طلبتم من ${mName} خطوة غيرها — مرة واحدة.` });
    }
    if (action === 'sign') {
      if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (p.status !== 'proposing') return bad('العهد ليس في مرحلة التوقيع', 409); if (!p.org_step) return bad(`لم يطلب منكم ${mName} خطوة بعد`, 409); if (p.org_step.accepted_at) return bad('وقّعتم بالفعل — ننتظر توقيع المنسوب', 409);
      const err = validateOrgSign(body); if (err) return bad(err);
      const step: OrgStep = { ...p.org_step, accepted_at: iso, title_ar: body.title_ar ? String(body.title_ar).trim() : p.org_step.title_ar };
      const { row, error } = await save(p.id, { org_step: step, org_signed_at: iso, org_signer_id: c.me.id, org_signer_email: c.me.email }); if (error || !row) return bad(error?.message || 'تعذّر التوقيع', 500);
      if (!p.member_signed_at) { await tellMember(row, 'org_pair_signed', `${orgName(row)} وقّعت`, `${row.member_name ? `${row.member_name}، ` : ''}وقّعت جهتك على ما طلبتَه منها. بقي توقيعك${row.member_step ? '' : ' — بعد أن تطلب منك خطوتها'}.`, `org_pair:${p.id}:signed:org`); return NextResponse.json({ success: true, pair: await pairView(db, row, 'org', site, now.getTime(), null), signed: 'one', message: `وقّعتم بصفتكم. حين يوقّع ${mName} تُصدر وثيقتكما الواحدة.` }); }
      const r = await activateOrgPair(db, row, signerFromEnv(process.env, site), site, didWeb(site), () => randomCode(4), now); if (!r.ok) return bad(r.error, 500);
      await tellMember(r.pair, 'org_pair_active', 'وُقّع عهدك مع جهتك — وثيقة واحدة بتوقيعين', `${r.pair.member_name ? `${r.pair.member_name}، ` : ''}اكتمل التوقيعان. عهدك مع ${orgName(r.pair)} حيّ حتى ${fmtD(r.pair.review_at!)}.${r.verify_url ? `\nالوثيقة: ${r.verify_url}` : ''}`, `org_pair:${p.id}:active:m`);
      await tellOrg(r.pair, 'org_pair_active', `وُقّع عهد الجهة مع ${mName}`, `اكتمل التوقيعان. عهد الجهة مع ${mName} حيّ حتى ${fmtD(r.pair.review_at!)}.${r.verify_url ? `\nالوثيقة: ${r.verify_url}` : ''}`, `org_pair:${p.id}:active:o`);
      return NextResponse.json({ success: true, pair: { ...(await pairView(db, r.pair, 'org', site, now.getTime(), null)), verify_url: r.verify_url }, signed: 'both', signed_vc: r.signed_vc, message: `وُقّع عهدكما — المراجعة المشتركة في ${fmtD(r.pair.review_at!)}.` });
    }
    if (action === 'revoke') {
      if (body.confirm !== true) return bad('يلزم تأكيد صريح'); const r = await revokeOrgPair(db, p, now); if (!r.ok) return bad(r.error || 'تعذّر', 409);
      await tellMember(p, 'org_pair_revoked', `${orgName(p)} سحبت العهد`, `${p.member_name ? `${p.member_name}، ` : ''}سحبت جهتك عهدكما${p.code ? ` (${p.code})` : ''}. سُحبت الوثيقة. لا تعليل مطلوب.`, `org_pair:${p.id}:revoked`);
      await evt(p, 'org_revoked', { code: p.code }); return NextResponse.json({ success: true, message: 'سُحب العهد وسُحبت الوثيقة.' });
    }
    if (action === 'review') {
      if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (!orgReviewOpen(p, now.getTime())) return bad('المراجعة المشتركة تُفتح بعد سنة من التوقيع', 409); if (p.org_reviewed_at) return bad('كتبت الجهة مراجعتها بالفعل', 409);
      const err = validateOrgReview(body); if (err) return bad(err);
      const decision = body.decision as 'renew' | 'close'; const patch: Record<string, unknown> = { status: 'review', org_review_ar: String(body.note_ar).trim(), org_reviewed_at: iso, org_decision: decision, meta: { ...(p.meta || {}), review_opened_at: (p.meta || {}).review_opened_at || iso, org_reviewed_by: c.me.email } };
      const joint = jointDecision(p.member_decision, decision); if (joint) { patch.status = joint === 'renew' ? 'renewed' : 'closed'; patch.reviewed_at = iso; }
      const { row, error } = await save(p.id, patch); if (error || !row) return bad(error?.message || 'تعذّر حفظ المراجعة', 500);
      let next: OrgPair | null = null;
      if (joint === 'renew') { const { data } = await db.from('portal_org_pair_pledges').insert({ organization_id: row.organization_id, org_name: row.org_name, status: 'proposing', invited_by: row.invited_by, member_user_id: row.member_user_id, member_email: row.member_email, member_name: row.member_name, member_name_mode: row.member_name_mode, invite_why_ar: 'تجديد بعد سنة — قرّرتما معًا', invited_at: iso, accepted_at: iso, meta: { version: ORG_PAIR_VERSION, renewed_from: row.id } }).select(ORG_PAIR_COLS).single(); next = (data as OrgPair) || null; await tellMember(row, 'org_pair_renewed', 'قرّرتما التجديد — سنة جديدة، خطوتان جديدتان', `${row.member_name ? `${row.member_name}، ` : ''}قرّرتما معًا تجديد عهدك مع جهتك. اقترح خطوة جديدة — ولديكما ${ORG_PAIR_PROPOSE_DAYS} يومًا.`, `org_pair:${row.id}:renewed:m`); }
      else if (joint === 'close') await tellMember(row, 'org_pair_closed', 'طُوي عهدك مع جهتك — بكلماتكما', `${row.member_name ? `${row.member_name}، ` : ''}اكتملت المراجعة وطُوي العهد. ما كتبته جهتك لك محفوظ في «عهودي السابقة».`, `org_pair:${row.id}:closed:m`);
      else await tellMember(row, 'org_pair_reviewed', `${orgName(row)} كتبت مراجعتها`, `${row.member_name ? `${row.member_name}، ` : ''}كتبت جهتك ما تغيّر فيها بسببك — ولن تقرأه حتى تكتب ما تغيّر فيك. ${ORG_PAIR_REVIEW_WINDOW_DAYS} يومًا من فتح المراجعة.`, `org_pair:${p.id}:reviewed:org`);
      const v = await pairView(db, row, 'org', site, now.getTime(), null);
      return NextResponse.json({ success: true, pair: v, partner_review_ar: v.partner_review_ar, joint, next: next ? orgViewFor(next, 'org') : null, message: joint === 'renew' ? 'قرّرتما التجديد — عهد جديد في مرحلة الاقتراح.' : joint === 'close' ? 'طُوي العهد بكلماتكما.' : `حُفظت كلمات الجهة. تُفتح كلمات ${mName} حين يكتب.` });
    }
    return bad('إجراء غير معروف');
  }

  // ───────── زاوية المنسوب ─────────
  const me = await who(req, db); if (!me) return bad('سجّل الدخول', 401); if (me.delegate) return bad('الوكيل يقرأ العهد فقط — الطلب والتوقيع لصاحبه', 403);
  const st = await loadMemberOrgPairState(db, me, now.getTime()); const p = st.live;
  if (action === 'request') {
    if (!st.org) return bad('لست منسوبًا مؤكَّدًا في جهة بعد', 409); if (!st.eligible.ok) return bad(st.eligible.read_ar, 409); if (!st.org_eligible.ok) return bad(st.org_eligible.read_ar, 409);
    if (p) return bad('لديك عهد حيّ مع جهتك — عهد واحد في كل مرة', 409); if (st.invite_out) return bad('لديك طلب قائم — اسحبه أولًا أو انتظر ردّ الجهة', 409);
    const err = validateOrgInvite(body); if (err) return bad(err);
    const admins = await orgAdmins(db, st.org.id); if (!admins.some(a => a.email !== me.email)) return bad('لا مدير آخر في جهتك يمكنه أن يوقّع عنها — العهد مع الجهة يحتاج مديرًا غيرك', 409);
    const row = { organization_id: st.org.id, org_name: st.org.name_ar, status: 'invited', invited_by: 'member', member_user_id: me.id, member_email: me.email, member_name: me.name || null, member_name_mode: String(body.name_mode || 'first'), invite_why_ar: String(body.why_ar).trim(), invited_at: iso, meta: { version: ORG_PAIR_VERSION, member_chapters: st.chapters } };
    const { data, error } = await db.from('portal_org_pair_pledges').insert(row).select(ORG_PAIR_COLS).single(); if (error || !data) return bad(error?.message || 'تعذّر إرسال الطلب', 500);
    await tellOrg(data as OrgPair, 'org_pair_request', `${memberName(data as OrgPair)} يطلب من الجهة خطوة لسنة`, `${memberName(data as OrgPair)} — منسوب مؤكَّد في جهتكم — يطلب عهدًا لسنة: خطوة تطلبونها منه وخطوة يطلبها منكم. كتب: «${row.invite_why_ar}». الطلب مفتوح ${ORG_PAIR_INVITE_DAYS} يومًا.`, `org_pair:${(data as OrgPair).id}:request`);
    return NextResponse.json({ success: true, invite: inviteView(data as OrgPair), message: `أُرسل طلبك إلى مديري ${st.org.name_ar}. إن قبلوا خلال ${ORG_PAIR_INVITE_DAYS} يومًا بدأ الاقتراح — وإلا انقضى بصمت.` });
  }
  if (action === 'cancel') { if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (!st.invite_out) return bad('لا طلب قائمًا', 409); const { error } = await save(st.invite_out.id, { status: 'expired', meta: { ...(st.invite_out.meta || {}), cancelled_at: iso } }); if (error) return bad(error.message, 500); return NextResponse.json({ success: true, message: 'سُحب طلبك بصمت.' }); }
  if (action === 'accept' || action === 'decline') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح'); const inv = st.invites_in.find(i => i.id === String(body.id || '')); if (!inv) return bad('الدعوة غير موجودة أو انقضت', 404);
    if (action === 'decline') { const { error } = await save(inv.id, { status: 'declined', meta: { ...(inv.meta || {}), declined_at: iso } }); if (error) return bad(error.message, 500); await tellOrg(inv, 'org_pair_declined', 'لم يكتمل العهد هذه المرة', `لم يقبل ${memberName(inv)} دعوة الجهة هذه المرة — بلا تعليل، كما يحق له.`, `org_pair:${inv.id}:declined`); return NextResponse.json({ success: true, message: 'رُفضت الدعوة بلا تعليل.' }); }
    if (!st.eligible.ok) return bad(st.eligible.read_ar, 409); if (p) return bad('لديك عهد حيّ مع جهتك — عهد واحد في كل مرة', 409);
    if (body.name_mode !== undefined && !['full', 'first', 'anon'].includes(String(body.name_mode))) return bad('وضع الاسم: full أو first أو anon');
    const { row, error } = await save(inv.id, { status: 'proposing', accepted_at: iso, member_user_id: me.id, member_name: me.name || inv.member_name, member_name_mode: String(body.name_mode || 'first'), meta: { ...(inv.meta || {}), member_chapters: st.chapters } }); if (error || !row) return bad(error?.message || 'تعذّر القبول', 500);
    await tellOrg(row, 'org_pair_accepted', `${memberName(row)} قبل دعوة الجهة`, `قبل ${memberName(row)} دعوة الجهة إلى العهد. الآن: اقترحوا له خطوة واحدة من الخطوات التي تشهدها المنصة، واكتبوا لماذا — ولديكما ${ORG_PAIR_PROPOSE_DAYS} يومًا حتى يكتمل التوقيعان.`, `org_pair:${row.id}:accepted`);
    return NextResponse.json({ success: true, pair: await pairView(db, row, 'member', site, now.getTime(), st.chapters), message: `قبلتَ. الآن اقترح لجهتك خطوة واحدة لك — وهي تقترح لك.` });
  }
  if (!p) return bad('لا عهد حيًّا مع جهتك', 409);
  const oName = orgName(p);
  if (action === 'suggest') {
    if (p.status !== 'proposing') return bad('مرحلة الاقتراح انتهت', 409); if (p.org_step) return bad(`اقترحتَ خطوة لـ${oName} بالفعل`, 409);
    const cached = (p.meta || {}).options_for_org; if (Array.isArray(cached) && cached.length) return NextResponse.json({ success: true, options: cached });
    const options = suggestForOrg(st.input); await save(p.id, { meta: { ...(p.meta || {}), options_for_org: options } }); return NextResponse.json({ success: true, options });
  }
  if (action === 'propose') {
    if (p.status !== 'proposing') return bad('مرحلة الاقتراح انتهت', 409); if (p.org_step) return bad(`اقترحتَ خطوة لـ${oName} بالفعل — انتظر توقيعها أو طلبها غيرها`, 409);
    const options = ((p.meta || {}).options_for_org || []) as any[]; if (!options.length) return bad('اطلب خيارات الخطوة أولًا', 409);
    const err = validateOrgProposal(body, options); if (err) return bad(err);
    const opt = options[Number(body.index)]; const step: OrgStep = { kind: opt.kind, title_ar: body.title_ar ? String(body.title_ar).trim() : opt.title_ar, why_ar: String(body.why_ar).trim(), target: opt.target, proposed_by: 'member', proposed_at: iso, accepted_at: null, rework: Number((p.meta || {}).rework_org || 0) };
    const { row, error } = await save(p.id, { org_step: step }); if (error || !row) return bad(error?.message || 'تعذّر حفظ الاقتراح', 500);
    await tellOrg(row, 'org_pair_proposed', `${memberName(row)} يطلب من الجهة خطوة`, `${memberName(row)} يطلب من الجهة لسنة: «${step.title_ar}». وكتب: «${step.why_ar}». اقرؤوا، ثم وقّعوا بصفتكم — أو اطلبوا غيرها مرة واحدة.`, `org_pair:${p.id}:proposed:org`);
    return NextResponse.json({ success: true, pair: await pairView(db, row, 'member', site, now.getTime(), st.chapters), message: `أُرسلت خطوتك إلى ${oName}. ${p.member_step ? 'والآن وقّع على ما طلبته منك.' : 'وننتظر ما تطلبه منك.'}` });
  }
  if (action === 'rework') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (p.status !== 'proposing') return bad('مرحلة الاقتراح انتهت', 409); if (!p.member_step) return bad('لم تطلب منك الجهة شيئًا بعد', 409); if (p.member_step.accepted_at) return bad('وقّعتَ بالفعل', 409);
    const used = Number((p.meta || {}).rework_member || 0); if (used >= ORG_PAIR_REWORK_MAX) return bad('طلبتَ غيرها من قبل — هذه المرة إمّا توقيع وإمّا سحب', 409);
    const { row, error } = await save(p.id, { member_step: null, meta: { ...(p.meta || {}), rework_member: used + 1, rework_member_was: p.member_step, options_for_member: null } }); if (error || !row) return bad(error?.message || 'تعذّر', 500);
    await tellOrg(row, 'org_pair_rework', `${memberName(row)} يطلب خطوة غيرها`, `قرأ ${memberName(row)} ما طلبتموه: «${p.member_step.title_ar}» — ويطلب خطوة غيرها (مرة واحدة). اقترحوا من جديد.`, `org_pair:${p.id}:rework:member`);
    return NextResponse.json({ success: true, pair: await pairView(db, row, 'member', site, now.getTime(), st.chapters), message: `طلبتَ من ${oName} خطوة غيرها — مرة واحدة.` });
  }
  if (action === 'sign') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (p.status !== 'proposing') return bad('العهد ليس في مرحلة التوقيع', 409); if (!p.member_step) return bad(`لم تطلب منك ${oName} خطوة بعد`, 409); if (p.member_step.accepted_at) return bad('وقّعتَ بالفعل — ننتظر توقيع الجهة', 409);
    const err = validateOrgSign(body); if (err) return bad(err);
    const step: MemberStep = { ...p.member_step, accepted_at: iso, title_ar: body.title_ar ? String(body.title_ar).trim() : p.member_step.title_ar };
    const { row, error } = await save(p.id, { member_step: step, member_signed_at: iso, meta: { ...(p.meta || {}), chapters_then: st.chapters } }); if (error || !row) return bad(error?.message || 'تعذّر التوقيع', 500);
    if (!p.org_signed_at) { await tellOrg(row, 'org_pair_signed', `${memberName(row)} وقّع`, `وقّع ${memberName(row)} على ما طلبتموه منه. بقي توقيع الجهة${row.org_step ? '' : ' — بعد أن يطلب منكم خطوته'}.`, `org_pair:${p.id}:signed:member`); return NextResponse.json({ success: true, pair: await pairView(db, row, 'member', site, now.getTime(), st.chapters), signed: 'one', message: `وقّعتَ على خطوتك. حين يوقّع مدير ${oName} بصفته تُصدر وثيقتكما الواحدة.` }); }
    const r = await activateOrgPair(db, row, signerFromEnv(process.env, site), site, didWeb(site), () => randomCode(4), now); if (!r.ok) return bad(r.error, 500);
    await tellMember(r.pair, 'org_pair_active', 'وُقّع عهدك مع جهتك — وثيقة واحدة بتوقيعين', `${r.pair.member_name ? `${r.pair.member_name}، ` : ''}اكتمل التوقيعان. عهدك مع ${oName} حيّ حتى ${fmtD(r.pair.review_at!)}.${r.verify_url ? `\nالوثيقة: ${r.verify_url}` : ''}`, `org_pair:${p.id}:active:m`);
    await tellOrg(r.pair, 'org_pair_active', `وُقّع عهد الجهة مع ${memberName(r.pair)}`, `اكتمل التوقيعان. عهد الجهة مع ${memberName(r.pair)} حيّ حتى ${fmtD(r.pair.review_at!)}.${r.verify_url ? `\nالوثيقة: ${r.verify_url}` : ''}`, `org_pair:${p.id}:active:o`);
    return NextResponse.json({ success: true, pair: { ...(await pairView(db, r.pair, 'member', site, now.getTime(), st.chapters)), verify_url: r.verify_url }, signed: 'both', signed_vc: r.signed_vc, message: `وُقّع عهدكما — المراجعة المشتركة في ${fmtD(r.pair.review_at!)}.` });
  }
  if (action === 'revoke') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح'); const r = await revokeOrgPair(db, p, now); if (!r.ok) return bad(r.error || 'تعذّر', 409);
    await tellOrg(p, 'org_pair_revoked', `${memberName(p)} سحب العهد`, `سحب ${memberName(p)} عهده مع الجهة${p.code ? ` (${p.code})` : ''}. سُحبت الوثيقة. لا تعليل مطلوب.`, `org_pair:${p.id}:revoked`);
    await evt(p, 'revoked', { code: p.code }); return NextResponse.json({ success: true, message: 'سُحب العهد وسُحبت الوثيقة.' });
  }
  if (action === 'review') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (!orgReviewOpen(p, now.getTime())) return bad('المراجعة المشتركة تُفتح بعد سنة من التوقيع', 409); if (p.member_reviewed_at) return bad('كتبتَ مراجعتك بالفعل', 409);
    const err = validateOrgReview(body); if (err) return bad(err);
    const decision = body.decision as 'renew' | 'close'; const patch: Record<string, unknown> = { status: 'review', member_review_ar: String(body.note_ar).trim(), member_reviewed_at: iso, member_decision: decision, meta: { ...(p.meta || {}), review_opened_at: (p.meta || {}).review_opened_at || iso } };
    const joint = jointDecision(decision, p.org_decision); if (joint) { patch.status = joint === 'renew' ? 'renewed' : 'closed'; patch.reviewed_at = iso; }
    const { row, error } = await save(p.id, patch); if (error || !row) return bad(error?.message || 'تعذّر حفظ المراجعة', 500);
    await evt(row, 'reviewed', { code: p.code, decision, complete: !!st.paths.member_state?.complete, org: oName });
    let next: OrgPair | null = null;
    if (joint === 'renew') { const { data } = await db.from('portal_org_pair_pledges').insert({ organization_id: row.organization_id, org_name: row.org_name, status: 'proposing', invited_by: row.invited_by, member_user_id: row.member_user_id, member_email: row.member_email, member_name: row.member_name, member_name_mode: row.member_name_mode, invite_why_ar: 'تجديد بعد سنة — قرّرتما معًا', invited_at: iso, accepted_at: iso, meta: { version: ORG_PAIR_VERSION, renewed_from: row.id } }).select(ORG_PAIR_COLS).single(); next = (data as OrgPair) || null; await tellOrg(row, 'org_pair_renewed', `قرّرتما التجديد مع ${memberName(row)}`, `قرّرتما معًا تجديد العهد. اقترحوا خطوة جديدة — ولديكما ${ORG_PAIR_PROPOSE_DAYS} يومًا.`, `org_pair:${row.id}:renewed:o`); }
    else if (joint === 'close') await tellOrg(row, 'org_pair_closed', `طُوي العهد مع ${memberName(row)} — بكلماتكما`, 'اكتملت المراجعة وطُوي العهد. كلمات الطرفين محفوظة في «العهود السابقة».', `org_pair:${row.id}:closed:o`);
    else await tellOrg(row, 'org_pair_reviewed', `${memberName(row)} كتب مراجعته`, `كتب ${memberName(row)} ما تغيّر فيه بسبب الجهة — ولن تقرؤوه حتى تكتبوا ما تغيّر فيكم بسببه. ${ORG_PAIR_REVIEW_WINDOW_DAYS} يومًا من فتح المراجعة.`, `org_pair:${p.id}:reviewed:member`);
    const v = await pairView(db, row, 'member', site, now.getTime(), st.chapters);
    return NextResponse.json({ success: true, pair: v, partner_review_ar: v.partner_review_ar, joint, next: next ? orgViewFor(next, 'member') : null, message: joint === 'renew' ? 'قرّرتما التجديد — عهد جديد في مرحلة الاقتراح.' : joint === 'close' ? 'طُوي العهد بكلماتكما.' : `حُفظت كلماتك. تُفتح كلمات ${oName} حين تكتب.` });
  }
  return bad('إجراء غير معروف');
}
