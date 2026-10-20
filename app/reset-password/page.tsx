'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';
import AuthCard, { AuthMessage, authButton, authInput, authLabel } from '../components/login/AuthCard';

type Stage = 'checking' | 'ready' | 'invalid' | 'done';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('checking');
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const db = supabase();
    let settled = false;
    const ok = () => { if (!settled) { settled = true; setStage('ready'); } };
    const bad = (why: string) => { if (!settled) { settled = true; setReason(why); setStage('invalid'); } };

    // 1) أخطاء صريحة في الرابط (منتهي/مستخدم مسبقًا)
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const errDesc = url.searchParams.get('error_description') || hash.get('error_description');
    if (errDesc) { bad(/expired/i.test(errDesc) ? 'انتهت صلاحية الرابط.' : 'الرابط غير صالح أو استُخدم من قبل.'); return; }

    // 2) حدث الاسترجاع من Supabase (يصل عند تبادل الرمز تلقائيًا)
    const { data: sub } = db.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION'))) ok();
    });

    (async () => {
      // 3) تدفق PKCE: ?code=... نتبادله يدويًا إن لم يُتبادل تلقائيًا
      const code = url.searchParams.get('code');
      if (code) {
        const { error } = await db.auth.exchangeCodeForSession(code);
        if (!error) { window.history.replaceState({}, '', '/reset-password'); ok(); return; }
      }
      // 4) جلسة موجودة أصلًا (تدفق implicit أو تبادل تلقائي سابق)
      const { data } = await db.auth.getSession();
      if (data.session) { ok(); return; }
      // 5) مهلة قصيرة ثم نعتبر الرابط غير صالح
      setTimeout(() => bad('لم نتمكن من التحقق من رابط الاسترجاع.'), 2500);
    })();

    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('كلمة المرور يجب ألا تقل عن 8 أحرف.'); return; }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) { setError('يجب أن تحتوي كلمة المرور على حروف وأرقام معًا.'); return; }
    if (password !== confirm) { setError('تأكيد كلمة المرور غير مطابق.'); return; }
    setBusy(true);
    try {
      const db = supabase();
      const { error } = await db.auth.updateUser({ password });
      if (error) {
        const m = error.message.toLowerCase();
        setError(m.includes('same password') ? 'كلمة المرور الجديدة مطابقة للقديمة. اختر كلمة مختلفة.' : m.includes('session') || m.includes('auth') ? 'انتهت صلاحية الجلسة. اطلب رابط استرجاع جديدًا.' : `حدث خطأ: ${error.message}`);
        return;
      }
      setStage('done');
      setTimeout(() => { router.replace('/dashboard'); router.refresh(); }, 1800);
    } catch (err: any) {
      setError(`حدث خطأ: ${err?.message || String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const icon = (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /><path d="M9 16l2 2 4-4" />
    </svg>
  );

  return (
    <AuthCard icon={icon} title="تعيين كلمة مرور جديدة" subtitle="اختر كلمة مرور قوية: 8 أحرف على الأقل وتتضمن حروفًا وأرقامًا.">
      {stage === 'checking' && <AuthMessage kind="info">جارٍ التحقق من رابط الاسترجاع…</AuthMessage>}

      {stage === 'invalid' && (
        <>
          <AuthMessage kind="err">{reason} اطلب رابطًا جديدًا من صفحة الاسترجاع.</AuthMessage>
          <Link href="/forgot-password" style={{ ...authButton, display: 'block', textAlign: 'center', textDecoration: 'none' }}>طلب رابط جديد</Link>
        </>
      )}

      {stage === 'done' && <AuthMessage kind="ok">تم تغيير كلمة المرور بنجاح. جارٍ تحويلك إلى لوحة التحكم…</AuthMessage>}

      {stage === 'ready' && (
        <form onSubmit={submit}>
          <label htmlFor="rp-pass" style={authLabel}>كلمة المرور الجديدة</label>
          <div style={{ position: 'relative' }}>
            <input id="rp-pass" type={show ? 'text' : 'password'} required minLength={8} autoComplete="new-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...authInput, paddingLeft: 48 }} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'إخفاء' : 'إظهار'} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer', padding: 6, display: 'flex' }}>
              {show ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
          </div>

          <label htmlFor="rp-confirm" style={{ ...authLabel, marginTop: 20 }}>تأكيد كلمة المرور</label>
          <input id="rp-confirm" type={show ? 'text' : 'password'} required minLength={8} autoComplete="new-password" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={authInput} />

          <Strength value={password} />
          {error && <AuthMessage kind="err">{error}</AuthMessage>}

          <button type="submit" disabled={busy} style={{ ...authButton, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.8 : 1 }}>
            {busy ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور الجديدة'}
          </button>
        </form>
      )}

      <div style={{ textAlign: 'center', marginTop: 22 }}>
        <Link href="/login" style={{ color: '#0E7C86', fontWeight: 800, textDecoration: 'none' }}>← العودة إلى تسجيل الدخول</Link>
      </div>
    </AuthCard>
  );
}

function Strength({ value }: { value: string }) {
  if (!value) return null;
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  const level = score <= 1 ? 0 : score <= 3 ? 1 : 2;
  const label = ['ضعيفة', 'متوسطة', 'قوية'][level];
  const color = ['#dc2626', '#d97706', '#059669'][level];
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ flex: 1, height: 6, borderRadius: 6, background: i <= level ? color : '#e2e8f0' }} />)}
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color, marginTop: 6 }}>قوة كلمة المرور: {label}</div>
    </div>
  );
}
