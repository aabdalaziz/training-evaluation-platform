'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* م17-أ: حدّ الخطأ الجذري — حين يسقط تخطيط الجذر نفسه (آخر خطّ دفاع قبل الصفحة البيضاء). بلا أي استيراد من المشروع. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const chunk = /ChunkLoadError|Loading chunk|dynamically imported module/i.test(`${error?.name} ${error?.message}`);
  return (
    <html lang="ar" dir="rtl"><body style={{ margin: 0, fontFamily: 'system-ui, "Noto Naskh Arabic", serif', background: '#FBF4EE', color: '#3A1F36' }}>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div role="alert" style={{ maxWidth: 560, width: '100%', background: '#fff', border: '1px solid #e3e8ef', borderRadius: 18, padding: 28, boxShadow: '0 10px 30px rgba(42,22,38,.08)' }}>
          <h1 style={{ margin: '0 0 8px', fontSize: '1.3rem' }}>{chunk ? 'صدر تحديث جديد للبوابة' : 'تعذّر عرض البوابة الآن'}</h1>
          <p style={{ margin: '0 0 16px', color: '#4a5568', lineHeight: 1.8 }}>{chunk ? 'اضغط «تحديث» لتحميل النسخة الجديدة.' : 'لم تُفقد بياناتك. جرّب التحديث؛ وإن تكرّر أرسل المُعرِّف للدعم.'}</p>
          {error?.digest ? <div style={{ fontSize: '.78rem', color: '#718096', marginBottom: 14 }}>المُعرِّف: {error.digest}</div> : null}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => { try { window.location.reload(); } catch { reset(); } }} style={{ border: 0, borderRadius: 999, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', background: '#D4614A', color: '#fff' }}>تحديث</button>
            <button type="button" onClick={() => reset()} style={{ border: 0, borderRadius: 999, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', background: '#F3E6DC', color: '#3A1F36' }}>إعادة المحاولة</button>
            <a href="/" style={{ borderRadius: 999, padding: '10px 18px', fontWeight: 700, background: '#F3E6DC', color: '#3A1F36', textDecoration: 'none' }}>الرئيسة</a>
          </div>
        </div>
      </div>
    </body></html>
  );
}
