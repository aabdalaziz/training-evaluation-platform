'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P70 «بكلماتي عبر المستوى» — مكتب المتدرّب (يُحمَّل ديناميكيًا بلا SSR)
 *  1) الرأس: الدبلوم : المستوى N — الشعبة · من/إلى · المرحلة (تُفتح في… / مفتوحة / للقراءة والختم) · اختيار مستوى آخر
 *  2) «بكلماتي»: بطاقات مما كتبه وقاله صاحبها (سطوره · تطبيقه · التزاماته · نصّه وصوته في عُبور · «عبرتُ» بالكلمات) — أُبقي/أُخفي لكل بطاقة
 *  3) «سطر المستوى» (≤ 200) + 🎙️ ≤ 30 ث يبقى معه → «أختم صفحة المستوى» → رمز ATH-LV + وجه عام خاصّ افتراضيًا
 *  4) سطر الشعبة (k ≥ 5) · الحذف الفوري · التذييل
 *  testids: lv-root[data-phase][data-sealed] lv-err lv-ok lv-prog lv-open lv-cards lv-card[data-key][data-keep] lv-keep lv-exam-hear lv-line lv-line-save lv-voice-start lv-voice-hear lv-voice-del
 *           lv-seal lv-sealed[data-code] lv-code lv-public-toggle lv-public-key[data-key] lv-revoke lv-delete lv-section lv-foot lv-empty
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '../../../lib/supabase/client';
import { fastToken } from '../../components/Pocket';
import { Icon } from '../../../lib/ui/icons';
import { fmtDayAr } from '../../../lib/level/registry';
import type { Card, CardKey, PublicKey } from '../../../lib/level/registry';
import type { LevelItem, LevelView } from '../../../lib/level/store';

const VoiceRecorder = dynamic(() => import('../../components/VoiceRecorder'), { ssr: false });
type Data = { levels: LevelItem[]; view: LevelView | null; section_line_ar: string | null; names: Record<string, string>; limits: { lineMin: number; lineMax: number; voiceSec: number; k: number }; foot_ar: string; prompt_ar: string; card_ar: Record<CardKey, string>; public_ar: Record<PublicKey, string>; public_keys_all: PublicKey[]; now: string };
const qs = (k: string) => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get(k) : null);
const fmt = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium' }) : '');

export default function LevelDesk() {
  const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
  const [key, setKey] = useState<string>(''); const [line, setLine] = useState(''); const [rec, setRec] = useState(false); const [audio, setAudio] = useState<string | null>(null); const [exam, setExam] = useState<string | null>(null);
  useEffect(() => { fastToken(db).then((t) => setTok(t || '')); setKey(qs('level') || ''); }, [db]);
  const load = useCallback(async (t: string, k: string) => {
    const j = await fetch(`/api/me/level${k ? `?level=${encodeURIComponent(k)}` : ''}`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    if (j?.success) { setD(j); setErr(''); setLine(j.view?.line_ar || ''); if (j.view && !k) setKey(j.view.level.key); } else setErr(j?.error || 'تعذّر فتح الصفحة');
  }, []);
  useEffect(() => { if (tok) load(tok, key); }, [tok, key, load]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 7000); };
  async function act(payload: Record<string, unknown>, label: string): Promise<any> {
    setBusy(label); const j = await fetch('/api/me/level', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ level: key, ...payload }) }).then((r) => r.json()).catch(() => null); setBusy('');
    if (j?.success) { setD(j); setErr(''); if (j.message) flash(j.message); } else setErr(j?.error || 'تعذّر الحفظ'); return j;
  }
  async function onVoice(take: { blob: Blob; sec: number }): Promise<string | null> {
    const fd = new FormData(); fd.append('file', take.blob, `voice.${take.blob.type.includes('mp4') ? 'm4a' : take.blob.type.includes('ogg') ? 'ogg' : 'webm'}`); fd.append('level', key); fd.append('duration_sec', String(take.sec));
    setBusy('voice'); const j = await fetch('/api/me/level/voice', { method: 'POST', headers: { Authorization: `Bearer ${tok}` }, body: fd }).then((r) => r.json()).catch(() => null); setBusy('');
    if (j?.success) { flash(j.message || 'حُفظ صوتك — لك وحدك.'); setRec(false); setAudio(null); await load(tok!, key); return null; } return j?.error || 'تعذّر الرفع';
  }
  async function hear() { const j = await fetch(`/api/me/level/voice?level=${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${tok}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.success) setAudio(j.url); else setErr(j?.error || 'تعذّر فتح الصوت'); }
  async function hearExam() { setBusy('exam'); const j = await fetch(`/api/me/level/voice?level=${encodeURIComponent(key)}&exam=1`, { headers: { Authorization: `Bearer ${tok}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null); setBusy(''); if (j?.success) setExam(j.url); else setErr(j?.error || 'تعذّر فتح التسجيل'); }
  async function delVoice() { if (!confirm('يُحذف صوتك فورًا — ويبقى سطرك المكتوب. نتابع؟')) return; const j = await fetch(`/api/me/level/voice?level=${encodeURIComponent(key)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } }).then((r) => r.json()).catch(() => null); if (j?.success) { flash(j.message); setAudio(null); await load(tok!, key); } else setErr(j?.error || 'تعذّر الحذف'); }
  async function seal() { if (!confirm('تُختم صفحة مستواك كما تراها الآن (ما أبقيتَه + سطرك) برمز وبصمة. إن ختمتَ لاحقًا ختمًا جديدًا بَطَل هذا. صوتك لا يدخل الختم. نتابع؟')) return; await act({ action: 'seal' }, 'seal'); }
  async function revoke() { if (!confirm('يُبطل الختم فورًا ويصير الإبطال معلَنًا لمن يتحقّق بالرمز. تبقى صفحتك وكلماتك هنا. نتابع؟')) return; await act({ action: 'revoke' }, 'revoke'); }
  async function del() { if (!confirm('تُحذف صفحة هذا المستوى فورًا — السطر والصوت والختم — ولا سلّة. كلماتك في مصادرها (سطري، عُبور…) تبقى حيث هي. نتابع؟')) return; await act({ action: 'delete' }, 'delete'); }
  const v = d?.view; const keys = v?.public_keys || []; const togglePublicKey = (k: PublicKey) => act({ action: 'public', public_keys: keys.includes(k) ? keys.filter((x) => x !== k) : [...keys, k] }, `pk${k}`);
  const lineOk = !!d && line.trim().length >= d.limits.lineMin && line.trim().length <= d.limits.lineMax;
  const L = v?.level;
  return <main className="lv" dir="rtl" data-testid="lv-root" data-phase={L?.phase || ''} data-sealed={v?.seal && !v.seal.revoked_at ? 1 : 0}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <nav className="lv-nav" aria-label="تنقّل"><Link href="/me" className="lv-link"><Icon name="arrow" size={14} /> ملفّي</Link><Link href="/me/line" className="lv-link"><Icon name="edit" size={14} /> سطري</Link><Link href="/me/grad" className="lv-link"><Icon name="award" size={14} /> يوم تخرّجي</Link><Link href="/miaar" className="lv-link"><Icon name="compass" size={14} /> مِعيار</Link></nav>
    <header className="lv-head"><span className="pt-kicker"><Icon name="school" size={14} /> {d?.names.official_ar || 'صفحة المستوى — بكلمات المتدرّب'}</span><h1>🪜 {d?.names.title || 'بكلماتي عبر المستوى'} <small>{d?.names.sub || 'ما كتبتُه وقلتُه في هذا المستوى — لا ما كُتب عنّي'}</small></h1>
      <p>في الأسبوع الأخير من كل مستوى تُفتح لك صفحة تجمع ما كتبتَه وقلتَه أنت فيه: سطور أيامك، سطور تطبيقك في موقعك، التزامك «حتى نلتقي» وهل أوفيتَ به، ونصّك وصوتك في اختبار نهاية المستوى — كما هي، بلا درجة. تُبقي ما تشاء، تكتب سطرًا تحمله معك، وتختمه إن شئت؛ وكلمتك تعبر معك إلى أول أسبوع في المستوى التالي.</p></header>
    {err && <p className="lv-err" role="alert" data-testid="lv-err">{err}</p>}
    {msg && <p className="lv-ok" role="status" data-testid="lv-ok">{msg}</p>}
    {!tok && tok !== null && <section className="pt-box"><p>سجّل الدخول لتفتح صفحة مستواك. <Link href="/me">مساحتي</Link></p></section>}
    {d && !v && <section className="pt-box lv-empty" data-testid="lv-empty"><b>لم تُفتح صفحة مستوى لك بعد.</b><p className="lv-muted">تُفتح أول يوم من الأسبوع الأخير في كل مستوى من دبلومك (كما يضعه المشرف في هيكل الدبلوم). حتى ذلك اليوم اكتب سطرك اليومي في <Link href="/me/line">سطري</Link> — فهو ما ستجده هنا.</p></section>}
    {d && v && L && <>
      <section className="lv-prog" data-testid="lv-prog">
        <div><b>{L.name_ar} : المستوى {L.level_no}{L.section_ar ? ` — ${L.section_ar}` : ''}</b><p className="lv-muted">{fmtDayAr(L.window.from_day)} ← {fmtDayAr(L.window.to_day)} · {L.phase === 'open' ? 'الصفحة مفتوحة للكتابة والختم' : 'للقراءة والختم'}{v.counts.training_days ? ` · ${v.counts.training_days} يوم تدريب` : ''}</p></div>
        {d.levels.length > 1 && <select className="lv-select" value={key} onChange={(e) => setKey(e.target.value)} aria-label="مستوى آخر">{d.levels.map((p) => <option key={p.key} value={p.key}>{p.name_ar} — المستوى {p.level_no}{p.sealed ? ' ✓' : ''}</option>)}</select>}
      </section>
      {L.phase === 'open' && <section className="lv-open" data-testid="lv-open"><b>{d.names.station} 🏁</b> — {L.next_from ? `المستوى التالي يبدأ ${fmtDayAr(L.next_from)}.` : 'هذا آخر مستوياتك — بعده صفحة تخرّجك.'} ما كتبتَه بيدك صار صفحة؛ أكملها بسطرٍ واحد، واختمها إن شئت.</section>}

      {/* بكلماتي */}
      <section className="lv-box"><h2><Icon name="edit" size={16} /> {d.names.words} <small className="lv-muted">ما كتبتَه وقلتَه أنت في هذا المستوى · أُبقي أو أُخفي</small></h2>
        {!v.cards.length && <p className="lv-muted" data-testid="lv-cards-empty">لم نجد كلمات لك داخل نافذة هذا المستوى. سطر المستوى وحده يكفي لتختم صفحتك.</p>}
        <div className="lv-cards" data-testid="lv-cards">{v.cards.map((c) => <CardView key={c.key} c={c} keep={v.keep[c.key] !== false} busy={busy === `keep${c.key}`} onKeep={(on) => act({ action: 'keep', key: c.key, on }, `keep${c.key}`)} examHear={c.key === 'exam_speaking' && v.exam_voice ? hearExam : null} examBusy={busy === 'exam'} onEntryPublic={c.key === 'entry_line' ? (on) => act({ action: 'entry_public', on }, `keep${c.key}`) : undefined} />)}</div>
        {exam && <audio controls src={exam} className="lv-audio" autoPlay controlsList="nodownload" data-testid="lv-exam-audio" />}
        <p className="lv-counts">{v.counts.day_lines > 0 && <span>✍️ {v.counts.day_lines} سطور أيام</span>}{v.counts.apply_lines > 0 && <span>🧭 {v.counts.apply_lines} سطور تطبيق</span>}{v.counts.commits > 0 && <span>🤝 {v.counts.commits_done}/{v.counts.commits} التزامات أوفيتَ بها</span>}</p>
      </section>

      {/* سطر المستوى */}
      <section className="lv-box lv-linebox" id="lv-line"><h2><Icon name="star" size={16} /> {d.names.line} <small className="lv-muted">≤ {d.limits.lineMax} حرفًا · يظهر في الختم والوجه العام · ويعبر معك</small></h2>
        <p className="lv-prompt">{d.prompt_ar}</p>
        <textarea className="lv-ta" value={line} onChange={(e) => setLine(e.target.value.slice(0, d.limits.lineMax))} maxLength={d.limits.lineMax} rows={2} placeholder="سطر واحد — بكلماتك" data-testid="lv-line" aria-label="سطر المستوى" />
        <div className="lv-acts"><button type="button" className="pt-btn small" disabled={!lineOk || !!busy || line.trim() === (v.line_ar || '')} onClick={() => act({ action: 'line', line_ar: line }, 'line')} data-testid="lv-line-save">احفظ السطر</button><span className="lv-muted">{line.trim().length}/{d.limits.lineMax}</span>
          {v.line_ar && !v.voice && !rec && <button type="button" className="pt-btn ghost small" onClick={() => setRec(true)} data-testid="lv-voice-start">🎙️ قُله بصوتك (≤ {d.limits.voiceSec} ث)</button>}
          {v.voice && <><button type="button" className="pt-btn ghost small" onClick={hear} data-testid="lv-voice-hear">🔊 اسمع صوتك ({v.voice.sec} ث)</button><button type="button" className="pt-btn ghost small" onClick={delVoice} data-testid="lv-voice-del">احذف الصوت</button></>}</div>
        {rec && <VoiceRecorder ar maxSec={d.limits.voiceSec} hint="سطر مستواك بصوتك — لك وحدك، لا يدخل الختم ولا الوجه العام" sendLabel="احفظ صوتي" testid="lv-rec" onSend={onVoice} onCancel={() => setRec(false)} />}
        {audio && <audio controls src={audio} className="lv-audio" autoPlay />}
      </section>

      {/* الختم والوجه العام */}
      <section className="lv-box lv-sealbox">
        {!v.seal || v.seal.revoked_at ? <>
          <h2><Icon name="certificate" size={16} /> {d.names.seal}</h2>
          <p className="lv-muted">الختم يجمّد ما أبقيتَه وسطرك في جسم واحد برمز <code>ATH-LV-…</code> وبصمة SHA-256، يتحقّق منه أي أحد في <Link href="/verify/level">/verify/level</Link>. تبقى الصفحة خاصّة حتى تفتح وجهها العام بنفسك.{v.seal?.revoked_at ? ` الختم السابق (${v.seal.code}) أُبطل في ${fmt(v.seal.revoked_at)}.` : ''}</p>
          <button type="button" className="pt-btn gold" disabled={!v.line_ar || !!busy} onClick={seal} data-testid="lv-seal">🔏 {d.names.seal}</button>{!v.line_ar && <span className="lv-muted"> — اكتب سطر المستوى أولًا</span>}
        </> : <div data-testid="lv-sealed" data-code={v.seal.code}>
          <h2><Icon name="certificate" size={16} /> مختومة <small className="lv-muted">{fmt(v.seal.sealed_at)}{v.seal.previous ? ` · أبطلت ${v.seal.previous} ختمًا سابقًا` : ''}</small></h2>
          <p className="lv-code"><code data-testid="lv-code">{v.seal.code}</code> <button type="button" className="lv-linkbtn" onClick={() => { try { navigator.clipboard.writeText(`${location.origin}${v.seal!.public_path}`); flash('نُسخ رابط صفحتك'); } catch { /* ignore */ } }}>انسخ الرابط</button></p>
          {v.seal.stale && <p className="lv-stale">تغيّر شيء بعد الختم (سطرك أو ما أبقيتَه). المختوم ثابت كما كان؛ إن أردتَ ختمًا جديدًا يحلّ محلّه: <button type="button" className="lv-linkbtn" onClick={seal} disabled={!!busy}>أعِد الختم</button></p>}
          <div className="lv-public">
            <label className="lv-switch"><input type="checkbox" checked={v.live_public} onChange={(e) => act({ action: 'public', live_public: e.target.checked }, 'live')} data-testid="lv-public-toggle" /> <b>{d.names.public_face}</b> <span className="lv-muted">{v.live_public ? <>مفتوح: <Link href={v.seal.public_path} target="_blank">{v.seal.public_path}</Link></> : 'مغلق — خاصّة بك'}</span></label>
            <div className="lv-keys">{d.public_keys_all.map((k) => <label key={k} className={`lv-chip ${keys.includes(k) ? 'on' : ''}`} data-testid="lv-public-key" data-key={k} data-on={keys.includes(k) ? 1 : 0}><input type="checkbox" checked={keys.includes(k)} disabled={!!busy} onChange={() => togglePublicKey(k)} /> {d.public_ar[k]}</label>)}</div>
            <p className="lv-muted">الافتراضي: السطر والأعداد فقط. صوتك ونصّ اختبارك لا يظهران أبدًا. الإبطال فوري ومعلَن.</p>
          </div>
          <div className="lv-acts"><Link href={v.seal.verify_path} className="pt-btn ghost small">تحقّق</Link><button type="button" className="pt-btn ghost small" onClick={revoke} disabled={!!busy} data-testid="lv-revoke">أبطل الختم</button></div>
        </div>}
      </section>

      {d.section_line_ar && <section className="lv-box lv-section" data-testid="lv-section"><Icon name="users" size={16} /> {d.section_line_ar} <small className="lv-muted">— أعداد فقط، بلا أسماء</small></section>}
      <div className="lv-acts lv-danger"><button type="button" className="lv-linkbtn" onClick={del} disabled={!!busy} data-testid="lv-delete">احذف صفحة هذا المستوى فورًا</button></div>
      <p className="lv-foot" data-testid="lv-foot">{d.foot_ar}</p>
    </>}
  </main>;
}

function CardView({ c, keep, busy, onKeep, examHear, examBusy, onEntryPublic }: { c: Card; keep: boolean; busy: boolean; onKeep: (on: boolean) => void; examHear: (() => void) | null; examBusy: boolean; onEntryPublic?: (on: boolean) => void }) {
  return <article className={`lv-card ${keep ? '' : 'off'} k-${c.key}`} data-testid="lv-card" data-key={c.key} data-keep={keep ? 1 : 0}>
    <header><b>{c.title_ar}</b><button type="button" className="lv-linkbtn" disabled={busy} onClick={() => onKeep(!keep)} data-testid="lv-keep">{keep ? 'أخفِ' : 'أبقِ'}</button></header>
    {c.text_ar && <p className="lv-card-text" dir={c.key === 'entry_line' ? 'auto' : undefined}>{c.text_ar}</p>}
    {c.key === 'entry_line' && c.text_ar && onEntryPublic && <label className="lv-entry-pub" data-testid="lv-entry-pub" data-on={c.public_ok ? 1 : 0}><input type="checkbox" checked={c.public_ok === true} disabled={busy} onChange={(e) => onEntryPublic(e.target.checked)} /> <span>يجوز أن يظهر سطري على الصفحة الرئيسة في «لماذا جاؤوا» — بلا اسمي ولا برنامجي (النصّ فقط)</span></label>}
    {c.items && <ul className="lv-items">{c.items.map((it, i) => <li key={i}>{it.text_ar}<small>{fmt(it.at)}{it.state_ar ? ` · ${it.state_ar}` : ''}</small></li>)}</ul>}
    {c.state_ar && <p className="lv-muted">{c.state_ar}</p>}
    {examHear && <p><button type="button" className="pt-btn ghost small" onClick={examHear} disabled={examBusy} data-testid="lv-exam-hear">🔊 اسمع ما قلتُه — لي وحدي</button></p>}
    {c.href && <p><Link href={c.href} className="lv-link">افتح ←</Link></p>}
    {c.at && !c.items && <small className="lv-muted">{fmt(c.at)}</small>}
  </article>;
}

const CSS = `
.lv{font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif;color:#0f172a;max-width:1000px;margin:0 auto;padding:22px 16px 60px;overflow-wrap:anywhere;min-width:0}.lv *{box-sizing:border-box}
.lv-nav{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px}.lv-link{color:#0f2a4e;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;gap:5px;font-size:14px}.lv-link:hover{text-decoration:underline}
.lv-head h1{margin:4px 0 6px;font-size:32px;color:#0f2a4e}.lv-head h1 small{display:block;font-size:15px;color:#0b8a83;font-weight:800;margin-top:2px}.lv-head p{margin:0 0 14px;color:#475569;line-height:1.9;max-width:760px}
.lv-muted{color:#64748b;font-size:13px;line-height:1.8;margin:4px 0}.lv-err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}.lv-ok{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}
.lv-prog{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:12px 16px;margin:0 0 12px}.lv-prog b{font-size:18px;color:#0f2a4e}.lv-select{border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;background:#fff}
.lv-open{background:linear-gradient(135deg,#ecfeff,#ccfbf1);border:1px solid #5eead4;border-radius:16px;padding:14px 18px;margin:0 0 12px;font-size:16px;line-height:1.9;color:#134e4a}
.lv-box{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px 18px;margin:0 0 12px}.lv-box h2{margin:0 0 8px;font-size:18px;color:#0f2a4e;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.lv-box h2 small{font-weight:600;font-size:12px}
.lv-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}.lv-card{border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;background:#f8fafc;min-width:0}.lv-card.off{opacity:.45;background:#fff;border-style:dashed}.lv-card header{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px}.lv-card header b{color:#0f2a4e;font-size:14px}
.lv-card.k-crossed{background:linear-gradient(160deg,#ecfeff,#fff);border-color:#99f6e4}.lv-card.k-entry_line{background:linear-gradient(160deg,#eef7f6,#fff);border-color:#99d6cf}.lv-entry-pub{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;line-height:1.7;margin:6px 0 0;color:#0f2a4e;cursor:pointer}.lv-card.k-entry_line .lv-card-text{unicode-bidi:plaintext;color:#0f2a4e}.lv-card.k-prev_line,.lv-card.k-first_why{background:linear-gradient(160deg,#eff6ff,#fff);border-color:#bfdbfe}.lv-card.k-exam_writing,.lv-card.k-exam_speaking{background:linear-gradient(160deg,#fffbeb,#fff);border-color:#fcd34d}
.lv-card-text{margin:4px 0;font-size:16px;line-height:1.9;color:#3b1d0e;font-weight:600;white-space:pre-wrap}.lv-items{list-style:none;padding:0;margin:0;display:grid;gap:6px}.lv-items li{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:6px 10px;font-size:14px;line-height:1.7}.lv-items li small{display:block;color:#94a3b8;font-size:11px}
.lv-counts{display:flex;gap:14px;flex-wrap:wrap;margin:10px 0 0;color:#475569;font-size:13px;font-weight:700}
.lv-linebox{border-color:#99f6e4}.lv-prompt{margin:0 0 6px;color:#0f766e;font-weight:800;font-size:15px}.lv-ta{width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;font:inherit;font-size:17px;line-height:1.8;resize:vertical;min-height:64px}.lv-acts{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px}.lv-audio{width:100%;margin-top:8px}
.lv-linkbtn{background:none;border:0;color:#0f2a4e;font:inherit;font-weight:800;cursor:pointer;text-decoration:underline;padding:0}.lv-linkbtn:disabled{opacity:.5;cursor:default}
.lv-sealbox{border-color:#cbd5e1}.lv-code{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.lv-code code{font-size:20px;letter-spacing:1px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:6px 12px;color:#0f2a4e;font-weight:800}
.lv-stale{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px 12px;color:#9a3412;font-size:13px}
.lv-public{border-top:1px dashed #cbd5e1;margin-top:10px;padding-top:10px}.lv-switch{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:15px}.lv-keys{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 4px}.lv-chip{display:inline-flex;gap:6px;align-items:center;border:1px solid #cbd5e1;border-radius:999px;padding:4px 12px;font-size:13px;background:#fff;cursor:pointer}.lv-chip.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.lv-chip input{margin:0}
.lv-section{display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:#0f2a4e;font-weight:800}
.lv-danger{justify-content:flex-start;margin:4px 0 10px}.lv-danger .lv-linkbtn{color:#b91c1c}.lv-foot{color:#94a3b8;font-size:12px;line-height:1.8;border-top:1px dashed #e2e8f0;padding-top:10px}
@media (max-width:640px){.lv-head h1{font-size:26px}.lv-cards{grid-template-columns:1fr}}
`;
