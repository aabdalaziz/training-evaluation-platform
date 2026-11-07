'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P58 — «كوكبة» خريطة الأثر: SVG مضمَّن بلا مكتبات
 *  • النجوم = محطات (حجمها يكبر مع عدد الخيوط المبقاة الملامسة لها) · الخيط المبقى خطّ متصل يغلظ مع التفرّع · المقترَح منقَّط
 *  • الزمن يجري من اليمين إلى اليسار (RTL) · المسارات بحسب نوع المحطة · بلا أسماء أشخاص
 *  • يُستخدم في صفحة المتعلّم (تفاعلي) وفي صفحة التحقّق العامة (قراءة فقط)
 */
import type { CSSProperties } from 'react';
import type { Station, Thread, MapLayout, StationKind, RuleKey } from '../../lib/map/registry';
import { KIND_AR, degree, strokeOf } from '../../lib/map/registry';

export const KIND_COLOR: Record<StationKind, string> = { placement: '#64748b', program: '#0f2a4e', session: '#2563eb', skill: '#0e7490', credential: '#b45309', badge: '#b45309', daily: '#7c3aed', mission: '#15803d', simulation: '#2563eb', council: '#9d174d', case: '#9d174d', horizon: '#ea580c', hand: '#7c3aed' };
type Light = { key: string; kind: StationKind; at: string; title_ar: string };
export type SvgThread = Pick<Thread, 'from' | 'to' | 'status' | 'rule'> & { note_ar?: string | null };
type Props = { stations: (Station | Light)[]; threads: SvgThread[]; layout: MapLayout; selected?: string | null; focus?: string | null; onStation?: (key: string) => void; onThread?: (t: SvgThread) => void; title_ar?: string; rules?: Record<RuleKey, { title: string }>; style?: CSSProperties; testid?: string; compact?: boolean;
  /* P59 — الوضع المجمَّع (نسيج الشعبة): سماكة الخيط بعدد ناسجيه · حجم النجمة بعدد من بلغوها · نجمة الشعبة · عناوين دليل مختلفة */
  weights?: Record<string, number>; counts?: Record<string, number>; star?: string | null; legend?: { kept: string; proposed: string } };

const fmt = (iso: string) => { try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso.slice(0, 10); } };
const titleOf = (s: Station | Light) => ('public_ar' in s ? s.title_ar : s.title_ar);

export function AtharMapSvg({ stations, threads, layout, selected, focus, onStation, onThread, title_ar, rules, style, testid = 'am-svg', compact, weights, counts, star, legend }: Props) {
  const deg = degree({ threads: threads as Thread[] }); const pos = layout.pos; const byKey = new Map(stations.map((s) => [s.key, s])); const agg = !!(weights || counts);
  const r = (k: string) => (counts ? 5 + Math.min(11, 1.6 * Math.sqrt(counts[k] || 1)) : 5 + Math.min(9, 2.2 * (deg[k] || 0)));
  const wOf = (t: SvgThread) => (weights ? (t.status === 'kept' ? Math.min(8, 1.5 + 0.55 * (weights[`${t.from}>${t.to}`] || 1)) : 1.2) : strokeOf(t as Thread, deg));
  const isStar = (t: SvgThread) => !!star && `${t.from}>${t.to}` === star;
  const dim = (k: string) => (focus ? !(focus === k || threads.some((t) => t.status === 'kept' && ((t.from === focus && t.to === k) || (t.to === focus && t.from === k)))) : false);
  const kinds = Array.from(new Set(stations.map((s) => s.kind)));
  return (
    <figure style={{ margin: 0, ...style }} data-testid={testid}>
      <svg viewBox={`0 0 ${layout.w} ${layout.h}`} width="100%" role="img" aria-label={title_ar || 'خريطة الأثر'} style={{ display: 'block', background: 'radial-gradient(ellipse at 70% 20%, #0f2a4e 0%, #0b1b33 55%, #070f1f 100%)', borderRadius: 18 }}>
        <title>{title_ar || 'خريطة الأثر'}</title>
        <defs><filter id="am-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        {/* نجوم خلفية هادئة */}
        {Array.from({ length: 36 }).map((_, i) => <circle key={`bg${i}`} cx={(i * 173) % layout.w} cy={(i * 97 + 13) % layout.h} r={(i % 3) * 0.4 + 0.4} fill="#cbd5e1" opacity={0.25 + (i % 4) * 0.1} />)}
        {/* الخيوط */}
        {threads.map((t) => { const a = pos[t.from]; const b = pos[t.to]; if (!a || !b) return null; const kept = t.status === 'kept'; const w = wOf(t); const st = isStar(t); const faded = focus ? !(t.from === focus || t.to === focus) : false; const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2 - Math.min(60, Math.abs(a.x - b.x) * 0.18);
          const d = `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`; const label = (rules?.[t.rule]?.title || '') + (t.note_ar ? ` — لأن ${t.note_ar}` : '') + (weights && kept ? ` — نسجه ${weights[`${t.from}>${t.to}`] || 0}` : '') + (st ? ' — نجمة الشعبة' : '');
          return <g key={`${t.from}>${t.to}`} opacity={faded ? 0.18 : 1} style={{ cursor: onThread ? 'pointer' : 'default' }} onClick={() => onThread?.(t)} data-testid={kept ? 'am-thread-kept' : 'am-thread-proposed'}>
            <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
            {st && <path d={d} fill="none" stroke="#fde68a" strokeWidth={w + 8} strokeLinecap="round" opacity={0.28} filter="url(#am-glow)" data-testid="am-star" />}
            <path d={d} fill="none" stroke={kept ? (st ? '#fde68a' : '#fbbf24') : '#94a3b8'} strokeWidth={w} strokeDasharray={kept ? undefined : '3 5'} strokeLinecap="round" opacity={kept ? 0.95 : 0.7}>{label && <title>{label}</title>}</path>
          </g>; })}
        {/* المحطات */}
        {stations.map((s) => { const p = pos[s.key]; if (!p) return null; const sel = selected === s.key; const c = KIND_COLOR[s.kind]; const rr = r(s.key);
          return <g key={s.key} transform={`translate(${p.x},${p.y})`} opacity={dim(s.key) ? 0.25 : 1} style={{ cursor: onStation ? 'pointer' : 'default' }} onClick={() => onStation?.(s.key)} tabIndex={onStation ? 0 : -1} role={onStation ? 'button' : undefined} aria-label={`${KIND_AR[s.kind]}: ${titleOf(s)} — ${fmt(s.at)}`} onKeyDown={(e) => { if (onStation && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onStation(s.key); } }} data-testid="am-station" data-kind={s.kind}>
            <circle r={rr + 5} fill={c} opacity={sel ? 0.45 : 0.18} />
            <circle r={rr} fill={sel ? '#fff7ed' : '#fff'} stroke={c} strokeWidth={sel ? 3 : 2} filter="url(#am-glow)" />
            <title>{`${KIND_AR[s.kind]}: ${titleOf(s)}${counts ? ` — بلغها ${counts[s.key] || 0}` : ` — ${fmt(s.at)}`}`}</title>
            {!compact && (agg || (deg[s.key] || 0) > 0) && <text y={-rr - 7} textAnchor="middle" fontSize={10} fill="#e2e8f0" fontFamily="Tajawal, Arial, sans-serif">{(titleOf(s).length > 22 ? titleOf(s).slice(0, 21) + '…' : titleOf(s)) + (counts ? ` ×${counts[s.key] || 0}` : '')}</text>}
          </g>; })}
        {/* محور الزمن */}
        {stations.length > 1 && <>
          <text x={layout.w - 14} y={layout.h - 10} textAnchor="end" fontSize={10} fill="#94a3b8" fontFamily="Tajawal, Arial, sans-serif">{fmt(stations[0].at)} ←</text>
          <text x={14} y={layout.h - 10} textAnchor="start" fontSize={10} fill="#94a3b8" fontFamily="Tajawal, Arial, sans-serif">→ {fmt(stations[stations.length - 1].at)}</text>
        </>}
      </svg>
      {!compact && <figcaption style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', padding: '8px 4px', fontSize: 12, color: '#475569' }} aria-hidden="true">
        {kinds.map((k) => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 99, background: KIND_COLOR[k], display: 'inline-block' }} />{KIND_AR[k]}</span>)}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 22, height: 0, borderTop: '2px solid #d97706', display: 'inline-block' }} />{legend?.kept || 'خيط أبقيتَه'}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 22, height: 0, borderTop: '2px dotted #64748b', display: 'inline-block' }} />{legend?.proposed || 'خيط ينتظر كلمتك'}</span>
        {star && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 22, height: 0, borderTop: '4px solid #fde68a', display: 'inline-block' }} />نجمة الشعبة</span>}
      </figcaption>}
    </figure>
  );
}
