'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P52 «رسالة الشهر» — مكتب التوقيع: المسوَّدات (الأقدم أولًا) · الجهات المؤهَّلة بلا مسوَّدة · الموقَّعة حديثًا وردود الجهات
 *  المحرّر: معاينة الرسالة كما ستصل + «سطر الإنسان» (≤ 280) + «وعد الشهر القادم» (قائمة أو حرّ) + «ما نحتاجه منكم» + صفة الموقِّع → تأكيد → «وقّع وأرسل»
 *  testids: ol-root ol-drafts ol-draft[data-id] ol-missing ol-missing-row[data-org] ol-make ol-signed ol-signed-row[data-id] ol-editor ol-line ol-promise ol-promise-free ol-ask ol-title ol-sign ol-ok ol-err ol-reply-badge ol-open
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabase/client';
import { Icon } from '../../../../lib/ui/icons';
import WayBar from '../../../components/WayBar';
import { LetterSheet, type LetterView } from '../../../components/LetterSheet';
import { SIGN_EVENT } from '../../../components/SignCounter';

type Letter = LetterView & { id: string; organization_id: string; created_at: string; reply_seen_at?: string | null };
type Data = { target_month: string; drafts: Letter[]; signed: Letter[]; missing: { id: string; name_ar: string; members: number }[]; promises: { key: string; text_ar: string }[]; line_max: number; writer: boolean; unread_replies: number };
const monthAr = (m: string) => { const [y, mo] = m.split('-').map(Number); return `${['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'][mo - 1]} ${y}`; };
const ago = (iso: string) => { const d = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86400000)); return d === 0 ? 'اليوم' : d === 1 ? 'منذ يوم' : d === 2 ? 'منذ يومين' : d <= 10 ? `منذ ${d} أيام` : `منذ ${d} يومًا`; };

export default function LettersDesk() {
  const router = useRouter(); const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState<{ code: number; msg: string } | null>(null); const [ok, setOk] = useState(''); const [busy, setBusy] = useState('');
  const [cur, setCur] = useState<Letter | null>(null); const [line, setLine] = useState(''); const [pk, setPk] = useState(''); const [pfree, setPfree] = useState(''); const [ask, setAsk] = useState(''); const [title, setTitle] = useState('مدير البرامج');
  const hdr = useCallback(async () => { const { data } = await supabase().auth.getSession(); const tk = data.session?.access_token; if (!tk) { router.replace('/login?next=/admin/org/letters'); return null; } return { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' }; }, [router]);
  const load = useCallback(async () => { const H = await hdr(); if (!H) return; const r = await fetch('/api/admin/org/letters', { headers: H, cache: 'no-store' }); const j = await r.json().catch(() => ({})); if (!r.ok || !j.success) { setErr({ code: r.status, msg: j.error || 'تعذّر التحميل' }); return; } setErr(null); setD(j);
    const want = new URLSearchParams(window.location.search).get('id'); if (want) { const f = [...j.drafts, ...j.signed].find((x: Letter) => x.id === want); if (f) open(f, j); } }, [hdr]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  function open(l: Letter, data?: Data) { setCur(l); setOk(''); setLine(l.line_ar || ''); setPk(''); setPfree(l.promise_ar || ''); setAsk(l.ask_ar ?? l.body.ask_suggested_ar ?? ''); const dd = data || d; if (dd && !l.promise_ar) { setPk(dd.promises[0]?.key || ''); setPfree(''); }
    if (l.status === 'signed' && l.reply_at && !l.reply_seen_at) { void (async () => { const H = await hdr(); if (!H) return; await fetch('/api/admin/org/letters', { method: 'POST', headers: H, body: JSON.stringify({ action: 'seen_reply', id: l.id }) }); })(); }
    setTimeout(() => document.getElementById('ol-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }
  const promiseText = () => (pk ? (d?.promises.find((p) => p.key === pk)?.text_ar || '') : pfree.trim());
  async function make(orgId: string, month?: string) { setBusy(`make:${orgId}`); setOk(''); const H = await hdr(); if (!H) return; const r = await fetch('/api/admin/org/letters', { method: 'POST', headers: H, body: JSON.stringify({ action: 'draft', org_id: orgId, month }) }); const j = await r.json().catch(() => ({})); setBusy(''); if (!r.ok || !j.success) { setErr({ code: r.status, msg: j.error || 'تعذّر الإنشاء' }); return; } setOk(j.refreshed ? 'حُدّثت أرقام المسوَّدة' : 'أُنشئت المسوَّدة — تنتظر سطرك'); await load(); if (j.letter) open(j.letter); }
  async function sign() {
    if (!cur || busy) return; const p = promiseText(); if (line.trim().length < 10) { setErr({ code: 400, msg: 'اكتب سطر الإنسان (10 أحرف على الأقل)' }); return; } if (!p) { setErr({ code: 400, msg: 'اختر وعد الشهر القادم أو اكتبه' }); return; }
    if (!window.confirm(`توقيع رسالة ${monthAr(cur.month)} لـ«${cur.body.org.name_ar}» وإرسالها إلى مديري الجهة؟ بعد التوقيع تُجمَّد ولا تُعدَّل.`)) return;
    setBusy('sign'); setOk(''); const H = await hdr(); if (!H) return; const r = await fetch('/api/admin/org/letters', { method: 'POST', headers: H, body: JSON.stringify({ action: 'sign', id: cur.id, line_ar: line, promise_ar: p, ask_ar: ask, signed_title: title }) }); const j = await r.json().catch(() => ({})); setBusy('');
    if (!r.ok || !j.success) { setErr({ code: r.status, msg: j.error || 'تعذّر التوقيع' }); return; } setErr(null); setOk(j.message || 'وُقِّعت'); setCur(j.letter); await load(); window.dispatchEvent(new CustomEvent(SIGN_EVENT, { detail: {} }));
  }
  return <div className="ol" dir="rtl" data-testid="ol-root" data-drafts={d?.drafts.length ?? ''}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="ol-wrap">
      <WayBar lang="ar" />
      <header className="ol-head"><div><span className="ol-kicker"><Icon name="mail" size={14} /> بوابة أَثَر · P52 · التقرير الشهري لأثر الجهة</span><h1>رسالة الشهر <small>للجهات</small></h1>
        <p className="ol-lead">ثلاثة أرقام تُصاغ آليًّا من الواقع، وخيوط الشهر بلا أسماء — ثم <b>سطر تكتبه أنت</b>، ووعد للشهر القادم، وتوقيعك. بلا توقيع لا تصل الرسالة.</p></div>
        <div className="ol-acts"><Link href="/admin/sign" className="ol-btn ghost"><Icon name="check" size={14} /> توقيعي</Link><button type="button" className="ol-btn ghost" onClick={() => void load()}><Icon name="refresh" size={14} /> تحديث</button></div></header>
      {err && <p className="ol-msg" role="alert" data-testid="ol-err">{err.code === 403 ? 'هذه الصفحة للطاقم — والتوقيع لمدير البرامج فأعلى.' : err.msg}</p>}
      {ok && <p className="ol-ok" role="status" data-testid="ol-ok">{ok}</p>}
      {d && <>
        <section className="ol-box" data-testid="ol-drafts"><h2>مسوَّدات تنتظر سطرك وتوقيعك <small>{d.drafts.length}</small></h2>
          {d.drafts.length === 0 && <p className="ol-muted">لا مسوَّدات — الكرون ينشئها في اليوم الثالث من كل شهر عن الشهر المنصرم، أو أنشئها الآن من القائمة أدناه.</p>}
          <ul className="ol-list">{d.drafts.map((l) => <li key={l.id} data-testid="ol-draft" data-id={l.id} className={cur?.id === l.id ? 'on' : ''}>
            <div><b>{l.body.org.name_ar}</b> · {monthAr(l.month)} <small>{ago(l.created_at)}</small><p className="ol-muted">{l.body.lines_ar[0]}</p></div>
            <button type="button" className="ol-btn sm" onClick={() => open(l)} data-testid="ol-open">افتح واكتب سطرك</button></li>)}</ul></section>
        {d.missing.length > 0 && <section className="ol-box" data-testid="ol-missing"><h2>جهات مؤهَّلة بلا رسالة عن {monthAr(d.target_month)} <small>{d.missing.length}</small></h2>
          <ul className="ol-list">{d.missing.map((o) => <li key={o.id} data-testid="ol-missing-row" data-org={o.id}><div><b>{o.name_ar}</b> <small>{o.members} منسوبًا مؤكَّدًا</small></div>{d.writer && <button type="button" className="ol-btn sm ghost" disabled={busy === `make:${o.id}`} onClick={() => void make(o.id)} data-testid="ol-make">أنشئ المسوَّدة الآن</button>}</li>)}</ul></section>}
        {cur && <section className="ol-box ol-editor" id="ol-editor" data-testid="ol-editor">
          <h2>{cur.status === 'signed' ? 'رسالة موقَّعة' : 'اكتب سطرك ووقّع'} — {cur.body.org.name_ar} · {monthAr(cur.month)}</h2>
          <div className="ol-grid">
            <div className="ol-form">
              {cur.status === 'draft' && d.writer && <>
                <label>سطر الإنسان <small>{line.length}/{d.line_max}</small><textarea value={line} onChange={(e) => setLine(e.target.value.slice(0, d.line_max))} rows={3} placeholder="جملة واحدة منك إلى الجهة — عمّا رأيته هذا الشهر، بلا أسماء." data-testid="ol-line" /></label>
                <fieldset><legend>وعد الشهر القادم</legend>{d.promises.map((p) => <label key={p.key} className="ol-radio"><input type="radio" name="promise" checked={pk === p.key} onChange={() => { setPk(p.key); setPfree(''); }} data-testid="ol-promise" /> {p.text_ar}</label>)}
                  <label className="ol-radio"><input type="radio" name="promise" checked={pk === ''} onChange={() => setPk('')} /> وعد آخر:</label><input type="text" value={pfree} onChange={(e) => { setPfree(e.target.value.slice(0, 200)); setPk(''); }} placeholder="اكتب وعدًا واحدًا قابلًا للوفاء" data-testid="ol-promise-free" /></fieldset>
                <label>ما نحتاجه منكم <small>اختياري</small><input type="text" value={ask} onChange={(e) => setAsk(e.target.value.slice(0, 200))} data-testid="ol-ask" /></label>
                <label>صفة الموقِّع<input type="text" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} data-testid="ol-title" /></label>
                <div className="ol-acts"><button type="button" className="ol-btn" onClick={() => void sign()} disabled={busy === 'sign'} data-testid="ol-sign"><Icon name="send" size={14} /> {busy === 'sign' ? '…' : 'وقّع وأرسل'}</button><button type="button" className="ol-btn ghost" onClick={() => void make(cur.organization_id, cur.month)} disabled={!!busy}>حدّث الأرقام</button><button type="button" className="ol-btn ghost" onClick={() => setCur(null)}>إغلاق</button></div>
              </>}
              {cur.status === 'draft' && !d.writer && <p className="ol-muted">تستطيع معاينة المسوَّدة؛ التوقيع لمدير البرامج فأعلى.</p>}
              {cur.status === 'signed' && <div className="ol-acts"><button type="button" className="ol-btn ghost" onClick={() => window.print()}><Icon name="print" size={14} /> اطبع</button><button type="button" className="ol-btn ghost" onClick={() => setCur(null)}>إغلاق</button></div>}
            </div>
            <div className="ol-preview"><LetterSheet l={cur} draftLine={line} draftPromise={promiseText()} draftAsk={ask} /></div>
          </div></section>}
        <section className="ol-box" data-testid="ol-signed"><h2>موقَّعة حديثًا <small>{d.signed.length}</small>{d.unread_replies > 0 && <em className="ol-badge" data-testid="ol-reply-badge">{d.unread_replies} ردّ جديد</em>}</h2>
          {d.signed.length === 0 && <p className="ol-muted">لا رسائل موقَّعة بعد.</p>}
          <ul className="ol-list">{d.signed.map((l) => <li key={l.id} data-testid="ol-signed-row" data-id={l.id}><div><b>{l.body.org.name_ar}</b> · {monthAr(l.month)} <small>{l.signed_name} · {l.code}</small>{l.reply_ar && <p className="ol-reply">💌 «{l.reply_ar}» — {l.reply_by}</p>}</div><button type="button" className="ol-btn sm ghost" onClick={() => open(l)}>افتح</button></li>)}</ul></section>
        <p className="ol-foot ol-muted">لا أسماء منسوبين في أي رسالة · ما دون خمسة لا يُذكر رقمًا · الرسالة الموقَّعة تُجمَّد وتُحسب بصمتها · © 2026 أَثَر.</p>
      </>}
    </div>
  </div>;
}

const CSS = `
.ol{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f2a4e}.ol :is(button,a,input,textarea):focus-visible{outline:3px solid #0f2a4e;outline-offset:2px}
.ol-wrap{max-width:1100px;margin:0 auto;display:grid;gap:12px}.ol-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}.ol-kicker{color:#b45309;font-weight:800;font-size:12.5px;display:inline-flex;gap:6px;align-items:center}.ol h1{margin:4px 0;font-size:26px}.ol h1 small{font-size:14px;color:#64748b;font-weight:600}.ol-lead{margin:0;color:#334155;max-width:720px}
.ol-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.ol-btn{display:inline-flex;align-items:center;gap:6px;background:#0f2a4e;color:#fff;border:1.5px solid #0f2a4e;border-radius:10px;padding:9px 14px;font:inherit;font-weight:800;cursor:pointer;text-decoration:none;min-height:38px}.ol-btn.ghost{background:#fff;color:#0f2a4e}.ol-btn.sm{padding:6px 10px;font-size:13px;min-height:32px}.ol-btn:disabled{opacity:.6;cursor:wait}
.ol-box{background:#fff;border:1px solid #e5e9f0;border-radius:16px;padding:16px}.ol-box h2{margin:0 0 10px;font-size:18px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ol-box h2 small{background:#eef2f7;border-radius:999px;padding:2px 10px;font-size:12.5px;font-weight:800}.ol-badge{background:#ecfdf5;color:#047857;border-radius:999px;padding:2px 10px;font-size:12.5px;font-style:normal;font-weight:800}
.ol-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}.ol-list li{display:flex;justify-content:space-between;gap:10px;align-items:center;border:1px solid #eef2f7;border-radius:12px;padding:10px 12px}.ol-list li.on{border-color:#c9a24b;background:#fffbeb}.ol-list small{color:#64748b;margin-inline-start:6px}.ol-list p{margin:2px 0 0;font-size:13px}.ol-muted{color:#64748b}.ol-reply{color:#047857}
.ol-grid{display:grid;grid-template-columns:minmax(300px,420px) 1fr;gap:16px;align-items:start}.ol-form{display:grid;gap:10px}.ol-form label{display:grid;gap:4px;font-weight:800;font-size:14px}.ol-form label small{font-weight:400;color:#64748b}.ol-form textarea,.ol-form input[type=text]{border:1.5px solid #cbd5e1;border-radius:10px;padding:9px 10px;font:inherit;font-weight:400;width:100%;box-sizing:border-box}
.ol-form fieldset{border:1px solid #e5e9f0;border-radius:12px;padding:8px 12px;display:grid;gap:6px}.ol-form legend{font-weight:800;font-size:14px;padding:0 6px}.ol-radio{display:flex!important;gap:8px;align-items:flex-start;font-weight:400!important;font-size:13.5px}
.ol-msg{background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin:0}.ol-ok{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px;margin:0}.ol-foot{font-size:12.5px;margin:4px 0 0}
@media (max-width:860px){.ol-grid{grid-template-columns:1fr}.ol h1{font-size:22px}}
@media print{.ol{padding:0;background:#fff}.ol-head,.ol-acts,.ol-form,.wb,.ol-drafts,.ol-box:not(.ol-editor),.ol-foot,nav,header.pt-header{display:none!important}.ol-editor{border:none;padding:0}.ol-editor h2{display:none}}
`;
