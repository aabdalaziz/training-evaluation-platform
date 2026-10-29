'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر في الجيب (P19) — هدف المشاركة (share_target): «شارك مع أَثَر» من الكاميرا/المعرض/المسجّل في الجوال
 *  sw.js يستقبل POST /share ويحفظ الملفات مؤقتًا في IndexedDB ثم يحوّل إلى هنا؛ هنا تختار المهمة التي يخصّها الدليل
 *  (مهماتك المفتوحة من /api/missions — تعمل من الكاش بلا اتصال) أو تلصق رابط مهمة، ثم يدخل صندوق الأدلة الميداني.
 *  يعمل أيضًا كمنفذ يدوي: اختر ملفًا من الجهاز.
 */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PortalShell, useLang } from '../components/PortalShell';
import { useOutbox } from '../components/Pocket';
import { takeShared } from '../../lib/portal/pocket-db';
import { LIMITS } from '../../lib/portal/pocket';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';

export default function SharePage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }
type M = { id: string; token: string; title_ar: string; status: string; evidence_mode: string; due_at: string };
function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const sp = useSearchParams(); const received = sp.get('received') === '1'; const ob = useOutbox(); const db = useMemo(() => supabase(), []);
  const [files, setFiles] = useState<{ name: string; type: string; blob: Blob; url: string }[]>([]); const [missions, setMissions] = useState<M[] | null>(null); const [pick, setPick] = useState(''); const [tokenIn, setTokenIn] = useState(''); const [caption, setCaption] = useState(''); const [msg, setMsg] = useState(''); const [done, setDone] = useState(false); const [sharedText, setSharedText] = useState('');
  useEffect(() => { (async () => {
    try { const got = await takeShared(); if (got.length) setFiles(got.map(f => { const blob = new Blob([f.buf], { type: f.type }); return { name: f.name, type: f.type, blob, url: URL.createObjectURL(blob) }; })); const t = got.find(x => x.text || x.title); if (t) setSharedText(t.text || t.title || ''); } catch { /* ignore */ }
    try { const tok = (await db.auth.getSession()).data.session?.access_token; if (!tok) { setMissions([]); return; } const r = await fetch('/api/missions', { headers: { Authorization: `Bearer ${tok}` } }); const j = await r.json().catch(() => null); const open = ((j?.missions || []) as M[]).filter(m => m.status === 'assigned' || m.status === 'returned'); setMissions(open); if (open.length === 1) setPick(open[0].token); } catch { setMissions([]); }
  })(); }, [db]);
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => { const list = Array.from(e.target.files || []).slice(0, 3).map(f => ({ name: f.name, type: f.type, blob: f as Blob, url: URL.createObjectURL(f) })); setFiles(list); };
  const tokenOf = () => { const raw = tokenIn.trim(); const m = raw.match(/\/m\/([A-Za-z0-9_-]{8,})/); return pick || (m ? m[1] : raw); };
  const send = async () => {
    const token = tokenOf(); if (!token) { setMsg(ar ? 'اختر مهمة أو الصق رابطها' : 'Pick a mission or paste its link'); return; }
    if (!files.length && !caption.trim()) { setMsg(ar ? 'لا دليل: صورة أو تسجيل أو وصف' : 'No evidence'); return; }
    const f = files[0]; const title = missions?.find(m => m.token === token)?.title_ar || (ar ? 'مهمة' : 'Mission');
    const r = await ob.enqueue('mission', { token, title, evidence: { caption: caption.trim() || sharedText || undefined, text: !f && caption.trim() ? caption.trim() : undefined } }, f ? new File([f.blob], f.name, { type: f.type }) : null);
    if (!r.ok) { setMsg(r.reason_ar || 'x'); return; }
    setDone(true);
  };
  return (
    <main className="pt-main" dir={ar ? 'rtl' : 'ltr'} style={{ maxWidth: 720, margin: '0 auto', padding: '18px 16px 96px' }}>
      <style dangerouslySetInnerHTML={{ __html: `.sh-th{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.sh-th img,.sh-th .au{width:96px;height:96px;object-fit:cover;border-radius:12px;border:1px solid #e2e8f0;display:grid;place-items:center;background:#f1f5f9}.sh-ms{display:grid;gap:6px;margin:8px 0}.sh-ms label{display:flex;gap:8px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px;cursor:pointer}.sh-ms label.on{border-color:#0b8a83;background:#ecfeff}.sh input[type=text],.sh textarea{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit}.sh .pt-box{margin-bottom:12px}` }} />
      <div className="sh">
        <h1 style={{ color: '#0f2a4e', fontSize: 22, margin: '0 0 4px', display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="inbox" size={22} /> {ar ? 'دليل إلى أَثَر' : 'Evidence to Athar'}</h1>
        <p className="pt-muted" style={{ marginTop: 0 }}>{received ? (ar ? 'وصلت مشاركتك من جهازك. إلى أي مهمة تنتمي؟' : 'Received from your device. Which mission is it for?') : (ar ? 'صوّر أو سجّل من قلب العمل، ثم شاركه مع أَثَر — أو اختر ملفًا هنا. يدخل صندوق الأدلة الميداني ويُرسل حين يعود الاتصال.' : 'Capture at work, share to Athar — or pick a file. It enters the field outbox and syncs when online.')}</p>
        {done ? <div className="pt-box" data-testid="share-done" style={{ background: '#f0fdf4', borderColor: '#86efac' }}><b>{ar ? 'دخل صندوق الأدلة ✓' : 'In the outbox ✓'}</b><p className="pt-muted" style={{ margin: '6px 0' }}>{ob.online ? (ar ? 'جارٍ إرساله الآن.' : 'Sending now.') : (ar ? 'سيُرسل تلقائيًا حين يعود الاتصال — بتاريخ التقاطه.' : 'Will send automatically when online.')}</p><Link href="/offline#outbox" className="pt-btn">{ar ? 'افتح الصندوق' : 'Open outbox'}</Link></div> : <>
          <div className="pt-box">
            <b>{ar ? '1) الدليل' : '1) Evidence'}</b>
            <div className="sh-th">{files.map((f, i) => f.type.startsWith('image/') ? <img key={i} src={f.url} alt="" /> : <div key={i} className="au"><Icon name="play" size={28} /></div>)}</div>
            <input type="file" accept="image/jpeg,image/png,image/webp,audio/*" onChange={onFile} data-testid="share-file" />
            <p className="pt-muted" style={{ fontSize: 12 }}>{ar ? `حدود بلا اتصال: صورة ≤ ${Math.round(LIMITS.image_bytes / 1048576 * 10) / 10} م.ب · تسجيل ≤ ${Math.round(LIMITS.audio_bytes / 1048576)} م.ب` : 'Offline limits: image 1.5 MB · audio 3 MB'}</p>
            <textarea rows={3} value={caption} onChange={e => setCaption(e.target.value)} placeholder={ar ? 'ماذا يُظهر هذا الدليل؟ (وصف قصير)' : 'What does this show?'} data-testid="share-caption" />
          </div>
          <div className="pt-box">
            <b>{ar ? '2) المهمة' : '2) Mission'}</b>
            {missions === null && <p className="pt-muted">…</p>}
            {missions && missions.length > 0 && <div className="sh-ms" data-testid="share-missions">{missions.map(m => <label key={m.id} className={pick === m.token ? 'on' : ''}><input type="radio" name="m" checked={pick === m.token} onChange={() => setPick(m.token)} /> <span>{m.title_ar}</span><small className="pt-muted" style={{ marginInlineStart: 'auto' }}>{m.evidence_mode}</small></label>)}</div>}
            {missions && missions.length === 0 && <p className="pt-muted">{ar ? 'لا مهمات مفتوحة محفوظة على هذا الجهاز — الصق رابط المهمة:' : 'No open missions cached — paste the mission link:'}</p>}
            <input type="text" value={tokenIn} onChange={e => { setTokenIn(e.target.value); setPick(''); }} placeholder={ar ? 'أو الصق رابط المهمة https://…/m/…' : 'or paste mission link'} data-testid="share-token" />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><button className="pt-btn gold" onClick={send} data-testid="share-send">{ob.online ? (ar ? 'أرسل الدليل' : 'Send evidence') : (ar ? 'احفظ في الصندوق' : 'Save to outbox')}</button>{msg && <span className="pt-muted" data-testid="share-msg">{msg}</span>}</div>
        </>}
      </div>
    </main>
  );
}
