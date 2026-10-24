/** منطق Webhook لـ Moyasar (قابل للاختبار بلا شبكة) */
export type MoyasarEvent = { id?: string; type?: string; secret_token?: string; live?: boolean; data?: { id?: string; status?: string; amount?: number; currency?: string; metadata?: Record<string, string> } };

/** مقارنة ثابتة الزمن للسر المشترك */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0;
}

/** الأحداث التي نتصرف حيالها → الحالة المستهدفة للفاتورة */
export function eventAction(type: string | undefined): 'paid' | 'refunded' | 'ignore' {
  if (type === 'payment_paid' || type === 'payment_captured') return 'paid';
  if (type === 'payment_refunded') return 'refunded';
  return 'ignore';
}

/** استخراج معرّف الفاتورة من بيانات الدفع (metadata.invoice_id أولًا) */
export function invoiceIdFrom(ev: MoyasarEvent): string | null {
  const m = ev.data?.metadata || {}; const id = m.invoice_id || (m as any).invoiceId || null;
  return id && /^[0-9a-f-]{36}$/i.test(String(id)) ? String(id) : null;
}
