'use client';

import { Icon } from '../../../lib/ui/icons';

const FEATURES: { icon: any; text: string }[] = [
  { icon: 'programs', text: 'إدارة البرامج التدريبية والقاعات' },
  { icon: 'evaluations', text: 'التقييمات اليومية والختامية ثنائية اللغة' },
  { icon: 'scale', text: 'قياس الأثر قبل/بعد البرنامج' },
  { icon: 'reports', text: 'التقارير التنفيذية ومركز التقارير' },
  { icon: 'award', text: 'الشهادات والتكريم برمز تحقق' },
];

/** اللوحة التعريفية الجانبية لصفحات المصادقة (الدخول / الاسترجاع / إعادة التعيين) */
export default function LoginHero() {
  return (
    <aside className="au-hero" aria-label="عن المنصة">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="au-logos">
        <span className="au-logo"><img src="/logos/upm.png" alt="جامعة الأمير مقرن بن عبدالعزيز" /></span>
        <span className="au-logo"><img src="/logos/center.png" alt="المركز العالمي لتعليم اللغة العربية" /></span>
      </div>
      <div className="au-kicker">Excellence Portal</div>
      <h1>بوابة التميز للتعليم والتطوير</h1>
      <p>منصة موحّدة لإدارة البرامج التدريبية وتقييمها وقياس أثرها، وتحويل البيانات إلى قرارات تنفيذية.</p>
      <ul className="au-feats">
        {FEATURES.map((f) => (
          <li key={f.text}><span className="au-fico"><Icon name={f.icon} size={16} /></span>{f.text}</li>
        ))}
      </ul>
      <div className="au-hero-foot"><Icon name="shield" size={14} />اتصال مشفّر — بيانات المتدربين مجهولة الهوية</div>
    </aside>
  );
}

const CSS = `
.au-hero{background:#0f2a4e;color:#fff;border-radius:18px;padding:40px 36px;height:100%;display:flex;flex-direction:column;justify-content:center;border-inline-start:6px solid #c9a24b;box-shadow:0 20px 45px rgba(15,42,78,.22);position:relative;overflow:hidden;}
.au-hero::after{content:"";position:absolute;width:320px;height:320px;border-radius:50%;background:rgba(11,138,131,.18);left:-120px;bottom:-150px;}
.au-hero>*{position:relative;z-index:1;}
.au-logos{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px;}
.au-logo{background:#fff;border-radius:12px;padding:8px 14px;height:64px;min-width:110px;display:inline-flex;align-items:center;justify-content:center;}
.au-logo img{max-height:46px;max-width:140px;width:auto;object-fit:contain;}
.au-kicker{font-size:12px;letter-spacing:2.5px;text-transform:uppercase;color:#f2d99a;font-weight:800;}
.au-hero h1{margin:10px 0 12px;font-size:34px;font-weight:900;line-height:1.3;}
.au-hero p{margin:0;font-size:16px;line-height:1.9;color:#d2e2ee;max-width:520px;font-weight:500;}
.au-feats{list-style:none;margin:28px 0 0;padding:0;display:grid;gap:10px;}
.au-feats li{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:10px 14px;font-weight:700;font-size:14.5px;}
.au-fico{width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.14);display:inline-flex;align-items:center;justify-content:center;color:#f2d99a;flex-shrink:0;}
.au-hero-foot{margin-top:26px;display:inline-flex;align-items:center;gap:6px;color:#9fb3c8;font-size:12.5px;font-weight:700;}
.au-hero-foot svg{color:#f2d99a;}
@media(max-width:900px){.au-hero{padding:28px 22px;}.au-hero h1{font-size:26px;}.au-feats{display:none;}}
`;
