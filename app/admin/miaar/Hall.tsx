'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «قاعة الشاهد» (م8-ب) — الاسم الرسمي: مركز المراقبة الإلكترونية للاختبارات / Examination Proctoring Center.
 *  كل من يختبر الآن — في كل الدعوات والاختبار الفردي — على شاشة واحدة: فرديًّا · حسب القاعات · حسب الأماكن.
 *  بلاطة لكل ممتحن: آخر لقطة، الاسم، المستوى، القسم، الوقت المتبقّي، الإشارات، حالة الكاميرا، و«النبض» (خطّ زمني مصغّر).
 *  أفعال: همسة فردية · همسة جماعية · فتح «غرفة الشاهد» · «تولّي» مجموعة (مراقبون متعدّدون) · «حكم الشاهد» للمنتهين خلال 10 دقائق.
 *  «وضع الجدار» (ملء الشاشة لغرفة المراقبة) · رنّة اختيارية عند دخول ممتحن جديد أو تحوّل بلاطة إلى «يستحق المراجعة».
 *  حدود صادقة: المتصفّح لا يفتح نافذة من تلقاء نفسه — لذلك مؤشّر «يختبر الآن N» ينبض في رأس مِعيار ويفتح القاعة بنقرة.
 *  مبادئ «شاهِد» كما هي: لقطات لا فيديو، لا صوت، لا تحليل آلي للوجوه، لا حكم آلي، الصور لا تغادر الغرفة (روابط موقَّعة 10 دقائق).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../lib/ui/icons';

type Pulse = { k: string; at: string };
type Row = {
  session_id: string; name: string; email: string; status: 'active' | 'finished'; started_at: string; expires_at: string; finished_at: string | null;
  remaining_s: number; elapsed_s: number; mode: string; mode_ar: string; exam: string; level: string | null; section: string | null;
  invite_id: string | null; invite_label: string | null; purpose: string | null; classroom_id: string | null; classroom_label: string | null; client_name: string | null; location: string | null; city: string | null;
  report_id: string | null; access_code: string | null; integrity: string | null;
  witness: { level: string; level_ar: string; signals: number; frames: number; last_frame_at: string | null; last_frame_url: string | null; camera: 'on' | 'off' | 'none'; counters: Record<string, number>; pulse: Pulse[] } | null;
  room_key: string; room_label: string; place_key: string; place_label: string;
};
type GroupBy = 'single' | 'room' | 'place';
type Data = { rows: Row[]; default_mode: string; default_mode_ar: string; claims: Record<string, { by: string; at: string }>; at: string; title: { ar: string; en: string }; recent_min: number; groups_ar: Record<GroupBy, string>; modes: { value: string; label: string }[]; me: { email: string; name: string; can_set_default: boolean } };

const POLL_MS = 15000;
const SIGNAL_AR: Record<string, string> = { tab_hidden: 'ترك التبويب', focus_lost: 'فقد التركيز', fullscreen_exit: 'خرج من ملء الشاشة', camera_lost: 'الكاميرا انقطعت', camera_back: 'الكاميرا عادت', still_frame: 'صورة ثابتة', paste: 'لصق', screen_extended: 'شاشة ثانية', whisper: 'همسة', section_start: 'بداية قسم' };
const SIGNAL_ICON: Record<string, string> = { tab_hidden: '👁', focus_lost: '⧉', fullscreen_exit: '⛶', camera_lost: '📷', camera_back: '📷', still_frame: '⏸', paste: '📋', screen_extended: '🖥', whisper: '💬', section_start: '§' };
const LEVEL_AR: Record<string, string> = { review: 'يستحق المراجعة', watch: 'إشارات', calm: 'هادئ' };
const SECTION_AR: Record<string, string> = { grammar: 'القواعد', vocabulary: 'المفردات', reading: 'القراءة', listening: 'الاستماع', writing: 'الكتابة', speaking: 'المحادثة', use: 'الاستخدام', probe: 'المسبار' };
const mmss = (s: number) => { const x = Math.max(0, Math.round(s)); return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
const hm = (s: string | null) => (s ? new Date(s).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—');
const WATCH_KINDS = new Set(['tab_hidden', 'focus_lost', 'fullscreen_exit', 'camera_lost', 'still_frame', 'paste', 'screen_extended']);

/** رنّة قصيرة بلا ملفات: نغمتان من WebAudio (تُفعَّل بنقرة المستخدم أولًا — قيد المتصفّح) */
function chime(kind: 'enter' | 'review') {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return; const ctx = new AC(); const t = ctx.currentTime;
    const notes = kind === 'review' ? [659, 523, 659] : [523, 784]; notes.forEach((f, i) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + i * 0.16); g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.16 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 0.15); o.connect(g); g.connect(ctx.destination); o.start(t + i * 0.16); o.stop(t + i * 0.16 + 0.16); });
    window.setTimeout(() => { try { void ctx.close(); } catch { /* لا شيء */ } }, 900);
  } catch { /* لا صوت — لا مشكلة */ }
}

/** «يختبر الآن N» — مؤشّر نابض في رأس مِعيار (كل 20 ث)؛ يفتح القاعة بنقرة لأن المتصفّح لا يفتح نافذة من تلقاء نفسه */
export function LiveBadge({ auth, active }: { auth: () => Promise<Record<string, string>>; active: boolean }) {
  const [n, setN] = useState<{ active: number; review: number } | null>(null);
  useEffect(() => {
    let stop = false;
    const tick = async () => { if (document.hidden) return; const H = await auth(); const j = await fetch('/api/admin/miaar/hall?count=1', { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!stop && j?.success) setN({ active: j.active, review: j.review }); };
    void tick(); const id = window.setInterval(() => { void tick(); }, 20000); return () => { stop = true; window.clearInterval(id); };
  }, [auth]);
  if (!n || active) return null;
  const on = n.active > 0;
  return <a className={`hl-badge${on ? ' on' : ''}${n.review ? ' rev' : ''}`} href="/admin/miaar/hall" data-testid="hall-badge" data-active={n.active} data-review={n.review} aria-label={on ? `يختبر الآن ${n.active} — افتح قاعة الشاهد` : 'لا أحد يختبر الآن — قاعة الشاهد'}>
    <style>{BADGE_CSS}</style><i aria-hidden="true" /><span>{on ? <>يختبر الآن <b>{n.active}</b>{n.review ? <em> · {n.review} يستحق المراجعة</em> : null}</> : 'القاعة هادئة — لا أحد يختبر الآن'}</span><Icon name="arrow" size={14} />
  </a>;
}

export default function Hall({ auth }: { auth: () => Promise<Record<string, string>> }) {
  const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);
  const [by, setBy] = useState<GroupBy>('single'); const [fLevel, setFLevel] = useState<'all' | 'review' | 'watch' | 'calm'>('all'); const [fCam, setFCam] = useState(false); const [fMode, setFMode] = useState('all'); const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set()); const [whisper, setWhisper] = useState(''); const [whisperOne, setWhisperOne] = useState<{ id: string; name: string } | null>(null);
  const [wall, setWall] = useState(false); const [sound, setSound] = useState(false); const [toast, setToast] = useState(''); const [tick, setTick] = useState(0);
  const seen = useRef<Map<string, string>>(new Map()); const first = useRef(true); const soundRef = useRef(false); soundRef.current = sound;

  const load = useCallback(async () => {
    const H = await auth();
    const j = await fetch('/api/admin/miaar/hall', { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    if (!j?.success) { setErr(j?.error || 'تعذّر فتح القاعة'); return; }
    setErr(''); setD(j);
    /* بلاطة جديدة أو تحوّل إلى «يستحق المراجعة» → إشعار داخل الصفحة (+ رنّة إن فُعّلت) */
    const rows: Row[] = j.rows || []; const entered: string[] = []; const worsened: string[] = [];
    for (const r of rows) { const lv = r.witness?.level || 'calm'; const prev = seen.current.get(r.session_id); if (prev === undefined) { if (r.status === 'active') entered.push(r.name); } else if (prev !== 'review' && lv === 'review') worsened.push(r.name); seen.current.set(r.session_id, lv); }
    if (!first.current) {
      if (worsened.length) { setToast(`يستحق المراجعة الآن: ${worsened.slice(0, 3).join('، ')}${worsened.length > 3 ? ` +${worsened.length - 3}` : ''}`); if (soundRef.current) chime('review'); }
      else if (entered.length) { setToast(`دخل القاعة: ${entered.slice(0, 3).join('، ')}${entered.length > 3 ? ` +${entered.length - 3}` : ''}`); if (soundRef.current) chime('enter'); }
    }
    first.current = false;
  }, [auth]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const id = window.setInterval(() => { if (!document.hidden) void load(); }, POLL_MS); return () => window.clearInterval(id); }, [load]);
  useEffect(() => { const id = window.setInterval(() => setTick((t) => t + 1), 1000); return () => window.clearInterval(id); }, []);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(''), 6000); return () => window.clearTimeout(id); }, [toast]);
  useEffect(() => { if (!ok) return; const id = window.setTimeout(() => setOk(''), 5000); return () => window.clearTimeout(id); }, [ok]);
  /* وضع الجدار: ملء الشاشة إن سمح المتصفّح، وإلا تكبير داخل الصفحة */
  useEffect(() => { const onFs = () => { if (!document.fullscreenElement) setWall(false); }; document.addEventListener('fullscreenchange', onFs); return () => document.removeEventListener('fullscreenchange', onFs); }, []);
  async function toggleWall() { if (!wall) { setWall(true); try { await document.documentElement.requestFullscreen?.(); } catch { /* نكمل بالتكبير داخل الصفحة */ } } else { setWall(false); try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* لا شيء */ } } }

  const base = useMemo(() => {
    if (!d) return [] as Row[]; const age = (Date.now() - Date.parse(d.at)) / 1000; const qq = q.trim().toLowerCase();
    return d.rows.map((r) => ({ ...r, remaining_s: r.status === 'active' ? Math.max(0, r.remaining_s - age) : 0, elapsed_s: r.elapsed_s + (r.status === 'active' ? age : 0) }))
      .filter((r) => fLevel === 'all' || (r.witness?.level || 'calm') === fLevel).filter((r) => !fCam || r.witness?.camera === 'off').filter((r) => fMode === 'all' || r.mode === fMode)
      .filter((r) => !qq || r.name.toLowerCase().includes(qq) || r.email.toLowerCase().includes(qq) || (r.room_label || '').toLowerCase().includes(qq) || (r.place_label || '').toLowerCase().includes(qq));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, fLevel, fCam, fMode, q, tick]);
  const groups = useMemo(() => {
    const m = new Map<string, { key: string; label: string; rows: Row[] }>();
    for (const r of base) { const key = by === 'single' ? 'all' : by === 'room' ? r.room_key : r.place_key; const label = by === 'single' ? 'كل الممتحنين' : by === 'room' ? r.room_label : r.place_label; const g = m.get(key) || { key, label, rows: [] }; g.rows.push(r); m.set(key, g); }
    const rank: Record<string, number> = { review: 0, watch: 1, calm: 2 };
    return [...m.values()].map((g) => ({ ...g, rows: [...g.rows].sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) || (rank[a.witness?.level || 'calm'] ?? 2) - (rank[b.witness?.level || 'calm'] ?? 2) || (a.witness?.camera === 'off' ? 0 : 1) - (b.witness?.camera === 'off' ? 0 : 1) || b.started_at.localeCompare(a.started_at)), review: g.rows.filter((r) => r.witness?.level === 'review').length, active: g.rows.filter((r) => r.status === 'active').length }))
      .sort((a, b) => b.review - a.review || b.active - a.active || a.label.localeCompare(b.label, 'ar'));
  }, [base, by]);
  const totals = useMemo(() => ({ active: (d?.rows || []).filter((r) => r.status === 'active').length, review: (d?.rows || []).filter((r) => r.witness?.level === 'review').length, camOff: (d?.rows || []).filter((r) => r.status === 'active' && r.witness?.camera === 'off').length, finished: (d?.rows || []).filter((r) => r.status === 'finished').length, places: new Set((d?.rows || []).map((r) => r.place_key)).size, rooms: new Set((d?.rows || []).map((r) => r.room_key)).size }), [d]);

  async function post(body: Record<string, unknown>) { const H = await auth(); return fetch('/api/admin/miaar/hall', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null); }
  async function sendMany(ids: string[]) {
    if (!ids.length || whisper.trim().length < 2) { setErr('اكتب همسة من حرفين على الأقل واختر ممتحنًا واحدًا على الأقل'); return; }
    setBusy(true); const j = await post({ action: 'whisper_many', session_ids: ids, text: whisper }); setBusy(false);
    if (j?.success) { setOk(`أُرسلت الهمسة إلى ${j.sent} — تظهر لهم خلال ثوانٍ`); setWhisper(''); setSel(new Set()); setWhisperOne(null); await load(); } else setErr(j?.error || 'تعذّر الإرسال');
  }
  async function claim(key: string, label: string, release: boolean) { setBusy(true); const j = await post({ action: release ? 'release' : 'claim', key, label }); setBusy(false); if (j?.success) { setOk(release ? 'تركت المجموعة' : `تولّيت «${label}» — اسمك يظهر لبقية المراقبين`); await load(); } else setErr(j?.error || 'تعذّر'); }
  async function setDefault(mode: string) { if (!d) return; if (!window.confirm(`تغيير وضع المراقبة الافتراضي لكل الاختبارات القادمة إلى «${d.modes.find((m) => m.value === mode)?.label || mode}»؟ الدعوات التي حدّدت وضعها لا تتأثّر.`)) return; setBusy(true); const j = await post({ action: 'default_mode', mode }); setBusy(false); if (j?.success) { setOk(`الافتراضي العام الآن: ${j.mode_ar}`); await load(); } else setErr(j?.error || 'تعذّر'); }
  const toggleSel = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectGroup = (rows: Row[]) => setSel((s) => { const n = new Set(s); const ids = rows.filter((r) => r.status === 'active').map((r) => r.session_id); const all = ids.every((i) => n.has(i)); ids.forEach((i) => (all ? n.delete(i) : n.add(i))); return n; });

  if (err && !d) return <section className="am-card" role="alert" data-testid="hall-err"><style>{CSS}</style><p className="hl-err">{err}</p></section>;
  if (!d) return <section className="am-card" data-testid="hall-loading"><style>{CSS}</style><p className="hl-muted">تُفتح القاعة…</p></section>;
  const mine = d.me.name || d.me.email;
  return <div className={`hl${wall ? ' wall' : ''}`} data-testid="hall-root" data-active={totals.active} data-review={totals.review}>
    <style>{CSS}</style>
    <header className="hl-head">
      <div className="hl-title"><span className="hl-kicker">{d.title.ar} · {d.title.en}</span><h2>قاعة الشاهد <small>— {totals.active ? <>يختبر الآن <b data-testid="hall-active">{totals.active}</b></> : 'لا أحد يختبر الآن'}{totals.review ? <em className="hl-rev"> · {totals.review} يستحق المراجعة</em> : null}{totals.camOff ? <em className="hl-cam"> · {totals.camOff} بلا كاميرا</em> : null}{totals.finished ? <span className="hl-fin"> · {totals.finished} انتهى للتوّ</span> : null}</small></h2></div>
      <div className="hl-tools">
        <div className="hl-seg" role="tablist" aria-label="التجميع">{(['single', 'room', 'place'] as GroupBy[]).map((g) => <button key={g} type="button" role="tab" aria-selected={by === g} className={by === g ? 'on' : ''} onClick={() => setBy(g)} data-testid={`hall-by-${g}`}>{d.groups_ar[g]}{g === 'room' && totals.rooms > 1 ? <i>{totals.rooms}</i> : null}{g === 'place' && totals.places > 1 ? <i>{totals.places}</i> : null}</button>)}</div>
        <button type="button" className={`hl-btn${sound ? ' on' : ''}`} onClick={() => { setSound((s) => !s); if (!sound) chime('enter'); }} aria-pressed={sound} title="رنّة عند دخول ممتحن أو تحوّل بلاطة إلى «يستحق المراجعة»" data-testid="hall-sound">{sound ? '🔔 الرنّة تعمل' : '🔕 رنّة'}</button>
        <button type="button" className={`hl-btn${wall ? ' on' : ''}`} onClick={() => { void toggleWall(); }} aria-pressed={wall} data-testid="hall-wall">{wall ? '⤡ خروج من الجدار' : '⤢ وضع الجدار'}</button>
        <button type="button" className="hl-btn" onClick={() => { void load(); }} disabled={busy} aria-label="تحديث الآن">↻</button>
      </div>
    </header>
    {error_bar(err, ok)}
    {toast && <div className="hl-toast" role="status" data-testid="hall-toast">{toast}</div>}

    {!wall && <div className="hl-filters">
      <label>الحالة<select value={fLevel} onChange={(e) => setFLevel(e.target.value as any)} data-testid="hall-f-level"><option value="all">الكلّ</option><option value="review">يستحق المراجعة</option><option value="watch">إشارات</option><option value="calm">هادئ</option></select></label>
      <label>وضع المراقبة<select value={fMode} onChange={(e) => setFMode(e.target.value)} data-testid="hall-f-mode"><option value="all">الكلّ</option>{d.modes.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
      <label className="hl-chk"><input type="checkbox" checked={fCam} onChange={(e) => setFCam(e.target.checked)} data-testid="hall-f-cam" /> الكاميرا منقطعة فقط</label>
      <label className="hl-grow">بحث<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم · بريد · قاعة · مكان" data-testid="hall-q" /></label>
      <div className="hl-default"><span>الافتراضي العام لكل اختبار:</span>{d.me.can_set_default ? <select value={d.default_mode} onChange={(e) => { void setDefault(e.target.value); }} disabled={busy} data-testid="hall-default"><>{d.modes.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</></select> : <b>{d.default_mode_ar}</b>}</div>
    </div>}

    {/* الهمسة الجماعية — تظهر حين يُختار ممتحن أو أكثر */}
    {(sel.size > 0 || whisperOne) && <div className="hl-whisper" data-testid="hall-whisper-bar">
      <Icon name="chat" size={16} /><span>{whisperOne ? <>همسة إلى <b>{whisperOne.name}</b></> : <>همسة جماعية إلى <b>{sel.size}</b> ممتحن</>}</span>
      <input value={whisper} onChange={(e) => setWhisper(e.target.value)} maxLength={200} placeholder="مثال: بقي عشر دقائق — راجعوا إجاباتكم بهدوء" data-testid="hall-whisper-text" onKeyDown={(e) => { if (e.key === 'Enter') void sendMany(whisperOne ? [whisperOne.id] : [...sel]); }} />
      <button type="button" className="hl-btn pri" disabled={busy} onClick={() => { void sendMany(whisperOne ? [whisperOne.id] : [...sel]); }} data-testid="hall-whisper-send">إرسال</button>
      <button type="button" className="hl-btn" onClick={() => { setSel(new Set()); setWhisperOne(null); }}>إلغاء</button>
    </div>}

    {!d.rows.length && <section className="am-card hl-empty" data-testid="hall-empty"><p>القاعة هادئة — لا يختبر أحد الآن.</p><p className="hl-muted">تمتلئ القاعة وحدها لحظة يبدأ أيّ اختبار: فردي بلا دعوة، أو دعوة عامة، أو نهاية مستوى، أو خدمة جهة. يبقى المنتهون {d.recent_min} دقائق بزرّ «حكم الشاهد».</p></section>}

    {groups.map((g) => {
      const claim_ = d.claims[g.key]; const isMine = claim_?.by === mine; const activeIds = g.rows.filter((r) => r.status === 'active').map((r) => r.session_id); const allSel = activeIds.length > 0 && activeIds.every((i) => sel.has(i));
      return <section key={g.key} className="hl-group" data-testid="hall-group" data-key={g.key}>
        {by !== 'single' && <header className="hl-ghead">
          <h3>{g.label} <small>· {g.active} يختبر{g.review ? <em className="hl-rev"> · {g.review} يستحق المراجعة</em> : null}</small></h3>
          <div className="hl-gtools">
            {claim_ && !isMine && <span className="hl-claim" title={`منذ ${hm(claim_.at)}`}>👤 يتولّاها {claim_.by}</span>}
            {isMine && <span className="hl-claim mine">👤 تتولّاها أنت</span>}
            <button type="button" className="hl-btn sm" disabled={busy} onClick={() => { void claim(g.key, g.label, isMine); }} data-testid="hall-claim">{isMine ? 'ترك المجموعة' : claim_ ? 'تولّي بدلًا منه' : 'تولّي المجموعة'}</button>
            {activeIds.length > 0 && <button type="button" className="hl-btn sm" onClick={() => selectGroup(g.rows)} data-testid="hall-select-group">{allSel ? 'إلغاء تحديد الكلّ' : `همسة للجميع (${activeIds.length})`}</button>}
          </div>
        </header>}
        {by === 'single' && activeIds.length > 1 && <div className="hl-ghead slim"><button type="button" className="hl-btn sm" onClick={() => selectGroup(g.rows)} data-testid="hall-select-group">{allSel ? 'إلغاء تحديد الكلّ' : `همسة للجميع (${activeIds.length})`}</button></div>}
        <div className="hl-grid">
          {g.rows.slice(0, 60).map((r) => <Tile key={r.session_id} r={r} selected={sel.has(r.session_id)} onSelect={() => toggleSel(r.session_id)} onWhisper={() => { setWhisperOne({ id: r.session_id, name: r.name }); setSel(new Set()); }} showPlace={by !== 'place'} showRoom={by !== 'room'} />)}
          {g.rows.length > 60 && <p className="hl-muted hl-more">+{g.rows.length - 60} آخرون — ضيّق بالفلاتر أو جمّع حسب القاعات</p>}
        </div>
      </section>;
    })}
    {d.rows.length > 0 && !groups.length && <section className="am-card hl-empty"><p>لا نتائج بهذه الفلاتر.</p></section>}
    <footer className="hl-foot"><span>تحديث كل 15 ثانية · آخر قراءة {hm(d.at)}</span><span>لقطات لا فيديو · لا صوت · لا تحليل آلي · الحكم بتوقيع إنسان</span></footer>
  </div>;
}

function error_bar(err: string, ok: string) { return <>{err && <div className="am-err" role="alert">{err}</div>}{ok && <div className="am-ok" role="status">{ok}</div>}</>; }

function Tile({ r, selected, onSelect, onWhisper, showPlace, showRoom }: { r: Row; selected: boolean; onSelect: () => void; onWhisper: () => void; showPlace: boolean; showRoom: boolean }) {
  const w = r.witness; const lv = w?.level || 'calm'; const total = Math.max(60, r.elapsed_s + r.remaining_s); const pct = Math.min(100, Math.round((r.elapsed_s / total) * 100));
  const start = Date.parse(r.started_at); const span = Math.max(60000, (r.status === 'active' ? Date.now() : Date.parse(r.finished_at || r.started_at)) - start);
  const hidden = w?.counters?.hidden_seconds || 0; const sig = w ? Object.entries(w.counters).filter(([k, v]) => WATCH_KINDS.has(k) && v > 0) : [];
  const finished = r.status === 'finished';
  return <article className={`hl-tile lv-${lv}${finished ? ' done' : ''}${selected ? ' sel' : ''}${w?.camera === 'off' ? ' camoff' : ''}`} data-testid="hall-tile" data-session={r.session_id} data-level={lv} data-status={r.status} data-camera={w?.camera || 'none'} aria-label={`${r.name} — ${LEVEL_AR[lv]}`}>
    <div className="hl-shot">
      {w?.last_frame_url ? <img src={w.last_frame_url} alt="" loading="lazy" /> : <div className="hl-noshot">{r.mode === 'room' ? <><span>قاعة بمراقب</span><small>بلا كاميرا بالتصميم</small></> : w?.camera === 'off' ? <><span>📷 الكاميرا منقطعة</span><small>الاختبار مستمرّ</small></> : <><span>بانتظار أول لقطة</span><small>{r.mode_ar}</small></>}</div>}
      <span className={`hl-lv`} data-testid="hall-tile-level">{LEVEL_AR[lv]}</span>
      {w && w.camera !== 'none' && <span className={`hl-camdot ${w.camera}`} title={w.camera === 'on' ? 'الكاميرا تعمل' : 'الكاميرا منقطعة'} aria-label={w.camera === 'on' ? 'الكاميرا تعمل' : 'الكاميرا منقطعة'} />}
      {!finished && <label className="hl-pick" title="اختيار للهمسة الجماعية"><input type="checkbox" checked={selected} onChange={onSelect} aria-label={`اختيار ${r.name}`} data-testid="hall-tile-pick" /></label>}
      {finished && <span className="hl-donetag">انتهى {hm(r.finished_at)}</span>}
    </div>
    <div className="hl-body">
      <div className="hl-name"><b title={r.email}>{r.name}</b><span>{r.level || r.exam}{r.section ? ` · ${SECTION_AR[r.section] || r.section}` : ''}</span></div>
      <div className="hl-meta">{showRoom && <span title="القاعة/الدعوة">⌂ {r.room_label}</span>}{showPlace && <span title="المكان">⌖ {r.place_label}</span>}<span title="وضع المراقبة">{r.mode_ar}</span></div>
      {!finished && <div className="hl-time" aria-label={`الوقت المتبقّي ${mmss(r.remaining_s)}`}><div className="hl-bar"><i style={{ width: `${pct}%` }} /></div><b className={r.remaining_s < 300 ? 'hl-soon' : ''} data-testid="hall-tile-left">{mmss(r.remaining_s)}</b></div>}
      {/* «النبض»: خطّ زمني مصغّر — كل إشارة نقطة على محور زمن الجلسة */}
      <div className="hl-pulse" aria-label={`النبض: ${w?.signals || 0} إشارة`} title={w?.pulse?.length ? w.pulse.map((p) => `${SIGNAL_AR[p.k] || p.k} ${hm(p.at)}`).join('\n') : 'لا إشارات'}>
        <div className="hl-pulse-line">{(w?.pulse || []).map((p, i) => { const x = Math.min(100, Math.max(0, ((Date.parse(p.at) - start) / span) * 100)); return <i key={i} className={`pk-${p.k}`} style={{ right: `${x}%` }} data-k={p.k} aria-hidden="true" />; })}</div>
        <span className="hl-pulse-n">{w ? <>{w.signals} إشارة{hidden ? ` · ${Math.round(hidden)} ث خارج التبويب` : ''}{w.frames ? ` · ${w.frames} لقطة` : ''}</> : 'بلا شاهد'}</span>
      </div>
      {sig.length > 0 && <div className="hl-sig">{sig.map(([k, v]) => <span key={k} title={SIGNAL_AR[k] || k}>{SIGNAL_ICON[k] || '•'} {v}</span>)}</div>}
      <div className="hl-acts">
        {!finished && <button type="button" className="hl-btn sm" onClick={onWhisper} data-testid="hall-tile-whisper">همسة</button>}
        <a className="hl-btn sm" href={`/admin/miaar/witness?session=${encodeURIComponent(r.session_id)}`} target="_blank" rel="noreferrer" data-testid="hall-tile-room">غرفة الشاهد ↗</a>
        {finished && r.report_id && <a className={`hl-btn sm${r.integrity === 'pending' || !r.integrity ? ' pri' : ''}`} href={`/admin/miaar/witness?session=${encodeURIComponent(r.session_id)}#verdict`} target="_blank" rel="noreferrer" data-testid="hall-tile-verdict">{r.integrity && r.integrity !== 'pending' ? 'الحكم موقَّع ✓' : 'حكم الشاهد ✍'}</a>}
      </div>
    </div>
  </article>;
}

const BADGE_CSS = `
.hl-badge{display:inline-flex;align-items:center;gap:10px;margin:10px 0 0;padding:8px 16px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--navy);font-weight:900;font-size:14px;text-decoration:none;box-shadow:0 4px 14px rgba(15,42,78,.05)}
.hl-badge i{width:10px;height:10px;border-radius:50%;background:#b9c3cf;flex:0 0 auto}
.hl-badge.on{border-color:var(--teal);background:#eefaf8}.hl-badge.on i{background:var(--teal);animation:hlpulse 1.6s ease-out infinite}
.hl-badge.rev{border-color:#b4552b;background:#fff4ee}.hl-badge.rev i{background:#b4552b}
.hl-badge em{font-style:normal;color:#b4552b}
@keyframes hlpulse{0%{box-shadow:0 0 0 0 rgba(11,138,131,.55)}100%{box-shadow:0 0 0 12px rgba(11,138,131,0)}}
@media (prefers-reduced-motion:reduce){.hl-badge.on i{animation:none}}`;

const CSS = `
.hl{display:grid;gap:14px}
.hl-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px}
.hl-kicker{display:block;font-size:11px;font-weight:900;letter-spacing:.12em;color:var(--teal)}
.hl-title h2{margin:4px 0 0;font-size:24px;color:var(--navy)}.hl-title small{font-size:15px;font-weight:700;color:#4b5b6f}.hl-title small b{color:var(--teal);font-size:20px}
.hl-rev{font-style:normal;color:#b4552b;font-weight:900}.hl-cam{font-style:normal;color:#8a6a1f;font-weight:900}.hl-fin{color:#6b7a8f}
.hl-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.hl-seg{display:inline-flex;border:1px solid var(--line);border-radius:999px;background:#fff;padding:3px}
.hl-seg button{border:0;background:transparent;border-radius:999px;padding:7px 14px;font-weight:900;font-size:13px;color:var(--navy);cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.hl-seg button.on{background:var(--navy);color:#fff}.hl-seg button i{font-style:normal;font-size:11px;background:rgba(255,255,255,.25);border-radius:999px;padding:1px 7px}.hl-seg button:not(.on) i{background:#eef2f7}
.hl-btn{border:1px solid var(--line);background:#fff;color:var(--navy);border-radius:999px;padding:8px 14px;font-weight:900;font-size:13px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px;min-height:36px}
.hl-btn.on{background:#eefaf8;border-color:var(--teal)}.hl-btn.pri{background:var(--teal);border-color:var(--teal);color:#fff}.hl-btn.sm{padding:5px 11px;min-height:30px;font-size:12px}.hl-btn:disabled{opacity:.5;cursor:default}
.hl-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;background:#fff;border:1px solid var(--line);border-radius:18px;padding:12px 14px}
.hl-filters label{display:grid;gap:4px;font-size:12px;font-weight:900;color:#4b5b6f}.hl-filters select,.hl-filters input[type=text],.hl-filters input:not([type]){border:1px solid var(--line);border-radius:10px;padding:7px 10px;font:inherit;font-size:13px;min-width:150px}
.hl-filters .hl-chk{display:flex;align-items:center;gap:6px;min-height:36px}.hl-filters .hl-grow{flex:1 1 220px}
.hl-default{margin-inline-start:auto;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:900;color:#4b5b6f}.hl-default select{border:1px solid var(--teal);border-radius:10px;padding:6px 10px;font:inherit;font-size:13px;font-weight:900;color:var(--navy)}
.hl-whisper{position:sticky;top:8px;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:10px;background:var(--navy);color:#fff;border-radius:16px;padding:10px 14px;box-shadow:0 10px 30px rgba(15,42,78,.25)}
.hl-whisper input{flex:1 1 260px;border:0;border-radius:10px;padding:9px 12px;font:inherit;font-size:14px}.hl-whisper .hl-btn{background:transparent;color:#fff;border-color:rgba(255,255,255,.4)}.hl-whisper .hl-btn.pri{background:var(--gold);border-color:var(--gold);color:var(--navy)}
.hl-toast{background:#fff8e6;border:1px solid #e9d7a3;color:#5b4a16;border-radius:12px;padding:10px 14px;font-weight:900;font-size:13px}
.hl-group{display:grid;gap:8px}.hl-ghead{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:6px 4px;border-bottom:2px solid var(--line)}.hl-ghead.slim{border:0;justify-content:flex-end;padding:0}
.hl-ghead h3{margin:0;font-size:17px;color:var(--navy)}.hl-ghead small{font-size:13px;color:#4b5b6f;font-weight:700}.hl-gtools{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.hl-claim{font-size:12px;font-weight:900;color:#4b5b6f;background:#eef2f7;border-radius:999px;padding:4px 10px}.hl-claim.mine{background:#eefaf8;color:var(--teal)}
.hl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.hl-tile{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;display:grid;grid-template-rows:auto 1fr;min-width:0;box-shadow:0 4px 14px rgba(15,42,78,.04);transition:box-shadow .2s}
.hl-tile.lv-review{border-color:#b4552b;box-shadow:0 0 0 3px rgba(180,85,43,.15)}.hl-tile.lv-watch{border-color:#c9a24b}.hl-tile.sel{outline:3px solid var(--teal);outline-offset:-1px}.hl-tile.done{opacity:.82;border-style:dashed}
.hl-shot{position:relative;aspect-ratio:4/3;background:#0f2a4e;display:grid;place-items:center;overflow:hidden}.hl-shot img{width:100%;height:100%;object-fit:cover;display:block}
.hl-noshot{color:#d7e2ee;text-align:center;display:grid;gap:4px;padding:10px}.hl-noshot span{font-weight:900;font-size:13px}.hl-noshot small{font-size:11px;opacity:.8}
.hl-lv{position:absolute;top:8px;right:8px;font-size:11px;font-weight:900;border-radius:999px;padding:3px 9px;background:rgba(255,255,255,.92);color:var(--navy)}.lv-review .hl-lv{background:#b4552b;color:#fff}.lv-watch .hl-lv{background:#c9a24b;color:#1b1b1b}
.hl-camdot{position:absolute;bottom:8px;right:8px;width:12px;height:12px;border-radius:50%;border:2px solid #fff}.hl-camdot.on{background:#1f9d6a}.hl-camdot.off{background:#b4552b;animation:hlblink 1.2s steps(2) infinite}
.hl-pick{position:absolute;top:6px;left:8px;background:rgba(255,255,255,.92);border-radius:8px;padding:2px 4px;display:flex}.hl-pick input{width:18px;height:18px;margin:0;cursor:pointer}
.hl-donetag{position:absolute;bottom:8px;left:8px;font-size:11px;font-weight:900;background:rgba(255,255,255,.92);color:var(--navy);border-radius:999px;padding:3px 9px}
.hl-body{display:grid;gap:7px;padding:10px 12px 12px;min-width:0}
.hl-name{display:flex;justify-content:space-between;gap:8px;align-items:baseline;min-width:0}.hl-name b{font-size:15px;color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hl-name span{font-size:12px;font-weight:900;color:var(--teal);white-space:nowrap}
.hl-meta{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:11px;color:#4b5b6f;font-weight:700}.hl-meta span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.hl-time{display:flex;align-items:center;gap:8px}.hl-bar{flex:1;height:6px;border-radius:999px;background:#eef2f7;overflow:hidden}.hl-bar i{display:block;height:100%;background:var(--teal);border-radius:999px}.hl-time b{font-variant-numeric:tabular-nums;font-size:13px;color:var(--navy)}.hl-soon{color:#b4552b}
.hl-pulse{display:grid;gap:3px}.hl-pulse-line{position:relative;height:14px;border-radius:999px;background:linear-gradient(90deg,#eef2f7,#f7f9fc)}
.hl-pulse-line i{position:absolute;top:3px;width:8px;height:8px;border-radius:50%;background:#8a97a8;transform:translateX(50%)}
.hl-pulse-line i.pk-tab_hidden,.hl-pulse-line i.pk-focus_lost{background:#c9a24b}.hl-pulse-line i.pk-camera_lost,.hl-pulse-line i.pk-paste,.hl-pulse-line i.pk-screen_extended{background:#b4552b}.hl-pulse-line i.pk-fullscreen_exit,.hl-pulse-line i.pk-still_frame{background:#d98a3a}.hl-pulse-line i.pk-whisper{background:var(--teal)}.hl-pulse-line i.pk-section_start{background:var(--navy);width:3px;border-radius:2px;top:2px;height:10px}.hl-pulse-line i.pk-camera_back{background:#1f9d6a}
.hl-pulse-n{font-size:11px;color:#6b7a8f;font-weight:700}
.hl-sig{display:flex;flex-wrap:wrap;gap:4px}.hl-sig span{font-size:11px;font-weight:900;background:#fff4ee;color:#8a3d1a;border-radius:999px;padding:2px 8px}
.hl-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.hl-empty{text-align:center;padding:36px 16px}.hl-empty p{margin:4px 0;font-weight:900;color:var(--navy)}.hl-muted{color:#6b7a8f;font-size:13px;font-weight:700}.hl-more{grid-column:1/-1;text-align:center}.hl-err{color:#b4552b;font-weight:900}
.hl-foot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;font-size:11px;color:#6b7a8f;font-weight:700;padding:4px 2px}
.hl.wall{position:fixed;inset:0;z-index:2000;background:#071a33;padding:18px 22px;overflow:auto;gap:12px;align-content:start}
.hl.wall .hl-title h2,.hl.wall .hl-title small,.hl.wall .hl-ghead h3,.hl.wall .hl-ghead small,.hl.wall .hl-foot{color:#fff}.hl.wall .hl-title small b{color:#8be0d9}.hl.wall .hl-kicker{color:#8be0d9}
.hl.wall .hl-ghead{border-color:rgba(255,255,255,.2)}.hl.wall .hl-grid{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}.hl.wall .hl-tile{background:#0f2a4e;border-color:rgba(255,255,255,.18);color:#fff}
.hl.wall .hl-name b,.hl.wall .hl-time b{color:#fff}.hl.wall .hl-meta,.hl.wall .hl-pulse-n{color:#c4d0de}.hl.wall .hl-bar{background:rgba(255,255,255,.15)}.hl.wall .hl-pulse-line{background:rgba(255,255,255,.1)}.hl.wall .hl-btn{background:transparent;color:#fff;border-color:rgba(255,255,255,.35)}.hl.wall .hl-btn.pri{background:var(--gold);color:var(--navy);border-color:var(--gold)}
.hl.wall .hl-seg{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.2)}.hl.wall .hl-seg button{color:#fff}.hl.wall .hl-seg button.on{background:#fff;color:var(--navy)}.hl.wall .hl-acts{display:none}.hl.wall .hl-claim{background:rgba(255,255,255,.12);color:#fff}
@keyframes hlblink{to{opacity:.3}}
@media (prefers-reduced-motion:reduce){.hl-camdot.off{animation:none}}
@media (max-width:640px){.hl-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}.hl-default{margin-inline-start:0}}`;
