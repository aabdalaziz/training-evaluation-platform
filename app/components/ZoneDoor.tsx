'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «باب المنطقة» (هـ-2) — ترويسة الهوية v1.2 لمناطق البوّابة: الجهات · الخبراء (وقابلة لأيّ منطقة)
 *  · أفق الأثر خلف العنوان · شريط مسار · عنوان بكلمة ذهبية · سطر وعد · ثلاثة وعود بأيقونات (Reveal متتابع) · خانة جانبية (دخول/طلب)
 *  · لون المنطقة من --zone-echo (org برقوقي ناعم · experts ذهبي) · compact للصفحات الداخلية بعد الدخول
 */
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { Horizon, Reveal, ArcDivider, Echo } from '../../lib/ui/motion';
import { Icon } from '../../lib/ui/icons';
import type { IconName } from '../../lib/ui/icons';

export type Promise_ = { icon: IconName; title: string; body: string; href?: string };
export const ZONE_TONE: Record<string, { echo: string; grad: string; word: string }> = {
  org: { echo: '#6A3350', grad: 'linear-gradient(135deg,#22101F,#3A1F36 55%,#5a2d4a)', word: '#9FD8D1' },
  experts: { echo: '#D9A866', grad: 'linear-gradient(135deg,#3A1F36,#6A3350 55%,#8E4A68)', word: '#F6D9A8' },
  trainers: { echo: '#E8795C', grad: 'linear-gradient(135deg,#3A1F36,#6A3350 55%,#8E4A68)', word: '#F3A58F' },
  programs: { echo: '#D4614A', grad: 'linear-gradient(135deg,#3A1F36,#6A3350)', word: '#F3A58F' },
  portal: { echo: '#3A1F36', grad: 'linear-gradient(135deg,#22101F,#3A1F36)', word: '#D9A866' },
};

export default function ZoneDoor({ zone, crumb, kicker, title, word, lead, promises = [], aside, compact = false, children, testid }: {
  zone: string; crumb?: string; kicker: string; title: string; word?: string; lead?: string; promises?: Promise_[]; aside?: ReactNode; compact?: boolean; children?: ReactNode; testid?: string;
}) {
  const t = ZONE_TONE[zone] || ZONE_TONE.portal;
  return (
    <section className={`zd ${compact ? 'compact' : ''}`} dir="rtl" data-zone={zone} data-testid={testid || `zone-door-${zone}`} style={{ ['--zd-grad' as string]: t.grad, ['--zd-word' as string]: t.word, ['--zone-echo' as string]: t.echo } as CSSProperties}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Horizon light height={compact ? 90 : 150} />
      <div className="zd-in">
        <div className="zd-main">
          {crumb && <p className="zd-crumb"><Link href="/">أَثَر</Link> <span aria-hidden="true">›</span> <span>{crumb}</span></p>}
          <span className="zd-k"><Echo size={14} /> {kicker}</span>
          <h1>{title}{word && <> <em>{word}</em></>}</h1>
          {lead && <p className="zd-lead">{lead}</p>}
          {children}
          {!compact && promises.length > 0 && <ul className="zd-promises">{promises.map((p, i) => <Reveal key={p.title} as="li" delay={i * 110}>{p.href ? <Link href={p.href} className="zd-pr"><i><Icon name={p.icon} size={18} /></i><b>{p.title}</b><span>{p.body}</span></Link> : <div className="zd-pr"><i><Icon name={p.icon} size={18} /></i><b>{p.title}</b><span>{p.body}</span></div>}</Reveal>)}</ul>}
        </div>
        {aside && <Reveal className="zd-aside" delay={200}>{aside}</Reveal>}
      </div>
      {!compact && <ArcDivider className="zd-arc" />}
    </section>
  );
}

const CSS = `
.zd{position:relative;overflow:hidden;color:#FBF4EE;background:var(--zd-grad);border-radius:0 0 28px 28px;margin:0 0 18px}
.zd .ath-hz{position:absolute;inset:0 0 auto 0;opacity:.55;pointer-events:none}
.zd-in{position:relative;max-width:1180px;margin:0 auto;padding:34px 20px 30px;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,.9fr);gap:28px;align-items:start}
.zd.compact .zd-in{padding:22px 20px 18px;grid-template-columns:1fr}
.zd-crumb{margin:0 0 8px;font-size:12.5px;color:rgba(251,244,238,.7)}.zd-crumb a{color:#F6D9A8;text-decoration:none}
.zd-k{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:900;letter-spacing:.03em;color:#F6D9A8}
.zd h1{margin:8px 0 10px;font-size:34px;line-height:1.35;font-weight:900;letter-spacing:-.01em;color:#FBF4EE}.zd.compact h1{font-size:26px;margin:6px 0 6px}
.zd h1 em{font-style:normal;color:var(--zd-word)}
.zd-lead{margin:0 0 14px;font-size:15px;line-height:1.9;color:rgba(251,244,238,.86);max-width:62ch}.zd.compact .zd-lead{font-size:13.5px;margin-bottom:8px}
.zd-promises{list-style:none;margin:16px 0 0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.zd-pr{display:grid;grid-template-columns:40px 1fr;grid-template-rows:auto auto;column-gap:10px;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:#FBF4EE;text-decoration:none;transition:background .3s,transform .35s cubic-bezier(.2,.8,.2,1);min-height:84px}
a.zd-pr:hover{background:rgba(255,255,255,.14);transform:translateY(-2px)}
.zd-pr i{grid-row:1/3;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(217,168,102,.18);color:#F6D9A8}
.zd-pr b{font-size:14px;font-weight:900}.zd-pr span{font-size:12.5px;line-height:1.6;color:rgba(251,244,238,.78)}
.zd-aside{background:#FBF4EE;color:#2A1626;border-radius:20px;padding:18px 20px;box-shadow:0 24px 60px rgba(20,8,18,.35)}
.zd-aside h3{margin:0 0 6px;font-size:16px;color:#3A1F36;display:flex;gap:8px;align-items:center}.zd-aside .pt-muted{color:#5C4858;font-size:13px}
.zd-aside .pt-form{display:grid;gap:10px;margin-top:10px}.zd-aside .pt-form label{display:grid;gap:4px;font-size:12.5px;font-weight:800;color:#5C4858}.zd-aside .pt-form input{border:1px solid #EADFD6;border-radius:10px;padding:9px 11px;font:inherit;font-size:14px;background:#fff}
.zd-aside .pt-btn{justify-content:center}
.zd-arc{display:block;width:100%;height:18px;color:rgba(217,168,102,.7);margin-top:4px}
@media(max-width:900px){.zd-in{grid-template-columns:1fr;padding:26px 16px 22px}.zd h1{font-size:27px}.zd-promises{grid-template-columns:1fr}}
`;
