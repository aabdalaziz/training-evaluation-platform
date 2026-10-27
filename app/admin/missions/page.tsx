'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// إدارة أَثَر — مهمات في قلب العمل (P12-أ): لوحة المهمات (بانتظار الدليل/المشرف/مؤكَّدة)، قوالب لكل برنامج مع «اقترح مهمات» (ذكاء اصطناعي أو
// قوالب بدء محلية — المدرّب يعدّل ويعتمد)، إسناد يدوي لمتمّي البرنامج، تذكير، وتأكيد/إعادة من الطاقم عند غياب المشرف. الإنسان يعتمد دائمًا.
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { MODE_LABEL, STATUS_LABEL, EMPTY_TEMPLATE, templateToForm, daysLeft } from '../../../lib/portal/missions';
import type { Mission, MissionTemplate, TemplateForm, TransferStats, EvidenceMode } from '../../../lib/portal/missions';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const fmt = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
type Data = { templates: MissionTemplate[]; missions: Mission[]; programs: { id: string; name_ar: string }[]; skills: { id: string; code: string; name_ar: string; domain: string }[]; stats: TransferStats };
type Person = { email: string; full_name?: string | null; issued_at: string; assigned: boolean };

export default function AdminMissionsPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [ok, setOk] = useState(''); const [tok, setTok] = useState(''); const [busy, setBusy] = useState('');
  const [data, setData] = useState<Data | null>(null); const [tab, setTab] = useState<'board' | 'templates' | 'assign'>('board'); const [filter, setFilter] = useState<'all' | Mission['status']>('all'); const [sel, setSel] = useState<Mission | null>(null); const [note, setNote] = useState('');
  const [form, setForm] = useState<TemplateForm>(EMPTY_TEMPLATE); const [editId, setEditId] = useState<string | null>(null); const [suggest, setSuggest] = useState<{ list: any[]; source: string; skill_ids: string[] } | null>(null);
  const [asgTpl, setAsgTpl] = useState(''); const [people, setPeople] = useState<Person[] | null>(null); const [picked, setPicked] = useState<Set<string>>(new Set()); const [manual, setManual] = useState('');

  const H = (tk = tok) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` });
  async function load(tk = tok) { const j = await fetch('/api/missions?admin=1', { headers: H(tk) }).then(r => r.json()); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setData(j); }
  async function post(body: any) { setBusy(body.action); setError(''); setOk(''); try { const j = await fetch('/api/missions', { method: 'POST', headers: H(), body: JSON.stringify(body) }).then(r => r.json()); if (!j.success) throw new Error(j.error || 'خطأ'); return j; } catch (e: any) { setError(e.message); return null; } finally { setBusy(''); } }
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/missions'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
    const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const programs = useMemo(() => new Map((data?.programs || []).map(p => [p.id, p.name_ar])), [data]);
  const skillsById = useMemo(() => new Map((data?.skills || []).map(s => [s.id, s])), [data]);
  const missions = useMemo(() => (data?.missions || []).filter(m => filter === 'all' || m.status === filter), [data, filter]);
  const counts = useMemo(() => { const c: Record<string, number> = { all: data?.missions.length || 0 }; for (const m of data?.missions || []) c[m.status] = (c[m.status] || 0) + 1; return c; }, [data]);

  async function saveTemplate() { const j = await post({ action: 'template_save', id: editId, form }); if (j) { setOk(editId ? 'حُدّث القالب' : 'أُنشئ القالب'); setForm(EMPTY_TEMPLATE); setEditId(null); await load(); } }
  async function delTemplate(id: string) { if (!confirm('حذف القالب؟ المهمات المُسندة سابقًا تبقى.')) return; const j = await post({ action: 'template_delete', id }); if (j) await load(); }
  async function doSuggest() { const j = await post({ action: 'suggest', program_id: form.program_id }); if (j) setSuggest({ list: j.templates || [], source: j.source, skill_ids: j.skill_ids || [] }); }
  function adopt(s: any) { setForm(f => ({ ...f, title_ar: s.title_ar, brief_ar: s.brief_ar, evidence_mode: s.evidence_mode, rubric: s.rubric, days_after: String(s.days_after), due_days: String(s.due_days), skills: f.skills.length ? f.skills : (suggest?.skill_ids || []).slice(0, 3) })); setOk('نُسخ المقترح إلى النموذج — راجعه ثم احفظ'); }
  async function loadPeople(tplId: string) { setAsgTpl(tplId); setPeople(null); setPicked(new Set()); const tpl = data?.templates.find(t => t.id === tplId); if (!tpl?.program_id) { setPeople([]); return; } const j = await fetch(`/api/missions?admin=1&completers=${encodeURIComponent(tpl.program_id)}&template=${encodeURIComponent(tplId)}`, { headers: H() }).then(r => r.json()); setPeople(j.success ? j.people : []); }
  async function assign() { const emails = Array.from(picked).concat(manual.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean)); const j = await post({ action: 'assign', template_id: asgTpl, emails }); if (j) { setOk(`أُسندت ${j.created} مهمة${j.skipped ? ` · تم تخطي ${j.skipped} (مُسندة سابقًا)` : ''}`); setManual(''); await loadPeople(asgTpl); await load(); } }
  async function decide(m: Mission, decision: 'confirmed' | 'returned') { const j = await post({ action: 'decide', id: m.id, decision, note }); if (j) { setOk(decision === 'confirmed' ? 'تم التأكيد' : 'أُعيدت للمتدرب'); setSel(null); setNote(''); await load(); } }
  async function remind(m: Mission) { const j = await post({ action: 'remind', id: m.id }); if (j) setOk(j.mailed ? 'أُرسل التذكير' : `لم يُرسل البريد (تحقق من RESEND) — الرابط: ${j.url}`); await load(); }
  async function cycle(dry: boolean) { const j = await post({ action: 'cycle', dry }); if (j) { setOk(`${dry ? 'معاينة' : 'تنفيذ'}: إسناد ${j.assigned} · تذكير ${j.reminded} · انتهاء ${j.expired}${j.previews?.length ? ` — ${j.previews.slice(0, 3).map((p: any) => p.email).join('، ')}` : ''}`); if (!dry) await load(); } }
  const St = ({ s }: { s: Mission['status'] }) => <span className="am-st" style={{ background: STATUS_LABEL[s].color }}>{STATUS_LABEL[s].ar}</span>;

  if (!ready) return <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="am-wrap"><div className="am-card">{error ? <span className="am-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  const st = data?.stats;
  return (
    <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="am-wrap">
        <header className="am-head"><div><span className="am-kicker"><Icon name="flag" size={14} /> بوابة أَثَر · P12-أ</span><h1>مهمات في قلب العمل</h1><p>بدل استبانة «هل طبّقت؟»: مهمة دقيقة بدليل حقيقي من بيئة العمل، معيار معلن، فحص أولي، وتأكيد المشرف بضغطة. كل دليل مؤكَّد يدخل الملف المهاري والتوأم والشهادة الحية — ويبني قاعدة أدلة انتقال الأثر.</p></div></header>
        <PortalAdminTabs />
        {error && <div className="am-err">{error}</div>}{ok && <div className="am-ok">{ok}</div>}
        {st && <div className="am-kpis"><span><b>{st.total}</b> مهمة</span><span><b>{st.response_rate}%</b> استجابة</span><span className="g"><b>{st.confirm_rate}%</b> مؤكَّدة</span><span><b>{st.median_days ?? '—'}</b> يوم حتى الإرسال (وسيط)</span><span><b>{st.avg_score ?? '—'}{st.avg_score !== null ? '%' : ''}</b> متوسط الفحص الأولي</span><span className="am-cycle"><button className="am-btn ghost" disabled={!!busy} onClick={() => cycle(true)}>معاينة دورة اليوم</button><button className="am-btn" disabled={!!busy} onClick={() => cycle(false)}>تشغيل الدورة الآن</button></span></div>}
        <div className="am-tabs"><button className={tab === 'board' ? 'on' : ''} onClick={() => setTab('board')}>لوحة المهمات ({counts.all})</button><button className={tab === 'templates' ? 'on' : ''} onClick={() => setTab('templates')}>القوالب ({data?.templates.length || 0})</button><button className={tab === 'assign' ? 'on' : ''} onClick={() => setTab('assign')}>إسناد لمتمّي برنامج</button></div>

        {tab === 'board' && <div className="am-card">
          <div className="am-filters">{(['all', 'assigned', 'submitted', 'confirmed', 'returned', 'expired'] as const).map(f => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f === 'all' ? 'الكل' : STATUS_LABEL[f].ar} <small>{counts[f] || 0}</small></button>)}</div>
          {!missions.length && <div className="am-empty">لا مهمات هنا بعد. أنشئ قالبًا ثم أسنده لمتمّي برنامج — أو انتظر الدورة اليومية (06:00) التي تُسند تلقائيًا بعد شهادة الإتمام.</div>}
          {!!missions.length && <table className="am-table"><thead><tr><th>المتدرب</th><th>المهمة</th><th>الدليل</th><th>الحالة</th><th>المهلة</th><th>الفحص</th><th>المشرف</th><th></th></tr></thead><tbody>
            {missions.map(m => { const dl = daysLeft(m.due_at); return <tr key={m.id} className={sel?.id === m.id ? 'sel' : ''}>
              <td><b>{m.full_name || '—'}</b><br /><small dir="ltr">{m.email}</small></td>
              <td>{m.title_ar}<br /><small>{programs.get(m.program_id || '') || '—'}</small></td>
              <td><small>{MODE_LABEL[m.evidence_mode].ar}</small></td>
              <td><St s={m.status} /></td>
              <td><small className={dl < 0 && m.status === 'assigned' ? 'am-late' : ''}>{fmt(m.due_at)}{m.status === 'assigned' ? ` (${dl >= 0 ? `بقي ${dl}` : `تأخر ${-dl}`} يوم)` : ''}</small></td>
              <td>{m.ai ? <b className={m.ai.score >= 70 ? 'am-good' : m.ai.score >= 45 ? 'am-mid' : 'am-low'}>{m.ai.score}%</b> : <small>—</small>}</td>
              <td><small>{m.supervisor_name || m.supervisor_email || '—'}{m.confirmed_by ? <><br />✓ {m.confirmed_by}</> : null}</small></td>
              <td className="am-acts">{m.status === 'submitted' && <button className="am-btn small" onClick={() => { setSel(m); setNote(''); }}>راجع واعتمد</button>}{m.status === 'assigned' && <button className="am-btn ghost small" disabled={!!busy} onClick={() => remind(m)}>تذكير</button>}<a className="am-btn ghost small" href={`/m/${m.token}`} target="_blank" rel="noopener noreferrer">فتح</a></td>
            </tr>; })}
          </tbody></table>}
          {sel && <div className="am-review">
            <h3>مراجعة: {sel.title_ar} — {sel.full_name || sel.email}</h3>
            <div className="am-two">
              <div><h4>المعيار والفحص الأولي ({sel.ai?.score ?? '—'}% · {sel.ai?.source === 'ai' ? 'ذكاء اصطناعي' : 'محلي'})</h4><ol>{sel.rubric.map((c, i) => <li key={i}>{c.c} <small className={sel.ai?.criteria?.[i]?.met}>{sel.ai?.criteria?.[i]?.met === 'yes' ? 'ورد' : sel.ai?.criteria?.[i]?.met === 'partly' ? 'جزئيًا' : 'لم يرد'}</small></li>)}</ol><p>{sel.ai?.feedback_ar}</p></div>
              <div><h4>الدليل ({MODE_LABEL[sel.evidence_mode].ar})</h4>{sel.evidence?.file_path && <p><a href={`/m/confirm-preview`} onClick={e => { e.preventDefault(); window.open(`/m/${sel.token}`, '_blank'); }}>الملف يُعرض في صفحة المهمة ↗</a></p>}{sel.evidence?.link && <p><a href={sel.evidence.link} target="_blank" rel="noopener noreferrer" dir="ltr">{sel.evidence.link}</a></p>}<blockquote>{sel.evidence?.text || sel.evidence?.caption || sel.evidence?.transcript || '—'}</blockquote></div>
            </div>
            <div className="am-decide"><input value={note} onChange={e => setNote(e.target.value)} placeholder="ملاحظة للمتدرب (مطلوبة عند الإعادة)" /><button className="am-btn" disabled={!!busy} onClick={() => decide(sel, 'confirmed')}>أؤكد كطاقم</button><button className="am-btn ghost" disabled={!!busy || note.trim().length < 5} onClick={() => decide(sel, 'returned')}>أعِد للمتدرب</button><button className="am-btn ghost" onClick={() => setSel(null)}>إغلاق</button></div>
            <small className="am-note">الأفضل أن يؤكد المشرف المباشر (وزن 0.85). تأكيد الطاقم مقبول حين لا مشرف — ويُسجَّل باسمك.</small>
          </div>}
        </div>}

        {tab === 'templates' && <div className="am-grid2">
          <div className="am-card">
            <h3>{editId ? 'تعديل قالب' : 'قالب مهمة جديد'}</h3>
            <label>البرنامج<select value={form.program_id} onChange={e => setForm({ ...form, program_id: e.target.value })}><option value="">— بلا برنامج (إسناد يدوي فقط) —</option>{(data?.programs || []).map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
            <div className="am-suggest"><button className="am-btn ghost" disabled={!!busy} onClick={doSuggest}><Icon name="star" size={14} /> {busy === 'suggest' ? 'نقترح…' : 'اقترح مهمات لهذا البرنامج'}</button>{suggest && <small>{suggest.source === 'ai' ? 'مقترحات الذكاء الاصطناعي' : 'قوالب بدء محلية'} — المدرّب يعدّل ويعتمد</small>}</div>
            {suggest && <div className="am-sugs">{suggest.list.map((s, i) => <article key={i}><b>{s.title_ar}</b><small>{MODE_LABEL[s.evidence_mode as EvidenceMode]?.ar} · بعد {s.days_after} يوم · مهلة {s.due_days}</small><p>{s.brief_ar}</p><button className="am-btn small" onClick={() => adopt(s)}>انسخ إلى النموذج</button></article>)}</div>}
            <label>العنوان<input value={form.title_ar} onChange={e => setForm({ ...form, title_ar: e.target.value })} /></label>
            <label>التعليمات الدقيقة (بصيغة المخاطب)<textarea rows={4} value={form.brief_ar} onChange={e => setForm({ ...form, brief_ar: e.target.value })} /></label>
            <div className="am-row3"><label>نوع الدليل<select value={form.evidence_mode} onChange={e => setForm({ ...form, evidence_mode: e.target.value as EvidenceMode })}>{(Object.keys(MODE_LABEL) as EvidenceMode[]).map(k => <option key={k} value={k}>{MODE_LABEL[k].ar}</option>)}</select></label><label>تُرسل بعد الإتمام بـ (يوم)<input type="number" min={1} max={60} value={form.days_after} onChange={e => setForm({ ...form, days_after: e.target.value })} /></label><label>المهلة (يوم)<input type="number" min={3} max={21} value={form.due_days} onChange={e => setForm({ ...form, due_days: e.target.value })} /></label></div>
            <label>المعيار (بند + وزن 1–3)</label>
            {form.rubric.map((r, i) => <div key={i} className="am-rub"><input value={r.c} onChange={e => setForm({ ...form, rubric: form.rubric.map((x, j) => j === i ? { ...x, c: e.target.value } : x) })} placeholder={`معيار قابل للملاحظة ${i + 1}`} /><select value={r.w} onChange={e => setForm({ ...form, rubric: form.rubric.map((x, j) => j === i ? { ...x, w: Number(e.target.value) } : x) })}>{[1, 2, 3].map(w => <option key={w} value={w}>{w}</option>)}</select><button className="am-btn ghost small" onClick={() => setForm({ ...form, rubric: form.rubric.filter((_, j) => j !== i) })} disabled={form.rubric.length <= 2}>×</button></div>)}
            {form.rubric.length < 4 && <button className="am-btn ghost small" onClick={() => setForm({ ...form, rubric: [...form.rubric, { c: '', w: 1 }] })}>+ بند</button>}
            <label>المهارات التي تثبتها المهمة</label>
            <div className="am-skills">{(data?.skills || []).map(s => <button key={s.id} className={form.skills.includes(s.id) ? 'on' : ''} onClick={() => setForm({ ...form, skills: form.skills.includes(s.id) ? form.skills.filter(x => x !== s.id) : [...form.skills, s.id] })}>{s.name_ar}</button>)}</div>
            <label className="am-check"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> نشط (يُسند تلقائيًا بعد شهادة الإتمام)</label>
            <div className="am-decide"><button className="am-btn" disabled={!!busy} onClick={saveTemplate}>{editId ? 'حفظ التعديل' : 'إنشاء القالب'}</button>{editId && <button className="am-btn ghost" onClick={() => { setEditId(null); setForm(EMPTY_TEMPLATE); }}>إلغاء</button>}</div>
          </div>
          <div className="am-card">
            <h3>القوالب</h3>
            {!data?.templates.length && <div className="am-empty">لا قوالب بعد — ابدأ بـ«اقترح مهمات».</div>}
            {data?.templates.map(tpl => <article key={tpl.id} className={`am-tpl ${tpl.active ? '' : 'off'}`}><div><b>{tpl.title_ar}</b><small>{programs.get(tpl.program_id || '') || 'بلا برنامج'} · {MODE_LABEL[tpl.evidence_mode].ar} · بعد {tpl.days_after} يوم · {(tpl.skills || []).map(id => skillsById.get(id)?.name_ar).filter(Boolean).join('، ')}</small></div><div className="am-acts"><button className="am-btn ghost small" onClick={() => { setEditId(tpl.id); setForm(templateToForm(tpl)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>تعديل</button><button className="am-btn ghost small" onClick={() => { setTab('assign'); loadPeople(tpl.id); }}>إسناد</button><button className="am-btn ghost small danger" onClick={() => delTemplate(tpl.id)}>حذف</button></div></article>)}
          </div>
        </div>}

        {tab === 'assign' && <div className="am-card">
          <h3>إسناد مهمة لمتمّي برنامج</h3>
          <label>القالب<select value={asgTpl} onChange={e => loadPeople(e.target.value)}><option value="">— اختر —</option>{(data?.templates || []).map(t => <option key={t.id} value={t.id}>{t.title_ar} — {programs.get(t.program_id || '') || 'بلا برنامج'}</option>)}</select></label>
          {asgTpl && people && <>
            {people.length > 0 && <><div className="am-people-h"><small>متمّو البرنامج (شهادة إتمام) — {people.filter(p => !p.assigned).length} لم تُسند لهم</small><button className="am-btn ghost small" onClick={() => setPicked(new Set(people.filter(p => !p.assigned).map(p => p.email)))}>تحديد الكل</button></div>
              <div className="am-people">{people.map(p => <label key={p.email} className={p.assigned ? 'off' : ''}><input type="checkbox" disabled={p.assigned} checked={picked.has(p.email)} onChange={e => { const s = new Set(picked); if (e.target.checked) s.add(p.email); else s.delete(p.email); setPicked(s); }} /><b>{p.full_name || '—'}</b><small dir="ltr">{p.email}</small><small>{p.assigned ? 'مُسندة' : fmt(p.issued_at)}</small></label>)}</div></>}
            {people.length === 0 && <div className="am-empty">لا متمّين بشهادة إتمام لهذا البرنامج بعد (أو القالب بلا برنامج). يمكنك الإسناد اليدوي بالبريد:</div>}
            <label>بريد/عناوين إضافية (افصل بفاصلة أو سطر)<textarea rows={2} dir="ltr" value={manual} onChange={e => setManual(e.target.value)} placeholder="name@org.sa, other@org.sa" /></label>
            <div className="am-decide"><button className="am-btn" disabled={!!busy || (!picked.size && !manual.trim())} onClick={assign}><Icon name="send" size={14} /> أسند وأرسل ({picked.size + (manual.trim() ? manual.split(/[\s,;]+/).filter(Boolean).length : 0)})</button></div>
          </>}
        </div>}
        <p className="am-foot">الخصوصية: الأدلة في مخزن خاص بروابط موقّعة قصيرة العمر، يراها المشرف المعني والطاقم فقط، ولا تُستخدم لتدريب نماذج. الفحص الأولي يقرأ النص/النسخة الصوتية فقط. القرار الذي يرفع وزن الدليل بشري دائمًا.</p>
      </div>
    </div>
  );
}

const CSS = `
.am{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;direction:rtl}
.am-wrap{max-width:1160px;margin:0 auto;display:grid;gap:12px}
.am-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.am-head p{margin:0;color:#64748b;font-size:14px;line-height:1.7;max-width:900px}.am-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b8a83}
.am-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;overflow-x:auto}.am-card h3{margin:0 0 10px;color:#0f2a4e;font-size:17px}.am-card h4{margin:0 0 6px;color:#0b8a83;font-size:13px}
.am-empty{color:#64748b;font-size:14px;text-align:center;padding:20px;line-height:1.8}.am-err{color:#b91c1c;font-size:13px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 12px}.am-ok{color:#065f46;font-size:13px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px}
.am-kpis{display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:13px;color:#475569}.am-kpis b{font-size:20px;color:#0f2a4e;margin-inline-end:4px}.am-kpis .g b{color:#0b8a83}.am-cycle{margin-inline-start:auto;display:flex;gap:6px}
.am-tabs{display:flex;gap:6px;flex-wrap:wrap}.am-tabs button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:800;color:#334155;cursor:pointer}.am-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.am-filters{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.am-filters button{border:1px solid #e2e8f0;background:#f8fafc;border-radius:999px;padding:4px 10px;font:inherit;font-size:12px;font-weight:800;color:#334155;cursor:pointer}.am-filters button.on{background:#0b8a83;color:#fff;border-color:#0b8a83}.am-filters small{opacity:.8}
.am-table{width:100%;border-collapse:collapse;font-size:13px}.am-table th{text-align:right;color:#64748b;font-weight:800;font-size:12px;padding:8px 10px;border-bottom:1px solid #e2e8f0;white-space:nowrap}.am-table td{padding:9px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle;color:#0f172a}.am-table tr.sel td{background:#f0fdfa}.am-table small{color:#64748b;font-size:11.5px}
.am-st{color:#fff;font-size:11px;font-weight:900;border-radius:999px;padding:2px 8px;white-space:nowrap}.am-late{color:#b91c1c!important}.am-good{color:#047857}.am-mid{color:#b45309}.am-low{color:#b91c1c}
.am-btn{border:1px solid #0f2a4e;background:#0f2a4e;color:#fff;border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none}.am-btn.ghost{background:#fff;color:#0f2a4e;border-color:#cbd5e1}.am-btn.small{padding:4px 9px;font-size:12px}.am-btn.danger{color:#b91c1c;border-color:#fecaca}.am-btn:disabled{opacity:.5;cursor:default}.am-acts{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.am-review{margin-top:14px;border-top:2px solid #0b8a83;padding-top:12px}.am-two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.am-two ol{margin:0;padding-inline-start:18px;font-size:13.5px}.am-two li small{font-size:11px;border-radius:999px;padding:1px 8px;background:#f1f5f9;margin-inline-start:6px}.am-two li small.yes{background:#dcfce7;color:#166534}.am-two li small.partly{background:#fef3c7;color:#92400e}.am-two li small.no{background:#fee2e2;color:#991b1b}.am-two p{color:#334155;font-size:13px;line-height:1.7}
.am-two blockquote{margin:0;border-inline-start:3px solid #c9a24b;padding:4px 12px;color:#0f172a;font-size:13.5px;line-height:1.8;white-space:pre-wrap;max-height:260px;overflow:auto}
.am-decide{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}.am-decide input{flex:1;min-width:220px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px}.am-note{display:block;color:#64748b;font-size:12px;margin-top:6px}
.am-grid2{display:grid;grid-template-columns:1.1fr .9fr;gap:12px;align-items:start}
.am-card label{display:grid;gap:4px;font-size:12.5px;color:#334155;font-weight:800;margin:8px 0}.am-card input:not([type=checkbox]),.am-card select,.am-card textarea{border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;font-size:13.5px;font-weight:400;background:#fff;width:100%;box-sizing:border-box}.am-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.am-rub{display:grid;grid-template-columns:1fr 64px auto;gap:6px;margin-bottom:6px}.am-skills{display:flex;gap:6px;flex-wrap:wrap}.am-skills button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:4px 10px;font:inherit;font-size:12px;cursor:pointer;color:#334155}.am-skills button.on{background:#0b8a83;color:#fff;border-color:#0b8a83}
.am-check{display:flex!important;align-items:center;gap:8px;grid-auto-flow:column}.am-suggest{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:4px 0}.am-suggest small{color:#64748b}
.am-sugs{display:grid;gap:8px;margin:8px 0 4px}.am-sugs article{border:1px dashed #cbd5e1;border-radius:12px;padding:10px 12px;background:#fbfbf7;display:grid;gap:4px}.am-sugs b{color:#0f2a4e}.am-sugs small{color:#64748b;font-size:11.5px}.am-sugs p{margin:0;font-size:13px;color:#334155;line-height:1.7}.am-sugs button{justify-self:start}
.am-tpl{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;border-bottom:1px solid #f1f5f9;padding:10px 0}.am-tpl.off{opacity:.55}.am-tpl b{display:block;color:#0f2a4e;font-size:14px}.am-tpl small{color:#64748b;font-size:12px;line-height:1.6}
.am-people-h{display:flex;justify-content:space-between;align-items:center;margin:8px 0 4px}.am-people{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:6px}.am-people label{display:grid!important;grid-template-columns:auto 1fr;gap:2px 8px;align-items:center;border:1px solid #e2e8f0;border-radius:10px;padding:6px 10px;margin:0;font-weight:400}.am-people label.off{opacity:.5}.am-people label b{font-size:13px}.am-people label small{grid-column:2;color:#64748b;font-size:11.5px}.am-people input{grid-row:span 3;width:auto!important}
.am-foot{color:#64748b;font-size:12.5px;line-height:1.8;margin:4px 0 0}
@media(max-width:860px){.am-grid2,.am-two,.am-row3{grid-template-columns:1fr}.am-cycle{margin-inline-start:0}}
`;
