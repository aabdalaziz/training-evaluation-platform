'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// بوابة أَثَر — نتائج مِعيار: مزامنة من مشروع مِعيار، توزيع المستويات، المهارات الثلاث، الربط بالتسجيلات والبرامج الموصى بها، Excel

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadXlsx } from '../../../lib/export/xlsx';
import { safeFilename } from '../../../lib/export/csv';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { CEFR_LEVELS, MIAAR_SKILLS, levelLabel, levelTone, effectiveLevel, levelDistribution, latestByEmail, placementsSheet, recommendPrograms, miaarSkillLabel } from '../../../lib/portal/placement';
import type { Placement, Cefr } from '../../../lib/portal/placement';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
type Prog = { id: string; name_ar: string; cefr_level?: string | null; program_type?: string | null; status?: string | null };
type Enr = { id: string; email: string; program_id: string; status: string; placement_level?: string | null; classroom_id?: string | null };

export default function Page() { return <Suspense fallback={null}><PlacementsAdmin /></Suspense>; }

function PlacementsAdmin() {
  const db = useMemo(() => supabase(), []); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState('');
  const [rows, setRows] = useState<Placement[]>([]); const [progs, setProgs] = useState<Prog[]>([]); const [enrs, setEnrs] = useState<Enr[]>([]); const [configured, setConfigured] = useState<boolean | null>(null);
  const [level, setLevel] = useState<'all' | Cefr>('all'); const [q, setQ] = useState(''); const [open, setOpen] = useState<string | null>(null); const [latestOnly, setLatestOnly] = useState(true);

  async function load() {
    const [{ data: p, error: e1 }, { data: pg }, { data: en }, cfg] = await Promise.all([
      db.from('portal_placements').select('*').order('taken_at', { ascending: false }).limit(2000),
      db.from('programs').select('id,name_ar,cefr_level,program_type,status').is('archived_at', null).order('start_date', { ascending: false }).limit(300),
      db.from('portal_enrollments').select('id,email,program_id,status,placement_level,classroom_id').in('status', ['pending', 'approved', 'waitlisted']).limit(3000),
      fetch('/api/placements').then(x => x.json()).catch(() => null),
    ]);
    if (e1) { setError(e1.message); return; }
    setRows((p || []) as Placement[]); setProgs((pg || []) as Prog[]); setEnrs((en || []) as Enr[]); setConfigured(cfg ? !!cfg.configured : null);
  }
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/placements'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
    await load(); setReady(true);
  })(); }, [db, router]);

  const sync = async () => { setBusy('sync'); setError(''); setNotice(''); try { const { data: s } = await db.auth.getSession(); const j = await fetch('/api/placements', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token || ''}` }, body: JSON.stringify({ action: 'sync' }) }).then(x => x.json()); if (!j.success) throw new Error(j.error || 'فشلت المزامنة'); setNotice(`تمت المزامنة: ${j.fetched} تقريرًا من مِعيار · ${j.imported} جديد · ${j.skipped} موجود مسبقًا${j.errors ? ' · أخطاء: ' + j.errors.join(' | ') : ''}`); await load(); } catch (e: any) { setError(e.message || String(e)); } setBusy(''); };

  const base = useMemo(() => latestOnly ? Array.from(latestByEmail(rows).values()) : rows, [rows, latestOnly]);
  const shown = useMemo(() => base.filter(p => (level === 'all' || effectiveLevel(p) === level) && (!q.trim() || `${p.full_name || ''} ${p.email} ${p.phone || ''}`.toLowerCase().includes(q.trim().toLowerCase()))), [base, level, q]);
  const dist = useMemo(() => levelDistribution(base.map(p => ({ entry_level: effectiveLevel(p) }))), [base]);
  const enrByEmail = useMemo(() => { const m = new Map<string, Enr[]>(); for (const e of enrs) { const k = e.email.toLowerCase(); if (!m.has(k)) m.set(k, []); m.get(k)!.push(e); } return m; }, [enrs]);
  const pgMap = useMemo(() => new Map(progs.map(p => [p.id, p])), [progs]);
  const avg = (k: 'grammar_vocab' | 'reading' | 'listening') => { const xs = base.map(p => p.skills[k]?.percent).filter(x => typeof x === 'number') as number[]; return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null; };

  if (!ready) return <div className="en"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="en-wrap"><div className="en-card en-muted">جارٍ التحميل…</div></div></div>;
  return (
    <div className="en"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="en-wrap">
        <header className="en-head"><div><span className="en-kicker"><Icon name="globe" size={14} /> بوابة أَثَر</span><h1>نتائج مِعيار — اختبار تحديد المستوى</h1><p>كل نتيجة تُستورد من مِعيار وتُسجَّل كدليل مهارة (استماع · قراءة · قواعد ومفردات) في ملف المتعلم، وتوجّه الإسكان في الشعب والتوصية بالبرامج.</p></div>
          <div className="en-acts"><button type="button" className="en-btn" onClick={sync} disabled={busy === 'sync' || configured === false}><Icon name="refresh" size={14} /> {busy === 'sync' ? 'جارٍ المزامنة…' : 'مزامنة من مِعيار'}</button><a className="en-btn ghost" href="https://miaar-placement-test.vercel.app" target="_blank" rel="noreferrer"><Icon name="arrow" size={14} /> فتح مِعيار</a></div></header>
        <PortalAdminTabs />
        {configured === false && <div className="en-err">الربط مع مِعيار غير مفعّل: أضف في Vercel المتغيّرين <code>MIAAR_SUPABASE_URL</code> و<code>MIAAR_SERVICE_ROLE_KEY</code> (من مشروع مِعيار في Supabase) ثم Redeploy. تُزامَن النتائج تلقائيًا كل صباح، ويمكنك المزامنة يدويًا من الزر أعلاه.</div>}
        {error && <div className="en-err">{error}</div>}{notice && <div className="en-ok">{notice}</div>}

        <div className="en-card pl-dist">
          <div className="pl-kpis"><span><b>{base.length}</b><small>{latestOnly ? 'متقدّم (أحدث نتيجة)' : 'نتيجة'}</small></span>{(['listening', 'reading', 'grammar_vocab'] as const).map(k => <span key={k}><b>{avg(k) ?? '—'}%</b><small>متوسط {miaarSkillLabel(k, 'ar')}</small></span>)}</div>
          <div className="pl-bars">{dist.map(d => <button type="button" key={d.level} className={`pl-bar ${level === d.level ? 'on' : ''} ${levelTone(d.level)}`} onClick={() => setLevel(level === d.level ? 'all' : d.level)}><i style={{ height: `${Math.max(4, d.pct)}%` }} /><b>{d.level}</b><small>{d.n}</small></button>)}</div>
        </div>

        <div className="en-tools">
          <div className="en-tabs"><button type="button" className={latestOnly ? 'on' : ''} onClick={() => setLatestOnly(true)}>أحدث نتيجة لكل متقدّم</button><button type="button" className={!latestOnly ? 'on' : ''} onClick={() => setLatestOnly(false)}>كل المحاولات ({rows.length})</button></div>
          <select value={level} onChange={e => setLevel(e.target.value as any)}><option value="all">كل المستويات</option>{CEFR_LEVELS.map(l => <option key={l} value={l}>{levelLabel(l, 'ar')}</option>)}</select>
          <input placeholder="بحث: الاسم، البريد، الهاتف…" value={q} onChange={e => setQ(e.target.value)} />
          <button type="button" className="en-btn ghost" onClick={() => downloadXlsx(safeFilename('athar_miaar_results', 'xlsx'), [placementsSheet(shown)])} disabled={!shown.length}><Icon name="download" size={14} /> Excel ({shown.length})</button>
        </div>

        {shown.length === 0 && <div className="en-card en-muted">{rows.length === 0 ? 'لا نتائج مستوردة بعد — اضغط «مزامنة من مِعيار».' : 'لا نتائج ضمن هذه التصفية.'}</div>}
        {shown.map(p => { const lvl = effectiveLevel(p); const isOpen = open === p.id; const myEnr = enrByEmail.get(p.email) || []; const rec = recommendPrograms(progs.filter(x => x.cefr_level), lvl).slice(0, 3); return (
          <div key={p.id} className="en-card en-row">
            <div className="en-top" onClick={() => setOpen(isOpen ? null : p.id)}>
              <div className="en-who"><span className={`pl-level ${levelTone(lvl)}`}>{lvl || '—'}</span><b>{p.full_name || p.email}</b><span className="en-muted" dir="ltr">{p.email}</span>{myEnr.length > 0 && <span className="en-tag ok">{myEnr.length} تسجيل</span>}</div>
              <div className="en-meta"><span>المثبت: <b>{p.demonstrated_level || '—'}</b></span>·<span>{p.overall_percent ?? '—'}% ({p.score_text || '—'})</span>·{MIAAR_SKILLS.map(s => <span key={s.key}>{miaarSkillLabel(s.key, 'ar')}: <b>{p.skills[s.key]?.level || '—'}</b></span>)}·<span>{fmt(p.taken_at)}</span></div>
            </div>
            {isOpen && <div className="en-body">
              <div className="pl-grid">
                <div className="cs-sec"><h3><Icon name="chart" size={15} /> المهارات</h3>{MIAAR_SKILLS.map(s => { const st = p.skills[s.key]; return <div key={s.key} className="pl-skill"><span>{miaarSkillLabel(s.key, 'ar')}</span><div className="pl-track"><i style={{ width: `${st?.percent || 0}%` }} /></div><b>{st ? `${st.level} · ${st.percent}% (${st.correct}/${st.answered})` : '—'}</b></div>; })}
                  <div className="pl-levels">{p.levels.map(l => <span key={l.level} className={`pl-lv ${l.status}`} title={`${l.percent}% · ${l.answered}/${l.total}`}>{l.level} {l.percent}%</span>)}</div></div>
                <div className="cs-sec"><h3><Icon name="users" size={15} /> المتقدّم</h3><div className="en-details"><span>الهاتف: <bdi>{p.phone || '—'}</bdi></span><span>اللغة الأم: {p.native_language || '—'}</span><span>الغرض: {p.purpose || '—'}</span><span>الوقت: {p.duration_text || '—'}</span><span>سبب الانتهاء: {p.finish_reason || '—'}</span><span>إصدار البنك: {p.test_version || '—'}</span><span>{p.user_id ? 'مرتبط بحساب أَثَر ✓' : 'لا حساب أَثَر بعد'}</span></div>
                  {p.recommendation && <p className="pl-rec">{p.recommendation}</p>}</div>
              </div>
              <div className="pl-grid">
                <div className="cs-sec"><h3><Icon name="programs" size={15} /> تسجيلاته في أَثَر ({myEnr.length})</h3>{myEnr.length === 0 && <span className="en-muted">لم يسجّل في أي برنامج بعد.</span>}{myEnr.map(e => <div key={e.id} className="en-details"><span>{pgMap.get(e.program_id)?.name_ar || e.program_id}</span><span className={`en-tag ${e.status}`}>{e.status}</span>{e.placement_level && <span>مستوى التسجيل: {e.placement_level}</span>}{e.classroom_id && <span>مُسكَن ✓</span>}<Link href={`/admin/enrollments`}>طلبات التسجيل ↗</Link></div>)}</div>
                <div className="cs-sec"><h3><Icon name="compass" size={15} /> برامج موصى بها لمستواه</h3>{rec.length === 0 && <span className="en-muted">لا برامج موسومة بمستوى {lvl || '—'} — حدّد «مستوى CEFR المستهدف» في نشر البرامج.</span>}{rec.map(x => <div key={x.id} className="en-details"><span>{x.name_ar}</span><span className="en-tag">{x.cefr_level}</span><Link href={`/programs/${x.id}`} target="_blank">الصفحة ↗</Link></div>)}</div>
              </div>
            </div>}
          </div>); })}
      </div>
    </div>
  );
}

const CSS = `
.en{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif}
.en-wrap{max-width:1080px;margin:0 auto;display:grid;gap:12px}
.en-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}.en-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.en-head p{margin:0;color:#64748b;font-size:14px;max-width:760px}.en-kicker{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:900;color:#0b8a83}
.en-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px}.en-muted{color:#64748b;font-size:13.5px}
.en-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.en-tabs{display:flex;gap:6px;flex-wrap:wrap}.en-tabs button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;color:#334155}.en-tabs button.on{background:#0f2a4e;border-color:#0f2a4e;color:#fff}
.en-tools select,.en-tools input{font:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;background:#fff}.en-tools input{min-width:220px}
.en-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;cursor:pointer}.en-who{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:#64748b}.en-who b{color:#0f2a4e;font-size:15px}
.en-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px;color:#64748b}.en-meta b{color:#0f2a4e}
.en-tag{border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:900;background:#f1f5f9;color:#475569}.en-tag.ok,.en-tag.approved{background:#ecfdf5;color:#065f46}.en-tag.pending{background:#eff6ff;color:#1e40af}
.en-body{margin-top:12px;border-top:1px dashed #e2e8f0;padding-top:12px;display:grid;gap:12px}.en-details{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#64748b;align-items:center}.en-details a{color:#0b8a83;font-weight:800}
.en-acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.en-btn{display:inline-flex;gap:6px;align-items:center;border-radius:10px;padding:8px 14px;font:inherit;font-size:13px;font-weight:900;cursor:pointer;text-decoration:none;background:#0f2a4e;color:#fff;border:1px solid #0f2a4e}.en-btn.ghost{background:#fff;color:#0f2a4e;border-color:#cbd5e1}.en-btn:disabled{opacity:.6;cursor:not-allowed}
.en-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}.en-err code{background:#fff;border-radius:6px;padding:1px 6px;direction:ltr}.en-ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}
.cs-sec{border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;display:grid;gap:8px;background:#fcfcfd;align-content:start}.cs-sec h3{margin:0;font-size:15px;color:#0f2a4e;display:flex;gap:6px;align-items:center}
.pl-dist{display:grid;grid-template-columns:1fr 1.2fr;gap:16px;align-items:center}.pl-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.pl-kpis span{display:grid;border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;background:#f8fafc}.pl-kpis b{font-size:20px;color:#0f2a4e}.pl-kpis small{color:#64748b;font-size:11.5px}
.pl-bars{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;height:120px;align-items:end}.pl-bar{display:grid;grid-template-rows:1fr auto auto;height:100%;border:1px solid #e2e8f0;border-radius:10px;background:#fff;cursor:pointer;font:inherit;padding:6px 4px;align-items:end;justify-items:center}.pl-bar i{display:block;width:70%;border-radius:6px 6px 0 0;background:#0b8a83;align-self:end}.pl-bar.b i{background:#0f2a4e}.pl-bar.c i{background:#c9a24b}.pl-bar b{font-size:12.5px;color:#0f172a;direction:ltr}.pl-bar small{font-size:11px;color:#64748b}.pl-bar.on{border-color:#0f2a4e;background:#eef4fb}
.pl-level{width:38px;height:38px;border-radius:10px;display:inline-grid;place-items:center;font-size:14px;font-weight:900;color:#fff;background:#64748b;direction:ltr}.pl-level.a{background:#0b8a83}.pl-level.b{background:#0f2a4e}.pl-level.c{background:#c9a24b;color:#1f2937}
.pl-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pl-skill{display:grid;grid-template-columns:130px 1fr auto;gap:10px;align-items:center;font-size:13px}.pl-track{height:8px;border-radius:999px;background:#e2e8f0;overflow:hidden}.pl-track i{display:block;height:100%;background:#0b8a83}.pl-skill b{font-size:12.5px;color:#0f2a4e;direction:ltr}
.pl-levels{display:flex;gap:6px;flex-wrap:wrap}.pl-lv{font-size:11px;font-weight:900;border-radius:6px;padding:3px 8px;background:#f1f5f9;color:#475569;direction:ltr}.pl-lv.passed{background:#ecfdf5;color:#065f46}.pl-lv.failed{background:#fef2f2;color:#991b1b}
.pl-rec{margin:0;font-size:13px;line-height:1.8;color:#334155;background:#fdf6e3;border:1px solid #f3e3b3;border-radius:10px;padding:8px 12px}
@media(max-width:900px){.pl-dist,.pl-grid{grid-template-columns:1fr}.pl-skill{grid-template-columns:1fr}}
`;
