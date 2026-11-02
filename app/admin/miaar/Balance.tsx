'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «ميزان مِعيار» (م3) — لسان 05 في /admin/miaar/balance
 *  شهادات موثوقية المستويات والنماذج (ضوء + ماذا يلزم) · «بنود تحتاج نظرة» بأعلام بلغة الإنسان وقرارات بشرية (نقل/رفض/مرساة)
 *  · المستنزَفة → «بنك يتنفّس» (شقيق مسودة) · خريطة راش (شرائط HTML بحسب المستوى) · كل البنود بالأرقام · زر «أعد الوزن»
 *  الأسماء الرسمية هنا: تحليل البنود · موثوقية النموذج · المعايرة · ثبات القرار. لا اسم ولا بريد في أي خانة.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../../lib/ui/icons';

type Scope = { scope: string; n: number; k: number; method: string; rel: number; sem: number; cut: number; pass_rate: number; livingston: number; light: 'green' | 'yellow' | 'red' | 'gray'; light_ar: string; advice: string };
type Row = { item: string; level: string; skill: string | null; n: number; p: number; rpb: number; distractors: Record<string, number>; median_ms: number | null; exposure: number; flags: string[]; flags_ar: string[]; severity: number; b: number | null; se: number | null; infit: number | null; outfit: number | null; calib_n: number; suggest_level: string | null; is_anchor: boolean; status: string; question_text: string };
type Summary = { computed_at: string | null; sessions: number; items: number; scopes: Scope[]; rows: Row[]; attention: Row[]; overexposed: Row[]; rasch: { persons: number; iterations: number; converged: boolean; calibrated: number } | null; bands: { medians: Record<string, number> } | null; thresholds: { min_n_item: number; min_n_calib: number; reweigh_every: number } };

const LIGHT_COLOR: Record<string, string> = { green: '#0b8a83', yellow: '#b7791f', red: '#b91c1c', gray: '#64748b' };
const LEVEL_AR: Record<string, string> = { PRE_A1: 'ما قبل A1', A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' };
const SKILL_AR: Record<string, string> = { grammar_vocab: 'قواعد ومفردات', reading: 'قراءة', listening: 'استماع' };
const pct = (v: number) => `${Math.round(v * 100)}%`;
const secs = (ms: number | null) => (ms == null ? '—' : `${Math.round(ms / 1000)} ث`);

export default function Balance({ auth }: { auth: () => Promise<Record<string, string>> }) {
  const [d, setD] = useState<Summary | null>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(''); const [showAll, setShowAll] = useState(false); const [level, setLevel] = useState('all');
  async function load() { const j = await fetch('/api/admin/miaar/balance', { headers: await auth(), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.success) { setErr(j?.error || 'تعذّر تحميل الميزان'); return; } setD(j); }
  async function post(body: Record<string, unknown>) { setBusy(String(body.action) + String(body.item_code || '')); setErr(''); setOk(''); try { const j = await fetch('/api/admin/miaar/balance', { method: 'POST', headers: await auth(), body: JSON.stringify(body) }).then((r) => r.json()); if (!j?.success) setErr(j?.error || 'تعذّر'); else setOk(j.note_ar || 'تم'); await load(); } finally { setBusy(''); } }
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const levels = (d?.scopes || []).filter((s) => s.scope.startsWith('level:')); const forms = (d?.scopes || []).filter((s) => s.scope.startsWith('form:'));
  const rows = (d?.rows || []).filter((r) => level === 'all' || r.level === level);
  const calibrated = (d?.rows || []).filter((r) => r.b != null && r.calib_n >= (d?.thresholds.min_n_calib || 100));
  const bMin = Math.min(-3, ...calibrated.map((r) => r.b as number)); const bMax = Math.max(3, ...calibrated.map((r) => r.b as number)); const pos = (b: number) => `${((b - bMin) / (bMax - bMin)) * 100}%`;
  return (
    <div className="bal" data-testid="mi-balance">
      <style>{CSS}</style>
      {err && <div className="am-err" role="alert">{err}</div>}{ok && <div className="am-ok" role="status" data-testid="bal-ok">{ok}</div>}
      <section className="am-card bal-head">
        <div>
          <h3>ميزان مِعيار <small>المقياس الذي يزن نفسه — من إجابات حقيقية، مجمّعة، بلا أسماء</small></h3>
          <p className="mm-note">{d?.computed_at ? <>آخر وزن: {new Date(d.computed_at).toLocaleString('ar-SA')} · {d.sessions} جلسة · {d.items} بندًا له إحصاء{d.rasch ? ` · معايرة راش: ${d.rasch.calibrated} بندًا معايَرًا من ${d.rasch.persons} متقدّمًا${d.rasch.converged ? '' : ' (لم تتقارب بعد)'}` : ''}</> : 'لم يُوزن بعد — يبدأ تلقائيًا كل 25 جلسة منتهية، أو الآن بالزر.'}
            {' '}لا أرقام لبند قبل {d?.thresholds.min_n_item ?? 30} إجابة، ولا معايرة قبل {d?.thresholds.min_n_calib ?? 100}.</p>
        </div>
        <button type="button" className="am-btn" data-testid="bal-reweigh" disabled={!!busy} onClick={() => post({ action: 'reweigh' })}><Icon name="refresh" size={16} /> {busy === 'reweigh' ? 'يزن…' : 'أعد الوزن الآن'}</button>
      </section>

      <section className="am-card"><h3>شهادات موثوقية النماذج <small>المرجع الذي يُبنى عليه قرار التسكين/الاجتياز — وهو ما يراه المتقدّم في بطاقته وفي /miaar/trust</small></h3>
        {!forms.length ? <div className="am-empty">لا نماذج موزونة بعد — تظهر مع أول وزن بعد 30 جلسة على النموذج.</div> : <div className="bal-lights" data-testid="bal-forms">
          {forms.map((s) => <article key={s.scope} className="bal-light" style={{ borderColor: LIGHT_COLOR[s.light] }} data-testid={`bal-form-${s.scope.slice(5)}`} data-light={s.light}>
            <header><b style={{ fontSize: 15 }}><code dir="ltr">{s.scope.slice(5)}</code></b><span className="bal-dot" style={{ background: LIGHT_COLOR[s.light] }} aria-hidden /><small>{s.light_ar}</small></header>
            <dl><div><dt>الموثوقية</dt><dd>{s.rel.toFixed(2)} <small>({s.method === 'alpha' ? 'ألفا' : 'KR-21'})</small></dd></div><div><dt>الجلسات</dt><dd>{s.n}</dd></div><div><dt>البنود</dt><dd>{s.k}</dd></div><div><dt>SEM</dt><dd>{Number(s.sem).toFixed(2)}</dd></div><div><dt>ثبات القرار</dt><dd>{Number(s.livingston).toFixed(2)}</dd></div><div><dt>الاجتياز</dt><dd>{pct(Number(s.pass_rate))}</dd></div></dl>
            <p>{s.advice}</p>
          </article>)}
        </div>}
      </section>

      <section className="am-card"><h3>لبنات المستويات داخل النماذج <small>كتل قصيرة (6–8 بنود) فموثوقيتها أدنى بطبيعتها — تُرشدك إلى المستوى الذي يحتاج بنودًا أقوى · ألفا على البنود الثنائية · ثبات القرار عند حدّ الاجتياز</small></h3>
        {!levels.length ? <div className="am-empty">لا شهادات بعد — تظهر مع أول وزن.</div> : <div className="bal-lights" data-testid="bal-levels">
          {levels.map((s) => <article key={s.scope} className="bal-light" style={{ borderColor: LIGHT_COLOR[s.light] }} data-testid={`bal-level-${s.scope.slice(6)}`} data-light={s.light}>
            <header><b>{LEVEL_AR[s.scope.slice(6)] || s.scope.slice(6)}</b><span className="bal-dot" style={{ background: LIGHT_COLOR[s.light] }} aria-hidden /><small>{s.light_ar}</small></header>
            <dl><div><dt>الموثوقية</dt><dd>{s.rel.toFixed(2)} <small>({s.method === 'alpha' ? 'ألفا' : 'KR-21'})</small></dd></div><div><dt>الجلسات</dt><dd>{s.n}</dd></div><div><dt>البنود</dt><dd>{s.k}</dd></div><div><dt>SEM</dt><dd>{Number(s.sem).toFixed(2)}</dd></div><div><dt>ثبات القرار</dt><dd>{Number(s.livingston).toFixed(2)}</dd></div><div><dt>الاجتياز</dt><dd>{pct(Number(s.pass_rate))}</dd></div></dl>
            <p>{s.advice}</p>
          </article>)}
        </div>}
      </section>

      <section className="am-card"><h3>بنود تحتاج نظرة <small>أعلام التحليل الكلاسيكي واقتراحات المعايرة — القرار لك، ويُسجَّل باسمك</small></h3>
        {!d?.attention.length ? <div className="am-empty" data-testid="bal-attention-empty">لا شيء يستدعي النظر الآن.</div> : <table className="mm-t" data-testid="bal-attention"><thead><tr><th>البند</th><th>المستوى</th><th>n</th><th>p</th><th>r-pb</th><th>الأعلام</th><th>المعايرة</th><th></th></tr></thead><tbody>
          {d.attention.map((r) => <tr key={r.item} data-testid="bal-attn-row" data-item={r.item} data-severity={r.severity}>
            <td><code dir="ltr">{r.item}</code><br /><small>{r.question_text}</small></td><td>{LEVEL_AR[r.level] || r.level}{r.skill ? <><br /><small>{SKILL_AR[r.skill] || r.skill}</small></> : null}</td><td>{r.n}</td><td>{r.p.toFixed(2)}</td><td style={{ color: r.rpb < 0 ? '#b91c1c' : r.rpb < 0.15 ? '#b7791f' : '#0b8a83', fontWeight: 800 }}>{r.rpb.toFixed(2)}</td>
            <td><ul className="bal-flags">{r.flags_ar.map((f) => <li key={f} className={r.flags.includes('distractor_beats_key') && f.startsWith('مشتِّت أقوى') ? 'hot' : ''}>{f}</li>)}</ul><small>الخيارات: {Object.entries(r.distractors).map(([k, v]) => `${k} ${pct(v)}`).join(' · ')}</small></td>
            <td>{r.b != null ? <>b = {r.b.toFixed(2)} ± {Number(r.se).toFixed(2)}<br /><small>infit {Number(r.infit).toFixed(2)} · outfit {Number(r.outfit).toFixed(2)}</small></> : <small>بلا معايرة بعد ({r.calib_n}/{d.thresholds.min_n_calib})</small>}
              {r.suggest_level ? <div className="bal-sug" data-testid="bal-suggest">يُقترح نقله إلى <b>{LEVEL_AR[r.suggest_level] || r.suggest_level}</b></div> : null}</td>
            <td className="mm-acts">
              {r.suggest_level ? <><button type="button" className="am-btn" data-testid={`bal-accept-${r.item}`} disabled={!!busy} onClick={() => post({ action: 'accept_move', item_code: r.item, to: r.suggest_level })}>اعتمد النقل</button><button type="button" className="am-btn ghost" disabled={!!busy} onClick={() => post({ action: 'dismiss', item_code: r.item })}>ارفض</button></> : null}
              <button type="button" className="am-btn ghost" disabled={!!busy} onClick={() => post({ action: 'anchor', item_code: r.item, anchor: !r.is_anchor })}>{r.is_anchor ? 'إلغاء المرساة' : 'مرساة'}</button>
              <Link href={`/admin/miaar/bank?q=${encodeURIComponent(r.item)}`} className="am-btn ghost">افتح في البنك</Link>
            </td>
          </tr>)}
        </tbody></table>}
      </section>

      <section className="am-card"><h3>بنك يتنفّس <small>بند عُرض ≥ 400 مرة يُقترح له شقيق بالمواصفة نفسها — مسودة لا تصل إلى متقدّم قبل اعتمادك</small></h3>
        {!d?.overexposed.length ? <div className="am-empty">لا بند مستنزَفًا بعد.</div> : <table className="mm-t"><thead><tr><th>البند</th><th>المستوى</th><th>عُرض</th><th>p</th><th></th></tr></thead><tbody>
          {d.overexposed.map((r) => <tr key={r.item}><td><code dir="ltr">{r.item}</code><br /><small>{r.question_text}</small></td><td>{LEVEL_AR[r.level] || r.level}</td><td>{r.exposure}</td><td>{r.p.toFixed(2)}</td><td><button type="button" className="am-btn" data-testid={`bal-sibling-${r.item}`} disabled={!!busy} onClick={() => post({ action: 'sibling', item_code: r.item })}>{busy === 'sibling' + r.item ? 'يكتب…' : 'اقترح شقيقًا'}</button></td></tr>)}
        </tbody></table>}
      </section>

      {calibrated.length ? <section className="am-card"><h3>خريطة المعايرة <small>صعوبة كل بند معايَر على سلّم اللوجِت — وسيط كل مستوى بخط</small></h3>
        <div className="bal-map" data-testid="bal-map">
          {Object.keys(LEVEL_AR).filter((L) => calibrated.some((r) => r.level === L)).map((L) => <div key={L} className="bal-lane"><span className="bal-lane-l">{LEVEL_AR[L]}</span><div className="bal-lane-t">
            {d?.bands?.medians?.[L] != null ? <i className="bal-med" style={{ insetInlineStart: pos(d.bands.medians[L]) }} title={`الوسيط ${d.bands.medians[L]}`} /> : null}
            {calibrated.filter((r) => r.level === L).map((r) => <b key={r.item} className={r.suggest_level ? 'off' : ''} style={{ insetInlineStart: pos(r.b as number) }} title={`${r.item} · b=${r.b}`} />)}
          </div></div>)}
          <div className="bal-axis"><span>أسهل {bMin.toFixed(1)}</span><span>0</span><span>{bMax.toFixed(1)} أصعب</span></div>
        </div>
      </section> : null}

      <section className="am-card"><h3>كل البنود بالأرقام <small>{rows.length} بندًا</small>
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="bal-sel" aria-label="المستوى"><option value="all">كل المستويات</option>{Object.entries(LEVEL_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button type="button" className="am-btn ghost" onClick={() => setShowAll((v) => !v)}>{showAll ? 'أخفِ' : 'أظهر'}</button></h3>
        {showAll && <table className="mm-t" data-testid="bal-all"><thead><tr><th>البند</th><th>المستوى</th><th>المهارة</th><th>n</th><th>عُرض</th><th>p</th><th>r-pb</th><th>زمن</th><th>b</th><th>مرساة</th><th>الأعلام</th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.item}><td><code dir="ltr">{r.item}</code></td><td>{LEVEL_AR[r.level] || r.level}</td><td>{r.skill ? SKILL_AR[r.skill] || r.skill : '—'}</td><td>{r.n}</td><td>{r.exposure}</td><td>{r.p.toFixed(2)}</td><td>{r.rpb.toFixed(2)}</td><td>{secs(r.median_ms)}</td><td>{r.b != null ? r.b.toFixed(2) : '—'}</td><td>{r.is_anchor ? '⚓' : ''}</td><td><small>{r.flags_ar.join(' · ') || '—'}</small></td></tr>)}
        </tbody></table>}
      </section>
      <p className="mm-foot">الميزان يقترح ولا يقرّر: نقل بند، رفض اقتراح، تعيين مرساة، أو اعتماد شقيق — كلها قرارات بشرية مسجَّلة في سجلّ المراجعة. الصفحة العامة <Link href="/miaar/trust">/miaar/trust</Link> تعرض أضواء المستويات فقط.</p>
    </div>
  );
}

const CSS = `
.bal-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}
.bal-lights{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.bal-light{border:2px solid #cbd5e1;border-radius:16px;padding:12px 14px;background:#fff;display:grid;gap:8px}.bal-light header{display:flex;align-items:center;gap:8px}.bal-light header b{font-size:20px;color:#0f2a4e}.bal-light header small{color:#475569;font-weight:800}
.bal-dot{width:12px;height:12px;border-radius:50%;display:inline-block}
.bal-light dl{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:0}.bal-light dt{font-size:11px;color:#64748b}.bal-light dd{margin:0;font-weight:800;color:#0f2a4e;font-size:14px}.bal-light p{margin:0;font-size:12.5px;color:#334155;line-height:1.7}
.bal-forms{margin-top:12px}.bal-forms summary{cursor:pointer;font-weight:800;color:#0f2a4e}
.bal-flags{list-style:none;padding:0;margin:0 0 4px;display:flex;flex-wrap:wrap;gap:4px}.bal-flags li{background:#f1f5f9;border-radius:999px;padding:2px 8px;font-size:11.5px;font-weight:800;color:#334155}.bal-flags li.hot{background:#fef2f2;color:#991b1b}
.bal-sug{margin-top:4px;background:#fff7e6;border:1px solid #f1dfae;border-radius:10px;padding:4px 8px;font-size:12px}
.bal-map{display:grid;gap:6px}.bal-lane{display:grid;grid-template-columns:80px 1fr;align-items:center;gap:8px}.bal-lane-l{font-weight:800;color:#0f2a4e;font-size:13px}.bal-lane-t{position:relative;height:22px;background:linear-gradient(90deg,#e6f4f3,#fff 50%,#fdf4f1);border-radius:8px;border:1px solid #e2e8f0}
.bal-lane-t b{position:absolute;top:5px;width:10px;height:10px;border-radius:50%;background:#0f2a4e;transform:translateX(50%)}.bal-lane-t b.off{background:#b91c1c}.bal-med{position:absolute;top:0;bottom:0;width:2px;background:#c9a24b;transform:translateX(50%)}
.bal-axis{display:flex;justify-content:space-between;font-size:11px;color:#64748b;padding-inline-start:88px}
.bal-sel{font:inherit;border:1px solid #e2e8f0;border-radius:10px;padding:4px 8px;margin-inline:8px;min-height:36px}
`;
