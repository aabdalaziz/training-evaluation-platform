/* هـ-4 «معجم أَثَر»: الحارس — الصيغ المتقاعدة لا تعود إلى واجهة app/ و lib/ · القاموس مكتمل · الميسّر في شاشات المتعلّم · المدرّب في شاشات الطاقم */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LEXICON, RETIRED_PATTERNS } from '../lib/lexicon';

const ROOT = path.join(__dirname, '..');
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else if (/\.(ts|tsx)$/.test(e.name) && !p.endsWith('lib/lexicon.ts')) out.push(p);
  }
  return out;
}
const FILES = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'lib'))];
const read = (f: string) => fs.readFileSync(f, 'utf8');
const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, '/');

test('هـ-4: القاموس — 23 مدخلًا بمصطلح وسياق، والمفاتيح فريدة', () => {
  assert.ok(LEXICON.length >= 20);
  assert.equal(new Set(LEXICON.map((e) => e.key)).size, LEXICON.length);
  for (const e of LEXICON) { assert.ok(e.term.length > 1, e.key); assert.ok(e.where.length > 3, e.key); }
  const t = (k: string) => LEXICON.find((e) => e.key === k)!.term;
  assert.match(t('facilitator'), /الميسّر/); assert.match(t('participant'), /المشارك/); assert.match(t('student'), /الطالب/);
  assert.match(t('section'), /الشعبة/); assert.match(t('survey'), /الاستبيان/); assert.match(t('portal'), /بوّابة أَثَر/); assert.match(t('org'), /الجهة/);
});

test('هـ-4: لا صيغة متقاعدة في واجهة app/ أو lib/ (خارج الاستثناءات المعلنة)', () => {
  const offenders: string[] = [];
  for (const f of FILES) {
    const r = rel(f); const lines = read(f).split('\n');
    lines.forEach((line, i) => {
      for (const P of RETIRED_PATTERNS) {
        if (!P.re.test(line)) continue;
        if (P.allow && (P.allow.test(line) || P.allow.test(r))) continue;
        offenders.push(`${r}:${i + 1} [${P.id}] ${line.trim().slice(0, 80)}`);
      }
    });
  }
  assert.deepEqual(offenders.slice(0, 20), [], `${offenders.length} موضعًا متقاعدًا`);
});

test('هـ-4: الميسّر في شاشات المتعلّم — أسئلة تقييم المدرّب تخاطب «الميسّر»، وخطاب «ميسّرك» لا «مدرّب» + ك', () => {
  const links = read(path.join(ROOT, 'lib/evaluation/links.ts'));
  assert.ok(/شرح الميسّر المعلومات/.test(links) && !/شرح المدرّب/.test(links));
  const learnerFiles = FILES.filter((f) => /app\/(miaar|me\/first|me\/grad|me\/line|me\/athar-map|evaluate|impact|followup)\//.test(rel(f)));
  assert.ok(learnerFiles.length >= 8);
  for (const f of learnerFiles) assert.ok(!/مدرّ?ب(ك|ه|ها)(?![\u0621-\u064A])/.test(read(f)), `«ميسّرك» بقيت في ${rel(f)}`);
  for (const f of FILES) for (const line of read(f).split('\n')) {
    if (/\(\?:/.test(line)) continue; // regex يقبل القديم والجديد (بيانات مخزونة)
    assert.ok(!/(?<![\u0621-\u064A])مدرّ?بك(?![\u0621-\u064A])/.test(line), `«مدرّب»+ك في ${rel(f)}`);
  }
});

test('هـ-4: المدرّب (بالشدّة) يبقى في شاشات الطاقم — دفتر اليوم وإدارة البرامج لم تتحوّل إلى «الميسّر»', () => {
  const day = read(path.join(ROOT, 'lib/portal/day.ts'));
  assert.match(day, /سجلّ المدرّب اليومي/);
  const mgmt = read(path.join(ROOT, 'app/admin/management/page.tsx'));
  assert.match(mgmt, /المدرّبون/); assert.ok(!/الميسّرون/.test(mgmt));
});

test('هـ-4: الشعبة للمجموعة المسجّلة والقاعة للمكان — والاستبيان اسم الأداة الواحد', () => {
  const mgmt = read(path.join(ROOT, 'app/admin/management/page.tsx'));
  assert.match(mgmt, /إضافة شعبة/); assert.match(mgmt, /رقم \/ اسم الشعبة/);
  const hour = read(path.join(ROOT, 'app/me/day/HourPin.tsx'));
  assert.match(hour, /شاشة القاعة/);
  const flow = read(path.join(ROOT, 'app/components/StepFlow.tsx'));
  assert.match(flow, /محطّات الاستبيان/);
  const remote = read(path.join(ROOT, 'lib/surveys/remoteLearning.ts'));
  assert.match(remote, /استبيان رأي الطلاب/); // برنامج تعليمي → الطالب
});
