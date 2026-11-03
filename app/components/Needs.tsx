'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P44 «البرنامج الذي لم يُكتب بعد» — الاحتياج التدريبي المعلَن — أربعة مكوّنات:
 *  <NeedsBoard token>              /needs: السؤال + الحاجة بجملة · «وأنا أيضًا» · حاجاتي · التبنّي (هيئة أَثَر/الطاقم) · البذور للمسجَّلين · المعلَنة للعالم
 *  <OrgNeeds orgId token>          /org (لوحة الأثر): «جهة تحتاج» — مدير الجهة يعلن حاجة باسم الجهة أو بلا اسم
 *  <ProgramBorn programId token>   صفحة البرنامج: «وُلد من حاجة أعلنها N ممارسًا» + المقاعد الأولى (72 ساعة)
 *  <NeedFromStation stationId text>  /me/after: زرّ تحت محطة «لم تسنح الفرصة/لم ينفعني» → نموذج /needs معبّأ
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { P44_NAMES_AR, NEED_MIN, NEED_MAX, PITCH_MAX, NEED_K, needFromStationText } from '../../lib/needs/registry';

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium' }) : '');
const fmtT = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '');
type Tok = () => Promise<string>;
async function api(tok: Tok | null, path: string, body?: any) { const tk = tok ? await tok() : ''; const h: any = { 'Content-Type': 'application/json' }; if (tk) h.Authorization = `Bearer ${tk}`; const r = await fetch(path, body ? { method: 'POST', headers: h, body: JSON.stringify(body) } : { headers: h, cache: 'no-store' }); return r.json().catch(() => ({ success: false, error: 'تعذّر الاتصال' })); }

/* ───────── 1) اللوحة ───────── */
export function NeedsBoard({ token, signedIn }: { token: Tok | null; signedIn: boolean }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState('');
  const [sector, setSector] = useState(''); const [f, setF] = useState({ sector: '', text: '', station: '' }); const [pitch, setPitch] = useState<Record<string, string>>({}); const [adopting, setAdopting] = useState(''); const [focus, setFocus] = useState(''); const [shareOk, setShareOk] = useState('');
  const load = useCallback(async () => { const j = await api(token, '/api/needs'); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return; } setD(j); }, [token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const sp = new URLSearchParams(window.location.search); const n = sp.get('n') || ''; if (n) setFocus(n); const st = sp.get('station') || ''; const tx = sp.get('text') || ''; if (st || tx) setF(x => ({ ...x, station: st, text: needFromStationText(tx) })); }, []);
  useEffect(() => { if (d && focus) document.getElementById(`need-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [d, focus]);
  async function post(body: any, after?: (j: any) => void) {
    setBusy(body.action + (body.id || '')); setErr(''); setOk('');
    try { const j = await api(token, '/api/needs', body); if (!j.success) throw new Error(j.error || 'فشل'); await load(); if (j.note_ar) setOk(j.note_ar); after?.(j); } catch (e: any) { setErr(e.message || 'فشل'); } finally { setBusy(''); }
  }
  async function share(id: string) { const url = `${window.location.origin}/needs?n=${id}`; try { await navigator.clipboard.writeText(url); setShareOk(id); setTimeout(() => setShareOk(''), 2500); } catch { window.prompt('انسخ الرابط', url); } }
  const items: any[] = useMemo(() => (d?.items || []).filter((n: any) => !sector || n.sector === sector), [d, sector]);
  const seeds = items.filter(n => n.status === 'seed'); const open = items.filter(n => n.status !== 'seed');
  const me = d?.me; const canAdopt = !!me?.faculty || !!me?.staff;
  if (!d) return <main className="pt-main nd"><style dangerouslySetInnerHTML={{ __html: CSS }} /><section className="pt-box"><p className="pt-muted">{err || '…'}</p></section></main>;
  return <main className="pt-main nd" data-testid="needs-page"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="pt-box nd-hero" aria-labelledby="nd-h1">
      <h1 id="nd-h1"><Icon name="spark" size={22} /> {P44_NAMES_AR.page}</h1>
      <p className="nd-lead">البرنامج الذي لم يُكتب بعد يبدأ هنا: ممارس يكتب حاجته بجملة، وحين يقول خمسة غيره «وأنا أيضًا» تُعلَن بلا اسم، فيتبنّاها كاتب من هيئة أَثَر ويعتمدها إنسان — ويولد البرنامج ولهم المقاعد الأولى.</p>
      <p className="nd-sum" data-testid="needs-summary">{d.summary_ar}</p>
      {signedIn ? <form className="nd-form" data-testid="need-form" onSubmit={e => { e.preventDefault(); post({ action: 'create', sector: f.sector, text_ar: f.text, source: f.station ? 'station' : 'practitioner', source_ref: f.station || undefined }, j => { setF({ sector: '', text: '', station: '' }); if (j.id) setFocus(j.id); }); }}>
        <label className="nd-q">{d.question_ar}
          <textarea value={f.text} onChange={e => setF(x => ({ ...x, text: e.target.value.slice(0, NEED_MAX) }))} rows={2} maxLength={NEED_MAX} required minLength={NEED_MIN} placeholder="مثال: التعامل مع ولي أمر غاضب في اجتماع مدرسي دون تصعيد" data-testid="need-text" />
        </label>
        <div className="nd-row">
          <select value={f.sector} onChange={e => setF(x => ({ ...x, sector: e.target.value }))} required aria-label="القطاع" data-testid="need-sector"><option value="">القطاع…</option>{(d.sectors || []).map((s: any) => <option key={s.code} value={s.code}>{s.ar}</option>)}</select>
          <small className="pt-muted"><bdi>{f.text.length}</bdi>/{NEED_MAX}</small>
          <button className="pt-btn" type="submit" disabled={busy === 'create' || f.text.trim().length < NEED_MIN || !f.sector} data-testid="need-submit">{busy === 'create' ? '…' : 'أعلن حاجتي'}</button>
        </div>
        {f.station && <small className="nd-src" data-testid="need-from-station"><Icon name="flag" size={12} /> من محطتك بعد البرنامج — عدّل الجملة كما تشاء</small>}
        <small className="pt-muted">{d.hint_ar}</small>
      </form> : <p className="nd-cta"><Link href="/login?next=/needs" className="pt-btn" data-testid="need-login">سجّل الدخول لتكتب حاجتك أو تقول «وأنا أيضًا»</Link></p>}
      {err && <p className="pt-err" role="alert" data-testid="needs-err">{err}</p>}{ok && <p className="nd-ok" role="status" data-testid="needs-ok">{ok}</p>}
    </section>
    {signedIn && (d.mine || []).length > 0 && <section className="pt-box" data-testid="needs-mine" aria-labelledby="nd-mine-h"><h2 id="nd-mine-h"><Icon name="target" size={16} /> {P44_NAMES_AR.mine}</h2>
      <ul className="nd-list">{(d.mine || []).map((n: any) => <NeedCard key={n.id} n={n} mine busy={busy} post={post} share={share} shareOk={shareOk} canAdopt={canAdopt} pitch={pitch} setPitch={setPitch} adopting={adopting} setAdopting={setAdopting} focus={focus} />)}</ul></section>}
    <section className="pt-box" aria-labelledby="nd-board-h">
      <div className="nd-head"><h2 id="nd-board-h"><Icon name="users" size={16} /> حاجات معلَنة</h2>
        <div className="nd-chips" role="group" aria-label="القطاع"><button type="button" className={!sector ? 'on' : ''} onClick={() => setSector('')}>الكل</button>{(d.sectors || []).filter((s: any) => (d.items || []).some((n: any) => n.sector === s.code)).map((s: any) => <button key={s.code} type="button" className={sector === s.code ? 'on' : ''} onClick={() => setSector(s.code)} data-testid={`need-chip-${s.code}`}>{s.ar}</button>)}</div></div>
      {open.length === 0 && <p className="pt-muted" data-testid="needs-empty">لا حاجات معلَنة {sector ? 'في هذا القطاع ' : ''}بعد — {signedIn ? 'اكتب حاجتك أعلاه.' : 'سجّل الدخول واكتب حاجتك.'}</p>}
      <ul className="nd-list" data-testid="needs-open">{open.map(n => <NeedCard key={n.id} n={n} busy={busy} post={post} share={share} shareOk={shareOk} canAdopt={canAdopt} pitch={pitch} setPitch={setPitch} adopting={adopting} setAdopting={setAdopting} focus={focus} />)}</ul>
    </section>
    {signedIn && <section className="pt-box nd-seeds" aria-labelledby="nd-seed-h" data-testid="needs-seeds"><h2 id="nd-seed-h"><Icon name="clock" size={16} /> حاجات {P44_NAMES_AR.seed}</h2>
      <p className="pt-muted">يراها المسجَّلون فقط. حين يقول {NEED_K} غير كاتبها «وأنا أيضًا» تُعلَن للعالم.</p>
      {seeds.length === 0 && <p className="pt-muted">لا بذور الآن.</p>}
      <ul className="nd-list">{seeds.map(n => <NeedCard key={n.id} n={n} busy={busy} post={post} share={share} shareOk={shareOk} canAdopt={canAdopt} pitch={pitch} setPitch={setPitch} adopting={adopting} setAdopting={setAdopting} focus={focus} />)}</ul></section>}
    <p className="nd-foot pt-muted">لا أسماء على الحاجات، لا ترتيب بالأكثر تأييدًا، ولا يكتب الذكاء الاصطناعي حاجة ولا يتبنّاها ولا يعتمدها. الحاجة التي لا تجد كاتبها تسعين يومًا تُطوى بهدوء ويستطيع صاحبها إحياءها.</p>
  </main>;
}

function NeedCard({ n, mine, busy, post, share, shareOk, canAdopt, pitch, setPitch, adopting, setAdopting, focus }: any) {
  const isAdopting = adopting === n.id;
  return <li id={`need-${n.id}`} className={`nd-card st-${n.status}${focus === n.id ? ' focus' : ''}`} data-testid="need-card" data-status={n.status} data-sector={n.sector}>
    <div className="nd-top"><span className="nd-sector">{n.sector_ar}</span>{n.org_ar && <span className="nd-org" data-testid="need-org"><Icon name="flag" size={12} /> {n.org_ar}</span>}{n.source !== 'practitioner' && !n.org_ar && <span className="nd-srcb">{n.source_ar}</span>}<span className={`nd-status ${n.status}`} data-testid="need-status">{n.status_ar}</span></div>
    <p className="nd-text" data-testid="need-text-view">{n.text_ar}</p>
    <p className="nd-band" data-testid="need-band">{n.band_ar} · <bdi>{fmt(n.created_at)}</bdi></p>
    {n.status === 'adopted' && <div className="nd-adopt" data-testid="need-adopted"><b>تبنّاها {n.adopter_ar || (n.adopter_kind === 'staff' ? 'الطاقم' : 'عضو في هيئة أَثَر')}</b>{n.pitch_ar && <blockquote>{n.pitch_ar}</blockquote>}<small className="pt-muted">تُصمَّم الآن في هندسة البرامج التدريبية ويعتمدها إنسان.</small></div>}
    {n.status === 'born' && n.program_id && <p className="nd-born" data-testid="need-born-link"><Icon name="award" size={14} /> <Link href={`/programs/${n.program_id}`}>وُلد منها برنامج — افتحه</Link>{n.priority?.active && <small> · المقاعد الأولى للمؤيّدين حتى <bdi>{fmtT(n.priority.until)}</bdi></small>}</p>}
    <div className="nd-acts">
      {n.can_support && <button type="button" className="pt-btn" onClick={() => post({ action: 'support', id: n.id })} disabled={busy === 'support' + n.id} data-testid="need-support">{P44_NAMES_AR.me_too}</button>}
      {n.supported && <span className="nd-sup" data-testid="need-supported"><Icon name="check" size={13} /> قلت «وأنا أيضًا»</span>}
      {(mine || n.status === 'seed') && <button type="button" className="pt-btn ghost" onClick={() => share(n.id)} data-testid="need-share"><Icon name="link" size={13} /> {shareOk === n.id ? 'نُسخ الرابط' : 'شارك مع زملائك'}</button>}
      {n.can_withdraw && <button type="button" className="pt-btn ghost" onClick={() => { if (window.confirm('تسحب حاجتك؟')) post({ action: 'withdraw', id: n.id }); }} data-testid="need-withdraw">اسحب</button>}
      {n.can_revive && <button type="button" className="pt-btn ghost" onClick={() => post({ action: 'revive', id: n.id })} data-testid="need-revive">أحيِها</button>}
      {canAdopt && n.can_adopt && !isAdopting && <button type="button" className="pt-btn gold" onClick={() => setAdopting(n.id)} data-testid="need-adopt">{P44_NAMES_AR.adopt}</button>}
    </div>
    {isAdopting && <form className="nd-pitch" data-testid="need-pitch-form" onSubmit={e => { e.preventDefault(); post({ action: 'adopt', id: n.id, pitch_ar: pitch[n.id] || '' }, () => setAdopting('')); }}>
      <label>كيف ستلبّيها؟ (≤ {PITCH_MAX} حرفًا — يُعرض للمؤيّدين)<textarea rows={3} maxLength={PITCH_MAX} value={pitch[n.id] || ''} onChange={e => setPitch((x: any) => ({ ...x, [n.id]: e.target.value }))} data-testid="need-pitch" /></label>
      <div className="nd-row"><button className="pt-btn gold" type="submit" disabled={busy === 'adopt' + n.id} data-testid="need-adopt-submit">أتبنّاها — إلى هندسة البرامج</button><button type="button" className="pt-btn ghost" onClick={() => setAdopting('')}>إلغاء</button></div>
      <small className="pt-muted">تصير مسودّة باسمك في هندسة البرامج التدريبية؛ الطاقم يكملها معك ويعتمدها إنسان.</small>
    </form>}
  </li>;
}

/* ───────── 2) جهة تحتاج ───────── */
export function OrgNeeds({ orgId, token, lang = 'ar' }: { orgId: string; token: Tok; lang?: string }) {
  const ar = lang === 'ar'; const [d, setD] = useState<any>(null); const [f, setF] = useState({ sector: '', text: '', named: false }); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const j = await api(token, `/api/needs?org=${encodeURIComponent(orgId)}`); setD(j?.success ? j : null); }, [orgId, token]);
  useEffect(() => { if (orgId) load(); }, [orgId, load]);
  async function send(e: React.FormEvent) { e.preventDefault(); setBusy(true); setMsg(''); try { const j = await api(token, '/api/needs', { action: 'org_create', org_id: orgId, sector: f.sector, text_ar: f.text, org_named: f.named }); if (!j.success) throw new Error(j.error); await load(); setF({ sector: '', text: '', named: false }); setMsg(j.note_ar || 'أُعلنت'); } catch (x: any) { setMsg(x.message || 'فشل'); } finally { setBusy(false); } }
  if (!d) return null; const list: any[] = d.items || [];
  return <section className="nd-orgbox" data-testid="org-needs" aria-labelledby="nd-org-h"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h3 id="nd-org-h"><Icon name="spark" size={16} /> {ar ? P44_NAMES_AR.org : 'Organization need'}</h3>
    <p className="pt-muted">{ar ? 'ما الذي يحتاج منسوبوكم أن يتدرّبوا عليه ولا تجدونه في الكتالوج؟ تُعلَن حاجة الجهة مباشرة في «ما يحتاجه الممارسون» — بلا أسماء أفراد، وباسم الجهة إن أذنتم — ليتبنّاها كاتب من هيئة أَثَر.' : 'Declare what your staff need and cannot find; a faculty member may adopt it.'}</p>
    {d.can_write && <form className="nd-form" onSubmit={send} data-testid="org-need-form">
      <textarea rows={2} maxLength={NEED_MAX} minLength={NEED_MIN} required value={f.text} onChange={e => setF(x => ({ ...x, text: e.target.value.slice(0, NEED_MAX) }))} placeholder={ar ? 'جملة واحدة…' : 'One sentence…'} data-testid="org-need-text" />
      <div className="nd-row"><select value={f.sector} onChange={e => setF(x => ({ ...x, sector: e.target.value }))} required aria-label="القطاع" data-testid="org-need-sector"><option value="">{ar ? 'القطاع…' : 'Sector…'}</option>{(d.sectors || []).map((s: any) => <option key={s.code} value={s.code}>{s.ar}</option>)}</select>
        <label className="nd-chk"><input type="checkbox" checked={f.named} onChange={e => setF(x => ({ ...x, named: e.target.checked }))} data-testid="org-need-named" /> {ar ? 'باسم الجهة' : 'Show org name'}</label>
        <button className="pt-btn" type="submit" disabled={busy || f.text.trim().length < NEED_MIN || !f.sector} data-testid="org-need-submit">{busy ? '…' : ar ? 'أعلن حاجة الجهة' : 'Declare'}</button></div>
    </form>}
    {msg && <p className="nd-ok" role="status" data-testid="org-need-msg">{msg}</p>}
    {list.length > 0 && <ul className="nd-list">{list.map(n => <li key={n.id} className={`nd-card st-${n.status}`} data-testid="org-need-item"><div className="nd-top"><span className="nd-sector">{n.sector_ar}</span><span className={`nd-status ${n.status}`}>{n.status_ar}</span></div><p className="nd-text">{n.text_ar}</p><p className="nd-band">{n.band_ar}{n.status === 'adopted' && n.adopter_ar ? ` · تبنّاها ${n.adopter_ar}` : ''}{n.status === 'born' && n.program_id ? <> · <Link href={`/programs/${n.program_id}`}>البرنامج</Link></> : null}</p></li>)}</ul>}
    <p className="pt-muted nd-more"><Link href="/needs">{ar ? 'كل الحاجات المعلَنة ←' : 'All declared needs →'}</Link></p>
  </section>;
}

/* ───────── 3) وُلد من حاجة ───────── */
export function ProgramBorn({ programId, token, onState, lang = 'ar' }: { programId: string; token: Tok | null; onState?: (s: { active: boolean; am: boolean }) => void; lang?: string }) {
  const ar = lang === 'ar'; const [d, setD] = useState<any>(null);
  useEffect(() => { if (!programId) return; api(token, `/api/needs?program=${encodeURIComponent(programId)}`).then(j => { if (j?.success && j.born) { setD(j); onState?.({ active: !!j.born.priority?.active, am: !!j.am_priority }); } else setD(null); }); }, [programId, token]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d?.born) return null; const b = d.born;
  return <section className="nd-bornbox" data-testid="program-born" aria-labelledby="nd-born-h"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h3 id="nd-born-h"><Icon name="spark" size={16} /> {ar ? P44_NAMES_AR.born : 'Born from a need'}</h3>
    <p className="nd-bornline" data-testid="program-born-line">{b.line_ar}</p>
    {b.priority?.active && <p className={`nd-prio${d.am_priority ? ' me' : ''}`} data-testid="program-priority">{d.am_priority ? `أنت ممن أعلنوا هذه الحاجة — المقاعد الأولى لك حتى ${fmtT(b.priority.until)}.` : `المقاعد الأولى لمن أعلنوا الحاجة حتى ${fmtT(b.priority.until)} — ثم يُفتح التسجيل للجميع.`}</p>}
    <p className="pt-muted nd-more"><Link href={`/needs?n=${b.need_id}`}>{ar ? 'الحاجة الأصل ←' : 'The original need →'}</Link></p>
  </section>;
}

/* ───────── 4) من محطة إلى حاجة ───────── */
export function NeedFromStation({ stationId, text, lang = 'ar' }: { stationId: string | number; text: string; lang?: string }) {
  const href = `/needs?station=${encodeURIComponent(String(stationId))}&text=${encodeURIComponent(needFromStationText(text))}`;
  return <Link href={href} className="pt-btn ghost nd-fromst" data-testid="need-from-station-btn"><Icon name="spark" size={13} /> {lang === 'ar' ? 'حوّلها إلى حاجة معلَنة' : 'Turn it into a declared need'}</Link>;
}

const CSS = `
.nd{max-width:980px}.nd-hero h1{display:flex;align-items:center;gap:.5rem;margin:0 0 .4rem;color:#0f2a4e}.nd-lead{font-size:1.05rem;line-height:1.9;margin:0 0 .4rem}.nd-sum{color:#0b8a83;font-weight:700;margin:0 0 .8rem}
.nd-form{display:grid;gap:.5rem;background:#f7f8fb;border:1px solid #e5e8ef;border-radius:14px;padding:.9rem}.nd-form textarea,.nd-form select,.nd-pitch textarea{width:100%;font:inherit;padding:.55rem .7rem;border:1px solid #cfd6e2;border-radius:10px;background:#fff;box-sizing:border-box}
.nd-q{font-weight:800;color:#0f2a4e;display:grid;gap:.35rem}.nd-row{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap}.nd-row select{max-width:260px}.nd-src{color:#0b8a83}.nd-cta{margin:.6rem 0 0}.nd-ok{color:#0b8a83;font-weight:700;margin:.5rem 0 0}
.nd-head{display:flex;justify-content:space-between;align-items:center;gap:.8rem;flex-wrap:wrap}.nd-chips{display:flex;gap:.35rem;flex-wrap:wrap}.nd-chips button{border:1px solid #cfd6e2;background:#fff;border-radius:999px;padding:.25rem .7rem;font:inherit;font-size:.85rem;cursor:pointer}.nd-chips button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.nd-list{list-style:none;margin:.6rem 0 0;padding:0;display:grid;gap:.7rem}.nd-card{border:1px solid #e5e8ef;border-radius:14px;padding:.8rem .95rem;background:#fff;border-inline-start:4px solid #cfd6e2;min-width:0}.nd-card.st-open{border-inline-start-color:#0b8a83}.nd-card.st-adopted{border-inline-start-color:#c9a24b}.nd-card.st-born{border-inline-start-color:#0f2a4e;background:#f7f9fd}.nd-card.st-folded{opacity:.75}.nd-card.focus{box-shadow:0 0 0 3px #c9a24b66}
.nd-top{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;font-size:.82rem}.nd-sector{background:#eef2f8;color:#0f2a4e;border-radius:999px;padding:.1rem .6rem;font-weight:700}.nd-org{color:#0f2a4e;font-weight:700}.nd-srcb{color:#6b7280}.nd-status{margin-inline-start:auto;font-weight:700;color:#6b7280}.nd-status.open{color:#0b8a83}.nd-status.adopted{color:#9a7524}.nd-status.born{color:#0f2a4e}
.nd-text{font-size:1.08rem;line-height:1.8;margin:.45rem 0 .25rem;color:#111827}.nd-band{margin:0;color:#6b7280;font-size:.88rem}.nd-adopt{margin:.5rem 0 0;padding:.5rem .7rem;background:#fbf7ec;border-radius:10px}.nd-adopt blockquote{margin:.3rem 0;padding-inline-start:.6rem;border-inline-start:3px solid #c9a24b;color:#374151;line-height:1.7}
.nd-born{margin:.5rem 0 0;color:#0f2a4e;font-weight:700}.nd-acts{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-top:.6rem}.nd-sup{color:#0b8a83;font-weight:700;font-size:.9rem}.pt-btn.ghost{background:#fff;color:#0f2a4e;border:1px solid #cfd6e2}.pt-btn.gold{background:#c9a24b;color:#0f2a4e;border-color:#c9a24b}
.nd-pitch{display:grid;gap:.45rem;margin-top:.6rem;padding:.7rem;background:#fbf7ec;border-radius:12px}.nd-pitch label{display:grid;gap:.3rem;font-weight:700;color:#0f2a4e}.nd-seeds{background:#fbfcfe}.nd-foot{font-size:.85rem;line-height:1.8;margin:1rem .3rem}
.nd-orgbox,.nd-bornbox{margin:1rem 0;padding:.9rem 1rem;border:1px solid #e5e8ef;border-radius:14px;background:#fff}.nd-orgbox h3,.nd-bornbox h3{display:flex;gap:.4rem;align-items:center;margin:0 0 .4rem;color:#0f2a4e;font-size:1.05rem}.nd-chk{display:flex;gap:.35rem;align-items:center;font-size:.9rem}.nd-more{margin:.6rem 0 0;font-size:.88rem}
.nd-bornline{font-size:1.05rem;font-weight:700;color:#0f2a4e;margin:0}.nd-prio{margin:.5rem 0 0;padding:.5rem .7rem;border-radius:10px;background:#fbf7ec;color:#7a5a12;font-weight:700}.nd-prio.me{background:#e6f6f4;color:#0b6b66}.nd-fromst{margin-top:.4rem;display:inline-flex;gap:.3rem;align-items:center}
@media (max-width:640px){.nd-status{margin-inline-start:0}.nd-row select{max-width:100%}}
`;
