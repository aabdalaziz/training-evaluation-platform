// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { INTRO_CHILD, INTRO_PARENTS, FOUNDER_SIGN, introAudioFiles, INTRO_DEMO_KEY } from '../lib/kids/intro';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p: string) => fs.existsSync(path.join(ROOT, p));

test('افتتاحية بَيان: (أ) لؤلؤ أوّلًا ثمّ الأصدقاء الأربعة ثمّ جدّ سالم ثمّ المحطّات الخمس ثمّ الوعد — بقاعدة الوقف وبلا نداء مُذكَّر', () => {
  assert.equal(INTRO_CHILD.length, 5);
  assert.equal(INTRO_CHILD[0].lines[0].who, 'lulu');
  assert.deepEqual(INTRO_CHILD[1].lines.map(l => l.who), ['athir', 'nour', 'yusuf', 'harf']);
  assert.equal(INTRO_CHILD[2].lines[0].who, 'salem');
  assert.equal(INTRO_CHILD[3].icons!.length, 5); const ats = INTRO_CHILD[3].icons!.map(i => i.at); assert.deepEqual([...ats].sort((a, b) => a - b), ats);
  assert.equal(INTRO_CHILD[4].img, 'lulu');
  for (const sc of INTRO_CHILD) for (const l of sc.lines) {
    const t = l.text.replace(/[!؟.…]+$/, '');
    // آخر كلمة قبل الوقف: سكون صريح، أو حرف مدّ، أو ﷺ
    assert.ok(/[ْاىيو]$|ﷺ$/.test(t), `وقف: ${l.text.slice(-12)}`);
    assert.ok(!/يا بَطَلْ|يا بَطَلَةْ|أَنْتَ |مَعَكَ /.test(l.text), `نداء محايد: ${l.text}`);
  }
});

test('افتتاحية بَيان: (ب) خمسة مشاهد بصوت جدّ سالم بعناوين، وكلمة المؤسّس مكتوبة في الختام', () => {
  assert.equal(INTRO_PARENTS.length, 5);
  for (const sc of INTRO_PARENTS) { assert.ok(sc.title); assert.ok(sc.lines.every(l => l.who === 'salem')); }
  assert.ok(INTRO_PARENTS[4].written && INTRO_PARENTS[4].written.length > 80);
  assert.ok(/مؤسّس أَثَر/.test(FOUNDER_SIGN));
  assert.ok(/عَشْرُ دَقائِقَ/.test(INTRO_PARENTS[2].lines[0].text), 'دور وليّ الأمر: 10 دقائق يوميًّا');
});

test('افتتاحية بَيان: كلّ لوحة وكلّ مقطع صوتيّ موجود في public/kids/intro', () => {
  const imgs = new Set([...INTRO_CHILD, ...INTRO_PARENTS].map(s => s.img).filter(i => i !== 'lulu'));
  for (const i of imgs) assert.ok(exists(`public/kids/intro/${i}.jpg`), `لوحة ${i}`);
  for (const a of introAudioFiles([...INTRO_CHILD, ...INTRO_PARENTS])) assert.ok(exists(`public/kids/intro/audio/${a}.mp3`), `صوت ${a}`);
});

test('افتتاحية بَيان: المواضع — بعد بوّابة الكبار مرّة واحدة (intro_seen_at) ويُعاد من «قصّتنا»، وفي العرض العامّ بمفتاح محلّي، و(ب) في /kids و/kids/parent', () => {
  const kp = read('app/components/kids/KidPlay.tsx'); const bs = read('app/components/kids/BayanSession.tsx'); const bi = read('app/components/kids/BayanIntro.tsx');
  assert.ok(/intro === 'force' \|\| \(intro === 'auto' && !child\.intro_seen_at\)/.test(kp));
  assert.ok(/action: 'intro', child: childId/.test(kp));
  assert.ok(/قِصَّتُنا 📖/.test(kp) && /قِصَّتُنا 📖/.test(bs));
  assert.ok(bs.includes(`localStorage.getItem(INTRO_DEMO_KEY)`) && INTRO_DEMO_KEY === 'bayan_demo_intro_seen');
  assert.ok(/data-testid="intro-parents-open"/.test(read('app/components/kids/IntroButton.tsx')));
  assert.ok(/IntroButton/.test(read('app/kids/page.tsx')) && /IntroButton/.test(read('app/components/kids/ParentHome.tsx')));
  assert.ok(!/fetch\(/.test(bi), 'الافتتاحية لا تُرسل شيئًا');
  assert.ok(/prefers-reduced-motion/.test(bi));
  const sql = read('supabase/migrations/20270224_kids_intro.sql'); assert.ok(/add column if not exists intro_seen_at timestamptz/.test(sql));
  const api = read('app/api/kids/route.ts'); assert.ok(/action === 'intro'/.test(api) && /intro_seen_at: c\.intro_seen_at \|\| null/.test(api));
});
