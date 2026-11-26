// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P85 — كلّ رسوم التقرير (الأعماق الثلاثة) تُرسم SVG دون أخطاء وبسمات التصدير */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
// @ts-ignore — لا ملفّ تعريفات لـ react-dom/server في المشروع
import { renderToStaticMarkup } from 'react-dom/server';
import { analyze, compose } from '../lib/reports/insight';
import type { Depth } from '../lib/reports/insight';
import { DS } from './p85-insight.test';

test('رسوم التقرير تُرسم لكلّ عمق', async () => {
  (globalThis as any).React = React; /* tsx يترجم JSX إلى React.createElement (jsx: preserve) */
  const { Chart } = await import('../app/reports/components/Charts');
  const a = analyze(DS, { benchmarkOthers: [4.1, 4.3, 3.9] });
  let count = 0; const kinds = new Set<string>();
  for (const depth of ['executive', 'detailed', 'comprehensive'] as Depth[]) {
    const rep = compose(a, { program: 'اختبار', period: 'فترة', generatedAt: 'اليوم', depth });
    for (const s of rep.sections) for (const b of s.blocks) if (b.type === 'chart') {
      const html = renderToStaticMarkup(React.createElement(Chart, { spec: b.spec }));
      assert.ok(html.startsWith('<svg'), `${b.spec.chart} svg`); assert.ok(html.includes('class="ch"') && html.includes(`data-chart=`), `${b.spec.chart} attrs`);
      assert.ok(!/NaN|undefined/.test(html), `${b.spec.chart} has NaN/undefined`); count++; kinds.add(b.spec.chart);
    }
  }
  assert.ok(count >= 8, `charts rendered: ${count}`);
  for (const k of ['radar', 'bars', 'dist', 'line', 'quadrant', 'heat', 'donut']) assert.ok(kinds.has(k), `chart kind used: ${k}`);
});
