// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** مِعيار — م4-ب «غرفة الأداء» (خادم فقط): تُفتح بعد اكتمال الجزء الاستقبالي؛ مهمّتان بمستوى المتقدّم المثبت (كتابة · تحدّث)،
 *  التسليم يُحفظ في miaar_performances (النص في الجدول، الصوت في الدلو الخاص miaar-media)، والتقرير على الرمز نفسه يحمل «المهارات الإنتاجية: قيد التصحيح»
 *  حتى يعتمدها إنسان من «غرفة التصحيح». لا درجة تُنشر آليًا. */
import { loadApprovedTasks, MEDIA_BUCKET } from './bank';
import { planFromSession } from './blueprint';
import { refreshExit } from './exitflow'; /* م6 */
import { pickTasks, publicTask, validateWriting, validateSpeaking, isAccommodation, mediaPathFor, productiveBlock, AUDIO_MAX_BYTES } from './performance';
import type { PublicTask, RoomState, PerfLite, PerformanceStatus } from './performance';
import type { SessionRow, Result } from './engine';
import type { BankLevel, ProductiveSkill } from './registry';
import { isBankLevel } from './registry';

const fail = (code: string, status: number): Result<never> => ({ ok: false, code, status });
const nowIso = () => new Date().toISOString();
export const PRODUCTIVE_KEY = 'المهارات_الإنتاجية';

/** مستوى المتقدّم من التقرير: المثبت → العام → مستوى الالتحاق؛ وإلا A1 (أدنى مستوى له مهام معتمدة غالبًا) */
export function levelFromReport(report: Record<string, any> | null | undefined, floorAware = true): BankLevel {
  const r = report || {}; const sum = (r['ملخص_التسكين'] || {}) as Record<string, unknown>;
  for (const v of [sum['المستوى_المثبت'], r['المستوى_العام'], sum['مستوى_الالتحاق_المقترح']]) {
    if (isBankLevel(v)) return v; if (floorAware && typeof v === 'string' && /قبل|PRE/i.test(v)) return 'PRE_A1';
  }
  return 'A1';
}
type PerfRow = { id: string; skill: ProductiveSkill; status: PerformanceStatus; item_code: string; level_target: BankLevel; word_count: number | null; duration_sec: number | null; accommodation: string | null; human_rating: any; transcript?: string | null; released_at: string | null; created_at: string };
async function perfsOf(db: any, sessionId: string): Promise<PerfRow[]> {
  const { data } = await db.from('miaar_performances').select('id, skill, status, item_code, level_target, word_count, duration_sec, accommodation, human_rating, released_at, created_at, transcript').eq('session_id', sessionId).limit(4);
  return (data || []) as PerfRow[];
}
const lite = (p: PerfRow): PerfLite => ({ skill: p.skill, status: p.status, item_code: p.item_code, level_target: p.level_target, word_count: p.word_count, duration_sec: p.duration_sec, accommodation: p.accommodation, human_rating: p.human_rating || null, released_at: p.released_at, transcript: (p as any).transcript || null });
const roomView = (state: RoomState, perfs: PerfRow[]) => ({ ...state, done: perfs.filter((p) => p.status !== 'skipped').map((p) => p.skill), skipped: perfs.filter((p) => p.status === 'skipped').map((p) => p.skill) });

/** دخول الغرفة (idempotent): يثبّت المهمّتين في الجلسة أول مرة ويعيدهما بعدها كما هي */
export async function enterRoom(db: any, s: SessionRow): Promise<Result<RoomState & { productive: Record<string, unknown> | null }>> {
  if (!s.report) return fail('receptive_not_finished', 409);
  const perfs = await perfsOf(db, s.id);
  const existing = (s as any).productive as RoomState | null;
  if (existing && Array.isArray(existing.tasks) && existing.tasks.length) return { ok: true, value: { ...roomView(existing, perfs), productive: productiveBlock(perfs.map(lite)) } };
  const plan = planFromSession(s.plan);
  /* declared: الخطة بمستوى واحد معلن → مهامه؛ demonstrated (الافتراضي): مستوى المتقدّم كما أثبته */
  const level: BankLevel = plan && plan.productiveMode === 'declared' && plan.levels.length === 1 ? plan.levels[0] : levelFromReport(s.report as any);
  const want: ProductiveSkill[] = ['writing', 'speaking'];
  if (plan && plan.levels.length === 1 && plan.productive) { const c = plan.productive[plan.levels[0]]; if (c && (c.writing || c.speaking) && !(c.writing && c.speaking)) { want.length = 0; if (c.writing) want.push('writing'); if (c.speaking) want.push('speaking'); } }
  const tasks = await loadApprovedTasks(db).catch(() => [] as Awaited<ReturnType<typeof loadApprovedTasks>>);
  const { picked, level: lv } = pickTasks(tasks, level, s.id, want);
  if (!picked.length) return fail('no_tasks', 404);
  const state: RoomState = { tasks: picked.map(publicTask), level: lv, entered_at: nowIso(), drafts: {}, done: [], skipped: [] };
  const up = await db.from('placement_secure_sessions').update({ productive: state, updated_at: nowIso() }).eq('id', s.id); if (up.error) return fail('room_save_failed', 500);
  return { ok: true, value: { ...roomView(state, perfs), productive: productiveBlock(perfs.map(lite)) } };
}

/** مسودّة الكتابة (حفظ تلقائي كل 20 ث من المتصفح) — في الجلسة لا في جدول الأداء */
export async function saveDraft(db: any, s: SessionRow, skill: unknown, text: unknown): Promise<Result<{ saved_at: string }>> {
  const state = (s as any).productive as RoomState | null; if (!state?.tasks?.length) return fail('room_not_entered', 409);
  if (skill !== 'writing' && skill !== 'speaking') return fail('bad_skill', 400);
  const t = typeof text === 'string' ? text.slice(0, 6000) : ''; const drafts = { ...(state.drafts || {}), [skill]: t }; const saved_at = nowIso();
  const up = await db.from('placement_secure_sessions').update({ productive: { ...state, drafts }, updated_at: saved_at }).eq('id', s.id); if (up.error) return fail('draft_save_failed', 500);
  return { ok: true, value: { saved_at } };
}

/** إعادة بناء كتلة «المهارات الإنتاجية» في التقرير (على placement_reports والجلسة) من جدول الأداء — تُستدعى بعد كل تسليم/تخطٍّ/إصدار */
export async function refreshProductive(db: any, sessionId: string): Promise<Record<string, unknown> | null> {
  const perfs = await perfsOf(db, sessionId); const block = productiveBlock(perfs.map(lite));
  const { data: rep } = await db.from('placement_reports').select('id, report').eq('submission_id', sessionId).maybeSingle();
  if (rep?.id) {
    const report = { ...(rep.report || {}) } as Record<string, unknown>; if (block) report[PRODUCTIVE_KEY] = block; else delete report[PRODUCTIVE_KEY];
    /* م6 «عُبور»: إعادة بناء حكم نهاية المستوى بعد كل تحديث للغرفة/التصحيح (أو دمج إعادة المهارة في التقرير الأصلي) */
    try { await refreshExit(db, sessionId, report as any, perfs.map((p) => ({ skill: p.skill, status: p.status, human_rating: p.human_rating as any }))); } catch { /* تحسيني */ }
    await db.from('placement_reports').update({ report }).eq('id', rep.id);
    await db.from('placement_secure_sessions').update({ report, updated_at: nowIso() }).eq('id', sessionId);
    if (perfs.length) await db.from('miaar_performances').update({ report_id: rep.id }).eq('session_id', sessionId).is('report_id', null);
  }
  return block;
}

export type SubmitBody = { skill?: unknown; text?: unknown; audio?: unknown; mime?: unknown; duration_sec?: unknown; ai_consent?: unknown; accommodation?: unknown };
/** تسليم أداء: كتابة (نص) أو تحدّث (صوت base64) — أو بالتيسير المعاكس. مرة واحدة لكل مهارة (unique) */
export async function submitPerformance(db: any, s: SessionRow, body: SubmitBody): Promise<Result<{ skill: ProductiveSkill; productive: Record<string, unknown> | null; room: RoomState }>> {
  const state = (s as any).productive as RoomState | null; if (!state?.tasks?.length) return fail('room_not_entered', 409);
  const skill = body.skill === 'writing' || body.skill === 'speaking' ? (body.skill as ProductiveSkill) : null; if (!skill) return fail('bad_skill', 400);
  const task = state.tasks.find((t) => t.skill === skill) as PublicTask | undefined; if (!task) return fail('task_not_in_room', 400);
  const perfs = await perfsOf(db, s.id); const prev = perfs.find((p) => p.skill === skill); if (prev && prev.status !== 'skipped') return fail('already_submitted', 409);
  const accommodation = isAccommodation(body.accommodation) ? body.accommodation : null;
  const typed = skill === 'writing' ? accommodation !== 'spoken_instead_of_writing' : accommodation === 'typed_instead_of_speaking';
  const row: Record<string, unknown> = { session_id: s.id, item_code: task.code, skill, level_target: task.level, candidate_email: s.candidate?.email || null, user_id: s.user_id || null, status: 'submitted', ai_consent: body.ai_consent === true, accommodation,
    text_answer: null, media_path: null, media_mime: null, duration_sec: null, word_count: null, transcript: null, human_rating: null, ai_rating: null, released_at: null, updated_at: nowIso() };
  if (typed) {
    const v = validateWriting(task, body.text); if (!v.ok) return fail(`writing_${v.error}`, 400);
    row.text_answer = v.text; row.word_count = v.words;
  } else {
    const b64 = typeof body.audio === 'string' ? body.audio.replace(/^data:[^;]+;base64,/, '') : ''; if (!b64) return fail('speaking_empty', 400);
    if (b64.length > AUDIO_MAX_BYTES * 1.4) return fail('speaking_too_big', 413);
    let buf: Buffer; try { buf = Buffer.from(b64, 'base64'); } catch { return fail('speaking_bad_audio', 400); }
    const v = validateSpeaking(task, { mime: body.mime, bytes: buf.length, duration_sec: body.duration_sec }); if (!v.ok) return fail(`speaking_${v.error}`, 400);
    const path = mediaPathFor(s.id, skill, v.ext);
    const up = await db.storage.from(MEDIA_BUCKET).upload(path, buf, { contentType: v.mime, upsert: true }); if (up.error) return fail('audio_upload_failed', 500);
    row.media_path = path; row.media_mime = v.mime; row.duration_sec = v.duration;
  }
  const { data: rep } = await db.from('placement_reports').select('id').eq('submission_id', s.id).maybeSingle(); row.report_id = rep?.id || null;
  const ins = await db.from('miaar_performances').upsert(row, { onConflict: 'session_id,skill' }); if (ins.error) return fail('performance_save_failed', 500);
  const productive = await refreshProductive(db, s.id);
  const drafts = { ...(state.drafts || {}) }; delete drafts[skill]; const room = { ...state, drafts }; await db.from('placement_secure_sessions').update({ productive: room, updated_at: nowIso() }).eq('id', s.id);
  return { ok: true, value: { skill, productive, room: roomView(room, await perfsOf(db, s.id)) } };
}

/** تخطّي مهارة (يُسجَّل «لم تُقدَّم» — صدقٌ في البطاقة، ولا يمنع تقديمها لاحقًا ما دامت الجلسة حيّة) */
export async function skipPerformance(db: any, s: SessionRow, skill: unknown): Promise<Result<{ productive: Record<string, unknown> | null; room: RoomState }>> {
  const state = (s as any).productive as RoomState | null; if (!state?.tasks?.length) return fail('room_not_entered', 409);
  if (skill !== 'writing' && skill !== 'speaking') return fail('bad_skill', 400);
  const task = state.tasks.find((t) => t.skill === skill); if (!task) return fail('task_not_in_room', 400);
  const perfs = await perfsOf(db, s.id); const prev = perfs.find((p) => p.skill === skill); if (prev && prev.status !== 'skipped') return fail('already_submitted', 409);
  if (!prev) { const ins = await db.from('miaar_performances').upsert({ session_id: s.id, item_code: task.code, skill, level_target: task.level, candidate_email: s.candidate?.email || null, user_id: s.user_id || null, status: 'skipped', ai_consent: false, accommodation: null, text_answer: null, media_path: null, media_mime: null, duration_sec: null, word_count: null, transcript: null, human_rating: null, ai_rating: null, released_at: null, report_id: null, updated_at: nowIso() }, { onConflict: 'session_id,skill' }); if (ins.error) return fail('performance_save_failed', 500); }
  const productive = await refreshProductive(db, s.id);
  return { ok: true, value: { productive, room: roomView(state, await perfsOf(db, s.id)) } };
}
