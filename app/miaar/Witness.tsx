'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «شاهِد» — المتصفح (م8): لقطات صغيرة لا فيديو · مؤشّرات محلية بلا نماذج · شريط نزاهة يراه المتقدّم نفسه · همسة المراقب
 *  phase: setup (قبل البدء: معاينة · إضاءة · لقطة هوية (عن بُعد) · موافقة) → active (أثناء الاختبار) → done (إيقاف)
 *  room: أحداث الشاشة فقط (بلا كاميرا) · camera: + لقطات · remote: + هوية + ملء الشاشة + شاشة ثانية
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type WitnessCfg = { mode: 'room' | 'camera' | 'remote'; camera: boolean; interval: number; identity: boolean; fullscreen: boolean; retention_days: number; mode_ar?: string; mode_en?: string };
export type WitnessApi = { enterFullscreen: () => void; mark: (section: string) => void };
type Post = (body: Record<string, unknown>) => Promise<any>;
type Props = { cfg: WitnessCfg; phase: 'setup' | 'active' | 'done'; ar: boolean; post: Post; onSetup?: (s: { ready: boolean; consent: boolean; identity: boolean; error: string | null }) => void; register?: (api: WitnessApi) => void; section?: string };

const T = {
  title: { ar: 'شاهِد — مراقبة مصوَّرة', en: 'Witness — photo proctoring' },
  what: { ar: 'يلتقط المتصفح صورًا صغيرة من كاميرتك كل نصف دقيقة تقريبًا وعند مغادرة الشاشة. لا فيديو ولا صوت ولا بثّ.', en: 'Your browser takes small snapshots from your camera about every half minute and when you leave the screen. No video, no audio, no streaming.' },
  who: { ar: 'يراها طاقم أَثَر فقط لمراجعة نزاهة الاختبار؛ الجهة الطالبة ترى الحكم لا الصور.', en: 'Only Athar staff see them, to review exam integrity; the requesting institution sees the verdict, not the images.' },
  keep: { ar: 'تُحذف الصور بعد {n} يومًا. أي ملاحظة أو إبطال يوقّعه إنسان — لا حكم آلي.', en: 'Images are deleted after {n} days. Any note or annulment is signed by a human — no automated verdicts.' },
  strip: { ar: 'سترى أثناء الاختبار «شريط نزاهتك»: ما يُسجَّل تراه أنت أيضًا.', en: 'During the exam you will see your own integrity strip: whatever is recorded, you see too.' },
  roomOnly: { ar: 'هذه الدعوة بمراقب في القاعة: لا كاميرا، وتُسجَّل فقط مغادرة الشاشة وفقدان التركيز.', en: 'This invitation is proctored in the room: no camera; only leaving the screen and losing focus are recorded.' },
  enable: { ar: 'تشغيل الكاميرا', en: 'Enable camera' }, retry: { ar: 'حاول مجدّدًا', en: 'Try again' },
  denied: { ar: 'لم يُسمح بالكاميرا. هذا الاختبار يتطلّبها — اسمح بها من شريط العنوان ثم «حاول مجدّدًا».', en: 'Camera was not allowed. This exam requires it — allow it from the address bar, then “Try again”.' },
  nocam: { ar: 'لا توجد كاميرا متاحة على هذا الجهاز.', en: 'No camera is available on this device.' },
  /* م8-ب: المراقبة صفة لكل اختبار — في وضع «قاعة + شاهِد» لا يوقفك غياب الكاميرا؛ يُسجَّل ذلك ويُبلَّغ المراقب */
  nocamGo: { ar: 'لا كاميرا متاحة أو لم يُسمح بها. يمكنك المتابعة: سيُسجَّل في سجلّ النزاهة أن الكاميرا غير متاحة، ويرى المراقب ذلك في القاعة.', en: 'No camera available or not allowed. You may continue: the integrity log will record that the camera was unavailable and the proctor will see it in the hall.' },
  dark: { ar: 'الإضاءة ضعيفة — اجلس مواجهًا لمصدر الضوء.', en: 'Low light — face a light source.' }, good: { ar: 'الإضاءة جيدة · ضع وجهك داخل الإطار', en: 'Good light · keep your face in the frame' },
  idTitle: { ar: 'لقطة الهوية (عن بُعد)', en: 'Identity snapshot (remote)' }, idHint: { ar: 'ارفع بطاقتك بجانب وجهك ثم اضغط «التقاط». تُحفظ للطاقم فقط.', en: 'Hold your ID card beside your face and press “Capture”. Stored for staff only.' },
  capture: { ar: 'التقاط', en: 'Capture' }, recapture: { ar: 'إعادة الالتقاط', en: 'Retake' }, captured: { ar: 'التُقطت ✓', en: 'Captured ✓' },
  consent: { ar: 'أوافق على المراقبة المصوَّرة كما وُصفت أعلاه.', en: 'I consent to photo proctoring as described above.' },
  fs: { ar: 'عُد إلى ملء الشاشة — الاختبار عن بُعد يتطلّبه', en: 'Return to full screen — the remote exam requires it' }, fsBtn: { ar: 'ملء الشاشة', en: 'Full screen' },
  on: { ar: 'شاهِد يعمل', en: 'Witness on' }, off: { ar: 'الكاميرا منقطعة', en: 'Camera lost' }, strip2: { ar: 'شريط نزاهتك', en: 'Your integrity strip' },
  c_tab: { ar: 'مغادرة', en: 'left' }, c_focus: { ar: 'تركيز', en: 'focus' }, c_fs: { ar: 'ملء الشاشة', en: 'fullscreen' }, c_cam: { ar: 'كاميرا', en: 'camera' }, c_frames: { ar: 'لقطة', en: 'frames' },
  whisper: { ar: 'همسة المراقب', en: 'Proctor whisper' }, dismiss: { ar: 'حسنًا', en: 'OK' },
};
const CSS = `
.wit-card{border:1px solid #99f6e4;background:#f0fdfa;border-radius:16px;padding:14px;display:grid;gap:10px;color:#134e4a;font-size:14px;line-height:1.8}
.wit-card h4{margin:0;font-size:15px;color:#0b8a83;display:flex;align-items:center;gap:8px}.wit-card ul{margin:0;padding-inline-start:18px}.wit-card li{margin:0}
.wit-cam{display:grid;grid-template-columns:200px 1fr;gap:12px;align-items:start}.wit-cam video,.wit-cam img{width:200px;height:150px;border-radius:12px;background:#0f172a;object-fit:cover;transform:scaleX(-1)}
.wit-cam img{transform:none}.wit-st{display:grid;gap:8px;min-width:0}.wit-ok{color:#0b8a83;font-weight:800}.wit-bad{color:#b45309;font-weight:800}.wit-err{color:#b91c1c;font-weight:800}
.wit-btn{border:1px solid #0b8a83;background:#fff;color:#0b8a83;border-radius:10px;padding:7px 12px;font-weight:800;cursor:pointer;font-family:inherit}.wit-btn.solid{background:#0b8a83;color:#fff}.wit-btn:disabled{opacity:.5;cursor:not-allowed}
.wit-consent{display:flex;gap:10px;align-items:flex-start;font-weight:800}.wit-consent input{margin-top:6px;width:18px;height:18px}
.wit-badge{position:fixed;inset-inline-end:14px;bottom:88px;z-index:60;background:rgba(15,42,78,.94);color:#fff;border-radius:14px;padding:8px 12px;font-size:12px;display:grid;gap:4px;min-width:150px;box-shadow:0 8px 24px rgba(0,0,0,.18);direction:inherit}
.wit-badge b{display:flex;align-items:center;gap:6px;font-size:12.5px}.wit-dot{width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.25)}.wit-dot.off{background:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.25)}
.wit-cnt{display:flex;flex-wrap:wrap;gap:6px;opacity:.92}.wit-cnt span{background:rgba(255,255,255,.12);border-radius:8px;padding:1px 7px}
.wit-fs{position:fixed;inset-inline:0;top:0;z-index:70;background:#b45309;color:#fff;padding:10px 16px;display:flex;gap:12px;align-items:center;justify-content:center;font-weight:800}
.wit-toast{position:fixed;inset-inline-end:14px;bottom:170px;z-index:65;background:#fffbeb;border:1px solid #f59e0b;color:#78350f;border-radius:14px;padding:10px 14px;max-width:320px;box-shadow:0 8px 24px rgba(0,0,0,.14);display:grid;gap:6px;font-size:14px}
.wit-toast b{font-size:12px;color:#b45309}
@media (max-width:640px){.wit-cam{grid-template-columns:1fr}.wit-cam video,.wit-cam img{width:100%;height:auto;aspect-ratio:4/3}.wit-badge{bottom:70px;inset-inline-end:8px;min-width:0}}
`;
const W = 240, H = 180, SW = 24, SH = 18, DARK = 18, STILL = 2.2;
/* لقطة الهوية تُلتقط في مثيل «الإعداد» وتُرفع من مثيل «النشاط» بعد بدء الجلسة — تسليم داخل الوحدة لا يغادر المتصفح */
let handoffIdentity: string | null = null;

export default function Witness({ cfg, phase, ar, post, onSetup, register, section }: Props) {
  const t = useCallback((k: keyof typeof T, vars?: Record<string, string | number>) => { let v = T[k][ar ? 'ar' : 'en']; if (vars) for (const [a, b] of Object.entries(vars)) v = v.replace(`{${a}}`, String(b)); return v; }, [ar]);
  const videoRef = useRef<HTMLVideoElement | null>(null); const streamRef = useRef<MediaStream | null>(null); const canvasRef = useRef<HTMLCanvasElement | null>(null); const smallRef = useRef<HTMLCanvasElement | null>(null);
  const prevGray = useRef<Uint8ClampedArray | null>(null); const stillRun = useRef(0); const darkFlag = useRef(false); const identityRef = useRef<string | null>(null); const identitySent = useRef(false);
  const hiddenAt = useRef<number | null>(null); const blurAt = useRef<number | null>(null); const since = useRef<string>(new Date(0).toISOString()); const timer = useRef<ReturnType<typeof setTimeout> | null>(null); const activeRef = useRef(false);
  const [camState, setCamState] = useState<'idle' | 'on' | 'denied' | 'none' | 'lost'>('idle'); const [lum, setLum] = useState<number | null>(null); const [consent, setConsent] = useState(false); const [identityShot, setIdentityShot] = useState<string | null>(null);
  const [counters, setCounters] = useState({ tab: 0, focus: 0, fs: 0, cam: 0, frames: 0 }); const [whispers, setWhispers] = useState<Array<{ at: string; text: string }>>([]); const [needFs, setNeedFs] = useState(false);
  const sectionRef = useRef<string | undefined>(undefined);

  /* ---------- الكاميرا ---------- */
  const attach = useCallback((s: MediaStream) => { streamRef.current = s; const v = videoRef.current; if (v) { v.srcObject = s; void v.play().catch(() => null); } setCamState('on'); s.getVideoTracks().forEach((tr) => { tr.onended = () => { setCamState('lost'); darkFlag.current = true; void send('camera_lost', { reason: 'ended' }, false); }; }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const enable = useCallback(async () => {
    if (!cfg.camera) return; if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) { setCamState('none'); return; }
    try { const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' }, audio: false }); attach(s); }
    catch (e: any) { setCamState(e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' ? 'none' : 'denied'); }
  }, [cfg.camera, attach]);
  function grab(): { b64: string | null; lum: number; diff: number } {
    const v = videoRef.current; const c = canvasRef.current || (canvasRef.current = document.createElement('canvas')); const sc = smallRef.current || (smallRef.current = document.createElement('canvas'));
    if (!v || v.readyState < 2 || !v.videoWidth) return { b64: null, lum: 0, diff: 0 };
    c.width = W; c.height = H; const ctx = c.getContext('2d'); if (!ctx) return { b64: null, lum: 0, diff: 0 }; ctx.drawImage(v, 0, 0, W, H);
    sc.width = SW; sc.height = SH; const sctx = sc.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null; if (!sctx) return { b64: null, lum: 0, diff: 0 }; sctx.drawImage(c, 0, 0, SW, SH);
    const d = sctx.getImageData(0, 0, SW, SH).data; const gray = new Uint8ClampedArray(SW * SH); let sum = 0;
    for (let i = 0; i < SW * SH; i += 1) { const g = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000; gray[i] = g; sum += g; }
    const L = sum / (SW * SH); let diff = 0; if (prevGray.current) { let acc = 0; for (let i = 0; i < gray.length; i += 1) acc += Math.abs(gray[i] - prevGray.current[i]); diff = acc / gray.length; } else diff = 99;
    prevGray.current = gray;
    let b64 = c.toDataURL('image/jpeg', 0.55); if (b64.length > 16 * 1024 * 1.3) b64 = c.toDataURL('image/jpeg', 0.4);
    return { b64, lum: L, diff };
  }
  /* ---------- الإرسال ---------- */
  const send = useCallback(async (kind: string, meta: Record<string, unknown> = {}, withFrame = true) => {
    if (!activeRef.current) return;
    let frame: string | undefined; if (withFrame && cfg.camera && camState !== 'denied' && camState !== 'none') { const g = grab(); if (g.b64 && g.lum >= DARK) frame = g.b64; }
    const r = await post({ action: 'witness_event', kind, meta, frame, since: since.current }).catch(() => null);
    if (r?.ok) { since.current = r.at || since.current; if (frame && r.stored) setCounters((c) => ({ ...c, frames: r.frames ?? c.frames + 1 })); if (Array.isArray(r.whispers) && r.whispers.length) setWhispers((w) => [...w, ...r.whispers]); }
  }, [post, cfg.camera, camState]); // eslint-disable-line react-hooks/exhaustive-deps
  const periodic = useCallback(() => {
    if (!activeRef.current || !cfg.camera) return;
    const g = grab();
    if (g.b64 && g.lum < DARK) { if (!darkFlag.current) { darkFlag.current = true; setCamState('lost'); setCounters((c) => ({ ...c, cam: c.cam + 1 })); void send('camera_lost', { reason: 'dark', lum: g.lum }, false); } }
    else if (g.b64) {
      if (darkFlag.current) { darkFlag.current = false; setCamState('on'); void send('camera_back', { lum: g.lum }, true); }
      else { if (g.diff < STILL) { stillRun.current += 1; if (stillRun.current === 6) void send('still_frame', { frames: 6 }, true); } else stillRun.current = 0; void send('frame', { lum: g.lum, diff: g.diff }, true); }
    }
    const base = Math.max(20, cfg.interval || 45) * 1000; timer.current = setTimeout(periodic, base * (0.7 + Math.random() * 0.6));
  }, [cfg.camera, cfg.interval, send]);

  /* لقطة الهوية تُرفع بعد أن تصبح الجلسة قائمة؛ تُعاد المحاولة مع كل قسم حتى تُقبل (قبل فتح الجلسة يرفضها الخادم) */
  const identityBusy = useRef(false);
  const flushIdentity = useCallback(async () => {
    const idShot = identityRef.current || handoffIdentity; if (!cfg.identity || !idShot || identitySent.current || identityBusy.current) return;
    identityBusy.current = true; const r = await post({ action: 'witness_event', kind: 'identity_frame', meta: {}, frame: idShot, since: since.current }).catch(() => null); identityBusy.current = false;
    if (r?.ok) { identitySent.current = true; handoffIdentity = null; }
  }, [cfg.identity, post]);
  /* ---------- التهيئة ---------- */
  useEffect(() => { if ((phase === 'setup' || phase === 'active') && cfg.camera && camState === 'idle') void enable(); }, [phase, cfg.camera, camState, enable]);
  useEffect(() => { if (phase !== 'setup' || !cfg.camera) return; const id = setInterval(() => { const g = grab(); if (g.b64) setLum(Math.round(g.lum)); }, 1200); return () => clearInterval(id); }, [phase, cfg.camera, camState]);
  useEffect(() => { const noCam = camState === 'denied' || camState === 'none'; onSetup?.({ ready: !cfg.camera || (camState === 'on' && (!cfg.identity || !!identityShot)) || (noCam && !cfg.identity) /* م8-ب: «قاعة + شاهِد» لا يوقفه غياب الكاميرا؛ «عن بُعد» يتطلّبها */, consent: !cfg.camera || consent, identity: !!identityShot, error: noCam && !cfg.identity ? null : camState === 'denied' ? t('denied') : camState === 'none' ? t('nocam') : null }); }, [cfg.camera, cfg.identity, camState, consent, identityShot, onSetup, t]);
  useEffect(() => { register?.({ enterFullscreen: () => { if (!cfg.fullscreen) return; try { void document.documentElement.requestFullscreen?.(); } catch { /* غير مدعوم */ } }, mark: (s: string) => { if (sectionRef.current !== s) { sectionRef.current = s; void send('section_start', { section: s }, true); } } }); }, [register, cfg.fullscreen, send]);

  /* ---------- النشاط ---------- */
  useEffect(() => {
    if (phase !== 'active') { activeRef.current = false; if (timer.current) clearTimeout(timer.current); return; }
    activeRef.current = true;
    void flushIdentity();
    if (cfg.fullscreen) { const ext = (window.screen as any)?.isExtended; if (ext === true) void send('screen_extended', {}, false); setNeedFs(!document.fullscreenElement); }
    if (section) { sectionRef.current = section; void send('section_start', { section }, true); }
    if (cfg.camera) timer.current = setTimeout(periodic, 1500);
    const onVis = () => { if (document.hidden) hiddenAt.current = Date.now(); else if (hiddenAt.current) { const sec = (Date.now() - hiddenAt.current) / 1000; hiddenAt.current = null; setCounters((c) => ({ ...c, tab: c.tab + 1 })); void send('tab_hidden', { seconds: sec }, true); } };
    const onBlur = () => { if (!document.hidden) blurAt.current = Date.now(); };
    const onFocus = () => { if (blurAt.current && !document.hidden) { const sec = (Date.now() - blurAt.current) / 1000; blurAt.current = null; if (sec >= 1.5) { setCounters((c) => ({ ...c, focus: c.focus + 1 })); void send('focus_lost', { seconds: sec }, true); } } blurAt.current = null; };
    const onFs = () => { if (!cfg.fullscreen) return; const out = !document.fullscreenElement; setNeedFs(out); if (out) { setCounters((c) => ({ ...c, fs: c.fs + 1 })); void send('fullscreen_exit', {}, true); } };
    const onPaste = (e: ClipboardEvent) => { const n = (e.clipboardData?.getData('text') || '').length; if (n >= 20) void send('paste', { chars: n }, false); };
    document.addEventListener('visibilitychange', onVis); window.addEventListener('blur', onBlur); window.addEventListener('focus', onFocus); document.addEventListener('fullscreenchange', onFs); document.addEventListener('paste', onPaste);
    const ping = setInterval(() => { void post({ action: 'witness_ping', since: since.current }).then((r) => { if (r?.ok) { since.current = r.at || since.current; if (Array.isArray(r.whispers) && r.whispers.length) setWhispers((w) => [...w, ...r.whispers]); } }).catch(() => null); }, 20000);
    return () => { activeRef.current = false; if (timer.current) clearTimeout(timer.current); clearInterval(ping); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', onBlur); window.removeEventListener('focus', onFocus); document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('paste', onPaste); };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (phase === 'active' && section) { void flushIdentity(); if (sectionRef.current !== section) { sectionRef.current = section; void send('section_start', { section }, true); } } }, [section, phase, send, flushIdentity]);
  useEffect(() => { if (phase !== 'done') return; streamRef.current?.getTracks().forEach((tr) => tr.stop()); streamRef.current = null; if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => null); }, [phase]);
  useEffect(() => () => { streamRef.current?.getTracks().forEach((tr) => tr.stop()); }, []);
  /* م8-ب: كاميرا غير متاحة/مرفوضة في وضع «قاعة + شاهِد» → حدث واحد camera_lost بعد أن تصبح الجلسة نشطة (بعد مؤثّر النشاط أعلاه) */
  const unavailSent = useRef(false); const sendRef = useRef(send); sendRef.current = send; /* مرجع ثابت: الأب يعيد الرسم كل ثانية (المؤقّت) فلا نعيد ضبط المهلة */
  useEffect(() => { if (phase !== 'active' || !cfg.camera || unavailSent.current || !(camState === 'denied' || camState === 'none')) return; const id = setTimeout(() => { if (!activeRef.current || unavailSent.current) return; unavailSent.current = true; setCounters((c) => ({ ...c, cam: c.cam + 1 })); void sendRef.current('camera_lost', { reason: camState === 'none' ? 'unavailable' : 'denied' }, false); }, 1200); return () => clearTimeout(id); }, [phase, cfg.camera, camState]);
  useEffect(() => { if (phase !== 'active' || !cfg.camera || camState !== 'on') return; const id = setTimeout(() => { if (!activeRef.current) return; const g = grab(); if (g.b64 && g.lum >= DARK) void send('frame', { lum: g.lum, diff: g.diff, first: true }, true); }, 1200); return () => clearTimeout(id); }, [phase, cfg.camera, camState]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (phase !== 'active' || !cfg.camera || camState !== 'lost') return; const id = setInterval(() => { if (!streamRef.current || streamRef.current.getVideoTracks().every((tr) => tr.readyState === 'ended')) void enable(); }, 10000); return () => clearInterval(id); }, [phase, cfg.camera, camState, enable]);

  if (phase === 'done') return null;
  const videoEl = <video ref={videoRef} muted playsInline autoPlay aria-hidden={phase !== 'setup'} style={phase === 'setup' ? undefined : { position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', bottom: 0 }} data-testid="wit-video" />;
  if (phase === 'setup') {
    return <div className="wit-card" data-testid="wit-setup" data-mode={cfg.mode}><style>{CSS}</style>
      <h4><span aria-hidden="true">◉</span> {t('title')} — {ar ? cfg.mode_ar : cfg.mode_en}</h4>
      {!cfg.camera ? <p>{t('roomOnly')}</p> : <>
        <ul><li>{t('what')}</li><li>{t('who')}</li><li>{t('keep', { n: cfg.retention_days })}</li><li>{t('strip')}</li></ul>
        <div className="wit-cam">{videoEl}
          <div className="wit-st">
            {camState === 'on' && <span className={lum !== null && lum < DARK ? 'wit-bad' : 'wit-ok'} data-testid="wit-light">{lum !== null && lum < DARK ? t('dark') : t('good')}</span>}
            {camState === 'denied' && <><span className="wit-err" data-testid="wit-denied">{cfg.identity ? t('denied') : t('nocamGo')}</span><button type="button" className="wit-btn" onClick={() => void enable()}>{t('retry')}</button></>}
            {camState === 'none' && <span className="wit-err" data-testid="wit-none">{cfg.identity ? t('nocam') : t('nocamGo')}</span>}
            {camState === 'idle' && <button type="button" className="wit-btn solid" onClick={() => void enable()} data-testid="wit-enable">{t('enable')}</button>}
            {cfg.identity && camState === 'on' && <div data-testid="wit-identity"><b>{t('idTitle')}</b><p style={{ margin: '2px 0 6px' }}>{t('idHint')}</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="wit-btn solid" onClick={() => { const g = grab(); if (g.b64) { identityRef.current = g.b64; handoffIdentity = g.b64; setIdentityShot(g.b64); } }} data-testid="wit-id-capture">{identityShot ? t('recapture') : t('capture')}</button>
                {identityShot && <><img src={identityShot} alt="" width={80} height={60} style={{ width: 80, height: 60, borderRadius: 8 }} /><span className="wit-ok">{t('captured')}</span></>}
              </div></div>}
          </div>
        </div>
        <label className="wit-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="wit-consent" /><span>{t('consent')}</span></label>
      </>}
    </div>;
  }
  /* active — في وضع القاعة بمراقب لا شيء يظهر (الأحداث تُسجَّل بصمت) */
  if (!cfg.camera) return null;
  return <>
    {videoEl}
    <div className="wit-badge" data-testid="wit-badge" data-cam={camState} aria-live="polite"><style>{CSS}</style>
      <b><span className={`wit-dot${cfg.camera && camState !== 'on' ? ' off' : ''}`} /> {cfg.camera ? (camState === 'on' ? t('on') : t('off')) : t('strip2')}</b>
      <div className="wit-cnt" title={t('strip2')}>
        <span data-testid="wit-c-tab">{t('c_tab')} {counters.tab}</span><span>{t('c_focus')} {counters.focus}</span>{cfg.fullscreen && <span>{t('c_fs')} {counters.fs}</span>}{cfg.camera && <><span>{t('c_cam')} {counters.cam}</span><span data-testid="wit-c-frames">{t('c_frames')} {counters.frames}</span></>}
      </div>
    </div>
    {needFs && cfg.fullscreen && <div className="wit-fs" role="alert" data-testid="wit-fs"><span>{t('fs')}</span><button type="button" className="wit-btn" style={{ borderColor: '#fff', color: '#fff', background: 'transparent' }} onClick={() => { try { void document.documentElement.requestFullscreen?.(); } catch { /* غير مدعوم */ } }}>{t('fsBtn')}</button></div>}
    {whispers.length > 0 && <div className="wit-toast" role="status" data-testid="wit-whisper"><b>{t('whisper')}</b><span>{whispers[whispers.length - 1].text}</span><button type="button" className="wit-btn" onClick={() => setWhispers([])}>{t('dismiss')}</button></div>}
  </>;
}
