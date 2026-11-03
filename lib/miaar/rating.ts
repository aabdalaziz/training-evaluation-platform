// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** مِعيار — م4-ب «غرفة التصحيح» + م4-ج «هيئة التصحيح» (خادم فقط):
 *  طابور الأداءات بلا أسماء · التفصيل (النص أو رابط صوت موقَّع 5 دقائق + المهمة + سُلّم التقدير) · قراءات متعدّدة لكل أداء (1 · 2 عمياء · 3 تحكيم · 0 تأهيل على مرساة)
 *  · قاعدة الاتفاق (اتفاق/متوسّط/تحكيم) · الإصدار يكتب «معتمد» في بطاقة المتقدّم · اعتماد المصحّح بالمراسي · «مرآة المصحّح» · نسخ النصوص · حذف الصوت بعد 180 يومًا.
 *  «عيّنة المصحّح»: اقتراح أولي من الذكاء الاصطناعي للنصوص فقط وبموافقة المتقدّم — لا يرى اسمًا ولا بريدًا، ولا يُنشر شيء منه. */
import { MEDIA_BUCKET } from './bank';
import { humanRatingFrom } from './performance';
import { refreshProductive } from './room';
import { parseAiRating, RUBRIC_DIMENSIONS, DIMENSION_AR } from './rubric';
import type { AiRating, RubricScores } from './rubric';
import type { BankLevel, ProductiveSkill } from './registry';
import { runAi, aiUsage, logAi } from '../ai/athar';
import { RATER_POLICY, bandOf, needsSecondReading, agreementOf, calibrationOf, raterMirror, agreementReport, fluencyOf, maskRater } from './raters';
import type { Reading, Mirror, Calibration } from './raters';

const nowIso = () => new Date().toISOString();
const SIGN_SECONDS = 5 * 60;
export type Actor = { id: string; email: string; role: string; kind: 'staff' | 'rater' };
export type QueueFilter = 'pending' | 'second' | 'adjudicate' | 'released' | 'anchors' | 'all';
export type QueueRow = { id: string; skill: ProductiveSkill; status: string; item_code: string; level_target: BankLevel; word_count: number | null; duration_sec: number | null; accommodation: string | null; ai_consent: boolean; has_ai: boolean; created_at: string; rated_at: string | null; released_at: string | null; session_short: string; receptive_level: string | null;
  second_reading: boolean; adjudication: string | null; is_anchor: boolean; readings: number; my_reading: number | null; has_transcript: boolean; media_purged: boolean };

const PERF_COLS = 'id, session_id, skill, status, item_code, level_target, word_count, duration_sec, accommodation, ai_consent, ai_rating, created_at, rated_at, released_at, second_reading, adjudication, is_anchor, transcript, media_path, media_purged_at';
async function readingsFor(db: any, ids: string[]): Promise<Reading[]> {
  if (!ids.length) return []; const { data } = await db.from('miaar_performance_ratings').select('performance_id, rater_id, reading, scores, band, mean, note_ar, seconds, created_at').in('performance_id', ids).limit(2000);
  return (data || []) as Reading[];
}

/* ---------- اعتماد المصحّح ---------- */
export type CalibrationState = Calibration & { exempt: boolean; locked_until: string | null; staff: boolean };
/** حال اعتماد مصحّح: الطاقم معفى بحكم الدور؛ المصحّح يُقاس على قراءاته (reading = 0) للمراسي؛ إخفاق بعد 5 مراسٍ يقفل 24 ساعة */
export async function calibrationState(db: any, actor: Actor): Promise<CalibrationState> {
  if (actor.kind === 'staff') return { n: 0, kappa: null, passed: true, need: 0, ar: 'الطاقم معفى بحكم الدور', exempt: true, locked_until: null, staff: true };
  const { data: row } = await db.from('miaar_rater_calibration').select('*').eq('rater_id', actor.id).maybeSingle();
  if (row?.exempt_by) return { n: row.n || 0, kappa: row.kappa, passed: true, need: 0, ar: `معفى من التأهيل${row.exempt_note_ar ? ` — ${row.exempt_note_ar}` : ''}`, exempt: true, locked_until: null, staff: false };
  if (row?.passed_at) return { n: row.n || 0, kappa: row.kappa, passed: true, need: 0, ar: `معتمد — كابا ${row.kappa} على ${row.n} مراسٍ`, exempt: false, locked_until: null, staff: false };
  const { data: mine } = await db.from('miaar_performance_ratings').select('performance_id, band, created_at').eq('rater_id', actor.id).eq('reading', 0).order('created_at', { ascending: false }).limit(8);
  const ids = ((mine || []) as any[]).map((r) => r.performance_id); const anchors = new Map<string, number>();
  if (ids.length) { const { data: an } = await db.from('miaar_performances').select('id, anchor_band').in('id', ids); for (const a of (an || []) as any[]) if (a.anchor_band != null) anchors.set(a.id, Number(a.anchor_band)); }
  const pairs = ((mine || []) as any[]).filter((r) => anchors.has(r.performance_id)).map((r) => ({ mine: Number(r.band), anchor: anchors.get(r.performance_id) as number }));
  const c = calibrationOf(pairs); const now = nowIso(); let locked: string | null = row?.locked_until && row.locked_until > now ? row.locked_until : null;
  if (c.passed) await db.from('miaar_rater_calibration').upsert({ rater_id: actor.id, kappa: c.kappa, n: c.n, passed_at: now, locked_until: null, attempts: (row?.attempts || 0) + 1, updated_at: now }, { onConflict: 'rater_id' });
  else if (c.n >= RATER_POLICY.anchors_min && !locked) { locked = new Date(Date.now() + RATER_POLICY.lock_hours * 3600_000).toISOString(); await db.from('miaar_rater_calibration').upsert({ rater_id: actor.id, kappa: c.kappa, n: c.n, locked_until: locked, attempts: (row?.attempts || 0) + 1, updated_at: now }, { onConflict: 'rater_id' }); }
  return { ...c, exempt: false, locked_until: locked, staff: false };
}
/** إعفاء مقيَّد (مدير النظام/الجودة) لمصحّح بريده معروف — يُسجَّل من أعفاه ولماذا */
export async function exemptRater(db: any, email: string, note: string, by: Actor): Promise<{ ok: true } | { ok: false; error: string }> {
  const em = String(email || '').trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return { ok: false, error: 'بريد غير صالح' };
  const { data: g } = await db.from('portal_role_grants').select('user_id').ilike('email', em).eq('role_code', 'RATER').is('revoked_at', null).limit(1);
  const uid = ((g || []) as any[])[0]?.user_id; if (!uid) return { ok: false, error: 'لا منحة «مصحّح» فعّالة لهذا البريد أو لم يدخل صاحبها بعد' };
  const up = await db.from('miaar_rater_calibration').upsert({ rater_id: uid, exempt_by: by.id, exempt_note_ar: String(note || '').trim().slice(0, 200) || null, updated_at: nowIso() }, { onConflict: 'rater_id' });
  return up.error ? { ok: false, error: 'تعذّر الحفظ' } : { ok: true };
}

/* ---------- الطابور ---------- */
/** الطابور: الأحدث أولًا؛ بلا بريد ولا اسم؛ المستوى الاستقبالي من تقرير الجلسة · المصحّح غير المعتمد يرى المراسي فقط (تأهيل) */
export async function ratingQueue(db: any, filter: QueueFilter, actor: Actor, limit = 100): Promise<{ rows: QueueRow[]; counts: Record<string, number>; calibration: CalibrationState; mirror: Mirror; policy: typeof RATER_POLICY }> {
  await purgeExpiredMedia(db, 50).catch(() => null);  /* تنفيذ الوعد كسولًا — بلا كرون */
  const cal = await calibrationState(db, actor);
  let q = db.from('miaar_performances').select(PERF_COLS).order('created_at', { ascending: false }).limit(limit);
  if (!cal.passed) q = q.eq('is_anchor', true);
  else if (filter === 'pending') q = q.in('status', ['submitted', 'ai_rated', 'rated']); else if (filter === 'second') q = q.eq('second_reading', true).eq('status', 'rated'); else if (filter === 'adjudicate') q = q.eq('adjudication', 'needed'); else if (filter === 'released') q = q.eq('status', 'released'); else if (filter === 'anchors') q = q.eq('is_anchor', true);
  const { data } = await q; let rows = ((data || []) as any[]).filter((r) => r.status !== 'skipped');
  const reads = await readingsFor(db, rows.map((r) => r.id)); const byPerf = new Map<string, Reading[]>(); for (const r of reads) { const a = byPerf.get(r.performance_id) || []; a.push(r); byPerf.set(r.performance_id, a); }
  const info = (r: any) => { const rs = byPerf.get(r.id) || []; const mine = rs.find((x) => x.rater_id === actor.id); return { readings: rs.filter((x) => x.reading >= 1).length, my_reading: mine ? mine.reading : null }; };
  if (!cal.passed) rows = rows.filter((r) => info(r).my_reading == null);  /* مراسٍ لم يقرأها بعد */
  else if (actor.kind === 'rater' && filter === 'pending') rows = rows.filter((r) => { const i = info(r); return i.my_reading == null && r.adjudication !== 'needed' && !(r.status === 'rated' && !r.second_reading) && !(r.status === 'rated' && r.second_reading && i.readings >= 2); });
  else if (filter === 'second') rows = rows.filter((r) => info(r).readings === 1 && r.adjudication !== 'needed');
  const ids = [...new Set(rows.map((r) => r.session_id))]; const lv = new Map<string, string | null>();
  if (ids.length) { const { data: ss } = await db.from('placement_secure_sessions').select('id, report').in('id', ids); for (const s of (ss || []) as any[]) lv.set(s.id, s.report?.ملخص_التسكين?.المستوى_المثبت || s.report?.المستوى_العام || null); }
  const { data: allRows } = await db.from('miaar_performances').select('status, second_reading, adjudication, is_anchor').limit(5000); const counts: Record<string, number> = { second_pending: 0, adjudication_needed: 0, anchors: 0 };
  for (const r of (allRows || []) as any[]) { counts[r.status] = (counts[r.status] || 0) + 1; if (r.adjudication === 'needed') counts.adjudication_needed += 1; if (r.is_anchor) counts.anchors += 1; }
  if (counts.rated) { const { data: sec } = await db.from('miaar_performances').select('id').eq('second_reading', true).eq('status', 'rated').is('adjudication', null).limit(500); const sids = ((sec || []) as any[]).map((r) => r.id); const sr = await readingsFor(db, sids); const c = new Map<string, number>(); for (const r of sr) if (r.reading >= 1) c.set(r.performance_id, (c.get(r.performance_id) || 0) + 1); counts.second_pending = sids.filter((id) => (c.get(id) || 0) < 2).length; }
  const { data: myReads } = await db.from('miaar_performance_ratings').select('performance_id').eq('rater_id', actor.id).gte('reading', 1).limit(1000);
  const myIds = [...new Set(((myReads || []) as any[]).map((r) => String(r.performance_id)))]; const mirror = raterMirror(await readingsFor(db, myIds), actor.id);
  return { rows: rows.map((r) => { const i = info(r); return { id: r.id, skill: r.skill, status: r.status, item_code: r.item_code, level_target: r.level_target, word_count: r.word_count, duration_sec: r.duration_sec, accommodation: r.accommodation, ai_consent: !!r.ai_consent, has_ai: !!r.ai_rating, created_at: r.created_at, rated_at: r.rated_at, released_at: r.released_at, session_short: String(r.session_id).slice(0, 8), receptive_level: lv.get(r.session_id) ?? null,
    second_reading: !!r.second_reading, adjudication: r.adjudication || null, is_anchor: !!r.is_anchor, readings: i.readings, my_reading: i.my_reading, has_transcript: !!r.transcript, media_purged: !!r.media_purged_at }; }), counts, calibration: cal, mirror, policy: RATER_POLICY };
}

/* ---------- التفصيل ---------- */
type NextReading = { reading: 0 | 1 | 2 | 3; ar: string } | { reading: null; why_ar: string };
/** أيّ قراءة يستطيع هذا الفاعل إضافتها الآن؟ */
export function nextReadingFor(p: { status: string; second_reading: boolean; adjudication: string | null; is_anchor: boolean }, readings: readonly Reading[], actor: Actor, cal: { passed: boolean; locked_until: string | null }): NextReading {
  if (p.status === 'skipped') return { reading: null, why_ar: 'هذا الأداء لم يُقدَّم' };
  const real = readings.filter((r) => r.reading >= 1); const mine = readings.find((r) => r.rater_id === actor.id);
  if (!cal.passed) { if (!p.is_anchor) return { reading: null, why_ar: 'أكمل تأهيلك على المراسي أولًا' }; if (mine) return { reading: null, why_ar: 'قرأتَ هذه المرساة' }; if (cal.locked_until) return { reading: null, why_ar: 'التأهيل مقفل 24 ساعة بعد محاولة لم تبلغ الحدّ' }; return { reading: 0, ar: 'قراءة تأهيل (مرساة)' }; }
  if (mine && mine.reading >= 1) {
    /* يجوز تعديل قراءتي ما لم يُصدَر الأداء ولم يقرأه بعدي غيري (الحفظ ثم الإصدار من م4-ب) */
    const later = readings.some((r) => r.rater_id !== actor.id && r.reading > mine.reading);
    if (p.status !== 'released' && !later) return { reading: mine.reading as 1 | 2 | 3, ar: mine.reading === 1 ? 'القراءة الأولى (تعديل قراءتي)' : mine.reading === 2 ? 'القراءة الثانية (تعديل قراءتي)' : 'قراءة التحكيم (تعديل)' };
    return { reading: null, why_ar: 'قرأتَ هذا الأداء — لا يقرأ المصحّح الأداء نفسه مرّتين' };
  }
  if (p.adjudication === 'needed') return actor.kind === 'staff' ? { reading: 3, ar: 'قراءة التحكيم (الثالثة)' } : { reading: null, why_ar: 'بانتظار محكِّم (مدير الجودة/مدير النظام)' };
  if (p.status === 'released') return { reading: null, why_ar: 'صادر — اسحب الإصدار أولًا إن لزم' };
  if (real.length === 0) return { reading: 1, ar: 'القراءة الأولى' };
  if (real.length === 1) return p.second_reading || actor.kind === 'staff' ? { reading: 2, ar: p.second_reading ? 'القراءة الثانية (عمياء)' : 'قراءة ثانية اختيارية (عمياء)' } : { reading: null, why_ar: 'لم يُسحب للقراءة الثانية' };
  return { reading: null, why_ar: 'اكتملت قراءتاه' };
}
/** هل يجوز الإصدار الآن؟ (الطاقم يستطيع «الإصدار رغم ذلك» ويُقيَّد) */
export function releaseGate(p: { status: string; second_reading: boolean; adjudication: string | null }, readingsCount: number): { ok: boolean; why_ar: string | null } {
  if (p.adjudication === 'needed') return { ok: false, why_ar: 'يحتاج تحكيمًا — قراءة ثالثة من مدير الجودة أو مدير النظام' };
  if (p.second_reading && readingsCount < 2 && p.adjudication !== 'done') return { ok: false, why_ar: 'سُحب للقراءة الثانية — ينتظر مصحّحًا آخر' };
  return { ok: true, why_ar: null };
}

/** تفصيل أداء واحد للمصحّح: النص أو رابط صوت موقَّع قصير العمر · المهمة (مع الإجابة النموذجية للمصحّح) · سُلّم التقدير · القراءات (عمياء لمن لم يقرأ بعد) */
export async function performanceDetail(db: any, id: string, actor: Actor): Promise<Record<string, unknown> | null> {
  const { data: p } = await db.from('miaar_performances').select('*').eq('id', id).maybeSingle(); if (!p) return null;
  const { data: items } = await db.from('question_bank_items').select('item_code, level, skill, question_text, task, media_path, media_alt, descriptor_code').eq('item_code', p.item_code).limit(1);
  const item = ((items || []) as any[])[0] || null;
  let audio_url: string | null = null;
  if (p.media_path && !p.media_purged_at) { try { const r = await db.storage.from(MEDIA_BUCKET).createSignedUrl(p.media_path, SIGN_SECONDS); audio_url = r.error ? null : (r.data?.signedUrl ?? null); } catch { audio_url = null; } }
  const { data: bands } = await db.from('miaar_rubric_bands').select('dimension, score, dimension_ar, text_ar').eq('skill', p.skill).order('sort');
  const { data: s } = await db.from('placement_secure_sessions').select('report').eq('id', p.session_id).maybeSingle();
  const receptive = s?.report?.ملخص_التسكين?.المستوى_المثبت || s?.report?.المستوى_العام || null;
  const reads = await readingsFor(db, [id]); const cal = await calibrationState(db, actor); const mine = reads.find((r) => r.rater_id === actor.id) || null;
  const next = nextReadingFor(p, reads, actor, cal); const gate = releaseGate(p, reads.filter((r) => r.reading >= 1).length);
  /* التعمية: من لم يقرأ بعد (وليس من الطاقم المحكِّم) لا يرى تقدير غيره ولا الدرجة المعتمدة ولا درجة المرساة */
  const blind = (!mine && reads.some((r) => r.reading >= 1) && (actor.kind === 'rater' || next.reading === 2)) || (!cal.passed && p.is_anchor && !mine);
  const { candidate_email: _e, user_id: _u, media_path: _m, ...safe } = p; void _e; void _u; void _m;  /* لا بريد ولا معرّف مستخدم ولا مسار خام للمصحّح */
  const readings = blind ? [] : reads.filter((r) => r.reading >= 1).map((r) => ({ reading: r.reading, band: r.band, mean: r.mean ?? null, scores: r.scores, note_ar: (r as any).note_ar ?? null, mine: r.rater_id === actor.id, rater: r.rater_id === actor.id ? 'أنت' : maskRater(r.rater_id), created_at: r.created_at }));
  return { ...safe, human_rating: blind ? null : p.human_rating, rater_note_ar: blind ? null : p.rater_note_ar, anchor_band: blind ? null : p.anchor_band, blind, audio_url, task: item ? { prompt: item.question_text, level: item.level, task: item.task, media: item.media_path, descriptor: item.descriptor_code } : null,
    dimensions: RUBRIC_DIMENSIONS[p.skill as ProductiveSkill].map((d) => ({ key: d, ar: DIMENSION_AR[d] || d })), bands: bands || [], receptive_level: receptive,
    readings, my_reading: mine ? { reading: mine.reading, band: mine.band, scores: mine.scores, note_ar: (mine as any).note_ar ?? null } : null, next, can_release: gate.ok, release_block_ar: gate.why_ar, fluency: fluencyOf(p.transcript, p.duration_sec), actor_kind: actor.kind, calibration: cal };
}

/* ---------- القراءة والإصدار ---------- */
/** حجم هيئة القرّاء: من قرأ فعلًا + من يحمل منحة «مصحّح» فعّالة + الفاعل الحالي */
export async function readerPoolSize(db: any, actorId: string): Promise<number> {
  const pool = new Set<string>([actorId]);
  const { data: rs } = await db.from('miaar_performance_ratings').select('rater_id').gte('reading', 1).limit(2000); for (const r of (rs || []) as any[]) pool.add(String(r.rater_id));
  const { data: gs } = await db.from('portal_role_grants').select('user_id, email').eq('role_code', 'RATER').is('revoked_at', null).limit(200); for (const g of (gs || []) as any[]) pool.add(String(g.user_id || g.email));
  return pool.size;
}
export type RateBody = { scores: unknown; note: unknown; release: boolean; seconds?: unknown; force?: boolean };
export type RateResult = { ok: true; status: string; reading: number; rating: ReturnType<typeof humanRatingFrom>; agreement?: { kind: string; gap: number; kind_ar: string } | null; blocked_ar?: string | null; calibration?: CalibrationState } | { ok: false; error: string };
/** قراءة (أولى/ثانية/تحكيم/تأهيل) ثم إصدار إن جاز — الإصدار يُظهر «معتمد» في البطاقة فورًا */
export async function ratePerformance(db: any, id: string, body: RateBody, actor: Actor): Promise<RateResult> {
  const { data: p } = await db.from('miaar_performances').select('id, session_id, skill, level_target, status, second_reading, adjudication, is_anchor, anchor_band, human_rating').eq('id', id).maybeSingle(); if (!p) return { ok: false, error: 'الأداء غير موجود' };
  const rating = humanRatingFrom(p.skill, p.level_target, body.scores, body.note); if (!rating) return { ok: false, error: 'الدرجات ناقصة أو خارج السُّلّم (0–5 لكل بُعد)' };
  const reads = await readingsFor(db, [id]); const cal = await calibrationState(db, actor); const next = nextReadingFor(p, reads, actor, cal);
  if (next.reading == null) return { ok: false, error: next.why_ar };
  const band = bandOf(rating.scores); const seconds = Number(body.seconds) > 0 ? Math.min(7200, Math.round(Number(body.seconds))) : null;
  const row = { performance_id: id, rater_id: actor.id, reading: next.reading, scores: rating.scores, band, mean: rating.mean, estimated: rating.estimated, verdict_ar: rating.verdict_ar, note_ar: rating.note_ar, seconds, created_at: nowIso() };
  const ins = await db.from('miaar_performance_ratings').upsert(row, { onConflict: 'performance_id,rater_id' }); if (ins.error) return { ok: false, error: 'تعذّر حفظ القراءة' };
  if (next.reading === 0) { const c = await calibrationState(db, actor); return { ok: true, status: p.status, reading: 0, rating, calibration: c }; }
  const patch: Record<string, unknown> = { updated_at: nowIso() }; let agreement: { kind: string; gap: number; kind_ar: string } | null = null;
  if (next.reading === 1) {
    const { count } = await db.from('miaar_performances').select('id', { count: 'exact', head: true }).eq('skill', p.skill).in('status', ['rated', 'released']);
    /* القراءة الثانية تُسحب حين يوجد قارئان على الأقل في الهيئة (وإلا تبقى اختيارية للطاقم) — حتى لا تتعطّل البطاقات بمصحّح وحيد */
    const second = (await readerPoolSize(db, actor.id)) >= 2 && needsSecondReading({ id, skill_read_count: Number(count) || 0, first_mean: rating.mean });
    Object.assign(patch, { human_rating: rating, rater_id: actor.id, rater_note_ar: rating.note_ar, rated_at: nowIso(), status: 'rated', second_reading: second });
  } else if (next.reading === 2) {
    const r1 = reads.find((r) => r.reading === 1) as Reading; const ag = agreementOf(r1, { ...row, scores: rating.scores } as Reading); agreement = { kind: ag.kind, gap: ag.gap, kind_ar: ag.kind_ar };
    const adopted = ag.kind === 'average' ? humanRatingFrom(p.skill, p.level_target, ag.scores, p.human_rating?.note_ar ?? null) : (p.human_rating || humanRatingFrom(p.skill, p.level_target, r1.scores, (r1 as any).note_ar ?? null));
    Object.assign(patch, { human_rating: { ...(adopted || rating), agreement: { kind: ag.kind, gap: ag.gap } }, second_reading: true, rated_at: nowIso(), status: 'rated', adjudication: ag.kind === 'adjudicate' ? 'needed' : null });
  } else {
    agreement = { kind: 'adjudicated', gap: 0, kind_ar: 'حُكم بقراءة ثالثة' };
    Object.assign(patch, { human_rating: { ...rating, agreement: { kind: 'adjudicated' } }, rater_id: actor.id, rater_note_ar: rating.note_ar, rated_at: nowIso(), status: 'rated', adjudication: 'done' });
  }
  const after = { status: 'rated', second_reading: !!(patch.second_reading ?? p.second_reading), adjudication: (patch.adjudication as string | null | undefined) === undefined ? p.adjudication : (patch.adjudication as string | null) };
  const gate = releaseGate(after, reads.filter((r) => r.reading >= 1 && r.rater_id !== actor.id).length + 1); let blocked_ar: string | null = null;
  if (body.release) { if (gate.ok || (body.force === true && actor.kind === 'staff')) { patch.status = 'released'; patch.released_at = nowIso(); if (!gate.ok) (patch.human_rating as any).forced_release = { by: actor.id, at: nowIso(), why_ar: gate.why_ar }; } else blocked_ar = gate.why_ar; }
  const up = await db.from('miaar_performances').update(patch).eq('id', id); if (up.error) return { ok: false, error: 'تعذّر الحفظ' };
  await refreshProductive(db, p.session_id);
  return { ok: true, status: String(patch.status), reading: next.reading, rating, agreement, blocked_ar };
}
/** إصدار أداء مقدَّر من قبل (بعد اكتمال القراءات) — بلا قراءة جديدة */
export async function releasePerformance(db: any, id: string, actor: Actor, force = false): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: p } = await db.from('miaar_performances').select('id, session_id, status, second_reading, adjudication, human_rating').eq('id', id).maybeSingle(); if (!p) return { ok: false, error: 'الأداء غير موجود' };
  if (p.status !== 'rated' || !p.human_rating) return { ok: false, error: 'لا تقدير مكتمل لإصداره' };
  const reads = await readingsFor(db, [id]); const gate = releaseGate(p, reads.filter((r) => r.reading >= 1).length);
  if (!gate.ok && !(force && actor.kind === 'staff')) return { ok: false, error: gate.why_ar || 'لا يجوز الإصدار الآن' };
  const hr = gate.ok ? p.human_rating : { ...p.human_rating, forced_release: { by: actor.id, at: nowIso(), why_ar: gate.why_ar } };
  const up = await db.from('miaar_performances').update({ status: 'released', released_at: nowIso(), human_rating: hr, updated_at: nowIso() }).eq('id', id); if (up.error) return { ok: false, error: 'تعذّر الحفظ' };
  await refreshProductive(db, p.session_id); return { ok: true };
}
/** سحب إصدار (خطأ بشري) — يعود «قيد التصحيح» في البطاقة */
export async function unreleasePerformance(db: any, id: string): Promise<boolean> {
  const { data: p } = await db.from('miaar_performances').select('id, session_id, status').eq('id', id).maybeSingle(); if (!p || p.status !== 'released') return false;
  const up = await db.from('miaar_performances').update({ status: 'rated', released_at: null, updated_at: nowIso() }).eq('id', id); if (up.error) return false;
  await refreshProductive(db, p.session_id); return true;
}
/** مرساة اعتماد: أداء صادر متّفق عليه؛ درجتها = الدرجة الكلّية المعتمدة */
export async function setAnchor(db: any, id: string, anchor: boolean): Promise<{ ok: true; band: number | null } | { ok: false; error: string }> {
  const { data: p } = await db.from('miaar_performances').select('id, status, human_rating').eq('id', id).maybeSingle(); if (!p) return { ok: false, error: 'الأداء غير موجود' };
  if (anchor && (p.status !== 'released' || !p.human_rating?.scores)) return { ok: false, error: 'المرساة تكون أداءً صادرًا بتقدير معتمد' };
  const band = anchor ? bandOf(p.human_rating.scores as RubricScores) : null;
  const up = await db.from('miaar_performances').update({ is_anchor: anchor, anchor_band: band, updated_at: nowIso() }).eq('id', id); return up.error ? { ok: false, error: 'تعذّر الحفظ' } : { ok: true, band };
}

/* ---------- اتفاق المصحّحين (للميزان) ---------- */
export async function agreementSummary(db: any): Promise<{ skills: ReturnType<typeof agreementReport>; raters: (Mirror & { rater: string; calibrated: boolean })[]; policy: typeof RATER_POLICY; readings: number }> {
  const { data: rs } = await db.from('miaar_performance_ratings').select('performance_id, rater_id, reading, scores, band, mean, seconds, created_at').gte('reading', 1).limit(5000); const reads = (rs || []) as Reading[];
  const ids = [...new Set(reads.map((r) => r.performance_id))]; const skillOf = new Map<string, ProductiveSkill>(); const adj: Record<ProductiveSkill, number> = { writing: 0, speaking: 0 };
  if (ids.length) { const { data: ps } = await db.from('miaar_performances').select('id, skill, adjudication').in('id', ids); for (const p of (ps || []) as any[]) { skillOf.set(p.id, p.skill); if (p.adjudication) adj[p.skill as ProductiveSkill] += 1; } }
  const skills = agreementReport(reads, (pid) => skillOf.get(pid) || null, adj).map((sk) => ({ ...sk, by_pair: sk.by_pair.map((p) => ({ ...p, a: maskRater(p.a), b: maskRater(p.b) })) }));
  const raterIds = [...new Set(reads.map((r) => r.rater_id))]; const { data: cals } = raterIds.length ? await db.from('miaar_rater_calibration').select('rater_id, passed_at, exempt_by').in('rater_id', raterIds) : { data: [] };
  const calSet = new Set(((cals || []) as any[]).filter((c) => c.passed_at || c.exempt_by).map((c) => c.rater_id));
  const raters = raterIds.map((rid) => ({ ...raterMirror(reads, rid), rater: maskRater(rid), calibrated: calSet.has(rid) })).sort((a, b) => b.n - a.n);
  return { skills, raters, policy: RATER_POLICY, readings: reads.length };
}

/* ---------- حذف الصوت بعد 180 يومًا ---------- */
export async function purgeExpiredMedia(db: any, limit = 50): Promise<{ purged: number }> {
  const { data } = await db.from('miaar_performances').select('id, media_path').not('media_path', 'is', null).lt('expires_at', nowIso()).limit(limit); const rows = (data || []) as { id: string; media_path: string }[];
  if (!rows.length) return { purged: 0 };
  try { await db.storage.from(MEDIA_BUCKET).remove(rows.map((r) => r.media_path)); } catch { /* نكمل: التصفير يمنع أي رابط جديد */ }
  let purged = 0; for (const r of rows) { const up = await db.from('miaar_performances').update({ media_path: null, media_purged_at: nowIso(), updated_at: nowIso() }).eq('id', r.id); if (!up.error) purged += 1; }
  return { purged };
}

/* ---------- نسخ النصوص ---------- */
export async function saveTranscript(db: any, id: string, text: unknown, fromDraft: boolean): Promise<{ ok: true; fluency: ReturnType<typeof fluencyOf> } | { ok: false; error: string }> {
  const t = typeof text === 'string' ? text.replace(/\r/g, '').trim().slice(0, 6000) : ''; if (t.length < 2) return { ok: false, error: 'النسخ فارغ' };
  const { data: p } = await db.from('miaar_performances').select('id, duration_sec, status').eq('id', id).maybeSingle(); if (!p) return { ok: false, error: 'الأداء غير موجود' };
  const up = await db.from('miaar_performances').update({ transcript: t, transcript_source: fromDraft ? 'ai_draft' : 'human', updated_at: nowIso() }).eq('id', id); if (up.error) return { ok: false, error: 'تعذّر الحفظ' };
  return { ok: true, fluency: fluencyOf(t, p.duration_sec) };
}
const TRANSCRIBE_SYSTEM = 'أنت ناسخ محترف لاختبار «مِعيار» للغة العربية. انسخ الكلام المسموع حرفيًّا بالعربية كما نُطق (بالتردّدات مثل «آآ» و«إمم» إن وُجدت)، بلا تصحيح ولا تلخيص ولا تعليق، ولا تذكر أي اسم أو بيانات شخصية إن سُمعت — استبدلها بـ[اسم]. أعد النصّ فقط.';
/** مسودّة نسخ من المزوّد (بموافقة المتقدّم فقط) — لا تُحفظ قبل مراجعة المصحّح */
export async function transcriptDraft(db: any, id: string, actor: Actor): Promise<{ ok: true; draft: string; source: 'ai' | 'local' } | { ok: false; error: string }> {
  const { data: p } = await db.from('miaar_performances').select('id, media_path, media_mime, ai_consent, media_purged_at, duration_sec').eq('id', id).maybeSingle(); if (!p) return { ok: false, error: 'الأداء غير موجود' };
  if (!p.ai_consent) return { ok: false, error: 'المتقدّم لم يوافق على مساعدة الذكاء الاصطناعي — انسخ يدويًا' };
  if (!p.media_path || p.media_purged_at) return { ok: false, error: 'لا تسجيل صوتي (حُذف بعد 180 يومًا أو لم يُرفع)' };
  const usage = await aiUsage(db, actor.id, 'miaar_transcribe'); if (!usage.allowed) return { ok: false, error: `بلغت حدّ ${usage.limit} مسودّة خلال 24 ساعة` };
  let b64 = '';
  try { const r = await db.storage.from(MEDIA_BUCKET).download(p.media_path); const blob = r?.data; if (!blob || r.error) return { ok: false, error: 'تعذّر قراءة التسجيل' }; b64 = Buffer.from(await blob.arrayBuffer()).toString('base64'); } catch { return { ok: false, error: 'تعذّر قراءة التسجيل' }; }
  const mime = String(p.media_mime || 'audio/webm').split(';')[0];
  const r = await runAi<string | null>({ system: TRANSCRIBE_SYSTEM, user: `تسجيل مدّته ${p.duration_sec || '?'} ثانية. انسخه.`, parse: (raw) => { const t = String(raw || '').trim(); return t.length >= 2 ? t.slice(0, 6000) : null; }, local: () => null, budgetMs: 40000, attachments: [{ mime, data_b64: b64, name: 'performance' }] });
  await logAi(db, { user_id: actor.id, email: actor.email, role: actor.role, purpose: 'miaar_transcribe', result: r, context: { performance: id, mime } });
  if (!r.data) return { ok: false, error: 'لم يُنتج المزوّد نسخة لهذه الصيغة — انسخ يدويًا أثناء الاستماع' };
  return { ok: true, draft: r.data, source: r.source };
}

/* ---------- «عيّنة المصحّح» ---------- */
const AI_SYSTEM = `أنت مصحّح مساعد لاختبار «مِعيار» للغة العربية وفق الإطار الأوروبي المرجعي (CEFR). تُقيِّم نصًّا كتبه متقدّم مجهول الهوية استجابةً لمهمة محدّدة المستوى.
قيِّم كل بُعد على سُلّم 0–5 (0 = لا إنتاج يُقيَّم، 3 = يحقّق متطلبات مستوى المهمة، 5 = يتجاوزها بوضوح). كن محافظًا؛ اقتبس شواهد قصيرة من النص نفسه؛ لا تخمّن هوية الكاتب ولا تذكر أي بيانات شخصية.
أعد JSON فقط: {"scores":{...},"evidence":["اقتباس قصير",…],"next_step_ar":"ما يرفع الكاتب درجة واحدة","confidence":0–1}.`;
/** «عيّنة المصحّح»: اقتراح أولي للنصوص (كتابة أو تحدّث مكتوب كتيسير أو منسوخ) بموافقة المتقدّم فقط — يُحفظ في ai_rating ولا يُنشر */
export async function aiSuggest(db: any, id: string, user: { id: string; email: string; role: string }): Promise<{ ok: true; rating: AiRating; source: 'ai' | 'local' } | { ok: false; error: string }> {
  const { data: p } = await db.from('miaar_performances').select('id, skill, level_target, text_answer, transcript, ai_consent, status, item_code').eq('id', id).maybeSingle(); if (!p) return { ok: false, error: 'الأداء غير موجود' };
  if (!p.ai_consent) return { ok: false, error: 'المتقدّم لم يوافق على مساعدة الذكاء الاصطناعي — قيّم يدويًا' };
  const text = p.text_answer || p.transcript; if (!text) return { ok: false, error: 'الاقتراح الآلي متاح للنصوص فقط (التسجيلات يسمعها الإنسان — أو انسخها أولًا)' };
  const usage = await aiUsage(db, user.id, 'miaar_rate'); if (!usage.allowed) return { ok: false, error: `بلغت حدّ ${usage.limit} اقتراحًا خلال 24 ساعة` };
  const { data: items } = await db.from('question_bank_items').select('question_text, task').eq('item_code', p.item_code).limit(1); const item = ((items || []) as any[])[0];
  const dims = RUBRIC_DIMENSIONS[p.skill as ProductiveSkill].map((d) => `"${d}"`).join(',');
  const userPrompt = `المهارة: ${p.skill} · مستوى المهمة: ${p.level_target}\nالمهمة: ${item?.question_text || '—'}${item?.task?.min_words ? ` (${item.task.min_words}–${item.task.max_words} كلمة)` : ''}\nالأبعاد المطلوبة في scores بالضبط: {${dims}}\n\nالنص${p.text_answer ? '' : ' (منسوخ من تسجيل)'}:\n"""\n${String(text).slice(0, 4000)}\n"""`;
  const r = await runAi<AiRating | null>({ system: AI_SYSTEM, user: userPrompt, parse: (raw) => parseAiRating(p.skill, p.level_target, raw), local: () => null, budgetMs: 25000, json: true });
  await logAi(db, { user_id: user.id, email: user.email, role: user.role, purpose: 'miaar_rate', result: r, context: { performance: id, skill: p.skill } });
  if (!r.data) return { ok: false, error: 'لم يُنتج الذكاء الاصطناعي تقديرًا صالحًا — قيّم يدويًا' };
  await db.from('miaar_performances').update({ ai_rating: { ...r.data, model: r.model, at: nowIso() }, status: p.status === 'submitted' ? 'ai_rated' : p.status, updated_at: nowIso() }).eq('id', id);
  return { ok: true, rating: r.data, source: r.source };
}
