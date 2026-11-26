'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P81 */
/**
 * /admin/clock — «ساعة البرنامج»: لكلّ برنامج خمسة أحداث تلقائية (T-7 تذكير · T0 انطلاق · T+1 تقييم · T+30 متابعة · T+90 أثر)
 *  تُولَّد من تواريخ البرنامج وتُنفَّذ بالسلسلة اليومية. هنا: الخطّ الزمني، ما سيجري اليوم، تشغيل/تجاوز/إعادة، والإعدادات (الإزاحات والقنوات).
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { RoomHead } from '../../components/RoomKit';
import { KINDS, KIND_AR, STATUS_AR, STAGE_AR, DEFAULT_OFFSETS, normalizeConfig, stageOf, nextEvent, daysBetween, planEvents } from '../../../lib/clock/model';
import type { ClockConfig, ClockEvent, ClockKind, ClockProgram, Stage } from '../../../lib/clock/model';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST', 'TRAINER'];
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const fmt = (d?: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('ar-SA-u-nu-latn', { day: 'numeric', month: 'short' }) : '—');
const fmtT = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '');
type Filter = 'live' | 'all';

export default function ClockPage() {
  const db = useMemo(() => supabase(), []); const router = useRouter();
  const [ready, setReady] = useState(false); const [role, setRole] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [programs, setPrograms] = useState<ClockProgram[]>([]); const [events, setEvents] = useState<ClockEvent[]>([]); const [cfg, setCfg] = useState<ClockConfig>(normalizeConfig(null)); const [form, setForm] = useState<ClockConfig>(normalizeConfig(null));
  const [busy, setBusy] = useState(''); const [preview, setPreview] = useState<any>(null); const [filter, setFilter] = useState<Filter>('live'); const [openP, setOpenP] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10); const canWrite = WRITERS.includes(role);
  const say = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 4000); };

  const load = async () => {
    const [{ data: ps, error: e1 }, { data: ev }, { data: c }] = await Promise.all([
      db.from('programs').select('id,name_ar,start_date,end_date,status,delivery_mode,location_ar,hours,is_final_open').is('archived_at', null).order('start_date', { ascending: false }).limit(300),
      db.from('program_clock_events').select('*').order('due_date', { ascending: true }).limit(3000),
      db.from('program_clock_config').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (e1) { setError(e1.message); return; }
    setPrograms((ps || []) as ClockProgram[]); setEvents((ev || []) as ClockEvent[]); const n = normalizeConfig(c); setCfg(n); setForm(n);
  };
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/clock'); return; }
    const { data: p } = await db.from('profiles').select('role').eq('id', user.id).single(); const r = String((p as any)?.role || '').toUpperCase(); if (!STAFF.includes(r)) { router.replace('/dashboard'); return; } setRole(r);
    await load(); setReady(true);
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const api = async (body: any) => { const { data: s } = await db.auth.getSession(); const r = await fetch('/api/clock', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token || ''}` }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok || !j.success) throw new Error(j.error || `HTTP ${r.status}`); return j; };
  const act = async (label: string, body: any, after?: (j: any) => string) => { setBusy(label + (body.event_id || body.program_id || '')); setError(''); try { const j = await api(body); say(after ? after(j) : 'تمّ'); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(''); } };
  const doPreview = async () => { setBusy('preview'); try { setPreview(await api({ action: 'preview' })); } catch (e: any) { setError(e.message); } finally { setBusy(''); } };
  const saveCfg = async () => { setBusy('cfg'); setError(''); try { const { error } = await db.from('program_clock_config').upsert({ id: 1, enabled: form.enabled, offsets: form.offsets, channels: form.channels, updated_at: new Date().toISOString() }); if (error) throw new Error(error.message); setCfg(form); say('حُفظت الإعدادات — الأحداث المعلّقة تُعاد جدولتها عند التشغيل القادم'); await api({ action: 'generate' }); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(''); } };

  const byProgram = useMemo(() => { const m = new Map<string, ClockEvent[]>(); for (const e of events) { const l = m.get(e.program_id) || []; l.push(e); m.set(e.program_id, l); } return m; }, [events]);
  const rows = useMemo(() => programs.map((p) => ({ p, evs: byProgram.get(p.id) || [], stage: stageOf(p, today) })).filter((r) => filter === 'all' || (r.stage !== 'closed' && r.stage !== 'no_dates')), [programs, byProgram, filter, today]);
  const kpis = useMemo(() => { const dueToday = events.filter((e) => e.status === 'pending' && e.due_date <= today).length; const week = events.filter((e) => e.status === 'pending' && e.due_date > today && daysBetween(today, e.due_date) <= 7).length; const done = events.filter((e) => e.status === 'done').length; const failed = events.filter((e) => e.status === 'failed').length; return { dueToday, week, done, failed, programs: rows.length }; }, [events, rows, today]);

  if (!ready) return <div className="ck rm-page"><style>{CSS}</style><div className="rm-card">{error || 'جارٍ التحميل…'}</div></div>;
  return (
    <div className="ck rm-page" dir="rtl"><style>{CSS}</style>
      <RoomHead title={<>ساعة البرنامج</>} desc={<><p>لكلّ برنامج خمسة مواعيد تُدار وحدها: تذكير قبل أسبوع، روابط الانطلاق، فتح التقييم بعد النهاية، متابعة الأثر بعد شهر، وقياس الأثر بعد ثلاثة أشهر. تُولَّد من تواريخ البرنامج وتُنفَّذ صباح كلّ يوم؛ وأنت تراقب وتتدخّل عند الحاجة.</p></>}
        actions={<>
          <button className="rm-btn" onClick={doPreview} disabled={busy === 'preview'}><Icon name="search" size={16} /> {busy === 'preview' ? '…' : 'ما الذي سيجري اليوم؟'}</button>
          {canWrite && <button className="rm-btn" onClick={() => act('gen', { action: 'generate' }, (j) => `وُلِّد/حُدِّث ${j.generated} حدثًا`)} disabled={busy === 'gen'}><Icon name="refresh" size={16} /> توليد الأحداث</button>}
          <Link href="/admin/followup" className="rm-btn"><Icon name="trend" size={16} /> نقل الأثر</Link>
        </>} />
      {error && <div className="rm-alert" onClick={() => setError('')}>{error}</div>}{notice && <div className="ck-ok">{notice}</div>}
      {!cfg.enabled && <div className="rm-alert">الساعة متوقّفة — لن يُنفَّذ أيّ حدث تلقائيًّا حتى تُفعَّل من الإعدادات أدناه.</div>}

      <div className="rm-kpis"><div><small>برامج على الساعة</small><b>{kpis.programs}</b></div><div className={kpis.dueToday ? 'hot' : ''}><small>مستحقّ اليوم</small><b>{kpis.dueToday}</b></div><div><small>خلال أسبوع</small><b>{kpis.week}</b></div><div><small>نُفِّذ</small><b>{kpis.done}</b></div><div className={kpis.failed ? 'hot' : ''}><small>تعثّر</small><b>{kpis.failed}</b></div></div>

      {preview && <section className="rm-card ck-preview"><header><b>معاينة اليوم</b><button className="rm-btn" onClick={() => setPreview(null)}>إغلاق</button></header>
        {!preview.enabled && <p>الساعة متوقّفة.</p>}
        {preview.results?.length ? <ul>{preview.results.map((r: any) => <li key={r.event_id}><span className={`ck-chip ${r.action}`}>{r.action === 'run' ? 'سيُنفَّذ' : 'سيُتجاوز'}</span> <b>{KIND_AR[r.kind as ClockKind]?.label}</b> — {r.program}{r.sent ? <small> · مشاركون {r.sent.participants ?? 0} · مدرّبون {r.sent.trainers ?? 0} · إدارة {r.sent.admins ?? 0}</small> : null}{r.note ? <small> · {r.note}</small> : null}{r.error ? <small className="bad"> · {r.error}</small> : null}</li>)}</ul> : <p>لا أحداث مستحقّة اليوم.</p>}
      </section>}

      <div className="ck-filters"><button className={filter === 'live' ? 'on' : ''} onClick={() => setFilter('live')}>البرامج الحيّة</button><button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>الكلّ ({programs.length})</button><span className="ck-legend">{KINDS.map((k) => <i key={k}><b>{KIND_AR[k].short}</b> {KIND_AR[k].label}</i>)}</span></div>

      <section className="ck-list">
        {rows.length === 0 && <div className="rm-card rm-empty"><Icon name="clock" size={34} /><b>لا برامج بتواريخ</b><span>أضف تاريخ البداية والنهاية للبرنامج فتُولَّد ساعته تلقائيًّا.</span></div>}
        {rows.map(({ p, evs, stage }) => { const nx = nextEvent(evs, today); const planned = evs.length ? null : planEvents(p, cfg.offsets); const open = openP === p.id; return (
          <article key={p.id} className={`rm-card ck-prog st-${stage}`}>
            <header onClick={() => setOpenP(open ? null : p.id)}>
              <div className="ck-title"><b>{p.name_ar}</b><small><bdi>{fmt(p.start_date)} → {fmt(p.end_date)}</bdi> · <span className={`ck-stage ${stage}`}>{STAGE_AR[stage as Stage]}</span>{nx ? <> · القادم: <b>{KIND_AR[nx.kind].label}</b> بعد {daysBetween(today, nx.due_date)} يومًا</> : evs.length ? ' · اكتملت الساعة' : ' · لم تُولَّد بعد'}</small></div>
              <div className="ck-track">{KINDS.map((k) => { const e = evs.find((x) => x.kind === k); const due = e?.due_date || planned?.find((x) => x.kind === k)?.due_date; const st = e?.status || 'planned'; return <span key={k} className={`ck-dot ${st} ${e && e.status === 'pending' && e.due_date <= today ? 'due' : ''}`} title={`${KIND_AR[k].label} · ${due || ''} · ${e ? STATUS_AR[e.status] : 'مخطَّط'}`}><b>{KIND_AR[k].short}</b><small>{fmt(due)}</small></span>; })}</div>
              <Icon name="arrow" size={16} />
            </header>
            {open && <div className="ck-detail">
              {KINDS.map((k) => { const e = evs.find((x) => x.kind === k); return (
                <div key={k} className={`ck-row ${e?.status || 'planned'}`}>
                  <div className="ck-k"><b>{KIND_AR[k].short} · {KIND_AR[k].label}</b><small>{KIND_AR[k].hint}</small></div>
                  <div className="ck-when"><bdi>{e ? fmt(e.due_date) : fmt(planned?.find((x) => x.kind === k)?.due_date)}</bdi><small>{e ? STATUS_AR[e.status] : 'مخطَّط (لم يُولَّد)'}{e?.done_at ? ` · ${fmtT(e.done_at)}` : ''}</small></div>
                  <div className="ck-res">{e?.result?.sent ? <small>مشاركون {e.result.sent.participants ?? 0} · مدرّبون {e.result.sent.trainers ?? 0} · إدارة {e.result.sent.admins ?? 0}</small> : null}{e?.result?.note ? <small>{e.result.note}</small> : null}{e?.result?.reason ? <small>{e.result.reason}</small> : null}{e?.result?.error ? <small className="bad">{e.result.error}</small> : null}</div>
                  {canWrite && e && <div className="ck-act">
                    <button className="rm-btn" disabled={!!busy} onClick={() => { if (confirm(`تنفيذ «${KIND_AR[k].label}» الآن لبرنامج «${p.name_ar}»؟ سيُرسل البريد فعليًّا.`)) act('run', { action: 'run', event_id: e.id }, (j) => { const r = j.results?.[0]; return r?.ok ? `نُفِّذ: ${r.note || ''} · مشاركون ${r.sent?.participants ?? 0}` : `تعثّر: ${r?.error || ''}`; }); }}>{e.status === 'pending' ? 'نفّذ الآن' : 'أعد التنفيذ'}</button>
                    {e.status === 'pending' && <button className="rm-btn" disabled={!!busy} onClick={() => act('skip', { action: 'skip', event_id: e.id }, () => 'تُجووِز')}>تجاوز</button>}
                    {e.status !== 'pending' && <button className="rm-btn" disabled={!!busy} onClick={() => act('reset', { action: 'reset', event_id: e.id }, () => 'عاد إلى الانتظار')}>أعد للانتظار</button>}
                  </div>}
                </div>); })}
              <div className="ck-links"><Link href={`/reports/studio?program=${p.id}`}>استوديو التحليل</Link><Link href={`/reports/live?program=${p.id}`}>التقرير الحيّ</Link><Link href="/admin/enrollments">الطلبات والمقاعد</Link>{canWrite && !evs.length && <button className="rm-btn" onClick={() => act('gen', { action: 'generate', program_id: p.id }, (j) => `وُلِّد ${j.generated} حدثًا`)}>ولّد ساعة هذا البرنامج</button>}</div>
            </div>}
          </article>); })}
      </section>

      <section className="rm-card ck-cfg">
        <h3><Icon name="settings" size={18} /> إعدادات الساعة</h3>
        <label className="ck-sw"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} disabled={!canWrite} /> الساعة تعمل تلقائيًّا كلّ صباح</label>
        <div className="ck-grid">{KINDS.map((k) => <label key={k}><span>{KIND_AR[k].short} · {KIND_AR[k].label}</span><div><input type="number" min={-60} max={365} value={form.offsets[k]} onChange={(e) => setForm({ ...form, offsets: { ...form.offsets, [k]: Number(e.target.value) } })} disabled={!canWrite} /><small>يومًا من {KIND_AR[k].anchor === 'start' ? 'البداية' : 'النهاية'} (الافتراضي {DEFAULT_OFFSETS[k]})</small></div></label>)}</div>
        <div className="ck-ch">{([['participants', 'بريد المشاركين'], ['trainer', 'بريد المدرّبين'], ['admin', 'ملخّص للإدارة']] as const).map(([k, l]) => <label key={k}><input type="checkbox" checked={form.channels[k]} onChange={(e) => setForm({ ...form, channels: { ...form.channels, [k]: e.target.checked } })} disabled={!canWrite} /> {l}</label>)}</div>
        <p className="ck-note">الإدارة = NOTIFY_EMAILS في Vercel أو حسابات ADMIN. ما فات موعده لا يُرسل أبدًا (تذكير «يبدأ بعد أسبوع» لبرنامج انتهى)، بل يُعلَّم «تُجووِز». الحملات التي تنشئها الساعة تظهر في «نقل أثر التدريب» ويمكن تحريرها وإضافة المشرفين.</p>
        {canWrite && <button className="rm-btn primary" onClick={saveCfg} disabled={busy === 'cfg'}>{busy === 'cfg' ? '…' : 'حفظ الإعدادات'}</button>}
      </section>
    </div>
  );
}

const CSS = `
.ck{max-width:1080px;margin:0 auto}.ck-ok{background:#E6F3F1;color:#2F6B66;border-radius:10px;padding:8px 12px;margin:8px 0;font-weight:700}
.rm-kpis>div.hot b{color:#b3261e}
.ck-preview header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.ck-preview ul{margin:0;padding-inline-start:18px;font-size:13px;line-height:1.9}.ck-preview small{color:#5C4858}.ck-chip{border-radius:999px;padding:1px 8px;font-size:11px;font-weight:800;background:#F6ECD9;color:#6B4A12}.ck-chip.run{background:#E6F3F1;color:#2F6B66}.bad{color:#b3261e}
.ck-filters{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:10px 0}.ck-filters>button{border:1px solid #e6d5c6;background:#fff;border-radius:999px;padding:5px 12px;font:inherit;font-weight:800;color:#3A1F36;cursor:pointer}.ck-filters>button.on{background:#3A1F36;color:#fff;border-color:#3A1F36}.ck-legend{margin-inline-start:auto;display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:#5C4858}.ck-legend b{color:#D4614A}
.ck-list{display:flex;flex-direction:column;gap:8px}.ck-prog{padding:0;overflow:hidden}.ck-prog>header{display:grid;grid-template-columns:1fr auto 20px;gap:12px;align-items:center;padding:12px 14px;cursor:pointer}.ck-title b{font-size:15px;color:#22101F;display:block}.ck-title small{color:#5C4858;font-size:12px}
.ck-stage{font-weight:800}.ck-stage.before{color:#D4614A}.ck-stage.running{color:#2F6B66}.ck-stage.after{color:#8E4A68}.ck-stage.closed,.ck-stage.no_dates{color:#8a7580}
.ck-track{display:flex;gap:4px}.ck-dot{display:flex;flex-direction:column;align-items:center;min-width:52px;padding:4px 6px;border-radius:10px;background:#F6EBE0;font-size:10px;color:#5C4858}.ck-dot b{font-size:11px;color:#3A1F36}.ck-dot.done{background:#E6F3F1}.ck-dot.done b{color:#2F6B66}.ck-dot.skipped{background:#F3EEF1;opacity:.7}.ck-dot.failed{background:#F8D7D3}.ck-dot.failed b{color:#8b1e14}.ck-dot.due{outline:2px solid #D4614A}.ck-dot.planned{border:1px dashed #d9c6b6;background:#fff}
.ck-detail{border-top:1px solid #f0e4d8;padding:8px 14px 12px}.ck-row{display:grid;grid-template-columns:1.4fr .8fr 1.2fr auto;gap:10px;align-items:center;padding:8px 0;border-bottom:1px dashed #f0e4d8;font-size:13px}.ck-row:last-of-type{border-bottom:0}.ck-k b{display:block;color:#22101F}.ck-k small,.ck-when small,.ck-res small{display:block;color:#5C4858;font-size:11.5px}.ck-row.done .ck-when{color:#2F6B66}.ck-row.failed .ck-when{color:#b3261e}.ck-act{display:flex;gap:4px}.ck-act .rm-btn{padding:4px 10px;font-size:12px;min-height:34px}
.ck-links{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;font-size:12.5px;align-items:center}.ck-links a{color:#3A1F36;font-weight:800}
.ck-cfg{margin-top:14px}.ck-cfg h3{display:flex;gap:6px;align-items:center;margin:0 0 8px;color:#3A1F36;font-size:16px}.ck-sw{display:flex;gap:8px;align-items:center;font-weight:800;margin-bottom:8px}.ck-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}.ck-grid label{display:flex;flex-direction:column;gap:3px;font-size:12.5px;font-weight:800;color:#3A1F36}.ck-grid input{width:80px;padding:6px 8px;border:1px solid #e6d5c6;border-radius:8px;font:inherit}.ck-grid small{display:block;font-weight:600;color:#8a7580;font-size:11px}.ck-ch{display:flex;gap:16px;flex-wrap:wrap;margin:10px 0;font-size:13px;font-weight:700}.ck-note{font-size:12px;color:#5C4858;line-height:1.8}
@media(max-width:800px){.ck-prog>header{grid-template-columns:1fr 20px}.ck-track{grid-column:1/-1;flex-wrap:wrap}.ck-row{grid-template-columns:1fr 1fr}}
`;
