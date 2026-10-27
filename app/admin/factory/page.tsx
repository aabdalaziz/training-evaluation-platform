'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// إدارة أَثَر — مصنع البرامج (P13-أ): من الاحتياج الإنساني (القطاع × المجال × المرحلة × المؤسسة × الأفق × الفجوة) إلى برنامج مسودّة
// عبر أربع محطات: محلل الاحتياج → المصمم التعليمي → مراجع الجودة → الاعتماد البشري. الذكاء الاصطناعي يقترح، والإنسان يعتمد وينشر.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { HUMAN_DOMAINS, FAMILIES, HORIZONS, HORIZON_LABEL, SECTORS_2062, domainByCode, familyName } from '../../../lib/portal/lexicon';
import { STAGES, LIFE_STAGES, INSTITUTIONS, EMPTY_NEED, validateNeed, stageLabel } from '../../../lib/portal/factory';
import type { Draft, Need, Stage } from '../../../lib/portal/factory';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const fmt = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
type Data = { drafts: Draft[]; stats: { total: number; by_stage: Record<Stage, number>; by_domain: { code: string; h: string; n: number }[]; horizons: Record<string, number> }; skills: { id: string; code: string; name_ar: string; domain_code?: string | null }[] };
const ACT: Record<string, string> = { approve: 'اعتُمدت المحطة وانتقلت المسودّة إلى التالية', foresight: 'أُعيد الاستشراف', design: 'أُعيد التصميم', review: 'أُعيدت المراجعة', update: 'حُفظت الملاحظات' };
const STAGE_COLOR: Record<Stage, string> = { foresight: '#64748b', designed: '#0b8a83', reviewed: '#c9a24b', published: '#16a34a' };

export default function AdminFactoryPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [ok, setOk] = useState(''); const [tok, setTok] = useState(''); const [busy, setBusy] = useState('');
  const [data, setData] = useState<Data | null>(null); const [tab, setTab] = useState<'board' | 'new'>('board'); const [selId, setSelId] = useState<string | null>(null); const [need, setNeed] = useState<Need>(EMPTY_NEED); const [pubSkills, setPubSkills] = useState<string[]>([]); const [notes, setNotes] = useState('');
  const H = (tk = tok) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` });
  async function load(tk = tok) { const j = await fetch('/api/factory', { headers: H(tk) }).then(r => r.json()); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setData(j); }
  async function post(body: any): Promise<any> { setBusy(body.action); setError(''); setOk(''); try { const j = await fetch('/api/factory', { method: 'POST', headers: H(), body: JSON.stringify(body) }).then(r => r.json()); if (!j.success) throw new Error(j.error || 'خطأ'); await load(); return j; } catch (e: any) { setError(e.message); return null; } finally { setBusy(''); } }
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/factory'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
    const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sel = useMemo(() => data?.drafts.find(d => d.id === selId) || null, [data, selId]);
  useEffect(() => { if (sel) { setNotes(sel.notes || ''); const dom = sel.need.domain_code; setPubSkills((data?.skills || []).filter(s => s.domain_code === dom).slice(0, 4).map(s => s.id)); } }, [sel, data]);
  const needErr = validateNeed(need);
  const sector = SECTORS_2062.find(s => s.code === need.sector); const dom = domainByCode(need.domain_code);

  async function create() { const j = await post({ action: 'create', need }); if (j) { setOk(`أُنشئت المسودّة وكتب محلل الاحتياج الاستشراف (${j.source === 'ai' ? 'ذكاء اصطناعي' : 'البديل المحلي'})`); setSelId(j.draft.id); setTab('board'); setNeed(EMPTY_NEED); } }
  async function run(action: string, extra: any = {}) { if (!sel) return; const j = await post({ action, id: sel.id, ...extra }); if (j) setOk(action === 'publish' ? `نُشر البرنامج كمسودّة (${j.program_id}) — أكمل بياناته من «نشر البرامج»` : `${ACT[action] || 'تم'} (${j.source === 'ai' ? 'ذكاء اصطناعي' : j.source === 'local' ? 'البديل المحلي' : 'قرار بشري'})`); }
  async function del() { if (!sel || !confirm('حذف المسودّة نهائيًا؟')) return; const id = sel.id; setSelId(null); const j = await post({ action: 'delete', id }); if (j) setOk('حُذفت'); }

  if (!ready) return <main className="fc"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="fc-wrap"><div className="fc-card fc-empty">جارٍ التحميل…</div></div></main>;
  const st = data?.stats;
  return (
    <main className="fc">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="fc-wrap">
        <header className="fc-head"><div><span className="fc-kicker"><Icon name="compass" size={14} /> بوابة أَثَر · P13-أ</span><h1>مصنع البرامج</h1><p>منظومة تصميم البرامج المدعومة بالذكاء الاصطناعي: تبدأ من <b>الاحتياج الإنساني</b> لا من الموضوع (القطاع × المجال H1–H12 × المرحلة × المؤسسة × الأفق × الفجوة)، وتمرّ بأربع محطات — محلل الاحتياج، المصمم التعليمي، مراجع الجودة، ثم <b>الاعتماد البشري</b>. لكل محطة بديل محلي كامل؛ لا يُنشر شيء إلا بقرار إنسان مسمّى.</p></div></header>
        <PortalAdminTabs />
        {error && <div className="fc-err">{error}</div>}{ok && <div className="fc-ok">{ok}</div>}
        {st && <div className="fc-card fc-kpis"><span><b>{st.total}</b> مسودّة</span>{STAGES.map(s => <span key={s.code}><b style={{ color: STAGE_COLOR[s.code] }}>{st.by_stage[s.code] || 0}</b> {s.label_ar}</span>)}<span className="fc-sep" />{HORIZONS.map(h => <span key={h}><b>{st.horizons[String(h)] || 0}</b> {h}</span>)}</div>}
        <div className="fc-tabs"><button className={tab === 'board' ? 'on' : ''} onClick={() => setTab('board')}>لوحة المصنع ({data?.drafts.length || 0})</button><button className={tab === 'new' ? 'on' : ''} onClick={() => setTab('new')}>احتياج جديد</button></div>

        {tab === 'new' && <div className="fc-card">
          <h3>1) صِف الاحتياج — لا الموضوع</h3>
          <div className="fc-row">
            <label>القطاع<select value={need.sector} onChange={e => setNeed({ ...need, sector: e.target.value })}><optgroup label="قطاعات قائمة">{SECTORS_2062.filter(s => s.kind === 'existing').map(s => <option key={s.code} value={s.code}>{s.name.ar}</option>)}</optgroup><optgroup label="قطاعات مستحدثة">{SECTORS_2062.filter(s => s.kind === 'new').map(s => <option key={s.code} value={s.code}>{s.name.ar}</option>)}</optgroup></select></label>
            <label>المجال (H1–H12)<select value={need.domain_code} onChange={e => setNeed({ ...need, domain_code: e.target.value as Need['domain_code'] })}>{HUMAN_DOMAINS.map(d => <option key={d.code} value={d.code}>{d.h} · {d.name.ar}</option>)}</select></label>
            <label>العائلة (F1–F8)<select value={need.family} onChange={e => setNeed({ ...need, family: e.target.value as Need['family'] })}>{FAMILIES.map(f => <option key={f.code} value={f.code}>{f.f} · {f.name.ar}</option>)}</select></label>
            <label>المرحلة العمرية<select value={need.stage} onChange={e => setNeed({ ...need, stage: e.target.value as Need['stage'] })}>{LIFE_STAGES.map(s => <option key={s.code} value={s.code}>{s.label_ar}</option>)}</select></label>
            <label>مؤسسة البناء<select value={need.institution} onChange={e => setNeed({ ...need, institution: e.target.value as Need['institution'] })}>{INSTITUTIONS.map(s => <option key={s.code} value={s.code}>{s.label_ar}</option>)}</select></label>
            <label>الأفق الزمني<select value={need.horizon} onChange={e => setNeed({ ...need, horizon: Number(e.target.value) as Need['horizon'] })}>{HORIZONS.map(h => <option key={h} value={h}>{HORIZON_LABEL[h].ar}</option>)}</select></label>
          </div>
          <div className="fc-row"><label>الفئة المستهدفة<input value={need.audience_ar} onChange={e => setNeed({ ...need, audience_ar: e.target.value })} placeholder="مثال: مشرفو الأقسام في المستشفيات الحكومية" maxLength={200} /></label><label>الجهة (اختياري)<input value={need.org_name || ''} onChange={e => setNeed({ ...need, org_name: e.target.value })} maxLength={160} /></label></div>
          <label>فجوة الجدارات — ما الذي لا يستطيعونه اليوم وسيُدفع مقابله في هذا الأفق؟<textarea rows={4} value={need.gap_ar} onChange={e => setNeed({ ...need, gap_ar: e.target.value })} placeholder="مثال: يقبلون توصيات النظام الذكي بلا تحقق، ولا يكتبون حدود تفويض، ولا يوثّقون قراراتهم حين تتعارض الأنظمة…" maxLength={1200} /></label>
          {sector && dom && <div className="fc-preview"><b>ما يقوله الأطلس:</b> في {sector.name.ar} — {need.horizon === 2035 ? sector.w2035 : need.horizon === 2050 ? sector.w2050 : sector.w2070}. <b>الندرة في المجال:</b> {dom.scarce_2062.ar}.</div>}
          <div className="fc-decide">{needErr && <small className="fc-muted">{needErr}</small>}<button className="fc-btn gold" disabled={!!needErr || busy === 'create'} onClick={create}><Icon name="play" size={14} /> {busy === 'create' ? 'محلل الاحتياج يعمل…' : 'أنشئ المسودّة وشغّل محلل الاحتياج'}</button></div>
        </div>}

        {tab === 'board' && <div className="fc-grid2">
          <div className="fc-card">
            {(data?.drafts.length || 0) === 0 && <div className="fc-empty">لا مسودّات بعد — ابدأ من «احتياج جديد».</div>}
            {(data?.drafts.length || 0) > 0 && <div className="fc-board">{STAGES.map(s => <div key={s.code} className="fc-col"><div className="fc-colhead" style={{ borderColor: STAGE_COLOR[s.code] }}><b>{s.label_ar}</b><small>{s.agent_ar}</small></div>
              {data!.drafts.filter(d => d.stage === s.code).map(d => { const dm = domainByCode(d.need.domain_code); return <button key={d.id} className={`fc-item ${selId === d.id ? 'sel' : ''}`} onClick={() => setSelId(d.id)}><b>{d.design?.brand_ar || d.title_ar}</b><small>{dm?.h} · {SECTORS_2062.find(x => x.code === d.need.sector)?.name.ar} · {d.need.horizon}</small>{d.review && <i style={{ color: d.review.verdict === 'approve' ? '#16a34a' : '#b45309' }}>مراجعة {d.review.score}%</i>}</button>; })}
            </div>)}</div>}
          </div>
          <div className="fc-card fc-detail">
            {!sel && <div className="fc-empty">اختر مسودّة من اللوحة لعرض محطاتها.</div>}
            {sel && <>
              <div className="fc-dhead"><div><span className="fc-st" style={{ background: STAGE_COLOR[sel.stage] }}>{stageLabel(sel.stage)}</span><h3>{sel.design?.brand_ar || sel.title_ar}</h3><small>{sel.design?.subtitle_ar || sel.title_ar}</small></div><div className="fc-actions">
                {sel.stage === 'foresight' && <button className="fc-btn gold" disabled={!!busy} onClick={() => run('approve')}><Icon name="check" size={14} /> اعتمد الاستشراف → صمّم</button>}
                {sel.stage === 'designed' && <button className="fc-btn gold" disabled={!!busy} onClick={() => run('approve')}><Icon name="check" size={14} /> اعتمد المخطط → راجع</button>}
                {sel.stage === 'reviewed' && <button className="fc-btn gold" disabled={!!busy} onClick={() => run('publish', { skill_ids: pubSkills })}><Icon name="globe" size={14} /> انشر برنامجًا مسودّة</button>}
                {sel.stage === 'published' && sel.program_id && <a className="fc-btn ghost" href="/admin/catalog"><Icon name="link" size={14} /> نشر البرامج</a>}
                <button className="fc-btn ghost small" disabled={!!busy} onClick={() => run('foresight')}>أعد الاستشراف</button>
                {sel.foresight && <button className="fc-btn ghost small" disabled={!!busy} onClick={() => run('design')}>أعد التصميم</button>}
                {sel.design && <button className="fc-btn ghost small" disabled={!!busy} onClick={() => run('review')}>أعد المراجعة</button>}
                <button className="fc-btn ghost small danger" disabled={!!busy} onClick={del}>حذف</button>
              </div></div>
              {busy && <div className="fc-think"><i /><i /><i /> {busy === 'approve' || busy === 'design' ? 'المصمم التعليمي يبني المخطط…' : busy === 'review' ? 'مراجع الجودة يفحص…' : busy === 'foresight' ? 'محلل الاحتياج يستشرف…' : 'جارٍ…'}</div>}
              <div className="fc-need"><b>الاحتياج:</b> {domainByCode(sel.need.domain_code)?.h} {domainByCode(sel.need.domain_code)?.name.ar} · {familyName(sel.need.family, 'ar')} · {SECTORS_2062.find(x => x.code === sel.need.sector)?.name.ar} · {LIFE_STAGES.find(x => x.code === sel.need.stage)?.label_ar} · {INSTITUTIONS.find(x => x.code === sel.need.institution)?.label_ar} · {HORIZON_LABEL[sel.need.horizon].ar}<br /><b>الفئة:</b> {sel.need.audience_ar}{sel.need.org_name ? ` · ${sel.need.org_name}` : ''}<br /><b>الفجوة:</b> {sel.need.gap_ar}</div>

              {sel.foresight && <section className="fc-sec"><h4><Icon name="compass" size={14} /> محلل الاحتياج — الاستشراف</h4>
                <p className="fc-lead">{sel.foresight.headline_ar}</p><p>{sel.foresight.why_now_ar}</p>
                <div className="fc-two"><div><b>الندرة:</b> {sel.foresight.scarce_ar}<br /><b>الموجة:</b> {sel.foresight.wave_ar}<br /><b>الجدارات:</b> {sel.foresight.competencies_ar.join(' · ')}</div><div><b>المخاطر:</b><ul>{sel.foresight.risks_ar.map((r, k) => <li key={k}>{r}</li>)}</ul><b>المؤشرات:</b> {sel.foresight.indicators_ar.join(' · ')}<br /><b>الشواهد:</b> {sel.foresight.evidence_kinds.join(' · ')}</div></div>
              </section>}

              {sel.design && <section className="fc-sec"><h4><Icon name="target" size={14} /> المصمم التعليمي — مخطط البرنامج</h4>
                <div className="fc-brand"><b>{sel.design.brand_ar}</b><span>{sel.design.subtitle_ar}</span><small>{sel.design.name_en} · سقف {sel.design.saqf_level} · {sel.design.hours} ساعة / {sel.design.weeks} أسابيع · {sel.design.delivery === 'remote' ? 'عن بُعد' : sel.design.delivery === 'onsite' ? 'حضوري' : 'هجين'} · تسعير استرشادي {sel.design.price_hint_sar.toLocaleString('en-US')} ر.س</small></div>
                <p>{sel.design.intro_ar}</p>
                <div className="fc-two"><div><b>الأهداف (أفعال قابلة للقياس):</b><ol>{sel.design.objectives_ar.map((o, k) => <li key={k}>{o}</li>)}</ol></div><div><b>المخرجات:</b><ul>{sel.design.outcomes_ar.map((o, k) => <li key={k}>{o}</li>)}</ul><b>التقويم:</b><ul>{sel.design.assessment_ar.map((o, k) => <li key={k}>{o}</li>)}</ul></div></div>
                <table className="fc-table"><thead><tr><th>#</th><th>الوحدة</th><th>الناتج</th><th>المحاكاة/الموقف</th><th>المهمة التطبيقية</th><th>الشاهد</th><th>س</th></tr></thead><tbody>{sel.design.modules.map((m, k) => <tr key={k}><td>{k + 1}</td><td><b>{m.title_ar}</b></td><td>{m.outcome_ar}</td><td>{m.simulation_ar}</td><td>{m.mission_ar}</td><td>{m.evidence_ar}</td><td>{m.hours}</td></tr>)}</tbody></table>
                <div className="fc-two"><div><b>مؤشرات الأثر (للعقد القائم على النتائج):</b><ul>{sel.design.impact_indicators_ar.map((o, k) => <li key={k}>{o}</li>)}</ul><small className="fc-muted">تقسيم العقد {sel.design.contract_split.delivery}/{sel.design.contract_split.evidence}/{sel.design.contract_split.impact}</small></div><div><b>البوابات البشرية:</b><ul>{sel.design.human_gates_ar.map((o, k) => <li key={k}>{o}</li>)}</ul></div></div>
              </section>}

              {sel.review && <section className="fc-sec"><h4><Icon name="shield" size={14} /> مراجع الجودة — {sel.review.score}% · {sel.review.verdict === 'approve' ? 'جاهز للاعتماد' : 'يحتاج مراجعة'}</h4>
                <p>{sel.review.summary_ar}</p>
                <ul className="fc-check">{sel.review.items.map(i => <li key={i.code} className={i.ok ? 'ok' : 'no'}><Icon name={i.ok ? 'check' : 'alert'} size={13} /> <b>{i.label_ar}</b> — {i.note_ar}</li>)}</ul>
              </section>}

              {sel.stage === 'reviewed' && <section className="fc-sec"><h4><Icon name="globe" size={14} /> الاعتماد البشري — النشر</h4>
                <p className="fc-muted">سيُنشأ برنامج <b>مسودّة</b> (غير معلن، التسجيل مغلق) باسم «{sel.design?.brand_ar} — {sel.design?.subtitle_ar}» مع أهدافه ومخرجاته وفئته؛ تُكمل الرسوم والمواعيد من «نشر البرامج». اختر المهارات التي يُثبتها:</p>
                <div className="fc-skills">{(data?.skills || []).map(s => <label key={s.id} className={pubSkills.includes(s.id) ? 'on' : ''}><input type="checkbox" checked={pubSkills.includes(s.id)} onChange={e => setPubSkills(p => e.target.checked ? [...p, s.id] : p.filter(x => x !== s.id))} /> {s.code} · {s.name_ar}</label>)}</div>
              </section>}

              <section className="fc-sec"><h4><Icon name="inbox" size={14} /> ملاحظات بشرية وسجل</h4>
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات المصمم البشري…" /><div className="fc-decide"><button className="fc-btn ghost small" disabled={!!busy} onClick={() => run('update', { patch: { notes } })}>احفظ الملاحظات</button></div>
                <ul className="fc-log">{(sel.log || []).slice(-8).reverse().map((l, k) => <li key={k}><small>{fmt(l.at)}</small> {l.by} — {l.action}{l.source ? ` (${l.source === 'ai' ? 'ذكاء اصطناعي' : 'محلي'})` : ''}</li>)}</ul>
              </section>
            </>}
          </div>
        </div>}
      </div>
    </main>
  );
}

const CSS = `
.fc{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;direction:rtl}
.fc-wrap{max-width:1200px;margin:0 auto;display:grid;gap:12px}
.fc-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.fc-head p{margin:0;color:#64748b;font-size:14px;line-height:1.8;max-width:960px}.fc-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b8a83}
.fc-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;overflow-x:auto}.fc-card h3{margin:0 0 10px;color:#0f2a4e;font-size:17px}.fc-card h4{margin:0 0 8px;color:#0b8a83;font-size:13.5px;display:flex;align-items:center;gap:8px}
.fc-empty{color:#64748b;font-size:14px;text-align:center;padding:20px;line-height:1.8}.fc-err{color:#b91c1c;font-size:13px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 12px}.fc-ok{color:#065f46;font-size:13px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px}.fc-muted{color:#64748b;font-size:12.5px}
.fc-kpis{display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:13px;color:#475569}.fc-kpis b{font-size:18px;color:#0f2a4e;margin-inline-end:4px}.fc-sep{width:1px;height:20px;background:#e2e8f0}
.fc-tabs{display:flex;gap:6px;flex-wrap:wrap}.fc-tabs button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:800;color:#334155;cursor:pointer}.fc-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.fc-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}.fc-card label{display:block;font-size:12.5px;color:#334155;font-weight:700;margin:8px 0}.fc-card label input,.fc-card label select,.fc-card textarea{display:block;width:100%;margin-top:4px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;font-weight:500;box-sizing:border-box}
.fc-preview{background:#f3fbfa;border:1px solid #cfe9e6;border-radius:12px;padding:10px 14px;font-size:13.5px;line-height:1.8;color:#0f172a;margin-top:8px}
.fc-decide{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}
.fc-btn{border:1px solid #0f2a4e;background:#0f2a4e;color:#fff;border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none}.fc-btn.ghost{background:#fff;color:#0f2a4e;border-color:#cbd5e1}.fc-btn.small{padding:4px 9px;font-size:12px}.fc-btn.danger{color:#b91c1c;border-color:#fecaca}.fc-btn.gold{background:#c9a24b;border-color:#c9a24b;color:#0f2a4e}.fc-btn:disabled{opacity:.5;cursor:not-allowed}
.fc-grid2{display:grid;grid-template-columns:.9fr 1.1fr;gap:12px;align-items:start}
.fc-board{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;min-width:520px}.fc-col{display:grid;gap:6px;align-content:start}.fc-colhead{border-top:4px solid;border-radius:8px 8px 0 0;padding:6px 8px;background:#f8fafc}.fc-colhead b{display:block;font-size:13px;color:#0f2a4e}.fc-colhead small{color:#64748b;font-size:11px}
.fc-item{text-align:right;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:8px;font:inherit;cursor:pointer;display:grid;gap:2px}.fc-item b{font-size:12.5px;color:#0f2a4e;line-height:1.5}.fc-item small{color:#64748b;font-size:11px}.fc-item i{font-style:normal;font-size:11px;font-weight:800}.fc-item.sel{border-color:#0b8a83;background:#f0fdfa}
.fc-detail{display:grid;gap:12px}.fc-dhead{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}.fc-dhead h3{margin:4px 0 0}.fc-dhead small{color:#64748b;font-size:12px}.fc-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.fc-st{color:#fff;font-size:11px;font-weight:900;border-radius:999px;padding:2px 8px}
.fc-think{display:flex;gap:4px;align-items:center;color:#0b8a83;font-size:13px;font-weight:800}.fc-think i{width:7px;height:7px;border-radius:50%;background:#0b8a83;animation:fcB 1s infinite}.fc-think i:nth-child(2){animation-delay:.2s}.fc-think i:nth-child(3){animation-delay:.4s}@keyframes fcB{0%,100%{opacity:.3}50%{opacity:1}}
.fc-need{background:#f8fafc;border-radius:12px;padding:10px 14px;font-size:13px;line-height:1.9;color:#334155}
.fc-sec{border-top:1px solid #e2e8f0;padding-top:10px;font-size:13.5px;line-height:1.85;color:#0f172a}.fc-sec p{margin:0 0 8px}.fc-sec ul,.fc-sec ol{margin:4px 0 8px;padding-inline-start:18px}.fc-lead{font-weight:900;color:#0f2a4e;font-size:15px}
.fc-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.fc-brand{background:linear-gradient(135deg,#0f2a4e,#163a66);color:#fff;border-radius:14px;padding:14px 16px;margin-bottom:10px;display:grid;gap:2px}.fc-brand b{font-size:20px;color:#f1dfae}.fc-brand span{font-size:14px}.fc-brand small{font-size:12px;opacity:.85}
.fc-table{width:100%;border-collapse:collapse;font-size:12.5px;margin:8px 0}.fc-table th{text-align:right;color:#64748b;font-weight:800;font-size:11.5px;padding:6px 8px;border-bottom:1px solid #e2e8f0}.fc-table td{padding:7px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top;line-height:1.6}
.fc-check{list-style:none;padding:0;margin:0;display:grid;gap:4px}.fc-check li{display:flex;gap:6px;align-items:flex-start;font-size:13px}.fc-check li.ok{color:#065f46}.fc-check li.no{color:#b45309}
.fc-skills{display:flex;flex-wrap:wrap;gap:6px}.fc-skills label{display:inline-flex!important;align-items:center;gap:4px;border:1px solid #e2e8f0;border-radius:999px;padding:3px 10px!important;margin:0!important;font-size:12px!important;cursor:pointer}.fc-skills label.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.fc-skills input{width:auto!important;display:inline!important;margin:0!important}
.fc-log{list-style:none;padding:0;margin:8px 0 0;font-size:12px;color:#475569;display:grid;gap:2px}.fc-log small{color:#94a3b8;margin-inline-end:6px}
@media (max-width:980px){.fc-grid2,.fc-two{grid-template-columns:1fr}}
`;
