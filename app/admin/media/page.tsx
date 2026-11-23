'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// إدارة أَثَر — الأداء المُشاهَد (P13-ج): مراجعة تسجيلات الفيديو/الصوت من «القناة الواحدة» — الآلة تقدّر من النص، والإنسان يشاهد ويعتمد (0.6 → 0.85)
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { MEDIA_CONTEXT_LABEL, MEDIA_STATUS_LABEL, fmtDuration, transcriptScore, wordCount } from '../../../lib/portal/media';
import type { MediaRow } from '../../../lib/portal/media';

import { RoomHead } from '../../components/RoomKit'; /* هـ-3 ح «عدّة الغرفة» */
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
type Item = MediaRow & { url: string | null; mime: string; bytes: number; created_at: string };
const fmt = (iso: string) => new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' });

export default function AdminMediaPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [tok, setTok] = useState('');
  const [items, setItems] = useState<Item[]>([]); const [stats, setStats] = useState<{ pending: number; approved: number }>({ pending: 0, approved: 0 });
  const [open, setOpen] = useState<string | null>(null); const [busy, setBusy] = useState(''); const [note, setNote] = useState(''); const [score, setScore] = useState<number | ''>('');

  async function load(tk: string) {
    const j = await fetch('/api/media?pending=1', { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json());
    if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setItems(j.items || []); setStats(j.stats || { pending: 0, approved: 0 });
  }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/media'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
      const { data } = await db.auth.getSession(); const tk = data.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function decide(id: string, action: 'approve' | 'reject') {
    setBusy(id); const j = await fetch('/api/media', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ id, action, note, score: score === '' ? undefined : score }) }).then(r => r.json());
    if (!j?.success) setError(j?.error || 'تعذّر الحفظ'); else { setNote(''); setScore(''); setOpen(null); await load(tok); } setBusy('');
  }
  if (!ready) return <div className="am rm-page"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="am-wrap"><div className="rm-card">{error ? <span className="am-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  return (
    <div className="am rm-page"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="am-wrap">
        <RoomHead
        title={<>مقاطع الأداء</>}
        desc={<><p>تسجيلات الفيديو والصوت التي سجّلها المتعلمون من «القناة الواحدة» في موقف اليوم و«ماذا لو؟» وغيرها. النص المفرَّغ يُقدَّر آليًا بمعايير شفافة، لكن الدليل لا يرتفع من 0.6 إلى 0.85 في التوأم المهاري إلا بعد أن يشاهده إنسان ويعتمده. المرفوض يُستبعد من الحساب. تُحذف التسجيلات غير المعتمدة تلقائيًا بعد 180 يومًا.</p></>}
      />
        <PortalAdminTabs counts={{ '/admin/media': stats.pending }} />
        {error && <div className="am-err">{error}</div>}
        <div className="rm-kpis"><span><b>{stats.pending}</b> بانتظار المراجعة</span><span><b>{stats.approved}</b> معتمد</span></div>
        {!items.length && <div className="rm-card rm-empty">لا تسجيلات بانتظار المراجعة الآن.</div>}
        {items.map(m => {
          const ts = m.transcript ? transcriptScore(m.transcript) : null; const isOpen = open === m.id;
          return (
            <article key={m.id} className="rm-card">
              <div className="am-row" onClick={() => { setOpen(isOpen ? null : m.id); setNote(''); setScore(ts ? ts.score : ''); }}>
                <div className="am-who"><b>{m.title || MEDIA_CONTEXT_LABEL[m.context_type]?.ar}</b><span>{m.email || m.user_id}</span><small>{fmt(m.created_at)} · {MEDIA_CONTEXT_LABEL[m.context_type]?.ar}{m.context_id ? ` · ${m.context_id}` : ''}</small></div>
                <div className="am-meta"><span className={`am-st ${m.status}`}>{MEDIA_STATUS_LABEL[m.status].ar}</span><span className="am-tag">{m.kind === 'video' ? 'فيديو' : 'صوت'} · {fmtDuration(m.duration_sec)} · {Math.round((m.bytes || 0) / 1024)} ك.ب</span>{ts && <span className="am-total">{ts.score}<small>/100 آلي</small></span>}{!!(m.skill_ids || []).length && <span className="am-tag soft">{m.skill_ids.length} مهارة</span>}</div>
              </div>
              {isOpen && (
                <div className="am-body">
                  <div className="am-cols">
                    <div>
                      <h4>التسجيل</h4>
                      {m.url ? (m.kind === 'video' ? <video src={m.url} controls playsInline className="am-player" /> : <audio src={m.url} controls className="am-player" />) : <p className="am-note">تعذّر إنشاء رابط العرض.</p>}
                      <p className="am-note">يُعرض برابط موقّت (5 دقائق) من مخزن خاص.</p>
                    </div>
                    <div>
                      <h4>النص المفرَّغ <small>({wordCount(m.transcript || '')} كلمة)</small></h4>
                      <p className="am-tr">{m.transcript || <em>لا نص — المتصفح لم يدعم التفريغ؛ اعتمد على المشاهدة.</em>}</p>
                      {ts && !!ts.notes_ar.length && <ul className="am-notes">{ts.notes_ar.map((n, k) => <li key={k}>{n}</li>)}</ul>}
                    </div>
                  </div>
                  <div className="am-decide">
                    <label>الدرجة النهائية <input type="number" min={0} max={100} value={score} onChange={e => setScore(e.target.value === '' ? '' : Math.max(0, Math.min(100, Number(e.target.value))))} /></label>
                    <input value={note} onChange={e => setNote(e.target.value)} placeholder="ملاحظة للمتعلم (اختياري)" maxLength={500} />
                    <button type="button" className="rm-btn ok" disabled={busy === m.id} onClick={() => decide(m.id, 'approve')}><Icon name="check" size={14} /> اعتمد (0.85)</button>
                    <button type="button" className="rm-btn bad" disabled={busy === m.id} onClick={() => decide(m.id, 'reject')}><Icon name="x" size={14} /> ارفض</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

const CSS = `
.am{font-family:inherit}
.am-wrap{max-width:1080px;margin:0 auto;display:grid;gap:12px}.am-err{color:#b91c1c;font-size:13px}
.am-row{display:flex;justify-content:space-between;gap:12px;align-items:center;cursor:pointer;flex-wrap:wrap}.am-who b{display:block;color:#3A1F36;font-size:15px}.am-who span{color:#5C4858;font-size:13px}.am-who small{display:block;color:#8E7F8A;font-size:12px}
.am-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.am-total{font-size:20px;color:#D4614A;font-weight:900}.am-total small{font-size:11px;color:#8E7F8A;margin-inline-start:4px;font-weight:600}
.am-st,.am-tag{font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:#F3E6DC;color:#5C4858}.am-st.uploaded{background:#FBF4EE;color:#8A5A1E}.am-st.approved{background:#e6f4f1;color:#D4614A}.am-st.rejected{background:#fee2e2;color:#b91c1c}.am-tag.soft{background:#FBF4EE;border:1px solid #EADFD6}
.am-body{margin-top:12px;border-top:1px dashed #EADFD6;padding-top:12px}.am-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}.am-cols h4{margin:0 0 8px;font-size:13px;color:#D4614A}.am-cols h4 small{color:#8E7F8A;font-weight:600}
.am-player{width:100%;border-radius:12px;background:#000;max-height:320px}.am-note{color:#8E7F8A;font-size:12.5px;margin:6px 0 0}
.am-tr{margin:0;background:#FBF4EE;border:1px solid #EADFD6;border-radius:10px;padding:10px 12px;font-size:13.5px;line-height:1.8;color:#3A2634;max-height:300px;overflow:auto;white-space:pre-wrap}.am-tr em{color:#B3A5AE}
.am-notes{margin:8px 0 0;padding-inline-start:18px;color:#8A5A1E;font-size:12.5px;line-height:1.7}
.am-decide{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center}.am-decide label{display:inline-flex;gap:6px;align-items:center;font-size:12.5px;color:#5C4858}.am-decide label input{width:70px;border:1px solid #D9CBC2;border-radius:10px;padding:8px;font:inherit}.am-decide>input{flex:1;min-width:200px;border:1px solid #D9CBC2;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px}
@media (max-width:860px){.am-cols{grid-template-columns:1fr}}
`;
