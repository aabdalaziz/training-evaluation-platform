'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../../lib/ui/icons';
import AuthCard, { AuthMessage, authButton, authInput, authLabel } from './AuthCard';

type Props = {
  onSubmit: (email: string, password: string) => Promise<void>;
  loading?: boolean;
  error?: string;
};

export default function LoginCard({ onSubmit, loading = false, error = '' }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(email, password);
  }

  return (
    <AuthCard standalone={false} icon={<Icon name="login" size={30} />} title="تسجيل الدخول" subtitle="الدخول إلى لوحة القيادة وإدارة المنصة">
      <form onSubmit={submit} noValidate={false}>
        <label htmlFor="login-email" style={authLabel}>البريد الإلكتروني</label>
        <input id="login-email" type="email" required autoComplete="username" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} style={authInput} placeholder="name@example.com" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 8 }}>
          <label htmlFor="login-password" style={{ ...authLabel, marginBottom: 0 }}>كلمة المرور</label>
          <Link href="/forgot-password" className="au-link">نسيت كلمة المرور؟</Link>
        </div>

        <div style={{ position: 'relative' }}>
          <input id="login-password" type={show ? 'text' : 'password'} required autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...authInput, paddingLeft: 46 }} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} title={show ? 'إخفاء' : 'إظهار'}
            style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer', padding: 6, display: 'flex' }}>
            {show ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            )}
          </button>
        </div>

        {error && <AuthMessage kind="err">{error}</AuthMessage>}

        <button type="submit" disabled={loading} style={{ ...authButton, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.8 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="login" size={18} />{loading ? 'جارٍ تسجيل الدخول...' : 'الدخول إلى لوحة القيادة'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
        <Link href="/" className="au-link"><Icon name="home" size={15} />الصفحة الرئيسية</Link>
        <Link href="/student" className="au-link"><Icon name="users" size={15} />بوابة المتدرب</Link>
      </div>
    </AuthCard>
  );
}
