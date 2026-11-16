// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P74 «سمعناكم» + «بصوتِ واحدٍ منّا» — المنطق النقي (بلا قاعدة بيانات · يُستورد من المتصفّح)
 *  (أ) «سمعناكم» (الرسمي: خيط لقاءات التأمل على الصفحة الرئيسية): آخر 7 «سطور ساعاتنا» المختومة من كل الشُّعب — يوم أسبوع + سطر، بلا أسماء ولا برامج ولا شُعب.
 *      عتبتان معًا: ≥ 20 مشاركًا مجموعًا و≥ 5 شُعب (في آخر 28 يومًا) — وإلا لا يظهر القسم أصلًا. الأستاذ يطفئه لساعته (meta.public=false) والجهة لشُعبها (home_threads_off).
 *  (ب) «بصوتِ واحدٍ منّا» (الرسمي: القراءة الصوتية لسطر الشعبة): قراءة واحدة ≤ 15 ث لسطر الشعبة المختوم — داخل الشعبة فقط، لا تدخل الرئيسية.
 *  البيانات: خانتان في meta صفّ الختم القائم (public · voice) — صفر جداول.
 */
export const HEARD_LIMITS = { people: 20, sections: 5, items: 7, days: 28, cacheSec: 600, voiceSec: 15, voiceBytes: 1024 * 1024, signedSeconds: 300, bucket: 'athar-media', prefix: 'hour-voice' } as const;
export const P74_NAMES_AR = {
  heard: 'سمعناكم', heard_official: 'خيط لقاءات التأمل على الصفحة الرئيسية', heard_sub: 'سطور كتبتها شُعبنا هذا الأسبوع — في «ساعة أَثَر» الأسبوعية، بلا أسماء',
  voice: 'بصوتِ واحدٍ منّا', voice_official: 'القراءة الصوتية لسطر الشعبة', voice_btn: 'اقرأه بصوتك — بصوتِ واحدٍ منّا',
  consent: 'صوتك سيُسمع لزملاء شعبتك وأستاذك في نسيج الشعبة فقط — لا يصل الصفحة الرئيسية ولا أي تقييم. يمكنك حذفه في أي وقت.',
  public_label: 'يجوز أن يظهر سطر هذه الساعة في «سمعناكم» على الرئيسية (بلا اسم الشعبة ولا البرنامج)',
  removed_by_instructor: 'حُذفت قراءتك بقرار الأستاذ',
} as const;
export const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] as const;

/* ───────── (أ) الخيط العام ───────── */
export type SealLite = { id: number; day: string; line: string | null; people: number; classroom_id: string; org_id: string | null; public: boolean };
export type HeardItem = { weekday_ar: string; day: string; line: string };
export type HeardView = { shown: boolean; items: HeardItem[]; sections: number; people: number; week_sections: number; week_people: number; head_ar: string; why: 'ok' | 'people' | 'sections' | 'empty' };

const dayMs = 86400000;
export const dayKey = (d: Date) => new Date(d.getTime() + 3 * 3600000).toISOString().slice(0, 10); /* يوم الرياض */
export const weekdayAr = (day: string) => WEEKDAYS_AR[new Date(`${day}T00:00:00Z`).getUTCDay()];
const nAr = (n: number, one: string, two: string, few: string, many: string) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`);

/** يقرأ صفّ ختم خامًا إلى شكل خفيف — بلا نصّ غير السطر الجماعي */
export function sealLite(r: { id: unknown; day: unknown; body_ar?: unknown; meta?: any; classroom_id: unknown }, orgOf: (classroomId: string) => string | null): SealLite {
  const line = r.body_ar && String(r.body_ar) !== '—' ? String(r.body_ar) : null; const cid = String(r.classroom_id || '');
  return { id: Number(r.id), day: String(r.day), line, people: Number(r.meta?.people || 0), classroom_id: cid, org_id: orgOf(cid), public: r.meta?.public !== false };
}

/** الخيط: سطر واحد لكل يوم (الأكثر مشاركةً — وعند التعادل الأحدث ختمًا)، آخر 7 أيام فيها سطور، بعتبتَي الأفراد والشُّعب على مدى 28 يومًا */
export function heardOf(seals: SealLite[], excludedOrgs: Set<string>, now: Date): HeardView {
  const today = dayKey(now); const from = dayKey(new Date(now.getTime() - (HEARD_LIMITS.days - 1) * dayMs)); const weekFrom = dayKey(new Date(now.getTime() - 6 * dayMs));
  const ok = seals.filter((s) => s.line && s.public && s.day >= from && s.day <= today && !(s.org_id && excludedOrgs.has(s.org_id)));
  const sections = new Set(ok.map((s) => s.classroom_id)).size; const people = ok.reduce((a, s) => a + s.people, 0);
  const week = ok.filter((s) => s.day >= weekFrom); const week_sections = new Set(week.map((s) => s.classroom_id)).size; const week_people = week.reduce((a, s) => a + s.people, 0);
  const why: HeardView['why'] = !ok.length ? 'empty' : sections < HEARD_LIMITS.sections ? 'sections' : people < HEARD_LIMITS.people ? 'people' : 'ok';
  if (why !== 'ok') return { shown: false, items: [], sections, people, week_sections, week_people, head_ar: '', why };
  const byDay = new Map<string, SealLite>(); for (const s of ok) { const cur = byDay.get(s.day); if (!cur || s.people > cur.people || (s.people === cur.people && s.id > cur.id)) byDay.set(s.day, s); }
  const items = [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0)).slice(0, HEARD_LIMITS.items).map((s) => ({ weekday_ar: weekdayAr(s.day), day: s.day, line: s.line as string }));
  const head_ar = week_sections > 0
    ? `هذا الأسبوع ختمت ${nAr(week_sections, 'شعبة واحدة', 'شعبتان', 'شُعب', 'شعبة')} سطورها بمشاركة ${nAr(week_people, 'متدرّب واحد', 'متدرّبين', 'متدرّبين', 'متدرّبًا')}`
    : `في الأسابيع الأخيرة ختمت ${nAr(sections, 'شعبة واحدة', 'شعبتان', 'شُعب', 'شعبة')} سطورها بمشاركة ${nAr(people, 'متدرّب واحد', 'متدرّبين', 'متدرّبين', 'متدرّبًا')}`;
  return { shown: true, items, sections, people, week_sections, week_people, head_ar, why };
}

/* ───────── (ب) القراءة الصوتية ───────── */
const MIMES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/aac'] as const;
const voiceBase = (m: string) => String(m || '').split(';')[0].trim().toLowerCase();
export const voiceExt = (mime: string) => { const m = voiceBase(mime); return m === 'audio/mp4' || m === 'audio/x-m4a' || m === 'audio/aac' ? 'm4a' : m === 'audio/ogg' ? 'ogg' : m === 'audio/mpeg' ? 'mp3' : m === 'audio/wav' ? 'wav' : 'webm'; };
export function validateHourVoice(input: { mime: string; bytes: number; sec: number }): { ok: true; mime: string; ext: string; sec: number } | { ok: false; error: string } {
  const mime = voiceBase(input.mime); if (!(MIMES as readonly string[]).includes(mime)) return { ok: false, error: 'صيغة الصوت غير مدعومة (webm · m4a · ogg · mp3 · wav)' };
  const bytes = Number(input.bytes) || 0; if (bytes < 200) return { ok: false, error: 'التسجيل فارغ — أعِد المحاولة' }; if (bytes > HEARD_LIMITS.voiceBytes) return { ok: false, error: `التسجيل أكبر من ${Math.round(HEARD_LIMITS.voiceBytes / 1024)} ك.ب` };
  const sec = Math.round(Number(input.sec) || 0); if (sec < 1) return { ok: false, error: 'التسجيل أقصر من ثانية' }; if (sec > HEARD_LIMITS.voiceSec + 1) return { ok: false, error: `قراءة السطر ${HEARD_LIMITS.voiceSec} ثانية كحدّ أقصى` };
  return { ok: true, mime, ext: voiceExt(mime), sec: Math.min(sec, HEARD_LIMITS.voiceSec) };
}
export type HourVoiceStored = { path: string; by: string; sec: number; at: string; mime: string };
export type HourVoicePublic = { sec: number; at: string; mine: boolean };
/** مسار الملف: شعبة/ختم — لا بريد ولا اسم في المسار */
export const hourVoicePath = (classroomId: string, sealId: number, ext: string) => `${HEARD_LIMITS.prefix}/${classroomId}/${sealId}.${ext}`;
export function voiceOfMeta(meta: unknown): HourVoiceStored | null { const v = (meta as any)?.voice; if (!v || typeof v !== 'object' || !v.path || !v.by) return null; return { path: String(v.path), by: String(v.by), sec: Number(v.sec || 0), at: String(v.at || ''), mime: String(v.mime || 'audio/webm') }; }
export const voicePublic = (v: HourVoiceStored | null, meId: string): HourVoicePublic | null => (v ? { sec: v.sec, at: v.at, mine: v.by === meId } : null);
/** من يحذف؟ صاحب القراءة دائمًا · الأستاذ دائمًا · غيرهما لا */
export const canRemoveVoice = (v: HourVoiceStored, me: { id: string; role: 'instructor' | 'learner' }) => v.by === me.id || me.role === 'instructor';
