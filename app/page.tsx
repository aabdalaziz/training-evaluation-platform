'use client';

import Link from 'next/link';
import { Icon } from '../lib/ui/icons';

/* ===== بيانات الصفحة ===== */
const QUICK = [
  { href: '/login', icon: 'login', title: 'دخول الإدارة', en: 'Administration', primary: true },
  { href: '/evaluate/daily', icon: 'calendar', title: 'التقييم اليومي', en: 'Daily Evaluation' },
  { href: '/evaluate/final', icon: 'flag', title: 'التقييم النهائي', en: 'Final Evaluation' },
  { href: '/student', icon: 'users', title: 'بوابة المتدرب', en: 'Student Portal' },
  { href: '/survey/remote-learning', icon: 'laptop', title: 'استطلاع التعلم عن بُعد', en: 'Remote Learning Survey' },
  { href: '/verify', icon: 'certificate', title: 'التحقق من الشهادات', en: 'Verify Certificate' },
] as const;

const FEATURES = [
  { icon: 'programs', tone: 'navy', title: 'إدارة البرامج والقاعات', desc: 'تسجيل البرامج الحضورية وعن بُعد، القاعات والمدربون والمستويات، مع مسار اعتماد واضح.' },
  { icon: 'evaluations', tone: 'teal', title: 'التقييمات اليومية والختامية', desc: 'استبانات ثنائية اللغة للمتدربين على الجوال، مع منع التكرار وحساب المؤشرات فورًا.' },
  { icon: 'scale', tone: 'gold', title: 'قياس الأثر قبل/بعد', desc: 'أدوات قياس قبلية وبعدية بثلاث طرق للبناء، ومؤشرات الأثر (Hake g، Cohen’s d) تلقائيًا.' },
  { icon: 'reports', tone: 'info', title: 'التقارير التنفيذية', desc: 'لوحة قيادة، بطاقة أداء المحاور، خرائط حرارية، ومركز تقارير بأكثر من 12 نوعًا جاهزًا للطباعة.' },
  { icon: 'award', tone: 'ok', title: 'الشهادات والتكريم', desc: 'إصدار شهادات برمز تحقق QR، وتكريم المدربين المتميزين وفق معايير عادلة.' },
  { icon: 'compass', tone: 'warn', title: 'قرارات مبنية على البيانات', desc: 'توصيات ذات أولوية، تنبيهات مبكرة للفجوات، وملخصات دورية تصل إلى القيادة بالبريد.' },
] as const;

const STEPS = [
  { n: 1, icon: 'plus', title: 'سجّل البرنامج', desc: 'أنشئ البرنامج وحدّد نمطه (حضوري / عن بُعد) وقاعاته ومدربيه خلال دقائق.' },
  { n: 2, icon: 'send', title: 'اجمع التقييمات', desc: 'شارك رابط التقييم أو رمز QR مع المتدربين؛ تصل الاستجابات مباشرة وبسرّية.' },
  { n: 3, icon: 'trend', title: 'اقرأ المؤشرات وقرّر', desc: 'تابع الأداء مقابل المستهدف 4.2/5، واطبع التقارير وشارك التوصيات مع الفريق.' },
] as const;

const PARTNERS = [
  { logo: '/logos/upm.png', name: 'جامعة الأمير مقرن بن عبدالعزيز', en: 'Prince Mugrin University', type: 'الجهة الأكاديمية', wide: false },
  { logo: '/logos/center.png', name: 'المركز العالمي لتعليم اللغة العربية', en: 'Global Center for Teaching Arabic', type: 'مركز متخصص', wide: false },
  { logo: '/logos/gate.png', name: 'بوابة التميز للاستشارات والتدريب', en: 'CenterGate for Excellence', type: 'الشريك الإستراتيجي', wide: true },
] as const;

export default function HomePage() {
  return (
    <main className="hm" dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* 1) الواجهة الرئيسية */}
      <section className="hm-hero" aria-labelledby="hm-title">
        <div className="hm-hero-in">
          <div className="hm-logos" aria-label="الجهات">
            <span className="hm-logo"><img src="/logos/upm.png" alt="جامعة الأمير مقرن بن عبدالعزيز" /></span>
            <span className="hm-logo"><img src="/logos/center.png" alt="المركز العالمي لتعليم اللغة العربية" /></span>
            <span className="hm-logo wide"><img src="/logos/gate.png" alt="بوابة التميز للاستشارات والتدريب" /></span>
          </div>
          <div className="hm-kicker">Excellence Portal for Education &amp; Development</div>
          <h1 id="hm-title">بوابة التميز للتعليم والتطوير</h1>
          <p className="hm-lead">منصة موحّدة لإدارة البرامج التدريبية وتقييمها وقياس أثرها، وتحويل البيانات إلى قرارات تنفيذية واضحة.</p>
          <div className="hm-cta">
            {QUICK.slice(0, 4).map((q) => (
              <Link key={q.href} href={q.href} className={`hm-btn ${'primary' in q && q.primary ? 'primary' : ''}`}>
                <Icon name={q.icon} size={18} /><span>{q.title}</span>
              </Link>
            ))}
          </div>
          <div className="hm-badges">
            <span><Icon name="shield" size={14} />استجابات مجهولة الهوية</span>
            <span><Icon name="globe" size={14} />عربي / English</span>
            <span><Icon name="target" size={14} />المستهدف المرجعي 4.2 / 5</span>
          </div>
        </div>
      </section>

      {/* 2) خدمات المشاركين */}
      <section className="hm-sec" aria-labelledby="hm-quick-title">
        <div className="hm-sec-head">
          <h2 id="hm-quick-title"><Icon name="compass" size={22} />ابدأ من هنا</h2>
          <p>اختر الخدمة التي تريد الوصول إليها مباشرة.</p>
        </div>
        <div className="hm-quick">
          {QUICK.map((q) => (
            <Link key={q.href} href={q.href} className={`hm-qcard ${'primary' in q && q.primary ? 'primary' : ''}`}>
              <span className="hm-qico"><Icon name={q.icon} size={24} /></span>
              <b>{q.title}</b>
              <small>{q.en}</small>
              <span className="hm-qarrow" aria-hidden="true"><Icon name="arrow" size={16} /></span>
            </Link>
          ))}
        </div>
      </section>

      {/* 3) ماذا تقدم المنصة */}
      <section className="hm-sec" aria-labelledby="hm-feat-title">
        <div className="hm-sec-head">
          <h2 id="hm-feat-title"><Icon name="star" size={22} />ماذا تقدّم المنصة؟</h2>
          <p>دورة كاملة من التسجيل إلى القرار — في مكان واحد.</p>
        </div>
        <div className="hm-feats">
          {FEATURES.map((f) => (
            <article key={f.title} className={`hm-feat ${f.tone}`}>
              <span className="hm-fico"><Icon name={f.icon} size={22} /></span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 4) كيف تعمل */}
      <section className="hm-sec" aria-labelledby="hm-how-title">
        <div className="hm-how">
          <div className="hm-sec-head light">
            <h2 id="hm-how-title"><Icon name="play" size={22} />كيف تعمل؟</h2>
            <p>ثلاث خطوات من البرنامج إلى التقرير.</p>
          </div>
          <ol className="hm-steps">
            {STEPS.map((s) => (
              <li key={s.n}>
                <span className="hm-stepn">{s.n}</span>
                <span className="hm-stepico"><Icon name={s.icon} size={20} /></span>
                <b>{s.title}</b>
                <p>{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 5) شركاء النجاح */}
      <section className="hm-sec" aria-labelledby="hm-partners-title">
        <div className="hm-sec-head">
          <h2 id="hm-partners-title"><Icon name="link" size={22} />شركاء النجاح</h2>
          <p>نفخر بالشراكة مع المؤسسات التعليمية والتدريبية.</p>
        </div>
        <div className="hm-partners">
          {PARTNERS.map((p) => (
            <article key={p.logo} className="hm-partner">
              <div className="hm-plogo"><img src={p.logo} alt={p.name} loading="lazy" style={{ maxHeight: p.wide ? 86 : 104 }} /></div>
              <span className="hm-ptype">{p.type}</span>
              <h3>{p.name}</h3>
              <p dir="ltr">{p.en}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 6) التذييل */}
      <footer className="hm-foot">
        <div className="hm-foot-in">
          <div>
            <b><Icon name="school" size={18} />بوابة التميز للتعليم والتطوير</b>
            <p>Excellence Portal for Education &amp; Development — منصة الجودة والتقييم</p>
          </div>
          <nav className="hm-foot-links" aria-label="روابط سريعة">
            <Link href="/login">دخول الإدارة</Link>
            <Link href="/evaluate/daily">التقييم اليومي</Link>
            <Link href="/evaluate/final">التقييم النهائي</Link>
            <Link href="/student">بوابة المتدرب</Link>
            <Link href="/verify">التحقق من الشهادات</Link>
          </nav>
        </div>
        <div className="hm-copy">© {new Date().getFullYear()} جامعة الأمير مقرن بن عبدالعزيز — المركز العالمي لتعليم اللغة العربية. جميع الحقوق محفوظة.</div>
      </footer>
    </main>
  );
}

const CSS = `
.hm{--navy:#0f2a4e;--navy-2:#163b6e;--teal:#0b8a83;--teal-soft:#e6f4f3;--teal-line:#b7e1dd;--gold:#c9a24b;--gold-soft:#fbf5e4;--bg:#f3f6fa;--line:#e4eaf2;--line-2:#cfd9e6;--ink:#0f172a;--ink-2:#334155;--muted:#64748b;--ok:#15803d;--ok-soft:#eafaf0;--info:#1d4ed8;--info-soft:#eef4ff;--warn:#b45309;--warn-soft:#fff7e6;--r:16px;--sh:0 1px 2px rgba(15,42,78,.05),0 8px 24px rgba(15,42,78,.06);
  background:var(--bg);min-height:100vh;color:var(--ink);font-family:inherit;}
.hm *{box-sizing:border-box;}
.hm a{text-decoration:none;color:inherit;}

/* hero */
.hm-hero{background:var(--navy);color:#fff;position:relative;overflow:hidden;border-bottom:5px solid var(--gold);}
.hm-hero::before{content:"";position:absolute;width:520px;height:520px;border-radius:50%;background:rgba(255,255,255,.04);right:-180px;top:-220px;}
.hm-hero::after{content:"";position:absolute;width:360px;height:360px;border-radius:50%;background:rgba(11,138,131,.18);left:-120px;bottom:-160px;}
.hm-hero-in{position:relative;z-index:1;max-width:1100px;margin:0 auto;padding:56px 24px 48px;text-align:center;}
.hm-logos{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;margin-bottom:26px;}
.hm-logo{background:#fff;border-radius:14px;padding:10px 16px;display:inline-flex;align-items:center;justify-content:center;height:72px;min-width:120px;box-shadow:0 10px 28px rgba(0,0,0,.18);}
.hm-logo img{max-height:52px;max-width:150px;width:auto;object-fit:contain;}
.hm-logo.wide img{max-width:190px;max-height:44px;}
.hm-kicker{font-size:12px;letter-spacing:2.5px;text-transform:uppercase;color:#f2d99a;font-weight:800;margin-bottom:12px;}
.hm-hero h1{margin:0;font-size:46px;font-weight:900;line-height:1.25;}
.hm-lead{margin:18px auto 0;max-width:760px;font-size:18px;line-height:1.9;color:#d2e2ee;font-weight:500;}
.hm-cta{display:flex;justify-content:center;flex-wrap:wrap;gap:12px;margin-top:30px;}
.hm-btn{display:inline-flex;align-items:center;gap:9px;padding:13px 20px;border-radius:12px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);color:#fff;font-weight:800;font-size:15px;transition:background .15s,transform .15s;}
.hm-btn:hover{background:rgba(255,255,255,.18);transform:translateY(-1px);}
.hm-btn.primary{background:var(--teal);border-color:var(--teal);box-shadow:0 10px 24px rgba(11,138,131,.35);}
.hm-btn.primary:hover{background:#0fa39a;}
.hm-badges{display:flex;justify-content:center;flex-wrap:wrap;gap:10px 22px;margin-top:28px;color:#c9d6e5;font-size:13px;font-weight:700;}
.hm-badges span{display:inline-flex;align-items:center;gap:6px;}
.hm-badges svg{color:#f2d99a;}

/* sections */
.hm-sec{max-width:1280px;margin:0 auto;padding:48px 24px 0;}
.hm-sec-head{text-align:center;margin-bottom:26px;}
.hm-sec-head h2{margin:0;font-size:28px;font-weight:900;color:var(--navy);display:inline-flex;align-items:center;gap:10px;}
.hm-sec-head h2 svg{color:var(--teal);}
.hm-sec-head p{margin:8px 0 0;color:var(--muted);font-size:15px;font-weight:600;}
.hm-sec-head.light h2,.hm-sec-head.light p{color:#fff;}
.hm-sec-head.light h2 svg{color:#f2d99a;}
.hm-sec-head.light p{color:#d2e2ee;}

/* quick cards */
.hm-quick{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
.hm-qcard{position:relative;background:#fff;border:1px solid var(--line);border-top:4px solid var(--teal);border-radius:var(--r);padding:22px 20px 18px;display:flex;flex-direction:column;gap:4px;box-shadow:var(--sh);transition:transform .15s,box-shadow .15s;}
.hm-qcard:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(15,42,78,.12);}
.hm-qcard.primary{border-top-color:var(--navy);}
.hm-qico{width:50px;height:50px;border-radius:14px;background:var(--teal-soft);color:var(--teal);display:inline-flex;align-items:center;justify-content:center;margin-bottom:10px;}
.hm-qcard.primary .hm-qico{background:#e8eef7;color:var(--navy);}
.hm-qcard b{font-size:17px;font-weight:800;color:var(--navy);}
.hm-qcard small{color:var(--muted);font-size:12px;font-weight:600;direction:ltr;text-align:start;}
.hm-qarrow{position:absolute;inset-inline-end:16px;top:22px;color:var(--line-2);transform:scaleX(-1);transition:color .15s;}
.hm-qcard:hover .hm-qarrow{color:var(--teal);}

/* features */
.hm-feats{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;}
.hm-feat{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:22px;box-shadow:var(--sh);border-inline-start:4px solid var(--teal);}
.hm-feat.navy{border-inline-start-color:var(--navy);} .hm-feat.gold{border-inline-start-color:var(--gold);} .hm-feat.info{border-inline-start-color:var(--info);} .hm-feat.ok{border-inline-start-color:var(--ok);} .hm-feat.warn{border-inline-start-color:var(--warn);}
.hm-fico{width:46px;height:46px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;background:var(--teal-soft);color:var(--teal);margin-bottom:12px;}
.hm-feat.navy .hm-fico{background:#e8eef7;color:var(--navy);} .hm-feat.gold .hm-fico{background:var(--gold-soft);color:#8a6a14;} .hm-feat.info .hm-fico{background:var(--info-soft);color:var(--info);} .hm-feat.ok .hm-fico{background:var(--ok-soft);color:var(--ok);} .hm-feat.warn .hm-fico{background:var(--warn-soft);color:var(--warn);}
.hm-feat h3{margin:0 0 6px;font-size:17px;font-weight:800;color:var(--navy);}
.hm-feat p{margin:0;color:var(--ink-2);font-size:14px;line-height:1.8;font-weight:500;}

/* how it works */
.hm-how{background:var(--navy);border-radius:20px;padding:36px 28px;border-inline-start:6px solid var(--gold);}
.hm-steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;counter-reset:s;}
.hm-steps li{position:relative;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:22px 20px 18px;color:#fff;}
.hm-stepn{position:absolute;inset-inline-end:16px;top:14px;width:30px;height:30px;border-radius:50%;background:var(--gold);color:var(--navy);display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;}
.hm-stepico{width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,.12);display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;color:#fff;}
.hm-steps b{display:block;font-size:17px;font-weight:800;margin-bottom:6px;}
.hm-steps p{margin:0;color:#d2e2ee;font-size:14px;line-height:1.8;}

/* partners */
.hm-partners{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;}
.hm-partner{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:22px;text-align:center;box-shadow:var(--sh);display:flex;flex-direction:column;align-items:center;}
.hm-plogo{width:100%;height:140px;border-radius:12px;background:#f8fafc;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;padding:16px;margin-bottom:16px;}
.hm-plogo img{max-width:100%;width:auto;height:auto;object-fit:contain;}
.hm-ptype{display:inline-block;font-size:12px;font-weight:800;color:var(--teal);background:var(--teal-soft);border:1px solid var(--teal-line);border-radius:999px;padding:3px 12px;margin-bottom:10px;}
.hm-partner h3{margin:0;color:var(--navy);font-weight:800;font-size:17px;line-height:1.5;}
.hm-partner p{margin:6px 0 0;color:var(--muted);font-size:13px;font-weight:600;}

/* footer */
.hm-foot{margin-top:56px;background:var(--navy);color:#fff;border-top:5px solid var(--gold);}
.hm-foot-in{max-width:1280px;margin:0 auto;padding:34px 24px 20px;display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap;}
.hm-foot b{display:inline-flex;align-items:center;gap:8px;font-size:18px;font-weight:800;}
.hm-foot b svg{color:#f2d99a;}
.hm-foot p{margin:8px 0 0;color:#c9d6e5;font-size:13px;font-weight:600;}
.hm-foot-links{display:flex;gap:8px 20px;flex-wrap:wrap;align-items:center;}
.hm-foot-links a{color:#e2eaf3;font-weight:700;font-size:14px;border-bottom:1px solid transparent;}
.hm-foot-links a:hover{color:#fff;border-bottom-color:var(--gold);}
.hm-copy{border-top:1px solid rgba(255,255,255,.12);text-align:center;padding:14px 24px;color:#9fb3c8;font-size:12.5px;font-weight:600;}

@media(max-width:900px){.hm-steps{grid-template-columns:1fr;}.hm-quick{grid-template-columns:repeat(2,1fr);gap:12px;}.hm-qcard{padding:16px 14px 14px;}.hm-qico{width:42px;height:42px;}.hm-qcard b{font-size:15px;}.hm-hero h1{font-size:34px;}.hm-lead{font-size:16px;}.hm-sec{padding-top:36px;}.hm-sec-head h2{font-size:24px;}}
@media(max-width:560px){.hm-hero-in{padding:40px 16px 36px;}.hm-logo{height:60px;min-width:96px;padding:8px 12px;}.hm-logo img{max-height:42px;}.hm-cta .hm-btn{flex:1 1 45%;justify-content:center;}.hm-sec{padding-inline:14px;}}
`;
