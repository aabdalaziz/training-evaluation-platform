'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// إدارة أَثَر — قاعدة الأدلة المؤسسية «الذاكرة الحية» (P14-أ): اسأل الذاكرة بالأدلة · كوكبة الأثر · درس الأسبوع (يعتمده إنسان) · موجز الأدلة للطباعة
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { VoiceButton } from '../../components/Channel';
import { KIND_LABEL } from '../../../lib/portal/evidence';
import type { EvidenceAnswer, StarNode, Rel, NodeKind } from '../../../lib/portal/evidence';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
type Lesson = { id: string; week: string; title_ar: string; body_ar: string; evidence: { label: string; value: string }[]; status: 'draft' | 'approved' | 'rejected'; created_at: string };
type Data = { stats: { nodes: number; edges: number; skills: number; people: number; evidence: number; updated_at: string | null }; constellation: { stars: StarNode[]; links: { a: string; b: string; w: number; rel: Rel }[] }; lessons: Lesson[]; recent: { id: string; created_at: string; question: string; template: string | null; source: string; ok: boolean; answer: EvidenceAnswer | null }[]; templates: { id: string; title_ar: string; example_ar: string }[] };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const KIND_COLOR: Record<NodeKind, string> = { skill: '#c9a24b', program: '#0b8a83', session: '#38bdf8', scenario: '#a78bfa', mission: '#f472b6', channel: '#ffffff', sector: '#94a3b8', org: '#fb923c', trainer: '#34d399', contract: '#f87171' };
const CONF = { strong: 'أدلة قوية', medium: 'أدلة متوسطة', weak: 'أدلة أولية' };

export default function AdminEvidencePage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [tok, setTok] = useState(''); const [data, setData] = useState<Data | null>(null);
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(false); const [ans, setAns] = useState<{ answer: EvidenceAnswer; source: string; model: string | null; query_id: string | null } | null>(null);
  const [pick, setPick] = useState<string | null>(null); const [story, setStory] = useState<string[]>([]); const [refreshing, setRefreshing] = useState(false); const [tab, setTab] = useState<'ask' | 'map' | 'lessons'>('ask');
  const hdr = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }), [tok]);

  async function load(tk: string) { const j = await fetch('/api/evidence?graph=1', { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setData(j); }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/evidence'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
      const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function ask(question?: string) {
    const text = (question ?? q).trim(); if (text.length < 4 || busy) return; setBusy(true); setAns(null); setQ(text);
    const j = await fetch('/api/evidence', { method: 'POST', headers: hdr, body: JSON.stringify({ action: 'ask', question: text }) }).then(r => r.json()).catch(() => null);
    if (!j?.success) setError(j?.error || 'تعذّر السؤال'); else if (j.empty) setError(j.error); else { setError(''); setAns({ answer: j.answer, source: j.source, model: j.model, query_id: j.query_id }); }
    setBusy(false); await load(tok);
  }
  async function refresh() { setRefreshing(true); const j = await fetch('/api/evidence', { method: 'POST', headers: hdr, body: JSON.stringify({ action: 'refresh' }) }).then(r => r.json()).catch(() => null); if (!j?.success) setError(j?.refresh?.error || j?.error || 'تعذّر التحديث'); else setError(''); await load(tok); setRefreshing(false); }
  async function decideLesson(id: string, status: 'approved' | 'rejected') { await fetch('/api/evidence', { method: 'POST', headers: hdr, body: JSON.stringify({ action: 'lesson', id, status }) }); await load(tok); }
  async function draftLesson() { const j = await fetch('/api/evidence', { method: 'POST', headers: hdr, body: JSON.stringify({ action: 'lesson_draft' }) }).then(r => r.json()); if (!j?.lesson?.created) setError(j?.lesson?.error || 'لا أدلة كافية لدرس هذا الأسبوع بعد (≥ 5 أشخاص).'); await load(tok); }
  async function openNode(id: string) { setPick(id); setStory([]); const j = await fetch(`/api/evidence?node=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json()); setStory(j?.story || []); }
  function printBrief() { window.print(); }

  if (!ready) return <div className="ev"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="ev-wrap"><div className="ev-card">{error ? <span className="ev-err">{error}</span> : 'جارٍ فتح الذاكرة…'}</div></div></div>;
  const st = data?.stats; const con = data?.constellation; const drafts = (data?.lessons || []).filter(l => l.status === 'draft');
  return (
    <div className="ev"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ev-wrap">
        <header className="ev-head no-print"><div><span className="ev-kicker"><Icon name="compass" size={14} /> بوابة أَثَر · P14-أ</span><h1>قاعدة الأدلة المؤسسية — الذاكرة الحية</h1><p>كل برنامج ومهارة وجلسة ومحاكٍ ومهمة وجهة = عقدة؛ وكل دليل تعلّم = خيط موزون. اسأل بالعربية وسيُجاب من قوالب أسئلة معتمدة — الذكاء الاصطناعي يوجّه السؤال ولا يكتب استعلامات، والأرقام كلها من الأدلة.</p></div></header>
        <div className="no-print"><PortalAdminTabs counts={{ '/admin/evidence': drafts.length }} /></div>
        {error && <div className="ev-err no-print">{error}</div>}
        <div className="ev-kpis no-print"><span><b>{st?.evidence ?? 0}</b> الأدلة</span><span><b>{st?.people ?? 0}</b> الأشخاص</span><span><b>{st?.skills ?? 0}</b> مهارات تحرّكت</span><span><b>{st?.edges ?? 0}</b> خيوط الشبكة</span><span className="ev-upd">آخر بناء: {fmt(st?.updated_at || null)} <button type="button" className="pt-btn ghost small" onClick={refresh} disabled={refreshing}><Icon name="refresh" size={13} /> {refreshing ? 'يُبنى…' : 'حدّث الذاكرة الآن'}</button></span></div>
        <div className="ev-tabs no-print"><button className={tab === 'ask' ? 'on' : ''} onClick={() => setTab('ask')}>اسأل الذاكرة</button><button className={tab === 'map' ? 'on' : ''} onClick={() => setTab('map')}>كوكبة الأثر</button><button className={tab === 'lessons' ? 'on' : ''} onClick={() => setTab('lessons')}>درس الأسبوع {drafts.length ? <i>{drafts.length}</i> : null}</button></div>

        {tab === 'ask' && (
          <section className="ev-card">
            <div className="ev-askrow no-print" data-testid="evidence-ask"><input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ask(); }} maxLength={400} placeholder="مثال: أي قناة تعلّم تنقل الأثر أكثر؟ · ماذا فعلت جامعة الأمير مقرن في 2026؟ · أين الفجوات؟" /><VoiceButton lang="ar" onText={t => setQ(x => (x ? x + ' ' : '') + t)} /><button type="button" className="pt-btn gold" disabled={busy || q.trim().length < 4} onClick={() => ask()}>{busy ? 'تبحث في الأدلة…' : 'اسأل'}</button></div>
            <div className="ev-chips no-print">{(data?.templates || []).slice(0, 10).map(t => <button key={t.id} type="button" onClick={() => ask(t.example_ar)}>{t.example_ar}</button>)}</div>
            {ans && (
              <article className="ev-answer" data-testid="evidence-answer">
                <div className="ev-anshead"><div><span className="ev-kicker">الاستعلام بالأدلة · {ans.source === 'ai' ? 'وُجّه بالذكاء الاصطناعي' : 'وُجّه محليًا'}</span><h2>{ans.answer.title_ar}</h2></div><span className={`ev-conf ${ans.answer.confidence}`}>{CONF[ans.answer.confidence]}</span></div>
                <p className="ev-lead">{ans.answer.answer_ar}</p>
                {!!ans.answer.chain.length && <div className="ev-chain">{ans.answer.chain.map((c, i) => <span key={i}><small>{c.label}</small><b>{c.value}</b></span>)}</div>}
                {!!ans.answer.rows.length && <ul className="ev-rows">{ans.answer.rows.map((r, i) => <li key={i}><span className="ev-rank">{i + 1}</span><div><b>{r.label}</b>{r.sub && <small>{r.sub}</small>}</div><em>{r.value}</em>{r.id && <button type="button" className="ev-link no-print" onClick={() => { setTab('map'); openNode(r.id!); }}>افتح الدليل</button>}</li>)}</ul>}
                <div className="ev-ansfoot"><div className="no-print">{ans.answer.suggestions.map(s => <button key={s} type="button" className="ev-sugg" onClick={() => ask(s)}>{s}</button>)}</div><button type="button" className="pt-btn light small no-print" onClick={printBrief}><Icon name="print" size={13} /> حوّله إلى موجز أدلة</button></div>
                <footer className="ev-brieffoot print-only">موجز أدلة من قاعدة الأدلة المؤسسية — بوابة أَثَر · {new Date().toLocaleDateString('ar-SA-u-nu-latn-ca-gregory')} · الأرقام من أدلة تعلّم موزونة يعتمدها بشر؛ لا أسماء أفراد. © 2026 د. أحمد محمد عبدالعزيز بدوي — شركة بوابة التميز للاستشارات والتدريب</footer>
              </article>
            )}
            {!ans && !!data?.recent?.length && <div className="ev-recent no-print"><h4>آخر الأسئلة</h4>{data.recent.slice(0, 8).map(r => <button key={r.id} type="button" onClick={() => ask(r.question)}><span>{r.question}</span><small>{r.template || '—'} · {r.source === 'ai' ? 'ذكاء اصطناعي' : 'محلي'}</small></button>)}</div>}
          </section>
        )}

        {tab === 'map' && con && (
          <section className="ev-card ev-mapcard">
            <div className="ev-maphead"><div><h3>كوكبة الأثر</h3><p>المهارات ذهبية في الحلقة الوسطى، قنوات التعلّم بيضاء في المركز، والبرامج والجلسات والجهات والمدربون في المدار الخارجي. سُمك الخيط = وزن الدليل. اضغط نجمة لتقرأ قصتها.</p></div><div className="ev-legend">{(Object.keys(KIND_LABEL) as NodeKind[]).filter(k => k !== 'sector').map(k => <span key={k}><i style={{ background: KIND_COLOR[k] }} />{KIND_LABEL[k].ar}</span>)}</div></div>
            <div className="ev-mapgrid">
              <svg viewBox="0 0 900 520" className="ev-svg" data-testid="constellation" role="img" aria-label="كوكبة الأثر">
                <defs><radialGradient id="evbg" cx="50%" cy="50%" r="70%"><stop offset="0" stopColor="#163b6b" /><stop offset="1" stopColor="#0a1f3a" /></radialGradient></defs>
                <rect width="900" height="520" fill="url(#evbg)" rx="16" />
                {con.links.map((l, i) => { const a = con.stars.find(s => s.id === l.a), b = con.stars.find(s => s.id === l.b); if (!a || !b) return null; const hot = pick && (l.a === pick || l.b === pick); return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hot ? '#c9a24b' : l.rel === 'raised' ? '#7dd3fc' : '#94a3b8'} strokeOpacity={hot ? 0.95 : 0.22} strokeWidth={Math.min(6, 0.6 + l.w * 0.12)} />; })}
                {con.stars.map(s => <g key={s.id} className="ev-star" onClick={() => openNode(s.id)} style={{ cursor: 'pointer' }}><circle cx={s.x} cy={s.y} r={s.r + (pick === s.id ? 4 : 0)} fill={KIND_COLOR[s.kind]} fillOpacity={s.kind === 'channel' ? 0.95 : 0.85} stroke={pick === s.id ? '#fff' : 'rgba(255,255,255,.35)'} strokeWidth={pick === s.id ? 2 : 1} /><text x={s.x} y={s.y + s.r + 12} textAnchor="middle" fontSize={s.kind === 'skill' ? 11 : 10} fill="#e2e8f0">{s.label_ar.length > 18 ? s.label_ar.slice(0, 17) + '…' : s.label_ar}</text></g>)}
                {!con.stars.length && <text x="450" y="260" textAnchor="middle" fill="#cbd5e1" fontSize="16">الذاكرة فارغة — اضغط «حدّث الذاكرة الآن»</text>}
              </svg>
              <aside className="ev-story" data-testid="node-story">{pick ? (story.length ? <><b>{con.stars.find(s => s.id === pick)?.label_ar || pick}</b>{story.map((s, i) => <p key={i}>{s}</p>)}</> : <p>…</p>) : <p className="ev-muted">اختر نجمة لتقرأ قصتها في ثلاث جمل.</p>}</aside>
            </div>
          </section>
        )}

        {tab === 'lessons' && (
          <section className="ev-card">
            <div className="ev-maphead"><div><h3>درس الأسبوع</h3><p>كل أحد تقترح الذاكرة درسًا واحدًا تعلّمته المؤسسة من أدلتها. لا يظهر في الرئيسية ولا في تقارير الجهات حتى يعتمده إنسان.</p></div><button type="button" className="pt-btn light small" onClick={draftLesson}><Icon name="plus" size={13} /> مسودة هذا الأسبوع</button></div>
            {!data?.lessons?.length && <p className="ev-muted">لا دروس بعد — تُقترح تلقائيًا حين تبلغ الأدلة 5 أشخاص فأكثر.</p>}
            <ul className="ev-lessons" data-testid="lessons">{(data?.lessons || []).map(l => <li key={l.id} className={l.status}><div className="ev-lhead"><span className={`ev-st ${l.status}`}>{l.status === 'draft' ? 'مسودة' : l.status === 'approved' ? 'معتمد' : 'مرفوض'}</span><small>أسبوع {l.week}</small></div><b>{l.title_ar}</b><p>{l.body_ar}</p>{!!l.evidence?.length && <div className="ev-chain small">{l.evidence.map((c, i) => <span key={i}><small>{c.label}</small><b>{c.value}</b></span>)}</div>}{l.status === 'draft' && <div className="ev-decide"><button type="button" className="pt-btn gold small" onClick={() => decideLesson(l.id, 'approved')}><Icon name="check" size={13} /> اعتمد وانشر</button><button type="button" className="pt-btn ghost small" onClick={() => decideLesson(l.id, 'rejected')}><Icon name="x" size={13} /> ارفض</button></div>}</li>)}</ul>
          </section>
        )}
      </div>
    </div>
  );
}

const CSS = `
.ev{padding:20px 16px 48px;background:#f6f8fb;min-height:60vh;font-family:inherit}
.ev-wrap{max-width:1100px;margin:0 auto;display:grid;gap:12px}
.ev-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.ev-head p{margin:0;color:#64748b;font-size:14px;line-height:1.7;max-width:900px}.ev-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b8a83}
.ev-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px}.ev-err{color:#b91c1c;font-size:13px}.ev-muted{color:#64748b;font-size:13.5px}
.ev-kpis{display:flex;gap:16px;font-size:14px;color:#475569;flex-wrap:wrap;align-items:center}.ev-kpis b{color:#0f2a4e;font-size:20px;margin-inline-end:4px}.ev-upd{margin-inline-start:auto;font-size:12.5px;display:inline-flex;gap:8px;align-items:center}
.ev-tabs{display:flex;gap:6px;flex-wrap:wrap}.ev-tabs button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:800;color:#475569;cursor:pointer}.ev-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.ev-tabs i{font-style:normal;background:#c9a24b;color:#0f2a4e;border-radius:999px;padding:0 7px;font-size:11px;margin-inline-start:4px}
.ev-askrow{display:flex;gap:8px;align-items:center}.ev-askrow input{flex:1;border:1px solid #cbd5e1;border-radius:12px;padding:12px 14px;font:inherit;font-size:15px}
.ev-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.ev-chips button{border:1px dashed #cbd5e1;background:#f8fafc;border-radius:999px;padding:5px 11px;font:inherit;font-size:12.5px;color:#0f2a4e;cursor:pointer}.ev-chips button:hover{background:#eef2f7}
.ev-answer{margin-top:16px;border-top:1px solid #e2e8f0;padding-top:14px}.ev-anshead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.ev-anshead h2{margin:2px 0 0;font-size:20px;color:#0f2a4e}
.ev-conf{font-size:11px;font-weight:900;padding:4px 10px;border-radius:999px;background:#eef2f7;color:#475569;white-space:nowrap}.ev-conf.strong{background:#e6f4f1;color:#0b8a83}.ev-conf.medium{background:#fdf6e3;color:#9a6b00}
.ev-lead{font-size:16.5px;line-height:1.9;color:#1e293b;margin:10px 0}
.ev-chain{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.ev-chain span{display:inline-flex;flex-direction:column;background:#0f2a4e;color:#fff;border-radius:10px;padding:6px 12px;min-width:90px}.ev-chain small{font-size:10.5px;color:#c9a24b;font-weight:800}.ev-chain b{font-size:13.5px}.ev-chain.small span{padding:4px 10px;min-width:70px}
.ev-rows{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:6px}.ev-rows li{display:flex;align-items:center;gap:10px;border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px}.ev-rank{width:24px;height:24px;border-radius:50%;background:#c9a24b;color:#0f2a4e;font-weight:900;font-size:12px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}.ev-rows b{display:block;color:#0f2a4e;font-size:14px}.ev-rows small{color:#64748b;font-size:12px}.ev-rows em{margin-inline-start:auto;font-style:normal;color:#0b8a83;font-weight:900;white-space:nowrap}.ev-link{border:0;background:transparent;color:#0b8a83;font:inherit;font-size:12px;cursor:pointer;text-decoration:underline}
.ev-ansfoot{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:12px;flex-wrap:wrap}.ev-sugg{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:5px 11px;font:inherit;font-size:12.5px;color:#0f2a4e;cursor:pointer;margin:0 0 4px 4px}
.ev-recent{margin-top:14px}.ev-recent h4{margin:0 0 6px;font-size:13px;color:#0b8a83}.ev-recent button{display:flex;justify-content:space-between;gap:10px;width:100%;text-align:start;border:0;border-top:1px solid #f1f5f9;background:transparent;padding:7px 2px;font:inherit;font-size:13.5px;color:#1e293b;cursor:pointer}.ev-recent small{color:#94a3b8;font-size:11.5px;white-space:nowrap}
.ev-maphead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.ev-maphead h3{margin:0;font-size:18px;color:#0f2a4e}.ev-maphead p{margin:4px 0 0;color:#64748b;font-size:13px;line-height:1.7;max-width:720px}
.ev-legend{display:flex;gap:8px;flex-wrap:wrap;font-size:11.5px;color:#475569}.ev-legend span{display:inline-flex;align-items:center;gap:4px}.ev-legend i{width:10px;height:10px;border-radius:50%;display:inline-block;border:1px solid #cbd5e1}
.ev-mapgrid{display:grid;grid-template-columns:1fr 260px;gap:12px;margin-top:12px}.ev-svg{width:100%;height:auto;border-radius:16px;display:block}.ev-star:hover circle{stroke:#fff;stroke-width:2}
.ev-story{background:#0f2a4e;color:#fff;border-radius:16px;padding:14px 16px;font-size:13.5px;line-height:1.8}.ev-story b{display:block;color:#c9a24b;margin-bottom:6px}.ev-story p{margin:0 0 6px}.ev-story .ev-muted{color:#cbd5e1}
.ev-lessons{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:10px}.ev-lessons li{border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px}.ev-lessons li.approved{border-color:#0b8a83}.ev-lessons li.rejected{opacity:.6}.ev-lhead{display:flex;gap:8px;align-items:center;margin-bottom:4px}.ev-lhead small{color:#64748b;font-size:12px}.ev-lessons b{display:block;color:#0f2a4e;font-size:15px}.ev-lessons p{margin:4px 0 6px;color:#1e293b;font-size:13.5px;line-height:1.8}
.ev-st{font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:#fdf6e3;color:#9a6b00}.ev-st.approved{background:#e6f4f1;color:#0b8a83}.ev-st.rejected{background:#fee2e2;color:#b91c1c}.ev-decide{display:flex;gap:8px;margin-top:8px}
.print-only{display:none}
@media print{.no-print,.pt-header,.pt-footer,nav,header.pt-top{display:none!important}.ev{background:#fff;padding:0}.ev-card{border:0;padding:0}.ev-answer{border:0;padding:0;margin:0}.print-only{display:block}.ev-brieffoot{margin-top:24px;border-top:1px solid #999;padding-top:8px;font-size:11px;color:#444}.ev-chain span{border:1px solid #000;color:#000;background:#fff}.ev-chain small{color:#000}}
@media (max-width:860px){.ev-mapgrid{grid-template-columns:1fr}.ev-askrow{flex-wrap:wrap}.ev-askrow input{min-width:100%}}
`;
