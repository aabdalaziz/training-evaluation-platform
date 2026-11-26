// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P82 */
/**
 * «أَثَر يقرأ» — تفسير ما تلتقطه الكاميرا (نصّ QR/باركود أو نصّ OCR) إلى معنى يفهمه النظام. دوالّ نقيّة بلا DOM.
 *  parseScan(raw, site?) → ScanHit:
 *   verify   : رابط /verify/<code> أو /credential/<code> أو رقم تسلسلي ATH-YYYY-NNNNNN أو رمز تحقّق من 10 رموز
 *   attend   : رابط /attend/<token>           → صفحة تسجيل الحضور
 *   permit   : رابط /gate/p/<code>            → تصريح دخول (P79)
 *   pass     : «بطاقة أَثَر الرقمية» ATHAR1.<payload>.<sig> → تُحلّ على الخادم (/api/reader/card)
 *   mrz      : شريط MRZ (TD1: 3 أسطر × 30 — الهوية الوطنية/الإقامة؛ TD3: سطران × 44 — الجواز) مع فحص أرقام التحقّق
 *   iban     : IBAN سعودي/دولي صحيح (MOD-97)
 *   url/text : غير ذلك
 *  القاعدة الذهبية: كلّ ما يُقرأ يُعرض للمستخدم ليؤكّده قبل أيّ حفظ — هذه الوحدة لا تحفظ شيئًا.
 */
export type ScanKind = 'verify' | 'attend' | 'permit' | 'pass' | 'mrz' | 'iban' | 'url' | 'text';
export type Mrz = { doc_type: string; issuer: string; number: string; nationality: string; birth: string | null; expiry: string | null; sex: 'M' | 'F' | null; surname: string; given: string; valid: boolean; checks: Record<string, boolean> };
export type ScanHit = { kind: ScanKind; raw: string; code?: string; href?: string; mrz?: Mrz; iban?: string; label_ar: string };

const clean = (s: string) => String(s || '').replace(/\u0000/g, '').trim();

/** يستخرج المسار إن كان النصّ رابطًا (على الموقع نفسه أو أيّ موقع). */
function pathOf(raw: string): { path: string; origin: string } | null {
  try { const u = new URL(raw); if (!/^https?:$/.test(u.protocol)) return null; return { path: u.pathname.replace(/\/+$/, ''), origin: u.origin }; } catch { return null; }
}

export function parseScan(input: string, site?: string): ScanHit {
  const raw = clean(input);
  if (!raw) return { kind: 'text', raw, label_ar: 'لا شيء' };

  // 1) بطاقة أَثَر الرقمية
  if (/^ATHAR1\.[A-Za-z0-9_-]{8,400}\.[A-Za-z0-9_-]{8,64}$/.test(raw)) return { kind: 'pass', raw, code: raw, label_ar: 'بطاقة أَثَر الرقمية' };

  // 2) روابط أَثَر
  const u = pathOf(raw);
  if (u) {
    const m1 = u.path.match(/^\/(verify|credential|v)\/([A-Za-z0-9][A-Za-z0-9_-]{2,80})$/i); if (m1) return { kind: 'verify', raw, code: decodeURIComponent(m1[2]), href: `/verify/${encodeURIComponent(decodeURIComponent(m1[2]))}`, label_ar: 'شهادة / اعتماد أَثَر' };
    const m2 = u.path.match(/^\/attend\/([A-Za-z0-9_-]{6,120})$/i); if (m2) return { kind: 'attend', raw, code: m2[1], href: `/attend/${m2[1]}`, label_ar: 'جلسة حضور' };
    const m3 = u.path.match(/^\/gate\/p\/([A-Za-z0-9-]{4,60})$/i); if (m3) return { kind: 'permit', raw, code: m3[1], href: `/gate/p/${m3[1]}`, label_ar: 'تصريح دخول' };
    const same = site ? u.origin.replace(/\/$/, '') === site.replace(/\/$/, '') : false;
    return { kind: 'url', raw, href: same ? u.path || '/' : raw, label_ar: same ? 'صفحة في أَثَر' : 'رابط خارجي' };
  }

  // 3) أرقام الشهادات ورموز التحقّق
  if (/^ATH-\d{4}-\d{4,8}$/i.test(raw)) return { kind: 'verify', raw, code: raw.toUpperCase(), href: `/verify/${raw.toUpperCase()}`, label_ar: 'رقم شهادة أَثَر' };
  if (/^[A-HJ-NP-Z2-9]{10}$/.test(raw)) return { kind: 'verify', raw, code: raw, href: `/verify/${raw}`, label_ar: 'رمز تحقّق' };

  // 4) IBAN
  const ib = normalizeIban(raw); if (ib && ibanValid(ib)) return { kind: 'iban', raw, iban: ib, label_ar: ib.startsWith('SA') ? 'IBAN سعودي' : 'IBAN' };

  // 5) MRZ
  const mrz = parseMrz(raw); if (mrz) return { kind: 'mrz', raw, mrz, label_ar: mrz.doc_type.startsWith('P') ? 'شريط جواز سفر' : 'شريط هوية/إقامة' };

  return { kind: 'text', raw, label_ar: 'نصّ' };
}

// ====================================================================== IBAN (MOD-97)
export function normalizeIban(s: string): string | null { const t = String(s || '').replace(/[\s-]/g, '').toUpperCase(); return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(t) ? t : null; }
const IBAN_LEN: Record<string, number> = { SA: 24, AE: 23, KW: 30, QA: 29, BH: 22, OM: 23, EG: 29, JO: 30, GB: 22, DE: 22, FR: 27, TR: 26, MA: 28, TN: 24 };
export function ibanValid(iban: string): boolean {
  const t = normalizeIban(iban); if (!t) return false; const want = IBAN_LEN[t.slice(0, 2)]; if (want && t.length !== want) return false;
  const moved = t.slice(4) + t.slice(0, 4); let rem = 0;
  for (const ch of moved) { const v = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch; for (const d of v) rem = (rem * 10 + (d.charCodeAt(0) - 48)) % 97; }
  return rem === 1;
}
/** يعرض IBAN مجموعات من 4 للقراءة. */
export const fmtIban = (iban: string) => (normalizeIban(iban) || iban).replace(/(.{4})/g, '$1 ').trim();

// ====================================================================== MRZ (ICAO 9303)
const MRZ_W = [7, 3, 1];
const mrzVal = (c: string) => (c === '<' ? 0 : c >= 'A' && c <= 'Z' ? c.charCodeAt(0) - 55 : c >= '0' && c <= '9' ? c.charCodeAt(0) - 48 : -1);
/** رقم التحقّق 7-3-1؛ يعيد -1 إن احتوى النصّ رمزًا غير مسموح. */
export function mrzCheck(s: string): number { let sum = 0; for (let i = 0; i < s.length; i++) { const v = mrzVal(s[i]); if (v < 0) return -1; sum += v * MRZ_W[i % 3]; } return sum % 10; }
const chk = (field: string, digit: string) => /\d/.test(digit) && mrzCheck(field) === Number(digit);
const ymd = (s: string, kind: 'birth' | 'expiry'): string | null => {
  if (!/^\d{6}$/.test(s)) return null; const yy = Number(s.slice(0, 2)), mm = s.slice(2, 4), dd = s.slice(4, 6); if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  const nowYY = new Date().getUTCFullYear() % 100; const century = kind === 'birth' ? (yy > nowYY ? 1900 : 2000) : (yy < 50 ? 2000 : 1900); return `${century + yy}-${mm}-${dd}`;
};
const names = (line: string) => { const [sur = '', giv = ''] = line.split('<<'); const fix = (x: string) => x.replace(/</g, ' ').replace(/\s+/g, ' ').trim(); return { surname: fix(sur), given: fix(giv) }; };
const sexOf = (c: string): 'M' | 'F' | null => (c === 'M' ? 'M' : c === 'F' ? 'F' : null);

/** يقبل نصًّا من OCR/باركود: يطبّع (O→0 في الحقول الرقمية لا يُجرى هنا) ويكتشف TD1 (3×30) أو TD3 (2×44). */
export function parseMrz(text: string): Mrz | null {
  const lines = String(text || '').toUpperCase().split(/[\r\n]+/).map((l) => l.replace(/[^A-Z0-9<]/g, '')).filter((l) => l.length >= 28);
  if (lines.length >= 3) { const td1 = lines.slice(-3).map((l) => l.padEnd(30, '<').slice(0, 30)); if (/^[A-Z<]/.test(td1[0]) && /^\d{7}[MF<]\d{7}/.test(td1[1])) return parseTd1(td1); }
  if (lines.length >= 2) { const td3 = lines.slice(-2).map((l) => l.padEnd(44, '<').slice(0, 44)); if (td3[0].startsWith('P') && /^[A-Z0-9<]{9}\d[A-Z<]{3}\d{7}[MF<]\d{7}/.test(td3[1])) return parseTd3(td3); }
  return null;
}
function parseTd1([l1, l2, l3]: string[]): Mrz {
  const number = l1.slice(5, 14).replace(/</g, ''); const checks: Record<string, boolean> = {
    number: chk(l1.slice(5, 14), l1[14]), birth: chk(l2.slice(0, 6), l2[6]), expiry: chk(l2.slice(8, 14), l2[14]),
    composite: chk(l1.slice(5, 30) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29), l2[29]),
  };
  return { doc_type: l1.slice(0, 2).replace(/</g, ''), issuer: l1.slice(2, 5).replace(/</g, ''), number, nationality: l2.slice(15, 18).replace(/</g, ''), birth: ymd(l2.slice(0, 6), 'birth'), expiry: ymd(l2.slice(8, 14), 'expiry'), sex: sexOf(l2[7]), ...names(l3), valid: Object.values(checks).every(Boolean), checks };
}
function parseTd3([l1, l2]: string[]): Mrz {
  const checks: Record<string, boolean> = { number: chk(l2.slice(0, 9), l2[9]), birth: chk(l2.slice(13, 19), l2[19]), expiry: chk(l2.slice(21, 27), l2[27]), composite: chk(l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43), l2[43]) };
  return { doc_type: l1.slice(0, 2).replace(/</g, ''), issuer: l1.slice(2, 5).replace(/</g, ''), number: l2.slice(0, 9).replace(/</g, ''), nationality: l2.slice(10, 13).replace(/</g, ''), birth: ymd(l2.slice(13, 19), 'birth'), expiry: ymd(l2.slice(21, 27), 'expiry'), sex: sexOf(l2[20]), ...names(l1.slice(5)), valid: Object.values(checks).every(Boolean), checks };
}

/** ملخّص عربي لنتيجة MRZ يُعرض للتأكيد (لا يُخزَّن شيء تلقائيًّا). */
export function mrzSummaryAr(m: Mrz): { k: string; v: string }[] {
  return [
    { k: 'الاسم (لاتيني)', v: `${m.given} ${m.surname}`.trim() }, { k: 'رقم الوثيقة', v: m.number }, { k: 'الجنسية', v: m.nationality }, { k: 'تاريخ الميلاد', v: m.birth || '—' },
    { k: 'الانتهاء', v: m.expiry || '—' }, { k: 'الجنس', v: m.sex === 'M' ? 'ذكر' : m.sex === 'F' ? 'أنثى' : '—' }, { k: 'أرقام التحقّق', v: m.valid ? 'صحيحة ✓' : 'غير مطابقة — راجع القراءة' },
  ];
}
