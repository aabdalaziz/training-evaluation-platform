// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P70 «بكلماتي عبر المستوى» — النواة النقيّة (بلا قاعدة بيانات)
 *  الاسم الرسمي: صفحة المستوى — بكلمات المشارك / Level Page — In the Learner's Own Words
 *  بين مستوى ومستوى في الدبلوم يمرّ المشارك باختبار «عُبور» ثم يبدأ من جديد وكأن شيئًا لم يُكتب. هذه الصفحة تُغلق الفجوة:
 *  في الأسبوع الأخير من كل مستوى (نافذة «محطّة المستوى» P66-ب) يرى ما كتبه وقاله **هو** عبر المستوى:
 *   • سطور أيامه و«قبل أن تغادر» (P66/P66-ب) · سطور تطبيقه في موقعه · «التزامي حتى نلتقي» وهل أوفى به
 *   • نصّه الذي كتبه في اختبار نهاية المستوى (م6 «عُبور») وصوته الذي سجّله فيه — كلماته هو، لا إجابة مصحَّحة
 *   • «عبرتُ»: خطّ العبور بالكلمات لا الأرقام (دخلتُ بـ A2 وأعبره إلى B1) · «لماذا جئتُ» (P64) في المستوى الأول · كلمته من المستوى السابق
 *  ثم يكتب «سطر المستوى» (≤ 200) + صوت ≤ 30 ث يبقى معه، ويختم: رمز ATH-LV + بصمة SHA-256 على JCS. وكلمته تعبر معه إلى أول أسبوع في المستوى التالي.
 *  قواعد: لا درجة ولا نسبة · لا ذكاء اصطناعي · خاصّة افتراضيًا · الصوت لا يسافر · الإبطال فوري ومعلَن · الحذف فوري · لا أوقات مثبَّتة (النافذة من تقويم الشعبة)
 */
import { scrubPii, cleanText } from '../onair/registry';

export const P70_NAMES_AR = {
  title: 'بكلماتي عبر المستوى', sub: 'ما كتبتُه وقلتُه في هذا المستوى — لا ما كُتب عنّي', official_ar: 'صفحة المستوى — بكلمات المشارك', official_en: "Level Page — In the Learner's Own Words",
  words: 'بكلماتي', line: 'سطر المستوى', seal: 'أختم صفحة المستوى', crossed: 'عبرتُ', public_face: 'الوجه العام', echo: 'كلمتي من المستوى السابق', station: 'محطّة المستوى',
} as const;
export const LEVEL_PATH = '/me/level';
export const LEVEL_PUBLIC_PREFIX = '/lv';
/** openBeforeDays = أسبوع محطّة المستوى (D_LIMITS.levelLastWeekDays) · openAfterDays = الأسبوع الأول من المستوى التالي */
export const LEVEL_LIMITS = { lineMin: 10, lineMax: 200, voiceSec: 30, k: 5, openBeforeDays: 7, openAfterDays: 7, dayLinesMax: 40, applyMax: 20, commitsMax: 10, writingMax: 1500, transcriptMax: 1500 } as const;
export const LINE_PROMPT_AR = 'لو لخّصتُ هذا المستوى في سطر أحمله معي إلى المستوى التالي…';
export const LEVEL_FOOT_AR = 'لا تدخل هذه الصفحة في أي تقييم أو درجة أو قرار عبور. لا يكتبها ذكاء اصطناعي. خاصّة حتى تختمها وتختار وجهها العام بنفسك — وتُبطلها متى شئت.';
export const CODE_RE = /^ATH-LV-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

export type CardKey = 'prev_line' | 'entry_line' /* P71 */ | 'first_why' | 'day_lines' | 'apply_lines' | 'commits' | 'carried' | 'hour_line' /* P73 */ | 'exam_writing' | 'exam_speaking' | 'crossed';
export const CARD_KEYS: CardKey[] = ['prev_line', 'entry_line', 'first_why', 'day_lines', 'apply_lines', 'commits', 'carried', 'hour_line', 'exam_writing', 'exam_speaking', 'crossed'];
export const CARD_AR: Record<CardKey, string> = {
  prev_line: 'كلمتي من المستوى السابق', entry_line: 'قلتُه يوم دخلتُ — قبل أن أعرف نتيجتي' /* P71 */, first_why: 'ما كتبتُه أول يوم — «لماذا جئتُ»', day_lines: 'سطور أيامي', apply_lines: 'في موقعي — سطور التطبيق',
  commits: 'التزمتُ… وأوفيتُ؟', carried: 'ما حملتُه من غيري — في ساعة أَثَر' /* P73 */, hour_line: 'سطر ساعتنا — ما اقترحتُه وما اختارته الشعبة' /* P73 */, exam_writing: 'ما كتبتُه في اختبار نهاية المستوى', exam_speaking: 'ما قلتُه في اختبار نهاية المستوى', crossed: 'عبرتُ',
};
/** ما يجوز أن يظهر على الوجه العام — الصوت لا يظهر أبدًا، ونصّ الاختبار لا يظهر (كلماته في موقف اختبار تبقى له) */
export type PublicKey = 'line' | 'counts' | 'name' | 'crossed' | 'prev_line' | 'commits' | 'day_lines';
export const PUBLIC_KEYS: PublicKey[] = ['line', 'counts', 'name', 'crossed', 'prev_line', 'commits', 'day_lines'];
export const PUBLIC_DEFAULT: PublicKey[] = ['line', 'counts'];
export const PUBLIC_AR: Record<PublicKey, string> = {
  line: 'سطر المستوى', counts: 'الأعداد (بلا تفاصيل)', name: 'اسمي', crossed: '«عبرتُ» (بالمستويات لا الأرقام)', prev_line: 'كلمتي من المستوى السابق', commits: 'التزاماتي وما أوفيتُ به', day_lines: 'سطور أيامي',
};

export type Card = { key: CardKey; title_ar: string; text_ar: string | null; at: string | null; items?: { text_ar: string; at: string; state_ar?: string | null }[]; href?: string | null; voice_sec?: number | null; state_ar?: string | null; public_ok?: boolean /* P75: entry_line فقط — إذن الظهور على الرئيسة */ };
export type Counts = { day_lines: number; apply_lines: number; commits: number; commits_done: number; training_days: number; apply_weeks: number };

/* ───────── النافذة والمرحلة ───────── */
const DAY = 86400000;
export const addDaysKey = (day: string, n: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.max(1, Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY) + 1);
export type LevelPhase = 'before' | 'open' | 'after';
export type LevelWindow = { from_day: string; to_day: string; open_from: string; open_to: string };
/** نافذة المستوى من تقويم الشعبة: الصفحة تُفتح أول يوم من الأسبوع الأخير (محطّة المستوى) وتبقى للكتابة حتى نهاية الأسبوع الأول من المستوى التالي */
export function levelWindow(fromDay: string, toDay: string): LevelWindow {
  const span = daysBetween(fromDay, toDay);
  const open_from = span <= LEVEL_LIMITS.openBeforeDays ? fromDay : addDaysKey(toDay, -(LEVEL_LIMITS.openBeforeDays - 1));
  return { from_day: fromDay, to_day: toDay, open_from, open_to: addDaysKey(toDay, LEVEL_LIMITS.openAfterDays) };
}
export function levelPhase(w: LevelWindow, today: string): LevelPhase { return today < w.open_from ? 'before' : today <= w.open_to ? 'open' : 'after'; }
/** هل اليوم داخل الأسبوع الأول من المستوى التالي؟ (هنا تظهر «الكلمة التي تعبر») */
export const isEchoWeek = (nextFromDay: string, today: string) => today >= nextFromDay && today < addDaysKey(nextFromDay, LEVEL_LIMITS.openAfterDays);
export const inDays = (day: string | null | undefined, w: { from_day: string; to_day: string }) => !!day && day >= w.from_day && day <= w.to_day;

/* ───────── سطر المستوى ───────── */
export function validateLine(s: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const t = scrubPii(cleanText(s, LEVEL_LIMITS.lineMax)); if (/\[بريد\]|\[رقم\]/.test(t)) return { ok: false, error: 'سطر المستوى بلا بريد ولا أرقام هواتف' };
  if (t.length < LEVEL_LIMITS.lineMin) return { ok: false, error: `اكتب من ${LEVEL_LIMITS.lineMin} أحرف على الأقل — سطر واحد تحمله معك` };
  return { ok: true, text: t };
}
export function normalizeKeep(v: unknown): Record<CardKey, boolean> {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>; const out = {} as Record<CardKey, boolean>;
  for (const k of CARD_KEYS) out[k] = o[k] !== false; return out;
}
export function normalizePublic(v: unknown): PublicKey[] { const a = Array.isArray(v) ? v : PUBLIC_DEFAULT; return PUBLIC_KEYS.filter((k) => a.includes(k)); }

/* ───────── «عبرتُ» — بالكلمات لا الأرقام ───────── */
export type ExamSource = {
  level: string; outcome: 'passed' | 'conditional' | 'failed' | 'pending' | string; retake_skill_ar: string | null; from_level: string | null; at: string;
  writing: { text: string | null; words: number | null; at: string } | null;
  speaking: { sec: number | null; has_media: boolean; purged: boolean; transcript: string | null; at: string } | null;
};
export function crossedText(x: Pick<ExamSource, 'level' | 'outcome' | 'retake_skill_ar' | 'from_level'>): { text_ar: string; state_ar: string } {
  const from = x.from_level ? `دخلتُ هذا المستوى بـ ${x.from_level} — ` : '';
  if (x.outcome === 'passed') return { text_ar: `${from}وأعبره اليوم إلى ما بعد ${x.level}.`, state_ar: 'عبرتُ' };
  if (x.outcome === 'conditional') return { text_ar: `${from}وأقف على عتبة ${x.level}${x.retake_skill_ar ? ` — ولي إعادة في ${x.retake_skill_ar}` : ''}.`, state_ar: 'على العتبة' };
  if (x.outcome === 'failed') return { text_ar: `${from}ولم أعبر ${x.level} بعدُ — والطريق مفتوح.`, state_ar: 'لم أعبر بعدُ' };
  return { text_ar: `${from}وأنتظر قراءة ما كتبتُه وقلتُه في ${x.level}.`, state_ar: 'بانتظار القراءة' };
}

/* ───────── البطاقات من المصادر (كلماته هو فقط) ───────── */
export type Done = 'yes' | 'part' | 'no';
export const DONE_STATE_AR: Record<Done | 'none', string> = { yes: 'أوفيتُ ✓', part: 'أوفيتُ جزئيًا', no: 'لم أُوفِ بعدُ', none: 'لم أُجب بعدُ' };
export type LineSrc = { kind: 'learn' | 'apply' | 'commit' | 'carry' | 'hour_line'; day: string; body_ar: string; blocker_ar: string | null; done: Done | null; done_note_ar: string | null; unit_id: string | null; week_no: number | null; chosen?: boolean /* P73: اختارته الشعبة سطرَ ساعتها */ };
export type Sources = {
  lines: LineSrc[];
  prev_line: { line_ar: string; level_no: number; sealed_at: string } | null;
  first_why: { id: number; body_ar: string | null; at: string; state: 'sealed' | 'today' | 'ready' | 'opened'; opens_ar: string } | null;
  entry_line?: { text: string | null; lang: string; voice_sec: number | null; at: string; public_ok?: boolean } | null; /* P71: المستوى الأول فقط — بلغته كما كتبه */
  exam: ExamSource | null;
  training_days: number;
};
export function buildCards(src: Sources, w: { from_day: string; to_day: string }): { cards: Card[]; counts: Counts } {
  const inW = src.lines.filter((l) => inDays(l.day, w)).sort((a, b) => a.day.localeCompare(b.day));
  const learn = inW.filter((l) => l.kind === 'learn' && l.body_ar.trim()); const apply = inW.filter((l) => l.kind === 'apply' && l.body_ar.trim()); const commits = inW.filter((l) => l.kind === 'commit' && l.body_ar.trim());
  const cards: Card[] = [];
  if (src.prev_line) cards.push({ key: 'prev_line', title_ar: CARD_AR.prev_line, text_ar: src.prev_line.line_ar, at: src.prev_line.sealed_at, state_ar: `المستوى ${src.prev_line.level_no}` });
  if (src.entry_line && (src.entry_line.text || src.entry_line.voice_sec)) cards.push({ key: 'entry_line', title_ar: CARD_AR.entry_line, text_ar: src.entry_line.text, at: src.entry_line.at, voice_sec: src.entry_line.voice_sec, public_ok: src.entry_line.public_ok === true, state_ar: src.entry_line.text ? null : 'بصوتك — تسمعه في «أول يوم»' });
  if (src.first_why) cards.push({ key: 'first_why', title_ar: CARD_AR.first_why, text_ar: src.first_why.state === 'opened' ? src.first_why.body_ar : null, at: src.first_why.at, href: `/me/letter#letter-${src.first_why.id}`, state_ar: src.first_why.state === 'opened' ? null : `مختومة — تُفتح لك يوم تخرّجك (${src.first_why.opens_ar})` });
  if (learn.length) cards.push({ key: 'day_lines', title_ar: CARD_AR.day_lines, text_ar: null, at: learn[0].day, items: learn.slice(-LEVEL_LIMITS.dayLinesMax).map((l) => ({ text_ar: l.body_ar, at: l.day, state_ar: l.unit_id ? 'قبل أن أغادر' : null })) });
  if (apply.length) cards.push({ key: 'apply_lines', title_ar: CARD_AR.apply_lines, text_ar: null, at: apply[0].day, items: apply.slice(-LEVEL_LIMITS.applyMax).map((l) => ({ text_ar: l.blocker_ar ? `${l.body_ar} — وما عاقني: ${l.blocker_ar}` : l.body_ar, at: l.day, state_ar: l.week_no ? `الأسبوع ${l.week_no}` : null })) });
  const carried = inW.filter((l) => l.kind === 'carry' && l.body_ar.trim()); const hourLines = inW.filter((l) => l.kind === 'hour_line' && l.body_ar.trim()); /* P73 */
  if (carried.length) cards.push({ key: 'carried', title_ar: CARD_AR.carried, text_ar: null, at: carried[0].day, items: carried.slice(-LEVEL_LIMITS.commitsMax).map((l) => ({ text_ar: l.body_ar, at: l.day, state_ar: 'سطر زميل — بلا اسم' })) });
  if (hourLines.length) cards.push({ key: 'hour_line', title_ar: CARD_AR.hour_line, text_ar: null, at: hourLines[0].day, items: hourLines.slice(-LEVEL_LIMITS.commitsMax).map((l) => ({ text_ar: l.body_ar, at: l.day, state_ar: l.chosen ? 'اختارته الشعبة سطرَ ساعتها' : null })) });
  if (commits.length) cards.push({ key: 'commits', title_ar: CARD_AR.commits, text_ar: null, at: commits[0].day, items: commits.slice(-LEVEL_LIMITS.commitsMax).map((l) => ({ text_ar: l.done && l.done_note_ar ? `${l.body_ar} — ${l.done_note_ar}` : l.body_ar, at: l.day, state_ar: DONE_STATE_AR[l.done || 'none'] })) });
  if (src.exam?.writing?.text) cards.push({ key: 'exam_writing', title_ar: CARD_AR.exam_writing, text_ar: src.exam.writing.text.slice(0, LEVEL_LIMITS.writingMax), at: src.exam.writing.at, state_ar: src.exam.writing.words ? `${src.exam.writing.words} كلمة — كما كتبتُها، بلا درجة` : 'كما كتبتُه، بلا درجة' });
  if (src.exam?.speaking) { const s = src.exam.speaking; cards.push({ key: 'exam_speaking', title_ar: CARD_AR.exam_speaking, text_ar: s.transcript ? s.transcript.slice(0, LEVEL_LIMITS.transcriptMax) : null, at: s.at, voice_sec: s.sec || null, state_ar: s.purged ? 'حُذف التسجيل وفق سياسة الصوت (180 يومًا)' : s.has_media ? `قلتُها في ${fmtSec(s.sec)} — لك وحدك، لا يدخل الختم إلا كمدّة` : 'لم يُسجَّل صوت' }); }
  if (src.exam) { const c = crossedText(src.exam); cards.push({ key: 'crossed', title_ar: CARD_AR.crossed, text_ar: c.text_ar, at: src.exam.at, state_ar: c.state_ar }); }
  const counts: Counts = { day_lines: learn.length, apply_lines: apply.length, commits: commits.length, commits_done: commits.filter((c) => c.done === 'yes').length, training_days: src.training_days, apply_weeks: new Set(apply.map((l) => l.week_no || l.day.slice(0, 7))).size };
  return { cards, counts };
}
export const fmtSec = (n: number | null | undefined) => { const s = Math.max(0, Math.round(Number(n || 0))); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/* ───────── الجسم المختوم والوجه العام ───────── */
export type LevelBody = { v: 'p70'; code: string; program: { id: string; name_ar: string; level_no: number; from: string; to: string; section_ar: string | null }; name: string; line_ar: string; cards: Card[]; counts: Counts; sealed_at: string };
export function levelBody(v: { code: string; program: LevelBody['program']; name: string; line_ar: string; cards: Card[]; keep: Record<CardKey, boolean>; counts: Counts; sealed_at: string }): LevelBody {
  /* الصوت لا يدخل الجسم إلا مدّةً · نصّ التحدّث المنسوخ يدخل إن أبقى البطاقة */
  const cards = v.cards.filter((c) => v.keep[c.key] !== false).map((c) => ({ ...c, href: undefined }));
  return { v: 'p70', code: v.code, program: v.program, name: v.name, line_ar: v.line_ar, cards, counts: v.counts, sealed_at: v.sealed_at };
}
export type PublicFace = { code: string; program_ar: string; level_no: number; from: string; to: string; sealed_at: string; name: string | null; line_ar: string | null; counts: Counts | null; cards: Card[]; revoked: boolean; intact: boolean };
export function publicFace(body: LevelBody, keys: PublicKey[], opts: { revoked?: boolean; intact?: boolean } = {}): PublicFace {
  const on = new Set(keys); const allowed = new Set<string>(['crossed', 'prev_line', 'commits', 'day_lines'].filter((k) => on.has(k as PublicKey)));
  return {
    code: body.code, program_ar: body.program.name_ar, level_no: body.program.level_no, from: body.program.from, to: body.program.to, sealed_at: body.sealed_at, name: on.has('name') ? body.name : null, line_ar: on.has('line') ? body.line_ar : null,
    counts: on.has('counts') ? body.counts : null, cards: body.cards.filter((c) => allowed.has(c.key)).map((c) => ({ ...c, voice_sec: undefined, href: null })), revoked: !!opts.revoked, intact: opts.intact !== false,
  };
}
/** سطر الشعبة — أعداد فقط عند k ≥ 5 (لا أسماء) */
export const sectionLineAr = (n: number, k = LEVEL_LIMITS.k) => (n >= k ? `${n} من شعبتك ختموا صفحة هذا المستوى` : null);
/** «الكلمة التي تعبر» — ما يراه صاحبها أول أسبوع في المستوى التالي */
export const echoIntroAr = (levelNo: number) => `قلتَ وأنت تعبر المستوى ${levelNo}:`;
export const fmtDayAr = (day: string) => { try { return new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`)); } catch { return day; } };
