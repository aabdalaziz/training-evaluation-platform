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
  assert.deepEqual(SESSIONS.map(s => s.slug), ['bayt', 'souq', 'madrasa', 'madrasa2', 'hadiqa', 'hadiqa2', 'masjid', 'masjid2', 'mazraa', 'mazraa2']);
  assert.equal(DEFAULT_SESSION.slug, 'bayt');
  assert.equal(getSession('souq')?.meta.letter, 'ب'); assert.equal(getSession('bayt')?.meta.letter, 'ا');
  assert.equal(getSession('bayt')?.meta.value, 'النظام'); assert.equal(getSession('souq')?.meta.value, 'الأمانة');
  assert.equal(getSession('madrasa')?.meta.letter, 'ت'); assert.equal(getSession('madrasa')?.meta.value, 'التعاون');
  assert.equal(STATIONS.length, 9); // هـ-6-ك: + «نَشيدُ الْجَلْسَة» بعد حَرْف (تظهر فقط للجلسات التي فيها nasheed)
  assert.deepEqual(STATIONS.map(s => s.key), ['start', 'story', 'harf', 'nasheed', 'play', 'act', 'hadith', 'quran', 'athari']);
  assert.equal(FATIHA.length, 7);
  assert.equal(ayahUrl(7), 'https://everyayah.com/data/Minshawy_Teacher_128kbps/001007.mp3');
  assert.equal(ayahUrl(3, 114), 'https://everyayah.com/data/Minshawy_Teacher_128kbps/114003.mp3');
  const M = getSession('madrasa')!; assert.equal(M.quran.surah?.num, 114); assert.equal(M.quran.surah?.ayat.length, 6);
  assert.ok(M.games.some(g => g.kind === 'discover'), 'لعبة نكتشف');
  const M2 = getSession('madrasa2')!; assert.equal(M2.quran.surah?.from, 4); assert.ok(M2.games.some(g => g.kind === 'count') && M2.harf.activities.some(a => a.kind === 'color'), 'عُدّ + لوّن');
  const H5 = getSession('hadiqa')!; assert.equal(H5.meta.letter, 'ث'); assert.equal(H5.quran.surah?.num, 113); assert.equal(H5.quran.surah?.ayat.length, 5); assert.equal(H5.quran.newKidsAyat, 2); assert.equal(H5.quran.meaning.ayah, 1);
  const P = H5.games.find(g => g.kind === 'paint'); assert.ok(P && P.kind === 'paint', 'لعبة لوّن حسب الكلمة');
  if (P && P.kind === 'paint') { assert.equal(P.items.length, 4); const vk = new Set(H5.vocab.map(v => v.key)); P.items.forEach(it => { assert.ok(vk.has(it.key), it.key); assert.ok(it.box.x >= 0 && it.box.x + it.box.w <= 100 && it.box.y >= 0 && it.box.y + it.box.h <= 100, it.key); }); assert.ok(exists(kidsImg('hadiqa', P.line)) && exists(kidsImg('hadiqa', P.color))); }
  const H6 = getSession('hadiqa2')!; assert.equal(H6.quran.surah?.from, 3); assert.equal(H6.quran.meaning.ayah, 3); assert.ok(H6.hadith.review && H6.letter, 'مراجعة الحديث + رسالة من بعيد');
  assert.ok(H6.panels.some(p => p.lines.some(l => l.who === 'أَثير')), 'أوّل ظهور للجار أَثير');
  const M7 = getSession('masjid')!; assert.equal(M7.meta.letter, 'ج'); assert.equal(M7.meta.order, 7); assert.equal(M7.meta.week, 5); assert.equal(M7.quran.surah?.num, 112); assert.equal(M7.quran.surah?.ayat.length, 4); assert.equal(M7.quran.newKidsAyat, 2); assert.equal(M7.quran.meaning.ayah, 1);
  assert.equal(M7.harf.glyph, 'jeem'); assert.ok(M7.hadith.review && M7.letter && M7.letter.from === 'نُور', 'مراجعة الطُّهور + رسالة من نُور');
  assert.ok(M7.panels.some(p => p.lines.some(l => l.who === 'أَبْ')), 'الأب يتكلّم في المسجد');
  const CT = M7.games.find(g => g.kind === 'catch'); assert.ok(CT && CT.kind === 'catch'); if (CT && CT.kind === 'catch') { assert.equal(CT.items.filter(i => i.yes).length, 4); assert.ok(CT.items.filter(i => !i.yes).some(i => i.w === CT.mistake.w), 'كلمة خطأ لؤلؤ من الفوانيس الخاطئة'); CT.items.filter(i => i.yes).forEach(i => assert.ok(i.w.startsWith('ج'), i.w)); }
  const DR = M7.games.find(g => g.kind === 'draw'); assert.ok(DR && DR.kind === 'draw'); if (DR && DR.kind === 'draw') { const vk = new Set(M7.vocab.map(v => v.key)); DR.rounds.forEach(r => assert.ok(vk.has(r.key), r.key)); assert.equal(DR.rounds.length, 2); }
  const M8 = getSession('masjid2')!; assert.equal(M8.meta.order, 8); assert.equal(M8.meta.part, 'ب'); assert.equal(M8.quran.surah?.from, 3); assert.equal(M8.quran.meaning.ayah, 4); assert.equal(M8.quran.newKidsAyat, 2);
  assert.ok(M8.hadith.review && M8.hadith.review.text === 'الصَّلاةُ نورْ' && M8.letter && M8.letter.from === 'يُوسُف', 'تسميع الصَّلاةُ نورْ + رسالة يُوسُف');
  assert.ok(M8.panels.some(p => p.lines.some(l => l.who === 'الْإِمامْ')) && M8.roles.model, 'الإمام يتكلّم + زرّ اسمع الإمام');
  const CL = M8.harf.activities.find(a => a.kind === 'color'); assert.ok(CL && CL.kind === 'color' && CL.words.some(w => (w.w.match(/ج/g) || []).length === 2), 'كلمة فيها جيمان (دَجاجَةْ)');
  const C = M2.games.find(g => g.kind === 'count'); if (C && C.kind === 'count') { assert.ok(C.choices.includes(C.items.filter(i => i.yes).length)); assert.ok(C.nums.length >= C.items.filter(i => i.yes).length); C.items.forEach(h => assert.ok(h.box.x >= 0 && h.box.x + h.box.w <= 100 && h.box.y >= 0 && h.box.y + h.box.h <= 100, h.key)); }
});

for (const S of SESSIONS) {
  test(`هـ-6 [${S.slug}]: بنية الجلسة — 8 لوحات · 4 مفردات · سؤال التفاعل · خيار صالح واحد في الحديث · لعبة متّسقة`, () => {
    assert.equal(S.panels.length, 8); S.panels.forEach((p, i) => assert.equal(p.n, i + 1));
    assert.equal(S.vocab.length, 4); assert.equal(new Set(S.vocab.map(v => v.key)).size, 4);
    assert.ok(S.storyChoice.after >= 2 && S.storyChoice.after <= 6); // المسجد: الخيار بعد اللوحة 2 (لحظة الأذان) باعتماد المالك assert.equal(S.storyChoice.options.length, 2);
    assert.equal(S.hadith.options.filter(o => o.good).length, 1);
    assert.ok(S.quran.newKidsAyat === 3 || (S.quran.newKidsAyat === 2 && (S.quran.surah?.num === 113 || S.quran.surah?.num === 112)), 'آيات جديدة 3 (أو 2 للفلق أ/الإخلاص أ)');
    assert.equal(S.harf.words.length, 4); assert.equal(S.harf.harakat.items.length, 3);
    const keys = new Set(S.vocab.map(v => v.key));
    const G0 = S.games[0];
    assert.ok(G0.kind === 'match' || G0.kind === 'scene' || G0.kind === 'catch', 'اللعبة الأولى رئيسة (فيها جولة لؤلؤ تخطئ)');
    if (G0.kind === 'match' || G0.kind === 'scene') assert.ok(keys.has(G0.luluMistake.word) && keys.has(G0.luluMistake.onto) && G0.luluMistake.word !== G0.luluMistake.onto);
    if (G0.kind === 'scene') { assert.equal(G0.hotspots.length, 4); G0.hotspots.forEach(h => { assert.ok(keys.has(h.key)); assert.ok(h.x >= 0 && h.x + h.w <= 100 && h.y >= 0 && h.y + h.h <= 100, h.key); }); }
  });

  test(`هـ-6 [${S.slug}]: كل الأصول موجودة — اللوحات · البطاقات · الشارة · (المشهد) · كل مفتاح صوتي`, () => {
    for (let i = 1; i <= 8; i++) assert.ok(exists(kidsImg(S.slug, `panel-0${i}`)), `panel-0${i}`);
    for (const v of S.vocab) assert.ok(exists(kidsImg(S.slug, v.img)), v.img);
    assert.ok(exists(kidsImg(S.slug, S.meta.badge.img)), S.meta.badge.img);
    for (const g of [...S.games, ...(S.extraGame ? [S.extraGame] : [])]) if (g.kind === 'scene' || g.kind === 'discover' || g.kind === 'count' || g.kind === 'catch') assert.ok(exists(kidsImg(S.slug, g.img)), g.img);
    for (const g of S.games) if (g.kind === 'draw') g.rounds.forEach(r => assert.ok(exists(kidsImg(S.slug, r.img)), r.img));
    const audio = new Set<string>([
      ...Object.values(S.lulu).map(l => l.audio),
      ...S.panels.flatMap(p => p.lines.map(l => l.audio!).filter(Boolean)),
      S.harf.intro.audio, S.harf.harakat.audio, ...S.harf.words.map(w => w.audio), ...S.vocab.map(v => v.audio),
      S.hadith.story.audio, S.hadith.repeat.audio, S.hadith.lesson.audio, S.hadith.question.audio, ...S.hadith.options.map(o => `s-opt-${o.key}`),
      S.quran.intro.audio, S.quran.meaning.audio, S.quran.closing.audio,
      ...S.harf.activities.flatMap(a => (a.kind === 'hear' ? a.items.map(x => x.audio) : [])),
      ...[...S.games, ...(S.extraGame ? [S.extraGame] : [])].flatMap(g => ('items' in g ? g.items.map(x => x.audio) : [])),
      ...S.games.flatMap(g => (g.kind === 'discover' ? [g.prompt.audio, g.done.audio] : g.kind === 'count' ? [g.prompt.audio, g.ask.audio, g.done.audio, ...g.nums.map(x => x.audio)] : g.kind === 'paint' ? [g.prompt.audio, g.ask.audio, g.near.audio, g.done.audio, ...g.items.map(x => x.ok.audio)] : g.kind === 'catch' ? [g.prompt.audio, g.mistake.say.audio] : g.kind === 'draw' ? [g.prompt.audio, ...g.rounds.flatMap(r => [r.audio, r.done.audio])] : [])),
      ...S.harf.activities.flatMap(a => (a.kind === 'color' ? [a.prompt.audio, a.done.audio, ...a.words.map(x => x.audio)] : [])),
      ...(S.hadith.review ? [S.hadith.review.intro.audio, S.hadith.review.audio] : []),
      ...(S.letter ? [S.letter.audio] : []),
      ...(S.startSfx ? [S.startSfx] : []), ...S.panels.flatMap(p => (p.sfx ? [p.sfx] : [])), ...(S.roles.model ? [S.roles.model.audio] : []),
      ...S.harf.activities.flatMap(a => (a.kind === 'pair' ? [a.prompt.audio, a.fromSound, a.toSound, a.done.audio] : [])),
      ...(S.nasheed ? [...S.nasheed.lines.map(l => l.audio), ...S.nasheed.options.map(o => o.audio), S.nasheed.intro.audio, S.nasheed.ask.audio, S.nasheed.good.audio, S.nasheed.onlyRhyme.audio, S.nasheed.noRhyme.audio, S.nasheed.done.audio] : []),
    ]);
    if (S.letter) assert.ok(exists(S.letter.img), S.letter.img);
    if (typeof S.athari.bedtime !== 'string') { assert.ok(exists(S.athari.bedtime.audio), S.athari.bedtime.audio); assert.ok(exists(S.athari.bedtime.img), S.athari.bedtime.img); }
    const missing = [...audio].filter(a => !exists(kidsSnd(S.slug, a)));
    assert.deepEqual(missing, [], `أصوات ناقصة: ${missing.join(' ')}`);
  });

  test(`هـ-6 [${S.slug}]: بنك الأنشطة — ≥ 4 أنشطة حرف (منها تتبّع حسّي وأسمع الصوت) · ≥ 3 ألعاب (منها حركية/صوتية) · لعبة إضافية · لا تكرار`, () => {
    const kinds = S.harf.activities.map(a => a.kind);
    assert.ok(kinds.length >= 4 && kinds.includes('trace') && kinds.includes('hear') && kinds[0] === 'morph', kinds.join());
    assert.equal(new Set(kinds).size, kinds.length);
    const gk = S.games.map(g => g.kind);
    assert.ok(gk.length >= 3, gk.join()); assert.equal(new Set(gk).size, gk.length);
    assert.ok(gk.some(k => ['jump', 'clap', 'basket', 'catch'].includes(k)), 'لعبة حركية/صوتية');
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
      ...S.games.flatMap(g => (g.kind === 'paint' ? [g.prompt.text, g.near.text, g.done.text, ...g.items.map(x => x.ok.text)] : g.kind === 'catch' ? [g.prompt.text, g.mistake.say.text] : g.kind === 'draw' ? [g.prompt.text, ...g.rounds.flatMap(r => [r.w, r.done.text])] : [])),
      ...(S.hadith.review ? [S.hadith.review.intro.text] : []), ...(S.letter ? [S.letter.text] : []),
      ...(S.talk ? [S.talk.final.text, ...S.talk.turns.flatMap(t => [t.q.text, t.yes.text, t.model.text, ...(t.alt ? [t.alt.reply.text] : [])])] : []),
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

test('هـ-6: نشيد بَيان له صوت (/kids/common/audio/anthem.mp3) وتوقيتات الأسطر تصاعدية داخل المدّة', () => {
  const f = path.join(ROOT, 'public/kids/common/audio/anthem.mp3');
  assert.ok(fs.existsSync(f), 'anthem.mp3');
  assert.ok(fs.statSync(f).size > 150_000, 'الملف أطول من بضع ثوانٍ');
  const src = fs.readFileSync(path.join(ROOT, 'app/components/kids/BayanSession.tsx'), 'utf8');
  const m = src.match(/ANTHEM_AT = \[([^\]]+)\]/); assert.ok(m);
  const at = m![1].split(',').map(Number);
  assert.equal(at.length, 4); at.forEach((t, i) => assert.ok(t > 0 && t < 21 && (i === 0 || t > at[i - 1])));
  assert.ok(/anthem\.mp3/.test(src) && /ANTHEM_AT\.forEach/.test(src), 'النشيد يُشغَّل ويُزامَن');
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

test('نشيد بَيان: السطر الأخير «في قَلْبي وَلِساني» (على وزن «طَيِّبَةْ») في النصّ والصوت المحدَّث', () => {
  const s = fs.readFileSync(path.join(ROOT, 'app/components/kids/BayanSession.tsx'), 'utf8');
  assert.ok(/في قَلْبي وَلِساني'/.test(s) && !/وَلِسانْ/.test(s));
  assert.ok(/في قَلْبي وَلِساني'/.test(fs.readFileSync(path.join(ROOT, 'lib/kids/souq.ts'), 'utf8')));
  assert.ok(fs.statSync(path.join(ROOT, 'public/kids/common/audio/anthem.mp3')).size > 200000);
});

test('هـ-6-ي: نشيد الختام — 5 مقاطع مشتركة + سطر خاصّ لكلّ جلسة (حرفها) موجود صوته، والمحرّك يعرضه بعد حديث لؤلؤ', () => {
  for (let i = 1; i <= 5; i++) assert.ok(fs.existsSync(path.join(ROOT, `public/kids/common/audio/anthem-close-${i}.mp3`)), `anthem-close-${i}`);
  for (const S of SESSIONS) {
    assert.ok(S.closing && S.closing.line.includes('حَرْفُ'), `${S.slug}: سطر الختام`);
    assert.ok(fs.existsSync(path.join(ROOT, `public/kids/${S.slug}/audio/${S.closing!.audio}.mp3`)), `${S.slug}: صوت سطر الختام`);
  }
  const src = fs.readFileSync(path.join(ROOT, 'app/components/kids/BayanSession.tsx'), 'utf8');
  assert.ok(/function ClosingAnthem/.test(src) && /<ClosingAnthem \{\.\.\.p\} \/>/.test(src) && /anthem-close-/.test(src));
});

test('هـ-6-ك: الجلسة 10 «المزرعة ب» — الخاء أخت الحاء · ضَعِ النُّقْطَة · نَشيدُ الْجَلْسَة (إيقاع + قافية) · ديوان الطفل', () => {
  const S = getSession('mazraa2')!; assert.ok(S); assert.equal(S.meta.order, 10); assert.equal(S.meta.letter, 'خ'); assert.equal(S.harf.glyph, 'khaa');
  assert.equal(SESSIONS.length, 10); assert.equal(SESSIONS[9].slug, 'mazraa2');
  // ضَعِ النُّقْطَة: من الحاء إلى الخاء، 3 جولات، صوتان
  const pair = S.harf.activities.find(a => a.kind === 'pair'); assert.ok(pair && pair.kind === 'pair'); assert.equal(pair.from, 'haa'); assert.equal(pair.rounds, 3); assert.equal(pair.toSound, 'h-khaa'); assert.equal(pair.fromSound, 'h-haa');
  // التتبّع 3 ضربات (الثالثة النقطة) · التمييز السمعيّ ح/خ: 3 نعم (خ) و3 لا (ح من الجلسة 9)
  const tr = S.harf.activities.find(a => a.kind === 'trace'); assert.ok(tr && tr.kind === 'trace' && tr.strokes.length === 3);
  const hear = S.harf.activities.find(a => a.kind === 'hear'); assert.ok(hear && hear.kind === 'hear'); assert.equal(hear.items.filter(i => i.yes).length, 3); assert.ok(hear.items.filter(i => !i.yes).every(i => /^\/kids\/mazraa\/audio\/w-h/.test(i.audio)));
  // نشيد الجلسة: 3 أبيات + صدر + 3 خيارات (واحد yes، واحد rhyme، واحد no) وكلّها بأصوات
  const N = S.nasheed!; assert.ok(N); assert.equal(N.lines.length, 3); assert.equal(N.options.length, 3);
  assert.deepEqual(N.options.map(o => o.fits).sort(), ['no', 'rhyme', 'yes']);
  const yes = N.options.find(o => o.fits === 'yes')!; assert.equal(yes.w, 'فَرْحانَةْ');
  // الأبيات الثلاثة والخيار الصحيح على القافية نفسها (ـَةْ) — والخيار «no» ليس عليها
  for (const l of N.lines) assert.ok(/َةْ$/.test(l.text), l.text); assert.ok(/َةْ$/.test(yes.w)); assert.ok(!/َةْ$/.test(N.options.find(o => o.fits === 'no')!.w), 'خيار «لا توزن» لا ينتهي بالقافية'); assert.ok(/َةْ$/.test(N.options.find(o => o.fits === 'rhyme')!.w));
  assert.ok(N.stem.endsWith('…'));
  // الجلسات التسع السابقة بلا نشيد (يُلحَق لاحقًا) — والمحطّة تُخفى لها
  for (const x of SESSIONS.slice(0, 9)) assert.equal(x.nasheed, undefined, x.slug);
  const src = fs.readFileSync(path.join(process.cwd(), 'app/components/kids/BayanSession.tsx'), 'utf8');
  assert.ok(src.includes("STATIONS.filter(x => x.key !== 'nasheed')"), 'المحطّة تُخفى للجلسات بلا نشيد');
  assert.ok(src.includes('function NasheedStation') && src.includes('function Pair') && src.includes("g === 'khaa'"), 'المكوّنات');
  assert.ok(src.includes("p.setVerse(v)") && src.includes('verse: verseRef.current') && src.includes('وَبَيْتي الْيَوْمْ'), 'البيت يُحفَظ ويُقرَأ في أثري اليوم');
  // وليّ الأمر: الديوان + العمود
  const ph = fs.readFileSync(path.join(process.cwd(), 'app/components/kids/ParentHome.tsx'), 'utf8'); assert.ok(ph.includes('kp-diwan') && ph.includes('ديوانُ'));
  const api = fs.readFileSync(path.join(process.cwd(), 'app/api/kids/route.ts'), 'utf8'); assert.ok(api.includes('verse: p.verse || null') && api.includes('r.p.verse'));
  assert.ok(fs.existsSync(path.join(process.cwd(), 'supabase/migrations/20271128_kids_verse.sql')));
  // ختام + قصّة النوم مشتركة مع الجلسة 9
  assert.equal(S.closing?.line, 'حَرْفُ الْخاءْ، وَرَحْمَةٌ لِلطَّيْرْ');
  assert.deepEqual(S.athari.bedtime, getSession('mazraa')!.athari.bedtime);
  // الخيار في الحكاية بعد اللوحة 2 · عُمَر يعود · الشارة
  assert.equal(S.storyChoice.after, 2); assert.equal(S.letter?.from, 'عُمَر'); assert.equal(S.meta.badge.title, 'صَديقُ الْعُشّْ');
});
