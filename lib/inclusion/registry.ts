// P32 «أَثَر للجميع» — سجلّ الشمول: الاحتياجات بكلمات الحاجة (لا تشخيص) · ما توفّره البرامج · قواعد k · نصوص أبسط · بيان الوصول
// لا شبكة ولا قاعدة بيانات هنا — دوال نقية تُختبر وحدها.

export const ACCESS_STORAGE_KEY = 'athar_access';          // نسخة محلية للزائر غير المسجَّل (أو قبل المزامنة)
export const ACCESS_K = 5;                                  // لا رقم عن الاحتياجات يُعرض لأي جهة إن كان أصحابه أقل من 5
export const ACCESS_TIME_FACTOR = 1.5;                      // «وقتًا أطول»: مُهل الدعوات والعهود × 1.5
export const ACCESS_SIMPLIFY_LIMIT = 20;                    // طلبات «نسخة أبسط» للمستخدم في اليوم (يُقيَّد أيضًا في AI_LIMITS)
export const ACCESS_HELPS_MAX = 400;
export const ACCESS_REPORT_MAX = 2000;

/** الاحتياج بكلمات صاحبه — الرمز ثابت في القاعدة، والعبارة هي ما يراه الإنسان */
export const NEEDS = ['low_vision', 'screen_reader', 'hard_hearing', 'sign_language', 'motor', 'read_hard', 'focus', 'simple', 'more_time', 'low_bandwidth'] as const;
export type Need = typeof NEEDS[number];
export const NEED_LABEL: Record<Need, { ar: string; en: string }> = {
  low_vision:    { ar: 'أرى بصعوبة',                             en: 'I see with difficulty' },
  screen_reader: { ar: 'أستخدم قارئ شاشة',                        en: 'I use a screen reader' },
  hard_hearing:  { ar: 'أسمع بصعوبة',                             en: 'I hear with difficulty' },
  sign_language: { ar: 'أتواصل بلغة الإشارة',                      en: 'I communicate in sign language' },
  motor:         { ar: 'أستخدم لوحة المفاتيح، والضغط الدقيق صعب',  en: 'I use the keyboard; precise clicks are hard' },
  read_hard:     { ar: 'أقرأ بصعوبة',                             en: 'I read with difficulty' },
  focus:         { ar: 'أتشتّت بسرعة',                            en: 'I get distracted easily' },
  simple:        { ar: 'أحتاج لغة أبسط',                          en: 'I need simpler language' },
  more_time:     { ar: 'أحتاج وقتًا أطول',                        en: 'I need more time' },
  low_bandwidth: { ar: 'إنترنتي ضعيف',                            en: 'My internet is weak' },
};
/** ماذا تفعل البوابة فعلًا لكل احتياج — يُعرض لصاحبه ليعرف ما يتغيّر (لا وعود) */
export const NEED_EFFECT_AR: Record<Need, string> = {
  low_vision: 'تكبير 25٪ · تباين أعلى · إطار تركيز أسمك · «اقرأ لي الصفحة» في كل صفحة',
  screen_reader: 'رابط «تخطَّ إلى المحتوى» · عناوين مرتبة · إشعارات تُقرأ · البطاقات والشهادات بنسخة مقروءة',
  hard_hearing: 'الترجمة الحيّة تُعرض تلقائيًا في الغرف · طلب تشغيلها من المتكلمين دون كشف هويتك · الرسائل نصًا أولًا',
  sign_language: 'مقعد مترجم الإشارة مثبَّت في الغرف · إشعار المنسّق عند تسجيلك في برنامج يوفّر لغة الإشارة',
  motor: 'أهداف لمس أكبر (44 بكسل) · كل شيء بلوحة المفاتيح · لا إيماءات سحب مطلوبة',
  read_hard: 'تباعد أسطر أوسع · سطور أقصر · «اقرأ لي» و«نسخة أبسط» ظاهرتان',
  focus: 'إيقاف الحركة والنبضات · أثير لا يبادر · صفحة واحدة بشيء واحد',
  simple: 'زر «نسخة أبسط» على نصوص البرامج والمواقف — يكتبها الذكاء الاصطناعي ويعتمدها بشر · أثير يجيب بجمل أقصر',
  more_time: 'مُهل الدعوات والعهود × 1.5 · لا مؤقّت في المواقف اليومية والمحاكاة · تذكير قبل انقضاء أي مهلة بأيام',
  low_bandwidth: 'الغرف تبدأ بالصوت وحده · لا فيديو تلقائي · صور بحجم أصغر',
};
export const isNeed = (x: unknown): x is Need => typeof x === 'string' && (NEEDS as readonly string[]).includes(x);
export const cleanNeeds = (xs: unknown): Need[] => { const out: Need[] = []; if (Array.isArray(xs)) for (const x of xs) if (isNeed(x) && !out.includes(x)) out.push(x); return out.slice(0, NEEDS.length); };

/** ما يوفّره البرنامج فعلًا — يضعه الطاقم؛ يُعرض شارةً ويُرشَّح به الكتالوج */
export const FEATURES = ['captions', 'sign_language', 'readable_materials', 'simple_materials', 'extra_time', 'remote_option', 'accessible_venue', 'quiet_room', 'assistant_welcome'] as const;
export type Feature = typeof FEATURES[number];
export const FEATURE_LABEL: Record<Feature, { ar: string; en: string }> = {
  captions:           { ar: 'ترجمة حيّة نصّية',                   en: 'Live captions' },
  sign_language:      { ar: 'مترجم لغة إشارة',                    en: 'Sign-language interpreter' },
  readable_materials: { ar: 'مواد تقرؤها قارئات الشاشة',           en: 'Screen-reader-ready materials' },
  simple_materials:   { ar: 'مواد بلغة أبسط',                     en: 'Plain-language materials' },
  extra_time:         { ar: 'وقت إضافي في التكليفات والاختبارات',  en: 'Extra time on tasks and tests' },
  remote_option:      { ar: 'حضور عن بُعد ممكن',                   en: 'Remote attendance possible' },
  accessible_venue:   { ar: 'مقرّ ميسَّر الوصول',                  en: 'Accessible venue' },
  quiet_room:         { ar: 'غرفة هادئة متاحة',                   en: 'Quiet room available' },
  assistant_welcome:  { ar: 'مرافق شخصي مرحَّب به',               en: 'Personal assistant welcome' },
};
export const isFeature = (x: unknown): x is Feature => typeof x === 'string' && (FEATURES as readonly string[]).includes(x);
export const cleanFeatures = (xs: unknown): Feature[] => { const out: Feature[] = []; if (Array.isArray(xs)) for (const x of xs) if (isFeature(x) && !out.includes(x)) out.push(x); return out; };
/** أي سمات تخدم احتياجًا بعينه — لترشيح «يناسبني» في الكتالوج */
export const NEED_FEATURES: Record<Need, Feature[]> = {
  low_vision: ['readable_materials', 'remote_option'], screen_reader: ['readable_materials'], hard_hearing: ['captions', 'sign_language'], sign_language: ['sign_language', 'captions'],
  motor: ['remote_option', 'accessible_venue', 'assistant_welcome'], read_hard: ['simple_materials', 'extra_time'], focus: ['quiet_room', 'extra_time'], simple: ['simple_materials'], more_time: ['extra_time'], low_bandwidth: ['remote_option'],
};
/** يناسبني: البرنامج يوفّر سمة واحدة على الأقل لكل احتياج أعلنته (الاحتياجات التي لا تحتاج سمة من البرنامج تُهمل) */
export function fitsNeeds(features: string[] | null | undefined, needs: Need[]): boolean {
  const f = new Set(features || []); const relevant = needs.filter(n => NEED_FEATURES[n].length);
  if (!relevant.length) return true;
  return relevant.every(n => NEED_FEATURES[n].some(x => f.has(x)));
}

/** سمات data-access على <html> — CSS الغلاف يقرؤها؛ لا تُرسل إلى أي نموذج ذكاء اصطناعي */
export const accessAttr = (needs: Need[]) => cleanNeeds(needs).join(' ');
/** هل يُطبَّق مُضاعِف الوقت؟ — يكفي أن يكون أحد الطرفين المعنيّين أعلن «وقتًا أطول» */
export const timeFactor = (anyMoreTime: boolean) => (anyMoreTime ? ACCESS_TIME_FACTOR : 1);
/** أيام المهلة بعد المُضاعِف — مُقرَّبة لأعلى */
export const extendedDays = (days: number, factor: number) => Math.ceil(days * factor);

/** إحصاء مجمَّع k≥5: يُسقط كل بند أقل من k ويُرجع 0 بدلًا منه؛ المجموع يظهر فقط إن بلغ k */
export function kAnon<T extends string>(counts: Record<T, number>, k = ACCESS_K): { total: number | null; items: { key: T; n: number }[] } {
  const total = Object.values(counts as Record<string, number>).reduce((a, b) => a + (Number(b) || 0), 0);
  const items = (Object.keys(counts) as T[]).filter(key => (counts[key] || 0) >= k).map(key => ({ key, n: counts[key] })).sort((a, b) => b.n - a.n);
  return { total: total >= k ? total : null, items };
}

/** بصمة سريعة للنص الأصلي (غير تشفيرية) — تكفي لاكتشاف تغيّر الأصل */
export function textHash(s: string): string {
  let h = 2166136261; const t = String(s || '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0') + ':' + t.length;
}

/** مصادر «نسخة أبسط» المسموحة — الخادم يحمّل النص بنفسه ولا يقبل نصًا حرًّا */
export const SIMPLE_SOURCES = ['program_intro', 'program_objectives', 'daily_case', 'page'] as const;
export type SimpleSource = typeof SIMPLE_SOURCES[number];
export const isSimpleSource = (x: unknown): x is SimpleSource => typeof x === 'string' && (SIMPLE_SOURCES as readonly string[]).includes(x);
export type SimpleText = { id: number; source: SimpleSource; source_id: string; original_hash: string; simple_ar: string; status: 'pending' | 'approved' | 'rejected'; created_at: string; approved_at: string | null; model: string | null; note_ar: string | null };
export const SIMPLE_COLS = 'id,created_at,updated_at,source,source_id,original_hash,simple_ar,status,requested_by,approved_by,approved_at,model,note_ar';

/** موجّه «نسخة أبسط»: لغة عربية سهلة — جمل قصيرة، كلمة واحدة لكل فكرة، لا تغيير في المعنى ولا في الأرقام والأسماء */
export function buildSimplifyPrompt(text: string): { system: string; user: string } {
  return {
    system: ['أنت محرّر «اللغة السهلة» في بوابة أَثَر للتعليم والتدريب.', 'أعد كتابة النص بعربية فصيحة سهلة: جمل قصيرة (≤ 12 كلمة)، فكرة واحدة في كل جملة، كلمات شائعة، صيغة المخاطَب، لا مصطلح دون شرح بين قوسين.',
      'لا تضف معلومة ولا تحذف شرطًا أو رقمًا أو تاريخًا أو اسمًا. لا تمدح ولا تَعِد. لا تذكر أنك ذكاء اصطناعي.', 'أعد JSON فقط: {"simple_ar": string}'].join('\n'),
    user: `النص الأصلي:\n"""\n${String(text || '').slice(0, 4000)}\n"""`,
  };
}
/** بديل محلي حين لا مفتاح: تقطيع الجمل الطويلة عند الفواصل وحذف الحشو — صادق ومتواضع */
export function localSimplify(text: string): string {
  const t = String(text || '').replace(/\s+/g, ' ').trim(); if (!t) return '';
  const sentences = t.split(/(?<=[.!؟?؛])\s+|،\s+(?=و?\S{3,})/).map(s => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (let s of sentences) { s = s.replace(/^(و|ف)?(كما|حيث|إذ|بحيث|علمًا بأن|مع العلم أن)\s+/u, ''); if (s.length > 2) out.push(/[.!؟?]$/.test(s) ? s : s + '.'); }
  return out.join('\n');
}
export function parseSimplify(raw: unknown): { simple_ar: string } | null {
  const o = raw && typeof raw === 'object' ? (raw as any) : null; const s = o && typeof o.simple_ar === 'string' ? o.simple_ar.trim() : '';
  return s.length >= 10 ? { simple_ar: s.slice(0, 6000) } : null;
}

/** الترجمة الحيّة في الغرف — رسالة إشارة جديدة على القناة نفسها */
export type CaptionMsg = { type: 'caption'; from: string; name?: string; text: string; final: boolean; at: number };
export const CAPTION_TTL_MS = 7000;        // تختفي السطور بعد 7 ثوانٍ من آخر تحديث
export const CAPTION_MAX_LINES = 3;
export const CAPTION_LANG: Record<'ar' | 'en', string> = { ar: 'ar-SA', en: 'en-US' };
/** دمج سطر وارد في اللوح: سطر واحد لكل متكلّم؛ النهائي يثبّت ثم يُنسى بعد TTL */
export function mergeCaption(lines: CaptionMsg[], m: CaptionMsg, now = Date.now()): CaptionMsg[] {
  const alive = lines.filter(l => now - l.at < CAPTION_TTL_MS && l.from !== m.from);
  return [...alive, m].slice(-CAPTION_MAX_LINES);
}

/** دور الحاضر في الغرفة — يُبثّ مع الحضور، ويُثبَّت مقعد مترجم الإشارة أولًا وأكبر */
export type RoomRole = 'member' | 'interpreter';
export const INTERPRETER_LABEL_AR = 'مترجم لغة الإشارة';
export function orderTiles<T extends { id: string; role?: RoomRole | null }>(tiles: T[]): T[] {
  return [...tiles].sort((a, b) => Number(b.role === 'interpreter') - Number(a.role === 'interpreter'));
}

/** بلاغ وصول */
export type AccessReport = { id: number; created_at: string; page: string; text_ar: string; contact: string | null; user_id: string | null; status: 'open' | 'fixed' | 'wontfix'; staff_note: string | null; closed_at: string | null };
export const REPORT_COLS = 'id,created_at,page,text_ar,contact,user_id,status,staff_note,closed_at';
export const REPORT_STATUS_AR: Record<AccessReport['status'], string> = { open: 'مفتوح', fixed: 'أُصلح', wontfix: 'لن يُصلح (مع السبب)' };
export function validateReport(b: { page?: unknown; text?: unknown; contact?: unknown }): string | null {
  const page = String(b.page || '').trim(); const text = String(b.text || '').trim(); const contact = String(b.contact || '').trim();
  if (!page.startsWith('/') || page.length > 200) return 'الصفحة غير صالحة';
  if (text.length < 5) return 'صف العائق بخمسة أحرف على الأقل';
  if (text.length > ACCESS_REPORT_MAX) return `النص أطول من ${ACCESS_REPORT_MAX} حرف`;
  if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return 'البريد غير صالح';
  return null;
}

/** بيان الوصول — ما نلتزم به (مقياس WCAG 2.2 AA) وما نعرف أنه لم يكتمل بعد. الأعداد من آخر فحص آلي يُجريه الفريق قبل كل إصدار */
export const ACCESS_STATEMENT = {
  standard: 'WCAG 2.2 — المستوى AA',
  scope_ar: 'بوابة أَثَر كاملة (الصفحات العامة، صفحات المنسوب، بوابة الجهات، الغرف الحيّة، صفحات التحقق) — ما عدا ملفات PDF القديمة الصادرة قبل 2026',
  commitments_ar: [
    'كل صفحة تعمل بلوحة المفاتيح وحدها، وإطار التركيز مرئي دائمًا',
    'كل حقل له عنوان مقروء، وكل صورة ذات معنى لها بديل نصّي',
    'تباين النص 4.5:1 على الأقل، والتكبير إلى 200٪ لا يكسر الصفحة',
    'لا مؤقّت يُسقط عملك في المواقف اليومية والمحاكاة والمجالس؛ ومُهل الدعوات تُمدَّد لمن طلب وقتًا أطول',
    'الغرف الحيّة فيها ترجمة حيّة نصّية ومقعد لمترجم لغة الإشارة',
    'الشهادات والبطاقات لها نسخة HTML مقروءة آليًا بجانب الصورة',
    'ملف احتياجاتك خاص بك، لا يراه الطاقم إلا إن سمحت، ولا يُرسل إلى أي نموذج ذكاء اصطناعي',
  ],
  known_gaps_ar: [
    'الترجمة الحيّة تعتمد على تعرّف الكلام في متصفح المتكلّم — دقتها بالعربية جيدة لا كاملة، وهي لا تعمل في بعض المتصفحات',
    'لا مترجم لغة إشارة بشري متاح في كل برنامج بعد؛ المقعد جاهز والشراكة قيد الترتيب',
    'اختبار مِعيار لتحديد المستوى تطبيق منفصل، والوقت الإضافي فيه لم يُفعَّل بعد',
    'بعض صور شهادات ما قبل 2026 لا تحمل بديلًا نصيًا كاملًا',
  ],
  contact_ar: 'لأي عائق: زر «أخبرنا بعائق» في أسفل كل صفحة، أو البريد المذكور في التذييل. نرد خلال 5 أيام عمل.',
  review_months: 6,
};
/** آخر فحص آلي (tools/audit-a11y.py) — يُحدَّث مع كل إصدار؛ الصدق أولًا */
export const ACCESS_AUDIT = { at: '2026-10-31', pages: 0, issues: { missing_labels: 0, small_targets: 0, missing_alt: 0, no_h1: 0, low_contrast: 0 }, tool: 'playwright + axe-like checks (tools/audit-a11y.py)' };

export const PRIVACY_ACCESS_AR = [
  'الاحتياج يُكتب بكلمات الحاجة («أرى بصعوبة») لا بتشخيص، ولا نطلب أي وثيقة',
  'الملف خاص بصاحبه — لا يراه الطاقم إلا إن سمح صاحبه عند تنسيق برنامج',
  'لا يُرسل الملف ولا أي رمز منه إلى نماذج الذكاء الاصطناعي؛ «نسخة أبسط» تُولَّد من النص العام وحده',
  'الإحصاءات العامة مجمَّعة: لا رقم عن احتياج أقل من 5 أشخاص',
  'يُحذف الملف فورًا بزر «احذف ملفي» ومع حذف الحساب (خزنة أَثَر)',
];
