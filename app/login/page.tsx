'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';

import LoginHero from '../components/login/LoginHero';
import LoginCard from '../components/login/LoginCard';

export default function LoginPage() {
  const router = useRouter();
  const db = supabase();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(
    email: string,
    password: string
  ) {
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

        <LoginCard
          onSubmit={handleLogin}
          loading={loading}
          error={error}
        />
      </div>
    </main>
  );
}
