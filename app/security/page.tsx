'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /security — «الباب المعلن» (P21): صفحة عامة تشرح كيف تحمي أَثَر بياناتك، وتعرض حالة الدرع الحية (آخر تمرين ذاتي ✓/✗ مجهّلًا)،
 *  وسياسة الإفصاح المسؤول للباحثين (RFC 9116 · /.well-known/security.txt) ورابط البلاغ. لا أرقام داخلية، لا عناوين، لا تفاصيل تُفيد مهاجمًا.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { PortalShell } from '../components/PortalShell';

type Pub = { drill: { at: string; passed: number; total: number; ok: boolean } | null; checks: { id: string; title_ar: string; ok: boolean }[]; events_30d: { total: number; by_severity: Record<string, number> }; open_critical: boolean; generated_at: string };

export default function SecurityPage() { return <PortalShell><Inner /></PortalShell>; }

const PILLARS = [
  { icon: 'shield', t: 'الجدار', d: 'ترويسات أمان على كل صفحة: HSTS، منع التضمين الخفي (clickjacking)، منع تخمين النوع، سياسة محتوى (CSP) تُراقب ما يحمّله المتصفح.' },
  { icon: 'refresh', t: 'الصمّام', d: 'حدود معدل حقيقية مشتركة بين كل خوادمنا على نقاط التفويض والتحقق والمحاكيات — القصف يُوقَف قبل أن يؤذي.' },
  { icon: 'alert', t: 'الحارس', d: 'كشف إعادة استخدام رموز التجديد والأكواد (أثر هجوم)، وإبطال التفويض فورًا، وتنبيه الطاقم وصاحب الحساب في اللحظة نفسها.' },
  { icon: 'settings', t: 'المفاتيح', d: 'مفاتيح التوقيع (شهادات Ed25519 ورموز OAuth) تُدوَّر بلا انقطاع: المفتاح القديم يبقى للتحقق من الشهادات السابقة، والجديد يوقّع من اليوم.' },
  { icon: 'globe', t: 'الباب المعلن', d: 'سياسة إفصاح مسؤول وفق RFC 9116 وملف security.txt قياسي — الباحثون يعرفون أين يطرقون.' },
  { icon: 'check', t: 'التمرين', d: 'الدرع يختبر نفسه كل يوم بثلاثة عشر اختبارًا حيًا على الموقع نفسه، والنتيجة تُعرض هنا علنًا.' },
];

function Inner() {
  const [p, setP] = useState<Pub | null>(null); const [err, setErr] = useState(false);
  useEffect(() => { fetch('/api/shield?public=1', { cache: 'no-store' }).then(r => r.json()).then(j => j?.success ? setP(j) : setErr(true)).catch(() => setErr(true)); }, []);
  const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'long', timeStyle: 'short' }) : '';
  return (
    <main className="sc" dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="sc-hero">
        <span className="sc-kicker"><Icon name="shield" size={14} /> درع أَثَر</span>
        <h1>أمنك ليس وعدًا — إنه اختبار يُجرى كل يوم ويُنشر هنا</h1>
        <p>أَثَر تحفظ أثرك التدريبي وشهاداتك وبيانات جهتك. لذلك لا نكتفي بالقول إننا آمنون؛ بنينا درعًا حيًّا يختبر نفسه يوميًا ويعرض نتيجته علنًا، ويفتح بابًا واضحًا لمن يجد ثغرة.</p>
      </section>

      <section className="sc-card sc-live" data-testid="shield-public">
        <div className="sc-livehead"><h2><Icon name="check" size={16} /> حالة الدرع الآن</h2>{p?.drill ? <span className={p.drill.ok ? 'ok' : 'warn'}>{p.drill.ok ? 'كل الاختبارات ناجحة' : `${p.drill.passed} من ${p.drill.total} ناجحة`} · {fmt(p.drill.at)}</span> : <span>{err ? 'تعذّر جلب الحالة' : p ? 'لم يُجرَ تمرين بعد' : 'جارٍ…'}</span>}</div>
        {p?.checks?.length ? <ul className="sc-checks">{p.checks.map(c => <li key={c.id} className={c.ok ? 'ok' : 'fail'}><span>{c.ok ? '✓' : '✗'}</span>{c.title_ar}</li>)}</ul> : null}
        {p && <p className="sc-muted">خلال 30 يومًا: {p.events_30d.total} حدثًا أمنيًا مسجَّلًا (منها {p.events_30d.by_severity?.critical || 0} حرج · {p.events_30d.by_severity?.warn || 0} تحذير) — {p.open_critical ? 'يعمل الطاقم على حدث حرج الآن.' : 'لا حدث حرج معلّقًا.'} الأرقام مجهّلة ولا تكشف تفاصيل تفيد مهاجمًا.</p>}
      </section>

      <section className="sc-grid">{PILLARS.map(x => <article key={x.t} className="sc-card"><h3><Icon name={x.icon as any} size={16} /> {x.t}</h3><p>{x.d}</p></article>)}</section>

      <section className="sc-card" id="data">
        <h2>ما الذي نحمي، وكيف</h2>
        <ul className="sc-list">
          <li><b>بياناتك في قاعدة بيانات بسياسات صفوف (RLS)</b> على كل جدول — لا يصل مستخدم إلى صف لا يخصّه حتى لو حاول مباشرة.</li>
          <li><b>الوكلاء والمساعدون</b> لا يدخلون إلا بتفويضك الصريح (OAuth 2.1 + PKCE) بنطاقات محدودة، وتراه وتُبطله في «وكلائي» بنقرة. أي محاولة إعادة استخدام رمز تُبطل التفويض كله وتُبلغك.</li>
          <li><b>الشهادات</b> موقَّعة Ed25519 ويمكن لأي جهة التحقق منها دون الاتصال بنا؛ المفاتيح المتقاعدة تبقى منشورة فلا تسقط شهادة قديمة.</li>
          <li><b>لا نبيع البيانات ولا نشاركها</b> مع طرف ثالث إلا لتشغيل الخدمة (استضافة، بريد، دفع) وبالحد الأدنى. مبدأنا: «الإنسان يعتمد، الآلة تساعد».</li>
        </ul>
      </section>

      <section className="sc-card sc-report" id="report">
        <h2><Icon name="mail" size={16} /> وجدت ثغرة؟ هذا بابك</h2>
        <p>نرحّب بالإفصاح المسؤول. أبلغنا قبل أن تنشر، وأعطنا 90 يومًا للمعالجة، ولا تمسّ بيانات ليست لك ولا تُعطّل الخدمة — ونعدك بردّ خلال 5 أيام عمل وبذكر اسمك في لوحة الشكر إن رغبت.</p>
        <div className="sc-actions"><Link className="pt-btn gold" href="/security/report">أبلغ عن ثغرة</Link><a className="pt-btn light" href="/.well-known/security.txt" target="_blank" rel="noreferrer">security.txt</a></div>
        <p className="sc-muted">نطاق البرنامج: athar-portal.vercel.app وواجهات /api و /mcp و /oauth. خارج النطاق: الهندسة الاجتماعية، حجب الخدمة، مزوّدو الاستضافة والدفع.</p>
      </section>

      <section className="sc-card" id="thanks">
        <h2>شكر</h2>
        <p className="sc-muted">لوحة الشكر للباحثين الذين ساعدونا — تُحدَّث عند أول بلاغ مُعالَج.</p>
      </section>
    </main>
  );
}

const CSS = `
.sc{max-width:1000px;margin:0 auto;padding:24px 16px 56px;display:grid;gap:14px;font-family:inherit}
.sc-hero{padding:8px 0 4px}.sc-kicker{display:inline-flex;align-items:center;gap:6px;color:#0b8a83;font-weight:900;font-size:13px}.sc-hero h1{margin:6px 0;font-size:30px;line-height:1.35;color:#0f2a4e}.sc-hero p{margin:0;color:#475569;font-size:15px;line-height:1.9;max-width:820px}
.sc-card{background:#fff;border:1px solid #e5e9f0;border-radius:18px;padding:18px;box-shadow:0 6px 22px rgba(15,42,78,.05)}.sc-card h2{margin:0 0 8px;font-size:19px;color:#0f2a4e;display:flex;align-items:center;gap:8px}.sc-card h3{margin:0 0 6px;font-size:16px;color:#0f2a4e;display:flex;align-items:center;gap:6px}.sc-card p{margin:4px 0;color:#334155;font-size:14px;line-height:1.8}
.sc-live{border-color:#bfe3e0;background:linear-gradient(180deg,#f3fbfa,#fff)}.sc-livehead{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.sc-livehead span{font-size:13px;color:#64748b}.sc-livehead span.ok{color:#166534;font-weight:800}.sc-livehead span.warn{color:#92400e;font-weight:800}
.sc-checks{list-style:none;margin:10px 0;padding:0;display:grid;gap:6px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}.sc-checks li{display:flex;gap:8px;align-items:center;font-size:13px;color:#0f2a4e;background:#fff;border:1px solid #e5e9f0;border-radius:10px;padding:8px 10px}.sc-checks li span{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:900;background:#dcfce7;color:#166534;flex:none}.sc-checks li.fail span{background:#fee2e2;color:#991b1b}
.sc-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.sc-list{margin:6px 0;padding-inline-start:20px;color:#334155;font-size:14px;line-height:1.9}.sc-list b{color:#0f2a4e}
.sc-report{border-color:#f1e2b8;background:linear-gradient(180deg,#fffdf5,#fff)}.sc-actions{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}
.sc-muted{color:#64748b;font-size:13px;line-height:1.7}
.pt-btn{display:inline-flex;align-items:center;justify-content:center;border:0;background:#0f2a4e;color:#fff;border-radius:12px;padding:10px 18px;font:inherit;font-size:14px;font-weight:800;text-decoration:none;cursor:pointer}.pt-btn.gold{background:#c9a24b;color:#0f2a4e}.pt-btn.light{background:#e6f4f3;color:#0b6f69}
`;
