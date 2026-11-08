'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P68-ب «مكتب النموذج» — لوحة النموذج المثبَّت داخل بطاقة الدعوة (/admin/miaar/invites)
 *  لا نموذج: حالة القفل + «ثبّت النموذج» · نموذج: الرأس (الرمز · الإصدار · القفل) · «ميزان النموذج» ★1 · نسخة المشرف بالنصوص والإجابة الصحيحة معلَّمة
 *  · بدّل بندًا (بدائل من الخليّة نفسها + سبب) · اسحب نموذجًا جديدًا · ألغِ التثبيت (سبب إلزامي) · طباعة نسخة المشرف · «نسخة المراقب» ★4 · «أثر الورقة» ★3 · الإصدارات
 *  النصوص تُعرض هنا فقط (API الطاقم) — لا تُنسخ لصفحات عامة.
 */
import { useEffect, useState } from 'react';
import { qrSvg } from '../../../lib/certificates/qr';

type H = () => Promise<Record<string, string>>;
type Item = { code: string; level: string; skill: string; skill_ar: string; no: number; text?: string; options?: Array<{ id: string; text: string; correct: boolean }>; descriptor?: string | null; passage?: { title: string; text: string } | null; units?: string[] };
type Preview = { form: { id: string; code: string; version: number; status: string; frozen_at: string | null; withdrawn_at: string | null; withdraw_reason: string | null; changes: any[]; plan_name_ar: string; plan_code: string; duration_minutes: number | null }; invite: { id: string; code: string; label_ar: string } | null; lock: { locked: boolean; sessions: number; finished: number }; items: Item[]; balance: { cells: Array<{ level: string; skill_ar: string; need: number; have: number; ok: boolean }>; units: { approved: number; covered: number; missing: string[] } | null; seen_recent: number; descriptors: number; tone: 'ok' | 'warn'; notes_ar: string[] } | null; versions: Array<{ id: string; version: number; status: string; created_at: string }>; note_ar: string };
const fmt = (iso?: string | null) => { if (!iso) return '—'; try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch { return iso; } };
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const STATUS_AR: Record<string, string> = { frozen: 'مثبَّت', superseded: 'إصدار قديم', withdrawn: 'مسحوب' };

export default function FormDesk({ invite, auth, onChanged }: { invite: any; auth: H; onChanged?: () => void }) {
  const [p, setP] = useState<Preview | null>(null); const [lock, setLock] = useState<{ locked: boolean; sessions: number } | null>(null); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const [tab, setTab] = useState<'items' | 'perf' | 'versions'>('items'); const [swap, setSwap] = useState<{ code: string; alts: any[]; to: string; reason: string } | null>(null); const [reason, setReason] = useState(''); const [perf, setPerf] = useState<any>(null);
  async function load() { setErr(''); const j = await fetch(`/api/admin/miaar/frozen?invite=${encodeURIComponent(invite.id)}`, { headers: await auth(), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return; } setP(j.form || null); setLock(j.lock || j.form?.lock || null); }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [invite?.id]);
  async function post(body: any) { setBusy(body.action); setErr(''); setMsg(''); try { const j = await fetch('/api/admin/miaar/frozen', { method: 'POST', headers: await auth(), body: JSON.stringify(body) }).then((r) => r.json()); if (!j?.success) { setErr(j?.error || 'تعذّر التنفيذ'); return null; } setMsg(j.note_ar || 'تم'); if (j.form) setP(j.form); else await load(); onChanged?.(); return j; } finally { setBusy(''); } }
  async function openSwap(code: string) { if (!p) return; setSwap({ code, alts: [], to: '', reason: '' }); const j = await fetch(`/api/admin/miaar/frozen?alternatives=${encodeURIComponent(p.form.id)}&item=${encodeURIComponent(code)}`, { headers: await auth(), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.success) { setErr(j?.error || 'تعذّر جلب البدائل'); setSwap(null); return; } setSwap({ code, alts: j.alternatives || [], to: '', reason: '' }); }
  async function loadPerf() { if (!p) return; setTab('perf'); const j = await fetch(`/api/admin/miaar/frozen?performance=${encodeURIComponent(p.form.id)}`, { headers: await auth(), cache: 'no-store' }).then((r) => r.json()).catch(() => null); setPerf(j?.performance || { ok: false, reason: j?.error || 'تعذّر الحساب', items: [] }); }
  function printSupervisor() {
    if (!p) return; const w = window.open('', '_blank', 'width=820,height=1000'); if (!w) return;
    const rows = p.items.map((it) => `<li><b>${it.no}.</b> <small>${esc(it.level)} · ${esc(it.skill_ar)}${it.descriptor ? ` · ${esc(it.descriptor)}` : ''} · <code>${esc(it.code)}</code></small>${it.passage ? `<div class="ps"><b>${esc(it.passage.title)}</b><br>${esc(it.passage.text).slice(0, 600)}</div>` : ''}<p>${esc(it.text || '')}</p><ol class="op">${(it.options || []).map((o) => `<li class="${o.correct ? 'ok' : ''}">${esc(o.text)}${o.correct ? ' ✓' : ''}</li>`).join('')}</ol></li>`).join('');
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>نسخة المشرف — ${esc(p.form.code)}</title><style>body{font-family:system-ui,'Segoe UI',Tahoma,sans-serif;margin:24px;color:#0f172a}h1{font-size:20px;margin:0}small{color:#475569}ul{padding:0;list-style:none}li>p{margin:4px 0}ol.op{margin:0 0 10px;padding-inline-start:22px}ol.op li.ok{font-weight:800;color:#047857}.ps{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px;margin:4px 0;font-size:13px}.hd{border-bottom:2px solid #0f2a4e;padding-bottom:8px;margin-bottom:12px}.wm{position:fixed;inset:auto 12px 12px auto;font-size:11px;color:#94a3b8}@media print{.wm{position:fixed}}</style></head><body><div class="hd"><h1>نسخة المشرف — ${esc(p.form.plan_name_ar)}</h1><small>الدعوة: ${esc(p.invite?.label_ar || '')} (${esc(p.invite?.code || '')}) · النموذج <b dir="ltr">${esc(p.form.code)}</b> v${p.form.version} · ${p.items.length} بندًا${p.form.duration_minutes ? ` · ${p.form.duration_minutes} دقيقة` : ''} · ثُبِّت ${esc(fmt(p.form.frozen_at))}</small><br><small style="color:#b91c1c">سرّي — للطاقم فقط: تحوي الإجابات الصحيحة. لا تُسلَّم للمتقدّم ولا تُنشر.</small></div><ul>${rows}</ul><div class="wm">مِعيار — من أَثَر · © 2026</div><script>setTimeout(()=>window.print(),300)</script></body></html>`); w.document.close();
  }
  async function printSheet() {
    if (!p) return; const j = await fetch(`/api/admin/miaar/frozen?sheet=${encodeURIComponent(p.form.id)}`, { headers: await auth(), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.success) { setErr(j?.error || 'تعذّر تجهيز نسخة المراقب'); return; }
    const s = j.sheet; const w = window.open('', '_blank', 'width=820,height=1000'); if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>نسخة المراقب — ${esc(s.form_code)}</title><style>body{font-family:system-ui,'Segoe UI',Tahoma,sans-serif;margin:28px;color:#0f172a}h1{font-size:22px;margin:0 0 4px}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border:1px solid #cbd5e1;padding:8px 10px;text-align:right}th{background:#f1f5f9;width:34%}.qr{display:flex;gap:18px;align-items:center;margin:14px 0}.box{border:1px dashed #94a3b8;border-radius:10px;padding:10px 14px;margin-top:14px}.box div{height:28px;border-bottom:1px solid #cbd5e1;margin-top:6px}small{color:#475569}</style></head><body><h1>نسخة المراقب — ${esc(s.invite_label)}</h1><small>مِعيار — من أَثَر · ورقة القاعة بلا أسئلة · تُطبع مع بطاقة الدعوة</small><table><tr><th>رمز الدعوة</th><td dir="ltr">${esc(s.invite_code)}</td></tr><tr><th>رمز النموذج المثبَّت</th><td dir="ltr">${esc(s.form_code)} v${s.version}</td></tr><tr><th>عدد البنود</th><td>${s.n} — ${s.cells.map((c: any) => `${esc(c.level)} ${esc(c.skill_ar)} ${c.n}`).join(' · ')}</td></tr><tr><th>المدّة</th><td>${s.duration_minutes ? `${s.duration_minutes} دقيقة` : '—'}</td></tr><tr><th>ثُبِّت في</th><td>${esc(fmt(s.frozen_at))}</td></tr><tr><th>بصمة الورقة</th><td dir="ltr" style="font-size:11px;word-break:break-all">${esc(s.digest || '')}</td></tr></table><div class="qr">${qrSvg(s.invite_url, 150, 'M', '#0f2a4e')}<div><b>رابط الدخول</b><br><span dir="ltr">${esc(s.invite_url)}</span><br><small>التحقّق العام: ${esc(location.origin)}/verify/form?code=${esc(s.form_code)}</small></div></div><div class="box"><b>رقم القاعة / المراقب / التاريخ والوقت</b><div></div><div></div><b>ملاحظات القاعة</b><div></div><div></div></div><script>setTimeout(()=>window.print(),300)</script></body></html>`); w.document.close();
  }
  const code = invite?.code || '';
  if (err && !p) return <div className="mm-created" data-testid={`fm-desk-${code}`}><p className="mm-note" role="alert">{err}</p><button type="button" className="am-btn ghost" onClick={() => void load()}>إعادة المحاولة</button></div>;
  if (!p) return <div className="mm-created" data-testid={`fm-desk-${code}`}><div style={{ flex: 1 }}><b>النموذج المثبَّت — {invite.label_ar}</b>
    <p className="mm-note">{lock?.locked ? `بدأت ${lock.sessions} جلسة على هذه الدعوة — لا يُثبَّت نموذج بعد أول جلسة (أنشئ دعوة جديدة إن أردت ورقة واحدة للجميع).` : 'اليوم يُسحب نموذج كل متقدّم عشوائيًّا عند بدء جلسته. «ثبّت النموذج» يسحب مرّة واحدة بالقواعد نفسها ويحفظ الورقة — فيراها المشرف كاملة قبل القاعة ويحصل عليها كل المتقدّمين.'}</p>
    {msg && <p className="mm-note" role="status">{msg}</p>}{err && <p className="mm-note" role="alert">{err}</p>}
    <button type="button" className="am-btn" data-testid="fm-freeze" disabled={!!busy || !!lock?.locked} onClick={() => void post({ action: 'freeze', invite_id: invite.id })}>{busy === 'freeze' ? '…' : 'ثبّت النموذج'}</button></div></div>;
  const f = p.form; const live = f.status === 'frozen'; const locked = p.lock.locked;
  return <div className="mm-created" data-testid={`fm-desk-${code}`} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <b>النموذج <span dir="ltr" data-testid="fm-code">{f.code}</span> <small>v{f.version}</small></b>
      <span className={live ? 'mm-open' : 'mm-closed'} data-testid="fm-status">{STATUS_AR[f.status] || f.status}</span>
      <span className={locked ? 'mm-closed' : 'mm-open'} data-testid="fm-lock" title="القفل عند أول جلسة">{locked ? `🔒 مقفل — ${p.lock.sessions} جلسة بدأت` : '🔓 لم تبدأ جلسة — التعديل متاح'}</span>
      <small className="mm-note" style={{ margin: 0 }}>{f.plan_name_ar} · {p.items.length} بندًا{f.duration_minutes ? ` · ${f.duration_minutes} دقيقة` : ''} · ثُبِّت {fmt(f.frozen_at)}</small>
      <a href={`/verify/form?code=${encodeURIComponent(f.code)}`} target="_blank" rel="noreferrer" data-testid="fm-verify-link">صفحة التحقّق ↗</a>
    </div>
    {p.balance && <p className="mm-note" data-testid="fm-balance" style={{ borderInlineStart: `4px solid ${p.balance.tone === 'ok' ? '#10b981' : '#f59e0b'}`, paddingInlineStart: 8 }}><b>ميزان النموذج:</b> {p.balance.cells.map((c) => `${c.level}/${c.skill_ar} ${c.have}/${c.need}`).join(' · ')}{p.balance.units ? ` · الوحدات ${p.balance.units.covered}/${p.balance.units.approved}` : ''} · {p.balance.descriptors} واصفًا · {p.balance.notes_ar.join(' — ')}</p>}
    {msg && <p className="mm-note" role="status" data-testid="fm-msg">{msg}</p>}{err && <p className="mm-note" role="alert" data-testid="fm-err" style={{ color: '#b91c1c' }}>{err}</p>}
    <div className="mm-acts" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      <button type="button" className={`am-btn ${tab === 'items' ? '' : 'ghost'}`} onClick={() => setTab('items')}>نسخة المشرف</button>
      <button type="button" className={`am-btn ${tab === 'perf' ? '' : 'ghost'}`} data-testid="fm-perf-tab" onClick={() => void loadPerf()}>أثر الورقة بعد الاختبار</button>
      <button type="button" className={`am-btn ${tab === 'versions' ? '' : 'ghost'}`} onClick={() => setTab('versions')}>الإصدارات ({p.versions.length})</button>
      <button type="button" className="am-btn ghost" data-testid="fm-print" onClick={printSupervisor}>طباعة نسخة المشرف</button>
      <button type="button" className="am-btn ghost" data-testid="fm-sheet" onClick={() => void printSheet()}>نسخة المراقب</button>
      {live && <button type="button" className="am-btn ghost" data-testid="fm-redraw" disabled={!!busy || locked} title={locked ? 'مقفل بعد أول جلسة' : ''} onClick={() => void post({ action: 'redraw', form_id: f.id, reason })}>{busy === 'redraw' ? '…' : 'اسحب نموذجًا جديدًا'}</button>}
    </div>
    {live && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب السحب/الإلغاء (إلزامي للإلغاء · 5 أحرف فأكثر)" aria-label="السبب" data-testid="fm-reason" style={{ flex: 1, minWidth: 240, border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 10px' }} />
      <button type="button" className="am-btn ghost" data-testid="fm-withdraw" disabled={!!busy || reason.trim().length < 5} onClick={() => void post({ action: 'withdraw', form_id: f.id, reason })}>{busy === 'withdraw' ? '…' : 'ألغِ التثبيت'}</button>
    </div>}
    {tab === 'items' && <ol data-testid="fm-items" style={{ margin: '6px 0 0', paddingInlineStart: 18, display: 'grid', gap: 8 }}>
      {p.items.map((it) => <li key={it.code} data-testid={`fm-item-${it.code}`}>
        <small className="mm-note" style={{ margin: 0 }}>{it.level} · {it.skill_ar}{it.descriptor ? ` · ${it.descriptor}` : ''} · <code dir="ltr">{it.code}</code>{it.units?.length ? ` · ${it.units.join(' ')}` : ''}</small>
        {it.passage && <details style={{ margin: '2px 0' }}><summary style={{ cursor: 'pointer' }}>{it.passage.title || 'المقطع'}</summary><p style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{it.passage.text}</p></details>}
        <div>{it.text}</div>
        {it.options && <ul style={{ margin: '2px 0', paddingInlineStart: 16, fontSize: 13 }}>{it.options.map((o) => <li key={o.id} style={o.correct ? { fontWeight: 800, color: '#047857' } : undefined}>{o.text}{o.correct ? ' ✓' : ''}</li>)}</ul>}
        {live && !locked && <button type="button" className="am-btn ghost" data-testid={`fm-swap-${it.code}`} disabled={!!busy} onClick={() => void openSwap(it.code)}>بدّل هذا البند</button>}
        {swap?.code === it.code && <div className="mm-created" data-testid="fm-alts" style={{ marginTop: 6 }}><div style={{ flex: 1 }}><b>بدائل من الخليّة نفسها</b> <small>({it.level} · {it.skill_ar}{it.descriptor ? ` · الواصف ${it.descriptor} أولًا` : ''})</small>
          {!swap.alts.length ? <p className="mm-note">لا بدائل متاحة في هذه الخليّة.</p> : <ul className="mm-links">{swap.alts.map((a: any) => <li key={a.code}><label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}><input type="radio" name="fm-alt" checked={swap.to === a.code} onChange={() => setSwap({ ...swap, to: a.code })} data-testid={`fm-alt-${a.code}`} /><span><code dir="ltr">{a.code}</code>{a.same_descriptor ? ' · الواصف نفسه' : ''}{a.seen_recent ? ' · عُرض حديثًا' : ''}<br /><small>{a.text}</small></span></label></li>)}</ul>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><input value={swap.reason} onChange={(e) => setSwap({ ...swap, reason: e.target.value })} placeholder="سبب التبديل (نصّ غامض · مكرّر · لا يناسب الفئة)" aria-label="سبب التبديل" data-testid="fm-swap-reason" style={{ flex: 1, minWidth: 220, border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 10px' }} />
            <button type="button" className="am-btn" data-testid="fm-swap-go" disabled={!!busy || !swap.to || swap.reason.trim().length < 3} onClick={async () => { const r = await post({ action: 'swap', form_id: f.id, from: swap.code, to: swap.to, reason: swap.reason }); if (r) setSwap(null); }}>{busy === 'swap' ? '…' : 'نفّذ التبديل'}</button>
            <button type="button" className="am-btn ghost" onClick={() => setSwap(null)}>إلغاء</button></div></div></div>}
      </li>)}
    </ol>}
    {tab === 'perf' && <div data-testid="fm-perf">{!perf ? <p className="mm-note">…</p> : !perf.ok ? <p className="mm-note">{perf.reason || 'لا بيانات بعد'}</p> : <>
      <p className="mm-note">{perf.reports} تقريرًا على هذه الورقة · البنود المعلَّمة «لم يميّز» (تمييز أقل من 0.10) تستحق نظرة في بنك الأسئلة.</p>
      <table className="mm-t"><thead><tr><th>#</th><th>البند</th><th>الخليّة</th><th>ن</th><th>الصواب</th><th>التمييز</th><th>الإشارة</th></tr></thead><tbody>
        {perf.items.map((x: any, i: number) => <tr key={x.code} data-testid={`fm-perf-${x.code}`}><td>{i + 1}</td><td><code dir="ltr">{x.code}</code></td><td>{x.level} · {x.skill_ar}</td><td>{x.n}</td><td>{Math.round(x.p * 100)}%</td><td>{x.discrimination === null ? '—' : x.discrimination}</td><td>{x.flag === 'weak' ? '⚠ لم يميّز' : x.flag === 'easy' ? 'سهل جدًا' : x.flag === 'hard' ? 'صعب جدًا' : '✓'}</td></tr>)}
      </tbody></table></>}</div>}
    {tab === 'versions' && <ul className="mm-links" data-testid="fm-versions">{p.versions.map((v) => <li key={v.id}><span>v{v.version} · {STATUS_AR[v.status] || v.status}</span><small>{fmt(v.created_at)}</small></li>)}
      {(f.changes || []).map((c: any, i: number) => <li key={`c${i}`}><span>{c.kind === 'swap' ? `تبديل ${c.from} → ${c.to}` : c.kind === 'redraw' ? `استبدال كامل${typeof c.overlap === 'number' ? ` (تكرار ${c.overlap})` : ''}` : c.kind}{c.reason ? ` — ${c.reason}` : ''}</span><small>v{c.version} · {fmt(c.at)}</small></li>)}
      {f.status === 'withdrawn' && <li><span>سُحب — {f.withdraw_reason}</span><small>{fmt(f.withdrawn_at)}</small></li>}</ul>}
    <p className="mm-note" style={{ margin: 0 }}>{p.note_ar}</p>
  </div>;
}
