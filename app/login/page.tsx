'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /login — الباب الواحد (P42-أ)
 *  رابط سحري (افتراضي) أو كلمة مرور → بعد الدخول: ?next=… إن وُجد وإلا /hub (يفتح بابك حسب صفتك)
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';

import { AuthShell } from '../components/login/AuthCard';
import LoginCard from '../components/login/LoginCard';

/* ترجمة أشهر رسائل Supabase إلى سبب واضح بالعربية */
function explain(message: string): string {
  const m = (message || '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة. جرّب «رابط الدخول» بلا كلمة مرور.';
  if (m.includes('email not confirmed')) return 'الحساب موجود لكنه غير مُفعَّل. من لوحة Supabase: Authentication → Users → اضغط على المستخدم → Confirm email.';
  if (m.includes('email logins are disabled') || m.includes('signups not allowed')) return 'الدخول بالبريد معطّل. من لوحة Supabase: Authentication → Providers → Email → Enable.';
  if (m.includes('fetch') || m.includes('network') || m.includes('invalid url')) return 'تعذّر الاتصال بـ Supabase. تأكد من NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY في Vercel ثم أعد النشر (Redeploy).';
  if (m.includes('invalid api key') || m.includes('jwt')) return 'مفتاح Supabase غير صحيح. راجع NEXT_PUBLIC_SUPABASE_ANON_KEY في Vercel ثم أعد النشر.';
  if (m.includes('rate limit') || m.includes('too many')) return 'محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.';
  return `خطأ من Supabase: ${message}`;
}
/* ?next= داخلي فقط (يمنع التحويل لخارج الموقع) */
const safeNext = (v: string | null) => (v && /^\/(?!\/)[\w\-./?=&%#\u0600-\u06FF]*$/.test(v) ? v : '/hub');

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [next, setNext] = useState('/hub');
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search); setNext(safeNext(sp.get('next')));
    /* داخل بالفعل؟ إلى بابه مباشرة */
    (async () => { try { const { data } = await supabase().auth.getSession(); if (data.session) router.replace(safeNext(sp.get('next'))); } catch { /* ignore */ } })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function envOk() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) { setError('إعدادات Supabase غير موجودة في هذا النشر. أضف NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY في Vercel → Settings → Environment Variables ثم اعمل Redeploy.'); return false; }
    return true;
  }
  async function handleLogin(email: string, password: string) {
    setLoading(true); setError(''); if (!envOk()) { setLoading(false); return; }
    try {
      const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
      if (error) { setError(explain(error.message)); setLoading(false); return; }
      router.push(next); router.refresh();
    } catch (e: any) { setError(explain(e?.message || String(e))); setLoading(false); }
  }
  async function handleMagic(email: string): Promise<string> {
    const em = email.trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { setError('اكتب بريدًا صحيحًا'); return ''; }
    setLoading(true); setError(''); if (!envOk()) { setLoading(false); return ''; }
    try {
      const { error } = await supabase().auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + next } });
      setLoading(false);
      if (error) { setError(explain(error.message)); return ''; }
      return `أرسلنا رابط الدخول إلى ${em} — افتحه من هذا الجهاز وسيُفتح بابك مباشرة. (إن لم يصل خلال دقيقة راجع «غير المرغوب»)`;
    } catch (e: any) { setLoading(false); setError(explain(e?.message || String(e))); return ''; }
  }

  return (
    <AuthShell>
      <LoginCard onSubmit={handleLogin} onMagic={handleMagic} loading={loading} error={error} />
    </AuthShell>
  );
}
