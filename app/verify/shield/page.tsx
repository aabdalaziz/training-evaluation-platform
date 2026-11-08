'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /verify/shield?code=ATH-SH-XXXX-XXXX — P65 ★2: تحقّق عام من «شهادة الدرع» الشهرية بالرمز — الشهر · أيام التمرين · أيام النجاح الكامل · سلامة البصمة. لا أسرار ولا تفاصيل تُفيد مهاجمًا. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../components/PortalShell';
import { Icon } from '../../../lib/ui/icons';

type R = { valid: boolean; intact?: boolean; seal?: { month: string; code: string; issued_at: string; passed_days: number; total_days: number; checks_total: number; signed: boolean; body?: { month_ar?: string; statement_ar?: string; partial?: boolean; score?: number; failed?: { id: string; title_ar: string; days: number }[] } } };
const fmt = (iso?: string) => { if (!iso) return ''; try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso.slice(0, 10); } };

export default function VerifyShieldPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const [code, setCode] = useState(''); const [r, setR] = useState<R | null>(null); const [busy, setBusy] = useState(false);
  async function check(c: string) { const v = c.trim().toUpperCase(); if (!v) return; setBusy(true); const res = await fetch(`/api/shield?seal=${encodeURIComponent(v)}`, { cache: 'no-store' }).then(x => x.json()).catch(() => ({ valid: false })); setR(res); setBusy(false); }
  useEffect(() => { const c = new URLSearchParams(window.location.search).get('code') || ''; if (c) { setCode(c.toUpperCase()); void check(c); } }, []);
  const b = r?.seal?.body || {};
  return <main className="pt-main" dir="rtl" data-testid="vs-root">
    <section className="pt-box" style={{ maxWidth: 720, margin: '0 auto' }}>
      <p className="pt-muted" style={{ margin: 0, color: '#b45309', fontWeight: 800 }}>أَثَر · درع أَثَر · شهادة الدرع الشهرية</p>
      <h1 style={{ margin: '4px 0' }}>تحقّق من «شهادة الدرع»</h1>
      <p className="pt-muted">أدخل رمز الختم (مثل ATH-SH-7K2Q-9M4X). نُظهر الشهر وأيام التمرين وأيام النجاح الكامل وسلامة البصمة — ولا نُظهر أي تفصيل داخلي.</p>
      <form onSubmit={(e) => { e.preventDefault(); void check(code); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ATH-SH-XXXX-XXXX" aria-label="رمز الختم" dir="ltr" style={{ flex: 1, minWidth: 220, border: '1.5px solid #cbd5e1', borderRadius: 10, padding: '8px 10px', font: 'inherit' }} data-testid="vs-code" />
        <button type="submit" className="pt-btn" disabled={busy} data-testid="vs-check"><Icon name="search" size={14} /> {busy ? '…' : 'تحقّق'}</button>
      </form>
      {r && !r.valid && <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px' }} data-testid="vs-invalid"><b>لا يوجد ختم بهذا الرمز.</b> تأكّد من الأحرف (لا تحوي 0 أو O أو 1 أو I).</div>}
      {r && r.valid && r.seal && <div role="status" style={{ background: r.intact ? '#ecfdf5' : '#fffbeb', border: `1px solid ${r.intact ? '#a7f3d0' : '#fcd34d'}`, borderRadius: 12, padding: '12px 14px' }} data-testid="vs-valid">
        <b>{r.intact ? '✓ ختم صادر من أَثَر وبصمته سليمة' : '⚠ ختم موجود لكن بصمته لا تطابق'}{r.seal.signed ? ' · موقَّع Ed25519' : ''}</b>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', margin: '8px 0 0' }}>
          <dt>الشهر</dt><dd style={{ margin: 0 }}>{b.month_ar || r.seal.month}{b.partial ? ' (ختم جزئي — الشهر لم يكتمل)' : ''}</dd>
          <dt>أيام التمرين</dt><dd style={{ margin: 0 }}>{r.seal.total_days}</dd>
          <dt>أيام النجاح الكامل</dt><dd style={{ margin: 0 }}>{r.seal.passed_days} ({b.score ?? Math.round(r.seal.passed_days * 100 / Math.max(1, r.seal.total_days))}%)</dd>
          <dt>اختبارات كل يوم</dt><dd style={{ margin: 0 }}>{r.seal.checks_total}</dd>
          <dt>تاريخ الختم</dt><dd style={{ margin: 0 }}>{fmt(r.seal.issued_at)}</dd>
          <dt>الرمز</dt><dd style={{ margin: 0 }} dir="ltr">{r.seal.code}</dd>
        </dl>
        {b.statement_ar && <p className="pt-muted" style={{ margin: '8px 0 0' }}>{b.statement_ar}</p>}
        {!!(b.failed || []).length && <p className="pt-muted" style={{ margin: '4px 0 0' }}>ما أخفق (بعدد الأيام): {(b.failed || []).map(f => `${f.title_ar} (${f.days})`).join('، ')}</p>}
      </div>}
      <p className="pt-muted" style={{ marginTop: 14 }}><Link href="/security">← درع أَثَر</Link> · <Link href="/verify">كل أنواع التحقّق</Link> · <Link href="/">الرئيسية</Link></p>
    </section>
  </main>;
}
