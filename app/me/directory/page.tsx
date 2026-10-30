'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /me/directory — «سيرتك توثّقها بنفسك، وشهادة توثيقها أَثَر» (P31 هيئة أَثَر): سيرتي الذاتية الكاملة بكلماتي —
 *  الوجه (خبير استشاري · مدرب) · الهوية والصورة (إلزامية بموافقة مؤرَّخة) · الملخص · أبرز الإنجازات · المؤهلات · الخبرات · الشهادات · المنشورات
 *  · مجالات الخبرة من مهارات أَثَر · القطاعات · الخدمات · النمط · التغطية · مفاتيح الظهور لكل قسم · «ما شهده أَثَر» (قراءة فقط) · «مهامي مع أَثَر» (عقود التعاون ATH-CO: توقيع · تعديل مرة · اعتذار).
 *  الحفظ مسودةً متى شئت؛ الإرسال للاعتماد حين تكتمل؛ بعد الاعتماد تبقى صفحتك ظاهرة وتعديلاتك تذهب للمراجعة.
 *  WCAG 2.2 AA: كل حقل بعنوان مرئي · أخطاء بنص وربط aria · لا رسائل تختفي بمؤقّت · تركيز مرئي · أزرار بنص · حجم الصورة ونوعها مذكوران قبل الرفع.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell } from '../../components/PortalShell';
import { fastToken } from '../../components/Pocket';
import { supabase } from '../../../lib/supabase/client';
import { Avatar, fmtD, nameMap, CSS as DR_CSS } from '../../components/Directory';

type Row = Record<string, string>;
type Form = { faces: string[]; name_ar: string; name_en: string; title_ar: string; title_en: string; city: string; languages: string[]; summary_ar: string; achievements: string[]; education: Row[]; experience: Row[]; certifications: Row[]; publications: Row[]; skill_ids: string[]; sectors: string[]; services: string[]; modes: string[]; coverage: string; visibility: Record<string, boolean>; witness_hidden: boolean };
const EMPTY: Form = { faces: [], name_ar: '', name_en: '', title_ar: '', title_en: '', city: '', languages: ['ar'], summary_ar: '', achievements: [], education: [], experience: [], certifications: [], publications: [], skill_ids: [], sectors: [], services: [], modes: [], coverage: '', visibility: {}, witness_hidden: false };
const fromProfile = (p: any): Form => ({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).filter(k => p?.[k] != null).map(k => [k, p[k]])), name_en: p?.name_en || '', title_en: p?.title_en || '', city: p?.city || '', coverage: Array.isArray(p?.coverage) ? p.coverage.join('، ') : '', visibility: p?.visibility || {} });
const toggle = (arr: string[], v: string, max = 99) => (arr.includes(v) ? arr.filter(x => x !== v) : arr.length >= max ? arr : [...arr, v]);
const ROWS: { key: keyof Form; title: string; icon: any; cols: { k: string; l: string; w?: number }[]; max: number }[] = [
  { key: 'education', title: 'المؤهلات العلمية', icon: 'school', cols: [{ k: 'degree', l: 'الدرجة' }, { k: 'field', l: 'التخصص' }, { k: 'institution', l: 'الجامعة/المؤسسة' }, { k: 'year', l: 'السنة', w: 90 }], max: 8 },
  { key: 'experience', title: 'الخبرات العملية', icon: 'trend', cols: [{ k: 'role', l: 'الدور' }, { k: 'organization', l: 'الجهة' }, { k: 'from', l: 'من', w: 90 }, { k: 'to', l: 'إلى (أو فارغ = الآن)', w: 120 }, { k: 'line', l: 'سطر يصفها' }], max: 15 },
  { key: 'certifications', title: 'الشهادات المهنية', icon: 'certificate', cols: [{ k: 'name', l: 'الشهادة' }, { k: 'issuer', l: 'الجهة المانحة' }, { k: 'year', l: 'السنة', w: 90 }, { k: 'number', l: 'رقمها (للطاقم فقط)' }], max: 15 },
  { key: 'publications', title: 'المنشورات والأعمال', icon: 'book', cols: [{ k: 'title', l: 'العنوان' }, { k: 'type', l: 'النوع (كتاب · ورقة · دليل…)' }, { k: 'year', l: 'السنة', w: 90 }, { k: 'url', l: 'رابط (اختياري)' }], max: 20 },
];

export default function Page() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const db = useMemo(() => supabase(), []); const [tok, setTok] = useState<string | null>(null);
  const [d, setD] = useState<any>(null); const [f, setF] = useState<Form>(EMPTY); const [dirty, setDirty] = useState(false); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
  const [photoConsent, setPhotoConsent] = useState(false); const [note, setNote] = useState<Record<string, string>>({});
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); }, [db]);
  const load = useCallback(async (t: string) => { const j = await fetch('/api/directory?mine=1', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null); if (j?.success) { setD(j); setF(fromProfile(j.profile || j.prefill)); setDirty(false); setErr(''); } else setErr(j?.error || 'تعذّر التحميل'); }, []);
  useEffect(() => { if (tok) load(tok); }, [tok, load]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF(x => ({ ...x, [k]: v })); setDirty(true); };
  async function act(body: any): Promise<any> { setBusy(body.action); setErr(''); setMsg(''); const j = await fetch('/api/directory', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null); setBusy(''); if (!j?.success) { setErr(j?.error || 'تعذّر'); return null; } if (j.message_ar) setMsg(j.message_ar); if (tok) await load(tok); return j; }
  const save = () => act({ action: 'save', ...f, coverage: f.coverage.split(/[،,]/).map(s => s.trim()).filter(Boolean) });
  async function onPhoto(file: File | undefined) { if (!file) return; if (file.size > (d?.rules.photo_max_bytes || 2097152)) { setErr('حجم الصورة حتى 2 ميجابايت'); return; } const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(file); }); await act({ action: 'photo', file_b64: b64, file_type: file.type, consent: photoConsent }); }
  if (tok === '') return <main className="dr" dir="rtl"><style dangerouslySetInnerHTML={{ __html: DR_CSS + CSS }} /><p className="dr-err" role="alert">سجّل الدخول لتفتح سيرتك في هيئة أَثَر.</p><p><Link href="/me" className="pt-btn ghost small">حسابي</Link></p></main>;
  if (!d) return <main className="dr" dir="rtl"><style dangerouslySetInnerHTML={{ __html: DR_CSS + CSS }} /><p className="dr-count" role="status">{err || 'جارٍ فتح سيرتك…'}</p></main>;
  const p = d.profile; const rules = d.rules; const st: string = p?.status || 'none'; const issues: string[] = p?.issues || [];
  const skillsByDomain = (d.skills as any[]).reduce((m: Record<string, any[]>, s) => { (m[s.domain_ar || s.domain || 'عام'] ||= []).push(s); return m; }, {} as Record<string, any[]>);
  const sectorName = nameMap(d.sectors);
  return (
    <main className="dr me" dir="rtl" data-testid="me-directory"><style dangerouslySetInnerHTML={{ __html: DR_CSS + CSS }} />
      <header className="dr-hero">
        <span className="pt-kicker"><Icon name="users" size={14} /> هيئة أَثَر · {rules.tagline_ar}</span>
        <h1>سيرتي في هيئة أَثَر</h1>
        <p>اكتب سيرتك بكلماتك، وأَثَر يضع بجانبها ما شهده لك من سجلاته. يراجعها الطاقم ويعتمدها بشهادة توثيق موقَّعة؛ ثم تُدرَج في <Link href="/experts">هيئة الخبراء</Link> و/أو <Link href="/trainers">هيئة المدربين</Link>. لا يظهر بريدك ولا هاتفك لأحد.</p>
      </header>
      {/* الحالة */}
      <section className={`me-status s-${st}`} aria-labelledby="st-h" data-testid="me-status">
        <h2 id="st-h"><Icon name={st === 'approved' ? 'certificate' : 'flag'} size={16} /> {p ? rules.status_ar[st] : 'لم تبدأ سيرتك بعد'}{d.summary.legacy_trainer && <span className="dr-chip svc">مدرب في منصة أَثَر للتقييم — عبّأنا لك البداية</span>}</h2>
        {p?.staff_note_ar && <p className="me-staffnote"><b>ملاحظة الطاقم:</b> {p.staff_note_ar}</p>}
        {st === 'approved' && p.meta?.review_pending && <p className="dr-muted">تعديلاتك الأخيرة بانتظار مراجعة الطاقم — صفحتك المعتمدة باقية كما هي حتى تُراجَع.</p>}
        {issues.length > 0 && st !== 'approved' && <div><p className="dr-muted">قبل الإرسال للاعتماد:</p><ul className="me-issues" data-testid="me-issues">{issues.map((i: string) => <li key={i}><Icon name="alert" size={12} /> {i}</li>)}</ul></div>}
        <div className="me-cards">{(['expert', 'trainer'] as const).map(face => p?.[`card_${face}`] && <p key={face} className="dr-cert"><Icon name="certificate" size={14} /> شهادة {rules.faces_ar[face]} <b dir="ltr">{p[`card_${face}`].code}</b> · {fmtD(p[`card_${face}`].issued_at)} · <a href={`/verify/vc?code=${encodeURIComponent(p[`card_${face}`].code)}`}>تحقّق</a></p>)}</div>
        <div className="me-btns">
          {d.public_url && <a className="pt-btn gold small" href={d.public_url}><Icon name="globe" size={14} /> صفحتي العامة</a>}
          {p && ['draft', 'changes_requested'].includes(st) && <button className="pt-btn small" disabled={!!busy || dirty || !p.can_submit} onClick={() => act({ action: 'submit' })} data-testid="me-submit"><Icon name="send" size={14} /> أرسل للاعتماد</button>}
          {dirty && <span className="dr-muted">احفظ أولًا</span>}
          {st === 'approved' && p.listed && <button className="pt-btn ghost small" disabled={!!busy} onClick={() => act({ action: 'withdraw' })}>اسحب صفحتي مؤقتًا</button>}
          {st === 'approved' && !p.listed && <button className="pt-btn small" disabled={!!busy} onClick={() => act({ action: 'relist' })}>أعد صفحتي إلى الدليل</button>}
        </div>
      </section>
      {msg && <p className="dr-ok" role="status" data-testid="me-msg">{msg} <button className="me-x" onClick={() => setMsg('')} aria-label="إغلاق الرسالة">×</button></p>}
      {err && <p className="dr-err" role="alert" data-testid="me-err">{err} <button className="me-x" onClick={() => setErr('')} aria-label="إغلاق الرسالة">×</button></p>}

      <form className="me-form" onSubmit={e => { e.preventDefault(); save(); }}>
        <section className="me-sec" aria-labelledby="h-id"><h2 id="h-id"><Icon name="users" size={16} /> الوجه والهوية</h2>
          <fieldset className="dr-fs"><legend>أنا في الهيئة بصفة</legend>{(['expert', 'trainer'] as const).map(fc => <label key={fc}><input type="checkbox" checked={f.faces.includes(fc)} onChange={() => set('faces', toggle(f.faces, fc))} data-testid={`me-face-${fc}`} /> {rules.faces_ar[fc]}</label>)}</fieldset>
          <div className="me-grid2">
            <label className="dr-lbl">الاسم بالعربية *<input className="dr-in" value={f.name_ar} onChange={e => set('name_ar', e.target.value)} maxLength={120} required data-testid="me-name" /></label>
            <label className="dr-lbl">الاسم بالإنجليزية (يُشتقّ منه عنوان صفحتك)<input className="dr-in" dir="ltr" value={f.name_en} onChange={e => set('name_en', e.target.value)} maxLength={120} /></label>
            <label className="dr-lbl">اللقب المهني *<input className="dr-in" value={f.title_ar} onChange={e => set('title_ar', e.target.value)} maxLength={120} placeholder="مثال: مستشار تطوير مؤسسي · مدرب معتمد في الجودة" required data-testid="me-title" /></label>
            <label className="dr-lbl">اللقب بالإنجليزية<input className="dr-in" dir="ltr" value={f.title_en} onChange={e => set('title_en', e.target.value)} maxLength={120} /></label>
            <label className="dr-lbl">المدينة<input className="dr-in" value={f.city} onChange={e => set('city', e.target.value)} maxLength={60} placeholder="المدينة المنورة" /></label>
            <div className="dr-lbl">اللغات<div className="me-chips">{rules.languages.map((l: any) => <button type="button" key={l.code} className={`me-chip ${f.languages.includes(l.code) ? 'on' : ''}`} aria-pressed={f.languages.includes(l.code)} onClick={() => set('languages', toggle(f.languages, l.code, 5))}>{l.name_ar}</button>)}</div></div>
          </div>
        </section>

        <section className="me-sec" aria-labelledby="h-photo"><h2 id="h-photo"><Icon name="star" size={16} /> الصورة الشخصية <small>إلزامية للاعتماد</small></h2>
          <div className="me-photo">
            <Avatar src={d.photo_preview_url || d.photo_url} name={f.name_ar || '؟'} size={120} />
            <div>
              <p className="dr-muted">صورة واضحة للوجه · JPEG أو PNG أو WebP · حتى 2 ميجابايت. تُحفظ في مخزن خاص، ولا تُنشر إلا بعد موافقتك المؤرَّخة واعتماد الطاقم.</p>
              {!p ? <p className="dr-muted"><b>احفظ سيرتك أولًا</b> ثم ارفع الصورة.</p> : (<>
                <label className="me-consent"><input type="checkbox" checked={photoConsent} onChange={e => setPhotoConsent(e.target.checked)} data-testid="me-consent" /> أوافق على ظهور صورتي في دليل هيئة أَثَر العام (تُسجَّل الموافقة بتاريخ اليوم)</label>
                <label className="pt-btn ghost small me-file"><Icon name="plus" size={14} /> {p.photo_path ? 'استبدل الصورة' : 'ارفع الصورة'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => onPhoto(e.target.files?.[0])} disabled={!!busy} data-testid="me-photo-file" /></label>
                {p.photo_path && !p.photo_consent_at && <button type="button" className="pt-btn small" disabled={!!busy} onClick={() => act({ action: 'photo_consent', consent: true })} data-testid="me-consent-btn">سجّل موافقتي على ظهور الصورة</button>}
                {p.photo_consent_at && <p className="dr-ok" style={{ margin: '6px 0 0' }} data-testid="me-consent-ok">موافقتك مسجَّلة بتاريخ {fmtD(p.photo_consent_at)}</p>}
              </>)}
            </div>
          </div>
        </section>

        <section className="me-sec" aria-labelledby="h-sum"><h2 id="h-sum"><Icon name="doc" size={16} /> ملخص السيرة * <small>{f.summary_ar.length} / {rules.summary_max} · {rules.summary_min} حرفًا على الأقل</small></h2>
          <textarea className="dr-in" rows={6} value={f.summary_ar} onChange={e => set('summary_ar', e.target.value.slice(0, rules.summary_max))} aria-label="ملخص السيرة" placeholder="من أنت مهنيًّا، وما الذي تحسنه، ولمن عملت، وما الذي يميّز طريقتك — بكلماتك." data-testid="me-summary" />
        </section>

        <section className="me-sec" aria-labelledby="h-ach"><h2 id="h-ach"><Icon name="award" size={16} /> أبرز الإنجازات <small>حتى {rules.achievements_max} · كلٌّ حتى {rules.achievement_len} حرفًا</small></h2>
          <ul className="me-rows">{f.achievements.map((a, i) => <li key={i}><input className="dr-in" value={a} maxLength={rules.achievement_len} onChange={e => set('achievements', f.achievements.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`الإنجاز ${i + 1}`} /><button type="button" className="me-del" onClick={() => set('achievements', f.achievements.filter((_, j) => j !== i))} aria-label={`حذف الإنجاز ${i + 1}`}><Icon name="trash" size={14} /></button></li>)}</ul>
          {f.achievements.length < rules.achievements_max && <button type="button" className="pt-btn ghost small" onClick={() => set('achievements', [...f.achievements, ''])} data-testid="me-ach-add"><Icon name="plus" size={14} /> أضف إنجازًا</button>}
        </section>

        {ROWS.map(R => (<section key={R.key} className="me-sec" aria-labelledby={`h-${R.key}`}><h2 id={`h-${R.key}`}><Icon name={R.icon} size={16} /> {R.title} <small>حتى {R.max}</small></h2>
          <ul className="me-rows">{(f[R.key] as Row[]).map((row, i) => <li key={i} className="me-rowgrid">{R.cols.map(c => <label key={c.k} className="dr-lbl" style={c.w ? { maxWidth: c.w } : undefined}>{c.l}<input className="dr-in" value={row[c.k] || ''} onChange={e => set(R.key, (f[R.key] as Row[]).map((x, j) => (j === i ? { ...x, [c.k]: e.target.value } : x)) as any)} /></label>)}<button type="button" className="me-del" onClick={() => set(R.key, (f[R.key] as Row[]).filter((_, j) => j !== i) as any)} aria-label={`حذف السطر ${i + 1} من ${R.title}`}><Icon name="trash" size={14} /></button></li>)}</ul>
          {(f[R.key] as Row[]).length < R.max && <button type="button" className="pt-btn ghost small" onClick={() => set(R.key, [...(f[R.key] as Row[]), {}] as any)}><Icon name="plus" size={14} /> أضف</button>}
        </section>))}

        <section className="me-sec" aria-labelledby="h-skills"><h2 id="h-skills"><Icon name="target" size={16} /> مجالات الخبرة * <small>من مهارات أَثَر · حتى {rules.skills_max} · المختار: {f.skill_ids.length}</small></h2>
          {Object.entries(skillsByDomain).map(([dom, list]) => <div key={dom} className="me-dom"><h3>{dom}</h3><div className="me-chips">{(list as any[]).map(s => <button type="button" key={s.id} className={`me-chip ${f.skill_ids.includes(s.id) ? 'on' : ''}`} aria-pressed={f.skill_ids.includes(s.id)} onClick={() => set('skill_ids', toggle(f.skill_ids, s.id, rules.skills_max))} data-testid="me-skill">{s.name_ar}</button>)}</div></div>)}
          <h3>القطاعات * <small>حتى {rules.sectors_max}</small></h3><div className="me-chips">{d.sectors.map((s: any) => <button type="button" key={s.code} className={`me-chip sec ${f.sectors.includes(s.code) ? 'on' : ''}`} aria-pressed={f.sectors.includes(s.code)} onClick={() => set('sectors', toggle(f.sectors, s.code, rules.sectors_max))} data-testid="me-sector">{s.name_ar}</button>)}</div>
          <h3>الخدمات التي أقدّمها *</h3><div className="me-chips">{rules.services.map((s: any) => <button type="button" key={s.code} className={`me-chip svc ${f.services.includes(s.code) ? 'on' : ''}`} aria-pressed={f.services.includes(s.code)} onClick={() => set('services', toggle(f.services, s.code, 6))} data-testid="me-service">{s.name_ar}</button>)}</div>
          <h3>نمط التقديم *</h3><div className="me-chips">{rules.modes.map((m: any) => <button type="button" key={m.code} className={`me-chip ${f.modes.includes(m.code) ? 'on' : ''}`} aria-pressed={f.modes.includes(m.code)} onClick={() => set('modes', toggle(f.modes, m.code))} data-testid="me-mode">{m.name_ar}</button>)}</div>
          <label className="dr-lbl">نطاق التغطية <small>(مدن أو مناطق أو دول، مفصولة بفاصلة)</small><input className="dr-in" value={f.coverage} onChange={e => set('coverage', e.target.value)} placeholder="المدينة المنورة، الرياض، عن بُعد لكل الخليج" /></label>
          <p className="dr-fine">الأجر لا يُكتب هنا — يُتّفق عليه لكل مشروع داخل عقد التعاون مع أَثَر.</p>
        </section>

        <section className="me-sec" aria-labelledby="h-vis"><h2 id="h-vis"><Icon name="shield" size={16} /> ما يظهر للعامة</h2>
          <div className="me-chips">{rules.sections.map((s: any) => { const on = (f.visibility[s.code] ?? s.default) !== false; return <button type="button" key={s.code} className={`me-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => set('visibility', { ...f.visibility, [s.code]: !on })}>{on ? '👁 ' : '— '}{s.name_ar}</button>; })}</div>
          <label className="me-consent"><input type="checkbox" checked={f.witness_hidden} onChange={e => set('witness_hidden', e.target.checked)} /> أخفِ «ما شهده أَثَر» عن صفحتي العامة (يبقى لي وللطاقم)</label>
          <p className="dr-fine">{d.privacy_ar}</p>
        </section>

        <div className="me-savebar"><button type="submit" className="pt-btn" disabled={!!busy} data-testid="me-save"><Icon name="save" size={15} /> {busy === 'save' ? 'جارٍ الحفظ…' : p ? 'احفظ التعديلات' : 'احفظ المسودة'}</button>{dirty && <span className="dr-muted">تعديلات غير محفوظة</span>}</div>
      </form>

      <section className="me-sec witness" aria-labelledby="h-wit"><h2 id="h-wit"><Icon name="check" size={16} /> ما شهده أَثَر <small>قراءة فقط — من سجلات المنصة</small></h2>
        {d.witness.lines.length ? <ul className="dr-witness" data-testid="me-witness">{d.witness.lines.map((l: any) => <li key={l.key}><Icon name="check" size={13} /> {l.text}</li>)}</ul> : <p className="dr-muted">{d.witness.empty_ar}</p>}
      </section>

      <section className="me-sec" aria-labelledby="h-eng"><h2 id="h-eng"><Icon name="scale" size={16} /> مهامي مع أَثَر <small>عقد تعاون على كل مهمة — ATH-CO</small></h2>
        {!d.engagements.length && <p className="dr-muted">حين يقترح أَثَر عليك مهمة، يصلك هنا عقد تعاون بنطاقها ومدتها وأجرها؛ توقّعه أو تطلب تعديلًا واحدًا أو تعتذر. الأجر يراه الطرفان فقط.</p>}
        <ul className="me-engs">{d.engagements.map((e: any) => (<li key={e.id} className={`me-eng s-${e.status}`} data-testid="me-eng">
          <div className="me-enghead"><b>{e.title_ar}</b><span className="dr-chip">{e.kind_ar}</span><span className="dr-chip svc">{e.status_ar}</span></div>
          <p className="me-scope">{e.scope_ar}</p>
          {e.deliverables?.length > 0 && <ul className="dr-list">{e.deliverables.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>}
          <p className="dr-meta"><span><Icon name="calendar" size={12} /> {e.start_at || '—'} → {e.end_at || '—'}</span>{e.mode && <span>{rules.modes.find((m: any) => m.code === e.mode)?.name_ar}</span>}<span><Icon name="scale" size={12} /> الأجر لهذا المشروع: <b>{e.fee_amount} {e.currency}</b> (يراه الطرفان فقط)</span></p>
          {e.terms_ar && <p className="dr-muted"><b>شروط:</b> {e.terms_ar}</p>}
          {e.change_note_ar && <p className="dr-muted"><b>طلب التعديل:</b> {e.change_note_ar}</p>}
          {e.verify_url && <p className="dr-cert"><Icon name="certificate" size={14} /> وثيقة العقد <b dir="ltr">{e.code}</b> · <a href={e.verify_url}>تحقّق</a></p>}
          {e.status === 'proposed' && (<div className="me-engact">
            <button className="pt-btn small" disabled={!!busy} onClick={() => { if (confirm('توقّع باسمك على عقد التعاون هذا، ويوقّع أَثَر بصفته فورًا. متابعة؟')) act({ action: 'engagement', id: e.id, op: 'sign', confirm: true }); }} data-testid="eng-sign"><Icon name="check" size={14} /> أوقّع</button>
            <label className="dr-lbl grow">ملاحظة (للتعديل أو الاعتذار)<input className="dr-in" value={note[e.id] || ''} onChange={ev => setNote({ ...note, [e.id]: ev.target.value })} maxLength={600} data-testid="eng-note" /></label>
            {e.changes_left > 0 && <button className="pt-btn ghost small" disabled={!!busy} onClick={() => act({ action: 'engagement', id: e.id, op: 'change', note_ar: note[e.id] || '', confirm: true })} data-testid="eng-change">أطلب تعديلًا (مرة واحدة)</button>}
            <button className="pt-btn ghost small" disabled={!!busy} onClick={() => { if (confirm('تعتذر عن هذه المهمة؟')) act({ action: 'engagement', id: e.id, op: 'decline', note_ar: note[e.id] || '', confirm: true }); }} data-testid="eng-decline">أعتذر</button>
          </div>)}
        </li>))}</ul>
      </section>
    </main>
  );
}

const CSS = `
.me-status{border:1px solid #cbd5e1;border-radius:18px;padding:14px 16px;margin:14px 0;background:#fff}.me-status h2{margin:0 0 6px;font-size:18px;color:#0f2a4e;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.me-status.s-approved{border-color:#0b8a83;background:#f0fdfa}.me-status.s-submitted{border-color:#c9a24b;background:#fffdf7}.me-status.s-changes_requested{border-color:#f59e0b;background:#fffbeb}.me-status.s-suspended{border-color:#fecaca;background:#fef2f2}
.me-staffnote{background:#fffbeb;border:1px solid #f59e0b;border-radius:12px;padding:8px 12px;color:#78350f;line-height:1.8;margin:6px 0}.me-issues{list-style:none;margin:4px 0;padding:0;display:grid;gap:4px}.me-issues li{display:flex;gap:6px;align-items:center;color:#9a3412;font-size:13.5px}
.me-cards{display:flex;gap:8px;flex-wrap:wrap}.me-btns{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}.me-x{all:unset;cursor:pointer;font-size:18px;line-height:1;padding:2px 8px;border-radius:8px;margin-inline-start:auto}.me-x:hover{background:rgba(0,0,0,.06)}
.me-form{display:grid;gap:12px}.me-sec{border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;background:#fff}.me-sec h2{margin:0 0 8px;font-size:17px;color:#0f2a4e;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.me-sec h2 small,.me-sec h3 small{font-size:12px;color:#475569;font-weight:700}.me-sec h3{margin:10px 0 4px;font-size:14px;color:#0b6f69}.me-sec.witness{background:#f8fafc}
.me-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.me-chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}.me-chip{font:inherit;font-size:13px;font-weight:800;border:1px solid #94a3b8;border-radius:999px;padding:6px 12px;background:#fff;color:#0f2a4e;cursor:pointer;min-height:24px}.me-chip.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.me-chip.sec.on{background:#7c5a12;border-color:#7c5a12}.me-chip.svc.on{background:#0b6f69;border-color:#0b6f69}
.me-dom h3{margin:8px 0 2px}.me-photo{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:start}.me-consent{display:flex;gap:8px;align-items:flex-start;font-size:14px;line-height:1.7;margin:8px 0;color:#1e293b}.me-file{position:relative;overflow:hidden;cursor:pointer}.me-file input{position:absolute;inset:0;opacity:0;cursor:pointer}
.me-rows{list-style:none;margin:0 0 8px;padding:0;display:grid;gap:8px}.me-rows li{display:flex;gap:6px;align-items:flex-end}.me-rows li .dr-in{margin-top:4px}.me-rowgrid{flex-wrap:wrap;border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px}.me-rowgrid .dr-lbl{flex:1 1 160px;font-size:12px}.me-del{font:inherit;border:1px solid #fecaca;background:#fff;color:#991b1b;border-radius:10px;padding:8px;cursor:pointer;min-width:36px;min-height:36px}
.me-savebar{position:sticky;bottom:0;background:rgba(255,255,255,.95);border-top:1px solid #e2e8f0;padding:10px 0;display:flex;gap:12px;align-items:center;z-index:2}
.me-engs{list-style:none;margin:0;padding:0;display:grid;gap:10px}.me-eng{border:1px solid #cbd5e1;border-radius:16px;padding:12px 14px;background:#fff}.me-eng.s-proposed{border-color:#c9a24b;background:#fffdf7}.me-eng.s-active{border-color:#0b8a83;background:#f0fdfa}.me-enghead{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.me-enghead b{color:#0f2a4e;font-size:16px}.me-scope{white-space:pre-wrap;line-height:1.85;color:#1e293b;margin:6px 0}.me-engact{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:10px}.me-engact .grow{flex:1 1 220px}
@media (max-width:760px){.me-grid2{grid-template-columns:1fr}.me-photo{grid-template-columns:1fr}}
`;
