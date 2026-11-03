'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P45 «بروفة» — التمرين التبادلي بين الممارسين — ستة مكوّنات:
 *  <RehearsalBoard token>                 /me/rehearsal: اطلب بروفة (الآن/موعد · الدائرة) · طلبات تنتظر من يلعب الدور (بلا أسماء) · بروفاتي · الجملتان · «كيف مرّ؟»
 *  <RehearsalRoomPanel code token>        /room/<code> لغرفة rehearsal: بطاقة الدور · المشهد رقم N · «نعيد المشهد» · «نتبادل الأدوار» · «انتهت — نكتب جملتينا» · «أغلق وأبلغ»
 *  <RehearsalFromNeed needId>             بطاقة الحاجة في /needs: «أطلب بروفة لهذا الموقف»
 *  <RehearsalBeforeStation programId …>   /me/after: «موقفك قادم — بروفة قبله؟» تحت محطة مفتوحة لم تُكتب
 *  <ProgramRehearsals programId>          صفحة البرنامج: «بروفات مفتوحة» لزملاء البرنامج (عدد وأدوار · بلا أسماء)
 *  <LearnedFromRehearsals>                /2062: «ما تعلّمناه من البروفات» k≥5 + سطر الشهر
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { P45_NAMES_AR, SITUATION_MIN, SITUATION_MAX, ROLE_MAX, KIND_MAX, SELF_MAX, ROOM_MINUTES, SCHEDULE_DAYS, HOW, HOW_AR, situationFromStation } from '../../lib/rehearsal/registry';

const fmtT = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '');
/** متى؟ بتوقيت متصفح القارئ (لا UTC) */
const whenLocal = (r: { mode: string; scheduled_at?: string | null; expires_at: string }) => (r.mode === 'now' ? `الآن — الطلب مفتوح حتى ${fmtT(r.expires_at)}` : `موعد: ${fmtT(r.scheduled_at || r.expires_at)}`);
type Tok = () => Promise<string>;
async function api(tok: Tok | null, path: string, body?: any) { const tk = tok ? await tok() : ''; const h: any = { 'Content-Type': 'application/json' }; if (tk) h.Authorization = `Bearer ${tk}`; const r = await fetch(path, body ? { method: 'POST', headers: h, body: JSON.stringify(body) } : { headers: h, cache: 'no-store' }); return r.json().catch(() => ({ success: false, error: 'تعذّر الاتصال' })); }
const localToIso = (v: string) => { const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : ''; };

/* ───────── 1) اللوحة ───────── */
const EMPTY = { sector: '', situation: '', my: '', other: '', mode: 'now' as 'now' | 'scheduled', when: '', real: '', circle: 'all', circle_ref: '', source: 'free', source_ref: '' };
export function RehearsalBoard({ token }: { token: Tok }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(''); const [f, setF] = useState({ ...EMPTY }); const [focus, setFocus] = useState('');
  const [kindTxt, setKindTxt] = useState<Record<string, string>>({}); const [selfTxt, setSelfTxt] = useState<Record<string, string>>({}); const [selfPub, setSelfPub] = useState<Record<string, boolean>>({});
  const load = useCallback(async () => { const j = await api(token, '/api/rehearsals'); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return; } setD(j); }, [token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {   // تعبئة مسبقة: ?need= · ?case= · ?program=&text= (قبل المحطة) · ?r= (إبراز)
    const sp = new URLSearchParams(window.location.search); const r = sp.get('r') || ''; if (r) setFocus(r);
    const need = sp.get('need') || ''; const cs = sp.get('case') || ''; const prog = sp.get('program') || ''; const text = sp.get('text') || '';
    if (need || cs) { api(token, `/api/rehearsals?prefill=${need ? 'need' : 'case'}:${encodeURIComponent(need || cs)}`).then(j => { if (j?.success && j.prefill) setF(x => ({ ...x, sector: j.prefill.sector || '', situation: j.prefill.situation_ar || '', my: j.prefill.my_role_ar || '', other: j.prefill.other_role_ar || '', circle: j.prefill.circle || 'all', circle_ref: j.prefill.circle_ref || '', source: j.prefill.source, source_ref: j.prefill.source_ref })); }); }
    else if (prog) setF(x => ({ ...x, situation: text ? situationFromStation(text) : '', circle: 'program', circle_ref: prog, source: 'station', source_ref: prog }));
  }, [token]);
  useEffect(() => { if (d && focus) document.getElementById(`reh-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [d, focus]);
  async function post(body: any, after?: (j: any) => void) { setBusy(body.action + (body.id || '')); setErr(''); setOk(''); try { const j = await api(token, '/api/rehearsals', body); if (!j.success) throw new Error(j.error || 'فشل'); await load(); if (j.note_ar) setOk(j.note_ar); after?.(j); } catch (e: any) { setErr(e.message || 'فشل'); } finally { setBusy(''); } }
  const me = d?.me; const canPlay = !!(me?.staff || me?.faculty || me?.enrolled); const progs: any[] = d?.programs || [];
  const minWhen = useMemo(() => { const t = new Date(Date.now() + 15 * 60000); t.setSeconds(0, 0); return t.toISOString().slice(0, 16); }, []);
  if (!d) return <main className="pt-main rh"><style dangerouslySetInnerHTML={{ __html: CSS }} /><section className="pt-box"><p className="pt-muted">{err || '…'}</p></section></main>;
  const mine: any[] = d.mine || []; const open: any[] = d.open || []; const notes = d.notes || {};
  return <main className="pt-main rh" data-testid="reh-page"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="pt-box rh-hero" aria-labelledby="rh-h1">
      <span className="pt-kicker"><Icon name="users" size={14} /> {P45_NAMES_AR.phase} · {P45_NAMES_AR.official}</span>
      <h1 id="rh-h1">{P45_NAMES_AR.page}</h1>
      <p className="rh-lead">قبل أن يقع الموقف الصعب، جرّبه مع إنسان: تصف الموقف وتقول من تحتاج أن يلعب الدور الآخر، زميل يقبل، {ROOM_MINUTES} دقيقة في غرفة أَثَر — لا تسجيل، لا درجات، ولا ذكاء اصطناعي في الغرفة. ثم جملة طيبة له، وجملة لنفسك: «ما سأفعله مختلفًا».</p>
      <p className="rh-sum" data-testid="reh-summary">{d.summary_ar}</p>
      <form className="rh-form" data-testid="reh-form" onSubmit={e => { e.preventDefault(); post({ action: 'create', sector: f.sector, situation_ar: f.situation, my_role_ar: f.my, other_role_ar: f.other, mode: f.mode, scheduled_at: f.mode === 'scheduled' ? localToIso(f.when) : undefined, real_at: f.real ? localToIso(f.real) : undefined, circle: f.circle, circle_ref: f.circle_ref || undefined, source: f.source, source_ref: f.source_ref || undefined }, j => { setF({ ...EMPTY }); if (j.id) setFocus(j.id); }); }}>
        <label className="rh-q">{d.question_ar}
          <textarea value={f.situation} onChange={e => setF(x => ({ ...x, situation: e.target.value.slice(0, SITUATION_MAX) }))} rows={3} maxLength={SITUATION_MAX} minLength={SITUATION_MIN} required placeholder="مثال: اجتماع مع ولي أمر غاضب يتّهمني بظلم ابنه أمام زملائي، وأريد أن أُنهيه بلا تصعيد" data-testid="reh-situation" /></label>
        <div className="rh-grid">
          <label>الدور الذي أحتاج من يلعبه<input value={f.other} onChange={e => setF(x => ({ ...x, other: e.target.value.slice(0, ROLE_MAX) }))} maxLength={ROLE_MAX} required placeholder="ولي أمر غاضب · مريض قلق · مدير متعجّل…" data-testid="reh-other" /></label>
          <label>دوري أنا<input value={f.my} onChange={e => setF(x => ({ ...x, my: e.target.value.slice(0, ROLE_MAX) }))} maxLength={ROLE_MAX} placeholder="معلّمة الصف · ممرّض الاستقبال…" data-testid="reh-my" /></label>
          <label>القطاع<select value={f.sector} onChange={e => setF(x => ({ ...x, sector: e.target.value }))} required data-testid="reh-sector"><option value="">القطاع…</option>{(d.sectors || []).map((s: any) => <option key={s.code} value={s.code}>{s.ar}</option>)}</select></label>
          <label>مع من؟<select value={f.circle} onChange={e => setF(x => ({ ...x, circle: e.target.value, circle_ref: e.target.value === 'program' ? (progs[0]?.id || x.circle_ref) : e.target.value === 'need' ? x.circle_ref : '' }))} data-testid="reh-circle">
            <option value="all">أي ممارس في أَثَر</option><option value="faculty">عضو في هيئة أَثَر</option>{progs.length > 0 && <option value="program">زملاء برنامجي</option>}{f.source === 'need' && f.source_ref && <option value="need">من أعلنوا الحاجة نفسها</option>}</select></label>
          {f.circle === 'program' && progs.length > 0 && <label>أيّ برنامج؟<select value={f.circle_ref} onChange={e => setF(x => ({ ...x, circle_ref: e.target.value }))} data-testid="reh-program">{progs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>}
        </div>
        <fieldset className="rh-mode"><legend>متى؟</legend>
          <label className={f.mode === 'now' ? 'on' : ''}><input type="radio" name="mode" checked={f.mode === 'now'} onChange={() => setF(x => ({ ...x, mode: 'now' }))} data-testid="reh-mode-now" /> الآن — على الهواء (الطلب مفتوح ساعتين)</label>
          <label className={f.mode === 'scheduled' ? 'on' : ''}><input type="radio" name="mode" checked={f.mode === 'scheduled'} onChange={() => setF(x => ({ ...x, mode: 'scheduled' }))} data-testid="reh-mode-scheduled" /> موعد خلال {SCHEDULE_DAYS} أيام</label>
          {f.mode === 'scheduled' && <label className="rh-when">الموعد<input type="datetime-local" value={f.when} min={minWhen} onChange={e => setF(x => ({ ...x, when: e.target.value }))} required data-testid="reh-when" /></label>}
          <label className="rh-when">متى يقع الموقف الحقيقي؟ (اختياري — نسألك بعده «كيف مرّ؟»)<input type="datetime-local" value={f.real} onChange={e => setF(x => ({ ...x, real: e.target.value }))} data-testid="reh-real" /></label>
        </fieldset>
        {f.source !== 'free' && <small className="rh-src" data-testid="reh-source">{f.source === 'need' ? 'من حاجة معلَنة — عدّل الموقف كما تشاء' : f.source === 'case' ? 'من موقف «كل يوم مهارة»' : 'قبل محطتك — جرّب الموقف قبل أن تكتب عنه'}</small>}
        <div className="rh-row"><small className="pt-muted"><bdi>{f.situation.length}</bdi>/{SITUATION_MAX}</small><button className="pt-btn gold" type="submit" disabled={busy === 'create' || f.situation.trim().length < SITUATION_MIN || !f.sector || f.other.trim().length < 2 || (f.mode === 'scheduled' && !f.when)} data-testid="reh-submit">{busy === 'create' ? '…' : P45_NAMES_AR.ask}</button></div>
        <small className="pt-muted">{d.hint_ar} اسمك يُكشف للزميل بعد قبوله فقط.</small>
      </form>
      {err && <p className="pt-err" role="alert" data-testid="reh-err">{err}</p>}{ok && <p className="rh-ok" role="status" data-testid="reh-ok">{ok}</p>}
    </section>

    {mine.length > 0 && <section className="pt-box" data-testid="reh-mine" aria-labelledby="rh-mine-h"><h2 id="rh-mine-h"><Icon name="target" size={16} /> بروفاتي</h2>
      <ul className="rh-list">{mine.map(r => { const n = notes[r.id] || {}; const canWrite = ['accepted', 'done'].includes(r.status);
        return <li key={r.id} id={`reh-${r.id}`} className={`rh-card st-${r.status}${focus === r.id ? ' focus' : ''}`} data-testid="reh-card" data-status={r.status} data-role={r.mine ? 'asker' : 'partner'}>
          <div className="rh-top"><span className="rh-sector">{r.sector_ar}</span><span className="rh-role">{r.mine ? 'طلبتها' : `ألعب دور «${r.other_role_ar}»`}</span><span className={`rh-status ${r.status}`} data-testid="reh-status">{r.status_ar}</span></div>
          <p className="rh-text">{r.situation_ar}</p>
          <p className="rh-meta">{r.mine ? <>أحتاج من يلعب: <b>{r.other_role_ar}</b></> : <>الطالب: <b>{r.asker_name_ar || 'زميل'}</b>{r.my_role_ar ? ` (${r.my_role_ar})` : ''}</>} · {whenLocal(r)}{r.partner_name_ar && r.mine ? <> · يلعب الدور: <b data-testid="reh-partner">{r.partner_name_ar}</b></> : null}</p>
          <div className="rh-acts">
            {r.room_code && r.status === 'accepted' && <Link href={`/room/${r.room_code}`} className="pt-btn gold" data-testid="reh-room-link"><Icon name="play" size={14} /> ادخل غرفة البروفة · <bdi>{r.room_code}</bdi></Link>}
            {r.status === 'accepted' && <button type="button" className="pt-btn ghost" onClick={() => post({ action: 'finish', id: r.id })} disabled={busy === 'finish' + r.id} data-testid="reh-finish">انتهت البروفة</button>}
            {r.mine && ['open', 'accepted'].includes(r.status) && <button type="button" className="pt-btn ghost" onClick={() => { if (window.confirm('تلغي بروفتك؟')) post({ action: 'cancel', id: r.id }); }} data-testid="reh-cancel">ألغِ</button>}
          </div>
          {canWrite && <div className="rh-notes" data-testid="reh-notes">
            {n.kind_mine ? <p className="rh-done"><Icon name="check" size={13} /> جملتك الطيبة: «{n.kind_mine}»</p> : <form className="rh-inl" onSubmit={e => { e.preventDefault(); post({ action: 'note', id: r.id, kind: 'kind_to_partner', text_ar: kindTxt[r.id] || '' }); }}><label>{P45_NAMES_AR.kind} للطرف الآخر — ما كان حسنًا فيه (≤ {KIND_MAX})<input value={kindTxt[r.id] || ''} onChange={e => setKindTxt(x => ({ ...x, [r.id]: e.target.value.slice(0, KIND_MAX) }))} maxLength={KIND_MAX} data-testid="reh-kind" /></label><button className="pt-btn small" type="submit" disabled={busy === 'note' + r.id || (kindTxt[r.id] || '').trim().length < 3} data-testid="reh-kind-submit">أرسل</button></form>}
            {n.kind_from_partner ? <p className="rh-from" data-testid="reh-kind-from"><Icon name="star" size={13} /> كتب لك: «{n.kind_from_partner}»</p> : n.partner_wrote ? <p className="pt-muted">كتب لك الطرف الآخر جملته — تصلك حين تكتب جملتك (أو بعد 24 ساعة).</p> : null}
            {n.self_mine ? <p className="rh-done"><Icon name="check" size={13} /> {P45_NAMES_AR.self}: «{n.self_mine}»{n.self_public ? ' — أذنت بنشرها مجهولة' : ''}</p> : <form className="rh-inl col" onSubmit={e => { e.preventDefault(); post({ action: 'note', id: r.id, kind: 'to_self', text_ar: selfTxt[r.id] || '', public_ok: !!selfPub[r.id] }); }}><label>{P45_NAMES_AR.self} — لنفسي، خاصة (≤ {SELF_MAX})<textarea rows={2} value={selfTxt[r.id] || ''} onChange={e => setSelfTxt(x => ({ ...x, [r.id]: e.target.value.slice(0, SELF_MAX) }))} maxLength={SELF_MAX} data-testid="reh-self" /></label><div className="rh-row"><label className="rh-chk"><input type="checkbox" checked={!!selfPub[r.id]} onChange={e => setSelfPub(x => ({ ...x, [r.id]: e.target.checked }))} data-testid="reh-self-public" /> أأذن بنشرها مجهولة في «{P45_NAMES_AR.learned}» حين تبلغ خمسًا في قطاعي</label><button className="pt-btn small" type="submit" disabled={busy === 'note' + r.id || (selfTxt[r.id] || '').trim().length < 3} data-testid="reh-self-submit">احفظ</button></div></form>}
          </div>}
          {r.mine && r.status === 'done' && !r.how_went && (!r.real_at || Date.parse(r.real_at) <= Date.now()) && <div className="rh-how" data-testid="reh-how"><b>كيف مرّ الموقف الحقيقي؟</b><div className="rh-chips">{HOW.map(h => <button key={h} type="button" onClick={() => post({ action: 'how', id: r.id, how: h })} disabled={busy === 'how' + r.id} data-testid={`reh-how-${h}`}>{HOW_AR[h]}</button>)}</div></div>}
          {r.how_ar && <p className="rh-done" data-testid="reh-how-done"><Icon name="flag" size={13} /> كيف مرّ: {r.how_ar}</p>}
          {r.mine && r.status === 'done' && n.self_mine && <p className="pt-muted"><Link href="/me/after">تُقترح جملتك حين تكتب محطتك في «الشهادة التي تكبر» ←</Link></p>}
          {r.status === 'expired' && r.mine && <p className="pt-muted">جرّب موعدًا مؤجَّلًا أو وسّع الدائرة — أعد الطلب أعلاه.</p>}
        </li>; })}</ul></section>}

    <section className="pt-box" aria-labelledby="rh-open-h" data-testid="reh-open">
      <h2 id="rh-open-h"><Icon name="users" size={16} /> طلبات تنتظر من يلعب الدور</h2>
      <p className="pt-muted">بلا أسماء حتى تقبل. {canPlay ? `حين تقبل تُفتح غرفة لكما ${ROOM_MINUTES} دقيقة، وتلعب الدور كما يلعبه صاحبه في الواقع.` : 'يلعب الدور من أتمّ برنامجًا في أَثَر أو عضو في هيئته — سجّل في برنامج أولًا.'}</p>
      {open.length === 0 && <p className="pt-muted" data-testid="reh-open-empty">لا طلبات تنتظرك الآن.</p>}
      <ul className="rh-list">{open.map(r => <li key={r.id} id={`reh-${r.id}`} className={`rh-card st-open${focus === r.id ? ' focus' : ''}`} data-testid="reh-open-card">
        <div className="rh-top"><span className="rh-sector">{r.sector_ar}</span><span className="rh-circle">{r.circle_ar}</span><span className={`rh-status ${r.mode}`}>{r.mode_ar}</span></div>
        <p className="rh-text">{r.situation_ar}</p>
        <p className="rh-meta">يحتاج من يلعب: <b>{r.other_role_ar}</b>{r.my_role_ar ? ` · وهو ${r.my_role_ar}` : ''} · {whenLocal(r)}</p>
        <div className="rh-acts">{canPlay && <button type="button" className="pt-btn gold" onClick={() => post({ action: 'accept', id: r.id }, j => { if (j.room_code) setFocus(r.id); })} disabled={busy === 'accept' + r.id} data-testid="reh-accept">{P45_NAMES_AR.accept}</button>}</div>
      </li>)}</ul>
    </section>
    <p className="rh-foot pt-muted">لا أسماء قبل القبول، لا تسجيل في الغرفة، لا درجات ولا «أفضل ممثّل». جملتك «ما سأفعله مختلفًا» خاصة، وتُنشر مجهولة بإذنك فقط حين تبلغ خمسًا في القطاع. «أغلق وأبلغ» في كل غرفة يصل الطاقم بالهويتين فقط.</p>
  </main>;
}

/* ───────── 2) لوحة الغرفة ───────── */
export function RehearsalRoomPanel({ code, token, lang = 'ar', onClosed }: { code: string; token: Tok; lang?: string; onClosed?: () => void }) {
  const ar = lang === 'ar'; const [d, setD] = useState<any>(null); const [scene, setScene] = useState(1); const [swapped, setSwapped] = useState(false); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const load = useCallback(async () => { const j = await api(token, `/api/rehearsals?room=${encodeURIComponent(code)}`); if (j?.success) setD(j); }, [code, token]);
  useEffect(() => { load(); }, [load]);
  async function act(action: string) { if (!d?.rehearsal) return; setBusy(action); setMsg(''); const j = await api(token, '/api/rehearsals', { action, id: d.rehearsal.id }); setBusy(''); if (j?.success) { setMsg(j.note_ar || ''); await load(); if (action === 'report' || action === 'finish') onClosed?.(); } else setMsg(j?.error || 'فشل'); }
  if (!d?.rehearsal) return null; const r = d.rehearsal; const other = swapped ? (r.my_role_ar || (ar ? 'دور الطالب' : 'the asker’s role')) : r.other_role_ar; const meRole = swapped ? r.other_role_ar : (r.my_role_ar || (ar ? 'نفسي' : 'myself'));
  return <section className="rh-room" data-testid="reh-room-panel" aria-labelledby="rh-room-h"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h3 id="rh-room-h"><Icon name="users" size={16} /> {ar ? P45_NAMES_AR.room : 'Rehearsal room'} · {ar ? `المشهد ${scene}` : `Scene ${scene}`}</h3>
    <div className="rh-roles"><div className={`rh-rolecard ${r.mine !== swapped ? 'me' : ''}`}><small>{r.mine ? (ar ? 'أنت' : 'You') : (ar ? 'الطالب' : 'Asker')}{r.asker_name_ar && !r.mine ? ` · ${r.asker_name_ar}` : ''}</small><b>{r.mine ? meRole : other}</b></div><span className="rh-vs">↔</span><div className={`rh-rolecard ${r.mine === swapped ? 'me' : ''}`}><small>{r.mine ? (r.partner_name_ar || (ar ? 'الزميل' : 'Partner')) : (ar ? 'أنت' : 'You')}</small><b>{r.mine ? other : meRole}</b></div></div>
    <p className="rh-sit" data-testid="reh-room-situation">{r.situation_ar}</p>
    <div className="rh-acts">
      <button type="button" className="pt-btn ghost small" onClick={() => setScene(s => s + 1)} data-testid="reh-replay"><Icon name="refresh" size={13} /> {ar ? P45_NAMES_AR.replay : 'Replay the scene'}</button>
      <button type="button" className="pt-btn ghost small" onClick={() => { setSwapped(s => !s); setScene(s => s + 1); }} data-testid="reh-swap" aria-pressed={swapped}><Icon name="users" size={13} /> {ar ? P45_NAMES_AR.swap : 'Swap roles'}</button>
      {r.status === 'accepted' && <button type="button" className="pt-btn gold small" onClick={() => act('finish')} disabled={busy === 'finish'} data-testid="reh-room-finish">{ar ? 'انتهت — نكتب جملتينا' : 'Done — write our two lines'}</button>}
      {r.status === 'done' && <Link href={`/me/rehearsal?r=${r.id}`} className="pt-btn gold small" data-testid="reh-room-notes">{ar ? 'اكتب جملتيك' : 'Write your two lines'}</Link>}
      {['accepted', 'done'].includes(r.status) && <button type="button" className="pt-btn ghost small danger" onClick={() => { if (window.confirm(ar ? 'تُغلق الغرفة للجميع ويصل البلاغ إلى الطاقم بالهويتين فقط. متابعة؟' : 'Close the room and report to staff?')) act('report'); }} disabled={busy === 'report'} data-testid="reh-report">{ar ? 'أغلق وأبلغ' : 'Close & report'}</button>}
    </div>
    {msg && <p className="rh-ok" role="status" data-testid="reh-room-msg">{msg}</p>}
    <small className="pt-muted">{ar ? 'لا يُسجَّل شيء ولا يدخل الغرفة ذكاء اصطناعي. يُسمح بالخطأ — أعيدا المشهد كما تشاءان.' : 'Nothing is recorded; no AI in the room. Mistakes are allowed — replay as you wish.'}</small>
  </section>;
}

/* ───────── 3) من حاجة · 4) قبل المحطة ───────── */
export function RehearsalFromNeed({ needId, lang = 'ar' }: { needId: string; lang?: string }) {
  return <Link href={`/me/rehearsal?need=${encodeURIComponent(needId)}`} className="pt-btn ghost rh-fromneed" data-testid="reh-from-need"><Icon name="users" size={13} /> {lang === 'ar' ? P45_NAMES_AR.from_need : 'Rehearse this situation'}</Link>;
}
export function RehearsalBeforeStation({ programId, programAr, lang = 'ar' }: { programId: string; programAr: string; lang?: string }) {
  return <p className="rh-before" data-testid="reh-before-station"><Link href={`/me/rehearsal?program=${encodeURIComponent(programId)}&text=${encodeURIComponent(programAr)}`}><Icon name="users" size={13} /> {lang === 'ar' ? P45_NAMES_AR.before_station : 'Your situation is coming — rehearse it first?'}</Link></p>;
}

/* ───────── 5) بروفات مفتوحة على صفحة البرنامج ───────── */
export function ProgramRehearsals({ programId, lang = 'ar' }: { programId: string; lang?: string }) {
  const ar = lang === 'ar'; const [d, setD] = useState<any>(null);
  useEffect(() => { if (programId) api(null, `/api/rehearsals?program=${encodeURIComponent(programId)}`).then(j => setD(j?.success ? j : null)); }, [programId]);
  if (!d || !d.count) return null;
  return <section className="rh-progbox" data-testid="program-rehearsals"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h3><Icon name="users" size={16} /> {ar ? P45_NAMES_AR.open_on_program : 'Open rehearsals'}</h3>
    <p>{ar ? `${d.count === 1 ? 'زميل واحد في هذا البرنامج يطلب' : d.count === 2 ? 'زميلان يطلبان' : `${d.count} زملاء يطلبون`} من يلعب دور: ${d.roles.map((x: string) => `«${x}»`).join('، ')}.` : `${d.count} classmates are asking for a rehearsal partner.`}</p>
    <Link href="/me/rehearsal" className="pt-btn small">{ar ? 'العب الدور — 15 دقيقة' : 'Play the role — 15 minutes'}</Link>
  </section>;
}

/* ───────── 6) ما تعلّمناه من البروفات (2062) ───────── */
export function LearnedFromRehearsals({ lang = 'ar' }: { lang?: string }) {
  const ar = lang === 'ar'; const [d, setD] = useState<any>(null);
  useEffect(() => { api(null, '/api/rehearsals?public=1').then(j => setD(j?.success ? j : null)); }, []);
  const learned: any[] = d?.learned || [];
  return <section className="rh-learned" data-testid="reh-learned" aria-labelledby="rh-l-h"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h2 id="rh-l-h">🎭 {ar ? P45_NAMES_AR.learned : 'What we learned from rehearsals'}</h2>
    <p className="rh-llead">{ar ? 'قبل أن يقع الموقف الصعب يجرّبه ممارسان معًا في غرفة أَثَر — بلا تسجيل وبلا آلة. ما يكتبه كلٌّ لنفسه بعدها «ما سأفعله مختلفًا» يظهر هنا مجهولًا بإذنه، حين يبلغ خمسًا في القطاع.' : 'Two practitioners rehearse a hard situation before it happens. Their private “what I will do differently” lines appear here, anonymised and by consent, once a sector reaches five.'}</p>
    {d?.line_ar && <p className="rh-line" data-testid="reh-line">{d.line_ar}</p>}
    {learned.length === 0 ? <p className="pt-muted" data-testid="reh-learned-empty">{ar ? 'لم تبلغ الجمل خمسًا في قطاع بعد — الصفحة تبدأ ببروفتك.' : 'No sector has reached five lines yet.'}</p>
      : <div className="rh-lgrid">{learned.map(s => <article key={s.sector} className="rh-lsec" data-testid="reh-learned-sector"><b>{s.sector_ar}</b><small>{ar ? `${s.count} جملة من ممارسين لا نسمّيهم` : `${s.count} lines`}</small><ul>{s.lines.map((l: string, k: number) => <li key={k}>«{l}»</li>)}</ul></article>)}</div>}
    <p className="pt-muted rh-more"><Link href="/me/rehearsal">{ar ? 'اطلب بروفة لموقفك ←' : 'Request a rehearsal →'}</Link></p>
  </section>;
}

const CSS = `
.rh{max-width:980px}.rh-hero h1{margin:.2rem 0 .4rem;color:#0f2a4e}.rh-lead{font-size:1.04rem;line-height:1.9;margin:0 0 .4rem}.rh-sum{color:#0b8a83;font-weight:700;margin:0 0 .8rem}
.rh-form{display:grid;gap:.6rem;background:#f7f8fb;border:1px solid #e5e8ef;border-radius:14px;padding:.9rem}.rh-form textarea,.rh-form input,.rh-form select,.rh-inl input,.rh-inl textarea{width:100%;font:inherit;padding:.55rem .7rem;border:1px solid #cfd6e2;border-radius:10px;background:#fff;box-sizing:border-box}
.rh-q{font-weight:800;color:#0f2a4e;display:grid;gap:.35rem}.rh-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.6rem}.rh-grid label{display:grid;gap:.3rem;font-size:.9rem;font-weight:700;color:#334155;min-width:0}
.rh-mode{border:1px dashed #cfd6e2;border-radius:12px;padding:.6rem .8rem;display:grid;gap:.4rem;margin:0}.rh-mode legend{font-weight:800;color:#0f2a4e;padding:0 .3rem}.rh-mode>label{display:flex;gap:.5rem;align-items:center;font-size:.92rem}.rh-mode>label.on{color:#0b8a83;font-weight:700}.rh-when{display:grid!important;gap:.3rem;font-size:.86rem!important;font-weight:700;color:#334155}.rh-when input{max-width:280px}
.rh-row{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;justify-content:space-between}.rh-src{color:#0b8a83;font-weight:700}.rh-ok{color:#0b8a83;font-weight:700;margin:.5rem 0 0}
.rh-list{list-style:none;margin:.6rem 0 0;padding:0;display:grid;gap:.7rem}.rh-card{border:1px solid #e5e8ef;border-radius:14px;padding:.8rem .95rem;background:#fff;border-inline-start:4px solid #cfd6e2;min-width:0}.rh-card.st-open{border-inline-start-color:#0b8a83}.rh-card.st-accepted{border-inline-start-color:#c9a24b;background:#fffdf7}.rh-card.st-done{border-inline-start-color:#0f2a4e}.rh-card.st-expired,.rh-card.st-cancelled,.rh-card.st-reported{opacity:.72}.rh-card.focus{box-shadow:0 0 0 3px #c9a24b66}
.rh-top{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;font-size:.82rem}.rh-sector{background:#eef2f8;color:#0f2a4e;border-radius:999px;padding:.1rem .6rem;font-weight:700}.rh-circle,.rh-role{color:#6b7280;font-weight:700}.rh-status{margin-inline-start:auto;font-weight:700;color:#6b7280}.rh-status.open,.rh-status.now{color:#0b8a83}.rh-status.accepted{color:#9a7524}.rh-status.done{color:#0f2a4e}
.rh-text{font-size:1.06rem;line-height:1.8;margin:.45rem 0 .25rem;color:#111827}.rh-meta{margin:0;color:#475569;font-size:.9rem;line-height:1.7}.rh-acts{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.6rem;align-items:center}
.rh-notes{margin-top:.7rem;padding-top:.6rem;border-top:1px dashed #e5e8ef;display:grid;gap:.55rem}.rh-inl{display:flex;gap:.5rem;align-items:flex-end;flex-wrap:wrap}.rh-inl label{flex:1;display:grid;gap:.3rem;font-size:.86rem;font-weight:700;color:#334155;min-width:220px}.rh-inl.col{flex-direction:column;align-items:stretch}.rh-chk{display:flex;gap:.4rem;align-items:center;font-size:.85rem;color:#475569;font-weight:600}
.rh-done{margin:0;color:#0f2a4e;font-size:.92rem;line-height:1.7}.rh-from{margin:0;background:#fbf7ec;border-radius:10px;padding:.5rem .7rem;color:#6b4e16;line-height:1.7}
.rh-how{margin-top:.6rem;display:grid;gap:.4rem}.rh-chips{display:flex;gap:.4rem;flex-wrap:wrap}.rh-chips button{border:1px solid #cfd6e2;background:#fff;border-radius:999px;padding:.3rem .8rem;font:inherit;font-size:.88rem;cursor:pointer}.rh-chips button:hover{border-color:#0b8a83;color:#0b8a83}
.rh-foot{font-size:.85rem;line-height:1.8;margin-top:1rem}
.rh-room{margin:14px 0;background:#fff;border:1px solid rgba(15,42,78,.12);border-radius:16px;padding:14px 16px;display:grid;gap:10px}.rh-room h3{margin:0;display:flex;gap:6px;align-items:center;color:#0f2a4e}
.rh-roles{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.rh-rolecard{flex:1;min-width:160px;background:#f7f8fb;border:1px solid #e5e8ef;border-radius:12px;padding:8px 12px;display:grid;gap:2px}.rh-rolecard.me{background:#f0fdfa;border-color:#99f6e4}.rh-rolecard small{color:#64748b;font-size:.78rem}.rh-rolecard b{color:#0f2a4e;font-size:1rem}.rh-vs{font-size:1.3rem;color:#c9a24b;font-weight:900}
.rh-sit{margin:0;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px 12px;color:#78350f;line-height:1.8}.rh-room .danger{color:#b91c1c;border-color:#fecaca}
.rh-fromneed{margin-inline-start:.2rem}.rh-before{margin:.4rem 0 0;font-size:.9rem}.rh-before a{color:#0b8a83;font-weight:700;display:inline-flex;gap:.3rem;align-items:center}
.rh-progbox{margin:14px 0;background:#f0fdfa;border:1px solid #99f6e4;border-radius:14px;padding:12px 16px;display:grid;gap:6px}.rh-progbox h3{margin:0;color:#134e4a;display:flex;gap:6px;align-items:center}.rh-progbox p{margin:0;line-height:1.7;color:#134e4a}
.rh-learned{margin:28px 0;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 20px}.rh-learned h2{margin:0 0 6px;color:#0f2a4e}.rh-llead{margin:0 0 10px;line-height:1.8;color:#334155}.rh-line{margin:0 0 10px;color:#0b8a83;font-weight:700}
.rh-lgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.rh-lsec{background:#f7f8fb;border-radius:12px;padding:12px 14px;display:grid;gap:4px}.rh-lsec b{color:#0f2a4e}.rh-lsec small{color:#64748b}.rh-lsec ul{margin:6px 0 0;padding-inline-start:1rem;display:grid;gap:4px;line-height:1.7}.rh-more{margin:10px 0 0}
@media (max-width:640px){.rh-roles{flex-direction:column}.rh-vs{transform:rotate(90deg)}}
`;
