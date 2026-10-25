'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — صفحة التحقق من الشهادة الرقمية (عامة): الحالة، صاحبها، المهارات، الأطر، وتنزيل Open Badge

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { fmtDate } from '../../../lib/portal/content';
import { credentialKindLabel } from '../../../lib/portal/profile';

export default function CredentialPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }
type V = { ok: boolean; code?: string; kind?: string; title_ar?: string; title_en?: string | null; full_name?: string | null; level?: string | null; hours?: number | null; issued_at?: string; valid_until?: string | null; revoked?: boolean; program?: string | null; skills?: { code: string; name_ar: string; name_en: string }[]; badge?: Record<string, unknown> };

function Inner() {
  const { lang } = useLang(); const params = useParams<{ code: string }>(); const code = String(params?.code || ''); const db = useMemo(() => supabase(), []);
  const [v, setV] = useState<V | null>(null);
  useEffect(() => { (async () => { try { const { data } = await db.rpc('portal_verify_credential', { p_code: code }); setV((data as V) || { ok: false }); } catch { setV({ ok: false }); } })(); }, [db, code]);
  const expired = !!(v?.valid_until && new Date(v.valid_until) < new Date()); const status = !v?.ok ? 'notfound' : v.revoked ? 'revoked' : expired ? 'expired' : 'valid';
  const download = () => { if (!v?.badge) return; const blob = new Blob([JSON.stringify(v.badge, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `athar-credential-${v.code}.json`; document.body.appendChild(a); a.click(); a.remove(); };
  return (
    <main className="pt-main cv">
      <section className="pt-pagehead"><div className="pt-wrap"><div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link> / <span>{lang === 'ar' ? 'التحقق من شهادة رقمية' : 'Credential verification'}</span></div><h1>{lang === 'ar' ? 'التحقق من شهادة رقمية' : 'Verify a digital credential'}</h1><p dir="ltr" style={{ fontFamily: 'monospace' }}>{code}</p></div></section>
      <section className="pt-sec"><div className="pt-wrap" style={{ maxWidth: 760 }}>
        {!v && <div className="pt-empty">…</div>}
        {v && <div className={`cv-card ${status}`}>
          <div className="cv-status">{status === 'valid' && <><Icon name="check" size={22} /> {lang === 'ar' ? 'شهادة صحيحة وسارية' : 'Valid credential'}</>}{status === 'revoked' && <><Icon name="x" size={22} /> {lang === 'ar' ? 'شهادة ملغاة' : 'Revoked credential'}</>}{status === 'expired' && <><Icon name="clock" size={22} /> {lang === 'ar' ? 'شهادة منتهية الصلاحية' : 'Expired credential'}</>}{status === 'notfound' && <><Icon name="alert" size={22} /> {lang === 'ar' ? 'لا توجد شهادة بهذا الرمز' : 'No credential matches this code'}</>}</div>
          {v.ok && <>
            <h2>{lang === 'en' && v.title_en ? v.title_en : v.title_ar}</h2>
            <div className="cv-grid"><div><small>{lang === 'ar' ? 'صاحب الشهادة' : 'Holder'}</small><b>{v.full_name || '—'}</b></div><div><small>{lang === 'ar' ? 'النوع' : 'Type'}</small><b>{credentialKindLabel(v.kind || '', lang)}</b></div>{v.program && <div><small>{lang === 'ar' ? 'البرنامج' : 'Program'}</small><b>{v.program}</b></div>}{v.level && <div><small>{lang === 'ar' ? 'المستوى' : 'Level'}</small><b dir="ltr">{v.level}</b></div>}{v.hours && <div><small>{lang === 'ar' ? 'الساعات' : 'Hours'}</small><b>{v.hours}</b></div>}<div><small>{lang === 'ar' ? 'تاريخ الإصدار' : 'Issued'}</small><b><bdi>{fmtDate(v.issued_at, lang)}</bdi></b></div>{v.valid_until && <div><small>{lang === 'ar' ? 'صالحة حتى' : 'Valid until'}</small><b><bdi>{fmtDate(v.valid_until, lang)}</bdi></b></div>}<div><small>{lang === 'ar' ? 'جهة الإصدار' : 'Issuer'}</small><b>{lang === 'ar' ? 'أَثَر — بوابة التعليم والتدريب والتطوير' : 'Athar · TRACE'}</b></div></div>
            {v.skills && v.skills.length > 0 && <div className="cv-skills"><small>{lang === 'ar' ? 'المهارات الموثّقة' : 'Certified skills'}</small><div className="pt-chips">{v.skills.map(s => <span key={s.code} className="pt-chip">{s.code} · {lang === 'en' ? s.name_en : s.name_ar}</span>)}</div></div>}
            <div className="pt-chips" style={{ marginTop: 14 }}><button type="button" className="pt-btn light small" onClick={download}><Icon name="download" size={13} /> Open Badge 3.0 (JSON)</button><button type="button" className="pt-btn ghost small" onClick={() => window.print()}><Icon name="print" size={13} /> {lang === 'ar' ? 'طباعة' : 'Print'}</button></div>
          </>}
        </div>}
        <p className="pt-muted" style={{ marginTop: 16 }}>{lang === 'ar' ? 'الشهادات الرقمية في أَثَر تُصدر بصيغة Open Badges 3.0 القابلة للتحقق، وترتبط بسجل تعلّم المتعلم ومهاراته المربوطة بالأطر المرجعية.' : 'Athar digital credentials follow the verifiable Open Badges 3.0 format and link to the learner’s framework-aligned skills record.'}</p>
      </div></section>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}
const CSS = `
.cv-card{background:#fff;border:2px solid #e2e8f0;border-radius:20px;padding:22px 24px}.cv-card.valid{border-color:#059669}.cv-card.revoked{border-color:#dc2626}.cv-card.expired{border-color:#d97706}.cv-card.notfound{border-color:#cbd5e1}
.cv-status{display:flex;gap:8px;align-items:center;font-weight:900;font-size:16px;color:#0f172a;margin-bottom:10px}.cv-card.valid .cv-status{color:#065f46}.cv-card.revoked .cv-status{color:#991b1b}.cv-card.expired .cv-status{color:#9a3412}
.cv-card h2{margin:0 0 14px;font-size:22px;color:#0f2a4e}.cv-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.cv-grid div{border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;background:#f8fafc}.cv-grid small{display:block;color:#64748b;font-size:11.5px}.cv-grid b{font-size:14px;color:#0f172a}
.cv-skills{margin-top:12px}.cv-skills small{display:block;color:#64748b;font-size:12px;margin-bottom:6px}.pt-muted{color:#64748b;font-size:13px;line-height:1.8}
@media(max-width:640px){.cv-grid{grid-template-columns:1fr 1fr}}@media print{.pt-header,.pt-footer,.pt-pagehead{display:none!important}}
`;
