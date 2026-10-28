// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/loop — منظومة التحسين المستمر القائمة على الأدلة «الحلقة المغلقة» (أَثَر · P15)
 *  GET  (موظفون)                       → { suggestions, learned, forecasts, stats }         لوحة /admin/loop
 *  GET  ?gaps=1 (موظفون)               → { gaps }                                            فجوات حقيقية لهندسة البرامج («من الذاكرة»)
 *  GET  ?session=<id> (موظف/مدرب/منشئ) → { cards, summary, focus, skills }                 بطاقة الصف للميسِّر (مفاتيح مجهولة، بلا درجات)
 *  GET  ?org=<id> (موظف/عضو مؤكَّد)    → { forecasts, line, members, events, steps }        «طقس القدرة» لصفحة الجهة
 *  POST { action:'decide', id, status:'accepted'|'dismissed', note?, template_id?, emails? } → قرار بشري + أثر (مسودة برنامج / مهمات)
 *  POST { action:'run', dry? } (موظفون) → تشغيل الدورة الآن
 *  المبدأ: الذاكرة تقترح، الإنسان يقرّر، والأثر يُسجَّل — وحين لا يكفي الدليل تقول الشاشة ذلك صراحة.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { loadGraph } from '../../../lib/portal/evidence-cron';
import { programGaps, sessionFocus, learnerCards, classSummary, weatherLine, monthlyLearning, KIND_LABEL_AR } from '../../../lib/portal/loop';
import { runLoop, forecastForOrg, skillMetaOf } from '../../../lib/portal/loop-cron';
import { assignMission } from '../../../lib/portal/missions-cron';
import { draftTitle, EMPTY_NEED } from '../../../lib/portal/factory';
import type { Need } from '../../../lib/portal/factory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const today = () => new Date().toISOString().slice(0, 10);

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('سجّل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة الدخول غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const { data: prof } = await db.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle();
  const email = String(data.user.email || '').toLowerCase();
  return { db, user: { id: data.user.id, email, name: String((prof as any)?.full_name || ''), staff: STAFF.includes(String((prof as any)?.role || '').toUpperCase()) } };
}
async function isOrgMember(db: any, user: { id: string; email: string }, orgId: string) {
  const { data } = await db.from('portal_org_members').select('id').eq('organization_id', orgId).eq('status', 'confirmed').or(`user_id.eq.${user.id},email.ilike.${user.email}`).limit(1);
  return !!(data || []).length;
}
async function canSeeSession(db: any, user: { id: string; email: string; staff: boolean }, s: any) {
  if (user.staff || s.created_by === user.id) return true;
  const { data: tr } = await db.from('trainers').select('id').ilike('email', user.email);
  return ((tr || []) as any[]).some(t => t.id === s.trainer_id);
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const u = new URL(req.url); const org = u.searchParams.get('org'); const session = u.searchParams.get('session'); const gaps = u.searchParams.get('gaps');

  // ---- طقس القدرة لجهة
  if (org) {
    if (!UUID.test(org)) return bad('معرّف غير صالح');
    if (!user.staff && !(await isOrgMember(db, user, org))) return bad('لست عضوًا مؤكَّدًا في هذه الجهة', 403);
    const [{ data: o }, stored] = await Promise.all([db.from('portal_organizations').select('id,name_ar').eq('id', org).maybeSingle(), db.from('portal_capability_forecasts').select('*').eq('organization_id', org).order('people', { ascending: false }).limit(12)]);
    let forecasts = ((stored.data || []) as any[]).map(f => ({ skill_id: f.skill_id, name_ar: '', trend: f.trend, slope: Number(f.slope), recent_weight: Number(f.recent_weight), prior_weight: Number(f.prior_weight), evidence: f.evidence, people: f.people, steps: f.steps || [], computed_at: f.computed_at }));
    let members = 0, events = 0;
    if (!forecasts.length) { const live = await forecastForOrg(db, org, today()); forecasts = live.forecasts.map(f => ({ ...f, computed_at: null })) as any; members = live.members; events = live.events; }
    else { const meta = await skillMetaOf(db); forecasts = forecasts.map(f => ({ ...f, name_ar: meta.get(f.skill_id)?.name_ar || f.skill_id })); const { count } = await db.from('portal_org_members').select('id', { count: 'exact', head: true }).eq('organization_id', org).eq('status', 'confirmed'); members = count || 0; events = forecasts.reduce((a: number, f: any) => a + Number(f.evidence || 0), 0); }
    // «ثلاث خطوات تغيّر التوقّع»: من خطوات المهارات الذاوية أولًا ثم بقية المهارات المعروفة الاتجاه — بلا تكرار
    const order: Record<string, number> = { fading: 0, steady: 1, rising: 2, unknown: 3 }; const seen = new Set<string>(); const steps: { title_ar: string; why_ar: string; skill_ar: string; kind: string }[] = [];
    for (const f of [...(forecasts as any[])].sort((a, b) => order[a.trend] - order[b.trend])) for (const st of (f.steps || []) as any[]) { if (f.trend === 'unknown' || seen.has(st.title_ar) || steps.length >= 3) continue; seen.add(st.title_ar); steps.push({ title_ar: st.title_ar, why_ar: st.why_ar, skill_ar: f.name_ar, kind: st.kind }); }
    return NextResponse.json({ success: true, org: o || { id: org }, forecasts, line: weatherLine(forecasts as any), members, events, steps, horizon_days: 90, min_people: 5 }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // ---- بطاقة الصف لجلسة
  if (session) {
    if (!UUID.test(session)) return bad('معرّف غير صالح');
    const { data: s } = await db.from('portal_sessions').select('id,title_ar,trainer_id,created_by,program_id,skills').eq('id', session).maybeSingle(); if (!s) return bad('الجلسة غير موجودة', 404);
    if (!(await canSeeSession(db, user, s))) return bad('هذه الجلسة ليست من جلساتك', 403);
    const sessionSkills: string[] = Array.isArray((s as any).skills) ? (s as any).skills : [];
    const [{ data: regs }, meta] = await Promise.all([db.from('portal_session_registrations').select('id,user_id,email').eq('session_id', session).limit(500), skillMetaOf(db)]);
    const learners = ((regs || []) as any[]).map((r, i) => ({ key: `م${i + 1}`, user_id: r.user_id || null, email: r.email ? String(r.email).toLowerCase() : null }));
    const ids = learners.map(l => l.user_id).filter(Boolean) as string[]; const emails = learners.map(l => l.email).filter(Boolean) as string[];
    const sel = 'id,at,user_id,email,verb,object_type,object_id,skills,context';
    const [a, b] = await Promise.all([
      ids.length ? db.from('portal_learning_events').select(sel).in('user_id', ids).order('at', { ascending: false }).limit(4000) : Promise.resolve({ data: [] as any[] }),
      emails.length ? db.from('portal_learning_events').select(sel).in('email', emails).order('at', { ascending: false }).limit(4000) : Promise.resolve({ data: [] as any[] }),
    ]);
    const seen = new Set<string>(); const events: any[] = []; for (const e of [...(a.data || []), ...(b.data || [])]) { if (seen.has(e.id)) continue; seen.add(e.id); events.push(e); }
    const cards = learnerCards(events, sessionSkills, meta, learners).map(cd => ({ ...cd }));
    const summary = classSummary(cards, sessionSkills, meta);
    let focus: any[] = []; if ((s as any).program_id && sessionSkills.length) { try { const g = await loadGraph(db); focus = g.nodes.length ? sessionFocus(g, (s as any).program_id, sessionSkills) : []; } catch { focus = []; } }
    return NextResponse.json({ success: true, session: { id: s.id, title_ar: (s as any).title_ar }, skills: sessionSkills.map(id => ({ id, name_ar: meta.get(id)?.name_ar || id })), learners: learners.length, cards, summary, focus, note: cards.length ? null : 'لا مسجّلين بعد — البطاقة تظهر بعد أول تسجيل.' }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (!user.staff) return bad('هذه الصفحة للموظفين', 403);
  // ---- فجوات لهندسة البرامج
  if (gaps) {
    const g = await loadGraph(db); const list = g.nodes.length ? programGaps(g, 12) : [];
    return NextResponse.json({ success: true, gaps: list.map(x => ({ fingerprint: x.fingerprint, title_ar: x.title_ar, why_ar: x.why_ar, evidence: x.evidence, target: x.target, score: x.score })), empty: g.nodes.length ? null : 'الذاكرة فارغة — ابنِ قاعدة الأدلة أولًا من «الذاكرة الحية».' }, { headers: { 'Cache-Control': 'no-store' } });
  }
  // ---- لوحة الحلقة
  const monthStart = today().slice(0, 7) + '-01';
  const [{ data: sugg }, { data: dec }, { data: fc }, { data: tpls }] = await Promise.all([
    db.from('portal_loop_suggestions').select('*').in('status', ['draft', 'accepted', 'dismissed']).order('score', { ascending: false }).order('created_at', { ascending: false }).limit(120),
    db.from('portal_loop_decisions').select('at,kind,action,meta').gte('at', new Date(Date.parse(monthStart + 'T00:00:00Z') - 70 * 86400000).toISOString()).order('at', { ascending: false }).limit(3000),
    db.from('portal_capability_forecasts').select('organization_id,skill_id,trend,slope,people,evidence,computed_at').order('computed_at', { ascending: false }).limit(300),
    db.from('portal_mission_templates').select('id,title_ar,skills,program_id').eq('active', true).limit(100),
  ]);
  const meta = await skillMetaOf(db); const orgIds = [...new Set(((fc || []) as any[]).map(f => f.organization_id))];
  const { data: orgs } = orgIds.length ? await db.from('portal_organizations').select('id,name_ar').in('id', orgIds) : { data: [] as any[] };
  const orgName = new Map(((orgs || []) as any[]).map(o => [o.id, o.name_ar]));
  const forecasts = ((fc || []) as any[]).map(f => ({ ...f, org_ar: orgName.get(f.organization_id) || '—', skill_ar: meta.get(f.skill_id)?.name_ar || f.skill_id }));
  const learned = monthlyLearning((dec || []) as any[], monthStart);
  const stats = { draft: ((sugg || []) as any[]).filter(s => s.status === 'draft').length, accepted: ((sugg || []) as any[]).filter(s => s.status === 'accepted').length, dismissed: ((sugg || []) as any[]).filter(s => s.status === 'dismissed').length, forecasts: (fc || []).length, orgs: orgIds.length };
  return NextResponse.json({ success: true, suggestions: sugg || [], learned, forecasts, stats, templates: tpls || [], kinds: KIND_LABEL_AR, month: monthStart }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  if (!user.staff) return bad('هذه العملية للموظفين', 403);
  let body: any = {}; try { body = await req.json(); } catch { return bad('جسم الطلب غير صالح'); }
  const action = String(body.action || '');

  if (action === 'run') { const r = await runLoop(db, today(), { dry: !!body.dry }); return NextResponse.json({ success: r.ok, ...r }, { status: r.ok ? 200 : 500 }); }

  if (action === 'decide') {
    const id = String(body.id || ''); const status = String(body.status || ''); const note = body.note ? String(body.note).slice(0, 600) : null;
    if (!UUID.test(id)) return bad('معرّف غير صالح'); if (!['accepted', 'dismissed'].includes(status)) return bad('حالة غير صالحة');
    const { data: s } = await db.from('portal_loop_suggestions').select('*').eq('id', id).maybeSingle(); if (!s) return bad('الاقتراح غير موجود', 404);
    if ((s as any).status !== 'draft') return bad('هذا الاقتراح حُسم من قبل');
    let outcome: any = null;
    if (status === 'accepted') {
      const t = (s as any).target || {};
      if ((s as any).kind === 'program') {
        const need: Need = { ...EMPTY_NEED, sector: String(t.sector || EMPTY_NEED.sector), gap_ar: String(t.gap_ar || (s as any).why_ar || ''), audience_ar: String(t.audience_ar || ''), org_name: String(t.org_name || '') };
        let title = (s as any).title_ar; try { title = draftTitle(need) || title; } catch { /* قطاع خارج المعجم — نُبقي عنوان الاقتراح */ }
        const { data: d, error } = await db.from('portal_program_drafts').insert({ created_by: user.id, title_ar: title, need, stage: 'foresight', log: [{ at: new Date().toISOString(), by: user.email, what: 'من الحلقة المغلقة: ' + (s as any).title_ar }] }).select('id').maybeSingle();
        if (error) return bad('تعذّر إنشاء مسودة البرنامج: ' + error.message, 500);
        outcome = { draft_id: (d as any)?.id || null, kind: 'program_draft' };
      } else if ((s as any).kind === 'mission') {
        const tplId = String(body.template_id || ''); const emails: string[] = Array.isArray(body.emails) ? body.emails.map((e: any) => String(e).toLowerCase().trim()).filter((e: string) => /.+@.+\..+/.test(e)).slice(0, 60) : [];
        if (!UUID.test(tplId)) return bad('اختر قالب مهمة أولًا'); if (!emails.length) return bad('أدخل بريدًا واحدًا على الأقل');
        const { data: tpl } = await db.from('portal_mission_templates').select('*').eq('id', tplId).maybeSingle(); if (!tpl) return bad('القالب غير موجود', 404);
        const site = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, ''); let created = 0; const skipped: string[] = []; const failed: string[] = [];
        const { data: dup } = await db.from('portal_missions').select('email').eq('template_id', tplId).in('email', emails); const dupSet = new Set(((dup || []) as any[]).map(d => String(d.email || '').toLowerCase()));
        for (const email of emails) { if (dupSet.has(email)) { skipped.push(email); continue; } const m = await assignMission(db, tpl as any, { email }, site); if (m) created++; else failed.push(email); }
        // لا نحسم الاقتراح إن لم يُسنَد شيء — يبقى بانتظار قرار كي يعاد بمتعلمين آخرين، مع سبب صريح
        if (!created) return bad(skipped.length && !failed.length ? `لم تُسند أي مهمة: ${skipped.length === 1 ? 'هذا البريد لديه' : 'هذه العناوين لديها'} المهمة نفسها من هذا القالب مسبقًا (${skipped.join('، ')}). اختر متعلمين آخرين أو قالبًا آخر.` : `تعذّر إنشاء المهمة لـ ${failed.join('، ')}${skipped.length ? ` (ولدى ${skipped.join('، ')} المهمة مسبقًا)` : ''} — تحقق من القالب وأعد المحاولة.`, 409);
        outcome = { kind: 'missions', created, template_id: tplId, emails: emails.length, skipped, failed };
      } else { outcome = { kind: (s as any).kind, noted: true }; }
    }
    const { error: ue } = await db.from('portal_loop_suggestions').update({ status, decided_by: user.id, decided_at: new Date().toISOString(), note, outcome }).eq('id', id);
    if (ue) return bad('تعذّر حفظ القرار: ' + ue.message, 500);
    await db.from('portal_loop_decisions').insert({ suggestion_id: id, kind: (s as any).kind, action: status, by_user: user.id, meta: { note, outcome, title: (s as any).title_ar } });
    if (outcome && status === 'accepted') await db.from('portal_loop_decisions').insert({ suggestion_id: id, kind: (s as any).kind, action: 'outcome', by_user: user.id, meta: outcome });
    return NextResponse.json({ success: true, status, outcome });
  }
  return bad('إجراء غير معروف');
}
