'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * بطاقة الدخول الموحَّدة (P42-أ): بابٌ واحد للجميع
 *  - «رابط الدخول» (الافتراضي): بريد فقط → رابط سحري → /hub يفتح بابك حسب صفتك
 *  - «كلمة المرور»: للطاقم القديم ومن يفضّلها
 *  - «لديك دعوة؟» → تفسير رابط /join
 */
import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../../lib/ui/icons';
import AuthCard, { AuthMessage, authButton, authInput, authLabel } from './AuthCard';

type Props = {
  onSubmit: (email: string, password: string) => Promise<void>;
  onMagic?: (email: string) => Promise<string>;   // يعيد رسالة نجاح
  loading?: boolean;
  error?: string;
  initialMode?: 'magic' | 'password';
};

export default function LoginCard({ onSubmit, onMagic, loading = false, error = '', initialMode = 'magic' }: Props) {
  const [mode, setMode] = useState<'magic' | 'password'>(onMagic ? initialMode : 'password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [sent, setSent] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSent('');
    if (mode === 'magic' && onMagic) { const m = await onMagic(email); if (m) setSent(m); return; }
    await onSubmit(email, password);
  }
  const tabBtn = (on: boolean): React.CSSProperties => ({ flex: 1, minHeight: 44, padding: '9px 10px', borderRadius: 10, border: on ? '1.5px solid #0f2a4e' : '1px solid #e2e8f0', background: on ? '#0f2a4e' : '#fff', color: on ? '#fff' : '#334155', fontWeight: 800, cursor: 'pointer', fontSize: 14 });

  return (
    <AuthCard standalone={false} icon={<Icon name="login" size={30} />} title="ادخل إلى أَثَر" subtitle="بابٌ واحد لكل صفة: متدرّب أو مدرّب أو طاقم — اكتب بريدك ويفتح لك بابك">
      {onMagic && (
        <div role="tablist" aria-label="طريقة الدخول" style={{ display: 'flex', gap: 8, marginBottom: 16 }} data-testid="login-modes">
          <button type="button" role="tab" aria-selected={mode === 'magic'} style={tabBtn(mode === 'magic')} onClick={() => setMode('magic')} data-testid="login-mode-magic">رابط الدخول (بلا كلمة مرور)</button>
          <button type="button" role="tab" aria-selected={mode === 'password'} style={tabBtn(mode === 'password')} onClick={() => setMode('password')} data-testid="login-mode-password">كلمة المرور</button>
        </div>
      )}
      <form onSubmit={submit} noValidate={false}>
        <label htmlFor="login-email" style={authLabel}>البريد الإلكتروني</label>
        <input id="login-email" type="email" required autoComplete="username" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} style={authInput} placeholder="name@example.com" />

        {mode === 'password' && (<>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 8 }}>
            <label htmlFor="login-password" style={{ ...authLabel, marginBottom: 0 }}>كلمة المرور</label>
            <Link href="/forgot-password" className="au-link">نسيت كلمة المرور؟</Link>
          </div>
          <div style={{ position: 'relative' }}>
            <input id="login-password" type={show ? 'text' : 'password'} required autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...authInput, paddingLeft: 44 }} placeholder="••••••••" />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} title={show ? 'إخفاء' : 'إظهار'}
              style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer', padding: 6, display: 'flex' }}>
              {show ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
          </div>
        </>)}
        {mode === 'magic' && <p style={{ margin: '10px 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>نرسل إلى بريدك رابطًا صالحًا لمرة واحدة. اضغطه من الجهاز نفسه وستجد نفسك داخل بابك مباشرة — بلا كلمة مرور تحفظها.</p>}

        {error && <AuthMessage kind="err">{error}</AuthMessage>}
        {sent && <AuthMessage kind="ok">{sent}</AuthMessage>}

        <button type="submit" disabled={loading} data-testid="login-submit" style={{ ...authButton, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.8 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name={mode === 'magic' ? 'send' : 'login'} size={18} />{loading ? 'لحظة…' : mode === 'magic' ? 'أرسل لي رابط الدخول' : 'الدخول'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
        <Link href="/" className="au-link"><Icon name="home" size={15} />الصفحة الرئيسية</Link>
        <Link href="/help#invite" className="au-link" data-testid="login-invite-help"><Icon name="mail" size={15} />لديك دعوة؟ افتح رابطها مباشرة</Link>
      </div>
    </AuthCard>
  );
}
