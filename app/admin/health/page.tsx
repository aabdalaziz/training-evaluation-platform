'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadCSV, safeFilename } from '../../../lib/export/csv';
import { GROUP_LABEL, STATUS_LABEL, STATUS_ORDER, healthCsv } from '../../../lib/health/model';
import type { HealthCheck, Group, Status } from '../../../lib/health/model';

import { RoomHead } from '../../components/RoomKit'; /* هـ-3 ح «عدّة الغرفة» */
const NAVY = '#3A1F36', TEAL = '#D4614A', GOLD = '#D9A866';
const GROUPS: Group[] = ['env', 'cron', 'mail', 'data', 'ai'];
type Report = { success: boolean; generatedAt: string; partial: boolean; summary: { status: Status; score: number; bad: number; warn: number; ok: number }; checks: HealthCheck[]; raw: any; alerts: { inserted: number; resolved: number } | null; error?: string };

export default function HealthPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [rep, setRep] = useState<Report | null>(null); const [onlyIssues, setOnlyIssues] = useState(false);
  const [tests, setTests] = useState<Record<string, { busy: boolean; result?: any }>>({});

  async function token() { const { data: { session } } = await db.auth.getSession(); return session?.access_token || ''; }
  async function run() {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/admin/health', { headers: { Authorization: `Bearer ${await token()}` }, cache: 'no-store' });
      const j: Report = await r.json(); if (!j.success) throw new Error(j.error || 'فشل الفحص');
      setRep(j);
    } catch (e: any) { setError(e?.message || 'تعذر تنفيذ الفحص'); } finally { setBusy(false); }
  }
  async function runTest(kind: 'test_email' | 'test_ai') {
    setTests(t => ({ ...t, [kind]: { busy: true } }));
    try {
      const r = await fetch('/api/admin/health', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ action: kind }) });
      const result = await r.json(); setTests(t => ({ ...t, [kind]: { busy: false, result } }));
    } catch (e: any) { setTests(t => ({ ...t, [kind]: { busy: false, result: { success: false, error: e?.message || 'فشل' } } })); }
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/admin/health'); return; }
      setReady(true); await run();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const checks = (rep?.checks || []).filter(c => !onlyIssues || c.status === 'bad' || c.status === 'warn');
    return GROUPS.map(g => ({ g, items: checks.filter(c => c.group === g).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) })).filter(x => x.items.length);
  }, [rep, onlyIssues]);
  const s = rep?.summary;

  if (!ready) return <div className="he rm-page" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;

  return (
    <div className="he rm-page" dir="rtl">
      <style>{CSS}</style>
      <RoomHead
        title={<>صحة المنصة — هل كل شيء يعمل؟</>}
        desc={<><p>فحص فوري للإعدادات والمهام المجدولة والبريد وسلامة البيانات، بلغة واضحة: ما الذي يعمل، ما الذي يتعطل عند غيابه، وأين تصلحه. عند اكتشاف عطل يُضاف تنبيه إلى الجرس تلقائيًا ويُحل عند زواله.</p></>}
        actions={<>
          <button className="rm-btn primary" disabled={busy} onClick={run}><Icon name="refresh" size={16} /> {busy ? 'جارٍ الفحص…' : 'أعد الفحص'}</button>
          <button className="rm-btn" disabled={!rep} onClick={() => rep && downloadCSV(safeFilename('platform_health'), healthCsv(rep.checks))}><Icon name="download" size={16} /> CSV</button>
          <button className="rm-btn" onClick={() => window.print()}><Icon name="print" size={16} /> طباعة</button>
        </>}
      />
      {error && <div className="rm-alert">{error}</div>}
      {rep?.partial && <div className="rm-alert warn">فحص جزئي: SUPABASE_SERVICE_ROLE_KEY غير مضبوط، لذا تُقرأ البيانات بصلاحيات حسابك ولا تُزامَن تنبيهات الجرس.</div>}

      {s && (
        <section className={`he-hero ${s.status}`}>
          <div className="he-score"><b>{s.score}</b><span dir="ltr">/100</span></div>
          <div className="he-hero-txt">
            <h2>{s.status === 'ok' ? 'المنصة سليمة' : s.status === 'warn' ? 'تعمل مع تنبيهات' : 'يوجد عطل يحتاج تدخلًا'}</h2>
            <p>{s.bad} عطل · {s.warn} تنبيه · {s.ok} فحص سليم · آخر فحص <bdi>{new Date(rep!.generatedAt).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { timeZone: 'Asia/Riyadh' })}</bdi>{rep!.alerts ? ` · الجرس: +${rep!.alerts.inserted} / حُل ${rep!.alerts.resolved}` : ''}</p>
          </div>
          <label className="he-toggle he-noprint"><input type="checkbox" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)} /> المشكلات فقط</label>
        </section>
      )}

      <section className="rm-card he-noprint">
        <h3><Icon name="play" size={16} /> اختبارات فورية</h3>
        <div className="he-tests">
          <div className="he-test">
            <b>اختبار البريد</b><span>يرسل رسالة إلى بريد حسابك عبر Resend ويقيس الزمن.</span>
            <button className="rm-btn" disabled={tests.test_email?.busy} onClick={() => runTest('test_email')}><Icon name="mail" size={15} /> {tests.test_email?.busy ? 'جارٍ الإرسال…' : 'أرسل بريدًا تجريبيًا إليّ'}</button>
            {tests.test_email?.result && <div className={`he-res ${tests.test_email.result.success ? 'ok' : 'bad'}`}>{tests.test_email.result.success ? `وصل إلى Resend بنجاح → ${tests.test_email.result.to} (${tests.test_email.result.ms} ms)` : `فشل: ${tests.test_email.result.error}`}</div>}
          </div>
          <div className="he-test">
            <b>اختبار الذكاء الاصطناعي</b><span>يكتشف النماذج المتاحة ويطلب ردًا قصيرًا من النموذج.</span>
            <button className="rm-btn" disabled={tests.test_ai?.busy} onClick={() => runTest('test_ai')}><Icon name="star" size={15} /> {tests.test_ai?.busy ? 'جارٍ الاختبار…' : 'اختبر النموذج'}</button>
            {tests.test_ai?.result && <div className={`he-res ${tests.test_ai.result.success ? 'ok' : 'bad'}`}>{tests.test_ai.result.success ? `يعمل: ${tests.test_ai.result.provider} · ${tests.test_ai.result.model} (${tests.test_ai.result.ms} ms)` : `فشل: ${tests.test_ai.result.error}${tests.test_ai.result.model ? ` · ${tests.test_ai.result.model}` : ''}`}</div>}
          </div>
        </div>
      </section>

      {busy && !rep && <div className="rm-card rm-empty"><b>جارٍ فحص المنصة…</b></div>}
      {grouped.map(({ g, items }) => (
        <section className="rm-card" key={g}>
          <h3><Icon name={g === 'env' ? 'settings' : g === 'cron' ? 'clock' : g === 'mail' ? 'mail' : g === 'ai' ? 'star' : 'folder'} size={16} /> {GROUP_LABEL[g]} <small><bdi dir="ltr">{items.filter(i => i.status === 'ok').length}/{items.length}</bdi> سليم</small></h3>
          <ul className="he-list">
            {items.map(c => (
              <li key={c.id} className={c.status}>
                <span className={`he-st ${c.status}`}>{STATUS_LABEL[c.status]}</span>
                <div className="he-body"><b>{c.label}</b><span>{c.detail}</span>{c.hint && <em><Icon name="compass" size={12} /> {c.group === 'env' ? <bdi dir="ltr">{c.hint}</bdi> : c.hint}</em>}</div>
                {c.href && <Link href={c.href} className="he-go he-noprint">افتح <Icon name="arrow" size={13} /></Link>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {rep && grouped.length === 0 && <div className="rm-card rm-empty"><Icon name="check" size={34} /><b>لا توجد مشكلات</b><span>كل الفحوصات سليمة.</span></div>}
      {rep && (
        <footer className="he-foot">
          قاعدة البيانات: {rep.raw?.db?.ok ? `${rep.raw.db.latencyMs} ms` : 'غير متاحة'} · برامج {rep.raw?.counts?.programs} (نشطة {rep.raw?.counts?.programs_active}) · قاعات {rep.raw?.counts?.classrooms} · مدربون {rep.raw?.counts?.trainers} · تقييمات {rep.raw?.counts?.evaluations} · شهادات {rep.raw?.counts?.certificates} · مؤشرات {rep.raw?.counts?.outcome_kpis}
        </footer>
      )}
    </div>
  );
}

const CSS = `
.he{font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif;color:#2A1626}
.he *{box-sizing:border-box}
.he-hero{display:flex;align-items:center;gap:18px;background:#fff;border:1px solid #EADFD6;border-radius:16px;padding:18px 22px;margin-bottom:14px;flex-wrap:wrap}
.he-hero.ok{border-color:#BFE1DC;background:linear-gradient(90deg,#E6F3F1,#fff)}.he-hero.warn{border-color:#F1D9A8;background:linear-gradient(90deg,#FBF4EE,#fff)}.he-hero.bad{border-color:#F3C4B6;background:linear-gradient(90deg,#FBEDE7,#fff)}
.he-score{display:flex;align-items:baseline;gap:2px;min-width:120px}.he-score b{font-size:46px;color:${NAVY};line-height:1}.he-score span{color:#B3A5AE;font-weight:800}
.he-hero.ok .he-score b{color:#2F6B66}.he-hero.warn .he-score b{color:#8A5A1E}.he-hero.bad .he-score b{color:#B9544A}
.he-hero-txt{flex:1;min-width:240px}.he-hero-txt h2{margin:0 0 4px;font-size:19px;color:${NAVY}}.he-hero-txt p{margin:0;color:#8E7F8A;font-size:12.5px;font-weight:700}
.he-toggle{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:800;color:#5C4858;cursor:pointer}.rm-card h3 small{margin-inline-start:auto;font-size:12px;color:#8E7F8A;font-weight:800}
.he-tests{display:grid;grid-template-columns:1fr 1fr;gap:12px}.he-test{border:1px solid #EADFD6;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;align-items:flex-start;background:#FBF4EE}.he-test b{color:${NAVY};font-size:14px}.he-test>span{font-size:12.5px;color:#8E7F8A;font-weight:700}
.he-res{font-size:12.5px;font-weight:800;border-radius:8px;padding:6px 10px;width:100%}.he-res.ok{background:#E6F3F1;color:#1F4F4A}.he-res.bad{background:#FBEDE7;color:#9A3A2A}
.he-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.he-list li{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:start;border:1px solid #EADFD6;border-radius:12px;padding:10px 14px;background:#fff;border-inline-start:4px solid #D9CBC2}
.he-list li.ok{border-inline-start-color:#2F6B66}.he-list li.warn{border-inline-start-color:#8A5A1E;background:#FBF4EE}.he-list li.bad{border-inline-start-color:#D4614A;background:#FBEDE7}.he-list li.info{border-inline-start-color:#B3A5AE}
.he-st{font-size:11px;font-weight:900;border-radius:999px;padding:3px 9px;background:#F6EBE0;color:#5C4858;white-space:nowrap;margin-top:2px}.he-st.ok{background:#E6F3F1;color:#2F6B66}.he-st.warn{background:#FBF4EE;color:#8A5A1E}.he-st.bad{background:#FBEDE7;color:#B9544A}
.he-body{display:flex;flex-direction:column;gap:2px;min-width:0}.he-body b{font-size:13.5px;color:#2A1626}.he-body span{font-size:12.5px;color:#5C4858;font-weight:700;line-height:1.7}.he-body em{font-style:normal;font-size:11.5px;color:#D4614A;font-weight:800;display:flex;align-items:center;gap:4px;word-break:break-word}
.he-go{font-size:12px;font-weight:900;color:${NAVY};text-decoration:none;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;margin-top:4px}
.he-foot{color:#B3A5AE;font-size:11.5px;font-weight:700;text-align:center;padding:6px;line-height:1.8}
@media print{.he{}.he-noprint{display:none!important}.global-nav{display:none!important}}
@media(max-width:980px){.he{}.he-tests{grid-template-columns:1fr}.he-list li{grid-template-columns:auto 1fr}.he-go{grid-column:2}}
`;
