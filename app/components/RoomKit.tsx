'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «عدّة الغرفة» (هـ-3 ح) — إطار واحد لكل غرف مركز القيادة بدل رأس وقوالب خاصّة في كل صفحة:
 *  · RoomHead: رأس الغرفة — شريط الجناح (لونه وعلامته) + «الجناح · العنقود» + العنوان والوصف + أزرار الغرفة فقط
 *    (لا روابط «لوحة التحكم/مركز الإدارة» المكرّرة؛ شريط الغلاف والقائمة يوفّرانها).
 *  · خطّ الجناح (RoomLine): محطّات العنقود كخطّ مترو صغير أسفل الرأس — السابقة · المحطّات · التالية — التنقّل نفسه الذي
 *    أحبّه المالك في شاشات اقْرَأْ (أسهم) لكن على مستوى الجناح.
 *  · RM_CSS: فئات rm-* (الصفحة · الرأس · الأزرار · البطاقات · المؤشّرات · الجداول · التنبيهات · الفارغ) يحقنها AdminShell مرّة واحدة.
 *  الصفحة تحتفظ بمنطقها ونصوصها؛ ما يتغيّر هو الهيكل والهوية فقط.
 */
import Link from 'next/link';
import { createContext, useContext, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '../../lib/ui/icons';
import { ROOMS, canOpen, roomFor, type Room } from '../../lib/portal/rooms';
import { WINGS, clusterNameOf, clustersOfWing, neighborsOf, roomsOfWing, wingsOfHref, type Wing } from '../../lib/portal/wings';
import { ZoneMark } from './ZoneMark';
import { useMyRoles } from './Brand';

export type RoomCtx = { pathname: string; room: Room | null; wing: Wing | null; cluster: string | null; rooms: Room[] };
export const RoomContext = createContext<RoomCtx | null>(null);

/** سياق الغرفة: من الغلاف إن وُجد، وإلا يُستنتج من المسار (غرفة بجناحين → أوّلهما) */
export function useRoom(): RoomCtx {
  const ctx = useContext(RoomContext);
  const pathname = usePathname() || '/';
  const my = useMyRoles();
  if (ctx) return ctx;
  const room = roomFor(pathname) || null;
  const wing = wingsOfHref(pathname)[0] || null;
  const rooms = wing ? roomsOfWing(wing).filter(r => !my || canOpen(r, my.permissions, my.staff)) : ROOMS.filter(r => r.side);
  return { pathname, room, wing, cluster: clusterNameOf(wing, pathname), rooms };
}

const under = (p: string, h: string) => p === h || p.startsWith(h + '/');

/** خطّ الجناح: محطّات العنقود الحالي + السابقة/التالية */
export function RoomLine({ compact = false }: { compact?: boolean }) {
  const { pathname, wing, rooms } = useRoom();
  if (!wing || rooms.length < 2) return null;
  const { prev, next } = neighborsOf(wing, pathname, rooms);
  const seq = clustersOfWing(wing, rooms).find(c => c.rooms.some(r => under(pathname, r.href)))?.rooms || rooms; /* محطّات العنقود الحالي */
  const here = seq.findIndex(r => under(pathname, r.href));
  if (seq.length < 2 && !prev && !next) return null; /* عنقود بغرفة واحدة: لا خطّ */
  return (
    <nav className={`rm-line${compact ? ' compact' : ''}`} aria-label={`خطّ ${wing.name}`} data-testid="rm-line">
      {prev ? <Link href={prev.href} className="rm-line-step" data-testid="rm-line-prev"><Icon name="arrow" size={13} /> <span>{prev.label}</span></Link> : <span className="rm-line-step off" />}
      <ol className="rm-line-track" aria-hidden="true">
        {seq.map((r, i) => <li key={r.href} className={i === here ? 'on' : ''} title={r.label}><Link href={r.href} tabIndex={-1} /></li>)}
      </ol>
      {next ? <Link href={next.href} className="rm-line-step" data-testid="rm-line-next"><span>{next.label}</span> <span className="rm-flip"><Icon name="arrow" size={13} /></span></Link> : <span className="rm-line-step off" />}
    </nav>
  );
}

export type RoomHeadProps = {
  /** عنوان الغرفة (افتراضيًا اسمها في الخريطة) */ title?: ReactNode;
  /** وصف قصير تحت العنوان */ desc?: ReactNode;
  /** أزرار الغرفة فقط (تحديث · تصدير · طباعة · إنشاء…) */ actions?: ReactNode;
  /** أيقونة بديلة عن أيقونة الغرفة */ icon?: IconName;
  /** سطر «الجناح · العنقود» بديل */ kicker?: ReactNode;
  /** إخفاء خطّ الجناح */ noLine?: boolean;
  /** يُخفى عند الطباعة (افتراضيًا نعم) */ print?: boolean;
  children?: ReactNode;
};

export function RoomHead({ title, desc, actions, icon, kicker, noLine, print = false, children }: RoomHeadProps) {
  const { room, wing, cluster } = useRoom();
  const tone = wing?.tone || '#D9A866', toneDark = wing?.tone_dark || '#F6D9A8';
  const style = { ['--rm-tone' as string]: tone, ['--rm-tone-dark' as string]: toneDark } as React.CSSProperties;
  return (
    <header className={`rm-head${print ? '' : ' rm-noprint'}`} style={style} data-testid="rm-head" data-wing={wing?.key || ''}>
      <div className="rm-head-in">
        <div className="rm-head-id">
          <span className="rm-mark" aria-hidden="true">{wing ? <ZoneMark zone={wing.zone} size={40} light title={wing.name} /> : <Icon name={icon || room?.icon || 'admin'} size={26} />}</span>
          <div className="rm-head-txt">
            <div className="rm-kicker" data-testid="rm-kicker"><Icon name={icon || room?.icon || 'admin'} size={13} /> {kicker ?? <>{wing ? wing.name : 'مركز قيادة أَثَر'}{cluster && <> · {cluster}</>}</>}</div>
            <h1>{title ?? room?.label ?? 'غرفة'}</h1>
            {desc && <div className="rm-desc">{desc}</div>}
            {children}
          </div>
        </div>
        {actions && <div className="rm-actions" data-testid="rm-actions">{actions}</div>}
      </div>
      {!noLine && <RoomLine />}
    </header>
  );
}

/** قائمة الأجنحة (للاختبار والعرض) */
export const WING_KEYS = WINGS.map(w => w.key);

export const RM_CSS = `
.rm-page{display:grid;grid-template-columns:minmax(18px,1fr) minmax(0,1320px) minmax(18px,1fr);align-content:start;background:#F6EBE0;min-height:calc(100vh - 58px);padding-bottom:36px;font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif;color:#2A1626}
.rm-page>*{grid-column:2;min-width:0}.rm-page>.rm-head{grid-column:1/-1}
.rm-head{position:relative;overflow:hidden;margin:0 0 18px;padding:0;color:#F6EBE0;background:linear-gradient(135deg,#22101F 0%,#3A1F36 58%,color-mix(in srgb,var(--rm-tone,#D9A866) 38%,#3A1F36) 100%);border-bottom:3px solid var(--rm-tone,#D9A866)}
.rm-head::before{content:'';position:absolute;inset:auto -60px -120px auto;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--rm-tone,#D9A866) 28%,transparent) 0%,transparent 70%);pointer-events:none}
.rm-head-in{position:relative;max-width:1356px;margin:0 auto;padding:20px 18px 18px;display:flex;gap:18px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
.rm-head-id{display:flex;gap:14px;align-items:flex-start;min-width:0;flex:1 1 520px}
.rm-mark{flex-shrink:0;width:58px;height:58px;border-radius:18px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);display:grid;place-items:center;color:#F6D9A8;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.rm-head-txt{min-width:0;flex:1}
.rm-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:var(--rm-tone-dark,#F6D9A8);letter-spacing:.2px}
.rm-head h1{margin:4px 0 6px;font-size:24px;line-height:1.3;color:#fff;font-weight:900;letter-spacing:-.1px}
.rm-desc,.rm-head p{margin:0;color:#D9CBC2;font-size:13.5px;line-height:1.75;max-width:860px}.rm-desc p{margin:0 0 4px}.rm-head a:not(.rm-btn){color:#F6D9A8}
.rm-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:flex-end;align-self:center}
.rm-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #D9CBC2;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:#3A1F36;cursor:pointer;text-decoration:none;line-height:1.2;white-space:nowrap;transition:background .15s,border-color .15s,transform .1s}
.rm-btn:hover{background:#FBF4EE;border-color:#C9A6B6}.rm-btn:active{transform:translateY(1px)}.rm-btn:disabled{opacity:.5;cursor:default}
.rm-btn:focus-visible{outline:3px solid var(--rm-tone,#D9A866);outline-offset:2px}.rm-btn[aria-busy="true"]{opacity:.7;cursor:progress}
.rm-btn.primary{background:#D4614A;border-color:#D4614A;color:#fff}.rm-btn.primary:hover{background:#B94E3A;border-color:#B94E3A}
.rm-btn.danger{background:#fff;border-color:#f3b4b4;color:#9A2A2A}.rm-btn.danger:hover{background:#fdf0f0}
.rm-btn.ghost{background:transparent}
.rm-head .rm-btn{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.22);color:#fff;backdrop-filter:blur(4px)}.rm-head .rm-btn:hover{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.4)}
.rm-head .rm-btn.primary{background:var(--rm-tone,#D9A866);border-color:var(--rm-tone,#D9A866);color:#22101F}.rm-head .rm-btn.primary:hover{filter:brightness(1.08)}
.rm-head .rm-btn.danger{background:rgba(212,97,74,.18);border-color:rgba(255,255,255,.22);color:#FFD9CF}
.rm-line{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:1356px;margin:0 auto;padding:0 18px 10px;font-size:12px;font-weight:800}
.rm-line-step{display:inline-flex;align-items:center;gap:5px;color:#D9CBC2;text-decoration:none;max-width:38%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:4px 8px;border-radius:999px;border:1px solid transparent}
.rm-flip{display:inline-flex;transform:rotate(180deg)}
.rm-line-step:hover{color:#fff;border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.06)}.rm-line-step.off{visibility:hidden;min-width:40px}
.rm-line-track{list-style:none;margin:0 auto;padding:0 6px;display:flex;align-items:center;gap:0;flex:0 1 420px;min-width:0;height:18px;position:relative}
.rm-line-track::before{content:'';position:absolute;inset:50% 0 auto 0;height:2px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.28) 10%,rgba(255,255,255,.28) 90%,transparent)}
.rm-line-track li{position:relative;flex:1;display:flex;justify-content:center}.rm-line-track li a{display:block;width:9px;height:9px;border-radius:50%;background:#3A1F36;border:2px solid rgba(255,255,255,.55);box-sizing:content-box;transition:transform .15s}
.rm-line-track li a:hover{transform:scale(1.3);border-color:#fff}
.rm-line-track li.on a{background:var(--rm-tone,#D9A866);border-color:#fff;width:11px;height:11px;box-shadow:0 0 0 4px color-mix(in srgb,var(--rm-tone,#D9A866) 35%,transparent)}
.rm-line.compact .rm-line-track{display:none}
.rm-card{background:#fff;border:1px solid #EADFD6;border-radius:16px;padding:18px 22px;margin-bottom:14px;min-width:0;box-shadow:0 1px 0 rgba(58,31,54,.03)}
.rm-card h3,.rm-card h2{margin:0 0 12px;font-size:15px;color:#3A1F36;display:flex;align-items:center;gap:8px}
.rm-card.tone{border-top:3px solid var(--rm-tone,#D9A866)}
.rm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}
.rm-kpis>*,.rm-kpi{background:#fff;border:1px solid #EADFD6;border-radius:14px;padding:12px 14px;min-width:0;position:relative;overflow:hidden;color:#5C4858;font-size:12px;font-weight:800;line-height:1.5;display:block}
.rm-kpis>*::after,.rm-kpi::after{content:'';position:absolute;inset-inline-start:0;top:12px;bottom:12px;width:3px;border-radius:3px;background:#EADFD6}
.rm-kpis>* b,.rm-kpi b{display:block;font-size:22px;color:#3A1F36;line-height:1.2;font-weight:900}.rm-kpis>* span,.rm-kpis>* small,.rm-kpi span,.rm-kpi small{font-size:12px;font-weight:800;color:#8E7F8A;display:block;margin-top:2px}
.rm-kpis>* a{color:#D4614A}
.rm-kpi.ok b{color:#2F6B66}.rm-kpi.ok::after{background:#5EA8A0}.rm-kpi.info b{color:#6A3350}.rm-kpi.info::after{background:#6A3350}
.rm-kpi.bad b{color:#9A3A2A}.rm-kpi.bad::after{background:#D4614A}.rm-kpi.gold b,.rm-kpi.warn b{color:#8A5A1E}.rm-kpi.gold::after,.rm-kpi.warn::after{background:#D9A866}
.rm-alert{background:#FBEDE7;border:1px solid #F3C4B6;color:#9A3A2A;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-weight:700;line-height:1.7}
.rm-alert.ok{background:#E6F3F1;border-color:#BFE1DC;color:#2F6B66}.rm-alert.info{background:#F3E8EF;border-color:#E2CBDA;color:#6A3350}.rm-alert.warn{background:#FBF4EE;border-color:#F1D9A8;color:#8A5A1E}
.rm-muted{color:#8E7F8A;font-size:12.5px;font-weight:700}
.rm-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:34px 18px;color:#8E7F8A;font-weight:700;text-align:center;border:1px dashed #D9CBC2;border-radius:14px;background:#FBF4EE}
.rm-table{width:100%;border-collapse:collapse;font-size:13px}.rm-table th{background:#FBF4EE;color:#5C4858;font-weight:800;padding:10px 12px;text-align:start;border-bottom:2px solid #EADFD6;white-space:nowrap}
.rm-table td{padding:9px 12px;border-bottom:1px solid #F1E7E0;vertical-align:top;color:#2A1626}.rm-table tr:hover td{background:#FDF8F3}
.rm-tag{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:800;background:#FBF4EE;color:#8A5A1E;border:1px solid #F1D9A8}
.rm-tag.ok{background:#E6F3F1;color:#2F6B66;border-color:#BFE1DC}.rm-tag.bad{background:#FBEDE7;color:#9A3A2A;border-color:#F3C4B6}.rm-tag.info{background:#F3E8EF;color:#6A3350;border-color:#E2CBDA}
.rm-page select,.rm-page input:not([type=checkbox]):not([type=radio]),.rm-page textarea{border:1px solid #D9CBC2;border-radius:10px;padding:9px 10px;font:inherit;font-size:13px;font-weight:700;background:#fff;color:#2A1626}
.rm-page select:focus,.rm-page input:focus,.rm-page textarea:focus{outline:2px solid color-mix(in srgb,var(--rm-tone,#D9A866) 55%,transparent);outline-offset:1px;border-color:#C9A6B6}
@media(max-width:760px){.rm-head h1{font-size:20px}.rm-mark{width:46px;height:46px;border-radius:14px}.rm-actions{justify-content:flex-start;width:100%}.rm-line-step span{display:none}.rm-line-step{max-width:none}}
@media print{.rm-noprint,.rm-line{display:none!important}.rm-page{background:#fff;min-height:0;display:block;padding:0}.rm-card{border-color:#ddd;box-shadow:none;break-inside:avoid}}
`;
