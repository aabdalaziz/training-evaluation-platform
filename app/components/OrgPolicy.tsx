'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P67 «السياسة والهوية» — تبويب في بوابة الجهات (/org?tab=policy): الجهة تقرّر ما يصل إلى أَثَر
 *  (1) 7 مفاتيح + وضع الكشك → حفظ = ختم ATH-OP موقَّع · (2) باب الدخول: المُعرِّف + الرابط + QR · (3) الأرقام التدريبية: لصق → حسابات،
 *  الأرقام السرية تظهر مرّة واحدة (بطاقات A4 للطباعة — ★3 لا تُخزَّن) · (4) قائمة الأرقام: دخل؟ غيّر؟ مقفول؟ · إعادة تعيين/إيقاف
 *  (5) ★1 «كما يراني الزائر» · (6) سجلّ الأختام + رابط /verify/policy
 *  testids: opl-root opl-switch-<key> opl-kiosk opl-save opl-saved opl-seal opl-slug opl-slug-save opl-enter-url opl-roster opl-roster-go opl-cards opl-card opl-print
 *           opl-codes opl-code-row opl-reset opl-revoke opl-visitor opl-visitor-item opl-seals opl-err opl-ok
 */
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../lib/ui/icons';

type Key = 'pseudonymous' | 'code_login' | 'public_faces_off' | 'home_threads_off' | 'voice_off' | 'media_off' | 'verify_minimal';
type Policy = Record<Key, boolean> & { kiosk_minutes: number };
type KeyMeta = { key: Key; title_ar: string; title_en: string; desc_ar: string; enforce_ar: string; implies?: Key[] };
type Seal = { code: string; issued_at: string; changed: string[]; policy: Record<string, unknown>; signed: boolean };
type Visitor = { id: string; title_ar: string; visible: boolean; count: number; controlled_by: Key | null; where_ar: string };
type Summary = { total: number; active: number; entered: number; changed_pin: number; locked: number; revoked: number };
type Data = { org: { id: string; name_ar: string; name_en: string | null; slug: string | null; frozen: boolean; logo?: string | null }; policy: Policy; keys: KeyMeta[]; seals: Seal[]; codes: Summary; visitor: Visitor[]; staff: boolean; enter_url: string | null };
type CodeRow = { training_no: string; created_at: string; first_login_at: string | null; last_login_at: string | null; pin_changed: boolean; locked: boolean; revoked: boolean };
type Props = { orgId: string; lang: 'ar' | 'en'; token: () => Promise<string> };
const KIOSK = [0, 5, 10, 20, 30];
const fmt = (iso?: string | null) => { if (!iso) return '—'; try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso.slice(0, 16); } };
const KEY_AR: Record<string, string> = { pseudonymous: 'هوية مستعارة', code_login: 'الدخول بالرمز', public_faces_off: 'لا وجوه عامة', home_threads_off: 'لا خيوط في الرئيسية', voice_off: 'لا صوت', media_off: 'لا وسائط', verify_minimal: 'تحقّق أدنى', kiosk_minutes: 'وضع الكشك' };

export function OrgPolicy({ orgId, lang, token }: Props) {
  const ar = lang === 'ar';
  const [d, setD] = useState<Data | null>(null); const [pol, setPol] = useState<Policy | null>(null); const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [lastSeal, setLastSeal] = useState<{ code: string; changed: string[] } | null>(null);
  const [slug, setSlug] = useState(''); const [roster, setRoster] = useState(''); const [cards, setCards] = useState<{ training_no: string; pin: string }[] | null>(null); const [rosterNote, setRosterNote] = useState('');
  const [rows, setRows] = useState<CodeRow[] | null>(null); const [resetPin, setResetPin] = useState<{ no: string; pin: string } | null>(null); const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const tk = await token(); const r = await fetch(`/api/org/policy?org=${encodeURIComponent(orgId)}`, { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }); const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) { setErr(j.error || 'تعذّر التحميل'); return; } setD(j); setPol(j.policy); setSlug(j.org.slug || ''); setErr('');
  }, [orgId, token]);
  useEffect(() => { void load(); }, [load]);
  async function post(body: Record<string, unknown>) { const tk = await token(); const r = await fetch('/api/org/policy', { method: 'POST', headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, org_id: orgId }) }); const j = await r.json().catch(() => ({})); return { ok: r.ok && j.success, j }; }

  function toggle(k: Key) { if (!pol || !d) return; const next = { ...pol, [k]: !pol[k] }; if (k === 'pseudonymous' && next.pseudonymous) next.code_login = true; if (k === 'code_login' && !next.code_login) next.pseudonymous = false; setPol(next); setOk(''); setLastSeal(null); }
  const dirty = !!(d && pol && (Object.keys(pol) as (keyof Policy)[]).some(k => pol[k] !== d.policy[k]));
  async function save() {
    if (!pol) return; setBusy('save'); setErr(''); setOk(''); const { ok: o, j } = await post({ action: 'save', policy: pol }); setBusy('');
    if (!o) { setErr(j.error || 'تعذّر الحفظ'); return; }
    setOk(j.seal ? (ar ? `حُفظت السياسة وخُتمت — ${j.seal.code}` : `Saved & sealed — ${j.seal.code}`) : (ar ? 'لا تغيير' : 'No change')); setLastSeal(j.seal ? { code: j.seal.code, changed: j.changed || [] } : null); await load();
  }
  /* P68-ج: شعار الجهة — يُصغَّر في المتصفّح إلى ≤ 240px ويُضمَّن data:image (لا تخزين ملفات) */
  async function pickLogo(file: File | null) {
    if (!file) return; setErr(''); if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) { setErr(ar ? 'اختر صورة PNG/JPEG/WebP/SVG' : 'Pick a PNG/JPEG/WebP/SVG image'); return; }
    const dataUrl: string = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result || '')); fr.onerror = () => rej(new Error('read')); fr.readAsDataURL(file); });
    let out = dataUrl;
    if (file.type !== 'image/svg+xml' || dataUrl.length > 131072) { out = await new Promise((res) => { const img = new Image(); img.onload = () => { const max = 240; const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); const g = c.getContext('2d'); if (!g) { res(dataUrl); return; } g.drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); }; img.onerror = () => res(dataUrl); img.src = dataUrl; }); }
    if (out.length > 131072) { setErr(ar ? 'الشعار ما زال أكبر من 96 KB — استخدم صورة أبسط' : 'Still > 96 KB'); return; }
    setBusy('logo'); const { ok: o, j } = await post({ action: 'logo', logo: out }); setBusy(''); if (!o) { setErr(j.error || 'تعذّر'); return; } setOk(ar ? 'حُفظ الشعار — سيظهر على بطاقة دعوة مِعيار وتقرير القيادة' : 'Logo saved'); await load();
  }
  async function clearLogo() { setBusy('logo'); const { ok: o, j } = await post({ action: 'logo', logo: null }); setBusy(''); if (!o) { setErr(j.error || 'تعذّر'); return; } setOk(ar ? 'أُزيل الشعار' : 'Logo removed'); await load(); }
  async function saveSlug() { setBusy('slug'); setErr(''); const { ok: o, j } = await post({ action: 'slug', slug: slug.trim().toLowerCase() }); setBusy(''); if (!o) { setErr(j.error || 'تعذّر'); return; } setOk(ar ? 'حُفظ المُعرِّف — هذا هو باب جهتكم' : 'Identifier saved'); await load(); }
  async function makeCodes() {
    setBusy('roster'); setErr(''); setRosterNote(''); const { ok: o, j } = await post({ action: 'roster', text: roster }); setBusy('');
    if (!o) { setErr(j.error || 'تعذّر'); return; }
    setCards(j.created || []); setRoster(''); setRosterNote(`${ar ? 'أُنشئ' : 'Created'} ${j.created.length} · ${ar ? 'موجود مسبقًا' : 'already existed'} ${j.skipped.length}${j.failed.length ? ` · ${ar ? 'تعذّر' : 'failed'} ${j.failed.length}` : ''}${(j.bad || []).length ? ` · ${ar ? 'غير صالح' : 'invalid'} ${j.bad.length}` : ''}`); await load(); await loadRows();
  }
  async function loadRows() { const { ok: o, j } = await post({ action: 'codes' }); if (o) setRows(j.rows || []); }
  async function doReset(no: string) { if (!confirm(ar ? `إعادة تعيين الرقم السري للرقم ${no}؟ الرقم القديم يتوقّف فورًا.` : `Reset PIN for ${no}?`)) return; setBusy('reset'); const { ok: o, j } = await post({ action: 'reset_pin', training_no: no }); setBusy(''); if (!o) { setErr(j.error || 'تعذّر'); return; } setResetPin({ no, pin: j.pin }); await loadRows(); }
  async function doRevoke(no: string, restore: boolean) { if (!restore && !confirm(ar ? `إيقاف الرمز ${no}؟ لن يستطيع الدخول حتى تعيد تشغيله.` : `Revoke ${no}?`)) return; setBusy('revoke'); const { ok: o, j } = await post({ action: restore ? 'restore' : 'revoke', training_no: no }); setBusy(''); if (!o) { setErr(j.error || 'تعذّر'); return; } await loadRows(); await load(); }
  function downloadCsv() { if (!cards) return; const csv = '\uFEFFtraining_no,pin\n' + cards.map(c => `${c.training_no},${c.pin}`).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `athar-entry-cards-${d?.org.slug || 'org'}.csv`; a.click(); }

  if (!d || !pol) return <div className="opl" data-testid="opl-root">{err ? <p className="opl-err" role="alert" data-testid="opl-err">{err}</p> : <p className="pt-muted">…</p>}</div>;
  const enterUrl = d.enter_url; const filtered = (rows || []).filter(r => !q || r.training_no.toLowerCase().includes(q.toLowerCase()));
  return <div className="opl" data-testid="opl-root">
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="opl-head no-print">
      <div><h3><Icon name="shield" size={18} /> {ar ? 'السياسة والهوية' : 'Policy & identity'}</h3>
        <p className="pt-muted">{ar ? 'هنا تقرّر جهتكم ما الذي يصل إلى أَثَر وما لا يصل. كل حفظ يُختم بختم موقَّع (ATH-OP) يمكن لأي جهة رقابية التحقّق منه — وما أُغلق هنا لا يفتحه أحد من داخل أَثَر.' : 'Your organization decides what reaches Athar. Every save is sealed (ATH-OP) and verifiable; what is closed here cannot be opened from inside Athar.'}</p></div>
      {d.org.frozen && <span className="opl-frozen">{ar ? 'الجهة في وضع القراءة فقط' : 'Read-only'}</span>}
    </div>
    {err && <p className="opl-err no-print" role="alert" data-testid="opl-err">{err}</p>}
    {ok && <p className="opl-ok no-print" role="status" data-testid="opl-ok">{ok}</p>}

    {/* (1) المفاتيح */}
    <section className="opl-box no-print" aria-labelledby="opl-sw">
      <h4 id="opl-sw">{ar ? 'ما الذي يصل إلى أَثَر؟' : 'What reaches Athar?'}</h4>
      <div className="opl-grid">
        {d.keys.map(k => <label key={k.key} className={`opl-sw${pol[k.key] ? ' on' : ''}`} data-testid={`opl-switch-${k.key}`}>
          <input type="checkbox" checked={pol[k.key]} onChange={() => toggle(k.key)} disabled={d.org.frozen || (k.key === 'code_login' && pol.pseudonymous)} />
          <span className="opl-swt"><b>{ar ? k.title_ar : k.title_en}</b><small>{k.desc_ar}</small><em>{ar ? 'أين يُنفَّذ: ' : 'Enforced at: '}{k.enforce_ar}</em></span>
        </label>)}
        <label className="opl-sw" data-testid="opl-kiosk">
          <span className="opl-swt"><b>{ar ? 'وضع الكشك' : 'Kiosk mode'}</b><small>{ar ? 'خروج تلقائي بعد خمول (لأجهزة القاعات المشتركة) — 0 = معطَّل' : 'Auto sign-out after idle minutes on shared devices — 0 = off'}</small>
            <select value={pol.kiosk_minutes} onChange={(e) => { setPol({ ...pol, kiosk_minutes: Number(e.target.value) }); setOk(''); }} disabled={d.org.frozen} aria-label="kiosk minutes">{KIOSK.map(m => <option key={m} value={m}>{m ? `${m} ${ar ? 'دقائق' : 'min'}` : (ar ? 'معطَّل' : 'off')}</option>)}</select></span>
        </label>
      </div>
      <div className="opl-actions">
        <button type="button" className="pt-btn" onClick={() => void save()} disabled={!dirty || busy === 'save' || d.org.frozen} data-testid="opl-save"><Icon name="save" size={14} /> {busy === 'save' ? '…' : (ar ? 'احفظ واختم' : 'Save & seal')}</button>
        {dirty && <span className="pt-muted">{ar ? 'تغييرات لم تُحفظ' : 'Unsaved changes'}</span>}
        {lastSeal && <span className="opl-sealed" data-testid="opl-saved">✓ {lastSeal.code} · {lastSeal.changed.map(c => KEY_AR[c] || c).join('، ')} · <a href={`/verify/policy?code=${lastSeal.code}`} target="_blank" rel="noreferrer">{ar ? 'تحقّق' : 'verify'}</a></span>}
      </div>
    </section>

    {/* (2) باب الدخول */}
    <section className="opl-box no-print" aria-labelledby="opl-door">
      <h4 id="opl-door">{ar ? 'باب الدخول /enter' : 'Entry door /enter'}</h4>
      <p className="pt-muted">{ar ? 'المُعرِّف القصير هو عنوان باب جهتكم: حروف إنجليزية صغيرة وأرقام وشرطة (مثال: bg-east). يُطبع على بطاقات الدخول ورمز QR.' : 'The short identifier is your door address (e.g. bg-east), printed on entry cards and QR.'}</p>
      <div className="opl-row">
        <input value={slug} onChange={(e) => setSlug(e.target.value)} dir="ltr" placeholder="bg-east" maxLength={24} aria-label="slug" data-testid="opl-slug" disabled={d.org.frozen} />
        <button type="button" className="pt-btn ghost small" onClick={() => void saveSlug()} disabled={!slug.trim() || slug.trim().toLowerCase() === (d.org.slug || '') || busy === 'slug' || d.org.frozen} data-testid="opl-slug-save">{busy === 'slug' ? '…' : (ar ? 'احفظ المُعرِّف' : 'Save')}</button>
      </div>
      {enterUrl && <p className="opl-url" data-testid="opl-enter-url"><Icon name="link" size={14} /> <a href={enterUrl} target="_blank" rel="noreferrer" dir="ltr">{enterUrl}</a> <button type="button" className="pt-btn ghost small" onClick={() => { try { void navigator.clipboard.writeText(enterUrl); setOk(ar ? 'نُسخ الرابط' : 'Copied'); } catch { /* لا */ } }}><Icon name="copy" size={13} /></button></p>}
      {!pol.code_login && <p className="pt-muted">{ar ? 'فعّل «الدخول بالرمز» أعلاه واحفظ حتى يعمل الباب.' : 'Enable “Code login” above and save to open the door.'}</p>}
    </section>

    <section className="opl-box no-print" aria-labelledby="opl-logo-h">
      <h4 id="opl-logo-h">{ar ? 'شعار الجهة' : 'Organization logo'}</h4>
      <p className="pt-muted">{ar ? 'يظهر بجوار شعار أَثَر على بطاقة دعوة «مِعيار» (الملصق وQR) وفي رأس «تقرير القيادة». صورة واحدة صغيرة تُضمَّن في سجلّ الجهة — لا ملفات ولا روابط خارجية.' : 'Shown next to the Athar logo on the Miaar invitation card and in the leadership report header. One small image embedded in the organization record.'}</p>
      <div className="opl-row" style={{ alignItems: 'center' }}>
        {d.org.logo ? <img src={d.org.logo} alt="" style={{ height: 56, maxWidth: 160, objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: 10, padding: 4, background: '#fff' }} data-testid="opl-logo-img" /> : <span className="pt-muted" data-testid="opl-logo-none">{ar ? 'لا شعار بعد' : 'No logo yet'}</span>}
        <label className="pt-btn ghost small" style={{ cursor: 'pointer' }}>{busy === 'logo' ? '…' : (ar ? (d.org.logo ? 'استبدل الشعار' : 'ارفع الشعار') : 'Upload')}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }} onChange={(e) => void pickLogo(e.target.files?.[0] || null)} data-testid="opl-logo-file" disabled={d.org.frozen} /></label>
        {d.org.logo ? <button type="button" className="pt-btn ghost small" onClick={() => void clearLogo()} disabled={busy === 'logo'} data-testid="opl-logo-clear">{ar ? 'إزالة' : 'Remove'}</button> : null}
      </div>
    </section>

    {/* (3) الأرقام التدريبية */}
    {d.policy.code_login && d.org.slug && <section className="opl-box" aria-labelledby="opl-ro">
      <h4 id="opl-ro" className="no-print">{ar ? 'الأرقام التدريبية' : 'Training numbers'} <small className="pt-muted">({d.codes.active} {ar ? 'فعّال' : 'active'} · {d.codes.entered} {ar ? 'دخلوا' : 'entered'} · {d.codes.changed_pin} {ar ? 'غيّروا رقمهم' : 'changed PIN'}{d.codes.locked ? ` · ${d.codes.locked} ${ar ? 'مقفول' : 'locked'}` : ''}{d.codes.revoked ? ` · ${d.codes.revoked} ${ar ? 'موقوف' : 'revoked'}` : ''})</small></h4>
      <div className="no-print">
        <p className="pt-muted">{ar ? 'الصق الأرقام (رقم في كل سطر). يُنشأ لكل رقم حساب مصطنع ورقم سري من 6 أرقام يظهر هنا مرّة واحدة فقط — أَثَر لا يخزّنه ولا يستطيع استرجاعه. اطبع البطاقات أو نزّل CSV ثم أغلق الصفحة.' : 'Paste numbers (one per line). Each gets a synthetic account and a 6-digit PIN shown ONCE — Athar never stores it.'}</p>
        <textarea value={roster} onChange={(e) => setRoster(e.target.value)} rows={4} dir="ltr" placeholder={'10234\n10235\n10236'} aria-label="roster" data-testid="opl-roster" disabled={d.org.frozen} />
        <div className="opl-actions"><button type="button" className="pt-btn" onClick={() => void makeCodes()} disabled={!roster.trim() || busy === 'roster' || d.org.frozen} data-testid="opl-roster-go"><Icon name="plus" size={14} /> {busy === 'roster' ? '…' : (ar ? 'أنشئ الحسابات' : 'Create accounts')}</button>
          {rosterNote && <span className="pt-muted" data-testid="opl-roster-note">{rosterNote}</span>}
          <button type="button" className="pt-btn ghost small" onClick={() => void loadRows()} data-testid="opl-codes-load"><Icon name="refresh" size={13} /> {ar ? 'اعرض القائمة' : 'Show list'}</button></div>
      </div>
      {cards && cards.length > 0 && <div className="opl-cards-wrap" data-testid="opl-cards">
        <div className="opl-actions no-print"><b>{ar ? 'بطاقات الدخول — تظهر مرّة واحدة' : 'Entry cards — shown once'}</b>
          <button type="button" className="pt-btn small" onClick={() => window.print()} data-testid="opl-print"><Icon name="print" size={13} /> {ar ? 'اطبع (A4)' : 'Print (A4)'}</button>
          <button type="button" className="pt-btn ghost small" onClick={downloadCsv}><Icon name="download" size={13} /> CSV</button>
          <button type="button" className="pt-btn ghost small" onClick={() => setCards(null)}><Icon name="x" size={13} /> {ar ? 'أغلق (تختفي الأرقام السرية)' : 'Close (PINs vanish)'}</button></div>
        <div className="opl-cards">{cards.map(c => <div key={c.training_no} className="opl-card" data-testid="opl-card">
          <div className="opl-card-org">{ar ? d.org.name_ar : (d.org.name_en || d.org.name_ar)}</div>
          <div className="opl-card-k">{ar ? 'الرقم التدريبي' : 'Training no.'}</div><div className="opl-card-v" dir="ltr">{c.training_no}</div>
          <div className="opl-card-k">{ar ? 'الرقم السرّي (غيّره عند أول دخول)' : 'PIN (change at first login)'}</div><div className="opl-card-v opl-pin" dir="ltr">{c.pin}</div>
          <div className="opl-card-url" dir="ltr">{enterUrl}</div>
          <div className="opl-card-foot">{ar ? 'أنت هنا رقم — لا اسم ولا بريد. ما تكتبه يراه مشرفك فقط ولا يدخل في أي تقييم.' : 'Here you are a number — no name, no email.'}</div>
        </div>)}</div>
      </div>}
      {resetPin && <p className="opl-reset no-print" role="status" data-testid="opl-reset-pin">{ar ? 'الرقم السرّي الجديد للرقم' : 'New PIN for'} <b dir="ltr">{resetPin.no}</b>: <b dir="ltr" className="opl-pin">{resetPin.pin}</b> — {ar ? 'يظهر مرّة واحدة' : 'shown once'} <button type="button" className="pt-btn ghost small" onClick={() => setResetPin(null)}><Icon name="x" size={12} /></button></p>}
      {rows && <div className="no-print" data-testid="opl-codes">
        <div className="opl-row"><input value={q} onChange={(e) => setQ(e.target.value)} dir="ltr" placeholder={ar ? 'ابحث برقم…' : 'search…'} aria-label="search" /></div>
        <table className="opl-table"><thead><tr><th>{ar ? 'الرقم' : 'No.'}</th><th>{ar ? 'أول دخول' : 'First login'}</th><th>{ar ? 'آخر دخول' : 'Last login'}</th><th>{ar ? 'الحالة' : 'State'}</th><th></th></tr></thead>
          <tbody>{filtered.slice(0, 300).map(r => <tr key={r.training_no} data-testid="opl-code-row" className={r.revoked ? 'off' : ''}>
            <td dir="ltr">{r.training_no}</td><td>{fmt(r.first_login_at)}</td><td>{fmt(r.last_login_at)}</td>
            <td>{r.revoked ? (ar ? 'موقوف' : 'revoked') : r.locked ? (ar ? 'مقفول مؤقتًا' : 'locked') : r.pin_changed ? (ar ? 'غيّر رقمه ✓' : 'PIN changed ✓') : r.first_login_at ? (ar ? 'دخل — لم يغيّر رقمه' : 'entered — default PIN') : (ar ? 'لم يدخل بعد' : 'not yet')}</td>
            <td className="opl-td-act">{!r.revoked && <button type="button" className="pt-btn ghost small" onClick={() => void doReset(r.training_no)} disabled={!!busy} data-testid="opl-reset">{ar ? 'رقم سري جديد' : 'Reset PIN'}</button>} <button type="button" className="pt-btn ghost small" onClick={() => void doRevoke(r.training_no, r.revoked)} disabled={!!busy} data-testid="opl-revoke">{r.revoked ? (ar ? 'أعد تشغيله' : 'Restore') : (ar ? 'أوقف' : 'Revoke')}</button></td>
          </tr>)}{!filtered.length && <tr><td colSpan={5} className="pt-muted">{ar ? 'لا أرقام بعد' : 'No numbers yet'}</td></tr>}</tbody></table>
      </div>}
    </section>}

    {/* (5) كما يراني الزائر */}
    <section className="opl-box no-print" aria-labelledby="opl-vv" data-testid="opl-visitor">
      <h4 id="opl-vv"><Icon name="globe" size={16} /> {ar ? 'كما يراني الزائر — الآن' : 'As a visitor sees us — now'}</h4>
      <p className="pt-muted">{ar ? 'ما الذي يظهر من جهتكم في الأماكن العامة لأَثَر بحسب السياسة المحفوظة؟ (أعداد فقط — لا أسماء)' : 'What of your organization is publicly visible under the saved policy? (counts only)'}</p>
      <ul className="opl-vlist">{d.visitor.map(v => <li key={v.id} className={v.visible ? 'vis' : 'hid'} data-testid="opl-visitor-item"><span className="opl-dot" aria-hidden="true" />{v.title_ar} — <b>{v.visible ? (ar ? `ظاهر (${v.count})` : `visible (${v.count})`) : (ar ? 'مخفي' : 'hidden')}</b>{v.controlled_by && <small> · {ar ? 'يتحكّم به' : 'controlled by'} «{KEY_AR[v.controlled_by]}»</small>}<small className="opl-where">{v.where_ar}</small></li>)}</ul>
    </section>

    {/* (6) الأختام */}
    <section className="opl-box no-print" aria-labelledby="opl-se" data-testid="opl-seals">
      <h4 id="opl-se"><Icon name="certificate" size={16} /> {ar ? 'أختام السياسة ATH-OP' : 'Policy seals ATH-OP'}</h4>
      {!d.seals.length ? <p className="pt-muted">{ar ? 'لا أختام بعد — أول حفظ يُنشئ أول ختم.' : 'No seals yet.'}</p> :
        <ul className="opl-slist">{d.seals.map(s => <li key={s.code}><a href={`/verify/policy?code=${s.code}`} target="_blank" rel="noreferrer" dir="ltr">{s.code}</a> · {fmt(s.issued_at)} · {s.changed.map(c => KEY_AR[c] || c).join('، ') || '—'}{s.signed ? ' · Ed25519' : ''}</li>)}</ul>}
      <p className="pt-muted">{ar ? 'التحقّق العام: ' : 'Public verification: '}<a href="/verify/policy">/verify/policy</a></p>
    </section>
  </div>;
}

const CSS = `
.opl{display:flex;flex-direction:column;gap:14px}.opl h3{margin:0;display:flex;gap:8px;align-items:center}.opl h4{margin:0 0 6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.opl-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.opl-frozen{background:#fef3c7;color:#92400e;border-radius:999px;padding:4px 10px;font-weight:800;font-size:12px;white-space:nowrap}
.opl-box{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px}
.opl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;margin-top:8px}
.opl-sw{display:flex;gap:10px;align-items:flex-start;border:1.5px solid #e2e8f0;border-radius:14px;padding:10px 12px;cursor:pointer;background:#f8fafc}.opl-sw.on{border-color:#0b8a83;background:#ecfdf5}
.opl-sw input{margin-top:4px;width:18px;height:18px;accent-color:#0b8a83}.opl-swt{display:flex;flex-direction:column;gap:3px}.opl-swt small{color:#475569;font-size:12.5px;line-height:1.5}.opl-swt em{color:#94a3b8;font-size:11px;font-style:normal}
.opl-swt select{margin-top:4px;border:1px solid #cbd5e1;border-radius:8px;padding:4px 8px;max-width:160px}
.opl-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px}.opl-sealed{color:#047857;font-weight:700;font-size:13px}.opl-sealed a{color:#0b8a83}
.opl-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0}.opl-row input{border:1.5px solid #cbd5e1;border-radius:10px;padding:8px 10px;min-width:200px}
.opl-url{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0}.opl-url a{color:#0b8a83;font-weight:700}
.opl textarea{width:100%;box-sizing:border-box;border:1.5px solid #cbd5e1;border-radius:10px;padding:8px 10px;font-family:monospace}
.opl-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:8px 12px;margin:0}.opl-ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:10px;padding:8px 12px;margin:0}
.opl-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-top:8px}
.opl-card{border:1.5px dashed #0f2a4e;border-radius:12px;padding:12px;background:#fff;break-inside:avoid;page-break-inside:avoid}.opl-card-org{font-weight:900;color:#0f2a4e;margin-bottom:6px}.opl-card-k{font-size:11px;color:#64748b;margin-top:6px}.opl-card-v{font-size:20px;font-weight:800;letter-spacing:.06em}.opl-pin{letter-spacing:.3em;color:#0b8a83}
.opl-card-url{font-size:11px;color:#334155;margin-top:8px;word-break:break-all}.opl-card-foot{font-size:10.5px;color:#64748b;margin-top:6px;line-height:1.4}
.opl-reset{background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:8px 12px}
.opl-table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:6px}.opl-table th,.opl-table td{border-bottom:1px solid #e2e8f0;padding:6px 8px;text-align:start}.opl-table tr.off td{color:#94a3b8}.opl-td-act{white-space:nowrap}
.opl-vlist,.opl-slist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}.opl-vlist li{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:14px}.opl-dot{width:10px;height:10px;border-radius:999px;background:#94a3b8;flex:none;align-self:center}
.opl-vlist li.vis .opl-dot{background:#f59e0b}.opl-vlist li.hid .opl-dot{background:#10b981}.opl-vlist small{color:#64748b}.opl-where{width:100%;padding-inline-start:18px}
.opl-slist a{color:#0b8a83;font-weight:700}
@media print{.no-print{display:none!important}.opl-cards{grid-template-columns:repeat(2,1fr);gap:8mm}.opl-box{border:0;padding:0}.opl-card{border:1px dashed #000}}
`;
