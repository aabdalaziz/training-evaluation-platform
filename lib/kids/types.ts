/* بَيان (هـ-6-ج) — نموذج بيانات الجلسة الموحّد. كل جلسة (البيت، السوق، …) ملف بيانات يملأ هذا الشكل،
 * ومحرّك BayanSession يعرضه. كل النصوص المنطوقة وفق «قاعدة الوقف» (kids/bible/voices.md). */

export type Speaker = 'لؤلؤ' | 'جدّ سالم' | 'أَثير' | 'نُور' | 'يُوسُف' | 'حَرْف' | 'البائع' | 'الرجل' | 'أَبْ' | 'أُمّْ';

export interface Line { who: Speaker; text: string; audio?: string }
export interface Panel { n: number; lines: Line[] }
export interface Said { text: string; audio: string }

export type LuluKey =
  | 'welcome' | 'yasalam' | 'today' | 'question' | 'letsee' | 'chant' | 'play' | 'correct' | 'tryagain'
  | 'hint' | 'mistake' | 'thanks' | 'hmm' | 'brk' | 'act' | 'athari' | 'next';

export interface VocabItem { key: string; w: string; img: string; audio: string }

/** لعبة المحطّة 4 — إمّا مطابقة كلمة/بطاقة (السوق) أو وضع الكلمة في مشهد (البيت) */
export type Game =
  | { kind: 'match'; title: string; luluMistake: { word: string; onto: string } }
  | { kind: 'scene'; title: string; img: string; hotspots: { key: string; x: number; y: number; w: number; h: number }[]; luluMistake: { word: string; onto: string } };

export interface SessionData {
  slug: string;                       // bayt | souq — مجلد الأصول تحت /public/kids/<slug>
  meta: {
    id: string; program: 'بَيان'; level: string; week: number; part: string; world: string;
    letter: string; letterName: string; value: string; minutes: number; order: number;
    hadith: { text: string; source: string };
    badge: { title: string; img: string };
    storyTitle: string;
  };
  lulu: Record<LuluKey, Said>;
  /** زرّ الانتقال من النشيد إلى الحكاية («إِلَى السّوقْ! 🧺») */
  goLabel: string;
  panels: Panel[];
  storyChoice: { after: number; options: { key: string; text: string; emoji: string }[] };
  harf: {
    glyph: 'baa' | 'alif'; name: string; hint: string;
    intro: Said;
    words: { w: string; emoji: string; audio: string }[];
    harakat: { text: string; audio: string; items: { h: string; name: string; color: string; w: string }[] };
  };
  vocab: VocabItem[];
  game: Game;
  roles: { me: { title: string; lines: string[] }; you: { title: string; lines: string[] }; parentTip: string; mePrompt: string };
  hadith: {
    story: { who: Speaker; text: string; audio: string };
    text: string; source: string; repeat: { audio: string };
    lesson: Said; question: Said;
    options: { key: string; text: string; emoji: string; good: boolean; reply: string }[];
    goodLabel: string;
  };
  quran: { intro: Said; meaning: Said; closing: Said; newKidsAyat: number };
  athari: {
    summary: string[]; homeTask: string;
    parentCard: { learned: string; support: string[] };
    bedtime: string;
    selfCheck: { q: string; options: { key: string; emoji: string; text: string }[] };
  };
}

export const kidsImg = (slug: string, n: string) => `/kids/${slug}/img/${n}.jpg`;
export const kidsSnd = (slug: string, n: string) => `/kids/${slug}/audio/${n}.mp3`;
/** وضعيات لؤلؤ الشفّافة المشتركة بين كل الجلسات (من ورقة النموذج المعتمدة) */
export type LuluPose = 'wave' | 'cheer' | 'sleep' | 'point' | 'think' | 'dance' | 'date' | 'calm';
export const luluPose = (p: LuluPose) => `/kids/lulu/${p}.png`;
