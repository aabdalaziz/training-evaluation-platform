// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P73 «ساعة أَثَر» (الرسمي: لقاء التأمل الأسبوعي للشعبة) — المنطق النقي (بلا قاعدة بيانات)
 *  ساعة أسبوعية ثابتة لكل شعبة لا تعليم فيها ولا تصحيح: يجتمع المتدرّبون على سطور أسبوعهم →
 *  «أحمله معي» (سطر لغيري) → «دقيقة الصمت ثم كلمة واحدة» (سحابة حيّة) → «سطر ساعتنا» (اقتراح + تصويت بلمسة · التعادل للأقصر)
 *  → الأستاذ يختم (أعداد لا أسماء) → «الساعة في البيت» 24 ساعة لمن غاب.
 *  المبادئ: لا تقييم · لا أسماء · k ≥ 5 لكل ما يُعرض جماعيًّا · لا ذكاء اصطناعي · الأستاذ يفتح ويختم ولا يختار السطر.
 *  الأسماء: «ساعة أَثَر» اسم سردي؛ «لقاء التأمل الأسبوعي للشعبة» الاسم الرسمي في الجداول والتقارير (كما تعرفه أدبيات التدريب: Weekly reflection meeting).
 */
export const P73_NAMES_AR = { phase: 'ساعة أَثَر', official: 'لقاء التأمل الأسبوعي للشعبة', path: '/me/hour', session_title: 'ساعة أَثَر', pin: 'ثبّت ساعة أَثَر', seal: 'اختم الساعة', home: 'الساعة في البيت' } as const;
export const HOUR_LIMITS = { minutes: 60, openBeforeMin: 10, graceMin: 30, homeHours: 24, k: 5, wordMax: 24, lineMin: 5, lineMax: 120, showLines: 12, cloudMax: 30, maxWeeks: 20, weekLinesMax: 400, silenceSec: 60 } as const;
export const HOUR_KINDS = ['hour_word', 'hour_line', 'hour_vote', 'carry', 'hour_seal'] as const; export type HourKind = typeof HOUR_KINDS[number];
export const SESSION_KIND = 'athar_hour';
export const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] as const; /* JS getDay: 0 = الأحد */
export type HourPhase = 'none' | 'before' | 'open' | 'home' | 'closed';
export const PHASE_AR: Record<HourPhase, string> = { none: 'لم تُثبَّت بعد', before: 'قادمة', open: 'مفتوحة الآن', home: 'الساعة في البيت', closed: 'انتهت' };
export const RULES_AR = [
  'لا درجة ولا حضور ولا تقرير يخرج من هذه الساعة.',
  'لا أسماء: ما يُعرض جماعيًّا يظهر حين يكتب خمسة فأكثر.',
  '«أحمله معي» لا يكشف الحامل ولا المحمول عنه لأحد.',
  'الأستاذ يفتح الساعة ويختمها، ولا يختار السطر — الشعبة تختار بالتصويت، وعند التعادل يبقى الأقصر.',
  'من غاب يجد الساعة مفتوحة له في البيت 24 ساعة.',
] as const;

const TZ_MS = 3 * 3600 * 1000;
export const riyadhDay = (d: Date) => new Date(d.getTime() + TZ_MS).toISOString().slice(0, 10);
export const riyadhWeekday = (d: Date) => new Date(d.getTime() + TZ_MS).getUTCDay();
export const addDaysKey = (day: string, n: number) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const isDayKey = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const isTime = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
/** صيغة وقت الرياض كما يحفظها P66-ب: YYYY-MM-DDTHH:MM:00+03:00 */
export const riyadhStartIso = (day: string, time: string) => `${day}T${time}:00+03:00`;
export const fmtTimeAr = (iso: string) => { const d = new Date(new Date(iso).getTime() + TZ_MS); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
export const fmtDayAr = (day: string) => { const d = new Date(`${day}T00:00:00Z`); return `${WEEKDAYS_AR[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };

/* ───────── التثبيت: المواعيد الأسبوعية ───────── */
export type PinInput = { weekday?: unknown; time?: unknown };
export function validatePin(b: PinInput): { ok: true; weekday: number; time: string } | { ok: false; error: string } {
  const w = Number(b.weekday); if (!Number.isInteger(w) || w < 0 || w > 6) return { ok: false, error: 'اختر يوم الأسبوع' };
  if (!isTime(b.time)) return { ok: false, error: 'اختر وقت الساعة (مثل 10:30)' };
  return { ok: true, weekday: w, time: b.time };
}
/** أيام الحدوث الأسبوعية من اليوم (أو غدًا إن مضى وقت اليوم) حتى نهاية البرنامج — بحدّ maxWeeks */
export function occurrences(weekday: number, time: string, now: Date, endDay: string | null, maxWeeks = HOUR_LIMITS.maxWeeks): string[] {
  const today = riyadhDay(now); const nowMin = new Date(now.getTime() + TZ_MS).getUTCHours() * 60 + new Date(now.getTime() + TZ_MS).getUTCMinutes();
  const [hh, mm] = time.split(':').map(Number); const tMin = hh * 60 + mm;
  let d = today; for (let i = 0; i < 7; i += 1) { const wd = new Date(`${d}T00:00:00Z`).getUTCDay(); if (wd === weekday && !(d === today && tMin <= nowMin)) break; d = addDaysKey(d, 1); }
  const out: string[] = []; const until = endDay && isDayKey(endDay) ? endDay : addDaysKey(today, maxWeeks * 7);
  for (let i = 0; i < maxWeeks && d <= until; i += 1) { out.push(d); d = addDaysKey(d, 7); }
  return out;
}

/* ───────── الطور ───────── */
export type HourSession = { id: string; starts_at: string; duration_min: number; status: string; series_id: string | null; day: string };
export type PhaseInfo = { phase: HourPhase; session: HourSession | null; opens_at: string | null; ends_at: string | null; home_until: string | null; minutes_left: number | null; next: HourSession | null };
const ms = (iso: string) => Date.parse(iso);
/** اختيار الجلسة المعنيّة الآن: آخر جلسة ما زالت في نافذتها (مفتوحة أو في البيت) وإلا القادمة */
export function phaseOf(sessions: HourSession[], sealedIds: Set<string>, now: Date): PhaseInfo {
  const t = now.getTime(); const sorted = [...sessions].filter((s) => s.status !== 'cancelled').sort((a, b) => ms(a.starts_at) - ms(b.starts_at));
  const win = (s: HourSession) => { const st = ms(s.starts_at); return { t0: st - HOUR_LIMITS.openBeforeMin * 60000, t1: st + (s.duration_min + HOUR_LIMITS.graceMin) * 60000, t2: st + HOUR_LIMITS.homeHours * 3600000 }; };
  const live = sorted.filter((s) => { const w = win(s); return t >= w.t0 && t < w.t2; }).pop() || null;
  const next = sorted.find((s) => ms(s.starts_at) - HOUR_LIMITS.openBeforeMin * 60000 > t) || null;
  if (live) { const w = win(live); const sealed = sealedIds.has(live.id); const open = t < w.t1 && !sealed;
    return { phase: open ? 'open' : 'home', session: live, opens_at: new Date(w.t0).toISOString(), ends_at: new Date(w.t1).toISOString(), home_until: new Date(w.t2).toISOString(), minutes_left: open ? Math.max(0, Math.ceil((ms(live.starts_at) + live.duration_min * 60000 - t) / 60000)) : null, next: next && next.id !== live.id ? next : null }; }
  if (next) { const w = win(next); return { phase: 'before', session: next, opens_at: new Date(w.t0).toISOString(), ends_at: new Date(w.t1).toISOString(), home_until: null, minutes_left: null, next: null }; }
  const last = sorted[sorted.length - 1] || null; return { phase: last ? 'closed' : 'none', session: last, opens_at: null, ends_at: null, home_until: null, minutes_left: null, next: null };
}
export const canWrite = (p: HourPhase) => p === 'open' || p === 'home';

/* ───────── النصوص ───────── */
export const cleanText = (s: unknown) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const STRIP = /[\u064B-\u0652\u0670\u0640]/g; /* التشكيل والتطويل */
export function normWord(s: unknown): string { return cleanText(s).replace(STRIP, '').replace(/[.,،؛;:!؟?"'«»()\[\]{}\-_*#]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').toLowerCase(); }
export function validateWord(s: unknown): { ok: true; word: string } | { ok: false; error: string } {
  const w = cleanText(s).replace(/[.,،؛;:!؟?"'«»()\[\]{}*#]/g, ''); if (!w) return { ok: false, error: 'اكتب كلمة واحدة' };
  if (/\s/.test(w)) return { ok: false, error: 'كلمة واحدة فقط — بلا مسافات' }; if (w.length > HOUR_LIMITS.wordMax) return { ok: false, error: `الكلمة حتى ${HOUR_LIMITS.wordMax} حرفًا` };
  return { ok: true, word: w };
}
export function validateHourLine(s: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const t = cleanText(s); if (t.length < HOUR_LIMITS.lineMin) return { ok: false, error: `السطر من ${HOUR_LIMITS.lineMin} أحرف` }; if (t.length > HOUR_LIMITS.lineMax) return { ok: false, error: `السطر حتى ${HOUR_LIMITS.lineMax} حرفًا` }; return { ok: true, text: t };
}

/* ───────── التجميع (بلا أسماء · k ≥ 5) ───────── */
export function shuffleSeeded<T>(xs: T[], seed: string): T[] { let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } const out = [...xs]; for (let i = out.length - 1; i > 0; i -= 1) { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; const j = h % (i + 1); [out[i], out[j]] = [out[j], out[i]]; } return out; }
export type WeekRow = { id: number; user_id: string; kind: string; body_ar: string; day: string };
export type WeekLine = { id: number; text: string; kind: string; mine: boolean };
export type WeekView = { shown: boolean; people: number; lines: WeekLine[]; head_ar: string };
export const peopleOf = (rows: Array<{ user_id: string }>) => new Set(rows.map((r) => r.user_id)).size;
/** «ما كتبناه هذا الأسبوع»: سطور الشعبة مخلوطة ببذرة الجلسة — تظهر حين يبلغ الكاتبون k؛ سطور صاحب الصفحة تُعلَّم mine ولا تُحمَل */
export function weekViewOf(rows: WeekRow[], me: string, seed: string, k = HOUR_LIMITS.k, show = HOUR_LIMITS.showLines): WeekView {
  const people = peopleOf(rows); if (people < k) return { shown: false, people, lines: [], head_ar: people ? `كتب هذا الأسبوع ${people}؛ تظهر السطور حين يبلغون خمسة.` : 'لم يكتب أحد سطرًا هذا الأسبوع بعد.' };
  const seen = new Set<string>(); const uniq = rows.filter((r) => { const t = cleanText(r.body_ar); if (t.length < HOUR_LIMITS.lineMin || seen.has(t)) return false; seen.add(t); return true; });
  const lines = shuffleSeeded(uniq, seed).slice(0, show).map((r) => ({ id: r.id, text: cleanText(r.body_ar), kind: r.kind, mine: r.user_id === me }));
  return { shown: true, people, lines, head_ar: `كتب هذا الأسبوع ${people} — ${rows.length} ${rows.length === 1 ? 'سطر' : rows.length === 2 ? 'سطران' : rows.length <= 10 ? 'سطور' : 'سطرًا'}.` };
}
export type CloudItem = { word: string; n: number };
export type CloudView = { shown: boolean; people: number; items: CloudItem[]; head_ar: string };
/** سحابة الكلمات: الكلمة المكرّرة تكبر — التجميع بعد تطبيع خفيف (تشكيل · همزات · ى) ويُعرض أول شكل كُتبت به */
export function cloudOf(rows: Array<{ user_id: string; body_ar: string }>, k = HOUR_LIMITS.k, max = HOUR_LIMITS.cloudMax): CloudView {
  const people = peopleOf(rows); if (people < k) return { shown: false, people, items: [], head_ar: people ? `كتب كلمته ${people}؛ تظهر السحابة حين يبلغون خمسة.` : 'لم يكتب أحد كلمته بعد.' };
  const m = new Map<string, CloudItem>(); for (const r of rows) { const key = normWord(r.body_ar); if (!key) continue; const it = m.get(key); if (it) it.n += 1; else m.set(key, { word: cleanText(r.body_ar), n: 1 }); }
  const items = [...m.values()].sort((a, b) => b.n - a.n || a.word.localeCompare(b.word, 'ar')).slice(0, max);
  return { shown: true, people, items, head_ar: `كتب كلمته ${people} — ${items.length} ${items.length === 1 ? 'كلمة مختلفة' : 'كلمات مختلفة'}.` };
}
export type LineRow = { id: number; user_id: string; body_ar: string };
export type VoteRow = { user_id: string; for: number };
export type LinesView = { shown: boolean; people: number; lines: Array<{ id: number; text: string; votes: number; mine: boolean }>; my_vote: number | null; head_ar: string };
/** «سطر ساعتنا»: السطور المقترَحة مع أصواتها — بلا أسماء؛ لا صوت لسطري */
export function linesViewOf(lines: LineRow[], votes: VoteRow[], me: string, seed: string, k = HOUR_LIMITS.k): LinesView {
  const people = peopleOf(lines); const valid = validVotes(lines, votes); const my = valid.find((v) => v.user_id === me)?.for ?? null;
  if (people < k) return { shown: false, people, lines: [], my_vote: my, head_ar: people ? `اقترح سطرًا ${people}؛ يبدأ التصويت حين يبلغون خمسة.` : 'لم يقترح أحد سطرًا بعد.' };
  const count = new Map<number, number>(); for (const v of valid) count.set(v.for, (count.get(v.for) || 0) + 1);
  const out = shuffleSeeded(lines, seed).map((l) => ({ id: l.id, text: cleanText(l.body_ar), votes: count.get(l.id) || 0, mine: l.user_id === me }));
  return { shown: true, people, lines: out, my_vote: my, head_ar: `${people} اقترحوا — صوّت ${new Set(valid.map((v) => v.user_id)).size}.` };
}
/** صوت صالح = لسطر موجود وليس لسطر صاحبه */
export function validVotes(lines: LineRow[], votes: VoteRow[]): VoteRow[] { const by = new Map(lines.map((l) => [l.id, l.user_id])); return votes.filter((v) => by.has(v.for) && by.get(v.for) !== v.user_id); }
/** الاختيار: الأعلى أصواتًا؛ التعادل → الأقصر («في الأثر، القصير يبقى»)؛ بلا أصوات → الأقصر من كل المقترَح؛ بلا سطور → null */
export function pickLine(lines: LineRow[], votes: VoteRow[]): { id: number; text: string; votes: number } | null {
  if (!lines.length) return null; const valid = validVotes(lines, votes); const count = new Map<number, number>(); for (const v of valid) count.set(v.for, (count.get(v.for) || 0) + 1);
  const best = [...lines].map((l) => ({ id: l.id, text: cleanText(l.body_ar), votes: count.get(l.id) || 0 })).sort((a, b) => b.votes - a.votes || a.text.length - b.text.length || a.id - b.id)[0];
  return best;
}
export type SealMeta = { session_id: string; line_id: number | null; people: number; words: number; lines: number; carries: number; votes: number; cloud: CloudItem[]; sealed_at: string; home: number };
export const sealHeadAr = (m: Pick<SealMeta, 'people' | 'words' | 'lines' | 'carries'>) => `حضر الساعة ${m.people} · كلمات ${m.words} · سطور مقترَحة ${m.lines} · سطور محمولة ${m.carries}`;

/* ───────── الإشعارات (نصوص) ───────── */
export const carryNotice = (code: string) => ({ title_ar: 'حَمَل أحدُهم سطرك معه 🕰️', body_ar: `في ساعة أَثَر لشعبة ${code} اختار زميلٌ سطرَك ليحمله معه هذا الأسبوع — بلا اسم، كما تقضي قواعد الساعة. كلمتك سافرت.` });
export const pinNotice = (code: string, weekday: number, time: string) => ({ title_ar: `ساعة أَثَر لشعبة ${code} — كل ${WEEKDAYS_AR[weekday]} ${time}`, body_ar: 'ساعة أسبوعية بلا تعليم ولا تصحيح: نقرأ ما كتبناه، يحمل كلٌّ سطرًا لغيره، كلمة واحدة بعد دقيقة صمت، وسطر واحد نختمه معًا.' });
export const sealNotice = (code: string, line: string | null, day: string) => ({ title_ar: `سطر ساعتنا — شعبة ${code} · ${fmtDayAr(day)}`, body_ar: line ? `«${line}»` : 'خُتمت الساعة بلا سطر هذه المرّة — الأسبوع القادم سطرنا.' });
export const NOTICE_KINDS_P73 = ['hour_pinned', 'hour_carry', 'hour_sealed'] as const;
