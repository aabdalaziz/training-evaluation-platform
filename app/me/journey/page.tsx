'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /me/journey — «رحلتي» (P25 رحلة الممارس): نهرٌ من الفصول لا جدول — كل فصل حدث حقيقي مسجَّل (حالة يومية بكلماتي · مهمة أكّدها مشرفي · قضية مجلس وعودتها ·
 *  شهادة قرين · مستوى معتمد · اعتماد) · على كل فصل أكتب أو أسجّل «ما تغيّر فيّ» · نسخة قابلة للمشاركة أختار فصولها (كشف انتقائي موقَّع Ed25519 · صلاحية 12 شهرًا · أُلغيها متى شئت) ·
 *  «رسالة إلى نفسي بعد سنة» تُختم اليوم وتُسلَّم بعد 365 يومًا مع «أين كنت» و«أين صرت».
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { fastToken } from '../../components/Pocket';
import { Channel, ReadAloud } from '../../components/Channel';
import { supabase } from '../../../lib/supabase/client';

type Chapter = { key: string; kind: string; at: string; title_ar: string; what_ar: string; quote_ar: string | null; level: { skill_ar: string; to: number; from: number | null } | null };
type Note = { id: number; chapter_key: string; body_ar: string; media_id: string | null; kind: string; updated_at: string };
type Share = { id: string; code: string; created_at: string; display_name: string; chapter_keys: string[]; status: string; expires_at: string; views: number; url: string; verify_url: string | null };
type Capsule = { id: number; created_at: string; body_ar: string; media_id: string | null; deliver_at: string; delivered_at: string | null; status: string; snapshot_then: any; snapshot_now: any; meta: any };
type Data = { me: { name: string; email: string }; journey: { chapters: Chapter[]; days: number; first_at: string | null; counts: Record<string, number>; arc_ar: string; eras: { label: string; keys: string[] }[] }; notes: Note[]; shares: Share[]; capsules: Capsule[]; rules: { share_months: number; capsule_days: number; note_max: number; capsule_min: number; capsule_max: number; intro_max: number; signing_ready: boolean } };
const fmt = (iso: string | null | undefined, style: 'medium' | 'long' = 'medium') => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: style }) : '—');
const KIND_ICON: Record<string, IconName> = { placement: 'compass', daily: 'calendar', simulation: 'play', mission: 'flag', council: 'users', return: 'refresh', attestation: 'star', level: 'trend', credential: 'certificate', badge: 'award' };
const KIND_AR: Record<string, string> = { placement: 'تحديد المستوى', daily: 'كل يوم مهارة', simulation: 'محاكاة', mission: 'مهمة ميدانية', council: 'مجلس', return: 'عودة', attestation: 'شهادة قرين', level: 'مستوى معتمد', credential: 'اعتماد', badge: 'شارة' };
const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5));

export default function MyJourneyPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const { lang } = useLang(); const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
  const [tab, setTab] = useState<'river' | 'share' | 'capsule'>('river'); const [editing, setEditing] = useState<string>(''); const [note, setNote] = useState({ body: '', media_id: '' });
  const [sel, setSel] = useState<Record<string, boolean>>({}); const [shareOpt, setShareOpt] = useState({ name_mode: 'full' as 'full' | 'short', include_quotes: true, intro_ar: '' }); const [introSrc, setIntroSrc] = useState(''); const [lastShare, setLastShare] = useState<{ url: string; verify_url: string | null } | null>(null);
  const [cap, setCap] = useState({ body: '', media_id: '' });
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); }, [db]);
  useEffect(() => { if (typeof window !== 'undefined' && window.location.hash === '#capsules') setTab('capsule'); }, []);
  const load = useCallback(async (t: string) => { const j = await fetch('/api/journey', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null); if (j?.success) { setD(j); setErr(''); } else setErr(j?.error || 'تعذّر فتح الرحلة'); }, []);
  useEffect(() => { if (tok) load(tok); }, [tok, load]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 5000); };
  async function act(body: any): Promise<any> { setBusy(body.action); const j = await fetch('/api/journey', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ success: false, error: 'انقطع الاتصال' })); setBusy(''); if (j.success) { if (j.message) flash(j.message); await load(tok!); } else setErr(j.error || 'تعذّر'); return j; }

  const chapters = d?.journey.chapters || []; const noteOf = (k: string) => d?.notes.find(n => n.chapter_key === k) || null;
  const selectedKeys = chapters.filter(c => sel[c.key]).map(c => c.key); const activeShares = (d?.shares || []).filter(s => s.status === 'active'); const sealed = (d?.capsules || []).find(c => c.status === 'sealed') || null;
  const startNote = (c: Chapter) => { const n = noteOf(c.key); setNote({ body: n?.body_ar || '', media_id: n?.media_id || '' }); setEditing(c.key); };
  const toggleAll = (on: boolean) => { const m: Record<string, boolean> = {}; for (const c of chapters) m[c.key] = on; setSel(m); };
  const copy = async (s: string) => { try { await navigator.clipboard.writeText(s); flash('نُسخ الرابط'); } catch { /* لا حافظة */ } };

  return (
    <main className="jr" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="jr-head"><span className="pt-kicker"><Icon name="compass" size={14} /> رحلة الممارس</span><h1>رحلتي</h1>
        <p>ليست سجلًّا ولا تقريرًا. كل فصل هنا حدثٌ وقع فعلًا: حالة أجبتَ عنها بكلماتك، مهمة أكّدها مشرفك، عودة إلى مجلسك، مستوى اعتمده إنسان. أنت تكتب على كل فصل ما تغيّر فيك، وأنت وحدك تختار ما تكشفه.</p></header>
      {tok === '' && <section className="pt-box"><p>سجّل الدخول لفتح رحلتك. <Link href="/login?next=/me/journey">تسجيل الدخول</Link></p></section>}
      {err && <div className="jr-err" role="alert">{err}</div>}{msg && <div className="jr-ok" role="status">{msg}</div>}
      {tok && !d && !err && <section className="pt-box"><p className="jr-muted">نجمع فصولك…</p></section>}
      {d && (<>
        <section className="jr-arc" data-testid="arc">
          <div><b>{d.journey.arc_ar}</b><p className="jr-muted">{chapters.length ? <>بدأت {fmt(d.journey.first_at, 'long')} · {d.journey.days} يومًا · {chapters.length} فصلًا</> : 'لم تبدأ الفصول بعد — أول حالة تجيب عنها في «كل يوم مهارة» تصبح فصلك الأول.'}</p></div>
          <div className="jr-counts">{Object.entries(d.journey.counts).filter(([, n]) => n > 0).map(([k, n]) => <span key={k}><Icon name={KIND_ICON[k] || 'doc'} size={13} /> {KIND_AR[k] || k} {n}</span>)}</div>
        </section>
        <nav className="jr-tabs" aria-label="أقسام الرحلة">
          <button className={tab === 'river' ? 'on' : ''} onClick={() => setTab('river')} data-testid="tab-river"><Icon name="compass" size={14} /> الفصول</button>
          <button className={tab === 'share' ? 'on' : ''} onClick={() => setTab('share')} data-testid="tab-share"><Icon name="link" size={14} /> نسخة للمشاركة {activeShares.length ? <small>{activeShares.length}</small> : null}</button>
          <button className={tab === 'capsule' ? 'on' : ''} onClick={() => setTab('capsule')} data-testid="tab-capsule"><Icon name="mail" size={14} /> رسالة إلى نفسي {sealed ? <small>مختومة</small> : null}</button>
        </nav>

        {tab === 'river' && (!chapters.length ? (
          <section className="pt-box jr-empty"><Icon name="compass" size={26} /><b>الصفحة الأولى بيضاء</b><p className="jr-muted">فصولك تُكتب من أفعالك لا من أقوالك. ابدأ من <Link href="/me/daily">كل يوم مهارة</Link> أو <Link href="/me/missions">مهامك</Link>.</p></section>
        ) : (
          <section className="jr-river" data-testid="river">
            {d.journey.eras.map(era => (
              <div key={era.label} className="jr-era">
                <h2 className="jr-eralabel"><span>{era.label}</span></h2>
                {era.keys.map(k => chapters.find(c => c.key === k)).filter(Boolean).map(c => { const ch = c as Chapter; const n = noteOf(ch.key); const open = editing === ch.key; return (
                  <article key={ch.key} className={`jr-ch ${ch.kind}`} data-testid="chapter" data-key={ch.key}>
                    <div className="jr-dot"><Icon name={KIND_ICON[ch.kind] || 'doc'} size={15} /></div>
                    <div className="jr-card">
                      <div className="jr-chhead"><span className="jr-kind">{KIND_AR[ch.kind] || ch.kind}</span><time>{fmt(ch.at, 'long')}</time></div>
                      <h3>{ch.title_ar}</h3><p className="jr-what">{ch.what_ar}</p>
                      {ch.level && <p className="jr-level"><Icon name="trend" size={13} /> {ch.level.skill_ar}: {ch.level.from !== null ? <>{ch.level.from} ← {ch.level.to}</> : <>المستوى {ch.level.to}</>}</p>}
                      {ch.quote_ar && <blockquote className="jr-quote">«{ch.quote_ar}»<small>بكلماتك يومها</small></blockquote>}
                      {n && !open && <div className="jr-note" data-testid="note"><b>ما تغيّر فيّ</b><p>{n.body_ar || '(تسجيل صوتي)'}</p><small>{fmt(n.updated_at)}</small></div>}
                      {!open ? <div className="jr-rowbtns"><button className="pt-btn ghost small" onClick={() => startNote(ch)} data-testid="note-edit"><Icon name="edit" size={13} /> {n ? 'عدّل ما تغيّر فيّ' : 'ما الذي تغيّر فيّ هنا؟'}</button>{n && <button className="pt-btn ghost small" disabled={!!busy} onClick={() => act({ action: 'note_delete', chapter_key: ch.key })}><Icon name="trash" size={13} /> احذف</button>}</div>
                        : <div className="jr-edit">
                          <Channel lang={lang} value={note.body} onChange={v => setNote({ ...note, body: v })} tok={tok || undefined} context={{ type: 'free', id: ch.key, title: ch.title_ar }} rows={3} maxLength={d.rules.note_max} compact placeholder="بكلماتك: ما الذي تغيّر فيك بعد هذا الفصل؟ اكتب أو تكلّم…" onMedia={m => setNote(s => ({ ...s, media_id: m.id }))} testId="note-channel" />
                          <div className="jr-rowbtns"><button className="pt-btn" disabled={!!busy || (!note.body.trim() && !note.media_id)} onClick={async () => { const j = await act({ action: 'note', chapter_key: ch.key, body_ar: note.body, media_id: note.media_id || null, kind: note.media_id ? 'audio' : 'text' }); if (j.success) setEditing(''); }} data-testid="note-save"><Icon name="save" size={14} /> احفظ</button><button className="pt-btn ghost" onClick={() => setEditing('')}>إلغاء</button></div>
                        </div>}
                    </div>
                  </article>); })}
              </div>))}
          </section>))}

        {tab === 'share' && (
          <section className="jr-stack">
            <div className="pt-box">
              <h2>نسخة قابلة للمشاركة</h2>
              <p className="jr-muted">تختار الفصول التي تريد كشفها — لا أكثر. تصدر وثيقة موقَّعة (Ed25519) تُظهر الفصول وحدها، صالحة {d.rules.share_months} شهرًا، ويمكنك إلغاؤها في أي لحظة فيتوقف الرابط وتُلغى الوثيقة. لا أسماء جهات ولا مقارنات بأحد.</p>
              {!chapters.length ? <p className="jr-muted">لا فصول بعد.</p> : (<>
                <div className="jr-rowbtns"><button className="pt-btn ghost small" onClick={() => toggleAll(true)}>اختر الكل</button><button className="pt-btn ghost small" onClick={() => toggleAll(false)}>ألغِ الكل</button><span className="jr-muted">{selectedKeys.length} من {chapters.length}</span></div>
                <ul className="jr-pick" data-testid="pick">{chapters.map(c => <li key={c.key}><label><input type="checkbox" checked={!!sel[c.key]} onChange={e => setSel({ ...sel, [c.key]: e.target.checked })} /> <b>{c.title_ar}</b> <small>{KIND_AR[c.kind]} · {fmt(c.at)}</small></label></li>)}</ul>
                <div className="jr-grid2">
                  <label className="jr-opt">الاسم على النسخة<select className="jr-in" value={shareOpt.name_mode} onChange={e => setShareOpt({ ...shareOpt, name_mode: e.target.value as any })}><option value="full">اسمي الكامل</option><option value="short">الاسم الأول فقط</option></select></label>
                  <label className="jr-opt jr-check"><input type="checkbox" checked={shareOpt.include_quotes} onChange={e => setShareOpt({ ...shareOpt, include_quotes: e.target.checked })} /> أُظهر اقتباساتي (كلماتي في الحالات والعودات)</label>
                </div>
                <label className="jr-opt">مقدمة الرحلة (اختيارية — بصوتك)<textarea className="jr-in" rows={4} maxLength={d.rules.intro_max} value={shareOpt.intro_ar} onChange={e => setShareOpt({ ...shareOpt, intro_ar: e.target.value })} placeholder="سطور قليلة تقدّم بها رحلتك لمن سيقرؤها…" data-testid="intro" /></label>
                <div className="jr-rowbtns"><button className="pt-btn ghost small" disabled={!!busy} onClick={async () => { setBusy('intro'); const j = await fetch('/api/journey', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'intro' }) }).then(r => r.json()).catch(() => null); setBusy(''); if (j?.success) { setShareOpt(s => ({ ...s, intro_ar: j.intro.text })); setIntroSrc(j.note_ar); } }} data-testid="intro-ai"><Icon name="edit" size={13} /> اقترح لي مقدمة من كلماتي</button>{introSrc && <small className="jr-muted">{introSrc}</small>}</div>
                {!d.rules.signing_ready && <p className="jr-warn">مفتاح التوقيع غير مضبوط — ستُحفظ النسخة بلا وثيقة موقَّعة حتى يُضبط.</p>}
                <button className="pt-btn gold" disabled={!!busy || !selectedKeys.length} onClick={async () => { if (!confirm(`ستصدر نسخة تكشف ${selectedKeys.length} فصلًا باسمك ${shareOpt.name_mode === 'full' ? 'الكامل' : 'الأول'}. متابعة؟`)) return; const j = await act({ action: 'share', chapter_keys: selectedKeys, ...shareOpt, intro_ar: shareOpt.intro_ar.trim() || null, confirm: true }); if (j.success) { setLastShare({ url: j.url, verify_url: j.verify_url }); setSel({}); } }} data-testid="share-create"><Icon name="link" size={15} /> أصدر النسخة الموقَّعة</button>
                {lastShare && <div className="jr-link" data-testid="share-link"><b>رابط نسختك:</b> <a href={lastShare.url} target="_blank" rel="noreferrer">{lastShare.url}</a> <button className="pt-btn ghost small" onClick={() => copy(lastShare.url)}><Icon name="copy" size={13} /> انسخ</button>{lastShare.verify_url && <a className="jr-verify" href={lastShare.verify_url} target="_blank" rel="noreferrer"><Icon name="shield" size={13} /> التحقق من الوثيقة</a>}</div>}
              </>)}
            </div>
            {!!d.shares.length && <div className="pt-box"><h2>نسخي</h2>
              {d.shares.map(s => <div key={s.id} className={`jr-sharerow ${s.status}`} data-testid="share-row">
                <div><b>{s.code}</b> · {s.chapter_keys.length} فصلًا · {s.display_name}<p className="jr-muted">{s.status === 'active' ? <>فعّالة حتى {fmt(s.expires_at)} · {s.views} مشاهدة</> : s.status === 'revoked' ? 'ملغاة' : 'منتهية'}</p></div>
                <div className="jr-rowbtns">{s.status === 'active' && <><a className="pt-btn ghost small" href={s.url} target="_blank" rel="noreferrer">افتح</a><button className="pt-btn ghost small" onClick={() => copy(s.url)}><Icon name="copy" size={13} /></button><button className="pt-btn ghost small danger" disabled={!!busy} onClick={() => { if (confirm('إلغاء هذه النسخة؟ سيتوقف الرابط وتُلغى الوثيقة.')) act({ action: 'share_revoke', id: s.id }); }} data-testid="share-revoke"><Icon name="x" size={13} /> ألغِ</button></>}</div>
              </div>)}
            </div>}
          </section>)}

        {tab === 'capsule' && (
          <section className="jr-stack" id="capsules">
            <div className="pt-box jr-cap">
              <h2>رسالة إلى نفسي بعد سنة</h2>
              <p className="jr-muted">تكتب أو تسجّل اليوم، وتُختم. بعد {d.rules.capsule_days} يومًا تصلك على قنواتك مع لقطتين: «أين كنت» يوم كتبتها و«أين صرت» يوم وصلت. لا يقرؤها أحد غيرك.</p>
              {sealed ? (
                <div className="jr-sealed" data-testid="sealed"><Icon name="clock" size={22} /><div><b>رسالتك مختومة</b><p>تصلك في {fmt(sealed.deliver_at, 'long')} — بعد {daysUntil(sealed.deliver_at)} يومًا. يومها كانت رحلتك {sealed.snapshot_then?.chapters ?? 0} فصلًا.</p><button className="pt-btn ghost small" disabled={!!busy} onClick={() => { if (confirm('فتح الختم وإلغاء الرسالة؟ لن تُسلَّم.')) act({ action: 'capsule_cancel', id: sealed.id }); }} data-testid="capsule-cancel">ألغِ الرسالة</button></div></div>
              ) : (<>
                <Channel lang={lang} value={cap.body} onChange={v => setCap({ ...cap, body: v })} tok={tok || undefined} context={{ type: 'free', id: 'time_capsule', title: 'رسالة إلى نفسي بعد سنة' }} rows={7} maxLength={d.rules.capsule_max} placeholder="إلى نفسي بعد سنة: ما الذي أرجو أن أكون قد تعلّمته؟ ما الذي أخشاه الآن؟ ما الذي أعدُ به؟ اكتب أو تكلّم…" onMedia={m => setCap(s => ({ ...s, media_id: m.id }))} testId="capsule-channel" />
                <p className="jr-muted">{cap.body.trim().length}/{d.rules.capsule_max} · الحد الأدنى {d.rules.capsule_min} حرفًا (أو تسجيل)</p>
                <button className="pt-btn gold" disabled={!!busy || (cap.body.trim().length < d.rules.capsule_min && !cap.media_id)} onClick={async () => { if (!confirm('تُختم الرسالة الآن ولا تُقرأ حتى موعدها. متابعة؟')) return; const j = await act({ action: 'capsule', body_ar: cap.body, media_id: cap.media_id || null, kind: cap.media_id ? 'audio' : 'text', confirm: true }); if (j.success) setCap({ body: '', media_id: '' }); }} data-testid="capsule-seal"><Icon name="mail" size={15} /> اختم الرسالة</button>
              </>)}
            </div>
            {d.capsules.filter(c => c.status === 'delivered').map(c => (
              <article key={c.id} className="pt-box jr-delivered" data-testid="delivered">
                <div className="jr-chhead"><span className="jr-kind">وصلت {fmt(c.delivered_at, 'long')}</span><time>كُتبت {fmt(c.created_at, 'long')}</time></div>
                {c.meta?.delivery_text && <p className="jr-deltext">{c.meta.delivery_text}</p>}
                <blockquote className="jr-quote big">{c.body_ar || '(تسجيل صوتي/مرئي)'}<small>من نفسك قبل سنة</small></blockquote>
                <div className="jr-thennow"><div><b>أين كنت</b><p>{c.snapshot_then?.chapters ?? 0} فصلًا{c.snapshot_then?.last_chapter ? ` · «${c.snapshot_then.last_chapter}»` : ''}</p>{!!c.snapshot_then?.levels?.length && <small>{c.snapshot_then.levels.map((l: any) => `${l.skill} ${l.level}`).join(' · ')}</small>}</div><div><b>أين صرت</b><p>{c.snapshot_now?.chapters ?? 0} فصلًا{c.snapshot_now?.last_chapter ? ` · «${c.snapshot_now.last_chapter}»` : ''}</p>{!!c.snapshot_now?.levels?.length && <small>{c.snapshot_now.levels.map((l: any) => `${l.skill} ${l.level}`).join(' · ')}</small>}</div></div>
                {c.body_ar && <ReadAloud text={c.body_ar} lang={lang} label="اسمعها" />}
              </article>))}
          </section>)}
        <p className="jr-foot"><Icon name="shield" size={12} /> رحلتك ملكك: تُحفظ في <Link href="/me/vault">خزنة أَثَر</Link>، وتُصدَّر وتُمحى بطلبك. الفصول مشتقة من أحداث مسجَّلة ولا يُضاف إليها شيء بغير فعلٍ منك أو اعتمادٍ من إنسان.</p>
      </>)}
    </main>
  );
}

const CSS = `
.jr{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;max-width:920px;margin:0 auto;padding:28px 18px 60px}
.jr-head h1{margin:4px 0 6px;font-size:30px;color:#0f2a4e}.jr-head p{margin:0 0 18px;color:#475569;line-height:1.9}
.jr-muted{color:#64748b;font-size:13px;line-height:1.8}.jr-err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}.jr-ok{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}
.jr-warn{background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:8px 12px;color:#92400e;font-size:13px}
.jr-arc{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;background:linear-gradient(135deg,#0f2a4e,#123a66);color:#fff;border-radius:20px;padding:20px;margin:12px 0}.jr-arc b{font-size:19px;line-height:1.7}.jr-arc .jr-muted{color:#cbd5e1;margin:6px 0 0}
.jr-counts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:40%}.jr-counts span{display:inline-flex;gap:5px;align-items:center;background:rgba(255,255,255,.1);border-radius:999px;padding:4px 10px;font-size:12px;white-space:nowrap}
.jr-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0}.jr-tabs button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:8px 16px;font:inherit;font-weight:900;color:#334155;display:inline-flex;gap:7px;align-items:center}.jr-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.jr-tabs small{background:#c9a24b;color:#0f2a4e;border-radius:999px;padding:0 7px;font-size:11px}
.jr-empty{text-align:center;color:#334155}.jr-empty b{display:block;margin:8px 0 4px;color:#0f2a4e;font-size:17px}
.jr-river{position:relative;padding-inline-start:8px}.jr-era{position:relative;margin:0 0 10px;padding-inline-start:34px}.jr-era::before{content:'';position:absolute;inset-inline-start:15px;top:0;bottom:0;width:2px;background:linear-gradient(#c9a24b,#0b8a83)}
.jr-eralabel{position:relative;margin:18px 0 10px;font-size:14px;color:#0b8a83}.jr-eralabel span{background:#fff;border:1px solid #0b8a83;border-radius:999px;padding:3px 12px;position:relative;inset-inline-start:-34px}
.jr-ch{position:relative;display:flex;gap:12px;margin:0 0 14px}.jr-dot{position:absolute;inset-inline-start:-34px;top:14px;width:32px;height:32px;border-radius:50%;background:#fff;border:2px solid #0b8a83;display:flex;align-items:center;justify-content:center;color:#0b8a83;box-shadow:0 0 0 4px #fff}
.jr-ch.level .jr-dot,.jr-ch.credential .jr-dot,.jr-ch.badge .jr-dot{border-color:#c9a24b;color:#9a7420}.jr-ch.council .jr-dot,.jr-ch.return .jr-dot,.jr-ch.attestation .jr-dot{border-color:#0f2a4e;color:#0f2a4e}
.jr-card{flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:14px 18px;animation:jrIn .5s ease both}@keyframes jrIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.jr-chhead{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#64748b}.jr-kind{background:#f1f5f9;border-radius:999px;padding:2px 10px;font-weight:800;color:#0f2a4e}
.jr-card h3{margin:6px 0 4px;font-size:17px;color:#0f2a4e}.jr-what{margin:0;line-height:1.85;color:#334155;font-size:14px}.jr-level{display:inline-flex;gap:6px;align-items:center;margin:8px 0 0;background:#fdf6e3;color:#7c5a10;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800}
.jr-quote{margin:10px 0 0;padding:10px 14px;border-inline-start:3px solid #c9a24b;background:#fffdf7;border-radius:0 10px 10px 0;line-height:1.9;font-size:14px;color:#1e293b}.jr-quote small{display:block;color:#94a3b8;font-size:11px;margin-top:4px}.jr-quote.big{font-size:16px;white-space:pre-wrap}
.jr-note{margin:10px 0 0;background:#ecfeff;border:1px solid #a5f3fc;border-radius:12px;padding:10px 14px}.jr-note b{color:#155e75;font-size:12px}.jr-note p{margin:4px 0;white-space:pre-wrap;line-height:1.85;font-size:14px}.jr-note small{color:#64748b;font-size:11px}
.jr-rowbtns{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}.jr-edit{margin-top:10px}
.jr-stack{display:grid;gap:14px}.jr-in{width:100%;box-sizing:border-box;font:inherit;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;margin:6px 0;background:#fff}.jr-opt{display:block;font-size:13px;font-weight:800;color:#334155;margin:8px 0}.jr-check{display:flex;gap:8px;align-items:center}
.jr-pick{list-style:none;margin:8px 0;padding:0;display:grid;gap:4px;max-height:320px;overflow:auto;border:1px solid #e2e8f0;border-radius:12px;padding:8px}.jr-pick li label{display:flex;gap:8px;align-items:baseline;padding:4px 6px;border-radius:8px;cursor:pointer}.jr-pick li label:hover{background:#f8fafc}.jr-pick small{color:#64748b}
.jr-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end}@media (max-width:720px){.jr-grid2{grid-template-columns:1fr}.jr-arc{flex-direction:column}.jr-counts{max-width:100%;justify-content:flex-start}}
.jr-link{margin-top:12px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:10px 14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:13px;word-break:break-all}.jr-verify{display:inline-flex;gap:5px;align-items:center;color:#0f2a4e;font-weight:800}
.jr-sharerow{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #e2e8f0;padding:10px 0;align-items:center}.jr-sharerow.revoked,.jr-sharerow.expired{opacity:.6}.pt-btn.danger{color:#b91c1c;border-color:#fecaca}
.jr-cap{background:linear-gradient(135deg,#fffbeb,#fff)}.jr-sealed{display:flex;gap:14px;align-items:flex-start;background:#0f2a4e;color:#fff;border-radius:16px;padding:16px}.jr-sealed p{margin:4px 0 10px;color:#e2e8f0;line-height:1.8}
.jr-delivered .jr-deltext{line-height:1.9;color:#334155;white-space:pre-wrap}.jr-thennow{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.jr-thennow div{background:#f8fafc;border-radius:12px;padding:10px 14px}.jr-thennow b{color:#0f2a4e;font-size:13px}.jr-thennow p{margin:4px 0}.jr-thennow small{color:#64748b}
.jr-foot{margin-top:26px;font-size:12px;color:#64748b;display:flex;gap:6px;align-items:center;line-height:1.8}
`;
