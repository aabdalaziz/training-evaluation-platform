// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* «بَيْتُ بَيان» — منطق البوّابة الأبوية الصِّرف (بلا شبكة، بلا React) — kids/curriculum/PARENT-GATE-PLAN.md
 * الأمانات ونصوصها · مراحل النبتة · بوّابة الكبار · التحقّق من الحمولات (لا صوت/صورة أبدًا) · قالب رسالة لؤلؤ. */

export const LIMITS = { children: 6, nick: 20, eventsPerDay: 60, resultsBytes: 4096, birthYearMin: 2010, birthYearMax: 2030 } as const;
export const AVATARS = ['🦜', '🐰', '🐱', '🐢', '🦋', '🐠', '🦉', '🐥'] as const;

export type ConsentKind = 'speech_recog' | 'save_text' | 'camera' | 'share_facilitator';
export type ConsentDef = { kind: ConsentKind; title: string; lines: [string, string]; version: number; days: number | null; experimental?: boolean };
/** نصوص الأمانات — أيّ تغيير في النصّ يرفع version (الموافقة القديمة تبقى في السجلّ بإصدارها) */
export const CONSENTS: ConsentDef[] = [
  { kind: 'speech_recog', title: 'التعرّف التلقائي على الكلام', version: 1, days: null,
    lines: ['يحوّل متصفّحك كلام طفلك إلى نصّ لتردّ لؤلؤ وحدها.', 'قد يُرسَل الصوت إلى مزوّد المتصفّح (Google أو Apple) — لا إلى أَثَر.'] },
  { kind: 'save_text', title: 'حفظ ما قاله طفلك (نصًّا)', version: 1, days: 90,
    lines: ['نحفظ الجمل التي قالها لِلُؤلُؤ نصًّا فقط لتراها هنا وفي رسالة لؤلؤ.', 'لا يُحفظ صوت أبدًا، ويُمحى النصّ بعد 90 يومًا.'] },
  { kind: 'camera', title: 'الكاميرا الاختبارية «أَرِني»', version: 1, days: 30, experimental: true,
    lines: ['لقطة واحدة يرفعها طفلك لِلُؤلُؤ لتعلّق عليها، تُعالَج وتُحذف فورًا ولا تُخزَّن.', 'تجربة اختبارية قد تُخطئ، وتنتهي بعد 30 يومًا ما لم تجدّدها.'] },
  { kind: 'share_facilitator', title: 'مشاركة الوجوه مع الميسّر', version: 1, days: null,
    lines: ['يرى ميسّر بَيان وجوه التقييم الذاتيّ وعدد الجلسات.', 'لا يرى الجمل ولا الاسم الكامل.'] },
];
export const CONSENT_KINDS = CONSENTS.map(c => c.kind);

export type ConsentRow = { kind: ConsentKind; granted: boolean; granted_at: string; expires_at: string | null; text_version: number };
/** الأمانة السارية الآن (آخر صفّ، غير منتهٍ) — الافتراضي مغلقة */
export function effectiveConsents(rows: ConsentRow[], now = new Date()): Record<ConsentKind, boolean> {
  const out = { speech_recog: false, save_text: false, camera: false, share_facilitator: false } as Record<ConsentKind, boolean>;
  const latest = new Map<ConsentKind, ConsentRow>();
  for (const r of [...rows].sort((a, b) => a.granted_at.localeCompare(b.granted_at))) latest.set(r.kind, r);
  for (const [k, r] of latest) out[k] = r.granted && (!r.expires_at || new Date(r.expires_at) > now);
  return out;
}
export function consentExpiry(kind: ConsentKind, from = new Date()): string | null {
  const d = CONSENTS.find(c => c.kind === kind)?.days; if (!d) return null;
  return new Date(from.getTime() + d * 86400000).toISOString();
}

/** مراحل النبتة بعدد الجلسات المكتملة · الثمار = مهامّ البيت المؤكَّدة */
export type Stage = 'seed' | 'sprout' | 'branch';
export const STAGE_AR: Record<Stage, string> = { seed: 'بَذْرَة', sprout: 'بُرْعُم', branch: 'غُصْن' };
export function stageOf(finished: number): Stage { return finished >= 8 ? 'branch' : finished >= 3 ? 'sprout' : 'seed'; }
export function ageOf(birthYear: number, now = new Date()): number { return Math.max(0, now.getFullYear() - birthYear); }

/** بوّابة الكبار: سؤال حسابي بسيط (لا رمز سرّي يُنسى) */
export function adultGate(seed = Date.now()): { q: string; a: number } {
  const x = 2 + (seed % 7), y = 3 + (Math.floor(seed / 7) % 6);
  return { q: `${x} + ${y}`, a: x + y };
}
export const checkGate = (gate: { a: number }, answer: string | number) => Number(String(answer).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))) === gate.a;

/** تنظيف الكنية: اسم أوّل/كنية فقط — كلمة أو كلمتان، بلا أرقام ولا بريد ولا @ */
export function cleanNick(s: unknown): string | null {
  const t = String(s || '').replace(/[\u0610-\u061A\u064B-\u065F\u0670]/g, '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > LIMITS.nick) return null;
  if (/[0-9٠-٩@._/\\:;<>]/.test(t)) return null;
  if (t.split(' ').length > 2) return null;      // لا اسم ثلاثيًّا
  return t;
}
export function cleanBirthYear(v: unknown, now = new Date()): number | null {
  const y = Number(v); if (!Number.isInteger(y)) return null;
  if (y < LIMITS.birthYearMin || y > LIMITS.birthYearMax || y > now.getFullYear()) return null;
  return y;
}

/** حمولة نهاية الجلسة من جهاز الطفل — تُرفض إن حملت أيّ وسائط */
export type ProgressPayload = {
  session: string; stations: Record<string, boolean>; badge?: string | null;
  self?: 'easy' | 'good' | 'hard' | null; selfVoice?: 'clear' | 'near' | 'again' | 'skip' | null;
  talk?: { role: string; matched: string; attempts: number; heard?: string }[];
  startedAt?: string;
};
const MEDIA_KEYS = /^(audio|blob|image|photo|video|picture|base64|data|file|recording|clip)s?$/i;
export function hasMedia(v: unknown, depth = 0): boolean {
  if (depth > 6 || v === null || typeof v !== 'object') return typeof v === 'string' && /^data:(audio|image|video)\//i.test(v);
  if (Array.isArray(v)) return v.some(x => hasMedia(x, depth + 1));
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) { if (MEDIA_KEYS.test(k)) return true; if (hasMedia(x, depth + 1)) return true; }
  return false;
}
export function cleanProgress(body: unknown, saveText: boolean): { ok: true; p: ProgressPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'حمولة غير صالحة' };
  if (hasMedia(body)) return { ok: false, error: 'لا يُرسَل صوت ولا صورة إلى أَثَر' };
  const b = body as Record<string, unknown>;
  const session = String(b.session || ''); if (!/^[a-z0-9-]{2,24}$/.test(session)) return { ok: false, error: 'جلسة غير معروفة' };
  const stations: Record<string, boolean> = {};
  if (b.stations && typeof b.stations === 'object') for (const [k, v] of Object.entries(b.stations as Record<string, unknown>).slice(0, 12)) if (/^[a-z_]{2,16}$/.test(k)) stations[k] = !!v;
  const self = ['easy', 'good', 'hard'].includes(String(b.self)) ? (b.self as ProgressPayload['self']) : null;
  const selfVoice = ['clear', 'near', 'again', 'skip'].includes(String(b.selfVoice)) ? (b.selfVoice as ProgressPayload['selfVoice']) : null;
  const badge = b.badge ? String(b.badge).slice(0, 40) : null;
  let talk: ProgressPayload['talk'] = undefined;
  if (Array.isArray(b.talk)) {
    talk = (b.talk as unknown[]).slice(0, 6).map(t => { const r = (t || {}) as Record<string, unknown>; const row: NonNullable<ProgressPayload['talk']>[number] = { role: String(r.role || '').slice(0, 12), matched: String(r.matched || '').slice(0, 8), attempts: Number(r.attempts) === 2 ? 2 : 1 }; if (saveText && r.heard) row.heard = scrubChildText(String(r.heard)); return row; });
    if (JSON.stringify(talk).length > LIMITS.resultsBytes) return { ok: false, error: 'نتائج الحوار أطول من المسموح' };
  }
  const startedAt = b.startedAt && !Number.isNaN(Date.parse(String(b.startedAt))) ? new Date(String(b.startedAt)).toISOString() : undefined;
  return { ok: true, p: { session, stations, badge, self, selfVoice, talk, startedAt } };
}
/** تنقية نصّ الطفل قبل الحفظ: بريد/أرقام/روابط، وقصّ إلى 120 حرفًا */
export const scrubChildText = (s: string) => String(s || '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '').replace(/[0-9٠-٩]{3,}/g, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);

/** رسالة لؤلؤ الأسبوعية — قالبيّة بحتة من البيانات (لا نموذج لغويّ) */
export type LetterInput = {
  nick: string; gender: 'm' | 'f';
  sessions: { world: string; badge?: string | null; self?: string | null; homeTaskDone?: boolean; homeTask?: string; supportQ?: string; weekSentence?: string }[];
  said: string[];   // نصوص (فارغة إن لم يُؤذن)
  talkCount: number;
};
export function luluLetter(i: LetterInput): { body: string; sentence: string | null } {
  const f = i.gender === 'f';
  if (!i.sessions.length) return { body: `يا أهل ${i.nick}، لم ${f ? 'تلعب' : 'يلعب'} هذا الأسبوع. جلسة واحدة قصيرة (12 دقيقة) تكفي لتكبر البذرة. أنا في الانتظار! — لؤلؤ 🦜`, sentence: null };
  const worlds = i.sessions.map(s => `«في ${s.world}»`).join(' و');
  const badges = i.sessions.map(s => s.badge).filter(Boolean) as string[];
  const parts: string[] = [];
  parts.push(`هذا الأسبوع ${f ? 'لعبت' : 'لعب'} ${i.nick} ${i.sessions.length === 1 ? 'جلسة' : 'جلستين'} ${worlds}${badges.length ? `، و${f ? 'نالت' : 'نال'} شارة ${badges.map(b => `«${b}»`).join(' و')}` : ''}.`);
  if (i.said.length) parts.push(`${f ? 'قالت' : 'قال'} لي: ${i.said.slice(0, 3).map(s => `«${s}»`).join('، ')}.`);
  else if (i.talkCount) parts.push(`${f ? 'تحدّثت' : 'تحدّث'} معي ${i.talkCount === 1 ? 'مرّة' : 'مرّات'} — ولم تأذنوا بحفظ الكلمات، وهذا حقّكم.`);
  const last = i.sessions[i.sessions.length - 1];
  if (last.homeTask) parts.push(last.homeTaskDone ? `ومهمّة البيت تمّت: ${last.homeTask} 🍎` : `مهمّة البيت تنتظر: ${last.homeTask} — اضغطوا «تَمَّتْ» عندما ${f ? 'تفعلها' : 'يفعلها'}.`);
  if (last.supportQ) parts.push(`اسألوه قبل النوم: ${last.supportQ}`);
  const sentence = last.weekSentence || null;
  if (sentence) parts.push(`جملة الأسبوع نردّدها معًا: «${sentence}».`);
  parts.push('— لؤلؤ 🦜');
  return { body: parts.join(' ').slice(0, 1200), sentence };
}
/** بداية الأسبوع (السبت) بتاريخ ISO */
export function weekStart(d = new Date()): string { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dow = (x.getUTCDay() + 1) % 7; x.setUTCDate(x.getUTCDate() - dow); return x.toISOString().slice(0, 10); }
