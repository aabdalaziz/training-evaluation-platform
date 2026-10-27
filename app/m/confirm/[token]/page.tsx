'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — تأكيد المشرف (P12-أ): صفحة بلا تسجيل دخول برابط موقّع. يرى الدليل الحقيقي والمعيار والفحص الأولي، ويؤكد أو يعيد بضغطة واحدة.
// «الذكاء الاصطناعي يقترح — والإنسان يعتمد»: تأكيد المشرف هو ما يرفع وزن الدليل في ملف المتدرب وتوأمه وشهادته الحية.

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '../../../../lib/ui/icons';
import { PortalShell, useLang } from '../../../components/PortalShell';
import { fmtDate } from '../../../../lib/portal/content';
import { MODE_LABEL, statusLabel, STATUS_LABEL } from '../../../../lib/portal/missions';
import type { Mission } from '../../../../lib/portal/missions';

export default function ConfirmPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }
type View = { ok: boolean; mission?: Omit<Mission, 'token' | 'confirm_token' | 'supervisor_email'>; file_url?: string | null; skills?: { id: string; name_ar: string; name_en: string }[]; program?: string | null };

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const params = useParams<{ token: string }>(); const token = String(params?.token || '');
  const [v, setV] = useState<View | null>(null); const [name, setName] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [done, setDone] = useState<'confirmed' | 'returned' | null>(null);
  useEffect(() => { (async () => { try { const j = await fetch(`/api/m?confirm=${encodeURIComponent(token)}`).then(x => x.json()); setV(j.success ? j : { ok: false }); if (j?.mission?.supervisor_name) setName(j.mission.supervisor_name); } catch { setV({ ok: false }); } })(); }, [token]);
  async function decide(action: 'confirm' | 'return') {
    setBusy(action); setErr('');
    try { const j = await fetch('/api/m', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, confirm_token: token, name, note }) }).then(x => x.json()); if (!j.success) throw new Error(j.error); setDone(action === 'confirm' ? 'confirmed' : 'returned'); setV(x => x ? { ...x, mission: j.mission } : x); }
    catch (e: any) { setErr(e?.message || 'خطأ'); } finally { setBusy(''); }
  }
  const m = v?.mission; const ev = m?.evidence; const canAct = !!m && m.status === 'submitted' && !done;

  return (
    <main className="pt-main mc">
      <section className="pt-pagehead"><div className="pt-wrap"><div className="pt-crumbs"><Link href="/">{ar ? 'الرئيسية' : 'Home'}</Link> / <span>{ar ? 'تأكيد دليل من قلب العمل' : 'Confirm workplace evidence'}</span></div>
        <h1>{ar ? 'دقيقة واحدة تُثبت الأثر' : 'One minute to confirm impact'}</h1>
        <p className="pt-lead">{ar ? 'أنجز متدربك مهمة صغيرة من عمله الحقيقي بعد برنامج تدريبي. اطّلع على الدليل مقابل المعيار، ثم أكّد أو أعِد. تأكيدك — لا الخوارزمية — هو ما يُعتمد.' : 'Your trainee completed a small real-work mission after a training program. Review the evidence against the standard, then confirm or return. Your confirmation — not the algorithm — is what counts.'}</p>
      </div></section>
      <section className="pt-sec"><div className="pt-wrap" style={{ maxWidth: 820 }}>
        {!v && <div className="pt-empty">…</div>}
        {v && !v.ok && <div className="pt-box pt-empty"><Icon name="alert" size={30} /><h3>{ar ? 'الرابط غير صالح' : 'Invalid link'}</h3></div>}
        {m && <>
          {done && <div className="pt-alert ok mc-done"><Icon name="check" size={16} /> {done === 'confirmed' ? (ar ? 'شكرًا — تم التأكيد. أصبح الدليل كامل الوزن في ملف المتدرب، وأُبلغ بذلك.' : 'Thank you — confirmed. The evidence is now full-weight in the trainee’s profile.') : (ar ? 'أُعيدت المهمة إلى المتدرب مع ملاحظتك.' : 'Returned to the trainee with your note.')}</div>}
          {!done && m.status !== 'submitted' && <div className="pt-alert ok mc-done">{ar ? `حالة المهمة: ${statusLabel(m.status, lang)}${m.confirmed_by ? ` — بواسطة ${m.confirmed_by}` : ''}` : `Status: ${statusLabel(m.status, lang)}`}</div>}
          <div className="pt-box mc-card">
            <div className="mc-head"><div><small>{v?.program ? (ar ? `بعد برنامج «${v.program}»` : `After “${v.program}”`) : (ar ? 'مهمة من قلب العمل' : 'Workflow mission')}</small><h2>{m.title_ar}</h2><p>{ar ? 'المتدرب:' : 'Trainee:'} <b>{m.full_name || m.email}</b> · {ar ? 'أُرسل في' : 'Submitted'} {fmtDate(m.submitted_at || m.created_at, lang)}</p></div><span className="mc-st" style={{ ['--c' as any]: STATUS_LABEL[m.status].color }}>{statusLabel(m.status, lang)}</span></div>
            <div className="mc-two">
              <div>
                <h4>{ar ? 'ما طُلب منه' : 'What was asked'}</h4><p className="mc-brief">{m.brief_ar}</p>
                <h4>{ar ? 'المعيار' : 'Standard'}</h4><ol className="mc-rubric">{m.rubric.map((c, i) => { const chk = m.ai?.criteria?.[i]; return <li key={i} className={chk?.met || ''}><span>{c.c}</span>{chk && <small>{chk.met === 'yes' ? (ar ? 'ورد' : 'present') : chk.met === 'partly' ? (ar ? 'جزئيًا' : 'partly') : (ar ? 'لم يرد' : 'missing')}</small>}</li>; })}</ol>
                {m.ai && <div className="mc-ai"><b>{ar ? 'الفحص الأولي' : 'First check'} {m.ai.score}% <small>({m.ai.source === 'ai' ? (ar ? 'ذكاء اصطناعي' : 'AI') : (ar ? 'فاحص محلي' : 'local')})</small></b><p>{m.ai.feedback_ar}</p>{!!m.ai.questions_ar?.length && <><small>{ar ? 'ما نرجو أن تتحقق منه:' : 'Please verify:'}</small><ul>{m.ai.questions_ar.map((q, i) => <li key={i}>{q}</li>)}</ul></>}</div>}
              </div>
              <div className="mc-ev">
                <h4><Icon name="doc" size={14} /> {ar ? 'الدليل' : 'Evidence'} — {MODE_LABEL[m.evidence_mode][lang]}</h4>
                {ev?.file_path && v?.file_url && (m.evidence_mode === 'photo' ? <a href={v.file_url} target="_blank" rel="noopener noreferrer"><img src={v.file_url} alt="" /></a> : <audio controls src={v.file_url} />)}
                {ev?.file_path && !v?.file_url && <small>{ar ? 'تعذّر تحميل الملف — أعد فتح الرابط.' : 'File unavailable — reopen the link.'}</small>}
                {ev?.duration_s ? <small>{ar ? `مدة التسجيل ${ev.duration_s} ث` : `${ev.duration_s}s`}</small> : null}
                {ev?.link && <p><a href={ev.link} target="_blank" rel="noopener noreferrer" dir="ltr">{ev.link}</a></p>}
                {(ev?.text || ev?.caption) && <blockquote>{ev.text || ev.caption}</blockquote>}
                {ev?.transcript && <details><summary>{ar ? 'النسخة النصية التقريبية' : 'Approximate transcript'}</summary><p>{ev.transcript}</p></details>}
                {!ev && <small>{ar ? 'لم يُرسل دليل بعد.' : 'No evidence yet.'}</small>}
              </div>
            </div>
            {canAct && <div className="mc-form">
              {err && <div className="pt-alert err">{err}</div>}
              <div className="mc-row"><input value={name} onChange={e => setName(e.target.value)} placeholder={ar ? 'اسمك (يظهر للمتدرب)' : 'Your name'} /><input value={note} onChange={e => setNote(e.target.value)} placeholder={ar ? 'ملاحظة للمتدرب (اختيارية عند التأكيد، مطلوبة عند الإعادة)' : 'Note to trainee'} /></div>
              <div className="mc-btns"><button className="pt-btn gold" disabled={!!busy || name.trim().length < 2} onClick={() => decide('confirm')}><Icon name="check" size={16} /> {busy === 'confirm' ? '…' : (ar ? 'أؤكد: رأيت هذا في عمله' : 'I confirm: I saw this at work')}</button><button className="pt-btn ghost" disabled={!!busy || name.trim().length < 2} onClick={() => decide('return')}><Icon name="refresh" size={16} /> {busy === 'return' ? '…' : (ar ? 'أعِدها إليه مع ملاحظة' : 'Return with a note')}</button></div>
              <small>{ar ? 'بتأكيدك تقرّ أنك شاهدت هذا الدليل أو ما يدل عليه في بيئة العمل. لا يُستخدم الدليل خارج ملف المتدرب.' : 'By confirming you attest you have seen this evidence (or its effect) at work.'}</small>
            </div>}
          </div>
          <p className="mc-foot">{ar ? 'ما «المهمات في قلب العمل»؟ بدل استبانة «هل طبّقت؟» بعد التدريب، تطلب منصة أَثَر دليلًا صغيرًا حقيقيًا، وتبني من مجموع الأدلة المؤكَّدة أول قاعدة عربية لانتقال أثر التدريب.' : 'Instead of a “did you apply it?” survey, Athar asks for a small real piece of evidence and builds the first Arabic base of confirmed training-transfer evidence.'}</p>
        </>}
      </div></section>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

const CSS = `
.mc-card{padding:0;overflow:hidden}.mc-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:16px 18px;background:linear-gradient(135deg,#0f2a4e,#163a66);color:#fff}.mc-head small{opacity:.8;font-size:12px}.mc-head h2{margin:2px 0 4px;font-size:20px}.mc-head p{margin:0;font-size:13px;opacity:.9}
.mc-st{background:rgba(255,255,255,.12);box-shadow:inset 0 0 0 2px var(--c);border-radius:999px;padding:5px 12px;font-size:12px;font-weight:800;white-space:nowrap}
.mc-two{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px 18px}.mc-two h4{margin:0 0 6px;font-size:13px;color:#0b8a83}
.mc-brief{margin:0 0 12px;color:#334155;font-size:13.5px;line-height:1.8}
.mc-rubric{margin:0 0 12px;padding-inline-start:18px;display:grid;gap:5px}.mc-rubric li{display:flex;justify-content:space-between;gap:8px;font-size:13.5px}.mc-rubric li small{font-size:11px;border-radius:999px;padding:1px 8px;background:#f1f5f9;color:#475569;white-space:nowrap}.mc-rubric li.yes small{background:#dcfce7;color:#166534}.mc-rubric li.partly small{background:#fef3c7;color:#92400e}.mc-rubric li.no small{background:#fee2e2;color:#991b1b}
.mc-ai{background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:10px 12px;font-size:13px}.mc-ai b{display:block;color:#0f2a4e}.mc-ai b small{font-weight:400;color:#64748b}.mc-ai p{margin:4px 0 6px;color:#334155;line-height:1.7}.mc-ai ul{margin:2px 0 0;padding-inline-start:18px;color:#0f172a}
.mc-ev{background:#fbfbf7;border:1px solid #efe6cf;border-radius:14px;padding:12px}.mc-ev h4{display:flex;align-items:center;gap:6px}.mc-ev img{display:block;max-width:100%;max-height:360px;border-radius:10px;margin:0 auto 8px;box-shadow:0 6px 20px rgba(15,23,42,.12)}.mc-ev audio{width:100%;margin-bottom:6px}
.mc-ev blockquote{margin:8px 0;border-inline-start:3px solid #c9a24b;padding:4px 12px;color:#0f172a;font-size:14px;line-height:1.9;white-space:pre-wrap}.mc-ev details{font-size:13px;color:#475569}.mc-ev details p{white-space:pre-wrap;line-height:1.8}.mc-ev small{color:#64748b;font-size:11.5px}
.mc-form{border-top:1px solid #e2e8f0;padding:14px 18px;display:grid;gap:10px;background:#fff}.mc-row{display:grid;grid-template-columns:1fr 2fr;gap:8px}.mc-row input{border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px}
.mc-btns{display:flex;gap:10px;flex-wrap:wrap}.mc-form small{color:#64748b;font-size:11.5px;line-height:1.7}
.mc-done{margin-bottom:12px;display:flex;gap:8px;align-items:center}
.mc-foot{color:#64748b;font-size:12.5px;line-height:1.8;margin-top:14px;text-align:center}
@media(max-width:760px){.mc-two{grid-template-columns:1fr}.mc-row{grid-template-columns:1fr}.mc-head{flex-direction:column}}
`;
