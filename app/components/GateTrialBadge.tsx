'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P79 */
/** شارة عدّاد التجربة: تقرأ كعكة athar_trial (موقّعة؛ تُقرأ هنا للعرض فقط — الحكم عند الوسيط) وتعرض الوقت المتبقّي، وعند الصفر تُحوّل إلى صفحة البوّابة. */
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

function readTrial(): { p: string; e: number } | null {
  try { const m = document.cookie.match(/(?:^|;\s*)athar_trial=([^;]*)/); if (!m) return null; const body = decodeURIComponent(m[1]).split('.')[0]; const json = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))); return json?.k === 'trial' && Array.isArray(json.p) ? { p: json.p[0], e: Number(json.e) } : null; } catch { return null; }
}
const PREFIX: Record<string, string> = { iqra: '/iqra', kids: '/kids', sim: '/sim', live: '/live', 'on-air': '/on-air' };

export default function GateTrialBadge() {
  const pathname = usePathname() || '/'; const [left, setLeft] = useState<number | null>(null); const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => {
    const t = readTrial(); const pre = t ? PREFIX[t.p] : null; if (!t || !pre || !(pathname === pre || pathname.startsWith(pre + '/'))) { setLeft(null); return; }
    setSlug(t.p);
    const tick = () => { const s = t.e - Math.floor(Date.now() / 1000); setLeft(s); if (s <= 0) window.location.assign(`/gate/${t.p}?expired=1&next=${encodeURIComponent(pathname)}`); };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [pathname]);
  if (left === null || left < 0) return null;
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0'); const urgent = left <= 20;
  return (
    <div dir="rtl" role="status" style={{ position: 'fixed', bottom: 16, insetInlineStart: 16, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, background: urgent ? '#B9544A' : '#3A1F36', color: '#F6EBE0', borderRadius: 999, padding: '8px 14px 8px 10px', boxShadow: '0 10px 28px rgba(34,16,31,.35)', font: '700 14px/1 inherit', border: '2px solid #D9A866' }}>
      <span style={{ background: '#D9A866', color: '#22101F', borderRadius: 999, padding: '6px 10px', fontVariantNumeric: 'tabular-nums', direction: 'ltr', fontSize: 15 }}>{mm}:{ss}</span>
      <span>تجربة مجّانية</span>
      <a href={`/gate/${slug}#request`} style={{ color: '#F1D9A8', textDecoration: 'underline', fontSize: 13 }}>اطلب تصريحًا</a>
    </div>
  );
}
