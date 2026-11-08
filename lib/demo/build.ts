// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P69 «غرفة العرض» — بناء المستأجر التجريبي «قيادة افتراضية — المنطقة س» ومحوه.
 *  المبدأ: ما يُوقَّع أو يُختم يمرّ عبر المسار الحقيقي نفسه (createCodes · savePolicy · createInvite · freezeForm · swapItem ·
 *  startSession/answerSession/finishSession · issueReport · decideReport)، وبيانات القياس (تسجيلات · حضور · قبلي/بعدي · نقل الأثر ·
 *  استبيان ختامي · سطور التطبيق) تُكتب مباشرة بتواريخ نسبية إلى «ساعة الصفر». كل معرّف يُنشأ يُسجَّل في «البيان» (manifest)،
 *  والمحو لا يلمس صفًّا ليس فيه. لا ذكاء اصطناعي · لا أسماء · الحسابات على النطاق المحجوز @region-x.id.athar-portal.sa */
import { createHash } from 'crypto';
import { createCodes } from '../org/roster';
import { savePolicy } from '../org/policy';
import { createInvite } from '../miaar/invites';
import { freezeForm, alternativesFor, swapItem, liveFormForInvite } from '../miaar/forms';
import { startSession, loadSession, answerSession, finishSession } from '../miaar/engine';
import { loadApprovedPool, invalidatePoolCache } from '../miaar/bank';
import { getRules } from '../miaar/rules';
import { issueReport, decideReport, DECISIONS } from '../org/report';
import { securityEvent } from '../shield/guard';
import { DEMO_SLUG, DEMO_ORG, DEMO_POLICY, DEMO_LEARNERS, DEMO_PRESENTERS, DEMO_LOGO, DEMO_PROGRAMS, DEMO_VOICES_AR, DEMO_PATH, STALE_DAYS, trainingNo, presenterNo, rng, bandOf, dayIso, atIso, pathWith } from './script';

type Db = any;
export type Who = { id: string; email?: string | null };
export type Manifest = { org_id?: string; user_ids: string[]; member_ids: string[]; program_ids: string[]; classroom_ids: string[]; enrollment_ids: string[]; attendance_session_ids: string[]; assessment_ids: string[]; followup_ids: string[]; evaluation_ids: string[]; line_ids: number[]; invite_ids: string[]; form_ids: string[]; session_ids: string[]; report_codes: string[]; seal_codes: string[]; form_code?: string | null; prev_report?: string | null; emails: string[]; programs?: Record<string, string>; classrooms?: Record<string, string>; invite_codes?: Record<string, string>; sessions_done?: number[]; sessions_finished?: number };
export type RunRow = { id: number; slug: string; status: 'building' | 'ready' | 'destroying' | 'destroyed' | 'failed'; step_ar: string | null; log: LogEntry[]; manifest: Manifest; presenters: Presenter[]; anchor: string; built_by: string | null; built_at: string | null; destroyed_at: string | null; error_ar: string | null; created_at: string; updated_at: string };
export type LogEntry = { at: string; step: string; ok: boolean; n?: number; note_ar?: string };
export type Presenter = { training_no: string; pin: string; role: 'org_admin' | 'learner'; label_ar: string };
export const STEPS_AR: Record<string, string> = { org: 'الجهة والسياسة المختومة', codes: 'الرموز التدريبية والحسابات', programs: 'البرامج والقاعات والتسجيلات', attendance: 'الحضور', impact: 'القياس القبلي والبعدي', transfer: 'نقل الأثر (مشرف ومتدرّب)', survey: 'الاستبيان الختامي', voices: 'سطور التطبيق الميداني', miaar: 'دعوتا مِعيار والنموذج المثبَّت', sessions: 'جلسات الاجتياز (24)', report: 'تقرير القيادة السابق وقراره', done: 'اكتمل' };
export const STEP_ORDER = ['org', 'codes', 'programs', 'attendance', 'impact', 'transfer', 'survey', 'voices', 'miaar', 'sessions', 'report'];

const nowIso = () => new Date().toISOString();
const emptyManifest = (): Manifest => ({ user_ids: [], member_ids: [], program_ids: [], classroom_ids: [], enrollment_ids: [], attendance_session_ids: [], assessment_ids: [], followup_ids: [], evaluation_ids: [], line_ids: [], invite_ids: [], form_ids: [], session_ids: [], report_codes: [], seal_codes: [], emails: [] });
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const syntheticEmail = (no: string) => `${no.toLowerCase()}@${DEMO_SLUG}.id.athar-portal.sa`;
async function safe<T>(fn: () => Promise<any>, fb: T): Promise<T> { try { const r = await fn(); if (r && typeof r === 'object' && 'data' in r) return (r.data ?? fb) as T; return (r ?? fb) as T; } catch { return fb; } }
const chunk = <T,>(xs: T[], n = 200) => { const out: T[][] = []; for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n)); return out; };

/* ───────────── الحالة ───────────── */
export async function currentRun(db: Db): Promise<RunRow | null> {
  const { data } = await db.from('portal_demo_runs').select('*').eq('slug', DEMO_SLUG).in('status', ['building', 'ready', 'destroying', 'failed']).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return (data as RunRow) || null;
}
export function staleDays(run: RunRow | null, now = new Date()): number | null { if (!run?.built_at) return null; return Math.floor((now.getTime() - Date.parse(run.built_at)) / 86400000); }
export async function demoStatus(db: Db, site: string, now = new Date()) {
  const run = await currentRun(db); const days = staleDays(run, now);
  const codes = { form: run?.manifest?.form_code || null, report: run?.manifest?.prev_report || null };
  return { run: run ? { ...run, presenters: run.status === 'ready' ? run.presenters : [] } : null, stale: days !== null && days > STALE_DAYS, days, steps: STEP_ORDER.map((k) => ({ key: k, label_ar: STEPS_AR[k], done: !!run?.log?.some((l) => l.step === k && l.ok) })), path: pathWith(DEMO_PATH, codes), site, org: DEMO_ORG, slug: DEMO_SLUG, learners: DEMO_LEARNERS, presenters_n: DEMO_PRESENTERS };
}
async function setRun(db: Db, id: number, patch: Record<string, unknown>) { await db.from('portal_demo_runs').update({ ...patch, updated_at: nowIso() }).eq('id', id); }

/* ───────────── البناء — خطوة في كل نداء (حدود زمن الدوالّ على Vercel) ───────────── */
export type BuildOpts = { by: Who; env?: Record<string, string | undefined>; site: string; now?: Date; rand?: (n: number) => Buffer };
type Ctx = { db: Db; o: BuildOpts; run: RunRow; m: Manifest; log: LogEntry[]; anchor: Date; R: () => number; presenters: Presenter[] };
const SESSIONS_PER_CALL = 4;
export const STALL_SECONDS = 90;
const rosterOf = (code: string): number[] => { for (const p of DEMO_PROGRAMS) for (const c of p.classrooms) if (c.code === code) return Array.from({ length: c.learners[1] - c.learners[0] + 1 }, (_, k) => c.learners[0] + k); return []; };
const ALL_A = () => [...rosterOf('RX-A1'), ...rosterOf('RX-A2')];
async function usersOf(db: Db, orgId: string): Promise<Map<string, string>> { const rows = await safe<any[]>(() => db.from('portal_org_codes').select('training_no,user_id').eq('organization_id', orgId).limit(100), []); return new Map(rows.filter((r) => r.user_id).map((r) => [String(r.training_no), String(r.user_id)])); }
export function nextStep(log: LogEntry[]): string | null { for (const k of STEP_ORDER) if (!log.some((l) => l.step === k && l.ok)) return k; return null; }

/** يفتح سجلّ بناء جديدًا (أو يعيد الجاري) ثم ينفّذ خطوة واحدة. العميل يكرّر النداء حتى done=true */
export async function buildStep(db: Db, o: BuildOpts): Promise<{ ok: true; done: boolean; step: string | null; step_ar: string; run: RunRow } | { ok: false; error: string; status?: number }> {
  let run = await currentRun(db);
  if (run && run.status === 'ready') return { ok: false, error: 'المشهد مبنيّ بالفعل — امحُه أو أعد بناءه', status: 409 };
  if (run && run.status === 'destroying') return { ok: false, error: 'المحو جارٍ — انتظر اكتماله', status: 409 };
  if (run && run.status === 'failed') { await setRun(db, run.id, { status: 'destroyed', destroyed_at: nowIso() }); run = null; }
  const now = o.now || new Date();
  if (!run) {
    const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const ins = await db.from('portal_demo_runs').insert({ slug: DEMO_SLUG, status: 'building', step_ar: STEPS_AR.org, anchor: dayIso(anchor, 0), built_by: o.by.id, manifest: emptyManifest(), log: [], presenters: [] }).select('*').single();
    if (ins.error || !ins.data) return { ok: false, error: 'تعذّر فتح سجلّ البناء (هل نُفِّذ p69-demo-tenant.sql؟)', status: 500 };
    run = ins.data as RunRow;
  }
  const m: Manifest = { ...emptyManifest(), ...(run.manifest || {}) }; const log: LogEntry[] = arr<LogEntry>(run.log); const presenters: Presenter[] = arr<Presenter>(run.presenters);
  const anchor = new Date(`${run.anchor}T00:00:00Z`); const ctx: Ctx = { db, o, run, m, log, anchor, R: rng(`athar-demo:${run.anchor}:${log.length}`), presenters };
  const step = nextStep(log); if (!step) { await setRun(db, run.id, { status: 'ready', step_ar: STEPS_AR.done, built_at: run.built_at || nowIso() }); return { ok: true, done: true, step: null, step_ar: STEPS_AR.done, run: { ...run, status: 'ready' } }; }
  try {
    const r = await STEP_FN[step](ctx);
    if (r.partial) { await setRun(db, run.id, { manifest: m, log, step_ar: STEPS_AR[step], presenters }); return { ok: true, done: false, step, step_ar: STEPS_AR[step], run: { ...run, manifest: m, log } }; }
    log.push({ at: nowIso(), step, ok: true, n: r.n, note_ar: r.note_ar });
    const nxt = nextStep(log);
    if (!nxt) {
      await setRun(db, run.id, { status: 'ready', step_ar: STEPS_AR.done, built_at: nowIso(), presenters, manifest: m, log });
      await securityEvent(db, { severity: 'info', kind: 'demo_built', actor: o.by.email || o.by.id, user_id: o.by.id, meta: { org_id: m.org_id, users: m.user_ids.length, programs: m.program_ids.length, sessions: m.session_ids.length, form: m.form_code, report: m.prev_report } }, o.env);
      const fresh = await db.from('portal_demo_runs').select('*').eq('id', run.id).maybeSingle();
      return { ok: true, done: true, step: null, step_ar: STEPS_AR.done, run: (fresh.data as RunRow) || { ...run, status: 'ready', manifest: m, log, presenters } };
    }
    await setRun(db, run.id, { manifest: m, log, step_ar: STEPS_AR[nxt], presenters });
    return { ok: true, done: false, step: nxt, step_ar: STEPS_AR[nxt], run: { ...run, manifest: m, log } };
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 300);
    await setRun(db, run.id, { status: 'failed', error_ar: msg, manifest: m, log, presenters });
    /* فشل = نمحو تلقائيًا ما أنشأناه حتى الآن حتى لا تبقى بقايا */
    try { await destroyManifest(db, m); await setRun(db, run.id, { status: 'destroyed', destroyed_at: nowIso() }); } catch { /* يبقى failed ليُمحى يدويًا */ }
    return { ok: false, error: `توقّف البناء عند «${STEPS_AR[step]}»: ${msg}`, status: 500 };
  }
}
/** للاختبارات والسكربتات: يكرّر الخطوات حتى النهاية */
export async function buildDemo(db: Db, o: BuildOpts, maxCalls = 60): Promise<{ ok: true; run: RunRow } | { ok: false; error: string; status?: number }> {
  for (let i = 0; i < maxCalls; i++) { const r = await buildStep(db, o); if (!r.ok) return r; if (r.done) return { ok: true, run: r.run }; }
  return { ok: false, error: 'تجاوز عدد النداءات', status: 500 };
}

type StepOut = { n?: number; note_ar?: string; partial?: boolean };
const STEP_FN: Record<string, (c: Ctx) => Promise<StepOut>> = {
  /* 1) الجهة + السياسة المختومة + الشعار */
  async org({ db, o, m }) {
    const org = await db.from('portal_organizations').insert({ name_ar: DEMO_ORG.name_ar, name_en: DEMO_ORG.name_en, sector: DEMO_ORG.sector, city: DEMO_ORG.city, slug: DEMO_SLUG, demo: true, active: true, logo: DEMO_LOGO, notes: 'مستأجر تجريبي للعرض — يُبنى ويُمحى من /admin/demo' }).select('id,name_ar,slug').single();
    if (org.error || !org.data) throw new Error(`org: ${org.error?.message || 'no row'}`); m.org_id = String(org.data.id);
    const pol = await savePolicy(db, { org_id: m.org_id, policy: DEMO_POLICY, by: o.by, env: o.env, site: o.site, rand: o.rand }); if (pol.ok && pol.seal?.code) m.seal_codes.push(pol.seal.code);
    return { n: 1, note_ar: pol.ok ? `ختم السياسة ${pol.seal?.code || ''}` : 'السياسة بلا ختم' };
  },
  /* 2) الرموز: 36 منسوبًا + 5 عارضين (الأول مدير الجهة) */
  async codes({ db, o, m, presenters }) {
    const orgLite = { id: m.org_id!, name_ar: DEMO_ORG.name_ar, name_en: DEMO_ORG.name_en, slug: DEMO_SLUG, policy: DEMO_POLICY as any };
    const numbers = [...Array.from({ length: DEMO_LEARNERS }, (_, i) => trainingNo(i + 1)), ...Array.from({ length: DEMO_PRESENTERS }, (_, i) => presenterNo(i + 1))];
    const created = await createCodes(db, { org: orgLite as any, numbers, by: o.by, env: o.env, rand: o.rand });
    const userOf = await usersOf(db, m.org_id!); m.user_ids = [...new Set([...m.user_ids, ...userOf.values()])];
    const mem = await safe<any[]>(() => db.from('portal_org_members').select('id,full_name').eq('organization_id', m.org_id).limit(100), []); m.member_ids = mem.map((x) => String(x.id));
    presenters.length = 0; for (const p of created.created) { const i = numbers.indexOf(p.training_no) - DEMO_LEARNERS; if (i >= 0) presenters.push({ training_no: p.training_no, pin: p.pin, role: i === 0 ? 'org_admin' : 'learner', label_ar: i === 0 ? 'رئيس اللجنة — مدير الجهة (يختم القرار)' : `عارض ${i + 1} — منسوب` }); }
    const adminMember = mem.find((x) => String(x.full_name) === presenterNo(1)); if (adminMember) await db.from('portal_org_members').update({ role: 'org_admin' }).eq('id', adminMember.id);
    m.emails = numbers.map(syntheticEmail);
    if (created.failed.length) throw new Error(`codes: ${created.failed[0].error}`);
    return { n: created.created.length, note_ar: `${created.created.length} حسابًا · ${created.skipped.length} متجاوزًا` };
  },
  /* 3) البرامج والقاعات والتسجيلات */
  async programs({ db, m, anchor }) {
    const legacyOrg = await safe<any[]>(() => db.from('programs').select('organization_id').not('organization_id', 'is', null).limit(1), []); const legacyOrgId = legacyOrg[0]?.organization_id || null;
    const userOf = await usersOf(db, m.org_id!); m.programs = {}; m.classrooms = {};
    for (const p of DEMO_PROGRAMS) {
      const ins = await db.from('programs').insert({ ...(legacyOrgId ? { organization_id: legacyOrgId } : {}), name_ar: p.name_ar, name_en: p.name_en, status: 'ACTIVE', delivery_mode: 'onsite', hours: p.hours, is_public: false, registration_open: false, program_type: p.cefr_level ? 'arabic' : 'course', cefr_level: p.cefr_level, start_date: dayIso(anchor, p.start), end_date: dayIso(anchor, p.end), location_ar: 'مركز تدريب المنطقة س (افتراضي)', intro_ar: p.intro_ar, objectives_ar: p.objectives_ar.join('\n') }).select('id').single();
      if (ins.error || !ins.data) throw new Error(`program ${p.key}: ${ins.error?.message || 'no row'}`); m.programs[p.key] = String(ins.data.id); m.program_ids.push(m.programs[p.key]);
      for (const c of p.classrooms) {
        const ci = await db.from('classrooms').insert({ ...(legacyOrgId ? { organization_id: legacyOrgId } : {}), code: c.code, section_name: c.name_ar, program_id: m.programs[p.key], delivery_mode: 'onsite', capacity: 15, level: p.cefr_level }).select('id').single();
        if (ci.error || !ci.data) throw new Error(`classroom ${c.code}: ${ci.error?.message || 'no row'}`); m.classrooms[c.code] = String(ci.data.id); m.classroom_ids.push(m.classrooms[c.code]);
        const rows = rosterOf(c.code).map((i) => { const no = trainingNo(i); return { program_id: m.programs![p.key], classroom_id: m.classrooms![c.code], organization_id: m.org_id, user_id: userOf.get(no) || null, full_name: no, email: syntheticEmail(no), status: 'approved', source: 'portal', lang: 'ar', organization: DEMO_ORG.name_ar, created_at: atIso(anchor, p.start - 4, 10), decided_at: atIso(anchor, p.start - 3, 10), placed_at: atIso(anchor, p.start - 3, 11) }; });
        const er = await db.from('portal_enrollments').insert(rows).select('id'); if (er.error) throw new Error(`enrollments ${c.code}: ${er.error.message}`); for (const r of arr<any>(er.data)) m.enrollment_ids.push(String(r.id));
      }
    }
    return { n: m.enrollment_ids.length, note_ar: `${m.program_ids.length} برامج · ${m.classroom_ids.length} قاعات · ${m.enrollment_ids.length} تسجيلًا` };
  },
  /* 4) الحضور: جلسات منتهية فقط (A كاملًا · B حتى اليوم) */
  async attendance({ db, o, m, anchor, R, run }) {
    let present = 0;
    for (const p of DEMO_PROGRAMS) {
      const span = Math.min(p.end, -1) - p.start; if (p.sessions <= 0 || span <= 0) continue;
      for (let s = 0; s < p.sessions; s++) {
        const day = p.start + Math.round((s * span) / Math.max(1, p.sessions - 1)); if (day > -1) break;
        for (const c of p.classrooms) {
          const si = await db.from('attendance_sessions').insert({ program_id: m.programs![p.key], classroom_id: m.classrooms![c.code], title: `${p.name_ar} — اللقاء ${s + 1}`, session_date: dayIso(anchor, day), start_time: '08:00', end_time: '10:00', token: `rx${md5(`${run.id}:${p.key}:${c.code}:${s}`).slice(0, 20)}`, status: 'closed', created_by: o.by.id, created_by_name: 'غرفة العرض', closed_at: atIso(anchor, day, 11) }).select('id').single();
          if (si.error || !si.data) throw new Error(`attendance ${c.code}: ${si.error?.message || 'no row'}`); m.attendance_session_ids.push(String(si.data.id));
          const recs = rosterOf(c.code).filter(() => R() < 0.9).map((i) => { const no = trainingNo(i); const late = R() < 0.08; return { session_id: si.data.id, full_name: no, email: syntheticEmail(no), identity_key: syntheticEmail(no), status: late ? 'late' : 'present', method: 'qr', checked_in_at: atIso(anchor, day, late ? 9 : 8) }; });
          if (recs.length) { const rr = await db.from('attendance_records').insert(recs); if (rr.error) throw new Error(`records: ${rr.error.message}`); present += recs.length; }
        }
      }
    }
    return { n: present, note_ar: `${m.attendance_session_ids.length} جلسة حضور · ${present} تسجيل حضور` };
  },
  /* 5) القياس القبلي/البعدي للبرنامج المنتهي (A): 24 قبلي · 22 بعدي */
  async impact({ db, o, m, anchor, R, run }) {
    const A = DEMO_PROGRAMS[0];
    const ia = await db.from('impact_assessments').insert({ program_id: m.programs!.A, title_ar: `قياس أثر — ${A.name_ar}`, intro_ar: 'قياس افتراضي للعرض', token: `rxia${md5(`${run.id}:ia`).slice(0, 18)}`, status: 'closed', pre_open: false, post_open: false, created_by: o.by.id, created_by_name: 'غرفة العرض' }).select('id').single();
    if (ia.error || !ia.data) throw new Error(`impact: ${ia.error?.message || 'no row'}`); m.assessment_ids.push(String(ia.data.id));
    const irows: any[] = [];
    for (const i of ALL_A()) { const h = md5(`${run.id}:imp:${i}`); const pre = Math.round(44 + R() * 24); const post = Math.min(100, pre + 16 + Math.round(R() * 14)); irows.push({ assessment_id: ia.data.id, phase: 'pre', respondent_hash: h, respondent_label: `…${String(i).padStart(3, '0')}`, answers: {}, knowledge_pct: pre, scale_mean: null, score: pre, submitted_at: atIso(anchor, A.start + 1, 12) }); if (i <= 22) irows.push({ assessment_id: ia.data.id, phase: 'post', respondent_hash: h, respondent_label: `…${String(i).padStart(3, '0')}`, answers: {}, knowledge_pct: post, scale_mean: null, score: post, submitted_at: atIso(anchor, A.end - 1, 12) }); }
    const ir = await db.from('impact_responses').insert(irows); if (ir.error) throw new Error(`impact_responses: ${ir.error.message}`);
    return { n: irows.length, note_ar: '24 قبلي · 22 بعدي' };
  },
  /* 6) نقل الأثر بعد 30 يومًا من نهاية A: 20 متدرّبًا + 14 مشرفًا (الأيام −6…−2) */
  async transfer({ db, o, m, anchor, R, run }) {
    const A = DEMO_PROGRAMS[0];
    const bf = await db.from('behavior_followups').insert({ program_id: m.programs!.A, title_ar: `متابعة نقل الأثر — ${A.name_ar}`, intro_ar: 'متابعة افتراضية للعرض', token: `rxbf${md5(`${run.id}:bf`).slice(0, 18)}`, status: 'open', due_days: 30, open_at: dayIso(anchor, A.end + 30), auto_send: false, sent_at: atIso(anchor, A.end + 30, 7), created_by: o.by.id, created_by_name: 'غرفة العرض' }).select('id').single();
    if (bf.error || !bf.data) throw new Error(`followup: ${bf.error?.message || 'no row'}`); m.followup_ids.push(String(bf.data.id));
    const brows: any[] = [];
    ALL_A().slice(0, 20).forEach((i, k) => { const no = trainingNo(i); const day = -6 + (k % 5); const t = Math.round(62 + R() * 26); brows.push({ followup_id: bf.data.id, role: 'trainee', respondent_hash: md5(`${run.id}:t:${i}`), respondent_label: `…${String(i).padStart(3, '0')}`, trainee_key: syntheticEmail(no), trainee_label: no, answers: {}, scale_mean: +(3 + (t / 100) * 2).toFixed(2), application_pct: t, barriers: t < 70 ? ['ضيق الوقت'] : [], submitted_at: atIso(anchor, day, 13) }); if (k < 14) { const s = Math.max(40, Math.min(100, t - 4 + Math.round(R() * 10))); brows.push({ followup_id: bf.data.id, role: 'supervisor', respondent_hash: md5(`${run.id}:s:${i}`), respondent_label: 'مشرف', trainee_key: syntheticEmail(no), trainee_label: no, answers: {}, scale_mean: +(3 + (s / 100) * 2).toFixed(2), application_pct: s, barriers: [], submitted_at: atIso(anchor, day, 15) }); } });
    const br = await db.from('behavior_responses').insert(brows); if (br.error) throw new Error(`behavior_responses: ${br.error.message}`);
    return { n: brows.length, note_ar: '20 متدرّبًا · 14 مشرفًا' };
  },
  /* 7) الاستبيان الختامي (القالب الافتراضي END): 9 استجابات لكل قاعة في A — بند واحد ضعيف عمدًا ليظهر «بند الأسبوع» */
  async survey({ db, m, anchor, R, log }) {
    const A = DEMO_PROGRAMS[0]; let evN = 0;
    const tpls = await safe<any[]>(() => db.from('evaluation_templates').select('id,kind,is_default').eq('kind', 'END').limit(20), []);
    const tpl = tpls.find((t) => t.is_default) || tpls[0] || null;
    const qs = tpl ? await safe<any[]>(() => db.from('questions').select('id,kind,question_key,order_index').eq('template_id', tpl.id).order('order_index').limit(200), []) : [];
    const rating = qs.filter((q) => ['RATING_5', 'STARS', 'LIKERT_5'].includes(String(q.kind || '').toUpperCase()));
    if (tpl && rating.length) {
      const weak = rating[Math.min(6, rating.length - 1)].id;
      outer: for (const c of A.classrooms) for (const i of rosterOf(c.code).slice(0, 9)) {
        const no = trainingNo(i); const vals = rating.map((q) => ({ q, v: q.id === weak ? (R() < 0.6 ? 2 : 3) : (R() < 0.55 ? 5 : R() < 0.85 ? 4 : 3) }));
        const ev = await db.from('evaluations').insert({ program_id: m.programs!.A, template_id: tpl.id, trainee_id: null, guest_email: syntheticEmail(no), guest_name: null, classroom_id: m.classrooms![c.code], kind: 'END', evaluation_date: dayIso(anchor, A.end), overall_rating: +(vals.reduce((a, b) => a + b.v, 0) / vals.length).toFixed(2), created_at: atIso(anchor, A.end, 13), submitted_at: atIso(anchor, A.end, 13) }).select('id').single();
        if (ev.error || !ev.data) { log.push({ at: nowIso(), step: 'survey', ok: false, note_ar: `تخطّي الاستبيان: ${ev.error?.message || ''}`.slice(0, 160) }); break outer; }
        m.evaluation_ids.push(String(ev.data.id)); evN++;
        await db.from('evaluation_answers').insert(vals.map(({ q, v }) => ({ evaluation_id: ev.data.id, question_id: q.id, rating_value: v, selected_option: null, selected_options: [], text_value: null })));
      }
    }
    return { n: evN, note_ar: tpl ? `${evN} استجابة على القالب الافتراضي` : 'لا قالب END — تُخطِّي' };
  },
  /* 8) سطور التطبيق الميداني (12 كاتبًا مختلفًا) — موسومة افتراضي */
  async voices({ db, m, anchor }) {
    const A = DEMO_PROGRAMS[0]; const userOf = await usersOf(db, m.org_id!); const all = ALL_A();
    const lrows = DEMO_VOICES_AR.map((v, k) => { const i = all[k]; const no = trainingNo(i); return { user_id: userOf.get(no) || null, email: syntheticEmail(no), classroom_id: m.classrooms![i <= 12 ? 'RX-A1' : 'RX-A2'], program_id: m.programs!.A, kind: 'apply', day: dayIso(anchor, A.end - 20 + k), body_ar: v.body, blocker_ar: v.blocker || null, apply_no: 1, week_no: 3, meta: { demo: true } }; }).filter((r) => r.user_id);
    const lr = await db.from('portal_learning_lines').insert(lrows).select('id'); if (!lr.error) for (const r of arr<any>(lr.data)) m.line_ids.push(Number(r.id));
    return { n: lrows.length, note_ar: lr.error ? `بلا سطور: ${String(lr.error.message).slice(0, 100)}` : '12 سطرًا من 12 كاتبًا' };
  },
  /* 9) مِعيار: دعوة تحديد مستوى (عشوائية، مفتوحة للّجنة) + دعوة اجتياز B1 بنموذج مثبَّت ثم تبديل بند (الإصدار 2) */
  async miaar({ db, o, m }) {
    const bps = await safe<any[]>(() => db.from('question_bank_blueprints').select('id,code').in('code', ['SYS-PLACEMENT', 'SYS-LEVEL-B1']).limit(5), []);
    const bp = (c: string) => bps.find((b) => b.code === c)?.id || null;
    const inv1 = await createInvite(db, { kind: 'group', label_ar: `${DEMO_ORG.name_ar} — تحديد المستوى`, org_id: m.org_id, program_id: m.programs!.B, exam_mode: 'adaptive', purpose: 'placement', blueprint_id: bp('SYS-PLACEMENT'), classroom_id: m.classrooms!['RX-B1'], max_seats: 60 }, o.by.id, o.site);
    if (!inv1.ok) throw new Error(`invite1: ${inv1.error}`); m.invite_ids.push(inv1.invite.id); m.invite_codes = { placement: inv1.invite.code };
    const inv2 = await createInvite(db, { kind: 'group', label_ar: `${DEMO_ORG.name_ar} — اجتياز B1 · القاعة 1`, org_id: m.org_id, program_id: m.programs!.A, exam_mode: 'comprehensive', purpose: 'level_exit', level_target: 'B1', blueprint_id: bp('SYS-LEVEL-B1'), classroom_id: m.classrooms!['RX-A1'], max_seats: 60 }, o.by.id, o.site);
    if (!inv2.ok) throw new Error(`invite2: ${inv2.error}`); m.invite_ids.push(inv2.invite.id); m.invite_codes.exit = inv2.invite.code;
    invalidatePoolCache();
    const fz = await freezeForm(db, { invite_id: inv2.invite.id, by: o.by, env: o.env, site: o.site, rand: o.rand }); if (!fz.ok) throw new Error(`freeze: ${fz.error}`);
    m.form_ids.push(fz.form.id); m.form_code = fz.form.code;
    const first = fz.items[0]; const alts = first ? await alternativesFor(db, fz.form.id, first.code, 8) : null;
    if (alts && alts.ok && alts.alternatives[0]) { const sw = await swapItem(db, { form_id: fz.form.id, from: first.code, to: alts.alternatives[0].code, reason: 'البند مكرّر مع تدريب الأسبوع الثالث', by: o.by, env: o.env, site: o.site }); if (sw.ok) m.form_ids.push(sw.form.id); }
    const liveForm = await liveFormForInvite(db, inv2.invite.id);
    return { n: 2, note_ar: `النموذج ${fz.form.code} v${liveForm?.version || 1}` };
  },
  /* 10) 24 جلسة اجتياز عبر المحرّك نفسه (ثلاث شرائح قدرة) — 4 في كل نداء، ثم تُؤرَّخ إلى يوم نهاية A */
  async sessions({ db, m, anchor, R, log }) {
    const A = DEMO_PROGRAMS[0]; const done = new Set(arr<number>(m.sessions_done)); const todo = ALL_A().filter((i) => !done.has(i)).slice(0, SESSIONS_PER_CALL);
    if (todo.length) {
      const exitId = m.invite_ids[1]; const invRow = await safe<any>(() => db.from('placement_invites').select('*').eq('id', exitId).maybeSingle(), null); if (!invRow) throw new Error('sessions: invite missing');
      const liveForm = await liveFormForInvite(db, exitId); const userOf = await usersOf(db, m.org_id!);
      const inviteInput = { id: invRow.id, label_ar: invRow.label_ar, exam_mode: invRow.exam_mode, blueprint_id: invRow.blueprint_id || null, exit: true, unit_scope: invRow.unit_scope ?? null, form_id: invRow.form_id || liveForm?.id || null };
      const pool = await loadApprovedPool(db); const key = new Map(pool.map((it) => [it.id, it.correctOptionId])); const rules = await getRules(db);
      for (const i of todo) {
        const no = trainingNo(i); const band = bandOf(i); done.add(i);
        const st = await startSession(db, { candidate: { name: no, email: syntheticEmail(no) }, examMode: 'comprehensive', invite: inviteInput, userId: userOf.get(no) || null, instructionsAck: { version: rules.version, lang: 'ar', accepted: true, at: nowIso() } } as any);
        if (!st.ok) { log.push({ at: nowIso(), step: 'sessions', ok: false, note_ar: `${no}: ${st.code}` }); continue; }
        const loaded = await loadSession(db, st.value.token); if (!loaded) continue; m.session_ids.push(loaded.session.id);
        const Q = arr<any>((st.value.session as any).form?.questions); let s = loaded.session;
        for (let k = 0; k < Q.length; k++) { const q = Q[k]; const correct = key.get(q.id) || null; const opts = arr<any>(q.options).map((x) => String(x.id)); const pick = correct && R() < band.p ? correct : (opts.find((x) => x !== correct) || opts[0] || 'a'); const a = await answerSession(db, s, { questionId: q.id, selectedOptionId: pick, finalize: k === Q.length - 1 }); if (!a.ok) break; const re = await loadSession(db, st.value.token, false); if (re) s = re.session; }
        const fin = await loadSession(db, st.value.token); if (!fin) continue;
        const r = await finishSession(db, fin.session, fin.answers, null, invRow.label_ar || null); if (r.ok) m.sessions_finished = (m.sessions_finished || 0) + 1;
      }
      m.sessions_done = [...done];
      if (ALL_A().some((i) => !done.has(i))) return { partial: true };
    }
    /* تأريخ الجلسات والتقارير إلى يوم نهاية البرنامج (عرض لا تحايل: الجلسات حقيقية والدرجات محسوبة بالمحرّك) */
    if (m.session_ids.length) { const at = atIso(anchor, A.end - 2, 9); const fin = atIso(anchor, A.end - 2, 10); for (const part of chunk(m.session_ids, 100)) { await db.from('placement_secure_sessions').update({ started_at: at, finished_at: fin }).in('id', part); await db.from('placement_reports').update({ created_at: fin }).in('submission_id', part); } }
    return { n: m.sessions_finished || 0, note_ar: `${m.sessions_finished || 0} جلسة مكتملة بالمحرّك · ضعيف/متوسّط/قوي` };
  },
  /* 11) تقرير القيادة السابق (−90…−31) وقراره — يفتح به التقرير الحيّ «ما قرّرتم آخر مرّة» */
  async report({ db, o, m, anchor }) {
    const prevNow = new Date(anchor.getTime() - 30 * 86400000 + 9 * 3600000);
    const rep = await issueReport(db, { org_id: m.org_id!, kind: 'custom', from: dayIso(anchor, -90), to: dayIso(anchor, -31), name: 'قائد المنطقة س (افتراضي)', title: 'القائد', by: o.by, env: o.env, site: o.site, rand: o.rand, now: prevNow });
    if (!rep.ok) return { n: 0, note_ar: `بلا تقرير سابق: ${rep.error}` };
    m.report_codes.push(rep.row.code); m.prev_report = rep.row.code;
    const dec = DECISIONS.find((d) => d.target === 'transfer') || DECISIONS[0];
    const d = await decideReport(db, { code: rep.row.code, key: dec.key, note_ar: 'قرار افتراضي للعرض', by: o.by, env: o.env, site: o.site, now: new Date(prevNow.getTime() + 3600000) });
    return { n: 1, note_ar: d.ok ? `${rep.row.code} + قرار «${dec.text_ar}»` : `${rep.row.code} بلا قرار` };
  },
};

/* ───────────── المحو — بترتيب التبعيات، من البيان فقط ───────────── */
export const DESTROY_ORDER = ['placement_secure_answers', 'placement_reports', 'placement_secure_sessions', 'question_bank_form_items', 'question_bank_forms', 'placement_invite_recipients', 'placement_invites', 'evaluation_answers', 'evaluations', 'behavior_responses', 'behavior_followups', 'impact_responses', 'impact_assessments', 'attendance_records', 'attendance_sessions', 'portal_learning_lines', 'portal_enrollments', 'classrooms', 'programs', 'portal_org_reports', 'portal_org_policy_seals', 'portal_org_codes', 'portal_org_members', 'auth.users', 'portal_organizations'] as const;
export async function destroyManifest(db: Db, m: Manifest): Promise<Record<string, number>> {
  const n: Record<string, number> = {};
  const del = async (table: string, col: string, ids: Array<string | number>) => { if (!ids.length) return; let c = 0; for (const part of chunk(ids, 100)) { const r = await db.from(table).delete().in(col, part).select('id'); if (!r?.error) c += arr(r?.data).length || part.length; } n[table] = (n[table] || 0) + c; };
  await del('placement_secure_answers', 'session_id', m.session_ids);
  await del('placement_reports', 'submission_id', m.session_ids);
  await del('placement_secure_sessions', 'id', m.session_ids);
  if (m.invite_ids.length) { /* جلسات بدأتها اللجنة على دعوة تحديد المستوى بعد البناء */ const extra = await safe<any[]>(() => db.from('placement_secure_sessions').select('id').in('invite_id', m.invite_ids).limit(500), []); const ids = extra.map((s) => String(s.id)).filter((id) => !m.session_ids.includes(id)); await del('placement_secure_answers', 'session_id', ids); await del('placement_reports', 'submission_id', ids); await del('placement_secure_sessions', 'id', ids); }
  if (m.invite_ids.length) { const forms = await safe<any[]>(() => db.from('question_bank_forms').select('id').in('invite_id', m.invite_ids).limit(100), []); const fids = [...new Set([...m.form_ids, ...forms.map((f) => String(f.id))])]; await del('question_bank_form_items', 'form_id', fids); await del('question_bank_forms', 'id', fids); }
  await del('placement_invite_recipients', 'invite_id', m.invite_ids);
  await del('placement_invites', 'id', m.invite_ids);
  await del('evaluation_answers', 'evaluation_id', m.evaluation_ids);
  await del('evaluations', 'id', m.evaluation_ids);
  await del('behavior_responses', 'followup_id', m.followup_ids);
  await del('behavior_followups', 'id', m.followup_ids);
  await del('impact_responses', 'assessment_id', m.assessment_ids);
  await del('impact_assessments', 'id', m.assessment_ids);
  await del('attendance_records', 'session_id', m.attendance_session_ids);
  await del('attendance_sessions', 'id', m.attendance_session_ids);
  await del('portal_learning_lines', 'id', m.line_ids);
  if (m.user_ids.length) { /* ما كتبه العارضون أثناء العرض */ await del('portal_learning_lines', 'user_id', m.user_ids); }
  await del('portal_enrollments', 'id', m.enrollment_ids);
  if (m.program_ids.length) { const ex = await safe<any[]>(() => db.from('portal_enrollments').select('id').in('program_id', m.program_ids).limit(500), []); await del('portal_enrollments', 'id', ex.map((e) => String(e.id))); }
  await del('classrooms', 'id', m.classroom_ids);
  await del('programs', 'id', m.program_ids);
  if (m.org_id) {
    await del('portal_org_reports', 'organization_id', [m.org_id]);
    await del('portal_org_policy_seals', 'organization_id', [m.org_id]);
    await del('portal_org_codes', 'organization_id', [m.org_id]);
    await del('portal_org_members', 'organization_id', [m.org_id]);
  }
  let users = 0; for (const uid of m.user_ids) { try { const r = await db.auth.admin.deleteUser(uid); if (!r?.error) users++; } catch { /* يبقى الحساب يتيمًا بلا عضوية — لا يفتح شيئًا */ } } n['auth.users'] = users;
  if (m.org_id) await del('portal_organizations', 'id', [m.org_id]);
  return n;
}
export async function destroyDemo(db: Db, o: { by: Who; env?: Record<string, string | undefined> }): Promise<{ ok: true; counts: Record<string, number> } | { ok: false; error: string; status?: number }> {
  const run = await currentRun(db); if (!run) return { ok: false, error: 'لا مشهد مبنيًّا', status: 404 };
  /* بناء جارٍ: خطوة واحدة لا تتجاوز دقيقة — إن مرّت STALL_SECONDS بلا تحديث فالبناء متوقّف (أُغلقت الصفحة) ويجوز محوه؛ وإلا 409 */
  if (run.status === 'building' && Date.now() - new Date(run.updated_at || run.created_at).getTime() < STALL_SECONDS * 1000) return { ok: false, error: `البناء جارٍ — انتظر اكتماله (أو ${STALL_SECONDS} ثانية بلا نشاط ثم امحُ)`, status: 409 };
  await setRun(db, run.id, { status: 'destroying', step_ar: 'المحو' });
  const counts = await destroyManifest(db, run.manifest || emptyManifest());
  /* أي جهة بقيت بالمُعرِّف نفسه موسومةً demo (بقايا بناء قديم) تُمحى أيضًا — بالوسم لا بالاسم */
  const strays = await safe<any[]>(() => db.from('portal_organizations').select('id').eq('slug', DEMO_SLUG).eq('demo', true).limit(5), []);
  for (const s of strays) await destroyManifest(db, { ...emptyManifest(), org_id: String(s.id) });
  await setRun(db, run.id, { status: 'destroyed', destroyed_at: nowIso(), presenters: [], step_ar: null });
  await securityEvent(db, { severity: 'info', kind: 'demo_destroyed', actor: o.by.email || o.by.id, user_id: o.by.id, meta: { counts } }, o.env);
  return { ok: true, counts };
}
/** بطاقات العارضين (A6) — تُطبع من غرفة العرض؛ حسابات افتراضية فقط */
export function presenterCards(run: RunRow, site: string) {
  return (run.presenters || []).map((p) => ({ ...p, org_ar: DEMO_ORG.name_ar, enter_url: `${site}/enter?o=${DEMO_SLUG}`, note_ar: p.role === 'org_admin' ? 'يفتح بوابة الجهة: السياسة · تقرير القيادة · القرار' : 'يفتح الصفحة الشخصية /me — يرى صدى القرار' }));
}
