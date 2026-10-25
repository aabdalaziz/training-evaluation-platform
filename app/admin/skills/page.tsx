'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// بوابة أَثَر — نواة اقتصاد المهارات: تصنيف المهارات (مربوط بـ SAQF/SDAIA/CEFR) · القطاعات الموحّدة · الجهات العميلة (B2B)

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadXlsx } from '../../../lib/export/xlsx';
import { safeFilename } from '../../../lib/export/csv';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { DOMAINS, SKILL_LEVELS, CEFR, SAQF_LEVELS, SECTORS_FALLBACK, EMPTY_SKILL, validateSkill, skillPayload, skillToForm, nextSkillCode, domainLabel, skillLevelLabel, frameworkBadges, EMPTY_ORG, validateOrg, orgPayload, orgToForm, skillsSheet, orgsSheet } from '../../../lib/portal/skills';
import type { Skill, Sector, Organization, SkillForm, OrgForm, SkillDomain } from '../../../lib/portal/skills';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
type Tab = 'skills' | 'sectors' | 'orgs';

export default function Page() { return <Suspense fallback={null}><SkillsAdmin /></Suspense>; }

function SkillsAdmin() {
  const db = useMemo(() => supabase(), []); const router = useRouter(); const sp = useSearchParams();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [tab, setTab] = useState<Tab>((sp.get('tab') as Tab) || 'skills');
  const [skills, setSkills] = useState<Skill[]>([]); const [sectors, setSectors] = useState<Sector[]>(SECTORS_FALLBACK); const [orgs, setOrgs] = useState<Organization[]>([]); const [usage, setUsage] = useState<Record<string, number>>({});
  const [dom, setDom] = useState('all'); const [q, setQ] = useState(''); const [busy, setBusy] = useState('');
  const [sf, setSf] = useState<SkillForm | null>(null); const [sEdit, setSEdit] = useState<string | null>(null);
  const [of, setOf] = useState<OrgForm | null>(null); const [oEdit, setOEdit] = useState<string | null>(null);
  const [secForm, setSecForm] = useState<{ code: string; name_ar: string; name_en: string } | null>(null);
  const [orgAdmins, setOrgAdmins] = useState<Record<string, { email: string; full_name?: string | null; status: string }[]>>({}); const [adminEmail, setAdminEmail] = useState<Record<string, string>>({}); const [orgReqs, setOrgReqs] = useState<any[]>([]);
  const canWrite = !!me && WRITERS.includes(me.role);

  async function load() {
    const [{ data: s, error: e1 }, { data: sec }, { data: o }, { data: r }] = await Promise.all([
      db.from('portal_skills').select('*').order('code'),
      db.from('portal_sectors').select('*').order('sort'),
      db.from('portal_organizations').select('*').order('name_ar'),
      db.from('portal_resources').select('skills'),
    ]);
    if (e1) { setError(e1.message); return; }
    setSkills((s || []) as Skill[]); if (sec && (sec as any[]).length) setSectors(sec as Sector[]); setOrgs((o || []) as Organization[]);
    const u: Record<string, number> = {}; for (const row of ((r || []) as any[])) for (const id of (row.skills || [])) u[id] = (u[id] || 0) + 1; setUsage(u);
    const [{ data: adm }, { data: rq }] = await Promise.all([db.from('portal_org_members').select('organization_id,email,full_name,status').eq('role', 'org_admin'), db.from('portal_org_requests').select('*').order('created_at', { ascending: false }).limit(100)]);
    const a: Record<string, { email: string; full_name?: string | null; status: string }[]> = {}; for (const m of ((adm || []) as any[])) { (a[m.organization_id] = a[m.organization_id] || []).push(m); } setOrgAdmins(a); setOrgReqs(rq || []);
  }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/admin/skills'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single();
      const role = String((prof as any)?.role || '').toUpperCase(); if (!STAFF.includes(role)) { router.replace('/dashboard'); return; }
      setMe({ id: user.id, role }); await load(); setReady(true);
    })();
  }, [db, router]);
  const run = async (key: string, fn: () => Promise<string | void>) => { setBusy(key); setError(''); setNotice(''); try { const m = await fn(); if (m) setNotice(m); await load(); } catch (e: any) { setError(e.message || String(e)); } setBusy(''); };

  const shownSkills = useMemo(() => skills.filter(s => (dom === 'all' || s.domain === dom) && (!q.trim() || `${s.code} ${s.name_ar} ${s.name_en} ${s.sdaia_code || ''}`.toLowerCase().includes(q.trim().toLowerCase()))), [skills, dom, q]);
  const byDomain = useMemo(() => DOMAINS.map(d => ({ ...d, n: skills.filter(s => s.domain === d.value).length })), [skills]);

  const newSkill = () => { setSEdit(null); setSf({ ...EMPTY_SKILL, code: nextSkillCode('pedagogy', skills) }); };
  const changeDomain = (d: SkillDomain) => setSf(f => f ? { ...f, domain: d, code: sEdit ? f.code : nextSkillCode(d, skills) } : f);
  const saveSkill = () => run('ss', async () => {
    if (!sf) return; const v = validateSkill(sf); if (v) throw new Error(v); const p = skillPayload(sf);
    if (sEdit) { const { error } = await db.from('portal_skills').update(p).eq('id', sEdit); if (error) throw error; } else { const { error } = await db.from('portal_skills').insert(p); if (error) throw error; }
    setSf(null); return 'حُفظت المهارة.';
  });
  const toggleSkill = (s: Skill) => run('ts' + s.id, async () => { const { error } = await db.from('portal_skills').update({ active: !s.active, updated_at: new Date().toISOString() }).eq('id', s.id); if (error) throw error; return s.active ? 'عُطّلت المهارة (تبقى في المواد المرتبطة).' : 'فُعّلت المهارة.'; });
  const deleteSkill = (s: Skill) => run('ds' + s.id, async () => { if ((usage[s.id] || 0) > 0) throw new Error('المهارة مستخدمة في مواد منشورة — عطّلها بدل حذفها.'); if (!window.confirm(`حذف «${s.name_ar}»؟`)) return; const { error } = await db.from('portal_skills').delete().eq('id', s.id); if (error) throw error; return 'حُذفت المهارة.'; });

  const saveOrg = () => run('so', async () => {
    if (!of) return; const v = validateOrg(of); if (v) throw new Error(v); const p = orgPayload(of);
    if (oEdit) { const { error } = await db.from('portal_organizations').update(p).eq('id', oEdit); if (error) throw error; } else { const { error } = await db.from('portal_organizations').insert(p); if (error) throw error; }
    setOf(null); return 'حُفظت الجهة.';
  });
  const toggleOrg = (o: Organization) => run('to' + o.id, async () => { const { error } = await db.from('portal_organizations').update({ active: !o.active, updated_at: new Date().toISOString() }).eq('id', o.id); if (error) throw error; });
  const setOrgAdmin = (o: Organization) => run('oa' + o.id, async () => { const email = (adminEmail[o.id] || '').trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('أدخل بريدًا صالحًا لمدير الجهة'); const { data: s } = await db.auth.getSession(); const r = await fetch('/api/org', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token || ''}` }, body: JSON.stringify({ action: 'set_admin', org_id: o.id, email }) }); const j = await r.json(); if (!j.success) throw new Error(j.error || 'فشل التعيين'); setAdminEmail(x => ({ ...x, [o.id]: '' })); return `عُيّن ${email} مديرًا للجهة${j.mail_error ? ' (تعذّر البريد: ' + j.mail_error + ')' : ' وأُرسل له بريد الدخول.'}`; });
  const setReqStatus = (id: string, status: string) => run('rq' + id, async () => { const { data: s } = await db.auth.getSession(); const r = await fetch('/api/org', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token || ''}` }, body: JSON.stringify({ action: 'request_status', id, status }) }); const j = await r.json(); if (!j.success) throw new Error(j.error || 'فشل التحديث'); return 'تم تحديث حالة الطلب.'; });
  const saveSector = () => run('sec', async () => {
    if (!secForm) return; const code = secForm.code.trim().toLowerCase(); if (!/^[a-z][a-z0-9_]{2,24}$/.test(code)) throw new Error('رمز القطاع: حروف إنجليزية صغيرة وأرقام و_ (مثال: logistics)'); if (secForm.name_ar.trim().length < 3 || secForm.name_en.trim().length < 3) throw new Error('الاسم العربي والإنجليزي مطلوبان');
    const { error } = await db.from('portal_sectors').upsert({ code, name_ar: secForm.name_ar.trim(), name_en: secForm.name_en.trim(), sort: (sectors.reduce((a, s) => Math.max(a, s.sort), 0) || 0) + 10 }); if (error) throw error; setSecForm(null); return 'حُفظ القطاع.';
  });
  const toggleSector = (s: Sector) => run('tsec' + s.code, async () => { const { error } = await db.from('portal_sectors').update({ active: !s.active }).eq('code', s.code); if (error) throw error; });

  if (!ready) return <div className="en"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="en-wrap"><div className="en-card en-muted">جارٍ التحميل…</div></div></div>;
  return (
    <div className="en"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="en-wrap">
        <header className="en-head"><div><span className="en-kicker"><Icon name="globe" size={14} /> بوابة أَثَر</span><h1>المهارات والقطاعات والجهات</h1><p>تصنيف أَثَر الداخلي للمهارات مربوط بالأطر المرجعية (SAQF · SDAIA · CEFR). كل برنامج وحقيبة وجلسة تُوسم بمهارات من هنا — وهو أساس الملف المهاري وتقارير الأثر القطاعية.</p></div>
          <div className="en-acts"><Link href="/admin/resources" className="en-btn ghost"><Icon name="folder" size={14} /> الحقائب</Link></div></header>
        <PortalAdminTabs />
        {error && <div className="en-err">{error}</div>}{notice && <div className="en-ok">{notice}</div>}

        <div className="en-tabs sk-tabs">
          <button type="button" className={tab === 'skills' ? 'on' : ''} onClick={() => setTab('skills')}><Icon name="target" size={13} /> المهارات ({skills.length})</button>
          <button type="button" className={tab === 'sectors' ? 'on' : ''} onClick={() => setTab('sectors')}><Icon name="flag" size={13} /> القطاعات ({sectors.length})</button>
          <button type="button" className={tab === 'orgs' ? 'on' : ''} onClick={() => setTab('orgs')}><Icon name="users" size={13} /> الجهات العميلة ({orgs.length})</button>
        </div>

        {tab === 'skills' && <>
          <div className="en-card en-seats">{byDomain.map(d => <button type="button" key={d.value} className={`en-seat ${dom === d.value ? 'on' : ''}`} onClick={() => setDom(dom === d.value ? 'all' : d.value)}><b>{d.n}</b><span>{d.label.ar}</span></button>)}</div>
          <div className="en-tools">
            <input placeholder="بحث: الرمز، الاسم، SDAIA…" value={q} onChange={e => setQ(e.target.value)} />
            {canWrite && <button type="button" className="en-btn" onClick={newSkill}><Icon name="plus" size={14} /> مهارة جديدة</button>}
            <button type="button" className="en-btn ghost" onClick={() => downloadXlsx(safeFilename('athar_skills', 'xlsx'), [skillsSheet(shownSkills, sectors)])}><Icon name="download" size={14} /> Excel</button>
          </div>
          {sf && <div className="en-card sk-form">
            <h2><Icon name={sEdit ? 'edit' : 'plus'} size={18} /> {sEdit ? 'تحرير المهارة' : 'مهارة جديدة'}</h2>
            <div className="sk-g4">
              <label className="en-note">المجال<select value={sf.domain} onChange={e => changeDomain(e.target.value as SkillDomain)}>{DOMAINS.map(d => <option key={d.value} value={d.value}>{d.label.ar}</option>)}</select></label>
              <label className="en-note">الرمز<input dir="ltr" value={sf.code} onChange={e => setSf({ ...sf, code: e.target.value })} /></label>
              <label className="en-note">مستوى أَثَر (1–5)<select value={sf.level} onChange={e => setSf({ ...sf, level: Number(e.target.value) })}>{SKILL_LEVELS.map(l => <option key={l.value} value={l.value}>{l.value} · {l.label.ar}</option>)}</select></label>
              <label className="en-note">القطاع (اختياري)<select value={sf.sector} onChange={e => setSf({ ...sf, sector: e.target.value })}><option value="">— عام —</option>{sectors.map(s => <option key={s.code} value={s.code}>{s.name_ar}</option>)}</select></label>
            </div>
            <div className="sk-g2"><label className="en-note">الاسم (عربي) *<input value={sf.name_ar} onChange={e => setSf({ ...sf, name_ar: e.target.value })} /></label><label className="en-note">Name (English) *<input dir="ltr" value={sf.name_en} onChange={e => setSf({ ...sf, name_en: e.target.value })} /></label></div>
            <div className="sk-g2"><label className="en-note">الوصف السلوكي (ما الذي يستطيع فعله من يمتلكها؟)<textarea value={sf.description_ar} onChange={e => setSf({ ...sf, description_ar: e.target.value })} /></label><label className="en-note">Behavioural description<textarea dir="ltr" value={sf.description_en} onChange={e => setSf({ ...sf, description_en: e.target.value })} /></label></div>
            <div className="sk-fw"><b>الربط بالأطر المرجعية</b>
              <div className="sk-g4">
                <label className="en-note">SAQF — الإطار السعودي للمؤهلات<select value={sf.saqf_level} onChange={e => setSf({ ...sf, saqf_level: e.target.value })}><option value="">—</option>{SAQF_LEVELS.map(l => <option key={l} value={l}>المستوى {l}</option>)}</select></label>
                <label className="en-note">SDAIA — رمز مهارة البيانات/الذكاء الاصطناعي<input dir="ltr" value={sf.sdaia_code} onChange={e => setSf({ ...sf, sdaia_code: e.target.value })} placeholder="SDAIA-AI-2" /></label>
                <label className="en-note">CEFR — للمهارات اللغوية<select value={sf.cefr_level} onChange={e => setSf({ ...sf, cefr_level: e.target.value })}><option value="">—</option>{CEFR.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
                <label className="cs-chk" style={{ alignSelf: 'end' }}><input type="checkbox" checked={sf.active} onChange={e => setSf({ ...sf, active: e.target.checked })} /> نشطة (تظهر للوسم)</label>
              </div></div>
            <div className="en-acts"><button type="button" className="en-btn ok" disabled={busy === 'ss'} onClick={saveSkill}><Icon name="save" size={14} /> حفظ</button><button type="button" className="en-btn ghost" onClick={() => setSf(null)}>إلغاء</button></div>
          </div>}
          <div className="en-card sk-table">
            <table><thead><tr><th>الرمز</th><th>المهارة</th><th>المجال</th><th>المستوى</th><th>الأطر</th><th>الاستخدام</th><th></th></tr></thead>
              <tbody>{shownSkills.map(s => <tr key={s.id} className={s.active ? '' : 'off'}><td dir="ltr">{s.code}</td><td><b>{s.name_ar}</b><small dir="ltr">{s.name_en}</small>{s.description_ar && <small>{s.description_ar}</small>}</td><td>{domainLabel(s.domain, 'ar')}</td><td>{s.level} · {skillLevelLabel(s.level, 'ar')}</td><td><div className="sk-badges">{frameworkBadges(s).map(b => <span key={b.k} className={b.k}>{b.label}</span>)}{frameworkBadges(s).length === 0 && <span className="none">—</span>}</div></td><td>{usage[s.id] || 0} مادة</td>
                <td>{canWrite && <div className="en-acts"><button type="button" className="en-btn ghost" onClick={() => { setSEdit(s.id); setSf(skillToForm(s)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Icon name="edit" size={13} /></button><button type="button" className="en-btn ghost" disabled={!!busy} onClick={() => toggleSkill(s)}>{s.active ? 'تعطيل' : 'تفعيل'}</button>{(usage[s.id] || 0) === 0 && <button type="button" className="cs-x" disabled={!!busy} onClick={() => deleteSkill(s)}>×</button>}</div>}</td></tr>)}
              {shownSkills.length === 0 && <tr><td colSpan={7} className="en-muted">لا مهارات مطابقة.</td></tr>}</tbody></table>
          </div>
        </>}

        {tab === 'sectors' && <>
          <div className="en-tools"><span className="en-muted">القائمة الموحّدة للقطاعات تُستخدم في الحقائب والجهات (وقريبًا البرامج والاستشارات والتقارير). الرمز لا يتغير بعد الإنشاء.</span>{canWrite && <button type="button" className="en-btn" style={{ marginInlineStart: 'auto' }} onClick={() => setSecForm({ code: '', name_ar: '', name_en: '' })}><Icon name="plus" size={14} /> قطاع جديد</button>}</div>
          {secForm && <div className="en-card sk-form"><div className="sk-g4"><label className="en-note">الرمز (إنجليزي)<input dir="ltr" value={secForm.code} onChange={e => setSecForm({ ...secForm, code: e.target.value })} placeholder="logistics" /></label><label className="en-note">الاسم (عربي)<input value={secForm.name_ar} onChange={e => setSecForm({ ...secForm, name_ar: e.target.value })} /></label><label className="en-note">Name (English)<input dir="ltr" value={secForm.name_en} onChange={e => setSecForm({ ...secForm, name_en: e.target.value })} /></label><div className="en-acts" style={{ alignSelf: 'end' }}><button type="button" className="en-btn ok" disabled={busy === 'sec'} onClick={saveSector}>حفظ</button><button type="button" className="en-btn ghost" onClick={() => setSecForm(null)}>إلغاء</button></div></div></div>}
          <div className="en-card sk-table"><table><thead><tr><th>الرمز</th><th>القطاع</th><th>Sector</th><th>الحالة</th><th></th></tr></thead><tbody>{sectors.map(s => <tr key={s.code} className={s.active ? '' : 'off'}><td dir="ltr">{s.code}</td><td><b>{s.name_ar}</b></td><td dir="ltr">{s.name_en}</td><td>{s.active ? 'نشط' : 'معطّل'}</td><td>{canWrite && <button type="button" className="en-btn ghost" disabled={!!busy} onClick={() => toggleSector(s)}>{s.active ? 'تعطيل' : 'تفعيل'}</button>}</td></tr>)}</tbody></table></div>
        </>}

        {tab === 'orgs' && <>
          <div className="en-tools"><span className="en-muted">الجهات العميلة (B2B): تُربط بها الحقائب الخاصة، والتسجيلات الجماعية، والاستشارات والفواتير. «نطاق البريد» يمنح منسوبي الجهة الوصول تلقائيًا.</span>{canWrite && <button type="button" className="en-btn" style={{ marginInlineStart: 'auto' }} onClick={() => { setOEdit(null); setOf({ ...EMPTY_ORG }); }}><Icon name="plus" size={14} /> جهة جديدة</button>}<button type="button" className="en-btn ghost" onClick={() => downloadXlsx(safeFilename('athar_organizations', 'xlsx'), [orgsSheet(orgs, sectors)])}><Icon name="download" size={14} /> Excel</button></div>
          {of && <div className="en-card sk-form"><h2><Icon name={oEdit ? 'edit' : 'plus'} size={18} /> {oEdit ? 'تحرير الجهة' : 'جهة جديدة'}</h2>
            <div className="sk-g2"><label className="en-note">اسم الجهة (عربي) *<input value={of.name_ar} onChange={e => setOf({ ...of, name_ar: e.target.value })} /></label><label className="en-note">Organization name<input dir="ltr" value={of.name_en} onChange={e => setOf({ ...of, name_en: e.target.value })} /></label></div>
            <div className="sk-g4"><label className="en-note">القطاع<select value={of.sector} onChange={e => setOf({ ...of, sector: e.target.value })}><option value="">—</option>{sectors.map(s => <option key={s.code} value={s.code}>{s.name_ar}</option>)}</select></label><label className="en-note">المدينة<input value={of.city} onChange={e => setOf({ ...of, city: e.target.value })} /></label><label className="en-note">نطاق البريد (للوصول التلقائي)<input dir="ltr" value={of.email_domain} onChange={e => setOf({ ...of, email_domain: e.target.value })} placeholder="moe.gov.sa" /></label><label className="cs-chk" style={{ alignSelf: 'end' }}><input type="checkbox" checked={of.active} onChange={e => setOf({ ...of, active: e.target.checked })} /> نشطة</label></div>
            <div className="sk-g4"><label className="en-note">جهة الاتصال<input value={of.contact_name} onChange={e => setOf({ ...of, contact_name: e.target.value })} /></label><label className="en-note">البريد<input dir="ltr" type="email" value={of.contact_email} onChange={e => setOf({ ...of, contact_email: e.target.value })} /></label><label className="en-note">الجوال<input dir="ltr" value={of.contact_phone} onChange={e => setOf({ ...of, contact_phone: e.target.value })} /></label><label className="en-note">ملاحظات<input value={of.notes} onChange={e => setOf({ ...of, notes: e.target.value })} /></label></div>
            <div className="en-acts"><button type="button" className="en-btn ok" disabled={busy === 'so'} onClick={saveOrg}><Icon name="save" size={14} /> حفظ</button><button type="button" className="en-btn ghost" onClick={() => setOf(null)}>إلغاء</button></div></div>}
          <div className="en-card sk-table"><table><thead><tr><th>الجهة</th><th>القطاع</th><th>المدينة</th><th>جهة الاتصال</th><th>نطاق البريد</th><th>الحالة</th><th></th></tr></thead><tbody>
            {orgs.map(o => <tr key={o.id} className={o.active ? '' : 'off'}><td><b>{o.name_ar}</b>{o.name_en && <small dir="ltr">{o.name_en}</small>}</td><td>{sectors.find(s => s.code === o.sector)?.name_ar || '—'}</td><td>{o.city || '—'}</td><td>{o.contact_name || '—'}{o.contact_email && <small dir="ltr">{o.contact_email}</small>}</td><td dir="ltr">{o.email_domain || '—'}</td><td>{o.active ? 'نشطة' : 'معطّلة'}<div className="sk-oa">{(orgAdmins[o.id] || []).map(a => <small key={a.email} dir="ltr" title={a.status}>👤 {a.email}</small>)}{canWrite && <span className="sk-oarow"><input dir="ltr" placeholder="بريد مدير الجهة" value={adminEmail[o.id] || ''} onChange={e => setAdminEmail(x => ({ ...x, [o.id]: e.target.value }))} /><button type="button" className="en-btn ghost" disabled={!!busy} onClick={() => setOrgAdmin(o)}>تعيين</button></span>}</div></td><td>{canWrite && <div className="en-acts"><button type="button" className="en-btn ghost" onClick={() => { setOEdit(o.id); setOf(orgToForm(o)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Icon name="edit" size={13} /></button><button type="button" className="en-btn ghost" disabled={!!busy} onClick={() => toggleOrg(o)}>{o.active ? 'تعطيل' : 'تفعيل'}</button><a className="en-btn ghost" href="/org" target="_blank" rel="noreferrer">بوابة الجهات ↗</a></div>}</td></tr>)}
            {orgs.length === 0 && <tr><td colSpan={7} className="en-muted">لا جهات بعد — أضف أول جهة عميلة.</td></tr>}</tbody></table></div>
          {orgReqs.length > 0 && <div className="en-card sk-table"><h3 style={{ margin: '12px 12px 0', fontSize: 15, color: '#0f2a4e' }}>طلبات التسجيل الجماعي من الجهات ({orgReqs.length})</h3><table><thead><tr><th>التاريخ</th><th>الجهة</th><th>البرنامج</th><th>العدد</th><th>مقدّم الطلب</th><th>ملاحظة</th><th>الحالة</th></tr></thead><tbody>{orgReqs.map(r => <tr key={r.id}><td>{String(r.created_at).slice(0, 10)}</td><td>{orgs.find(o => o.id === r.organization_id)?.name_ar || '—'}</td><td>{r.program_id ? (r.program_name || r.program_id.slice(0, 8)) : '—'}</td><td>{r.count}</td><td dir="ltr">{r.requester_email || '—'}</td><td>{r.note || '—'}</td><td>{canWrite ? <select value={r.status} disabled={!!busy} onChange={e => setReqStatus(r.id, e.target.value)}>{['new', 'reviewing', 'quoted', 'approved', 'enrolled', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}</select> : r.status}</td></tr>)}</tbody></table></div>}
        </>}
      </div>
    </div>
  );
}

const CSS = `
.en{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif}
.en-wrap{max-width:1080px;margin:0 auto;display:grid;gap:12px}
.en-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}.en-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.en-head p{margin:0;color:#64748b;font-size:14px;max-width:760px}.en-kicker{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:900;color:#0b8a83}
.en-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px}.en-muted{color:#64748b;font-size:13.5px}
.en-seats{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.en-seat{text-align:start;border:1px solid #e2e8f0;background:#f8fafc;border-radius:12px;padding:8px 14px;font:inherit;cursor:pointer;display:grid;gap:2px;min-width:92px}.en-seat.on{border-color:#0b8a83;background:#f0fdfa}.en-seat b{font-size:18px;color:#0f2a4e}.en-seat span{font-size:11.5px;color:#64748b}
.en-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.en-tabs{display:flex;gap:6px;flex-wrap:wrap}.en-tabs button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;color:#334155;display:inline-flex;gap:5px;align-items:center}.en-tabs button.on{background:#0f2a4e;border-color:#0f2a4e;color:#fff}
.sk-tabs button{padding:9px 16px;font-size:13.5px}
.en-tools input{font:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;background:#fff;min-width:220px}
.en-note{display:grid;gap:4px;font-size:12.5px;font-weight:800;color:#334155}.en-note textarea,.en-note input,.en-note select{font:inherit;font-size:13.5px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;background:#fff;font-weight:500}.en-note textarea{min-height:56px;resize:vertical}
.en-acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.en-btn{display:inline-flex;gap:6px;align-items:center;border-radius:10px;padding:8px 14px;font:inherit;font-size:13px;font-weight:900;cursor:pointer;text-decoration:none;background:#0f2a4e;color:#fff;border:1px solid #0f2a4e}.en-btn.ok{background:#059669;border-color:#059669}.en-btn.ghost{background:#fff;color:#0f2a4e;border-color:#cbd5e1;padding:6px 10px}.en-btn:disabled{opacity:.6;cursor:not-allowed}
.en-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}.en-ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}
.cs-x{border:0;background:#fee2e2;color:#991b1b;border-radius:8px;width:26px;height:26px;cursor:pointer;display:inline-grid;place-items:center}.cs-chk{display:inline-flex;gap:6px;align-items:center;font-size:12.5px;color:#334155;font-weight:800}
.sk-form{display:grid;gap:12px;border:2px solid #0b8a83}.sk-form h2{margin:0;font-size:18px;color:#0f2a4e;display:flex;gap:8px;align-items:center}
.sk-g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.sk-g4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.sk-fw{display:grid;gap:8px;border:1px dashed #cbd5e1;border-radius:12px;padding:12px;background:#fcfcfd}.sk-fw>b{font-size:13.5px;color:#0f2a4e}
.sk-table{overflow:auto;padding:0}.sk-table table{width:100%;border-collapse:collapse;font-size:13px}.sk-table th{background:#f1f5f9;color:#334155;padding:10px 12px;text-align:start;font-size:12px;white-space:nowrap}.sk-table td{padding:10px 12px;border-top:1px solid #f1f5f9;vertical-align:top;color:#0f172a}.sk-table td b{display:block;font-size:13.5px}.sk-table td small{display:block;color:#64748b;font-size:11.5px;margin-top:2px}.sk-table tr.off td{opacity:.55}
.sk-oa{display:grid;gap:4px;margin-top:4px}.sk-oa small{color:#0b8a83;font-weight:800;font-size:11px}.sk-oarow{display:flex;gap:4px}.sk-oarow input{font:inherit;font-size:12px;border:1px solid #cbd5e1;border-radius:8px;padding:4px 8px;min-width:160px}
.sk-badges{display:flex;gap:4px;flex-wrap:wrap}.sk-badges span{font-size:10.5px;font-weight:900;border-radius:6px;padding:3px 7px;background:#e2e8f0;color:#334155;direction:ltr;white-space:nowrap}.sk-badges .saqf{background:#dcfce7;color:#166534}.sk-badges .sdaia{background:#ede9fe;color:#5b21b6}.sk-badges .cefr{background:#dbeafe;color:#1e40af}.sk-badges .none{background:transparent;color:#94a3b8}
@media(max-width:900px){.sk-g4{grid-template-columns:1fr 1fr}}@media(max-width:760px){.sk-g2,.sk-g4{grid-template-columns:1fr}}
`;
