'use client';
/**
 * P39 «إشعارات المتعلّم» — جرس «تنبيهاتي» في رأس أَثَر + قائمة كاملة في «أنا»
 *  - الجرس يظهر للمسجَّل فقط؛ يقرأ /api/notices كل 90 ثانية (خفيف) ويعرض عدد غير المقروء.
 *  - الفتح يعلّم المعروض مقروءًا (بعد ثانيتين) — بلا صفحة جديدة: لوحة منسدلة بقائمة وروابط.
 *  - لا بيانات شخصية في النصوص (الإشعارات نفسها بلا درجات).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sbLazy } from '../../lib/supabase/lazy';

type MyReply = { chip: string | null; chip_ar: string; text: string | null; at: string; editable: boolean };
type Notice = { id: string; kind: string; kind_ar: string; icon: string; title_ar: string; body_ar: string; url: string | null; pushed: boolean; read_at: string | null; created_at: string; can_reply?: boolean; my_reply?: MyReply | null };
type Chip = { key: string; icon: string; label_ar: string; label_en: string };
type Payload = { unread: number; notices: Notice[]; chips: Chip[]; reply_max: number };
/* P53 «ردّ على الكلمة»: اللمسات الافتراضية إن لم يُرسلها الخادم */
const DEFAULT_CHIPS: Chip[] = [{ key: 'got_it', icon: '🌱', label_ar: 'وصلت، شكرًا', label_en: 'Got it, thanks' }, { key: 'need_help', icon: '✋', label_ar: 'أحتاج مساعدة', label_en: 'I need help' }, { key: 'will_attend', icon: '🕐', label_ar: 'سأحضر الجلسة القادمة', label_en: 'I will attend the next session' }];

async function hdr(): Promise<Record<string, string>> { try { const db = await sbLazy(); const { data } = await db.auth.getSession(); const tk = data.session?.access_token; return { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }; } catch { return { 'Content-Type': 'application/json' }; } }
async function load(limit = 20): Promise<Payload | null> { try { const h = await hdr(); if (!h.Authorization) return null; const j = await fetch(`/api/notices?limit=${limit}`, { headers: h, cache: 'no-store' }).then((r) => r.json()); return j?.success ? { unread: Number(j.unread) || 0, notices: j.notices || [], chips: j.reply?.chips || DEFAULT_CHIPS, reply_max: Number(j.reply?.max) || 200 } : null; } catch { return null; } }
/** P53: ردّ المتعلّم على «كلمة» — لمسة أو سطر */
async function sendReply(noticeId: string, chip: string | null, text: string): Promise<{ ok: boolean; reply?: MyReply; message?: string; error?: string }> { try { const h = await hdr(); const r = await fetch('/api/notices', { method: 'POST', headers: h, body: JSON.stringify({ action: 'word_reply', notice_id: noticeId, chip, text }) }); const j = await r.json().catch(() => ({})); return r.ok && j.success ? { ok: true, reply: j.reply, message: j.message } : { ok: false, error: j.error || 'تعذّر الإرسال' }; } catch { return { ok: false, error: 'تعذّر الاتصال' }; } }
async function markRead(ids: string[] | 'all'): Promise<void> { try { const h = await hdr(); await fetch('/api/notices', { method: 'POST', headers: h, body: JSON.stringify(ids === 'all' ? { action: 'read', all: true } : { action: 'read', ids }) }); } catch { /* تجاهل */ } }
const when = (iso: string, ar: boolean) => { try { return new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso.slice(0, 16); } };

export function NoticeItem({ n, ar, onOpen, chips, max }: { n: Notice; ar: boolean; onOpen?: () => void; chips?: Chip[]; max?: number }) {
  return <li className={`nt-item ${n.read_at ? '' : 'unread'}`} data-testid="nt-item" data-kind={n.kind} data-read={n.read_at ? '1' : '0'}>
    <span className="nt-ic" aria-hidden="true">{n.icon}</span>
    <div className="nt-body"><b>{n.title_ar}</b>{n.body_ar && <p>{n.body_ar}</p>}<small>{n.kind_ar} · {when(n.created_at, ar)}{n.pushed ? (ar ? ' · وصلك إشعارًا' : ' · pushed') : ''}</small>
      {n.can_reply && <WordReply n={n} ar={ar} chips={chips || DEFAULT_CHIPS} max={max || 200} />}</div>
    {n.url && !n.can_reply && <a className="nt-open" href={n.url} onClick={onOpen}>{ar ? 'افتح' : 'Open'}</a>}
  </li>;
}

/** P53 «ردّ على الكلمة» — تحت كلمة المدرّب: ثلاث لمسات + سطر؛ ردّ واحد (يُعدَّل خلال ساعة) · يصل إلى المدرّب وحده · لا يُستعمل في أي تقييم */
function WordReply({ n, ar, chips, max }: { n: Notice; ar: boolean; chips: Chip[]; max: number }) {
  const [mine, setMine] = useState<MyReply | null>(n.my_reply || null); const [edit, setEdit] = useState(false); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function go(chip: string | null) { if (busy) return; const t = text.trim(); if (!chip && !t) { setMsg({ ok: false, t: ar ? 'اختر لمسة أو اكتب سطرًا' : 'Pick a chip or write a line' }); return; } setBusy(true); const r = await sendReply(n.id, chip, t); setBusy(false);
    if (!r.ok) { setMsg({ ok: false, t: r.error || '' }); return; } setMine(r.reply || null); setEdit(false); setText(''); setMsg({ ok: true, t: r.message || '' }); }
  if (mine && !edit) return <div className="nt-reply done" data-testid="nt-reply-done" data-chip={mine.chip || ''}>
    <span>{ar ? 'ردّك: ' : 'Your reply: '}<b>{mine.chip_ar}{mine.chip_ar && mine.text ? ' · ' : ''}{mine.text ? `«${mine.text}»` : ''}</b></span>
    {mine.editable && <button type="button" className="nt-link" onClick={() => { setEdit(true); setText(mine.text || ''); setMsg(null); }} data-testid="nt-reply-edit">{ar ? 'عدِّل' : 'Edit'}</button>}
    {msg?.ok && <small className="nt-reply-ok" role="status" data-testid="nt-reply-ok">{msg.t}</small>}
  </div>;
  return <div className="nt-reply" data-testid="nt-reply">
    <div className="nt-chips" role="group" aria-label={ar ? 'ردّ بلمسة' : 'Quick reply'}>{chips.map((c) => <button key={c.key} type="button" className="nt-chip" onClick={() => void go(c.key)} disabled={busy} data-testid="nt-chip" data-chip={c.key}><span aria-hidden="true">{c.icon}</span> {ar ? c.label_ar : c.label_en}</button>)}</div>
    <div className="nt-line"><input value={text} onChange={(e) => setText(e.target.value.slice(0, max))} maxLength={max} placeholder={ar ? `أو اكتب سطرًا لمدرّبك (≤ ${max} حرفًا)…` : `Or write one line (≤ ${max})…`} aria-label={ar ? 'سطر الردّ' : 'Reply line'} data-testid="nt-reply-text" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void go(null); } }} />
      <button type="button" className="nt-send" onClick={() => void go(null)} disabled={busy || !text.trim()} data-testid="nt-reply-send">{ar ? 'أرسل' : 'Send'}</button></div>
    <small className="nt-reply-hint">{ar ? 'يصل إلى مدرّبك وحده · لا يدخل في أي تقييم' : 'Reaches your trainer only · never part of any assessment'}{edit && <> · <button type="button" className="nt-link" onClick={() => setEdit(false)}>{ar ? 'إلغاء' : 'Cancel'}</button></>}</small>
    {msg && !msg.ok && <small className="nt-reply-err" role="alert" data-testid="nt-reply-err">{msg.t}</small>}
  </div>;
}

/** الجرس في الرأس (للمسجَّل) */
export function NoticesBell({ lang }: { lang: 'ar' | 'en' }) {
  const ar = lang === 'ar'; const [d, setD] = useState<Payload | null>(null); const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement | null>(null); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(() => { load(10).then((p) => p && setD(p)); }, []);
  useEffect(() => { refresh(); const iv = setInterval(refresh, 90000); const onVis = () => { if (document.visibilityState === 'visible') refresh(); }; document.addEventListener('visibilitychange', onVis); return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); }; }, [refresh]);
  useEffect(() => { if (!open) return; const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); }; document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey); return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); }; }, [open]);
  useEffect(() => { if (!open || !d || !d.unread) return; const ids = d.notices.filter((n) => !n.read_at).map((n) => n.id); if (!ids.length) return; timer.current = setTimeout(async () => { await markRead(ids); setD((x) => x ? { ...x, unread: Math.max(0, x.unread - ids.length), notices: x.notices.map((n) => ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n) } : x); }, 2000); return () => { if (timer.current) clearTimeout(timer.current); }; }, [open, d]);
  if (!d) return null;
  return <div className="nt-wrap" ref={ref}>
    <button type="button" className={`nt-bell ${d.unread ? 'has' : ''}`} onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={ar ? `تنبيهاتي${d.unread ? ` — ${d.unread} جديد` : ''}` : `My alerts${d.unread ? ` — ${d.unread} new` : ''}`} title={ar ? 'تنبيهاتي' : 'My alerts'} data-testid="nt-bell" data-unread={d.unread}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
      {d.unread > 0 && <b data-testid="nt-count">{d.unread > 9 ? '9+' : d.unread}</b>}
    </button>
    {open && <div className="nt-pop" role="dialog" aria-label={ar ? 'تنبيهاتي' : 'My alerts'} data-testid="nt-pop">
      <div className="nt-pophead"><b>{ar ? 'تنبيهاتي' : 'My alerts'}</b>{d.unread > 0 && <button type="button" className="nt-link" onClick={async () => { await markRead('all'); refresh(); }} data-testid="nt-readall">{ar ? 'اعتبرها كلّها مقروءة' : 'Mark all read'}</button>}</div>
      {d.notices.length === 0 ? <p className="nt-empty">{ar ? 'لا تنبيهات بعد — حين يصدر حكمك في مِعيار أو تُفتح لك إعادة أو تُحجز لك جلسة، ستجدها هنا.' : 'No alerts yet — verdicts, retakes and sessions will show up here.'}</p>
        : <ul className="nt-list">{d.notices.map((n) => <NoticeItem key={n.id} n={n} ar={ar} onOpen={() => setOpen(false)} chips={d.chips} max={d.reply_max} />)}</ul>}
      <a className="nt-all" href="/me#notices" onClick={() => setOpen(false)}>{ar ? 'كل تنبيهاتي في «أنا»' : 'All alerts in “Me”'}</a>
    </div>}
  </div>;
}

/** القائمة الكاملة داخل «أنا» */
export default function NoticesCard() {
  const [d, setD] = useState<Payload | null | undefined>(undefined);
  useEffect(() => { load(50).then((p) => setD(p)); }, []);
  if (d === undefined || d === null) return null;
  return <section className="me-card" id="notices" data-testid="me-notices" data-count={d.notices.length}>
    <style dangerouslySetInnerHTML={{ __html: NOTICES_CSS }} />
    <div className="nt-pophead"><h2 style={{ margin: 0 }}>🔔 تنبيهاتي {d.unread > 0 && <small className="nt-badge">{d.unread} جديد</small>}</h2>{d.unread > 0 && <button type="button" className="nt-link" onClick={async () => { await markRead('all'); setD(await load(50)); }}>اعتبرها كلّها مقروءة</button>}</div>
    <p className="nt-hint">كل ما يخصّك في مِعيار وأَثَر: صدور حكم العبور · إعادة مهارة · جلسة تعويض · ترقية · تسكين. يصلك إشعارًا على جهازك إن فعّلت التذكير، ويبقى هنا دائمًا.</p>
    {d.notices.length === 0 ? <p className="nt-empty">لا تنبيهات بعد.</p> : <ul className="nt-list">{d.notices.map((n) => <NoticeItem key={n.id} n={n} ar chips={d.chips} max={d.reply_max} />)}</ul>}
  </section>;
}

export const NOTICES_CSS = `
.nt-wrap{position:relative;display:inline-flex}
.nt-bell{display:inline-flex;align-items:center;justify-content:center;gap:4px;border:1.5px solid #cbd5e1;background:#fff;color:#0f2a4e;border-radius:999px;width:36px;height:36px;cursor:pointer;position:relative;padding:0}
.nt-bell.has{border-color:#0f766e;background:#f0fdfa}
.nt-bell b{position:absolute;top:-5px;inset-inline-end:-5px;background:#dc2626;color:#fff;border-radius:999px;min-width:18px;height:18px;padding:0 5px;font-size:11px;line-height:18px;text-align:center}
.nt-pop{position:absolute;top:calc(100% + 8px);inset-inline-end:0;width:min(380px,92vw);background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 18px 40px rgba(15,42,78,.18);padding:12px;z-index:60;text-align:start}
.nt-pophead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.nt-link{border:0;background:none;color:#0f766e;font:inherit;font-size:12px;font-weight:800;cursor:pointer;text-decoration:underline}
.nt-list{list-style:none;margin:0;padding:0;display:grid;gap:8px;max-height:60vh;overflow:auto}
.nt-item{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0}
.nt-item.unread{background:#f0fdfa;border-color:#99f6e4}
.nt-ic{font-size:20px;line-height:1}
.nt-body{flex:1;min-width:0}.nt-body b{display:block;font-size:14px;color:#0f2a4e}.nt-body p{margin:2px 0 0;font-size:13px;color:#334155;line-height:1.6}.nt-body small{color:#64748b;font-size:11px}
.nt-open{align-self:center;font-size:12px;font-weight:800;color:#0f2a4e;border:1px solid #cbd5e1;border-radius:999px;padding:4px 10px;text-decoration:none;white-space:nowrap}
.nt-empty{margin:4px 0;color:#64748b;font-size:13px;line-height:1.7}
.nt-all{display:block;margin-top:10px;text-align:center;font-size:13px;font-weight:800;color:#0f766e}
.nt-badge{background:#dc2626;color:#fff;border-radius:999px;padding:1px 8px;font-size:12px;vertical-align:middle;margin-inline-start:6px}
.nt-hint{margin:0 0 10px;color:#64748b;font-size:13px;line-height:1.7}
.nt-reply{margin-top:8px;display:grid;gap:6px}.nt-reply.done{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:13px;color:#0f2a4e;background:#fff;border:1px dashed #99f6e4;border-radius:10px;padding:6px 10px}
.nt-chips{display:flex;gap:6px;flex-wrap:wrap}.nt-chip{border:1.5px solid #cbd5e1;background:#fff;color:#0f2a4e;border-radius:999px;padding:6px 11px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;min-height:34px}.nt-chip:hover,.nt-chip:focus-visible{border-color:#0f766e;background:#f0fdfa}.nt-chip:disabled{opacity:.6;cursor:wait}
.nt-line{display:flex;gap:6px}.nt-line input{flex:1;min-width:0;border:1.5px solid #cbd5e1;border-radius:10px;padding:7px 10px;font:inherit;font-size:13px}.nt-send{border:1.5px solid #0f2a4e;background:#0f2a4e;color:#fff;border-radius:10px;padding:6px 12px;font:inherit;font-weight:800;cursor:pointer;min-height:34px}.nt-send:disabled{opacity:.5;cursor:not-allowed}
.nt-reply-hint{color:#64748b;font-size:11.5px}.nt-reply-ok{color:#15803d;font-weight:800}.nt-reply-err{color:#b91c1c;font-weight:800}
`;
