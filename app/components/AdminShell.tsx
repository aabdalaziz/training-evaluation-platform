'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * غلاف «مركز قيادة أَثَر» (P43-ب «أَثَر الواحد») — يلفّ كل الصفحات الإدارية القديمة عبر layout.tsx دون أن يلمسها:
 *  · شريط الغرفة: «مركز قيادة أَثَر › <الغرفة>» من خريطة lib/portal/rooms.ts، وزر «الردهة».
 *  · الحارس: إن قُرئت صلاحياتي ولم تفتح هذه الغرفة → بطاقة «هذه الغرفة ليست من أبوابك» بدل الصفحة (لا تحويل قسري، ولا أثر على
 *    من لم تُقرأ صلاحياته بعد — كل صفحة تحتفظ بحارسها الخاص على الخادم).
 *  · تذييل أَثَر: المؤسسة · التشغيل التجاري · الملكية · روابط الوصول والدرع.
 *  bare: للوحة القيادة (/dashboard) التي تملك قائمتها الجانبية بهوية أَثَر — الحارس فقط بلا شريط ولا تذييل.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../../lib/ui/icons';
import { BRAND } from '../../lib/portal/content';
import { ROOMS, canOpen, roomFor } from '../../lib/portal/rooms';
import { useMyRoles } from './Brand';

const HALL = '/hub?stay=1';

export function AdminShell({ children, bare = false }: { children: React.ReactNode; bare?: boolean }) {
  const pathname = usePathname() || '/';
  const my = useMyRoles();
  const room = roomFor(pathname);
  /* الحارس: غرفة معروفة → صلاحيتها؛ غرفة غير معروفة تحت /admin → أي صفة طاقم */
  const denied = !!my && (room ? !canOpen(room, my.permissions, my.staff) : !(my.staff || my.permissions.includes('*')));
  const title = room?.label || 'غرفة إدارية';
  if (denied) {
    const mine = ROOMS.filter(r => (r.nav || r.side) && canOpen(r, my!.permissions, my!.staff)).slice(0, 6);
    return (
      <main className="as as-deny" dir="rtl" id="main" data-testid="as-denied"><style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="as-deny-card">
          <span className="as-kicker"><Icon name="shield" size={14} /> {BRAND.command.ar}</span>
          <h1>هذه الغرفة ليست من أبوابك</h1>
          <p>«{title}» تُفتح بصفة لا تحملها الآن. إن كنت ترى أنها تخصّ عملك فاطلبها من إدارة أَثَر — وإلى حينها هذه أبوابك المفتوحة:</p>
          <div className="as-deny-links">
            <Link href={HALL} className="pt-btn small"><Icon name="compass" size={15} /> الردهة — كل أبوابك</Link>
            {mine.map(r => <Link key={r.href} href={r.href} className="pt-btn ghost small"><Icon name={r.icon} size={15} /> {r.label}</Link>)}
            {!mine.length && <Link href="/me" className="pt-btn ghost small"><Icon name="users" size={15} /> مساحتي</Link>}
          </div>
        </div>
      </main>
    );
  }
  if (bare) return <>{children}</>;
  return (
    <div className="as" dir="rtl" data-testid="admin-shell"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="as-strip" data-testid="as-strip">
        <nav className="as-crumb" aria-label="موقعك في مركز القيادة">
          <Link href="/dashboard">{BRAND.command.ar}</Link><span aria-hidden="true">›</span><b data-testid="as-room">{title}</b>
          {room?.hint && <small>{room.hint}</small>}
        </nav>
        <Link href={HALL} className="as-hall" data-testid="as-hall"><Icon name="compass" size={14} /> الردهة</Link>
      </div>
      <div className="as-body">{children}</div>
      <footer className="as-foot" data-testid="as-foot">
        <span><b>{BRAND.name.ar} · مركز القيادة</b> — {BRAND.institution.ar}</span>
        <span>{BRAND.operatedBy.ar} {BRAND.legal.ar} · © {BRAND.copyrightYear} {BRAND.owner.ar}</span>
        <span className="as-foot-links"><Link href="/help">دليل مركز القيادة</Link><Link href="/accessibility">أَثَر للجميع</Link><Link href="/security">درع أَثَر</Link><Link href="/">بوابة أَثَر</Link></span>
      </footer>
    </div>
  );
}

const CSS = `
.as{display:flex;flex-direction:column;min-height:calc(100vh - 58px)}
.as-strip{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px max(18px,calc((100% - 1320px)/2));background:#fff;border-bottom:1px solid #e5e9f0;font-size:12.5px}
.as-crumb{display:flex;align-items:center;gap:8px;min-width:0;color:#64748b;font-weight:700}.as-crumb a{color:#0b8a83;text-decoration:none}.as-crumb a:hover{text-decoration:underline}.as-crumb b{color:#0f2a4e;font-weight:900}.as-crumb small{color:#94a3b8;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.as-hall{display:inline-flex;align-items:center;gap:5px;color:#0f2a4e;text-decoration:none;font-weight:800;border:1px solid #ead9a6;background:#fbf5e4;border-radius:999px;padding:4px 10px;white-space:nowrap}.as-hall:hover{background:#fff4d6}
.as-body{flex:1;min-width:0}
.as-foot{display:flex;flex-wrap:wrap;gap:6px 18px;justify-content:space-between;align-items:center;padding:12px max(18px,calc((100% - 1320px)/2));background:#0f2a4e;color:#cbd5e1;font-size:12px;line-height:1.7}.as-foot b{color:#fff}.as-foot-links{display:flex;gap:14px}.as-foot-links a{color:#fde68a;text-decoration:none}.as-foot-links a:hover{text-decoration:underline}
.as-deny{align-items:center;justify-content:center;padding:40px 16px;background:#f6f8fb;min-height:60vh}
.as-deny-card{max-width:620px;background:#fff;border:1px solid #e5e9f0;border-top:4px solid #c9a24b;border-radius:16px;padding:24px 26px}.as-deny-card h1{margin:6px 0 8px;color:#0f2a4e;font-size:24px}.as-deny-card p{margin:0 0 16px;color:#475569;line-height:1.8}
.as-kicker{display:inline-flex;gap:6px;align-items:center;color:#0b8a83;font-weight:800;font-size:12.5px}.as-deny-links{display:flex;flex-wrap:wrap;gap:8px}
@media(max-width:700px){.as-crumb small{display:none}.as-foot{flex-direction:column;align-items:flex-start}}
@media print{.as-strip,.as-foot{display:none}}
`;
