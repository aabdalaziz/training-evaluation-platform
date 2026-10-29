'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /privacy — إشعار الخصوصية الحيّ (P22 خزنة أَثَر): لا نصّ قانوني منسوخ يتقادم — الصفحة تُولَّد من سجل المعالجة نفسه الذي تعمل به الخزنة.
 *  ما نجمع (بالفئات) · لماذا · الأساس · كم نحتفظ · مع من · الذكاء الاصطناعي · حقوقك وكيف تُمارَس بزرّ · جهة الاتصال · النسخة الآلية للوكلاء.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { PortalShell } from '../components/PortalShell';

type Item = { table: string; label_ar: string; label_en: string; data_ar: string; purpose_ar: string; basis_ar: string; retention_ar: string; policy_ar: string; access_ar: string[]; legacy: boolean };
type Notice = { version: string; draft: boolean; org: { name: string; legal: string; owner: string; contact: string; site: string }; categories: { id: string; title_ar: string; items: Item[] }[]; processors: { id: string; name: string; role: string; region_ar: string; data_ar: string }[]; rights: { id: string; title: string; body: string }[]; timelines: { dsr_days: number; dsr_extension_days: number; incident_hours: number; erasure_hold_days: number }; tables: number };

export default function PrivacyPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const [n, setN] = useState<Notice | null>(null); const [err, setErr] = useState('');
  useEffect(() => { fetch('/api/vault?notice=1', { cache: 'no-store' }).then(r => r.json()).then(j => j?.success ? setN(j.notice) : setErr('تعذّر تحميل الإشعار')).catch(() => setErr('تعذّر تحميل الإشعار')); }, []);
  return (
    <main className="pv" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="pv-head"><span className="pt-kicker"><Icon name="shield" size={14} /> خزنة أَثَر · الصندوق الزجاجي</span><h1>إشعار الخصوصية</h1>
        <p>هذه الصفحة ليست نصًّا كُتب مرة ونُسي: إنها تُولَّد الآن من <b>سجل أنشطة المعالجة</b> نفسه الذي تعمل به أَثَر. ما يظهر هنا هو ما تفعله البوابة فعلًا، بندًا بندًا، وفق <b>نظام حماية البيانات الشخصية</b> في المملكة العربية السعودية ولائحته التنفيذية.</p>
        {n && <div className="pv-meta"><span>الإصدار {n.version}</span><span>{n.tables} نوع بيانات</span>{n.draft && <span className="pv-draft">مسودة بانتظار المراجعة النظامية</span>}<a href="/.well-known/privacy.json" target="_blank" rel="noreferrer" dir="ltr">privacy.json</a><Link href="/me/data" className="pt-btn small">افتح ذاكرتي</Link></div>}
      </header>
      {err && <p className="pv-err">{err}</p>}
      {n && (
        <>
          <section className="pv-box" id="controller"><h2><Icon name="home" size={18} /> من نحن</h2><p><b>{n.org.name}</b> — بوابة التعليم والتدريب والتطوير، تشغّلها <b>{n.org.legal}</b> (جهة التحكم) ويملك حقوقها {n.org.owner}. {n.org.contact ? <>جهة الاتصال لحماية البيانات: <a href={`mailto:${n.org.contact}`} dir="ltr">{n.org.contact}</a>.</> : 'جهة الاتصال لحماية البيانات تُعلن هنا فور ضبطها.'} ولك الحق في التظلّم لدى الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).</p></section>
          <section className="pv-box" id="data"><h2><Icon name="compass" size={18} /> ما نجمع — ولماذا — وإلى متى</h2><p className="pv-muted">كل بند أدناه حقيقي ومُطابق لما في قاعدة البيانات. البنود الموسومة «منصة التقييم» تخصّ منصة تقييم التدريب الأصلية التي تشغّلها الجهات عبر أَثَر.</p>
            {n.categories.map(c => (
              <div key={c.id} className="pv-cat"><h3>{c.title_ar}</h3>
                <div className="pv-table"><table><thead><tr><th>البيانات</th><th>ما فيها</th><th>لماذا</th><th>الأساس</th><th>كم نحتفظ</th><th>عند النسيان</th><th>من يصل</th></tr></thead><tbody>
                  {c.items.map(i => <tr key={i.table}><td><b>{i.label_ar}</b>{i.legacy && <small> · منصة التقييم</small>}</td><td>{i.data_ar}</td><td>{i.purpose_ar}</td><td>{i.basis_ar}</td><td>{i.retention_ar}</td><td>{i.policy_ar}</td><td>{i.access_ar.join(' · ')}</td></tr>)}
                </tbody></table></div>
              </div>
            ))}
          </section>
          <section className="pv-box" id="ai"><h2><Icon name="star" size={18} /> الذكاء الاصطناعي — بصدق</h2><ul className="pv-list"><li><b>الإنسان يعتمد.</b> لا قرار يمسّك (قبول، شهادة، مستوى معتمد، تقييم مهمة) يصدر من نموذج بلا مراجعة بشرية.</li><li><b>بلا هويتك.</b> ما يُرسل إلى مزوّد النماذج هو نصّ الموقف/الحوار فقط، من دون اسمك أو بريدك أو معرّفك. نسجّل الأحجام والغرض لا النصوص.</li><li><b>ترى كل لمسة.</b> «من لمس بياناتي» في ذاكرتك يعرض كل استخدام للنماذج على بياناتك.</li><li><b>لا تدريب على بياناتك.</b> نستعمل واجهات برمجية بشروط «عدم التدريب» لدى المزوّد.</li></ul></section>
          <section className="pv-box" id="processors"><h2><Icon name="globe" size={18} /> أين تعيش البيانات ومن يعالجها نيابة عنا</h2><p className="pv-muted">نقول ذلك صراحة لأن النظام يشترط الشفافية في النقل خارج المملكة، ولأنك تستحق أن تعرف.</p>
            <div className="pv-table"><table><thead><tr><th>المعالج</th><th>دوره</th><th>الموقع</th><th>ما يراه</th></tr></thead><tbody>{n.processors.map(p => <tr key={p.id}><td><b>{p.name}</b></td><td>{p.role}</td><td>{p.region_ar}</td><td>{p.data_ar}</td></tr>)}</tbody></table></div></section>
          <section className="pv-box" id="rights"><h2><Icon name="scale" size={18} /> حقوقك — أزرار لا وعود</h2><div className="pv-rights">{n.rights.map(r => <div key={r.id}><b>{r.title}</b><p>{r.body}</p></div>)}</div>
            <div className="pv-times"><span><b>فورًا</b> نسختك وإيصالها</span><span><b>{n.timelines.dsr_days} يومًا</b> الردّ على التصحيح/الاعتراض (+{n.timelines.dsr_extension_days} بسبب مكتوب تُخبر به)</span><span><b>{n.timelines.erasure_hold_days} أيام</b> حجر النسيان برابط تراجع ثم تنفيذ آلي وإيصال موقَّع</span><span><b>{n.timelines.incident_hours} ساعة</b> إبلاغ الهيئة بأي حادثة بيانات، وإبلاغك دون تأخير</span></div>
            <p><Link href="/me/data" className="pt-btn">افتح «ذاكرتي» ومارس حقوقك الآن</Link></p></section>
          <section className="pv-box" id="agents"><h2><Icon name="link" size={18} /> للوكلاء والجهات</h2><p>هذا الإشعار متاح آليًا على <code dir="ltr">/.well-known/privacy.json</code> (الفئات، الأساس، المدد، المعالجون، نقاط ممارسة الحقوق). ووكيلك المفوَّض عبر سفارة أَثَر يستطيع — بإذنك — قراءة موجز بياناتك بأداة <code dir="ltr">my_data_summary</code> وطلب نسختك، ولا يستطيع حذف شيء: النسيان قرارك أنت وحدك من حسابك. الأمن: <Link href="/security">/security</Link>.</p></section>
          <footer className="pv-foot">إصدار {n.version} · يُحدَّث آليًا كلما تغيّر سجل المعالجة · © 2026 {n.org.owner} — {n.org.legal}</footer>
        </>
      )}
    </main>
  );
}

const CSS = `
.pv{max-width:1100px;margin:0 auto;padding:18px 16px 60px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f2a4e}
.pv-head h1{margin:6px 0 6px;font-size:30px}.pv-head p{color:#475569;line-height:1.9;margin:0;max-width:820px}
.pv-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px;font-size:13px}.pv-meta span{background:#fff;border:1px solid #e5e9f0;border-radius:999px;padding:4px 12px;color:#334155}.pv-meta a[dir=ltr]{font-family:ui-monospace,monospace;font-size:12px;color:#0b8a83}.pv-draft{background:#fffbeb!important;border-color:#fde68a!important;color:#92400e!important}
.pv-box{background:#fff;border:1px solid #e5e9f0;border-radius:16px;padding:16px 18px;margin-top:14px}.pv-box h2{display:flex;align-items:center;gap:8px;font-size:18px;margin:0 0 6px}.pv-box p{line-height:1.9;color:#334155;font-size:14px;margin:6px 0}.pv-muted{color:#64748b!important;font-size:13px!important}.pv-err{color:#b91c1c}
.pv-cat{margin-top:12px}.pv-cat h3{font-size:15px;color:#0b8a83;margin:0 0 6px}
.pv-table{overflow:auto}.pv-table table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:820px}.pv-table th{text-align:start;background:#f6f8fb;color:#475569;font-weight:800;padding:6px 8px;border-bottom:1px solid #e5e9f0}.pv-table td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top;color:#334155;line-height:1.6}.pv-table td small{color:#94a3b8}
.pv-list{margin:6px 0;padding-inline-start:20px;line-height:1.9;font-size:14px;color:#334155}
.pv-rights{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin:8px 0}.pv-rights div{border:1px solid #e5e9f0;border-radius:12px;padding:10px 12px;background:#fafbfd}.pv-rights b{color:#0b8a83}.pv-rights p{margin:4px 0 0;font-size:13px}
.pv-times{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.pv-times span{background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:8px 12px;font-size:13px;color:#134e4a}.pv-times b{color:#0b8a83;margin-inline-end:4px}
.pv-foot{margin-top:18px;color:#94a3b8;font-size:12px;text-align:center}
@media (max-width:640px){.pv-head h1{font-size:24px}}
`;
