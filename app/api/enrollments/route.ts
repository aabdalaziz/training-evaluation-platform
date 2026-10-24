// أَثَر — P2: منطق كتالوج البرامج وطلبات التسجيل (دوال نقية قابلة للاختبار)
import type { Lang, T } from './content';
import { t, UI, deliveryLabel } from './content';

export type ProgramType = 'course' | 'diploma' | 'workshop' | 'arabic';
export type CatalogProgram = {
  id: string; name_ar: string; name_en?: string | null; status?: string | null; delivery_mode?: string | null;
  start_date?: string | null; end_date?: string | null; archived_at?: string | null;
  intro_ar?: string | null; intro_en?: string | null; objectives_ar?: string | null; objectives_en?: string | null;
  outcomes_ar?: string | null; outcomes_en?: string | null; audience_ar?: string | null; audience_en?: string | null;
  fee?: number | string | null; currency?: string | null; seats?: number | null; program_type?: string | null;
  is_public?: boolean | null; registration_open?: boolean | null; registration_deadline?: string | null;
  location_ar?: string | null; location_en?: string | null; hours?: number | null;
};
export type Counts = { program_id: string; approved: number; pending: number; waitlisted: number };
export type RegState = 'open' | 'waitlist' | 'full' | 'closed' | 'deadline' | 'ended';
export type EnrollStatus = 'pending' | 'approved' | 'waitlisted' | 'rejected' | 'cancelled';
export type Enrollment = {
  id: string; created_at: string; program_id: string; user_id?: string | null; full_name: string; email: string; phone?: string | null;
  organization?: string | null; city?: string | null; notes?: string | null; lang?: string | null; status: EnrollStatus;
  decided_at?: string | null; decision_note?: string | null; notified_at?: string | null;
};

export const TYPES: { value: ProgramType; label: T }[] = [
  { value: 'course', label: { ar: 'برنامج تدريبي', en: 'Training program' } },
  { value: 'diploma', label: { ar: 'دبلوم', en: 'Diploma' } },
  { value: 'workshop', label: { ar: 'ورشة عمل', en: 'Workshop' } },
  { value: 'arabic', label: { ar: 'تعليم العربية', en: 'Arabic language' } },
];
export const typeLabel = (v: string | null | undefined, lang: Lang): string => { const x = TYPES.find(y => y.value === v); return x ? t(x.label, lang) : t(TYPES[0].label, lang); };

export const STATUS_LABEL: Record<EnrollStatus, T> = {
  pending: { ar: 'قيد المراجعة', en: 'Under review' },
  approved: { ar: 'مقبول', en: 'Approved' },
  waitlisted: { ar: 'قائمة الانتظار', en: 'Waitlisted' },
  rejected: { ar: 'معتذر', en: 'Not accepted' },
  cancelled: { ar: 'ملغى', en: 'Cancelled' },
};
export const statusLabel = (s: string, lang: Lang): string => t(STATUS_LABEL[(s as EnrollStatus)] || { ar: s, en: s }, lang);

export const CUR: Record<string, T> = { SAR: { ar: 'ر.س', en: 'SAR' }, USD: { ar: 'دولار', en: 'USD' }, EUR: { ar: 'يورو', en: 'EUR' } };
export function feeLabel(fee: number | string | null | undefined, currency: string | null | undefined, lang: Lang): string {
  if (fee === null || fee === undefined || fee === '') return lang === 'ar' ? 'الرسوم عند التواصل' : 'Fee on request';
  const n = Number(fee); if (!isFinite(n)) return lang === 'ar' ? 'الرسوم عند التواصل' : 'Fee on request';
  if (n === 0) return lang === 'ar' ? 'مجاني' : 'Free';
  const c = CUR[(currency || 'SAR').toUpperCase()] || { ar: currency || '', en: currency || '' };
  const num = n.toLocaleString(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', { maximumFractionDigits: 2 });
  return lang === 'ar' ? `${num} ${t(c, 'ar')}` : `${t(c, 'en')} ${num}`;
}

export function seatsLeft(p: CatalogProgram, c?: Counts | null): number | null {
  if (p.seats === null || p.seats === undefined) return null;
  return Math.max(0, Number(p.seats) - Number(c?.approved || 0));
}

/** حالة التسجيل في برنامج ما */
export function regState(p: CatalogProgram, today: string, c?: Counts | null): RegState {
  if (p.end_date && p.end_date < today) return 'ended';
  if (['COMPLETED', 'CANCELLED'].includes(String(p.status || '').toUpperCase())) return 'ended';
  if (p.registration_open === false) return 'closed';
  if (p.registration_deadline && p.registration_deadline < today) return 'deadline';
  const left = seatsLeft(p, c);
  if (left !== null && left <= 0) return 'full';
  if (left !== null && left - Number(c?.pending || 0) <= 0) return 'waitlist';
  return 'open';
}
export const REG_LABEL: Record<RegState, T> = {
  open: { ar: 'التسجيل مفتوح', en: 'Registration open' },
  waitlist: { ar: 'قائمة انتظار', en: 'Waitlist' },
  full: { ar: 'اكتملت المقاعد', en: 'Full' },
  closed: { ar: 'التسجيل مغلق', en: 'Registration closed' },
  deadline: { ar: 'انتهى موعد التسجيل', en: 'Deadline passed' },
  ended: { ar: 'انتهى البرنامج', en: 'Ended' },
};
export const canApply = (s: RegState) => s === 'open' || s === 'waitlist';

/** البرامج المعروضة في الكتالوج: عامة وغير مؤرشفة وغير ملغاة؛ المنتهية تظهر فقط عند طلبها */
export function catalogPrograms(rows: CatalogProgram[], today: string, includeEnded = false): CatalogProgram[] {
  return rows
    .filter(p => !p.archived_at && p.is_public !== false && String(p.status || '').toUpperCase() !== 'CANCELLED')
    .filter(p => includeEnded || ((!p.end_date || p.end_date >= today) && String(p.status || '').toUpperCase() !== 'COMPLETED'))
    .sort((a, b) => String(a.start_date || '9999').localeCompare(String(b.start_date || '9999')));
}

export type Filters = { q?: string; type?: string; mode?: string; state?: string };
export function filterPrograms(rows: CatalogProgram[], f: Filters, today: string, counts: Counts[] = []): CatalogProgram[] {
  const q = (f.q || '').trim().toLowerCase();
  return rows.filter(p => {
    if (f.type && (p.program_type || 'course') !== f.type) return false;
    if (f.mode) { const m = String(p.delivery_mode || '').toLowerCase(); const isRemote = m.includes('remote') || m.includes('online'); if (f.mode === 'remote' ? !isRemote : isRemote) return false; }
    if (f.state) { const c = counts.find(x => x.program_id === p.id); const s = regState(p, today, c); if (f.state === 'open' ? !canApply(s) : s !== f.state) return false; }
    if (q) { const hay = [p.name_ar, p.name_en, p.intro_ar, p.intro_en, p.audience_ar].filter(Boolean).join(' ').toLowerCase(); if (!hay.includes(q)) return false; }
    return true;
  });
}

export const lines = (s: string | null | undefined): string[] => String(s || '').split(/\r?\n|•|؛/).map(x => x.trim().replace(/^[-*\d.)\s]+/, '')).filter(Boolean);
export const pick = (p: CatalogProgram, key: 'intro' | 'objectives' | 'outcomes' | 'audience' | 'location', lang: Lang): string => {
  const ar = (p as any)[`${key}_ar`] as string | null | undefined, en = (p as any)[`${key}_en`] as string | null | undefined;
  return String((lang === 'en' && en) ? en : (ar || en || ''));
};
export function durationLabel(p: CatalogProgram, lang: Lang): string {
  const parts: string[] = [];
  if (p.hours) parts.push(lang === 'ar' ? `${p.hours} ساعة` : `${p.hours} hours`);
  if (p.start_date && p.end_date) { const d = Math.round((Date.parse(p.end_date) - Date.parse(p.start_date)) / 86400000) + 1; if (d > 0) parts.push(d >= 14 ? (lang === 'ar' ? `${Math.round(d / 7)} أسابيع` : `${Math.round(d / 7)} weeks`) : (lang === 'ar' ? `${d} أيام` : `${d} days`)); }
  return parts.join(' · ');
}
export { deliveryLabel, UI };

export type EnrollForm = { full_name: string; email: string; phone: string; organization: string; city: string; notes: string };
export function validateEnrollment(f: EnrollForm, lang: Lang): string | null {
  const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  if (f.full_name.trim().length < 2) return m('اكتب الاسم الكامل', 'Enter your full name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return m('البريد الإلكتروني غير صالح', 'Invalid email');
  if (!/^[+\d][\d\s\-()]{6,}$/.test(f.phone.trim())) return m('رقم الجوال مطلوب (مع رمز الدولة)', 'Phone number is required (with country code)');
  if (f.notes.length > 1000) return m('الملاحظات طويلة جدًا', 'Notes too long');
  return null;
}

/** بريد القرار للمتقدّم */
export function decisionEmail(e: Enrollment, programName: string, status: EnrollStatus, note: string | null | undefined, siteUrl: string): { subject: string; html: string } {
  const lang: Lang = e.lang === 'en' ? 'en' : 'ar';
  const subj: Record<string, T> = {
    pending: { ar: `استلمنا طلبك: ${programName}`, en: `We received your application: ${programName}` },
    approved: { ar: `تم قبولك في: ${programName}`, en: `You're in: ${programName}` },
    waitlisted: { ar: `أُدرجت في قائمة الانتظار: ${programName}`, en: `Waitlisted: ${programName}` },
    rejected: { ar: `بخصوص طلبك: ${programName}`, en: `About your application: ${programName}` },
    cancelled: { ar: `تم إلغاء طلبك: ${programName}`, en: `Application cancelled: ${programName}` },
  };
  const body: Record<string, T> = {
    pending: { ar: 'وصلنا طلب تسجيلك وسيراجعه فريقنا خلال يومي عمل، وستصلك رسالة بالقرار.', en: 'Your application has been received. Our team will review it within two business days and email you the decision.' },
    approved: { ar: 'يسعدنا إبلاغك بقبول طلبك. سنوافيك بتفاصيل الالتحاق والمواعيد والدفع (إن وُجد) قريبًا.', en: 'We are pleased to confirm your acceptance. Enrolment details, schedule and payment (if any) will follow shortly.' },
    waitlisted: { ar: 'اكتملت المقاعد حاليًا وأُدرج طلبك في قائمة الانتظار. سنبلغك فور توفر مقعد.', en: 'Seats are currently full and you have been placed on the waitlist. We will notify you as soon as a seat opens.' },
    rejected: { ar: 'نشكر اهتمامك. نعتذر عن قبول الطلب في هذه الدورة، ونرحّب بك في دورات قادمة.', en: 'Thank you for your interest. We are unable to accept this application for this cohort; we would be glad to see you in a future one.' },
    cancelled: { ar: 'تم إلغاء طلب تسجيلك بناءً على طلبك.', en: 'Your application has been cancelled as requested.' },
  };
  const esc = (s: string) => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const html = `<div dir="${dir}" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
  <div style="background:#0f2a4e;color:#fff;padding:18px 22px"><div style="font-size:20px;font-weight:900">${lang === 'ar' ? 'أَثَر' : 'Athar · TRACE'}</div><div style="font-size:12px;opacity:.8">${lang === 'ar' ? 'بوابة التعليم والتدريب والتطوير' : 'Education, Training & Development Portal'}</div></div>
  <div style="padding:22px;color:#0f172a;line-height:1.9;font-size:15px">
    <p style="margin:0 0 10px">${lang === 'ar' ? 'مرحبًا' : 'Dear'} ${esc(e.full_name)}،</p>
    <p style="margin:0 0 10px"><b>${esc(programName)}</b></p>
    <p style="margin:0 0 10px">${t(body[status], lang)}</p>
    ${note ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;margin:10px 0"><b>${lang === 'ar' ? 'ملاحظة من الإدارة:' : 'Note from our team:'}</b><br>${esc(note)}</div>` : ''}
    <p style="margin:14px 0 0"><a href="${siteUrl}/programs/${e.program_id}" style="background:#0b8a83;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:800;display:inline-block">${lang === 'ar' ? 'صفحة البرنامج' : 'Program page'}</a></p>
  </div>
  <div style="background:#f8fafc;color:#64748b;font-size:12px;padding:12px 22px">${lang === 'ar' ? 'هذه رسالة آلية من بوابة أَثَر — للاستفسار ردّ على هذا البريد.' : 'Automated message from the Athar portal — reply to this email for help.'}</div>
</div>`;
  return { subject: t(subj[status], lang), html };
}

/** ورقة Excel لطلبات التسجيل (متوافقة مع lib/export/xlsx) */
export function enrollmentsSheet(rows: (Enrollment & { program_name?: string })[]): { name: string; rows: (string | number | null)[][]; widths: number[]; rtl: boolean } {
  const header = ['البرنامج', 'الاسم', 'البريد', 'الجوال', 'الجهة', 'المدينة', 'الحالة', 'تاريخ الطلب', 'تاريخ القرار', 'ملاحظة القرار', 'ملاحظات المتقدم'];
  return {
    name: 'طلبات التسجيل', rtl: true, widths: [34, 24, 28, 16, 22, 14, 14, 12, 12, 30, 30],
    rows: [header, ...rows.map(r => [r.program_name || r.program_id, r.full_name, r.email, r.phone || '', r.organization || '', r.city || '', statusLabel(r.status, 'ar'), r.created_at.slice(0, 10), r.decided_at ? r.decided_at.slice(0, 10) : '', r.decision_note || '', r.notes || ''])],
  };
}
