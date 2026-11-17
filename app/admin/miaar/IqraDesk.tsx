'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «اقْرَأْ — مكتب المحتوى» (ق1) — للطاقم داخل قشرة مِعيار (التبويب 12).
 *  أعلى: الرِّواقات السبعة بحالات حلقاتها (مسوَّدة/مراجعة/معتمدة) وعدد المتعلّمين (k ≥ 5 وإلا «—»).
 *  وسط: حلقات المستوى المختار — عرض كامل (النصّ · البطاقات · المِران بمفاتيحه) · اعتماد/إرجاع/أرشفة (مديرون) — اعتماد الحلقة يعتمد مِرانها.
 *  أسفل: استيراد حزمة iqra-pack-1 (ملف أو لصق) → فحص → استيراد كمسوَّدات · تسكين يدوي (مديرون).
 *  مبدأ: لا يصل المتعلّم إلا ما اعتمده إنسان هنا.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

type Lvl = Record<string, { name_ar: string; code: string; line_ar: string }>;
type Ov = Record<string, { draft: number; in_review: number; approved: number; archived: number; learners: number | null }>;
type L = { id: string; code: string; unit_code: string; idx: number; title_ar: string; goal_ar: string; minutes: number; status: string; items: number; cards: number; review_note?: string | null; reviewed_at?: string | null };
type Full = L & { content: any; cards: { id: string; idx: number; word_ar: string; pos: string | null; gloss_ar: string; example_ar: string }[]; items: { id: string; item_type: string; question_text: string; options: any; stimulus: any; status: string; key: any }[] };
type Data = { levels: Lvl; overview: Ov; level: string; units: { code: string; title_ar: string; status: string }[]; lessons: L[] };
const ORDER = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const ST: Record<string, string> = { draft: 'مسوَّدة', in_review: 'قيد المراجعة', approved: 'معتمدة', archived: 'مؤرشفة' };
const KIND: Record<string, string> = { mcq: 'اختيار', matching: 'مطابقة', ordering: 'ترتيب' };

export default function IqraDesk({ auth }: { auth: () => Promise<Record<string, string>> }) {
  const [level, setLevel] = useState('A1'); const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState<string | null>(null); const [ok, setOk] = useState<string | null>(null); const [busy, setBusy] = useState('');
  const [open, setOpen] = useState<Full | null>(null); const [note, setNote] = useState('');
  const [packText, setPackText] = useState(''); const [packRes, setPackRes] = useState<any>(null);
  const [enrol, setEnrol] = useState({ email: '', level: 'A1', note: '' });
  const load = useCallback(async (L: string) => { setErr(null); const H = await auth(); const j = await fetch(`/api/admin/iqra?level=${L}`, { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return; } setD(j); }, [auth]);
  useEffect(() => { void load(level); }, [level, load]);
  const post = useCallback(async (body: Record<string, unknown>, label: string) => { setBusy(label); setErr(null); setOk(null); const H = await auth(); const j = await fetch('/api/admin/iqra', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null); setBusy(''); if (!j?.success) { setErr(j?.error || 'تعذّر التنفيذ'); return j; } return j; }, [auth]);
  const view = async (l: L) => { const H = await auth(); const j = await fetch(`/api/admin/iqra?lesson=${l.id}`, { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.success) { setOpen(j.lesson); setNote(''); } else setErr(j?.error || 'تعذّر الفتح'); };
  const setStatus = async (l: L, status: string) => { const j = await post({ action: 'status', id: l.id, status, note: note || undefined }, l.id); if (j?.success) { setOk(`${l.title_ar}: ${ST[status]}`); setOpen(null); void load(level); } };
  const unitTitle = useMemo(() => new Map((d?.units || []).map((u) => [u.code, u.title_ar])), [d]);
  const parsePack = () => { try { return JSON.parse(packText); } catch { setErr('JSON غير صالح'); return null; } };
  const onFile = (f: File | null) => { if (!f) return; const r = new FileReader(); r.onload = () => setPackText(String(r.result || '')); r.readAsText(f); };
  const validate = async () => { const p = parsePack(); if (!p) return; const j = await post({ action: 'validate', pack: p }, 'validate'); setPackRes(j); };
  const doImport = async () => { const p = parsePack(); if (!p) return; const j = await post({ action: 'import', pack: p }, 'import'); setPackRes(j); if (j?.success) { setOk(`استُوردت ${j.report.lessons_created + j.report.lessons_updated} حلقة كمسوَّدات`); void load(level); } };
  const doEnrol = async () => { const j = await post({ action: 'enrol', ...enrol }, 'enrol'); if (j?.success) { setOk(`سُكِّن ${enrol.email} في ${enrol.level}`); setEnrol({ email: '', level: enrol.level, note: '' }); } };

  return <div className="iqd" data-testid="iqd">
    {err && <p className="am-err" role="alert">{err}</p>}{ok && <p className="iqd-ok" role="status">{ok}</p>}
    <section className="am-card"><h3>الرِّواقات السبعة <small>حلقات كلّ مستوى بحالاتها · المتعلّمون النشطون (يُعرض الرقم عند 5 فأكثر)</small></h3>
      <div className="iqd-levels" role="tablist" aria-label="المستوى">{ORDER.map((L) => { const o = d?.overview?.[L]; const m = d?.levels?.[L]; return <button key={L} role="tab" aria-selected={level === L} className={`iqd-lv${level === L ? ' on' : ''}`} onClick={() => setLevel(L)} data-testid={`iqd-lv-${L}`}><b>{m?.name_ar || L} · {m?.code || L}</b><span><i className="ap">{o?.approved || 0}</i> معتمدة · <i>{(o?.draft || 0) + (o?.in_review || 0)}</i> مسوَّدة</span><small>{o?.learners == null ? 'متعلّمون: —' : `متعلّمون: ${o.learners}`}</small></button>; })}</div></section>

    <section className="am-card"><h3>حلقات {d?.levels?.[level]?.name_ar} · {d?.levels?.[level]?.code} <small>{d?.lessons.length || 0} حلقة — لا يرى المتعلّم إلا المعتمدة</small></h3>
      {!d ? <p className="am-empty">…</p> : d.lessons.length === 0 ? <p className="am-empty" data-testid="iqd-empty">لا حلقات لهذا المستوى بعد — استورد حزمة من الأسفل.</p> : <table className="mm-t" data-testid="iqd-table"><thead><tr><th>الرمز</th><th>الحلقة</th><th>المنزلة</th><th>بطاقات</th><th>مِران</th><th>الحالة</th><th></th></tr></thead><tbody>
        {d.lessons.map((l) => <tr key={l.id} data-testid="iqd-row" data-status={l.status}><td dir="ltr">{l.code}</td><td><b>{l.title_ar}</b><br /><small>{l.goal_ar}</small></td><td>{unitTitle.get(l.unit_code) || l.unit_code}</td><td>{l.cards}</td><td>{l.items}</td><td><span className={`iqd-st ${l.status}`}>{ST[l.status] || l.status}</span></td><td className="mm-acts"><button className="am-btn" onClick={() => void view(l)} data-testid="iqd-view">عرض</button></td></tr>)}</tbody></table>}</section>

    {open && <section className="am-card iqd-open" data-testid="iqd-open"><div className="iqd-oh"><h3>{open.title_ar} <small dir="ltr">{open.code}</small></h3><button className="am-btn ghost" onClick={() => setOpen(null)}>إغلاق</button></div>
      <p className="mm-note"><b>الهدف:</b> {open.goal_ar || '—'} · <b>المدّة:</b> {open.minutes} د · <b>الحالة:</b> {ST[open.status]}{open.review_note ? ` · ملاحظة: ${open.review_note}` : ''}</p>
      <div className="iqd-grid">
        <div><h4>المدخل والنصّ</h4><p>{open.content?.intro_ar}</p>{open.content?.text && <pre className="iqd-text">{open.content.text.body}</pre>}{open.content?.grammar && <div className="iqd-rule"><b>{open.content.grammar.title_ar}</b><p>{open.content.grammar.explanation_ar}</p><ul>{(open.content.grammar.examples || []).map((e: string, i: number) => <li key={i}>{e}</li>)}</ul></div>}{open.content?.closing_ar && <p><b>أثر الحلقة:</b> {open.content.closing_ar}</p>}</div>
        <div><h4>البطاقات ({open.cards.length})</h4><ul className="iqd-cards">{open.cards.map((c) => <li key={c.id}><b>{c.word_ar}</b> <small>{c.pos || ''}</small><br />{c.gloss_ar}{c.example_ar && <em> — {c.example_ar}</em>}</li>)}</ul></div>
      </div>
      <h4>المِران ({open.items.length})</h4><ol className="iqd-items">{open.items.map((it) => <li key={it.id} data-testid="iqd-item"><span className="iqd-kind">{KIND[it.item_type] || it.item_type}</span> <b>{it.question_text}</b>
        {it.item_type === 'mcq' && <ul>{(it.options || []).map((o: any) => <li key={o.id} className={it.key?.correct_option_id === o.id ? 'right' : ''}>{o.text}</li>)}</ul>}
        {it.item_type === 'matching' && <ul>{(it.stimulus?.pairs || []).map((p: any, i: number) => <li key={i}>{p.l} ← {p.r}</li>)}</ul>}
        {it.item_type === 'ordering' && <p className="iqd-ord">{(it.key?.accepted?.order || []).join(' ')}</p>}
        {it.stimulus?.explanation_ar && <small>الشرح: {it.stimulus.explanation_ar}</small>}</li>)}</ol>
      <div className="mm-row"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة المراجعة (اختياري)" aria-label="ملاحظة" />
        {open.status !== 'approved' && <button className="am-btn" disabled={!!busy || !open.items.length} onClick={() => void setStatus(open, 'approved')} data-testid="iqd-approve">اعتماد الحلقة ومِرانها</button>}
        {open.status === 'draft' && <button className="am-btn ghost" disabled={!!busy} onClick={() => void setStatus(open, 'in_review')}>إلى المراجعة</button>}
        {open.status !== 'draft' && <button className="am-btn ghost" disabled={!!busy} onClick={() => void setStatus(open, 'draft')} data-testid="iqd-draft">إرجاع إلى مسوَّدة</button>}
        {open.status !== 'archived' && <button className="am-btn ghost" disabled={!!busy} onClick={() => void setStatus(open, 'archived')}>أرشفة</button>}</div>
      {!open.items.length && <p className="mm-note">لا تُعتمد حلقة بلا مِران — أضف تمارين عبر حزمة محدَّثة.</p>}</section>}

    <section className="am-card"><h3>استيراد حزمة محتوى <small>صيغة iqra-pack-1 — تُستورد مسوَّداتٍ، والحلقة المعتمدة لا تُمَسّ</small></h3>
      <div className="mm-row"><input type="file" accept="application/json,.json" onChange={(e) => onFile(e.target.files?.[0] || null)} aria-label="ملف الحزمة" data-testid="iqd-file" /><button className="am-btn ghost" disabled={!packText || !!busy} onClick={() => void validate()} data-testid="iqd-validate">فحص</button><button className="am-btn" disabled={!packText || !!busy} onClick={() => void doImport()} data-testid="iqd-import">استيراد</button></div>
      <textarea value={packText} onChange={(e) => setPackText(e.target.value)} placeholder='أو الصق JSON هنا: {"version":"iqra-pack-1","source":"…","lessons":[…]}' aria-label="محتوى الحزمة" className="iqd-ta" data-testid="iqd-pack" />
      {packRes && <div className="iqd-res" data-testid="iqd-res">{packRes.success ? <><p><b>الحزمة:</b> {packRes.summary.lessons} حلقة · {packRes.summary.cards} بطاقة · {packRes.summary.exercises} مِران{packRes.summary.units ? ` · ${packRes.summary.units} منزلة` : ''}</p>
        {packRes.summary.warnings?.length > 0 && <ul className="iqd-warn">{packRes.summary.warnings.map((w: any, i: number) => <li key={i}>{w.at}: {w.msg}</li>)}</ul>}
        {packRes.report && <p><b>النتيجة:</b> أُنشئت {packRes.report.lessons_created} · حُدّثت {packRes.report.lessons_updated} · تُركت معتمدة {packRes.report.lessons_skipped.length} · بطاقات {packRes.report.cards} · مِران {packRes.report.items}{packRes.report.errors.length ? ` · أخطاء ${packRes.report.errors.length}` : ''}</p>}
        {packRes.report?.errors?.length > 0 && <ul className="iqd-warn">{packRes.report.errors.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>}</>
        : <><p className="am-err">{packRes.error}</p>{packRes.problems && <ul className="iqd-warn">{packRes.problems.map((p: any, i: number) => <li key={i}>{p.at}: {p.msg}</li>)}</ul>}</>}</div>}</section>

    <section className="am-card"><h3>تسكين يدوي <small>للمديرين — الأصل أن يأتي التسكين من قرار مِعيار المعتمد</small></h3>
      <div className="mm-row"><input dir="ltr" value={enrol.email} onChange={(e) => setEnrol({ ...enrol, email: e.target.value })} placeholder="learner@example.com" aria-label="البريد" data-testid="iqd-enrol-email" /><select value={enrol.level} onChange={(e) => setEnrol({ ...enrol, level: e.target.value })} aria-label="المستوى">{ORDER.map((L) => <option key={L} value={L}>{d?.levels?.[L]?.name_ar || L} · {d?.levels?.[L]?.code || L}</option>)}</select><input value={enrol.note} onChange={(e) => setEnrol({ ...enrol, note: e.target.value })} placeholder="سبب التسكين" aria-label="سبب" /><button className="am-btn" disabled={!enrol.email || !!busy} onClick={() => void doEnrol()} data-testid="iqd-enrol">تسكين</button></div></section>
    <style jsx global>{`
.iqd{display:grid;gap:14px}.iqd-ok{color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:10px 12px;font-size:13px;margin:0}
.iqd-levels{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.iqd-lv{font:inherit;text-align:start;border:1px solid var(--line,#e8eef3);background:#fff;border-radius:14px;padding:10px 12px;cursor:pointer;display:grid;gap:2px}.iqd-lv.on{border-color:#0f2a4e;box-shadow:0 0 0 3px rgba(15,42,78,.12)}.iqd-lv b{color:#0f2a4e;font-size:14px}.iqd-lv span{font-size:12px;color:#475569}.iqd-lv i{font-style:normal;font-weight:900;color:#334155}.iqd-lv i.ap{color:#0f5c57}.iqd-lv small{font-size:11.5px;color:#64748b}
.iqd-st{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:800;background:#f1f5f9;color:#334155}.iqd-st.approved{background:#dcfce7;color:#166534}.iqd-st.in_review{background:#fef9c3;color:#854d0e}.iqd-st.archived{background:#f1f5f9;color:#64748b}
.iqd-open{border-top:3px solid #0b8a83}.iqd-oh{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.iqd-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.iqd h4{margin:12px 0 6px;color:#0f2a4e;font-size:15px}
.iqd-text{white-space:pre-wrap;font:inherit;font-family:var(--font-read),"Noto Naskh Arabic",serif;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:15px;line-height:1.9}.iqd-rule{background:#fbf7ea;border-radius:12px;padding:8px 12px;margin-top:8px}.iqd-rule ul{margin:4px 0 0;padding-inline-start:18px}
.iqd-cards{list-style:none;margin:0;padding:0;display:grid;gap:6px;font-size:14.5px;font-family:var(--font-read),"Noto Naskh Arabic",serif}.iqd-cards li{border-bottom:1px dashed #e2e8f0;padding:4px 0}.iqd-cards em{color:#475569}
.iqd-items{padding-inline-start:20px;font-size:14.5px;display:grid;gap:8px;font-family:var(--font-read),"Noto Naskh Arabic",serif}.iqd-items .iqd-kind,.iqd-items small{font-family:var(--font-ar)}.iqd-items ul{margin:4px 0;padding-inline-start:18px}.iqd-items li.right{color:#166534;font-weight:800}.iqd-kind{display:inline-block;background:#e6f4f3;color:#0f5c57;border-radius:999px;padding:1px 8px;font-size:11.5px;font-weight:800;margin-inline-end:6px}.iqd-ord{margin:4px 0;font-weight:800;color:#0f2a4e}.iqd-items small{color:#64748b;display:block}
.iqd-ta{width:100%;min-height:120px;font:inherit;font-size:12.5px;border:1px solid var(--line,#e8eef3);border-radius:12px;padding:10px;box-sizing:border-box;margin-top:8px;direction:ltr}
.iqd-res{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-top:8px;font-size:13px}.iqd-res p{margin:4px 0}.iqd-warn{margin:6px 0 0;padding-inline-start:18px;color:#854d0e;font-size:12.5px}
.am-btn.ghost{background:#fff;color:#0f2a4e}
@media(max-width:760px){.iqd-grid{grid-template-columns:1fr}}
    `}</style>
  </div>;
}
