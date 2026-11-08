'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «جهتك عاهدت» (P28 أفق الجهة) — سطر واحد في /me للمنسوب المؤكَّد: عنوان عهد جهته وموعد مراجعته فقط — لا أفق، لا درب، لا أسماء. ما يفعله في أَثَر هو ما يُشهد. */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';

type Item = { org_name: string; kind: string; kind_ar: string; title_ar: string; signed_at: string | null; review_at: string | null; code: string | null };
type Lead = { org_name: string; period_ar: string; decision_ar: string; decided_at: string; code: string; text_ar: string }; /* P68 «قيادتك قرأت وقرّرت» */
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'long' }) : '—');

export default function OrgPledgeBanner() {
  const db = useMemo(() => supabase(), []); const [items, setItems] = useState<Item[]>([]); const [lead, setLead] = useState<Lead | null>(null);
  useEffect(() => { (async () => { try {
    const { data: s } = await db.auth.getSession(); if (!s.session) return; const H = { headers: { Authorization: `Bearer ${s.session.access_token}` }, cache: 'no-store' as const };
    const [j, l] = await Promise.all([fetch('/api/org/horizon?mine=1', H).then(r => r.json()), fetch('/api/org/report?mine=1', H).then(r => r.json()).catch(() => null)]);
    if (j?.success && Array.isArray(j.items)) setItems(j.items); if (l?.success && l.line) setLead(l.line);
  } catch { /* صامت — السطر اختياري */ } })(); }, [db]);
  if (!items.length && !lead) return null;
  return (
    <div className="opb" data-testid="org-pledge-banner"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      {lead && <div className="opb-row lead" data-testid="org-lead-line"><span className="opb-ic"><Icon name="shield" size={16} /></span><div><b>{lead.text_ar}</b><p>قرار مختوم داخل تقرير القيادة ({lead.code}) في {fmt(lead.decided_at)} — بلا أسماء؛ ما كتبتَه في سطور التطبيق وصل إلى من يملك القرار.</p></div></div>}
      {items.map(it => (
        <div key={`${it.org_name}:${it.code || it.title_ar}`} className="opb-row">
          <span className="opb-ic"><Icon name="compass" size={16} /></span>
          <div><b>جهتك «{it.org_name}» عاهدت نفسها على خطوة لهذه السنة</b><p>«{it.title_ar}» — {it.kind_ar} · تُراجَع في {fmt(it.review_at)}. ما تفعله في أَثَر هو ما يُشهد — بأعداد لا أسماء.</p></div>
        </div>))}
    </div>
  );
}

const CSS = `
.opb{margin:10px 0}.opb-row{display:flex;gap:10px;align-items:flex-start;background:linear-gradient(135deg,#fffdf7,#fff);border:1px solid #f1e3b8;border-inline-start:4px solid #c9a24b;border-radius:14px;padding:10px 14px;margin:6px 0}
.opb-ic{width:32px;height:32px;border-radius:50%;background:#0f2a4e;color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none}
.opb-row.lead{border-color:#99f6e4;border-inline-start-color:#0b8a83;background:linear-gradient(135deg,#f0fdfa,#fff)}
.opb-row b{color:#0f2a4e;font-size:14px}.opb-row p{margin:3px 0 0;color:#475569;font-size:13px;line-height:1.8}
`;
