'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P62 «رسالة إلى نفسي بعد سنة — إلى مَن سأكون» — مكتب المتعلّم (يُحمَّل ديناميكيًا بلا SSR)
 *  1) لحظة الكتابة: بذرة سؤال · نصّ أو صوت (القناة الواحدة) · الأفق (3م · 6م · سنة · عند تخرّجي) · «أختم» → ظرف مختوم
 *  2) الانتظار: ظرف بختم يحمل تاريخ الفتح وساعته · «أحذفها الآن» · «أفتحها قبل أوانها» (موسومة)
 *  3) يوم الفتح: صفحتان متقابلتان — الرسالة القديمة يمينًا و«ما حدث فعلًا» يسارًا (أعداد) → «ردّ على نفسك القديمة» → «اكتب الرسالة التالية» → «سلسلة سنواتي»
 *  4) «رسالة الدفعة»: سطر مختوم لكل خرّيج يُفتح للدفعة بعد سنة من نهاية البرنامج (k ≥ 5) — بلا أسماء
 *  testids: sl-root sl-err sl-ok sl-write sl-prompt sl-horizon[data-h] sl-channel sl-seal sl-sealed sl-env[data-id][data-state] sl-env-open sl-env-del
 *           sl-opened[data-id][data-early] sl-body sl-early sl-mirror sl-mirror-line sl-mirror-sum sl-reply sl-reply-send sl-reply-text sl-next sl-chain sl-chain-item
 *           sl-cohort sl-cohort-prog[data-ready] sl-cohort-text sl-cohort-send sl-cohort-del sl-cohort-lines sl-cohort-line sl-foot
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { fastToken } from '../../components/Pocket';
import { Icon } from '../../../lib/ui/icons';
import { Channel, ReadAloud } from '../../components/Channel';
import { countdownAr, earlyAr, horizonAr } from '../../../lib/letters/self';
import type { LetterPublic, Horizon, MirrorLine, ChainItem } from '../../../lib/letters/self';

type Cohort = { program_id: string; program_ar: string; end_date: string; opens_ar: string; days_left: number; n: number; ready: boolean; below_k: boolean; my_line: string | null; my_id: number | null; can_write: boolean; lines: string[] };
type Legacy = { id: number | string; program_ar: string; sealed_ar: string; opened_at: string | null; opened_ar: string; unseals_ar: string; text_ar: string | null };
type Data = { legacy?: Legacy[]; letters: LetterPublic[]; chain: ChainItem[]; cohort: Cohort[]; programs: { id: string; name_ar: string; end_date: string | null }[]; horizons: { key: Horizon; label_ar: string; hint_ar: string }[]; prompts: { key: string; ar: string }[]; prompt_today: { key: string; ar: string }; limits: { minChars: number; maxChars: number; replyMax: number; cohortMax: number; maxSealed: number; kCohort: number }; names: Record<string, string>; foot_ar: string; sealed: number; now: string };
type Mirror = { lines: MirrorLine[]; summary_ar: string; quiet: boolean; days: number };
const qs = (k: string) => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get(k) : null);

export default function SelfLetter() {
  const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
  const [body, setBody] = useState(''); const [media, setMedia] = useState<string | null>(null); const [horizon, setHorizon] = useState<Horizon>('1y'); const [prog, setProg] = useState(''); const [prompt, setPrompt] = useState<string>(''); const [chainOf, setChainOf] = useState<number | null>(null); const [writing, setWriting] = useState(false);
  const [opened, setOpened] = useState<{ letter: LetterPublic; mirror: Mirror } | null>(null); const [reply, setReply] = useState(''); const [replyMedia, setReplyMedia] = useState<string | null>(null);
  const [coText, setCoText] = useState<Record<string, string>>({}); const [audio, setAudio] = useState<Record<string, string>>({});
  useEffect(() => { fastToken(db).then((t) => setTok(t || '')); }, [db]);
  const load = useCallback(async (t: string) => { const j = await fetch('/api/me/letter', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.success) { setD(j); setErr(''); if (!prompt) setPrompt(j.prompt_today?.key || ''); } else setErr(j?.error || 'تعذّر تحميل رسائلك'); }, [prompt]);
  useEffect(() => { if (tok) load(tok); }, [tok, load]);
  useEffect(() => { const door = qs('door'); if (door) setWriting(true); }, []);
  /* P63: باب «grad» من /me/after أو /me/grad — الأفق «عند تخرّجي» إن كان البرنامج لم ينتهِ، وإلا «بعد سنة» (معنى رسالة P39 القديمة نفسها) مع تثبيت البرنامج */
  useEffect(() => { if (!d || qs('door') !== 'grad') return; const p = qs('program') || ''; const pr = d.programs.find((x) => x.id === p); const today = (d.now || '').slice(0, 10); setHorizon(pr?.end_date && pr.end_date > today ? 'grad' : '1y'); if (pr) setProg(pr.id); }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 6000); };
  async function act(payload: Record<string, unknown>, label: string): Promise<any> {
    setBusy(label); const j = await fetch('/api/me/letter', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(payload) }).then((r) => r.json()).catch(() => null); setBusy('');
    if (j?.success) { setD((p) => (p ? { ...p, letters: j.letters, chain: j.chain, cohort: j.cohort, sealed: j.sealed, now: j.now } : p)); setErr(''); if (j.message) flash(j.message); } else setErr(j?.error || 'تعذّر الحفظ'); return j;
  }
  async function seal() {
    if (!d) return; const h = d.horizons.find((x) => x.key === horizon); if (!confirm(`تُختم الرسالة الآن ولا تُقرأ حتى موعدها (${h?.label_ar || ''}) — في ساعة كتابتها نفسها. نتابع؟`)) return;
    const j = await act({ action: 'write', body_ar: body, media_id: media, horizon, program_id: prog || null, prompt_key: prompt || null, context_key: qs('door') || (chainOf ? 'chain' : 'free'), chain_of: chainOf }, 'seal');
    if (j?.success) { setBody(''); setMedia(null); setChainOf(null); setWriting(false); setOpened(null); }
  }
  async function open(l: LetterPublic) {
    if (l.state !== 'ready' && l.state !== 'opened' && !confirm(`موعدها ${l.opens_ar} الساعة ${l.open_hour_ar}. فتحها الآن مسموح — لكنها ستُوسم «${'فُتحت قبل أوانها'}». تفتحها؟`)) return;
    const j = await act({ action: 'open', id: l.id }, `open${l.id}`); if (j?.success) { setOpened({ letter: j.letter, mirror: j.mirror }); setReply(j.letter.reply_ar || ''); setReplyMedia(null); setTimeout(() => document.getElementById('sl-opened')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }
  }
  async function del(l: LetterPublic) { if (!confirm('تُحذف الرسالة فورًا — نصًّا وصوتًا — ولا سلّة. نتابع؟')) return; const j = await act({ action: 'delete', id: l.id }, `del${l.id}`); if (j?.success && opened?.letter.id === l.id) setOpened(null); }
  async function sendReply() { if (!opened) return; const j = await act({ action: 'reply', id: opened.letter.id, reply_ar: reply, media_id: replyMedia }, 'reply'); if (j?.success) setOpened((p) => (p ? { ...p, letter: j.letter } : p)); }
  async function play(mediaId: string) { if (audio[mediaId]) return; const j = await fetch(`/api/media?id=${encodeURIComponent(mediaId)}`, { headers: { Authorization: `Bearer ${tok}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.success && j.url) setAudio((a) => ({ ...a, [mediaId]: j.url })); else setErr('تعذّر فتح التسجيل'); }
  const startNext = (from: LetterPublic) => { setChainOf(from.id); setWriting(true); setHorizon('1y'); setTimeout(() => document.getElementById('sl-write')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); };

  const sealed = (d?.letters || []).filter((l) => l.state !== 'opened'); const past = (d?.letters || []).filter((l) => l.state === 'opened');
  const canSeal = !!d && (body.trim().length >= d.limits.minChars || !!media) && !busy && sealed.length < d.limits.maxSealed;
  const gradOk = !!d && d.programs.some((p) => p.end_date && p.end_date > (d.now || '').slice(0, 10));
  return <main className="sl" dir="rtl" data-testid="sl-root" data-sealed={sealed.length}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <nav className="sl-nav" aria-label="تنقّل"><Link href="/me" className="sl-link"><Icon name="arrow" size={14} /> ملفّي</Link><Link href="/me/journey" className="sl-link"><Icon name="compass" size={14} /> رحلتي</Link><Link href="/me/athar-map" className="sl-link"><Icon name="spark" size={14} /> خريطة أثرك</Link><Link href="/" className="sl-link"><Icon name="home" size={14} /> الرئيسية</Link></nav>
    <header className="sl-head"><span className="pt-kicker"><Icon name="mail" size={14} /> {d?.names.official_ar || 'الرسالة المؤجَّلة للمتدرّب'}</span><h1>{d?.names.title || 'رسالة إلى نفسي بعد سنة'} <small>{d?.names.sub || 'إلى مَن سأكون'}</small></h1>
      <p>تكتب اليوم لنفسك القادمة — نصًّا أو صوتًا — وتختار متى تعود إليك. تُختم فلا يقرؤها أحد، ولا أنت، حتى موعدها؛ وتُفتح في ساعة كتابتها نفسها، ومعها «ما حدث فعلًا» منذ يومها: أعدادٌ من رحلتك أنت، لا أحكام.</p></header>
    {err && <p className="sl-err" role="alert" data-testid="sl-err">{err}</p>}
    {msg && <p className="sl-ok" role="status" data-testid="sl-ok">{msg}</p>}
    {!tok && tok !== null && <section className="pt-box"><p>سجّل الدخول لتكتب رسالتك. <Link href="/me">مساحتي</Link></p></section>}
    {d && <>
      {/* الظروف المختومة */}
      {sealed.length > 0 && <section className="sl-sealed" data-testid="sl-sealed">
        {sealed.map((l) => <article key={l.id} id={`letter-${l.id}`} className={`sl-env ${l.state}`} data-testid="sl-env" data-id={l.id} data-state={l.state}>
          <EnvelopeSvg state={l.state} date={l.opens_ar} hour={l.open_hour_ar} />
          <div className="sl-env-body">
            <b>{l.state === 'ready' ? 'رسالتك وصلت — افتحها' : l.state === 'today' ? `اليوم تُفتح — الساعة ${l.open_hour_ar}` : `مختومة · تُفتح ${countdownAr(l.days_left)}`}</b>
            <p className="sl-muted">كتبتَها {l.written_ar}{l.door_ar ? ` · ${l.door_ar}` : ''} · {horizonAr(l.horizon)} · تُفتح {l.opens_ar} الساعة {l.open_hour_ar}{l.has_media ? ' · 🎙️ بصوتك' : ''}{l.prompt_ar ? ` · «${l.prompt_ar}»` : ''}</p>
            <div className="sl-acts"><button type="button" className={`pt-btn ${l.state === 'ready' ? 'gold' : 'ghost'} small`} disabled={!!busy} onClick={() => open(l)} data-testid="sl-env-open">{l.state === 'ready' ? '✉️ افتحها' : 'أفتحها قبل أوانها'}</button><button type="button" className="pt-btn ghost small" disabled={!!busy} onClick={() => del(l)} data-testid="sl-env-del">أحذفها الآن</button></div>
          </div>
        </article>)}
      </section>}

      {/* الرسالة المفتوحة: صفحتان متقابلتان */}
      {opened && <section className="sl-opened" id="sl-opened" data-testid="sl-opened" data-id={opened.letter.id} data-early={opened.letter.opened_early ? '1' : '0'}>
        <div className="sl-page sl-then">
          <span className="sl-tag">من نفسك · {opened.letter.written_ar}</span>
          {opened.letter.opened_early && opened.letter.early_days ? <span className="sl-early" data-testid="sl-early">{earlyAr(opened.letter.early_days)}</span> : null}
          {opened.letter.prompt_ar && <p className="sl-muted">«{opened.letter.prompt_ar}»</p>}
          {opened.letter.body_ar ? <blockquote className="sl-body" data-testid="sl-body">{opened.letter.body_ar}</blockquote> : <p className="sl-body sl-muted" data-testid="sl-body">(رسالة صوتية)</p>}
          {opened.letter.media_id && (audio[opened.letter.media_id] ? <audio controls src={audio[opened.letter.media_id]} className="sl-audio" /> : <button type="button" className="pt-btn ghost small" onClick={() => play(opened.letter.media_id as string)}>▶ اسمع صوتك يومها</button>)}
          {opened.letter.body_ar && <ReadAloud text={opened.letter.body_ar} lang="ar" label="اسمعها" />}
        </div>
        <div className="sl-page sl-now" data-testid="sl-mirror">
          <span className="sl-tag">{d.names.mirror} · منذ يومها</span>
          <p className="sl-sum" data-testid="sl-mirror-sum">{opened.mirror.summary_ar}</p>
          {opened.mirror.lines.length > 0 && <ul className="sl-lines">{opened.mirror.lines.map((m) => <li key={m.key} data-testid="sl-mirror-line" data-key={m.key}><b>{m.n}</b> {m.label_ar}</li>)}</ul>}
          <p className="sl-muted">أعداد من بياناتك أنت فقط — لا نسبة تحقّق ولا حكم ولا ذكاء اصطناعي. أنت من يقرأ.</p>
          <div className="sl-reply" data-testid="sl-reply">
            <b>{d.names.reply}</b>
            {opened.letter.replied_at && opened.letter.reply_ar && !reply ? null : null}
            <Channel lang="ar" value={reply} onChange={setReply} tok={tok || undefined} context={{ type: 'free', id: `self_letter_reply_${opened.letter.id}`, title: 'ردّ على نفسي القديمة' }} rows={4} maxLength={d.limits.replyMax} compact video={false} placeholder="إلى من كتب هذه الرسالة: …" onMedia={(m) => setReplyMedia(m.id)} testId="sl-reply-text" />
            <div className="sl-acts"><button type="button" className="pt-btn small" disabled={!!busy || (!reply.trim() && !replyMedia)} onClick={sendReply} data-testid="sl-reply-send"><Icon name="save" size={13} /> {opened.letter.replied_at ? 'حدّث ردّك' : 'أرسل الردّ إلى نفسك'}</button><button type="button" className="pt-btn gold small" onClick={() => startNext(opened.letter)} data-testid="sl-next"><Icon name="mail" size={13} /> {d.names.next}</button></div>
            {opened.letter.replied_at && <p className="sl-muted">رددتَ {new Date(opened.letter.replied_at).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'long' })} — الردّ يبقى معك هنا.</p>}
          </div>
        </div>
      </section>}

      {/* الكتابة */}
      <section className="pt-box sl-write" id="sl-write" data-testid="sl-write">
        {!writing && <div className="sl-invite"><div><h2>{chainOf ? 'الرسالة التالية في سلسلتك' : sealed.length ? 'رسالة أخرى؟' : 'اكتب إلى مَن ستكون'}</h2><p className="sl-muted">بذرة اليوم: «{d.prompt_today.ar}»</p></div><button type="button" className="pt-btn gold" disabled={sealed.length >= d.limits.maxSealed} onClick={() => setWriting(true)} data-testid="sl-write-open"><Icon name="edit" size={14} /> أكتب الآن</button>{sealed.length >= d.limits.maxSealed && <p className="sl-muted">لديك {d.limits.maxSealed} رسائل مختومة — الحدّ الأقصى.</p>}</div>}
        {writing && <>
          <h2>{chainOf ? `الرسالة التالية — تكمل رسالة ${past.find((p) => p.id === chainOf)?.written_ar || ''}` : 'إلى مَن سأكون'}</h2>
          <div className="sl-prompts" data-testid="sl-prompt">{d.prompts.map((p) => <button key={p.key} type="button" className={`sl-chip ${prompt === p.key ? 'on' : ''}`} onClick={() => setPrompt(prompt === p.key ? '' : p.key)} data-key={p.key}>{p.ar}</button>)}</div>
          <Channel lang="ar" value={body} onChange={setBody} tok={tok || undefined} context={{ type: 'free', id: 'self_letter', title: 'رسالة إلى نفسي' }} rows={7} maxLength={d.limits.maxChars} video={false} placeholder={`${d.prompts.find((p) => p.key === prompt)?.ar || 'إلى نفسي القادمة:'} اكتب أو تكلّم…`} onMedia={(m) => setMedia(m.id)} testId="sl-channel" />
          <p className="sl-muted">{body.trim().length}/{d.limits.maxChars} · الحدّ الأدنى {d.limits.minChars} حرفًا (أو تسجيل){media ? ' · 🎙️ تسجيلك جاهز — يبقى معك وحدك' : ''}</p>
          <div className="sl-horizons" role="radiogroup" aria-label="متى تعود إليك؟">{d.horizons.map((h) => { const off = h.key === 'grad' && !gradOk; return <button key={h.key} type="button" role="radio" aria-checked={horizon === h.key} className={`sl-h ${horizon === h.key ? 'on' : ''}`} disabled={off} title={off ? 'لا برنامج له تاريخ نهاية قادم' : h.hint_ar} onClick={() => setHorizon(h.key)} data-testid="sl-horizon" data-h={h.key}><b>{h.label_ar}</b><small>{off ? 'لا برنامج قادم' : h.hint_ar}</small></button>; })}</div>
          {horizon === 'grad' && gradOk && d.programs.filter((p) => p.end_date).length > 1 && <select className="sl-select" value={prog} onChange={(e) => setProg(e.target.value)} aria-label="البرنامج"><option value="">أقرب برنامج ينتهي</option>{d.programs.filter((p) => p.end_date).map((p) => <option key={p.id} value={p.id}>{p.name_ar} — {p.end_date}</option>)}</select>}
          <div className="sl-acts"><button type="button" className="pt-btn gold" disabled={!canSeal} onClick={seal} data-testid="sl-seal"><Icon name="mail" size={14} /> {d.names.seal} — تُفتح {horizonAr(horizon)}</button><button type="button" className="pt-btn ghost" onClick={() => { setWriting(false); setChainOf(null); }}>إلغاء</button></div>
          <p className="sl-muted">الغرض معلَن: تُحفظ لتعود إليك أنت فقط، في موعدٍ اخترته. لا تدخل في أي تقييم.</p>
        </>}
      </section>

      {/* سلسلة سنواتي */}
      {past.length > 0 && <section className="pt-box sl-chain" data-testid="sl-chain">
        <h2>🧵 {d.names.chain} <small>{past.length}</small></h2>
        <ol className="sl-timeline">{d.chain.filter((c) => c.opened).map((c) => { const l = past.find((p) => p.id === c.id); return <li key={c.id} data-testid="sl-chain-item" data-id={c.id} className={opened?.letter.id === c.id ? 'on' : ''}>
          <span className="sl-dot" aria-hidden="true" /><div><b>{c.written_ar}</b> <small>{c.horizon_ar}{c.early ? ' · فُتحت مبكّرًا' : ''}{c.replied ? ' · رُدّ عليها' : ''}</small>
            <div className="sl-acts">{l && <button type="button" className="pt-btn ghost small" onClick={() => open(l)} data-testid="sl-chain-open">اقرأها</button>}{l && <button type="button" className="pt-btn ghost small" onClick={() => startNext(l)}>الرسالة التالية</button>}{l && <button type="button" className="pt-btn ghost small" onClick={() => del(l)}>احذفها</button>}</div></div></li>; })}</ol>
      </section>}

      {/* P63: رسائل «أصوات حول الشهادة» القديمة (P39) — قراءة فقط؛ لا ترحيل ولا حذف */}
      {d.legacy && d.legacy.length > 0 && <section className="pt-box sl-legacy" data-testid="sl-legacy">
        <h2>📜 من «أصوات حول الشهادة» <small>{d.legacy.length}</small></h2>
        <ol className="sl-timeline">{d.legacy.map((g) => <li key={g.id} data-testid="sl-legacy-item" data-opened={g.opened_at ? 1 : 0}><span className="sl-dot" aria-hidden="true" /><div><b>{g.program_ar}</b> <small>كُتبت {g.sealed_ar}{g.opened_at ? ` · فُتحت ${g.opened_ar}` : ` · مختومة — تُفتح ${g.unseals_ar}`}</small>{g.text_ar && <p className="sl-body" style={{ fontSize: 16 }}>{g.text_ar}</p>}</div></li>)}</ol>
        <p className="sl-muted">كُتبت هذه الرسائل من صفحة «ما بعد البرنامج» قبل أن يتوحّد الباب هنا؛ تبقى كما هي وتُفتح في موعدها. الرسائل الجديدة تُكتب أعلاه.</p>
      </section>}

      {/* رسالة الدفعة */}
      {d.cohort.length > 0 && <section className="pt-box sl-cohort" data-testid="sl-cohort">
        <h2>🎓 {d.names.cohort} <small>سطر واحد لكل خرّيج · يُفتح للدفعة بعد سنة من نهاية البرنامج · بلا أسماء</small></h2>
        {d.cohort.map((c) => <article key={c.program_id} className="sl-coprog" data-testid="sl-cohort-prog" data-ready={c.ready ? '1' : '0'} data-n={c.n}>
          <b>{c.program_ar}</b> <span className="sl-muted">ينتهي {c.end_date} · يُفتح الظرف {c.opens_ar}{c.days_left ? ` (${countdownAr(c.days_left)})` : ''} · {c.n >= d.limits.kCohort ? `${c.n} سطرًا` : c.n ? `${c.n} من ${d.limits.kCohort} على الأقل` : 'لا أسطر بعد'}</span>
          {c.my_line && <p className="sl-myline">سطرك: «{c.my_line}» {!c.ready && <button type="button" className="sl-x" onClick={async () => { if (confirm('يُحذف سطرك من ظرف الدفعة فورًا.')) await act({ action: 'cohort_delete', id: c.my_id }, 'codel'); }} data-testid="sl-cohort-del">احذفه</button>}</p>}
          {c.can_write && <div className="sl-corow"><input className="sl-input" maxLength={d.limits.cohortMax} value={coText[c.program_id] || ''} onChange={(e) => setCoText((s) => ({ ...s, [c.program_id]: e.target.value }))} placeholder="سطر واحد إلى دفعتك بعد سنة — بلا اسمك" data-testid="sl-cohort-text" /><button type="button" className="pt-btn small" disabled={!!busy || (coText[c.program_id] || '').trim().length < 10} onClick={() => act({ action: 'cohort_write', program_id: c.program_id, body_ar: coText[c.program_id] || '' }, 'cow')} data-testid="sl-cohort-send">أختم سطري</button></div>}
          {c.ready && <ul className="sl-colines" data-testid="sl-cohort-lines">{c.lines.map((s, i) => <li key={i} data-testid="sl-cohort-line">«{s}»</li>)}</ul>}
          {c.below_k && <p className="sl-muted">حان موعد الظرف لكن كتب أقل من {d.limits.kCohort} — يبقى مغلقًا حمايةً لهويّة الكاتبين.</p>}
        </article>)}
      </section>}
      <p className="sl-foot" data-testid="sl-foot"><Icon name="shield" size={12} /> {d.foot_ar} تُحفظ في <Link href="/me/data">ذاكرتي</Link>.</p>
    </>}
  </main>;
}

/** الظرف المختوم — SVG خفيف: ختم شمعي يحمل تاريخ الفتح وساعته */
function EnvelopeSvg({ state, date, hour }: { state: string; date: string; hour: string }) {
  const c = state === 'ready' ? '#b45309' : state === 'today' ? '#0b8a83' : '#7c2d12';
  return <svg className="sl-svg" viewBox="0 0 160 110" width="160" height="110" role="img" aria-label={`ظرف مختوم يُفتح ${date} الساعة ${hour}`} direction="rtl">
    <rect x="6" y="18" width="148" height="86" rx="8" fill="#fffbeb" stroke="#fcd34d" />
    <path d="M6 26 L80 70 L154 26" fill="none" stroke="#fcd34d" strokeWidth="2" />
    <path d="M6 26 L80 70 L154 26 L154 18 L6 18 Z" fill="#fef3c7" stroke="#fcd34d" />
    <circle cx="80" cy="66" r="17" fill={c} stroke="#fff" strokeWidth="2" />
    <text x="80" y="63" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#fff">{hour}</text>
    <text x="80" y="73" textAnchor="middle" fontSize="6" fill="#fff">{state === 'ready' ? 'افتحها' : state === 'today' ? 'اليوم' : 'مختومة'}</text>
    <text x="80" y="98" textAnchor="middle" fontSize="7" fontWeight="800" fill="#7c2d12">{date}</text>
  </svg>;
}

const CSS = `
.sl{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;max-width:1040px;margin:0 auto;padding:22px 16px 60px;overflow-wrap:anywhere;min-width:0}.sl *{box-sizing:border-box}
.sl-nav{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px}.sl-link{color:#0f2a4e;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;gap:5px;font-size:14px}.sl-link:hover{text-decoration:underline}
.sl-head h1{margin:4px 0 6px;font-size:32px;color:#0f2a4e}.sl-head h1 small{display:block;font-size:15px;color:#b45309;font-weight:800;margin-top:2px}.sl-head p{margin:0 0 14px;color:#475569;line-height:1.9;max-width:760px}
.sl-muted{color:#64748b;font-size:13px;line-height:1.8;margin:4px 0}.sl-err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}.sl-ok{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}
.sl-sealed{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin:0 0 14px}.sl-env{display:flex;gap:12px;align-items:center;background:#fff;border:1px solid #fde68a;border-radius:16px;padding:12px}.sl-env.ready{border-color:#b45309;box-shadow:0 0 0 3px #fef3c7}.sl-env.today{border-color:#0b8a83}.sl-env b{display:block;font-size:15px;color:#0f2a4e;margin-bottom:2px}.sl-svg{flex:0 0 auto}
.sl-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.sl-opened{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:0 0 14px}.sl-page{border-radius:18px;padding:18px 20px;position:relative;min-width:0}.sl-then{background:linear-gradient(160deg,#fffbeb,#fff7ed);border:1px solid #fed7aa}.sl-now{background:#fff;border:1px solid #e2e8f0}
.sl-tag{display:inline-block;font-size:12px;font-weight:800;color:#9a3412;background:#fff;border:1px solid #fed7aa;border-radius:999px;padding:2px 10px;margin-bottom:8px}.sl-now .sl-tag{color:#0f2a4e;border-color:#cbd5e1}
.sl-early{display:inline-block;margin-inline-start:6px;font-size:12px;font-weight:800;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:999px;padding:2px 10px}
.sl-body{margin:8px 0;font-size:19px;line-height:2;color:#3b1d0e;white-space:pre-wrap;font-weight:600;border:0;padding:0}.sl-audio{width:100%;margin:8px 0}
.sl-sum{font-weight:800;color:#0f2a4e;font-size:16px;line-height:1.9;margin:0 0 8px}.sl-lines{list-style:none;padding:0;margin:0 0 8px;display:grid;gap:6px}.sl-lines li{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:14px}.sl-lines b{font-size:18px;color:#b45309;margin-inline-end:6px}
.sl-reply{border-top:1px dashed #cbd5e1;margin-top:12px;padding-top:12px}.sl-reply>b{display:block;margin-bottom:6px;color:#0f2a4e}
.sl-write h2{margin:0 0 8px;font-size:20px;color:#0f2a4e}.sl-invite{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.sl-prompts{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px}.sl-chip{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;font-weight:800;color:#334155;cursor:pointer}.sl-chip.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.sl-horizons{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:10px 0}.sl-h{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:10px;text-align:center;font:inherit;cursor:pointer}.sl-h b{display:block;font-size:14px;color:#0f2a4e}.sl-h small{display:block;color:#64748b;font-size:11.5px;margin-top:2px}.sl-h.on{border-color:#b45309;background:#fffbeb;box-shadow:0 0 0 2px #fde68a}.sl-h:disabled{opacity:.5;cursor:not-allowed}
.sl-select,.sl-input{font:inherit;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;width:100%;max-width:520px}
.sl-chain h2,.sl-cohort h2{margin:0 0 10px;font-size:18px;color:#0f2a4e}.sl-chain h2 small,.sl-cohort h2 small{font-size:12px;color:#64748b;font-weight:600;margin-inline-start:6px}
.sl-timeline{list-style:none;margin:0;padding:0 14px 0 0;border-right:2px solid #fde68a}.sl-timeline li{position:relative;padding:4px 14px 12px 0}.sl-timeline li.on b{color:#b45309}.sl-dot{position:absolute;right:-20px;top:9px;width:10px;height:10px;border-radius:50%;background:#b45309;border:2px solid #fff}.sl-timeline small{color:#64748b;font-size:12px}
.sl-coprog{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin:0 0 8px}.sl-coprog>b{color:#0f2a4e}.sl-corow{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.sl-corow .sl-input{flex:1 1 260px}.sl-myline{margin:6px 0;color:#3b1d0e;font-weight:700}.sl-x{border:0;background:none;color:#b91c1c;font:inherit;font-size:12px;cursor:pointer;text-decoration:underline}
.sl-colines{margin:8px 0 0;padding:0;list-style:none;display:grid;gap:6px}.sl-colines li{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;font-weight:700;color:#3b1d0e}
.sl-foot{margin-top:18px;color:#64748b;font-size:12.5px;line-height:1.8;display:flex;gap:6px;align-items:flex-start}.sl-foot a{color:#0b8a83}
@media(max-width:760px){.sl-opened{grid-template-columns:1fr}.sl-head h1{font-size:26px}.sl-body{font-size:17px}}
@media print{.sl-nav,.sl-acts,.sl-write,.sl-reply .pt-btn{display:none}}
`;
