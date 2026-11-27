// P88 «مساحة الطالبة — France Cohort Hub» — الطبقة النقيّة + وجود الصفحة والنصوص بثلاث لغات
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRANCE, T, HUB_LANGS, cohortDays, phaseOf, pickLang, fmtDay } from '../lib/cohorts/france';

const read = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('P88: 15 يومًا (الأحد–الخميس) مطابقة لرموز الحضور في SQL · الأوّل 6/12 والأخير 24/12', () => {
  const d = cohortDays();
  assert.equal(d.length, 15); assert.equal(d[0].date, '2026-12-06'); assert.equal(d[14].date, '2026-12-24');
  for (const x of d) assert.ok([0, 1, 2, 3, 4].includes(x.dow), `${x.date} ليس من الأحد إلى الخميس`);
  assert.equal(new Set(d.map((x) => x.n)).size, 15);
});

test('P88: مرحلة البرنامج — قبل/جارٍ (يوم درس أو راحة)/بعد', () => {
  assert.deepEqual(phaseOf('2026-11-29'), { kind: 'before', days: 7 });
  assert.deepEqual(phaseOf('2026-12-06'), { kind: 'running', day: 1, total: 15, isClassDay: true });
  assert.deepEqual(phaseOf('2026-12-11'), { kind: 'running', day: 5, total: 15, isClassDay: false }, 'الجمعة: راحة بعد اليوم 5');
  assert.deepEqual(phaseOf('2026-12-24'), { kind: 'running', day: 15, total: 15, isClassDay: true });
  assert.deepEqual(phaseOf('2026-12-27'), { kind: 'after' });
});

test('P88: اختيار اللغة — ?lang ثمّ المحفوظة ثمّ المتصفّح (fr/ar) ثمّ en', () => {
  assert.equal(pickLang('ar', 'fr', 'fr-FR'), 'ar'); assert.equal(pickLang(null, 'fr', 'en-US'), 'fr');
  assert.equal(pickLang(null, null, 'fr-CA'), 'fr'); assert.equal(pickLang(null, null, 'ar-SA'), 'ar'); assert.equal(pickLang(null, null, 'de-DE'), 'en'); assert.equal(pickLang('xx', 'yy', null), 'en');
});

test('P88: النصوص الثلاث متطابقة المفاتيح، بلا فراغ، 4 خطوات و5 أسئلة، والفرنسيّة فرنسيّة فعلًا', () => {
  const keys = Object.keys(T.en).sort();
  for (const l of HUB_LANGS) {
    assert.deepEqual(Object.keys(T[l]).sort(), keys, `مفاتيح ${l}`);
    for (const [k, v] of Object.entries(T[l])) if (typeof v === 'string') assert.ok(v.trim().length > 0, `${l}.${k} فارغ`);
    assert.equal(T[l].steps.length, 4); assert.equal(T[l].faq.length, 5);
    assert.ok(T[l].startsIn(3).length > 0 && T[l].dayOf(2, 15).includes('2') && T[l].hello('Ines').includes('Ines') && T[l].attendanceOf(3, 4).includes('3'));
  }
  assert.equal(T.ar.dir, 'rtl'); assert.equal(T.fr.dir, 'ltr');
  assert.ok(/Médine/.test(FRANCE.location.fr) && /Bonjour/.test(T.fr.hello('X')) && /Émarger/.test(T.fr.checkIn), 'فرنسيّة');
  assert.ok(/[\u0600-\u06FF]/.test(T.ar.title) && !/[\u0600-\u06FF]/.test(T.en.title) && !/[\u0600-\u06FF]/.test(T.fr.title));
  assert.equal(fmtDay('2026-12-06', 'fr'), 'dimanche 6 décembre'); assert.equal(fmtDay('2026-12-06', 'en'), 'Sunday 6 December');
});

test('P88: الصفحة /france موجودة وتستخدم me_portal والرموز FRDAILY/FRFINAL · /me يعرض بطاقة المجموعة لمن سُجّلت فيها', () => {
  const pg = read('app/france/page.tsx');
  for (const s of ["rpc('me_portal')", 'FRANCE.links.daily', 'FRANCE.links.final', 'signInWithOtp', "data-testid=\"france-hub\"", 'fh-lang-', 'HUB_LANGS.map']) assert.ok(pg.includes(s), s);
  assert.equal(FRANCE.links.daily, '/e/FRDAILY'); assert.equal(FRANCE.links.final, '/e/FRFINAL'); assert.equal(FRANCE.programId, '101bdcac-95cc-46df-8ca9-96a2b1c903c1');
  const me = read('app/me/page.tsx'); assert.ok(me.includes('FRANCE.programId') && me.includes('href="/france"') && me.includes('data-testid="me-france"'));
  assert.ok(/^  phone: '/m.test(read('lib/ui/icons.tsx')), 'أيقونة الهاتف');
});

test('P88-ب: /france بلا شريط عربيّ فوقها — مستثناة من GlobalNavigation وGuide/نادِ، ولها عنوان مشاركة فرنسيّ', () => {
  assert.ok(/PORTAL_PREFIXES = \[[^\]]*'\/france'/.test(read('app/components/GlobalNavigation.tsx')), 'GlobalNavigation');
  assert.ok(/HIDE_ON = \[[^\]]*'\/france'/.test(read('app/components/Guide.tsx')), 'Guide');
  const lay = read('app/france/layout.tsx'); assert.ok(lay.includes("title: 'Programme d’immersion en arabe") && lay.includes("locale: 'fr_FR'"));
});
