'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P58 «خريطة أثرك — ما قاد إلى ماذا» — مكتب المتعلّم (يُحمَّل ديناميكيًا بلا SSR)
 *  الحركات الخمس: خيوط مقترَحة من وقائعك → كلمتك «نعم — لأن…» (نصًّا أو إملاءً صوتيًا في المتصفح) أو «ليس خيطًا» → الكوكبة الحيّة → سطر المرآة → «خريطة أثري <سنة>» موقَّعة
 *  لا أسماء أشخاص · لا تقييم · الحذف فوري
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { playlistOf, playlistSeconds, VOICE_FOOT_AR, MAP_VOICE_LIMITS } from '../../../lib/map/voice'; /* P60 */
import type { PlayItem } from '../../../lib/map/voice';
const VoiceRecorder = dynamic(() => import('../../components/VoiceRecorder'), { ssr: false }); /* P60: المسجّل نفسه (P54) */
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { fastToken } from '../../components/Pocket';
import { Icon } from '../../../lib/ui/icons';
import { AtharMapSvg } from '../../components/AtharMapSvg';
import type { AtharMap, Thread, Station, RuleKey, StationKind } from '../../../lib/map/registry';
import { NOTE_MAX, fmtDays } from '../../../lib/map/registry';

type Snap = { id: string; created_at: string; year: number; code: string; digest: string; is_public: boolean; revoked_at: string | null; title_ar: string; verify_path: string; public_path: string | null };
type Data = { map: AtharMap; snapshots: Snap[]; peers?: Record<string, number> /* P59 */; rules: Record<RuleKey, { title: string; why: string }>; kinds: Record<StationKind, string>; title: { ar: string; sub_ar: string }; official: { ar: string; en: string } };
const fmt = (iso?: string | null, m: 'short' | 'long' = 'short') => { if (!iso) return ''; try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: m, year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso.slice(0, 10); } };
const tk = (t: { from: string; to: string }) => `${t.from}>${t.to}`;

export default function AtharMapDesk() {
  const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
  const [sel, setSel] = useState<string | null>(null); const [open, setOpen] = useState<string | null>(null); const [notes, setNotes] = useState<Record<string, string>>({});
  const [manual, setManual] = useState({ from: '', to: '', note: '' }); const [pub, setPub] = useState(false);
  /* P60: «اسمع خريطتك» — مشغّل متسلسل: صوت صاحب الخيط إن وُجد، وإلا قراءة النصّ في المتصفّح */
  const [play, setPlay] = useState<{ items: PlayItem[]; i: number; on: boolean } | null>(null); const audioRef = useRef<HTMLAudioElement | null>(null); const [rec, setRec] = useState<string | null>(null);
  const stopPlay = useCallback(() => { try { audioRef.current?.pause(); } catch { /* لا شيء */ } try { window.speechSynthesis?.cancel(); } catch { /* لا شيء */ } setPlay(null); }, []);
  const playFrom = useCallback(async (items: PlayItem[], i: number) => {
    if (i >= items.length) { setPlay(null); return; }
    setPlay({ items, i, on: true }); const it = items[i]; const next = () => playFrom(items, i + 1);
    if (it.voice) { const j = await fetch(`/api/me/map/voice?from=${encodeURIComponent(it.from)}&to=${encodeURIComponent(it.to)}`, { headers: { Authorization: `Bearer ${tok}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null);
      if (j?.success && j.url) { const a = audioRef.current || new Audio(); audioRef.current = a; a.src = j.url; a.onended = next; a.onerror = next; try { await a.play(); return; } catch { /* يسقط إلى القراءة */ } } }
    const readMs = Math.max(3500, 450 * it.note_ar.split(/\s+/).filter(Boolean).length); /* بلا قارئ: يبقى النصّ معروضًا زمن قراءته */
    try { const ss = window.speechSynthesis; if (!ss) { setTimeout(next, readMs); return; } ss.cancel(); const u = new SpeechSynthesisUtterance(`لأن ${it.note_ar}`); u.lang = 'ar-SA'; u.onend = next; u.onerror = next; ss.speak(u); } catch { setTimeout(next, readMs); }
  }, [tok]);
  useEffect(() => () => { try { audioRef.current?.pause(); window.speechSynthesis?.cancel(); } catch { /* لا شيء */ } }, []);
  useEffect(() => { fastToken(db).then((t) => setTok(t || '')); }, [db]);
  const load = useCallback(async (t: string) => { const j = await fetch('/api/me/map', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.success) { setD(j); setErr(''); } else setErr(j?.error || 'تعذّر تحميل خريطتك'); }, []);
  useEffect(() => { if (tok) load(tok); }, [tok, load]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 5000); };
  async function act(body: Record<string, unknown>, label: string): Promise<any> {
    setBusy(label); const j = await fetch('/api/me/map', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null); setBusy('');
    if (j?.success) { setD((p) => (p ? { ...p, map: j.map, snapshots: j.snapshots, peers: j.peers || {} } : p)); setErr(''); } else setErr(j?.error || 'تعذّر الحفظ'); return j;
  }
  /* P60: رفع/حذف الصوت — الخريطة تعود محدَّثة من الردّ */
  async function sendVoice(t: { from: string; to: string }, take: { blob: Blob; sec: number }): Promise<string | null> {
    const fd = new FormData(); fd.append('file', take.blob, `voice.${take.blob.type.includes('mp4') ? 'm4a' : take.blob.type.includes('ogg') ? 'ogg' : 'webm'}`); fd.append('from', t.from); fd.append('to', t.to); fd.append('duration_sec', String(take.sec));
    setBusy('voice'); const j = await fetch('/api/me/map/voice', { method: 'POST', headers: { Authorization: `Bearer ${tok}` }, body: fd }).then((r) => r.json()).catch(() => null); setBusy('');
    if (j?.success) { setD((p) => (p ? { ...p, map: j.map } : p)); flash(j.message || 'حُفظ صوتك — لك وحدك.'); setRec(null); return null; }
    return j?.error || 'تعذّر حفظ الصوت';
  }
  async function clearVoice(t: { from: string; to: string }) {
    if (!confirm('يُحذف صوتك فورًا ويبقى الخيط وكلمتك المكتوبة. نتابع؟')) return;
    setBusy('voice'); const j = await fetch(`/api/me/map/voice?from=${encodeURIComponent(t.from)}&to=${encodeURIComponent(t.to)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } }).then((r) => r.json()).catch(() => null); setBusy('');
    if (j?.success) { setD((p) => (p ? { ...p, map: j.map } : p)); flash(j.message || 'حُذف صوتك'); } else setErr(j?.error || 'تعذّر الحذف');
  }
  const hearOne = (t: { from: string; to: string; note_ar: string | null; decided_at: string | null; voice?: { sec: number; at: string } | null; status: string }) => { if (!map) return; const items = playlistOf([t], map.stations); if (items.length) playFrom(items, 0); };
  const map = d?.map; const stations = map?.stations || []; const byKey = useMemo(() => new Map(stations.map((s) => [s.key, s])), [stations]);
  const playlist = useMemo(() => (map ? playlistOf(map.threads, map.stations) : []), [map]); const voiced = playlist.filter((i) => i.voice).length;
  useEffect(() => { if (map && playlist.length && typeof window !== 'undefined' && /[?&]play=1/.test(window.location.search) && !play) { playFrom(playlist, 0); } /* «نادِ»: اسمع خريطتي — تشغيل تلقائي قد يمنعه المتصفّح فيبقى الزرّ جاهزًا */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map?.counts.kept]);
  const proposed = (map?.threads || []).filter((t) => t.status === 'proposed'); const kept = (map?.threads || []).filter((t) => t.status === 'kept');
  const year = Number(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date()));
  const liveSnap = (d?.snapshots || []).find((s) => s.year === year && !s.revoked_at) || null;
  const selThreads = sel ? (map?.threads || []).filter((t) => t.from === sel || t.to === sel) : [];
  const copy = async (s: string) => { try { await navigator.clipboard.writeText(s); flash('نُسخ الرابط'); } catch { /* لا حافظة */ } };
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <main className="am" dir="rtl" data-testid="am-root"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <nav className="am-nav" aria-label="تنقّل"><Link href="/me" className="am-link"><Icon name="arrow" size={14} /> ملفّي</Link><Link href="/me/journey" className="am-link"><Icon name="compass" size={14} /> رحلتي</Link><Link href="/" className="am-link"><Icon name="home" size={14} /> الرئيسية</Link></nav>
      <header className="am-head"><span className="pt-kicker"><Icon name="spark" size={14} /> {d?.official.ar || 'خريطة الأثر الذاتية للمتعلّم'}</span><h1>خريطة أثرك <small>ما قاد إلى ماذا</small></h1>
        <p>ليست خريطةَ مهارات ولا تقريرًا. كلُّ نجمة هنا محطةٌ وقعت فعلًا، وكلُّ خيطٍ بينها <b>كلمتُك أنت</b>: نقترح عليك خيطًا حين يقع حدث بعد حدث، فتقول «نعم — لأن…» أو «ليس خيطًا». لا أسماء أشخاص هنا، ولا يدخل شيء منها في أي تقييم.</p></header>
      {tok === '' && <section className="pt-box"><p>سجّل الدخول لفتح خريطتك. <Link href="/login?next=/me/athar-map">تسجيل الدخول</Link></p></section>}
      {err && <div className="am-err" role="alert">{err}</div>}{msg && <div className="am-ok" role="status">{msg}</div>}
      {tok && !d && !err && <section className="pt-box"><p className="am-muted">نجمع محطاتك…</p></section>}
      {d && map && (<>
        <section className="am-mirror" data-testid="am-mirror" aria-label="سطر المرآة">{map.mirror.lines_ar.map((l, i) => <p key={i}>{l}</p>)}
          <p className="am-muted">{map.counts.stations} محطة · {map.counts.kept} خيطًا أبقيتَه · {map.counts.proposed} ينتظر كلمتك{map.declined ? ` · ${map.declined} استبعدتَه` : ''}</p></section>

        <section className="am-sky">
          <AtharMapSvg stations={stations} threads={map.threads} layout={map.layout} selected={sel} focus={sel} rules={d.rules} title_ar={`خريطة أثرك — ${map.counts.stations} محطة`} onStation={(k) => setSel((p) => (p === k ? null : k))} onThread={(t) => { setOpen(tk(t)); setSel(null); }} active={play?.items[play.i]?.key || null} />
          {kept.length > 0 && <div className="am-player" data-testid="am-player">
            {!play ? <><button type="button" className="pt-btn small" onClick={() => playFrom(playlist, 0)} data-testid="am-play-all">▶ اسمع خريطتك</button><span className="am-muted">{playlist.length} {playlist.length === 1 ? 'خيط' : playlist.length === 2 ? 'خيطان' : 'خيوط'} · {voiced ? `${voiced} بصوتك` : 'بصوت المتصفّح'} · ≈ {playlistSeconds(playlist)} ث</span></>
              : <><button type="button" className="pt-btn small ghost" onClick={stopPlay} data-testid="am-play-stop">■ أوقف</button><button type="button" className="pt-btn small ghost" onClick={() => playFrom(play.items, play.i + 1)} data-testid="am-play-next" disabled={play.i + 1 >= play.items.length}>⏭ التالي</button>
                <span className="am-now" data-testid="am-play-now" aria-live="polite">{play.i + 1}/{play.items.length} · {play.items[play.i]?.voice ? '🎙️ بصوتك' : '🔊 بصوت المتصفّح'} — {play.items[play.i]?.title_ar}<em>«لأن {play.items[play.i]?.note_ar}»</em></span></>}
          </div>}
          {sel && byKey.get(sel) && (<aside className="am-side" data-testid="am-side">
            <button type="button" className="am-x" aria-label="إغلاق" onClick={() => setSel(null)}>×</button>
            <span className="am-kind">{d.kinds[byKey.get(sel)!.kind]}</span><b>{byKey.get(sel)!.title_ar}</b><p className="am-muted">{fmt(byKey.get(sel)!.at, 'long')}</p>
            {selThreads.length ? <ul className="am-list">{selThreads.map((t) => <li key={tk(t)}><button type="button" className="am-linkbtn" onClick={() => setOpen(tk(t))}>{t.status === 'kept' ? '●' : '○'} {d.rules[t.rule].title}{t.note_ar ? <em> — لأن {t.note_ar}</em> : null}</button></li>)}</ul> : <p className="am-muted">لا خيوط تلامس هذه المحطة بعد — انسج واحدًا بنفسك أدناه.</p>}
          </aside>)}
        </section>

        {open && (() => { const t = (map.threads || []).find((x) => tk(x) === open); if (!t) return null; const a = byKey.get(t.from); const b = byKey.get(t.to); if (!a || !b) return null; return (
          <ThreadCard key={open} t={t} a={a} b={b} rules={d.rules} kinds={d.kinds} note={notes[open] || ''} setNote={(v) => setNotes((p) => ({ ...p, [open]: v }))} busy={busy} onClose={() => setOpen(null)}
            onKeep={async () => { const j = await act({ action: 'keep', from: t.from, to: t.to, note: notes[open] || '' }, 'keep'); if (j?.success) { flash('أُبقي الخيط بكلمتك'); setOpen(null); } }}
            onDecline={async () => { const j = await act({ action: 'decline', from: t.from, to: t.to }, 'decline'); if (j?.success) { flash('استُبعد الخيط ولن يُقترح مجددًا'); setOpen(null); } }}
            onRemove={async () => { if (!confirm('يُحذف الخيط وكلمتك فورًا — ولا سلّة محذوفات. نتابع؟')) return; const j = await act({ action: 'remove', from: t.from, to: t.to }, 'remove'); if (j?.success) { flash('حُذف الخيط'); setOpen(null); } }}
            onShare={async (share) => { const j = await act({ action: 'share', from: t.from, to: t.to, share }, 'share'); if (j?.success) flash(share ? 'ستصل كلمتك مدرّبك بلا اسمك — ويمكنك سحبها متى شئت' : 'سُحب الإذن فورًا'); }} peers={d.peers?.[open] || 0}
            rec={rec === open} setRec={(v) => setRec(v ? open : null)} onVoice={(take) => sendVoice(t, take)} onVoiceClear={() => clearVoice(t)} onHear={() => hearOne(t)} />); })()}

        <section className="am-block" data-testid="am-proposed"><h2><Icon name="bell" size={16} /> خيوط تنتظر كلمتك <i>{proposed.length}</i></h2>
          {!proposed.length && <p className="am-muted">لا خيوط مقترَحة الآن. كلّما وقع حدث بعد حدث في رحلتك — برنامج ثم مهارة، حالة ثم مهمة، ✋ ثم حضور — ظهر هنا خيطٌ ينتظر كلمتك.</p>}
          <ul className="am-cards">{proposed.map((t) => { const a = byKey.get(t.from)!; const b = byKey.get(t.to)!; return <li key={tk(t)} className="am-card" data-testid="am-proposed-item">
            <span className="am-kind">{d.rules[t.rule].title}</span><b>{a.title_ar}</b><span className="am-arrow">⟵ بعد {fmtDays(t.days)} ⟵</span><b>{b.title_ar}</b><p className="am-muted">{t.why_ar}</p>
            <button type="button" className="pt-btn small" onClick={() => setOpen(tk(t))}>قل كلمتك</button></li>; })}</ul></section>

        <section className="am-block" data-testid="am-kept"><h2><Icon name="star" size={16} /> خيوطك <i>{kept.length}</i></h2>
          {!kept.length && <p className="am-muted">حين تُبقي أول خيط بكلمة «لأن…» يُرسم هنا متصلًا، ويكبر مع كلّ تفرّع.</p>}
          <ul className="am-cards">{kept.map((t) => { const a = byKey.get(t.from)!; const b = byKey.get(t.to)!; return <li key={tk(t)} className="am-card kept" data-testid="am-kept-item">
            <span className="am-kind">{d.rules[t.rule].title}</span><b>{a.title_ar}</b><span className="am-arrow">⟵</span><b>{b.title_ar}</b><p className="am-note">«لأن {t.note_ar}»</p><p className="am-muted">{fmt(t.decided_at)}{t.shared ? <span className="am-shared" data-testid="am-shared-badge" title="كلمتك تصل مدرّبك بلا اسمك"> · 🧶 مع مدرّبك</span> : null}{t.voice ? <span className="am-voiced" data-testid="am-voice-badge" title="لك وحدك"> · 🎙️ بصوتك ({t.voice.sec} ث)</span> : null}</p>
            {d.peers?.[tk(t)] ? <p className="am-peers" data-testid="am-peers">🧶 خيطك هذا نسجه معك {d.peers[tk(t)]} من زملائك</p> : null}
            <div className="am-row"><button type="button" className="am-linkbtn" onClick={() => setOpen(tk(t))}>عرض / حذف</button><button type="button" className="am-linkbtn" onClick={() => hearOne(t)} data-testid="am-hear">{t.voice ? '🔊 اسمع لماذا' : '🔊 اقرأه لي'}</button></div></li>; })}</ul></section>

        <section className="am-block" data-testid="am-manual"><h2><Icon name="edit" size={16} /> انسج خيطًا بنفسك</h2>
          <p className="am-muted">رأيتَ ما لم تره القواعد؟ اختر محطتين من خريطتك واكتب «لأن…». الخيط اليدوي يُرسم كغيره ويُذكر في لقطتك بوصفه «خيطًا نسجتَه بنفسك».</p>
          <form className="am-form" onSubmit={async (e) => { e.preventDefault(); const j = await act({ action: 'keep', from: manual.from, to: manual.to, note: manual.note }, 'manual'); if (j?.success) { flash('نُسج خيطك'); setManual({ from: '', to: '', note: '' }); } }}>
            <label>من<select value={manual.from} onChange={(e) => setManual({ ...manual, from: e.target.value })} required data-testid="am-manual-from"><option value="">— محطة —</option>{stations.map((s) => <option key={s.key} value={s.key} disabled={s.key === manual.to}>{d.kinds[s.kind]}: {s.title_ar} ({fmt(s.at)})</option>)}</select></label>
            <label>إلى<select value={manual.to} onChange={(e) => setManual({ ...manual, to: e.target.value })} required data-testid="am-manual-to"><option value="">— محطة —</option>{stations.map((s) => <option key={s.key} value={s.key} disabled={s.key === manual.from}>{d.kinds[s.kind]}: {s.title_ar} ({fmt(s.at)})</option>)}</select></label>
            <NoteField value={manual.note} onChange={(v) => setManual({ ...manual, note: v })} testid="am-manual-note" />
            <button type="submit" className="pt-btn" disabled={busy === 'manual' || !manual.from || !manual.to || manual.note.trim().length < 2} data-testid="am-manual-save">{busy === 'manual' ? '…' : 'انسج الخيط'}</button></form></section>

        <section className="am-block am-snap" data-testid="am-snap"><h2><Icon name="certificate" size={16} /> خريطة أثري {year}</h2>
          <p className="am-muted">لقطة سنوية موقَّعة بكلماتك: رمزٌ وبصمةٌ تُثبتان أنها لم تتغيّر منذ توقيعها. <b>خاصّة افتراضيًا</b>؛ يمكنك جعلها عامة برابط (تُعرض فيه المحطات بوجهها العام فقط — حالات اليوم بالموضوع لا بالعنوان) وإبطالها متى شئت. توقيع واحد نافذ لكل سنة؛ إعادة التوقيع تُبطل السابق.</p>
          {!liveSnap ? <div className="am-row"><label className="am-chk"><input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} /> اجعلها عامة برابط</label>
            <button type="button" className="pt-btn" disabled={busy === 'sign' || !kept.length} onClick={async () => { const j = await act({ action: 'sign', is_public: pub }, 'sign'); if (j?.success) flash(`وُقّعت «خريطة أثري ${year}» — الرمز ${j.snap.code}`); }} data-testid="am-sign">{busy === 'sign' ? '…' : `وقّع «خريطة أثري ${year}»`}</button>
            {!kept.length && <span className="am-muted">أبقِ خيطًا واحدًا على الأقل أولًا.</span>}</div>
            : <div className="am-snapcard" data-testid="am-snap-live"><b>{liveSnap.title_ar}</b> <code>{liveSnap.code}</code><p className="am-muted">وُقّعت {fmt(liveSnap.created_at, 'long')} · البصمة {liveSnap.digest.slice(0, 16)}…</p>
              <div className="am-row"><a className="pt-btn small ghost" href={liveSnap.verify_path} target="_blank" rel="noreferrer">صفحة التحقّق</a>
                <button type="button" className="pt-btn small ghost" onClick={() => act({ action: 'public', id: liveSnap.id, is_public: !liveSnap.is_public }, 'public')} data-testid="am-snap-public">{liveSnap.is_public ? 'اجعلها خاصّة' : 'اجعلها عامة برابط'}</button>
                {liveSnap.public_path && <button type="button" className="pt-btn small ghost" onClick={() => copy(origin + liveSnap.public_path)}><Icon name="copy" size={13} /> انسخ الرابط العام</button>}
                <button type="button" className="pt-btn small ghost" disabled={busy === 'sign'} onClick={async () => { if (!confirm('تُبطل اللقطة الحالية وتُوقَّع لقطة جديدة بخيوطك الآن. نتابع؟')) return; const j = await act({ action: 'sign', is_public: liveSnap.is_public }, 'sign'); if (j?.success) flash(`أُعيد التوقيع — الرمز ${j.snap.code}`); }}>أعد التوقيع بخيوطي الآن</button>
                <button type="button" className="pt-btn small danger" onClick={async () => { if (!confirm('يُبطل الرمز فورًا وتُظهر صفحة التحقّق «أُبطلت». نتابع؟')) return; const j = await act({ action: 'revoke', id: liveSnap.id }, 'revoke'); if (j?.success) flash('أُبطلت اللقطة'); }} data-testid="am-snap-revoke">أبطِل</button></div></div>}
          {(d.snapshots || []).filter((s) => s.id !== liveSnap?.id).length > 0 && <details className="am-hist"><summary>لقطاتي السابقة ({(d.snapshots || []).filter((s) => s.id !== liveSnap?.id).length})</summary>
            <ul className="am-list">{(d.snapshots || []).filter((s) => s.id !== liveSnap?.id).map((s) => <li key={s.id}><code>{s.code}</code> {s.title_ar} · {fmt(s.created_at)} · {s.revoked_at ? <span className="am-rev">أُبطلت {fmt(s.revoked_at)}</span> : s.is_public ? 'عامة' : 'خاصّة'} · <a href={s.verify_path} target="_blank" rel="noreferrer">تحقّق</a></li>)}</ul></details>}
        </section>
        <footer className="am-foot am-muted">المحطات تُقرأ من وقائع رحلتك كما هي؛ القواعد التي تقترح الخيوط صريحة ومعلنة (حدث ثم حدث خلال أيام معلومة) بلا ذكاء اصطناعي. ما تستبعده لا يعود، وما تحذفه يُحذف فورًا. مدرّبك لا يرى خريطتك ولا خيوطك؛ يرى «نسيج الشعبة» مجمَّعًا بلا أسماء حين يبلغ خمسةٌ محطةً واحدة — وكلمتك «لأن…» لا تصله إلا بإذنك. <b data-testid="am-voice-foot">{VOICE_FOOT_AR}</b> صوتك على الخيط لا يصل أحدًا — لا مدرّبك ولا جهتك ولا صفحة التحقّق — ويُحذف مع الخيط أو بزرّ واحد.</footer>
      </>)}
    </main>
  );
}

function ThreadCard({ t, a, b, rules, kinds, note, setNote, busy, onClose, onKeep, onDecline, onRemove, onShare, peers, rec, setRec, onVoice, onVoiceClear, onHear }: { t: Thread; a: Station; b: Station; rules: Record<RuleKey, { title: string; why: string }>; kinds: Record<StationKind, string>; note: string; setNote: (v: string) => void; busy: string; onClose: () => void; onKeep: () => void; onDecline: () => void; onRemove: () => void; onShare: (share: boolean) => void; peers: number; rec: boolean; setRec: (v: boolean) => void; onVoice: (take: { blob: Blob; sec: number; transcript: string | null }) => Promise<string | null>; onVoiceClear: () => void; onHear: () => void }) {
  const kept = t.status === 'kept';
  return <section className={`am-thread ${kept ? 'kept' : ''}`} data-testid="am-thread-card" aria-live="polite">
    <button type="button" className="am-x" aria-label="إغلاق" onClick={onClose}>×</button>
    <span className="am-kind">{rules[t.rule].title}</span>
    <div className="am-pair"><div><small>{kinds[a.kind]} · {fmt(a.at)}</small><b>{a.title_ar}</b></div><span className="am-arrow">⟵ {t.rule === 'manual' ? 'خيطك' : `بعد ${fmtDays(t.days)}`} ⟵</span><div><small>{kinds[b.kind]} · {fmt(b.at)}</small><b>{b.title_ar}</b></div></div>
    <p className="am-muted">{t.why_ar}</p>
    {kept ? <><p className="am-note">«لأن {t.note_ar}»</p><p className="am-muted">قلتَ كلمتك {fmt(t.decided_at, 'long')}</p>
        {peers >= 5 && <p className="am-peers" data-testid="am-peers-card">🧶 خيطك هذا نسجه معك {peers} من زملائك</p>}
        <div className="am-voice" data-testid="am-voice">
          {t.voice ? <p className="am-voiced"><b>🎙️ قلتَها بصوتك</b> ({t.voice.sec} ث · {fmt(t.voice.at)}) — <button type="button" className="am-linkbtn" onClick={onHear} data-testid="am-voice-hear">🔊 اسمع لماذا</button> · <button type="button" className="am-linkbtn" onClick={() => setRec(true)} data-testid="am-voice-redo">أعد التسجيل</button> · <button type="button" className="am-linkbtn danger" onClick={onVoiceClear} disabled={busy === 'voice'} data-testid="am-voice-clear">احذف صوتي</button></p>
            : <p className="am-muted"><button type="button" className="am-linkbtn" onClick={() => setRec(true)} data-testid="am-voice-rec">🎙️ قلها بصوتك</button> — {MAP_VOICE_LIMITS.maxSeconds} ثانية لك وحدك: لا تصل مدرّبك ولا جهتك؛ كلمتك المكتوبة هي ما يسافر.</p>}
          {rec && <VoiceRecorder ar maxSec={MAP_VOICE_LIMITS.maxSeconds} hint="قل «لأن…» بصوتك — لك وحدك" sendLabel="احفظ صوتي" testid="am-voice-recorder" onSend={onVoice} onCancel={() => setRec(false)} />}
        </div>
        <label className="am-share" data-testid="am-share"><input type="checkbox" checked={!!t.shared} onChange={(e) => onShare(e.target.checked)} disabled={busy === 'share'} data-testid="am-share-toggle" /> <span><b>شارك كلمتي مع مدرّبي — بلا اسمي</b><small>تظهر «لأن…» هذه في «نسيج الشعبة» عند مدرّبك مع كلمات زملائك، بلا اسم ولا تاريخ، ولا تظهر أصلًا قبل أن يأذن خمسة. تسحبها متى شئت فتختفي فورًا.</small></span></label>
        <button type="button" className="pt-btn small danger" onClick={onRemove} disabled={busy === 'remove'} data-testid="am-remove">احذف الخيط وكلمتي</button></>
      : <><p><b>هل هذا خيط؟</b> إن كان نعم، قل لماذا بكلماتك (أو أملِه بصوتك).</p>
        <NoteField value={note} onChange={setNote} testid="am-note" autoFocus />
        <div className="am-row"><button type="button" className="pt-btn" onClick={onKeep} disabled={busy === 'keep' || note.trim().length < 2} data-testid="am-keep">{busy === 'keep' ? '…' : 'نعم — أبقِ الخيط'}</button>
          <button type="button" className="pt-btn ghost" onClick={onDecline} disabled={busy === 'decline'} data-testid="am-decline">ليس خيطًا</button></div>
        <p className="am-muted">«ليس خيطًا» يُخفيه ولا يُقترح مجددًا — ويمكنك دومًا نسجه يدويًا لاحقًا.</p></>}
  </section>;
}

/** حقل «لأن…» مع إملاء صوتي في المتصفح (لا تخزين صوتي؛ يتحوّل إلى نصّ محليًا) */
function NoteField({ value, onChange, testid, autoFocus }: { value: string; onChange: (v: string) => void; testid: string; autoFocus?: boolean }) {
  const [can, setCan] = useState(false); const [on, setOn] = useState(false); const recRef = useRef<any>(null);
  useEffect(() => { const w = globalThis as any; setCan(!!(w.SpeechRecognition || w.webkitSpeechRecognition)); }, []);
  const toggle = () => {
    const w = globalThis as any; const SR = w.SpeechRecognition || w.webkitSpeechRecognition; if (!SR) return;
    if (on) { try { recRef.current?.stop(); } catch { /* */ } setOn(false); return; }
    const r = new SR(); r.lang = 'ar-SA'; r.interimResults = false; r.maxAlternatives = 1; recRef.current = r;
    r.onresult = (e: any) => { const t = Array.from(e.results as any[]).map((x: any) => x[0]?.transcript || '').join(' ').trim(); if (t) onChange(`${value ? value + ' ' : ''}${t}`.slice(0, NOTE_MAX)); };
    r.onend = () => setOn(false); r.onerror = () => setOn(false); try { r.start(); setOn(true); } catch { setOn(false); }
  };
  return <div className="am-note-field"><label className="am-sr">لأن…</label>
    <div className="am-row"><span className="am-lan">لأن</span><input value={value} onChange={(e) => onChange(e.target.value.slice(0, NOTE_MAX))} maxLength={NOTE_MAX} placeholder="… ما الذي قاد إلى ماذا، بكلماتك" autoFocus={autoFocus} data-testid={testid} aria-label="لأن" />
      {can && <button type="button" className={`am-mic ${on ? 'on' : ''}`} onClick={toggle} aria-pressed={on} aria-label={on ? 'أوقف الإملاء' : 'أملِ بصوتك'} title={on ? 'أوقف الإملاء' : 'أملِ بصوتك (يتحوّل إلى نصّ هنا ولا يُخزَّن صوت)'}><Icon name="mic" size={15} /></button>}</div>
    <small className="am-muted">{value.length}/{NOTE_MAX}</small></div>;
}

const CSS = `
.am{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;max-width:1040px;margin:0 auto;padding:22px 16px 60px;overflow-wrap:anywhere;min-width:0}.am *{box-sizing:border-box}
.am-nav{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px}.am-link{color:#0f2a4e;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;gap:5px;font-size:14px}.am-link:hover{text-decoration:underline}
.am-head h1{margin:4px 0 6px;font-size:32px;color:#0f2a4e}.am-head h1 small{display:block;font-size:15px;color:#b45309;font-weight:800;margin-top:2px}.am-head p{margin:0 0 14px;color:#475569;line-height:1.9;max-width:760px}
.am-muted{color:#64748b;font-size:13px;line-height:1.8}.am-err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}.am-ok{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}
.am-mirror{background:linear-gradient(135deg,#fff7ed,#fffbeb);border:1px solid #fed7aa;border-radius:16px;padding:14px 18px;margin:10px 0 14px}.am-mirror p{margin:0 0 4px;font-weight:800;color:#7c2d12;font-size:16px;line-height:1.8}.am-mirror p.am-muted{font-weight:600;color:#9a3412;font-size:13px;margin-top:6px}
.am-sky{position:relative;margin:0 0 16px}.am-side{position:absolute;top:12px;left:12px;background:rgba(255,255,255,.96);border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;max-width:320px;box-shadow:0 10px 30px rgba(2,6,23,.25)}.am-side b{display:block;margin:4px 0;font-size:15px}
.am-x{position:absolute;top:6px;right:8px;border:0;background:transparent;font-size:20px;cursor:pointer;color:#64748b;line-height:1}
.am-kind{display:inline-block;font-size:11px;font-weight:800;color:#0e7490;background:#ecfeff;border-radius:999px;padding:2px 10px}
.am-list{list-style:none;margin:8px 0 0;padding:0}.am-list li{padding:4px 0;border-top:1px dashed #e2e8f0;font-size:13px;line-height:1.8}.am-linkbtn{border:0;background:transparent;color:#0f2a4e;font-weight:800;cursor:pointer;padding:0;text-align:right;font-family:inherit;font-size:13px}.am-linkbtn em{color:#92400e;font-style:normal;font-weight:600}
.am-block{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 18px;margin:0 0 14px}.am-block h2{margin:0 0 6px;font-size:18px;color:#0f2a4e;display:flex;align-items:center;gap:8px}.am-block h2 i{font-style:normal;background:#0f2a4e;color:#fff;border-radius:999px;font-size:12px;padding:1px 9px}
.am-cards{list-style:none;margin:8px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr));gap:10px}.am-card{border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:4px;background:#f8fafc}.am-card.kept{background:#fffbeb;border-color:#fde68a}.am-card b{font-size:14px;line-height:1.6}.am-card p{margin:2px 0}
.am-arrow{color:#b45309;font-weight:800;font-size:12px}.am-note{margin:6px 0;color:#7c2d12;font-weight:800;font-size:15px;line-height:1.8}
.am-thread{position:relative;background:#0f2a4e;color:#f8fafc;border-radius:18px;padding:16px 20px;margin:0 0 14px;box-shadow:0 12px 36px rgba(15,42,78,.35)}.am-thread .am-x{color:#cbd5e1}.am-thread .am-muted{color:#cbd5e1}.am-thread .am-kind{background:#fde68a;color:#78350f}.am-thread.kept{background:#78350f}
.am-pair{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin:10px 0}.am-pair small{display:block;color:#cbd5e1;font-size:11px}.am-pair b{font-size:15px;line-height:1.6}.am-thread .am-arrow{color:#fde68a}.am-thread .am-note{color:#fde68a}
.am-thread .pt-btn.ghost{background:transparent;border:1.5px solid #cbd5e1;color:#f8fafc}.am-thread .pt-btn.danger{background:#fecaca;color:#7f1d1d;border:0}
.am-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}.am-form{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;max-width:720px}.am-form label{display:grid;gap:4px;font-weight:800;font-size:13px;min-width:0}.am-form select{font-family:inherit;font-size:14px;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:10px;background:#fff;width:100%;min-width:0;max-width:100%}
.am-note-field{display:grid;gap:2px}.am-note-field .am-row{margin:0}.am-lan{font-weight:900;font-size:16px;color:#b45309}.am-thread .am-lan{color:#fde68a}.am-note-field input{flex:1;min-width:0;font-family:inherit;font-size:15px;padding:9px 12px;border:1.5px solid #cbd5e1;border-radius:10px;color:#0f172a}
.am-mic{border:1.5px solid #cbd5e1;background:#fff;color:#0f2a4e;border-radius:999px;width:38px;height:38px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.am-mic.on{background:#fecaca;border-color:#ef4444;color:#7f1d1d;animation:am-p 1s infinite}@keyframes am-p{50%{box-shadow:0 0 0 6px rgba(239,68,68,.25)}}
.am-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.am-chk{display:inline-flex;gap:6px;align-items:center;font-size:14px}
.am-snap{background:linear-gradient(135deg,#fff,#f8fafc)}.am-snapcard{border:1.5px solid #fde68a;background:#fffbeb;border-radius:14px;padding:12px 14px}.am-snapcard code{background:#fff;border:1px solid #fde68a;border-radius:8px;padding:2px 8px;font-weight:800;letter-spacing:.5px}.am-rev{color:#b91c1c;font-weight:800}.am-hist{margin-top:10px}.am-hist summary{cursor:pointer;font-weight:800;color:#0f2a4e}
.am-player{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px;padding:8px 10px;background:#0f2a4e;color:#e2e8f0;border-radius:12px}.am-player .am-muted{color:#cbd5e1}.am-now{font-weight:800;font-size:13px;line-height:1.7}.am-now em{display:block;font-style:normal;color:#fde68a}.am-voice{margin:8px 0;padding:8px 10px;border:1px dashed #fcd34d;border-radius:10px;background:rgba(255,255,255,.06)}.am-voiced{color:#92400e;font-weight:700;font-size:13px;margin:0}.am-thread .am-voiced{color:#fde68a}.am-linkbtn.danger{color:#fca5a5}
.am-foot{margin-top:18px;border-top:1px dashed #e2e8f0;padding-top:10px}.am-peers{margin:4px 0;color:#92400e;font-weight:700;font-size:13px}.am-shared{color:#92400e}.am-share{display:flex;gap:10px;align-items:flex-start;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 10px;margin:8px 0;cursor:pointer}.am-share input{margin-top:4px;width:18px;height:18px;flex:none}.am-share span{display:grid;gap:2px}.am-share b{color:#7c2d12;display:block}.am-share small{color:#64748b;font-size:12px;line-height:1.5;display:block}
@media (max-width:640px){.am-pair{grid-template-columns:1fr}.am-side{position:static;max-width:none;margin-top:8px}.am-head h1{font-size:26px}}
@media (prefers-reduced-motion:reduce){.am-mic.on{animation:none}}
`;
