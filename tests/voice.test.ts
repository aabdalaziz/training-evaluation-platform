// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «نادِ» — محلّل النيّات: فصحى ولهجات، وجهات الإدارة محجوبة عن الزائر، الغامض لا يُنفَّذ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, normalizeCmd, describeIntent, DESTINATIONS } from '../lib/portal/voice';

const go = (s: string, admin = false) => { const i = parseCommand(s, { admin }); return i.kind === 'go' ? i.href : i.kind; };
test('نادِ: الوجهات بالفصحى واللهجة وبأسماء الناس', () => {
  assert.equal(go('افتح مِعيار'), '/miaar'); assert.equal(go('اختبار تحديد المستوى'), '/miaar'); assert.equal(go('حدّد مستواك'), '/miaar');
  assert.equal(go('خذني إلى البرامج'), '/programs'); assert.equal(go('روح للاستشارات'), '/consulting'); assert.equal(go('ودّيني لصفحة المساعدة'), '/help');
  assert.equal(go('يا أثر افتح الخدمات'), '/services'); assert.equal(go('تسجيل الدخول'), '/login'); assert.equal(go('مهاراتي'), '/me/skills'); assert.equal(go('أثر 2062'), '/2062');
  assert.equal(go('الرئيسية'), 'home'); assert.equal(go('روح البيت'), 'home');
});
test('نادِ: نيّات ثابتة ولهجات', () => {
  assert.equal(parseCommand('أين أنا؟').kind, 'where'); assert.equal(parseCommand('وين أنا').kind, 'where');
  assert.equal(parseCommand('ارجع').kind, 'back'); assert.equal(parseCommand('رجّعني').kind, 'back');
  assert.equal(parseCommand('خذني حيث توقفت').kind, 'resume_last');
  assert.deepEqual(parseCommand('كبّر الخط'), { kind: 'zoom', dir: 'in' }); assert.deepEqual(parseCommand('أعلى الصفحة'), { kind: 'scroll', dir: 'top' }); assert.deepEqual(parseCommand('تحت'), { kind: 'scroll', dir: 'down' });
  assert.equal(parseCommand('اقرأ السؤال').kind, 'read'); assert.equal(parseCommand('التالي').kind, 'next'); assert.equal(parseCommand('كم بقي من الوقت').kind, 'time'); assert.equal(parseCommand('خلاص').kind, 'stop');
  assert.deepEqual(parseCommand('ابحث عن شهادة التحقق'), { kind: 'search', q: 'شهادة التحقق' });
});
test('نادِ: وجهات الإدارة للموظف فقط، والغامض يعود unknown', () => {
  assert.equal(go('افتح بنك البنود', true), '/admin/miaar/bank'); assert.equal(go('قائمة التصحيح', true), '/admin/miaar/rating'); assert.equal(go('وديني على الدعوات', true), '/admin/miaar/invites');
  assert.equal(go('افتح بنك البنود'), 'unknown', 'الزائر لا يرى الإدارة'); assert.equal(parseCommand('بلابلا').kind, 'unknown'); assert.equal(parseCommand('').kind, 'unknown');
  assert.equal(normalizeCmd('أَعْلَى الصّفحةِ!'), 'اعلي الصفحه'); assert.ok(describeIntent({ kind: 'go', href: '/miaar', label: 'مِعيار' }).includes('مِعيار'));
  for (const d of DESTINATIONS) assert.ok(d.href.startsWith('/') && d.aliases.length >= 1 && d.label, d.href);
});
