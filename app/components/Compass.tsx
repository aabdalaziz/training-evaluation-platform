'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * هـ-5 «بوصلة أَثَر» — واجهة الدخول: ما يحتاجه كلُّ داخلٍ في أول ثانية.
 *  • TourVeil   : الفيديو التعريفي (دقيقة واحدة · /brand/athar-tour.mp4) يُعرض تلقائيًّا لكل من يدخل البوّابة أول مرّة على جهازه،
 *                 ويبقى متاحًا دائمًا من زرّ «الجولة» في الرأس وفي الواجهة. كتم تلقائي حتى يأذن المستخدم بالصوت (قيود المتصفّحات).
 *  • NowStrip   : خدمة التوقيت والتاريخ — الساعة الحيّة · التاريخ الهجري (أمّ القرى) · الميلادي · اليوم · توقيت الرياض وتوقيتك المحلي إن اختلف.
 *  • QuickServices : الخدمات التي يحتاجها المتعامل دائمًا — تحقّق · تسجيل · مِعيار · اقْرَأْ · استشارة · الجلسات · الرسوم · الجهات · المساعدة · التواصل.
 *  • WhereTo    : «من أنت؟» — بابك الصحيح بنقرة: متعلّم · جهة · خبير/مدرّب · طاقم.
 *  لا جداول · لا ذكاء اصطناعي · كل شيء محليّ في المتصفّح.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import type { Lang } from '../../lib/portal/content';

export const TOUR_SRC = '/brand/athar-tour.mp4';
export const TOUR_POSTER = '/brand/athar-tour.jpg';
export const TOUR_SECONDS = 92; // هـ-6-ج: الفيلم V2 (91.5 ث)
const TOUR_KEY = 'athar_tour_seen';
const TOUR_EVENT = 'athar:tour';
export const RIYADH_TZ = 'Asia/Riyadh';

/* ───────────────────────── التوقيت والتاريخ ───────────────────────── */
export type NowParts = { time: string; seconds: string; hijri: string; greg: string; weekday: string; local: string | null; tz: string };
export function nowParts(d: Date, lang: Lang): NowParts {
  const loc = lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB';
  const time = new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: RIYADH_TZ }).format(d);
  const seconds = new Intl.DateTimeFormat('en-GB', { second: '2-digit', timeZone: RIYADH_TZ }).format(d).padStart(2, '0');
  const hijri = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-GB-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric', timeZone: RIYADH_TZ }).format(d);
  const greg = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric', timeZone: RIYADH_TZ }).format(d);
  const weekday = new Intl.DateTimeFormat(loc, { weekday: 'long', timeZone: RIYADH_TZ }).format(d);
  let tz = RIYADH_TZ; let local: string | null = null;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || RIYADH_TZ;
    if (tz && tz !== RIYADH_TZ) {
      const lt = new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(d);
      if (lt !== time) local = lt;
    }
  } catch { /* ignore */ }
  return { time, seconds, hijri, greg, weekday, local, tz };
}

export function NowStrip({ lang, compact = false }: { lang: Lang; compact?: boolean }) {
  const ar = lang === 'ar';
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  if (!now) return <span className={`cp-now ${compact ? 'compact' : ''}`} data-testid="cp-now" aria-hidden="true" />;
  const p = nowParts(now, lang);
  const title = `${p.weekday} · ${p.hijri} · ${p.greg} · ${ar ? 'توقيت الرياض' : 'Riyadh time'}`;
  if (compact) {
    return (
      <Link href="/#compass" className="cp-now compact" title={title} aria-label={title} data-testid="cp-now">
        <Icon name="clock" size={14} /><b>{p.time}</b><small>{p.hijri.replace(/\s*\d{3,4}\s*(هـ|AH)?\s*$/, '')}</small>
      </Link>
    );
  }
  return (
    <div className="cp-now" data-testid="cp-now" role="group" aria-label={ar ? 'التوقيت والتاريخ' : 'Time and date'}>
      <div className="cp-clock"><Icon name="clock" size={18} /><b>{p.time}<i>:{p.seconds}</i></b><span>{ar ? 'توقيت الرياض' : 'Riyadh'}{p.local ? <> · {ar ? 'عندك' : 'yours'} <b>{p.local}</b></> : null}</span></div>
      <div className="cp-dates">
        <span className="cp-day">{p.weekday}</span>
        <span><Icon name="calendar" size={14} /> {p.hijri}</span>
        <span><Icon name="globe" size={14} /> {p.greg}</span>
      </div>
    </div>
  );
}

/* ───────────────────────── الجولة التعريفية ───────────────────────── */
export function openTour() { try { window.dispatchEvent(new CustomEvent(TOUR_EVENT)); } catch { /* ignore */ } }

export function TourButton({ lang, compact = false, className = '' }: { lang: Lang; compact?: boolean; className?: string }) {
  const ar = lang === 'ar';
  const label = ar ? 'الجولة التعريفية — دقيقة' : 'Intro tour — 1 min';
  if (compact) return <button type="button" className={`cp-tourbtn compact ${className}`} onClick={openTour} title={label} aria-label={label} data-testid="cp-tour-open"><Icon name="play" size={15} /><span>{ar ? 'الجولة' : 'Tour'}</span></button>;
  return <button type="button" className={`cp-tourbtn ${className}`} onClick={openTour} data-testid="cp-tour-open"><Icon name="play" size={16} /> {label}</button>;
}

/** يظهر تلقائيًّا مرّة لكل جهاز (بعد ستار الأثر بثانيتين)، ويُفتح يدويًّا من أي زرّ «الجولة» */
export function TourVeil({ lang }: { lang: Lang }) {
  const ar = lang === 'ar';
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(true);
  const [auto, setAuto] = useState(false);
  const vid = useRef<HTMLVideoElement | null>(null);
  const close = useCallback(() => { setOpen(false); try { vid.current?.pause(); } catch { /* ignore */ } }, []);
  useEffect(() => {
    const on = () => { setAuto(false); setMuted(false); setOpen(true); };
    window.addEventListener(TOUR_EVENT, on);
    let first = false; try { first = localStorage.getItem(TOUR_KEY) !== '1'; } catch { /* ignore */ }
    let reduce = false; try { reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches; } catch { /* ignore */ }
    const noAuto = document.documentElement.dataset.engrave === 'none' || /\/(evaluate|survey|impact|followup|attend|m|e|g|p|lv|kids)\//.test(location.pathname);
    let t: ReturnType<typeof setTimeout> | null = null;
    if (first && !reduce && !noAuto) { t = setTimeout(() => { setAuto(true); setMuted(true); setOpen(true); try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* ignore */ } }, 2200); }
    return () => { window.removeEventListener(TOUR_EVENT, on); if (t) clearTimeout(t); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', k);
    const v = vid.current; if (v) { v.muted = muted; v.currentTime = 0; v.play().catch(() => { /* المتصفّح قد يمنع التشغيل بلا لمسة */ }); }
    return () => window.removeEventListener('keydown', k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const unmute = () => { const v = vid.current; if (!v) return; v.muted = false; setMuted(false); v.play().catch(() => {}); };
  if (!open) return null;
  return (
    <div className="cp-tour" role="dialog" aria-modal="true" aria-label={ar ? 'الجولة التعريفية في أَثَر' : 'Athar intro tour'} data-testid="cp-tour" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="cp-tourbox">
        <header>
          <b><Icon name="play" size={15} /> {ar ? 'جولة في أَثَر — دقيقة واحدة' : 'A one-minute tour of Athar'}</b>
          <button type="button" className="cp-x" onClick={close} aria-label={ar ? 'إغلاق' : 'Close'} data-testid="cp-tour-close"><Icon name="x" size={16} /></button>
        </header>
        <div className="cp-video">
          <video ref={vid} src={TOUR_SRC} poster={TOUR_POSTER} playsInline controls preload="metadata" onEnded={close} />
          {muted && <button type="button" className="cp-unmute" onClick={unmute} data-testid="cp-tour-unmute"><Icon name="mic" size={16} /> {ar ? 'شغّل الصوت' : 'Turn sound on'}</button>}
        </div>
        <footer>
          <span className="cp-muted">{auto ? (ar ? 'تُعرض مرّة واحدة عند أول دخول — وتجدها دائمًا في زرّ «الجولة» أعلى الصفحة.' : 'Shown once on first visit — always available from the “Tour” button above.') : (ar ? 'النصّ مكتوب داخل الفيديو · Esc للإغلاق' : 'Captions are burned in · Esc to close')}</span>
          <button type="button" className="pt-btn small" onClick={close} data-testid="cp-tour-skip">{ar ? 'تخطَّ وادخل' : 'Skip and enter'}</button>
        </footer>
      </div>
    </div>
  );
}

/* ───────────────────────── الخدمات السريعة ───────────────────────── */
export type QuickService = { key: string; href: string; icon: string; ar: string; en: string; hint_ar: string; hint_en: string; tone: 'coral' | 'sea' | 'sand' | 'plum' };
export const QUICK_SERVICES: QuickService[] = [
  /* P86: أيقونة لكلّ خدمة (15 = 3 صفوف × 5) — الصفّ الأوّل «ابدأ»: بوّابة الدخول ثمّ ما يبدأ به المستفيد · الثاني «الخدمات» · الثالث «التحقّق والدعم» */
  { key: 'login', href: '/login', icon: 'door', ar: 'بوّابة الدخول', en: 'Sign-in gate', hint_ar: 'متعلّم · جهة · خبير · طاقم', hint_en: 'Learner · org · expert · staff', tone: 'plum' },
  { key: 'programs', href: '/programs', icon: 'book', ar: 'سجّل في برنامج', en: 'Enrol in a program', hint_ar: 'البرامج المفتوحة الآن', hint_en: 'Open programs now', tone: 'coral' },
  { key: 'bayan', href: '/kids', icon: 'kids', ar: 'بَيان — للأطفال', en: 'Bayan — for kids', hint_ar: 'العربيّة لأطفال ٤–٩ سنوات', hint_en: 'Arabic for ages 4–9', tone: 'sand' },
  { key: 'iqra', href: '/iqra/start', icon: 'school', ar: 'تعلّم — اقْرَأْ', en: 'Learn — Iqra', hint_ar: 'حلقة مجّانية على مستواك', hint_en: 'A free lesson at your level', tone: 'sea' },
  { key: 'miaar', href: '/miaar', icon: 'scale', ar: 'قيّم مستواك — مِعيار', en: 'Assess your level — Miaar', hint_ar: '3 دقائق · بلا رسوم', hint_en: '3 minutes · free', tone: 'plum' },
  { key: 'resources', href: '/resources', icon: 'kit', ar: 'مستودع الحقائب', en: 'Resource kits', hint_ar: 'حقائب تدريبيّة وأدوات جاهزة', hint_en: 'Training kits and ready tools', tone: 'coral' },
  { key: 'sessions', href: '/live', icon: 'laptop', ar: 'جلسات اليوم', en: "Today's sessions", hint_ar: 'المباشر والقادم', hint_en: 'Live and upcoming', tone: 'sea' },
  { key: 'sim', href: '/sim', icon: 'play', ar: 'تدرّب بالمحاكاة', en: 'Simulation training', hint_ar: 'موقف حقيقيّ في 3 دقائق', hint_en: 'A real situation in 3 min', tone: 'sand' },
  { key: 'consulting', href: '/consulting', icon: 'chat', ar: 'اطلب استشارة', en: 'Request consulting', hint_ar: 'من الطلب إلى عرض السعر', hint_en: 'From request to quote', tone: 'plum' },
  { key: 'org', href: '/org', icon: 'executive', ar: 'بوّابة الجهات', en: 'Organizations portal', hint_ar: 'منسوبوكم وأثر برامجكم', hint_en: 'Your people and impact', tone: 'coral' },
  { key: 'verify', href: '/verify', icon: 'shield', ar: 'تحقّق من شهادة', en: 'Verify a certificate', hint_ar: 'رمز أو QR — نتيجة فورية', hint_en: 'Code or QR — instant', tone: 'sea' },
  { key: 'pay', href: '/pay', icon: 'doc', ar: 'الرسوم والفواتير', en: 'Fees & invoices', hint_ar: 'ادفع أو حمّل فاتورتك', hint_en: 'Pay or download', tone: 'sand' },
  { key: 'councils', href: '/councils', icon: 'circle_users', ar: 'مجالس الأقران', en: 'Peer councils', hint_ar: 'مجلس حول موقف حقيقيّ', hint_en: 'A council around a real case', tone: 'plum' },
  { key: 'help', href: '/help', icon: 'question', ar: 'المساعدة', en: 'Help', hint_ar: 'إجابات خطوة بخطوة', hint_en: 'Step-by-step answers', tone: 'coral' },
  { key: 'contact', href: '/contact', icon: 'mail', ar: 'تواصل معنا', en: 'Contact us', hint_ar: 'بريد · هاتف · موقع', hint_en: 'Email · phone · location', tone: 'sea' },
];

export function QuickServices({ lang }: { lang: Lang }) {
  const ar = lang === 'ar';
  return (
    <div className="cp-quick" data-testid="cp-quick">
      {QUICK_SERVICES.map((s) => (
        <Link key={s.key} href={s.href} className={`cp-q ${s.tone}`} data-testid={`cp-q-${s.key}`}>
          <i><Icon name={s.icon as any} size={20} /></i>
          <b>{ar ? s.ar : s.en}</b>
          <small>{ar ? s.hint_ar : s.hint_en}</small>
        </Link>
      ))}
    </div>
  );
}

/* ───────────────────────── من أنت؟ ───────────────────────── */
export const WHERE_TO = [
  { key: 'learner', href: '/me', icon: 'users', ar: 'متعلّم', en: 'Learner', sub_ar: 'رحلتي · شهاداتي · مِراني', sub_en: 'My journey · certificates' },
  { key: 'org', href: '/org', icon: 'executive', ar: 'جهة', en: 'Organization', sub_ar: 'منسوبونا · الأثر · العقود', sub_en: 'Our people · impact · contracts' },
  { key: 'expert', href: '/trainers', icon: 'award', ar: 'خبير أو مدرّب', en: 'Expert or trainer', sub_ar: 'هيئة أَثَر · سيرتي · دفتر اليوم', sub_en: 'Athar faculty · my CV · day book' },
  { key: 'staff', href: '/dashboard', icon: 'dashboard', ar: 'طاقم أَثَر', en: 'Athar staff', sub_ar: 'مركز القيادة · الأجنحة', sub_en: 'Command center · wings' },
] as const;

export function WhereTo({ lang }: { lang: Lang }) {
  const ar = lang === 'ar';
  return (
    <div className="cp-where" data-testid="cp-where">
      <span className="cp-whereq"><Icon name="compass" size={16} /> {ar ? 'من أنت؟ — بابك بنقرة' : 'Who are you? — your door in one click'}</span>
      {WHERE_TO.map((w) => <Link key={w.key} href={w.href} className="cp-w" data-testid={`cp-w-${w.key}`}><Icon name={w.icon as any} size={16} /><b>{ar ? w.ar : w.en}</b><small>{ar ? w.sub_ar : w.sub_en}</small></Link>)}
    </div>
  );
}

/* ───────────────────────── القسم الكامل في الواجهة ───────────────────────── */
export default function CompassSection({ lang }: { lang: Lang }) {
  const ar = lang === 'ar';
  return (
    <section className="pt-sec cp-sec" id="compass" aria-label={ar ? 'بوصلة أَثَر' : 'Athar compass'} data-testid="cp-section">
      <div className="pt-wrap">
        <div className="cp-top">
          <NowStrip lang={lang} />
          <TourButton lang={lang} />
        </div>
        <QuickServices lang={lang} />
        <WhereTo lang={lang} />
      </div>
    </section>
  );
}

export const COMPASS_CSS = `
.cp-sec{padding:14px 0 6px;position:relative;z-index:2}
.cp-top{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:14px}
.cp-now{display:flex;align-items:center;gap:18px;flex-wrap:wrap;background:#FBF4EE;border:1px solid #EADFD6;border-radius:16px;padding:10px 16px;color:#2A1626;min-height:44px}
.cp-clock{display:flex;align-items:center;gap:10px}.cp-clock b{font-size:30px;font-weight:900;letter-spacing:.5px;line-height:1;color:#3A1F36;font-variant-numeric:tabular-nums}
.cp-clock b i{font-style:normal;font-size:15px;color:#8E7F8A;font-weight:700}.cp-clock span{font-size:12px;color:#5C4858;display:grid}.cp-clock span b{font-size:12px;color:#3A1F36}
.cp-dates{display:flex;gap:14px;flex-wrap:wrap;font-size:14px;font-weight:700;color:#4A3645}.cp-dates span{display:inline-flex;align-items:center;gap:6px}
.cp-day{color:#D4614A;font-weight:900}
.cp-now.compact{gap:6px;padding:5px 10px;border-radius:999px;text-decoration:none;min-height:0;color:#3A1F36}.cp-now.compact b{font-size:14px;font-weight:900;font-variant-numeric:tabular-nums}.cp-now.compact small{font-size:11px;color:#8E7F8A;font-weight:700}
.cp-tourbtn{display:inline-flex;align-items:center;gap:8px;border:0;cursor:pointer;background:#3A1F36;color:#F6EBE0;font-weight:900;font-size:14px;padding:11px 16px;border-radius:999px;box-shadow:0 8px 24px rgba(58,31,54,.22)}
.cp-tourbtn:hover{background:#4A2946}.cp-tourbtn.compact{padding:6px 10px;font-size:13px;box-shadow:none;background:#F6EBE0;color:#3A1F36;border:1px solid #EADFD6}.cp-tourbtn.compact:hover{background:#F1D9A8}
.cp-quick{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.cp-q{display:grid;grid-template-rows:auto auto auto;gap:6px;text-decoration:none;background:#FBF4EE;border:1px solid #EADFD6;border-radius:16px;padding:14px 14px 12px;color:#2A1626;transition:transform .15s,box-shadow .15s;position:relative;overflow:hidden}
.cp-q:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(58,31,54,.12)}
.cp-q i{display:inline-flex;width:40px;height:40px;border-radius:12px;align-items:center;justify-content:center;color:#fff}
.cp-q b{font-size:14px;font-weight:900}.cp-q small{font-size:12px;color:#5C4858}
.cp-q.coral i{background:#D4614A}.cp-q.sea i{background:#5EA8A0}.cp-q.sand i{background:#D9A866}.cp-q.plum i{background:#6A3350}
.cp-q::after{content:"";position:absolute;inset:auto -20px -20px auto;width:70px;height:70px;border-radius:50%;opacity:.12}
.cp-q.coral::after{background:#D4614A}.cp-q.sea::after{background:#5EA8A0}.cp-q.sand::after{background:#D9A866}.cp-q.plum::after{background:#6A3350}
.cp-where{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px;padding:10px 14px;border-radius:16px;background:#3A1F36;color:#F6EBE0}
.cp-whereq{display:inline-flex;align-items:center;gap:8px;font-weight:900;font-size:14px;margin-inline-end:6px}
.cp-w{display:grid;grid-template-columns:auto auto;grid-template-rows:auto auto;column-gap:8px;align-items:center;text-decoration:none;color:#F6EBE0;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:8px 12px}
.cp-w:hover{background:rgba(255,255,255,.16)}.cp-w svg{grid-row:1/3}.cp-w b{font-size:14px;font-weight:900}.cp-w small{font-size:11px;color:#F1D9A8;grid-column:2}
.cp-tour{position:fixed;inset:0;z-index:120;background:rgba(34,16,31,.78);backdrop-filter:blur(6px);display:grid;place-items:center;padding:18px}
.cp-tourbox{width:min(960px,100%);background:#22101F;border-radius:20px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5);color:#F6EBE0;border:1px solid rgba(241,217,168,.25)}
.cp-tourbox header,.cp-tourbox footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px}
.cp-tourbox header b{display:inline-flex;align-items:center;gap:8px;font-size:15px}.cp-x{border:0;background:transparent;color:#F6EBE0;cursor:pointer;padding:6px;border-radius:8px}.cp-x:hover{background:rgba(255,255,255,.12)}
.cp-video{position:relative;background:#000;aspect-ratio:16/9}.cp-video video{width:100%;height:100%;display:block}
.cp-unmute{position:absolute;inset-inline-start:14px;bottom:56px;border:0;cursor:pointer;background:#D9A866;color:#22101F;font-weight:900;padding:9px 14px;border-radius:999px;display:inline-flex;align-items:center;gap:8px;box-shadow:0 8px 20px rgba(0,0,0,.35)}
.cp-muted{font-size:12px;color:#F1D9A8}
@media(max-width:900px){.cp-now.compact small,.cp-tourbtn.compact span{display:none}}
@media(max-width:1000px){.cp-quick{grid-template-columns:repeat(3,1fr)}}
@media(max-width:640px){.cp-quick{grid-template-columns:repeat(2,1fr)}.cp-clock b{font-size:24px}.cp-now{gap:10px}.cp-w small{display:none}}
`;
