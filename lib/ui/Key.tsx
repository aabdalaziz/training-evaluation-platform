// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «مفاتيح أَثَر» (P40) — مكوّن الزر الموحّد؛ الأيقونات من مكتبة المنصة القائمة lib/ui/icons.tsx (أُضيفت إليها upload/qr/next/mic/camera/spark/spinner).
 *  <Key icon="plus" tone="gold" onClick=…>إضافة بند</Key>   → زر .pt-btn بأيقونة في قرص (الأنماط في app/style.css)
 *  <Key href="/miaar" icon="play">حدّد مستواك</Key>         → رابط بنفس الهيئة
 *  <Icon name="save" />                                      → الأيقونة وحدها (20px، تأخذ لون النص)
 *  الدرجات: gold (أساسي، افتراضي) · navy (ثانوي) · ghost (هادئ) · teal · light · outline. الحجم: small.
 *  الحالات تأتي من CSS: تحويم 600 · ضغط 700 + ظلّ داخلي · تركيز حلقة تيل · disabled · busy (الأيقونة تدور).
 */
import Link from 'next/link';
import type { ReactNode, ButtonHTMLAttributes } from 'react';

import { Icon, type IconName } from './icons';
export { Icon };
export type { IconName };

type Tone = 'gold' | 'navy' | 'ghost' | 'teal' | 'light' | 'outline';
type KeyProps = {
  icon?: IconName; tone?: Tone; small?: boolean; busy?: boolean; href?: string; className?: string; children: ReactNode; testId?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

export default function Key({ icon, tone = 'gold', small, busy, href, className = '', children, testId, type = 'button', disabled, ...rest }: KeyProps) {
  const cls = `pt-btn ${tone !== 'gold' ? tone : ''} ${small ? 'small' : ''} ${className}`.replace(/\s+/g, ' ').trim();
  const body = <>{busy ? <Icon name="spinner" /> : icon ? <Icon name={icon} /> : null}<span>{children}</span></>;
  if (href) return <Link href={href} className={cls} aria-busy={busy || undefined} data-testid={testId}>{body}</Link>;
  return <button type={type} className={cls} aria-busy={busy || undefined} disabled={disabled || busy} data-testid={testId} {...rest}>{body}</button>;
}
