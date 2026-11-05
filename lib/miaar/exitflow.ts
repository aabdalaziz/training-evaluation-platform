// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * مِعيار — م6 «عُبور»: الغراء مع قاعدة البيانات (الحكم المركّب في التقرير · إعادة مهارة واحدة · الدعوة المرتبطة بالقاعة · اللوحة).
 *  - attachExit: عند إنهاء جلسة اختبار نهاية المستوى يُكتب report.exit (جزئي: الكتابة والتحدّث «قيد التصحيح») + خطّ العبور من تقرير التسكين السابق.
 *  - refreshExit: عند إصدار تصحيح الغرفة يُعاد بناء الحكم كاملًا (تستدعيه room.refreshProductive).
 *  - mergeSkillRetake: تقرير إعادة المهارة يُدمج في التقرير الأصلي (النسبة الجديدة تحلّ محلّ القديمة لتلك المهارة فقط).
 *  - createExitInvite / boardFor / promote / skillRetakeInvite: مسار /api/admin/miaar/exit.
 */
import { randomBytes, createHash } from 'node:crypto';
import { validateScope, listUnits, unitReport, boardHeat, reviewUnits, fairness } from './syllabus'; /* م6-ب «خريطة المنهج» */
import { planFromSession } from './blueprint';
import type { Plan } from './blueprint';
import { createInvite, inviteUrl } from './invites';
void inviteUrl;
import { exitBlock, growthLine, isExitCode, isExitLevel, skillRetakeBlueprintRow, exitBlueprintCode, exitReuseKey, exitInviteLabel, nextLevel, SKILL_RETAKE_DAYS, EXIT_SPEC, EXIT_SKILLS, windowState, boardSummary, ratingPercent } from './exit';
import type { ExitLevel, ExitSkill, PerfLike, BoardRow, ExitBlockT } from './exit';

const nowIso = () => new Date().toISOString();
type Db = any;

/** هل هذه خطّة اختبار نهاية مستوى؟ تعيد المستوى */
export function exitLevelOf(plan: Plan | null | undefined): ExitLevel | null {
  if (!plan || !isExitCode(plan.code)) return null; const l = plan.levels[0]; return isExitLevel(l) ? l : null;
}
export const isRetakePlan = (plan: Plan | null | undefined) => !!plan && /^EXIT-RT-/.test(plan.code);

async function perfsLite(db: Db, sessionId: string): Promise<PerfLike[]> {
  const { data } = await db.from('miaar_performances').select('skill, status, human_rating').eq('session_id', sessionId);
  return Array.isArray(data) ? (data as PerfLike[]) : [];
}
async function prevPlacement(db: Db, email: string, excludeId: string | null) {
  const { data } = await db.from('placement_reports').select('id, report, created_at').ilike('candidate_email', email).order('created_at', { ascending: false }).limit(6);
  const rows = (Array.isArray(data) ? data : []).filter((r: any) => r.id !== excludeId && r.report && !r.report.exit && !r.report.exit_retake);
  return rows[0] || null;
}

/** يُستدعى من finishSession قبل حفظ التقرير: يضيف report.exit (أو report.exit_retake) */
export async function attachExit(db: Db, args: { plan: Plan | null; report: Record<string, any>; email: string; inviteId: string | null; sessionId: string }): Promise<void> {
  const plan = args.plan; if (!plan) return;
  if (isRetakePlan(plan)) {
    const m = plan.code.match(/^EXIT-RT-(A1|A2|B1|B2|C1)-([A-Z_]+)$/); if (!m) return;
    const skill = m[2].toLowerCase() as ExitSkill; if (!EXIT_SKILLS.includes(skill)) return;
    let of: string | null = null; if (args.inviteId) { const { data } = await db.from('placement_invites').select('retake_of').eq('id', args.inviteId).maybeSingle(); of = data?.retake_of || null; }
    args.report.exit_retake = { of, المهارة: skill, المستوى: m[1], ملاحظة: skill === 'writing' || skill === 'speaking' ? 'بنود التهيئة لا تدخل في الحكم' : null };
    return;
  }
  const level = exitLevelOf(plan); if (!level) return;
  const prev = await prevPlacement(db, args.email, null).catch(() => null);
  const spec = EXIT_SPEC[level]; const want = plan.productive?.[level] || { writing: spec.writing, speaking: spec.speaking };
  const block = exitBlock({ level, report: args.report, perfs: [], wantWriting: want.writing, wantSpeaking: want.speaking, cut: plan.cut });
  const growth = growthLine(prev, level, block.الكلي);
  args.report.exit = growth ? { ...block, خط_العبور: growth } : block;
  await withUnits(db, args.report).catch(() => null);
}
/** م6-ب: exit.الوحدات (من الأضعف) + exit.وحدات_للمراجعة (≤ 3 دون 70%) — من report.الوحدات؛ لا تظهر على الشهادة الرسمية */
async function withUnits(db: Db, report: Record<string, any>): Promise<void> {
  const tally = report.الوحدات; if (!tally || typeof tally !== 'object' || !report.exit) return;
  const rows = unitReport(tally, await listUnits(db)); if (!rows.length) return;
  report.exit.الوحدات = rows.map((r) => ({ الرمز: r.code, الاسم: r.title_ar, name_en: r.title_en, عدد: r.n, صواب: r.correct, النسبة: r.percent, الحالة: r.state, الحالة_نص: r.state_ar }));
  report.exit.وحدات_للمراجعة = reviewUnits(rows).map((r) => ({ الرمز: r.code, الاسم: r.title_ar, name_en: r.title_en, النسبة: r.percent, الحالة: r.state }));
}

/** إعادة بناء الحكم بعد الغرفة/التصحيح — يعيد الكتلة الجديدة أو null إن لم تكن جلسة نهاية مستوى */
export async function refreshExit(db: Db, sessionId: string, report: Record<string, any>, perfs?: PerfLike[]): Promise<ExitBlockT | null> {
  const { data: s } = await db.from('placement_secure_sessions').select('id, plan, candidate, invite_id').eq('id', sessionId).maybeSingle();
  const plan = planFromSession(s?.plan); if (!plan) return null;
  const email = String(s?.candidate?.email || '');
  if (isRetakePlan(plan)) { await mergeSkillRetake(db, sessionId, report, perfs).catch(() => null); return null; }
  const level = exitLevelOf(plan); if (!level || !report.exit) return null;
  let ps = perfs || (await perfsLite(db, sessionId));
  const spec = EXIT_SPEC[level]; const want = plan.productive?.[level] || { writing: spec.writing, speaking: spec.speaking };
  const old = report.exit as any;
  /* إعادة مهارة مدموجة سابقًا تبقى نافذة عند إعادة البناء (النسبة الجديدة تحلّ محلّ القديمة لتلك المهارة فقط) */
  let rep = report; const m = old?.الإعادة; if (m?.الحالة === 'merged' && typeof m.النسبة === 'number') {
    if (m.المهارة === 'writing' || m.المهارة === 'speaking') ps = [...ps.filter((p) => p.skill !== m.المهارة), { skill: m.المهارة, status: 'released', human_rating: { mean: (m.النسبة / 100) * 5 } }];
    else rep = { ...report, احصائيات: { ...(report.احصائيات || {}), [m.المهارة]: { ...((report.احصائيات || {})[m.المهارة] || {}), answered: 1, percent: m.النسبة } } };
  }
  const block = exitBlock({ level, report: rep, perfs: ps, wantWriting: want.writing, wantSpeaking: want.speaking, cut: plan.cut, growth: old?.خط_العبور ? { ...old.خط_العبور, to_percent: null } : null, retake: old?.الإعادة || null });
  if (old?.قرار_العبور) (block as any).قرار_العبور = old.قرار_العبور;
  if ((block as any).خط_العبور) (block as any).خط_العبور = growthLine({ report: { المستوى_العام: old.خط_العبور.from_level, النسبة_العامة: old.خط_العبور.from_percent }, created_at: old.خط_العبور.from_at }, level, block.الكلي);
  report.exit = block; if (old?.الوحدات) { (block as any).الوحدات = old.الوحدات; (block as any).وحدات_للمراجعة = old.وحدات_للمراجعة || []; } void email; return block;
}

/** دمج إعادة المهارة في التقرير الأصلي */
export async function mergeSkillRetake(db: Db, retakeSessionId: string, retakeReport: Record<string, any>, perfs?: PerfLike[]): Promise<boolean> {
  const rt = retakeReport.exit_retake as { of: string | null; المهارة: ExitSkill } | undefined; if (!rt?.of) return false;
  const { data: orig } = await db.from('placement_reports').select('id, submission_id, report').eq('id', rt.of).maybeSingle(); if (!orig?.report?.exit) return false;
  const { data: os } = await db.from('placement_secure_sessions').select('plan').eq('id', orig.submission_id).maybeSingle();
  const plan = planFromSession(os?.plan); const level = exitLevelOf(plan); if (!plan || !level) return false;
  const skill = rt.المهارة; let pct: number | 'pending' | null = null;
  if (skill === 'writing' || skill === 'speaking') {
    const ps = perfs || (await perfsLite(db, retakeSessionId)); const mine = ps.filter((p) => p.skill === skill);
    if (!mine.length || mine.some((p) => p.status !== 'released' && p.status !== 'skipped')) pct = 'pending';
    else { const v = mine.filter((p) => p.status === 'released').map((p) => ratingPercent(p.human_rating)).filter((n): n is number => n !== null); pct = v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0; }
  } else { const st = retakeReport.احصائيات?.[skill]; pct = st && st.answered ? Number(st.percent) || 0 : 0; }
  /* نعيد بناء الحكم الأصلي مع استبدال نسبة المهارة المعادة */
  const origPerfs = await perfsLite(db, orig.submission_id);
  const spec = EXIT_SPEC[level]; const want = plan.productive?.[level] || { writing: spec.writing, speaking: spec.speaking };
  const patched = { ...(orig.report as Record<string, any>) };
  if (skill !== 'writing' && skill !== 'speaking' && typeof pct === 'number') patched.احصائيات = { ...(patched.احصائيات || {}), [skill]: { ...(patched.احصائيات?.[skill] || {}), answered: 1, percent: pct } };
  let ps = origPerfs;
  if ((skill === 'writing' || skill === 'speaking') && typeof pct === 'number') ps = [...origPerfs.filter((p) => p.skill !== skill), { skill, status: 'released', human_rating: { mean: (pct / 100) * 5 } }];
  const old = (orig.report as any).exit;
  const block = exitBlock({ level, report: patched, perfs: ps, wantWriting: want.writing, wantSpeaking: want.speaking, cut: plan.cut, growth: old?.خط_العبور || null, retake: { المهارة: skill, النسبة: typeof pct === 'number' ? pct : null, الحالة: pct === 'pending' ? 'pending' : 'merged', في: nowIso(), جلسة: retakeSessionId } });
  if (block.النتيجة === 'conditional' && block.مهارة_الإعادة === skill) { /* أعاد ولم يبلغ الحد بعد: لا إعادة ثانية تلقائيًا */ (block as any).الإعادة = { ...(block as any).الإعادة, استُنفدت: true }; }
  const report = { ...(orig.report as Record<string, any>), exit: block };
  await db.from('placement_reports').update({ report }).eq('id', orig.id);
  await db.from('placement_secure_sessions').update({ report, updated_at: nowIso() }).eq('id', orig.submission_id);
  return true;
}

/* ---------- الدعوة المرتبطة بالقاعة ---------- */
export type ExitInviteInput = { /* م6-ب «ما دُرّس فقط» */ unit_scope?: string[] | null; classroom_id: string; level: ExitLevel; label_ar: string; opens_at?: string | null; expires_at?: string | null; max_seats?: number | null; program_id?: string | null; lang?: string; note?: string | null; force_new?: boolean; /* م8 */ proctor_mode?: 'room' | 'camera' | 'remote' | null; witness_interval?: number | null; /* م8-ب */ location?: string | null };
export async function findOrCreateExitInvite(db: Db, input: ExitInviteInput, actorId: string | null, site: string): Promise<{ ok: true; invite: any; reused: boolean; url: string } | { ok: false; error: string }> {
  const code = exitBlueprintCode(input.level);
  const { data: bp } = await db.from('question_bank_blueprints').select('id, code, status').eq('code', code).maybeSingle();
  if (!bp?.id || bp.status !== 'active') return { ok: false, error: 'blueprint_missing' };
  /* م6-ب: دعوة محصورة في وحدات بعينها اختبارٌ مختلف → مفتاح إعادة استخدام خاص بها (بصمة النطاق) حتى لا تُخلط بدعوة المستوى الكامل */
  const scope = validateScope(input.unit_scope, input.level);
  const key = scope ? `${exitReuseKey(input.classroom_id, input.level)}:u${createHash('sha1').update(scope.join(',')).digest('hex').slice(0, 8)}` : exitReuseKey(input.classroom_id, input.level);
  if (!input.force_new) {
    const { data: ex } = await db.from('placement_invites').select('*').eq('reuse_key', key).eq('status', 'open').maybeSingle();
    if (ex?.id) return { ok: true, invite: ex, reused: true, url: inviteUrl(site, ex.code) };
  }
  const r = await createInvite(db, {
    kind: 'group', label_ar: input.label_ar || exitInviteLabel('', input.level), lang: input.lang || 'ar', exam_mode: 'comprehensive', purpose: 'level_exit', blueprint_id: bp.id, expires_at: input.expires_at || null, max_seats: input.max_seats || null,
    program_id: input.program_id || null, note: input.note || null, classroom_id: input.classroom_id, opens_at: input.opens_at || null, level_target: input.level, reuse_key: key,
    ...(input.proctor_mode ? { proctor_mode: input.proctor_mode } : {}), ...(input.witness_interval ? { witness_interval: input.witness_interval } : {}), ...(input.location ? { location: input.location } : {}), ...(scope ? { unit_scope: scope } : {}),
  } as any, actorId || '', site);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, invite: r.invite, reused: false, url: r.url };
}

/** دعوة شخصية لإعادة مهارة واحدة خلال 14 يومًا (الفكرة ز) */
export async function skillRetakeInvite(db: Db, reportId: string, actorId: string | null, site: string): Promise<{ ok: true; url: string; invite: any; skill: ExitSkill; expires_at: string } | { ok: false; error: string }> {
  const { data: rep } = await db.from('placement_reports').select('id, candidate_email, report, invite_id').eq('id', reportId).maybeSingle();
  const ex = rep?.report?.exit as ExitBlockT | undefined; if (!rep || !ex) return { ok: false, error: 'not_exit_report' };
  if (ex.النتيجة !== 'conditional' || !ex.مهارة_الإعادة) return { ok: false, error: 'not_conditional' };
  if ((ex as any).الإعادة?.استُنفدت) return { ok: false, error: 'retake_exhausted' };
  const level = ex.المستوى as ExitLevel; const skill = ex.مهارة_الإعادة as ExitSkill;
  const row = skillRetakeBlueprintRow(level, skill);
  let { data: bp } = await db.from('question_bank_blueprints').select('id').eq('code', row.code).maybeSingle();
  if (!bp?.id) { const ins = await db.from('question_bank_blueprints').insert({ ...row, created_by: actorId }).select('id').single(); if (ins.error || !ins.data) return { ok: false, error: 'blueprint_create_failed' }; bp = ins.data; }
  const existing = await db.from('placement_invites').select('id, code, status, expires_at').eq('retake_of', reportId).eq('status', 'open').maybeSingle();
  const expires_at = new Date(Date.now() + SKILL_RETAKE_DAYS * 86400000).toISOString();
  const name = String(rep.report?.بيانات_المتقدم?.الاسم || '').trim();
  let classroom_id: string | null = null; if (rep.invite_id) { const { data: inv } = await db.from('placement_invites').select('classroom_id').eq('id', rep.invite_id).maybeSingle(); classroom_id = inv?.classroom_id || null; }
  if (existing.data?.id && Date.parse(existing.data.expires_at || '') > Date.now()) return { ok: false, error: 'retake_invite_exists' };
  const r = await createInvite(db, {
    kind: 'personal', label_ar: row.name_ar, lang: 'ar', exam_mode: 'comprehensive', purpose: 'skill_retake', blueprint_id: bp.id, expires_at, max_seats: 1, recipients: [`${name} ${rep.candidate_email}`.trim()],
    classroom_id, level_target: level, retake_of: reportId, note: `إعادة مهارة ${skill} — تقرير ${reportId}`,
  }, actorId || '', site);
  if (!r.ok) return { ok: false, error: r.error };
  const url = r.links[0]?.url || r.url;
  const rep2 = { ...(rep.report as Record<string, any>) }; rep2.exit = { ...(rep2.exit as object), الإعادة: { المهارة: skill, الحالة: 'invited', حتى: expires_at, دعوة: r.invite.code } };
  await db.from('placement_reports').update({ report: rep2 }).eq('id', reportId);
  return { ok: true, url, invite: r.invite, skill, expires_at };
}

/* ---------- لوحة المجموعة ---------- */
export async function boardFor(db: Db, inviteId: string) {
  const { data: inv } = await db.from('placement_invites').select('*').eq('id', inviteId).maybeSingle(); if (!inv) return null;
  const [{ data: sessions }, { data: reports }, { data: recipients }] = await Promise.all([
    db.from('placement_secure_sessions').select('id, candidate, status, created_at, finished_at, updated_at, expires_at').eq('invite_id', inviteId).order('created_at', { ascending: true }),
    db.from('placement_reports').select('id, submission_id, candidate_email, access_code, report, created_at, integrity_status').eq('invite_id', inviteId),
    db.from('placement_invite_recipients').select('email, name, opened_at, started_at, report_id').eq('invite_id', inviteId),
  ]);
  const sess: any[] = Array.isArray(sessions) ? sessions : []; const reps: any[] = Array.isArray(reports) ? reports : [];
  const ids = sess.map((s) => s.id); let answered: Record<string, number> = {};
  if (ids.length) { const { data: ans } = await db.from('placement_secure_answers').select('session_id').in('session_id', ids.slice(0, 400)); for (const a of Array.isArray(ans) ? ans : []) answered[a.session_id] = (answered[a.session_id] || 0) + 1; }
  const byEmail = new Map<string, BoardRow>();
  for (const rc of Array.isArray(recipients) ? recipients : []) byEmail.set(String(rc.email).toLowerCase(), { email: rc.email, name: rc.name || '', status: 'invited', started_at: null, finished_at: null, answered: 0, total: 0, idle_min: null, report_code: null, exit: null });
  const now = Date.now();
  for (const s of sess) {
    const email = String(s.candidate?.email || '').toLowerCase(); const rep = reps.find((r) => r.submission_id === s.id);
    const total = Array.isArray(s.candidate?.assignedItemCodes) ? s.candidate.assignedItemCodes.length : 0;
    const finished = !!rep || s.status === 'completed' || s.status === 'expired';
    const row: BoardRow = {
      email: s.candidate?.email || email, name: String(s.candidate?.name || s.candidate?.fullName || byEmail.get(email)?.name || ''), status: finished ? 'finished' : Date.parse(s.expires_at) < now ? 'expired' : 'started',
      started_at: s.created_at, finished_at: s.finished_at || rep?.created_at || null, answered: answered[s.id] || 0, total, idle_min: finished ? null : Math.max(0, Math.round((now - Date.parse(s.updated_at || s.created_at)) / 60000)),
      report_code: rep?.access_code || null, exit: (rep?.report?.exit as ExitBlockT) || null,
    };
    (row as any).report_id = rep?.id || null; (row as any).session_id = s.id; (row as any).integrity = rep?.integrity_status || null; /* م8 */
    const prev = byEmail.get(email); if (!prev || prev.status === 'invited' || (row.exit && !prev.exit)) byEmail.set(email, row);
  }
  const rows = [...byEmail.values()].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'ar'));
  let classroom: any = null; if (inv.classroom_id) { const { data: c } = await db.from('classrooms').select('id, code, name, level, level_id, program_id').eq('id', inv.classroom_id).maybeSingle(); classroom = c || null; }
  /* م6-ب: خريطة حرارة الوحدات للمجموعة («أين ضعفت المجموعة؟») + «العدالة بين الشُّعب» (الوحدة الضعيفة في شعبتين فأكثر من المستوى نفسه = مشكلة منهج) */
  let units: any[] = []; let fairnessRows: any[] = []; let fairness_groups = 0;
  try {
    const all = await listUnits(db); units = boardHeat(reps.map((r) => r.report?.الوحدات), all);
    if (units.length && inv.level_target) {
      const { data: peers } = await db.from('placement_invites').select('id, code, label_ar, classroom_id').eq('purpose', 'level_exit').eq('level_target', inv.level_target).order('created_at', { ascending: false }).limit(40);
      const peerIds = (Array.isArray(peers) ? peers : []).map((p: any) => p.id).filter((x: string) => x && x !== inviteId).slice(0, 20);
      if (peerIds.length) {
        const { data: prs } = await db.from('placement_reports').select('invite_id, report').in('invite_id', peerIds).limit(2000);
        /* اسم الشعبة القصير (رمز القاعة ← اسمها ← رمز الدعوة) بدل عنوان الدعوة الطويل */
        const cids = [...new Set((Array.isArray(peers) ? peers : []).map((p: any) => p.classroom_id).filter(Boolean))] as string[];
        const cmap = new Map<string, string>(); if (classroom) cmap.set(classroom.id, classroom.code || classroom.name);
        if (cids.length) { const { data: cls } = await db.from('classrooms').select('id, code, name').in('id', cids.slice(0, 40)); for (const c of (Array.isArray(cls) ? cls : []) as any[]) cmap.set(c.id, c.code || c.name || ''); }
        const short = (p: any): string => (p.classroom_id && cmap.get(p.classroom_id)) || p.code || p.label_ar;
        /* الشعبة = القاعة: دعوتان للقاعة نفسها (كاملة + «ما دُرّس فقط») تُدمجان في مجموعة واحدة، لا تُعدّان شعبتين */
        const tallies = new Map<string, { label: string; t: any[] }>();
        const add = (key: string, label: string, t: any[]) => { const g = tallies.get(key) || { label, t: [] }; g.t.push(...t); tallies.set(key, g); };
        add(inv.classroom_id || inviteId, short(inv), reps.map((r) => r.report?.الوحدات));
        for (const p of (Array.isArray(peers) ? peers : []) as any[]) { if (!peerIds.includes(p.id)) continue; add(p.classroom_id || p.id, short(p), (Array.isArray(prs) ? prs : []).filter((r: any) => r.invite_id === p.id).map((r: any) => r.report?.الوحدات)); }
        const groups: { key: string; label: string; heat: any[] }[] = [];
        for (const [key, g] of tallies) { const heat = boardHeat(g.t, all); if (heat.length) groups.push({ key, label: g.label, heat }); }
        fairness_groups = groups.length; fairnessRows = fairness(groups);
      }
    }
  } catch { units = []; }
  return { invite: inv, classroom, window: windowState(inv.opens_at, inv.expires_at), rows, summary: boardSummary(rows), units, fairness: fairnessRows, fairness_groups, unit_scope: Array.isArray(inv.unit_scope) ? inv.unit_scope : null };
}

/** قرار العبور: يسجّل قرار تسكين «ترقية» لكل تقرير (بتوقيع بشري) */
export async function promoteReports(db: Db, reportIds: string[], actorId: string | null, note: string | null, targetClassroomId: string | null = null): Promise<{ done: number; skipped: number }> {
  let done = 0; let skipped = 0;
  for (const id of reportIds.slice(0, 200)) {
    const { data: rep } = await db.from('placement_reports').select('id, report').eq('id', id).maybeSingle();
    const ex = rep?.report?.exit as ExitBlockT | undefined; if (!ex || ex.الحالة !== 'final' || ex.النتيجة !== 'passed') { skipped += 1; continue; }
    const to = nextLevel(ex.المستوى as ExitLevel) || ex.المستوى;
    const row = { report_id: id, recommended_level: to, assigned_level: to, decision_status: 'approved', program_track: 'promote', source: 'staff', note: note || null, academic_note: `عبور نهاية المستوى ${ex.المستوى} → ${to} (${ex.الكلي}%)`, classroom_id: targetClassroomId, decided_by: actorId, decided_at: nowIso(), updated_at: nowIso() };
    const up = await db.from('placement_decisions').upsert(row, { onConflict: 'report_id' });
    if (up.error) { skipped += 1; continue; }
    try { await db.from('placement_decision_events').insert({ report_id: id, event_type: 'promote', payload: { from: ex.المستوى, to, total: ex.الكلي, classroom_id: targetClassroomId }, actor: actorId }); } catch { /* سجلّ تحسيني */ }
    const rep2 = { ...(rep.report as Record<string, any>) }; rep2.exit = { ...(rep2.exit as object), قرار_العبور: { إلى: to, في: nowIso(), بواسطة: actorId } };
    await db.from('placement_reports').update({ report: rep2 }).eq('id', id);
    done += 1;
  }
  return { done, skipped };
}

export const newCode = () => randomBytes(4).toString('hex').toUpperCase();
