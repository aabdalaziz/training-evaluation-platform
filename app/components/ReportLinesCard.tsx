'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «سطر لك من تقرير الأسبوع» (P46 «محور التقارير») — بطاقة في /me: الجملة التي كتبها معلّمك عنك بعد اعتماد تقرير الأسبوع. لا درجات زملائك ولا ترتيب. تختفي إن لم يصلك شيء. */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';

type Line = { id: string; program_ar: string; week_no: number; text_ar: string; period_to: string; kind?: string };   /* P46 ر2: kind = weekly | final */
const fmt = (d: string) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long' }) : '');
export default function ReportLinesCard() {
  const db = useMemo(() => supabase(), []); const [items, setItems] = useState<Line[]>([]);
  useEffect(() => { (async () => { try {
    const { data: s } = await db.auth.getSession(); if (!s.session) return;
    const j = await fetch('/api/reports?lines=1', { headers: { Authorization: `Bearer ${s.session.access_token}` }, cache: 'no-store' }).then(r => r.json());
    if (j?.success && Array.isArray(j.lines)) setItems(j.lines);
  } catch { /* صامت — البطاقة اختيارية */ } })(); }, [db]);
  if (!items.length) return null;
  return (
    <section className="rlc" id="report-lines" data-testid="report-lines-card"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <h3><Icon name="mail" size={16} /> {items.some(l => l.kind === 'final') ? 'سطر لك من معلّمك' : 'سطر لك من تقرير الأسبوع'}</h3>
      <ul>{items.slice(0, 3).map(l => <li key={l.id} data-kind={l.kind || 'weekly'}><p>«{l.text_ar}»</p>
        {l.kind === 'final' ? <small><b className="rlc-final">خاتمة الرحلة</b> · {l.program_ar} · التقرير الختامي · <a href={`/me/reports/line/${l.id}`} data-testid="rp-myline-open">صفحتي من التقرير ←</a></small> : <small>{l.program_ar} · الأسبوع {l.week_no} · {fmt(l.period_to)} · من معلّمك بعد اعتماد التقرير</small>}
      </li>)}</ul>
    </section>
  );
}
const CSS = `
.rlc{background:#f3fbfa;border:1px solid #b9e6e1;border-radius:18px;padding:16px 18px;margin:0 0 14px}.rlc h3{margin:0 0 8px;font-size:15px;color:#0b6f69;display:flex;align-items:center;gap:6px}
.rlc ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}.rlc li p{margin:0;font-size:16px;line-height:1.8;color:#0f172a}.rlc small{color:#64748b;font-size:12px}.rlc-final{color:#9a7a2a;background:#fff7e6;border:1px solid #f1dfae;border-radius:999px;padding:1px 8px;font-size:11px}.rlc small a{color:#0b6f69;font-weight:700;text-decoration:none}.rlc small a:hover{text-decoration:underline}
`;
