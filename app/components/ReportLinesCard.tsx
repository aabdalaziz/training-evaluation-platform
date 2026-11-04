'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «سطر لك من تقرير الأسبوع» (P46 «محور التقارير») — بطاقة في /me: الجملة التي كتبها معلّمك عنك بعد اعتماد تقرير الأسبوع. لا درجات زملائك ولا ترتيب. تختفي إن لم يصلك شيء. */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';

type CohortMsg = { program_id: string; program_ar: string; version: number; message_ar: string; at: string };
type Line = { id: string; program_ar: string; week_no: number; text_ar: string; period_to: string; kind?: string };   /* P46 ر2/ر4: kind = weekly | final | diploma_unit | diploma_profile */
const fmt = (d: string) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long' }) : '');
export default function ReportLinesCard() {
  const db = useMemo(() => supabase(), []); const [items, setItems] = useState<Line[]>([]); const [msgs, setMsgs] = useState<CohortMsg[]>([]);   /* P47-ب: «رسالة إلى الدفعة القادمة» */
  useEffect(() => { (async () => { try {
    const { data: s } = await db.auth.getSession(); if (!s.session) return;
    const j = await fetch('/api/reports?lines=1', { headers: { Authorization: `Bearer ${s.session.access_token}` }, cache: 'no-store' }).then(r => r.json());
    if (j?.success && Array.isArray(j.lines)) setItems(j.lines); if (j?.success && Array.isArray(j.cohort_messages)) setMsgs(j.cohort_messages);
  } catch { /* صامت — البطاقة اختيارية */ } })(); }, [db]);
  if (!items.length && !msgs.length) return null;
  return (
    <section className="rlc" id="report-lines" data-testid="report-lines-card"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      {msgs.length > 0 && <div className="rlc-cohort" data-testid="cohort-messages"><h3><Icon name="copy" size={16} /> رسالة إلى دفعتك من المصمّم</h3><ul>{msgs.slice(0, 2).map(m => <li key={m.program_id}><p>«{m.message_ar}»</p><small>{m.program_ar} · النسخة {m.version} · <a href={`/programs/${m.program_id}`}>ما الذي تغيّر ←</a></small></li>)}</ul></div>}
      {items.length > 0 && <><h3><Icon name="mail" size={16} /> {items.some(l => l.kind === 'final' || l.kind === 'diploma_profile' || l.kind === 'diploma_unit') ? 'سطر لك من معلّمك' : 'سطر لك من تقرير الأسبوع'}</h3>
      <ul>{items.slice(0, 3).map(l => <li key={l.id} data-kind={l.kind || 'weekly'}><p>«{l.text_ar}»</p>
        {l.kind === 'diploma_profile' ? <small><b className="rlc-final">كشف الكفايات</b> · {l.program_ar} · <a href={`/me/reports/line/${l.id}`} data-testid="rp-myprofile-open">كشفي كاملًا ←</a></small> : l.kind === 'diploma_unit' ? <small><b className="rlc-final">أثرُ الدبلوم</b> · {l.program_ar} · الوحدة {l.week_no} · {fmt(l.period_to)}</small> : l.kind === 'final' ? <small><b className="rlc-final">خاتمة الرحلة</b> · {l.program_ar} · التقرير الختامي · <a href={`/me/reports/line/${l.id}`} data-testid="rp-myline-open">صفحتي من التقرير ←</a></small> : <small>{l.program_ar} · الأسبوع {l.week_no} · {fmt(l.period_to)} · من معلّمك بعد اعتماد التقرير</small>}
      </li>)}</ul></>}
    </section>
  );
}
const CSS = `
.rlc{background:#f3fbfa;border:1px solid #b9e6e1;border-radius:18px;padding:16px 18px;margin:0 0 14px}.rlc h3{margin:0 0 8px;font-size:15px;color:#0b6f69;display:flex;align-items:center;gap:6px}
.rlc ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}.rlc li p{margin:0;font-size:16px;line-height:1.8;color:#0f172a}.rlc small{color:#64748b;font-size:12px}.rlc-final{color:#9a7a2a;background:#fff7e6;border:1px solid #f1dfae;border-radius:999px;padding:1px 8px;font-size:11px}.rlc small a{color:#0b6f69;font-weight:700;text-decoration:none}.rlc small a:hover{text-decoration:underline}.rlc-cohort{border-bottom:1px dashed #b9e6e1;margin:0 0 10px;padding:0 0 8px}.rlc-cohort h3{color:#7a5c12}.rlc-cohort li p{border-right:3px solid #c9a24b;padding-right:8px}
`;
