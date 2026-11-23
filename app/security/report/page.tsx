'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /security/report — نموذج بلاغ ثغرة للباحثين (P21): بلا تسجيل دخول · حقل فخّ للروبوتات (مخفي) · 3 بلاغات/ساعة لكل عنوان.
 *  يصل البلاغ حدثًا حرجًا إلى /admin/shield وينبّه الطاقم فورًا، ويحصل الباحث على رقم مرجعي.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell } from '../../components/PortalShell';

export default function SecurityReportPage() { return <PortalShell><Inner /></PortalShell>; }

function Inner() {
  const [f, setF] = useState({ title: '', detail: '', severity: 'medium', contact: '', website_url: '' });
  const [busy, setBusy] = useState(false); const [done, setDone] = useState<{ ref: string; message: string } | null>(null); const [err, setErr] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    const j = await fetch('/api/shield/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }).then(r => r.json()).catch(() => null);
    if (!j?.success) setErr(j?.error || 'تعذّر الإرسال — حاول لاحقًا'); else setDone({ ref: j.ref, message: j.message });
    setBusy(false);
  }
  return (
    <main className="sr" dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="sr-hero"><span className="sr-kicker"><Icon name="shield" size={14} /> درع أَثَر · الإفصاح المسؤول</span><h1>أبلغ عن ثغرة</h1><p>شكرًا لأنك تطرق الباب بدل أن تكسره. اكتب ما وجدت بأكبر قدر من التفصيل (خطوات إعادة الإنتاج، الرابط، الأثر). لا تحتاج حسابًا. اقرأ <Link href="/security">سياسة الأمن</Link> أولًا.</p></section>
      {done ? (
        <section className="sr-card sr-done" data-testid="report-done"><h2>وصل بلاغك</h2><p>{done.message}</p><p>رقمك المرجعي: <code>{done.ref}</code> — احتفظ به للمتابعة.</p><Link className="pt-btn light" href="/security">عودة إلى صفحة الأمن</Link></section>
      ) : (
        <form className="sr-card" onSubmit={submit} data-testid="report-form">
          <label>عنوان مختصر<input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} maxLength={160} required placeholder="مثال: تسريب معلومات في استجابة /api/…" /></label>
          <label>الوصف وخطوات إعادة الإنتاج<textarea value={f.detail} onChange={e => setF({ ...f, detail: e.target.value })} rows={8} maxLength={6000} required placeholder="1) افتح … 2) أرسل … 3) لاحظ أن …" /></label>
          <div className="sr-two">
            <label>الخطورة بتقديرك<select value={f.severity} onChange={e => setF({ ...f, severity: e.target.value })}><option value="low">منخفضة</option><option value="medium">متوسطة</option><option value="high">عالية</option><option value="critical">حرجة</option></select></label>
            <label>وسيلة التواصل (بريد أو معرّف)<input value={f.contact} onChange={e => setF({ ...f, contact: e.target.value })} maxLength={160} placeholder="اختياري — لنردّ عليك ونشكرك" /></label>
          </div>
          <div className="sr-hp" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website_url} onChange={e => setF({ ...f, website_url: e.target.value })} /></label></div>
          {err && <p className="sr-err">{err}</p>}
          <div className="sr-actions"><button type="submit" className="pt-btn gold" disabled={busy} data-testid="report-submit">{busy ? 'جارٍ الإرسال…' : 'أرسل البلاغ'}</button><span className="sr-muted">بإرسالك توافق على قواعد الإفصاح المسؤول: لا تمسّ بيانات غيرك، ولا تُعطّل الخدمة، وامنحنا 90 يومًا قبل النشر.</span></div>
        </form>
      )}
    </main>
  );
}

const CSS = `
.sr{max-width:760px;margin:0 auto;padding:24px 16px 56px;display:grid;gap:14px;font-family:inherit}
.sr-kicker{display:inline-flex;align-items:center;gap:6px;color:#D4614A;font-weight:900;font-size:13px}.sr-hero h1{margin:6px 0;font-size:28px;color:#3A1F36}.sr-hero p{margin:0;color:#5C4858;font-size:14px;line-height:1.9}.sr-hero a{color:#D4614A}
.sr-card{background:#fff;border:1px solid #EADFD6;border-radius:18px;padding:18px;display:grid;gap:12px;box-shadow:0 6px 22px rgba(42,22,38,.05)}.sr-card label{display:grid;gap:6px;font-size:13px;font-weight:800;color:#3A1F36}.sr-card input,.sr-card textarea,.sr-card select{font:inherit;font-size:14px;border:1px solid #E2CBDA;border-radius:10px;padding:10px 12px;color:#3A1F36;background:#fff}.sr-card textarea{resize:vertical;line-height:1.7}
.sr-two{display:grid;gap:12px;grid-template-columns:1fr 1fr}@media (max-width:600px){.sr-two{grid-template-columns:1fr}}
.sr-hp{position:absolute;left:-9999px;top:-9999px;height:0;overflow:hidden}
.sr-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.sr-muted{color:#8E7F8A;font-size:12px;line-height:1.7;max-width:460px}.sr-err{color:#B9544A;background:#FBEDE7;border:1px solid #F3C4B6;border-radius:10px;padding:8px 12px;font-size:13px;margin:0}
.sr-done{border-color:#BFE1DC;background:linear-gradient(180deg,#E6F3F1,#fff)}.sr-done h2{margin:0;color:#2F6B66}.sr-done p{margin:0;color:#4A3645;line-height:1.8}.sr-done code{background:#fff;border:1px solid #EADFD6;border-radius:8px;padding:3px 8px;font-weight:900;color:#3A1F36}
.pt-btn{display:inline-flex;align-items:center;justify-content:center;border:0;background:#3A1F36;color:#fff;border-radius:12px;padding:10px 18px;font:inherit;font-size:14px;font-weight:800;text-decoration:none;cursor:pointer}.pt-btn.gold{background:#D9A866;color:#3A1F36}.pt-btn.light{background:#FBEDE7;color:#2F6B66;justify-self:start}.pt-btn:disabled{opacity:.6}
`;
