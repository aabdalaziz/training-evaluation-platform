'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P79 */
/**
 * /admin/gate — «تصاريح الدخول» (للمالك ومديري النظام)
 *  الأبواب: حالة كلّ منتج (مفتوح · بتصريح · مغلق) + مدّة التجربة + نصّ الرسالة — يسري خلال دقيقة بلا نشر.
 *  الطلبات: موافقة (30/90/∞ يومًا) تُرسل بريد التصريح · رفض بملاحظة (ببريد اختياري).
 *  التصاريح: تصريح يدوي ببريد · إعادة إرسال · إلغاء · نسخ الرابط.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { RoomHead } from '../../components/RoomKit';
import { Icon } from '../../../lib/ui/icons';

type Product = { slug: string; name_ar: string; name_en: string; mode: 'open' | 'permit' | 'closed'; trial_seconds: number; entry_path: string; message_ar: string | null };
type Req = { id: string; product: string; name: string; email: string; phone: string | null; org: string | null; purpose: string | null; status: 'pending' | 'approved' | 'rejected'; note: string | null; created_at: string; decided_at: string | null; decided_by: string | null };
type Permit = { id: string; code: string; product: string; email: string; name: string | null; expires_at: string | null; revoked_at: string | null; uses: number; last_used_at: string | null; created_at: string; created_by: string | null };
type Data = { products: Product[]; requests: Req[]; permits: Permit[]; counts: { pending: number; active: number }; notify_to: string };

const MODE: Record<Product['mode'], { label: string; color: string; bg: string; hint: string }> = {
  open: { label: 'مفتوح', color: '#1F5F5A', bg: '#E9F6F1', hint: 'يدخل الجميع' },
  permit: { label: 'بتصريح', color: '#8A5A1E', bg: '#FBF0DC', hint: 'تجربة ثمّ تصريح' },
  closed: { label: 'مغلق', color: '#B9544A', bg: '#FBE7E3', hint: 'رسالة فقط' },
};
const fmt = (iso: string | null) => (iso ? new Intl.DateTimeFormat('ar-SA-u-nu-latn', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(iso)) : '—');
const fmtD = (iso: string | null) => (iso ? new Intl.DateTimeFormat('ar-SA-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date(iso)) : 'حتى إشعار آخر');
const active = (p: Permit) => !p.revoked_at && (!p.expires_at || new Date(p.expires_at).getTime() > Date.now());
const CSS = `
.ag{display:grid;gap:18px;max-width:1180px}
.ag-tabs{display:flex;gap:8px;flex-wrap:wrap}
.ag-tab{border:2px solid #EADFD6;background:#fff;border-radius:999px;padding:8px 16px;font-weight:800;color:#3A1F36;cursor:pointer;display:inline-flex;gap:8px;align-items:center}
.ag-tab.on{background:#3A1F36;color:#fff;border-color:#3A1F36}
.ag-tab i{font-style:normal;background:#E8795C;color:#fff;border-radius:999px;padding:1px 8px;font-size:12px}
.ag-card{background:#fff;border:2px solid #EADFD6;border-radius:18px;padding:16px 18px}
.ag-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.ag-prod h3{margin:0 0 4px;color:#3A1F36;display:flex;justify-content:space-between;align-items:center;gap:8px}
.ag-badge{border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800}
.ag-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}
.ag-row select,.ag-row input,.ag-row textarea,.ag-form input,.ag-form select{font:inherit;padding:7px 10px;border:2px solid #EADFD6;border-radius:10px;background:#FFFDFB;color:#2A1626}
.ag-row textarea{width:100%;min-height:60px}
.ag-btn{border:2px solid #3A1F36;background:#3A1F36;color:#fff;border-radius:999px;padding:7px 14px;font-weight:800;cursor:pointer;display:inline-flex;gap:6px;align-items:center;font-size:13.5px}
.ag-btn.ok{background:#1F5F5A;border-color:#1F5F5A}.ag-btn.warn{background:#fff;color:#B9544A;border-color:#B9544A}.ag-btn.ghost{background:#fff;color:#3A1F36;border-color:#D9CBC2}
.ag-btn:disabled{opacity:.5;cursor:not-allowed}
.ag-table{width:100%;border-collapse:collapse;font-size:14px}
.ag-table th{color:#6B5B67;font-weight:700;text-align:right;padding:8px 6px;border-bottom:2px solid #EADFD6;font-size:12.5px}
.ag-table td{padding:9px 6px;border-bottom:1px solid #F1E9E2;vertical-align:top}
.ag-mono{direction:ltr;display:inline-block;font-family:ui-monospace,Menlo,monospace;letter-spacing:1px;font-weight:700}
.ag-muted{color:#8E7F8A;font-size:12.5px}
.ag-msg{border-radius:12px;padding:10px 14px;font-weight:700}
.ag-msg.ok{background:#E9F6F1;color:#1F5F5A}.ag-msg.err{background:#FBE7E3;color:#B9544A}
.ag-filter{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.ag-filter button{border:2px solid #EADFD6;background:#fff;border-radius:999px;padding:4px 12px;cursor:pointer;font-weight:700;color:#3A1F36}
.ag-filter button.on{background:#F1D9A8;border-color:#D9A866}
.ag-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;align-items:end}
.ag-form label{display:grid;gap:3px;font-size:12.5px;color:#6B5B67;font-weight:700}
`;

export default function AdminGate() {
  const router = useRouter(); const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState(''); const [data, setData] = useState<Data | null>(null); const [tab, setTab] = useState<'requests' | 'permits' | 'products'>('requests');
  const [busy, setBusy] = useState(''); const [ok, setOk] = useState(''); const [error, setError] = useState('');
  const [filter, setFilter] = useState<'pending' | 'all'>('pending'); const [days, setDays] = useState<Record<string, string>>({}); const [notes, setNotes] = useState<Record<string, string>>({});
  const [np, setNp] = useState({ product: 'iqra', email: '', name: '', days: '30' }); const [pf, setPf] = useState<Record<string, Partial<Product>>>({});
  const H = async (tk?: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tk || tok || (await db.auth.getSession()).data.session?.access_token || ''}` });
  async function load(tk?: string) { const j = await fetch('/api/admin/gate', { headers: await H(tk), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setData(j); }
  async function post(body: any) { setBusy(body.action + (body.id || body.slug || '')); setError(''); setOk(''); try { const j = await fetch('/api/admin/gate', { method: 'POST', headers: await H(), body: JSON.stringify(body) }).then((r) => r.json()); if (!j.success) { setError(j.error || 'تعذّر التنفيذ'); return null; } await load(); return j; } catch { setError('تعذّر الاتصال'); return null; } finally { setBusy(''); } }
  useEffect(() => { (async () => { const { data: s } = await db.auth.getSession(); if (!s.session) { router.replace('/login?next=/admin/gate'); return; } setTok(s.session.access_token); await load(s.session.access_token); })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prodName = (slug: string) => data?.products.find((p) => p.slug === slug)?.name_ar || slug;
  const reqs = (data?.requests || []).filter((r) => filter === 'all' || r.status === 'pending');
  const mailNote = (m: { ok: boolean; error: string | null } | undefined) => (m?.ok ? ' — وأُرسل البريد' : m?.error ? ` — لكن البريد لم يُرسل: ${m.error}` : '');

  return (
    <div className="ag" dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <RoomHead title="تصاريح الدخول" desc="أبواب المنتجات إلى حين إطلاق التسعير: من يدخل، وكم يجرّب، ومن يوافق." icon="shield"
        actions={<button className="ag-btn ghost" onClick={() => load()} disabled={!data}><Icon name="refresh" size={14} /> تحديث</button>} />
      {error ? <div className="ag-msg err">{error}</div> : null}{ok ? <div className="ag-msg ok">{ok}</div> : null}
      {!data && !error ? <div className="ag-card">… جارٍ التحميل</div> : null}
      {data ? <>
        <div className="ag-tabs">
          <button className={`ag-tab ${tab === 'requests' ? 'on' : ''}`} onClick={() => setTab('requests')}><Icon name="inbox" size={15} /> الطلبات {data.counts.pending ? <i>{data.counts.pending}</i> : null}</button>
          <button className={`ag-tab ${tab === 'permits' ? 'on' : ''}`} onClick={() => setTab('permits')}><Icon name="shield" size={15} /> التصاريح <span className="ag-muted">({data.counts.active} نشط)</span></button>
          <button className={`ag-tab ${tab === 'products' ? 'on' : ''}`} onClick={() => setTab('products')}><Icon name="settings" size={15} /> الأبواب</button>
        </div>

        {tab === 'products' ? <div className="ag-grid">{data.products.map((p) => { const f = { ...p, ...(pf[p.slug] || {}) }; const m = MODE[f.mode]; return (
          <div className="ag-card ag-prod" key={p.slug}><h3>{p.name_ar} <span className="ag-badge" style={{ color: m.color, background: m.bg }}>{m.label} · {m.hint}</span></h3>
            <div className="ag-muted">{p.entry_path} · بوّابة: /gate/{p.slug}</div>
            <div className="ag-row"><label>الحالة <select value={f.mode} onChange={(e) => setPf({ ...pf, [p.slug]: { ...pf[p.slug], mode: e.target.value as any } })}><option value="open">مفتوح للجميع</option><option value="permit">بتصريح (مع تجربة)</option><option value="closed">مغلق (رسالة فقط)</option></select></label>
              <label>التجربة (ثوانٍ) <input type="number" min={0} max={3600} step={30} value={f.trial_seconds} onChange={(e) => setPf({ ...pf, [p.slug]: { ...pf[p.slug], trial_seconds: Number(e.target.value) } })} style={{ width: 90 }} /></label></div>
            <div className="ag-row"><textarea placeholder="رسالة البوّابة (اتركها فارغة للنصّ الافتراضي)" value={f.message_ar || ''} onChange={(e) => setPf({ ...pf, [p.slug]: { ...pf[p.slug], message_ar: e.target.value } })} /></div>
            <div className="ag-row"><button className="ag-btn" disabled={!pf[p.slug] || busy === 'product_set' + p.slug} onClick={async () => { const r = await post({ action: 'product_set', slug: p.slug, ...pf[p.slug] }); if (r) { setOk(`حُفظ باب «${p.name_ar}» — يسري خلال دقيقة.`); setPf((x) => { const y = { ...x }; delete y[p.slug]; return y; }); } }}><Icon name="save" size={14} /> حفظ</button>
              <a className="ag-btn ghost" href={`/gate/${p.slug}`} target="_blank" rel="noreferrer">معاينة البوّابة</a></div>
          </div>); })}
          <div className="ag-card ag-muted">إشعارات الطلبات تصل إلى: <b>{data.notify_to}</b> (متغيّر GATE_NOTIFY_EMAIL). الطاقم يدخل كلّ الأبواب تلقائيًّا بعد تسجيل الدخول ومرور ببوّابة أيّ منتج مرّة واحدة.</div>
        </div> : null}

        {tab === 'requests' ? <div className="ag-card">
          <div className="ag-filter"><button className={filter === 'pending' ? 'on' : ''} onClick={() => setFilter('pending')}>قيد المراجعة ({data.counts.pending})</button><button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>الكلّ ({data.requests.length})</button></div>
          {!reqs.length ? <div className="ag-muted">لا طلبات {filter === 'pending' ? 'قيد المراجعة' : ''}.</div> : <table className="ag-table"><thead><tr><th>التاريخ</th><th>المنتج</th><th>الطالب</th><th>الغرض</th><th>الحالة</th><th>القرار</th></tr></thead><tbody>
            {reqs.map((r) => (<tr key={r.id}>
              <td className="ag-muted">{fmt(r.created_at)}</td><td><b>{prodName(r.product)}</b></td>
              <td><b>{r.name}</b><br /><span className="ag-mono" style={{ fontWeight: 400 }}>{r.email}</span>{r.phone ? <><br /><a className="ag-mono" style={{ fontWeight: 400 }} href={`https://wa.me/${r.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{r.phone}</a></> : null}{r.org ? <><br /><span className="ag-muted">{r.org}</span></> : null}</td>
              <td style={{ maxWidth: 260 }}>{r.purpose || <span className="ag-muted">—</span>}{r.note ? <div className="ag-muted">ملاحظة: {r.note}</div> : null}</td>
              <td>{r.status === 'pending' ? <span className="ag-badge" style={{ background: '#FBF0DC', color: '#8A5A1E' }}>قيد المراجعة</span> : r.status === 'approved' ? <span className="ag-badge" style={{ background: '#E9F6F1', color: '#1F5F5A' }}>معتمد</span> : <span className="ag-badge" style={{ background: '#FBE7E3', color: '#B9544A' }}>مرفوض</span>}{r.decided_at ? <div className="ag-muted">{fmt(r.decided_at)}<br />{r.decided_by}</div> : null}</td>
              <td>{r.status === 'pending' ? <div style={{ display: 'grid', gap: 6, minWidth: 190 }}>
                <div className="ag-row" style={{ marginTop: 0 }}><select value={days[r.id] ?? '30'} onChange={(e) => setDays({ ...days, [r.id]: e.target.value })}><option value="30">30 يومًا</option><option value="90">90 يومًا</option><option value="0">حتى إشعار آخر</option></select>
                  <button className="ag-btn ok" disabled={busy === 'approve' + r.id} onClick={async () => { const j = await post({ action: 'approve', id: r.id, days: Number(days[r.id] ?? '30'), note: notes[r.id] || undefined }); if (j) setOk(`اعتُمد طلب ${r.name} — الرمز ${j.permit.code}${mailNote(j.mail)}`); }}><Icon name="check" size={14} /> موافقة</button></div>
                <input placeholder="ملاحظة (تظهر في بريد الرفض)" value={notes[r.id] || ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} style={{ font: 'inherit', padding: '6px 10px', border: '2px solid #EADFD6', borderRadius: 10 }} />
                <div className="ag-row" style={{ marginTop: 0 }}><button className="ag-btn warn" disabled={busy === 'reject' + r.id} onClick={async () => { if (!confirm(`رفض طلب ${r.name}؟`)) return; const j = await post({ action: 'reject', id: r.id, note: notes[r.id] || undefined, mail: true }); if (j) setOk(`رُفض طلب ${r.name}${mailNote(j.mail)}`); }}><Icon name="x" size={14} /> رفض ببريد</button>
                  <button className="ag-btn ghost" disabled={busy === 'reject' + r.id} onClick={async () => { const j = await post({ action: 'reject', id: r.id, note: notes[r.id] || undefined, mail: false }); if (j) setOk(`رُفض طلب ${r.name} بلا بريد`); }}>رفض صامت</button></div>
              </div> : <span className="ag-muted">—</span>}</td>
            </tr>))}</tbody></table>}
        </div> : null}

        {tab === 'permits' ? <>
          <div className="ag-card"><b>تصريح يدوي</b><div className="ag-muted" style={{ marginBottom: 8 }}>لمن تواصل معك خارج الموقع: يصله بريد برابط يفتح الباب.</div>
            <div className="ag-form"><label>المنتج<select value={np.product} onChange={(e) => setNp({ ...np, product: e.target.value })}>{data.products.map((p) => <option key={p.slug} value={p.slug}>{p.name_ar}</option>)}</select></label>
              <label>البريد<input dir="ltr" value={np.email} onChange={(e) => setNp({ ...np, email: e.target.value })} /></label><label>الاسم<input value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} /></label>
              <label>المدّة<select value={np.days} onChange={(e) => setNp({ ...np, days: e.target.value })}><option value="30">30 يومًا</option><option value="90">90 يومًا</option><option value="0">حتى إشعار آخر</option></select></label>
              <button className="ag-btn ok" disabled={!np.email || busy === 'permit_create'} onClick={async () => { const j = await post({ action: 'permit_create', product: np.product, email: np.email.trim(), name: np.name.trim() || undefined, days: Number(np.days) }); if (j) { setOk(`أُنشئ التصريح ${j.permit.code}${mailNote(j.mail)} · الرابط: ${j.url}`); setNp({ ...np, email: '', name: '' }); } }}><Icon name="plus" size={14} /> إنشاء وإرسال</button></div></div>
          <div className="ag-card">{!data.permits.length ? <div className="ag-muted">لا تصاريح بعد.</div> : <table className="ag-table"><thead><tr><th>الرمز</th><th>المنتج</th><th>صاحبه</th><th>ينتهي</th><th>الاستخدام</th><th>الحالة</th><th></th></tr></thead><tbody>
            {data.permits.map((p) => (<tr key={p.id} style={{ opacity: active(p) ? 1 : .55 }}>
              <td><span className="ag-mono">{p.code}</span></td><td>{prodName(p.product)}</td>
              <td>{p.name ? <b>{p.name}</b> : null}{p.name ? <br /> : null}<span className="ag-mono" style={{ fontWeight: 400 }}>{p.email}</span></td>
              <td>{fmtD(p.expires_at)}</td><td>{p.uses} مرّة{p.last_used_at ? <div className="ag-muted">آخرها {fmt(p.last_used_at)}</div> : null}</td>
              <td>{p.revoked_at ? <span className="ag-badge" style={{ background: '#FBE7E3', color: '#B9544A' }}>مُلغى</span> : active(p) ? <span className="ag-badge" style={{ background: '#E9F6F1', color: '#1F5F5A' }}>نشط</span> : <span className="ag-badge" style={{ background: '#F1E9E2', color: '#6B5B67' }}>منتهٍ</span>}</td>
              <td><div className="ag-row" style={{ marginTop: 0 }}>
                <button className="ag-btn ghost" onClick={() => { navigator.clipboard?.writeText(`${location.origin}/gate/p/${p.code}`); setOk('نُسخ رابط التصريح'); }}><Icon name="copy" size={13} /> الرابط</button>
                {active(p) ? <button className="ag-btn ghost" disabled={busy === 'permit_resend' + p.id} onClick={async () => { const j = await post({ action: 'permit_resend', id: p.id }); if (j) setOk(`أُعيد إرسال التصريح إلى ${p.email}${mailNote(j.mail)}`); }}><Icon name="send" size={13} /> إعادة إرسال</button> : null}
                {active(p) ? <button className="ag-btn warn" disabled={busy === 'revoke' + p.id} onClick={async () => { if (!confirm(`إلغاء تصريح ${p.email}؟`)) return; const j = await post({ action: 'revoke', id: p.id }); if (j) setOk('أُلغي التصريح'); }}><Icon name="x" size={13} /> إلغاء</button> : null}
              </div></td>
            </tr>))}</tbody></table>}</div>
        </> : null}
      </> : null}
    </div>
  );
}
