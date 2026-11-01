// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «مفاتيح أَثَر» + «خِفّة أَثَر» (P40): رموز اللون وحالات الزر في style.css · التباين AA · الخطوط 3 أوزان · لا Supabase ثابتة في القشرة. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const css = readFileSync(join(root, 'app/style.css'), 'utf8');
const lum = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const token = (name: string) => { const m = css.match(new RegExp(`--${name}:(#[0-9a-f]{6})`, 'i')); assert.ok(m, `token --${name}`); return m![1]; };

test('مفاتيح أَثَر: رموز اللون موجودة والتباين AA على الدرجات الثلاث', () => {
  const navy = token('navy-700');
  for (const g of ['gold-500', 'gold-600', 'gold-700']) assert.ok(contrast(token(g), navy) >= 4.5, `${g} vs navy ≥ 4.5`);
  assert.ok(contrast(navy, '#ffffff') >= 7, 'navy on white AAA');
  assert.ok(contrast(token('navy-800'), '#ffffff') >= 7, 'navy-800 on white');
});
test('مفاتيح أَثَر: الحالات الأربع + معطَّل + مشغول لكل فئات الأزرار', () => {
  for (const cls of ['pt-btn', 'am-btn', 'en-btn', 'mi-btn', 'mm-hbtn', 'bk-primary']) {
    assert.ok(css.includes(`.${cls}:hover`), `${cls} hover`); assert.ok(css.includes(`.${cls}:active`), `${cls} active`);
    assert.ok(css.includes(`.${cls}:focus-visible`), `${cls} focus`); assert.ok(css.includes(`.${cls}:disabled`), `${cls} disabled`); assert.ok(css.includes(`.${cls}[aria-busy="true"]`), `${cls} busy`);
  }
  assert.ok(/\.pt-btn\{[^}]*background:var\(--gold-500\)/.test(css), 'pt-btn أساسي ذهبي'); assert.ok(/\.pt-btn:hover\{[^}]*--gold-600/.test(css) && /\.pt-btn:active\{[^}]*--gold-700/.test(css), 'درجتان للتحويم والضغط');
  assert.ok(css.includes('.pt-btn>svg:first-child') && css.includes('--key-ring'), 'قرص الأيقونة وحلقة التركيز'); assert.ok(css.includes('prefers-reduced-motion'), 'reduced motion');
});
test('خِفّة أَثَر: 3 أوزان لخط البوابة · رقعة بوزن واحد · القشرة والجيب والتنقّل بلا استيراد ثابت لـ Supabase · واجهة /api/home مخزَّنة', () => {
  const layout = readFileSync(join(root, 'app/layout.tsx'), 'utf8'); assert.ok(layout.includes("weight: ['400', '700', '900']"), 'Tajawal 3 أوزان');
  const fonts = readFileSync(join(root, 'app/miaar/fonts.ts'), 'utf8'); assert.ok(fonts.includes("weight: ['400']") && fonts.includes("subsets: ['arabic']") && !fonts.includes('Tajawal('), 'رقعة واحدة بلا Tajawal ثانية');
  for (const f of ['app/components/PortalShell.tsx', 'app/components/GlobalNavigation.tsx', 'app/components/Pocket.tsx', 'app/page.tsx']) {
    const src = readFileSync(join(root, f), 'utf8'); assert.ok(!/^import \{ supabase \} from/m.test(src), `${f} بلا استيراد ثابت`); assert.ok(src.includes('hasStoredSession'), `${f} يفحص الجلسة المخزَّنة`);
  }
  for (const f of ['app/components/Athir.tsx', 'app/components/Inclusion.tsx', 'app/components/OnAir.tsx']) {
    const src = readFileSync(join(root, f), 'utf8'); assert.ok(!src.includes("lib/supabase/client'"), `${f} بلا استيراد ثابت`); assert.ok(src.includes('lazyToken'), `${f} يستخدم lazyToken`);
  }
  const home = readFileSync(join(root, 'app/api/home/route.ts'), 'utf8'); assert.ok(home.includes('s-maxage=60') && home.includes('stale-while-revalidate'), 'تخزين على الحافة');
  const page = readFileSync(join(root, 'app/page.tsx'), 'utf8'); assert.ok(page.includes("fetch('/api/home')") && !page.includes("fetch('/api/advisor').then") && !page.includes("fetch('/api/evidence?threads=1'"), 'نداء واحد');
  const pocket = readFileSync(join(root, 'app/components/Pocket.tsx'), 'utf8'); assert.equal((pocket.match(/if \(tok\) fetch\('\/api\/pocket'/g) || []).length, 2, 'لا نداء للجيب بلا رمز');
});
