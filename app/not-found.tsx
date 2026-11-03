// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** صفحة «لم نجد هذا الطريق» — بديل أَثَري لـ 404: الرئيسية · الردهة · الدليل · تلميح «نادِ».
 *  مكوّن خادم بلا أي JavaScript للعميل عمدًا: not-found الجذرية تدخل حزمة كل صفحة، وميزانية P40 (/miaar ≤ 340 ك.ب) لا تحتمل غرامًا زائدًا. زرّ الرجوع يوفّره شريط «الطريق» أعلاه. */

export default function NotFound() {
  return (
    <main id="main" dir="rtl" className="nf" data-testid="not-found">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="nf-card" aria-labelledby="nf-h">
        <span className="nf-kicker">أَثَر · الطريق</span>
        <h1 id="nf-h">لم نجد هذا الطريق</h1>
        <p>الصفحة التي طلبتها غير موجودة أو انتقلت إلى مكان آخر. اختر أحد هذه الأبواب، أو زرّ «رجوع» في متصفحك:</p>
        <div className="nf-actions">
          <a href="/" className="nf-btn gold" data-testid="nf-home">الرئيسية</a>
          <a href="/hub" className="nf-btn" data-testid="nf-hub">الردهة — أبوابك</a>
          <a href="/help" className="nf-btn">دليل أَثَر</a>
        </div>
        <p className="nf-hint">أو اضغط زرّ الميكروفون «نادِ» (Alt+M) وقل: <b>«خذني إلى مِعيار»</b> أو <b>«أين أنا؟»</b> — أو ابحث بـ Ctrl+K.</p>
      </section>
    </main>
  );
}

const CSS = `.nf{min-height:60vh;display:grid;place-items:center;padding:48px 16px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f2a4e}
.nf-card{max-width:560px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:28px 26px;box-shadow:0 10px 30px rgba(15,42,78,.08);text-align:center}
.nf-kicker{font-size:12px;font-weight:800;color:#0b8a83}.nf h1{margin:6px 0 8px;font-size:26px;font-weight:900}.nf p{margin:0 0 14px;color:#475569;line-height:1.8}
.nf-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:14px 0 8px}
.nf-btn{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;color:#0f2a4e;font-weight:800;text-decoration:none}
.nf-btn.gold{background:#c9a24b;border-color:#c9a24b;color:#1a1a1a}.nf-btn:focus-visible{outline:3px solid #0b8a83;outline-offset:2px}.nf-hint{font-size:13px;color:#64748b;margin:0}`;
