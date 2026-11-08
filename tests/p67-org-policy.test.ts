// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P67 «سياسة الجهة — الاسم يدخل من الباب» — المفاتيح · البريد المصطنع · الأرقام · القفل · الختم ATH-OP · نقاط الاختناق (شكل المصدر) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { normalizePolicy, compactPolicy, mergePolicies, policyDiff, isEmptyPolicy, policyStatementAr, POLICY_KEYS, POLICY_FLAGS, POLICY_BLOCK_AR, DEFAULT_POLICY, syntheticEmail, isSyntheticEmail, parseSyntheticEmail, genPin, parseRoster, lockAfter, LOCK, opCode, isOpCode, opDigest, savePolicy, listSeals, verifyOpSeal, userPolicy, userFlag, membersWithFlag, visitorView, orgPolicy } from '../lib/org/policy';
import { EPITHETS, epithetById } from '../lib/org/epithets';
import { orgBySlug, setSlug, createCodes, listCodes, codesSummary, resetPin, revokeCode, enterWithCode, setEpithet, changePin } from '../lib/org/roster';
import { KIND_AR, DEFAULT_SEVERITY } from '../lib/shield/guard';
import { REGISTRY, NON_PERSONAL_TABLES } from '../lib/vault/registry';
import { kioskWatch, EMPTY_POLICY } from '../lib/org/policy-client';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const has = (p: string) => existsSync(new URL(`../${p}`, import.meta.url));
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ORG = U(21); const ORG2 = U(22); const ADMIN = { id: U(1), email: 'admin@upm.edu.sa' };

/* قاعدة وهمية: جداول في الذاكرة + auth.admin */
function fakeDb(seed: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = JSON.parse(JSON.stringify(seed)); const users: Record<string, any> = {}; let uid = 100; const events = () => T.portal_security_events || [];
  for (const t of ['portal_security_events', 'portal_org_codes', 'portal_org_policy_seals', 'portal_org_members', 'portal_organizations', 'portal_profiles', 'portal_grad_pages', 'portal_org_letters', 'portal_graph_nodes']) T[t] = T[t] || [];
  const from = (t: string) => {
    T[t] = T[t] || []; const rows = T[t]; const fs: ((r: any) => boolean)[] = []; let op = 'select'; let patch: any = null; let lim = 0; let single = false; let ordBy: [string, boolean] | null = null;
    const q: any = {
      select() { return q; }, eq(c: string, v: any) { fs.push(r => String(r[c]) === String(v)); return q; }, neq(c: string, v: any) { fs.push(r => JSON.stringify(r[c] ?? null) !== JSON.stringify(typeof v === 'string' && v.startsWith('{') ? JSON.parse(v) : v) && String(r[c]) !== String(v)); return q; },
      in(c: string, v: any[]) { fs.push(r => v.map(String).includes(String(r[c]))); return q; }, gt(c: string, v: any) { fs.push(r => String(r[c]) > String(v)); return q; }, gte(c: string, v: any) { fs.push(r => String(r[c]) >= String(v)); return q; },
      is(c: string, v: any) { fs.push(r => v === null ? r[c] == null : r[c] === v); return q; }, ilike(c: string, v: string) { fs.push(r => String(r[c] || '').toLowerCase() === String(v).toLowerCase()); return q; },
      or(expr: string) { const parts = expr.split(','); fs.push(r => parts.some(p => { const [c, o, ...rest] = p.split('.'); const v = rest.join('.'); return o === 'eq' ? String(r[c]) === v : String(r[c] || '').toLowerCase() === v.toLowerCase(); })); return q; },
      order(c: string, o: any) { ordBy = [c, o?.ascending !== false]; return q; }, limit(n: number) { lim = n; return q; }, maybeSingle() { single = true; return q; }, single() { single = true; return q; },
      update(p: any) { op = 'update'; patch = p; return q; }, insert(p: any) { op = 'insert'; patch = p; return q; },
      then(res: any) {
        let out = rows.filter(r => fs.every(f => f(r)));
        if (op === 'update') for (const r of out) Object.assign(r, patch);
        else if (op === 'insert') { const list = Array.isArray(patch) ? patch : [patch]; out = []; for (const p of list) { if (t === 'portal_org_codes' && rows.some(r => r.organization_id === p.organization_id && String(r.training_no).toLowerCase() === String(p.training_no).toLowerCase())) { res({ data: null, error: { code: '23505', message: 'duplicate' } }); return; } const r = { id: rows.length + 1, created_at: new Date().toISOString(), ...p }; rows.push(r); out.push(r); } }
        if (ordBy) { const [c, asc] = ordBy; out = [...out].sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : 1) * (asc ? 1 : -1)); }
        if (lim) out = out.slice(0, lim);
        res({ data: single ? (out[0] || null) : out, error: null });
      },
    };
    return q;
  };
  const auth = { admin: {
    async createUser(p: any) { if (Object.values(users).some((u: any) => u.email === p.email)) return { data: null, error: { message: 'exists' } }; const id = U(++uid); users[id] = { id, email: p.email, password: p.password, user_metadata: p.user_metadata || {}, banned: false }; return { data: { user: users[id] }, error: null }; },
    async updateUserById(id: string, p: any) { const u = users[id]; if (!u) return { data: null, error: { message: 'no user' } }; if (p.password) u.password = p.password; if (p.user_metadata) u.user_metadata = p.user_metadata; if (p.ban_duration) u.banned = p.ban_duration !== 'none'; return { data: { user: u }, error: null }; },
    async getUserById(id: string) { return { data: { user: users[id] || null }, error: users[id] ? null : { message: 'no' } }; },
  } };
  const signIn = async (email: string, password: string) => { const u = Object.values(users).find((x: any) => x.email === email) as any; if (!u || u.password !== password || u.banned) return { data: null, error: { message: 'Invalid login credentials' } }; return { data: { session: { access_token: `tok-${u.id}`, refresh_token: 'r', expires_in: 3600 }, user: u }, error: null }; };
  return { db: { from, auth }, T, users, events, signIn };
}
const seedOrg = (policy: Record<string, unknown> = {}, slug: string | null = 'bg-east') => ({ portal_organizations: [{ id: ORG, name_ar: 'قيادة افتراضية — المنطقة س', name_en: 'Virtual Command — Region X', slug, policy, active: true, frozen_at: null }, { id: ORG2, name_ar: 'جامعة أَثَر', slug: 'athar-u', policy: {}, active: true, frozen_at: null }] });

/* ───────── 1. المفاتيح النقية ───────── */
test('P67 normalizePolicy: المفاتيح المجهولة تُهمل · «هوية مستعارة» تستلزم «دخول بالرمز» · الكشك من القائمة', () => {
  assert.deepEqual(normalizePolicy(null), DEFAULT_POLICY, 'null → defaults');
  const p = normalizePolicy({ pseudonymous: 'true', foo: true, kiosk_minutes: '10' });
  assert.ok(p.pseudonymous && p.code_login, 'implies code_login'); assert.equal(p.kiosk_minutes, 10, 'kiosk 10'); assert.ok(!('foo' in p), 'unknown dropped');
  assert.equal(normalizePolicy({ kiosk_minutes: 7 }).kiosk_minutes, 7, 'kiosk free value kept within 1..60'); assert.equal(normalizePolicy({ kiosk_minutes: 999 }).kiosk_minutes, 60, 'kiosk capped 60'); assert.equal(normalizePolicy({ kiosk_minutes: -3 }).kiosk_minutes, 0, 'negative → 0');
  assert.deepEqual(compactPolicy(normalizePolicy({ voice_off: true, media_off: false })), { voice_off: true }, 'compact keeps only on');
  assert.ok(isEmptyPolicy(normalizePolicy({})), 'empty'); assert.equal(POLICY_KEYS.length, 7, '7 keys'); assert.deepEqual(POLICY_KEYS.map(k => k.key), POLICY_FLAGS, 'catalog order = flags');
  for (const k of POLICY_FLAGS) { assert.ok(POLICY_BLOCK_AR[k].length > 10, `block message ${k}`); assert.ok(POLICY_KEYS.find(x => x.key === k)!.enforce_ar.length > 5, `enforce ${k}`); }
});
test('P67 mergePolicies/policyDiff: أي إغلاق يغلب · أقصر كشك يغلب · الفرق بالمفاتيح', () => {
  const a = normalizePolicy({ voice_off: true, kiosk_minutes: 20 }); const b = normalizePolicy({ media_off: true, kiosk_minutes: 5 }); const m = mergePolicies([a, b]);
  assert.ok(m.voice_off && m.media_off, 'both off'); assert.equal(m.kiosk_minutes, 5, 'shortest kiosk'); assert.deepEqual(mergePolicies([]), DEFAULT_POLICY, 'empty merge');
  assert.deepEqual(policyDiff(a, b).sort(), ['kiosk_minutes', 'media_off', 'voice_off'], 'diff'); assert.deepEqual(policyDiff(a, a), [], 'same → none');
  assert.match(policyStatementAr(a, 'جهة'), /لا صوت/, 'statement lists on keys'); assert.match(policyStatementAr(normalizePolicy({}), 'جهة'), /الافتراضية/, 'empty statement');
});

/* ───────── 2. البريد المصطنع · الرقم السري · القائمة · القفل ───────── */
test('P67 syntheticEmail/parse: <رقم>@<slug>.id.athar-portal.sa — لا يُراسَل ويُعرف', () => {
  const e = syntheticEmail('BG-East', ' 10234 '); assert.equal(e, '10234@bg-east.id.athar-portal.sa', 'lowercase+trim');
  assert.ok(isSyntheticEmail(e), 'synthetic'); assert.ok(!isSyntheticEmail('x@moe.gov.sa'), 'real not'); assert.ok(!isSyntheticEmail('a@id.athar-portal.sa'), 'needs org label');
  assert.deepEqual(parseSyntheticEmail(e), { training_no: '10234', slug: 'bg-east' }, 'parse'); assert.equal(parseSyntheticEmail('x@y.com'), null, 'parse real → null');
});
test('P67 genPin: 6 أرقام · لا يبدأ بصفر · لا تكرار واحد · حقن عشوائية', () => {
  for (let i = 0; i < 50; i++) { const p = genPin(); assert.match(p, /^[1-9]\d{5}$/, 'shape'); assert.ok(!/^(\d)\1{5}$/.test(p), 'not repeated'); }
  const fixed = genPin(() => Buffer.from([0, 0, 0, 0])); assert.equal(fixed, '100000', 'deterministic rand');
  const rep = genPin(() => Buffer.from([0, 0x01, 0xb2, 0x07])); assert.notEqual(rep, '111111', 'skips 111111 pattern (falls back after 20 tries)');
});
test('P67 parseRoster: تنظيف · تفرّد · رفض غير الصالح · سقف 500', () => {
  const r = parseRoster('10234\n10235, 10234 ; 1-02_3.4\nبدر\n' + 'x'.repeat(40) + '\n');
  assert.deepEqual(r.ok, ['10234', '10235', '1-02_3.4'], 'ok list'); assert.equal(r.bad.length, 2, 'two bad'); assert.ok(r.bad[0].length <= 40, 'bad truncated');
  const many = parseRoster(Array.from({ length: 600 }, (_, i) => `n${i}`).join('\n')); assert.equal(many.ok.length, 500, 'cap 500');
  assert.deepEqual(parseRoster(''), { ok: [], bad: [] }, 'empty');
});
test('P67 lockAfter: 5 → 15 د · 10 → 30 د · 20 → 120 د (سقف)', () => {
  const now = new Date('2026-11-08T10:00:00Z');
  assert.equal(lockAfter(4, now), null, 'below threshold'); assert.equal(lockAfter(5, now), '2026-11-08T10:15:00.000Z', '15 min'); assert.equal(lockAfter(10, now), '2026-11-08T10:30:00.000Z', '30 min');
  assert.equal(lockAfter(15, now), '2026-11-08T11:00:00.000Z', '60 min'); assert.equal(lockAfter(20, now), '2026-11-08T12:00:00.000Z', 'cap 120'); assert.equal(lockAfter(40, now), '2026-11-08T12:00:00.000Z', 'still cap'); assert.equal(LOCK.attempts, 5, '5 attempts');
});
test('P67 EPITHETS: 12 كُنية بلا أسماء · عربي/إنجليزي · بحث', () => {
  assert.equal(EPITHETS.length, 12, '12'); assert.equal(new Set(EPITHETS.map(e => e.id)).size, 12, 'unique ids'); for (const e of EPITHETS) assert.ok(e.ar && e.en, `both langs ${e.id}`);
  assert.equal(epithetById('builder')?.ar, 'البنّاء', 'lookup'); assert.equal(epithetById('zzz'), null, 'unknown');
});

/* ───────── 3. الختم ATH-OP ───────── */
test('P67 opCode/isOpCode/opDigest: ATH-OP-XXXX-XXXX بلا 0/O/1/I · البصمة تتجاهل proof/hash', () => {
  const c = opCode(); assert.ok(isOpCode(c), c); assert.ok(!/[01OI]/.test(c.slice(7)), 'alphabet'); assert.ok(!isOpCode('ATH-SH-ABCD-EFGH'), 'not shield code');
  const b = { a: 1, z: [1, 2], proof: { x: 1 }, hash: 'h' }; assert.equal(opDigest(b), opDigest({ z: [1, 2], a: 1 }), 'canonical + ignores proof/hash');
});
test('P67 savePolicy: حفظ + ختم + حدث · لا تغيير → لا ختم · دخول بالرمز بلا slug → خطأ · verifyOpSeal سليم/الأحدث', async () => {
  const f = fakeDb(seedOrg({}, null)); const env = {} as Record<string, string | undefined>;
  const r0 = await savePolicy(f.db, { org_id: ORG, policy: { code_login: true }, by: ADMIN, env }); assert.equal(r0.ok, false, 'needs slug'); assert.match(r0.error || '', /slug|مُعرِّف/, 'slug message');
  const noChange = await savePolicy(f.db, { org_id: ORG, policy: {}, by: ADMIN, env }); assert.ok(noChange.ok && noChange.seal === null && noChange.changed!.length === 0, 'no change → no seal');
  const r1 = await savePolicy(f.db, { org_id: ORG, policy: { voice_off: true, public_faces_off: 'true', kiosk_minutes: 10 }, by: ADMIN, env, site: 'https://athar-portal.vercel.app' });
  assert.ok(r1.ok, r1.error); assert.ok(r1.seal && isOpCode(r1.seal.code), 'sealed'); assert.deepEqual(r1.changed!.sort(), ['kiosk_minutes', 'public_faces_off', 'voice_off'], 'changed');
  const org = f.T.portal_organizations.find(o => o.id === ORG); assert.deepEqual(org.policy, { public_faces_off: true, voice_off: true, kiosk_minutes: 10 }, 'compact jsonb stored'); assert.equal(org.policy_updated_by, ADMIN.id, 'by');
  assert.equal(f.events().filter(e => e.kind === 'org_policy').length, 1, 'one event'); assert.equal(f.events()[0].severity, 'warn', 'warn severity');
  const seals = await listSeals(f.db, ORG); assert.equal(seals.length, 1, 'one seal'); assert.equal(seals[0].code, r1.seal!.code, 'same code');
  const v = await verifyOpSeal(f.db, r1.seal!.code.toLowerCase()); assert.ok(v.valid && v.intact && v.seal!.latest, 'valid intact latest'); assert.equal(v.seal!.organization, 'قيادة افتراضية — المنطقة س', 'org name'); assert.match(v.seal!.statement_ar, /لا صوت/, 'statement');
  assert.deepEqual(await verifyOpSeal(f.db, 'ATH-OP-ZZZZ-ZZZZ'), { valid: false }, 'unknown'); assert.deepEqual(await verifyOpSeal(f.db, 'nope'), { valid: false }, 'bad shape');
  await new Promise(r => setTimeout(r, 5));
  const r2 = await savePolicy(f.db, { org_id: ORG, policy: { voice_off: true, public_faces_off: true, kiosk_minutes: 10, media_off: true }, by: ADMIN, env }); assert.deepEqual(r2.changed, ['media_off'], 'only media changed');
  const v1 = await verifyOpSeal(f.db, r1.seal!.code); assert.equal(v1.seal!.latest, false, 'first seal no longer latest');
  f.T.portal_org_policy_seals[0].body.policy.voice_off = false; const tampered = await verifyOpSeal(f.db, r1.seal!.code); assert.ok(tampered.valid && tampered.intact === false, 'tamper detected');
});

/* ───────── 4. سياسة المستخدم · الأعضاء ───────── */
test('P67 userPolicy/userFlag/membersWithFlag: دمج جهتين · العضوية المؤكَّدة فقط · البريد أو المعرّف', async () => {
  const f = fakeDb({ ...seedOrg({ voice_off: true, home_threads_off: true }), portal_org_members: [
    { organization_id: ORG, user_id: U(5), email: 'reem@example.com', status: 'confirmed' }, { organization_id: ORG2, user_id: U(6), email: 'x@athar.sa', status: 'confirmed' }, { organization_id: ORG, user_id: U(7), email: 'p@p.sa', status: 'pending' }, { organization_id: ORG, user_id: null, email: 'mail@only.sa', status: 'confirmed' }] });
  f.T.portal_organizations[1].policy = { media_off: true, kiosk_minutes: 5 };
  const p5 = await userPolicy(f.db, { id: U(5), email: 'REEM@example.com' }); assert.ok(p5.policy.voice_off && !p5.policy.media_off, 'org1 only'); assert.equal(p5.orgs.length, 1, 'one org'); assert.equal(p5.code_user, false, 'real email');
  const p6 = await userPolicy(f.db, { id: U(6) }); assert.ok(p6.policy.media_off && p6.policy.kiosk_minutes === 5, 'org2');
  const p7 = await userPolicy(f.db, { id: U(7), email: 'p@p.sa' }); assert.ok(isEmptyPolicy(p7.policy), 'pending → nothing');
  const pm = await userPolicy(f.db, { id: U(99), email: 'mail@only.sa' }); assert.ok(pm.policy.voice_off, 'by email');
  assert.equal(await userFlag(f.db, U(5), 'voice_off'), true, 'flag on'); assert.equal(await userFlag(f.db, U(5), 'media_off'), false, 'flag off'); assert.equal(await userFlag(f.db, null, 'voice_off'), false, 'no user');
  assert.equal(await userFlag(f.db, null, 'voice_off', '10234@bg-east.id.athar-portal.sa'), false, 'unknown synthetic');
  const m = await membersWithFlag(f.db, 'home_threads_off'); assert.deepEqual(Array.from(m.orgs), [ORG], 'one org'); assert.ok(m.users.has(U(5)) && !m.users.has(U(7)) && m.emails.has('mail@only.sa'), 'members set');
  const none = await membersWithFlag(f.db, 'verify_minimal'); assert.equal(none.orgs.size + none.users.size, 0, 'none');
  assert.ok((await orgPolicy(f.db, ORG)).home_threads_off, 'orgPolicy');
});

/* ───────── 5. الأرقام · الدخول · القفل ───────── */
test('P67 createCodes/enterWithCode: حسابات مصطنعة · الأرقام السرية مرّة واحدة · 5 محاولات → قفل 423 + حدث · الدخول الصحيح → جلسة وأول دخول', async () => {
  const f = fakeDb(seedOrg({ pseudonymous: true, code_login: true, kiosk_minutes: 10 })); const env = {} as Record<string, string | undefined>;
  const org = (await orgBySlug(f.db, 'BG-EAST'))!; assert.ok(org && org.policy.code_login, 'org by slug (case-insensitive)'); assert.equal(await orgBySlug(f.db, 'bad slug!'), null, 'bad slug');
  const pins: Buffer[] = [Buffer.from([0, 0, 0x30, 0x39]), Buffer.from([0, 0, 0x30, 0x3a])]; let i = 0; const rand = () => pins[(i++) % pins.length];
  const c = await createCodes(f.db, { org, numbers: ['10234', '10235', '10234', 'bad name'], by: ADMIN, env, rand });
  assert.equal(c.created.length, 2, 'two created'); assert.equal(c.skipped.length, 1, 'dup skipped'); assert.equal(c.failed.length, 1, 'invalid failed'); assert.match(c.created[0].pin, /^\d{6}$/, 'pin shape');
  assert.equal(Object.keys(f.users).length, 2, 'two auth users'); const u = Object.values(f.users)[0] as any; assert.equal(u.email, '10234@bg-east.id.athar-portal.sa', 'synthetic email'); assert.equal(u.user_metadata.full_name, '10234', 'display = number'); assert.equal(u.user_metadata.org_slug, 'bg-east', 'slug meta');
  assert.equal(f.T.portal_org_members.filter(m => m.status === 'confirmed' && m.organization_id === ORG).length, 2, 'members confirmed');
  const codes = await listCodes(f.db, ORG); assert.equal(codes.length, 2, 'codes rows'); assert.ok(!JSON.stringify(f.T).includes(c.created[0].pin) || c.created[0].pin === '100000', 'pin not stored in any table');
  assert.deepEqual(codesSummary(codes), { total: 2, active: 2, entered: 0, changed_pin: 0, locked: 0, revoked: 0 }, 'summary');
  const again = await createCodes(f.db, { org, numbers: ['10234'], by: ADMIN, env, rand }); assert.equal(again.skipped.length, 1, 'existing skipped (pin untouched)');
  assert.equal(f.events().filter(e => e.kind === 'org_codes').length, 1, 'one roster event (second had nothing created)');
  const pin = c.created[0].pin; const base = { slug: 'bg-east', url: 'http://x', anon: 'a', env, signIn: f.signIn };
  assert.equal((await enterWithCode(f.db, { ...base, slug: 'athar-u', training_no: '10234', pin })).status, 403, 'org without code_login → 403');
  assert.equal((await enterWithCode(f.db, { ...base, slug: 'nope', training_no: '10234', pin })).status, 404, 'unknown org');
  assert.equal((await enterWithCode(f.db, { ...base, training_no: '99999', pin })).status, 401, 'unknown number → generic 401');
  assert.equal((await enterWithCode(f.db, { ...base, training_no: '10234', pin: '12' })).status, 400, 'bad pin shape');
  for (let k = 1; k <= 4; k++) { const r = await enterWithCode(f.db, { ...base, training_no: '10234', pin: '000000' }); assert.equal(r.status, 401, `wrong ${k}`); assert.equal((r as any).remaining, 5 - k, `remaining ${5 - k}`); }
  const lock = await enterWithCode(f.db, { ...base, training_no: '10234', pin: '000000' }); assert.equal(lock.status, 423, 'fifth → locked'); assert.ok((lock as any).locked_until, 'locked_until');
  assert.equal(f.events().filter(e => e.kind === 'org_code_locked').length, 1, 'lock event');
  assert.equal((await enterWithCode(f.db, { ...base, training_no: '10234', pin })).status, 423, 'correct pin while locked → still 423');
  const later = new Date(Date.now() + 16 * 60000); const okR = await enterWithCode(f.db, { ...base, training_no: '10234', pin, now: later });
  assert.ok(okR.ok, 'enters after lock expiry'); if (okR.ok) { assert.ok(okR.access_token.startsWith('tok-'), 'session'); assert.equal(okR.first_login, true, 'first'); assert.equal(okR.pin_changed, false, 'default pin'); assert.equal(okR.org.kiosk_minutes, 10, 'kiosk'); assert.equal(okR.org.slug, 'bg-east', 'slug'); }
  const row = (await listCodes(f.db, ORG))[0]; assert.equal(row.failed, 0, 'failed reset'); assert.ok(row.first_login_at && row.last_login_at, 'login times');
  const second = await enterWithCode(f.db, { ...base, training_no: '10234', pin, now: later }); assert.ok(second.ok && second.first_login === false, 'second not first');
  assert.equal((await enterWithCode(f.db, { ...base, training_no: '10234', pin: '000000', now: later })).status, 401, 'counter restarted');
});
test('P67 resetPin/revokeCode/changePin/setEpithet: رقم جديد مرّة واحدة · إيقاف = حظر · التغيير يحتاج الحالي · الكُنية تصبح اسم العرض', async () => {
  const f = fakeDb(seedOrg({ code_login: true })); const env = {} as Record<string, string | undefined>; const org = (await orgBySlug(f.db, 'bg-east'))!;
  const c = await createCodes(f.db, { org, numbers: ['A-1'], by: ADMIN, env }); const pin = c.created[0].pin; const uid = (await listCodes(f.db, ORG))[0].user_id!;
  const r = await resetPin(f.db, { org, training_no: 'a-1', by: ADMIN, env }); assert.ok(r.ok && r.pin && r.pin !== pin, 'new pin'); assert.equal(f.users[uid].password, r.pin, 'auth updated');
  assert.equal((await resetPin(f.db, { org, training_no: 'zz', by: ADMIN, env })).ok, false, 'unknown');
  const base = { slug: 'bg-east', url: 'http://x', anon: 'a', env, signIn: f.signIn };
  assert.ok((await enterWithCode(f.db, { ...base, training_no: 'A-1', pin: r.pin! })).ok, 'enter with new pin');
  const cp = await changePin(f.db, { user: { id: uid, email: f.users[uid].email }, current: 'wrong1', next: '246813', url: 'http://x', anon: 'a', signIn: f.signIn }); assert.equal(cp.ok, false, 'wrong current');
  assert.equal((await changePin(f.db, { user: { id: uid, email: f.users[uid].email }, current: r.pin!, next: '111111', url: 'http://x', anon: 'a', signIn: f.signIn })).ok, false, 'weak next');
  const cp2 = await changePin(f.db, { user: { id: uid, email: f.users[uid].email }, current: r.pin!, next: '246813', url: 'http://x', anon: 'a', signIn: f.signIn }); assert.ok(cp2.ok, 'changed'); assert.equal((await listCodes(f.db, ORG))[0].pin_changed, true, 'pin_changed flag');
  const ep = await setEpithet(f.db, { id: uid }, 'builder'); assert.ok(ep.ok && ep.name === 'البنّاء', 'epithet'); assert.equal(f.users[uid].user_metadata.full_name, 'البنّاء', 'display name'); assert.equal(f.users[uid].user_metadata.training_no, 'A-1', 'number kept');
  const epn = await setEpithet(f.db, { id: uid }, 'none'); assert.ok(epn.ok && epn.name === 'A-1', 'back to number'); assert.equal((await setEpithet(f.db, { id: uid }, 'hacker')).ok, false, 'unknown epithet');
  const rv = await revokeCode(f.db, { org, training_no: 'A-1', by: ADMIN, env }); assert.ok(rv.ok, 'revoked'); assert.ok(f.users[uid].banned, 'banned in auth');
  assert.equal((await enterWithCode(f.db, { ...base, training_no: 'A-1', pin: '246813' })).status, 401, 'revoked cannot enter');
  assert.equal((await resetPin(f.db, { org, training_no: 'A-1', by: ADMIN, env })).ok, false, 'no reset on revoked');
  assert.ok((await revokeCode(f.db, { org, training_no: 'A-1', by: ADMIN, restore: true, env })).ok, 'restored'); assert.ok(!f.users[uid].banned, 'unbanned');
  assert.ok((await enterWithCode(f.db, { ...base, training_no: 'A-1', pin: '246813' })).ok, 'enters again');
  assert.equal(codesSummary(await listCodes(f.db, ORG)).changed_pin, 1, 'summary changed_pin');
  const s1 = await setSlug(f.db, ORG, 'New Slug'); assert.equal(s1.ok, false, 'bad slug'); assert.ok((await setSlug(f.db, ORG, 'bg-east-2')).ok, 'slug ok');
});
test('P67 visitorView: خمسة بنود · الإخفاء يتبع المفتاح', async () => {
  const f = fakeDb({ ...seedOrg({ public_faces_off: true }), portal_org_members: [{ organization_id: ORG, user_id: U(5), email: 'r@r.sa', status: 'confirmed' }], portal_profiles: [{ user_id: U(5), share_mode: 'public' }], portal_grad_pages: [{ user_id: U(5), live_public: true }], portal_graph_nodes: [{ id: `org:${ORG}` }] });
  const v = await visitorView(f.db, ORG); assert.equal(v.length, 5, 'five items');
  const prof = v.find(x => x.id === 'profiles')!; assert.equal(prof.count, 1, 'one public profile'); assert.equal(prof.visible, false, 'hidden by public_faces_off');
  const faces = v.find(x => x.id === 'faces')!; assert.equal(faces.visible, true, 'faces visible (verify_minimal off)'); assert.equal(v.find(x => x.id === 'graph')!.visible, false, 'graph node hidden');
  assert.equal(v.find(x => x.id === 'threads')!.visible, true, 'threads visible (home_threads_off off)');
});

/* ───────── 6. المتصفح: الكشك ───────── */
test('P67 kioskWatch: مؤقّت خمول يُعاد بالحركة · 0 = لا شيء', async () => {
  const listeners: Record<string, (() => void)[]> = {}; const win: any = { addEventListener(e: string, f: () => void) { (listeners[e] = listeners[e] || []).push(f); }, removeEventListener(e: string, f: () => void) { listeners[e] = (listeners[e] || []).filter(x => x !== f); } };
  let fired = 0; const stop = kioskWatch(0, () => { fired++; }, win); stop(); assert.equal(Object.keys(listeners).length, 0, 'no listeners for 0');
  const stop2 = kioskWatch(0.0001, () => { fired++; }, win); assert.ok(listeners.pointerdown?.length === 1, 'listener armed'); await new Promise(r => setTimeout(r, 30)); assert.equal(fired, 1, 'fired after idle'); stop2(); assert.equal(listeners.pointerdown.length, 0, 'removed');
  assert.deepEqual(EMPTY_POLICY.kiosk_minutes, 0, 'empty policy');
});

/* ───────── 7. شكل المصدر: نقاط الاختناق موجودة ───────── */
test('P67 source-shape: SQL · نقاط الاختناق · الخزنة · الدرع · التنقّل · /org · /login', () => {
  const sql = read('supabase/p67-org-policy.sql');
  for (const s of ['portal_org_codes', 'portal_org_policy_seals', 'portal_org_flag', 'portal_user_org_flag', 'portal_org_by_slug', 'portal_public_profile', "'public_faces_off'", 'porg_slug_uidx', 'revoke all on public.portal_org_codes from anon', "select 'p67_columns'", 'flag_fn_ok']) assert.ok(sql.includes(s), `sql has ${s}`);
  assert.ok(!/pin\s+text|pin_hash/.test(sql), 'no pin column anywhere');
  assert.ok(read('lib/portal/evidence-cron.ts').includes("membersWithFlag(db, 'home_threads_off')"), 'graph chokepoint'); assert.ok(read('lib/portal/evidence-cron.ts').includes("membersWithFlag(db, 'public_faces_off')"), 'org node chokepoint');
  assert.ok(read('app/api/media/route.ts').includes("policy_blocked: 'media_off'") && read('app/api/media/route.ts').includes("policy_blocked: 'voice_off'"), 'media gates');
  assert.ok(read('app/api/me/voice-reply/route.ts').includes("userFlag(db, user.id, 'voice_off'"), 'voice-reply gate');
  assert.ok(read('lib/grad/store.ts').includes("'verify_minimal'") && read('lib/grad/store.ts').includes("'voice_off'"), 'grad store gates'); assert.ok(read('lib/map/store.ts').includes("'verify_minimal'") && read('lib/map/store.ts').includes("'voice_off'"), 'map store gates');
  assert.ok(read('app/components/Nadi.tsx').includes('fetchMyPolicy') && read('app/components/Nadi.tsx').includes('kioskWatch') && read('app/components/Nadi.tsx').includes('{!voiceOff && <button'), 'Nadi hides mic + kiosk');
  assert.ok(read('app/org/page.tsx').includes("['policy', 'السياسة والهوية', 'Policy & identity']") && read('app/org/page.tsx').includes("tab === 'policy' && <OrgPolicy"), '/org tab');
  assert.ok(read('app/components/login/LoginCard.tsx').includes('href="/enter"'), 'login link to /enter'); assert.ok(read('app/components/GlobalNavigation.tsx').includes("'/enter'") && read('app/components/GlobalNavigation.tsx').includes("'/verify/policy'"), 'portal prefixes');
  assert.ok(read('lib/portal/way.ts').includes("'verify/policy'") && read('lib/portal/way.ts').includes('enter:'), 'way names');
  for (const p of ['app/enter/page.tsx', 'app/verify/policy/page.tsx', 'app/components/OrgPolicy.tsx', 'app/api/enter/route.ts', 'app/api/me/policy/route.ts', 'app/api/org/policy/route.ts', 'lib/org/policy-client.ts', 'lib/org/epithets.ts']) assert.ok(has(p), `exists ${p}`);
  assert.ok(REGISTRY.some(r => r.table === 'portal_org_codes' && r.piiCols.includes('training_no')), 'registry: org codes'); assert.ok(NON_PERSONAL_TABLES.includes('portal_org_policy_seals'), 'registry: seals non-personal');
  for (const k of ['org_policy', 'org_codes', 'org_pin_reset', 'org_code_revoked', 'org_code_restored', 'org_code_locked']) { assert.ok(KIND_AR[k], `KIND_AR ${k}`); assert.ok(DEFAULT_SEVERITY[k], `severity ${k}`); }
  assert.equal(DEFAULT_SEVERITY.org_code_locked, 'warn', 'lock is warn'); assert.equal(DEFAULT_SEVERITY.org_policy, 'warn', 'policy change is warn');
  const enter = read('app/enter/page.tsx'); assert.ok(enter.includes('ميثاق الرمز') && enter.includes('EPITHETS') && enter.includes("lang === 'ar' ? 'English' : 'العربية'") && enter.includes('autoComplete="current-password"'), '/enter bilingual + charter + epithets');
  assert.ok(!/full_name|البريد الإلكتروني/.test(enter), '/enter never asks for a name or email');
  const comp = read('app/components/OrgPolicy.tsx'); assert.ok(comp.includes('opl-switch-') && comp.includes('opl-roster-go') && comp.includes('opl-card') && comp.includes('opl-visitor-item') && comp.includes('@media print'), 'OrgPolicy testids + print cards');
  assert.ok(read('app/admin/shield/page.tsx').includes('هوية مستعارة') && read('lib/shield/freeze.ts').includes('policy,slug'), 'admin badge + listOrgs policy');
});
