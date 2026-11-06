'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /verify/letter?code=ATH-ML-XXXX-XXXX — P52: تحقّق عام من «رسالة الشهر» بالرمز والبصمة — يُظهر الجهة والشهر وتاريخ التوقيع وصفة الموقِّع وسلامة البصمة، ولا يُظهر المحتوى أبدًا */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../components/PortalShell';
import { Icon } from '../../../lib/ui/icons';

type R = { valid: boolean; org_name?: string; month_ar?: string; signed_at?: string; signed_title?: string; digest?: string; intact?: boolean; code?: string };
const fmt = (iso?: string) => { if (!iso) return ''; try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso.slice(0, 10); } };

export default function VerifyLetterPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const [code, setCode] = useState(''); const [r, setR] = useState<R | null>(null); const [busy, setBusy] = useState(false);
  async function check(c: string) { const v = c.trim().toUpperCase(); if (!v) return; setBusy(true); const res = await fetch(`/api/verify/letter?code=${encodeURIComponent(v)}`, { cache: 'no-store' }); const j = await res.json().catch(() => ({ valid: false })); setBusy(false); setR(j); }
  useEffect(() => { const c = new URLSearchParams(window.location.search).get('code') || ''; if (c) { setCode(c.toUpperCase()); void check(c); } }, []);
  return <main className="pt-main" dir="rtl" data-testid="vl-root">
    <section className="pt-box" style={{ maxWidth: 720, margin: '0 auto' }}>
      <p className="pt-muted" style={{ margin: 0, color: '#b45309', fontWeight: 800 }}>أَثَر · P52 · التقرير الشهري لأثر الجهة</p>
      <h1 style={{ margin: '4px 0' }}>تحقّق من «رسالة الشهر»</h1>
      <p className="pt-muted">أدخل رمز الرسالة (مثل ATH-ML-7K2Q-9M4X). نُظهر الجهة والشهر وتاريخ التوقيع وسلامة البصمة — <b>ولا نُظهر محتوى الرسالة</b>؛ المحتوى للجهة وحدها.</p>
      <form onSubmit={(e) => { e.preventDefault(); void check(code); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ATH-ML-XXXX-XXXX" aria-label="رمز الرسالة" style={{ flex: 1, minWidth: 220, border: '1.5px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', font: 'inherit', letterSpacing: 1 }} data-testid="vl-code" />
        <button type="submit" className="pt-btn" disabled={busy} data-testid="vl-check"><Icon name="search" size={14} /> {busy ? '…' : 'تحقّق'}</button>
      </form>
      {r && !r.valid && <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px' }} data-testid="vl-invalid"><b>لا توجد رسالة موقَّعة بهذا الرمز.</b> تأكد من الرمز كما ورد في ذيل الرسالة.</div>}
      {r && r.valid && <div role="status" style={{ background: r.intact ? '#ecfdf5' : '#fffbeb', border: `1px solid ${r.intact ? '#a7f3d0' : '#fcd34d'}`, borderRadius: 12, padding: '12px 14px' }} data-testid="vl-valid" data-intact={r.intact ? '1' : '0'}>
        <b>{r.intact ? '✓ رسالة موقَّعة وسليمة' : '⚠ رسالة موقَّعة لكن بصمتها لا تطابق'}</b>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', margin: '8px 0 0' }}>
          <dt>الجهة</dt><dd style={{ margin: 0 }}>{r.org_name}</dd>
          <dt>الشهر</dt><dd style={{ margin: 0 }}>{r.month_ar}</dd>
          <dt>وُقِّعت في</dt><dd style={{ margin: 0 }}>{fmt(r.signed_at)} · {r.signed_title}</dd>
          <dt>البصمة</dt><dd style={{ margin: 0, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{r.digest}</dd>
        </dl>
      </div>}
      <p className="pt-muted" style={{ marginTop: 14 }}><Link href="/verify">صفحة التحقّق العامة</Link> · <Link href="/org">بوابة الجهات</Link> · <Link href="/">الرئيسية</Link></p>
    </section>
  </main>;
}
