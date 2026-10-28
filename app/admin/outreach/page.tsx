'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// إدارة أَثَر — الإبلاغ متعدد القنوات «نبض الوصول» (P16): صحة القنوات · قائمة اليد · سجل التسليم · قوالب واتساب · إرسال تجريبي
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
type Row = { id: number; kind: string; kind_ar: string; ref_id: string | null; to_email: string | null; to_phone: string | null; to_name: string | null; subject: string; channel: string; channel_ar: string; status: string; status_ar: string; plan: string[]; attempts: number; errors: { channel: string; error: string; at: string }[]; payload: { text: string; url: string | null; wa: { template: string; params: string[] } | null }; created_at: string; sent_at: string | null; delivered_at: string | null; read_at: string | null; manual_done_at: string | null; manual_by: string | null };
type Health = { channels: { whatsapp: boolean; email: boolean; email_test: boolean; push: boolean; from: string; admin_phone: string | null; site: string }; stats: Record<string, { total: number; sent: number; delivered: number; failed: number; manual: number; last_ok: string | null }>; manual_count: number; learned: { lines: string[]; enough: boolean }; templates_count: number };
type Tpl = { name: string; label_ar: string; category: string; body_ar: string; vars: string[] };
type Tab = 'health' | 'manual' | 'log' | 'templates' | 'test';
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const CH_AR: Record<string, string> = { whatsapp: 'واتساب', email: 'بريد', push: 'إشعار فوري', manual: 'تسليم يدوي' };
const ST_TONE: Record<string, string> = { queued: '#64748b', sent: '#2563eb', delivered: '#0b8a83', read: '#0b8a83', failed: '#dc2626', manual: '#b45309', done: '#0f2a4e' };
const waLink = (phone: string | null, text: string) => `https://wa.me/${phone ? phone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(text)}`;

export default function AdminOutreachPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [tok, setTok] = useState(''); const [tab, setTab] = useState<Tab>('health');
  const [health, setHealth] = useState<Health | null>(null); const [manual, setManual] = useState<Row[] | null>(null); const [adminPhone, setAdminPhone] = useState<string | null>(null);
  const [log, setLog] = useState<Row[] | null>(null); const [tpls, setTpls] = useState<Tpl[] | null>(null); const [lang, setLang] = useState('ar');
  const [fStatus, setFStatus] = useState(''); const [fChannel, setFChannel] = useState(''); const [fQ, setFQ] = useState('');
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState(''); const [testTo, setTestTo] = useState(''); const [copied, setCopied] = useState<number | string | null>(null);
  const fresh = useCallback(async () => { const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || tok; if (tk !== tok) setTok(tk); return tk; }, [db, tok]);
  const hdr = useCallback(async () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${await fresh()}` }), [fresh]);
  const get = useCallback(async (qs: string) => fetch(`/api/notify?${qs}`, { headers: await hdr(), cache: 'no-store' }).then(r => r.json()).catch(() => null), [hdr]);
  async function loadHealth() { const j = await get('view=health'); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setError(''); setHealth(j); }
  async function loadManual() { const j = await get('view=manual'); if (j?.success) { setManual(j.rows); setAdminPhone(j.admin_phone || null); } }
  async function loadLog() { const p = new URLSearchParams({ view: 'log' }); if (fStatus) p.set('status', fStatus); if (fChannel) p.set('channel', fChannel); if (fQ) p.set('q', fQ); const j = await get(p.toString()); if (j?.success) setLog(j.rows); }
  async function loadTpls() { const j = await get('view=templates'); if (j?.success) { setTpls(j.templates); setLang(j.lang || 'ar'); } }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/outreach'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
      const { data: s } = await db.auth.getSession(); setTok(s.session?.access_token || ''); setTestTo(String(user.email || ''));
      await loadHealth(); await loadManual(); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!ready) return; if (tab === 'log') loadLog(); if (tab === 'templates' && !tpls) loadTpls(); if (tab === 'manual') loadManual(); if (tab === 'health') loadHealth(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, ready]);
  async function post(body: any) { if (busy) return null; setBusy(body.action + (body.id || '')); setMsg(''); const j = await fetch('/api/notify', { method: 'POST', headers: await hdr(), body: JSON.stringify(body) }).then(r => r.json()).catch(() => null); setBusy(''); if (!j?.success) { setMsg(j?.error || 'تعذّر التنفيذ'); return null; } return j; }
  async function copy(text: string, key: number | string) { try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { setMsg('تعذّر النسخ — حدّد النص وانسخه يدويًا'); } }
  async function done(r: Row) { const j = await post({ action: 'manual_done', id: r.id }); if (j) { setMsg('سُجّل التسليم اليدوي.'); await loadManual(); await loadHealth(); } }
  async function retry(r: Row) { const j = await post({ action: 'retry', id: r.id }); if (j) { setMsg(j.message || 'تمت المحاولة'); await loadManual(); if (tab === 'log') await loadLog(); } }
  async function test() { const j = await post({ action: 'test', to: testTo }); if (j) { setMsg(j.message || 'تم'); await loadHealth(); await loadManual(); } }
  const manualText = (r: Row) => `${r.payload.text || r.subject}${r.payload.url && !(r.payload.text || '').includes(r.payload.url) ? `\n${r.payload.url}` : ''}`;

  if (!ready) return <div className="ou"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="ou-wrap"><div className="ou-card">{error ? <span className="ou-err">{error}</span> : 'جارٍ التحقق من الصلاحية…'}</div></div></div>;
  const ch = health?.channels; const st = health?.stats || {};
  const chip = (ok: boolean, warn = false) => <i className={`ou-dot ${ok ? (warn ? 'warn' : 'ok') : 'off'}`} />;
  return (
    <div className="ou"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ou-wrap">
        <header className="ou-head"><div><span className="ou-kicker"><Icon name="send" size={14} /> بوابة أَثَر · P16</span><h1>الإبلاغ متعدد القنوات — نبض الوصول</h1><p>رسالة تُكتب مرة وتصل بأي قناة متاحة: واتساب ← بريد ← إشعار فوري ← قائمة اليد. لا رسالة تضيع بصمت، والحالة المعروضة هي حالة المزوّد الفعلية.</p></div></header>
        <PortalAdminTabs counts={{ '/admin/outreach': health?.manual_count || 0 }} />
        {error && <div className="ou-err">{error}</div>}
        {msg && <div className="ou-msg" data-testid="out-msg">{msg}</div>}
        <nav className="ou-tabs">
          {([['health', 'صحة القنوات'], ['manual', `قائمة اليد (${health?.manual_count || 0})`], ['log', 'سجل التسليم'], ['templates', 'قوالب واتساب'], ['test', 'إرسال تجريبي']] as [Tab, string][]).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} data-testid={`out-tab-${k}`}>{l}</button>)}
        </nav>

        {tab === 'health' && ch && (
          <section className="ou-grid" data-testid="out-health">
            <div className="ou-card"><h3>{chip(ch.whatsapp)} واتساب الرسمي</h3><p>{ch.whatsapp ? 'مضبوط (Cloud API)' : 'غير مضبوط — أضف WHATSAPP_TOKEN و WHATSAPP_PHONE_NUMBER_ID في Vercel بعد اعتماد القوالب'}</p>{stat(st.whatsapp)}</div>
            <div className="ou-card"><h3>{chip(ch.email, ch.email_test)} البريد</h3><p>{!ch.email ? 'غير مضبوط — RESEND_API_KEY مفقود' : ch.email_test ? <>⚠ <b>وضع الاختبار</b>: المرسِل <code dir="ltr">{ch.from}</code> لا يصل إلا لصاحب حساب Resend. اضبط REPORTS_FROM_EMAIL بنطاق متحقَّق.</> : <>المرسِل: <code dir="ltr">{ch.from}</code></>}</p>{stat(st.email)}</div>
            <div className="ou-card"><h3>{chip(ch.push)} الإشعار الفوري</h3><p>{ch.push ? 'مضبوط (VAPID) — يصل لمن فعّله من متصفحه' : 'غير مضبوط — مفاتيح VAPID مفقودة'}</p>{stat(st.push)}</div>
            <div className="ou-card"><h3>{chip(true)} قائمة اليد</h3><p>تعمل دائمًا. {ch.admin_phone ? <>زر «افتح في واتساب» يفتح محادثة من هاتف الإدارة <code dir="ltr">{ch.admin_phone}</code>.</> : 'أضف OUTREACH_ADMIN_PHONE ليُفتح واتساب الإداري مباشرة بالنص الجاهز.'}</p>{stat(st.manual)}</div>
            <div className="ou-card ou-span"><h3><Icon name="refresh" size={14} /> ما تعلّمته أَثَر عن القنوات</h3>{health?.learned.enough ? <ul>{health.learned.lines.map((l, i) => <li key={i}>{l}</li>)}</ul> : <p className="ou-muted">لا دليل كافٍ بعد — يحتاج ≥ 5 أشخاص لكل قناة أُسندت إليهم مهمة عبرها.</p>}</div>
          </section>
        )}

        {tab === 'manual' && (
          <section className="ou-card" data-testid="out-manual">
            <h3>قائمة اليد — رسائل تنتظر تسليمًا بشريًا</h3>
            <p className="ou-muted">فشلت كل القنوات الآلية لهؤلاء (أو لم تُضبط بعد). انسخ النص أو افتحه في واتساب، ثم اضغط «تم».</p>
            {!manual ? <p>…</p> : !manual.length ? <p className="ou-empty">لا شيء ينتظر — كل الرسائل وصلت بقنواتها.</p> : (
              <div className="ou-list">{manual.map(r => (
                <article key={r.id} className="ou-item" data-testid="out-manual-item">
                  <header><b>{r.kind_ar}</b><span>{r.to_name || r.to_email || r.to_phone}</span><small>{fmt(r.created_at)}</small></header>
                  <div className="ou-subj">{r.subject}</div>
                  <pre className="ou-text">{manualText(r)}</pre>
                  <div className="ou-why">السبب: {r.errors?.length ? r.errors.map(e => `${CH_AR[e.channel] || e.channel}: ${e.error}`).join(' · ') : 'لا قناة آلية مضبوطة لهذا الشخص (لا هاتف بموافقة واتساب، ولا بريد مضبوط)'}</div>
                  <footer>
                    <button className="ou-btn" onClick={() => copy(manualText(r), r.id)}><Icon name="copy" size={13} /> {copied === r.id ? 'نُسخ' : 'نسخ النص'}</button>
                    <a className="ou-btn wa" href={waLink(r.to_phone || adminPhone, manualText(r))} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={13} /> افتح في واتساب{r.to_phone ? '' : ' (اختر جهة الاتصال)'}</a>
                    {r.to_email && <a className="ou-btn" href={`mailto:${r.to_email}?subject=${encodeURIComponent(r.subject)}&body=${encodeURIComponent(manualText(r))}`}><Icon name="mail" size={13} /> بريدك الشخصي</a>}
                    <button className="ou-btn" onClick={() => retry(r)} disabled={!!busy}><Icon name="refresh" size={13} /> أعد المحاولة</button>
                    <button className="ou-btn primary" onClick={() => done(r)} disabled={!!busy} data-testid="out-manual-done"><Icon name="check" size={13} /> تم التسليم</button>
                  </footer>
                </article>
              ))}</div>
            )}
          </section>
        )}

        {tab === 'log' && (
          <section className="ou-card" data-testid="out-log">
            <div className="ou-filters">
              <select value={fStatus} onChange={e => setFStatus(e.target.value)}><option value="">كل الحالات</option>{['queued', 'sent', 'delivered', 'read', 'failed', 'manual', 'done'].map(s => <option key={s} value={s}>{({ queued: 'قيد الإرسال', sent: 'أُرسلت', delivered: 'وصلت', read: 'قُرئت', failed: 'فشلت', manual: 'بانتظار اليد', done: 'سُلّمت يدويًا' } as any)[s]}</option>)}</select>
              <select value={fChannel} onChange={e => setFChannel(e.target.value)}><option value="">كل القنوات</option>{Object.entries(CH_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <input value={fQ} onChange={e => setFQ(e.target.value)} placeholder="بريد، اسم، موضوع…" />
              <button className="ou-btn" onClick={loadLog}><Icon name="filter" size={13} /> تطبيق</button>
            </div>
            {!log ? <p>…</p> : !log.length ? <p className="ou-empty">لا رسائل بعد.</p> : (
              <div className="ou-tbl"><table><thead><tr><th>الوقت</th><th>النوع</th><th>إلى</th><th>الموضوع</th><th>القناة</th><th>الحالة</th><th>المحاولات</th></tr></thead>
                <tbody>{log.map(r => <tr key={r.id} data-testid="out-log-row"><td>{fmt(r.created_at)}</td><td>{r.kind_ar}</td><td><bdi>{r.to_name || ''}</bdi> <small dir="ltr">{r.to_email || r.to_phone}</small></td><td>{r.subject}</td><td>{r.channel_ar}</td><td><span className="ou-st" style={{ color: ST_TONE[r.status] }}>{r.status_ar}</span>{r.read_at ? <small> · قُرئت {fmt(r.read_at)}</small> : r.delivered_at ? <small> · وصلت {fmt(r.delivered_at)}</small> : null}{!!r.errors?.length && <small className="ou-why" title={r.errors.map(e => e.error).join('\n')}> · {r.errors.length} خطأ</small>}</td><td>{r.attempts}</td></tr>)}</tbody></table></div>
            )}
          </section>
        )}

        {tab === 'templates' && (
          <section className="ou-card" data-testid="out-templates">
            <h3>قوالب واتساب — كما تُقدَّم لاعتماد Meta (اللغة: {lang})</h3>
            <p className="ou-muted">في WhatsApp Manager → Message templates → Create: الاسم كما هو، الفئة Utility، اللغة Arabic، والنص أدناه بمتغيراته {'{{1}}…'} بالترتيب نفسه. بعد الاعتماد لا يلزم أي تعديل في الكود.</p>
            {!tpls ? <p>…</p> : <div className="ou-list">{tpls.map(t => (
              <article key={t.name} className="ou-item"><header><b dir="ltr">{t.name}</b><span>{t.label_ar}</span><small>{t.category}</small></header><pre className="ou-text">{t.body_ar}</pre><div className="ou-why">المتغيرات: {t.vars.map((v, i) => `{{${i + 1}}} = ${v}`).join(' · ')}</div><footer><button className="ou-btn" onClick={() => copy(t.body_ar, t.name)}><Icon name="copy" size={13} /> {copied === t.name ? 'نُسخ' : 'نسخ النص'}</button></footer></article>
            ))}</div>}
          </section>
        )}

        {tab === 'test' && (
          <section className="ou-card" data-testid="out-test">
            <h3>إرسال تجريبي</h3>
            <p className="ou-muted">تُرسل رسالة قصيرة إلى العنوان أدناه عبر أول قناة تنجح حسب تفضيلاته — وتظهر النتيجة الحقيقية هنا وفي السجل.</p>
            <div className="ou-filters"><input value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="name@org.sa" dir="ltr" /><button className="ou-btn primary" onClick={test} disabled={!!busy} data-testid="out-test-send"><Icon name="send" size={13} /> {busy === 'test' ? 'جارٍ الإرسال…' : 'أرسل الآن'}</button></div>
          </section>
        )}
        <p className="ou-foot">لا واتساب بلا موافقة صريحة، ولا رسائل في ساعات الهدوء، وما لم يُؤكَّد يبقى «أُرسلت» لا «وصلت» · P16 © 2026</p>
      </div>
    </div>
  );
}

function stat(s?: { total: number; sent: number; delivered: number; failed: number; manual: number; last_ok: string | null }) {
  if (!s || !s.total) return <small className="ou-muted">لا رسائل خلال 7 أيام</small>;
  return <small className="ou-stat">{s.total} رسالة · {s.sent} أُرسلت · {s.delivered} مؤكَّدة الوصول · {s.failed} فشلت{s.last_ok ? ` · آخر نجاح ${fmt(s.last_ok)}` : ''}</small>;
}

const CSS = `
.ou{padding:20px 16px 48px;background:#f6f8fb;min-height:60vh;font-family:inherit}
.ou-wrap{max-width:1100px;margin:0 auto;display:grid;gap:12px}
.ou-head h1{margin:4px 0;font-size:24px;color:#0f2a4e}.ou-head p{margin:0;color:#64748b;font-size:14px;max-width:760px}.ou-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#0b8a83;font-weight:800}
.ou-tabs{display:flex;gap:6px;flex-wrap:wrap}.ou-tabs button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 14px;font-weight:800;cursor:pointer;font-family:inherit;color:#334155}.ou-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.ou-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;display:grid;gap:8px}.ou-card h3{margin:0;font-size:15px;color:#0f2a4e;display:flex;align-items:center;gap:8px}.ou-card p{margin:0;font-size:13px;color:#334155;line-height:1.8}.ou-card code{background:#f1f5f9;padding:1px 6px;border-radius:6px;font-size:12px}
.ou-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.ou-span{grid-column:1/-1}.ou-card ul{margin:0;padding-inline-start:18px;font-size:13px;line-height:1.9}
.ou-dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#94a3b8}.ou-dot.ok{background:#0b8a83}.ou-dot.warn{background:#f59e0b}.ou-dot.off{background:#cbd5e1}
.ou-muted{color:#64748b;font-size:12px}.ou-stat{color:#475569;font-size:12px}.ou-empty{color:#0b8a83;font-weight:700;font-size:13px}
.ou-list{display:grid;gap:10px}.ou-item{border:1px solid #e2e8f0;border-radius:12px;padding:12px;display:grid;gap:6px;background:#fcfcfd}.ou-item header{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;font-size:13px}.ou-item header b{color:#0f2a4e}.ou-item header span{color:#334155}.ou-item header small{color:#94a3b8;margin-inline-start:auto}
.ou-subj{font-weight:800;font-size:14px;color:#0f172a}.ou-text{margin:0;white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.8;background:#fff;border:1px dashed #cbd5e1;border-radius:8px;padding:8px 10px;color:#334155;max-height:180px;overflow:auto}
.ou-why{font-size:12px;color:#b45309}.ou-item footer{display:flex;gap:6px;flex-wrap:wrap}
.ou-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:7px 12px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;color:#0f2a4e;text-decoration:none}.ou-btn.primary{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.ou-btn.wa{background:#e8f8f5;border-color:#0b8a83;color:#0b8a83}.ou-btn:disabled{opacity:.6;cursor:default}
.ou-filters{display:flex;gap:6px;flex-wrap:wrap}.ou-filters select,.ou-filters input{border:1px solid #cbd5e1;border-radius:9px;padding:7px 10px;font-family:inherit;font-size:13px;min-width:160px}
.ou-tbl{overflow:auto}.ou-tbl table{width:100%;border-collapse:collapse;font-size:12px}.ou-tbl th{text-align:right;color:#64748b;font-weight:700;padding:6px 8px;border-bottom:1px solid #e2e8f0}.ou-tbl td{padding:7px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}.ou-st{font-weight:800}
.ou-err{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:10px;padding:10px 12px;font-size:13px}.ou-msg{background:#ecfeff;color:#155e75;border:1px solid #a5f3fc;border-radius:10px;padding:10px 12px;font-size:13px}
.ou-foot{margin:6px 0 0;color:#94a3b8;font-size:12px;text-align:center}
`;
