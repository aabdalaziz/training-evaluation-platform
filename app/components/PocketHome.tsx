'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر في الجيب (P19) — الشاشة المحلية: تعمل بلا اتصال من نسخ sw.js المحلية
 *  • محفظتي محليًا: الإصدارات والمستويات من حزمة الجيب مع سطر صدق «آخر تحديث… الإلغاء لم يُفحص»
 *  • موقف اليوم محليًا: إن كان في الكاش ولم أردّ بعد → أكتب ردّي ويدخل صندوق الأدلة حتى يعود الاتصال
 *  • صندوق الأدلة الميداني: ما بانتظار الإرسال، أخطاؤه، إرسال/حذف
 *  تُستخدم في /offline وتُعرض لأي زائر (بلا جلسة: تُظهر ما هو عام فقط)
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fastToken, useOutbox } from './Pocket';
import { Icon } from '../../lib/ui/icons';
import { LEVEL_NAME_AR, OUTBOX_LABEL, offlineLine } from '../../lib/portal/pocket';
import { supabase } from '../../lib/supabase/client';
import { MIN_RESPONSE_CHARS } from '../../lib/portal/daily-case';

type Bundle = { profile: { name: string; email: string }; levels: { code: string; name_ar: string; level: number; approved: boolean }[]; issuances: { id: string; code: string; kind: string; title_ar: string | null; issued_at: string; expires_at: string | null; revoked_at: string | null }[]; snapshot: { code: string; issued_at: string; expires_at: string | null } | null; did: string; fingerprint: string | null; generated_at: string };
type Fetched<T> = { data: T | null; cachedAt: string | null; stale: boolean; status: number };
async function getJson<T>(url: string, tok: string): Promise<Fetched<T>> {
  try { const r = await fetch(url, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} }); const j = await r.json().catch(() => null); return { data: r.ok && j?.success ? j : null, cachedAt: r.headers.get('X-Athar-Cached-At'), stale: r.headers.get('X-Athar-Cache') === 'stale', status: r.status }; }
  catch { return { data: null, cachedAt: null, stale: false, status: 0 }; }
}

export default function PocketHome({ compact }: { compact?: boolean }) {
  const ob = useOutbox(); const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [bundle, setBundle] = useState<Fetched<Bundle> | null>(null); const [daily, setDaily] = useState<Fetched<any> | null>(null);
  const [text, setText] = useState(''); const [msg, setMsg] = useState(''); const [queuedDay, setQueuedDay] = useState('');
  useEffect(() => { fastToken(db).then(setTok); }, [db]);
  useEffect(() => { if (tok === null) return; (async () => { const [b, d] = await Promise.all([tok ? getJson<Bundle>('/api/pocket?view=bundle', tok) : Promise.resolve(null), getJson<any>('/api/daily', tok)]); setBundle(b); setDaily(d); })(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tok, ob.online]);
  const queuedDaily = ob.items.find(i => i.kind === 'daily');
  const queue = async () => {
    const day = daily?.data?.day; if (!day) return; if (text.trim().length < MIN_RESPONSE_CHARS) { setMsg(`اكتب ${MIN_RESPONSE_CHARS} حرفًا على الأقل`); return; }
    const r = await ob.enqueue('daily', { day, response: text.trim(), title: daily?.data?.case?.title_ar || '' }); if (!r.ok) { setMsg(r.reason_ar || 'تعذّر الحفظ'); return; }
    setQueuedDay(day); setText(''); setMsg(ob.online ? 'حُفظ وسيُرسل الآن.' : 'حُفظ في صندوق الأدلة — سيُقوَّم حين يعود الاتصال، وبتاريخ كتابته.');
  };
  const b = bundle?.data; const dc = daily?.data; const mineDone = !!dc?.mine || !!queuedDaily || (queuedDay && queuedDay === dc?.day);
  return (
    <div className="pk" dir="rtl" data-testid="pocket-home">
      <style dangerouslySetInnerHTML={{ __html: `.pk{display:grid;gap:14px;max-width:860px;margin:0 auto}.pk .st{font-size:12px;border-radius:999px;padding:3px 10px;display:inline-flex;gap:6px;align-items:center}.pk .st.on{background:#dcfce7;color:#166534}.pk .st.off{background:#fef3c7;color:#92400e}.pk .card{border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;background:#fff}.pk h3{margin:0 0 8px;display:flex;gap:8px;align-items:center;color:#0f2a4e;font-size:16px}.pk .row{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px dashed #e2e8f0;font-size:14px}.pk .lv{display:flex;flex-wrap:wrap;gap:6px}.pk .lv span{background:#f1f5f9;border-radius:999px;padding:3px 10px;font-size:13px}.pk .lv span b{color:#0b8a83}.pk textarea{width:100%;min-height:120px;border:1px solid #cbd5e1;border-radius:12px;padding:10px;font:inherit;line-height:1.8}.pk .b{background:#0f2a4e;color:#fff;border:0;border-radius:999px;padding:8px 16px;font-weight:700;cursor:pointer;font-family:inherit}.pk .b.g{background:#0b8a83}.pk .b.x{background:#f1f5f9;color:#334155}.pk .muted{color:#64748b;font-size:13px;line-height:1.8}.pk .err{color:#b91c1c;font-size:12px}` }} />
      {!compact && <div className="card" style={{ background: 'linear-gradient(135deg,#0f2a4e,#0b8a83)', color: '#fff', border: 0 }}>
        <h3 style={{ color: '#fff' }}><Icon name="shield" size={18} /> أَثَر في الجيب</h3>
        <p style={{ margin: 0, lineHeight: 1.9, fontSize: 14 }}>هذه الشاشة تعمل من جهازك. <span className={`st ${ob.online ? 'on' : 'off'}`} data-testid="net-state">{ob.online ? 'متصل' : 'بلا اتصال'}</span> {ob.lastSync ? <span style={{ opacity: .85, fontSize: 12 }}>· آخر مزامنة {new Date(ob.lastSync).toLocaleString('ar-SA')}</span> : null}</p>
      </div>}

      {/* المحفظة محليًا */}
      <div className="card" data-testid="local-wallet">
        <h3><Icon name="shield" size={18} /> محفظتي السيادية — نسخة الجهاز</h3>
        {tok === '' && <p className="muted">سجّل الدخول (مع اتصال) مرة واحدة لتُحفظ محفظتك على هذا الجهاز. <Link href="/login">تسجيل الدخول</Link></p>}
        {tok && !bundle && <p className="muted">…</p>}
        {tok && bundle && !b && <p className="muted" data-testid="wallet-none">{bundle.status === 503 ? 'لا نسخة محلية بعد — افتح أَثَر مرة مع اتصال وستُحفظ محفظتك هنا تلقائيًا.' : 'تعذّر تحميل المحفظة.'}</p>}
        {b && <>
          <p className="muted" data-testid="wallet-line">{offlineLine(bundle?.stale ? bundle.cachedAt : null, ob.online)}</p>
          <div className="lv">{b.levels.slice(0, 8).map(l => <span key={l.code}>{l.name_ar} <b>{LEVEL_NAME_AR[Math.round(l.level)] || l.level}</b>{l.approved ? ' ✓' : ''}</span>)}{!b.levels.length && <span>لا مستويات بعد</span>}</div>
          {b.issuances.filter(i => !i.revoked_at).slice(0, 6).map(i => <div className="row" key={i.id}><span>{i.kind === 'snapshot' ? 'لقطة قدرة' : (i.title_ar || 'شهادة')}</span><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>{i.code}</span></div>)}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}><Link href="/me/card" className="b g" style={{ textDecoration: 'none' }}>بطاقة قدرتي</Link><Link href="/me/twin" className="b x" style={{ textDecoration: 'none' }}>المحفظة الكاملة</Link></div>
        </>}
      </div>

      {/* موقف اليوم محليًا */}
      <div className="card" data-testid="local-daily">
        <h3><Icon name="compass" size={18} /> موقف اليوم — من جهازك</h3>
        {!daily && <p className="muted">…</p>}
        {daily && !dc && <p className="muted">لا نسخة محلية من موقف اليوم. افتح الصفحة الرئيسية مرة مع اتصال.</p>}
        {dc && <>
          <p className="muted">{dc.day} · {daily?.stale ? `نسخة محلية (${offlineLine(daily.cachedAt, ob.online)})` : 'حيّ'}</p>
          <div style={{ fontWeight: 700, color: '#0f2a4e', marginBottom: 6 }}>{dc.case?.title_ar}</div>
          <p style={{ lineHeight: 1.9, margin: '0 0 8px', fontSize: 14 }}>{dc.case?.situation_ar}</p>
          {dc.case?.ask_ar && <p style={{ lineHeight: 1.9, margin: '0 0 8px', fontSize: 14, color: '#0b8a83' }}>{dc.case.ask_ar}</p>}
          {mineDone ? <p className="muted" data-testid="daily-done">{dc.mine ? 'رددتَ على موقف اليوم ✓' : 'ردّك محفوظ في صندوق الأدلة وسيُقوَّم حين يعود الاتصال ✓'}</p> : tok ? <>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="كيف تتصرّف فعلًا؟ اكتب بصدق — سيُقوَّم ردّك بتاريخ كتابته حين يعود الاتصال" data-testid="daily-offline-text" />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}><button className="b" onClick={queue} data-testid="daily-offline-send">{ob.online ? 'أرسل ردّي' : 'احفظ في صندوق الأدلة'}</button><span className="muted">{text.trim().length}/{MIN_RESPONSE_CHARS}+</span>{msg && <span className="muted" data-testid="daily-offline-msg">{msg}</span>}</div>
          </> : <p className="muted">سجّل الدخول ليُحفظ ردّك.</p>}
        </>}
      </div>

      {/* الصندوق */}
      <div className="card" id="outbox" data-testid="outbox">
        <h3><Icon name="inbox" size={18} /> صندوق الأدلة الميداني <span className="st on" style={{ background: '#f1f5f9', color: '#334155' }}>{ob.count}</span></h3>
        {!ob.supported && <p className="err">هذا المتصفح لا يدعم الحفظ بلا اتصال.</p>}
        {ob.count === 0 && <p className="muted">فارغ — كل ما التقطته وصل. ما تكتبه أو تصوّره بلا اتصال يظهر هنا مشفَّرًا على جهازك حتى يُرسل.</p>}
        {ob.items.map(i => <div className="row" key={i.id} data-testid="outbox-item"><span>{OUTBOX_LABEL[i.kind]?.ar || i.kind}{i.payload.title ? ` · ${i.payload.title}` : ''}{i.payload._has_file ? ' · 📎' : ''}<br /><span className="muted">{new Date(i.captured_at).toLocaleString('ar-SA')}{i.tries ? ` · محاولات ${i.tries}` : ''}{i.last_error ? <span className="err"> · {i.last_error}</span> : null}</span></span><button className="b x" onClick={() => { if (confirm('حذف هذا العنصر من الصندوق نهائيًا؟')) ob.remove(i.id); }} aria-label="حذف">×</button></div>)}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>{ob.count > 0 && <button className="b g" onClick={() => ob.sync()} disabled={!ob.online || ob.syncing} data-testid="outbox-sync">{ob.syncing ? 'جارٍ الإرسال…' : ob.online ? 'أرسل الآن' : 'بانتظار الاتصال'}</button>}<Link href="/share" className="b x" style={{ textDecoration: 'none' }}>أضف صورة/تسجيلًا كدليل</Link></div>
        {ob.lastReport && <p className="muted" data-testid="outbox-report">{ob.lastReport}</p>}
      </div>
      {!compact && <p className="muted" style={{ textAlign: 'center' }}>الأدلة تُشفَّر على جهازك بمفتاح لا يغادره، وتُمسح عند تسجيل الخروج. <Link href="/">الصفحة الرئيسية</Link></p>}
    </div>
  );
}
