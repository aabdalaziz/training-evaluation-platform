// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CONSENTS, CONSENT_KINDS, effectiveConsents, consentExpiry, stageOf, adultGate, checkGate, cleanNick, cleanBirthYear, hasMedia, cleanProgress, luluLetter, weekStart, LIMITS } from '../lib/kids/parent';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('بَيْتُ بَيان: الأمانات أربع، كلّها مغلقة افتراضيًّا، بنصّين وإصدار، والكاميرا اختبارية 30 يومًا والنصّ 90 يومًا', () => {
  assert.deepEqual(CONSENT_KINDS, ['speech_recog', 'save_text', 'camera', 'share_facilitator']);
  for (const c of CONSENTS) { assert.equal(c.lines.length, 2); assert.ok(c.version >= 1); assert.ok(c.title.length > 3); }
  assert.equal(CONSENTS.find(c => c.kind === 'camera')!.days, 30); assert.ok(CONSENTS.find(c => c.kind === 'camera')!.experimental);
  assert.equal(CONSENTS.find(c => c.kind === 'save_text')!.days, 90);
  const eff = effectiveConsents([]); assert.deepEqual(Object.values(eff), [false, false, false, false]);
});

test('بَيْتُ بَيان: آخر صفّ موافقة هو الساري، والمنتهي يُعدّ مغلقًا', () => {
  const now = new Date('2026-12-01T00:00:00Z');
  const rows = [
    { kind: 'speech_recog' as const, granted: true, granted_at: '2026-11-01T00:00:00Z', expires_at: null, text_version: 1 },
    { kind: 'speech_recog' as const, granted: false, granted_at: '2026-11-02T00:00:00Z', expires_at: null, text_version: 1 },
    { kind: 'camera' as const, granted: true, granted_at: '2026-10-01T00:00:00Z', expires_at: '2026-10-31T00:00:00Z', text_version: 1 },
    { kind: 'save_text' as const, granted: true, granted_at: '2026-11-20T00:00:00Z', expires_at: '2027-02-18T00:00:00Z', text_version: 1 },
  ];
  const eff = effectiveConsents(rows, now);
  assert.equal(eff.speech_recog, false); assert.equal(eff.camera, false); assert.equal(eff.save_text, true); assert.equal(eff.share_facilitator, false);
  const from = new Date('2026-11-23T00:00:00Z');
  assert.equal(consentExpiry('camera', from)!.slice(0, 10), '2026-12-23'); assert.equal(consentExpiry('speech_recog', from), null);
});

test('بَيْتُ بَيان: النبتة 0–2 بذرة · 3–7 برعم · 8+ غصن · بوّابة الكبار ترفض الخطأ وتقبل الأرقام العربية', () => {
  assert.equal(stageOf(0), 'seed'); assert.equal(stageOf(2), 'seed'); assert.equal(stageOf(3), 'sprout'); assert.equal(stageOf(7), 'sprout'); assert.equal(stageOf(8), 'branch');
  const g = adultGate(12345); assert.match(g.q, /^\d \+ \d$/); assert.ok(g.a >= 5 && g.a <= 16);
  assert.equal(checkGate(g, String(g.a)), true); assert.equal(checkGate(g, String(g.a + 1)), false);
  assert.equal(checkGate({ a: 7 }, '٧'), true);
});

test('بَيْتُ بَيان: الكنية اسم أوّل/كنية فقط — لا اسم ثلاثيًّا ولا أرقامًا ولا بريدًا · سنة الميلاد ضمن المدى', () => {
  assert.equal(cleanNick('ريم'), 'ريم'); assert.equal(cleanNick('أبو فهد'), 'أبو فهد'); assert.equal(cleanNick('  حمّود  '), 'حمود');
  assert.equal(cleanNick('أحمد محمد عبدالعزيز'), null); assert.equal(cleanNick('ريم2'), null); assert.equal(cleanNick('a@b.c'), null); assert.equal(cleanNick(''), null); assert.equal(cleanNick('x'.repeat(21)), null);
  const now = new Date('2026-11-23');
  assert.equal(cleanBirthYear(2021, now), 2021); assert.equal(cleanBirthYear(2009, now), null); assert.equal(cleanBirthYear(2027, now), null); assert.equal(cleanBirthYear('abc', now), null);
});

test('بَيْتُ بَيان: حمولة التقدّم ترفض أيّ وسائط وتحفظ النصّ بإذن فقط وتُنقّيه', () => {
  assert.equal(hasMedia({ audio: 'x' }), true); assert.equal(hasMedia({ talk: [{ blob: '...' }] }), true); assert.equal(hasMedia({ x: 'data:audio/webm;base64,AAAA' }), true); assert.equal(hasMedia({ x: 'data:image/png;base64,AAAA' }), true);
  assert.equal(hasMedia({ session: 'bayt', stations: { start: true } }), false);
  const base = { session: 'bayt', stations: { start: true, story: true }, self: 'good', talk: [{ role: 'answer', matched: 'yes', attempts: 1, heard: 'حذائي في الدولاب 0501234567 a@b.co' }] };
  const r1 = cleanProgress(base, false); assert.ok(r1.ok && r1.p.talk![0].heard === undefined, 'بلا إذن: لا نصّ');
  const r2 = cleanProgress(base, true); assert.ok(r2.ok && r2.p.talk![0].heard === 'حذائي في الدولاب', `مع إذن: نصّ منقّى — ${r2.ok && r2.p.talk![0].heard}`);
  const r3 = cleanProgress({ ...base, recording: 'zzz' }, true); assert.ok(!r3.ok);
  const r4 = cleanProgress({ ...base, session: 'DROP TABLE' }, true); assert.ok(!r4.ok);
  const r5 = cleanProgress({ ...base, self: 'amazing', selfVoice: 'clear', badge: 'x'.repeat(100) }, true); assert.ok(r5.ok && r5.p.self === null && r5.p.selfVoice === 'clear' && r5.p.badge!.length === 40);
});

test('بَيْتُ بَيان: رسالة لؤلؤ قالبيّة — بلا أرقام طويلة، تحترم إذن النصّ، وتعرف الأسبوع من السبت', () => {
  const s = [{ world: 'البيت', badge: 'مُرَتِّبُ الْبَيْتْ', homeTask: 'ضَعْ حِذاءَكَ في مَكانِهْ', supportQ: 'أين وجد أَثير حذاءه؟', weekSentence: 'حِذائي في مَكانِهْ' }];
  const withText = luluLetter({ nick: 'ريم', gender: 'f', sessions: s, said: ['حذائي في الدولاب'], talkCount: 1 });
  assert.ok(withText.body.includes('لعبت ريم') && withText.body.includes('«حذائي في الدولاب»') && withText.sentence === 'حِذائي في مَكانِهْ');
  const noText = luluLetter({ nick: 'فهد', gender: 'm', sessions: s, said: [], talkCount: 1 });
  assert.ok(noText.body.includes('لم تأذنوا بحفظ الكلمات') && !noText.body.includes('«حذائي'));
  const none = luluLetter({ nick: 'فهد', gender: 'm', sessions: [], said: [], talkCount: 0 }); assert.ok(none.body.includes('لم يلعب') && none.sentence === null);
  for (const b of [withText.body, noText.body, none.body]) { assert.ok(b.length <= 1200); assert.ok(!/[0-9]{3,}/.test(b.replace(/90 يومًا/, ''))); }
  assert.equal(weekStart(new Date('2026-11-23T10:00:00')), '2026-11-21'); // الاثنين → السبت
  assert.equal(weekStart(new Date('2026-11-21T10:00:00')), '2026-11-21');
  assert.equal(LIMITS.children, 6);
});

test('بَيْتُ بَيان: SQL — 5 جداول · RLS على كلّها · قراءة لوليّ الأمر · لا كتابة من المتصفّح · تشخيص واحد', () => {
  const sql = read('supabase/migrations/20270223_kids_parent_home.sql');
  for (const t of ['kids_children', 'kids_consents', 'kids_progress', 'kids_talks', 'kids_letters']) {
    assert.ok(sql.includes(`create table if not exists public.${t}`), t);
    assert.ok(sql.includes(`alter table public.${t} enable row level security`), `rls ${t}`);
    assert.ok(new RegExp(`create policy ${t}_parent_read on public.${t} for select to authenticated`).test(sql), `policy ${t}`);
  }
  assert.ok(/revoke all on public\.kids_children, public\.kids_consents, public\.kids_progress, public\.kids_talks, public\.kids_letters from anon;/.test(sql));
  assert.ok(/revoke all on [^;]*kids_letters from authenticated;\s*grant select on [^;]*kids_letters to authenticated;/.test(sql));
  assert.ok(/create index if not exists kids_letters_child_idx/.test(sql));
  assert.ok(!/audio|image_url|photo/.test(sql), 'لا أعمدة وسائط');
  assert.equal((sql.match(/union all/g) || []).length, 3);
  assert.ok(sql.startsWith('-- © 2026'));
});

test('بَيْتُ بَيان: /api/kids يتحقّق من الملكية ويرفض الوسائط ولا يحفظ النصّ بلا إذن · الواجهة لا تستدعي سوى /api/kids', () => {
  const api = read('app/api/kids/route.ts');
  assert.ok(api.includes("eq('parent_id', uid)") && api.includes('ownChild('), 'ملكية الطفل');
  assert.ok(api.includes('cleanProgress(body, eff.save_text)'), 'النصّ بإذن');
  assert.ok(api.includes("bad('غير مصرّح', 403)"));
  assert.ok(api.includes("'delete'") && api.includes(".delete().eq('id', child.id).eq('parent_id', me.id)"), 'حذف فعلي مملوك');
  const ui = read('app/components/kids/ParentHome.tsx');
  const urls = [...ui.matchAll(/fetch\(([^,]+)/g)].map(m => m[1]);
  assert.ok(urls.every(u => u.trim() === 'path'), 'fetch عبر api() فقط'); assert.ok(ui.includes("api('/api/kids'"));
  assert.ok(!/getUserMedia|MediaRecorder|<img/.test(ui), 'لا ميك ولا كاميرا ولا صور في واجهة وليّ الأمر');
  for (const f of ['lib/kids/parent.ts', 'app/api/kids/route.ts', 'app/components/kids/ParentHome.tsx', 'app/kids/parent/page.tsx', 'app/kids/parent/[child]/page.tsx']) assert.ok(read(f).startsWith('// © 2026'), `header ${f}`);
});
