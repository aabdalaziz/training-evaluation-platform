'use client';
// حدود الخطأ العامة للبوابة — بدل شاشة Next.js الصامتة «Application error: a client-side exception has occurred»
// تعرض سبب العطل بالعربية (رسالة الخطأ + المُعرِّف) مع أزرار: إعادة المحاولة · الرئيسية · نسخ التفاصيل.
// لا تعتمد على أي سياق أو مكوّن آخر (قد يكون هو نفسه سبب العطل) — تنسيق مضمّن فقط.
import { useEffect, useState } from 'react';

const CSS = `
.pe-wrap{min-height:70vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:inherit;direction:rtl}
.pe-card{max-width:640px;width:100%;background:#fff;border:1px solid #e3e8ef;border-radius:18px;padding:28px;box-shadow:0 10px 30px rgba(15,42,78,.08)}
.pe-card h1{margin:0 0 6px;font-size:1.35rem;color:#0f2a4e}
.pe-card p{margin:0 0 14px;color:#4a5568;line-height:1.8}
.pe-msg{background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:12px 14px;direction:ltr;text-align:left;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.82rem;color:#7c2d12;white-space:pre-wrap;word-break:break-word;max-height:220px;overflow:auto}
.pe-meta{font-size:.78rem;color:#718096;margin:8px 0 16px}
.pe-row{display:flex;gap:10px;flex-wrap:wrap}
.pe-btn{border:0;border-radius:999px;padding:10px 18px;font-weight:700;cursor:pointer;background:#0b8a83;color:#fff;font-size:.92rem}
.pe-btn.alt{background:#eef2f7;color:#0f2a4e}
.pe-btn.ghost{background:transparent;color:#0b8a83;border:1px solid #0b8a83}
.pe-ok{color:#0b8a83;font-size:.85rem;margin-top:10px}
`;

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { try { console.error('[أَثَر] client error', error); } catch { /* ignore */ } }, [error]);
  const details = `${error?.name || 'Error'}: ${error?.message || '—'}\n${error?.digest ? `digest: ${error.digest}\n` : ''}${typeof window !== 'undefined' ? `url: ${window.location.href}\n` : ''}${error?.stack ? `\n${error.stack}` : ''}`;
  async function copy() { try { await navigator.clipboard.writeText(details); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* ignore */ } }
  function hardReload() {
    try {
      if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.update())).catch(() => { /* ignore */ });
      const cs: CacheStorage | undefined = (globalThis as any).caches;
      if (cs) cs.keys().then(ks => Promise.all(ks.map(k => cs.delete(k)))).catch(() => { /* ignore */ }).finally(() => window.location.reload());
      else window.location.reload();
    } catch { window.location.reload(); }
  }
  return (
    <div className="pe-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pe-card" role="alert">
        <h1>حدث خطأ في عرض هذه الصفحة</h1>
        <p>لم تُفقد بياناتك. جرّب «إعادة المحاولة» أولًا؛ وإن تكرّر الخطأ انسخ التفاصيل أدناه وأرسلها للدعم.</p>
        <div className="pe-msg" data-testid="pe-msg">{(error?.name || 'Error') + ': ' + (error?.message || '—')}</div>
        <div className="pe-meta">{error?.digest ? `المُعرِّف: ${error.digest} · ` : ''}أَثَر · {new Date().toLocaleString('ar-SA')}</div>
        <div className="pe-row">
          <button type="button" className="pe-btn" onClick={() => reset()}>إعادة المحاولة</button>
          <button type="button" className="pe-btn alt" onClick={hardReload}>تحديث كامل (مسح الكاش)</button>
          <button type="button" className="pe-btn ghost" onClick={copy}>نسخ التفاصيل</button>
          <a className="pe-btn alt" href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>الرئيسية</a>
        </div>
        {copied && <div className="pe-ok">نُسخت التفاصيل ✓</div>}
      </div>
    </div>
  );
}
