// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — «أَثَر في الجيب» (P19): الشاشة المحلية — تُقدَّم من عامل الخدمة عند انقطاع الشبكة، وتعمل أيضًا مع الاتصال
// محفظتي من جهازي · موقف اليوم من جهازي · صندوق الأدلة الميداني — كلها بلا خادم
import PocketHome from '../components/PocketHome';
export const metadata = { title: 'أَثَر في الجيب — بلا اتصال' };
export default function OfflinePage() {
  return (
    <main dir="rtl" style={{ minHeight: '70vh', padding: '24px 16px 96px', fontFamily: 'inherit', background: '#FBF4EE' }}>
      <div style={{ textAlign: 'center', maxWidth: 860, margin: '0 auto 16px' }}>
        <svg width="72" height="72" viewBox="0 0 96 96" aria-hidden="true" style={{ display: 'block', margin: '0 auto 10px' }}><circle cx="48" cy="48" r="38" fill="none" stroke="#D4614A" strokeOpacity=".4" strokeWidth="4" /><circle cx="48" cy="48" r="28" fill="none" stroke="#D4614A" strokeOpacity=".65" strokeWidth="4" /><circle cx="48" cy="48" r="18" fill="none" stroke="#D4614A" strokeWidth="4" /><circle cx="48" cy="48" r="8" fill="#D9A866" /></svg>
        <h1 style={{ color: '#3A1F36', fontSize: 22, margin: '0 0 6px' }}>أَثَر يعمل من جيبك</h1>
        <p style={{ color: '#5C4858', lineHeight: 1.9, margin: 0, fontSize: 14 }}>بلا اتصال؟ محفظتك هنا، وموقف اليوم هنا، وما تكتبه أو تصوّره يُحفظ مشفَّرًا ويُرسل وحده حين تعود الشبكة.</p>
      </div>
      <PocketHome />
    </main>
  );
}
