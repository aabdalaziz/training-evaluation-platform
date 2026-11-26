'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P82-د */
/**
 * «بلغة الإشارة» — زرّ يفتح لوحة بأيقونات كبيرة:
 *  1) خطوات أَثَر الخمس برموز؛ لكلّ خطوة فيديو بلغة الإشارة إن وُجد (NEXT_PUBLIC_SIGN_VIDEOS) وإلا نصّ مبسَّط + «قريبًا»
 *  2) «مكالمة فيديو الآن» عبر واتساب (الرقم الرسمي) · 3) «غرفة فيديو + طلب مترجم»: تُنشأ غرفة Jitsi ويُرسل الطلب إلى الفريق (/api/inclusion action=report) فينضمّ المنسّق
 *  يظهر تلقائيًّا لمن اختار «أتواصل بلغة الإشارة»، ويمكن إظهاره دائمًا (always) في صفحات التسجيل والحضور.
 */
import { useEffect, useState } from 'react';
import { Icon } from '../../lib/ui/icons';
import { signSteps, embedUrl, whatsappVideoLink, signRoomUrl, type SignStep } from '../../lib/inclusion/sign';
import { ACCESS_STORAGE_KEY } from '../../lib/inclusion/registry';

export function SignHelpButton({ step, always = false, lang = 'ar', page }: { step?: string; always?: boolean; lang?: 'ar' | 'en'; page?: string }) {
  const [show, setShow] = useState(always); const [open, setOpen] = useState(false);
  useEffect(() => { if (always) return; try { const n = JSON.parse(localStorage.getItem(ACCESS_STORAGE_KEY) || '[]'); if (Array.isArray(n) && n.includes('sign_language')) setShow(true); } catch { /* لا شيء */ } const a = document.documentElement.getAttribute('data-access') || ''; if (a.includes('sign_language')) setShow(true); }, [always]);
  if (!show) return null;
  return <>
    <button type="button" className="sh-btn" onClick={() => setOpen(true)} aria-haspopup="dialog"><span aria-hidden="true">🤟</span> {lang === 'ar' ? 'بلغة الإشارة' : 'Sign language'}</button>
    {open && <SignHelpSheet step={step} lang={lang} page={page || (typeof location !== 'undefined' ? location.pathname : '')} onClose={() => setOpen(false)} />}
    <style>{SH_CSS}</style>
  </>;
}

export function SignHelpSheet({ step, lang, page, onClose }: { step?: string; lang: 'ar' | 'en'; page: string; onClose: () => void }) {
  const ar = lang === 'ar'; const steps = signSteps(); const [cur, setCur] = useState<SignStep | null>(steps.find((s) => s.key === step) || null); const [room, setRoom] = useState<string | null>(null); const [sent, setSent] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const askRoom = async () => {
    const r = room || signRoomUrl(); setRoom(r); setSent('busy');
    try { const res = await fetch('/api/inclusion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'report', page, text: `طلب مساعدة بلغة الإشارة — مكالمة فيديو. الصفحة: ${page}. غرفة الفيديو: ${r} (المستخدم ينتظر فيها الآن).`, contact: null }) }); const j = await res.json().catch(() => null); setSent(j?.success ? 'ok' : 'err'); } catch { setSent('err'); }
    window.open(r, '_blank', 'noopener');
  };
  return (
    <div className="sh-back" role="dialog" aria-modal="true" aria-label={ar ? 'مساعدة بلغة الإشارة' : 'Sign-language help'} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sh-sheet" dir={ar ? 'rtl' : 'ltr'}>
        <div className="sh-head"><b><span aria-hidden="true">🤟</span> {ar ? 'بلغة الإشارة' : 'Sign language'}</b><button type="button" className="sh-x" onClick={onClose} aria-label={ar ? 'إغلاق' : 'Close'}><Icon name="x" size={20} /></button></div>
        {!cur && <>
          <div className="sh-grid">{steps.map((s) => <button key={s.key} type="button" className="sh-tile" onClick={() => setCur(s)}><span className="sh-ico" aria-hidden="true">{s.icon}</span><span>{ar ? s.title_ar : s.title_en}</span>{s.video ? <small>▶ {ar ? 'فيديو' : 'video'}</small> : <small className="sh-soon">{ar ? 'نصّ مبسَّط' : 'text'}</small>}</button>)}</div>
          <div className="sh-call">
            <a className="sh-tile call" href={whatsappVideoLink(page, lang)} target="_blank" rel="noreferrer"><span className="sh-ico" aria-hidden="true">📱</span><span>{ar ? 'مكالمة فيديو الآن (واتساب)' : 'Video call now (WhatsApp)'}</span></a>
            <button type="button" className="sh-tile call" onClick={askRoom} disabled={sent === 'busy'}><span className="sh-ico" aria-hidden="true">🎥</span><span>{ar ? 'غرفة فيديو + طلب مترجم' : 'Video room + interpreter'}</span>{sent === 'ok' && <small>{ar ? 'وصل طلبك — ننضمّ إليك' : 'Request sent'}</small>}{sent === 'err' && <small className="sh-soon">{ar ? 'تعذّر الإرسال — استخدم واتساب' : 'Failed — use WhatsApp'}</small>}</button>
          </div>
          {room && <p className="sh-note" dir="ltr">{room}</p>}
          <p className="sh-note">{ar ? 'الغرف الحيّة فيها مقعد مترجم إشارة مثبَّت وترجمة نصّية حيّة.' : 'Live rooms have a pinned interpreter seat and live captions.'}</p>
        </>}
        {cur && <>
          <button type="button" className="sh-backbtn" onClick={() => setCur(null)}>{ar ? '→ كلّ الخطوات' : '← All steps'}</button>
          <h2 className="sh-title"><span aria-hidden="true">{cur.icon}</span> {ar ? cur.title_ar : cur.title_en}</h2>
          {cur.video ? (() => { const e = embedUrl(cur.video!); return e.kind === 'iframe' ? <iframe className="sh-video" src={e.src} title={cur.title_ar} allow="fullscreen" /> : <video className="sh-video" src={e.src} controls playsInline />; })() : <div className="sh-soon-box">{ar ? 'فيديو لغة الإشارة لهذه الخطوة قريبًا — إليك الخطوات مبسَّطة:' : 'Sign-language video coming soon — simplified steps:'}</div>}
          <ol className="sh-steps">{cur.text_ar.split(/\s(?=[١٢٣٤٥٦٧٨٩][)\s])/).map((t, i) => <li key={i}>{t.replace(/^[١٢٣٤٥٦٧٨٩][)]\s*/, '')}</li>)}</ol>
          <a className="sh-tile call" href={whatsappVideoLink(page + ' — ' + cur.title_ar, lang)} target="_blank" rel="noreferrer"><span className="sh-ico" aria-hidden="true">📱</span><span>{ar ? 'أحتاج مساعدة في هذه الخطوة (فيديو)' : 'Help me with this step (video)'}</span></a>
        </>}
      </div>
    </div>
  );
}

const SH_CSS = `
.sh-btn{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:10px 16px;border-radius:14px;border:2px solid #5EA8A0;background:#fff;color:#22101F;font:inherit;font-weight:800;font-size:16px;cursor:pointer}
.sh-btn:focus-visible{outline:3px solid #D9A866;outline-offset:2px}
.sh-back{position:fixed;inset:0;background:rgba(34,16,31,.72);z-index:1200;display:flex;align-items:flex-end;justify-content:center}
.sh-sheet{width:min(640px,100%);max-height:94vh;overflow:auto;background:#FBF4EE;border-radius:20px 20px 0 0;padding:14px 16px 20px}
@media(min-width:720px){.sh-back{align-items:center;padding:20px}.sh-sheet{border-radius:20px}}
.sh-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.sh-head b{font-size:20px;color:#3A1F36}
.sh-x{min-width:48px;min-height:48px;border:0;background:transparent;color:#3A1F36;cursor:pointer;border-radius:12px}
.sh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.sh-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:120px;padding:12px;border-radius:18px;border:2px solid #e6d5c6;background:#fff;color:#22101F;font:inherit;font-weight:800;font-size:16px;text-align:center;cursor:pointer;text-decoration:none}
.sh-tile:focus-visible{outline:3px solid #D9A866;outline-offset:2px}.sh-tile small{font-weight:600;color:#2e7d6f;font-size:12px}.sh-soon{color:#8a7580!important}
.sh-tile.call{border-color:#5EA8A0;background:#eef7f6;min-height:96px}
.sh-ico{font-size:40px;line-height:1}
.sh-call{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}@media(max-width:480px){.sh-call{grid-template-columns:1fr}}
.sh-note{font-size:13px;color:#6b5560;margin:10px 0 0;word-break:break-all}
.sh-backbtn{border:0;background:transparent;color:#D4614A;font:inherit;font-weight:700;cursor:pointer;padding:6px 0}
.sh-title{font-size:24px;margin:6px 0 10px;color:#22101F}
.sh-video{width:100%;aspect-ratio:16/9;border:0;border-radius:14px;background:#000}
.sh-soon-box{background:#F6EBE0;border-radius:12px;padding:10px 12px;font-size:14px}
.sh-steps{font-size:20px;line-height:1.9;padding-inline-start:26px;margin:12px 0}
`;
