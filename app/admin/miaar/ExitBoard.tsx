'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «لوحة نهاية المستوى» (م6 «عُبور») — لسان 09 في /admin/miaar/exit[?invite=<id>]
 *  بلا دعوة: قائمة دعوات «اختبار نهاية المستوى» المفتوحة والمغلقة (من القاعات). بدعوة: القاعة والمستوى والنافذة والرابط وQR،
 *  «قاعة المراقبة الحيّة» (استطلاع كل 15 ث: من بدأ · التقدّم · خامل > 5 دقائق)، جدول النتائج (الكلّي · المهارات الخمس · الحكم)،
 *  عدّاد الاجتياز، CSV، «قرار العبور» للمجتازين (بتوقيع المشرف — لا ترقية تلقائية)، و«الإعادة الذكية لمهارة واحدة» للاجتياز المشروط،
 *  وطباعة «جدول المواصفات الحيّ». التصحيح البشري يبقى في لسان 06.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { qrSvg } from '../../../lib/certificates/qr';
import { Icon } from '../../../lib/ui/icons';
import RemedialPanel, { RM_CSS } from './RemedialPanel'; /* م6-ج */
import PracticePanel, { PR_CSS } from './PracticePanel'; /* م10 مِران */

type Row = { email: string; name: string; status: 'invited' | 'started' | 'finished' | 'expired'; started_at: string | null; finished_at: string | null; answered: number; total: number; idle_min: number | null; report_code: string | null; report_id?: string | null; session_id?: string | null; integrity?: string | null; exit: any | null };
/* م8 «شاهِد» */ type Wit = { level: 'calm' | 'watch' | 'review'; level_ar: string; signals: number; frames: number; last_frame_at: string | null; last_frame_url: string | null; camera: 'on' | 'off' | 'none'; counters: Record<string, number> };
const INTEG: Record<string, [string, string]> = { pending: ['قيد المراجعة', 'warn'], clear: ['سليم', 'ok'], note: ['ملاحظة', 'warn'], invalid: ['لاغٍ', 'bad'] };
type Board = { practice?: Record<string, any> /* م10 */; url: string; invite: any; classroom: any; window: 'before' | 'open' | 'after'; rows: Row[]; summary: any; spec: any; official: { ar: string; en: string }; order?: any | null /* م7 */; witness?: Record<string, Wit> | null; witness_mode?: string; witness_mode_ar?: string /* م8 */; reach?: Record<string, { count: number; pushed: boolean; last_at: string | null; last_kind: string | null; sub: boolean }> /* P39 */ }
  & { units?: HeatRow[]; fairness?: FairRow[]; fairness_groups?: number; unit_scope?: string[] | null /* م6-ب */ };
type HeatRow = { code: string; title_ar: string; n_items: number; n_students: number; correct: number; percent: number; state: 'weak' | 'watch' | 'ok'; state_ar: string };
type FairRow = { code: string; title_ar: string; groups: number; of: number; labels: string[]; avg: number };;
const SVC_ST: Record<string, string> = { prepared: 'مُعدّ', open: 'مفتوح', rating: 'قيد التصحيح', delivered: 'سُلِّم', invoiced: 'مُفوتَر', cancelled: 'أُلغي' };
const SVC_NEXT: Record<string, Array<[string, string]>> = { prepared: [['open', 'فتح']], open: [['rating', 'قيد التصحيح'], ['delivered', 'سُلِّم']], rating: [['delivered', 'سُلِّم']], delivered: [['invoiced', 'مُفوتَر']], invoiced: [], cancelled: [] };
const SK = ['listening', 'reading', 'grammar_vocab', 'writing', 'speaking'] as const;
const SKN: Record<string, string> = { listening: 'استماع', reading: 'قراءة', grammar_vocab: 'مفردات وتراكيب', writing: 'كتابة', speaking: 'تحدّث' };
const OUT: Record<string, [string, string]> = { passed: ['اجتاز', 'ok'], conditional: ['مشروط', 'warn'], failed: ['لم يجتز', 'bad'], pending: ['قيد التصحيح', 'mute'] };
const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const WIN: Record<Board['window'], [string, string]> = { before: ['لم تُفتح بعد', 'mute'], open: ['مفتوحة الآن', 'ok'], after: ['أُغلقت', 'bad'] };

export default function ExitBoard({ auth }: { auth: () => Promise<Record<string, string>> }) {
  const [inviteId, setInviteId] = useState<string | null | undefined>(undefined); const [list, setList] = useState<any[]>([]);
  const [b, setB] = useState<Board | null>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set()); const [live, setLive] = useState(true); const [at, setAt] = useState(''); const [retakeUrl, setRetakeUrl] = useState<{ email: string; url: string; until: string } | null>(null);
  const [clientUrl, setClientUrl] = useState(''); const [proctor, setProctor] = useState(''); /* م7 */
  const timer = useRef<number | null>(null);
  useEffect(() => { try { setInviteId(new URLSearchParams(window.location.search).get('invite')); } catch { setInviteId(null); } }, []);
  const load = useCallback(async () => {
    const H = await auth();
    if (!inviteId) { const j = await fetch('/api/admin/miaar', { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.success) setList(((j.invites || []) as any[]).filter((x) => x.purpose === 'level_exit' || x.purpose === 'skill_retake')); return; }
    const j = await fetch(`/api/admin/miaar/exit?invite=${encodeURIComponent(inviteId)}`, { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    if (!j?.success) { setErr(j?.error || 'تعذّر تحميل اللوحة'); return; } setErr(''); setB(j); setAt(new Date().toLocaleTimeString('ar-SA'));
  }, [auth, inviteId]);
  useEffect(() => { if (inviteId !== undefined) void load(); }, [load, inviteId]);
  /* قاعة المراقبة الحيّة: استطلاع خفيف كل 15 ثانية ما دامت النافذة مفتوحة واللسان ظاهرًا */
  useEffect(() => {
    if (!inviteId || !live) return; const tick = async () => { if (document.hidden) return; const H = await auth(); const j = await fetch(`/api/admin/miaar/exit?invite=${encodeURIComponent(inviteId)}&live=1`, { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.success) { setB((p) => (p ? { ...p, rows: j.rows, summary: j.summary, window: j.window, witness: j.witness || p.witness } : p)); setAt(new Date().toLocaleTimeString('ar-SA')); } };
    timer.current = window.setInterval(() => { void tick(); }, 15000); return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [inviteId, live, auth]);
  async function post(body: Record<string, unknown>) {
    setBusy(String(body.action)); setErr(''); setOk('');
    try { const j = await fetch('/api/admin/miaar/exit', { method: 'POST', headers: await auth(), body: JSON.stringify(body) }).then((r) => r.json()); if (!j?.success) { setErr(j?.error || 'تعذّر التنفيذ'); return null; } return j; }
    catch { setErr('تعذّر الاتصال'); return null; } finally { setBusy(''); }
  }
  const rows = b?.rows || []; const passedIds = useMemo(() => rows.filter((r) => r.exit?.الحالة === 'final' && r.exit?.النتيجة === 'passed' && !r.exit?.قرار_العبور && r.report_id).map((r) => r.report_id as string), [rows]);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  async function promote() {
    const ids = [...sel].filter((id) => passedIds.includes(id)); if (!ids.length) { setErr('حدّد مجتازين أولًا — «قرار العبور» للمجتازين نهائيًا فقط'); return; }
    if (!window.confirm(`تأكيد قرار العبور لـ ${ids.length} متعلّمًا إلى المستوى التالي؟ يُسجَّل باسمك في سجلّ التدقيق.`)) return;
    const j = await post({ action: 'promote', report_ids: ids }); if (j) { setOk(`سُجّل قرار العبور: ${j.done} ✓${j.skipped ? ` · تخطّى ${j.skipped}` : ''}`); setSel(new Set()); await load(); }
  }
  async function retake(r: Row) { if (!r.report_id) return; const j = await post({ action: 'skill_retake', report_id: r.report_id }); if (j) { setRetakeUrl({ email: r.email, url: j.url, until: j.expires_at }); setOk(`أُنشئت دعوة إعادة مهارة ${SKN[j.skill] || j.skill} — انسخ الرابط وأرسله للمتعلّم`); await load(); } }
  /* م7 «عُبور للجهات»: إجراءات سجلّ الخدمة */
  async function svc(body: Record<string, unknown>) {
    setBusy(String(body.action)); setErr(''); setOk('');
    try { const j = await fetch('/api/admin/miaar/service', { method: 'POST', headers: await auth(), body: JSON.stringify({ ...body, order_id: b?.order?.id }) }).then((r) => r.json()); if (!j?.success) { setErr(j?.error || 'تعذّر التنفيذ'); return null; } return j; }
    catch { setErr('تعذّر الاتصال'); return null; } finally { setBusy(''); }
  }
  /* م8: «همسة المراقب» — سطر هادئ يظهر للمتقدّم خلال ~20 ث */
  async function whisper(r: Row) { const text = window.prompt(`همسة إلى ${r.name || r.email} (تظهر على شاشته بهدوء):`, 'يرجى البقاء داخل إطار الكاميرا'); if (!text || !r.session_id) return; const H = await auth(); const j = await fetch('/api/admin/miaar/witness', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'whisper', session_id: r.session_id, text }) }).then((x) => x.json()).catch(() => null); if (j?.success) setOk('أُرسلت الهمسة'); else setErr(j?.error || 'تعذّر الإرسال'); }
  async function svcStatus(to: string) { if (!window.confirm(`تغيير حالة الخدمة إلى «${SVC_ST[to] || to}»؟${to === 'delivered' ? ' (تُغلق الدعوة)' : ''}`)) return; const j = await svc({ action: 'status', status: to }); if (j) { setOk(`حالة الخدمة: ${SVC_ST[to] || to}`); await load(); } }
  async function svcLink() { const j = await svc({ action: 'client_link' }); if (j) { setClientUrl(j.client_url); setOk('رابط جديد لبوابة الجهة — القديم أُبطل. انسخه الآن؛ لا يُعرض ثانية.'); await load(); } }
  async function svcRevoke() { if (!window.confirm('إبطال رابط بوابة الجهة؟ لن تستطيع الجهة فتح لوحتها حتى تُرسل رابطًا جديدًا.')) return; const j = await svc({ action: 'revoke_link' }); if (j) { setClientUrl(''); setOk('أُبطل رابط بوابة الجهة'); await load(); } }
  async function svcSign() { const j = await svc({ action: 'sign', name: proctor }); if (j) { setOk('وُقّع كشف الحضور — الشهادات تحمل «أُدّي بحضور مراقب»'); setProctor(''); await load(); } }
  async function svcReport() {
    if (!b?.order) return; const H = await auth(); const j = await fetch(`/api/admin/miaar/service?order=${encodeURIComponent(b.order.id)}`, { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.success || !j.report) { setErr('تعذّر بناء تقرير الجهة'); return; }
    const rp = j.report; const w = window.open('', '_blank'); if (!w) return;
    const skills = rp.skills.map((x: any) => `<tr><td>${esc(x.name_ar)} · ${esc(x.name_en)}</td><td>${x.avg ?? '—'}${x.avg !== null ? '%' : ''}</td><td>${x.below}</td><td>${x.benchmark ?? '—'}${x.benchmark !== null ? '%' : ''}</td><td>${x.delta === null ? '—' : (x.delta > 0 ? '+' : '') + x.delta}</td></tr>`).join('');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الجهة — ${esc(b.order.client_name)}</title><style>@page{size:A4;margin:14mm}body{font-family:Tahoma,Arial,sans-serif;color:#0f2a4e;line-height:1.7}h1{font-size:22px;margin:0}h2{font-size:16px;margin:18px 0 6px;color:#0b8a83}.k{color:#c9a24b;font-weight:800;font-size:13px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{border:1px solid #e2e8f0;padding:6px 8px;text-align:start}th{background:#f8fafc}.rec{background:#fffdf5;border:1px dashed #c9a24b;border-radius:8px;padding:8px 12px}.f{margin-top:18px;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:8px}</style></head><body><p class="k">${esc(j.service.ar)} · ${esc(j.service.en)}</p><h1>تقرير الجهة — ${esc(b.order.client_name)}</h1><p>${esc(j.official.ar)} · المستوى <b>${esc(rp.level)}</b> · جدول المواصفات ${esc(rp.spec.version)} · الدعوة ${esc(b.invite.code)}</p><p>مدعو/ظهر ${rp.summary.invited} · أنهى ${rp.summary.finished} · اجتاز ${rp.summary.passed} · مشروط ${rp.summary.conditional} · لم يجتز ${rp.summary.failed} · قيد التصحيح ${rp.summary.pending} · متوسط الكلّي ${rp.summary.avg ?? '—'}${rp.summary.avg !== null ? '%' : ''} · المعيار المرجعي ${rp.benchmark.avg ?? '—'}${rp.benchmark.avg !== null ? `% (ن=${rp.benchmark.n})` : ' (عيّنة أقل من 30)'}</p><h2>المحاور</h2><table><thead><tr><th>المحور</th><th>متوسط المجموعة</th><th>دون 50%</th><th>المعيار المرجعي</th><th>الفارق</th></tr></thead><tbody>${skills}</tbody></table><h2>التوصية</h2><div class="rec">${rp.recommendations_ar.map((r: string) => `<p>${esc(r)}</p>`).join('')}</div><p class="f">${b.order.proctor_signed_at ? `أُدّي بحضور مراقب — ${esc(b.order.proctor_name || '')} · ` : ''}الحكم المركّب 60/20/20 — اجتياز ≥ 60% ولا مهارة دون 50% · البنود ومفاتيحها لا تُشارك · © 2026 مِعيار — من أَثَر.</p></body></html>`);
    w.document.close(); w.focus(); w.print();
  }
  async function closeInvite() { if (!b || !window.confirm('إغلاق هذه الدعوة؟ لن يستطيع أحد البدء بعدها.')) return; const j = await post({ action: 'close', invite_id: b.invite.id }); if (j) { setOk('أُغلقت الدعوة'); await load(); } }
  function csv() {
    if (!b) return; const head = ['الاسم', 'البريد', 'الحالة', 'بدأ', 'أنهى', 'الكلّي', ...SK.map((k) => SKN[k]), 'الحكم', 'التقدير', 'رمز النتيجة'];
    const lines = rows.map((r) => [r.name, r.email, r.status, r.started_at || '', r.finished_at || '', r.exit?.الكلي ?? '', ...SK.map((k) => r.exit?.المهارات?.[k]?.النسبة ?? ''), r.exit ? OUT[r.exit.النتيجة]?.[0] || '' : '', r.exit?.تقدير_ar || '', r.report_code || ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob(['\ufeff' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `exit-${b.invite.level_target || ''}-${b.invite.code}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }
  function printSpec() {
    if (!b?.spec) return; const w = window.open('', '_blank'); if (!w) return; const s = b.spec; const inv = b.invite;
    const trs = s.rows.map((r: any) => `<tr><td>${esc(SKN[r.skill])}</td><td>${r.count} ${esc(r.unit_ar)}</td><td>${Math.round(r.weight)}%</td><td>${esc(r.note_ar)}</td></tr>`).join('');
    const live = `<p class="l">دعوة ${esc(inv.code)} · ${esc(b.classroom?.name || b.classroom?.code || '')} · النافذة: ${inv.opens_at ? esc(fmt(inv.opens_at)) : 'فورًا'} → ${inv.expires_at ? esc(fmt(inv.expires_at)) : 'مفتوحة'} · المقاعد ${inv.max_seats ?? '—'} · بدأ ${b.summary.started} · أنهى ${b.summary.finished} · اجتاز ${b.summary.passed}</p>`;
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>جدول المواصفات — ${esc(s.level)}</title><style>@page{size:A4;margin:14mm}body{font-family:Tahoma,Arial,sans-serif;color:#0f2a4e;line-height:1.7}h1{font-size:22px;margin:0}h2{font-size:15px;color:#0b8a83;margin:4px 0 14px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:right}th{background:#f1f5f9}.l{font-size:12px;color:#475569;border:1px dashed #c9a24b;padding:8px 10px;border-radius:8px}.f{font-size:11px;color:#64748b;margin-top:18px}</style></head><body><h1>${esc(b.official.ar)} — المستوى ${esc(s.level)}</h1><h2>${esc(b.official.en)} · جدول المواصفات ${esc(s.version)} · ${s.minutes} دقيقة · الاجتياز ${s.cut}% ولا مهارة دون ${s.skillMin}%</h2><table><thead><tr><th>المحور</th><th>العدد</th><th>الوزن</th><th>الشكل والتصحيح</th></tr></thead><tbody>${trs}<tr><th>الاستقبالي</th><th>${s.total} بندًا</th><th>60%</th><th>اختيار من متعدّد · تصحيح آلي</th></tr></tbody></table><br>${live}<p class="f">التقدير: ممتاز ≥85 · جيد جدًا 75–84 · جيد 65–74 · اجتياز 60–64. مهارة واحدة دون 50% مع كلّي ناجح = اجتياز مشروط (إعادة تلك المهارة خلال 14 يومًا). © 2026 د. أحمد محمد عبدالعزيز بدوي — أَثَر · مِعيار.</p><script>window.print()</script></body></html>`);
    w.document.close();
  }
  if (inviteId === undefined) return null;
  if (!inviteId) return <section className="am-card" data-testid="xb-list"><style>{CSS}</style>
    <h3>دعوات اختبار نهاية المستوى <small>تُنشأ من زرّ «اختبار نهاية المستوى» بجانب كل قاعة في إدارة القاعات</small></h3>
    <p className="xb-hint">الطريق: <a href="/admin/management?tab=rooms">إدارة القاعات</a> → بجانب القاعة زرّ «اختبار نهاية المستوى» → يظهر الرابط وQR وتُفتح هذه اللوحة.</p>
    {list.length === 0 ? <p className="xb-muted">لا دعوات بعد.</p> : <table className="xb-t"><thead><tr><th>الدعوة</th><th>المستوى</th><th>النوع</th><th>الحالة</th><th>بدأ</th><th>أنهى</th><th>اللوحة</th></tr></thead><tbody>
      {list.map((x) => <tr key={x.id}><td>{x.label_ar}<br /><code dir="ltr">{x.code}</code></td><td>{x.level_target || '—'}</td><td>{x.purpose === 'skill_retake' ? 'إعادة مهارة' : 'نهاية المستوى'}</td><td>{x.status === 'open' ? 'مفتوحة' : 'مغلقة'}</td><td>{x.started}</td><td>{x.finished}</td><td><a className="xb-btn" href={`/admin/miaar/exit?invite=${x.id}`}>فتح</a></td></tr>)}
    </tbody></table>}
  </section>;
  if (!b) return <section className="am-card"><style>{CSS}</style>{err ? <div className="am-err" role="alert">{err}</div> : <p className="xb-muted">جارٍ التحميل…</p>}</section>;
  const s = b.summary; const w = WIN[b.window];
  return <>
    <style>{CSS}</style>
    {err && <div className="am-err" role="alert">{err}</div>}{ok && <div className="am-ok" role="status">{ok}</div>}
    <section className="am-card xb-head" data-testid="xb-board">
      <div className="xb-info">
        <p className="xb-k">{b.official.ar} · <span dir="ltr">{b.official.en}</span></p>
        <h3>{b.invite.label_ar}</h3>
        <p className="xb-meta">المستوى <b>{b.invite.level_target}</b> · {b.order ? <>الجهة الطالبة <b data-testid="xb-client">{b.order.client_name}</b></> : <>القاعة <b>{b.classroom?.name || b.classroom?.code || '—'}</b></>} · النافذة <span className={`xb-pill ${w[1]}`} data-testid="xb-window">{w[0]}</span>{b.witness_mode && b.witness_mode !== 'room' && <span className="xb-pill ok" data-testid="xb-witness-mode">◉ {b.witness_mode_ar}</span>} {b.invite.opens_at ? `من ${fmt(b.invite.opens_at)}` : ''} {b.invite.expires_at ? `حتى ${fmt(b.invite.expires_at)}` : ''} · المقاعد {b.invite.max_seats ?? 'بلا حدّ'} · الدعوة <code dir="ltr">{b.invite.code}</code> {b.invite.status !== 'open' && <span className="xb-pill bad">مغلقة</span>}</p>
        <div className="xb-acts">
          <button type="button" className="xb-btn" onClick={() => { void navigator.clipboard?.writeText(b.url); setOk('نُسخ الرابط'); }} data-testid="xb-copy"><Icon name="copy" size={14} /> نسخ الرابط</button>
          <a className="xb-btn" href={b.url} target="_blank" rel="noreferrer">معاينة</a>
          <button type="button" className="xb-btn" onClick={printSpec} data-testid="xb-spec"><Icon name="print" size={14} /> جدول المواصفات الحيّ</button>
          <button type="button" className="xb-btn" onClick={csv} data-testid="xb-csv">CSV</button>
          {b.invite.status === 'open' && <button type="button" className="xb-btn danger" onClick={() => void closeInvite()} disabled={busy === 'close'}>إغلاق الدعوة</button>}
          <a className="xb-btn ghost" href="/admin/management?tab=rooms">← إدارة القاعات</a>
        </div>
      </div>
      <div className="xb-qr" dangerouslySetInnerHTML={{ __html: qrSvg(b.url, 150) }} />
    </section>
    {b.order && <section className="am-card xb-svc" data-testid="xb-service">
      <div className="xb-bar"><h3>سجلّ الخدمة <small>خدمة الاختبار المعياري للجهات</small></h3><span className={`xb-pill ${b.order.status === 'delivered' || b.order.status === 'invoiced' ? 'ok' : b.order.status === 'cancelled' ? 'bad' : 'warn'}`} data-testid="xb-svc-status">{SVC_ST[b.order.status] || b.order.status}</span></div>
      <p className="xb-meta">الجهة <b>{b.order.client_name}</b>{b.order.client_contact ? <> · المنسّق <span dir="ltr">{b.order.client_contact}</span></> : null} · المقاعد {b.order.seats ?? '—'} · المستهلك <b>{Math.max(Number(b.order.seats_used) || 0, s.started)}</b> · رمز قاعة: {b.invite.has_pin ? 'نعم' : 'لا'} · بوابة الجهة: {b.invite.has_client_link ? 'فعّالة' : 'مُبطلة'}{b.order.note ? <> · <i>{b.order.note}</i></> : null}</p>
      <div className="xb-acts">
        {(SVC_NEXT[b.order.status] || []).map(([to, l]) => <button key={to} type="button" className="xb-btn primary" onClick={() => void svcStatus(to)} disabled={busy === 'status'} data-testid={`xb-svc-${to}`}>{l}</button>)}
        <button type="button" className="xb-btn" onClick={() => void svcReport()} data-testid="xb-svc-report"><Icon name="print" size={14} /> تقرير الجهة (A4)</button>
        <button type="button" className="xb-btn" onClick={() => void svcLink()} disabled={busy === 'client_link'} data-testid="xb-svc-link">رابط بوابة الجهة (جديد)</button>
        {b.invite.has_client_link && <button type="button" className="xb-btn danger" onClick={() => void svcRevoke()} disabled={busy === 'revoke_link'} data-testid="xb-svc-revoke">إبطال الرابط</button>}
        {b.order.status !== 'invoiced' && b.order.status !== 'cancelled' && <button type="button" className="xb-btn danger" onClick={() => void svcStatus('cancelled')}>إلغاء الخدمة</button>}
      </div>
      {clientUrl && <div className="xb-retake" data-testid="xb-client-url"><b>رابط بوابة الجهة (مرة واحدة):</b> <code dir="ltr">{clientUrl}</code> <button type="button" className="xb-btn" onClick={() => { void navigator.clipboard?.writeText(clientUrl); setOk('نُسخ رابط الجهة'); }}>نسخ</button></div>}
      {b.order.proctor_signed_at ? <p className="xb-ok" data-testid="xb-sealed">ختم المراقب: <b>{b.order.proctor_name}</b> · {fmt(b.order.proctor_signed_at)} — الشهادات تحمل «أُدّي بحضور مراقب».</p>
        : <div className="xb-sign"><input value={proctor} onChange={(e) => setProctor(e.target.value)} placeholder="اسم المراقب الذي حضر القاعة" maxLength={120} data-testid="xb-proctor" /><button type="button" className="xb-btn" disabled={proctor.trim().length < 3 || busy === 'sign'} onClick={() => void svcSign()} data-testid="xb-sign">ختم المراقب</button><small>أو يوقّعه منسّق الجهة من بوابته.</small></div>}
      <p className="xb-hint">لا «قرار عبور» هنا (لا برنامج) — المخرجات: الشهادات برمز التحقّق، تقرير الجهة، CSV، وبوابة الجهة الحيّة. نتائج الجهة لا تدخل في مؤشرات برامج أَثَر.</p>
    </section>}
    <section className="am-card" data-testid="xb-summary">
      <div className="xb-sum">
        <div><b>{s.invited}</b><span>مدعوّ/ظهر</span></div><div><b>{s.started}</b><span>بدأ</span></div><div><b>{s.finished}</b><span>أنهى</span></div><div><b>{s.pending}</b><span>قيد التصحيح</span></div>
        <div className="ok"><b data-testid="xb-passed">{s.passed}</b><span>اجتاز</span></div><div className="warn"><b>{s.conditional}</b><span>مشروط</span></div><div className="bad"><b>{s.failed}</b><span>لم يجتز</span></div>
        <div><b>{s.avg ?? '—'}{s.avg !== null ? '%' : ''}</b><span>متوسط الكلّي</span></div>
        {s.growth_avg !== null && <div className="gold"><b>{s.growth_avg > 0 ? '+' : ''}{s.growth_avg}</b><span>خطّ العبور (متوسط النموّ · {s.growth_n})</span></div>}
      </div>
      <p className="xb-live"><label><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> قاعة المراقبة الحيّة (كل 15 ث)</label> {at && <span>آخر تحديث {at}</span>} · الخامل أكثر من 5 دقائق يُعلَّم <span className="xb-pill warn">خامل</span></p>
    </section>
    {Array.isArray(b.units) && b.units.length > 0 && <section className="am-card xb-units" data-testid="xb-units" aria-labelledby="xb-ut">
      <div className="xb-bar"><h3 id="xb-ut">أين ضعفت المجموعة؟ <small>وحدات المستوى — من الأضعف</small></h3>{b.unit_scope?.length ? <span className="xb-pill warn" data-testid="xb-scoped">ما دُرّس فقط: {b.unit_scope.length} وحدة</span> : null}</div>
      <ol className="xb-heat">{b.units.map((u) => <li key={u.code} className={`xb-h ${u.state}`} data-testid="xb-unit" data-state={u.state}><span className="xb-hc" dir="ltr">{u.code}</span><span className="xb-hn">{u.title_ar}</span><span className="xb-hb" aria-hidden="true"><i style={{ width: `${u.percent}%` }} /></span><b>{u.percent}%</b><small>{u.n_students} متعلّم · {u.n_items} بند</small></li>)}</ol>
      {b.units.some((u) => u.state === 'weak') && <p className="xb-lesson" data-testid="xb-lesson"><b>درس التعويض المقترح:</b> {b.units.filter((u) => u.state === 'weak').slice(0, 3).map((u) => u.title_ar).join(' · ')} — تُرتَّب جلسة مراجعة قبل البرنامج التالي، وتبقى النتيجة الرسمية كما هي.</p>}
      {inviteId && <RemedialPanel inviteId={inviteId} auth={auth} />}
      {Array.isArray(b.fairness) && b.fairness.length > 0 && <div className="xb-fair" data-testid="xb-fairness"><b>العدالة بين الشُّعب</b> <small>وحدة حمراء في شعبتين فأكثر من شُعب هذا المستوى = مشكلة منهج لا مشكلة شعبة</small><ul>{b.fairness.map((f) => <li key={f.code}><span className="xb-hc" dir="ltr">{f.code}</span> <strong>{f.title_ar}</strong> — ضعيفة في {f.groups} من {f.of} شُعب (متوسّط {f.avg}%) <span className="xb-fl">{f.labels.map((l, k) => <i key={k}>{l}</i>)}</span></li>)}</ul><button type="button" className="xb-btn sm" data-testid="xb-fair-copy" onClick={() => { const txt = `ملاحظة منهج من لوحة العبور (${b.invite?.level_target || ''}):\n` + b.fairness!.map((f) => `- ${f.code} «${f.title_ar}» حمراء في ${f.groups} من ${f.of} شُعب (${f.labels.join('، ')}) — متوسّط ${f.avg}%`).join('\n') + `\nالمصدر: ${window.location.href}`; navigator.clipboard?.writeText(txt).then(() => setOk('نُسخت ملاحظة المنهج — ألصقها في «مراجعة البرنامج» (P47) أو في هندسة البرامج.')).catch(() => setOk('تعذّر النسخ')); }}><Icon name="copy" size={13} /> انسخ ملاحظة المنهج لمراجعة البرنامج</button></div>}
      {Array.isArray(b.fairness) && !b.fairness.length && (b.fairness_groups || 0) >= 2 && <p className="xb-muted">العدالة بين الشُّعب: لا وحدة ضعيفة مشتركة بين شُعب هذا المستوى ({b.fairness_groups} شُعب).</p>}
    </section>}
    {inviteId && <section className="am-card" data-testid="xb-practice"><PracticePanel inviteId={inviteId} auth={auth} onChanged={() => void load()} /></section>}
    <section className="am-card" data-testid="xb-rows">
      <div className="xb-bar">
        <h3>المتعلّمون <small>{rows.length}</small></h3>
        {!b.order && <div className="xb-acts"><button type="button" className="xb-btn primary" onClick={() => void promote()} disabled={!sel.size || busy === 'promote'} data-testid="xb-promote"><Icon name="check" size={14} /> قرار العبور للمحدّدين ({[...sel].filter((id) => passedIds.includes(id)).length})</button>{passedIds.length > 0 && <button type="button" className="xb-btn" onClick={() => setSel(new Set(passedIds))}>تحديد كل المجتازين</button>}</div>}
      </div>
      {retakeUrl && <div className="xb-retake" data-testid="xb-retake-url"><b>دعوة إعادة المهارة لـ {retakeUrl.email}</b> (حتى {fmt(retakeUrl.until)}): <code dir="ltr">{retakeUrl.url}</code> <button type="button" className="xb-btn" onClick={() => { void navigator.clipboard?.writeText(retakeUrl.url); setOk('نُسخ رابط الإعادة'); }}>نسخ</button></div>}
      {rows.length === 0 ? <p className="xb-muted">لم يبدأ أحد بعد — حين يمسح المتعلّمون الرمز تظهر أسماؤهم هنا مباشرة.</p> : <table className="xb-t"><thead><tr><th></th><th>المتعلّم</th><th>الحالة</th><th>التقدّم</th><th>الكلّي</th>{SK.map((k) => <th key={k}>{SKN[k]}</th>)}<th>الحكم</th><th title="هل وصله إشعار داخل أَثَر/دفعة؟">أُبلغ؟</th><th title="مِران — خطّة التمرين بين الحكم والإعادة">مِران</th>{b.witness_mode !== 'room' && <th>الشاهد</th>}<th>إجراء</th></tr></thead><tbody>
        {rows.map((r) => { const ex = r.exit; const o = ex ? OUT[ex.النتيجة] || OUT.pending : null; const w = r.session_id ? b.witness?.[r.session_id] : undefined; const rc = b.reach?.[String(r.email || '').toLowerCase()]; const idle = r.status === 'started' && (r.idle_min ?? 0) > 5; const can = !!r.report_id && passedIds.includes(r.report_id);
          return <tr key={r.email + (r.report_id || '')} data-testid="xb-row" data-outcome={ex?.النتيجة || r.status}>
            <td>{can && <input type="checkbox" checked={sel.has(r.report_id!)} onChange={() => toggle(r.report_id!)} aria-label={`تحديد ${r.name}`} />}</td>
            <td><b>{r.name || '—'}</b><br /><small dir="ltr">{r.email}</small></td>
            <td>{r.status === 'invited' ? 'لم يبدأ' : r.status === 'started' ? <>يختبر الآن {idle && <span className="xb-pill warn">خامل {r.idle_min} د</span>}</> : r.status === 'expired' ? 'انتهى الوقت' : <>أنهى<br /><small>{fmt(r.finished_at)}</small></>}</td>
            <td>{r.total ? <span className="xb-prog" title={`${r.answered}/${r.total}`}><i style={{ width: `${Math.min(100, Math.round((r.answered / r.total) * 100))}%` }} /><em>{r.answered}/{r.total}</em></span> : '—'}</td>
            <td><b>{ex?.الكلي ?? '—'}{typeof ex?.الكلي === 'number' ? '%' : ''}</b>{ex?.تقدير_ar && <><br /><small>{ex.تقدير_ar}</small></>}</td>
            {SK.map((k) => { const v = ex?.المهارات?.[k]; return <td key={k} className={v?.الحالة === 'below' ? 'low' : ''}>{v ? (typeof v.النسبة === 'number' ? `${v.النسبة}%` : v.الحالة === 'pending' ? '⏳' : '—') : '—'}</td>; })}
            <td>{o && <span className={`xb-pill ${o[1]}`}>{o[0]}</span>}{ex?.قرار_العبور && <><br /><small>قرار: → {ex.قرار_العبور.إلى}</small></>}{ex?.الإعادة?.الحالة === 'invited' && <><br /><small>دعوة إعادة حتى {String(ex.الإعادة.حتى).slice(0, 10)}</small></>}{ex?.الإعادة?.الحالة === 'merged' && <><br /><small>أُعيدت {SKN[ex.الإعادة.المهارة]}: {ex.الإعادة.النسبة}%</small></>}</td>
            <td className="xb-reach" data-testid="xb-reach" data-count={rc?.count || 0}>{rc && rc.count > 0 ? <span className={`xb-pill ${rc.pushed ? 'ok' : 'mute'}`} title={`${rc.count} إشعار · آخره ${rc.last_at ? fmt(rc.last_at) : '—'}`}>{rc.pushed ? '🔔 وصله' : '📥 داخل أَثَر'} <small>{rc.count}</small></span> : <span className="xb-muted">—</span>}{rc?.sub && <><br /><small title="له اشتراك «نبّهني» فعّال">مشترك</small></>}</td>{(() => { const pr = r.report_id ? b.practice?.[r.report_id] : null; const RD: Record<string, [string, string]> = { ready: ['جاهز', 'ok'], close: ['يقترب', 'warn'], early: ['مبكر', 'mute'] }; return <td className="xb-pract" data-testid="xb-practice-cell" data-status={pr?.status || 'none'}>{pr && pr.status !== 'cancelled' ? <><span className={`xb-pill ${pr.status === 'approved' ? 'ok' : pr.status === 'done' ? 'mute' : 'warn'}`}>{pr.status === 'draft' ? 'مسوَّدة' : pr.status === 'done' ? 'اكتمل' : `يوم ${pr.today}/${pr.total}`}</span><br /><small>{pr.done}/{pr.total}{typeof pr.avg_delta === 'number' ? ` · ${pr.avg_delta > 0 ? '+' : ''}${pr.avg_delta}` : ''}{pr.ready && pr.status !== 'draft' ? ` · ${RD[pr.ready]?.[0] || ''}` : ''}</small></> : <span className="xb-muted">—</span>}</td>; })()}
            {b.witness_mode !== 'room' && <td className="xb-wit" data-testid="xb-wit" data-level={w?.level || 'none'}>{w ? <div className="xb-witbox">{w.last_frame_url ? <img src={w.last_frame_url} alt="" width={56} height={42} loading="lazy" /> : <span className="xb-noimg" title="لا لقطة">◻</span>}<div><span className={`xb-pill ${w.level === 'review' ? 'bad' : w.level === 'watch' ? 'warn' : 'ok'}`}>{w.level_ar}</span>{w.camera === 'off' && <span className="xb-pill warn">📷 منقطعة</span>}<br /><small title="مغادرة · تركيز · كاميرا · لقطات">👁 {w.counters.tab_hidden} · ⧉ {w.counters.focus_lost} · 📷 {w.counters.camera_lost} · {w.frames} لقطة</small>{r.integrity && <><br /><span className={`xb-pill ${INTEG[r.integrity]?.[1] || ''}`} data-testid="xb-integrity">حكم: {INTEG[r.integrity]?.[0] || r.integrity}</span></>}</div></div> : <small className="xb-muted">—</small>}</td>}
            <td className="xb-rowacts">{r.session_id && b.witness_mode !== 'room' && <a className="xb-btn sm" href={`/admin/miaar/witness?session=${encodeURIComponent(r.session_id)}`} data-testid="xb-witness-link">غرفة الشاهد</a>}{r.session_id && r.status === 'started' && b.witness_mode !== 'room' && <button type="button" className="xb-btn sm" onClick={() => void whisper(r)} data-testid="xb-whisper">همسة</button>}{r.report_code && <a className="xb-btn sm" href={`/miaar/result/${r.report_code}`} target="_blank" rel="noreferrer">النتيجة</a>}{r.report_code && <a className="xb-btn sm" href={`/miaar/result/${r.report_code}/detail`} target="_blank" rel="noreferrer" data-testid="xb-detail-link">تفصيلي</a>}{ex?.النتيجة === 'conditional' && ex?.الحالة === 'final' && !ex?.الإعادة && <button type="button" className="xb-btn sm" onClick={() => void retake(r)} disabled={busy === 'skill_retake'} data-testid="xb-retake">إعادة {SKN[ex.مهارة_الإعادة]}</button>}{ex?.النتيجة === 'passed' && ex?.الحالة === 'final' && r.report_code && <a className="xb-btn sm" href={`/miaar/certificate/${r.report_code}`} target="_blank" rel="noreferrer">الشهادة</a>}</td>
          </tr>; })}
      </tbody></table>}
      <p className="xb-foot">«قرار العبور» يسجّل قرار تسكين «ترقية» إلى المستوى التالي باسم المشرف — ولا يُرقّى أحد تلقائيًا. التصحيح البشري للكتابة والتحدّث في <a href="/admin/miaar/rating">لسان التصحيح</a>؛ حين يُصدر، يكتمل الحكم هنا تلقائيًا.</p>
    </section>
  </>;
}
function esc(s: string) { return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)); }
const CSS = RM_CSS + PR_CSS + `
.xb-head{display:flex;gap:18px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.xb-info{flex:1;min-width:260px}.xb-k{margin:0;color:#0b8a83;font-weight:900;font-size:12.5px}.xb-head h3{margin:4px 0 6px}.xb-meta{margin:0 0 10px;color:#334155;font-size:13.5px;line-height:1.9}.xb-qr svg{width:150px;height:150px;display:block;border:1px solid #e2e8f0;border-radius:12px;padding:6px;background:#fff}
.xb-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.xb-btn{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;font-weight:800;border:1px solid #cbd5e1;background:#fff;color:#0f2a4e;border-radius:10px;padding:7px 12px;cursor:pointer;text-decoration:none;min-height:36px}.xb-btn.primary{background:#0f2a4e;border-color:#0f2a4e;color:#fff}.xb-btn.danger{color:#b91c1c;border-color:#fecaca}.xb-btn.ghost{border-style:dashed}.xb-btn.sm{padding:4px 9px;min-height:30px;font-size:12px}.xb-btn[disabled]{opacity:.5;cursor:not-allowed}
.xb-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px}.xb-sum div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px;text-align:center}.xb-sum b{display:block;font-size:22px;color:#0f2a4e}.xb-sum span{font-size:12px;color:#475569;font-weight:700}.xb-sum .ok{background:#f0fdf4;border-color:#bbf7d0}.xb-sum .warn{background:#fffbeb;border-color:#fde68a}.xb-sum .bad{background:#fef2f2;border-color:#fecaca}.xb-sum .gold{background:#fffdf5;border-color:#c9a24b}
.xb-live{margin:10px 0 0;font-size:12.5px;color:#475569}.xb-live label{font-weight:800;color:#0f2a4e;cursor:pointer}
.xb-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}.xb-bar h3{margin:0}
.xb-witbox{display:flex;gap:8px;align-items:flex-start}.xb-witbox img{width:56px;height:42px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0}.xb-noimg{display:inline-grid;place-items:center;width:56px;height:42px;border-radius:6px;background:#f1f5f9;color:#94a3b8}.xb-pill.bad{background:#fef2f2;color:#991b1b}
.xb-t{width:100%;border-collapse:collapse;font-size:13px}.xb-t th,.xb-t td{border-bottom:1px solid #e2e8f0;padding:8px 6px;text-align:start;vertical-align:top}.xb-t th{font-size:12px;color:#475569;background:#f8fafc}.xb-t td.low{color:#b91c1c;font-weight:900}.xb-rowacts{display:flex;gap:6px;flex-wrap:wrap}
.xb-pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:900;background:#e2e8f0;color:#334155}.xb-pill.ok{background:#dcfce7;color:#166534}.xb-pill.warn{background:#fef3c7;color:#92400e}.xb-pill.bad{background:#fee2e2;color:#991b1b}.xb-pill.mute{background:#e2e8f0;color:#334155}
.xb-prog{position:relative;display:block;height:16px;min-width:90px;border-radius:8px;background:#e2e8f0;overflow:hidden}.xb-prog i{display:block;height:100%;background:#0b8a83}.xb-prog em{position:absolute;inset:0;font-style:normal;font-size:11px;font-weight:900;color:#0f2a4e;text-align:center;line-height:16px}
.xb-retake{margin:0 0 10px;padding:10px 12px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;font-size:13px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}.xb-svc{border-color:#c9a24b}.xb-ok{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px;margin:8px 0 0;font-size:13px}.xb-sign{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}.xb-sign input{font:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:10px;padding:7px 10px;min-width:260px}.xb-sign small{color:#64748b}.xb-retake code{word-break:break-all}
.xb-heat{list-style:none;margin:0;padding:0;display:grid;gap:6px}.xb-h{display:grid;grid-template-columns:64px minmax(120px,1fr) minmax(120px,2fr) 54px auto;gap:10px;align-items:center;font-size:13px;padding:6px 8px;border-radius:8px;border:1px solid #e2e8f0;background:#fff}.xb-h.weak{background:#fef2f2;border-color:#fecaca}.xb-h.watch{background:#fffbeb;border-color:#fde68a}.xb-h.ok{background:#f0fdf4;border-color:#bbf7d0}.xb-hc{font-family:ui-monospace,monospace;font-weight:900;color:#0b8a83}.xb-hn{font-weight:800;color:#0f2a4e}.xb-hb{display:block;height:10px;border-radius:5px;background:#e2e8f0;overflow:hidden}.xb-hb i{display:block;height:100%;background:#0b8a83}.xb-h.weak .xb-hb i{background:#dc2626}.xb-h.watch .xb-hb i{background:#d97706}.xb-h small{color:#64748b;font-size:11.5px}.xb-lesson{margin:10px 0 0;padding:8px 12px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;font-size:13px}.xb-fair ul{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:4px}.xb-fair li{font-size:13px}.xb-fair small{color:#64748b;margin-inline-start:6px}.xb-fl i{display:inline-block;font-style:normal;font-family:ui-monospace,monospace;font-size:11px;background:#fff;border:1px solid #c7d2fe;border-radius:6px;padding:1px 6px;margin-inline-start:4px}.xb-fair{margin:10px 0 0;padding:8px 12px;border-radius:10px;background:#eef2ff;border:1px solid #c7d2fe;font-size:13px;line-height:1.8}
.xb-hint{color:#334155;font-size:13.5px}.xb-muted{color:#64748b;font-size:13.5px}.xb-foot{margin:12px 0 0;color:#64748b;font-size:12.5px;line-height:1.8}
`;
