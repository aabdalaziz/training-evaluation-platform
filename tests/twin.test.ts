// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P11: محرّك التوأم المهاري (عمر النصف، الطزاجة، الصدأ، السرعة، الإسقاط مع/بدون خطة، إعادة بناء الماضي، أرخص مسار،
// الكوكبة، توأم المؤسسة)، الشهادة الحية (بناء الحمولة، اللقطات والفروق، بريد النبض)، وتكامل الروابط (أثير/مستشارك/التبويبات)
import test from 'node:test';
import assert from 'node:assert/strict';
import { halfLife, freshnessAfter, rustHorizon, statusOf, velocityOf, twinSkill, decayLevel, applyGain, projectSkill, levelAt, levelAtPast, cheapestPath, constellation, orgTwin, buildLiving, snapshotOf, diffSnapshots, pulseOf, rustSentence, fmtLevel, GAIN, RUST_THRESHOLD } from '../lib/portal/twin';
import type { TwinEvidence, PathOption } from '../lib/portal/twin';
import { watchEmailHtml } from '../lib/portal/twin-cron';
import { localHello, parseAdvisor } from '../lib/ai/prompts';
import type { CompanionContext, AdvisorFacts } from '../lib/ai/prompts';

const NOW = new Date('2026-12-08T10:00:00Z');
const d = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86400000).toISOString();
const ev = (daysAgo: number, level: number, weight = 0.45, kind = 'simulation'): TwinEvidence => ({ kind, level, weight, at: d(daysAgo), label: 'x' });
const S1 = 'skill-1';

test('twin: half-life grows with evidence density, spacing and approval; bounded 45–365', () => {
  assert.equal(halfLife([]), 45);
  const one = halfLife([ev(1, 3)]); const many = halfLife([ev(1, 3), ev(20, 3), ev(40, 3), ev(80, 3, 1.0, 'placement')]);
  assert.ok(many > one, `${many} > ${one}`);
  assert.ok(halfLife([ev(1, 3)], true) > one);
  assert.ok(halfLife(Array.from({ length: 40 }, (_, i) => ev(i * 20, 4, 1.0)), true) <= 365);
});

test('twin: freshness decays by half each half-life; rust horizon crosses the 40% threshold', () => {
  assert.equal(freshnessAfter(0, 60), 100); assert.equal(freshnessAfter(60, 60), 50); assert.equal(freshnessAfter(120, 60), 25);
  const h = rustHorizon(60); assert.ok(freshnessAfter(h - 2, 60) >= RUST_THRESHOLD && freshnessAfter(h + 3, 60) < RUST_THRESHOLD);
  assert.equal(statusOf(90, true), 'bright'); assert.equal(statusOf(50, true), 'fading'); assert.equal(statusOf(10, true), 'rusty'); assert.equal(statusOf(0, false), 'dormant');
});

test('twin: velocity sign follows the evidence trend; zero with a single point', () => {
  assert.equal(velocityOf([ev(5, 4)], NOW), 0);
  assert.ok(velocityOf([ev(90, 2), ev(45, 3), ev(5, 4)], NOW) > 0);
  assert.ok(velocityOf([ev(90, 4), ev(45, 3), ev(5, 2)], NOW) < 0);
});

test('twin: twinSkill builds a consistent snapshot (approved overrides computed; floor; rust date)', () => {
  const t = twinSkill({ skill_id: S1, computed_level: 3.4, approved_level: 4, confidence: 70, evidence: [ev(10, 3), ev(50, 4, 1.0, 'placement')] }, NOW);
  assert.equal(t.level_now, 4); assert.ok(t.approved); assert.equal(t.days_since, 10); assert.equal(t.floor, 3); assert.equal(t.evidence_count, 2); assert.deepEqual(t.kinds, { simulation: 1, placement: 1 });
  assert.equal(t.status, 'bright'); assert.ok((t.rust_in_days || 0) > 0); assert.ok(t.rust_at && new Date(t.rust_at) > NOW);
  const rusty = twinSkill({ skill_id: S1, computed_level: 3, confidence: 20, evidence: [ev(400, 3)] }, NOW); assert.equal(rusty.status, 'rusty'); assert.ok((rusty.rust_in_days || 0) < 0);
  const dormant = twinSkill({ skill_id: S1, computed_level: 0, approved_level: 3, confidence: 0, evidence: [] }, NOW); assert.equal(dormant.status, 'dormant'); assert.equal(dormant.freshness, 0); assert.equal(dormant.rust_at, null);
});

test('twin: decay never passes the floor; gains saturate at higher levels and respect target/5 caps', () => {
  assert.equal(decayLevel(4, 2.5, 0, 60), 4); assert.ok(decayLevel(4, 2.5, 100000, 60) >= 2.5);
  assert.ok(applyGain(2, 'program') - 2 > applyGain(4.5, 'program') - 4.5);
  assert.equal(applyGain(4.9, 'program'), 5); assert.equal(applyGain(3, 'program', 1, 3.2), 3.2); assert.ok(GAIN.program > GAIN.simulation && GAIN.simulation > GAIN.daily);
});

test('twin: projection without activity is monotonically non-increasing; a planned program lifts and refreshes', () => {
  const t = twinSkill({ skill_id: S1, computed_level: 3.5, confidence: 50, evidence: [ev(5, 3.5), ev(30, 3.5)] }, NOW);
  const base = projectSkill(t, 180); for (let i = 1; i < base.length; i++) assert.ok(base[i].level <= base[i - 1].level + 1e-9); assert.ok(base[0].lo <= base[0].level && base[0].level <= base[0].hi);
  const withPlan = projectSkill(t, 180, [{ kind: 'program', day: 30, skills: [S1] }]);
  const at90 = (p: typeof base) => p.find(x => x.day === 90)!;
  assert.ok(at90(withPlan).level > at90(base).level); assert.ok(at90(withPlan).freshness > at90(base).freshness);
  assert.equal(levelAt(t, 90, [{ kind: 'program', day: 30, skills: [S1] }]).level, at90(withPlan).level);
  assert.equal(projectSkill(t, 180, [{ kind: 'program', day: 30, skills: ['other'] }]).find(x => x.day === 90)!.level, at90(base).level, 'plan for another skill has no effect');
});

test('twin: past reconstruction uses only prior evidence; null before birth', () => {
  const list = [ev(100, 2, 1.0, 'placement'), ev(10, 4, 0.7, 'simulation')];
  assert.equal(levelAtPast(list, new Date(NOW.getTime() - 200 * 86400000)), null);
  assert.equal(levelAtPast(list, new Date(NOW.getTime() - 50 * 86400000)), 2);
  const now = levelAtPast(list, NOW)!; assert.ok(now > 2 && now < 4);
});

test('twin: cheapest path reaches the target with program + weekly practice and reports hours/cost; honest when unreachable', () => {
  const t = twinSkill({ skill_id: S1, computed_level: 2.6, confidence: 40, evidence: [ev(3, 2.6)] }, NOW);
  const options: PathOption[] = [
    { id: 'program:p1', kind: 'program', label: 'برنامج', skills: [S1], hours: 20, cost: 900, start_day: 7, duration_days: 28, href: '/programs/p1' },
    { id: 'sim:s1', kind: 'simulation', label: 'محاكاة', skills: [S1], hours: 0.25, cost: 0, href: '/sim/x' },
    { id: 'daily', kind: 'daily', label: 'يومي', skills: [S1], hours: 0.08, cost: 0 },
  ];
  const r = cheapestPath(t, 4, 12, options);
  assert.ok(r.reachable, r.note_ar); assert.ok(r.level_end >= 4); assert.ok(r.steps.length > 0); assert.ok(r.hours > 0); assert.ok(/أسبوع/.test(r.note_ar));
  assert.ok(r.steps.some(s => s.option.kind === 'simulation'), 'free simulation is preferred by gain/hour');
  const short = cheapestPath(t, 5, 2, options.filter(o => o.kind !== 'program')); assert.equal(short.reachable, false); assert.ok(/طموح/.test(short.note_ar));
  const none = cheapestPath(t, 4, 8, []); assert.equal(none.reachable, false); assert.ok(/لا توجد/.test(none.note_ar));
});

test('twin: constellation is deterministic, keeps higher levels closer to the centre, maps freshness to opacity', () => {
  const items = [{ skill_id: 'a', domain: 'arabic', level: 5, confidence: 80, freshness: 100 }, { skill_id: 'b', domain: 'arabic', level: 1, confidence: 20, freshness: 10 }, { skill_id: 'c', domain: 'unknown', level: 3, confidence: 50, freshness: 50 }];
  const dom = ['arabic', 'pedagogy'];
  const a = constellation(items, dom); const b = constellation(items, dom); assert.deepEqual(a, b);
  const dist = (s: { x: number; y: number }) => Math.hypot(s.x - 260, s.y - 260);
  assert.ok(dist(a.find(s => s.skill_id === 'a')!) < dist(a.find(s => s.skill_id === 'b')!));
  assert.ok(a.find(s => s.skill_id === 'a')!.opacity > a.find(s => s.skill_id === 'b')!.opacity); assert.ok(a.find(s => s.skill_id === 'a')!.r > a.find(s => s.skill_id === 'b')!.r);
  assert.equal(a.length, 3, 'unknown domain falls back to the first sector');
});

test('twin: organisation twin — policy B (monthly simulation) beats policy A and reduces rust', () => {
  const rows = [
    { user_id: 'u1', domain: 'pedagogy', skill_id: 'k1', computed_level: 3.2, confidence: 40, evidence: [ev(20, 3.2)] },
    { user_id: 'u1', domain: 'pedagogy', skill_id: 'k2', computed_level: 2.8, confidence: 30, evidence: [ev(150, 2.8)] },
    { user_id: 'u2', domain: 'arabic', skill_id: 'k3', computed_level: 4, approved_level: 4, confidence: 80, evidence: [ev(5, 4, 1.0, 'placement')] },
  ];
  const o = orgTwin(rows, NOW);
  assert.equal(o.members, 2); assert.equal(o.skills, 3); assert.equal(o.domains[0].domain, 'pedagogy');
  for (const dRow of o.domains) { assert.ok(dRow.level_180_b >= dRow.level_180_a); assert.ok(dRow.level_180_a <= dRow.level_now + 1e-9); assert.ok(dRow.rusty_180_b <= dRow.rusty_180_a); }
  assert.ok(o.domains.find(x => x.domain === 'pedagogy')!.rusty_180_a >= 1);
});

test('living credential: buildLiving computes per-skill now vs issue, pulse, chain (types/dates only) and respects live=false', () => {
  const v = { ok: true, code: 'ATH-AAAA-BBBB', kind: 'skill', title_ar: 'شهادة', full_name: 'أحمد', issued_at: d(60), live: true, watchers: 2,
    skills: [{ id: 'k1', code: 'ATH-PD-001', name_ar: 'إدارة الصف', name_en: 'Classroom management', domain: 'pedagogy' }, { id: 'k2', code: 'ATH-PD-002', name_ar: 'تصميم الأنشطة', name_en: null, domain: 'pedagogy' }],
    levels: [{ skill_id: 'k1', computed_level: 3.6, approved_level: null, confidence: 60, evidence: [ev(90, 3, 1.0, 'placement'), ev(2, 4, 0.7, 'simulation')] }] };
  const l = buildLiving(v, NOW) as any;
  assert.ok(l.ok && l.live); assert.equal(l.levels.length, 2); assert.equal(l.levels[0].level_issue, 3); assert.equal(l.levels[0].level_now, 3.6); assert.equal(l.levels[0].status, 'bright');
  assert.equal(l.levels[1].status, 'dormant'); assert.equal(l.levels[1].evidence_count, 0);
  assert.equal(l.pulse, l.levels[0].freshness, 'pulse averages only skills with evidence'); assert.equal(l.evidence_total, 2); assert.equal(l.chain[0].kind, 'simulation'); assert.equal(l.chain[0].at.length, 10); assert.equal(l.watchers, 2);
  assert.deepEqual(Object.keys(l.snapshot), ['ATH-PD-001', 'ATH-PD-002']);
  const off = buildLiving({ ...v, live: false }, NOW) as any; assert.equal(off.live, false); assert.equal(off.levels.length, 0); assert.equal(off.pulse, null); assert.deepEqual(off.snapshot, {});
  assert.deepEqual(buildLiving({ ok: false }), { ok: false }); assert.deepEqual(buildLiving(null), { ok: false });
});

test('living credential: snapshots diff on level (≥0.1) or status change; digest email lists changes and unsubscribe link', () => {
  const cur = snapshotOf([{ code: 'A', level_now: 3.64, status: 'bright' } as any, { code: 'B', level_now: 2, status: 'rusty' } as any]);
  assert.deepEqual(cur, { A: { level: 3.6, status: 'bright' }, B: { level: 2, status: 'rusty' } });
  assert.equal(diffSnapshots(cur, cur).length, 0);
  assert.equal(diffSnapshots(null, cur).length, 2);
  const ch = diffSnapshots({ A: { level: 3.6, status: 'bright' }, B: { level: 2, status: 'fading' } }, cur); assert.equal(ch.length, 1); assert.equal(ch[0].code, 'B'); assert.equal(ch[0].status_to, 'rusty');
  const html = watchEmailHtml({ title: 'شهادة', holder: 'أحمد', code: 'ATH-1', url: 'https://x/credential/ATH-1', token: 'tok1', changes: ch, names: { B: 'تصميم الأنشطة' }, pulse: 55 });
  assert.ok(html.includes('تصميم الأنشطة') && html.includes('صدئة') && html.includes('unwatch=tok1') && html.includes('55%'));
  assert.equal(pulseOf([{ freshness: 100 }, { freshness: 0 }]), 50); assert.equal(pulseOf([]), 0);
});

test('twin: rust sentences and level formatting', () => {
  const t = twinSkill({ skill_id: S1, computed_level: 3, confidence: 30, evidence: [ev(2, 3)] }, NOW);
  assert.ok(/متوهّجة/.test(rustSentence(t, 'إدارة الصف', 'ar'))); assert.ok(/bright/.test(rustSentence(t, 'X', 'en')));
  const r = twinSkill({ skill_id: S1, computed_level: 3, confidence: 30, evidence: [ev(500, 3)] }, NOW); assert.ok(/صدئت/.test(rustSentence(r, 'س', 'ar')));
  assert.ok(/بلا أدلة/.test(rustSentence(twinSkill({ skill_id: S1, computed_level: 0, confidence: 0, evidence: [] }, NOW), 'س', 'ar')));
  assert.equal(fmtLevel(3.456), '3.5'); assert.equal(fmtLevel(4), '4.0');
});

test('integration: Athir proposes the twin when a skill has been idle 30+ days; advisor may link to /me/twin', () => {
  const c: CompanionContext = { name: 'أحمد', visits: 5, last_seen_days: 2, goals: [], summary: '', weakest: { name: 'إدارة الصف', level: 2, days_since: 45 }, strongest: { name: 'تصميم', level: 4 }, due_sessions: [], streak: 0, hour: 10 } as any;
  const h = localHello(c); assert.ok(h.actions.some(a => a.href === '/me/twin'));
  const f: AdvisorFacts = { services: [], programs: [], sessions: [], counters: {}, now: '' } as any;
  const a = parseAdvisor({ answer_ar: 'جرّب توأمك', links: [{ label: 'توأمي', href: '/me/twin' }], confidence: 0.8 }, f)!; assert.equal(a.links.length, 1);
});
