/* بَيان (هـ-6-د) — تعليمات لؤلؤ وحَرْف العامّة لبنك الأنشطة: تُسجَّل مرّة واحدة وتُستعمل في كل الجلسات (/public/kids/common/audio) */
export const COMMON = {
  hear:        { who: 'لؤلؤ', text: 'اِسْمَعِ الْكَلِمَةْ… هَلْ تَبْدَأُ بِصَوْتِ الْيَوْمْ؟', audio: 'common:c-hear' },
  nameQ:       { who: 'لؤلؤ', text: 'هَلْ حَرْفُ الْيَوْمِ في اسْمِكْ؟ اُنْظُرْ!', audio: 'common:c-name-q' },
  nameYes:     { who: 'لؤلؤ', text: 'نَعَمْ! حَرْفُ الْيَوْمِ في اسْمِكْ! يا سَلااامْ!', audio: 'common:c-name-yes' },
  nameNo:      { who: 'لؤلؤ', text: 'لَيْسَ في اسْمِكْ… لٰكِنَّهُ في اسْمِ صَديقِنا!', audio: 'common:c-name-no' },
  memory:      { who: 'لؤلؤ', text: 'اِقْلِبْ بِطاقَتَيْنْ… هَلْ هُما مُتَشابِهَتانْ؟', audio: 'common:c-memory' },
  basket:      { who: 'لؤلؤ', text: 'ضَعْ في سَلَّتي ما يَبْدَأُ بِحَرْفِ الْيَوْمِ فَقَطْ!', audio: 'common:c-basket' },
  missing:     { who: 'لؤلؤ', text: 'اُنْظُرْ جَيِّدًا… أُغْمِضْ عَيْنَيْكْ… ماذا اخْتَفى؟ قُلْها… ثُمَّ الْمِسْها!', audio: 'common:c-missing' },
  whatMissing: { who: 'لؤلؤ', text: 'ماذا اخْتَفى؟', audio: 'common:c-what-missing' },
  listen:      { who: 'لؤلؤ', text: 'اِسْمَعْ… ثُمَّ الْمِسِ الصّورَةْ!', audio: 'common:c-listen' },
  faster:      { who: 'لؤلؤ', text: 'أَسْرَعْ قَليلًا!', audio: 'common:c-faster' },
  clap:        { who: 'لؤلؤ', text: 'صَفِّقْ مَعَ كُلِّ مَقْطَعْ… وَاضْغَطْ!', audio: 'common:c-clap' },
  another:     { who: 'لؤلؤ', text: 'لُعْبَةٌ أُخْرى؟', audio: 'common:c-another' },
  star:        { who: 'لؤلؤ', text: 'رائِعْ! نَجْمَةٌ جَديدَةْ!', audio: 'common:c-star' },
  jump:        { who: 'لؤلؤ', text: 'قِفْ! اِقْفِزْ إِذا سَمِعْتَ كَلِمَةً تَبْدَأُ بِحَرْفِ الْيَوْمْ!', audio: 'common:c-jump' },
  parentCheck: { who: 'لؤلؤ', text: 'ماما… بابا… هَلْ قَفَزَ في الْوَقْتِ الصَّحيحْ؟', audio: 'common:c-parent-check' },
  trace:       { who: 'حَرْف', text: 'تَتَبَّعِ الْحَرْفَ بِإِصْبَعِكْ… مِنَ النُّقْطَةِ إِلَى النَّجْمَةْ!', audio: 'common:c-trace' },
  traceAgain:  { who: 'حَرْف', text: 'مَرَّةً أُخْرى… وَحْدَكْ!', audio: 'common:c-trace-again' },
  traceAir:    { who: 'حَرْف', text: 'وَالْآنَ… اِرْسُمْهُ في الْهَواءْ!', audio: 'common:c-trace-air' },
  traceDone:   { who: 'حَرْف', text: 'أَحْسَنْتْ! خَطٌّ جَميلْ!', audio: 'common:c-trace-done' },
  harakat:     { who: 'حَرْف', text: 'اِلْمِسِ الْحَرَكَةْ… ثُمَّ الْمِسِ الْحَرْفْ… وَاسْمَعْ!', audio: 'common:c-harakat' },
} as const;
export type CommonKey = keyof typeof COMMON;

/** كلمات البنك المشتركة (صوت لؤلؤ) */
export const COMMON_WORDS = {
  arnab:   { w: 'أَرْنَبْ',    emoji: '🐰', audio: 'common:w-arnab' },
  asad:    { w: 'أَسَدْ',      emoji: '🦁', audio: 'common:w-asad' },
  anf:     { w: 'أَنْفْ',      emoji: '👃', audio: 'common:w-anf' },
  qamar:   { w: 'قَمَرْ',      emoji: '🌙', audio: 'common:w-qamar' },
  samak:   { w: 'سَمَكْ',      emoji: '🐟', audio: 'common:w-samak' },
  warda:   { w: 'وَرْدَةْ',    emoji: '🌹', audio: 'common:w-warda' },
  batta:   { w: 'بَطَّةْ',     emoji: '🦆', audio: 'common:w-batta' },
  baqara:  { w: 'بَقَرَةْ',    emoji: '🐄', audio: 'common:w-baqara' },
  bahr:    { w: 'بَحْرْ',      emoji: '🌊', audio: 'common:w-bahr' },
  tuffaha: { w: 'تُفّاحَةْ',   emoji: '🍎', audio: 'common:w-tuffaha' },
  bint:    { w: 'بِنْتْ',      emoji: '👧', audio: 'common:w-bint' },
  tin:     { w: 'تينْ',        emoji: '🟣', audio: 'common:w-tin' },
  taj:     { w: 'تاجْ',        emoji: '👑', audio: 'common:w-taj' },
  kura:    { w: 'كُرَةْ',      emoji: '⚪', audio: 'common:w-kura' },
} as const;
