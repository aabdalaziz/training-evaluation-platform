'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /verify/form?code=ATH-FM-XXXX-XXXX — P68-ب ★2 «الختم على الورقة»: تحقّق عام من نموذج اختبار مثبَّت — بلا نصوص بنود: الرمز والإصدار والحالة وعدد البنود وخلاياه وبصمته وكم جلسة حُكمت به */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../components/PortalShell';
import { Icon } from '../../../lib/ui/icons';

type R = { ok?: boolean; valid: boolean; intact?: boolean; status?: string; live?: boolean; form?: { code: string; version: number; n: number; cells: Record<string, number>; frozen_at: string | null; withdrawn_at: string | null; invite_label: string; blueprint: string; duration_minutes: number | null; sessions: number; versions: number; signed: boolean } };
const SK: Record<string, string> = { grammar_vocab: 'القواعد والمفردات', reading: 'القراءة', listening: 'الاستماع' };
const fmt = (iso?: string | null) => { if (!iso) return '—'; try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch { return iso; } };
const STATUS_AR: Record<string, string> = { frozen: 'مثبَّت (حيّ)', superseded: 'إصدار قديم — حلّ محلّه إصدار أحدث', withdrawn: 'مسحوب' };

export default function VerifyFormPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const [code, setCode] = useState(''); const [r, setR] = useState<R | null>(null); const [busy, setBusy] = useState(false);
  async function check(c: string) { const v = c.trim().toUpperCase(); if (!v) return; setBusy(true); try { const j = await fetch(`/api/miaar?form=${encodeURIComponent(v)}`, { cache: 'no-store' }).then((x) => x.json()); setR(j && typeof j === 'object' ? (j.ok === false ? { valid: false } : j) : { valid: false }); } catch { setR({ valid: false }); } finally { setBusy(false); } }
  useEffect(() => { const c = new URLSearchParams(window.location.search).get('code') || ''; if (c) { setCode(c.toUpperCase()); void check(c); } }, []);
  const f = r?.form; const good = !!(r?.valid && r.intact);
  return <main className="pt-main" dir="rtl" data-testid="vf-root">
    <section className="pt-box" style={{ maxWidth: 720, margin: '0 auto' }}>
      <p className="pt-muted" style={{ margin: 0, color: '#0b8a83', fontWeight: 800 }}>مِعيار — من أَثَر · النموذج المثبَّت · ختم ATH-FM</p>
      <h1 style={{ margin: '4px 0' }}>تحقّق من «نموذج اختبار مثبَّت»</h1>
      <p className="pt-muted">أدخل رمز النموذج المطبوع على نسخة المراقب أو التقرير التفصيلي (مثل ATH-FM-7K2Q-9M4X). نُظهر أن كل من امتُحن على هذه الدعوة حُكم بالورقة نفسها بهذه البصمة — بلا أي نصّ سؤال.</p>
      <form onSubmit={(e) => { e.preventDefault(); void check(code); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ATH-FM-XXXX-XXXX" aria-label="رمز النموذج" dir="ltr" style={{ flex: 1, minWidth: 220, border: '1px solid #cbd5e1', borderRadius: 10, padding: '8px 12px', fontFamily: 'ui-monospace, monospace' }} data-testid="vf-code" />
        <button type="submit" className="pt-btn" disabled={busy} data-testid="vf-check"><Icon name="search" size={14} /> {busy ? '…' : 'تحقّق'}</button>
      </form>
      {r && !r.valid && <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px' }} data-testid="vf-invalid"><b>لا يوجد نموذج بهذا الرمز.</b> تأكّد من الحروف (لا O ولا I ولا 0 ولا 1).</div>}
      {r && r.valid && f && <div role="status" style={{ background: good && r.live ? '#ecfdf5' : good ? '#f8fafc' : '#fffbeb', border: `1px solid ${good && r.live ? '#a7f3d0' : good ? '#cbd5e1' : '#fcd34d'}`, borderRadius: 12, padding: '10px 14px' }} data-testid="vf-valid">
        <b data-testid="vf-state">{!r.intact ? '⚠ نموذج موجود لكن بصمته لا تطابق بنوده' : r.live ? '✓ نموذج مثبَّت صادر من أَثَر وبصمته سليمة — وهو الإصدار الحيّ للدعوة' : r.status === 'withdrawn' ? '○ نموذج صادر من أَثَر وبصمته سليمة — لكنه مسحوب' : '○ نموذج صادر من أَثَر وبصمته سليمة — إصدار قديم'}</b>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', margin: '8px 0 0' }}>
          <dt>الرمز</dt><dd style={{ margin: 0 }} dir="ltr">{f.code} <span className="pt-muted">v{f.version}</span></dd>
          <dt>الحالة</dt><dd style={{ margin: 0 }} data-testid="vf-status">{STATUS_AR[String(r.status)] || r.status}{f.versions > 1 ? ` · ${f.versions} إصدارات` : ''}</dd>
          <dt>الدعوة</dt><dd style={{ margin: 0 }}><bdi>{f.invite_label || '—'}</bdi>{f.blueprint ? <> <span className="pt-muted">(المخطَّط <bdi dir="ltr">{f.blueprint}</bdi>)</span></> : null}</dd>
          <dt>البنود</dt><dd style={{ margin: 0 }} data-testid="vf-n">{f.n} بندًا{f.duration_minutes ? ` · ${f.duration_minutes} دقيقة` : ''} — {Object.entries(f.cells).map(([k, n]) => { const [l, s] = k.split(':'); return `${l} ${SK[s] || s} ${n}`; }).join(' · ')}</dd>
          <dt>ثُبِّت في</dt><dd style={{ margin: 0 }}>{fmt(f.frozen_at)}</dd>
          {f.withdrawn_at ? <><dt>سُحب في</dt><dd style={{ margin: 0 }}>{fmt(f.withdrawn_at)}</dd></> : null}
          <dt>الجلسات</dt><dd style={{ margin: 0 }} data-testid="vf-sessions">{f.sessions} جلسة حُكمت بهذه الورقة</dd>
          <dt>التوقيع</dt><dd style={{ margin: 0 }}>{f.signed ? 'موقَّع Ed25519 بمفتاح أَثَر' : 'بصمة بلا توقيع (المفتاح غير مضبوط)'}</dd>
        </dl>
        <p className="pt-muted" style={{ margin: '8px 0 0' }}>نصوص الأسئلة لا تظهر هنا ولا في أي صفحة عامة — تبقى في نسخة المشرف داخل الطاقم.</p>
      </div>}
      <p className="pt-muted" style={{ marginTop: 14 }}><Link href="/verify">← كل أنواع التحقّق</Link> · <Link href="/miaar">مِعيار</Link> · <Link href="/">الرئيسية</Link></p>
    </section>
  </main>;
}
