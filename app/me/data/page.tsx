'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /me/data — «ذاكرتي» (P22 خزنة أَثَر): خريطة حيّة لكل ما تعرفه أَثَر عنك — لماذا، إلى متى، من لمسه — وحقوقك كأزرار لا كنصوص:
 *  نسختي (JSON/HTML فورًا + إيصال موقَّع) · صحّح · اعترض · اسحب موافقة من مصدرها · أن تُنسى (حجر 7 أيام برابط تراجع)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { fastToken } from '../../components/Pocket';
import { supabase } from '../../../lib/supabase/client';

type MapRow = { table: string; label_ar: string; category: string; category_ar: string; purpose_ar: string; basis_ar: string; policy: string; policy_ar: string; retention_ar: string; access_ar: string[]; count: number | null };
type Data = { me: { email: string; name: string }; map: MapRow[]; totals: { rows: number; tables: number }; consents: { items: { scope: string; label_ar: string; on: boolean; how_ar: string }[]; ledger: any[] }; touches: { at: string; who: string; what: string; kind: string }[]; requests: any[]; erasure: { id: number; execute_after: string } | null; plan: { delete: { label_ar: string }[]; anonymize: { label_ar: string }[]; retain: { label_ar: string; note_ar: string }[] }; notice: { version: string; draft: boolean; url: string }; timelines: { dsr_days: number; hold_days: number }; rights: { id: string; title: string; body: string }[] };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const KIND_AR: Record<string, string> = { access: 'اطّلاع/نسخة', correction: 'تصحيح', erasure: 'نسيان', objection: 'اعتراض', portability: 'نقل' };
const STATUS_AR: Record<string, string> = { open: 'مفتوح', extended: 'مُمدَّد', done: 'نُفِّذ', rejected: 'مرفوض', cancelled: 'ملغى' };
const CAT_ICON: Record<string, any> = { identity: 'users', learning: 'target', credentials: 'certificate', commerce: 'doc', communication: 'mail', agents: 'shield', operations: 'settings', security: 'shield' };

export default function MyDataPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [data, setData] = useState<Data | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
  const [open, setOpen] = useState<string | null>(null); const [form, setForm] = useState<'correct' | 'object' | 'erase' | null>(null);
  const [cf, setCf] = useState({ field: '', current: '', requested: '', reason: '' }); const [ob, setOb] = useState(''); const [receipt, setReceipt] = useState<any>(null);
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); }, [db]);
  const load = useCallback(async (t: string) => { const j = await fetch('/api/vault', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null); if (j?.success) setData(j); else setErr(j?.error || 'تعذّر التحميل'); }, []);
  useEffect(() => { if (tok) load(tok); }, [tok, load]);
  const post = async (body: any) => fetch('/api/vault', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) });
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 4000); };

  async function exportMe(format: 'json' | 'html') {
    setBusy('export'); const r = await post({ action: 'export', format }); if (!r.ok) { setErr('تعذّر التصدير'); setBusy(''); return; }
    const blob = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `athar-my-data.${format}`; a.click();
    if (format === 'json') { try { const j = JSON.parse(await blob.text()); const rc = await post({ action: 'receipt', hash: j.hash }).then(x => x.json()); if (rc?.success) setReceipt(rc.receipt); } catch { /* */ } }
    await load(tok!); setBusy(''); flash('نزلت نسختك — وسُجِّل طلب الاطّلاع منفَّذًا فورًا');
  }
  async function act(body: any, ok: string) { setBusy(body.action); const j = await post(body).then(r => r.json()).catch(() => null); setBusy(''); if (!j?.success) { setErr(j?.error || 'تعذّر'); return false; } setErr(''); flash(j.message || ok); await load(tok!); return true; }
  const cats = useMemo(() => { const m = new Map<string, MapRow[]>(); (data?.map || []).forEach(r => { m.set(r.category, [...(m.get(r.category) || []), r]); }); return Array.from(m.entries()); }, [data]);

  return (
    <main className="md" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="md-head"><span className="pt-kicker"><Icon name="shield" size={14} /> خزنة أَثَر · سيادتك على بياناتك</span><h1>ذاكرتي</h1><p>كل ما تعرفه أَثَر عنك — في مكان واحد، حيًّا لا نصًّا: لماذا نحتفظ به، إلى متى، من لمسه، وحقوقك كأزرار تعمل الآن لا كوعود. وفق نظام حماية البيانات الشخصية في المملكة.</p></header>
      {tok === '' && <section className="pt-box md-box"><p>سجّل الدخول لفتح ذاكرتك. <Link href="/login?next=/me/data">تسجيل الدخول</Link></p></section>}
      {err && <div className="md-err" role="alert">{err}</div>}
      {msg && <div className="md-ok" role="status">{msg}</div>}
      {tok && !data && !err && <section className="pt-box md-box"><p className="md-muted">نفتح الخزنة…</p></section>}
      {tok && data && (
        <>
          <section className="md-kpis" data-testid="vault-kpis">
            <span><b>{data.totals.rows}</b> صفًّا عنك</span><span><b>{data.totals.tables}</b> نوع بيانات فيه شيء</span><span><b>{data.consents.items.filter(c => c.on).length}</b> موافقة قائمة</span><span><b>{data.touches.length}</b> لمسة في 90 يومًا</span>
            <span className="md-notice">إشعار الخصوصية v{data.notice.version}{data.notice.draft ? ' · مسودة' : ''} — <a href="/privacy" target="_blank" rel="noreferrer">اقرأه</a></span>
          </section>

          {data.erasure && (
            <section className="md-hold" data-testid="erasure-hold"><Icon name="clock" size={18} /><div><b>طلب النسيان في الحجر</b><p>سيُنفَّذ تلقائيًا {fmt(data.erasure.execute_after)}. حتى ذلك الحين كل شيء باقٍ ويمكنك التراجع.</p></div><button className="pt-btn" onClick={() => act({ action: 'undo' }, 'أُوقف النسيان')} disabled={busy === 'undo'} data-testid="erasure-undo">غيّرت رأيي — أوقف النسيان</button></section>
          )}

          <section className="md-actions" data-testid="vault-actions">
            <button className="pt-btn" onClick={() => exportMe('json')} disabled={busy === 'export'} data-testid="vault-export"><Icon name="download" size={16} /> نسختي (JSON قابل للنقل)</button>
            <button className="pt-btn light" onClick={() => exportMe('html')} disabled={busy === 'export'}><Icon name="doc" size={16} /> نسخة مقروءة</button>
            <button className="pt-btn light" onClick={() => setForm(form === 'correct' ? null : 'correct')} data-testid="vault-correct"><Icon name="edit" size={16} /> صحّح معلومة</button>
            <button className="pt-btn light" onClick={() => setForm(form === 'object' ? null : 'object')}><Icon name="alert" size={16} /> اعترض على معالجة</button>
            {!data.erasure && <button className="pt-btn ghost danger" onClick={() => setForm(form === 'erase' ? null : 'erase')} data-testid="vault-erase"><Icon name="trash" size={16} /> أن أُنسى</button>}
          </section>
          {receipt && <section className="md-receipt" data-testid="vault-receipt"><Icon name="check" size={16} /><div><b>إيصال النسخة {receipt.proof ? 'موقَّع بمفتاح أَثَر' : '(بصمة)'}</b><code dir="ltr">{receipt.hash}</code><small>احتفظ به: يثبت أنك أخذت نسختك في {fmt(receipt.issued_at)}.</small></div><button className="pt-btn light small" onClick={() => { const a = document.createElement('a'); a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(receipt, null, 2)); a.download = 'athar-receipt.json'; a.click(); }}>تنزيل الإيصال</button></section>}

          {form === 'correct' && (
            <section className="pt-box md-box md-form" data-testid="correct-form"><h3>طلب تصحيح</h3><p className="md-muted">نردّ خلال {data.timelines.dsr_days} يومًا على الأكثر. الاسم في الشهادات الصادرة يُصحَّح بإعادة إصدار.</p>
              <div className="md-grid"><label>الحقل<input value={cf.field} onChange={e => setCf({ ...cf, field: e.target.value })} placeholder="مثال: الاسم الكامل · الجوال · الجهة" /></label><label>القيمة الحالية<input value={cf.current} onChange={e => setCf({ ...cf, current: e.target.value })} /></label><label>القيمة الصحيحة<input value={cf.requested} onChange={e => setCf({ ...cf, requested: e.target.value })} /></label><label>السبب (اختياري)<input value={cf.reason} onChange={e => setCf({ ...cf, reason: e.target.value })} /></label></div>
              <button className="pt-btn" disabled={busy === 'correct' || !cf.field || !cf.requested} onClick={async () => { if (await act({ action: 'correct', ...cf }, 'وصل طلب التصحيح')) { setForm(null); setCf({ field: '', current: '', requested: '', reason: '' }); } }} data-testid="correct-submit">أرسل الطلب</button></section>
          )}
          {form === 'object' && (
            <section className="pt-box md-box md-form"><h3>اعتراض على معالجة</h3><p className="md-muted">على أي معالجة بعينها (مثال: «لا أريد أن تدخل إجاباتي اليومية في الإحصاءات المجهولة»). نوقفها أو نشرح لماذا لا نستطيع — خلال {data.timelines.dsr_days} يومًا.</p>
              <textarea value={ob} onChange={e => setOb(e.target.value)} rows={3} placeholder="اكتب اعتراضك…" />
              <button className="pt-btn" disabled={busy === 'objection' || ob.trim().length < 10} onClick={async () => { if (await act({ action: 'objection', text: ob }, 'وصل اعتراضك')) { setForm(null); setOb(''); } }}>أرسل الاعتراض</button></section>
          )}
          {form === 'erase' && (
            <section className="pt-box md-box md-form md-erase" data-testid="erase-form"><h3>أن تُنسى — بشفافية كاملة قبل أن تقرر</h3>
              <div className="md-plan"><div><b>يُحذف</b><ul>{data.plan.delete.map((x, i) => <li key={i}>{x.label_ar}</li>)}</ul></div><div><b>يُجهَّل (يبقى رقمًا في الإحصاءات بلا هويتك)</b><ul>{data.plan.anonymize.map((x, i) => <li key={i}>{x.label_ar}</li>)}</ul></div><div><b>يبقى نظامًا لمدة محددة</b><ul>{data.plan.retain.map((x, i) => <li key={i} title={x.note_ar}>{x.label_ar}</li>)}</ul></div></div>
              <p className="md-muted">يُحذف حساب الدخول نفسه أيضًا. يبدأ حجر {data.timelines.hold_days} أيام تصلك فيه رسالة برابط تراجع، ثم يُنفَّذ تلقائيًا وتصلك رسالة أخيرة بإيصال موقَّع. شهاداتك الصادرة تبقى صالحة للتحقق باسمك ما لم تطلب إلغاءها.</p>
              <button className="pt-btn danger" disabled={busy === 'erase'} onClick={async () => { if (confirm('تأكيد: ابدأ حجر النسيان؟ يمكنك التراجع خلال 7 أيام.')) { if (await act({ action: 'erase' }, 'بدأ حجر النسيان — راجع بريدك')) setForm(null); } }} data-testid="erase-submit">ابدأ حجر النسيان</button></section>
          )}

          <section className="pt-box md-box" data-testid="vault-map">
            <h2><Icon name="compass" size={18} /> خريطة بياناتي</h2><p className="md-muted">كل نوع بيانات: كم صفًّا عنك، لماذا، على أي أساس، كم نحتفظ، ومن يصل إليه. اضغط أي سطر للتفاصيل.</p>
            {cats.map(([cat, rows]) => (
              <div key={cat} className="md-cat"><h3><Icon name={CAT_ICON[cat] || 'folder'} size={16} /> {rows[0].category_ar} <small>{rows.reduce((a, b) => a + (b.count || 0), 0)} صف</small></h3>
                {rows.map(r => (
                  <article key={r.table} className={`md-row ${open === r.table ? 'open' : ''} ${(r.count || 0) > 0 ? 'has' : ''}`} onClick={() => setOpen(open === r.table ? null : r.table)} data-testid="vault-row">
                    <div className="md-rowhead"><b>{r.label_ar}</b><span className="md-count">{r.count === null ? '—' : r.count}</span></div>
                    {open === r.table && <dl className="md-detail"><dt>لماذا</dt><dd>{r.purpose_ar}</dd><dt>الأساس</dt><dd>{r.basis_ar}</dd><dt>المدة</dt><dd>{r.retention_ar}</dd><dt>عند النسيان</dt><dd>{r.policy_ar}</dd><dt>من يصل</dt><dd>{r.access_ar.join(' · ')}</dd><dt>الجدول</dt><dd dir="ltr">{r.table}</dd></dl>}
                  </article>
                ))}
              </div>
            ))}
          </section>

          <div className="md-two">
            <section className="pt-box md-box" data-testid="vault-consents">
              <h2><Icon name="check" size={18} /> دفتر موافقاتي</h2><p className="md-muted">ما وافقت عليه — من مصدره الفعلي لا من نسخة. السحب يُنفَّذ في المكان نفسه فورًا.</p>
              {data.consents.items.map(c => (
                <div key={c.scope} className="md-consent"><div><b>{c.label_ar}</b><small>{c.how_ar}</small></div>{c.on ? <button className="pt-btn ghost small" disabled={busy === 'withdraw_consent'} onClick={() => act({ action: 'withdraw_consent', scope: c.scope }, 'سُحبت الموافقة')} data-testid="consent-withdraw">اسحب</button> : <span className="md-off">غير مفعَّل</span>}</div>
              ))}
              {data.consents.ledger.length > 0 && <details className="md-ledger"><summary>سجل المنح والسحب ({data.consents.ledger.length})</summary>{data.consents.ledger.map((l: any, i: number) => <div key={i}><span>{l.scope}</span><span>{l.withdrawn_at ? `سُحبت ${fmt(l.withdrawn_at)}` : `مُنحت ${fmt(l.granted_at || l.created_at)}`}</span></div>)}</details>}
            </section>
            <section className="pt-box md-box" data-testid="vault-touches">
              <h2><Icon name="search" size={18} /> من لمس بياناتي</h2><p className="md-muted">آخر 90 يومًا: وكلاؤك، الذكاء الاصطناعي (بلا هويتك)، الرسائل، طاقم أَثَر، الدرع.</p>
              {!data.touches.length && <p className="md-muted">لا لمسات مسجَّلة.</p>}
              <ol className="md-touches">{data.touches.slice(0, 30).map((t, i) => <li key={i} className={`k-${t.kind}`}><time>{fmt(t.at)}</time><b>{t.who}</b><span>{t.what}</span></li>)}</ol>
            </section>
          </div>

          <section className="pt-box md-box" data-testid="vault-requests">
            <h2><Icon name="inbox" size={18} /> طلباتي</h2>
            {!data.requests.length && <p className="md-muted">لا طلبات مفتوحة. النسخة فورية؛ التصحيح والاعتراض خلال {data.timelines.dsr_days} يومًا.</p>}
            {data.requests.map((r: any) => <div key={r.id} className="md-req"><b>#{r.id} {KIND_AR[r.kind] || r.kind}</b><span>{STATUS_AR[r.status] || r.status} · يستحق {fmt(r.due_at)}{r.extension_reason ? ` · مُدِّد: ${r.extension_reason}` : ''}</span>{(r.status === 'open' || r.status === 'extended') && r.kind !== 'erasure' && <button className="pt-btn ghost small" onClick={() => act({ action: 'cancel_request', id: r.id }, 'أُلغي الطلب')}>إلغاء</button>}</div>)}
          </section>

          <section className="pt-box md-box md-rights"><h2><Icon name="scale" size={18} /> حقوقك — كما ينصّ النظام</h2><div className="md-rightgrid">{data.rights.map(r => <div key={r.id}><b>{r.title}</b><p>{r.body}</p></div>)}</div><p className="md-muted">لم تجد ما تريد؟ راسل جهة حماية البيانات من <a href="/privacy">إشعار الخصوصية</a>. ولك الحق في التظلّم لدى الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).</p></section>
        </>
      )}
    </main>
  );
}

const CSS = `
.md{max-width:1060px;margin:0 auto;padding:18px 16px 60px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f2a4e}
.md-head h1{margin:6px 0 4px;font-size:30px}.md-head p{color:#475569;line-height:1.9;margin:0;max-width:760px}
.md-box{margin-top:14px;padding:16px 18px}.md-box h2{display:flex;align-items:center;gap:8px;font-size:17px;margin:0 0 4px}.md-muted{color:#64748b;font-size:13px;line-height:1.8;margin:4px 0}
.md-err{margin-top:12px;background:#fff5f5;border:1px solid #fecaca;color:#b91c1c;border-radius:12px;padding:10px 14px;font-size:14px}.md-ok{margin-top:12px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:12px;padding:10px 14px;font-size:14px}
.md-kpis{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;align-items:center}.md-kpis span{background:#fff;border:1px solid #e5e9f0;border-radius:12px;padding:8px 12px;font-size:13px;color:#334155}.md-kpis b{color:#0f2a4e;font-size:17px;margin-inline-end:4px}.md-notice{margin-inline-start:auto;background:#fffdf5!important;border-color:#c9a24b!important}
.md-hold{margin-top:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:12px 16px}.md-hold div{flex:1;min-width:240px}.md-hold b{display:block}.md-hold p{margin:2px 0 0;font-size:13px;color:#475569}
.md-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.pt-btn.danger{background:#b91c1c;border-color:#b91c1c;color:#fff}.pt-btn.ghost.danger{background:#fff;color:#b91c1c;border-color:#fecaca}
.md-receipt{margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:#f0fdfa;border:1px dashed #0b8a83;border-radius:12px;padding:10px 14px;font-size:13px}.md-receipt div{flex:1;min-width:220px;display:grid;gap:3px}.md-receipt code{font-size:11px;word-break:break-all;color:#0b8a83}.md-receipt small{color:#64748b}
.md-form h3{margin:0 0 4px;font-size:16px}.md-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin:8px 0}.md-form label{display:grid;gap:4px;font-size:12px;color:#475569;font-weight:800}.md-form input,.md-form textarea{border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;font-size:14px;width:100%;box-sizing:border-box}.md-form textarea{margin:8px 0}
.md-plan{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin:8px 0}.md-plan div{border:1px solid #e5e9f0;border-radius:12px;padding:10px 12px;background:#fafbfd;font-size:13px}.md-plan b{display:block;margin-bottom:4px;color:#0f2a4e}.md-plan ul{margin:0;padding-inline-start:18px;color:#334155;line-height:1.8}
.md-cat{margin-top:12px}.md-cat h3{display:flex;align-items:center;gap:6px;font-size:14px;margin:0 0 6px;color:#0b8a83}.md-cat h3 small{color:#94a3b8;font-weight:400}
.md-row{border:1px solid #eef2f7;border-radius:12px;padding:8px 12px;margin-bottom:6px;cursor:pointer;background:#fff;opacity:.72}.md-row.has{opacity:1;border-color:#dbeafe}.md-row.open{border-color:#0b8a83;background:#f8fffe}.md-rowhead{display:flex;justify-content:space-between;align-items:center;font-size:14px}.md-count{background:#eef2f7;border-radius:999px;padding:1px 10px;font-size:12px;font-weight:900;color:#0f2a4e}.md-row.has .md-count{background:#0b8a83;color:#fff}
.md-detail{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;margin:8px 0 2px;font-size:13px}.md-detail dt{color:#64748b;font-weight:800}.md-detail dd{margin:0;color:#334155}
.md-two{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}
.md-consent{display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid #f1f5f9;padding:8px 0;font-size:14px}.md-consent small{display:block;color:#64748b;font-size:12px}.md-off{color:#94a3b8;font-size:12px}.md-ledger{margin-top:8px;font-size:12px;color:#475569}.md-ledger div{display:flex;justify-content:space-between;padding:3px 0}
.md-touches{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:6px;max-height:420px;overflow:auto}.md-touches li{display:grid;grid-template-columns:1fr;gap:1px;border-inline-start:3px solid #cbd5e1;padding:4px 10px;font-size:13px;background:#fafbfd;border-radius:0 8px 8px 0}.md-touches time{color:#94a3b8;font-size:11px}.md-touches span{color:#475569}.md-touches .k-agent{border-color:#c9a24b}.md-touches .k-ai{border-color:#7c3aed}.md-touches .k-staff{border-color:#0f2a4e}.md-touches .k-security{border-color:#b91c1c}.md-touches .k-message{border-color:#0b8a83}
.md-req{display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-bottom:1px solid #f1f5f9;padding:8px 0;font-size:14px}.md-req span{color:#64748b;font-size:12px;flex:1}
.md-rightgrid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin:8px 0}.md-rightgrid div{border:1px solid #e5e9f0;border-radius:12px;padding:10px 12px;background:#fafbfd}.md-rightgrid b{color:#0b8a83}.md-rightgrid p{margin:4px 0 0;font-size:13px;color:#334155;line-height:1.7}
@media (max-width:640px){.md-head h1{font-size:24px}.md-notice{margin-inline-start:0}}
`;
