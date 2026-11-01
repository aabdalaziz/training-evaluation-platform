'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /join/<token> — باب الدعوة (P42-أ)
 *  1) معاينة الدعوة بلا دخول: الصفات · الجهة · رسالة مدير النظام · الصلاحية
 *  2) غير داخل؟ يكتب بريده (نفس بريد الدعوة) → رابط سحري يعود إلى هذه الصفحة
 *  3) داخل والبريد مطابق؟ زر «أقبل الدعوة» → منح الأدوار → يفتح بابه
 *  4) داخل ببريد آخر؟ نوضّح ونعرض «الخروج والدخول بالبريد الصحيح»
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell } from '../../components/PortalShell';

type Inv = { kind?: 'personal' | 'group'; label?: string | null; seats_left?: number | null; max_uses?: number; email_masked: string | null; full_name: string | null; roles: { code: string; name_ar: string; name_en: string }[]; org: string | null; message: string | null; expires_at: string; state: 'pending' | 'accepted' | 'expired' | 'revoked' };
const STATE_AR: Record<string, string> = { accepted: 'هذه الدعوة قُبلت من قبل — ادخل من /login وسيفتح بابك.', expired: 'انتهت صلاحية هذه الدعوة (14 يومًا). اطلب من مدير النظام دعوة جديدة.', revoked: 'أُلغيت هذه الدعوة.' };
const fmt = (iso: string) => new Date(iso).toLocaleDateString('ar-SA-u-nu-latn', { dateStyle: 'long' });

export default function JoinPage({ params }: { params: { token: string } }) {
  const router = useRouter(); const token = params.token;
  const [inv, setInv] = useState<Inv | null>(null); const [err, setErr] = useState(''); const [me, setMe] = useState<{ email: string; matches: boolean } | null>(null);
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(''); const [done, setDone] = useState<{ roles: string[]; landing: string } | null>(null);
  const [tok, setTok] = useState('');

  async function load() {
    const db = supabase(); let tk = ''; try { const { data } = await db.auth.getSession(); tk = data.session?.access_token || ''; } catch { /* ignore */ }
    setTok(tk);
    const j = await fetch(`/api/roles?token=${encodeURIComponent(token)}`, { headers: tk ? { Authorization: `Bearer ${tk}` } : {}, cache: 'no-store' }).then(r => r.json()).catch(() => null);
    if (!j?.success) { setErr(j?.code === 'not_found' ? 'هذا الرابط غير صحيح أو نُسخ ناقصًا. اطلب الرابط كاملًا من مدير النظام.' : (j?.error || 'تعذّر قراءة الدعوة')); return; }
    setInv(j.invite); setMe(j.me);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  async function magic(e: React.FormEvent) {
    e.preventDefault(); const em = email.trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { setErr('اكتب بريدًا صحيحًا'); return; }
    setBusy(true); setErr('');
    const { error } = await supabase().auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + `/join/${token}` } });
    setBusy(false); if (error) { setErr(error.message); return; }
    setSent(`أرسلنا رابط الدخول إلى ${em}. افتحه من هذا الجهاز وستعود إلى هذه الصفحة لقبول الدعوة.`);
  }
  async function accept() {
    setBusy(true); setErr('');
    const j = await fetch('/api/roles', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'accept', token }) }).then(r => r.json()).catch(() => null);
    setBusy(false); if (!j?.success) { setErr(j?.error || 'تعذّر القبول'); return; }
    setDone({ roles: j.roles, landing: j.landing }); setTimeout(() => router.replace(j.landing), 1400);
  }
  async function signOut() { await supabase().auth.signOut(); setMe(null); setTok(''); }

  return (
    <PortalShell><main className="jn" dir="rtl" id="main"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="jn-card" data-testid="join-card">
        <div className="jn-kicker"><Icon name="mail" size={14} /> دعوة إلى بوابة أَثَر</div>
        {err && !inv && <p className="jn-err" data-testid="join-error">{err}</p>}
        {!inv && !err && <p className="jn-muted">جارٍ فتح الدعوة…</p>}
        {inv && (<>
          <h1>{inv.kind === 'group' ? `أهلًا بك في «${inv.label || 'دعوة جماعية'}»` : inv.full_name ? `أهلًا ${inv.full_name}` : 'أهلًا بك'}</h1>
          <p className="jn-lead">{inv.kind === 'group' ? 'دعوة جماعية من إدارة أَثَر للانضمام بصفة:' : 'دعاك مدير النظام للانضمام بصفة:'}</p>
          <ul className="jn-roles" data-testid="join-roles">{inv.roles.map(r => <li key={r.code}><b>{r.name_ar}</b><span>{r.name_en}</span></li>)}</ul>
          {inv.org && <p className="jn-org"><Icon name="users" size={14} /> الجهة: <b>{inv.org}</b></p>}
          {inv.message && <blockquote className="jn-msg">{inv.message}</blockquote>}
          {inv.kind === 'group' ? <p className="jn-muted" data-testid="join-seats">دعوة جماعية · المقاعد المتبقية <b>{inv.seats_left ?? '—'}</b> من {inv.max_uses} · صالحة حتى {fmt(inv.expires_at)} · تدخل ببريدك أنت</p> : <p className="jn-muted">الدعوة باسم البريد <code dir="ltr">{inv.email_masked}</code> · صالحة حتى {fmt(inv.expires_at)}</p>}

          {inv.state !== 'pending' && !done && <p className="jn-err" data-testid="join-state">{inv.kind === 'group' && inv.state === 'accepted' ? 'اكتملت مقاعد هذه الدعوة — اطلب من إدارة أَثَر دعوة جديدة' : STATE_AR[inv.state]}</p>}
          {done && <p className="jn-ok" data-testid="join-done"><Icon name="check" size={16} /> تمّ — صرت الآن: {done.roles.join(' · ')}. نفتح بابك…</p>}
          {inv.state === 'pending' && !done && !me && (
            <form onSubmit={magic} className="jn-form" data-testid="join-login">
              <label htmlFor="jn-email">{inv.kind === 'group' ? 'ادخل ببريدك' : 'ادخل ببريد الدعوة نفسه'}</label>
              <input id="jn-email" type="email" dir="ltr" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
              {sent ? <p className="jn-ok">{sent}</p> : <button type="submit" disabled={busy}><Icon name="send" size={16} /> أرسل لي رابط الدخول</button>}
              {err && <p className="jn-err">{err}</p>}
              <p className="jn-muted">بلا كلمة مرور — رابط واحد لمرة واحدة يعود بك إلى هنا.</p>
            </form>
          )}
          {inv.state === 'pending' && !done && me && me.matches && (
            <div className="jn-form"><p>أنت داخل باسم <code dir="ltr">{me.email}</code>{inv.kind === 'group' ? ' — سيُفتح بابك بهذا البريد.' : ' — وهو بريد الدعوة.'}</p>
              <button type="button" onClick={accept} disabled={busy} data-testid="join-accept"><Icon name="check" size={16} /> {busy ? 'لحظة…' : 'أقبل الدعوة وافتح بابي'}</button>
              {err && <p className="jn-err">{err}</p>}
            </div>
          )}
          {inv.state === 'pending' && !done && me && !me.matches && (
            <div className="jn-form"><p className="jn-err" data-testid="join-mismatch">أنت داخل الآن باسم <code dir="ltr">{me.email}</code> وهو ليس بريد الدعوة. اخرج ثم ادخل بالبريد الذي وصلته الدعوة.</p>
              <button type="button" onClick={signOut}><Icon name="x" size={16} /> الخروج والدخول بالبريد الصحيح</button>
            </div>
          )}
        </>)}
        <p className="jn-foot"><Link href="/">بوابة أَثَر</Link> · <Link href="/help">مساعدة</Link></p>
      </section>
    </main></PortalShell>
  );
}

const CSS = `
.jn{min-height:70vh;display:grid;place-items:center;padding:28px 14px;background:radial-gradient(1000px 500px at 50% -10%,#e9f4f3,transparent 60%),#f6f8fb;font-family:inherit}
.jn-card{width:100%;max-width:560px;background:#fff;border:1px solid #e5e9f0;border-radius:22px;padding:26px 24px;box-shadow:0 20px 50px -30px rgba(15,42,78,.35)}
.jn-kicker{display:inline-flex;gap:6px;align-items:center;color:#0b8a83;font-weight:800;font-size:13px;background:#e6f4f3;padding:5px 10px;border-radius:999px}
.jn h1{margin:14px 0 4px;color:#0f2a4e;font-size:26px}.jn-lead{margin:0 0 10px;color:#334155}
.jn-roles{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:8px}.jn-roles li{display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid #e5e9f0;border-right:4px solid #c9a24b;border-radius:12px;padding:10px 12px}.jn-roles b{color:#0f2a4e}.jn-roles span{color:#64748b;font-size:12px;direction:ltr}
.jn-org{display:flex;gap:6px;align-items:center;color:#334155;margin:0 0 8px}
.jn-msg{margin:8px 0 12px;padding:10px 14px;border-right:3px solid #0b8a83;background:#f8fafc;border-radius:10px;color:#334155;line-height:1.8}
.jn-muted{color:#64748b;font-size:13px;line-height:1.7}.jn-muted code{background:#f1f5f9;padding:1px 6px;border-radius:6px}
.jn-form{margin-top:14px;padding-top:14px;border-top:1px dashed #e5e9f0;display:grid;gap:10px}.jn-form label{font-weight:800;color:#0f2a4e}
.jn-form input{border:1.5px solid #cbd5e1;border-radius:12px;padding:11px 12px;font-size:16px;font-family:inherit}.jn-form input:focus-visible{outline:3px solid #0b8a83;outline-offset:1px}
.jn-form button{display:inline-flex;gap:8px;align-items:center;justify-content:center;border:0;border-radius:12px;padding:12px 16px;background:#0f2a4e;color:#fff;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;min-height:44px}.jn-form button:disabled{opacity:.6;cursor:wait}
.jn-ok{display:flex;gap:6px;align-items:center;color:#065f46;background:#ecfdf5;border-radius:10px;padding:10px 12px;margin:0;line-height:1.7}.jn-err{color:#991b1b;background:#fef2f2;border-radius:10px;padding:10px 12px;margin:0;line-height:1.7}
.jn-foot{margin:18px 0 0;text-align:center;color:#94a3b8;font-size:12px}.jn-foot a{color:#0b8a83;text-decoration:none}
@media (prefers-reduced-motion:reduce){.jn *{transition:none!important}}
`;
