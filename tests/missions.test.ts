// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات مهمات في قلب العمل (P12-أ): الجدولة، جاهزية الدليل، الفاحص المحلي، تحليل الذكاء الاصطناعي، حدث التعلم ووزنه، الإحصاءات، القوالب
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionToken, dueAt, daysLeft, urgency, scheduleWindow, evidenceReady, localCheck, parseAiCheck, missionEvent, transferStats, starterFor, parseSuggest, validateTemplate, templatePayload, publicMission, keywords, supervisorShareText, waShare, missionMailHtml, EMPTY_TEMPLATE } from '../lib/portal/missions';
import type { Mission } from '../lib/portal/missions';
import { evidenceFromEvent, MISSION_CONFIRMED_WEIGHT, EVIDENCE_WEIGHT } from '../lib/portal/profile';

const NOW = new Date('2026-12-10T08:00:00Z');
const base: Mission = { id: 'm1', email: 'a@b.sa', full_name: 'أحمد', skills: ['s1'], title_ar: 'خطة درس تُظهر التعلم النشط', brief_ar: 'صوّر خطة درسك…', evidence_mode: 'text', rubric: [{ c: 'تحديد موضع الاستراتيجية في الخطة', w: 2 }, { c: 'تبرير الاختيار بسلوك المتعلمين', w: 2 }, { c: 'وصف ملاحظة فعلية من التطبيق', w: 1 }], token: 'T'.repeat(24), confirm_token: 'C'.repeat(24), status: 'assigned', due_at: '2026-12-17T08:00:00Z', reminders: 0, created_at: '2026-12-10T08:00:00Z' };

test('missions: token/due/urgency', () => {
  const tk = missionToken(); assert.equal(tk.length, 24); assert.match(tk, /^[A-Z0-9]+$/);
  assert.equal(dueAt('2026-12-10T08:00:00Z', 7), '2026-12-17T08:00:00.000Z');
  assert.equal(daysLeft('2026-12-17T08:00:00Z', NOW), 7); assert.equal(urgency('2026-12-11T08:00:00Z', NOW), 'soon'); assert.equal(urgency('2026-12-01T08:00:00Z', NOW), 'late'); assert.equal(urgency('2026-12-30T08:00:00Z', NOW), 'ok');
});
test('missions: schedule window after completion', () => {
  const tpl = { days_after: 7 };
  assert.equal(scheduleWindow(tpl, '2026-12-08T00:00:00Z', NOW), 'wait');
  assert.equal(scheduleWindow(tpl, '2026-11-20T00:00:00Z', NOW), 'send');
  assert.equal(scheduleWindow(tpl, '2026-08-01T00:00:00Z', NOW), 'missed');
});
test('missions: evidence readiness per mode', () => {
  assert.ok(evidenceReady('text', { text: 'قصير' })); assert.equal(evidenceReady('text', { text: Array(85).fill('كلمة').join(' ') }), null);
  assert.ok(evidenceReady('photo', { caption: Array(30).fill('كلمة').join(' ') })); assert.equal(evidenceReady('photo', { file_path: 'm1/x.jpg', caption: Array(25).fill('كلمة').join(' ') }), null);
  assert.ok(evidenceReady('audio', { file_path: 'm1/v.webm', duration_s: 10 })); assert.equal(evidenceReady('audio', { file_path: 'm1/v.webm', duration_s: 45 }), null);
  assert.ok(evidenceReady('link', { link: 'ftp://x' })); assert.equal(evidenceReady('link', { link: 'https://docs.x/y', text: Array(16).fill('كلمة').join(' ') }), null);
});
test('missions: local checker rewards rubric coverage and penalizes generic text', () => {
  const good = localCheck(base, { text: 'في خطة الدرس حددت موضع استراتيجية التعلم التعاوني في نشاط المجموعات، واخترتها لأن سلوك المتعلمين في الحصة السابقة أظهر تشتتًا، ولاحظت عند التطبيق أن المشاركة ارتفعت بوضوح.' });
  const weak = localCheck(base, { text: 'استفدت كثيرًا من البرنامج وسأطبق ما تعلمته قريبًا إن شاء الله.' });
  assert.ok(good.score > weak.score, `${good.score} > ${weak.score}`); assert.equal(good.criteria.length, 3); assert.equal(good.source, 'local'); assert.ok(good.questions_ar.length >= 1);
  assert.ok(keywords('تحديد موضع الاستراتيجية في الخطة').includes('موضع'));
  const audio = localCheck({ ...base, evidence_mode: 'audio' }, { file_path: 'm1/v.webm', duration_s: 60 }); assert.ok(audio.score >= 60, 'full-length audio gets a baseline for the supervisor to judge');
});
test('missions: AI check parse aligns to rubric and clamps', () => {
  const raw = 'نص {"score":"88","criteria":[{"c":"تحديد موضع الاستراتيجية في الخطة","met":"yes","note":"واضح"},{"c":"غير مطابق","met":"no"}],"feedback_ar":"جيد","questions_ar":["هل رأيت الخطة؟"]}';
  const r = parseAiCheck(raw, base.rubric)!; assert.equal(r.score, 88); assert.equal(r.criteria.length, 3); assert.equal(r.criteria[0].met, 'yes'); assert.equal(r.criteria[1].met, 'no'); assert.equal(r.criteria[2].met, 'partly'); assert.equal(r.questions_ar.length, 1);
  assert.equal(parseAiCheck('لا json', base.rubric), null);
});
test('missions: learning event → evidence weight rises only after human confirmation', () => {
  const meta = new Map([['s1', { level: 3, code: 'ATH-PD-001' }]]);
  const ev = missionEvent(base, 82, false); assert.equal(ev.object_type, 'mission'); assert.equal(ev.context.confirmed, false);
  const e1 = evidenceFromEvent({ at: '2026-12-10T09:00:00Z', verb: 'assessed', object_type: 'mission', object_id: 'm1', skills: ['s1'], context: { score: 82, title: 'x', confirmed: false } } as any, meta);
  assert.equal(e1[0].e.kind, 'mission'); assert.equal(e1[0].e.weight, EVIDENCE_WEIGHT.mission); assert.equal(e1[0].e.level, 3);
  const e2 = evidenceFromEvent({ at: '2026-12-10T09:00:00Z', verb: 'assessed', object_type: 'mission', object_id: 'm1', skills: ['s1'], context: { score: 90, title: 'x', confirmed: true } } as any, meta);
  assert.equal(e2[0].e.weight, MISSION_CONFIRMED_WEIGHT); assert.equal(e2[0].e.level, 4); assert.ok(String(e2[0].e.label || '').endsWith('✓'));
  const e3 = evidenceFromEvent({ at: '2026-12-10T09:00:00Z', verb: 'assessed', object_type: 'mission', object_id: 'm1', skills: ['s1'], context: { score: 90, returned: true } } as any, meta); assert.equal(e3.length, 0, 'returned missions do not count');
  assert.ok(MISSION_CONFIRMED_WEIGHT < EVIDENCE_WEIGHT.placement && MISSION_CONFIRMED_WEIGHT > EVIDENCE_WEIGHT.program_completed);
});
test('missions: transfer stats', () => {
  const rows: any[] = [
    { status: 'confirmed', program_id: 'p1', created_at: '2026-12-01T00:00:00Z', submitted_at: '2026-12-03T00:00:00Z', ai: { score: 80 } },
    { status: 'submitted', program_id: 'p1', created_at: '2026-12-01T00:00:00Z', submitted_at: '2026-12-05T00:00:00Z', ai: { score: 60 } },
    { status: 'assigned', program_id: 'p2', created_at: '2026-12-08T00:00:00Z', submitted_at: null, ai: null },
    { status: 'expired', program_id: null, created_at: '2026-11-01T00:00:00Z', submitted_at: null, ai: null },
  ];
  const s = transferStats(rows); assert.equal(s.total, 4); assert.equal(s.confirm_rate, 25); assert.equal(s.response_rate, 50); assert.equal(s.avg_score, 70); assert.equal(s.median_days, 4); assert.equal(s.by_program[0].program_id, 'p1'); assert.equal(s.by_program[0].confirmed, 1);
});
test('missions: starter templates + AI suggestion parse + template validation', () => {
  const st = starterFor(['pedagogy', 'arabic']); assert.ok(st.length >= 3 && st.length <= 4); assert.ok(st.every(x => x.rubric.length >= 2 && x.brief_ar.length > 30));
  assert.ok(starterFor(['unknown']).length === 0); assert.ok(starterFor([]).length >= 1);
  const parsed = parseSuggest('{"templates":[{"title_ar":"مهمة","brief_ar":"' + 'تعليمات دقيقة '.repeat(5) + '","evidence_mode":"photo","rubric":[{"c":"أ","w":5},{"c":"ب","w":0}],"days_after":99,"due_days":1}]}')!;
  assert.equal(parsed.length, 1); assert.equal(parsed[0].rubric[0].w, 3); assert.equal(parsed[0].rubric[1].w, 1); assert.equal(parsed[0].days_after, 60); assert.equal(parsed[0].due_days, 3);
  assert.ok(validateTemplate(EMPTY_TEMPLATE)); const f = { ...EMPTY_TEMPLATE, title_ar: 'خطة درس تُظهر التعلم النشط', brief_ar: 'صوّر خطة درسك لهذا الأسبوع وأشِر إلى موضع الاستراتيجية', skills: ['s1'], rubric: [{ c: 'أ', w: 2 }, { c: 'ب', w: 1 }, { c: '', w: 1 }] };
  assert.equal(validateTemplate(f), null); const p = templatePayload(f); assert.equal(p.rubric.length, 2); assert.equal(p.program_id, null); assert.equal(p.days_after, 7);
});
test('missions: public view strips secrets; share text and mail contain the link', () => {
  const pub = publicMission({ ...base, supervisor_email: 'sup@x.sa' }) as any; assert.equal(pub.confirm_token, undefined); assert.equal(pub.supervisor_email, undefined); assert.equal(pub.token, base.token);
  const txt = supervisorShareText(base, 'https://athar-portal.vercel.app/m/confirm/CCC'); assert.ok(txt.includes('/m/confirm/CCC')); assert.ok(waShare(txt).startsWith('https://wa.me/?text='));
  const mail = missionMailHtml(base, 'https://athar-portal.vercel.app/m/TTT', 'برنامج'); assert.ok(mail.html.includes('/m/TTT')); assert.ok(mail.html.includes('تحديد موضع الاستراتيجية')); assert.ok(mail.subject.includes(base.title_ar));
});
