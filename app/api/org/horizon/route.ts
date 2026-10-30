// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/org/horizon — أفق الجهة (P28 · «عشر سنوات وخطوة»)
 *  GET  ?org=                     (مدير الجهة؛ الطاقم يقرأ بلا نص الأفق) → الأهلية · الأفق الجاري · العهد · الدرب · الآفاق السابقة · القواعد
 *  GET  ?mine=1                   (أي مستخدم)  → عهود الجهات التي أنا منسوب مؤكَّد فيها: عنوان العهد ونوعه وموعد مراجعته فقط (لا أفق · لا درب)
 *  POST { org, action:'draft', use_ai? }                                   → مسودة «نحن في 2036» (ذكاء اصطناعي من فصول الجهة وكلماتها أو محلية) — لا تُحفظ
 *  POST { org, action:'scenario', scenario_ar, source? }                   → حفظ/تحديث أفق الجهة (يُنشئ أفقًا جديدًا إن لم يوجد)
 *  POST { org, action:'options' }                                           → الخطوات الثلاث (تُحفظ على الأفق حتى تُختار واحدة)
 *  POST { org, action:'pledge', index, title_ar?, confirm:true }            → توقيع عهد الجهة (وثيقة ATH-OH · 365 يومًا) — يُخبَر المنسوبون المؤكَّدون بعنوانه
 *  POST { org, action:'pledge_revoke', confirm:true }                       → سحب العهد (تُلغى الوثيقة) — الأفق يعود مسودة
 *  POST { org, action:'review', note_ar, decision:'renew'|'archive', confirm:true } → مراجعة سنة الجهة (ما تغيّر فينا) ثم تجديد أو طيّ
 *  الكتابة لمديري الجهة المؤكَّدين فقط (الطاقم يقرأ ولا يكتب ولا يرى نص الأفق).
 */
import { NextResponse } from 'next/server';
import { orgCtx, isOrgAdmin, svc, who, bad, siteOf } from '../../../../lib/org-impact/auth';
import { randomCode } from '../../../../lib/portal/profile';
import { signerFromEnv } from '../../../../lib/portal/vc-server';
import { didWeb } from '../../../../lib/portal/vc';
import { notify } from '../../../../lib/portal/notify';
import { limitFor, tooMany, ipOf } from '../../../../lib/shield/ratelimit';
import { loadOrgHorizonState, orgScenarioDraft } from '../../../../lib/org-horizon/load';
import { signOrgPledge, revokeOrgPledge } from '../../../../lib/org-horizon/pledge';
import { ORG_HORIZON_VERSION, ORG_HORIZON_MIN_CHAPTERS, ORG_HORIZON_MIN_MEMBERS, ORG_HORIZON_YEARS, ORG_PLEDGE_DAYS, ORG_REVIEW_WINDOW_DAYS, ORG_MAX_SCENARIO_CHARS, ORG_MIN_SCENARIO_CHARS, ORG_MAX_REVIEW_CHARS, ORG_MAX_PLEDGE_TITLE, ORG_PLEDGE_OPTIONS, ORG_PLEDGE_PEOPLE, ORG_NOTIFY_MEMBERS_MAX, ORG_HORIZON_COLS, ORG_PLEDGE_COLS, PRIVACY_ORG_HORIZON_AR, ORG_PLEDGE_KIND_AR, addDays, orgYearTarget, proposeOrgPledges, validateOrgScenario, validateOrgPledgeChoice, validateOrgReview, orgReviewText, memberPledgeView } from '../../../../lib/org-horizon/registry';
import type { OrgPledgeOption, OrgPledge } from '../../../../lib/org-horizon/registry';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const RULES = { version: ORG_HORIZON_VERSION, min_chapters: ORG_HORIZON_MIN_CHAPTERS, min_members: ORG_HORIZON_MIN_MEMBERS, years: ORG_HORIZON_YEARS, pledge_days: ORG_PLEDGE_DAYS, review_window_days: ORG_REVIEW_WINDOW_DAYS, scenario_min: ORG_MIN_SCENARIO_CHARS, scenario_max: ORG_MAX_SCENARIO_CHARS, review_max: ORG_MAX_REVIEW_CHARS, pledge_title_max: ORG_MAX_PLEDGE_TITLE, options: ORG_PLEDGE_OPTIONS, people: ORG_PLEDGE_PEOPLE, kinds_ar: ORG_PLEDGE_KIND_AR, privacy_ar: PRIVACY_ORG_HORIZON_AR };
const fmtD = (iso: string) => new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'long' });
const NO = { 'Cache-Control': 'no-store' };

export async function GET(req: Request) {
  const u = new URL(req.url); const site = siteOf(req);
  if (u.searchParams.get('mine') === '1') {
    const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const me = await who(req, db); if (!me) return bad('سجّل الدخول', 401);
    const { data: mem } = await db.from('portal_org_members').select('organization_id').eq('status', 'confirmed').or(`user_id.eq.${me.id},email.ilike.${me.email}`).limit(20);
    const orgIds = Array.from(new Set(((mem || []) as any[]).map(m => m.organization_id).filter(Boolean))); if (!orgIds.length) return NextResponse.json({ success: true, items: [] }, { headers: NO });
    const { data: ps } = await db.from('portal_org_horizon_pledges').select(ORG_PLEDGE_COLS).in('organization_id', orgIds).eq('status', 'active').not('signed_at', 'is', null).order('signed_at', { ascending: false }).limit(20);
    return NextResponse.json({ success: true, items: ((ps || []) as OrgPledge[]).map(p => memberPledgeView(p, p.org_name)), note_ar: 'ترى عنوان عهد جهتك وموعد مراجعته فقط — الدرب يُكتب من أفعال المنسوبين جميعًا بأعداد لا أسماء.' }, { headers: NO });
  }
  const ctx = await orgCtx(req, String(u.searchParams.get('org') || '')); if ('error' in ctx) return ctx.error; const { db, me, org } = ctx;
  const canWrite = await isOrgAdmin(db, org.id, me); const st = await loadOrgHorizonState(db, org.id);
  const reviewOpen = !!st.horizon && (st.horizon.status === 'review' || (st.horizon.status === 'active' && !!st.horizon.review_at && new Date(st.horizon.review_at).getTime() <= Date.now()));
  const review_text = reviewOpen && st.pledge && st.path ? (st.horizon?.meta?.review_text || orgReviewText(org.name_ar, st.pledge, st.path, Number(st.horizon?.meta?.chapters_then ?? 0), st.chapters.length, Number(st.horizon?.meta?.members_then ?? 0), st.members)) : null;
  const hide = (h: any) => h && !canWrite ? { ...h, scenario_ar: '', hidden: true } : h;   // الطاقم لا يرى نص الأفق — يبقى داخل الجهة
  return NextResponse.json({ success: true, org: { id: org.id, name_ar: org.name_ar }, me: { id: me.id, email: me.email, staff: me.staff, can_write: canWrite }, eligible: st.elig, year_target: st.horizon?.year_target || orgYearTarget(), horizon: hide(st.horizon), pledge: st.pledge ? { ...st.pledge, verify_url: st.pledge.vc_issuance_id && st.pledge.code ? `${site}/verify/vc?code=${encodeURIComponent(st.pledge.code)}` : null } : null, path: st.path, review_open: reviewOpen, review_text, past: st.past.map(x => ({ ...x, horizon: hide(x.horizon) })), chapters: st.chapters.length, members: st.members, rules: { ...RULES, signing_ready: !!process.env.VC_SIGNING_KEY } }, { headers: NO });
}

export async function POST(req: Request) {
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const ctx = await orgCtx(req, String(body.org || '')); if ('error' in ctx) return ctx.error; const { db, me, org, site } = ctx;
  if (!(await isOrgAdmin(db, org.id, me))) return bad('الكتابة لمديري الجهة المؤكَّدين فقط — الطاقم يقرأ', 403);
  { const rl = await limitFor(db, 'council_write_ip', ipOf(req)); if (!rl.allowed) return tooMany(rl); }
  const action = String(body.action || ''); const now = new Date(); const orgName = org.name_ar;
  const st = await loadOrgHorizonState(db, org.id, now.getTime()); const h = st.horizon;
  if (action === 'draft') {
    if (!st.elig.ok) return bad(st.elig.read_ar, 409);
    const { data: notes } = await db.from('portal_org_journey_notes').select('body_ar').eq('organization_id', org.id).limit(50);
    const r = await orgScenarioDraft(db, me, orgName, st.chapters, ((notes || []) as any[]).map(n => String(n.body_ar || '')), st.members, h?.year_target || orgYearTarget(now.getTime()), body.use_ai !== false);
    return NextResponse.json({ success: true, draft: r, note_ar: r.source === 'ai' ? 'صيغت بالذكاء الاصطناعي من فصول الجهة وكلماتها — عدّلوا كل كلمة قبل أن تعتمدوها؛ لا تُحفظ إلا بقراركم.' : 'صيغت محليًا من فصول الجهة وكلماتها — عدّلوها كما تشاؤون.' });
  }
  if (action === 'scenario') {
    if (!st.elig.ok) return bad(st.elig.read_ar, 409);
    const err = validateOrgScenario(body); if (err) return bad(err);
    const source = body.source === 'ai' || body.source === 'local' ? body.source : 'own'; const text = String(body.scenario_ar).trim();
    if (h) { const { data, error } = await db.from('portal_org_horizons').update({ scenario_ar: text, scenario_source: source, updated_at: now.toISOString() }).eq('id', h.id).select(ORG_HORIZON_COLS).single(); if (error) return bad(error.message, 500); return NextResponse.json({ success: true, horizon: data, message: 'حُفظ أفق الجهة — بصوتها، ولا يغادرها.' }); }
    const { data, error } = await db.from('portal_org_horizons').insert({ organization_id: org.id, org_name: orgName, written_by: me.id, written_email: me.email, year_target: orgYearTarget(now.getTime()), scenario_ar: text, scenario_source: source, status: 'draft', options: [], meta: { chapters_at_write: st.chapters.length, members_at_write: st.members } }).select(ORG_HORIZON_COLS).single();
    if (error || !data) return bad(error?.message || 'تعذّر الحفظ', 500);
    return NextResponse.json({ success: true, horizon: data, message: `كُتب أفق «${orgName}» لسنة ${(data as any).year_target} — الخطوة التالية: خطوة واحدة لهذه السنة.` });
  }
  if (action === 'options') {
    if (!h) return bad('اكتبوا أفق الجهة أولًا — لا خطوة بلا أفق', 409); if (h.status !== 'draft') return bad('للجهة عهد نشط — الخطوات تُقترح بعد المراجعة', 409);
    const options = proposeOrgPledges(st.chapters, st.members); const { data, error } = await db.from('portal_org_horizons').update({ options, updated_at: now.toISOString() }).eq('id', h.id).select(ORG_HORIZON_COLS).single(); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true, horizon: data, options, note_ar: 'ثلاث خطوات يستطيع أَثَر أن يشهدها من أفعال منسوبيكم — اختاروا واحدة فقط، وعدّلوا صياغتها إن شئتم.' });
  }
  if (action === 'pledge') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (!h) return bad('اكتبوا أفق الجهة أولًا', 409); if (h.status !== 'draft') return bad('للجهة عهد نشط بالفعل — عهد واحد في كل سنة', 409);
    const options = (h.options || []) as OrgPledgeOption[]; if (!options.length) return bad('اطلبوا الخطوات الثلاث أولًا', 409);
    const err = validateOrgPledgeChoice(body, options); if (err) return bad(err);
    const opt = { ...options[Number(body.index)] }; if (body.title_ar) opt.title_ar = String(body.title_ar).trim();
    const r = await signOrgPledge(db, me, { id: org.id, name: orgName }, h.id, opt, h.year_target, signerFromEnv(process.env, site), site, didWeb(site), () => randomCode(4), now); if (!r.ok) return bad(r.error, 409);
    const review_at = addDays(now, ORG_PLEDGE_DAYS);
    const { data } = await db.from('portal_org_horizons').update({ status: 'active', activated_at: now.toISOString(), review_at, updated_at: now.toISOString(), meta: { ...(h.meta || {}), chapters_then: st.chapters.length, members_then: st.members, pledge_code: r.pledge.code } }).eq('id', h.id).select(ORG_HORIZON_COLS).single();
    // إخبار المنسوبين المؤكَّدين بعنوان العهد فقط (بالقنوات القائمة — لا بريد مفعّل = سجل يدوي)
    let told = 0;
    try {
      const { data: mem } = await db.from('portal_org_members').select('email,full_name').eq('organization_id', org.id).eq('status', 'confirmed').limit(ORG_NOTIFY_MEMBERS_MAX);
      for (const m of ((mem || []) as any[])) { if (!m.email) continue; await notify(db, { kind: 'org_horizon_pledged', to: { email: m.email, name: m.full_name || null }, subject: `جهتكم «${orgName}» عاهدت نفسها على خطوة لسنة`, text: `وقّعت «${orgName}» عهدها لهذه السنة: «${opt.title_ar}». الدرب يُكتب من أفعال المنسوبين — بأعداد لا أسماء — ويُراجَع في ${fmtD(review_at)}. ما تفعله في أَثَر هو ما يُشهد.\n\n${site}/me`, url: `${site}/me`, ref: `org_horizon_pledged:${r.pledge.id}` }, { now }); told++; }
    } catch { /* الإخبار لا يوقف العهد */ }
    return NextResponse.json({ success: true, horizon: data, pledge: { ...r.pledge, verify_url: r.verify_url }, signed_vc: r.signed_vc, told, message: `وُقّع عهد «${orgName}» — المراجعة في ${fmtD(review_at)}. أُخبر ${told} من المنسوبين بعنوانه؛ والدرب يُكتب من أفعالهم.` });
  }
  if (action === 'pledge_revoke') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (!h || !st.pledge) return bad('لا عهد نشط', 409);
    const r = await revokeOrgPledge(db, org.id, st.pledge.id, now); if (!r.ok) return bad(r.error || 'تعذّر', 409);
    await db.from('portal_org_horizons').update({ status: 'draft', activated_at: null, review_at: null, updated_at: now.toISOString(), meta: { ...(h.meta || {}), revoked_pledge_at: now.toISOString(), revoked_by: me.email } }).eq('id', h.id);
    return NextResponse.json({ success: true, message: 'سُحب عهد الجهة وأُلغيت وثيقته — أفق الجهة باقٍ.' });
  }
  if (action === 'review') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح'); if (!h || !st.pledge) return bad('لا عهد يُراجَع', 409);
    const open = h.status === 'review' || (h.status === 'active' && !!h.review_at && new Date(h.review_at).getTime() <= now.getTime()); if (!open) return bad(`مراجعة سنة الجهة تُفتح في ${h.review_at ? fmtD(h.review_at) : 'موعدها'}`, 409);
    const err = validateOrgReview(body); if (err) return bad(err);
    const note = String(body.note_ar).trim(); const decision = body.decision as 'renew' | 'archive'; const path = st.path;
    const { error } = await db.from('portal_org_horizons').update({ status: decision === 'renew' ? 'renewed' : 'archived', decision, reviewed_at: now.toISOString(), review_note_ar: note, updated_at: now.toISOString(), meta: { ...(h.meta || {}), path_at_review: path, chapters_now: st.chapters.length, members_now: st.members, reviewed_by: me.email } }).eq('id', h.id); if (error) return bad(error.message, 500);
    await db.from('portal_org_horizon_pledges').update({ status: 'reviewed', meta: { ...(st.pledge.meta || {}), reviewed_at: now.toISOString(), decision, complete: !!path?.complete } }).eq('id', st.pledge.id);
    let next: any = null;
    if (decision === 'renew') { const { data } = await db.from('portal_org_horizons').insert({ organization_id: org.id, org_name: orgName, written_by: me.id, written_email: me.email, year_target: h.year_target, scenario_ar: h.scenario_ar, scenario_source: 'own', status: 'draft', options: [], meta: { renewed_from: h.id, chapters_at_write: st.chapters.length, members_at_write: st.members } }).select(ORG_HORIZON_COLS).single(); next = data; }
    return NextResponse.json({ success: true, horizon: next, message: decision === 'renew' ? 'راجعت الجهة عهدها وجدّدت أفقها — عدّلوا الأفق إن شئتم ثم اختاروا خطوة السنة القادمة.' : 'راجعت الجهة عهدها وطوت هذا الأفق — صار فصلًا في رحلة الجهة. يمكن كتابة أفق جديد متى شئتم.' });
  }
  return bad('إجراء غير معروف');
}
