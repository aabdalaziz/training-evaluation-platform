'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «مِران» — /miaar/practice/<ML-code> (م10): تدريب ما بين الحكم والإعادة
 *  بلا حساب — برمز النتيجة نفسه. شريط 14 يومًا · «تمرين اليوم» (5 بنود بتغذية راجعة فورية، أو «يوم المرآة») · مطلب كتابة/تحدّث قصير للمهارة الإنتاجية
 *  مع مرآة نصّ محلية و«تمرين مزدوج» (اليوم 1 بجانب اليوم 12) · «رفيق التمرين» (ملاحظة المدرّب نصًّا أو صوتًا) · «مرآة التحسّن» (نسبة الوحدة يوم الحكم ← اليوم)
 *  · مؤشّر الجاهزية (ليس حكمًا). WCAG 2.2 AA: أزرار ≥ 40px · aria-live للتغذية الراجعة · تباين · تنقّل بلوحة المفاتيح.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import WayBar from '../../components/WayBar';

type Q = { id: string; skill: string; passageId: string | null; questionText: string; options: { id: string; text: string; image?: string | null; alt?: string | null }[]; stimulus: { image: string | null; alt: string | null } | null };
type P = { id: string; skill: 'reading' | 'listening'; title: string; text: string; audioUrl: string | null };
type Fb = { correct: boolean; correct_option: string; why_ar: string };
type Card = { d: number; kind: 'drill' | 'mirror'; unit: string | null; unit_title: string; focus_ar: string; form: { questions: Q[]; passages: P[] } | null; text: { prompt_ar: string; min_words: number; earlier: { d: number; text: string } | null } | null; answered: Record<string, Fb>; note_ar: string | null; note_audio: string | null; first_of_unit: boolean };
type View = { ok: boolean; code: string; name: string; الحالة: string; اليوم: number; انتهت: boolean; المستوى: string; المهارة: string | null; الوحدات: { الرمز: string; الاسم: string }[]; الأيام: { d: number; kind: string; unit: string | null; unit_title: string; done: boolean; n: number; correct: number; text: boolean; has_note: boolean; today: boolean }[]; بطاقة_اليوم: Card | null; المرآة: { unit: string; title_ar: string; before: number | null; now: number | null; delta: number | null }[]; الجاهزية: { state: 'ready' | 'close' | 'early'; label_ar: string; sentence_ar: string }; نصوص: { d: number; text: string; mirror: any }[]; أُنجز: number; الشعار: string };
const SK: Record<string, string> = { listening: 'استماع', reading: 'قراءة', grammar_vocab: 'مفردات وتراكيب', writing: 'الكتابة', speaking: 'المحادثة' };

export default function PracticeApp({ code, fontClass = '' }: { code: string; fontClass?: string }) {
  const [v, setV] = useState<View | null>(null); const [err, setErr] = useState<'nf' | 'noplan' | null>(null); const [busy, setBusy] = useState(''); const [live, setLive] = useState('');
  const [text, setText] = useState(''); const [tm, setTm] = useState<{ notes_ar: string[]; words: number } | null>(null); const [ai, setAi] = useState<{ notes_ar: string[]; rewrite_ar: string | null; source: string } | null>(null); const [consent, setConsent] = useState(false);
  const load = useCallback(async () => { try { const r = await fetch(`/api/miaar/practice?code=${encodeURIComponent(code)}`, { cache: 'no-store' }); const d = await r.json(); if (!r.ok || !d.ok) { setErr(d?.error === 'no_plan' ? 'noplan' : 'nf'); return; } setErr(null); setV(d); } catch { setErr('nf'); } }, [code]);
  useEffect(() => { void load(); }, [load]);
  const card = v?.بطاقة_اليوم || null; const total = card?.form?.questions.length || 0; const done = card ? Object.keys(card.answered).length : 0;
  const byPassage = useMemo(() => { const m = new Map<string | null, Q[]>(); for (const q of card?.form?.questions || []) { const k = q.passageId || null; m.set(k, [...(m.get(k) || []), q]); } return m; }, [card]);
  const passages = useMemo(() => new Map((card?.form?.passages || []).map((p) => [p.id, p])), [card]);
  async function answer(q: Q, option: string) {
    if (!card || busy || card.answered[q.id]) return; setBusy(q.id);
    try { const r = await fetch('/api/miaar/practice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'answer', code, day: card.d, item: q.id, option }) }); const d = await r.json();
      if (d.ok) { setV((p) => p ? { ...p, بطاقة_اليوم: p.بطاقة_اليوم ? { ...p.بطاقة_اليوم, answered: { ...p.بطاقة_اليوم.answered, [q.id]: d.feedback } } : null } : p); setLive(d.feedback.correct ? 'إجابة صحيحة' : `إجابة غير صحيحة — ${d.feedback.why_ar}`); if (d.day_done) setTimeout(() => void load(), 900); }
      else setLive(d.error === 'already_answered' ? 'أجبت عن هذا البند' : 'تعذّر الحفظ — حاول ثانية'); }
    catch { setLive('تعذّر الاتصال'); } finally { setBusy(''); }
  }
  async function sendText() {
    if (!card?.text || busy) return; setBusy('text');
    try { const r = await fetch('/api/miaar/practice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'text', code, day: card.d, text }) }); const d = await r.json();
      if (d.ok) { setTm({ notes_ar: d.mirror.notes_ar, words: d.mirror.words }); setLive('حُفظ نصّك — انظر مرآته'); if (d.day_done) setTimeout(() => void load(), 1200); } else setLive(d.error === 'text_too_short' ? 'النصّ قصير جدًا — اكتب بالعربية جملًا كاملة' : d.error === 'already_answered' ? 'أرسلت نصّ اليوم بالفعل' : 'تعذّر الحفظ'); }
    catch { setLive('تعذّر الاتصال'); } finally { setBusy(''); }
  }
  async function askAi() {
    if (!card || busy || !consent) return; setBusy('ai');
    try { const r = await fetch('/api/miaar/practice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ai_feedback', code, day: card.d, text, consent: true }) }); const d = await r.json(); if (d.ok) setAi({ notes_ar: d.notes_ar, rewrite_ar: d.rewrite_ar, source: d.source }); else setLive(d.error === 'ai_budget' ? 'بلغت حدّ التعليق الآلي اليوم' : 'تعذّر التعليق'); }
    catch { setLive('تعذّر الاتصال'); } finally { setBusy(''); }
  }
  const r = v?.الجاهزية;
  return <div className={`mp ${fontClass}`} dir="rtl" lang="ar" data-testid="mp-page">
    <div className="mp-top"><header className="mp-head"><div className="mp-brandside"><a className="mp-brand" href="/">أَثَر<small>بوابة التميّز للاستشارات والتدريب</small></a><a className="mp-mark" href="/miaar">مِعيار</a></div>
      <a className="mp-lnk" href={`/miaar/result/${encodeURIComponent(code)}`} data-testid="mp-back-result">← بطاقة نتيجتي</a></header><WayBar lang="ar" /></div>
    {!v && !err && <p className="mp-wait" role="status">جارٍ فتح مِران…</p>}
    {err && <section className="mp-wrap"><div className="mp-card"><p className="mp-err" role="alert" data-testid="mp-nf">{err === 'noplan' ? 'لا خطّة مِران معتمدة لهذا الرمز بعد — حين يعتمدها مدرّبك يصلك تنبيه.' : 'لم نجد هذا الرمز.'}</p><a className="mp-btn ghost" href={`/miaar/result/${encodeURIComponent(code)}`}>إلى بطاقة النتيجة</a></div></section>}
    {v && <>
      <section className="mp-band"><p className="mp-kicker">مِران · تدريب ما بين الحكم والإعادة · مستوى {v.المستوى}{v.المهارة ? ` · ${SK[v.المهارة] || v.المهارة}` : ''}</p>
        <h1 data-testid="mp-title">{v.انتهت ? 'انتهت أيامك الأربعة عشر' : v.اليوم > 0 ? `اليوم ${v.اليوم} من 14` : 'تبدأ قريبًا'} · {v.name}</h1>
        <p className="mp-lead"><span className={`mp-ready ${r?.state}`} data-testid="mp-ready" data-state={r?.state}>{r?.label_ar}</span> {r?.sentence_ar}</p></section>
      <div className="mp-wrap">
        <ol className="mp-days" aria-label="أيام الخطّة">{v.الأيام.map((d) => <li key={d.d} className={`mp-day ${d.kind} ${d.done ? 'done' : ''} ${d.today ? 'today' : ''} ${!d.done && d.d < v.اليوم ? 'missed' : ''}`} data-testid="mp-day" data-done={d.done ? '1' : '0'} title={`${d.unit_title}${d.done ? ` · ${d.correct}/${d.n}` : ''}`}><b>{d.d}</b><span>{d.kind === 'mirror' ? '🪞' : d.unit ? d.unit.split('-')[1] : ''}</span>{d.done && <i aria-label="أُنجز">✓</i>}{d.has_note && <em aria-label="ملاحظة من مدرّبك">✎</em>}</li>)}</ol>
        <p className="mp-hint">أنجزت <b data-testid="mp-done">{v.أُنجز}</b> من 14 · اليوم الفائت لا يضيع — يعود إليك بعد يومك الحالي.</p>

        {card ? <section className="mp-card mp-today" data-testid="mp-card" data-day={card.d} data-kind={card.kind}>
          <p className="mp-k">{card.kind === 'mirror' ? '🪞 يوم المرآة' : `تمرين اليوم ${card.d}`}{card.unit ? ` · ${card.unit}` : ''}</p>
          <h2>{card.unit_title}</h2>{card.focus_ar && <p className="mp-focus">{card.focus_ar}</p>}
          {(card.note_ar || card.note_audio) && <div className="mp-note" data-testid="mp-note"><b>رفيق التمرين — من مدرّبك:</b>{card.note_ar && <p>{card.note_ar}</p>}{card.note_audio && <audio controls src={card.note_audio} preload="none" aria-label="ملاحظة صوتية من مدرّبك" />}</div>}
          {total > 0 && <p className="mp-prog" aria-live="polite">{done}/{total} بنود{done === total ? ' — أتممت بنود اليوم' : ''}</p>}
          {[...byPassage.entries()].map(([pid, qs]) => { const p = pid ? passages.get(pid) : null; return <div key={pid || 'none'} className="mp-group">
            {p && <div className="mp-passage"><b>{p.title}</b>{p.skill === 'listening' && p.audioUrl ? <audio controls src={p.audioUrl} preload="none" /> : <p>{p.text}</p>}</div>}
            {qs.map((q, i) => { const fb = card.answered[q.id]; return <fieldset key={q.id} className={`mp-q ${fb ? (fb.correct ? 'ok' : 'bad') : ''}`} data-testid="mp-q" data-state={fb ? (fb.correct ? 'ok' : 'bad') : 'open'}>
              <legend><span className="mp-qn">{i + 1}</span> {q.questionText} <small>· {SK[q.skill] || q.skill}</small></legend>
              {q.stimulus?.image && <img className="mp-stim" src={q.stimulus.image} alt={q.stimulus.alt || ''} />}
              <div className="mp-opts">{q.options.map((o) => <button key={o.id} type="button" className={`mp-opt ${fb && o.text === fb.correct_option ? 'right' : ''}`} disabled={!!fb || busy === q.id} onClick={() => void answer(q, o.id)} data-testid="mp-opt">{o.image ? <img src={o.image} alt={o.alt || o.text} /> : null}{o.text}</button>)}</div>
              {fb && <p className="mp-fb" data-testid="mp-fb">{fb.correct ? '✓ ' : '✗ '}{fb.why_ar}</p>}
            </fieldset>; })}
          </div>; })}
          {card.text && <div className="mp-text" data-testid="mp-text">
            <h3>{v.المهارة === 'speaking' ? 'تحدّث — اكتب ما ستقوله' : 'اكتب'}</h3><p className="mp-focus">{card.text.prompt_ar}</p>
            {card.text.earlier && <div className="mp-twin" data-testid="mp-twin"><b>نصّك في اليوم {card.text.earlier.d}:</b><p>{card.text.earlier.text}</p><small>«تمرين مزدوج»: اكتب اليوم عن الموضوع نفسه ثم قارن بعينك.</small></div>}
            {!tm ? <>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={1500} placeholder="اكتب هنا بالعربية…" aria-label="نصّ التمرين" />
              <div className="mp-row"><button type="button" className="mp-btn" onClick={() => void sendText()} disabled={busy === 'text' || text.trim().length < 10} data-testid="mp-text-send">أرسل إلى المرآة</button><small>{text.trim() ? text.trim().split(/\s+/).length : 0} كلمة · الهدف {card.text.min_words}</small></div>
            </> : <div className="mp-mirror-text" data-testid="mp-text-mirror"><b>مرآة نصّك ({tm.words} كلمة):</b><ul>{tm.notes_ar.map((n, i) => <li key={i}>{n}</li>)}</ul>
              {!ai ? <div className="mp-ai"><label><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> أوافق على إرسال نصّي لتعليق ذكاء اصطناعي تكويني (بلا درجة)</label><button type="button" className="mp-btn ghost" onClick={() => void askAi()} disabled={!consent || busy === 'ai'} data-testid="mp-ai">تعليق المعلّم الآلي</button></div>
                : <div className="mp-ai-out" data-testid="mp-ai-out"><b>{ai.source === 'ai' ? 'تعليق آلي (تكويني):' : 'تعليق محلي:'}</b><ul>{ai.notes_ar.map((n, i) => <li key={i}>{n}</li>)}</ul>{ai.rewrite_ar && <p>✎ {ai.rewrite_ar}</p>}</div>}</div>}
          </div>}
          <p className="mp-live" role="status" aria-live="polite">{live}</p>
        </section> : <section className="mp-card" data-testid="mp-nocard"><h2>{v.انتهت ? 'انتهت أيام التمرين' : v.اليوم === 0 ? 'يبدأ مِران قريبًا' : 'أتممت كل ما فُتح لك حتى اليوم ✓'}</h2><p className="mp-focus">{v.انتهت ? 'مرآتك أدناه تبقى — وإعادتك الرسمية تُقاس بحضور إنسان.' : 'يصلك كل صباح تنبيه «مِران اليوم». استرح — التباعد جزء من التدريب.'}</p></section>}

        <section className="mp-card" data-testid="mp-mirror"><h2>مرآة التحسّن</h2>
          <ul className="mp-mirror">{v.المرآة.map((m) => <li key={m.unit} data-testid="mp-mirror-row" data-delta={m.delta ?? ''}><div className="mp-mh"><b>{m.title_ar}</b><em className={m.delta === null ? '' : m.delta > 0 ? 'up' : m.delta < 0 ? 'down' : ''}>{m.delta === null ? (m.now === null ? 'لم تتمرّن بعد' : `${m.now}%`) : `${m.delta > 0 ? '+' : ''}${m.delta}`}</em></div>
            <div className="mp-bars"><span className="mp-bar a" style={{ width: `${m.before ?? 0}%` }} title={`يوم الحكم: ${m.before ?? '—'}%`} /><span className="mp-bar b" style={{ width: `${m.now ?? 0}%` }} title={`في مِران: ${m.now ?? '—'}%`} /></div><small>يوم الحكم {m.before ?? '—'}% ← في مِران {m.now ?? '—'}%</small></li>)}</ul>
          {v.نصوص.length > 1 && <div className="mp-twins" data-testid="mp-twins"><h3>تمرين مزدوج — نصّاك</h3>{v.نصوص.map((t) => <div key={t.d}><b>اليوم {t.d}</b> <small>({t.mirror?.words || 0} كلمة · {t.mirror?.connectors || 0} روابط)</small><p>{t.text}</p></div>)}</div>}
        </section>
        <p className="mp-foot">{v.الشعار} · <a href={`/miaar/result/${encodeURIComponent(code)}`}>بطاقة النتيجة</a> · <a href={`/miaar/growth/${encodeURIComponent(code)}`}>رحلتك</a></p>
      </div>
    </>}
    <style jsx global>{`
.mp{min-height:100vh;background:#f8fafc;color:#0f172a;font-family:inherit;line-height:1.7}
.mp-top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.94);backdrop-filter:blur(8px);border-bottom:1px solid #e2e8f0}
.mp-head{max-width:980px;margin:0 auto;padding:10px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.mp-brandside{display:flex;align-items:center;gap:12px}.mp-brand{font-weight:900;font-size:22px;color:#0f2a4e;text-decoration:none;display:flex;flex-direction:column;line-height:1.1}.mp-brand small{font-size:11px;font-weight:600;color:#64748b}
.mp-mark{font-weight:900;color:#0b8a83;text-decoration:none;border-inline-start:1px solid #e2e8f0;padding-inline-start:12px}.mp-lnk{color:#0f2a4e;font-weight:800;text-decoration:none;min-height:40px;display:inline-flex;align-items:center}
.mp-band{background:linear-gradient(135deg,#0f2a4e,#0b8a83);color:#fff;padding:30px 18px 24px}.mp-band h1{max-width:980px;margin:4px auto 0;font-size:28px}.mp-kicker{max-width:980px;margin:0 auto;color:#f3d98b;font-weight:800;font-size:13px}.mp-lead{max-width:980px;margin:10px auto 0;font-weight:700;opacity:.95}
.mp-ready{display:inline-block;padding:2px 12px;border-radius:999px;font-weight:900;font-size:13px;background:#fff;color:#0f2a4e;margin-inline-end:6px}.mp-ready.ready{background:#dcfce7;color:#166534}.mp-ready.close{background:#fef3c7;color:#92400e}
.mp-wrap{max-width:980px;margin:0 auto;padding:18px 18px 40px}
.mp-days{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.mp-day{position:relative;border:2px solid #e2e8f0;border-radius:12px;background:#fff;padding:8px 4px;text-align:center;min-height:56px;display:flex;flex-direction:column;align-items:center;gap:0}.mp-day b{font-size:16px;color:#0f2a4e}.mp-day span{font-size:11px;color:#64748b;font-weight:800}
.mp-day.mirror{background:#fdf7e6;border-color:#f3d98b}.mp-day.done{background:#f0fdf4;border-color:#86efac}.mp-day.today{border-color:#0b8a83;box-shadow:0 0 0 3px rgba(11,138,131,.18)}.mp-day.missed{border-style:dashed;border-color:#fca5a5}.mp-day i{position:absolute;top:-6px;inset-inline-end:-4px;font-style:normal;background:#166534;color:#fff;border-radius:999px;width:18px;height:18px;font-size:11px;line-height:18px}.mp-day em{position:absolute;bottom:-6px;inset-inline-start:-4px;font-style:normal;background:#c9a24b;color:#fff;border-radius:999px;width:18px;height:18px;font-size:11px;line-height:18px}
.mp-hint{margin:12px 0 14px;color:#334155;font-weight:600;font-size:13.5px}
.mp-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px;margin:0 0 14px}.mp-card h2{font-size:20px;margin:0 0 6px;color:#0f2a4e}.mp-card h3{font-size:16px;margin:14px 0 6px;color:#0f2a4e}.mp-k{margin:0;color:#0b8a83;font-weight:900;font-size:12.5px}.mp-focus{margin:0 0 10px;color:#334155;font-weight:600}
.mp-note{background:#fffaf0;border:1px solid #f3d98b;border-radius:12px;padding:10px 12px;margin:0 0 12px}.mp-note p{margin:4px 0}.mp-note audio{width:100%;margin-top:6px}
.mp-prog{margin:0 0 8px;font-weight:800;color:#0f2a4e}.mp-group{margin:0 0 10px}.mp-passage{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin:0 0 8px}.mp-passage p{margin:4px 0 0;white-space:pre-wrap}.mp-passage audio{display:block;width:100%;margin-top:6px}
.mp-q{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin:0 0 8px;min-width:0}.mp-q.ok{border-color:#86efac;background:#f0fdf4}.mp-q.bad{border-color:#fca5a5;background:#fff1f2}.mp-q legend{font-weight:800;padding:0 6px}.mp-q legend small{color:#64748b;font-weight:600}.mp-qn{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:999px;background:#0f2a4e;color:#fff;font-size:12px;margin-inline-end:4px}
.mp-stim{max-width:240px;border-radius:10px;display:block;margin:6px 0}
.mp-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-top:6px}.mp-opt{font:inherit;font-weight:700;min-height:44px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;text-align:start;color:#0f172a}.mp-opt img{max-width:100%;border-radius:8px;display:block;margin-bottom:4px}.mp-opt:hover{border-color:#0b8a83}.mp-opt:disabled{cursor:default;opacity:.75}.mp-opt.right{border-color:#166534;background:#dcfce7;opacity:1;font-weight:900}.mp-opt:focus-visible{outline:3px solid #c9a24b;outline-offset:2px}
.mp-fb{margin:8px 0 0;font-weight:700;color:#0f2a4e;line-height:1.7}
.mp-text textarea{width:100%;font:inherit;border:1px solid #cbd5e1;border-radius:12px;padding:10px;min-height:120px;box-sizing:border-box}.mp-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px}.mp-row small{color:#64748b;font-weight:700}
.mp-twin{background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:10px 12px;margin:0 0 8px}.mp-twin p{margin:4px 0;white-space:pre-wrap}.mp-twin small{color:#64748b}
.mp-mirror-text{background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:10px 12px}.mp-mirror-text ul{margin:6px 0 0;padding-inline-start:18px}.mp-ai{margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}.mp-ai label{font-size:13px;font-weight:600}.mp-ai-out{margin-top:8px;border-top:1px solid #99f6e4;padding-top:8px}.mp-ai-out ul{margin:4px 0;padding-inline-start:18px}
.mp-live{min-height:1.2em;margin:8px 0 0;color:#0f5c57;font-weight:800}
.mp-mirror{list-style:none;margin:0;padding:0;display:grid;gap:10px}.mp-mh{display:flex;justify-content:space-between;font-weight:800}.mp-mh em{font-style:normal;color:#64748b}.mp-mh em.up{color:#166534}.mp-mh em.down{color:#b91c1c}.mp-bars{display:grid;gap:3px;margin:4px 0}.mp-bar{display:block;height:10px;border-radius:999px;min-width:4px;transition:width .4s}.mp-bar.a{background:#cbd5e1}.mp-bar.b{background:#0b8a83}.mp-mirror small{color:#64748b;font-weight:600}
.mp-twins div{border-top:1px solid #e2e8f0;padding:8px 0}.mp-twins p{margin:4px 0;white-space:pre-wrap}
.mp-btn{display:inline-flex;align-items:center;gap:6px;background:#0f2a4e;color:#fff;border:1px solid #0f2a4e;border-radius:999px;padding:9px 18px;font:inherit;font-weight:800;cursor:pointer;text-decoration:none;min-height:40px}.mp-btn.ghost{background:#fff;color:#0f2a4e}.mp-btn:disabled{opacity:.55;cursor:default}.mp-btn:focus-visible{outline:3px solid #c9a24b;outline-offset:2px}
.mp-foot{color:#64748b;font-size:12.5px;font-weight:600;text-align:center}.mp-foot a{color:#0f2a4e}.mp-wait{text-align:center;padding:40px;color:#64748b;font-weight:700}.mp-err{color:#b91c1c;font-weight:800;margin:0 0 12px}
@media (max-width:640px){.mp-days{grid-template-columns:repeat(7,1fr);gap:4px}.mp-day{min-height:48px;padding:6px 2px}.mp-band h1{font-size:22px}}
    `}</style>
  </div>;
}
