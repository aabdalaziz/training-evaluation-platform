'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase/client';
import AuthCard, { AuthMessage, authButton, authInput, authLabel } from '../components/login/AuthCard';

function explain(message: string): string {
  const m = (message || '').toLowerCase();
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'تم إرسال طلب قبل قليل. انتظر 60 ثانية ثم أعد المحاولة.';
  if (m.includes('fetch') || m.includes('network')) return 'تعذّر الاتصال بالخادم. تحقق من الاتصال ثم أعد المحاولة.';
  if (m.includes('smtp') || m.includes('email') && m.includes('send')) return 'تعذّر إرسال البريد من Supabase. راجع إعدادات البريد (Authentication → Emails).';
  return `حدث خطأ: ${message}`;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const db = supabase();
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await db.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
      if (error) { setError(explain(error.message)); return; }
      setSent(true);
    } catch (err: any) {
      setError(explain(err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      icon={<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>}
      title="استرجاع كلمة المرور"
      subtitle="أدخل بريدك الإلكتروني المسجَّل وسنرسل لك رابطًا آمنًا لتعيين كلمة مرور جديدة."
    >
      {sent ? (
        <>
          <AuthMessage kind="ok">
            إذا كان البريد <bdi dir="ltr">{email}</bdi> مسجَّلًا في المنصة فستصلك رسالة خلال دقيقة تحتوي على رابط إعادة التعيين.
            <br />الرابط صالح لمدة محدودة ولاستخدام واحد فقط.
          </AuthMessage>
          <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.9, marginTop: 16 }}>
            لم تصلك الرسالة؟ تحقق من مجلد الرسائل غير المرغوبة (Spam)، أو أعد المحاولة بعد 60 ثانية.
          </p>
          <button type="button" onClick={() => setSent(false)} style={{ ...authButton, background: '#fff', color: '#14466B', border: '1px solid #cbd5e1' }}>
            إعادة الإرسال
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="fp-email" style={authLabel}>البريد الإلكتروني</label>
          <input id="fp-email" type="email" required autoComplete="username" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} style={authInput} />
          {error && <AuthMessage kind="err">{error}</AuthMessage>}
          <button type="submit" disabled={loading} style={{ ...authButton, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.8 : 1 }}>
            {loading ? 'جارٍ الإرسال...' : 'إرسال رابط الاسترجاع'}
          </button>
        </form>
      )}

      <div style={{ textAlign: 'center', marginTop: 22 }}>
        <Link href="/login" style={{ color: '#0E7C86', fontWeight: 800, textDecoration: 'none' }}>← العودة إلى تسجيل الدخول</Link>
      </div>
    </AuthCard>
  );
}
