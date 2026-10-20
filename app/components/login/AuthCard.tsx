'use client';

import LoginHero from './LoginHero';

/** إطار موحّد لصفحات المصادقة (استرجاع/إعادة تعيين كلمة المرور) بنفس هوية صفحة الدخول */
export default function AuthCard({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', background: '#F4F7FB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
      <div style={{ maxWidth: 1400, width: '100%', display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 30 }}>
        <LoginHero />
        <div style={{ background: '#fff', borderRadius: 28, padding: 40, boxShadow: '0 20px 45px rgba(15,23,42,.08)', alignSelf: 'center' }}>
          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <div
              style={{
                width: 72, height: 72, margin: '0 auto', borderRadius: 20,
                background: 'linear-gradient(135deg,#14466B,#0E7C86)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 10px 25px rgba(20,70,107,.25)',
              }}
            >
              {icon}
            </div>
            <h2 style={{ margin: '14px 0 8px', color: '#14466B', fontWeight: 900, fontSize: 30 }}>{title}</h2>
            <p style={{ color: '#64748b', margin: 0, lineHeight: 1.8 }}>{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

export const authInput: React.CSSProperties = {
  width: '100%', padding: 14, borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', fontSize: 16, boxSizing: 'border-box',
};
export const authButton: React.CSSProperties = {
  marginTop: 24, width: '100%', border: 0, borderRadius: 14, background: '#14466B', color: '#fff', padding: 16, fontSize: 17, fontWeight: 900, cursor: 'pointer',
};
export const authLabel: React.CSSProperties = { display: 'block', marginBottom: 8, fontWeight: 700 };
export function AuthMessage({ kind, children }: { kind: 'ok' | 'err' | 'info'; children: React.ReactNode }) {
  const c = kind === 'ok' ? { bg: '#ecfdf5', fg: '#047857', bd: '#a7f3d0' } : kind === 'err' ? { bg: '#fee2e2', fg: '#b91c1c', bd: '#fecaca' } : { bg: '#eff6ff', fg: '#1d4ed8', bd: '#bfdbfe' };
  return (
    <div role={kind === 'err' ? 'alert' : 'status'} style={{ marginTop: 18, padding: 14, borderRadius: 12, background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, fontWeight: 700, lineHeight: 1.8 }}>
      {children}
    </div>
  );
}
