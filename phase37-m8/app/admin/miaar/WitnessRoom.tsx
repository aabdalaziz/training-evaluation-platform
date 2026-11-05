'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «غرفة الشاهد» (م8): الفرصة الثانية للمراقبة — شريط اللقطات بالزمن · الأحداث مثبَّتة عليه · عرض شرائح · لقطة الهوية بجانب بيانات التسجيل
 *  ثم «حكم الشاهد» بتوقيع بشري: سليم / ملاحظة / لاغٍ (يحجب الشهادة). الصور لا تغادر هذه الغرفة؛ روابطها موقَّعة 10 دقائق.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../../lib/ui/icons';

type Frame = { id?: string; seq: number; kind: string; at: string; url: string | null; meta: Record<string, any> };
type Mark = { id?: string; seq: number; kind: string; kind_ar: string; at: string; meta: Record<string, any> };
type Data = { session: { id: string; status: string; started_at: string; finished_at: string | null; name: string; email: string; id_number: string | null }; invite: any; report: any; exit: any; frames: Frame[]; marks: Mark[]; identity: Frame | null; summary: any; retention_days: number; integrity_ar: Record<string, string> };
const fmt = (s: string | null | undefined) => (s ? new Date(s).toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');
const KIND_ICON: Record<string, string> = { tab_hidden: '👁', focus_lost: '⧉', fullscreen_exit: '⛶', camera_lost: '📷', camera_back: '📷', still_frame: '⏸', screen_extended: '🖥', paste: '📋', section_start: '§', whisper: '💬', verdict: '✍', identity_frame: '🪪' };

export default function WitnessRoom({ auth }: { auth: () => Promise<Record<string, string>> }) {
  const [sid, setSid] = useState<string | null>(null); const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [cur, setCur] = useState(0); const [playing, setPlaying] = useState(false); const [status, setStatus] = useState<'clear' | 'note' | 'invalid' | ''>(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [whisper, setWhisper] = useState('يرجى البقاء داخل إطار الكاميرا');
  const timer = useRef<number | null>(null);
  useEffect(() => { try { setSid(new URLSearchParams(window.location.search).get('session')); } catch { setSid(null); } }, []);
  const load = useCallback(async () => {
    if (!sid) return; const H = await auth();
    const j = await fetch(`/api/admin/miaar/witness?session=${encodeURIComponent(sid)}`, { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    if (!j?.success) { setErr(j?.error || 'تعذّر تحميل الغرفة'); return; } setErr(''); setD(j); setCur((c) => Math.min(c, Math.max(0, (j.frames?.length || 1) - 1)));
  }, [sid, auth]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!d || d.session.status !== 'active') return; const id = window.setInterval(() => { if (!document.hidden) void load(); }, 20000); return () => window.clearInterval(id); }, [d, load]);
  useEffect(() => { if (!playing || !d?.frames.length) { if (timer.current) window.clearInterval(timer.current); return; } timer.current = window.setInterval(() => setCur((c) => (c + 1 >= d.frames.length ? (setPlaying(false), c) : c + 1)), 900); return () => { if (timer.current) window.clearInterval(timer.current); }; }, [playing, d]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (!d?.frames.length) return; if (e.key === 'ArrowLeft') setCur((c) => Math.min(d.frames.length - 1, c + 1)); if (e.key === 'ArrowRight') setCur((c) => Math.max(0, c - 1)); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [d]);
  const jumpTo = (at: string) => { if (!d?.frames.length) return; let best = 0; let bd = Infinity; d.frames.forEach((f, i) => { const dd = Math.abs(Date.parse(f.at) - Date.parse(at)); if (dd < bd) { bd = dd; best = i; } }); setCur(best); setPlaying(false); };
  async function verdict() {
    if (!d?.report?.id || !status) return; if (!window.confirm(`توقيع «حكم الشاهد»: ${d.integrity_ar[status]}؟${status === 'invalid' ? ' — سيُحجب إصدار الشهادة.' : ''}`)) return;
    setBusy(true); const H = await auth(); const j = await fetch('/api/admin/miaar/witness', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verdict', report_id: d.report.id, status, note }) }).then((r) => r.json()).catch(() => null); setBusy(false);
    if (j?.success) { await load(); setOk('وُقّع حكم الشاهد'); } else setErr(j?.error || 'تعذّر الحفظ');
  }
  async function sendWhisper() {
    if (!d || !whisper.trim()) return; const H = await auth(); const j = await fetch('/api/admin/miaar/witness', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'whisper', session_id: d.session.id, text: whisper }) }).then((r) => r.json()).catch(() => null);
    if (j?.success) { setOk('أُرسلت الهمسة — تظهر للمتقدّم خلال ثوانٍ'); await load(); } else setErr(j?.error || 'تعذّر الإرسال');
  }
  if (!sid) return <section className="am-card" data-testid="wr-none"><style>{CSS}</style><p className="wr-muted">افتح هذه الغرفة من لوحة المجموعة (لسان 09) → زرّ «غرفة الشاهد» بجانب المتعلّم.</p><a className="wr-btn" href="/admin/miaar/exit">← لوحة نهاية المستوى</a></section>;
  if (err && !d) return <section className="am-card" role="alert" data-testid="wr-err"><style>{CSS}</style><p className="wr-err">{err}</p><a className="wr-btn" href="/admin/miaar/exit">← لوحة نهاية المستوى</a></section>;
  if (!d) return <section className="am-card"><style>{CSS}</style><p className="wr-muted">جارٍ القراءة…</p></section>;
  const f = d.frames[cur] || null; const s = d.summary; const integ = d.report?.integrity_status || null; const sealed = integ && integ !== 'pending';
  const lvl = s.level === 'review' ? 'bad' : s.level === 'watch' ? 'warn' : 'ok';
  return <div className="wr" data-testid="wr-root"><style>{CSS}</style>
    {ok && <div className="wr-ok" role="status">{ok}</div>}{err && <div className="wr-err" role="alert">{err}</div>}
    <section className="am-card wr-head" data-testid="wr-head">
      <div>
        <p className="wr-k">سجلّ نزاهة الاختبار — مراقبة مصوَّرة · Examination Integrity Record</p>
        <h2>{d.session.name || '—'} <small dir="ltr">{d.session.email}</small></h2>
        <p className="wr-meta">{d.invite ? <>{d.invite.label_ar} · المستوى <b>{d.invite.level}</b> · <span className="wr-pill">{d.invite.mode_ar}</span>{d.invite.client_name && <> · الجهة: <b>{d.invite.client_name}</b></>} · </> : null}
          {d.session.status === 'active' ? <span className="wr-pill warn">يختبر الآن</span> : <>أنهى {fmt(d.session.finished_at)}</>} · بدأ {fmt(d.session.started_at)}{d.session.id_number && <> · رقم الهوية المُدخَل: <code dir="ltr">{d.session.id_number}</code></>}
          {d.exit && <> · الحكم: <b>{d.exit.النتيجة === 'passed' ? 'اجتاز' : d.exit.النتيجة === 'conditional' ? 'مشروط' : d.exit.النتيجة === 'failed' ? 'لم يجتز' : 'قيد التصحيح'}</b>{typeof d.exit.الكلي === 'number' ? ` (${d.exit.الكلي}%)` : ''}</>}</p>
      </div>
      <div className="wr-acts">{d.invite?.id && <a className="wr-btn" href={`/admin/miaar/exit?invite=${encodeURIComponent(d.invite.id)}`}>← لوحة المجموعة</a>}{d.report?.access_code && <a className="wr-btn" href={`/miaar/result/${d.report.access_code}`} target="_blank" rel="noreferrer">بطاقة النتيجة</a>}</div>
    </section>

    <section className="wr-grid">
      <div className="am-card" data-testid="wr-summary">
        <h3>الملخّص <span className={`wr-pill ${lvl}`} data-testid="wr-level">{s.level_ar}</span></h3>
        <div className="wr-kpis">
          {[['لقطات', s.frames], ['مغادرة اللسان', s.tab_hidden], ['ثوانٍ خارج الشاشة', s.hidden_seconds], ['فقدان التركيز', s.focus_lost], ['خروج من ملء الشاشة', s.fullscreen_exit], ['انقطاع الكاميرا', s.camera_lost], ['لا حركة', s.still_frame], ['شاشة ثانية', s.screen_extended], ['لصق', s.paste], ['همسات', s.whispers]].map(([k, v]) => <div key={String(k)} className={`wr-kpi${Number(v) > 0 && k !== 'لقطات' && k !== 'همسات' ? ' hot' : ''}`}><b>{v}</b><span>{k}</span></div>)}
        </div>
        {s.reasons_ar?.length > 0 && <ul className="wr-reasons" data-testid="wr-reasons">{s.reasons_ar.map((r: string) => <li key={r}>{r}</li>)}</ul>}
        <p className="wr-muted">المؤشّرات إشارات لا أحكام — القرار لك أدناه. تُحذف الصور بعد {d.retention_days} يومًا؛ الأحداث والحكم يبقيان.</p>
      </div>
      <div className="am-card" data-testid="wr-identity">
        <h3>لقطة الهوية</h3>
        {d.identity?.url ? <img src={d.identity.url} alt="لقطة الهوية" className="wr-id" /> : <p className="wr-muted">{d.invite?.mode === 'remote' ? 'لم تُلتقط بعد.' : 'غير مطلوبة في هذا الوضع (القاعة بحضور مراقب).'}</p>}
        <p className="wr-muted">المُسجَّل: <b>{d.session.name}</b>{d.session.id_number ? <> · <code dir="ltr">{d.session.id_number}</code></> : null}</p>
      </div>
    </section>

    <section className="am-card" data-testid="wr-film">
      <div className="wr-bar"><h3>شريط اللقطات <small>{d.frames.length}</small></h3>
        <div className="wr-acts">{d.frames.length > 1 && <><button type="button" className="wr-btn" onClick={() => setPlaying((p) => !p)} data-testid="wr-play">{playing ? '⏸ إيقاف' : '▶ عرض'}</button><button type="button" className="wr-btn" onClick={() => setCur((c) => Math.max(0, c - 1))}>‹ السابقة</button><button type="button" className="wr-btn" onClick={() => setCur((c) => Math.min(d.frames.length - 1, c + 1))}>التالية ›</button></>}</div></div>
      {!d.frames.length ? <p className="wr-muted">لا لقطات — إمّا أن الوضع «قاعة بمراقب» أو لم يبدأ المتقدّم بعد.</p> : <div className="wr-view">
        <figure className="wr-big">{f?.url ? <img src={f.url} alt={`لقطة ${f.seq}`} data-testid="wr-big" /> : <div className="wr-purged">حُذفت الصورة (انتهت مدّة الاحتفاظ)</div>}<figcaption>#{f?.seq} · {fmt(f?.at)} · {f?.kind === 'frame' ? 'دورية' : f?.kind === 'identity_frame' ? 'هوية' : f?.kind === 'section_start' ? `بداية قسم ${f?.meta?.section || ''}` : f?.kind === 'tab_hidden' ? `بعد مغادرة ${Math.round(f?.meta?.seconds || 0)} ث` : f?.kind}</figcaption></figure>
        <div className="wr-strip" data-testid="wr-strip">{d.frames.map((x, i) => <button key={x.seq} type="button" className={`wr-th${i === cur ? ' on' : ''}${x.kind !== 'frame' ? ' ev' : ''}`} onClick={() => { setCur(i); setPlaying(false); }} title={`#${x.seq} ${fmt(x.at)} ${x.kind}`} data-testid="wr-thumb">{x.url ? <img src={x.url} alt="" loading="lazy" /> : <span>✕</span>}<i>{x.kind !== 'frame' ? KIND_ICON[x.kind] || '•' : ''}</i></button>)}</div>
      </div>}
    </section>

    <section className="wr-grid">
      <div className="am-card" data-testid="wr-marks">
        <h3>الأحداث <small>{d.marks.length}</small></h3>
        {!d.marks.length ? <p className="wr-muted">لا أحداث مسجَّلة — سير هادئ.</p> : <ul className="wr-events">{d.marks.map((m) => <li key={m.seq}><button type="button" onClick={() => jumpTo(m.at)} title="اقفز إلى أقرب لقطة"><span className="wr-ic">{KIND_ICON[m.kind] || '•'}</span><b>{m.kind_ar}</b>{m.kind === 'tab_hidden' || m.kind === 'focus_lost' ? ` ${Math.round(m.meta?.seconds || 0)} ث` : m.kind === 'paste' ? ` ${m.meta?.chars || 0} حرفًا` : m.kind === 'section_start' ? ` ${m.meta?.section || ''}` : m.kind === 'whisper' ? ` «${m.meta?.text || ''}»` : m.kind === 'verdict' ? ` ${d.integrity_ar[m.meta?.status] || m.meta?.status} — ${m.meta?.by || ''}` : m.kind === 'camera_lost' ? ` (${m.meta?.reason === 'dark' ? 'إطار مظلم' : 'انقطاع'})` : ''}<small>{fmt(m.at)}</small></button></li>)}</ul>}
      </div>
      <div className="am-card" data-testid="wr-verdict">
        <h3>حكم الشاهد</h3>
        {!d.report ? <p className="wr-muted">يظهر هنا بعد أن يُنهي المتقدّم الاختبار (يحتاج تقريرًا).{d.session.status === 'active' && <><br />يمكنك الآن إرسال «همسة»:</>}</p> : sealed ? <div className={`wr-sealed ${integ}`} data-testid="wr-sealed"><b>{d.integrity_ar[integ]}</b>{d.report.integrity_note && <> — {d.report.integrity_note}</>}<br /><small>وقّعه {d.report.integrity_by} · {fmt(d.report.integrity_at)}{integ === 'invalid' ? ' · الشهادة محجوبة' : ''}</small></div> : <>
          <div className="wr-radios">{(['clear', 'note', 'invalid'] as const).map((k) => <label key={k} className={`wr-radio ${k}${status === k ? ' on' : ''}`}><input type="radio" name="verdict" checked={status === k} onChange={() => setStatus(k)} data-testid={`wr-v-${k}`} /> {d.integrity_ar[k]}<small>{k === 'clear' ? 'أُدّي كما ينبغي' : k === 'note' ? 'تُسجَّل مع النتيجة دون إبطال' : 'يحجب الشهادة · يحتاج سببًا'}</small></label>)}</div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} placeholder={status === 'invalid' ? 'سبب الإبطال (إلزامي)' : status === 'note' ? 'نصّ الملاحظة' : 'ملاحظة اختيارية'} data-testid="wr-note" />
          <button type="button" className="wr-btn primary" onClick={() => void verdict()} disabled={busy || !status || ((status === 'note' || status === 'invalid') && note.trim().length < 3)} data-testid="wr-sign"><Icon name="check" size={14} /> توقيع حكم الشاهد</button>
          {(!status || ((status === 'note' || status === 'invalid') && note.trim().length < 3)) && <p className="wr-muted">{!status ? 'اختر الحكم أولًا.' : 'اكتب الملاحظة/السبب (3 أحرف على الأقل) ليُفعَّل التوقيع.'}</p>}
        </>}
        {d.session.status === 'active' && <div className="wr-whisper"><label>همسة المراقب <small>تظهر على شاشة المتقدّم بهدوء خلال ~20 ث</small><input value={whisper} onChange={(e) => setWhisper(e.target.value)} maxLength={160} data-testid="wr-whisper" /></label><button type="button" className="wr-btn" onClick={() => void sendWhisper()} disabled={whisper.trim().length < 2} data-testid="wr-whisper-send">إرسال</button></div>}
      </div>
    </section>
    <p className="wr-foot">الذكاء الاصطناعي لا يحكم هنا؛ المؤشّرات حُسبت في متصفح المتقدّم دون أي نموذج، والصور لا تُرسل لأي طرف ثالث. المتقدّم رأى المؤشّرات نفسها أثناء الاختبار («شريط نزاهتك»).</p>
  </div>;
}

const CSS = `
.wr{display:grid;gap:14px}.wr-k{margin:0;color:#b8860b;font-weight:800;font-size:12px}.wr h2{margin:4px 0;font-size:20px;color:#0f2a4e}.wr h2 small{font-weight:500;color:#64748b;font-size:13px}.wr h3{margin:0 0 10px;font-size:16px;color:#0f2a4e;display:flex;align-items:center;gap:8px}.wr h3 small{color:#64748b;font-weight:600}
.wr-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}.wr-meta{margin:0;color:#475569;font-size:13px;line-height:1.9}.wr-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.wr-btn{border:1px solid #cbd5e1;background:#fff;color:#0f2a4e;border-radius:10px;padding:7px 12px;font-weight:800;cursor:pointer;font-family:inherit;text-decoration:none;font-size:13px;display:inline-flex;gap:6px;align-items:center}.wr-btn.primary{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.wr-btn:disabled{opacity:.5;cursor:not-allowed}
.wr-pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:900;background:#e2e8f0;color:#0f2a4e}.wr-pill.ok{background:#dcfce7;color:#166534}.wr-pill.warn{background:#fef3c7;color:#92400e}.wr-pill.bad{background:#fee2e2;color:#991b1b}
.wr-grid{display:grid;grid-template-columns:2fr 1fr;gap:14px}.wr-grid .am-card{min-width:0}
.wr-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}.wr-kpi{border:1px solid #e2e8f0;border-radius:12px;padding:8px;text-align:center;display:grid;gap:2px}.wr-kpi b{font-size:20px;color:#0f2a4e}.wr-kpi span{font-size:11.5px;color:#64748b}.wr-kpi.hot{border-color:#fcd34d;background:#fffbeb}
.wr-reasons{margin:10px 0 0;padding-inline-start:18px;color:#92400e;font-size:13px}.wr-muted{color:#64748b;font-size:13px;margin:8px 0 0;line-height:1.8}.wr-err{color:#b91c1c;font-weight:800;margin:0}.wr-ok{background:#dcfce7;color:#166534;border-radius:12px;padding:8px 12px;font-weight:800}
.wr-id{width:100%;max-width:320px;border-radius:12px;border:1px solid #e2e8f0;display:block}
.wr-bar{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}
.wr-view{display:grid;gap:10px}.wr-big{margin:0;display:grid;gap:6px;justify-items:center}.wr-big img{width:min(100%,480px);aspect-ratio:4/3;object-fit:cover;border-radius:14px;border:1px solid #e2e8f0;background:#0f172a}.wr-big figcaption{font-size:13px;color:#475569}.wr-purged{width:min(100%,480px);aspect-ratio:4/3;display:grid;place-items:center;background:#f1f5f9;color:#64748b;border-radius:14px}
.wr-strip{display:flex;gap:6px;overflow-x:auto;padding:6px 2px}.wr-th{position:relative;flex:0 0 auto;width:72px;height:54px;border:2px solid transparent;border-radius:8px;padding:0;background:#f1f5f9;cursor:pointer;overflow:hidden}.wr-th img{width:100%;height:100%;object-fit:cover;display:block}.wr-th.on{border-color:#c9a24b}.wr-th.ev{box-shadow:inset 0 0 0 2px #f59e0b}.wr-th i{position:absolute;inset-inline-start:2px;bottom:2px;font-style:normal;font-size:12px;background:rgba(255,255,255,.9);border-radius:6px;padding:0 3px}
.wr-events{list-style:none;margin:0;padding:0;display:grid;gap:4px;max-height:360px;overflow:auto}.wr-events button{width:100%;text-align:start;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:6px 10px;cursor:pointer;font-family:inherit;font-size:13px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.wr-events small{margin-inline-start:auto;color:#64748b}.wr-ic{width:22px;text-align:center}
.wr-radios{display:grid;gap:6px;margin-bottom:8px}.wr-radio{border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;cursor:pointer;font-weight:800}.wr-radio small{flex-basis:100%;font-weight:500;color:#64748b;padding-inline-start:26px}.wr-radio.on.clear{border-color:#86efac;background:#f0fdf4}.wr-radio.on.note{border-color:#fcd34d;background:#fffbeb}.wr-radio.on.invalid{border-color:#fca5a5;background:#fef2f2}
.wr textarea,.wr-whisper input{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font-family:inherit;font-size:14px;box-sizing:border-box;margin-bottom:8px}
.wr-sealed{border-radius:12px;padding:10px 12px;font-size:14px;line-height:1.8}.wr-sealed.clear{background:#f0fdf4;color:#14532d}.wr-sealed.note{background:#fffbeb;color:#78350f}.wr-sealed.invalid{background:#fef2f2;color:#7f1d1d}
.wr-whisper{margin-top:12px;border-top:1px dashed #e2e8f0;padding-top:10px;display:grid;gap:6px}.wr-whisper label{font-weight:800;font-size:13px;display:grid;gap:4px}.wr-whisper small{font-weight:500;color:#64748b}
.wr-foot{color:#64748b;font-size:12.5px;margin:0;line-height:1.8}
@media (max-width:900px){.wr-grid{grid-template-columns:1fr}}
`;
