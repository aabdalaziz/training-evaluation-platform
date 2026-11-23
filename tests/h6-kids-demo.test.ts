/* هـ-6-ب «بَيان»: حرّاس الجلسة النموذجية «في السوق» — سلامة البيانات · الأصول · قاعدة الوقف · صمت لؤلؤ في القرآن والحديث · المعجم */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SESSION, STATIONS, PANELS, STORY_CHOICE, HARF, VOCAB, HADITH, FATIHA, QURAN, LULU, ayahUrl, img, snd } from '../lib/kids/souq';
import { RETIRED_PATTERNS } from '../lib/lexicon';

const ROOT = path.join(__dirname, '..');
const exists = (p: string) => fs.existsSync(path.join(ROOT, 'public', p));

test('هـ-6: بنية الجلسة — 8 محطّات · 8 لوحات · 4 مفردات · سؤال التفاعل بعد اللوحة 5 · الفاتحة 7 آيات', () => {
  assert.equal(STATIONS.length, 8);
  assert.deepEqual(STATIONS.map(s => s.key), ['start', 'story', 'harf', 'play', 'act', 'hadith', 'quran', 'athari']);
  assert.equal(PANELS.length, 8); PANELS.forEach((p, i) => assert.equal(p.n, i + 1));
  assert.equal(VOCAB.length, 4); assert.equal(new Set(VOCAB.map(v => v.key)).size, 4);
  assert.equal(STORY_CHOICE.after, 5); assert.equal(STORY_CHOICE.options.length, 2);
  assert.equal(FATIHA.length, 7); assert.equal(QURAN.newKidsAyat, 3);
  assert.equal(SESSION.letter, 'ب'); assert.equal(SESSION.value, 'الأمانة');
  assert.equal(HADITH.options.filter(o => o.good).length, 1);
  assert.equal(ayahUrl(7), 'https://everyayah.com/data/Minshawy_Murattal_128kbps/001007.mp3');
});

test('هـ-6: الأصول المرئية موجودة — اللوحات الثماني ووضعيات لؤلؤ الثماني', () => {
  for (let i = 1; i <= 8; i++) assert.ok(exists(img(`panel-0${i}`)), `panel-0${i}`);
  for (const m of ['wave', 'cheer', 'sleep', 'point', 'think', 'dance', 'date', 'quiet']) assert.ok(exists(img(`lulu-${m}`)), m);
  assert.ok(img('x').startsWith('/kids/souq/img/') && snd('x').startsWith('/kids/souq/audio/'));
});

test('هـ-6: قاعدة الوقف — كل جملة منطوقة تنتهي بسكون أو همزة/مدّ (لا حركة إعرابية قبل الوقف)', () => {
  const spoken: string[] = [
    ...PANELS.flatMap(p => p.lines.map(l => l.text)),
    ...Object.values(LULU).map(l => l.text),
    HARF.intro.text, HARF.harakat.text, ...HARF.words.map(w => w.w), ...VOCAB.map(v => v.w),
    HADITH.story.text, HADITH.lesson.text, HADITH.question.text, ...HADITH.options.map(o => o.text),
    QURAN.intro.text, QURAN.meaning.text, QURAN.closing.text,
  ];
  const bad: string[] = [];
  for (const t of spoken) {
    // آخر كلمة قبل كل وقف تامّ (. ! ؟) وفي نهاية النصّ — الفاصلة والنقطتان والحذف وقفات خفيفة تُبقي الحركة
    const chunks = t.split(/[.!؟]+/).map(s => s.trim()).filter(Boolean);
    for (const c of chunks) {
      const last = c.replace(/[»«"']/g, '').trim();
      if (!last) continue;
      const end = last.at(-1)!;
      if (/[…،:]$/.test(last)) continue; // قطعة تنتهي بوقفة خفيفة (مثل «هُوَ…»)
      const ok = end === 'ْ' || end === 'ـ' || /[اىيوءةأإآ]/.test(end) || /\d/.test(end) || /[a-zA-Z]/.test(end);
      if (!ok) bad.push(last);
    }
  }
  assert.deepEqual(bad, [], `كلمات تنتهي بحركة قبل الوقف: ${bad.join(' | ')}`);
});

test('هـ-6: لؤلؤ تصمت في محطّتي الحديث والقرآن، ولا تنطق كلمة «خطأ»', () => {
  const src = fs.readFileSync(path.join(ROOT, 'app/components/kids/BayanSession.tsx'), 'utf8');
  assert.match(src, /const quiet = station === 'hadith' \|\| station === 'quran'/);
  for (const l of Object.values(LULU)) assert.ok(!/خطأ|غلط/.test(l.text), l.text);
});

test('هـ-6: معجم أَثَر محفوظ في ملفات بَيان (وليّ الأمر · الطفل · الميسّر)', () => {
  for (const f of ['lib/kids/souq.ts', 'app/components/kids/BayanSession.tsx', 'app/kids/page.tsx']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const P of RETIRED_PATTERNS) {
      const m = s.match(P.re);
      if (m && !(P.allow && P.allow.test(s.slice(Math.max(0, m.index! - 60), m.index! + 60)))) assert.fail(`${f}: ${P.id} ← «${m[0]}»`);
    }
    assert.ok(!/العميل|المنصة/.test(s), f);
  }
});
