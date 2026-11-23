/* هـ-6-ب/ج «بَيان»: حرّاس الجلستين التجريبيتين (البيت · السوق) — سلامة البيانات · الأصول · قاعدة الوقف · صمت لؤلؤ في القرآن والحديث · المعجم · لؤلؤ الحيّة */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SESSIONS, DEFAULT_SESSION, STATIONS, getSession } from '../lib/kids/sessions';
import { FATIHA, ayahUrl } from '../lib/kids/souq';
import { kidsImg, kidsSnd } from '../lib/kids/types';
import { RETIRED_PATTERNS } from '../lib/lexicon';
import { COMMON, COMMON_WORDS } from '../lib/kids/common';

const ROOT = path.join(__dirname, '..');
const exists = (p: string) => fs.existsSync(path.join(ROOT, 'public', p));

test('هـ-6: سجلّ الجلسات — البيت (ا) أولًا ثم السوق (ب) · 8 محطّات · الفاتحة 7 آيات · المصحف المعلّم', () => {
  assert.deepEqual(SESSIONS.map(s => s.slug), ['bayt', 'souq']);
  assert.equal(DEFAULT_SESSION.slug, 'bayt');
  assert.equal(getSession('souq')?.meta.letter, 'ب'); assert.equal(getSession('bayt')?.meta.letter, 'ا');
  assert.equal(getSession('bayt')?.meta.value, 'النظام'); assert.equal(getSession('souq')?.meta.value, 'الأمانة');
  assert.equal(STATIONS.length, 8);
  assert.deepEqual(STATIONS.map(s => s.key), ['start', 'story', 'harf', 'play', 'act', 'hadith', 'quran', 'athari']);
  assert.equal(FATIHA.length, 7);
  assert.equal(ayahUrl(7), 'https://everyayah.com/data/Minshawy_Teacher_128kbps/001007.mp3');
});

for (const S of SESSIONS) {
  test(`هـ-6 [${S.slug}]: بنية الجلسة — 8 لوحات · 4 مفردات · سؤال التفاعل · خيار صالح واحد في الحديث · لعبة متّسقة`, () => {
    assert.equal(S.panels.length, 8); S.panels.forEach((p, i) => assert.equal(p.n, i + 1));
    assert.equal(S.vocab.length, 4); assert.equal(new Set(S.vocab.map(v => v.key)).size, 4);
    assert.ok(S.storyChoice.after >= 3 && S.storyChoice.after <= 6); assert.equal(S.storyChoice.options.length, 2);
    assert.equal(S.hadith.options.filter(o => o.good).length, 1);
    assert.equal(S.quran.newKidsAyat, 3);
    assert.equal(S.harf.words.length, 4); assert.equal(S.harf.harakat.items.length, 3);
    const keys = new Set(S.vocab.map(v => v.key));
    const G0 = S.games[0];
    assert.ok(G0.kind === 'match' || G0.kind === 'scene', 'اللعبة الأولى رئيسة');
    if (G0.kind === 'match' || G0.kind === 'scene') assert.ok(keys.has(G0.luluMistake.word) && keys.has(G0.luluMistake.onto) && G0.luluMistake.word !== G0.luluMistake.onto);
    if (G0.kind === 'scene') { assert.equal(G0.hotspots.length, 4); G0.hotspots.forEach(h => { assert.ok(keys.has(h.key)); assert.ok(h.x >= 0 && h.x + h.w <= 100 && h.y >= 0 && h.y + h.h <= 100, h.key); }); }
  });

  test(`هـ-6 [${S.slug}]: كل الأصول موجودة — اللوحات · البطاقات · الشارة · (المشهد) · كل مفتاح صوتي`, () => {
    for (let i = 1; i <= 8; i++) assert.ok(exists(kidsImg(S.slug, `panel-0${i}`)), `panel-0${i}`);
    for (const v of S.vocab) assert.ok(exists(kidsImg(S.slug, v.img)), v.img);
    assert.ok(exists(kidsImg(S.slug, S.meta.badge.img)), S.meta.badge.img);
    for (const g of [...S.games, ...(S.extraGame ? [S.extraGame] : [])]) if (g.kind === 'scene') assert.ok(exists(kidsImg(S.slug, g.img)), g.img);
    const audio = new Set<string>([
      ...Object.values(S.lulu).map(l => l.audio),
      ...S.panels.flatMap(p => p.lines.map(l => l.audio!).filter(Boolean)),
      S.harf.intro.audio, S.harf.harakat.audio, ...S.harf.words.map(w => w.audio), ...S.vocab.map(v => v.audio),
      S.hadith.story.audio, S.hadith.repeat.audio, S.hadith.lesson.audio, S.hadith.question.audio, ...S.hadith.options.map(o => `s-opt-${o.key}`),
      S.quran.intro.audio, S.quran.meaning.audio, S.quran.closing.audio,
      ...S.harf.activities.flatMap(a => (a.kind === 'hear' ? a.items.map(x => x.audio) : [])),
      ...[...S.games, ...(S.extraGame ? [S.extraGame] : [])].flatMap(g => ('items' in g ? g.items.map(x => x.audio) : [])),
    ]);
    const missing = [...audio].filter(a => !exists(kidsSnd(S.slug, a)));
    assert.deepEqual(missing, [], `أصوات ناقصة: ${missing.join(' ')}`);
  });

  test(`هـ-6 [${S.slug}]: بنك الأنشطة — ≥ 4 أنشطة حرف (منها تتبّع حسّي وأسمع الصوت) · ≥ 3 ألعاب (منها حركية/صوتية) · لعبة إضافية · لا تكرار`, () => {
    const kinds = S.harf.activities.map(a => a.kind);
    assert.ok(kinds.length >= 4 && kinds.includes('trace') && kinds.includes('hear') && kinds[0] === 'morph', kinds.join());
    assert.equal(new Set(kinds).size, kinds.length);
    const gk = S.games.map(g => g.kind);
    assert.ok(gk.length >= 3, gk.join()); assert.equal(new Set(gk).size, gk.length);
    assert.ok(gk.some(k => ['jump', 'clap', 'basket'].includes(k)), 'لعبة حركية/صوتية');
    assert.ok(S.extraGame && !gk.includes(S.extraGame.kind));
    for (const a of S.harf.activities) if (a.kind === 'hear') { assert.ok(a.items.filter(x => x.yes).length >= 3 && a.items.filter(x => !x.yes).length >= 2); }
    for (const g of S.games) if (g.kind === 'clap') for (const it of g.items) assert.ok(it.syllables.length >= 1 && it.syllables.join('') === it.w, it.w);
  });

  test(`هـ-6 [${S.slug}]: قاعدة الوقف — كل جملة منطوقة تنتهي بسكون أو همزة/مدّ`, () => {
    const spoken: string[] = [
      ...S.panels.flatMap(p => p.lines.map(l => l.text)),
      ...Object.values(S.lulu).map(l => l.text),
      S.harf.intro.text, S.harf.harakat.text, ...S.harf.words.map(w => w.w), ...S.vocab.map(v => v.w),
      ...S.roles.me.lines, ...S.roles.you.lines,
      S.hadith.story.text, S.hadith.lesson.text, S.hadith.question.text, ...S.hadith.options.map(o => o.text), ...S.hadith.options.map(o => o.reply),
      S.quran.intro.text, S.quran.meaning.text, S.quran.closing.text,
      ...S.harf.activities.flatMap(a => (a.kind === 'hear' ? a.items.map(x => x.w) : [])),
      ...[...S.games, ...(S.extraGame ? [S.extraGame] : [])].flatMap(g => ('items' in g ? g.items.map(x => x.w) : [])),
    ];
    const bad: string[] = [];
    for (const t of spoken) {
      const chunks = t.split(/[.!؟]+/).map(s => s.trim()).filter(Boolean);
      for (const c of chunks) {
        const last = c.replace(/[»«"']/g, '').trim();
        if (!last) continue;
        const end = last.at(-1)!;
        if (/[…،:]$/.test(last)) continue;
        const ok = end === 'ْ' || end === 'ـ' || /[اىيوءةأإآ]/.test(end) || /\d/.test(end) || /[a-zA-Z]/.test(end);
        if (!ok) bad.push(last);
      }
    }
    assert.deepEqual(bad, [], `كلمات تنتهي بحركة قبل الوقف: ${bad.join(' | ')}`);
  });

  test(`هـ-6 [${S.slug}]: لؤلؤ لا تنطق «خطأ» · المفردات ضمن قائمة الرياض (تغطية ≥ 50%)`, () => {
    for (const l of Object.values(S.lulu)) assert.ok(!/خطأ|غلط/.test(l.text), l.text);
    const cov = JSON.parse(fs.readFileSync(path.join(ROOT, '..', '..', 'kids/curriculum/bayan-riyadh-coverage.json'), 'utf8')) as { covered?: string[]; coverage_pct?: number };
    if (cov.coverage_pct !== undefined) assert.ok(cov.coverage_pct >= 50, `تغطية ${cov.coverage_pct}%`);
  });
}

test('هـ-6: لؤلؤ تصمت في محطّتي الحديث والقرآن · لؤلؤ الحيّة (8 وضعيات شفّافة + حالات) · تُعطَّل الحركة مع prefers-reduced-motion', () => {
  const src = fs.readFileSync(path.join(ROOT, 'app/components/kids/BayanSession.tsx'), 'utf8');
  assert.match(src, /const quiet = station === 'hadith' \|\| station === 'quran'/);
  assert.match(src, /state=\{quiet \? 'calm' : lstate\}/);
  for (const m of ['wave', 'cheer', 'sleep', 'point', 'think', 'dance', 'date', 'calm']) assert.ok(exists(`/kids/lulu/${m}.png`), m);
  const ll = fs.readFileSync(path.join(ROOT, 'app/components/kids/LuluLive.tsx'), 'utf8');
  for (const st of ['idle', 'listen', 'talk', 'wait', 'hint', 'think', 'cheer', 'encourage', 'dance', 'calm']) assert.ok(ll.includes(`.ll-${st}`), st);
  assert.match(ll, /prefers-reduced-motion/);
  assert.match(ll, /--ll-amp/);
});

test('هـ-6: التعليمات العامّة للبنك (/kids/common/audio) موجودة كلّها ووفق قاعدة الوقف', () => {
  for (const [k, L] of Object.entries(COMMON)) assert.ok(exists(kidsSnd('x', L.audio)), k);
  for (const w of Object.values(COMMON_WORDS)) assert.ok(exists(kidsSnd('x', w.audio)), w.w);
  const bad = Object.values(COMMON).map(l => l.text).flatMap(t => t.split(/[.!؟]+/).map(c => c.replace(/[»«]/g, '').trim()).filter(Boolean)).filter(c => !/[…،:]$/.test(c) && !/[ْـاىيوءةأإآ]$/.test(c));
  assert.deepEqual(bad, []);
});

test('هـ-6: معجم أَثَر محفوظ في ملفات بَيان (وليّ الأمر · الطفل · الميسّر)', () => {
  for (const f of ['lib/kids/souq.ts', 'lib/kids/bayt.ts', 'lib/kids/sessions.ts', 'lib/kids/common.ts', 'app/components/kids/activities.tsx', 'app/components/kids/BayanSession.tsx', 'app/components/kids/LuluLive.tsx', 'app/kids/page.tsx']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const P of RETIRED_PATTERNS) {
      const m = s.match(P.re);
      if (m && !(P.allow && P.allow.test(s.slice(Math.max(0, m.index! - 60), m.index! + 60)))) assert.fail(`${f}: ${P.id} ← «${m[0]}»`);
    }
    assert.ok(!/العميل|المنصة/.test(s), f);
  }
});
