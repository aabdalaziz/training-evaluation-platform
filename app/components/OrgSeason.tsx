'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P35 «موسم الهواء» داخل تبويب /org?tab=onair:
 *  (1) ساعة الجهة في الموسم: مدير الجهة يعلنها (يوم · وقت الرياض · مدة · إظهار الاسم على الخريطة بإذنه) ويعدّلها ويلغيها قبل الانتهاء؛
 *      بعد الموسم يصدر «وثيقة موسم» موقَّعة ATH-OS باسم الجهة (عدد اللقاءات يُذكر من 5).
 *  (3) «أمانة إلى جهة»: عدد الأمانات في عهدة الجهة الآن (24 ساعة ثم الهواء العام) — التفاصيل لمدير الجهة بلا أسماء.
 *  الصعود يبقى قرار كل منسوب؛ لا تعهّد جماعيًا ولا ترتيب بين الجهات.
 *  P36 «ذاكرة الهواء»: (2) موسم بالإشارة — وسم الساعة «بالإشارة» مع مترجم معتمَد · (4) خريطة الزمن للجهة — شبكة 7×24 واقتراح أنسب ثلاث ساعات يملأ النموذج بضغطة · رابط «سجلّ الموسم» بعد الانتهاء.
 */
import { useState } from 'react';
import { WEEKDAY_AR, P35_NAMES_AR, ORG_HOLD_HOURS, P36_NAMES_AR } from '../../lib/onair/registry';
import { OrgTimeGrid } from './OnAir';   // P36

type Lang = 'ar' | 'en';
export function OrgSeason({ orgId, air, lang, token, onChange }: { orgId: string; air: any; lang: Lang; token: () => Promise<string>; onChange: () => void }) {
  const ar = lang === 'ar'; const s = air?.season || null; const held = air?.held || { n: 0, items: [] }; const isAdmin = !!air?.is_admin;
  const [f, setF] = useState({ weekday: s?.slot?.weekday ?? 2, from: s?.slot ? s.slot.from : '20:00', duration_min: s?.slot?.duration_min ?? 60, public_name: !!s?.slot?.public_name, sign_language: !!s?.slot?.sign_language, interpreter_user_id: String(s?.slot?.interpreter_user_id || '') });
  const interpreters: { user_id: string; name_ar: string }[] = air?.interpreters || []; const [picked, setPicked] = useState('');
  const [busy, setBusy] = useState(false); const [note, setNote] = useState(''); const [err, setErr] = useState('');
  async function post(body: any) {
    setBusy(true); setErr(''); setNote('');
    try { const tk = await token(); const j = await fetch('/api/onair', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ ...body, org_id: orgId }) }).then(r => r.json()); if (!j.success) throw new Error(j.error || 'فشل'); setNote(j.note_ar || (j.verify_url ? `${ar ? 'صدرت الوثيقة' : 'Issued'}: ${j.code}` : '')); onChange(); return j; }
    catch (e: any) { setErr(e?.message || 'فشل'); return null; } finally { setBusy(false); }
  }
  return <div className="ogs" data-testid="org-season" data-phase={s?.phase || 'none'}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h4>❂ {ar ? P35_NAMES_AR.season : 'On-Air Season'}</h4>
    {!s && <p className="pt-muted" data-testid="org-season-none">{ar ? 'لا موسم معلَنًا الآن. حين يعلن طاقم أَثَر موسمًا، يعلن مدير الجهة من هنا ساعتها الذهبية فيه.' : 'No season now.'}</p>}
    {s && <>
      <p className="ogs-head"><b>{s.title_ar}</b> · {s.from_day} → {s.to_day} · <span className={`ogs-ph ${s.phase}`}>{s.phase === 'before' ? (ar ? 'قادم' : 'soon') : s.phase === 'live' ? (ar ? 'جارٍ' : 'live') : (ar ? 'انتهى' : 'ended')}</span>{s.invite_ar ? <> · «{s.invite_ar}»</> : null}</p>
      {s.slot && <p className="ogs-slot" data-testid="org-season-slot">{ar ? <>ساعة جهتكم: <b>{s.slot.weekday_ar} {s.slot.from}</b> · {s.slot.duration_min} دقيقة · {s.slot.public_name ? 'باسم الجهة على خريطة الموسم' : 'بلا اسم على الخريطة'}{s.slot.sign_language ? <> · <span className="ogs-sign" data-testid="org-season-sign">🤟 بالإشارة{s.slot.interpreter_name_ar ? ` — ${s.slot.interpreter_name_ar}` : ''}</span></> : null}{s.meetings ? <> · <b>{s.meetings}</b> لقاءً استقبله منسوبوكم في الموسم</> : null}</> : <>Your hour: {s.slot.weekday_ar} {s.slot.from}</>}</p>}
      {!s.slot && s.phase !== 'after' && <p className="pt-muted" data-testid="org-season-noslot">{ar ? 'لم تعلن جهتكم ساعتها بعد.' : 'No hour announced yet.'}</p>}
      {isAdmin && s.phase !== 'after' && <form className="ogs-form" onSubmit={e => { e.preventDefault(); const [h, m] = f.from.split(':').map(Number); post({ action: 'season_slot', weekday: f.weekday, from_min: (h || 0) * 60 + (m || 0), duration_min: f.duration_min, public_name: f.public_name, sign_language: f.sign_language, interpreter_user_id: f.sign_language ? f.interpreter_user_id || undefined : undefined }); }} data-testid="org-season-form">
        <label>{ar ? 'اليوم' : 'Day'}<select value={f.weekday} onChange={e => setF(x => ({ ...x, weekday: Number(e.target.value) }))} data-testid="org-season-day">{WEEKDAY_AR.map((n, i) => <option key={i} value={i}>{n}</option>)}</select></label>
        <label>{ar ? 'الوقت (الرياض)' : 'Time (Riyadh)'}<input type="time" value={f.from} onChange={e => setF(x => ({ ...x, from: e.target.value }))} data-testid="org-season-from" /></label>
        <label>{ar ? 'المدة' : 'Duration'}<select value={f.duration_min} onChange={e => setF(x => ({ ...x, duration_min: Number(e.target.value) }))}>{[30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{m} {ar ? 'دقيقة' : 'min'}</option>)}</select></label>
        <label className="ogs-chk"><input type="checkbox" checked={f.public_name} onChange={e => setF(x => ({ ...x, public_name: e.target.checked }))} data-testid="org-season-public" /> {ar ? 'أظهر اسم الجهة على خريطة الموسم' : 'Show our name on the season map'}</label>
        <label className="ogs-chk"><input type="checkbox" checked={f.sign_language} onChange={e => setF(x => ({ ...x, sign_language: e.target.checked }))} data-testid="org-season-sign-chk" /> 🤟 {ar ? `${P36_NAMES_AR.signed_season}: ساعتنا بالإشارة — مع مترجم معتمَد` : 'Signed season: our hour with a certified interpreter'}</label>
        {f.sign_language && <label className="ogs-interp">{ar ? 'المترجم' : 'Interpreter'}<select value={f.interpreter_user_id} onChange={e => setF(x => ({ ...x, interpreter_user_id: e.target.value }))} data-testid="org-season-interp" required><option value="">{ar ? 'اختر مترجمًا معتمَدًا' : 'Choose'}</option>{interpreters.map(i => <option key={i.user_id} value={i.user_id}>{i.name_ar}</option>)}</select>{!interpreters.length && <small className="pt-muted">{ar ? 'لا مترجم معتمَدًا بعد — يعتمده طاقم أَثَر من /admin/onair' : 'No certified interpreter yet.'}</small>}</label>}
        {picked && <small className="ogs-picked" data-testid="org-season-picked">{picked}</small>}
        <span className="ogs-btns"><button type="submit" className="pt-btn navy small" disabled={busy} data-testid="org-season-save">{s.slot ? (ar ? 'عدّل الساعة' : 'Update') : (ar ? 'أعلن ساعة جهتنا' : 'Announce our hour')}</button>{s.slot && <button type="button" className="pt-btn ghost small" disabled={busy} onClick={() => post({ action: 'season_slot_remove' })} data-testid="org-season-remove">{ar ? 'ألغِها' : 'Remove'}</button>}</span>
      </form>}
      {s.phase === 'after' && s.record_url && <p className="ogs-doc" data-testid="org-season-record"><a href={s.record_url}>📖 {ar ? `${P36_NAMES_AR.record} — الصفحة العامة المجهَّلة لهذا الموسم` : 'Season record (public, anonymized)'}</a></p>}
      {s.phase === 'after' && s.doc && <p className="ogs-doc" data-testid="org-season-doc">{ar ? 'وثيقة الموسم:' : 'Season document:'} <code>{s.doc.code}</code> · <a href={s.doc.verify_url}>{ar ? 'تحقّق' : 'Verify'}</a></p>}
      {s.phase === 'after' && isAdmin && s.can_issue && <p><button type="button" className="pt-btn gold small" disabled={busy} onClick={() => post({ action: 'season_doc' })} data-testid="org-season-issue">{ar ? 'أصدر وثيقة الموسم (ATH-OS)' : 'Issue season document'}</button> <small className="pt-muted">{ar ? 'وثيقة موقَّعة باسم الجهة؛ عدد اللقاءات يُذكر إن بلغ خمسة.' : 'Signed in the organization’s name.'}</small></p>}
      {!isAdmin && s.phase !== 'after' && <p className="pt-muted">{ar ? 'إعلان الساعة لمدير الجهة.' : 'Org admins announce the hour.'}</p>}
    </>}
    <h4>🕰 {ar ? P36_NAMES_AR.org_time : 'Org time map'}</h4>
    <OrgTimeGrid orgId={orgId} lang={lang} token={token} onPick={isAdmin && s && s.phase !== 'after' ? b => { setF(x => ({ ...x, weekday: b.weekday, from: `${String(b.hour).padStart(2, '0')}:00` })); setPicked(ar ? `مُلئ النموذج: ${WEEKDAY_AR[b.weekday]} ${String(b.hour).padStart(2, '0')}:00 — اضغط «أعلن» لتأكيدها.` : 'Form filled — press Announce.'); } : undefined} />
    <h4>🤲 {ar ? P35_NAMES_AR.org_hold : 'Entrusted to the organization'}</h4>
    <p className="ogs-held" data-testid="org-held"><b>{held.n}</b> {ar ? `${held.n === 1 ? 'أمانة' : 'أمانات'} في عهدة منسوبي الجهة الآن — تبقى ${ORG_HOLD_HOURS} ساعة ثم تنتقل إلى الهواء العام إن لم يصعد أحد منهم.` : `held by the organization now (${ORG_HOLD_HOURS} h, then public).`}</p>
    {isAdmin && held.items?.length > 0 && <ul className="ogs-held-list">{held.items.map((x: any) => <li key={x.id} data-testid="org-held-item"><b>{x.kind_ar}</b>{x.domain ? ` · ${x.domain}` : ''} · {ar ? 'حتى' : 'until'} {new Date(x.org_hold_until).toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit', weekday: 'short' })}</li>)}</ul>}
    {note && <p className="ogs-ok" role="status" data-testid="org-season-note">{note}</p>}
    {err && <p className="ogs-err" role="alert">{err}</p>}
  </div>;
}

const CSS = `
.ogs{margin:14px 0 10px;display:grid;gap:8px}.ogs h4{margin:8px 0 0;font-size:16px;color:#0f2a4e}.ogs-head{margin:0;color:#164e63}.ogs-ph{display:inline-block;border-radius:999px;padding:1px 10px;font-size:12px;font-weight:800;color:#fff;background:#0f2a4e}.ogs-ph.live{background:#0e7490}.ogs-ph.after{background:#64748b}
.ogs-slot{margin:0;background:#ecfeff;border:1px solid #a5f3fc;border-radius:12px;padding:8px 12px;color:#164e63}
.ogs-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;align-items:end;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px}.ogs-form label{font-weight:800;color:#0f2a4e;font-size:13px;display:grid;gap:4px}.ogs-form input,.ogs-form select{border:1px solid #cbd5e1;border-radius:8px;padding:6px 8px;font:inherit;min-height:36px}.ogs-chk{grid-column:1/-1;display:flex!important;align-items:center;gap:8px;font-weight:600!important}.ogs-btns{display:flex;gap:8px;grid-column:1/-1}
.ogs-sign{color:#701a75;font-weight:800}.ogs-interp{grid-column:1/-1}.ogs-picked{grid-column:1/-1;color:#92400e;font-weight:700}
.ogs-doc,.ogs-ok{margin:0;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:10px;padding:6px 10px}.ogs-err{margin:0;color:#b91c1c}.ogs-held{margin:0}.ogs-held-list{margin:0;padding:0 18px;font-size:13px;color:#334155}
`;
