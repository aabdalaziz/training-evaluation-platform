// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P66 «أيام التدريب وفترات التطبيق» — النواة النقيّة (بلا قاعدة بيانات)
 *  الاسم الرسمي: تقويم الشعبة وفترات التطبيق الميداني / Classroom training calendar & field-application periods
 *  الفكرة: لكل شعبة قائمة أيام التدريب الفعلية. منها وحدها تُشتقّ:
 *   • الكتل: أيام متتالية (تفصلها عطلة ≤ 2 يوم) = كتلة واحدة مرقّمة.
 *   • فترات التطبيق: فجوة ≥ 7 أيام بين كتلتين — «البرنامج معك في موقعك».
 *   • اليوم الأول = أول يوم في التقويم · يوم التخرّج = آخر يوم فيه.
 *  بلا تقويم: كل شيء يعمل كما كان (start_date → end_date متّصلة). صفر كسر.
 *  القواعد: سطر التطبيق أسبوعي لا يومي · «التزامي حتى نلتقي» يُفتح لصاحبه وحده أول يوم الكتلة التالية ·
 *           المدرّب يرى المجمَّع فقط (k ≥ 5، بلا أسماء) · لا درجة ولا تقييم · لا ذكاء اصطناعي.
 */

export const P66_NAMES_AR = {
  cal: 'تقويم الشعبة', official: 'تقويم الشعبة وفترات التطبيق الميداني', apply: 'البرنامج معك في موقعك',
  line: 'سطر اليوم', apply_line: 'سطر التطبيق', commit: 'التزامي حتى نلتقي', field: 'ما جرى في الميدان', block: 'كتلة', page: 'سطري',
} as const;
export const LINE_PATH = '/me/line';
export const FIELD_CASE_PATH = '/#daily';
export const CAL_LIMITS = { maxDays: 400, joinGap: 2, applyGap: 7, lineMin: 5, lineMax: 200, k: 5, show: 5, summaryBeforeDays: 3, commitTailDays: 1 } as const;
export const LINE_FOOT_AR = 'سطورك لا تدخل في أي درجة أو تقييم. مدرّبك يرى عدد من كتبوا وسطورًا مجمَّعة بلا أسماء حين تبلغون خمسة — لا أكثر.';

export type Block = { no: number; start: string; end: string; days: string[] };
export type ApplyPeriod = { no: number; from: string; to: string; after_block: number; next_block_start: string; weeks: number; days: number };
export type Calendar = { days: string[]; blocks: Block[]; applies: ApplyPeriod[]; first: string | null; last: string | null };
export type Phase = 'before' | 'training' | 'apply' | 'rest' | 'after' | 'none';
export type DayPhase = {
  phase: Phase; today: string;
  block?: { no: number; day_idx: number; len: number; is_first_day: boolean; is_last_day: boolean; is_program_first: boolean; is_program_last: boolean; next_block_start: string | null };
  apply?: { no: number; week_no: number; weeks: number; from: string; to: string; next_block_start: string; days_left: number; week_start: string };
  next?: { kind: 'block' | 'apply'; start: string; days: number } | null;
};

/* ───────── تواريخ ───────── */
const RIYADH = 'Asia/Riyadh';
export const dayKey = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: RIYADH, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const ms = (k: string) => Date.parse(`${k}T00:00:00Z`);
export const addDays = (k: string, n: number): string => new Date(ms(k) + n * 86400000).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string): number => Math.round((ms(b) - ms(a)) / 86400000);
export const isDayKey = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(ms(s)) && new Date(ms(s)).toISOString().slice(0, 10) === s;
/** عطلة نهاية الأسبوع السعودية: الجمعة (5) والسبت (6) بحسب getUTCDay على مفتاح اليوم */
export const isWeekend = (k: string): boolean => { const d = new Date(ms(k)).getUTCDay(); return d === 5 || d === 6; };
export const fmtDayAr = (k: string): string => { try { return new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(ms(k))); } catch { return k; } };
export const fmtShortAr = (k: string): string => { try { return new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'short' }).format(new Date(ms(k))); } catch { return k; } };

/* ───────── الإدخال: ثلاث طرق ───────── */
/** لصق تواريخ بأي صيغة شائعة (2026-01-05 · 5/1/2026 · 05-01-2026) — تُعاد مرتّبة بلا تكرار */
export function parseDays(text: unknown): string[] {
  const s = String(text || ''); const out = new Set<string>();
  for (const m of s.matchAll(/(\d{4})-(\d{1,2})-(\d{1,2})/g)) { const k = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; if (isDayKey(k)) out.add(k); }
  for (const m of s.matchAll(/(?<!\d)(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?!\d)/g)) { const k = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; if (isDayKey(k)) out.add(k); }
  return [...out].sort();
}
/** «N أيام من تاريخ كذا» — يتخطّى الجمعة والسبت */
export function expandDays(start: string, n: number, skipWeekend = true): string[] {
  if (!isDayKey(start)) return []; const count = Math.max(0, Math.min(CAL_LIMITS.maxDays, Math.floor(Number(n) || 0))); const out: string[] = []; let k = start;
  while (out.length < count) { if (!skipWeekend || !isWeekend(k)) out.push(k); k = addDays(k, 1); if (daysBetween(start, k) > count * 2 + 14) break; }
  return out;
}
/** نمط: «كتلة من L أيام كل W أسبوعًا × B كتل» ابتداءً من تاريخ */
export function patternDays(start: string, blockLen: number, everyWeeks: number, blocks: number): string[] {
  if (!isDayKey(start)) return []; const L = Math.max(1, Math.min(30, Math.floor(Number(blockLen) || 0))); const W = Math.max(1, Math.min(26, Math.floor(Number(everyWeeks) || 0))); const B = Math.max(1, Math.min(24, Math.floor(Number(blocks) || 0)));
  const out: string[] = []; for (let b = 0; b < B; b += 1) { const s = addDays(start, b * W * 7); out.push(...expandDays(s, L)); }
  return [...new Set(out)].sort().slice(0, CAL_LIMITS.maxDays);
}
export function validateDays(days: unknown): { ok: true; days: string[] } | { ok: false; error: string } {
  if (!Array.isArray(days)) return { ok: false, error: 'أيام غير صالحة' }; const clean = [...new Set(days.filter(isDayKey))].sort();
  if (!clean.length) return { ok: false, error: 'أضف يوم تدريب واحدًا على الأقل' }; if (clean.length > CAL_LIMITS.maxDays) return { ok: false, error: `الحدّ ${CAL_LIMITS.maxDays} يومًا` };
  if (daysBetween(clean[0], clean[clean.length - 1]) > 366 * 3) return { ok: false, error: 'التقويم لا يمتدّ أكثر من ثلاث سنوات' };
  return { ok: true, days: clean };
}

/* ───────── الاشتقاق ───────── */
export function deriveCalendar(daysIn: string[]): Calendar {
  const days = [...new Set((daysIn || []).filter(isDayKey))].sort(); const blocks: Block[] = []; const applies: ApplyPeriod[] = [];
  for (const d of days) { const cur = blocks[blocks.length - 1]; if (cur && daysBetween(cur.end, d) - 1 <= CAL_LIMITS.joinGap) { cur.end = d; cur.days.push(d); } else blocks.push({ no: blocks.length + 1, start: d, end: d, days: [d] }); }
  for (let i = 0; i + 1 < blocks.length; i += 1) { const gap = daysBetween(blocks[i].end, blocks[i + 1].start) - 1; if (gap >= CAL_LIMITS.applyGap) { const from = addDays(blocks[i].end, 1); const to = addDays(blocks[i + 1].start, -1); applies.push({ no: applies.length + 1, from, to, after_block: blocks[i].no, next_block_start: blocks[i + 1].start, weeks: Math.ceil(gap / 7), days: gap }); } }
  return { days, blocks, applies, first: days[0] || null, last: days[days.length - 1] || null };
}
/** بداية الأسبوع داخل فترة التطبيق الذي يقع فيه اليوم (مفتاح سطر التطبيق الأسبوعي) */
export const weekStartIn = (from: string, today: string): string => addDays(from, Math.floor(daysBetween(from, today) / 7) * 7);
export function phaseOf(cal: Calendar | null | undefined, today: string): DayPhase {
  if (!cal || !cal.days.length) return { phase: 'none', today, next: null };
  const first = cal.days[0]; const last = cal.days[cal.days.length - 1];
  if (today < first) return { phase: 'before', today, next: { kind: 'block', start: first, days: daysBetween(today, first) } };
  if (today > last) return { phase: 'after', today, next: null };
  const b = cal.blocks.find((x) => x.days.includes(today));
  if (b) { const idx = b.days.indexOf(today); const nb = cal.blocks.find((x) => x.no === b.no + 1) || null; return { phase: 'training', today, block: { no: b.no, day_idx: idx + 1, len: b.days.length, is_first_day: idx === 0, is_last_day: idx === b.days.length - 1, is_program_first: today === first, is_program_last: today === last, next_block_start: nb ? nb.start : null }, next: nb ? { kind: 'block', start: nb.start, days: daysBetween(today, nb.start) } : null }; }
  const a = cal.applies.find((x) => today >= x.from && today <= x.to);
  if (a) { const week_no = Math.floor(daysBetween(a.from, today) / 7) + 1; return { phase: 'apply', today, apply: { no: a.no, week_no, weeks: a.weeks, from: a.from, to: a.to, next_block_start: a.next_block_start, days_left: daysBetween(today, a.next_block_start), week_start: weekStartIn(a.from, today) }, next: { kind: 'block', start: a.next_block_start, days: daysBetween(today, a.next_block_start) } }; }
  const nb = cal.blocks.find((x) => x.start > today) || null; /* عطلة قصيرة داخل كتلة/بين كتلتين: صمت */
  return { phase: 'rest', today, next: nb ? { kind: 'block', start: nb.start, days: daysBetween(today, nb.start) } : null };
}
/** ما يُسمح للمتدرّب بكتابته اليوم */
export type LineKind = 'learn' | 'apply' | 'commit';
export function allowedKinds(ph: DayPhase): LineKind[] {
  if (ph.phase === 'training' && ph.block) { const out: LineKind[] = ['learn']; if (ph.block.is_last_day && ph.block.next_block_start && !ph.block.is_program_last) out.push('commit'); return out; }
  if (ph.phase === 'apply') return ['apply']; return [];
}
export const isValidKind = (k: unknown): k is LineKind => k === 'learn' || k === 'apply' || k === 'commit';

/* ───────── النصوص ───────── */
export function cleanLine(v: unknown): string { return String(v ?? '').replace(/<[^>]*>/g, '').replace(/https?:\/\/\S+|www\.\S+/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, CAL_LIMITS.lineMax); }
export function validateLine(body: unknown, blocker?: unknown): string | null {
  const raw = String(body ?? '').trim(); const b = cleanLine(body); if (b.length < CAL_LIMITS.lineMin) return `اكتب ${CAL_LIMITS.lineMin} أحرف على الأقل`; if (raw.length > CAL_LIMITS.lineMax) return `الحدّ ${CAL_LIMITS.lineMax} حرفًا`;
  if (blocker !== undefined && blocker !== null && String(blocker).trim().length > CAL_LIMITS.lineMax) return `الحدّ ${CAL_LIMITS.lineMax} حرفًا لما منعك`; return null;
}
export const PROMPTS_AR: Record<LineKind, { title: string; hint: string; blocker?: string }> = {
  learn: { title: 'ماذا أخذتُ من اليوم؟', hint: 'سطر واحد: ما تعلّمتَه وكيف ستستعمله في موقعك.' },
  apply: { title: 'ماذا طبّقتُ هذا الأسبوع؟', hint: 'سطر صادق من موقعك — ما جرّبتَه فعلًا ممّا أخذتَه في الكتلة الماضية.', blocker: 'ما الذي منعني؟ (اختياري)' },
  commit: { title: 'التزامي حتى نلتقي', hint: 'ما الشيء الواحد الذي ستطبّقه في موقعك قبل أن نعود؟ يُفتح لك وحدك أول يوم الكتلة القادمة.' },
};
export const DONE_AR: Record<'yes' | 'part' | 'no', string> = { yes: 'فعلت', part: 'جزئيًا', no: 'لم أفعل بعد' };
export const isDone = (v: unknown): v is 'yes' | 'part' | 'no' => v === 'yes' || v === 'part' || v === 'no';
export const arN = (n: number, one: string, two: string, few: string, many: string) => n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`;
/** كلمة أَثَر القصيرة في صفحة المتدرّب بحسب الطور */
export function atharLine(ph: DayPhase, programAr: string): string {
  if (ph.phase === 'training' && ph.block) { if (ph.block.is_program_first) return `يومك الأول في «${programAr}» — خذ منه سطرًا واحدًا على الأقل.`; if (ph.block.is_program_last) return `آخر يوم تدريب في «${programAr}». ما كتبتَه طوال الطريق صار لك.`; if (ph.block.is_last_day) return `آخر يوم في الكتلة ${ph.block.no}. قبل أن تعود إلى موقعك: ما الشيء الواحد الذي ستطبّقه؟`; return `الكتلة ${ph.block.no} — اليوم ${ph.block.day_idx} من ${ph.block.len}.`; }
  if (ph.phase === 'apply' && ph.apply) return `${P66_NAMES_AR.apply}. الأسبوع ${ph.apply.week_no} من ${ph.apply.weeks} — نلتقي في الكتلة القادمة ${countdownAr(ph.apply.days_left)}.`;
  if (ph.phase === 'before' && ph.next) return `يبدأ «${programAr}» ${countdownAr(ph.next.days)}.`;
  if (ph.phase === 'rest' && ph.next) return `استراحة قصيرة — نعود ${countdownAr(ph.next.days)}.`;
  if (ph.phase === 'after') return `انتهى «${programAr}» — وما بعده في «ما بعد البرنامج» و«يوم تخرّجي».`;
  return '';
}
export const countdownAr = (days: number) => days <= 0 ? 'اليوم' : days === 1 ? 'غدًا' : days === 2 ? 'بعد يومين' : days <= 10 ? `بعد ${days} أيام` : `بعد ${days} يومًا`;

/* ───────── «ما جرى في الميدان» — المجمَّع للمدرّب (k ≥ 5، بلا أسماء) ───────── */
export type FieldLine = { user_id: string; body_ar: string; blocker_ar?: string | null; day: string };
export type FieldSummary = { shown: boolean; people: number; lines: number; applied: string[]; blockers: string[]; blockers_people: number; head_ar: string; below_ar: string | null };
export function fieldSummaryOf(rows: FieldLine[], opts: { k?: number; show?: number; seed?: string; roster?: number } = {}): FieldSummary {
  const k = opts.k ?? CAL_LIMITS.k; const show = opts.show ?? CAL_LIMITS.show; const people = new Set(rows.map((r) => r.user_id)).size; const roster = opts.roster || 0;
  const of = roster ? `${people} من ${roster}` : `${people}`;
  if (people < k) return { shown: false, people, lines: rows.length, applied: [], blockers: [], blockers_people: 0, head_ar: people ? `وثّق تطبيقَه ${of}؛ تظهر السطور حين يبلغون خمسة.` : 'لم يوثّق أحد تطبيقه بعد.', below_ar: null };
  const pick = (xs: string[]) => shuffleSeeded([...new Set(xs.map(cleanLine).filter((s) => s.length >= CAL_LIMITS.lineMin))], opts.seed || 'p66').slice(0, show);
  const bl = rows.filter((r) => cleanLine(r.blocker_ar).length >= CAL_LIMITS.lineMin); const blockers_people = new Set(bl.map((r) => r.user_id)).size;
  return { shown: true, people, lines: rows.length, applied: pick(rows.map((r) => r.body_ar)), blockers: blockers_people >= k ? pick(bl.map((r) => String(r.blocker_ar))) : [], blockers_people, head_ar: `وثّق تطبيقَه ${of} — ${arN(rows.length, 'سطر واحد', 'سطران', 'سطور', 'سطرًا')}.`, below_ar: blockers_people && blockers_people < k ? `ذكر ما منعه ${blockers_people}؛ تظهر الموانع حين يبلغون خمسة.` : null };
}
export function shuffleSeeded<T>(xs: T[], seed: string): T[] { let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } const out = [...xs]; for (let i = out.length - 1; i > 0; i -= 1) { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; const j = h % (i + 1); [out[i], out[j]] = [out[j], out[i]]; } return out; }

/* ───────── الإشعارات (نصوص فقط) ───────── */
export const applyStartNotice = (programAr: string, nextStart: string) => ({ title_ar: `«${programAr}» معك في موقعك 🧭`, body_ar: `انتهت الكتلة، وبدأ الجزء الذي يصنع الأثر: طبّق ما أخذتَه، ووثّق كل أسبوع سطرًا واحدًا — ماذا طبّقتَ وما الذي منعك. نلتقي في الكتلة القادمة ${fmtShortAr(nextStart)}.` });
export const applyWeekNotice = (programAr: string, weekNo: number, weeks: number) => ({ title_ar: `سطر التطبيق — الأسبوع ${weekNo} من ${weeks}`, body_ar: `سطر واحد من موقعك في «${programAr}»: ماذا طبّقتَ هذا الأسبوع؟ وإن منعك شيء فقله — فهو أهمّ ما سيسمعه مدرّبك.` });
export const fieldSummaryNotice = (roomCode: string, s: FieldSummary, nextStart: string) => ({ title_ar: `ما جرى في الميدان — شعبة ${roomCode}`, body_ar: `${s.head_ar} تعود الكتلة ${fmtShortAr(nextStart)} — افتتحها بما جرى في مواقعهم فعلًا.` });
export const commitOpenNotice = (programAr: string) => ({ title_ar: 'هذا ما وعدتَ به نفسك ✉️', body_ar: `عدتَ إلى «${programAr}». التزامك الذي كتبتَه آخر يوم في الكتلة الماضية يُفتح لك وحدك اليوم — هل فعلت؟` });
export const calendarAskNotice = (programAr: string, roomCode: string) => ({ title_ar: `تقويم شعبة ${roomCode}`, body_ar: `«${programAr}» يبدأ قريبًا. إن كانت أيامه موزّعة على كتل، ضع تقويم الشعبة ليعرف متدرّبوك متى تلتقون ومتى يطبّقون — دقيقة واحدة.` });
export const NOTICE_KINDS_P66 = ['apply_start', 'apply_week', 'field_summary', 'commit_open', 'calendar_ask'] as const;

/* ───────── «الطريق» في صفحة المتدرّب ───────── */
export type RoadItem = { label: string; sub: string; state: 'done' | 'now' | 'next' };
export function roadOf(cal: Calendar, ph: DayPhase): RoadItem[] {
  const out: RoadItem[] = [];
  for (const b of cal.blocks) { const st: RoadItem['state'] = ph.today > b.end ? 'done' : ph.today >= b.start ? 'now' : 'next'; out.push({ label: `الكتلة ${b.no}`, sub: `${fmtShortAr(b.start)}${b.days.length > 1 ? ` – ${fmtShortAr(b.end)}` : ''} · ${arN(b.days.length, 'يوم واحد', 'يومان', 'أيام', 'يومًا')}`, state: st });
    const a = cal.applies.find((x) => x.after_block === b.no); if (a) out.push({ label: P66_NAMES_AR.apply, sub: `${arN(a.weeks, 'أسبوع واحد', 'أسبوعان', 'أسابيع', 'أسبوعًا')} من التطبيق حتى ${fmtShortAr(a.to)}`, state: ph.today > a.to ? 'done' : ph.today >= a.from ? 'now' : 'next' }); }
  return out;
}
