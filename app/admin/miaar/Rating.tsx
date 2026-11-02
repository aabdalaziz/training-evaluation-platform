'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «غرفة التصحيح» (م4-ب) — لسان 06 في /admin/miaar/rating
 *  طابور الأداءات (بلا اسم ولا بريد: رمز جلسة قصير · المهارة · مستوى المهمة · المستوى الاستقبالي · الطول) → تفصيل: النص أو مشغّل صوت (رابط موقَّع 5 دقائق)
 *  · سُلّم التقدير بالأبعاد 0–5 مع وصف كل درجة · «عيّنة المصحّح» (اقتراح آلي للنصوص بموافقة المتقدّم) · حفظ أو إصدار → «معتمد» في بطاقة المتقدّم على الرمز نفسه.
 *  الأسماء الرسمية: التقدير البشري · الإصدار · سحب الإصدار. القاعدة: لا درجة تُنشر قبل إنسان.
 */
import { useEffect, useState } from 'react';
import { Icon } from '../../../lib/ui/icons';

type Row = { id: string; skill: 'writing' | 'speaking'; status: string; item_code: string; level_target: string; word_count: number | null; duration_sec: number | null; accommodation: string | null; ai_consent: boolean; has_ai: boolean; created_at: string; released_at: string | null; session_short: string; receptive_level: string | null };
type Detail = Row & { text_answer: string | null; audio_url: string | null; media_mime: string | null; human_rating: any; ai_rating: any; rater_note_ar: string | null; task: { prompt: string; level: string; task: any } | null; dimensions: { key: string; ar: string }[]; bands: { dimension: string; score: number; dimension_ar: string; text_ar: string }[] };
const LEVEL_AR: Record<string, string> = { PRE_A1: 'ما قبل A1', A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' };
const STATUS_AR: Record<string, string> = { submitted: 'جديد', ai_rated: 'اقتراح آلي جاهز', rated: 'مقدَّر — لم يُصدر', released: 'صادر', skipped: 'لم يُقدَّم' };
const SKILL_AR = { writing: 'كتابة', speaking: 'تحدّث' };

export default function Rating({ auth }: { auth: () => Promise<Record<string, string>> }) {
  const [filter, setFilter] = useState<'pending' | 'released' | 'all'>('pending'); const [rows, setRows] = useState<Row[]>([]); const [counts, setCounts] = useState<Record<string, number>>({});
  const [sel, setSel] = useState<Detail | null>(null); const [scores, setScores] = useState<Record<string, number>>({}); const [note, setNote] = useState(''); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState('');
  async function load(f = filter) { const j = await fetch(`/api/admin/miaar/rating?status=${f}`, { headers: await auth(), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.success) { setErr(j?.error || 'تعذّر تحميل الطابور'); return; } setRows(j.rows || []); setCounts(j.counts || {}); }
  async function open(id: string) { setErr(''); const j = await fetch(`/api/admin/miaar/rating?id=${id}`, { headers: await auth(), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.success) { setErr(j?.error || 'تعذّر فتح الأداء'); return; } const d = j.performance as Detail; setSel(d); setScores(d.human_rating?.scores || {}); setNote(d.rater_note_ar || ''); }
  async function post(body: Record<string, unknown>) { setBusy(String(body.action)); setErr(''); setOk(''); try { const j = await fetch('/api/admin/miaar/rating', { method: 'POST', headers: await auth(), body: JSON.stringify(body) }).then((r) => r.json()); if (!j?.success) { setErr(j?.error || 'تعذّر التنفيذ'); return null; } setOk(j.note_ar || 'تم'); return j; } finally { setBusy(''); }
  }
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const complete = sel ? sel.dimensions.every((d) => Number.isInteger(scores[d.key])) : false;
  const pending = (counts.submitted || 0) + (counts.ai_rated || 0) + (counts.rated || 0);
  async function rate(release: boolean) { if (!sel) return; const j = await post({ action: 'rate', id: sel.id, scores, note, release }); if (j) { await load(); await open(sel.id); } }
  async function suggest() { if (!sel) return; const j = await post({ action: 'ai_suggest', id: sel.id }); if (j?.rating) { await open(sel.id); } }
  return (
    <div className="rt" data-testid="mi-rating">
      <style>{CSS}</style>
      {err && <div className="am-err" role="alert">{err}</div>}{ok && <div className="am-ok" role="status" data-testid="rt-ok">{ok}</div>}
      <section className="am-card rt-head">
        <div><h3>غرفة التصحيح <small>أداءات الكتابة والتحدّث — يقرؤها ويسمعها إنسان، والبطاقة تكتمل على الرمز نفسه</small></h3>
          <p className="mm-note">بانتظار التصحيح: <b data-testid="rt-pending">{pending}</b> · صادر: <b>{counts.released || 0}</b> · لم يُقدَّم: {counts.skipped || 0}. لا اسم ولا بريد هنا — المصحّح يرى الأداء فقط.</p></div>
        <div className="rt-filters" role="tablist" aria-label="تصفية">{(['pending', 'released', 'all'] as const).map((f) => <button key={f} type="button" role="tab" aria-selected={filter === f} className={`am-btn${filter === f ? ' on' : ' ghost'}`} onClick={() => { setFilter(f); void load(f); }}>{f === 'pending' ? 'بانتظار التصحيح' : f === 'released' ? 'الصادر' : 'الكل'}</button>)}</div>
      </section>
      <div className="rt-split">
        <section className="am-card rt-queue" aria-label="الطابور">
          {!rows.length ? <div className="am-empty" data-testid="rt-empty">لا أداءات هنا. تظهر حين يسلّم متقدّم مهمة من «غرفة الأداء» بعد بطاقته.</div> : <table className="mm-t" data-testid="rt-table"><thead><tr><th>المهارة</th><th>المهمة</th><th>المستوى</th><th>الطول</th><th>الحالة</th><th /></tr></thead><tbody>
            {rows.map((r) => <tr key={r.id} className={sel?.id === r.id ? 'on' : ''} data-testid={`rt-row-${r.skill}`}>
              <td><b>{SKILL_AR[r.skill]}</b>{r.accommodation && <small className="rt-acc">تيسير</small>}{r.ai_consent && <small className="rt-ai" title="وافق على مساعدة الذكاء الاصطناعي">AI</small>}</td>
              <td><code dir="ltr">{r.item_code}</code></td>
              <td>{LEVEL_AR[r.level_target] || r.level_target}{r.receptive_level && <small className="rt-recep"> · استقبالي {LEVEL_AR[r.receptive_level] || r.receptive_level}</small>}</td>
              <td>{r.word_count != null ? `${r.word_count} كلمة` : r.duration_sec != null ? `${r.duration_sec} ث` : '—'}</td>
              <td><span className={`rt-st ${r.status}`}>{STATUS_AR[r.status] || r.status}</span></td>
              <td><button type="button" className="am-btn small" onClick={() => void open(r.id)} data-testid="rt-open">{r.status === 'released' ? 'عرض' : 'قيّم'}</button></td>
            </tr>)}
          </tbody></table>}
        </section>
        <section className="am-card rt-detail" aria-live="polite">
          {!sel ? <div className="am-empty">اختر أداءً من الطابور.</div> : <div data-testid="rt-detail">
            <header className="rt-dhead"><div><p className="mm-kicker">{SKILL_AR[sel.skill]} · مستوى المهمة {LEVEL_AR[sel.level_target] || sel.level_target}{sel.receptive_level ? ` · الاستقبالي ${LEVEL_AR[sel.receptive_level] || sel.receptive_level}` : ''}</p><h4>{sel.task?.prompt || sel.item_code}</h4>{sel.accommodation && <p className="mm-note">تيسير: {sel.accommodation === 'typed_instead_of_speaking' ? 'كتب بدل أن يتحدّث' : 'تحدّث بدل أن يكتب'}</p>}</div><span className={`rt-st ${sel.status}`}>{STATUS_AR[sel.status]}</span></header>
            {sel.task?.task?.sample_ar && <details className="rt-sample"><summary>إجابة نموذجية للمصحّح (لا يراها المتقدّم)</summary><p dir="rtl">{sel.task.task.sample_ar}</p></details>}
            {sel.text_answer && <blockquote className="rt-text" dir="rtl" lang="ar" data-testid="rt-text">{sel.text_answer}</blockquote>}
            {sel.audio_url && <div className="rt-audio"><audio controls src={sel.audio_url} preload="metadata" data-testid="rt-audio" /><small>{sel.duration_sec} ث · الرابط صالح 5 دقائق</small></div>}
            {!sel.text_answer && !sel.audio_url && <div className="am-empty">لا محتوى (ربما انتهت صلاحية الملف أو حُذف بعد 180 يومًا).</div>}
            {sel.ai_rating && <div className="rt-aibox" data-testid="rt-aibox"><b>عيّنة المصحّح (اقتراح آلي — ليس قرارًا)</b><p>{sel.dimensions.map((d) => `${d.ar}: ${sel.ai_rating.scores?.[d.key]}`).join(' · ')} · ثقة {Math.round((sel.ai_rating.confidence || 0) * 100)}%</p>{Array.isArray(sel.ai_rating.evidence) && <ul>{sel.ai_rating.evidence.map((e: string, i: number) => <li key={i}>«{e}»</li>)}</ul>}<p>{sel.ai_rating.next_step_ar}</p><button type="button" className="am-btn ghost small" onClick={() => setScores({ ...sel.ai_rating.scores })}>انسخ الاقتراح إلى السُّلّم (ثم عدّل)</button></div>}
            <h5>التقدير البشري بالأبعاد <small>0 = لا إنتاج يُقيَّم · 3 = يحقّق مستوى المهمة · 5 = يتجاوزه بوضوح</small></h5>
            <div className="rt-dims">{sel.dimensions.map((d) => <fieldset key={d.key} className="rt-dim" data-testid={`rt-dim-${d.key}`}><legend>{d.ar}</legend>
              <div className="rt-scale" role="radiogroup" aria-label={d.ar}>{[0, 1, 2, 3, 4, 5].map((n) => { const band = sel.bands.find((b) => b.dimension === d.key && b.score === n); return <button key={n} type="button" role="radio" aria-checked={scores[d.key] === n} className={`rt-sc${scores[d.key] === n ? ' on' : ''}`} title={band?.text_ar || ''} onClick={() => setScores((s) => ({ ...s, [d.key]: n }))} disabled={sel.status === 'released'}>{n}</button>; })}</div>
              <p className="rt-band">{sel.bands.find((b) => b.dimension === d.key && b.score === scores[d.key])?.text_ar || 'اختر درجة لترى وصفها'}</p>
            </fieldset>)}</div>
            <label className="rt-note">ما يقوله المصحّح للمتقدّم (يظهر في البطاقة — جملة أو جملتان دافئتان ومحدّدتان)<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={600} disabled={sel.status === 'released'} data-testid="rt-note" /></label>
            <div className="rt-actions">
              {sel.status !== 'released' && <>
                {sel.ai_consent && sel.text_answer && <button type="button" className="am-btn ghost" disabled={!!busy} onClick={suggest} data-testid="rt-suggest"><Icon name="spark" size={16} /> {busy === 'ai_suggest' ? 'يقترح…' : 'عيّنة المصحّح (اقتراح آلي)'}</button>}
                <button type="button" className="am-btn ghost" disabled={!complete || !!busy} onClick={() => rate(false)} data-testid="rt-save">احفظ التقدير</button>
                <button type="button" className="am-btn" disabled={!complete || !!busy} onClick={() => rate(true)} data-testid="rt-release"><Icon name="check" size={16} /> أصدر إلى البطاقة</button>
              </>}
              {sel.status === 'released' && <button type="button" className="am-btn ghost" disabled={!!busy} onClick={async () => { if (window.confirm('سحب الإصدار؟ ستعود البطاقة إلى «قيد التصحيح».')) { const j = await post({ action: 'unrelease', id: sel.id }); if (j) { await load(); await open(sel.id); } } }} data-testid="rt-unrelease">اسحب الإصدار</button>}
            </div>
            {sel.human_rating && <p className="mm-note" data-testid="rt-verdict">الحكم: <b>{sel.human_rating.verdict_ar}</b> · المستوى المقدَّر <b>{LEVEL_AR[sel.human_rating.estimated] || sel.human_rating.estimated}</b> · المتوسط المرجّح {sel.human_rating.mean}</p>}
          </div>}
        </section>
      </div>
    </div>
  );
}

const CSS = `
.rt-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}.rt-filters{display:flex;gap:6px;flex-wrap:wrap}
.rt-split{display:grid;grid-template-columns:minmax(300px,1fr) minmax(320px,1.3fr);gap:14px;align-items:start}@media(max-width:980px){.rt-split{grid-template-columns:1fr}}
.rt-queue tr.on td{background:#f0fdfa}.rt-acc,.rt-ai,.rt-recep{display:inline-block;margin-inline-start:6px;font-size:11px;color:#64748b;font-weight:800}.rt-ai{color:#0b8a83;border:1px solid #cfe9e6;border-radius:6px;padding:0 4px}
.rt-st{display:inline-block;border-radius:999px;padding:3px 9px;font-size:12px;font-weight:800;background:#f1f5f9;color:#334155}.rt-st.released{background:#e6f4f3;color:#0f5c57}.rt-st.rated{background:#fbf5e4;color:#8a6a1f}.rt-st.ai_rated{background:#eef2ff;color:#3730a3}
.rt-dhead{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px}.rt-dhead h4{margin:4px 0 0;font-size:18px;line-height:1.6;color:#0f2a4e}
.rt-sample{margin:6px 0 10px;color:#334155}.rt-sample summary{cursor:pointer;font-weight:800;color:#0b8a83}
.rt-text{margin:10px 0;background:#fffdf7;border:1px solid #ead9a6;border-radius:14px;padding:14px 16px;font-size:17px;line-height:2;color:#0f172a;white-space:pre-wrap}
.rt-audio{margin:10px 0}.rt-audio audio{width:100%}.rt-audio small{color:#64748b}
.rt-aibox{background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:10px 12px;margin:10px 0;font-size:13px;color:#1e1b4b}.rt-aibox ul{margin:6px 0;padding-inline-start:18px}
.rt h5{margin:14px 0 8px;font-size:15px;color:#0f2a4e}.rt h5 small{display:block;font-weight:700;color:#64748b;font-size:12px}
.rt-dims{display:grid;gap:10px}.rt-dim{border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px 10px;margin:0}.rt-dim legend{font-weight:900;color:#0f2a4e;padding:0 6px}
.rt-scale{display:flex;gap:6px;flex-wrap:wrap}.rt-sc{width:40px;height:40px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;font:inherit;font-weight:900;cursor:pointer;color:#0f2a4e}.rt-sc.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.rt-sc:focus-visible{outline:3px solid #c9a24b;outline-offset:2px}.rt-sc:disabled{cursor:default;opacity:.7}
.rt-band{margin:6px 0 0;font-size:13px;color:#334155;line-height:1.7;min-height:22px}
.rt-note{display:block;margin:12px 0;font-weight:800;color:#0f2a4e;font-size:13px}.rt-note textarea{display:block;width:100%;margin-top:6px;border:1px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-size:15px;line-height:1.8}
.rt-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.am-btn.small{padding:5px 10px;font-size:12px}
`;
