'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «دليل الميسّر» (هـ-6-ي) — الافتتاحية (ج) + «ورقة اللقاء» للطباعة.
 *  الوصول: بالرابط للمسجّلين دخولًا (قرار المالك) — لا دور جديد ولا SQL. غير المسجّل يُحال إلى الدخول.
 *  الدليل يُفتح تلقائيًّا أوّل مرّة (localStorage) ويُعاد من زرّ. لا شيء يُرسَل إلى الخادم.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { hasStoredSession } from '../../../lib/supabase/lazy';
import { FACILITATOR_SHEET, FACILITATOR_SEEN_KEY, INTRO_FACILITATORS } from '../../../lib/kids/intro';
import { BayanIntro } from './BayanIntro';

export function FacilitatorGuide() {
  const [unauth, setUnauth] = useState(true);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const ok = hasStoredSession(); setUnauth(!ok);
    if (ok) { try { if (!localStorage.getItem(FACILITATOR_SEEN_KEY)) setShow(true); } catch { setShow(true); } }
  }, []);
  const done = () => { setShow(false); try { localStorage.setItem(FACILITATOR_SEEN_KEY, '1'); } catch { /* ignore */ } };

  if (unauth) return (
    <section className="fg-card fg-center" data-testid="fac-unauth">
      <h1>دليل الميسّر 📋</h1>
      <p>الدليل للميسّرين المعتمدين في بَيان — ثلاث دقائق بصوت جدّ سالم، و«ورقة اللقاء» للطباعة.</p>
      <Link className="fg-big" href={`/login?next=${encodeURIComponent('/kids/facilitator')}`}>دخول بحساب أَثَر</Link>
    </section>
  );

  const S = FACILITATOR_SHEET;
  return (
    <>
      {show && <BayanIntro mode="facilitator" onDone={done} onSkip={done} />}
      <section className="fg-card fg-print">
        <header className="fg-head">
          <div>
            <p className="fg-muted">بَيان · للميسّرين</p>
            <h1>ورقة اللقاء الأسبوعيّ</h1>
            <p className="fg-lead">عشرون دقيقة في أربع خطوات ثابتة. المعلّم الحقيقيّ هو البيت، والرفيقة اليوميّة لؤلؤ، وأنت تجعلهما يعملان معًا.</p>
          </div>
          <div className="fg-actions no-print">
            <button className="fg-big" onClick={() => setShow(true)} data-testid="fac-open">شاهِد الدليل ▶ {Math.round(INTRO_FACILITATORS.length / 2)} دقائق</button>
            <button className="fg-ghost" onClick={() => window.print()}>اطبع الورقة 🖨</button>
          </div>
        </header>

        <table className="fg-table">
          <thead><tr><th>الخطوة</th><th>الزمن</th><th>ماذا أفعل</th><th>ماذا لا أفعل</th></tr></thead>
          <tbody>
            {S.steps.map(st => (
              <tr key={st.n}><td><b>{st.n}</b> {st.name}</td><td>{st.min} د</td><td>{st.do}</td><td className="fg-dont">{st.dont}</td></tr>
            ))}
          </tbody>
        </table>

        <div className="fg-grid">
          <div className="fg-box"><h3>ما أراه</h3><p>{S.see}</p></div>
          <div className="fg-box fg-lock"><h3>ما لا أراه ولا أطلبه</h3><p>{S.dontSee}</p></div>
          <div className="fg-box"><h3>أرفع فورًا</h3><ul>{S.raise.map(r => <li key={r}>{r}</li>)}</ul></div>
          <div className="fg-box fg-promise"><h3>أمانتي</h3><p>{S.promise}</p></div>
        </div>

        <div className="fg-notes">
          <h3>دفتري — هذا اللقاء</h3>
          <div className="fg-lines"><span>الأسرة: ________________</span><span>التاريخ: ____ / ____ / ______</span></div>
          <div className="fg-lines"><span>الكلمة التي قالها الطفل من تلقاء نفسه: ______________________________</span></div>
          <div className="fg-lines"><span>اتّفاق الأسبوع القادم (واحد فقط): ______________________________</span></div>
          <div className="fg-lines"><span>وجه اللقاء: ☺️ 😐 😢</span><span>جملة واحدة: ______________________________</span></div>
        </div>
        <p className="fg-muted fg-foot">كرامة الطفل قبل كلّ قياس · البيت قبل كلّ شاشة · ما يحدث في البيت يبقى في البيت</p>
      </section>
    </>
  );
}

export const FACILITATOR_CSS = `
.fg-card{max-width:900px;margin:0 auto;background:#fff;border-radius:24px;padding:24px;box-shadow:0 10px 30px rgba(58,31,54,.08);color:#2A1626;font-family:var(--font-read,var(--font-ar,sans-serif))}
.fg-center{text-align:center}.fg-center h1{color:#3A1F36}.fg-center p{font-size:18px;line-height:1.8;color:#5b4a57}
.fg-head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start}
.fg-head h1{color:#3A1F36;margin:4px 0;font-size:30px}.fg-lead{font-size:17px;line-height:1.8;color:#5b4a57;margin:0;max-width:560px}
.fg-muted{color:#8E7F8A;font-size:14px;margin:0}.fg-foot{margin-top:16px;text-align:center}
.fg-actions{display:flex;flex-direction:column;gap:8px}
.fg-big{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 22px;border-radius:999px;border:0;background:#E8795C;color:#fff;font:inherit;font-size:18px;font-weight:800;cursor:pointer;text-decoration:none;box-shadow:0 8px 20px rgba(232,121,92,.3)}
.fg-ghost{padding:10px 18px;border-radius:999px;border:2px solid #F1D9A8;background:#fff;color:#3A1F36;font:inherit;font-size:16px;cursor:pointer}
.fg-table{width:100%;border-collapse:separate;border-spacing:0;margin:20px 0;font-size:16px;line-height:1.7}
.fg-table th{background:#F1D9A8;color:#3A1F36;padding:10px 12px;text-align:right}.fg-table th:first-child{border-radius:0 14px 0 0}.fg-table th:last-child{border-radius:14px 0 0 0}
.fg-table td{padding:10px 12px;border-bottom:1px solid #F3E7DC;vertical-align:top}.fg-table td:nth-child(2){white-space:nowrap;color:#5EA8A0;font-weight:800}
.fg-dont{color:#A14D3A}
.fg-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.fg-box{background:#FBF4EE;border-radius:16px;padding:12px 14px}.fg-box h3{margin:0 0 6px;font-size:16px;color:#3A1F36}.fg-box p,.fg-box li{margin:0;font-size:15px;line-height:1.7}.fg-box ul{margin:0;padding-inline-start:18px}
.fg-lock{background:#FDECE6}.fg-promise{background:#E6F3F1}
.fg-notes{margin-top:18px;border:2px dashed #F1D9A8;border-radius:16px;padding:12px 14px}.fg-notes h3{margin:0 0 8px;font-size:16px;color:#3A1F36}
.fg-lines{display:flex;gap:24px;flex-wrap:wrap;font-size:15px;line-height:2.2}
@media print{.no-print{display:none!important}.fg-card{box-shadow:none;border-radius:0;padding:0}body{background:#fff}}
`;
