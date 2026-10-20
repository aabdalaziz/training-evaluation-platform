'use client';

import { useState } from 'react';
import Link from 'next/link';

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
    <div style={{ background: '#ffffff', borderRadius: 28, padding: 40, boxShadow: '0 20px 45px rgba(15,23,42,.08)' }}>
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <div
          style={{
            width: 72, height: 72, margin: '0 auto', borderRadius: 20,
            background: 'linear-gradient(135deg,#14466B,#0E7C86)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 25px rgba(20,70,107,.25)',
          }}
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </div>

        <h2 style={{ margin: '14px 0 8px', color: '#14466B', fontWeight: 900, fontSize: 34 }}>تسجيل الدخول</h2>
        <p style={{ color: '#64748b', margin: 0 }}>الدخول إلى مركز القيادة التنفيذي</p>
      </div>

      <form onSubmit={submit}>
        <label htmlFor="login-email" style={{ display: 'block', marginBottom: 8, fontWeight: 700 }}>البريد الإلكتروني</label>
        <input
          id="login-email"
          type="email"
          required
          autoComplete="username"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
          <label htmlFor="login-password" style={{ fontWeight: 700 }}>كلمة المرور</label>
          <Link href="/forgot-password" style={{ color: '#0E7C86', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
            نسيت كلمة المرور؟
          </Link>
        </div>

        <div style={{ position: 'relative' }}>
          <input
            id="login-password"
            type={show ? 'text' : 'password'}
            required
            autoComplete="current-password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 48 }}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            title={show ? 'إخفاء' : 'إظهار'}
            style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer', padding: 6, display: 'flex',
            }}
          >
            {show ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            )}
          </button>
        </div>

        {error && (
          <div role="alert" style={{ marginTop: 18, padding: 14, borderRadius: 12, background: '#fee2e2', color: '#b91c1c', fontWeight: 700 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 28, width: '100%', border: 0, borderRadius: 14, background: '#14466B', color: '#fff',
            padding: 16, fontSize: 17, fontWeight: 900, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.8 : 1,
          }}
        >
          {loading ? 'جارٍ تسجيل الدخول...' : 'الدخول إلى مركز القيادة'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  outline: 'none',
  fontSize: 16,
  boxSizing: 'border-box',
};
