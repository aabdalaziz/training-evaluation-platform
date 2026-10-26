'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// إدارة أَثَر — توأم المؤسسة والشهادات الحية (P11): أين ستكون قدرات الجهة بعد 180 يومًا بالسياسة الحالية مقابل سياسة «محاكاة شهرية»،
// المهارات الصدئة الآن ومستقبلًا، وقائمة الجهات المشتركة في الشهادات الحية. حساب نقيّ من مستويات المهارات (P8) بمحرّك التوأم.
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { domainLabel } from '../../../lib/portal/skills';
import { orgTwin, twinSkill, fmtLevel, STATUS_LABEL } from '../../../lib/portal/twin';
import type { OrgTwinRow } from '../../../lib/portal/twin';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
type Row = { user_id: string; skill_id: string; computed_level: number; confidence: number; evidence: any[]; approved_level: number | null };

export default function AdminTwinPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [tok, setTok] = useState('');
  const [org, setOrg] = useState(''); const [data, setData] = useState<{ levels: Row[]; skills: any[]; organizations: any[]; watchers: any[]; staff: boolean } | null>(null); const [tab, setTab] = useState<'twin' | 'rusty' | 'watchers'>('twin');

  async function load(tk: string, o = org) {
    const j = await fetch(`/api/twin?admin=1${o ? `&org=${encodeURIComponent(o)}` : ''}`, { headers: { Authorization: `Bearer ${tk}` } }).then(r => r.json());
    if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setData(j); if (!o && j.org) setOrg(j.org);
  }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/twin'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
      const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skills = useMemo(() => new Map<string, any>((data?.skills || []).map((s: any) => [s.id, s])), [data]);
  const now = useMemo(() => new Date(), []);
  const twin = useMemo(() => orgTwin((data?.levels || []).filter(l => skills.has(l.skill_id)).map(l => ({ user_id: l.user_id, domain: skills.get(l.skill_id).domain, skill_id: l.skill_id, computed_level: Number(l.computed_level) || 0, approved_level: l.approved_level, confidence: Number(l.confidence) || 0, evidence: l.evidence || [] })), now), [data, skills, now]);
  const rusty = useMemo(() => (data?.levels || []).filter(l => skills.has(l.skill_id)).map(l => ({ l, t: twinSkill({ skill_id: l.skill_id, computed_level: Number(l.computed_level) || 0, approved_level: l.approved_level, confidence: Number(l.confidence) || 0, evidence: l.evidence || [] }, now) })).filter(x => x.t.last_at && (x.t.status === 'rusty' || (x.t.rust_in_days ?? 999) <= 30)).sort((a, b) => (a.t.rust_in_days ?? 0) - (b.t.rust_in_days ?? 0)).slice(0, 60), [data, skills, now]);
  const bySkill = useMemo(() => { const m = new Map<string, { n: number; rusty: number; sum: number }>(); for (const x of rusty) { const k = x.l.skill_id; if (!m.has(k)) m.set(k, { n: 0, rusty: 0, sum: 0 }); const g = m.get(k)!; g.n++; if (x.t.status === 'rusty') g.rusty++; g.sum += x.t.level_now; } return Array.from(m.entries()).sort((a, b) => b[1].n - a[1].n).slice(0, 12); }, [rusty]);
  const maxLv = 5;
  const Bar = ({ v, c }: { v: number; c: string }) => <div className="at-bar"><i style={{ width: `${(v / maxLv) * 100}%`, background: c }} /><b>{fmtLevel(v)}</b></div>;

  if (!ready) return <div className="at"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="at-wrap"><div className="at-card">{error ? <span className="at-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  return (
    <div className="at"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="at-wrap">
        <header className="at-head"><div><span className="at-kicker"><Icon name="star" size={14} /> بوابة أَثَر · P11</span><h1>توأم المؤسسة والشهادات الحية</h1><p>مجموع التوائم المهارية للأعضاء: أين ستكون القدرات بعد 180 يومًا إن لم يحدث شيء (السياسة أ) مقابل «محاكاة أداء واحدة شهريًا لكل عضو» (السياسة ب). المهارات الصدئة تُعرض لتتدخّل قبل أن تُفقد. أرقام إرشادية شفافة من أدلة P8 — بلا نموذج لغوي.</p></div></header>
        <PortalAdminTabs />
        {error && <div className="at-err">{error}</div>}
        <div className="at-bar2">
          {data?.staff && <label>الجهة <select value={org} onChange={async e => { setOrg(e.target.value); await load(tok, e.target.value); }}><option value="">كل المتعلمين</option>{(data.organizations || []).map((o: any) => <option key={o.id} value={o.id}>{o.name_ar}</option>)}</select></label>}
          <div className="at-kpis"><span><b>{twin.members}</b> عضو</span><span><b>{twin.skills}</b> مهارة بأدلة</span><span className="rusty"><b>{twin.rusty_now}</b> صدئة الآن</span><span><b>{(data?.watchers || []).filter((w: any) => !w.unsubscribed_at).length}</b> جهة مشتركة في شهادات</span></div>
          <div className="at-tabs">{([['twin', 'توأم المؤسسة'], ['rusty', `إنذار الصدأ (${rusty.length})`], ['watchers', `مشتركو الشهادات (${(data?.watchers || []).length})`]] as const).map(([k, l]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
        </div>

        {tab === 'twin' && <div className="at-card">
          {twin.domains.length === 0 && <div className="at-empty">لا مستويات مهارات بعد لهذه المجموعة.</div>}
          {twin.domains.length > 0 && <table className="at-table"><thead><tr><th>المجال</th><th>أعضاء</th><th>مهارات</th><th>المستوى الآن</th><th>+180 يومًا · السياسة أ (لا تدخّل)</th><th>+180 يومًا · السياسة ب (محاكاة شهرية)</th><th>صدئة الآن → أ → ب</th></tr></thead><tbody>
            {twin.domains.map((d: OrgTwinRow) => <tr key={d.domain}><td><b>{domainLabel(d.domain, 'ar')}</b></td><td>{d.members}</td><td>{d.skills}</td><td><Bar v={d.level_now} c="#0f2a4e" /></td><td><Bar v={d.level_180_a} c="#b45309" /></td><td><Bar v={d.level_180_b} c="#0b8a83" /><small className="at-gain">{d.level_180_b >= d.level_180_a ? `+${fmtLevel(d.level_180_b - d.level_180_a)}` : fmtLevel(d.level_180_b - d.level_180_a)} مقابل أ</small></td><td><span className="at-rust">{d.rusty_now}</span> → <span className="at-rust">{d.rusty_180_a}</span> → <span className="at-ok">{d.rusty_180_b}</span></td></tr>)}
          </tbody></table>}
          <p className="at-note">القراءة: السياسة ب تكلف ~20 دقيقة شهريًا للعضو (محاكاة بلا رسوم) وتحوّل مهارات من «صدئة» إلى «متوهّجة». استخدم الفرق بين العمودين في عرضك للجهة: الأثر المتوقّع لقرار صغير.</p>
        </div>}

        {tab === 'rusty' && <div className="at-card">
          {rusty.length === 0 && <div className="at-empty">لا مهارات مهددة بالصدأ خلال 30 يومًا. 🎉</div>}
          {bySkill.length > 0 && <div className="at-chips">{bySkill.map(([sid, g]) => <span key={sid} className="at-chip"><b>{skills.get(sid)?.name_ar || sid}</b> · {g.n} عضو · {g.rusty} صدئة</span>)}</div>}
          {rusty.length > 0 && <table className="at-table"><thead><tr><th>المهارة</th><th>العضو</th><th>المستوى</th><th>الطزاجة</th><th>الحالة</th><th>تصدأ خلال</th><th>آخر دليل</th></tr></thead><tbody>
            {rusty.map(({ l, t }, i) => <tr key={i}><td><b>{skills.get(l.skill_id)?.name_ar}</b><br /><small dir="ltr">{skills.get(l.skill_id)?.code}</small></td><td><small dir="ltr">{l.user_id.slice(0, 8)}…</small></td><td>{fmtLevel(t.level_now)}{t.approved ? ' ✓' : ''}</td><td>{t.freshness}%</td><td><span className="at-st" style={{ background: STATUS_LABEL[t.status].color }}>{STATUS_LABEL[t.status].ar}</span></td><td>{t.status === 'rusty' ? `صدئت منذ ${Math.abs(t.rust_in_days || 0)} يومًا` : `${t.rust_in_days} يومًا`}</td><td>{t.last_at ? fmt(t.last_at) : '—'}</td></tr>)}
          </tbody></table>}
          <p className="at-note">الإجراء المقترح: أرسل للأعضاء المهددين رابط محاكاة مناسبة من <a href="/admin/sim">المحاكيات</a> أو أدرج المهارة في «كل يوم مهارة». يرى كل متعلم الإنذار نفسه في صفحة «توأمي».</p>
        </div>}

        {tab === 'watchers' && <div className="at-card">
          {(data?.watchers || []).length === 0 && <div className="at-empty">لا جهات مشتركة بعد. يظهر نموذج الاشتراك على كل شهادة حية في /credential/&lt;code&gt;.</div>}
          {(data?.watchers || []).length > 0 && <table className="at-table"><thead><tr><th>البريد</th><th>الاسم / الجهة</th><th>الشهادة</th><th>صاحبها</th><th>اشترك</th><th>آخر إشعار</th><th>الحالة</th></tr></thead><tbody>
            {(data!.watchers as any[]).map(w => <tr key={w.id} className={w.unsubscribed_at ? 'off' : ''}><td dir="ltr">{w.email}</td><td>{w.name || '—'}{w.organization ? ` · ${w.organization}` : ''}</td><td><a href={`/credential/${w.credential?.verify_code}`} target="_blank" rel="noreferrer">{w.credential?.title_ar}</a><br /><small dir="ltr">{w.credential?.verify_code}</small></td><td>{w.credential?.full_name || '—'}</td><td>{fmt(w.created_at)}</td><td>{fmt(w.last_notified_at)}</td><td>{w.unsubscribed_at ? 'ألغى' : 'نشط'}</td></tr>)}
          </tbody></table>}
          <p className="at-note">الإشعارات تُرسل من الكرون اليومي الموجود (followups) عند تغيّر مستوى/حالة مهارة، بحد أقصى مرة كل 6 أيام للمشترك، وأول اشتراك يُخزَّن كلقطة أساس بلا بريد.</p>
        </div>}
      </div>
    </div>
  );
}

const CSS = `
.at{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;direction:rtl}
.at-wrap{max-width:1120px;margin:0 auto;display:grid;gap:12px}
.at-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.at-head p{margin:0;color:#64748b;font-size:14px;line-height:1.7;max-width:860px}.at-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b8a83}
.at-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;overflow-x:auto}.at-empty{color:#64748b;font-size:14px;text-align:center;padding:20px}.at-err{color:#b91c1c;font-size:13px}
.at-bar2{display:grid;gap:10px}.at-bar2 label{font-size:13px;color:#334155;display:inline-flex;gap:8px;align-items:center}.at-bar2 select{border:1px solid #cbd5e1;border-radius:10px;padding:7px 10px;font:inherit;font-size:13px;background:#fff;min-width:220px}
.at-kpis{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:#475569}.at-kpis b{font-size:20px;color:#0f2a4e;margin-inline-end:4px}.at-kpis .rusty b{color:#b45309}
.at-tabs{display:flex;gap:6px;flex-wrap:wrap}.at-tabs button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:800;color:#334155;cursor:pointer}.at-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.at-table{width:100%;border-collapse:collapse;font-size:13px}.at-table th{text-align:right;color:#64748b;font-weight:800;font-size:12px;padding:8px 10px;border-bottom:1px solid #e2e8f0;white-space:nowrap}.at-table td{padding:9px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle;color:#0f172a}.at-table tr.off{opacity:.5}.at-table small{color:#64748b}
.at-bar{position:relative;height:18px;background:#f1f5f9;border-radius:999px;min-width:120px;overflow:hidden}.at-bar i{display:block;height:100%;border-radius:999px}.at-bar b{position:absolute;inset:0;display:grid;place-content:center;font-size:11.5px;color:#0f172a;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 2px #fff}.at-gain{display:block;color:#0b8a83;font-weight:800;margin-top:2px}
.at-rust{color:#b45309;font-weight:900}.at-ok{color:#0b8a83;font-weight:900}.at-st{color:#fff;font-size:11px;font-weight:900;border-radius:999px;padding:2px 8px}
.at-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.at-chip{font-size:12px;background:#fff7ed;border:1px solid #fcd9b6;color:#9a3412;border-radius:999px;padding:4px 10px}
.at-note{margin:12px 0 0;color:#64748b;font-size:12.5px;line-height:1.8}.at-note a{color:#0f2a4e;font-weight:800}
`;
