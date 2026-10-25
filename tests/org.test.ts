// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P8-ب: تحليل قوائم البريد، التحقق، مؤشرات لوحة الأثر، صفوف الأعضاء، Excel
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePeople, inDomain, validateBulk, orgKpis, topSkills, memberRows, memberStatusLabel, memberRoleLabel, reqStatusLabel, orgMembersSheet, orgSkillsSheet } from '../lib/portal/org';
import type { Dashboard } from '../lib/portal/org';

const D: Dashboard = { ok: true, org: { id: 'o1', name_ar: 'وزارة التعليم', email_domain: 'moe.gov.sa' },
  members: [{ id: 'm1', email: 'sara@moe.gov.sa', full_name: 'سارة', role: 'org_admin', status: 'confirmed', source: 'admin', created_at: '2026-11-01T00:00:00Z' }, { id: 'm2', email: 'ali@moe.gov.sa', full_name: 'علي', role: 'learner', status: 'confirmed', source: 'domain', created_at: '2026-11-02T00:00:00Z' }, { id: 'm3', email: 'new@moe.gov.sa', full_name: null, role: 'learner', status: 'pending', source: 'domain', created_at: '2026-11-03T00:00:00Z' }],
  enrollments: [{ id: 'e1', email: 'ali@moe.gov.sa', full_name: 'علي', status: 'approved', program_id: 'p1', program: 'دبلوم', created_at: '2026-11-02T00:00:00Z', attendance: { sessions: 10, present: 9 } }, { id: 'e2', email: 'sara@moe.gov.sa', full_name: 'سارة', status: 'approved', program_id: 'p1', program: 'دبلوم', created_at: '2026-11-02T00:00:00Z', attendance: { sessions: 10, present: 7 } }, { id: 'e3', email: 'ali@moe.gov.sa', full_name: 'علي', status: 'pending', program_id: 'p2', program: 'ورشة', created_at: '2026-11-05T00:00:00Z', attendance: { sessions: 0, present: 0 } }],
  credentials: [{ email: 'ali@moe.gov.sa', title_ar: 'إتمام', kind: 'program_completion', level: 'B2', issued_at: '2026-11-10T00:00:00Z', verify_code: 'ATH-1' }],
  placements: [{ email: 'ali@moe.gov.sa', level: 'B1', taken_at: '2026-10-01T00:00:00Z' }, { email: 'ali@moe.gov.sa', level: 'B2', taken_at: '2026-11-01T00:00:00Z' }, { email: 'sara@moe.gov.sa', level: 'C1', taken_at: '2026-10-05T00:00:00Z' }],
  skills: [{ skill_id: 's1', code: 'ATH-AR-004', name_ar: 'الاستماع', name_en: 'Listening', domain: 'arabic', level: 4, confidence: 50, user_id: 'u1' }, { skill_id: 's1', code: 'ATH-AR-004', name_ar: 'الاستماع', name_en: 'Listening', domain: 'arabic', level: 3, confidence: 40, user_id: 'u2' }, { skill_id: 's2', code: 'ATH-PD-001', name_ar: 'تصميم', name_en: 'Design', domain: 'pedagogy', level: 5, confidence: 90, user_id: 'u1' }],
  events: { downloads: 12, sessions: 7, assessed: 5, last_at: '2026-11-10T00:00:00Z' }, requests: [{ id: 'r1', program: 'دبلوم', count: 20, status: 'quoted', created_at: '2026-11-06T00:00:00Z' }], resources: [] };

test('org: parsePeople handles lines, names, duplicates, invalid', () => {
  const p = parsePeople('sara@moe.gov.sa\nأحمد <ahmed@moe.gov.sa>\nAli, ali@moe.gov.sa\nSARA@MOE.GOV.SA\nnot-an-email\n; noor@moe.gov.sa');
  assert.deepEqual(p.map(x => x.email), ['sara@moe.gov.sa', 'ahmed@moe.gov.sa', 'ali@moe.gov.sa', 'noor@moe.gov.sa']);
  assert.equal(p[1].full_name, 'أحمد'); assert.equal(p[2].full_name, 'Ali'); assert.equal(p[0].full_name, '');
  assert.deepEqual(parsePeople(''), []); assert.equal(parsePeople('mailto:x@y.co')[0].email, 'x@y.co');
  assert.ok(inDomain('a@MOE.gov.sa', 'moe.gov.sa')); assert.ok(!inDomain('a@gmail.com', 'moe.gov.sa')); assert.ok(!inDomain('a@x.co', null));
  assert.equal(validateBulk('', [{ email: 'a@b.co' }]), 'اختر البرنامج'); assert.equal(validateBulk('p1', []), 'أدخل بريدًا واحدًا صالحًا على الأقل'); assert.equal(validateBulk('p1', new Array(301).fill({ email: 'a@b.co' })), 'الحد الأقصى 300 متدرب في الطلب الواحد'); assert.equal(validateBulk('p1', [{ email: 'a@b.co' }]), null);
});

test('org: KPIs, top skills, member rows', () => {
  const k = orgKpis(D);
  assert.equal(k.members, 2); assert.equal(k.pending, 1); assert.equal(k.learners, 2); assert.equal(k.programs, 1); assert.equal(k.attendance, 80, 'mean of 90% and 70%'); assert.equal(k.credentials, 1); assert.equal(k.placements, 3); assert.deepEqual(k.byLevel, { B1: 1, B2: 1, C1: 1 }); assert.equal(k.skillAvg, 4); assert.equal(k.skillsTracked, 2); assert.equal(k.downloads, 12);
  const ts = topSkills(D); assert.equal(ts[0].code, 'ATH-AR-004'); assert.equal(ts[0].n, 2); assert.equal(ts[0].avg, 3.5); assert.equal(ts[1].avg, 5);
  const rows = memberRows(D); const ali = rows.find(r => r.email === 'ali@moe.gov.sa')!; assert.equal(ali.enrollments.length, 2); assert.equal(ali.credentials, 1); assert.equal(ali.level, 'B2', 'latest placement wins'); assert.equal(rows.find(r => r.email === 'new@moe.gov.sa')!.enrollments.length, 0);
  assert.equal(memberStatusLabel('pending', 'ar'), 'بانتظار التأكيد'); assert.equal(memberRoleLabel('org_admin', 'en'), 'Org admin'); assert.equal(reqStatusLabel('quoted', 'ar'), 'أُرسل العرض'); assert.equal(reqStatusLabel('zzz', 'ar'), 'zzz');
  const ms = orgMembersSheet(D); assert.equal(ms.rows.length, 4); assert.equal(ms.rows[2][5], 'B2'); assert.equal(ms.rows[2][7], '90%'); assert.equal(ms.widths.length, ms.rows[0].length);
  const ss = orgSkillsSheet(D); assert.equal(ss.rows.length, 3); assert.equal(ss.rows[1][3], 2);
});
