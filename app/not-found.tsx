// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** صفحة «لم نجد هذا الطريق» — بديل أَثَري لـ 404: الرئيسة · الردهة · الدليل · تلميح «نادِ».
 *  مكوّن خادم بلا أي JavaScript للعميل عمدًا: not-found الجذرية تدخل حزمة كل صفحة، وميزانية P40 (/miaar ≤ 340 ك.ب) لا تحتمل غرامًا زائدًا. زرّ الرجوع يوفّره شريط «الطريق» أعلاه. */

export default function NotFound() {
  return (
    <main id="main" dir="rtl" className="nf" data-testid="not-found">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="nf-card" aria-labelledby="nf-h">
        <span className="nf-kicker">أَثَر · الطريق</span>
        <h1 id="nf-h">لم نجد هذا الطريق</h1>
        <p>الصفحة التي طلبتها غير موجودة أو انتقلت إلى مكان آخر. اختر أحد هذه الروابط، أو زرّ «رجوع» في متصفحك:</p>
        <div className="nf-actions">
          <a href="/" className="nf-btn gold" data-testid="nf-home">الرئيسة</a>
          <a href="/hub" className="nf-btn" data-testid="nf-hub">صفحاتي</a>
          <a href="/help" className="nf-btn">دليل أَثَر</a>
        </div>
        <p className="nf-hint">أو اضغط زرّ الميكروفون «نادِ» (Alt+M) وقل: <b>«خذني إلى مِعيار»</b> أو <b>«أين أنا؟»</b> — أو ابحث بـ Ctrl+K.</p>
      </section>
    </main>
  );
}

const CSS = `.nf{min-height:60vh;display:grid;place-items:center;padding:48px 16px;font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif;color:#3A1F36}
.nf-card{max-width:560px;width:100%;background:#fff;border:1px solid #EADFD6;border-radius:20px;padding:28px 26px;box-shadow:0 10px 30px rgba(42,22,38,.08);text-align:center}
.nf-kicker{font-size:12px;font-weight:800;color:#D4614A}.nf h1{margin:6px 0 8px;font-size:26px;font-weight:900}.nf p{margin:0 0 14px;color:#5C4858;line-height:1.8}
.nf-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:14px 0 8px}
.nf-btn{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #D9CBC2;background:#fff;color:#3A1F36;font-weight:800;text-decoration:none}
.nf-btn.gold{background:#D9A866;border-color:#D9A866;color:#2A1626}.nf-btn:focus-visible{outline:3px solid #D4614A;outline-offset:2px}.nf-hint{font-size:13px;color:#8E7F8A;margin:0}`;
