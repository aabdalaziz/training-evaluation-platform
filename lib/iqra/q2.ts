// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «اقْرَأْ» ق٢ — «العَتَبة» (level-exit gate) · طابور «أُنتج» (human feedback, analytic rubric) · التقاط الترقية.
 *  المبدأ: اقْرَأْ يعلّم ولا يحكم. «العَتَبة» ليست اختبارًا من صنع اقْرَأْ، بل «اختبار نهاية المستوى — معياري (CEFR)» القائم في مِعيار («عُبور» م6):
 *  اقْرَأْ يفتح الباب إليه (دعوة شخصية بعد قبول الطاقم) ويلتقط نتيجته من التقرير، ويلتقط قرار الترقية المعتمد فيغلق المستوى ويفتح التالي.
 *  لا كتابة في جداول مِعيار إلا عبر واجهاتها (createInvite). كلّ ما يكتبه المتعلّم ملكه ويُحذف مع تقدّمه.
 */
import { IQRA_LIMITS, LEVEL_META, THRESHOLD_LIVE, THRESHOLD_STATUS_AR, PRODUCE_RUBRIC, RUBRIC_AR, HOURS_TARGET, UI_AR, LICENCE_LESSON_CODE, LICENCE_TITLE_AR, licenceText, levelLabel, nextLevel, isIqraLevel, type IqraLevel, type ThresholdStatus, type RubricDim } from './registry';
import { hoursSummary, masteryOf, type Enrolment } from './store';
import { createInvite } from '../miaar/invites';
import { exitBlueprintCode, EXIT_SPEC, EXIT_CUT, EXIT_SKILL_MIN, EXIT_TITLE, RETAKE_DAYS, SKILL_RETAKE_DAYS, isExitLevel, type ExitLevel } from '../miaar/exit';
import { pushNotice } from '../portal/notices';

type Db = any;
const nowIso = () => new Date().toISOString();
const UUID = /^[0-9a-f-]{8,40}$/i; const isId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const REQ_COLS = 'id, learner_email, user_id, enrolment_id, level, gate, hours_at, mastery_at, produce_scores, status, invite_id, invite_url, recipient_id, report_id, exit_total, defer_note, decided_by, created_at, updated_at';
export type ThresholdRow = { id: string; learner_email: string; user_id: string | null; enrolment_id: string; level: IqraLevel; gate: 'early' | 'full'; hours_at: number; mastery_at: number; produce_scores: number[]; status: ThresholdStatus; invite_id: string | null; invite_url: string | null; recipient_id: string | null; report_id: string | null; exit_total: number | null; defer_note: string | null; decided_by: string | null; created_at: string; updated_at: string };

/** ما هو الاختبار — يُقال للمتعلّم بصدق قبل أن يطلب (من مواصفات «عُبور» نفسها) */
export function examFacts(level: IqraLevel) {
  if (!isExitLevel(level)) return null; const s = EXIT_SPEC[level as ExitLevel];
  return { official_ar: EXIT_TITLE.ar, official_en: EXIT_TITLE.en, level, minutes: s.minutes, counts: { listening: s.listening, reading: s.reading, grammar_vocab: s.grammar_vocab, writing: s.writing, speaking: s.speaking }, writing_words: s.writingWords, speaking_seconds: s.speakingSeconds, cut: EXIT_CUT, skill_min: EXIT_SKILL_MIN, retake_days: RETAKE_DAYS, skill_retake_days: SKILL_RETAKE_DAYS, weights_ar: 'استقبالي 60% · كتابة 20% · تحدّث 20%' };
}

/* ---------- قراءة ---------- */
export async function liveRequest(db: Db, email: string): Promise<ThresholdRow | null> {
  const { data } = await db.from('iqra_threshold_requests').select(REQ_COLS).eq('learner_email', email).in('status', [...THRESHOLD_LIVE]).order('created_at', { ascending: false }).limit(1);
  return (Array.isArray(data) && data[0]) || null;
}
async function lastRequest(db: Db, email: string): Promise<ThresholdRow | null> {
  const { data } = await db.from('iqra_threshold_requests').select(REQ_COLS).eq('learner_email', email).order('created_at', { ascending: false }).limit(1);
  return (Array.isArray(data) && data[0]) || null;
}
async function lastProduceScores(db: Db, email: string, level: IqraLevel): Promise<number[]> {
  const { data } = await db.from('iqra_produce_reviews').select('score, reviewed_at').eq('learner_email', email).eq('level', level).eq('status', 'reviewed').order('reviewed_at', { ascending: false }).limit(3);
  return ((data || []) as any[]).map((r) => Number(r.score)).filter((n) => n >= 1 && n <= 4);
}

/** بطاقة «العَتَبة» للمتعلّم: الأهلية من «ساعاتي» + الطلب الحيّ أو آخر طلب + ما يُقال عند كلّ حالة */
export async function thresholdView(db: Db, e: Enrolment, now = new Date()) {
  const mastery = await masteryOf(db, e); const h = await hoursSummary(db, e, mastery, now);
  const req = (await liveRequest(db, e.learner_email)) || (await lastRequest(db, e.learner_email));
  if (req && THRESHOLD_LIVE.includes(req.status)) await syncFromReport(db, req).catch(() => null);
  const fresh = req ? (await liveRequest(db, e.learner_email)) || (await lastRequest(db, e.learner_email)) : null;
  const next = nextLevel(e.level); const facts = examFacts(e.level);
  const eligible = h.threshold.state !== 'building' && !!facts && !!next;
  const reason = !next ? 'top_level' : !facts ? 'no_exam' : h.threshold.state === 'building' ? 'building' : null;
  const r = fresh; let invite_url: string | null = null;
  if (r && r.status === 'invited' && r.invite_id) { const { data: inv } = await db.from('placement_invites').select('code, opens_at, expires_at, status').eq('id', r.invite_id).maybeSingle(); invite_url = r.invite_url || (inv?.code ? `/miaar/d/${inv.code}` : null); (r as any).opens_at = inv?.opens_at || null; (r as any).expires_at = inv?.expires_at || null; }
  return {
    state: h.threshold.state, gate: h.threshold.state === 'ready' ? 'full' : h.threshold.state === 'early' ? 'early' : null, hours: h.hours, target: h.target, mastery_pct: mastery,
    eligible, reason, next_label: next ? levelLabel(next) : null, exam: facts,
    copy: { what: UI_AR.thr_what, who: UI_AR.thr_who, pre_a1: e.level === 'PRE_A1' ? UI_AR.thr_pre_a1 : null, c2: !next ? UI_AR.thr_c2 : null },
    licence: !next ? await licenceOf(db, e.learner_email) : null,
    request: r ? { id: r.id, status: r.status, status_ar: THRESHOLD_STATUS_AR[r.status], gate: r.gate, created_at: r.created_at, updated_at: r.updated_at, defer_note: r.defer_note, exit_total: r.exit_total, invite_url, opens_at: (r as any).opens_at || null, expires_at: (r as any).expires_at || null, report_id: r.report_id } : null,
  };
}

/* ---------- طلب المتعلّم ---------- */
export async function requestThreshold(db: Db, e: Enrolment, now = new Date()) {
  const next = nextLevel(e.level); if (!next) return { ok: false as const, error: 'top_level' };
  if (!examFacts(e.level)) return { ok: false as const, error: 'no_exam' };
  const mastery = await masteryOf(db, e); const h = await hoursSummary(db, e, mastery, now);
  if (h.threshold.state === 'building') return { ok: false as const, error: 'not_ready' };
  if (await liveRequest(db, e.learner_email)) return { ok: false as const, error: 'already_requested' };
  const row = { learner_email: e.learner_email, user_id: e.user_id, enrolment_id: e.id, level: e.level, gate: h.threshold.state === 'ready' ? 'full' : 'early', hours_at: h.hours, mastery_at: mastery, produce_scores: await lastProduceScores(db, e.learner_email, e.level), status: 'requested', created_at: nowIso(), updated_at: nowIso() };
  const r = await db.from('iqra_threshold_requests').insert(row).select(REQ_COLS).single();
  if (r.error) return { ok: false as const, error: String(r.error.code) === '23505' ? 'already_requested' : 'db' };
  return { ok: true as const, request: r.data as ThresholdRow };
}
export async function cancelThreshold(db: Db, e: Enrolment, id: unknown) {
  if (!isId(id)) return { ok: false as const, error: 'bad_input' };
  const { data: r } = await db.from('iqra_threshold_requests').select('id, status').eq('id', id).eq('learner_email', e.learner_email).maybeSingle(); if (!r) return { ok: false as const, error: 'not_found' };
  if (!['requested', 'deferred', 'invited'].includes(r.status)) return { ok: false as const, error: 'not_cancellable' };
  await db.from('iqra_threshold_requests').update({ status: 'cancelled', updated_at: nowIso() }).eq('id', r.id); return { ok: true as const };
}

/* ---------- الالتقاط من تقرير مِعيار (sat → passed/failed → promoted) ---------- */
/** يقرأ تقرير «عُبور» المرتبط بالدعوة ويحدّث الحالة؛ ثم يلتقط قرار الترقية المعتمد فيغلق المستوى ويفتح التالي. لا يرمي. */
export async function syncFromReport(db: Db, req: ThresholdRow): Promise<ThresholdRow> {
  if (!['invited', 'sat', 'passed'].includes(req.status) || !req.invite_id) return req;
  const { data: reps } = await db.from('placement_reports').select('id, report, created_at').eq('invite_id', req.invite_id).ilike('candidate_email', req.learner_email).order('created_at', { ascending: false }).limit(1);
  const rep = Array.isArray(reps) && reps[0]; if (!rep) return req;
  const ex = (rep.report || {}).exit as any; let status: ThresholdStatus = 'sat'; let exit_total: number | null = null;
  if (ex && ex.الحالة === 'final') { status = ex.النتيجة === 'passed' ? 'passed' : ex.النتيجة === 'conditional' ? 'sat' : 'failed'; exit_total = Number.isFinite(Number(ex.الكلي)) ? Math.round(Number(ex.الكلي)) : null; }
  /* الترقية: قرار معتمد على هذا التقرير بمستوى أعلى */
  if (status === 'passed') {
    const { data: dec } = await db.from('placement_decisions').select('assigned_level, decision_status').eq('report_id', rep.id).maybeSingle();
    if (dec?.decision_status === 'approved' && isIqraLevel(dec.assigned_level) && dec.assigned_level !== req.level) { await promote(db, req, rep.id, dec.assigned_level as IqraLevel); status = 'promoted'; }
  }
  if (status !== req.status || rep.id !== req.report_id) { await db.from('iqra_threshold_requests').update({ status, report_id: rep.id, exit_total, updated_at: nowIso() }).eq('id', req.id); }
  return { ...req, status, report_id: rep.id, exit_total };
}
async function promote(db: Db, req: ThresholdRow, reportId: string, to: IqraLevel) {
  await db.from('iqra_enrolments').update({ active: false, closed_reason: 'threshold', closed_at: nowIso(), updated_at: nowIso() }).eq('learner_email', req.learner_email).eq('active', true);
  const ins = await db.from('iqra_enrolments').insert({ learner_email: req.learner_email, user_id: req.user_id, level: to, source: 'threshold', report_id: reportId, placed_by: null, note: `عبور ${req.level} → ${to} (طلب ${req.id})`, active: true, created_at: nowIso(), updated_at: nowIso() }).select('id').single();
  if (ins.error) { /* سباق: تسكين نشط آخر — نعيد تفعيل القديم */ await db.from('iqra_enrolments').update({ active: true, closed_reason: null, closed_at: null }).eq('id', req.enrolment_id); return false; }
  try { await pushNotice(db, { email: req.learner_email, user_id: req.user_id, report_id: reportId, kind: 'iqra_threshold', title_ar: `عبرتَ ${LEVEL_META[req.level].name_ar} — مرحبًا بك في ${levelLabel(to)}`, body_ar: 'اعتمد طاقم أَثَر انتقالك. مكتبة مستواك السابق ومراجعاته تبقى مفتوحة لك.', url: '/iqra', ref_id: req.id, dedupe_key: `iqra_promoted:${req.id}` }); } catch { /* لا يعطّل */ }
  return true;
}
/** بطاقة «عبرتُ» في بيت المتعلّم بعد الانتقال (أربعة عشر يومًا): ساعاته الفعلية في المستوى السابق وخطّ العبور */
export async function crossedCard(db: Db, e: Enrolment) {
  if (e.source !== 'threshold') return null; if (Date.now() - Date.parse(e.created_at) > 14 * 86400e3) return null;
  const { data: prev } = await db.from('iqra_enrolments').select('id, level, created_at, closed_at').eq('learner_email', e.learner_email).eq('closed_reason', 'threshold').order('closed_at', { ascending: false }).limit(1);
  const p = Array.isArray(prev) && prev[0]; if (!p || !isIqraLevel(p.level)) return null;
  const { data: tl } = await db.from('iqra_time_log').select('activity, seconds, day').eq('learner_email', e.learner_email).eq('level', p.level).neq('activity', 'external').limit(5000);
  const rows = (tl || []) as any[]; const sec = rows.reduce((s, r) => s + Number(r.seconds || 0), 0); const days = new Set(rows.filter((r) => Number(r.seconds) > 0).map((r) => r.day)).size;
  const { data: rq } = await db.from('iqra_threshold_requests').select('exit_total, gate').eq('learner_email', e.learner_email).eq('status', 'promoted').order('updated_at', { ascending: false }).limit(1);
  const q = Array.isArray(rq) && rq[0];
  return { from: levelLabel(p.level), to: levelLabel(e.level), hours: Math.round((sec / 3600) * 10) / 10, target: HOURS_TARGET[p.level as IqraLevel], days, exit_total: q?.exit_total ?? null, gate: q?.gate || null, since: p.created_at, until: p.closed_at };
}

/* ---------- الطاقم: مكتب العَتَبة ---------- */
export async function adminThresholds(db: Db, now = new Date()) {
  const { data } = await db.from('iqra_threshold_requests').select(REQ_COLS).order('created_at', { ascending: true }).limit(500);
  const rows = (data || []) as ThresholdRow[];
  for (const r of rows) if (['invited', 'sat', 'passed'].includes(r.status) && r.invite_id) { const s = await syncFromReport(db, r).catch(() => r); Object.assign(r, s); }
  const live = rows.filter((r) => THRESHOLD_LIVE.includes(r.status)); const done = rows.filter((r) => !THRESHOLD_LIVE.includes(r.status)).slice(-100).reverse();
  /* عدّادات k≥5: نسبة الاجتياز حسب البوّابة — الدليل الذي يحكم على 70/90 لاحقًا */
  const stats: Record<'early' | 'full', { n: number; pass_pct: number } | null> = { early: null, full: null };
  for (const g of ['early', 'full'] as const) { const fin = rows.filter((r) => r.gate === g && ['passed', 'failed', 'promoted'].includes(r.status)); if (fin.length >= IQRA_LIMITS.k_min) stats[g] = { n: fin.length, pass_pct: Math.round((fin.filter((r) => r.status !== 'failed').length / fin.length) * 100) }; }
  const { data: invs } = await db.from('placement_invites').select('id, code, label_ar, level_target, opens_at, expires_at, status, purpose').eq('purpose', 'level_exit').eq('status', 'open').order('created_at', { ascending: false }).limit(50);
  const open_invites = ((invs || []) as any[]).filter((i) => !i.expires_at || Date.parse(i.expires_at) > now.getTime()).map((i) => ({ id: i.id, code: i.code, label_ar: i.label_ar, level: i.level_target, opens_at: i.opens_at, expires_at: i.expires_at }));
  const pub = (r: ThresholdRow) => ({ ...r, status_ar: THRESHOLD_STATUS_AR[r.status], level_label: levelLabel(r.level), target: HOURS_TARGET[r.level], days: Math.floor((now.getTime() - Date.parse(r.created_at)) / 86400e3) });
  return { live: live.map(pub), done: done.map(pub), stats, open_invites, statuses_ar: THRESHOLD_STATUS_AR };
}
/** قبول الطلب: دعوة «عُبور» شخصية (الافتراضي) أو ضمّ إلى دعوة مستوى مفتوحة (شعبة/موعد) */
export async function acceptThreshold(db: Db, id: unknown, actor: { id: string; email: string }, site: string, opts: { invite_id?: unknown; opens_at?: unknown; note?: unknown } = {}) {
  if (!isId(id)) return { ok: false as const, error: 'bad_input' };
  const { data: r } = await db.from('iqra_threshold_requests').select(REQ_COLS).eq('id', id).maybeSingle(); const req = r as ThresholdRow | null;
  if (!req) return { ok: false as const, error: 'not_found' }; if (!['requested', 'deferred'].includes(req.status)) return { ok: false as const, error: 'not_pending' };
  if (!isExitLevel(req.level)) return { ok: false as const, error: 'no_exam' };
  let inviteId: string | null = null; let recipientId: string | null = null; let url = '';
  if (isId(opts.invite_id)) {
    const { data: inv } = await db.from('placement_invites').select('id, code, level_target, purpose, status, kind').eq('id', opts.invite_id).maybeSingle();
    if (!inv || inv.status !== 'open' || inv.purpose !== 'level_exit' || inv.level_target !== req.level || inv.kind !== 'group') return { ok: false as const, error: 'invite_mismatch' };
    inviteId = inv.id; url = `/miaar/d/${inv.code}`;
  } else {
    const { data: bp } = await db.from('question_bank_blueprints').select('id, status').eq('code', exitBlueprintCode(req.level as ExitLevel)).maybeSingle();
    if (!bp?.id || bp.status !== 'active') return { ok: false as const, error: 'blueprint_missing' };
    const opens_at = typeof opts.opens_at === 'string' && !Number.isNaN(Date.parse(opts.opens_at)) ? new Date(opts.opens_at).toISOString() : null;
    const expires_at = new Date((opens_at ? Date.parse(opens_at) : Date.now()) + IQRA_LIMITS.threshold_invite_days * 86400e3).toISOString();
    const c = await createInvite(db, { kind: 'personal', label_ar: `عَتَبة اقْرَأْ — ${levelLabel(req.level)}`, lang: 'ar', exam_mode: 'comprehensive', purpose: 'level_exit', blueprint_id: bp.id, expires_at, max_seats: 1, recipients: [req.learner_email], level_target: req.level, opens_at, reuse_key: `iqra:${req.id}`, note: typeof opts.note === 'string' ? opts.note.slice(0, 300) : `عَتَبة اقْرَأْ · طلب ${req.id} · ساعات ${req.hours_at}/${HOURS_TARGET[req.level]} · إتقان ${req.mastery_at}%` } as any, actor.id, site);
    if (!c.ok) return { ok: false as const, error: c.error };
    inviteId = c.invite.id; url = c.links[0]?.url || c.url; const { data: rc } = await db.from('placement_invite_recipients').select('id').eq('invite_id', inviteId).eq('email', req.learner_email).limit(1); recipientId = (Array.isArray(rc) && rc[0]?.id) || null;
  }
  const rel = url.replace(/^https?:\/\/[^/]+/, '');
  await db.from('iqra_threshold_requests').update({ status: 'invited', invite_id: inviteId, invite_url: rel, recipient_id: recipientId, decided_by: actor.id, defer_note: null, updated_at: nowIso() }).eq('id', req.id);
  try { await pushNotice(db, { email: req.learner_email, user_id: req.user_id, kind: 'iqra_threshold', title_ar: `دعوتك إلى العَتَبة جاهزة — ${levelLabel(req.level)}`, body_ar: `قبل طاقم أَثَر طلبك. ${EXIT_TITLE.ar}: افتح الرابط من جهاز هادئ وأتمّه في جلسة واحدة.`, url, ref_id: req.id, dedupe_key: `iqra_thr_invited:${req.id}` }, { site }); } catch { /* لا يعطّل */ }
  return { ok: true as const, url, invite_id: inviteId };
}
export async function deferThreshold(db: Db, id: unknown, note: unknown, actor: { id: string }) {
  if (!isId(id)) return { ok: false as const, error: 'bad_input' }; const n = typeof note === 'string' ? note.trim().slice(0, 300) : ''; if (!n) return { ok: false as const, error: 'note_required' };
  const { data: r } = await db.from('iqra_threshold_requests').select('id, status, learner_email, user_id, level').eq('id', id).maybeSingle(); if (!r) return { ok: false as const, error: 'not_found' }; if (r.status !== 'requested') return { ok: false as const, error: 'not_pending' };
  await db.from('iqra_threshold_requests').update({ status: 'deferred', defer_note: n, decided_by: actor.id, updated_at: nowIso() }).eq('id', r.id);
  try { await pushNotice(db, { email: r.learner_email, user_id: r.user_id, kind: 'iqra_threshold', title_ar: 'طلب العَتَبة: ليس بعد', body_ar: n, url: '/iqra', ref_id: r.id, dedupe_key: `iqra_thr_deferred:${r.id}:${Date.now()}` }); } catch { /* لا يعطّل */ }
  return { ok: true as const };
}

/* ---------- طابور «أُنتج» ---------- */
const PR_COLS = 'id, learner_email, user_id, lesson_id, level, kind, text, words, checked, status, score, rubric, comment, rewritten, reviewer_id, reviewed_at, created_at';
const weekAgo = (now: Date) => new Date(now.getTime() - 7 * 86400e3).toISOString();
export async function queueDepth(db: Db) { const { count } = await db.from('iqra_produce_reviews').select('id', { count: 'exact', head: true }).eq('status', 'queued'); return Number(count || 0); }
/** المتعلّم يرسل نصّه المحفوظ في محطّة «أُنتج» إلى المراجعة البشرية — الكتابة فقط، ≥ 20 كلمة، نصّان في الأسبوع، نصّ واحد في الطابور لكلّ حلقة */
export async function sendProduce(db: Db, e: Enrolment, lessonId: unknown, now = new Date()) {
  if (!isId(lessonId)) return { ok: false as const, error: 'bad_input' };
  const { data: p } = await db.from('iqra_progress').select('answers').eq('learner_email', e.learner_email).eq('lesson_id', lessonId).maybeSingle();
  const pr = p?.answers?._produce; if (!pr || pr.kind !== 'write' || !pr.text) return { ok: false as const, error: 'save_first' };
  const text = String(pr.text).replace(/\s+/g, ' ').trim().slice(0, 2000); const words = text.split(' ').filter(Boolean).length;
  if (words < IQRA_LIMITS.produce_min_words) return { ok: false as const, error: 'too_short', min: IQRA_LIMITS.produce_min_words };
  const { data: dup } = await db.from('iqra_produce_reviews').select('id').eq('learner_email', e.learner_email).eq('lesson_id', lessonId).eq('status', 'queued').limit(1); if (Array.isArray(dup) && dup.length) return { ok: false as const, error: 'already_queued' };
  const { count } = await db.from('iqra_produce_reviews').select('id', { count: 'exact', head: true }).eq('learner_email', e.learner_email).neq('status', 'withdrawn').gte('created_at', weekAgo(now));
  if (Number(count || 0) >= IQRA_LIMITS.produce_per_week) return { ok: false as const, error: 'weekly_limit', limit: IQRA_LIMITS.produce_per_week };
  const ins = await db.from('iqra_produce_reviews').insert({ learner_email: e.learner_email, user_id: e.user_id, lesson_id: lessonId, level: e.level, kind: 'write', text, words, checked: Array.isArray(pr.checked) ? pr.checked : [], status: 'queued', created_at: nowIso() }).select('id').single();
  if (ins.error) return { ok: false as const, error: 'db' };
  const depth = await queueDepth(db); return { ok: true as const, id: ins.data.id, eta_ar: depth > IQRA_LIMITS.produce_slow_queue ? 'خلال أسبوعين' : 'خلال أسبوع', depth };
}
export async function withdrawProduce(db: Db, e: Enrolment, id: unknown) {
  if (!isId(id)) return { ok: false as const, error: 'bad_input' };
  const { data: r } = await db.from('iqra_produce_reviews').select('id, status').eq('id', id).eq('learner_email', e.learner_email).maybeSingle(); if (!r) return { ok: false as const, error: 'not_found' }; if (r.status !== 'queued') return { ok: false as const, error: 'not_queued' };
  await db.from('iqra_produce_reviews').update({ status: 'withdrawn' }).eq('id', r.id); return { ok: true as const };
}
/** ردود المراجعة للمتعلّم (حلقة واحدة أو كلّها) + ما بقي له هذا الأسبوع */
export async function produceReviews(db: Db, e: Enrolment, lessonId?: unknown, now = new Date()) {
  let q = db.from('iqra_produce_reviews').select(PR_COLS).eq('learner_email', e.learner_email).neq('status', 'withdrawn').order('created_at', { ascending: false }).limit(50); if (isId(lessonId)) q = q.eq('lesson_id', lessonId);
  const { data } = await q; const rows = (data || []) as any[];
  const used = rows.filter((r) => Date.parse(r.created_at) >= Date.parse(weekAgo(now))).length;
  return { ردود: rows.map(pubReview), left_this_week: Math.max(0, IQRA_LIMITS.produce_per_week - used), limit: IQRA_LIMITS.produce_per_week, copy: UI_AR.prod_who };
}
const pubReview = (r: any) => ({ id: r.id, lesson_id: r.lesson_id, status: r.status, words: r.words, text: r.text, created_at: r.created_at, reviewed_at: r.reviewed_at, score: r.score, rubric: r.rubric ? Object.fromEntries(PRODUCE_RUBRIC.map((d) => [d, { score: Number(r.rubric[d]) || null, name_ar: RUBRIC_AR[d].name_ar, band_ar: RUBRIC_AR[d].bands_ar[(Number(r.rubric[d]) || 1) - 1] }])) : null, comment: r.comment, rewritten: r.rewritten });
/* الطاقم */
export async function adminProduce(db: Db, which: 'queue' | 'done' = 'queue') {
  const { data } = which === 'queue' ? await db.from('iqra_produce_reviews').select(PR_COLS).eq('status', 'queued').order('created_at', { ascending: true }).limit(200) : await db.from('iqra_produce_reviews').select(PR_COLS).eq('status', 'reviewed').order('reviewed_at', { ascending: false }).limit(100);
  const rows = (data || []) as any[]; const lids = [...new Set(rows.map((r) => r.lesson_id))];
  const { data: ls } = lids.length ? await db.from('iqra_lessons').select('id, code, title_ar, content').in('id', lids) : { data: [] };
  const lb = new Map(((ls || []) as any[]).map((l) => [l.id, l]));
  return { depth: await queueDepth(db), rubric: RUBRIC_AR, dims: PRODUCE_RUBRIC, rows: rows.map((r) => { const l = lb.get(r.lesson_id); return { ...pubReview(r), learner_email: r.learner_email, level: r.level, level_label: levelLabel(r.level), checked: r.checked, lesson: l ? { code: l.code, title_ar: l.title_ar, prompt_ar: l.content?.produce?.prompt_ar || '', model_ar: l.content?.produce?.model_ar || '', checklist: l.content?.produce?.checklist || [] } : null, days: Math.floor((Date.now() - Date.parse(r.created_at)) / 86400e3) }; }) };
}
export async function reviewProduce(db: Db, id: unknown, actor: { id: string }, input: { rubric: unknown; comment: unknown; rewritten: unknown }) {
  if (!isId(id)) return { ok: false as const, error: 'bad_input' };
  const rb = (input.rubric || {}) as Record<string, unknown>; const rubric: Record<RubricDim, number> = {} as any;
  for (const d of PRODUCE_RUBRIC) { const n = Number(rb[d]); if (!Number.isInteger(n) || n < 1 || n > 4) return { ok: false as const, error: `rubric_${d}` }; rubric[d] = n; }
  const comment = typeof input.comment === 'string' ? input.comment.trim().slice(0, 400) : ''; const rewritten = typeof input.rewritten === 'string' ? input.rewritten.trim().slice(0, 300) : '';
  if (!comment) return { ok: false as const, error: 'comment_required' };
  const { data: r } = await db.from('iqra_produce_reviews').select('id, status, learner_email, user_id, lesson_id').eq('id', id).maybeSingle(); if (!r) return { ok: false as const, error: 'not_found' }; if (r.status !== 'queued') return { ok: false as const, error: 'not_queued' };
  const score = Math.round(PRODUCE_RUBRIC.reduce((s, d) => s + rubric[d], 0) / PRODUCE_RUBRIC.length);
  await db.from('iqra_produce_reviews').update({ status: 'reviewed', score, rubric, comment, rewritten: rewritten || null, reviewer_id: actor.id, reviewed_at: nowIso() }).eq('id', r.id);
  try { await pushNotice(db, { email: r.learner_email, user_id: r.user_id, kind: 'iqra_produce', title_ar: `قرأ مصحّح أَثَر نصّك: ${score} من 4`, body_ar: comment.slice(0, 160), url: '/iqra', ref_id: r.id, dedupe_key: `iqra_produce:${r.id}` }); } catch { /* لا يعطّل */ }
  return { ok: true as const, score };
}

/* ---------- «إجازة أَثَر» (C2 ج٤): لا عَتَبة بعد المتقن ---------- */
export type Licence = { id: string; level: IqraLevel; title_ar: string; text_ar: string; issued_at: string; issued_by: string | null };
const pubLicence = (r: any): Licence | null => (r && r.answers?.licence ? { id: r.id, level: r.answers.licence.level || 'C2', title_ar: LICENCE_TITLE_AR, text_ar: String(r.answers.licence.text_ar || ''), issued_at: String(r.answers.licence.issued_at || r.done_at || r.created_at), issued_by: r.answers.licence.issued_by || null } : null);
/** الإجازة الصادرة للمتعلّم إن وُجدت — سطر iqra_progress بلا حلقة ولا نصّ (station = 'licence') */
export async function licenceOf(db: Db, email: string): Promise<Licence | null> {
  const { data } = await db.from('iqra_progress').select('id, answers, done_at, created_at').eq('learner_email', email).eq('station', 'licence').is('lesson_id', null).limit(1);
  return pubLicence(Array.isArray(data) ? data[0] : null);
}
/** من يستحقّ الإجازة ولم تصدر له: متعلّم مسكَّن في C2 رُوجع مشروعه الختاميّ (حلقة الإجازة) في طابور «أُنتج» — للطاقم */
export async function licenceQueue(db: Db) {
  const { data: l } = await db.from('iqra_lessons').select('id, code, title_ar').eq('code', LICENCE_LESSON_CODE).maybeSingle(); if (!l) return { lesson: null, rows: [] as any[], issued: [] as any[] };
  const [{ data: rv }, { data: lic }] = await Promise.all([db.from('iqra_produce_reviews').select('id, learner_email, user_id, score, reviewed_at').eq('lesson_id', l.id).eq('status', 'reviewed').order('reviewed_at', { ascending: true }).limit(500), db.from('iqra_progress').select('id, learner_email, answers, done_at, created_at').eq('station', 'licence').is('lesson_id', null).limit(1000)]);
  const have = new Set(((lic || []) as any[]).map((r) => r.learner_email));
  const seen = new Set<string>(); const rows: any[] = [];
  for (const r of (rv || []) as any[]) { if (have.has(r.learner_email) || seen.has(r.learner_email)) continue; seen.add(r.learner_email); rows.push({ learner_email: r.learner_email, score: r.score, reviewed_at: r.reviewed_at }); }
  return { lesson: { code: l.code, title_ar: l.title_ar }, rows, issued: ((lic || []) as any[]).map((r) => ({ learner_email: r.learner_email, ...pubLicence(r) })).slice(-100).reverse() };
}
/** إصدار الإجازة (مديرون): مرّة واحدة لكلّ متعلّم، بعد مراجعة مشروعه الختاميّ، وهو في المتقن. تُكتب سطرًا في التقدّم + حدثًا في «خريطة أثري» + إشعارًا. */
export async function issueLicence(db: Db, email: unknown, actor: { id: string; email: string }, now = new Date()) {
  const em = typeof email === 'string' ? email.trim().toLowerCase() : ''; if (!em) return { ok: false as const, error: 'bad_input' };
  const { data: e } = await db.from('iqra_enrolments').select('id, learner_email, user_id, level, active').eq('learner_email', em).eq('active', true).maybeSingle();
  if (!e) return { ok: false as const, error: 'not_enrolled' }; if (e.level !== 'C2') return { ok: false as const, error: 'not_c2' };
  if (await licenceOf(db, em)) return { ok: false as const, error: 'already_issued' };
  const { data: l } = await db.from('iqra_lessons').select('id').eq('code', LICENCE_LESSON_CODE).maybeSingle(); if (!l) return { ok: false as const, error: 'no_lesson' };
  const { data: rv } = await db.from('iqra_produce_reviews').select('id, score').eq('learner_email', em).eq('lesson_id', l.id).eq('status', 'reviewed').limit(1);
  if (!Array.isArray(rv) || !rv[0]) return { ok: false as const, error: 'project_not_reviewed' };
  const issued_at = now.toISOString(); const text_ar = licenceText(em, issued_at);
  const ins = await db.from('iqra_progress').insert({ learner_email: em, user_id: e.user_id || null, lesson_id: null, library_id: null, station: 'licence', status: 'done', score: null, attempts: 0, answers: { licence: { level: 'C2', title_ar: LICENCE_TITLE_AR, text_ar, issued_at, issued_by: actor.email, review_id: rv[0].id } }, last_seen_at: issued_at, done_at: issued_at }).select('id').single();
  if (ins.error || !ins.data) return { ok: false as const, error: 'db' };
  try { await db.from('portal_learning_events').insert({ user_id: e.user_id || null, email: em, verb: 'issued', object_type: 'iqra_licence', object_id: String(ins.data.id), skills: [], context: { level: 'C2', title_ar: LICENCE_TITLE_AR, issued_at } }); } catch { /* الخريطة اختياريّة */ }
  try { await pushNotice(db, { email: em, user_id: e.user_id || null, kind: 'iqra_threshold', title_ar: LICENCE_TITLE_AR, body_ar: 'أجازك طاقم أَثَر. نصّ الإجازة في صفحة اقْرَأْ وفي «خريطة أثري».', url: '/iqra', ref_id: String(ins.data.id), dedupe_key: `iqra_licence:${em}` }); } catch { /* لا يعطّل */ }
  return { ok: true as const, licence: { id: String(ins.data.id), level: 'C2' as IqraLevel, title_ar: LICENCE_TITLE_AR, text_ar, issued_at, issued_by: actor.email } };
}

/* ---------- النسيان ---------- */
export async function forgetQ2(db: Db, email: string) { await Promise.all([db.from('iqra_threshold_requests').delete().eq('learner_email', email), db.from('iqra_produce_reviews').delete().eq('learner_email', email)]); }
