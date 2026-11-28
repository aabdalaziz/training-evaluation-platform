import type { TalkScript } from './talk';
/* بَيان (هـ-6-ج) — نموذج بيانات الجلسة الموحّد. كل جلسة (البيت، السوق، …) ملف بيانات يملأ هذا الشكل،
 * ومحرّك BayanSession يعرضه. كل النصوص المنطوقة وفق «قاعدة الوقف» (kids/bible/voices.md). */

export type Speaker = 'لؤلؤ' | 'جدّ سالم' | 'ياسين' | 'أَميرَة' | 'مُحَمَّد' | 'حَرْف' | 'البائع' | 'الرجل' | 'أَبْ' | 'أُمّْ' | 'الْمُعَلِّمَة' | 'أَثير' | 'الْإِمامْ' | 'الْفَلّاحْ';

export interface Line { who: Speaker; text: string; audio?: string }
export interface Panel { n: number; lines: Line[]; /** مؤثّر صوتيّ يُشغَّل قبل سطور اللوحة (مثل الأذان من بعيد) */ sfx?: string }
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
  | { kind: 'color'; words: { w: string; audio: string }[]; prompt: Said; done: Said }
  /** ضَعِ النُّقْطَة (الأسبوع 7 ب): الأختان — حرف اليوم (glyph الجلسة) وأخته بلا نقطة `from`؛ لمس فوق الحرف يضع النقطة ويُسمَع `toSound`، ولمسها يزيلها ويُسمَع `fromSound`؛ `rounds` ذهابًا وإيابًا ثمّ `done` */
  | { kind: 'pair'; from: GlyphKey; prompt: Said; fromSound: string; toSound: string; rounds: number; done: Said };

/** رسوم الحروف المتاحة في المحرّك (Glyph) */
export type GlyphKey = 'baa' | 'alif' | 'taa' | 'thaa' | 'jeem' | 'haa' | 'khaa';

/** نَشيدُ الْجَلْسَة (اقتراح المالك 28/11 — NASHEED-JALSA-PROPOSAL.md): 4 أبيات على إيقاع «دُمْ تَكْ تَكْ» وقافية واحدة.
 *  الدرجة أ: الطفل يُصَفِّق الإيقاع مع الأبيات الثلاثة (نقاط تُضيء) · الدرجة ب: البيت الرابع ناقص كلمته الأخيرة، 3 بطاقات: fits='yes' توزن وتصحّ معنًى · 'rhyme' توزن ولا تصحّ · 'no' لا توزن.
 *  لؤلؤ تُنشد اختيار الطفل كما هو (audio كلّ خيار = البيت الرابع كاملًا بتلك الكلمة) ثمّ تعلّق؛ البيت المختار يُحفَظ في «ديوان الطفل» (verse). */
export interface Nasheed {
  title: string;
  /** الأبيات الثلاثة الأولى (نصّ + صوت لؤلؤ تُنشد) */
  lines: [Said, Said, Said];
  /** صدر البيت الرابع بلا كلمته الأخيرة («وَالْحَمامَةُ عادَتْ…») */
  stem: string;
  /** القافية التي نبحث عنها (تُعرَض تلميحًا: «…ـَةْ») */
  rhyme: string;
  options: { key: string; w: string; emoji: string; fits: 'yes' | 'rhyme' | 'no'; audio: string }[];
  intro: Said; ask: Said; good: Said; onlyRhyme: Said; noRhyme: Said; done: Said;
}

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
  | { kind: 'count'; title: string; img: string; items: (SoundItem & { key: string; box: { x: number; y: number; w: number; h: number } })[]; prompt: Said; ask: Said; nums: Said[]; done: Said; choices: number[] }
  /** نلوّن حسب الكلمة (الأسبوع 4): مشهد خطّي + المشهد نفسه ملوّنًا؛ لؤلؤ تقول الكلمة (ask + صوت الكلمة)، الطفل يلمس الشيء في المشهد فيتلوّن (يُكشَف من الصورة الملوّنة) ويُقال ok؛ لمس غيره → near */
  | { kind: 'paint'; title: string; line: string; color: string; items: { key: string; w: string; audio: string; box: { x: number; y: number; w: number; h: number }; ok: Said }[]; prompt: Said; ask: Said; near: Said; done: Said }
  /** صَيْدُ الْكَلِمَةْ (الأسبوع 5): فوانيس تصعد في سماء المشهد (img خلفيّة)، على كلّ فانوس صورة وكلمة؛ الطفل يصطاد ما يبدأ بحرف اليوم (yes). ثمّ جولة «لؤلؤ تخطئ»: تدّعي أنّ كلمة (mistake.w) تبدأ بالحرف والطفل يصحّح */
  | { kind: 'catch'; title: string; img: string; items: SoundItem[]; prompt: Said; mistake: { w: string; say: Said } }
  /** اِرْسَمْ ما سَمِعْتْ (الأسبوع 5): لؤلؤ تقول الكلمة بلا صورة، الطفل يرسم بإصبعه، ثمّ تُكشَف بطاقة الكلمة بجانب رسمه (بلا تقييم آليّ)؛ الرسم يُحفَظ محلّيًّا لبطاقة وليّ الأمر */
  | { kind: 'draw'; title: string; prompt: Said; rounds: { key: string; w: string; audio: string; img: string; done: Said }[] };

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
  /** مؤثّر يُشغَّل بعد «الْيَوْمَ…» في الافتتاح (الأذان من بعيد) */
  startSfx?: string;
  /** نشيد الختام (هـ-6-ي): السطر الثالث الخاصّ بالجلسة (حرفها وقيمتها) على وزن «حَرْفٌ وَكَلِمَةْ، وَآيَةٌ طَيِّبَةْ» — يُغنّى بين سطرَي النشيد المشتركَين؛ الصوت مفتاح في مجلّد الجلسة */
  closing?: { line: string; audio: string };
  /** نَشيدُ الْجَلْسَة 🎶 — محطّة بعد «حَرْف يرسم» (تظهر فقط إن وُجدت) */
  nasheed?: Nasheed;
  panels: Panel[];
  storyChoice: { after: number; options: { key: string; text: string; emoji: string }[] };
  harf: {
    glyph: GlyphKey; name: string; hint: string;
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
  roles: { me: { title: string; lines: string[] }; you: { title: string; lines: string[] }; parentTip: string; mePrompt: string; /** نموذج يسمعه الطفل قبل أن يمثّل (مثل صوت المؤذّن) */ model?: { label: string; audio: string } };
  hadith: {
    story: { who: Speaker; text: string; audio: string };
    text: string; source: string; repeat: { audio: string };
    lesson: Said; question: Said;
    options: { key: string; text: string; emoji: string; good: boolean; reply: string }[];
    goodLabel: string;
    /** مراجعة مطويّة (الجلسة ب): حديث الأسبوع الماضي — جدّ سالم يقدّمه ثمّ يُردَّد مرّة بصوته المسجَّل (audio قد يكون مسارًا مطلقًا من مجلّد الجلسة السابقة) */
    review?: { text: string; source: string; intro: Said; audio: string };
  };
  /** «رِسالَةٌ مِنْ بَعيدْ» 📬 (المرحلة ج من خطّة الأحفاد): مقطع من أحد أحفاد جدّ سالم في «أثري اليوم» قبل «حديث مع لؤلؤ» */
  letter?: { from: string; img: string; text: string; audio: string; button: string };
  /** surah اختياري: بدونه تُعرَض الفاتحة (الجلستان 1–2). مع الأسبوع 3: سورة الناس (114) */
  quran: { intro: Said; meaning: Said & { ayah?: number /* يتلو الشيخ هذه الآية أولًا ثم يشرح جدّ سالم — الصوت الصناعي لا يتلو القرآن */ }; closing: Said; newKidsAyat: number; surah?: { num: number; name: string; ayat: string[]; from?: number } };
  /** «حَديثٌ مَعَ لُؤْلُؤ» (ت1) — اختياري حتى تُسجَّل أصوات الجلسة */
  talk?: TalkScript;
  athari: {
    summary: string[]; homeTask: string;
    parentCard: { learned: string; support: string[] };
    /** قصّة قبل النوم: نصّ (قريبًا) أو كائن قابل للتشغيل 🌙 (/kids/bedtime/<file>) */
    bedtime: string | { title: string; audio: string; img: string; minutes: number; video?: string };
    selfCheck: { q: string; options: { key: string; emoji: string; text: string }[] };
  };
}

export const kidsImg = (slug: string, n: string) => `/kids/${slug}/img/${n}.jpg`;
export const kidsSnd = (slug: string, n: string) => (n.startsWith('/') ? n : n.startsWith('common:') ? `/kids/common/audio/${n.slice(7)}.mp3` : `/kids/${slug}/audio/${n}.mp3`);
/** وضعيات لؤلؤ الشفّافة المشتركة بين كل الجلسات (من ورقة النموذج المعتمدة) */
export type LuluPose = 'wave' | 'cheer' | 'sleep' | 'point' | 'think' | 'dance' | 'date' | 'calm';
export const luluPose = (p: LuluPose) => `/kids/lulu/${p}.png`;
