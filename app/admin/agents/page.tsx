'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// إدارة أَثَر — الوكلاء المفوَّضون (P14-ب): مفاتيح الجهات · طلبات الوكلاء (اعتماد بشري) · السجل · «جرّب كوكيل» قبل منح أي مفتاح
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { AGENT_TOOLS, SCOPE_LABEL, DEFAULT_SCOPES } from '../../../lib/portal/agents';
import type { Scope } from '../../../lib/portal/agents';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
type KeyRow = { id: string; created_at: string; organization_id: string | null; org_name: string | null; name: string; prefix: string; scopes: Scope[]; daily_limit: number; expires_at: string | null; revoked_at: string | null; last_used_at: string | null; uses: number; note: string | null };
type Req = { id: string; created_at: string; kind: 'quote' | 'reserve' | 'dialogue' | 'report'; payload: any; status: string; response: any; decided_at: string | null; note: string | null; org_name: string | null; key_name: string | null };
type LogRow = { id: number; at: string; tool: string; ok: boolean; ms: number; meta: any; key_name: string | null };
type Data = { keys: KeyRow[]; requests: Req[]; log: LogRow[]; orgs: { id: string; name_ar: string }[]; stats: { keys: number; pending: number; calls: number } };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const KIND = { quote: 'عرض سعر', reserve: 'حجز مقاعد', dialogue: 'غرفة حوار', report: 'تقرير' };
const SAMPLE: Record<string, string> = { discover_programs: '{ "q": "", "limit": 5 }', skill_fit: '{ "skill": "التقويم" }', request_quote: '{ "program_id": "<id>", "seats": 25, "contact_email": "hr@org.sa" }', reserve_seats: '{ "program_id": "<id>", "participants": [{ "full_name": "نورة", "email": "n@org.sa" }], "contact_email": "hr@org.sa" }', verify_credential: '{ "code": "ATH-XXXX-XXXX" }', impact_report: '{ }', open_dialogue_room: '{ "topic": "برنامج لمعلمي المتوسطة", "contact_email": "hr@org.sa" }', request_status: '{ "request_id": "<id>" }' };

export default function AdminAgentsPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [tok, setTok] = useState(''); const [data, setData] = useState<Data | null>(null); const [tab, setTab] = useState<'requests' | 'keys' | 'log' | 'sandbox'>('requests');
  const [form, setForm] = useState({ name: '', organization_id: '', scopes: DEFAULT_SCOPES as Scope[], daily_limit: 200, expires_days: 365, note: '' }); const [issued, setIssued] = useState<{ key: string; name: string } | null>(null); const [busy, setBusy] = useState('');
  const [note, setNote] = useState<Record<string, string>>({}); const [sbTool, setSbTool] = useState('skill_fit'); const [sbArgs, setSbArgs] = useState(SAMPLE.skill_fit); const [sbOut, setSbOut] = useState<any>(null);
  // رمز جلسة حديث قبل كل نداء (getSession يجدّد الرمز المنتهي تلقائيًا) — كي لا تفشل العمليات بعد ترك الصفحة مفتوحة طويلًا
  const fresh = useCallback(async () => { const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || tok; if (tk !== tok) setTok(tk); return tk; }, [db, tok]);
  const hdr = useCallback(async () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${await fresh()}` }), [fresh]);
  async function load(tk: string) { const j = await fetch('/api/agents', { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setData(j); }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/agents'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
      const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function post(body: any) { return fetch('/api/agents', { method: 'POST', headers: await hdr(), body: JSON.stringify(body) }).then(r => r.json()).catch(() => null); }
  async function createKey() { setBusy('key'); const j = await post({ action: 'key_create', ...form, organization_id: form.organization_id || null }); if (!j?.success) setError(j?.error || 'تعذّر الإنشاء'); else { setIssued({ key: j.key, name: form.name }); setForm(f => ({ ...f, name: '', note: '' })); await load(await fresh()); } setBusy(''); }
  async function revoke(id: string) { if (!confirm('إبطال المفتاح فورًا؟ لا يمكن التراجع.')) return; setBusy(id); await post({ action: 'key_revoke', id }); await load(await fresh()); setBusy(''); }
  async function decide(id: string, status: 'approved' | 'rejected') { setBusy(id); const j = await post({ action: 'decide', id, status, note: note[id] || '' }); if (!j?.success) setError(j?.error || 'تعذّر الحفظ'); await load(await fresh()); setBusy(''); }
  async function runSandbox() { setBusy('sb'); setSbOut(null); let args: any = {}; try { args = JSON.parse(sbArgs || '{}'); } catch { setSbOut({ success: false, error: 'JSON غير صالح' }); setBusy(''); return; } const j = await fetch('/api/agent', { method: 'POST', headers: await hdr(), body: JSON.stringify({ tool: sbTool, args, sandbox: true }) }).then(r => r.json()).catch(e => ({ success: false, error: String(e) })); setSbOut(j); await load(await fresh()); setBusy(''); }

  if (!ready) return <div className="ag"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="ag-wrap"><div className="ag-card">{error ? <span className="ag-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  const pending = (data?.requests || []).filter(r => r.status === 'pending');
  return (
    <div className="ag"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ag-wrap">
        <header className="ag-head"><div><span className="ag-kicker"><Icon name="users" size={14} /> بوابة أَثَر · P14-ب</span><h1>الوكلاء المفوَّضون</h1><p>وكيل الموارد البشرية في الجهة يكتشف، يسأل الذاكرة «أي برنامج أثبت رفع هذه المهارة؟»، يطلب عرضًا، يحجز، ويتحقق — وكل التزام يمرّ من هنا على إنسان. المفاتيح لكل جهة بصلاحيات وحدود، والسجل كامل. الصفحة العامة: <a href="/agents" target="_blank" rel="noreferrer">/agents</a> · بطاقة الاكتشاف: <a href="/.well-known/ai-plugin.json" target="_blank" rel="noreferrer">ai-plugin.json</a></p></div></header>
        <PortalAdminTabs counts={{ '/admin/agents': pending.length }} />
        {error && <div className="ag-err">{error}</div>}
        <div className="ag-kpis"><span><b>{pending.length}</b> طلبًا ينتظر قرارك</span><span><b>{(data?.keys || []).filter(k => !k.revoked_at).length}</b> مفتاحًا نشطًا</span><span><b>{data?.log?.length ?? 0}</b> نداءً أخيرًا</span></div>
        <div className="ag-tabs"><button className={tab === 'requests' ? 'on' : ''} onClick={() => setTab('requests')}>الطلبات {pending.length ? <i>{pending.length}</i> : null}</button><button className={tab === 'keys' ? 'on' : ''} onClick={() => setTab('keys')}>المفاتيح</button><button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>السجل</button><button className={tab === 'sandbox' ? 'on' : ''} onClick={() => setTab('sandbox')}>جرّب كوكيل</button></div>

        {tab === 'requests' && (
          <section className="ag-card" data-testid="agent-requests">
            {!data?.requests?.length && <p className="ag-muted">لا طلبات من وكلاء بعد.</p>}
            {(data?.requests || []).map(r => (
              <article key={r.id} className={`ag-req ${r.status}`}>
                <div className="ag-reqhead"><span className={`ag-st ${r.status}`}>{r.status === 'pending' ? 'ينتظر إنسانًا' : r.status === 'approved' ? 'معتمد' : r.status === 'rejected' ? 'مرفوض' : 'مُجاب'}</span><b>{KIND[r.kind]}</b><small>{fmt(r.created_at)} · {r.org_name || r.key_name || (r.payload?.sandbox ? 'تجريبي' : 'بلا مفتاح')}</small></div>
                <div className="ag-reqbody">
                  {r.kind !== 'dialogue' && <p><b>{r.payload?.program_name}</b> · {r.payload?.seats} مقعدًا · ممثل الجهة: {r.payload?.contact_email}{r.payload?.indicative?.total != null && <> · تقديري: <b>{r.payload.indicative.total} {r.payload.indicative.currency}</b></>}</p>}
                  {r.kind === 'dialogue' && <p>موضوع: <b>{r.payload?.topic}</b> · {r.payload?.contact_email} · <a href={r.payload?.url} target="_blank" rel="noreferrer">ادخل الغرفة {r.payload?.room}</a></p>}
                  {Array.isArray(r.payload?.participants) && <small>{r.payload.participants.length} مشاركًا: {r.payload.participants.slice(0, 6).map((p: any) => p.full_name).join('، ')}{r.payload.participants.length > 6 ? '…' : ''}</small>}
                  {r.payload?.notes && <small>ملاحظات الوكيل: {r.payload.notes}</small>}
                  {r.status === 'pending' ? <div className="ag-decide"><input value={note[r.id] || ''} onChange={e => setNote(n => ({ ...n, [r.id]: e.target.value }))} placeholder="ملاحظة ترافق القرار (اختياري)" /><button type="button" className="pt-btn gold small" disabled={busy === r.id} onClick={() => decide(r.id, 'approved')}><Icon name="check" size={13} /> {r.kind === 'reserve' ? 'اعتمد وأنشئ طلبات التسجيل' : r.kind === 'dialogue' ? 'تم الالتحاق' : 'اعتمد'}</button><button type="button" className="pt-btn ghost small" disabled={busy === r.id} onClick={() => decide(r.id, 'rejected')}><Icon name="x" size={13} /> ارفض</button></div>
                    : <small>قرار: {fmt(r.decided_at)}{r.note ? ` · ${r.note}` : ''}{r.response?.enrolled != null ? ` · أُنشئت ${r.response.enrolled} طلبات تسجيل` : ''}</small>}
                </div>
              </article>
            ))}
          </section>
        )}

        {tab === 'keys' && (
          <section className="ag-card" data-testid="agent-keys">
            <h3>إصدار مفتاح لجهة</h3>
            <div className="ag-form">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="اسم المفتاح — مثل: وكيل الموارد البشرية · جامعة الأمير مقرن" />
              <select value={form.organization_id} onChange={e => setForm(f => ({ ...f, organization_id: e.target.value }))}><option value="">— بلا جهة (عام) —</option>{(data?.orgs || []).map(o => <option key={o.id} value={o.id}>{o.name_ar}</option>)}</select>
              <div className="ag-scopes">{(Object.keys(SCOPE_LABEL) as Scope[]).map(s => <label key={s}><input type="checkbox" checked={form.scopes.includes(s)} onChange={e => setForm(f => ({ ...f, scopes: e.target.checked ? [...f.scopes, s] : f.scopes.filter(x => x !== s) }))} /> {SCOPE_LABEL[s].ar}</label>)}</div>
              <div className="ag-row"><label>حد يومي <input type="number" min={10} max={5000} value={form.daily_limit} onChange={e => setForm(f => ({ ...f, daily_limit: Number(e.target.value) }))} /></label><label>ينتهي بعد (يوم) <input type="number" min={0} max={730} value={form.expires_days} onChange={e => setForm(f => ({ ...f, expires_days: Number(e.target.value) }))} /></label><input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="ملاحظة داخلية" /><button type="button" className="pt-btn gold" disabled={busy === 'key' || form.name.trim().length < 2} onClick={createKey}><Icon name="plus" size={14} /> أصدر المفتاح</button></div>
            </div>
            {issued && <div className="ag-issued" data-testid="issued-key"><b>المفتاح الكامل لـ«{issued.name}» — يُعرض مرة واحدة فقط:</b><code>{issued.key}</code><small>انسخه الآن وسلّمه للجهة عبر قناة آمنة. يُرسَل في الترويسة <code>X-Agent-Key</code> إلى <code>/api/agent</code>.</small><button type="button" className="pt-btn light small" onClick={() => { navigator.clipboard?.writeText(issued.key); }}><Icon name="copy" size={13} /> انسخ</button></div>}
            <table className="ag-table"><thead><tr><th>المفتاح</th><th>الجهة</th><th>الصلاحيات</th><th>الاستخدام</th><th>الحالة</th><th></th></tr></thead><tbody>{(data?.keys || []).map(k => <tr key={k.id} className={k.revoked_at ? 'off' : ''}><td><b>{k.name}</b><small>{k.prefix}…</small></td><td>{k.org_name || '—'}</td><td><small>{k.scopes.map(s => SCOPE_LABEL[s]?.ar || s).join(' · ')}</small></td><td>{k.uses} · حد {k.daily_limit}/يوم<small>آخر: {fmt(k.last_used_at)}</small></td><td>{k.revoked_at ? 'مُبطَل' : k.expires_at && k.expires_at < new Date().toISOString() ? 'منتهٍ' : 'نشط'}</td><td>{!k.revoked_at && <button type="button" className="pt-btn ghost small" disabled={busy === k.id} onClick={() => revoke(k.id)}>أبطل</button>}</td></tr>)}{!data?.keys?.length && <tr><td colSpan={6} className="ag-muted">لا مفاتيح بعد.</td></tr>}</tbody></table>
          </section>
        )}

        {tab === 'log' && (
          <section className="ag-card" data-testid="agent-log">
            <table className="ag-table"><thead><tr><th>الوقت</th><th>الوكيل</th><th>الأداة</th><th>النتيجة</th><th>زمن</th></tr></thead><tbody>{(data?.log || []).map(l => <tr key={l.id}><td>{fmt(l.at)}</td><td>{l.meta?.sandbox ? 'تجريبي (طاقم)' : l.key_name || (l.meta?.anon ? `بلا مفتاح · ${l.meta?.ip || ''}` : '—')}</td><td><code>{l.tool}</code></td><td>{l.ok ? '✓' : `✗ ${l.meta?.denied || l.meta?.invalid || l.meta?.error || ''}`}</td><td>{l.ms} م.ث</td></tr>)}{!data?.log?.length && <tr><td colSpan={5} className="ag-muted">لا نداءات بعد.</td></tr>}</tbody></table>
          </section>
        )}

        {tab === 'sandbox' && (
          <section className="ag-card" data-testid="agent-sandbox">
            <h3>جرّب كوكيل</h3><p className="ag-muted">تحاكي وكيل جهة بكل الصلاحيات؛ الطلبات التي تُنشأ هنا تُعلَّم «تجريبي» ولا تُنشئ تسجيلات عند الاعتماد.</p>
            <div className="ag-sb"><select value={sbTool} onChange={e => { setSbTool(e.target.value); setSbArgs(SAMPLE[e.target.value] || '{}'); setSbOut(null); }}>{AGENT_TOOLS.map(t => <option key={t.name} value={t.name}>{t.name} — {t.title_ar}</option>)}</select><textarea value={sbArgs} onChange={e => setSbArgs(e.target.value)} rows={4} dir="ltr" /><button type="button" className="pt-btn gold" disabled={busy === 'sb'} onClick={runSandbox}><Icon name="play" size={14} /> نفّذ</button></div>
            <p className="ag-tooldesc">{AGENT_TOOLS.find(t => t.name === sbTool)?.desc_ar}</p>
            {sbOut && <pre className="ag-out" dir="ltr" data-testid="sandbox-out">{JSON.stringify(sbOut, null, 2)}</pre>}
          </section>
        )}
      </div>
    </div>
  );
}

const CSS = `
.ag{padding:20px 16px 48px;background:#f6f8fb;min-height:60vh;font-family:inherit}
.ag-wrap{max-width:1100px;margin:0 auto;display:grid;gap:12px}
.ag-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.ag-head p{margin:0;color:#64748b;font-size:14px;line-height:1.7;max-width:900px}.ag-head a{color:#0b8a83}.ag-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b8a83}
.ag-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px}.ag-card h3{margin:0 0 8px;font-size:16px;color:#0f2a4e}.ag-err{color:#b91c1c;font-size:13px}.ag-muted{color:#64748b;font-size:13.5px}
.ag-kpis{display:flex;gap:16px;font-size:14px;color:#475569;flex-wrap:wrap}.ag-kpis b{color:#0f2a4e;font-size:20px;margin-inline-end:4px}
.ag-tabs{display:flex;gap:6px;flex-wrap:wrap}.ag-tabs button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:800;color:#475569;cursor:pointer}.ag-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.ag-tabs i{font-style:normal;background:#c9a24b;color:#0f2a4e;border-radius:999px;padding:0 7px;font-size:11px;margin-inline-start:4px}
.ag-req{border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin-bottom:10px}.ag-req.pending{border-color:#c9a24b;background:#fffdf7}.ag-reqhead{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.ag-reqhead b{color:#0f2a4e}.ag-reqhead small{color:#64748b;font-size:12px}
.ag-reqbody p{margin:6px 0;font-size:14px;color:#1e293b}.ag-reqbody small{display:block;color:#64748b;font-size:12.5px;margin-top:2px}.ag-reqbody a{color:#0b8a83}
.ag-st{font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:#fdf6e3;color:#9a6b00}.ag-st.approved,.ag-st.answered{background:#e6f4f1;color:#0b8a83}.ag-st.rejected{background:#fee2e2;color:#b91c1c}
.ag-decide{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap}.ag-decide input{flex:1;min-width:220px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 12px;font:inherit;font-size:13px}
.ag-form{display:grid;gap:8px}.ag-form input,.ag-form select{border:1px solid #cbd5e1;border-radius:10px;padding:9px 12px;font:inherit;font-size:14px;background:#fff}.ag-scopes{display:flex;gap:10px;flex-wrap:wrap;font-size:13px;color:#1e293b}.ag-scopes label{display:inline-flex;gap:4px;align-items:center;border:1px solid #e2e8f0;border-radius:999px;padding:4px 10px}
.ag-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ag-row label{font-size:12.5px;color:#475569;display:inline-flex;gap:6px;align-items:center}.ag-row input[type=number]{width:90px}.ag-row>input{flex:1;min-width:160px}
.ag-issued{margin-top:12px;background:#0f2a4e;color:#fff;border-radius:14px;padding:14px 16px;display:grid;gap:6px}.ag-issued code{font-size:16px;letter-spacing:.5px;background:rgba(255,255,255,.1);padding:8px 12px;border-radius:10px;direction:ltr;text-align:left;word-break:break-all}.ag-issued small{color:#cbd5e1;font-size:12px}.ag-issued small code{font-size:11px;padding:1px 6px}
.ag-table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}.ag-table th{text-align:start;color:#64748b;font-weight:800;font-size:12px;border-bottom:1px solid #e2e8f0;padding:6px 8px}.ag-table td{border-bottom:1px solid #f1f5f9;padding:8px;vertical-align:top;color:#1e293b}.ag-table td small{display:block;color:#94a3b8;font-size:11.5px}.ag-table tr.off td{opacity:.55}.ag-table code{font-size:12px;background:#f1f5f9;padding:2px 6px;border-radius:6px}
.ag-sb{display:grid;grid-template-columns:1fr;gap:8px}.ag-sb select,.ag-sb textarea{border:1px solid #cbd5e1;border-radius:10px;padding:9px 12px;font:inherit;font-size:13.5px}.ag-sb textarea{font-family:ui-monospace,Menlo,Consolas,monospace}.ag-tooldesc{color:#475569;font-size:13px;margin:8px 0 0}
.ag-out{margin-top:10px;background:#0f172a;color:#e2e8f0;border-radius:12px;padding:12px 14px;font-size:12px;line-height:1.6;max-height:420px;overflow:auto;text-align:left}
`;
