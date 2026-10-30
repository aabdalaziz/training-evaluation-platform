'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «جهتك عاهدت» (P28 أفق الجهة) — سطر واحد في /me للمنسوب المؤكَّد: عنوان عهد جهته وموعد مراجعته فقط — لا أفق، لا درب، لا أسماء. ما يفعله في أَثَر هو ما يُشهد. */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';

type Item = { org_name: string; kind: string; kind_ar: string; title_ar: string; signed_at: string | null; review_at: string | null; code: string | null };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'long' }) : '—');

export default function OrgPledgeBanner() {
  const db = useMemo(() => supabase(), []); const [items, setItems] = useState<Item[]>([]);
  useEffect(() => { (async () => { try {
    const { data: s } = await db.auth.getSession(); if (!s.session) return;
    const j = await fetch('/api/org/horizon?mine=1', { headers: { Authorization: `Bearer ${s.session.access_token}` }, cache: 'no-store' }).then(r => r.json());
    if (j?.success && Array.isArray(j.items)) setItems(j.items);
  } catch { /* صامت — السطر اختياري */ } })(); }, [db]);
  if (!items.length) return null;
  return (
    <div className="opb" data-testid="org-pledge-banner"><style dangerouslySetInnerHTML={{ __html: CSS }} />
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
.opb-row b{color:#0f2a4e;font-size:14px}.opb-row p{margin:3px 0 0;color:#475569;font-size:13px;line-height:1.8}
`;
