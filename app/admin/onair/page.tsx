'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /admin/onair — «أَثَر معك — على الهواء» للطاقم (P33)
 *  من على الهواء الآن (بالأسماء) · الصفّ الحي · التصعيدات والاستشارات (يتولّاها الطاقم) · «أسئلة أجاب عنها الهواء» (اعتماد سؤال/جواب بصياغة عامة) ·
 *  اعتماد مترجمي الإشارة · الإنزال من الهواء بسبب يصل العضو · أرقام الشهر. الطاقم لا يقرأ خيوط «عون سريع» إلا ما صُعّد إليه.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { GRADE_LABEL } from '../../../lib/onair/registry';
import type { Grade } from '../../../lib/onair/registry';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
type Tab = 'now' | 'escalations' | 'faq' | 'people';

export default function AdminOnAirPage() {
  const router = useRouter(); const db = useMemo(() => supabase(), []);
  const [ready, setReady] = useState(false); const [tok, setTok] = useState(''); const [data, setData] = useState<any>(null); const [error, setError] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState('');
  const [tab, setTab] = useState<Tab>('now'); const [note, setNote] = useState<Record<string, string>>({}); const [faq, setFaq] = useState<Record<string, { q: string; a: string }>>({}); const [thread, setThread] = useState<Record<string, any[]>>({}); const [interpEmail, setInterpEmail] = useState('');
  const fresh = async () => { const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || tok; if (tk && tk !== tok) setTok(tk); return tk; };
  const H = async (tk?: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tk || await fresh()}` });
  async function load(tk?: string) { const j = await fetch('/api/admin/onair', { headers: await H(tk), cache: 'no-store' }).then(r => r.json()); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setData(j); }
  async function post(body: any) { setBusy(body.action); setError(''); setOk(''); try { const j = await fetch('/api/admin/onair', { method: 'POST', headers: await H(), body: JSON.stringify(body) }).then(r => r.json()); if (!j.success) throw new Error(j.error || 'فشل'); if (j.note_ar) setOk(j.note_ar); await load(); return j; } catch (e: any) { setError(e.message); return null; } finally { setBusy(''); } }
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/onair'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
    const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!ready) return; const id = setInterval(() => load(), 20000); return () => clearInterval(id); }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const present: any[] = data?.present || []; const queue: any[] = data?.queue || []; const esc: any[] = data?.escalations || []; const recent: any[] = data?.recent || []; const grounded: any[] = data?.grounded || []; const interpreters: any[] = data?.interpreters || []; const st = data?.stats;
  const faqCandidates = recent.filter(r => r.status === 'done' && r.kind === 'quick');
  if (!ready) return <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="am-wrap"><div className="am-card">{error ? <span className="am-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  return (
    <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="am-wrap">
        <header className="am-head"><div><span className="am-kicker"><Icon name="chat" size={14} /> بوابة أَثَر · P33</span><h1>أَثَر معك — على الهواء</h1><p>الطاقم هنا حارسٌ لا مُشغِّل: يرى من على الهواء، ويتولّى ما صُعّد إليه والاستشارات، ويعتمد «أسئلة أجاب عنها الهواء» بصياغة عامة، ويعتمد مترجمي الإشارة. خيوط «عونٍ سريع» ملك لطرفيها.</p></div></header>
        <PortalAdminTabs counts={{ '/admin/onair': esc.length }} />
        {error && <div className="am-err" role="alert">{error}</div>}{ok && <div className="am-ok" role="status">{ok}</div>}
        {data?.pending_sql && <div className="am-err" role="alert">لم يُنفَّذ ملف SQL الخاص بـ P33 بعد (<code>20261210_portal_p33_onair.sql</code>) — نفّذه أولًا ثم أعد التحميل.</div>}
        {st && <div className="am-kpis" data-testid="ao-kpis"><span className="g"><b>{st.present}</b> على الهواء الآن</span><span><b>{st.month.asked}</b> طلبًا هذا الشهر</span><span><b>{st.month.done}</b> اكتمل</span><span><b>{st.month.expired}</b> بلا ردّ</span><span><b>{st.month.escalated}</b> صُعّد</span><span><b>{st.month.avg_response_min ?? '—'}</b> د متوسط أول ردّ</span><span><b>{st.interpreters}</b> مترجمًا معتمَدًا</span><span className="am-cycle"><Link href="/on-air" className="am-btn ghost small">الصفحة العامة</Link></span></div>}
        <div className="am-tabs" role="tablist">{([['now', `الآن (${present.length} · صفّ ${queue.length})`], ['escalations', `التصعيدات والاستشارات (${esc.length})`], ['faq', 'أسئلة أجاب عنها الهواء'], ['people', 'المترجمون والإنزال']] as [Tab, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} data-testid={`ao-tab-${k}`}>{l}</button>)}</div>

        {tab === 'now' && <div className="am-grid2">
          <div className="am-card" data-testid="ao-present"><h3>من على الهواء الآن <small>— بالأسماء؛ لا أحد يُجبر على الصعود ولا يُسأل عن النزول</small></h3>
            {!present.length && <div className="am-empty">لا أحد الآن.</div>}
            {present.length > 0 && <table className="am-table"><thead><tr><th>الاسم</th><th>الوجه</th><th>يستقبل</th><th>المجالات</th><th>متبقٍ</th><th></th></tr></thead><tbody>{present.map(p => <tr key={p.user_id}><td><b>{p.name_ar}</b><br /><small>{p.email}</small></td><td>{p.face_ar}</td><td>{p.receives.map((g: Grade) => GRADE_LABEL[g]?.ar || g).join(' · ')}</td><td><small>{p.domains.join(' · ') || '—'}</small></td><td>{p.minutes_left} د</td><td><input placeholder="سبب الإنزال" value={note[p.user_id] || ''} onChange={e => setNote(n => ({ ...n, [p.user_id]: e.target.value }))} aria-label="سبب الإنزال" /><button type="button" className="am-btn danger small" disabled={!!busy || (note[p.user_id] || '').length < 5} onClick={() => post({ action: 'ground', user_id: p.user_id, note: note[p.user_id] })} data-testid="ao-ground">أنزِل</button></td></tr>)}</tbody></table>}
          </div>
          <div className="am-card" data-testid="ao-queue"><h3>الصفّ الحي <small>— يراه الحاضرون؛ الطاقم يراقب فقط</small></h3>
            {!queue.length && <div className="am-empty">لا طلبات مفتوحة.</div>}
            {queue.map(r => <div key={r.id} className="ao-req"><b>{r.kind_ar}</b> · <span className="am-st" style={{ background: r.status === 'taken' ? '#0b6f69' : '#c9a24b' }}>{r.status_ar}</span> · <small>{r.asker_alias}{r.domain ? ` · ${r.domain}` : ''} · {fmt(r.created_at)}{r.receiver_ar !== '—' ? ` · مع ${r.receiver_ar}` : ''}</small><p>{r.text_ar}</p></div>)}
          </div>
        </div>}

        {tab === 'escalations' && <div className="am-card" data-testid="ao-esc"><h3>التصعيدات والاستشارات <small>— «يحتاج الطاقم» من مُستقبِل، أو «استشارة» من سائل؛ الطاقم يتولّاها ويغلقها بملاحظة تصل الخيط</small></h3>
          {!esc.length && <div className="am-empty">لا شيء ينتظر.</div>}
          {esc.map(r => <div key={r.id} className="ao-req" data-testid="ao-esc-row"><b>{r.kind_ar}</b> · <small>{r.asker_alias}{r.domain ? ` · ${r.domain}` : ''} · {fmt(r.created_at)}{r.receiver_ar !== '—' ? ` · صعّده ${r.receiver_ar}` : ''}{r.interpreter_wanted ? ' · يطلب مترجم إشارة' : ''}</small><p>{r.text_ar}</p>
            {thread[r.id] && <ul className="ao-thread">{thread[r.id].map((m: any) => <li key={m.id}><small>{m.from_role === 'asker' ? 'السائل' : m.from_role === 'receiver' ? 'المُستقبِل' : 'النظام'}:</small> {m.text_ar}</li>)}</ul>}
            <div className="am-decide">
              {!thread[r.id] && r.kind === 'quick' && <button type="button" className="am-btn ghost small" disabled={!!busy} onClick={async () => { const j = await post({ action: 'thread', id: r.id }); if (j) setThread(t => ({ ...t, [r.id]: j.messages || [] })); }}>اقرأ الخيط المُصعَّد</button>}
              <input placeholder="ملاحظة للطالب (اختياري)" value={note[r.id] || ''} onChange={e => setNote(n => ({ ...n, [r.id]: e.target.value }))} aria-label="ملاحظة" style={{ maxWidth: 360 }} />
              <button type="button" className="am-btn small" disabled={!!busy} onClick={() => post({ action: 'resolve', id: r.id, note: note[r.id] })} data-testid="ao-resolve">تولّيته</button>
              {r.kind === 'consult' && <Link href="/admin/consulting" className="am-btn ghost small">طلبات الاستشارة</Link>}
            </div></div>)}
        </div>}

        {tab === 'faq' && <div className="am-card" data-testid="ao-faq"><h3>أسئلة أجاب عنها الهواء <small>— خذ لقاءً اكتمل، وأعد صياغة السؤال والجواب بصيغة عامة بلا أسماء؛ يظهر في /on-air لينفع من يأتي بعده</small></h3>
          {!faqCandidates.length && <div className="am-empty">لا لقاءات مكتملة هذا الشهر بعد.</div>}
          {faqCandidates.map(r => <div key={r.id} className="ao-req" data-testid="ao-faq-row"><b>{r.kind_ar}</b> · <small>{r.domain || 'بلا مجال'} · {fmt(r.done_at)} · {r.outcome_ar}</small><p>{r.text_ar}</p>
            {r.faq ? <p className="am-ok">معتمَد: «{r.faq.question_ar}»</p> : <>
              <input placeholder="السؤال بصياغة عامة" value={faq[r.id]?.q ?? r.text_ar.slice(0, 160)} onChange={e => setFaq(f => ({ ...f, [r.id]: { q: e.target.value, a: f[r.id]?.a || '' } }))} aria-label="السؤال" />
              <textarea rows={3} placeholder="الجواب الذي يصلح لكل من يسأل مثله" value={faq[r.id]?.a || ''} onChange={e => setFaq(f => ({ ...f, [r.id]: { q: f[r.id]?.q ?? r.text_ar.slice(0, 160), a: e.target.value } }))} aria-label="الجواب" style={{ marginTop: 6 }} />
              <div className="am-decide"><button type="button" className="am-btn small" disabled={!!busy || !(faq[r.id]?.a || '').trim()} onClick={() => post({ action: 'faq', id: r.id, question_ar: faq[r.id]?.q ?? r.text_ar.slice(0, 160), answer_ar: faq[r.id]?.a })} data-testid="ao-faq-approve">اعتمد ونشر</button></div>
            </>}
          </div>)}
        </div>}

        {tab === 'people' && <div className="am-grid2">
          <div className="am-card" data-testid="ao-interp"><h3>مترجمو لغة الإشارة <small>— الوجه الثالث على الهواء؛ يعتمدهم الطاقم ببريدهم</small></h3>
            <div className="am-decide"><input placeholder="بريد المترجم" value={interpEmail} onChange={e => setInterpEmail(e.target.value)} aria-label="بريد المترجم" dir="ltr" style={{ maxWidth: 320 }} /><button type="button" className="am-btn small" disabled={!!busy || !interpEmail.includes('@')} onClick={async () => { const j = await post({ action: 'interpreter', email: interpEmail.trim(), ok: true }); if (j) setInterpEmail(''); }} data-testid="ao-interp-add">اعتمد</button></div>
            {!interpreters.length && <div className="am-empty">لا مترجمين معتمَدين بعد — انظر «شريك لغة الإشارة» في قرارات التشغيل.</div>}
            <ul>{interpreters.map(i => <li key={i.user_id}><b>{i.name_ar}</b> <small>{i.email}</small> <button type="button" className="am-btn ghost small" disabled={!!busy} onClick={() => post({ action: 'interpreter', user_id: i.user_id, ok: false })}>ألغِ</button></li>)}</ul>
          </div>
          <div className="am-card" data-testid="ao-grounded"><h3>المُنزَلون من الهواء <small>— بقرار الطاقم وسبب يصل العضو؛ يُرفع متى شئت</small></h3>
            {!grounded.length && <div className="am-empty">لا أحد.</div>}
            <ul>{grounded.map(g => <li key={g.user_id}><b>{g.name_ar}</b> ({g.face_ar}) <small>{g.email} · {fmt(g.grounded_at)} · {g.note}</small> <button type="button" className="am-btn ghost small" disabled={!!busy} onClick={() => post({ action: 'unground', user_id: g.user_id })} data-testid="ao-unground">ارفع الإنزال</button></li>)}</ul>
          </div>
        </div>}

        <div className="am-card"><h3>آخر اللقاءات <small>— بلا نصوص الخيوط</small></h3>
          {!recent.length && <div className="am-empty">لا شيء بعد.</div>}
          {recent.length > 0 && <table className="am-table"><thead><tr><th>الدرجة</th><th>الحالة</th><th>السائل</th><th>المُستقبِل</th><th>المدة</th><th>النتيجة</th><th>متى</th></tr></thead><tbody>{recent.slice(0, 30).map(r => <tr key={r.id}><td>{r.kind_ar}</td><td>{r.status_ar}</td><td>{r.asker_alias}</td><td>{r.receiver_ar}</td><td>{r.duration_min ? `${r.duration_min} د` : '—'}</td><td>{r.outcome_ar || r.staff_note || '—'}</td><td><small>{fmt(r.done_at || r.created_at)}</small></td></tr>)}</tbody></table>}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.am{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;direction:rtl}
.am :is(button,a,input,select,textarea):focus-visible{outline:3px solid #0f2a4e;outline-offset:2px}
.am-wrap{max-width:1160px;margin:0 auto;display:grid;gap:12px}
.am-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.am-head p{margin:0;color:#475569;font-size:14px;line-height:1.7;max-width:900px}.am-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b6f69}
.am-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;overflow-x:auto}.am-card h3{margin:0 0 10px;color:#0f2a4e;font-size:17px}.am-card h3 small{font-size:12px;color:#475569}.am-card ul{margin:0;padding-inline-start:18px;font-size:13px;line-height:2;color:#1e293b}
.am-empty{color:#475569;font-size:14px;text-align:center;padding:20px;line-height:1.8}.am-err{color:#991b1b;font-size:13px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 12px}.am-ok{color:#065f46;font-size:13px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px}
.am-kpis{display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:13px;color:#475569}.am-kpis b{font-size:20px;color:#0f2a4e;margin-inline-end:4px}.am-kpis .g b{color:#0b6f69}.am-cycle{margin-inline-start:auto;display:flex;gap:6px}
.am-tabs{display:flex;gap:6px;flex-wrap:wrap}.am-tabs button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:9px 14px;font:inherit;font-size:13px;font-weight:800;color:#334155;cursor:pointer;min-height:44px}.am-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.am-table{width:100%;border-collapse:collapse;font-size:13px}.am-table th{text-align:right;color:#475569;font-weight:800;font-size:12px;padding:8px 10px;border-bottom:1px solid #e2e8f0;white-space:nowrap}.am-table td{padding:9px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top;color:#0f172a}.am-table small{color:#475569;font-size:11.5px}
.am-st{color:#fff;font-size:11px;font-weight:900;border-radius:999px;padding:2px 8px;white-space:nowrap}
.am-btn{border:1px solid #0f2a4e;background:#0f2a4e;color:#fff;border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;min-height:36px}.am-btn.ghost{background:#fff;color:#0f2a4e;border-color:#cbd5e1}.am-btn.small{padding:4px 9px;font-size:12px}.am-btn.danger{color:#991b1b;border-color:#fecaca;background:#fff}.am-btn:disabled{opacity:.5;cursor:not-allowed}
.am-decide{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}
.am-grid2{display:grid;grid-template-columns:1.2fr 1fr;gap:12px;align-items:start}
.am-card input:not([type=checkbox]),.am-card textarea{border:1px solid #94a3b8;border-radius:10px;padding:8px 10px;font:inherit;font-size:13.5px;font-weight:400;background:#fff;width:100%;box-sizing:border-box;color:#0f172a;min-height:36px}
.ao-req{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:13.5px;color:#334155}.ao-req b{color:#0f2a4e}.ao-req p{margin:6px 0;line-height:1.8;color:#0f172a}
.ao-thread{background:#f8fafc;border-radius:10px;padding:8px 20px;margin:6px 0}
code{font-size:12px;background:#f1f5f9;border-radius:6px;padding:1px 5px}
@media(max-width:860px){.am-grid2{grid-template-columns:1fr}.am-cycle{margin-inline-start:0}}
`;
