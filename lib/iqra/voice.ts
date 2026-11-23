/**
 * «صوت أَثَر الواحد» — مشغّل «شريط الحلقة» في اقْرَأْ.
 * كلّ حلقة (أو نصّ مكتبة) لها ملفّ MP3 واحد + cues.json مولّدان بـ tools/iqra-tts.py بأصوات «فرقة أَثَر» (الراوي نفسه في مِعيار).
 * المشغّل يطلب /iqra/audio/<code>.cues.json؛ إن غاب (مسوّدة جديدة بلا صوت بعد) يرجع إلى صوت الجهاز (Web Speech) بشارة «صوت الجهاز».
 * بلا خادم، بلا بيانات تخرج: الملفّات ثابتة على CDN، والميكروفون لا يُفتح هنا أبدًا.
 */
export type CueKind = 'intro' | 'line' | 'card' | 'ex' | 'gex' | 'dict' | 'pic';
export type Cue = { k: CueKind; i?: number; t?: string; r?: string; g?: 'f' | 'm' | 'n'; a?: string; s: number; e: number; d?: string };
/** الصورة المضبوطة ضبطًا تامًّا للمقطع (كتبها المؤلّف في tools/iqra/dabt) — تُعرض عند «أظهر التشكيل»؛ null إن لم تُكتب. */
export function dabtOf(c: Cue | null | undefined): string | null { return c && c.d ? c.d : null; }
const DABT_KEY = 'iq-dabt';
export function readDabtPref(): boolean { try { return typeof localStorage !== 'undefined' && localStorage.getItem(DABT_KEY) === '1'; } catch { return false; } }
export function writeDabtPref(on: boolean): void { try { localStorage.setItem(DABT_KEY, on ? '1' : '0'); } catch { /* لا شيء */ } }
export type Cues = { v: 1; code: string; src: string; level: string; rate: string; dur: number; cast: string; cues: Cue[] };

const CACHE = new Map<string, Promise<Cues | null>>();
/** يحمّل إشارات الشريط مرّة واحدة لكلّ رمز (ذاكرة الصفحة). 404 → null. */
export function loadCues(code: string | null | undefined, base = '/iqra/audio'): Promise<Cues | null> {
  if (!code || typeof window === 'undefined') return Promise.resolve(null);
  const key = `${base}/${code}`;
  if (!CACHE.has(key)) CACHE.set(key, fetch(`${key}.cues.json`, { cache: 'force-cache' }).then((r) => (r.ok ? (r.json() as Promise<Cues>) : null)).then((c) => (c && c.v === 1 && Array.isArray(c.cues) ? c : null)).catch(() => null));
  return CACHE.get(key)!;
}

/** يجد مقطعًا: سطر النصّ برقمه، أو بطاقة/مثال/إملاء/صورة بنصّها. */
export function findCue(c: Cues | null | undefined, k: CueKind, key: number | string): Cue | null {
  if (!c) return null;
  if (k === 'intro') return c.cues.find((x) => x.k === 'intro') || null;
  if (k === 'line') return c.cues.find((x) => x.k === 'line' && x.i === key) || null;
  const t = String(key);
  return c.cues.find((x) => x.k === k && x.t === t) || null;
}
export function lineCues(c: Cues | null | undefined): Cue[] { return c ? c.cues.filter((x) => x.k === 'line') : []; }
/** الشخصيّات المتكلّمة في الحوار (بلا الراوي) بترتيب ظهورها — لقائمة «العب الدور». */
export function roles(c: Cues | null | undefined): { r: string; g: 'f' | 'm' | 'n'; a: string; n: number }[] {
  const out: { r: string; g: 'f' | 'm' | 'n'; a: string; n: number }[] = [];
  for (const x of lineCues(c)) { if (!x.r) continue; const f = out.find((o) => o.r === x.r); if (f) f.n += 1; else out.push({ r: x.r, g: x.g || 'n', a: x.a || (x.g === 'f' ? 'woman' : 'man'), n: 1 }); }
  return out;
}

export type SeqOpts = { rate?: number; skipRole?: string | null; onCue?: (c: Cue, idx: number) => void; onTurn?: (c: Cue, idx: number, resume: () => void) => void; onEnd?: () => void };
/** مشغّل مقاطع فوق عنصر <audio> واحد: يقفز إلى بداية المقطع ويتوقّف عند نهايته (rAF لا timeupdate لأنّه خشن). */
export class Sprite {
  private a: HTMLAudioElement | null = null; private raf = 0; private session = 0; private resolveCur: (() => void) | null = null;
  constructor(private src: string) {}
  private el(): HTMLAudioElement { if (!this.a) { this.a = new Audio(this.src); this.a.preload = 'auto'; this.a.className = 'iq-sprite'; this.a.setAttribute('aria-hidden', 'true'); this.a.style.display = 'none'; if (typeof document !== 'undefined') document.body.appendChild(this.a); try { (this.a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true; } catch { /* لا شيء */ } } return this.a; }
  get playing(): boolean { return !!this.a && !this.a.paused; }
  private cancelTick(): void { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
  /** يوقف كلّ شيء ويُنهي أيّ وعد معلّق (المشهد يتوقّف فورًا). */
  /** إزالة العنصر عند مغادرة الحلقة. */
  dispose(): void { this.stop(); try { this.a?.remove(); } catch { /* لا شيء */ } this.a = null; }
  stop(): void { this.session += 1; this.cancelTick(); try { this.a?.pause(); } catch { /* لا شيء */ } const r = this.resolveCur; this.resolveCur = null; if (r) r(); }
  private one(c: Cue, rate: number, session: number): Promise<void> {
    const a = this.el();
    return new Promise<void>((resolve) => {
      this.resolveCur = resolve;
      const finish = () => { this.cancelTick(); try { a.pause(); } catch { /* لا شيء */ } if (this.resolveCur === resolve) this.resolveCur = null; resolve(); };
      const go = () => { if (session !== this.session) return resolve(); a.playbackRate = rate; a.currentTime = c.s; a.play().then(() => { const tick = () => { if (session !== this.session) return; if (a.currentTime >= c.e - 0.04 || a.ended) return finish(); this.raf = requestAnimationFrame(tick); }; this.raf = requestAnimationFrame(tick); }).catch(() => resolve()); };
      if (a.readyState >= 1) go(); else { a.addEventListener('loadedmetadata', go, { once: true }); a.load(); }
    });
  }
  /** مقطع واحد (بطاقة، إملاء، سطر). */
  play(c: Cue, rate = 1): Promise<void> { this.stop(); return this.one(c, rate, this.session); }
  /** المشهد كلّه بالتسلسل. skipRole: سطور هذه الشخصية لا تُسمع؛ يُستدعى onTurn وينتظر resume() — «العب الدور». */
  async playSeq(list: Cue[], o: SeqOpts = {}): Promise<void> {
    this.stop(); const s = this.session;
    for (let i = 0; i < list.length; i += 1) {
      if (s !== this.session) return; const c = list[i]; o.onCue?.(c, i);
      if (o.skipRole && c.r === o.skipRole && o.onTurn) { await new Promise<void>((res) => o.onTurn!(c, i, res)); if (s !== this.session) return; continue; }
      await this.one(c, o.rate || 1, s);
    }
    if (s === this.session) o.onEnd?.();
  }
}

/* ---------- الاحتياط: صوت الجهاز (Web Speech) — نختار أفضل صوت عربيّ متاح، ونعلن أنّه «صوت الجهاز» ---------- */
export function canSpeak(): boolean { return typeof window !== 'undefined' && 'speechSynthesis' in window; }
let picked: SpeechSynthesisVoice | null | undefined;
export function pickDeviceVoice(): SpeechSynthesisVoice | null {
  if (!canSpeak()) return null; if (picked !== undefined) return picked;
  const vs = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('ar'));
  const score = (v: SpeechSynthesisVoice) => (/natural|neural|online/i.test(v.name) ? 8 : 0) + (/google/i.test(v.name) ? 4 : 0) + (/microsoft/i.test(v.name) ? 3 : 0) + (v.lang.toLowerCase() === 'ar-sa' ? 2 : 0) + (v.localService ? 0 : 1);
  picked = vs.sort((a, b) => score(b) - score(a))[0] || null; return picked;
}
export function speakDevice(text: string, rate = 0.8): boolean {
  if (!canSpeak()) return false; const u = new SpeechSynthesisUtterance(text); u.lang = 'ar-SA'; u.rate = rate; const v = pickDeviceVoice(); if (v) u.voice = v;
  window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); return true;
}
export function stopDevice(): void { try { window.speechSynthesis?.cancel(); } catch { /* لا شيء */ } }
