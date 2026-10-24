import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACRONYM, BRAND, SERVICES, NAV, CROSS, ABOUT, PARTNERS, CONTACT_SUBJECTS, UI, t, serviceBySlug, deliveryLabel, publicPrograms, programName, fmtDate, validateContact } from '../lib/portal/content';

test('portal: brand + 8 services with unique slugs and both languages', () => {
  assert.equal(t(BRAND.name, 'ar'), 'أَثَر'); assert.equal(t(BRAND.name, 'en'), 'Athar');
  assert.equal(SERVICES.length, 8);
  const slugs = SERVICES.map(s => s.slug);
  assert.equal(new Set(slugs).size, 8);
  for (const need of ['arabic', 'training', 'diplomas', 'consulting', 'resources', 'live', 'evaluation', 'placement']) assert.ok(slugs.includes(need), need);
  for (const s of SERVICES) {
    assert.ok(s.title.ar && s.title.en && s.short.ar && s.short.en, s.slug);
    assert.ok(s.long.length >= 1 && s.features.length >= 3, s.slug);
    assert.ok(s.cta.href.startsWith('/') || s.cta.href.startsWith('https://'), s.slug);
    assert.ok(['live', 'soon'].includes(s.status));
  }
  assert.equal(serviceBySlug('placement')?.cta.href, 'https://miaar-placement-test.vercel.app');
  assert.equal(serviceBySlug('evaluation')?.cta.href, '/login');
  assert.equal(serviceBySlug('nope'), undefined);
  assert.equal(SERVICES.filter(s => s.status === 'soon').length, 2);
});

test('portal: TRACE acronym maps letters to real services', () => {
  assert.equal(BRAND.acronym, 'TRACE');
  assert.equal(ACRONYM.map(a => a.letter).join(''), 'TRACE');
  for (const a of ACRONYM) { assert.equal(a.word[0], a.letter); assert.ok(serviceBySlug(a.slug), a.slug); assert.ok(a.ar.length > 3); }
});

test('portal: content blocks are bilingual and complete', () => {
  assert.equal(ABOUT.values.length, 4); assert.equal(ABOUT.method.length, 3); assert.equal(PARTNERS.length, 3); assert.equal(CROSS.length, 3); assert.equal(NAV.length, 6);
  for (const x of [ABOUT.intro, ABOUT.vision, ABOUT.mission, BRAND.tagline, BRAND.promise, ...ABOUT.values.map(v => v.desc), ...ABOUT.method.map(m => m.desc), ...NAV.map(n => n.label), ...Object.values(UI)]) assert.ok(x.ar.length > 0 && x.en.length > 0);
  assert.equal(t({ ar: 'أ', en: '' }, 'en'), 'أ', 'falls back to Arabic');
  assert.equal(CONTACT_SUBJECTS.length, 8);
  for (const p of PARTNERS) assert.match(p.logo, /^\/logos\/.+\.png$/);
});

test('portal: public program filtering & labels', () => {
  const rows = [
    { id: '1', name_ar: 'جارٍ', status: 'ACTIVE', delivery_mode: 'onsite', start_date: '2026-10-01', end_date: '2026-11-30' },
    { id: '2', name_ar: 'قادم', name_en: 'Upcoming', status: 'DRAFT', delivery_mode: 'REMOTE', start_date: '2026-12-01', end_date: '2026-12-10' },
    { id: '3', name_ar: 'منتهٍ', status: 'ACTIVE', delivery_mode: 'remote', start_date: '2026-01-01', end_date: '2026-02-01' },
    { id: '4', name_ar: 'مكتمل', status: 'COMPLETED', start_date: '2026-10-01', end_date: '2026-12-01' },
    { id: '5', name_ar: 'ملغى', status: 'CANCELLED', start_date: '2026-11-01' },
    { id: '6', name_ar: 'مؤرشف', status: 'ACTIVE', start_date: '2026-11-01', archived_at: '2026-10-01T00:00:00Z' },
    { id: '7', name_ar: 'بلا تاريخ', status: 'ACTIVE' },
  ];
  const out = publicPrograms(rows, '2026-10-23');
  assert.deepEqual(out.map(p => [p.id, p.state]), [['1', 'ongoing'], ['2', 'upcoming'], ['7', 'upcoming']]);
  assert.equal(programName(out[1], 'en'), 'Upcoming'); assert.equal(programName(out[1], 'ar'), 'قادم'); assert.equal(programName(out[0], 'en'), 'جارٍ');
  assert.equal(deliveryLabel('onsite', 'ar'), 'حضوري'); assert.equal(deliveryLabel('IN_PERSON', 'en'), 'On-site'); assert.equal(deliveryLabel('REMOTE', 'ar'), 'عن بُعد'); assert.equal(deliveryLabel('hybrid', 'en'), 'Hybrid'); assert.equal(deliveryLabel(null, 'ar'), '');
  assert.equal(fmtDate(null, 'ar'), '—'); assert.match(fmtDate('2026-12-01', 'en'), /2026/); assert.match(fmtDate('2026-12-01', 'ar'), /2026/);
});

test('portal: contact validation', () => {
  const ok = { name: 'أحمد عبدالعزيز', email: 'a@b.sa', subject: 'training', message: 'أرغب بالتسجيل في برنامج التفويض القادم.' };
  assert.equal(validateContact(ok, 'ar'), null);
  assert.ok(validateContact({ ...ok, name: 'أ' }, 'ar'));
  assert.ok(validateContact({ ...ok, email: 'bad' }, 'en'));
  assert.ok(validateContact({ ...ok, message: 'قصير' }, 'ar'));
  assert.ok(validateContact({ ...ok, phone: 'abc' }, 'ar'));
  assert.equal(validateContact({ ...ok, phone: '+966 55 123 4567' }, 'ar'), null);
  assert.ok(validateContact({ ...ok, subject: 'xyz' }, 'ar'));
});
