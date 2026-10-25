'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// بوابة أَثَر — الشهادات الرقمية والاعتماد: إصدار جماعي لمكملي البرنامج (حضور ≥80%)، إصدار مخصص، إلغاء، اعتماد مستويات المهارات، Excel

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadXlsx } from '../../../lib/export/xlsx';
import { safeFilename } from '../../../lib/export/csv';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { CREDENTIAL_KINDS, EMPTY_ISSUE, validateIssue, credentialKindLabel, credentialStatus, credentialsSheet, displayLevel, levelName, confidenceLabel, EVIDENCE_LABEL } from '../../../lib/portal/profile';
import type { Credential, IssueForm, SkillLevelRow } from '../../../lib/portal/profile';
import { skillName, domainLabel } from '../../../lib/portal/skills';
import type { Skill } from '../../../lib/portal/skills';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium' }) : '—');
type Prog = { id: string; name_ar: string; hours?: number | null; cefr_level?: string | null };
type Elig = { id: string; email: string; full_name: string; user_id?: string | null; attendance: { sessions: number; present: number }; eligible: boolean; issued: boolean };
type Tab = 'issue' | 'list' | 'approve';

export default function Page() { return <Suspense fallback={null}><CredentialsAdmin /></Suspense>; }

function CredentialsAdmin() {
  const db = useMemo(() => supabase(), []); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(''); const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [tab, setTab] = useState<Tab>('issue'); const [progs, setProgs] = useState<Prog[]>([]); const [skills, setSkills] = useState<Skill[]>([]); const [creds, setCreds] = useState<Credential[]>([]);
  const [form, setForm] = useState<IssueForm>({ ...EMPTY_ISSUE }); const [elig, setElig] = useState<Elig[]>([]); const [picked, setPicked] = useState<Set<string>>(new Set()); const [manual, setManual] = useState(''); const [notify, setNotify] = useState(true);
  const [q, setQ] = useState(''); const [apEmail, setApEmail] = useState(''); const [apRows, setApRows] = useState<(SkillLevelRow & { skill?: Skill })[]>([]); const [apBusy, setApBusy] = useState('');
  const canWrite = !!me && WRITERS.includes(me.role);

  async function api(body: any) { const { data: s } = await db.auth.getSession(); const r = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token || ''}` }, body: JSON.stringify(body) }); const txt = await r.text(); let j: any; try { j = JSON.parse(txt); } catch { throw new Error(`رد غير صالح (${r.status})`); } if (!j.success) throw new Error(j.error || 'فشل الطلب'); return j; }
  async function load() {
    const [{ data: p }, { data: sk }, { data: c, error: e1 }] = await Promise.all([db.from('programs').select('id,name_ar,hours,cefr_level').is('archived_at', null).order('start_date', { ascending: false }).limit(300), db.from('portal_skills').select('*').eq('active', true).order('code'), db.from('portal_credentials').select('*').order('issued_at', { ascending: false }).limit(1000)]);
    if (e1) { setError(e1.message); return; } setProgs((p || []) as Prog[]); setSkills((sk || []) as Skill[]); setCreds((c || []) as Credential[]);
  }
  useEffect(() => { (async () => { const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/credentials'); return; } const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); const role = String((prof as any)?.role || '').toUpperCase(); if (!STAFF.includes(role)) { router.replace('/dashboard'); return; } setMe({ id: user.id, role }); await load(); setReady(true); })(); }, [db, router]);
  const run = async (key: string, fn: () => Promise<string | void>) => { setBusy(key); setError(''); setNotice(''); try { const m = await fn(); if (m) setNotice(m); await load(); } catch (e: any) { setError(e.message || String(e)); } setBusy(''); };

  const pickProgram = async (pid: string) => { const p = progs.find(x => x.id === pid); setForm(f => ({ ...f, program_id: pid, title_ar: p ? `إتمام ${p.name_ar}` : f.title_ar, hours: p?.hours ? String(p.hours) : f.hours, level: p?.cefr_level || f.level })); setElig([]); setPicked(new Set()); if (!pid) return; try { const j = await api({ action: 'eligible', program_id: pid }); const rows = j.rows as Elig[]; setElig(rows); setPicked(new Set(rows.filter(r => r.eligible && !r.issued).map(r => r.email))); } catch (e: any) { setError(e.message); } };
  const recipients = useMemo(() => { const fromElig = elig.filter(e => picked.has(e.email)).map(e => ({ email: e.email, full_name: e.full_name })); const extra = manual.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).map(s => { const m = s.match(/^(.*?)\s*<([^>]+)>$/); return m ? { email: m[2].toLowerCase(), full_name: m[1].trim() } : { email: s.toLowerCase(), full_name: '' }; }); return [...fromElig, ...extra]; }, [elig, picked, manual]);
  const issue = () => run('issue', async () => { const v = validateIssue(form, recipients.length); if (v) throw new Error(v); if (!window.confirm(`إصدار ${recipients.length} شهادة «${form.title_ar}»؟`)) return; const j = await api({ action: 'issue', form, recipients, notify }); setPicked(new Set()); setManual(''); if (form.program_id) await pickProgram(form.program_id); return `صدرت ${j.issued} شهادة${j.errors ? ' — أخطاء: ' + j.errors.join(' | ') : ''}.`; });
  const revoke = (c: Credential) => run('rv' + c.id, async () => { const reason = window.prompt('سبب الإلغاء (اختياري):') ?? null; if (reason === null) return; await api({ action: 'revoke', id: c.id, reason }); return 'أُلغيت الشهادة.'; });
  const loadApprove = async () => { setApRows([]); setError(''); const email = apEmail.trim().toLowerCase(); if (!email) return; setApBusy('load'); try { const j = await api({ action: 'recompute', email }); const { data } = await db.from('portal_skill_levels').select('*').eq('user_id', j.user_id); const map = new Map(skills.map(s => [s.id, s])); setApRows(((data || []) as SkillLevelRow[]).map(r => ({ ...r, skill: map.get(r.skill_id) })).sort((a, b) => displayLevel(b) - displayLevel(a))); if (!(data || []).length) setNotice('لا أدلة مهارية لهذا المتعلم بعد.'); } catch (e: any) { setError(e.message); } setApBusy(''); };
  const approve = async (r: SkillLevelRow, level: number | null) => { setApBusy(r.skill_id); try { const note = level ? (window.prompt('ملاحظة الاعتماد (اختياري):') ?? '') : ''; await api({ action: 'approve', email: apEmail.trim().toLowerCase(), skill_id: r.skill_id, level, note }); setApRows(rows => rows.map(x => x.skill_id === r.skill_id ? { ...x, approved_level: level, approved_note: note || null } : x)); setNotice(level ? `اعتُمد المستوى ${level}.` : 'أُلغي الاعتماد.'); } catch (e: any) { setError(e.message); } setApBusy(''); };
  const shown = useMemo(() => creds.filter(c => !q.trim() || `${c.full_name || ''} ${c.email} ${c.title_ar} ${c.verify_code}`.toLowerCase().includes(q.trim().toLowerCase())), [creds, q]);
  const pgMap = useMemo(() => new Map(progs.map(p => [p.id, p.name_ar])), [progs]);

  if (!ready) return <div className="en"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="en-wrap"><div className="en-card en-muted">جارٍ التحميل…</div></div></div>;
  return (
    <div className="en"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="en-wrap">
        <header className="en-head"><div><span className="en-kicker"><Icon name="globe" size={14} /> بوابة أَثَر</span><h1>الشهادات الرقمية واعتماد المهارات</h1><p>شهادات قابلة للتحقق بصيغة Open Badges 3.0 تُصدر لمكملي البرامج (حضور ≥80%) أو كإثبات مهارة، وتظهر فورًا في الملف المهاري للمتعلم وصفحته العامة.</p></div></header>
        <PortalAdminTabs />
        {error && <div className="en-err">{error}</div>}{notice && <div className="en-ok">{notice}</div>}
        <div className="en-tabs cr-tabs"><button type="button" className={tab === 'issue' ? 'on' : ''} onClick={() => setTab('issue')}><Icon name="award" size={13} /> إصدار</button><button type="button" className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}><Icon name="table" size={13} /> الشهادات الصادرة ({creds.length})</button><button type="button" className={tab === 'approve' ? 'on' : ''} onClick={() => setTab('approve')}><Icon name="check" size={13} /> اعتماد المهارات</button></div>

        {tab === 'issue' && <div className="en-card cr-form">
          <div className="cr-g4">
            <label className="en-note">نوع الشهادة<select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as any })}>{CREDENTIAL_KINDS.map(k => <option key={k.value} value={k.value}>{k.label.ar}</option>)}</select></label>
            <label className="en-note">البرنامج {form.kind === 'program_completion' && '*'}<select value={form.program_id} onChange={e => pickProgram(e.target.value)}><option value="">— اختر —</option>{progs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
            <label className="en-note">المستوى (CEFR أو نص)<input dir="ltr" value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} placeholder="B1" /></label>
            <label className="en-note">الساعات<input dir="ltr" type="number" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} /></label>
          </div>
          <div className="cr-g2"><label className="en-note">عنوان الشهادة (عربي) *<input value={form.title_ar} onChange={e => setForm({ ...form, title_ar: e.target.value })} /></label><label className="en-note">Title (English)<input dir="ltr" value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value })} /></label></div>
          <div className="cr-g2"><label className="en-note">وصف/معايير الإصدار<textarea value={form.description_ar} onChange={e => setForm({ ...form, description_ar: e.target.value })} placeholder="أتم البرنامج بنسبة حضور لا تقل عن 80% واجتاز التقييم الختامي." /></label><label className="en-note">صلاحية (سنوات — فارغ = دائمة)<input dir="ltr" type="number" value={form.valid_years} onChange={e => setForm({ ...form, valid_years: e.target.value })} /></label></div>
          <div className="cr-skills"><b>المهارات الموثّقة ({form.skills.length}) {form.kind === 'skill' && '*'}</b><div className="cr-skgrid">{skills.map(s => <button type="button" key={s.id} className={form.skills.includes(s.id) ? 'on' : ''} onClick={() => setForm({ ...form, skills: form.skills.includes(s.id) ? form.skills.filter(x => x !== s.id) : [...form.skills, s.id] })}><small>{s.code}</small>{skillName(s, 'ar')}</button>)}</div></div>
          {form.program_id && <div className="cs-sec"><h3><Icon name="users" size={15} /> المقبولون في البرنامج ({elig.length}) — المؤهلون محددون تلقائيًا (حضور ≥80%)</h3>
            {elig.length === 0 && <span className="en-muted">لا مقبولين بعد.</span>}
            <div className="cr-elig">{elig.map(e => <label key={e.id} className={`cr-el ${e.issued ? 'issued' : e.eligible ? 'ok' : 'no'}`}><input type="checkbox" checked={picked.has(e.email)} disabled={e.issued} onChange={ev => setPicked(p => { const n = new Set(p); if (ev.target.checked) n.add(e.email); else n.delete(e.email); return n; })} /><span><b>{e.full_name}</b><small dir="ltr">{e.email}</small></span><small>{e.attendance.sessions ? `حضور ${e.attendance.present}/${e.attendance.sessions}` : 'بلا جلسات حضور'}{e.issued ? ' · صدرت ✓' : e.eligible ? '' : ' · غير مؤهل'}</small></label>)}</div></div>}
          <label className="en-note">مستلمون إضافيون (بريد في كل سطر، أو «الاسم &lt;email&gt;»)<textarea dir="ltr" value={manual} onChange={e => setManual(e.target.value)} placeholder={'sara@example.com\nأحمد <ahmed@example.com>'} /></label>
          <div className="en-acts"><label className="cs-chk"><input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} /> إرسال بريد للمستلمين</label><span className="en-muted">المستلمون: <b>{recipients.length}</b></span>{canWrite && <button type="button" className="en-btn ok" style={{ marginInlineStart: 'auto' }} disabled={busy === 'issue' || !recipients.length} onClick={issue}><Icon name="award" size={14} /> إصدار {recipients.length || ''} شهادة</button>}</div>
        </div>}

        {tab === 'list' && <>
          <div className="en-tools"><input placeholder="بحث: الاسم، البريد، العنوان، الرمز…" value={q} onChange={e => setQ(e.target.value)} /><button type="button" className="en-btn ghost" onClick={() => downloadXlsx(safeFilename('athar_credentials', 'xlsx'), [credentialsSheet(shown, pgMap)])} disabled={!shown.length}><Icon name="download" size={14} /> Excel ({shown.length})</button></div>
          {shown.length === 0 && <div className="en-card en-muted">لا شهادات بعد.</div>}
          {shown.map(c => { const st = credentialStatus(c); return <div key={c.id} className={`en-card en-row ${st}`}><div className="en-top"><div className="en-who"><span className={`cr-st ${st}`}>{st === 'valid' ? 'سارية' : st === 'revoked' ? 'ملغاة' : 'منتهية'}</span><b>{c.full_name || c.email}</b><span className="en-muted" dir="ltr">{c.email}</span></div><div className="en-meta"><span>{c.title_ar}</span>·<span>{credentialKindLabel(c.kind, 'ar')}</span>{c.level && <>·<span dir="ltr">{c.level}</span></>}·<span dir="ltr">{c.verify_code}</span>·<span>{fmt(c.issued_at)}</span>·<Link href={`/credential/${c.verify_code}`} target="_blank">التحقق ↗</Link>{canWrite && st === 'valid' && <button type="button" className="cr-x" disabled={!!busy} onClick={() => revoke(c)}>إلغاء</button>}</div></div></div>; })}
        </>}

        {tab === 'approve' && <div className="en-card cr-form">
          <div className="en-tools"><input dir="ltr" placeholder="بريد المتعلم…" value={apEmail} onChange={e => setApEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadApprove()} /><button type="button" className="en-btn" disabled={apBusy === 'load'} onClick={loadApprove}><Icon name="search" size={14} /> عرض المهارات</button><span className="en-muted">يُعاد حساب المستويات من الأدلة عند العرض. الاعتماد اليدوي يظهر للمتعلم بشارة «معتمد» ويتقدم على المحسوب.</span></div>
          {apRows.map(r => <div key={r.skill_id} className="cr-ap"><div><b>{r.skill ? skillName(r.skill, 'ar') : r.skill_id}</b><small>{r.skill?.code} · {r.skill ? domainLabel(r.skill.domain, 'ar') : ''} · محسوب {r.computed_level.toFixed(1)} ({confidenceLabel(r.confidence, 'ar')}) · {r.evidence.length} دليل{r.evidence.slice(0, 3).map((e, i) => <em key={i}> · {EVIDENCE_LABEL[e.kind].ar}{e.label ? ` ${e.label}` : ''}</em>)}</small></div><div className="cr-apacts"><span className="en-muted">المعتمد:</span>{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} className={r.approved_level === n ? 'on' : ''} disabled={!canWrite || apBusy === r.skill_id} onClick={() => approve(r, n)}>{n}</button>)}{r.approved_level && <button type="button" className="cr-x" disabled={!canWrite || apBusy === r.skill_id} onClick={() => approve(r, null)}>إلغاء</button>}<b>{levelName(displayLevel(r), 'ar')}</b></div></div>)}
        </div>}
      </div>
    </div>
  );
}

const CSS = `
.en{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif}
.en-wrap{max-width:1080px;margin:0 auto;display:grid;gap:12px}
.en-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.en-head p{margin:0;color:#64748b;font-size:14px;max-width:760px}.en-kicker{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:900;color:#0b8a83}
.en-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px}.en-muted{color:#64748b;font-size:13.5px}
.en-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.en-tabs{display:flex;gap:6px;flex-wrap:wrap}.en-tabs button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;color:#334155;display:inline-flex;gap:5px;align-items:center}.en-tabs button.on{background:#0f2a4e;border-color:#0f2a4e;color:#fff}.cr-tabs button{padding:9px 16px;font-size:13.5px}
.en-tools input{font:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;background:#fff;min-width:240px}
.en-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.en-who{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:#64748b}.en-who b{color:#0f2a4e;font-size:15px}.en-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px;color:#64748b}.en-meta a{color:#0b8a83;font-weight:800}
.en-row.revoked,.en-row.expired{opacity:.7}.cr-st{border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:900;background:#ecfdf5;color:#065f46}.cr-st.revoked{background:#fef2f2;color:#991b1b}.cr-st.expired{background:#fff7ed;color:#9a3412}
.en-note{display:grid;gap:4px;font-size:12.5px;font-weight:800;color:#334155}.en-note textarea,.en-note input,.en-note select{font:inherit;font-size:13.5px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;background:#fff;font-weight:500}.en-note textarea{min-height:56px;resize:vertical}
.en-acts{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.en-btn{display:inline-flex;gap:6px;align-items:center;border-radius:10px;padding:8px 14px;font:inherit;font-size:13px;font-weight:900;cursor:pointer;text-decoration:none;background:#0f2a4e;color:#fff;border:1px solid #0f2a4e}.en-btn.ok{background:#059669;border-color:#059669}.en-btn.ghost{background:#fff;color:#0f2a4e;border-color:#cbd5e1}.en-btn:disabled{opacity:.6;cursor:not-allowed}
.en-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}.en-ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}
.cs-sec{border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;display:grid;gap:8px;background:#fcfcfd}.cs-sec h3{margin:0;font-size:14.5px;color:#0f2a4e;display:flex;gap:6px;align-items:center}.cs-chk{display:inline-flex;gap:6px;align-items:center;font-size:12.5px;color:#334155;font-weight:800}
.cr-form{display:grid;gap:12px}.cr-g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cr-g4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.cr-skills{display:grid;gap:6px}.cr-skills>b{font-size:13.5px;color:#0f2a4e}.cr-skgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;max-height:160px;overflow:auto}.cr-skgrid button{text-align:start;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:6px 10px;font:inherit;font-size:12.5px;cursor:pointer;display:grid}.cr-skgrid button small{color:#0b8a83;font-weight:900;font-size:10.5px;direction:ltr;text-align:start}.cr-skgrid button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.cr-skgrid button.on small{color:#c9a24b}
.cr-elig{display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:300px;overflow:auto}.cr-el{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;border:1px solid #e2e8f0;border-radius:10px;padding:6px 10px;font-size:12.5px;background:#fff}.cr-el.ok{border-color:#a7f3d0}.cr-el.no{opacity:.7}.cr-el.issued{background:#f1f5f9}.cr-el b{display:block;font-size:13px;color:#0f172a}.cr-el small{color:#64748b;font-size:11.5px}
.cr-x{border:0;background:#fee2e2;color:#991b1b;border-radius:8px;padding:3px 10px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
.cr-ap{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px;background:#fff}.cr-ap b{display:block;font-size:14px;color:#0f172a}.cr-ap small{color:#64748b;font-size:12px}.cr-ap em{font-style:normal;color:#0b8a83}
.cr-apacts{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.cr-apacts button:not(.cr-x){width:34px;height:34px;border-radius:9px;border:1px solid #cbd5e1;background:#fff;font:inherit;font-weight:900;cursor:pointer}.cr-apacts button.on{background:#059669;border-color:#059669;color:#fff}.cr-apacts>b{font-size:12.5px;color:#0f2a4e;margin-inline-start:6px}
@media(max-width:900px){.cr-g4,.cr-skgrid,.cr-elig{grid-template-columns:1fr 1fr}}@media(max-width:700px){.cr-g2,.cr-g4,.cr-skgrid,.cr-elig{grid-template-columns:1fr}}
`;
