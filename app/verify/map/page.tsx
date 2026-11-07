'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /verify/map?code=ATH-MP-XXXX-XXXX — P58: تحقّق عام من «خريطة أثري <سنة>» بالرمز والبصمة — السنة وتاريخ التوقيع وسلامة البصمة والأعداد؛ والكوكبة نفسها فقط إن جعلها صاحبها عامة (بلا أسماء، حالات اليوم بالموضوع) · «أُبطلت» عند الإبطال */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { PortalShell } from '../../components/PortalShell';
import { Icon } from '../../../lib/ui/icons';

const AtharMapSvg = dynamic(() => import('../../components/AtharMapSvg').then((m) => m.AtharMapSvg), { ssr: false });
type R = { valid: boolean; revoked?: boolean; intact?: boolean; year?: number; title_ar?: string; signed_at?: string; digest?: string; counts?: { stations: number; kept: number; manual: number; by_kind: Record<string, number> }; is_public?: boolean; body?: any; layout?: any; rules?: any; kinds?: Record<string, string>; type_ar?: string; code?: string };
const fmt = (iso?: string) => { if (!iso) return ''; try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso; } };

export default function VerifyMapPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const [code, setCode] = useState(''); const [r, setR] = useState<R | null>(null); const [busy, setBusy] = useState(false);
  async function check(c: string) { const v = c.trim().toUpperCase(); if (!v) return; setBusy(true); const res = await fetch(`/api/verify/map?code=${encodeURIComponent(v)}`, { cache: 'no-store' }).then((x) => x.json()).catch(() => null); setR(res && res.success ? res : { valid: false }); setBusy(false); }
  useEffect(() => { const c = new URLSearchParams(window.location.search).get('code') || ''; if (c) { setCode(c.toUpperCase()); void check(c); } }, []);
  return <main className="pt-main" dir="rtl" data-testid="vm-root">
    <section className="pt-box" style={{ maxWidth: 980, margin: '0 auto' }}>
      <p className="pt-muted" style={{ margin: 0, color: '#b45309', fontWeight: 800 }}>أَثَر · P58 · خريطة الأثر الذاتية للمتعلّم</p>
      <h1 style={{ margin: '4px 0' }}>تحقّق من «خريطة أثري»</h1>
      <p className="pt-muted">أدخل رمز اللقطة (مثل ATH-MP-7K2Q-9M4X). نُظهر السنة وتاريخ التوقيع وسلامة البصمة وأعداد المحطات والخيوط — <b>ولا نُظهر الخريطة نفسها إلا إن جعلها صاحبها عامة</b>، وبوجهها العام فقط: بلا أسماء أشخاص، وحالات اليوم بموضوعها لا بعنوانها.</p>
      <form onSubmit={(e) => { e.preventDefault(); void check(code); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ATH-MP-XXXX-XXXX" aria-label="رمز اللقطة" style={{ flex: 1, minWidth: 220, border: '1.5px solid #cbd5e1', borderRadius: 10, padding: '9px 12px', fontFamily: 'inherit', fontSize: 15, letterSpacing: 1 }} data-testid="vm-code" />
        <button type="submit" className="pt-btn" disabled={busy} data-testid="vm-check"><Icon name="search" size={14} /> {busy ? '…' : 'تحقّق'}</button>
      </form>
      {r && !r.valid && <div role="alert" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px', fontWeight: 800 }} data-testid="vm-invalid">لا توجد لقطة بهذا الرمز.</div>}
      {r && r.valid && r.revoked && <div role="alert" style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa', borderRadius: 12, padding: '10px 14px', fontWeight: 800 }} data-testid="vm-revoked">أُبطلت هذه اللقطة ({r.title_ar}) — أبطلها صاحبها أو أعاد توقيعها بلقطة أحدث؛ لم يعد هذا الرمز نافذًا.</div>}
      {r && r.valid && !r.revoked && <div data-testid="vm-valid">
        <div style={{ background: r.intact ? '#f0fdf4' : '#fef2f2', color: r.intact ? '#166534' : '#b91c1c', border: `1px solid ${r.intact ? '#bbf7d0' : '#fecaca'}`, borderRadius: 12, padding: '10px 14px', fontWeight: 800 }}>{r.intact ? '✓ لقطة صحيحة والبصمة سليمة — لم تتغيّر منذ توقيعها' : '⚠ الرمز صحيح لكن البصمة لا تطابق المحتوى'}</div>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', margin: '12px 0' }}>
          <dt className="pt-muted">النوع</dt><dd style={{ margin: 0 }}>{r.type_ar}</dd>
          <dt className="pt-muted">العنوان</dt><dd style={{ margin: 0, fontWeight: 800 }}>{r.title_ar}</dd>
          <dt className="pt-muted">وُقّعت</dt><dd style={{ margin: 0 }}>{fmt(r.signed_at)}</dd>
          {r.counts && <><dt className="pt-muted">المحطات</dt><dd style={{ margin: 0 }}>{r.counts.stations}</dd><dt className="pt-muted">الخيوط المبقاة</dt><dd style={{ margin: 0 }}>{r.counts.kept}{r.counts.manual ? ` (منها ${r.counts.manual} نسجها صاحبها بنفسه)` : ''}</dd></>}
          <dt className="pt-muted">البصمة</dt><dd style={{ margin: 0, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{r.digest}</dd>
          <dt className="pt-muted">الظهور</dt><dd style={{ margin: 0 }}>{r.is_public ? 'عامة برابط — أدناه الكوكبة بوجهها العام' : 'خاصّة — لا تُعرض الخريطة؛ الأعداد والبصمة فقط'}</dd>
        </dl>
        {r.is_public && r.body && r.layout && <div data-testid="vm-map">
          <AtharMapSvg stations={r.body.stations} threads={r.body.threads.map((t: any) => ({ ...t, status: 'kept' }))} layout={r.layout} rules={r.rules} title_ar={r.title_ar} />
          {r.body.mirror_ar?.length ? <ul style={{ margin: '10px 0', paddingInlineStart: 18, color: '#7c2d12', fontWeight: 800 }}>{r.body.mirror_ar.map((l: string, i: number) => <li key={i}>{l}</li>)}</ul> : null}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>{r.body.threads.map((t: any) => { const a = r.body.stations.find((s: any) => s.key === t.from); const b = r.body.stations.find((s: any) => s.key === t.to); return <li key={`${t.from}>${t.to}`} style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 12, padding: '8px 12px', fontSize: 14, lineHeight: 1.8 }}><span style={{ fontSize: 11, color: '#0e7490', fontWeight: 800 }}>{r.rules?.[t.rule]?.title}</span><br /><b>{a?.title_ar}</b> ⟵ <b>{b?.title_ar}</b><br /><span style={{ color: '#7c2d12', fontWeight: 800 }}>«لأن {t.note_ar}»</span></li>; })}</ul>
        </div>}
      </div>}
      <p className="pt-muted" style={{ marginTop: 14 }}>اللقطة يكتبها المتعلّم بنفسه من محطات وقعت فعلًا؛ تُثبت البصمة أنها لم تتغيّر، ولا تُثبت تقييمًا ولا مستوى. <Link href="/">الرئيسية</Link> · <Link href="/verify/letter">تحقّق من رسالة الشهر</Link></p>
    </section>
  </main>;
}
