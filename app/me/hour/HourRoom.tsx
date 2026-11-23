'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P73 «ساعة أَثَر» — غرفة الساعة (تُحمَّل ديناميكيًا بلا SSR) — صفحة واحدة للمشارك والأستاذ بصلاحيات مختلفة
 *  /me/hour                      → شُعبي: بطاقة لكل شعبة (الطور الآن · الموعد · سطر آخر ساعة)
 *  /me/hour?classroom=<id>       → الغرفة بالترتيب: 1 «ما كتبناه هذا الأسبوع» (k ≥ 5 · أحمله معي) → 2 «دقيقة الصمت ثم كلمة واحدة» (مؤقّت 60 ث · سحابة حيّة)
 *                                  → 3 «سطر ساعتنا» (اقتراح · تصويت بلمسة لغيري) → 4 الختم (الأستاذ) → «الساعة في البيت» لمن غاب (24 ساعة)
 *  /me/hour?classroom=<id>&screen=1 → وضع شاشة القاعة: خطّ كبير · بلا إدخال · تحديث كل 10 ثوانٍ (يعرضه الأستاذ على الشاشة)
 *  لا أسماء في أي موضع · لا درجة · الأستاذ لا يكتب ولا يختار السطر.
 *  testids: hr-root[data-phase][data-role][data-screen] hr-rooms hr-room[data-id][data-phase] hr-head hr-count hr-rules hr-week hr-week-line[data-id][data-mine] hr-carry[data-id] hr-carried hr-week-below
 *           hr-silence hr-silence-left hr-word-input hr-word-send hr-my-word hr-cloud hr-cloud-word[data-n] hr-cloud-below hr-line-input hr-line-send hr-my-line hr-lines hr-line[data-id][data-votes][data-mine] hr-vote[data-id] hr-lines-below
 *           hr-seal-btn hr-seal hr-seal-line hr-seal-head hr-home hr-history hr-history-line hr-err hr-ok hr-screen-link
 *  P74 «بصوتِ واحدٍ منّا»: hr-seal-public (الأستاذ قبل الختم) · hr-voice-btn · hr-voice-rec · hr-voice-play · hr-voice-del · hr-voice-who · hr-history-play · hr-seal-public-toggle
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '../../../lib/supabase/client';
import { fastToken } from '../../components/Pocket';
import { Icon } from '../../../lib/ui/icons';
import { PHASE_AR, fmtDayAr, fmtTimeAr, WEEKDAYS_AR } from '../../../lib/hour/registry';
import type { HourView, HourRoomCard } from '../../../lib/hour/store';
import { P74_NAMES_AR } from '../../../lib/hour/heard';

const VoiceRecorder = dynamic(() => import('../../components/VoiceRecorder'), { ssr: false });

type Index = { rooms: HourRoomCard[]; names: Record<string, string>; rules_ar: string[]; now: string };
type Room = HourView & { rules_ar: string[] };
const KIND_AR: Record<string, string> = { learn: 'سطر يوم', apply: 'سطر تطبيق', commit: 'التزام' };

export default function HourRoom() {
  const db = useMemo(() => supabase(), []);
  const sp = useSearchParams(); const cid = sp.get('classroom') || ''; const screen = sp.get('screen') === '1'; /* يتبدّل مع التنقّل داخل الصفحة نفسها */
  const [tok, setTok] = useState<string | null>(null);
  const [idx, setIdx] = useState<Index | null>(null); const [v, setV] = useState<Room | null>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);
  const [word, setWord] = useState(''); const [line, setLine] = useState(''); const [silence, setSilence] = useState<number | null>(null); const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pub, setPub] = useState(true); const [rec, setRec] = useState(false); const [playUrl, setPlayUrl] = useState<string | null>(null); const [playing, setPlaying] = useState(false); const audioRef = useRef<HTMLAudioElement | null>(null); /* P74 */
  useEffect(() => { fastToken(db).then((t) => setTok(t || '')); }, [db]);
  useEffect(() => { setV(null); setErr(''); setSilence(null); }, [cid]);
  const H = useCallback(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }), [tok]);
  const load = useCallback(async (quiet = false) => {
    if (!tok) return; const j = await fetch(`/api/me/hour${cid ? `?classroom=${encodeURIComponent(cid)}` : ''}`, { headers: H(), cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    if (j?.success) { if (cid) setV(j); else setIdx(j); if (!quiet) setErr(''); } else if (!quiet) setErr(j?.error || 'تعذّر فتح الساعة');
  }, [tok, cid, H]);
  useEffect(() => { if (tok !== null) void load(); }, [tok, load]);
  /* تحديث حيّ أثناء الساعة: كل 10 ثوانٍ على الشاشة، كل 15 على الجوّال */
  useEffect(() => { if (!cid || !v || v.phase.phase !== 'open') return; const id = setInterval(() => void load(true), screen ? 10000 : 15000); return () => clearInterval(id); }, [cid, v, screen, load]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const flash = (t: string) => { setOk(t); setTimeout(() => setOk(''), 6000); };
  async function act(body: Record<string, unknown>, done?: string) {
    setBusy(true); setErr(''); const j = await fetch('/api/me/hour', { method: 'POST', headers: H(), body: JSON.stringify({ ...body, classroom_id: cid }) }).then((r) => r.json()).catch(() => null); setBusy(false);
    if (j?.success) { if (done) flash(done); await load(true); return j; } setErr(j?.error || 'تعذّر'); return null;
  }
  /* P74 «بصوتِ واحدٍ منّا»: رفع multipart · تشغيل برابط موقّع · حذف فوري */
  async function onVoice(take: { blob: Blob; sec: number }): Promise<string | null> {
    if (!v?.seal) return 'لا ختم بعد';
    const fd = new FormData(); fd.append('file', take.blob, `voice.${take.blob.type.includes('mp4') ? 'm4a' : take.blob.type.includes('ogg') ? 'ogg' : 'webm'}`); fd.append('classroom_id', cid); fd.append('seal_id', String(v.seal.id)); fd.append('duration_sec', String(take.sec));
    setBusy(true); setErr(''); const j = await fetch('/api/me/hour', { method: 'POST', headers: { Authorization: `Bearer ${tok}` }, body: fd }).then((r) => r.json()).catch(() => null); setBusy(false);
    if (j?.success) { flash(j.message || 'حُفظت قراءتك.'); setRec(false); await load(true); return null; } return j?.error || 'تعذّر الرفع';
  }
  async function play(url: string | null, sealId?: number) {
    let u = url; if (!u && sealId) { const j = await fetch(`/api/me/hour?classroom=${cid}&voice=${sealId}`, { headers: H() }).then((r) => r.json()).catch(() => null); u = j?.success ? j.url : null; if (!u) { setErr(j?.error || 'تعذّر جلب القراءة'); return; } }
    if (!u) return; setPlayUrl(u); setPlaying(true); setTimeout(() => { audioRef.current?.play().catch(() => setPlaying(false)); }, 50);
  }
  useEffect(() => { if (screen && v?.last_voice_url && !playUrl) setPlayUrl(v.last_voice_url); }, [screen, v?.last_voice_url, playUrl]); /* شاشة القاعة تفتح على آخر قراءة */
  function startSilence() { if (timer.current) clearInterval(timer.current); setSilence(v?.limits.silenceSec || 60); timer.current = setInterval(() => setSilence((s) => { if (s === null || s <= 1) { if (timer.current) clearInterval(timer.current); return 0; } return s - 1; }), 1000); }

  /* ───── الفهرس ───── */
  if (!cid) return <main className="hr" dir="rtl" data-testid="hr-root" data-phase="" data-role="" data-screen="0"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <header className="hr-head"><span className="hr-kicker"><Icon name="users" size={14} /> {idx?.names.official || 'لقاء التأمل الأسبوعي للشعبة'}</span><h1>🕰️ ساعة أَثَر</h1><p className="hr-sub">ساعة أسبوعية ثابتة لكل شعبة بلا تعليم ولا تصحيح: نقرأ ما كتبناه، يحمل كلٌّ سطرًا لغيره، كلمة واحدة بعد دقيقة صمت، وسطر واحد نختمه معًا.</p></header>
    {err && <p className="hr-err" data-testid="hr-err">{err}</p>}
    {idx && (idx.rooms.length ? <section className="hr-rooms" data-testid="hr-rooms">{idx.rooms.map((r) => <Link key={r.classroom_id} href={`/me/hour?classroom=${r.classroom_id}`} className="hr-room" data-testid="hr-room" data-id={r.classroom_id} data-phase={r.phase}>
      <b>شعبة {r.code}{r.section_name ? ` — ${r.section_name}` : ''}</b><small>{r.program_ar}{r.role === 'instructor' ? ' · أستاذ الشعبة' : ''}</small>
      <span className={`hr-badge ${r.phase}`}>{PHASE_AR[r.phase]}{r.phase === 'open' && r.minutes_left !== null ? ` · بقي ${r.minutes_left} د` : ''}</span>
      {r.pin ? <small>كل {WEEKDAYS_AR[r.pin.weekday]} {r.pin.time}{r.pin.next ? ` · القادمة ${fmtDayAr(r.pin.next.day)}` : ''}</small> : <small>{r.role === 'instructor' ? 'ثبّتها من «دفتر اليوم»' : 'لم يثبّت الأستاذ موعدها بعد'}</small>}
      {r.sealed_line && <q>{r.sealed_line}</q>}
    </Link>)}</section> : <p className="hr-muted">لا شُعب لك بعد — حين تُسكَّن في شعبة تجد ساعتها هنا.</p>)}
    {idx && <section className="hr-rules" data-testid="hr-rules"><h2>قواعد الساعة</h2><ol>{idx.rules_ar.map((r, i) => <li key={i}>{r}</li>)}</ol></section>}
    <p className="hr-foot"><Link href="/me/line">← سطري</Link> · <Link href="/me/level">صفحة مستواي</Link> · <Link href="/me">صفحتي</Link></p>
  </main>;

  /* ───── الغرفة ───── */
  const ph = v?.phase.phase || ''; const canW = v?.role === 'learner' && (ph === 'open' || ph === 'home') && !v?.seal; const canCarry = v?.role === 'learner' && (ph === 'open' || ph === 'home');
  return <main className={`hr${screen ? ' screen' : ''}`} dir="rtl" data-testid="hr-root" data-phase={ph} data-role={v?.role || ''} data-screen={screen ? 1 : 0}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <header className="hr-head" data-testid="hr-head">
      {!screen && <Link href="/me/hour" className="hr-back"><Icon name="arrow" size={14} /> كل شُعبي</Link>}
      <h1>🕰️ ساعة أَثَر{v ? ` — شعبة ${v.room.code}` : ''}</h1>
      {v && <p className="hr-sub">{v.program_ar} · <b data-testid="hr-count">{PHASE_AR[ph as keyof typeof PHASE_AR]}{ph === 'open' && v.phase.minutes_left !== null ? ` · بقي ${v.phase.minutes_left} دقيقة` : ''}{ph === 'before' && v.phase.session ? ` · ${fmtDayAr(v.phase.session.day)} ${fmtTimeAr(v.phase.session.starts_at)}` : ''}</b>{v.pin ? ` · كل ${WEEKDAYS_AR[v.pin.weekday]} ${v.pin.time}` : ''}</p>}
      {v && v.role === 'instructor' && !screen && ph === 'open' && <a className="hr-btn ghost" href={`/me/hour?classroom=${cid}&screen=1`} target="_blank" rel="noreferrer" data-testid="hr-screen-link">🖥️ اعرض على شاشة القاعة</a>}
    </header>
    {err && <p className="hr-err" data-testid="hr-err">{err}</p>}{ok && <p className="hr-ok" data-testid="hr-ok">{ok}</p>}
    {v && ph === 'none' && <section className="hr-box"><p>{v.role === 'instructor' ? 'لم تُثبَّت الساعة بعد — من «دفتر اليوم» اختر يوم الأسبوع والوقت لشعبتك.' : 'لم يثبّت الأستاذ موعد الساعة بعد.'}</p>{v.role === 'instructor' && <Link href={`/me/day?room=${cid}#hour`} className="hr-btn">ثبّتها من دفتر اليوم</Link>}</section>}
    {v && ph === 'before' && v.phase.session && <section className="hr-box"><p>الساعة القادمة: <b>{fmtDayAr(v.phase.session.day)} {fmtTimeAr(v.phase.session.starts_at)}</b> — تُفتح قبلها بعشر دقائق.</p><p className="hr-muted">حتى ذلك الحين: اكتب سطر يومك في «سطري» — هو ما سنقرؤه معًا.</p></section>}
    {v && ph === 'closed' && <section className="hr-box"><p>انتهت آخر ساعة ولا موعد قادم{v.role === 'instructor' ? ' — ثبّت موعدًا جديدًا من «دفتر اليوم»' : ''}.</p></section>}
    {v && ph === 'home' && !screen && <section className="hr-home" data-testid="hr-home"><b>الساعة في البيت</b> — فاتتك الساعة أو انتهت؟ الصفحة مفتوحة لك حتى {new Date(v.phase.home_until || v.now).toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit', weekday: 'long' })}: اقرأ · احمل سطرًا · اكتب كلمتك{v.seal ? '' : ' · اقترح وصوّت'}.</section>}

    {v && (ph === 'open' || ph === 'home' || ph === 'closed') && v.day && <>
      {/* 1 ما كتبناه هذا الأسبوع */}
      <section className="hr-box" data-testid="hr-week"><h2>١ · ما كتبناه هذا الأسبوع</h2><p className="hr-muted">{v.week.head_ar}</p>
        {v.week.shown ? <ul className="hr-weeklines">{v.week.lines.map((l) => <li key={l.id} data-testid="hr-week-line" data-id={l.id} data-mine={l.mine ? 1 : 0}><span className="hr-kind">{KIND_AR[l.kind] || ''}</span><p>{l.text}</p>
          {canCarry && !l.mine && !screen && <button type="button" className={`hr-btn sm${v.carried?.id === l.id ? ' on' : ''}`} disabled={busy} data-testid="hr-carry" data-id={l.id} onClick={() => act({ action: 'carry', line_id: l.id }, 'حملتَه معك — وسيعرف صاحبه أن سطره سافر، بلا اسمك.')}>{v.carried?.id === l.id ? '✓ أحمله معي' : 'أحمله معي'}</button>}
          {l.mine && <small className="hr-mine">سطرك</small>}</li>)}</ul> : <p className="hr-below" data-testid="hr-week-below">تظهر السطور حين يكتب خمسة — بلا أسماء.</p>}
        {v.carried && !screen && <p className="hr-carried" data-testid="hr-carried">🎒 ما أحمله معي هذا الأسبوع: «{v.carried.text}»</p>}
      </section>
      {/* 2 دقيقة الصمت ثم كلمة واحدة */}
      <section className="hr-box" data-testid="hr-silence"><h2>٢ · دقيقة الصمت ثم كلمة واحدة</h2>
        {!screen && canW && !v.my_word && <div className="hr-sil">{silence === null ? <button type="button" className="hr-btn ghost" onClick={startSilence}>ابدأ دقيقة الصمت</button> : silence > 0 ? <b className="hr-sil-left" data-testid="hr-silence-left">{silence}</b> : <span className="hr-muted">انتهت الدقيقة — كلمة واحدة عن أسبوعك:</span>}</div>}
        {screen && ph === 'open' && !v.cloud.shown && <p className="hr-screen-cue">دقيقة صمت… ثم كلمة واحدة على جوّالك</p>}
        {!screen && canW && !v.my_word && (silence === 0 || silence === null) && <form className="hr-form" onSubmit={(e) => { e.preventDefault(); if (word.trim()) void act({ action: 'word', text: word }, 'كلمتك في السحابة.').then((j) => { if (j) setWord(''); }); }}>
          <input className="hr-input" value={word} onChange={(e) => setWord(e.target.value)} maxLength={v.limits.wordMax} placeholder="كلمة واحدة" data-testid="hr-word-input" aria-label="كلمة واحدة عن أسبوعك" /><button type="submit" className="hr-btn" disabled={busy || !word.trim()} data-testid="hr-word-send">إرسال</button></form>}
        {v.my_word && !screen && <p className="hr-my" data-testid="hr-my-word">كلمتي: <b>{v.my_word}</b></p>}
        <p className="hr-muted">{v.cloud.head_ar}</p>
        {v.cloud.shown ? <div className="hr-cloud" data-testid="hr-cloud">{v.cloud.items.map((c) => <span key={c.word} data-testid="hr-cloud-word" data-n={c.n} style={{ fontSize: `${Math.min(screen ? 72 : 34, (screen ? 22 : 15) + c.n * (screen ? 10 : 5))}px` }}>{c.word}{c.n > 1 && <i>{c.n}</i>}</span>)}</div> : <p className="hr-below" data-testid="hr-cloud-below">تظهر السحابة حين يكتب خمسة.</p>}
      </section>
      {/* 3 سطر ساعتنا */}
      <section className="hr-box" data-testid="hr-lines-box"><h2>٣ · سطر ساعتنا</h2>
        {!screen && canW && !v.my_line && <form className="hr-form" onSubmit={(e) => { e.preventDefault(); if (line.trim()) void act({ action: 'line', text: line }, 'اقتراحك بين السطور — صوّت الآن لسطر غيرك.').then((j) => { if (j) setLine(''); }); }}>
          <input className="hr-input wide" value={line} onChange={(e) => setLine(e.target.value)} maxLength={v.limits.lineMax} placeholder="سطر واحد يلخّص ساعتنا هذا الأسبوع" data-testid="hr-line-input" aria-label="سطر مقترح" /><button type="submit" className="hr-btn" disabled={busy || line.trim().length < v.limits.lineMin} data-testid="hr-line-send">اقترح</button></form>}
        {v.my_line && !screen && <p className="hr-my" data-testid="hr-my-line">سطري المقترَح: «{v.my_line.text}»</p>}
        <p className="hr-muted">{v.lines.head_ar}</p>
        {v.lines.shown ? <ul className="hr-lines" data-testid="hr-lines">{v.lines.lines.map((l) => <li key={l.id} data-testid="hr-line" data-id={l.id} data-votes={l.votes} data-mine={l.mine ? 1 : 0}><p>{l.text}</p><span className="hr-votes">{l.votes > 0 ? `${l.votes} ${l.votes === 1 ? 'صوت' : l.votes === 2 ? 'صوتان' : l.votes <= 10 ? 'أصوات' : 'صوتًا'}` : ''}</span>
          {canW && !l.mine && !screen && <button type="button" className={`hr-btn sm${v.lines.my_vote === l.id ? ' on' : ''}`} disabled={busy} data-testid="hr-vote" data-id={l.id} onClick={() => act({ action: 'vote', line_id: l.id }, 'صوتك محفوظ — وتستطيع تبديله حتى الختم.')}>{v.lines.my_vote === l.id ? '✓ صوتي' : 'هذا سطرنا'}</button>}</li>)}</ul> : <p className="hr-below" data-testid="hr-lines-below">يبدأ التصويت حين يقترح خمسة.</p>}
      </section>
      {/* 4 الختم */}
      {v.seal ? <section className="hr-seal" data-testid="hr-seal" data-voice={v.seal.voice ? 1 : 0}><span className="hr-kicker">سطر ساعتنا · {fmtDayAr(v.day)}</span>{v.seal.line ? <p className="hr-seal-line" data-testid="hr-seal-line">«{v.seal.line}»</p> : <p className="hr-muted">خُتمت بلا سطر هذه المرّة — الأسبوع القادم سطرنا.</p>}<small data-testid="hr-seal-head">{v.seal.head_ar}</small>{!screen && <p className="hr-muted">دخل السطر نسيجَ الشعبة وصفحةَ مستوى كل من حضر.{v.seal.public ? '' : ' لا يظهر في «سمعناكم».'}</p>}
        {v.seal.line && <div className="hr-voice" data-testid="hr-voice">
          {v.seal.voice ? <>
            <button type="button" className="hr-btn gold" data-testid="hr-voice-play" onClick={() => play(v.seal!.voice_url, v.seal!.id)}>{playing && playUrl ? '🔊 يُقرأ الآن…' : `▶️ ${P74_NAMES_AR.voice} · ${v.seal.voice.sec} ث`}</button>
            <small data-testid="hr-voice-who">{v.seal.voice.mine ? 'هذه قراءتك — لزملائك وأستاذك داخل الشعبة فقط' : 'قرأه واحدٌ منّا — بلا اسم'}</small>
            {!screen && (v.seal.voice.mine || v.role === 'instructor') && <button type="button" className="hr-btn sm ghost" disabled={busy} data-testid="hr-voice-del" onClick={() => { if (confirm(v.seal!.voice!.mine ? 'تُحذف قراءتك فورًا ولا تُستعاد. نتابع؟' : 'تُحذف قراءة المشارك فورًا (بقرار الأستاذ). نتابع؟')) void act({ action: 'voice_delete', seal_id: v.seal!.id }, v.seal!.voice!.mine ? 'حُذفت قراءتك.' : 'حُذفت القراءة.'); }}>{v.seal.voice.mine ? '🗑️ احذف قراءتي' : '🗑️ احذف القراءة'}</button>}
          </> : !screen && v.can_voice && (ph === 'open' || ph === 'home') && <>
            {!rec && <button type="button" className="hr-btn ghost light" data-testid="hr-voice-btn" onClick={() => setRec(true)}>🎙️ {P74_NAMES_AR.voice_btn}</button>}
            {rec && <div className="hr-voice-rec"><p className="hr-consent" data-testid="hr-voice-consent">{P74_NAMES_AR.consent}</p><VoiceRecorder ar maxSec={v.voice_limits.sec} hint="اقرأ سطر شعبتنا بصوتك — قراءة واحدة، لا تعليق ولا إضافة" sendLabel="أرسل قراءتي" testid="hr-voice-rec" onSend={onVoice} onCancel={() => setRec(false)} /></div>}
          </>}
          {!v.seal.voice && screen && <small className="hr-muted">لم يقرأه أحد بعد — «بصوتِ واحدٍ منّا» من جوّال مشارك</small>}
          {playUrl && <audio ref={audioRef} src={playUrl} controls={screen} preload="auto" onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} data-testid="hr-voice-audio" style={{ width: '100%', marginTop: 8 }} />}
        </div>}
        {!screen && v.role === 'instructor' && <label className="hr-check light" data-testid="hr-seal-public-toggle"><input type="checkbox" checked={v.seal.public} disabled={busy} onChange={(e) => void act({ action: 'seal_public', seal_id: v.seal!.id, public: e.target.checked }, e.target.checked ? 'يجوز ظهور السطر في «سمعناكم».' : 'أُخرج السطر من «سمعناكم».')} /> {P74_NAMES_AR.public_label}</label>}
      </section>
        : v.role === 'instructor' && !screen && (ph === 'open' || ph === 'home') && <section className="hr-box hr-sealbox"><p className="hr-muted">حضر حتى الآن (كتب أو حمل أو صوّت): كلمات {v.counts.words} · سطور {v.counts.lines} · أصوات {v.counts.votes} · محمول {v.counts.carries}. الختم يختار الأعلى أصواتًا — وعند التعادل الأقصر — ولا يختار الأستاذ.</p>
          <label className="hr-check" data-testid="hr-seal-public"><input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} /> {P74_NAMES_AR.public_label}</label>
          <button type="button" className="hr-btn gold" disabled={busy} data-testid="hr-seal-btn" onClick={() => { if (confirm('تُختم الساعة الآن: يُثبَّت السطر الأعلى أصواتًا ويصل الشعبة، وتُحفظ الأعداد لا الأسماء. نتابع؟')) void act({ action: 'seal', public: pub }, 'خُتمت الساعة.'); }}>🔏 اختم الساعة</button></section>}
    </>}
    {v && v.history.length > 0 && !screen && <section className="hr-box" data-testid="hr-history"><h2>ساعاتنا السابقة</h2><ul className="hr-hist">{v.history.map((h) => <li key={h.day} data-testid="hr-history-line" data-voice={h.voice ? 1 : 0}><small>{fmtDayAr(h.day)}{h.voice ? ' · 🎙️ بصوتِ واحدٍ منّا' : ''}</small><p>«{h.line}»</p>{h.voice && <button type="button" className="hr-btn sm" data-testid="hr-history-play" data-id={h.id} onClick={() => play(null, h.id)}>▶️ {h.voice.sec} ث</button>}</li>)}</ul></section>}
    {v && !screen && <section className="hr-rules" data-testid="hr-rules"><h2>قواعد الساعة</h2><ol>{v.rules_ar.map((r, i) => <li key={i}>{r}</li>)}</ol></section>}
    {!screen && <p className="hr-foot"><Link href="/me/hour">← كل شُعبي</Link> · <Link href="/me/line">سطري</Link> · <Link href="/me/level">صفحة مستواي</Link>{v?.role === 'instructor' && <> · <Link href={`/me/day/weave?classroom=${cid}`}>نسيج الشعبة</Link></>}</p>}
  </main>;
}

const CSS = `
.hr{max-width:860px;margin:0 auto;padding:18px 14px 40px;font-family:inherit;color:#2A1626}
.hr-head{margin-bottom:12px}.hr-head h1{margin:4px 0 6px;font-size:28px;color:#3A1F36}.hr-sub{margin:0;color:#5C4858;line-height:1.8}.hr-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#8A5A1E}
.hr-back{color:#3A1F36;text-decoration:none;font-size:13px;font-weight:700}.hr-back:hover{text-decoration:underline}
.hr-box{background:#fff;border:1px solid #EADFD6;border-radius:16px;padding:14px 16px;margin:0 0 12px}.hr-box h2{margin:0 0 6px;font-size:18px;color:#3A1F36}
.hr-muted{color:#8E7F8A;font-size:13px;line-height:1.8;margin:4px 0}.hr-below{color:#B3A5AE;font-size:13px;margin:6px 0 0}
.hr-err{background:#FBEDE7;color:#9A3A2A;border:1px solid #F3C4B6;border-radius:12px;padding:8px 12px}.hr-ok{background:#E6F3F1;color:#1F4F4A;border:1px solid #BFE1DC;border-radius:12px;padding:8px 12px}
.hr-btn{display:inline-flex;align-items:center;gap:6px;background:#3A1F36;color:#fff;border:0;border-radius:999px;padding:9px 16px;font:inherit;font-weight:800;cursor:pointer;text-decoration:none}.hr-btn:disabled{opacity:.5;cursor:default}.hr-btn.ghost{background:#fff;color:#3A1F36;border:1px solid #D9CBC2}.hr-btn.sm{padding:5px 11px;font-size:13px}.hr-btn.on{background:#8A5A1E}.hr-btn.gold{background:#8A5A1E}
.hr-rooms{display:grid;gap:10px}.hr-room{display:grid;gap:4px;background:#fff;border:1px solid #EADFD6;border-radius:14px;padding:12px 14px;text-decoration:none;color:inherit}.hr-room b{color:#3A1F36}.hr-room small{color:#8E7F8A;font-size:12px}.hr-room q{color:#8A5A1E;font-weight:700;quotes:"«" "»"}
.hr-badge{display:inline-block;font-size:12px;font-weight:800;border-radius:999px;padding:2px 10px;background:#F6EBE0;color:#5C4858;width:max-content}.hr-badge.open{background:#E6F3F1;color:#1F4F4A}.hr-badge.home{background:#FBF4EE;color:#8A5A1E}.hr-badge.before{background:#F3E8EF;color:#6A3350}
.hr-home{background:#FBF4EE;border:1px solid #E9C98A;border-radius:14px;padding:10px 14px;margin:0 0 12px;line-height:1.8;color:#8A5A1E}
.hr-weeklines,.hr-lines,.hr-hist{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:8px}.hr-weeklines li,.hr-lines li{display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center;background:#FBF4EE;border-radius:12px;padding:8px 12px}.hr-weeklines li p,.hr-lines li p{margin:0;grid-column:1;font-size:16px;line-height:1.7}.hr-kind{grid-column:1;font-size:11px;color:#B3A5AE}.hr-mine{color:#8A5A1E;font-size:12px}
.hr-votes{color:#8E7F8A;font-size:12px;grid-column:1}.hr-carried{background:#FBF4EE;border-radius:12px;padding:8px 12px;color:#8A5A1E;font-weight:700;margin:10px 0 0}
.hr-form{display:flex;gap:8px;margin:8px 0}.hr-input{flex:1;border:1px solid #D9CBC2;border-radius:12px;padding:10px 12px;font:inherit;font-size:17px}.hr-my{margin:6px 0;color:#3A1F36}
.hr-sil{margin:6px 0}.hr-sil-left{display:inline-block;font-size:48px;font-weight:900;color:#3A1F36;min-width:80px;text-align:center}
.hr-cloud{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:baseline;justify-content:center;padding:10px 0}.hr-cloud span{font-weight:800;color:#3A1F36;line-height:1.2}.hr-cloud span i{font-style:normal;font-size:11px;color:#8A5A1E;margin-right:3px;vertical-align:super}
.hr-seal{background:#3A1F36;color:#fff;border-radius:18px;padding:18px 20px;margin:0 0 12px;text-align:center}.hr-seal .hr-kicker{color:#E9C98A}.hr-seal-line{font-size:24px;font-weight:900;margin:8px 0;line-height:1.6}.hr-seal small{color:#D9CBC2}.hr-seal .hr-muted{color:#D9CBC2}
.hr-sealbox{border-color:#E9C98A;background:#FBF4EE}
.hr-voice{margin:12px auto 0;max-width:640px;display:grid;gap:8px;justify-items:center}.hr-voice-rec{width:100%;background:#fff;color:#3A1F36;border-radius:14px;padding:12px;text-align:start}.hr-consent{margin:0 0 8px;font-size:13px;line-height:1.8;color:#9A3A2A;background:#FBF4EE;border:1px solid #F1D9A8;border-radius:10px;padding:8px 10px}.hr-btn.light{color:#fff;border-color:rgba(255,255,255,.4)}.hr-check{display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:1.7;margin:10px 0;cursor:pointer}.hr-check.light{color:#D9CBC2;justify-content:center;margin-top:12px}.hr-hist li button{margin-top:4px}
.hr-hist li{display:grid;gap:2px}.hr-hist small{color:#B3A5AE;font-size:12px}.hr-hist p{margin:0;color:#4A3645}
.hr-rules h2{font-size:15px;margin:0 0 4px;color:#3A1F36}.hr-rules ol{margin:0;padding:0 18px 0 0;color:#5C4858;font-size:13px;line-height:1.9}
.hr-foot{color:#8E7F8A;font-size:13px;margin-top:14px}.hr-foot a{color:#3A1F36;font-weight:700;text-decoration:none}.hr-foot a:hover{text-decoration:underline}
.hr.screen{max-width:1400px;padding:30px 40px;font-size:22px}.hr.screen .hr-head h1{font-size:44px}.hr.screen .hr-box h2{font-size:30px}.hr.screen .hr-weeklines li p,.hr.screen .hr-lines li p{font-size:26px}.hr.screen .hr-seal-line{font-size:48px}.hr.screen .hr-muted,.hr.screen .hr-below{font-size:18px}.hr.screen .hr-votes{font-size:18px}.hr-screen-cue{font-size:34px;font-weight:900;color:#8A5A1E;text-align:center;margin:10px 0}
@media (max-width:640px){.hr-head h1{font-size:24px}.hr-weeklines li,.hr-lines li{grid-template-columns:1fr}}
`;
