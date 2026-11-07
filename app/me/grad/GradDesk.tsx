'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P63 «يوم تخرّجي — بكلماتي» — مكتب الخرّيج (يُحمَّل ديناميكيًا بلا SSR)
 *  1) الرأس: البرنامج · التاريخ · «اليوم يومك» إن كان اليوم · اختيار برنامج آخر منتهٍ
 *  2) «بكلماتي»: بطاقات مما كتبه صاحبها بيده (كلمة الوداع وكلمة الاستقبال من مدرّبه هما الاستثناء) — أُبقي/أُخفي لكل بطاقة · P64: بطاقة «ما كتبتُه أول يوم»
 *  3) «سطر التخرّج» (≤ 160) + 🎙️ ≤ 15 ث يبقى معه → «اختم صفحتي» → رمز ATH-GD + وجه عام خاصّ افتراضيًا (السطر والأعداد فقط حين يُفتح)
 *  4) «منذ ذلك اليوم»: أعداد حيّة بعد الختم · «N من دفعتك ختموا» (k ≥ 5) · رسالة P39 القديمة إن وُجدت (قراءة فقط)
 *  testids: gd-root[data-phase][data-sealed] gd-err gd-ok gd-prog gd-today gd-cards gd-card[data-key][data-keep] gd-keep gd-line gd-line-save gd-voice-start gd-voice-hear gd-voice-del
 *           gd-seal gd-sealed[data-code] gd-code gd-public-toggle gd-public-key[data-key] gd-revoke gd-delete gd-since gd-cohort gd-legacy gd-foot gd-empty
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '../../../lib/supabase/client';
import { fastToken } from '../../components/Pocket';
import { Icon } from '../../../lib/ui/icons';
import { fmtDayAr } from '../../../lib/grad/registry';
import type { Card, CardKey, PublicKey } from '../../../lib/grad/registry';
import type { GradProgram, GradView } from '../../../lib/grad/store';

const VoiceRecorder = dynamic(() => import('../../components/VoiceRecorder'), { ssr: false });
type Data = { programs: GradProgram[]; view: GradView | null; since_ar: string[]; names: Record<string, string>; limits: { lineMin: number; lineMax: number; voiceSec: number; k: number }; foot_ar: string; prompt_ar: string; card_ar: Record<CardKey, string>; public_ar: Record<PublicKey, string>; public_keys_all: PublicKey[]; now: string };
const qs = (k: string) => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get(k) : null);
const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium' }) : '');

export default function GradDesk() {
  const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
  const [pid, setPid] = useState<string>(''); const [line, setLine] = useState(''); const [rec, setRec] = useState(false); const [audio, setAudio] = useState<string | null>(null);
  useEffect(() => { fastToken(db).then((t) => setTok(t || '')); setPid(qs('program') || ''); }, [db]);
  const load = useCallback(async (t: string, p: string) => {
    const j = await fetch(`/api/me/grad${p ? `?program=${encodeURIComponent(p)}` : ''}`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    if (j?.success) { setD(j); setErr(''); setLine(j.view?.line_ar || ''); if (j.view && !p) setPid(j.view.program.id); } else setErr(j?.error || 'تعذّر فتح الصفحة');
  }, []);
  useEffect(() => { if (tok) load(tok, pid); }, [tok, pid, load]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 7000); };
  async function act(payload: Record<string, unknown>, label: string): Promise<any> {
    setBusy(label); const j = await fetch('/api/me/grad', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ program_id: pid, ...payload }) }).then((r) => r.json()).catch(() => null); setBusy('');
    if (j?.success) { setD(j); setErr(''); if (j.message) flash(j.message); } else setErr(j?.error || 'تعذّر الحفظ'); return j;
  }
  async function onVoice(take: { blob: Blob; sec: number }): Promise<string | null> {
    const fd = new FormData(); fd.append('file', take.blob, `voice.${take.blob.type.includes('mp4') ? 'm4a' : take.blob.type.includes('ogg') ? 'ogg' : 'webm'}`); fd.append('program_id', pid); fd.append('duration_sec', String(take.sec));
    setBusy('voice'); const j = await fetch('/api/me/grad/voice', { method: 'POST', headers: { Authorization: `Bearer ${tok}` }, body: fd }).then((r) => r.json()).catch(() => null); setBusy('');
    if (j?.success) { flash(j.message || 'حُفظ صوتك — لك وحدك.'); setRec(false); setAudio(null); await load(tok!, pid); return null; } return j?.error || 'تعذّر الرفع';
  }
  async function hear() { const j = await fetch(`/api/me/grad/voice?program=${encodeURIComponent(pid)}`, { headers: { Authorization: `Bearer ${tok}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.success) setAudio(j.url); else setErr(j?.error || 'تعذّر فتح الصوت'); }
  async function delVoice() { if (!confirm('يُحذف صوتك فورًا — ويبقى سطرك المكتوب. نتابع؟')) return; const j = await fetch(`/api/me/grad/voice?program=${encodeURIComponent(pid)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } }).then((r) => r.json()).catch(() => null); if (j?.success) { flash(j.message); setAudio(null); await load(tok!, pid); } }
  async function seal() { if (!confirm('تُختم صفحتك كما تراها الآن (ما أبقيتَه + سطرك) برمز وبصمة. إن ختمتَ لاحقًا ختمًا جديدًا بَطَل هذا. صوتك لا يدخل الختم. نتابع؟')) return; await act({ action: 'seal' }, 'seal'); }
  async function revoke() { if (!confirm('يُبطل الختم فورًا ويصير الإبطال معلَنًا لمن يتحقّق بالرمز. تبقى صفحتك وكلماتك هنا. نتابع؟')) return; await act({ action: 'revoke' }, 'revoke'); }
  async function del() { if (!confirm('تُحذف صفحة تخرّجك فورًا — السطر والصوت والختم — ولا سلّة. كلماتك في مصادرها (خريطتك، ردودك…) تبقى حيث هي. نتابع؟')) return; await act({ action: 'delete' }, 'delete'); }
  const v = d?.view; const keys = v?.public_keys || []; const togglePublicKey = (k: PublicKey) => act({ action: 'public', public_keys: keys.includes(k) ? keys.filter((x) => x !== k) : [...keys, k] }, `pk${k}`);
  const lineOk = !!d && line.trim().length >= d.limits.lineMin && line.trim().length <= d.limits.lineMax;
  return <main className="gd" dir="rtl" data-testid="gd-root" data-phase={v?.program.phase || ''} data-sealed={v?.seal && !v.seal.revoked_at ? 1 : 0}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <nav className="gd-nav" aria-label="تنقّل"><Link href="/me" className="gd-link"><Icon name="arrow" size={14} /> ملفّي</Link><Link href="/me/after" className="gd-link"><Icon name="compass" size={14} /> ما بعد البرنامج</Link><Link href="/me/letter" className="gd-link"><Icon name="mail" size={14} /> رسالة إلى نفسي</Link><Link href="/me/athar-map" className="gd-link"><Icon name="spark" size={14} /> خريطة أثري</Link></nav>
    <header className="gd-head"><span className="pt-kicker"><Icon name="award" size={14} /> {d?.names.official_ar || 'صفحة التخرّج الذاتية للمتدرّب'}</span><h1>🎓 {d?.names.title || 'يوم تخرّجي'} <small>{d?.names.sub || 'ما كتبتُه بيدي في هذا البرنامج — لا ما كُتب عنّي'}</small></h1>
      <p>يوم انتهاء برنامجك تُفتح لك صفحة تجمع ما كتبتَه أنت فيه: أول «لأن…» على خيطك، ردودك على كلمات مدرّبك، فصول رحلتك، سطرك في ظرف الدفعة. لا درجة ولا تقييم ولا كلمة كُتبت عنك — إلا كلمة الوداع من مدرّبك إن كتبها. تُبقي ما شئت، وتختمها بسطرٍ واحد لمن سيأتي بعدك.</p></header>
    {err && <p className="gd-err" role="alert" data-testid="gd-err">{err}</p>}
    {msg && <p className="gd-ok" role="status" data-testid="gd-ok">{msg}</p>}
    {!tok && tok !== null && <section className="pt-box"><p>سجّل الدخول لتفتح صفحة تخرّجك. <Link href="/me">مساحتي</Link></p></section>}
    {d && !v && <section className="pt-box gd-empty" data-testid="gd-empty"><b>لم ينتهِ برنامج لك بعد.</b><p className="gd-muted">تُفتح هذه الصفحة يوم end_date لكل برنامج أنت مسجَّل فيه — ولمن تخرّج قبل اليوم أيضًا. حتى ذلك اليوم اكتب «لأن…» على خيوطك، وردّ على كلمات مدرّبك: هي ما سيملأ صفحتك.</p><p><Link href="/me/athar-map" className="pt-btn ghost small">خريطة أثري</Link> <Link href="/me/letter?door=grad" className="pt-btn ghost small">رسالة إلى نفسي عند تخرّجي</Link></p></section>}
    {d && v && <>
      <section className="gd-prog" data-testid="gd-prog">
        <div><b>{v.program.name_ar}</b><p className="gd-muted">{v.program.start_date ? `${fmtDayAr(v.program.start_date)} ← ` : ''}{fmtDayAr(v.program.end_date)}{v.program.phase === 'after' ? ` · منذ ${v.since.days_since} يومًا` : ''}</p></div>
        {d.programs.length > 1 && <select className="gd-select" value={pid} onChange={(e) => setPid(e.target.value)} aria-label="برنامج آخر">{d.programs.map((p) => <option key={p.id} value={p.id}>{p.name_ar} — {p.end_date}{p.sealed ? ' ✓' : ''}</option>)}</select>}
      </section>
      {v.program.phase === 'today' && <section className="gd-today" data-testid="gd-today"><b>اليوم يومك 🎓</b> — انتهى برنامجك اليوم. ما كتبتَه بيدك صار صفحة؛ أكملها بسطرٍ واحد، واختمها إن شئت.</section>}

      {/* بكلماتي */}
      <section className="gd-box"><h2><Icon name="edit" size={16} /> {d.names.words} <small className="gd-muted">ما كتبتَه أنت في هذا البرنامج · أُبقي أو أُخفي</small></h2>
        {!v.cards.length && <p className="gd-muted" data-testid="gd-cards-empty">لم نجد كلمات لك داخل نافذة هذا البرنامج. سطر التخرّج وحده يكفي لتختم صفحتك.</p>}
        <div className="gd-cards" data-testid="gd-cards">{v.cards.map((c) => <CardView key={c.key} c={c} keep={v.keep[c.key] !== false} busy={busy === `keep${c.key}`} onKeep={(on) => act({ action: 'keep', key: c.key, on }, `keep${c.key}`)} />)}</div>
        <p className="gd-counts">{v.counts.threads > 0 && <span>🧵 {v.counts.threads} خيوط أبقيتَها</span>}{v.counts.replies > 0 && <span>💬 {v.counts.replies} ردود</span>}{v.counts.amanat > 0 && <span>🎙️ {v.counts.amanat} أمانات</span>}{v.counts.chapters > 0 && <span>📖 {v.counts.chapters} فصول</span>}</p>
      </section>

      {/* سطر التخرّج */}
      <section className="gd-box gd-linebox" id="gd-line"><h2><Icon name="star" size={16} /> {d.names.line} <small className="gd-muted">≤ {d.limits.lineMax} حرفًا · يظهر في الختم والوجه العام</small></h2>
        <p className="gd-prompt">{d.prompt_ar}</p>
        <textarea className="gd-ta" value={line} onChange={(e) => setLine(e.target.value.slice(0, d.limits.lineMax))} maxLength={d.limits.lineMax} rows={2} placeholder="سطر واحد — بكلماتك" data-testid="gd-line" aria-label="سطر التخرّج" />
        <div className="gd-acts"><button type="button" className="pt-btn small" disabled={!lineOk || !!busy || line.trim() === (v.line_ar || '')} onClick={() => act({ action: 'line', line_ar: line }, 'line')} data-testid="gd-line-save">احفظ السطر</button><span className="gd-muted">{line.trim().length}/{d.limits.lineMax}</span>
          {v.line_ar && !v.voice && !rec && <button type="button" className="pt-btn ghost small" onClick={() => setRec(true)} data-testid="gd-voice-start">🎙️ قُله بصوتك (≤ {d.limits.voiceSec} ث)</button>}
          {v.voice && <><button type="button" className="pt-btn ghost small" onClick={hear} data-testid="gd-voice-hear">🔊 اسمع صوتك ({v.voice.sec} ث)</button><button type="button" className="pt-btn ghost small" onClick={delVoice} data-testid="gd-voice-del">احذف الصوت</button></>}</div>
        {rec && <VoiceRecorder ar maxSec={d.limits.voiceSec} hint="سطر تخرّجك بصوتك — لك وحدك، لا يدخل الختم ولا الوجه العام" sendLabel="احفظ صوتي" testid="gd-rec" onSend={onVoice} onCancel={() => setRec(false)} />}
        {audio && <audio controls src={audio} className="gd-audio" autoPlay />}
      </section>

      {/* الختم والوجه العام */}
      <section className="gd-box gd-sealbox">
        {!v.seal || v.seal.revoked_at ? <>
          <h2><Icon name="certificate" size={16} /> {d.names.seal}</h2>
          <p className="gd-muted">الختم يجمّد ما أبقيتَه وسطرك في جسم واحد برمز <code>ATH-GD-…</code> وبصمة SHA-256، يتحقّق منه أي أحد في <Link href="/verify/grad">/verify/grad</Link>. تبقى الصفحة خاصّة حتى تفتح وجهها العام بنفسك.{v.seal?.revoked_at ? ` الختم السابق (${v.seal.code}) أُبطل في ${fmt(v.seal.revoked_at)}.` : ''}</p>
          <button type="button" className="pt-btn gold" disabled={!v.line_ar || !!busy} onClick={seal} data-testid="gd-seal">🔏 {d.names.seal}</button>{!v.line_ar && <span className="gd-muted"> — اكتب سطر التخرّج أولًا</span>}
        </> : <div data-testid="gd-sealed" data-code={v.seal.code}>
          <h2><Icon name="certificate" size={16} /> مختومة <small className="gd-muted">{fmt(v.seal.sealed_at)}{v.seal.previous ? ` · أبطلت ${v.seal.previous} ختمًا سابقًا` : ''}</small></h2>
          <p className="gd-code"><code data-testid="gd-code">{v.seal.code}</code> <button type="button" className="gd-linkbtn" onClick={() => { try { navigator.clipboard.writeText(`${location.origin}${v.seal!.public_path}`); flash('نُسخ رابط صفحتك'); } catch { /* ignore */ } }}>انسخ الرابط</button></p>
          {v.seal.stale && <p className="gd-stale">تغيّر شيء بعد الختم (سطرك أو ما أبقيتَه). المختوم ثابت كما كان؛ إن أردتَ ختمًا جديدًا يحلّ محلّه: <button type="button" className="gd-linkbtn" onClick={seal} disabled={!!busy}>أعِد الختم</button></p>}
          <div className="gd-public">
            <label className="gd-switch"><input type="checkbox" checked={v.live_public} onChange={(e) => act({ action: 'public', live_public: e.target.checked }, 'live')} data-testid="gd-public-toggle" /> <b>{d.names.public_face}</b> <span className="gd-muted">{v.live_public ? <>مفتوح: <Link href={v.seal.public_path} target="_blank">{v.seal.public_path}</Link></> : 'مغلق — خاصّة بك'}</span></label>
            <div className="gd-keys">{d.public_keys_all.map((k) => <label key={k} className={`gd-chip ${keys.includes(k) ? 'on' : ''}`} data-testid="gd-public-key" data-key={k} data-on={keys.includes(k) ? 1 : 0}><input type="checkbox" checked={keys.includes(k)} disabled={!!busy} onChange={() => togglePublicKey(k)} /> {d.public_ar[k]}</label>)}</div>
            <p className="gd-muted">الافتراضي: السطر والأعداد فقط. صوتك لا يظهر أبدًا. الإبطال فوري ومعلَن.</p>
          </div>
          <div className="gd-acts"><Link href={v.seal.verify_path} className="pt-btn ghost small">تحقّق</Link><button type="button" className="pt-btn ghost small" onClick={revoke} disabled={!!busy} data-testid="gd-revoke">أبطل الختم</button></div>
        </div>}
      </section>

      {/* منذ ذلك اليوم · الدفعة · الرسالة القديمة */}
      {v.program.phase === 'after' && (d.since_ar.length > 0 || v.cohort_ar) && <section className="gd-box gd-since" data-testid="gd-since"><h2><Icon name="trend" size={16} /> {d.names.since} <small className="gd-muted">أعداد حيّة — المختوم لا يتغيّر</small></h2>
        <ul>{d.since_ar.map((l, i) => <li key={i}>{l}</li>)}{v.cohort_ar && <li data-testid="gd-cohort">👥 {v.cohort_ar}</li>}</ul></section>}
      {v.legacy_letter && <section className="gd-box gd-legacy" data-testid="gd-legacy"><h2><Icon name="mail" size={16} /> رسالتك القديمة من «أصوات حول الشهادة» <small className="gd-muted">كُتبت {fmt(v.legacy_letter.sealed_at)}</small></h2>
        {v.legacy_letter.text_ar ? <p className="gd-legacy-text">{v.legacy_letter.text_ar}</p> : <p className="gd-muted">مختومة — تُفتح {v.legacy_letter.opens_ar} (بعد سنة من نهاية البرنامج). الرسائل الجديدة تُكتب اليوم في <Link href={`/me/letter?door=grad&program=${encodeURIComponent(v.program.id)}`}>رسالة إلى نفسي</Link>.</p>}</section>}
      <div className="gd-acts gd-danger"><button type="button" className="gd-linkbtn" onClick={del} disabled={!!busy} data-testid="gd-delete">احذف صفحتي فورًا</button></div>
      <p className="gd-foot" data-testid="gd-foot">{d.foot_ar}</p>
    </>}
  </main>;
}

function CardView({ c, keep, busy, onKeep }: { c: Card; keep: boolean; busy: boolean; onKeep: (on: boolean) => void }) {
  return <article className={`gd-card ${keep ? '' : 'off'} k-${c.key}`} data-testid="gd-card" data-key={c.key} data-keep={keep ? 1 : 0}>
    <header><b>{c.title_ar}</b><button type="button" className="gd-linkbtn" disabled={busy} onClick={() => onKeep(!keep)} data-testid="gd-keep">{keep ? 'أخفِ' : 'أبقِ'}</button></header>
    {c.text_ar && <p className="gd-card-text">{c.text_ar}</p>}
    {c.items && <ul className="gd-items">{c.items.map((it, i) => <li key={i}>{it.text_ar}<small>{fmt(it.at)}</small></li>)}</ul>}
    {c.state_ar && <p className="gd-muted">{c.state_ar}{c.voice_sec ? ` · 🎙️ ${c.voice_sec} ث` : ''}</p>}
    {c.href && <p><Link href={c.href} className="gd-link">افتح ←</Link></p>}
    {c.at && !c.items && <small className="gd-muted">{fmt(c.at)}</small>}
  </article>;
}

const CSS = `
.gd{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;max-width:1000px;margin:0 auto;padding:22px 16px 60px;overflow-wrap:anywhere;min-width:0}.gd *{box-sizing:border-box}
.gd-nav{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px}.gd-link{color:#0f2a4e;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;gap:5px;font-size:14px}.gd-link:hover{text-decoration:underline}
.gd-head h1{margin:4px 0 6px;font-size:32px;color:#0f2a4e}.gd-head h1 small{display:block;font-size:15px;color:#b45309;font-weight:800;margin-top:2px}.gd-head p{margin:0 0 14px;color:#475569;line-height:1.9;max-width:760px}
.gd-muted{color:#64748b;font-size:13px;line-height:1.8;margin:4px 0}.gd-err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}.gd-ok{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}
.gd-prog{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:12px 16px;margin:0 0 12px}.gd-prog b{font-size:18px;color:#0f2a4e}.gd-select{border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;background:#fff}
.gd-today{background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fcd34d;border-radius:16px;padding:14px 18px;margin:0 0 12px;font-size:16px;line-height:1.9;color:#78350f}
.gd-box{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px 18px;margin:0 0 12px}.gd-box h2{margin:0 0 8px;font-size:18px;color:#0f2a4e;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.gd-box h2 small{font-weight:600;font-size:12px}
.gd-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}.gd-card{border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;background:#f8fafc;min-width:0}.gd-card.off{opacity:.45;background:#fff;border-style:dashed}.gd-card header{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px}.gd-card header b{color:#0f2a4e;font-size:14px}
.gd-card.k-farewell,.gd-card.k-welcome{background:linear-gradient(160deg,#fffbeb,#fff);border-color:#fcd34d}.gd-card.k-first_why{background:linear-gradient(160deg,#eff6ff,#fff);border-color:#bfdbfe}.gd-card-text{margin:4px 0;font-size:16px;line-height:1.9;color:#3b1d0e;font-weight:600}.gd-items{list-style:none;padding:0;margin:0;display:grid;gap:6px}.gd-items li{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:6px 10px;font-size:14px;line-height:1.7}.gd-items li small{display:block;color:#94a3b8;font-size:11px}
.gd-counts{display:flex;gap:14px;flex-wrap:wrap;margin:10px 0 0;color:#475569;font-size:13px;font-weight:700}
.gd-linebox{border-color:#fde68a}.gd-prompt{margin:0 0 6px;color:#9a3412;font-weight:800;font-size:15px}.gd-ta{width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;font:inherit;font-size:17px;line-height:1.8;resize:vertical;min-height:64px}.gd-acts{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px}.gd-audio{width:100%;margin-top:8px}
.gd-linkbtn{background:none;border:0;color:#0f2a4e;font:inherit;font-weight:800;cursor:pointer;text-decoration:underline;padding:0}.gd-linkbtn:disabled{opacity:.5;cursor:default}
.gd-sealbox{border-color:#cbd5e1}.gd-code{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.gd-code code{font-size:20px;letter-spacing:1px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:6px 12px;color:#0f2a4e;font-weight:800}
.gd-stale{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px 12px;color:#9a3412;font-size:13px}
.gd-public{border-top:1px dashed #cbd5e1;margin-top:10px;padding-top:10px}.gd-switch{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:15px}.gd-keys{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 4px}.gd-chip{display:inline-flex;gap:6px;align-items:center;border:1px solid #cbd5e1;border-radius:999px;padding:4px 12px;font-size:13px;background:#fff;cursor:pointer}.gd-chip.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.gd-chip input{margin:0}
.gd-since ul{margin:0;padding:0 18px 0 0;line-height:2;color:#0f2a4e;font-weight:700}.gd-legacy{border-color:#e9d5ff;background:#faf5ff}.gd-legacy-text{white-space:pre-wrap;line-height:1.9;font-size:15px}
.gd-danger{justify-content:flex-start;margin:4px 0 10px}.gd-danger .gd-linkbtn{color:#b91c1c}.gd-foot{color:#94a3b8;font-size:12px;line-height:1.8;border-top:1px dashed #e2e8f0;padding-top:10px}
@media (max-width:640px){.gd-head h1{font-size:26px}.gd-cards{grid-template-columns:1fr}}
`;
