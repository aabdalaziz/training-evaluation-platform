'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «ختم المراقب» — صفحة هاتف خفيفة: ختم الفتح (رقم القاعة) ثم ختم الإغلاق (+ «عدّ القاعة» يُقارن تلقائيًا بالجلسات التي بدأت منذ ختم الفتح)
 *  لا أسماء ولا دخول · الرابط من QR نسخة المراقب فقط · كل ختم يظهر فورًا في لوحة النموذج (/admin/miaar/invites) وفي /verify/form كأعداد
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Stamp = { at: string; kind: 'open' | 'close'; hall: string; count: number | null; sessions: number | null; diff: number | null };
type State = { invite: { code: string; label_ar: string; status: string }; form: { code: string; version: number; n: number; twin: boolean; duration_minutes: number | null }; stamps: Stamp[]; hall: { lines_ar: string[] }; open_halls: string[]; sessions: number; max: number };
const fmt = (iso: string) => { try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso.slice(11, 16); } };
const box: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '12px 14px', marginTop: 10 };
const input: React.CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', fontSize: 16, width: '100%', boxSizing: 'border-box' };
const btn = (primary = true): React.CSSProperties => ({ border: 0, borderRadius: 10, padding: '11px 16px', fontSize: 16, fontWeight: 800, cursor: 'pointer', background: primary ? '#0b8a83' : '#e2e8f0', color: primary ? '#fff' : '#0f172a', width: '100%', marginTop: 8 });

export default function ProctorStamp({ code, token }: { code: string; token: string }) {
  const [st, setSt] = useState<State | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const [hall, setHall] = useState(''); const [count, setCount] = useState(''); const [mode, setMode] = useState<'open' | 'close'>('open');
  async function load() { setErr(''); const j = await fetch(`/api/miaar/proctor?invite=${encodeURIComponent(code)}&t=${encodeURIComponent(token)}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.success) { setErr(j?.error || 'تعذّر فتح صفحة الختم'); return; } setSt(j); if (j.open_halls?.length && !hall) { setHall(j.open_halls[0]); setMode('close'); } }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [code, token]);
  async function stamp() {
    setBusy(true); setErr(''); setMsg('');
    try { const j = await fetch('/api/miaar/proctor', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ invite: code, t: token, kind: mode, hall, count: mode === 'close' ? Number(count) : undefined }) }).then((r) => r.json()); if (!j?.success) { setErr(j?.error || 'تعذّر الختم'); return; } setMsg(j.note_ar || 'تم'); setCount(''); if (mode === 'open') setMode('close'); await load(); } finally { setBusy(false); }
  }
  return <main dir="rtl" lang="ar" style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui, Segoe UI, Tahoma, sans-serif', color: '#0f172a', padding: 16 }} data-testid="ps-root">
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <p style={{ margin: 0, color: '#0b8a83', fontWeight: 800 }}>مِعيار — من أَثَر · ختم المراقب</p>
      <h1 style={{ margin: '4px 0 0', fontSize: 22 }}>حضور القاعة بأثر رقمي</h1>
      {err && !st && <div role="alert" style={{ ...box, borderColor: '#fecaca', background: '#fef2f2' }} data-testid="ps-err">{err}<div><button type="button" style={btn(false)} onClick={() => void load()}>إعادة المحاولة</button></div></div>}
      {st && <>
        <div style={box} data-testid="ps-head">
          <b>{st.invite.label_ar}</b> <small style={{ color: '#475569' }}>· الدعوة <bdi dir="ltr">{st.invite.code}</bdi></small>
          <div style={{ marginTop: 4 }}>النموذج <bdi dir="ltr" data-testid="ps-form">{st.form.code}</bdi> v{st.form.version} · {st.form.n} بندًا{st.form.duration_minutes ? ` · ${st.form.duration_minutes} دقيقة` : ''}{st.form.twin ? ' · ورقتان أ/ب — «الأخضر يمينًا والذهبي يسارًا»' : ''}</div>
          <div style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>الجلسات التي بدأت على الدعوة حتى الآن: <b data-testid="ps-sessions">{st.sessions}</b> · الأختام {st.stamps.length}/{st.max}</div>
        </div>
        <div style={box}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" style={{ ...btn(mode === 'open'), marginTop: 0 }} data-testid="ps-mode-open" onClick={() => setMode('open')}>ختم الفتح</button>
            <button type="button" style={{ ...btn(mode === 'close'), marginTop: 0 }} data-testid="ps-mode-close" onClick={() => setMode('close')}>ختم الإغلاق</button>
          </div>
          <label style={{ display: 'block', marginTop: 10, fontWeight: 700 }}>رقم القاعة أو اسمها<input value={hall} onChange={(e) => setHall(e.target.value)} maxLength={20} placeholder="مثال: 3 أو قاعة الشرق" style={{ ...input, marginTop: 4 }} data-testid="ps-hall" list="ps-halls" /></label>
          {st.open_halls.length > 0 && <datalist id="ps-halls">{st.open_halls.map((h) => <option key={h} value={h} />)}</datalist>}
          {mode === 'close' && <label style={{ display: 'block', marginTop: 10, fontWeight: 700 }}>عدّ القاعة — كم شخصًا حاضرًا فعليًا؟<input value={count} onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="0" style={{ ...input, marginTop: 4 }} data-testid="ps-count" /><small style={{ color: '#475569', fontWeight: 400 }}>يُقارن تلقائيًا بعدد الجلسات التي بدأت منذ ختم الفتح لهذه القاعة.</small></label>}
          <button type="button" style={btn()} disabled={busy || !hall.trim() || (mode === 'close' && count === '')} data-testid="ps-go" onClick={() => void stamp()}>{busy ? '…' : mode === 'open' ? 'اختم بدء المراقبة' : 'اختم نهاية المراقبة'}</button>
          {msg && <p role="status" style={{ margin: '8px 0 0', color: '#047857', fontWeight: 700 }} data-testid="ps-msg">{msg}</p>}
          {err && <p role="alert" style={{ margin: '8px 0 0', color: '#b91c1c', fontWeight: 700 }} data-testid="ps-err">{err}</p>}
        </div>
        {st.stamps.length > 0 && <div style={box} data-testid="ps-list"><b>الأختام على هذه الدعوة</b>
          <ul style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>{st.stamps.map((s, i) => <li key={i} data-testid={`ps-stamp-${s.kind}`}>{s.kind === 'open' ? 'فتح' : 'إغلاق'} · القاعة {s.hall} · {fmt(s.at)}{s.kind === 'close' ? ` · عدّ ${s.count}${s.diff === 0 ? ' = الجلسات ✓' : ` مقابل ${s.sessions} جلسة (فرق ${s.diff! > 0 ? '+' : ''}${s.diff})`}` : ''}</li>)}</ul>
          {st.hall.lines_ar.length > 0 && <p style={{ color: '#475569', fontSize: 14, margin: '6px 0 0' }}>{st.hall.lines_ar.join(' · ')}</p>}
        </div>}
      </>}
      <p style={{ color: '#475569', fontSize: 13, marginTop: 14 }}>لا نسجّل اسمك — رقم القاعة ووقت الختم فقط. <Link href="/miaar">مِعيار</Link> · <Link href="/">الرئيسية</Link></p>
    </div>
  </main>;
}
