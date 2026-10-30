// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P26 — «رحلة الجهة»: فصول جماعية لكل ربع × نوع ولا فصل دون k=5 أشخاص متمايزين (لا أحداث) · أحداث غير المنسوبين تُستبعد · فصول الجهة (ميثاق/توأمة/عقد) بلا نصاب
//                 · المرآة: الجهة مقابل سنتها الماضية فقط ويُكتم ما دون k · كتاب السنة: كشف انتقائي + كلمات الجهة · وثيقة Ed25519 kind=org_journey بلا بُرُد · قراءة عامة · سحب · انتهاء
//                 · رسالة الجهة إلى نفسها: تُسلَّم لمديري الجهة الحاليين · الفصل المشترك في رحلة الممارس (عدد فقط، لا يُنشر) · الخزنة 3 جداول (تجهيل) · MCP org_yearbook عام للقراءة
import test from 'node:test';
import assert from 'node:assert/strict';
import { K_ORG, ORG_SHARE_MONTHS, ORG_CAPSULE_DAYS, ORG_CAPSULE_MIN_CHARS, buildOrgChapters, buildOrgMirror, buildOrgJourney, selectOrgPublic, validateOrgShare, validateOrgNote, validateOrgCapsule, orgShareCode, addMonths, orgSnapshot, orgCapsuleText, orgJourneySummary, quarterOf } from '../lib/org-journey/registry';
import type { OrgJourneyInput, OrgEvent } from '../lib/org-journey/registry';
import { buildOrgJourneyDoc, createOrgShare, revokeOrgShare, publicYearbook, publicYearbooks, orgShares } from '../lib/org-journey/share';
import { runOrgJourney } from '../lib/org-journey/cron';
import { localOrgIntro } from '../lib/org-journey/load';
import { attachPeers, peersText } from '../lib/journey/registry';
import { REGISTRY, erasurePlan } from '../lib/vault/registry';
import { ALL_MCP_TOOLS, toolsFor } from '../lib/portal/mcp';
import { signerFromEnv, verifySignature, localResolver } from '../lib/portal/vc-server';
import { structuralChecks } from '../lib/portal/vc';

const K1 = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=';
const SITE = 'https://athar-portal.vercel.app'; const DID = 'did:web:athar-portal.vercel.app';
const NOW = new Date('2026-10-30T08:00:00Z').getTime(); const ago = (d: number) => new Date(NOW - d * 864e5).toISOString();
const ORG = { id: '00000000-0000-4000-8000-000000000021', name_ar: 'وزارة التعليم', name_en: 'MoE', sector: 'gov' };
const ADMIN = { id: '00000000-0000-4000-8000-000000000001', email: 'Admin@upm.edu.sa' };

function fakeDb(seed: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = {}; for (const [k, v] of Object.entries(seed)) T[k] = v.map((r, i) => ({ id: i + 1, ...r }));
  const table = (t: string) => (T[t] = T[t] || []);
  const match = (r: any, f: any): boolean => {
    switch (f.op) {
      case 'eq': return r[f.c] === f.v || String(r[f.c]) === String(f.v);
      case 'ilike': return String(r[f.c] || '').toLowerCase() === String(f.v).toLowerCase();
      case 'in': return f.v.map(String).includes(String(r[f.c]));
      case 'is': return r[f.c] == null; case 'not_is': return r[f.c] != null;
      case 'lte': return r[f.c] <= f.v; case 'lt': return r[f.c] < f.v; case 'gte': return r[f.c] >= f.v; case 'gt': return r[f.c] > f.v;
      case 'or': return f.v.split(',').some((part: string) => { const [c, op, ...rest] = part.split('.'); const v = rest.join('.'); return match(r, { op: op === 'eq' ? 'eq' : 'ilike', c, v }); });
      default: return true;
    }
  };
  const db: any = {
    T, from: (t: string) => {
      const q: any = { _f: [], _order: null, _limit: 0, _single: false, _op: 'select', _payload: null };
      const run = () => {
        const rows = table(t);
        if (q._op === 'insert') { const arr = Array.isArray(q._payload) ? q._payload : [q._payload]; const ins = arr.map((p: any) => ({ id: `${t}-${rows.length + 1}-${Math.floor(Math.random() * 1e6)}`, status_index: rows.length + 1, created_at: new Date().toISOString(), ...p })); rows.push(...ins); return { data: q._single ? ins[0] : ins, error: null }; }
        let sel = rows.filter(r => q._f.every((f: any) => match(r, f)));
        if (q._op === 'update') { for (const r of sel) Object.assign(r, q._payload); return { data: q._single ? sel[0] || null : sel, error: null }; }
        if (q._op === 'delete') { T[t] = rows.filter(r => !sel.includes(r)); return { data: sel, error: null }; }
        if (q._order) sel = [...sel].sort((a, b) => (a[q._order.c] < b[q._order.c] ? 1 : -1) * (q._order.asc ? -1 : 1));
        if (q._limit) sel = sel.slice(0, q._limit);
        return { data: q._single ? sel[0] || null : sel, count: sel.length, error: null };
      };
      q.select = () => q;
      for (const op of ['eq', 'ilike', 'lte', 'lt', 'gte', 'gt', 'neq']) q[op] = (c: string, v: any) => { q._f.push({ op, c, v }); return q; };
      q.in = (c: string, v: any[]) => { q._f.push({ op: 'in', c, v }); return q; }; q.is = (c: string, v: any) => { q._f.push({ op: 'is', c, v }); return q; }; q.not = (c: string, op: string) => { if (op === 'is') q._f.push({ op: 'not_is', c }); return q; }; q.or = (s: string) => { q._f.push({ op: 'or', v: s }); return q; };
      q.order = (c: string, o: any) => { q._order = { c, asc: !!o?.ascending }; return q; }; q.limit = (n: number) => { q._limit = n; return q; }; q.maybeSingle = () => { q._single = true; return q; }; q.single = q.maybeSingle;
      q.insert = (p: any) => { q._op = 'insert'; q._payload = p; return q; }; q.update = (p: any) => { q._op = 'update'; q._payload = p; return q; }; q.delete = () => { q._op = 'delete'; return q; };
      q.then = (res: any, rej: any) => Promise.resolve(run()).then(res, rej);
      return q;
    },
  };
  return db;
}

const P = (n: number) => `p${n}@moe.gov.sa`;
const ev = (n: number, daysAgo: number, theme?: string): OrgEvent => ({ person: P(n), at: ago(daysAgo), theme: theme || null });
/** جهة من 12 منسوبًا: 7 واجهوا أول موقف هذا الربع (فصل) · 4 أُكِّدت مهامهم (دون النصاب) · 6 عادوا (فصل بموضوع غالب) · 5 مستويات معتمدة · 6 أول موقف قبل سنة (للمرآة) · ميثاق · توأمة · عقد عاد */
function seed(): OrgJourneyInput {
  return {
    members: Array.from({ length: 12 }, (_, i) => P(i)),
    daily_first: [...Array.from({ length: 7 }, (_, i) => ev(i, 20 + i)), ...Array.from({ length: 6 }, (_, i) => ev(i, 380 + i)), ev(99, 10)],   // p99 ليس منسوبًا
    missions: Array.from({ length: 4 }, (_, i) => ev(i, 15 + i)),
    joins: [], returns: Array.from({ length: 6 }, (_, i) => ev(i, 5 + i, i < 4 ? 'conflict' : 'feedback')), attestations: [],
    levels: Array.from({ length: 5 }, (_, i) => ({ person: `00000000-0000-4000-8000-0000000007${i}0`, at: ago(8 + i) })),   // بمعرّف المستخدم (لا بريد) — مسموح
    credentials: [], charters: [{ signed_at: ago(200), renewed: false }], twinnings: [{ at: ago(60), orgs: 2 }], contracts: [{ delivered_at: ago(100), returned: true }],
  };
}

test('p26 chapters: quarter × kind, distinct people (not events), k=5 hard floor, non-members excluded, org-level chapters without quorum, below-k list', () => {
  assert.equal(K_ORG, 5);
  const inp = seed(); const { chapters, below } = buildOrgChapters(inp);
  const kinds = chapters.map(c => c.kind); assert.ok(kinds.includes('daily') && kinds.includes('return') && kinds.includes('level'), 'ثلاثة فصول جماعية: ' + kinds.join(','));
  assert.ok(!kinds.includes('mission'), '4 أشخاص لا يصنعون فصلًا'); const bm = below.find(b => b.kind === 'mission'); assert.ok(bm && bm.people === 4 && bm.k === 5, 'يظهر في «يقترب» بعدده');
  const daily = chapters.filter(c => c.kind === 'daily'); assert.equal(daily.length, 2, 'فصل هذا الربع وفصل قبل سنة');
  const dNow = daily.find(c => c.quarter === quarterOf(ago(20)))!; assert.equal(dNow.people, 7, 'p99 غير المنسوب مستبعد'); assert.equal(dNow.key, `${quarterOf(ago(20))}:daily`); assert.ok(dNow.title_ar.includes('7 أشخاص'), dNow.title_ar);
  const r = chapters.find(c => c.kind === 'return')!; assert.equal(r.people, 6); assert.ok(r.theme_ar && r.what_ar.includes(r.theme_ar), 'الموضوع الغالب يُذكر: ' + r.what_ar);
  // الأحداث المكررة للشخص نفسه لا تُحتسب مرتين
  const dup = buildOrgChapters({ ...inp, missions: [ev(0, 1), ev(0, 2), ev(0, 3), ev(1, 1), ev(2, 1), ev(3, 1), ev(4, 1)] }); assert.equal(dup.chapters.find(c => c.kind === 'mission')!.people, 5, '7 أحداث لـ5 أشخاص = 5');
  assert.equal(buildOrgChapters({ ...inp, missions: [ev(0, 1), ev(0, 2), ev(0, 3), ev(1, 1), ev(2, 1), ev(3, 1)] }).chapters.some(c => c.kind === 'mission'), false, '6 أحداث لـ4 أشخاص لا تكفي');
  assert.ok(chapters.some(c => c.kind === 'charter' && c.people === null), 'الميثاق فصل جهة بلا عدد'); assert.ok(chapters.some(c => c.kind === 'twinning'), 'التوأمة'); const ct = chapters.find(c => c.kind === 'contract')!; assert.ok(ct && ct.title_ar.includes('العودة'), 'عقد عادت دفعته: ' + ct.title_ar);
  for (let i = 1; i < chapters.length; i++) assert.ok(chapters[i - 1].at <= chapters[i].at, 'ترتيب زمني');
  assert.ok(!JSON.stringify(chapters).includes('@'), 'لا بريد في أي فصل');
  const empty = buildOrgChapters({ ...inp, members: [] , daily_first: [], returns: [], levels: [], charters: [], twinnings: [], contracts: [] }); assert.equal(empty.chapters.length, 0); assert.equal(empty.below.length, 1, 'المهام فقط في «يقترب»');
});

test('p26 mirror + journey: this year vs last year only, suppressed under k, eras by quarter, arc, snapshot/summary', () => {
  const inp = seed(); const m = buildOrgMirror(inp, NOW);
  const d = m.find(r => r.kind === 'daily')!; assert.equal(d.now, 7); assert.equal(d.prev, 6); assert.ok(d.read_ar.includes('أكثر'), d.read_ar);
  const ms = m.find(r => r.kind === 'mission')!; assert.equal(ms.now, null, 'أقل من k → مكتوم'); assert.ok(ms.read_ar.includes('4 من 5'), ms.read_ar);
  const lv = m.find(r => r.kind === 'level')!; assert.equal(lv.now, 5); assert.equal(lv.prev, null); assert.ok(lv.read_ar.includes('دون النصاب'), lv.read_ar);
  const j = buildOrgJourney(inp, NOW); assert.equal(j.k, 5); assert.equal(j.members, 12); assert.ok(j.eras.length >= 2, 'حقب بالأرباع'); assert.ok(j.eras.every(e => /الربع/.test(e.label)), 'تسمية الربع');
  assert.ok(j.arc_ar.includes('يعودون بما حدث') && j.arc_ar.includes('الميثاق') && j.arc_ar.includes('عقد أثر'), j.arc_ar); assert.equal(j.year_label, '2026'); assert.ok(j.privacy_ar.length >= 4);
  const s = orgSnapshot(j); assert.equal(s.members, 12); assert.equal(s.chapters, j.chapters.length); assert.ok(s.kinds.daily === 2 && s.kinds.return === 1, JSON.stringify(s.kinds));
  const t = orgCapsuleText(ORG.name_ar, s, { ...s, members: 20, chapters: s.chapters + 3, kinds: { ...s.kinds, mission: 1 } }, ago(365)); assert.ok(t.includes('12 منسوبًا') && t.includes('20 منسوبًا') && t.includes('3 فصول جديدة') && t.includes('مهام أكّدها المشرفون'), t);
  const sum = orgJourneySummary(j, [{ code: 'ATH-OY-AAAA-BBBB', status: 'active', expires_at: ago(-30), year_label: '2026' }, { code: 'ATH-OY-CCCC-DDDD', status: 'revoked', expires_at: ago(-30), year_label: '2025' }]); assert.equal(sum.yearbooks.length, 1, 'الكتب الفعّالة فقط'); assert.equal(sum.latest.length, 3);
  const empty = buildOrgJourney({ ...inp, daily_first: [], returns: [], levels: [], charters: [], twinnings: [], contracts: [] }, NOW); assert.ok(empty.arc_ar.includes('خمسة أشخاص'), empty.arc_ar); assert.equal(empty.first_at, null);
  const intro = localOrgIntro(ORG.name_ar, j, ['تعلّمنا أن نسأل قبل أن نقرر، وأن العودة أثمن من الوعد.']); assert.ok(intro.includes(ORG.name_ar) && intro.includes('بكلماتنا') && intro.includes('خمسة'), intro); assert.ok(localOrgIntro(ORG.name_ar, empty, []).includes('صفحته الأولى'));
});

test('p26 selective disclosure + validation: chosen chapters only with org words, intro/year/notes rules, no emails in org voice', () => {
  const { chapters } = buildOrgChapters(seed()); const keyD = chapters.find(c => c.kind === 'daily' && c.people === 7)!.key; const keyR = chapters.find(c => c.kind === 'return')!.key;
  const pub = selectOrgPublic(chapters, [keyD, keyR, 'nope'], { [keyR]: 'صرنا نعود بما حدث لا بما وعدنا.' });
  assert.equal(pub.length, 2); assert.equal(pub[0].people, 7); assert.ok(pub[0].quarter_ar.includes('الربع')); assert.equal(pub[0].note_ar, null); assert.equal(pub[1].note_ar, 'صرنا نعود بما حدث لا بما وعدنا.');
  assert.ok(!('person' in pub[0]) && !JSON.stringify(pub).includes('@'), 'لا أشخاص');
  assert.equal(validateOrgShare({ chapter_keys: [] }, chapters), 'اختر فصلًا واحدًا على الأقل لكتاب السنة'); assert.ok(validateOrgShare({ chapter_keys: ['x'] }, chapters)!.includes('غير موجود'));
  assert.ok(validateOrgShare({ chapter_keys: [keyD], year_label: 'سنة' }, chapters)!.includes('2026')); assert.equal(validateOrgShare({ chapter_keys: [keyD], year_label: '2026/2027' }, chapters), null); assert.ok(validateOrgShare({ chapter_keys: [keyD], intro_ar: 'x'.repeat(901) }, chapters)!.includes('أطول'));
  assert.equal(validateOrgNote({ chapter_key: keyD, body_ar: 'تغيّر فينا شيء' }, chapters), null); assert.ok(validateOrgNote({ chapter_key: 'zzz', body_ar: 'x' }, chapters)!.includes('غير موجود')); assert.ok(validateOrgNote({ chapter_key: keyD, body_ar: '' }, chapters)!.includes('اكتبوا')); assert.ok(validateOrgNote({ chapter_key: keyD, body_ar: 'راسلوا a@b.sa' }, chapters)!.includes('بُرُد'));
  assert.ok(validateOrgCapsule({ body_ar: 'قصير' })!.includes(String(ORG_CAPSULE_MIN_CHARS))); assert.equal(validateOrgCapsule({ body_ar: '', media_id: 'm1' }), null); assert.equal(validateOrgCapsule({ body_ar: 'إلى من يدير هذه الجهة بعد سنة: نرجو أن نكون قد تعلّمنا أن نسأل منسوبينا قبل أن نقرر عنهم.' }), null);
  assert.equal(orgShareCode(() => 'AB12'), 'ATH-OY-AB12-AB12'); assert.equal(addMonths('2026-10-30T00:00:00.000Z', 12), '2027-10-30T00:00:00.000Z');
});

test('p26 yearbook: Ed25519 doc kind=org_journey verifies, no emails/names, public read counts views, shelf lists latest per org (opt-in only), revoke kills link + VC, expiry via cron', async () => {
  const signer = signerFromEnv({ VC_SIGNING_KEY: K1 } as any, SITE)!; assert.ok(signer, 'موقّع');
  const db = fakeDb({ portal_vc_issuances: [], portal_org_journey_shares: [] }); const { chapters } = buildOrgChapters(seed()); const now = new Date(NOW);
  const keys = [chapters.find(c => c.kind === 'daily' && c.people === 7)!.key, chapters.find(c => c.kind === 'return')!.key, chapters.find(c => c.kind === 'charter')!.key];
  const r = await createOrgShare(db, ORG, ADMIN, chapters, { [keys[1]]: 'صرنا نعود بما حدث.' }, { chapter_keys: keys, intro_ar: 'سنةٌ تعلّمنا فيها أن نعود.', year_label: '2026', show_in_councils: true }, signer, SITE, DID, () => 'AB12', 5, now);
  assert.ok(r.ok, 'إصدار الكتاب'); if (!r.ok) return;
  assert.equal(r.share.code, 'ATH-OY-AB12-AB12'); assert.equal(r.share.chapters.length, 3); assert.equal(r.share.org_name, ORG.name_ar); assert.equal(r.share.published_email, 'admin@upm.edu.sa'); assert.equal(r.share.expires_at, addMonths(now, ORG_SHARE_MONTHS)); assert.equal(r.url, `${SITE}/org-journey/ATH-OY-AB12-AB12`); assert.equal(r.signed_vc, true);
  const iss = db.T.portal_vc_issuances[0]; assert.equal(iss.kind, 'org_journey'); assert.equal(iss.user_id, null); assert.equal(iss.email, null); assert.equal(iss.full_name, ORG.name_ar); assert.ok(iss.digest);
  const vc = iss.vc; assert.equal(vc._athar.kind, 'org_journey'); assert.equal(vc._athar.k, 5); assert.equal(vc._athar.organization_id, ORG.id); assert.equal(vc._athar.chapters.find((c: any) => c.kind === 'return').note_ar, 'صرنا نعود بما حدث.'); assert.ok(vc.credentialStatus);
  const txt = JSON.stringify(vc); assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(txt) && !txt.includes('moe.gov') && !txt.includes(ADMIN.id), 'لا بريد ولا معرّف ناشر ولا أشخاص في الوثيقة');
  assert.ok(structuralChecks(vc, now).every(c => c.ok), 'الفحوص البنيوية: ' + JSON.stringify(structuralChecks(vc, now).filter(c => !c.ok)));
  assert.equal((await verifySignature(vc, localResolver(signer, []))).ok, true, 'التوقيع يتحقق');
  assert.ok(!buildOrgJourneyDoc({ code: 'ATH-OY-ZZZZ-ZZZZ', org: ORG, year_label: '2026', chapters: r.share.chapters, intro: null, site: SITE, did: DID, now, expires: r.share.expires_at, statusIndex: null, k: 5 }).credentialStatus);
  const pub = await publicYearbook(db, 'ath-oy-ab12-ab12', SITE, NOW); assert.ok(pub.ok); if (!pub.ok) return;
  assert.equal(pub.yearbook.views, 1); assert.equal(pub.yearbook.org_name, ORG.name_ar); assert.equal(pub.yearbook.k, 5); assert.equal(pub.yearbook.verify_url, `${SITE}/verify/vc?code=ATH-OY-AB12-AB12`); assert.ok(!('published_email' in (pub.yearbook as any)), 'لا بريد الناشر في القراءة العامة');
  assert.equal((await publicYearbook(db, 'ATH-OY-NONE-NONE', SITE, NOW) as any).status, 404); assert.equal((await publicYearbook(db, 'ATH-J-AB12-AB12', SITE, NOW) as any).status, 400, 'رمز رحلة فرد ليس كتابًا');
  // الرفّ: آخر كتاب لكل جهة، الظاهر فقط
  const r2 = await createOrgShare(db, ORG, ADMIN, chapters, {}, { chapter_keys: [keys[0]], intro_ar: null, year_label: '2025', show_in_councils: true }, signer, SITE, DID, () => 'CD34', 5, new Date(NOW + 1000)); assert.ok(r2.ok);
  const r3 = await createOrgShare(db, { ...ORG, id: '00000000-0000-4000-8000-000000000023', name_ar: 'هيئة' }, ADMIN, chapters, {}, { chapter_keys: [keys[0]], intro_ar: null, year_label: '2026', show_in_councils: false }, null, SITE, DID, () => 'EF56', 5, now); assert.ok(r3.ok && !r3.signed_vc, 'بلا مفتاح → كتاب بلا وثيقة');
  const shelf = await publicYearbooks(db, SITE, NOW); assert.equal(shelf.length, 1, 'جهة واحدة ظاهرة (الثانية لم تختر الظهور)'); assert.equal(shelf[0].code, 'ATH-OY-CD34-CD34', 'الأحدث لكل جهة'); assert.equal((await orgShares(db, ORG.id)).length, 2);
  const rv = await revokeOrgShare(db, ORG.id, r.share.id, now); assert.equal(rv.ok, true); assert.equal(db.T.portal_org_journey_shares[0].status, 'revoked'); assert.ok(iss.revoked_at);
  assert.equal((await publicYearbook(db, 'ATH-OY-AB12-AB12', SITE, NOW) as any).status, 410); assert.equal((await revokeOrgShare(db, ORG.id, r.share.id, now)).ok, false, 'لا سحب مرتين'); assert.equal((await revokeOrgShare(db, '00000000-0000-4000-8000-000000000099', r2.ok ? r2.share.id : '', now)).ok, false, 'جهة أخرى لا تسحب');
  const c1 = await runOrgJourney(db, { site: SITE, now: new Date(NOW + 30 * 864e5) }); assert.equal(c1.expired, 0);
  const c2 = await runOrgJourney(db, { site: SITE, now: new Date(new Date(addMonths(now, ORG_SHARE_MONTHS)).getTime() + 864e5) }); assert.equal(c2.expired, 2, 'الكتابان الباقيان انتهيا'); assert.equal(db.T.portal_org_journey_shares[1].status, 'expired'); assert.ok(db.T.portal_vc_issuances[1].revoked_at);
});

test('p26 org time capsule: delivered to CURRENT org admins (not only the writer), then/now snapshots, dry run, no double delivery', async () => {
  assert.equal(ORG_CAPSULE_DAYS, 365);
  const then = { members: 12, chapters: 3, quarters: 2, kinds: { daily: 2, return: 1 }, last_chapter: 'عادوا' };
  const cap = { organization_id: ORG.id, org_name: ORG.name_ar, body_ar: 'إلى من يدير هذه الجهة بعد سنة: نرجو أن نكون قد تعلّمنا أن نسأل منسوبينا قبل أن نقرر عنهم.', media_id: null, kind: 'text', written_by: ADMIN.id, written_email: 'admin@upm.edu.sa', deliver_at: ago(1), delivered_at: null, status: 'sealed', snapshot_then: then, snapshot_now: null, delivered_to: [], meta: {}, created_at: ago(364) };
  const db = fakeDb({
    portal_org_time_capsules: [cap, { ...cap, deliver_at: ago(-100) }, { ...cap, status: 'cancelled' }], portal_org_journey_shares: [],
    portal_org_members: [{ organization_id: ORG.id, email: 'admin@upm.edu.sa', full_name: 'أحمد', role: 'org_admin', status: 'confirmed', user_id: ADMIN.id }, { organization_id: ORG.id, email: 'new.admin@moe.gov.sa', full_name: 'مديرة جديدة', role: 'org_admin', status: 'confirmed', user_id: null }, { organization_id: ORG.id, email: 'old@moe.gov.sa', role: 'org_admin', status: 'rejected', user_id: null }, { organization_id: ORG.id, email: 'l1@moe.gov.sa', role: 'learner', status: 'confirmed', user_id: null }],
    portal_message_log: [], portal_notification_prefs: [], portal_contact_prefs: [],
  });
  const dry = await runOrgJourney(db, { dry: true, site: SITE, now: new Date(NOW) }); assert.equal(dry.delivered, 1); assert.equal(dry.recipients, 2, 'مديران مؤكَّدان'); assert.equal(db.T.portal_org_time_capsules[0].status, 'sealed');
  const live = await runOrgJourney(db, { site: SITE, now: new Date(NOW) }); assert.equal(live.delivered, 1); assert.equal(live.errors.length, 0, live.errors.join(' | ')); assert.equal(live.recipients, 2);
  const c = db.T.portal_org_time_capsules[0]; assert.equal(c.status, 'delivered'); assert.deepEqual([...c.delivered_to].sort(), ['admin@upm.edu.sa', 'new.admin@moe.gov.sa'], 'المديرة الجديدة تستلم وإن لم تكتبها؛ المرفوض لا'); assert.equal(c.snapshot_now.members, 3, 'لقطة اليوم من الأعضاء المؤكَّدين الحاليين (مديران ومتعلم؛ المرفوض لا يُعد)'); assert.ok(String(c.meta.delivery_text).includes('12 منسوبًا') && String(c.meta.delivery_text).includes('3 فصول'), c.meta.delivery_text);
  assert.equal((await runOrgJourney(db, { site: SITE, now: new Date(NOW) })).delivered, 0, 'لا تسليم مرتين');
  assert.equal((await runOrgJourney(db, { site: SITE, now: new Date(NOW + 200 * 864e5) })).delivered, 1, 'الثانية في موعدها');
});

test('p26 shared chapter in practitioner journey: count only when org chapter exists for same quarter × kind, never in public selection', () => {
  const my = [{ key: 'daily_first', kind: 'daily', at: ago(20) }, { key: 'mission:m1', kind: 'mission', at: ago(15) }, { key: 'return_first', kind: 'return', at: ago(400) }];
  const org = buildOrgChapters(seed()).chapters; const withPeers = attachPeers(my, org, ORG.name_ar);
  assert.equal(withPeers[0].peers?.people, 7, 'فصل مشترك: 7 زملاء'); assert.equal(withPeers[0].peers?.org_name, ORG.name_ar); assert.equal(withPeers[1].peers, null, 'المهام دون النصاب → لا شارة'); assert.equal(withPeers[2].peers, null, 'ربع آخر → لا شارة');
  assert.ok(peersText(withPeers[0].peers!).includes('7 من زملائك') && peersText(withPeers[0].peers!).includes('لا أسماء'));
});

test('p26 vault + MCP: 3 org tables registered as org-owned (anonymize author on erasure), org_yearbook is public read-only; no duplicate tables', () => {
  const want = ['portal_org_journey_notes', 'portal_org_journey_shares', 'portal_org_time_capsules'];
  for (const t of want) { const e = REGISTRY.find(x => x.table === t)!; assert.ok(e, `مسجَّل: ${t}`); assert.equal(e.policy, 'anonymize', `${t}: صوت الجهة يبقى للجهة ويُجهَّل الكاتب`); assert.ok(e.access.includes('org'), 'الجهة تصل'); assert.ok(e.userCol && e.emailCol, 'مفاتيح الربط'); }
  const plan = erasurePlan(); assert.ok(want.every(t => plan.anonymize.some(x => x.table === t)), 'في خطة النسيان: تجهيل');
  assert.equal(new Set(REGISTRY.map(r => r.table)).size, REGISTRY.length, 'لا تكرار');
  const tool = ALL_MCP_TOOLS.find(x => x.name === 'org_yearbook')!; assert.ok(tool, 'الأداة موجودة'); assert.equal(tool.annotations.readOnlyHint, true); assert.ok(tool.tiers.includes('anon'), 'عامة'); assert.ok(toolsFor('anon').some(x => x.name === 'org_yearbook'), 'للمجهول'); assert.ok(toolsFor('personal', ['wallet:read']).some(x => x.name === 'org_yearbook'), 'وللمفوَّضين');
  assert.ok(tool.description.includes('k ≥ 5') && tool.description.includes('ATH-OY'), 'الوصف يشرح الحدّ والرمز');
});
