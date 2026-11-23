// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* هـ-3 ن «محطّات»: أدوات التقييم والاستبيان الأربع على عدّة التدفّق — شاشة لكل محور، ونفس الهوية */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STATEMENTS, STATEMENT_AXES, statementsOfAxis } from '../lib/surveys/remoteLearning';

const R = (p: string) => readFileSync(p, 'utf8');
const TOOLS = ['app/survey/remote-learning/page.tsx', 'app/evaluate/[kind]/page.tsx', 'app/impact/[token]/ImpactForm.tsx', 'app/followup/[token]/FollowupForm.tsx'];

test('هـ-3 ن: محاور الاستبيان عن بُعد تغطّي العبارات الثلاث عشرة مرة واحدة', () => {
  const keys = STATEMENT_AXES.flatMap(a => a.keys);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual([...keys].sort(), STATEMENTS.map(s => s.key).sort());
  assert.equal(STATEMENT_AXES.length, 4); assert.equal(statementsOfAxis('skills').length, 5); assert.equal(statementsOfAxis('nope').length, 0);
  for (const a of STATEMENT_AXES) assert.ok(a.ar && a.en && a.hint_ar && a.hint_en);
});

test('هـ-3 ن: الأدوات الأربع على StepFlow — محطّات وتنقّل وتحقّق لكل محطّة، بلا رؤوس قديمة', () => {
  for (const p of TOOLS) {
    const s = R(p);
    assert.ok(s.includes("from '../../components/StepFlow'"), `${p}: يستورد العدّة`);
    for (const k of ['<FlowShell', '<Stations', '<StepCard', '<FlowNav', 'useStepScroll(step)', 'setReached']) assert.ok(s.includes(k), `${p}: ${k}`);
    assert.ok(/function (next|go)\(/.test(s), `${p}: تنقّل`);
    assert.ok(!/<header className="(rs|ev|im|fu)-head/.test(s) && !/<form onSubmit=\{submit\}/.test(s), `${p}: لا نموذج طولي`);
    assert.ok(!/#(0b2240|14466b|b91c1c|2563eb|0f5c57)/i.test(s), `${p}: ألوان قديمة`);
  }
  const kit = R('app/components/StepFlow.tsx');
  for (const c of ['.fl-chip.miss', '.fl-chip.cur', '.fl-bar', '.fl-nav', '.fl-scale button.na', '.fl-legend', 'prefers-reduced-motion', 'role="progressbar"', 'aria-current={cur']) assert.ok(kit.includes(c), `العدّة: ${c}`);
  assert.ok(!/min-height:(3[0-9]|[12][0-9])px/.test(kit.replace(/\.fl-chip i\{[^}]*\}/, '')), 'أهداف لمس ≥ 40px');
});

test('هـ-3 ن: معرّفات الاختبار الموروثة باقية (مرّة واحدة · الرابط المقفل · NPS · البرنامج)', () => {
  const ev = R('app/evaluate/[kind]/page.tsx');
  for (const id of ['ev-journey', 'ev-jchip', 'ev-once', 'ev-once-override', 'ev-locked', 'ev-link-closed', 'ev-nps', 'ev-program', 'ev-link-rooms', 'ev-email', 'ev-dup']) assert.ok(ev.includes(id), id);
  assert.ok(ev.includes('id={`sec-${gi}`}') && ev.includes('id={`q-${q.id}`}'));
  const rs = R('app/survey/remote-learning/page.tsx');
  for (const id of ['rs-once', 'rs-once-override', 'rs-start', 'rs-stations', 'rs-done']) assert.ok(rs.includes(id), id);
  assert.ok(rs.includes("from('remote_learning_survey_responses').insert(payload)"), 'الحفظ كما هو');
  assert.ok(R('app/impact/[token]/ImpactForm.tsx').includes("db.rpc('impact_submit'") && R('app/followup/[token]/FollowupForm.tsx').includes("db.rpc('behavior_submit'"), 'RPC كما هي');
});

test('هـ-3 ن: «نبض البيئة التدريبية» استُعيد إلى /admin/env-pulse ولا تكرار في سجلّ الغرف', () => {
  const rooms = R('lib/portal/rooms.ts');
  assert.ok(rooms.includes("'/admin/env-pulse'") && (rooms.match(/href: '\/admin\/pulse'/g) || []).length === 1);
  assert.ok(R('app/admin/env-pulse/page.tsx').includes('data-testid="pl-week-record"') && R('lib/portal/wings.ts').includes("'/admin/env-pulse'"));
});
