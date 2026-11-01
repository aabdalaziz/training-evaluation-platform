'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «منشئ النماذج» (م2-ب) — /admin/miaar/forms
 *  المخطّط = نوع الاختبار + المستويات + مصفوفة (مستوى×مهارة) + طريقة السحب + المدة + حدّ الاجتياز + المِسبار/الأرضية.
 *  كل جلسة تسحب بنودها عشوائيًا من البنك المعتمد وفق المخطّط — المسؤول يضبط «كم ومن أيّ سلّة»، لا «أيّ بند» (إلا في الثابت).
 *  الأبواب العامة في /miaar هي المخطّطات النشطة المعلنة؛ الدعوات تختار أيّ مخطّط نشط.
 */
import { useEffect, useMemo, useState } from 'react';
import { LEVELS, SKILLS, skillLabel } from '../../../lib/miaar/registry';
import { Icon } from '../../../lib/ui/icons';

type Props = { auth: () => Promise<Record<string, string>> };
type Row = Record<string, any>;
const key = (l: string, s: string) => `${l}:${s}`;
const ORIGINAL: Record<string, Record<string, number>> = { A1: { grammar_vocab: 4, reading: 2, listening: 2 }, A2: { grammar_vocab: 4, reading: 2, listening: 2 }, B1: { grammar_vocab: 4, reading: 3, listening: 2 }, B2: { grammar_vocab: 4, reading: 3, listening: 2 }, C1: { grammar_vocab: 2, reading: 3, listening: 3 }, C2: { grammar_vocab: 2, reading: 2, listening: 4 } };
const emptyCounts = () => Object.fromEntries(LEVELS.map((l) => [l, Object.fromEntries(SKILLS.map((s) => [s, 0]))])) as Record<string, Record<string, number>>;
const STATUS_AR: Record<string, string> = { draft: 'مسودّة', active: 'نشط', archived: 'مؤرشف' };
const LADDER_AR: Record<string, string> = { adaptive: 'تكيفي (صعود/نزول)', linear: 'تتابعي (كل المستويات)', single: 'مستوى واحد' };

type Draft = { id?: string; code?: string; name_ar: string; name_en: string; description_ar: string; test_type: string; level: string; duration_minutes: number; cut_percent: number; sort_order: number;
  levels: string[]; counts: Record<string, Record<string, number>>; draw: string; pool: Record<string, string[]>; floor: boolean; probe: boolean; shuffle_options: boolean; start_level: string; ladder: string };
function draftFor(type: string, types: Row[]): Draft {
  const t = types.find((x) => x.id === type) || { name_ar: '', name_en: '', hint_ar: '', ladder: 'linear' };
  const counts = type === 'short' ? Object.fromEntries(LEVELS.map((l) => [l, Object.fromEntries(SKILLS.map((s) => [s, 1]))])) : type === 'level' ? { ...emptyCounts(), B1: { grammar_vocab: 8, reading: 6, listening: 6 } } : JSON.parse(JSON.stringify(ORIGINAL));
  return { name_ar: t.name_ar, name_en: t.name_en, description_ar: t.hint_ar, test_type: type, level: 'B1', duration_minutes: type === 'short' ? 15 : type === 'level' ? 30 : 50, cut_percent: type === 'level' ? 70 : 60, sort_order: 100,
    levels: type === 'level' ? ['B1'] : [...LEVELS], counts, draw: 'random', pool: {}, floor: type === 'placement', probe: type === 'placement', shuffle_options: true, start_level: 'A1', ladder: t.ladder };
}
function draftFromRow(r: Row): Draft {
  const req = r.requirements || {}; const counts = emptyCounts();
  const src = req.counts || (r.test_type === 'short' ? null : ORIGINAL);
  for (const l of LEVELS) for (const s of SKILLS) counts[l][s] = src ? Number(src[l]?.[s] || 0) : 1;
  return { id: r.id, code: r.code, name_ar: r.name_ar || '', name_en: r.name_en || '', description_ar: r.description_ar || '', test_type: r.test_type, level: r.level || (req.levels?.[0]) || 'B1', duration_minutes: r.duration_minutes || 50, cut_percent: r.cut_percent || 60, sort_order: r.sort_order || 100,
    levels: Array.isArray(req.levels) && req.levels.length ? req.levels : [...LEVELS], counts, draw: req.draw || 'random', pool: req.pool || {}, floor: req.floor === true || (req.floor !== false && r.test_type === 'placement'), probe: req.probe === true || (req.probe !== false && r.test_type === 'placement'), shuffle_options: req.shuffle_options !== false, start_level: req.start_level || 'A1', ladder: req.ladder || r.ladder || 'linear' };
}
const payload = (d: Draft) => ({ id: d.id, name_ar: d.name_ar, name_en: d.name_en, description_ar: d.description_ar, test_type: d.test_type, level: d.level, duration_minutes: d.duration_minutes, cut_percent: d.cut_percent, sort_order: d.sort_order,
  requirements: { levels: d.test_type === 'level' ? [d.level] : d.levels, counts: d.counts, draw: d.draw, pool: d.pool, floor: d.floor, probe: d.probe, shuffle_options: d.shuffle_options, start_level: d.start_level, ladder: d.test_type === 'custom' ? d.ladder : undefined } });

export default function FormBuilder({ auth }: Props) {
  const [data, setData] = useState<Row | null>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null); const [picking, setPicking] = useState<{ level: string; skill: string } | null>(null); const [preview, setPreview] = useState<Row | null>(null);
  const [filter, setFilter] = useState('all');
  async function load() { try { const j = await fetch('/api/admin/miaar/forms?list=1', { headers: await auth(), cache: 'no-store' }).then((r) => r.json()); if (!j.success) setErr(j.error || 'تعذّر التحميل'); else setData(j); } catch { setErr('تعذّر الاتصال'); } }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  async function post(body: Row) {
    setBusy(body.action); setErr(''); setOk('');
    try { const j = await fetch('/api/admin/miaar/forms', { method: 'POST', headers: await auth(), body: JSON.stringify(body) }).then((r) => r.json()); if (!j.success) { setErr([j.error, ...(j.plan_errors || []), ...(j.shortages || [])].filter(Boolean).join(' · ')); return null; } return j; }
    catch { setErr('تعذّر الاتصال'); return null; } finally { setBusy(''); }
  }
  const types: Row[] = data?.types || []; const modes: Row[] = data?.draw_modes || []; const avail: Record<string, number> = data?.availability || {}; const rows: Row[] = data?.blueprints || []; const usage: Row = data?.usage || {};
  const shown = rows.filter((r) => filter === 'all' ? r.status !== 'archived' : filter === 'archived' ? r.status === 'archived' : r.test_type === filter);
  const activeLevels = draft ? (draft.test_type === 'level' ? [draft.level] : draft.levels) : [];
  const total = useMemo(() => draft ? activeLevels.reduce((a, l) => a + SKILLS.reduce((b, s) => b + (draft.counts[l]?.[s] || 0), 0), 0) : 0, [draft, activeLevels]);
  const need = (l: string, s: string) => draft?.counts[l]?.[s] || 0;
  const basket = (l: string, s: string) => (draft?.pool[key(l, s)] || []).length;
  const cellBad = (l: string, s: string) => { const n = need(l, s); if (!n) return false; if (draft?.draw === 'random') return (avail[key(l, s)] || 0) < n; return basket(l, s) < n || (draft?.draw === 'fixed' && basket(l, s) !== n); };
  const problems = draft ? activeLevels.flatMap((l) => SKILLS.filter((s) => cellBad(l, s)).map((s) => `${l}/${skillLabel(s)}`)) : [];
  const set = (patch: Partial<Draft>) => setDraft((d) => d ? { ...d, ...patch } : d);
  const setCount = (l: string, s: string, v: number) => setDraft((d) => d ? { ...d, counts: { ...d.counts, [l]: { ...d.counts[l], [s]: Math.max(0, Math.min(40, v || 0)) } } } : d);
  const fill = (kind: 'original' | 'one' | 'zero') => setDraft((d) => d ? { ...d, counts: kind === 'original' ? JSON.parse(JSON.stringify(ORIGINAL)) : kind === 'one' ? Object.fromEntries(LEVELS.map((l) => [l, Object.fromEntries(SKILLS.map((s) => [s, 1]))])) : emptyCounts() } : d);
  async function save(thenActivate = false) {
    if (!draft) return; if (draft.name_ar.trim().length < 3) { setErr('اكتب اسمًا للنموذج (3 أحرف فأكثر)'); return; }
    const j = await post({ action: 'blueprint_save', ...payload(draft) }); if (!j) return;
    setDraft(draftFromRow(j.blueprint)); setOk(j.plan_errors?.length ? `حُفظ مسودّة — ملاحظات: ${j.plan_errors.join(' · ')}` : 'حُفظ');
    if (thenActivate && !j.plan_errors?.length) { const a = await post({ action: 'blueprint_status', id: j.blueprint.id, status: 'active' }); if (a) setOk('حُفظ وفُعّل — صار متاحًا للدعوات'); }
    void load();
  }
  async function status(r: Row, s: string, is_public?: boolean) { const j = await post({ action: 'blueprint_status', id: r.id, status: s, is_public }); if (j) { setOk(s === 'active' ? (is_public ? 'نشط ومعلن في /miaar' : 'نشط') : s === 'draft' ? 'عاد مسودّة' : 'أُرشف'); void load(); } }
  async function doPreview(r?: Row) { const j = await post(r ? { action: 'blueprint_preview', id: r.id } : { action: 'blueprint_preview', ...payload(draft as Draft) }); if (j) setPreview(j); }
  async function duplicate(r: Row) { const j = await post({ action: 'blueprint_duplicate', id: r.id }); if (j) { setOk('أُنشئت نسخة مسودّة'); setDraft(draftFromRow(j.blueprint)); void load(); } }
  async function remove(r: Row) { if (!confirm(`حذف «${r.name_ar}» نهائيًا؟`)) return; const j = await post({ action: 'blueprint_delete', id: r.id }); if (j) { setOk('حُذف'); if (draft?.id === r.id) setDraft(null); void load(); } }
  const typeOf = (id: string) => types.find((t) => t.id === id);

  return (
    <div className="fb"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="am-card">
        <div className="fb-head">
          <div><h3 style={{ margin: 0 }}>منشئ النماذج <small>المخطّط يضبط البنية، والبنود تُسحب عشوائيًا في كل جلسة من البنك المعتمد</small></h3>
            <p className="fb-sub">{data ? <>بنود صالحة للسحب الآن: <b>{data.pool_total}</b> · مخطّطات: <b>{rows.length}</b> · أبواب عامة في /miaar: <b>{rows.filter((r) => r.status === 'active' && r.is_public).length}</b></> : 'جارٍ التحميل…'}</p></div>
          <div className="fb-newbar">{types.map((t) => <button key={t.id} type="button" className="fb-newbtn" data-testid={`fb-new-${t.id}`} title={t.hint_ar} onClick={() => { setDraft(draftFor(t.id, types)); setOk(''); setErr(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Icon name="plus" />{t.name_ar}</button>)}</div>
        </div>
        {err && <div className="am-err" role="alert">{err}</div>}{ok && <div className="am-ok" role="status">{ok}</div>}

        {draft && <div className="fb-editor" data-testid="fb-editor">
          <div className="fb-eh"><h4>{draft.id ? `تعديل: ${draft.name_ar}` : `نموذج جديد — ${typeOf(draft.test_type)?.name_ar || draft.test_type}`} {draft.code && <code>{draft.code}</code>}</h4><button type="button" className="bk-x" aria-label="إغلاق" onClick={() => setDraft(null)}>×</button></div>
          <p className="fb-hint">{typeOf(draft.test_type)?.hint_ar}</p>
          <div className="fb-grid">
            <label>اسم النموذج<input data-testid="fb-name" value={draft.name_ar} maxLength={120} onChange={(e) => set({ name_ar: e.target.value })} /></label>
            <label>الاسم بالإنجليزية<input value={draft.name_en} maxLength={120} onChange={(e) => set({ name_en: e.target.value })} dir="ltr" /></label>
            <label>المدة (دقائق)<input type="number" min={5} max={240} value={draft.duration_minutes} onChange={(e) => set({ duration_minutes: Number(e.target.value) })} /></label>
            <label>حدّ الاجتياز %<input type="number" min={30} max={100} value={draft.cut_percent} onChange={(e) => set({ cut_percent: Number(e.target.value) })} /></label>
            <label>ترتيب الباب<input type="number" min={1} max={999} value={draft.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) })} /></label>
            {draft.test_type === 'level' && <label>المستوى<select value={draft.level} onChange={(e) => set({ level: e.target.value })}>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select></label>}
            {draft.test_type === 'custom' && <label>السلّم<select value={draft.ladder} onChange={(e) => set({ ladder: e.target.value, levels: e.target.value === 'single' ? [draft.levels[0] || 'A1'] : draft.levels })}>{Object.entries(LADDER_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
            {(draft.test_type === 'adaptive' || (draft.test_type === 'custom' && draft.ladder === 'adaptive')) && <label>نقطة البداية<select value={draft.start_level} onChange={(e) => set({ start_level: e.target.value })}>{activeLevels.map((l) => <option key={l} value={l}>{l}</option>)}</select></label>}
          </div>
          <label className="fb-full">وصف يظهر للمتقدّم<textarea rows={2} maxLength={400} value={draft.description_ar} onChange={(e) => set({ description_ar: e.target.value })} /></label>
          {draft.test_type !== 'level' && !(draft.test_type === 'custom' && draft.ladder === 'single') && <div className="fb-levels"><span>المستويات:</span>{LEVELS.map((l) => <button key={l} type="button" className={draft.levels.includes(l) ? 'on' : ''} aria-pressed={draft.levels.includes(l)} data-testid={`fb-level-${l}`} onClick={() => set({ levels: draft.levels.includes(l) ? draft.levels.filter((x) => x !== l) : [...draft.levels, l].sort((a, b) => LEVELS.indexOf(a as any) - LEVELS.indexOf(b as any)) })}>{l}</button>)}</div>}
          {draft.test_type === 'custom' && draft.ladder === 'single' && <div className="fb-levels"><span>المستوى:</span>{LEVELS.map((l) => <button key={l} type="button" className={draft.levels[0] === l ? 'on' : ''} onClick={() => set({ levels: [l] })}>{l}</button>)}</div>}
          <div className="fb-toggles">
            {(draft.test_type === 'placement' || draft.test_type === 'adaptive' || (draft.test_type === 'custom' && draft.ladder === 'adaptive')) && <label><input type="checkbox" checked={draft.probe} onChange={(e) => set({ probe: e.target.checked })} /> مِسبار يحدّد نقطة البداية</label>}
            <label><input type="checkbox" checked={draft.floor} onChange={(e) => set({ floor: e.target.checked })} /> أرضية ما قبل A1 (بنود مصوّرة لمن لم يجتز A1)</label>
            <label><input type="checkbox" checked={draft.shuffle_options} onChange={(e) => set({ shuffle_options: e.target.checked })} /> خلط ترتيب الخيارات</label>
          </div>

          <div className="fb-matrixhead"><b>مصفوفة البنود</b><div className="fb-quick"><button type="button" className="bk-soft" onClick={() => fill('original')}>خطة مِعيار (50)</button><button type="button" className="bk-soft" onClick={() => fill('one')}>بند لكل خلية (18)</button><button type="button" className="bk-soft" onClick={() => fill('zero')}>تصفير</button></div></div>
          <div className="bk-tablewrap"><table className="fb-m"><thead><tr><th>المستوى</th>{SKILLS.map((s) => <th key={s}>{skillLabel(s)}</th>)}<th>المجموع</th></tr></thead><tbody>
            {activeLevels.map((l) => <tr key={l}><th>{l}</th>{SKILLS.map((s) => <td key={s} className={cellBad(l, s) ? 'bad' : need(l, s) ? 'okc' : ''}>
              <input type="number" min={0} max={40} value={need(l, s)} data-testid={`fb-cell-${l}-${s}`} onChange={(e) => setCount(l, s, Number(e.target.value))} aria-label={`${l} ${skillLabel(s)}`} />
              <small>متاح {avail[key(l, s)] || 0}</small>
              {draft.draw !== 'random' && need(l, s) > 0 && <button type="button" className="fb-pick" data-testid={`fb-pick-${l}-${s}`} onClick={() => setPicking({ level: l, skill: s })}>السلّة {basket(l, s)}/{need(l, s)}</button>}
            </td>)}<td className="fb-sum">{SKILLS.reduce((a, s) => a + need(l, s), 0)}</td></tr>)}
          </tbody></table></div>
          <div className="fb-draw">{modes.map((m) => <label key={m.id} className={draft.draw === m.id ? 'on' : ''}><input type="radio" name="fb-draw" value={m.id} checked={draft.draw === m.id} onChange={() => set({ draw: m.id })} data-testid={`fb-draw-${m.id}`} /><b>{m.name_ar}</b><small>{m.hint_ar}</small></label>)}</div>
          <div className="fb-now"><span>المطلوب الآن: <b data-testid="fb-total">{total}</b> بندًا · {draft.duration_minutes} دقيقة · حدّ {draft.cut_percent}%</span>{problems.length > 0 && <span className="fb-warn">خلايا لا يكفيها البنك: {problems.join(' · ')}</span>}</div>
          <div className="fb-acts">
            <button type="button" className="bk-primary" data-testid="fb-save" disabled={busy !== ''} onClick={() => void save(false)}><Icon name="check" />{draft.id ? 'حفظ التعديلات' : 'حفظ مسودّة'}</button>
            <button type="button" className="bk-soft" data-testid="fb-save-activate" disabled={busy !== '' || problems.length > 0} onClick={() => void save(true)}>حفظ وتفعيل</button>
            <button type="button" className="bk-soft" data-testid="fb-preview" disabled={busy !== ''} onClick={() => void doPreview()}>معاينة سحب تجريبي</button>
            <button type="button" className="bk-soft" onClick={() => setDraft(null)}>إلغاء</button>
          </div>
        </div>}

        <div className="fb-filters"><button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>الكل</button>{types.map((t) => <button key={t.id} type="button" className={filter === t.id ? 'on' : ''} onClick={() => setFilter(t.id)}>{t.name_ar}</button>)}<button type="button" className={filter === 'archived' ? 'on' : ''} onClick={() => setFilter('archived')}>المؤرشف</button></div>
        <div className="fb-cards">
          {shown.map((r) => <article key={r.id} className={`fb-card ${r.status}`} data-testid="fb-card" data-code={r.code}>
            <header><span className={`bk-st ${r.status}`}>{STATUS_AR[r.status] || r.status}</span>{r.is_public && <span className="fb-pub">باب عام</span>}{r.is_system && <span className="fb-sys">نظامي</span>}<code>{r.code}</code></header>
            <h4>{r.name_ar}</h4><p className="fb-type">{r.type_name} · {LADDER_AR[r.ladder] || r.ladder}</p>
            <ul className="fb-facts"><li><b>{r.plan_total}</b> بندًا</li><li><b>{r.duration_minutes}</b> دقيقة</li><li>حدّ <b>{r.cut_percent}%</b></li><li>{(r.requirements?.levels || LEVELS).join(' ')}</li><li>{modes.find((m) => m.id === (r.requirements?.draw || 'random'))?.name_ar}</li></ul>
            {(r.plan_errors?.length > 0 || r.shortages?.length > 0) && <p className="fb-warn">{[...(r.plan_errors || []), ...(r.shortages || [])].slice(0, 3).join(' · ')}</p>}
            {usage[r.id] && <p className="fb-use">{usage[r.id].sessions} جلسة · {usage[r.id].invites} دعوة</p>}
            <div className="fb-cacts">
              <button type="button" className="bk-act" onClick={() => { setDraft(draftFromRow(r)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>تعديل</button>
              <button type="button" className="bk-act" onClick={() => void doPreview(r)}>معاينة سحب</button>
              {r.status !== 'active' && <button type="button" className="bk-act" data-testid="fb-activate" onClick={() => void status(r, 'active')}>تفعيل</button>}
              {r.status === 'active' && !r.is_public && <button type="button" className="bk-act" data-testid="fb-public" onClick={() => void status(r, 'active', true)}>إعلان كباب عام</button>}
              {r.status === 'active' && r.is_public && <button type="button" className="bk-act" onClick={() => void status(r, 'active', false)}>إخفاء من الأبواب</button>}
              {r.status === 'active' && <button type="button" className="bk-act" onClick={() => void status(r, 'draft', false)}>تعطيل</button>}
              <button type="button" className="bk-act" onClick={() => void duplicate(r)}>نسخ</button>
              {!r.is_system && r.status !== 'archived' && <button type="button" className="bk-act" onClick={() => void status(r, 'archived', false)}>أرشفة</button>}
              {!r.is_system && <button type="button" className="bk-act fb-del" onClick={() => void remove(r)}>حذف</button>}
            </div>
          </article>)}
          {data && !shown.length && <p className="fb-empty">لا مخطّطات في هذا التصنيف — أنشئ واحدًا من الأزرار أعلاه.</p>}
        </div>
      </section>

      {picking && draft && <Picker level={picking.level} skill={picking.skill} auth={auth} need={need(picking.level, picking.skill)} fixed={draft.draw === 'fixed'} selected={draft.pool[key(picking.level, picking.skill)] || []}
        onClose={() => setPicking(null)} onChange={(codes) => set({ pool: { ...draft.pool, [key(picking.level, picking.skill)]: codes } })} />}
      {preview && <div className="bk-backdrop" onClick={() => setPreview(null)}><div className="bk-edit fb-prev" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="معاينة سحب" data-testid="fb-preview-box">
        <div className="bk-eh"><h4>سحب تجريبي — {preview.plan?.name_ar} <small>{preview.drawn}/{preview.total} بندًا · كل معاينة سحب جديد</small></h4><button type="button" className="bk-x" onClick={() => setPreview(null)} aria-label="إغلاق">×</button></div>
        {(preview.plan_errors?.length > 0 || preview.shortages?.length > 0) && <p className="fb-warn">{[...(preview.plan_errors || []), ...(preview.shortages || [])].join(' · ')}</p>}
        {([...LEVELS, 'PRE_A1'] as string[]).filter((l) => preview.items.some((i: Row) => i.level === l)).map((l) => <div key={l} className="fb-prevlvl"><b>{l === 'PRE_A1' ? 'ما قبل A1' : l}</b><ol>{preview.items.filter((i: Row) => i.level === l).map((i: Row) => <li key={i.code}><code>{i.code}</code> <span>{skillLabel(i.skill)}</span> {i.text}</li>)}</ol></div>)}
        <div className="fb-acts"><button type="button" className="bk-soft" onClick={() => void (preview.plan?.code && preview.plan.code !== 'PREVIEW' ? doPreview(rows.find((r) => r.code === preview.plan.code)) : doPreview())}>سحب آخر</button><button type="button" className="bk-soft" onClick={() => setPreview(null)}>إغلاق</button></div>
      </div></div>}
    </div>
  );
}

function Picker({ level, skill, auth, need, fixed, selected, onClose, onChange }: { level: string; skill: string; auth: () => Promise<Record<string, string>>; need: number; fixed: boolean; selected: string[]; onClose: () => void; onChange: (codes: string[]) => void }) {
  const [items, setItems] = useState<Row[]>([]); const [q, setQ] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { let on = true; (async () => { setLoading(true); const j = await fetch(`/api/admin/miaar/forms?cell=${level}&skill=${skill}&q=${encodeURIComponent(q)}`, { headers: await auth(), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (on) { setItems(j?.items || []); setLoading(false); } })(); return () => { on = false; }; }, [level, skill, q, auth]);
  const sel = new Set(selected); const toggle = (c: string) => { const n = new Set(sel); if (n.has(c)) n.delete(c); else n.add(c); onChange([...n]); };
  return <div className="bk-backdrop" onClick={onClose}><div className="bk-edit" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="اختيار البنود" data-testid="fb-picker">
    <div className="bk-eh"><h4>{level} · {skillLabel(skill)} <small>{fixed ? `اختر ${need} بالضبط` : `اختر ${need} فأكثر — الجلسة تسحب ${need} منها عشوائيًا`} · المختار {selected.length}</small></h4><button type="button" className="bk-x" onClick={onClose} aria-label="إغلاق">×</button></div>
    <div className="bk-row"><input placeholder="بحث بالرمز أو النص" value={q} onChange={(e) => setQ(e.target.value)} /><button type="button" className="bk-soft" onClick={() => onChange(items.map((i) => i.code))}>تحديد الكل</button><button type="button" className="bk-soft" onClick={() => onChange([])}>مسح</button></div>
    {loading ? <p>جارٍ التحميل…</p> : <ul className="fb-pl">{items.map((i) => <li key={i.code} className={sel.has(i.code) ? 'on' : ''}><label><input type="checkbox" checked={sel.has(i.code)} onChange={() => toggle(i.code)} data-testid="fb-picker-item" /><code>{i.code}</code><span>{i.text}</span>{i.passage && <small>{i.passage}</small>}</label></li>)}{!items.length && <li>لا بنود معتمدة صالحة في هذه الخلية.</li>}</ul>}
    <div className="fb-acts"><button type="button" className="bk-primary" onClick={onClose}><Icon name="check" />تم</button></div>
  </div></div>;
}

const CSS = `
.fb-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}.fb-head h3 small{display:block;color:#64748b;font-weight:600;font-size:13px;margin-top:4px}.fb-sub{margin:6px 0 0;color:#334155;font-size:13px}
.fb-newbar{display:flex;gap:6px;flex-wrap:wrap;max-width:560px;justify-content:flex-end}.fb-newbtn{display:inline-flex;align-items:center;gap:6px;border:1px solid #0f2a4e;background:#0f2a4e;color:#fff;border-radius:999px;padding:7px 14px;font-weight:800;font-size:13px;cursor:pointer;min-height:38px}.fb-newbtn:hover{background:#163a6b}.fb-newbtn svg{width:14px;height:14px}
.fb-editor{border:1px solid #e2e8f0;border-radius:16px;padding:16px;background:#f8fafc;margin:12px 0;display:grid;gap:10px}.fb-eh{display:flex;justify-content:space-between;align-items:center}.fb-eh h4{margin:0}.fb-eh code{margin-inline-start:8px;font-size:12px;color:#64748b}.fb-hint{margin:0;color:#475569;font-size:13px}
.fb-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.fb-grid label,.fb-full{display:grid;gap:4px;font-size:13px;font-weight:800}.fb-grid input,.fb-grid select,.fb-full textarea{border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;min-height:36px;background:#fff}.fb-full textarea{font-weight:500}
.fb-levels{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:13px;font-weight:800}.fb-levels button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:5px 12px;font-weight:800;cursor:pointer;min-height:32px}.fb-levels button.on{background:#0b8a83;border-color:#0b8a83;color:#fff}
.fb-toggles{display:flex;gap:16px;flex-wrap:wrap;font-size:13px}.fb-toggles label{display:flex;gap:6px;align-items:center}
.fb-matrixhead{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px}.fb-quick{display:flex;gap:6px;flex-wrap:wrap}
.fb-m{width:100%;border-collapse:separate;border-spacing:4px}.fb-m th{font-size:13px;padding:4px}.fb-m td{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:6px;text-align:center;min-width:110px}.fb-m td.okc{border-color:#a7f3d0}.fb-m td.bad{border-color:#fca5a5;background:#fff1f2}.fb-m td input{width:64px;border:1px solid #cbd5e1;border-radius:8px;padding:6px;font:inherit;font-weight:800;text-align:center}.fb-m td small{display:block;color:#64748b;font-size:11.5px;margin-top:3px}.fb-m td.bad small{color:#b91c1c;font-weight:800}.fb-sum{font-weight:900;color:#0f2a4e}
.fb-pick{margin-top:4px;border:1px dashed #0b8a83;background:#ecfdf5;color:#065f46;border-radius:8px;padding:3px 8px;font-size:12px;font-weight:800;cursor:pointer}
.fb-draw{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}.fb-draw label{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#fff;cursor:pointer;font-size:13px}.fb-draw label.on{border-color:#c9a24b;box-shadow:0 0 0 2px #fbf5e4}.fb-draw label small{grid-column:2;color:#64748b;font-weight:500}
.fb-now{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13px;font-weight:800;color:#0f2a4e}.fb-warn{color:#b91c1c;font-size:12.5px;font-weight:800;margin:4px 0}.fb-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.fb-filters{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 8px}.fb-filters button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:5px 12px;font-weight:800;font-size:12.5px;cursor:pointer;min-height:32px}.fb-filters button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.fb-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}.fb-card{border:1px solid #e2e8f0;border-radius:16px;padding:14px;background:#fff;display:grid;gap:6px;align-content:start}.fb-card.active{border-color:#0b8a83}.fb-card.archived{opacity:.65}.fb-card header{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.fb-card header code{margin-inline-start:auto;font-size:11.5px;color:#64748b}.fb-card h4{margin:2px 0 0;font-size:16px}.fb-type{margin:0;color:#475569;font-size:12.5px}
.fb-pub{background:#c9a24b;color:#0b2a4a;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:900}.fb-sys{background:#e2e8f0;color:#334155;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:800}
.fb-facts{list-style:none;margin:0;padding:0;display:flex;gap:10px;flex-wrap:wrap;font-size:12.5px;color:#334155}.fb-use{margin:0;color:#64748b;font-size:12px}.fb-cacts{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}.fb-del{color:#b91c1c!important}.fb-empty{color:#64748b;grid-column:1/-1}
.fb-prevlvl{border-top:1px solid #e2e8f0;padding-top:6px}.fb-prevlvl ol{margin:4px 0 0;padding-inline-start:20px;font-size:13px}.fb-prevlvl li span{color:#0b8a83;font-weight:800;margin:0 6px}
.fb-pl{list-style:none;margin:0;padding:0;display:grid;gap:4px;max-height:50vh;overflow:auto}.fb-pl li{border:1px solid #e2e8f0;border-radius:10px;padding:6px 8px;font-size:13px}.fb-pl li.on{border-color:#0b8a83;background:#ecfdf5}.fb-pl label{display:flex;gap:8px;align-items:center;cursor:pointer}.fb-pl code{font-size:11.5px}.fb-pl small{color:#64748b;margin-inline-start:auto}
`;
