'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /verify/report?code=ATH-LR-XXXX-XXXX — P68 (رمز غير ATH-LR يُحوَّل إلى /verify/report/<code> — تقارير البرامج P46): تحقّق عام من «تقرير القيادة» — الجهة · الفترة · التاريخ · حيّ أم صدر بعده أحدث · سلامة البصمة · القرار (يُحجب مع verify_minimal) — بلا أشخاص */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../components/PortalShell';
import { Icon } from '../../../lib/ui/icons';

type R = { valid: boolean; intact?: boolean; status?: 'issued' | 'revoked'; superseded?: boolean; minimal?: boolean; report?: { code: string; organization: string; period_ar: string; period_from: string; period_to: string; issued_at: string; signed: boolean; decision_ar: string | null; decision_at: string | null; lines_ar: string[]; pseudonymous: boolean } };
const fmt = (iso?: string | null) => { if (!iso) return ''; try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return String(iso); } };

export default function VerifyReportPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const [code, setCode] = useState(''); const [r, setR] = useState<R | null>(null); const [busy, setBusy] = useState(false);
  async function check(c: string) { const v = c.trim().toUpperCase(); if (!v) return; if (!/^ATH-LR-/.test(v)) { window.location.href = `/verify/report/${encodeURIComponent(v)}`; return; } /* رموز تقارير البرامج (P46) لها صفحتها /verify/report/<code> */ setBusy(true); const res = await fetch(`/api/org/report?verify=${encodeURIComponent(v)}`, { cache: 'no-store' }).then(x => x.json()).catch(() => ({ valid: false })); setR(res); setBusy(false); }
  useEffect(() => { const c = new URLSearchParams(window.location.search).get('code') || ''; if (c) { setCode(c.toUpperCase()); void check(c); } }, []);
  const s = r?.report; const live = r?.valid && r.status === 'issued' && !r.superseded;
  return <main className="pt-main" dir="rtl" data-testid="vr-root">
    <section className="pt-box" style={{ maxWidth: 720, margin: '0 auto' }}>
      <p className="pt-muted" style={{ margin: 0, color: '#0b8a83', fontWeight: 800 }}>أَثَر · تقرير القيادة · ختم ATH-LR</p>
      <h1 style={{ margin: '4px 0' }}>تحقّق من «تقرير القيادة»</h1>
      <p className="pt-muted">أدخل الرمز المطبوع أسفل الصفحة (مثل ATH-LR-7K2Q-9M4X). نُظهر الجهة والفترة وتاريخ الإصدار وسلامة البصمة، وهل ما زال التقرير حيًّا أم صدر بعده أحدث — ولا نُظهر أيّ شخص.</p>
      <form onSubmit={(e) => { e.preventDefault(); void check(code); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ATH-LR-XXXX-XXXX" aria-label="رمز التقرير" dir="ltr" style={{ flex: 1, minWidth: 220, border: '1.5px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', font: 'inherit', letterSpacing: '.06em' }} data-testid="vr-input" />
        <button type="submit" className="pt-btn" disabled={busy} data-testid="vr-check"><Icon name="search" size={14} /> {busy ? '…' : 'تحقّق'}</button>
      </form>
      {r && !r.valid && <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px' }} data-testid="vr-invalid"><b>لا يوجد تقرير بهذا الرمز.</b> تأكّد من الحروف (لا تُستخدم O/I/0/1).</div>}
      {r && r.valid && s && <div role="status" style={{ background: live && r.intact ? '#ecfdf5' : '#fffbeb', border: `1px solid ${live && r.intact ? '#a7f3d0' : '#fcd34d'}`, borderRadius: 12, padding: '12px 14px' }} data-testid="vr-valid">
        <b data-testid="vr-state">{!r.intact ? '⚠ تقرير موجود لكن بصمته لا تطابق' : live ? '✓ تقرير صادر من أَثَر وبصمته سليمة — وهو التقرير الحيّ لهذه الفترة' : '✓ بصمة سليمة — لكن هذا التقرير مُلغى: صدر بعده تقرير أحدث للفترة نفسها'}{s.signed ? ' · موقَّع Ed25519' : ''}</b>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', margin: '8px 0 0' }}>
          <dt>الجهة</dt><dd style={{ margin: 0 }}>{s.organization}{s.pseudonymous ? ' · أرقام تدريبية لا أسماء' : ''}</dd>
          <dt>الفترة</dt><dd style={{ margin: 0 }} data-testid="vr-period">{s.period_ar} <span dir="ltr" className="pt-muted">({s.period_from} → {s.period_to})</span></dd>
          <dt>تاريخ الإصدار</dt><dd style={{ margin: 0 }}>{fmt(s.issued_at)}</dd>
          {!r.minimal && s.decision_ar ? <><dt>قرار القيادة</dt><dd style={{ margin: 0 }} data-testid="vr-decision">«{s.decision_ar}» — {fmt(s.decision_at)}</dd></> : null}
          {!r.minimal && s.lines_ar.length ? <><dt>ثلاثة أرقام</dt><dd style={{ margin: 0 }} data-testid="vr-lines">{s.lines_ar.map((l, i) => <div key={i}>{l}</div>)}</dd></> : null}
          <dt>الرمز</dt><dd style={{ margin: 0 }} dir="ltr">{s.code}</dd>
        </dl>
        {r.minimal && <p className="pt-muted" style={{ margin: '8px 0 0' }} data-testid="vr-minimal">الجهة اختارت «الحدّ الأدنى في التحقّق»: نُظهر الصلاحية والجهة والفترة والتاريخ فقط.</p>}
      </div>}
      <p className="pt-muted" style={{ marginTop: 14 }}><Link href="/security">← درع أَثَر</Link> · <Link href="/verify">كل أنواع التحقّق</Link> · <Link href="/">الرئيسية</Link></p>
    </section>
  </main>;
}
