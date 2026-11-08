'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P68-(ب) «التقرير التفصيلي» — /miaar/result/<code>/detail
 *  لكل مهارة: صحيح/إجمالي ومتوسط الزمن · لكل واصف CEFR «أستطيع أن…»: قوّة / في الطريق / فجوة · لكل بند: الرمز · المستوى · المهارة · ✓/✗ · الزمن
 *  نصوص الأسئلة لا تظهر للمتقدّم (حماية البنك) — تظهر فقط في «نسخة المصحّح» حين يكون المتصفّح لطاقم مسجَّل.
 *  testids: dr-root dr-skill dr-desc dr-item dr-print dr-grader dr-err
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

type Item = { no: number; code: string; level: string; skill: string; skill_ar: string; descriptor_code: string | null; descriptor_ar: string | null; result: 'correct' | 'wrong' | 'blank'; result_ar: string; seconds: number | null; text?: string | null };
type Desc = { code: string; skill: string; skill_ar: string; level: string; text_ar: string; text_en: string | null; total: number; correct: number; percent: number; state: 'strong' | 'developing' | 'gap' | 'unmeasured' };
type Sk = { skill: string; skill_ar: string; total: number; correct: number; blank: number; percent: number | null; avg_seconds: number | null; human?: { percent: number | null; state: string } };
type Detail = { code: string; first_name: string; taken_at: string; level: string | null; exam_mode: string | null; is_exit: boolean; exit_level: string | null; exit_result: string | null; totals: { items: number; correct: number; blank: number; percent: number | null; minutes: number | null }; skills: Sk[]; descriptors: Desc[]; items: Item[]; with_text: boolean; note_ar: string };
const STATE_AR = { strong: 'قوّة', developing: 'في الطريق', gap: 'فجوة', unmeasured: 'لم يُقَس' } as const;
const fmt = (iso: string) => { try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { dateStyle: 'long', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso.slice(0, 10); } };
const sec = (s: number | null) => (s === null ? '—' : s < 60 ? `${s} ث` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

export default function DetailReport({ code, fontClass }: { code: string; fontClass?: string }) {
  const [d, setD] = useState<Detail | null>(null); const [err, setErr] = useState(''); const [grader, setGrader] = useState(false);
  useEffect(() => { (async () => {
    try {
      let tk = ''; try { const { data } = await supabase().auth.getSession(); tk = data.session?.access_token || ''; } catch { tk = ''; }
      if (tk) { const a = await fetch(`/api/admin/miaar?detail=${encodeURIComponent(code)}`, { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }); if (a.ok) { const j = await a.json(); if (j?.success && j.detail) { setD(j.detail); setGrader(true); return; } } }
      const r = await fetch(`/api/miaar?detail=${encodeURIComponent(code)}`, { cache: 'no-store' }); const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) { setErr(j.error === 'not_found' ? 'لا توجد نتيجة بهذا الرمز.' : 'تعذّر التحميل — حاول لاحقًا.'); return; } setD(j.detail);
    } catch { setErr('تعذّر التحميل — حاول لاحقًا.'); }
  })(); }, [code]);
  return <div className={`dr ${fontClass || ''}`} dir="rtl" lang="ar" data-testid="dr-root"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="dr-bar no-print"><a href={`/miaar/result/${code}`}>← بطاقة المستوى</a><span>مِعيار — من أَثَر · التقرير التفصيلي</span><button type="button" onClick={() => window.print()} data-testid="dr-print">طباعة / PDF</button></div>
    {err ? <p className="dr-err" data-testid="dr-err">{err}</p> : !d ? <p className="dr-wait">…</p> : <article className="dr-paper">
      <header className="dr-head"><div><small>مِعيار — من أَثَر · {d.is_exit ? 'اختبار نهاية المستوى «عُبور»' : 'اختبار تحديد المستوى'}</small><h1>التقرير التفصيلي</h1><p>{d.first_name} · {fmt(d.taken_at)}{d.exam_mode ? ` · ${d.exam_mode}` : ''}{d.totals.minutes ? ` · ${d.totals.minutes} دقيقة` : ''}</p></div>
        <div className="dr-sum"><b>{d.is_exit ? (d.exit_level || d.level || '—') : (d.level || '—')}</b><small>{d.is_exit ? (d.exit_result === 'passed' ? 'اجتاز' : d.exit_result === 'conditional' ? 'اجتياز مشروط' : d.exit_result === 'failed' ? 'لم يجتز' : 'قيد التصحيح') : 'المستوى المثبَت'}</small><em dir="ltr">{d.code}</em></div></header>
      {grader && <p className="dr-grader" data-testid="dr-grader">نسخة المصحّح — تحوي نصوص البنود. لا تُسلَّم للمتقدّم.</p>}

      <h2>المهارات</h2>
      <table className="dr-t"><thead><tr><th>المهارة</th><th>صحيح / إجمالي</th><th>النسبة من المُجاب</th><th>لم يُجب</th><th>متوسط الزمن للبند</th></tr></thead><tbody>
        {d.skills.map((s) => <tr key={s.skill} data-testid="dr-skill"><td>{s.skill_ar}{s.human ? <small> · تصحيح بشري</small> : null}</td><td>{s.human ? '—' : `${s.correct} / ${s.total}`}</td><td><b>{s.percent === null ? (s.human?.state === 'pending' ? 'قيد التصحيح' : '—') : `${s.percent}%`}</b></td><td>{s.human ? '—' : s.blank}</td><td>{sec(s.avg_seconds)}</td></tr>)}
        <tr className="dr-total"><td>البنود الموضوعية كلّها</td><td>{d.totals.correct} / {d.totals.items}</td><td><b>{d.totals.percent === null ? '—' : `${d.totals.percent}%`}</b></td><td>{d.totals.blank}</td><td></td></tr>
      </tbody></table>

      <h2>الواصفات «أستطيع أن…» <small>قوّة ≥ 75% · في الطريق 50–74% · فجوة &lt; 50%</small></h2>
      {d.descriptors.length ? <ul className="dr-descs">{d.descriptors.map((x) => <li key={x.code} className={x.state} data-testid="dr-desc"><span className="dr-tag">{STATE_AR[x.state]}</span><div><b>{x.text_ar}</b><small>{x.skill_ar} · {x.level} · {x.correct}/{x.total} · <code dir="ltr">{x.code}</code></small></div><strong>{x.percent}%</strong></li>)}</ul> : <p className="dr-note">بنود هذه الجلسة لم تُوسم بواصفات بعد — يظهر هذا المقطع حين يُوسم البنك.</p>}

      <h2>البنود <small>{d.items.length} بندًا بترتيب العرض</small></h2>
      <table className="dr-t dr-items"><thead><tr><th>#</th><th>الرمز</th><th>المهارة</th><th>المستوى</th><th>الواصف</th>{grader ? <th>نصّ البند</th> : null}<th>النتيجة</th><th>الزمن</th></tr></thead><tbody>
        {d.items.map((it) => <tr key={it.code} className={it.result} data-testid="dr-item"><td>{it.no}</td><td><code dir="ltr">{it.code}</code></td><td>{it.skill_ar}</td><td>{it.level}</td><td><small>{it.descriptor_ar || (it.descriptor_code ? <code dir="ltr">{it.descriptor_code}</code> : '—')}</small></td>{grader ? <td className="dr-text">{it.text || '—'}</td> : null}<td><b>{it.result === 'correct' ? '✓' : it.result === 'wrong' ? '✗' : '○'}</b> {it.result_ar}</td><td>{sec(it.seconds)}</td></tr>)}
      </tbody></table>
      <p className="dr-note">{d.note_ar} الزمن تقريبي من فروق أوقات الإجابة. هذا التقرير لا يغيّر النتيجة ولا الدرجة — هو مرآة لما جرى في الجلسة.</p>
      <footer className="dr-foot">مِعيار — من أَثَر · بوابة أَثَر · © 2026 د. أحمد محمد عبدالعزيز بدوي</footer>
    </article>}
  </div>;
}

const CSS = `
.dr{min-height:100vh;background:#eef2f7;padding:12px 8px;font-family:Tajawal,"Noto Naskh Arabic",Arial,sans-serif;color:#0f2a4e}
.dr-bar{max-width:210mm;margin:0 auto 10px;display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px}.dr-bar a{color:#0b8a83;font-weight:800;text-decoration:none}.dr-bar button{border:1px solid #0b8a83;background:#0b8a83;color:#fff;border-radius:10px;padding:8px 16px;font:inherit;font-weight:800;cursor:pointer}
.dr-paper{max-width:210mm;margin:0 auto;background:#fff;border-radius:14px;padding:16mm 14mm;box-shadow:0 2px 12px rgba(15,42,78,.08)}
.dr-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:3px solid #0b8a83;padding-bottom:10px}.dr-head small{color:#0b8a83;font-weight:800;font-size:12px}.dr-head h1{margin:2px 0;font-size:22px}.dr-head p{margin:0;color:#475569;font-size:13px}
.dr-sum{text-align:center;border:1px solid #e2e8f0;border-radius:12px;padding:8px 14px;min-width:120px}.dr-sum b{display:block;font-size:30px;line-height:1.1}.dr-sum small{display:block;color:#475569;font-size:11px}.dr-sum em{display:block;font-style:normal;font-size:11px;font-weight:800;letter-spacing:.05em;margin-top:4px}
.dr-grader{background:#fff7ed;border:1px dashed #fdba74;color:#7c2d12;border-radius:10px;padding:6px 10px;font-size:12.5px;font-weight:800}
.dr h2{font-size:14px;margin:16px 0 6px;color:#0b8a83;display:flex;align-items:center;gap:8px}.dr h2 small{color:#94a3b8;font-weight:700;font-size:11px}.dr h2:after{content:"";flex:1;height:1px;background:#e2e8f0}
.dr-t{width:100%;border-collapse:collapse;font-size:12.5px}.dr-t th{background:#f8fafc;color:#334155;padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-weight:800}.dr-t td{padding:5px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}.dr-t td small{color:#64748b}.dr-total td{font-weight:800;background:#f8fafc}
.dr-items tr.correct td b{color:#047857}.dr-items tr.wrong td b{color:#b91c1c}.dr-items tr.blank td b{color:#94a3b8}.dr-text{font-size:11.5px;color:#334155;max-width:260px}
.dr-descs{list-style:none;margin:0;padding:0}.dr-descs li{display:flex;align-items:center;gap:10px;border:1px solid #e2e8f0;border-radius:10px;padding:6px 10px;margin:4px 0}.dr-descs li div{flex:1}.dr-descs li b{display:block;font-size:13px}.dr-descs li small{color:#64748b;font-size:11px}.dr-descs li strong{font-size:16px;min-width:48px;text-align:center}
.dr-tag{font-size:11px;font-weight:800;border-radius:999px;padding:2px 10px;background:#f1f5f9;color:#334155;flex:none}.dr-descs li.strong .dr-tag{background:#dcfce7;color:#166534}.dr-descs li.developing .dr-tag{background:#fef9c3;color:#854d0e}.dr-descs li.gap .dr-tag{background:#fee2e2;color:#991b1b}.dr-descs li.unmeasured{opacity:.7}.dr-descs li.unmeasured .dr-tag{background:#f1f5f9;color:#64748b}
.dr-note{color:#64748b;font-size:12px;margin:10px 0 0}.dr-foot{margin-top:12px;border-top:1px solid #e2e8f0;padding-top:6px;font-size:11px;color:#94a3b8;text-align:center}
.dr-err{max-width:600px;margin:40px auto;text-align:center;color:#991b1b;font-weight:800}.dr-wait{text-align:center;padding:40px}
@media print{@page{size:A4;margin:8mm}.dr{background:#fff;padding:0}.dr-bar,.no-print,footer,nav,.way-bar,[data-testid="way-bar"],[data-testid="nadi-fab"],.nadi-fab,[data-testid="athir-fab"],.athir-fab,.pt-skip{display:none!important}.dr-paper{box-shadow:none;border-radius:0;padding:4mm 6mm;max-width:none}}
`;
