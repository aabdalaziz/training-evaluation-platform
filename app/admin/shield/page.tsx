'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /admin/shield — درع أَثَر (P21): غرفة عمليات الأمن للطاقم
 *  التمرين الذاتي (13 اختبارًا حيًا) · الأحداث (حرج/تحذير/معلومة) مع «عولج» · المفاتيح وخطة التدوير بلا انقطاع · RLS · حدود المعدل · قائمة «تحتاج يدًا بشرية».
 *  القاعدة: ما يمكن للآلة فحصه تفحصه كل يوم وتُظهره هنا؛ وما يحتاج قرارًا بشريًا يُعرض كخطوات واضحة.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'QUALITY_ANALYST'];
type Check = { id: string; title_ar: string; ok: boolean; detail: string };
type Ev = { id: number; at: string; severity: 'info' | 'warn' | 'critical'; kind: string; actor: string | null; ip: string | null; meta: any; notified_at: string | null; handled_at: string | null };
type Data = { summary: any; events: Ev[]; last_drill: { passed: number; total: number; ms: number; checks?: Check[] } | null; keys: any; rls: any[] | null; rls_error: string | null; manual_todo: { id: string; title: string; how: string }[]; limits: Record<string, { w: number; n: number }>; kinds: Record<string, string>; severities: Record<string, string>; site: string };

const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const win = (w: number) => w === 60 ? 'دقيقة' : w === 3600 ? 'ساعة' : w === 86400 ? 'يوم' : `${w} ث`;

export default function AdminShieldPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [tok, setTok] = useState(''); const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<'drill' | 'events' | 'keys' | 'rls' | 'todo'>('drill'); const [busy, setBusy] = useState(''); const [drill, setDrill] = useState<{ passed: number; total: number; ms: number; checks: Check[] } | null>(null);
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
          <button className={tab === 'todo' ? 'on' : ''} onClick={() => setTab('todo')}>تحتاج يدًا بشرية</button>
        </div>

        {tab === 'drill' && (
          <section className="sh-card" data-testid="shield-drill">
            <div className="sh-row"><h2>الدرع يختبر نفسه</h2><button type="button" className="pt-btn" onClick={runDrill} disabled={busy === 'drill'} data-testid="drill-run">{busy === 'drill' ? 'جارٍ التمرين (~20 ثانية)…' : 'شنّ التمرين الآن'}</button></div>
            <p className="sh-muted">13 اختبارًا آمنًا يشنّها الخادم على نفسه: الترويسات، رفض الرموز المزوّرة، PKCE/الأكواد، حدود المعدل (قصف حقيقي حتى 429)، حجم/عمق JSON، RLS على كل الجداول، security.txt، المفاتيح. يعمل تلقائيًا كل يوم ضمن الكرون الحالي ويُسجَّل حدثًا.</p>
            {!drill && <p className="sh-muted">لا تمرين بعد — اضغط «شنّ التمرين الآن».</p>}
            {drill && <ul className="sh-checks">{drill.checks.map(c => <li key={c.id} className={c.ok ? 'ok' : 'fail'} data-testid={`check-${c.id}`}><span className="sh-mark">{c.ok ? '✓' : '✗'}</span><div><b>{c.title_ar}</b><small>{c.detail}</small></div></li>)}</ul>}
            {drill && <p className="sh-muted">اكتمل في {Math.round(drill.ms / 100) / 10} ث · {drill.passed}/{drill.total}</p>}
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
.pt-btn{border:0;background:#0f2a4e;color:#fff;border-radius:10px;padding:9px 16px;font:inherit;font-size:13px;font-weight:800;cursor:pointer}.pt-btn:disabled{opacity:.6;cursor:default}.pt-btn.light{background:#e6f4f3;color:#0b6f69}.pt-btn.ghost{background:transparent;color:#0f2a4e;border:1px solid #e5e9f0}.pt-btn.small{padding:5px 10px;font-size:12px}
@media (max-width:640px){.sh-table{display:block;overflow-x:auto}}
`;
