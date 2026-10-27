'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — الصفحة الحية لعقد الأثر (P12-ب): الجهة ترى حالة عقدها لحظيًا — ثلاث دفعات مرتبطة بالنتيجة (60/25/15)، عدّادات الأدلة،
// نافذة أثر 90 يومًا، «ما الذي يُحرّك الدفعة التالية»، ومذكرات الإفراج. بلا تسجيل دخول برابط خاص؛ أعداد لا أسماء.

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { fmtDate, t } from '../../../lib/portal/content';
import { MILESTONE_LABEL, MILESTONE_DESC, MS_STATUS_LABEL, HEALTH_LABEL, STATUS_LABEL, money, pctOf, SUSTAIN_AFTER_DAYS } from '../../../lib/portal/contracts';
import type { ContractState, MilestoneState, ContractStatus, Split, Targets } from '../../../lib/portal/contracts';

export default function ContractPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }
type PubContract = { id: string; title_ar: string; organization_id: string; program_id?: string | null; cohort_size: number; total_amount: number; currency: string; split: Split; targets: Targets; status: ContractStatus; start_at?: string | null; delivered_at?: string | null; org_name?: string; program_name?: string; created_at: string; contact_name?: string | null };
type View = { ok: boolean; contract?: PubContract; state?: ContractState; releases?: { milestone: string; pct: number; amount: number; memo_no: string; released_at: string; note?: string | null }[]; story?: { ar: string[]; en: string[] }; org?: { name_ar: string; name_en?: string; sector?: string; city?: string } | null; program?: { name_ar: string; name_en?: string; hours?: number } | null; generated_at?: string };

const MS_COLOR: Record<string, string> = { locked: '#94a3b8', progress: '#0b8a83', due: '#c9a24b', released: '#16a34a' };

function Ring({ value, color, size = 118, label, sub }: { value: number; color: string; size?: number; label: string; sub: string }) {
  const r = (size - 14) / 2; const circ = 2 * Math.PI * r; const v = Math.max(0, Math.min(100, value));
  return <div className="ic-ring" style={{ width: size, height: size }}><svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(15,42,78,.1)" strokeWidth="10" /><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(v / 100) * circ} ${circ}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray .9s ease' }} /></svg><div className="ic-ring-txt"><b>{label}</b><small>{sub}</small></div></div>;
}

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const params = useParams<{ token: string }>(); const token = String(params?.token || '');
  const [v, setV] = useState<View | null>(null); const [tick, setTick] = useState(0);
  useEffect(() => { let alive = true; (async () => { try { const j = await fetch(`/api/contract?token=${encodeURIComponent(token)}`, { cache: 'no-store' }).then(x => x.json()); if (alive) setV(j.success ? j : { ok: false }); } catch { if (alive) setV({ ok: false }); } })(); return () => { alive = false; }; }, [token, tick]);
  useEffect(() => { const id = setInterval(() => setTick(x => x + 1), 60000); return () => clearInterval(id); }, []);
  const c = v?.contract; const s = v?.state; const L = (x: { ar: string; en: string }) => t(x, lang);
  const paidPct = c && c.total_amount ? Math.round(((s?.paid || 0) / c.total_amount) * 100) : 0; const duePct = c && c.total_amount ? Math.round(((s?.due || 0) / c.total_amount) * 100) : 0;

  return (
    <main className="pt-main ic">
      <section className="pt-pagehead ic-head"><div className="pt-wrap">
        <div className="pt-crumbs"><Link href="/">{ar ? 'الرئيسية' : 'Home'}</Link> / <span>{ar ? 'عقد أثر حي' : 'Live impact contract'}</span></div>
        {c ? <>
          <div className="ic-org"><span className="ic-badge" style={{ '--c': STATUS_LABEL[c.status].color } as any}>{L(STATUS_LABEL[c.status])}</span>{c.org_name && <span className="ic-orgname"><Icon name="school" size={14} /> {c.org_name}</span>}{s && <span className="ic-health" data-h={s.health}><Icon name={s.health === 'due' ? 'bell' : s.health === 'attention' ? 'alert' : 'check'} size={13} /> {L(HEALTH_LABEL[s.health])}</span>}</div>
          <h1>{c.title_ar}</h1>
          <p className="pt-lead">{ar ? `عقد أثر بقيمة ${money(c.total_amount, c.currency, 'ar')} — تُدفع ثمن النتيجة لا المقعد: ${c.split.delivery}% عند التسليم، ${c.split.evidence}% عند أدلة الأثر المؤكَّدة من مشرفيكم، ${c.split.impact}% عند أثر ${c.targets.impact_days} يومًا. هذه الصفحة تُحدَّث من الأدلة نفسها، لا من تقارير لاحقة.` : `An outcome contract worth ${money(c.total_amount, c.currency, 'en')} — paid for results, not seats: ${c.split.delivery}% on delivery, ${c.split.evidence}% on supervisor-confirmed evidence, ${c.split.impact}% on ${c.targets.impact_days}-day impact. This page is computed from the evidence itself.`}</p>
          <div className="pt-chips ic-meta">{c.program_name && <span className="pt-chip"><Icon name="book" size={13} /> {c.program_name}</span>}<span className="pt-chip"><Icon name="users" size={13} /> {ar ? `${c.cohort_size} منسوبًا` : `${c.cohort_size} people`}</span>{c.start_at && <span className="pt-chip"><Icon name="calendar" size={13} /> {ar ? 'بدأ' : 'Started'} {fmtDate(c.start_at, lang)}</span>}{v?.generated_at && <span className="pt-chip ic-live"><i /> {ar ? 'حي · يتجدد كل دقيقة' : 'Live · refreshes every minute'}</span>}</div>
        </> : <h1>{ar ? 'عقد أثر' : 'Impact contract'}</h1>}
      </div></section>

      <section className="pt-sec"><div className="pt-wrap" style={{ maxWidth: 1040 }}>
        {!v && <div className="pt-empty">…</div>}
        {v && !v.ok && <div className="pt-box pt-empty"><Icon name="alert" size={30} /><h3>{ar ? 'الرابط غير صالح أو العقد لم يُفعَّل بعد' : 'Invalid link or contract not active yet'}</h3><p className="pt-muted">{ar ? 'اطلب الرابط الحي من فريق أَثَر.' : 'Ask the Athar team for the live link.'}</p></div>}
        {c && s && <>
          {/* شريط المال */}
          <div className="pt-box ic-money">
            <div className="ic-bar" role="img" aria-label="paid / due / remaining"><i className="paid" style={{ width: `${paidPct}%` }} /><i className="due" style={{ width: `${duePct}%` }} /></div>
            <div className="ic-money-k"><div><b>{money(s.paid, c.currency, lang)}</b><small>{ar ? 'أُفرج عنه' : 'Released'}</small></div><div className="due"><b>{money(s.due, c.currency, lang)}</b><small>{ar ? 'مستحق الآن' : 'Due now'}</small></div><div><b>{money(s.remaining, c.currency, lang)}</b><small>{ar ? 'مرتبط بالأثر القادم' : 'Tied to upcoming impact'}</small></div><div className="tot"><b>{money(c.total_amount, c.currency, lang)}</b><small>{ar ? 'قيمة العقد' : 'Contract value'}</small></div></div>
          </div>

          {/* الدفعات الثلاث */}
          <div className="ic-ms">
            {s.milestones.map((m: MilestoneState) => <article key={m.key} className="pt-box ic-m" data-st={m.status}>
              <Ring value={m.progress} color={MS_COLOR[m.status]} label={`${m.pct}%`} sub={money(m.payable, c.currency, lang)} />
              <div className="ic-m-body">
                <div className="ic-m-top"><h3>{L(MILESTONE_LABEL[m.key])}</h3><span className="ic-st" style={{ '--c': MS_COLOR[m.status] } as any}>{L(MS_STATUS_LABEL[m.status])}</span></div>
                <p className="ic-metric">{L(m.metric)}</p>
                <p className="pt-muted">{L(m.detail)}{m.prorata && <> · <b>{ar ? 'تناسبية' : 'pro-rata'}</b></>}</p>
                {m.release && <p className="ic-rel"><Icon name="doc" size={13} /> {m.release.memo_no} · {fmtDate(m.release.released_at, lang)}</p>}
                <details className="ic-how"><summary>{ar ? 'كيف تُحتسب؟' : 'How is it computed?'}</summary><p>{L(MILESTONE_DESC[m.key])}</p></details>
              </div>
            </article>)}
          </div>

          <div className="ic-grid">
            {/* عدّادات الأثر */}
            <div className="pt-box">
              <h3><Icon name="trend" size={18} /> {ar ? 'نبض الأثر' : 'Impact pulse'}</h3>
              <div className="ic-counters">
                <div><b>{s.cohort}</b><small>{ar ? 'الشريحة' : 'Cohort'}</small></div>
                <div><b>{s.completers}</b><small>{ar ? 'أتمّوا' : 'Completed'}</small><i style={{ width: `${pctOf(s.completers, s.cohort)}%` }} /></div>
                <div><b>{s.submitted}</b><small>{ar ? 'أرسلوا دليلًا' : 'Submitted'}</small><i style={{ width: `${pctOf(s.submitted, s.cohort)}%` }} /></div>
                <div className="gold"><b>{s.evidenced}</b><small>{ar ? 'أكّد مشرفوهم' : 'Confirmed'}</small><i style={{ width: `${pctOf(s.evidenced, s.cohort)}%` }} /></div>
                <div className="teal"><b>{s.sustained}</b><small>{ar ? `أثر مستدام (+${SUSTAIN_AFTER_DAYS} يومًا)` : `Sustained (+${SUSTAIN_AFTER_DAYS}d)`}</small><i style={{ width: `${pctOf(s.sustained, s.cohort)}%` }} /></div>
              </div>
              <ul className="ic-story">{((lang === 'en' ? v.story?.en : v.story?.ar) || []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
            </div>
            {/* النافذة + ما الذي يحرك الدفعة التالية */}
            <div className="pt-box ic-next">
              <h3><Icon name="clock" size={18} /> {ar ? 'نافذة أثر 90 يومًا' : '90-day impact window'}</h3>
              {!c.delivered_at && <p className="pt-muted">{ar ? 'تُفتح النافذة عند إثبات التسليم.' : 'Opens when delivery is confirmed.'}</p>}
              {c.delivered_at && <div className="ic-window"><div className="ic-wl"><span>{fmtDate(c.delivered_at, lang)}</span><span>{s.window.opens ? fmtDate(s.window.opens, lang) : ''}</span><span>{s.window.closes ? fmtDate(s.window.closes, lang) : ''}</span></div><div className="ic-wbar"><i style={{ width: `${s.window.closed ? 100 : Math.min(100, Math.max(0, 100 - ((s.window.days_left || 0) / c.targets.impact_days) * 100))}%` }} /><em style={{ left: `${(SUSTAIN_AFTER_DAYS / c.targets.impact_days) * 100}%` }} /></div><div className="ic-wl small"><span>{ar ? 'التسليم' : 'Delivery'}</span><span>{ar ? 'بداية احتساب الأثر المستدام' : 'Sustained impact counts from here'}</span><span>{s.window.closed ? (ar ? 'أُغلقت' : 'Closed') : (ar ? `تبقّى ${s.window.days_left} يومًا` : `${s.window.days_left} days left`)}</span></div></div>}
              <h3 style={{ marginTop: 16 }}><Icon name="compass" size={18} /> {ar ? 'ما الذي يُحرّك الدفعة التالية؟' : 'What moves the next payment?'}</h3>
              {s.next.length === 0 && <p className="pt-muted">{ar ? 'لا إجراءات معلّقة.' : 'Nothing pending.'}</p>}
              <ol className="ic-nextlist">{s.next.map((n, i) => <li key={i}>{L(n)}</li>)}</ol>
              {v.releases && v.releases.length > 0 && <><h3 style={{ marginTop: 16 }}><Icon name="doc" size={18} /> {ar ? 'مذكرات الإفراج' : 'Release memos'}</h3><table className="ic-rels"><tbody>{v.releases.map(r => <tr key={r.memo_no}><td><b>{r.memo_no}</b></td><td>{L(MILESTONE_LABEL[r.milestone as keyof typeof MILESTONE_LABEL])}</td><td>{money(r.amount, c.currency, lang)}</td><td>{fmtDate(r.released_at, lang)}</td></tr>)}</tbody></table></>}
              <div className="pt-chips" style={{ marginTop: 14 }}><button type="button" className="pt-btn light small" onClick={() => window.print()}><Icon name="print" size={14} /> {ar ? 'طباعة الحالة' : 'Print'}</button><button type="button" className="pt-btn ghost small" onClick={() => setTick(x => x + 1)}><Icon name="refresh" size={14} /> {ar ? 'تحديث الآن' : 'Refresh'}</button></div>
            </div>
          </div>
          <p className="pt-muted ic-foot">{ar ? 'الخصوصية: تعرض هذه الصفحة أعدادًا ونسبًا فقط؛ أسماء المنسوبين وأدلتهم تبقى في ملفاتهم المهارية الخاصة. الأرقام مشتقة مباشرة من شهادات الإتمام، ومهمات قلب العمل المؤكَّدة من المشرفين، وأدلة الملف المهاري المؤرَّخة — ولا يُفرَج عن أي دفعة إلا بقرار بشري موثَّق بمذكرة مرقّمة.' : 'Privacy: counts and rates only; names and evidence stay in private skill profiles. Figures derive from completion credentials, supervisor-confirmed workplace missions and dated profile evidence — every release is a documented human decision.'}</p>
        </>}
      </div></section>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

const CSS = `
.ic-head{background:linear-gradient(135deg,#0f2a4e 0%,#123a63 55%,#0b8a83 140%)}
.ic-org{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;font-size:13px}.ic-badge{background:rgba(255,255,255,.12);box-shadow:inset 0 0 0 2px var(--c);border-radius:999px;padding:4px 12px;font-weight:800}.ic-orgname{opacity:.9;display:inline-flex;gap:6px;align-items:center}
.ic-health{display:inline-flex;gap:6px;align-items:center;border-radius:999px;padding:4px 12px;font-weight:700;background:rgba(255,255,255,.14)}.ic-health[data-h=due]{background:#c9a24b;color:#0f2a4e}.ic-health[data-h=attention]{background:#f59e0b;color:#0f2a4e}
.ic-meta{margin-top:12px}.ic-live i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 0 rgba(34,197,94,.6);animation:icp 1.8s infinite;margin-inline-end:6px}@keyframes icp{0%{box-shadow:0 0 0 0 rgba(34,197,94,.6)}70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
.ic-money{margin-bottom:16px}.ic-bar{height:14px;border-radius:999px;background:#e2e8f0;overflow:hidden;display:flex}.ic-bar i{display:block;height:100%}.ic-bar .paid{background:#16a34a}.ic-bar .due{background:#c9a24b}
.ic-money-k{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}.ic-money-k div{border-inline-start:3px solid #16a34a;padding-inline-start:10px}.ic-money-k div.due{border-color:#c9a24b}.ic-money-k div:nth-child(3){border-color:#94a3b8}.ic-money-k div.tot{border-color:#0f2a4e}.ic-money-k b{display:block;font-size:20px;color:#0f2a4e}.ic-money-k small{color:#64748b;font-size:12px}
.ic-ms{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px}.ic-m{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;border-top:4px solid #94a3b8}.ic-m[data-st=progress]{border-top-color:#0b8a83}.ic-m[data-st=due]{border-top-color:#c9a24b;box-shadow:0 10px 30px rgba(201,162,75,.25)}.ic-m[data-st=released]{border-top-color:#16a34a}
.ic-ring{position:relative;display:grid;place-items:center}.ic-ring svg{position:absolute;inset:0}.ic-ring-txt{position:relative;text-align:center}.ic-ring-txt b{display:block;font-size:24px;color:#0f2a4e}.ic-ring-txt small{color:#475569;font-size:11.5px;font-weight:700}
.ic-m-body{width:100%}.ic-m-top{display:flex;justify-content:space-between;align-items:center;gap:8px}.ic-m-top h3{margin:0;font-size:16px}.ic-st{font-size:11.5px;font-weight:800;color:var(--c);border:1.5px solid var(--c);border-radius:999px;padding:3px 10px;white-space:nowrap}
.ic-metric{margin:8px 0 2px;font-weight:700;color:#0f2a4e;font-size:13.5px}.ic-rel{margin:6px 0 0;font-size:12.5px;color:#16a34a;font-weight:700;display:flex;gap:6px;align-items:center;justify-content:center}
.ic-how{margin-top:8px;font-size:12.5px;text-align:start}.ic-how summary{cursor:pointer;color:#0b8a83;font-weight:700}.ic-how p{margin:6px 0 0;color:#475569}
.ic-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}
.ic-counters{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0 12px}.ic-counters div{position:relative;background:#f8fafc;border-radius:12px;padding:10px 8px 14px;text-align:center;overflow:hidden}.ic-counters b{display:block;font-size:24px;color:#0f2a4e}.ic-counters small{display:block;color:#64748b;font-size:11px;line-height:1.3}.ic-counters i{position:absolute;left:0;bottom:0;height:4px;background:#0f2a4e;transition:width .9s}.ic-counters .gold i{background:#c9a24b}.ic-counters .teal i{background:#0b8a83}
.ic-story{margin:0;padding-inline-start:18px;color:#334155;font-size:13.5px;line-height:1.8}
.ic-window{margin-top:6px}.ic-wl{display:flex;justify-content:space-between;font-size:12px;color:#475569;font-weight:700}.ic-wl.small{font-weight:500;font-size:11px}.ic-wbar{position:relative;height:12px;border-radius:999px;background:#e2e8f0;margin:6px 0;overflow:visible}.ic-wbar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#0b8a83,#c9a24b)}.ic-wbar em{position:absolute;top:-4px;width:2px;height:20px;background:#0f2a4e}
.ic-nextlist{margin:6px 0 0;padding-inline-start:20px;font-size:13.5px;line-height:1.8;color:#0f2a4e}.ic-nextlist li::marker{color:#c9a24b;font-weight:800}
.ic-rels{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:6px}.ic-rels td{padding:6px 4px;border-bottom:1px solid #eef2f7}
.ic-foot{margin-top:16px;font-size:12px;line-height:1.7}
@media (max-width:900px){.ic-ms{grid-template-columns:1fr}.ic-grid{grid-template-columns:1fr}.ic-money-k{grid-template-columns:repeat(2,1fr)}.ic-counters{grid-template-columns:repeat(3,1fr)}}
@media print{.pt-footer,.pt-nav,.ic-next .pt-chips{display:none!important}.ic-m{break-inside:avoid}}
`;
