'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';

import LoginHero from '../components/login/LoginHero';
import LoginCard from '../components/login/LoginCard';

/* ترجمة أشهر رسائل Supabase إلى سبب واضح بالعربية */
function explain(message: string): string {
  const m = (message || '').toLowerCase();

  if (m.includes('invalid login credentials'))
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة (الحساب غير موجود في Supabase أو كلمة المرور خاطئة).';
  if (m.includes('email not confirmed'))
    return 'الحساب موجود لكنه غير مُفعَّل. من لوحة Supabase: Authentication → Users → اضغط على المستخدم → Confirm email.';
  if (m.includes('email logins are disabled') || m.includes('signups not allowed'))
    return 'الدخول بالبريد معطّل. من لوحة Supabase: Authentication → Providers → Email → Enable.';
  if (m.includes('fetch') || m.includes('network') || m.includes('invalid url'))
    return 'تعذّر الاتصال بـ Supabase. تأكد من NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY في Vercel ثم أعد النشر (Redeploy).';
  if (m.includes('invalid api key') || m.includes('jwt'))
    return 'مفتاح Supabase غير صحيح. راجع NEXT_PUBLIC_SUPABASE_ANON_KEY في Vercel ثم أعد النشر.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.';

  return `خطأ من Supabase: ${message}`;
}

export default function LoginPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(email: string, password: string) {
    setLoading(true);
    setError('');

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // فحص مبكر: هل المتغيرات موجودة أصلًا في هذا النشر؟
    if (!url || !key) {
      setError(
        'إعدادات Supabase غير موجودة في هذا النشر. أضف NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY في Vercel → Settings → Environment Variables ثم اعمل Redeploy.'
      );
      setLoading(false);
      return;
    }

    try {
      const db = supabase();
      const { error } = await db.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('Supabase login error:', error);
        setError(explain(error.message));
        setLoading(false);
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (e: any) {
      console.error('Login exception:', e);
      setError(explain(e?.message || String(e)));
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#F4F7FB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px',
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '1.2fr .8fr',
          gap: 30,
        }}
      >
        <LoginHero />

        <LoginCard onSubmit={handleLogin} loading={loading} error={error} />
      </div>
    </main>
  );
}
