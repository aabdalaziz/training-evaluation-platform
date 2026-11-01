// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «الأبواب الحيّة» (P42-ب) — مؤشرات أَثَر: تعريف الأبواب، التفويض، العدّ الآمن، الدعوة الجماعية، حماية الموظف القائم */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOORS, DOOR_SLUGS, DOOR_STEPS, doorFor, doorAllowed, countRows, sumRows, doorLive } from '../lib/portal/hub';
import { SYSTEM_ROLES, rolesOf, inviteState, seatsLeft, validateInvite, rolesForFaces } from '../lib/portal/roles';

const NOW = '2026-11-02T12:00:00Z';
const g = (role_code: string) => ({ id: 'g', user_id: 'u', email: 'a@b.sa', role_code, org_id: null, source: 'invite', expires_at: null, revoked_at: null, created_at: NOW });

test('P42-ب doors: 8 أبواب، كل باب له صفات وروابط و3 خطوات، وكل صفة باب موجودة في الكتالوج', () => {
  assert.equal(DOOR_SLUGS.length, 8, '8 doors');
  for (const s of DOOR_SLUGS) {
    const d = DOORS[s]; assert.ok(d.roles.length >= 1 && d.links.length >= 3, `${s} roles+links`);
    assert.equal(DOOR_STEPS[s].length, 3, `${s} 3 steps`);
    for (const r of d.roles) assert.ok(SYSTEM_ROLES.some(x => x.code === r), `${s}: ${r} in catalog`);
    for (const r of d.roles) assert.equal(SYSTEM_ROLES.find(x => x.code === r)!.landing, `/hub/${s}`, `${r} lands on its door`);
  }
  assert.equal(doorFor('nope'), null, 'unknown door');
});

test('P42-ب doorAllowed: مدير النظام يدخل كل باب؛ غيره بابه فقط', () => {
  for (const s of DOOR_SLUGS) assert.ok(doorAllowed(s, ['ADMIN']), `admin ${s}`);
  assert.ok(doorAllowed('finance', ['FINANCE_MANAGER']) && !doorAllowed('quality', ['FINANCE_MANAGER']), 'finance only');
  assert.ok(doorAllowed('programs', ['EXEC_ARABIC']) && doorAllowed('expert', ['CONSULTANT']), 'shared doors');
  assert.ok(!doorAllowed('nope', ['ADMIN']), 'unknown door denied even for admin');
});

/* محاكي supabase صغير: سلسلة استعلام تعيد count/data المحدّدين، أو خطأ لجدول مجهول */
function fakeDb(tables: Record<string, { count?: number; rows?: any[] }>) {
  const chain = (t: string) => { const self: any = {}; const noop = () => self; ['select', 'eq', 'neq', 'in', 'is', 'gte', 'lt', 'gt', 'lte', 'or', 'ilike', 'limit', 'order'].forEach(m => { self[m] = noop; });
    self.then = (res: any, rej: any) => { const spec = tables[t]; return spec ? Promise.resolve({ data: spec.rows || null, count: spec.count ?? 0, error: null }).then(res, rej) : Promise.resolve({ data: null, count: null, error: { message: 'relation does not exist' } }).then(res, rej); };
    return self; };
  return { from: (t: string) => chain(t) };
}

test('P42-ب countRows/sumRows: عدّ ومجموع، وجدول غائب → null لا استثناء', async () => {
  const db = fakeDb({ portal_enrollments: { count: 7 }, portal_invoices: { rows: [{ total: '100.5' }, { total: 200 }, { total: null }] } });
  assert.equal(await countRows(db, 'portal_enrollments'), 7, 'count');
  assert.equal(await countRows(db, 'missing_table'), null, 'missing → null');
  assert.deepEqual(await sumRows(db, 'portal_invoices', 'total'), { n: 3, sum: 301 }, 'sum rounded');
  assert.equal(await sumRows(db, 'missing_table', 'x'), null, 'missing sum → null');
});

test('P42-ب doorLive: باب المالية يعيد مؤشرات بقيم و«ينتظر قرارك» فقط لما عدّه > 0؛ جدول غائب يظهر «—» (null)', async () => {
  const db = fakeDb({ portal_invoices: { count: 3, rows: [{ total: 500 }] }, portal_impact_contracts: { count: 2, rows: [{ total_amount: 1000 }] }, portal_consulting_quotes: { count: 0 } });
  const r = await doorLive(db, 'finance', { id: 'u', email: 'a@b.sa' });
  assert.equal(r.slug, 'finance'); assert.equal(r.steps.length, 3);
  const by = Object.fromEntries(r.indicators.map(i => [i.key, i]));
  assert.equal(by.unpaid.value, 3, 'unpaid count'); assert.match(String(by.unpaid.unit), /500/, 'unpaid sum');
  assert.equal(by.engagements.value, null, 'missing table → null');
  assert.ok(r.decisions.some(d => d.key === 'review' && d.count === 3), 'review decision present');
  const empty = await doorLive(fakeDb({}), 'quality', { id: 'u', email: 'a@b.sa' });
  assert.equal(empty.decisions.length, 0, 'nothing to decide when nothing counted'); assert.ok(empty.indicators.every(i => i.value === null), 'all null, no throw');
});

test('P42-ب الدعوة الجماعية: التحقق، الحالة بالمقاعد، المقاعد المتبقية، لا ADMIN', () => {
  const cat = SYSTEM_ROLES;
  assert.equal((validateInvite({ kind: 'group', roles: ['TRAINER'], max_uses: 1, label: 'ورشة' }, cat) as any).ok, false, 'min 2 seats');
  assert.equal((validateInvite({ kind: 'group', roles: ['TRAINER'], max_uses: 20 }, cat) as any).ok, false, 'label required');
  assert.equal((validateInvite({ kind: 'group', roles: ['ADMIN'], max_uses: 20, label: 'x y' }, cat) as any).ok, false, 'no admin by group');
  const ok = validateInvite({ kind: 'group', roles: ['TRAINER', 'EXPERT'], max_uses: 25, label: 'ورشة مدرّبي الرياض' }, cat) as any;
  assert.ok(ok.ok && ok.kind === 'group' && ok.max_uses === 25 && ok.email === '', 'group ok, no email');
  const personal = validateInvite({ email: 'A@B.sa', roles: ['TRAINER'] }, cat) as any; assert.ok(personal.ok && personal.kind === 'personal' && personal.max_uses === 1, 'personal default');
  const base = { expires_at: '2026-12-01T00:00:00Z', accepted_at: null, revoked_at: null, kind: 'group', max_uses: 3 };
  assert.equal(inviteState({ ...base, uses: 2 }, NOW), 'pending'); assert.equal(inviteState({ ...base, uses: 3 }, NOW), 'accepted'); assert.equal(inviteState({ ...base, uses: 0, expires_at: '2026-01-01T00:00:00Z' }, NOW), 'expired');
  assert.equal(seatsLeft({ max_uses: 3, uses: 2 }), 1); assert.equal(seatsLeft({ max_uses: 3, uses: 5 }), 0);
});

test('P42-ب هيئة أَثَر → صفات: الوجوه تتحوّل إلى TRAINER/EXPERT، ومنحة شخصية لا تُنزِل موظفًا قائمًا', () => {
  assert.deepEqual(rolesForFaces(['expert', 'trainer', 'bogus']), ['EXPERT', 'TRAINER']); assert.deepEqual(rolesForFaces(null), []);
  const r = rolesOf({ grants: [g('TRAINER')], legacyRole: 'PROGRAM_MANAGER', nowIso: NOW });
  assert.ok(r.includes('TRAINER') && r.includes('EXEC_PROGRAMS'), 'legacy staff kept next to personal grant: ' + r.join(','));
  const r2 = rolesOf({ grants: [g('FINANCE_MANAGER')], legacyRole: 'PROGRAM_MANAGER', nowIso: NOW });
  assert.ok(r2.includes('FINANCE_MANAGER') && !r2.includes('EXEC_PROGRAMS'), 'staff grant replaces legacy bridge');
  const r3 = rolesOf({ grants: [g('EXPERT')], legacyRole: 'PLATFORM_ADMIN', nowIso: NOW }); assert.ok(r3.includes('ADMIN') && r3.includes('EXPERT'), 'admin always');
});
