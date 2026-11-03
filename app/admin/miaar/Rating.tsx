'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «غرفة التصحيح» (م4-ب) + «هيئة التصحيح» (م4-ج) — لسان 06 في /admin/miaar/rating
 *  طابور الأداءات (بلا اسم ولا بريد) → تفصيل: النص أو مشغّل صوت (رابط موقَّع 5 دقائق) · سُلّم التقدير بالأبعاد 0–5 · «عيّنة المصحّح»
 *  م4-ج: قراءات متعدّدة (الأولى · الثانية عمياء · التحكيم) · قاعدة الاتفاق · «مرآتي» · «تأهيلي» على المراسي · مربّع النسخ (بشري أو مسودّة بموافقة المتقدّم)
 *  · حذف الصوت بعد 180 يومًا · المصحّح (دور RATER) يرى هذه الغرفة وحدها.
 *  الأسماء الرسمية: القراءة · التحكيم · الإصدار · سحب الإصدار · المرساة · الاعتماد. القاعدة: لا درجة تُنشر قبل إنسان، ولا يرى مصحّح قراءةَ غيره قبل أن يرسل.
 */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../lib/ui/icons';

type Filter = 'pending' | 'second' | 'adjudicate' | 'released' | 'anchors' | 'all';
type Row = { id: string; skill: 'writing' | 'speaking'; status: string; item_code: string; level_target: string; word_count: number | null; duration_sec: number | null; accommodation: string | null; ai_consent: boolean; has_ai: boolean; created_at: string; released_at: string | null; session_short: string; receptive_level: string | null;
  second_reading: boolean; adjudication: string | null; is_anchor: boolean; readings: number; my_reading: number | null; has_transcript: boolean; media_purged: boolean };
type ReadingView = { reading: number; band: number; mean: number | null; scores: Record<string, number>; note_ar: string | null; mine: boolean; rater: string; created_at?: string };
type Detail = Row & { text_answer: string | null; transcript: string | null; transcript_source: string | null; audio_url: string | null; media_mime: string | null; media_purged_at: string | null; human_rating: any; ai_rating: any; rater_note_ar: string | null; anchor_band: number | null; blind: boolean; task: { prompt: string; level: string; task: any } | null; dimensions: { key: string; ar: string }[]; bands: { dimension: string; score: number; dimension_ar: string; text_ar: string }[];
  readings: ReadingView[]; my_reading: { reading: number; band: number; scores: Record<string, number>; note_ar: string | null } | null; next: { reading: number | null; ar?: string; why_ar?: string }; can_release: boolean; release_block_ar: string | null; fluency: { words: number; wpm: number | null; fillers: number } | null; actor_kind: 'staff' | 'rater' };
type Calibration = { n: number; kappa: number | null; passed: boolean; need: number; ar: string; exempt: boolean; locked_until: string | null; staff: boolean };
type Mirror = { n: number; n_pairs: number; severity: number | null; severity_ar: string; kappa: number | null; kappa_ar: string; avg_seconds: number | null; adjudication_rate: number | null };
const LEVEL_AR: Record<string, string> = { PRE_A1: 'ما قبل A1', A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' };
const STATUS_AR: Record<string, string> = { submitted: 'جديد', ai_rated: 'اقتراح آلي جاهز', rated: 'مقدَّر — لم يُصدر', released: 'صادر', skipped: 'لم يُقدَّم' };
const SKILL_AR = { writing: 'كتابة', speaking: 'تحدّث' };
const READING_AR: Record<number, string> = { 0: 'تأهيل', 1: 'الأولى', 2: 'الثانية', 3: 'التحكيم' };

export default function Rating({ auth }: { auth: () => Promise<Record<string, string>> }) {
  const [filter, setFilter] = useState<Filter>('pending'); const [rows, setRows] = useState<Row[]>([]); const [counts, setCounts] = useState<Record<string, number>>({}); const [cal, setCal] = useState<Calibration | null>(null); const [mirror, setMirror] = useState<Mirror | null>(null); const [kind, setKind] = useState<'staff' | 'rater'>('staff');
  const [sel, setSel] = useState<Detail | null>(null); const [scores, setScores] = useState<Record<string, number>>({}); const [note, setNote] = useState(''); const [tr, setTr] = useState(''); const [trDraft, setTrDraft] = useState(false); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(''); const [exempt, setExempt] = useState({ email: '', note: '' });
  const openedAt = useRef<number>(0);
  async function load(f = filter) { const j = await fetch(`/api/admin/miaar/rating?status=${f}`, { headers: await auth(), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.success) { setErr(j?.error || 'تعذّر تحميل الطابور'); return; } setRows(j.rows || []); setCounts(j.counts || {}); setCal(j.calibration || null); setMirror(j.mirror || null); setKind(j.actor_kind === 'rater' ? 'rater' : 'staff'); }
  async function open(id: string) { setErr(''); const j = await fetch(`/api/admin/miaar/rating?id=${id}`, { headers: await auth(), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.success) { setErr(j?.error || 'تعذّر فتح الأداء'); return; } const d = j.performance as Detail; setSel(d); setScores(d.my_reading?.scores || (d.blind ? {} : d.human_rating?.scores) || {}); setNote(d.my_reading?.note_ar || (d.blind ? '' : d.rater_note_ar) || ''); setTr(d.transcript || ''); setTrDraft(false); openedAt.current = Date.now(); }
  async function post(body: Record<string, unknown>) { setBusy(String(body.action)); setErr(''); setOk(''); try { const j = await fetch('/api/admin/miaar/rating', { method: 'POST', headers: await auth(), body: JSON.stringify(body) }).then((r) => r.json()); if (!j?.success) { setErr(j?.error || 'تعذّر التنفيذ'); return null; } setOk(j.note_ar || 'تم'); return j; } finally { setBusy(''); }
  }
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const complete = sel ? sel.dimensions.every((d) => Number.isInteger(scores[d.key])) : false;
  const pending = (counts.submitted || 0) + (counts.ai_rated || 0) + (counts.rated || 0);
  const canRead = !!sel && sel.next.reading != null; const isCalibRead = sel?.next.reading === 0;
  async function rate(release: boolean, force = false) { if (!sel) return; const seconds = Math.round((Date.now() - openedAt.current) / 1000); const j = await post({ action: 'rate', id: sel.id, scores, note, release, seconds, force }); if (j) { await load(); await open(sel.id); } }
  async function act(body: Record<string, unknown>) { if (!sel) return; const j = await post({ ...body, id: sel.id }); if (j) { await load(); await open(sel.id); } return j; }
  async function suggest() { if (!sel) return; const j = await post({ action: 'ai_suggest', id: sel.id }); if (j?.rating) { await open(sel.id); } }
  async function draft() { if (!sel) return; const j = await post({ action: 'transcript_draft', id: sel.id }); if (j?.draft) { setTr(j.draft); setTrDraft(true); } }
  const filters: [Filter, string][] = kind === 'staff' ? [['pending', 'بانتظار التصحيح'], ['second', 'قراءة ثانية'], ['adjudicate', 'تحكيم'], ['released', 'الصادر'], ['anchors', 'المراسي'], ['all', 'الكل']] : [['pending', 'بانتظار التصحيح'], ['second', 'قراءة ثانية'], ['released', 'الصادر'], ['all', 'الكل']];
  const uncal = !!cal && !cal.passed;
  return (
    <div className="rt" data-testid="mi-rating" data-kind={kind}>
      <style>{CSS}</style>
      {err && <div className="am-err" role="alert">{err}</div>}{ok && <div className="am-ok" role="status" data-testid="rt-ok">{ok}</div>}
      <section className="am-card rt-head">
        <div><h3>غرفة التصحيح <small>أداءات الكتابة والتحدّث — يقرؤها ويسمعها إنسان، والبطاقة تكتمل على الرمز نفسه</small></h3>
          <p className="mm-note">بانتظار التصحيح: <b data-testid="rt-pending">{pending}</b> · بانتظار قراءة ثانية: <b data-testid="rt-second">{counts.second_pending || 0}</b> · يحتاج تحكيمًا: <b data-testid="rt-adj">{counts.adjudication_needed || 0}</b> · صادر: <b>{counts.released || 0}</b> · مراسٍ: {counts.anchors || 0}. لا اسم ولا بريد هنا — المصحّح يرى الأداء فقط، ولا يرى قراءة غيره قبل أن يرسل.</p></div>
        {!uncal && <div className="rt-filters" role="tablist" aria-label="تصفية">{filters.map(([f, l]) => <button key={f} type="button" role="tab" aria-selected={filter === f} className={`am-btn${filter === f ? ' on' : ' ghost'}`} onClick={() => { setFilter(f); void load(f); }} data-testid={`rt-filter-${f}`}>{l}</button>)}</div>}
      </section>
      <section className="rt-strip">
        <div className={`am-card rt-cal ${cal?.passed ? 'ok' : 'wait'}`} data-testid="rt-calibration" aria-live="polite">
          <b>{kind === 'rater' ? 'تأهيلي' : 'اعتماد المصحّحين'}</b>
          <p>{cal?.staff ? 'الطاقم معفى بحكم الدور. المصحّح الجديد (دور «المصحّح») يقرأ 5 مراسٍ عمياء ويُعتمد إذا بلغ كابا ≥ 0.6 — عيِّن المراسي من أداء صادر متّفق عليه.' : uncal ? <>قبل الطابور الحقيقي: اقرأ المراسي الخمس أدناه (عمياء) — <b>{cal?.ar}</b></> : <>{cal?.ar}</>}</p>
          {kind === 'staff' && <details className="rt-exempt"><summary>إعفاء مصحّح من التأهيل (مقيَّد)</summary><div className="rt-exrow"><input type="email" placeholder="بريد المصحّح" value={exempt.email} onChange={(e) => setExempt({ ...exempt, email: e.target.value })} aria-label="بريد المصحّح" data-testid="rt-exempt-email" /><input placeholder="السبب (يُقيَّد)" value={exempt.note} onChange={(e) => setExempt({ ...exempt, note: e.target.value })} aria-label="سبب الإعفاء" /><button type="button" className="am-btn ghost small" disabled={!!busy || !exempt.email} onClick={async () => { const j = await post({ action: 'calibration_exempt', ...exempt }); if (j) setExempt({ email: '', note: '' }); }} data-testid="rt-exempt">أعفِ</button></div></details>}
        </div>
        <div className="am-card rt-mirror" data-testid="rt-mirror">
          <b>مرآتي <small>خاصّة بك — لا ترتيب ولا لوحة شرف</small></b>
          {mirror ? <ul><li><span>قراءاتي</span><i>{mirror.n}</i></li><li><span>أداءات مشتركة مع زميل</span><i>{mirror.n_pairs}</i></li><li><span>ميلي</span><i>{mirror.severity_ar}</i></li><li><span>اتفاقي مع زملائي (كابا)</span><i>{mirror.kappa ?? '—'} · {mirror.kappa_ar}</i></li><li><span>متوسّط زمن القراءة</span><i>{mirror.avg_seconds != null ? `${mirror.avg_seconds} ث` : '—'}</i></li></ul> : <p className="mm-note">—</p>}
          {kind === 'staff' && <button type="button" className="am-btn ghost small" disabled={!!busy} onClick={async () => { const j = await post({ action: 'purge' }); if (j) await load(); }} data-testid="rt-purge"><Icon name="trash" size={14} /> احذف الصوت المستحقّ (180 يومًا)</button>}
        </div>
      </section>
      <div className="rt-split">
        <section className="am-card rt-queue" aria-label="الطابور">
          {!rows.length ? <div className="am-empty" data-testid="rt-empty">{uncal ? 'لا مراسٍ متاحة لك الآن — اطلب من مدير الجودة تعيين مراسٍ، أو انتظر انقضاء قفل التأهيل.' : 'لا أداءات هنا. تظهر حين يسلّم متقدّم مهمة من «غرفة الأداء» بعد بطاقته.'}</div> : <table className="mm-t" data-testid="rt-table"><thead><tr><th>المهارة</th><th>المهمة</th><th>المستوى</th><th>الطول</th><th>الحالة</th><th /></tr></thead><tbody>
            {rows.map((r) => <tr key={r.id} className={sel?.id === r.id ? 'on' : ''} data-testid={`rt-row-${r.skill}`} data-second={r.second_reading ? '1' : '0'} data-adj={r.adjudication || ''} data-anchor={r.is_anchor ? '1' : '0'}>
              <td><b>{SKILL_AR[r.skill]}</b>{r.accommodation && <small className="rt-acc">تيسير</small>}{r.ai_consent && <small className="rt-ai" title="وافق على مساعدة الذكاء الاصطناعي">AI</small>}{r.is_anchor && <small className="rt-tag anchor">مرساة</small>}</td>
              <td><code dir="ltr">{r.item_code}</code></td>
              <td>{LEVEL_AR[r.level_target] || r.level_target}{r.receptive_level && <small className="rt-recep"> · استقبالي {LEVEL_AR[r.receptive_level] || r.receptive_level}</small>}</td>
              <td>{r.word_count != null ? `${r.word_count} كلمة` : r.duration_sec != null ? `${r.duration_sec} ث` : '—'}{r.media_purged && <small className="rt-recep"> · حُذف الصوت</small>}</td>
              <td><span className={`rt-st ${r.status}`}>{STATUS_AR[r.status] || r.status}</span>{r.adjudication === 'needed' ? <small className="rt-tag adj">يحتاج تحكيمًا</small> : r.second_reading && r.readings < 2 && r.status === 'rated' ? <small className="rt-tag second">بانتظار قراءة ثانية</small> : null}{r.my_reading != null && <small className="rt-tag mine">قرأتُه ({READING_AR[r.my_reading]})</small>}{r.readings > 1 && <small className="rt-tag">قراءتان</small>}</td>
              <td><button type="button" className="am-btn small" onClick={() => void open(r.id)} data-testid="rt-open">{r.status === 'released' ? 'عرض' : r.my_reading != null ? 'عرض' : 'قيّم'}</button></td>
            </tr>)}
          </tbody></table>}
        </section>
        <section className="am-card rt-detail" aria-live="polite">
          {!sel ? <div className="am-empty">اختر أداءً من الطابور.</div> : <div data-testid="rt-detail" data-blind={sel.blind ? '1' : '0'}>
            <header className="rt-dhead"><div><p className="mm-kicker">{SKILL_AR[sel.skill]} · مستوى المهمة {LEVEL_AR[sel.level_target] || sel.level_target}{sel.receptive_level ? ` · الاستقبالي ${LEVEL_AR[sel.receptive_level] || sel.receptive_level}` : ''}{sel.is_anchor ? ' · مرساة' : ''}</p><h4>{sel.task?.prompt || sel.item_code}</h4>{sel.accommodation && <p className="mm-note">تيسير: {sel.accommodation === 'typed_instead_of_speaking' ? 'كتب بدل أن يتحدّث' : 'تحدّث بدل أن يكتب'}</p>}</div><span className={`rt-st ${sel.status}`}>{STATUS_AR[sel.status]}</span></header>
            {sel.blind && <p className="rt-blind" data-testid="rt-blind"><Icon name="shield" size={14} /> قراءة عمياء: لن ترى قراءة غيرك{isCalibRead ? ' ولا درجة المرساة' : ''} حتى ترسل قراءتك.</p>}
            {sel.task?.task?.sample_ar && <details className="rt-sample"><summary>إجابة نموذجية للمصحّح (لا يراها المتقدّم)</summary><p dir="rtl">{sel.task.task.sample_ar}</p></details>}
            {sel.text_answer && <blockquote className="rt-text" dir="rtl" lang="ar" data-testid="rt-text">{sel.text_answer}</blockquote>}
            {sel.audio_url && <div className="rt-audio"><audio controls src={sel.audio_url} preload="metadata" data-testid="rt-audio" /><small>{sel.duration_sec} ث · الرابط صالح 5 دقائق · يُحذف الصوت بعد 180 يومًا</small></div>}
            {sel.media_purged_at && <p className="mm-note" data-testid="rt-purged">حُذف التسجيل الصوتي بعد 180 يومًا ({new Date(sel.media_purged_at).toLocaleDateString('ar-SA')}) — بقي النسخ والتقدير.</p>}
            {!sel.text_answer && !sel.audio_url && !sel.media_purged_at && <div className="am-empty">لا محتوى (ربما انتهت صلاحية الملف).</div>}
            {(sel.skill === 'speaking' || sel.accommodation === 'spoken_instead_of_writing') && (sel.audio_url || sel.media_purged_at || sel.transcript) && <div className="rt-tr" data-testid="rt-transcript">
              <label>النسخ <small>{sel.transcript_source === 'ai_draft' ? 'مسودّة راجعها مصحّح' : sel.transcript_source === 'human' ? 'نسخ بشري' : 'اكتب ما تسمعه حرفيًّا — يبقى مع المتقدّم بعد حذف الصوت'}</small><textarea value={tr} onChange={(e) => setTr(e.target.value)} rows={4} maxLength={6000} dir="rtl" lang="ar" data-testid="rt-tr-text" /></label>
              <div className="rt-actions">{sel.ai_consent && sel.audio_url && <button type="button" className="am-btn ghost small" disabled={!!busy} onClick={draft} data-testid="rt-tr-draft"><Icon name="spark" size={14} /> {busy === 'transcript_draft' ? 'ينسخ…' : 'مسودّة من المزوّد (بموافقة المتقدّم)'}</button>}<button type="button" className="am-btn small" disabled={!!busy || tr.trim().length < 2} onClick={() => act({ action: 'transcript', text: tr, from_draft: trDraft })} data-testid="rt-tr-save">احفظ النسخ</button>{sel.fluency && <small className="rt-flu" data-testid="rt-fluency">{sel.fluency.words} كلمة{sel.fluency.wpm != null ? ` · ${sel.fluency.wpm} كلمة/دقيقة` : ''} · تردّدات {sel.fluency.fillers} — إشارة للطلاقة لا درجة</small>}</div>
            </div>}
            {sel.ai_rating && !sel.blind && <div className="rt-aibox" data-testid="rt-aibox"><b>عيّنة المصحّح (اقتراح آلي — ليس قرارًا)</b><p>{sel.dimensions.map((d) => `${d.ar}: ${sel.ai_rating.scores?.[d.key]}`).join(' · ')} · ثقة {Math.round((sel.ai_rating.confidence || 0) * 100)}%</p>{Array.isArray(sel.ai_rating.evidence) && <ul>{sel.ai_rating.evidence.map((e: string, i: number) => <li key={i}>«{e}»</li>)}</ul>}<p>{sel.ai_rating.next_step_ar}</p>{canRead && <button type="button" className="am-btn ghost small" onClick={() => setScores({ ...sel.ai_rating.scores })}>انسخ الاقتراح إلى السُّلّم (ثم عدّل)</button>}</div>}
            {sel.readings.length > 0 && <div className="rt-reads" data-testid="rt-readings"><b>القراءات</b><ul>{sel.readings.map((r, i) => <li key={i}><span>{READING_AR[r.reading]} · {r.rater}</span><i>الدرجة {r.band}{r.mean != null ? ` (${r.mean})` : ''}</i>{r.note_ar && <q>{r.note_ar}</q>}</li>)}</ul>{sel.human_rating?.agreement && <p className="mm-note" data-testid="rt-agreement">الاتفاق: <b>{sel.human_rating.agreement.kind === 'agree' ? 'تامّ' : sel.human_rating.agreement.kind === 'average' ? 'فرق درجة — اعتُمد المتوسّط' : sel.human_rating.agreement.kind === 'adjudicated' ? 'حُكم بقراءة ثالثة' : 'فرق درجتين — تحكيم'}</b></p>}</div>}
            <h5>{canRead ? sel.next.ar : 'التقدير البشري بالأبعاد'} <small>0 = لا إنتاج يُقيَّم · 3 = يحقّق مستوى المهمة · 5 = يتجاوزه بوضوح{!canRead && sel.next.why_ar ? ` — ${sel.next.why_ar}` : ''}</small></h5>
            <div className="rt-dims">{sel.dimensions.map((d) => <fieldset key={d.key} className="rt-dim" data-testid={`rt-dim-${d.key}`}><legend>{d.ar}</legend>
              <div className="rt-scale" role="radiogroup" aria-label={d.ar}>{[0, 1, 2, 3, 4, 5].map((n) => { const band = sel.bands.find((b) => b.dimension === d.key && b.score === n); return <button key={n} type="button" role="radio" aria-checked={scores[d.key] === n} className={`rt-sc${scores[d.key] === n ? ' on' : ''}`} title={band?.text_ar || ''} onClick={() => setScores((s) => ({ ...s, [d.key]: n }))} disabled={!canRead}>{n}</button>; })}</div>
              <p className="rt-band">{sel.bands.find((b) => b.dimension === d.key && b.score === scores[d.key])?.text_ar || 'اختر درجة لترى وصفها'}</p>
            </fieldset>)}</div>
            <label className="rt-note">ما يقوله المصحّح للمتقدّم (يظهر في البطاقة — جملة أو جملتان دافئتان ومحدّدتان)<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={600} disabled={!canRead} data-testid="rt-note" /></label>
            <div className="rt-actions">
              {canRead && <>
                {sel.ai_consent && (sel.text_answer || sel.transcript) && <button type="button" className="am-btn ghost" disabled={!!busy} onClick={suggest} data-testid="rt-suggest"><Icon name="spark" size={16} /> {busy === 'ai_suggest' ? 'يقترح…' : 'عيّنة المصحّح (اقتراح آلي)'}</button>}
                <button type="button" className="am-btn ghost" disabled={!complete || !!busy} onClick={() => rate(false)} data-testid="rt-save">{isCalibRead ? 'أرسل قراءة التأهيل' : 'احفظ قراءتي'}</button>
                {!isCalibRead && <button type="button" className="am-btn" disabled={!complete || !!busy} onClick={() => rate(true)} data-testid="rt-release"><Icon name="check" size={16} /> احفظ وأصدر إلى البطاقة</button>}
              </>}
              {!canRead && sel.status === 'rated' && (sel.can_release ? <button type="button" className="am-btn" disabled={!!busy} onClick={() => act({ action: 'release' })} data-testid="rt-release-now"><Icon name="check" size={16} /> أصدر إلى البطاقة</button> : <><span className="rt-block" data-testid="rt-block">{sel.release_block_ar}</span>{sel.actor_kind === 'staff' && <button type="button" className="am-btn ghost" disabled={!!busy} onClick={() => { if (window.confirm(`الإصدار رغم: ${sel.release_block_ar}؟ يُقيَّد باسمك.`)) void act({ action: 'release', force: true }); }} data-testid="rt-force">أصدر رغم ذلك (يُقيَّد)</button>}</>)}
              {sel.status === 'released' && <button type="button" className="am-btn ghost" disabled={!!busy} onClick={async () => { if (window.confirm('سحب الإصدار؟ ستعود البطاقة إلى «قيد التصحيح».')) await act({ action: 'unrelease' }); }} data-testid="rt-unrelease">اسحب الإصدار</button>}
              {sel.status === 'released' && sel.actor_kind === 'staff' && <button type="button" className="am-btn ghost" disabled={!!busy} onClick={() => act({ action: 'anchor', anchor: !sel.is_anchor })} data-testid="rt-anchor">{sel.is_anchor ? 'ألغِ المرساة' : 'اجعله مرساة اعتماد'}</button>}
            </div>
            {sel.human_rating && !sel.blind && <p className="mm-note" data-testid="rt-verdict">الحكم: <b>{sel.human_rating.verdict_ar}</b> · المستوى المقدَّر <b>{LEVEL_AR[sel.human_rating.estimated] || sel.human_rating.estimated}</b> · المتوسط المرجّح {sel.human_rating.mean}{sel.anchor_band != null ? ` · درجة المرساة ${sel.anchor_band}` : ''}</p>}
          </div>}
        </section>
      </div>
    </div>
  );
}

const CSS = `
.rt-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}.rt-filters{display:flex;gap:6px;flex-wrap:wrap}
.rt-strip{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0}@media(max-width:980px){.rt-strip{grid-template-columns:1fr}}
.rt-cal b,.rt-mirror b{display:block;color:#0f2a4e;font-size:15px}.rt-mirror b small{font-weight:700;color:#64748b;font-size:12px;margin-inline-start:6px}.rt-cal p{margin:6px 0 0;font-size:13px;color:#334155;line-height:1.8}.rt-cal.wait{border-color:#ead9a6;background:#fffdf7}.rt-cal.ok{border-color:#cfe9e6}
.rt-mirror ul{list-style:none;margin:8px 0;padding:0;display:grid;gap:4px}.rt-mirror li{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:#334155}.rt-mirror li i{font-style:normal;font-weight:900;color:#0f2a4e}
.rt-exempt{margin-top:8px;font-size:13px}.rt-exempt summary{cursor:pointer;color:#0b8a83;font-weight:800}.rt-exrow{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.rt-exrow input{flex:1;min-width:160px;border:1px solid #cbd5e1;border-radius:8px;padding:6px 8px;font:inherit;font-size:13px}
.rt-split{display:grid;grid-template-columns:minmax(300px,1fr) minmax(320px,1.3fr);gap:14px;align-items:start}@media(max-width:980px){.rt-split{grid-template-columns:1fr}}
.rt-queue tr.on td{background:#f0fdfa}.rt-acc,.rt-ai,.rt-recep{display:inline-block;margin-inline-start:6px;font-size:11px;color:#64748b;font-weight:800}.rt-ai{color:#0b8a83;border:1px solid #cfe9e6;border-radius:6px;padding:0 4px}
.rt-tag{display:inline-block;margin-inline-start:6px;font-size:11px;font-weight:800;border-radius:6px;padding:0 5px;background:#f1f5f9;color:#334155}.rt-tag.anchor{background:#fbf5e4;color:#8a6a1f}.rt-tag.adj{background:#fee2e2;color:#991b1b}.rt-tag.second{background:#eef2ff;color:#3730a3}.rt-tag.mine{background:#e6f4f3;color:#0f5c57}
.rt-st{display:inline-block;border-radius:999px;padding:3px 9px;font-size:12px;font-weight:800;background:#f1f5f9;color:#334155}.rt-st.released{background:#e6f4f3;color:#0f5c57}.rt-st.rated{background:#fbf5e4;color:#8a6a1f}.rt-st.ai_rated{background:#eef2ff;color:#3730a3}
.rt-dhead{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px}.rt-dhead h4{margin:4px 0 0;font-size:18px;line-height:1.6;color:#0f2a4e}
.rt-blind{display:flex;align-items:center;gap:6px;margin:0 0 8px;font-size:13px;font-weight:800;color:#3730a3;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:6px 10px}
.rt-sample{margin:6px 0 10px;color:#334155}.rt-sample summary{cursor:pointer;font-weight:800;color:#0b8a83}
.rt-text{margin:10px 0;background:#fffdf7;border:1px solid #ead9a6;border-radius:14px;padding:14px 16px;font-size:17px;line-height:2;color:#0f172a;white-space:pre-wrap}
.rt-audio{margin:10px 0}.rt-audio audio{width:100%}.rt-audio small{color:#64748b}
.rt-tr{margin:10px 0;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px}.rt-tr label{display:block;font-weight:800;color:#0f2a4e;font-size:13px}.rt-tr label small{display:block;font-weight:700;color:#64748b;font-size:12px}.rt-tr textarea{display:block;width:100%;margin:6px 0 8px;border:1px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-size:15px;line-height:1.9}.rt-flu{color:#64748b;font-size:12px}
.rt-aibox{background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:10px 12px;margin:10px 0;font-size:13px;color:#1e1b4b}.rt-aibox ul{margin:6px 0;padding-inline-start:18px}
.rt-reads{margin:10px 0;border:1px solid #cfe9e6;background:#f0fdfa;border-radius:12px;padding:10px 12px;font-size:13px}.rt-reads b{color:#0f2a4e}.rt-reads ul{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:4px}.rt-reads li{display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;color:#334155}.rt-reads li i{font-style:normal;font-weight:900;color:#0f2a4e}.rt-reads li q{flex-basis:100%;quotes:"«" "»";color:#475569}
.rt h5{margin:14px 0 8px;font-size:15px;color:#0f2a4e}.rt h5 small{display:block;font-weight:700;color:#64748b;font-size:12px}
.rt-dims{display:grid;gap:10px}.rt-dim{border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px 10px;margin:0}.rt-dim legend{font-weight:900;color:#0f2a4e;padding:0 6px}
.rt-scale{display:flex;gap:6px;flex-wrap:wrap}.rt-sc{width:40px;height:40px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;font:inherit;font-weight:900;cursor:pointer;color:#0f2a4e}.rt-sc.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.rt-sc:focus-visible{outline:3px solid #c9a24b;outline-offset:2px}.rt-sc:disabled{cursor:default;opacity:.7}
.rt-band{margin:6px 0 0;font-size:13px;color:#334155;line-height:1.7;min-height:22px}
.rt-note{display:block;margin:12px 0;font-weight:800;color:#0f2a4e;font-size:13px}.rt-note textarea{display:block;width:100%;margin-top:6px;border:1px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-size:15px;line-height:1.8}
.rt-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.rt-block{font-size:13px;font-weight:800;color:#8a6a1f;background:#fbf5e4;border-radius:8px;padding:6px 10px}
.am-btn.small{padding:5px 10px;font-size:12px}
`;
