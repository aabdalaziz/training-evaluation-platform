'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /verify/policy?code=ATH-OP-XXXX-XXXX — P67: تحقّق عام من ختم «سياسة الجهة» — اسم الجهة · المفاتيح المفعَّلة · ما تغيّر · البيان · سلامة البصمة · هل هو الأحدث (لا أشخاص) */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../components/PortalShell';
import { Icon } from '../../../lib/ui/icons';

type R = { valid: boolean; intact?: boolean; seal?: { code: string; issued_at: string; organization: string; policy: Record<string, unknown>; changed: string[]; statement_ar: string; signed: boolean; latest: boolean } };
const KEY_AR: Record<string, string> = { pseudonymous: 'هوية مستعارة', code_login: 'الدخول بالرمز', public_faces_off: 'لا وجوه عامة', home_threads_off: 'لا خيوط في الرئيسية', voice_off: 'لا صوت', media_off: 'لا وسائط', verify_minimal: 'تحقّق أدنى', kiosk_minutes: 'وضع الكشك' };
const fmt = (iso?: string) => { if (!iso) return ''; try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso; } };

export default function VerifyPolicyPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const [code, setCode] = useState(''); const [r, setR] = useState<R | null>(null); const [busy, setBusy] = useState(false);
  async function check(c: string) { const v = c.trim().toUpperCase(); if (!v) return; setBusy(true); const res = await fetch(`/api/org/policy?verify=${encodeURIComponent(v)}`, { cache: 'no-store' }).then(x => x.json()).catch(() => ({ valid: false })); setR(res); setBusy(false); }
  useEffect(() => { const c = new URLSearchParams(window.location.search).get('code') || ''; if (c) { setCode(c.toUpperCase()); void check(c); } }, []);
  const s = r?.seal; const on = s ? Object.keys(s.policy).filter(k => s.policy[k]) : [];
  return <main className="pt-main" dir="rtl" data-testid="vp-root">
    <section className="pt-box" style={{ maxWidth: 720, margin: '0 auto' }}>
      <p className="pt-muted" style={{ margin: 0, color: '#0b8a83', fontWeight: 800 }}>أَثَر · سياسة الجهة · ختم ATH-OP</p>
      <h1 style={{ margin: '4px 0' }}>تحقّق من «ختم سياسة الجهة»</h1>
      <p className="pt-muted">أدخل رمز الختم (مثل ATH-OP-7K2Q-9M4X). نُظهر اسم الجهة والمفاتيح التي قرّرتها وتاريخ الختم وسلامة البصمة — ولا نُظهر أي شخص.</p>
      <form onSubmit={(e) => { e.preventDefault(); void check(code); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ATH-OP-XXXX-XXXX" aria-label="رمز الختم" dir="ltr" style={{ flex: 1, minWidth: 220, border: '1.5px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', fontSize: 16 }} data-testid="vp-code" />
        <button type="submit" className="pt-btn" disabled={busy} data-testid="vp-check"><Icon name="search" size={14} /> {busy ? '…' : 'تحقّق'}</button>
      </form>
      {r && !r.valid && <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px' }} data-testid="vp-invalid"><b>لا يوجد ختم بهذا الرمز.</b> تأكّد من الحروف (لا نستعمل 0 و O و 1 و I).</div>}
      {r && r.valid && s && <div role="status" style={{ background: r.intact ? '#ecfdf5' : '#fffbeb', border: `1px solid ${r.intact ? '#a7f3d0' : '#fcd34d'}`, borderRadius: 12, padding: '12px 14px' }} data-testid="vp-valid">
        <b>{r.intact ? '✓ ختم صادر من أَثَر وبصمته سليمة' : '⚠ ختم موجود لكن بصمته لا تطابق'}{s.signed ? ' · موقَّع Ed25519' : ''}{s.latest ? '' : ' · (صدر بعده ختم أحدث)'}</b>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', margin: '8px 0 0' }}>
          <dt>الجهة</dt><dd style={{ margin: 0 }}>{s.organization}</dd>
          <dt>المفاتيح المفعَّلة</dt><dd style={{ margin: 0 }} data-testid="vp-keys">{on.length ? on.map(k => k === 'kiosk_minutes' ? `${KEY_AR[k]} (${s.policy[k]} د)` : (KEY_AR[k] || k)).join(' · ') : 'لا قيود إضافية'}</dd>
          <dt>ما تغيّر بهذا الختم</dt><dd style={{ margin: 0 }}>{s.changed.map(k => KEY_AR[k] || k).join('، ') || '—'}</dd>
          <dt>تاريخ الختم</dt><dd style={{ margin: 0 }}>{fmt(s.issued_at)}</dd>
          <dt>الرمز</dt><dd style={{ margin: 0 }} dir="ltr">{s.code}</dd>
        </dl>
        {s.statement_ar && <p className="pt-muted" style={{ margin: '8px 0 0' }}>{s.statement_ar}</p>}
      </div>}
      <p className="pt-muted" style={{ marginTop: 14 }}><Link href="/security">← درع أَثَر</Link> · <Link href="/verify">كل أنواع التحقّق</Link> · <Link href="/">الرئيسية</Link></p>
    </section>
  </main>;
}
