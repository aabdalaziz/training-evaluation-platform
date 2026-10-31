'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /me/onair — «أَثَر معك» في حسابي (P33)
 *  «أستقبل»: الصعود إلى الهواء (الوجه · ما أستقبله · مجالاتي · رابطي البديل · المدة) · ينطفئ وحده · نوافذي المعلنة · الصفّ مرتَّبًا (أول «أستقبل» يأخذه) ·
 *            ما أستقبله الآن (الخيط) · «تسليم الراية» · ساعاتي من اللقاءات الفعلية → «شهادة حضور على الهواء» ATH-OA.
 *  «طلباتي»: ما سألتُه وخيوطه · «ما الذي تغيّر؟».   ?r=<id> يفتح خيطًا مباشرة.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { Thread, openOnAir } from '../../components/OnAir';
import { fastToken } from '../../components/Pocket';
import { supabase } from '../../../lib/supabase/client';
import { GRADES, GRADE_LABEL, WEEKDAY_AR, ON_AIR_MINUTES, ON_AIR_MAX_MINUTES, MAX_WINDOWS, CERT_HOURS, CERT_MEETINGS } from '../../../lib/onair/registry';
import type { Grade } from '../../../lib/onair/registry';

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
type Tab = 'receive' | 'asks';

export default function MeOnAirPage() { return <PortalShell><Inner /></PortalShell>; }

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState('');
  const [tab, setTab] = useState<Tab>('receive'); const [thread, setThread] = useState<{ id: string | number; receiver: boolean } | null>(null);
  const [face, setFace] = useState(''); const [receives, setReceives] = useState<Grade[]>(['quick', 'session']); const [domains, setDomains] = useState(''); const [alt, setAlt] = useState(''); const [minutes, setMinutes] = useState(ON_AIR_MINUTES);
  const [win, setWin] = useState({ weekday: 0, from: '10:00', to: '11:00', note: '' }); const [colleagues, setColleagues] = useState<any[]>([]); const [hand, setHand] = useState<Record<string, string>>({});
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); }, [db]);
  const H = useCallback(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }), [tok]);
  const load = useCallback(async () => {
    if (!tok) return; const j = await fetch('/api/onair?mine=1', { headers: H(), cache: 'no-store' }).then(r => r.json()).catch(() => null);
    if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return; } setD(j);
    if (j.presence) { setFace(j.presence.face); setReceives(j.presence.receives || []); setDomains((j.presence.domains || []).join('، ')); setAlt(j.presence.alt_link || ''); } else if (j.faces?.length) setFace(f => f || j.faces[0].key);
    const n = await fetch('/api/onair?now=1', { headers: H(), cache: 'no-store' }).then(r => r.json()).catch(() => null); if (n?.success) setColleagues((n.present || []).filter((p: any) => p.user_id && p.user_id !== j.me.id));
  }, [tok, H]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!tok) return; const id = setInterval(load, 15000); return () => clearInterval(id); }, [tok, load]);
  useEffect(() => { const r = new URLSearchParams(window.location.search).get('r'); if (r && d) { const mine = (d.asks || []).find((x: any) => String(x.id) === r); const act = (d.active || []).find((x: any) => String(x.id) === r); if (mine) { setTab('asks'); setThread({ id: r, receiver: false }); } else if (act) { setTab('receive'); setThread({ id: r, receiver: true }); } } }, [d?.me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function post(body: any) {
    setBusy(body.action); setErr(''); setOk('');
    try { const j = await fetch('/api/onair', { method: 'POST', headers: H(), body: JSON.stringify(body) }).then(r => r.json()); if (!j.success) throw new Error(j.error || 'فشل'); if (j.note_ar) setOk(j.note_ar); await load(); return j; } catch (e: any) { setErr(e.message); return null; } finally { setBusy(''); }
  }
  const goOn = () => post({ action: 'presence', on: true, face, receives, domains: domains.split(/[،,]/).map(s => s.trim()).filter(Boolean), alt_link: alt, minutes });
  const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  if (tok === '') return <main className="pt-main oam"><style dangerouslySetInnerHTML={{ __html: CSS }} /><section className="pt-box"><p>{ar ? 'سجّل الدخول لتستقبل أو لترى طلباتك. ' : 'Sign in. '}<Link href="/login?next=/me/onair" className="pt-btn navy small">{ar ? 'تسجيل الدخول' : 'Sign in'}</Link></p></section></main>;
  if (!d) return <main className="pt-main oam"><style dangerouslySetInnerHTML={{ __html: CSS }} /><section className="pt-box"><p className="pt-muted">{err || '…'}</p></section></main>;
  const p = d.presence; const hours = d.hours; const queue: any[] = d.queue || []; const active: any[] = d.active || []; const asks: any[] = d.asks || []; const wins: any[] = d.windows || [];
  return <main className="pt-main oam" dir={ar ? 'rtl' : 'ltr'}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <header className="oam-h"><span className="pt-kicker"><Icon name="chat" size={14} /> {ar ? 'أَثَر معك — على الهواء' : 'Athar with you — on air'}</span><h1>{ar ? (p?.on_air ? `أنت على الهواء · ${p.minutes_left} د` : 'أَثَر معك') : 'Athar with you'}</h1>
      <p>{ar ? 'ترفع يدك ساعةً من يومك فتقول للبوابة كلها: «أنا هنا». تختار ما تستقبله ومجالك، وينطفئ الحضور وحده — ولا يُسأل أحد لماذا نزل.' : 'Raise your hand for an hour and tell the whole portal: “I am here.”'}</p>
      <nav className="oam-tabs" role="tablist">{([['receive', ar ? 'أستقبل' : 'Receive'], ['asks', ar ? `طلباتي (${asks.length})` : `My requests (${asks.length})`]] as [Tab, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setThread(null); }} data-testid={`oam-tab-${k}`}>{l}</button>)}<Link href="/on-air" className="pt-btn ghost small">{ar ? 'الصفحة العامة' : 'Public page'}</Link></nav>
      {err && <p className="oam-err" role="alert" data-testid="oam-err">{err}</p>}{ok && <p className="oam-ok" role="status" data-testid="oam-ok">{ok}</p>}
    </header>

    {tab === 'receive' && !thread && <>
      {!d.can_receive && <section className="pt-box" data-testid="oam-cannot"><h2>{ar ? 'من يصعد إلى الهواء؟' : 'Who goes on air?'}</h2><p className="pt-muted">{ar ? 'أعضاء هيئة أَثَر المعتمَدون (خبراء ومدرّبون)، وطاقم أَثَر، ومترجمو لغة الإشارة الذين اعتمدهم الطاقم. ابدأ بسيرتك في الهيئة — وعند اعتمادها يظهر زر «أستقبل» هنا.' : 'Approved Athar Faculty members, staff, and staff-approved interpreters.'}</p><p><Link href="/me/directory" className="pt-btn navy small">{ar ? 'سيرتي في هيئة أَثَر' : 'My Faculty profile'}</Link> <button type="button" className="pt-btn ghost small" onClick={() => openOnAir()}>{ar ? 'أريد أن أسأل بدلًا من ذلك' : 'I want to ask instead'}</button></p></section>}
      {d.can_receive && <section className={`pt-box oam-on ${p?.on_air ? 'live' : ''}`} data-testid="oam-presence">
        <h2>{p?.on_air ? (ar ? `على الهواء — ${p.minutes_left} دقيقة متبقية` : `On air — ${p.minutes_left} min left`) : (ar ? 'اصعد إلى الهواء' : 'Go on air')}</h2>
        {p?.grounded_at && <p className="oam-err" role="alert">{ar ? `أُنزلت من الهواء بقرار الطاقم: ${p.grounded_note || ''}` : 'Grounded by staff.'}</p>}
        <div className="oam-form">
          <label className="oam-f">{ar ? 'بأيّ وجه؟' : 'As whom?'}<select value={face} onChange={e => setFace(e.target.value)} data-testid="oam-face">{(d.faces || []).map((f: any) => <option key={f.key} value={f.key}>{f.ar}</option>)}</select></label>
          <fieldset className="oam-f oam-fs"><legend>{ar ? 'ما أستقبله' : 'What I receive'}</legend>{GRADES.filter(g => g !== 'consult').map(g => <label key={g}><input type="checkbox" checked={receives.includes(g)} onChange={e => setReceives(x => e.target.checked ? Array.from(new Set([...x, g])) : x.filter(y => y !== g))} data-testid={`oam-recv-${g}`} /> {GRADE_LABEL[g].ar}</label>)}</fieldset>
          <label className="oam-f">{ar ? 'مجالاتي (افصل بفاصلة)' : 'My domains (comma-separated)'}<input value={domains} onChange={e => setDomains(e.target.value)} placeholder={ar ? 'تقويم البرامج، التدريب التنفيذي…' : 'program evaluation, …'} data-testid="oam-domains" /></label>
          <label className="oam-f">{ar ? 'رابطي البديل للجلسات (اختياري — Teams/Zoom/Meet)' : 'My alternative link (optional)'}<input value={alt} onChange={e => setAlt(e.target.value)} placeholder="https://" dir="ltr" data-testid="oam-alt" /><small className="pt-muted">{ar ? 'إن تركته فارغًا تُفتح غرفة أَثَر تلقائيًا (ترجمة حيّة + مقعد مترجم).' : 'Leave empty to use an Athar room (live captions + interpreter seat).'}</small></label>
          <label className="oam-f">{ar ? 'كم دقيقة؟' : 'How long?'}<select value={minutes} onChange={e => setMinutes(Number(e.target.value))} data-testid="oam-minutes">{[30, 60, 90, 120, ON_AIR_MAX_MINUTES].map(m => <option key={m} value={m}>{m} {ar ? 'دقيقة' : 'min'}</option>)}</select></label>
        </div>
        <div className="oam-actions">
          <button type="button" className="pt-btn gold" disabled={!!busy || !receives.length} onClick={goOn} data-testid="oam-go">{p?.on_air ? (ar ? 'جدّد وحدّث' : 'Renew & update') : (ar ? 'أستقبل — اصعد إلى الهواء' : 'Receive — go on air')}</button>
          {p?.on_air && <button type="button" className="pt-btn ghost" disabled={!!busy} onClick={() => post({ action: 'off' })} data-testid="oam-off">{ar ? 'انزل من الهواء' : 'Go off air'}</button>}
        </div>
        <p className="pt-muted">{ar ? `ينطفئ وحده بعد المدة. ${p?.meta?.interpreter_ok ? 'أنت معتمَد مترجمًا — ' : ''}${p?.meta?.blocked_n ? `حجبتَ ${p.meta.blocked_n}.` : ''}` : 'Switches off by itself.'}</p>
      </section>}

      {d.can_receive && <section className="pt-box" data-testid="oam-queue"><h2>{ar ? `الصفّ (${queue.length})` : `Queue (${queue.length})`} <small className="pt-muted">{ar ? '— مرتَّب: مجالك أولًا ثم الأقدم؛ أول «أستقبل» يأخذه' : ''}</small></h2>
        {!p?.on_air && <p className="pt-muted">{ar ? 'الصفّ يظهر لمن على الهواء.' : 'The queue shows while on air.'}</p>}
        {p?.on_air && !queue.length && <p className="pt-muted">{ar ? 'لا طلبات الآن — وجودك وحده رسالة.' : 'No requests right now.'}</p>}
        <ul className="oam-list">{p?.on_air && queue.map(r => <li key={r.id} data-testid="oam-q"><div><b>{r.kind_ar}</b> · <small>{r.asker_alias}{r.domain ? ` · ${r.domain}` : ''} · {fmt(r.created_at)}{r.interpreter_wanted ? ' · يطلب مترجم إشارة' : ''}</small><p>{r.text_ar}</p></div>
          <div className="oam-actions"><button type="button" className="pt-btn gold small" disabled={!!busy} onClick={async () => { const j = await post({ action: 'take', id: r.id }); if (j) setThread({ id: r.id, receiver: true }); }} data-testid="oam-take">{ar ? 'أستقبل' : 'Take'}</button>{r.asker_user_id && <button type="button" className="pt-btn ghost small" disabled={!!busy} onClick={() => post({ action: 'block', user_id: r.asker_user_id })}>{ar ? 'احجب' : 'Block'}</button>}</div></li>)}</ul>
      </section>}

      {active.length > 0 && <section className="pt-box" data-testid="oam-active"><h2>{ar ? `معي الآن (${active.length})` : `With me now (${active.length})`}</h2>
        <ul className="oam-list">{active.map(r => <li key={r.id}><div><b>{r.kind_ar}</b> · <small>{r.asker_alias} · {r.status_ar}{r.room_code ? ` · غرفة ${r.room_code}` : ''}</small><p>{r.text_ar}</p></div>
          <div className="oam-actions"><button type="button" className="pt-btn navy small" onClick={() => setThread({ id: r.id, receiver: true })} data-testid="oam-open">{ar ? 'افتح الخيط' : 'Open thread'}</button>
            {colleagues.filter(c => (c.receives || []).includes(r.kind)).length > 0 && <span className="oam-hand"><select aria-label={ar ? 'سلّم الراية إلى' : 'Hand over to'} value={hand[r.id] || ''} onChange={e => setHand(h => ({ ...h, [r.id]: e.target.value }))} data-testid="oam-hand-sel"><option value="">{ar ? 'تسليم الراية إلى…' : 'Hand over to…'}</option>{colleagues.filter(c => (c.receives || []).includes(r.kind)).map(c => <option key={c.user_id} value={c.user_id}>{c.name_ar} · {c.face_ar}</option>)}</select><button type="button" className="pt-btn ghost small" disabled={!hand[r.id] || !!busy} onClick={() => post({ action: 'handover', id: r.id, to: hand[r.id] })} data-testid="oam-hand">{ar ? 'سلّم' : 'Hand over'}</button></span>}
          </div></li>)}</ul>
      </section>}

      {d.can_receive && <section className="pt-box" data-testid="oam-windows"><h2>{ar ? 'نوافذي المعلنة' : 'My announced windows'} <small className="pt-muted">{ar ? `— حتى ${MAX_WINDOWS}؛ تظهر للجميع في /on-air وتذكّرك البوابة قبلها` : ''}</small></h2>
        <ul className="oam-wins">{wins.map(w => <li key={w.id}><b>{w.weekday_ar} {w.from}–{w.to}</b>{w.note_ar ? <small> · {w.note_ar}</small> : null} <button type="button" className="pt-btn ghost small" onClick={() => post({ action: 'window_remove', id: w.id })} aria-label={ar ? 'احذف النافذة' : 'Remove'}>✕</button></li>)}</ul>
        {wins.length < MAX_WINDOWS && <form className="oam-win" onSubmit={e => { e.preventDefault(); post({ action: 'window_add', weekday: win.weekday, from_min: toMin(win.from), to_min: toMin(win.to), note_ar: win.note }); }}>
          <label>{ar ? 'اليوم' : 'Day'}<select value={win.weekday} onChange={e => setWin(w => ({ ...w, weekday: Number(e.target.value) }))} data-testid="oam-win-day">{WEEKDAY_AR.map((n, i) => <option key={i} value={i}>{n}</option>)}</select></label>
          <label>{ar ? 'من' : 'From'}<input type="time" value={win.from} onChange={e => setWin(w => ({ ...w, from: e.target.value }))} data-testid="oam-win-from" /></label>
          <label>{ar ? 'إلى' : 'To'}<input type="time" value={win.to} onChange={e => setWin(w => ({ ...w, to: e.target.value }))} data-testid="oam-win-to" /></label>
          <label>{ar ? 'ملاحظة' : 'Note'}<input value={win.note} onChange={e => setWin(w => ({ ...w, note: e.target.value.slice(0, 120) }))} placeholder={ar ? 'مثل: أسئلة تقويم البرامج' : ''} /></label>
          <button type="submit" className="pt-btn navy small" disabled={!!busy} data-testid="oam-win-add">{ar ? 'أعلن النافذة' : 'Announce'}</button>
        </form>}
      </section>}

      {d.can_receive && hours && <section className="pt-box" data-testid="oam-hours"><h2>{ar ? 'ساعاتي على الهواء' : 'My on-air hours'}</h2>
        <div className="oam-kpis"><span><b>{hours.meetings}</b>{ar ? 'لقاءً اكتمل' : 'meetings'}</span><span><b>{hours.hours}</b>{ar ? 'ساعة' : 'hours'}</span><span><b>{hours.by_kind?.quick || 0}</b>{ar ? 'عونٌ سريع' : 'quick'}</span><span><b>{hours.by_kind?.session || 0}</b>{ar ? 'جلسة دعم' : 'sessions'}</span></div>
        <p className="pt-muted">{ar ? `تُحسب من اللقاءات الفعلية لا من وقت الحضور. عند ${CERT_HOURS} ساعات و${CERT_MEETINGS} لقاءات تصدر «شهادة حضور على الهواء» موقَّعة (ATH-OA) وتظهر في «ما شهده أَثَر» على سيرتك.` : `Counted from real meetings. ${CERT_HOURS} h and ${CERT_MEETINGS} meetings earn a signed certificate.`}</p>
        {d.cert && <p className="oam-ok" data-testid="oam-cert">{ar ? 'شهادتك:' : 'Your certificate:'} <code>{d.cert.code}</code> · <a href={d.cert.verify_url}>{ar ? 'تحقّق' : 'Verify'}</a> · {fmt(d.cert.issued_at)}</p>}
        {hours.eligible && <button type="button" className="pt-btn gold small" disabled={!!busy} onClick={() => post({ action: 'cert' })} data-testid="oam-cert-btn">{d.cert ? (ar ? 'جدّد الشهادة بساعاتي الحالية' : 'Renew with current hours') : (ar ? 'أصدر شهادتي' : 'Issue my certificate')}</button>}
        {!hours.eligible && <p className="pt-muted" data-testid="oam-cert-gap">{ar ? `بقي ${Math.max(0, CERT_HOURS - hours.hours).toFixed(1)} ساعة و${Math.max(0, CERT_MEETINGS - hours.meetings)} لقاءً.` : 'Not yet eligible.'}</p>}
      </section>}
    </>}

    {tab === 'asks' && !thread && <section className="pt-box" data-testid="oam-asks"><h2>{ar ? 'طلباتي' : 'My requests'}</h2>
      {!asks.length && <p className="pt-muted">{ar ? 'لم تسأل بعد. ' : 'Nothing yet. '}<button type="button" className="pt-btn gold small" onClick={() => openOnAir()} data-testid="oam-ask-now">{ar ? 'اسأل الآن' : 'Ask now'}</button></p>}
      <ul className="oam-list">{asks.map(r => <li key={r.id} data-testid="oam-ask"><div><b>{r.kind_ar}</b> · <span className={`oam-st ${r.status}`}>{r.status_ar}</span> · <small>{fmt(r.created_at)}{r.receiver ? ` · مع ${r.receiver.name_ar}` : ''}</small><p>{r.text_ar}</p></div><div className="oam-actions"><button type="button" className="pt-btn navy small" onClick={() => setThread({ id: r.id, receiver: false })} data-testid="oam-ask-open">{ar ? 'افتح' : 'Open'}</button></div></li>)}</ul>
    </section>}

    {thread && <section className="pt-box"><Thread id={thread.id} t="" lang={lang} receiver={thread.receiver} onBack={() => { setThread(null); load(); }} /></section>}
  </main>;
}

const CSS = `
.oam{max-width:960px;margin:0 auto;padding:28px 18px 60px}.oam-h h1{margin:6px 0 8px;font-size:30px;color:#0f2a4e}.oam-h p{color:#334155;line-height:1.9;margin:0 0 12px;font-size:16px}
.oam-tabs{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px}.oam-tabs button{border:1.5px solid #cbd5e1;background:#fff;border-radius:999px;padding:8px 16px;font:inherit;font-weight:800;cursor:pointer;color:#0f2a4e;min-height:44px}.oam-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.oam-err{color:#b91c1c;font-weight:800;margin:6px 0}.oam-ok{color:#0b6f69;font-weight:800;margin:6px 0}
.oam .pt-box{margin-bottom:16px}.oam h2{font-size:19px;color:#0f2a4e;margin:0 0 10px}.oam h2 small{font-size:13px;font-weight:400}
.oam-on.live{border:2px solid #b45309;background:#fffdf7}
.oam-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.oam-f{display:block;font-weight:800;color:#0f2a4e}.oam-f input,.oam-f select{display:block;width:100%;margin-top:6px;border:1.5px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-weight:400;min-height:44px;background:#fff}.oam-f small{font-weight:400;display:block;margin-top:4px}
.oam-fs{border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 12px;margin:0}.oam-fs legend{padding:0 6px}.oam-fs label{display:inline-flex;align-items:center;gap:6px;margin-inline-end:14px;font-weight:400;min-height:36px}.oam-fs input{width:20px;height:20px;accent-color:#0b6f69}
.oam-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;align-items:center}
.oam-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}.oam-list li{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:center}.oam-list li>div:first-child{flex:1;min-width:240px}.oam-list b{color:#0f2a4e}.oam-list small{color:#475569}.oam-list p{margin:4px 0 0;color:#334155;line-height:1.7}
.oam-st{font-weight:800;color:#0f2a4e}.oam-st.open{color:#92400e}.oam-st.taken{color:#0b6f69}.oam-st.expired,.oam-st.cancelled{color:#b91c1c}
.oam-hand{display:inline-flex;gap:6px;align-items:center}.oam-hand select{border:1.5px solid #cbd5e1;border-radius:10px;padding:8px;font:inherit;min-height:40px;background:#fff;max-width:240px}
.oam-wins{list-style:none;margin:0 0 10px;padding:0;display:grid;gap:6px}.oam-wins li{display:flex;gap:8px;align-items:center;color:#334155}.oam-wins small{color:#475569}
.oam-win{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;align-items:end}.oam-win label{font-weight:800;color:#0f2a4e;font-size:13px}.oam-win input,.oam-win select{display:block;width:100%;margin-top:4px;border:1.5px solid #cbd5e1;border-radius:10px;padding:9px;font:inherit;font-weight:400;min-height:44px;background:#fff}
.oam-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:0 0 10px}.oam-kpis span{background:#f8fafc;border-radius:12px;padding:10px 12px;color:#334155;display:flex;flex-direction:column;font-size:13px}.oam-kpis b{font-size:22px;color:#0f2a4e}
`;
