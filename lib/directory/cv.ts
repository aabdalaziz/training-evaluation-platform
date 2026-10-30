// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — هيئة أَثَر (P31-ب) — «ابدأ من سيرتك الذاتية»
 *  يقرأ ملف السيرة (PDF · Word · نص · صورة) مرة واحدة ويستخرج منه ما يملأ حقول النموذج — والعضو يراجع ويعدّل ويحفظ ويرسل.
 *  - Word (.docx): يُفكّ محليًا بلا حزم (قارئ ZIP صغير + inflateRaw) ويُحوَّل نصًّا.
 *  - PDF/صورة: تُرسَل كمرفق للنموذج متعدد الوسائط (Gemini inlineData) — لا استخراج محلي لها.
 *  - بلا مفتاح ذكاء اصطناعي: بديل محلي بالقواعد للنصوص (اسم · ملخص · تعليم · شهادات · مهارات بالتطابق اللفظي).
 *  الملف لا يُحفظ في أي مكان؛ ولا يُسجَّل محتواه في portal_ai_log (أعداد فقط).
 */
import { inflateRawSync } from 'node:zlib';
import { parseJsonLoose } from '../ai/prompts';
import { LANG_AR, SERVICES, SERVICE_AR, MODES, MODE_AR, SUMMARY_MAX, ACHIEVEMENTS_MAX, ACHIEVEMENT_LEN, SKILLS_MAX, SECTORS_MAX, SERVICES_MAX, LANGS_MAX, sanitizeProfileInput } from './registry';
import type { Profile } from './registry';

export const CV_MAX_BYTES = 3 * 1024 * 1024; // 3 م.ب (حدّ جسم الطلب على Vercel 4.5 م.ب بعد base64)
export const CV_TEXT_MAX = 30000;
export const CV_TYPES: Record<string, 'pdf' | 'docx' | 'text' | 'image'> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'text', 'text/markdown': 'text',
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image',
};
export const CV_ACCEPT = '.pdf,.docx,.txt,.md,image/jpeg,image/png,image/webp';
export const CV_PRIVACY_AR = 'يُقرأ الملف مرة واحدة لاستخراج الحقول ولا يُحفظ في أَثَر؛ يُرسَل إلى مزوّد الذكاء الاصطناعي المعتمد لدى أَثَر لهذا الغرض وحده. ما يُستخرج مسودة بين يديك: راجعه وعدّله قبل الحفظ والإرسال.';
export const CV_FIELDS = ['name_ar', 'name_en', 'title_ar', 'title_en', 'city', 'languages', 'summary_ar', 'achievements', 'education', 'experience', 'certifications', 'publications', 'skill_ids', 'sectors', 'services', 'modes', 'coverage'] as const;
export type CvField = typeof CV_FIELDS[number];
export const CV_FIELD_AR: Record<CvField, string> = { name_ar: 'الاسم', name_en: 'الاسم بالإنجليزية', title_ar: 'اللقب المهني', title_en: 'اللقب بالإنجليزية', city: 'المدينة', languages: 'اللغات', summary_ar: 'ملخص السيرة', achievements: 'أبرز الإنجازات', education: 'التعليم', experience: 'الخبرات', certifications: 'الشهادات', publications: 'المنشورات', skill_ids: 'مهارات أَثَر', sectors: 'القطاعات', services: 'الخدمات', modes: 'أسلوب التقديم', coverage: 'نطاق التغطية' };
export type CvFields = Partial<Pick<Profile, CvField>>;
export type CvMeta = { skills: { id: string; name_ar: string; code?: string }[]; sectors: { code: string; name_ar: string }[] };
export type CvExtract = { fields: CvFields; notes_ar: string[] };

/** يفكّ .docx (ZIP) بلا حزم: يبحث عن word/document.xml ثم يحوّل XML إلى نص بفواصل فقرات */
export function docxText(buf: Buffer): string {
  if (!buf || buf.length < 22) return '';
  let eocd = -1; for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) { if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) return '';
  const n = buf.readUInt16LE(eocd + 10); let off = buf.readUInt32LE(eocd + 16); const found: { name: string; xml: string }[] = [];
  for (let k = 0; k < n && off + 46 <= buf.length; k++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10), csize = buf.readUInt32LE(off + 20), nlen = buf.readUInt16LE(off + 28), xlen = buf.readUInt16LE(off + 30), clen = buf.readUInt16LE(off + 32), lho = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nlen); off += 46 + nlen + xlen + clen;
    if (!/^word\/document\.xml$/.test(name)) continue;
    if (lho + 30 > buf.length) continue; const lnlen = buf.readUInt16LE(lho + 26), lxlen = buf.readUInt16LE(lho + 28); const start = lho + 30 + lnlen + lxlen; const data = buf.subarray(start, start + csize);
    try { found.push({ name, xml: method === 8 ? inflateRawSync(data).toString('utf8') : data.toString('utf8') }); } catch { /* تجاهل */ }
  }
  return found.map(f => xmlToText(f.xml)).join('\n').trim();
}
export function xmlToText(xml: string): string {
  return xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** يحوّل الملف إلى نص إن أمكن محليًا (docx/text)؛ غير ذلك null (يُرفق للنموذج) */
export function cvToText(kind: 'pdf' | 'docx' | 'text' | 'image', bytes: Buffer): string | null {
  if (kind === 'text') return bytes.toString('utf8').replace(/\r\n?/g, '\n').slice(0, CV_TEXT_MAX);
  if (kind === 'docx') { const t = docxText(bytes); return t ? t.slice(0, CV_TEXT_MAX) : null; }
  return null;
}

/** المطالبة — القوائم المغلقة تُمرَّر بمعرّفاتها؛ النموذج يختار منها فقط ولا يخترع */
export function buildCvPrompt(meta: CvMeta, text: string | null, hint: { has_attachment: boolean; file_kind: string }): { system: string; user: string } {
  const system = [
    'أنت مستخرج حقول لسيرة ذاتية في «هيئة أَثَر» (دليل خبراء ومدربين). اقرأ السيرة المرفقة أو النص وأخرج JSON واحدًا فقط بالمخطط أدناه — بلا شرح.',
    'قواعد: لا تخترع شيئًا غير موجود؛ اترك الحقل فارغًا ("" أو []) إن لم تجده. اكتب بالعربية الفصحى (ترجم من الإنجليزية إن لزم) إلا name_en/title_en.',
    'summary_ar: ملخص مهني بصيغة المتكلم ≤ 1100 حرف يلخّص ما في السيرة فعلًا. achievements: ≤ 10 بنود ≤ 200 حرف للبند، كل بند إنجاز ملموس من السيرة.',
    'education[]: {degree, field, institution, year}. experience[]: {role, organization, from, to, line} (line ≤ 200 حرف). certifications[]: {name, issuer, year, number}. publications[]: {title, type, year, url}.',
    'skill_ids: اختر من قائمة SKILLS فقط (المعرّف id) ما تدلّ عليه السيرة بوضوح، ≤ 8. sectors: من قائمة SECTORS فقط (code)، ≤ 5. services: من SERVICES فقط (code)، ≤ 6. modes: من MODES فقط (code). languages: رموز من LANGUAGES فقط.',
    'city: المدينة الحالية إن ذُكرت. coverage: مدن/مناطق يغطيها (≤ 12). لا تُخرج بريدًا ولا هاتفًا ولا أجرًا.',
    'notes_ar: ≤ 4 جمل قصيرة بالعربية: ما لم تجده أو ما يحتاج مراجعة من صاحب السيرة.',
    'المخطط: {"name_ar":"","name_en":"","title_ar":"","title_en":"","city":"","languages":[],"summary_ar":"","achievements":[],"education":[],"experience":[],"certifications":[],"publications":[],"skill_ids":[],"sectors":[],"services":[],"modes":[],"coverage":[],"notes_ar":[]}',
  ].join('\n');
  const lists = {
    SKILLS: meta.skills.map(s => ({ id: s.id, name_ar: s.name_ar })),
    SECTORS: meta.sectors.map(s => ({ code: s.code, name_ar: s.name_ar })),
    SERVICES: SERVICES.map(s => ({ code: s, name_ar: SERVICE_AR[s] })),
    MODES: MODES.map(m => ({ code: m, name_ar: MODE_AR[m] })),
    LANGUAGES: Object.entries(LANG_AR).map(([code, name_ar]) => ({ code, name_ar })),
  };
  const user = [`القوائم المغلقة:\n${JSON.stringify(lists)}`, hint.has_attachment ? `السيرة مرفقة كملف (${hint.file_kind}). اقرأها كاملة.` : '', text ? `نص السيرة:\n"""\n${text}\n"""` : ''].filter(Boolean).join('\n\n');
  return { system, user };
}

/** يحوّل ناتج النموذج إلى حقول آمنة بحدود النموذج، ويقصر القوائم المغلقة على المعرّفات الصحيحة */
export function parseCvExtract(raw: any, meta: CvMeta): CvExtract | null {
  const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; if (!j || typeof j !== 'object') return null;
  const s = sanitizeProfileInput({ ...j, faces: [], visibility: {} });
  const skillIds = new Set(meta.skills.map(x => x.id)); const sectorCodes = new Set(meta.sectors.map(x => x.code)); const langs = new Set(Object.keys(LANG_AR));
  const fields: CvFields = {
    name_ar: s.name_ar || '', name_en: s.name_en || null, title_ar: s.title_ar || '', title_en: s.title_en || null, city: s.city || null,
    languages: (s.languages || []).filter(l => langs.has(l)).slice(0, LANGS_MAX), summary_ar: (s.summary_ar || '').slice(0, SUMMARY_MAX),
    achievements: (s.achievements || []).map(a => a.slice(0, ACHIEVEMENT_LEN)).slice(0, ACHIEVEMENTS_MAX),
    education: s.education || [], experience: s.experience || [], certifications: s.certifications || [], publications: s.publications || [],
    skill_ids: (s.skill_ids || []).filter(id => skillIds.has(id)).slice(0, SKILLS_MAX), sectors: (s.sectors || []).filter(c => sectorCodes.has(c)).slice(0, SECTORS_MAX),
    services: (s.services || []).slice(0, SERVICES_MAX), modes: s.modes || [], coverage: s.coverage || [],
  };
  const notes_ar = Array.isArray(j.notes_ar) ? j.notes_ar.map((x: any) => String(x || '').trim().slice(0, 200)).filter(Boolean).slice(0, 4) : [];
  if (!hasAny(fields)) return null;
  return { fields, notes_ar };
}
export function hasAny(f: CvFields): boolean { return filledKeys(f).length > 0; }
/** المفاتيح التي تحمل قيمة فعلية */
export function filledKeys(f: CvFields): CvField[] { return CV_FIELDS.filter(k => { const v: any = (f as any)[k]; return Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim()); }); }

const AR = /[\u0600-\u06FF]/; const LATIN = /[A-Za-z]/;
const DEGREE_RE = /(دكتوراه|ماجستير|بكالوريوس|دبلوم|زمالة|Ph\.?D|Doctorate|Master|M\.?Sc|M\.?A\b|MBA|Bachelor|B\.?Sc|B\.?A\b|Diploma|Fellowship)/i;
const CERT_RE = /(شهادة|معتمد|اعتماد|Certified|Certificate|Certification|Licen[cs]e)/i;
const YEAR_RE = /\b(19[5-9]\d|20[0-4]\d)\b/;
/** البديل المحلي بالقواعد (للنصوص فقط) — يملأ القليل الصادق ولا يخمّن */
export function localCvExtract(text: string | null, meta: CvMeta): CvExtract {
  const notes: string[] = []; const f: CvFields = {};
  if (!text || !text.trim()) return { fields: f, notes_ar: ['تعذّرت قراءة الملف محليًا — ارفع ملف Word أو نصًا، أو فعِّل الذكاء الاصطناعي لقراءة PDF والصور.'] };
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const nameAr = lines.find(l => AR.test(l) && l.length <= 60 && !/\d|@|:/.test(l) && l.split(/\s+/).length >= 2 && l.split(/\s+/).length <= 6);
  const nameEn = lines.find(l => LATIN.test(l) && !AR.test(l) && l.length <= 60 && !/\d|@|:/.test(l) && /^[A-Z][a-z]+(\s+[A-Z][a-zA-Z.'-]+){1,4}$/.test(l));
  if (nameAr) f.name_ar = nameAr; if (nameEn) f.name_en = nameEn;
  const para = text.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).find(p => AR.test(p) && p.length >= 120 && p.length <= 1600 && !DEGREE_RE.test(p.slice(0, 40)));
  if (para) f.summary_ar = para.slice(0, SUMMARY_MAX);
  const edu = lines.filter(l => DEGREE_RE.test(l) && l.length <= 200).slice(0, 6).map(l => { const y = l.match(YEAR_RE)?.[1] || ''; const deg = l.match(DEGREE_RE)?.[1] || ''; return { degree: deg, field: '', institution: l.replace(deg, '').replace(y, '').replace(/[–\-—,:،|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120), year: y }; });
  if (edu.length) f.education = edu;
  const certs = lines.filter(l => CERT_RE.test(l) && !DEGREE_RE.test(l) && l.length <= 160).slice(0, 10).map(l => ({ name: l.replace(YEAR_RE, '').replace(/[–\-—|]+$/g, '').trim().slice(0, 120), issuer: '', year: l.match(YEAR_RE)?.[1] || '' }));
  if (certs.length) f.certifications = certs;
  const low = text.toLowerCase();
  const skills = meta.skills.filter(s => s.name_ar && s.name_ar.length >= 4 && low.includes(s.name_ar.toLowerCase())).slice(0, SKILLS_MAX).map(s => s.id); if (skills.length) f.skill_ids = skills;
  const sectors = meta.sectors.filter(s => s.name_ar && low.includes(s.name_ar.toLowerCase())).slice(0, SECTORS_MAX).map(s => s.code); if (sectors.length) f.sectors = sectors;
  const langs: string[] = []; if (AR.test(text)) langs.push('ar'); if (/english|الإنجليزية|الانجليزية/i.test(text) || (LATIN.test(text) && text.replace(/[^A-Za-z]/g, '').length > 400)) langs.push('en'); if (/français|الفرنسية/i.test(text)) langs.push('fr'); if (langs.length) f.languages = langs;
  notes.push('الذكاء الاصطناعي غير مفعّل في هذه البيئة — استُخرج ما أمكن بالقواعد؛ راجع كل حقل وأكمل الباقي بنفسك.');
  if (!f.summary_ar) notes.push('لم أجد فقرة ملخص واضحة — اكتبها بكلماتك.');
  return { fields: f, notes_ar: notes };
}
