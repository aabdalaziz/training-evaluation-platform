'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('لم يتم إعداد متغيرات Supabase في Vercel.');
      }

      const request = supabase().auth.signInWithPassword({ email: email.trim(), password });
      const timeout = new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error('انتهت مهلة الاتصال بـ Supabase. تحقق من Project URL والمفتاح العام ثم أعد النشر.')), 15000)
      );
      const { error: authError } = await Promise.race([request, timeout]);

      if (authError) {
        throw new Error(authError.message === 'Invalid login credentials'
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
          : authError.message);
      }

      router.push('/dashboard');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'حدث خطأ غير متوقع أثناء تسجيل الدخول.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <form onSubmit={submit}>
        <div className="emblem">🏛️</div>
        <h1>تسجيل الدخول</h1>
        <p>منصة تقويم البرامج التدريبية</p>
        {error && <div className="error">⚠️ {error}</div>}
        <label>البريد الإلكتروني<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>كلمة المرور<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="button" disabled={busy}>{busy ? 'جارٍ التحقق...' : 'دخول آمن ←'}</button>
      </form>
    </main>
  );
}
