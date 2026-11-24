import type { TalkScript } from './talk';
/* بَيان (هـ-6-ج) — نموذج بيانات الجلسة الموحّد. كل جلسة (البيت، السوق، …) ملف بيانات يملأ هذا الشكل،
 * ومحرّك BayanSession يعرضه. كل النصوص المنطوقة وفق «قاعدة الوقف» (kids/bible/voices.md). */

export type Speaker = 'لؤلؤ' | 'جدّ سالم' | 'ياسين' | 'أَميرَة' | 'مُحَمَّد' | 'حَرْف' | 'البائع' | 'الرجل' | 'أَبْ' | 'أُمّْ' | 'الْمُعَلِّمَة';

export interface Line { who: Speaker; text: string; audio?: string }
export interface Panel { n: number; lines: Line[] }
export interface Said { text: string; audio: string }

export type LuluKey =
  | 'welcome' | 'yasalam' | 'today' | 'question' | 'letsee' | 'chant' | 'play' | 'correct' | 'tryagain'
  | 'hint' | 'mistake' | 'thanks' | 'hmm' | 'brk' | 'act' | 'athari' | 'next';

export interface VocabItem { key: string; w: string; img: string; audio: string }

/** أنشطة «حَرْف يرسم» (بنك هـ-6-د) — morph = التحوّل البصري الموجود؛ trace = تتبّع بالإصبع؛ hear = أسمع الصوت؛ name = الحرف في اسمي */
export type HarfActivity =
  | { kind: 'morph' }
  | { kind: 'trace'; strokes: string[] }
  | { kind: 'hear'; items: SoundItem[] }
  | { kind: 'name'; letterRe: string; fallback: string }
  /** نلوّن (الأسبوع 3 ب): «لَوِّنِ الحرف» — كلمة كبيرة حرفًا حرفًا، الطفل يلمس كلّ حرف يوم فيتلوّن */
  | { kind: 'color'; words: { w: string; audio: string }[]; prompt: Said; done: Said };

/** عنصر صوتي عامّ: كلمة + مفتاح صوتها ('common:' = من /kids/common/audio) + هل تبدأ بحرف اليوم */
export interface SoundItem { w: string; emoji: string; audio: string; yes: boolean }

/** ألعاب المحطّة 4 (بنك هـ-6-د). الأولى في المصفوفة هي اللعبة الرئيسة وتحمل جولة «لؤلؤ تخطئ» */
export type Game =
  | { kind: 'match'; title: string; luluMistake: { word: string; onto: string } }
  | { kind: 'scene'; title: string; img: string; hotspots: { key: string; x: number; y: number; w: number; h: number }[]; luluMistake: { word: string; onto: string } }
  | { kind: 'memory'; title: string }
  | { kind: 'missing'; title: string; rounds: number }
  | { kind: 'listen'; title: string; rounds: number }
  | { kind: 'clap'; title: string; items: { w: string; audio: string; syllables: string[] }[] }
  | { kind: 'jump'; title: string; items: SoundItem[] }
  | { kind: 'basket'; title: string; items: SoundItem[] }
  /** نكتشف (الأسبوع 3): «ابحث عن الحرف في بيتك» — أشياء حقيقيّة يحضرها الطفل، بلا كاميرا؛ prompt/done بصوت لؤلؤ */
  | { kind: 'discover'; title: string; img: string; items: SoundItem[]; prompt: Said; done: Said }
  /** نكتشف/عُدّ (الأسبوع 3 ب): مشهد مرسوم بمواقع لمس؛ الطفل يلمس ما يبدأ بحرف اليوم فيُعَدّ بصوت لؤلؤ (nums[0..]) ثمّ يختار العدد */
  | { kind: 'count'; title: string; img: string; items: (SoundItem & { key: string; box: { x: number; y: number; w: number; h: number } })[]; prompt: Said; ask: Said; nums: Said[]; done: Said; choices: number[] };

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
    glyph: 'baa' | 'alif' | 'taa'; name: string; hint: string;
    activities: HarfActivity[];
    intro: Said;
    words: { w: string; emoji: string; audio: string }[];
    harakat: { text: string; audio: string; items: { h: string; name: string; color: string; w: string }[] };
  };
  vocab: VocabItem[];
  /** الألعاب: [رئيسة (مع جولة لؤلؤ), ثانية, …] */
  games: Game[];
  /** لعبة اختيارية بزرّ «لُعْبَةٌ أُخْرى؟» خارج زمن الجلسة */
  extraGame?: Game;
  roles: { me: { title: string; lines: string[] }; you: { title: string; lines: string[] }; parentTip: string; mePrompt: string };
  hadith: {
    story: { who: Speaker; text: string; audio: string };
    text: string; source: string; repeat: { audio: string };
    lesson: Said; question: Said;
    options: { key: string; text: string; emoji: string; good: boolean; reply: string }[];
    goodLabel: string;
  };
  /** surah اختياري: بدونه تُعرَض الفاتحة (الجلستان 1–2). مع الأسبوع 3: سورة الناس (114) */
  quran: { intro: Said; meaning: Said & { ayah?: number /* يتلو الشيخ هذه الآية أولًا ثم يشرح جدّ سالم — الصوت الصناعي لا يتلو القرآن */ }; closing: Said; newKidsAyat: number; surah?: { num: number; name: string; ayat: string[]; from?: number } };
  /** «حَديثٌ مَعَ لُؤْلُؤ» (ت1) — اختياري حتى تُسجَّل أصوات الجلسة */
  talk?: TalkScript;
  athari: {
    summary: string[]; homeTask: string;
    parentCard: { learned: string; support: string[] };
    bedtime: string;
    selfCheck: { q: string; options: { key: string; emoji: string; text: string }[] };
  };
}

export const kidsImg = (slug: string, n: string) => `/kids/${slug}/img/${n}.jpg`;
export const kidsSnd = (slug: string, n: string) => (n.startsWith('/') ? n : n.startsWith('common:') ? `/kids/common/audio/${n.slice(7)}.mp3` : `/kids/${slug}/audio/${n}.mp3`);
/** وضعيات لؤلؤ الشفّافة المشتركة بين كل الجلسات (من ورقة النموذج المعتمدة) */
export type LuluPose = 'wave' | 'cheer' | 'sleep' | 'point' | 'think' | 'dance' | 'date' | 'calm';
export const luluPose = (p: LuluPose) => `/kids/lulu/${p}.png`;
