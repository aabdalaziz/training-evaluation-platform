// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * درع أَثَر — الطبقة الثانية (P65): خلاصة تقارير CSP و«هل نحن جاهزون للإلزام؟»
 *  المصدر: أحداث csp_report في portal_security_events (تُجمَع: التوجيه × المصدر المحظور × العدد × آخر مرّة).
 *  الحكم: جاهز للإلزام إذا لم يرد خلال 7 أيام أيّ بلاغ غير مفسَّر (كل ما يتجاوز ضوضاء الإضافات التي تُرشَّح عند الاستقبال يُعدّ غير مفسَّر).
 *  التحويل نفسه = ملف next.config.js بديل (الترويسة Content-Security-Policy بدل Report-Only) — بلا متغيّر جديد.
 */
export type CspEvent = { at: string; meta?: { blocked?: string; directive?: string; document?: string; disposition?: string } | null };
export type CspRow = { directive: string; blocked: string; count: number; last_at: string; first_at: string; documents: string[]; enforced: number };

export const CSP_READY_DAYS = 7;

/** ما نعرف أنه حميد حتى لو مرّ من مرشّح الاستقبال (يُعلَّم «مفسَّر») */
export const KNOWN_BENIGN: { test: (r: { directive: string; blocked: string }) => boolean; why_ar: string }[] = [
  { test: r => /^(chrome|moz|safari|ms-browser)-extension:/i.test(r.blocked), why_ar: 'إضافة متصفح' },
  { test: r => r.blocked === '' && /report-only/i.test(r.directive), why_ar: 'بلاغ فارغ' },
  { test: r => /^https?:\/\/(translate\.googleapis\.com|www\.gstatic\.com\/_\/translate)/i.test(r.blocked), why_ar: 'ترجمة الصفحة في المتصفح' },
];
export const explainBenign = (r: { directive: string; blocked: string }) => KNOWN_BENIGN.find(k => k.test(r))?.why_ar || null;

export function cspSummary(events: CspEvent[]): CspRow[] {
  const m = new Map<string, CspRow>();
  for (const e of events) {
    const directive = String(e.meta?.directive || '').split(' ')[0] || '?'; const blocked = String(e.meta?.blocked || '').replace(/[?#].*$/, '').slice(0, 120);
    const k = directive + '|' + blocked; const row = m.get(k) || { directive, blocked, count: 0, last_at: '', first_at: e.at, documents: [], enforced: 0 };
    row.count += 1; if (e.at > row.last_at) row.last_at = e.at; if (e.at < row.first_at) row.first_at = e.at;
    const doc = String(e.meta?.document || '').replace(/^https?:\/\/[^/]+/, '') || '/'; if (doc && !row.documents.includes(doc) && row.documents.length < 5) row.documents.push(doc);
    if (String(e.meta?.disposition || '') === 'enforce') row.enforced += 1;
    m.set(k, row);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || (a.last_at < b.last_at ? 1 : -1));
}

export type CspVerdict = { ready: boolean; reason_ar: string; window_days: number; unexplained: CspRow[]; explained: (CspRow & { why_ar: string })[]; total_7d: number };

export function cspVerdict(rows: CspRow[], now = Date.now(), days = CSP_READY_DAYS): CspVerdict {
  const since = new Date(now - days * 86400000).toISOString();
  const recent = rows.filter(r => r.last_at >= since);
  const explained: (CspRow & { why_ar: string })[] = []; const unexplained: CspRow[] = [];
  for (const r of recent) { const why = explainBenign(r); if (why) explained.push({ ...r, why_ar: why }); else unexplained.push(r); }
  const total_7d = recent.reduce((s, r) => s + r.count, 0);
  if (unexplained.length === 0) return { ready: true, reason_ar: total_7d ? `لا بلاغ غير مفسَّر خلال ${days} أيام (${total_7d} بلاغًا كلّها ضوضاء معروفة) — يمكن رفع ملف الإلزام.` : `لا بلاغات خلال ${days} أيام — يمكن رفع ملف الإلزام.`, window_days: days, unexplained, explained, total_7d };
  const top = unexplained.slice(0, 3).map(r => `${r.directive} ← ${r.blocked || '(داخلي)'} ×${r.count}`).join(' · ');
  return { ready: false, reason_ar: `${unexplained.length} مصدرًا غير مفسَّر خلال ${days} أيام: ${top}. أضِفه إلى السياسة أو أزل سببه ثم انتظر أسبوعًا نظيفًا.`, window_days: days, unexplained, explained, total_7d };
}

/** خطوات التحويل (تُعرض في اللوحة — لا تُنفَّذ آليًا) */
export const ENFORCE_STEPS_AR = [
  'افتح next.config.js في GitHub واستبدل اسم الترويسة Content-Security-Policy-Report-Only بـ Content-Security-Policy (سطر واحد) مع إبقاء report-uri كما هو.',
  'Commit → انتظر نشر Vercel (دقيقتان) → افتح الصفحة الرئيسية و/me و/admin/management وتأكّد أن كل شيء يعمل.',
  'عُد إلى هذه اللوحة بعد يوم: يجب أن يبقى العدّاد صفرًا. إن ظهر مصدر محظور فعلًا فالرجوع = إعادة الكلمة Report-Only (Commit واحد).',
  'بعد أسبوع نظيف في وضع الإلزام تُسجَّل الخطوة csp_enforce في «يحتاج يدًا بشرية» بأنها أُنجزت.',
];
