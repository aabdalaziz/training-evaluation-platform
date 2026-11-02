'use client';

/**
 * أَثَر — P43-ب: روابط غُرَف مركز القيادة في الشريط الإداري.
 * مكوّن مستقل يُحمَّل كسولًا من GlobalNavigation حتى لا تحمل الصفحات العامة (/miaar، الرئيسية…) خريطة الغُرَف وقارئ الصلاحيات.
 */
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { navRooms } from '../../lib/portal/rooms';
import { useMyRoles } from './Brand';

export default function CommandRooms({ pathname }: { pathname: string }) {
  const my = useMyRoles();
  return (
    <>
      {navRooms(my ? my.permissions : null, !!my?.staff).map(n => { const on = n.match ? n.match(pathname) : pathname === n.href || pathname.startsWith(n.href + '/'); return (
        <Link key={n.href} href={n.href} className={`global-link ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined} data-testid={`nav-room-${n.href.replace(/\//g, '-').slice(1)}`}>
          <Icon name={n.icon} size={16} /> {n.label}
        </Link>
      ); })}
    </>
  );
}
