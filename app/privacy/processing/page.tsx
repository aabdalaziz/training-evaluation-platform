'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /privacy/processing — الملخّص العام لسجلّ أنشطة المعالجة (RoPA — نظام حماية البيانات الشخصية السعودي) — P65
 *  مولَّد لا مكتوب: يقرأ /.well-known/privacy.json (الذي يُبنى من سجلّ الخزنة lib/vault/registry.ts) ويعرضه جدولًا قابلًا للطباعة:
 *  النشاط · الفئة · الغرض · الأساس · المدّة · المعالجون · النقل خارج المملكة (بصدق: نعم حتى النشر داخل المملكة).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../components/PortalShell';
import { Icon } from '../../../lib/ui/icons';

type P = { version: string; status: string; controller: { name: string; brand?: string; regulator?: string; law?: string }; timelines: { subject_request_days: number; extension_days: number; breach_notification_hours: number; erasure_hold_days: number }; processing: { id: string; name_ar: string; category: string; purpose_ar: string; data_ar: string; legal_basis: string; retention_days: number; retention_policy: string }[]; processors: { id: string; name: string; role_ar: string; location_ar: string; data_ar: string }[] };
const BASIS: Record<string, string> = { contract: 'تنفيذ عقد/خدمة', consent: 'موافقة صريحة', legitimate: 'مصلحة مشروعة', legal: 'التزام نظامي' };
const CAT: Record<string, string> = { identity: 'الهوية والحساب', learning: 'الأثر التدريبي', credentials: 'الشهادات والمحفظة', commerce: 'الطلبات والفواتير', communication: 'التواصل والتفضيلات', agents: 'الوكلاء والتفويضات', operations: 'التشغيل', security: 'الأمن' };
const POLICY: Record<string, string> = { delete: 'حذف', anonymize: 'تجهيل', retain_legal: 'احتفاظ نظامي', none: '—' };
const days = (d: number) => d >= 365 ? `${Math.round(d / 365 * 10) / 10} سنة` : `${d} يومًا`;

export default function ProcessingPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const [p, setP] = useState<P | null>(null); const [err, setErr] = useState(false);
  useEffect(() => { fetch('/.well-known/privacy.json', { cache: 'no-store' }).then(r => r.json()).then(setP).catch(() => setErr(true)); }, []);
  const cats = p ? [...new Set(p.processing.map(x => x.category))] : [];
  return <main className="pt-main" dir="rtl" data-testid="pp-root">
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="pp">
      <p className="pt-muted" style={{ margin: 0, color: '#0b8a83', fontWeight: 800 }}><Icon name="shield" size={14} /> أَثَر · خزنة أَثَر · سجلّ أنشطة المعالجة</p>
      <div className="pp-head"><h1>ماذا نعالج، ولماذا، وإلى متى</h1><button type="button" className="pt-btn light no-print" onClick={() => window.print()}><Icon name="print" size={14} /> طباعة / PDF</button></div>
      <p className="pt-muted">هذا الملخّص العام لسجلّ أنشطة المعالجة وفق نظام حماية البيانات الشخصية السعودي يُولَّد آليًا من سجلّ الكود نفسه (كل جدول بيانات شخصية مسجَّل بفئته وغرضه وأساسه ومدّته)، فلا يشيخ ولا يُنسى منه جدول. {p ? <>الإصدار {p.version} · الحالة: {p.status === 'published' ? 'منشور' : 'مسوَّدة بانتظار المراجعة القانونية'} · جهة التحكّم: {p.controller.name}</> : null}</p>
      {err && <p className="pt-muted">تعذّر تحميل السجلّ الآن.</p>}
      {p && <>
        <div className="pp-kpis" data-testid="pp-kpis"><span><b>{p.processing.length}</b> نشاط معالجة</span><span><b>{p.processors.length}</b> معالجين نيابةً عنّا</span><span>الردّ على طلبات الأفراد خلال <b>{p.timelines.subject_request_days}</b> يومًا</span><span>إبلاغ الجهة المختصّة عن أي تسرّب خلال <b>{p.timelines.breach_notification_hours}</b> ساعة</span></div>
        {cats.map(c => <section key={c} className="pp-cat">
          <h2>{CAT[c] || c}</h2>
          <table className="pp-table"><thead><tr><th>النشاط</th><th>البيانات</th><th>الغرض</th><th>الأساس</th><th>المدّة / المصير</th></tr></thead><tbody>
            {p.processing.filter(x => x.category === c).map(x => <tr key={x.id}><td><b>{x.name_ar}</b></td><td>{x.data_ar}</td><td>{x.purpose_ar}</td><td>{BASIS[x.legal_basis] || x.legal_basis}</td><td>{days(x.retention_days)} · {POLICY[x.retention_policy] || x.retention_policy}</td></tr>)}
          </tbody></table>
        </section>)}
        <section className="pp-cat">
          <h2>المعالجون نيابةً عنّا، وأين تعيش البيانات</h2>
          <table className="pp-table"><thead><tr><th>المعالج</th><th>الدور</th><th>الموقع</th><th>ما يصل إليه</th></tr></thead><tbody>
            {p.processors.map(x => <tr key={x.id}><td><b>{x.name}</b></td><td>{x.role_ar}</td><td>{x.location_ar}</td><td>{x.data_ar}</td></tr>)}
          </tbody></table>
          <div className="pp-note" data-testid="pp-crossborder"><b>النقل خارج المملكة — بصدق:</b> البوابة اليوم تُستضاف على Vercel وSupabase خارج المملكة، فبيانات الأفراد تُعالَج خارجها بالحدّ الأدنى اللازم لتشغيل الخدمة وبضمانات تعاقدية. للجهات الحكومية والحسّاسة نعرض نشرًا داخل المملكة (قاعدة بيانات وتشغيل على سحابة سعودية) مع تجهيل بيانات التجربة إلى حين النشر — وهذا السطر يتغيّر يوم يتغيّر الواقع.</div>
        </section>
        <section className="pp-cat">
          <h2>حقوقك وكيف تُمارسها</h2>
          <p className="pt-muted">الاطّلاع والنسخ والتصحيح والمحو من صفحة <Link href="/me/data">ذاكرتي</Link> بلا طلب ورقي؛ «مَن نظر إلى بياناتي؟» تُجيبك هناك عن كل فتح لملفّك من الطاقم. الإشعار الكامل في <Link href="/privacy">/privacy</Link>، والصيغة الآلية في <a href="/.well-known/privacy.json">privacy.json</a>، وحالة الدرع في <Link href="/security">/security</Link>.</p>
        </section>
      </>}
      <p className="pt-muted no-print" style={{ marginTop: 14 }}><Link href="/privacy">← الخصوصية</Link> · <Link href="/security">درع أَثَر</Link> · <Link href="/">الرئيسية</Link></p>
    </section>
  </main>;
}

const CSS = `
.pp{max-width:1100px;margin:0 auto;padding:8px 0 40px;display:grid;gap:12px}.pp-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.pp-head h1{margin:0;font-size:26px;color:#0f2a4e}
.pp-kpis{display:flex;gap:10px;flex-wrap:wrap}.pp-kpis span{background:#fff;border:1px solid #e5e9f0;border-radius:12px;padding:8px 12px;font-size:13px;color:#334155}.pp-kpis b{color:#0f2a4e;font-size:16px}
.pp-cat{background:#fff;border:1px solid #e5e9f0;border-radius:16px;padding:14px 16px}.pp-cat h2{margin:0 0 6px;font-size:17px;color:#0f2a4e}
.pp-table{width:100%;border-collapse:collapse;font-size:13px}.pp-table th{text-align:start;color:#64748b;font-weight:700;font-size:12px;padding:6px 8px;border-bottom:1px solid #e5e9f0}.pp-table td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top;line-height:1.6}
.pp-note{margin-top:10px;border:1px dashed #c9a24b;border-radius:12px;padding:10px 12px;background:#fffdf5;font-size:13px;color:#334155;line-height:1.8}
.pt-btn{display:inline-flex;align-items:center;gap:6px;border:0;background:#0f2a4e;color:#fff;border-radius:10px;padding:8px 14px;font:inherit;font-size:13px;font-weight:800;cursor:pointer}.pt-btn.light{background:#e6f4f3;color:#0b6f69}
@media print{.no-print,nav,footer,header{display:none!important}.pp-cat{break-inside:avoid;border:0;padding:0}.pp{padding:0}}
@media (max-width:640px){.pp-table{display:block;overflow-x:auto}}
`;
