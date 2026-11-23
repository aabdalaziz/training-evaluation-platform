'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// إدارة أَثَر — مرصد القدرة البشرية «غرفة التحرير» (P18): معاينة اللقطة · كتم يدوي · افتتاحية · قائمة فحص الخصوصية · «اعتماد ونشر» موقَّع · سجل الأعداد · المساهمون
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { WEATHER_LABEL, CONF_LABEL } from '../../../lib/portal/observatory';
import type { Snapshot } from '../../../lib/portal/observatory';
import { domainLabel } from '../../../lib/portal/skills';

import { RoomHead } from '../../components/RoomKit'; /* هـ-3 ح «عدّة الغرفة» */
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
type Check = { key: string; ok: boolean; ar: string };
type IssueRow = { id: string; quarter: string; status: 'draft' | 'published'; editorial_ar: string; suppressed: string[]; vc_code: string | null; published_at: string | null; created_at: string; data?: Snapshot };
type Admin = { snapshot: Snapshot; stored: boolean; computed_at: string; quarter: string; draft: IssueRow | null; issues: IssueRow[]; checks: Check[]; contributors: { id: string; name_ar: string; sector: string }[]; signing: boolean };
const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function AdminObservatoryPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [tok, setTok] = useState(''); const [a, setA] = useState<Admin | null>(null);
  const [quarter, setQuarter] = useState(''); const [editorial, setEditorial] = useState(''); const [supp, setSupp] = useState<string[]>([]); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState(''); const [pub, setPub] = useState<any>(null);
  const fresh = useCallback(async () => { const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || tok; if (tk !== tok) setTok(tk); return tk; }, [db, tok]);
  const hdr = useCallback(async () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${await fresh()}` }), [fresh]);
  const load = useCallback(async () => { const j = await fetch('/api/observatory?view=admin', { headers: await hdr(), cache: 'no-store' }).then(r => r.json()).catch(() => null); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setError(''); setA(j); setQuarter(q => q || j.quarter); if (j.draft) { setEditorial(j.draft.editorial_ar || ''); setSupp(j.draft.suppressed || []); } }, [hdr]);
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/observatory'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
    const { data: s } = await db.auth.getSession(); setTok(s.session?.access_token || ''); await load(); setReady(true);
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function post(body: any) { if (busy) return null; setBusy(body.action); setMsg(''); const j = await fetch('/api/observatory', { method: 'POST', headers: await hdr(), body: JSON.stringify(body) }).then(r => r.json()).catch(() => null); setBusy(''); if (!j?.success) { setMsg(j?.error || 'تعذّر التنفيذ'); return null; } return j; }
  async function refresh() { const j = await post({ action: 'refresh' }); if (j) { setMsg(`حُسبت لقطة جديدة: ${j.result.published} قطاع منشور · ${j.result.suppressed} مكتوم · ${j.result.changes} تغيّر مؤشر · ${j.result.notified} إبلاغ`); await load(); } }
  async function draft() { const j = await post({ action: 'draft', quarter, editorial_ar: editorial, suppressed: supp }); if (j) { setMsg(`حُفظت مسودة العدد ${quarter}.`); await load(); } }
  async function publish() { if (!curDraft) { setMsg('احفظ المسودة أولًا.'); return; } if (!confirm(`اعتماد ونشر العدد ${quarter}؟ سيُجمَّد ويُوقَّع ${a?.signing ? 'بمفتاح أَثَر' : '— بلا توقيع (المفتاح غير مضبوط)'} ولا يُعدَّل بعدها إلا بعدد تصحيحي.`)) return; const j = await post({ action: 'publish', quarter }); if (j) { setPub(j); setMsg(j.warning || `نُشر العدد ${quarter}${j.signed ? ' موقَّعًا' : ''}.`); await load(); } }
  const toggleSupp = (code: string) => setSupp(s => s.includes(code) ? s.filter(x => x !== code) : [...s, code]);

  if (!ready) return <div className="ob rm-page"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="ob-wrap"><div className="rm-card">{error ? <span className="ob-err">{error}</span> : 'جارٍ التحقق من الصلاحية…'}</div></div></div>;
  const s = a?.snapshot; const draftPublished = a?.issues.find(i => i.quarter === quarter && i.status === 'published'); const curDraft = a?.issues.find(i => i.quarter === quarter && i.status === 'draft') || null;
  return (
    <div className="ob rm-page"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ob-wrap">
        <RoomHead
        title={<>مؤشرات القطاعات — غرفة التحرير</>}
        desc={<><p>اللقطة تُحسب يوميًا داخل السلسلة الحالية بلا أسماء. هنا تُراجع، تُكتم ما يلزم يدويًا، تكتب الافتتاحية، ثم «تعتمد وتنشر» عددًا ربعيًا مجمَّدًا وموقَّعًا. الذكاء يحسب — والإنسان يعتمد.</p></>}
        actions={<>
<a className="rm-btn ghost" href="/observatory" target="_blank" rel="noreferrer">المرصد العام ↗</a><button className="rm-btn" onClick={refresh} disabled={!!busy} data-testid="obs-preview">{busy === 'refresh' ? '…' : 'حدّث اللقطة الآن'}</button>
        </>}
      />
        <PortalAdminTabs />
        {error && <div className="ob-err">{error}</div>}{msg && <div className="ob-msg" data-testid="obs-msg">{msg}</div>}
        {pub && <div className="rm-card ob-pub" data-testid="obs-published"><h3><Icon name="shield" size={16} /> نُشر العدد {pub.quarter}</h3><p>{pub.signed ? <>موقَّع · الرمز <code>{pub.code}</code> · <a href={pub.verify_url} target="_blank" rel="noreferrer">تحقّق مستقل</a></> : 'بلا توقيع'} · <a href={pub.public_url} target="_blank" rel="noreferrer">الصفحة العامة</a></p></div>}

        {s && <section className="rm-card" data-testid="obs-snapshot">
          <h3><Icon name="chart" size={16} /> معاينة اللقطة <small>{a?.stored ? `محفوظة ${fmt(a.computed_at)}` : 'محسوبة الآن (لم تُحفظ لقطة يومية بعد)'}</small></h3>
          <div className="ob-tot"><span>أشخاص <b>{s.totals.people}</b></span><span>جهات <b>{s.totals.orgs}</b></span><span>أدلة <b>{s.totals.evidence}</b></span><span>منشور <b>{s.totals.sectors_published}</b></span><span>مكتوم آليًا <b>{s.totals.sectors_suppressed}</b></span></div>
          <table className="rm-table"><thead><tr><th>القطاع</th><th>مؤشر الأداء</th><th>Δ</th><th>المؤشر</th><th>المستوى</th><th>الثقة</th><th>أشخاص</th><th>جهات</th><th>إشارات</th><th>فجوة الادعاء</th><th>كتم يدوي</th></tr></thead><tbody>
            {s.sectors.map(x => <tr key={x.code} className={x.cell ? '' : 'mute'} data-testid={`obs-row-${x.code}`}><td><b>{x.name_ar}</b><br /><small>{x.code}</small></td><td style={{ color: WEATHER_LABEL[x.weather].color }}>{WEATHER_LABEL[x.weather].icon} {WEATHER_LABEL[x.weather].ar}</td><td>{x.delta || '—'}</td><td>{x.cell ? <b>{x.cell.index}</b> : '—'}</td><td>{x.cell?.level ?? '—'}</td><td>{x.cell ? CONF_LABEL[x.cell.confidence].ar : '—'}</td><td>{x.cell?.people ?? '—'}</td><td>{x.cell?.orgs ?? '—'}</td>
              <td className="ob-sig">{x.rising.map(g => <span key={g.skill_id} className="up">↗ {g.name_ar} +{g.delta}</span>)}{x.cooling.map(g => <span key={g.skill_id} className="down">↘ {g.name_ar} {g.delta}</span>)}{!x.rising.length && !x.cooling.length && '—'}</td>
              <td>{x.gap ? `${x.gap.claimed} ⇄ ${x.gap.actual} (${x.gap.gap > 0 ? '+' : ''}${x.gap.gap})` : '—'}</td>
              <td>{x.cell ? <label className="ob-chk"><input type="checkbox" checked={supp.includes(x.code)} onChange={() => toggleSupp(x.code)} disabled={!!draftPublished} data-testid={`obs-suppress-${x.code}`} /> اكتم</label> : <small>{x.suppressed[0]}</small>}</td></tr>)}
          </tbody></table>
          {s.domains.some(d => d.cell) && <p className="ob-doms">المجالات: {s.domains.filter(d => d.cell).map(d => `${WEATHER_LABEL[d.weather].icon} ${domainLabel(d.domain, 'ar')} ${d.cell!.index}`).join(' · ')}</p>}
          {s.suppressed_log.length > 0 && <details><summary>سجل الكتم الآلي ({s.suppressed_log.length})</summary><ul>{s.suppressed_log.map((l, i) => <li key={i}>{l.scope} — {l.reason_ar}</li>)}</ul></details>}
        </section>}

        <div className="ob-grid">
          <section className="rm-card" data-testid="obs-editorial">
            <h3><Icon name="flag" size={16} /> العدد الربعي {draftPublished && <small className="ob-badge">منشور — التصحيح بعدد جديد</small>}</h3>
            <label className="ob-lbl">رمز الربع <input value={quarter} onChange={e => setQuarter(e.target.value)} placeholder="2026-Q4" data-testid="obs-quarter" /></label>
            <label className="ob-lbl">الافتتاحية التحريرية (تظهر في العدد وتُحفظ داخل الوثيقة الموقَّعة)<textarea rows={6} value={editorial} onChange={e => setEditorial(e.target.value)} placeholder="ما الذي يقوله هذا الربع عن القدرة البشرية في المملكة؟ أين تصعد؟ أين تتراجع؟ وماذا نوصي به؟" data-testid="obs-editorial-text" disabled={!!draftPublished} /></label>
            <p className="ob-hint">كتم يدوي: {supp.length ? supp.join(' · ') : 'لا شيء'} — يُختار من جدول اللقطة أعلاه.</p>
            <div className="ob-actions"><button className="rm-btn ghost" onClick={draft} disabled={!!busy || !!draftPublished} data-testid="obs-draft">{busy === 'draft' ? '…' : 'احفظ المسودة'}</button><button className="rm-btn" onClick={publish} disabled={!!busy || !curDraft || !!draftPublished} data-testid="obs-publish">{busy === 'publish' ? '…' : 'اعتماد ونشر'}</button></div>
            {!a?.signing && <p className="ob-hint warn">مفتاح التوقيع VC_SIGNING_KEY غير مضبوط — سيُنشر العدد بلا توقيع. اضبطه من «الشهادات → المفتاح والتوقيع».</p>}
          </section>
          <section className="rm-card" data-testid="obs-checks">
            <h3><Icon name="shield" size={16} /> قائمة فحص الخصوصية</h3>
            <ul className="ob-checks">{(a?.checks || []).map(c => <li key={c.key} className={c.ok ? 'ok' : 'bad'}>{c.ok ? '✓' : '✗'} {c.ar}</li>)}</ul>
            <p className="ob-hint">القواعد ثابتة في الشيفرة (k ≥ 5 أشخاص، ≥ 2 جهة، تقريب 5، شرائح فقط) وتُثبتها اختبارات وحدة — النشر يُرفض آليًا إن سقط أي بند.</p>
          </section>
        </div>

        <div className="ob-grid">
          <section className="rm-card" data-testid="obs-issues"><h3><Icon name="folder" size={16} /> الأعداد</h3>
            {a?.issues.length ? <table className="rm-table"><thead><tr><th>الربع</th><th>الحالة</th><th>النشر</th><th>التوقيع</th><th></th></tr></thead><tbody>{a.issues.map(i => <tr key={i.id}><td><b>{i.quarter}</b></td><td>{i.status === 'published' ? 'منشور' : 'مسودة'}</td><td>{fmt(i.published_at)}</td><td>{i.vc_code ? <a href={`/verify/vc?code=${encodeURIComponent(i.vc_code)}`} target="_blank" rel="noreferrer">{i.vc_code}</a> : '—'}</td><td>{i.status === 'published' && <a href={`/observatory?issue=${encodeURIComponent(i.quarter)}`} target="_blank" rel="noreferrer">عرض</a>}</td></tr>)}</tbody></table> : <p className="ob-hint">لا أعداد بعد — احفظ مسودة ثم اعتمدها.</p>}
          </section>
          <section className="rm-card" data-testid="obs-contributors"><h3><Icon name="users" size={16} /> مساهمون في المرصد (بإذنهم)</h3>
            {a?.contributors.length ? <ul>{a.contributors.map(c => <li key={c.id}>{c.name_ar} <small>{c.sector}</small></li>)}</ul> : <p className="ob-hint">لم تختر أي جهة الظهور بالاسم بعد — الخيار في بوابة الجهة → المرصد.</p>}
          </section>
        </div>
        <p className="ob-foot">© 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — مرصد أَثَر للقدرة البشرية · البيانات المفتوحة CC BY 4.0</p>
      </div>
    </div>
  );
}

const CSS = `
.ob{font-family:inherit}
.ob-wrap{max-width:1180px;margin:0 auto;display:grid;gap:12px}
.ob-actions{display:flex;gap:8px;flex-wrap:wrap}.rm-card h3 small{font-weight:400;color:#8E7F8A;font-size:12px}
.ob-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}
.ob-tot{display:flex;gap:10px;flex-wrap:wrap;font-size:13px}.ob-tot span{background:#F6EBE0;border-radius:999px;padding:4px 10px}.ob-tot b{margin-inline-start:4px;color:#3A1F36}.rm-table tr.mute td{color:#B3A5AE}
.ob-sig{display:flex;flex-direction:column;gap:2px}.ob-sig .up{color:#D4614A}.ob-sig .down{color:#8A5A1E}
.ob-chk{display:inline-flex;align-items:center;gap:4px;font-size:12px;cursor:pointer}
.ob-lbl{display:grid;gap:4px;font-size:13px;color:#4A3645}.ob-lbl input,.ob-lbl textarea{border:1px solid #D9CBC2;border-radius:10px;padding:8px 10px;font-family:inherit;font-size:14px}
.ob-hint{margin:0;color:#8E7F8A;font-size:12px}.ob-hint.warn{color:#8A5A1E}.ob-badge{background:#F1D9A8;color:#8A5A1E;border-radius:999px;padding:2px 8px}
.ob-checks{list-style:none;margin:0;padding:0;font-size:13px;line-height:1.9}.ob-checks .ok{color:#D4614A}.ob-checks .bad{color:#D4614A;font-weight:700}
.ob-msg{background:#E6F3F1;border:1px solid #BFE1DC;color:#2F6B66;border-radius:10px;padding:8px 12px;font-size:13px}.ob-err{background:#FBEDE7;border:1px solid #F3C4B6;color:#9A3A2A;border-radius:10px;padding:8px 12px;font-size:13px}
.ob-pub{border-color:#D4614A;background:#FBEDE7}.ob-pub code{background:#fff;padding:2px 6px;border-radius:6px}
.ob-doms{margin:0;font-size:13px;color:#4A3645}.rm-card details{font-size:12px;color:#8E7F8A}.rm-card ul{margin:0;padding-inline-start:18px;font-size:13px;line-height:1.9}
.ob-foot{text-align:center;color:#B3A5AE;font-size:12px;margin:8px 0 0}
`;
