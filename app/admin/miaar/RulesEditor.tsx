'use client';
/**
 * «تعليمات الاختبار وإقرار الممتحن» (م8-ج) — محرِّر الطاقم داخل لسان «04 دعوات»
 *  - نصّ عربي + إنجليزي بصيغة بسيطة: «## عنوان» · «- نقطة» · فقرة
 *  - معاينة حيّة كما يراها الممتحن · عدّاد النقاط · الإصدار الحالي وآخر تعديل
 *  - «حفظ إصدار جديد» (مديرون فقط): يرفع رقم الإصدار، وكل ممتحن بعده يقرّ بالإصدار الجديد؛
 *    ومن كان على صفحة التعليمات لحظة الحفظ يُعاد إليه النصّ الجديد تلقائيًا (HTTP 428).
 *  - «استعادة النصّ الأصلي» يملأ الحقول بنصّ المصنع دون حفظ.
 */
import { useEffect, useState } from 'react';
import { parseRules, countPoints } from '../../../lib/miaar/rules';

type Rules = { version: number; ar: string; en: string; updated_at: string | null; updated_by?: string | null };
type Data = { rules: Rules; title: string; max: number; factory: { ar: string; en: string }; me: { can_edit: boolean } };

const fmt = (iso: string | null | undefined) => { if (!iso) return '—'; try { return new Date(iso).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };

export default function RulesEditor({ auth }: { auth: () => Promise<Record<string, string>> }) {
  const [d, setD] = useState<Data | null>(null); const [ar, setAr] = useState(''); const [en, setEn] = useState('');
  const [open, setOpen] = useState(false); const [pv, setPv] = useState<'ar' | 'en'>('ar'); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ t: 'ok' | 'err'; s: string } | null>(null);
  const load = async () => { try { const j = await fetch('/api/admin/miaar/rules', { headers: await auth(), cache: 'no-store' }).then((r) => r.json()); if (j?.success) { setD(j); setAr(j.rules.ar); setEn(j.rules.en); } } catch { /* */ } };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = !!d && (ar !== d.rules.ar || en !== d.rules.en);
  async function save() {
    if (!d || !dirty) return; setBusy(true); setMsg(null);
    try {
      const j = await fetch('/api/admin/miaar/rules', { method: 'POST', headers: await auth(), body: JSON.stringify({ action: 'save', ar, en }) }).then((r) => r.json());
      if (j?.success) { await load(); setMsg({ t: 'ok', s: `حُفظ الإصدار ${j.rules.version} — كل ممتحن من الآن يقرّ بهذا النصّ.` }); } else setMsg({ t: 'err', s: j?.error || 'تعذّر الحفظ' });
    } catch { setMsg({ t: 'err', s: 'تعذّر الاتصال' }); } finally { setBusy(false); }
  }
  const blocks = parseRules(pv === 'ar' ? ar : en);
  return <section className="am-card re" data-testid="mm-rules" data-version={d?.rules.version || 0}>
    <style>{CSS}</style>
    <div className="re-head">
      <h3>تعليمات الاختبار وإقرار الممتحن <small>يراها كل ممتحن قبل أي جلسة (فردي · دعوة · نهاية المستوى · جهات) ولا تُفتح الجلسة إلا بعد إقراره</small></h3>
      <div className="re-acts">
        {d && <span className="re-pill" data-testid="mm-rules-version">الإصدار {d.rules.version} · آخر تعديل {fmt(d.rules.updated_at)}{d.rules.updated_by ? ` · ${d.rules.updated_by}` : ''}</span>}
        <a className="am-btn ghost" href="/miaar?preview=rules" target="_blank" rel="noreferrer">كما يراها الممتحن ↗</a>
        <button type="button" className="am-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="mm-rules-toggle">{open ? 'إغلاق المحرِّر' : (d?.me.can_edit ? 'تحرير التعليمات' : 'عرض التعليمات')}</button>
      </div>
    </div>
    {open && d && <div className="re-body">
      <div className="re-cols">
        <label className="re-col"><span>النصّ العربي <small>{countPoints(ar)} نقطة · {ar.length}/{d.max}</small></span>
          <textarea value={ar} onChange={(e) => setAr(e.target.value)} dir="rtl" lang="ar" rows={16} maxLength={d.max} readOnly={!d.me.can_edit} data-testid="mm-rules-ar" /></label>
        <label className="re-col"><span>English text <small>{countPoints(en)} points · {en.length}/{d.max}</small></span>
          <textarea value={en} onChange={(e) => setEn(e.target.value)} dir="ltr" lang="en" rows={16} maxLength={d.max} readOnly={!d.me.can_edit} data-testid="mm-rules-en" /></label>
      </div>
      <p className="re-help">الصيغة: سطر يبدأ بـ «## » عنوان قسم · سطر يبدأ بـ «- » نقطة · أي سطر آخر فقرة. يجب أن يبقى في النصّ العربي بند إقرار (كلمة «الإقرار» أو «أقرّ» أو «أتعهّد»). بطاقة الاختبار (الوقت · الأقسام · وضع المراقبة) تُضاف تلقائيًا من معطيات كل اختبار فلا تكتبها هنا.</p>
      <div className="re-pv">
        <div className="re-pvhead"><b>معاينة كما يراها الممتحن</b><span className="re-tabs"><button type="button" className={pv === 'ar' ? 'on' : ''} onClick={() => setPv('ar')}>عربي</button><button type="button" className={pv === 'en' ? 'on' : ''} onClick={() => setPv('en')}>English</button></span></div>
        <div className="re-box" dir={pv === 'ar' ? 'rtl' : 'ltr'} lang={pv} data-testid="mm-rules-preview">
          {blocks.map((b, i) => b.kind === 'h' ? <h4 key={i}>{b.text}</h4> : b.kind === 'ul' ? <ul key={i}>{(b.items || []).map((it, j) => <li key={j}>{it}</li>)}</ul> : <p key={i}>{b.text}</p>)}
        </div>
      </div>
      {msg && <p className={`re-msg ${msg.t}`} role={msg.t === 'err' ? 'alert' : 'status'} data-testid="mm-rules-msg">{msg.s}</p>}
      {d.me.can_edit ? <div className="re-foot">
        <button type="button" className="am-btn primary" disabled={busy || !dirty} onClick={() => void save()} data-testid="mm-rules-save">{busy ? 'يحفظ…' : `حفظ إصدار جديد (${d.rules.version + 1})`}</button>
        <button type="button" className="am-btn ghost" disabled={busy || !dirty} onClick={() => { setAr(d.rules.ar); setEn(d.rules.en); setMsg(null); }}>تراجع عن التعديلات</button>
        <button type="button" className="am-btn ghost" disabled={busy} onClick={() => { setAr(d.factory.ar); setEn(d.factory.en); setMsg(null); }} data-testid="mm-rules-factory">استعادة النصّ الأصلي</button>
        {!dirty && <small className="re-hint">زرّ الحفظ يعمل بعد أي تعديل.</small>}
      </div> : <p className="re-help">التحرير للمديرين فقط؛ يمكنك العرض والمعاينة.</p>}
    </div>}
  </section>;
}

const CSS = `
.re .re-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}.re h3{margin:0;font-size:17px}.re h3 small{display:block;font-size:12.5px;color:var(--muted);font-weight:700;margin-top:4px;line-height:1.6}
.re-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.re-pill{display:inline-block;padding:3px 10px;border-radius:999px;background:#e2e8f0;color:#0f2a4e;font-size:12px;font-weight:900}
.re-body{margin-top:14px;border-top:1px solid var(--line);padding-top:14px}.re-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}.re-col{display:flex;flex-direction:column;gap:6px;font-weight:800;font-size:13px}.re-col small{color:var(--muted);font-weight:700;margin-inline-start:8px}
.re-col textarea{width:100%;border:1px solid var(--line);border-radius:12px;padding:12px;font:inherit;font-size:14px;line-height:1.8;resize:vertical;background:#fff;min-width:0}.re-col textarea[readonly]{background:#f8fafc}
.re-help{font-size:12.5px;color:var(--muted);line-height:1.7;margin:10px 0}
.re-pv{border:1px solid var(--line);border-radius:14px;overflow:hidden}.re-pvhead{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f1f5f9;font-size:13px}.re-tabs button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:3px 12px;font:inherit;font-size:12px;font-weight:800;margin-inline-start:6px;cursor:pointer}.re-tabs button.on{background:var(--navy,#0f2a4e);color:#fff;border-color:transparent}
.re-box{max-height:320px;overflow:auto;padding:14px 18px;line-height:1.9;font-size:14.5px;background:#fbfcfe}.re-box h4{margin:12px 0 4px;font-size:15px;color:var(--navy,#0f2a4e)}.re-box h4:first-child{margin-top:0}.re-box ul{margin:0;padding-inline-start:22px}.re-box p{margin:6px 0}
.re-msg{margin:10px 0 0;font-weight:800;font-size:13.5px}.re-msg.ok{color:#166534}.re-msg.err{color:#991b1b}
.re-foot{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}.re-hint{color:var(--muted);font-weight:700}
@media (max-width:860px){.re-cols{grid-template-columns:1fr}}
`;
