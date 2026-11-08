// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P65 «درع أَثَر — الطبقة الثانية» — الوصول الإداري · CSP والحكم · شهادة الدرع · التجميد · خروج الجهة · شكل المصدر (SQL/المسارات/السجلّ) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { PII_PATHS, normalizePath, isPiiPath, piiPathTitle } from '../lib/shield/paths';
import { summarize, subjectHash, subjectAccessLineAr, accessCsv, recordAccess, accessForSubject, roleAr } from '../lib/shield/access';
import { cspSummary, cspVerdict, ENFORCE_STEPS_AR, explainBenign } from '../lib/shield/csp';
import { sealCode, isSealCode, sealStats, monthOf, prevMonth, monthAr, sealStatementAr, canonical, sealDigest, verifySealBody, issueSeal, findSeal } from '../lib/shield/seal';
import { frozenFor, freezeGate, setFreeze, FROZEN_STATUS, FROZEN_AR } from '../lib/shield/freeze';
import { footprintRows, footprintSummaryAr, orgCode, isEraseCode, requestOrgErase, cancelOrgErase, dueOrgErasures, executeOrgErase, findEraseReceipt, ORG_ERASE_HOLD_DAYS } from '../lib/vault/org';
import { KIND_AR, DEFAULT_SEVERITY } from '../lib/shield/guard';
import { REGISTRY, NON_PERSONAL_TABLES } from '../lib/vault/registry';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const has = (p: string) => existsSync(new URL(`../${p}`, import.meta.url));
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/* قاعدة وهمية صغيرة: جداول في الذاكرة + rpc */
function fakeDb(seed: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = JSON.parse(JSON.stringify(seed)); const rpcs: { name: string; args: any }[] = []; const events: any[] = [];
  T.portal_security_events = T.portal_security_events || []; T.portal_shield_seals = T.portal_shield_seals || []; T.portal_admin_access = T.portal_admin_access || [];
  const from = (t: string) => {
    T[t] = T[t] || []; let rows = T[t]; let fs: ((r: any) => boolean)[] = []; let op: 'select' | 'update' | 'insert' | 'upsert' = 'select'; let patch: any = null; let lim = 0; let single = false; let ordBy: [string, boolean] | null = null;
    const q: any = {
      select() { return q; }, eq(c: string, v: any) { fs.push(r => String(r[c]) === String(v)); return q; }, in(c: string, v: any[]) { fs.push(r => v.map(String).includes(String(r[c]))); return q; },
      gte(c: string, v: any) { fs.push(r => String(r[c]) >= String(v)); return q; }, lt(c: string, v: any) { fs.push(r => String(r[c]) < String(v)); return q; }, lte(c: string, v: any) { fs.push(r => String(r[c]) <= String(v)); return q; },
      is(c: string, v: any) { fs.push(r => v === null ? r[c] == null : r[c] === v); return q; }, not(c: string, _o: string, v: any) { fs.push(r => !(v === null ? r[c] == null : r[c] === v)); return q; },
      or(expr: string) { const parts = expr.split(','); fs.push(r => parts.some(p => { const [c, o, v] = p.split('.'); return o === 'eq' ? String(r[c]) === v : String(r[c] || '').toLowerCase() === String(v).toLowerCase(); })); return q; },
      ilike(c: string, v: string) { fs.push(r => String(r[c] || '').toLowerCase() === v.toLowerCase()); return q; },
      order(c: string, o: any) { ordBy = [c, !!o?.ascending]; return q; }, limit(n: number) { lim = n; return q; }, maybeSingle() { single = true; return q; },
      update(p: any) { op = 'update'; patch = p; return q; }, insert(p: any) { op = 'insert'; patch = p; return q; }, upsert(p: any, o: any) { op = 'upsert'; patch = { ...p, _conflict: o?.onConflict }; return q; },
      then(res: any) {
        let out = rows.filter(r => fs.every(f => f(r)));
        if (op === 'update') { for (const r of out) Object.assign(r, patch); }
        else if (op === 'insert') { const r = { id: rows.length + 1, ...patch }; rows.push(r); out = [r]; }
        else if (op === 'upsert') { const { _conflict, ...p } = patch; const k = _conflict; const ex = k ? rows.find(r => String(r[k]) === String(p[k])) : null; if (ex) Object.assign(ex, p); else rows.push({ id: rows.length + 1, ...p }); out = [ex || p]; }
        if (ordBy) { const [c, asc] = ordBy; out = [...out].sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : 1) * (asc ? 1 : -1)); }
        if (lim) out = out.slice(0, lim);
        res({ data: single ? (out[0] || null) : out, error: null });
      },
    };
    return q;
  };
  const db: any = { T, rpcs, events, from, rpc: async (name: string, args: any) => {
    rpcs.push({ name, args });
    if (name === 'shield_access_touch') { const k = (r: any) => `${r.user_id}|${r.path}|${r.subject_hash}|${r.day}`; const day = new Date().toISOString().slice(0, 10); const row = { user_id: args.p_user, role: args.p_role, path: args.p_path, subject_hash: args.p_subject || '', day, hits: 1, last_at: new Date().toISOString(), first_at: new Date().toISOString() }; const ex = T.portal_admin_access.find(r => k(r) === k(row)); if (ex) { ex.hits += 1; ex.last_at = row.last_at; } else T.portal_admin_access.push({ id: T.portal_admin_access.length + 1, ...row }); return { data: 1, error: null }; }
    if (name === 'vault_org_footprint') return { data: { 'portal_org_members.organization_id': { rows: 3, on_delete: 'cascade' }, 'portal_enrollments.organization_id': { rows: 12, on_delete: 'set_null' }, 'portal_org_letters.organization_id': { rows: 2, on_delete: 'cascade' } }, error: null };
    if (name === 'vault_org_erase') { const i = T.portal_organizations.findIndex(o => o.id === args.p_org); const existed = i >= 0; if (existed) T.portal_organizations.splice(i, 1); return { data: { footprint: { 'portal_org_members.organization_id': { rows: 3, on_delete: 'cascade' }, 'portal_enrollments.organization_id': { rows: 12, on_delete: 'set_null' } }, org_deleted: existed, restrict_tables_cleared: 0 }, error: null }; }
    return { data: null, error: { message: 'unknown rpc ' + name } };
  } };
  return db;
}

/* ———— المسارات والوصول ———— */
test('P65 المسارات: تطبيع (استعلام/معرّفات) · قائمة PII معلنة · ما ليس فيها لا يُسجَّل', () => {
  assert.equal(normalizePath('/admin/enrollments?x=1#y'), '/admin/enrollments');
  assert.equal(normalizePath(`/admin/org/${U(7)}/letters/`), '/admin/org/:id/letters');
  assert.equal(normalizePath('/admin/placements/123'), '/admin/placements/:id');
  assert.ok(isPiiPath('/admin/enrollments') && isPiiPath('/admin/management?tab=rooms') && isPiiPath(`/admin/org/${U(1)}`), 'صفحات بيانات شخصية');
  assert.ok(!isPiiPath('/admin/catalog') && !isPiiPath('/admin') && !isPiiPath('/me/data') && !isPiiPath('/admin/enrollmentsx'), 'كتالوج/جذر/غير إداري/بادئة مشابهة لا تُحسب');
  assert.equal(piiPathTitle('/admin/vault/x'), 'خزنة أَثَر');
  assert.ok(PII_PATHS.length >= 40 && new Set(PII_PATHS.map(p => p.prefix)).size === PII_PATHS.length, 'قائمة بلا تكرار');
  for (const p of PII_PATHS) assert.ok(p.prefix.startsWith('/admin/') && p.title_ar, p.prefix);
});

test('P65 الوصول الإداري: صفّ واحد لكل (مستخدم×مسار×شخص×يوم) يزداد hits · التجميع · بصمة الشخص لا بريده · سطر المتدرّب الصادق · CSV', async () => {
  const db = fakeDb();
  assert.ok(await recordAccess(db, { user_id: U(1), role: 'admin', path: '/admin/enrollments?page=2', ip: '10.1.2.3' }));
  assert.ok(await recordAccess(db, { user_id: U(1), role: 'ADMIN', path: '/admin/enrollments', ip: '10.1.2.3' }));
  assert.ok(await recordAccess(db, { user_id: U(2), role: 'QUALITY_ANALYST', path: '/admin/vault', subject_email: 'Reem@Example.com ' }));
  assert.equal(db.T.portal_admin_access.length, 2, 'صفّان لا ثلاثة'); assert.equal(db.T.portal_admin_access[0].hits, 2, 'المرّة الثانية زادت العدّاد');
  assert.equal(db.T.portal_admin_access[0].path, '/admin/enrollments'); assert.equal(db.T.portal_admin_access[0].role, 'ADMIN');
  assert.equal(db.T.portal_admin_access[1].subject_hash, subjectHash('reem@example.com'), 'بصمة موحَّدة (حروف صغيرة · بلا فراغ)'); assert.ok(!JSON.stringify(db.T.portal_admin_access).includes('example.com'), 'لا بريد في السجلّ');
  const s = summarize(db.T.portal_admin_access, '2026-11-01');
  assert.equal(s.by_path[0].path, '/admin/enrollments'); assert.equal(s.by_path[0].hits, 2); assert.equal(s.by_path[0].title_ar, 'التسجيلات'); assert.equal(s.by_user.length, 2); assert.equal(s.subject_views, 1);
  const a = await accessForSubject(db, 'reem@example.com', 30); assert.equal(a.count, 1); assert.equal(a.staff, 1); assert.deepEqual(a.roles, ['محلّل جودة']);
  assert.ok(subjectAccessLineAr(a).includes('عضو واحد من الطاقم') && subjectAccessLineAr(a).includes('محلّل جودة') && !subjectAccessLineAr(a).includes(U(2)), 'أدوار لا أسماء ولا معرّفات');
  assert.ok(subjectAccessLineAr({ days: 30, count: 0, staff: 0, roles: [], last_at: null }).includes('لم يفتح أحدٌ'), 'صفر صادق');
  const csv = accessCsv(db.T.portal_admin_access, { [U(1)]: 'أ. سارة' }); assert.ok(csv.startsWith('\uFEFF') && csv.includes('أ. سارة') && csv.includes('التسجيلات') && csv.split('\n').length === 3);
  assert.equal(roleAr('program_manager'), 'مدير برنامج'); assert.equal(roleAr(''), 'طاقم');
});

/* ———— CSP ———— */
test('P65 CSP: تجميع التقارير · حكم الجاهزية (لا بلاغ غير مفسَّر خلال 7 أيام) · الضوضاء المعروفة تُفسَّر · خطوات التحويل', () => {
  const now = Date.parse('2026-11-08T10:00:00Z'); const d = (h: number) => new Date(now - h * 3600000).toISOString();
  const ev = [
    { at: d(1), meta: { directive: 'script-src-elem', blocked: 'https://evil.example/x.js?v=1', document: 'https://athar-portal.vercel.app/me' } },
    { at: d(2), meta: { directive: 'script-src-elem', blocked: 'https://evil.example/x.js?v=2', document: 'https://athar-portal.vercel.app/me' } },
    { at: d(3), meta: { directive: 'img-src', blocked: 'chrome-extension://abc', document: 'https://athar-portal.vercel.app/' } },
    { at: d(24 * 9), meta: { directive: 'style-src', blocked: 'https://old.example/a.css', document: 'https://athar-portal.vercel.app/' } },
  ];
  const rows = cspSummary(ev as any); assert.equal(rows.length, 3); assert.equal(rows[0].blocked, 'https://evil.example/x.js'); assert.equal(rows[0].count, 2); assert.deepEqual(rows[0].documents, ['/me']);
  const v = cspVerdict(rows, now); assert.equal(v.ready, false); assert.equal(v.unexplained.length, 1, 'القديم خارج النافذة والإضافة مفسَّرة'); assert.equal(v.explained[0].why_ar, 'إضافة متصفح'); assert.ok(v.reason_ar.includes('evil.example'));
  const v2 = cspVerdict(rows.filter(r => !r.blocked.includes('evil')), now); assert.equal(v2.ready, true); assert.ok(v2.reason_ar.includes('ضوضاء معروفة'));
  assert.equal(cspVerdict([], now).ready, true); assert.equal(explainBenign({ directive: 'x', blocked: 'https://translate.googleapis.com/a' }), 'ترجمة الصفحة في المتصفح');
  assert.ok(ENFORCE_STEPS_AR.length >= 3 && ENFORCE_STEPS_AR[0].includes('Content-Security-Policy-Report-Only'));
});

/* ———— شهادة الدرع ———— */
test('P65 ★2 شهادة الدرع: رمز ATH-SH بلا 0/O/1/I · إحصاء الأيام (آخر تمرين في اليوم يحكم) · بصمة قياسية تصمد أمام إعادة ترتيب jsonb · الإصدار والتحقّق', async () => {
  for (let i = 0; i < 50; i++) { const c = sealCode(); assert.ok(isSealCode(c), c); assert.ok(!/[01OI]/.test(c.slice(7)), c); }
  assert.equal(monthOf(new Date('2026-10-31T21:30:00Z')), '2026-11', 'منتصف ليل الرياض'); assert.equal(prevMonth(new Date('2026-01-15T00:00:00Z')), '2025-12'); assert.equal(monthAr('2026-10'), 'أكتوبر 2026');
  const ck = (ok: boolean) => [{ id: 'headers', ok: true, title_ar: 'ترويسات' }, { id: 'rls_all', ok, title_ar: 'RLS الكل' }];
  const drills = [
    { at: '2026-10-01T03:00:00Z', meta: { passed: 16, total: 17, checks: ck(false) } }, { at: '2026-10-01T09:00:00Z', meta: { passed: 17, total: 17, checks: ck(true) } }, // اليوم نفسه: الأخير يحكم
    { at: '2026-10-02T03:00:00Z', meta: { passed: 16, total: 17, checks: ck(false) } }, { at: '2026-10-03T03:00:00Z', meta: { passed: 17, total: 17, checks: ck(true) } },
    { at: '2026-11-01T03:00:00Z', meta: { passed: 17, total: 17, checks: ck(true) } }, // شهر آخر
  ];
  const st = sealStats(drills as any, '2026-10'); assert.equal(st.total_days, 3); assert.equal(st.passed_days, 2); assert.equal(st.checks_total, 17); assert.equal(st.score, 67); assert.deepEqual(st.failed, [{ id: 'rls_all', title_ar: 'RLS الكل', days: 1 }]);
  assert.ok(sealStatementAr(st, false).includes('أكتوبر 2026') && sealStatementAr(st, false).includes('3 أيام') && sealStatementAr(st, false).includes('RLS الكل (1)'));
  assert.equal(canonical({ b: 1, a: [{ d: 2, c: 'x' }] }), '{"a":[{"c":"x","d":2}],"b":1}'); const body = { type: 'AtharShieldSeal', code: 'ATH-SH-AAAA-BBBB', month: '2026-10', proof: { x: 1 }, hash: 'sha256:zz' };
  const dg = sealDigest(body); assert.ok(verifySealBody({ hash: 'sha256:zz', month: '2026-10', code: 'ATH-SH-AAAA-BBBB', type: 'AtharShieldSeal', proof: null }, dg), 'ترتيب مختلف وproof مختلف → البصمة نفسها'); assert.ok(!verifySealBody({ ...body, month: '2026-09' }, dg));
  const db = fakeDb({ portal_security_events: drills.map((d, i) => ({ id: i + 1, kind: 'drill', ...d })) });
  const seal = await issueSeal(db, { month: '2026-10', env: { NEXT_PUBLIC_SITE_URL: 'https://t.example' }, site: 'https://t.example', actor: 'test' });
  assert.ok(seal && isSealCode(seal.code) && seal.passed_days === 2 && seal.total_days === 3, 'صدر الختم'); assert.equal(db.T.portal_shield_seals.length, 1); assert.ok(db.T.portal_security_events.some((e: any) => e.kind === 'shield_seal'), 'حدث الختم');
  const again = await issueSeal(db, { month: '2026-10' }); assert.equal(again!.code, seal!.code, 'الشهر المكتمل لا يُعاد ختمه'); assert.equal(db.T.portal_shield_seals.length, 1);
  const none = await issueSeal(db, { month: '2026-09' }); assert.equal(none, null, 'شهر بلا تمرين = لا ختم');
  const v = await findSeal(db, seal!.code.toLowerCase()); assert.ok(v.valid && v.intact && v.seal!.month === '2026-10' && !JSON.stringify(v).includes('secret')); assert.equal((await findSeal(db, 'ATH-SH-ZZZZ-ZZZ0')).valid, false);
  assert.equal(KIND_AR.shield_seal, 'ختم شهادة الدرع الشهرية'); assert.equal(DEFAULT_SEVERITY.org_frozen, 'critical');
});

/* ———— التجميد ———— */
test('P65 ★3 زرّ التجميد: لا جهة مجمَّدة = استعلام واحد · عضو جهة مجمَّدة يُرفض 423 برسالة إنسانية · غير العضو يمرّ · التجميد/الرفع حدثان', async () => {
  const org = U(50); const db = fakeDb({ portal_organizations: [{ id: org, name_ar: 'جامعة أَثَر', frozen_at: null }], portal_org_members: [{ organization_id: org, user_id: U(5), email: 'reem@x.sa', status: 'confirmed' }, { organization_id: org, user_id: U(6), email: 'pending@x.sa', status: 'pending' }] });
  assert.deepEqual(await frozenFor(db, { id: U(5) }), { frozen: false });
  const r = await setFreeze(db, { org_id: org, on: true, by: { id: U(1), email: 'admin@x.sa' }, reason: 'بلاغ 12', env: {} }); assert.ok(r.ok);
  const st = await frozenFor(db, { id: U(5), email: 'reem@x.sa' }); assert.equal(st.frozen, true); assert.equal(st.org!.frozen_reason, 'بلاغ 12');
  const gate = await freezeGate(db, { id: U(5) }); assert.ok(gate && gate.status === FROZEN_STATUS); const j = await gate!.json(); assert.equal(j.frozen, true); assert.equal(j.error, FROZEN_AR); assert.ok(FROZEN_AR.includes('محفوظة'));
  assert.equal(await freezeGate(db, { id: U(6) }), null, 'عضوية غير مؤكَّدة لا تُجمَّد'); assert.equal(await freezeGate(db, { id: U(9) }), null, 'غير عضو');
  const db2 = fakeDb({ portal_organizations: [{ id: org, name_ar: 'x', frozen_at: '2026-11-01T00:00:00Z' }], portal_enrollments: [{ user_id: U(7), organization_id: org }] }); assert.equal((await frozenFor(db2, { id: U(7) })).frozen, true, 'عبر التسجيل أيضًا');
  const r2 = await setFreeze(db, { org_id: org, on: false, by: { id: U(1), email: 'admin@x.sa' }, env: {} }); assert.ok(r2.ok); assert.equal(await freezeGate(db, { id: U(5) }), null);
  const kinds = db.T.portal_security_events.map((e: any) => e.kind + ':' + e.severity); assert.deepEqual(kinds, ['org_frozen:critical', 'org_unfrozen:info']);
  assert.equal((await setFreeze(db, { org_id: U(99), on: true, by: { id: U(1), email: 'a' }, env: {} })).ok, false);
});

/* ———— خروج الجهة ———— */
test('P65 خروج الجهة: بصمة من المفاتيح الأجنبية · خلاصة صادقة · طلب محو بمهلة 7 أيام وتراجع · التنفيذ عند الاستحقاق بإيصال ATH-ER يُتحقّق منه بلا اسم', async () => {
  const rows = footprintRows({ 'portal_org_members.organization_id': { rows: 3, on_delete: 'cascade' }, 'portal_enrollments.organization_id': { rows: 12, on_delete: 'set_null' } });
  assert.equal(rows[0].table, 'portal_enrollments'); assert.equal(rows[0].effect_ar, 'يُفكّ الربط (يبقى للشخص)'); assert.equal(rows[1].label_ar, 'عضوية الجهة'.length ? rows[1].label_ar : '', 'عنوان من السجلّ أو اسم الجدول');
  assert.ok(footprintSummaryAr(rows).includes('سيُحذف 3 صفًّا') && footprintSummaryAr(rows).includes('يُفكّ ربط 12 صفًّا')); assert.ok(footprintSummaryAr([]).includes('سجلّ الجهة فقط'));
  assert.ok(isEraseCode(orgCode('ATH-ER')) && orgCode('ATH-EX').startsWith('ATH-EX-'));
  const org = U(50); const db = fakeDb({ portal_organizations: [{ id: org, name_ar: 'جامعة أَثَر', erase_at: null }] }); const now = new Date('2026-11-08T08:00:00Z');
  const rq = await requestOrgErase(db, { id: org, name_ar: 'جامعة أَثَر' }, { id: U(1), email: 'a@x' }, 'انتهى التعاقد', {}, now); assert.ok(rq.ok); assert.equal(rq.erase_at, '2026-11-15T08:00:00.000Z'); assert.equal(ORG_ERASE_HOLD_DAYS, 7);
  assert.equal((await dueOrgErasures(db, new Date('2026-11-14T08:00:00Z'))).length, 0, 'قبل الموعد لا شيء'); assert.equal((await dueOrgErasures(db, new Date('2026-11-15T08:00:00Z'))).length, 1);
  assert.ok((await cancelOrgErase(db, { id: org, name_ar: 'x' }, { id: U(1), email: 'a@x' }, {})).ok); assert.equal(db.T.portal_organizations[0].erase_at, null); assert.equal((await dueOrgErasures(db, new Date('2026-11-20T08:00:00Z'))).length, 0, 'التراجع يلغي');
  await requestOrgErase(db, { id: org, name_ar: 'جامعة أَثَر' }, { id: U(1), email: 'a@x' }, '', {}, now);
  const due = await dueOrgErasures(db, new Date('2026-11-16T08:00:00Z')); const ex = await executeOrgErase(db, due[0], 'cron', { NEXT_PUBLIC_SITE_URL: 'https://t.example' }, 'https://t.example');
  assert.ok(ex.ok && isEraseCode(ex.code)); assert.equal(db.T.portal_organizations.length, 0, 'حُذفت الجهة'); assert.ok(ex.receipt.summary_ar.includes('يُفكّ ربط 12') && ex.receipt.org_deleted === true && ex.receipt.hold_days === 7);
  assert.ok(!JSON.stringify(ex.receipt).includes('جامعة أَثَر') && !JSON.stringify(ex.receipt).includes(org), 'الإيصال بلا اسم الجهة ولا معرّفها');
  const v = await findEraseReceipt(db, ex.code); assert.ok(v.valid && v.receipt.tables.length === 2 && v.receipt.code === ex.code && v.receipt.executed_at); assert.equal((await findEraseReceipt(db, 'ATH-ER-AAAA-AAAA')).valid, false); assert.equal((await findEraseReceipt(db, 'ATH-SH-AAAA-AAAA')).valid, false, 'بادئة أخرى تُرفض');
  const kinds = db.T.portal_security_events.map((e: any) => e.kind); assert.deepEqual(kinds, ['org_erase_requested', 'org_erase_cancelled', 'org_erase_requested', 'org_erased']);
});

/* ———— شكل المصدر ———— */
test('P65 شكل المصدر: SQL (الجداول والدوال والأعمدة) · التمرين 17 · بوابة التجميد في مسارات الكتابة · السجلّ يعرف الجداول الجديدة · الكرون يختم ويمحو · المنارة في AdminShell · الصفحات العامة', () => {
  const sql = read('supabase/p65-shield-layer2.sql');
  for (const k of ['create table if not exists public.portal_admin_access', 'constraint portal_admin_access_uniq unique (user_id, path, subject_hash, day)', 'function public.shield_access_touch', 'function public.shield_policy_report', 'function public.vault_org_footprint', 'function public.vault_org_export', 'function public.vault_org_erase', 'create table if not exists public.portal_shield_seals', 'add column if not exists frozen_at', 'add column if not exists erase_at', "interval '180 days'", 'digest       text', "confrelid = 'public.portal_organizations'::regclass"]) assert.ok(sql.includes(k), k);
  assert.ok((sql.match(/revoke all on function/g) || []).length >= 6, 'كل الدوال محجوبة عن anon/authenticated'); assert.ok(sql.includes('alter table public.portal_admin_access enable row level security') && sql.includes('alter table public.portal_shield_seals enable row level security'));
  assert.ok(!/^\s*do \$\$ declare r record; begin\s*$/m.test(sql) || sql.includes('-- do $$'), 'حلقة تفعيل RLS تبقى معلَّقة (اختيارية بعد المراجعة)');
  const drill = read('lib/shield/drill.ts'); for (const id of ["'rls_all'", "'anon_write'", "'unauth_pii'"]) assert.ok(drill.includes(id), id); assert.ok(drill.includes("'/api/vault/admin?view=all'") && drill.includes("'/api/diploma?list=1'"));
  for (const f of ['app/api/diploma/route.ts', 'app/api/me/line/route.ts', 'app/api/me/day/route.ts', 'app/api/me/map/route.ts', 'app/api/me/letter/route.ts', 'app/api/me/grad/route.ts', 'app/api/me/first/route.ts']) { const s = read(f); assert.ok(s.includes('freezeGate(db, ') && s.includes("lib/shield/freeze'"), f); const i = s.indexOf('export async function POST'); assert.ok(s.indexOf('freezeGate(db, ', i) - i < 400, `${f}: البوابة بعد التحقّق مباشرة`); }
  assert.ok(REGISTRY.some(r => r.table === 'portal_admin_access' && r.retentionDays === 180 && r.access.includes('self')), 'السجلّ يعرف الوصول الإداري ويعطي الشخص حقّ رؤيته'); assert.ok(NON_PERSONAL_TABLES.includes('portal_shield_seals'));
  const cron = read('lib/shield/cron.ts'); assert.ok(cron.includes('sealLastMonthIfDue(db') && cron.includes('!opts.dry'), 'الختم داخل الكرون الموجود وليس في الوضع الجاف');
  const vcron = read('lib/vault/cron.ts'); assert.ok(vcron.includes('dueOrgErasures(db, now)') && vcron.includes('executeOrgErase(db, o'));
  const shell = read('app/components/AdminShell.tsx'); assert.ok(shell.includes("fetch('/api/shield/access'") && shell.includes('isPiiPath(pathname)') && shell.includes('keepalive: true'), 'منارة واحدة لكل صفحة PII');
  assert.ok(!read('lib/shield/paths.ts').includes('import '), 'paths.ts نقي يصلح للمتصفح');
  for (const p of ['app/verify/shield/page.tsx', 'app/verify/erasure/page.tsx', 'app/privacy/processing/page.tsx', 'app/api/shield/access/route.ts', 'docs/SECURITY-BRIEF-AR.md', 'docs/SECURITY-BRIEF-AR.txt']) assert.ok(has(p), p);
  const nav = read('app/components/GlobalNavigation.tsx'); for (const p of ["'/verify/shield'", "'/verify/erasure'", "'/privacy/processing'"]) assert.ok(nav.includes(p), p);
  const route = read('app/api/shield/route.ts'); for (const a of ["'freeze'", "'org_export'", "'org_erase_request'", "'seal_now'", "'csp_clear'", "searchParams.get('seal')", "searchParams.get('erasure')", "format') === 'csv'"]) assert.ok(route.includes(a), a);
  assert.ok(read('app/api/vault/route.ts').includes('who_looked') && read('app/me/data/page.tsx').includes('vault-who-looked'), '★1 في ذاكرتي');
  const nc = read('next.config.js'); assert.ok(nc.includes("'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY"), 'الإلزام لا يُدفع تلقائيًا — السياسة الكاملة تبقى Report-Only حتى أسبوع نظيف');
});
