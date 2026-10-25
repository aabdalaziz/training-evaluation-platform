// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P8-أ: احتساب مستويات المهارات من الأدلة، الشهادات الرقمية (Open Badges 3.0)، الرموز، المشاركة، Excel
import test from 'node:test';
import assert from 'node:assert/strict';
import { EVIDENCE_WEIGHT, cefrToLevel, percentToLevel, evidenceFromEvent, computeSkillLevels, displayLevel, levelName, confidenceLabel, randomCode, verifyCode, publicId, buildBadge, validateIssue, EMPTY_ISSUE, completionEligible, credentialStatus, credentialTitle, credentialKindLabel, SHARE_MODES, credentialsSheet, skillLevelsSheet } from '../lib/portal/profile';
import type { LearningEventRow, Credential } from '../lib/portal/profile';

const META = new Map([['s-listen', { level: 2, code: 'ATH-AR-004' }], ['s-read', { level: 2, code: 'ATH-AR-005' }], ['s-design', { level: 3, code: 'ATH-PD-001' }]]);
const E = (o: Partial<LearningEventRow>): LearningEventRow => ({ at: '2026-11-01T00:00:00Z', verb: 'viewed', object_type: 'resource', object_id: 'x', skills: [], ...o });

test('profile: level mappings', () => {
  assert.equal(cefrToLevel('A1'), 1); assert.equal(cefrToLevel('B2'), 4); assert.equal(cefrToLevel('C2'), 5); assert.equal(cefrToLevel('zz'), null);
  assert.equal(percentToLevel(90, 3), 4); assert.equal(percentToLevel(70, 3), 3); assert.equal(percentToLevel(45, 3), 2); assert.equal(percentToLevel(10, 3), 1); assert.equal(percentToLevel(95, 5), 5);
  assert.equal(EVIDENCE_WEIGHT.placement, 1); assert.ok(EVIDENCE_WEIGHT.viewed < EVIDENCE_WEIGHT.attended && EVIDENCE_WEIGHT.attended < EVIDENCE_WEIGHT.activity);
  assert.equal(levelName(4, 'ar'), 'متقدم'); assert.equal(levelName(9, 'en'), 'Expert'); assert.equal(confidenceLabel(80, 'ar'), 'أدلة قوية'); assert.equal(confidenceLabel(10, 'en'), 'Early evidence');
});

test('profile: evidence extraction per event type', () => {
  const pl = evidenceFromEvent(E({ verb: 'assessed', object_type: 'placement', skills: ['s-listen', 's-read'], context: { level: 'B2', skills: { listening: { level: 'B1', percent: 60 }, reading: { level: 'B2', percent: 65 } } } }), META);
  assert.equal(pl.length, 2); assert.equal(pl[0].e.kind, 'placement'); assert.equal(pl[0].e.level, 3, 'listening B1 → 3'); assert.equal(pl[1].e.level, 4, 'reading B2 → 4'); assert.equal(pl[0].e.label, 'B1 · 60%');
  const act = evidenceFromEvent(E({ verb: 'assessed', object_type: 'activity', skills: ['s-design'], context: { score: 100, kind: 'mcq' } }), META); assert.equal(act[0].e.kind, 'activity'); assert.equal(act[0].e.level, 4);
  const self = evidenceFromEvent(E({ verb: 'assessed', object_type: 'activity', skills: ['s-design'], context: { score: 80, kind: 'self_rating' } }), META); assert.equal(self[0].e.level, 4);
  const done = evidenceFromEvent(E({ verb: 'completed', object_type: 'program', skills: ['s-design'], context: {} }), META); assert.equal(done[0].e.kind, 'program_completed'); assert.equal(done[0].e.level, 3);
  const cred = evidenceFromEvent(E({ verb: 'issued', object_type: 'credential', skills: ['s-listen'], context: { level: 'C1', title: 'x' } }), META); assert.equal(cred[0].e.kind, 'credential'); assert.equal(cred[0].e.level, 5);
  const join = evidenceFromEvent(E({ verb: 'joined', object_type: 'session', skills: ['s-design'] }), META); assert.equal(join[0].e.kind, 'attended');
  const view = evidenceFromEvent(E({ verb: 'downloaded', object_type: 'resource_file', skills: ['s-design'] }), META); assert.equal(view[0].e.kind, 'viewed'); assert.equal(view[0].e.level, 2);
  assert.equal(evidenceFromEvent(E({ verb: 'placed', object_type: 'classroom', skills: ['s-design'] }), META).length, 0, 'placement in a section is not skill evidence');
  assert.equal(evidenceFromEvent(E({ verb: 'viewed', skills: [] }), META).length, 0);
});

test('profile: computed levels = weighted mean, confidence capped, dedup per object, recency decay', () => {
  const now = new Date('2026-11-10T00:00:00Z');
  const events = [
    E({ verb: 'assessed', object_type: 'placement', object_id: 'p1', skills: ['s-listen'], context: { level: 'B1', skills: { listening: { level: 'B1', percent: 60 } } }, at: '2026-11-01T00:00:00Z' }),
    E({ verb: 'downloaded', object_type: 'resource_file', object_id: 'f1', skills: ['s-listen'], at: '2026-11-02T00:00:00Z' }),
    E({ verb: 'downloaded', object_type: 'resource_file', object_id: 'f1', skills: ['s-listen'], at: '2026-11-03T00:00:00Z' }), // مكرر → مرة واحدة
    E({ verb: 'assessed', object_type: 'activity', object_id: 'a1', skills: ['s-design'], context: { score: 100, kind: 'mcq' }, at: '2024-01-01T00:00:00Z' }), // قديم → وزن 0.6
  ];
  const rows = computeSkillLevels('u1', events, META, now);
  const listen = rows.find(r => r.skill_id === 's-listen')!; assert.equal(listen.evidence.length, 2); assert.equal(listen.computed_level, Math.round(((3 * 1) + (1 * 0.1)) / 1.1 * 100) / 100); assert.equal(listen.confidence, Math.min(100, Math.round(1.1 * 25)));
  const design = rows.find(r => r.skill_id === 's-design')!; assert.equal(design.computed_level, 4); assert.equal(design.confidence, Math.round(0.4 * 0.6 * 25));
  assert.equal(rows[0].skill_id, 's-design', 'sorted by level desc');
  assert.equal(displayLevel({ computed_level: 2.6, approved_level: null }), 3); assert.equal(displayLevel({ computed_level: 2.6, approved_level: 5 }), 5);
  assert.deepEqual(computeSkillLevels('u1', [], META, now), []);
});

test('profile: codes + badge + issue validation', () => {
  let i = 0; const rnd = () => ((i++ * 7) % 32) / 32;
  assert.equal(randomCode(4, rnd).length, 4); assert.match(verifyCode(), /^ATH-[A-Z2-9]{4}-[A-Z2-9]{4}$/); assert.match(publicId(), /^[a-z2-9]{8}$/); assert.ok(!verifyCode().includes('O') && !verifyCode().includes('0'), 'no ambiguous chars');
  const cred: Omit<Credential, 'badge'> = { id: 'c1', email: 'sara@example.com', full_name: 'سارة', kind: 'program_completion', title_ar: 'إتمام دبلوم', title_en: 'Diploma completion', skills: ['s1'], level: 'B2', hours: 120, verify_code: 'ATH-ABCD-EFGH', issued_at: '2026-11-10T00:00:00Z', valid_until: null };
  const b = buildBadge(cred, [{ id: 's1', code: 'ATH-PD-001', name_ar: 'تصميم', name_en: 'Design', saqf_level: 5, cefr_level: null, sdaia_code: null }], 'https://athar-portal.vercel.app') as any;
  assert.deepEqual(b.type, ['VerifiableCredential', 'OpenBadgeCredential']); assert.equal(b.id, 'https://athar-portal.vercel.app/credential/ATH-ABCD-EFGH'); assert.equal(b.credentialSubject.achievement.achievementType, 'Certificate'); assert.equal(b.credentialSubject.achievement.alignment[0].targetFramework, 'SAQF level 5'); assert.equal(b.credentialSubject.creditsEarned, 120); assert.equal(b.validFrom, cred.issued_at); assert.ok(!('validUntil' in b));
  assert.equal(validateIssue({ ...EMPTY_ISSUE }, 1), 'عنوان الشهادة مطلوب'); assert.equal(validateIssue({ ...EMPTY_ISSUE, title_ar: 'شهادة إتمام' }, 1), 'اختر البرنامج'); assert.equal(validateIssue({ ...EMPTY_ISSUE, kind: 'skill', title_ar: 'إثبات مهارة' }, 1), 'اختر مهارة واحدة على الأقل'); assert.equal(validateIssue({ ...EMPTY_ISSUE, kind: 'attendance', title_ar: 'حضور ندوة' }, 0), 'لا مستلمين'); assert.equal(validateIssue({ ...EMPTY_ISSUE, kind: 'attendance', title_ar: 'حضور ندوة', valid_years: '20' }, 1), 'الصلاحية بين 1 و10 سنوات'); assert.equal(validateIssue({ ...EMPTY_ISSUE, kind: 'attendance', title_ar: 'حضور ندوة' }, 3), null);
  assert.equal(completionEligible({ sessions: 10, present: 8 }), true); assert.equal(completionEligible({ sessions: 10, present: 7 }), false); assert.equal(completionEligible({ sessions: 0, present: 0 }), true);
  const c2 = { ...cred, id: 'x', badge: {} } as Credential; assert.equal(credentialStatus(c2), 'valid'); assert.equal(credentialStatus({ ...c2, revoked_at: '2026-11-11T00:00:00Z' }), 'revoked'); assert.equal(credentialStatus({ ...c2, valid_until: '2020-01-01T00:00:00Z' }), 'expired');
  assert.equal(credentialTitle(c2, 'en'), 'Diploma completion'); assert.equal(credentialKindLabel('skill', 'ar'), 'إثبات مهارة'); assert.equal(SHARE_MODES.length, 3); assert.equal(SHARE_MODES[0].value, 'private');
  const sh = credentialsSheet([c2], new Map()); assert.equal(sh.rows[1][8], 'ATH-ABCD-EFGH'); assert.equal(sh.rows[1][9], 'سارية');
  const sl = skillLevelsSheet([{ user_id: 'u', skill_id: 's', computed_level: 3.2, confidence: 50, evidence: [], approved_level: 4, email: 'a@b.co', skill: { code: 'ATH-PD-001', name_ar: 'تصميم', domain: 'pedagogy' } }]); assert.equal(sl.rows[1][6], 4);
});
