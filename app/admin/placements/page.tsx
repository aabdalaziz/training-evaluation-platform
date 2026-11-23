'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// بوابة أَثَر — نتائج مِعيار (من أَثَر، مستقلّ): تُكتب مباشرة من المحرّك لحظة اكتمال الاختبار، توزيع المستويات، المهارات الثلاث، الربط بالتسجيلات والبرامج الموصى بها، Excel

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

import { RoomHead } from '../../components/RoomKit'; /* هـ-3 ح «عدّة الغرفة» */
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
type Prog = { id: string; name_ar: string; cefr_level?: string | null; program_type?: string | null; status?: string | null };
type Enr = { id: string; email: string; program_id: string; status: string; placement_level?: string | null; classroom_id?: string | null };

export default function Page() { return <Suspense fallback={null}><PlacementsAdmin /></Suspense>; }

function PlacementsAdmin() {
  const db = useMemo(() => supabase(), []); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState('');
  const [rows, setRows] = useState<Placement[]>([]); const [progs, setProgs] = useState<Prog[]>([]); const [enrs, setEnrs] = useState<Enr[]>([]);
  const [level, setLevel] = useState<'all' | Cefr>('all'); const [q, setQ] = useState(''); const [open, setOpen] = useState<string | null>(null); const [latestOnly, setLatestOnly] = useState(true);

  async function load() {
    const [{ data: p, error: e1 }, { data: pg }, { data: en }] = await Promise.all([
      db.from('portal_placements').select('*').order('taken_at', { ascending: false }).limit(2000),
      db.from('programs').select('id,name_ar,cefr_level,program_type,status').is('archived_at', null).order('start_date', { ascending: false }).limit(300),
      db.from('portal_enrollments').select('id,email,program_id,status,placement_level,classroom_id').in('status', ['pending', 'approved', 'waitlisted']).limit(3000),
    ]);
    if (e1) { setError(e1.message); return; }
    setRows((p || []) as Placement[]); setProgs((pg || []) as Prog[]); setEnrs((en || []) as Enr[]);
  }
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/placements'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
    await load(); setReady(true);
  })(); }, [db, router]);

  const sync = async () => { setBusy('sync'); setError(''); setNotice(''); try { const { data: s } = await db.auth.getSession(); const r = await fetch('/api/placements', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token || ''}` }, body: JSON.stringify({ action: 'sync' }) }); const txt = await r.text(); let j: any = null; try { j = JSON.parse(txt); } catch { throw new Error(`الخادم لم يُرجع ردًا صالحًا (${r.status}) — غالبًا إعداد MIAAR_* غير صحيح أو انتهت المهلة`); } if (!j.success) throw new Error(j.error || 'فشلت المزامنة'); setNotice(j.retired ? 'لا حاجة للمزامنة بعد اليوم: مِعيار يعيش داخل أَثَر ويكتب كل نتيجة هنا لحظة اكتمالها — أعدنا تحميل القائمة.' : `تمت المزامنة: ${j.fetched} تقريرًا من مِعيار · ${j.imported} جديد · ${j.skipped} موجود مسبقًا${j.errors ? ' · أخطاء: ' + j.errors.join(' | ') : ''}`); await load(); } catch (e: any) { setError(e.message || String(e)); } setBusy(''); };

  const base = useMemo(() => latestOnly ? Array.from(latestByEmail(rows).values()) : rows, [rows, latestOnly]);
  const shown = useMemo(() => base.filter(p => (level === 'all' || effectiveLevel(p) === level) && (!q.trim() || `${p.full_name || ''} ${p.email} ${p.phone || ''}`.toLowerCase().includes(q.trim().toLowerCase()))), [base, level, q]);
  const dist = useMemo(() => levelDistribution(base.map(p => ({ entry_level: effectiveLevel(p) }))), [base]);
  const enrByEmail = useMemo(() => { const m = new Map<string, Enr[]>(); for (const e of enrs) { const k = e.email.toLowerCase(); if (!m.has(k)) m.set(k, []); m.get(k)!.push(e); } return m; }, [enrs]);
  const pgMap = useMemo(() => new Map(progs.map(p => [p.id, p])), [progs]);
  const avg = (k: 'grammar_vocab' | 'reading' | 'listening') => { const xs = base.map(p => p.skills[k]?.percent).filter(x => typeof x === 'number') as number[]; return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null; };

  if (!ready) return <div className="en rm-page"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="en-wrap"><div className="rm-card rm-muted">جارٍ التحميل…</div></div></div>;
  return (
    <div className="en rm-page"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="en-wrap">
        <RoomHead
        title={<>نتائج مِعيار — اختبار تحديد المستوى</>}
        desc={<><p>كل نتيجة يكتبها مِعيار — من أَثَر لحظة اكتمال الاختبار وتُسجَّل كدليل مهارة (استماع · قراءة · قواعد ومفردات) في ملف المتعلم، وتوجّه التسكين في الشعب والتوصية بالبرامج.</p></>}
        actions={<>
<button type="button" className="rm-btn" onClick={sync} disabled={busy === 'sync'}><Icon name="refresh" size={14} /> {busy === 'sync' ? 'جارٍ التحديث…' : 'تحديث القائمة'}</button><a className="rm-btn ghost" href="/admin/miaar"><Icon name="arrow" size={14} /> فتح مِعيار</a>
        </>}
      />
        <PortalAdminTabs />
        {error && <div className="en-err">{error}</div>}{notice && <div className="en-ok">{notice}</div>}

        <div className="rm-card pl-dist">
          <div className="pl-kpis"><span><b>{base.length}</b><small>{latestOnly ? 'متقدّم (أحدث نتيجة)' : 'نتيجة'}</small></span>{(['listening', 'reading', 'grammar_vocab'] as const).map(k => <span key={k}><b>{avg(k) ?? '—'}%</b><small>متوسط {miaarSkillLabel(k, 'ar')}</small></span>)}</div>
          <div className="pl-bars">{dist.map(d => <button type="button" key={d.level} className={`pl-bar ${level === d.level ? 'on' : ''} ${levelTone(d.level)}`} onClick={() => setLevel(level === d.level ? 'all' : d.level)}><i style={{ height: `${Math.max(4, d.pct)}%` }} /><b>{d.level}</b><small>{d.n}</small></button>)}</div>
        </div>

        <div className="en-tools">
          <div className="en-tabs"><button type="button" className={latestOnly ? 'on' : ''} onClick={() => setLatestOnly(true)}>أحدث نتيجة لكل متقدّم</button><button type="button" className={!latestOnly ? 'on' : ''} onClick={() => setLatestOnly(false)}>كل المحاولات ({rows.length})</button></div>
          <select value={level} onChange={e => setLevel(e.target.value as any)}><option value="all">كل المستويات</option>{CEFR_LEVELS.map(l => <option key={l} value={l}>{levelLabel(l, 'ar')}</option>)}</select>
          <input placeholder="بحث: الاسم، البريد، الهاتف…" value={q} onChange={e => setQ(e.target.value)} />
          <button type="button" className="rm-btn ghost" onClick={() => downloadXlsx(safeFilename('athar_miaar_results', 'xlsx'), [placementsSheet(shown)])} disabled={!shown.length}><Icon name="download" size={14} /> Excel ({shown.length})</button>
        </div>

        {shown.length === 0 && <div className="rm-card rm-muted">{rows.length === 0 ? 'لا نتائج بعد — تظهر هنا لحظة اكتمال أول اختبار في /miaar.' : 'لا نتائج ضمن هذه التصفية.'}</div>}
        {shown.map(p => { const lvl = effectiveLevel(p); const isOpen = open === p.id; const myEnr = enrByEmail.get(p.email) || []; const rec = recommendPrograms(progs.filter(x => x.cefr_level), lvl).slice(0, 3); return (
          <div key={p.id} className="rm-card en-row">
            <div className="en-top" onClick={() => setOpen(isOpen ? null : p.id)}>
              <div className="en-who"><span className={`pl-level ${levelTone(lvl)}`}>{lvl || '—'}</span><b>{p.full_name || p.email}</b><span className="rm-muted" dir="ltr">{p.email}</span>{myEnr.length > 0 && <span className="en-tag ok">{myEnr.length} تسجيل</span>}</div>
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
                <div className="cs-sec"><h3><Icon name="programs" size={15} /> تسجيلاته في أَثَر ({myEnr.length})</h3>{myEnr.length === 0 && <span className="rm-muted">لم يسجّل في أي برنامج بعد.</span>}{myEnr.map(e => <div key={e.id} className="en-details"><span>{pgMap.get(e.program_id)?.name_ar || e.program_id}</span><span className={`en-tag ${e.status}`}>{e.status}</span>{e.placement_level && <span>مستوى التسجيل: {e.placement_level}</span>}{e.classroom_id && <span>مُسكَن ✓</span>}<Link href={`/admin/enrollments`}>طلبات التسجيل ↗</Link></div>)}</div>
                <div className="cs-sec"><h3><Icon name="compass" size={15} /> برامج موصى بها لمستواه</h3>{rec.length === 0 && <span className="rm-muted">لا برامج موسومة بمستوى {lvl || '—'} — حدّد «مستوى CEFR المستهدف» في نشر البرامج.</span>}{rec.map(x => <div key={x.id} className="en-details"><span>{x.name_ar}</span><span className="en-tag">{x.cefr_level}</span><Link href={`/programs/${x.id}`} target="_blank">الصفحة ↗</Link></div>)}</div>
              </div>
            </div>}
          </div>); })}
      </div>
    </div>
  );
}

const CSS = `
.en{font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif}
.en-wrap{max-width:1080px;margin:0 auto;display:grid;gap:12px}
.en-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.en-tabs{display:flex;gap:6px;flex-wrap:wrap}.en-tabs button{border:1px solid #D9CBC2;background:#fff;border-radius:999px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;color:#4A3645}.en-tabs button.on{background:#3A1F36;border-color:#3A1F36;color:#fff}
.en-tools select,.en-tools input{font:inherit;font-size:13px;border:1px solid #D9CBC2;border-radius:10px;padding:8px 10px;background:#fff}.en-tools input{min-width:220px}
.en-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;cursor:pointer}.en-who{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:#8E7F8A}.en-who b{color:#3A1F36;font-size:15px}
.en-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px;color:#8E7F8A}.en-meta b{color:#3A1F36}
.en-tag{border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:900;background:#F6EBE0;color:#5C4858}.en-tag.ok,.en-tag.approved{background:#E6F3F1;color:#1F4F4A}.en-tag.pending{background:#F3E8EF;color:#6A3350}
.en-body{margin-top:12px;border-top:1px dashed #EADFD6;padding-top:12px;display:grid;gap:12px}.en-details{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#8E7F8A;align-items:center}.en-details a{color:#D4614A;font-weight:800}
.en-acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.en-err{background:#FBEDE7;border:1px solid #F3C4B6;color:#9A3A2A;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}.en-err code{background:#fff;border-radius:6px;padding:1px 6px;direction:ltr}.en-ok{background:#E6F3F1;border:1px solid #BFE1DC;color:#1F4F4A;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}
.cs-sec{border:1px solid #EADFD6;border-radius:12px;padding:12px 14px;display:grid;gap:8px;background:#FBF4EE;align-content:start}.cs-sec h3{margin:0;font-size:15px;color:#3A1F36;display:flex;gap:6px;align-items:center}
.pl-dist{display:grid;grid-template-columns:1fr 1.2fr;gap:16px;align-items:center}.pl-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.pl-kpis span{display:grid;border:1px solid #EADFD6;border-radius:12px;padding:8px 12px;background:#FBF4EE}.pl-kpis b{font-size:20px;color:#3A1F36}.pl-kpis small{color:#8E7F8A;font-size:11.5px}
.pl-bars{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;height:120px;align-items:end}.pl-bar{display:grid;grid-template-rows:1fr auto auto;height:100%;border:1px solid #EADFD6;border-radius:10px;background:#fff;cursor:pointer;font:inherit;padding:6px 4px;align-items:end;justify-items:center}.pl-bar i{display:block;width:70%;border-radius:6px 6px 0 0;background:#D4614A;align-self:end}.pl-bar.b i{background:#3A1F36}.pl-bar.c i{background:#D9A866}.pl-bar b{font-size:12.5px;color:#2A1626;direction:ltr}.pl-bar small{font-size:11px;color:#8E7F8A}.pl-bar.on{border-color:#3A1F36;background:#F3E8EF}
.pl-level{width:38px;height:38px;border-radius:10px;display:inline-grid;place-items:center;font-size:14px;font-weight:900;color:#fff;background:#8E7F8A;direction:ltr}.pl-level.a{background:#D4614A}.pl-level.b{background:#3A1F36}.pl-level.c{background:#D9A866;color:#2A1626}
.pl-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pl-skill{display:grid;grid-template-columns:130px 1fr auto;gap:10px;align-items:center;font-size:13px}.pl-track{height:8px;border-radius:999px;background:#EADFD6;overflow:hidden}.pl-track i{display:block;height:100%;background:#D4614A}.pl-skill b{font-size:12.5px;color:#3A1F36;direction:ltr}
.pl-levels{display:flex;gap:6px;flex-wrap:wrap}.pl-lv{font-size:11px;font-weight:900;border-radius:6px;padding:3px 8px;background:#F6EBE0;color:#5C4858;direction:ltr}.pl-lv.passed{background:#E6F3F1;color:#1F4F4A}.pl-lv.failed{background:#FBEDE7;color:#9A3A2A}
.pl-rec{margin:0;font-size:13px;line-height:1.8;color:#4A3645;background:#FBF4EE;border:1px solid #F1D9A8;border-radius:10px;padding:8px 12px}
@media(max-width:900px){.pl-dist,.pl-grid{grid-template-columns:1fr}.pl-skill{grid-template-columns:1fr}}
`;
