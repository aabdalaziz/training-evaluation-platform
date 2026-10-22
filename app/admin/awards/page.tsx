'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { buildEvaluations, buildFacts, applyFilters, groupBy, riyadhDate, THRESHOLDS } from '../../../lib/reports/analytics';
import type { Lookups, Evaluation, Fact, GroupRow } from '../../../lib/reports/analytics';
import { computeAwards, winners, CATEGORY_META, DEFAULT_RULES, periodKey, periodLabel, monthRange, previousRange } from '../../../lib/awards/rules';
import type { AwardCandidate, AwardCategory, AwardRules } from '../../../lib/awards/rules';
import { loadSettings, insertCertificates, renderRows, emailRendered, pdfFilename } from '../../../lib/certificates/issue';
import type { CertRow } from '../../../lib/certificates/issue';
import { jpegsToPdf, downloadBytes, DEFAULT_SETTINGS } from '../../../lib/certificates/render';
import type { CertSettings } from '../../../lib/certificates/render';

type AwardRow = { id: string; period_key: string; period_label: string; category: AwardCategory; category_label: string; rank: number; trainer_id: string | null; trainer_name: string; metric_value: number | null; metric_label: string | null; responses: number | null; mean: number | null; certificate_id: string | null; note: string | null; created_by_name: string | null; created_at: string };
type Raw = { evaluations: any[]; answers: any[]; questions: any[]; classrooms: any[]; trainers: any[]; programs: any[] };

const NAVY = '#0f2a4e';
const ALLOWED = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const MEDAL = ['🥇', '🥈', '🥉'];

export default function AwardsPage() {
  const db = supabase();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState(''); const [orgId, setOrgId] = useState<string | null>(null);
  const [raw, setRaw] = useState<Raw | null>(null);
  const [settings, setSettings] = useState<CertSettings>({ ...DEFAULT_SETTINGS });
  const [error, setError] = useState(''); const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4500); };

  const today = riyadhDate(new Date().toISOString());
  const thisMonth = monthRange(today);
  const lastMonth = monthRange(`${thisMonth.from.slice(0, 7)}-01`.replace(/^(\d{4})-(\d{2})/, (_, y, m) => { const d = new Date(Date.UTC(Number(y), Number(m) - 2, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }));
  const [preset, setPreset] = useState<'this' | 'last' | 'custom'>('last');
  const [from, setFrom] = useState(lastMonth.from); const [to, setTo] = useState(lastMonth.to);
  const [programId, setProgramId] = useState('');
  const [rules, setRules] = useState<AwardRules>({ ...DEFAULT_RULES });
  const [history, setHistory] = useState<AwardRow[]>([]);
  const [busy, setBusy] = useState(''); const [progress, setProgress] = useState('');
  const [emailWinners, setEmailWinners] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const [p, ev, an, qs, cl, tr, pg] = await Promise.all([
        db.from('profiles').select('role,organization_id').eq('id', user.id).single(),
        db.from('evaluations').select('*').order('submitted_at', { ascending: false }),
        db.from('evaluation_answers').select('*'), db.from('questions').select('*'), db.from('classrooms').select('*'), db.from('trainers').select('*'), db.from('programs').select('*'),
      ]);
      setRole(String(p.data?.role || '')); const org = p.data?.organization_id || null; setOrgId(org);
      setRaw({ evaluations: ev.data || [], answers: an.data || [], questions: qs.data || [], classrooms: cl.data || [], trainers: tr.data || [], programs: pg.data || [] });
      setSettings(await loadSettings(db, org));
      setReady(true); loadHistory();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (preset === 'this') { setFrom(thisMonth.from); setTo(thisMonth.to); } if (preset === 'last') { setFrom(lastMonth.from); setTo(lastMonth.to); } }, [preset]); // eslint-disable-line react-hooks/exhaustive-deps

  const lk: Lookups = useMemo(() => ({ classrooms: raw?.classrooms || [], trainers: raw?.trainers || [], programs: raw?.programs || [], questions: raw?.questions || [] }), [raw]);
  const allEvals: Evaluation[] = useMemo(() => raw ? buildEvaluations(raw.evaluations, raw.answers, lk) : [], [raw, lk]);
  const facts: Fact[] = useMemo(() => raw ? buildFacts(raw.answers, raw.questions) : [], [raw]);
  const prev = useMemo(() => previousRange(from, to), [from, to]);
  const curRows: GroupRow[] = useMemo(() => groupBy('trainer', applyFilters(allEvals, { from, to, programId: programId || undefined }, lk), facts, lk, 'ar'), [allEvals, facts, lk, from, to, programId]);
  const prevRows: GroupRow[] = useMemo(() => groupBy('trainer', applyFilters(allEvals, { from: prev.from, to: prev.to, programId: programId || undefined }, lk), facts, lk, 'ar'), [allEvals, facts, lk, prev, programId]);
  const cands = useMemo(() => computeAwards(curRows, prevRows, rules), [curRows, prevRows, rules]);
  const wins = useMemo(() => winners(cands), [cands]);
  const pKey = periodKey(from, to) + (programId ? `_${programId.slice(0, 8)}` : '');
  const pLabel = periodLabel(from, to) + (programId ? ` — ${lk.programs.find(p => p.id === programId)?.name_ar || ''}` : '');
  const alreadySaved = history.filter(h => h.period_key === pKey);
  const totalResponses = curRows.reduce((s, r) => s + r.responses, 0);

  async function loadHistory() {
    const { data, error } = await db.from('trainer_awards').select('*').order('created_at', { ascending: false }).limit(300);
    if (error) { setError(explain(error.message)); return; }
    setHistory((data || []) as AwardRow[]);
  }

  /** اعتماد الجوائز: حفظ في السجل + إصدار شهادات تقدير (+ بريد اختياري) */
  async function approve() {
    setError('');
    if (!wins.length) { setError('لا يوجد فائزون مؤهلون في هذه الفترة وفق القواعد الحالية'); return; }
    if (alreadySaved.length && !window.confirm('توجد جوائز محفوظة لهذه الفترة مسبقًا. سيتم استبدالها. متابعة؟')) return;
    if (!window.confirm(`اعتماد ${wins.length} جائزة لفترة «${pLabel}» وإصدار شهادات تقدير بأرقام تسلسلية${emailWinners ? ' وإرسالها بالبريد للمدربين' : ''}؟`)) return;
    setBusy('approve');
    try {
      const { data: { user } } = await db.auth.getUser();
      const { data: prof } = await db.from('profiles').select('full_name').eq('id', user?.id || '').single();
      if (alreadySaved.length) await db.from('trainer_awards').delete().eq('period_key', pKey);
      // certificates of appreciation
      setProgress('إصدار شهادات التقدير…');
      const trainerEmail = (id: string) => { const t = (raw?.trainers || []).find((x: any) => x.id === id); return t?.email || t?.contact_email || null; };
      const { rows, error: cErr } = await insertCertificates(db, wins.map(w => ({
        kind: 'appreciation' as const, recipient_name: w.trainer_name, recipient_email: trainerEmail(w.trainer_id), program_id: programId || null,
        program_name: programId ? (lk.programs.find(p => p.id === programId)?.name_ar || '') : 'البرامج التدريبية — ' + pLabel,
        trainer_id: w.trainer_id, trainer_name: w.trainer_name, start_date: from, end_date: to, award_title: CATEGORY_META[w.category].certTitle, organization_id: orgId,
        meta: { period_key: pKey, category: w.category, metric: w.metric_label, responses: w.responses, mean: w.mean },
      })));
      if (cErr) throw new Error(cErr);
      const certByTrainer = new Map<string, CertRow>(); rows.forEach(r => { if (r.trainer_id) certByTrainer.set(r.trainer_id + r.award_title, r); });
      const { error: aErr } = await db.from('trainer_awards').insert(wins.map(w => ({
        organization_id: orgId, period_key: pKey, period_label: pLabel, category: w.category, category_label: CATEGORY_META[w.category].ar, rank: 1,
        trainer_id: w.trainer_id, trainer_name: w.trainer_name, metric_value: w.metric_value, metric_label: w.metric_label, responses: w.responses, mean: w.mean,
        certificate_id: certByTrainer.get(w.trainer_id + CATEGORY_META[w.category].certTitle)?.id || null, created_by: user?.id || null, created_by_name: prof?.full_name || null,
      })));
      if (aErr) throw new Error(aErr.message);
      setProgress('رسم الشهادات…');
      const rendered = await renderRows(rows, settings, (d, t) => setProgress(`رسم الشهادات ${d}/${t}`));
      downloadBytes(`شهادات-تقدير-${pKey}.pdf`, jpegsToPdf(rendered.map(x => ({ jpeg: x.jpeg, w: x.w, h: x.h })), `شهادات تقدير — ${pLabel}`));
      let sentTxt = '';
      if (emailWinners) { setProgress('إرسال البريد…'); const r = await emailRendered(db, rendered, settings, `تهانينا! تم اختياركم ضمن لوحة الشرف لفترة ${pLabel}.`); const ok = r.results.filter(x => x.ok).length; sentTxt = ` · أُرسل ${ok} بالبريد${r.skipped ? ` (${r.skipped} بلا بريد مسجّل)` : ''}`; }
      flash(`✓ اعتُمدت ${wins.length} جائزة وصدرت شهادات التقدير${sentTxt}`);
      loadHistory();
    } catch (e: any) { setError(explain(e.message)); } finally { setBusy(''); setProgress(''); }
  }
  async function redownload(h: AwardRow) {
    if (!h.certificate_id) return; setBusy('dl' + h.id);
    try { const { data } = await db.from('certificates').select('*').eq('id', h.certificate_id).single(); if (data) { const [x] = await renderRows([data as CertRow], settings); downloadBytes(pdfFilename(data as CertRow), jpegsToPdf([{ jpeg: x.jpeg, w: x.w, h: x.h }], h.category_label)); } } finally { setBusy(''); }
  }
  async function removePeriod(key: string) {
    if (!window.confirm('حذف جوائز هذه الفترة من السجل؟ (شهادات التقدير الصادرة تبقى في سجل الشهادات)')) return;
    const { error } = await db.from('trainer_awards').delete().eq('period_key', key); if (error) setError(error.message); else { flash('✓ حُذفت'); loadHistory(); }
  }

  const allowed = ALLOWED.includes(role.toUpperCase());
  if (!ready) return <div className="aw" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;
  const periods = Array.from(new Map(history.map(h => [h.period_key, h.period_label])).entries());

  return (
    <div className="aw" dir="rtl">
      <style>{CSS}</style>
      <header className="aw-head">
        <div>
          <div className="aw-kicker"><Icon name="award" size={14} /> مركز الإدارة</div>
          <h1>تكريم المدربين — لوحة الشرف</h1>
          <p>اختيار آلي شفاف للمتميزين وفق قواعد معلنة (أعلى تقييم، الأكثر تحسنًا، الأعلى مشاركة، الأكثر ثباتًا)، مع إصدار شهادات تقدير رسمية.</p>
        </div>
        <nav className="aw-nav">
          <Link href="/dashboard" className="aw-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/admin/certificates" className="aw-btn"><Icon name="certificate" size={16} /> الشهادات</Link>
          <Link href="/reports/center?type=trainers" className="aw-btn"><Icon name="users" size={16} /> تقرير المدربين</Link>
        </nav>
      </header>
      {!allowed && <div className="aw-alert err"><Icon name="alert" size={18} /> هذه الصفحة للإدارة ومديري البرامج ومحللي الجودة.</div>}
      {error && <div className="aw-alert err"><Icon name="alert" size={18} /> <span style={{ flex: 1 }}>{error}</span><button className="aw-x" onClick={() => setError('')}><Icon name="x" size={14} /></button></div>}

      <section className="aw-card">
        <h2><Icon name="calendar" size={18} /> فترة التكريم والقواعد</h2>
        <div className="aw-grid">
          <label>الفترة<select value={preset} onChange={e => setPreset(e.target.value as any)}><option value="last">الشهر الماضي</option><option value="this">الشهر الحالي</option><option value="custom">مخصصة</option></select></label>
          <label>من<input type="date" value={from} onChange={e => { setPreset('custom'); setFrom(e.target.value); }} /></label>
          <label>إلى<input type="date" value={to} onChange={e => { setPreset('custom'); setTo(e.target.value); }} /></label>
          <label>البرنامج<select value={programId} onChange={e => setProgramId(e.target.value)}><option value="">كل البرامج</option>{lk.programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
          <label>الحد الأدنى للاستجابات<input type="number" min={1} value={rules.minResponses} onChange={e => setRules(r => ({ ...r, minResponses: Number(e.target.value) || 1 }))} /></label>
          <label>الحد الأدنى للمتوسط (الثبات)<input type="number" step={0.1} min={1} max={5} value={rules.minMean} onChange={e => setRules(r => ({ ...r, minMean: Number(e.target.value) || THRESHOLDS.good }))} /></label>
        </div>
        <div className="aw-scope"><Icon name="flag" size={14} /> {pLabel} · مقارنة بـ {prev.from} → {prev.to} · {curRows.length} مدرب · {totalResponses} استجابة {alreadySaved.length ? <span className="aw-pill ok">محفوظة مسبقًا ({alreadySaved.length})</span> : null}</div>
      </section>

      {/* honor board */}
      <section className="aw-board">
        {(Object.keys(CATEGORY_META) as AwardCategory[]).map(cat => {
          const list = cands.filter(c => c.category === cat); const m = CATEGORY_META[cat]; const w = wins.find(x => x.category === cat);
          return (
            <div key={cat} className={`aw-cat ${w ? 'has' : ''}`}>
              <div className="aw-cat-head"><span className="aw-cat-ic"><Icon name={m.icon as any} size={18} /></span><div><b>{m.ar}</b><div className="aw-muted">{m.desc_ar}</div></div></div>
              {list.length === 0 ? <div className="aw-muted" style={{ padding: '10px 0' }}>لا توجد بيانات كافية في هذه الفترة.</div> : (
                <ol className="aw-list">{list.map((c, i) => (
                  <li key={c.trainer_id + i} className={`${c.eligible ? '' : 'inel'} ${w?.trainer_id === c.trainer_id ? 'win' : ''}`}>
                    <span className="aw-medal">{MEDAL[i] || i + 1}</span>
                    <div className="aw-who"><b>{c.trainer_name}</b><div className="aw-muted">{c.metric_label} · متوسط {c.mean.toFixed(2)} · {c.responses} استجابة{!c.eligible && c.reason ? ` · غير مؤهل: ${c.reason}` : ''}</div></div>
                    {w?.trainer_id === c.trainer_id && <span className="aw-pill ok">الفائز</span>}
                  </li>
                ))}</ol>
              )}
            </div>
          );
        })}
      </section>

      <section className="aw-card">
        <h2><Icon name="shield" size={18} /> اعتماد لوحة الشرف</h2>
        {wins.length === 0 ? <div className="aw-muted">لا يوجد فائزون مؤهلون — خفّض الحد الأدنى للاستجابات أو وسّع الفترة.</div> : (
          <div className="aw-winners">{wins.map(w => <div key={w.category} className="aw-win"><span className="aw-win-cat">{CATEGORY_META[w.category].ar}</span><b>{w.trainer_name}</b><span className="aw-muted">{w.metric_label}</span></div>)}</div>
        )}
        <label className="aw-check"><input type="checkbox" checked={emailWinners} onChange={e => setEmailWinners(e.target.checked)} /> إرسال شهادة التقدير بالبريد للمدربين الذين لديهم بريد مسجّل في جدول المدربين</label>
        <div className="aw-actions">
          <button className="aw-btn primary" onClick={approve} disabled={!allowed || !!busy || !wins.length}><Icon name="award" size={16} /> {busy === 'approve' ? (progress || 'جارٍ الاعتماد…') : 'اعتماد الجوائز وإصدار شهادات التقدير'}</button>
        </div>
        <div className="aw-muted" style={{ marginTop: 8 }}>عند الاعتماد: تُحفظ الجوائز في السجل، وتصدر شهادة شكر وتقدير لكل فائز برقم تسلسلي ورمز تحقق، ويُنزَّل ملف PDF يجمعها للطباعة.</div>
      </section>

      <section className="aw-card">
        <h2><Icon name="clock" size={18} /> سجل التكريم</h2>
        {periods.length === 0 ? <div className="aw-muted">لا توجد فترات معتمدة بعد.</div> : periods.map(([key, label]) => (
          <div key={key} className="aw-period">
            <div className="aw-period-head"><b>{label}</b><span className="aw-muted">{history.find(h => h.period_key === key)?.created_by_name || ''} · {new Date(history.find(h => h.period_key === key)!.created_at).toLocaleDateString('en-GB')}</span><button className="aw-ic" title="حذف من السجل" onClick={() => removePeriod(key)}><Icon name="trash" size={14} /></button></div>
            <div className="aw-period-list">{history.filter(h => h.period_key === key).map(h => (
              <div key={h.id} className="aw-hrow"><span className="aw-win-cat">{h.category_label}</span><b>{h.trainer_name}</b><span className="aw-muted">{h.metric_label}</span>{h.certificate_id && <button className="aw-ic" title="تنزيل شهادة التقدير" onClick={() => redownload(h)} disabled={!!busy}><Icon name="download" size={14} /></button>}</div>
            ))}</div>
          </div>
        ))}
      </section>
      {toast && <div className="aw-toast">{toast}</div>}
    </div>
  );
}

function explain(m: string): string {
  const s = (m || '').toLowerCase();
  if (s.includes('relation') && s.includes('does not exist')) return 'جداول التكريم/الشهادات غير موجودة بعد — شغّل ملف SQL الخاص بالشهادات والتكريم في Supabase أولًا.';
  if (s.includes('row-level security') || s.includes('permission denied')) return 'صلاحيات غير كافية (RLS). تأكد من دورك وأن ملف SQL نُفِّذ كاملًا.';
  return m;
}

const CSS = `
.aw{font-family:Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.aw-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;margin-bottom:14px}
.aw-head h1{margin:2px 0 4px;font-size:26px;color:${NAVY}}.aw-head p{margin:0;color:#64748b;font-size:13px}
.aw-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.aw-nav{display:flex;gap:8px;flex-wrap:wrap}
.aw-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:${NAVY};cursor:pointer;text-decoration:none}
.aw-btn:disabled{opacity:.5;cursor:not-allowed}.aw-btn.primary{background:${NAVY};color:#fff;border-color:${NAVY}}
.aw-alert{display:flex;gap:10px;align-items:flex-start;border-radius:12px;padding:12px 14px;margin:0 0 14px;font-size:13px;font-weight:700;line-height:1.7}.aw-alert.err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
.aw-x{border:0;background:transparent;cursor:pointer;color:inherit}
.aw-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;margin-bottom:14px}.aw-card h2{margin:0 0 14px;font-size:17px;color:${NAVY};display:flex;align-items:center;gap:8px}
.aw-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.aw label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#475569}
.aw select,.aw input{border:1px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-size:13px;font-weight:700;color:#0f172a;background:#fff}
.aw-scope{margin:12px 0 0;font-size:12.5px;font-weight:800;color:#334155;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:8px 12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.aw-muted{color:#64748b;font-size:12.5px;font-weight:700}
.aw-pill{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:800;background:#f1f5f9;color:#475569}.aw-pill.ok{background:#ecfdf5;color:#047857}
.aw-board{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:14px}
.aw-cat{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;border-top:4px solid #cbd5e1}.aw-cat.has{border-top-color:#c9a24b}
.aw-cat-head{display:flex;gap:10px;align-items:center;margin-bottom:10px}.aw-cat-head b{color:${NAVY};font-size:15px}
.aw-cat-ic{width:38px;height:38px;border-radius:10px;background:#fff7e6;color:#b45309;display:grid;place-items:center;flex-shrink:0}
.aw-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.aw-list li{display:flex;gap:10px;align-items:center;background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;padding:8px 12px}.aw-list li.win{background:#fffbeb;border-color:#fde68a}.aw-list li.inel{opacity:.6}
.aw-medal{font-size:20px;width:28px;text-align:center}.aw-who{flex:1}.aw-who b{font-size:14px;color:#0f172a}
.aw-winners{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.aw-win{display:flex;flex-direction:column;gap:4px;background:linear-gradient(135deg,#0f2a4e,#0b8a83);color:#fff;border-radius:14px;padding:12px 16px;min-width:200px}.aw-win b{font-size:16px}.aw-win .aw-muted{color:#dbeafe}
.aw-win-cat{font-size:11px;font-weight:900;background:rgba(255,255,255,.18);border-radius:999px;padding:2px 10px;align-self:flex-start}
.aw-hrow .aw-win-cat{background:#eef2f7;color:${NAVY}}
.aw-check{flex-direction:row!important;align-items:center;gap:8px!important;font-size:13px!important;color:#334155!important;margin:6px 0}
.aw-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}
.aw-period{border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px}
.aw-period-head{display:flex;gap:10px;align-items:center;margin-bottom:8px}.aw-period-head b{color:${NAVY};flex:1}
.aw-period-list{display:flex;flex-direction:column;gap:6px}
.aw-hrow{display:flex;gap:10px;align-items:center;font-size:13px}
.aw-ic{width:28px;height:28px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;display:grid;place-items:center;cursor:pointer;color:${NAVY}}.aw-ic:disabled{opacity:.4}
.aw-toast{position:fixed;bottom:18px;inset-inline-start:18px;background:${NAVY};color:#fff;padding:12px 18px;border-radius:12px;font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.25);z-index:120}
@media(max-width:900px){.aw-board{grid-template-columns:1fr}.aw-grid{grid-template-columns:1fr}.aw{padding:12px}}
`;
