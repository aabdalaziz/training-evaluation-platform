'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P80 */
/**
 * التوثيق الثنائي (عميل): ثلاث حالات —
 *  ① تحدٍّ (challenge=1): جلسة aal1 ولدى المستخدم عامل → رمز 6 أرقام → aal2 → العودة إلى next.
 *  ② تفعيل: enroll(totp) → QR محلّي + المفتاح نصًّا → verify → مفعَّل.
 *  ③ مفعَّل: عرض الحالة + إلغاء (يتطلّب aal2).
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalShell } from '../../components/PortalShell';
import { Icon } from '../../../lib/ui/icons';
import { supabase } from '../../../lib/supabase/client';
import { qrSvg } from '../../../lib/certificates/qr';
import { otpauthUri, isTotpCode, MFA_ROLES, requiredFrom } from '../../../lib/shield/mfa';

const CSS = `
.mf{max-width:680px;margin:0 auto;padding:28px 16px 70px;color:#2A1626}
.mf-card{background:#fff;border:2px solid #EADFD6;border-radius:22px;padding:22px;box-shadow:0 8px 24px rgba(58,31,54,.06);margin-bottom:14px}
.mf h1{color:#3A1F36;margin:0 0 6px;font-size:26px;display:flex;gap:10px;align-items:center}
.mf p{line-height:1.9;color:#5A4756;margin:0 0 10px}
.mf-qr{display:flex;gap:18px;align-items:center;flex-wrap:wrap;background:#FBF4EE;border-radius:16px;padding:14px}
.mf-qr svg{width:170px;height:170px;background:#fff;border-radius:12px;padding:8px}
.mf-secret{direction:ltr;font-family:ui-monospace,Menlo,monospace;letter-spacing:2px;font-weight:800;background:#fff;border-radius:10px;padding:8px 12px;display:inline-block;word-break:break-all}
.mf-code{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}
.mf-code input{font:inherit;font-size:24px;letter-spacing:8px;direction:ltr;text-align:center;width:190px;padding:8px;border:2px solid #EADFD6;border-radius:12px}
.mf-btn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:8px 20px;border-radius:999px;border:2px solid #E8795C;background:#E8795C;color:#fff;font-weight:800;cursor:pointer;font-size:15px;text-decoration:none}
.mf-btn.ghost{background:#fff;color:#3A1F36;border-color:#D9CBC2}.mf-btn.warn{background:#fff;color:#B9544A;border-color:#B9544A}
.mf-btn:disabled{opacity:.5;cursor:not-allowed}
.mf-ok{background:#E9F6F1;border:2px solid #5EA8A0;border-radius:14px;padding:12px 14px;color:#1F5F5A;font-weight:700}
.mf-err{color:#B9544A;font-weight:700;margin-top:8px}
.mf-muted{color:#8E7F8A;font-size:13.5px}
.mf-steps{margin:0;padding-inline-start:20px;line-height:2}
`;
type Factor = { id: string; status: 'verified' | 'unverified'; friendly_name?: string | null; created_at?: string };

export default function MfaClient({ challenge, next }: { challenge: boolean; next: string | null }) {
  const router = useRouter(); const sb = useMemo(() => supabase(), []);
  const [email, setEmail] = useState(''); const [role, setRole] = useState(''); const [factors, setFactors] = useState<Factor[] | null>(null); const [aal, setAal] = useState<string>('aal1');
  const [enrol, setEnrol] = useState<{ id: string; secret: string; uri: string } | null>(null); const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState('');
  const safeNext = next && /^\/(?!\/)[\w\-./?=&%#]*$/.test(next) ? next : '/hub';
  const mustEnrol = MFA_ROLES.includes(role) && !!requiredFrom(process.env as any);

  async function load() {
    const { data: s } = await sb.auth.getSession(); if (!s.session) { router.replace(`/login?next=${encodeURIComponent(`/security/mfa${challenge ? '?challenge=1' : ''}`)}`); return; }
    setEmail(String(s.session.user.email || ''));
    const { data: prof } = await sb.from('profiles').select('role').eq('id', s.session.user.id).maybeSingle(); setRole(String((prof as any)?.role || '').toUpperCase());
    const { data: f } = await sb.auth.mfa.listFactors(); setFactors(((f?.totp || []) as Factor[]));
    const { data: a } = await sb.auth.mfa.getAuthenticatorAssuranceLevel(); setAal(a?.currentLevel || 'aal1');
    if (a && a.currentLevel === 'aal2' && challenge) router.replace(safeNext);
  }
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verified = (factors || []).filter((f) => f.status === 'verified');

  async function startEnrol() { setBusy(true); setErr(''); try {
    for (const f of (factors || []).filter((x) => x.status === 'unverified')) await sb.auth.mfa.unenroll({ factorId: f.id }).catch(() => null); // تنظيف محاولات سابقة
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'تطبيق المصادقة' }); if (error || !data) { setErr(explain(error?.message)); return; }
    setEnrol({ id: data.id, secret: data.totp.secret, uri: otpauthUri({ secret: data.totp.secret, email, issuer: 'Athar' }) });
  } finally { setBusy(false); } }

  async function verifyEnrol() { if (!enrol || !isTotpCode(code)) return; setBusy(true); setErr(''); try {
    const { data: ch, error: e1 } = await sb.auth.mfa.challenge({ factorId: enrol.id }); if (e1 || !ch) { setErr(explain(e1?.message)); return; }
    const { error: e2 } = await sb.auth.mfa.verify({ factorId: enrol.id, challengeId: ch.id, code: code.replace(/\s/g, '') }); if (e2) { setErr(explain(e2.message)); return; }
    setEnrol(null); setCode(''); setDone('تمّ تفعيل التوثيق الثنائي. من الآن يُطلب رمز التطبيق عند كلّ دخول.'); await load();
  } finally { setBusy(false); } }

  async function doChallenge() { const f = verified[0]; if (!f || !isTotpCode(code)) return; setBusy(true); setErr(''); try {
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: f.id, code: code.replace(/\s/g, '') }); if (error) { setErr(explain(error.message)); return; }
    router.replace(safeNext); router.refresh();
  } finally { setBusy(false); } }

  async function unenrol(f: Factor) { if (!confirm('إلغاء التوثيق الثنائي؟ سيضعف حماية حسابك.')) return; setBusy(true); setErr(''); try {
    const { error } = await sb.auth.mfa.unenroll({ factorId: f.id }); if (error) { setErr(/aal2|assurance/i.test(error.message) ? 'أدخل رمز التطبيق أولًا (الإلغاء يتطلّب جلسة موثَّقة) ثم أعد المحاولة.' : explain(error.message)); return; }
    setDone('أُلغي التوثيق الثنائي.'); await load();
  } finally { setBusy(false); } }

  return (
    <PortalShell>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="mf" dir="rtl">
        <div className="mf-card">
          <h1><Icon name="shield" size={24} /> التوثيق الثنائي</h1>
          <p>طبقة ثانية فوق كلمة المرور: رمز متغيّر من تطبيق مصادقة على هاتفك (Google Authenticator · Microsoft Authenticator · Authy). {MFA_ROLES.includes(role) ? <b>دورك إداري — {mustEnrol ? 'التفعيل إلزامي.' : 'التفعيل موصًى به بشدّة.'}</b> : null}</p>
          {factors === null ? <p className="mf-muted">… جارٍ التحميل</p> : null}
          {done ? <div className="mf-ok">{done}</div> : null}
        </div>

        {factors && challenge && verified.length ? (
          <div className="mf-card"><h1 style={{ fontSize: 20 }}>أدخل رمز التطبيق</h1><p>افتح تطبيق المصادقة واكتب الرمز المكوّن من 6 أرقام لحساب <b>{email}</b>.</p>
            <form className="mf-code" onSubmit={(e) => { e.preventDefault(); void doChallenge(); }}><input autoFocus inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" aria-label="رمز التوثيق" /><button className="mf-btn" disabled={busy || !isTotpCode(code)}><Icon name="login" size={16} /> تأكيد</button></form>
            {err ? <div className="mf-err">{err}</div> : null}</div>
        ) : null}

        {factors && !verified.length ? (
          <div className="mf-card"><h1 style={{ fontSize: 20 }}>تفعيل التوثيق الثنائي</h1>
            {!enrol ? <><ol className="mf-steps"><li>ثبّت تطبيق مصادقة على هاتفك.</li><li>اضغط «ابدأ التفعيل» وامسح رمز QR (أو انسخ المفتاح).</li><li>اكتب الرمز الذي يعرضه التطبيق للتأكيد.</li></ol><button className="mf-btn" onClick={startEnrol} disabled={busy}><Icon name="qr" size={16} /> ابدأ التفعيل</button></>
              : <><div className="mf-qr"><span dangerouslySetInnerHTML={{ __html: qrSvg(enrol.uri, 170) }} /><div><div className="mf-muted">أو أدخل المفتاح يدويًّا:</div><div className="mf-secret">{enrol.secret}</div><div className="mf-muted" style={{ marginTop: 6 }}>الحساب: {email} · الجهة: Athar</div></div></div>
                <form className="mf-code" onSubmit={(e) => { e.preventDefault(); void verifyEnrol(); }}><input autoFocus inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" aria-label="رمز التأكيد" /><button className="mf-btn" disabled={busy || !isTotpCode(code)}><Icon name="check" size={16} /> تأكيد التفعيل</button><button type="button" className="mf-btn ghost" onClick={() => { setEnrol(null); setCode(''); }}>إلغاء</button></form></>}
            {err ? <div className="mf-err">{err}</div> : null}</div>
        ) : null}

        {factors && verified.length && !challenge ? (
          <div className="mf-card"><div className="mf-ok"><Icon name="check" size={16} /> التوثيق الثنائي مفعَّل · مستوى الجلسة الحالية: {aal === 'aal2' ? 'موثَّقة بالكامل' : 'بكلمة المرور فقط'}</div>
            {aal !== 'aal2' ? <p style={{ marginTop: 10 }}><Link className="mf-btn ghost" href="/security/mfa?challenge=1&next=/security/mfa">أدخل رمز التطبيق الآن</Link></p> : null}
            <p className="mf-muted" style={{ marginTop: 10 }}>فقدت هاتفك؟ تواصل مع إدارة أَثَر لإعادة ضبط التوثيق بعد التحقّق من هويّتك.</p>
            <button className="mf-btn warn" onClick={() => unenrol(verified[0])} disabled={busy}><Icon name="x" size={14} /> إلغاء التوثيق الثنائي</button>
            {err ? <div className="mf-err">{err}</div> : null}</div>
        ) : null}
        <div className="mf-muted" style={{ textAlign: 'center' }}><Link href="/hub">← العودة</Link></div>
      </main>
    </PortalShell>
  );
}
function explain(m?: string | null): string { const s = String(m || ''); if (/invalid.*code|code.*invalid|Invalid TOTP/i.test(s)) return 'الرمز غير صحيح أو انتهى — جرّب الرمز التالي في التطبيق.'; if (/MFA.*not enabled|mfa_disabled|not allowed/i.test(s)) return 'التوثيق الثنائي غير مفعَّل في إعدادات Supabase (Authentication ← Multi-Factor ← TOTP).'; return s || 'تعذّر التنفيذ — حاول مرة أخرى'; }
