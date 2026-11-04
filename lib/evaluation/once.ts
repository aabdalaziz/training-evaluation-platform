/**
 * P49-ج «مرّة واحدة» — منع تكرار الاستبيان/الاستطلاع من المشارك نفسه.
 * © 2026 د. أحمد محمد عبدالعزيز بدوي — جميع الحقوق محفوظة.
 *
 * ثلاث طبقات تعمل معًا (كلٌّ منها يسدّ ثغرة الأخرى):
 *   1) «ذاكرة الجهاز»: بعد الإرسال الناجح نحفظ علامة في المتصفّح؛ عند فتح الاستبيان نفسه ثانيةً
 *      تظهر بطاقة «سبق لك إجراء هذا الاستبيان — شكرًا لك» بدل النموذج (مع زرّ صريح للأجهزة المشتركة).
 *   2) «البريد مبكّرًا»: عند كتابة البريد نفحص السجلّ فورًا ونُظهر الرسالة قبل أن يملأ المشارك النموذج.
 *   3) «قاعدة البيانات»: فهارس فريدة جزئية (SQL-4) تمنع التكرار حتى لو تجاوز أحدهم الطبقتين السابقتين،
 *      ويُترجَم خطأ 23505 إلى الرسالة الودّية نفسها.
 *
 * السياسة: اليومي + استطلاع التعلّم عن بُعد → مرّة واحدة في اليوم (بتوقيت الرياض) لكل مجموعة.
 *          الختامي + نهاية البرنامج → مرّة واحدة للبرنامج.
 */

export type OnceKind = 'DAILY' | 'FINAL' | 'END' | 'REMOTE';
export type OnceScope = { kind: OnceKind; programId?: string | null; classroomId?: string | null; scheduleId?: string | null; date?: string };

/** هل هذا النوع يُعاد يوميًّا (فتُقيَّد بالتاريخ) أم مرّة واحدة للبرنامج؟ */
export function oncePerDay(kind: OnceKind): boolean { return kind === 'DAILY' || kind === 'REMOTE'; }

/** تاريخ اليوم بتوقيت الرياض YYYY-MM-DD (لا UTC — جلسة الساعة 01:00 ليلًا تبقى في يومها). */
export function riyadhToday(now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const g = (t: string) => parts.find(p => p.type === t)?.value || '';
    const s = `${g('year')}-${g('month')}-${g('day')}`; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  } catch { /* fallback below */ }
  return new Date(now.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

/** مفتاح العلامة في المتصفّح — ثابت ومتوقَّع كي تختبره الوحدات. */
export function onceKey(s: OnceScope): string {
  const date = oncePerDay(s.kind) ? (s.date || riyadhToday()) : '-';
  return `athar:once:${s.kind}:${s.programId || '-'}:${s.classroomId || '-'}:${s.scheduleId || '-'}:${date}`;
}

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
function store(): Store | null { try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; } }

/** هل سُجِّل إرسال لهذا النطاق على هذا الجهاز؟ (يعيد وقت الإرسال ISO أو null) */
export function wasDone(s: OnceScope, st: Store | null = store()): string | null {
  if (!st) return null; try { const v = st.getItem(onceKey(s)); return v || null; } catch { return null; }
}
export function markDone(s: OnceScope, st: Store | null = store(), at: Date = new Date()): void {
  if (!st) return; try { st.setItem(onceKey(s), at.toISOString()); } catch { /* private mode */ }
}
export function clearDone(s: OnceScope, st: Store | null = store()): void { if (!st) return; try { st.removeItem(onceKey(s)); } catch { /* ignore */ } }

/** رسالة «سبق لك» بحسب النوع واللغة. */
export const ONCE_MSG: Record<'perDay' | 'once', [string, string]> = {
  perDay: ['سبق لك إجراء هذا الاستبيان اليوم — شكرًا لك، رأيك محفوظ. يمكنك المشاركة مجدّدًا في الجلسة القادمة.', 'You have already completed this survey today — thank you, your response is saved. You can take part again at the next session.'],
  once: ['سبق لك إجراء هذا الاستبيان — شكرًا لك، رأيك محفوظ.', 'You have already completed this survey — thank you, your response is saved.'],
};
export function onceMessage(kind: OnceKind, lang: 'ar' | 'en'): string { return ONCE_MSG[oncePerDay(kind) ? 'perDay' : 'once'][lang === 'en' ? 1 : 0]; }
export const ONCE_TITLE: [string, string] = ['شكرًا لك — مشاركتك مسجّلة', 'Thank you — your response is on record'];
export const ONCE_SHARED: [string, string] = ['جهاز مشترك؟ مشارك آخر يبدأ من هنا', 'Shared device? Another participant starts here'];

/** هل الخطأ من Postgres/PostgREST هو انتهاك فهرس فريد (طبقة قاعدة البيانات)؟ */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string; details?: string } | null;
  if (!e) return false; if (e.code === '23505') return true;
  const m = `${e.message || ''} ${e.details || ''}`.toLowerCase();
  return m.includes('duplicate key') || m.includes('evaluations_once_');
}
