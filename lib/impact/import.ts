/**
 * استيراد أداة قياس جاهزة من نص/CSV (Word/Excel تُحوَّل إلى نص أو صفوف أولًا عبر office.ts)
 * Parsing heuristics for Arabic/English instruments + answer keys. Pure functions, no deps.
 */
import type { ImpactQuestion, McqOption } from './model';

export type DraftQuestion = Omit<ImpactQuestion, 'id'>;
export type ParseResult = { questions: DraftQuestion[]; warnings: string[]; domains: string[] };

/* ----------------------------------------------------------------------------
 * تطبيع الحروف/الأرقام
 * ------------------------------------------------------------------------- */
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export function normalizeDigits(s: string): string { return s.replace(/[٠-٩]/g, d => String(AR_DIGITS.indexOf(d))); }

/** أ/ب/ج/د أو A/B/C/D أو 1/2/3/4 → a/b/c/d */
export function letterToKey(raw: string): string | null {
  const t = normalizeDigits(raw).trim().replace(/[.)\-:ـ\s]/g, '').toLowerCase();
  const map: Record<string, string> = { 'أ': 'a', 'ا': 'a', 'ب': 'b', 'ج': 'c', 'د': 'd', 'هـ': 'e', 'ه': 'e', a: 'a', b: 'b', c: 'c', d: 'd', e: 'e', '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e' };
  return map[t] || null;
}
export const KEY_AR: Record<string, string> = { a: 'أ', b: 'ب', c: 'ج', d: 'د', e: 'هـ' };

const clean = (s: string) => s.replace(/\u200f|\u200e|\ufeff/g, '').replace(/\s+/g, ' ').trim();

/** يكتشف سطر سؤال مرقّم: "1." "1)" "1-" "س1" "Q1" */
const Q_RE = /^(?:س|q|question)?\s*(\d{1,3})\s*[).\-–:ـ]\s*(.+)$/i;
/** يكتشف سطر بديل: "أ." "أ)" "ب-" "a." "A)" "( أ )" "□ أ" "○" "-" "•" */
const OPT_RE = /^(?:[□☐○◯•▪\-–*]\s*)?[(\[]?\s*([أابجدهa-eA-E]|هـ)\s*[)\].\-–:ـ]\s*(.+)$/;
const BULLET_RE = /^[•▪\-–*]\s+(.+)$/;
const DOMAIN_RE = /^(?:#+\s*)?(?:المحور|المجال|البعد|القسم|محور|مجال|بعد|domain|section|axis)\s*(?:\d+|[:\-–])?\s*[:\-–]?\s*(.+)$/i;
const CORRECT_MARK_RE = /(\*|✓|✔|√|\(\s*صح(?:يح)?\s*\)|\(\s*correct\s*\)|\[\s*صح(?:يح)?\s*\])/i;
const TF_RE = /^(صح(?:يح)?|خطأ|true|false)$/i;

/** تحويل نص أداة إلى بنود */
export function parseInstrumentText(text: string): ParseResult {
  const warnings: string[] = []; const qs: DraftQuestion[] = [];
  let domain = 'عام'; const domains = new Set<string>();
  let cur: DraftQuestion | null = null;
  // البدائل المصفوفة أفقيًا (خلايا جدول/تبويبات أو مسافات متعددة قبل أ. ب. ج. د.) تُفصل إلى أسطر
  const lines = normalizeDigits(text).split(/\r?\n/)
    .flatMap(l => l.split(/\t+|\s{2,}(?=(?:[أابجد]|هـ|[a-eA-E])\s*[).\-–])/))
    .map(clean).filter(Boolean);

  const push = () => { if (cur) { finalize(cur, warnings); qs.push(cur); cur = null; } };

  for (const line of lines) {
    const dm = line.match(DOMAIN_RE);
    if (dm && !Q_RE.test(line)) { push(); domain = clean(dm[1]) || 'عام'; domains.add(domain); continue; }
    const qm = line.match(Q_RE);
    if (qm) {
      push();
      let textQ = clean(qm[2]); let kind: 'scale' | 'mcq' = 'scale';
      const tag = textQ.match(/\[(مقياس|اختيار|معرفي|scale|mcq|صح\/خطأ|tf)\]/i);
      if (tag) { kind = /مقياس|scale/i.test(tag[1]) ? 'scale' : 'mcq'; textQ = clean(textQ.replace(tag[0], '')); }
      cur = { order_no: qs.length + 1, kind, domain_ar: domain, text_ar: textQ, text_en: null, options: [], correct_key: null, weight: 1 };
      continue;
    }
    const om = line.match(OPT_RE);
    if (om && cur) {
      const k = letterToKey(om[1]); let body = clean(om[2]); let correct = false;
      if (CORRECT_MARK_RE.test(body)) { correct = true; body = clean(body.replace(CORRECT_MARK_RE, '')); }
      if (k) { cur.kind = 'mcq'; cur.options.push({ k, ar: body }); if (correct) cur.correct_key = k; }
      continue;
    }
    const bm = line.match(BULLET_RE);
    if (bm && cur) {
      let body = clean(bm[1]); let correct = false;
      if (CORRECT_MARK_RE.test(body)) { correct = true; body = clean(body.replace(CORRECT_MARK_RE, '')); }
      const k = 'abcde'[cur.options.length] || null;
      if (k) { cur.kind = 'mcq'; cur.options.push({ k, ar: body }); if (correct) cur.correct_key = k; }
      continue;
    }
    // سطر حر: امتداد لنص السؤال أو عنوان محور قصير
    if (cur && !cur.options.length && line.length < 400) { cur.text_ar = clean(`${cur.text_ar} ${line}`); continue; }
    if (!cur && line.length <= 40 && !/[.؟?]$/.test(line)) { domain = line; domains.add(domain); continue; }
  }
  push();
  if (!qs.length) warnings.push('لم يتم التعرف على أي بند. تأكد أن الأسئلة مرقّمة (1. / 1) / س1) وأن البدائل تبدأ بـ أ. ب. ج. د.');
  return { questions: qs, warnings, domains: Array.from(domains) };
}

function finalize(q: DraftQuestion, warnings: string[]) {
  q.text_ar = q.text_ar.replace(/[:：]\s*$/, '').trim();
  if (q.kind === 'mcq') {
    // صح/خطأ
    if (q.options.length === 2 && q.options.every(o => TF_RE.test(o.ar))) { /* keep as 2-option mcq */ }
    else if (q.options.length < 2) { warnings.push(`السؤال ${q.order_no}: أقل من بديلين — حُوِّل إلى بند مقياس.`); q.kind = 'scale'; q.options = []; q.correct_key = null; }
    else if (q.options.length !== 4) warnings.push(`السؤال ${q.order_no}: عدد البدائل ${q.options.length} (المعيار 4).`);
    // إعادة ترقيم المفاتيح a..e حسب الترتيب الفعلي
    q.options = q.options.map((o, i) => ({ ...o, k: 'abcde'[i] }));
  }
}

/* ----------------------------------------------------------------------------
 * نموذج الإجابة
 *   "1-ب 2-أ 3-د"  |  "1. ب"  |  "1,b"  |  "1: ج"  |  "س1 ب"
 * ------------------------------------------------------------------------- */
export function parseAnswerKey(text: string): Record<number, string> {
  const out: Record<number, string> = {};
  const t = normalizeDigits(text).replace(/\u200f|\u200e|\ufeff/g, '');
  const re = /(?:س|q)?\s*(\d{1,3})\s*[).\-–:=,\t ]+\s*(هـ|[أابجدهa-eA-E1-5])(?![\u0621-\u064Aa-z])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) { const k = letterToKey(m[2]); if (k) out[Number(m[1])] = k; }
  return out;
}

export function applyAnswerKey(qs: DraftQuestion[], key: Record<number, string>): { applied: number; missing: number[] } {
  let applied = 0; const missing: number[] = [];
  qs.forEach(q => {
    if (q.kind !== 'mcq') return;
    const k = key[q.order_no];
    if (k && q.options.some(o => o.k === k)) { q.correct_key = k; applied++; }
    else if (!q.correct_key) missing.push(q.order_no);
  });
  return { applied, missing };
}

/* ----------------------------------------------------------------------------
 * CSV / صفوف جدول (Excel)
 *   الأعمدة المتوقعة (الترتيب مرن إن وُجد صف عناوين): المحور | النوع | السؤال | أ | ب | ج | د | الإجابة
 * ------------------------------------------------------------------------- */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  const s = text.replace(/^\ufeff/, '');
  const delim = (s.split('\n')[0].match(/;/g) || []).length > (s.split('\n')[0].match(/,/g) || []).length ? ';' : (s.includes('\t') ? '\t' : ',');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

const H = (s: string) => clean(s).toLowerCase();
export function parseRows(rows: string[][]): ParseResult {
  const warnings: string[] = []; const qs: DraftQuestion[] = []; const domains = new Set<string>();
  if (!rows.length) return { questions: [], warnings: ['الملف فارغ.'], domains: [] };
  // اكتشاف صف العناوين
  const head = rows[0].map(H);
  const idx = (names: string[], fallback: number) => { const i = head.findIndex(h => names.some(n => h.includes(n))); return i >= 0 ? i : fallback; };
  const hasHeader = head.some(h => /سؤال|question|نص|البند|item/.test(h));
  const ci = hasHeader ? { domain: idx(['محور', 'مجال', 'domain', 'axis', 'section'], -1), kind: idx(['نوع', 'type', 'kind'], -1), text: idx(['سؤال', 'question', 'نص', 'بند', 'item'], 0), a: idx(['أ', 'a', 'خيار1', 'option1', 'البديل1'], -1), b: idx(['ب', 'b', 'خيار2', 'option2'], -1), c: idx(['ج', 'c', 'خيار3', 'option3'], -1), d: idx(['د', 'd', 'خيار4', 'option4'], -1), e: idx(['هـ', 'e', 'خيار5'], -1), ans: idx(['إجابة', 'اجابة', 'الصحيح', 'answer', 'key', 'correct'], -1), en: idx(['english', 'إنجليزي', 'text_en'], -1) }
    : { domain: 0, kind: 1, text: 2, a: 3, b: 4, c: 5, d: 6, e: -1, ans: 7, en: -1 };
  // ملف بسيط: عمود واحد = نص فقط
  const simple = !hasHeader && rows.every(r => r.filter(x => x.trim()).length <= 2);
  const body = hasHeader ? rows.slice(1) : rows;
  let domain = 'عام';
  body.forEach(r => {
    const get = (i: number) => (i >= 0 && i < r.length ? clean(r[i]) : '');
    const text = simple ? clean(r.find(x => x.trim()) || '') : get(ci.text);
    if (!text) return;
    const d = simple ? '' : get(ci.domain); if (d) { domain = d; }
    domains.add(domain);
    const kindRaw = simple ? '' : get(ci.kind).toLowerCase();
    const opts: McqOption[] = (['a', 'b', 'c', 'd', 'e'] as const).map(k => ({ k, ar: get((ci as any)[k]) })).filter(o => o.ar);
    let kind: 'scale' | 'mcq' = opts.length >= 2 || /اختيار|معرفي|mcq|choice|صح/.test(kindRaw) ? 'mcq' : 'scale';
    if (/مقياس|scale|likert/.test(kindRaw)) kind = 'scale';
    const q: DraftQuestion = { order_no: qs.length + 1, kind, domain_ar: domain, text_ar: text.replace(/^\d{1,3}\s*[).\-–:]\s*/, ''), text_en: get(ci.en) || null, options: kind === 'mcq' ? opts : [], correct_key: null, weight: 1 };
    if (kind === 'mcq') { const k = letterToKey(get(ci.ans)); if (k && opts.some(o => o.k === k)) q.correct_key = k; }
    finalize(q, warnings); qs.push(q);
  });
  if (!qs.length) warnings.push('لم يتم العثور على أسئلة في الجدول. استخدم القالب: المحور | النوع | السؤال | أ | ب | ج | د | الإجابة');
  return { questions: qs, warnings, domains: Array.from(domains) };
}

/** قالب CSV (يفتح في Excel) */
export function csvTemplate(): string {
  const rows = [
    ['المحور', 'النوع', 'السؤال', 'أ', 'ب', 'ج', 'د', 'الإجابة الصحيحة'],
    ['المعرفة', 'اختيار', 'ما المقصود بـ…؟', 'البديل الأول', 'البديل الثاني', 'البديل الثالث', 'البديل الرابع', 'ب'],
    ['المعرفة', 'صح/خطأ', 'العبارة التالية صحيحة: …', 'صحيح', 'خطأ', '', '', 'أ'],
    ['المهارة', 'مقياس', 'أستطيع تطبيق … دون مساعدة', '', '', '', '', ''],
    ['الاتجاه', 'مقياس', 'أشعر بالثقة عند …', '', '', '', '', ''],
  ];
  return '\ufeff' + rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

/** تدقيق نهائي قبل الحفظ */
export function validateQuestions(qs: DraftQuestion[]): string[] {
  const errs: string[] = [];
  qs.forEach(q => {
    if (!q.text_ar.trim()) errs.push(`البند ${q.order_no}: النص فارغ.`);
    if (q.kind === 'mcq') {
      if (q.options.filter(o => o.ar.trim()).length < 2) errs.push(`السؤال ${q.order_no}: يحتاج بديلين على الأقل.`);
      if (!q.correct_key) errs.push(`السؤال ${q.order_no}: لم تُحدَّد الإجابة الصحيحة.`);
    }
  });
  return errs;
}
