// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P82-ب */
/**
 * «قُل بدل أن تكتب» — تحويل ما يُملى بالصوت إلى قيمة حقل. دوالّ نقيّة بلا DOM (الاستماع نفسه في app/components/Dictate.tsx).
 *  fromSpeech(kind, text): name → تنظيف · phone → أرقام (كلمات عربية/هندية → 0-9، «زائد» → +) · email → @ و . والنطاقات الشائعة · number → رقم · text → كما هو
 *  القاعدة الذهبية: ما يُسمع يُعرض للمستخدم ليؤكّده قبل الحفظ — هذه الوحدة لا تحفظ شيئًا، ولا يُخزَّن أيّ تسجيل.
 */
export type FieldKind = 'text' | 'name' | 'phone' | 'email' | 'number';

const WORD_DIGITS: Record<string, string> = {
  'صفر': '0', 'زيرو': '0', 'واحد': '1', 'واحده': '1', 'واحدة': '1', 'اثنين': '2', 'اثنان': '2', 'إثنين': '2', 'اتنين': '2', 'ثلاثة': '3', 'ثلاثه': '3', 'تلاتة': '3', 'أربعة': '4', 'اربعة': '4', 'أربعه': '4', 'اربعه': '4',
  'خمسة': '5', 'خمسه': '5', 'ستة': '6', 'سته': '6', 'سبعة': '7', 'سبعه': '7', 'ثمانية': '8', 'ثمانيه': '8', 'تمانية': '8', 'تسعة': '9', 'تسعه': '9',
  'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'oh': '0',
};
const DOUBLE: Record<string, number> = { 'مرتين': 2, 'مرّتين': 2, 'ثلاث': 3, 'ثلاثاً': 3, 'ثلاثا': 3 };
const DOMAINS: Record<string, string> = { 'جيميل': 'gmail', 'جي ميل': 'gmail', 'قوقل': 'gmail', 'هوتميل': 'hotmail', 'ياهو': 'yahoo', 'آوتلوك': 'outlook', 'اوتلوك': 'outlook', 'آي كلاود': 'icloud', 'اي كلاود': 'icloud' };

/** أرقام هندية → عربية (0-9). */
export const toAsciiDigits = (s: string) => String(s || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const stripTashkeel = (s: string) => s.replace(/[\u064B-\u0652\u0640]/g, '');
const norm = (s: string) => stripTashkeel(toAsciiDigits(String(s || ''))).replace(/\s+/g, ' ').trim();

/** يحوّل كلمات الأرقام في النصّ إلى أرقام مع دعم «خمسة مرتين» → 55. يعيد النصّ بالأرقام والكلمات غير الرقمية كما هي. */
export function wordsToDigits(text: string): string {
  const out: string[] = []; const toks = norm(text).toLowerCase().split(' ');
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i].replace(/[،,.]/g, ''); const d = WORD_DIGITS[w];
    if (d !== undefined) { const rep = DOUBLE[toks[i + 1] || '']; if (rep) { out.push(d.repeat(rep)); i++; } else out.push(d); }
    else if (w === 'زائد' || w === 'plus') out.push('+');
    else out.push(toks[i]);
  }
  return out.join(' ');
}

/** جوال: أرقام فقط (+ اختياري) · 0 5x → 05x · يحذف الفراغات والشرطات. */
export function speechToPhone(text: string): string {
  let s = wordsToDigits(text).replace(/[^\d+]/g, ''); if (s.includes('+')) s = '+' + s.replace(/\+/g, '');
  if (/^00966/.test(s)) s = '+966' + s.slice(5); if (/^966\d{9}$/.test(s)) s = '+' + s; return s;
}
/** بريد: «آت/at/@» · «دوت/نقطة/dot» · نطاقات شائعة · حروف صغيرة بلا فراغات. */
export function speechToEmail(text: string): string {
  let s = ' ' + norm(text).toLowerCase() + ' ';
  for (const [k, v] of Object.entries(DOMAINS)) s = s.replace(new RegExp(k, 'g'), v);
  const tok = (words: string, rep: string) => { s = s.replace(new RegExp(`\\s(?:${words})\\s`, 'g'), ` ${rep} `); };
  tok('@|آت|ات|أت|at sign|at', '@'); tok('دوت|نقطة|نقطه|dot', '.'); tok('أندرسكور|اندرسكور|underscore', '_'); tok('شرطة|شرطه|dash|hyphen', '-');
  tok('كوم|com', 'com'); tok('نت|net', 'net'); tok('أورج|اورج|أورغ|اورغ|org', 'org'); tok('إس إيه|اس ايه|سعودية|السعودية|sa', 'sa'); tok('إيدو|ايدو|edu', 'edu');
  s = wordsToDigits(s).replace(/\s*([@._-])\s*/g, '$1').replace(/\s+/g, '');
  if (/@(gmail|hotmail|yahoo|outlook|icloud)$/.test(s)) s += '.com';
  return s;
}
/** اسم: فراغات مفردة، بلا علامات ترقيم طرفية، أوّل حرف كبير للاتيني. */
export function speechToName(text: string): string { return norm(text).replace(/[.،,!?؟]+$/g, '').replace(/\b([a-z])/g, (m) => m.toUpperCase()).trim(); }
export function speechToNumber(text: string): string { const t = norm(text); const explicit = t.match(/\d[\d.]*/g); if (explicit) return explicit.join(''); return wordsToDigits(t).replace(/[^\d.]/g, ''); }

export function fromSpeech(kind: FieldKind, text: string): string {
  switch (kind) { case 'phone': return speechToPhone(text); case 'email': return speechToEmail(text); case 'name': return speechToName(text); case 'number': return speechToNumber(text); default: return norm(text); }
}
/** أوامر صوتية عامّة في معالج «املأ النموذج بالكلام». */
export function voiceCommand(text: string): 'next' | 'back' | 'repeat' | 'submit' | 'cancel' | 'skip' | null {
  const s = norm(text).toLowerCase().replace(/[.!؟?]/g, '');
  if (/^(التالي|تالي|نعم|صح|صحيح|تمام|موافق|ok|yes|next|confirm)$/.test(s)) return 'next';
  if (/^(رجوع|السابق|ارجع|back|previous)$/.test(s)) return 'back';
  if (/^(أعد|اعد|كرر|كرّر|لا|غلط|خطأ|repeat|again|no|wrong)$/.test(s)) return 'repeat';
  if (/^(أرسل|ارسل|إرسال|ارسال|احفظ|حفظ|submit|send|save)$/.test(s)) return 'submit';
  if (/^(إلغاء|الغاء|ألغ|الغ|توقف|cancel|stop)$/.test(s)) return 'cancel';
  if (/^(تخط|تخطى|تخطي|تجاوز|skip)$/.test(s)) return 'skip';
  return null;
}
