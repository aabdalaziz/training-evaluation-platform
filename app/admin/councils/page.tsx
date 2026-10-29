'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /admin/councils — إدارة «مجالس أَثَر» (P23): المجالس (تشكيل · انعقاد · الكرسي · الدورة · إيقاف/إغلاق) · المتقدمون · المُوفِّق (اقتراح تشكيلات) ·
 *  شهادات أقران بانتظار الطاقم (احتياطيًا بعد مدير الجهة) · خريطة الحكمة (k≥5 و≥2 جهة) → هندسة البرامج التدريبية
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell } from '../../components/PortalShell';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { fastToken } from '../../components/Pocket';
import { supabase } from '../../../lib/supabase/client';

type Data = any;
const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium' }) : '—');

export default function AdminCouncilsPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
  const [tab, setTab] = useState<'councils' | 'form' | 'applicants' | 'pending' | 'wisdom'>('councils');
  const [open, setOpen] = useState<string>(''); const [addEmail, setAddEmail] = useState({ email: '', full_name: '', organization_id: '' });
  const [form, setForm] = useState({ title_ar: '', domain: '', sector_code: '', skill_ids: [] as string[], cycle_weeks: 6, members: [] as { email: string; full_name?: string | null; organization_id?: string | null; user_id?: string | null }[] });
  const [manual, setManual] = useState({ email: '', full_name: '', organization_id: '' }); const [proposals, setProposals] = useState<any[] | null>(null); const [candN, setCandN] = useState(0);
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); }, [db]);
  const load = useCallback(async () => { const t = await fastToken(db); const j = await fetch('/api/councils/admin', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null); if (j?.success) { setD(j); setErr(''); } else setErr(j?.error || 'غير مصرّح'); }, [db]);
  useEffect(() => { if (tok) load(); }, [tok, load]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 5000); };
  async function act(body: any, ok?: string) { setBusy(body.action); const t = await fastToken(db); const j = await fetch('/api/councils/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null); setBusy(''); if (!j?.success) { setErr(j?.error || 'تعذّر'); return null; } setErr(''); if (ok) flash(ok); await load(); return j; }
  async function propose() { setBusy('propose'); const t = await fastToken(db); const q = new URLSearchParams({ propose: '1', skills: form.skill_ids.join(','), domain: form.domain, sector: form.sector_code, size: '5' }); const j = await fetch(`/api/councils/admin?${q}`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null); setBusy(''); if (j?.success) { setProposals(j.proposals || []); setCandN(j.candidates || 0); setErr(''); } else setErr(j?.error || 'تعذّر الاقتراح'); }
  const skillName = (id: string) => d?.skills?.find((s: any) => s.id === id)?.name_ar || id;
  const orgName = (id: string | null | undefined) => d?.organizations?.find((o: any) => o.id === id)?.name_ar || (id ? id.slice(0, 8) : '—');
  const S = d?.summary; const C = d?.constants;
  return (
    <main className="ac" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <PortalAdminTabs counts={{ '/admin/councils': (d?.pending?.length || 0) + (d?.applicants?.length || 0) }} />
      <header className="ac-head"><span className="pt-kicker"><Icon name="users" size={14} /> مجالس أَثَر · الإدارة</span><h1>المجالس</h1><p>المُوفِّق يقترح، والطاقم يعتمد التشكيل. ما يُقال في المجلس يبقى فيه — هنا تُدار الحالات لا المحتوى.</p></header>
      {err && <div className="ac-err" role="alert">{err}</div>}{msg && <div className="ac-ok" role="status">{msg}</div>}
      {d && (
        <>
          <section className="ac-kpis" data-testid="kpis">
            {[['منعقدة', S.active], ['قيد التشكيل', S.proposed], ['أعضاء نشطون', S.members], ['متقدمون', S.applicants], ['شهادات بانتظار الطاقم', S.pending], ['قضايا', S.cases], ['عودات', S.returns]].map(([l, v]) => <div key={String(l)} className="ac-kpi"><b>{v}</b><small>{l}</small></div>)}
          </section>
          <nav className="ac-tabs">
            <button className={tab === 'councils' ? 'on' : ''} onClick={() => setTab('councils')}>المجالس ({d.councils.length})</button>
            <button className={tab === 'form' ? 'on' : ''} onClick={() => setTab('form')}>تشكيل مجلس</button>
            <button className={tab === 'applicants' ? 'on' : ''} onClick={() => setTab('applicants')}>المتقدمون ({d.applicants.length})</button>
            <button className={tab === 'pending' ? 'on' : ''} onClick={() => setTab('pending')}>شهادات للاعتماد {d.pending.length ? <i>{d.pending.length}</i> : null}</button>
            <button className={tab === 'wisdom' ? 'on' : ''} onClick={() => setTab('wisdom')}>خريطة الحكمة ({d.wisdom.length})</button>
          </nav>

          {tab === 'councils' && (
            <section className="ac-stack" data-testid="councils-tab">
              {!d.councils.length && <div className="pt-box"><p className="ac-muted">لا مجالس بعد — ابدأ من «تشكيل مجلس».</p></div>}
              {d.councils.map((c: any) => (
                <article key={c.id} className={`pt-box ac-council ${c.status}`} data-testid="council-row">
                  <div className="ac-crow" onClick={() => setOpen(open === c.id ? '' : c.id)}>
                    <div><b>{c.title_ar}</b> <span className={`ac-st ${c.status}`}>{c.status_ar}</span><p className="ac-muted">{c.members.length} أعضاء من {c.orgs} جهات · الدورة {c.cycle_no}{c.cycle_ends_at ? ` تنتهي ${fmt(c.cycle_ends_at)}` : ''} · الكرسي {c.chair_email || '—'} · {c.cases} قضايا / {c.returns} عودات{c.current_case ? ` · الآن: «${c.current_case.title_ar}»` : ''}</p>
                      <div className="ac-chips">{c.skills.map((s: any) => <span key={s.id} className="ac-chip">{s.name_ar}</span>)}</div></div>
                    <span className="ac-muted">{open === c.id ? '▲' : '▼'}</span>
                  </div>
                  {open === c.id && (
                    <div className="ac-detail">
                      <table className="ac-table"><thead><tr><th>العضو</th><th>الجهة</th><th>الدور</th><th>الحالة</th><th>الميثاق</th><th>دورات</th><th></th></tr></thead><tbody>
                        {c.members.map((m: any) => <tr key={m.id}><td>{m.full_name || '—'}<br /><small>{m.email}</small></td><td>{m.org_name || '—'}</td><td>{m.role === 'chair' ? <b>الكرسي</b> : 'عضو'}</td><td>{m.status === 'active' ? 'نشط' : m.status === 'invited' ? 'مدعو' : m.status}</td><td>{m.signed ? '✓' : '—'}</td><td>{m.cycles_completed}</td><td className="ac-rowbtns">{m.status === 'active' && m.role !== 'chair' && <button className="pt-btn ghost small" disabled={!!busy} onClick={() => act({ action: 'set_chair', id: c.id, email: m.email }, 'عُيّن الكرسي')}>كرسي</button>}<button className="pt-btn ghost small" disabled={!!busy} onClick={() => { if (confirm(`إخراج ${m.email} من المجلس؟`)) act({ action: 'remove_member', id: c.id, email: m.email }, 'أُخرج العضو'); }}>إخراج</button></td></tr>)}
                      </tbody></table>
                      <div className="ac-add"><input className="ac-in" placeholder="بريد عضو جديد" value={addEmail.email} onChange={e => setAddEmail({ ...addEmail, email: e.target.value })} data-testid="add-email" /><input className="ac-in" placeholder="الاسم (اختياري)" value={addEmail.full_name} onChange={e => setAddEmail({ ...addEmail, full_name: e.target.value })} /><select className="ac-in" value={addEmail.organization_id} onChange={e => setAddEmail({ ...addEmail, organization_id: e.target.value })}><option value="">— الجهة —</option>{d.organizations.map((o: any) => <option key={o.id} value={o.id}>{o.name_ar}</option>)}</select><button className="pt-btn small" disabled={!!busy || !addEmail.email} onClick={async () => { const j = await act({ action: 'add_member', id: c.id, ...addEmail, organization_id: addEmail.organization_id || null }, 'أُرسلت الدعوة'); if (j) setAddEmail({ email: '', full_name: '', organization_id: '' }); }} data-testid="add-member">دعوة</button></div>
                      <div className="ac-btns">
                        {c.status === 'proposed' && <button className="pt-btn gold" disabled={!!busy} onClick={() => act({ action: 'activate', id: c.id }, 'انعقد المجلس وبدأت الدورة الأولى')} data-testid="activate">انعقاد المجلس {c.quorum?.ok ? '' : `(النصاب ${c.quorum?.signed}/${3} موقّع · ${c.quorum?.orgs} جهة)`}</button>}
                        {c.status === 'proposed' && !c.quorum?.ok && <button className="pt-btn ghost small" disabled={!!busy} onClick={() => { if (confirm('انعقاد دون اكتمال النصاب؟')) act({ action: 'activate', id: c.id, force: true }, 'انعقد (قسرًا)'); }}>انعقاد قسري</button>}
                        {c.status === 'active' && <><button className="pt-btn" disabled={!!busy} onClick={() => { if (confirm('إغلاق الدورة الآن: احتساب الدورات، دوران الكرسي، المرايا؟')) act({ action: 'close_cycle', id: c.id }, 'أُغلقت الدورة وبدأت التالية'); }} data-testid="close-cycle">إغلاق الدورة الآن</button><button className="pt-btn ghost small" disabled={!!busy} onClick={() => act({ action: 'pause', id: c.id }, 'أُوقف مؤقتًا')}>إيقاف مؤقت</button></>}
                        {c.status === 'paused' && <button className="pt-btn" disabled={!!busy} onClick={() => act({ action: 'resume', id: c.id }, 'استُؤنف')}>استئناف</button>}
                        {c.status !== 'closed' && <button className="pt-btn ghost small danger" disabled={!!busy} onClick={() => { if (confirm('إغلاق المجلس نهائيًا؟ يبقى الأثر.')) act({ action: 'close', id: c.id }, 'أُغلق المجلس'); }}>إغلاق المجلس</button>}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}

          {tab === 'form' && (
            <section className="ac-stack" data-testid="form-tab">
              <div className="pt-box"><h3><Icon name="plus" size={16} /> مجلس جديد — {C.min}–{C.max} أعضاء من ≥ {C.min_orgs} جهة · دورة {C.cycle_weeks} أسابيع</h3>
                <div className="ac-grid3">
                  <input className="ac-in" placeholder="اسم المجلس (مثال: مجلس قادة الصف الأول — التعليم)" value={form.title_ar} onChange={e => setForm({ ...form, title_ar: e.target.value })} data-testid="f-title" />
                  <input className="ac-in" placeholder="المجال (اختياري)" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} />
                  <input className="ac-in" placeholder="رمز القطاع (اختياري)" value={form.sector_code} onChange={e => setForm({ ...form, sector_code: e.target.value })} />
                </div>
                <p className="ac-muted">المهارات المحورية (اختر 1–4):</p>
                <div className="ac-skills">{d.skills.slice(0, 120).map((s: any) => <button key={s.id} type="button" className={form.skill_ids.includes(s.id) ? 'on' : ''} onClick={() => setForm({ ...form, skill_ids: form.skill_ids.includes(s.id) ? form.skill_ids.filter(x => x !== s.id) : form.skill_ids.length < 4 ? [...form.skill_ids, s.id] : form.skill_ids })} data-testid="f-skill">{s.name_ar}</button>)}</div>
                <div className="ac-btns"><button className="pt-btn ghost" disabled={busy === 'propose'} onClick={propose} data-testid="propose"><Icon name="target" size={15} /> اقترح تشكيلات (المُوفِّق)</button><span className="ac-muted">{proposals ? `${candN} مرشحًا · ${proposals.length} اقتراحًا` : 'يقرأ محفظة القدرة والمتقدمين ويقترح تشكيلات متقاربة المستوى متنوعة الجهات.'}</span></div>
                {proposals && !proposals.length && <p className="ac-muted">لا تشكيل مكتمل الآن — أضف الأعضاء يدويًا أو انتظر متقدمين من جهة ثانية.</p>}
                {proposals && proposals.map((p: any, i: number) => <div key={i} className="ac-proposal" data-testid="proposal"><div><b>اقتراح {i + 1}</b> — {p.members.length} أعضاء من {p.orgs} جهات · متوسط المستوى {p.level_avg} (تباين {p.level_spread}) · {p.reason_ar}<ul>{p.members.map((m: any) => <li key={m.email}>{m.full_name || m.email} <small>{m.org_name || orgName(m.organization_id)} · م{m.level}{m.applied ? ' · متقدم' : ''}</small></li>)}</ul></div><button className="pt-btn small" onClick={() => setForm({ ...form, members: p.members.map((m: any) => ({ email: m.email, full_name: m.full_name, organization_id: m.organization_id, user_id: m.user_id })) })} data-testid="use-proposal">اعتمد هذا التشكيل</button></div>)}
                <h4>الأعضاء ({form.members.length})</h4>
                <ul className="ac-members">{form.members.map(m => <li key={m.email}>{m.full_name || m.email} <small>{m.email} · {orgName(m.organization_id)}</small><button type="button" onClick={() => setForm({ ...form, members: form.members.filter(x => x.email !== m.email) })}>×</button></li>)}</ul>
                <div className="ac-add"><input className="ac-in" placeholder="بريد" value={manual.email} onChange={e => setManual({ ...manual, email: e.target.value })} data-testid="m-email" /><input className="ac-in" placeholder="الاسم" value={manual.full_name} onChange={e => setManual({ ...manual, full_name: e.target.value })} /><select className="ac-in" value={manual.organization_id} onChange={e => setManual({ ...manual, organization_id: e.target.value })} data-testid="m-org"><option value="">— الجهة —</option>{d.organizations.map((o: any) => <option key={o.id} value={o.id}>{o.name_ar}</option>)}</select><button type="button" className="pt-btn ghost small" disabled={!manual.email} onClick={() => { setForm({ ...form, members: [...form.members.filter(x => x.email !== manual.email.toLowerCase()), { email: manual.email.toLowerCase(), full_name: manual.full_name || null, organization_id: manual.organization_id || null }] }); setManual({ email: '', full_name: '', organization_id: '' }); }} data-testid="m-add">أضف</button></div>
                <button className="pt-btn gold" disabled={!!busy || !form.title_ar || !form.skill_ids.length || form.members.length < 2} onClick={async () => { const j = await act({ action: 'create', ...form }, 'أُنشئ المجلس وأُرسلت الدعوات لتوقيع الميثاق'); if (j) { setForm({ title_ar: '', domain: '', sector_code: '', skill_ids: [], cycle_weeks: 6, members: [] }); setProposals(null); setTab('councils'); } }} data-testid="create"><Icon name="check" size={15} /> أنشئ المجلس وادعُ الأعضاء</button>
              </div>
            </section>
          )}

          {tab === 'applicants' && (
            <section className="ac-stack" data-testid="applicants-tab">
              <div className="pt-box">{!d.applicants.length && <p className="ac-muted">لا متقدمين الآن.</p>}
                {!!d.applicants.length && <table className="ac-table"><thead><tr><th>المتقدم</th><th>الجهة</th><th>الرغبة</th><th>منذ</th><th></th></tr></thead><tbody>{d.applicants.map((a: any) => <tr key={a.id}><td>{a.full_name || '—'}<br /><small>{a.email}</small></td><td>{a.org_name || '—'}</td><td><small>{a.meta?.domain || ''} {a.meta?.sector || ''} {a.note || ''}</small></td><td>{fmt(a.created_at)}</td><td><button className="pt-btn ghost small" onClick={() => { setForm({ ...form, members: [...form.members.filter(x => x.email !== a.email), { email: a.email, full_name: a.full_name, organization_id: a.organization_id, user_id: a.user_id }] }); setTab('form'); }}>أضفه إلى التشكيل</button></td></tr>)}</tbody></table>}</div>
            </section>
          )}

          {tab === 'pending' && (
            <section className="ac-stack" data-testid="pending-tab">
              <div className="pt-box"><h3><Icon name="scale" size={16} /> شهادات أقران بانتظار الاعتماد</h3><p className="ac-muted">مدير جهة المشهود له يعتمد أولًا من قاعة مجلسه؛ الطاقم يعتمد احتياطًا (بعد 7 أيام أو حين لا مدير). الاعتماد يرفع وزن الدليل في خيط الأثر — ولا يغيّر المستوى المعتمد دون قرار بشري (P8).</p>
                {!d.pending.length && <p className="ac-muted">لا شهادات معلّقة.</p>}
                {d.pending.map((a: any) => <div key={a.id} className="ac-att" data-testid="pending-row"><div><b>{a.from_email}</b> ← <b>{a.to_email}</b> · «{a.skill_ar}» · {a.council_title} · {fmt(a.created_at)}<p>{a.evidence_ar}</p></div><div className="ac-rowbtns"><button className="pt-btn small" disabled={!!busy} onClick={() => act({ action: 'decide_attestation', id: a.id, approve: true }, 'اعتُمدت')} data-testid="approve">اعتماد</button><button className="pt-btn ghost small" disabled={!!busy} onClick={() => act({ action: 'decide_attestation', id: a.id, approve: false }, 'رُفضت')}>رفض</button></div></div>)}
              </div>
            </section>
          )}

          {tab === 'wisdom' && (
            <section className="ac-stack" data-testid="wisdom-tab">
              <div className="pt-box"><h3><Icon name="globe" size={16} /> خريطة الحكمة — ما يتكرر عبر المجالس</h3><p className="ac-muted">أنماط تظهر فقط حين تبلغ k ≥ {C.k} أشخاص من ≥ {C.min_orgs} جهة — بلا أسماء. النمط المتكرر = حاجة تدريبية حقيقية → مسودة في هندسة البرامج التدريبية.</p>
                {!d.wisdom.length && <p className="ac-muted">لم تبلغ الأنماط عتبة الإظهار بعد.</p>}
                {d.wisdom.map((w: any) => <div key={w.pattern} className="ac-wis" data-testid="wisdom-row"><div><b>{w.label_ar}</b><small> {w.cases} قضية · {w.persons} شخصًا · {w.orgs} جهات · {w.councils} مجالس</small></div><button className="pt-btn small" disabled={!!busy} onClick={async () => { const j = await act({ action: 'wisdom_to_engineering', pattern: w.pattern }, 'أُرسل النمط إلى هندسة البرامج التدريبية'); if (j?.url) window.open(j.url, '_blank'); }} data-testid="to-engineering"><Icon name="send" size={14} /> إلى هندسة البرامج</button></div>)}
                <p className="ac-muted"><Link href="/admin/program-engineering">فتح هندسة البرامج التدريبية ←</Link></p>
              </div>
            </section>
          )}
        </>
      )}
      {tok === '' && <section className="pt-box"><p>سجّل الدخول بحساب طاقم. <Link href="/login?next=/admin/councils">تسجيل الدخول</Link></p></section>}
    </main>
  );
}

const CSS = `
.ac{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;max-width:1100px;margin:0 auto;padding:22px 18px 60px}
.ac-head h1{margin:4px 0 6px;font-size:28px;color:#0f2a4e}.ac-head p{margin:0 0 14px;color:#475569;line-height:1.8}
.ac-muted{color:#64748b;font-size:13px;line-height:1.8}.ac-err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}.ac-ok{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}
.ac-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:12px 0}.ac-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:10px;text-align:center}.ac-kpi b{display:block;font-size:22px;color:#0f2a4e}.ac-kpi small{color:#64748b;font-size:11px}
.ac-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}.ac-tabs button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-weight:900;color:#334155;display:inline-flex;gap:6px;align-items:center}.ac-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.ac-tabs i{font-style:normal;background:#c9a24b;color:#1f2937;border-radius:999px;font-size:11px;padding:1px 7px}
.ac-stack{display:grid;gap:12px}.ac-in{font:inherit;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;background:#fff;width:100%;box-sizing:border-box}
.ac-crow{display:flex;justify-content:space-between;gap:12px;cursor:pointer}.ac-st{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:900;background:#e2e8f0;margin-inline-start:6px}.ac-st.active{background:#ccfbf1;color:#0b8a83}.ac-st.proposed{background:#fef3c7;color:#92400e}.ac-st.closed{background:#f1f5f9;color:#64748b}
.ac-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.ac-chip{background:#f0fdfa;color:#0b8a83;border:1px solid #99f6e4;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:800}
.ac-detail{margin-top:12px;border-top:1px solid #e2e8f0;padding-top:12px}.ac-table{width:100%;border-collapse:collapse;font-size:13px}.ac-table th{text-align:right;color:#64748b;font-weight:800;padding:6px;border-bottom:1px solid #e2e8f0}.ac-table td{padding:6px;border-bottom:1px solid #f1f5f9;vertical-align:top}.ac-rowbtns{display:flex;gap:4px;white-space:nowrap}
.ac-add{display:grid;grid-template-columns:2fr 1.5fr 1.5fr auto;gap:6px;margin:10px 0;align-items:center}@media (max-width:720px){.ac-add{grid-template-columns:1fr}}
.ac-btns{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}.pt-btn.danger{color:#b91c1c;border-color:#fecaca}
.ac-grid3{display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin:8px 0}@media (max-width:720px){.ac-grid3{grid-template-columns:1fr}}
.ac-skills{display:flex;gap:6px;flex-wrap:wrap;max-height:160px;overflow:auto;padding:4px;border:1px solid #f1f5f9;border-radius:10px}.ac-skills button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:4px 10px;font:inherit;font-size:12px;font-weight:800;color:#334155}.ac-skills button.on{background:#0b8a83;color:#fff;border-color:#0b8a83}
.ac-proposal{display:flex;justify-content:space-between;gap:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin:8px 0;font-size:13px}.ac-proposal ul{margin:6px 0 0;padding-inline-start:18px}
.ac-members{list-style:none;margin:6px 0;padding:0;display:flex;flex-wrap:wrap;gap:6px}.ac-members li{background:#fff;border:1px solid #e2e8f0;border-radius:999px;padding:4px 10px;font-size:12px;display:inline-flex;gap:6px;align-items:center}.ac-members li button{border:0;background:none;color:#b91c1c;font-weight:900;cursor:pointer}
.ac-att,.ac-wis{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #e2e8f0;padding:10px 0;font-size:13px}.ac-att p{margin:4px 0 0;color:#334155}.ac-wis small{color:#64748b}
`;
