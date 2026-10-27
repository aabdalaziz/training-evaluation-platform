// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — صفحة «بلا اتصال» (PWA · P13-ب): تُقدَّم من عامل الخدمة عند انقطاع الشبكة
export const metadata = { title: 'بلا اتصال — أَثَر' };
export default function OfflinePage() {
  return (
    <main dir="rtl" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'inherit' }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true" style={{ display: 'block', margin: '0 auto 16px' }}><circle cx="48" cy="48" r="38" fill="none" stroke="#0b8a83" strokeOpacity=".4" strokeWidth="4" /><circle cx="48" cy="48" r="28" fill="none" stroke="#0b8a83" strokeOpacity=".65" strokeWidth="4" /><circle cx="48" cy="48" r="18" fill="none" stroke="#0b8a83" strokeWidth="4" /><circle cx="48" cy="48" r="8" fill="#c9a24b" /></svg>
        <h1 style={{ color: '#0f2a4e', fontSize: 24, margin: '0 0 8px' }}>لا اتصال بالشبكة الآن</h1>
        <p style={{ color: '#475569', lineHeight: 1.9, margin: '0 0 16px' }}>موقف اليوم وخريطة جداراتك وجلساتك تحتاج اتصالًا. حين يعود الاتصال ستعود الصفحة من حيث توقفت — وفي الأثناء: الموقف الذي قرأته اليوم… كيف كنتَ ستتصرّف فيه فعلًا؟</p>
        <a href="/" style={{ display: 'inline-block', background: '#0f2a4e', color: '#fff', padding: '10px 18px', borderRadius: 999, textDecoration: 'none', fontWeight: 700 }}>أعد المحاولة</a>
      </div>
    </main>
  );
}
