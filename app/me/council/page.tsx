'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /me/council — «قاعة المجلس» (P23 مجالس أَثَر): القضية الجارية ومداولتها (سؤال · نصيحة · دليل — نص/صوت/فيديو عبر القناة الواحدة) ·
 *  الالتزام والعودة · كاتب المجلس · مرآتي · شهادات الأقران (أشهد · شُهد لي · أعتمد بصفتي مدير جهة) · الأعضاء والميثاق · غرفة حية (WebRTC) · شهادة عضو مجلس
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { fastToken } from '../../components/Pocket';
import { Channel } from '../../components/Channel';
import { supabase } from '../../../lib/supabase/client';

type Hall = any; type Data = { me: any; halls: Hall[]; applied: any; invitations: { member_id: number; council: any }[]; org_charter?: { organization_id: string; org_name: string; signed: boolean; expires_at: string | null; code: string | null } | null; badge: { stats: any; eligibility: { ok: boolean; missing_ar: string[] }; issued: { code: string; verify_url: string } | null }; charter: { version: string; clauses: { id: string; title: string; body: string }[] }; constants: { return_days: number } };
const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium' }) : '—');
const KIND_AR: Record<string, string> = { question: 'سؤال', advice: 'نصيحة', evidence: 'دليل', return_note: 'عودة' };
const daysLeft = (iso: string | null) => iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5) : null;

export default function MyCouncilPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const { lang } = useLang(); const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
  const [hi, setHi] = useState(0); const [tab, setTab] = useState<'case' | 'commit' | 'mirror' | 'attest' | 'members'>('case');
  const [post, setPost] = useState({ kind: 'question', body: '', media_id: '' }); const [nc, setNc] = useState({ title: '', body: '', media_id: '', kind: 'text' }); const [commit, setCommit] = useState(''); const [ret, setRet] = useState({ text: '', outcome: 'succeeded' });
  const [att, setAtt] = useState({ to_email: '', skill_id: '', evidence: '' }); const [room, setRoom] = useState<string>('');
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); }, [db]);
  const load = useCallback(async (t: string) => { const j = await fetch('/api/councils', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null); if (j?.success) { setD(j); setErr(''); } else setErr(j?.error || 'تعذّر فتح القاعة'); }, []);
  useEffect(() => { if (tok) load(tok); }, [tok, load]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 4500); };
  async function act(body: any, ok?: string) { setBusy(body.action); const j = await fetch('/api/councils', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null); setBusy(''); if (!j?.success) { setErr(j?.error || 'تعذّر'); return null; } setErr(''); if (ok || j.message) flash(j.message || ok!); await load(tok!); return j; }
  async function openRoom(h: Hall) { setBusy('room'); const j = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'create', kind: 'dialogue', title: `مجلس «${h.council.title_ar}»`, prompt: h.current ? `القضية: ${h.current.title_ar}. اسألوا قبل أن تنصحوا.` : 'جلسة مجلس حية', minutes: 45, max_peers: 6 }) }).then(r => r.json()).catch(() => null); setBusy(''); if (j?.success && (j.room?.code || j.code)) { const code = j.room?.code || j.code; setRoom(code); window.open(`/room/${code}`, '_blank'); } else setErr(j?.error || 'تعذّر فتح الغرفة'); }

  const h: Hall | null = d?.halls?.[hi] || null; const c = h?.current || null;
  const members = h?.members || []; const skills = h?.council?.skills || [];
  return (
    <main className="hl" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="hl-head"><span className="pt-kicker"><Icon name="users" size={14} /> مجالس أَثَر · قاعة المجلس</span><h1>مجلسي</h1><p>ما يُقال هنا يبقى هنا. اسأل قبل أن تنصح، والتزم، وعُد بما حدث — ومرآتك تصف سلوكك لا شخصك.</p></header>
      {tok === '' && <section className="pt-box"><p>سجّل الدخول لفتح قاعة المجلس. <Link href="/login?next=/me/council">تسجيل الدخول</Link></p></section>}
      {err && <div className="hl-err" role="alert">{err}</div>}{msg && <div className="hl-ok" role="status">{msg}</div>}
      {tok && !d && !err && <section className="pt-box"><p className="hl-muted">نفتح القاعة…</p></section>}
      {d && !!d.invitations.length && d.invitations.map(inv => (
        <section key={inv.member_id} className="hl-invite" data-testid="invite">
          <div><b>دعوة إلى مجلس «{inv.council.title_ar}»</b><p>دورة {inv.council.cycle_weeks} أسابيع · للانضمام وقّع ميثاق المجلس:</p>
            <ul>{d.charter.clauses.map(cl => <li key={cl.id}><b>{cl.title}</b> — {cl.body}</li>)}</ul></div>
          <button className="pt-btn gold" disabled={!!busy} onClick={() => act({ action: 'sign_charter', council_id: inv.council.id }, 'وقّعت الميثاق')}><Icon name="check" size={15} /> أوقّع الميثاق وأنضم</button>
        </section>
      ))}
      {d && d.org_charter && (
        <p className={`hl-orgcharter ${d.org_charter.signed ? 'ok' : 'no'}`} data-testid="org-charter-line"><Icon name={d.org_charter.signed ? 'check' : 'shield'} size={14} /> {d.org_charter.signed ? <>جهتك <b>{d.org_charter.org_name}</b> وقّعت «ميثاق الجهة»: وقت داخل الدوام · سرية · لا تقييم وظيفي بالمرآة ولا بالمداولات · لا أسماء{d.org_charter.code && <> — <a href={`/verify/vc?code=${encodeURIComponent(d.org_charter.code)}`} target="_blank" rel="noreferrer">تحقق</a></>}</> : <>جهتك <b>{d.org_charter.org_name}</b> لم توقّع «ميثاق الجهة» بعد — ما تراه هنا يبقى لك وحدك على كل حال؛ والجهة لا ترى مرآتك.</>}</p>
      )}
      {d && !d.halls.length && !d.invitations.length && (
        <section className="pt-box hl-empty" data-testid="no-council">
          {d.applied ? <><Icon name="clock" size={28} /><b>طلبك قائم منذ {fmt(d.applied.created_at)}</b><p>المُوفِّق يراه عند التشكيل التالي: حين يكتمل مجلس يناسب مستواك وجهتك تصلك دعوة لتوقيع الميثاق.</p>{d.applied.note && <p className="hl-muted">{d.applied.note}</p>}</> : <><Icon name="compass" size={28} /><b>لست في مجلس بعد</b><p>المجالس أقران من جهات مختلفة حول مواقف حقيقية. <Link href="/councils#apply" className="pt-btn small">اطلب مقعدًا</Link></p></>}
        </section>
      )}
      {d && d.halls.length > 1 && <nav className="hl-switch">{d.halls.map((x: Hall, i: number) => <button key={x.council.id} className={i === hi ? 'on' : ''} onClick={() => setHi(i)}>{x.council.title_ar}</button>)}</nav>}

      {h && (
        <>
          <section className="hl-top" data-testid="hall-top">
            <div><h2>{h.council.title_ar}</h2><p className="hl-muted">{h.council.status_ar} · الدورة {h.council.cycle_no} تنتهي {fmt(h.council.cycle_ends_at)} · {members.length} أعضاء من {h.quorum.orgs} جهات{h.me.is_chair ? ' · الكرسي لك هذه الدورة' : ''}</p>
              <div className="hl-chips">{skills.map((s: any) => <span key={s.id} className="hl-chip">{s.name_ar}</span>)}</div></div>
            <div className="hl-actions"><button className="pt-btn ghost small" disabled={busy === 'room'} onClick={() => openRoom(h)}><Icon name="play" size={14} /> جلسة حية (غرفة أَثَر)</button>{room && <a className="hl-muted" href={`/room/${room}`} target="_blank" rel="noreferrer">غرفة {room}</a>}</div>
          </section>
          {!h.me.signed && <div className="hl-warn">وقّع الميثاق لتشارك: <button className="pt-btn small gold" onClick={() => act({ action: 'sign_charter', council_id: h.council.id }, 'وقّعت الميثاق')}>أوقّع</button></div>}
          <nav className="hl-tabs">
            <button className={tab === 'case' ? 'on' : ''} onClick={() => setTab('case')}>القضية {c ? <i>{c.status_ar}</i> : null}</button>
            <button className={tab === 'commit' ? 'on' : ''} onClick={() => setTab('commit')}>التزاماتي {h.my_commitments.filter((x: any) => !x.returned_at).length ? <i>{h.my_commitments.filter((x: any) => !x.returned_at).length}</i> : null}</button>
            <button className={tab === 'mirror' ? 'on' : ''} onClick={() => setTab('mirror')}>مرآتي</button>
            <button className={tab === 'attest' ? 'on' : ''} onClick={() => setTab('attest')}>شهادات الأقران {h.attestations.to_decide.length ? <i>{h.attestations.to_decide.length}</i> : null}</button>
            <button className={tab === 'members' ? 'on' : ''} onClick={() => setTab('members')}>الأعضاء والميثاق</button>
          </nav>

          {tab === 'case' && (
            <section className="hl-stack" data-testid="case-tab">
              {!c && (
                <div className="pt-box">
                  <h3><Icon name="flag" size={16} /> لا قضية مفتوحة — {h.me.is_chair ? 'الكرسي يفتح القضية الأولى' : 'احمل موقفًا حقيقيًا تواجهه'}</h3>
                  <p className="hl-muted">ما الذي أواجهه؟ ما خياراتي؟ ما الذي أخشاه؟ — اكتب أو تكلّم أو صوّر (90 ثانية).</p>
                  <input className="hl-in" placeholder="عنوان القضية (بلا أسماء)" value={nc.title} onChange={e => setNc({ ...nc, title: e.target.value })} data-testid="case-title" />
                  <Channel lang={lang} value={nc.body} onChange={v => setNc({ ...nc, body: v })} tok={tok || undefined} context={{ type: 'dialogue', id: h.council.id, title: 'قضية مجلس' }} rows={6} maxLength={6000} placeholder="صف الموقف كما هو…" onMedia={m => setNc({ ...nc, media_id: m.id, kind: 'video' })} testId="case-body" />
                  <button className="pt-btn" disabled={!!busy || !h.me.signed} onClick={async () => { const j = await act({ action: 'open_case', council_id: h.council.id, ...nc }, 'فُتحت القضية — المجلس أُبلغ'); if (j) setNc({ title: '', body: '', media_id: '', kind: 'text' }); }} data-testid="open-case"><Icon name="send" size={15} /> افتح القضية</button>
                </div>
              )}
              {c && (
                <>
                  <article className="hl-case" data-testid="current-case">
                    <div className="hl-casehead"><span className={`hl-status ${c.status}`}>{c.status_ar}</span>{c.theme_ar && <span className="hl-chip">{c.theme_ar}</span>}<span className="hl-muted">{c.mine ? 'قضيتك' : `قضية ${c.author}`} · {fmt(c.created_at)}</span></div>
                    <h3>{c.title_ar}</h3><p className="hl-body">{c.body_ar}</p>
                    {c.commitment_ar && <div className="hl-commit"><b>الالتزام</b><p>{c.commitment_ar}</p><small>العودة {fmt(c.return_due_at)}{c.status === 'committed' && daysLeft(c.return_due_at) !== null ? (daysLeft(c.return_due_at)! >= 0 ? ` · بعد ${daysLeft(c.return_due_at)} يوم` : ` · تأخرت ${-daysLeft(c.return_due_at)!} يوم`) : ''}</small></div>}
                    {c.return_ar && <div className="hl-return"><b>العودة — {c.return_outcome === 'succeeded' ? 'نجح' : c.return_outcome === 'struggled' ? 'تعثّر' : 'تغيّر الفهم'}</b><p>{c.return_ar}</p></div>}
                    {c.pulse && <div className="hl-pulse"><span>{c.pulse.questions} سؤالًا</span><span>{c.pulse.advice} نصيحة</span><span>{c.pulse.evidence} دليلًا</span><span>{c.pulse.voices} أصوات</span></div>}
                  </article>
                  <div className="hl-thread" data-testid="thread">
                    {!(c.posts || []).length && <p className="hl-muted">لا مداخلات بعد — ابدأ بسؤال.</p>}
                    {(c.posts || []).map((p: any) => <div key={p.id} className={`hl-post ${p.kind} ${p.mine ? 'mine' : ''}`}><div className="hl-postmeta"><b>{p.author}</b><span className="hl-kind">{KIND_AR[p.kind]}</span><small>{fmt(p.created_at)}</small></div><p>{p.body_ar}</p>{p.media_id && <small className="hl-muted">🎥 تسجيل مرفق</small>}</div>)}
                  </div>
                  {c.status !== 'closed' && h.me.signed && (
                    <div className="pt-box hl-compose" data-testid="compose">
                      <div className="hl-kinds">{(['question', 'advice', 'evidence'] as const).map(k => <button key={k} className={post.kind === k ? 'on' : ''} onClick={() => setPost({ ...post, kind: k })}>{KIND_AR[k]}</button>)}<span className="hl-muted">{post.kind === 'question' ? 'سؤال يساعد صاحب القضية على الرؤية' : post.kind === 'advice' ? 'نصيحة — بعد أن سُئل' : 'دليل: تجربة موثَّقة أو مرجع أو رقم'}</span></div>
                      <Channel lang={lang} value={post.body} onChange={v => setPost({ ...post, body: v })} tok={tok || undefined} context={{ type: 'dialogue', id: c.id, title: c.title_ar }} rows={3} maxLength={3000} compact placeholder="اكتب أو تكلّم…" onMedia={m => setPost({ ...post, media_id: m.id })} testId="post-body" />
                      <button className="pt-btn small" disabled={!!busy} onClick={async () => { const j = await act({ action: 'post', case_id: c.id, ...post }); if (j) setPost({ kind: 'question', body: '', media_id: '' }); }} data-testid="post-send"><Icon name="send" size={14} /> أرسل</button>
                    </div>
                  )}
                  {c.mine && c.status === 'open' && (
                    <div className="pt-box hl-commitbox" data-testid="commit-box"><h3><Icon name="flag" size={16} /> التزامي</h3><p className="hl-muted">ماذا ستفعل، ومتى؟ تعود بعد {d!.constants.return_days} يومًا بما حدث فعلًا — وكاتب المجلس يوثّق.</p>
                      <textarea className="hl-in" rows={3} value={commit} onChange={e => setCommit(e.target.value)} placeholder="سأ… خلال…" data-testid="commit-text" />
                      <button className="pt-btn gold" disabled={!!busy} onClick={async () => { const j = await act({ action: 'commit', case_id: c.id, commitment: commit }, 'سُجّل التزامك — موعد العودة بعد أسبوعين'); if (j) setCommit(''); }} data-testid="commit-send"><Icon name="check" size={15} /> ألتزم</button></div>
                  )}
                  {c.mine && c.status === 'committed' && (
                    <div className="pt-box hl-returnbox" data-testid="return-box"><h3><Icon name="refresh" size={16} /> العودة</h3><p className="hl-muted">ما الذي حدث فعلًا؟ الصدق هنا هو المجلس كله.</p>
                      <div className="hl-kinds">{([['succeeded', 'نجح'], ['struggled', 'تعثّر'], ['reframed', 'تغيّر فهمي']] as const).map(([k, l]) => <button key={k} className={ret.outcome === k ? 'on' : ''} onClick={() => setRet({ ...ret, outcome: k })}>{l}</button>)}</div>
                      <textarea className="hl-in" rows={4} value={ret.text} onChange={e => setRet({ ...ret, text: e.target.value })} placeholder="عدت ففعلت… وكانت النتيجة…" data-testid="return-text" />
                      <button className="pt-btn gold" disabled={!!busy} onClick={async () => { const j = await act({ action: 'return', case_id: c.id, ...ret }, 'عدت — المجلس أُبلغ ليشهد'); if (j) setRet({ text: '', outcome: 'succeeded' }); }} data-testid="return-send"><Icon name="check" size={15} /> أعود بما حدث</button></div>
                  )}
                  {(c.status === 'returned' || (c.status === 'open' && (h.me.is_chair || c.mine))) && <button className="pt-btn ghost small" disabled={!!busy} onClick={() => act({ action: 'close_case', case_id: c.id }, 'أُغلقت القضية — كاتب المجلس لخّص')} data-testid="close-case"><Icon name="check" size={14} /> إغلاق القضية</button>}
                  {!!(c.scribe || []).length && <div className="hl-scribe" data-testid="scribe">{c.scribe.map((s: any, i: number) => <div key={i} className="pt-box"><h3><Icon name="doc" size={16} /> كاتب المجلس — {s.phase === 'commitment' ? 'الالتزام' : s.phase === 'return' ? 'العودة' : 'المداولة'} <small className="hl-muted">{s.source === 'ai' ? 'ذكاء اصطناعي · بلا أسماء' : 'ملخص محلي'}</small></h3><p>{s.summary_ar}</p>{!!(s.commitments || []).length && <p><b>الالتزامات:</b> {s.commitments.join(' · ')}</p>}{!!(s.pivotal_questions || []).length && <p><b>أسئلة غيّرت المسار:</b> {s.pivotal_questions.join(' · ')}</p>}{s.unsaid_ar && <p><b>ما لم يُقل:</b> {s.unsaid_ar}</p>}</div>)}</div>}
                </>
              )}
              {!!(h.cases || []).filter((x: any) => !c || x.id !== c.id).length && <details className="hl-prev"><summary>قضايا سابقة ({h.cases.filter((x: any) => !c || x.id !== c.id).length})</summary><ul>{h.cases.filter((x: any) => !c || x.id !== c.id).map((x: any) => <li key={x.id}><b>{x.title_ar}</b> — {x.status_ar} · {x.author} · الدورة {x.cycle_no}{x.theme_ar ? ` · ${x.theme_ar}` : ''}</li>)}</ul></details>}
            </section>
          )}

          {tab === 'commit' && (
            <section className="hl-stack" data-testid="commit-tab">
              {!h.my_commitments.length && <div className="pt-box"><p className="hl-muted">لا التزامات بعد — تُسجَّل حين تلتزم على قضيتك.</p></div>}
              {h.my_commitments.map((x: any) => <div key={x.case_id} className={`pt-box hl-commitrow ${x.returned_at ? 'done' : ''}`}><b>{x.title_ar}</b><p>{x.commitment_ar}</p><small>{x.returned_at ? `عدت ${fmt(x.returned_at)} — ${x.outcome === 'succeeded' ? 'نجح' : x.outcome === 'struggled' ? 'تعثّر' : 'تغيّر الفهم'}` : `موعد العودة ${fmt(x.return_due_at)}${daysLeft(x.return_due_at) !== null ? (daysLeft(x.return_due_at)! >= 0 ? ` · بعد ${daysLeft(x.return_due_at)} يوم` : ` · تأخرت ${-daysLeft(x.return_due_at)!} يوم`) : ''}`}</small></div>)}
            </section>
          )}

          {tab === 'mirror' && (
            <section className="hl-stack" data-testid="mirror-tab">
              <div className="pt-box"><h3><Icon name="star" size={16} /> مرآتي — الدورة {h.council.cycle_no}</h3><p className="hl-muted">تصف ما فعلت، لا من أنت — وتقارنك بنفسك لا بالآخرين.</p>
                <div className="hl-bars">{[['أسئلة', h.mirror.now.questions], ['نصائح', h.mirror.now.advice], ['أدلة', h.mirror.now.evidence], ['التزامات', h.mirror.now.commitments], ['عودات', h.mirror.now.returns], ['شهدتُ', h.mirror.now.given], ['شُهد لي', h.mirror.now.received]].map(([l, v]) => <div key={String(l)} className="hl-bar"><span style={{ height: `${Math.min(100, 12 + Number(v) * 18)}%` }} /><b>{v}</b><small>{l}</small></div>)}</div>
                <ul className="hl-lines">{h.mirror.lines.map((l: any) => <li key={l.key} className={l.tone}>{l.text}</li>)}</ul>
                {h.mirror.prev && <p className="hl-muted">الدورة السابقة: {h.mirror.prev.questions} أسئلة · {h.mirror.prev.advice} نصائح · {h.mirror.prev.evidence} أدلة · {h.mirror.prev.returns} عودات.</p>}
              </div>
              <div className="pt-box" data-testid="badge-box"><h3><Icon name="award" size={16} /> شهادة عضو مجلس</h3>
                {d!.badge.issued ? <p className="hl-ok-inline"><Icon name="check" size={14} /> صدرت — <a href={d!.badge.issued.verify_url} target="_blank" rel="noreferrer">{d!.badge.issued.code}</a> (موقَّعة Ed25519، قابلة للتحقق)</p> : <><p className="hl-muted">بعد {3} دورات مكتملة و{3} شهادات أقران معتمدة وعودة واحدة على الأقل. حتى الآن: {d!.badge.stats.cycles} دورات · {d!.badge.stats.attestations_received} شهادة معتمدة · {d!.badge.stats.returns} عودة.</p>{!d!.badge.eligibility.ok ? <p className="hl-muted">ينقصك: {d!.badge.eligibility.missing_ar.join(' · ')}</p> : <button className="pt-btn gold small" disabled={!!busy} onClick={() => act({ action: 'request_badge' }, 'صدرت شهادتك')}><Icon name="award" size={14} /> أصدر شهادتي</button>}</>}
              </div>
            </section>
          )}

          {tab === 'attest' && (
            <section className="hl-stack" data-testid="attest-tab">
              {!!h.attestations.to_decide.length && <div className="pt-box hl-decide" data-testid="to-decide"><h3><Icon name="scale" size={16} /> تنتظر اعتمادك بصفتك مدير الجهة</h3>
                {h.attestations.to_decide.map((a: any) => <div key={a.id} className="hl-attrow"><div><b>{a.from}</b> يشهد لـ <b>{a.to}</b> على «{a.skill_ar}»<p>{a.evidence_ar}</p></div><div className="hl-rowbtns"><button className="pt-btn small" disabled={!!busy} onClick={() => act({ action: 'decide_attestation', id: a.id, approve: true }, 'اعتُمدت')}>اعتماد</button><button className="pt-btn ghost small" disabled={!!busy} onClick={() => act({ action: 'decide_attestation', id: a.id, approve: false }, 'رُفضت')}>رفض</button></div></div>)}</div>}
              <div className="pt-box" data-testid="attest-form"><h3><Icon name="certificate" size={16} /> أشهد لقرين</h3><p className="hl-muted">لا تقدير رقمي — دليل محدد: «رأيته يعيد صياغة الصراع إلى مصالح». تُعتمد من مدير جهته (أو الطاقم) ثم ترفع وزن الدليل في خيط أثره.</p>
                <div className="hl-grid2">
                  <select className="hl-in" value={att.to_email} onChange={e => setAtt({ ...att, to_email: e.target.value })} data-testid="attest-to"><option value="">— لمن؟ —</option>{members.filter((m: any) => !m.is_me).map((m: any) => <option key={m.email} value={m.email}>{m.full_name}{m.org_name ? ` · ${m.org_name}` : ''}</option>)}</select>
                  <select className="hl-in" value={att.skill_id} onChange={e => setAtt({ ...att, skill_id: e.target.value })} data-testid="attest-skill"><option value="">— أي مهارة؟ —</option>{skills.map((s: any) => <option key={s.id} value={s.id}>{s.name_ar}</option>)}</select>
                </div>
                <textarea className="hl-in" rows={3} value={att.evidence} onChange={e => setAtt({ ...att, evidence: e.target.value })} placeholder="ما رأيته يفعله تحديدًا في هذه الدورة…" data-testid="attest-evidence" />
                <button className="pt-btn" disabled={!!busy} onClick={async () => { const j = await act({ action: 'attest', council_id: h.council.id, case_id: c?.id || null, ...att }, 'سُجّلت شهادتك وأُرسلت للاعتماد'); if (j) setAtt({ to_email: '', skill_id: '', evidence: '' }); }} data-testid="attest-send"><Icon name="send" size={15} /> أشهد</button>
              </div>
              <div className="hl-grid2">
                <div className="pt-box"><h3>شُهد لي ({h.attestations.received.length})</h3>{!h.attestations.received.length && <p className="hl-muted">لا شهادات بعد.</p>}{h.attestations.received.map((a: any) => <div key={a.id} className={`hl-attmini ${a.status}`}><b>{a.skill_ar}</b> — {a.from}<p>{a.evidence_ar}</p><small>{a.status === 'approved' ? `معتمدة (${a.approver_role === 'staff' ? 'الطاقم' : 'مدير الجهة'})` : a.status === 'declined' ? 'مرفوضة' : 'بانتظار الاعتماد'}</small></div>)}</div>
                <div className="pt-box"><h3>شهدتُ ({h.attestations.given.length})</h3>{!h.attestations.given.length && <p className="hl-muted">لم تشهد بعد.</p>}{h.attestations.given.map((a: any) => <div key={a.id} className={`hl-attmini ${a.status}`}><b>{a.skill_ar}</b> — لـ {a.to}<p>{a.evidence_ar}</p><small>{a.status === 'approved' ? 'معتمدة' : a.status === 'declined' ? 'مرفوضة' : 'بانتظار الاعتماد'}</small></div>)}</div>
              </div>
            </section>
          )}

          {tab === 'members' && (
            <section className="hl-stack" data-testid="members-tab">
              <div className="pt-box"><h3><Icon name="users" size={16} /> الأعضاء ({members.length}) — النصاب {h.quorum.ok ? 'مكتمل' : 'غير مكتمل'}</h3>
                <ul className="hl-members">{members.map((m: any) => <li key={m.email}><b>{m.full_name}</b>{m.is_me && <small> (أنت)</small>}{m.role === 'chair' && <span className="hl-chair">الكرسي</span>}<span className="hl-muted">{m.org_name || 'بلا جهة'} · {m.cycles_completed} دورات · {m.signed ? 'وقّع الميثاق' : 'لم يوقّع'}</span></li>)}</ul></div>
              <div className="pt-box"><h3><Icon name="scale" size={16} /> ميثاق المجلس v{d!.charter.version}</h3><ol className="hl-charter">{d!.charter.clauses.map(cl => <li key={cl.id}><b>{cl.title}</b> — {cl.body}</li>)}</ol></div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

const CSS = `
.hl{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;max-width:1000px;margin:0 auto;padding:28px 18px 60px}
.hl-head h1{margin:4px 0 6px;font-size:30px;color:#0f2a4e}.hl-head p{margin:0 0 18px;color:#475569;line-height:1.9}
.hl-orgcharter{display:flex;gap:8px;align-items:center;flex-wrap:wrap;border-radius:12px;padding:9px 14px;font-size:13px;margin:0 0 12px}.hl-orgcharter.ok{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0}.hl-orgcharter.no{background:#f8fafc;color:#475569;border:1px solid #e2e8f0}.hl-orgcharter a{color:#0b8a83}
.hl-muted{color:#64748b;font-size:13px;line-height:1.8}.hl-err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}.hl-ok{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}.hl-ok-inline{color:#065f46;font-weight:800;display:flex;gap:6px;align-items:center}
.hl-invite{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;background:linear-gradient(135deg,#fffbeb,#fff);border:1px solid #fcd34d;border-radius:18px;padding:18px;margin:12px 0}.hl-invite ul{margin:8px 0 0;padding-inline-start:18px;font-size:13px;line-height:1.8;color:#334155}
.hl-empty{text-align:center;color:#334155}.hl-empty b{display:block;margin:8px 0 4px;color:#0f2a4e;font-size:17px}
.hl-switch{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.hl-switch button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:6px 14px;font:inherit;font-weight:800;color:#334155}.hl-switch button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.hl-top{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:18px;margin:12px 0}.hl-top h2{margin:0 0 4px;color:#0f2a4e;font-size:22px}.hl-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.hl-chip{display:inline-block;background:#f0fdfa;color:#0b8a83;border:1px solid #99f6e4;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800}.hl-actions{display:flex;flex-direction:column;gap:6px;align-items:flex-end}
.hl-warn{background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:10px 14px;margin:8px 0;display:flex;gap:10px;align-items:center;font-weight:800;color:#92400e}
.hl-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0}.hl-tabs button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:8px 16px;font:inherit;font-weight:900;color:#334155;display:inline-flex;gap:6px;align-items:center}.hl-tabs button.on{background:#0b8a83;color:#fff;border-color:#0b8a83}.hl-tabs i{font-style:normal;background:#c9a24b;color:#1f2937;border-radius:999px;font-size:11px;padding:1px 7px}
.hl-stack{display:grid;gap:14px}.hl-in{width:100%;box-sizing:border-box;font:inherit;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;margin:8px 0;background:#fff}
.hl-case{background:linear-gradient(135deg,#0f2a4e,#123a66);color:#fff;border-radius:20px;padding:20px}.hl-casehead{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px}.hl-casehead .hl-muted{color:#cbd5e1}.hl-status{background:#c9a24b;color:#1f2937;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:900}.hl-status.committed{background:#fbbf24}.hl-status.returned{background:#34d399}.hl-status.closed{background:#94a3b8}
.hl-case h3{margin:0 0 8px;font-size:20px}.hl-body{white-space:pre-wrap;line-height:1.95;margin:0;color:#e2e8f0}.hl-commit,.hl-return{background:rgba(255,255,255,.1);border-radius:12px;padding:10px 14px;margin-top:12px}.hl-commit b,.hl-return b{color:#c9a24b}.hl-commit p,.hl-return p{margin:4px 0;white-space:pre-wrap}.hl-commit small{color:#cbd5e1}
.hl-pulse{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;font-size:12px;color:#cbd5e1}.hl-pulse span{background:rgba(255,255,255,.08);border-radius:999px;padding:3px 10px}
.hl-thread{display:grid;gap:8px}.hl-post{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:10px 14px;border-inline-start:4px solid #94a3b8}.hl-post.question{border-inline-start-color:#0b8a83}.hl-post.advice{border-inline-start-color:#c9a24b}.hl-post.evidence{border-inline-start-color:#0f2a4e}.hl-post.return_note{border-inline-start-color:#34d399}.hl-post.mine{background:#f8fafc}.hl-postmeta{display:flex;gap:8px;align-items:center;font-size:12px;color:#64748b}.hl-postmeta b{color:#0f2a4e}.hl-kind{background:#f1f5f9;border-radius:999px;padding:1px 8px;font-weight:800}.hl-post p{margin:6px 0 0;white-space:pre-wrap;line-height:1.85}
.hl-compose .hl-kinds,.hl-returnbox .hl-kinds{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px}.hl-kinds button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:5px 12px;font:inherit;font-weight:800;color:#334155}.hl-kinds button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.hl-scribe{display:grid;gap:10px}.hl-scribe p{margin:6px 0;line-height:1.85;font-size:14px}
.hl-prev summary{cursor:pointer;font-weight:800;color:#0f2a4e}.hl-prev ul{margin:8px 0 0;padding-inline-start:18px;font-size:13px;line-height:1.9}
.hl-commitrow p{margin:6px 0;white-space:pre-wrap}.hl-commitrow.done{opacity:.8}.hl-commitrow small{color:#64748b}
.hl-bars{display:flex;gap:10px;align-items:flex-end;height:120px;margin:12px 0}.hl-bar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%}.hl-bar span{width:100%;max-width:38px;background:linear-gradient(180deg,#0b8a83,#0f2a4e);border-radius:8px 8px 0 0;transition:height .4s}.hl-bar b{font-size:14px;margin-top:4px}.hl-bar small{font-size:11px;color:#64748b}
.hl-lines{margin:8px 0 0;padding:0;list-style:none;display:grid;gap:6px}.hl-lines li{padding:8px 12px;border-radius:10px;font-size:14px;line-height:1.8;background:#f8fafc}.hl-lines li.good{background:#ecfdf5;color:#065f46}.hl-lines li.note{background:#fffbeb;color:#92400e}
.hl-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media (max-width:720px){.hl-grid2{grid-template-columns:1fr}.hl-top{flex-direction:column}}
.hl-attrow{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #e2e8f0;padding:10px 0}.hl-attrow p{margin:4px 0 0;font-size:13px;color:#334155}.hl-rowbtns{display:flex;gap:6px;align-items:flex-start}
.hl-attmini{border-top:1px solid #e2e8f0;padding:8px 0;font-size:13px}.hl-attmini p{margin:3px 0;color:#334155}.hl-attmini small{color:#64748b}.hl-attmini.approved small{color:#065f46;font-weight:800}
.hl-members{list-style:none;margin:0;padding:0;display:grid;gap:6px}.hl-members li{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 0;border-top:1px solid #f1f5f9}.hl-chair{background:#c9a24b;color:#1f2937;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:900}
.hl-charter{margin:0;padding-inline-start:18px;line-height:1.9;font-size:14px}
`;
