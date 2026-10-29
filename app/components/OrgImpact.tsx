'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// «أثر الجهة» (P24) — تبويبا /org: «صدى الجهة» (خيوط مجهولة k ≥ 5 · إحاطة 90 ثانية · مرآة الجهة) و«ميثاق الجهة ومقاعدها» (توقيع سنوي موقَّع Ed25519 · طلب مقاعد جماعي/توأمة · اعتماد شهادات الأقران مركزيًا)
// لا لوحة ولا تقرير: الجهة تسمع صدى منسوبيها بلا أسماء، وتتعهد، وتدفع للعودة لا للمقعد.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { ReadAloud } from './Channel';
import { parsePeople } from '../../lib/portal/org';
import type { OrgEcho, EchoThread, MirrorStat } from '../../lib/org-impact/registry';

type Lang = 'ar' | 'en';
type Props = { orgId: string; orgName: string; lang: Lang; token: () => Promise<string>; view: 'echo' | 'charter' };
type EchoRes = { success: boolean; error?: string; echo: OrgEcho; brief: { text: string; source: 'ai' | 'local'; model: string | null; seconds: number }; rules: { k: number; echo_days: number; mirror_days: number } };
type CharterRes = { success: boolean; error?: string; state: { signed: boolean; status: string; days_left: number | null; renew_soon: boolean }; charter: any; history: any[]; clauses: { id: string; title: string; body: string }[]; version: string; months: number; signing_ready: boolean; public_page: string };
type SeatsRes = { success: boolean; error?: string; requests: any[]; applicants: any[]; twins: any[]; pending_attestations: any[]; topics: { code: string; label: string }[]; members_total: number };

const fmtD = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

export function OrgImpact({ orgId, orgName, lang, token, view }: Props) {
  return <>{view === 'echo' ? <Echo orgId={orgId} orgName={orgName} lang={lang} token={token} /> : <CharterSeats orgId={orgId} orgName={orgName} lang={lang} token={token} />}<style dangerouslySetInnerHTML={{ __html: CSS }} /></>;
}

async function get<T>(path: string, tk: string): Promise<T> { const r = await fetch(path, { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }); const t = await r.text(); try { return JSON.parse(t); } catch { return { success: false, error: `رد غير صالح (${r.status})` } as any; } }
async function post<T>(path: string, tk: string, body: any): Promise<T> { const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify(body) }); const t = await r.text(); try { return JSON.parse(t); } catch { return { success: false, error: `رد غير صالح (${r.status})` } as any; } }

// ---------------------------------------------------------------- صدى الجهة
function Echo({ orgId, orgName, lang, token }: Omit<Props, 'view'>) {
  const ar = lang === 'ar'; const [d, setD] = useState<EchoRes | null>(null); const [err, setErr] = useState(''); const [aiBusy, setAiBusy] = useState(false);
  async function load(ai = false) { setErr(''); if (ai) setAiBusy(true); try { const tk = await token(); const j = await get<EchoRes>(`/api/org/echo?org=${encodeURIComponent(orgId)}${ai ? '&brief=ai' : ''}`, tk); if (!j.success) throw new Error(j.error); setD(j); } catch (e: any) { setErr(e.message || String(e)); } setAiBusy(false); }
  useEffect(() => { setD(null); void load(false); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <div className="pt-alert err">{err}</div>;
  if (!d) return <div className="pt-empty">{ar ? 'نصغي إلى الصدى…' : 'Listening…'}</div>;
  const e = d.echo;
  return (
    <div className="oi-echo" data-testid="org-echo">
      <div className="oi-head"><div><b><Icon name="chat" size={18} /> {ar ? 'صدى الجهة — ما يصارعه منسوبوكم الآن' : 'Organization echo — what your people are wrestling with'}</b><small>{ar ? `آخر ${e.window_days} يومًا من مجالس أَثَر · ${e.people_active} فاعلًا من ${e.people_total} منسوبًا مؤكَّدًا · لا خيط من أقل من ${e.k} أشخاص` : `Last ${e.window_days} days · ${e.people_active} active of ${e.people_total} members · no thread under ${e.k} people`}</small></div>
        <ul className="oi-privacy" data-testid="privacy-balance">{e.privacy_ar.map(p => <li key={p}><Icon name="shield" size={11} /> {p}</li>)}</ul></div>

      {!e.quorum_ok && <div className="oi-quiet" data-testid="echo-below-k"><Icon name="clock" size={22} /><div><b>{ar ? 'لم يكتمل النصاب بعد — بصدق' : 'Quorum not reached yet'}</b><p>{ar ? `الخيط لا يظهر إلا حين يلمسه ${e.k} من منسوبيكم على الأقل. ` : ''}{e.below_k.length ? (ar ? `أقرب الموضوعات إلى الظهور: ${e.below_k.slice(0, 3).map(b => `«${b.label_ar}» (${b.people} من ${e.k})`).join('، ')}.` : '') : (ar ? 'لا آثار لمنسوبيكم في المجالس خلال النافذة.' : '')} {ar ? 'مقعد أو مقعدان إضافيان من تبويب «الميثاق والمقاعد» يكملان الصورة.' : ''}</p></div></div>}

      {e.quorum_ok && <div className="oi-threads">{e.threads.map((t, i) => <Thread key={t.theme} t={t} i={i} />)}</div>}

      <div className="oi-brief" data-testid="org-brief">
        <div className="oi-briefhead"><b><Icon name="play" size={16} /> {ar ? 'إحاطة 90 ثانية للقيادة' : '90-second leadership brief'} <span className={`oi-src ${d.brief.source}`}>{d.brief.source === 'ai' ? (ar ? 'كاتب الجهة (AI)' : 'AI') : (ar ? 'محلية' : 'local')}</span> <small>≈ {d.brief.seconds || 60} {ar ? 'ثانية' : 's'}</small></b>
          <div className="pt-chips"><ReadAloud lang="ar" text={d.brief.text} label={ar ? 'اسمعها' : 'Listen'} /><button type="button" className="pt-btn ghost small" disabled={aiBusy} onClick={() => load(true)}>{aiBusy ? '…' : (ar ? 'اكتبها بالذكاء الاصطناعي' : 'Write with AI')}</button></div></div>
        <p className="oi-brieftext">{d.brief.text}</p>
        <small className="pt-muted">{ar ? 'تُكتب من الأرقام والأسئلة المحورية المجهولة فقط — لا نص قضية ولا اسم يُمرَّر إلى النموذج.' : 'Written from anonymized counts and pivotal questions only — no case text or names reach the model.'}</small>
      </div>

      <div className="oi-mirror" data-testid="org-mirror"><h4><Icon name="star" size={16} /> {ar ? 'مرآة الجهة — مقابل ربعكم السابق فقط' : 'Organization mirror — vs your previous quarter only'}</h4>
        <div className="oi-mgrid">{e.mirror.map(m => <Mirror key={m.key} m={m} />)}</div>
        <small className="pt-muted">{ar ? 'الجهة تُقارن بذاتها لا بجهة أخرى — أبدًا. ومرآة الفرد تبقى له وحده.' : 'Compared with yourselves only — never another organization. Individual mirrors stay with their owners.'}</small></div>
    </div>
  );
}
function Thread({ t, i }: { t: EchoThread; i: number }) {
  return (
    <article className="oi-thread" data-testid="echo-thread">
      <header><span className="oi-n">{i + 1}</span><b>{t.label_ar}</b><small>{t.people} أشخاص · {t.cases} {t.cases === 1 ? 'قضية' : 'قضايا'} · {t.questions} سؤالًا · {t.advice} نصيحة{t.returns ? ` · ${t.returns} ${t.returns === 1 ? 'عودة' : 'عودات'}` : ''}</small></header>
      {t.pivotal_question && <blockquote><span>السؤال الذي غيّر مسار مداولة</span>{t.pivotal_question}</blockquote>}
      {t.unsaid && <p className="oi-unsaid"><b>ما لم يُقل:</b> {t.unsaid}</p>}
      <div className="oi-bar"><i style={{ width: `${Math.min(100, Math.round((t.questions / Math.max(1, t.questions + t.advice)) * 100))}%` }} /><small>أسئلة {t.questions} / نصائح {t.advice}</small></div>
    </article>
  );
}
function Mirror({ m }: { m: MirrorStat }) {
  const tone = m.delta === null ? 'flat' : m.delta > 0 ? 'up' : m.delta < 0 ? 'down' : 'flat';
  return <div className={`oi-m ${tone}`}><span>{m.label_ar}</span><b>{m.now}{m.unit === '%' ? '%' : ''}</b><small>{m.prev === null ? 'لا ربع سابق' : `الربع السابق ${m.prev}${m.unit === '%' ? '%' : ''} · ${m.delta !== null && m.delta > 0 ? '+' : ''}${m.delta ?? 0}`}</small><em>{m.read_ar}</em></div>;
}

// ---------------------------------------------------------------- ميثاق الجهة ومقاعدها
function CharterSeats({ orgId, orgName, lang, token }: Omit<Props, 'view'>) {
  const ar = lang === 'ar'; const [c, setC] = useState<CharterRes | null>(null); const [s, setS] = useState<SeatsRes | null>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState('');
  const [acc, setAcc] = useState<string[]>([]); const [title, setTitle] = useState(''); const [topic, setTopic] = useState(''); const [people, setPeople] = useState(''); const [note, setNote] = useState(''); const [dnote, setDnote] = useState<Record<number, string>>({});
  async function load() { setErr(''); try { const tk = await token(); const [cj, sj] = await Promise.all([get<CharterRes>(`/api/org/charter?org=${encodeURIComponent(orgId)}`, tk), get<SeatsRes>(`/api/org/seats?org=${encodeURIComponent(orgId)}`, tk)]); if (!cj.success) throw new Error(cj.error); if (!sj.success) throw new Error(sj.error); setC(cj); setS(sj); } catch (e: any) { setErr(e.message || String(e)); } }
  useEffect(() => { setC(null); setS(null); setAcc([]); void load(); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function act(key: string, path: string, body: any, done: string) { setBusy(key); setErr(''); setOk(''); try { const tk = await token(); const j = await post<any>(path, tk, { ...body, org: orgId }); if (!j.success) throw new Error(j.error); setOk(j.message || done); await load(); } catch (e: any) { setErr(e.message || String(e)); } setBusy(''); }
  if (err && !c) return <div className="pt-alert err">{err}</div>;
  if (!c || !s) return <div className="pt-empty">…</div>;
  const ppl = parsePeople(people); const st = c.state;
  return (
    <div className="oi-cs">
      {err && <div className="pt-alert err">{err}</div>}{ok && <div className="pt-alert ok">{ok}</div>}
      <section className={`pt-box oi-charter ${st.signed ? 'signed' : ''}`} data-testid="org-charter">
        <h3><Icon name="award" size={18} /> {ar ? 'ميثاق الجهة' : 'Organization charter'} <small>v{c.version} · {ar ? 'سنوي' : 'yearly'}</small></h3>
        {st.signed ? <div className="oi-signed" data-testid="charter-signed"><Icon name="check" size={18} /><div><b>{orgName} {ar ? 'موقِّعة' : 'is a signatory'}</b><small>{ar ? `منذ ${fmtD(c.charter.signed_at)} حتى ${fmtD(c.charter.expires_at)} (${st.days_left} يومًا)${c.charter.signer_title ? ` · وقّعها: ${c.charter.signer_title}` : ''}` : ''}</small>
          <div className="pt-chips">{c.charter.verify_url && <a className="pt-btn small" href={c.charter.verify_url} target="_blank" rel="noreferrer"><Icon name="shield" size={13} /> {ar ? 'الوثيقة الموقَّعة (تحقق)' : 'Signed document'}</a>}<a className="pt-btn light small" href={c.public_page} target="_blank" rel="noreferrer">{ar ? 'شارتكم في /councils' : 'Public badge'}</a>{st.renew_soon && <button type="button" className="pt-btn gold small" disabled={!!busy} onClick={() => setAcc([])}>{ar ? 'جدّدوا الآن' : 'Renew'}</button>}<button type="button" className="pt-btn ghost small" disabled={!!busy} onClick={() => { if (confirm(ar ? 'سحب الميثاق يُخفي الشارة فورًا ويُلغي الوثيقة. متأكد؟' : 'Revoke?')) void act('revoke', '/api/org/charter', { action: 'revoke', confirm: true }, 'سُحب'); }}>{ar ? 'سحب' : 'Revoke'}</button></div></div></div>
          : <p className="pt-muted">{ar ? 'تتعهد الجهة — لا الفرد — بأربعة بنود تجاه منسوبيها في مجالس أَثَر. التوقيع يُصدر وثيقة موقَّعة Ed25519 بمفتاح أَثَر، وتظهر شارتكم باسمكم في /councils، ويرى كل منسوب أن جهته وقّعت.' : 'The organization pledges four clauses toward its people in Athar councils; signing issues an Ed25519-signed document and a public badge.'}</p>}
        {(!st.signed || st.renew_soon) && <div className="oi-clauses" data-testid="charter-clauses">
          {c.clauses.map(cl => <label key={cl.id} className={acc.includes(cl.id) ? 'on' : ''}><input type="checkbox" checked={acc.includes(cl.id)} onChange={e => setAcc(a => e.target.checked ? [...a, cl.id] : a.filter(x => x !== cl.id))} /><div><b>{cl.title}</b><p>{cl.body}</p></div></label>)}
          <div className="oi-signrow"><input placeholder={ar ? 'صفتكم (مثال: مدير التدريب) — اختياري' : 'Your title (optional)'} value={title} onChange={e => setTitle(e.target.value)} /><button type="button" className="pt-btn gold" data-testid="charter-sign" disabled={!!busy || acc.length < c.clauses.length} onClick={() => act('sign', '/api/org/charter', { action: 'sign', accepted: acc, confirm: true, signer_title: title.trim() || undefined }, 'وُقِّع')}><Icon name="check" size={15} /> {busy === 'sign' ? '…' : (ar ? (st.signed ? 'أجدّد الميثاق باسم الجهة' : 'أوقّع الميثاق باسم الجهة') : 'Sign')}</button></div>
          {!c.signing_ready && <small className="pt-muted">{ar ? 'مفتاح التوقيع غير مضبوط بعد — سيُسجَّل الميثاق وتصدر وثيقته حين يُضبط.' : 'Signing key not configured yet.'}</small>}
        </div>}
        {c.history.length > 1 && <details className="oi-hist"><summary>{ar ? `سجل التوقيعات (${c.history.length})` : 'History'}</summary><ul>{c.history.map(h => <li key={h.id}>{fmtD(h.signed_at)} → {fmtD(h.expires_at)} · {h.status}{h.vc_code ? ` · ${h.vc_code}` : ''}</li>)}</ul></details>}
      </section>

      <div className="og-grid">
        <section className="pt-box" data-testid="org-seats"><h3><Icon name="users" size={18} /> {ar ? 'مقاعد الجهة — توأمة لا عزلة' : 'Organization seats — twinning'}</h3>
          <p className="pt-muted">{ar ? 'اطلبوا مقاعد لمنسوبيكم حول موضوع. المُوفِّق لا يشكّل مجلسًا من جهة واحدة أبدًا؛ يبحث عن جهة ثانية طلبت الموضوع نفسه فتُوأَم مجالسكم. كل اسم هنا يصبح متقدمًا وتصله دعوة لتوقيع ميثاق المجلس.' : 'Request seats for your people; councils are never formed from a single organization.'}</p>
          <div className="pt-form">
            <label>{ar ? 'الموضوع' : 'Topic'}<select value={topic} onChange={e => setTopic(e.target.value)}><option value="">—</option>{s.topics.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}</select></label>
            <label>{ar ? 'المنسوبون (بريد في كل سطر، أو «الاسم <email>») — من منسوبيكم المؤكَّدين' : 'People (one per line)'}<textarea className="og-ta" dir="ltr" value={people} onChange={e => setPeople(e.target.value)} /></label>
            <label>{ar ? 'ملاحظة للمُوفِّق (اختياري)' : 'Note'}<input value={note} onChange={e => setNote(e.target.value)} /></label>
            <div className="pt-chips"><span className="pt-tag">{ppl.length} {ar ? 'مقعدًا' : 'seats'}</span><button type="button" className="pt-btn gold" data-testid="seats-request" disabled={!!busy || !topic || ppl.length < 2} onClick={() => act('seats', '/api/org/seats', { action: 'request', topic, people: ppl, note: note.trim() || undefined }, 'سُجِّل')}><Icon name="send" size={14} /> {busy === 'seats' ? '…' : (ar ? 'اطلب المقاعد' : 'Request seats')}</button></div>
          </div>
          {s.requests.length > 0 && <ul className="oi-reqs">{s.requests.map(r => <li key={r.id}><b>{r.topic}</b><span>{r.seats} {ar ? 'مقعدًا' : 'seats'} · {r.seated} {ar ? 'جلسوا' : 'seated'} · <i className={`oi-st ${r.status}`}>{r.status_ar}</i> · <bdi>{fmtD(r.created_at)}</bdi></span>{r.status === 'pending' && <button type="button" className="pt-btn ghost small" disabled={!!busy} onClick={() => act('close' + r.id, '/api/org/seats', { action: 'close', id: r.id }, 'أُغلق')}>{ar ? 'إغلاق' : 'Close'}</button>}</li>)}</ul>}
          {s.twins.length > 0 && <div className="oi-twins" data-testid="org-twins"><h4>{ar ? 'أين منسوبوكم الآن' : 'Where your people sit'}</h4>{s.twins.map(t => <div key={t.council_id} className="oi-twin"><b>{t.title_ar}</b><small>{t.mine} {ar ? 'من منسوبيكم' : 'of yours'} + {t.others} {ar ? 'من' : 'from'} {t.other_orgs} {ar ? (t.other_orgs === 1 ? 'جهة أخرى' : 'جهات أخرى') : 'other orgs'} · {ar ? 'الدورة' : 'cycle'} {t.cycle_no}{t.cycle_ends_at ? ` · ${ar ? 'تنتهي' : 'ends'} ${fmtD(t.cycle_ends_at)}` : ''}</small></div>)}<small className="pt-muted">{ar ? 'أسماء الجهات الأخرى لا تُعرض — قاعدة المجلس.' : 'Other organizations are not named.'}</small></div>}
          {s.applicants.length > 0 && <p className="pt-muted" style={{ marginTop: 8 }}>{ar ? `${s.applicants.length} من منسوبيكم لدى المُوفِّق بانتظار التشكيل.` : `${s.applicants.length} awaiting formation.`}</p>}
        </section>

        <section className="pt-box" data-testid="org-attest"><h3><Icon name="check" size={18} /> {ar ? 'شهادات أقران تنتظر اعتمادكم' : 'Peer attestations awaiting your approval'} {s.pending_attestations.length > 0 && <i className="oi-badge">{s.pending_attestations.length}</i>}</h3>
          <p className="pt-muted">{ar ? 'قرين في مجلس شهد لمنسوبكم بدليل محدد على مهارة محددة. اعتمادكم يرفع وزن الدليل من 0.4 إلى 0.75 في خيط أثره — ولا يغيّر مستواه المعتمد (ذلك قرار بشري منفصل). لا تعتمدون شهادة لأنفسكم.' : 'A peer attested a specific skill with specific evidence; your approval raises its weight from 0.4 to 0.75.'}</p>
          {!s.pending_attestations.length && <p className="pt-muted">{ar ? 'لا شهادات معلّقة الآن.' : 'Nothing pending.'}</p>}
          <ul className="oi-atts">{s.pending_attestations.map(a => <li key={a.id} data-testid="pending-attestation"><div><b>{a.to_name}</b> · <span className="og-tag lv">{a.skill_ar}</span><small> · {fmtD(a.created_at)}</small><p>«{a.evidence_ar}»</p></div>
            <div className="oi-decide"><input placeholder={ar ? 'ملاحظة (اختياري)' : 'Note'} value={dnote[a.id] || ''} onChange={e => setDnote(x => ({ ...x, [a.id]: e.target.value }))} /><button type="button" className="pt-btn small" data-testid="attest-approve" disabled={!!busy} onClick={() => act('a' + a.id, '/api/org/seats', { action: 'decide', id: a.id, approve: true, note: dnote[a.id] || undefined }, 'اعتُمدت')}><Icon name="check" size={13} /> {ar ? 'اعتماد' : 'Approve'}</button><button type="button" className="pt-btn ghost small" disabled={!!busy} onClick={() => act('d' + a.id, '/api/org/seats', { action: 'decide', id: a.id, approve: false, note: dnote[a.id] || undefined }, 'رُفضت')}>{ar ? 'رفض' : 'Decline'}</button></div></li>)}</ul>
          <small className="pt-muted"><Link href="/councils#orgs">{ar ? 'الدوائر الحيّة وميثاق المجلس' : 'Live circles'}</Link></small>
        </section>
      </div>
    </div>
  );
}

const CSS = `
.oi-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px}.oi-head b{display:flex;gap:6px;align-items:center;color:#0f2a4e;font-size:16px}.oi-head small{display:block;color:#64748b;font-size:12.5px;margin-top:3px}
.oi-privacy{list-style:none;margin:0;padding:0;display:flex;gap:6px;flex-wrap:wrap}.oi-privacy li{display:inline-flex;gap:4px;align-items:center;background:#0f2a4e;color:#fde68a;border-radius:999px;padding:4px 10px;font-size:11.5px;font-weight:800}
.oi-quiet{display:flex;gap:12px;align-items:flex-start;border:1px dashed #cbd5e1;background:#f8fafc;border-radius:16px;padding:14px 16px;margin-bottom:12px;color:#334155}.oi-quiet b{display:block;color:#0f2a4e}.oi-quiet p{margin:4px 0 0;font-size:13.5px;line-height:1.8}
.oi-threads{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:12px}.oi-thread{border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;background:linear-gradient(180deg,#fff,#f8fafc);border-inline-start:5px solid #0b8a83}.oi-thread header{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;align-items:center}.oi-thread header b{font-size:15px;color:#0f2a4e}.oi-thread header small{grid-column:2;color:#64748b;font-size:12px}.oi-n{grid-row:1/3;width:30px;height:30px;border-radius:999px;background:#0f2a4e;color:#fff;display:grid;place-items:center;font-weight:900}
.oi-thread blockquote{margin:10px 0 0;padding:10px 12px;background:#fff7ed;border-inline-start:3px solid #c9a24b;border-radius:10px;font-size:13.5px;line-height:1.8;color:#0f172a}.oi-thread blockquote span{display:block;font-size:11px;color:#9a3412;font-weight:800;margin-bottom:2px}.oi-unsaid{margin:8px 0 0;font-size:13px;color:#475569;line-height:1.7}.oi-unsaid b{color:#0f2a4e}
.oi-bar{position:relative;height:18px;border-radius:999px;background:#e2e8f0;overflow:hidden;margin-top:10px}.oi-bar i{position:absolute;inset:0 auto 0 0;background:#0b8a83}.oi-bar small{position:relative;display:block;text-align:center;font-size:11px;line-height:18px;color:#0f172a;font-weight:800}
.oi-brief{border:1px solid #cfe9e6;background:#f3fbfa;border-radius:16px;padding:14px 18px;margin-bottom:12px}.oi-briefhead{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.oi-briefhead b{display:flex;gap:8px;align-items:center;color:#0f2a4e;font-size:15px}.oi-briefhead small{color:#64748b;font-weight:400;font-size:12px}.oi-src{font-size:11px;padding:2px 8px;border-radius:999px;background:#e2e8f0;color:#475569}.oi-src.ai{background:#0b8a83;color:#fff}.oi-brieftext{margin:10px 0 6px;font-size:14.5px;line-height:2;color:#0f172a}
.oi-mirror{border:1px solid #e2e8f0;border-radius:16px;padding:14px 18px;background:#fff}.oi-mirror h4{margin:0 0 10px;display:flex;gap:6px;align-items:center;color:#0f2a4e;font-size:15px}.oi-mgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:8px}.oi-m{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;display:grid;gap:2px;border-inline-start:4px solid #94a3b8}.oi-m span{font-size:12px;color:#64748b}.oi-m b{font-size:24px;color:#0f2a4e}.oi-m small{font-size:11.5px;color:#64748b}.oi-m em{font-style:normal;font-size:12px;line-height:1.6;color:#334155;margin-top:4px}.oi-m.up{border-inline-start-color:#0b8a83}.oi-m.down{border-inline-start-color:#c9a24b}
.oi-charter{margin-bottom:14px;border-inline-start:5px solid #c9a24b}.oi-charter.signed{border-inline-start-color:#0b8a83}.oi-charter h3 small{color:#64748b;font-weight:400;font-size:12px}.oi-signed{display:flex;gap:12px;align-items:flex-start;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:14px;padding:12px 14px;color:#065f46}.oi-signed b{display:block;color:#064e3b;font-size:15px}.oi-signed small{display:block;color:#047857;font-size:12.5px;margin:2px 0 8px}
.oi-clauses{display:grid;gap:8px;margin-top:10px}.oi-clauses label{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:flex-start;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;cursor:pointer;background:#fff}.oi-clauses label.on{border-color:#0b8a83;background:#f3fbfa}.oi-clauses input{margin-top:5px}.oi-clauses b{display:block;color:#0f2a4e;font-size:14px}.oi-clauses p{margin:2px 0 0;font-size:13px;line-height:1.75;color:#334155}
.oi-signrow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:4px}.oi-signrow input{flex:1;min-width:220px;border:1px solid #cbd5e1;border-radius:10px;padding:9px 12px;font:inherit}
.oi-hist summary{cursor:pointer;color:#0b8a83;font-size:12.5px;font-weight:800;margin-top:8px}.oi-hist ul{margin:6px 0 0;padding-inline-start:18px;font-size:12.5px;color:#475569}
.oi-reqs{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:6px}.oi-reqs li{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:13px}.oi-reqs b{color:#0f2a4e}.oi-reqs span{grid-column:1;color:#64748b;font-size:12px}.oi-reqs button{grid-row:1/3}.oi-st{font-style:normal;font-weight:800;color:#9a3412}.oi-st.matched{color:#065f46}.oi-st.closed{color:#64748b}
.oi-twins{margin-top:12px}.oi-twins h4{margin:0 0 6px;font-size:13.5px;color:#0f2a4e}.oi-twin{border:1px solid #cfe9e6;background:#f3fbfa;border-radius:10px;padding:8px 12px;margin-bottom:6px}.oi-twin b{display:block;font-size:13.5px;color:#0f2a4e}.oi-twin small{color:#475569;font-size:12px}
.oi-badge{font-style:normal;background:#dc2626;color:#fff;border-radius:999px;padding:0 8px;font-size:11px;margin-inline-start:6px}.oi-atts{list-style:none;margin:0;padding:0;display:grid;gap:8px}.oi-atts li{border:1px solid #fdba74;background:#fffbf3;border-radius:12px;padding:10px 12px;display:grid;gap:8px}.oi-atts li b{color:#0f2a4e}.oi-atts li p{margin:4px 0 0;font-size:13px;line-height:1.75;color:#0f172a}.oi-atts small{color:#64748b;font-size:12px}
.oi-decide{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.oi-decide input{flex:1;min-width:160px;border:1px solid #cbd5e1;border-radius:10px;padding:7px 10px;font:inherit;font-size:13px}
`;
