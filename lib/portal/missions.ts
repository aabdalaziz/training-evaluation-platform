// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — مهمات في قلب العمل (P12-أ) — منطق نقيّ قابل للاختبار
 *  الفكرة: بعد البرنامج لا نسأل «هل طبّقت؟» بل نرسل مهمة دقيقة بدليل حقيقي من بيئة العمل (صورة/تسجيل 60 ثانية/نص/رابط)،
 *  المعيار معلن قبل البدء، فاحص أولي (ذكاء اصطناعي أو محلي) يقرأ الدليل مقابل المعيار، والمشرف المباشر يؤكد بضغطة واحدة.
 *  الدليل المؤكَّد يدخل الملف المهاري والتوأم والشهادة الحية بوصفه «دليل انتقال أثر» — أقوى دليل عملي بعد اختبار مِعيار.
 */
import type { Lang, T } from './content';
import { t } from './content';
import { randomCode } from './profile';

export type EvidenceMode = 'photo' | 'audio' | 'text' | 'link';
export type MissionStatus = 'assigned' | 'submitted' | 'confirmed' | 'returned' | 'expired';
export type Criterion = { c: string; w: number };
export type MissionTemplate = {
  id: string; program_id?: string | null; skills: string[]; title_ar: string; title_en?: string | null; brief_ar: string; brief_en?: string | null;
  evidence_mode: EvidenceMode; rubric: Criterion[]; days_after: number; due_days: number; active: boolean; created_at?: string; created_by?: string | null;
};
export type MissionEvidence = { text?: string; transcript?: string; caption?: string; link?: string; file_path?: string; file_type?: string; file_name?: string; duration_s?: number; size?: number };
export type CriterionCheck = { c: string; met: 'yes' | 'partly' | 'no'; note: string };
export type AiCheck = { score: number; criteria: CriterionCheck[]; feedback_ar: string; questions_ar: string[]; source: 'ai' | 'local'; model?: string | null };
export type Mission = {
  id: string; template_id?: string | null; user_id?: string | null; email: string; full_name?: string | null; program_id?: string | null; skills: string[];
  title_ar: string; brief_ar: string; evidence_mode: EvidenceMode; rubric: Criterion[]; token: string; confirm_token: string; status: MissionStatus;
  due_at: string; sent_at?: string | null; submitted_at?: string | null; evidence?: MissionEvidence | null; ai?: AiCheck | null;
  supervisor_email?: string | null; supervisor_name?: string | null; confirmed_at?: string | null; confirmed_by?: string | null; confirm_note?: string | null;
  reminders: number; created_at: string;
};

export const MODE_LABEL: Record<EvidenceMode, T> = {
  photo: { ar: 'صورة من العمل', en: 'Photo from work' }, audio: { ar: 'تسجيل صوتي 60 ثانية', en: '60-second voice note' },
  text: { ar: 'تأمّل مكتوب', en: 'Written reflection' }, link: { ar: 'رابط ملف/منتج', en: 'Link to artifact' },
};
export const MODE_HINT: Record<EvidenceMode, T> = {
  photo: { ar: 'صوّر الشيء الحقيقي (خطة، سبورة، نموذج، شاشة) ثم اكتب سطرين: أين يظهر ما تعلمته؟', en: 'Photograph the real artifact, then write two lines: where does the learning show?' },
  audio: { ar: 'اضغط التسجيل وتحدّث 60 ثانية كأنك تشرح لزميل: ماذا فعلت، ولماذا، وماذا تغيّر؟', en: 'Record 60 seconds as if explaining to a colleague: what you did, why, and what changed.' },
  text: { ar: 'اكتب 80 كلمة على الأقل: الموقف، القرار الذي اتخذته بناءً على التعلم، والنتيجة.', en: 'Write at least 80 words: the situation, the decision you made based on the learning, and the result.' },
  link: { ar: 'الصق رابطًا لملف أو منتج عمل حقيقي (مستند مشترك، عرض، نموذج) مع وصف قصير.', en: 'Paste a link to a real work artifact (shared doc, deck, form) with a short description.' },
};
export const STATUS_LABEL: Record<MissionStatus, T & { color: string }> = {
  assigned: { ar: 'بانتظار الدليل', en: 'Awaiting evidence', color: '#f59e0b' }, submitted: { ar: 'بانتظار تأكيد المشرف', en: 'Awaiting supervisor', color: '#3b82f6' },
  confirmed: { ar: 'مؤكَّدة', en: 'Confirmed', color: '#10b981' }, returned: { ar: 'أُعيدت للمتدرب', en: 'Returned', color: '#f43f5e' }, expired: { ar: 'انتهت مهلتها', en: 'Expired', color: '#64748b' },
};
export const modeLabel = (m: string, lang: Lang) => t(MODE_LABEL[m as EvidenceMode] || { ar: m, en: m }, lang);
export const statusLabel = (s: string, lang: Lang) => t(STATUS_LABEL[s as MissionStatus] || { ar: s, en: s }, lang);
export const MIN_WORDS: Record<EvidenceMode, number> = { text: 80, photo: 20, audio: 0, link: 15 };

/** رمز رابط المهمة/التأكيد: 24 حرفًا بلا تشابه بصري */
export const missionToken = (rnd?: () => number) => randomCode(24, rnd);
export const addDays = (iso: string | Date, d: number) => { const x = new Date(iso); x.setUTCDate(x.getUTCDate() + d); return x.toISOString(); };
export const dueAt = (assignedAt: string | Date, dueDays: number) => addDays(assignedAt, Math.max(1, dueDays || 7));
export function daysLeft(due: string, now = new Date()): number { return Math.ceil((new Date(due).getTime() - now.getTime()) / 86400000); }
export function urgency(due: string, now = new Date()): 'late' | 'soon' | 'ok' { const d = daysLeft(due, now); return d < 0 ? 'late' : d <= 2 ? 'soon' : 'ok'; }

/** متى تُرسل المهمة؟ بعد الإتمام بـ days_after يومًا، وتبقى صالحة للإرسال 60 يومًا بعدها (لا نرسل مهمات قديمة فجأة) */
export function scheduleWindow(tpl: Pick<MissionTemplate, 'days_after'>, completedAt: string, now = new Date()): 'wait' | 'send' | 'missed' {
  const start = new Date(addDays(completedAt, tpl.days_after)).getTime(); const end = start + 60 * 86400000; const n = now.getTime();
  return n < start ? 'wait' : n > end ? 'missed' : 'send';
}

export const wordCount = (s: string | null | undefined) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
/** النص الذي يقرؤه الفاحص: التأمل + النسخة الصوتية + تعليق الصورة + الرابط */
export function evidenceText(ev: MissionEvidence | null | undefined): string {
  if (!ev) return ''; return [ev.text, ev.transcript, ev.caption, ev.link].filter(Boolean).join('\n').trim();
}
export function evidenceReady(mode: EvidenceMode, ev: MissionEvidence): string | null {
  if (mode === 'text' && wordCount(ev.text) < MIN_WORDS.text) return `اكتب ${MIN_WORDS.text} كلمة على الأقل (الآن ${wordCount(ev.text)})`;
  if (mode === 'photo' && !ev.file_path) return 'أضف صورة من العمل';
  if (mode === 'photo' && wordCount(ev.caption) < MIN_WORDS.photo) return `اكتب ${MIN_WORDS.photo} كلمة على الأقل عن الصورة`;
  if (mode === 'audio' && !ev.file_path) return 'سجّل مقطعًا صوتيًا';
  if (mode === 'audio' && (ev.duration_s || 0) < 20) return 'التسجيل أقصر من 20 ثانية — تحدّث أكثر قليلًا';
  if (mode === 'link' && !/^https?:\/\/\S+/.test(String(ev.link || ''))) return 'الصق رابطًا صحيحًا يبدأ بـ http';
  if (mode === 'link' && wordCount(ev.text) < MIN_WORDS.link) return `صف المنتج في ${MIN_WORDS.link} كلمة على الأقل`;
  return null;
}

// ---------- الفاحص المحلي (بديل بلا نموذج لغوي): تطابق كلمات المعيار + طول/مدة الدليل
const STOP = new Set(['في', 'من', 'على', 'إلى', 'عن', 'مع', 'أن', 'إن', 'ما', 'لا', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'ثم', 'أو', 'و', 'كيف', 'أين', 'متى', 'هل', 'the', 'and', 'of', 'to', 'in', 'a', 'is', 'for', 'with', 'on']);
export const normalizeAr = (s: string) => String(s || '').toLowerCase().replace(/[\u064b-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[^\p{L}\p{N}\s]/gu, ' ');
export function keywords(s: string): string[] { return Array.from(new Set(normalizeAr(s).split(/\s+/).filter(w => w.length >= 3 && !STOP.has(w)).map(w => w.replace(/^(ال|و|ب|ل|ف|ك)/, '')).filter(w => w.length >= 3))); }
export function localCheck(m: Pick<Mission, 'rubric' | 'evidence_mode'>, ev: MissionEvidence): AiCheck {
  const text = evidenceText(ev); const words = keywords(text); const wc = wordCount(text);
  const criteria: CriterionCheck[] = (m.rubric || []).map(cr => {
    const ks = keywords(cr.c); const hit = ks.filter(k => words.some(w => w.includes(k) || k.includes(w))).length; const ratio = ks.length ? hit / ks.length : 0;
    const met: CriterionCheck['met'] = ratio >= 0.5 ? 'yes' : ratio > 0 ? 'partly' : 'no';
    return { c: cr.c, met, note: met === 'yes' ? 'ورد في الدليل بوضوح' : met === 'partly' ? 'ورد جزئيًا — فصّل أكثر' : 'لم يظهر في الدليل' };
  });
  const wsum = (m.rubric || []).reduce((a, c) => a + (c.w || 1), 0) || 1;
  let score = criteria.reduce((a, c, i) => a + (c.met === 'yes' ? 1 : c.met === 'partly' ? 0.5 : 0) * ((m.rubric[i]?.w) || 1), 0) / wsum * 100;
  if (m.evidence_mode === 'audio') score = Math.max(score, Math.min(70, ((ev.duration_s || 0) / 60) * 70)); // تسجيل كامل بلا نسخة نصية = حد أدنى معقول حتى يحكم المشرف
  if (m.evidence_mode === 'photo' && ev.file_path) score = Math.min(100, score + 15);
  if (wc >= 120) score = Math.min(100, score + 10);
  score = Math.min(84, Math.round(score)); // الفاحص المحلي لا يمنح «فوق المستوى» — ذلك للذكاء الاصطناعي أو المشرف
  const missing = criteria.filter(c => c.met !== 'yes').map(c => c.c);
  const feedback_ar = score >= 75 ? 'دليل واضح يربط التعلم بالعمل. ' : score >= 45 ? 'بداية جيدة؛ بعض عناصر المعيار تحتاج تفصيلًا. ' : 'الدليل عام؛ اربطه بموقف محدد ونتيجة ملموسة. ';
  const questions_ar = missing.slice(0, 2).map(c => `هل ترى أثر «${c}» في عمل المتدرب فعلًا؟`);
  if (!questions_ar.length) questions_ar.push('هل يعكس هذا الدليل ممارسة متكررة لا مرة واحدة؟');
  return { score, criteria, feedback_ar: feedback_ar + (missing.length ? `ينقص: ${missing.join('، ')}.` : ''), questions_ar, source: 'local' };
}

// ---------- الفاحص بالذكاء الاصطناعي (نصيّ: التأمل/النسخة الصوتية/التعليق) — الإنسان يعتمد
export function aiCheckPrompt(m: Pick<Mission, 'title_ar' | 'brief_ar' | 'rubric' | 'evidence_mode'>, ev: MissionEvidence): { system: string; user: string } {
  const system = 'أنت فاحص أدلة انتقال أثر التدريب في منصة أَثَر. تقرأ دليلًا من بيئة عمل المتدرب وتقيّمه مقابل معيار معلن. كن منصفًا ومحددًا؛ لا تخترع ما لم يرد. لا تذكر معلومات شخصية. أعد JSON فقط بالصيغة: {"score":0-100,"criteria":[{"c":"نص المعيار","met":"yes|partly|no","note":"≤15 كلمة"}],"feedback_ar":"≤40 كلمة للمتدرب","questions_ar":["سؤالان قصيران للمشرف يتحقق بهما"]}';
  const user = `المهمة: ${m.title_ar}\nالتعليمات: ${m.brief_ar}\nنوع الدليل: ${MODE_LABEL[m.evidence_mode].ar}${ev.file_path ? ' (ملف مرفق سيراه المشرف)' : ''}${ev.duration_s ? ` · مدة التسجيل ${ev.duration_s} ث` : ''}\nالمعيار:\n${m.rubric.map((c, i) => `${i + 1}. ${c.c} (وزن ${c.w})`).join('\n')}\n\nنص الدليل:\n"""\n${evidenceText(ev).slice(0, 4000)}\n"""`;
  return { system, user };
}
export function parseAiCheck(raw: string, rubric: Criterion[]): AiCheck | null {
  try {
    const s = raw.indexOf('{'); const e = raw.lastIndexOf('}'); if (s < 0 || e < 0) return null; const j = JSON.parse(raw.slice(s, e + 1));
    const score = Math.max(0, Math.min(100, Math.round(Number(j.score)))); if (!Number.isFinite(score)) return null;
    const crit = Array.isArray(j.criteria) ? j.criteria : [];
    const criteria: CriterionCheck[] = rubric.map((r, i) => { const x = crit.find((c: any) => String(c?.c || '').trim() === r.c) || crit[i] || {}; const met = ['yes', 'partly', 'no'].includes(x.met) ? x.met : 'partly'; return { c: r.c, met, note: String(x.note || '').slice(0, 160) }; });
    const questions = (Array.isArray(j.questions_ar) ? j.questions_ar : []).map((q: any) => String(q).slice(0, 160)).filter(Boolean).slice(0, 3);
    return { score, criteria, feedback_ar: String(j.feedback_ar || '').slice(0, 400), questions_ar: questions.length ? questions : ['هل يعكس هذا الدليل ممارسة متكررة لا مرة واحدة؟'], source: 'ai' };
  } catch { return null; }
}

// ---------- الدليل في الملف المهاري: حدث تعلم (verb assessed · object mission) — الوزن يرتفع بعد تأكيد المشرف
export function missionEvent(m: Pick<Mission, 'id' | 'user_id' | 'email' | 'skills' | 'title_ar' | 'evidence_mode'>, score: number, confirmed: boolean) {
  return { user_id: m.user_id || null, email: m.email, verb: 'assessed', object_type: 'mission', object_id: m.id, skills: m.skills || [], context: { score, title: m.title_ar, mode: m.evidence_mode, confirmed } };
}

// ---------- روابط ورسائل
export const missionUrl = (site: string, token: string) => `${site}/m/${token}`;
export const confirmUrl = (site: string, confirmToken: string) => `${site}/m/confirm/${confirmToken}`;
export function waShare(text: string, phone?: string): string { const p = String(phone || '').replace(/\D/g, ''); return `https://wa.me/${p}?text=${encodeURIComponent(text)}`; }
export function supervisorShareText(m: Pick<Mission, 'title_ar' | 'full_name'>, url: string): string {
  return `السلام عليكم، أنجزتُ مهمة «${m.title_ar}» ضمن برنامج تدريبي عبر منصة أَثَر، وأرفقتُ دليلًا من عملي. أرجو تأكيدها بضغطة واحدة (دقيقة واحدة): ${url}`;
}
const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
const shell = (title: string, body: string) => `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#0f172a;max-width:640px"><h2 style="color:#0f2a4e;margin:0 0 6px">${esc(title)}</h2>${body}<p style="color:#64748b;font-size:12px;margin-top:18px">أَثَر | التدريب ما بعد الذكاء الاصطناعي — نبني القدرة ونُثبت الأثر · © 2026 د. أحمد محمد عبدالعزيز بدوي</p></div>`;
const btn = (href: string, label: string, color = '#0b8a83') => `<p style="margin:14px 0"><a href="${href}" style="background:${color};color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:800">${esc(label)}</a></p>`;
export function missionMailHtml(m: Pick<Mission, 'title_ar' | 'brief_ar' | 'evidence_mode' | 'rubric' | 'due_at' | 'full_name'>, url: string, programName?: string | null): { subject: string; html: string } {
  const rub = m.rubric.map(c => `<li>${esc(c.c)}</li>`).join('');
  return { subject: `مهمة من قلب العمل: ${m.title_ar}`, html: shell('مهمة من قلب العمل', `<p>مرحبًا ${esc(m.full_name || '')}،<br/>${programName ? `بعد برنامج «${esc(programName)}»، ` : ''}لا نسألك «هل طبّقت؟» — نطلب دليلًا صغيرًا حقيقيًا يستغرق دقائق:</p><div style="border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;background:#f8fafc"><b>${esc(m.title_ar)}</b><p style="margin:6px 0">${esc(m.brief_ar)}</p><small style="color:#475569">نوع الدليل: ${esc(MODE_LABEL[m.evidence_mode].ar)} · المهلة: ${new Date(m.due_at).toLocaleDateString('ar-SA-u-nu-latn')}</small></div><p style="margin:12px 0 4px"><b>المعيار معلن قبل البدء:</b></p><ul style="margin:0;padding-inline-start:20px">${rub}</ul>${btn(url, 'افتح المهمة (بلا تسجيل دخول)')}<p style="color:#475569;font-size:13px">بعد الإرسال يفحص أَثَر دليلك مقابل المعيار فورًا، ويؤكده مشرفك بضغطة واحدة، ويدخل توأمك المهاري وشهادتك الحية كدليل انتقال أثر.</p>`) };
}
export function reminderMailHtml(m: Pick<Mission, 'title_ar' | 'due_at' | 'full_name'>, url: string): { subject: string; html: string } {
  return { subject: `تذكير: مهمة «${m.title_ar}» تنتهي قريبًا`, html: shell('تذكير بمهمتك', `<p>مرحبًا ${esc(m.full_name || '')}، بقي على مهلة مهمة «${esc(m.title_ar)}» ${Math.max(0, daysLeft(m.due_at))} يوم. خمس دقائق تكفي.</p>${btn(url, 'أكمل المهمة الآن', '#c9a24b')}`) };
}
export function supervisorMailHtml(m: Pick<Mission, 'title_ar' | 'full_name' | 'evidence_mode'>, ai: AiCheck | null, url: string): { subject: string; html: string } {
  const qs = (ai?.questions_ar || []).map(q => `<li>${esc(q)}</li>`).join('');
  return { subject: `تأكيد بضغطة: ${m.full_name || 'متدرب'} أنجز مهمة «${m.title_ar}»`, html: shell('تأكيد دليل من قلب العمل', `<p>أنجز <b>${esc(m.full_name || 'المتدرب')}</b> مهمة «${esc(m.title_ar)}» وأرفق ${esc(MODE_LABEL[m.evidence_mode].ar)}.${ai ? ` الفحص الأولي: <b>${ai.score}%</b>.` : ''}</p>${qs ? `<p>ما نرجو أن تتحقق منه (دقيقة واحدة):</p><ul style="margin:0;padding-inline-start:20px">${qs}</ul>` : ''}${btn(url, 'اعرض الدليل وأكّد')}<p style="color:#475569;font-size:13px">تأكيدك هو ما يجعل الدليل كامل الوزن في ملف المتدرب — الذكاء الاصطناعي يقترح، والإنسان يعتمد.</p>`) };
}
export function confirmedMailHtml(m: Pick<Mission, 'title_ar' | 'full_name' | 'confirmed_by'>, twinUrl: string, returned: boolean, note?: string | null): { subject: string; html: string } {
  return returned
    ? { subject: `أُعيدت مهمة «${m.title_ar}» إليك`, html: shell('مهمتك تحتاج لمسة أخرى', `<p>أعاد ${esc(m.confirmed_by || 'المشرف')} مهمة «${esc(m.title_ar)}» مع ملاحظة:</p><blockquote style="border-inline-start:3px solid #c9a24b;margin:8px 0;padding:4px 12px;color:#334155">${esc(note || '')}</blockquote><p>يمكنك إعادة إرسال الدليل من الرابط نفسه.</p>`) }
    : { subject: `تأكّد أثرك: «${m.title_ar}»`, html: shell('دليل انتقال أثر مؤكَّد', `<p>أكّد ${esc(m.confirmed_by || 'مشرفك')} مهمة «${esc(m.title_ar)}». أصبح هذا دليلًا كامل الوزن في ملفك المهاري وتوأمك وشهادتك الحية.</p>${note ? `<blockquote style="border-inline-start:3px solid #0b8a83;margin:8px 0;padding:4px 12px;color:#334155">${esc(note)}</blockquote>` : ''}${btn(twinUrl, 'شاهد أثره في توأمك')}`) };
}

// ---------- إحصاءات انتقال الأثر (للإدارة والجهات)
export type TransferStats = { total: number; assigned: number; submitted: number; confirmed: number; returned: number; expired: number; confirm_rate: number; response_rate: number; median_days: number | null; avg_score: number | null; by_program: { program_id: string | null; total: number; confirmed: number }[] };
export function transferStats(rows: Pick<Mission, 'status' | 'program_id' | 'created_at' | 'submitted_at' | 'ai'>[]): TransferStats {
  const n = (s: MissionStatus) => rows.filter(r => r.status === s).length; const total = rows.length;
  const responded = rows.filter(r => r.submitted_at).length; const confirmed = n('confirmed');
  const days = rows.filter(r => r.submitted_at).map(r => (new Date(r.submitted_at!).getTime() - new Date(r.created_at).getTime()) / 86400000).sort((a, b) => a - b);
  const scores = rows.map(r => r.ai?.score).filter((x): x is number => typeof x === 'number');
  const bp = new Map<string | null, { total: number; confirmed: number }>(); for (const r of rows) { const k = r.program_id || null; const o = bp.get(k) || { total: 0, confirmed: 0 }; o.total++; if (r.status === 'confirmed') o.confirmed++; bp.set(k, o); }
  return { total, assigned: n('assigned'), submitted: n('submitted'), confirmed, returned: n('returned'), expired: n('expired'), confirm_rate: total ? Math.round(confirmed / total * 100) : 0, response_rate: total ? Math.round(responded / total * 100) : 0, median_days: days.length ? Math.round(days[Math.floor(days.length / 2)] * 10) / 10 : null, avg_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null, by_program: Array.from(bp.entries()).map(([program_id, v]) => ({ program_id, ...v })).sort((a, b) => b.total - a.total) };
}

// ---------- قوالب بدء سريعة لكل مجال (بديل محلي لـ«اقترح مهمات») — المدرّب يعدّل ويعتمد
export const STARTER_TEMPLATES: Record<string, Omit<MissionTemplate, 'id' | 'skills' | 'program_id' | 'active'>[]> = {
  pedagogy: [
    { title_ar: 'خطة درس تُظهر التعلم النشط', brief_ar: 'صوّر خطة درسك لهذا الأسبوع وأشِر بسهم أو دائرة إلى الموضع الذي وظّفت فيه استراتيجية تعلم نشط تعلّمتها في البرنامج، ثم اكتب: لماذا هنا؟ وماذا لاحظت على الطلاب؟', evidence_mode: 'photo', rubric: [{ c: 'تحديد موضع الاستراتيجية في الخطة', w: 2 }, { c: 'تبرير الاختيار بسلوك المتعلمين', w: 2 }, { c: 'وصف ملاحظة فعلية من التطبيق', w: 1 }], days_after: 7, due_days: 7 },
    { title_ar: 'قرار تدريسي اتخذته هذا الأسبوع', brief_ar: 'سجّل 60 ثانية تشرح فيها قرارًا تدريسيًا اتخذته هذا الأسبوع بناءً على ما تعلمته: الموقف، القرار، وما تغيّر.', evidence_mode: 'audio', rubric: [{ c: 'وصف موقف صفي محدد', w: 1 }, { c: 'ربط القرار بما تعلمه', w: 2 }, { c: 'ذكر نتيجة أو تغيّر ملحوظ', w: 2 }], days_after: 21, due_days: 7 },
  ],
  arabic: [
    { title_ar: 'نشاط تواصلي طبّقته مع متعلمين', brief_ar: 'صوّر منتج نشاط تواصلي (حوار، بطاقات، كتابة موجّهة) نفّذته مع متعلمي العربية، واكتب: ما المستوى؟ وما الهدف اللغوي؟ وكيف قوّمت الأداء؟', evidence_mode: 'photo', rubric: [{ c: 'ملاءمة النشاط للمستوى', w: 2 }, { c: 'وضوح الهدف اللغوي', w: 1 }, { c: 'أداة تقويم محددة', w: 2 }], days_after: 10, due_days: 7 },
    { title_ar: 'تغذية راجعة لغوية سجّلتها', brief_ar: 'سجّل 60 ثانية تحكي فيها كيف قدّمت تغذية راجعة على خطأ لغوي شائع لدى متعلم، ولماذا اخترت هذه الطريقة.', evidence_mode: 'audio', rubric: [{ c: 'تشخيص الخطأ بدقة', w: 2 }, { c: 'اختيار أسلوب تصحيح مناسب', w: 2 }, { c: 'أثر على المتعلم', w: 1 }], days_after: 21, due_days: 7 },
  ],
  leadership: [
    { title_ar: 'اجتماع أدرته بطريقة مختلفة', brief_ar: 'اكتب 100 كلمة عن اجتماع أو قرار قيادي أدرته هذا الشهر بطريقة مختلفة بسبب البرنامج: ماذا غيّرت؟ وكيف استجاب الفريق؟', evidence_mode: 'text', rubric: [{ c: 'تغيير سلوكي محدد', w: 2 }, { c: 'استجابة الفريق', w: 2 }, { c: 'درس مستفاد', w: 1 }], days_after: 14, due_days: 10 },
  ],
  quality: [
    { title_ar: 'مؤشر قسته بعد البرنامج', brief_ar: 'الصق رابط لوحة أو جدول يُظهر مؤشرًا بدأت قياسه (أو حسّنت قياسه) بعد البرنامج، واكتب كيف ستستخدم نتيجته في قرار.', evidence_mode: 'link', rubric: [{ c: 'مؤشر محدد وقابل للقياس', w: 2 }, { c: 'ربط المؤشر بقرار', w: 2 }, { c: 'دورية القياس', w: 1 }], days_after: 21, due_days: 10 },
  ],
  data_ai: [
    { title_ar: 'مهمة أنجزتها بمساعدة الذكاء الاصطناعي بمسؤولية', brief_ar: 'الصق رابط ناتج عمل أنجزته بمساعدة أداة ذكاء اصطناعي، واكتب: ما الذي راجعته بنفسك قبل الاعتماد؟ وما الذي لم تثق به؟', evidence_mode: 'link', rubric: [{ c: 'مراجعة بشرية للناتج', w: 2 }, { c: 'وعي بحدود الأداة', w: 2 }, { c: 'توفير وقت أو جودة ملموسة', w: 1 }], days_after: 7, due_days: 7 },
  ],
  digital: [
    { title_ar: 'أداة رقمية أدخلتها في عملك', brief_ar: 'صوّر شاشة الأداة الرقمية التي بدأت استخدامها في العمل بعد البرنامج واكتب: ما المشكلة التي حلّتها؟', evidence_mode: 'photo', rubric: [{ c: 'مشكلة عمل واضحة', w: 2 }, { c: 'استخدام فعلي لا تجريبي', w: 2 }, { c: 'أثر قابل للملاحظة', w: 1 }], days_after: 14, due_days: 7 },
  ],
  research: [
    { title_ar: 'سؤال بحثي صغته من واقع عملك', brief_ar: 'اكتب 100 كلمة: سؤال بحثي/تحسيني صغته من مشكلة في عملك، وكيف ستجمع أول دليل عليه.', evidence_mode: 'text', rubric: [{ c: 'سؤال محدد وقابل للإجابة', w: 2 }, { c: 'مصدر دليل واقعي', w: 2 }, { c: 'خطوة أولى قابلة للتنفيذ', w: 1 }], days_after: 14, due_days: 10 },
  ],
  wellbeing: [
    { title_ar: 'عادة طبّقتها أسبوعين', brief_ar: 'سجّل 60 ثانية عن عادة من البرنامج التزمت بها أسبوعين: متى تعثّرت؟ وما الذي ساعدك على الاستمرار؟', evidence_mode: 'audio', rubric: [{ c: 'عادة محددة ومدة فعلية', w: 2 }, { c: 'وعي بالعقبات', w: 1 }, { c: 'استراتيجية استمرار', w: 2 }], days_after: 14, due_days: 7 },
  ],
};
export function starterFor(domains: string[]): Omit<MissionTemplate, 'id' | 'skills' | 'program_id' | 'active'>[] {
  const out: Omit<MissionTemplate, 'id' | 'skills' | 'program_id' | 'active'>[] = []; const seen = new Set<string>();
  for (const d of domains.length ? domains : ['pedagogy']) for (const tpl of STARTER_TEMPLATES[d] || []) if (!seen.has(tpl.title_ar)) { seen.add(tpl.title_ar); out.push(tpl); }
  return out.slice(0, 4);
}
export function suggestPrompt(program: { name_ar: string; description?: string | null }, skills: { name_ar: string; domain: string }[]): { system: string; user: string } {
  return {
    system: 'أنت مصمم «مهمات في قلب العمل» لمنصة أَثَر: مهمات صغيرة (5–10 دقائق) تُنجز في بيئة العمل الحقيقية بعد البرنامج وتنتج دليلًا ملموسًا. أعد JSON فقط: {"templates":[{"title_ar":"","brief_ar":"تعليمات دقيقة بصيغة المخاطب","evidence_mode":"photo|audio|text|link","rubric":[{"c":"معيار قابل للملاحظة","w":1-3}],"days_after":7-45,"due_days":7-14}]} بثلاث مهمات متدرجة زمنيًا (أسبوع، ثلاثة أسابيع، ستة أسابيع).',
    user: `البرنامج: ${program.name_ar}\n${program.description ? `الوصف: ${String(program.description).slice(0, 600)}\n` : ''}المهارات: ${skills.map(s => `${s.name_ar} (${s.domain})`).join('، ')}`,
  };
}
export function parseSuggest(raw: string): Omit<MissionTemplate, 'id' | 'skills' | 'program_id' | 'active'>[] | null {
  try {
    const s = raw.indexOf('{'); const e = raw.lastIndexOf('}'); if (s < 0) return null; const j = JSON.parse(raw.slice(s, e + 1)); const arr = Array.isArray(j.templates) ? j.templates : [];
    const out = arr.map((x: any) => ({ title_ar: String(x.title_ar || '').slice(0, 120), brief_ar: String(x.brief_ar || '').slice(0, 600), evidence_mode: (['photo', 'audio', 'text', 'link'].includes(x.evidence_mode) ? x.evidence_mode : 'text') as EvidenceMode, rubric: (Array.isArray(x.rubric) ? x.rubric : []).slice(0, 4).map((r: any) => ({ c: String(r.c || '').slice(0, 120), w: Math.max(1, Math.min(3, Math.round(Number(r.w) || 1))) })).filter((r: Criterion) => r.c), days_after: Math.max(1, Math.min(60, Math.round(Number(x.days_after) || 7))), due_days: Math.max(3, Math.min(21, Math.round(Number(x.due_days) || 7))) })).filter((x: any) => x.title_ar && x.brief_ar && x.rubric.length >= 2);
    return out.length ? out.slice(0, 4) : null;
  } catch { return null; }
}

// ---------- نموذج القالب (الإدارة)
export type TemplateForm = { program_id: string; skills: string[]; title_ar: string; brief_ar: string; evidence_mode: EvidenceMode; rubric: Criterion[]; days_after: string; due_days: string; active: boolean };
export const EMPTY_TEMPLATE: TemplateForm = { program_id: '', skills: [], title_ar: '', brief_ar: '', evidence_mode: 'text', rubric: [{ c: '', w: 2 }, { c: '', w: 1 }], days_after: '7', due_days: '7', active: true };
export function validateTemplate(f: TemplateForm): string | null {
  if (f.title_ar.trim().length < 6) return 'اكتب عنوانًا واضحًا للمهمة';
  if (f.brief_ar.trim().length < 30) return 'التعليمات قصيرة — صف بدقة ما يفعله المتدرب وما يرفقه';
  if (!f.skills.length) return 'اختر مهارة واحدة على الأقل تثبتها المهمة';
  const rub = f.rubric.filter(r => r.c.trim()); if (rub.length < 2) return 'المعيار يحتاج بندين على الأقل';
  const da = Number(f.days_after), dd = Number(f.due_days); if (!(da >= 1 && da <= 60)) return 'أيام ما بعد الإتمام بين 1 و60'; if (!(dd >= 3 && dd <= 21)) return 'المهلة بين 3 و21 يومًا';
  return null;
}
export function templatePayload(f: TemplateForm) {
  return { program_id: f.program_id || null, skills: f.skills, title_ar: f.title_ar.trim(), brief_ar: f.brief_ar.trim(), evidence_mode: f.evidence_mode, rubric: f.rubric.filter(r => r.c.trim()).map(r => ({ c: r.c.trim(), w: Math.max(1, Math.min(3, Math.round(r.w || 1))) })), days_after: Number(f.days_after), due_days: Number(f.due_days), active: !!f.active };
}
export function templateToForm(tpl: MissionTemplate): TemplateForm { return { program_id: tpl.program_id || '', skills: tpl.skills || [], title_ar: tpl.title_ar, brief_ar: tpl.brief_ar, evidence_mode: tpl.evidence_mode, rubric: (tpl.rubric || []).length ? tpl.rubric : [{ c: '', w: 2 }], days_after: String(tpl.days_after), due_days: String(tpl.due_days), active: tpl.active !== false }; }
/** ما يُعرض للعموم عبر الرمز: بلا رموز أخرى ولا بريد المشرف */
export function publicMission(m: Mission) { const { confirm_token: _c, supervisor_email: _s, ...rest } = m; return rest; }
export const fileExt = (name: string, type: string) => (name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '') || (type.includes('webm') ? 'webm' : type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : type.includes('png') ? 'png' : 'jpg');
export const evidencePath = (missionId: string, ext: string) => `${missionId}/${Date.now()}.${ext}`;
export const MAX_UPLOAD = 4 * 1024 * 1024;
