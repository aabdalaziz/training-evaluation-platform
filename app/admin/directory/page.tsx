'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * إدارة أَثَر — هيئة أَثَر (P31): لوحة اعتماد السير (بانتظار · معتمدة · تعديلات بانتظار المراجعة · موقوفة) مع المعاينة الكاملة والصورة وحقول الطاقم،
 *  قرار الاعتماد (ينشر الصورة ويصدر شهادة ATH-EX/ATH-TR) · طلب تعديلات · إيقاف/إعادة · عقود التعاون ATH-CO (اقتراح · تعديل · إنجاز · تسوية · إلغاء) · الطلبات الممهورة بأعضاء الهيئة
 *  · دعوات مدربي منصة التقييم القائمين (معاينة ثم تنفيذ). الإنسان يعتمد دائمًا — لا ترتيب ولا نجوم.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';

import { RoomHead } from '../../components/RoomKit'; /* هـ-3 ح «عدّة الغرفة» */
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const ST_COLOR: Record<string, string> = { draft: '#B3A5AE', submitted: '#D9A866', approved: '#D4614A', changes_requested: '#f59e0b', suspended: '#b91c1c' };
const ENG_COLOR: Record<string, string> = { proposed: '#D9A866', changes_requested: '#f59e0b', active: '#D4614A', completed: '#3A1F36', settled: '#047857', declined: '#B3A5AE', cancelled: '#b91c1c' };
type Tab = 'profiles' | 'engagements' | 'requests';
const EMPTY_ENG = { kind: 'consult', title_ar: '', scope_ar: '', deliverables: '', start_at: '', end_at: '', mode: '', fee_amount: '', currency: 'SAR', terms_ar: '' };

export default function AdminDirectoryPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [ok, setOk] = useState(''); const [tok, setTok] = useState(''); const [busy, setBusy] = useState('');
  const [data, setData] = useState<any>(null); const [tab, setTab] = useState<Tab>('profiles'); const [filter, setFilter] = useState<string>('submitted'); const [selId, setSelId] = useState<string | null>(null); const [note, setNote] = useState(''); const [avail, setAvail] = useState(''); const [notes, setNotes] = useState('');
  const [eng, setEng] = useState<any>(EMPTY_ENG); const [engFor, setEngFor] = useState<string>(''); const [engEdit, setEngEdit] = useState<string | null>(null);
  const fresh = async () => { const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || tok; if (tk && tk !== tok) setTok(tk); return tk; };
  const H = async (tk?: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tk || await fresh()}` });
  async function load(tk?: string) { const j = await fetch('/api/admin/directory', { headers: await H(tk), cache: 'no-store' }).then(r => r.json()); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setData(j); }
  async function post(body: any) { setBusy(body.action + (body.op || '')); setError(''); setOk(''); try { const j = await fetch('/api/admin/directory', { method: 'POST', headers: await H(), body: JSON.stringify(body) }).then(r => r.json()); if (!j.success) throw new Error(j.error || 'خطأ'); return j; } catch (e: any) { setError(e.message); return null; } finally { setBusy(''); } }
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/directory'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
    const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const profiles: any[] = useMemo(() => (data?.profiles || []).filter((p: any) => filter === 'all' ? true : filter === 'review' ? p.status === 'approved' && p.review_pending : p.status === filter), [data, filter]);
  const counts = useMemo(() => { const c: Record<string, number> = { all: data?.profiles?.length || 0, review: 0 }; for (const p of data?.profiles || []) { c[p.status] = (c[p.status] || 0) + 1; if (p.status === 'approved' && p.review_pending) c.review++; } return c; }, [data]);
  const sel = useMemo(() => (data?.profiles || []).find((p: any) => p.id === selId) || null, [data, selId]);
  const sectorName = useMemo(() => Object.fromEntries((data?.sectors || []).map((s: any) => [s.code, s.name_ar])), [data]);
  useEffect(() => { if (sel) { setAvail(sel.staff_only?.availability || ''); setNotes(sel.staff_only?.notes || ''); setNote(''); } }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function decide(action: string, extra: any = {}) { if (!sel) return; const j = await post({ action, id: sel.id, ...extra }); if (j) { setOk({ approve: 'اعتُمدت السيرة وصدرت الشهادة ونُشرت الصفحة', changes: 'أُرسلت الملاحظة للعضو', review_done: 'رُوجعت التعديلات', suspend: 'أُوقفت العضوية وسُحبت الشهادة', reinstate: 'عادت العضوية بشهادة جديدة', staff_note: 'حُفظت حقول الطاقم' }[action] || 'تم'); await load(); } }
  async function sendEng() { const body = { ...eng, deliverables: eng.deliverables.split('\n').map((s: string) => s.trim()).filter(Boolean), fee_amount: Number(eng.fee_amount) }; const j = engEdit ? await post({ action: 'engagement', op: 'update', id: engEdit, ...body }) : await post({ action: 'engagement_new', profile_id: engFor, ...body }); if (j) { setOk(engEdit ? 'عُدّل العقد وأُعيد للعضو' : 'أُرسل العقد المقترح'); setEng(EMPTY_ENG); setEngFor(''); setEngEdit(null); await load(); } }
  async function engOp(e: any, op: string) { const ask: Record<string, string> = { complete: 'تسجيل إنجاز المهمة؟', settle: 'تأكيد تسوية مستحقات هذه المهمة؟', cancel: 'إلغاء العقد وسحب وثيقته؟' }; if (!confirm(ask[op])) return; const j = await post({ action: 'engagement', op, id: e.id, confirm: true }); if (j) { setOk('تم'); await load(); } }
  async function invite(dry: boolean) { const j = await post({ action: 'invite', dry }); if (j?.result?.ok) setOk(`${dry ? 'معاينة' : 'تنفيذ'}: دعوات ${j.result.invited} · تذكيرات ${j.result.reminded} · مُدعوّون سابقًا/لهم سيرة ${j.result.skipped_invites}`); else if (j) setError(j.result?.error || 'تعذّر'); }

  if (!ready) return <div className="am rm-page"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="am-wrap"><div className="rm-card">{error ? <span className="am-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  const st = data?.stats;
  return (
    <div className="am rm-page"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="am-wrap">
        <RoomHead
        title={<>هيئة أَثَر — الاعتماد وعقود التعاون</>}
        desc={<><p>سيرة العضو بكلماته، و«ما شهده أَثَر» من السجلات. الطاقم يعتمد ويصدر شهادة التوثيق (ATH-EX للخبير · ATH-TR للمدرب)، ويقترح عقد تعاون على كل مهمة (ATH-CO) — الأجر لكل مشروع ولا يراه إلا الطرفان.</p></>}
      />
        <PortalAdminTabs />
        {error && <div className="am-err" role="alert">{error}</div>}{ok && <div className="am-ok" role="status">{ok}</div>}
        {st && <div className="rm-kpis"><span><b>{st.total}</b> سيرة</span><span><b>{st.submitted}</b> بانتظار الاعتماد</span><span className="g"><b>{st.approved}</b> عضوًا معتمدًا</span><span><b>{st.review_pending}</b> تعديلات للمراجعة</span><span><b>{st.engagements_proposed}</b> عقد مقترح · <b>{st.engagements_active}</b> جارٍ</span><span><b>{st.requests_new}</b> طلب جديد</span>
          <span className="am-cycle"><button className="rm-btn ghost small" disabled={!!busy} onClick={() => invite(true)}>معاينة دعوات المدربين</button><button className="rm-btn small" disabled={!!busy} onClick={() => { if (confirm('إرسال الدعوات والتذكيرات الآن؟')) invite(false); }}>نفّذ الآن</button></span></div>}
        <div className="am-tabs" role="tablist">{([['profiles', 'السير'], ['engagements', 'عقود التعاون'], ['requests', 'الطلبات']] as [Tab, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>

        {tab === 'profiles' && (<div className="am-grid2">
          <div className="rm-card">
            <div className="am-filters">{[['submitted', 'بانتظار الاعتماد'], ['review', 'تعديلات للمراجعة'], ['approved', 'معتمدة'], ['changes_requested', 'طُلبت تعديلات'], ['draft', 'مسودات'], ['suspended', 'موقوفة'], ['all', 'الكل']].map(([k, l]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l} <small>{counts[k] || 0}</small></button>)}</div>
            {!profiles.length ? <div className="rm-empty">لا سير في هذه القائمة.</div> : (
              <table className="rm-table"><thead><tr><th>العضو</th><th>الوجه</th><th>الحالة</th><th>آخر تحديث</th><th></th></tr></thead><tbody>
                {profiles.map((p: any) => <tr key={p.id} className={selId === p.id ? 'sel' : ''} data-testid="ad-row"><td><b>{p.name_ar}</b><br /><small>{p.title_ar} · {p.email}</small></td><td>{(p.faces || []).map((f: string) => data.faces_ar[f]).join(' + ')}</td><td><span className="am-st" style={{ background: ST_COLOR[p.status] }}>{p.status_ar}</span>{p.review_pending && <small> · تعديلات</small>}{p.status === 'approved' && !p.listed && <small> · مسحوبة</small>}</td><td><small>{fmt(p.updated_at)}</small></td><td className="am-acts"><button className="rm-btn ghost small" onClick={() => setSelId(p.id)} data-testid="ad-open">افتح</button></td></tr>)}
              </tbody></table>)}
          </div>
          <div className="rm-card" aria-live="polite">
            {!sel ? <div className="rm-empty">اختر سيرة لمعاينتها كاملة والقرار فيها.</div> : (<div data-testid="ad-detail">
              <div className="ad-head">{sel.photo_private_url || sel.photo_public_url ? <img src={sel.photo_private_url || sel.photo_public_url} alt={`صورة ${sel.name_ar}`} className="ad-photo" /> : <div className="ad-photo none">لا صورة</div>}
                <div><h3>{sel.name_ar} {sel.name_en && <small dir="ltr">{sel.name_en}</small>}</h3><p className="ad-sub">{sel.title_ar} · {sel.city || '—'} · {(sel.faces || []).map((f: string) => data.faces_ar[f]).join(' + ')}</p><p className="ad-sub">{sel.email} · أُنشئت {fmt(sel.created_at)}{sel.legacy_trainer_id && ' · مدرب في منصة التقييم'}</p>
                  <p className="ad-sub">{sel.photo_path ? (sel.photo_consent_at ? `موافقة الصورة: ${fmt(sel.photo_consent_at)}` : 'صورة بلا موافقة بعد') : 'لا صورة'}{sel.public_url && sel.status === 'approved' && <> · <a href={sel.public_url} target="_blank" rel="noreferrer">الصفحة العامة</a></>}</p></div></div>
              {sel.issues?.length > 0 && <ul className="ad-issues">{sel.issues.map((i: string) => <li key={i}>{i}</li>)}</ul>}
              <h4>ملخص السيرة</h4><blockquote>{sel.summary_ar || '—'}</blockquote>
              {sel.achievements?.length > 0 && <><h4>أبرز الإنجازات</h4><ol>{sel.achievements.map((a: string, i: number) => <li key={i}>{a}</li>)}</ol></>}
              <div className="am-two">
                <div>{sel.education?.length > 0 && <><h4>المؤهلات</h4><ul>{sel.education.map((x: any, i: number) => <li key={i}>{x.degree} {x.field && `في ${x.field}`} — {x.institution} ({x.year})</li>)}</ul></>}
                  {sel.experience?.length > 0 && <><h4>الخبرات</h4><ul>{sel.experience.map((x: any, i: number) => <li key={i}>{x.role} — {x.organization} ({x.from}→{x.to || 'الآن'})</li>)}</ul></>}</div>
                <div>{sel.certifications?.length > 0 && <><h4>الشهادات</h4><ul>{sel.certifications.map((x: any, i: number) => <li key={i}>{x.name} — {x.issuer} ({x.year}){x.number && <small> رقم {x.number}</small>}</li>)}</ul></>}
                  {sel.publications?.length > 0 && <><h4>المنشورات</h4><ul>{sel.publications.map((x: any, i: number) => <li key={i}>{x.title} ({x.type} · {x.year})</li>)}</ul></>}</div>
              </div>
              <h4>الخبرة</h4><p className="ad-sub">{(sel.skill_names || []).join(' · ')} — قطاعات: {(sel.sectors || []).map((s: string) => sectorName[s] || s).join(' · ')} — خدمات: {(sel.services || []).map((s: string) => data.services_ar?.[s] || s).join(' · ')} — نمط: {(sel.modes || []).map((m: string) => data.modes_ar?.[m] || m).join(' · ')}{sel.coverage?.length > 0 && ` — تغطية: ${sel.coverage.join('، ')}`}</p>
              {(sel.card_expert || sel.card_trainer) && <p className="ad-sub">الشهادات: {sel.card_expert && <a href={`/verify/vc?code=${sel.card_expert.code}`}>{sel.card_expert.code}</a>} {sel.card_trainer && <a href={`/verify/vc?code=${sel.card_trainer.code}`}>{sel.card_trainer.code}</a>}</p>}
              <div className="am-review">
                <h4>حقول الطاقم (لا يراها العضو ولا العامة)</h4>
                <label>التوفّر<input value={avail} onChange={e => setAvail(e.target.value)} maxLength={300} placeholder="مثال: متاح من فبراير · يفضّل عن بُعد" /></label>
                <label>ملاحظات داخلية<textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} maxLength={3000} /></label>
                <button className="rm-btn ghost small" disabled={!!busy} onClick={() => decide('staff_note', { availability: avail, notes })}>احفظ حقول الطاقم</button>
                <h4 style={{ marginTop: 12 }}>القرار</h4>
                <label>ملاحظة للعضو (لطلب التعديلات أو الإيقاف)<input value={note} onChange={e => setNote(e.target.value)} maxLength={1000} data-testid="ad-note" /></label>
                <div className="am-decide">
                  {['submitted', 'changes_requested', 'draft'].includes(sel.status) && <button className="rm-btn" disabled={!!busy || sel.issues?.length > 0} onClick={() => { if (confirm('اعتماد السيرة: تُنشر الصورة والصفحة وتصدر شهادة التوثيق الموقَّعة. متابعة؟')) decide('approve', { confirm: true }); }} data-testid="ad-approve"><Icon name="check" size={14} /> اعتمد وأصدر الشهادة</button>}
                  {sel.status !== 'suspended' && <button className="rm-btn ghost" disabled={!!busy || note.trim().length < 10} onClick={() => decide('changes', { note_ar: note })} data-testid="ad-changes">اطلب تعديلات</button>}
                  {sel.status === 'approved' && sel.review_pending && <button className="rm-btn" disabled={!!busy} onClick={() => decide('review_done')} data-testid="ad-review-done">رُوجعت التعديلات (انشر الجديد)</button>}
                  {sel.status === 'approved' && <button className="rm-btn ghost danger" disabled={!!busy} onClick={() => { if (confirm('إيقاف العضوية وسحب الشهادة؟')) decide('suspend', { note_ar: note, confirm: true }); }}>أوقف العضوية</button>}
                  {sel.status === 'suspended' && <button className="rm-btn" disabled={!!busy} onClick={() => { if (confirm('إعادة الاعتماد وإصدار شهادة جديدة؟')) decide('reinstate', { confirm: true }); }}>أعد الاعتماد</button>}
                  {sel.status === 'approved' && <button className="rm-btn ghost" onClick={() => { setTab('engagements'); setEngFor(sel.id); setEngEdit(null); setEng(EMPTY_ENG); }} data-testid="ad-new-eng"><Icon name="plus" size={14} /> عقد تعاون جديد</button>}
                </div>
                <small className="am-note">الاعتماد يتطلب سيرة مكتملة وصورة بموافقة مؤرَّخة. لا ترتيب ولا نجوم: الدليل يعرض المعتمدين بآخر تحديث ثم الاسم.</small>
              </div>
            </div>)}
          </div>
        </div>)}

        {tab === 'engagements' && (<div className="am-grid2">
          <div className="rm-card">
            <h3>عقود التعاون (ATH-CO)</h3>
            {!data.engagements?.length ? <div className="rm-empty">لا عقود بعد — اقترح عقدًا لعضو معتمد من النموذج المجاور.</div> : (
              <table className="rm-table"><thead><tr><th>المهمة</th><th>العضو</th><th>الأجر</th><th>الحالة</th><th></th></tr></thead><tbody>
                {data.engagements.map((e: any) => { const p = (data.profiles || []).find((x: any) => x.id === e.profile_id); return (<tr key={e.id} data-testid="ad-eng"><td><b>{e.title_ar}</b><br /><small>{e.kind_ar} · {e.start_at || '—'} → {e.end_at || '—'}</small>{e.change_note_ar && <><br /><small>طلب العضو: {e.change_note_ar}</small></>}</td><td>{p?.name_ar || e.email}</td><td><small>{e.fee_amount} {e.currency}</small></td><td><span className="am-st" style={{ background: ENG_COLOR[e.status] }}>{e.status_ar}</span>{e.verify_url && <><br /><a href={e.verify_url}><small>{e.code}</small></a></>}</td>
                  <td className="am-acts">{['proposed', 'changes_requested'].includes(e.status) && <button className="rm-btn ghost small" onClick={() => { setEngEdit(e.id); setEngFor(e.profile_id); setEng({ kind: e.kind, title_ar: e.title_ar, scope_ar: e.scope_ar, deliverables: (e.deliverables || []).join('\n'), start_at: e.start_at || '', end_at: e.end_at || '', mode: e.mode || '', fee_amount: String(e.fee_amount ?? ''), currency: e.currency, terms_ar: e.terms_ar || '' }); }}>عدّل</button>}
                    {e.status === 'active' && <button className="rm-btn small" disabled={!!busy} onClick={() => engOp(e, 'complete')} data-testid="ad-eng-complete">أُنجزت</button>}{e.status === 'completed' && <button className="rm-btn small" disabled={!!busy} onClick={() => engOp(e, 'settle')}>سُوّيت</button>}{['proposed', 'changes_requested', 'active'].includes(e.status) && <button className="rm-btn ghost small danger" disabled={!!busy} onClick={() => engOp(e, 'cancel')}>ألغِ</button>}</td></tr>); })}
              </tbody></table>)}
          </div>
          <div className="rm-card">
            <h3>{engEdit ? 'تعديل العقد المقترح' : 'عقد تعاون جديد'}</h3>
            <label>عضو الهيئة<select value={engFor} onChange={e => setEngFor(e.target.value)} disabled={!!engEdit} data-testid="ad-eng-for"><option value="">— اختر عضوًا معتمدًا —</option>{(data.profiles || []).filter((p: any) => p.status === 'approved').map((p: any) => <option key={p.id} value={p.id}>{p.name_ar} — {p.title_ar}</option>)}</select></label>
            <div className="am-row3"><label>النوع<select value={eng.kind} onChange={e => setEng({ ...eng, kind: e.target.value })}><option value="consult">استشارة</option><option value="train">تدريب</option></select></label><label>النمط<select value={eng.mode} onChange={e => setEng({ ...eng, mode: e.target.value })}><option value="">—</option><option value="onsite">حضوري</option><option value="remote">عن بُعد</option><option value="hybrid">هجين</option></select></label><label>العملة<input value={eng.currency} onChange={e => setEng({ ...eng, currency: e.target.value.toUpperCase() })} maxLength={3} dir="ltr" /></label></div>
            <label>عنوان المهمة<input value={eng.title_ar} onChange={e => setEng({ ...eng, title_ar: e.target.value })} maxLength={160} data-testid="ad-eng-title" /></label>
            <label>نطاق المهمة (20 حرفًا فأكثر)<textarea rows={4} value={eng.scope_ar} onChange={e => setEng({ ...eng, scope_ar: e.target.value })} maxLength={2000} data-testid="ad-eng-scope" /></label>
            <label>المخرجات (سطر لكل مخرج)<textarea rows={3} value={eng.deliverables} onChange={e => setEng({ ...eng, deliverables: e.target.value })} /></label>
            <div className="am-row3"><label>من<input type="date" value={eng.start_at} onChange={e => setEng({ ...eng, start_at: e.target.value })} /></label><label>إلى<input type="date" value={eng.end_at} onChange={e => setEng({ ...eng, end_at: e.target.value })} /></label><label>أجر هذا المشروع<input type="number" min={0} step="0.01" value={eng.fee_amount} onChange={e => setEng({ ...eng, fee_amount: e.target.value })} dir="ltr" data-testid="ad-eng-fee" /></label></div>
            <label>شروط إضافية (اختياري)<textarea rows={2} value={eng.terms_ar} onChange={e => setEng({ ...eng, terms_ar: e.target.value })} maxLength={3000} /></label>
            <div className="am-decide"><button className="rm-btn" disabled={!!busy || !engFor} onClick={sendEng} data-testid="ad-eng-send"><Icon name="send" size={14} /> {engEdit ? 'احفظ وأعد للعضو' : 'أرسل العقد المقترح'}</button>{engEdit && <button className="rm-btn ghost" onClick={() => { setEngEdit(null); setEng(EMPTY_ENG); }}>إلغاء التعديل</button>}</div>
            <small className="am-note">يوقّع العضو باسمه فيوقّع أَثَر بصفته فورًا وتصدر وثيقة ATH-CO (بلا أجر فيها). للعضو طلب تعديل واحد ثم التوقيع أو الاعتذار.</small>
          </div>
        </div>)}

        {tab === 'requests' && (<div className="rm-card">
          <h3>طلبات وصلت عبر صفحات أعضاء الهيئة</h3>
          {!data.requests?.length ? <div className="rm-empty">لا طلبات بعد.</div> : (
            <table className="rm-table"><thead><tr><th>التاريخ</th><th>الطالب</th><th>العضو</th><th>الطلب</th><th>الحالة</th><th></th></tr></thead><tbody>
              {data.requests.map((r: any) => { const p = (data.profiles || []).find((x: any) => x.id === r.expert_profile_id); return (<tr key={r.id} data-testid="ad-req"><td><small>{fmt(r.created_at)}</small></td><td><b>{r.full_name}</b><br /><small>{r.email}{r.organization && ` · ${r.organization}`}</small></td><td>{p?.name_ar || '—'}</td><td>{r.title}<br /><small>{String(r.details || '').slice(0, 160)}</small></td><td><small>{r.status}</small></td><td className="am-acts"><a className="rm-btn ghost small" href={`/admin/consulting`}>افتح في الاستشارات</a>{p?.status === 'approved' && <button className="rm-btn small" onClick={() => { setTab('engagements'); setEngFor(p.id); setEngEdit(null); setEng({ ...EMPTY_ENG, kind: r.kind, title_ar: r.title.replace(/^\[[^\]]*\]\s*/, ''), scope_ar: r.details }); }}>حوّله إلى عقد</button>}</td></tr>); })}
            </tbody></table>)}
          <small className="am-note">بريد الطالب لا يُرسل للعضو؛ أَثَر ينسّق. تحويل الطلب إلى عقد يملأ النموذج ويبقى القرار بيدك.</small>
        </div>)}
      </div>
    </div>
  );
}

const CSS = `
.am{font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif;direction:rtl}
.am :is(button,a,input,select,textarea):focus-visible{outline:3px solid #3A1F36;outline-offset:2px}
.am-wrap{max-width:1160px;margin:0 auto;display:grid;gap:12px}.rm-card h3 small{font-size:12px;color:#5C4858}.rm-card h4{margin:10px 0 4px;color:#0b6f69;font-size:13px}.rm-card blockquote{margin:0;border-inline-start:3px solid #D9A866;padding:4px 12px;color:#2A1626;font-size:13.5px;line-height:1.8;white-space:pre-wrap;max-height:220px;overflow:auto}.rm-card ol,.rm-card ul{margin:0;padding-inline-start:18px;font-size:13px;line-height:1.8;color:#3A2634}.am-err{color:#991b1b;font-size:13px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 12px}.am-ok{color:#065f46;font-size:13px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px}.rm-kpis .g b{color:#0b6f69}.am-cycle{margin-inline-start:auto;display:flex;gap:6px}
.am-tabs{display:flex;gap:6px;flex-wrap:wrap}.am-tabs button{border:1px solid #EADFD6;background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:800;color:#4A3645;cursor:pointer}.am-tabs button.on{background:#3A1F36;color:#fff;border-color:#3A1F36}
.am-filters{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.am-filters button{border:1px solid #EADFD6;background:#FBF4EE;border-radius:999px;padding:4px 10px;font:inherit;font-size:12px;font-weight:800;color:#4A3645;cursor:pointer}.am-filters button.on{background:#0b6f69;color:#fff;border-color:#0b6f69}.am-filters small{opacity:.9}.rm-table tr.sel td{background:#FBEDE7}
.am-st{color:#fff;font-size:11px;font-weight:900;border-radius:999px;padding:2px 8px;white-space:nowrap}.rm-btn.small{padding:4px 9px;font-size:12px}.am-acts{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.am-review{margin-top:14px;border-top:2px solid #D4614A;padding-top:12px}.am-two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.am-decide{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}.am-note{display:block;color:#5C4858;font-size:12px;margin-top:6px;line-height:1.7}
.am-grid2{display:grid;grid-template-columns:1fr 1.1fr;gap:12px;align-items:start}
.rm-card label{display:grid;gap:4px;font-size:12.5px;color:#4A3645;font-weight:800;margin:8px 0}.rm-card input:not([type=checkbox]),.rm-card select,.rm-card textarea{border:1px solid #B3A5AE;border-radius:10px;padding:8px 10px;font:inherit;font-size:13.5px;font-weight:400;background:#fff;width:100%;box-sizing:border-box;color:#2A1626}.am-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.ad-head{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start}.ad-photo{width:96px;height:96px;border-radius:14px;object-fit:cover;background:#EADFD6}.ad-photo.none{display:flex;align-items:center;justify-content:center;color:#5C4858;font-size:12px}.ad-sub{margin:2px 0;color:#5C4858;font-size:12.5px;line-height:1.7}.ad-sub a{color:#3A1F36}
.ad-issues{background:#fffbeb;border:1px solid #f59e0b;border-radius:10px;padding:6px 24px 6px 10px;color:#78350f;font-size:12.5px;margin:8px 0}
@media(max-width:860px){.am-grid2,.am-two,.am-row3{grid-template-columns:1fr}.am-cycle{margin-inline-start:0}}
`;
