// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
'use client';
/* «بَيْتُ بَيان» — واجهة وليّ الأمر (هـ-6-و): حديقة الأطفال · بذرة الطفل · أمانات لؤلؤ · رسالة الأسبوع · مهمّة البيت · الحذف.
 * تجربة لا لوحة: نبتة لكلّ طفل تكبر بالجلسات وتُثمر بمهامّ البيت. كلّ القراءة عبر /api/kids بجلسة وليّ الأمر. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { IntroButton } from './IntroButton';
import { sbLazy, hasStoredSession } from '../../../lib/supabase/lazy';
import { AVATARS, CONSENTS, STAGE_AR, LIMITS, ageOf, type ConsentKind, type Stage } from '../../../lib/kids/parent';

type Child = {
  id: string; nick: string; gender: 'm' | 'f'; birth_year: number; avatar: number; stage: Stage; finished: number; fruits: number;
  consents: Record<ConsentKind, boolean>; next: { slug: string; world: string; order: number };
  progress: { id: string; session: string; world: string; started_at: string; finished_at: string | null; stations: Record<string, boolean>; badge: string | null; self_check: string | null; self_voice: string | null; home_task: string | null; home_task_done_at: string | null }[];
  talks: { id: string; session: string; at: string; results: { role: string; matched: string; attempts: number; heard?: string }[]; self_voice: string | null }[];
  letter: { week_start: string; body: string; sentence: string | null };
  letters?: { id: string; week_start: string; body: string; sentence: string | null }[];
};
type Home = { children: Child[]; sessions: { slug: string; world: string; order: number; letter: string; value: string }[] };

async function token(): Promise<string> { try { const sb = await sbLazy(); const { data } = await sb.auth.getSession(); return data.session?.access_token || ''; } catch { return ''; } }
export async function api(path: string, body?: unknown) {
  const t = await token(); if (!t) return { success: false, error: 'سجّل الدخول', unauth: true };
  const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  try { const j = await r.json(); return { ...j, unauth: r.status === 401 }; } catch { return { success: false, error: 'استجابة غير صالحة' }; }
}
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long' }) : '');
const FACE: Record<string, string> = { easy: '😄 سَهْلْ', good: '🙂 جَيِّدْ', hard: '😅 صَعْبْ', clear: '😄 واضِحَةْ', near: '🙂 قَريبْ', again: '😌 غَدًا', skip: '—' };
const MATCH: Record<string, string> = { yes: 'أجاب ✓', alt: 'أجاب ✓', no: 'قارب', silent: 'صمت' };
const ROLE: Record<string, string> = { answer: 'أجب', tell: 'أخبرني', correct: 'صحّح لي' };

/** النبتة: SVG بسيط بثلاث مراحل + ثمار */
function Plant({ stage, fruits, avatar }: { stage: Stage; fruits: number; avatar: number }) {
  const h = stage === 'seed' ? 26 : stage === 'sprout' ? 70 : 110;
  return (
    <svg viewBox="0 0 120 150" width="120" height="150" aria-label={STAGE_AR[stage]}>
      <ellipse cx="60" cy="138" rx="40" ry="9" fill="#F1D9A8" />
      {stage === 'seed' ? <ellipse cx="60" cy="128" rx="12" ry="8" fill="#B07A4A" /> : <path d={`M60 136 Q58 ${136 - h / 2} 60 ${136 - h}`} stroke="#5EA8A0" strokeWidth="6" fill="none" strokeLinecap="round" />}
      {stage !== 'seed' && <><ellipse cx="44" cy={136 - h * 0.55} rx="16" ry="8" fill="#5EA8A0" transform={`rotate(-25 44 ${136 - h * 0.55})`} /><ellipse cx="76" cy={136 - h * 0.75} rx="16" ry="8" fill="#5EA8A0" transform={`rotate(25 76 ${136 - h * 0.75})`} /></>}
      {stage === 'branch' && <><ellipse cx="40" cy={136 - h * 0.9} rx="14" ry="7" fill="#7FC8E8" transform={`rotate(-30 40 ${136 - h * 0.9})`} /><ellipse cx="80" cy={136 - h} rx="14" ry="7" fill="#7FC8E8" transform={`rotate(30 80 ${136 - h})`} /></>}
      {Array.from({ length: Math.min(fruits, 6) }, (_, i) => <circle key={i} cx={38 + (i % 3) * 22} cy={136 - h * 0.5 - Math.floor(i / 3) * 22} r="6" fill="#E8795C" />)}
      <text x="60" y="22" textAnchor="middle" fontSize="22">{AVATARS[(avatar - 1) % AVATARS.length]}</text>
    </svg>
  );
}

export function ParentHome({ childId }: { childId?: string }) {
  const [home, setHome] = useState<Home | null>(null);
  const [err, setErr] = useState('');
  const [unauth, setUnauth] = useState(!hasStoredSession());
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ nick: '', gender: 'm' as 'm' | 'f', birth_year: new Date().getFullYear() - 5, avatar: 1 });
  const load = useCallback(async () => { const j = await api('/api/kids'); if (j.unauth) { setUnauth(true); return; } if (!j.success) { setErr(j.error || 'تعذّر التحميل'); return; } setUnauth(false); setErr(''); setHome(j); }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (body: unknown) => { setBusy(true); const j = await api('/api/kids', body); setBusy(false); if (!j.success) { setErr(j.error || 'تعذّر'); return false; } await load(); return true; };
  const child = useMemo(() => home?.children.find(c => c.id === childId) || null, [home, childId]);

  if (unauth) return (
    <section className="kp-card kp-center">
      <h1>بَيْتُ بَيان لِأُسْرَتي 🏡</h1>
      <p>هنا تزرع لكلّ طفل بذرة تكبر بجلساته، وتسلّم لِلُؤلُؤ أماناتها بيدك، وتصلك رسالتها كلّ أسبوع.</p>
      <p className="kp-muted">ندخل بحساب أَثَر نفسه — لا تسجيل منفصل. لا نطلب اسم الطفل الكامل ولا صورته ولا مدرسته.</p>
      <Link className="kp-big" href={`/login?next=${encodeURIComponent(childId ? `/kids/parent/${childId}` : '/kids/parent')}`}>دخول وليّ الأمر</Link>
      <Link className="kp-ghost" href="/kids/demo">أو جرّب الجلسة النموذجية بلا حساب ▶</Link>
    </section>
  );
  if (!home) return <section className="kp-card kp-center"><p className="kp-muted">{err || '…نفتح البيت'}</p></section>;

  /* ───── بذرة طفل ───── */
  if (childId) {
    if (!child) return <section className="kp-card kp-center"><p>الطفل غير موجود.</p><Link className="kp-ghost" href="/kids/parent">إلى البيت</Link></section>;
    const c = child;
    return (
      <div className="kp">
        <nav className="kp-crumb"><Link href="/kids/parent">🏡 بَيْتُ بَيان</Link> › <b>بَذْرَةُ {c.nick}</b></nav>
        <section className="kp-card kp-hero">
          <Plant stage={c.stage} fruits={c.fruits} avatar={c.avatar} />
          <div>
            <h1>بَذْرَةُ {c.nick}</h1>
            <p className="kp-muted">{STAGE_AR[c.stage]} · {c.finished} {c.finished === 1 ? 'جلسة مكتملة' : 'جلسات مكتملة'} · {c.fruits} {c.fruits === 1 ? 'ثمرة' : 'ثمرات'} (مهامّ بيت) · {ageOf(c.birth_year)} سنوات</p>
            <div className="kp-row">
              <Link className="kp-big" href={`/kids/play/${c.id}`}>اِلْعَبْ: الجلسة {c.next.order} «في {c.next.world}» 🌱</Link>
              <button className="kp-ghost" onClick={() => { setAdding(true); setForm({ nick: c.nick, gender: c.gender, birth_year: c.birth_year, avatar: c.avatar }); }}>تعديل الكنية والصورة</button>
            </div>
          </div>
        </section>
        {adding && <ChildForm form={form} setForm={setForm} busy={busy} onCancel={() => setAdding(false)} onSave={async () => { if (await act({ action: 'child', id: c.id, ...form })) setAdding(false); }} />}
        {err && <p className="kp-err">{err}</p>}

        <section className="kp-card">
          <h2>💌 رِسالَةُ لُؤْلُؤ هذا الأسبوع</h2>
          <p className="kp-letter">{c.letter.body}</p>
          {c.letter.sentence && <p className="kp-sentence">جملة الأسبوع: <b>{c.letter.sentence}</b></p>}
          {!!c.letters?.length && <details className="kp-past"><summary>رسائل الأسابيع الماضية ({c.letters.length})</summary>
            {c.letters.map(l => <div key={l.id} className="kp-past-one"><small>أسبوع {fmt(l.week_start)}</small><p className="kp-letter">{l.body}</p></div>)}
          </details>}
        </section>

        <section className="kp-card">
          <h2>🧭 رِحْلَةُ الْجَلَسات</h2>
          {!c.progress.length && <p className="kp-muted">لم تبدأ بعد. اضغط «اِلْعَبْ» أعلاه من جهاز الطفل.</p>}
          {c.progress.map(p => (
            <div key={p.id} className="kp-sess">
              <div className="kp-sess-h"><b>«في {p.world}»</b> <span className="kp-muted">{fmt(p.started_at)}</span> {p.finished_at ? <span className="kp-ok">مكتملة ✓</span> : <span className="kp-mid">جارية</span>} {p.badge && <span className="kp-badge">🏅 {p.badge}</span>}</div>
              <div className="kp-stations">{['start', 'story', 'harf', 'play', 'act', 'hadith', 'quran', 'athari'].map(k => <span key={k} className={p.stations?.[k] ? 'on' : ''} />)}</div>
              <div className="kp-faces">{p.self_check && <span>أداؤه: {FACE[p.self_check]}</span>}{p.self_voice && <span>صوته: {FACE[p.self_voice]}</span>}</div>
              {p.home_task && <div className="kp-task">🏠 {p.home_task} {p.home_task_done_at ? <span className="kp-ok">تمّت 🍎 {fmt(p.home_task_done_at)}</span> : <button className="kp-small" disabled={busy} onClick={() => act({ action: 'task', child: c.id, progress: p.id })}>تَمَّتْ ✓</button>}</div>}
            </div>
          ))}
        </section>

        <section className="kp-card">
          <h2>🎙️ قالَ لِلُؤْلُؤ</h2>
          {!c.talks.length && <p className="kp-muted">لم يتحدّث مع لؤلؤ بعد (محطّة «حَديثٌ مَعَ لُؤْلُؤ» في ختام كلّ جلسة).</p>}
          {!!c.talks.length && !c.consents.save_text && <p className="kp-muted">الكلمات نفسها لا تُحفظ لأن أمانة «حفظ ما قاله» مغلقة — تظهر العدّادات فقط.</p>}
          {c.talks.map(t => <div key={t.id} className="kp-talk"><span className="kp-muted">{fmt(t.at)} · «في {home.sessions.find(s => s.slug === t.session)?.world || t.session}»</span><ul>{t.results.map((r, i) => <li key={i}><b>{ROLE[r.role] || r.role}:</b> {r.heard ? `«${r.heard}»` : ''} <span className="kp-muted">{MATCH[r.matched] || r.matched}{r.attempts === 2 ? ' · من المحاولة الثانية' : ''}</span></li>)}</ul></div>)}
        </section>

        <section className="kp-card">
          <h2>🔑 أَماناتُ لُؤْلُؤ</h2>
          <p className="kp-muted">كلّها مغلقة حتى تفتحها بيدك، وكلّ تبديل يُسجَّل بتاريخه. لا شيء منها يمنع طفلك من اللعب.</p>
          {CONSENTS.map(d => (
            <label key={d.kind} className={`kp-consent ${c.consents[d.kind] ? 'on' : ''}`}>
              <input type="checkbox" checked={c.consents[d.kind]} disabled={busy} onChange={e => act({ action: 'consent', child: c.id, kind: d.kind, granted: e.target.checked })} />
              <span><b>{d.title} {d.experimental && <em className="kp-exp">اختبارية</em>}</b><small>{d.lines[0]} {d.lines[1]}{d.days ? ` تنتهي تلقائيًّا بعد ${d.days} يومًا.` : ''}</small></span>
            </label>
          ))}
        </section>

        <section className="kp-card kp-danger">
          <h2>🗑️ حَذْفُ كُلِّ بَياناتِ {c.nick}</h2>
          <p className="kp-muted">حذف فعليّ فوريّ: الطفل وتقدّمه وأماناته وكلماته ورسائله. لا يمكن التراجع.</p>
          <button className="kp-ghost" disabled={busy} onClick={async () => { if (confirm(`حذف كلّ بيانات ${c.nick} نهائيًّا؟`)) { if (await act({ action: 'delete', child: c.id })) window.location.href = '/kids/parent'; } }}>احذف نهائيًّا</button>
        </section>
      </div>
    );
  }

  /* ───── البيت ───── */
  return (
    <div className="kp">
      <section className="kp-card kp-hero">
        <div style={{ fontSize: 64 }}>🏡</div>
        <div>
          <h1>بَيْتُ بَيان</h1>
          <p className="kp-muted">لكلّ طفل بذرة تكبر بجلساته وتُثمر بمهامّ البيت. {home.children.length ? '' : 'ازرع أوّل بذرة 👇'}</p>
          <IntroButton className="kp-small" label="كيف يصنع بَيان أثرًا؟ ▶ 3 دقائق" />
        </div>
      </section>
      {err && <p className="kp-err">{err}</p>}
      <div className="kp-garden">
        {home.children.map(c => (
          <Link key={c.id} href={`/kids/parent/${c.id}`} className="kp-plant">
            <Plant stage={c.stage} fruits={c.fruits} avatar={c.avatar} />
            <b>{c.nick}</b>
            <span className="kp-muted">{STAGE_AR[c.stage]} · {c.finished} جلسة · {c.fruits} 🍎</span>
            {c.progress[0]?.badge && <span className="kp-badge">🏅 {c.progress[0].badge}</span>}
            <span className="kp-play">اِلْعَبْ ▶ «في {c.next.world}»</span>
          </Link>
        ))}
        {home.children.length < LIMITS.children && !adding && <button className="kp-plant kp-add" onClick={() => { setAdding(true); setForm({ nick: '', gender: 'm', birth_year: new Date().getFullYear() - 5, avatar: ((home.children.length) % 8) + 1 }); }}><span style={{ fontSize: 48 }}>🌱</span><b>أَضِفْ طِفْلًا</b><span className="kp-muted">كنية · سنة الميلاد · صورة رمزية</span></button>}
      </div>
      {adding && <ChildForm form={form} setForm={setForm} busy={busy} onCancel={() => setAdding(false)} onSave={async () => { if (await act({ action: 'child', ...form })) setAdding(false); }} />}
      <section className="kp-card">
        <h2>ما الذي لا نطلبه أبدًا</h2>
        <ul className="kp-list"><li>لا اسم كامل، لا صورة شخصيّة، لا تاريخ ميلاد كامل، لا مدرسة، لا بريد للطفل.</li><li>لا صوت ولا صورة يغادران جهازكم إلى أَثَر — أبدًا.</li><li>ما يقوله الطفل لِلُؤلُؤ يُحفظ نصًّا فقط إن أذنتَ، ويُمحى بعد 90 يومًا، ويُحذف فورًا بطلبك.</li><li>لا درجات ولا ترتيب بين الأطفال.</li></ul>
      </section>
    </div>
  );
}

function ChildForm({ form, setForm, busy, onSave, onCancel }: { form: { nick: string; gender: 'm' | 'f'; birth_year: number; avatar: number }; setForm: (f: typeof form) => void; busy: boolean; onSave: () => void; onCancel: () => void }) {
  const y = new Date().getFullYear();
  return (
    <section className="kp-card kp-form">
      <h2>🌱 {form.nick ? 'تعديل' : 'بذرة جديدة'}</h2>
      <label>الاسم الأوّل أو الكنية <small>(هكذا يناديه لؤلؤ وأصدقاؤها — بلا اسم عائلة)</small><input value={form.nick} maxLength={LIMITS.nick} onChange={e => setForm({ ...form, nick: e.target.value })} placeholder="مثل: ريم · حمّود" /></label>
      <div className="kp-row">
        <button type="button" className={`kp-chip ${form.gender === 'm' ? 'on' : ''}`} onClick={() => setForm({ ...form, gender: 'm' })}>ولد</button>
        <button type="button" className={`kp-chip ${form.gender === 'f' ? 'on' : ''}`} onClick={() => setForm({ ...form, gender: 'f' })}>بنت</button>
        <label className="kp-inline">سنة الميلاد <select value={form.birth_year} onChange={e => setForm({ ...form, birth_year: Number(e.target.value) })}>{Array.from({ length: 10 }, (_, i) => y - 3 - i).map(v => <option key={v} value={v}>{v}</option>)}</select></label>
      </div>
      <div className="kp-row">{AVATARS.map((a, i) => <button type="button" key={a} className={`kp-av ${form.avatar === i + 1 ? 'on' : ''}`} onClick={() => setForm({ ...form, avatar: i + 1 })}>{a}</button>)}</div>
      <div className="kp-row"><button className="kp-big" disabled={busy || !form.nick.trim()} onClick={onSave}>احفظ</button><button className="kp-ghost" onClick={onCancel}>إلغاء</button></div>
    </section>
  );
}

export const PARENT_CSS = `
.kp{max-width:900px;margin:0 auto;padding:16px 14px 60px;display:grid;gap:14px;color:#2A1626;font-family:var(--font-read,system-ui)}
.kp-card{background:#fff;border:2px solid #F1D9A8;border-radius:24px;padding:18px 20px}
.kp-card h1{margin:0 0 4px;color:#3A1F36;font-size:28px}.kp-card h2{margin:0 0 8px;color:#3A1F36;font-size:20px}
.kp-center{text-align:center;display:grid;gap:10px;justify-items:center;max-width:620px;margin:30px auto}
.kp-hero{display:grid;grid-template-columns:130px 1fr;gap:16px;align-items:center}
.kp-muted{color:#8E7F8A;font-size:14px}.kp-err{color:#b9544a;background:#fff5f0;border-radius:12px;padding:8px 12px}
.kp-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}
.kp-big{display:inline-block;background:#E8795C;color:#fff;border:0;border-radius:999px;padding:12px 22px;font-size:17px;font-weight:700;text-decoration:none;cursor:pointer;box-shadow:0 4px 0 #b9544a}.kp-big:disabled{opacity:.5;box-shadow:none}
.kp-ghost{display:inline-block;background:#fff;color:#3A1F36;border:2px solid #5EA8A0;border-radius:999px;padding:10px 18px;font-size:15px;text-decoration:none;cursor:pointer}
.kp-small{background:#5EA8A0;color:#fff;border:0;border-radius:999px;padding:6px 14px;cursor:pointer}
.kp-chip{border:2px solid #F1D9A8;background:#fff;border-radius:999px;padding:8px 16px;cursor:pointer}.kp-chip.on{background:#E8795C;border-color:#E8795C;color:#fff}
.kp-av{font-size:26px;width:48px;height:48px;border-radius:50%;border:2px solid #F1D9A8;background:#fff;cursor:pointer}.kp-av.on{border-color:#E8795C;background:#fff5f0}
.kp-inline{display:flex;gap:6px;align-items:center}.kp-inline select,.kp-form input{font-size:16px;padding:8px 10px;border:2px solid #F1D9A8;border-radius:12px;background:#FBF4EE}
.kp-form label{display:grid;gap:4px}.kp-form label small{color:#8E7F8A}
.kp-garden{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.kp-plant{display:grid;justify-items:center;gap:4px;background:#fff;border:2px solid #F1D9A8;border-radius:24px;padding:14px;text-decoration:none;color:#2A1626;cursor:pointer;text-align:center}
.kp-plant b{font-size:20px;color:#3A1F36}.kp-add{border-style:dashed;background:#FBF4EE}
.kp-play{background:#5EA8A0;color:#fff;border-radius:999px;padding:6px 12px;font-size:14px;margin-top:4px}
.kp-badge{background:#F1D9A8;color:#3A1F36;border-radius:999px;padding:3px 10px;font-size:13px}
.kp-crumb{color:#8E7F8A}.kp-crumb a{color:#5EA8A0;text-decoration:none}
.kp-past{margin-top:10px}.kp-past summary{cursor:pointer;color:#5EA8A0;font-size:14px}.kp-past-one{margin-top:10px}.kp-past-one small{color:#8E7F8A}
.kp-letter{font-size:17px;line-height:1.9;background:#FBF4EE;border-radius:16px;padding:12px 14px;margin:0}.kp-sentence{margin:8px 0 0;color:#3A1F36}.kp-sentence b{color:#E8795C;font-size:20px}
.kp-sess{border-top:1px dashed #F1D9A8;padding:10px 0;display:grid;gap:6px}.kp-sess-h{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.kp-ok{color:#3f7f78;font-weight:700}.kp-mid{color:#b9854a}
.kp-stations{display:flex;gap:4px}.kp-stations span{width:22px;height:8px;border-radius:4px;background:#f1e7df}.kp-stations span.on{background:#5EA8A0}
.kp-faces{display:flex;gap:14px;font-size:14px;color:#6b5a66}.kp-task{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:15px}
.kp-talk{border-top:1px dashed #F1D9A8;padding:8px 0}.kp-talk ul{margin:4px 0 0;padding-inline-start:18px}
.kp-consent{display:flex;gap:10px;align-items:flex-start;border:2px solid #F1D9A8;border-radius:16px;padding:10px 12px;margin-top:8px;cursor:pointer}.kp-consent.on{border-color:#5EA8A0;background:#E6F3F1}
.kp-consent input{width:22px;height:22px;margin-top:3px}.kp-consent small{display:block;color:#6b5a66;font-size:13px;line-height:1.6}.kp-exp{font-style:normal;background:#D9A866;color:#fff;border-radius:999px;padding:1px 8px;font-size:11px;margin-inline-start:6px}
.kp-danger{border-color:#f0c9bf}.kp-list{margin:0;padding-inline-start:18px;line-height:1.9}
@media (max-width:600px){.kp-hero{grid-template-columns:1fr;justify-items:center;text-align:center}}
`;
