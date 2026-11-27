'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أبواب أَثَر الأربعة على الرئيسية (هوية v1.2 · 2026-11-23 · P86-ب 2026-11-27): مِعيار · اقْرَأْ · البرامج والدبلومات · بَيان — و«تحقّق» ضمن الخدمات (لا تكرار)
 *  كل باب بطاقة تنقلب: الوجه = ما هو، الظهر = شرط الدخول (مجّاني / يتطلّب تحديد المستوى / اشتراك) + الدخول.
 *  اقْرَأْ يحمل نقطة «جديد» الذهبية؛ شرطه يظهر بوضوح (تحديد المستوى أو حلقة مجّانية) — لا مفاجآت بعد النقر.
 */
import Link from 'next/link';
import { Flip, useTilt, Reveal } from '../../lib/ui/motion';
import { Icon } from '../../lib/ui/icons';
import type { Lang } from '../../lib/portal/content';

type Door = { id: string; href: string; icon: string; title: [string, string]; what: [string, string]; cond: [string, string]; cta: [string, string]; grad: string; ink: string; isNew?: boolean; free?: boolean; testId: string };
export const HOME_DOORS: Door[] = [
  { id: 'miaar', href: '/miaar', icon: 'target', title: ['مِعيار', 'Miaar'], what: ['قيّم نفسك — 3 دقائق', 'Assess yourself — 3 minutes'], cond: ['مجّاني · تحصل على مستواك بلونه وشهادة مستوى قابلة للتحقّق. التقييم المشهود (بشاهد) يُفتح للجهات وبالاشتراك.', 'Free · get your level in its colour and a verifiable level certificate. Witnessed assessment opens for organisations and by subscription.'], cta: ['ابدأ التقييم', 'Start the assessment'], grad: 'linear-gradient(135deg,#E8795C,#D4614A)', ink: '#fff', free: true, testId: 'door-miaar' },
  { id: 'iqra', href: '/iqra/start', icon: 'book', title: ['اقْرَأْ', 'Iqra'], what: ['تعلّم العربية على مستواك', 'Learn Arabic at your level'], cond: ['الدخول حاليًّا بتصريح من إدارة أَثَر إلى حين إطلاق الاشتراكات · جرّب دقيقتين مجّانًا ثم اطلب تصريحك، ويُشترط تحديد المستوى في مِعيار.', 'Access is currently by permit from the Athar team until subscriptions launch · try two minutes free, then request your permit; a Miaar level is required.'], cta: ['جرّب دقيقتين', 'Try two minutes'] /* P79 */, grad: 'linear-gradient(135deg,#D9A866,#E8795C)', ink: '#22101F', isNew: true, testId: 'door-iqra' },
  { id: 'programs', href: '/programs', icon: 'star', title: ['البرامج والدبلومات', 'Programs & diplomas'], what: ['مسارات موثّقة، شهادة لكل برنامج', 'Documented paths, a certificate per program'], cond: ['التسجيل مفتوح للأفراد والجهات · الدبلوم مسار برامج متوائمة: كل برنامج تُكمله تحمل شهادته معك حتى لو توقّفت في منتصف الطريق.', 'Open to individuals and organisations · a diploma is a path of twinned programs: every program you complete gives you its certificate, even if you pause midway.'], cta: ['تصفّح البرامج', 'Browse programs'], grad: 'linear-gradient(135deg,#D4614A,#6A3350)', ink: '#F6EBE0', testId: 'door-programs' },
  { id: 'bayan', href: '/kids', icon: 'kids', title: ['بَيان — للأطفال', 'Bayan — for kids'], what: ['العربيّة لأطفال ٤–٩ سنوات: لغةٌ تُحَبّ… وأثرٌ يبقى', 'Arabic for ages 4–9: a language to love'], cond: ['جلسة تجريبيّة مجّانيّة (٢٠ دقيقة، بصوت الشاشة) للمسار ٤–٦ سنوات · مساران: أطفال عرب وغير ناطقين · مستويات بَذرة → بُرعم → غُصن → شجرة · لوليّ الأمر لوحة متابعة ودليل.', 'Free 20-minute demo session (sound on) for ages 4–6 · two tracks: Arab and non-Arabic-speaking children · levels Seed → Bud → Branch → Tree · parent dashboard and guide.'], cta: ['جرّب جلسة مجّانًا', 'Try a free session'], grad: 'linear-gradient(135deg,#6A3350,#3A1F36)', ink: '#F6EBE0', free: true, testId: 'door-bayan' },
];

function DoorCard({ d, lang, i }: { d: Door; lang: Lang; i: number }) {
  const ar = lang === 'ar'; const tilt = useTilt(5);
  const { ref: _r, ...tiltProps } = tilt;
  return (
    <Reveal className="hd-item" delay={i * 90} as="li">
      <div {...tiltProps}>
        <Flip minHeight={224} className="hd-flip" testId={d.testId} label={ar ? `${d.title[0]} — اقلب لمعرفة شرط الدخول` : `${d.title[1]} — flip for entry condition`}
          front={<div className="hd-face" style={{ background: d.grad, color: d.ink }}>
            <div className="hd-top"><span className="hd-ico"><Icon name={d.icon as any} size={22} /></span>{d.isNew && <span className="hd-new"><i className="ath-new" />{ar ? 'جديد' : 'New'}</span>}{d.free && !d.isNew && <span className="hd-free">{ar ? 'مجّاني' : 'Free'}</span>}</div>
            <b>{ar ? d.title[0] : d.title[1]}</b>
            <p>{ar ? d.what[0] : d.what[1]}</p>
            <small className="hd-hint"><Icon name="refresh" size={12} /> {ar ? 'اقلب: شرط الدخول' : 'Flip: entry condition'}</small>
          </div>}
          back={<div className="hd-face back">
            <b>{ar ? d.title[0] : d.title[1]}</b>
            <p>{ar ? d.cond[0] : d.cond[1]}</p>
          </div>}
        />
        <Link href={d.href} className="pt-btn small hd-cta" data-testid={`${d.testId}-cta`}>{ar ? d.cta[0] : d.cta[1]} <Icon name="arrow" size={14} /></Link>
      </div>
    </Reveal>
  );
}

export default function HomeDoors({ lang }: { lang: Lang }) {
  const ar = lang === 'ar';
  return (
    <section className="pt-sec hd" id="doors" data-testid="home-doors">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pt-wrap">
        <div className="hd-head"><span className="pt-kicker"><Icon name="compass" size={14} /> {ar ? 'أبواب أَثَر' : 'The doors of Athar'}</span><h2>{ar ? 'من أين تبدأ؟ أربعة أبواب للتعلّم، وكل باب يخبرك شرطه قبل أن تطرقه' : 'Where to begin? Four learning doors — each tells you its condition before you knock'}</h2></div>
        <ul className="hd-grid">{HOME_DOORS.map((d, i) => <DoorCard key={d.id} d={d} lang={lang} i={i} />)}</ul>
      </div>
    </section>
  );
}

const CSS = `
.hd{padding:34px 0 10px;position:relative;z-index:1}
.hd-head h2{font-size:clamp(20px,2.6vw,28px);color:var(--plum);margin:6px 0 18px}
.hd-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
@media(max-width:980px){.hd-grid{grid-template-columns:1fr 1fr}}@media(max-width:560px){.hd-grid{grid-template-columns:1fr}}
.hd-item{display:block!important;padding:0!important;margin:0!important}.hd-item>div{display:grid;gap:10px;width:100%;grid-template-columns:1fr}.hd-flip{width:100%}
.hd-flip{border-radius:20px;box-shadow:0 14px 34px rgba(42,22,38,.14)}
.hd-face{position:absolute;inset:0;border-radius:20px;padding:18px 18px 16px;display:flex;flex-direction:column;gap:6px}
.hd-face b{font-size:26px;font-weight:900;line-height:1.1;margin-top:6px}
.hd-face p{margin:0;font-size:14px;line-height:1.55;opacity:.95}
.hd-face.back{background:#FBF4EE;color:#2A1626;border:1px solid #EADFD6}
.hd-face.back b{font-size:18px;color:var(--plum)}
.hd-face.back p{font-size:13.5px;color:#4A3645}
.hd-top{display:flex;justify-content:space-between;align-items:center}
.hd-ico{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.22)}
.hd-new,.hd-free{font-size:12px;font-weight:800;border-radius:999px;padding:3px 10px;background:rgba(34,16,31,.28);color:#fff;display:inline-flex;align-items:center}
.hd-face[style*="22101F"] .hd-new,.hd-face[style*="22101F"] .hd-free{background:rgba(34,16,31,.14);color:#22101F}
.hd-hint{margin-top:auto;font-size:12px;opacity:.8;display:inline-flex;gap:4px;align-items:center}
.hd-cta,.hd-cta:visited{justify-content:center;background:var(--plum);color:#fff!important}
.hd-cta:hover{background:var(--plum-soft)}
`;
