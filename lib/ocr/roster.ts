// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P82-ج */
/**
 * «أَثَر يقرأ» — تحويل نصّ OCR (كشف أسماء ورقي · بطاقة عمل · خطاب ترشيح) إلى صفوف قابلة للتصحيح. دوالّ نقيّة بلا DOM.
 *  parseRoster(text)  → RosterRow[]  : سطر = شخص؛ يُستخرج البريد والجوال ورقم الهوية، والباقي اسم. تُهمل العناوين (م · الاسم · التوقيع …) والأسطر بلا حروف.
 *  extractContact(text) → بطاقة عمل: اسم (أوّل سطر حروفٍ بلا أرقام) · بريد · جوال · جهة (سطر فيه «شركة/مؤسسة/وزارة/جامعة…»)
 *  matchName(name, known[]) → أقرب اسم معروف (تطبيع عربي + تشابه رموز/دايس) لربط الصفّ بسجلّ قائم بدل تكراره.
 *  القاعدة الذهبية: الناتج يُعرض في جدول يراجعه المستخدم ويصحّحه قبل أيّ حفظ؛ الصورة لا تغادر الجهاز.
 */
export type RosterRow = { n: number; name: string; email: string | null; phone: string | null; national_id: string | null; raw: string; flags: string[] };
export type Contact = { name: string; email: string | null; phone: string | null; org: string | null; title: string | null };

const HINDI = '٠١٢٣٤٥٦٧٨٩';
export const asciiDigits = (s: string) => String(s || '').replace(/[٠-٩]/g, (d) => String(HINDI.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?966|00966|0)?\s?5\s?\d(?:[\s-]?\d){7}\b/;
const NID_RE = /\b[12]\d{9}\b/;
const HEADER_WORDS = ['الاسم', 'الأسم', 'التوقيع', 'الجوال', 'البريد', 'الرقم', 'الهوية', 'الحضور', 'ملاحظات', 'التاريخ', 'البرنامج', 'الجلسة', 'كشف', 'name', 'phone', 'email', 'signature', 'no.', 'mobile', 'id'];
const ORG_WORDS = ['شركة', 'مؤسسة', 'وزارة', 'جامعة', 'هيئة', 'مجموعة', 'مركز', 'إدارة', 'ادارة', 'بنك', 'مستشفى', 'كلية', 'معهد', 'company', 'ltd', 'llc', 'inc', 'group', 'university', 'ministry', 'bank', 'hospital', 'center', 'centre'];
const TITLE_WORDS = ['مدير', 'مديرة', 'رئيس', 'مسؤول', 'أخصائي', 'اخصائي', 'مستشار', 'مدرب', 'مدرّب', 'منسق', 'منسّق', 'مشرف', 'manager', 'director', 'head', 'specialist', 'consultant', 'trainer', 'coordinator', 'supervisor', 'officer', 'ceo', 'cfo', 'hr'];

/** يطبّع جوالًا سعوديًّا إلى 05XXXXXXXX (أو يعيد الأرقام كما هي إن لم يكن سعوديًّا). */
export function normalizePhone(s: string): string | null {
  let d = asciiDigits(s).replace(/[^\d+]/g, ''); if (!d) return null;
  if (d.startsWith('+966')) d = '0' + d.slice(4); else if (d.startsWith('00966')) d = '0' + d.slice(5); else if (/^966\d{9}$/.test(d)) d = '0' + d.slice(3); else if (/^5\d{8}$/.test(d)) d = '0' + d;
  return /^05\d{8}$/.test(d) ? d : d.length >= 8 ? d : null;
}
const hasLetters = (s: string) => /[\u0621-\u064Aa-zA-Z]/.test(s);
const isHeader = (s: string) => {
  const l = s.toLowerCase(); const toks = l.split(/[\s|،,:]+/);
  const hits = HEADER_WORDS.filter((w) => (/[a-z]/.test(w) ? toks.includes(w) : l.includes(w))).length;
  return hits >= 2 || (hits >= 1 && !EMAIL_RE.test(s) && !/\d{4,}/.test(asciiDigits(s)));
};
/** تنظيف اسم: إزالة الترقيم والتشكيل الزائد وأخطاء OCR الشائعة (| _ ~ •) والفراغات. */
export function cleanName(s: string): string {
  return s.replace(/[\u064B-\u0652\u0640]/g, '').replace(/[|_~•·*#]+/g, ' ').replace(/[()\[\]{}<>«»"':;,،؛.]+/g, ' ').replace(/\s+/g, ' ').trim();
}
const stripSerial = (s: string) => s.replace(/^\s*(?:[\d٠-٩]{1,3}\s*[-.)\]:،]\s*|[-•*]\s*)/, '');

export function parseRoster(text: string): RosterRow[] {
  const rows: RosterRow[] = []; const seen = new Set<string>();
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, ' ').trim(); if (!line || !hasLetters(line) || isHeader(line)) continue;
    let rest = asciiDigits(line); const flags: string[] = [];
    const em = rest.match(EMAIL_RE); const email = em ? em[0].toLowerCase() : null; if (em) rest = rest.replace(em[0], ' ');
    const ph = rest.match(PHONE_RE); const phone = ph ? normalizePhone(ph[0]) : null; if (ph) rest = rest.replace(ph[0], ' ');
    const nid = rest.match(NID_RE); const national_id = nid ? nid[0] : null; if (nid) rest = rest.replace(nid[0], ' ');
    rest = stripSerial(rest).replace(/\b\d{1,3}\b/g, ' '); /* أرقام متبقّية صغيرة (تسلسل/درجة) تُهمل */
    const name = cleanName(rest.replace(/\d{4,}/g, ' ')); if (!name || !hasLetters(name)) { if (email || phone) rows.push({ n: rows.length + 1, name: '', email, phone, national_id, raw: line, flags: ['بلا اسم'] }); continue; }
    if (name.split(' ').length < 2) flags.push('اسم قصير'); if (/\d/.test(name)) flags.push('أرقام في الاسم');
    if (ph && !phone) flags.push('جوال غير مكتمل');
    const key = (email || phone || name).toLowerCase(); if (seen.has(key)) { flags.push('مكرّر'); } seen.add(key);
    rows.push({ n: rows.length + 1, name, email, phone, national_id, raw: line, flags });
  }
  return rows;
}

export function extractContact(text: string): Contact {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean); const all = asciiDigits(lines.join('\n'));
  const em = all.match(EMAIL_RE); const ph = all.match(PHONE_RE);
  let name = ''; let org: string | null = null; let title: string | null = null;
  for (const l of lines) {
    const low = l.toLowerCase(); if (EMAIL_RE.test(l) || /\d{5,}/.test(asciiDigits(l)) || !hasLetters(l) || /www\.|http/.test(low)) continue;
    if (!org && ORG_WORDS.some((w) => low.includes(w))) { org = cleanName(l); continue; }
    if (!title && TITLE_WORDS.some((w) => low.split(/\s+/).some((t) => t === w || t.startsWith(w)))) { title = cleanName(l); continue; }
    if (!name) { const c = cleanName(l); if (c.split(' ').length >= 2 && c.length <= 60) name = c; }
  }
  return { name, email: em ? em[0].toLowerCase() : null, phone: ph ? normalizePhone(ph[0]) : null, org, title };
}

// ====================================================================== مطابقة الأسماء
/** تطبيع عربي للمقارنة: أإآ→ا · ة→ه · ى→ي · حذف التشكيل و«ال» وأل التعريف وبن/بنت وأبجدية صغيرة. */
export function normName(s: string): string {
  return cleanName(String(s || '')).toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .split(' ').map((t) => t.replace(/^(ال|عبد)/, (m) => (m === 'عبد' ? 'عبد' : ''))).filter((t) => t && !['بن', 'بنت', 'ابن', 'د', 'أ', 'م', 'dr', 'mr', 'ms', 'mrs', 'eng'].includes(t)).join(' ');
}
const bigrams = (s: string) => { const g: string[] = []; const t = s.replace(/\s+/g, ' '); for (let i = 0; i < t.length - 1; i++) g.push(t.slice(i, i + 2)); return g; };
/** تشابه دايس على ثنائيّات الحروف + مكافأة تطابق الاسم الأوّل والأخير. 0..1 */
export function nameSimilarity(a: string, b: string): number {
  const x = normName(a), y = normName(b); if (!x || !y) return 0; if (x === y) return 1;
  const ga = bigrams(x), gb = bigrams(y); const set = new Map<string, number>(); for (const g of ga) set.set(g, (set.get(g) || 0) + 1); let inter = 0; for (const g of gb) { const c = set.get(g) || 0; if (c > 0) { inter++; set.set(g, c - 1); } }
  let s = (2 * inter) / (ga.length + gb.length || 1);
  const ta = x.split(' '), tb = y.split(' '); if (ta[0] === tb[0]) s += 0.08; if (ta[ta.length - 1] === tb[tb.length - 1]) s += 0.08; if (ta.length >= 2 && tb.length >= 2 && ta[0] === tb[0] && ta[1] === tb[1]) s += 0.1;
  return Math.min(1, s);
}
export type Known = { id: string; name: string; email?: string | null; phone?: string | null };
export type Match = { id: string; name: string; score: number; by: 'email' | 'phone' | 'name' };
/** يطابق صفًّا بسجلّ معروف: البريد/الجوال تطابق قاطع، وإلا أفضل اسم بعتبة 0.72. */
export function matchRow(row: { name: string; email?: string | null; phone?: string | null }, known: Known[], threshold = 0.72): Match | null {
  const e = (row.email || '').toLowerCase(); const p = row.phone ? normalizePhone(row.phone) : null;
  if (e) { const k = known.find((x) => (x.email || '').toLowerCase() === e); if (k) return { id: k.id, name: k.name, score: 1, by: 'email' }; }
  if (p) { const k = known.find((x) => x.phone && normalizePhone(x.phone) === p); if (k) return { id: k.id, name: k.name, score: 1, by: 'phone' }; }
  let best: Match | null = null; for (const k of known) { const s = nameSimilarity(row.name, k.name); if (s >= threshold && (!best || s > best.score)) best = { id: k.id, name: k.name, score: s, by: 'name' }; }
  return best;
}
