'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /me/access — «أَثَر يلبّي احتياجاتي» (P32 أَثَر للجميع): ملفي الكامل — الاحتياجات بكلماتي · «ما يساعدني» · هل يراه الطاقم عند تنسيق برنامج ·
 *  ماذا يتغيّر فعلًا لكل احتياج · حذف فوري. خاص بصاحبه (RLS)، لا يُرسل إلى أي نموذج ذكاء اصطناعي.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { useAccess } from '../../components/Inclusion';
import { fastToken } from '../../components/Pocket';
import { supabase } from '../../../lib/supabase/client';
import { NEEDS, NEED_LABEL, NEED_EFFECT_AR, PRIVACY_ACCESS_AR, ACCESS_HELPS_MAX } from '../../../lib/inclusion/registry';
import type { Need } from '../../../lib/inclusion/registry';

type Profile = { needs: Need[]; helps_ar: string | null; share_staff: boolean; updated_at: string };
const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium' }) : '—');

export default function AccessPage() { return <PortalShell><Inner /></PortalShell>; }

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const a = useAccess(); const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [p, setP] = useState<Profile | null>(null); const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<Need[]>([]); const [helps, setHelps] = useState(''); const [share, setShare] = useState(false); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); }, [db]);
  useEffect(() => {
    if (!tok) { if (tok === '') { setDraft(a.needs); setLoaded(true); } return; }
    fetch('/api/inclusion?mine=1', { headers: { Authorization: `Bearer ${tok}` }, cache: 'no-store' }).then(r => r.json()).then(j => { if (j?.success && j.profile) { setP(j.profile); setDraft(j.profile.needs || []); setHelps(j.profile.helps_ar || ''); setShare(!!j.profile.share_staff); } else setDraft(a.needs); setLoaded(true); }).catch(() => setLoaded(true));
  }, [tok]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (n: Need) => setDraft(d => (d.includes(n) ? d.filter(x => x !== n) : [...d, n]));
  async function save() {
    setBusy(true); setErr(''); setMsg('');
    if (!tok) { a.setNeeds(draft); setMsg(ar ? 'طُبِّق على هذا الجهاز. سجّل الدخول ليتبعك على كل جهاز.' : 'Applied on this device.'); setBusy(false); return; }
    const e = await a.saveToAccount(draft, { helps_ar: helps.trim(), share_staff: share }); if (e) setErr(e); else { setMsg(ar ? 'حُفظ. البوابة تلبّي احتياجاتك الآن على كل جهاز تدخل منه.' : 'Saved.'); setP(x => ({ needs: draft, helps_ar: helps.trim() || null, share_staff: share, updated_at: new Date().toISOString(), ...(x || {}) })); }
    setBusy(false);
  }
  async function remove() {
    if (!confirm(ar ? 'يُحذف ملفك فورًا من حسابك ومن هذا الجهاز. متابعة؟' : 'Delete your profile now?')) return;
    setBusy(true); setErr('');
    try { if (tok) await fetch('/api/inclusion', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'delete' }) }); } catch { /* ignore */ }
    a.setNeeds([]); setDraft([]); setHelps(''); setShare(false); setP(null); setMsg(ar ? 'حُذف ملفك.' : 'Deleted.'); setBusy(false);
  }
  return (
    <main className="pt-main ax-page" dir={ar ? 'rtl' : 'ltr'}><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="ax-ph"><span className="pt-kicker"><Icon name="users" size={14} /> {ar ? 'أَثَر للجميع' : 'Athar for all'}</span><h1>{ar ? 'أَثَر يلبّي احتياجاتي' : 'Athar meets my needs'}</h1>
        <p>{ar ? 'لا بوابة منفصلة لأحد. تقول ما يساعدك بكلماتك، وتتكيّف البوابة نفسها: الحجم، التباين، الوقت، الترجمة الحيّة، اللغة الأبسط. لا نسأل عن سبب، ولا نطلب وثيقة، ولا نرسل هذا إلى أي ذكاء اصطناعي.' : 'No separate portal for anyone. Say what helps you, in your words, and the same portal adapts.'}</p></header>
      {!loaded && <section className="pt-box"><p className="pt-muted">{ar ? 'نقرأ ملفك…' : 'Loading…'}</p></section>}
      {loaded && (<>
        {tok === '' && <section className="pt-box ax-note" data-testid="ax-anon"><p>{ar ? 'أنت غير مسجَّل: اختياراتك تُحفظ على هذا الجهاز فقط. ' : 'Not signed in: choices are saved on this device only. '}<Link href="/login?next=/me/access">{ar ? 'سجّل الدخول' : 'Sign in'}</Link>{ar ? ' ليتبعك ملفك على كل جهاز.' : ''}</p></section>}
        <section className="pt-box" aria-labelledby="ax-h1">
          <h2 id="ax-h1">{ar ? 'ما يساعدني' : 'What helps me'}</h2>
          <ul className="ax-grid">{NEEDS.map(n => <li key={n}><label><input type="checkbox" checked={draft.includes(n)} onChange={() => toggle(n)} data-testid={`axp-need-${n}`} /><span><b>{NEED_LABEL[n][lang]}</b><small>{ar ? 'ماذا يتغيّر: ' : 'What changes: '}{NEED_EFFECT_AR[n]}</small></span></label></li>)}</ul>
          <label className="ax-helps">{ar ? 'بكلماتي — ما يساعدني أكثر (اختياري)' : 'In my words (optional)'}<textarea rows={3} maxLength={ACCESS_HELPS_MAX} value={helps} onChange={e => setHelps(e.target.value)} placeholder={ar ? 'مثال: أفضّل أن تُرسل لي المواد قبل اللقاء بيوم · أحتاج مقعدًا قرب الباب' : ''} data-testid="axp-helps" /><small>{helps.length}/{ACCESS_HELPS_MAX}</small></label>
          <label className="ax-share"><input type="checkbox" checked={share} onChange={e => setShare(e.target.checked)} data-testid="axp-share" /><span><b>{ar ? 'اسمح للطاقم برؤية هذا عند تنسيق برنامج ألتحق به' : 'Let staff see this when coordinating a program I join'}</b><small>{ar ? 'يراه منسّق البرنامج مجمَّعًا بلا اسمك ولا بريدك، ليجهّز القاعة والمواد والمترجم. بدون هذا الإذن لا يراه أحد غيرك.' : 'Shown to the coordinator aggregated, without your name or email.'}</small></span></label>
          <div className="ax-actions">
            <button type="button" className="pt-btn gold" onClick={save} disabled={busy} data-testid="axp-save">{tok ? (ar ? 'احفظ في حسابي' : 'Save to my account') : (ar ? 'طبّق على هذا الجهاز' : 'Apply on this device')}</button>
            {(p || draft.length > 0) && <button type="button" className="pt-btn ghost" onClick={remove} disabled={busy} data-testid="axp-delete">{ar ? 'احذف ملفي' : 'Delete my profile'}</button>}
          </div>
          {msg && <p className="ax-ok" role="status" data-testid="axp-msg">{msg}</p>}{err && <p className="ax-err" role="alert">{err}</p>}
          {p && <p className="pt-muted" style={{ marginTop: 8 }}>{ar ? `آخر تحديث: ${fmt(p.updated_at)}` : `Updated: ${fmt(p.updated_at)}`}</p>}
        </section>
        <section className="pt-box" aria-labelledby="ax-h2">
          <h2 id="ax-h2"><Icon name="shield" size={18} /> {ar ? 'ما نعد به' : 'Our promise'}</h2>
          <ul className="ax-privacy">{PRIVACY_ACCESS_AR.map((x, i) => <li key={i}>{x}</li>)}</ul>
          <p className="pt-muted">{ar ? <>البيان الكامل في <Link href="/accessibility">بيان الوصول</Link> · بياناتك كلها في <Link href="/me/data">خزنة أَثَر</Link>.</> : <Link href="/accessibility">Accessibility statement</Link>}</p>
        </section>
      </>)}
    </main>
  );
}

const CSS = `
.ax-page{max-width:900px;margin:0 auto;padding:28px 18px 60px}.ax-ph h1{margin:6px 0 8px;font-size:30px;color:#0f2a4e}.ax-ph p{color:#334155;line-height:1.9;margin:0 0 18px;font-size:16px}
.ax-page .pt-box{margin-bottom:16px}.ax-page h2{font-size:19px;color:#0f2a4e;margin:0 0 12px;display:flex;align-items:center;gap:8px}
.ax-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px}
.ax-grid label{display:flex;gap:10px;align-items:flex-start;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px;cursor:pointer;min-height:44px;height:100%}.ax-grid label:has(input:checked){border-color:#0b6f69;background:#f0fbfa}
.ax-grid input,.ax-share input{width:22px;height:22px;flex:0 0 auto;accent-color:#0b6f69;margin-top:2px}.ax-grid b,.ax-share b{display:block;color:#0f2a4e}.ax-grid small,.ax-share small{display:block;color:#475569;line-height:1.65;margin-top:3px}
.ax-helps{display:block;margin-top:16px;font-weight:800;color:#0f2a4e}.ax-helps textarea{display:block;width:100%;margin-top:6px;border:1.5px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-weight:400;min-height:44px}.ax-helps small{font-weight:400;color:#475569}
.ax-share{display:flex;gap:10px;align-items:flex-start;margin-top:14px;border:1.5px dashed #cbd5e1;border-radius:12px;padding:12px;cursor:pointer}
.ax-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.ax-ok{color:#0b6f69;font-weight:800;margin:10px 0 0}.ax-err{color:#b91c1c;font-weight:800;margin:10px 0 0}
.ax-privacy{margin:0;padding-inline-start:20px;line-height:1.9;color:#334155}.ax-note p{margin:0;line-height:1.8}
`;
