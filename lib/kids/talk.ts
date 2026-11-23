/* «حَديثٌ مَعَ لُؤْلُؤ» — ت1: مطابقة كلمات مفتاحية بلا ذكاء اصطناعي (kids/curriculum/LULU-TALK-SCRIPT-T1.md §6)
 * لا استدعاء شبكة هنا إطلاقًا. المدخل نصّ (من تعرّف المتصفّح أو فارغ)، والمخرج حكم بسيط قابل للاختبار. */

export type TalkRole = 'hello' | 'answer' | 'tell' | 'correct';
export type TalkMatch = 'yes' | 'alt' | 'no' | 'silent';

export type TalkTurn = {
  role: TalkRole;
  /** سؤال لؤلؤ */
  q: { text: string; audio: string };
  /** جذوع مقبولة (بعد التطبيع) */
  accept: string[];
  /** ردّ لؤلؤ عند التطابق (recast) */
  yes: { text: string; audio: string };
  /** إجابة بديلة مقبولة بردّ مختلف (مثل «ما أدري») */
  alt?: { accept: string[]; reply: { text: string; audio: string } };
  /** الجملة النموذج «قُلْها مَعي…» */
  model: { text: string; audio: string };
};

export type TalkScript = {
  turns: TalkTurn[];                       // بالترتيب: أجب · أخبرني · صحّح لي
  final: { text: string; audio: string };  // ختم: إعادة الجمل الثلاث
};

export type TalkResult = { role: TalkRole; heard: string; matched: TalkMatch; attempts: 1 | 2 };

/** الأسطر المشتركة (common:t-*) */
export const TALK_COMMON = {
  call:     { text: 'يا بَطَلْ، تَعالَ نَتَكَلَّمْ! اِضْغَطْ عَلَى الْمَيْكْ… وَقُلْ: أَهْلًا يا لُؤْلُؤ!', audio: 'common:t-call' },
  helloOk:  { text: 'أَهْلًا بِكْ! صَوْتُكَ جَميلْ!', audio: 'common:t-hello-ok' },
  nohear:   { text: 'لَمْ أَسْمَعْ جَيِّدًا… اِقْتَرِبْ مِنَ الْمَيْكْ، وَقُلْها مَرَّةً أُخْرى', audio: 'common:t-nohear' },
  close:    { text: 'قَريبْ! قُلْها مَعي…', audio: 'common:t-close' },
  heard:    { text: 'سَمِعْتُكْ! يا سَلااامْ!', audio: 'common:t-heard' },
  listenQ:  { text: 'هَلْ نَسْمَعُ حَديثَكْ؟', audio: 'common:t-listen-q' },
  self:     { text: 'كَيْفَ كانَ صَوْتُكْ؟', audio: 'common:t-self' },
  bye:      { text: 'شُكْرًا لِحَديثِكْ! غَدًا نَتَكَلَّمُ أَكْثَرْ', audio: 'common:t-bye' },
  tomorrow: { text: 'لا بَأْسْ… غَدًا نَتَكَلَّمْ! شارَتُكَ مَعَكْ', audio: 'common:t-tomorrow' },
  parent:   { text: 'ماما أَوْ بابا… هَلْ قالَها؟', audio: 'common:t-parent' },
} as const;

/** كلمات لا تسألها لؤلؤ أبدًا (خطّ أحمر 1) — تُفحص آليًّا على كلّ أسئلة الحوار */
export const TALK_FORBIDDEN = ['عنوان', 'مدرست', 'اسم عائلت', 'رقم', 'صور', 'تسكن', 'منزلك أين', 'كلمة سر'];

const DIAC = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
/** تطبيع عربي للمقارنة: بلا تشكيل/تطويل · أ إ آ→ا · ة→ه · ى→ي · ؤ ئ→ء · بلا «ال» · بلا أرقام ورموز */
export function normalizeAr(s: string): string {
  return (s || '')
    .replace(DIAC, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ؤئ]/g, 'ء')
    .replace(/[^\u0600-\u06FF\s]/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .split(' ').map(w => w.replace(/^(وال|بال|فال|كال|لل|ال)/, '')).join(' ');
}

const NEG = ['لا', 'غلط', 'خطا', 'مو صح', 'مش صح', 'ليس', 'ما هو'];
const AFFIRM = ['نعم', 'صح', 'ايوه', 'ايوا', 'اكيد', 'صحيح'];

function hasAny(norm: string, stems: string[]): boolean {
  const padded = ` ${norm} `;
  return stems.some(st => { const n = normalizeAr(st); return n.length > 0 && padded.includes(n.length <= 2 ? ` ${n}` : n); }); // الجذوع القصيرة: بداية كلمة
}

/** الحكم على إجابة الطفل في دورة معيّنة */
export function judge(turn: Pick<TalkTurn, 'role' | 'accept' | 'alt'>, heard: string): TalkMatch {
  const n = normalizeAr(heard);
  if (!n) return 'silent';
  if (turn.role === 'hello') return 'yes';                       // أيّ كلام = نجاح
  if (turn.alt && hasAny(n, turn.alt.accept)) return 'alt';
  if (turn.role === 'correct') {
    const neg = hasAny(n, NEG) || hasAny(n, turn.accept);
    const aff = hasAny(n, AFFIRM);
    if (neg) return 'yes';
    if (aff) return 'no';                                        // «نعم» وحدها = لم يصحّح
    return 'no';
  }
  return hasAny(n, turn.accept) ? 'yes' : 'no';
}

/** عدد الكلمات (لحارس «≤ 15 كلمة») */
export const wordCount = (s: string) => normalizeAr(s).split(' ').filter(Boolean).length;

/** هل يدعم هذا المتصفّح التعرّف على الكلام؟ (الوضع أ) */
export function speechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}
export type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
