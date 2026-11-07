'use client';
/**
 * P39 «إشعارات المتعلّم» — جرس «تنبيهاتي» في رأس أَثَر + قائمة كاملة في «أنا»
 *  - الجرس يظهر للمسجَّل فقط؛ يقرأ /api/notices كل 90 ثانية (خفيف) ويعرض عدد غير المقروء.
 *  - الفتح يعلّم المعروض مقروءًا (بعد ثانيتين) — بلا صفحة جديدة: لوحة منسدلة بقائمة وروابط.
 *  - لا بيانات شخصية في النصوص (الإشعارات نفسها بلا درجات).
 *  P54 «أمانة صوتية»: تحت «كلمة» المدرّب زرّ 🎙️ «قُل لي» — تسجيل ≤ 15 ثانية على الجهاز، معاينة، ثم إرسال multipart إلى /api/me/voice-reply؛
 *    نصّ تقريبي اختياري من تعرّف المتصفّح (إن وُجد) يمكن حذفه قبل الإرسال · يُخفى الزرّ إن لم يدعم المتصفّح التسجيل · لا يدخل في أي تقييم.
 *  P55 «كلمة صوتية»: إن حملت كلمة المدرّب صوتًا (voice.sec) يظهر «▶ استمع إلى مدرّبك (0:14)» — رابط موقَّع 5 دقائق عبر /api/notices?voice=<id> — ونصّه التقريبي رماديًّا.
 *    المسجّل نفسه صار مكوّنًا مشتركًا VoiceRecorder (يستعمله المدرّب في دفتر اليوم أيضًا).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sbLazy } from '../../lib/supabase/lazy';
import VoiceRecorder, { canRecord, fmtSec, voiceFileName } from './VoiceRecorder';

type MyReply = { chip: string | null; chip_ar: string; text: string | null; at: string; editable: boolean; voice_sec?: number | null; transcript?: string | null };
type Notice = { id: string; kind: string; kind_ar: string; icon: string; title_ar: string; body_ar: string; url: string | null; pushed: boolean; read_at: string | null; created_at: string; can_reply?: boolean; my_reply?: MyReply | null; voice?: { sec: number; transcript: string | null } | null };
type Chip = { key: string; icon: string; label_ar: string; label_en: string };
type Payload = { unread: number; notices: Notice[]; chips: Chip[]; reply_max: number; voice_max_sec: number; voice_max_bytes: number; transcript_max: number };
const VOICE_SEC = 15; const VOICE_BYTES = 512 * 1024; const TRANSCRIPT_MAX = 300;
/* P53 «ردّ على الكلمة»: اللمسات الافتراضية إن لم يُرسلها الخادم */
const DEFAULT_CHIPS: Chip[] = [{ key: 'got_it', icon: '🌱', label_ar: 'وصلت، شكرًا', label_en: 'Got it, thanks' }, { key: 'need_help', icon: '✋', label_ar: 'أحتاج مساعدة', label_en: 'I need help' }, { key: 'will_attend', icon: '🕐', label_ar: 'سأحضر الجلسة القادمة', label_en: 'I will attend the next session' }];

async function hdr(): Promise<Record<string, string>> { try { const db = await sbLazy(); const { data } = await db.auth.getSession(); const tk = data.session?.access_token; return { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }; } catch { return { 'Content-Type': 'application/json' }; } }
async function load(limit = 20): Promise<Payload | null> { try { const h = await hdr(); if (!h.Authorization) return null; const j = await fetch(`/api/notices?limit=${limit}`, { headers: h, cache: 'no-store' }).then((r) => r.json()); return j?.success ? { unread: Number(j.unread) || 0, notices: j.notices || [], chips: j.reply?.chips || DEFAULT_CHIPS, reply_max: Number(j.reply?.max) || 200, voice_max_sec: Number(j.voice?.max_sec) || VOICE_SEC, voice_max_bytes: Number(j.voice?.max_bytes) || VOICE_BYTES, transcript_max: Number(j.voice?.transcript_max) || TRANSCRIPT_MAX } : null; } catch { return null; } }
/** P53: ردّ المتعلّم على «كلمة» — لمسة أو سطر */
async function sendReply(noticeId: string, chip: string | null, text: string): Promise<{ ok: boolean; reply?: MyReply; message?: string; error?: string }> { try { const h = await hdr(); const r = await fetch('/api/notices', { method: 'POST', headers: h, body: JSON.stringify({ action: 'word_reply', notice_id: noticeId, chip, text }) }); const j = await r.json().catch(() => ({})); return r.ok && j.success ? { ok: true, reply: j.reply, message: j.message } : { ok: false, error: j.error || 'تعذّر الإرسال' }; } catch { return { ok: false, error: 'تعذّر الاتصال' }; } }
/** P54: إرسال الأمانة الصوتية — multipart بلا Content-Type يدوي (المتصفّح يضع الحدّ) */
async function sendVoice(noticeId: string, blob: Blob, sec: number, transcript: string | null): Promise<{ ok: boolean; reply?: MyReply; message?: string; error?: string }> {
  try { const h = await hdr(); delete h['Content-Type']; const fd = new FormData(); fd.append('file', blob, voiceFileName(blob)); fd.append('notice_id', noticeId); fd.append('duration_sec', String(sec)); if (transcript !== null) fd.append('transcript', transcript);
    const r = await fetch('/api/me/voice-reply', { method: 'POST', headers: h, body: fd }); const j = await r.json().catch(() => ({})); return r.ok && j.success ? { ok: true, reply: j.reply, message: j.message } : { ok: false, error: j.error || 'تعذّر إرسال الأمانة' }; } catch { return { ok: false, error: 'تعذّر الاتصال' }; } }
async function deleteVoice(noticeId: string): Promise<{ ok: boolean; row_deleted?: boolean; error?: string }> { try { const h = await hdr(); const r = await fetch(`/api/me/voice-reply?notice_id=${encodeURIComponent(noticeId)}`, { method: 'DELETE', headers: h }); const j = await r.json().catch(() => ({})); return r.ok && j.success ? { ok: true, row_deleted: !!j.row_deleted } : { ok: false, error: j.error || 'تعذّر الحذف' }; } catch { return { ok: false, error: 'تعذّر الاتصال' }; } }
/** P55: رابط موقَّع لصوت كلمة المدرّب (لصاحب الإشعار) */
async function trainerVoiceUrl(noticeId: string): Promise<{ url?: string; error?: string }> { try { const h = await hdr(); const r = await fetch(`/api/notices?voice=${encodeURIComponent(noticeId)}`, { headers: h, cache: 'no-store' }); const j = await r.json().catch(() => ({})); return r.ok && j.success && j.url ? { url: j.url } : { error: j.error || 'تعذّر فتح الصوت' }; } catch { return { error: 'تعذّر الاتصال' }; } }
async function markRead(ids: string[] | 'all'): Promise<void> { try { const h = await hdr(); await fetch('/api/notices', { method: 'POST', headers: h, body: JSON.stringify(ids === 'all' ? { action: 'read', all: true } : { action: 'read', ids }) }); } catch { /* تجاهل */ } }
const when = (iso: string, ar: boolean) => { try { return new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso.slice(0, 16); } };

export function NoticeItem({ n, ar, onOpen, chips, max, voiceSec }: { n: Notice; ar: boolean; onOpen?: () => void; chips?: Chip[]; max?: number; voiceSec?: number }) {
  return <li className={`nt-item ${n.read_at ? '' : 'unread'}`} data-testid="nt-item" data-kind={n.kind} data-read={n.read_at ? '1' : '0'}>
    <span className="nt-ic" aria-hidden="true">{n.icon}</span>
    <div className="nt-body"><b>{n.title_ar}</b>{n.body_ar && <p>{n.body_ar}</p>}{n.voice?.sec ? <TrainerVoice n={n} ar={ar} /> : null}<small>{n.kind_ar} · {when(n.created_at, ar)}{n.pushed ? (ar ? ' · وصلك إشعارًا' : ' · pushed') : ''}</small>
      {n.can_reply && <WordReply n={n} ar={ar} chips={chips || DEFAULT_CHIPS} max={max || 200} voiceSec={voiceSec || VOICE_SEC} />}</div>
    {n.url && !n.can_reply && <a className="nt-open" href={n.url} onClick={onOpen}>{ar ? 'افتح' : 'Open'}</a>}
  </li>;
}

/** P53 «ردّ على الكلمة» — تحت كلمة المدرّب: ثلاث لمسات + سطر؛ ردّ واحد (يُعدَّل خلال ساعة) · يصل إلى المدرّب وحده · لا يُستعمل في أي تقييم */
function WordReply({ n, ar, chips, max, voiceSec }: { n: Notice; ar: boolean; chips: Chip[]; max: number; voiceSec: number }) {
  const [mine, setMine] = useState<MyReply | null>(n.my_reply || null); const [edit, setEdit] = useState(false); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [voice, setVoice] = useState(false); const [canVoice, setCanVoice] = useState(false); useEffect(() => { setCanVoice(canRecord()); }, []);
  async function go(chip: string | null) { if (busy) return; const t = text.trim(); if (!chip && !t) { setMsg({ ok: false, t: ar ? 'اختر لمسة أو اكتب سطرًا' : 'Pick a chip or write a line' }); return; } setBusy(true); const r = await sendReply(n.id, chip, t); setBusy(false);
    if (!r.ok) { setMsg({ ok: false, t: r.error || '' }); return; } setMine((m) => r.reply ? { ...r.reply, voice_sec: r.reply.voice_sec ?? m?.voice_sec ?? null, transcript: r.reply.transcript ?? m?.transcript ?? null } : null); setEdit(false); setText(''); setMsg({ ok: true, t: r.message || '' }); }
  async function dropVoice() { if (busy) return; setBusy(true); const r = await deleteVoice(n.id); setBusy(false); if (!r.ok) { setMsg({ ok: false, t: r.error || '' }); return; } setMine((m) => r.row_deleted || !m ? null : { ...m, voice_sec: null, transcript: null }); setMsg({ ok: true, t: ar ? 'حُذف الصوت.' : 'Voice removed.' }); }
  if (voice) return <VoiceRecorder ar={ar} maxSec={voiceSec} testid="nt-voice" sendLabel={ar ? 'أرسل الأمانة' : 'Send voice note'} hint={ar ? `أمانة صوتية ≤ ${voiceSec} ثانية · يسمعها مدرّبك وحده · لا تدخل في أي تقييم · تُحذف بعد 180 يومًا` : `Voice note ≤ ${voiceSec}s · heard by your trainer only · never part of any assessment · deleted after 180 days`} transcriptLabel={ar ? 'نصّ تقريبي (من جهازك — يراه مدرّبك مع الصوت):' : 'Rough transcript (on-device — shown to your trainer with the audio):'} onCancel={() => setVoice(false)}
    onSend={async (t) => { const r = await sendVoice(n.id, t.blob, t.sec, t.transcript); if (!r.ok || !r.reply) return r.error || 'تعذّر الإرسال'; setMine(r.reply); setVoice(false); setEdit(false); setMsg({ ok: true, t: ar ? 'وصلت أمانتك الصوتية إلى مدرّبك — له وحده.' : 'Your voice note reached your trainer — only them.' }); return null; }} />;
  if (mine && !edit) return <div className="nt-reply done" data-testid="nt-reply-done" data-chip={mine.chip || ''} data-voice={mine.voice_sec ? '1' : '0'}>
    <span>{ar ? 'ردّك: ' : 'Your reply: '}<b>{mine.chip_ar}{mine.chip_ar && mine.text ? ' · ' : ''}{mine.text ? `«${mine.text}»` : ''}{(mine.chip_ar || mine.text) && mine.voice_sec ? ' · ' : ''}{mine.voice_sec ? <span data-testid="nt-voice-done">🎙️ {fmtSec(mine.voice_sec)}</span> : null}</b></span>
    {mine.editable && <button type="button" className="nt-link" onClick={() => { setEdit(true); setText(mine.text || ''); setMsg(null); }} data-testid="nt-reply-edit">{ar ? 'عدِّل' : 'Edit'}</button>}
    {mine.editable && mine.voice_sec ? <button type="button" className="nt-link" onClick={() => void dropVoice()} disabled={busy} data-testid="nt-voice-del">{ar ? 'احذف الصوت' : 'Remove voice'}</button> : null}
    {mine.editable && !mine.voice_sec && canVoice ? <button type="button" className="nt-link" onClick={() => { setVoice(true); setMsg(null); }} data-testid="nt-voice">🎙️ {ar ? 'أضف صوتًا' : 'Add voice'}</button> : null}
    {msg && <small className={msg.ok ? 'nt-reply-ok' : 'nt-reply-err'} role="status" data-testid={msg.ok ? 'nt-reply-ok' : 'nt-reply-err'}>{msg.t}</small>}
  </div>;
  return <div className="nt-reply" data-testid="nt-reply">
    <div className="nt-chips" role="group" aria-label={ar ? 'ردّ بلمسة' : 'Quick reply'}>{chips.map((c) => <button key={c.key} type="button" className="nt-chip" onClick={() => void go(c.key)} disabled={busy} data-testid="nt-chip" data-chip={c.key}><span aria-hidden="true">{c.icon}</span> {ar ? c.label_ar : c.label_en}</button>)}
      {canVoice && <button type="button" className="nt-chip nt-chip-voice" onClick={() => { setVoice(true); setMsg(null); }} disabled={busy} data-testid="nt-voice" title={ar ? `أمانة صوتية ≤ ${voiceSec} ثانية` : `Voice note ≤ ${voiceSec}s`}><span aria-hidden="true">🎙️</span> {ar ? 'قُل لي' : 'Tell me'}</button>}</div>
    <div className="nt-line"><input value={text} onChange={(e) => setText(e.target.value.slice(0, max))} maxLength={max} placeholder={ar ? `أو اكتب سطرًا لمدرّبك (≤ ${max} حرفًا)…` : `Or write one line (≤ ${max})…`} aria-label={ar ? 'سطر الردّ' : 'Reply line'} data-testid="nt-reply-text" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void go(null); } }} />
      <button type="button" className="nt-send" onClick={() => void go(null)} disabled={busy || !text.trim()} data-testid="nt-reply-send">{ar ? 'أرسل' : 'Send'}</button></div>
    <small className="nt-reply-hint">{ar ? 'يصل إلى مدرّبك وحده · لا يدخل في أي تقييم' : 'Reaches your trainer only · never part of any assessment'}{edit && <> · <button type="button" className="nt-link" onClick={() => setEdit(false)}>{ar ? 'إلغاء' : 'Cancel'}</button></>}</small>
    {msg && !msg.ok && <small className="nt-reply-err" role="alert" data-testid="nt-reply-err">{msg.t}</small>}
  </div>;
}

/** P55 «كلمة صوتية» — مشغّل صوت المدرّب داخل الكلمة: رابط موقَّع عند الضغط · نصّ تقريبي رمادي · يُعلَّم الإشعار مقروءًا بالاستماع */
function TrainerVoice({ n, ar }: { n: Notice; ar: boolean }) {
  const [url, setUrl] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [on, setOn] = useState(false); const ref = useRef<HTMLAudioElement | null>(null);
  async function play() { setErr(''); if (url) { const a = ref.current; if (!a) return; if (on) { a.pause(); setOn(false); } else { try { await a.play(); setOn(true); } catch { setErr(ar ? 'اضغط مرّة أخرى للتشغيل' : 'Tap again to play'); } } return; }
    setBusy(true); const r = await trainerVoiceUrl(n.id); setBusy(false); if (!r.url) { setErr(r.error || ''); return; } setUrl(r.url); setTimeout(async () => { try { await ref.current?.play(); setOn(true); void markRead([n.id]); } catch { /* يضغط ثانية */ } }, 50); }
  return <div className="nt-tvoice" data-testid="nt-tvoice" data-sec={n.voice!.sec}>
    <button type="button" className={`nt-tvoice-btn ${on ? 'on' : ''}`} onClick={() => void play()} disabled={busy} aria-pressed={on} data-testid="nt-tvoice-play">{on ? '❚❚' : '▶'} {ar ? `استمع إلى مدرّبك (${fmtSec(n.voice!.sec)})` : `Listen to your trainer (${fmtSec(n.voice!.sec)})`}</button>
    <audio ref={ref} src={url || undefined} preload="none" onEnded={() => setOn(false)} onPause={() => setOn(false)} aria-hidden="true" />
    {n.voice!.transcript && <em className="nt-tvoice-tr" data-testid="nt-tvoice-tr" title={ar ? 'نصّ تقريبي من جهاز المدرّب — الصوت هو الأصل' : 'Rough on-device transcript — audio is the original'}>≈ {n.voice!.transcript}</em>}
    <small className="nt-reply-hint">{ar ? 'صوت مدرّبك لك وحدك · لا يدخل في أي تقييم · يُحذف بعد 180 يومًا' : 'Your trainer’s voice, for you only · never part of any assessment · deleted after 180 days'}</small>
    {err && <small className="nt-reply-err" role="alert">{err}</small>}
  </div>;
}

/** الجرس في الرأس (للمسجَّل) */
export function NoticesBell({ lang }: { lang: 'ar' | 'en' }) {
  const ar = lang === 'ar'; const [d, setD] = useState<Payload | null>(null); const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement | null>(null); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(() => { load(10).then((p) => p && setD(p)); }, []);
  useEffect(() => { refresh(); const iv = setInterval(refresh, 90000); const onVis = () => { if (document.visibilityState === 'visible') refresh(); }; document.addEventListener('visibilitychange', onVis); return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); }; }, [refresh]);
  useEffect(() => { if (!open) return; const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); }; document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey); return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); }; }, [open]);
  useEffect(() => { if (!open || !d || !d.unread) return; const ids = d.notices.filter((n) => !n.read_at).map((n) => n.id); if (!ids.length) return; timer.current = setTimeout(async () => { await markRead(ids); setD((x) => x ? { ...x, unread: Math.max(0, x.unread - ids.length), notices: x.notices.map((n) => ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n) } : x); }, 2000); return () => { if (timer.current) clearTimeout(timer.current); }; }, [open, d]);
  if (!d) return null;
  return <div className="nt-wrap" ref={ref}>
    <button type="button" className={`nt-bell ${d.unread ? 'has' : ''}`} onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={ar ? `تنبيهاتي${d.unread ? ` — ${d.unread} جديد` : ''}` : `My alerts${d.unread ? ` — ${d.unread} new` : ''}`} title={ar ? 'تنبيهاتي' : 'My alerts'} data-testid="nt-bell" data-unread={d.unread}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
      {d.unread > 0 && <b data-testid="nt-count">{d.unread > 9 ? '9+' : d.unread}</b>}
    </button>
    {open && <div className="nt-pop" role="dialog" aria-label={ar ? 'تنبيهاتي' : 'My alerts'} data-testid="nt-pop">
      <div className="nt-pophead"><b>{ar ? 'تنبيهاتي' : 'My alerts'}</b>{d.unread > 0 && <button type="button" className="nt-link" onClick={async () => { await markRead('all'); refresh(); }} data-testid="nt-readall">{ar ? 'اعتبرها كلّها مقروءة' : 'Mark all read'}</button>}</div>
      {d.notices.length === 0 ? <p className="nt-empty">{ar ? 'لا تنبيهات بعد — حين يصدر حكمك في مِعيار أو تُفتح لك إعادة أو تُحجز لك جلسة، ستجدها هنا.' : 'No alerts yet — verdicts, retakes and sessions will show up here.'}</p>
        : <ul className="nt-list">{d.notices.map((n) => <NoticeItem key={n.id} n={n} ar={ar} onOpen={() => setOpen(false)} chips={d.chips} max={d.reply_max} voiceSec={d.voice_max_sec} />)}</ul>}
      <a className="nt-all" href="/me#notices" onClick={() => setOpen(false)}>{ar ? 'كل تنبيهاتي في «أنا»' : 'All alerts in “Me”'}</a>
    </div>}
  </div>;
}

/** القائمة الكاملة داخل «أنا» */
export default function NoticesCard() {
  const [d, setD] = useState<Payload | null | undefined>(undefined);
  useEffect(() => { load(50).then((p) => setD(p)); }, []);
  if (d === undefined || d === null) return null;
  return <section className="me-card" id="notices" data-testid="me-notices" data-count={d.notices.length}>
    <style dangerouslySetInnerHTML={{ __html: NOTICES_CSS }} />
    <div className="nt-pophead"><h2 style={{ margin: 0 }}>🔔 تنبيهاتي {d.unread > 0 && <small className="nt-badge">{d.unread} جديد</small>}</h2>{d.unread > 0 && <button type="button" className="nt-link" onClick={async () => { await markRead('all'); setD(await load(50)); }}>اعتبرها كلّها مقروءة</button>}</div>
    <p className="nt-hint">كل ما يخصّك في مِعيار وأَثَر: صدور حكم العبور · إعادة مهارة · جلسة تعويض · ترقية · تسكين. يصلك إشعارًا على جهازك إن فعّلت التذكير، ويبقى هنا دائمًا.</p>
    {d.notices.length === 0 ? <p className="nt-empty">لا تنبيهات بعد.</p> : <ul className="nt-list">{d.notices.map((n) => <NoticeItem key={n.id} n={n} ar chips={d.chips} max={d.reply_max} voiceSec={d.voice_max_sec} />)}</ul>}
  </section>;
}

export const NOTICES_CSS = `
.nt-wrap{position:relative;display:inline-flex}
.nt-bell{display:inline-flex;align-items:center;justify-content:center;gap:4px;border:1.5px solid #cbd5e1;background:#fff;color:#0f2a4e;border-radius:999px;width:36px;height:36px;cursor:pointer;position:relative;padding:0}
.nt-bell.has{border-color:#0f766e;background:#f0fdfa}
.nt-bell b{position:absolute;top:-5px;inset-inline-end:-5px;background:#dc2626;color:#fff;border-radius:999px;min-width:18px;height:18px;padding:0 5px;font-size:11px;line-height:18px;text-align:center}
.nt-pop{position:absolute;top:calc(100% + 8px);inset-inline-end:0;width:min(380px,92vw);background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 18px 40px rgba(15,42,78,.18);padding:12px;z-index:60;text-align:start}
.nt-pophead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.nt-link{border:0;background:none;color:#0f766e;font:inherit;font-size:12px;font-weight:800;cursor:pointer;text-decoration:underline}
.nt-list{list-style:none;margin:0;padding:0;display:grid;gap:8px;max-height:60vh;overflow:auto}
.nt-item{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0}
.nt-item.unread{background:#f0fdfa;border-color:#99f6e4}
.nt-ic{font-size:20px;line-height:1}
.nt-body{flex:1;min-width:0}.nt-body b{display:block;font-size:14px;color:#0f2a4e}.nt-body p{margin:2px 0 0;font-size:13px;color:#334155;line-height:1.6}.nt-body small{color:#64748b;font-size:11px}
.nt-open{align-self:center;font-size:12px;font-weight:800;color:#0f2a4e;border:1px solid #cbd5e1;border-radius:999px;padding:4px 10px;text-decoration:none;white-space:nowrap}
.nt-empty{margin:4px 0;color:#64748b;font-size:13px;line-height:1.7}
.nt-all{display:block;margin-top:10px;text-align:center;font-size:13px;font-weight:800;color:#0f766e}
.nt-badge{background:#dc2626;color:#fff;border-radius:999px;padding:1px 8px;font-size:12px;vertical-align:middle;margin-inline-start:6px}
.nt-hint{margin:0 0 10px;color:#64748b;font-size:13px;line-height:1.7}
.nt-reply{margin-top:8px;display:grid;gap:6px}.nt-reply.done{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:13px;color:#0f2a4e;background:#fff;border:1px dashed #99f6e4;border-radius:10px;padding:6px 10px}
.nt-chips{display:flex;gap:6px;flex-wrap:wrap}.nt-chip{border:1.5px solid #cbd5e1;background:#fff;color:#0f2a4e;border-radius:999px;padding:6px 11px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;min-height:34px}.nt-chip:hover,.nt-chip:focus-visible{border-color:#0f766e;background:#f0fdfa}.nt-chip:disabled{opacity:.6;cursor:wait}
.nt-line{display:flex;gap:6px}.nt-line input{flex:1;min-width:0;border:1.5px solid #cbd5e1;border-radius:10px;padding:7px 10px;font:inherit;font-size:13px}.nt-send{border:1.5px solid #0f2a4e;background:#0f2a4e;color:#fff;border-radius:10px;padding:6px 12px;font:inherit;font-weight:800;cursor:pointer;min-height:34px}.nt-send:disabled{opacity:.5;cursor:not-allowed}
.nt-reply-hint{color:#64748b;font-size:11.5px}.nt-reply-ok{color:#15803d;font-weight:800}.nt-reply-err{color:#b91c1c;font-weight:800}
.nt-chip-voice{border-color:#0f766e;color:#0f766e}.nt-voice{background:#f8fafc;border:1px dashed #99f6e4;border-radius:10px;padding:8px 10px}.nt-rec{background:#b91c1c;border-color:#b91c1c}.nt-rec-dot{width:10px;height:10px;border-radius:50%;background:#dc2626;align-self:center;animation:nt-pulse 1s infinite}@keyframes nt-pulse{0%,100%{opacity:1}50%{opacity:.3}}.nt-rec-time{font-variant-numeric:tabular-nums;align-self:center;color:#0f2a4e;font-size:13px}.nt-voice-ready{display:grid;gap:6px}.nt-voice-ready audio{flex:1;min-width:0;height:34px}.nt-voice-tr{background:#fff;border-radius:8px;padding:6px 8px;border:1px solid #e2e8f0}.nt-voice-tr p{margin:4px 0;color:#475569;font-size:12.5px}@media (prefers-reduced-motion:reduce){.nt-rec-dot{animation:none}}
.nt-tvoice{display:grid;gap:4px;margin:6px 0;justify-items:start}.nt-tvoice-btn{border:1.5px solid #0f766e;background:#fff;color:#0f766e;border-radius:999px;padding:5px 12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;min-height:34px}.nt-tvoice-btn.on{background:#0f766e;color:#fff}.nt-tvoice-btn:disabled{opacity:.6;cursor:wait}.nt-tvoice-tr{color:#94a3b8;font-size:12px;font-style:normal}
`;
