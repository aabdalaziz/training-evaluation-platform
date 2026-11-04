// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P48-أ «ملف الاعتماد الحيّ» — جامع الأدلة والقراءة/الكتابة
 *  - الأدلة لا تُنسخ: تُجمَع عند الطلب من الجداول المعتمَدة (التصميم · الوحدات · القالب · الاحتياج · الميثاق · التقارير المعتمَدة · المراجعة · النسخة · الحضور · التسجيل · محطات الأثر · سير المدرّبين وتطويرهم).
 *  - المعايير من `portal_accred_standards` (قابلة للتعديل من الإدارة) وإلا من السجلّ المدمج.
 *  - الفقرات في `portal_accred_narratives`: لا تُحفظ إلا موقَّعة. خريطة الكفايات في `portal_accred_skill_maps`.
 */
import { DEFAULT_STANDARDS, EVIDENCE_RULES, K_MIN, coverageOf, localNarrative, narrativePrompt, parseNarrative, cleanNarrativeText, narrativeMissing, cleanSkillMap, skillMapCoverage, tpsGeneral, subsOf, topsOf, eligibilityOf, fileScore, type StandardRow, type Evidence, type Narrative, type Framework, type SkillMap } from './registry';
import { myScope, templateFor, unitsOf, type Me } from '../reports/load';
import { runAi, aiUsage, logAi } from '../ai/athar';

async function safe<X>(q: PromiseLike<{ data: any; error: any }>, fb: X): Promise<X> { try { const { data, error } = await q; return error || data === null || data === undefined ? fb : (data as X); } catch { return fb; } }
const lower = (s: unknown) => String(s || '').trim().toLowerCase(); const nowIso = () => new Date().toISOString(); const day = (s: unknown) => (s ? String(s).slice(0, 10) : null);
const STD_COLS = 'framework,code,parent,title_ar,text_ar,weight,sort,source,active'; const NAR_COLS = 'id,program_id,framework,code,text_ar,evidence_ids,signed_by,signed_name,signed_at,source,updated_at';

export async function standardsRows(db: any): Promise<StandardRow[]> {
  // السجلّ المدمج أساسٌ، وصفوف القاعدة تعلوه (تعديل الإدارة) — فلا يختفي إطار إن بُذر الآخر وحده، ويُخفى ما عُطّل (active=false)
  const rows = await safe<any[]>(db.from('portal_accred_standards').select(STD_COLS).order('sort', { ascending: true }).limit(200), []);
  if (!rows.length) return DEFAULT_STANDARDS; const m = new Map<string, StandardRow>(DEFAULT_STANDARDS.map(s => [`${s.framework}:${s.code}`, s]));
  for (const r of rows) { const k = `${r.framework}:${r.code}`; if (r.active === false) { m.delete(k); continue; } const base = m.get(k); m.set(k, { framework: r.framework as Framework, code: String(r.code), parent: r.parent ? String(r.parent) : base?.parent ?? null, title_ar: String(r.title_ar || base?.title_ar || ''), text_ar: String(r.text_ar || r.title_ar || base?.text_ar || ''), weight: r.weight === null || r.weight === undefined ? base?.weight ?? null : Number(r.weight), sort: Number(r.sort ?? base?.sort ?? 0), source: r.source === 'draft' ? 'draft' : 'official' }); }
  return Array.from(m.values()).sort((a, b) => a.framework.localeCompare(b.framework) || a.sort - b.sort);
}
export async function updateStandard(db: any, me: Me, b: { framework: unknown; code: unknown; title_ar?: unknown; text_ar?: unknown; source?: unknown }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!me.staff) return { ok: false, error: 'غير مصرّح' }; const fw = String(b.framework) as Framework; const code = String(b.code || '').slice(0, 10); const base = DEFAULT_STANDARDS.find(s => s.framework === fw && s.code === code); if (!base) return { ok: false, error: 'معيار غير معروف' };
  const row = { framework: fw, code, parent: base.parent, title_ar: String(b.title_ar ?? base.title_ar).slice(0, 160) || base.title_ar, text_ar: String(b.text_ar ?? base.text_ar).slice(0, 1200) || base.text_ar, weight: base.weight, sort: base.sort, source: b.source === 'draft' ? 'draft' : 'official', active: true, updated_at: nowIso(), updated_by: me.id };
  const { error } = await db.from('portal_accred_standards').upsert(row, { onConflict: 'framework,code' }); return error ? { ok: false, error: error.message } : { ok: true };
}
/** من يرى ملف البرنامج: مدرّب على شعبة فيه أو الطاقم */
export async function canSeeProgram(db: any, me: Me, programId: string): Promise<boolean> { if (me.staff) return true; const sc = await myScope(db, me); return sc.programs.some(p => String(p.id) === programId); }

/* ───────── جامع الأدلة ───────── */
export async function collectEvidence(db: any, program: any): Promise<{ evidence: Evidence[]; facts: { cohorts_done: number; graduates_feedback: number; has_units: boolean; trainers: number } }> {
  const pid = String(program.id); const ev: Evidence[] = []; const push = (e: Omit<Evidence, 'id'> & { id?: string }) => ev.push({ ...e, id: e.id || `${e.kind}:${ev.length + 1}`, codes: Array.from(new Set(e.codes)) });
  const [units, tpl, drafts, needs, reports, versions, rooms, enrolls, sessions, afters] = await Promise.all([
    unitsOf(db, pid), templateFor(db, program), safe<any[]>(db.from('portal_program_drafts').select('id,stage,design,updated_at').eq('program_id', pid).limit(3), []),
    safe<any[]>(db.from('portal_needs').select('id,status,created_at').eq('program_id', pid).in('status', ['adopted', 'born']).limit(20), []),
    safe<any[]>(db.from('portal_reports').select('id,kind,status,approved_at,period_to,verify_code,author_email,students,body,week_no').eq('program_id', pid).eq('status', 'approved').limit(400), []),
    safe<any[]>(db.from('portal_program_versions').select('id,version,created_at,review_code,cohort_no').eq('program_id', pid).order('version', { ascending: false }).limit(20), []),
    safe<any[]>(db.from('classrooms').select('id,trainer_id').eq('program_id', pid).limit(100), []),
    safe<any[]>(db.from('portal_enrollments').select('id,status,classroom_id,placed_at,created_at').eq('program_id', pid).limit(1000), []),
    safe<any[]>(db.from('attendance_sessions').select('id,session_date,status').eq('program_id', pid).limit(500), []),
    safe<any[]>(db.from('portal_after_stations').select('id,station,state,written_at').eq('program_id', pid).not('state', 'is', null).limit(1000), []),
  ]);
  const hours = units.reduce((a, u) => a + (Number(u.hours) || 0), 0);
  if (program.program_type) push({ kind: 'program', codes: hours > 0 || program.program_type === 'diploma' ? ['1.1'] : [], label_ar: `نوع البرنامج «${program.program_type}»${hours ? ` · ${hours} ساعة من الوحدات` : ''}`, at: day(program.start_date), href: `/programs/${pid}` });
  if (units.length) push({ kind: 'units', codes: ['1.1', '1.4', '1.6'], label_ar: `${units.length} وحدة بنواتج قابلة للملاحظة (${hours} ساعة)`, at: null, href: '/me/reports#diploma', n: units.length });
  for (const d of drafts) if (d.design) { push({ kind: 'design', codes: ['1.4', ...(Array.isArray(d.design.assessment_ar) && d.design.assessment_ar.length ? ['1.6'] : []), ...(Array.isArray(d.design.outcomes_ar) && d.design.outcomes_ar.length ? ['1.1'] : [])], label_ar: `تصميم معتمَد في هندسة البرامج (${d.stage})`, at: day(d.updated_at), href: '/dashboard' }); break; }
  if (tpl.skills.length) push({ kind: 'template', codes: ['1.6', ...(tpl.strategies.length ? ['1.5'] : [])], label_ar: `قالب البرنامج: ${tpl.skills.length} كفاية${tpl.strategies.length ? ` · ${tpl.strategies.length} استراتيجية` : ''}`, at: null, href: '/me/reports', n: tpl.skills.length });
  if (needs.length) push({ kind: 'need', codes: ['1.2'], label_ar: `${needs.length === 1 ? 'احتياج معلَن' : `${needs.length} احتياجات معلَنة`} من الممارسين تبنّاها البرنامج`, at: day(needs[0].created_at), href: '/needs', n: needs.length });
  if (program.organization_id) { const ch = await safe<any[]>(db.from('portal_org_charters').select('id,signed_at,status').eq('organization_id', String(program.organization_id)).eq('status', 'active').limit(1), []); if (ch.length) push({ kind: 'charter', codes: ['1.2', '2.5'], label_ar: 'الجهة موقِّعة على ميثاق أَثَر', at: day(ch[0].signed_at), href: '/org' }); }
  const by = (k: string) => reports.filter(r => r.kind === k);
  const weekly = by('weekly'), finals = by('final'), du = by('diploma_unit'), pulses = by('diploma_pulse'), profiles = by('diploma_profile'), reviews = by('program_review');
  const hasDecision = (r: any, kinds: string[]) => Array.isArray(r.students) && r.students.some((s: any) => kinds.includes(String(s.decision || s.placement || '')));
  if (weekly.length) push({ kind: 'weekly', codes: ['2.1', '2.2', '4.4', ...(weekly.some(r => hasDecision(r, ['support', 'promote', 'repeat'])) ? ['3.3', '3.1'] : [])], label_ar: `${weekly.length} تقرير تعلّم أسبوعي معتمَد`, at: day(weekly[weekly.length - 1].approved_at), href: '/me/reports', n: weekly.length });
  if (du.length) push({ kind: 'diploma_unit', codes: ['2.2', '1.6', '4.4', ...(du.some(r => hasDecision(r, ['support', 'repeat'])) ? ['3.3', '2.2'] : [])], label_ar: `${du.length} تقرير وحدة معتمَد`, at: day(du[du.length - 1].approved_at), href: '/me/reports#diploma', n: du.length });
  if (pulses.length) push({ kind: 'pulse', codes: ['3.4'], label_ar: `${pulses.length} نبض أسبوع (متابعة الانتظام)`, at: day(pulses[pulses.length - 1].approved_at), href: '/me/reports#diploma', n: pulses.length });
  if (finals.length) push({ kind: 'final', codes: ['2.1', '2.5'], label_ar: `${finals.length} تقرير ختامي معتمَد بتوصيات`, at: day(finals[finals.length - 1].approved_at), href: '/me/reports#final', n: finals.length });
  if (profiles.length >= K_MIN) push({ kind: 'profile', codes: ['2.2', '3.2'], label_ar: `${profiles.length} كشف كفايات معتمَدًا للخريجين`, at: day(profiles[profiles.length - 1].approved_at), href: '/me/reports#diploma', n: profiles.length });
  for (const r of reviews) push({ kind: 'review', codes: ['2.6', '2.5'], label_ar: `مراجعة البرنامج بعد الدفعة ${r.week_no || ''} — معتمَدة`, at: day(r.approved_at), href: r.verify_code ? `/verify/report/${r.verify_code}` : '/me/reports#reviews' });
  for (const v of versions) push({ kind: 'version', codes: ['2.1', '2.6', '1.4'], label_ar: `النسخة ${v.version} طُبِّقت من مراجعة الدفعة ${v.cohort_no}`, at: day(v.created_at), href: v.review_code ? `/verify/report/${v.review_code}` : `/programs/${pid}` });
  const closed = sessions.filter(s => String(s.status || '').toLowerCase() !== 'cancelled'); if (closed.length) { const recs = await safe<any[]>(db.from('attendance_records').select('id,status,session_id').in('session_id', closed.slice(0, 200).map(s => s.id)).limit(5000), []); const present = recs.filter(r => ['present', 'late', 'PRESENT', 'LATE'].includes(String(r.status))).length; const people = new Set(recs.map(r => String(r.id))).size; if (people >= K_MIN) push({ kind: 'attendance', codes: ['3.4'], label_ar: `${closed.length} جلسة · حضور ${recs.length ? Math.round((present / recs.length) * 100) : 0}%`, at: day(closed[closed.length - 1].session_date), href: '/attend', n: closed.length }); }
  const approved = enrolls.filter(e => ['approved', 'placed', 'active', 'completed'].includes(String(e.status))); const placed = approved.filter(e => e.classroom_id || e.placed_at);
  if (approved.length >= K_MIN) push({ kind: 'enrollment', codes: ['3.1'], label_ar: `${approved.length} مقبولًا · ${placed.length} منسَّبًا إلى شعب`, at: null, href: '/admin', n: approved.length });
  if (afters.length >= K_MIN) push({ kind: 'after', codes: ['3.5', '3.2'], label_ar: `${afters.length} محطة أثر بعد البرنامج (90 يومًا/السنة) أجاب عنها الخريجون`, at: day(afters[afters.length - 1].written_at), href: '/me/after', n: afters.length });
  const tids = Array.from(new Set(rooms.map(r => String(r.trainer_id || '')).filter(Boolean))); let trainersN = 0;
  if (tids.length) {
    const trs = await safe<any[]>(db.from('trainers').select('id,email,name').in('id', tids).limit(50), []); const emails = trs.map(t => lower(t.email)).filter(Boolean); trainersN = trs.length;
    if (emails.length) {
      const profs = await safe<any[]>(db.from('portal_directory_profiles').select('id,email,status,slug').in('email', emails).eq('status', 'approved').limit(50), []);
      if (profs.length) push({ kind: 'trainer', codes: ['4.1'], label_ar: `${profs.length} من ${trs.length} مدرّبين سيرهم موثَّقة ومعتمَدة في هيئة أَثَر`, at: null, href: '/trainers', n: profs.length });
      const [reh, att] = await Promise.all([safe<any[]>(db.from('portal_rehearsals').select('id,email,partner_email,status').in('status', ['done', 'reported']).limit(500), []), safe<any[]>(db.from('portal_council_attestations').select('id,to_email,status').in('to_email', emails).eq('status', 'approved').limit(100), [])]);
      const rehN = reh.filter(r => emails.includes(lower(r.email)) || emails.includes(lower(r.partner_email))).length;
      if (rehN + att.length > 0) push({ kind: 'trainer_pd', codes: ['4.3'], label_ar: `تطوير مهني للمدرّبين: ${rehN ? `${rehN} بروفة` : ''}${rehN && att.length ? ' · ' : ''}${att.length ? `${att.length} شهادة قرين` : ''}`, at: null, href: '/me/rehearsal', n: rehN + att.length });
    }
  }
  return { evidence: ev, facts: { cohorts_done: reviews.length || (finals.length ? 1 : 0), graduates_feedback: afters.length >= K_MIN ? afters.length : 0, has_units: units.length > 0, trainers: trainersN } };
}
/* ───────── الملف ───────── */
export async function narrativesOf(db: any, programId: string): Promise<Narrative[]> { const rows = await safe<any[]>(db.from('portal_accred_narratives').select(NAR_COLS).eq('program_id', programId).limit(100), []); return rows.map(r => ({ framework: r.framework, code: String(r.code), text_ar: String(r.text_ar || ''), evidence_ids: Array.isArray(r.evidence_ids) ? r.evidence_ids : [], signed_by: r.signed_by || null, signed_name: r.signed_name || null, signed_at: r.signed_at || null, source: r.source === 'ai' ? 'ai' : r.source === 'local' ? 'local' : 'human' })); }
export async function skillMapOf(db: any, programId: string): Promise<SkillMap> { const r = await safe<any>(db.from('portal_accred_skill_maps').select('map').eq('program_id', programId).maybeSingle(), null); return r?.map && typeof r.map === 'object' ? r.map : {}; }
export async function fileFor(db: any, me: Me, programId: string) {
  if (!(await canSeeProgram(db, me, programId))) return { ok: false as const, error: 'غير مصرّح' };
  const program = await safe<any>(db.from('programs').select('id,name_ar,program_type,start_date,end_date,organization_id').eq('id', programId).maybeSingle(), null); if (!program) return { ok: false as const, error: 'البرنامج غير موجود' };
  const [rows, nars, map, tpl] = await Promise.all([standardsRows(db), narrativesOf(db, programId), skillMapOf(db, programId), templateFor(db, program)]);
  const { evidence, facts } = await collectEvidence(db, program); const tps = tpsGeneral(rows); const smc = skillMapCoverage(map, tps.map(t => t.code));
  if (smc.n > 0) evidence.push({ id: 'skill_map:1', kind: 'skill_map', codes: ['1.1'], label_ar: `كفايات البرنامج تغطّي ${smc.n} من ${smc.total} معايير المعلّم العامة`, at: null, href: '#tps', n: smc.n });
  const signed = new Set(nars.filter(n => n.framework === 'pas' && n.signed_at).map(n => n.code)); const cov = coverageOf(rows, evidence, signed);
  return { ok: true as const, program: { id: String(program.id), name_ar: String(program.name_ar || ''), program_type: program.program_type || null }, standards: rows.filter(r => r.framework === 'pas'), tps, coverage: cov, score: fileScore(cov), eligibility: eligibilityOf({ program_type: program.program_type || null, ...facts }), narratives: nars, skill_map: map, skills: tpl.skills, skill_map_coverage: smc, evidence_n: evidence.length, can_edit: true, updated_at: nowIso() };
}
export async function draftNarrative(db: any, me: Me, b: { program_id: string; code: unknown; local?: boolean }): Promise<{ ok: true; text_ar: string; source: 'local' | 'ai' } | { ok: false; error: string }> {
  const f = await fileFor(db, me, b.program_id); if (!f.ok) return f; const code = String(b.code || ''); const std = f.standards.find(s => s.code === code); if (!std) return { ok: false, error: 'معيار غير معروف' };
  const top = code.split('.')[0]; const cov = f.coverage.find(c => c.code === top); if (!cov) return { ok: false, error: 'معيار غير معروف' }; const subs = std.parent ? cov.subs.filter(s => s.code === code) : cov.subs; const local = localNarrative(std, subs); if (b.local) return { ok: true, text_ar: local, source: 'local' };
  const usage = await aiUsage(db, me.id, 'accreditation_narrative'); if (!usage.allowed) return { ok: true, text_ar: local, source: 'local' };
  const res = await runAi<string>({ system: 'أنت محرّر جودة في منشأة تدريب سعودية. تكتب بالعربية الفصحى، من الأدلة المعطاة فقط، بلا أسماء أشخاص، وتذكر النواقص صراحةً. أعد النصّ فقط.', user: narrativePrompt(std, std.parent ? [std] : subsOf(f.standards, 'pas', code), subs), parse: (raw) => { const t = parseNarrative(raw); return t.length >= 40 ? t : null; }, local: () => local, budgetMs: 20000 });
  await logAi(db, { user_id: me.id, email: me.email, role: me.staff ? 'staff' : 'trainer', purpose: 'accreditation_narrative', result: res, context: { program: b.program_id, code } });
  return { ok: true, text_ar: res.data || local, source: res.source === 'ai' ? 'ai' : 'local' };
}
export async function signNarrative(db: any, me: Me, b: { program_id: string; framework?: unknown; code: unknown; text_ar: unknown; source?: unknown }): Promise<{ ok: true; narrative: Narrative } | { ok: false; error: string }> {
  const f = await fileFor(db, me, b.program_id); if (!f.ok) return f; const fw: Framework = b.framework === 'tps' ? 'tps' : 'pas'; const code = String(b.code || '').slice(0, 10);
  const all = fw === 'pas' ? f.standards : f.tps; if (!all.some(s => s.code === code) && !(fw === 'pas' && EVIDENCE_RULES[code])) return { ok: false, error: 'معيار غير معروف' };
  const text_ar = cleanNarrativeText(b.text_ar); const miss = narrativeMissing(text_ar); if (miss.length) return { ok: false, error: miss[0] };
  const ids = fw === 'pas' ? (f.coverage.find(c => c.code === code)?.subs.flatMap(s => s.evidence.map(e => e.id)) || f.coverage.find(c => c.subs.some(s => s.code === code))?.subs.find(s => s.code === code)?.evidence.map(e => e.id) || []) : [];
  const row = { program_id: b.program_id, framework: fw, code, text_ar, evidence_ids: ids, signed_by: me.id, signed_name: me.name || me.email, signed_at: nowIso(), source: b.source === 'ai' ? 'ai' : b.source === 'local' ? 'local' : 'human', updated_at: nowIso() };
  const { data, error } = await db.from('portal_accred_narratives').upsert(row, { onConflict: 'program_id,framework,code' }).select(NAR_COLS).maybeSingle(); if (error) return { ok: false, error: error.message };
  const r = data || row; return { ok: true, narrative: { framework: fw, code, text_ar, evidence_ids: ids, signed_by: r.signed_by, signed_name: r.signed_name, signed_at: r.signed_at, source: r.source } };
}
export async function saveSkillMap(db: any, me: Me, b: { program_id: string; map: unknown }): Promise<{ ok: true; map: SkillMap } | { ok: false; error: string }> {
  const f = await fileFor(db, me, b.program_id); if (!f.ok) return f; const map = cleanSkillMap(b.map, f.skills.map(s => s.code), f.tps.map(t => t.code));
  const { error } = await db.from('portal_accred_skill_maps').upsert({ program_id: b.program_id, map, updated_at: nowIso(), updated_by: me.id }, { onConflict: 'program_id' }); return error ? { ok: false, error: error.message } : { ok: true, map };
}
/** قائمة الطاقم: كل البرامج المنتهية بمؤهل (دبلوم) + ما في نطاق الطاقم، مع تغطية موجزة */
export async function adminFiles(db: any, me: Me) {
  if (!me.staff) return { ok: false as const, error: 'غير مصرّح' };
  const progs = await safe<any[]>(db.from('programs').select('id,name_ar,program_type,start_date,end_date,organization_id').eq('program_type', 'diploma').order('start_date', { ascending: false }).limit(40), []);
  const rows = await standardsRows(db); const out: any[] = [];
  for (const p of progs.slice(0, 12)) { const [{ evidence, facts }, nars] = await Promise.all([collectEvidence(db, p), narrativesOf(db, String(p.id))]); const cov = coverageOf(rows, evidence, new Set(nars.filter(n => n.framework === 'pas' && n.signed_at).map(n => n.code))); out.push({ id: String(p.id), name_ar: String(p.name_ar || ''), score: fileScore(cov), standards: cov.map(c => ({ code: c.code, pct: c.pct, met: c.met, total: c.subs.length })), eligible: eligibilityOf({ program_type: p.program_type, ...facts }).every(x => x.ok), signed: nars.filter(n => n.signed_at).length }); }
  const weakest = topsOf(rows, 'pas').map(t => ({ code: t.code, title_ar: t.title_ar, avg: out.length ? Math.round(out.reduce((a, f) => a + (f.standards.find((s: any) => s.code === t.code)?.pct || 0), 0) / out.length) : 0 })).sort((a, b) => a.avg - b.avg);
  return { ok: true as const, files: out, weakest, standards: rows };
}
