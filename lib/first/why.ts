// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P75 «لماذا جاؤوا» — سطور الدخول على الصفحة الرئيسة (الرسمي: Entry Lines on the Homepage) — الجزء الصرف (يُستورد من المتصفّح)
 *  سطر الدخول (P71 «يوم دخلتُ») يسافر إلى الرئيسة بأربعة أقفال، كلها بلا ذكاء اصطناعي:
 *   1) إذن صاحبه (portal_entry_lines.public_ok — افتراضيًّا false للقدامى) · 2) قبول إنساني سابق (مسجَّل ومسكَّن في شعبة)
 *   3) مرشّح نقيّ (entryPublicFilter) · 4) يد الأستاذ («أخفِ عن الرئيسة» → public_ok=false) — وسياسة الجهة home_threads_off.
 *  عتبتان معًا: 20 شخصًا و5 شُعب في 365 يومًا. يسافر النصّ وخطّه فقط — لا اسم ولا بريد ولا برنامج ولا شعبة ولا تاريخ ولا صوت.
 */
export const WHY_LIMITS = { people: 20, sections: 5, items: 7, days: 365, cacheSec: 600, textMin: 12, textMax: 160 } as const;
export const P75_NAMES_AR = {
  why: 'لماذا جاؤوا', why_official: 'سطور الدخول على الصفحة الرئيسة', why_en: 'Why they came',
  sub: 'سطور كتبها متعلّمون يوم دخلوا برامجنا — بلغاتهم كما كتبوها، بلا أسماء',
  consent: 'يجوز أن يظهر سطري على الصفحة الرئيسة — بلا اسمي ولا برنامجي (النصّ فقط، لا الصوت)',
  consent_en: 'My line may appear on the homepage — without my name or program (text only, never the voice)',
  hide_btn: 'أخفِ عن الرئيسة', hidden_note: 'أُخفي سطر الدخول عن الرئيسة بقرار الأستاذ — يبقى لصاحبه',
  copy_tail: '— متعلّم في أَثَر',
} as const;

/* ───────── الخطّ (لا اللغة): شارة صادقة بلا تخمين ───────── */
export type Script = 'arabic' | 'latin' | 'cyrillic' | 'cjk' | 'devanagari' | 'bengali' | 'thai' | 'hangul' | 'other';
const SCRIPTS: Array<[Script, RegExp]> = [
  ['arabic', /[\u0600-\u06FF\u0750-\u077F]/g], ['latin', /[A-Za-z\u00C0-\u024F]/g], ['cyrillic', /[\u0400-\u04FF]/g], ['cjk', /[\u4E00-\u9FFF\u3040-\u30FF]/g],
  ['devanagari', /[\u0900-\u097F]/g], ['bengali', /[\u0980-\u09FF]/g], ['thai', /[\u0E00-\u0E7F]/g], ['hangul', /[\uAC00-\uD7AF\u1100-\u11FF]/g],
];
export const SCRIPT_AR: Record<Script, string> = { arabic: 'بالعربية', latin: 'بالحروف اللاتينية', cyrillic: 'بالكيريلية', cjk: 'بالحروف الصينية/اليابانية', devanagari: 'بالديوناكري', bengali: 'بالبنغالية', thai: 'بالتايلندية', hangul: 'بالكورية', other: 'بلغتهم' };
export function scriptOf(text: string): Script {
  let best: Script = 'other'; let max = 0;
  for (const [k, re] of SCRIPTS) { const n = (String(text || '').match(re) || []).length; if (n > max) { max = n; best = k; } }
  return best;
}
export const dirOf = (s: Script): 'rtl' | 'ltr' => (s === 'arabic' ? 'rtl' : 'ltr');

/* ───────── المرشّح النقيّ ───────── */
/** يُرجع النصّ الصالح للرئيسة أو null: لا @ · لا رابط · لا 6 أرقام متتالية · 12–160 حرفًا · لا تكرار حرف ≥ 5 · لا سطر من رموز فقط */
export function entryPublicFilter(raw: unknown): string | null {
  const t = String(raw ?? '').replace(/\s+/g, ' ').trim(); if (!t) return null;
  const len = [...t].length; if (len < WHY_LIMITS.textMin || len > WHY_LIMITS.textMax) return null;
  if (/@|https?:\/\/|www\.|\.(com|net|org|sa|io)\b/i.test(t)) return null;
  if (/\d[\d\s-]{4,}\d/.test(t)) return null;
  if (/(.)\1{4,}/.test(t)) return null;
  if (!/[\p{L}]{3,}/u.test(t)) return null;
  return t;
}

/* ───────── الخيط ───────── */
export type EntryLite = { id: number; text: string | null; email: string; classroom_id: string | null; org_id: string | null; public_ok: boolean; at: string };
export type WhyItem = { text: string; script: Script; script_ar: string; dir: 'rtl' | 'ltr' };
export type WhyView = { shown: boolean; items: WhyItem[]; people: number; sections: number; head_ar: string; why: 'ok' | 'people' | 'sections' | 'empty' };
export const dayKey = (d: Date) => new Date(d.getTime() + 3 * 3600000).toISOString().slice(0, 10);
const nAr = (n: number, one: string, two: string, few: string, many: string) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`);
function shuffleSeeded<T>(xs: T[], seed: string): T[] { let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } const out = [...xs]; for (let i = out.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; const j = h % (i + 1); [out[i], out[j]] = [out[j], out[i]]; } return out; }

/** يطبّق الأقفال الأربعة على صفوف جاهزة (الشعبة مُلحقة مسبقًا من التسجيل) ويعيد 7 سطور تتبدّل يوميًّا */
export function whyOf(rows: EntryLite[], excludedOrgs: Set<string>, now: Date): WhyView {
  const from = new Date(now.getTime() - WHY_LIMITS.days * 86400000).toISOString();
  const seen = new Set<string>(); const ok: Array<EntryLite & { clean: string }> = [];
  for (const r of rows) {
    if (!r.public_ok || !r.classroom_id || r.at < from) continue; if (r.org_id && excludedOrgs.has(r.org_id)) continue;
    const clean = entryPublicFilter(r.text); if (!clean) continue; const key = clean.toLowerCase(); if (seen.has(key)) continue; seen.add(key);
    ok.push({ ...r, clean });
  }
  const people = new Set(ok.map((r) => r.email.toLowerCase())).size; const sections = new Set(ok.map((r) => r.classroom_id)).size;
  const why: WhyView['why'] = !ok.length ? 'empty' : sections < WHY_LIMITS.sections ? 'sections' : people < WHY_LIMITS.people ? 'people' : 'ok';
  if (why !== 'ok') return { shown: false, items: [], people, sections, head_ar: '', why };
  /* شخص واحد = سطر واحد (الأحدث) ثم خلط ببذرة اليوم */
  const byPerson = new Map<string, typeof ok[number]>(); for (const r of ok) { const k = r.email.toLowerCase(); const cur = byPerson.get(k); if (!cur || r.at > cur.at) byPerson.set(k, r); }
  const items = shuffleSeeded([...byPerson.values()], `why:${dayKey(now)}`).slice(0, WHY_LIMITS.items).map((r) => { const s = scriptOf(r.clean); return { text: r.clean, script: s, script_ar: SCRIPT_AR[s], dir: dirOf(s) }; });
  const head_ar = `جاء إلينا ${nAr(people, 'متعلّم واحد', 'متعلّمان', 'متعلّمين', 'متعلّمًا')} من ${nAr(sections, 'شعبة واحدة', 'شعبتين', 'شُعب', 'شعبة')} وكتبوا لماذا`;
  return { shown: true, items, people, sections, head_ar, why };
}
