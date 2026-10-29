'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /admin/vault — «غرفة الطلبات» (P22 خزنة أَثَر): طلبات الأشخاص بعدّاد 30 يومًا · دفتر الحوادث بعدّاد 72 ساعة ومسودة بلاغ سدايا
 *  · حجر النسيان · سياسات الاحتفاظ (معاينة/تشغيل) · سجل أنشطة المعالجة RoPA (تصدير CSV) · المعالجون.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
type Dsr = { id: number; created_at: string; email: string; full_name: string | null; kind: string; status: string; due_at: string; extension_reason: string | null; details: any; result: any };
type Inc = { id: number; created_at: string; discovered_at: string; deadline_at: string; reported_at: string | null; sdaia_ref: string | null; status: string; severity: string; summary: string; tables: string[]; affected_count: number | null; actions: string | null; hours_left: number; draft: string; affected_notified_at: string | null };
type Q = { id: number; created_at: string; email: string; execute_after: string; cancelled_at: string | null; executed_at: string | null; receipt: any };
type Data = { requests: Dsr[]; summary: { open: number; due_soon: number; overdue: number; done_30d: number }; incidents: Inc[]; queue: Q[]; retention_preview: { table: string; action: string; days: number; rows: number | null }[]; retention_log: any[]; critical_events: { id: number; at: string; kind: string; severity: string; actor: string | null }[]; org: { contact: string }; notice: { version: string; draft: boolean }; registry: { tables: number; processors: number } };
const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const KIND_AR: Record<string, string> = { access: 'اطّلاع/نسخة', correction: 'تصحيح', erasure: 'نسيان', objection: 'اعتراض', portability: 'نقل' };
const STATUS_AR: Record<string, string> = { open: 'مفتوح', extended: 'مُمدَّد', done: 'نُفِّذ', rejected: 'مرفوض', cancelled: 'ملغى', reported: 'أُبلغت الهيئة', closed: 'مغلقة', dismissed: 'ليست حادثة' };
const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 864e5);

export default function AdminVaultPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [tok, setTok] = useState(''); const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<'requests' | 'incidents' | 'queue' | 'retention' | 'ropa'>('requests'); const [busy, setBusy] = useState(''); const [flash, setFlash] = useState('');
  const [incForm, setIncForm] = useState({ summary: '', tables: '', affected_count: '', severity: 'high', security_event_id: '' }); const [showInc, setShowInc] = useState(false); const [eraseEmail, setEraseEmail] = useState('');
  const fresh = useCallback(async () => { const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || tok; if (tk !== tok) setTok(tk); return tk; }, [db, tok]);
  async function load(tk: string) { const j = await fetch('/api/vault/admin', { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setData(j); }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/vault'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
      const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function post(body: any) { setBusy(body.action + (body.id || '')); const j = await fetch('/api/vault/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await fresh()}` }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null); setBusy(''); if (!j?.success) { setError(j?.error || 'تعذّر'); return null; } setError(''); setFlash('تم'); setTimeout(() => setFlash(''), 2000); await load(await fresh()); return j; }
  const copy = (v: string) => navigator.clipboard?.writeText(v);

  if (!ready) return <div className="vt"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="vt-wrap"><div className="vt-card">{error ? <span className="vt-err">{error}</span> : 'جارٍ فتح غرفة الطلبات…'}</div></div></div>;
  const s = data?.summary || { open: 0, due_soon: 0, overdue: 0, done_30d: 0 }; const openInc = (data?.incidents || []).filter(i => i.status === 'open'); const pendingQ = (data?.queue || []).filter(q => !q.executed_at && !q.cancelled_at);
  const openReqs = (data?.requests || []).filter(r => r.status === 'open' || r.status === 'extended'); const closedReqs = (data?.requests || []).filter(r => !(r.status === 'open' || r.status === 'extended'));
  return (
    <div className="vt"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="vt-wrap">
        <header className="vt-head"><div><span className="vt-kicker"><Icon name="shield" size={14} /> بوابة أَثَر · P22</span><h1>خزنة أَثَر — غرفة الطلبات</h1><p>الامتثال لنظام حماية البيانات الشخصية كعملية حيّة لا كملف: طلبات الأشخاص بعدّادها النظامي (30 يومًا)، الحوادث بعدّاد 72 ساعة ومسودة بلاغ سدايا جاهزة، حجر النسيان، سياسات الاحتفاظ، وسجل أنشطة المعالجة المُولَّد من الكود. الصفحة العامة: <a href="/privacy" target="_blank" rel="noreferrer">/privacy</a></p></div></header>
        <PortalAdminTabs counts={{ '/admin/vault': s.overdue + openInc.length }} />
        {error && <div className="vt-err">{error}</div>}{flash && <div className="vt-ok">{flash}</div>}
        <div className="vt-kpis" data-testid="vault-admin-kpis">
          <span className={s.overdue ? 'bad' : 'good'}><b>{s.overdue}</b> طلب متأخر</span><span className={s.due_soon ? 'warn' : ''}><b>{s.due_soon}</b> يستحق خلال 5 أيام</span><span><b>{s.open}</b> مفتوح · <b>{s.done_30d}</b> نُفِّذ (30 يومًا)</span>
          <span className={openInc.length ? 'bad' : 'good'}><b>{openInc.length}</b> حادثة مفتوحة</span><span><b>{pendingQ.length}</b> في حجر النسيان</span><span><b>{data?.registry.tables}</b> نوع بيانات مسجَّل · إشعار v{data?.notice.version}{data?.notice.draft ? ' (مسودة)' : ''}</span>
          {!data?.org.contact && <span className="warn">اضبط <code>DATA_PROTECTION_CONTACT</code> في Vercel ليظهر في الإشعار</span>}
        </div>
        <div className="vt-tabs">
          <button className={tab === 'requests' ? 'on' : ''} onClick={() => setTab('requests')}>الطلبات {openReqs.length ? <i>{openReqs.length}</i> : null}</button>
          <button className={tab === 'incidents' ? 'on' : ''} onClick={() => setTab('incidents')}>الحوادث (72 س) {openInc.length ? <i>{openInc.length}</i> : null}</button>
          <button className={tab === 'queue' ? 'on' : ''} onClick={() => setTab('queue')}>حجر النسيان {pendingQ.length ? <i>{pendingQ.length}</i> : null}</button>
          <button className={tab === 'retention' ? 'on' : ''} onClick={() => setTab('retention')}>الاحتفاظ</button>
          <button className={tab === 'ropa' ? 'on' : ''} onClick={() => setTab('ropa')}>سجل المعالجة RoPA</button>
        </div>

        {tab === 'requests' && (
          <section className="vt-card" data-testid="vault-requests">
            <h2>طلبات مفتوحة <small>كل طلب له مهلة 30 يومًا؛ التمديد مرة واحدة بسبب يُبلَّغ به الشخص</small></h2>
            {!openReqs.length && <p className="vt-muted">لا طلبات مفتوحة.</p>}
            <table className="vt-table"><thead><tr><th>#</th><th>الشخص</th><th>النوع</th><th>التفاصيل</th><th>المهلة</th><th>إجراء</th></tr></thead><tbody>
              {openReqs.map(r => { const d = daysLeft(r.due_at); return (
                <tr key={r.id} className={d < 0 ? 'late' : d <= 5 ? 'soon' : ''} data-testid="dsr-row"><td>{r.id}</td><td><b>{r.full_name || '—'}</b><br /><small dir="ltr">{r.email}</small></td><td>{KIND_AR[r.kind] || r.kind}<br /><small>{STATUS_AR[r.status]}</small></td>
                  <td className="vt-details">{r.kind === 'correction' ? <>الحقل <b>{r.details?.field}</b>: «{r.details?.current || '—'}» ← «{r.details?.requested}»{r.details?.reason ? <><br /><small>{r.details.reason}</small></> : null}</> : r.kind === 'objection' ? r.details?.text : JSON.stringify(r.details || {}).slice(0, 160)}</td>
                  <td><b>{d < 0 ? `متأخر ${-d} يوم` : `${d} يوم`}</b><br /><small>{fmt(r.due_at)}</small>{r.extension_reason && <><br /><small>مُدِّد: {r.extension_reason}</small></>}</td>
                  <td className="vt-acts">
                    <button className="vt-btn" disabled={!!busy} onClick={() => { const note = prompt('ما الذي نُفِّذ؟ (يُرسل للشخص)') || ''; post({ action: 'dsr_close', id: r.id, status: 'done', result: { note } }); }} data-testid="dsr-done">نُفِّذ</button>
                    {r.status === 'open' && <button className="vt-btn light" disabled={!!busy} onClick={() => { const reason = prompt('سبب التمديد 30 يومًا (يُبلَّغ به الشخص):'); if (reason) post({ action: 'dsr_extend', id: r.id, reason }); }}>مدِّد</button>}
                    <button className="vt-btn ghost" disabled={!!busy} onClick={() => { const reason = prompt('سبب الرفض (يُبلَّغ به الشخص):'); if (reason) post({ action: 'dsr_close', id: r.id, status: 'rejected', result: { reason } }); }}>ارفض بسبب</button>
                  </td></tr>); })}
            </tbody></table>
            <details className="vt-old"><summary>المغلقة ({closedReqs.length})</summary><table className="vt-table small"><tbody>{closedReqs.slice(0, 100).map(r => <tr key={r.id}><td>{r.id}</td><td dir="ltr">{r.email}</td><td>{KIND_AR[r.kind] || r.kind}</td><td>{STATUS_AR[r.status]}</td><td>{fmt(r.created_at)}</td><td className="vt-details">{r.result ? JSON.stringify(r.result).slice(0, 120) : ''}</td></tr>)}</tbody></table></details>
            <div className="vt-box"><b>نسيان لحساب بطلب وصل بقناة أخرى (أو حساب طاقم)</b><div className="vt-inline"><input value={eraseEmail} onChange={e => setEraseEmail(e.target.value)} placeholder="email@example.com" dir="ltr" /><button className="vt-btn ghost" disabled={!eraseEmail || !!busy} onClick={() => { if (confirm(`بدء حجر النسيان 7 أيام لـ ${eraseEmail}؟ سيصله رابط تراجع.`)) post({ action: 'erasure_for', email: eraseEmail }).then(j => j && setEraseEmail('')); }}>ابدأ الحجر</button></div></div>
          </section>
        )}

        {tab === 'incidents' && (
          <section className="vt-card" data-testid="vault-incidents">
            <h2>دفتر الحوادث <small>المادة 24: إبلاغ سدايا خلال 72 ساعة من العلم، وإبلاغ المتأثرين دون تأخير</small></h2>
            <div className="vt-inline"><button className="vt-btn" onClick={() => setShowInc(!showInc)} data-testid="incident-new">+ افتح حادثة</button>{(data?.critical_events || []).length > 0 && <small className="vt-muted">أحداث حرجة من الدرع (آخر 10): {(data?.critical_events || []).map(e => <button key={e.id} className="vt-chip" onClick={() => { setShowInc(true); setIncForm({ ...incForm, security_event_id: String(e.id), summary: `حدث درع #${e.id} (${e.kind}) — ` }); }}>#{e.id} {e.kind}</button>)}</small>}</div>
            {showInc && <div className="vt-box vt-form"><label>وصف موجز<textarea rows={2} value={incForm.summary} onChange={e => setIncForm({ ...incForm, summary: e.target.value })} placeholder="ماذا حدث؟ متى عُلم؟ كيف اكتُشف؟" /></label><div className="vt-grid"><label>الجداول المتأثرة (بفاصلة)<input value={incForm.tables} onChange={e => setIncForm({ ...incForm, tables: e.target.value })} placeholder="portal_enrollments, portal_profiles" dir="ltr" /></label><label>عدد المتأثرين (تقديري)<input value={incForm.affected_count} onChange={e => setIncForm({ ...incForm, affected_count: e.target.value })} dir="ltr" /></label><label>الخطورة<select value={incForm.severity} onChange={e => setIncForm({ ...incForm, severity: e.target.value })}><option value="low">منخفضة</option><option value="medium">متوسطة</option><option value="high">عالية</option><option value="critical">حرجة</option></select></label><label>حدث درع مرتبط (#)<input value={incForm.security_event_id} onChange={e => setIncForm({ ...incForm, security_event_id: e.target.value })} dir="ltr" /></label></div><button className="vt-btn" disabled={incForm.summary.trim().length < 10 || !!busy} onClick={async () => { const j = await post({ action: 'incident_open', summary: incForm.summary, tables: incForm.tables.split(/[,\s]+/).filter(Boolean), affected_count: incForm.affected_count ? Number(incForm.affected_count) : null, severity: incForm.severity, security_event_id: incForm.security_event_id ? Number(incForm.security_event_id) : null }); if (j) { setShowInc(false); setIncForm({ summary: '', tables: '', affected_count: '', severity: 'high', security_event_id: '' }); } }} data-testid="incident-submit">افتح وابدأ العدّاد</button></div>}
            {!(data?.incidents || []).length && <p className="vt-muted">لا حوادث مسجَّلة — وهذا ما نريده. حين يرصد الدرع حدثًا حرجًا يمسّ بيانات، افتح حادثة هنا بضغطة.</p>}
            {(data?.incidents || []).map(i => (
              <article key={i.id} className={`vt-inc ${i.status} ${i.status === 'open' && i.hours_left < 24 ? 'urgent' : ''}`} data-testid="incident-row">
                <div className="vt-inchead"><b>#{i.id} · {i.summary.slice(0, 120)}</b><span className={`vt-sev ${i.severity}`}>{i.severity}</span><span className="vt-status">{STATUS_AR[i.status] || i.status}</span></div>
                <div className="vt-incmeta"><span>عُلم {fmt(i.discovered_at)}</span><span>المهلة {fmt(i.deadline_at)}</span>{i.status === 'open' && <span className={i.hours_left < 24 ? 'red' : ''}><b>{i.hours_left < 0 ? `تجاوزت المهلة بـ ${Math.round(-i.hours_left)} س` : `${Math.round(i.hours_left)} ساعة متبقية`}</b></span>}{i.reported_at && <span>أُبلغت {fmt(i.reported_at)} · مرجع {i.sdaia_ref}</span>}{i.affected_notified_at && <span>أُبلغ المتأثرون {fmt(i.affected_notified_at)}</span>}{i.tables?.length ? <span dir="ltr">{i.tables.join(', ')}</span> : null}{i.affected_count != null && <span>{i.affected_count} متأثر</span>}</div>
                <div className="vt-acts">
                  <button className="vt-btn light" onClick={() => copy(i.draft)}>انسخ مسودة بلاغ سدايا</button><a className="vt-btn ghost" href="https://sdaia.gov.sa" target="_blank" rel="noreferrer">منصة الهيئة ↗</a>
                  {i.status === 'open' && <button className="vt-btn" disabled={!!busy} onClick={() => { const ref = prompt('رقم/مرجع البلاغ لدى الهيئة:'); if (ref !== null) post({ action: 'incident_report', id: i.id, sdaia_ref: ref }); }} data-testid="incident-reported">سجّل الإبلاغ</button>}
                  {(i.status === 'open' || i.status === 'reported') && <button className="vt-btn ghost" disabled={!!busy} onClick={() => { const emails = prompt('بريد المتأثرين (بفاصلة) — يُرسل إشعار نظامي بنصّ جاهز:'); if (emails) post({ action: 'incident_notify', id: i.id, emails: emails.split(/[,;\s]+/).filter(Boolean) }); }}>أبلغ المتأثرين</button>}
                  {(i.status === 'open' || i.status === 'reported') && <button className="vt-btn ghost" disabled={!!busy} onClick={() => { const actions = prompt('ما الإجراءات التي اتُّخذت؟ (يُحفظ في الدفتر)'); if (actions !== null) post({ action: 'incident_close', id: i.id, status: 'closed', actions }); }}>أغلق</button>}
                  {i.status === 'open' && <button className="vt-btn ghost" disabled={!!busy} onClick={() => { if (confirm('ليست حادثة بيانات شخصية؟')) post({ action: 'incident_close', id: i.id, status: 'dismissed', actions: 'تبيّن أنها ليست حادثة بيانات شخصية' }); }}>ليست حادثة</button>}
                </div>
                <details className="vt-draft"><summary>مسودة البلاغ</summary><pre dir="rtl">{i.draft}</pre></details>
              </article>
            ))}
          </section>
        )}

        {tab === 'queue' && (
          <section className="vt-card" data-testid="vault-queue">
            <h2>حجر النسيان <small>7 أيام برابط تراجع ثم تنفيذ آلي ضمن الكرون اليومي؛ التنفيذ المبكر بطلب صريح من الشخص فقط</small></h2>
            {!(data?.queue || []).length && <p className="vt-muted">لا طلبات نسيان.</p>}
            <table className="vt-table"><thead><tr><th>#</th><th>البريد</th><th>طُلب</th><th>ينفَّذ بعد</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>
              {(data?.queue || []).map(q => <tr key={q.id} data-testid="queue-row"><td>{q.id}</td><td dir="ltr">{q.email}</td><td>{fmt(q.created_at)}</td><td>{fmt(q.execute_after)}</td><td>{q.executed_at ? <>نُفِّذ {fmt(q.executed_at)}<br /><small dir="ltr">{q.receipt?.hash}</small></> : q.cancelled_at ? `تراجع ${fmt(q.cancelled_at)}` : <b>في الحجر</b>}</td><td>{!q.executed_at && !q.cancelled_at && <button className="vt-btn ghost" disabled={!!busy} onClick={() => { if (confirm('تنفيذ النسيان الآن قبل انتهاء الحجر؟ لا رجعة. يُسجَّل باسمك.')) post({ action: 'erasure_execute_now', id: q.id }); }} data-testid="queue-execute">نفِّذ الآن</button>}</td></tr>)}
            </tbody></table>
          </section>
        )}

        {tab === 'retention' && (
          <section className="vt-card" data-testid="vault-retention">
            <h2>سياسات الاحتفاظ <small>من السجل: ما تجاوز مدته يُحذف أو يُجهَّل تلقائيًا كل يوم — هنا معاينة بالعدّ وتشغيل يدوي</small></h2>
            <div className="vt-inline"><button className="vt-btn light" disabled={!!busy} onClick={() => post({ action: 'retention_run', dry: true })}>أعد المعاينة</button><button className="vt-btn" disabled={!!busy} onClick={() => { if (confirm('تنفيذ سياسات الاحتفاظ الآن على كل الجداول المستحقة؟')) post({ action: 'retention_run', dry: false }); }} data-testid="retention-run">نفِّذ الآن</button></div>
            <table className="vt-table"><thead><tr><th>الجدول</th><th>السياسة</th><th>المدة</th><th>صفوف مستحقة الآن</th></tr></thead><tbody>{(data?.retention_preview || []).map(r => <tr key={r.table}><td dir="ltr">{r.table}</td><td>{r.action === 'delete' ? 'حذف' : 'تجهيل'}</td><td>{r.days >= 365 ? `${Math.round(r.days / 365)} سنة` : `${r.days} يوم`}</td><td><b>{r.rows === null ? '— (نفّذ SQL 761)' : r.rows}</b></td></tr>)}</tbody></table>
            <details className="vt-old"><summary>سجل التنفيذ ({(data?.retention_log || []).length})</summary><table className="vt-table small"><tbody>{(data?.retention_log || []).map((l: any) => <tr key={l.id}><td>{fmt(l.at)}</td><td dir="ltr">{l.table_name}</td><td>{l.action}</td><td>{l.rows}</td><td>{l.policy}</td></tr>)}</tbody></table></details>
          </section>
        )}

        {tab === 'ropa' && (
          <section className="vt-card" data-testid="vault-ropa">
            <h2>سجل أنشطة المعالجة (RoPA) <small>يُولَّد من سجل الكود نفسه — اختبار الوحدة يرفض أي جدول بيانات شخصية غير مسجَّل</small></h2>
            <div className="vt-inline"><button className="vt-btn" onClick={async () => { const r = await fetch('/api/vault/admin?view=ropa&format=csv', { headers: { Authorization: `Bearer ${await fresh()}` } }); const b = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'athar-ropa.csv'; a.click(); }} data-testid="ropa-csv"><Icon name="download" size={14} /> تصدير CSV للهيئة</button><a className="vt-btn light" href="/privacy" target="_blank" rel="noreferrer">الإشعار العام</a><a className="vt-btn ghost" href="/.well-known/privacy.json" target="_blank" rel="noreferrer" dir="ltr">privacy.json</a></div>
            <RopaTable tok={tok} />
            <div className="vt-box"><b>ما يحتاج يدًا بشرية (لا يصل إليه الكود)</b><ol className="vt-steps"><li>تسجيل جهة التحكم على المنصة الوطنية لحوكمة البيانات (سدايا) وتحديث بيانات الاتصال.</li><li>مراجعة نظامية لإشعار الخصوصية ثم تحويل <code>NOTICE_DRAFT</code> إلى <code>false</code> في <code>lib/vault/registry.ts</code>.</li><li>ضبط <code>DATA_PROTECTION_CONTACT</code> في Vercel (بريد جهة الاتصال لحماية البيانات).</li><li>اتفاقيات معالجة البيانات مع المعالجين (Supabase · Vercel · مزوّد الذكاء الاصطناعي · Resend · Moyasar) وتقييم النقل خارج المملكة.</li><li>تعيين مسؤول حماية بيانات إن توسّعت المعالجة إلى بيانات حساسة على نطاق واسع.</li></ol></div>
          </section>
        )}
      </div>
    </div>
  );
}

function RopaTable({ tok }: { tok: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { fetch('/api/vault/admin?view=ropa', { headers: { Authorization: `Bearer ${tok}` }, cache: 'no-store' }).then(r => r.json()).then(j => setRows(j?.rows || [])).catch(() => setRows([])); }, [tok]);
  if (!rows) return <p className="vt-muted">…</p>;
  return <div className="vt-scroll"><table className="vt-table small"><thead><tr><th>النشاط</th><th>الغرض</th><th>البيانات</th><th>الأساس</th><th>الاحتفاظ</th><th>عند النسيان</th><th>المتلقون</th><th>المعالجون</th></tr></thead><tbody>{rows.map(r => <tr key={r.table}><td><b>{r.activity}</b><br /><small dir="ltr">{r.table}</small></td><td>{r.purpose}</td><td>{r.data}</td><td>{r.basis}</td><td>{r.retention}</td><td>{r.on_erasure}</td><td>{r.recipients}</td><td>{r.processors}</td></tr>)}</tbody></table></div>;
}

const CSS = `
.vt{min-height:100vh;background:#f4f6fa;font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f2a4e;direction:rtl}.vt-wrap{max-width:1200px;margin:0 auto;padding:18px 16px 60px;display:grid;gap:12px}
.vt-head h1{margin:4px 0;font-size:26px}.vt-head p{margin:0;color:#475569;font-size:14px;line-height:1.8;max-width:900px}.vt-kicker{display:inline-flex;align-items:center;gap:6px;background:#0f2a4e;color:#c9a24b;border-radius:999px;padding:3px 12px;font-size:12px;font-weight:900}
.vt-card{background:#fff;border:1px solid #e5e9f0;border-radius:16px;padding:16px 18px}.vt-card h2{font-size:17px;margin:0 0 8px}.vt-card h2 small{display:block;color:#64748b;font-weight:400;font-size:12.5px;margin-top:2px}
.vt-kpis{display:flex;gap:8px;flex-wrap:wrap}.vt-kpis span{background:#fff;border:1px solid #e5e9f0;border-radius:12px;padding:8px 12px;font-size:13px;color:#334155}.vt-kpis b{color:#0f2a4e;font-size:16px}.vt-kpis .bad{border-color:#fecaca;background:#fff5f5}.vt-kpis .good{border-color:#bbf7d0;background:#f0fdf4}.vt-kpis .warn{border-color:#fde68a;background:#fffbeb}.vt-kpis code{font-size:11px}
.vt-tabs{display:flex;gap:6px;flex-wrap:wrap}.vt-tabs button{border:1px solid #e5e9f0;background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;color:#334155;cursor:pointer}.vt-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.vt-tabs i{font-style:normal;background:#c9a24b;color:#0f2a4e;border-radius:999px;padding:0 7px;font-size:11px;margin-inline-start:4px;font-weight:900}
.vt-muted{color:#64748b;font-size:13px;line-height:1.7;margin:4px 0}.vt-err{color:#b91c1c;background:#fff5f5;border:1px solid #fecaca;border-radius:10px;padding:8px 12px;font-size:13px}.vt-ok{color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:6px 12px;font-size:13px}
.vt-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}.vt-table th{text-align:start;color:#64748b;font-weight:700;font-size:12px;padding:6px 8px;border-bottom:1px solid #e5e9f0}.vt-table td{padding:7px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}.vt-table.small td,.vt-table.small th{padding:4px 8px;font-size:12px}.vt-table tr.late td{background:#fff5f5}.vt-table tr.soon td{background:#fffbeb}.vt-details{max-width:320px;word-break:break-word;color:#475569;font-size:12.5px}
.vt-btn{border:1px solid #0b8a83;background:#0b8a83;color:#fff;border-radius:10px;padding:6px 12px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:4px}.vt-btn.light{background:#fff;color:#0b8a83}.vt-btn.ghost{background:#fff;color:#475569;border-color:#cbd5e1}.vt-btn:disabled{opacity:.5;cursor:default}.vt-acts{display:flex;gap:6px;flex-wrap:wrap}
.vt-inline{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0}.vt-inline input{border:1px solid #cbd5e1;border-radius:10px;padding:7px 10px;font:inherit;font-size:13px;min-width:240px}.vt-chip{border:1px solid #fecaca;background:#fff5f5;color:#b91c1c;border-radius:999px;padding:2px 8px;font:inherit;font-size:11px;cursor:pointer;margin-inline-start:4px}
.vt-box{margin-top:12px;border:1px solid #e5e9f0;border-radius:12px;padding:12px;background:#fafbfd;font-size:13px}.vt-box b{display:block;margin-bottom:6px}.vt-form label{display:grid;gap:4px;font-size:12px;color:#475569;font-weight:800;margin:4px 0}.vt-form input,.vt-form textarea,.vt-form select{border:1px solid #cbd5e1;border-radius:10px;padding:7px 10px;font:inherit;font-size:13px;width:100%;box-sizing:border-box}.vt-grid{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.vt-inc{border:1px solid #e5e9f0;border-radius:12px;padding:10px 12px;margin-top:8px;background:#fff}.vt-inc.open{border-color:#fde68a;background:#fffdf5}.vt-inc.urgent{border-color:#fecaca;background:#fff5f5}.vt-inc.closed,.vt-inc.dismissed{opacity:.7}.vt-inchead{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:14px}.vt-sev{border-radius:999px;padding:1px 8px;font-size:11px;background:#eef2f7}.vt-sev.critical,.vt-sev.high{background:#fee2e2;color:#991b1b}.vt-status{color:#64748b;font-size:12px}.vt-incmeta{display:flex;gap:10px;flex-wrap:wrap;color:#64748b;font-size:12px;margin:6px 0}.vt-incmeta .red{color:#b91c1c}.vt-draft{margin-top:6px;font-size:12px}.vt-draft pre{white-space:pre-wrap;background:#f6f8fb;border-radius:10px;padding:10px;font-family:inherit;line-height:1.8;color:#334155}
.vt-old{margin-top:10px;font-size:13px;color:#475569}.vt-scroll{overflow:auto}.vt-steps{margin:4px 0;padding-inline-start:20px;line-height:1.9;color:#334155}.vt-steps code{background:#eef2f7;border-radius:6px;padding:1px 6px;font-size:12px}
`;
