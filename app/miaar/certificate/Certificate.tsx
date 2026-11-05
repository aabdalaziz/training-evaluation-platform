'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «شهادة اجتياز المستوى» — /miaar/certificate/<ML-code> (م6 «عُبور»)
 *  تُصدر فقط حين يكون حكم نهاية المستوى نهائيًا و«اجتاز». A4 ثنائية اللغة، رمز التحقّق = رمز النتيجة (الصفحة نفسها تتحقّق).
 *  لا اسم كامل خارج الشهادة ولا بريد. الطباعة من المتصفح (بلا PDF على الخادم — قرار قائم).
 */
import { useCallback, useEffect, useState } from 'react';
import WayBar from '../../components/WayBar';

type Res = { code: string; name: string; taken_at: string; report: any };
const SK: Record<string, [string, string]> = { listening: ['الاستماع', 'Listening'], reading: ['القراءة', 'Reading'], grammar_vocab: ['المفردات والتراكيب', 'Use of language'], writing: ['الكتابة', 'Writing'], speaking: ['التحدّث', 'Speaking'] };
const LV: Record<string, [string, string]> = { A1: ['مبتدئ', 'Beginner'], A2: ['أساسي', 'Elementary'], B1: ['متوسط', 'Intermediate'], B2: ['فوق المتوسط', 'Upper-intermediate'], C1: ['متقدم', 'Advanced'], C2: ['إتقان', 'Proficient'] };
const day = (iso: string, ar: boolean) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(ar ? 'ar-SA' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' }); };

export default function Certificate({ code, fontClass = '' }: { code: string; fontClass?: string }) {
  const [r, setR] = useState<Res | null>(null); const [err, setErr] = useState<string | null>(null); const [site, setSite] = useState('');
  const load = useCallback(async () => {
    try { const res = await fetch(`/api/miaar?result=${encodeURIComponent(code)}`, { cache: 'no-store' }); const d = await res.json(); if (!res.ok || !d.ok) { setErr('nf'); return; } setR(d as Res); } catch { setErr('nf'); }
  }, [code]);
  useEffect(() => { void load(); setSite(window.location.origin); }, [load]);
  const ex = r?.report?.exit; const integ = (r?.report as any)?.نزاهة || null; const annulled = integ?.الحالة === 'invalid'; /* م8: «لاغٍ» يحجب الشهادة */ const ok = !!ex && ex.الحالة === 'final' && ex.النتيجة === 'passed' && !annulled;
  const svc = r?.report?.شهادة || null; const fullName = (svc?.الاسم_الكامل as string) || r?.name || ''; /* م7: الاسم الكامل على الوثيقة + الجهة الطالبة + ختم المراقب */
  const verifyUrl = `${site}/miaar/result/${encodeURIComponent(code)}`;
  return <main className={`cert-root ${fontClass}`} dir="rtl">
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="cert-tools no-print"><WayBar lang="ar" /><div className="cert-actions"><a className="cert-btn ghost" href={`/miaar/result/${encodeURIComponent(code)}`} data-testid="cert-back">← بطاقة النتيجة</a>{ok && <button type="button" className="cert-btn" onClick={() => window.print()} data-testid="cert-print">طباعة / حفظ PDF</button>}</div></div>
    {err && <section className="cert-msg" role="alert" data-testid="cert-nf">لا نتيجة بهذا الرمز.</section>}
    {r && !ex && <section className="cert-msg" data-testid="cert-not-exit">هذه النتيجة ليست لاختبار نهاية المستوى — الشهادة تُصدر لنتائج «اختبار نهاية المستوى — معياري (CEFR)» فقط.</section>}
    {r && ex && annulled && <section className="cert-msg" role="alert" data-testid="cert-annulled">أُبطلت هذه المحاولة بقرار بشري بعد مراجعة سجلّ نزاهة الاختبار — لا تُصدر لها شهادة.{integ?.ملاحظة ? ` السبب: ${integ.ملاحظة}` : ''}</section>}
    {r && ex && !ok && !annulled && <section className="cert-msg" data-testid="cert-not-passed">{ex.الحالة !== 'final' ? 'لم يكتمل التصحيح بعد — تُصدر الشهادة حين يصبح الحكم نهائيًا.' : 'لم يُجتز هذا المستوى بعد — لا تُصدر شهادة إلا عند الاجتياز.'}</section>}
    {r && ok && <article className="cert" data-testid="cert" aria-label="شهادة اجتياز المستوى">
      <header className="cert-head">
        <div className="cert-brand"><b>أَثَر</b><small>مِعيار — من أَثَر</small></div>
        <div className="cert-brand en" dir="ltr"><b>Athar</b><small>Miaar by Athar</small></div>
      </header>
      <p className="cert-k">شهادة اجتياز المستوى · Certificate of Level Completion</p>
      <h1>{fullName}</h1>
      <p className="cert-line">اجتاز(ت) <b>اختبار نهاية المستوى — معياري (CEFR)</b> للمستوى <b>{ex.المستوى} — {LV[ex.المستوى]?.[0] || ''}</b> بنتيجة كلّية <b>{ex.الكلي}%</b> وتقدير <b>{ex.تقدير_ar}</b> بتاريخ {day(r.taken_at, true)}.</p>
      <p className="cert-line en" dir="ltr">has passed the <b>Level Exit Examination (CEFR-aligned)</b> for level <b>{ex.المستوى} — {LV[ex.المستوى]?.[1] || ''}</b> with an overall score of <b>{ex.الكلي}%</b>, grade <b>{ex.grade_en}</b>, on {day(r.taken_at, false)}.</p>
      <table className="cert-table"><thead><tr><th>المحور · Domain</th><th>النسبة · Score</th></tr></thead><tbody>
        {['listening', 'reading', 'grammar_vocab', 'writing', 'speaking'].map((k) => { const v = ex.المهارات?.[k]; if (!v || v.الحالة === 'na') return null; return <tr key={k}><td>{SK[k][0]} · {SK[k][1]}</td><td>{typeof v.النسبة === 'number' ? `${v.النسبة}%` : '—'}</td></tr>; })}
        <tr className="tot"><td>النتيجة الكلّية · Overall (60 / 20 / 20)</td><td>{ex.الكلي}%</td></tr>
      </tbody></table>
      {ex.خط_العبور && <p className="cert-growth">{ex.خط_العبور.text_ar}</p>}
      {!(svc?.خارجي && svc?.بطلب_من) && integ?.الحالة === 'clear' && <p className="cert-svc"><span className="cert-seal" data-testid="cert-integrity">◉ أُدّي تحت مراقبة مصوَّرة — سجلّ النزاهة: سليم · Integrity record: clear</span></p>}
      {svc?.خارجي && svc?.بطلب_من && <p className="cert-svc" data-testid="cert-svc"><span>بطلب من · Requested by: <b>{svc.بطلب_من}</b></span>{integ?.الحالة === 'clear' && <span className="cert-seal" data-testid="cert-integrity">◉ أُدّي تحت مراقبة مصوَّرة — سجلّ النزاهة: سليم · Integrity record: clear</span>}{svc.بحضور_مراقب && <span className="cert-seal" data-testid="cert-seal">أُدّي بحضور مراقب · Taken under proctor supervision{svc.المراقب ? ` — ${svc.المراقب}` : ''}</span>}</p>}
      <footer className="cert-foot">
        <div><small>جدول المواصفات · Specification</small><b>{ex.إصدار_المواصفات}</b></div>
        <div><small>رمز التحقّق · Verification code</small><b dir="ltr">{code}</b></div>
        <div><small>التحقّق · Verify</small><b dir="ltr" className="cert-url">{verifyUrl.replace(/^https?:\/\//, '')}</b></div>
      </footer>
      <p className="cert-legal">تصدر هذه الشهادة من منصّة أَثَر بناءً على اختبار معياري مُحكَم؛ التصحيح البشري للكتابة والتحدّث بمصحّحين معايَرين. © 2026 د. أحمد محمد عبدالعزيز بدوي — جميع الحقوق محفوظة.</p>
    </article>}
  </main>;
}

const CSS = `
.cert-root{min-height:100vh;background:#f1f5f9;padding:0 0 40px;font-family:var(--font-ruqaa, system-ui),system-ui,sans-serif;color:#0f2a4e}
.cert-tools{max-width:900px;margin:0 auto;padding:10px 16px}.cert-actions{display:flex;gap:10px;justify-content:space-between;align-items:center;margin:8px 0 12px;flex-wrap:wrap}
.cert-btn{display:inline-flex;align-items:center;min-height:40px;padding:0 16px;border-radius:12px;border:1px solid #0f2a4e;background:#0f2a4e;color:#fff;font-weight:800;cursor:pointer;text-decoration:none;font:inherit}.cert-btn.ghost{background:#fff;color:#0f2a4e}
.cert-msg{max-width:900px;margin:20px auto;padding:16px;border-radius:14px;background:#fff;border:1px solid #e2e8f0;line-height:1.8}
.cert{max-width:900px;margin:0 auto;background:#fff;border:10px double #c9a24b;padding:36px 40px;box-shadow:0 10px 40px rgba(15,42,78,.08);position:relative}
.cert-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px}.cert-brand b{display:block;font-size:26px;color:#0f2a4e}.cert-brand small{display:block;color:#0b8a83;font-weight:700}
.cert-k{margin:0;color:#c9a24b;font-weight:800;letter-spacing:.3px;text-align:center}.cert h1{margin:8px 0 18px;text-align:center;font-size:34px;color:#0f2a4e}
.cert-line{margin:0 0 10px;font-size:17px;line-height:1.9;text-align:center}.cert-line.en{color:#334155;font-size:15px}
.cert-table{width:100%;border-collapse:collapse;margin:18px 0 10px;font-size:14px}.cert-table th,.cert-table td{border:1px solid #e2e8f0;padding:7px 10px;text-align:start}.cert-table th{background:#f8fafc}.cert-table tr.tot td{font-weight:800;background:#fffdf5}
.cert-growth{margin:10px 0 0;padding:10px 14px;border:1px dashed #c9a24b;border-radius:10px;font-weight:700;background:#fffdf5}
.cert-svc{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:12px 0 0;font-size:13px;color:#334155}.cert-seal{display:inline-flex;align-items:center;padding:4px 10px;border:1.5px solid #0b8a83;border-radius:999px;color:#0b8a83;font-weight:800}
.cert-foot{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:22px;padding-top:14px;border-top:1px solid #e2e8f0}.cert-foot small{display:block;color:#64748b;font-size:12px}.cert-foot b{display:block;font-size:14px;word-break:break-all}.cert-url{font-size:12px}
.cert-legal{margin:16px 0 0;font-size:11px;color:#64748b;line-height:1.7;text-align:center}
@media print{.no-print{display:none !important}.cert-root{background:#fff;padding:0}.cert{box-shadow:none;margin:0;max-width:none;border-width:8px}@page{size:A4;margin:12mm}}
@media (max-width:640px){.cert{padding:22px 16px}.cert h1{font-size:26px}.cert-foot{grid-template-columns:1fr}}
`;
