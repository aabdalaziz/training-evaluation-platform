import type { Metadata } from 'next';
import Link from 'next/link';
import { PortalShell } from '../components/PortalShell';
import { SESSIONS } from '../../lib/kids/sessions';

export const metadata: Metadata = { title: 'بَيان — برنامج أَثَر للأطفال', description: 'بَيان: لغةٌ تُحَبّ… وأثرٌ يبقى. برنامج تعليم العربية للأطفال (4–9 سنوات) بشخصيات كرتونية ومواقف حياتية وقيم وقرآن.' };

/** بَيان — واجهة وليّ الأمر (هـ-6-ب: صفحة تعريفية + دخول الجلسة النموذجية) */
export default function KidsPage() {
  return (
    <PortalShell>
      <div className="rm-page" dir="rtl" style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
        <section className="rm-card" style={{ padding: 24, borderRadius: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <p style={{ color: '#8E7F8A', margin: 0 }}>برنامج أَثَر للأطفال · 4–9 سنوات</p>
            <Link href="/kids/parent" style={{ background: '#5EA8A0', color: '#fff', borderRadius: 999, padding: '8px 16px', textDecoration: 'none', fontWeight: 700 }}>🏡 بَيْتُ بَيان لِأُسْرَتي</Link>
          </div>
          <h1 style={{ color: '#3A1F36', margin: '6px 0' }}>بَيان — لغةٌ تُحَبّ… وأثرٌ يبقى</h1>
          <p style={{ fontSize: 18, lineHeight: 1.9 }}>
            أَثير ونُور ويُوسُف ولُؤلُؤ وجَدّ سالِم وحَرْف يأخذون طفلك في رحلة من ثماني محطّات في كل جلسة: حكاية في موقف حياتي، حرف وكلمات، لعبة، تمثيل،
            حديث قصير في «مدرسة المصطفى ﷺ»، آيات يتلوها ويردّدها، ثم «أثري اليوم» ببطاقة لوليّ الأمر. مساران (أطفال عرب · غير ناطقين) وشريحتان عمريتان،
            ومستويات: بَذرة → بُرعم → غُصن → شجرة أَثَر (300 ساعة تدريبية).
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12, marginTop: 16 }}>
            {SESSIONS.map(s => (
              <Link key={s.slug} href={s.meta.order === 1 ? '/kids/demo' : `/kids/demo/${s.slug}`} style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 12, alignItems: 'center', textDecoration: 'none', color: '#2A1626', border: '2px solid #F1D9A8', borderRadius: 20, padding: 12, background: '#fff' }}>
                <img src={`/kids/${s.slug}/img/panel-01.jpg`} alt="" width={96} height={72} style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 12 }} />
                <span>
                  <span style={{ color: '#8E7F8A', fontSize: 13 }}>الجلسة {s.meta.order} · حرف {s.meta.letterName} · قيمة {s.meta.value}</span>
                  <b style={{ display: 'block', fontSize: 20, color: '#3A1F36' }}>«في {s.meta.world}» — {s.meta.storyTitle}</b>
                  <span style={{ display: 'inline-block', marginTop: 6, background: '#E8795C', color: '#fff', borderRadius: 999, padding: '6px 14px', fontSize: 15 }}>جرّب الجلسة ▶</span>
                </span>
              </Link>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <Link href="/contact?topic=bayan" className="rm-btn" style={{ border: '2px solid #5EA8A0', color: '#2F6B66', borderRadius: 999, padding: '12px 22px', fontSize: 18, textDecoration: 'none' }}>سجّل اهتمامك</Link>
          </div>
          <p style={{ color: '#8E7F8A', fontSize: 14, marginTop: 14 }}>الجلستان التجريبيتان للمسار (أ) 4–6 سنوات — 20 دقيقة لكلٍّ منهما، يُفضَّل حضور وليّ الأمر. صوت الشاشة مطلوب 🔊</p>
        </section>
      </div>
    </PortalShell>
  );
}
