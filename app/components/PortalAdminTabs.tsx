'use client';

// شريط تنقّل موحّد لصفحات إدارة بوّابة أَثَر
// P43-ب: الشريط يعرض غُرَف مركز القيادة المفتوحة لصاحب الجلسة فقط (الغرف من lib/portal/rooms.ts؛ الصلاحيات من useMyRoles)
// هوية v1.2 (2026-11-23) — «مركز القيادة مُجمَّعًا بحسب الدور»: الغرف الـ36 في ستّ مجموعات على السلّم (التقييم · البناء · الإثبات · الأداء والأثر
//  · الناس والجهات · النظام) بدل القائمة الواحدة؛ المجموعة التي فيها الصفحة الحالية مفتوحة والبقية مطوية؛ شريط ذهبي «ينتظر قرارك اليوم» يجمع
//  الأعداد المعلّقة من counts؛ ⌘K يفتح «دليل أَثَر». الواجهة نفسها (counts) — لا تغيير في الصفحات الـ36 التي تستدعيه.
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '../../lib/ui/icons';
import type { IconName } from '../../lib/ui/icons';
import { wingsFor, resolveWing, hrefsInWing, readLastWing, writeLastWing, LOBBY_HREF } from '../../lib/portal/wings'; /* هـ-3 و «الكلّ لا يرى الكلّ» */
import { ZoneMark } from './ZoneMark';
import { useMyRoles } from './Brand';
import { canOpen, roomFor } from '../../lib/portal/rooms';

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: '/admin/enrollments', label: 'طلبات التسجيل', icon: 'users' },
  { href: '/admin/payments', label: 'المدفوعات', icon: 'shield' },
  { href: '/admin/consulting', label: 'الاستشارات', icon: 'compass' },
  { href: '/admin/live', label: 'البث المباشر', icon: 'play' },
  { href: '/admin/resources', label: 'الحقائب', icon: 'folder' },
  { href: '/admin/skills', label: 'المهارات والجهات', icon: 'target' },
  { href: '/admin/placements', label: 'التسكين', icon: 'scale' },
  { href: '/admin/miaar', label: 'مِعيار', icon: 'target' },
  { href: '/admin/iqra', label: 'اقْرَأْ — مكتب اقرأ', icon: 'book' },
  { href: '/admin/credentials', label: 'الشهادات الرقمية', icon: 'award' },
  { href: '/admin/sector-impact', label: 'تقارير الأثر', icon: 'chart' },
  { href: '/admin/catalog', label: 'نشر البرامج', icon: 'globe' },
  { href: '/admin/inbox', label: 'رسائل التواصل', icon: 'inbox' },
  { href: '/admin/sim', label: 'التدريب بالمحاكاة', icon: 'play' },
  { href: '/admin/twin', label: 'خريطة قدرات المؤسسة', icon: 'star' },
  { href: '/admin/missions', label: 'مهمات العمل', icon: 'flag' },
  { href: '/admin/directory', label: 'هيئة أَثَر الاستشارية', icon: 'certificate' },
  { href: '/admin/inclusion', label: 'إتاحة الوصول', icon: 'users' },
  { href: '/admin/onair', label: 'اسأل خبيرًا', icon: 'chat' },
  { href: '/admin/after', label: 'المتابعة بعد التدريب', icon: 'certificate' },
  { href: '/admin/pulse', label: 'نبض أَثَر — الأخبار والتقييم', icon: 'spark' }, /* هـ-1/4 */
  { href: '/admin/diplomas', label: 'الدبلومات — التوأمة والخروج', icon: 'award' }, /* هـ-1/5 */
  { href: '/admin/needs', label: 'الاحتياجات التدريبية', icon: 'spark' },
  { href: '/admin/rehearsals', label: 'التدريب التبادلي', icon: 'users' },
  { href: '/admin/reports', label: 'التقارير', icon: 'doc' },
  { href: '/admin/contracts', label: 'عقود الأثر', icon: 'scale' },
  { href: '/admin/program-engineering', label: 'هندسة البرامج التدريبية', icon: 'compass' },
  { href: '/admin/media', label: 'مقاطع الأداء', icon: 'play' },
  { href: '/admin/evidence', label: 'شواهد الأثر', icon: 'compass' },
  { href: '/admin/agents', label: 'مساعدو الذكاء الاصطناعي', icon: 'users' },
  { href: '/admin/loop', label: 'التحسين المستمر', icon: 'refresh' },
  { href: '/admin/outreach', label: 'الرسائل والتنبيهات', icon: 'send' },
  { href: '/admin/observatory', label: 'مؤشرات القطاعات', icon: 'globe' },
  { href: '/admin/shield', label: 'الأمان والحماية', icon: 'shield' },
  { href: '/admin/roles', label: 'الأدوار والدعوات', icon: 'users' },
  { href: '/admin/vault', label: 'البيانات الشخصية', icon: 'folder' },
  { href: '/admin/councils', label: 'مجالس أَثَر', icon: 'users' },
];

/** الستّ مجموعات على سلّم أَثَر (مهارة → كفاية → جدارة → قدرة → أداء → أثر) — كلّ غرفة بيت واحد. */
export const ADMIN_GROUPS: { id: string; label: string; sub: string; color: string; hrefs: string[] }[] = [
  { id: 'assess', label: 'التقييم', sub: 'مهارة → كفاية', color: '#E8795C', hrefs: ['/admin/miaar', '/admin/miaar/rating', '/admin/placements', '/admin/needs', '/admin/templates'] },
  { id: 'build', label: 'البناء', sub: 'جدارة', color: '#D4614A', hrefs: ['/admin/management', '/admin/program-engineering', '/admin/iqra', '/admin/live', '/admin/onair', '/admin/resources', '/admin/sim', '/admin/rehearsals', '/admin/councils', '/admin/catalog'] },
  { id: 'prove', label: 'الإثبات', sub: 'قدرة — الباب المذهَّب', color: '#D9A866', hrefs: ['/admin/attendance', '/admin/media', '/admin/evidence', '/admin/missions', '/admin/credentials', '/admin/certificates', '/admin/sign'] },
  { id: 'impact', label: 'الأداء والأثر', sub: 'أداء → أثر', color: '#6A3350', hrefs: ['/admin/followup', '/admin/impact', '/admin/outcomes', '/admin/after', '/admin/reports', '/admin/sector-impact', '/admin/contracts', '/admin/twin', '/admin/observatory', '/admin/loop', '/admin/skills'] },
  { id: 'people', label: 'الناس والجهات', sub: 'الأفراد · الجهات · الهيئة', color: '#8E4A68', hrefs: ['/admin/enrollments', '/admin/payments', '/admin/consulting', '/admin/inbox', '/admin/directory', '/admin/roles', '/admin/outreach', '/admin/inclusion'] },
  { id: 'system', label: 'النظام', sub: 'الدرع · البيانات · الصحّة', color: '#3A1F36', hrefs: ['/admin/shield', '/admin/vault', '/admin/data-lifecycle', '/admin/agents', '/admin/audit', '/admin/health', '/admin/backup', '/admin/access', '/admin/notifications'] },
];
export function groupOf(href: string): string | null { const g = ADMIN_GROUPS.find(g => g.hrefs.some(h => href === h || href.startsWith(h + '/'))); return g ? g.id : null; }

export default function PortalAdminTabs({ counts }: { counts?: Partial<Record<string, number>> }) {
  const pathname = usePathname() || '';
  const my = useMyRoles();
  /* قبل قراءة الصلاحيات (أو لمدير النظام) تُعرض كل الألسنة كما كانت؛ وبعدها يبقى ما تفتحه صلاحياته فقط — لسان بلا غرفة معرَّفة يُعامل كغرفة طاقم */
  const allowed = !my ? TABS : TABS.filter(x => canOpen(roomFor(x.href) || { perms: ['staff'] }, my.permissions, my.staff));
  /* هـ-3 و: أقسامي، والقسم الذي أقف فيه؛ داخل القسم لا تظهر إلّا غرفه (+ المشتركة) */
  const [last, setLast] = useState<string | null>(null); useEffect(() => { setLast(readLastWing()); }, []);
  const mine = useMemo(() => wingsFor(my?.permissions, !!my?.staff), [my]);
  const wing = useMemo(() => (my ? resolveWing(pathname, mine, last) : null), [my, pathname, mine, last]);
  useEffect(() => { if (wing) writeLastWing(wing.key); }, [wing]);
  const tabs = useMemo(() => { const ok = new Set(hrefsInWing(wing, allowed.map(t => t.href))); return allowed.filter(t => ok.has(t.href)); }, [allowed, wing]);
  const dash = !my || my.staff || my.permissions.includes('*');
  /* المجموعة الحالية من المسار؛ المستخدم يفتح غيرها بالنقر (ولا تُحفظ — كل صفحة تعود لمجموعتها) */
  const current = useMemo(() => groupOf(pathname) || (pathname.startsWith('/admin') ? 'people' : null), [pathname]);
  const [open, setOpen] = useState<string | null>(current);
  useEffect(() => { setOpen(current); }, [current]);
  /* الغرف المتاحة لكل مجموعة (بعد الصلاحيات)؛ ما لا ينتمي لمجموعة يذهب إلى «أخرى» في النهاية */
  const byGroup = useMemo(() => {
    const m = new Map<string, typeof tabs>(); ADMIN_GROUPS.forEach(g => m.set(g.id, []));
    const other: typeof tabs = [];
    tabs.forEach(t => { const g = groupOf(t.href); if (g) m.get(g)!.push(t); else other.push(t); });
    return { m, other };
  }, [tabs]);
  /* «ينتظر قرارك اليوم»: مجموع الأعداد المعلّقة التي مرّرتها الصفحة */
  const pending = Object.entries(counts || {}).filter(([, n]) => (n || 0) > 0);
  const pendingTotal = pending.reduce((a, [, n]) => a + (n || 0), 0);
  const openGroup = ADMIN_GROUPS.find(g => g.id === open);
  const openTabs = open ? byGroup.m.get(open) || [] : [];
  const openK = (e: React.MouseEvent) => { e.preventDefault(); try { window.dispatchEvent(new CustomEvent('athar:guide')); } catch { /* ignore */ } };

  return (
    <nav className="pat" aria-label="portal admin" data-testid="portal-admin-tabs" data-group={open || ''} data-wing={wing?.key || ''}>
      <style>{CSS}</style>
      {wing && (
        <div className="pat-wing" style={{ ['--w' as string]: wing.tone, ['--ws' as string]: wing.tone_soft } as React.CSSProperties} data-testid="pat-wing">
          <ZoneMark zone={wing.zone} size={34} title={wing.name} />
          <span className="pat-wing-t"><b>{wing.name}</b><small>{wing.verb} — {wing.line}</small></span>
          {mine.length > 1 && <Link href={LOBBY_HREF} className="pat-lobby" data-testid="pat-lobby"><Icon name="compass" size={14} /> الردهة · أقسامي {mine.length}</Link>}
        </div>
      )}
      {pendingTotal > 0 && (
        <div className="pat-today" data-testid="pat-today"><b><Icon name="spark" size={14} /> ينتظر قرارك اليوم · {pendingTotal}</b>
          {pending.map(([href, n]) => { const t = TABS.find(x => x.href === href); return <Link key={href} href={href}>{t?.label || href} <i>{n}</i></Link>; })}
        </div>
      )}
      <div className="pat-groups" role="tablist" aria-label="مجموعات مركز القيادة">
        {ADMIN_GROUPS.map(g => { const n = (byGroup.m.get(g.id) || []).length; if (!n) return null; const cnt = (byGroup.m.get(g.id) || []).reduce((a, t) => a + (counts?.[t.href] || 0), 0);
          return <button key={g.id} type="button" role="tab" aria-selected={open === g.id} className={`pat-g ${open === g.id ? 'on' : ''} ${g.id === current ? 'here' : ''}`} style={{ ['--g' as string]: g.color } as React.CSSProperties} onClick={() => setOpen(open === g.id ? null : g.id)} data-testid={`pat-g-${g.id}`}>
            <i /> {g.label}{cnt ? <em>{cnt}</em> : null}
          </button>; })}
        <span className="pat-spacer" />
        <a href="#" className="pat-k" onClick={openK} title="بحث سريع في كل الغرف"><Icon name="search" size={13} /> ⌘K</a>
        <Link href="/" target="_blank" className="pat-site"><Icon name="link" size={14} /> فتح البوّابة</Link>
        {dash ? <Link href="/dashboard" className="pat-site"><Icon name="dashboard" size={14} /> لوحة القيادة</Link> : null}
      </div>
      {openGroup && openTabs.length > 0 && (
        <div className="pat-row" role="tabpanel" style={{ ['--g' as string]: openGroup.color } as React.CSSProperties}>
          <small className="pat-sub">{openGroup.sub}</small>
          {openTabs.map(x => <Link key={x.href} href={x.href} className={pathname.startsWith(x.href) ? 'on' : ''}><Icon name={x.icon} size={14} /> {x.label}{counts?.[x.href] ? <i>{counts[x.href]}</i> : null}</Link>)}
        </div>
      )}
      {byGroup.other.length > 0 && open === null && (
        <div className="pat-row">{byGroup.other.map(x => <Link key={x.href} href={x.href} className={pathname.startsWith(x.href) ? 'on' : ''}><Icon name={x.icon} size={14} /> {x.label}</Link>)}</div>
      )}
    </nav>
  );
}

const CSS = `
.pat{display:grid;gap:8px;font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif}
.pat-wing{display:flex;align-items:center;gap:12px;padding:8px 14px;border-radius:16px;background:linear-gradient(90deg,var(--ws),#fff 70%);border:1px solid #EADFD6;border-inline-start:4px solid var(--w)}
.pat-wing-t{display:grid;line-height:1.3;flex:1;min-width:0}.pat-wing-t b{font-size:15px;color:#3A1F36;font-weight:900}.pat-wing-t small{font-size:12px;color:#8E7F8A}
.pat-lobby{display:inline-flex;align-items:center;gap:6px;color:#3A1F36;text-decoration:none;font-size:12.5px;font-weight:800;border:1px solid #F1D9A8;background:#FBF4EE;border-radius:999px;padding:5px 11px;white-space:nowrap}.pat-lobby:hover{background:#FBF4EE}
.pat-today{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 12px;border-radius:14px;background:linear-gradient(135deg,#F1D9A8,#FBF4EE);border:1px solid #D9A866;color:#8A5A1E;font-size:13px}
.pat-today b{display:inline-flex;gap:6px;align-items:center;color:#3A1F36}
.pat-today a{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #F1D9A8;border-radius:999px;padding:3px 10px;color:#3A1F36;text-decoration:none;font-weight:700}
.pat-today a i,.pat-row a i{font-style:normal;background:#D4614A;color:#fff;border-radius:999px;padding:0 7px;font-size:11px;line-height:18px;font-weight:800}
.pat-g em{font-style:normal;background:var(--g);color:#fff;border-radius:999px;padding:0 6px;font-size:10.5px;line-height:16px;margin-inline-start:4px}
.pat-groups{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.pat-g{display:inline-flex;align-items:center;gap:7px;border:1px solid #EADFD6;background:#fff;border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;font-weight:800;color:#4A3645;cursor:pointer;transition:background .4s cubic-bezier(.2,.8,.2,1),color .4s,box-shadow .4s}
.pat-g i{width:9px;height:9px;border-radius:50%;background:var(--g);box-shadow:0 0 0 2px #fff,0 0 0 3px var(--g)}
.pat-g.here{border-color:var(--g)}
.pat-g.on{background:var(--g);color:#fff;border-color:var(--g)}.pat-g.on i{background:#fff;box-shadow:none}
.pat-g:focus-visible{outline:2px solid #D9A866;outline-offset:2px}
.pat-spacer{flex:1}
.pat-k{display:inline-flex;align-items:center;gap:5px;color:#8E7F8A;text-decoration:none;font-size:12px;border:1px dashed #D9CBC2;border-radius:8px;padding:3px 8px}
.pat-site{display:inline-flex;align-items:center;gap:6px;color:#3A1F36;text-decoration:none;font-size:12.5px;font-weight:700;border:1px solid #EADFD6;border-radius:999px;padding:5px 10px;background:#FBF4EE}
.pat-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;border-radius:14px;background:#FBF4EE;border-inline-start:3px solid var(--g,#EADFD6);animation:pat-in .45s cubic-bezier(.2,.8,.2,1)}
@keyframes pat-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.pat-sub{color:#8E7F8A;font-size:11.5px;margin-inline-end:4px}
.pat-row a{display:inline-flex;align-items:center;gap:6px;border:1px solid #EADFD6;background:#fff;border-radius:999px;padding:5px 11px;color:#3A1F36;text-decoration:none;font-size:13px;font-weight:700;transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s}
.pat-row a:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(42,22,38,.1)}
.pat-row a.on{background:#3A1F36;color:#fff;border-color:#3A1F36}
@media(prefers-reduced-motion:reduce){.pat-row{animation:none}.pat-row a,.pat-g{transition:none}}
`;
