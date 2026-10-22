'use client';
/**
 * /command-center — غرفة القيادة (شاشة عرض حية)
 * لوحة مخصصة للشاشات الكبيرة/العرض في الاجتماعات: مؤشرات حية من بيانات التقييم الفعلية
 * عبر نفس محرك التحليلات المستخدم في /dashboard و/reports (lib/reports/analytics.ts)،
 * مع تحديث تلقائي كل 60 ثانية ووضع عرض ملء الشاشة.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';
import { Icon, type IconName } from '../../lib/ui/icons';
import {
  TARGET, THRESHOLDS, PERF_LABEL, addDays, applyFilters, buildEvaluations, buildFacts, groupBy, kpis as computeKpis,
  periodComparison, riskRegister, riyadhDate, timeSeries,
  type Evaluation, type Fact, type GroupRow, type Kpis, type Lookups,
} from '../../lib/reports/analytics';

type Range = 'today' | '7d' | '30d' | 'all';
type Raw = { evaluations: any[]; answers: any[]; questions: any[]; classrooms: any[]; trainers: any[]; programs: any[]; schedules: any[]; remoteResponses: number };
const REFRESH_SEC = 60;
const RANGES: { id: Range; label: string; days: number | null }[] = [
  { id: 'today', label: 'اليوم', days: 1 }, { id: '7d', label: '7 أيام', days: 7 }, { id: '30d', label: '30 يومًا', days: 30 }, { id: 'all', label: 'الكل', days: null },
];
const TONE: Record<string, string> = { EXCELLENT: '#34d399', GOOD: '#2dd4bf', WATCH: '#fbbf24', RISK: '#f87171', NA: '#94a3b8' };

export default function CommandCenterPage() {
  const db = useMemo(() => supabase(), []);
  const router = useRouter();
  const [raw, setRaw] = useState<Raw | null>(null);
  const [err, setErr] = useState('');
  const [range, setRange] = useState<Range>('7d');
  const [now, setNow] = useState<Date | null>(null); // يُضبط بعد التحميل لتجنّب اختلاف الخادم/المتصفح
  const [left, setLeft] = useState(REFRESH_SEC);
  const [present, setPresent] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const busy = useRef(false);

  async function load() {
    if (busy.current) return; busy.current = true; setRefreshing(true);
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/command-center'); return; }
      const [pr, ev, an, qs, cl, tr, sc, rr] = await Promise.all([
        db.from('programs').select('id,name_ar,name_en,status,delivery_mode,start_date,end_date'),
        db.from('evaluations').select('id,program_id,classroom_id,kind,submitted_at,evaluation_date,overall_rating,guest_email,guest_phone,trainee_id'),
        db.from('evaluation_answers').select('evaluation_id,question_id,rating_value'),
        db.from('questions').select('id,question_key,kind,text_ar,text_en,section_ar,section_en,order_index'),
        db.from('classrooms').select('id,code,program_id,trainer_id,delivery_mode,level_id,level'),
        db.from('trainers').select('id,name'),
        db.from('class_schedules').select('id,classroom_id,is_active'),
        db.from('remote_learning_survey_responses').select('id', { count: 'exact', head: true }),
      ]);
      const failed = [pr, ev, an, qs, cl, tr].map(r => r.error?.message).filter(Boolean) as string[];
      setErr(failed.length ? Array.from(new Set(failed)).join(' | ') : '');
      setRaw({ programs: pr.data || [], evaluations: ev.data || [], answers: an.data || [], questions: qs.data || [], classrooms: cl.data || [], trainers: tr.data || [], schedules: sc.data || [], remoteResponses: rr.count || 0 });
      setLastRefresh(new Date()); setLeft(REFRESH_SEC);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { busy.current = false; setRefreshing(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  /* الساعة + العدّاد التنازلي للتحديث التلقائي */
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => {
      setNow(new Date());
      setLeft(l => { if (l <= 1) { load(); return REFRESH_SEC; } return l - 1; });
    }, 1000);
    return () => clearInterval(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  /* وضع العرض: إخفاء الشريط العلوي + ملء الشاشة */
  useEffect(() => {
    document.body.classList.toggle('cc-present', present);
    if (present && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    if (!present && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    const onFs = () => { if (!document.fullscreenElement) setPresent(false); };
    document.addEventListener('fullscreenchange', onFs);
    return () => { document.removeEventListener('fullscreenchange', onFs); document.body.classList.remove('cc-present'); };
  }, [present]);

  /* ===== التحليلات ===== */
  const today = riyadhDate(new Date().toISOString());
  const lk: Lookups = useMemo(() => ({ classrooms: raw?.classrooms || [], trainers: raw?.trainers || [], programs: raw?.programs || [], questions: raw?.questions || [] }), [raw]);
  const allEvals: Evaluation[] = useMemo(() => raw ? buildEvaluations(raw.evaluations, raw.answers, lk) : [], [raw, lk]);
  const facts: Fact[] = useMemo(() => raw ? buildFacts(raw.answers, raw.questions) : [], [raw]);
  const days = RANGES.find(r => r.id === range)!.days;
  const filters = useMemo(() => days ? { from: addDays(today, -(days - 1)), to: today } : {}, [days, today]);
  const evals = useMemo(() => applyFilters(allEvals, filters, lk), [allEvals, filters, lk]);
  const k: Kpis = useMemo(() => computeKpis(evals, facts), [evals, facts]);
  const kToday: Kpis = useMemo(() => computeKpis(applyFilters(allEvals, { from: today, to: today }, lk), facts), [allEvals, today, lk, facts]);
  const cmp = useMemo(() => days ? periodComparison(allEvals, facts, filters, lk) : null, [days, allEvals, facts, filters, lk]);
  const axes = useMemo(() => groupBy('axis', evals, facts, lk, 'ar'), [evals, facts, lk]);
  const trainers = useMemo(() => groupBy('trainer', evals, facts, lk, 'ar').filter(r => r.key), [evals, facts, lk]);
  const rooms = useMemo(() => groupBy('classroom', evals, facts, lk, 'ar').filter(r => r.key), [evals, facts, lk]);
  const series = useMemo(() => timeSeries(applyFilters(allEvals, { from: addDays(today, -13), to: today }, lk), facts, 'day', lk, 'ar'), [allEvals, today, lk, facts]);
  const actions = useMemo(() => riskRegister(evals, facts, lk, 'ar'), [evals, facts, lk]);
  const latest = useMemo(() => [...allEvals].filter(e => e.submitted_at).sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at))).slice(0, 12), [allEvals]);

  const alerts = useMemo(() => {
    if (!raw) return [] as { level: 'red' | 'amber' | 'blue'; text: string }[];
    const out: { level: 'red' | 'amber' | 'blue'; text: string }[] = [];
    const activeIds = new Set(raw.programs.filter((p: any) => p.status === 'ACTIVE').map((p: any) => p.id));
    const recentRooms = new Set(applyFilters(allEvals, { from: addDays(today, -2), to: today }, lk).map(e => e.classroom_id));
    const silent = raw.classrooms.filter((c: any) => c.program_id && activeIds.has(c.program_id) && !recentRooms.has(c.id));
    for (const a of actions.filter(x => x.priority === 'HIGH').slice(0, 3)) out.push({ level: 'red', text: `${a.label}: متوسط ${a.mean.toFixed(2)}/5 و${a.lowPct.toFixed(0)}% تقييمات منخفضة (n=${a.responses})` });
    if (silent.length) out.push({ level: 'amber', text: `${silent.length} قاعة في برامج نشطة بلا استجابة خلال 3 أيام: ${silent.slice(0, 4).map((c: any) => c.code).join('، ')}${silent.length > 4 ? '…' : ''}` });
    const declining = trainers.filter(t => t.delta !== null && (t.delta as number) <= -0.3);
    if (declining.length) out.push({ level: 'amber', text: `اتجاه تنازلي: ${declining.slice(0, 3).map(t => `${t.label} (${(t.delta as number).toFixed(2)})`).join('، ')}` });
    const noTrainer = raw.classrooms.filter((c: any) => !c.trainer_id && c.program_id && activeIds.has(c.program_id));
    if (noTrainer.length) out.push({ level: 'amber', text: `${noTrainer.length} قاعة بدون مدرب مرتبط` });
    const schedRooms = new Set(raw.schedules.filter((s: any) => s.is_active !== false).map((s: any) => s.classroom_id));
    const remoteIncomplete = raw.classrooms.filter((c: any) => c.delivery_mode === 'remote' && (!(c.level_id || c.level) || !schedRooms.has(c.id)));
    if (remoteIncomplete.length) out.push({ level: 'amber', text: `${remoteIncomplete.length} مجموعة عن بُعد بلا مستوى أو مواعيد` });
    const drafts = raw.programs.filter((p: any) => p.status === 'DRAFT').length;
    if (drafts) out.push({ level: 'blue', text: `${drafts} برنامج مسودة بانتظار التفعيل` });
    if (k.responses > 0 && k.responses < THRESHOLDS.minSample) out.push({ level: 'blue', text: `العينة صغيرة (${k.responses}) — المؤشرات أولية` });
    if (!out.length) out.push({ level: 'blue', text: 'لا توجد تنبيهات — الوضع مستقر' });
    return out;
  }, [raw, allEvals, today, lk, actions, trainers, k.responses]);

  const activePrograms = (raw?.programs || []).filter((p: any) => p.status === 'ACTIVE').length;
  const best = trainers.filter(t => t.responses >= THRESHOLDS.minSample).sort((a, b) => b.mean - a.mean)[0];
  const decision = actions[0];
  const perf = PERF_LABEL[k.perf];
  const tone = TONE[k.perf];
  const timeStr = now ? new Intl.DateTimeFormat('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Riyadh' }).format(now) : '--:--:--';
  const dateStr = now ? new Intl.DateTimeFormat('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(now) : '';

  return (
    <main className="cc" dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ===== الشريط العلوي ===== */}
      <header className="cc-top">
        <div className="cc-brand">
          <span className="cc-logo"><img src="/logos/upm.png" alt="جامعة الأمير مقرن" /></span>
          <span className="cc-logo"><img src="/logos/center.png" alt="المركز العالمي" /></span>
          <div>
            <b><Icon name="dashboard" size={18} /> غرفة القيادة — المؤشرات الحية</b>
            <span>منصة الجودة والتقييم · تحديث تلقائي كل {REFRESH_SEC} ثانية</span>
          </div>
        </div>
        <div className="cc-clock" aria-live="off">
          <b className="ltr">{timeStr}</b>
          <span>{dateStr}</span>
        </div>
        <div className="cc-ctrl">
          <div className="cc-seg" role="tablist" aria-label="النطاق الزمني">
            {RANGES.map(r => <button key={r.id} role="tab" aria-selected={range === r.id} className={range === r.id ? 'on' : ''} onClick={() => setRange(r.id)}>{r.label}</button>)}
          </div>
          <button className="cc-btn" onClick={() => load()} disabled={refreshing} title="تحديث الآن">
            <span className="cc-ring" style={{ ['--p' as any]: `${(left / REFRESH_SEC) * 100}%` }}><Icon name="refresh" size={14} /></span>
            <span>{refreshing ? 'جارٍ التحديث…' : `تحديث بعد ${left} ث`}</span>
          </button>
          <button className="cc-btn" onClick={() => setPresent(p => !p)} title={present ? 'إنهاء العرض' : 'وضع العرض (ملء الشاشة)'}>
            <Icon name={present ? 'x' : 'play'} size={14} /><span>{present ? 'إنهاء العرض' : 'وضع العرض'}</span>
          </button>
          <Link href="/dashboard" className="cc-btn ghost"><Icon name="arrow" size={14} /><span>لوحة القيادة</span></Link>
        </div>
      </header>

      {err && <div className="cc-err" role="alert"><Icon name="alert" size={16} /> تعذّر تحميل بعض البيانات: {err}</div>}

      {!raw ? (
        <div className="cc-loading"><div className="cc-spin" role="status" aria-label="جارٍ التحميل" />جارٍ تحميل المؤشرات…</div>
      ) : (
        <>
          {/* ===== الصف الأول: المؤشر العام + البطاقات ===== */}
          <section className="cc-row1">
            <div className="cc-hero" style={{ ['--tone' as any]: tone }}>
              <Gauge value={k.measurements ? k.mean : null} color={tone} />
              <div className="cc-hero-txt">
                <small>المؤشر العام للرضا · {RANGES.find(r => r.id === range)!.label}</small>
                <div className="cc-hero-val"><b className="ltr">{k.measurements ? k.mean.toFixed(2) : '—'}</b><span>/ 5</span><em style={{ background: tone }}>{perf.ar}</em></div>
                <p>
                  {k.responses ? <>{k.responses} استجابة من {k.participants} مشاركًا · {k.rooms} قاعة · {k.trainers} مدرب · الفجوة عن المستهدف {TARGET}: <b className="ltr" style={{ color: k.gap > 0 ? '#fbbf24' : '#34d399' }}>{k.gap > 0 ? '-' : '+'}{Math.abs(k.gap).toFixed(2)}</b></> : 'لا توجد استجابات في هذا النطاق — وسّع النطاق الزمني أو شارك روابط التقييم.'}
                  {cmp && cmp.deltaMean !== null && <> · مقارنة بالفترة السابقة <b className="ltr" style={{ color: cmp.deltaMean >= 0 ? '#34d399' : '#f87171' }}>{cmp.deltaMean >= 0 ? '▲' : '▼'} {Math.abs(cmp.deltaMean).toFixed(2)}</b></>}
                </p>
                <div className="cc-dist" aria-label="توزيع التقييمات">
                  <i style={{ width: `${k.highPct}%`, background: '#34d399' }} title={`مرتفع ${k.highPct.toFixed(0)}%`} />
                  <i style={{ width: `${Math.max(0, 100 - k.highPct - k.lowPct)}%`, background: '#fbbf24' }} title="محايد" />
                  <i style={{ width: `${k.lowPct}%`, background: '#f87171' }} title={`منخفض ${k.lowPct.toFixed(0)}%`} />
                </div>
                <div className="cc-dist-l"><span><i style={{ background: '#34d399' }} />مرتفع 4–5: {k.highPct.toFixed(0)}%</span><span><i style={{ background: '#fbbf24' }} />محايد 3</span><span><i style={{ background: '#f87171' }} />منخفض 1–2: {k.lowPct.toFixed(0)}%</span></div>
              </div>
            </div>
            <div className="cc-tiles">
              <Tile icon="send" label="استجابات اليوم" value={kToday.responses} sub={kToday.measurements ? `متوسط اليوم ${kToday.mean.toFixed(2)}` : 'لا استجابات بعد اليوم'} />
              <Tile icon="evaluations" label="استجابات النطاق" value={k.responses} sub={`يومي ${k.daily} · ختامي ${k.final}`} delta={cmp?.deltaResponses ?? null} />
              <Tile icon="programs" label="برامج نشطة" value={activePrograms} sub={`${raw.programs.length} إجمالي البرامج`} />
              <Tile icon="school" label="القاعات / المدربون" value={`${raw.classrooms.length} / ${raw.trainers.length}`} sub={`${k.rooms} قاعة نشطة في النطاق`} />
              <Tile icon="alert" label="محاور تحتاج تدخلًا" value={actions.filter(a => a.priority === 'HIGH').length} sub={`${actions.length} إجراء مقترح`} tone={actions.some(a => a.priority === 'HIGH') ? '#f87171' : '#34d399'} />
              <Tile icon="laptop" label="استطلاع التعلم عن بُعد" value={raw.remoteResponses} sub="إجمالي الاستجابات" />
            </div>
          </section>

          {/* ===== الصف الثاني: الاتجاه + المحاور + التنبيهات ===== */}
          <section className="cc-row2">
            <div className="cc-card">
              <h2><Icon name="trend" size={18} />الاتجاه اليومي — آخر 14 يومًا <small>الخط الذهبي = المستهدف {TARGET}</small></h2>
              <Trend series={series} />
            </div>
            <div className="cc-card">
              <h2><Icon name="shield" size={18} />أداء المحاور <small>مقابل المستهدف</small></h2>
              <Bars rows={axes.slice(0, 7)} />
            </div>
            <div className="cc-card cc-alerts">
              <h2><Icon name="alert" size={18} />التنبيهات</h2>
              <ul>{alerts.slice(0, 7).map((a, i) => <li key={i} className={a.level}><i />{a.text}</li>)}</ul>
            </div>
          </section>

          {/* ===== الصف الثالث: المدربون + القاعات + قرار اليوم ===== */}
          <section className="cc-row3">
            <div className="cc-card">
              <h2><Icon name="users" size={18} />ترتيب المدربين <small>n ≥ {THRESHOLDS.minSample}</small></h2>
              <Rank rows={trainers.filter(r => r.responses >= THRESHOLDS.minSample).sort((a, b) => b.mean - a.mean).slice(0, 6)} empty="لا توجد عينة كافية للمدربين في هذا النطاق" />
            </div>
            <div className="cc-card">
              <h2><Icon name="school" size={18} />ترتيب القاعات</h2>
              <Rank rows={rooms.sort((a, b) => b.mean - a.mean).slice(0, 6)} empty="لا توجد بيانات قاعات في هذا النطاق" />
            </div>
            <div className="cc-card cc-decision">
              <h2><Icon name="target" size={18} />قرار اليوم</h2>
              {decision ? (
                <>
                  <span className={`cc-pri ${decision.priority}`}>{decision.priority === 'HIGH' ? 'أولوية عالية' : decision.priority === 'MED' ? 'أولوية متوسطة' : 'أولوية منخفضة'}</span>
                  <b>{decision.label}</b>
                  <p>{decision.recommendation}</p>
                  <div className="cc-meta"><span><Icon name="users" size={13} />{decision.owner}</span><span><Icon name="clock" size={13} />{decision.dueDays} يوم</span><span><Icon name="chart" size={13} />{decision.mean.toFixed(2)} → {TARGET}</span></div>
                </>
              ) : <p className="cc-ok"><Icon name="check" size={18} />لا توجد إجراءات عاجلة؛ جميع المحاور ضمن المستهدف أو العينة غير كافية.</p>}
              {best && <div className="cc-best"><Icon name="award" size={16} /><span>الأعلى أداءً: <b>{best.label}</b> — {best.mean.toFixed(2)}/5 (n={best.responses})</span></div>}
            </div>
          </section>

          {/* ===== الشريط السفلي: آخر الاستجابات ===== */}
          <footer className="cc-ticker" aria-label="آخر الاستجابات">
            <span className="cc-ticker-l"><Icon name="clock" size={14} />آخر الاستجابات</span>
            <div className="cc-ticker-track">
              <div className="cc-ticker-in">
                {(latest.length ? [...latest, ...latest] : []).map((e, i) => {
                  const room = raw.classrooms.find((c: any) => c.id === e.classroom_id)?.code || '—';
                  return <span key={`${e.id}-${i}`}><i style={{ background: e.mean === null ? '#94a3b8' : e.mean >= TARGET ? '#34d399' : e.mean >= THRESHOLDS.good ? '#2dd4bf' : e.mean >= THRESHOLDS.watch ? '#fbbf24' : '#f87171' }} />{timeAgo(String(e.submitted_at))} · قاعة {room} · {e.kind === 'FINAL' ? 'ختامي' : 'يومي'} · <b className="ltr">{e.mean === null ? '—' : e.mean.toFixed(2)}</b></span>;
                })}
                {!latest.length && <span>لا توجد استجابات بعد</span>}
              </div>
            </div>
            <span className="cc-ticker-r">{lastRefresh ? `آخر تحديث ${new Intl.DateTimeFormat('ar-SA', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(lastRefresh)}` : ''}</span>
          </footer>
        </>
      )}
    </main>
  );
}

/* ===== مكوّنات ===== */
function Tile({ icon, label, value, sub, delta, tone }: { icon: IconName; label: string; value: string | number; sub?: string; delta?: number | null; tone?: string }) {
  return (
    <div className="cc-tile">
      <span className="cc-tile-ico"><Icon name={icon} size={18} /></span>
      <small>{label}</small>
      <b className="ltr" style={tone ? { color: tone } : undefined}>{value}</b>
      <span>{sub}{delta !== null && delta !== undefined && delta !== 0 && <em style={{ color: delta > 0 ? '#34d399' : '#f87171' }}> {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}</em>}</span>
    </div>
  );
}
function Gauge({ value, color }: { value: number | null; color: string }) {
  const R = 54, C = 2 * Math.PI * R, half = C / 2;
  const pct = value === null ? 0 : Math.max(0, Math.min(1, (value - 1) / 4));
  const tPct = (TARGET - 1) / 4, ang = Math.PI * (1 - tPct);
  const tx = 70 + R * Math.cos(ang), ty = 70 - R * Math.sin(ang);
  return (
    <svg viewBox="0 0 140 84" className="cc-gauge" aria-hidden="true">
      <path d="M16 70 A54 54 0 0 1 124 70" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="12" strokeLinecap="round" />
      <path d="M16 70 A54 54 0 0 1 124 70" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${half * pct} ${C}`} style={{ transition: 'stroke-dasharray .8s ease' }} />
      <circle cx={tx} cy={ty} r="4.5" fill="#c9a24b" stroke="#0f2a4e" strokeWidth="2" />
      <text x="70" y="66" textAnchor="middle" fontSize="22" fontWeight="900" fill="#fff" style={{ direction: 'ltr' }}>{value === null ? '—' : value.toFixed(2)}</text>
      <text x="16" y="82" fontSize="8" fill="#94a3b8">1</text><text x="124" y="82" fontSize="8" fill="#94a3b8" textAnchor="end">5</text>
    </svg>
  );
}
function Trend({ series }: { series: { key: string; label: string; mean: number | null; ma: number | null; responses: number }[] }) {
  const pts = series.filter(s => s.mean !== null);
  if (pts.length < 2) return <div className="cc-empty">يلزم يومان على الأقل من البيانات لرسم الاتجاه.</div>;
  const W = 640, H = 220, P = 30;
  const x = (i: number) => P + i * (W - 2 * P) / Math.max(1, pts.length - 1);
  const y = (v: number) => H - P - (v - 1) / 4 * (H - 2 * P);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.mean as number)}`).join(' ');
  const area = `${d} L${x(pts.length - 1)},${H - P} L${x(0)},${H - P} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cc-svg">
      <defs><linearGradient id="ccg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2dd4bf" stopOpacity=".35" /><stop offset="1" stopColor="#2dd4bf" stopOpacity="0" /></linearGradient></defs>
      {[1, 2, 3, 4, 5].map(v => <g key={v}><line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.08)" /><text x={P - 8} y={y(v) + 3} fontSize="10" textAnchor="end" fill="#94a3b8">{v}</text></g>)}
      <line x1={P} x2={W - P} y1={y(TARGET)} y2={y(TARGET)} stroke="#c9a24b" strokeDasharray="6 4" strokeWidth="1.5" />
      <path d={area} fill="url(#ccg)" /><path d={d} fill="none" stroke="#2dd4bf" strokeWidth="3" />
      {pts.map((p, i) => <g key={p.key}>
        <circle cx={x(i)} cy={y(p.mean as number)} r="4.5" fill={(p.mean as number) >= TARGET ? '#34d399' : (p.mean as number) >= THRESHOLDS.good ? '#2dd4bf' : '#f87171'} stroke="#0f2a4e" strokeWidth="2"><title>{p.label}: {p.mean} (n={p.responses})</title></circle>
        <text x={x(i)} y={y(p.mean as number) - 10} fontSize="10" textAnchor="middle" fill="#e2e8f0" fontWeight="700">{(p.mean as number).toFixed(2)}</text>
        <text x={x(i)} y={H - 10} fontSize="9" textAnchor="middle" fill="#94a3b8">{p.label.slice(-5)}</text>
      </g>)}
    </svg>
  );
}
function Bars({ rows }: { rows: GroupRow[] }) {
  if (!rows.length) return <div className="cc-empty">لا توجد بيانات محاور في هذا النطاق.</div>;
  return (
    <div className="cc-bars">
      {rows.map(r => <div key={r.key} className="cc-bar">
        <span className="cc-bar-l" title={r.label}>{r.label}</span>
        <div className="cc-bar-t"><i style={{ width: `${(r.mean / 5) * 100}%`, background: TONE[r.perf] }} /><u style={{ insetInlineStart: `${(TARGET / 5) * 100}%` }} /></div>
        <b className="ltr" style={{ color: TONE[r.perf] }}>{r.mean.toFixed(2)}</b>
      </div>)}
    </div>
  );
}
function Rank({ rows, empty }: { rows: GroupRow[]; empty: string }) {
  if (!rows.length) return <div className="cc-empty">{empty}</div>;
  return (
    <ol className="cc-rank">
      {rows.map((r, i) => <li key={r.key}>
        <span className="cc-rank-n">{i + 1}</span>
        <span className="cc-rank-l">{r.label}<small>n={r.responses}</small></span>
        {r.delta !== null && <em style={{ color: (r.delta as number) >= 0 ? '#34d399' : '#f87171' }}>{(r.delta as number) >= 0 ? '▲' : '▼'} {Math.abs(r.delta as number).toFixed(2)}</em>}
        <b className="ltr" style={{ color: TONE[r.perf] }}>{r.mean.toFixed(2)}</b>
      </li>)}
    </ol>
  );
}
function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (m < 1) return 'الآن'; if (m < 60) return `قبل ${m} د`; if (h < 24) return `قبل ${h} س`; return `قبل ${d} يوم`;
}

/* ===== الأنماط ===== */
const CSS = `
body.cc-present .global-nav{display:none !important;}
.cc{--navy:#0f2a4e;--navy-2:#0b1f3a;--teal:#2dd4bf;--gold:#c9a24b;--line:rgba(255,255,255,.1);--card:rgba(255,255,255,.05);--muted:#94a3b8;--txt:#e2e8f0;
  min-height:100vh;background:radial-gradient(1200px 600px at 85% -10%,rgba(11,138,131,.28),transparent 60%),linear-gradient(180deg,#0f2a4e 0%,#0b1f3a 100%);color:var(--txt);padding:16px 18px 70px;font-family:inherit;}
.cc *{box-sizing:border-box;}
.cc .ltr{direction:ltr;unicode-bidi:plaintext;}
.cc a{text-decoration:none;color:inherit;}

/* top */
.cc-top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:var(--card);border:1px solid var(--line);border-top:3px solid var(--gold);border-radius:14px;padding:10px 16px;margin-bottom:14px;}
.cc-brand{display:flex;align-items:center;gap:10px;}
.cc-logo{background:#fff;border-radius:10px;height:44px;min-width:60px;padding:5px 10px;display:inline-flex;align-items:center;justify-content:center;}
.cc-logo img{max-height:32px;max-width:96px;object-fit:contain;}
.cc-brand b{display:flex;align-items:center;gap:6px;font-size:16px;font-weight:800;color:#fff;}
.cc-brand b svg{color:var(--gold);}
.cc-brand span{display:block;font-size:11.5px;color:var(--muted);font-weight:600;}
.cc-clock{text-align:center;}
.cc-clock b{display:block;font-size:30px;font-weight:900;letter-spacing:1px;color:#fff;line-height:1;font-variant-numeric:tabular-nums;}
.cc-clock span{font-size:12px;color:var(--muted);font-weight:600;}
.cc-ctrl{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.cc-seg{display:inline-flex;background:rgba(255,255,255,.06);border:1px solid var(--line);border-radius:10px;padding:3px;gap:2px;}
.cc-seg button{border:0;background:transparent;color:var(--muted);font-weight:800;font-size:12.5px;padding:7px 12px;border-radius:8px;cursor:pointer;font-family:inherit;}
.cc-seg button.on{background:var(--gold);color:var(--navy);}
.cc-btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:rgba(255,255,255,.08);color:#fff;font-weight:800;font-size:12.5px;padding:7px 12px;border-radius:10px;cursor:pointer;font-family:inherit;}
.cc-btn:hover{background:rgba(255,255,255,.14);}
.cc-btn:disabled{opacity:.6;cursor:wait;}
.cc-btn.ghost{background:transparent;color:var(--muted);}
.cc-ring{width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:conic-gradient(var(--teal) var(--p),rgba(255,255,255,.12) 0);position:relative;}
.cc-ring::before{content:"";position:absolute;inset:3px;border-radius:50%;background:#15345e;}
.cc-ring svg{position:relative;}
.cc-err{background:rgba(248,113,113,.14);border:1px solid rgba(248,113,113,.4);color:#fecaca;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-weight:700;font-size:13px;display:flex;gap:8px;align-items:center;}
.cc-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;min-height:50vh;color:var(--muted);font-weight:700;}
.cc-spin{width:48px;height:48px;border:5px solid rgba(255,255,255,.12);border-top-color:var(--teal);border-radius:50%;animation:ccspin 1s linear infinite;}
@keyframes ccspin{to{transform:rotate(360deg);}}

/* rows */
.cc-row1{display:grid;grid-template-columns:1.1fr 1.4fr;gap:14px;margin-bottom:14px;}
.cc-row2{display:grid;grid-template-columns:1.5fr 1.1fr 1fr;gap:14px;margin-bottom:14px;}
.cc-row3{display:grid;grid-template-columns:1fr 1fr 1.1fr;gap:14px;}
.cc-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;min-width:0;}
.cc-card h2{margin:0 0 12px;font-size:15px;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px;}
.cc-card h2 svg{color:var(--teal);}
.cc-card h2 small{margin-inline-start:auto;color:var(--muted);font-size:11.5px;font-weight:600;}
.cc-empty{color:var(--muted);text-align:center;padding:26px 10px;font-weight:600;font-size:13px;}

/* hero */
.cc-hero{background:linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.03));border:1px solid var(--line);border-inline-start:5px solid var(--tone);border-radius:14px;padding:18px 20px;display:flex;gap:18px;align-items:center;}
.cc-gauge{width:170px;flex-shrink:0;}
.cc-hero-txt{min-width:0;flex:1;}
.cc-hero-txt small{color:var(--muted);font-weight:700;font-size:12.5px;}
.cc-hero-val{display:flex;align-items:baseline;gap:8px;margin:4px 0 8px;flex-wrap:wrap;}
.cc-hero-val b{font-size:52px;font-weight:900;color:#fff;line-height:1;}
.cc-hero-val span{color:var(--muted);font-weight:700;font-size:16px;}
.cc-hero-val em{font-style:normal;color:var(--navy);font-weight:900;font-size:12.5px;padding:4px 12px;border-radius:999px;}
.cc-hero-txt p{margin:0;color:#cbd5e1;font-size:13.5px;line-height:1.8;font-weight:600;}
.cc-dist{display:flex;height:10px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.1);margin-top:12px;}
.cc-dist i{display:block;height:100%;transition:width .6s ease;}
.cc-dist-l{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;color:var(--muted);font-size:11.5px;font-weight:700;}
.cc-dist-l i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-inline-end:5px;vertical-align:-1px;}

/* tiles */
.cc-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.cc-tile{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto auto;column-gap:10px;align-items:center;}
.cc-tile-ico{grid-row:1/4;width:38px;height:38px;border-radius:10px;background:rgba(45,212,191,.14);color:var(--teal);display:inline-flex;align-items:center;justify-content:center;align-self:start;}
.cc-tile small{color:var(--muted);font-weight:700;font-size:12px;}
.cc-tile b{font-size:26px;font-weight:900;color:#fff;line-height:1.15;}
.cc-tile span{color:#94a3b8;font-size:11.5px;font-weight:600;}
.cc-tile em{font-style:normal;font-weight:800;}

/* bars */
.cc-bars{display:grid;gap:10px;}
.cc-bar{display:grid;grid-template-columns:120px 1fr 48px;gap:10px;align-items:center;font-size:12.5px;font-weight:700;}
.cc-bar-l{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#e2e8f0;}
.cc-bar-t{position:relative;height:12px;background:rgba(255,255,255,.1);border-radius:999px;overflow:visible;}
.cc-bar-t i{display:block;height:100%;border-radius:999px;transition:width .6s ease;}
.cc-bar-t u{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--gold);}
.cc-bar b{text-align:end;font-size:14px;}

/* alerts */
.cc-alerts ul{list-style:none;margin:0;padding:0;display:grid;gap:8px;}
.cc-alerts li{display:flex;gap:10px;align-items:flex-start;padding:9px 12px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid var(--line);font-size:12.5px;line-height:1.6;font-weight:600;color:#e2e8f0;}
.cc-alerts li i{width:9px;height:9px;border-radius:50%;margin-top:6px;flex-shrink:0;}
.cc-alerts li.red i{background:#f87171;box-shadow:0 0 0 4px rgba(248,113,113,.2);}
.cc-alerts li.amber i{background:#fbbf24;box-shadow:0 0 0 4px rgba(251,191,36,.2);}
.cc-alerts li.blue i{background:#60a5fa;box-shadow:0 0 0 4px rgba(96,165,250,.2);}

/* rank */
.cc-rank{list-style:none;margin:0;padding:0;display:grid;gap:7px;}
.cc-rank li{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid var(--line);}
.cc-rank-n{width:24px;height:24px;border-radius:7px;background:rgba(201,162,75,.2);color:var(--gold);display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;flex-shrink:0;}
.cc-rank li:first-child .cc-rank-n{background:var(--gold);color:var(--navy);}
.cc-rank-l{flex:1;min-width:0;font-weight:700;font-size:13px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.cc-rank-l small{display:block;color:var(--muted);font-size:11px;font-weight:600;}
.cc-rank em{font-style:normal;font-size:11px;font-weight:800;}
.cc-rank b{font-size:16px;font-weight:900;}

/* decision */
.cc-decision{border-inline-start:4px solid var(--gold);}
.cc-pri{display:inline-block;font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;margin-bottom:8px;}
.cc-pri.HIGH{background:rgba(248,113,113,.18);color:#fca5a5;} .cc-pri.MED{background:rgba(251,191,36,.18);color:#fde68a;} .cc-pri.LOW{background:rgba(52,211,153,.18);color:#a7f3d0;}
.cc-decision b{display:block;font-size:17px;font-weight:800;color:#fff;margin-bottom:6px;}
.cc-decision p{margin:0;color:#cbd5e1;font-size:13px;line-height:1.8;font-weight:600;}
.cc-meta{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;color:var(--muted);font-size:12px;font-weight:700;}
.cc-meta span{display:inline-flex;align-items:center;gap:5px;}
.cc-ok{display:flex;gap:8px;align-items:center;color:#a7f3d0 !important;}
.cc-best{margin-top:14px;padding-top:12px;border-top:1px solid var(--line);display:flex;gap:8px;align-items:center;color:#e2e8f0;font-size:12.5px;font-weight:600;}
.cc-best svg{color:var(--gold);flex-shrink:0;}
.cc-best b{display:inline;font-size:inherit;margin:0;}

/* svg */
.cc-svg{width:100%;height:auto;display:block;}

/* ticker */
.cc-ticker{position:fixed;inset-inline:0;bottom:0;background:#0b1f3a;border-top:1px solid var(--line);display:flex;align-items:center;gap:12px;padding:8px 16px;z-index:50;font-size:12.5px;}
.cc-ticker-l,.cc-ticker-r{display:inline-flex;align-items:center;gap:6px;color:var(--gold);font-weight:800;white-space:nowrap;flex-shrink:0;}
.cc-ticker-r{color:var(--muted);font-weight:600;}
.cc-ticker-track{flex:1;overflow:hidden;min-width:0;}
.cc-ticker-in{display:inline-flex;gap:34px;white-space:nowrap;animation:cctick 60s linear infinite;padding-inline-start:100%;}
.cc-ticker-in span{display:inline-flex;align-items:center;gap:6px;color:#e2e8f0;font-weight:600;}
.cc-ticker-in i{width:8px;height:8px;border-radius:50%;}
.cc-ticker-in b{color:#fff;}
@keyframes cctick{from{transform:translateX(0);}to{transform:translateX(100%);}}
.cc-ticker:hover .cc-ticker-in{animation-play-state:paused;}

@media(max-width:1200px){.cc-row1,.cc-row2,.cc-row3{grid-template-columns:1fr 1fr;}.cc-row2>.cc-card:first-child{grid-column:1/-1;}}
@media(max-width:760px){.cc{padding:10px 10px 70px;}.cc-row1,.cc-row2,.cc-row3{grid-template-columns:1fr;}.cc-tiles{grid-template-columns:repeat(2,1fr);}.cc-hero{flex-direction:column;align-items:flex-start;}.cc-clock{display:none;}.cc-hero-val b{font-size:42px;}.cc-bar{grid-template-columns:90px 1fr 44px;}}
`;
