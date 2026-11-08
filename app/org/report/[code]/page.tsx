'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /org/report/<ATH-LR-…> — P68: صفحة الطباعة A4 لتقرير القيادة (مدير الجهة/الطاقم) — بلا تنقّل؛ زرّ طباعة يختفي عند الطباعة */
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../../../../lib/supabase/client';
import { SHEET_CSS, type SheetBody } from '../../../components/OrgReportSheet';
const Sheet = dynamic(() => import('../../../components/OrgReportSheet').then(m => m.OrgReportSheet), { ssr: false });

type Full = { code: string; status: 'issued' | 'revoked'; body: SheetBody; logo?: string | null };
export default function OrgReportPrintPage({ params }: { params: { code: string } }) {
  const [r, setR] = useState<{ report: Full; site: string } | null>(null); const [err, setErr] = useState('');
  useEffect(() => { (async () => {
    const { data } = await supabase().auth.getSession(); const tk = data.session?.access_token || ''; if (!tk) { setErr('سجّل الدخول أولًا من بوابة الجهة ثم افتح هذه الصفحة.'); return; }
    const res = await fetch(`/api/org/report?code=${encodeURIComponent(params.code)}`, { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }); const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.success) { setErr(j.error || 'تعذّر التحميل'); return; } setR(j); document.title = `تقرير القيادة — ${j.report.code}`;
  })(); }, [params.code]);
  return <div dir="rtl" style={{ background: '#eef2f7', minHeight: '100vh', padding: '16px 8px' }} className="lrp-root" data-testid="lrp-root">
    <style dangerouslySetInnerHTML={{ __html: SHEET_CSS + '.lrp-bar{max-width:210mm;margin:0 auto 10px;display:flex;gap:8px;justify-content:space-between;align-items:center;font-family:Tajawal,Arial,sans-serif}.lrp-bar button,.lrp-bar a{border:1px solid #0b8a83;background:#0b8a83;color:#fff;border-radius:10px;padding:8px 16px;font:inherit;font-weight:800;cursor:pointer;text-decoration:none}.lrp-bar a.ghost{background:#fff;color:#0b8a83}@media print{.lrp-bar,footer,nav,.way-bar,[data-testid="way-bar"],[data-testid="nadi-fab"],.nadi-fab,[data-testid="athir-fab"],.athir-fab,.pt-skip{display:none!important}body{background:#fff}.lrp-root{background:#fff!important;padding:0!important}}' }} />
    <div className="lrp-bar"><a className="ghost" href="/org?tab=leader">← بوابة الجهة</a><span style={{ color: '#475569', fontSize: 13 }}>احفظها PDF من نافذة الطباعة (الوجهة: Save as PDF)</span><button type="button" onClick={() => window.print()} data-testid="lrp-print">طباعة / PDF</button></div>
    {err ? <p style={{ textAlign: 'center', color: '#991b1b', fontFamily: 'Tajawal,Arial' }} data-testid="lrp-err">{err}</p> : !r ? <p style={{ textAlign: 'center', fontFamily: 'Tajawal,Arial' }}>…</p> : <Sheet body={r.report.body} site={r.site} logo={r.report.logo} status={r.report.status} />}
  </div>;
}
