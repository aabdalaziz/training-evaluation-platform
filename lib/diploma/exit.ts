// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * هـ-1/5 — توأمة البرامج والدبلومات + نظام الخروج EXIT — المنطق الصرف (بلا قاعدة بيانات)
 *  القاعدة: الدبلوم مسارٌ من برامج؛ كلّ مقرّر وحدة قابلة للتراكم؛ شهادة الدبلوم = مجموع شهادات مستوياته + مشروع ختامي.
 *  «لا انسحاب بلا شيء»: من يخرج يحمل شهادات المستويات التي أتمّها + سجلّ إنجاز موقَّعًا، ويعود خلال ٢٤ شهرًا من حيث توقّف.
 *  حالات القيد: enrolled → active → exited → returned → graduate
 */
export const EXIT_NAMES_AR = {
  phase: 'توأمة البرامج والدبلومات', exit: 'الخروج', exited: 'خارج', returned: 'عائد', graduate: 'خرّيج', active: 'نشط', enrolled: 'مسجَّل',
  carry: 'لو خرجت اليوم تحمل معك', record: 'سجلّ الإنجاز', levelCert: 'شهادة برنامج المستوى', rpl: 'اعتراف بتعلّم سابق',
} as const;
export const RETURN_MONTHS = 24;
export const ATTENDANCE_DONE_PCT = 75;        // المقرّر يُعدّ متمًّا من الحضور عند ≥ ٧٥٪ بعد إغلاقه/انتهائه
export const RISK_WINDOW_DAYS = 21;           // نافذة الإشارة المبكرة
export const RISK_ATTEND_PCT = 50;            // دون ٥٠٪ حضور في النافذة = إشارة
export const RISK_SILENT_DAYS = 14;           // لا حضور ١٤ يومًا مع وجود محاضرات = إشارة
export const REASONS: { code: string; ar: string }[] = [
  { code: 'work', ar: 'ظروف عمل' }, { code: 'family', ar: 'ظروف أسرية' }, { code: 'health', ar: 'ظروف صحية' }, { code: 'travel', ar: 'سفر / انتقال' },
  { code: 'finance', ar: 'ظروف مالية' }, { code: 'program', ar: 'البرنامج لم يناسبني' }, { code: 'other', ar: 'سبب آخر' },
];

export type Unit = { id: string; idx: number; title_ar: string; level_no: number | null; hours: number; starts_on: string | null; ends_on: string | null; closed_at: string | null; linked_program_id: string | null };
export type Completion = { unit_id: string; status: 'done' | 'not_done'; source: 'attendance' | 'credential' | 'manual'; attendance_pct?: number | null };
export type AttendanceDay = { day: string; present: boolean };      // محاضرة في يوم (حضر/لم يحضر)
export type ExitState = 'enrolled' | 'active' | 'exited' | 'returned' | 'graduate';

export type LevelProgress = { level_no: number; title: string; units: Unit[]; done: number; total: number; complete: boolean; hours: number };
export type Carry = { levels: LevelProgress[]; levelsDone: number; unitsDone: number; unitsTotal: number; hours: number; afterLevel: number; line_ar: string; certificates: { level_no: number; title_ar: string; hours: number }[]; rplPrograms: string[] };

const arN = (n: number) => new Intl.NumberFormat('ar-EG').format(n);
export const LEVEL_WORD = ['', 'الأوّل', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];

/** تجميع المقرّرات بالمستوى مع حالة الإتمام — المقرّرات بلا مستوى تُعدّ «مستوى ٠» (لا يُحتسب في الشهادات) */
export function levelsOf(units: Unit[], completions: Completion[]): LevelProgress[] {
  const done = new Set(completions.filter((c) => c.status === 'done').map((c) => c.unit_id));
  const m = new Map<number, Unit[]>();
  for (const u of units) { const l = u.level_no || 0; if (!m.has(l)) m.set(l, []); m.get(l)!.push(u); }
  return Array.from(m.keys()).sort((a, b) => a - b).map((l) => {
    const us = m.get(l)!.sort((a, b) => a.idx - b.idx); const d = us.filter((u) => done.has(u.id)).length;
    return { level_no: l, title: l ? `المستوى ${LEVEL_WORD[l] || arN(l)}` : 'مقرّرات عامّة', units: us, done: d, total: us.length, complete: us.length > 0 && d === us.length, hours: us.reduce((s, u) => s + (done.has(u.id) ? Number(u.hours || 0) : 0), 0) };
  });
}

/** «لو خرجت اليوم تحمل معك: …» */
export function carryToday(diplomaName: string, units: Unit[], completions: Completion[]): Carry {
  const levels = levelsOf(units, completions); const real = levels.filter((l) => l.level_no > 0);
  const certificates = real.filter((l) => l.complete).map((l) => ({ level_no: l.level_no, title_ar: `${EXIT_NAMES_AR.levelCert} ${LEVEL_WORD[l.level_no] || arN(l.level_no)} — ${diplomaName}`, hours: l.hours }));
  // المستوى «بعد» = أعلى مستوى مكتمل متّصلًا من البداية
  let afterLevel = 0; for (const l of real) { if (l.complete && l.level_no === afterLevel + 1) afterLevel = l.level_no; else break; }
  const unitsDone = levels.reduce((s, l) => s + l.done, 0); const unitsTotal = levels.reduce((s, l) => s + l.total, 0); const hours = levels.reduce((s, l) => s + l.hours, 0);
  const done = new Set(completions.filter((c) => c.status === 'done').map((c) => c.unit_id));
  const rplPrograms = Array.from(new Set(units.filter((u) => u.linked_program_id && done.has(u.id)).map((u) => u.linked_program_id as string)));
  const parts: string[] = [];
  if (certificates.length) parts.push(certificates.length === 1 ? 'شهادة برنامج واحدة' : certificates.length === 2 ? 'شهادتا برنامج' : `${arN(certificates.length)} شهادات برامج`);
  if (unitsDone) parts.push(`سجلّ إنجاز موقَّعًا بـ${unitsDone === 1 ? 'مقرّر واحد' : unitsDone === 2 ? 'مقرّرين' : `${arN(unitsDone)} مقرّرات`} (${arN(Math.round(hours))} ساعة)`);
  const line_ar = parts.length ? `${EXIT_NAMES_AR.carry}: ${parts.join(' و')}. وبابك مفتوح للعودة ${arN(RETURN_MONTHS)} شهرًا من حيث توقّفت.` : `${EXIT_NAMES_AR.carry}: سجلّ بداية — لم يكتمل مقرّر بعد. أكمل المقرّر الأوّل ليصبح لك ما تحمله.`;
  return { levels, levelsDone: certificates.length, unitsDone, unitsTotal, hours, afterLevel, line_ar, certificates, rplPrograms };
}

/** الإتمام الآلي من الحضور: المقرّر مغلق أو انتهى تاريخه + نسبة الحضور في نافذته ≥ الحدّ. لا محاضرات في النافذة = لا حكم (null) */
export function attendanceVerdict(u: Unit, days: AttendanceDay[], today: string): { done: boolean; pct: number } | null {
  const ended = !!u.closed_at || (!!u.ends_on && u.ends_on < today); if (!ended) return null;
  const inWin = days.filter((d) => (!u.starts_on || d.day >= u.starts_on) && (!u.ends_on || d.day <= u.ends_on)); if (!inWin.length) return null;
  const pct = Math.round((inWin.filter((d) => d.present).length / inWin.length) * 100);
  return { done: pct >= ATTENDANCE_DONE_PCT, pct };
}

/** الإشارة المبكرة: من يقترب من الخروج قبل أن يخرج */
export function riskSignal(days: AttendanceDay[], today: string): { level: 'none' | 'watch' | 'high'; line_ar: string; pct: number | null; silent: number | null } {
  const from = addDaysKey(today, -RISK_WINDOW_DAYS); const win = days.filter((d) => d.day >= from && d.day <= today);
  if (!win.length) return { level: 'none', line_ar: 'لا محاضرات في الأسابيع الثلاثة الأخيرة.', pct: null, silent: null };
  const pct = Math.round((win.filter((d) => d.present).length / win.length) * 100);
  const lastPresent = days.filter((d) => d.present).map((d) => d.day).sort().pop() || null; const silent = lastPresent ? daysBetween(lastPresent, today) : daysBetween(win[0].day, today);
  if (silent >= RISK_SILENT_DAYS && win.length >= 2) return { level: 'high', line_ar: `غائب منذ ${arN(silent)} يومًا رغم وجود محاضرات.`, pct, silent };
  if (pct < RISK_ATTEND_PCT) return { level: 'watch', line_ar: `حضوره في الأسابيع الثلاثة الأخيرة ${arN(pct)}٪.`, pct, silent };
  return { level: 'none', line_ar: `حضور منتظم ${arN(pct)}٪.`, pct, silent };
}

/** آلة الحالات */
export function stateOf(enrollStatus: string, exit: { state: string } | null, graduated: boolean, anyAttendance: boolean): ExitState {
  if (graduated) return 'graduate';
  if (exit?.state === 'exited') return 'exited';
  if (exit?.state === 'returned') return 'returned';
  if (['approved', 'placed', 'active', 'completed'].includes(enrollStatus)) return anyAttendance ? 'active' : 'enrolled';
  return 'enrolled';
}
export function canExit(s: ExitState): boolean { return s === 'enrolled' || s === 'active' || s === 'returned'; }
export function canReturn(s: ExitState, returnBy: string | null, today: string): boolean { return s === 'exited' && !!returnBy && returnBy.slice(0, 10) >= today; }
export function returnByOf(exitedIso: string): string { const d = new Date(exitedIso); d.setUTCMonth(d.getUTCMonth() + RETURN_MONTHS); return d.toISOString(); }

/** سجلّ الإنجاز الموقَّع — المحتوى العام (يُوقَّع عبر مسار P17) */
export function achievementRecord(diplomaName: string, carry: Carry, exitedAt: string): { title_ar: string; description_ar: string; hours: number; level: string } {
  const lines = carry.levels.filter((l) => l.level_no > 0).map((l) => `${l.title}: ${arN(l.done)}/${arN(l.total)}${l.complete ? ' ✓' : ''}`);
  return { title_ar: `${EXIT_NAMES_AR.record} — ${diplomaName}`, description_ar: `خرج من الدبلوم بتاريخ ${exitedAt.slice(0, 10)} بعد ${carry.afterLevel ? `المستوى ${LEVEL_WORD[carry.afterLevel] || arN(carry.afterLevel)}` : 'البداية'}. المقرّرات المتمّة: ${arN(carry.unitsDone)} من ${arN(carry.unitsTotal)} (${arN(Math.round(carry.hours))} ساعة). ${lines.join(' · ')}. يحقّ له الاستئناف من حيث توقّف خلال ${arN(RETURN_MONTHS)} شهرًا.`, hours: Math.round(carry.hours * 10) / 10, level: carry.afterLevel ? `L${carry.afterLevel}` : 'L0' };
}

export function addDaysKey(day: string, n: number): string { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function daysBetween(a: string, b: string): number { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
