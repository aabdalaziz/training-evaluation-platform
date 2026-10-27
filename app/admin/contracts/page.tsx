'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// إدارة أَثَر — عقود الأثر (P12-ب): محفظة العقود بحالتها الحية، إنشاء عقد (جهة + برنامج + شريحة مقترحة + 60/25/15 + أهداف)،
// تفعيل، إثبات التسليم، الإفراج عن الدفعات المستحقة بمذكرة مرقّمة، ونبض العقود. كل دفعة قرار بشري موثَّق — الأرقام من الأدلة لا من التقديرات.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { parsePeople } from '../../../lib/portal/org';
import { EMPTY_CONTRACT_FORM, MILESTONE_LABEL, MS_STATUS_LABEL, STATUS_LABEL, HEALTH_LABEL, money, pctOf, milestoneAmounts, normalizeSplit, contractUrl, contractToForm, validateContract } from '../../../lib/portal/contracts';
import type { Contract, ContractForm, ContractState, CohortPerson, MilestoneKey, PersonFacts, Release } from '../../../lib/portal/contracts';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const fmt = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium' }) : '—';
type Item = { contract: Contract; state: ContractState; releases: Release[]; people: PersonFacts[] };
type Data = { items: Item[]; portfolio: { total: number; active: number; value: number; paid: number; due: number; at_risk: number; evidence_rate: number }; orgs: { id: string; name_ar: string; email_domain?: string | null; contact_email?: string | null; contact_name?: string | null }[]; programs: { id: string; name_ar: string }[] };
const MS_COLOR: Record<string, string> = { locked: '#94a3b8', progress: '#0b8a83', due: '#c9a24b', released: '#16a34a' };

export default function AdminContractsPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [ok, setOk] = useState(''); const [tok, setTok] = useState(''); const [busy, setBusy] = useState('');
  const [data, setData] = useState<Data | null>(null); const [tab, setTab] = useState<'portfolio' | 'new'>('portfolio'); const [selId, setSelId] = useState<string | null>(null); const [note, setNote] = useState(''); const [deliverAt, setDeliverAt] = useState('');
  const [form, setForm] = useState<ContractForm>(EMPTY_CONTRACT_FORM); const [editId, setEditId] = useState<string | null>(null); const [proposing, setProposing] = useState(false);
  const H = (tk = tok) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` });
  async function load(tk = tok) { const j = await fetch('/api/contracts?admin=1', { headers: H(tk) }).then(r => r.json()); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setData(j); }
  async function post(body: any) { setBusy(body.action); setError(''); setOk(''); try { const j = await fetch('/api/contracts', { method: 'POST', headers: H(), body: JSON.stringify(body) }).then(r => r.json()); if (!j.success) throw new Error(j.error || 'خطأ'); return j; } catch (e: any) { setError(e?.message || 'خطأ'); return null; } finally { setBusy(''); } }
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/contracts'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
    const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sel = useMemo(() => data?.items.find(i => i.contract.id === selId) || null, [data, selId]);
  const cohort: CohortPerson[] = useMemo(() => parsePeople(form.cohort_text).map(p => ({ email: p.email, full_name: p.full_name || null })), [form.cohort_text]);
  const amounts = useMemo(() => milestoneAmounts(Number(form.total_amount) || 0, normalizeSplit(form.split)), [form.total_amount, form.split]);
  const formErr = useMemo(() => validateContract(form, cohort), [form, cohort]);
  const site = typeof window !== 'undefined' ? window.location.origin : '';

  async function propose() {
    if (!form.organization_id) { setError('اختر الجهة أولًا'); return; } setProposing(true); setError('');
    try { const j = await fetch(`/api/contracts?admin=1&propose=1&org=${encodeURIComponent(form.organization_id)}&program=${encodeURIComponent(form.program_id)}`, { headers: H() }).then(r => r.json()); if (!j.success) throw new Error(j.error);
      const list = (j.cohort || []) as CohortPerson[]; setForm(f => ({ ...f, cohort_text: list.map(p => (p.full_name ? `${p.full_name} <${p.email}>` : p.email)).join('\n') || f.cohort_text, contact_email: f.contact_email || j.contact_email || '', contact_name: f.contact_name || j.contact_name || '' }));
      setOk(list.length ? `اقتُرح ${list.length} منسوبًا من تسجيلات البرنامج المنتمين للجهة — عدّل القائمة كما تشاء` : 'لا تسجيلات مطابقة — الصق القائمة يدويًا');
    } catch (e: any) { setError(e?.message || 'خطأ'); } finally { setProposing(false); }
  }
  function pickOrg(id: string) { const o = data?.orgs.find(x => x.id === id); setForm(f => ({ ...f, organization_id: id, contact_email: f.contact_email || o?.contact_email || '', contact_name: f.contact_name || o?.contact_name || '', title_ar: f.title_ar || (o ? `عقد أثر — ${o.name_ar}` : '') })); }
  async function save() { const j = await post({ action: editId ? 'update' : 'create', id: editId, form, cohort }); if (j) { setOk(editId ? 'حُدّثت المسودة' : 'أُنشئت مسودة العقد — راجعها ثم فعّلها'); setForm(EMPTY_CONTRACT_FORM); setEditId(null); await load(); setTab('portfolio'); setSelId(j.contract.id); } }
  function edit(c: Contract) { setForm(contractToForm(c)); setEditId(c.id); setTab('new'); }
  async function act(action: string, extra: any = {}) { const j = await post({ action, id: selId, ...extra }); if (j) { setOk(action === 'activate' ? (j.mailed ? 'فُعِّل العقد وأُرسل الرابط الحي للجهة' : 'فُعِّل العقد (لم يُرسل بريد — لا بريد اتصال أو RESEND غير مضبوط)') : action === 'deliver' ? 'أُثبت التسليم — فُتحت نافذة الأثر' : action === 'release' ? `أُفرج عن الدفعة · مذكرة ${j.release?.memo_no}${j.mailed ? ' · أُبلغت الجهة' : ''}` : action === 'cancel' ? 'أُلغي العقد' : 'تم'); setNote(''); await load(); } }
  async function pulse(dry: boolean) { const j = await post({ action: 'pulse', dry }); if (j) { const r = j.result; setOk(`${dry ? 'معاينة' : 'تنفيذ'} النبض: فُحص ${r.checked} · إشعارات ${dry ? r.previews.length : r.notified}${r.previews?.length ? ` — ${r.previews.slice(0, 3).map((p: any) => p.subject).join(' | ')}` : ''}${r.errors?.length ? ` · أخطاء: ${r.errors.join('; ')}` : ''}`); } }
  function copyLink(c: Contract) { navigator.clipboard?.writeText(`${site}${contractUrl(c.token)}`).then(() => setOk('نُسخ الرابط الحي')); }

  if (!ready) return <div className="ac"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="ac-wrap"><div className="ac-card">{error ? <span className="ac-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  const pf = data?.portfolio;
  return (
    <div className="ac"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ac-wrap">
        <header className="ac-head"><div><span className="ac-kicker"><Icon name="scale" size={14} /> بوابة أَثَر · P12-ب</span><h1>عقود الأثر</h1><p>الجهة تدفع ثمن النتيجة لا المقعد: 60% عند التسليم، 25% عند أدلة الأثر المؤكَّدة من مشرفيها (مهمات قلب العمل)، 15% عند أثر 90 يومًا — تناسبيًا إن لم يُبلَغ الهدف. الأرقام تُحتسب من الأدلة الموجودة أصلًا، والإفراج عن كل دفعة قرار بشري بمذكرة مرقّمة.</p></div></header>
        <PortalAdminTabs />
        {error && <div className="ac-err">{error}</div>}{ok && <div className="ac-ok">{ok}</div>}
        {pf && <div className="ac-card ac-kpis"><span><b>{pf.total}</b> عقدًا</span><span><b className="g">{pf.active}</b> نشط</span><span><b>{money(pf.value, 'SAR', 'ar')}</b> قيمة المحفظة</span><span><b className="g">{money(pf.paid, 'SAR', 'ar')}</b> أُفرج عنه</span><span><b className="y">{money(pf.due, 'SAR', 'ar')}</b> مستحق الآن</span>{pf.at_risk > 0 && <span><b className="r">{money(pf.at_risk, 'SAR', 'ar')}</b> يحتاج انتباهًا</span>}<span><b>{pf.evidence_rate}%</b> متوسط أدلة الأثر</span><span className="ac-cycle"><button className="ac-btn ghost small" disabled={!!busy} onClick={() => pulse(true)}>معاينة النبض</button><button className="ac-btn small" disabled={!!busy} onClick={() => pulse(false)}>تشغيل النبض</button></span></div>}
        <div className="ac-tabs"><button className={tab === 'portfolio' ? 'on' : ''} onClick={() => setTab('portfolio')}>المحفظة ({data?.items.length || 0})</button><button className={tab === 'new' ? 'on' : ''} onClick={() => setTab('new')}>{editId ? 'تعديل المسودة' : 'عقد جديد'}</button></div>

        {tab === 'portfolio' && <div className="ac-card">
          {(data?.items.length || 0) === 0 && <div className="ac-empty">لا عقود بعد — أنشئ أول عقد أثر من تبويب «عقد جديد».</div>}
          {(data?.items.length || 0) > 0 && <table className="ac-table"><thead><tr><th>العقد</th><th>الجهة · البرنامج</th><th>الحالة</th><th>الدفعات</th><th>الأدلة</th><th>مستحق الآن</th><th></th></tr></thead><tbody>
            {data!.items.map(({ contract: c, state: s }) => <tr key={c.id} className={selId === c.id ? 'sel' : ''}>
              <td><b>{c.title_ar}</b><br /><small>{money(c.total_amount, c.currency, 'ar')} · {c.cohort.length} منسوبًا</small></td>
              <td>{c.org_name}<br /><small>{c.program_name || '—'}</small></td>
              <td><span className="ac-st" style={{ background: STATUS_LABEL[c.status].color }}>{STATUS_LABEL[c.status].ar}</span><br /><small className={`ac-h ${s.health}`}>{HEALTH_LABEL[s.health].ar}</small></td>
              <td><div className="ac-dots">{s.milestones.map(m => <i key={m.key} title={`${MILESTONE_LABEL[m.key].ar}: ${MS_STATUS_LABEL[m.status].ar}`} style={{ width: `${m.pct}%` }}><em style={{ width: `${m.progress}%`, background: MS_COLOR[m.status] }} /></i>)}</div></td>
              <td>{s.evidenced}/{s.cohort} <small>({pctOf(s.evidenced, s.cohort)}%)</small></td>
              <td className={s.due > 0 ? 'ac-due' : ''}>{s.due > 0 ? money(s.due, c.currency, 'ar') : '—'}</td>
              <td><button className="ac-btn ghost small" onClick={() => { setSelId(selId === c.id ? null : c.id); setNote(''); }}>{selId === c.id ? 'إغلاق' : 'فتح'}</button></td>
            </tr>)}
          </tbody></table>}

          {sel && <div className="ac-detail">
            <div className="ac-detail-head"><div><h3>{sel.contract.title_ar}</h3><small>{sel.contract.org_name} · {sel.contract.program_name || 'بلا برنامج'} · أُنشئ {fmt(sel.contract.created_at)}{sel.contract.start_at ? ` · بدأ ${fmt(sel.contract.start_at)}` : ''}{sel.contract.delivered_at ? ` · سُلِّم ${fmt(sel.contract.delivered_at)}` : ''}</small></div>
              <div className="ac-actions">
                <a className="ac-btn ghost small" href={contractUrl(sel.contract.token)} target="_blank" rel="noopener noreferrer"><Icon name="globe" size={13} /> الصفحة الحية</a><button className="ac-btn ghost small" onClick={() => copyLink(sel.contract)}><Icon name="copy" size={13} /> نسخ الرابط</button>
                {sel.contract.status === 'draft' && <><button className="ac-btn ghost small" onClick={() => edit(sel.contract)}><Icon name="edit" size={13} /> تعديل</button><button className="ac-btn small" disabled={!!busy} onClick={() => act('activate')}><Icon name="play" size={13} /> تفعيل وإرسال الرابط للجهة</button></>}
                {sel.contract.status === 'active' && !sel.contract.delivered_at && <span className="ac-inline"><input type="date" value={deliverAt} onChange={e => setDeliverAt(e.target.value)} /><button className="ac-btn small" disabled={!!busy} onClick={() => act('deliver', { at: deliverAt || undefined })}><Icon name="check" size={13} /> إثبات التسليم</button></span>}
                {sel.contract.status !== 'settled' && sel.contract.status !== 'cancelled' && <button className="ac-btn ghost small danger" disabled={!!busy} onClick={() => { if (confirm('إلغاء العقد؟')) act('cancel'); }}>إلغاء</button>}
              </div></div>
            <div className="ac-ms">{sel.state.milestones.map((m) => <div key={m.key} className="ac-m" style={{ '--c': MS_COLOR[m.status] } as any}>
              <div className="ac-m-top"><b>{MILESTONE_LABEL[m.key].ar} · {m.pct}%</b><span>{MS_STATUS_LABEL[m.status].ar}</span></div>
              <div className="ac-m-bar"><i style={{ width: `${m.progress}%` }} /></div>
              <p>{m.metric.ar}</p><small>{m.detail.ar}{m.prorata ? ' · تناسبية' : ''}</small>
              <div className="ac-m-amt">{money(m.payable, sel.contract.currency, 'ar')}{m.payable !== m.amount && <small> من {money(m.amount, sel.contract.currency, 'ar')}</small>}</div>
              {m.release ? <small className="ac-relno"><Icon name="doc" size={12} /> {m.release.memo_no} · {fmt(m.release.released_at)} · {m.release.released_by_name || 'الطاقم'}</small>
                : m.status === 'due' ? <div className="ac-release"><input placeholder="ملاحظة للمذكرة (اختياري)" value={note} onChange={e => setNote(e.target.value)} /><button className="ac-btn small gold" disabled={!!busy} onClick={() => act('release', { milestone: m.key as MilestoneKey, note })}><Icon name="award" size={13} /> الإفراج عن الدفعة</button></div> : null}
            </div>)}</div>
            <div className="ac-two">
              <div><h4>ما الذي يُحرّك الدفعة التالية؟</h4>{sel.state.next.length === 0 ? <p className="ac-muted">لا إجراءات معلّقة.</p> : <ol>{sel.state.next.map((n, i) => <li key={i}>{n.ar}</li>)}</ol>}
                <h4 style={{ marginTop: 10 }}>نافذة الأثر</h4><p className="ac-muted">{!sel.contract.delivered_at ? 'تُفتح عند إثبات التسليم.' : sel.state.window.closed ? `أُغلقت في ${fmt(sel.state.window.closes)}` : `تُغلق في ${fmt(sel.state.window.closes)} — تبقّى ${sel.state.window.days_left} يومًا · يُحتسب الأثر المستدام من ${fmt(sel.state.window.opens)}`}</p></div>
              <div><h4>الشريحة ({sel.people.length}) — للطاقم فقط</h4><div className="ac-people">{sel.people.map(p => <span key={p.email} className={p.confirmed_missions ? 'ok' : p.completed ? 'mid' : ''} title={`${p.completed ? 'أتمّ' : 'لم يُتمّ'} · مؤكَّدة ${p.confirmed_missions} · مُرسلة ${p.submitted_missions} · أدلة ${p.evidence_at.length}`}>{p.email}{p.confirmed_missions ? ' ✓' : p.submitted_missions ? ' …' : ''}</span>)}</div></div>
            </div>
          </div>}
        </div>}

        {tab === 'new' && <div className="ac-grid2">
          <div className="ac-card">
            <h3>{editId ? 'تعديل مسودة العقد' : 'عقد أثر جديد'}</h3>
            <label>الجهة<select value={form.organization_id} onChange={e => pickOrg(e.target.value)}><option value="">— اختر —</option>{data?.orgs.map(o => <option key={o.id} value={o.id}>{o.name_ar}</option>)}</select></label>
            <label>البرنامج (اختياري — يحصر الشهادات والمهمات به)<select value={form.program_id} onChange={e => setForm(f => ({ ...f, program_id: e.target.value }))}><option value="">— كل البرامج —</option>{data?.programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
            <label>عنوان العقد<input value={form.title_ar} onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))} placeholder="عقد أثر — تدريب معلمي المرحلة المتوسطة" /></label>
            <div className="ac-row"><label>جهة الاتصال<input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></label><label>بريد جهة الاتصال (يصله الرابط الحي والمذكرات)<input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></label></div>
            <div className="ac-row"><label>قيمة العقد<input inputMode="decimal" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} placeholder="120000" /></label><label>العملة<input value={form.currency} maxLength={3} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} /></label><label>تاريخ البدء<input type="date" value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))} /></label></div>
            <h4>الدفعات (المجموع 100%)</h4>
            <div className="ac-row ac-split">{(['delivery', 'evidence', 'impact'] as MilestoneKey[]).map(k => <label key={k}>{MILESTONE_LABEL[k].ar}<input inputMode="numeric" value={form.split[k]} onChange={e => setForm(f => ({ ...f, split: { ...f.split, [k]: Number(e.target.value) || 0 } }))} /><small>{money(amounts[k], form.currency || 'SAR', 'ar')}</small></label>)}</div>
            <h4>الأهداف</h4>
            <div className="ac-row"><label>نسبة المنسوبين بدليل مؤكَّد من المشرف %<input inputMode="numeric" value={form.targets.evidence_rate} onChange={e => setForm(f => ({ ...f, targets: { ...f.targets, evidence_rate: Number(e.target.value) || 0 } }))} /></label><label>نافذة الأثر (يوم)<input inputMode="numeric" value={form.targets.impact_days} onChange={e => setForm(f => ({ ...f, targets: { ...f.targets, impact_days: Number(e.target.value) || 0 } }))} /></label><label>نسبة الأثر المستدام %<input inputMode="numeric" value={form.targets.impact_rate} onChange={e => setForm(f => ({ ...f, targets: { ...f.targets, impact_rate: Number(e.target.value) || 0 } }))} /></label></div>
            <h4>الشريحة المشمولة <button type="button" className="ac-btn ghost small" disabled={proposing || !form.organization_id} onClick={propose}><Icon name="users" size={13} /> {proposing ? '…' : 'اقترح من تسجيلات البرنامج'}</button></h4>
            <textarea rows={6} dir="ltr" style={{ textAlign: 'left' }} value={form.cohort_text} onChange={e => setForm(f => ({ ...f, cohort_text: e.target.value }))} placeholder={'بريد في كل سطر، أو: الاسم <email@org.sa>'} /><small className="ac-muted">{cohort.length} منسوبًا صالحًا</small>
            <label>ملاحظات داخلية<textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></label>
            <div className="ac-decide">{formErr && <small className="ac-muted">{formErr}</small>}<button className="ac-btn" disabled={!!busy || !!formErr} onClick={save}><Icon name="save" size={14} /> {editId ? 'حفظ المسودة' : 'إنشاء المسودة'}</button>{editId && <button className="ac-btn ghost" onClick={() => { setEditId(null); setForm(EMPTY_CONTRACT_FORM); }}>إلغاء</button>}</div>
          </div>
          <div className="ac-card ac-preview">
            <h3>معاينة ما ستراه الجهة</h3>
            <p className="ac-muted">صفحة حية برابط خاص: ثلاث حلقات للدفعات، عدّادات الأثر، نافذة 90 يومًا، و«ما الذي يُحرّك الدفعة التالية». تُرسل تلقائيًا عند التفعيل.</p>
            <div className="ac-pv">{(['delivery', 'evidence', 'impact'] as MilestoneKey[]).map(k => <div key={k}><b>{form.split[k]}%</b><span>{MILESTONE_LABEL[k].ar}</span><small>{money(amounts[k], form.currency || 'SAR', 'ar')}</small></div>)}</div>
            <ul className="ac-rules"><li><b>التسليم</b> — تُفرَج بعد إثبات الطاقم للتسليم.</li><li><b>أدلة الأثر</b> — تستحق عندما يبلغ من أكّد مشرفوهم مهمةً من قلب العمل <b>{form.targets.evidence_rate}%</b> من الشريحة ({Math.ceil(cohort.length * form.targets.evidence_rate / 100)} من {cohort.length}).</li><li><b>أثر {form.targets.impact_days} يومًا</b> — عند إغلاق النافذة بحسب نسبة الأثر المستدام (هدف <b>{form.targets.impact_rate}%</b>)؛ تناسبية إن لم يُبلَغ.</li></ul>
            <p className="ac-muted">قبل التفعيل: تأكد أن قوالب مهمات البرنامج نشطة في «مهمات العمل» حتى تُسند تلقائيًا بعد شهادات الإتمام — فهي محرّك الدفعتين الثانية والثالثة.</p>
          </div>
        </div>}
      </div>
    </div>
  );
}

const CSS = `
.ac{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;direction:rtl}
.ac-wrap{max-width:1160px;margin:0 auto;display:grid;gap:12px}
.ac-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.ac-head p{margin:0;color:#64748b;font-size:14px;line-height:1.7;max-width:900px}.ac-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b8a83}
.ac-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;overflow-x:auto}.ac-card h3{margin:0 0 10px;color:#0f2a4e;font-size:17px}.ac-card h4{margin:12px 0 6px;color:#0b8a83;font-size:13px;display:flex;align-items:center;gap:8px}
.ac-empty{color:#64748b;font-size:14px;text-align:center;padding:20px;line-height:1.8}.ac-err{color:#b91c1c;font-size:13px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 12px}.ac-ok{color:#065f46;font-size:13px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px}.ac-muted{color:#64748b;font-size:12.5px}
.ac-kpis{display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:13px;color:#475569}.ac-kpis b{font-size:18px;color:#0f2a4e;margin-inline-end:4px}.ac-kpis b.g{color:#0b8a83}.ac-kpis b.y{color:#b45309}.ac-kpis b.r{color:#b91c1c}.ac-cycle{margin-inline-start:auto;display:flex;gap:6px}
.ac-tabs{display:flex;gap:6px;flex-wrap:wrap}.ac-tabs button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:800;color:#334155;cursor:pointer}.ac-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.ac-table{width:100%;border-collapse:collapse;font-size:13px}.ac-table th{text-align:right;color:#64748b;font-weight:800;font-size:12px;padding:8px 10px;border-bottom:1px solid #e2e8f0;white-space:nowrap}.ac-table td{padding:9px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle;color:#0f172a}.ac-table tr.sel td{background:#f0fdfa}.ac-table small{color:#64748b;font-size:11.5px}.ac-due{color:#b45309;font-weight:900}
.ac-st{color:#fff;font-size:11px;font-weight:900;border-radius:999px;padding:2px 8px;white-space:nowrap}.ac-h.due{color:#b45309!important;font-weight:800}.ac-h.attention{color:#b91c1c!important;font-weight:800}.ac-h.on_track{color:#047857!important}
.ac-dots{display:flex;gap:3px;min-width:120px;height:10px}.ac-dots i{display:block;height:100%;border-radius:999px;background:#e2e8f0;position:relative;overflow:hidden}.ac-dots i em{position:absolute;top:0;bottom:0;right:0;width:0;border-radius:999px;transition:width .8s}
.ac-btn{border:1px solid #0f2a4e;background:#0f2a4e;color:#fff;border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none}.ac-btn.ghost{background:#fff;color:#0f2a4e;border-color:#cbd5e1}.ac-btn.small{padding:4px 9px;font-size:12px}.ac-btn.danger{color:#b91c1c;border-color:#fecaca}.ac-btn.gold{background:#c9a24b;border-color:#c9a24b;color:#0f2a4e}.ac-btn:disabled{opacity:.5;cursor:not-allowed}
.ac-detail{margin-top:14px;border-top:2px solid #0b8a83;padding-top:12px}.ac-detail-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}.ac-detail-head h3{margin:0}.ac-detail-head small{color:#64748b;font-size:12px}.ac-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.ac-inline{display:inline-flex;gap:6px;align-items:center}.ac-inline input{border:1px solid #cbd5e1;border-radius:8px;padding:4px 8px;font:inherit;font-size:12px}
.ac-ms{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}.ac-m{border:1px solid #e2e8f0;border-top:4px solid var(--c);border-radius:12px;padding:10px 12px;font-size:13px}.ac-m-top{display:flex;justify-content:space-between;gap:6px}.ac-m-top span{color:var(--c);font-weight:800;font-size:12px}.ac-m-bar{height:6px;background:#f1f5f9;border-radius:999px;margin:8px 0;overflow:hidden}.ac-m-bar i{display:block;height:100%;background:var(--c)}.ac-m p{margin:0;color:#0f2a4e;font-weight:700}.ac-m small{color:#64748b;font-size:11.5px;display:block}.ac-m-amt{margin-top:6px;font-size:16px;font-weight:900;color:#0f2a4e}.ac-m-amt small{display:inline;font-weight:500}.ac-relno{color:#16a34a!important;font-weight:800;margin-top:6px;display:flex!important;gap:4px;align-items:center}
.ac-release{display:flex;gap:6px;margin-top:8px}.ac-release input{flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:5px 8px;font:inherit;font-size:12px}
.ac-two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.ac-two ol{margin:0;padding-inline-start:18px;font-size:13.5px;line-height:1.8}.ac-people{display:flex;flex-wrap:wrap;gap:4px;max-height:160px;overflow:auto}.ac-people span{font-size:11px;background:#f1f5f9;border-radius:999px;padding:2px 8px;direction:ltr}.ac-people span.ok{background:#dcfce7;color:#166534}.ac-people span.mid{background:#fef3c7;color:#92400e}
.ac-grid2{display:grid;grid-template-columns:1.3fr .7fr;gap:12px;align-items:start}.ac-card label{display:block;font-size:12.5px;color:#334155;font-weight:700;margin:8px 0}.ac-card label input,.ac-card label select,.ac-card textarea{display:block;width:100%;margin-top:4px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;font-weight:500;box-sizing:border-box}.ac-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.ac-split label small{display:block;color:#0b8a83;font-weight:800;margin-top:3px}
.ac-decide{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}
.ac-pv{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}.ac-pv div{background:linear-gradient(135deg,#0f2a4e,#163a66);color:#fff;border-radius:12px;padding:12px 8px;text-align:center}.ac-pv b{display:block;font-size:22px}.ac-pv span{display:block;font-size:12px;opacity:.9}.ac-pv small{display:block;font-size:11px;color:#c9a24b;font-weight:800;margin-top:4px}
.ac-rules{margin:0;padding-inline-start:18px;font-size:13px;line-height:1.8;color:#334155}
@media (max-width:900px){.ac-ms,.ac-two,.ac-grid2{grid-template-columns:1fr}}
`;
