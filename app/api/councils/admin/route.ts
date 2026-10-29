// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/councils/admin — إدارة مجالس أَثَر (طاقم فقط · P23)
 *  GET                                   → المجالس (أعضاء · جهات · نصاب · القضية الجارية) · المتقدمون · شهادات معلّقة · خريطة الحكمة (k ≥ 5) · موجز
 *  GET ?propose=1&skills=a,b|domain=x&size=5&sector=gov → المُوفِّق: تشكيلات مقترحة (لا تُحفظ)
 *  POST { action:'create', title_ar, domain?, sector_code?, skill_ids[], members:[{email,user_id?,full_name?,organization_id?}], cycle_weeks? } → مجلس «قيد التشكيل» + دعوات لتوقيع الميثاق
 *  POST { action:'add_member', id, email, full_name?, organization_id? }     → دعوة عضو
 *  POST { action:'activate', id, chair_email? }                                → انعقاد (نصاب: ≥ 3 موقّعين من ≥ 2 جهة) وبدء الدورة
 *  POST { action:'pause'|'resume'|'close', id }                                → حالة المجلس
 *  POST { action:'set_chair', id, email }                                      → تعيين الكرسي يدويًا
 *  POST { action:'close_cycle', id }                                           → إغلاق الدورة الآن (احتساب · دوران الكرسي · مرآة)
 *  POST { action:'decide_attestation', id, approve, note? }                    → اعتماد/رفض شهادة أقران (الطاقم)
 *  POST { action:'remove_member', id, email }                                  → إخراج عضو (يبقى أثره)
 *  POST { action:'wisdom_to_engineering', pattern }                            → إرسال نمط متكرر إلى هندسة البرامج التدريبية (مسودة برنامج من قضية حقيقية)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notify } from '../../../../lib/portal/notify';
import { COUNCIL_COLS, MEMBER_COLS, CASE_COLS, ATTEST_COLS, K_ANON, MIN_ORGS, COUNCIL_MIN, COUNCIL_MAX, CYCLE_WEEKS, CHARTER_VERSION, quorum, activeMembers, cycleEnd, lower, orgCount, themeLabel, STATUS_AR, THEMES_AR } from '../../../../lib/councils/registry';
import type { Council, Member, Case, Attestation } from '../../../../lib/councils/registry';
import { proposeCouncils, loadCandidates } from '../../../../lib/councils/match';
import { decideAttestation } from '../../../../lib/councils/attest';
import { closeCycle } from '../../../../lib/councils/cron';
import { wisdom } from '../../../../lib/councils/wisdom';
import { EMPTY_NEED } from '../../../../lib/portal/factory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const site = (req: Request) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, '');
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S) : null; };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function staff(req: Request, db: any) {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !U || !A) return null; const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) return null;
  return { id: data.user.id, email: lower(data.user.email), name: String((prof as any)?.full_name || ''), staff: true };
}

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const me = await staff(req, db); if (!me) return bad('غير مصرّح', 403);
  const u = new URL(req.url);
  if (u.searchParams.get('propose')) {
    const skills = String(u.searchParams.get('skills') || '').split(',').map(s => s.trim()).filter(s => UUID.test(s)); const domain = u.searchParams.get('domain') || null; const sector = u.searchParams.get('sector') || null;
    const cands = await loadCandidates(db, skills, { domain }); const proposals = proposeCouncils(cands, { size: Number(u.searchParams.get('size')) || COUNCIL_MIN, sector });
    return NextResponse.json({ success: true, candidates: cands.length, proposals, note_ar: `المُوفِّق يقترح من محفظة القدرة (مستويات متقاربة) وتنوّع الجهات (≥ ${MIN_ORGS}) والمتقدمين — والطاقم يعتمد التشكيل.` });
  }
  const [{ data: cc }, { data: mm }, { data: cases }, { data: pend }, { data: skills }, { data: orgs }] = await Promise.all([
    db.from('portal_councils').select(COUNCIL_COLS).order('created_at', { ascending: false }).limit(200),
    db.from('portal_council_members').select(MEMBER_COLS).order('created_at', { ascending: false }).limit(3000),
    db.from('portal_council_cases').select('id,council_id,status,title_ar,cycle_no,created_at,return_due_at,returned_at,theme,author_email').order('created_at', { ascending: false }).limit(2000),
    db.from('portal_council_attestations').select(ATTEST_COLS).eq('status', 'pending').order('created_at', { ascending: true }).limit(300),
    db.from('portal_skills').select('id,code,name_ar,domain').eq('active', true).order('name_ar').limit(500),
    db.from('portal_organizations').select('id,name_ar,sector').limit(500),
  ]);
  const members = (mm || []) as Member[]; const orgMap = new Map(((orgs || []) as any[]).map(o => [o.id, o.name_ar])); const skMap = new Map(((skills || []) as any[]).map(s => [s.id, s.name_ar]));
  const councils = ((cc || []) as Council[]).map(c => { const ms = members.filter(m => m.council_id === c.id); const cs = ((cases || []) as any[]).filter(x => x.council_id === c.id); const cur = cs.find(x => x.status === 'open' || x.status === 'committed') || null;
    return { ...c, status_ar: STATUS_AR[c.status], members: ms.filter(m => m.status !== 'left').map(m => ({ id: m.id, email: m.email, full_name: m.full_name, organization_id: m.organization_id, org_name: orgMap.get(m.organization_id || '') || null, role: m.role, status: m.status, signed: !!m.charter_signed_at, cycles_completed: m.cycles_completed })), orgs: orgCount(activeMembers(ms)), quorum: quorum(ms), skills: (c.skill_ids || []).map(id => ({ id, name_ar: skMap.get(id) || id })), cases: cs.length, returns: cs.filter((x: any) => x.returned_at).length, current_case: cur ? { id: cur.id, title_ar: cur.title_ar, status: cur.status, theme_ar: themeLabel(cur.theme), return_due_at: cur.return_due_at } : null }; });
  const applicants = members.filter(m => m.status === 'applied').map(m => ({ ...m, org_name: orgMap.get(m.organization_id || '') || null }));
  const pending = ((pend || []) as Attestation[]).map(a => ({ ...a, skill_ar: skMap.get(a.skill_id) || a.skill_id, council_title: ((cc || []) as Council[]).find(c => c.id === a.council_id)?.title_ar || '' }));
  const w = await wisdom(db, K_ANON);
  return NextResponse.json({ success: true, councils, applicants, pending, wisdom: w, themes: THEMES_AR.map(t => ({ code: t.code, label: t.label })), skills: skills || [], organizations: orgs || [], summary: { active: councils.filter(c => c.status === 'active').length, proposed: councils.filter(c => c.status === 'proposed').length, members: new Set(members.filter(m => m.status === 'active').map(m => lower(m.email))).size, applicants: applicants.length, pending: pending.length, cases: (cases || []).length, returns: ((cases || []) as any[]).filter(x => x.returned_at).length }, constants: { min: COUNCIL_MIN, max: COUNCIL_MAX, min_orgs: MIN_ORGS, cycle_weeks: CYCLE_WEEKS, k: K_ANON, charter: CHARTER_VERSION } }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const me = await staff(req, db); if (!me) return bad('غير مصرّح', 403);
  let body: any = {}; try { body = await req.json(); } catch { /* */ }
  const action = String(body.action || ''); const S = site(req); const now = new Date();
  const invite = async (c: { id: string; title_ar: string; cycle_weeks: number }, m: { email: string; full_name?: string | null }) => { try { await notify(db, { kind: 'council_invite', to: { email: m.email, name: m.full_name || null }, subject: `دعوة إلى مجلس «${c.title_ar}» — مجالس أَثَر`, text: `اختارك المُوفِّق لمجلس أقران من 5–7 ممارسين من جهات مختلفة، دورة ${c.cycle_weeks} أسابيع. للانضمام وقّع ميثاق المجلس (السرية · الحضور · اسأل قبل أن تنصح · الصدق في العودة): ${S}/me/council`, url: `${S}/me/council`, ref: `council_invite:${c.id}:${lower(m.email)}` }); } catch { /* */ } };

  if (action === 'create') {
    const title = String(body.title_ar || '').trim().slice(0, 140); if (title.length < 4) return bad('اكتب اسم المجلس');
    const skill_ids = (Array.isArray(body.skill_ids) ? body.skill_ids : []).map(String).filter((s: string) => UUID.test(s)); const mems = (Array.isArray(body.members) ? body.members : []).map((m: any) => ({ email: lower(m.email), user_id: m.user_id && UUID.test(String(m.user_id)) ? m.user_id : null, full_name: m.full_name ? String(m.full_name).slice(0, 120) : null, organization_id: m.organization_id && UUID.test(String(m.organization_id)) ? m.organization_id : null })).filter((m: any) => /.+@.+\..+/.test(m.email));
    const uniq = Array.from(new Map(mems.map((m: any) => [m.email, m])).values()) as any[]; if (uniq.length < 3) return bad('مجلس يحتاج 3 مدعوّين على الأقل (الهدف 5–7)'); if (uniq.length > COUNCIL_MAX + 3) return bad(`الحد الأقصى ${COUNCIL_MAX + 3} مدعوًّا`);
    const weeks = Math.max(2, Math.min(12, Number(body.cycle_weeks) || CYCLE_WEEKS));
    const { data: c, error } = await db.from('portal_councils').insert({ created_by: me.id, title_ar: title, domain: body.domain ? String(body.domain).slice(0, 40) : null, sector_code: body.sector_code ? String(body.sector_code).slice(0, 40) : null, skill_ids, status: 'proposed', cycle_weeks: weeks, max_members: Math.max(COUNCIL_MIN, Math.min(12, Number(body.max_members) || COUNCIL_MAX)), min_orgs: MIN_ORGS, charter_version: CHARTER_VERSION, meta: { proposal: body.proposal || null } }).select(COUNCIL_COLS).single();
    if (error || !c) return bad(error?.message || 'تعذّر الإنشاء', 500);
    const rows = uniq.map(m => ({ council_id: (c as any).id, user_id: m.user_id, email: m.email, full_name: m.full_name, organization_id: m.organization_id, role: 'member', status: 'invited' }));
    const { error: e2 } = await db.from('portal_council_members').insert(rows); if (e2) return bad(e2.message, 500);
    // المتقدمون الذين دُعوا: يُغلق طلبهم
    await db.from('portal_council_members').update({ status: 'left', left_at: now.toISOString(), note: 'دُعي إلى مجلس' }).is('council_id', null).eq('status', 'applied').in('email', uniq.map(m => m.email)).then(() => null, () => null);
    if (body.notify !== false) for (const m of uniq) await invite(c as any, m);
    return NextResponse.json({ success: true, council: c, invited: uniq.length });
  }
  const id = String(body.id || ''); if (!['decide_attestation', 'wisdom_to_engineering'].includes(action) && !UUID.test(id)) return bad('معرّف المجلس مطلوب');
  if (action === 'add_member') {
    const email = lower(body.email); if (!/.+@.+\..+/.test(email)) return bad('بريد غير صالح');
    const { data: c } = await db.from('portal_councils').select(COUNCIL_COLS).eq('id', id).maybeSingle(); if (!c) return bad('المجلس غير موجود', 404);
    const { data: ex } = await db.from('portal_council_members').select('id,status').eq('council_id', id).ilike('email', email).limit(1); if ((ex || []).length) return bad('مدعوّ مسبقًا', 409);
    const { data: om } = await db.from('portal_org_members').select('user_id,full_name,organization_id').ilike('email', email).eq('status', 'confirmed').limit(1); const o = (om || [])[0] as any;
    const { error } = await db.from('portal_council_members').insert({ council_id: id, user_id: body.user_id && UUID.test(String(body.user_id)) ? body.user_id : o?.user_id || null, email, full_name: body.full_name || o?.full_name || null, organization_id: body.organization_id && UUID.test(String(body.organization_id)) ? body.organization_id : o?.organization_id || null, role: 'member', status: 'invited' }); if (error) return bad(error.message, 500);
    await db.from('portal_council_members').update({ status: 'left', left_at: now.toISOString(), note: 'دُعي إلى مجلس' }).is('council_id', null).eq('status', 'applied').ilike('email', email).then(() => null, () => null);
    if (body.notify !== false) await invite(c as any, { email, full_name: body.full_name || o?.full_name });
    return NextResponse.json({ success: true });
  }
  if (action === 'remove_member') {
    const email = lower(body.email); const { error } = await db.from('portal_council_members').update({ status: 'left', left_at: now.toISOString(), role: 'member' }).eq('council_id', id).ilike('email', email); if (error) return bad(error.message, 500);
    await db.from('portal_councils').update({ chair_email: null }).eq('id', id).ilike('chair_email', email).then(() => null, () => null);
    return NextResponse.json({ success: true });
  }
  if (action === 'activate' || action === 'close_cycle' || action === 'set_chair' || action === 'pause' || action === 'resume' || action === 'close') {
    const { data: c } = await db.from('portal_councils').select(COUNCIL_COLS).eq('id', id).maybeSingle(); if (!c) return bad('المجلس غير موجود', 404); const council = c as Council;
    const { data: ms } = await db.from('portal_council_members').select(MEMBER_COLS).eq('council_id', id); const members = (ms || []) as Member[];
    if (action === 'activate') {
      const q = quorum(members); if (!q.ok && body.force !== true) return NextResponse.json({ success: false, error: `النصاب لم يكتمل: ${q.signed} موقّع من ${q.orgs} جهة (المطلوب ≥ 3 من ≥ ${MIN_ORGS}) — انتظر التوقيعات أو أرسل force:true`, quorum: q }, { status: 409 });
      const signed = activeMembers(members).filter(m => m.charter_signed_at); const chairEmail = lower(body.chair_email) || council.chair_email || (signed[0]?.email ? lower(signed[0].email) : null);
      if (chairEmail) { await db.from('portal_council_members').update({ role: 'member' }).eq('council_id', id).eq('role', 'chair'); await db.from('portal_council_members').update({ role: 'chair' }).eq('council_id', id).ilike('email', chairEmail); }
      const patch = { status: 'active', cycle_no: Math.max(1, Number(council.cycle_no) || 0), cycle_started_at: council.cycle_started_at || now.toISOString(), cycle_ends_at: council.cycle_ends_at || cycleEnd(now, council.cycle_weeks), chair_email: chairEmail };
      await db.from('portal_councils').update(patch).eq('id', id);
      for (const m of signed) { try { await notify(db, { kind: 'council_activated', to: { email: m.email, name: m.full_name }, subject: `انعقد مجلس «${council.title_ar}»`, text: `بدأت الدورة ${patch.cycle_no} (${council.cycle_weeks} أسابيع). ${chairEmail === lower(m.email) ? 'الكرسي لك: افتح القضية الأولى.' : 'انتظر القضية الأولى من الكرسي أو احمل موقفًا حقيقيًا تواجهه.'} ${S}/me/council`, url: `${S}/me/council`, ref: `council_activated:${id}` }); } catch { /* */ } }
      return NextResponse.json({ success: true, council: { ...council, ...patch }, quorum: q });
    }
    if (action === 'set_chair') { const email = lower(body.email); if (!members.some(m => lower(m.email) === email && m.status === 'active')) return bad('العضو ليس نشطًا في المجلس'); await db.from('portal_council_members').update({ role: 'member' }).eq('council_id', id).eq('role', 'chair'); await db.from('portal_council_members').update({ role: 'chair' }).eq('council_id', id).ilike('email', email); await db.from('portal_councils').update({ chair_email: email }).eq('id', id); return NextResponse.json({ success: true }); }
    if (action === 'close_cycle') { if (council.status !== 'active') return bad('المجلس غير منعقد', 409); const r = await closeCycle(db, council, now, S); return NextResponse.json({ success: true, ...r }); }
    const status = action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'closed'; await db.from('portal_councils').update({ status, meta: { ...(council.meta || {}), [`${action}_at`]: now.toISOString(), [`${action}_by`]: me.email } }).eq('id', id); return NextResponse.json({ success: true, status });
  }
  if (action === 'decide_attestation') {
    const aid = Number(body.id); const { data: a } = await db.from('portal_council_attestations').select(ATTEST_COLS).eq('id', aid).maybeSingle(); if (!a) return bad('الشهادة غير موجودة', 404);
    const { data: c } = await db.from('portal_councils').select('title_ar,skill_ids').eq('id', (a as any).council_id).maybeSingle(); const { data: sk } = await db.from('portal_skills').select('id,name_ar').eq('id', (a as any).skill_id).maybeSingle();
    const r = await decideAttestation(db, aid, { by: { id: me.id, email: me.email }, role: 'staff', approve: body.approve !== false, note: body.note }, { skill_name: (sk as any)?.name_ar || null, council_title: (c as any)?.title_ar || null }); if (!r.ok) return bad(r.error || 'تعذّر');
    try { await notify(db, { kind: 'council_attestation_decided', to: { email: (a as any).to_email }, subject: body.approve !== false ? 'اعتُمدت شهادة أقران لك' : 'لم تُعتمد شهادة أقران', text: `${body.approve !== false ? 'اعتُمدت' : 'رُفضت'} شهادة «${(sk as any)?.name_ar || ''}» من طاقم أَثَر${body.note ? ` — ${String(body.note).slice(0, 200)}` : ''}. ${S}/me/skills`, url: `${S}/me/skills`, ref: `council_att_decided:${aid}` }); } catch { /* */ }
    return NextResponse.json({ success: true, attestation: r.row });
  }
  if (action === 'wisdom_to_engineering') {
    const pattern = String(body.pattern || ''); const w = (await wisdom(db, K_ANON)).find(x => x.pattern === pattern); if (!w) return bad('النمط لم يبلغ عتبة النشر (k ≥ 5 أشخاص و≥ 2 جهة) أو غير موجود', 409);
    const { data: sc } = await db.from('portal_council_scribe').select('summary_ar,pivotal_questions,patterns,case_id').limit(500); const ex = ((sc || []) as any[]).filter(s => (s.patterns || []).includes(pattern)).slice(0, 5);
    const brief = `نمط متكرر من مجالس أَثَر: «${w.label_ar}» — ${w.cases} قضية من ${w.persons} ممارسًا في ${w.orgs} جهة عبر ${w.councils} مجلسًا.\n\nأسئلة محورية طرحها الأقران (مجهولة):\n${ex.flatMap(s => s.pivotal_questions || []).slice(0, 8).map((q: string) => `• ${q}`).join('\n')}\n\nملخصات مجهولة:\n${ex.map(s => `• ${String(s.summary_ar).slice(0, 300)}`).join('\n')}`;
    const need = { ...EMPTY_NEED, gap_ar: brief.slice(0, 1800), audience_ar: `ممارسون من ${w.orgs} جهات شاركوا في مجالس أَثَر`, org_name: 'مجالس أَثَر' };
    const { data: d, error } = await db.from('portal_program_drafts').insert({ created_by: me.id, title_ar: `برنامج من قضية حقيقية: ${w.label_ar}`.slice(0, 140), need, stage: 'foresight', log: [{ at: now.toISOString(), by: me.email, what: `من خريطة الحكمة: ${w.label_ar} (${w.cases} قضية · ${w.persons} شخصًا · ${w.orgs} جهة)` }] }).select('id').maybeSingle();
    if (error) return bad(`تعذّر إنشاء المسودة في هندسة البرامج: ${error.message}`, 500);
    return NextResponse.json({ success: true, draft_id: (d as any)?.id || null, brief, url: `${S}/admin/program-engineering` });
  }
  return bad('إجراء غير معروف');
}
