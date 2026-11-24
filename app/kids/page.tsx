// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
import type { Metadata } from 'next';
import Link from 'next/link';
import { PortalShell } from '../components/PortalShell';
import { SESSIONS } from '../../lib/kids/sessions';
import { IntroButton } from '../components/kids/IntroButton';

export const metadata: Metadata = { title: 'بَيان — برنامج أَثَر للأطفال', description: 'بَيان: لغةٌ تُحَبّ… وأثرٌ يبقى. برنامج تعليم العربية للأطفال (4–9 سنوات) بشخصيات كرتونية ومواقف حياتية وقيم وقرآن.' };

const CSS = `
.kb{max-width:1040px;margin:0 auto;padding:24px 16px 60px;color:#2A1626}
.kb-hero{display:grid;grid-template-columns:1.05fr .95fr;gap:28px;align-items:center;background:#fff;border:2px solid #F1D9A8;border-radius:28px;padding:28px;box-shadow:0 8px 30px rgba(58,31,54,.06)}
@media (max-width:820px){.kb-hero{grid-template-columns:1fr;padding:18px}}
.kb-k{color:#8E7F8A;margin:0 0 6px;font-size:15px}
.kb-h1{color:#3A1F36;font-size:clamp(30px,4.2vw,46px);line-height:1.25;margin:0 0 10px}
.kb-p{font-size:18px;line-height:1.9;margin:0 0 16px}
.kb-chips{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px}
.kb-chips span{background:#FBF4EE;border:2px solid #F1D9A8;border-radius:999px;padding:6px 14px;font-weight:700;color:#3A1F36}
.kb-cta{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.kb-go{font-size:21px;padding:14px 28px;border-radius:999px;background:#E8795C;color:#fff;text-decoration:none;font-weight:800;box-shadow:0 6px 0 #b9544a;display:inline-block;transition:transform .08s ease,box-shadow .08s ease}
.kb-go:active{transform:translateY(3px);box-shadow:0 3px 0 #b9544a}
.kb-sec{color:#2F6B66;text-decoration:none;font-weight:700;border:2px solid #5EA8A0;border-radius:999px;padding:10px 18px;background:#fff}
.kb-film{position:relative;border-radius:22px;overflow:hidden;border:2px solid #F1D9A8;background:#FBF4EE;aspect-ratio:16/9}
.kb-film video{width:100%;height:100%;display:block;object-fit:cover}
.kb-cap{color:#8E7F8A;font-size:13px;margin:8px 2px 0;text-align:center}
.kb-proof{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:18px 0 6px}
.kb-proof div{background:#fff;border:2px solid #F1D9A8;border-radius:18px;padding:12px;text-align:center}
.kb-proof b{display:block;font-size:26px;color:#3A1F36}.kb-proof span{color:#8E7F8A;font-size:14px}
.kb-h2{color:#3A1F36;margin:26px 0 10px;font-size:24px}
.kb-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.kb-s{display:grid;grid-template-columns:104px 1fr;gap:12px;align-items:center;text-decoration:none;color:#2A1626;border:2px solid #F1D9A8;border-radius:20px;padding:12px;background:#fff;transition:transform .15s ease,box-shadow .15s ease}
@media (hover:hover){.kb-s:hover{transform:translateY(-3px);box-shadow:0 10px 22px rgba(58,31,54,.10)}}
.kb-s img{width:104px;height:78px;object-fit:cover;border-radius:12px}
.kb-s small{color:#8E7F8A;font-size:13px}.kb-s b{display:block;font-size:19px;color:#3A1F36;margin:2px 0 6px}
.kb-s i{font-style:normal;display:inline-block;background:#E8795C;color:#fff;border-radius:999px;padding:5px 13px;font-size:14px}
.kb-night{display:grid;grid-template-columns:140px 1fr;gap:16px;align-items:center;background:#1d1733;color:#FBF4EE;border-radius:22px;padding:16px;margin-top:14px}
@media (max-width:620px){.kb-night{grid-template-columns:1fr}}
.kb-night img{width:140px;height:92px;object-fit:cover;border-radius:14px}
.kb-night h3{margin:0 0 4px;color:#F1D9A8;font-size:20px}.kb-night p{margin:0 0 8px;color:#d9d0e3;font-size:15px}
.kb-night a{color:#1d1733;background:#F1D9A8;text-decoration:none;border-radius:999px;padding:7px 14px;font-weight:700;margin-inline-end:8px;display:inline-block;margin-top:4px}
.kb-foot{color:#8E7F8A;font-size:14px;margin-top:16px;line-height:1.9}
.kb-foot a{color:#2F6B66}
@media (prefers-reduced-motion:reduce){.kb *{transition:none!important}}
`;

/** بَيان — واجهة وليّ الأمر (هـ-6-ث: بطل واحد · وعد واحد · زرّ واحد · فيلم) */
export default function KidsPage() {
  const live = SESSIONS.length;
  const bedtime = SESSIONS.map(s => s.athari.bedtime).find(b => typeof b !== 'string') as { title: string; audio: string; img: string; minutes: number; video?: string } | undefined;
  return (
    <PortalShell>
      <div className="kb" dir="rtl">
        <section className="kb-hero">
          <div>
            <p className="kb-k">برنامج أَثَر للأطفال · 4–9 سنوات · عرب وغير ناطقين</p>
            <h1 className="kb-h1">بَيان — لغةٌ تُحَبّ… وأثرٌ يبقى</h1>
            <p className="kb-p">
              في كلّ جلسة عشرون دقيقة: حكاية يعيشها طفلك مع أَميرَة ومُحَمَّد وياسين وجارهم أَثير، وحرفٌ يلعب به، وقيمةٌ من «مدرسة المصطفى ﷺ»، وآياتٌ يردّدها — ثم بطاقة لك أنت.
              لُؤْلُؤ تسمعه وتجيبه، وجَدّ سالِم يحكي له قصّة قبل النوم.
            </p>
            <div className="kb-chips"><span>🗣️ لغة</span><span>🌱 قيمة</span><span>📖 قرآن</span><span>🌙 قصّة نوم</span></div>
            <div className="kb-cta">
              <Link href="/kids/demo" className="kb-go">جرّب جلسة مجّانًا ▶</Link>
              <Link href="/kids/parent" className="kb-sec">🏡 بَيْتُ بَيان لِأُسْرَتي</Link>
              <IntroButton style={{ background: 'transparent', color: '#2F6B66', border: 0, padding: '8px 4px', fontWeight: 700, font: 'inherit', cursor: 'pointer', textDecoration: 'underline' }} />
            </div>
          </div>
          <div>
            <div className="kb-film">
              <video controls playsInline preload="none" poster="/kids/films/bayan-s6-teaser.jpg" src="/kids/films/bayan-s6-teaser.mp4" aria-label="فيلم قصير من الجلسة السادسة: أَثير والدرّاجة" />
            </div>
            <p className="kb-cap">39 ثانية من الجلسة السادسة «أَثيرْ وَالدَّرّاجَةْ» — بأصوات الأطفال أنفسهم 🔊</p>
          </div>
        </section>

        <div className="kb-proof">
          <div><b>{live}</b><span>جلسات حيّة الآن</span></div>
          <div><b>8</b><span>محطّات في كلّ جلسة</span></div>
          <div><b>20</b><span>دقيقة · بحضور الأهل</span></div>
          <div><b>300</b><span>ساعة: بَذرة → شجرة أَثَر</span></div>
        </div>

        <h2 className="kb-h2">الجلسات — اختر وجرّب</h2>
        <div className="kb-grid">
          {SESSIONS.map(s => (
            <Link key={s.slug} href={s.meta.order === 1 ? '/kids/demo' : `/kids/demo/${s.slug}`} className="kb-s">
              <img src={`/kids/${s.slug}/img/panel-01.jpg`} alt="" width={104} height={78} />
              <span>
                <small>الجلسة {s.meta.order} · حرف {s.meta.letterName} · قيمة {s.meta.value}</small>
                <b>«في {s.meta.world}» — {s.meta.storyTitle}</b>
                <i>جرّب الجلسة ▶</i>
              </span>
            </Link>
          ))}
        </div>

        {bedtime && (
          <div className="kb-night">
            <img src={bedtime.img} alt="" width={140} height={92} />
            <div>
              <h3>🌙 قصّة قبل النوم: «{bedtime.title}»</h3>
              <p>بصوت جدّ سالم · {bedtime.minutes} دقائق · لؤلؤ نائمة على كتفه، فالصوت خافت — للفراش لا للشاشة.</p>
              <a href={bedtime.audio} target="_blank" rel="noopener">🎧 اسمع</a>
              {bedtime.video && <a href={bedtime.video} target="_blank" rel="noopener">🎬 شاهِد وشارِك</a>}
            </div>
          </div>
        )}

        <p className="kb-foot">
          مساران (أطفال عرب · غير ناطقين) وشريحتان عمريتان، ومستويات: بَذرة → بُرعم → غُصن → شجرة أَثَر. الجلسات التجريبيّة للمسار (أ) 4–6 سنوات، صوت الشاشة مطلوب 🔊
          <br /><Link href="/kids/facilitator">للميسّرين: دليل اللقاء الأسبوعيّ 📋</Link> · <Link href="/contact?topic=bayan">سجّل اهتمامك بالبرنامج الكامل</Link>
        </p>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </div>
    </PortalShell>
  );
}
