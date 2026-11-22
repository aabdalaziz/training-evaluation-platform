// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// هـ-3 — عائلة مناطق أَثَر في البوّابة + «شاشات اقْرَأْ» (فحوص بنيوية على الملفات)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ZONE_FAMILY, zoneKeyOf } from '../app/components/ZoneMark';

const ROOT = path.resolve(__dirname, '..'); const R = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('هـ-3: ثماني مناطق بألوانها، والأسماء البديلة تعود إلى العائلة', () => {
  assert.deepEqual(Object.keys(ZONE_FAMILY), ['athar', 'miaar', 'iqra', 'programs', 'org', 'experts', 'staff', 'pulse']);
  assert.equal(ZONE_FAMILY.org.tone, '#6A3350'); assert.equal(ZONE_FAMILY.experts.tone, '#D9A866'); assert.equal(ZONE_FAMILY.pulse.tone, '#5EA8A0');
  assert.equal(zoneKeyOf('portal'), 'athar'); assert.equal(zoneKeyOf('trainers'), 'experts'); assert.equal(zoneKeyOf('admin'), 'staff'); assert.equal(zoneKeyOf('غير معروف'), 'athar');
});

test('هـ-3 ب: العلامة في باب المنطقة وحزام أَثَر ومركز القيادة', () => {
  const zd = R('app/components/ZoneDoor.tsx'); assert.ok(zd.includes("import { ZoneMark } from './ZoneMark'")); assert.ok(zd.includes('<ZoneMark zone={zone} size={compact ? 22 : 30} light />')); assert.ok(/miaar: \{ echo: '#D4614A'/.test(zd) && /pulse: \{ echo: '#5EA8A0'/.test(zd));
  const tape = R('app/components/ZoneTape.tsx'); assert.ok(tape.includes('<ZoneMark zone={g.zone} size={20} light />')); assert.ok(!tape.includes('AtharMark'));
  const db = R('app/dashboard/page.tsx'); assert.ok(db.includes(`<ZoneMark zone={wing?.zone || 'staff'} size={46} light`)); assert.ok(!db.includes('#0b2240'), 'لا كحلي قديم في مركز القيادة'); assert.ok(db.includes('<Horizon light height={120} />'));
  const cc = R('app/command-center/page.tsx'); assert.ok(!cc.includes('#0b1f3a') && !cc.includes('#2dd4bf'));
});

test('هـ-3 د: شاشات اقْرَأْ — أسهم ثابتة، لوحة مفاتيح، سحب، عدّاد عربي، والحلقة لا تُغلق بالسهم قبل المِران', () => {
  const ui = R('app/iqra/IqraApp.tsx');
  assert.ok(ui.includes('function ScreenNav(') && ui.includes('function useScreenMoves('));
  assert.ok(ui.includes("e.key === 'ArrowLeft' && nRef.current") && ui.includes("e.key === 'ArrowRight' && pRef.current"), 'يسار = التالي في الاتجاه العربي');
  assert.ok(ui.includes('onTouchStart') && ui.includes('onTouchEnd'));
  assert.ok(ui.includes('data-testid="iq-screen-prev"') && ui.includes('data-testid="iq-screen-next"'));
  assert.ok(ui.includes('<ScreenNav i={sc} names={names} go={goS} testid="iq-home-nav" />'), 'شاشات المستوى');
  assert.ok(ui.includes('canNext={canArrowNext}') && ui.includes("const canArrowNext = !nextIsClose || answeredN >= totalN"), 'أثر الحلقة بعد المِران فقط');
  assert.ok(ui.includes("['مستواي', ...units.map((u) => `${u.code} ${u.title_ar}`), 'ساعاتي والعَتَبة']"));
  assert.ok(ui.includes("'٠١٢٣٤٥٦٧٨٩'"));
  assert.ok(ui.includes("{screen.s === 'home' && <ZoneTape compact />}"), 'الحزام باقٍ');
});
