'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — صفحة المهمة (P12-أ): رابط موقّع بلا تسجيل دخول. المعيار معلن قبل البدء، التقاط الدليل في المتصفح
// (صورة مضغوطة / تسجيل 60 ثانية مع نسخة نصية حيّة / نص / رابط)، فحص أولي فوري، ثم تأكيد المشرف بضغطة عبر البريد أو واتساب.

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { fmtDate } from '../../../lib/portal/content';
import { MODE_LABEL, MODE_HINT, MIN_WORDS, statusLabel, STATUS_LABEL, daysLeft, urgency, wordCount, evidenceReady, waShare, supervisorShareText } from '../../../lib/portal/missions';
import type { Mission, MissionEvidence, AiCheck } from '../../../lib/portal/missions';
import { useOutbox, valueMoment } from '../../components/Pocket';

export default function MissionPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }
type View = { ok: boolean; mission?: Omit<Mission, 'confirm_token' | 'supervisor_email'>; file_url?: string | null; skills?: { id: string; code: string; name_ar: string; name_en: string }[]; program?: string | null; has_supervisor?: boolean };
const MAX_SEC = 60;

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const params = useParams<{ token: string }>(); const token = String(params?.token || '');
  const [v, setV] = useState<View | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState('');
  const [text, setText] = useState(''); const [caption, setCaption] = useState(''); const [link, setLink] = useState('');
  const [file, setFile] = useState<{ blob: Blob; name: string; type: string; url: string } | null>(null); const [dur, setDur] = useState(0); const [transcript, setTranscript] = useState('');
  const [rec, setRec] = useState<'idle' | 'recording' | 'done'>('idle'); const recRef = useRef<MediaRecorder | null>(null); const chunks = useRef<Blob[]>([]); const timer = useRef<any>(null); const srRef = useRef<any>(null);
  const [sup, setSup] = useState({ name: '', email: '' }); const [result, setResult] = useState<{ ai: AiCheck; confirm_url: string; supervisor_mailed: boolean } | null>(null); const [copied, setCopied] = useState(false);
  const now = useMemo(() => new Date(), []); const ob = useOutbox(); const [queued, setQueued] = useState<{ id: string; offline: boolean } | null>(null);

  useEffect(() => { (async () => { try { const j = await fetch(`/api/m?token=${encodeURIComponent(token)}`).then(x => x.json()); setV(j.success ? j : { ok: false }); } catch { setV({ ok: false }); } })(); }, [token]);
  useEffect(() => () => { try { timer.current && clearInterval(timer.current); srRef.current?.stop?.(); recRef.current?.state === 'recording' && recRef.current.stop(); } catch { /* ignore */ } }, []);

  const m = v?.mission; const mode = m?.evidence_mode || 'text';
  const ev: MissionEvidence = useMemo(() => ({ text: text || undefined, caption: caption || undefined, link: link || undefined, transcript: transcript || undefined, file_path: file ? 'pending/x' : undefined, duration_s: dur || undefined }), [text, caption, link, transcript, file, dur]);
  const ready = m ? evidenceReady(mode, ev) : 'loading';
  const canSubmit = !!m && !ready && !busy && m.status !== 'confirmed';

  // ---- صورة: ضغط في المتصفح إلى ≤1280 بكسل JPEG
  async function pickPhoto(f: File) {
    setErr(''); const url = URL.createObjectURL(f); const img = new Image(); img.src = url; await new Promise(r => { img.onload = r; img.onerror = r; });
    const scale = Math.min(1, 1280 / Math.max(img.width || 1, img.height || 1)); const cv = document.createElement('canvas'); cv.width = Math.round((img.width || 1) * scale); cv.height = Math.round((img.height || 1) * scale);
    cv.getContext('2d')?.drawImage(img, 0, 0, cv.width, cv.height);
    const blob: Blob | null = await new Promise(r => cv.toBlob(b => r(b), 'image/jpeg', 0.82)); URL.revokeObjectURL(url);
    if (!blob) { setErr(ar ? 'تعذّر قراءة الصورة' : 'Could not read image'); return; }
    setFile({ blob, name: 'evidence.jpg', type: 'image/jpeg', url: URL.createObjectURL(blob) });
  }
  // ---- صوت: MediaRecorder + نسخة نصية حية (إن توفّرت في المتصفح)
  async function startRec() {
    setErr(''); try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => (window as any).MediaRecorder?.isTypeSupported?.(t)) || '';
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); chunks.current = []; r.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => { const type = (r.mimeType || mime || 'audio/webm').split(';')[0]; const blob = new Blob(chunks.current, { type }); setFile({ blob, name: `voice.${type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'}`, type, url: URL.createObjectURL(blob) }); stream.getTracks().forEach(t => t.stop()); setRec('done'); };
      recRef.current = r; r.start(250); setRec('recording'); setDur(0); setTranscript('');
      const t0 = Date.now(); timer.current = setInterval(() => { const s = Math.round((Date.now() - t0) / 1000); setDur(s); if (s >= MAX_SEC) stopRec(); }, 250);
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) { try { const sr = new SR(); sr.lang = ar ? 'ar-SA' : 'en-US'; sr.continuous = true; sr.interimResults = true; let finalTxt = ''; sr.onresult = (e: any) => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const tr = e.results[i][0].transcript; if (e.results[i].isFinal) finalTxt += tr + ' '; else interim += tr; } setTranscript((finalTxt + interim).trim()); }; sr.onerror = () => { /* بلا نسخة نصية — المشرف يسمع */ }; sr.start(); srRef.current = sr; } catch { /* ignore */ } }
    } catch { setErr(ar ? 'لم نتمكن من الوصول إلى الميكروفون — اسمح به من المتصفح أو استخدم جهازًا آخر' : 'Microphone unavailable'); }
  }
  function stopRec() { try { timer.current && clearInterval(timer.current); timer.current = null; srRef.current?.stop?.(); srRef.current = null; if (recRef.current?.state === 'recording') recRef.current.stop(); } catch { /* ignore */ } }
  function resetRec() { setFile(null); setDur(0); setTranscript(''); setRec('idle'); }

  /** بلا اتصال (أو فشل شبكي): الدليل يدخل صندوق الأدلة الميداني مشفَّرًا ويُرسل تلقائيًا حين يعود الاتصال — بتاريخ التقاطه */
  async function queueOffline(): Promise<boolean> {
    if (!m) return false;
    const r = await ob.enqueue('mission', { token, title: m.title_ar, evidence: { text: text || undefined, caption: caption || undefined, link: link || undefined, transcript: transcript || undefined, duration_s: dur || undefined }, supervisor_email: sup.email || undefined, supervisor_name: sup.name || undefined }, file ? new File([file.blob], file.name, { type: file.type }) : null);
    if (!r.ok) { setErr(r.reason_ar || (ar ? 'تعذّر الحفظ' : 'Could not save')); return false; }
    setQueued({ id: r.id || '', offline: !navigator.onLine }); valueMoment('mission_submitted'); window.scrollTo({ top: 0, behavior: 'smooth' }); return true;
  }
  async function submit() {
    if (!m) return; setBusy('submit'); setErr('');
    const ready = evidenceReady(mode, { text: text || undefined, caption: caption || undefined, link: link || undefined, transcript: transcript || undefined, file_path: file ? 'x/' : undefined } as MissionEvidence);
    if (typeof navigator !== 'undefined' && !navigator.onLine) { if (ready) { setErr(ready); setBusy(''); return; } await queueOffline(); setBusy(''); return; }
    try {
      let up: any = null;
      if (file) { const fd = new FormData(); fd.append('token', token); fd.append('file', new File([file.blob], file.name, { type: file.type })); up = await fetch('/api/m', { method: 'POST', body: fd }).then(x => x.json()); if (!up.success) throw new Error(up.error || 'upload'); }
      const payload = { action: 'submit', token, evidence: { text: text || undefined, caption: caption || undefined, link: link || undefined, transcript: transcript || undefined, duration_s: dur || undefined, file_path: up?.file_path, file_type: up?.file_type, file_name: up?.file_name, size: up?.size }, supervisor_email: sup.email || undefined, supervisor_name: sup.name || undefined };
      const j = await fetch('/api/m', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(x => x.json()); if (!j.success) throw new Error(j.error || 'submit');
      setResult({ ai: j.ai, confirm_url: j.confirm_url, supervisor_mailed: !!j.supervisor_mailed }); setV(x => x ? { ...x, mission: j.mission, has_supervisor: !!sup.email || x.has_supervisor } : x); valueMoment('mission_submitted'); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      const network = e instanceof TypeError || !navigator.onLine; // انقطاع أثناء الرفع → الصندوق
      if (network && await queueOffline()) return;
      setErr(e?.message || (ar ? 'تعذّر الإرسال' : 'Failed'));
    } finally { setBusy(''); }
  }
  const copy = async (s: string) => { try { await navigator.clipboard.writeText(s); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } };
  const left = m ? daysLeft(m.due_at, now) : 0; const urg = m ? urgency(m.due_at, now) : 'ok';
  const words = mode === 'text' ? wordCount(text) : mode === 'photo' ? wordCount(caption) : mode === 'link' ? wordCount(text) : 0; const need = MIN_WORDS[mode];

  return (
    <main className="pt-main ms">
      <section className="pt-pagehead"><div className="pt-wrap"><div className="pt-crumbs"><Link href="/">{ar ? 'الرئيسية' : 'Home'}</Link> / <span>{ar ? 'مهمة من قلب العمل' : 'Workflow mission'}</span></div>
        <h1>{m ? m.title_ar : (ar ? 'مهمة من قلب العمل' : 'Workflow mission')}</h1>
        {m && <p className="pt-lead">{v?.program ? (ar ? `بعد برنامج «${v.program}» — ` : `After “${v.program}” — `) : ''}{ar ? 'لا نسألك «هل طبّقت؟»؛ نطلب دليلًا صغيرًا حقيقيًا من عملك، يُفحص مقابل معيار معلن ويؤكده مشرفك بضغطة.' : 'We don’t ask “did you apply it?” — we ask for a small real piece of evidence from your work, checked against a published standard and confirmed by your supervisor in one click.'}</p>}
        {m && <div className="ms-chips"><span className="ms-st" style={{ ['--c' as any]: STATUS_LABEL[m.status].color }}>{statusLabel(m.status, lang)}</span><span className={`ms-due ${urg}`}><Icon name="clock" size={14} /> {left >= 0 ? (ar ? `بقي ${left} يوم` : `${left} days left`) : (ar ? `تأخرت ${-left} يوم` : `${-left} days late`)} · {fmtDate(m.due_at, lang)}</span><span className="ms-mode"><Icon name={mode === 'audio' ? 'play' : mode === 'photo' ? 'doc' : mode === 'link' ? 'link' : 'edit'} size={14} /> {MODE_LABEL[mode][lang]}</span></div>}
      </div></section>

      <section className="pt-sec"><div className="pt-wrap" style={{ maxWidth: 880 }}>
        {!v && <div className="pt-empty">…</div>}
        {v && !v.ok && <div className="pt-box pt-empty"><Icon name="alert" size={30} /><h3>{ar ? 'الرابط غير صالح' : 'Invalid link'}</h3><p>{ar ? 'تحقق من الرابط في بريدك، أو اطلب من فريق أَثَر إعادة إرساله.' : 'Check the link in your email or ask the Athar team to resend it.'}</p></div>}
        {err && <div className="pt-alert err" style={{ marginBottom: 12 }}>{err}</div>}

        {m && queued && !result && <div className="ms-result" data-testid="mission-queued" style={{ background: '#fff7ed', border: '1px solid #fdba74' }}>
          <div><h3 style={{ margin: '0 0 6px', color: '#9a3412' }}><Icon name="inbox" size={18} /> {ar ? 'دليلك في صندوق الأدلة الميداني' : 'Your evidence is in the field outbox'}</h3>
            <p style={{ margin: 0, lineHeight: 1.9 }}>{queued.offline ? (ar ? 'لا اتصال الآن. حُفظ الدليل مشفَّرًا على جهازك وسيُرسل تلقائيًا حين يعود الاتصال — ويُسجَّل بتاريخ التقاطه لا بتاريخ وصوله. يمكنك إغلاق الصفحة.' : 'Offline now. Evidence is encrypted on this device and will upload automatically when you reconnect — stamped with capture time.') : (ar ? 'انقطع الاتصال أثناء الرفع؛ حُفظ الدليل وسيُعاد إرساله تلقائيًا.' : 'Connection dropped during upload; saved and will retry automatically.')}</p>
            <p style={{ margin: '6px 0 0' }}><Link href="/offline#outbox">{ar ? 'افتح صندوق الأدلة' : 'Open the outbox'}</Link></p></div>
        </div>}
        {m && result && <div className="ms-result">
          <div className="ms-ring" style={{ ['--p' as any]: result.ai.score }}><b>{result.ai.score}%</b><small>{ar ? 'فحص أولي' : 'first check'}</small></div>
          <div className="ms-restxt">
            <h3>{ar ? 'وصل دليلك — والآن دور الإنسان' : 'Evidence received — now a human confirms'}</h3>
            <p>{result.ai.feedback_ar}</p>
            <ul className="ms-crit">{result.ai.criteria.map((c, i) => <li key={i} className={c.met}><Icon name={c.met === 'yes' ? 'check' : c.met === 'partly' ? 'alert' : 'x'} size={14} /> <span>{c.c}</span><small>{c.note}</small></li>)}</ul>
            <div className="ms-share">
              {result.supervisor_mailed ? <p className="ok"><Icon name="mail" size={14} /> {ar ? 'أُرسل رابط التأكيد إلى مشرفك بالبريد.' : 'A confirmation link was emailed to your supervisor.'}</p> : <p>{ar ? 'أرسل رابط التأكيد إلى مشرفك المباشر — ضغطة واحدة منه تجعل الدليل كامل الوزن:' : 'Send the confirmation link to your direct supervisor — one click makes the evidence full-weight:'}</p>}
              <div className="pt-chips"><a className="pt-btn small" href={waShare(supervisorShareText(m, result.confirm_url))} target="_blank" rel="noopener noreferrer"><Icon name="send" size={14} /> {ar ? 'واتساب' : 'WhatsApp'}</a><button className="pt-btn light small" onClick={() => copy(result.confirm_url)}><Icon name="copy" size={14} /> {copied ? (ar ? 'نُسخ' : 'Copied') : (ar ? 'نسخ رابط التأكيد' : 'Copy link')}</button><Link className="pt-btn ghost small" href="/me/twin"><Icon name="star" size={14} /> {ar ? 'توأمي المهاري' : 'My twin'}</Link></div>
              <small>{ar ? `الفحص الأولي ${result.ai.source === 'ai' ? 'بالذكاء الاصطناعي' : 'بالفاحص المحلي'} — المشرف هو من يعتمد.` : `First check by ${result.ai.source === 'ai' ? 'AI' : 'the local checker'} — the supervisor approves.`}</small>
            </div>
          </div>
        </div>}

        {m && !result && m.status === 'confirmed' && <div className="pt-box ms-done"><Icon name="award" size={34} /><div><h3>{ar ? 'مهمة مؤكَّدة' : 'Confirmed mission'}</h3><p>{ar ? `أكّدها ${m.confirmed_by || 'المشرف'} في ${fmtDate(m.confirmed_at || '', lang)}. أصبحت دليل انتقال أثر كامل الوزن في ملفك المهاري.` : `Confirmed by ${m.confirmed_by || 'supervisor'} on ${fmtDate(m.confirmed_at || '', lang)}.`}</p>{m.confirm_note && <blockquote>{m.confirm_note}</blockquote>}<Link className="pt-btn small" href="/me/twin"><Icon name="star" size={14} /> {ar ? 'شاهد أثرها في توأمك' : 'See it in your twin'}</Link></div></div>}
        {m && !result && m.status === 'returned' && <div className="pt-alert err ms-ret"><b>{ar ? `أعادها ${m.confirmed_by || 'المشرف'} مع ملاحظة:` : `Returned by ${m.confirmed_by || 'supervisor'}:`}</b> {m.confirm_note}<br /><small>{ar ? 'عدّل الدليل وأعد الإرسال من هنا.' : 'Adjust and resubmit below.'}</small></div>}
        {m && !result && m.status === 'submitted' && <div className="pt-alert ok ms-ret"><Icon name="clock" size={14} /> {ar ? `أُرسل دليلك في ${fmtDate(m.submitted_at || '', lang)} وينتظر تأكيد المشرف${v?.has_supervisor ? '' : ' — لم تُضف بريد مشرف؛ يمكنك إعادة الإرسال مع بريده أو مشاركة رابط التأكيد'}.` : 'Your evidence is awaiting supervisor confirmation.'}{m.ai && <> {ar ? 'الفحص الأولي:' : 'First check:'} <b>{m.ai.score}%</b></>}</div>}

        {m && m.status !== 'confirmed' && <div className="ms-grid">
          <aside className="pt-box ms-brief">
            <h3><Icon name="flag" size={16} /> {ar ? 'المهمة' : 'The mission'}</h3>
            <p>{m.brief_ar}</p>
            <h4>{ar ? 'المعيار — معلن قبل البدء' : 'The standard — published up front'}</h4>
            <ol className="ms-rubric">{m.rubric.map((c, i) => <li key={i}><span>{c.c}</span><i title={ar ? `الوزن ${c.w}` : `weight ${c.w}`}>{'●'.repeat(c.w)}</i></li>)}</ol>
            {!!v?.skills?.length && <div className="pt-chips ms-sk">{v.skills.map(s => <span key={s.id} className="ms-skill">{lang === 'en' && s.name_en ? s.name_en : s.name_ar}</span>)}</div>}
            <small className="ms-priv">{ar ? 'الدليل يراه مشرفك وفريق أَثَر فقط. لا يُنشر ولا يُستخدم لتدريب نماذج. لا تصوّر وجوه طلاب أو بيانات شخصية.' : 'Only your supervisor and the Athar team see this evidence. Never photograph students’ faces or personal data.'}</small>
          </aside>

          <div className="pt-box ms-capture">
            <h3><Icon name="target" size={16} /> {MODE_LABEL[mode][lang]}</h3>
            <p className="ms-hint">{MODE_HINT[mode][lang]}</p>

            {mode === 'audio' && <div className="ms-audio">
              {rec !== 'done' && <button type="button" className={`ms-recbtn ${rec}`} onClick={rec === 'recording' ? stopRec : startRec} aria-label={rec === 'recording' ? 'stop' : 'record'}><span className="ms-recring" style={{ ['--p' as any]: Math.min(100, dur / MAX_SEC * 100) }} /><Icon name={rec === 'recording' ? 'stop' : 'play'} size={28} /></button>}
              <div className="ms-rectxt">{rec === 'idle' && <b>{ar ? 'اضغط للتسجيل (60 ثانية كحد أقصى)' : 'Tap to record (max 60s)'}</b>}{rec === 'recording' && <b className="live">● {dur}s / {MAX_SEC}s — {ar ? 'نسجّل… اضغط للإيقاف' : 'recording… tap to stop'}</b>}{rec === 'done' && file && <><b>{ar ? `تم التسجيل (${dur} ث)` : `Recorded (${dur}s)`}</b><audio controls src={file.url} /><button type="button" className="pt-btn ghost small" onClick={resetRec}><Icon name="refresh" size={14} /> {ar ? 'أعد التسجيل' : 'Re-record'}</button></>}
                {(rec === 'recording' || transcript) && <div className="ms-transcript"><small>{ar ? 'نسخة نصية حيّة (قد لا تكون دقيقة — المشرف يسمع التسجيل نفسه)' : 'Live transcript (may be imperfect — the supervisor hears the audio)'}</small><p>{transcript || '…'}</p></div>}
              </div>
            </div>}

            {mode === 'photo' && <div className="ms-photo">
              {!file ? <label className="ms-drop"><input type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) pickPhoto(f); }} /><Icon name="plus" size={26} /><b>{ar ? 'التقط صورة أو اختر من الجهاز' : 'Take or choose a photo'}</b><small>{ar ? 'تُضغط تلقائيًا قبل الرفع' : 'Compressed automatically'}</small></label>
                : <div className="ms-preview"><img src={file.url} alt="" /><button type="button" className="pt-btn ghost small" onClick={() => setFile(null)}><Icon name="refresh" size={14} /> {ar ? 'صورة أخرى' : 'Another photo'}</button></div>}
              <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={4} placeholder={ar ? 'أين يظهر ما تعلمته في هذه الصورة؟ ولماذا هنا؟' : 'Where does the learning show in this photo, and why here?'} />
            </div>}

            {mode === 'text' && <textarea value={text} onChange={e => setText(e.target.value)} rows={9} placeholder={ar ? 'الموقف… القرار الذي اتخذته بناءً على ما تعلمت… النتيجة…' : 'The situation… the decision you made… the result…'} />}
            {mode === 'link' && <><input type="url" dir="ltr" value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" /><textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder={ar ? 'ما هذا المنتج؟ وأين يظهر فيه أثر البرنامج؟' : 'What is this artifact and where does the program show in it?'} /></>}

            {need > 0 && <div className="ms-words"><i style={{ width: `${Math.min(100, words / need * 100)}%` }} /><small>{words}/{need} {ar ? 'كلمة' : 'words'}</small></div>}

            <div className="ms-sup">
              <h4><Icon name="users" size={14} /> {ar ? 'مشرفك المباشر (يؤكد بضغطة واحدة)' : 'Your direct supervisor (confirms in one click)'}</h4>
              <div className="ms-suprow"><input value={sup.name} onChange={e => setSup({ ...sup, name: e.target.value })} placeholder={ar ? 'اسم المشرف' : 'Supervisor name'} /><input type="email" dir="ltr" value={sup.email} onChange={e => setSup({ ...sup, email: e.target.value })} placeholder="supervisor@org.sa" /></div>
              <small>{ar ? 'اختياري الآن — يمكنك مشاركة رابط التأكيد عبر واتساب بعد الإرسال.' : 'Optional — you can share the confirmation link on WhatsApp after submitting.'}</small>
            </div>

            <div className="ms-actions"><button className="pt-btn gold" disabled={!canSubmit} onClick={submit}><Icon name="send" size={16} /> {busy ? (ar ? 'نفحص دليلك…' : 'Checking…') : m.status === 'submitted' || m.status === 'returned' ? (ar ? 'أعد إرسال الدليل' : 'Resubmit evidence') : (ar ? 'أرسل الدليل' : 'Submit evidence')}</button>{ready && ready !== 'loading' && <small className="ms-why">{ready}</small>}</div>
          </div>
        </div>}
      </div></section>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

const CSS = `
.ms .pt-pagehead h1{font-size:clamp(22px,3.2vw,34px)}
.ms-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.ms-chips>span{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.12);color:#fff;border-radius:999px;padding:5px 12px;font-size:12.5px;font-weight:800}
.ms-st{box-shadow:inset 0 0 0 2px var(--c)}.ms-due.soon{background:rgba(201,162,75,.35)!important}.ms-due.late{background:rgba(244,63,94,.4)!important}
.ms-grid{display:grid;grid-template-columns:1fr 1.4fr;gap:16px;margin-top:12px}
.ms-brief h3,.ms-capture h3{display:flex;align-items:center;gap:8px;margin:0 0 8px;color:#0f2a4e;font-size:17px}.ms-brief p{color:#334155;line-height:1.9;margin:0 0 12px;font-size:14.5px}
.ms-brief h4,.ms-sup h4{font-size:13px;color:#0b8a83;margin:10px 0 6px;display:flex;align-items:center;gap:6px}
.ms-rubric{margin:0;padding-inline-start:18px;display:grid;gap:6px}.ms-rubric li{display:flex;justify-content:space-between;gap:8px;font-size:13.5px;color:#0f172a}.ms-rubric i{font-style:normal;color:#c9a24b;letter-spacing:2px;font-size:10px;white-space:nowrap}
.ms-sk{margin-top:10px}.ms-skill{font-size:11.5px;background:#e6f4f3;color:#0b6b66;border-radius:999px;padding:3px 10px;font-weight:800}
.ms-priv{display:block;margin-top:12px;color:#64748b;font-size:11.5px;line-height:1.7;border-top:1px dashed #e2e8f0;padding-top:8px}
.ms-hint{color:#475569;font-size:13.5px;line-height:1.8;margin:0 0 10px;background:#f8fafc;border-inline-start:3px solid #c9a24b;padding:8px 12px;border-radius:8px}
.ms-capture textarea,.ms-capture input{width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px;background:#fff;box-sizing:border-box;margin-top:8px}.ms-capture textarea{resize:vertical;line-height:1.8}
.ms-words{position:relative;height:6px;background:#f1f5f9;border-radius:999px;margin:10px 0 2px}.ms-words i{display:block;height:100%;background:linear-gradient(90deg,#0b8a83,#c9a24b);border-radius:999px;transition:width .3s}.ms-words small{position:absolute;inset-inline-end:0;top:8px;font-size:11px;color:#64748b}
.ms-audio{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:start;margin-top:4px}
.ms-recbtn{position:relative;width:88px;height:88px;border-radius:50%;border:0;background:#0f2a4e;color:#fff;display:grid;place-content:center;cursor:pointer;box-shadow:0 10px 30px rgba(15,42,78,.3)}.ms-recbtn.recording{background:#dc2626;animation:ms-pulse 1.2s infinite}
.ms-recring{position:absolute;inset:-6px;border-radius:50%;background:conic-gradient(#c9a24b calc(var(--p)*1%),rgba(201,162,75,.15) 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 0);mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 0)}
@keyframes ms-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
.ms-rectxt b{display:block;font-size:14px;color:#0f2a4e;margin-bottom:6px}.ms-rectxt b.live{color:#dc2626}.ms-rectxt audio{display:block;width:100%;margin:6px 0}
.ms-transcript{background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:8px 12px;margin-top:8px}.ms-transcript small{color:#64748b;font-size:11px}.ms-transcript p{margin:4px 0 0;font-size:13.5px;color:#0f172a;line-height:1.8;min-height:22px}
.ms-drop{display:grid;place-items:center;gap:4px;border:2px dashed #94a3b8;border-radius:14px;padding:26px 12px;cursor:pointer;background:#f8fafc;color:#0f2a4e;text-align:center}.ms-drop input{display:none}.ms-drop b{font-size:14px}.ms-drop small{color:#64748b}
.ms-preview img{display:block;max-width:100%;max-height:320px;border-radius:12px;margin:0 auto 8px;box-shadow:0 6px 20px rgba(15,23,42,.15)}
.ms-sup{margin-top:14px;border-top:1px dashed #e2e8f0;padding-top:8px}.ms-suprow{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ms-sup small{color:#64748b;font-size:11.5px}
.ms-actions{display:flex;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap}.ms-why{color:#b45309;font-size:12.5px}
.ms-result{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:start;background:linear-gradient(135deg,#0f2a4e,#0b8a83);color:#fff;border-radius:18px;padding:18px 20px;margin-bottom:14px}
.ms-ring{width:110px;height:110px;border-radius:50%;display:grid;place-content:center;text-align:center;background:conic-gradient(#c9a24b calc(var(--p)*1%),rgba(255,255,255,.15) 0);position:relative}.ms-ring::before{content:"";position:absolute;inset:9px;border-radius:50%;background:#0f2a4e}.ms-ring b,.ms-ring small{position:relative}.ms-ring b{font-size:26px;display:block}.ms-ring small{font-size:11px;opacity:.85}
.ms-restxt h3{margin:0 0 6px;font-size:18px}.ms-restxt p{margin:0 0 8px;line-height:1.8;opacity:.95}
.ms-crit{list-style:none;margin:0 0 10px;padding:0;display:grid;gap:6px}.ms-crit li{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center;font-size:13.5px;background:rgba(255,255,255,.1);border-radius:10px;padding:6px 10px}.ms-crit li small{grid-column:2;opacity:.8;font-size:11.5px}.ms-crit li.yes{box-shadow:inset 3px 0 0 #10b981}.ms-crit li.partly{box-shadow:inset 3px 0 0 #c9a24b}.ms-crit li.no{box-shadow:inset 3px 0 0 #f43f5e}
.ms-share p{margin:0 0 8px;font-size:13.5px}.ms-share p.ok{color:#a7f3d0}.ms-share small{display:block;margin-top:8px;opacity:.75;font-size:11.5px}.ms-share .pt-btn{color:#0f2a4e}.ms-share .pt-btn.ghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.55)}.ms-share .pt-btn.ghost:hover{background:rgba(255,255,255,.12)}
.ms-done{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start;border-color:#c9a24b}.ms-done h3{margin:0 0 4px;color:#0f2a4e}.ms-done p{margin:0 0 8px;color:#334155}.ms-done blockquote{margin:0 0 10px;border-inline-start:3px solid #0b8a83;padding:4px 12px;color:#334155;font-size:13.5px}
.ms-ret{margin-bottom:12px;line-height:1.8}
@media(max-width:760px){.ms-grid{grid-template-columns:1fr}.ms-audio{grid-template-columns:1fr;justify-items:center}.ms-result{grid-template-columns:1fr;justify-items:center;text-align:center}.ms-crit li{text-align:start}.ms-suprow{grid-template-columns:1fr}}
`;
