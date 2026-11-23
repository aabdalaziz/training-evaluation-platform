'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// تفضيلات التواصل للمتعلّم (P16 · نبض الوصول): هاتف، موافقة واتساب الصريحة، القناة المفضّلة، ساعات الهدوء — خاصة به، ولا تُستخدم إلا لرسائل أَثَر إليه
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';

type Prefs = { email: string; phone_e164: string | null; whatsapp_opt_in: boolean; preferred_channel: 'whatsapp' | 'email' | 'push'; quiet_from: string | null; quiet_to: string | null; push_ok: boolean };
type Ch = { whatsapp: boolean; email: boolean; email_test: boolean; push: boolean };

export default function ContactPrefs() {
  const db = useMemo(() => supabase(), []);
  const [p, setP] = useState<Prefs | null | undefined>(undefined); const [ch, setCh] = useState<Ch | null>(null); const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(''); const [opt, setOpt] = useState(false); const [pref, setPref] = useState<Prefs['preferred_channel']>('email'); const [qf, setQf] = useState(''); const [qt, setQt] = useState('');
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const hdr = async () => { const { data: s } = await db.auth.getSession(); return { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token || ''}` }; };
  useEffect(() => { (async () => { try {
    const { data: s } = await db.auth.getSession(); if (!s.session) { setP(null); return; }
    const j = await fetch('/api/notify?view=prefs', { headers: await hdr(), cache: 'no-store' }).then(r => r.json());
    if (!j?.success) { setP(null); return; }
    const pr = j.prefs as Prefs; setP(pr); setCh(j.channels || null); setPhone(pr.phone_e164 ? '+' + pr.phone_e164 : ''); setOpt(!!pr.whatsapp_opt_in); setPref(pr.preferred_channel || 'email'); setQf(pr.quiet_from || ''); setQt(pr.quiet_to || '');
  } catch { setP(null); } })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);
  async function save() {
    setBusy(true); setMsg(null);
    const j = await fetch('/api/notify', { method: 'POST', headers: await hdr(), body: JSON.stringify({ action: 'prefs', phone, whatsapp_opt_in: opt, preferred_channel: pref, quiet_from: qf || null, quiet_to: qt || null, push_ok: true }) }).then(r => r.json()).catch(() => null);
    setBusy(false);
    if (!j?.success) { setMsg({ ok: false, text: j?.error || 'تعذّر الحفظ' }); return; }
    setP(j.prefs); setMsg({ ok: true, text: 'حُفظت تفضيلاتك.' });
  }
  if (p === undefined || p === null) return null;
  const summary = p.whatsapp_opt_in && p.phone_e164 ? `واتساب ${'+' + p.phone_e164}` : p.phone_e164 ? 'بريد (الهاتف مسجَّل بلا موافقة واتساب)' : 'بريد فقط';
  return (
    <div className="cp" data-testid="contact-prefs">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <button className="cp-head" onClick={() => setOpen(o => !o)} aria-expanded={open}><span className="cp-ic"><Icon name="bell" size={16} /></span><span className="cp-t"><b>كيف تصلك رسائل أَثَر؟</b><small>الآن: {summary}{p.quiet_from && p.quiet_to ? ` · هدوء ${p.quiet_from}–${p.quiet_to}` : ''}</small></span><Icon name="arrow" size={16} /></button>
      {open && (
        <div className="cp-body">
          <label>رقم الجوال (لواتساب)<input dir="ltr" value={phone} onChange={e => setPhone(e.target.value)} placeholder="05xxxxxxxx أو +9665xxxxxxxx" inputMode="tel" /></label>
          <label className="cp-check"><input type="checkbox" checked={opt} onChange={e => setOpt(e.target.checked)} disabled={!phone.trim()} /> <span>أوافق على استقبال رسائل أَثَر (مهمات، تذكيرات، شهادات) عبر واتساب على هذا الرقم. {ch && !ch.whatsapp && <em>— قناة واتساب لم تُفعَّل بعد في البوّابة؛ ستُستخدم موافقتك فور تفعيلها.</em>}</span></label>
          <label>القناة المفضّلة<select value={pref} onChange={e => setPref(e.target.value as any)}><option value="whatsapp" disabled={!opt}>واتساب</option><option value="email">البريد الإلكتروني</option><option value="push">إشعار المتصفح/الهاتف</option></select></label>
          <div className="cp-row"><label>لا تراسلني من<input type="time" value={qf} onChange={e => setQf(e.target.value)} /></label><label>إلى<input type="time" value={qt} onChange={e => setQt(e.target.value)} /></label></div>
          <p className="cp-note">البريد لا يتأثر بساعات الهدوء؛ تؤجَّل فيها رسائل واتساب والإشعارات فقط. بياناتك خاصة ولا تُشارك مع أي جهة.</p>
          {msg && <div className={`cp-msg ${msg.ok ? 'ok' : 'bad'}`}>{msg.text}</div>}
          <div className="cp-acts"><button className="cp-save" onClick={save} disabled={busy} data-testid="contact-prefs-save"><Icon name="save" size={14} /> {busy ? 'جارٍ الحفظ…' : 'حفظ'}</button><button className="cp-cancel" onClick={() => setOpen(false)}>إغلاق</button></div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.cp{background:#fff;border:1px solid #EADFD6;border-radius:16px;overflow:hidden}
.cp-head{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:12px;width:100%;padding:14px 18px;cursor:pointer;font-family:inherit}.cp-head:hover{background:#FBF4EE}
.cp-ic{width:36px;height:36px;border-radius:50%;background:#E6F3F1;color:#D4614A;display:inline-flex;align-items:center;justify-content:center;flex:none}
.cp-t{display:grid;gap:2px;flex:1}.cp-t b{font-size:15px;color:#3A1F36}.cp-t small{font-size:12px;color:#8E7F8A}
.cp-body{border-top:1px solid #F6EBE0;padding:14px 18px;display:grid;gap:10px}.cp-body label{display:grid;gap:4px;font-size:12px;font-weight:700;color:#5C4858}
.cp-body input,.cp-body select{border:1px solid #D9CBC2;border-radius:10px;padding:9px 12px;font-family:inherit;font-size:14px;color:#2A1626;background:#fff}
.cp-check{display:flex!important;gap:8px;align-items:flex-start;font-weight:500!important;line-height:1.7}.cp-check input{margin-top:4px}.cp-check em{color:#8A5A1E;font-style:normal}
.cp-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cp-note{margin:0;font-size:12px;color:#8E7F8A;line-height:1.7}
.cp-msg{border-radius:10px;padding:8px 12px;font-size:13px}.cp-msg.ok{background:#E6F3F1;color:#1F4F4A}.cp-msg.bad{background:#FBEDE7;color:#9A3A2A}
.cp-acts{display:flex;gap:8px}.cp-save{display:inline-flex;align-items:center;gap:6px;background:#3A1F36;color:#fff;border:0;border-radius:10px;padding:9px 16px;font-weight:800;cursor:pointer;font-family:inherit}.cp-save:disabled{opacity:.6}.cp-cancel{background:none;border:1px solid #D9CBC2;border-radius:10px;padding:9px 14px;font-family:inherit;cursor:pointer;color:#4A3645}
`;
