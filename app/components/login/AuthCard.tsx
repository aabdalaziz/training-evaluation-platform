'use client';

import LoginHero from './LoginHero';

/** الإطار الموحّد لصفحات المصادقة (تسجيل الدخول / استرجاع كلمة المرور / إعادة التعيين) */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="au" dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: SHELL_CSS }} />
      <div className="au-grid">
        <LoginHero />
        {children}
      </div>
    </main>
  );
}

/** بطاقة النموذج: أيقونة + عنوان + وصف + المحتوى */
export default function AuthCard({ icon, title, subtitle, children, standalone = true }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode; standalone?: boolean }) {
  const card = (
    <section className="au-card" aria-labelledby="au-title">
      <div className="au-card-head">
        <div className="au-ico">{icon}</div>
        <h2 id="au-title">{title}</h2>
        <p>{subtitle}</p>
      </div>
      {children}
    </section>
  );
  return standalone ? <AuthShell>{card}</AuthShell> : card;
}

export const authInput: React.CSSProperties = {
  width: '100%', padding: '13px 14px', borderRadius: 10, border: '1px solid #cfd9e6', outline: 'none', fontSize: 15.5, boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff', color: '#0f172a',
};
export const authButton: React.CSSProperties = {
  marginTop: 22, width: '100%', border: 0, borderRadius: 10, background: '#0f2a4e', color: '#fff', padding: 14, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
};
export const authLabel: React.CSSProperties = { display: 'block', marginBottom: 8, fontWeight: 700, color: '#334155', fontSize: 14 };

export function AuthMessage({ kind, children }: { kind: 'ok' | 'err' | 'info'; children: React.ReactNode }) {
  const c = kind === 'ok' ? { bg: '#eafaf0', fg: '#15803d', bd: '#b7e4c7' } : kind === 'err' ? { bg: '#fef2f2', fg: '#b91c1c', bd: '#f6c4c4' } : { bg: '#eef4ff', fg: '#1d4ed8', bd: '#c3d4fb' };
  return (
    <div role={kind === 'err' ? 'alert' : 'status'} style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, fontWeight: 700, lineHeight: 1.8, fontSize: 14 }}>
      {children}
    </div>
  );
}

const SHELL_CSS = `
.au{min-height:100vh;background:#f3f6fa;display:flex;align-items:center;justify-content:center;padding:28px 20px;color:#0f172a;font-family:inherit;}
.au *{box-sizing:border-box;}
.au-grid{max-width:1240px;width:100%;display:grid;grid-template-columns:1.15fr .85fr;gap:24px;align-items:stretch;}
.au-card{background:#fff;border:1px solid #e4eaf2;border-top:4px solid #c9a24b;border-radius:18px;padding:34px 32px;box-shadow:0 1px 2px rgba(15,42,78,.05),0 12px 32px rgba(15,42,78,.08);align-self:center;}
.au-card-head{text-align:center;margin-bottom:24px;}
.au-ico{width:64px;height:64px;margin:0 auto;border-radius:16px;background:#e6f4f3;color:#0b8a83;display:flex;align-items:center;justify-content:center;border:1px solid #b7e1dd;}
.au-card h2{margin:14px 0 6px;color:#0f2a4e;font-weight:900;font-size:26px;}
.au-card-head p{color:#64748b;margin:0;line-height:1.8;font-size:14px;font-weight:600;}
.au-card input:focus{border-color:#0b8a83 !important;box-shadow:0 0 0 3px rgba(11,138,131,.14);}
.au-card button[type=submit]:hover{background:#163b6e !important;}
.au-link{color:#0b8a83;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-size:14px;}
.au-link:hover{text-decoration:underline;}
@media(max-width:900px){.au{padding:16px 12px;align-items:flex-start;}.au-grid{grid-template-columns:1fr;gap:16px;}.au-grid>.au-hero{order:2;}.au-card{padding:26px 20px;}}
`;
