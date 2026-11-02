// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * محرّك مِعيار (خادم فقط) — الجلسة الآمنة كما في مِعيار: رمز في كوكي (hash في الجدول) · التصحيح على الخادم · المستويات الماضية لا تُعدَّل
 *  + م1: مِسبار يحدّد نقطة البداية · نزول عند الإخفاق في نقطة بداية أعلى من A1 · وقت «احتياجاتي» · ربط الدعوة والحساب
 *  · عند الإنهاء: placement_reports (برمز نتيجة ML-…) + portal_placements + حدث assessed + مستوى التسجيلات — بلا مزامنة خارجية.
 *  + م2-أ: «أرضية ما قبل A1» — في التكيفي، من لم يجتز A1 يُقدَّم له 12 بندًا مصوّرًا (current_level_index = -1) ثم ينتهي الاختبار؛ النتيجة في التقرير «ما_قبل_A1».
 */
import { createHash, randomBytes } from 'node:crypto';
import {
  PASS_PERCENT, DURATION_SECONDS, CONTENT_VERSION, MIAAR_NAMES_AR, isExamMode, isOptionId, cleanText, normalizeCandidate, normalizeAccess,
  accessDuration, nextStep, calculateReport, resultCode, bankLevelIndex, levelAtIndex, hasFloor, FLOOR_INDEX,
} from './registry';
import type { Answer, Candidate, ExamMode, FinishReason, PublicForm, SecureItem, Access, Report } from './registry';
import { loadApprovedPool, loadPassages, formFromPool, secureItems } from './bank';
import { reweighIfDue, trustLine } from './balance';
import { planFromBlueprint, planFromSession, systemPlan, drawPlan, planStartIndex, nextStepPlan, examModeOf, levelVerdict, probeScoreFrom, probeBandIndexOf, TEST_TYPE_INFO } from './blueprint';
import type { Plan } from './blueprint';
import { parseMiaarReport, placementValid, evidenceSkills, effectiveLevel } from '../portal/placement';

export type SessionRow = {
  id: string; token_hash: string; candidate: Candidate & { assignedItemCodes?: string[]; assignedDurationSeconds?: number; questionSource?: string; publishedFormTitle?: string; shortCells?: string[] };
  content_version: string; exam_mode: ExamMode; status: 'active' | 'completed' | 'expired' | 'abandoned'; current_level_index: number;
  started_at: string; expires_at: string; finished_at: string | null; finish_reason: FinishReason | null; report: Report | null;
  invite_id: string | null; recipient_id: string | null; user_id: string | null; start_level_index: number; direction: 'up' | 'down'; probe: { score: number; band_index: number } | null; access: Access | null;
  blueprint_id?: string | null; plan?: unknown;  /* م2-ب: الخطة المثبّتة لحظة البدء */
};
export type StartInput = { candidate: unknown; examMode: unknown; probeAnswers?: unknown; access?: unknown; invite?: { id: string; label_ar: string; exam_mode: ExamMode; recipient_id?: string | null; blueprint_id?: string | null } | null; userId?: string | null; blueprint?: unknown };
export type Result<T> = { ok: true; value: T } | { ok: false; code: string; status: number };
const fail = (code: string, status: number): Result<never> => ({ ok: false, code, status });

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const createToken = () => randomBytes(32).toString('base64url');
export const remainingSeconds = (expiresAt: string) => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
const nowIso = () => new Date().toISOString();
const assignedCodes = (s: SessionRow): string[] => Array.isArray(s.candidate?.assignedItemCodes) ? [...new Set(s.candidate.assignedItemCodes.filter((c) => typeof c === 'string' && c.trim().length > 1))] : [];
function plan(s: SessionRow) {
  const d = s.candidate?.assignedDurationSeconds; const durationSeconds = typeof d === 'number' && d >= 300 && d <= 240 * 60 ? d : DURATION_SECONDS;
  return { durationSeconds, source: s.candidate?.questionSource || 'approved-random', title: s.candidate?.publishedFormTitle || 'سحب متوازن من البنك المعتمد', short: Array.isArray(s.candidate?.shortCells) ? s.candidate.shortCells : [] };
}
export function publicSession(s: SessionRow, answers: Answer[] = [], form: PublicForm | null = null) {
  return {
    examMode: s.exam_mode, currentLevel: levelAtIndex(s.current_level_index), currentLevelIndex: s.current_level_index, startLevelIndex: s.start_level_index, direction: s.direction,
    status: s.status, finishReason: s.finish_reason, expiresAt: s.expires_at, remainingSeconds: remainingSeconds(s.expires_at), durationSeconds: plan(s).durationSeconds,
    access: s.access, answers: Object.fromEntries(answers.map((a) => [a.question_id, a.selected_option_id])), form, plan: publicPlan(s),
  };
}
/** الخطة كما يراها المتصفح (بلا سلال الخبير) */
export function publicPlan(s: SessionRow) {
  const p = planFromSession(s.plan);
  if (!p) return { code: s.exam_mode === 'adaptive' ? 'SYS-PLACEMENT' : 'SYS-COMPREHENSIVE', name_ar: s.exam_mode === 'adaptive' ? TEST_TYPE_INFO.placement.name_ar : TEST_TYPE_INFO.comprehensive.name_ar, name_en: s.exam_mode === 'adaptive' ? TEST_TYPE_INFO.placement.name_en : TEST_TYPE_INFO.comprehensive.name_en, type: s.exam_mode === 'adaptive' ? 'placement' : 'comprehensive', ladder: s.exam_mode === 'adaptive' ? 'adaptive' : 'linear', levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], cut: PASS_PERCENT, floor: s.exam_mode === 'adaptive' };
  return { code: p.code, name_ar: p.name_ar, name_en: p.name_en, type: p.type, ladder: p.ladder, levels: p.levels, cut: p.cut, floor: p.floor };
}
/** اختيار الخطة: مخطّط الدعوة → رمز مخطّط عام نشط → المخطّط النظامي للنمط (من الجدول إن وُجد، وإلا الافتراضي المضمّن) */
async function resolvePlan(db: any, input: StartInput): Promise<Result<{ plan: Plan; blueprintId: string | null }>> {
  let row: any = null;
  const code = cleanText(input.blueprint, 40);
  if (input.invite?.blueprint_id) { const r = await db.from('question_bank_blueprints').select('*').eq('id', input.invite.blueprint_id).maybeSingle(); row = r?.data || null; }  /* مخطّط الدعوة (إن حُذف: الافتراضي) */
  else if (code) {
    const r = await db.from('question_bank_blueprints').select('*').eq('code', code).eq('status', 'active').eq('is_public', true).maybeSingle();
    row = r?.data || null; if (!row) return fail('blueprint_unavailable', 404);
  }
  if (row) { const { plan, errors } = planFromBlueprint(row); if (errors.length) return fail('blueprint_invalid', 409); return { ok: true, value: { plan, blueprintId: row.id } }; }
  const mode: ExamMode = input.invite ? input.invite.exam_mode : isExamMode(input.examMode) ? input.examMode : 'adaptive';
  const sysCode = mode === 'comprehensive' ? 'SYS-COMPREHENSIVE' : 'SYS-PLACEMENT';
  const sys = await db.from('question_bank_blueprints').select('*').eq('code', sysCode).eq('status', 'active').maybeSingle();
  if (sys?.data) { const { plan, errors } = planFromBlueprint(sys.data); if (!errors.length) return { ok: true, value: { plan, blueprintId: sys.data.id as string } }; }
  return { ok: true, value: { plan: systemPlan(mode === 'comprehensive' ? 'comprehensive' : 'placement'), blueprintId: null } };
}

/** هل يحق لهذا البريد البدء؟ محاولة واحدة لكل بريد إلا بموافقة إعادة غير مستهلكة (كما في مِعيار) */
export async function canStart(db: any, email: string): Promise<Result<{ retake: boolean }>> {
  const prior = await db.from('placement_reports').select('id').ilike('candidate_email', email).limit(1);
  if (prior.error) return fail('retake_check_failed', 503);
  if (!(prior.data || []).length) return { ok: true, value: { retake: false } };
  const approvals = await db.from('test_retake_approvals').select('id').ilike('email', email).is('used_at', null).limit(1);
  if (approvals.error) return fail('retake_check_failed', 503);
  return (approvals.data || []).length ? { ok: true, value: { retake: true } } : fail('retake_not_allowed', 403);
}

export async function startSession(db: any, input: StartInput): Promise<Result<{ token: string; session: ReturnType<typeof publicSession> }>> {
  const candidate = normalizeCandidate(input.candidate); if (!candidate) return fail('invalid_start_request', 400);
  if (!isExamMode(input.examMode) && !input.invite && !cleanText(input.blueprint, 40)) return fail('invalid_start_request', 400);
  const resolved = await resolvePlan(db, input); if (!resolved.ok) return resolved;
  const { plan: activePlan, blueprintId } = resolved.value; const examMode: ExamMode = examModeOf(activePlan);
  const allowed = await canStart(db, candidate.email); if (!allowed.ok) return allowed;
  // الجلسات النشطة المنتهية زمنًا لهذا البريد تُغلق
  await db.from('placement_secure_sessions').update({ status: 'expired', finish_reason: 'time', updated_at: nowIso() }).eq('status', 'active').lt('expires_at', nowIso()).eq('candidate_email', candidate.email);
  // جلسة نشطة واحدة لكل بريد (لا «إعادة سحب» للبنود بإعادة البدء) — الاستئناف بالكعكة، أو الانتظار حتى انتهاء مدّتها
  const { data: open } = await db.from('placement_secure_sessions').select('id').eq('status', 'active').eq('candidate_email', candidate.email).limit(1);
  if (Array.isArray(open) && open.length) return fail('session_exists', 409);
  const token = createToken();
  const passages = await loadPassages(db).catch(() => null); if (!passages) return fail('form_unavailable', 503);
  const pool = await loadApprovedPool(db, passages).catch(() => null); if (!pool) return fail('form_unavailable', 503);
  const drawn = drawPlan(pool, token, activePlan); if (!drawn) return fail('form_unavailable', 503);
  const form = await formFromPool(db, pool, drawn.codes, passages); if (!form) return fail('form_unavailable', 503);
  const access = normalizeAccess(input.access); const durationSeconds = accessDuration(activePlan.durationSeconds, access);
  const score = activePlan.probe ? probeScoreFrom(pool, input.probeAnswers) : 0; const startIndex = planStartIndex(activePlan, probeBandIndexOf(score));
  const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
  const stored = { ...candidate, assignedItemCodes: drawn.codes, assignedDurationSeconds: durationSeconds, questionSource: `approved-${activePlan.draw}`, publishedFormTitle: `${activePlan.name_ar} (${activePlan.code})`, shortCells: drawn.short };
  const { data, error } = await db.from('placement_secure_sessions').insert({
    token_hash: tokenHash(token), candidate: stored, content_version: CONTENT_VERSION, exam_mode: examMode, status: 'active', expires_at: expiresAt, current_level_index: startIndex, start_level_index: startIndex, direction: 'up',
    probe: input.probeAnswers && activePlan.probe ? { score, band_index: startIndex } : null, access, invite_id: input.invite?.id || null, recipient_id: input.invite?.recipient_id || null, user_id: input.userId || null,
    blueprint_id: blueprintId, plan: activePlan,
  }).select('*').single();
  if (error || !data) return fail('session_start_failed', 409);
  if (input.invite?.recipient_id) await db.from('placement_invite_recipients').update({ started_at: nowIso() }).eq('id', input.invite.recipient_id).is('started_at', null);
  return { ok: true, value: { token, session: publicSession(data as SessionRow, [], form) } };
}

export async function loadSession(db: any, token: string): Promise<{ session: SessionRow; answers: Answer[] } | null> {
  const { data, error } = await db.from('placement_secure_sessions').select('*').eq('token_hash', tokenHash(token)).maybeSingle();
  if (error || !data) return null;
  const a = await db.from('placement_secure_answers').select('question_id, selected_option_id').eq('session_id', data.id);
  return { session: data as SessionRow, answers: (a.data || []) as Answer[] };
}
async function rebuildForm(db: any, s: SessionRow): Promise<PublicForm | null> {
  const codes = assignedCodes(s); if (!codes.length) return null;
  try { const passages = await loadPassages(db); const pool = await loadApprovedPool(db, passages); return await formFromPool(db, pool, codes, passages); } catch { return null; }
}
async function scoredItems(db: any, s: SessionRow): Promise<{ items: SecureItem[]; stems: Map<string, string> } | null> {
  const codes = assignedCodes(s); if (!codes.length) return null;
  try { const pool = await loadApprovedPool(db); const items = secureItems(pool, codes); if (!items) return null; return { items, stems: new Map(pool.map((i) => [i.code, i.questionText])) }; } catch { return null; }
}

export async function resumeSession(db: any, s: SessionRow, answers: Answer[]): Promise<Result<ReturnType<typeof publicSession>>> {
  if (s.status === 'active' && remainingSeconds(s.expires_at) === 0) {
    await db.from('placement_secure_sessions').update({ status: 'expired', finish_reason: 'time', updated_at: nowIso() }).eq('id', s.id); s.status = 'expired'; s.finish_reason = 'time';
  }
  const form = s.status === 'active' ? await rebuildForm(db, s) : null; if (s.status === 'active' && !form) return fail('form_unavailable', 409);  /* بعد الانتهاء لا تُعاد البنود */
  return { ok: true, value: publicSession(s, answers, form) };
}

export async function answerSession(db: any, s: SessionRow, body: Record<string, unknown>): Promise<Result<{ decision: string; nextLevel: string | null; direction: 'up' | 'down'; expiresAt: string; remainingSeconds: number }>> {
  if (s.status !== 'active') return fail('session_not_active', 409);
  if (s.finish_reason === 'completed' || s.finish_reason === 'failed') return fail('session_finalized', 409);
  if (remainingSeconds(s.expires_at) === 0) return fail('session_expired', 409);
  const questionId = cleanText(body.questionId, 80); const selected = body.selectedOptionId;
  if (!questionId || !isOptionId(selected)) return fail('invalid_answer', 400);
  const scored = await scoredItems(db, s); if (!scored) return fail('form_unavailable', 409);
  const item = scored.items.find((i) => i.id === questionId); if (!item) return fail('invalid_question', 404);
  const itemIndex = bankLevelIndex(item.level); if (itemIndex < FLOOR_INDEX || itemIndex !== s.current_level_index) return fail('question_not_current', 403);
  const saved = await db.from('placement_secure_answers').upsert({ session_id: s.id, question_id: questionId, selected_option_id: selected, submitted_at: nowIso() }, { onConflict: 'session_id,question_id' });
  if (saved.error) return fail('answer_save_failed', 500);
  let decision = 'continue'; let nextLevel: string | null = null; let direction = s.direction;
  if (body.finalize === true) {
    const level = levelAtIndex(s.current_level_index); const levelItems = scored.items.filter((i) => i.level === level);
    const fresh = await db.from('placement_secure_answers').select('question_id, selected_option_id').eq('session_id', s.id); if (fresh.error) return fail('answers_load_failed', 500);
    const map = new Map(((fresh.data || []) as Answer[]).map((a) => [a.question_id, a.selected_option_id]));
    if (levelItems.length > 0 && levelItems.every((i) => map.has(i.id))) {
      const correct = levelItems.filter((i) => map.get(i.id) === i.correctOptionId).length; const percent = (correct / levelItems.length) * 100;
      const sp = planFromSession(s.plan);
      const step = sp ? nextStepPlan(sp, { currentIndex: s.current_level_index, startIndex: s.start_level_index, direction: s.direction, hasFloor: hasFloor(scored.items) }, percent)
        : nextStep({ currentIndex: s.current_level_index, startIndex: s.start_level_index, direction: s.direction, mode: s.exam_mode, floor: hasFloor(scored.items) }, percent);
      decision = step.decision; direction = step.direction;
      const patch: Record<string, unknown> = { updated_at: nowIso(), direction: step.direction };
      if (step.decision === 'complete') patch.finish_reason = 'completed';
      else if (step.decision === 'fail') patch.finish_reason = 'failed';
      else { patch.current_level_index = step.nextIndex; patch.finish_reason = null; nextLevel = levelAtIndex(step.nextIndex as number); }
      await db.from('placement_secure_sessions').update(patch).eq('id', s.id);
    }
  }
  return { ok: true, value: { decision, nextLevel, direction, expiresAt: s.expires_at, remainingSeconds: remainingSeconds(s.expires_at) } };
}

/** تسجيل النتيجة في أَثَر مباشرة (ما كانت تفعله مزامنة P7): portal_placements + حدث assessed + مستوى التسجيلات */
export async function recordPlacement(db: any, reportRow: { id: string; submission_id: string | null; test_version: string | null; candidate_email: string; created_at: string; report: Record<string, unknown> }, userId: string | null): Promise<{ placement_id: string | null }> {
  const p = parseMiaarReport(reportRow as any); if (!placementValid(p)) return { placement_id: null };
  const { data: existing } = await db.from('portal_placements').select('id').eq('external_id', String(reportRow.id)).maybeSingle(); if (existing?.id) return { placement_id: existing.id };
  const { data: ins, error } = await db.from('portal_placements').insert({ ...p, user_id: userId }).select('id,user_id').single(); if (error || !ins) return { placement_id: null };
  try {
    const { data: sk } = await db.from('portal_skills').select('id,code').in('code', ['ATH-AR-004', 'ATH-AR-005', 'ATH-AR-006']);
    const codeToId = new Map<string, string>(((sk || []) as any[]).map((x) => [x.code, x.id]));
    await db.from('portal_learning_events').insert({ user_id: ins.user_id || userId || null, email: p.email, verb: 'assessed', object_type: 'placement', object_id: ins.id, skills: evidenceSkills(p, codeToId), context: { source: 'miaar', level: effectiveLevel(p), demonstrated: p.demonstrated_level, percent: p.overall_percent, skills: p.skills, taken_at: p.taken_at, product: MIAAR_NAMES_AR.product } });
    const lv = effectiveLevel(p); if (lv) await db.from('portal_enrollments').update({ placement_level: lv, placement_id: ins.id }).ilike('email', p.email).is('placement_level', null);
  } catch { /* الأحداث والتسجيلات تحسينية — التقرير محفوظ */ }
  return { placement_id: ins.id };
}

export async function finishSession(db: any, s: SessionRow, answers: Answer[], requested: unknown, inviteLabel: string | null): Promise<Result<{ report: Report; access_code: string | null }>> {
  if (s.report) {
    const { data: r } = await db.from('placement_reports').select('access_code').eq('submission_id', s.id).maybeSingle();
    return { ok: true, value: { report: s.report, access_code: r?.access_code || null } };
  }
  const scored = await scoredItems(db, s); if (!scored) return fail('form_unavailable', 409);
  const reason: FinishReason = remainingSeconds(s.expires_at) === 0 ? 'time' : s.finish_reason === 'completed' || s.finish_reason === 'failed' ? s.finish_reason : 'quit';
  void requested;
  const p = plan(s);
  const report = calculateReport({ candidate: s.candidate, examMode: s.exam_mode, startIndex: s.start_level_index, durationSeconds: p.durationSeconds, remainingSeconds: remainingSeconds(s.expires_at), source: `${CONTENT_VERSION}/${p.source}`, title: p.title, access: s.access, inviteLabel, short: p.short }, answers, reason, scored.items, scored.stems);
  const sp = planFromSession(s.plan);
  if (sp) { (report as any).النموذج = { الرمز: sp.code, الاسم: sp.name_ar, النوع: TEST_TYPE_INFO[sp.type].name_ar, السلّم: sp.ladder, طريقة_السحب: sp.draw, المستويات: sp.levels, حد_الاجتياز: sp.cut }; (report as any).نمط_الاختبار = TEST_TYPE_INFO[sp.type].name_ar; const v = levelVerdict(sp, report.مستويات_تفصيلية); if (v) (report as any).اجتياز_المستوى = v; }
  /* م3: سطر الموثوقية — ضوء النموذج الذي خاضه المتقدّم كاملًا (صدقٌ مع المتعلّم؛ لا أرقام) */
  try { const tl = await trustLine(db, [...new Set(scored.items.map((i) => i.level))], sp?.code || null); if (tl) (report as any).الموثوقية = { الضوء: tl.light, النص: tl.text }; } catch { /* لا يوقف النتيجة */ }
  let access_code = resultCode(); let inserted: any = null;
  for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
    const r = await db.from('placement_reports').insert({ submission_id: s.id, test_version: CONTENT_VERSION, candidate_email: s.candidate.email, report, access_code, invite_id: s.invite_id, user_id: s.user_id }).select('id, created_at').single();
    if (r.error) { if (String(r.error.code) === '23505') { access_code = resultCode(); continue; } return fail('report_save_failed', 500); }
    inserted = r.data;
  }
  if (!inserted) return fail('report_save_failed', 500);
  const status = reason === 'time' ? 'expired' : 'completed';
  const closed = await db.from('placement_secure_sessions').update({ status, finish_reason: reason, finished_at: nowIso(), report, updated_at: nowIso() }).eq('id', s.id); if (closed.error) return fail('session_close_failed', 500);
  if (s.recipient_id) await db.from('placement_invite_recipients').update({ report_id: inserted.id }).eq('id', s.recipient_id);
  // موافقة إعادة الاختبار تُستهلك
  await db.from('test_retake_approvals').update({ used_at: nowIso() }).ilike('email', s.candidate.email).is('used_at', null);
  await recordPlacement(db, { id: inserted.id, submission_id: s.id, test_version: CONTENT_VERSION, candidate_email: s.candidate.email, created_at: inserted.created_at || nowIso(), report }, s.user_id);
  await reweighIfDue(db);   /* م3: الميزان يزن نفسه كل 25 جلسة منتهية — لا يرمي ولا يؤخّر النتيجة إلا ثوانيَ عند الاستحقاق */
  return { ok: true, value: { report, access_code } };
}

/** النتيجة برمزها (صفحة /miaar/result/<code>) — بلا بريد ولا هاتف للعلن؛ الاسم الأول فقط */
export async function resultByCode(db: any, code: string): Promise<{ code: string; name: string; taken_at: string; report: Report } | null> {
  const { data } = await db.from('placement_reports').select('id, candidate_email, created_at, report, access_code').eq('access_code', code).maybeSingle();
  if (!data?.report) return null; const r = data.report as Report;
  const name = String((r as any)?.بيانات_المتقدم?.الاسم || '').split(/\s+/)[0] || '—';
  const { بنود_الجلسة: _items, ...rest } = r as any; void _items;  /* بنود الجلسة (الرموز والنصوص) لا تُعرض للعلن */
  const safe = { ...rest, بيانات_المتقدم: { ...(r as any).بيانات_المتقدم, الاسم: name, البريد_الإلكتروني: '—', الهاتف: '—' } } as Report;
  return { code: data.access_code, name, taken_at: data.created_at, report: safe };
}
export { PASS_PERCENT };
