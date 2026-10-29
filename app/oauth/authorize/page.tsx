'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /oauth/authorize — شاشة الموافقة (P20 سفارة أَثَر): مساعدك الذكي يطلب صلاحيات محددة على بياناتك أنت
 *  يقرأ معاملات OAuth من الرابط · إن لم تكن مسجَّلًا تدخل هنا مباشرة (بريد/كلمة مرور) ولا نفقد الطلب · يعرض اسم العميل (موثَّق/غير موثَّق)
 *  والنطاقات بلغة بشرية مع مستوى الحساسية · «أفوِّض» يصدر كودًا ويعيدك للعميل · «أرفض» يعيدك بخطأ access_denied · كل ذلك قابل للإبطال من /me/agents
 */
import { useEffect, useMemo, useState } from 'react';
import { AtharMark } from '../../components/PortalShell';
import { supabase } from '../../../lib/supabase/client';
import { fastToken } from '../../components/Pocket';

type Desc = { client: { id: string; name: string; uri: string | null; logo: string | null; verified: boolean; source: string; redirect_host: string }; scopes: { key: string; ar: string; en: string; detail_ar: string; risk: 'low' | 'medium' | 'high' }[]; user: { name: string; email: string }; previous: { id: string; scopes: string[]; created_at: string } | null };
const RISK = { low: { ar: 'قراءة', c: '#0b8a83' }, medium: { ar: 'يكتب باسمك', c: '#b7791f' }, high: { ar: 'حساس', c: '#b91c1c' } };

export default function AuthorizePage() {
  const db = useMemo(() => supabase(), []);
  const [params, setParams] = useState<Record<string, string> | null>(null); const [tok, setTok] = useState<string | null>(null);
  const [desc, setDesc] = useState<Desc | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(''); const [login, setLogin] = useState({ email: '', password: '' }); const [loginErr, setLoginErr] = useState('');
  useEffect(() => { const q: Record<string, string> = {}; new URLSearchParams(window.location.search).forEach((v, k) => { q[k] = v; }); setParams(q); fastToken(db, 4000).then(t => setTok(t || '')); }, [db]);
  useEffect(() => {
    if (!params || !tok) return; setErr('');
    fetch('/api/oauth', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'describe', params }) }).then(r => r.json()).then(j => { if (j?.success) setDesc(j); else setErr(j?.error || 'طلب تفويض غير صالح'); }).catch(() => setErr('تعذّر الاتصال'));
  }, [params, tok]);
  async function signIn(e: React.FormEvent) { e.preventDefault(); setLoginErr(''); setBusy('login'); const { data, error } = await db.auth.signInWithPassword({ email: login.email.trim(), password: login.password }); setBusy(''); if (error || !data.session) { setLoginErr('البريد أو كلمة المرور غير صحيحة'); return; } setTok(data.session.access_token); }
  async function decide(action: 'approve' | 'deny') {
    setBusy(action); const j = await fetch('/api/oauth', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action, params }) }).then(r => r.json()).catch(() => null); setBusy('');
    if (j?.success && j.redirect) { window.location.href = j.redirect; return; } setErr(j?.error || 'تعذّر إتمام التفويض');
  }
  const ready = params && tok !== null;
  return (
    <main className="oa" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="oa-card" data-testid="oauth-consent">
        <header className="oa-head"><AtharMark size={44} /><div><span className="oa-kicker">سفارة أَثَر · تفويض شخصي</span><h1>مساعدك يطلب الإذن</h1></div></header>
        {!ready && <p className="oa-muted">…</p>}
        {ready && tok === '' && (
          <form className="oa-login" onSubmit={signIn} data-testid="oauth-login">
            <p>سجّل الدخول إلى أَثَر لتقرر ما الذي يراه مساعدك. لن يحصل المساعد على كلمة مرورك أبدًا — فقط رمزًا محدود الصلاحية يمكنك إبطاله.</p>
            <label>البريد<input type="email" required value={login.email} onChange={e => setLogin({ ...login, email: e.target.value })} dir="ltr" /></label>
            <label>كلمة المرور<input type="password" required value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} dir="ltr" /></label>
            {loginErr && <div className="oa-err">{loginErr}</div>}
            <button className="pt-btn gold" type="submit" disabled={busy === 'login'}>{busy === 'login' ? '…' : 'دخول ومتابعة'}</button>
          </form>
        )}
        {ready && tok && err && <div className="oa-err" data-testid="oauth-error">{err}<br /><small>أعد المحاولة من داخل المساعد؛ إن تكرر الخطأ فالعميل يرسل معاملات غير صالحة.</small></div>}
        {ready && tok && desc && !err && (
          <>
            <div className="oa-client">
              {desc.client.logo ? <img src={desc.client.logo} alt="" /> : <span className="oa-logo">{desc.client.name.slice(0, 1).toUpperCase()}</span>}
              <div><b data-testid="oauth-client">{desc.client.name}</b><span className={`oa-ver ${desc.client.verified ? 'ok' : 'warn'}`}>{desc.client.verified ? 'عميل موثَّق' : 'عميل غير موثَّق — تأكد أنك تعرفه'}</span><small>سيعود إلى: {desc.client.redirect_host}</small></div>
            </div>
            <p className="oa-who">يطلب الوصول إلى حساب <b>{desc.user.name || desc.user.email}</b> ({desc.user.email}) بالصلاحيات التالية فقط:</p>
            <ul className="oa-scopes">{desc.scopes.map(s => <li key={s.key} data-testid="oauth-scope"><span className="oa-risk" style={{ background: RISK[s.risk].c }}>{RISK[s.risk].ar}</span><div><b>{s.ar}</b><p>{s.detail_ar}</p></div></li>)}</ul>
            {desc.previous && <p className="oa-muted">سبق أن فوّضت هذا العميل في {new Date(desc.previous.created_at).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory')} — الموافقة الآن تحدّث الصلاحيات.</p>}
            <div className="oa-rules"><b>ما لا يستطيعه أبدًا:</b> رؤية كلمة مرورك · بيانات أشخاص آخرين · إلزام أَثَر بسعر أو مقعد · تعديل سجلاتك. كل نداء يُسجَّل وتراه في «وكلائي»، ويمكنك الإبطال في أي لحظة.</div>
            <div className="oa-actions"><button className="pt-btn gold" onClick={() => decide('approve')} disabled={!!busy} data-testid="oauth-approve">{busy === 'approve' ? '…' : 'أفوِّض'}</button><button className="pt-btn ghost" onClick={() => decide('deny')} disabled={!!busy} data-testid="oauth-deny">أرفض</button></div>
          </>
        )}
        <footer className="oa-foot">أَثَر · الذكاء الاصطناعي يساعد، والإنسان يعتمد · <a href="/me/agents">وكلائي</a> · <a href="/agents">كيف يعمل</a></footer>
      </section>
    </main>
  );
}
const CSS = `
.oa{min-height:100vh;display:grid;place-items:center;padding:24px 14px;background:radial-gradient(900px 400px at 80% -10%,rgba(11,138,131,.25),transparent 60%),linear-gradient(160deg,#0f2a4e,#102f5a 55%,#0b8a83);font-family:inherit}
.oa-card{width:100%;max-width:560px;background:#fff;border-radius:22px;padding:26px 26px 18px;display:grid;gap:14px;box-shadow:0 24px 60px rgba(2,6,23,.35)}
.oa-head{display:flex;gap:12px;align-items:center}.oa-head h1{margin:2px 0 0;font-size:22px;color:#0f2a4e}.oa-kicker{font-size:12px;font-weight:900;color:#c9a24b}
.oa-muted{color:#64748b;font-size:13px;margin:0;line-height:1.8}.oa-err{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:12px;padding:10px 12px;font-size:13.5px;line-height:1.7}
.oa-login{display:grid;gap:10px}.oa-login p{margin:0;font-size:14px;color:#1e293b;line-height:1.8}.oa-login label{display:grid;gap:4px;font-size:13px;color:#334155;font-weight:700}.oa-login input{border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;font-size:14px}
.oa-client{display:flex;gap:12px;align-items:center;border:1px solid #e2e8f0;border-radius:14px;padding:12px}.oa-client img,.oa-logo{width:44px;height:44px;border-radius:12px;object-fit:cover;background:#0f2a4e;color:#fff;display:grid;place-items:center;font-weight:900;font-size:18px}
.oa-client div{display:grid;gap:2px}.oa-client b{color:#0f2a4e;font-size:16px}.oa-client small{color:#94a3b8;font-size:11.5px}.oa-ver{font-size:11.5px;font-weight:800;border-radius:999px;padding:1px 8px;justify-self:start}.oa-ver.ok{background:#e6f4f1;color:#0b8a83}.oa-ver.warn{background:#fff7ed;color:#9a3412}
.oa-who{margin:0;font-size:14px;color:#1e293b;line-height:1.8}
.oa-scopes{list-style:none;margin:0;padding:0;display:grid;gap:8px}.oa-scopes li{display:flex;gap:10px;align-items:flex-start;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#f8fafc}.oa-scopes b{color:#0f2a4e;font-size:14px}.oa-scopes p{margin:2px 0 0;font-size:12.5px;color:#475569;line-height:1.7}
.oa-risk{color:#fff;font-size:10.5px;font-weight:900;border-radius:999px;padding:3px 8px;white-space:nowrap;margin-top:2px}
.oa-rules{font-size:12.5px;color:#475569;line-height:1.8;background:#fffdf5;border:1px dashed #e7d9a8;border-radius:12px;padding:10px 12px}.oa-rules b{color:#7a5a00}
.oa-actions{display:flex;gap:10px;justify-content:flex-start}.oa .pt-btn{border-radius:12px;padding:10px 18px;font-weight:800;font-size:14px;border:1px solid transparent;cursor:pointer}.oa .pt-btn.gold{background:#c9a24b;color:#0f2a4e}.oa .pt-btn.ghost{background:#fff;border-color:#cbd5e1;color:#0f2a4e}.oa .pt-btn:disabled{opacity:.6}
.oa-foot{text-align:center;color:#94a3b8;font-size:12px;border-top:1px solid #f1f5f9;padding-top:10px}.oa-foot a{color:#0b8a83}
`;
