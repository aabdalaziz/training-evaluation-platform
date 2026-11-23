'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** هـ-1/3 — «مقاعد اقْرَأْ» داخل مكتب المؤلّف/المدير: عدّادات (سارٍ · تجارب · مدفوع)، بحث بالبريد، منح أيّام يدويًّا (RPC portal_grant_seat — مديرون فقط). */
import { useCallback, useEffect, useState } from 'react';

type Row = { id: string; learner_email: string; plan_code: string; source: string; starts_at: string; ends_at: string; invoice_id: string | null; note: string | null; active: boolean; days_left: number };
const SRC: Record<string, string> = { trial: 'تجربة', invoice: 'فاتورة', staff: 'منح الطاقم', org: 'جهة' };
const d10 = (s: string) => String(s || '').slice(0, 10);

export default function IqraSeats({ auth }: { auth: () => Promise<Record<string, string>> }) {
  const [rows, setRows] = useState<Row[]>([]); const [sum, setSum] = useState({ active: 0, trials: 0, paid: 0 }); const [q, setQ] = useState(''); const [err, setErr] = useState<string | null>(null); const [ok, setOk] = useState<string | null>(null);
  const [g, setG] = useState({ email: '', days: '30', note: '' }); const [busy, setBusy] = useState(false); const [open, setOpen] = useState(false);
  const load = useCallback(async () => { setErr(null); const H = await auth(); const j = await fetch(`/api/iqra/access?list=1&q=${encodeURIComponent(q)}`, { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.ok) { if (j?.error !== 'forbidden') setErr(j?.error || 'تعذّر تحميل المقاعد'); return; } setRows(j.rows || []); setSum({ active: j.active || 0, trials: j.trials || 0, paid: j.paid || 0 }); }, [auth, q]);
  useEffect(() => { if (open) void load(); }, [open, load]);
  const grant = async () => { setBusy(true); setErr(null); setOk(null); try { const H = await auth(); const r = await fetch('/api/iqra/access', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'grant', email: g.email, days: Number(g.days), note: g.note || null }) }); const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`); setOk(`مُنح ${g.email} ${g.days} يومًا`); setG({ email: '', days: '30', note: '' }); void load(); } catch (e: any) { setErr(String(e?.message || e)); } setBusy(false); };
  return <section className="am-card iqs-admin" data-testid="iqra-seats">
    <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>مقاعد اقْرَأْ <small>تجربة ٧ أيام · خطط شهر/٣ أشهر/سنة عبر فواتير أَثَر · منح الطاقم</small>
      <button type="button" className="mm-hbtn" style={{ marginInlineStart: 'auto' }} onClick={() => setOpen((v) => !v)} data-testid="iqra-seats-toggle">{open ? 'طيّ' : 'عرض'}</button></h3>
    {open && <>
      <div className="mm-cards" style={{ marginTop: 8 }}>
        <div className="mm-card teal"><span>مقاعد سارية</span><b data-testid="iqra-seats-active">{sum.active}</b><small>الآن</small></div>
        <div className="mm-card sand"><span>تجارب</span><b>{sum.trials}</b><small>٧ أيام · مرّة لكل بريد</small></div>
        <div className="mm-card gold"><span>مدفوعة</span><b>{sum.paid}</b><small>فواتير مسدَّدة أو مُعفاة</small></div>
      </div>
      {err && <div className="am-err" role="alert">{err}</div>}{ok && <div className="am-ok" role="status">{ok}</div>}
      <div className="mm-row" style={{ marginTop: 10 }}>
        <input dir="ltr" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالبريد" aria-label="بحث بالبريد" />
        <button type="button" className="mm-hbtn" onClick={() => void load()}>بحث</button>
      </div>
      <details style={{ marginTop: 10 }}><summary style={{ cursor: 'pointer', fontWeight: 800, color: '#3A1F36' }}>منح أيّام يدويًّا (مديرون)</summary>
        <div className="mm-row" style={{ marginTop: 8 }}>
          <input dir="ltr" value={g.email} onChange={(e) => setG({ ...g, email: e.target.value })} placeholder="learner@example.com" aria-label="البريد" data-testid="iqra-grant-email" />
          <input type="number" min={1} max={1000} value={g.days} onChange={(e) => setG({ ...g, days: e.target.value })} aria-label="الأيّام" style={{ width: 90 }} />
          <input value={g.note} onChange={(e) => setG({ ...g, note: e.target.value })} placeholder="ملاحظة (اختياري)" aria-label="ملاحظة" />
          <button type="button" className="mm-hbtn gold" onClick={() => void grant()} disabled={busy || !g.email} data-testid="iqra-grant-btn">{busy ? '…' : 'امنح'}</button>
        </div></details>
      <div style={{ overflowX: 'auto', marginTop: 10 }}>
        <table className="mm-t"><thead><tr><th>البريد</th><th>المصدر</th><th>الخطّة</th><th>من</th><th>إلى</th><th>الحالة</th><th>ملاحظة</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} data-testid="iqra-seat-row"><td dir="ltr" style={{ textAlign: 'start' }}>{r.learner_email}</td><td>{SRC[r.source] || r.source}</td><td>{r.plan_code}</td><td dir="ltr">{d10(r.starts_at)}</td><td dir="ltr">{d10(r.ends_at)}</td><td>{r.active ? <b style={{ color: '#2F6B66' }}>سارٍ · {r.days_left} ي</b> : <span style={{ color: '#8E7F8A' }}>منتهٍ</span>}</td><td>{r.note || '—'}</td></tr>)}
            {!rows.length && <tr><td colSpan={7} style={{ color: '#8E7F8A' }}>لا مقاعد بعد — أوّل مقعد يأتي من تجربة متعلّم أو فاتورة مسدَّدة.</td></tr>}</tbody></table>
      </div>
    </>}
  </section>;
}
