'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P68 «تقرير القيادة» — تبويب في بوابة الجهات (/org?tab=report)
 *  (1) اختيار الفترة (منذ آخر تقرير · هذا الربع · الربع السابق · مدى مخصّص) + اسم المُصدِر ومنصبه → «أصدر التقرير» = بناء + توقيع ATH-LR
 *  (2) الورقة A4 تظهر فورًا (معاينة) + طباعة + رابط التحقّق العام
 *  (3) «قرارٌ واحد يكفي»: ثمانية قرارات تمكينية (أو سطر مخصّص) → يُختم داخل الوثيقة بنفس الرمز — مرّة واحدة
 *  (4) الأرشيف: كل التقارير بحالتها (حيّ / مُلغى) · فتح · إلغاء
 *  testids: olr-root olr-preset olr-from olr-to olr-name olr-title olr-issue olr-sheet olr-code olr-dec-<key> olr-note olr-decide olr-decided
 *           olr-rows olr-row olr-open olr-revoke olr-print olr-verify-url olr-err olr-ok
 */
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../lib/ui/icons';
import { OrgReportSheet, SHEET_CSS, type SheetBody } from './OrgReportSheet';

type Preset = { kind: string; from: string; to: string; label_ar: string };
type Decision = { key: string; text_ar: string; target: string | null; why_ar: string };
type Row = { id: number; code: string; kind: string; kind_ar: string; period_from: string; period_to: string; status: 'issued' | 'revoked'; issued_at: string; issued_name: string | null; issued_title: string | null; decision: { text_ar: string } | null; decision_at: string | null; revoked_at: string | null; signed: boolean };
type Data = { org: { id: string; name_ar: string; slug: string | null; has_logo: boolean; pseudonymous: boolean }; me: { name: string; staff: boolean }; reports: Row[]; presets: Preset[]; decisions: Decision[]; site: string };
type Full = Row & { body: SheetBody; logo?: string | null };
type Props = { orgId: string; lang: 'ar' | 'en'; token: () => Promise<string> };
const fmt = (iso?: string | null) => { if (!iso) return '—'; try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return String(iso).slice(0, 10); } };

export function OrgReport({ orgId, lang, token }: Props) {
  const ar = lang === 'ar';
  const [d, setD] = useState<Data | null>(null); const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [sel, setSel] = useState<Preset | null>(null); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [name, setName] = useState(''); const [title, setTitle] = useState('');
  const [cur, setCur] = useState<Full | null>(null); const [decKey, setDecKey] = useState(''); const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const tk = await token(); const r = await fetch(`/api/org/report?org=${encodeURIComponent(orgId)}`, { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }); const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) { setErr(j.error || 'تعذّر التحميل'); return; } setD(j); setErr(''); if (!sel && j.presets?.[0]) { setSel(j.presets[0]); setFrom(j.presets[0].from); setTo(j.presets[0].to); } if (!name && j.me?.name) setName(j.me.name);
  }, [orgId, token, sel, name]);
  useEffect(() => { void load(); }, [load]);
  async function post(body: Record<string, unknown>) { const tk = await token(); const r = await fetch('/api/org/report', { method: 'POST', headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok || !j.success) throw new Error(j.error || 'تعذّر التنفيذ'); return j; }
  async function open(code: string) { setBusy('open'); setErr(''); try { const tk = await token(); const r = await fetch(`/api/org/report?code=${encodeURIComponent(code)}`, { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }); const j = await r.json(); if (!r.ok || !j.success) throw new Error(j.error || 'تعذّر الفتح'); setCur(j.report); setDecKey(''); setNote(''); } catch (e: any) { setErr(e.message); } finally { setBusy(''); } }
  async function issue() {
    setBusy('issue'); setErr(''); setOk('');
    try { const j = await post({ action: 'issue', org_id: orgId, kind: sel && sel.from === from && sel.to === to ? sel.kind : 'custom', from, to, name, title }); setCur({ ...j.report, logo: null }); setOk(j.replaced ? `صدر التقرير ${j.report.code} وحلّ محلّ ${j.replaced}` : `صدر التقرير ${j.report.code} — اقرأه ثم اختم قرارك`); setDecKey(''); setNote(''); await load(); void open(j.report.code); }
    catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  }
  async function decide() { if (!cur) return; setBusy('decide'); setErr(''); try { const j = await post({ action: 'decide', code: cur.code, key: decKey, note_ar: note }); setCur({ ...cur, ...j.report }); setOk('خُتم القرار داخل التقرير — سيراه منسوبوكم في صفحاتهم: «قيادتك قرأت وقرّرت»'); await load(); } catch (e: any) { setErr(e.message); } finally { setBusy(''); } }
  async function revoke(code: string) { if (!confirm('إلغاء هذا التقرير؟ تبقى نسخته للتحقّق بحالة «مُلغى».')) return; setBusy('revoke'); try { await post({ action: 'revoke', code }); if (cur?.code === code) setCur(null); setOk('أُلغي'); await load(); } catch (e: any) { setErr(e.message); } finally { setBusy(''); } }
  const print = (code: string) => { window.open(`/org/report/${code}`, '_blank', 'noopener'); };
  const copy = (t: string) => { navigator.clipboard?.writeText(t).then(() => setOk('نُسخ الرابط')).catch(() => setErr('تعذّر النسخ')); };

  if (!d) return <div className="pt-box" data-testid="olr-root">{err ? <div className="pt-alert err" data-testid="olr-err">{err}</div> : <div className="pt-empty">…</div>}</div>;
  const verifyUrl = cur ? `${d.site}/verify/report?code=${cur.code}` : '';
  return (
    <div className="og-report pt-box olr" data-testid="olr-root">
      <style dangerouslySetInnerHTML={{ __html: SHEET_CSS + CSS }} />
      <div className="og-rephead"><div><b>P68 · {ar ? 'تقرير القيادة' : 'Leadership report'}</b><h2 style={{ margin: '4px 0' }}>{ar ? 'صفحة واحدة تُقرأ في ثلاث دقائق وتُوقَّع' : 'One page, read in three minutes, signed'}</h2><p className="olr-lead">{ar ? 'تُولَّد من الأثر الحيّ بزرّ، تُختم ATH-LR وتُطبع من المتصفّح. لا اسم شخص فيها ولا رقم تدريبي: أعداد وسطور مجهَّلة (k ≥ 5) فقط. وتنتهي بقرار واحد تختمه القيادة فيعود صداه إلى المنسوبين.' : 'Generated from live impact, sealed ATH-LR, printed from the browser. No personal names, no training numbers — counts and k≥5 lines only. It ends with one leadership decision that echoes back to members.'}</p></div>
        {d.org.pseudonymous ? <span className="lrs-badge">أرقام تدريبية لا أسماء — سياسة الجهة</span> : null}</div>
      {err && <div className="pt-alert err" data-testid="olr-err">{err}</div>}{ok && <div className="pt-alert ok" data-testid="olr-ok">{ok}</div>}

      <section className="olr-issue">
        <h3><Icon name="doc" size={16} /> {ar ? 'إصدار تقرير' : 'Issue a report'}</h3>
        <div className="olr-presets">{d.presets.map((p) => <button type="button" key={`${p.from}${p.to}`} className={sel?.from === p.from && sel?.to === p.to && from === p.from && to === p.to ? 'on' : ''} data-testid="olr-preset" onClick={() => { setSel(p); setFrom(p.from); setTo(p.to); }}>{p.kind === 'since_last' ? 'منذ آخر تقرير' : p.kind === 'quarter' ? p.label_ar : p.label_ar}<small dir="ltr">{p.from} → {p.to}</small></button>)}</div>
        <div className="olr-form">
          <label>من<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="olr-from" /></label>
          <label>إلى<input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="olr-to" /></label>
          <label>اسم المُصدِر (يظهر على الورقة)<input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="كما تريده القيادة أن يُقرأ" data-testid="olr-name" /></label>
          <label>المنصب<input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="مدير التدريب / قائد الوحدة" data-testid="olr-title" /></label>
          <button type="button" className="pt-btn" disabled={busy === 'issue' || !from || !to} onClick={issue} data-testid="olr-issue">{busy === 'issue' ? 'يُبنى ويُوقَّع…' : 'أصدر التقرير واختمه'}</button>
        </div>
        <p className="olr-hint">{ar ? 'إصدار تقرير لفترة سبق إصدارها يُلغي السابق ويحلّ محلّه (يبقى للتحقّق بحالة «مُلغى»). الفترة ≤ سنة، وتنتهي اليوم أو قبله.' : 'Re-issuing a period revokes the previous report (kept for verification as “revoked”). Period ≤ 1 year, ending today or earlier.'}</p>
      </section>

      {cur && <section className="olr-cur" data-testid="olr-sheet">
        <div className="olr-acts no-print">
          <b data-testid="olr-code">{cur.code}</b><span className={`olr-st ${cur.status}`}>{cur.status === 'issued' ? 'حيّ' : 'مُلغى'}</span>{cur.signed ? <span className="olr-st ok">موقَّع ✓</span> : null}
          <button type="button" className="pt-btn small" onClick={() => print(cur.code)} data-testid="olr-print"><Icon name="print" size={14} /> طباعة / PDF</button>
          <button type="button" className="pt-btn small ghost" onClick={() => copy(verifyUrl)} data-testid="olr-verify-url">نسخ رابط التحقّق</button>
          <a className="pt-btn small ghost" href={verifyUrl} target="_blank" rel="noreferrer">فتح /verify/report ↗</a>
          {cur.status === 'issued' ? <button type="button" className="pt-btn small danger" onClick={() => revoke(cur.code)} data-testid="olr-revoke">إلغاء</button> : null}
          <button type="button" className="pt-btn small ghost" onClick={() => setCur(null)}>إغلاق المعاينة</button>
        </div>
        {cur.status === 'issued' && !cur.decision && <div className="olr-decide no-print" data-testid="olr-decide-box">
          <h3><Icon name="check" size={16} /> قرارٌ واحد يكفي</h3>
          <p className="olr-hint">اختر القرار الذي يجعل أضعف الأرقام الثلاثة يتحرّك قبل التقرير التالي. يُختم داخل الوثيقة بنفس الرمز، ويظهر لمنسوبيكم سطرٌ واحد: «قيادتك قرأت تقرير {cur.body.period.label_ar} وقرّرت: …» — بلا أسماء.</p>
          <div className="olr-decs">{d.decisions.map((o) => <label key={o.key} className={decKey === o.key ? 'on' : ''}><input type="radio" name="olr-dec" checked={decKey === o.key} onChange={() => setDecKey(o.key)} data-testid={`olr-dec-${o.key}`} /><span><b>{o.text_ar}</b><small>{o.why_ar}{o.target ? ` · يُقاس أثره على: ${o.target === 'transfer' ? 'الانتقال' : o.target === 'gain' ? 'الكسب' : 'الالتزام'}` : ''}</small></span></label>)}</div>
          <div className="olr-form"><label style={{ flex: 1 }}>{decKey === 'custom' ? 'نصّ القرار (حتى 140 حرفًا)' : 'سطر توضيحي (اختياري، حتى 140 حرفًا)'}<input value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} data-testid="olr-note" /></label>
            <button type="button" className="pt-btn" disabled={!decKey || busy === 'decide'} onClick={decide} data-testid="olr-decide">{busy === 'decide' ? 'يُختم…' : 'اختم القرار داخل التقرير'}</button></div>
        </div>}
        {cur.decision ? <div className="pt-alert ok no-print" data-testid="olr-decided">قرار مختوم في {fmt(cur.decision_at)}: «{cur.decision.text_ar}»</div> : null}
        <div className="olr-paper"><OrgReportSheet body={cur.body} site={d.site} logo={cur.logo} status={cur.status} /></div>
      </section>}

      <section>
        <h3><Icon name="folder" size={16} /> {ar ? 'الأرشيف' : 'Archive'} <small>{d.reports.length}</small></h3>
        {d.reports.length === 0 ? <div className="pt-empty">لا تقارير بعد — أصدر الأوّل أعلاه. التقرير الثاني سيفتح تلقائيًّا بـ «ما قرّرتم آخر مرّة».</div> :
          <table className="og-table" data-testid="olr-rows"><thead><tr><th>الرمز</th><th>الفترة</th><th>صدر</th><th>الحالة</th><th>القرار</th><th></th></tr></thead><tbody>
            {d.reports.map((r) => <tr key={r.id} data-testid="olr-row" className={r.status}><td><code dir="ltr">{r.code}</code></td><td>{r.kind_ar}<br /><small dir="ltr">{r.period_from} → {r.period_to}</small></td><td>{fmt(r.issued_at)}<br /><small>{r.issued_name || ''}</small></td><td><span className={`olr-st ${r.status}`}>{r.status === 'issued' ? 'حيّ' : 'مُلغى'}</span></td><td>{r.decision ? <>{r.decision.text_ar}<br /><small>{fmt(r.decision_at)}</small></> : <small>—</small>}</td>
              <td className="olr-rowacts"><button type="button" className="pt-btn small ghost" onClick={() => open(r.code)} data-testid="olr-open">عرض</button><button type="button" className="pt-btn small ghost" onClick={() => print(r.code)}>طباعة</button>{r.status === 'issued' ? <button type="button" className="pt-btn small ghost" onClick={() => revoke(r.code)}>إلغاء</button> : null}</td></tr>)}
          </tbody></table>}
      </section>
      <p className="olr-foot">{ar ? 'الأسماء ولماذا: «تقرير القيادة» لأن المخاطَب من يملك قرار التمكين · «ثلاثة أرقام» لا «مؤشرات» · «ثلاثة أسئلة» لا «توصيات» · ATH-LR: Leadership Report، شقيق ATH-SH/OP/ML.' : ''}</p>
    </div>
  );
}

const CSS = `
.olr .olr-lead{color:#475569;font-size:13.5px;max-width:760px;margin:0}
.olr section{margin-top:18px}.olr h3{display:flex;align-items:center;gap:8px;font-size:15px;margin:0 0 10px;color:#0f2a4e}.olr h3 small{color:#94a3b8;font-weight:700}
.olr-presets{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.olr-presets button{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:8px 14px;font:inherit;font-weight:800;cursor:pointer;text-align:right}.olr-presets button small{display:block;font-weight:600;color:#64748b;font-size:11px}.olr-presets button.on{border-color:#0b8a83;background:#f0fdfa}
.olr-form{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}.olr-form label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;font-weight:800;color:#334155;min-width:150px}.olr-form input{border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;font:inherit}
.olr-hint{color:#64748b;font-size:12.5px;margin:8px 0 0}
.olr-acts{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}.olr-acts b{font-family:ui-monospace,monospace;direction:ltr;letter-spacing:.04em}
.olr-st{display:inline-block;font-size:11px;font-weight:800;border-radius:999px;padding:2px 10px;background:#f1f5f9;color:#334155}.olr-st.issued{background:#dcfce7;color:#166534}.olr-st.revoked{background:#fee2e2;color:#991b1b}.olr-st.ok{background:#e0f2fe;color:#075985}
.olr-decide{border:2px solid #0b8a83;border-radius:14px;padding:14px 16px;background:#f0fdfa;margin-bottom:12px}
.olr-decs{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px;margin:10px 0}.olr-decs label{display:flex;gap:10px;align-items:flex-start;border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:10px 12px;cursor:pointer}.olr-decs label.on{border-color:#0b8a83;box-shadow:0 0 0 2px #99f6e4 inset}.olr-decs label b{display:block;font-size:13.5px}.olr-decs label small{color:#64748b;font-size:11.5px;line-height:1.5}.olr-decs input{margin-top:4px}
.olr-paper{border:1px solid #e2e8f0;border-radius:14px;overflow:auto;background:#f8fafc;padding:12px}
.olr-rowacts{white-space:nowrap}.olr-rowacts button{margin-inline-start:4px}tr.revoked td{opacity:.65}
.olr-foot{color:#94a3b8;font-size:11.5px;margin-top:16px}
.pt-btn.danger{background:#fee2e2;color:#991b1b;border-color:#fecaca}
`;
