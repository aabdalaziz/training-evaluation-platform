'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// إدارة أَثَر — منظومة التحسين المستمر القائمة على الأدلة «الحلقة المغلقة» (P15): اقتراحات من الذاكرة → قرار بشري → أثر مسجَّل · «ما تعلّمته أَثَر هذا الشهر» · توقّع القدرة المؤسسية
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { KIND_LABEL_AR, TREND_AR } from '../../../lib/portal/loop';
import type { SuggestionKind, Trend } from '../../../lib/portal/loop';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
type Sugg = { id: string; kind: SuggestionKind; title_ar: string; why_ar: string; evidence: { label: string; value: string }[]; target: any; score: number; status: 'draft' | 'accepted' | 'dismissed' | 'expired'; note: string | null; outcome: any; created_at: string; decided_at: string | null; expires_at: string };
type Learned = { proposed: number; accepted: number; dismissed: number; expired: number; outcomes: number; acceptance: number; kinds: Record<string, { proposed: number; accepted: number; dismissed: number }>; lessons: string[] };
type Fc = { organization_id: string; org_ar: string; skill_id: string; skill_ar: string; trend: Trend; slope: number; people: number; evidence: number; computed_at: string };
type Data = { suggestions: Sugg[]; learned: Learned; forecasts: Fc[]; stats: { draft: number; accepted: number; dismissed: number; forecasts: number; orgs: number }; templates: { id: string; title_ar: string }[]; month: string };
const KINDS: SuggestionKind[] = ['program', 'mission', 'session_focus', 'org_step'];
const KIND_ICON: Record<SuggestionKind, string> = { program: 'book', mission: 'target', session_focus: 'play', org_step: 'school' };
const TREND_COLOR: Record<Trend, string> = { rising: '#0b8a83', steady: '#64748b', fading: '#dc2626', unknown: '#94a3b8' };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const monthAr = (ym: string) => new Date(ym + 'T00:00:00Z').toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { month: 'long', year: 'numeric' });

export default function AdminLoopPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [tok, setTok] = useState(''); const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string>(''); const [msg, setMsg] = useState(''); const [filter, setFilter] = useState<'draft' | 'decided'>('draft'); const [kind, setKind] = useState<SuggestionKind | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null); const [note, setNote] = useState(''); const [tpl, setTpl] = useState(''); const [emails, setEmails] = useState(''); const [reach, setReach] = useState<{ email: string; level: 'green' | 'yellow' | 'grey'; label: string; why: string }[] | null>(null);
  const fresh = useCallback(async () => { const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || tok; if (tk !== tok) setTok(tk); return tk; }, [db, tok]);
  const hdr = useCallback(async () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${await fresh()}` }), [fresh]);
  async function load(tk?: string) { const j = await fetch('/api/loop', { headers: { Authorization: `Bearer ${tk || await fresh()}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setError(''); setData(j); }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/loop'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
      const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function checkReach() { const list = emails.split(/[\s,;،]+/).filter(x => x.includes('@')); if (!list.length) { setReach(null); return; } const j = await fetch(`/api/notify?reach=${encodeURIComponent(list.join(','))}`, { headers: await hdr(), cache: 'no-store' }).then(r => r.json()).catch(() => null); setReach(j?.success ? j.reach : null); }
  async function run() { if (busy) return; setBusy('run'); setMsg(''); const j = await fetch('/api/loop', { method: 'POST', headers: await hdr(), body: JSON.stringify({ action: 'run' }) }).then(r => r.json()).catch(() => null); setBusy(''); if (!j?.success) { setMsg(j?.error || 'تعذّر التشغيل'); return; } setMsg(j.error ? j.error : `اكتملت الدورة: ${j.proposed} اقتراحًا جديدًا · ${j.expired} انتهى · ${j.forecasts} توقّعًا لـ${j.orgs} جهة`); await load(); }
  async function decide(s: Sugg, status: 'accepted' | 'dismissed') {
    if (busy) return; setBusy(s.id); setMsg('');
    const body: any = { action: 'decide', id: s.id, status, note: note.trim() || undefined };
    if (status === 'accepted' && s.kind === 'mission') { body.template_id = tpl; body.emails = emails.split(/[\s,;،]+/).filter(Boolean); }
    const j = await fetch('/api/loop', { method: 'POST', headers: await hdr(), body: JSON.stringify(body) }).then(r => r.json()).catch(() => null); setBusy('');
    if (!j?.success) { setMsg(j?.error || 'تعذّر حفظ القرار'); return; }
    const o = j.outcome; setMsg(status === 'dismissed' ? 'سُجّل التجاهل — ستتعلّم الحلقة من ذلك.' : o?.kind === 'program_draft' ? 'اعتُمد: أُنشئت مسودة برنامج في «هندسة البرامج التدريبية».' : o?.kind === 'missions' ? `اعتُمد: أُسندت ${o.created === 1 ? 'مهمة واحدة' : o.created === 2 ? 'مهمتان' : `${o.created} مهمات`} من ${o.emails} بريدًا${o.skipped?.length ? ` (تُخطّي ${o.skipped.length} لديهم المهمة مسبقًا)` : ''}.` : 'اعتُمد وسُجّل الأثر.');
    setOpen(null); setNote(''); setEmails(''); await load();
  }
  const list = (data?.suggestions || []).filter(s => (filter === 'draft' ? s.status === 'draft' : s.status !== 'draft')).filter(s => kind === 'all' || s.kind === kind);
  const L = data?.learned;

  if (!ready) return <div className="lp"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="lp-wrap"><div className="lp-card">{error ? <span className="lp-err">{error}</span> : 'جارٍ التحقق من الصلاحية…'}</div></div></div>;
  return (
    <div className="lp"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lp-wrap">
        <header className="lp-head"><div><span className="lp-kicker"><Icon name="refresh" size={14} /> بوابة أَثَر · P15</span><h1>منظومة التحسين المستمر القائمة على الأدلة — الحلقة المغلقة</h1><p>الذاكرة الحية تقترح برامج ومهمات وتركيزات وخطوات مدعومة بسلسلة دليل كاملة؛ الإنسان يقبل أو يتجاهل؛ وكل قرار يغيّر ما تقترحه الحلقة في الشهر التالي. حيث لا يكفي الدليل، تقول الشاشة ذلك صراحة.</p></div>
          <button className="lp-run" onClick={run} disabled={!!busy} data-testid="loop-run"><Icon name="play" size={14} /> {busy === 'run' ? 'جارٍ التشغيل…' : 'شغّل الحلقة الآن'}</button></header>
        <PortalAdminTabs counts={{ '/admin/loop': data?.stats.draft || 0 }} />
        {error && <div className="lp-err">{error}</div>}
        {msg && <div className="lp-msg" data-testid="loop-msg">{msg}</div>}
        <div className="lp-kpis"><span><b>{data?.stats.draft ?? 0}</b> بانتظار قرار</span><span><b>{data?.stats.accepted ?? 0}</b> مقبول</span><span><b>{data?.stats.dismissed ?? 0}</b> متجاهَل</span><span><b>{data?.stats.forecasts ?? 0}</b> توقّع قدرة</span><span><b>{data?.stats.orgs ?? 0}</b> جهة</span></div>

        {/* ما تعلّمته أَثَر هذا الشهر */}
        <section className="lp-card lp-learned" data-testid="loop-learned">
          <h3><Icon name="star" size={16} /> ما تعلّمته أَثَر هذا الشهر — {data ? monthAr(data.month) : ''}</h3>
          {L && L.proposed + L.accepted + L.dismissed + L.expired === 0 ? <p className="lp-muted">لا دليل كافٍ بعد — لم تقترح الحلقة شيئًا هذا الشهر. شغّلها الآن أو انتظر الدورة الليلية.</p> : (
            <><div className="lp-lrow"><span><b>{L?.proposed}</b> اقتُرح</span><span><b>{L?.accepted}</b> قُبل</span><span><b>{L?.dismissed}</b> تُجوهل</span><span><b>{L?.expired}</b> انتهى بلا قرار</span><span><b>{L?.outcomes}</b> أثر مسجَّل</span><span><b>{L?.acceptance}%</b> نسبة القبول</span></div>
              <ul className="lp-lines">{(L?.lessons || []).map((x, i) => <li key={i}>{x}</li>)}</ul></>)}
        </section>

        {/* الاقتراحات */}
        <section className="lp-card">
          <div className="lp-bar"><div className="lp-tabs"><button className={filter === 'draft' ? 'on' : ''} onClick={() => setFilter('draft')}>بانتظار قرار</button><button className={filter === 'decided' ? 'on' : ''} onClick={() => setFilter('decided')}>ما حُسم</button></div>
            <div className="lp-chips"><button className={kind === 'all' ? 'on' : ''} onClick={() => setKind('all')}>الكل</button>{KINDS.map(k => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{KIND_LABEL_AR[k]}</button>)}</div></div>
          {!list.length && <p className="lp-muted" data-testid="loop-empty">{filter === 'draft' ? 'لا اقتراحات بانتظار قرار. حين تتراكم أدلة جديدة ستظهر هنا — ولن تخمّن الحلقة بلا دليل.' : 'لا قرارات بعد.'}</p>}
          <div className="lp-list" data-testid="loop-list">
            {list.map(s => (
              <article key={s.id} className={`lp-s ${s.status}`} data-kind={s.kind}>
                <div className="lp-stop"><span className="lp-kind"><Icon name={KIND_ICON[s.kind] as any} size={13} /> {KIND_LABEL_AR[s.kind]}</span><span className="lp-score" title="الأولوية (تتعلّم من قراراتكم)">{s.score}</span>{s.status !== 'draft' && <span className={`lp-st ${s.status}`}>{s.status === 'accepted' ? 'مقبول' : s.status === 'dismissed' ? 'متجاهَل' : 'منتهٍ'}</span>}</div>
                <h4>{s.title_ar}</h4><p>{s.why_ar}</p>
                <div className="lp-ev">{(s.evidence || []).map((e, i) => <span key={i}><i>{e.label}</i> {e.value}</span>)}</div>
                {s.status !== 'draft' && <div className="lp-out">{s.note && <span>ملاحظة: {s.note}</span>}{s.outcome?.kind === 'program_draft' && <span>الأثر: مسودة برنامج أُنشئت</span>}{s.outcome?.kind === 'missions' && <span>الأثر: {s.outcome.created} مهمة أُسندت</span>}<span className="lp-muted">{fmt(s.decided_at)}</span></div>}
                {s.status === 'draft' && (open !== s.id ? <div className="lp-acts"><button className="lp-btn" onClick={() => { setOpen(s.id); setNote(''); setTpl(s.target?.template_id || ''); setEmails(''); }} data-testid="loop-open">قرّر</button><span className="lp-muted">ينتهي {fmt(s.expires_at)}</span></div> : (
                  <div className="lp-decide">
                    {s.kind === 'mission' && <><label>قالب المهمة<select value={tpl} onChange={e => setTpl(e.target.value)}><option value="">— اختر —</option>{(data?.templates || []).map(t => <option key={t.id} value={t.id}>{t.title_ar}</option>)}</select></label>
                      <label>بريد المتعلمين (مفصولة بفواصل)<textarea value={emails} onChange={e => setEmails(e.target.value)} onBlur={checkReach} rows={2} placeholder="name@org.sa, …" /></label>
                      {reach && reach.length > 0 && <div className="lp-reach" data-testid="loop-reach"><b>نبض الوصول قبل الإسناد:</b> {reach.map(r => <span key={r.email} className={`lp-rc ${r.level}`} title={r.why}><i /> <bdi dir="ltr">{r.email}</bdi> — {r.label}</span>)}<small>{reach.filter(r => r.level === 'grey').length ? `${reach.filter(r => r.level === 'grey').length} بلا قناة آلية: ستصلهم رسائلهم عبر «قائمة اليد» في الإبلاغ متعدد القنوات.` : 'كل العناوين لها قناة.'}</small></div>}</>}
                    {s.kind === 'program' && <p className="lp-hint">القبول يُنشئ مسودة احتياج في «هندسة البرامج التدريبية» مملوءة بالقطاع والفجوة — لتكمل الفريق هناك.</p>}
                    <label>ملاحظة (اختيارية)<input value={note} onChange={e => setNote(e.target.value)} maxLength={600} placeholder="لماذا قبلت/تجاهلت؟ — تتعلّم الحلقة منها" /></label>
                    <div className="lp-acts"><button className="lp-btn ok" disabled={busy === s.id} onClick={() => decide(s, 'accepted')} data-testid="loop-accept">اقبل ونفّذ</button><button className="lp-btn warn" disabled={busy === s.id} onClick={() => decide(s, 'dismissed')} data-testid="loop-dismiss">تجاهل</button><button className="lp-btn ghost" onClick={() => setOpen(null)}>إلغاء</button></div>
                  </div>))}
              </article>))}
          </div>
        </section>

        {/* توقّع القدرة المؤسسية */}
        <section className="lp-card" data-testid="loop-forecasts">
          <h3><Icon name="trend" size={16} /> توقّع القدرة المؤسسية (90 يومًا) — لكل جهة مؤكَّدة الأعضاء</h3>
          {!data?.forecasts.length ? <p className="lp-muted">لا دليل كافٍ بعد — تظهر التوقّعات حين يكون لجهةٍ أعضاء مؤكَّدون تركوا أدلة تعلّم في نافذتي 45 يومًا.</p> : (
            <table className="lp-tbl"><thead><tr><th>الجهة</th><th>المهارة</th><th>الاتجاه</th><th>الميل</th><th>أشخاص</th><th>أدلة</th><th>حُسب</th></tr></thead>
              <tbody>{[...data.forecasts].sort((a, b) => ({ fading: 0, rising: 1, steady: 2, unknown: 3 }[a.trend] - { fading: 0, rising: 1, steady: 2, unknown: 3 }[b.trend]) || b.people - a.people).slice(0, 60).map((f, i) => <tr key={i}><td>{f.org_ar}</td><td>{f.skill_ar}</td><td><b style={{ color: TREND_COLOR[f.trend] }}>{TREND_AR[f.trend]}</b></td><td dir="ltr">{f.slope > 0 ? '+' : ''}{f.slope}</td><td>{f.people}{f.people < 5 && <small title="أقل من 5 — يبقى الاتجاه تقديريًا"> ⚠</small>}</td><td>{f.evidence}</td><td className="lp-muted">{fmt(f.computed_at)}</td></tr>)}</tbody></table>)}
        </section>
        <p className="lp-foot">الحلقة لا تنفّذ شيئًا من تلقاء نفسها: كل أثر هنا سبقه قرار بشري مسجَّل · P15 © 2026</p>
      </div>
    </div>
  );
}

const CSS = `
.lp{padding:20px 16px 48px;background:#f6f8fb;min-height:60vh;font-family:inherit}
.lp-wrap{max-width:1100px;margin:0 auto;display:grid;gap:12px}
.lp-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.lp-head h1{margin:4px 0;font-size:24px;color:#0f2a4e}.lp-head p{margin:0;color:#64748b;font-size:14px;line-height:1.7;max-width:820px}.lp-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b8a83}
.lp-run{display:inline-flex;align-items:center;gap:6px;background:#0f2a4e;color:#fff;border:0;border-radius:10px;padding:10px 16px;font-weight:800;cursor:pointer;font-family:inherit}.lp-run:disabled{opacity:.6}
.lp-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px}.lp-card h3{margin:0 0 8px;font-size:16px;color:#0f2a4e;display:flex;align-items:center;gap:6px}
.lp-err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:10px;padding:10px 12px;font-size:13px}.lp-msg{background:#ecfeff;color:#0e7490;border:1px solid #a5f3fc;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:700}
.lp-kpis{display:flex;flex-wrap:wrap;gap:8px}.lp-kpis span{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:12px;color:#475569}.lp-kpis b{font-size:18px;color:#0f2a4e;margin-inline-end:4px}
.lp-learned{background:linear-gradient(135deg,#0f2a4e,#0b3d5c);color:#fff;border:0}.lp-learned h3{color:#fde68a}.lp-learned .lp-muted{color:#cbd5e1}.lp-lrow{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}.lp-lrow span{background:rgba(255,255,255,.1);border-radius:8px;padding:6px 10px;font-size:12px}.lp-lrow b{font-size:16px;color:#fde68a;margin-inline-end:4px}.lp-lines{margin:6px 0 0;padding-inline-start:18px;font-size:13px;line-height:1.8;color:#e2e8f0}
.lp-bar{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px}.lp-tabs button,.lp-chips button{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:6px 12px;font-size:12px;cursor:pointer;font-family:inherit;color:#334155;margin-inline-end:4px}.lp-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.lp-chips button.on{background:#0b8a83;color:#fff;border-color:#0b8a83}
.lp-muted{color:#94a3b8;font-size:12px;margin:0}
.lp-list{display:grid;gap:10px}.lp-s{border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;border-inline-start:4px solid #c9a24b}.lp-s[data-kind=mission]{border-inline-start-color:#0b8a83}.lp-s[data-kind=org_step]{border-inline-start-color:#fb923c}.lp-s[data-kind=session_focus]{border-inline-start-color:#38bdf8}.lp-s.dismissed{opacity:.7}
.lp-stop{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.lp-kind{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;color:#0b8a83;background:#ecfeff;border-radius:999px;padding:3px 8px}.lp-score{font-size:11px;font-weight:900;color:#0f2a4e;background:#fef3c7;border-radius:999px;padding:3px 8px}.lp-st{font-size:11px;border-radius:999px;padding:3px 8px;background:#f1f5f9;color:#475569}.lp-st.accepted{background:#dcfce7;color:#166534}.lp-st.dismissed{background:#fee2e2;color:#991b1b}
.lp-s h4{margin:6px 0 2px;font-size:15px;color:#0f2a4e}.lp-s p{margin:0;font-size:13px;color:#475569;line-height:1.7}
.lp-ev{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.lp-ev span{font-size:11px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:3px 8px;color:#334155}.lp-ev i{font-style:normal;color:#94a3b8;margin-inline-end:4px}
.lp-out{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;font-size:12px;color:#166534}
.lp-acts{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}.lp-btn{background:#0f2a4e;color:#fff;border:0;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit}.lp-btn.ok{background:#0b8a83}.lp-btn.warn{background:#fff;color:#b91c1c;border:1px solid #fecaca}.lp-btn.ghost{background:transparent;color:#64748b;border:1px solid #e2e8f0}.lp-btn:disabled{opacity:.6}
.lp-reach{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;font-size:12px;color:#334155;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px}.lp-reach b{color:#0f2a4e}.lp-reach small{flex-basis:100%;color:#64748b}.lp-rc{display:inline-flex;align-items:center;gap:4px}.lp-rc i{width:9px;height:9px;border-radius:50%;background:#94a3b8;display:inline-block}.lp-rc.green i{background:#0b8a83}.lp-rc.yellow i{background:#f59e0b}.lp-rc.grey i{background:#cbd5e1}
.lp-decide{margin-top:10px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:12px;display:grid;gap:8px}.lp-decide label{display:grid;gap:4px;font-size:12px;color:#475569;font-weight:700}.lp-decide input,.lp-decide select,.lp-decide textarea{font-family:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:8px;padding:8px}.lp-hint{margin:0;font-size:12px;color:#0e7490}
.lp-tbl{width:100%;border-collapse:collapse;font-size:13px}.lp-tbl th{text-align:start;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;padding:6px}.lp-tbl td{padding:6px;border-bottom:1px solid #f1f5f9}
.lp-foot{text-align:center;color:#94a3b8;font-size:12px;margin:8px 0 0}
`;
