'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';
import LoginHero from '../components/login/LoginHero';

export default function LoginPage() {
  const router = useRouter();
  const db = supabase();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await db.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f4f7fb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          gap: 30,
        }}
      >
        <LoginHero />

        <div
          style={{
            background: '#fff',
            borderRadius: 28,
            padding: 40,
            boxShadow: '0 20px 40px rgba(15,23,42,.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              marginBottom: 30,
            }}
          >
            <h2
              style={{
                margin: 0,
                color: '#14466B',
                fontSize: 34,
                fontWeight: 900,
              }}
            >
              🔐 تسجيل الدخول
            </h2>

            <p
              style={{
                marginTop: 10,
                color: '#64748b',
              }}
            >
              الدخول إلى مركز القيادة التنفيذي
            </p>
          </div>

          <form onSubmit={login}>
            <Field
              label="البريد الإلكتروني"
              value={email}
              onChange={setEmail}
              type="email"
            />

            <Field
              label="كلمة المرور"
              value={password}
              onChange={setPassword}
              type="password"
            />

            {error && (
              <div
                style={{
                  background: '#fee2e2',
                  color: '#b91c1c',
                  padding: 14,
                  borderRadius: 12,
                  marginBottom: 18,
                  fontWeight: 700,
                }}
              >
                {error}
              </div>
            )}

            <button
              disabled={loading}
              style={{
                width: '100%',
                background: '#14466B',
                color: '#fff',
                border: 0,
                borderRadius: 14,
                padding: 16,
                fontSize: 17,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              {loading
                ? 'جارٍ تسجيل الدخول...'
                : 'الدخول إلى مركز القيادة'}
            </button>
          </form>

          <div
            style={{
              marginTop: 28,
              textAlign: 'center',
              color: '#64748b',
              fontSize: 14,
            }}
          >
            Excellence Portal for Education & Development
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <label
        style={{
          display: 'block',
          marginBottom: 8,
          fontWeight: 800,
          color: '#334155',
        }}
      >
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        style={{
          width: '100%',
          padding: 14,
          borderRadius: 12,
          border: '1px solid #cbd5e1',
          outline: 'none',
          fontSize: 16,
        }}
      />
    </div>
  );
}
