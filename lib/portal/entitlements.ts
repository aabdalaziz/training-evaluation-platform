// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * هـ-1/3 — مقاعد الخدمات (service seats): الطبقة المشتركة بين API اقْرَأْ وشاشة الدخول والإدارة.
 * الحقيقة في قاعدة البيانات (service_plans / service_entitlements / portal_invoices.service)؛ هنا الحساب الخالص + قارئات صغيرة.
 * حالة الدخول (seat state) تُحسب من ثلاثة أسئلة: هل دخل؟ هل له مستوى معتمد من مِعيار؟ هل له مقعد سارٍ؟
 */
export type Service = 'iqra';
export type PlanCode = 'trial' | 'month' | 'quarter' | 'year' | 'staff' | string;
export type Plan = { service: string; code: string; name_ar: string; blurb_ar: string; days: number; price: number; sort: number; active: boolean };
export type Seat = { id: string; service: string; learner_email: string; plan_code: string; source: string; starts_at: string; ends_at: string; invoice_id?: string | null; note?: string | null };

/** حالات باب اقْرَأْ — بالترتيب الذي يمرّ به المتعلّم */
export type SeatState = 'guest' | 'noLevel' | 'pendingLevel' | 'noSeat' | 'paying' | 'active' | 'expired';
export type SeatView = {
  state: SeatState; level: string | null; seat: Seat | null; days_left: number; trial_used: boolean; trial_available: boolean;
  pending_invoice_id: string | null; plans: Plan[];
};

export const DAY = 86_400_000;
export const daysLeft = (ends_at: string | null | undefined, now = Date.now()): number => { if (!ends_at) return 0; const t = Date.parse(ends_at); return isFinite(t) ? Math.max(0, Math.ceil((t - now) / DAY)) : 0; };
export const isActive = (s: Pick<Seat, 'starts_at' | 'ends_at'> | null | undefined, now = Date.now()) => !!s && Date.parse(s.starts_at) <= now && Date.parse(s.ends_at) > now;
/** أطول مقعد سارٍ الآن (أو null) */
export function currentSeat(seats: Seat[], now = Date.now()): Seat | null { return seats.filter((s) => isActive(s, now)).sort((a, b) => Date.parse(b.ends_at) - Date.parse(a.ends_at))[0] || null; }
/** آخر مقعد انتهى (لرسالة «انتهى اشتراكك في …») */
export function lastSeat(seats: Seat[]): Seat | null { return [...seats].sort((a, b) => Date.parse(b.ends_at) - Date.parse(a.ends_at))[0] || null; }

export function seatState(a: { signedIn: boolean; level: string | null | 'pending'; seats: Seat[]; pendingInvoice?: boolean; now?: number }): SeatState {
  if (!a.signedIn) return 'guest';
  if (!a.level) return 'noLevel';
  if (a.level === 'pending') return 'pendingLevel';
  const now = a.now ?? Date.now();
  if (currentSeat(a.seats, now)) return 'active';
  if (a.pendingInvoice) return 'paying';
  return a.seats.length ? 'expired' : 'noSeat';
}

/** سعر العرض: الخطّة بحسب إعدادات الضريبة — نفس معادلة portal_issue_invoice */
export function planTotals(price: number, vatRate: number, pricesIncludeVat: boolean): { subtotal: number; vat: number; total: number } {
  const r2 = (x: number) => Math.round(x * 100) / 100;
  if (pricesIncludeVat) { const total = r2(price); const subtotal = r2(price / (1 + vatRate / 100)); return { subtotal, vat: r2(total - subtotal), total }; }
  const subtotal = r2(price); const vat = r2(price * vatRate / 100); return { subtotal, vat, total: r2(subtotal + vat) };
}
/** سعر اليوم الواحد لمقارنة الخطط («يوفّر ٣٣٪») */
export function perDay(p: Pick<Plan, 'price' | 'days'>): number { return p.days > 0 ? p.price / p.days : 0; }
export function savingsPct(p: Pick<Plan, 'price' | 'days'>, base: Pick<Plan, 'price' | 'days'> | null | undefined): number {
  if (!base || perDay(base) <= 0 || perDay(p) <= 0) return 0; return Math.max(0, Math.round((1 - perDay(p) / perDay(base)) * 100));
}
export const PAID = (plans: Plan[]) => plans.filter((p) => p.active && p.price > 0).sort((a, b) => a.sort - b.sort);
export const TRIAL = (plans: Plan[]) => plans.find((p) => p.code === 'trial' && p.active) || null;

/** نسخ الشاشة بالعربية — من المعجم المعتمد فقط */
export const SEAT_COPY: Record<SeatState, { title: string; body: string; cta?: string; href?: string }> = {
  guest: { title: 'اقْرَأْ — تعلّم العربية على مستواك', body: 'ادخل بحساب أَثَر أو برمز نتيجة مِعيار، ثم نفتح لك مستواك.', cta: 'تسجيل الدخول', href: '/login?next=/iqra/start' },
  noLevel: { title: 'ابدأ بمعرفة مستواك', body: 'اقْرَأْ يفتح على المستوى الذي يحدّده مِعيار — قيّم نفسك في دقائق، وتُسكَّن في مستواك.', cta: 'قيّم نفسك — 3 دقائق', href: '/miaar' },
  pendingLevel: { title: 'نتيجتك قيد الاعتماد', body: 'أنهيتَ مِعيار، وقرار التسكين ينتظر اعتماد الخبير المُصدِّق. سنفتح مستواك فور الاعتماد.', href: '/me' },
  noSeat: { title: 'مستواك جاهز — اختر مقعدك', body: 'جرّب سبعة أيام مجّانًا بلا بطاقة، أو اختر خطّة تناسب رحلتك.' },
  paying: { title: 'فاتورتك بانتظار السداد', body: 'أصدرنا فاتورتك؛ أكمل الدفع بالبطاقة أو التحويل، ويُفتح مقعدك فور التأكيد.', cta: 'إكمال الدفع' },
  active: { title: 'مقعدك سارٍ', body: 'ادخل إلى حلقاتك ومراجعاتك ودفترك.', cta: 'ادخل إلى اقْرَأْ', href: '/iqra' },
  expired: { title: 'انتهى مقعدك — نكمل من حيث توقّفت', body: 'تقدّمك ودفترك محفوظان؛ جدّد مقعدك ليفتح مستواك من جديد.' },
};

/* ---------- قارئات قاعدة البيانات (خادم؛ service role) ---------- */
type Db = { from: (t: string) => any; rpc: (fn: string, args?: any) => any };
export async function seatsOf(db: Db, service: Service, email: string): Promise<Seat[]> {
  const { data } = await db.from('service_entitlements').select('id, service, learner_email, plan_code, source, starts_at, ends_at, invoice_id, note').eq('service', service).eq('learner_email', email.toLowerCase()).order('ends_at', { ascending: false }).limit(50);
  return (data || []) as Seat[];
}
export async function plansOf(db: Db, service: Service): Promise<Plan[]> {
  const { data } = await db.from('service_plans').select('service, code, name_ar, blurb_ar, days, price, sort, active').eq('service', service).eq('active', true).order('sort');
  return ((data || []) as any[]).map((p) => ({ ...p, days: Number(p.days), price: Number(p.price), sort: Number(p.sort) })) as Plan[];
}
export async function pendingServiceInvoice(db: Db, service: Service, userId: string): Promise<string | null> {
  const { data } = await db.from('portal_invoices').select('id').eq('user_id', userId).eq('service', service).in('status', ['unpaid', 'under_review']).order('created_at', { ascending: false }).limit(1);
  const r = Array.isArray(data) && data[0]; return r ? String(r.id) : null;
}
/** الطاقم يدخل دون مقعد (التأليف والمراجعة) */
export const SEAT_FREE_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'ITEM_AUTHOR', 'QUALITY_ANALYST', 'RATER', 'TEACHER', 'INSTRUCTOR'];
