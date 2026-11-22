// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «عائلة مناطق أَثَر» (هـ-3) — قوس واحد وجامور واحد لا يُمسّان، ولكلّ منطقة لونها وما يسكن قوسها.
 *  نسخة React من identity/tools/zones.py (viewBox 240 · القاعدة 192 · الجامور (120,70.6) · حجر الذروة (120,102)).
 *  · athar الأمّ · miaar سلّم داخل القوس · iqra السطر يخرج يسارًا · programs ثلاث درجات تتّسع تحت العتبة
 *  · org سقف وثلاث معيّنات · experts الخاتم الذهبي حول الحجر · staff العتبة الذهبية على القاعدة · pulse النبضة
 *  `light` للسطوح الداكنة (القوس عاجي، لون المنطقة الفاتح) · `mono` لون واحد. يعمل خادمًا وعميلًا (لا حالة).
 */
import type { CSSProperties } from 'react';

export type ZoneKey = 'athar' | 'miaar' | 'iqra' | 'programs' | 'org' | 'experts' | 'staff' | 'pulse';
const PLUM = '#3A1F36', IVORY = '#F6EBE0', GOLD = '#D9A866', CORAL = '#D4614A', CORAL_L = '#E8795C', PLUM_SOFT = '#6A3350', SAND = '#D9A866', SEA = '#5EA8A0';
const BASE = 192, EYE = 102.04, JAM = 70.62;

/** لون كلّ منطقة (على الفاتح / على الداكن) واسمها */
export const ZONE_FAMILY: Record<ZoneKey, { name_ar: string; tone: string; tone_dark: string; verb_ar: string }> = {
  athar: { name_ar: 'أَثَر', tone: CORAL, tone_dark: CORAL_L, verb_ar: 'الأمّ — البوّابة' },
  miaar: { name_ar: 'مِعيار', tone: CORAL, tone_dark: CORAL_L, verb_ar: 'يَقيس' },
  iqra: { name_ar: 'اقْرَأْ', tone: CORAL, tone_dark: CORAL_L, verb_ar: 'يُدرِّج' },
  programs: { name_ar: 'البرامج', tone: CORAL, tone_dark: CORAL_L, verb_ar: 'يَبني' },
  org: { name_ar: 'الجهات', tone: PLUM_SOFT, tone_dark: '#B07A9A', verb_ar: 'تَرى' },
  experts: { name_ar: 'هيئة أَثَر الاستشارية', tone: SAND, tone_dark: SAND, verb_ar: 'يُوثِّق' },
  staff: { name_ar: 'الطاقم', tone: SAND, tone_dark: SAND, verb_ar: 'يُدير' },
  pulse: { name_ar: 'نبض أَثَر', tone: SEA, tone_dark: '#8FD0C8', verb_ar: 'يَنبِض' },
};
/** أسماء مناطق البوّابة الأخرى (أبواب هـ-2 · الحزام · الغرف) → مفتاح العلامة */
const ALIAS: Record<string, ZoneKey> = { portal: 'athar', trainers: 'experts', directory: 'experts', admin: 'staff', dashboard: 'staff', news: 'pulse', belt: 'pulse' };
export const zoneKeyOf = (z: string | null | undefined): ZoneKey => (z && z in ZONE_FAMILY ? (z as ZoneKey) : ALIAS[z || ''] || 'athar');

const D = (cx: number, cy: number, s: number, fill: string, key: string) => <rect key={key} x={cx - s / 2} y={cy - s / 2} width={s} height={s} rx={s * 0.14} transform={`rotate(45 ${cx} ${cy})`} fill={fill} />;
const R = (x: number, y: number, w: number, h: number, fill: string, key: string) => <rect key={key} x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} />;

function motif(zone: ZoneKey, tone: string, gold: string) {
  switch (zone) {
    case 'miaar': return [D(120, 172, 6, tone, 'a'), D(120, 150, 8, tone, 'b'), D(120, 124, 10, tone, 'c')];
    case 'iqra': return [D(120, EYE, 9, tone, 'e'), D(48, 186, 6, tone, 'a'), D(30, 186, 8, tone, 'b'), D(10, 186, 10, tone, 'c')];
    case 'programs': return [D(120, EYE, 9, tone, 'e'), ...[14, 26, 38].map((w, i) => R(120 - w / 2, BASE + 9 + i * 8, w, 4.5, tone, `s${i}`))];
    case 'org': return [D(120, EYE, 9, tone, 'e'), R(97, BASE + 9, 46, 4.5, tone, 'roof'), ...[0, 1, 2].map((i) => D(120 - 17 + i * 17, BASE + 24, 6, tone, `p${i}`))];
    case 'experts': { const y = EYE + 10; return [<path key="ring" d={`M120 ${y - 22} L142 ${y} L120 ${y + 22} L98 ${y} Z M120 ${y - 15} L105 ${y} L120 ${y + 15} L135 ${y} Z`} fill={gold} fillRule="evenodd" />, D(120, y, 8, tone, 'e')]; }
    case 'staff': return [D(120, EYE, 9, tone, 'e'), D(120, 148, 7, tone, 'f'), R(104, BASE - 14, 32, 6, gold, 'sill')];
    case 'pulse': return [D(120, EYE, 9, tone, 'e'), D(96, BASE + 16, 5, tone, 'a'), D(120, BASE + 16, 9, tone, 'b'), D(144, BASE + 16, 5, tone, 'c')];
    default: return [D(120, EYE, 9, tone, 'e')];
  }
}

export function ZoneMark({ zone, size = 36, light = false, mono = false, title, style }: { zone: string; size?: number; light?: boolean; mono?: boolean; title?: string; style?: CSSProperties }) {
  const k = zoneKeyOf(zone); const f = ZONE_FAMILY[k];
  const ink = mono ? (light ? IVORY : PLUM) : light ? IVORY : PLUM;
  const tone = mono ? ink : light ? f.tone_dark : f.tone;
  const gold = mono ? ink : GOLD;
  /* الأفق: الأمّ تقف على القاعدة 192؛ المناطق التي تسكن تحت العتبة تحتاج هامشًا سفليًا — نعرض 0..240 دائمًا لثبات المقاس */
  return (
    <svg width={size} height={size} viewBox="0 30 240 210" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} style={{ overflow: 'visible', flexShrink: 0, ...style }} data-zone-mark={k}>
      <path d="M72.0 192 A129.6 129.6 0 0 1 120.0 71.6 A129.6 129.6 0 0 1 168.0 192 L153.0 192 A114.6 114.6 0 0 0 120.0 87.9 A114.6 114.6 0 0 0 87.0 192 Z" fill={ink} />
      <path d="M72.0 74.9 A129.6 129.6 0 0 1 146.0 192 L131.0 192 A114.6 114.6 0 0 0 16.4 74.9 Z" fill={tone} />
      <path d="M168.0 74.9 A129.6 129.6 0 0 0 94.0 192 L109.0 192 A114.6 114.6 0 0 1 223.6 74.9 Z" fill={tone} />
      {D(120, JAM, 15, gold, 'jam')}
      {motif(k, tone, gold)}
    </svg>
  );
}
export default ZoneMark;
