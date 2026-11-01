// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «بابٌ واحد لكل دور» (P42-أ) — الكتالوج، الرموز، حالة الدعوة، جمع الأدوار، الوجهة، الجسر القديم، التحقق */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEM_ROLES, LEGACY_TO_ROLE, newInviteToken, hashToken, inviteUrl, inviteState, rolesOf, isStaffRoles, isAdminRoles, hasPermission, landingFor, legacyNeededFor, shouldUpgradeLegacy, validateInvite, validateRole, roleCodeOk, MAX_ROLES_PER_INVITE } from '../lib/portal/roles';

const NOW = '2026-11-01T12:00:00Z';
const g = (role_code: string, extra: Partial<any> = {}) => ({ id: 'g', user_id: 'u', email: 'a@b.sa', role_code, org_id: null, source: 'invite', expires_at: null, revoked_at: null, created_at: NOW, ...extra });

test('P42 catalog: 16 صفة نظامية، رموز فريدة صالحة، وجهة لكل صفة، ADMIN وحده بـ *', () => {
  assert.equal(SYSTEM_ROLES.length, 16, '16 roles');
  assert.equal(new Set(SYSTEM_ROLES.map(r => r.code)).size, 16, 'unique codes');
  assert.ok(SYSTEM_ROLES.every(r => roleCodeOk(r.code) && r.landing.startsWith('/') && r.name_ar && r.name_en), 'shape');
  assert.deepEqual(SYSTEM_ROLES.filter(r => r.permissions.includes('*')).map(r => r.code), ['ADMIN'], 'only ADMIN wildcard');
  assert.ok(SYSTEM_ROLES.filter(r => r.is_staff).every(r => r.legacy_role), 'staff roles bridge to legacy ENUM');
  assert.ok(SYSTEM_ROLES.filter(r => !r.is_staff).every(r => !r.legacy_role || r.code === 'TRAINER'), 'non-staff have no legacy bridge');
  for (const v of Object.values(LEGACY_TO_ROLE)) assert.ok(SYSTEM_ROLES.some(r => r.code === v), `legacy maps to known role ${v}`);
});

test('P42 token: عشوائي، يُخزَّن بصمته فقط، والرابط /join/<token>', () => {
  const a = newInviteToken(), b = newInviteToken();
  assert.notEqual(a.token, b.token, 'random'); assert.equal(a.hash, hashToken(a.token), 'sha256'); assert.equal(a.hash.length, 64, 'hex');
  assert.ok(!a.hash.includes(a.token), 'hash does not leak token');
  assert.equal(inviteUrl('https://athar-portal.vercel.app/', a.token), `https://athar-portal.vercel.app/join/${a.token}`, 'url');
});

test('P42 inviteState: معلّقة/مقبولة/منتهية/ملغاة بالترتيب الصحيح', () => {
  const base = { accepted_at: null, revoked_at: null, expires_at: '2026-11-15T00:00:00Z' };
  assert.equal(inviteState(base, NOW), 'pending', 'pending');
  assert.equal(inviteState({ ...base, expires_at: '2026-10-01T00:00:00Z' }, NOW), 'expired', 'expired');
  assert.equal(inviteState({ ...base, accepted_at: NOW }, NOW), 'accepted', 'accepted');
  assert.equal(inviteState({ ...base, accepted_at: NOW, revoked_at: NOW }, NOW), 'revoked', 'revoked wins');
  assert.equal(inviteState({ ...base, accepted_at: NOW, expires_at: '2026-10-01T00:00:00Z' }, NOW), 'accepted', 'accepted even if later expired');
});

test('P42 rolesOf: المنح الفعّالة + الجسر القديم + مدير الجهة، وكل داخل مشارك على الأقل', () => {
  assert.deepEqual(rolesOf({ grants: [], nowIso: NOW }), ['PARTICIPANT'], 'empty → participant');
  const r = rolesOf({ grants: [g('QUALITY_MANAGER'), g('TRAINER', { revoked_at: NOW }), g('FINANCE_MANAGER', { expires_at: '2026-01-01T00:00:00Z' })], legacyRole: 'PROGRAM_MANAGER', orgAdmin: true, nowIso: NOW });
  assert.ok(r.includes('QUALITY_MANAGER') && !r.includes('EXEC_PROGRAMS') && r.includes('ORG_ADMIN'), 'active + org admin; legacy PM ignored once grants exist');
  assert.deepEqual(rolesOf({ grants: [], legacyRole: 'PROGRAM_MANAGER', nowIso: NOW }), ['EXEC_PROGRAMS'], 'legacy-only user bridged');
  assert.ok(rolesOf({ grants: [g('TRAINER')], legacyRole: 'PLATFORM_ADMIN', nowIso: NOW }).includes('ADMIN'), 'legacy admin always counts');
  assert.ok(!r.includes('TRAINER') && !r.includes('FINANCE_MANAGER'), 'revoked/expired excluded');
  assert.ok(!r.includes('PARTICIPANT'), 'participant implicit when other roles exist');
  assert.deepEqual(rolesOf({ grants: [], legacyRole: 'platform_admin', nowIso: NOW }), ['ADMIN'], 'legacy case-insensitive');
  assert.deepEqual(rolesOf({ grants: [g('UNKNOWN_ROLE')], nowIso: NOW }), ['PARTICIPANT'], 'unknown codes ignored');
});

test('P42 staff/admin/permissions: TRAINER ليس طاقمًا؛ ADMIN يملك كل شيء', () => {
  assert.equal(isStaffRoles(['TRAINER']), false, 'trainer not staff'); assert.equal(isStaffRoles(['TRAINER', 'QUALITY_MANAGER']), true, 'quality is staff');
  assert.equal(isStaffRoles(['PARTICIPANT', 'ORG_ADMIN']), false, 'org admin not platform staff');
  assert.equal(isAdminRoles(['EXEC_PROGRAMS']), false, 'not admin'); assert.equal(isAdminRoles(['ADMIN']), true, 'admin');
  assert.equal(hasPermission(['ADMIN'], 'anything.at.all'), true, 'wildcard');
  assert.equal(hasPermission(['FINANCE_MANAGER'], 'payments.write'), true, 'finance payments');
  assert.equal(hasPermission(['FINANCE_MANAGER'], 'miaar.bank.write'), false, 'finance cannot edit bank');
  assert.equal(hasPermission(['TEST_AUTHOR'], 'miaar.bank.write'), true, 'author edits bank');
});

test('P42 landingFor: باب واحد → إليه؛ عدّة أبواب → /hub؛ لا شيء → /me', () => {
  assert.equal(landingFor(['PARTICIPANT']), '/me', 'participant');
  assert.equal(landingFor(['FINANCE_MANAGER']), '/hub/finance', 'single');
  assert.equal(landingFor(['EXEC_PROGRAMS', 'EXEC_ARABIC']), '/hub/programs', 'same landing counts once');
  assert.equal(landingFor(['FINANCE_MANAGER', 'TRAINER']), '/hub', 'several → hub');
  assert.equal(landingFor(['FINANCE_MANAGER', 'TRAINER'], SYSTEM_ROLES, 'TRAINER'), '/hub/trainer', 'preferred wins if owned');
  assert.equal(landingFor(['FINANCE_MANAGER'], SYSTEM_ROLES, 'TRAINER'), '/hub/finance', 'preferred ignored if not owned');
  assert.equal(landingFor(['ADMIN', 'TRAINER']), '/dashboard', 'admin always lands on the master dashboard'); assert.equal(landingFor(['ADMIN']), '/dashboard', 'admin alone');
  assert.equal(landingFor([]), '/me', 'none');
});

test('P42 legacy bridge: ترقية فقط، ولا يُنزَّل ADMIN', () => {
  assert.equal(legacyNeededFor(['FINANCE_MANAGER']), 'PROGRAM_MANAGER', 'finance → PM');
  assert.equal(legacyNeededFor(['QUALITY_MANAGER', 'EXEC_PROGRAMS']), 'PROGRAM_MANAGER', 'highest wins');
  assert.equal(legacyNeededFor(['ADMIN']), 'ADMIN', 'admin'); assert.equal(legacyNeededFor(['PARTICIPANT', 'ORG_ADMIN']), null, 'no bridge');
  assert.equal(legacyNeededFor(['TRAINER']), 'TRAINER', 'trainer');
  assert.equal(shouldUpgradeLegacy('PLATFORM_ADMIN', 'PROGRAM_MANAGER'), false, 'never downgrade');
  assert.equal(shouldUpgradeLegacy('TRAINER', 'QUALITY_ANALYST'), true, 'upgrade');
  assert.equal(shouldUpgradeLegacy(null, 'TRAINER'), true, 'from nothing'); assert.equal(shouldUpgradeLegacy('ADMIN', 'ADMIN'), false, 'same');
});

test('P42 validateInvite: بريد صحيح، صفات معروفة وفعّالة، ≤ 5، جهة لازمة لصفة الجهة', () => {
  const cat = SYSTEM_ROLES;
  assert.equal((validateInvite({ email: 'bad', roles: ['TRAINER'] }, cat) as any).ok, false, 'bad email');
  assert.equal((validateInvite({ email: 'A@B.sa', roles: [] }, cat) as any).ok, false, 'no roles');
  assert.equal((validateInvite({ email: 'a@b.sa', roles: ['NOPE'] }, cat) as any).ok, false, 'unknown role');
  assert.equal((validateInvite({ email: 'a@b.sa', roles: ['TRAINER', 'EXPERT', 'CONSULTANT', 'QUALITY_MANAGER', 'FINANCE_MANAGER', 'LEADERSHIP'] }, cat) as any).ok, false, `> ${MAX_ROLES_PER_INVITE}`);
  assert.equal((validateInvite({ email: 'a@b.sa', roles: ['ORG_ADMIN'] }, cat) as any).ok, false, 'org role needs org');
  const ok = validateInvite({ email: ' A@B.sa ', roles: ['trainer', 'TRAINER', 'ORG_ADMIN'], org_id: '00000000-0000-4000-8000-000000000021', full_name: ' د. سارة ', message: 'x'.repeat(700) }, cat);
  assert.equal(ok.ok, true, 'valid'); if (ok.ok) { assert.equal(ok.email, 'a@b.sa', 'normalized'); assert.deepEqual(ok.roles, ['TRAINER', 'ORG_ADMIN'], 'dedup+upper'); assert.equal(ok.full_name, 'د. سارة', 'trim'); assert.equal(ok.message!.length, 600, 'message capped'); }
});

test('P42 validateRole: رمز لاتيني كبير، باب داخلي، جسر قديم معروف', () => {
  assert.equal((validateRole({ code: 'bad code', name_ar: 'x', name_en: 'y' }) as any).ok, false, 'bad code');
  assert.equal((validateRole({ code: 'PARTNER', name_ar: '', name_en: 'y' }) as any).ok, false, 'needs ar name');
  assert.equal((validateRole({ code: 'PARTNER', name_ar: 'x', name_en: 'y', landing: 'https://evil' }) as any).ok, false, 'landing must be internal');
  assert.equal((validateRole({ code: 'PARTNER', name_ar: 'x', name_en: 'y', is_staff: true, legacy_role: 'SUPER_ADMIN' }) as any).ok, false, 'custom role cannot bridge to admin');
  const ok = validateRole({ code: 'partner_liaison', name_ar: 'منسّق', name_en: 'Liaison', scope: 'platform', landing: '/hub', permissions: ['a.read', 'a.read', ''], is_staff: true, legacy_role: 'QUALITY_ANALYST' });
  assert.equal(ok.ok, true, 'valid'); if (ok.ok) { assert.equal(ok.role.code, 'PARTNER_LIAISON', 'upper'); assert.deepEqual(ok.role.permissions, ['a.read'], 'dedup'); }
});
