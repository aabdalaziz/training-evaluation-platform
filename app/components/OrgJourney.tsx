'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «رحلة الجهة» (P26) — تبويب /org: ما تعلّمته الجهة كلها في سنة، فصولًا لا أرقامًا.
 *  الفصول: لكل ربع × نوع حدث، ولا يظهر فصل من أقل من 5 أشخاص (k) · المرآة: هذه السنة مقابل سنتها الماضية (لا مقارنة بجهة أخرى)
 *  «ما تغيّر فينا»: مدير الجهة يكتب أو يسجّل صوت الجهة على كل فصل · «كتاب السنة»: فصول مختارة → وثيقة Ed25519 ورابط عام (12 شهرًا · يُسحب بنقرة)
 *  «رسالة الجهة إلى نفسها»: تُختم اليوم وتصل مديري الجهة بعد 365 يومًا مع «أين كنّا» و«أين صرنا».
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from '../../lib/ui/icons';
import { Channel, ReadAloud } from './Channel';

type Lang = 'ar' | 'en';
type Props = { orgId: string; orgName: string; lang: Lang; token: () => Promise<string> };
type Chapter = { key: string; kind: string; quarter: string; at: string; people: number | null; title_ar: string; what_ar: string; theme_ar: string | null };
type Note = { id: number; chapter_key: string; body_ar: string; media_id: string | null; kind: string; author_email: string | null; updated_at: string };
type Share = { id: string; code: string; created_at: string; year_label: string; chapter_keys: string[]; status: string; expires_at: string; views: number; show_in_councils: boolean; url: string; verify_url: string | null };
type Capsule = { id: number; created_at: string; body_ar: string; media_id: string | null; deliver_at: string; delivered_at: string | null; status: string; snapshot_then: any; snapshot_now: any; delivered_to: string[]; meta: any };
type Data = { me: { can_write: boolean; staff: boolean }; journey: { k: number; members: number; chapters: Chapter[]; eras: { label: string; keys: string[] }[]; below: { quarter: string; kind: string; label_ar: string; people: number; k: number }[]; mirror: { kind: string; label_ar: string; now: number | null; prev: number | null; read_ar: string }[]; arc_ar: string; year_label: string; first_at: string | null; privacy_ar: string[] }; notes: Note[]; shares: Share[]; capsules: Capsule[]; rules: { k: number; share_months: number; capsule_days: number; note_max: number; capsule_min: number; capsule_max: number; intro_max: number; signing_ready: boolean } };
const fmt = (iso: string | null | undefined, style: 'medium' | 'long' = 'medium') => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: style }) : '—');
const KIND_ICON: Record<string, IconName> = { daily: 'calendar', mission: 'flag', council: 'users', return: 'refresh', attestation: 'star', level: 'trend', credential: 'certificate', charter: 'shield', twinning: 'link', contract: 'doc' };
const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5));
const qLabel = (q: string) => { const [y, n] = q.split('-Q'); return `${['', 'الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'][Number(n)] || q} ${y}`; };

export function OrgJourney({ orgId, orgName, lang, token }: Props) {
  const ar = lang === 'ar';
  const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
  const [tab, setTab] = useState<'river' | 'mirror' | 'book' | 'capsule'>('river'); const [editing, setEditing] = useState(''); const [note, setNote] = useState({ body: '', media_id: '' });
  const [sel, setSel] = useState<Record<string, boolean>>({}); const [book, setBook] = useState({ intro_ar: '', year_label: '', show_in_councils: true }); const [introSrc, setIntroSrc] = useState(''); const [last, setLast] = useState<{ url: string; verify_url: string | null } | null>(null);
  const [cap, setCap] = useState({ body: '', media_id: '' }); const [tok, setTok] = useState('');
  const tokenRef = useRef(token); tokenRef.current = token;
  const load = useCallback(async () => { try { const t = await tokenRef.current(); setTok(t); const j = await fetch(`/api/org/journey?org=${encodeURIComponent(orgId)}`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then(r => r.json()); if (!j.success) throw new Error(j.error); setD(j); setErr(''); } catch (e: any) { setErr(e.message || 'تعذّر فتح رحلة الجهة'); } }, [orgId]);
  useEffect(() => { setD(null); setSel({}); setLast(null); void load(); }, [load]);
  useEffect(() => { if (typeof window !== 'undefined' && window.location.hash === '#capsules') setTab('capsule'); }, []);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 5000); };
  async function act(body: any): Promise<any> { setBusy(body.action); const t = await token(); const j = await fetch('/api/org/journey', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ org: orgId, ...body }) }).then(r => r.json()).catch(() => ({ success: false, error: 'انقطع الاتصال' })); setBusy(''); if (j.success) { if (j.message) flash(j.message); await load(); } else setErr(j.error || 'تعذّر'); return j; }

  if (err) return <div className="pt-alert err">{err}</div>;
  if (!d) return <div className="pt-empty">{ar ? 'نجمع فصول الجهة…' : 'Gathering chapters…'}</div>;
  const chapters = d.journey.chapters; const noteOf = (k: string) => d.notes.find(n => n.chapter_key === k) || null; const canWrite = d.me.can_write;
  const selectedKeys = chapters.filter(c => sel[c.key]).map(c => c.key); const activeShares = d.shares.filter(s => s.status === 'active'); const sealed = d.capsules.find(c => c.status === 'sealed') || null;
  const startNote = (c: Chapter) => { const n = noteOf(c.key); setNote({ body: n?.body_ar || '', media_id: n?.media_id || '' }); setEditing(c.key); };
  const toggleAll = (on: boolean) => { const m: Record<string, boolean> = {}; for (const c of chapters) m[c.key] = on; setSel(m); };
  const copy = async (s: string) => { try { await navigator.clipboard.writeText(s); flash('نُسخ الرابط'); } catch { /* لا حافظة */ } };

  return (
    <div className="oj" data-testid="org-journey"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      {msg && <div className="oj-ok" role="status">{msg}</div>}
      <section className="oj-arc" data-testid="org-arc">
        <div><span className="oj-kicker"><Icon name="compass" size={13} /> رحلة الجهة · {d.journey.year_label}</span><b>{d.journey.arc_ar}</b>
          <p>{chapters.length ? <>{d.journey.members} منسوبًا مؤكَّدًا · {chapters.length} فصلًا في {d.journey.eras.length} {d.journey.eras.length === 1 ? 'حقبة' : 'حقب'}{d.journey.first_at ? <> · أول فصل {fmt(d.journey.first_at, 'long')}</> : null}</> : `لم يكتمل فصل بعد — يظهر الفصل حين يشترك ${d.journey.k} من منسوبيكم في الحدث نفسه خلال ربع واحد.`}</p></div>
        <ul className="oj-privacy" data-testid="privacy-balance">{d.journey.privacy_ar.map(p => <li key={p}><Icon name="shield" size={11} /> {p}</li>)}</ul>
      </section>
      <nav className="oj-tabs" aria-label="أقسام رحلة الجهة">
        <button className={tab === 'river' ? 'on' : ''} onClick={() => setTab('river')} data-testid="oj-tab-river"><Icon name="compass" size={14} /> الفصول</button>
        <button className={tab === 'mirror' ? 'on' : ''} onClick={() => setTab('mirror')} data-testid="oj-tab-mirror"><Icon name="trend" size={14} /> مرآة السنة</button>
        <button className={tab === 'book' ? 'on' : ''} onClick={() => setTab('book')} data-testid="oj-tab-book"><Icon name="link" size={14} /> كتاب السنة {activeShares.length ? <small>{activeShares.length}</small> : null}</button>
        <button className={tab === 'capsule' ? 'on' : ''} onClick={() => setTab('capsule')} data-testid="oj-tab-capsule"><Icon name="mail" size={14} /> رسالة الجهة إلى نفسها {sealed ? <small>مختومة</small> : null}</button>
      </nav>
      {!canWrite && <p className="oj-warn" data-testid="read-only"><Icon name="search" size={13} /> تقرأ بصفة الطاقم — صوت الجهة («ما تغيّر فينا»، الكتاب، الرسالة) يكتبه مدير الجهة المؤكَّد وحده.</p>}

      {tab === 'river' && (!chapters.length ? (
        <section className="pt-box oj-empty"><Icon name="compass" size={26} /><b>الصفحة الأولى بيضاء</b><p className="oj-muted">فصول الجهة تُكتب من أفعال منسوبيها لا من أقوال إدارتها. حين يجيب {d.journey.k} منهم عن أول موقف في «كل يوم مهارة»، أو تُؤكَّد مهامهم، أو يعودون إلى مجالسهم — يظهر الفصل الأول.</p>
          {!!d.journey.below.length && <div className="oj-below" data-testid="below"><b>يقترب:</b> {d.journey.below.slice(0, 3).map(b => <span key={b.quarter + b.kind}>{b.label_ar} · {qLabel(b.quarter)}: {b.people} من {b.k}</span>)}</div>}</section>
      ) : (
        <section className="oj-river" data-testid="org-river">
          {d.journey.eras.map(era => (
            <div key={era.label} className="oj-era">
              <h2 className="oj-eralabel"><span>{era.label}</span></h2>
              {era.keys.map(k => chapters.find(c => c.key === k)).filter(Boolean).map(c => { const ch = c as Chapter; const n = noteOf(ch.key); const open = editing === ch.key; return (
                <article key={ch.key} className={`oj-ch ${ch.kind}`} data-testid="org-chapter" data-key={ch.key}>
                  <div className="oj-dot"><Icon name={KIND_ICON[ch.kind] || 'doc'} size={15} /></div>
                  <div className="oj-card">
                    <div className="oj-chhead"><span className="oj-kind">{ch.people !== null ? <><b>{ch.people}</b> أشخاص</> : 'على مستوى الجهة'}</span><time>{fmt(ch.at, 'long')}</time></div>
                    <h3>{ch.title_ar}</h3><p className="oj-what">{ch.what_ar}</p>
                    {ch.theme_ar && <p className="oj-theme"><Icon name="folder" size={12} /> {ch.theme_ar}</p>}
                    {n && !open && <div className="oj-note" data-testid="org-note"><b>ما تغيّر فينا</b><p>{n.body_ar || '(تسجيل صوتي)'}</p><small>{fmt(n.updated_at)}</small></div>}
                    {canWrite && (!open ? <div className="oj-rowbtns"><button className="pt-btn ghost small" onClick={() => startNote(ch)} data-testid="org-note-edit"><Icon name="edit" size={13} /> {n ? 'عدّلوا ما تغيّر فينا' : 'ما الذي تغيّر فينا هنا؟'}</button>{n && <button className="pt-btn ghost small" disabled={!!busy} onClick={() => act({ action: 'note_delete', chapter_key: ch.key })}><Icon name="trash" size={13} /> احذف</button>}</div>
                      : <div className="oj-edit" data-testid="org-note-editor">
                        <Channel lang={lang} value={note.body} onChange={v => setNote({ ...note, body: v })} tok={tok || undefined} context={{ type: 'free', id: `org_journey:${ch.key}`, title: ch.title_ar }} rows={4} maxLength={d.rules.note_max} placeholder="بصيغة الجمع: ما الذي تغيّر فينا بعد هذا الفصل؟ ما الذي لم نعد نفعله؟ — اكتبوا أو سجّلوا…" onMedia={m => setNote(s => ({ ...s, media_id: m.id }))} testId="org-note-channel" />
                        <div className="oj-rowbtns"><button className="pt-btn gold small" disabled={!!busy || (!note.body.trim() && !note.media_id)} onClick={async () => { const j = await act({ action: 'note', chapter_key: ch.key, body_ar: note.body, media_id: note.media_id || null, kind: note.media_id ? 'audio' : 'text' }); if (j.success) setEditing(''); }} data-testid="org-note-save">احفظ</button><button className="pt-btn ghost small" onClick={() => setEditing('')}>إلغاء</button></div>
                      </div>)}
                  </div>
                </article>); })}
            </div>))}
          {!!d.journey.below.length && <div className="oj-below" data-testid="below"><b>فصول تقترب (لم تبلغ {d.journey.k} بعد):</b> {d.journey.below.map(b => <span key={b.quarter + b.kind}>{b.label_ar} · {qLabel(b.quarter)}: {b.people}</span>)}</div>}
        </section>))}

      {tab === 'mirror' && (
        <section className="pt-box oj-mirror" data-testid="org-mirror">
          <h2>مرآة السنة — نحن مقابل أنفسنا</h2>
          <p className="oj-muted">تُقارَن الجهة بسنتها الماضية فقط، لا بأحد. الأعداد أشخاص متمايزون، وتظهر «—» حين يقلّ العدد عن {d.journey.k}.</p>
          <table className="oj-table"><thead><tr><th>النوع</th><th>هذه السنة</th><th>السنة الماضية</th><th>القراءة</th></tr></thead>
            <tbody>{d.journey.mirror.map(r => <tr key={r.kind}><td><Icon name={KIND_ICON[r.kind] || 'doc'} size={13} /> {r.label_ar}</td><td className="n">{r.now === null ? '—' : r.now}</td><td className="n">{r.prev === null ? '—' : r.prev}</td><td className="oj-muted">{r.read_ar}</td></tr>)}</tbody></table>
        </section>)}

      {tab === 'book' && (
        <section className="oj-stack">
          <div className="pt-box">
            <h2>كتاب السنة</h2>
            <p className="oj-muted">تختارون الفصول التي تريدون نشرها — بأعدادها وكلماتكم، لا أسماء. يصدر كتاب موقَّع (Ed25519) برابط عام صالح {d.rules.share_months} شهرًا، وتسحبونه بنقرة. يمكن أن يظهر على رفّ الكتب في صفحة المجالس ليتعلّم منه غيركم.</p>
            {!chapters.length ? <p className="oj-muted">لا فصول بعد.</p> : !canWrite ? <p className="oj-muted">إصدار الكتاب لمدير الجهة.</p> : (<>
              <div className="oj-rowbtns"><button className="pt-btn ghost small" onClick={() => toggleAll(true)}>اختر الكل</button><button className="pt-btn ghost small" onClick={() => toggleAll(false)}>ألغِ الكل</button><span className="oj-muted">{selectedKeys.length} من {chapters.length}</span></div>
              <ul className="oj-pick" data-testid="org-pick">{chapters.map(c => <li key={c.key}><label><input type="checkbox" checked={!!sel[c.key]} onChange={e => setSel({ ...sel, [c.key]: e.target.checked })} /> <b>{c.title_ar}</b> <small>{qLabel(c.quarter)}{c.people !== null ? ` · ${c.people} أشخاص` : ''}{noteOf(c.key) ? ' · معه «ما تغيّر فينا»' : ''}</small></label></li>)}</ul>
              <div className="oj-grid2">
                <label className="oj-opt">عنوان السنة<input className="oj-in" value={book.year_label} onChange={e => setBook({ ...book, year_label: e.target.value })} placeholder={d.journey.year_label} data-testid="org-year" /></label>
                <label className="oj-opt oj-check"><input type="checkbox" checked={book.show_in_councils} onChange={e => setBook({ ...book, show_in_councils: e.target.checked })} data-testid="org-show-councils" /> أظهروه على رفّ كتب السنة في صفحة المجالس</label>
              </div>
              <label className="oj-opt">مقدمة الكتاب (اختيارية — بصوت الجهة)<textarea className="oj-in" rows={4} maxLength={d.rules.intro_max} value={book.intro_ar} onChange={e => setBook({ ...book, intro_ar: e.target.value })} placeholder="سطور قليلة تقدّم بها الجهة سنتها لمن سيقرؤها…" data-testid="org-intro" /></label>
              <div className="oj-rowbtns"><button className="pt-btn ghost small" disabled={!!busy} onClick={async () => { setBusy('intro'); const t = await token(); const j = await fetch('/api/org/journey', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ org: orgId, action: 'intro' }) }).then(r => r.json()).catch(() => null); setBusy(''); if (j?.success) { setBook(s => ({ ...s, intro_ar: j.intro.text })); setIntroSrc(j.note_ar); } }} data-testid="org-intro-ai"><Icon name="edit" size={13} /> اقترحوا لنا مقدمة من كلماتنا</button>{introSrc && <small className="oj-muted">{introSrc}</small>}</div>
              {!d.rules.signing_ready && <p className="oj-warn">مفتاح التوقيع غير مضبوط — سيُحفظ الكتاب بلا وثيقة موقَّعة حتى يُضبط.</p>}
              <button className="pt-btn gold" disabled={!!busy || !selectedKeys.length} onClick={async () => { if (!confirm(`سيصدر كتاب سنة «${orgName}» بـ${selectedKeys.length} فصلًا — أعداد وكلماتكم فقط. متابعة؟`)) return; const j = await act({ action: 'share', chapter_keys: selectedKeys, intro_ar: book.intro_ar.trim() || null, year_label: book.year_label.trim() || undefined, show_in_councils: book.show_in_councils, confirm: true }); if (j.success) { setLast({ url: j.url, verify_url: j.verify_url }); setSel({}); } }} data-testid="org-share-create"><Icon name="link" size={15} /> أصدروا كتاب السنة الموقَّع</button>
              {last && <div className="oj-link" data-testid="org-share-link"><b>رابط الكتاب:</b> <a href={last.url} target="_blank" rel="noreferrer">{last.url}</a> <button className="pt-btn ghost small" onClick={() => copy(last.url)}><Icon name="copy" size={13} /> انسخ</button>{last.verify_url && <a className="oj-verify" href={last.verify_url} target="_blank" rel="noreferrer"><Icon name="shield" size={13} /> التحقق من الوثيقة</a>}</div>}
            </>)}
          </div>
          {!!d.shares.length && <div className="pt-box"><h2>كتب الجهة</h2>
            {d.shares.map(s => <div key={s.id} className={`oj-sharerow ${s.status}`} data-testid="org-share-row">
              <div><b>{s.code}</b> · {s.year_label} · {s.chapter_keys.length} فصلًا{s.show_in_councils ? ' · على الرفّ' : ''}<p className="oj-muted">{s.status === 'active' ? <>فعّال حتى {fmt(s.expires_at)} · {s.views} قراءة</> : s.status === 'revoked' ? 'مسحوب' : 'منتهٍ'}</p></div>
              <div className="oj-rowbtns">{s.status === 'active' && <><a className="pt-btn ghost small" href={s.url} target="_blank" rel="noreferrer">افتح</a><button className="pt-btn ghost small" onClick={() => copy(s.url)}><Icon name="copy" size={13} /></button>{canWrite && <button className="pt-btn ghost small danger" disabled={!!busy} onClick={() => { if (confirm('سحب هذا الكتاب؟ سيتوقف الرابط وتُلغى الوثيقة.')) act({ action: 'share_revoke', id: s.id }); }} data-testid="org-share-revoke"><Icon name="x" size={13} /> اسحب</button>}</>}</div>
            </div>)}
          </div>}
        </section>)}

      {tab === 'capsule' && (
        <section className="oj-stack" id="capsules">
          <div className="pt-box oj-cap">
            <h2>رسالة الجهة إلى نفسها بعد سنة</h2>
            <p className="oj-muted">تكتبونها اليوم بصيغة «نحن»، وتُختم. بعد {d.rules.capsule_days} يومًا تصل إلى مديري الجهة يومئذ — من يكونون — مع لقطتين: «أين كنّا» و«أين صرنا». لا يقرؤها أحد قبل موعدها.</p>
            {sealed ? (
              <div className="oj-sealed" data-testid="org-sealed"><Icon name="clock" size={22} /><div><b>رسالة الجهة مختومة</b><p>تصل في {fmt(sealed.deliver_at, 'long')} — بعد {daysUntil(sealed.deliver_at)} يومًا. يومها كان للجهة {sealed.snapshot_then?.members ?? 0} منسوبًا و{sealed.snapshot_then?.chapters ?? 0} فصلًا.</p>{canWrite && <button className="pt-btn ghost small" disabled={!!busy} onClick={() => { if (confirm('فتح الختم وإلغاء رسالة الجهة؟ لن تُسلَّم.')) act({ action: 'capsule_cancel', id: sealed.id }); }} data-testid="org-capsule-cancel">ألغوا الرسالة</button>}</div></div>
            ) : !canWrite ? <p className="oj-muted">كتابة الرسالة لمدير الجهة.</p> : (<>
              <Channel lang={lang} value={cap.body} onChange={v => setCap({ ...cap, body: v })} tok={tok || undefined} context={{ type: 'free', id: 'org_time_capsule', title: 'رسالة الجهة إلى نفسها' }} rows={7} maxLength={d.rules.capsule_max} placeholder="إلى من يدير هذه الجهة بعد سنة: ما الذي نرجو أن نكون قد تعلّمناه؟ ما الذي نخشاه الآن؟ ما الذي نعد به منسوبينا؟ اكتبوا أو تكلّموا…" onMedia={m => setCap(s => ({ ...s, media_id: m.id }))} testId="org-capsule-channel" />
              <p className="oj-muted">{cap.body.trim().length}/{d.rules.capsule_max} · الحد الأدنى {d.rules.capsule_min} حرفًا (أو تسجيل)</p>
              <button className="pt-btn gold" disabled={!!busy || (cap.body.trim().length < d.rules.capsule_min && !cap.media_id)} onClick={async () => { if (!confirm('تُختم الرسالة الآن ولا تُقرأ حتى موعدها. متابعة؟')) return; const j = await act({ action: 'capsule', body_ar: cap.body, media_id: cap.media_id || null, kind: cap.media_id ? 'audio' : 'text', confirm: true }); if (j.success) setCap({ body: '', media_id: '' }); }} data-testid="org-capsule-seal"><Icon name="mail" size={15} /> اختموا الرسالة</button>
            </>)}
          </div>
          {d.capsules.filter(c => c.status === 'delivered').map(c => (
            <article key={c.id} className="pt-box oj-delivered" data-testid="org-delivered">
              <div className="oj-chhead"><span className="oj-kind">وصلت {fmt(c.delivered_at, 'long')} إلى {c.delivered_to?.length || 0} من مديري الجهة</span><time>كُتبت {fmt(c.created_at, 'long')}</time></div>
              {c.meta?.delivery_text && <p className="oj-deltext">{c.meta.delivery_text}</p>}
              <blockquote className="oj-quote">{c.body_ar || '(تسجيل صوتي/مرئي)'}<small>من الجهة إلى نفسها قبل سنة</small></blockquote>
              <div className="oj-thennow"><div><b>أين كنّا</b><p>{c.snapshot_then?.members ?? 0} منسوبًا · {c.snapshot_then?.chapters ?? 0} فصلًا{c.snapshot_then?.last_chapter ? ` · «${c.snapshot_then.last_chapter}»` : ''}</p></div><div><b>أين صرنا</b><p>{c.snapshot_now?.members ?? 0} منسوبًا · {c.snapshot_now?.chapters ?? 0} فصلًا{c.snapshot_now?.last_chapter ? ` · «${c.snapshot_now.last_chapter}»` : ''}</p></div></div>
              {c.body_ar && <ReadAloud text={c.body_ar} lang={lang} label="اسمعوها" />}
            </article>))}
        </section>)}
      <p className="oj-foot"><Icon name="shield" size={12} /> رحلة الجهة مشتقة من أحداث منسوبيها المؤكَّدين فقط، ولا يُضاف إليها شيء بغير فعلٍ منهم أو اعتمادٍ من إنسان. كل منسوب يملك <Link href="/me/journey">رحلته</Link> وحده، ولا يرى منها هنا إلا العدد.</p>
    </div>
  );
}

const CSS = `
.oj{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a}
.oj-muted{color:#64748b;font-size:13px;line-height:1.8}.oj-ok{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}
.oj-warn{background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:8px 12px;color:#92400e;font-size:13px;display:flex;gap:6px;align-items:center}
.oj-arc{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;background:linear-gradient(135deg,#0f2a4e,#0b8a83);color:#fff;border-radius:20px;padding:20px;margin:0 0 12px}.oj-kicker{display:inline-flex;gap:6px;align-items:center;font-size:12px;color:#c9a24b;font-weight:900}.oj-arc b{display:block;font-size:19px;line-height:1.7;margin:4px 0}.oj-arc p{margin:0;color:#cbd5e1;font-size:13px;line-height:1.8}
.oj-privacy{list-style:none;margin:0;padding:0;display:grid;gap:3px;max-width:42%;font-size:11.5px;color:#e2e8f0}.oj-privacy li{display:flex;gap:5px;align-items:center}
.oj-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0}.oj-tabs button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:8px 16px;font:inherit;font-weight:900;color:#334155;display:inline-flex;gap:7px;align-items:center;cursor:pointer}.oj-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.oj-tabs small{background:#c9a24b;color:#0f2a4e;border-radius:999px;padding:0 7px;font-size:11px}
.oj-empty{text-align:center;color:#334155}.oj-empty b{display:block;margin:8px 0 4px;color:#0f2a4e;font-size:17px}
.oj-river{position:relative;padding-inline-start:8px}.oj-era{position:relative;margin:0 0 10px;padding-inline-start:34px}.oj-era::before{content:'';position:absolute;inset-inline-start:15px;top:0;bottom:0;width:2px;background:linear-gradient(#c9a24b,#0b8a83)}
.oj-eralabel{position:relative;margin:18px 0 10px;font-size:14px;color:#0b8a83}.oj-eralabel span{background:#fff;border:1px solid #0b8a83;border-radius:999px;padding:3px 12px;position:relative;inset-inline-start:-34px}
.oj-ch{position:relative;display:flex;gap:12px;margin:0 0 14px}.oj-dot{position:absolute;inset-inline-start:-34px;top:14px;width:32px;height:32px;border-radius:50%;background:#fff;border:2px solid #0b8a83;display:flex;align-items:center;justify-content:center;color:#0b8a83;box-shadow:0 0 0 4px #fff}
.oj-ch.level .oj-dot,.oj-ch.credential .oj-dot,.oj-ch.charter .oj-dot{border-color:#c9a24b;color:#9a7420}.oj-ch.council .oj-dot,.oj-ch.return .oj-dot,.oj-ch.attestation .oj-dot,.oj-ch.twinning .oj-dot{border-color:#0f2a4e;color:#0f2a4e}
.oj-card{flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:14px 18px;animation:ojIn .5s ease both}@keyframes ojIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.oj-chhead{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#64748b}.oj-kind{background:#f1f5f9;border-radius:999px;padding:2px 10px;font-weight:800;color:#0f2a4e}.oj-kind b{font-size:14px;color:#0b8a83}
.oj-card h3{margin:6px 0 4px;font-size:17px;color:#0f2a4e}.oj-what{margin:0;line-height:1.85;color:#334155;font-size:14px}.oj-theme{display:inline-flex;gap:6px;align-items:center;margin:8px 0 0;background:#f0fdfa;color:#0b5a56;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800}
.oj-note{margin:10px 0 0;background:#ecfeff;border:1px solid #a5f3fc;border-radius:12px;padding:10px 14px}.oj-note b{color:#155e75;font-size:12px}.oj-note p{margin:4px 0;white-space:pre-wrap;line-height:1.85;font-size:14px}.oj-note small{color:#64748b;font-size:11px}
.oj-rowbtns{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}.oj-edit{margin-top:10px}
.oj-below{margin:8px 0 0;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:8px 12px;font-size:12.5px;color:#475569;display:flex;gap:8px;flex-wrap:wrap}.oj-below span{background:#fff;border-radius:999px;padding:2px 9px;border:1px solid #e2e8f0}
.oj-table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13.5px}.oj-table th{text-align:start;color:#64748b;font-weight:800;padding:6px 8px;border-bottom:1px solid #e2e8f0}.oj-table td{padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top}.oj-table td.n{font-weight:900;color:#0f2a4e;font-size:16px;text-align:center}
.oj-stack{display:grid;gap:14px}.oj-in{width:100%;box-sizing:border-box;font:inherit;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;margin:6px 0;background:#fff}.oj-opt{display:block;font-size:13px;font-weight:800;color:#334155;margin:8px 0}.oj-check{display:flex;gap:8px;align-items:center}
.oj-pick{list-style:none;margin:8px 0;padding:8px;display:grid;gap:4px;max-height:320px;overflow:auto;border:1px solid #e2e8f0;border-radius:12px}.oj-pick li label{display:flex;gap:8px;align-items:baseline;padding:4px 6px;border-radius:8px;cursor:pointer}.oj-pick li label:hover{background:#f8fafc}.oj-pick small{color:#64748b}
.oj-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end}@media (max-width:720px){.oj-grid2{grid-template-columns:1fr}.oj-arc{flex-direction:column}.oj-privacy{max-width:100%}}
.oj-link{margin-top:12px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:10px 14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:13px;word-break:break-all}.oj-verify{display:inline-flex;gap:5px;align-items:center;color:#0f2a4e;font-weight:800}
.oj-sharerow{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #e2e8f0;padding:10px 0;align-items:center}.oj-sharerow.revoked,.oj-sharerow.expired{opacity:.6}.oj .pt-btn.danger{color:#b91c1c;border-color:#fecaca}
.oj-cap{background:linear-gradient(135deg,#fffbeb,#fff)}.oj-sealed{display:flex;gap:14px;align-items:flex-start;background:#0f2a4e;color:#fff;border-radius:16px;padding:16px}.oj-sealed p{margin:4px 0 10px;color:#e2e8f0;line-height:1.8}
.oj-quote{margin:10px 0 0;padding:10px 14px;border-inline-start:3px solid #c9a24b;background:#fffdf7;border-radius:0 10px 10px 0;line-height:1.9;font-size:15px;color:#1e293b;white-space:pre-wrap}.oj-quote small{display:block;color:#94a3b8;font-size:11px;margin-top:4px}
.oj-delivered .oj-deltext{line-height:1.9;color:#334155;white-space:pre-wrap}.oj-thennow{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.oj-thennow div{background:#f8fafc;border-radius:12px;padding:10px 14px}.oj-thennow b{color:#0f2a4e;font-size:13px}.oj-thennow p{margin:4px 0}
.oj-foot{margin-top:26px;font-size:12px;color:#64748b;display:flex;gap:6px;align-items:center;line-height:1.8}
`;
