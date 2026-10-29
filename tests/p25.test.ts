// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P25 — «رحلة الممارس»: الفصول من أحداث مسجَّلة فقط (ترتيب زمني · معالم · from/to للمستويات · لا فصل بلا حدث) · الاقتباس كلمات المستخدم وحده
//                 · الكشف الانتقائي (الفصول المختارة فقط · بلا اقتباسات عند الطلب · الاسم المختصر) · الوثيقة الموقَّعة Ed25519 والتحقق · الإلغاء والانتهاء · رسالة إلى نفسي (الختم · التسليم في موعدها فقط · أين كنت/أين صرت)
//                 · الخزنة (3 جداول · حذف) · MCP my_journey (قراءة فقط · wallet:read)
import test from 'node:test';
import assert from 'node:assert/strict';
import { JOURNEY_VERSION, SHARE_MONTHS, CAPSULE_DAYS, CAPSULE_MIN_CHARS, DAILY_MILESTONES, MAX_SHARE_CHAPTERS, buildChapters, buildJourney, selectPublic, displayName, validateShare, validateNote, validateCapsule, shareCode, addMonths, capsuleSnapshot, capsuleDeliveryText, journeySummary } from '../lib/journey/registry';
import type { JourneyInput } from '../lib/journey/registry';
import { buildJourneyDoc, createShare, revokeShare, publicShare, myShares } from '../lib/journey/share';
import { runJourney } from '../lib/journey/cron';
import { localIntro } from '../lib/journey/load';
import { REGISTRY, erasurePlan } from '../lib/vault/registry';
import { ALL_MCP_TOOLS, toolsFor } from '../lib/portal/mcp';
import { signerFromEnv, verifySignature, localResolver } from '../lib/portal/vc-server';
import { structuralChecks } from '../lib/portal/vc';

const K1 = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=';
const SITE = 'https://athar-portal.vercel.app'; const DID = 'did:web:athar-portal.vercel.app';
const NOW = new Date('2026-10-30T08:00:00Z').getTime(); const ago = (d: number) => new Date(NOW - d * 864e5).toISOString();
const ME = { id: '00000000-0000-4000-8000-000000000001', email: 'Admin@upm.edu.sa', name: 'أحمد محمد بدوي' };

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
        if (q._order) sel = [...sel].sort((a, b) => (a[q._order.c] < b[q._order.c] ? 1 : -1) * (q._order.asc ? -1 : 1));
        if (q._limit) sel = sel.slice(0, q._limit);
        return { data: q._single ? sel[0] || null : sel, count: sel.length, error: null };
      };
      q.select = () => q;
      for (const op of ['eq', 'ilike', 'lte', 'lt', 'gte', 'gt', 'neq']) q[op] = (c: string, v: any) => { q._f.push({ op, c, v }); return q; };
      q.in = (c: string, v: any[]) => { q._f.push({ op: 'in', c, v }); return q; }; q.is = (c: string, v: any) => { q._f.push({ op: 'is', c, v }); return q; }; q.not = (c: string, op: string) => { if (op === 'is') q._f.push({ op: 'not_is', c }); return q; }; q.or = (s: string) => { q._f.push({ op: 'or', v: s }); return q; };
      q.order = (c: string, o: any) => { q._order = { c, asc: !!o?.ascending }; return q; }; q.limit = (n: number) => { q._limit = n; return q; }; q.maybeSingle = () => { q._single = true; return q; }; q.single = q.maybeSingle;
      q.insert = (p: any) => { q._op = 'insert'; q._payload = p; return q; }; q.update = (p: any) => { q._op = 'update'; q._payload = p; return q; };
      q.then = (res: any, rej: any) => Promise.resolve(run()).then(res, rej);
      return q;
    },
  };
  return db;
}

/** رحلة ممارس من 200 يوم: قياس · 12 موقفًا يوميًا · محاكاة · مهمة مؤكدة · مجلس وقضية وعودة · شهادة قرين · مستويان معتمدان لمهارة واحدة · شهادة */
function seed(): JourneyInput {
  const daily = Array.from({ length: 12 }, (_, i) => ({ created_at: ago(180 - i * 7), response: i === 0 ? 'سأبدأ بسؤال الفريق عمّا يخشونه قبل أن أعرض الخطة، ثم أعرضها على مرحلتين.' : `ردّي رقم ${i + 1} بكلماتي عن الموقف.`, band: i === 0 ? 'developing' : 'proficient', score: 60 + i, case_title: i === 0 ? 'فريق يقاوم خطة جديدة' : `موقف ${i + 1}` }));
  return {
    events: [{ at: ago(200), verb: 'assessed', object_type: 'placement', object_id: 'p1', skills: [], context: { level: 2 } }, { at: ago(3), verb: 'issued', object_type: 'council_badge', object_id: 'b1', skills: [], context: { code: 'ATH-CB-AAAA-BBBB' } }],
    daily, sims: [{ id: 's1', created_at: ago(150), ended_at: ago(150), status: 'ended', score: { score: 71 } }, { id: 's0', created_at: ago(160), ended_at: null, status: 'open', score: null }],
    missions: [{ id: 'm1', title_ar: 'قيادة اجتماع مراجعة الأداء', confirmed_at: ago(120), submitted_at: ago(125), status: 'confirmed', skills: ['sk1'] }, { id: 'm2', title_ar: 'مهمة لم تؤكَّد', confirmed_at: null, submitted_at: ago(10), status: 'submitted', skills: [] }],
    memberships: [{ council_id: 'c1', council_title: 'مجلس قادة التغيير', joined_at: ago(90), status: 'active' }],
    cases: [{ id: 'd1', created_at: ago(80), title_ar: 'نائبي يتجاوزني إلى المدير', commitment_ar: 'سأجلس معه هذا الأسبوع وأسأله قبل أن أحكم.', committed_at: ago(78), return_ar: 'جلسنا. اتضح أنه لم يكن يعرف أن الأمر يزعجني. اتفقنا على قناة واحدة.', return_outcome: 'worked', returned_at: ago(64), theme: 'upward' }],
    attestations: [{ created_at: ago(60), decided_at: ago(58), status: 'approved', skill_id: 'sk1' }, { created_at: ago(5), decided_at: null, status: 'pending', skill_id: 'sk2' }],
    levels: [{ skill_id: 'sk1', approved_level: 3, approved_at: ago(100), computed_level: 3.2 }, { skill_id: 'sk1', approved_level: 4, approved_at: ago(20), computed_level: 4.1 }, { skill_id: 'sk2', approved_level: null, approved_at: null, computed_level: 2.5 }],
    credentials: [{ id: 'cr1', title_ar: 'قيادة التغيير — المستوى 3', kind: 'skill', issued_at: ago(95), verify_code: 'ATH-XXXX', level: '3' }],
    skills: { sk1: 'قيادة التغيير', sk2: 'التغذية الراجعة' },
  };
}

test('p25 chapters: derived from recorded events only, chronological, milestones, level from→to, no chapter without an event', () => {
  const chs = buildChapters(seed()); const keys = chs.map(c => c.key);
  assert.deepEqual(keys, ['placement_first', 'daily_first', 'sim_first', 'mission_first', 'daily_10', 'level_approved:sk1:3', 'credential:cr1', 'council_joined', 'case_first', 'return_first', 'attestation_first', 'level_approved:sk1:4', 'council_badge'], 'ترتيب زمني بالضبط — لا فصل بلا حدث (لا daily_30، لا مهمة غير مؤكدة، لا محاكاة مفتوحة، لا شهادة معلّقة، لا مستوى محسوب فقط)');
  for (let i = 1; i < chs.length; i++) assert.ok(chs[i - 1].at <= chs[i].at, 'ترتيب زمني');
  assert.equal(DAILY_MILESTONES[0], 10, 'أول معلم 10'); assert.equal(chs.find(c => c.key === 'daily_10')!.at, seed().daily[9].created_at, 'معلم العشرة عند الموقف العاشر');
  const lv = chs.filter(c => c.kind === 'level'); assert.equal(lv[0].level!.from, null, 'أول اعتماد بلا from'); assert.equal(lv[0].level!.to, 3); assert.equal(lv[1].level!.from, 3, 'الثاني from=3'); assert.equal(lv[1].level!.to, 4);
  assert.equal(chs.find(c => c.key === 'daily_first')!.quote_ar!.slice(0, 11), 'سأبدأ بسؤال', 'الاقتباس كلمات المستخدم نفسه');
  assert.equal(chs.find(c => c.key === 'attestation_first')!.quote_ar, null, 'كلمات القرين ليست كلماتي — لا اقتباس');
  assert.equal(chs.find(c => c.key === 'return_first')!.quote_ar!.startsWith('جلسنا.'), true, 'اقتباس العودة من نصّي');
  assert.ok(!JSON.stringify(chs).includes('@'), 'لا بريد في الفصول');
  const empty = buildChapters({ events: [], daily: [], sims: [], missions: [], memberships: [], cases: [], attestations: [], levels: [], credentials: [], skills: {} }); assert.equal(empty.length, 0, 'لا أحداث → لا فصول');
});

test('p25 journey: days/eras/counts/arc + summary for agents; local intro uses own words only', () => {
  const j = buildJourney(seed(), NOW); assert.equal(j.version, JOURNEY_VERSION); assert.equal(j.days, 200, '200 يومًا منذ أول فصل'); assert.equal(j.chapters.length, 13);
  assert.equal(j.counts.level, 2); assert.equal(j.counts.daily, 2); assert.equal(j.counts.council, 2); assert.equal(j.counts.return, 1);
  assert.equal(j.eras.reduce((n, e) => n + e.keys.length, 0), 13, 'كل فصل في حقبة'); assert.ok(j.eras.length >= 5, 'حقب شهرية متعددة');
  assert.ok(j.arc_ar.includes('13 فصلًا') && j.arc_ar.includes('مستويات اعتمدها بشر'), 'قوس السرد: ' + j.arc_ar);
  const s = journeySummary(j, [{ code: 'ATH-J-AAAA-BBBB', status: 'active', expires_at: ago(-100) }, { code: 'ATH-J-CCCC-DDDD', status: 'revoked', expires_at: ago(-100) }], [{ status: 'sealed', deliver_at: ago(-300) }]);
  assert.equal(s.chapters, 13); assert.equal(s.latest.length, 5); assert.equal(s.shares.length, 1, 'الفعّالة فقط'); assert.equal(s.capsules[0].status, 'sealed', 'الرسالة المختومة وموعدها');
  const intro = localIntro(j, ['سأبدأ بسؤال الفريق عمّا يخشونه قبل أن أعرض الخطة.']); assert.ok(intro.includes('بكلماتي يومها') && intro.includes('أول قياس'), 'مقدمة محلية من كلماتي: ' + intro);
  assert.equal(localIntro(buildJourney({ ...seed(), events: [], daily: [], sims: [], missions: [], memberships: [], cases: [], attestations: [], levels: [], credentials: [] }, NOW), []), 'رحلتي تبدأ اليوم.');
});

test('p25 selective disclosure: only chosen chapters, quotes optional, short name, validation', () => {
  const chs = buildChapters(seed());
  const pub = selectPublic(chs, ['daily_first', 'level_approved:sk1:4', 'nope'], true); assert.equal(pub.length, 2, 'المختار الموجود فقط'); assert.ok(pub[0].quote_ar, 'الاقتباس يظهر عند السماح'); assert.ok(!('ref' in pub[0]), 'لا مرجع داخلي في النسخة العامة');
  assert.equal(selectPublic(chs, ['daily_first'], false)[0].quote_ar, null, 'بلا اقتباسات عند الطلب');
  assert.equal(displayName('أحمد محمد بدوي', ME.email, 'short'), 'أحمد ب.', 'الاسم المختصر'); assert.equal(displayName('', 'reem@moe.gov.sa', 'full'), 'reem', 'بلا اسم → قبل @');
  assert.equal(validateShare({ chapter_keys: [] }, chs), 'اختر فصلًا واحدًا على الأقل لتنشره'); assert.equal(validateShare({ chapter_keys: ['x'] }, chs), 'فصل غير موجود في رحلتك'); assert.equal(validateShare({ chapter_keys: Array.from({ length: MAX_SHARE_CHAPTERS + 1 }, () => 'daily_first') }, chs), `أقصى ${MAX_SHARE_CHAPTERS} فصلًا في نسخة واحدة`);
  assert.equal(validateShare({ chapter_keys: ['daily_first'], name_mode: 'short' }, chs), null);
  assert.match(shareCode(() => 'AB12'), /^ATH-J-AB12-AB12$/, 'صيغة الرمز');
  assert.equal(validateNote({ chapter_key: 'daily_first', body_ar: 'تعلّمت أن أسأل أولًا.' }, chs), null); assert.ok(validateNote({ chapter_key: 'ghost', body_ar: 'x' }, chs), 'فصل غير موجود يُرفض'); assert.ok(validateNote({ chapter_key: 'daily_first', body_ar: '' }, chs), 'لا نص ولا تسجيل يُرفض');
  assert.ok(validateCapsule({ body_ar: 'قصير' }), `أقل من ${CAPSULE_MIN_CHARS} حرفًا يُرفض`); assert.equal(validateCapsule({ body_ar: '', media_id: 'm1' }), null, 'تسجيل يكفي');
});

test('p25 share: signed Ed25519 doc verifies, structural checks pass, public read by code counts views, revoke kills link + VC, expiry via cron', async () => {
  const signer = signerFromEnv({ VC_SIGNING_KEY: K1 } as any, SITE)!; assert.ok(signer, 'موقّع');
  const db = fakeDb({ portal_vc_issuances: [], portal_journey_shares: [], portal_learning_events: [] });
  const chs = buildChapters(seed()); const now = new Date(NOW);
  const r = await createShare(db, ME, chs, { chapter_keys: ['daily_first', 'return_first', 'level_approved:sk1:4'], name_mode: 'short', include_quotes: false, intro_ar: 'هذه رحلتي كما وقعت.' }, signer, SITE, DID, () => 'AB12', now);
  assert.ok(r.ok, 'إنشاء النسخة'); if (!r.ok) return;
  assert.equal(r.share.code, 'ATH-J-AB12-AB12'); assert.equal(r.share.display_name, 'أحمد ب.'); assert.equal(r.share.chapters.length, 3); assert.equal(r.share.chapters[0].quote_ar, null, 'بلا اقتباسات'); assert.equal(r.share.expires_at, addMonths(now, SHARE_MONTHS), `صلاحية ${SHARE_MONTHS} شهرًا`); assert.equal(r.signed_vc, true); assert.equal(r.url, `${SITE}/journey/ATH-J-AB12-AB12`);
  const iss = db.T.portal_vc_issuances[0]; assert.equal(iss.kind, 'journey'); assert.equal(iss.credential_id, null); assert.ok(iss.digest, 'بصمة');
  const vc = iss.vc; assert.deepEqual(vc.type, ['VerifiableCredential', 'OpenBadgeCredential']); assert.equal(vc._athar.kind, 'journey'); assert.equal(vc._athar.chapters.length, 3); assert.ok(vc.credentialStatus, 'سجل حالة'); assert.ok(!JSON.stringify(vc).includes(ME.email.toLowerCase()), 'لا بريد في الوثيقة');
  assert.ok(structuralChecks(vc, now).every(c => c.ok), 'الفحوص البنيوية: ' + JSON.stringify(structuralChecks(vc, now).filter(c => !c.ok)));
  const ver = await verifySignature(vc, localResolver(signer, [])); assert.equal(ver.ok, true, 'التوقيع يتحقق');
  const doc2 = buildJourneyDoc({ code: 'ATH-J-ZZZZ-ZZZZ', name: 'x', chapters: r.share.chapters, intro: null, site: SITE, did: DID, now, expires: r.share.expires_at, statusIndex: null }); assert.ok(!doc2.credentialStatus, 'بلا سجل حالة عند غياب الفهرس');
  const pub = await publicShare(db, 'ath-j-ab12-ab12', SITE, NOW); assert.ok(pub.ok, 'قراءة عامة'); if (!pub.ok) return;
  assert.equal(pub.journey.views, 1, 'مشاهدة واحدة'); assert.equal(pub.journey.verify_url, `${SITE}/verify/vc?code=ATH-J-AB12-AB12`); assert.equal(pub.journey.chapters.length, 3);
  assert.equal((await publicShare(db, 'ATH-J-NONE-NONE', SITE, NOW) as any).status, 404); assert.equal((await publicShare(db, 'bad', SITE, NOW) as any).status, 400);
  assert.equal((await myShares(db, ME)).length, 1);
  const rv = await revokeShare(db, ME, r.share.id, now); assert.equal(rv.ok, true, 'إلغاء'); assert.equal(db.T.portal_journey_shares[0].status, 'revoked'); assert.ok(iss.revoked_at, 'الوثيقة أُلغيت');
  assert.equal((await publicShare(db, 'ATH-J-AB12-AB12', SITE, NOW) as any).status, 410, 'الرابط مات'); assert.equal((await revokeShare(db, ME, r.share.id, now)).ok, false, 'لا إلغاء مرتين');
  assert.equal((await revokeShare(db, { id: 'someone-else' }, r.share.id, now)).ok, false, 'غير المالك لا يلغي');
  // الانتهاء بعد 12 شهرًا عبر الكرون
  const r2 = await createShare(db, ME, chs, { chapter_keys: ['daily_first'], name_mode: 'full', include_quotes: true, intro_ar: null }, signer, SITE, DID, () => 'CD34', now); assert.ok(r2.ok);
  const c1 = await runJourney(db, { site: SITE, now: new Date(NOW + 30 * 864e5) }); assert.equal(c1.expired, 0, 'لم تنتهِ بعد');
  const c2 = await runJourney(db, { site: SITE, now: new Date(addMonths(now, SHARE_MONTHS)) }); assert.equal(c2.expired, 1, 'انتهت'); assert.equal(db.T.portal_journey_shares[1].status, 'expired'); assert.ok(db.T.portal_vc_issuances[1].revoked_at, 'وثيقتها أُلغيت');
  assert.equal((await createShare(db, ME, chs, { chapter_keys: ['daily_first'], name_mode: 'full', include_quotes: true, intro_ar: null }, null, SITE, DID, () => 'EF56', now) as any).signed_vc, false, 'بلا مفتاح → نسخة بلا وثيقة (لا فشل)');
});

test('p25 time capsule: snapshot then/now, delivery text, cron delivers only when due (dry counts, no double delivery)', async () => {
  const j = buildJourney(seed(), NOW); const then = capsuleSnapshot(j); assert.equal(then.chapters, 13); assert.deepEqual(then.levels, [{ skill: 'قيادة التغيير', level: 4 }], 'آخر مستوى معتمد لكل مهارة'); assert.equal(then.last_chapter, 'شهادة عضو مجلس');
  const later = { chapters: 20, levels: [{ skill: 'قيادة التغيير', level: 5 }, { skill: 'التغذية الراجعة', level: 3 }], last_chapter: 'أول عودة', days: 565 };
  const t = capsuleDeliveryText('أحمد', then, later, ago(0)); assert.ok(t.includes('13 فصلًا') && t.includes('20 فصلًا') && t.includes('4 → 5') && t.includes('اعتُمد 3'), 'نص التسليم: ' + t);
  assert.equal(CAPSULE_DAYS, 365);
  const seedCap = { user_id: ME.id, email: ME.email.toLowerCase(), full_name: 'أحمد', body_ar: 'إلى نفسي بعد سنة: أرجو أن أكون قد تعلّمت أن أسأل قبل أن أحكم.', media_id: null, kind: 'text', deliver_at: ago(1), delivered_at: null, status: 'sealed', snapshot_then: then, snapshot_now: null, message_log_id: null, meta: {}, created_at: ago(364) };
  const db = fakeDb({ portal_time_capsules: [seedCap, { ...seedCap, deliver_at: ago(-200) }, { ...seedCap, deliver_at: ago(1), status: 'cancelled' }], portal_journey_shares: [], portal_learning_events: [], portal_daily_case_responses: [], portal_sim_runs: [], portal_missions: [], portal_council_members: [], portal_council_cases: [], portal_council_attestations: [], portal_skill_levels: [], portal_credentials: [], portal_message_log: [], portal_notification_prefs: [] });
  const dry = await runJourney(db, { dry: true, site: SITE, now: new Date(NOW) }); assert.equal(dry.delivered, 1, 'تجربة: واحدة فقط مستحقة (لا المستقبلية ولا الملغاة)'); assert.equal(db.T.portal_time_capsules[0].status, 'sealed', 'التجربة لا تغيّر شيئًا');
  const live = await runJourney(db, { site: SITE, now: new Date(NOW) }); assert.equal(live.delivered, 1, 'تسليم واحد'); assert.equal(live.errors.length, 0, 'بلا أخطاء: ' + live.errors.join(' | '));
  const c = db.T.portal_time_capsules[0]; assert.equal(c.status, 'delivered'); assert.ok(c.delivered_at); assert.equal(c.snapshot_now.chapters, 0, 'لقطة «أين صرت» تُحسب يوم التسليم من الرحلة الحية (فارغة في هذا المختبر)'); assert.ok(String(c.meta.delivery_text).includes('13 فصلًا'), 'نص التسليم يحفظ «أين كنت»');
  const again = await runJourney(db, { site: SITE, now: new Date(NOW) }); assert.equal(again.delivered, 0, 'لا تسليم مرتين');
  const late = await runJourney(db, { site: SITE, now: new Date(NOW + 300 * 864e5) }); assert.equal(late.delivered, 1, 'الثانية حين يحين موعدها');
});

test('p25 vault + MCP: 3 journey tables registered (delete on erasure, self access), my_journey is personal read-only with wallet:read', () => {
  const t = ['portal_journey_notes', 'portal_journey_shares', 'portal_time_capsules'].map(n => REGISTRY.find(r => r.table === n)!);
  assert.ok(t.every(Boolean), 'الجداول الثلاثة في سجل المعالجة'); assert.ok(t.every(r => r.policy === 'delete' && r.userCol === 'user_id' && r.emailCol === 'email' && r.basis === 'consent'), 'حذف عند النسيان · موافقة');
  assert.ok(t.every(r => r.access.includes('self')), 'الوصول لصاحبها'); assert.ok(t[2].access.length === 1, 'الرسالة لا يقرؤها أحد غيره'); assert.ok(t[1].access.includes('public'), 'النسخ المشتركة عامة بالرمز');
  assert.ok(erasurePlan().delete.some(x => x.table === 'portal_time_capsules'), 'ضمن خطة النسيان');
  const tool = ALL_MCP_TOOLS.find(x => x.name === 'my_journey')!; assert.ok(tool, 'الأداة موجودة'); assert.equal(tool.annotations.readOnlyHint, true); assert.equal(tool.annotations.destructiveHint, false); assert.equal((tool as any).pscope, 'wallet:read'); assert.deepEqual(tool.tiers, ['personal']);
  assert.ok(!toolsFor('anon').some(x => x.name === 'my_journey'), 'ليست للعامة'); assert.ok(toolsFor('personal', ['wallet:read']).some(x => x.name === 'my_journey'), 'في الطبقة الشخصية');
  assert.ok(tool.description.includes('قراءة فقط') && tool.description.includes('/me/journey'), 'الوصف يحيل الكتابة لصاحبها');
});
