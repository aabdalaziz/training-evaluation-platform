/**
 * الحضور الرقمي — النماذج والدوال المشتركة (بدون تبعيات)
 * تُستخدم في: /admin/attendance ، /attend/[token] ، /admin/certificates ، والاختبارات
 */

export type SessionStatus = 'open' | 'closed';
export type RecordStatus = 'present' | 'late' | 'excused' | 'absent';
export type RecordMethod = 'qr' | 'manual' | 'import';

export type AttendanceSession = {
  id: string;
  organization_id?: string | null;
  program_id: string;
  classroom_id: string | null;
  trainer_id: string | null;
  title: string;
  session_date: string;          // YYYY-MM-DD
  start_time: string | null;     // HH:MM[:SS]
  end_time: string | null;
  late_after_min: number;
  require_phone: boolean;
  token: string;
  status: SessionStatus;
  notes?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at?: string;
  closed_at?: string | null;
};

export type AttendanceRecord = {
  id: string;
  session_id: string;
  trainee_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  identity_key: string;
  status: RecordStatus;
  method: RecordMethod;
  checked_in_at: string;
  note?: string | null;
};

export const STATUS_LABEL: Record<RecordStatus, { ar: string; en: string; tone: 'ok' | 'warn' | 'info' | 'bad' }> = {
  present: { ar: 'حاضر', en: 'Present', tone: 'ok' },
  late:    { ar: 'متأخر', en: 'Late', tone: 'warn' },
  excused: { ar: 'معتذر', en: 'Excused', tone: 'info' },
  absent:  { ar: 'غائب', en: 'Absent', tone: 'bad' },
};
export const STATUS_ORDER: RecordStatus[] = ['present', 'late', 'excused', 'absent'];

/** رمز رابط من 8 رموز بلا حروف ملتبسة (0/O، 1/I) */
export function makeToken(rand: () => number = Math.random): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += A[Math.floor(rand() * A.length)];
  return s;
}

export function attendUrl(token: string): string {
  const base = (typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || '')).replace(/\/$/, '');
  return `${base}/attend/${token}`;
}

/** نفس منطق دالة SQL attendance_identity_key: بريد ← جوال ← الاسم */
export function identityKey(name: string, email?: string | null, phone?: string | null): string {
  const em = String(email || '').trim().toLowerCase();
  if (em) return 'e:' + em;
  const ph = String(phone || '').replace(/\D/g, '');
  if (ph) return 'p:' + ph.slice(-9);
  return 'n:' + String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** تحويل HH:MM[:SS] إلى دقائق منذ منتصف الليل */
export function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t));
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** حاضر أم متأخر؟ (نفس قاعدة الخادم: بعد البداية + مهلة السماح) */
export function lateStatus(nowHHMM: string, startHHMM: string | null, lateAfterMin: number): 'present' | 'late' {
  const now = toMinutes(nowHHMM); const start = toMinutes(startHHMM);
  if (now == null || start == null) return 'present';
  return now > start + Math.max(0, lateAfterMin || 0) ? 'late' : 'present';
}

export type PersonSummary = {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  present: number;
  late: number;
  excused: number;
  absent: number;
  attended: number;   // present + late
  total: number;      // عدد جلسات البرنامج/النطاق
  effective: number;  // total − excused (الاعتذار لا يُحتسب ضد المتدرب)
  pct: number;        // attended / effective × 100 (مقرّب لعدد صحيح)
};

/**
 * ملخص الحضور لكل شخص عبر مجموعة جلسات.
 * - النسبة = (حاضر + متأخر) ÷ (عدد الجلسات − الاعتذارات)
 * - الشخص الذي لم يسجّل في جلسة ما يُعدّ غائبًا فيها
 */
export function summarize(sessions: Pick<AttendanceSession, 'id'>[], records: Pick<AttendanceRecord, 'session_id' | 'full_name' | 'email' | 'phone' | 'identity_key' | 'status'>[]): PersonSummary[] {
  const sids = new Set(sessions.map(s => s.id));
  const total = sids.size;
  const by = new Map<string, PersonSummary & { seen: Set<string> }>();
  for (const r of records) {
    if (!sids.has(r.session_id)) continue;
    const key = r.identity_key || identityKey(r.full_name, r.email, r.phone);
    let p = by.get(key);
    if (!p) {
      p = { key, name: r.full_name, email: r.email || null, phone: r.phone || null, present: 0, late: 0, excused: 0, absent: 0, attended: 0, total, effective: total, pct: 0, seen: new Set() };
      by.set(key, p);
    }
    if (p.seen.has(r.session_id)) continue; // سجل واحد لكل جلسة
    p.seen.add(r.session_id);
    if (!p.email && r.email) p.email = r.email;
    if (!p.phone && r.phone) p.phone = r.phone;
    p[r.status] += 1;
  }
  const out: PersonSummary[] = [];
  for (const p of by.values()) {
    const { seen, ...rest } = p;
    rest.absent += Math.max(0, total - seen.size); // الجلسات غير المسجّلة = غياب
    rest.attended = rest.present + rest.late;
    rest.effective = Math.max(0, total - rest.excused);
    rest.pct = rest.effective ? Math.round(100 * rest.attended / rest.effective) : 0;
    out.push(rest);
  }
  return out.sort((a, b) => b.pct - a.pct || b.attended - a.attended || a.name.localeCompare(b.name, 'ar'));
}

/** المستوفون لشرط الحضور (للشهادات) */
export function eligible(summary: PersonSummary[], minPct: number): PersonSummary[] {
  const m = Math.min(100, Math.max(0, Number(minPct) || 0));
  return summary.filter(p => p.pct >= m && p.attended > 0);
}

/** صفوف CSV لسجلات جلسة واحدة */
export function sessionCsvRows(session: AttendanceSession, records: AttendanceRecord[], programName: string, classroomCode: string | null): (string | number | null)[][] {
  const head = ['الجلسة', 'البرنامج', 'القاعة', 'التاريخ', 'الاسم', 'البريد', 'الجوال', 'الحالة', 'الطريقة', 'وقت التسجيل'];
  const rows = records.map(r => [session.title, programName, classroomCode || '', session.session_date, r.full_name, r.email || '', r.phone || '', STATUS_LABEL[r.status].ar, r.method, r.checked_in_at ? r.checked_in_at.replace('T', ' ').slice(0, 16) : '']);
  return [head, ...rows];
}

/** صفوف CSV لملخص البرنامج */
export function summaryCsvRows(summary: PersonSummary[], programName: string): (string | number | null)[][] {
  const head = ['البرنامج', 'الاسم', 'البريد', 'الجوال', 'حاضر', 'متأخر', 'معتذر', 'غائب', 'الجلسات', 'نسبة الحضور %'];
  return [head, ...summary.map(p => [programName, p.name, p.email || '', p.phone || '', p.present, p.late, p.excused, p.absent, p.total, p.pct])];
}

/** وقت الرياض الحالي HH:MM */
export function riyadhNowHHMM(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Riyadh' }).format(d);
}
export function riyadhToday(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
