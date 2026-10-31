'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — الذكاء الاصطناعي المسؤول (P9-أ): سياسة الاستخدام المعلنة، ما يفعله المساعد وما لا يفعله، حالة التفعيل، وسجل الحوكمة للموظفين

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import { PortalShell, useLang } from '../components/PortalShell';
import { BRAND, t } from '../../lib/portal/content';
import { AI_LIMITS, AI_PURPOSE_LABEL } from '../../lib/ai/prompts';
import type { AiPurpose } from '../../lib/ai/prompts';

export default function AiPolicyPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }

type Status = { enabled: boolean; provider: string | null; usage?: Record<string, number>; log?: { id: string; created_at: string; email: string; role: string; purpose: string; source: string; model?: string | null; duration_ms: number; ok: boolean; error?: string | null }[] };
const PURPOSES = Object.keys(AI_LIMITS) as AiPurpose[];

function Inner() {
  const { lang } = useLang(); const db = useMemo(() => supabase(), []); const ar = lang === 'ar';
  const [st, setSt] = useState<Status | null>(null);
  useEffect(() => { (async () => { try { const { data } = await db.auth.getSession(); const tk = data.session?.access_token; const j = await fetch('/api/ai', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} }).then(x => x.json()); if (j.success) setSt(j); else setSt({ enabled: false, provider: null }); } catch { setSt({ enabled: false, provider: null }); } })(); }, [db]);

  const principles = ar ? [
    ['الإنسان يقرر', 'كل مخرجات المساعد اقتراحات؛ اعتماد المهارات، وإصدار الشهادات، والقبول، والتصحيح النهائي — قرارات بشرية دائمًا.'],
    ['حقائقك فقط', 'المساعد يقرأ بياناتك في أَثَر (المهارات، الحضور، التقارير) ولا يختلق أرقامًا أو برامج؛ وإن نقصت البيانات يقول ذلك.'],
    ['أقل البيانات', 'لا نرسل للنموذج إلا ما تحتاجه المهمة، ولا نرسل كلمات مرور أو مدفوعات أو هويات رسمية، ولا تُستخدم بياناتك لتدريب نماذج.'],
    ['شفافية كاملة', 'كل ناتج يحمل وسم «مُولَّد بمساعدة الذكاء الاصطناعي» ومصدره (نموذج أو بديل محلي)، ويُسجَّل الاستدعاء في سجل حوكمة بلا محتوى شخصي.'],
    ['حدود عادلة', 'لكل خدمة حد استخدام يومي لكل مستخدم يحمي الجودة والتكلفة، ويعمل بديل محلي دائمًا إن تعطّل المزوّد.'],
    ['قابل للتعطيل', 'يمكن للإدارة إيقاف الخدمة بالكامل بإزالة مفتاح المزوّد — وتعود كل الصفحات إلى البديل المحلي دون انقطاع.'],
  ] : [
    ['Humans decide', 'Every output is a suggestion; skill approval, credential issuance, admission and final grading are always human decisions.'],
    ['Your facts only', 'The assistant reads your Athar data (skills, attendance, reports) and never invents numbers or programs; if data is missing it says so.'],
    ['Data minimisation', 'Only what the task needs is sent to the model — never passwords, payments or official IDs; your data is not used to train models.'],
    ['Full transparency', 'Every output is labelled “AI-assisted” with its source (model or local fallback) and logged in a governance log without personal content.'],
    ['Fair limits', 'Each service has a daily per-user limit protecting quality and cost; a local fallback always works if the provider is down.'],
    ['Switchable', 'Administrators can disable the service entirely by removing the provider key — all pages fall back locally without interruption.'],
  ];
  const services: { p: AiPurpose; who: string; where: string; href: string }[] = [
    { p: 'impact_brief', who: ar ? 'الإدارة والجودة' : 'Staff & quality', where: ar ? 'تقارير الأثر القطاعية' : 'Sector impact reports', href: '/admin/sector-impact' },
    { p: 'learner_plan', who: ar ? 'المتعلم' : 'Learner', where: ar ? 'ملفي المهاري' : 'My skills profile', href: '/me/skills' },
    { p: 'org_brief', who: ar ? 'مدير الجهة' : 'Organization admin', where: ar ? 'بوابة الجهات' : 'Organizations portal', href: '/org' },
    { p: 'activity_draft', who: ar ? 'المدرب والإدارة' : 'Trainer & staff', where: ar ? 'إدارة البث المباشر' : 'Live sessions admin', href: '/admin/live' },
    { p: 'cv_extract', who: ar ? 'عضو هيئة أَثَر' : 'Athar Faculty member', where: ar ? 'سيرتي في هيئة أَثَر — «ابدأ من سيرتك الذاتية»' : 'My Athar Faculty profile — start from your CV', href: '/me/directory' },
    { p: 'access_simplify', who: ar ? 'أي مسجَّل' : 'Any signed-in user', where: ar ? 'زر «نسخة أبسط» على نبذة البرنامج وموقف اليوم — لا يُعرض قبل اعتماد الطاقم' : 'The "simpler version" button on program and daily-case texts — shown only after staff approval', href: '/accessibility' },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="pt-pagehead"><div className="pt-wrap">
        <span className="pt-kicker"><Icon name="star" size={14} /> {t(BRAND.tagline, lang)}</span>
        <h1>{ar ? 'الذكاء الاصطناعي المسؤول في أَثَر' : 'Responsible AI at Athar'}</h1>
        <p>{ar ? 'نستخدم الذكاء الاصطناعي ليُعين الإنسان لا ليحلّ محله: يلخّص، ويقترح، ويكشف الفجوات — والقرار والاعتماد والتوقيع تبقى للبشر. هذه الصفحة تشرح ما يفعله المساعد بالضبط، وما لا يفعله أبدًا.' : 'We use AI to assist humans, not replace them: it summarises, suggests and reveals gaps — decisions, approvals and signatures stay human. This page explains exactly what the assistant does and never does.'}</p>
        {st && <div className="ai-status"><span className={`ai-dot ${st.enabled ? 'on' : ''}`} />{st.enabled ? (ar ? `المساعد مفعّل (${st.provider})` : `Assistant enabled (${st.provider})`) : (ar ? 'المساعد يعمل بالبديل المحلي (بلا نموذج خارجي حاليًا)' : 'Running on local fallback (no external model now)')}</div>}
      </div></section>

      <section className="pt-sec"><div className="pt-wrap">
        <div className="ai-grid">{principles.map(([h, b]) => <div key={h} className="pt-box"><h3><Icon name="shield" size={18} /> {h}</h3><p className="pt-muted">{b}</p></div>)}</div>

        <div className="pt-box" style={{ marginTop: 18 }}><h3><Icon name="compass" size={18} /> {ar ? 'أين يعمل المساعد؟' : 'Where does it work?'}</h3>
          <div className="ai-table"><table><thead><tr><th>{ar ? 'الخدمة' : 'Service'}</th><th>{ar ? 'لمن' : 'For'}</th><th>{ar ? 'أين' : 'Where'}</th><th>{ar ? 'الحد اليومي' : 'Daily limit'}</th>{st?.usage && <th>{ar ? 'استخدامي اليوم' : 'My usage today'}</th>}</tr></thead>
            <tbody>{services.map(s => <tr key={s.p}><td><b>{AI_PURPOSE_LABEL[s.p][lang]}</b></td><td>{s.who}</td><td><Link href={s.href}>{s.where}</Link></td><td>{AI_LIMITS[s.p]}</td>{st?.usage && <td>{st.usage[s.p] ?? 0}</td>}</tr>)}</tbody></table></div>
        </div>

        <div className="pt-two" style={{ marginTop: 18 }}>
          <div className="pt-box"><h3><Icon name="check" size={18} /> {ar ? 'ما يفعله' : 'What it does'}</h3><ul>
            <li>{ar ? 'يكتب موجزًا تنفيذيًا من أرقام تقرير الأثر، مع المخاطر وما ينقص القياس.' : 'Writes an executive brief from the impact numbers, including risks and measurement gaps.'}</li>
            <li>{ar ? 'يقترح للمتعلم خطة 4–8 أسابيع من البرامج والحقائب والجلسات المتاحة فعلًا.' : 'Suggests a 4–8 week plan for learners from programs, resources and sessions that actually exist.'}</li>
            <li>{ar ? 'يلخّص للجهة فجوات منسوبيها ويقترح برامج مناسبة دون تسمية أفراد.' : 'Summarises an organization’s skill gaps and suggests programs without naming individuals.'}</li>
            <li>{ar ? 'يقترح للمدرب مسودّات أسئلة وأنشطة يعدّلها ويعتمدها قبل النشر.' : 'Drafts questions and activities for trainers to edit and approve before publishing.'}</li>
          </ul></div>
          <div className="pt-box"><h3><Icon name="x" size={18} /> {ar ? 'ما لا يفعله أبدًا' : 'What it never does'}</h3><ul>
            <li>{ar ? 'لا يعتمد مهارة ولا يصدر شهادة ولا يقبل أو يرفض متقدمًا.' : 'Never approves a skill, issues a credential, or admits/rejects an applicant.'}</li>
            <li>{ar ? 'لا يصحّح تصحيحًا نهائيًا ولا يحدد درجة معتمدة.' : 'Never produces final grades.'}</li>
            <li>{ar ? 'لا يرى كلمات المرور أو بيانات الدفع أو الهويات الرسمية.' : 'Never sees passwords, payment data or official IDs.'}</li>
            <li>{ar ? 'لا يُستخدم محتواك لتدريب أي نموذج، ولا يُحفظ نص المطالبات في سجلنا.' : 'Your content is not used to train models, and prompt text is not stored in our log.'}</li>
          </ul></div>
        </div>

        {st?.log && <div className="pt-box" style={{ marginTop: 18 }}><h3><Icon name="table" size={18} /> {ar ? 'سجل الحوكمة (آخر 50 استدعاءً — للموظفين)' : 'Governance log (last 50 — staff)'}</h3>
          {st.log.length === 0 ? <p className="pt-muted">{ar ? 'لا استدعاءات بعد.' : 'No calls yet.'}</p> : <div className="ai-table"><table><thead><tr><th>{ar ? 'الوقت' : 'Time'}</th><th>{ar ? 'المستخدم' : 'User'}</th><th>{ar ? 'الغرض' : 'Purpose'}</th><th>{ar ? 'المصدر' : 'Source'}</th><th>{ar ? 'النموذج' : 'Model'}</th><th>ms</th></tr></thead>
            <tbody>{st.log.map(r => <tr key={r.id}><td dir="ltr">{String(r.created_at).slice(0, 16).replace('T', ' ')}</td><td dir="ltr">{r.email}</td><td>{AI_PURPOSE_LABEL[r.purpose as AiPurpose]?.[lang] || r.purpose}</td><td><span className={`ai-src ${r.source}`}>{r.source}</span>{r.error && <small title={r.error}> ⚠</small>}</td><td dir="ltr">{r.model || '—'}</td><td dir="ltr">{r.duration_ms}</td></tr>)}</tbody></table></div>}
        </div>}

        <p className="pt-muted" style={{ marginTop: 18, fontSize: 13 }}>{ar ? `هذه السياسة جزء من منهجية أَثَر المملوكة لـ${t(BRAND.owner, lang)} © ${BRAND.copyrightYear}، وتُحدَّث مع كل خدمة جديدة.` : `This policy is part of the Athar methodology owned by ${t(BRAND.owner, lang)} © ${BRAND.copyrightYear}, and is updated with every new service.`}</p>
      </div></section>
    </>
  );
}

const CSS = `
.pt-muted{color:#64748b;font-size:13px;line-height:1.8}.pt-box ul{margin:0;padding:0 18px 0 0;font-size:13.5px;line-height:1.8;color:#334155}
.ai-status{display:inline-flex;align-items:center;gap:8px;margin-top:16px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:6px 14px;font-size:13px}
.ai-dot{width:9px;height:9px;border-radius:50%;background:#c9a24b}.ai-dot.on{background:#34d399;box-shadow:0 0 0 4px rgba(52,211,153,.25)}
.ai-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.ai-grid .pt-box p{margin:0;font-size:13.5px;line-height:1.7}
.ai-table{overflow:auto}.ai-table table{width:100%;border-collapse:collapse;font-size:13px}.ai-table th,.ai-table td{padding:8px 10px;border-bottom:1px solid #eef2f7;text-align:start}.ai-table th{background:#f8fafc;color:#0f2a4e;font-size:12px}
.ai-src{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;background:#f1f5f9;color:#475569}.ai-src.ai{background:#e6f4f1;color:#0b8a83}
@media(max-width:860px){.ai-grid{grid-template-columns:1fr}}
`;
