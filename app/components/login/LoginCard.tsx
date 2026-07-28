'use client';

import { useState } from 'react';

type Props = {
  onSubmit: (email: string, password: string) => Promise<void>;
  loading?: boolean;
  error?: string;
};

export default function LoginCard({
  onSubmit,
  loading = false,
  error = '',
}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(email, password);
  }

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 28,
        padding: 40,
        boxShadow: '0 20px 45px rgba(15,23,42,.08)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <div style={{ fontSize: 52 }}>🔐</div>

        <h2
          style={{
            margin: '10px 0',
            color: '#14466B',
            fontWeight: 900,
            fontSize: 34,
          }}
        >
          تسجيل الدخول
        </h2>

        <p
          style={{
            color: '#64748b',
            margin: 0,
          }}
        >
          الدخول إلى مركز القيادة التنفيذي
        </p>
      </div>

      <form onSubmit={submit}>
        <label
          style={{
            display: 'block',
            marginBottom: 8,
            fontWeight: 700,
          }}
        >
          البريد الإلكتروني
        </label>

        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        <label
          style={{
            display: 'block',
            marginTop: 20,
            marginBottom: 8,
            fontWeight: 700,
          }}
        >
          كلمة المرور
        </label>

        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && (
          <div
            style={{
              marginTop: 18,
              padding: 14,
              borderRadius: 12,
              background: '#fee2e2',
              color: '#b91c1c',
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 28,
            width: '100%',
            border: 0,
            borderRadius: 14,
            background: '#14466B',
            color: '#fff',
            padding: 16,
            fontSize: 17,
            fontWeight: 900,
            cursor: 'pointer',
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
