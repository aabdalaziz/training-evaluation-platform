'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /admin/miaar[/invites|/bank] — «مِعيار — من أَثَر» للطاقم (م1)
 *  نظرة: آخر النتائج (بطاقة المستوى برمزها) · موافقات الإعادة. (مِعيار — من أَثَر مستقلّ تمامًا: لا استيراد ولا مزامنة مع أي مشروع خارجي — «الفصل» 2026-11-02)
 *  دعوات: جماعية (رمز قصير + QR + ملصق «امسح وحدّد مستواك») وشخصية (رابط برمز خاص لكل بريد) · تتبّع فُتح/بدأ/أنهى · توزيع المستويات
 *  البنك: تغطية مستوى×مهارة×نوع مقابل الخطة + محرّر البنك (م2-أ: البنود والمقاطع والصوت ومراجعة الدفعة)
 *  الذكاء الاصطناعي لا يقرّر هنا شيئًا.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { qrSvg } from '../../../lib/certificates/qr';
import { LEVELS, SKILLS, skillLabel, MIAAR_NAMES_AR, FLOOR_LEVEL, BANK_LEVEL_AR } from '../../../lib/miaar/registry';
import BankEditor from './BankEditor';
import FormBuilder from './FormBuilder';
import Balance from './Balance';
import { Icon } from '../../../lib/ui/icons';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const LANG_OPTS = [['ar', 'العربية'], ['en', 'English'], ['fr', 'Français'], ['tr', 'Türkçe'], ['ur', 'اردو'], ['id', 'Indonesia'], ['ms', 'Melayu'], ['fa', 'فارسی'], ['ru', 'Русский'], ['zh', '中文'], ['es', 'Español'], ['de', 'Deutsch'], ['hi', 'हिन्दी'], ['bn', 'বাংলা'], ['sw', 'Kiswahili'], ['fil', 'Filipino']];
const CONF_AR: Record<string, string> = { high: 'مؤكَّد', medium: 'محتمل', border: 'على الحدّ' };
type Tab = 'overview' | 'invites' | 'bank' | 'forms' | 'balance';

export default function AdminMiaar({ tab }: { tab: Tab }) {
  const router = useRouter(); const db = useMemo(() => supabase(), []);
  const [ready, setReady] = useState(false); const [tok, setTok] = useState(''); const [data, setData] = useState<any>(null); const [error, setError] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState('');
  const [form, setForm] = useState({ kind: 'group', label_ar: '', lang: 'en', exam_mode: 'adaptive', blueprint_id: '', purpose: '', expires_at: '', max_seats: '', note: '', recipients: '' });
  const [bps, setBps] = useState<any[]>([]);  /* م2-ب: المخطّطات النشطة للدعوات */
  const [created, setCreated] = useState<any>(null); const [qrFor, setQrFor] = useState<any>(null); const [balFor, setBalFor] = useState<{ invite: any; data: any } | null>(null); const [retake, setRetake] = useState({ email: '', note: '' });
  const fresh = async () => { const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || tok; if (tk && tk !== tok) setTok(tk); return tk; };
  const H = async (tk?: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tk || await fresh()}` });
  async function load(tk?: string) { const j = await fetch('/api/admin/miaar', { headers: await H(tk), cache: 'no-store' }).then(r => r.json()).catch(() => null); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return null; } setData(j); return j; }
  async function post(body: any) { setBusy(body.action + (body.id || body.table || '')); setError(''); setOk(''); try { const j = await fetch('/api/admin/miaar', { method: 'POST', headers: await H(), body: JSON.stringify(body) }).then(r => r.json()); if (!j?.success) { setError(j?.error || 'تعذّر التنفيذ'); return null; } if (j.note_ar) setOk(j.note_ar); return j; } finally { setBusy(''); } }
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/miaar'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
    const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
    if (tab === 'invites') { const j = await fetch('/api/admin/miaar/forms?list=1', { headers: await H(tk), cache: 'no-store' }).then((r) => r.json()).catch(() => null); setBps(((j?.blueprints || []) as any[]).filter((b) => b.status === 'active')); }
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createInvite(e: React.FormEvent) { e.preventDefault(); const j = await post({ action: 'invite_create', ...form, blueprint_id: form.blueprint_id || undefined, max_seats: form.max_seats ? Number(form.max_seats) : undefined, expires_at: form.expires_at || undefined }); if (j) { setCreated(j); setForm({ ...form, label_ar: '', recipients: '' }); await load(); } }
  const copy = (t: string) => { navigator.clipboard?.writeText(t).then(() => setOk('نُسخ')).catch(() => setError('تعذّر النسخ')); };
  const poster = (inv: any) => {
    const url = inv.url || created?.url; const w = window.open('', '_blank', 'width=720,height=960'); if (!w) return;
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>مِعيار — ${inv.label_ar}</title><style>body{font-family:Tajawal,Arial,sans-serif;text-align:center;padding:40px;color:#0f2a4e}h1{font-size:44px;color:#0f2f46;margin:10px 0}h2{font-size:26px;margin:0 0 20px;color:#0b4a37}p{font-size:18px;line-height:1.8}.u{direction:ltr;font-size:16px;color:#0e5f46;word-break:break-all}.c{font-size:34px;letter-spacing:.2em;font-weight:900;margin:14px 0}svg{width:300px;height:300px}@media print{button{display:none}}</style></head><body><p style="font-size:14px;color:#5b6b64">بوابة أَثَر · ${MIAAR_NAMES_AR.official}</p><h1>مِعيار</h1><h2>${MIAAR_NAMES_AR.poster_line}</h2>${qrSvg(url, 300, 'M', '#0f2a4e')}<div class="c">${inv.code}</div><p class="u">${url}</p><p>${inv.label_ar}${inv.expires_at ? `<br>حتى ${new Date(inv.expires_at).toLocaleDateString('ar-SA')}` : ''}</p><p style="font-size:14px;color:#5b6b64">القواعد والمفردات · القراءة · الاستماع — وفق الإطار الأوروبي المرجعي A1–C2 · لا يحتاج حسابًا</p><button onclick="print()">طباعة</button></body></html>`);
    w.document.close();
  };

  if (!ready) return <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="am-wrap"><div className="am-card">{error ? <span className="am-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  const invites: any[] = data?.invites || []; const latest: any[] = data?.latest || []; const cov = data?.coverage;
  const openInv = invites.filter((i) => i.status === 'open').length;
  return (
    <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="am-wrap">
        <PortalAdminTabs counts={{ '/admin/miaar': openInv }} />
        <header className="mm-hero">
          <div>
            <p className="mm-crumb"><Link href="/">أَثَر</Link> · <span>مِعيار</span> · <Link href="/miaar">صفحة الأداة</Link></p>
            <h1>{tab === 'overview' ? 'التقارير' : tab === 'bank' ? 'بنك الأسئلة' : tab === 'forms' ? 'منشئ النماذج' : tab === 'balance' ? 'ميزان مِعيار' : MIAAR_NAMES_AR.invites}</h1>
            <p className="mm-lead">{tab === 'balance' ? 'المقياس الذي يزن نفسه: تحليل البنود من إجابات حقيقية، شهادة موثوقية لكل مستوى، ومعايرة راش تقترح — وأنت تعتمد. لا اسم ولا بريد في أي رقم.' : tab === 'overview' ? 'تقرير فردي أو جماعي أو مرحلة، أو تقرير عن حالة البنك. النتائج تُكتب في «التسكين» مباشرة، والقرار الأكاديمي بيد إنسان.' : tab === 'forms' ? 'نموذج الاختبار مخطّط: نوعه (تحديد مستوى · شامل · تكيفي · قصير · اجتياز مستوى · خاص) ومستوياته ومصفوفة البنود وطريقة السحب والمدة وحدّ الاجتياز. البنود نفسها تُسحب عشوائيًا في كل جلسة من البنك المعتمد — المسؤول يضبط البنية، لا الأسئلة بعينها إلا إن أراد.' : tab === 'bank' ? 'عمليات البنك: تغطية كل مستوى ومهارة مقابل خطة النموذج، وتحرير البنود والمقاطع واعتماد الدفعات. البند الجديد يبدأ «قيد المراجعة» ولا يصل إلى المتقدّم إلا بعد اعتماد بشري.' : 'دعوة جماعية برمز وQR وملصق، أو شخصية برابط لكل بريد — مع تتبّع مَن فتح ومَن بدأ ومَن أنهى ومستواه.'}</p>
          </div>
          <div className="mm-heroacts">
            <Link href="/admin/placements" className="mm-hbtn gold"><Icon name="download" />تصدير النتائج CSV</Link>
            <Link href="/admin/miaar/bank" className="mm-hbtn"><Icon name="search" />تقرير البنك</Link>
            <Link href="/admin/miaar/forms" className="mm-hbtn"><Icon name="table" />منشئ النماذج</Link>
            <Link href="/admin/miaar/invites" className="mm-hbtn"><Icon name="qr" />{MIAAR_NAMES_AR.invites}</Link>
            <Link href="/miaar" className="mm-hbtn"><Icon name="play" />صفحة الاختبار</Link>
          </div>
        </header>
        <nav className="mm-tabs" aria-label="أقسام مِعيار">{([['overview', '01', 'التقارير', '/admin/miaar'], ['bank', '02', 'بنك الأسئلة', '/admin/miaar/bank'], ['forms', '03', 'منشئ النماذج', '/admin/miaar/forms'], ['invites', '04', MIAAR_NAMES_AR.invites, '/admin/miaar/invites'], ['balance', '05', 'الميزان', '/admin/miaar/balance']] as const).map(([k, n, l, h]) => <Link key={k} href={h} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined}><i>{n}</i><span>{l}</span></Link>)}</nav>
        {error && <div className="am-err" role="alert">{error}</div>}{ok && <div className="am-ok" role="status">{ok}</div>}
        <div className="mm-cards">
          <div className="mm-card navy"><span>نتائج الاختبارات</span><b>{latest.length}</b><small>آخر التقارير في السجل</small></div>
          <div className="mm-card teal"><span>جلسات مِعيار</span><b>{data?.sessions ?? 0}</b><small>كل الجلسات المسجّلة</small></div>
          <div className="mm-card gold"><span>دعوات مفتوحة</span><b>{openInv}</b><small>رمز أو رابط شخصي ما زال يعمل</small></div>
          <div className="mm-card sand"><span>بنود معتمدة</span><b>{cov?.total_approved ?? 0}</b><small>{cov?.passages ?? 0} نصًّا معتمدًا · تدخل السحب</small></div>
        </div>

        {tab === 'overview' && <>
          <section className="am-card"><h3>آخر النتائج <small>بطاقة المستوى لكل متقدّم — الرمز يفتحها ويتحقّق منها</small></h3>
            {!latest.length ? <div className="am-empty">لا نتائج بعد. أول متقدّم يفتح <Link href="/miaar">/miaar</Link> ويظهر هنا.</div> : <table className="mm-t"><thead><tr><th>المتقدّم</th><th>المستوى</th><th>الالتحاق</th><th>الثقة</th><th>الرمز</th><th>التاريخ</th></tr></thead><tbody>
              {latest.map((r) => <tr key={r.id}><td>{r.name}<br /><small dir="ltr">{r.email}</small></td><td><b>{r.demonstrated || '—'}</b></td><td>{r.entry || '—'}</td><td className={`mm-c ${r.confidence || ''}`}>{CONF_AR[r.confidence] || '—'}</td><td>{r.code ? <a href={`/miaar/result/${r.code}`} target="_blank" rel="noreferrer" dir="ltr">{r.code}</a> : <small>قديم</small>}</td><td><small>{new Date(r.taken_at).toLocaleString('ar-SA')}</small></td></tr>)}
            </tbody></table>}
            <p className="mm-note">النتائج كلها تُسجَّل أيضًا في «التسكين» (<Link href="/admin/placements">/admin/placements</Link>) وفي سجل التعلّم لصاحب الحساب إن وُجد.</p>
          </section>
          <section className="am-card"><h3>موافقة إعادة الاختبار <small>مرة واحدة لكل موافقة — تُستهلك مع بداية المحاولة</small></h3>
            <form className="mm-row" onSubmit={async (e) => { e.preventDefault(); const j = await post({ action: 'retake_approve', ...retake }); if (j) setRetake({ email: '', note: '' }); }}>
              <input dir="ltr" type="email" required placeholder="email@example.com" value={retake.email} onChange={(e) => setRetake({ ...retake, email: e.target.value })} aria-label="بريد المتقدّم" />
              <input placeholder="سبب الموافقة (اختياري)" value={retake.note} onChange={(e) => setRetake({ ...retake, note: e.target.value })} aria-label="السبب" />
              <button className="am-btn" disabled={!!busy}>أذِن بالإعادة</button>
            </form>
          </section>
        </>}

        {tab === 'invites' && <>
          <section className="am-card"><h3>دعوة جديدة <small>جماعية: رمز واحد وQR وملصق · شخصية: رابط خاص لكل بريد (يُعرض مرة واحدة)</small></h3>
            <form className="mm-form" onSubmit={createInvite}>
              <label>النوع<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="group">جماعية (رمز + QR)</option><option value="personal">شخصية (رابط لكل بريد)</option></select></label>
              <label>اسم الدعوة<input required minLength={3} maxLength={120} placeholder="جامعة أَثَر — دفعة يناير 2027" value={form.label_ar} onChange={(e) => setForm({ ...form, label_ar: e.target.value })} data-testid="mm-label" /></label>
              <label>لغة الواجهة الافتراضية<select value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })}>{LANG_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label>نمط الاختبار<select value={form.exam_mode} onChange={(e) => setForm({ ...form, exam_mode: e.target.value })}><option value="adaptive">تكيّفي (يبدأ من مِسبار ويتوقّف حين يتّضح المستوى)</option><option value="comprehensive">شامل (كل المستويات من A1)</option></select></label>
              <label>نموذج الاختبار (م2-ب)<select value={form.blueprint_id} onChange={(e) => setForm({ ...form, blueprint_id: e.target.value })} data-testid="mm-blueprint"><option value="">الافتراضي حسب النمط أعلاه</option>{bps.map((b) => <option key={b.id} value={b.id}>{b.name_ar} — {b.plan_total} بندًا · {b.duration_minutes} د ({b.code})</option>)}</select></label>
              <label>الغرض<input maxLength={60} placeholder="تسكين · قبول · تشخيص" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></label>
              <label>ينتهي في<input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></label>
              <label>حدّ المقاعد<input type="number" min={1} max={5000} placeholder="بلا حدّ" value={form.max_seats} onChange={(e) => setForm({ ...form, max_seats: e.target.value })} /></label>
              <label>ملاحظة داخلية<input maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
              {form.kind === 'personal' && <label className="mm-full">المستلمون — سطر لكل شخص: الاسم ثم البريد<textarea rows={5} dir="auto" placeholder={'سارة أحمد sara@example.com\nJohn Smith john@example.com'} value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} /></label>}
              <div className="mm-full"><button className="am-btn" disabled={!!busy} data-testid="mm-create">{busy === 'invite_create' ? 'جارٍ الإنشاء…' : 'أنشئ الدعوة'}</button></div>
            </form>
            {created && <div className="mm-created" data-testid="mm-created">
              <div className="mm-qr" dangerouslySetInnerHTML={{ __html: qrSvg(created.url, 140, 'M', '#0f2a4e') }} />
              <div><b>{created.invite.label_ar}</b> · الرمز <code dir="ltr">{created.invite.code}</code><br /><a href={created.url} target="_blank" rel="noreferrer" dir="ltr">{created.url}</a>
                <div className="mm-row"><button type="button" className="am-btn ghost" onClick={() => copy(created.url)}>نسخ الرابط</button><button type="button" className="am-btn ghost" onClick={() => copy(created.share_text)}>نسخ نص الرسالة</button><button type="button" className="am-btn ghost" onClick={() => poster({ ...created.invite, url: created.url })}>ملصق QR للطباعة</button></div>
                {!!created.links?.length && <details open><summary>{created.links.length} رابطًا شخصيًّا — انسخها الآن</summary><button type="button" className="am-btn ghost" onClick={() => copy(created.links.map((l: any) => `${l.name || ''} <${l.email}>: ${l.url}`).join('\n'))}>نسخ الكل</button><ul className="mm-links">{created.links.map((l: any) => <li key={l.email}><span>{l.name || '—'} <small dir="ltr">{l.email}</small></span><code dir="ltr">{l.url}</code></li>)}</ul></details>}
              </div></div>}
          </section>
          <section className="am-card"><h3>الدعوات <small>فُتح / بدأ / أنهى — وتوزيع مستويات الالتحاق</small></h3>
            {!invites.length ? <div className="am-empty">لا دعوات بعد.</div> : <table className="mm-t"><thead><tr><th>الدعوة</th><th>الرمز</th><th>النمط</th><th>بدأ</th><th>أنهى</th><th>المستويات</th><th>الحالة</th><th></th></tr></thead><tbody>
              {invites.map((i) => <tr key={i.id} data-testid="mm-invite-row"><td><b>{i.label_ar}</b><br /><small>{i.kind === 'personal' ? `شخصية · ${i.recipients?.length || 0} مستلمًا · فتح ${i.opened || 0}` : 'جماعية'}{i.expires_at ? ` · حتى ${new Date(i.expires_at).toLocaleDateString('ar-SA')}` : ''}{i.max_seats ? ` · ${i.max_seats} مقعدًا` : ''}</small></td><td><code dir="ltr">{i.code}</code></td><td>{i.exam_mode === 'adaptive' ? 'تكيّفي' : 'شامل'}</td><td>{i.started}</td><td>{i.finished}</td><td>{Object.entries(i.levels || {}).map(([k, v]) => `${k}:${v}`).join(' · ') || '—'}</td><td>{i.status === 'open' ? <span className="mm-open">مفتوحة</span> : <span className="mm-closed">مغلقة</span>}</td>
                <td className="mm-acts"><button type="button" className="am-btn ghost" onClick={() => setQrFor(qrFor?.id === i.id ? null : i)}>QR</button><button type="button" className="am-btn ghost" onClick={() => copy(i.url)}>نسخ</button><button type="button" className="am-btn ghost" onClick={() => poster(i)}>ملصق</button><button type="button" className="am-btn ghost" data-testid={`mm-bal-${i.code}`} onClick={async () => { if (balFor?.invite?.id === i.id) { setBalFor(null); return; } const r = await fetch(`/api/admin/miaar/balance?invite=${encodeURIComponent(i.id)}`, { headers: await H(), cache: 'no-store' }).then((x) => x.json()).catch(() => null); setBalFor({ invite: i, data: r }); }}>الميزان</button><button type="button" className="am-btn ghost" disabled={!!busy} onClick={async () => { await post({ action: 'invite_status', id: i.id, status: i.status === 'open' ? 'closed' : 'open' }); await load(); }}>{i.status === 'open' ? 'أغلق' : 'افتح'}</button></td></tr>)}
            </tbody></table>}
            {qrFor && <div className="mm-created"><div className="mm-qr" dangerouslySetInnerHTML={{ __html: qrSvg(qrFor.url, 160, 'M', '#0f2a4e') }} /><div><b>{qrFor.label_ar}</b><br /><a href={qrFor.url} dir="ltr" target="_blank" rel="noreferrer">{qrFor.url}</a>{qrFor.recipients?.length ? <ul className="mm-links">{qrFor.recipients.map((r: any) => <li key={r.email}><span>{r.name || '—'} <small dir="ltr">{r.email}</small></span><small>{r.finished ? 'أنهى' : r.started ? 'بدأ' : r.opened ? 'فتح' : 'لم يفتح'}</small></li>)}</ul> : null}</div></div>}
            {balFor && <div className="mm-created" data-testid="mm-invite-balance"><div style={{ flex: 1 }}><b>الميزان في الدعوة — {balFor.invite.label_ar}</b>
              {!balFor.data?.report?.ok ? <p className="mm-note">{balFor.data?.report?.reason || balFor.data?.error || 'تعذّر الحساب'}{typeof balFor.data?.report?.sessions === 'number' ? ` (${balFor.data.report.sessions} حتى الآن)` : ''}</p> : (() => { const d = balFor.data.report; return <>
                <p className="mm-note">{d.sessions} جلسة منتهية · {d.responses} إجابة · متوسط الصواب {d.overall_p ?? '—'}% · الزمن الوسيط {d.median_minutes ?? '—'} دقيقة</p>
                <p className="mm-note">توزيع المستويات المثبتة: {Object.entries(d.distribution || {}).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}</p>
                {!!d.confusing?.length && <><small>أكثر البنود إرباكًا لهذه المجموعة (قد يكشف ثغرة تدريس لا ثغرة بند):</small><ul className="mm-links">{d.confusing.map((c: any) => <li key={c.item}><span><code dir="ltr">{c.item}</code> {c.level} · صواب {Math.round(c.p * 100)}% من {c.n}</span><small>{c.text}</small></li>)}</ul></>}
              </>; })()}
            </div><button type="button" className="am-btn ghost" onClick={() => setBalFor(null)}>إغلاق</button></div>}
            <p className="mm-note">البريد وواتساب مؤجَّلان بقرار المالك (ج) — انسخ الرابط أو نص الرسالة أو اطبع الملصق وأرسلها بقناتك.</p>
          </section>
        </>}

        {tab === 'bank' && <section className="am-card"><h3>تغطية البنك مقابل الخطة <small>معتمد / مطلوب لكل خلية — الخلية الحمراء لا تكفي لتوليد نموذج</small></h3>
          {!cov ? <div className="am-empty">تعذّر قراءة البنك — نفّذ ملف SQL أولًا.</div> : <>
            <table className="mm-t mm-cov"><thead><tr><th>المستوى</th>{SKILLS.map((s) => <th key={s}>{skillLabel(s)}</th>)}</tr></thead><tbody>
              {[FLOOR_LEVEL, ...LEVELS].map((lv) => <tr key={lv}><td><b>{BANK_LEVEL_AR[lv as keyof typeof BANK_LEVEL_AR] || lv}</b></td>{SKILLS.map((s) => { const c = cov.cells.find((x: any) => x.level === lv && x.skill === s); const okc = c && c.approved >= c.needed; return <td key={s} className={okc ? 'ok' : 'low'}><b>{c?.approved ?? 0}</b> / {c?.needed ?? 0}{c?.in_review ? <small> · {c.in_review} للمراجعة</small> : null}<br /><small>{Object.entries(c?.by_type || {}).map(([k, v]) => `${k}:${v}`).join(' ') || '—'}</small></td>; })}</tr>)}
            </tbody></table>
            <div className="am-kpis"><span><b>{cov.total_approved}</b> معتمد من {cov.total_all}</span>{Object.entries(cov.by_status || {}).map(([k, v]) => <span key={k}><b>{v as number}</b> {k}</span>)}<span><b>{cov.descriptors_used}</b> واصفًا مستخدمًا</span></div>
            <p className="mm-note">«ما قبل A1» أرضية مصوّرة تُقدَّم في التكيفي لمن لم يجتز A1. الاختبار يسحب من «معتمد» فقط؛ البنود «للمراجعة» تنتظر قرارك في المحرّر أدناه.</p>
          </>}
        </section>}
        {tab === 'bank' && <BankEditor auth={() => H()} byBatch={cov?.by_batch || {}} onChanged={() => { void load(); }} />}
        {tab === 'forms' && <FormBuilder auth={() => H()} />}
        {tab === 'balance' && <Balance auth={() => H()} />}
        <p className="mm-foot">© 2026 {MIAAR_NAMES_AR.product} — {MIAAR_NAMES_AR.nature}، والقرار الأكاديمي بيد إنسان.</p>
      </div>
    </div>
  );
}
const CSS = `
.am{--navy:#0f2a4e;--teal:#0b8a83;--teal-deep:#0f5c57;--gold:#c9a24b;--gold-line:#ead9a6;--gold-soft:#fbf5e4;--line:#e8eef3;min-height:100vh;background:linear-gradient(180deg,#f6f8fb 0%,#eef5f4 100%);padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;direction:rtl;color:#0f172a}
.am :is(button,a,input,select,textarea):focus-visible{outline:3px solid var(--navy);outline-offset:2px}
.am-wrap{max-width:1160px;margin:0 auto;display:grid;gap:14px}
.mm-hero{display:flex;flex-wrap:wrap;justify-content:space-between;gap:18px;border-radius:24px;padding:28px 30px;color:#fff;background:linear-gradient(135deg,#0f2a4e 0%,#143a66 55%,#0b6b66 100%);box-shadow:0 10px 30px rgba(15,42,78,.12)}
.mm-crumb{margin:0;font-size:12px;font-weight:900;letter-spacing:.14em;color:#d7e2ee}.mm-crumb a{color:#fff;text-decoration:underline;text-decoration-color:var(--gold);text-underline-offset:4px}.mm-crumb span{color:var(--gold)}
.mm-hero h1{margin:8px 0 0;font-size:34px;font-weight:900;color:#fff}.mm-lead{margin:10px 0 0;max-width:640px;line-height:1.8;color:#d5e0ea;font-size:15px}
.mm-heroacts{display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start;justify-content:flex-end}
.mm-hbtn{display:inline-flex;align-items:center;gap:8px;min-height:44px;border:1px solid rgba(255,255,255,.25);background:#fff;color:var(--navy);border-radius:12px;padding:8px 16px;font-size:13.5px;font-weight:800;text-decoration:none;cursor:pointer}.mm-hbtn:hover{background:#f1f5f9;filter:none}.mm-hbtn:active{background:#e2e8f0}.mm-hbtn>svg:first-child{width:20px;height:20px;flex:none;border-radius:50%;padding:3px;background:var(--navy);color:#fff;box-sizing:border-box}.mm-hbtn.gold:hover{background:var(--gold-600,#bb9340)}.mm-hbtn.gold:active{background:var(--gold-700,#b58c33)}.mm-hbtn.gold{background:var(--gold);border-color:var(--gold);color:#1f2937}.mm-hbtn.gold:hover{background:#b8923f}
.mm-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.mm-tabs a{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:56px;border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 22px;font-size:15px;font-weight:900;color:var(--navy);text-decoration:none;box-shadow:0 4px 14px rgba(15,42,78,.04)}
.mm-tabs a i{font-style:normal;font-size:11px;font-weight:900;color:var(--teal);letter-spacing:.14em}.mm-tabs a.on{background:var(--navy);border-color:var(--navy);color:#fff}.mm-tabs a.on i{color:#d7e2ee}
.mm-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.mm-card{background:#fff;border:1px solid var(--line);border-top:3px solid var(--navy);border-radius:18px;padding:16px 18px;box-shadow:0 6px 18px rgba(15,42,78,.05)}.mm-card span{display:block;font-size:12.5px;font-weight:800;color:#475569}.mm-card b{display:block;margin-top:6px;font-size:34px;line-height:1.1;color:var(--navy)}.mm-card small{display:block;margin-top:6px;font-size:11.5px;color:#64748b}
.mm-card.teal{border-top-color:var(--teal)}.mm-card.gold{border-top-color:var(--gold);background:var(--gold-soft)}.mm-card.sand{border-top-color:#a8a29e}
.am-card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px 20px;overflow-x:auto;box-shadow:0 6px 18px rgba(15,42,78,.04)}.am-card h3{margin:0 0 12px;color:var(--navy);font-size:17px;font-weight:900}.am-card h3 small{font-size:12px;color:#5c675f;font-weight:600;display:block;margin-top:2px;line-height:1.7}
.am-empty{color:#475569;font-size:14px;text-align:center;padding:20px;line-height:1.8}.am-err{color:#991b1b;font-size:13px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;font-weight:700}.am-ok{color:var(--teal-deep);font-size:13px;background:#e6f4f3;border:1px solid #cfe9e6;border-radius:12px;padding:10px 14px;font-weight:700}
.am-kpis{display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:13px;color:#475569;margin-top:10px}.am-kpis b{font-size:20px;color:var(--navy);margin-inline-end:4px}.am-kpis .g b{color:var(--teal)}
.am-btn{border:1px solid var(--navy);background:var(--navy);color:#fff;border-radius:12px;padding:7px 14px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;min-height:44px}.am-btn.ghost{background:#fff;color:var(--navy);border-color:var(--line)}.am-btn.ghost:hover{border-color:var(--gold)}.am-btn:disabled{opacity:.5;cursor:default}
.mm-t{width:100%;border-collapse:collapse;font-size:13px}.mm-t th{text-align:start;color:#64748b;font-weight:800;border-bottom:1px solid var(--line);padding:8px;font-size:12px;background:#f8fafc}.mm-t th:first-child{border-start-end-radius:10px}.mm-t th:last-child{border-start-start-radius:10px}.mm-t td{border-bottom:1px solid #f1f5f9;padding:10px 8px;vertical-align:top}.mm-t small{color:#64748b;font-size:11.5px}.mm-t code{font-size:12px;background:#f1f5f9;border-radius:6px;padding:2px 6px}
.mm-cov td.ok{background:#e6f4f3}.mm-cov td.low{background:#fdf4f1}
.mm-c.high{color:var(--teal-deep);font-weight:800}.mm-c.medium{color:#8a6a14;font-weight:800}.mm-c.border{color:#991b1b;font-weight:800}
.mm-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}.mm-row input{font:inherit;border:1px solid var(--line);border-radius:12px;padding:8px 12px;min-height:44px;min-width:200px;background:#fff}.mm-row input:focus{border-color:var(--gold);outline:none}
.mm-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.mm-form label{display:grid;gap:4px;font-size:12.5px;font-weight:800;color:#334155}.mm-form input,.mm-form select,.mm-form textarea{font:inherit;border:1px solid var(--line);border-radius:12px;padding:8px 12px;min-height:44px;background:#fff}.mm-form input:focus,.mm-form select:focus,.mm-form textarea:focus{border-color:var(--gold);outline:none}.mm-full{grid-column:1/-1}
.mm-created{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:14px;padding:14px;margin-top:12px;font-size:13px;line-height:1.8}.mm-created a{color:var(--teal-deep);word-break:break-all}.mm-qr svg{display:block;background:#fff;border-radius:10px;padding:4px}
.mm-links{list-style:none;padding:0;margin:6px 0;display:grid;gap:4px;font-size:12px}.mm-links li{display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap;border-bottom:1px dashed var(--line);padding:3px 0}.mm-links code{font-size:11px;word-break:break-all}
.mm-open{color:var(--teal-deep);font-weight:800}.mm-closed{color:#64748b;font-weight:800}.mm-acts{display:flex;gap:4px;flex-wrap:wrap}.mm-acts .am-btn{padding:4px 10px;font-size:12px;min-height:36px}
.mm-note{font-size:12.5px;color:#475569;line-height:1.7;margin:8px 0 0}.mm-note code{background:#f1f5f9;border-radius:6px;padding:1px 5px}.mm-log{background:var(--navy);color:#e2e8f0;border-radius:12px;padding:12px;font-size:12px;line-height:1.7;white-space:pre-wrap;direction:rtl;text-align:right}
.mm-foot{color:#475569;font-size:12.5px;line-height:1.7;margin:4px 0 0;text-align:center}
@media(max-width:760px){.mm-tabs{grid-template-columns:1fr}.mm-hero{padding:22px}.mm-hero h1{font-size:26px}}
`;
