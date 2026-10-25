// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P7: تحويل تقرير مِعيار، المستويات، الملاءمة والتوصية، التوزيع، Excel
import test from 'node:test';
import assert from 'node:assert/strict';
import { CEFR_LEVELS, MIAAR_SKILLS, isCefr, levelRank, levelLabel, levelTone, parseMiaarReport, placementValid, evidenceSkills, effectiveLevel, programFit, recommendPrograms, levelDistribution, latestByEmail, placementsSheet, miaarSkillLabel } from '../lib/portal/placement';
import type { Placement, MiaarReportRow } from '../lib/portal/placement';

const REPORT: MiaarReportRow = { id: 'rep-1', submission_id: 'sub-1', test_version: '1.4.0-advanced-c1c2', candidate_email: 'Sara@Example.com', created_at: '2026-10-16T15:45:46.712Z', report: {
  'بيانات_المتقدم': { 'الاسم': 'سارة أحمد', 'البريد_الإلكتروني': 'sara@example.com', 'الهاتف': '—', 'اللغة_الأم': 'التركية', 'دراسة_سابقة_للعربية': 'نعم', 'الغرض_من_الاختبار': 'الدراسة الجامعية' },
  'المستوى_العام': 'B1', 'الدرجة_الموضوعية': '41/60', 'النسبة_العامة': 68,
  'تفصيل_المهارات': { 'القواعد_والمفردات': 'B2', 'القراءة': 'B1', 'الاستماع': 'A2' },
  'احصائيات': { grammar_vocab: { correct: 16, answered: 20, total: 24, percent: 80, level: 'B2' }, reading: { correct: 13, answered: 20, total: 24, percent: 65, level: 'B2' }, listening: { correct: 12, answered: 20, total: 24, percent: 60, level: 'B1' } },
  'مستويات_تفصيلية': [{ level: 'A1', correct: 10, answered: 10, total: 10, percent: 100, status: 'passed', passedThreshold: true }, { level: 'A2', correct: 9, answered: 10, total: 10, percent: 90, status: 'passed', passedThreshold: true }, { level: 'B1', correct: 7, answered: 10, total: 10, percent: 70, status: 'passed', passedThreshold: true }, { level: 'B2', correct: 5, answered: 10, total: 10, percent: 50, status: 'failed', passedThreshold: false }, { level: 'C1', correct: 0, answered: 0, total: 10, percent: 0, status: 'partial', passedThreshold: false }, { level: 'C2', correct: 0, answered: 0, total: 10, percent: 0, status: 'partial', passedThreshold: false }],
  'سبب_الانتهاء': 'إيقاف تدرّجي — لم تُستوفَ نسبة الانتقال', 'الوقت_المستغرق': '32:10', 'التوصية': 'مستوى الالتحاق المقترح: B2. المستوى المثبت مبدئيًا: B1. ركّز على مهارة الاستماع لمدة 4 أسابيع (النسبة 60%) ثم أعد التقييم.',
  'تاريخ': '2026-10-16T15:45:46.712Z', 'ملخص_التسكين': { 'المستوى_المثبت': 'B1', 'مستوى_الالتحاق_المقترح': 'B2', 'طبيعة_النتيجة': 'توصية تسكين مبدئية' }, 'إصدار_البنك': '1.4.0-advanced-c1c2', 'عدد_البنود_المقدمة': 60,
} };

test('placement: levels + labels', () => {
  assert.equal(CEFR_LEVELS.length, 6); assert.equal(MIAAR_SKILLS.length, 3); assert.ok(isCefr('B2')); assert.ok(!isCefr('X1')); assert.equal(levelRank('C2'), 5); assert.equal(levelRank(null), -1);
  assert.equal(levelLabel('B1', 'ar'), 'B1 · متوسط'); assert.equal(levelLabel('B1', 'en'), 'B1 · Intermediate'); assert.equal(levelLabel(null, 'ar'), '—');
  assert.equal(levelTone('A2'), 'a'); assert.equal(levelTone('B2'), 'b'); assert.equal(levelTone('C1'), 'c'); assert.equal(levelTone(undefined), 'none');
  assert.equal(miaarSkillLabel('grammar_vocab', 'ar'), 'القواعد والمفردات'); assert.equal(miaarSkillLabel('zzz', 'en'), 'zzz');
});

test('placement: parse Mi‘yar report (Arabic keys) into normalized row', () => {
  const p = parseMiaarReport(REPORT);
  assert.equal(p.external_id, 'rep-1'); assert.equal(p.email, 'sara@example.com'); assert.equal(p.full_name, 'سارة أحمد'); assert.equal(p.phone, null, '— becomes null'); assert.equal(p.native_language, 'التركية');
  assert.equal(p.demonstrated_level, 'B1'); assert.equal(p.entry_level, 'B2'); assert.equal(p.overall_percent, 68); assert.equal(p.score_text, '41/60');
  assert.equal(p.skills.listening?.percent, 60); assert.equal(p.skills.grammar_vocab?.level, 'B2'); assert.equal(p.levels.length, 6); assert.equal(p.levels[3].status, 'failed');
  assert.equal(p.taken_at, '2026-10-16T15:45:46.712Z'); assert.equal(p.test_version, '1.4.0-advanced-c1c2'); assert.ok(p.recommendation?.startsWith('مستوى الالتحاق')); assert.equal(p.duration_text, '32:10');
  assert.ok(placementValid(p)); assert.ok(!placementValid({ email: 'bad', external_id: 'x' }));
  const minimal = parseMiaarReport({ id: 'r2', candidate_email: 'a@b.co', report: { 'المستوى_العام': 'A2' } });
  assert.equal(minimal.entry_level, 'A2'); assert.equal(minimal.demonstrated_level, 'A2'); assert.equal(minimal.overall_percent, null); assert.deepEqual(minimal.levels, []); assert.ok(minimal.taken_at);
  assert.equal(effectiveLevel(p), 'B2'); assert.equal(effectiveLevel({ entry_level: null, demonstrated_level: 'A1' }), 'A1'); assert.equal(effectiveLevel(null), null);
  const ids = evidenceSkills(p, new Map([['ATH-AR-004', 's4'], ['ATH-AR-005', 's5'], ['ATH-AR-006', 's6']])); assert.deepEqual(ids, ['s4', 's5', 's6']);
  assert.deepEqual(evidenceSkills({ skills: { reading: { correct: 1, answered: 2, total: 2, percent: 50, level: 'A1' } } }, new Map([['ATH-AR-005', 's5']])), ['s5']);
});

test('placement: program fit + recommendation', () => {
  assert.equal(programFit('B2', 'B2'), 'match'); assert.equal(programFit('C1', 'B2'), 'stretch'); assert.equal(programFit('A2', 'B2'), 'below'); assert.equal(programFit('C2', 'B1'), 'unknown'); assert.equal(programFit(null, 'B1'), 'unknown'); assert.equal(programFit('B1', null), 'unknown');
  const progs = [{ id: 'a', cefr_level: 'A1' }, { id: 'b', cefr_level: 'B2' }, { id: 'c', cefr_level: 'C1' }, { id: 'd', cefr_level: null }];
  assert.deepEqual(recommendPrograms(progs, 'B2').map(p => p.id), ['b', 'c']); assert.deepEqual(recommendPrograms(progs, null), []);
});

test('placement: distribution, latest-per-email, Excel', () => {
  const P = (o: Partial<Placement>): Placement => ({ id: 'x', source: 'miaar', external_id: 'e', email: 'a@b.co', skills: {}, levels: [], taken_at: '2026-10-01T00:00:00Z', ...o });
  const rows = [P({ id: '1', email: 'a@b.co', entry_level: 'B1', taken_at: '2026-10-01T00:00:00Z' }), P({ id: '2', email: 'a@b.co', entry_level: 'B2', taken_at: '2026-10-20T00:00:00Z' }), P({ id: '3', email: 'c@d.co', entry_level: 'A1' })];
  const latest = latestByEmail(rows); assert.equal(latest.size, 2); assert.equal(latest.get('a@b.co')?.id, '2');
  const dist = levelDistribution(Array.from(latest.values())); assert.equal(dist.find(d => d.level === 'B2')?.n, 1); assert.equal(dist.find(d => d.level === 'A1')?.pct, 50); assert.equal(dist.find(d => d.level === 'C2')?.n, 0);
  const sh = placementsSheet([P({ ...parseMiaarReport(REPORT), id: 'z' } as Placement)]); assert.equal(sh.rows.length, 2); assert.equal(sh.rows[1][1], 'سارة أحمد'); assert.equal(sh.rows[1][7], 'B2'); assert.equal(sh.rows[1][10], 'B1 (60%)'); assert.equal(sh.widths.length, sh.rows[0].length);
});

import { resolveMiaarUrl } from '../lib/portal/placement-sync';
test('placement: Mi‘yar URL normalisation (dashboard links, paths, bare refs)', () => {
  assert.equal(resolveMiaarUrl('https://jpujqwqhgnbvxwxaqmdv.supabase.co'), 'https://jpujqwqhgnbvxwxaqmdv.supabase.co');
  assert.equal(resolveMiaarUrl(' https://jpujqwqhgnbvxwxaqmdv.supabase.co/ '), 'https://jpujqwqhgnbvxwxaqmdv.supabase.co');
  assert.equal(resolveMiaarUrl('https://jpujqwqhgnbvxwxaqmdv.supabase.co/rest/v1'), 'https://jpujqwqhgnbvxwxaqmdv.supabase.co');
  assert.equal(resolveMiaarUrl('https://supabase.com/dashboard/project/jpujqwqhgnbvxwxaqmdv/settings/api-keys'), 'https://jpujqwqhgnbvxwxaqmdv.supabase.co');
  assert.equal(resolveMiaarUrl('jpujqwqhgnbvxwxaqmdv'), 'https://jpujqwqhgnbvxwxaqmdv.supabase.co');
  assert.equal(resolveMiaarUrl('jpujqwqhgnbvxwxaqmdv.supabase.co'), 'https://jpujqwqhgnbvxwxaqmdv.supabase.co');
  assert.equal(resolveMiaarUrl(''), null); assert.equal(resolveMiaarUrl('sb_secret_abc'), null);
});
