import type { Metadata } from 'next';
import Link from 'next/link';
import { PortalShell } from '../components/PortalShell';

export const metadata: Metadata = { title: 'بَيان — برنامج أَثَر للأطفال', description: 'بَيان: لغةٌ تُحَبّ… وأثرٌ يبقى. برنامج تعليم العربية للأطفال (4–9 سنوات) بشخصيات كرتونية ومواقف حياتية وقيم وقرآن.' };

/** بَيان — واجهة وليّ الأمر (هـ-6-ب: صفحة تعريفية + دخول الجلسة النموذجية) */
export default function KidsPage() {
  return (
    <PortalShell>
      <div className="rm-page" dir="rtl" style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
        <section className="rm-card" style={{ padding: 24, borderRadius: 24 }}>
          <p style={{ color: '#8E7F8A', margin: 0 }}>برنامج أَثَر للأطفال · 4–9 سنوات</p>
          <h1 style={{ color: '#3A1F36', margin: '6px 0' }}>بَيان — لغةٌ تُحَبّ… وأثرٌ يبقى</h1>
          <p style={{ fontSize: 18, lineHeight: 1.9 }}>
            أَثير ونُور ويُوسُف ولُؤلُؤ وجَدّ سالِم وحَرْف يأخذون طفلك في رحلة من سبع محطّات في كل جلسة: حكاية في موقف حياتي، حرف وكلمات، لعبة، تمثيل،
            حديث قصير في «مدرسة المصطفى ﷺ»، آيات يتلوها ويردّدها، ثم «أثري اليوم» ببطاقة لوليّ الأمر. مساران (أطفال عرب · غير ناطقين) وشريحتان عمريتان،
            ومستويات: بَذرة → بُرعم → غُصن → شجرة أَثَر (300 ساعة تدريبية).
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <Link href="/kids/demo" className="rm-btn" style={{ background: '#E8795C', color: '#fff', borderRadius: 999, padding: '12px 22px', fontSize: 18, textDecoration: 'none' }}>جرّب الجلسة النموذجية «في السوق» ▶</Link>
            <Link href="/contact?topic=bayan" className="rm-btn" style={{ border: '2px solid #5EA8A0', color: '#2F6B66', borderRadius: 999, padding: '12px 22px', fontSize: 18, textDecoration: 'none' }}>سجّل اهتمامك</Link>
          </div>
          <p style={{ color: '#8E7F8A', fontSize: 14, marginTop: 14 }}>الجلسة النموذجية نسخة تجريبية للمسار (أ) 4–6 سنوات — 20 دقيقة، يُفضَّل حضور وليّ الأمر. صوت الشاشة مطلوب 🔊</p>
        </section>
      </div>
    </PortalShell>
  );
}
