'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P71 «يوم دخلتُ» — شاشة واحدة بين إرسال اختبار التسكين والنتيجة: «لماذا تتعلّم العربية؟»
 *  - نصّ ≤ 200 حرف بأي لغة، أو صوت ≤ 20 ث (MediaRecorder) — أو «أتجاوز الآن» بزرّ واحد. لا تمنع النتيجة ولا تؤخّرها.
 *  - POST /api/miaar {action:'entry'} — الجلسة من الكعكة؛ لا يرى المصحّح شيئًا؛ لا شيء يدخل التقرير.
 *  testids: mi-why[data-lang] mi-why-ta mi-why-count mi-why-save mi-why-skip mi-why-rec mi-why-stop mi-why-play mi-why-redo mi-why-saved mi-why-err
 */
import { useEffect, useRef, useState } from 'react';
import { ENTRY_LIMITS, entryPromptFor } from '../../lib/first/entry-pure';
import { P75_NAMES_AR } from '../../lib/first/why'; /* P75 «لماذا جاؤوا»: إذن الظهور على الرئيسة */
import { useAudioMeter, LevelBar, QualityNote } from '../components/AudioMeter'; /* P72-أ «ضبط الصوت» */
import { qualityMeta, type TakeQuality } from '../../lib/portal/audio-meter';

type Post = (body: any) => Promise<any>;
const ERR_AR: Record<string, string> = { empty: 'السطر فارغ', too_short: 'أقصر من أن يكون سطرًا', no_contact: 'بلا بريد أو هاتف — سطرك يعود إليك أنت، لا نحتاج وسيلة اتصال', too_big: 'التسجيل كبير — سجّل أقصر', too_long: `أكثر من ${ENTRY_LIMITS.voiceSec} ثانية — سجّل أقصر`, bad_voice: 'صيغة الصوت غير مدعومة', session_not_finished: 'أرسل اختبارك أولًا', rate_limited: 'محاولات كثيرة — انتظر قليلًا' };
const ERR_EN: Record<string, string> = { empty: 'Nothing to save', too_short: 'Too short to be a line', no_contact: 'No email or phone — this line comes back to you; we do not need contact details', too_big: 'Recording too large — record a shorter one', too_long: `Longer than ${ENTRY_LIMITS.voiceSec} seconds — record a shorter one`, bad_voice: 'Audio format not supported', session_not_finished: 'Submit your test first', rate_limited: 'Too many attempts — wait a moment' };
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function EntryLine({ lang, post, onDone }: { lang: string; post: Post; onDone: () => void }) {
  const ar = lang === 'ar'; const L = entryPromptFor(ar ? 'ar' : 'en'); const E = ar ? ERR_AR : ERR_EN;
  const [text, setText] = useState(''); const [pubOk, setPubOk] = useState(true); /* P75: مفعَّلة للنصّ؛ تُحفظ مع السطر */ const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [saved, setSaved] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'rec' | 'review'>('idle'); const [sec, setSec] = useState(0); const [blob, setBlob] = useState<Blob | null>(null); const [url, setUrl] = useState(''); const [noMic, setNoMic] = useState(false);
  const rec = useRef<MediaRecorder | null>(null); const chunks = useRef<Blob[]>([]); const stream = useRef<MediaStream | null>(null); const secRef = useRef(0); const tick = useRef<any>(null);
  const [canRecord, setCanRecord] = useState(false); const meter = useAudioMeter(); const [q, setQ] = useState<TakeQuality | null>(null);
  useEffect(() => { setCanRecord(!!(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined'); }, []);
  useEffect(() => () => { stream.current?.getTracks().forEach((t) => t.stop()); if (url) URL.revokeObjectURL(url); clearInterval(tick.current); }, [url]);
  const n = [...text].length;

  function stopRec() { const r = rec.current; if (!r) return; clearInterval(tick.current); if (r.state !== 'inactive') r.stop(); rec.current = null; }
  async function startRec() {
    setErr('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.current = s; meter.attach(s); setQ(null);
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const r = new MediaRecorder(s, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined); chunks.current = []; secRef.current = 0; setSec(0);
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => { const b = new Blob(chunks.current, { type: r.mimeType || mime || 'audio/webm' }); setBlob(b); setUrl(URL.createObjectURL(b)); s.getTracks().forEach((t) => t.stop()); setQ(meter.finish(secRef.current || 1)); setPhase('review'); };
      r.start(1000); rec.current = r; setPhase('rec');
      tick.current = setInterval(() => { secRef.current += 1; setSec(secRef.current); if (secRef.current >= ENTRY_LIMITS.voiceSec) stopRec(); }, 1000);
    } catch { setNoMic(true); setPhase('idle'); }
  }
  const redo = () => { setBlob(null); if (url) URL.revokeObjectURL(url); setUrl(''); setQ(null); setPhase('idle'); };

  async function save() {
    if (busy) return; const body: any = { action: 'entry', lang: ar ? 'ar' : 'en' };
    if (text.trim()) { body.text = text.trim(); body.public_ok = pubOk; } else body.public_ok = false; /* P75: الصوت لا يسافر */
    if (blob) { body.audio = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result || '')); fr.readAsDataURL(blob); }); body.mime = blob.type; body.sec = secRef.current || sec; const qm = qualityMeta(q); if (qm) body.quality = qm; }
    if (!body.text && !body.audio) { setErr(E.empty); return; }
    setBusy(true); setErr(''); const r = await post(body); setBusy(false);
    if (r?.ok) { setSaved(true); setTimeout(onDone, 1400); } else setErr(E[String(r?.error || '')] || (ar ? 'تعذّر الحفظ — يمكنك التجاوز، النتيجة جاهزة' : 'Could not save — you can skip, your result is ready'));
  }

  /* الترويسة (الشارة والعنوان) في Hero الصفحة — البطاقة تحمل السؤال والحقل فقط */
  return <section className="mi-card mi-why" data-testid="mi-why" data-lang={ar ? 'ar' : 'en'} aria-label={L.title}>
    <p className="mi-why-lead">{L.lead}</p>
    {saved ? <p className="mi-simple mi-why-saved" role="status" data-testid="mi-why-saved">{L.saved}</p> : <>
      <label className="mi-why-field"><span className="sr-only">{L.placeholder}</span>
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, ENTRY_LIMITS.textMax))} placeholder={L.placeholder} maxLength={ENTRY_LIMITS.textMax} rows={3} dir="auto" lang="" data-testid="mi-why-ta" disabled={busy} />
        <span className="mi-why-count" data-testid="mi-why-count" aria-live="polite">{n}/{ENTRY_LIMITS.textMax}</span>
      </label>
      {canRecord && !noMic && <div className="mi-why-voice">
        {phase === 'idle' && <button type="button" className="mi-link" onClick={startRec} disabled={busy} data-testid="mi-why-rec">🎙 {L.voice}</button>}
        {phase === 'rec' && <div className="rm-rec mi-why-rec" aria-live="polite"><span className="rm-dot" aria-hidden="true" /><b>{clock(sec)} / {clock(ENTRY_LIMITS.voiceSec)}</b><button type="button" className="mi-next" onClick={stopRec} data-testid="mi-why-stop">{ar ? 'أوقف' : 'Stop'}</button><LevelBar level={meter.level} lvl={meter.lvl} ar={ar} testid="mi-why" /></div>}
        {phase === 'review' && url && <div className="mi-why-review"><audio controls src={url} data-testid="mi-why-play" /><span className="mi-note">{clock(sec)}</span><button type="button" className="mi-link" onClick={redo} data-testid="mi-why-redo">{ar ? 'أعد التسجيل' : 'Record again'}</button><QualityNote q={q} ar={ar} testid="mi-why" /></div>}
      </div>}
      {text.trim() && <label className="mi-why-pub" data-testid="mi-why-pub"><input type="checkbox" checked={pubOk} onChange={(e) => setPubOk(e.target.checked)} disabled={busy} /> <span>{ar ? P75_NAMES_AR.consent : P75_NAMES_AR.consent_en}</span></label>}
      {err && <p className="mi-alert" role="alert" data-testid="mi-why-err">{err}</p>}
      <div className="mi-actions mi-why-actions">
        <button type="button" className="mi-next" onClick={save} disabled={busy || (!text.trim() && !blob)} data-testid="mi-why-save">{busy ? '…' : L.save}</button>
        <button type="button" className="mi-defer" onClick={onDone} disabled={busy} data-testid="mi-why-skip">{L.skip}</button>
      </div>
      <p className="mi-note mi-why-foot">{L.note}</p>
    </>}
  </section>;
}
