'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «وعد أَثَر» — اللوحة الجانبية لصفحات الدخول (P42-ب-0 «هوية الدخول»)
 *  كانت لوحة «بوابة التميز» بشعارات الجامعة؛ صارت لوحة أَثَر نفسها: الاسم والشعار والوعد،
 *  ثم «ثلاثة طرق إلى الباب الواحد» (نموذج الوصول الذي أقرّه المالك):
 *   المتدرّب يدخل ببريده · المدرّب/الخبير يأتي من هيئة أَثَر · الطاقم والجهات بدعوة من إدارة أَثَر.
 */
import Link from 'next/link';
import { Icon } from '../../../lib/ui/icons';
import { AtharMark } from '../PortalShell';
import { BRAND } from '../../../lib/portal/content';

const WAYS: { icon: any; who: string; how: string; href?: string; cta?: string }[] = [
  { icon: 'users', who: 'متدرّب أو طالب أو مشارك', how: 'اكتب بريدك ويصلك رابط الدخول — حسابك يُنشأ من أول دخول، بلا كلمة مرور.' },
  { icon: 'star', who: 'مدرّب أو خبير أو مستشار', how: 'سجّل سيرتك في هيئة أَثَر؛ وبعد اعتماد الطاقم يُفتح لك بابك بالبريد نفسه.', href: '/trainers', cta: 'هيئة أَثَر' },
  { icon: 'shield', who: 'الطاقم ومسؤولو الجهات', how: 'الصفات الوظيفية تُمنح بدعوة من إدارة أَثَر: رابط واحد لمرة واحدة يفتح بابك.', href: '/help#invite', cta: 'لديك دعوة؟' },
];

export default function LoginHero() {
  return (
    <aside className="au-hero" aria-label="عن أَثَر" data-testid="login-hero">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="au-brand"><AtharMark size={56} light /><div><b>{BRAND.name.ar}</b><small>بوابة التعليم والتدريب والتطوير</small></div></div>
      <h1>باب واحد — وبابك أنت</h1>
      <p className="au-lead">{BRAND.motto.ar}. تدخل ببريدك مرة واحدة، فيفتح أَثَر لك ما يخصّك وحدك: صفحتك إن كنت متدرّبًا، وبابك إن كنت من الطاقم.</p>
      <ul className="au-ways" aria-label="ثلاثة طرق إلى الباب الواحد">
        {WAYS.map((w) => (
          <li key={w.who}>
            <span className="au-wico"><Icon name={w.icon} size={16} /></span>
            <div><b>{w.who}</b><span>{w.how}</span>{w.href ? <Link href={w.href} className="au-wlink">{w.cta} <Icon name="arrow" size={12} /></Link> : null}</div>
          </li>
        ))}
      </ul>
      <div className="au-hero-foot">
        <span><Icon name="shield" size={14} /> اتصال مشفّر · لا نشارك بريدك مع أحد</span>
        <span className="au-partners" aria-label="بالشراكة مع">
          <img src="/logos/upm.png" alt="جامعة الأمير مقرن بن عبدالعزيز" />
          <img src="/logos/center.png" alt="المركز العالمي لتعليم اللغة العربية" />
        </span>
      </div>
    </aside>
  );
}

const CSS = `
.au-hero{background:linear-gradient(160deg,#0f2a4e 0%,#123763 55%,#0b8a83 140%);color:#fff;border-radius:18px;padding:36px 34px;height:100%;display:flex;flex-direction:column;justify-content:center;border-inline-start:6px solid #c9a24b;box-shadow:0 20px 45px rgba(15,42,78,.22);position:relative;overflow:hidden;}
.au-hero::after{content:"";position:absolute;width:360px;height:360px;border-radius:50%;border:38px solid rgba(201,162,75,.10);left:-140px;bottom:-170px;}
.au-hero::before{content:"";position:absolute;width:220px;height:220px;border-radius:50%;border:22px solid rgba(255,255,255,.06);right:-80px;top:-90px;}
.au-hero>*{position:relative;z-index:1;}
.au-brand{display:flex;align-items:center;gap:14px;margin-bottom:22px;}
.au-brand b{display:block;font-size:30px;font-weight:900;line-height:1.1;letter-spacing:.5px;}
.au-brand small{display:block;color:#d8e2ee;font-size:13px;font-weight:600;margin-top:4px;}
.au-hero h1{margin:0 0 10px;font-size:28px;font-weight:900;line-height:1.35;}
.au-hero h1::after{content:"";display:block;width:56px;height:4px;border-radius:4px;background:#c9a24b;margin-top:12px;}
.au-lead{color:#e3eaf3;line-height:1.95;margin:0 0 22px;font-size:15px;font-weight:600;}
.au-ways{list-style:none;margin:0;padding:0;display:grid;gap:12px;}
.au-ways li{display:flex;gap:12px;align-items:flex-start;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:12px 14px;}
.au-ways li>div{display:grid;gap:3px;min-width:0;}
.au-ways b{font-size:14.5px;font-weight:800;}
.au-ways li span:not(.au-wico){font-size:13px;color:#dbe4ee;line-height:1.8;font-weight:500;}
.au-wico{flex:none;width:36px;height:36px;border-radius:10px;background:#c9a24b;color:#0f2a4e;display:inline-flex;align-items:center;justify-content:center;}
.au-wlink{color:#f3dfa7;font-weight:800;font-size:13px;text-decoration:none;display:inline-flex;align-items:center;gap:4px;min-height:24px;width:max-content;}
.au-wlink:hover{text-decoration:underline;}
.au-wlink:focus-visible{outline:3px solid #fff;outline-offset:2px;border-radius:6px;}
.au-hero-foot{margin-top:26px;padding-top:16px;border-top:1px solid rgba(255,255,255,.14);display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#cfdbe8;font-weight:700;}
.au-hero-foot>span:first-child{display:inline-flex;align-items:center;gap:6px;}
.au-partners{display:inline-flex;gap:8px;align-items:center;}
.au-partners img{height:34px;background:#fff;border-radius:8px;padding:3px 8px;}
@media (max-width:900px){.au-hero{padding:28px 22px;}.au-hero h1{font-size:24px;}.au-brand b{font-size:26px;}}
`;
