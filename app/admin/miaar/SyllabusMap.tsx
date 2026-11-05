'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «خريطة المنهج — وسم وحدات المستوى» (م6-ب) — الاسم الرسمي: Syllabus Map.
 *  يسار: وحدات المستوى (بذرة من واصفات CEFR بحالة مسوَّدة) — اعتماد/إيقاف/تحرير بيد المدير، وتغطية كل وحدة في البنك.
 *  يمين: بنود المستوى مع وسومها — تصفية (مهارة · موسوم/غير موسوم) · تحديد جماعي · وسم يدوي · «اقترح» (الواصف ثم Gemini) → مراجعة بشرية → اعتماد.
 *  مبدأ: لا وسم صامت؛ كل اقتراح يُقرأ ويُقَرّ إنسانيًا، وكل كتابة في سجلّ التدقيق.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

type Unit = { code: string; level: string; idx: number; title_ar: string; title_en: string; focus_ar: string; domains: string[]; descriptor_codes: string[]; status: 'draft' | 'approved' | 'retired'; updated_at?: string | null; updated_by?: string | null };
type Item = { id: string; code: string; skill: string; status: string; descriptor_code: string | null; domain: string | null; text: string; unit_codes: string[] };
type CovRow = { code: string; title_ar: string; items: number; by_skill: Record<string, number>; covered: boolean };
type Data = { ready: boolean; level: string; units: Unit[]; counts: Record<string, { total: number; approved: number; draft: number }>; coverage: { rows: CovRow[]; uncovered: string[]; tagged: number; untagged: number; total: number }; items: Item[]; can_edit: boolean; seed_total: number; title: { ar: string; en: string } };
type Sug = { item_id: string; unit_code: string; why: string; source: 'descriptor' | 'ai'; unit_title: string; item_code: string };

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const SKILL_AR: Record<string, string> = { grammar_vocab: 'اللغة', reading: 'القراءة', listening: 'الاستماع', writing: 'الكتابة', speaking: 'المحادثة' };
const DOMAIN_AR: Record<string, string> = { personal: 'شخصي', public: 'عام', professional: 'مهني', educational: 'تعليمي' };
const STATUS_AR: Record<string, string> = { draft: 'مسوَّدة', approved: 'معتمدة', retired: 'موقوفة' };

export default function SyllabusMap({ auth }: { auth: () => Promise<Record<string, string>> }) {
  const [level, setLevel] = useState('A1');
  const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState<string | null>(null); const [ok, setOk] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);
  const [skill, setSkill] = useState('all'); const [only, setOnly] = useState<'all' | 'untagged' | 'tagged'>('all');
  const [sel, setSel] = useState<Set<string>>(new Set()); const [pickUnit, setPickUnit] = useState('');
  const [sugs, setSugs] = useState<Sug[] | null>(null); const [sugNote, setSugNote] = useState<string | null>(null); const [sugOn, setSugOn] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<Unit | null>(null);

  const load = useCallback(async (L: string) => {
    setErr(null); const H = await auth();
    const j = await fetch(`/api/admin/miaar/syllabus?level=${L}`, { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return; } setD(j as Data); setSel(new Set()); setSugs(null);
  }, [auth]);
  useEffect(() => { void load(level); }, [level, load]);

  const post = useCallback(async (body: Record<string, unknown>, label: string) => {
    setBusy(label); setErr(null); setOk(null); const H = await auth();
    const j = await fetch('/api/admin/miaar/syllabus', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null);
    setBusy(null); if (!j?.success) { setErr(j?.error || 'تعذّر التنفيذ'); return null; } return j;
  }, [auth]);

  const items = useMemo(() => (d?.items || []).filter((i) => (skill === 'all' || i.skill === skill) && (only === 'all' || (only === 'untagged' ? !i.unit_codes.length : i.unit_codes.length > 0))), [d, skill, only]);
  const unitTitle = useMemo(() => new Map((d?.units || []).map((u) => [u.code, u.title_ar])), [d]);
  const covBy = useMemo(() => new Map((d?.coverage.rows || []).map((r) => [r.code, r])), [d]);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allVisible = () => setSel(new Set(items.map((i) => i.id)));

  const setStatus = async (u: Unit, status: string) => { const j = await post({ action: 'unit_status', code: u.code, status }, u.code); if (j) { setOk(`${u.title_ar}: ${STATUS_AR[status]}`); void load(level); } };
  const tag = async (mode: 'add' | 'remove') => { if (!sel.size || !pickUnit) return; const j = await post({ action: 'tag_items', item_ids: [...sel], unit_codes: [pickUnit], mode }, 'tag'); if (j) { setOk(mode === 'add' ? `وُسم ${j.changed} بندًا بـ ${unitTitle.get(pickUnit) || pickUnit}` : `أُزيل الوسم عن ${j.changed} بندًا`); void load(level); } };
  const suggest = async () => { const j = await post({ action: 'suggest', level, ...(sel.size ? { item_ids: [...sel] } : {}) }, 'suggest'); if (j) { setSugs(j.suggestions || []); setSugNote(j.note || (j.source === 'ai' ? 'اقتراحات من الواصف ومن الذكاء — راجعها ثم اعتمد ما تراه' : 'اقتراحات من الواصف — راجعها ثم اعتمد ما تراه')); setSugOn(new Set((j.suggestions || []).map((s: Sug) => s.item_id))); } };
  const apply = async () => { if (!sugs) return; const chosen = sugs.filter((s) => sugOn.has(s.item_id)); if (!chosen.length) return; const j = await post({ action: 'apply_suggestions', suggestions: chosen.map((s) => ({ item_id: s.item_id, unit_code: s.unit_code })) }, 'apply'); if (j) { setOk(`اعتُمد ${j.changed} وسمًا — بتوقيعك`); setSugs(null); void load(level); } };
  const seed = async () => { const j = await post({ action: 'seed_level', level }, 'seed'); if (j) { setOk(`أُدرجت ${j.inserted} وحدة بذرة`); void load(level); } };
  const saveEdit = async () => { if (!edit) return; const j = await post({ action: 'unit_save', unit: edit }, 'save'); if (j) { setOk('حُفظت الوحدة'); setEdit(null); void load(level); } };

  if (err && !d) return <section className="am-card" role="alert" data-testid="sy-err"><style>{CSS}</style><p className="sy-err">{err}</p></section>;
  if (!d) return <section className="am-card" data-testid="sy-loading"><style>{CSS}</style><p className="sy-muted">تُفتح الخريطة…</p></section>;
  const cov = d.coverage; const approved = d.units.filter((u) => u.status === 'approved').length;
  return <div className="sy" data-testid="sy-root" data-level={level}>
    <style>{CSS}</style>
    {err && <div className="am-err" role="alert">{err}</div>}{ok && <div className="am-ok" role="status" data-testid="sy-ok">{ok}</div>}
    <section className="am-card sy-head">
      <div className="sy-levels" role="tablist" aria-label="المستوى">{LEVELS.map((L) => <button key={L} role="tab" aria-selected={level === L} className={`sy-lv${level === L ? ' on' : ''}`} onClick={() => setLevel(L)} data-testid={`sy-lv-${L}`}>{L}<small>{d.counts[L]?.approved || 0}/{d.counts[L]?.total || 0}</small></button>)}</div>
      {!d.ready && <p className="sy-warn" data-testid="sy-notready">جدول وحدات المستوى غير موجود بعد — نفّذ هجرة م6-ب في Supabase ثم أعد التحميل. (الاختبارات والتقارير تعمل كالمعتاد بلا وحدات.)</p>}
      <div className="sy-sum" data-testid="sy-sum">
        <div><b>{approved}</b><span>وحدة معتمدة من {d.units.length}</span></div>
        <div><b>{cov.tagged}</b><span>بندًا موسومًا من {cov.total} في المستوى</span></div>
        <div className={cov.uncovered.length ? 'bad' : 'good'}><b>{cov.uncovered.length}</b><span>وحدة معتمدة بلا بنود</span></div>
        <div><b>{cov.untagged}</b><span>بندًا بلا وسم</span></div>
      </div>
      <p className="sy-hint">الاعتماد بيد المدير. مولّد اختبار العبور يوازن تغطية الوحدات <b>المعتمدة</b> فقط — بلا تغيير لعدد البنود (60/20/20 كما هي). الوحدة المعتمدة بلا بنود لا تظهر في الاختبار ولا في التقارير حتى تُوسم.</p>
    </section>

    <div className="sy-grid">
      <section className="am-card sy-units" aria-labelledby="sy-ut">
        <div className="sy-bar"><h3 id="sy-ut">وحدات المستوى {level}</h3>{d.can_edit && <span className="sy-acts">{d.units.length < (level === 'C1' ? 6 : 8) && <button className="sy-btn" onClick={() => void seed()} disabled={!!busy || !d.ready} data-testid="sy-seed">أدرج وحدات البذرة الناقصة</button>}<button className="sy-btn" onClick={() => setEdit({ code: '', level, idx: d.units.length + 1, title_ar: '', title_en: '', focus_ar: '', domains: [], descriptor_codes: [], status: 'draft' })} disabled={!d.ready} data-testid="sy-new">وحدة جديدة</button></span>}</div>
        {!d.units.length && <p className="sy-muted">لا وحدات لهذا المستوى.</p>}
        <ol className="sy-ul">{d.units.map((u) => { const c = covBy.get(u.code); return <li key={u.code} className={`sy-u ${u.status}`} data-testid="sy-unit" data-code={u.code} data-status={u.status}>
          <div className="sy-uh"><b>{u.code}</b><span className={`sy-pill ${u.status}`}>{STATUS_AR[u.status]}</span>{u.status === 'approved' && <span className={`sy-pill ${c?.covered ? 'cov' : 'nocov'}`} title="بنود معتمدة موسومة بهذه الوحدة">{c?.items || 0} بند</span>}</div>
          <div className="sy-ut1">{u.title_ar} <small dir="ltr">{u.title_en}</small></div>
          <p className="sy-focus">{u.focus_ar}</p>
          <p className="sy-meta">{u.domains.map((x) => DOMAIN_AR[x] || x).join(' · ')}{u.descriptor_codes.length ? <> · <span dir="ltr">{u.descriptor_codes.join(', ')}</span></> : null}</p>
          {d.can_edit && <div className="sy-ua">
            {u.status !== 'approved' && <button className="sy-btn ok" onClick={() => void setStatus(u, 'approved')} disabled={!!busy} data-testid="sy-approve">اعتمد</button>}
            {u.status === 'approved' && <button className="sy-btn" onClick={() => void setStatus(u, 'draft')} disabled={!!busy}>أعد إلى مسوَّدة</button>}
            {u.status !== 'retired' && <button className="sy-btn" onClick={() => void setStatus(u, 'retired')} disabled={!!busy}>أوقف</button>}
            <button className="sy-btn" onClick={() => setEdit({ ...u })} disabled={!!busy}>حرّر</button>
          </div>}
        </li>; })}</ol>
      </section>

      <section className="am-card sy-items" aria-labelledby="sy-it">
        <div className="sy-bar"><h3 id="sy-it">بنود المستوى {level} <small>({items.length} من {d.items.length})</small></h3>
          <span className="sy-acts">
            <select className="sy-sel" value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="المهارة"><option value="all">كل المهارات</option>{Object.entries(SKILL_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select className="sy-sel" value={only} onChange={(e) => setOnly(e.target.value as any)} aria-label="الوسم" data-testid="sy-filter"><option value="all">الكل</option><option value="untagged">بلا وسم</option><option value="tagged">موسوم</option></select>
            <button className="sy-btn" onClick={allVisible}>حدّد الظاهر</button><button className="sy-btn" onClick={() => setSel(new Set())}>ألغِ التحديد</button>
          </span></div>
        <div className="sy-tagbar" data-testid="sy-tagbar">
          <span className="sy-n">{sel.size} محدَّد</span>
          <select className="sy-sel" value={pickUnit} onChange={(e) => setPickUnit(e.target.value)} aria-label="الوحدة" data-testid="sy-pick"><option value="">— اختر وحدة —</option>{d.units.filter((u) => u.status !== 'retired').map((u) => <option key={u.code} value={u.code}>{u.code} · {u.title_ar}</option>)}</select>
          <button className="sy-btn ok" onClick={() => void tag('add')} disabled={!!busy || !sel.size || !pickUnit || !d.ready} data-testid="sy-tag">وسم المحدَّد</button>
          <button className="sy-btn" onClick={() => void tag('remove')} disabled={!!busy || !sel.size || !pickUnit || !d.ready}>أزل الوسم</button>
          <button className="sy-btn ai" onClick={() => void suggest()} disabled={!!busy || !d.ready || !d.units.length} data-testid="sy-suggest">{busy === 'suggest' ? 'يفكّر…' : sel.size ? `اقترح للمحدَّد (${sel.size})` : 'اقترح لغير الموسوم'}</button>
        </div>
        {sugs && <div className="sy-sug" data-testid="sy-sugs">
          <div className="sy-bar"><h4>اقتراحات تنتظر قرارك <small>({sugs.length})</small></h4><span className="sy-acts"><button className="sy-btn ok" onClick={() => void apply()} disabled={!!busy || !sugOn.size} data-testid="sy-apply">اعتمد المحدَّد ({sugOn.size})</button><button className="sy-btn" onClick={() => setSugs(null)}>أغلق</button></span></div>
          {sugNote && <p className="sy-muted">{sugNote}</p>}
          {!sugs.length && <p className="sy-muted">لا اقتراحات — إمّا أن البنود موسومة كلّها أو لم تتضح وحدتها.</p>}
          <ul className="sy-sl">{sugs.map((s) => <li key={s.item_id}><label><input type="checkbox" checked={sugOn.has(s.item_id)} onChange={() => setSugOn((x) => { const n = new Set(x); if (n.has(s.item_id)) n.delete(s.item_id); else n.add(s.item_id); return n; })} /> <b dir="ltr">{s.item_code}</b> → <b>{s.unit_code}</b> {s.unit_title} <span className={`sy-pill ${s.source === 'ai' ? 'ai' : 'desc'}`}>{s.source === 'ai' ? 'ذكاء' : 'واصف'}</span><br /><small>{s.why}</small></label></li>)}</ul>
        </div>}
        <table className="sy-t"><thead><tr><th aria-label="تحديد" /><th>الرمز</th><th>المهارة</th><th>النصّ</th><th>الواصف</th><th>الوحدات</th></tr></thead>
          <tbody>{items.slice(0, 300).map((i) => <tr key={i.id} className={sel.has(i.id) ? 'on' : ''} data-testid="sy-item" data-tagged={i.unit_codes.length ? '1' : '0'}>
            <td><input type="checkbox" checked={sel.has(i.id)} onChange={() => toggle(i.id)} aria-label={`تحديد ${i.code}`} /></td>
            <td dir="ltr"><b>{i.code}</b>{i.status !== 'approved' && <><br /><small>{i.status}</small></>}</td><td>{SKILL_AR[i.skill] || i.skill}</td><td className="sy-txt">{i.text}</td><td dir="ltr"><small>{i.descriptor_code || '—'}</small></td>
            <td>{i.unit_codes.length ? i.unit_codes.map((c) => <span key={c} className="sy-chip" title={unitTitle.get(c) || c}>{c}</span>) : <span className="sy-muted">—</span>}</td>
          </tr>)}</tbody></table>
        {items.length > 300 && <p className="sy-muted">يُعرض أول 300 بند — ضيّق التصفية.</p>}
      </section>
    </div>

    {edit && <div className="sy-modal" role="dialog" aria-modal="true" aria-labelledby="sy-et" data-testid="sy-edit">
      <div className="sy-mbox">
        <h3 id="sy-et">{edit.code ? `تحرير ${edit.code}` : `وحدة جديدة — ${level}`}</h3>
        <div className="sy-form">
          <label>الرقم<input type="number" min={1} max={40} value={edit.idx} onChange={(e) => setEdit({ ...edit, idx: Number(e.target.value) })} /></label>
          <label>العنوان (عربي)<input value={edit.title_ar} onChange={(e) => setEdit({ ...edit, title_ar: e.target.value })} data-testid="sy-e-title" /></label>
          <label>Title (English)<input dir="ltr" value={edit.title_en} onChange={(e) => setEdit({ ...edit, title_en: e.target.value })} /></label>
          <label className="full">التركيز<textarea rows={2} value={edit.focus_ar} onChange={(e) => setEdit({ ...edit, focus_ar: e.target.value })} /></label>
          <label className="full">الواصفات (رموز مفصولة بفاصلة — مثل LU-A1-01)<input dir="ltr" value={edit.descriptor_codes.join(', ')} onChange={(e) => setEdit({ ...edit, descriptor_codes: e.target.value.split(/[,\s]+/).filter(Boolean) })} /></label>
          <fieldset className="full"><legend>المجالات</legend>{Object.entries(DOMAIN_AR).map(([k, v]) => <label key={k} className="inl"><input type="checkbox" checked={edit.domains.includes(k)} onChange={() => setEdit({ ...edit, domains: edit.domains.includes(k) ? edit.domains.filter((x) => x !== k) : [...edit.domains, k] })} /> {v}</label>)}</fieldset>
        </div>
        <div className="sy-acts"><button className="sy-btn ok" onClick={() => void saveEdit()} disabled={!!busy || edit.title_ar.trim().length < 2} data-testid="sy-e-save">احفظ</button><button className="sy-btn" onClick={() => setEdit(null)}>إلغاء</button></div>
      </div>
    </div>}
    <p className="sy-foot">خريطة المنهج لا تغيّر مواصفة «عُبور» (exit-2026.11): العدد والأوزان وحدّ الاجتياز كما هي؛ التغيير في <b>أيّ</b> البنود تُسحب داخل كل خلية، وفي ما يُقرأ بعد الاختبار. الوسم الآلي اقتراح حتى يعتمده إنسان، وكل اعتماد في سجلّ التدقيق.</p>
  </div>;
}

const CSS = `
.sy-head{margin-bottom:12px}.sy-levels{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.sy-lv{font:inherit;font-weight:900;font-size:14px;border:1px solid #cbd5e1;background:#fff;color:#0f2a4e;border-radius:10px;padding:6px 12px;cursor:pointer;display:inline-flex;flex-direction:column;align-items:center;gap:2px}.sy-lv small{font-size:11px;color:#64748b;font-weight:700}.sy-lv.on{background:#0b8a83;color:#fff;border-color:#0b8a83}.sy-lv.on small{color:#d1fae5}
.sy-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.sy-sum div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px;text-align:center}.sy-sum b{display:block;font-size:22px;color:#0f2a4e}.sy-sum span{font-size:12px;color:#475569}.sy-sum .bad b{color:#b91c1c}.sy-sum .good b{color:#166534}
.sy-hint{margin:10px 0 0;color:#334155;font-size:13px;line-height:1.8}.sy-warn{margin:0 0 10px;padding:8px 12px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:13px}
.sy-grid{display:grid;grid-template-columns:minmax(280px,1fr) minmax(0,1.6fr);gap:12px}@media(max-width:900px){.sy-grid{grid-template-columns:1fr}}
.sy-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}.sy-bar h3,.sy-bar h4{margin:0}.sy-bar small{color:#64748b;font-weight:600}.sy-acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.sy-btn{font:inherit;font-size:12.5px;font-weight:800;border:1px solid #cbd5e1;background:#fff;color:#0f2a4e;border-radius:8px;padding:5px 10px;cursor:pointer}.sy-btn:disabled{opacity:.5;cursor:not-allowed}.sy-btn.ok{background:#0b8a83;color:#fff;border-color:#0b8a83}.sy-btn.ai{background:#eef2ff;border-color:#c7d2fe;color:#3730a3}
.sy-sel{font:inherit;font-size:12.5px;border:1px solid #cbd5e1;border-radius:8px;padding:5px 8px;background:#fff;max-width:260px}
.sy-ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}.sy-u{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#fff}.sy-u.approved{border-color:#86efac;background:#f0fdf4}.sy-u.retired{opacity:.6}
.sy-uh{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.sy-uh b{font-family:ui-monospace,monospace;color:#0b8a83}.sy-ut1{font-weight:900;color:#0f2a4e;margin-top:4px}.sy-ut1 small{color:#64748b;font-weight:600;margin-inline-start:6px}.sy-focus{margin:4px 0 0;font-size:12.5px;color:#334155;line-height:1.7}.sy-meta{margin:4px 0 0;font-size:11.5px;color:#64748b}.sy-ua{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.sy-pill{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:900;background:#e2e8f0;color:#334155}.sy-pill.approved{background:#dcfce7;color:#166534}.sy-pill.draft{background:#fef3c7;color:#92400e}.sy-pill.retired{background:#f1f5f9;color:#64748b}.sy-pill.cov{background:#dbeafe;color:#1e40af}.sy-pill.nocov{background:#fee2e2;color:#991b1b}.sy-pill.ai{background:#eef2ff;color:#3730a3}.sy-pill.desc{background:#ecfeff;color:#155e75}
.sy-tagbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 10px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:10px}.sy-n{font-weight:900;color:#0f2a4e;font-size:13px}
.sy-sug{border:1px solid #c7d2fe;background:#f5f7ff;border-radius:12px;padding:10px 12px;margin-bottom:10px}.sy-sl{list-style:none;margin:0;padding:0;display:grid;gap:6px;max-height:280px;overflow:auto}.sy-sl li{font-size:13px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:6px 8px}.sy-sl small{color:#475569}
.sy-t{width:100%;border-collapse:collapse;font-size:12.5px}.sy-t th,.sy-t td{border-bottom:1px solid #e2e8f0;padding:6px 5px;text-align:start;vertical-align:top}.sy-t th{font-size:11.5px;color:#475569}.sy-t tr.on td{background:#ecfeff}.sy-txt{max-width:360px;color:#334155}.sy-chip{display:inline-block;margin:1px 2px;padding:1px 7px;border-radius:999px;background:#dbeafe;color:#1e40af;font-size:11px;font-weight:900;font-family:ui-monospace,monospace}
.sy-modal{position:fixed;inset:0;background:rgba(15,42,78,.45);display:grid;place-items:center;z-index:50;padding:12px}.sy-mbox{background:#fff;border-radius:14px;padding:16px 18px;max-width:640px;width:100%;max-height:90vh;overflow:auto}.sy-form{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}.sy-form label{display:grid;gap:4px;font-size:12.5px;font-weight:800;color:#0f2a4e}.sy-form label.full,.sy-form fieldset.full{grid-column:1/-1}.sy-form input,.sy-form textarea{font:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:8px;padding:6px 8px}.sy-form fieldset{border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px}.sy-form .inl{display:inline-flex;align-items:center;gap:4px;margin-inline-end:12px;font-weight:700}
.sy-err{color:#b91c1c;margin:0}.sy-muted{color:#64748b;font-size:13px;margin:4px 0}.sy-foot{margin:12px 0 0;color:#64748b;font-size:12.5px;line-height:1.8}
`;
