'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /admin/miaar[/invites|/bank] — «مِعيار — من أَثَر» للطاقم (م1)
 *  نظرة: آخر النتائج (بطاقة المستوى برمزها) · موافقات الإعادة · «نقل البيت» (استيراد بيانات مِعيار القديم جدولًا جدولًا مع العدّادات)
 *  دعوات: جماعية (رمز قصير + QR + ملصق «امسح وحدّد مستواك») وشخصية (رابط برمز خاص لكل بريد) · تتبّع فُتح/بدأ/أنهى · توزيع المستويات
 *  البنك: تغطية مستوى×مهارة×نوع مقابل الخطة (م1 قراءة فقط؛ محرّر البنك في م2)
 *  الذكاء الاصطناعي لا يقرّر هنا شيئًا.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { qrSvg } from '../../../lib/certificates/qr';
import { LEVELS, SKILLS, skillLabel, MIAAR_NAMES_AR } from '../../../lib/miaar/registry';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const LANG_OPTS = [['ar', 'العربية'], ['en', 'English'], ['fr', 'Français'], ['tr', 'Türkçe'], ['ur', 'اردو'], ['id', 'Indonesia'], ['ms', 'Melayu'], ['fa', 'فارسی'], ['ru', 'Русский'], ['zh', '中文'], ['es', 'Español'], ['de', 'Deutsch'], ['hi', 'हिन्दी'], ['bn', 'বাংলা'], ['sw', 'Kiswahili'], ['fil', 'Filipino']];
const CONF_AR: Record<string, string> = { high: 'مؤكَّد', medium: 'محتمل', border: 'على الحدّ' };
type Tab = 'overview' | 'invites' | 'bank';

export default function AdminMiaar({ tab }: { tab: Tab }) {
  const router = useRouter(); const db = useMemo(() => supabase(), []);
  const [ready, setReady] = useState(false); const [tok, setTok] = useState(''); const [data, setData] = useState<any>(null); const [error, setError] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState('');
  const [form, setForm] = useState({ kind: 'group', label_ar: '', lang: 'en', exam_mode: 'adaptive', purpose: '', expires_at: '', max_seats: '', note: '', recipients: '' });
  const [created, setCreated] = useState<any>(null); const [qrFor, setQrFor] = useState<any>(null); const [retake, setRetake] = useState({ email: '', note: '' }); const [log, setLog] = useState<string[]>([]);
  const fresh = async () => { const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || tok; if (tk && tk !== tok) setTok(tk); return tk; };
  const H = async (tk?: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tk || await fresh()}` });
  async function load(tk?: string, legacy = false) { const j = await fetch(`/api/admin/miaar${legacy ? '?legacy=1' : ''}`, { headers: await H(tk), cache: 'no-store' }).then(r => r.json()).catch(() => null); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return null; } setData(j); return j; }
  async function post(body: any) { setBusy(body.action + (body.id || body.table || '')); setError(''); setOk(''); try { const j = await fetch('/api/admin/miaar', { method: 'POST', headers: await H(), body: JSON.stringify(body) }).then(r => r.json()); if (!j?.success) { setError(j?.error || 'تعذّر التنفيذ'); return null; } if (j.note_ar) setOk(j.note_ar); return j; } finally { setBusy(''); } }
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/miaar'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
    const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createInvite(e: React.FormEvent) { e.preventDefault(); const j = await post({ action: 'invite_create', ...form, max_seats: form.max_seats ? Number(form.max_seats) : undefined, expires_at: form.expires_at || undefined }); if (j) { setCreated(j); setForm({ ...form, label_ar: '', recipients: '' }); await load(); } }
  async function importAll() {
    const order: string[] = data?.legacy?.order || []; setLog([]); let total = 0;
    for (const table of order) {
      let offset = 0; for (let guard = 0; guard < 200; guard += 1) {
        const j = await post({ action: 'import', table, offset }); if (!j) { setLog((l) => [...l, `✗ ${table}: توقّف`]); return; }
        total += j.imported; setLog((l) => [...l, `${j.label_ar}: جُلب ${j.fetched} · أُدرج ${j.imported} · تُخطّي ${j.skipped}${j.errors?.length ? ` · أخطاء ${j.errors.length}: ${j.errors[0]}` : ''}`]);
        if (j.done) break; offset = j.next_offset;
      }
    }
    setOk(`اكتمل النقل — ${total} صفًّا جديدًا.`); await load(undefined, true);
  }
  const copy = (t: string) => { navigator.clipboard?.writeText(t).then(() => setOk('نُسخ')).catch(() => setError('تعذّر النسخ')); };
  const poster = (inv: any) => {
    const url = inv.url || created?.url; const w = window.open('', '_blank', 'width=720,height=960'); if (!w) return;
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>مِعيار — ${inv.label_ar}</title><style>body{font-family:Tajawal,Arial,sans-serif;text-align:center;padding:40px;color:#10231d}h1{font-size:44px;color:#0e5f46;margin:10px 0}h2{font-size:26px;margin:0 0 20px;color:#0b4a37}p{font-size:18px;line-height:1.8}.u{direction:ltr;font-size:16px;color:#0e5f46;word-break:break-all}.c{font-size:34px;letter-spacing:.2em;font-weight:900;margin:14px 0}svg{width:300px;height:300px}@media print{button{display:none}}</style></head><body><p style="font-size:14px;color:#5b6b64">بوابة أَثَر · ${MIAAR_NAMES_AR.official}</p><h1>مِعيار</h1><h2>${MIAAR_NAMES_AR.poster_line}</h2>${qrSvg(url, 300, 'M', '#0e5f46')}<div class="c">${inv.code}</div><p class="u">${url}</p><p>${inv.label_ar}${inv.expires_at ? `<br>حتى ${new Date(inv.expires_at).toLocaleDateString('ar-SA')}` : ''}</p><p style="font-size:14px;color:#5b6b64">القواعد والمفردات · القراءة · الاستماع — وفق الإطار الأوروبي المرجعي A1–C2 · لا يحتاج حسابًا</p><button onclick="print()">طباعة</button></body></html>`);
    w.document.close();
  };

  if (!ready) return <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="am-wrap"><div className="am-card">{error ? <span className="am-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  const invites: any[] = data?.invites || []; const latest: any[] = data?.latest || []; const cov = data?.coverage; const legacy = data?.legacy; const local = data?.local || {};
  const openInv = invites.filter((i) => i.status === 'open').length;
  return (
    <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="am-wrap">
        <header className="am-head"><div><span className="am-kicker"><Icon name="compass" size={14} /> بوابة أَثَر · {MIAAR_NAMES_AR.phase}</span><h1>{MIAAR_NAMES_AR.product} — {MIAAR_NAMES_AR.official}</h1><p>الاختبار يعيش الآن داخل أَثَر على <Link href="/miaar">/miaar</Link>. هنا: نتائج المتقدّمين وبطاقاتهم، والدعوات برموزها وباركوداتها، وتغطية بنك الأسئلة مقابل الخطة. القرار الأكاديمي (الإعادة، التسكين على الحدّ) بيد إنسان.</p></div></header>
        <PortalAdminTabs counts={{ '/admin/miaar': openInv }} />
        <nav className="mm-tabs" aria-label="أقسام مِعيار">{([['overview', 'النتائج والنقل', '/admin/miaar'], ['invites', MIAAR_NAMES_AR.invites, '/admin/miaar/invites'], ['bank', 'بنك الأسئلة', '/admin/miaar/bank']] as const).map(([k, l, h]) => <Link key={k} href={h} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined}>{l}</Link>)}</nav>
        {error && <div className="am-err" role="alert">{error}</div>}{ok && <div className="am-ok" role="status">{ok}</div>}
        <div className="am-kpis"><span><b>{data?.sessions ?? 0}</b> جلسة</span><span><b>{latest.length}</b> آخر التقارير</span><span className="g"><b>{openInv}</b> دعوة مفتوحة</span><span><b>{cov?.total_approved ?? 0}</b> بند معتمد</span><span><b>{cov?.passages ?? 0}</b> نصًّا معتمدًا</span></div>

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
          <section className="am-card"><h3>نقل البيت — بيانات مِعيار القديم <small>استيراد آمن قابل للتكرار (ما نُقل لا يُكرَّر) · ترتيب الجداول يحترم المفاتيح</small></h3>
            {!legacy?.configured ? <p className="mm-note">متغيّرا <code>MIAAR_SUPABASE_URL</code> و<code>MIAAR_SERVICE_ROLE_KEY</code> غير مضبوطين على هذا الخادم — النقل يعمل فقط على الإنتاج حيث هما موجودان منذ P7.</p> : <>
              <div className="mm-row"><button className="am-btn ghost" type="button" disabled={!!busy} onClick={() => load(undefined, true)}>اجلب أعداد القديم</button><button className="am-btn" type="button" disabled={!!busy} onClick={importAll} data-testid="mm-import-all">{busy.startsWith('import') ? 'جارٍ النقل…' : 'انقل الكل الآن'}</button></div>
              <table className="mm-t"><thead><tr><th>الجدول</th><th>في القديم</th><th>في أَثَر</th></tr></thead><tbody>
                {(legacy.order as string[]).map((t) => <tr key={t}><td>{legacy.labels?.[t] || t}<br /><small dir="ltr">{t}</small></td><td>{legacy.counts ? (legacy.counts[t] ?? '—') : '…'}</td><td>{t === 'audio' ? '—' : local[t] ?? 0}</td></tr>)}
              </tbody></table>
              {!!log.length && <pre className="mm-log">{log.join('\n')}</pre>}
            </>}
          </section>
        </>}

        {tab === 'invites' && <>
          <section className="am-card"><h3>دعوة جديدة <small>جماعية: رمز واحد وQR وملصق · شخصية: رابط خاص لكل بريد (يُعرض مرة واحدة)</small></h3>
            <form className="mm-form" onSubmit={createInvite}>
              <label>النوع<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="group">جماعية (رمز + QR)</option><option value="personal">شخصية (رابط لكل بريد)</option></select></label>
              <label>اسم الدعوة<input required minLength={3} maxLength={120} placeholder="جامعة أَثَر — دفعة يناير 2027" value={form.label_ar} onChange={(e) => setForm({ ...form, label_ar: e.target.value })} data-testid="mm-label" /></label>
              <label>لغة الواجهة الافتراضية<select value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })}>{LANG_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label>نمط الاختبار<select value={form.exam_mode} onChange={(e) => setForm({ ...form, exam_mode: e.target.value })}><option value="adaptive">تكيّفي (يبدأ من مِسبار ويتوقّف حين يتّضح المستوى)</option><option value="comprehensive">شامل (كل المستويات من A1)</option></select></label>
              <label>الغرض<input maxLength={60} placeholder="تسكين · قبول · تشخيص" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></label>
              <label>ينتهي في<input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></label>
              <label>حدّ المقاعد<input type="number" min={1} max={5000} placeholder="بلا حدّ" value={form.max_seats} onChange={(e) => setForm({ ...form, max_seats: e.target.value })} /></label>
              <label>ملاحظة داخلية<input maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
              {form.kind === 'personal' && <label className="mm-full">المستلمون — سطر لكل شخص: الاسم ثم البريد<textarea rows={5} dir="auto" placeholder={'سارة أحمد sara@example.com\nJohn Smith john@example.com'} value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} /></label>}
              <div className="mm-full"><button className="am-btn" disabled={!!busy} data-testid="mm-create">{busy === 'invite_create' ? 'جارٍ الإنشاء…' : 'أنشئ الدعوة'}</button></div>
            </form>
            {created && <div className="mm-created" data-testid="mm-created">
              <div className="mm-qr" dangerouslySetInnerHTML={{ __html: qrSvg(created.url, 140, 'M', '#0e5f46') }} />
              <div><b>{created.invite.label_ar}</b> · الرمز <code dir="ltr">{created.invite.code}</code><br /><a href={created.url} target="_blank" rel="noreferrer" dir="ltr">{created.url}</a>
                <div className="mm-row"><button type="button" className="am-btn ghost" onClick={() => copy(created.url)}>نسخ الرابط</button><button type="button" className="am-btn ghost" onClick={() => copy(created.share_text)}>نسخ نص الرسالة</button><button type="button" className="am-btn ghost" onClick={() => poster({ ...created.invite, url: created.url })}>ملصق QR للطباعة</button></div>
                {!!created.links?.length && <details open><summary>{created.links.length} رابطًا شخصيًّا — انسخها الآن</summary><button type="button" className="am-btn ghost" onClick={() => copy(created.links.map((l: any) => `${l.name || ''} <${l.email}>: ${l.url}`).join('\n'))}>نسخ الكل</button><ul className="mm-links">{created.links.map((l: any) => <li key={l.email}><span>{l.name || '—'} <small dir="ltr">{l.email}</small></span><code dir="ltr">{l.url}</code></li>)}</ul></details>}
              </div></div>}
          </section>
          <section className="am-card"><h3>الدعوات <small>فُتح / بدأ / أنهى — وتوزيع مستويات الالتحاق</small></h3>
            {!invites.length ? <div className="am-empty">لا دعوات بعد.</div> : <table className="mm-t"><thead><tr><th>الدعوة</th><th>الرمز</th><th>النمط</th><th>بدأ</th><th>أنهى</th><th>المستويات</th><th>الحالة</th><th></th></tr></thead><tbody>
              {invites.map((i) => <tr key={i.id} data-testid="mm-invite-row"><td><b>{i.label_ar}</b><br /><small>{i.kind === 'personal' ? `شخصية · ${i.recipients?.length || 0} مستلمًا · فتح ${i.opened || 0}` : 'جماعية'}{i.expires_at ? ` · حتى ${new Date(i.expires_at).toLocaleDateString('ar-SA')}` : ''}{i.max_seats ? ` · ${i.max_seats} مقعدًا` : ''}</small></td><td><code dir="ltr">{i.code}</code></td><td>{i.exam_mode === 'adaptive' ? 'تكيّفي' : 'شامل'}</td><td>{i.started}</td><td>{i.finished}</td><td>{Object.entries(i.levels || {}).map(([k, v]) => `${k}:${v}`).join(' · ') || '—'}</td><td>{i.status === 'open' ? <span className="mm-open">مفتوحة</span> : <span className="mm-closed">مغلقة</span>}</td>
                <td className="mm-acts"><button type="button" className="am-btn ghost" onClick={() => setQrFor(qrFor?.id === i.id ? null : i)}>QR</button><button type="button" className="am-btn ghost" onClick={() => copy(i.url)}>نسخ</button><button type="button" className="am-btn ghost" onClick={() => poster(i)}>ملصق</button><button type="button" className="am-btn ghost" disabled={!!busy} onClick={async () => { await post({ action: 'invite_status', id: i.id, status: i.status === 'open' ? 'closed' : 'open' }); await load(); }}>{i.status === 'open' ? 'أغلق' : 'افتح'}</button></td></tr>)}
            </tbody></table>}
            {qrFor && <div className="mm-created"><div className="mm-qr" dangerouslySetInnerHTML={{ __html: qrSvg(qrFor.url, 160, 'M', '#0e5f46') }} /><div><b>{qrFor.label_ar}</b><br /><a href={qrFor.url} dir="ltr" target="_blank" rel="noreferrer">{qrFor.url}</a>{qrFor.recipients?.length ? <ul className="mm-links">{qrFor.recipients.map((r: any) => <li key={r.email}><span>{r.name || '—'} <small dir="ltr">{r.email}</small></span><small>{r.finished ? 'أنهى' : r.started ? 'بدأ' : r.opened ? 'فتح' : 'لم يفتح'}</small></li>)}</ul> : null}</div></div>}
            <p className="mm-note">البريد وواتساب مؤجَّلان بقرار المالك (ج) — انسخ الرابط أو نص الرسالة أو اطبع الملصق وأرسلها بقناتك.</p>
          </section>
        </>}

        {tab === 'bank' && <section className="am-card"><h3>تغطية البنك مقابل الخطة <small>معتمد / مطلوب لكل خلية — الخلية الحمراء لا تكفي لتوليد نموذج</small></h3>
          {!cov ? <div className="am-empty">تعذّر قراءة البنك — نفّذ ملف SQL أولًا.</div> : <>
            <table className="mm-t mm-cov"><thead><tr><th>المستوى</th>{SKILLS.map((s) => <th key={s}>{skillLabel(s)}</th>)}</tr></thead><tbody>
              {LEVELS.map((lv) => <tr key={lv}><td><b>{lv}</b></td>{SKILLS.map((s) => { const c = cov.cells.find((x: any) => x.level === lv && x.skill === s); const okc = c && c.approved >= c.needed; return <td key={s} className={okc ? 'ok' : 'low'}><b>{c?.approved ?? 0}</b> / {c?.needed ?? 0}<br /><small>{Object.entries(c?.by_type || {}).map(([k, v]) => `${k}:${v}`).join(' ') || '—'}</small></td>; })}</tr>)}
            </tbody></table>
            <div className="am-kpis"><span><b>{cov.total_approved}</b> معتمد من {cov.total_all}</span>{Object.entries(cov.by_status || {}).map(([k, v]) => <span key={k}><b>{v as number}</b> {k}</span>)}<span><b>{cov.descriptors_used}</b> واصفًا مستخدمًا</span></div>
            <p className="mm-note">م1: البنك يُقرأ هنا ويُحرَّر بالـ SQL. م2 يجلب محرّر البنود المصوّرة والسحابية ومراجعة الزملاء وتحليل البنود (الصعوبة والتمييز) وامتحانات المستوى A1…C2.</p>
          </>}
        </section>}
        <p className="mm-foot">© 2026 {MIAAR_NAMES_AR.product} — {MIAAR_NAMES_AR.nature}، والقرار الأكاديمي بيد إنسان.</p>
      </div>
    </div>
  );
}
const CSS = `
.am{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;direction:rtl}
.am :is(button,a,input,select,textarea):focus-visible{outline:3px solid #0f2a4e;outline-offset:2px}
.am-wrap{max-width:1160px;margin:0 auto;display:grid;gap:12px}
.am-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.am-head p{margin:0;color:#475569;font-size:14px;line-height:1.7;max-width:900px}.am-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0e5f46}
.am-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;overflow-x:auto}.am-card h3{margin:0 0 10px;color:#0f2a4e;font-size:17px}.am-card h3 small{font-size:12px;color:#475569;font-weight:600;display:block}
.am-empty{color:#475569;font-size:14px;text-align:center;padding:20px;line-height:1.8}.am-err{color:#991b1b;font-size:13px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 12px}.am-ok{color:#065f46;font-size:13px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px}
.am-kpis{display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:13px;color:#475569}.am-kpis b{font-size:20px;color:#0f2a4e;margin-inline-end:4px}.am-kpis .g b{color:#0e5f46}
.am-btn{border:1px solid #0f2a4e;background:#0f2a4e;color:#fff;border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;min-height:44px}.am-btn.ghost{background:#fff;color:#0f2a4e}.am-btn:disabled{opacity:.5;cursor:default}
.mm-tabs{display:flex;gap:6px;flex-wrap:wrap}.mm-tabs a{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:800;color:#0f2a4e;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}.mm-tabs a.on{background:#0e5f46;border-color:#0e5f46;color:#fff}
.mm-t{width:100%;border-collapse:collapse;font-size:13px}.mm-t th{text-align:start;color:#475569;font-weight:800;border-bottom:1px solid #e2e8f0;padding:6px 8px;font-size:12px}.mm-t td{border-bottom:1px solid #f1f5f9;padding:8px;vertical-align:top}.mm-t small{color:#64748b;font-size:11.5px}.mm-t code{font-size:12px;background:#f1f5f9;border-radius:6px;padding:2px 6px}
.mm-cov td.ok{background:#ecfdf5}.mm-cov td.low{background:#fef2f2}
.mm-c.high{color:#065f46;font-weight:800}.mm-c.medium{color:#92400e;font-weight:800}.mm-c.border{color:#991b1b;font-weight:800}
.mm-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}.mm-row input{font:inherit;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;min-height:44px;min-width:200px}
.mm-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.mm-form label{display:grid;gap:4px;font-size:12.5px;font-weight:800;color:#334155}.mm-form input,.mm-form select,.mm-form textarea{font:inherit;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;min-height:44px;background:#fff}.mm-full{grid-column:1/-1}
.mm-created{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#f0faf5;border:1px solid #c6e6d6;border-radius:12px;padding:12px;margin-top:12px;font-size:13px;line-height:1.8}.mm-created a{color:#0e5f46;word-break:break-all}.mm-qr svg{display:block;background:#fff;border-radius:8px}
.mm-links{list-style:none;padding:0;margin:6px 0;display:grid;gap:4px;font-size:12px}.mm-links li{display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap;border-bottom:1px dashed #e2e8f0;padding:3px 0}.mm-links code{font-size:11px;word-break:break-all}
.mm-open{color:#065f46;font-weight:800}.mm-closed{color:#64748b;font-weight:800}.mm-acts{display:flex;gap:4px;flex-wrap:wrap}.mm-acts .am-btn{padding:4px 8px;font-size:12px;min-height:36px}
.mm-note{font-size:12.5px;color:#475569;line-height:1.7;margin:8px 0 0}.mm-note code{background:#f1f5f9;border-radius:6px;padding:1px 5px}.mm-log{background:#0f172a;color:#e2e8f0;border-radius:10px;padding:10px;font-size:12px;line-height:1.7;white-space:pre-wrap;direction:rtl;text-align:right}
.mm-foot{color:#475569;font-size:12.5px;line-height:1.7;margin:4px 0 0}
`;
