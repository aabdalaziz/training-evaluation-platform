// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P59 «نسيج الشعبة» — النواة: k ≥ 5 على المحطات والخيوط والاقتباسات · التجميع بالنوع للمحطات الشخصية · المرآة بلا أسماء · نجمة الشعبة · أقوى خيط للجهة · زملاء الخيط */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { weave, groupKey, orgStrongestThread, peersOf, peersLine, K_WEAVE, WEAVE_PATH, WEAVE_TITLE } from '../lib/map/weave';
import type { LearnerMap } from '../lib/map/weave';
import { buildMap } from '../lib/map/registry';
import type { MapInput, Decision } from '../lib/map/registry';
import { parseCommand } from '../lib/portal/voice';

const SK = '11111111-1111-4111-8111-111111111111';
const D = (d: number) => new Date(Date.UTC(2026, 9, 1) + d * 86400000).toISOString();
/** متعلّم نموذجي: برنامج → مهارة (90 ي) → شهادة · حالة يوم → مهمة */
function learner(email: string, o: { skillAt?: number; cred?: boolean; keep?: boolean; manual?: boolean; shared?: boolean } = {}): LearnerMap & { decisions: Decision[] } {
  const inp: MapInput = {
    events: [
      { at: D(0), verb: 'completed', object_type: 'program', object_id: 'p1', skills: [SK], context: { title: 'دبلوم التدريس' } },
      { at: D(10), verb: 'attended', object_type: 'session', object_id: 's1', skills: [SK], context: { title: 'جلسة مخارج الحروف' } },
    ],
    daily: [{ case_id: 'dc1', created_at: D(20), response: 'x', band: 'b', score: 1, case_title: 'حالة يوم: طالب متأخّر دائمًا' }],
    missions: o.cred ? [{ id: `m-${email}`, title_ar: 'مهمة', confirmed_at: D(30), submitted_at: D(32), status: 'confirmed', skills: [] }] : [],
    memberships: [], cases: [], levels: [{ skill_id: SK, approved_level: 2, approved_at: D(o.skillAt ?? 40), computed_level: 2 }],
    credentials: o.cred ? [{ id: `c-${email}`, kind: 'skill', title_ar: 'شهادة مهارة: تدريس العربية', issued_at: D(60), skill_id: SK }] : [],
    skills: { [SK]: 'تدريس العربية' }, hands: [],
  } as unknown as MapInput;
  const decisions: Decision[] = [];
  if (o.keep) decisions.push({ from_key: 'program:p1', to_key: `skill:${SK}`, rule: 'program_skill', status: 'kept', note_ar: `لأن البرنامج غيّرني ${email.slice(0, 2)}`, decided_at: D(41), shared: !!o.shared });
  if (o.manual) decisions.push({ from_key: 'session:s1', to_key: 'daily:dc1', rule: 'manual', status: 'kept', note_ar: 'خيط رأيته بنفسي', decided_at: D(41) });
  return { email, map: buildMap(inp, decisions), decisions };
}
const emails = (n: number) => Array.from({ length: n }, (_, i) => `l${i}@upm.edu.sa`);

test('P59: تحت k لا يظهر شيء — ولا عدد', () => {
  const w = weave(emails(4).map((e) => learner(e, { keep: true })));
  assert.equal(w.below_k, true); assert.equal(w.stations.length, 0); assert.equal(w.threads.length, 0); assert.equal(w.quotes.length, 0);
  assert.match(w.mirror.lines_ar[0], /حين يبلغ 5/); assert.equal(w.mirror.strongest_ar, null); assert.equal(w.star, null);
  const empty = weave([]); assert.match(empty.mirror.lines_ar[0], /لم يبدأ/);
});

test('P59: عند k تظهر المحطات المشتركة والخيوط المنسوجة بالعدد · والمقترَح الذي لم يُؤخذ منقّط', () => {
  const ls = emails(6).map((e, i) => learner(e, { keep: i < 5 }));
  const w = weave(ls);
  assert.equal(w.below_k, false); assert.equal(w.mapped, 6);
  const keys = w.stations.map((s) => s.key); assert.ok(keys.includes('program:p1') && keys.includes(`skill:${SK}`) && keys.includes('session:s1') && keys.includes('daily:dc1'));
  for (const s of w.stations) assert.ok(s.n >= K_WEAVE, `${s.key} n=${s.n}`);
  const woven = w.threads.find((t) => t.rule === 'program_skill'); assert.ok(woven); assert.equal(woven!.state, 'woven'); assert.equal(woven!.kept_n, 5); assert.equal(woven!.offered_n, 6);
  const untaken = w.threads.find((t) => t.rule === 'session_skill'); assert.ok(untaken, 'session_skill اقتُرح للجميع ولم يأخذه أحد'); assert.equal(untaken!.state, 'untaken'); assert.equal(untaken!.kept_n, 0); assert.equal(untaken!.offered_n, 6);
  assert.equal(w.weights['program:p1>skill:' + SK], 5); assert.equal(w.counts['program:p1'], 6);
  assert.match(w.mirror.strongest_ar!, /أكثر خيط نسجه متعلّموك: برنامج قاد إلى مهارة معتمدة — 5 من 6/);
  assert.match(w.mirror.untaken_ar!, /اقترحناه لـ 6 ولم يأخذه أحد/); assert.match(w.mirror.waiting_ar!, /كلمة أصحابها/);
  for (const l of w.mirror.lines_ar) for (const e of emails(6)) assert.ok(!l.includes(e));
  assert.ok(w.layout.pos['program:p1']); assert.equal(Object.keys(w.layout.pos).length, w.stations.length);
});

test('P59: خيط نسجه 4 فقط لا يظهر (ولا يُعدّ untaken) · الخيط اليدوي يُجمَّع كغيره إذا بلغ k', () => {
  const ls = emails(7).map((e, i) => learner(e, { keep: i < 4, manual: i < 5 }));
  const w = weave(ls);
  assert.ok(!w.threads.some((t) => t.rule === 'program_skill'), 'program_skill: 4 ناسجين < k ولم يكن صفرًا → لا يظهر');
  const man = w.threads.find((t) => t.rule === 'manual'); assert.ok(man); assert.equal(man!.kept_n, 5); assert.equal(man!.state, 'woven');
});

test('P59: المحطات الشخصية تُجمَّع بالنوع/العنوان لا بالمعرّف', () => {
  const ls = emails(5).map((e) => learner(e, { cred: true, keep: true }));
  const w = weave(ls);
  const cred = w.stations.find((s) => s.kind === 'credential'); assert.ok(cred, 'شهادات بمعرّفات مختلفة وعنوان واحد → محطة واحدة'); assert.equal(cred!.n, 5); assert.match(cred!.title_ar, /شهادة مهارة/);
  const mis = w.stations.find((s) => s.kind === 'mission'); assert.ok(mis); assert.equal(mis!.n, 5); assert.equal(mis!.key, 'mission:~'); assert.match(mis!.title_ar, /مهمة ميدانية/);
  assert.equal(groupKey({ key: 'hand:abc', kind: 'hand', at: D(1), title_ar: 'x', public_ar: 'x', skills: [] }), 'hand:~');
  const sc = w.threads.find((t) => t.rule === 'skill_credential'); assert.ok(sc, 'مهارة → شهادة اقتُرح للخمسة'); assert.equal(sc!.offered_n, 5);
});

test('P59: الاقتباسات لا تظهر قبل 5 مأذونين · ثم ≤ 10 بلا اسم · الترتيب ثابت في اليوم', () => {
  const ls = emails(8).map((e) => learner(e, { keep: true }));
  const note = (e: string) => ({ email: e, from_key: 'program:p1', to_key: `skill:${SK}`, rule: 'program_skill', note_ar: `لأن البرنامج غيّرني ${e.slice(0, 2)}` });
  const w4 = weave(ls, emails(4).map(note)); assert.equal(w4.quotes.length, 0); assert.equal(w4.consenters, 4); assert.match(w4.quotes_locked_ar!, /أذِن 4/);
  const w5 = weave(ls, emails(5).map(note), { now: new Date('2026-11-07T10:00:00Z') }); assert.equal(w5.quotes.length, 5); assert.equal(w5.quotes_locked_ar, null);
  for (const q of w5.quotes) { assert.equal(q.title_ar, 'برنامج قاد إلى مهارة معتمدة'); assert.ok(!('email' in q)); assert.ok(!/@/.test(q.note_ar)); }
  const again = weave(ls, emails(5).map(note), { now: new Date('2026-11-07T22:00:00Z') }); assert.deepEqual(again.quotes, w5.quotes);
  /* مأذون ليس في الشعبة لا يُحتسب · 12 مأذونًا → 10 فقط */
  const w12 = weave(ls, [...emails(8).map(note), ...['x1@a.b', 'x2@a.b', 'x3@a.b', 'x4@a.b'].map(note)]); assert.equal(w12.consenters, 8); assert.equal(w12.quotes.length, 8);
  const many = weave(emails(12).map((e) => learner(e, { keep: true })), emails(12).map(note)); assert.equal(many.quotes.length, 10);
});

test('P59: نجمة الشعبة عند ≥ 70٪ من أصحاب الخرائط', () => {
  const star = weave(emails(10).map((e, i) => learner(e, { keep: i < 7 }))); assert.equal(star.star, `program:p1>skill:${SK}`);
  const no = weave(emails(10).map((e, i) => learner(e, { keep: i < 6 }))); assert.equal(no.star, null);
});

test('P59 → الجهة: أقوى خيط k ≥ 5 ناسجين · اليدوي لا يُحتسب · تحت k لا سطر', () => {
  const rows = [...emails(5).map((email) => ({ email, rule: 'program_skill' })), ...emails(3).map((email) => ({ email, rule: 'manual' })), { email: 'l0@upm.edu.sa', rule: 'program_skill' }];
  const r = orgStrongestThread(rows); assert.ok(r); assert.equal(r!.rule, 'program_skill'); assert.equal(r!.n, 5); assert.match(r!.line_ar, /أقوى خيط نسجه منسوبوكم هذا الشهر: برنامج قاد إلى مهارة معتمدة — نسجه 5 منهم/);
  assert.equal(orgStrongestThread(rows.slice(0, 4)), null);
  assert.equal(orgStrongestThread(emails(9).map((email) => ({ email, rule: 'manual' }))), null);
});

test('P59: «خيطك نسجه معك N من زملائك» — يستثني صاحبه ويظهر عند ≥ 5', () => {
  const mine = [{ from: 'program:p1', to: `skill:${SK}` }, { from: 'session:s1', to: 'daily:dc1' }];
  const peers = [...emails(6).map((email) => ({ email, from_key: 'program:p1', to_key: `skill:${SK}` })), ...emails(3).map((email) => ({ email, from_key: 'session:s1', to_key: 'daily:dc1' }))];
  const p = peersOf(mine, peers, 'l0@upm.edu.sa'); assert.equal(p[`program:p1>skill:${SK}`], 5); assert.equal(p['session:s1>daily:dc1'], undefined);
  assert.equal(peersLine(5), 'خيطك هذا نسجه معك 5 من زملائك');
});

test('P59: التكامل — «نادِ» · المسار · العناوين · لا SQL جديد غير العمودين', () => {
  assert.equal(WEAVE_PATH, '/me/day/weave'); assert.equal(WEAVE_TITLE.ar, 'نسيج الشعبة'); assert.equal(WEAVE_TITLE.sub_ar, 'ما نسجه متعلّموك معًا');
  for (const say of ['نسيج شعبتي', 'افتح نسيج الشعبة', 'ما نسجه متعلّموي']) { const c = parseCommand(say) as any; assert.equal(c?.href || c?.to || c?.path, WEAVE_PATH, say); }
  const sql = readFileSync('supabase/migrations/20270206_portal_p59_section_weave.sql', 'utf8');
  assert.match(sql, /add column if not exists share_trainer boolean not null default false/); assert.match(sql, /shared_at\s+timestamptz/); assert.ok(!/create table/.test(sql));
  const store = readFileSync('lib/map/store.ts', 'utf8'); assert.match(store, /share_trainer: false, shared_at: null/); assert.match(store, /export async function shareThread/);
  const way = readFileSync('lib/portal/way.ts', 'utf8'); assert.match(way, /'me\/day\/weave'/);
  const day = readFileSync('lib/portal/day.ts', 'utf8'); assert.match(day, /weave_word:\$\{tid\}/); assert.match(day, /على نسيجكم/); /* كلمة على النسيج = trainer_word مع meta.weave — الردود ✋ تعمل كما هي */
});
