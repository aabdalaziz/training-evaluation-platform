// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// هـ-3 ح «عدّة الغرفة» — عناقيد الجناح وخطّه، وتحوّل غرف «نظام أَثَر» إلى الإطار الموحّد (فحوص بنيوية)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { WINGS, CLUSTERS, SHARED_CLUSTER, clustersOfWing, clusterNameOf, neighborsOf, roomsOfWing, wingByKey } from '../lib/portal/wings';
import { ROOMS } from '../lib/portal/rooms';

const ROOT = path.resolve(__dirname, '..'); const R = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const PEOPLE_PAGES = ['enrollments', 'payments', 'inbox', 'consulting', 'directory', 'outreach'].map(p => `app/admin/${p}/page.tsx`).concat(['app/admin/org/letters/LettersDesk.tsx']);
const ASSESS_PAGES = ['placements', 'needs', 'evidence', 'credentials', 'certificates', 'skills'].map(p => `app/admin/${p}/page.tsx`).concat(['app/admin/miaar/AdminMiaar.tsx']);
const QUALITY_PAGES = ['admin/followup', 'admin/impact', 'admin/outcomes', 'reports/chain', 'reports/program', 'reports/cohorts', 'admin/contracts', 'admin/observatory', 'admin/loop', 'final-analysis', 'admin/sector-impact', 'admin/twin', 'admin/after', 'admin/reports', 'reports/center', 'reports', 'reports/remote-survey'].map(p => `app/${p}/page.tsx`);
const PROGRAM_PAGES = ['management', 'attendance', 'awards', 'templates', 'pulse', 'readiness', 'inclusion', 'live', 'resources', 'catalog', 'sim', 'missions', 'onair', 'rehearsals', 'program-engineering', 'media', 'councils'].map(p => `app/admin/${p}/page.tsx`);
const SYSTEM_PAGES = ['roles', 'audit', 'health', 'access', 'demo', 'backup', 'data-lifecycle', 'agents', 'shield', 'vault', 'notifications'].map(p => `app/admin/${p}/page.tsx`).concat(['app/help/page.tsx']);

test('هـ-3 ح: عناقيد «نظام أَثَر» تغطّي غرفه العشر بلا تكرار، وكل عنقود غرفه معروفة', () => {
  const sys = wingByKey('system')!; const rooms = roomsOfWing(sys);
  const defs = CLUSTERS.system!; const hrefs = defs.flatMap(c => c.hrefs);
  assert.equal(new Set(hrefs).size, hrefs.length, 'لا غرفة في عنقودين');
  for (const h of hrefs) assert.ok(ROOMS.some(r => r.href === h), `غرفة غير معروفة في العناقيد: ${h}`);
  for (const r of rooms) assert.ok(hrefs.includes(r.href), `غرفة بلا عنقود: ${r.href}`);
  assert.deepEqual(defs.map(c => c.name), ['الأبواب', 'الرقابة', 'السلامة', 'العرض']);
  const cl = clustersOfWing(sys, rooms);
  assert.deepEqual(cl.map(c => c.name), ['الأبواب', 'الرقابة', 'السلامة', 'العرض']);
  assert.equal(cl.reduce((n, c) => n + c.rooms.length, 0), rooms.length);
});

test('هـ-3 ح: الغرف المشتركة في «أدواتي» آخر الخطّ، وجناح بلا عناقيد → عنقود واحد بلا اسم', () => {
  const sys = wingByKey('system')!;
  const shared = ROOMS.filter(r => ['/admin/notifications', '/admin/sign', '/help'].includes(r.href));
  const cl = clustersOfWing(sys, roomsOfWing(sys).concat(shared));
  assert.equal(cl[cl.length - 1].name, SHARED_CLUSTER); assert.equal(cl[cl.length - 1].rooms.length, 3); assert.ok(cl[cl.length - 1].shared);
  const fake = { ...wingByKey('programs')!, key: 'none' as never }; const qc = clustersOfWing(fake, roomsOfWing(fake));
  assert.equal(qc.length, 1); assert.equal(qc[0].name, ''); assert.equal(qc[0].rooms.length, roomsOfWing(fake).length);
  assert.equal(clusterNameOf(sys, '/admin/audit'), 'الرقابة'); assert.equal(clusterNameOf(sys, '/help'), SHARED_CLUSTER); assert.equal(clusterNameOf(fake, '/admin/management'), null);
});

test('هـ-3 ط: عناقيد «إدارة أَثَر» تغطّي غرفه السبع', () => {
  const w = wingByKey('people')!; const rooms = roomsOfWing(w); const hrefs = CLUSTERS.people!.flatMap(c => c.hrefs);
  assert.equal(new Set(hrefs).size, hrefs.length); for (const r of rooms) assert.ok(hrefs.includes(r.href), `غرفة بلا عنقود: ${r.href}`);
  assert.deepEqual(clustersOfWing(w, rooms).map(c => c.name), ['الطلبات', 'المال', 'الهيئة والجهات', 'الوصول']);
});

test('هـ-3 ي: عناقيد «تقييم أَثَر» تغطّي غرفه الثماني', () => {
  const w = wingByKey('assess')!; const rooms = roomsOfWing(w); const hrefs = CLUSTERS.assess!.flatMap(c => c.hrefs);
  assert.equal(new Set(hrefs).size, hrefs.length); for (const r of rooms) assert.ok(hrefs.includes(r.href), `غرفة بلا عنقود: ${r.href}`);
  assert.deepEqual(clustersOfWing(w, rooms).map(c => c.name), ['مِعيار', 'الشهادات', 'المهارات']);
});

test('هـ-3 ك: عناقيد «جودة أَثَر» تغطّي غرفه التسع عشرة', () => {
  const w = wingByKey('quality')!; const rooms = roomsOfWing(w); const hrefs = CLUSTERS.quality!.flatMap(c => c.hrefs);
  assert.equal(new Set(hrefs).size, hrefs.length); for (const r of rooms) assert.ok(hrefs.includes(r.href), `غرفة بلا عنقود: ${r.href}`);
  assert.deepEqual(clustersOfWing(w, rooms).map(c => c.name), ['الأثر', 'التقارير', 'القطاعات', 'الحلقة', 'العرض']);
});

test('هـ-3 ل: عناقيد «برامج أَثَر» تغطّي غرفه — وكلّ جناح معنقد', () => {
  const w = wingByKey('programs')!; const rooms = roomsOfWing(w); const hrefs = CLUSTERS.programs!.flatMap(c => c.hrefs);
  assert.equal(new Set(hrefs).size, hrefs.length); for (const r of rooms) assert.ok(hrefs.includes(r.href), `غرفة بلا عنقود: ${r.href}`);
  assert.deepEqual(clustersOfWing(w, rooms).map(c => c.name), ['التشغيل', 'التصميم', 'الحضور الحيّ', 'المناخ']);
  for (const x of WINGS) assert.ok((CLUSTERS[x.key] || []).length >= 3, `${x.name} بلا عناقيد`);
});

test('هـ-3 ح: خطّ الجناح — السابقة/التالية داخل العنقود', () => {
  const sys = wingByKey('system')!; const rooms = roomsOfWing(sys);
  const a = neighborsOf(sys, '/admin/audit', rooms); assert.equal(a.prev, null); assert.equal(a.next?.href, '/admin/shield');
  const v = neighborsOf(sys, '/admin/vault', rooms); assert.equal(v.prev?.href, '/admin/shield'); assert.equal(v.next, null);
  const d = neighborsOf(sys, '/admin/demo', rooms); assert.equal(d.prev, null); assert.equal(d.next, null);
  assert.equal(WINGS.length, 5);
});

test('هـ-3 ح/ط/ي: غرف «نظام أَثَر» (12) و«إدارة أَثَر» (7) و«تقييم أَثَر» (7) و«جودة أَثَر» (17) و«برامج أَثَر» (17) على الإطار الموحّد — RoomHead بلا رأس خاص ولا روابط غرف مكرّرة، والجذر rm-page', () => {
  for (const p of SYSTEM_PAGES.concat(PEOPLE_PAGES, ASSESS_PAGES, QUALITY_PAGES, PROGRAM_PAGES)) {
    const s = R(p);
    assert.ok(s.includes('<RoomHead'), `${p}: بلا RoomHead`);
    assert.ok(/from '(\.\.\/)+components\/RoomKit'/.test(s), `${p}: استيراد العدّة`);
    assert.ok(!/<header className="([a-z]{2,3}-(head|hero|top)\b|top")/.test(s), `${p}: رأس قديم باقٍ`);
    assert.ok(/className="[a-z]{2,3} rm-page"/.test(s), `${p}: الجذر بلا rm-page`);
    const head = s.slice(s.indexOf('<RoomHead'), s.indexOf('/>', s.indexOf('<RoomHead')));
    assert.ok(!/<Link href="\/dashboard"/.test(head) && !/<Link href="\/admin\/management"/.test(head), `${p}: روابط مكرّرة في الرأس`);
    if (!/AdminMiaar\.tsx|reports\/center\/page\.tsx|management\/page\.tsx/.test(p)) assert.ok(!/\b(?!rm-|pt-)[a-z]{2,3}-btn\b/.test(s), `${p}: أزرار بفئة خاصة`);
    assert.ok(!s.includes('#e5e9f0'), `${p}: رمادي قديم`);
  }
});

test('هـ-3 ح: الغلاف يوفّر سياق الغرفة ويحقن العدّة، والقائمة الجانبية على خطّ الجناح', () => {
  const as = R('app/components/AdminShell.tsx');
  assert.ok(as.includes("import { RoomContext, RM_CSS } from './RoomKit'")); assert.ok(as.includes('<RoomContext.Provider value={roomCtx}>')); assert.ok(as.includes('CSS + RM_CSS'));
  assert.ok(as.includes('data-testid="as-cluster"'));
  const kit = R('app/components/RoomKit.tsx');
  for (const c of ['.rm-page{', '.rm-head{', '.rm-btn{', '.rm-card{', '.rm-kpi{', '.rm-alert{', '.rm-table{', '.rm-line{']) assert.ok(kit.includes(c), `العدّة بلا ${c}`);
  const db = R('app/dashboard/page.tsx');
  assert.ok(db.includes('clustersOfWing(wing, all.filter(r => ok.has(r.href)))')); assert.ok(db.includes('className="db-navlink db-stop"')); assert.ok(db.includes('data-testid="wing-cluster"'));
  assert.ok(!db.includes('<div className="db-nav-sep">الإدارة</div>'), 'الفاصل القديم «الإدارة» زال');
});
