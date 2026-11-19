'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «اقْرَأْ — من أَثَر» — واجهة المتعلّم (ق1). عربية فقط.
 *  الهوية: رمز نتيجة مِعيار من الرابط (?code=ML-…) أو جلسة حساب أَثَر؛ وإلا بوّابة «ابدأ بمِعيار أولًا».
 *  الشاشات: المستوى (المنازل → الحلقات · خطواتي · أيامي · سؤال اليوم) → الحلقة بخمس محطّات (مدخل/نصّ → بطاقات → قاعدة → مِران → أثر الحلقة)
 *          → «أراجع» (بطاقات مستحقّة بتقليب + مِران الأخطاء) → «دفتري» (كلماتي ونسبة الإتقان + طباعة).
 *  المِران: اختيار · مطابقة باللمس (يسار ثم يمين) · ترتيب باللمس (انقر الكلمات بالترتيب) — كلّها بلوحة المفاتيح أيضًا. التصحيح على الخادم.
 *  WCAG: أهداف ≥ 44px · aria-live للتغذية الراجعة · تباين · بلا سحب إلزامي.
 *  الخطوة 2 (2026-11-17): الحلقة بستّ محطّات (أسمع وأقرأ · كلماتي · القاعدة · المِران 10 من 30 · أُنتج · أثر الحلقة) · تسعة أنواع مِران ·
 *   «اسمع» بشريط الحلقة المسجَّل (أصوات فرقة أَثَر؛ لا صوت جهاز) · «ساعاتي» (نبضة كلّ 30 ث مع تفاعل خلال 90 ث وصفحة ظاهرة) ·
 *   مكتبة المستوى · شارة المهارة و«أستطيع أن…» على كلّ حلقة · ساعات خارج أَثَر تُعرض منفصلة.
 *  «صوت أَثَر الواحد» (2026-11-17): شريط الحلقة (MP3 + cues) بأصوات «فرقة أَثَر» — الراوي نفسه في مِعيار — كلّ شخصية بصوتها الثابت؛
 *   «مسرح الحلقة» (فقاعات بأسماء الشخصيّات، السطر المنطوق يضيء، انقر سطرًا لتسمعه) · «العب الدور» (تُكتم شخصية ويتوقّف الشريط عند سطرها: دورك) ·
 *   «اسمع ثمّ أعد» في البطاقات · الإملاء و«اسمع:» بصوت صاحب الجملة · استماع المكتبة مرّتان كمِعيار · إن غاب الشريط: شارة «التسجيل الرسمي قادم» بلا أزرار. lib/iqra/voice.ts
 *  ق٢ (2026-11-17): بطاقة «العَتَبة» (طلب اختبار نهاية المستوى المعياري عند 70/90 أو الأرضية · حالة الطلب · رابط الدعوة · الحكم) · بطاقة «عبرتُ» بعد الانتقال ·
 *   في «أُنتج»: «أرسل لمراجعة بشرية» (نصّان/أسبوع) وردود المصحّح بالسلّم التحليلي من 4 وجملة معادة الكتابة.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { loadCues, findCue, lineCues, roles as rolesOf, Sprite, dabtOf, readDabtPref, writeDabtPref, type Cues, type Cue, type CueKind } from '../../lib/iqra/voice';
import WayBar from '../components/WayBar';
import ReadSize from '../components/ReadSize'; /* «خطّ أَثَر»: حجم القراءة */
import { supabase } from '../../lib/supabase/client';
import { downloadUnit, removeUnit, listUnits, enqueue, flush, outboxCount, requestSync, isNetworkError, fmtBytes, IQRA_UNIT_CAP, type UnitMeta } from '../../lib/iqra/offline'; /* ق٢ د٣: المَنزِلة في جيبي */

type Ex = { id: string; kind: 'mcq' | 'matching' | 'ordering' | 'picture_choice' | 'cloze_bank' | 'true_false_notgiven' | 'word_tap' | 'short_dictation' | 'picture_sequence'; prompt_ar: string; options?: { id: string; text: string; image?: string }[]; left?: string[]; right?: string[]; words?: string[]; text?: string; bank?: string[]; passage_ar?: string; say?: string; frames?: { image: string; text: string }[] };
type Fb = { correct: boolean; explanation_ar: string | null; correct_option?: string; correct_pairs?: [string, string][]; correct_order?: string[]; correct_gaps?: string[]; correct_word?: string; correct_text?: string };
type Hours = { hours: number; target: number; pct: number; external_hours: number; per_week: number; weeks_left: number | null; today_min: number; mastery_pct: number; threshold: { early_ready: boolean; full_ready: boolean; early_rule: string; state: 'ready' | 'early' | 'building' } };
type Skill = { key: string; name_ar: string } | null;
type Activity = 'lesson' | 'review' | 'daily' | 'library' | 'free' | 'produce';
type Card = { id: string; word_ar: string; pos: string | null; gloss_ar: string; example_ar: string; audio_path: string | null; image_path: string | null; lesson_code?: string | null };
type ThrReq = { id: string; status: string; status_ar: string; invite_url: string | null; defer_note: string | null; exit_total: number | null; gate?: string; opens_at?: string | null; expires_at?: string | null };
type Thr = { state: 'building' | 'early' | 'ready'; gate: 'early' | 'full' | null; hours: number; target: number; mastery_pct: number; eligible: boolean; reason: string | null; next_label: string | null; exam: { official_ar: string; minutes: number; counts: Record<string, number>; cut: number; skill_min: number; retake_days: number; skill_retake_days: number; weights_ar: string } | null; copy: { what: string; who: string; pre_a1: string | null }; request: ThrReq | null };
type Crossed = { from: string; to: string; hours: number; target: number; days: number; exit_total: number | null; gate: string | null };
type PReply = { id: string; lesson_id: string; status: string; words: number; text: string; created_at: string; reviewed_at: string | null; score: number | null; rubric: Record<string, { score: number | null; name_ar: string; band_ar: string }> | null; comment: string | null; rewritten: string | null };
type Home = { gate: string; copy?: { title: string; body: string; cta?: string; href?: string }; المستوى?: { label: string; name_ar: string; code: string; line_ar: string; can_ar: string; next: string | null }; منازل?: { code: string; title_ar: string; focus_ar: string; حلقات: { id: string; code?: string; title_ar: string; goal_ar: string; minutes: number; minutes_total: number; مهارة: Skill; can_do_ar: string; حالة: 'new' | 'started' | 'done'; درجة: number | null; مجاب: number; الكلّ: number; مكتملة: boolean }[] }[]; خطواتي?: { done: number; total: number; pct: number }; أيامي?: number; أراجع_مستحقّ?: number; التالية?: { id: string; title_ar: string } | null; سؤال_اليوم?: Ex | null; فارغ?: boolean; ساعاتي?: Hours | null; مكتبة?: number; العَتَبة?: { state: string; eligible: boolean; request: ThrReq | null }; عبرتُ?: Crossed | null };
type Lesson = { id: string; code?: string; title_ar: string; goal_ar: string; minutes: number; minutes_total: number; مهارة: Skill; can_do_ar: string; can_do_en: string; descriptor_codes: string[]; المنزلة: { code: string; title_ar: string }; content: { intro_ar: string; text?: { kind: string; body: string; audio_path?: string | null } | null; grammar?: { title_ar: string; explanation_ar: string; examples: string[] } | null; speaking?: { prompt_ar: string; guide_ar: string } | null; writing?: { topic_ar: string; instructions_ar: string } | null; produce?: { kind: 'write' | 'speak'; prompt_ar: string; checklist: string[]; model_ar: string; min_words?: number } | null; closing_ar?: string | null }; بطاقات: Card[]; مِران: Ex[]; زيارة: { رقم: number; مسحوب: number; مجاب: number; الكلّ: number; مكتملة: boolean }; أُنتج: { saved_at: string; words: number; checked: boolean[] } | null; تقدّمي: { status: string; score: number | null; attempts: number; answered: number }; قريبًا: string[] };
type Review = { review_id: string; kind: 'card' | 'item'; interval_days: number; card?: Card | null; exercise?: Ex | null };
type Screen = { s: 'home' } | { s: 'lesson'; id: string } | { s: 'reviews' } | { s: 'notebook' } | { s: 'library'; id?: string };
const STATIONS = ['أسمع وأقرأ', 'كلماتي', 'القاعدة', 'المِران', 'أُنتج', 'أثر الحلقة'] as const;

/* ---------- «صوت أَثَر الواحد»: شريط الحلقة المسجَّل بأصوات فرقة أَثَر فقط. لا صوت جهاز أبدًا (قرار المالك 2026-11-17: مخارج واحدة في كلّ التسجيلات) — إن غاب الشريط تظهر شارة «قادم» بلا أزرار ---------- */
type VoiceCtxT = { cues: Cues | null; sprite: Sprite | null; ready: boolean; dabt: boolean; setDabt: (on: boolean) => void };
const VoiceCtx = createContext<VoiceCtxT>({ cues: null, sprite: null, ready: false, dabt: false, setDabt: () => undefined });
function useVoice(code: string | null | undefined): VoiceCtxT {
  const [v, setV] = useState<{ cues: Cues | null; sprite: Sprite | null; ready: boolean }>({ cues: null, sprite: null, ready: false });
  const [dabt, setDabtState] = useState(false); useEffect(() => { setDabtState(readDabtPref()); }, []);
  const setDabt = useCallback((on: boolean) => { setDabtState(on); writeDabtPref(on); }, []);
  useEffect(() => { let on = true; setV({ cues: null, sprite: null, ready: false }); loadCues(code).then((c) => { if (!on) return; setV({ cues: c, sprite: c ? new Sprite(c.src) : null, ready: true }); }); return () => { on = false; }; }, [code]);
  useEffect(() => () => { try { v.sprite?.dispose(); } catch { /* لا شيء */ } }, [v.sprite]);
  return useMemo(() => ({ ...v, dabt, setDabt }), [v, dabt, setDabt]);
}
/** زرّ «اسمع»: k/ck يحدّدان المقطع في الشريط (card/ex/dict/pic/gex بنصّه، line برقمه، intro). echo: بعد السماع «قلها» ثلاث ثوانٍ. */
function Say({ text, label = 'اسمع', slow, k, ck, echo }: { text: string; label?: string; slow?: boolean; k?: CueKind; ck?: string | number; echo?: boolean }) {
  const { cues, sprite } = useContext(VoiceCtx); const [on, setOn] = useState(false); const [say, setSay] = useState(false);
  const cue = k ? findCue(cues, k, ck ?? text) : null;
  if (!cue || !sprite) return null;
  const go = async () => { setOn(true); await sprite.play(cue, slow ? 0.75 : 1); setOn(false); if (echo) { setSay(true); window.setTimeout(() => setSay(false), 3000); } };
  return <span className="iq-sayw"><button type="button" className={`iq-say ${on ? 'on' : ''}`} onClick={() => void go()} aria-label={`${label || 'اسمع'}: ${text}`} title="صوت أَثَر" data-testid="iq-say" data-src="athar">🔊 {label}</button>{say && <em className="iq-echo" role="status">🗣 قلها الآن</em>}</span>;
}
/** «مسرح الحلقة»: الحوار فقاعات بأسماء الشخصيّات، السطر المنطوق يضيء، انقر سطرًا لتسمعه وحده، «العب الدور» يكتم شخصية ويتوقّف عند دورها. */
function Stage({ body, kind, hidden, maxPlays }: { body: string; kind: string; hidden?: boolean; maxPlays?: number }) {
  const { cues, sprite, ready, dabt, setDabt } = useContext(VoiceCtx); const [cur, setCur] = useState<number | null>(null); const [playing, setPlaying] = useState(false); const [slow, setSlow] = useState(false); const [role, setRole] = useState(''); const [turn, setTurn] = useState<{ c: Cue; resume: () => void } | null>(null); const [plays, setPlays] = useState(0); const [dev, setDev] = useState(false);
  const lines = body.split('\n'); const lcs = lineCues(cues); const cast = rolesOf(cues); const left = maxPlays ? Math.max(0, maxPlays - plays) : null;
  const parse = (ln: string) => { const m = ln.match(/^([^:：(]{1,24}(?:\s*\([^)]*\))?)[:：]\s*(.*)$/); const sc = ln.match(/^\((.+)\)$/); return { speaker: m && kind === 'dialogue' ? m[1] : null, text: m && kind === 'dialogue' ? m[2] : ln, scene: !!sc }; };
  const stop = () => { sprite?.stop(); setPlaying(false); setCur(null); setTurn(null); };
  const playAll = () => { if (!sprite || !lcs.length) return; if (left !== null && left <= 0) return; setPlays((n) => n + 1); setPlaying(true); setTurn(null);
    void sprite.playSeq(lcs, { rate: slow ? 0.75 : 1, skipRole: role || null, onCue: (c) => setCur(c.i ?? null), onTurn: (c, _i, resume) => setTurn({ c, resume }), onEnd: () => { setPlaying(false); setCur(null); setTurn(null); } }); };
  const playLine = (i: number) => { const c = findCue(cues, 'line', i); if (!c || !sprite) return; setCur(i); setPlaying(true); void sprite.play(c, slow ? 0.75 : 1).then(() => { setPlaying(false); setCur(null); }); };
  return <div className={`iq-stage ${kind}`} data-testid="iq-stage" data-voice={cues ? 'athar' : ready ? 'pending' : 'loading'}>
    <div className="iq-sayrow iq-stagebar">
      {cues ? <span className="iq-stagein">
        <button type="button" className={`iq-say big ${playing ? 'on' : ''}`} onClick={playing ? stop : playAll} disabled={!playing && left !== null && left <= 0} data-testid="iq-stage-play">{playing ? '■ أوقف' : plays === 0 ? '▶ اسمع المشهد' : '↻ مرّة أخرى'}</button>
        <button type="button" className={`iq-say ${slow ? 'on' : ''}`} aria-pressed={slow} onClick={() => setSlow((x) => !x)} data-testid="iq-stage-slow">🐢 ببطء</button>
        {cast.length > 1 && <label className="iq-role">🎭 العب الدور <select value={role} onChange={(e) => { setRole(e.target.value); stop(); }} disabled={playing} data-testid="iq-role"><option value="">— أستمع فقط —</option>{cast.map((r) => <option key={r.r} value={r.r}>{r.r} ({r.n} {r.n === 1 ? 'سطر' : 'أسطر'})</option>)}</select></label>}
        {left !== null && <span className="iq-psoft" data-testid="iq-plays-left">{left === 0 ? 'انتهت مرّات الاستماع (مرّتان كمِعيار)' : `مرّات الاستماع المتبقّية: ${left}`}</span>}
        {lcs.some((c) => c.d) && <button type="button" className={`iq-say ${dabt ? 'on' : ''}`} aria-pressed={dabt} onClick={() => setDabt(!dabt)} title="اعرض النصّ بالضبط الكامل كما يُنطق" data-testid="iq-dabt">◌ّ أَظْهِرِ التَّشْكِيل</button>}
        <span className="iq-voicebadge" title="أصوات فرقة أَثَر — الراوي نفسه في مِعيار">🎙 صوت أَثَر</span>
      </span> : ready ? <span className="iq-stagein"><span className="iq-voicebadge dev" title="لا نستخدم صوت الجهاز — كلّ التسجيلات بأصوات فرقة أَثَر ومخارجها الواحدة">🎙 التسجيل الرسمي لهذه الحلقة قادم</span></span> : null}
    </div>
    {role && !playing && <p className="iq-note">اخترتَ دور <b>{role}</b>: عند سطره يتوقّف المشهد وتقول أنت الجملة، ثمّ تضغط «قلتُها». لا تسجيل ولا تقييم — صوتك يبقى معك.</p>}
    {hidden ? <p className="iq-note">نصّ استماع: اسمع أوّلًا وأجب، ثم يظهر النصّ بعد الإجابة.</p> : <div className="iq-lines">{lines.map((ln, i) => { if (!ln.trim()) return null; const pz = parse(ln); const c = lcs.find((x) => x.i === i); const g = c?.g || 'n'; const av = c?.a || ''; const isTurn = turn && turn.c.i === i; const mine = role && c?.r === role;
      const shown = dabt && dabtOf(c) ? dabtOf(c)! : null;
      if (pz.scene) return <p key={i} className={`iq-scene ${cur === i ? 'on' : ''}`} onClick={() => playLine(i)}>{shown || ln.replace(/^\(|\)$/g, '')}</p>;
      if (!pz.speaker) return <p key={i} className={`iq-para ${cur === i ? 'on' : ''} ${shown ? 'dabt' : ''}`} onClick={() => playLine(i)}>{shown || ln}</p>;
      return <div key={i} className={`iq-bub ${g} ${cur === i ? 'on' : ''} ${mine ? 'mine' : ''}`} data-testid="iq-bub">{av && <img className="iq-avatar" src={`/iqra/img/${av}.svg`} alt="" aria-hidden="true" />}<div className="iq-bubin"><b>{pz.speaker.replace(/\s*\(.*\)\s*$/, '')}</b><button type="button" className={`iq-linebtn ${shown ? 'dabt' : ''}`} onClick={() => playLine(i)} aria-label={`اسمع سطر ${pz.speaker}`} disabled={!c}>{shown || pz.text}</button>
        {isTurn && <div className="iq-turn" role="status" data-testid="iq-turn"><span>🎤 دورك يا {role}: قل الجملة بصوتك</span><div className="iq-rowb"><button type="button" className="iq-btn small" onClick={() => { const r = turn!.resume; setTurn(null); r(); }} data-testid="iq-turn-done">قلتُها ← التالي</button><button type="button" className="iq-btn small ghost" onClick={() => { const cc = findCue(cues, 'line', i); if (cc && sprite) void sprite.play(cc, 0.75); }}>أسمع سطري ببطء</button></div></div>}</div></div>; })}</div>}
  </div>;
}

/** مزوّد صوت لبطاقة واحدة خارج الحلقة (في «أراجع»): يحمّل شريط حلقتها. */
function CardVoice({ code, children }: { code?: string | null; children: React.ReactNode }) { const v = useVoice(code || null); return <VoiceCtx.Provider value={v}>{children}</VoiceCtx.Provider>; }

/** نصّ بالضبط الكامل إن كان «أظهر التشكيل» مفعّلًا ووُجد في الشريط، وإلّا النصّ كما هو. */
function Dabt({ text, k }: { text: string; k: CueKind }) { const { cues, dabt } = useContext(VoiceCtx); const d = dabt ? dabtOf(findCue(cues, k, text)) : null; return <>{d || text}</>; }
/** زرّ «أظهر التشكيل» مستقلّ (للبطاقات). */
function DabtToggle() { const { cues, dabt, setDabt } = useContext(VoiceCtx); if (!cues || !cues.cues.some((c) => c.d)) return null; return <button type="button" className={`iq-say ${dabt ? 'on' : ''}`} aria-pressed={dabt} onClick={() => setDabt(!dabt)} data-testid="iq-dabt">◌ّ أَظْهِرِ التَّشْكِيل</button>; }

/* ---------- «ساعاتي»: نبضة كلّ 30 ث ما دامت الصفحة ظاهرة وحدث تفاعل خلال 90 ث؛ الخادم يضيف ≤ 60 ث لكلّ نبضة ---------- */
function useTicker(activity: Activity | null, post: (b: Record<string, unknown>) => Promise<any>) {
  const last = useRef(Date.now());
  useEffect(() => {
    if (!activity) return; const bump = () => { last.current = Date.now(); }; const evs = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const; evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = window.setInterval(() => { if (document.visibilityState !== 'visible') return; if (Date.now() - last.current > 90_000) return; void post({ action: 'tick', activity, seconds: 30 }); }, 30_000);
    return () => { window.clearInterval(t); evs.forEach((e) => window.removeEventListener(e, bump)); };
  }, [activity, post]);
}

export default function IqraApp({ fontClass = '' }: { fontClass?: string }) {
  const [code, setCode] = useState(''); const [tok, setTok] = useState<string | null>(null); const [ready, setReady] = useState(false);
  const [home, setHome] = useState<Home | null>(null); const [err, setErr] = useState<string | null>(null); const [screen, setScreen] = useState<Screen>({ s: 'home' }); const [live, setLive] = useState('');
  useEffect(() => { (async () => { const c = new URLSearchParams(window.location.search).get('code') || ''; setCode(c.toUpperCase()); try { const { data } = await supabase().auth.getSession(); setTok(data.session?.access_token || null); } catch { setTok(null); } setReady(true); })(); }, []);
  const H = useCallback((): Record<string, string> => (tok ? { Authorization: `Bearer ${tok}` } : {}), [tok]);
  const q = useCallback((view: string, extra = '') => `/api/iqra?view=${view}${code ? `&code=${encodeURIComponent(code)}` : ''}${extra}`, [code]);
  const [offline, setOffline] = useState(false); const [pending, setPending] = useState(0);
  /* ق٢ د٣: الإرسال؛ عند انقطاع الشبكة تدخل أفعال الحلقة (answer · finish · tick · produce · library_answer) صندوق الصادر وتُعاد بالترتيب عند عودة الاتصال */
  const post = useCallback(async (body: Record<string, unknown>) => {
    const payload = { ...body, code: code || undefined };
    try { const r = await fetch('/api/iqra', { method: 'POST', headers: { 'Content-Type': 'application/json', ...H() }, body: JSON.stringify(payload) }); return await r.json().catch(() => ({ ok: false })); }
    catch (e) { if (!isNetworkError(e)) return { ok: false }; const queued = await enqueue(payload, H()); if (queued) { setOffline(true); setPending(await outboxCount()); void requestSync(); return { ok: true, queued: true, offline: true }; } return { ok: false, offline: true, error: 'offline' }; }
  }, [H, code]);
  const drain = useCallback(async () => { const { sent, left } = await flush(); setPending(left); if (sent) setLive(`أُرسل ما حفظته بلا اتصال (${sent})`); if (!left) setOffline(false); return sent; }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return; void outboxCount().then(setPending); setOffline(!navigator.onLine);
    const on = () => { setOffline(false); void drain(); }; const off = () => setOffline(true); const msg = (e: MessageEvent) => { if (e.data?.type === 'athar-sync') void drain(); };
    window.addEventListener('online', on); window.addEventListener('offline', off); navigator.serviceWorker?.addEventListener('message', msg);
    try { navigator.serviceWorker?.controller?.postMessage({ type: 'warm-pages', paths: ['/iqra'] }); } catch { /* بلا عامل خدمة */ }
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); navigator.serviceWorker?.removeEventListener('message', msg); };
  }, [drain]);
  const loadHome = useCallback(async () => { setErr(null); try { const r = await fetch(q('home'), { headers: H(), cache: 'no-store' }); const d = await r.json(); if (r.status === 401) { setHome({ gate: 'anon' }); return; } if (r.status === 404) { setErr('رمز النتيجة غير معروف'); return; } if (!d.ok) { setErr('تعذّر التحميل'); return; } setHome(d); } catch { setErr('تعذّر الاتصال'); } }, [q, H]);
  useEffect(() => { if (ready) void loadHome(); }, [ready, loadHome]);

  return <div className={`iq ${fontClass}`} dir="rtl" lang="ar" data-testid="iq-page">
    <header className="iq-top"><div className="iq-head"><a className="iq-brand" href="/" aria-label="أَثَر — الرئيسة">أَثَر<small>اقْرَأْ — تعلّم على مستواك</small></a>
      <nav className="iq-nav" aria-label="أقسام اقْرَأْ">{home?.gate === 'enrolled' && <>
        <button type="button" className={screen.s === 'home' ? 'on' : ''} onClick={() => setScreen({ s: 'home' })} data-testid="iq-nav-home">مستواي</button>
        <button type="button" className={screen.s === 'reviews' ? 'on' : ''} onClick={() => setScreen({ s: 'reviews' })} data-testid="iq-nav-reviews">أراجع{home.أراجع_مستحقّ ? <i>{home.أراجع_مستحقّ}</i> : null}</button>
        <button type="button" className={screen.s === 'notebook' ? 'on' : ''} onClick={() => setScreen({ s: 'notebook' })} data-testid="iq-nav-notebook">دفتري</button>
        {(home.مكتبة || 0) > 0 && <button type="button" className={screen.s === 'library' ? 'on' : ''} onClick={() => setScreen({ s: 'library' })} data-testid="iq-nav-library">مكتبتي</button>}</>}
        {code ? <a className="iq-lnk" href={`/miaar/result/${encodeURIComponent(code)}`}>بطاقة نتيجتي</a> : <a className="iq-lnk" href="/me">صفحتي</a>}<ReadSize /></nav></div><WayBar /></header>
    <p className="iq-live" aria-live="polite" role="status">{live}</p>
    {(offline || pending > 0) && <p className="iq-offline" data-testid="iq-offline" data-pending={pending}>{offline ? 'بلا اتصال — تعمل الحلقات المحمَّلة، وتُحفَظ إجاباتك ونبضات وقتك هنا حتى يعود الاتصال' : 'عاد الاتصال — نرسل ما حفظته'}{pending > 0 ? ` · في الصندوق ${pending}` : ''}{!offline && pending > 0 ? <button type="button" className="iq-mini" onClick={() => void drain()}>أرسل الآن</button> : null}</p>}
    {!ready || (!home && !err) ? <p className="iq-wait">نفتح مستواك…</p> : null}
    {err && <section className="iq-wrap"><div className="iq-card"><p className="iq-err" role="alert">{err}</p></div></section>}
    {home && home.gate !== 'enrolled' && <Gate home={home} code={code} setCode={(c) => { setCode(c); window.history.replaceState(null, '', `/iqra?code=${encodeURIComponent(c)}`); }} reload={loadHome} />}
    {home?.gate === 'enrolled' && screen.s === 'home' && <HomeView home={home} open={(id) => setScreen({ s: 'lesson', id })} post={post} setLive={setLive} q={q} H={H} />}
    {home?.gate === 'enrolled' && screen.s === 'lesson' && <LessonView id={screen.id} q={q} H={H} post={post} setLive={setLive} back={() => { setScreen({ s: 'home' }); void loadHome(); }} next={(id) => setScreen({ s: 'lesson', id })} />}
    {home?.gate === 'enrolled' && screen.s === 'reviews' && <ReviewsView q={q} H={H} post={post} setLive={setLive} done={() => void loadHome()} />}
    {home?.gate === 'enrolled' && screen.s === 'notebook' && <NotebookView q={q} H={H} />}
    {home?.gate === 'enrolled' && screen.s === 'library' && <LibraryView id={screen.id} q={q} H={H} post={post} setLive={setLive} open={(id) => setScreen({ s: 'library', id })} back={() => { setScreen({ s: 'library' }); void loadHome(); }} />}
    <footer className="iq-foot"><p>«اقْرَأْ — من أَثَر» تعلّمٌ لك وحدك: لا درجات رسمية هنا، ولا أثر على تقييمك أو شهادتك. تقدّمك ملكك ويُحذف فورًا متى طلبت.</p></footer>
    <style jsx global>{CSS}</style>
  </div>;
}

function Gate({ home, code, setCode, reload }: { home: Home; code: string; setCode: (c: string) => void; reload: () => void }) {
  const [v, setV] = useState(code);
  const anon = home.gate === 'anon';
  return <section className="iq-wrap"><div className="iq-gate" data-testid="iq-gate" data-gate={home.gate}>
    <p className="iq-kicker">اقْرَأْ — من أَثَر</p>
    <h1>{anon ? 'ادخل مستواك' : home.copy?.title}</h1>
    <p className="iq-lead">{anon ? 'اقْرَأْ يفتح بنتيجة «مِعيار» المعتمدة. أدخل رمز نتيجتك (ML-XXXX-XXXX) أو سجّل الدخول بحساب أَثَر.' : home.copy?.body}</p>
    {anon && <form className="iq-row" onSubmit={(e) => { e.preventDefault(); const c = v.trim().toUpperCase(); if (/^ML-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) { setCode(c); setTimeout(reload, 0); } }}>
      <label className="iq-sr" htmlFor="iq-code">رمز النتيجة</label><input id="iq-code" dir="ltr" value={v} onChange={(e) => setV(e.target.value)} placeholder="ML-XXXX-XXXX" inputMode="text" autoComplete="off" data-testid="iq-code" />
      <button type="submit" className="iq-btn" data-testid="iq-code-go">افتح</button><a className="iq-btn ghost" href="/login?next=/iqra">تسجيل الدخول</a></form>}
    {home.gate === 'none' && <a className="iq-btn" href={home.copy?.href || '/miaar'} data-testid="iq-gate-cta">{home.copy?.cta}</a>}
    <ul className="iq-levels" aria-label="المستويات السبعة">{['تمهيدي · Pre-A1', 'مكتشف · A1', 'مبتدئ · A2', 'متوسط · B1', 'مستقل · B2', 'متقدّم · C1', 'متقن · C2'].map((l) => <li key={l}>{l}</li>)}</ul>
  </div></section>;
}

/* ق٢ د٣: «المَنزِلة في جيبي» — تحميل حلقات المَنزِلة وصوتها للعمل بلا اتصال (سقف مَنزِلتين على الجهاز) */
function UnitDownload({ unit, lessons, q, H, setLive }: { unit: string; lessons: { id: string; code: string }[]; q: (v: string, e?: string) => string; H: () => Record<string, string>; setLive: (s: string) => void }) {
  const [units, setUnits] = useState<UnitMeta[] | null>(null); const [prog, setProg] = useState<[number, number] | null>(null); const [n, setN] = useState(0);
  useEffect(() => { let on = true; void listUnits().then((u) => { if (on) setUnits(u); }); return () => { on = false; }; }, [n]);
  if (units === null || typeof window === 'undefined' || !('caches' in window)) return null;
  const mine = units.find((x) => x.unit === unit); const full = !mine && units.length >= IQRA_UNIT_CAP; const state = prog ? 'downloading' : mine ? 'ready' : full ? 'cap' : 'none';
  async function dl() {
    setProg([0, 1]); const r = await downloadUnit(unit, lessons, H(), (id) => q('lesson', `&id=${id}`), (d, t) => setProg([d, t])); setProg(null); setN((x) => x + 1);
    setLive(r.ok ? `حُمّلت ${unit} (${fmtBytes(r.meta.bytes)}) — تعمل بلا اتصال` : r.error === 'cap' ? `على الجهاز مَنزِلتان — احذف واحدة أوّلًا` : r.error === 'unsupported' ? 'المتصفّح لا يدعم التخزين المحلّي' : 'تعذّر التحميل — حاول مع اتصال أفضل');
  }
  async function rm() { await removeUnit(unit); setN((x) => x + 1); setLive(`حُذفت ${unit} من الجهاز`); }
  return <span className="iq-dl" data-testid="iq-dl" data-unit={unit} data-state={state}>
    {state === 'downloading' && <small data-testid="iq-dl-state">يُحمَّل {prog![0]}/{prog![1]}…</small>}
    {state === 'ready' && <><small data-testid="iq-dl-state" title={mine!.at}>في جيبك · {fmtBytes(mine!.bytes)}</small><button type="button" className="iq-mini" onClick={() => void rm()} data-testid="iq-dl-remove">احذف</button></>}
    {state === 'none' && <button type="button" className="iq-mini" onClick={() => void dl()} data-testid="iq-dl-go" title="حلقات المَنزِلة وصوتها للعمل بلا اتصال">حمّل للجيب ⤓</button>}
    {state === 'cap' && <small data-testid="iq-dl-state" title="سقف الجهاز مَنزِلتان">الجيب ممتلئ</small>}
  </span>;
}
function HomeView({ home, open, post, setLive, q, H }: { home: Home; open: (id: string) => void; post: (b: Record<string, unknown>) => Promise<any>; setLive: (s: string) => void; q: (v: string, e?: string) => string; H: () => Record<string, string> }) {
  const r = home.المستوى!; const [dailyFb, setDailyFb] = useState<Fb | null>(null); const [dailyPick, setDailyPick] = useState(''); const h = home.ساعاتي; const [extMin, setExtMin] = useState(''); const [extNote, setExtNote] = useState(''); const [extMsg, setExtMsg] = useState('');
  useTicker(home.سؤال_اليوم && !dailyFb ? 'daily' : null, post);
  async function external(e: React.FormEvent) { e.preventDefault(); const m = Number(extMin); if (!Number.isFinite(m) || m < 5 || m > 480) { setExtMsg('من 5 إلى 480 دقيقة'); return; } const d = await post({ action: 'external', minutes: m, note: extNote }); setExtMsg(d.ok ? 'سُجّلت — تُعرض منفصلة ولا تُحتسب في العَتَبة.' : 'تعذّر الحفظ'); setExtMin(''); setExtNote(''); }
  async function daily(opt: string) { if (dailyFb || !home.سؤال_اليوم) return; setDailyPick(opt); const d = await post({ action: 'daily', item_id: home.سؤال_اليوم.id, answer: { option: opt } }); if (d.ok) { setDailyFb(d); setLive(d.correct ? 'أحسنت' : 'ليس بعد'); } }
  return <>
    <section className="iq-band"><div className="iq-bandin"><p className="iq-kicker" data-testid="iq-level">{r.label}</p><h1>مستوى {r.name_ar}</h1><p className="iq-lead">{r.line_ar} — {r.can_ar}</p>
      <div className="iq-stats"><div><b data-testid="iq-steps">{home.خطواتي?.done}</b><span>من {home.خطواتي?.total} حلقة</span></div><div><b data-testid="iq-streak">{home.أيامي}</b><span>أيام متّصلة</span></div><div><b>{home.أراجع_مستحقّ}</b><span>للمراجعة اليوم</span></div></div>
      {h && <div className="iq-hours" data-testid="iq-hours" data-state={h.threshold.state}><div className="iq-hours-top"><b>ساعاتي في مستوى {r.name_ar}: <span data-testid="iq-hours-n">{h.hours}</span> من {h.target} ساعة</b><small>{h.today_min > 0 ? `اليوم ${h.today_min} د · ` : ''}{h.per_week > 0 ? `وتيرتك ${h.per_week} س/أسبوع` : 'ابدأ اليوم — كلّ دقيقة نشطة تُحسب'}{h.weeks_left ? ` · بهذه الوتيرة تبلغ العَتَبة في ${h.weeks_left} ${h.weeks_left === 1 ? 'أسبوع' : 'أسابيع'}` : ''}</small></div>
        <div className="iq-hbar" role="progressbar" aria-valuenow={h.pct} aria-valuemin={0} aria-valuemax={100} aria-label="ساعات التعلّم"><i style={{ width: `${h.pct}%` }} /><em style={{ insetInlineStart: '70%' }} title="الاختبار المبكر" /></div>
        <small className="iq-hnote">{h.threshold.state === 'ready' ? 'بلغتَ الأرضية والإتقان — العَتَبة مفتوحة لك (انظر الأسفل).' : h.threshold.state === 'early' ? 'يحقّ لك اختبار مبكر: بلغتَ 70% من الساعات مع إتقان 90% — اطلب العَتَبة من الأسفل.' : `الاختبار المبكر عند ${h.threshold.early_rule}؛ وإلّا ${h.target} ساعة كاملة. المرجع: ساعات التعلّم الموجَّه في الإطار الأوروبي.`}{h.external_hours > 0 ? ` · خارج أَثَر: ${h.external_hours} س (لا تُحتسب)` : ''}</small></div>}
      {home.التالية && <button type="button" className="iq-btn gold" onClick={() => open(home.التالية!.id)} data-testid="iq-next">أكمل: {home.التالية.title_ar} ←</button>}</div></section>
    <section className="iq-wrap">
      {home.سؤال_اليوم && <div className="iq-card iq-daily" data-testid="iq-daily"><h2>سؤال اليوم</h2><p className="iq-q">{home.سؤال_اليوم.prompt_ar}</p>
        <div className="iq-opts">{home.سؤال_اليوم.options?.map((o) => <button key={o.id} type="button" className={`iq-opt ${dailyFb ? (o.id === dailyFb.correct_option ? 'right' : o.id === dailyPick ? 'wrong' : '') : ''}`} onClick={() => void daily(o.id)} disabled={!!dailyFb}>{o.text}</button>)}</div>
        {dailyFb && <p className="iq-fb">{dailyFb.correct ? 'أحسنت.' : 'ليس بعد.'} {dailyFb.explanation_ar}</p>}</div>}
      {home.فارغ ? <div className="iq-card"><p className="iq-empty" data-testid="iq-empty">حلقات هذا المستوى قيد الإعداد والاعتماد — تعود قريبًا.</p></div> : null}
      {home.منازل?.map((u) => <div key={u.code} className="iq-unit" data-testid="iq-unit"><h2><span>{u.code}</span>{u.title_ar}<UnitDownload unit={u.code} lessons={u.حلقات.map((l) => ({ id: l.id, code: l.code || '' }))} q={q} H={H} setLive={setLive} /></h2><p className="iq-focus">{u.focus_ar}</p>
        <ol className="iq-lessons">{u.حلقات.map((l, i) => <li key={l.id} className={`iq-les ${l.حالة}`}><button type="button" onClick={() => open(l.id)} data-testid="iq-lesson" data-state={l.حالة} data-id={l.id} data-skill={l.مهارة?.key || ''}><i>{i + 1}</i><span>{l.مهارة && <u className="iq-skill" data-testid="iq-skill">{l.مهارة.name_ar}</u>}<b>{l.title_ar}</b><small>{l.can_do_ar || l.goal_ar || ''} · ≈{Math.round((l.minutes_total || 120) / 60 * 10) / 10} س · مِران {l.مجاب}/{l.الكلّ}</small></span><em>{l.مكتملة ? 'اكتملت' : l.حالة === 'done' ? `تمّت · ${l.درجة ?? ''}٪` : l.حالة === 'started' ? 'بدأتها' : 'ابدأ'}</em></button></li>)}</ol></div>)}
      <div className="iq-card iq-ext" data-testid="iq-external"><h2>ساعات خارج أَثَر <small>كتاب · درس · حديث — تُسجَّل لك وتُعرض منفصلة، ولا تُحتسب في العَتَبة</small></h2>
        <form className="iq-row start" onSubmit={(e) => void external(e)}><input type="number" min={5} max={480} value={extMin} onChange={(e) => setExtMin(e.target.value)} placeholder="دقائق" aria-label="دقائق" data-testid="iq-ext-min" /><input value={extNote} onChange={(e) => setExtNote(e.target.value)} placeholder="ماذا فعلت؟ (اختياري)" aria-label="ملاحظة" maxLength={120} /><button type="submit" className="iq-btn ghost" data-testid="iq-ext-save">سجّل</button>{extMsg && <small className="iq-fb">{extMsg}</small>}</form></div>
      {home.عبرتُ && <Crossed c={home.عبرتُ} />}
      <Threshold home={home} q={q} H={H} post={post} setLive={setLive} />
    </section></>;
}

/* ---------- ق٢: «العَتَبة» — الباب إلى اختبار نهاية المستوى المعياري (مِعيار «عُبور»)؛ اقْرَأْ يفتح الباب ويلتقط النتيجة، ولا يحكم ---------- */
function Threshold({ home, q, H, post, setLive }: { home: Home; q: (v: string, e?: string) => string; H: () => Record<string, string>; post: (b: Record<string, unknown>) => Promise<any>; setLive: (s: string) => void }) {
  const [t, setT] = useState<Thr | null>(null); const [open, setOpen] = useState(false); const [n, setN] = useState(0);
  useEffect(() => { fetch(q('threshold'), { headers: H(), cache: 'no-store' }).then((r) => r.json()).then((d) => d.ok && setT(d.العَتَبة)).catch(() => null); }, [q, H, n]);
  const r = home.المستوى!; if (!t) return null; const req = t.request; const live = req && ['requested', 'deferred', 'invited', 'sat', 'passed'].includes(req.status);
  async function ask() { const d = await post({ action: 'threshold_request' }); if (d.ok) { setLive('أُرسل طلبك إلى طاقم أَثَر'); setOpen(false); setN((x) => x + 1); } else setLive(d.error === 'already_requested' ? 'لديك طلب حيّ' : d.error === 'not_ready' ? 'لم تبلغ الشرط بعد' : 'تعذّر الإرسال'); }
  async function cancel() { if (!req) return; const d = await post({ action: 'threshold_cancel', id: req.id }); if (d.ok) { setLive('سُحب طلبك'); setN((x) => x + 1); } }
  const ex = t.exam;
  return <div className="iq-card iq-thr" data-testid="iq-thr" data-state={t.state} data-status={req?.status || ''}>
    <h2>العَتَبة <small>{t.next_label ? `الباب إلى ${t.next_label}` : 'أعلى السُّلّم'}</small></h2>
    {t.copy.pre_a1 ? <p className="iq-note">{t.copy.pre_a1}</p> : !t.next_label ? <p className="iq-note">أنت في أعلى السُّلّم — لا عَتَبة بعد المتقن.</p> : <div className="iq-thrwrap">
      {!live && t.state === 'building' && <p className="iq-note">تُفتح عند 70% من الساعات مع إتقان 90% من الحلقات (اختبار مبكّر)، أو عند {t.target} ساعة كاملة. الآن: {t.hours} س · إتقان {t.mastery_pct}%.</p>}
      {!live && t.eligible && !open && (!req || ['cancelled', 'failed', 'promoted'].includes(req.status)) && <><p className="iq-note">{t.state === 'ready' ? 'بلغتَ الأرضية والإتقان.' : 'بلغتَ شرط الاختبار المبكّر.'} {req?.status === 'failed' ? `آخر محاولة: ${req.exit_total ?? '—'}% — الإعادة بعد ${ex?.retake_days} أيام من تاريخها.` : ''}</p><button type="button" className="iq-btn gold" onClick={() => setOpen(true)} data-testid="iq-thr-ask">أطلب العَتَبة</button></>}
      {open && ex && <div className="iq-thrbox" data-testid="iq-thr-box"><h3>{ex.official_ar}</h3><p>{t.copy.what}</p>
        <ul className="iq-thrfacts"><li>المدّة ≈ {ex.minutes} دقيقة</li><li>استماع {ex.counts.listening} · قراءة {ex.counts.reading} · استعمال اللغة {ex.counts.grammar_vocab} · كتابة {ex.counts.writing} · تحدّث {ex.counts.speaking}</li><li>{ex.weights_ar}</li><li>الاجتياز ≥ {ex.cut}% ولا مهارة دون {ex.skill_min}%</li></ul>
        <p>{t.copy.who}</p><div className="iq-rowb"><button type="button" className="iq-btn gold" onClick={() => void ask()} data-testid="iq-thr-confirm">أؤكّد طلبي</button><button type="button" className="iq-btn ghost" onClick={() => setOpen(false)}>ليس الآن</button></div></div>}
      {req && live && <div className="iq-thrstate" data-testid="iq-thr-state" data-status={req.status}><b>{req.status_ar}</b>
        {req.status === 'requested' && <p>طلبك بين يدي طاقم أَثَر. يصلك إشعار حين تُجهَّز دعوتك.</p>}
        {req.status === 'deferred' && <p>كلمة الطاقم: «{req.defer_note}». أكمل ما طُلب ثمّ اطلب من جديد.</p>}
        {req.status === 'invited' && <p>افتح الرابط من جهاز هادئ وأتمّ الاختبار في جلسة واحدة{req.expires_at ? ` قبل ${new Date(req.expires_at).toLocaleDateString('ar-SA-u-nu-latn', { day: 'numeric', month: 'long' })}` : ''}.{req.invite_url && <> <a className="iq-btn gold small" href={req.invite_url} data-testid="iq-thr-link">إلى الاختبار ←</a></>}</p>}
        {req.status === 'sat' && <p>أدّيتَ الاختبار — الكتابة والتحدّث يقرؤهما مصحّح. يصلك الحكم إشعارًا.</p>}
        {req.status === 'passed' && <p>اجتزتَ بـ {req.exit_total ?? '—'}%. انتقالك إلى {t.next_label} يُعتمد بتوقيع الطاقم خلال أيام — وتبقى حلقاتك مفتوحة.</p>}
        {['requested', 'deferred', 'invited'].includes(req.status) && <button type="button" className="iq-lnkbtn" onClick={() => void cancel()} data-testid="iq-thr-cancel">أسحب طلبي</button>}</div>}
      {req && req.status === 'deferred' && !live && null}
    </div>}
    <small className="iq-hnote dark">قرار التسكين الرسمي يبقى لمِعيار؛ اقْرَأْ يفتح الباب ولا يحكم. بعد هذا المستوى: {r.next || '—'}.</small>
  </div>;
}
/* ---------- ق٢: بطاقة «عبرتُ» بعد الانتقال ---------- */
function Crossed({ c }: { c: Crossed }) {
  return <div className="iq-card iq-crossed" data-testid="iq-crossed"><h2>عبرتَ {c.from} <small>مرحبًا بك في {c.to}</small></h2>
    <div className="iq-stats dark"><div><b>{c.hours}</b><span>ساعة مقيسة من {c.target}</span></div><div><b>{c.days}</b><span>يوم تعلّم</span></div>{c.exit_total !== null && <div><b>{c.exit_total}%</b><span>في اختبار نهاية المستوى</span></div>}</div>
    <p className="iq-note">{c.gate === 'early' ? 'عبرتَ من الباب المبكّر: 70% من الساعات بإتقان 90%.' : 'عبرتَ بالأرضية كاملة.'} مكتبة مستواك السابق ومراجعاته تبقى مفتوحة لك.</p></div>;
}

function LessonView({ id, q, H, post, setLive, back, next }: { id: string; q: (v: string, e?: string) => string; H: () => Record<string, string>; post: (b: Record<string, unknown>) => Promise<any>; setLive: (s: string) => void; back: () => void; next: (id: string) => void }) {
  const [l, setL] = useState<Lesson | null>(null); const [st, setSt] = useState(0); const [fb, setFb] = useState<Record<string, Fb>>({}); const [fin, setFin] = useState<{ score: number; passed: boolean; remaining: number; complete: boolean; closing_ar: string | null; next: { id: string; title_ar: string } | null } | null>(null); const [flip, setFlip] = useState<Record<string, boolean>>({}); const [tries, setTries] = useState<Record<string, number>>({}); const [reload, setReload] = useState(0); const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setL(null); setFb({}); setFin(null); fetch(q('lesson', `&id=${id}`), { headers: H(), cache: 'no-store' }).then((r) => r.json()).then((d) => d.ok ? setL(d.حلقة) : setLive('تعذّر فتح الحلقة')).catch(() => setLive('تعذّر الاتصال')); }, [id, q, H, setLive, reload]);
  useEffect(() => { setSt(0); }, [id]);
  const go = (n: number) => { setSt(n); topRef.current?.scrollIntoView({ block: 'start' }); };
  const voice = useVoice(l?.code || null); useEffect(() => { voice.sprite?.stop(); }, [st, voice.sprite]);
  const stations = useMemo(() => (l ? STATIONS.filter((s) => (s === 'القاعدة' ? !!l.content.grammar : s === 'كلماتي' ? l.بطاقات.length > 0 : s === 'أُنتج' ? !!l.content.produce : true)) : []), [l]);
  const cur = stations[st]; const act: Activity | null = !l ? null : cur === 'أُنتج' ? 'produce' : cur === 'أثر الحلقة' ? null : 'lesson';
  useTicker(act, post);
  if (!l) return <p className="iq-wait">نفتح الحلقة…</p>;
  const answered = Object.keys(fb).length; const total = l.مِران.length;
  async function answer(ex: Ex, a: Record<string, unknown>) { if (fb[ex.id]) return; const d = await post({ action: 'answer', lesson_id: l!.id, item_id: ex.id, answer: a }); if (d.ok && d.queued) { setLive('حُفظت بلا اتصال — تُصحَّح حين يعود الاتصال'); return; } if (d.ok) { setFb((p) => ({ ...p, [ex.id]: d })); setLive(d.correct ? 'أحسنت' : 'ليس بعد — انظر الشرح'); } else setLive(d.offline ? 'بلا اتصال — هذا الفعل يحتاج اتصالًا' : 'تعذّر الحفظ'); }
  async function finish() { const d = await post({ action: 'finish', lesson_id: l!.id }); if (d.ok && d.queued) { setLive('حُفظ ختام الزيارة بلا اتصال — تُحتسب حين يعود'); return; } if (d.ok) { setFin(d); setLive(d.passed ? 'أتممت الزيارة' : 'أعدها متى شئت'); } else setLive('أجب عن مِران هذه الزيارة أولًا'); }
  const nextVisit = () => { setFb({}); setFin(null); setReload((n) => n + 1); setSt(stations.indexOf('المِران')); };
  /* «حاول مرّة أخرى»: بعد قراءة الشرح يعيد المتعلّم المحاولة؛ الخادم يعدّ المحاولات والإجابة الأخيرة هي التي تُحسب — تعلّم لا امتحان */
  const retry = (ex: Ex) => { setFb((p) => { const n2 = { ...p }; delete n2[ex.id]; return n2; }); setTries((t) => ({ ...t, [ex.id]: (t[ex.id] || 0) + 1 })); };
  return <VoiceCtx.Provider value={voice}><section className="iq-wrap" ref={topRef}>
    <p className="iq-crumb"><button type="button" className="iq-lnkbtn" onClick={back} data-testid="iq-back">← مستواي</button> · {l.المنزلة.code} {l.المنزلة.title_ar}</p>
    <h1 className="iq-h1" data-testid="iq-lesson-title">{l.title_ar}</h1>
    <p className="iq-goal">{l.مهارة && <u className="iq-skill" data-testid="iq-lesson-skill">{l.مهارة.name_ar}</u>}{l.can_do_ar ? <>أستطيع أن… {l.can_do_ar.replace(/^أستطيع أن\s*/, '')}</> : l.goal_ar}{l.can_do_en && <small lang="en" dir="ltr"> · {l.can_do_en}</small>}{l.descriptor_codes.length > 0 && <small> · {l.descriptor_codes.join(' · ')}</small>}<small> · ≈{Math.round((l.minutes_total || 120) / 60 * 10) / 10} س على أيام</small></p>
    <ol className="iq-stations" aria-label="محطّات الحلقة">{stations.map((s, i) => <li key={s}><button type="button" className={i === st ? 'on' : i < st ? 'done' : ''} onClick={() => go(i)} aria-current={i === st ? 'step' : undefined} data-testid="iq-station">{s}</button></li>)}</ol>
    {cur === 'أسمع وأقرأ' && <div className="iq-card"><p className="iq-intro">{l.content.intro_ar}</p><div className="iq-sayrow"><Say text={l.content.intro_ar} label="اسمع المدخل" k="intro" /></div>
      {l.content.text && <div className={`iq-text ${l.content.text.kind}`} data-testid="iq-text"><Stage body={l.content.text.body} kind={l.content.text.kind} />{l.content.text.audio_path && <audio controls preload="none" src={l.content.text.audio_path} />}</div>}
      <div className="iq-soon">{l.قريبًا.map((s) => <button key={s} type="button" disabled title="يُفعَّل لاحقًا بقرار الإدارة" data-testid="iq-soon">{s}</button>)}</div>
      <button type="button" className="iq-btn" onClick={() => go(st + 1)} data-testid="iq-go">التالي ←</button></div>}
    {cur === 'كلماتي' && <div className="iq-card"><h2>كلمات الحلقة <small>انقر البطاقة لتقلبها · 🔊 لتسمعها ثمّ قلها</small></h2><div className="iq-sayrow"><DabtToggle /></div>
      <ul className="iq-cards" data-testid="iq-cards">{l.بطاقات.map((c) => <li key={c.id}><button type="button" className={`iq-flash ${flip[c.id] ? 'back' : ''}`} onClick={() => setFlip((p) => ({ ...p, [c.id]: !p[c.id] }))} aria-pressed={!!flip[c.id]} aria-label={flip[c.id] ? `${c.word_ar}: ${c.gloss_ar}` : c.word_ar}>
        {!flip[c.id] ? <span className="iq-w"><Dabt text={c.word_ar} k="card" />{c.pos && <small>{c.pos}</small>}</span> : <span className="iq-g">{c.gloss_ar}{c.example_ar && <em><Dabt text={c.example_ar} k="ex" /></em>}</span>}</button><span className="iq-sayrow tight"><Say text={c.word_ar} label="" k="card" ck={c.word_ar} echo />{flip[c.id] && c.example_ar && <Say text={c.example_ar} label="المثال" k="ex" ck={c.example_ar} />}</span></li>)}</ul>
      <div className="iq-rowb"><button type="button" className="iq-btn ghost" onClick={() => go(st - 1)}>→ السابق</button><button type="button" className="iq-btn" onClick={() => go(st + 1)} data-testid="iq-go">التالي ←</button></div></div>}
    {cur === 'القاعدة' && l.content.grammar && <div className="iq-card iq-rule" data-testid="iq-rule"><h2>{l.content.grammar.title_ar}</h2><p>{l.content.grammar.explanation_ar}</p>{l.content.grammar.examples.length > 0 && <ul>{l.content.grammar.examples.map((e, i) => <li key={i}>{e} <Say text={e} label="" k="gex" ck={e} /></li>)}</ul>}
      <div className="iq-rowb"><button type="button" className="iq-btn ghost" onClick={() => go(st - 1)}>→ السابق</button><button type="button" className="iq-btn" onClick={() => go(st + 1)} data-testid="iq-go">إلى المِران ←</button></div></div>}
    {cur === 'المِران' && <div className="iq-card"><h2>مِران <small data-testid="iq-visit">الزيارة {l.زيارة.رقم} · {answered} من {total} · أجبتَ {l.زيارة.مجاب} من {l.زيارة.الكلّ} في هذه الحلقة</small></h2>
      {l.زيارة.مكتملة && total === 0 && <p className="iq-empty">أجبتَ عن كلّ مِران هذه الحلقة — عد إليها من «أراجع» أو من المكتبة.</p>}
      {l.مِران.map((ex, i) => <Exercise key={`${ex.id}:${tries[ex.id] || 0}`} n={i + 1} ex={ex} fb={fb[ex.id]} onAnswer={(a) => void answer(ex, a)} onRetry={() => retry(ex)} />)}
      {total === 0 && <p className="iq-empty">لا مِران في هذه الحلقة بعد.</p>}
      <div className="iq-rowb"><button type="button" className="iq-btn ghost" onClick={() => go(st - 1)}>→ السابق</button><button type="button" className="iq-btn" disabled={answered < total} onClick={() => { void finish(); go(stations.indexOf('أثر الحلقة')); }} data-testid="iq-finish">أتممتُ مِران اليوم</button>{l.content.produce && <button type="button" className="iq-btn ghost" onClick={() => go(st + 1)}>إلى «أُنتج» ←</button>}</div></div>}
    {cur === 'أُنتج' && l.content.produce && <Produce l={l} q={q} H={H} post={post} setLive={setLive} back={() => go(st - 1)} next={() => go(st + 1)} />}
    {cur === 'أثر الحلقة' && <div className="iq-card iq-close" data-testid="iq-closing">{!fin ? <p className="iq-wait">نحسب…</p> : <>
      <p className="iq-kicker">{fin.passed ? (fin.complete ? 'اكتملت الحلقة' : 'تمّت زيارة اليوم') : 'قريبًا من التمام'}</p><h2>{fin.score}٪</h2>
      {fin.passed ? <><p className="iq-closing">{fin.closing_ar || 'أحسنت. كلمات هذه الحلقة ستعود إليك غدًا في «أراجع».'}</p>
        {!fin.complete && <p className="iq-note" data-testid="iq-remaining">بقي {fin.remaining} مِرانًا في هذه الحلقة — عد غدًا لزيارة ثانية، أو <button type="button" className="iq-lnkbtn" onClick={nextVisit} data-testid="iq-next-visit">تابع الآن</button>.</p>}
        {(l.content.speaking || l.content.writing) && <div className="iq-prod">{l.content.speaking && <p><b>تحدّث:</b> {l.content.speaking.prompt_ar} <small>{l.content.speaking.guide_ar}</small></p>}{l.content.writing && <p><b>اكتب:</b> {l.content.writing.topic_ar} <small>{l.content.writing.instructions_ar}</small></p>}<small>تمرينان لك وحدك — لا يُرسلان ولا يُصحَّحان آليًّا.</small></div>}
        <div className="iq-rowb">{fin.next ? <button type="button" className="iq-btn gold" onClick={() => next(fin.next!.id)} data-testid="iq-next-lesson">الحلقة التالية: {fin.next.title_ar} ←</button> : <button type="button" className="iq-btn gold" onClick={back}>إلى مستواي</button>}</div></>
        : <><p className="iq-closing">تحتاج ٧٠٪ ليُفتح أثر الحلقة. راجع الشرح تحت كلّ تمرين ثم أعدها — الإعادة مفتوحة دائمًا.</p><div className="iq-rowb"><button type="button" className="iq-btn" onClick={() => { setFb({}); setFin(null); go(stations.indexOf('المِران')); }} data-testid="iq-again">أعيدها</button><button type="button" className="iq-btn ghost" onClick={back}>إلى مستواي</button></div></>}</>}</div>}
  </section></VoiceCtx.Provider>;
}

function Exercise({ n, ex, fb, onAnswer, onRetry }: { n: number; ex: Ex; fb?: Fb; onAnswer: (a: Record<string, unknown>) => void; onRetry?: () => void }) {
  const [pick, setPick] = useState(''); const [left, setLeft] = useState<string | null>(null); const [pairs, setPairs] = useState<Record<string, string>>({}); const [seq, setSeq] = useState<number[]>([]); const [gaps, setGaps] = useState<string[]>([]); const [txt, setTxt] = useState('');
  const words = ex.kind === 'picture_sequence' ? (ex.frames || []).map((f) => f.text) : ex.words || []; const remaining = words.map((w, i) => i).filter((i) => !seq.includes(i));
  const slots = ex.kind === 'cloze_bank' ? (ex.text || '').split('___') : []; const nGaps = Math.max(0, slots.length - 1);
  return <fieldset className={`iq-ex ${fb ? (fb.correct ? 'ok' : 'bad') : ''}`} data-testid="iq-ex" data-kind={ex.kind}><legend><i>{n}</i> {ex.prompt_ar}</legend>
    {(ex.kind === 'mcq' || ex.kind === 'true_false_notgiven') && <>{ex.passage_ar && <p className="iq-passage" data-testid="iq-passage">{ex.passage_ar}</p>}<div className={`iq-opts ${ex.kind === 'true_false_notgiven' ? 'tfng' : ''}`}>{ex.options?.map((o) => <button key={o.id} type="button" className={`iq-opt ${fb ? (o.id === fb.correct_option ? 'right' : o.id === pick ? 'wrong' : '') : ''}`} disabled={!!fb} onClick={() => { setPick(o.id); onAnswer({ option: o.id }); }} data-testid="iq-opt">{o.text}</button>)}</div></>}
    {ex.kind === 'picture_choice' && ex.prompt_ar.startsWith('اسمع') && <div className="iq-sayrow"><Say text={(ex.prompt_ar.match(/«([^»]+)»/) || [])[1] || ex.prompt_ar} label="اسمع" k="pic" ck={ex.prompt_ar} /><Say text={(ex.prompt_ar.match(/«([^»]+)»/) || [])[1] || ex.prompt_ar} label="ببطء" slow k="pic" ck={ex.prompt_ar} /></div>}
    {ex.kind === 'picture_choice' && <div className="iq-pics">{ex.options?.map((o) => <button key={o.id} type="button" className={`iq-pic ${fb ? (o.id === fb.correct_option ? 'right' : o.id === pick ? 'wrong' : '') : ''}`} disabled={!!fb} onClick={() => { setPick(o.id); onAnswer({ option: o.id }); }} data-testid="iq-opt" aria-label={o.text || 'صورة'}><img src={o.image} alt={o.text || ''} loading="lazy" />{o.text && <span>{o.text}</span>}</button>)}</div>}
    {ex.kind === 'cloze_bank' && <div className="iq-cloze"><p className="iq-clozetext" data-testid="iq-cloze">{slots.map((part, i) => <span key={i}>{part}{i < nGaps && <button type="button" className={`iq-gap ${gaps[i] ? 'filled' : ''}`} disabled={!!fb} onClick={() => setGaps((g) => { const n2 = [...g]; n2[i] = ''; return n2; })} aria-label={`الفراغ ${i + 1}`} data-testid="iq-gap">{gaps[i] || '…'}</button>}</span>)}</p>
      <div className="iq-pool">{(ex.bank || []).map((w) => <button key={w} type="button" className="iq-chip" disabled={!!fb || gaps.includes(w) || gaps.filter(Boolean).length >= nGaps} onClick={() => setGaps((g) => { const n2 = [...g]; const k = Array.from({ length: nGaps }, (_, j) => j).find((j) => !n2[j]); if (k !== undefined) n2[k] = w; return n2; })} data-testid="iq-bank">{w}</button>)}</div>
      {!fb && <div className="iq-rowb"><button type="button" className="iq-btn small" disabled={gaps.filter(Boolean).length !== nGaps} onClick={() => onAnswer({ gaps: Array.from({ length: nGaps }, (_, j) => gaps[j] || '') })} data-testid="iq-check">تحقّق</button><button type="button" className="iq-btn small ghost" onClick={() => setGaps([])}>مسح</button></div>}
      {fb && !fb.correct && fb.correct_gaps && <p className="iq-key">الصواب: {fb.correct_gaps.join(' · ')}</p>}</div>}
    {ex.kind === 'word_tap' && <div className="iq-tap"><p className="iq-tapline">{(ex.words || []).map((w, i) => <button key={i} type="button" className={`iq-chip ${pick === w ? 'in' : ''} ${fb && fb.correct_word === w ? 'paired' : ''}`} disabled={!!fb} onClick={() => { setPick(w); onAnswer({ word: w }); }} data-testid="iq-tapword">{w}</button>)}</p>
      {fb && !fb.correct && fb.correct_word && <p className="iq-key">الصواب: {fb.correct_word}</p>}</div>}
    {ex.kind === 'short_dictation' && <div className="iq-dict"><div className="iq-sayrow"><Say text={ex.say || ''} label="اسمع" k="dict" ck={ex.say || ''} /><Say text={ex.say || ''} label="ببطء" slow k="dict" ck={ex.say || ''} /></div>
      <form className="iq-row start" onSubmit={(e) => { e.preventDefault(); if (txt.trim()) onAnswer({ text: txt }); }}><input className="iq-dictin" value={txt} onChange={(e) => setTxt(e.target.value)} disabled={!!fb} placeholder="اكتب ما سمعت" aria-label="ما سمعت" autoComplete="off" lang="ar" data-testid="iq-dictin" />{!fb && <button type="submit" className="iq-btn small" disabled={!txt.trim()} data-testid="iq-check">تحقّق</button>}</form>
      {fb && !fb.correct && fb.correct_text && <p className="iq-key">الصواب: {fb.correct_text}</p>}</div>}
    {ex.kind === 'picture_sequence' && <div className="iq-order"><div className="iq-line" aria-label="الترتيب" data-testid="iq-line">{seq.length === 0 ? <span className="iq-ph">انقر الصور بالترتيب الصحيح</span> : seq.map((i) => <button key={i} type="button" className="iq-frame in" disabled={!!fb} onClick={() => setSeq((s) => s.filter((x) => x !== i))} aria-label={`أزل ${words[i]}`}><img src={ex.frames![i].image} alt={words[i]} /><span>{words[i]}</span></button>)}</div>
      <div className="iq-pool">{remaining.map((i) => <button key={i} type="button" className="iq-frame" disabled={!!fb} onClick={() => setSeq((s) => [...s, i])} data-testid="iq-word" aria-label={words[i]}><img src={ex.frames![i].image} alt={words[i]} loading="lazy" /><span>{words[i]}</span></button>)}</div>
      {!fb && <div className="iq-rowb"><button type="button" className="iq-btn small" disabled={seq.length !== words.length} onClick={() => onAnswer({ order: seq.map((i) => words[i]) })} data-testid="iq-check">تحقّق</button><button type="button" className="iq-btn small ghost" onClick={() => setSeq([])}>مسح</button></div>}
      {fb && !fb.correct && fb.correct_order && <p className="iq-key">الصواب: {fb.correct_order.join(' ← ')}</p>}</div>}
    {ex.kind === 'matching' && <div className="iq-match"><div className="iq-col" aria-label="الطرف الأوّل">{ex.left?.map((L) => <button key={L} type="button" className={`iq-chip ${left === L ? 'sel' : ''} ${pairs[L] ? 'paired' : ''}`} disabled={!!fb} onClick={() => setLeft(L)} aria-pressed={left === L} data-testid="iq-ml">{L}{pairs[L] && <small>← {pairs[L]}</small>}</button>)}</div>
      <div className="iq-col" aria-label="الطرف الثاني">{ex.right?.map((R) => <button key={R} type="button" className={`iq-chip ${Object.values(pairs).includes(R) ? 'paired' : ''}`} disabled={!!fb || !left} onClick={() => { if (!left) return; setPairs((p) => { const n2 = { ...p }; for (const k of Object.keys(n2)) if (n2[k] === R) delete n2[k]; n2[left] = R; return n2; }); setLeft(null); }} data-testid="iq-mr">{R}</button>)}</div>
      {!fb && <div className="iq-rowb"><button type="button" className="iq-btn small" disabled={Object.keys(pairs).length !== (ex.left || []).length} onClick={() => onAnswer({ pairs: Object.entries(pairs) })} data-testid="iq-check">تحقّق</button><button type="button" className="iq-btn small ghost" onClick={() => { setPairs({}); setLeft(null); }}>مسح</button></div>}
      {fb && !fb.correct && fb.correct_pairs && <p className="iq-key">الصواب: {fb.correct_pairs.map(([a, b]) => `${a} ← ${b}`).join(' · ')}</p>}</div>}
    {ex.kind === 'ordering' && <div className="iq-order"><div className="iq-line" aria-label="الجملة" data-testid="iq-line">{seq.length === 0 ? <span className="iq-ph">انقر الكلمات بالترتيب</span> : seq.map((i) => <button key={i} type="button" className="iq-chip in" disabled={!!fb} onClick={() => setSeq((s) => s.filter((x) => x !== i))} aria-label={`أزل ${words[i]}`}>{words[i]}</button>)}</div>
      <div className="iq-pool">{remaining.map((i) => <button key={i} type="button" className="iq-chip" disabled={!!fb} onClick={() => setSeq((s) => [...s, i])} data-testid="iq-word">{words[i]}</button>)}</div>
      {!fb && <div className="iq-rowb"><button type="button" className="iq-btn small" disabled={seq.length !== words.length} onClick={() => onAnswer({ order: seq.map((i) => words[i]) })} data-testid="iq-check">تحقّق</button><button type="button" className="iq-btn small ghost" onClick={() => setSeq([])}>مسح</button></div>}
      {fb && !fb.correct && fb.correct_order && <p className="iq-key">الصواب: {fb.correct_order.join(' ')}</p>}</div>}
    {fb && <p className="iq-fb" data-testid="iq-fb" data-correct={fb.correct ? '1' : '0'}>{fb.correct ? 'أحسنت.' : 'ليس بعد.'} {fb.explanation_ar}</p>}
    {fb && !fb.correct && onRetry && <button type="button" className="iq-btn small ghost" onClick={onRetry} data-testid="iq-retry">حاول مرّة أخرى</button>}
  </fieldset>;
}

/* ---------- محطّة «أُنتج»: كتابة أو تحدّث مسجَّل على الجهاز (لا يُرفع) + قائمة تدقيق ذاتي + نموذج إجابة بعد المحاولة ---------- */
/* مدّة «أتحدّث» = مواصفة اختبار الخروج لكلّ مستوى (exit.ts) — تُرفع إلى الإطار الأوروبي ولا تُخفَّض */
const SPEAK_SEC: Record<string, string> = { A1: '60–90', A2: '90–120', B1: '120–180', B2: '180–240', C1: '240–300' };
function Produce({ l, q, H, post, setLive, back, next }: { l: Lesson; q: (v: string, e?: string) => string; H: () => Record<string, string>; post: (b: Record<string, unknown>) => Promise<any>; setLive: (s: string) => void; back: () => void; next: () => void }) {
  const p = l.content.produce!; const [text, setText] = useState(''); const [checked, setChecked] = useState<boolean[]>(l.أُنتج?.checked || p.checklist.map(() => false)); const [model, setModel] = useState<string | null>(null); const [saved, setSaved] = useState(!!l.أُنتج); const [rec, setRec] = useState<'idle' | 'on' | 'done'>('idle'); const [url, setUrl] = useState<string | null>(null); const mr = useRef<MediaRecorder | null>(null); const chunks = useRef<Blob[]>([]);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0; const canRec = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  async function startRec() { try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); const m = new MediaRecorder(s); chunks.current = []; m.ondataavailable = (e) => chunks.current.push(e.data); m.onstop = () => { s.getTracks().forEach((t) => t.stop()); setUrl(URL.createObjectURL(new Blob(chunks.current, { type: m.mimeType || 'audio/webm' }))); setRec('done'); }; m.start(); mr.current = m; setRec('on'); } catch { setLive('تعذّر فتح الميكروفون'); } }
  async function save() { const d = await post({ action: 'produce', lesson_id: l.id, text: p.kind === 'write' ? text : '', checked }); if (d.ok) { setSaved(true); setModel(d.model_ar || ''); setLive('حُفظت لك وحدك'); } else setLive(d.error === 'text_required' ? 'اكتب شيئًا أولًا' : 'تعذّر الحفظ'); }
  return <div className="iq-card iq-produce" data-testid="iq-produce" data-kind={p.kind}><h2>{p.kind === 'write' ? 'أكتب' : 'أتحدّث'} <small>{p.kind === 'write' ? 'نصّك يُحفظ لك وحدك ولا يُصحَّح آليًّا' : 'صوتك يبقى على جهازك ولا يُرفع إلى أيّ خادم'}</small></h2>
    <p className="iq-intro">{p.prompt_ar}</p>
    {p.kind === 'write' ? <textarea className="iq-ta read" value={text} onChange={(e) => setText(e.target.value)} rows={6} lang="ar" placeholder="اكتب هنا…" aria-label="نصّي" data-testid="iq-ta" /> : <div className="iq-rec">{canRec ? <>{rec !== 'on' ? <button type="button" className="iq-btn" onClick={() => void startRec()} data-testid="iq-rec">🎙️ {rec === 'done' ? 'سجّل من جديد' : 'ابدأ التسجيل'}</button> : <button type="button" className="iq-btn again" onClick={() => mr.current?.stop()}>■ أوقف</button>}{url && <audio controls src={url} />}</> : <p className="iq-note">المتصفّح لا يدعم التسجيل — تحدّث بصوت مسموع ثم قيّم نفسك بالقائمة.</p>}</div>}
    <p className="iq-note">{p.kind === 'write' ? `${words} كلمة${p.min_words ? ` · المطلوب ≥ ${p.min_words}` : ''}` : `تحدّث ${SPEAK_SEC[(l.المنزلة?.code || '').split('-')[0]] || '60–90'} ثانية بلا توقّف، ثمّ استمع لنفسك.`}</p>
    <fieldset className="iq-check"><legend>قائمة تدقيقي</legend>{p.checklist.map((c, i) => <label key={i}><input type="checkbox" checked={!!checked[i]} onChange={(e) => setChecked((a) => { const n2 = [...a]; n2[i] = e.target.checked; return n2; })} data-testid="iq-chk" /> {c}</label>)}</fieldset>
    <div className="iq-rowb"><button type="button" className="iq-btn ghost" onClick={back}>→ السابق</button><button type="button" className="iq-btn" onClick={() => void save()} disabled={p.kind === 'write' && (words < (p.min_words || 1))} data-testid="iq-produce-save">{saved ? 'احفظ من جديد' : 'احفظ وأرِني النموذج'}</button><button type="button" className="iq-btn gold" onClick={next}>إلى أثر الحلقة ←</button></div>
    {model !== null && model && <div className="iq-model" data-testid="iq-model"><h3>نموذج إجابة <small>قارن لا تنسخ</small></h3><p className="read">{model}</p></div>}
    {p.kind === 'write' && <ProduceReplies l={l} saved={saved} words={words} q={q} H={H} post={post} setLive={setLive} />}
  </div>;
}
/* ---------- ق٢: طابور «أُنتج» — إرسال النصّ المحفوظ لمراجعة بشرية (نصّان في الأسبوع) وعرض الردود بالسلّم التحليلي ---------- */
function ProduceReplies({ l, saved, words, q, H, post, setLive }: { l: Lesson; saved: boolean; words: number; q: (v: string, e?: string) => string; H: () => Record<string, string>; post: (b: Record<string, unknown>) => Promise<any>; setLive: (s: string) => void }) {
  const [d, setD] = useState<{ ردود: PReply[]; left_this_week: number; limit: number; copy: string } | null>(null); const [n, setN] = useState(0);
  useEffect(() => { fetch(q('produce', `&id=${l.id}`), { headers: H(), cache: 'no-store' }).then((r) => r.json()).then((j) => j.ok && setD(j)).catch(() => null); }, [q, H, l.id, n, saved]);
  if (!d) return null; const queued = d.ردود.find((r) => r.status === 'queued'); const reviewed = d.ردود.filter((r) => r.status === 'reviewed');
  async function send() { const j = await post({ action: 'produce_send', lesson_id: l.id }); if (j.ok) { setLive(`أُرسل — الردّ ${j.eta_ar}`); setN((x) => x + 1); } else setLive(j.error === 'too_short' ? `النصّ قصير: المطلوب ${j.min} كلمة على الأقل` : j.error === 'weekly_limit' ? `بلغتَ حدّ هذا الأسبوع (${j.limit})` : j.error === 'save_first' ? 'احفظ نصّك أوّلًا' : j.error === 'already_queued' ? 'نصّك في الطابور' : 'تعذّر الإرسال'); }
  async function withdraw() { if (!queued) return; const j = await post({ action: 'produce_withdraw', id: queued.id }); if (j.ok) { setLive('سُحب'); setN((x) => x + 1); } }
  return <div className="iq-preplies" data-testid="iq-prod">
    {queued ? <p className="iq-note" data-testid="iq-prod-queued">نصّك ({queued.words} كلمة) في طابور المراجعة البشرية منذ {new Date(queued.created_at).toLocaleDateString('ar-SA-u-nu-latn', { day: 'numeric', month: 'short' })}. <button type="button" className="iq-lnkbtn" onClick={() => void withdraw()} data-testid="iq-prod-withdraw">أسحب النصّ</button></p>
      : <div className="iq-rowb"><button type="button" className="iq-btn ghost" onClick={() => void send()} disabled={!saved || words < 20 || d.left_this_week <= 0} title={d.copy} data-testid="iq-prod-send">أرسل لمراجعة بشرية</button><small className="iq-note">{d.copy} بقي لك هذا الأسبوع: {d.left_this_week} من {d.limit}.</small></div>}
    {reviewed.map((r) => <div key={r.id} className="iq-reply" data-testid="iq-prod-reply"><h3>قرأ مصحّح أَثَر نصّك <small>{r.score} من 4 · {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString('ar-SA-u-nu-latn', { day: 'numeric', month: 'short' }) : ''}</small></h3>
      {r.rubric && <ul className="iq-rubric">{Object.values(r.rubric).map((x) => <li key={x.name_ar}><b>{x.score}</b><span>{x.name_ar}</span><small>{x.band_ar}</small></li>)}</ul>}
      <p className="iq-fb">{r.comment}</p>{r.rewritten && <p className="read iq-rew"><small>جملة أعادها لك:</small> {r.rewritten}</p>}
      <details><summary>نصّي كما أرسلته</summary><p className="read">{r.text}</p></details></div>)}
  </div>;
}

/* ---------- مكتبة المستوى: نصوص قراءة/استماع موسَّعة (25–30 د) بأسئلة؛ الزمن يُحسب نشاط library ---------- */
function LibraryView({ id, q, H, post, setLive, open, back }: { id?: string; q: (v: string, e?: string) => string; H: () => Record<string, string>; post: (b: Record<string, unknown>) => Promise<any>; setLive: (s: string) => void; open: (id: string) => void; back: () => void }) {
  const [list, setList] = useState<{ id: string; code: string; kind: string; title_ar: string; minutes: number; درجة: number | null; تمّ: boolean }[] | null>(null); const [t, setT] = useState<{ id: string; code?: string; kind: string; title_ar: string; body_ar: string; minutes: number; أسئلة: { i: number; q: string; options: { id: string; text: string }[] }[] } | null>(null); const [picks, setPicks] = useState<Record<number, string>>({}); const [res, setRes] = useState<{ score: number; results: { i: number; correct: boolean; correct_option: string; explanation_ar: string | null }[] } | null>(null);
  useEffect(() => { if (id) { setT(null); setPicks({}); setRes(null); fetch(q('library', `&id=${id}`), { headers: H(), cache: 'no-store' }).then((r) => r.json()).then((d) => d.ok ? setT(d.نصّ) : setLive('تعذّر فتح النصّ')); } else fetch(q('library'), { headers: H(), cache: 'no-store' }).then((r) => r.json()).then((d) => setList(d.ok ? d.نصوص : [])).catch(() => setList([])); }, [id, q, H, setLive]);
  useTicker(id && !res ? 'library' : null, post); const voice = useVoice(t?.code || null);
  if (id) { if (!t) return <p className="iq-wait">نفتح النصّ…</p>;
    const all = t.أسئلة.length > 0 && t.أسئلة.every((x) => picks[x.i] !== undefined);
    return <VoiceCtx.Provider value={voice}><section className="iq-wrap"><p className="iq-crumb"><button type="button" className="iq-lnkbtn" onClick={back}>← مكتبتي</button> · {t.kind === 'listen' ? 'استماع' : 'قراءة'} · ≈{t.minutes} د</p><h1 className="iq-h1" data-testid="iq-lib-title">{t.title_ar}</h1>
      <div className="iq-card"><div className={`iq-text ${t.kind === 'listen' ? 'listen' : ''}`}><Stage body={t.body_ar} kind="dialogue" hidden={t.kind === 'listen' && !res} maxPlays={t.kind === 'listen' ? 2 : undefined} /></div></div>
      <div className="iq-card"><h2>أسئلة الفهم</h2>{t.أسئلة.map((x, n) => { const r = res?.results.find((y) => y.i === x.i); return <fieldset key={x.i} className={`iq-ex ${r ? (r.correct ? 'ok' : 'bad') : ''}`} data-testid="iq-lib-q"><legend><i>{n + 1}</i> {x.q}</legend><div className="iq-opts">{x.options.map((o) => <button key={o.id} type="button" className={`iq-opt ${r ? (o.id === r.correct_option ? 'right' : picks[x.i] === o.id ? 'wrong' : '') : picks[x.i] === o.id ? 'sel' : ''}`} disabled={!!res} onClick={() => setPicks((p) => ({ ...p, [x.i]: o.id }))} data-testid="iq-lib-opt">{o.text}</button>)}</div>{r && <p className="iq-fb">{r.correct ? 'أحسنت.' : 'ليس بعد.'} {r.explanation_ar}</p>}</fieldset>; })}
        {!res ? <button type="button" className="iq-btn" disabled={!all} onClick={async () => { const d = await post({ action: 'library', id: t.id, picks: t.أسئلة.map((x) => Number(picks[x.i])) }); if (d.ok) { setRes(d); setLive(`${d.score}٪`); } }} data-testid="iq-lib-check">تحقّق</button> : <p className="iq-closing" data-testid="iq-lib-score">{res.score}٪ — {res.score >= 70 ? 'فهمتَ النصّ.' : 'اقرأه مرّة أخرى ببطء؛ الفهم يأتي بالتكرار.'}</p>}</div></section></VoiceCtx.Provider>; }
  if (!list) return <p className="iq-wait">نفتح المكتبة…</p>;
  return <section className="iq-wrap"><div className="iq-card"><h1 className="iq-h1">مكتبتي <small>نصوص قراءة واستماع أطول من الحلقة — 25 إلى 30 دقيقة لكلّ نصّ</small></h1>
    {list.length === 0 ? <p className="iq-empty">لا نصوص معتمدة بعد في مستواك.</p> : <ol className="iq-lessons">{list.map((x, i) => <li key={x.id} className={`iq-les ${x.تمّ ? 'done' : 'new'}`}><button type="button" onClick={() => open(x.id)} data-testid="iq-lib-item"><i>{i + 1}</i><span><u className="iq-skill">{x.kind === 'listen' ? 'أسمع وأفهم' : 'أقرأ وأفهم'}</u><b>{x.title_ar}</b><small>{x.code} · ≈{x.minutes} د</small></span><em>{x.تمّ ? `تمّ · ${x.درجة ?? ''}٪` : 'افتح'}</em></button></li>)}</ol>}</div></section>;
}

function ReviewsView({ q, H, post, setLive, done }: { q: (v: string) => string; H: () => Record<string, string>; post: (b: Record<string, unknown>) => Promise<any>; setLive: (s: string) => void; done: () => void }) {
  const [rows, setRows] = useState<Review[] | null>(null); const [i, setI] = useState(0); const [flip, setFlip] = useState(false); const [fb, setFb] = useState<Fb | null>(null);
  const load = useCallback(() => { fetch(q('reviews'), { headers: H(), cache: 'no-store' }).then((r) => r.json()).then((d) => { setRows(d.ok ? d.بطاقات : []); setI(0); setFlip(false); setFb(null); }).catch(() => setRows([])); }, [q, H]);
  useEffect(() => { load(); }, [load]);
  useTicker(rows && rows[i] ? 'review' : null, post);
  if (!rows) return <p className="iq-wait">نجمع بطاقاتك…</p>;
  const r = rows[i];
  if (!r) return <section className="iq-wrap"><div className="iq-card"><h1 className="iq-h1">أراجع</h1><p className="iq-empty" data-testid="iq-rev-empty">{rows.length ? 'انتهت مراجعة اليوم — أحسنت.' : 'لا بطاقات مستحقّة اليوم — عد غدًا أو أكمل حلقة جديدة.'}</p></div></section>;
  async function rate(result: 'again' | 'good' | 'easy') { const d = await post({ action: 'review', review_id: r.review_id, result }); if (d.ok) { setLive(`تعود بعد ${d.next_in_days} ${d.next_in_days === 1 ? 'يوم' : 'أيام'}`); setI(i + 1); setFlip(false); setFb(null); if (i + 1 >= rows!.length) done(); } }
  return <section className="iq-wrap"><div className="iq-card"><h1 className="iq-h1">أراجع <small>{i + 1} من {rows.length}</small></h1>
    {r.kind === 'card' && r.card && <div className="iq-revcard" data-testid="iq-rev-card"><button type="button" className={`iq-flash big ${flip ? 'back' : ''}`} onClick={() => setFlip(!flip)} aria-pressed={flip}>{!flip ? <span className="iq-w">{r.card.word_ar}</span> : <span className="iq-g">{r.card.gloss_ar}{r.card.example_ar && <em>{r.card.example_ar}</em>}</span>}</button>
      <CardVoice code={r.card.lesson_code}><span className="iq-sayrow tight"><Say text={r.card.word_ar} label="اسمع" k="card" ck={r.card.word_ar} echo />{flip && r.card.example_ar && <Say text={r.card.example_ar} label="المثال" k="ex" ck={r.card.example_ar} />}</span></CardVoice>
      {flip && <div className="iq-rate"><button type="button" className="iq-btn again" onClick={() => void rate('again')} data-testid="iq-rate-again">ما زلت أتعلّمها</button><button type="button" className="iq-btn" onClick={() => void rate('good')} data-testid="iq-rate-good">أعرفها</button><button type="button" className="iq-btn gold" onClick={() => void rate('easy')}>سهلة</button></div>}
      {!flip && <p className="iq-hint">تذكّر المعنى ثم اقلب البطاقة.</p>}</div>}
    {r.kind === 'item' && r.exercise && <div data-testid="iq-rev-item"><Exercise n={i + 1} ex={r.exercise} fb={fb || undefined} onAnswer={async (a) => { const d = await post({ action: 'daily', item_id: r.exercise!.id, answer: a }); if (d.ok) setFb(d); }} />
      {fb && <div className="iq-rate"><button type="button" className="iq-btn again" onClick={() => void rate('again')}>أعيدها غدًا</button><button type="button" className="iq-btn" onClick={() => void rate(fb.correct ? 'good' : 'again')}>التالي</button></div>}</div>}
  </div></section>;
}

function NotebookView({ q, H }: { q: (v: string) => string; H: () => Record<string, string> }) {
  const [d, setD] = useState<{ كلمات: (Card & { الحلقة: string; إتقان: number })[]; إتقان: number } | null>(null); const [f, setF] = useState('');
  useEffect(() => { fetch(q('notebook'), { headers: H(), cache: 'no-store' }).then((r) => r.json()).then((j) => setD(j.ok ? j : { كلمات: [], إتقان: 0 })).catch(() => setD({ كلمات: [], إتقان: 0 })); }, [q, H]);
  const rows = useMemo(() => (d?.كلمات || []).filter((w) => !f || w.word_ar.includes(f) || w.gloss_ar.includes(f)), [d, f]);
  if (!d) return <p className="iq-wait">نفتح دفترك…</p>;
  return <section className="iq-wrap"><div className="iq-card iq-nb"><div className="iq-nbhead"><h1 className="iq-h1">دفتري <small>{d.كلمات.length} كلمة · إتقان {d.إتقان}٪</small></h1><div className="iq-row no-print"><input value={f} onChange={(e) => setF(e.target.value)} placeholder="ابحث في كلماتي" aria-label="بحث" /><button type="button" className="iq-btn ghost" onClick={() => window.print()}>طباعة</button></div></div>
    {rows.length === 0 ? <p className="iq-empty" data-testid="iq-nb-empty">دفترك يمتلئ مع كلّ حلقة تتمّها.</p> : <table className="iq-table" data-testid="iq-nb-table"><thead><tr><th>الكلمة</th><th>المعنى</th><th>مثال</th><th>الحلقة</th><th>إتقان</th></tr></thead><tbody>{rows.map((w) => <tr key={w.id}><td className="iq-wd">{w.word_ar}{w.pos && <small>{w.pos}</small>}</td><td>{w.gloss_ar}</td><td>{w.example_ar}</td><td>{w.الحلقة}</td><td><span className="iq-bar"><i style={{ width: `${w.إتقان}%` }} /></span>{w.إتقان}٪</td></tr>)}</tbody></table>}
  </div></section>;
}

const CSS = `
.iq{min-height:100vh;background:#faf8f4;color:#0b222a;font-family:inherit;line-height:1.75}
.iq :is(button,a,input):focus-visible{outline:3px solid #0f2a4e;outline-offset:2px}
.iq-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.iq-top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.95);backdrop-filter:blur(8px);border-bottom:1px solid #e8eef3}
.iq-head{max-width:980px;margin:0 auto;padding:10px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.iq-brand{font-weight:900;font-size:22px;color:#0f2a4e;text-decoration:none;display:flex;flex-direction:column;line-height:1.1}.iq-brand small{font-size:11.5px;color:#2e7d86;font-weight:800}
.iq-nav{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.iq-nav button{font:inherit;font-weight:800;min-height:40px;border:1px solid #e8eef3;background:#fff;color:#0f2a4e;border-radius:999px;padding:6px 14px;cursor:pointer;display:inline-flex;gap:6px;align-items:center}.iq-nav button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.iq-nav button i{font-style:normal;background:#d9a441;color:#0b222a;border-radius:999px;padding:0 7px;font-size:12px}
.iq-lnk{color:#0f2a4e;font-weight:800;text-decoration:none;min-height:40px;display:inline-flex;align-items:center;padding:0 8px}
.iq-live{min-height:1.2em;max-width:980px;margin:4px auto 0;padding:0 18px;color:#0f5c57;font-weight:800;font-size:13px}
.iq-wait{text-align:center;padding:40px;color:#5b6b72;font-weight:700}.iq-err{color:#9e2a2b;font-weight:800}
.iq-wrap{max-width:980px;margin:0 auto;padding:18px 18px 40px}
.iq-gate{background:#fff;border:1px solid #e8eef3;border-radius:20px;padding:28px;text-align:center;box-shadow:0 10px 30px rgba(15,42,78,.06)}.iq-gate h1{margin:6px 0 8px;font-size:30px;color:#0f2a4e}
.iq-kicker{margin:0;font-size:12.5px;font-weight:900;letter-spacing:.08em;color:#2e7d86}.iq-lead{margin:0 0 16px;color:#334155;font-size:16px;max-width:640px;margin-inline:auto}
.iq-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;align-items:center}.iq-row input{font:inherit;min-height:44px;border:1px solid #cbd5e1;border-radius:12px;padding:8px 12px;min-width:200px;text-align:center;font-weight:800;letter-spacing:.08em}
.iq-levels{list-style:none;padding:0;margin:18px 0 0;display:flex;gap:6px;flex-wrap:wrap;justify-content:center}.iq-levels li{border:1px solid #e8eef3;border-radius:999px;padding:4px 12px;font-size:12.5px;font-weight:800;color:#0f2a4e;background:#f4f1ea}
.iq-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:#0f2a4e;color:#fff;border:1px solid #0f2a4e;border-radius:999px;padding:10px 20px;font:inherit;font-weight:800;cursor:pointer;text-decoration:none;min-height:44px}.iq-btn:disabled{opacity:.45;cursor:not-allowed}.iq-btn.ghost{background:#fff;color:#0f2a4e}.iq-btn.gold{background:#d9a441;color:#0b222a;border-color:#d9a441}.iq-btn.again{background:#9e2a2b;border-color:#9e2a2b}.iq-btn.small{min-height:40px;padding:6px 14px}
.iq-lnkbtn{font:inherit;font-weight:800;color:#0f2a4e;background:none;border:0;cursor:pointer;min-height:40px;padding:0}
.iq-band{background:linear-gradient(135deg,#0f2a4e 0%,#0b3d4a 60%,#2e7d86 100%);color:#fff;padding:28px 18px 24px}.iq-bandin{max-width:980px;margin:0 auto}.iq-band h1{margin:4px 0 6px;font-size:30px;color:#fff}.iq-band .iq-kicker{color:#f4d58d}.iq-band .iq-lead{color:#d5e0ea;margin-inline:0}
.iq-stats{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 14px}.iq-stats div{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:8px 14px;min-width:120px}.iq-stats b{display:block;font-size:24px;line-height:1.1}.iq-stats span{font-size:12.5px;color:#d5e0ea}
.iq-card{background:#fff;border:1px solid #e8eef3;border-radius:18px;padding:18px 20px;margin:0 0 14px;box-shadow:0 6px 18px rgba(15,42,78,.04)}.iq-card h2{margin:0 0 10px;font-size:19px;color:#0f2a4e}.iq-card h2 small{font-size:12.5px;color:#5b6b72;margin-inline-start:8px;font-weight:700}
.iq-daily{border-top:3px solid #d9a441}.iq-q{font-weight:800;font-size:17px;margin:0 0 8px}
.iq-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px}.iq-opt{font:inherit;font-weight:700;min-height:44px;border:1px solid #cbd5e1;background:#fff;border-radius:12px;padding:8px 12px;cursor:pointer;text-align:start}.iq-opt:disabled{cursor:default}.iq-opt.right{background:#dcfce7;border-color:#86efac}.iq-opt.wrong{background:#fee2e2;border-color:#fca5a5}
.iq-fb{margin:8px 0 0;font-weight:700;color:#0f2a4e}.iq-key{margin:6px 0 0;font-weight:700;color:#1f6e5a}
.iq-offline{margin:8px auto 0;max-width:980px;padding:8px 12px;border-radius:10px;background:#fff7e6;border:1px solid #f0d9a8;color:#5b4a1e;font-size:13px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.iq-dl{margin-inline-start:auto;display:inline-flex;gap:6px;align-items:center;font-weight:400}.iq-dl small{font-size:11.5px;color:#2e7d86}.iq-mini{border:1px solid #c9d6dd;background:#fff;border-radius:999px;padding:2px 10px;font-size:12px;color:#0f2a4e;cursor:pointer;font-family:inherit}.iq-mini:hover{border-color:#2e7d86}
.iq-unit{margin:0 0 16px}.iq-unit h2{margin:0;font-size:20px;color:#0f2a4e;display:flex;gap:10px;align-items:baseline}.iq-unit h2 span{font-size:11.5px;color:#2e7d86;letter-spacing:.08em}.iq-focus{margin:2px 0 8px;color:#5b6b72;font-size:13.5px}
.iq-lessons{list-style:none;margin:0;padding:0;display:grid;gap:8px}.iq-les button{width:100%;display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e8eef3;border-radius:14px;padding:10px 14px;font:inherit;cursor:pointer;text-align:start;min-height:56px}.iq-les button i{font-style:normal;width:32px;height:32px;border-radius:999px;background:#f4f1ea;color:#0f2a4e;display:grid;place-items:center;font-weight:900;flex:none}.iq-les button span{flex:1;display:flex;flex-direction:column}.iq-les button b{color:#0f2a4e}.iq-les button small{color:#5b6b72;font-size:12.5px}.iq-les button em{font-style:normal;font-weight:800;color:#2e7d86;font-size:13px}.iq-les.done button{border-color:#86efac;background:#f0fdf4}.iq-les.done i{background:#1f6e5a;color:#fff}.iq-les.started button{border-color:#f3d98b}
.iq-note{color:#5b6b72;font-size:13px}.iq-empty{color:#5b6b72;text-align:center;padding:14px;font-weight:700}
.iq-crumb{margin:0 0 4px;color:#5b6b72;font-size:13px;font-weight:700}.iq-h1{margin:0 0 4px;font-size:26px;color:#0f2a4e}.iq-h1 small{font-size:13px;color:#5b6b72;margin-inline-start:8px}.iq-goal{margin:0 0 12px;color:#2e7d86;font-weight:800}
.iq-stations{list-style:none;margin:0 0 14px;padding:0;display:flex;gap:6px;flex-wrap:wrap}.iq-stations button{font:inherit;font-weight:800;font-size:13px;min-height:40px;border:1px solid #e8eef3;background:#fff;color:#0f2a4e;border-radius:999px;padding:6px 14px;cursor:pointer}.iq-stations button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.iq-stations button.done{background:#e6f4f3;border-color:#76b0b8}
.iq-intro{font-size:16.5px;margin:0 0 12px}.iq-text{background:#f4f1ea;border-radius:14px;padding:14px 16px;margin:0 0 12px;font-size:18px;line-height:2}.iq-text p{margin:0 0 4px}.iq-text b{color:#0b3d4a}.iq-text audio{width:100%;margin-top:8px}
.iq-soon{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.iq-soon button{font:inherit;font-weight:700;font-size:12.5px;min-height:40px;border:1px dashed #cbd5e1;background:#fff;color:#5b6b72;border-radius:999px;padding:6px 14px}
.iq-rowb{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.iq-cards{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}.iq-flash{width:100%;min-height:120px;border:1px solid #e8eef3;background:#fff;border-radius:16px;padding:12px;font:inherit;cursor:pointer;display:grid;place-items:center;text-align:center;transition:transform .15s}.iq-flash.back{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.iq-flash.big{min-height:200px;font-size:22px}.iq-w{font-size:22px;font-weight:900;display:flex;flex-direction:column;gap:4px}.iq-w small{font-size:11.5px;color:#2e7d86;font-weight:700}.iq-flash.back .iq-w small{color:#f4d58d}.iq-g{font-size:15px;font-weight:700;display:flex;flex-direction:column;gap:6px}.iq-g em{font-style:normal;font-size:13px;color:#d5e0ea}
.iq-rule p{font-size:16px}.iq-rule ul{background:#f4f1ea;border-radius:12px;padding:10px 28px;margin:0}.iq-rule li{font-weight:700;font-size:16px}
.iq-ex{border:1px solid #e8eef3;border-radius:14px;padding:10px 14px 14px;margin:0 0 10px;min-width:0}.iq-ex.ok{border-color:#86efac;background:#f0fdf4}.iq-ex.bad{border-color:#fca5a5;background:#fff1f2}.iq-ex legend{font-weight:800;color:#0f2a4e;padding:0 6px;font-size:15.5px}.iq-ex legend i{font-style:normal;color:#2e7d86;margin-inline-end:4px}
.iq-match{display:grid;gap:10px}.iq-col{display:flex;gap:6px;flex-wrap:wrap}.iq-chip{font:inherit;font-weight:700;min-height:44px;border:1px solid #cbd5e1;background:#fff;border-radius:12px;padding:6px 12px;cursor:pointer;display:inline-flex;flex-direction:column;align-items:flex-start}.iq-chip small{font-size:11px;color:#2e7d86}.iq-chip.sel{border-color:#0f2a4e;box-shadow:0 0 0 3px rgba(15,42,78,.15)}.iq-chip.paired{background:#e6f4f3;border-color:#76b0b8}.iq-chip.in{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.iq-chip:disabled{cursor:default;opacity:.85}
.iq-line{min-height:56px;border:2px dashed #cbd5e1;border-radius:14px;padding:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 8px;background:#fff}.iq-ph{color:#94a3b8;font-weight:700;padding:0 6px}.iq-pool{display:flex;gap:6px;flex-wrap:wrap}
.iq-close{text-align:center}.iq-close h2{font-size:44px;margin:0 0 8px;color:#0f2a4e}.iq-closing{font-size:17px;max-width:620px;margin:0 auto 12px}.iq-prod{text-align:start;background:#f4f1ea;border-radius:14px;padding:12px 14px;margin:0 0 8px}.iq-prod p{margin:0 0 6px}.iq-prod small{display:block;color:#5b6b72;font-size:12.5px}.iq-close .iq-rowb{justify-content:center}
.iq-revcard{display:grid;gap:12px;justify-items:center}.iq-rate{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.iq-hint{color:#5b6b72;font-weight:700;margin:0}
.iq-nbhead{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}.iq-nb input{min-width:180px;text-align:start;letter-spacing:0}
.iq-table{width:100%;border-collapse:collapse;font-size:14px;margin-top:10px}.iq-table th{text-align:start;color:#5b6b72;font-size:12px;border-bottom:1px solid #e8eef3;padding:6px 8px}.iq-table td{border-bottom:1px solid #f1f5f9;padding:8px;vertical-align:top}.iq-wd{font-weight:900;color:#0f2a4e;font-size:16px}.iq-wd small{display:block;font-size:11px;color:#2e7d86;font-weight:700}.iq-bar{display:inline-block;width:70px;height:8px;background:#e8eef3;border-radius:999px;vertical-align:middle;margin-inline-end:6px;overflow:hidden}.iq-bar i{display:block;height:100%;background:#2e7d86}
.iq-foot{max-width:980px;margin:0 auto;padding:0 18px 30px;color:#5b6b72;font-size:12.5px;font-weight:600;text-align:center}
@media print{.iq-top,.iq-foot,.iq-live,.no-print{display:none!important}.iq{background:#fff}.iq-card{border:0;box-shadow:none}}
@media (max-width:640px){.iq-band h1{font-size:24px}.iq-close h2{font-size:36px}.iq-stats div{min-width:90px}}

/* الخطوة 2 */
.iq-skill{font-style:normal;text-decoration:none;display:inline-block;font-size:11px;font-weight:800;color:#0b3d4a;background:#e6f4f3;border:1px solid #cfe9e6;border-radius:999px;padding:0 8px;margin-inline-end:6px;line-height:20px;font-family:var(--font-ar)}
.iq-goal small{color:#5b6b72;font-weight:600;font-size:12.5px;font-family:var(--font-ar)}
.iq-hours{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);border-radius:16px;padding:12px 14px;margin:0 0 14px}.iq-hours-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline}.iq-hours-top b{font-size:16px}.iq-hours-top small{color:#d5e0ea;font-size:12.5px}
.iq-hbar{position:relative;height:12px;background:rgba(255,255,255,.18);border-radius:999px;margin:8px 0 6px;overflow:hidden}.iq-hbar i{display:block;height:100%;background:linear-gradient(90deg,#d9a441,#f4d58d);border-radius:999px;transition:width .4s}.iq-hbar em{position:absolute;top:0;bottom:0;width:2px;background:#fff;opacity:.8}
.iq-hnote{display:block;color:#d5e0ea;font-size:12px;line-height:1.6}.iq-hnote.dark{color:#51606b;margin-top:8px}
.iq-thr{border-top:3px solid #d9a441}.iq-thr h2 small,.iq-crossed h2 small{display:block;font-weight:500;color:#51606b;font-size:13px;margin-top:2px}.iq-thrbox{background:#faf8f4;border:1px solid #e8e2d4;border-radius:14px;padding:12px 14px;margin-top:8px}.iq-thrbox h3{margin:0 0 6px;font-size:16px;color:#0f2a4e}.iq-thrfacts{margin:6px 0;padding-inline-start:18px;font-size:13.5px;line-height:1.9;color:#0b222a}
.iq-thrstate{background:#eef6f7;border-radius:14px;padding:10px 14px;margin-top:8px;font-size:14px;line-height:1.8}.iq-thrstate b{color:#0b3d4a}.iq-thrstate p{margin:4px 0}.iq-btn.small{padding:6px 12px;font-size:13px;min-height:36px}
.iq-crossed{background:linear-gradient(135deg,#0f2a4e,#0b3d4a);color:#fff;border:0}.iq-crossed h2{color:#fff}.iq-crossed h2 small{color:#d5e0ea}.iq-crossed .iq-note{color:#e6eef3}.iq-stats.dark div{background:rgba(255,255,255,.1)}.iq-stats.dark b{color:#d9a441}.iq-stats.dark span{color:#e6eef3}
.iq-preplies{margin-top:12px;display:grid;gap:10px}.iq-reply{background:#faf8f4;border:1px solid #e8e2d4;border-radius:14px;padding:12px 14px}.iq-reply h3{margin:0 0 6px;font-size:15px;color:#0f2a4e}.iq-reply h3 small{font-weight:500;color:#51606b}.iq-rubric{list-style:none;margin:6px 0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px}.iq-rubric li{background:#fff;border-radius:10px;padding:6px 8px;display:grid;grid-template-columns:auto 1fr;gap:2px 8px;align-items:center;font-size:12.5px}.iq-rubric li b{font-size:18px;color:#2e7d86;grid-row:span 2}.iq-rubric li small{color:#51606b;grid-column:2}.iq-rew{background:#fff;border-radius:10px;padding:6px 10px}.iq-rew small{display:block;color:#51606b;font-family:var(--font-ar)}.iq-reply details summary{cursor:pointer;font-size:13px;color:#0b3d4a}
.iq-say{font:inherit;font-family:var(--font-ar);font-weight:800;font-size:12.5px;min-height:36px;border:1px solid #cfe9e6;background:#fff;color:#0b3d4a;border-radius:999px;padding:4px 12px;cursor:pointer}.iq-sayrow{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px}
.iq-cards li{display:grid;gap:4px;justify-items:center}.iq-cards .iq-say{min-height:32px;padding:2px 10px}
.iq-say.on{background:#0b3d4a;color:#fff;border-color:#0b3d4a}.iq-say.big{font-size:14px;padding:6px 16px}.iq-say.dev{border-style:dashed;color:#5b6b72}.iq-say small{font-weight:400;font-size:10.5px;opacity:.8}.iq-sayw{display:inline-flex;align-items:center;gap:6px}.iq-sayrow.tight{margin:0;gap:4px}
.iq-echo{font-style:normal;font-size:12.5px;color:#8a6410;background:#fff7e3;border-radius:999px;padding:2px 10px;animation:iqPulse 1s ease-in-out 3}@keyframes iqPulse{50%{transform:scale(1.06)}}
.iq-stage{margin:0}.iq-stagebar{align-items:center}.iq-stagein{display:contents}.iq-voicebadge{font-size:11.5px;color:#0b3d4a;background:#e7f3f2;border-radius:999px;padding:3px 10px;margin-inline-start:auto}.iq-voicebadge.dev{background:#f4f1ea;color:#5b6b72}.iq-psoft{font-size:12px;color:#5b6b72}
.iq-role{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:800;color:#0b3d4a}.iq-role select{font:inherit;font-size:13px;min-height:36px;border:1px solid #cfe9e6;border-radius:10px;background:#fff;padding:4px 8px}
.iq-lines{display:grid;gap:8px;margin-top:6px}.iq-scene{text-align:center;color:#5b6b72;font-size:14px !important;margin:6px 0 !important;cursor:pointer}.iq-scene.on,.iq-para.on{background:#fff7e3;border-radius:10px}
.iq-para{cursor:pointer;padding:2px 8px;border-radius:10px}.iq-linebtn.dabt,.iq-para.dabt{line-height:2.3;font-size:calc(21px * var(--read-size))}
.iq-bub{display:flex;gap:10px;align-items:flex-start;max-width:92%;padding:8px 12px;border-radius:16px;background:#fff;border:1px solid #e8eef3;transition:background .2s,box-shadow .2s}.iq-bub.f{justify-self:start;border-color:#f1dfe3}.iq-bub.m{justify-self:end;flex-direction:row-reverse;border-color:#d6e4ee}.iq-bub.n{justify-self:center}.iq-bub.on{background:#fff7e3;box-shadow:0 0 0 3px #f1d9a2}.iq-bub.mine{border-style:dashed;border-color:#8a6410}
.iq-avatar{width:40px;height:40px;border-radius:12px;background:#faf8f4;flex:none}.iq-bubin{display:grid;gap:2px;min-width:0}.iq-bubin b{font-size:13px;color:#0b3d4a;font-family:var(--font-ar)}.iq-bub.f .iq-bubin b{color:#9b3450}.iq-bub.m .iq-bubin b{color:#0f2a4e}
.iq-linebtn{all:unset;cursor:pointer;font:inherit;font-size:calc(19px * var(--read-size));line-height:1.9;text-align:start;color:#0b222a;font-family:var(--font-read)}.iq-linebtn:hover{text-decoration:underline dotted}.iq-linebtn:focus-visible{outline:2px solid #2e7d86;border-radius:6px}
.iq-turn{margin-top:6px;padding:8px 10px;border-radius:12px;background:#e7f3f2;display:grid;gap:6px;font-size:14px;font-weight:800;color:#0b3d4a}.iq-turn .iq-rowb{margin:0}
@media (prefers-reduced-motion: reduce){.iq-echo{animation:none}}
.iq-ext h2 small{display:block;margin:2px 0 0}.iq-row.start{justify-content:flex-start}.iq-row.start input{text-align:start;letter-spacing:0;min-width:120px;font-weight:600}
.iq-passage{background:#f4f1ea;border-radius:12px;padding:10px 14px;margin:0 0 10px}.iq-opts.tfng{grid-template-columns:repeat(3,1fr)}
.iq-pics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.iq-pic{font:inherit;border:2px solid #e8eef3;background:#fff;border-radius:16px;padding:8px;cursor:pointer;display:grid;gap:6px;justify-items:center;min-height:44px}.iq-pic img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px}.iq-pic span{font-weight:700}.iq-pic.right{border-color:#86efac;background:#f0fdf4}.iq-pic.wrong{border-color:#fca5a5;background:#fff1f2}
.iq-clozetext{background:#f4f1ea;border-radius:12px;padding:12px 14px;margin:0 0 10px;line-height:2.4}.iq-gap{font:inherit;min-width:64px;min-height:36px;border:0;border-bottom:2px dashed #0f2a4e;background:#fff;border-radius:8px 8px 0 0;padding:0 10px;margin:0 4px;cursor:pointer;color:#94a3b8;font-weight:700}.iq-gap.filled{color:#0f2a4e;border-bottom-style:solid;background:#e6f4f3}
.iq-tapline{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px}
.iq-dictin{font:inherit;min-height:44px;border:1px solid #cbd5e1;border-radius:12px;padding:8px 12px;min-width:min(100%,360px);text-align:start;letter-spacing:0}
.iq-frame{font:inherit;border:1px solid #cbd5e1;background:#fff;border-radius:12px;padding:6px;cursor:pointer;display:grid;gap:4px;justify-items:center;width:120px}.iq-frame img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px}.iq-frame span{font-size:12.5px;font-weight:700}.iq-frame.in{border-color:#0f2a4e;box-shadow:0 0 0 2px rgba(15,42,78,.2)}
.iq-ta{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:14px;padding:12px 14px;font:inherit;line-height:2;min-height:160px}.iq-rec{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 8px}.iq-rec audio{max-width:100%}
.iq-check{border:1px solid #e8eef3;border-radius:14px;padding:10px 14px;margin:10px 0 0;display:grid;gap:8px}.iq-check legend{font-weight:800;color:#0f2a4e;padding:0 6px}.iq-check label{display:flex;gap:8px;align-items:flex-start;font-weight:600;min-height:28px}.iq-check input{width:20px;height:20px;margin-top:3px}
.iq-model{margin-top:12px;background:#fffdf7;border:1px solid #e6d9b3;border-radius:14px;padding:12px 14px}.iq-model h3{margin:0 0 6px;font-size:15px;color:#8a6410}.iq-model h3 small{font-weight:600;color:#5b6b72;margin-inline-start:6px}.iq-model p{margin:0;white-space:pre-line}
.iq-opt.sel{border-color:#0f2a4e;box-shadow:0 0 0 3px rgba(15,42,78,.15)}
/* «خطّ أَثَر» — طبقة القراءة: كلّ ما يقرؤه المتعلّم بنسخ واضح وحجمه من ReadSize */
.iq-text,.iq-intro,.iq-q,.iq-opt,.iq-chip,.iq-flash,.iq-ex legend,.iq-fb,.iq-key,.iq-closing,.iq-rule p,.iq-rule li,.iq-rule h2,.iq-prod p,.iq-table td,.iq-rev-card .iq-flash,.iq-goal,.iq-passage,.iq-clozetext,.iq-gap,.iq-dictin,.iq-ta,.iq-pic span,.iq-frame span,.iq-model p,.iq-check label{font-family:var(--font-read),"Noto Naskh Arabic",serif;line-height:2;letter-spacing:0}
.iq-text p{font-size:calc(19px * var(--read-size))}.iq-intro,.iq-q,.iq-ex legend,.iq-closing,.iq-rule p,.iq-rule li,.iq-prod p{font-size:calc(17.5px * var(--read-size))}.iq-opt,.iq-chip{font-size:calc(17px * var(--read-size));font-weight:400}.iq-flash .iq-w{font-size:calc(24px * var(--read-size))}.iq-flash .iq-g{font-size:calc(16px * var(--read-size))}.iq-table td{font-size:calc(16px * var(--read-size))}.iq-wd{font-size:calc(19px * var(--read-size))}.iq-fb,.iq-key{font-size:calc(15.5px * var(--read-size))}
.iq-ex legend i,.iq-flash small,.iq-wd small,.iq-chip small{font-family:var(--font-ar)}
`;
