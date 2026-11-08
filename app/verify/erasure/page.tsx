'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /verify/erasure?code=ATH-ER-XXXX-XXXX — P65: تحقّق عام من «إيصال محو جهة» — ماذا مُحي (جداول وأعداد) ومتى، بلا كشف محتوى ولا اسم الجهة. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../components/PortalShell';
import { Icon } from '../../../lib/ui/icons';

type R = { valid: boolean; intact?: boolean; receipt?: { code: string; executed_at: string; requested_at: string | null; hold_days: number; tables: { table: string; rows: number; effect: string }[]; summary_ar: string; org_deleted: boolean; issuer: string; hash: string; signed: boolean } };
const fmt = (iso?: string | null) => { if (!iso) return '—'; try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso.slice(0, 10); } };
const EFFECT: Record<string, string> = { cascade: 'حُذف', restrict: 'حُذف', set_null: 'فُكّ ربطه بالجهة', set_default: 'أُعيد للافتراضي' };

export default function VerifyErasurePage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const [code, setCode] = useState(''); const [r, setR] = useState<R | null>(null); const [busy, setBusy] = useState(false);
  async function check(c: string) { const v = c.trim().toUpperCase(); if (!v) return; setBusy(true); const res = await fetch(`/api/shield?erasure=${encodeURIComponent(v)}`, { cache: 'no-store' }).then(x => x.json()).catch(() => ({ valid: false })); setR(res); setBusy(false); }
  useEffect(() => { const c = new URLSearchParams(window.location.search).get('code') || ''; if (c) { setCode(c.toUpperCase()); void check(c); } }, []);
  const rc = r?.receipt;
  return <main className="pt-main" dir="rtl" data-testid="ve-root">
    <section className="pt-box" style={{ maxWidth: 720, margin: '0 auto' }}>
      <p className="pt-muted" style={{ margin: 0, color: '#b45309', fontWeight: 800 }}>أَثَر · خزنة أَثَر · إيصال محو جهة</p>
      <h1 style={{ margin: '4px 0' }}>تحقّق من «إيصال المحو»</h1>
      <p className="pt-muted">أدخل رمز الإيصال (مثل ATH-ER-7K2Q-9M4X). نُظهر ماذا مُحي (أسماء الجداول وأعداد الصفوف) ومتى، وسلامة البصمة — ولا نُظهر اسم الجهة ولا أي محتوى.</p>
      <form onSubmit={(e) => { e.preventDefault(); void check(code); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ATH-ER-XXXX-XXXX" aria-label="رمز الإيصال" dir="ltr" style={{ flex: 1, minWidth: 220, border: '1.5px solid #cbd5e1', borderRadius: 10, padding: '8px 10px', font: 'inherit' }} data-testid="ve-code" />
        <button type="submit" className="pt-btn" disabled={busy} data-testid="ve-check"><Icon name="search" size={14} /> {busy ? '…' : 'تحقّق'}</button>
      </form>
      {r && !r.valid && <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px' }} data-testid="ve-invalid"><b>لا يوجد إيصال بهذا الرمز.</b></div>}
      {r && r.valid && rc && <div role="status" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '12px 14px' }} data-testid="ve-valid">
        <b>✓ إيصال صادر من أَثَر{rc.signed ? ' · موقَّع Ed25519' : ''}</b>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', margin: '8px 0 0' }}>
          <dt>طُلب في</dt><dd style={{ margin: 0 }}>{fmt(rc.requested_at)}</dd>
          <dt>نُفِّذ في</dt><dd style={{ margin: 0 }}>{fmt(rc.executed_at)} (بعد مهلة {rc.hold_days} أيام)</dd>
          <dt>سجلّ الجهة</dt><dd style={{ margin: 0 }}>{rc.org_deleted ? 'حُذف' : 'لم يُعثر عليه وقت التنفيذ'}</dd>
          <dt>الخلاصة</dt><dd style={{ margin: 0 }}>{rc.summary_ar}</dd>
          <dt>البصمة</dt><dd style={{ margin: 0, fontSize: 12 }} dir="ltr">{rc.hash}</dd>
        </dl>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}><thead><tr><th style={{ textAlign: 'start' }}>الجدول</th><th style={{ textAlign: 'start' }}>صفوف</th><th style={{ textAlign: 'start' }}>ما جرى</th></tr></thead><tbody>
          {(rc.tables || []).map(t => <tr key={t.table}><td dir="ltr">{t.table}</td><td>{t.rows}</td><td>{EFFECT[t.effect] || t.effect}</td></tr>)}
        </tbody></table>
      </div>}
      <p className="pt-muted" style={{ marginTop: 14 }}><Link href="/security">← درع أَثَر</Link> · <Link href="/privacy">الخصوصية</Link> · <Link href="/">الرئيسية</Link></p>
    </section>
  </main>;
}
