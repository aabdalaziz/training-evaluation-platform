'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * م6 «عُبور» — زرّ «اختبار نهاية المستوى» بجانب كل قاعة في إدارة القاعات (إلى جوار «QR الاستبيان»):
 *  يقرأ مستوى القاعة تلقائيًا (A1–C1)، يعرض جدول المواصفات المختصر، نافذة البدء/الإغلاق، المقاعد (= المقيّدون + 20%)،
 *  ثم يعيد الدعوة المفتوحة نفسها للقاعة والمستوى (reuse) أو ينشئها، ويُظهر QR كبيرًا + الرابط + نسخ + بطاقة A4 ثنائية اللغة + فتح اللوحة.
 *  «السلّة الضيّقة»: إن كان أي محور دون 1.5× المطلوب يظهر تحذير قبل الإنشاء (ولا يمنع).
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import { qrSvg } from '../../lib/certificates/qr';

type Props = { classroomId: string; classroomLabel: string; programName?: string; levelHint?: string | null; lang?: 'ar' | 'en'; compact?: boolean };
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
const SKN: Record<string, [string, string]> = { listening: ['الاستماع', 'Listening'], reading: ['القراءة', 'Reading'], grammar_vocab: ['المفردات والتراكيب', 'Use of language'], writing: ['الكتابة', 'Writing'], speaking: ['التحدّث', 'Speaking'] };
const localIso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function LevelExitQr({ classroomId, classroomLabel, programName = '', levelHint = null, lang = 'ar', compact = false }: Props) {
  const ar = lang !== 'en';
  const [open, setOpen] = useState(false); const [info, setInfo] = useState<any>(null); const [level, setLevel] = useState<string>(''); const [opens, setOpens] = useState(''); const [closes, setCloses] = useState(''); const [seats, setSeats] = useState(''); const [mode, setMode] = useState<'room' | 'camera' | 'remote'>('camera'); const [location, setLocation] = useState(''); /* م8-ب: المراقبة افتراضية + المكان */ /* م8 */
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [res, setRes] = useState<any>(null); const [origin, setOrigin] = useState('');
  const [scope, setScope] = useState<Set<string>>(new Set()); const [scopeOn, setScopeOn] = useState(false); /* م6-ب «ما دُرّس فقط» */
  useEffect(() => { try { setOrigin(window.location.origin); } catch { /* ignore */ } }, []);
  async function H() { const { data } = await supabase().auth.getSession(); return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }; }
  useEffect(() => { if (!open) return; (async () => {
    setBusy(true); setErr(''); setRes(null);
    try {
      const r = await fetch(`/api/admin/miaar/exit?classroom=${encodeURIComponent(classroomId)}`, { headers: await H(), cache: 'no-store' }); const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.success) throw new Error(j?.error || `HTTP ${r.status}`);
      setInfo(j); const lv = j.level || (levelHint && LEVELS.includes(levelHint as any) ? levelHint : ''); setLevel(lv);
      const openInv = (j.invites || []).find((x: any) => x.status === 'open'); if (openInv) setRes({ invite: openInv, url: openInv.url, reused: true, spec: j.spec, pool: j.pool, roster: j.roster });
      const now = new Date(); setOpens(localIso(now)); setCloses(localIso(new Date(now.getTime() + 3 * 3600_000))); setSeats(j.roster ? String(j.roster + Math.ceil(j.roster * 0.2)) : '');
    } catch (e: any) { setErr(e?.message || 'error'); }
    setBusy(false);
  })(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);
  async function create(forceNew = false) {
    if (!level) { setErr(ar ? 'حدّد المستوى' : 'Pick a level'); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/admin/miaar/exit', { method: 'POST', headers: await H(), body: JSON.stringify({ action: 'create', classroom_id: classroomId, level, opens_at: opens ? new Date(opens).toISOString() : null, expires_at: closes ? new Date(closes).toISOString() : null, max_seats: seats ? Number(seats) : null, force_new: forceNew, proctor_mode: mode, location: location.trim() || null, unit_scope: scopeOn && scope.size ? [...scope] : null }) });
      const j = await r.json().catch(() => ({})); if (!r.ok || !j?.success) throw new Error(j?.error || `HTTP ${r.status}`);
      setRes(j);
    } catch (e: any) { setErr(e?.message || 'error'); }
    setBusy(false);
  }
  const url: string = res?.url || ''; const spec = res?.spec || info?.spec; const pool = res?.pool || info?.pool; const narrow: any[] = pool?.narrow || [];
  const title = ar ? 'اختبار نهاية المستوى — معياري (CEFR)' : 'Level Exit Examination (CEFR-aligned)';
  async function copy() { try { await navigator.clipboard.writeText(url); } catch { window.prompt(ar ? 'انسخ الرابط:' : 'Copy the link:', url); } }
  function print() {
    if (!url || !spec) return; const w = window.open('', '_blank'); if (!w) return; const inv = res.invite;
    const rows = spec.rows.map((r: any) => `<tr><td>${esc(SKN[r.skill][0])} · ${esc(SKN[r.skill][1])}</td><td>${r.count} ${esc(r.unit_ar)}</td><td>${Math.round(r.weight)}%</td></tr>`).join('');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(classroomLabel)}</title><style>@page{size:A4;margin:14mm}body{font-family:Tahoma,Arial,sans-serif;color:#0f2a4e;text-align:center;margin:0}.k{color:#8a6a1f;font-weight:900;font-size:13px;letter-spacing:.08em;margin-top:8px}h1{font-size:26px;margin:4px 0}h2{font-size:17px;color:#0b8a83;margin:0 0 8px;font-weight:800}p{margin:4px 0;font-size:14px}.qr{margin:14px auto}.qr svg{width:300px;height:300px}code{display:block;font-size:14px;direction:ltr;word-break:break-all;margin:6px 0 10px}table{margin:10px auto;border-collapse:collapse;font-size:12.5px}td{border:1px solid #cbd5e1;padding:4px 10px}.f{margin-top:14px;font-size:11.5px;color:#64748b}.en{direction:ltr;color:#475569}</style></head><body><div class="k">أَثَر · مِعيار — من أَثَر</div><h1>${esc(title)}</h1><h2>${esc(classroomLabel)}${programName ? ' — ' + esc(programName) : ''} · المستوى ${esc(inv.level_target || level)}</h2><p>امسح الرمز بهاتفك للدخول إلى الاختبار · الزمن ${spec.minutes} دقيقة · الدعوة ${esc(inv.code)}</p><p class="en">Scan to enter the examination · ${spec.minutes} minutes · Invitation ${esc(inv.code)}</p><div class="qr">${qrSvg(url, 300)}</div><code>${esc(url)}</code><table><tbody>${rows}</tbody></table><p>${inv.opens_at ? 'يُفتح: ' + esc(new Date(inv.opens_at).toLocaleString('ar-SA')) + ' · ' : ''}${inv.expires_at ? 'يُغلق: ' + esc(new Date(inv.expires_at).toLocaleString('ar-SA')) : ''}</p><p class="f">الاجتياز: الكلّي 60% فأكثر ولا مهارة دون 50% · استقبالي 60% · كتابة 20% · تحدّث 20% · جدول المواصفات ${esc(spec.version)}<br>اكتب بريدك الذي سجّلت به في أَثَر — به تُربط نتيجتك بسجلّك. © 2026 د. أحمد محمد عبدالعزيز بدوي.</p><script>window.print()</script></body></html>`);
    w.document.close();
  }
  return <>
    <button type="button" className={`lx-btn${compact ? ' sm' : ''}`} onClick={() => setOpen(true)} title={title} data-testid="lx-open"><Icon name="qr" size={13} /> {ar ? 'اختبار نهاية المستوى' : 'Level exit exam'}</button>
    {open && <div className="lx-back" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="lx-modal" data-testid="lx-modal">
        <style>{CSS}</style>
        <header><div><div className="lx-k"><Icon name="qr" size={14} /> {title}</div><h3>{classroomLabel}</h3><small>{programName}</small></div><button type="button" className="lx-x" onClick={() => setOpen(false)} aria-label={ar ? 'إغلاق' : 'Close'}>✕</button></header>
        {err && <div className="lx-err" role="alert">{err}</div>}
        {busy && !info && <div className="lx-muted">{ar ? 'جارٍ القراءة…' : 'Loading…'}</div>}
        {info && !res && <>
          <div className="lx-row"><span>{ar ? 'المستوى (من القاعة)' : 'Level (from room)'}</span><div className="lx-seg">{LEVELS.map((l) => <button key={l} type="button" className={level === l ? 'on' : ''} onClick={() => setLevel(l)} data-testid={`lx-level-${l}`}>{l}</button>)}</div>{!info.level && <small className="lx-muted">{ar ? 'مستوى القاعة غير معروف — اختر يدويًا' : 'Room level unknown — pick manually'}</small>}</div>
          <div className="lx-grid"><label><span>{ar ? 'يُفتح' : 'Opens'}</span><input type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} data-testid="lx-opens" /></label><label><span>{ar ? 'يُغلق' : 'Closes'}</span><input type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} data-testid="lx-closes" /></label><label><span>{ar ? `المقاعد (المقيّدون ${info.roster})` : `Seats (roster ${info.roster})`}</span><input type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} data-testid="lx-seats" /></label><label><span>{ar ? 'المراقبة' : 'Proctoring'}</span><select value={mode} onChange={(e) => setMode(e.target.value as any)} data-testid="lx-mode"><option value="room">{ar ? 'قاعة بمراقب (بلا كاميرا)' : 'Proctored room (no camera)'}</option><option value="camera">{ar ? 'قاعة + شاهِد (لقطات كاميرا)' : 'Room + camera witness'}</option><option value="remote">{ar ? 'عن بُعد (شاهِد + هوية + ملء الشاشة)' : 'Remote (witness + ID + full screen)'}</option></select></label><label><span>{ar ? 'المكان (لقاعة الشاهد)' : 'Location (for the hall)'}</span><input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} placeholder={ar ? 'فرع جدة — قاعة 2' : 'Jeddah branch — Room 2'} data-testid="lx-location" /></label></div>
          {spec && level === spec.level && <p className="lx-spec" data-testid="lx-spec">{spec.rows.map((r: any) => `${SKN[r.skill][ar ? 0 : 1]} ${r.count}`).join(' · ')} · {spec.minutes} {ar ? 'دقيقة' : 'min'} · {ar ? 'اجتياز' : 'pass'} {spec.cut}%</p>}
          {Array.isArray(info.units) && info.units.length > 0 && level === info.level && <div className="lx-scope" data-testid="lx-scope">
            <label className="lx-chk"><input type="checkbox" checked={scopeOn} onChange={(e) => setScopeOn(e.target.checked)} data-testid="lx-scope-on" /> {ar ? 'ما دُرّس فقط — احصر البنود في وحدات بعينها' : 'Taught units only — restrict items to selected units'}</label>
            {scopeOn && <div className="lx-units">{info.units.map((u: any) => { const cov = info.unit_coverage?.rows?.find((r: any) => r.code === u.code); return <label key={u.code} className={`lx-unit${scope.has(u.code) ? ' on' : ''}${cov && !cov.covered ? ' empty' : ''}`}><input type="checkbox" checked={scope.has(u.code)} onChange={() => setScope((x) => { const n = new Set(x); if (n.has(u.code)) n.delete(u.code); else n.add(u.code); return n; })} /> <b dir="ltr">{u.code}</b> {ar ? u.title_ar : u.title_en || u.title_ar}{cov ? <small> · {cov.items}</small> : null}</label>; })}</div>}
            {scopeOn && <p className="lx-muted">{ar ? 'إن ضاقت البنود الموسومة عن العدد المطلوب في مهارة، يعود السحب إلى المستوى كاملًا لتلك المهارة ويُسجَّل ذلك على التقرير. العدد والأوزان لا تتغيّر.' : 'If tagged items run short in a skill, the draw falls back to the full level for that skill and the report says so. Counts and weights never change.'}</p>}
          </div>}
          {narrow.length > 0 && <div className="lx-warn" data-testid="lx-narrow">{ar ? 'السلّة الضيّقة: ' : 'Narrow pool: '}{narrow.map((c: any) => `${SKN[c.skill]?.[ar ? 0 : 1] || c.skill} ${c.have}/${c.need}`).join(' · ')} — {ar ? 'تكرار البنود بين المتعلّمين وارد؛ يُستحسن إثراء البنك قبل الجلسة.' : 'items may repeat across learners; enrich the bank first.'}</div>}
          <button type="button" className="lx-go" onClick={() => void create(false)} disabled={busy || !level} data-testid="lx-create">{busy ? '…' : ar ? 'إنشاء الدعوة وQR' : 'Create invitation & QR'}</button>
        </>}
        {res && <div className="lx-body" data-testid="lx-result" data-code={res.invite.code}>
          <p className="lx-reused">{res.reused ? (ar ? 'الدعوة المفتوحة نفسها لهذه القاعة' : 'Existing open invitation for this room') : (ar ? 'دعوة جديدة' : 'New invitation')} · {ar ? 'المستوى' : 'Level'} <b>{res.invite.level_target}</b> · <code dir="ltr">{res.invite.code}</code></p>
          <div className="lx-qr" dangerouslySetInnerHTML={{ __html: qrSvg(url, 220) }} />
          <code dir="ltr">{url}</code>
          {spec && <small className="lx-muted">{spec.rows.map((r: any) => `${SKN[r.skill][ar ? 0 : 1]} ${r.count}`).join(' · ')} · {spec.minutes} {ar ? 'دقيقة' : 'min'}</small>}
          {res.invite.opens_at && <small className="lx-muted">{ar ? 'يُفتح' : 'Opens'} {new Date(res.invite.opens_at).toLocaleString(ar ? 'ar-SA' : 'en-GB')}{res.invite.expires_at ? ` · ${ar ? 'يُغلق' : 'Closes'} ${new Date(res.invite.expires_at).toLocaleString(ar ? 'ar-SA' : 'en-GB')}` : ''}</small>}
          {narrow.length > 0 && <div className="lx-warn">{ar ? 'السلّة الضيّقة: ' : 'Narrow pool: '}{narrow.map((c: any) => `${SKN[c.skill]?.[ar ? 0 : 1] || c.skill} ${c.have}/${c.need}`).join(' · ')}</div>}
          <div className="lx-acts">
            <button type="button" onClick={() => void copy()} data-testid="lx-copy"><Icon name="copy" size={14} /> {ar ? 'نسخ' : 'Copy'}</button>
            <button type="button" onClick={print} data-testid="lx-print"><Icon name="print" size={14} /> {ar ? 'بطاقة A4' : 'A4 card'}</button>
            <a href={`/admin/miaar/exit?invite=${res.invite.id}`} target="_blank" rel="noreferrer" data-testid="lx-board"><Icon name="arrow" size={14} /> {ar ? 'لوحة المجموعة' : 'Group board'}</a>
            <a href={url} target="_blank" rel="noreferrer">{ar ? 'معاينة' : 'Preview'}</a>
          </div>
          {Array.isArray(res.invite?.unit_scope) && res.invite.unit_scope.length > 0 && <p className="lx-spec" data-testid="lx-scoped">{ar ? 'ما دُرّس فقط: ' : 'Taught units only: '}<span dir="ltr">{res.invite.unit_scope.join(' · ')}</span></p>}
          {res.reused && <button type="button" className="lx-link" onClick={() => setRes(null)} data-testid="lx-new">{ar ? 'أحتاج دعوة جديدة بنافذة أخرى' : 'I need a new invitation with another window'}</button>}
        </div>}
      </div>
    </div>}
    <style>{BTN}</style>
  </>;
}
function esc(s: string) { return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)); }
const BTN = `.lx-btn{display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:12.5px;font-weight:900;color:#0f2a4e;background:#fffdf5;border:1px solid #c9a24b;border-radius:999px;padding:6px 11px;cursor:pointer;white-space:nowrap;margin-inline-start:6px}.lx-btn.sm{font-size:12px;padding:5px 10px}`;
const CSS = `
.lx-scope{margin:8px 0;padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}.lx-chk{font-weight:800;font-size:13px;display:flex;gap:6px;align-items:center;cursor:pointer}.lx-units{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px;margin-top:8px}.lx-unit{display:flex;gap:6px;align-items:flex-start;font-size:12.5px;border:1px solid #e2e8f0;border-radius:8px;padding:5px 7px;background:#fff;cursor:pointer}.lx-unit.on{border-color:#0b8a83;background:#ecfeff}.lx-unit.empty{opacity:.6}.lx-unit small{color:#64748b}.lx-unit b{font-family:ui-monospace,monospace;color:#0b8a83}
.lx-back{position:fixed;inset:0;background:rgba(15,42,78,.45);display:grid;place-items:center;z-index:1000;padding:16px}
.lx-modal{background:#fff;border-radius:16px;width:min(560px,100%);max-height:92vh;overflow:auto;padding:18px;display:grid;gap:12px;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:inherit;color:#0f2a4e;text-align:start}
.lx-modal header{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.lx-modal h3{margin:2px 0;font-size:19px}.lx-modal header small{color:#475569;font-weight:700}.lx-k{font-size:12px;font-weight:900;color:#8a6a1f;display:inline-flex;gap:6px;align-items:center}
.lx-x{border:0;background:#f1f5f9;border-radius:999px;width:32px;height:32px;cursor:pointer;font-size:14px}
.lx-row{display:grid;gap:6px}.lx-row span{font-size:12.5px;font-weight:800;color:#334155}.lx-seg{display:flex;gap:6px;flex-wrap:wrap}.lx-seg button{font:inherit;font-size:13px;font-weight:900;border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:6px 14px;cursor:pointer;color:#0f2a4e}.lx-seg button.on{background:#0f2a4e;border-color:#0f2a4e;color:#fff}
.lx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.lx-grid label{display:grid;gap:4px;font-size:12.5px;font-weight:800;color:#334155}.lx-grid input{font:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:10px;padding:7px 8px;color:#0f2a4e;min-width:0}
.lx-spec{margin:0;font-size:13px;font-weight:800;color:#0b8a83;background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:8px 12px}
.lx-warn{background:#fffbeb;color:#92400e;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;font-weight:800;font-size:12.5px;line-height:1.7}
.lx-err{background:#fef2f2;color:#b91c1c;border-radius:10px;padding:8px 12px;font-weight:800;font-size:13px}.lx-muted{color:#64748b;font-size:12.5px}
.lx-go{font:inherit;font-size:14px;font-weight:900;background:#0f2a4e;color:#fff;border:0;border-radius:12px;padding:11px 16px;cursor:pointer}.lx-go[disabled]{opacity:.5;cursor:not-allowed}
.lx-body{display:grid;gap:8px;justify-items:center;text-align:center;border:1.5px solid #c9a24b;border-radius:14px;padding:14px;background:linear-gradient(180deg,#fffdf5,#fff)}.lx-qr svg{width:220px;height:220px;display:block}.lx-body code{font-size:12.5px;word-break:break-all}.lx-reused{margin:0;font-size:13px;font-weight:800;color:#334155}
.lx-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.lx-acts button,.lx-acts a{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;font-weight:900;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:7px 12px;cursor:pointer;color:#0f2a4e;text-decoration:none}
.lx-link{font:inherit;font-size:12.5px;background:none;border:0;color:#0b8a83;text-decoration:underline;cursor:pointer}
`;
