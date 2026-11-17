// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «اقْرَأْ» ق1 — طبقة القاعدة: التسكين من قرار مِعيار · مستوى المتعلّم · الحلقة · التصحيح على الخادم · أراجع · دفتري · الطاقم (اعتماد/استيراد).
 *  مفتاح المتعلّم = البريد المطبَّع (كما مِعيار). لا أسماء في أي ردّ جماعي؛ أرقام الطاقم الجماعية تُحجب تحت k < 5.
 */
import { IQRA_LIMITS, IQRA_NAMES_AR, LEVEL_META, HOURS_TARGET, THRESHOLD_RULE, SKILL_META, COUNTED_ACTIVITIES, levelFromDecision, levelLabel, levelOrder, isIqraLevel, isActivity, nextLevel, type IqraLevel, type IqraSkill, type Activity } from './registry';
import { exerciseToBank, grade, nextInterval, publicExercise, scorePct, streakDays, drawExercises, type Answer, type Pack, type PublicExercise, type ReviewResult } from './content';
import { liveRequest, syncFromReport, examFacts, crossedCard } from './q2'; /* ق٢ (دورة استيراد متبادلة آمنة: دوالّ فقط) */
import { THRESHOLD_STATUS_AR } from './registry';
import { invalidatePoolCache } from '../miaar/bank';

type Db = any;
const TZ_MS = 3 * 3600 * 1000; export const riyadhDate = (d: Date) => new Date(d.getTime() + TZ_MS).toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
const UUID = /^[0-9a-f-]{8,40}$/i; const isId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/* ---------- التسكين ---------- */
export type Enrolment = { id: string; learner_email: string; user_id: string | null; level: IqraLevel; source: string; report_id: string | null; active: boolean; created_at: string };
export type Gate = { state: 'enrolled'; enrolment: Enrolment } | { state: 'pending' } | { state: 'none' };

export async function findEnrolment(db: Db, email: string): Promise<Enrolment | null> {
  const { data } = await db.from('iqra_enrolments').select('id, learner_email, user_id, level, source, report_id, active, created_at').eq('learner_email', email).eq('active', true).limit(1);
  const r = Array.isArray(data) && data[0]; return r && isIqraLevel(r.level) ? (r as Enrolment) : null;
}
/** قرار مِعيار المعتمد الأحدث لهذا البريد (تقارير غير مؤرشفة) */
export async function approvedDecision(db: Db, email: string): Promise<{ report_id: string; level: IqraLevel } | 'pending' | null> {
  const { data: reps } = await db.from('placement_reports').select('id, created_at, archived_at').eq('candidate_email', email).is('archived_at', null).order('created_at', { ascending: false }).limit(10);
  const ids = ((reps || []) as any[]).map((r) => r.id); if (!ids.length) return null;
  const { data: decs } = await db.from('placement_decisions').select('report_id, assigned_level, decision_status, decided_at').in('report_id', ids);
  const ok = ((decs || []) as any[]).filter((d) => d.decision_status === 'approved' && levelFromDecision(d.assigned_level)).sort((a, b) => String(b.decided_at || '').localeCompare(String(a.decided_at || '')));
  if (!ok.length) return 'pending';
  return { report_id: ok[0].report_id, level: levelFromDecision(ok[0].assigned_level) as IqraLevel };
}
export async function gate(db: Db, email: string, userId: string | null): Promise<Gate> {
  const e = await findEnrolment(db, email); if (e) return { state: 'enrolled', enrolment: e };
  const d = await approvedDecision(db, email); if (!d) return { state: 'none' }; if (d === 'pending') return { state: 'pending' };
  const row = { learner_email: email, user_id: userId, level: d.level, source: 'placement', report_id: d.report_id, placed_by: null, note: null, active: true, created_at: nowIso(), updated_at: nowIso() };
  const ins = await db.from('iqra_enrolments').insert(row).select('id, learner_email, user_id, level, source, report_id, active, created_at').single();
  if (ins.error) { const again = await findEnrolment(db, email); return again ? { state: 'enrolled', enrolment: again } : { state: 'pending' }; }
  return { state: 'enrolled', enrolment: ins.data as Enrolment };
}
/** تسكين يدوي من الطاقم (مدرّس): يُغلق النشط ويفتح غيره */
export async function manualEnrol(db: Db, email: string, level: IqraLevel, by: string, note: string | null) {
  await db.from('iqra_enrolments').update({ active: false, updated_at: nowIso() }).eq('learner_email', email).eq('active', true);
  const r = await db.from('iqra_enrolments').insert({ learner_email: email, level, source: 'manual', placed_by: by, note, active: true, created_at: nowIso(), updated_at: nowIso() }).select('id').single();
  return !r.error;
}

/* ---------- قراءة المحتوى المعتمد ---------- */
type UnitRow = { code: string; level: string; idx: number; title_ar: string; focus_ar: string; status: string };
type LessonRow = { id: string; code: string; unit_code: string; idx: number; title_ar: string; goal_ar: string; minutes: number; minutes_total?: number | null; skill?: IqraSkill | null; can_do_ar?: string | null; can_do_en?: string | null; descriptor_codes?: string[] | null; domain?: string | null; content: any; item_ids: string[]; status: string; version: string; reviewed_at?: string | null; review_note?: string | null; updated_at?: string };
const LESSON_COLS = 'id, code, unit_code, idx, title_ar, goal_ar, minutes, minutes_total, skill, can_do_ar, can_do_en, descriptor_codes, domain, content, item_ids, status, version, reviewed_at, review_note, updated_at';
const skillOf = (l: LessonRow) => (l.skill && SKILL_META[l.skill] ? { key: l.skill, name_ar: SKILL_META[l.skill].name_ar } : null);
async function unitsOf(db: Db, level: IqraLevel): Promise<UnitRow[]> { const { data } = await db.from('miaar_syllabus_units').select('code, level, idx, title_ar, focus_ar, status').eq('level', level).order('idx'); return ((data || []) as UnitRow[]).filter((u) => u.status !== 'retired'); }
async function approvedLessons(db: Db, level: IqraLevel): Promise<LessonRow[]> {
  const units = await unitsOf(db, level); const codes = units.map((u) => u.code); if (!codes.length) return [];
  const { data } = await db.from('iqra_lessons').select(LESSON_COLS).in('unit_code', codes).eq('status', 'approved').order('unit_code').order('idx').limit(400);
  return (data || []) as LessonRow[];
}
async function progressOf(db: Db, email: string): Promise<Map<string, any>> { const { data } = await db.from('iqra_progress').select('lesson_id, library_id, status, score, attempts, answers, last_seen_at, done_at').eq('learner_email', email).limit(1000); return new Map(((data || []) as any[]).filter((p) => p.lesson_id).map((p) => [p.lesson_id, p])); }
const countAnswered = (ids: string[], answers: Record<string, any>) => ids.filter((i) => answers?.[i]).length;

/* ---------- «ساعاتي» — عقد الزمن ---------- */
export async function logTime(db: Db, e: Enrolment, activity: unknown, seconds: unknown, note: string | null, now = new Date()) {
  if (!isActivity(activity)) return { ok: false as const, error: 'bad_activity' };
  const cap = activity === 'external' ? 8 * 3600 : IQRA_LIMITS.tick_max_seconds; const add = Math.max(0, Math.min(cap, Math.floor(Number(seconds) || 0))); if (!add) return { ok: false as const, error: 'bad_seconds' };
  const day = riyadhDate(now);
  const { data: row } = await db.from('iqra_time_log').select('id, seconds').eq('learner_email', e.learner_email).eq('level', e.level).eq('day', day).eq('activity', activity).maybeSingle();
  const total = Math.min(IQRA_LIMITS.tick_day_cap_seconds * (activity === 'external' ? 2 : 1), Number(row?.seconds || 0) + add);
  if (row) await db.from('iqra_time_log').update({ seconds: total, note: note ?? undefined, updated_at: nowIso() }).eq('id', row.id);
  else await db.from('iqra_time_log').insert({ learner_email: e.learner_email, user_id: e.user_id, level: e.level, day, activity, seconds: total, note, updated_at: nowIso() });
  return { ok: true as const, day, activity, seconds: total };
}
/** ملخّص الساعات للمستوى: مقيسة (تُحتسب) · خارج أَثَر (تُعرض) · الهدف · الأسبوعان الأخيران · تقدير صادق للوصول */
export async function hoursSummary(db: Db, e: Enrolment, masteryPct: number, now = new Date()) {
  const { data } = await db.from('iqra_time_log').select('day, activity, seconds').eq('learner_email', e.learner_email).eq('level', e.level).limit(5000);
  const rows = (data || []) as { day: string; activity: Activity; seconds: number }[];
  const by: Record<string, number> = {}; let counted = 0, external = 0; const weekly: Record<string, number> = {};
  const today = riyadhDate(now); const d14 = new Date(now.getTime() - 14 * 86400e3); const since = riyadhDate(d14);
  for (const r of rows) { const sec = Number(r.seconds) || 0; by[r.activity] = (by[r.activity] || 0) + sec; if (r.activity === 'external') external += sec; else { counted += sec; if (r.day >= since) weekly[r.day] = (weekly[r.day] || 0) + sec; } }
  const target = HOURS_TARGET[e.level]; const hours = Math.round((counted / 3600) * 10) / 10; const pct = Math.min(100, Math.round((hours / target) * 100));
  const recent = Object.values(weekly).reduce((a, b) => a + b, 0) / 3600; const perWeek = Math.round((recent / 2) * 10) / 10;
  const remaining = Math.max(0, target - hours); const weeks = perWeek > 0 ? Math.ceil(remaining / perWeek) : null;
  const early = pct >= THRESHOLD_RULE.early_hours_pct && masteryPct >= THRESHOLD_RULE.early_mastery_pct; const full = pct >= 100 && masteryPct >= THRESHOLD_RULE.full_mastery_pct;
  return { hours, target, pct, external_hours: Math.round((external / 3600) * 10) / 10, by_activity: Object.fromEntries(COUNTED_ACTIVITIES.map((a) => [a, Math.round(((by[a] || 0) / 3600) * 10) / 10])), per_week: perWeek, weeks_left: weeks, today_min: Math.round((weekly[today] || 0) / 60), mastery_pct: masteryPct, threshold: { early_ready: early, full_ready: full, early_rule: `${THRESHOLD_RULE.early_hours_pct}% من الساعات مع إتقان ${THRESHOLD_RULE.early_mastery_pct}%`, state: full ? 'ready' : early ? 'early' : 'building' } };
}

/** ق٢: الإتقان = نسبة الحلقات المعتمدة التي «تمّت» (≥70%) — المُدخل الثاني لقاعدة العَتَبة */
export async function masteryOf(db: Db, e: Enrolment): Promise<number> {
  const [lessons, prog] = await Promise.all([approvedLessons(db, e.level), progressOf(db, e.learner_email)]);
  const done = lessons.filter((l) => prog.get(l.id)?.status === 'done').length; return scorePct(done, lessons.length);
}
/** ق٢: بعد العبور يبقى ما دونه مفتوحًا — مستويات القراءة في «مكتبتي» = مستواه وما قبله */
const levelsUpTo = (l: IqraLevel): IqraLevel[] => (Object.keys(LEVEL_META) as IqraLevel[]).filter((x) => levelOrder(x) <= levelOrder(l));

/* ---------- مستوى المتعلّم ---------- */
export async function learnerHome(db: Db, e: Enrolment, now = new Date()) {
  /* ق٢: الالتقاط أوّلًا — إن اعتُمدت ترقية «عُبور» منذ آخر زيارة أُغلق النشط وفُتح التالي، فنقرأ القيد الجديد ونبني البيت عليه في النداء نفسه */
  const req0 = await liveRequest(db, e.learner_email).catch(() => null);
  const synced = req0 && req0.invite_id ? await syncFromReport(db, req0).catch(() => req0) : req0;
  if (synced && synced.status === 'promoted' && synced.enrolment_id === e.id) { const fresh = await findEnrolment(db, e.learner_email).catch(() => null); if (fresh && fresh.id !== e.id) e = fresh; }
  const [units, lessons, prog] = await Promise.all([unitsOf(db, e.level), approvedLessons(db, e.level), progressOf(db, e.learner_email)]);
  const byUnit = new Map<string, LessonRow[]>(); for (const l of lessons) { const a = byUnit.get(l.unit_code) || []; a.push(l); byUnit.set(l.unit_code, a); }
  const منازل = units.filter((u) => byUnit.has(u.code)).map((u) => ({
    code: u.code, title_ar: u.title_ar, focus_ar: u.focus_ar,
    حلقات: (byUnit.get(u.code) || []).map((l) => { const p = prog.get(l.id); const n = (l.item_ids || []).length; const answered = countAnswered(l.item_ids || [], p?.answers || {}); return { id: l.id, code: l.code, title_ar: l.title_ar, goal_ar: l.goal_ar, minutes: l.minutes, minutes_total: l.minutes_total || 120, مهارة: skillOf(l), can_do_ar: l.can_do_ar || '', حالة: p?.status === 'done' ? 'done' : p ? 'started' : 'new', درجة: p?.score ?? null, مجاب: answered, الكلّ: n, مكتملة: n > 0 && answered >= n }; }),
  }));
  const mine = lessons.map((l) => prog.get(l.id)).filter(Boolean) as any[]; /* ق٢: تقدّم هذا المستوى فقط (بعد الانتقال تبقى صفوف المستوى السابق) */
  const done = mine.filter((p) => p.status === 'done').length;
  const days = mine.flatMap((p) => [p.last_seen_at, p.done_at].filter(Boolean).map((d: string) => riyadhDate(new Date(d))));
  const { count: due } = await db.from('iqra_reviews').select('id', { count: 'exact', head: true }).eq('learner_email', e.learner_email).lte('due_at', now.toISOString());
  const total = lessons.length; const nextOne = lessons.find((l) => prog.get(l.id)?.status !== 'done') || null;
  const daily = await dailyQuestion(db, e, now).catch(() => null);
  const ساعاتي = await hoursSummary(db, e, scorePct(done, total), now).catch(() => null);
  const { count: libN } = await db.from('iqra_library').select('id', { count: 'exact', head: true }).in('level', levelsUpTo(e.level)).eq('status', 'approved');
  /* ق٢: ملخّص العَتَبة في البيت (الطلب الحيّ إن وُجد) + بطاقة «عبرتُ» بعد الانتقال */
  const العَتَبة = { state: ساعاتي?.threshold.state || 'building', eligible: !!ساعاتي && ساعاتي.threshold.state !== 'building' && !!nextLevel(e.level) && !!examFacts(e.level), request: synced ? { id: synced.id, status: synced.status, status_ar: THRESHOLD_STATUS_AR[synced.status], invite_url: synced.invite_url, defer_note: synced.defer_note, exit_total: synced.exit_total } : null };
  const عبرتُ = await crossedCard(db, e).catch(() => null);
  return {
    ساعاتي, مكتبة: Number(libN || 0), العَتَبة, عبرتُ,
    المستوى: { level: e.level, label: levelLabel(e.level), name_ar: LEVEL_META[e.level].name_ar, code: LEVEL_META[e.level].code, line_ar: LEVEL_META[e.level].line_ar, can_ar: LEVEL_META[e.level].can_ar, next: nextLevel(e.level) ? levelLabel(nextLevel(e.level) as IqraLevel) : null, source: e.source },
    منازل, خطواتي: { done, total, pct: scorePct(done, total) }, أيامي: streakDays(days, riyadhDate(now)), أراجع_مستحقّ: Number(due || 0),
    التالية: nextOne ? { id: nextOne.id, title_ar: nextOne.title_ar, unit_code: nextOne.unit_code } : null,
    سؤال_اليوم: daily, فارغ: total === 0,
  };
}

/** سؤال اليوم: بند معتمد واحد من مستوى المتعلّم، يثبت لليوم نفسه (بذرة التاريخ + البريد) — تصحيحه عبر action=answer بلا حفظ */
export async function dailyQuestion(db: Db, e: Enrolment, now: Date): Promise<(PublicExercise & { seed: string }) | null> {
  const { data } = await db.from('question_bank_items').select('id, item_type, question_text, options, stimulus').eq('source_kind', 'iqra').eq('status', 'approved').eq('level', e.level).eq('item_type', 'mcq').limit(300);
  const rows = (data || []) as any[]; if (!rows.length) return null;
  const seed = riyadhDate(now) + '|' + e.learner_email; let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pe = publicExercise(rows[h % rows.length]); return pe ? { ...pe, seed: riyadhDate(now) } : null;
}

/* ---------- الحلقة ---------- */
async function lessonById(db: Db, id: string): Promise<LessonRow | null> { if (!isId(id)) return null; const { data } = await db.from('iqra_lessons').select(LESSON_COLS).eq('id', id).maybeSingle(); return (data as LessonRow) || null; }
async function itemsOf(db: Db, ids: string[]) { if (!ids.length) return [] as any[]; const { data } = await db.from('question_bank_items').select('id, item_type, question_text, options, stimulus, status').in('id', ids); const by = new Map(((data || []) as any[]).map((r) => [r.id, r])); return ids.map((i) => by.get(i)).filter(Boolean); }
export async function lessonView(db: Db, e: Enrolment, lessonId: string) {
  const l = await lessonById(db, lessonId); if (!l || l.status !== 'approved') return null;
  const u = (await unitsOf(db, e.level)).find((x) => x.code === l.unit_code); if (!u) return null; /* حلقة من مستوى آخر */
  const [items, cards, p] = await Promise.all([itemsOf(db, l.item_ids || []), db.from('iqra_cards').select('id, idx, word_ar, pos, gloss_ar, example_ar, audio_path, image_path').eq('lesson_id', l.id).order('idx'), db.from('iqra_progress').select('status, score, attempts, answers').eq('learner_email', e.learner_email).eq('lesson_id', l.id).maybeSingle()]);
  await db.from('iqra_progress').upsert({ learner_email: e.learner_email, user_id: e.user_id, lesson_id: l.id, status: p.data?.status || 'started', score: p.data?.score ?? null, attempts: p.data?.attempts || 0, answers: p.data?.answers || {}, last_seen_at: nowIso(), done_at: p.data?.done_at || null }, { onConflict: 'learner_email,lesson_id' });
  /* الخطوة 2: 10 من 30 في كلّ زيارة — ما لم يُجَب أولًا، ثم الأخطاء؛ البذرة = الحلقة + رقم الزيارة فيثبت السحب داخل الزيارة نفسها */
  const answers = p.data?.answers || {}; const visit = Number(p.data?.attempts || 0); const ids: string[] = l.item_ids || [];
  const drawn = drawExercises(ids, answers, `${l.id}|${e.learner_email}|${visit}`); const byId = new Map(items.map((r) => [r.id, r]));
  const produce = answers._produce || null;
  return {
    id: l.id, code: l.code, title_ar: l.title_ar, goal_ar: l.goal_ar, minutes: l.minutes, minutes_total: l.minutes_total || 120, مهارة: skillOf(l), can_do_ar: l.can_do_ar || '', can_do_en: l.can_do_en || '', descriptor_codes: l.descriptor_codes || [], المنزلة: { code: u.code, title_ar: u.title_ar }, content: l.content || {},
    بطاقات: (cards.data || []) as any[], مِران: drawn.map((i) => byId.get(i)).filter(Boolean).map((r) => publicExercise(r)).filter(Boolean) as PublicExercise[],
    زيارة: { رقم: visit + 1, مسحوب: drawn.length, مجاب: countAnswered(ids, answers), الكلّ: ids.length, مكتملة: ids.length > 0 && countAnswered(ids, answers) >= ids.length },
    أُنتج: produce ? { saved_at: produce.at, words: produce.words, checked: produce.checked } : null,
    تقدّمي: { status: p.data?.status || 'started', score: p.data?.score ?? null, attempts: p.data?.attempts || 0, answered: countAnswered(ids, answers) },
    قريبًا: [IQRA_NAMES_AR.tutor_soon, IQRA_NAMES_AR.voice_soon],
  };
}

export async function answerItem(db: Db, e: Enrolment, input: { lesson_id?: unknown; item_id: unknown; answer: Answer; daily?: boolean }) {
  if (!isId(input.item_id)) return { ok: false as const, error: 'bad_item' };
  const [{ data: row }, { data: key }] = await Promise.all([db.from('question_bank_items').select('id, item_type, question_text, options, stimulus, status, source_kind, level').eq('id', input.item_id).maybeSingle(), db.from('question_bank_answer_keys').select('correct_option_id, accepted').eq('item_id', input.item_id).maybeSingle()]);
  if (!row || !key || row.source_kind !== 'iqra' || row.status !== 'approved') return { ok: false as const, error: 'item_unavailable' };
  const g = grade(row, key, input.answer || {}); if (!g) return { ok: false as const, error: 'bad_answer' };
  if (input.daily) return { ok: true as const, ...g, saved: false };
  const l = await lessonById(db, String(input.lesson_id || '')); if (!l || !(l.item_ids || []).includes(row.id)) return { ok: false as const, error: 'item_not_in_lesson' };
  const { data: p } = await db.from('iqra_progress').select('answers, attempts, status, score, done_at').eq('learner_email', e.learner_email).eq('lesson_id', l.id).maybeSingle();
  const answers = { ...(p?.answers || {}) }; const prev = answers[row.id]; answers[row.id] = { correct: g.correct, at: nowIso(), tries: (prev?.tries || 0) + 1 };
  await db.from('iqra_progress').upsert({ learner_email: e.learner_email, user_id: e.user_id, lesson_id: l.id, status: p?.status || 'started', score: p?.score ?? null, attempts: p?.attempts || 0, answers, last_seen_at: nowIso(), done_at: p?.done_at || null }, { onConflict: 'learner_email,lesson_id' });
  if (!g.correct) { /* الخطأ يدخل طابور «أراجع» غدًا */
    await db.from('iqra_reviews').upsert({ learner_email: e.learner_email, kind: 'item', ref_id: row.id, due_at: new Date(Date.now() + 86400e3).toISOString(), interval_days: 1, ease: 2, lapses: (prev && !prev.correct ? 1 : 0), last_result: 'again', updated_at: nowIso() }, { onConflict: 'learner_email,kind,ref_id' });
  }
  return { ok: true as const, ...g, saved: true, answered: Object.keys(answers).length, of: (l.item_ids || []).length };
}

export async function finishLesson(db: Db, e: Enrolment, lessonId: unknown) {
  const l = await lessonById(db, String(lessonId || '')); if (!l || l.status !== 'approved') return { ok: false as const, error: 'lesson_unavailable' };
  const { data: p } = await db.from('iqra_progress').select('answers, attempts, status, done_at').eq('learner_email', e.learner_email).eq('lesson_id', l.id).maybeSingle();
  /* الخطوة 2: الدرجة على ما أُجيب حتى الآن (زيارة = 10 من 30)؛ تلزم إجابة 10 على الأقل أو كلّ البنود إن كانت أقلّ؛ الحلقة «تمّت» من أوّل زيارة ناجحة و«اكتملت» حين تُجاب الثلاثون */
  const ids: string[] = l.item_ids || []; const answers = { ...(p?.answers || {}) }; const answeredIds = ids.filter((i) => answers[i]); const need = Math.min(IQRA_LIMITS.draw_per_visit, ids.length);
  if (answeredIds.length < need) return { ok: false as const, error: 'answer_first' };
  const correct = answeredIds.filter((i) => answers[i]?.correct).length; const score = answeredIds.length ? scorePct(correct, answeredIds.length) : 100;
  const passed = score >= IQRA_LIMITS.lesson_pass_pct; const attempts = (p?.attempts || 0) + 1;
  if (!passed) for (const i of answeredIds) if (!answers[i]?.correct) delete answers[i]; /* الأخطاء تعود للسحب في الزيارة التالية؛ الصواب يبقى */
  await db.from('iqra_progress').upsert({ learner_email: e.learner_email, user_id: e.user_id, lesson_id: l.id, status: passed || p?.status === 'done' ? 'done' : 'started', score, attempts, answers, last_seen_at: nowIso(), done_at: passed ? (p?.done_at || nowIso()) : (p?.done_at || null) }, { onConflict: 'learner_email,lesson_id' });
  if (passed) { /* بطاقات الحلقة تدخل «أراجع» غدًا (مرّة واحدة) */
    const { data: cards } = await db.from('iqra_cards').select('id').eq('lesson_id', l.id);
    const rows = ((cards || []) as any[]).map((c) => ({ learner_email: e.learner_email, kind: 'card', ref_id: c.id, due_at: new Date(Date.now() + 86400e3).toISOString(), interval_days: 1, ease: 2, lapses: 0, last_result: null, updated_at: nowIso() }));
    if (rows.length) await db.from('iqra_reviews').upsert(rows, { onConflict: 'learner_email,kind,ref_id', ignoreDuplicates: true });
  }
  const all = await approvedLessons(db, e.level); const i = all.findIndex((x) => x.id === l.id); const next = i >= 0 ? all[i + 1] || null : null;
  const remaining = ids.length - ids.filter((i) => answers[i]).length;
  return { ok: true as const, score, passed, attempts, remaining, complete: remaining === 0, closing_ar: passed ? (l.content?.closing_ar || null) : null, next: next ? { id: next.id, title_ar: next.title_ar } : null };
}

/** محطّة «أُنتج»: نصّ الكتابة وقائمة التدقيق الذاتي تُحفظ في تقدّم الحلقة (للمتعلّم وحده)؛ الصوت لا يغادر الجهاز أبدًا */
export async function saveProduce(db: Db, e: Enrolment, input: { lesson_id: unknown; text: unknown; checked: unknown }) {
  const l = await lessonById(db, String(input.lesson_id || '')); if (!l || l.status !== 'approved') return { ok: false as const, error: 'lesson_unavailable' };
  const text = typeof input.text === 'string' ? input.text.replace(/\s+/g, ' ').trim().slice(0, 2000) : ''; const checked = Array.isArray(input.checked) ? (input.checked as unknown[]).slice(0, 6).map(Boolean) : [];
  const words = text ? text.split(' ').filter(Boolean).length : 0; const kind = l.content?.produce?.kind || 'write';
  if (kind === 'write' && !text) return { ok: false as const, error: 'text_required' };
  const { data: p } = await db.from('iqra_progress').select('answers, attempts, status, score, done_at').eq('learner_email', e.learner_email).eq('lesson_id', l.id).maybeSingle();
  const answers = { ...(p?.answers || {}), _produce: { kind, text: kind === 'write' ? text : '', words, checked, at: nowIso() } };
  await db.from('iqra_progress').upsert({ learner_email: e.learner_email, user_id: e.user_id, lesson_id: l.id, status: p?.status || 'started', score: p?.score ?? null, attempts: p?.attempts || 0, answers, last_seen_at: nowIso(), done_at: p?.done_at || null }, { onConflict: 'learner_email,lesson_id' });
  return { ok: true as const, words, model_ar: l.content?.produce?.model_ar || '' };
}

/* ---------- مكتبة المستوى ---------- */
const LIB_COLS = 'id, code, unit_code, level, kind, title_ar, body_ar, minutes, questions, descriptor_codes, status';
export async function libraryList(db: Db, e: Enrolment) {
  const [{ data }, { data: pr }] = await Promise.all([db.from('iqra_library').select('id, code, unit_code, kind, title_ar, minutes, status, level').in('level', levelsUpTo(e.level)).eq('status', 'approved').order('code').limit(200), db.from('iqra_progress').select('library_id, score, done_at').eq('learner_email', e.learner_email).not('library_id', 'is', null).limit(500)]);
  const pm = new Map(((pr || []) as any[]).map((p) => [p.library_id, p]));
  return { نصوص: ((data || []) as any[]).map((x) => ({ id: x.id, code: x.code, unit_code: x.unit_code, kind: x.kind, title_ar: x.title_ar, minutes: x.minutes, level: x.level, سابق: x.level !== e.level, درجة: pm.get(x.id)?.score ?? null, تمّ: !!pm.get(x.id)?.done_at })) };
}
export async function libraryView(db: Db, e: Enrolment, id: string) {
  if (!isId(id)) return null; const { data: x } = await db.from('iqra_library').select(LIB_COLS).eq('id', id).in('level', levelsUpTo(e.level)).eq('status', 'approved').maybeSingle(); if (!x) return null;
  const qs = (Array.isArray(x.questions) ? x.questions : []) as any[];
  return { id: x.id, code: x.code, kind: x.kind, title_ar: x.title_ar, body_ar: x.body_ar, minutes: x.minutes, أسئلة: qs.map((q, i) => ({ i, q: q.q, options: (q.options || []).map((t: string, k: number) => ({ id: String(k), text: t })) })) };
}
export async function libraryAnswer(db: Db, e: Enrolment, id: unknown, picks: unknown) {
  if (!isId(id) || !Array.isArray(picks)) return { ok: false as const, error: 'bad_input' };
  const { data: x } = await db.from('iqra_library').select('id, level, status, questions').eq('id', id).maybeSingle(); if (!x || !levelsUpTo(e.level).includes(x.level) || x.status !== 'approved') return { ok: false as const, error: 'not_found' };
  const qs = (Array.isArray(x.questions) ? x.questions : []) as any[]; const got = (picks as unknown[]).map((v) => Number(v)); if (got.length !== qs.length || got.some((n) => !Number.isInteger(n))) return { ok: false as const, error: 'answer_all' }; /* كلّ الأسئلة قبل التصحيح */
  const results = qs.map((q, i) => ({ i, correct: got[i] === Number(q.correct), correct_option: String(q.correct), explanation_ar: q.explanation_ar || null })); const score = scorePct(results.filter((r) => r.correct).length, qs.length || 1);
  await db.from('iqra_progress').upsert({ learner_email: e.learner_email, user_id: e.user_id, lesson_id: null, library_id: x.id, status: 'done', score, attempts: 1, answers: { picks: got }, last_seen_at: nowIso(), done_at: nowIso() }, { onConflict: 'learner_email,library_id' });
  return { ok: true as const, score, results };
}

/* ---------- أراجع (التكرار المتباعد) ---------- */
export async function reviewsDue(db: Db, e: Enrolment, now = new Date()) {
  const { data } = await db.from('iqra_reviews').select('id, kind, ref_id, interval_days, ease, lapses, due_at').eq('learner_email', e.learner_email).lte('due_at', now.toISOString()).order('due_at').limit(IQRA_LIMITS.review_batch);
  const rows = (data || []) as any[]; const cardIds = rows.filter((r) => r.kind === 'card').map((r) => r.ref_id); const itemIds = rows.filter((r) => r.kind === 'item').map((r) => r.ref_id);
  const [cards, items] = await Promise.all([cardIds.length ? db.from('iqra_cards').select('id, lesson_id, word_ar, pos, gloss_ar, example_ar, audio_path, image_path').in('id', cardIds) : { data: [] }, itemIds.length ? itemsOf(db, itemIds) : []]);
  const lids = Array.from(new Set(((cards.data || []) as any[]).map((c) => c.lesson_id).filter(Boolean))); const { data: lrows } = lids.length ? await db.from('iqra_lessons').select('id, code').in('id', lids) : { data: [] };
  const codeBy = new Map(((lrows || []) as any[]).map((l) => [l.id, l.code])); /* رمز الحلقة → شريط الصوت في «أراجع» */
  const cardBy = new Map(((cards.data || []) as any[]).map((c) => [c.id, { ...c, lesson_code: codeBy.get(c.lesson_id) || null }])); const itemBy = new Map((items as any[]).map((r) => [r.id, publicExercise(r)]));
  const { count: total } = await db.from('iqra_reviews').select('id', { count: 'exact', head: true }).eq('learner_email', e.learner_email).lte('due_at', now.toISOString());
  return { total: Number(total || 0), بطاقات: rows.map((r) => (r.kind === 'card' ? { review_id: r.id, kind: 'card', interval_days: r.interval_days, card: cardBy.get(r.ref_id) || null } : { review_id: r.id, kind: 'item', interval_days: r.interval_days, exercise: itemBy.get(r.ref_id) || null })).filter((x: any) => x.card || x.exercise) };
}
export async function reviewAnswer(db: Db, e: Enrolment, reviewId: unknown, result: unknown) {
  if (!isId(reviewId) || !['again', 'good', 'easy'].includes(String(result))) return { ok: false as const, error: 'bad_input' };
  const { data: r } = await db.from('iqra_reviews').select('id, interval_days, ease, lapses').eq('id', reviewId).eq('learner_email', e.learner_email).maybeSingle(); if (!r) return { ok: false as const, error: 'not_found' };
  const res = String(result) as ReviewResult; const interval = nextInterval(Number(r.interval_days) || 1, res);
  const upd = { interval_days: interval, ease: Math.max(1, Math.min(4, Number(r.ease || 2) + (res === 'easy' ? 1 : res === 'again' ? -1 : 0))), lapses: Number(r.lapses || 0) + (res === 'again' ? 1 : 0), last_result: res, due_at: new Date(Date.now() + interval * 86400e3).toISOString(), updated_at: nowIso() };
  await db.from('iqra_reviews').update(upd).eq('id', r.id); return { ok: true as const, next_in_days: interval };
}

/* ---------- دفتري ---------- */
export async function notebook(db: Db, e: Enrolment) {
  const lessons = await approvedLessons(db, e.level); const prog = await progressOf(db, e.learner_email);
  const doneIds = lessons.filter((l) => prog.get(l.id)).map((l) => l.id); if (!doneIds.length) return { كلمات: [], إتقان: 0 };
  const [{ data: cards }, { data: revs }] = await Promise.all([db.from('iqra_cards').select('id, lesson_id, word_ar, pos, gloss_ar, example_ar, audio_path').in('lesson_id', doneIds).order('idx'), db.from('iqra_reviews').select('ref_id, interval_days, ease, lapses, last_result').eq('learner_email', e.learner_email).eq('kind', 'card')]);
  const rb = new Map(((revs || []) as any[]).map((r) => [r.ref_id, r])); const title = new Map(lessons.map((l) => [l.id, l.title_ar]));
  const steps = IQRA_LIMITS.review_steps_days;
  const كلمات = ((cards || []) as any[]).map((c) => { const r = rb.get(c.id); const mastery = r ? Math.round((Math.max(0, steps.indexOf(r.interval_days)) / (steps.length - 1)) * 100) : 0; return { ...c, الحلقة: title.get(c.lesson_id) || '', إتقان: mastery }; });
  return { كلمات, إتقان: كلمات.length ? Math.round(كلمات.reduce((s, w) => s + w.إتقان, 0) / كلمات.length) : 0 };
}

/* ---------- النسيان (خزنة أَثَر) ---------- */
export async function forgetLearner(db: Db, email: string) { await Promise.all([db.from('iqra_progress').delete().eq('learner_email', email), db.from('iqra_reviews').delete().eq('learner_email', email), db.from('iqra_time_log').delete().eq('learner_email', email), db.from('iqra_threshold_requests').delete().eq('learner_email', email), db.from('iqra_produce_reviews').delete().eq('learner_email', email), db.from('iqra_enrolments').delete().eq('learner_email', email)]); }

const LESSON_STATUSES = ['draft', 'in_review', 'approved', 'archived'] as const;
/* ---------- الطاقم ---------- */
export async function adminOverview(db: Db) {
  const [{ data: lessons }, { data: enr }, { data: units }, { data: lib }] = await Promise.all([db.from('iqra_lessons').select('id, unit_code, status').limit(2000), db.from('iqra_enrolments').select('level').eq('active', true).limit(5000), db.from('miaar_syllabus_units').select('code, level').limit(400), db.from('iqra_library').select('level, status').limit(2000)]);
  const lvl = new Map(((units || []) as any[]).map((u) => [u.code, u.level]));
  const out: Record<string, { draft: number; in_review: number; approved: number; archived: number; learners: number | null; library: number }> = {};
  for (const L of Object.keys(LEVEL_META)) out[L] = { draft: 0, in_review: 0, approved: 0, archived: 0, learners: 0, library: 0 };
  for (const x of (lib || []) as any[]) if (out[x.level] && x.status === 'approved') out[x.level].library += 1; /* الخطوة 2: نصوص المكتبة المعتمدة */
  for (const l of (lessons || []) as any[]) { const L = lvl.get(l.unit_code); if (L && out[L] && l.status in out[L]) (out[L] as any)[l.status] += 1; }
  for (const e of (enr || []) as any[]) if (out[e.level]) (out[e.level].learners as number) += 1;
  for (const L of Object.keys(out)) if ((out[L].learners as number) < IQRA_LIMITS.k_min) out[L].learners = null; /* k ≥ 5 */
  return out;
}
export async function adminLessons(db: Db, level: IqraLevel) {
  const units = await unitsOf(db, level); const codes = units.map((u) => u.code); if (!codes.length) return { units, lessons: [] as any[], library: [] as any[] };
  const { data } = await db.from('iqra_lessons').select(LESSON_COLS).in('unit_code', codes).order('unit_code').order('idx').limit(400);
  const ls = (data || []) as LessonRow[]; const allIds = ls.flatMap((l) => l.item_ids || []);
  const { data: cnt } = allIds.length ? await db.from('iqra_cards').select('lesson_id').in('lesson_id', ls.map((l) => l.id)) : { data: [] };
  const cards = new Map<string, number>(); for (const c of (cnt || []) as any[]) cards.set(c.lesson_id, (cards.get(c.lesson_id) || 0) + 1);
  const { data: lib } = await db.from('iqra_library').select('id, code, unit_code, kind, title_ar, minutes, status, questions, updated_at').eq('level', level).order('code').limit(200);
  return { units, lessons: ls.map((l) => ({ ...l, items: (l.item_ids || []).length, cards: cards.get(l.id) || 0, مهارة: skillOf(l) })), library: ((lib || []) as any[]).map((x) => ({ ...x, questions: Array.isArray(x.questions) ? x.questions.length : 0 })) };
}
export async function adminLibrary(db: Db, id: string) { if (!isId(id)) return null; const { data } = await db.from('iqra_library').select(LIB_COLS).eq('id', id).maybeSingle(); return data || null; }
export async function setLibraryStatus(db: Db, id: unknown, status: unknown, by: { email: string }) {
  if (!isId(id) || !(LESSON_STATUSES as readonly string[]).includes(String(status))) return { ok: false as const, error: 'bad_input' };
  const r = await db.from('iqra_library').update({ status, reviewed_by: by.email, reviewed_at: nowIso(), updated_at: nowIso() }).eq('id', id); return r.error ? { ok: false as const, error: r.error.message } : { ok: true as const };
}
/** ساعات المستوى للطاقم: متوسّط الساعات ومن بلغ الأرضية — مجموعات ≥ 5 فقط، بلا أسماء */
export async function adminHours(db: Db) {
  const { data } = await db.from('iqra_time_log').select('learner_email, level, activity, seconds').neq('activity', 'external').limit(20000);
  const per = new Map<string, Map<string, number>>(); for (const r of (data || []) as any[]) { const m = per.get(r.level) || new Map(); m.set(r.learner_email, (m.get(r.learner_email) || 0) + Number(r.seconds || 0)); per.set(r.level, m); }
  const out: Record<string, { learners: number; avg_hours: number; reached_pct: number; target: number } | null> = {};
  for (const L of Object.keys(LEVEL_META) as IqraLevel[]) { const m = per.get(L); if (!m || m.size < IQRA_LIMITS.k_min) { out[L] = null; continue; } const hs = [...m.values()].map((s) => s / 3600); out[L] = { learners: m.size, avg_hours: Math.round((hs.reduce((a, b) => a + b, 0) / hs.length) * 10) / 10, reached_pct: Math.round((hs.filter((h) => h >= HOURS_TARGET[L]).length / hs.length) * 100), target: HOURS_TARGET[L] }; }
  return out;
}
export async function adminLesson(db: Db, id: string) {
  const l = await lessonById(db, id); if (!l) return null;
  const [items, cards] = await Promise.all([itemsOf(db, l.item_ids || []), db.from('iqra_cards').select('id, idx, word_ar, pos, gloss_ar, example_ar').eq('lesson_id', l.id).order('idx')]);
  const { data: keys } = (l.item_ids || []).length ? await db.from('question_bank_answer_keys').select('item_id, correct_option_id, accepted').in('item_id', l.item_ids) : { data: [] };
  const kb = new Map(((keys || []) as any[]).map((k) => [k.item_id, k]));
  return { ...l, cards: cards.data || [], items: items.map((r) => ({ id: r.id, item_type: r.item_type, question_text: r.question_text, options: r.options, stimulus: r.stimulus, status: r.status, key: kb.get(r.id) || null })) };
}
/** اعتماد الحلقة يعتمد بنودها (مِران) معها؛ الإرجاع إلى مسوَّدة يُرجعها — قرار إنسان واحد للحلقة كلّها */
export async function setLessonStatus(db: Db, id: unknown, status: unknown, by: { email: string; id: string }, note: string | null) {
  if (!isId(id) || !(LESSON_STATUSES as readonly string[]).includes(String(status))) return { ok: false as const, error: 'bad_input' };
  const l = await lessonById(db, id); if (!l) return { ok: false as const, error: 'not_found' };
  if (status === 'approved' && !(l.item_ids || []).length) return { ok: false as const, error: 'لا تُعتمد حلقة بلا مِران' };
  const r = await db.from('iqra_lessons').update({ status, reviewed_by: by.email, reviewed_at: nowIso(), review_note: note, updated_at: nowIso() }).eq('id', id); if (r.error) return { ok: false as const, error: r.error.message };
  if ((l.item_ids || []).length) { const st = status === 'approved' ? 'approved' : status === 'archived' ? 'archived' : 'draft'; await db.from('question_bank_items').update({ status: st, reviewed_by: by.id, reviewed_at: nowIso(), updated_at: nowIso() }).in('id', l.item_ids).eq('source_kind', 'iqra'); invalidatePoolCache(); }
  return { ok: true as const };
}
/** استيراد حزمة: المنازل الناقصة تُنشأ مسوَّدةً · الحلقة المعتمدة لا تُمَسّ · المسوَّدة تُستبدل كاملةً (بطاقات ومِران) */
export async function importPack(db: Db, pack: Pack, by: { email: string; id: string }, batchId: string) {
  const report = { units_created: 0, lessons_created: 0, lessons_updated: 0, lessons_skipped: [] as string[], cards: 0, items: 0, library_created: 0, library_updated: 0, library_skipped: [] as string[], errors: [] as string[] };
  const version = pack.version === 'iqra-pack-2' ? 'iqra-s2' : 'iqra-q1';
  const { data: ex } = await db.from('miaar_syllabus_units').select('code, level, status').limit(400); const have = new Map(((ex || []) as any[]).map((u) => [u.code, u]));
  for (const u of pack.units || []) if (!have.has(u.code)) { const r = await db.from('miaar_syllabus_units').insert({ code: u.code, level: u.level, idx: u.idx, title_ar: u.title_ar, title_en: u.title_en || '', focus_ar: u.focus_ar || '', domains: u.domains || [], descriptor_codes: [], status: 'draft', updated_at: nowIso(), updated_by: by.email }); if (!r.error) { report.units_created += 1; have.set(u.code, u); } else report.errors.push(`${u.code}: ${r.error.message}`); }
  for (const l of pack.lessons) {
    if (!have.has(l.unit_code)) { report.errors.push(`${l.code}: المنزلة ${l.unit_code} غير موجودة في خريطة المنهج`); continue; }
    const level = (have.get(l.unit_code) as any).level as IqraLevel;
    const { data: old } = await db.from('iqra_lessons').select('id, status, item_ids').eq('code', l.code).maybeSingle();
    if (old && old.status === 'approved') { report.lessons_skipped.push(l.code); continue; }
    const oldItemIds: string[] = [...(((old?.item_ids as string[] | null) || []))];
    /* البنود */
    const rows = l.exercises.map((e, i) => exerciseToBank(e, l.code, i + 1, level, l.unit_code, l.skill || null, version)); const itemIds: string[] = [];
    for (const r of rows) {
      const { key, ...item } = r;
      const up = await db.from('question_bank_items').upsert({ ...item, import_batch_id: batchId, created_by: by.id, updated_at: nowIso() }, { onConflict: 'content_version,item_code' }).select('id').single();
      if (up.error || !up.data?.id) { report.errors.push(`${r.item_code}: ${up.error?.message || 'no id'}`); continue; }
      await db.from('question_bank_answer_keys').upsert({ item_id: up.data.id, correct_option_id: key.correct_option_id, accepted: key.accepted, updated_at: nowIso() }, { onConflict: 'item_id' });
      itemIds.push(up.data.id); report.items += 1;
    }
    const row = { code: l.code, unit_code: l.unit_code, idx: l.idx, title_ar: l.title_ar, goal_ar: l.goal_ar || '', minutes: l.minutes || 10, minutes_total: l.minutes_total || 120, skill: l.skill || null, can_do_ar: l.can_do_ar || '', can_do_en: l.can_do_en || '', descriptor_codes: l.descriptor_codes || [], domain: l.domain || 'شخصي', content: l.content, item_ids: itemIds, status: 'draft', version, import_batch_id: batchId, updated_at: nowIso() };
    let lessonId: string | null = null;
    if (old) { const r = await db.from('iqra_lessons').update(row).eq('id', old.id); if (r.error) { report.errors.push(`${l.code}: ${r.error.message}`); continue; } lessonId = old.id; report.lessons_updated += 1; await db.from('iqra_cards').delete().eq('lesson_id', old.id); const stale = oldItemIds.filter((id) => !itemIds.includes(id)); if (stale.length) { await db.from('question_bank_items').update({ status: 'archived', updated_at: nowIso() }).in('id', stale).eq('source_kind', 'iqra'); invalidatePoolCache(); } /* البنود القديمة التي لم تعد في الحلقة تُؤرشف لا تُحذف (سجلّ المتعلّمين) */ }
    else { const r = await db.from('iqra_lessons').insert({ ...row, created_at: nowIso() }).select('id').single(); if (r.error || !r.data?.id) { report.errors.push(`${l.code}: ${r.error?.message || 'no id'}`); continue; } lessonId = r.data.id; report.lessons_created += 1; }
    if (l.cards.length) { const r = await db.from('iqra_cards').insert(l.cards.map((c, i) => ({ lesson_id: lessonId, unit_code: l.unit_code, idx: i + 1, word_ar: c.word_ar, pos: c.pos || null, gloss_ar: c.gloss_ar, example_ar: c.example_ar || '', audio_path: c.audio_path || null, image_path: c.image_path || null, created_at: nowIso() }))); if (!r.error) report.cards += l.cards.length; else report.errors.push(`${l.code}/cards: ${r.error.message}`); }
  }
  for (const x of pack.library || []) {
    if (!have.has(x.unit_code)) { report.errors.push(`${x.code}: المنزلة ${x.unit_code} غير موجودة`); continue; }
    const level = (have.get(x.unit_code) as any).level as IqraLevel; const { data: old } = await db.from('iqra_library').select('id, status').eq('code', x.code).maybeSingle();
    if (old && old.status === 'approved') { report.library_skipped.push(x.code); continue; }
    const row = { code: x.code, unit_code: x.unit_code, level, kind: x.kind, title_ar: x.title_ar, body_ar: x.body_ar, minutes: x.minutes, questions: x.questions, descriptor_codes: x.descriptor_codes || [], status: 'draft', version: 'iqra-s2', updated_at: nowIso() };
    const r = old ? await db.from('iqra_library').update(row).eq('id', old.id) : await db.from('iqra_library').insert({ ...row, created_at: nowIso() });
    if (r.error) report.errors.push(`${x.code}: ${r.error.message}`); else if (old) report.library_updated += 1; else report.library_created += 1;
  }
  invalidatePoolCache(); return report;
}
