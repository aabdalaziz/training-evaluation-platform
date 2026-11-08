'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /admin/shield — درع أَثَر (P21): غرفة عمليات الأمن للطاقم
 *  التمرين الذاتي (17 اختبارًا حيًا — 14 من P21 + 3 من P65) · الأحداث (حرج/تحذير/معلومة) مع «عولج» · المفاتيح وخطة التدوير بلا انقطاع · RLS · حدود المعدل · قائمة «تحتاج يدًا بشرية».
 *  القاعدة: ما يمكن للآلة فحصه تفحصه كل يوم وتُظهره هنا؛ وما يحتاج قرارًا بشريًا يُعرض كخطوات واضحة.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'QUALITY_ANALYST'];
/* P65 الطبقة الثانية: CSP (خلاصة + حكم الإلزام) · الوصول الإداري (مَن فتح ماذا) · الجهات (التجميد · التصدير ATH-EX · المحو ATH-ER) · شهادة الدرع ATH-SH */
type CspRow = { directive: string; blocked: string; count: number; last_at: string; documents: string[] };
type OrgRow = { id: string; name_ar: string; city?: string | null; frozen_at: string | null; frozen_reason: string | null; erase_at: string | null; erase_reason: string | null; members: number };
type FootRow = { table: string; rows: number; label_ar: string; effect_ar: string };
type Check = { id: string; title_ar: string; ok: boolean; detail: string };
type Ev = { id: number; at: string; severity: 'info' | 'warn' | 'critical'; kind: string; actor: string | null; ip: string | null; meta: any; notified_at: string | null; handled_at: string | null };
type Data = { csp?: { rows: CspRow[]; verdict: { ready: boolean; reason_ar: string; total_7d: number; explained: any[] }; steps: string[] }; access?: { since: string; rows: any[]; by_path: any[]; by_user: any[]; subject_views: number; names: Record<string, string> } | null; orgs?: OrgRow[]; seals?: { month: string; code: string; issued_at: string; passed_days: number; total_days: number; checks_total: number }[]; policy?: any[] | null; summary: any; events: Ev[]; last_drill: { passed: number; total: number; ms: number; checks?: Check[] } | null; keys: any; rls: any[] | null; rls_error: string | null; manual_todo: { id: string; title: string; how: string }[]; limits: Record<string, { w: number; n: number }>; kinds: Record<string, string>; severities: Record<string, string>; site: string };

const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const win = (w: number) => w === 60 ? 'دقيقة' : w === 3600 ? 'ساعة' : w === 86400 ? 'يوم' : `${w} ث`;

export default function AdminShieldPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [tok, setTok] = useState(''); const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<'drill' | 'events' | 'keys' | 'rls' | 'todo' | 'csp' | 'access' | 'orgs'>('drill');
  const [foot, setFoot] = useState<{ org: OrgRow; rows: FootRow[]; summary_ar: string } | null>(null); const [reason, setReason] = useState(''); const [flash, setFlash] = useState(''); const [busy, setBusy] = useState(''); const [drill, setDrill] = useState<{ passed: number; total: number; ms: number; checks: Check[] } | null>(null);
  const [gen, setGen] = useState<{ key: string; steps: string[] } | null>(null); const [sev, setSev] = useState<'all' | 'critical' | 'warn' | 'info'>('all'); const [onlyOpen, setOnlyOpen] = useState(false);
  const fresh = useCallback(async () => { const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || tok; if (tk !== tok) setTok(tk); return tk; }, [db, tok]);
  async function load(tk: string) { const j = await fetch('/api/shield', { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setData(j); if (j.last_drill?.checks) setDrill(j.last_drill); }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/shield'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
      const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function post(body: any) { return fetch('/api/shield', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await fresh()}` }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null); }
  async function runDrill() { setBusy('drill'); setError(''); const j = await post({ action: 'drill' }); if (!j?.success) setError(j?.error || 'تعذّر التمرين'); else setDrill(j.result); await load(await fresh()); setBusy(''); }
  async function handle(id: number) { setBusy(String(id)); await post({ action: 'handle', id }); await load(await fresh()); setBusy(''); }
  async function genKey() { setBusy('gen'); const j = await post({ action: 'gen_key' }); if (j?.success) setGen({ key: j.key, steps: j.steps }); setBusy(''); }
  /* P65 */
  async function act(body: any, okMsg: string) { setBusy(body.action + (body.org_id || '')); setError(''); const j = await post(body); if (!j?.success) setError(j?.error || 'تعذّر'); else { setFlash(okMsg); setTimeout(() => setFlash(''), 4000); } await load(await fresh()); setBusy(''); return j; }
  async function footprint(org: OrgRow) { setBusy('fp' + org.id); const j = await post({ action: 'org_footprint', org_id: org.id }); if (j?.success) setFoot({ org, rows: j.rows, summary_ar: j.summary_ar }); else setError(j?.error || 'تعذّر'); setBusy(''); }
  async function exportOrg(org: OrgRow) { setBusy('ex' + org.id); const j = await post({ action: 'org_export', org_id: org.id }); if (j?.success) { const blob = new Blob([JSON.stringify(j.doc, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `athar-org-export-${j.code}.json`; a.click(); setFlash(`صدر الملف ${j.code} — موقَّع، واحتُفظ بحدث التصدير.`); setTimeout(() => setFlash(''), 6000); } else setError(j?.error || 'تعذّر'); await load(await fresh()); setBusy(''); }
  async function gc() { setBusy('gc'); const j = await post({ action: 'gc' }); if (j?.success) setError(''); await load(await fresh()); setBusy(''); }

  if (!ready) return <div className="sh"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="sh-wrap"><div className="sh-card">{error ? <span className="sh-err">{error}</span> : 'جارٍ فتح غرفة العمليات…'}</div></div></div>;
  const s = data?.summary || {}; const bySev = s.by_severity || {}; const openCrit = Number(s.open_critical || 0);
  const events = (data?.events || []).filter(e => (sev === 'all' || e.severity === sev) && (!onlyOpen || !e.handled_at));
  const drillOk = drill ? drill.passed === drill.total : null;
  return (
    <div className="sh"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sh-wrap">
        <header className="sh-head"><div><span className="sh-kicker"><Icon name="shield" size={14} /> بوابة أَثَر · P21</span><h1>درع أَثَر</h1><p>درع حيّ يختبر نفسه كل يوم: الجدار (ترويسات) · الصمّام (حدود المعدل) · الحارس (الأحداث والتنبيهات) · المفاتيح (تدوير بلا انقطاع) · الباب المعلن (security.txt) · التمرين الذاتي. الصفحة العامة: <a href="/security" target="_blank" rel="noreferrer">/security</a></p></div></header>
        <PortalAdminTabs counts={{ '/admin/shield': openCrit }} />
        {error && <div className="sh-err">{error}</div>}
        <div className="sh-kpis" data-testid="shield-kpis">
          <span className={drillOk === false ? 'bad' : drillOk ? 'good' : ''}><b>{drill ? `${drill.passed}/${drill.total}` : '—'}</b> آخر تمرين {s.drill?.at ? `· ${fmt(s.drill.at)}` : ''}</span>
          <span className={openCrit ? 'bad' : 'good'}><b>{openCrit}</b> حدث حرج بلا معالجة</span>
          <span><b>{bySev.critical || 0}</b> حرج · <b>{bySev.warn || 0}</b> تحذير · <b>{bySev.info || 0}</b> معلومة (30 يومًا)</span>
          <span><b>{data?.keys?.oauth_kid || '—'}</b> بصمة مفتاح التوقيع {data?.keys?.prev_set ? <i className="sh-tag">تدوير جارٍ</i> : null}</span>
        </div>
        <div className="sh-tabs">
          <button className={tab === 'drill' ? 'on' : ''} onClick={() => setTab('drill')}>التمرين الذاتي</button>
          <button className={tab === 'events' ? 'on' : ''} onClick={() => setTab('events')}>الأحداث {openCrit ? <i>{openCrit}</i> : null}</button>
          <button className={tab === 'keys' ? 'on' : ''} onClick={() => setTab('keys')}>المفاتيح</button>
          <button className={tab === 'rls' ? 'on' : ''} onClick={() => setTab('rls')}>RLS والحدود</button>
          <button className={tab === 'csp' ? 'on' : ''} onClick={() => setTab('csp')} data-testid="tab-csp">CSP {data?.csp && !data.csp.verdict.ready ? <i>!</i> : null}</button>
          <button className={tab === 'access' ? 'on' : ''} onClick={() => setTab('access')} data-testid="tab-access">الوصول الإداري</button>
          <button className={tab === 'orgs' ? 'on' : ''} onClick={() => setTab('orgs')} data-testid="tab-orgs">الجهات والتجميد {(data?.orgs || []).some(o => o.frozen_at) ? <i>❄</i> : null}</button>
          <button className={tab === 'todo' ? 'on' : ''} onClick={() => setTab('todo')}>تحتاج يدًا بشرية</button>
        </div>
        {flash && <div className="sh-flash" role="status" data-testid="sh-flash">{flash}</div>}

        {tab === 'drill' && (
          <section className="sh-card" data-testid="shield-drill">
            <div className="sh-row"><h2>الدرع يختبر نفسه</h2><button type="button" className="pt-btn" onClick={runDrill} disabled={busy === 'drill'} data-testid="drill-run">{busy === 'drill' ? 'جارٍ التمرين (~20 ثانية)…' : 'شنّ التمرين الآن'}</button></div>
            <p className="sh-muted">17 اختبارًا آمنًا يشنّها الخادم على نفسه (P65 أضاف: RLS على كل الجداول · لا كتابة مجهولة · مسارات البيانات الشخصية ترفض بلا دخول): الترويسات، رفض الرموز المزوّرة، PKCE/الأكواد، حدود المعدل (قصف حقيقي حتى 429)، حجم/عمق JSON، RLS على كل الجداول، security.txt، المفاتيح، خزنة البيانات (الخصوصية والمهل النظامية). يعمل تلقائيًا كل يوم ضمن الكرون الحالي ويُسجَّل حدثًا.</p>
            {!drill && <p className="sh-muted">لا تمرين بعد — اضغط «شنّ التمرين الآن».</p>}
            {drill && <ul className="sh-checks">{drill.checks.map(c => <li key={c.id} className={c.ok ? 'ok' : 'fail'} data-testid={`check-${c.id}`}><span className="sh-mark">{c.ok ? '✓' : '✗'}</span><div><b>{c.title_ar}</b><small>{c.detail}</small></div></li>)}</ul>}
            {drill && <p className="sh-muted">اكتمل في {Math.round(drill.ms / 100) / 10} ث · {drill.passed}/{drill.total}</p>}
            <h3>شهادة الدرع الشهرية (ATH-SH)</h3>
            <p className="sh-muted">كل شهر يُختم سجلّ التمرين اليومي وثيقةً موقَّعة تُعرض في <a href="/security">/security</a> ويتحقّق منها أيّ أحد في <a href="/verify/shield">/verify/shield</a>. تصدر آليًا في أول يوم بعد انتهاء الشهر؛ ويمكنك إصدار ختم جزئي للشهر الجاري الآن (يُستبدل عند اكتماله).</p>
            <div className="sh-row"><div className="sh-seals" data-testid="sh-seals">{(data?.seals || []).map(x => <a key={x.code} className="sh-seal" href={`/verify/shield?code=${x.code}`}><b>{x.month}</b><span>{x.passed_days}/{x.total_days} يومًا</span><code dir="ltr">{x.code}</code></a>)}{!(data?.seals || []).length && <span className="sh-muted">لا ختم بعد.</span>}</div>
              <button type="button" className="pt-btn ghost small" disabled={busy === 'seal_now'} onClick={() => act({ action: 'seal_now' }, 'صدر ختم جزئي للشهر الجاري.')} data-testid="seal-now">ختم الشهر الجاري الآن</button></div>
          </section>
        )}

        {tab === 'csp' && (
          <section className="sh-card" data-testid="shield-csp">
            <div className="sh-row"><h2>سياسة أمن المحتوى (CSP) — من «تقرير فقط» إلى «إلزام»</h2><button type="button" className="pt-btn ghost small" disabled={busy === 'csp_clear'} onClick={() => act({ action: 'csp_clear' }, 'عُلِّمت تقارير CSP كلّها «عولجت».')}>عولجت كلّها</button></div>
            {data?.csp && <div className={`sh-verdict ${data.csp.verdict.ready ? 'good' : 'bad'}`} data-testid="csp-verdict"><b>{data.csp.verdict.ready ? '✓ جاهز للإلزام' : '✗ ليس بعد'}</b><span>{data.csp.verdict.reason_ar}</span></div>}
            <p className="sh-muted">المتصفحات تبلّغنا بكل مصدر كانت السياسة ستمنعه لو كانت مُلزِمة. الصفوف أدناه = ما ورد خلال 7 أيام مجمَّعًا (ضوضاء الإضافات تُرشَّح عند الاستقبال).</p>
            <table className="sh-table small"><thead><tr><th>التوجيه</th><th>المصدر المحظور</th><th>العدد</th><th>الصفحات</th><th>آخر مرّة</th></tr></thead><tbody>
              {(data?.csp?.rows || []).map((r, i) => <tr key={i}><td dir="ltr">{r.directive}</td><td dir="ltr">{r.blocked || '(داخلي)'}</td><td>{r.count}</td><td dir="ltr">{r.documents.join(' ')}</td><td>{fmt(r.last_at)}</td></tr>)}
              {!(data?.csp?.rows || []).length && <tr><td colSpan={5} className="sh-muted">لا تقارير خلال 7 أيام.</td></tr>}
            </tbody></table>
            <h3>خطوات التحويل (يدوية — Commit واحد)</h3>
            <ol className="sh-steps">{(data?.csp?.steps || []).map((x, i) => <li key={i}>{x}</li>)}</ol>
          </section>
        )}

        {tab === 'access' && (
          <section className="sh-card" data-testid="shield-access">
            <div className="sh-row"><h2>الوصول الإداري — مَن فتح بيانات مَن؟ (7 أيام)</h2><a className="pt-btn ghost small" href="#" onClick={async (e) => { e.preventDefault(); const tk = await fresh(); const r = await fetch('/api/shield?format=csv', { headers: { Authorization: `Bearer ${tk}` } }); const b = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'athar-admin-access.csv'; a.click(); }}>تصدير CSV</a></div>
            <p className="sh-muted">صفّ واحد لكل (عضو طاقم × صفحة تحمل بيانات شخصية × يوم) — خفيف، يُكنس بعد 180 يومًا. المتدرّب يرى في «ذاكرتي» مَن فتح ملفّه بعينه (أدوار لا أسماء). الصفحات المرصودة: {(data as any)?.pii_paths?.length || 0}.</p>
            {!data?.access && <p className="sh-err">الجدول غير جاهز — نفّذ supabase/p65-shield-layer2.sql.</p>}
            {data?.access && <div className="sh-grid">
              <div className="sh-box"><b>حسب الصفحة</b><table className="sh-table small"><thead><tr><th>الصفحة</th><th>أعضاء</th><th>مرّات</th><th>آخر مرّة</th></tr></thead><tbody>{data.access.by_path.map(x => <tr key={x.path}><td>{x.title_ar} <small dir="ltr">{x.path}</small></td><td>{x.users}</td><td>{x.hits}</td><td>{fmt(x.last_at)}</td></tr>)}{!data.access.by_path.length && <tr><td colSpan={4} className="sh-muted">لا وصول مسجَّلًا بعد.</td></tr>}</tbody></table></div>
              <div className="sh-box"><b>حسب العضو</b><table className="sh-table small"><thead><tr><th>العضو</th><th>الدور</th><th>صفحات</th><th>مرّات</th><th>ملفّات أشخاص</th></tr></thead><tbody>{data.access.by_user.map(x => <tr key={x.user_id}><td>{data.access!.names[x.user_id] || x.user_id.slice(0, 8)}</td><td>{x.role}</td><td>{x.paths}</td><td>{x.hits}</td><td>{x.subjects}</td></tr>)}{!data.access.by_user.length && <tr><td colSpan={5} className="sh-muted">—</td></tr>}</tbody></table></div>
            </div>}
          </section>
        )}

        {tab === 'orgs' && (
          <section className="sh-card" data-testid="shield-orgs">
            <h2>الجهات — زرّ التجميد · التصدير · المحو</h2>
            <p className="sh-muted"><b>التجميد</b>: جهة واحدة تصير «قراءة فقط» أثناء حادثة (منسوبوها يقرؤون ولا يكتبون، برسالة إنسانية) ويُسجَّل حدثًا حرجًا. <b>التصدير</b>: ملف JSON موقَّع (ATH-EX) يضمّ كل ما يرتبط بالجهة في القاعدة. <b>المحو</b>: مهلة 7 أيام مرئية يمكن التراجع فيها، ثم يُنفَّذ بقواعد المخطط نفسها ويصدر إيصال ATH-ER يُتحقّق منه في <a href="/verify/erasure">/verify/erasure</a>.</p>
            <div className="sh-row"><label className="sh-muted">السبب (يُسجَّل مع التجميد/المحو): <input value={reason} onChange={e => setReason(e.target.value)} placeholder="مثال: بلاغ تسريب رقم 12" style={{ border: '1px solid #e5e9f0', borderRadius: 8, padding: '5px 8px', font: 'inherit', fontSize: 13, minWidth: 260 }} data-testid="org-reason" /></label></div>
            <table className="sh-table small" data-testid="org-table"><thead><tr><th>الجهة</th><th>أعضاء</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>
              {(data?.orgs || []).map(o => <tr key={o.id} className={o.frozen_at ? 'sev-critical' : o.erase_at ? 'sev-warn' : ''} data-testid={`org-${o.id}`}>
                <td><b>{o.name_ar}</b>{o.city ? <small> · {o.city}</small> : null}</td><td>{o.members}</td>
                <td>{o.frozen_at ? <i className="sh-sev critical">❄ مجمَّدة منذ {fmt(o.frozen_at)}{o.frozen_reason ? ` — ${o.frozen_reason}` : ''}</i> : null}{o.erase_at ? <i className="sh-sev warn">⏳ تُمحى {fmt(o.erase_at)}{o.erase_reason ? ` — ${o.erase_reason}` : ''}</i> : null}{!o.frozen_at && !o.erase_at ? <span className="sh-muted">طبيعية</span> : null}</td>
                <td className="sh-actions">
                  {o.frozen_at ? <button type="button" className="pt-btn light small" disabled={busy === 'unfreeze' + o.id} onClick={() => act({ action: 'unfreeze', org_id: o.id }, `رُفع التجميد عن ${o.name_ar}.`)} data-testid={`unfreeze-${o.id}`}>رفع التجميد</button>
                    : <button type="button" className="pt-btn ghost small" disabled={busy === 'freeze' + o.id} onClick={() => { if (confirm(`تجميد «${o.name_ar}»؟ سيقرأ منسوبوها ولا يكتبون حتى ترفعه.`)) void act({ action: 'freeze', org_id: o.id, reason }, `جُمِّدت ${o.name_ar} — حدث حرج مسجَّل.`); }} data-testid={`freeze-${o.id}`}>❄ تجميد</button>}
                  <button type="button" className="pt-btn ghost small" disabled={busy === 'ex' + o.id} onClick={() => exportOrg(o)} data-testid={`export-${o.id}`}>صدّر (ATH-EX)</button>
                  <button type="button" className="pt-btn ghost small" disabled={busy === 'fp' + o.id} onClick={() => footprint(o)} data-testid={`footprint-${o.id}`}>البصمة</button>
                  {o.erase_at ? <button type="button" className="pt-btn light small" disabled={busy === 'org_erase_cancel' + o.id} onClick={() => act({ action: 'org_erase_cancel', org_id: o.id }, 'أُلغي طلب المحو.')} data-testid={`erase-cancel-${o.id}`}>تراجع عن المحو</button>
                    : <button type="button" className="pt-btn ghost small danger" disabled={busy === 'org_erase_request' + o.id} onClick={() => { if (confirm(`طلب محو بيانات «${o.name_ar}» بعد 7 أيام؟ يمكن التراجع خلال المهلة.`)) void act({ action: 'org_erase_request', org_id: o.id, reason }, 'سُجِّل طلب المحو — ينفَّذ بعد 7 أيام ما لم تتراجع.'); }} data-testid={`erase-${o.id}`}>امحُ بعد 7 أيام</button>}
                </td></tr>)}
              {!(data?.orgs || []).length && <tr><td colSpan={4} className="sh-muted">لا جهات مسجَّلة.</td></tr>}
            </tbody></table>
            {foot && <div className="sh-box" data-testid="org-footprint"><b>بصمة «{foot.org.name_ar}» في القاعدة</b><p>{foot.summary_ar}</p>
              <table className="sh-table small"><thead><tr><th>الجدول</th><th>صفوف</th><th>عند المحو</th></tr></thead><tbody>{foot.rows.map(r => <tr key={r.table}><td>{r.label_ar} <small dir="ltr">{r.table}</small></td><td>{r.rows}</td><td>{r.effect_ar}</td></tr>)}{!foot.rows.length && <tr><td colSpan={3} className="sh-muted">لا صفوف مرتبطة.</td></tr>}</tbody></table>
              <button type="button" className="pt-btn ghost small" onClick={() => setFoot(null)}>إغلاق</button></div>}
          </section>
        )}

        {tab === 'events' && (
          <section className="sh-card" data-testid="shield-events">
            <div className="sh-row"><h2>سجل الأحداث الأمنية</h2><div className="sh-filters">
              {(['all', 'critical', 'warn', 'info'] as const).map(k => <button key={k} type="button" className={sev === k ? 'on' : ''} onClick={() => setSev(k)}>{k === 'all' ? 'الكل' : data?.severities?.[k] || k}</button>)}
              <label><input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} /> غير المعالَج فقط</label>
              <button type="button" className="pt-btn ghost small" onClick={gc} disabled={busy === 'gc'}>تنظيف القديم</button>
            </div></div>
            <p className="sh-muted">الأحداث الحرجة (إعادة استخدام رمز تجديد/كود · بلاغ ثغرة) تُنبّه الطاقم بالبريد فور وقوعها وتُنبّه صاحب الحساب المعنيّ. عناوين IP تُعرض مُقنَّعة.</p>
            <table className="sh-table"><thead><tr><th>الوقت</th><th>الدرجة</th><th>الحدث</th><th>الفاعل</th><th>IP</th><th>تفاصيل</th><th></th></tr></thead><tbody>
              {events.map(e => <tr key={e.id} className={`sev-${e.severity}${e.handled_at ? ' done' : ''}`}><td>{fmt(e.at)}</td><td><i className={`sh-sev ${e.severity}`}>{data?.severities?.[e.severity] || e.severity}</i></td><td>{data?.kinds?.[e.kind] || e.kind}</td><td>{e.actor || '—'}</td><td dir="ltr">{e.ip || '—'}</td><td className="sh-meta">{e.kind === 'drill' ? `${e.meta?.passed}/${e.meta?.total}` : e.meta?.title || e.meta?.blocked || e.meta?.reason || (e.meta ? Object.entries(e.meta).slice(0, 3).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : String(v).slice(0, 40)}`).join(' · ') : '')}</td><td>{e.handled_at ? <small>عولج {fmt(e.handled_at)}</small> : (e.severity !== 'info' ? <button type="button" className="pt-btn light small" disabled={busy === String(e.id)} onClick={() => handle(e.id)}>عولج</button> : null)}</td></tr>)}
              {!events.length && <tr><td colSpan={7} className="sh-muted">لا أحداث — الهدوء خبر طيب.</td></tr>}
            </tbody></table>
          </section>
        )}

        {tab === 'keys' && (
          <section className="sh-card" data-testid="shield-keys">
            <h2>المفاتيح — تدوير بلا انقطاع</h2>
            <div className="sh-grid">
              <div className="sh-box"><b>مفتاح التوقيع الرئيسي (VC_SIGNING_KEY)</b><p>{data?.keys?.master_set ? <>مضبوط · بصمة <code>{data.keys.master_fingerprint}</code> · معرّف مفتاح OAuth <code>{data.keys.oauth_kid}</code></> : <span className="sh-err">غير مضبوط — يعمل مفتاح تطوير! اضبطه في Vercel فورًا.</span>}</p><p className="sh-muted">يشتقّ منه: مفتاح Ed25519 للشهادات (did.json) ومفتاح HMAC لرموز OAuth — لا يُستخدم خامًا أبدًا.</p></div>
              <div className="sh-box"><b>المفتاح السابق (TOKEN_SECRET_PREV)</b><p>{data?.keys?.prev_set ? <>مضبوط · <code>{data.keys.prev_kid}</code> — الرموز القديمة ما زالت تتحقق. احذفه بعد 30 يومًا من التدوير.</> : 'غير مضبوط (لا تدوير جارٍ).'}</p></div>
              <div className="sh-box"><b>مفاتيح الجهات (atk_)</b><p>التدوير من صفحة <a href="/admin/agents">الوكلاء المفوَّضون</a> — زر «دوِّر» بجانب كل مفتاح: مفتاح جديد بالصلاحيات نفسها، والقديم يعمل 24 ساعة ثم يُبطل آليًا.</p></div>
            </div>
            <div className="sh-row"><h3>خطة تدوير المفتاح الرئيسي</h3><button type="button" className="pt-btn" onClick={genKey} disabled={busy === 'gen'} data-testid="gen-key">توليد مفتاح جديد</button></div>
            <ol className="sh-steps">{(data?.keys?.rotation_steps || []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ol>
            {gen && <div className="sh-issued" data-testid="gen-key-out"><b>مفتاح جديد (يُعرض مرة واحدة ولا يُخزَّن هنا):</b><code dir="ltr">{gen.key}</code><button type="button" className="pt-btn ghost small" onClick={() => navigator.clipboard?.writeText(gen.key)}>نسخ</button></div>}
          </section>
        )}

        {tab === 'rls' && (
          <section className="sh-card" data-testid="shield-rls">
            <h2>أمن قاعدة البيانات (RLS)</h2>
            {data?.rls_error && <p className="sh-err">{data.rls_error}</p>}
            {data?.policy && <p className="sh-muted" data-testid="policy-summary">P65 — تقرير السياسات الحيّ: {data.policy.length} جدولًا · بلا RLS: <b>{data.policy.filter((r: any) => !r.rls_enabled).length}</b> · قراءة مفتوحة للزائر: <b>{data.policy.filter((r: any) => r.open_read).length}</b> · كتابة للزائر: <b>{data.policy.filter((r: any) => r.anon_write).length}</b></p>}
            {data?.policy && <table className="sh-table small"><thead><tr><th>الجدول</th><th>RLS</th><th>سياسات</th><th>قراءة anon</th><th>كتابة anon</th></tr></thead><tbody>
              {data.policy.filter((r: any) => !r.rls_enabled || r.anon_read || r.anon_write).map((r: any) => <tr key={r.table_name} className={!r.rls_enabled || r.anon_write ? 'sev-critical' : r.open_read ? 'sev-warn' : ''}><td dir="ltr">{r.table_name}</td><td>{r.rls_enabled ? '✓' : '✗'}</td><td>{r.policy_count}</td><td>{r.anon_read ? (r.open_read ? 'مفتوحة' : 'مقيَّدة') : '—'}</td><td>{r.anon_write ? '✗ نعم' : '—'}</td></tr>)}
            </tbody></table>}
            {data?.rls && <table className="sh-table small"><thead><tr><th>الجدول</th><th>RLS</th><th>سياسات</th></tr></thead><tbody>
              {data.rls.map((r: any) => <tr key={r.table_name} className={!r.rls_enabled ? 'sev-critical' : (Number(r.policy_count) === 0 ? 'sev-info' : '')}><td dir="ltr">{r.table_name}</td><td>{r.rls_enabled ? '✓ مفعَّل' : '✗ غير مفعَّل'}</td><td>{r.policy_count}{Number(r.policy_count) === 0 && r.rls_enabled ? <small> · خدمة فقط (service role)</small> : null}</td></tr>)}
            </tbody></table>}
            <h3>حدود المعدل (الصمّام)</h3>
            <p className="sh-muted">عدّاد مشترك في قاعدة البيانات (يصمد عبر كل نسخ الخادم) مع مسار سريع في الذاكرة. عند تعذّر القاعدة يعمل بالذاكرة تلقائيًا.</p>
            <table className="sh-table small"><thead><tr><th>المسار</th><th>الحد</th></tr></thead><tbody>
              {Object.entries(data?.limits || {}).map(([k, v]) => <tr key={k}><td dir="ltr">{k}</td><td>{v.n} / {win(v.w)}</td></tr>)}
            </tbody></table>
          </section>
        )}

        {tab === 'todo' && (
          <section className="sh-card" data-testid="shield-todo">
            <h2>تحتاج يدًا بشرية</h2>
            <p className="sh-muted">إعدادات في لوحات خارجية لا يصل إليها الكود — افعلها مرة واحدة.</p>
            <ol className="sh-steps">{(data?.manual_todo || []).map(t => <li key={t.id}><b>{t.title}</b><br /><small>{t.how}</small></li>)}</ol>
          </section>
        )}
      </div>
    </div>
  );
}

const CSS = `
.sh{padding:20px 16px 48px;background:#f6f8fb;min-height:60vh;font-family:inherit}
.sh-wrap{max-width:1100px;margin:0 auto;display:grid;gap:12px}
.sh-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.sh-head p{margin:0;color:#64748b;font-size:14px;line-height:1.7;max-width:900px}.sh-head a{color:#0b8a83}.sh-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b8a83}
.sh-card{background:#fff;border:1px solid #e5e9f0;border-radius:16px;padding:16px;box-shadow:0 4px 18px rgba(15,42,78,.05)}.sh-card h2{margin:0 0 6px;font-size:18px;color:#0f2a4e}.sh-card h3{margin:14px 0 6px;font-size:15px;color:#0f2a4e}
.sh-row{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.sh-kpis{display:flex;gap:10px;flex-wrap:wrap}.sh-kpis span{background:#fff;border:1px solid #e5e9f0;border-radius:12px;padding:8px 12px;font-size:13px;color:#334155}.sh-kpis b{color:#0f2a4e;font-size:16px}.sh-kpis .bad{border-color:#fecaca;background:#fff5f5}.sh-kpis .good{border-color:#bbf7d0;background:#f0fdf4}
.sh-tag{font-style:normal;background:#fef3c7;color:#92400e;border-radius:999px;padding:1px 8px;font-size:11px;margin-inline-start:6px}
.sh-tabs{display:flex;gap:6px;flex-wrap:wrap}.sh-tabs button{border:1px solid #e5e9f0;background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;color:#334155;cursor:pointer}.sh-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.sh-tabs i{font-style:normal;background:#c9a24b;color:#0f2a4e;border-radius:999px;padding:0 7px;font-size:11px;margin-inline-start:4px;font-weight:900}
.sh-muted{color:#64748b;font-size:13px;line-height:1.7;margin:4px 0}.sh-err{color:#b91c1c;background:#fff5f5;border:1px solid #fecaca;border-radius:10px;padding:8px 12px;font-size:13px}
.sh-checks{list-style:none;margin:10px 0;padding:0;display:grid;gap:6px;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}.sh-checks li{display:flex;gap:10px;align-items:flex-start;border:1px solid #e5e9f0;border-radius:12px;padding:10px 12px;background:#fafbfd}.sh-checks li.ok{border-color:#bbf7d0}.sh-checks li.fail{border-color:#fecaca;background:#fff5f5}.sh-checks b{display:block;font-size:13px;color:#0f2a4e}.sh-checks small{color:#64748b;font-size:12px;word-break:break-word}
.sh-mark{width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:900;flex:none;background:#dcfce7;color:#166534}.fail .sh-mark{background:#fee2e2;color:#991b1b}
.sh-filters{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:12px}.sh-filters button{border:1px solid #e5e9f0;background:#fff;border-radius:999px;padding:4px 10px;font:inherit;font-size:12px;cursor:pointer}.sh-filters button.on{background:#0b8a83;color:#fff;border-color:#0b8a83}.sh-filters label{display:inline-flex;gap:4px;align-items:center;color:#334155}
.sh-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}.sh-table th{text-align:start;color:#64748b;font-weight:700;font-size:12px;padding:6px 8px;border-bottom:1px solid #e5e9f0}.sh-table td{padding:7px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}.sh-table.small td,.sh-table.small th{padding:4px 8px}.sh-table tr.sev-critical td{background:#fff5f5}.sh-table tr.sev-warn td{background:#fffbeb}.sh-table tr.done td{opacity:.6}.sh-meta{color:#475569;font-size:12px;max-width:320px;word-break:break-word}
.sh-sev{font-style:normal;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:800}.sh-sev.critical{background:#fee2e2;color:#991b1b}.sh-sev.warn{background:#fef3c7;color:#92400e}.sh-sev.info{background:#e0f2fe;color:#075985}
.sh-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin:8px 0}.sh-box{border:1px solid #e5e9f0;border-radius:12px;padding:12px;background:#fafbfd;font-size:13px;color:#334155}.sh-box b{color:#0f2a4e;display:block;margin-bottom:4px}.sh-box p{margin:4px 0;line-height:1.7}.sh-box code{background:#eef2f7;border-radius:6px;padding:1px 6px;font-size:12px}
.sh-steps{margin:6px 0;padding-inline-start:22px;color:#334155;font-size:13px;line-height:1.8}.sh-steps small{color:#64748b}
.sh-issued{margin-top:10px;border:1px dashed #c9a24b;border-radius:12px;padding:10px 12px;background:#fffdf5;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px}.sh-issued code{background:#fff;border:1px solid #e5e9f0;border-radius:8px;padding:6px 10px;font-size:12px;word-break:break-all}
.pt-btn{border:0;background:#0f2a4e;color:#fff;border-radius:10px;padding:9px 16px;font:inherit;font-size:13px;font-weight:800;cursor:pointer}.pt-btn:disabled{opacity:.6;cursor:default}.pt-btn.light{background:#e6f4f3;color:#0b6f69}.pt-btn.ghost{background:transparent;color:#0f2a4e;border:1px solid #e5e9f0}.pt-btn.small{padding:5px 10px;font-size:12px}.pt-btn.danger{color:#b91c1c;border-color:#fecaca}
.sh-flash{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px;font-size:13px;color:#065f46}.sh-verdict{display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-radius:12px;padding:10px 12px;font-size:13px;margin:8px 0}.sh-verdict.good{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534}.sh-verdict.bad{background:#fff5f5;border:1px solid #fecaca;color:#991b1b}
.sh-seals{display:flex;gap:8px;flex-wrap:wrap}.sh-seal{display:inline-grid;gap:2px;border:1px solid #c9a24b;border-radius:12px;padding:8px 12px;background:#fffdf5;text-decoration:none;color:#0f2a4e;font-size:12px}.sh-seal code{font-size:11px}.sh-actions{display:flex;gap:4px;flex-wrap:wrap}
@media (max-width:640px){.sh-table{display:block;overflow-x:auto}}
`;
