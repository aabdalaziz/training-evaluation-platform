// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P38 — «الشهادة التي تكبر» (متابعة أثر التدريب): المحطات ونوافذها · الكتابة داخل النافذة فقط · التنقية والحالات بالكلمات ·
//                 الشاهد (لا يشهد المرء لنفسه · الدعوة ببريدها) · الوثيقة (محطتان عند السنة) · «ما قاله من تدرّب هنا» من 5 بشرائح لا نسب · سطر الجهة · الخزنة · MCP · لا كرون جديد
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  P38_NAMES_AR, STATIONS, STATES, STATE_AR, WINDOW_DAYS, TEXT_MIN, AFTER_K, DOC_MIN_WRITTEN, addDays, stationWindow, stationPhase, canWrite, cleanStation,
  canInviteWitness, canAnswerWitness, docEligible, afterCode, bandAr, programAfter, orgAfterLine, afterFactLine, summaryPrompt, parseSummary, localSummary,
} from '../lib/after/registry';
import type { StationRow } from '../lib/after/registry';
import { REGISTRY } from '../lib/vault/registry';
import { NATIVE_TOOLS } from '../lib/portal/mcp';
import { EMPTY_WITNESS, witnessLines } from '../lib/directory/registry';

const ROW = (o: Partial<StationRow>): StationRow => ({ id: 1, enrollment_id: 'e1', program_id: 'p1', user_id: 'u1', email: 'a@x.sa', station: 90, state: 'applied', text_ar: 'ن'.repeat(50), may_publish: false, shown_on_credential: false, witness_email: null, witness_user_id: null, witness_status: null, witness_text: null, witness_at: null, notified_at: null, written_at: '2026-10-30T10:00:00Z', published_at: null, published_by: null, ...o });

test('الأسماء والثوابت: الشهادة التي تكبر · متابعة أثر التدريب · 30/90/365 · ±14 · من 40 حرفًا · k=5 · محطتان للوثيقة', () => {
  assert.equal(P38_NAMES_AR.phase, 'الشهادة التي تكبر'); assert.equal(P38_NAMES_AR.official, 'متابعة أثر التدريب'); assert.equal(P38_NAMES_AR.doc, 'أثر بعد');
  assert.deepEqual([...STATIONS], [30, 90, 365]); assert.equal(WINDOW_DAYS, 14); assert.equal(TEXT_MIN, 40); assert.equal(AFTER_K, 5); assert.equal(DOC_MIN_WRITTEN, 2);
  assert.deepEqual([...STATES], ['applied', 'partly', 'no_chance', 'not_useful']); assert.equal(STATE_AR.not_useful, 'لم ينفعني');
  assert.ok(/^ATH-AF-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(afterCode(() => 'ab12cd34')), 'رمز الوثيقة');
});

test('المحطات: النافذة ±14 · الحال (لم تحن · مفتوحة · فاتت · كُتبت) · لا كتابة خارج النافذة ولا تعديل بعدها', () => {
  const end = '2026-07-30'; const w90 = stationWindow(end, 90); assert.deepEqual(w90, { due: '2026-10-28', opens: '2026-10-14', closes: '2026-11-11' });
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  const at = (d: string) => new Date(`${d}T12:00:00Z`);
  assert.equal(stationPhase(end, 90, null, at('2026-10-13')), 'future'); assert.equal(stationPhase(end, 90, null, at('2026-10-14')), 'open'); assert.equal(stationPhase(end, 90, null, at('2026-11-11')), 'open'); assert.equal(stationPhase(end, 90, null, at('2026-11-12')), 'missed');
  assert.equal(stationPhase(end, 30, null, at('2026-11-01')), 'missed'); assert.equal(stationPhase(end, 365, null, at('2026-11-01')), 'future'); assert.equal(stationPhase(end, 30, { written_at: '2026-08-29T00:00:00Z' }, at('2026-11-01')), 'written');
  assert.ok(canWrite(end, 90, null, at('2026-11-01')).ok); assert.ok(!canWrite(end, 30, null, at('2026-11-01')).ok, 'فاتت'); assert.ok(!canWrite(end, 365, null, at('2026-11-01')).ok, 'لم تحن');
  assert.ok(!canWrite(end, 90, { written_at: '2026-10-20T00:00:00Z' }, at('2026-11-01')).ok, 'لا تُعدَّل');
});

test('التنقية: محطة معروفة · حالة بالكلمات · 40 حرفًا · البريد والأرقام تُحجب · إذن النشر اختياري', () => {
  assert.ok(!cleanStation({ station: 60, state: 'applied', text_ar: 'ن'.repeat(50) }).ok); assert.ok(!cleanStation({ station: 90, state: 'great', text_ar: 'ن'.repeat(50) }).ok); assert.ok(!cleanStation({ station: 90, state: 'applied', text_ar: 'قصير' }).ok);
  const c = cleanStation({ station: 90, state: 'not_useful', text_ar: `${'ن'.repeat(45)} راسلني على x@y.sa أو 0551234567`, may_publish: 'yes' }); assert.ok(c.ok); if (c.ok) { assert.ok(c.s.text_ar.includes('[بريد]') && c.s.text_ar.includes('[رقم]')); assert.equal(c.s.may_publish, true); assert.equal(c.s.state, 'not_useful'); }
});

test('الشاهد: بعد الكتابة · ببريد · لا يشهد المرء لنفسه · لا يُبدَّل بعد التوقيع · الإجابة لصاحب البريد وحده', () => {
  assert.ok(!canInviteWitness(ROW({ written_at: null }), 'm@x.sa').ok); assert.ok(!canInviteWitness(ROW({}), 'a@x.sa').ok, 'لنفسه'); assert.ok(!canInviteWitness(ROW({}), 'ليس بريدًا').ok);
  assert.ok(canInviteWitness(ROW({}), 'Mgr@X.sa').ok); assert.ok(!canInviteWitness(ROW({ witness_status: 'signed' }), 'm@x.sa').ok); assert.ok(canInviteWitness(ROW({ witness_status: 'declined' }), 'm2@x.sa').ok, 'بعد الاعتذار يُدعى غيره');
  assert.ok(canAnswerWitness(ROW({ witness_email: 'm@x.sa', witness_status: 'invited' }), 'M@x.sa').ok); assert.ok(!canAnswerWitness(ROW({ witness_email: 'm@x.sa', witness_status: 'invited' }), 'z@x.sa').ok); assert.ok(!canAnswerWitness(ROW({ witness_email: 'm@x.sa', witness_status: 'signed' }), 'm@x.sa').ok);
});

test('الوثيقة ATH-AF: عند محطة السنة (نافذتها) إن كُتبت محطتان فأكثر', () => {
  const end = '2025-11-05'; const at = (d: string) => new Date(`${d}T12:00:00Z`);
  assert.ok(!docEligible(end, [ROW({ station: 30 }), ROW({ station: 90 })], at('2026-10-21')).ok, 'قبل النافذة');
  assert.ok(docEligible(end, [ROW({ station: 30 }), ROW({ station: 90 })], at('2026-10-22')).ok, 'نافذة السنة تُفتح 22 أكتوبر');
  assert.ok(!docEligible(end, [ROW({ station: 90 })], at('2026-11-01')).ok, 'محطة واحدة لا تكفي');
  assert.ok(docEligible(end, [ROW({ station: 90 }), ROW({ station: 365 })], at('2026-11-20')).ok);
});

test('«ما قاله من تدرّب هنا»: من 5 متدرّبين مختلفين كتبوا محطة الـ90 · شرائح بالكلمات لا نسب · الاقتباسات ما اعتمده إنسان من بين ما أذن أصحابه · حتى 3', () => {
  assert.equal(bandAr(0, 10), 'لا أحد'); assert.equal(bandAr(8, 10), 'أكثرهم'); assert.equal(bandAr(5, 10), 'نحو النصف أو أكثر'); assert.equal(bandAr(3, 10), 'قرابة الربع إلى النصف'); assert.equal(bandAr(1, 10), 'قلّة');
  const four = [1, 2, 3, 4].map(i => ROW({ id: i, user_id: `u${i}`, email: `u${i}@x.sa` })); const a4 = programAfter(four); assert.equal(a4.shown, false); assert.equal(a4.n, 4); assert.ok(a4.states.every(s => s.n === 0), 'لا أعداد تحت 5'); assert.ok(a4.line_ar.includes('5'));
  const five = [...four, ROW({ id: 5, user_id: 'u5', email: 'u5@x.sa', state: 'not_useful', may_publish: true, published_at: '2026-11-01T00:00:00Z' }), ROW({ id: 6, user_id: 'u1', station: 30, may_publish: true, published_at: null }), ROW({ id: 7, user_id: 'u2', station: 30, may_publish: false, published_at: '2026-11-01T00:00:00Z' })];
  const a5 = programAfter(five); assert.equal(a5.shown, true); assert.equal(a5.n, 5, 'محطة الـ30 لا تُعدّ ضمن الخمسة'); assert.equal(a5.states.find(s => s.key === 'applied')!.n, 4); assert.equal(a5.states.find(s => s.key === 'not_useful')!.band_ar, 'قلّة');
  assert.equal(a5.excerpts.length, 1, 'اعتمده إنسان + أذن صاحبه فقط'); assert.equal(a5.excerpts[0].state, 'not_useful'); assert.ok(!/%|٪/.test(a5.line_ar), 'لا نسب مئوية'); assert.ok(a5.line_ar.includes('لم ينفعهم'));
  const many = [1, 2, 3, 4, 5].map(i => ROW({ id: 10 + i, user_id: `w${i}`, email: `w${i}@x.sa`, may_publish: true, published_at: `2026-11-0${i}T00:00:00Z` })); assert.equal(programAfter(many).excerpts.length, 3, 'حتى ثلاثة');
});

test('سطر الجهة من 5 · سطر «ما شهده أَثَر» · مسودّة الميسِّر (JSON ثلاثي · محلي بلا مفتاح · لا أسماء في النظام)', () => {
  assert.equal(orgAfterLine([ROW({ user_id: 'a' }), ROW({ user_id: 'b' })]).shown, false);
  const o = orgAfterLine([1, 2, 3, 4, 5].map(i => ROW({ id: i, user_id: `u${i}`, state: i <= 4 ? 'applied' : 'no_chance' }))); assert.equal(o.shown, true); assert.ok(o.line_ar!.includes('5 من منسوبيكم') && o.line_ar!.includes('أكثرهم'));
  assert.equal(afterFactLine([]), null); assert.equal(afterFactLine([ROW({}), ROW({ station: 30, witness_status: 'signed' })]), 'كتب 2 محطتين بعد برامجه وشهد على 1 منها مشرف');
  assert.equal(witnessLines({ ...EMPTY_WITNESS, after_line: 'كتب 2 محطتين بعد برامجه' }).find(l => l.key === 'after')?.text, 'كتب 2 محطتين بعد برامجه');
  const input = { program_ar: 'ب', texts: [{ station: 90 as const, state: 'applied' as const, text: 'طبّقت' }, { station: 90 as const, state: 'no_chance' as const, text: 'لم تسنح' }] };
  const p = summaryPrompt(input); assert.ok(p.system.includes('لا تذكر أسماء') && p.user.includes('بعد ثلاثة أشهر · طبّقته'));
  assert.equal(parseSummary({ kept_ar: [] }), null); assert.deepEqual(parseSummary({ kept_ar: ['أ', '', 'ب', 'ج', 'د'], gaps_ar: 'x', next_ar: ['ن'] }), { kept_ar: ['أ', 'ب', 'ج'], gaps_ar: [], next_ar: ['ن'] });
  const l = localSummary(input); assert.deepEqual(l.kept_ar, ['طبّقت']); assert.deepEqual(l.gaps_ar, ['لم تسنح']); assert.equal(l.next_ar.length, 3);
});

test('خزنة أَثَر: المحطات شخصية (تجهيل، self+staff+public) · MCP program_after عامّ للقراءة · لا كرون جديد (داخل كرون الرحلة) · SQL · بلا حزم', () => {
  const r = REGISTRY.find(x => x.table === 'portal_after_stations'); assert.ok(r && r.policy === 'anonymize' && r.access.includes('self') && r.access.includes('public') && r.piiCols.includes('witness_email') && r.userCol === 'user_id' && r.emailCol === 'email', 'الخزنة');
  const t = NATIVE_TOOLS.find(x => x.name === 'program_after'); assert.ok(t && t.tiers.includes('anon') && t.annotations.readOnlyHint && !t.annotations.destructiveHint && (t.inputSchema as any).required.includes('program_id'), 'MCP');
  const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8')); assert.ok(!(vercel.crons || []).some((c: any) => /p38|after|station/.test(String(c.path))), 'لا كرون جديد');
  const cron = fs.readFileSync('lib/journey/cron.ts', 'utf8'); assert.ok(cron.includes('openStations'), 'فتح المحطات داخل كرون الرحلة القائم');
  const sql = fs.readFileSync('supabase/migrations/20261216_portal_p38_after.sql', 'utf8'); assert.ok(sql.includes('portal_after_stations') && sql.includes("station in (30, 90, 365)") && sql.includes('not_useful') && sql.includes('shown_on_credential') && sql.includes('unique (enrollment_id, station)'));
  const srv = fs.readFileSync('lib/portal/mcp-server.ts', 'utf8'); assert.ok(srv.indexOf("name === 'program_after'") < srv.indexOf("if (c.actor.tier !== 'personal') return toolContent("), 'تُخدم قبل بوابة المستوى الشخصي');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); assert.ok(!Object.keys(pkg.dependencies || {}).some(d => /survey|form|chart/.test(d)), 'بلا حزم جديدة');
});
