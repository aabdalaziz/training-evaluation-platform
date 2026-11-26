'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P85 */
/**
 * رسوم SVG نقيّة بالهوية (بلا مكتبات): رادار · أعمدة بفاصل ثقة · توزيع مكدّس · خطّ زمني بنطاق ثقة · مصفوفة أهمّية/أداء · خريطة حرارية · دونات
 *  <Chart spec={…} />  يختار الرسم من spec.chart. كلّ رسم يحمل role="img" وaria-label ويُطبع كما يظهر. svgToPng() لتضمينه في Word/PowerPoint.
 */
import type { ChartSpec, Heat, Driver, DayPoint } from '../../../lib/reports/insight';
import { QUADRANT_AR } from '../../../lib/reports/insight';
import { TARGET } from '../../../lib/reports/analytics';

export const PALETTE = { night: '#22101F', plum: '#3A1F36', coral: '#D4614A', coral2: '#E8795C', gold: '#D9A866', gold2: '#F1D9A8', ivory: '#F6EBE0', surface: '#FBF4EE', sea: '#5EA8A0', muted: '#8a7580', grid: '#EADFD6' };
const DIST = ['#b3261e', '#e8795c', '#D9A866', '#8fc4bd', '#2e7d6f'];
const FONT = 'Tahoma, Arial, sans-serif';
const tone = (m: number) => (m >= TARGET ? PALETTE.sea : m >= 3.7 ? PALETTE.gold : m >= 3 ? PALETTE.coral2 : '#b3261e');
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function Chart({ spec, width = 720 }: { spec: ChartSpec; width?: number }) {
  switch (spec.chart) {
    case 'radar': return <Radar title={spec.title} data={spec.data} width={width} />;
    case 'bars': return <Bars title={spec.title} data={spec.data} width={width} />;
    case 'dist': return <Dist title={spec.title} data={spec.data} width={width} />;
    case 'line': return <Line title={spec.title} data={spec.data} width={width} />;
    case 'quadrant': return <Quadrant title={spec.title} data={spec.data} width={width} />;
    case 'heat': return <HeatMap title={spec.title} data={spec.data} width={width} />;
    case 'donut': return <Donut title={spec.title} data={spec.data} width={width} />;
    default: return null;
  }
}
const Frame = ({ w, h, title, label, children }: { w: number; h: number; title: string; label: string; children: React.ReactNode }) => (
  <svg className="ch" viewBox={`0 0 ${w} ${h}`} width="100%" direction="ltr" style={{ maxWidth: w, display: 'block', fontFamily: FONT, direction: 'ltr' /* الإحداثيات هندسية؛ النصّ العربي يُشكَّل بذاته */ }} role="img" aria-label={label} data-chart={title}>
    <rect x={0} y={0} width={w} height={h} fill="#fff" rx={12} />
    <text x={w / 2} y={22} textAnchor="middle" fontSize={14} fontWeight={800} fill={PALETTE.plum}>{title}</text>
    {children}
  </svg>
);

export function Radar({ title, data, width }: { title: string; data: { label: string; value: number; n: number }[]; width: number }) {
  const w = Math.min(width, 520), h = w * 0.82, cx = w / 2, cy = h / 2 + 10, R = Math.min(w, h) * 0.33; const n = Math.max(3, data.length);
  const pt = (i: number, v: number) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; const r = (R * v) / 5; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const; };
  const poly = (v: number) => data.map((_, i) => pt(i, v).join(',')).join(' ');
  const vals = data.map((d, i) => pt(i, d.value).join(',')).join(' ');
  return <Frame w={w} h={h} title={title} label={`رادار المحاور: ${data.map((d) => `${d.label} ${d.value}`).join('، ')}`}>
    {[1, 2, 3, 4, 5].map((v) => <polygon key={v} points={poly(v)} fill={v === 5 ? PALETTE.surface : 'none'} stroke={PALETTE.grid} strokeWidth={1} />)}
    <polygon points={poly(TARGET)} fill="none" stroke={PALETTE.gold} strokeDasharray="4 3" strokeWidth={1.5} />
    {data.map((_, i) => { const [x, y] = pt(i, 5); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={PALETTE.grid} />; })}
    {data.length >= 3 && <polygon points={vals} fill="rgba(94,168,160,.35)" stroke={PALETTE.sea} strokeWidth={2.5} />}
    {data.map((d, i) => { const [x, y] = pt(i, d.value); const [lx, ly] = pt(i, 6.1); return <g key={i}><circle cx={x} cy={y} r={4} fill={tone(d.value)} stroke="#fff" strokeWidth={1.5} /><text x={lx} y={ly} textAnchor="middle" fontSize={11} fontWeight={700} fill={PALETTE.plum}>{trunc(d.label, 18)}</text><text x={lx} y={ly + 13} textAnchor="middle" fontSize={11} fill={tone(d.value)} fontWeight={800}>{d.value.toFixed(2)}</text></g>; })}
    <text x={w - 8} y={h - 8} textAnchor="end" fontSize={10} fill={PALETTE.muted}>— — المستهدف {TARGET}</text>
  </Frame>;
}

export function Bars({ title, data, width }: { title: string; data: { label: string; value: number; lo: number; hi: number; n: number }[]; width: number }) {
  const w = width, rowH = 30, padL = 190, padR = 95, h = 40 + data.length * rowH + 20; const x = (v: number) => padL + ((Math.max(1, Math.min(5, v)) - 1) / 4) * (w - padL - padR);
  return <Frame w={w} h={h} title={title} label={`أعمدة: ${data.map((d) => `${d.label} ${d.value}`).join('، ')}`}>
    {[1, 2, 3, 4, 5].map((v) => <g key={v}><line x1={x(v)} y1={34} x2={x(v)} y2={h - 18} stroke={PALETTE.grid} /><text x={x(v)} y={h - 6} textAnchor="middle" fontSize={10} fill={PALETTE.muted}>{v}</text></g>)}
    <line x1={x(TARGET)} y1={34} x2={x(TARGET)} y2={h - 18} stroke={PALETTE.gold} strokeDasharray="4 3" strokeWidth={1.5} />
    {data.map((d, i) => { const y = 42 + i * rowH; return <g key={i}><text x={padL - 8} y={y + 14} textAnchor="end" fontSize={12} fontWeight={700} fill={PALETTE.plum}>{trunc(d.label, 26)}</text><rect x={x(1)} y={y + 3} width={Math.max(2, x(d.value) - x(1))} height={16} rx={6} fill={tone(d.value)} opacity={0.9} /><line x1={x(d.lo)} y1={y + 11} x2={x(d.hi)} y2={y + 11} stroke={PALETTE.night} strokeWidth={2} /><line x1={x(d.lo)} y1={y + 6} x2={x(d.lo)} y2={y + 16} stroke={PALETTE.night} strokeWidth={2} /><line x1={x(d.hi)} y1={y + 6} x2={x(d.hi)} y2={y + 16} stroke={PALETTE.night} strokeWidth={2} /><text x={w - padR + 6} y={y + 14} fontSize={12} fontWeight={800} fill={tone(d.value)}>{d.value.toFixed(2)}</text><text x={w - padR + 40} y={y + 14} fontSize={10} fill={PALETTE.muted}>n={d.n}</text></g>; })}
  </Frame>;
}

export function Dist({ title, data, width }: { title: string; data: { label: string; dist: number[]; mean: number; n: number }[]; width: number }) {
  const w = width, rowH = 26, padL = 230, padR = 70, h = 40 + data.length * rowH + 30; const bw = w - padL - padR;
  return <Frame w={w} h={h} title={title} label={`توزيع الإجابات لكلّ بند (1 إلى 5)`}>
    {data.map((d, i) => { const y = 40 + i * rowH; const t = d.dist.reduce((a, b) => a + b, 0) || 1; let acc = 0; return <g key={i}><text x={padL - 8} y={y + 13} textAnchor="end" fontSize={11.5} fontWeight={700} fill={PALETTE.plum}>{trunc(d.label, 32)}</text>{d.dist.map((v, j) => { const x0 = padL + (acc / t) * bw; const ww = (v / t) * bw; acc += v; return v ? <g key={j}><rect x={x0} y={y + 2} width={ww} height={17} fill={DIST[j]} />{ww > 22 && <text x={x0 + ww / 2} y={y + 14} textAnchor="middle" fontSize={10} fontWeight={800} fill="#fff">{v}</text>}</g> : null; })}<text x={w - padR + 6} y={y + 14} fontSize={12} fontWeight={800} fill={tone(d.mean)}>{d.mean.toFixed(2)}</text><text x={w - padR + 42} y={y + 14} fontSize={10} fill={PALETTE.muted}>n={d.n}</text></g>; })}
    {DIST.map((c, j) => <g key={j}><rect x={padL + j * 54} y={h - 18} width={12} height={12} fill={c} rx={2} /><text x={padL + j * 54 + 16} y={h - 8} fontSize={10} fill={PALETTE.muted}>{j + 1}</text></g>)}
  </Frame>;
}

export function Line({ title, data, width }: { title: string; data: DayPoint[]; width: number }) {
  const w = width, h = 260, padL = 46, padR = 28, padT = 36, padB = 44; const n = data.length; const x = (i: number) => padL + (n > 1 ? (i / (n - 1)) * (w - padL - padR) : (w - padL - padR) / 2); const y = (v: number) => padT + (1 - (Math.max(1, Math.min(5, v)) - 1) / 4) * (h - padT - padB);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.mean)}`).join(' '); const band = `${data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.hi)}`).join(' ')} ${[...data].reverse().map((d, i) => `L${x(n - 1 - i)},${y(d.lo)}`).join(' ')} Z`;
  return <Frame w={w} h={h} title={title} label={`الاتجاه اليومي: ${data.map((d) => `${d.date} ${d.mean}`).join('، ')}`}>
    {[1, 2, 3, 4, 5].map((v) => <g key={v}><line x1={padL} y1={y(v)} x2={w - padR} y2={y(v)} stroke={PALETTE.grid} /><text x={padL - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill={PALETTE.muted}>{v}</text></g>)}
    <line x1={padL} y1={y(TARGET)} x2={w - padR} y2={y(TARGET)} stroke={PALETTE.gold} strokeDasharray="4 3" strokeWidth={1.5} />
    {n > 1 && <path d={band} fill="rgba(94,168,160,.18)" />}<path d={path} fill="none" stroke={PALETTE.sea} strokeWidth={2.5} />
    {data.map((d, i) => <g key={i}><circle cx={x(i)} cy={y(d.mean)} r={d.z <= -1.5 ? 6 : 4} fill={d.z <= -1.5 ? '#b3261e' : tone(d.mean)} stroke="#fff" strokeWidth={1.5} /><text x={x(i)} y={y(d.mean) - 9} textAnchor="middle" fontSize={10} fontWeight={800} fill={PALETTE.plum}>{d.mean.toFixed(2)}</text>{(n <= 12 || i % Math.ceil(n / 12) === 0) && <text x={x(i)} y={h - padB + 16} textAnchor="middle" fontSize={10} fill={PALETTE.muted}>{d.date.slice(5)}</text>}<text x={x(i)} y={h - padB + 28} textAnchor="middle" fontSize={9} fill={PALETTE.muted}>n={d.n}</text></g>)}
  </Frame>;
}

/** تسميات بلا تصادم: الأهمّ أوّلًا (أصلِح أوّلًا > حافِظ > البقيّة)، ثمّ تُزاح عموديًّا أو تُحذف إن ضاق المكان؛ الحدّ الأقصى 12 تسمية */
function placeLabels(items: { x: number; y: number; text: string; key: number }[], w: number, padL: number, padR: number, padT: number): { x: number; y: number; text: string }[] {
  const placed: { x: number; y: number; text: string; hw: number }[] = []; const sorted = [...items].sort((a, b) => b.key - a.key).slice(0, 12);
  for (const it of sorted) { const hw = Math.min(70, it.text.length * 2.8); let x = Math.max(padL + hw, Math.min(w - padR - hw, it.x)); let y = it.y; let ok = false;
    const cands = [0, -12, 24, -24, 36, -36].map((dy) => it.y + dy).filter((yy) => yy >= padT + 10); for (const yy of cands) { y = yy; ok = !placed.some((p) => Math.abs(p.y - y) < 11 && Math.abs(p.x - x) < p.hw + hw); if (ok) break; }
    if (ok) placed.push({ x, y, text: it.text, hw }); }
  return placed;
}
export function Quadrant({ title, data, width }: { title: string; data: Driver[]; width: number }) {
  const w = Math.min(width, 640), h = 420, padL = 50, padR = 20, padT = 36, padB = 46; const rs = data.map((d) => d.r), ms = data.map((d) => d.mean);
  const rMin = Math.min(-0.1, ...rs) - 0.05, rMax = Math.max(0.6, ...rs) + 0.12; const mMin = Math.max(1, Math.min(...ms) - 0.3), mMax = Math.min(5, Math.max(...ms) + 0.3);
  const med = (xs: number[]) => { const a = [...xs].sort((p, q) => p - q); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  const x = (m: number) => padL + ((m - mMin) / (mMax - mMin || 1)) * (w - padL - padR); const y = (r: number) => padT + (1 - (r - rMin) / (rMax - rMin || 1)) * (h - padT - padB);
  const mx = x(med(ms)), my = y(med(rs)); const col: Record<Driver['quadrant'], string> = { fix_first: '#b3261e', keep: PALETTE.sea, low_priority: PALETTE.muted, overkill: PALETTE.gold };
  return <Frame w={w} h={h} title={title} label={`مصفوفة الأهمّية/الأداء: ${data.map((d) => `${d.label} (${QUADRANT_AR[d.quadrant]})`).join('، ')}`}>
    <rect x={padL} y={padT} width={mx - padL} height={my - padT} fill="rgba(179,38,30,.07)" /><rect x={mx} y={padT} width={w - padR - mx} height={my - padT} fill="rgba(94,168,160,.10)" />
    <line x1={mx} y1={padT} x2={mx} y2={h - padB} stroke={PALETTE.plum} strokeDasharray="4 3" /><line x1={padL} y1={my} x2={w - padR} y2={my} stroke={PALETTE.plum} strokeDasharray="4 3" />
    <text x={padL + 6} y={padT + 14} fontSize={11} fontWeight={800} fill="#b3261e">أصلِح أوّلًا</text><text x={w - padR - 6} y={padT + 14} textAnchor="end" fontSize={11} fontWeight={800} fill={PALETTE.sea}>حافِظ عليه</text><text x={padL + 6} y={h - padB - 6} fontSize={11} fontWeight={800} fill={PALETTE.muted}>أولوية دنيا</text><text x={w - padR - 6} y={h - padB - 6} textAnchor="end" fontSize={11} fontWeight={800} fill={PALETTE.gold}>فائض جهد</text>
    {data.map((d, i) => <circle key={i} cx={x(d.mean)} cy={y(d.r)} r={5 + Math.min(6, d.n / 20)} fill={col[d.quadrant]} opacity={0.85} stroke="#fff" strokeWidth={1.5}><title>{`${d.label} · r=${d.r} · م=${d.mean}`}</title></circle>)}
    {placeLabels(data.map((d) => ({ x: x(d.mean), y: y(d.r) - 10, text: trunc(d.label, 22), key: d.quadrant === 'fix_first' ? 2 : d.quadrant === 'keep' ? 1 : 0 })), w, padL, padR, padT).map((l, i) => <text key={i} x={l.x} y={l.y} textAnchor="middle" fontSize={10} fontWeight={700} fill={PALETTE.plum}>{l.text}</text>)}
    <text x={w / 2} y={h - 8} textAnchor="middle" fontSize={11} fill={PALETTE.muted}>الأداء (المتوسّط) ←</text><text x={14} y={(h - padB + padT) / 2} textAnchor="middle" fontSize={11} fill={PALETTE.muted} transform={`rotate(-90 14 ${(h - padB + padT) / 2})`}>الأهمّية (الارتباط بالرضا) ↑</text>
  </Frame>;
}

export function HeatMap({ title, data, width }: { title: string; data: Heat; width: number }) {
  const padL = 150, cellW = Math.max(40, Math.min(90, (width - padL - 20) / Math.max(1, data.cols.length))), cellH = 30; const w = padL + cellW * data.cols.length + 20, h = 60 + cellH * data.rows.length + 10;
  const color = (v: number | null) => (v == null ? '#f3eee9' : v >= 4.5 ? '#2e7d6f' : v >= TARGET ? '#8fc4bd' : v >= 3.7 ? '#F1D9A8' : v >= 3 ? '#e8795c' : '#b3261e');
  return <Frame w={w} h={h} title={title} label={`خريطة حرارية ${data.rows.length}×${data.cols.length}`}>
    {data.cols.map((c, j) => <text key={j} x={padL + j * cellW + cellW / 2} y={48} textAnchor="middle" fontSize={10} fill={PALETTE.muted}>{trunc(String(c).replace(/^\d{4}-/, ''), 10)}</text>)}
    {data.rows.map((r, i) => <g key={i}><text x={padL - 8} y={60 + i * cellH + 19} textAnchor="end" fontSize={11.5} fontWeight={700} fill={PALETTE.plum}>{trunc(r, 20)}</text>{data.cols.map((_, j) => { const v = data.cells[i][j]; return <g key={j}><rect x={padL + j * cellW + 2} y={60 + i * cellH + 2} width={cellW - 4} height={cellH - 4} rx={5} fill={color(v)} /><text x={padL + j * cellW + cellW / 2} y={60 + i * cellH + 19} textAnchor="middle" fontSize={11} fontWeight={800} fill={v != null && (v >= 4.5 || v < 3) ? '#fff' : PALETTE.night}>{v == null ? '·' : v.toFixed(1)}</text></g>; })}</g>)}
  </Frame>;
}

export function Donut({ title, data, width }: { title: string; data: { label: string; value: number; negative?: number; positive?: number }[]; width: number }) {
  const w = Math.min(width, 560), h = 260, cx = 150, cy = 140, R = 90, r = 55; const total = data.reduce((a, d) => a + d.value, 0) || 1; const cols = [PALETTE.plum, PALETTE.coral, PALETTE.gold, PALETTE.sea, '#8E4A68', '#2F6B66', '#B3A5AE', '#E8795C', '#5C4858', '#F1D9A8', '#1F4F4A', '#D9CBC2'];
  let a0 = -Math.PI / 2; const arcs = data.map((d, i) => { const a1 = a0 + (2 * Math.PI * d.value) / total; const large = a1 - a0 > Math.PI ? 1 : 0; const p = (a: number, rr: number) => `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`; const path = `M${p(a0, R)} A${R},${R} 0 ${large} 1 ${p(a1, R)} L${p(a1, r)} A${r},${r} 0 ${large} 0 ${p(a0, r)} Z`; a0 = a1; return { path, color: cols[i % cols.length], d }; });
  return <Frame w={w} h={h} title={title} label={`دونات: ${data.map((d) => `${d.label} ${d.value}`).join('، ')}`}>
    {arcs.map((a, i) => <path key={i} d={a.path} fill={a.color} stroke="#fff" strokeWidth={1.5} />)}
    <text x={cx} y={cy + 5} textAnchor="middle" fontSize={18} fontWeight={900} fill={PALETTE.plum}>{total}</text>
    {arcs.slice(0, 10).map((a, i) => <g key={i}><rect x={280} y={44 + i * 20} width={12} height={12} rx={3} fill={a.color} /><text x={298} y={54 + i * 20} fontSize={11} fill={PALETTE.plum}>{trunc(a.d.label, 20)} <tspan fill={PALETTE.muted}>{a.d.value} ({Math.round((a.d.value / total) * 100)}%)</tspan>{a.d.negative ? <tspan fill="#b3261e"> · {a.d.negative} سلبي</tspan> : null}</text></g>)}
  </Frame>;
}

/** تحويل SVG إلى PNG (لـWord/PowerPoint): يُسلسل العنصر ويرسمه على Canvas بمقياس 2×. */
export async function svgToPng(svg: SVGSVGElement, scale = 2): Promise<{ png: Uint8Array; w: number; h: number }> {
  const vb = svg.viewBox.baseVal; const w = Math.round(vb.width || svg.clientWidth || 720), h = Math.round(vb.height || svg.clientHeight || 400);
  const clone = svg.cloneNode(true) as SVGSVGElement; clone.setAttribute('width', String(w)); clone.setAttribute('height', String(h)); clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const xml = new XMLSerializer().serializeToString(clone); const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try { const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('svg')); i.src = url; });
    const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale; const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png')); const buf = new Uint8Array(await (blob as Blob).arrayBuffer()); return { png: buf, w, h }; } finally { URL.revokeObjectURL(url); }
}
