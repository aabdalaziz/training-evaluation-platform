'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { STATUS_LABEL } from '../../../lib/attendance/model';
import type { RecordStatus } from '../../../lib/attendance/model';
import { MicButton, VoiceFill } from '../../components/Dictate'; /* P82-ب «قُل بدل أن تكتب» */
import { SignHelpButton } from '../../components/SignHelp'; /* P82-د */
import { FRANCE, isFranceSession, attendTitleFr, ATTEND_PROGRAM_FR, pickLang, fmtDay } from '../../../lib/cohorts/france'; /* P92 */

/* P87-ب: هل تاريخ الجلسة بعد اليوم (بتوقيت الرياض)؟ */
const isFuture = (d?: string | null) => { if (!d) return false; const today = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10); return d > today; };

type Info = {
  id: string; title: string; status: 'open' | 'closed'; session_date: string; start_time: string | null; end_time: string | null;
  late_after_min: number; require_phone: boolean; program_name: string | null; program_name_en: string | null; classroom_code: string | null; trainer_name: string | null; count: number;
};
type Result = { ok: boolean; error?: string; already?: boolean; status?: RecordStatus; checked_in_at?: string; name?: string };

const T = {
  ar: {
    kicker: 'تسجيل الحضور', loading: 'جارٍ التحميل…', none: 'الرابط غير صحيح أو انتهت صلاحيته.', closed: 'انتهى تسجيل الحضور لهذه الجلسة.', notyet: 'لم يُفتح تسجيل الحضور بعد — يُفتح صباح يوم الجلسة. احتفظ بالرمز وامسحه عند الوصول.',
    name: 'الاسم الثلاثي', email: 'البريد الإلكتروني', phone: 'رقم الجوال', optional: 'اختياري', required: 'مطلوب',
    hint: 'استخدم نفس البريد/الجوال في كل الجلسات حتى تُحتسب نسبة حضورك بدقة.', submit: 'تسجيل حضوري', saving: 'جارٍ التسجيل…',
    done: 'تم تسجيل حضورك', again: 'سبق تسجيل حضورك في هذه الجلسة', at: 'وقت التسجيل', status: 'الحالة', late: 'تم احتساب الحضور متأخرًا لأن التسجيل جاء بعد مهلة السماح.',
    attendees: 'حاضر حتى الآن', trainer: 'الميسّر', room: 'الشعبة', date: 'التاريخ', time: 'الوقت', privacy: 'تُستخدم بياناتك لأغراض الحضور وإصدار الشهادات فقط.',
    errors: { not_found: 'الرابط غير صحيح.', closed: 'انتهى تسجيل الحضور لهذه الجلسة.', bad_name: 'اكتب اسمك الكامل (3 أحرف على الأقل).', bad_email: 'البريد الإلكتروني غير صحيح.', bad_phone: 'رقم الجوال مطلوب (9 أرقام على الأقل).' } as Record<string, string>,
  },
  en: {
    kicker: 'Attendance check-in', loading: 'Loading…', none: 'Invalid or expired link.', closed: 'Check-in for this session has ended.', notyet: 'Check-in is not open yet — it opens on the morning of the session. Keep this code and scan it when you arrive.',
    name: 'Full name', email: 'Email', phone: 'Mobile number', optional: 'optional', required: 'required',
    hint: 'Use the same email/mobile in every session so your attendance rate is calculated correctly.', submit: 'Check me in', saving: 'Saving…',
    done: 'You are checked in', again: 'You were already checked in for this session', at: 'Checked in at', status: 'Status', late: 'Marked late because check-in came after the grace period.',
    attendees: 'checked in so far', trainer: 'Trainer', room: 'Room', date: 'Date', time: 'Time', privacy: 'Your data is used for attendance and certificates only.',
    errors: { not_found: 'Invalid link.', closed: 'Check-in for this session has ended.', bad_name: 'Enter your full name (at least 3 characters).', bad_email: 'Invalid email address.', bad_phone: 'Mobile number is required (at least 9 digits).' } as Record<string, string>,
  },
  fr: {
    kicker: 'Enregistrement de présence', loading: 'Chargement…', none: 'Lien invalide ou expiré.', closed: 'L’enregistrement de présence pour cette séance est terminé.', notyet: 'L’enregistrement n’est pas encore ouvert — il ouvre le matin de la séance. Gardez ce QR code et scannez-le à votre arrivée.',
    name: 'Nom complet', email: 'E-mail', phone: 'Numéro de mobile', optional: 'facultatif', required: 'obligatoire',
    hint: 'Utilisez le même e-mail / mobile à chaque séance pour que votre taux de présence soit calculé correctement.', submit: 'Enregistrer ma présence', saving: 'Enregistrement…',
    done: 'Votre présence est enregistrée', again: 'Votre présence était déjà enregistrée pour cette séance', at: 'Enregistrée à', status: 'Statut', late: 'Notée « en retard » : l’enregistrement est arrivé après le délai de tolérance (8h30).',
    attendees: 'présentes jusqu’ici', trainer: 'Formatrice', room: 'Groupe', date: 'Date', time: 'Horaire', privacy: 'Vos données servent uniquement à la présence et aux certificats.',
    errors: { not_found: 'Lien invalide.', closed: 'L’enregistrement pour cette séance est terminé.', bad_name: 'Écrivez votre nom complet (au moins 3 caractères).', bad_email: 'Adresse e-mail invalide.', bad_phone: 'Le numéro de mobile est obligatoire (au moins 9 chiffres).' } as Record<string, string>,
  },
};
/* P92: حالة الحضور بالفرنسيّة (STATUS_LABEL عربيّ/إنجليزيّ فقط) */
const STATUS_FR: Record<RecordStatus, string> = { present: 'Présente', late: 'En retard', excused: 'Excusée', absent: 'Absente' };
type Lang = 'ar' | 'en' | 'fr';
const LANG_NAME: Record<Lang, string> = { ar: 'العربية', en: 'English', fr: 'Français' };
const LS_LANG = 'tep.attend.lang';
const LS = 'tep.attend.me';

export function CheckinForm({ token }: { token: string }) {
  const db = supabase();
  const [lang, setLangState] = useState<Lang>('ar');
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem(LS_LANG, l); } catch { /* ignore */ } };
  const t = T[lang];
  const [info, setInfo] = useState<Info | null>(null);
  const fr = !!info && isFranceSession({ token, title: info.title, program_name: info.program_name, program_name_en: info.program_name_en }); /* P92 */
  const langs: Lang[] = fr ? ['fr', 'en', 'ar'] : ['ar', 'en'];
  const voiceLang = lang === 'ar' ? 'ar-SA' : lang === 'fr' ? 'fr-FR' : 'en-GB';
  const [state, setState] = useState<'loading' | 'ready' | 'none' | 'error'>('loading');
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    (async () => {
      // تعبئة مسبقة من آخر تسجيل على هذا الجهاز أو من حساب المستخدم إن كان مسجّلًا
      try { const saved = JSON.parse(localStorage.getItem(LS) || 'null'); if (saved?.name) setForm(f => ({ ...f, ...saved })); } catch { /* ignore */ }
      try {
        const { data: { user } } = await db.auth.getUser();
        if (user) {
          let pr: any = {};
          const r1 = await db.from('profiles').select('full_name,email,phone').eq('id', user.id).maybeSingle();
          if (r1.error) { const r2 = await db.from('profiles').select('full_name').eq('id', user.id).maybeSingle(); pr = r2.data || {}; } else pr = r1.data || {};
          setForm(f => ({ name: f.name || pr.full_name || '', email: f.email || pr.email || user.email || '', phone: f.phone || pr.phone || '' }));
        }
      } catch { /* ignore */ }
      const { data, error } = await db.rpc('attendance_session_public', { p_token: token });
      if (error) { setErr(error.message); setState('error'); return; }
      if (!data || !(data as any).id) { setState('none'); return; }
      setInfo(data as Info); setState('ready');
      /* P92: مجموعة فرنسا ⇒ ?lang → المحفوظة → لغة المتصفّح (fr/ar) → en؛ بقيّة الجلسات تبقى عربيّة افتراضيًّا (أو ?lang=en) */
      try {
        const q = new URLSearchParams(location.search).get('lang'); const saved = localStorage.getItem(LS_LANG);
        const d = data as Info;
        if (isFranceSession({ token, title: d.title, program_name: d.program_name, program_name_en: d.program_name_en })) setLangState(pickLang(q, saved, navigator.language));
        else if (q === 'en' || (saved === 'en' && !q)) setLangState('en');
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (form.name.trim().length < 3) { setErr(t.errors.bad_name); return; }
    if (info?.require_phone && form.phone.replace(/\D/g, '').length < 9) { setErr(t.errors.bad_phone); return; }
    setSaving(true);
    try {
      const { data, error } = await db.rpc('attendance_checkin', { p_token: token, p_name: form.name.trim(), p_email: form.email.trim() || null, p_phone: form.phone.trim() || null });
      if (error) throw new Error(error.message);
      const r = data as Result;
      if (!r.ok) { setErr(t.errors[r.error || ''] || r.error || 'error'); return; }
      try { localStorage.setItem(LS, JSON.stringify({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() })); } catch { /* ignore */ }
      setResult(r);
      setInfo(i => i && !r.already ? { ...i, count: i.count + 1 } : i);
    } catch (ex: any) { setErr(ex.message || 'error'); } finally { setSaving(false); }
  }

  const fmtTime = (s: string | null) => (s ? s.slice(0, 5) : '');
  const fmtAt = (iso?: string) => iso ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : lang === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(iso)) : '';

  return (
    <div className="at" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <style>{CSS}</style>
      <div className="at-wrap">
        <header className="at-head">
          <div className="at-logos"><img src="/brand/athar-mark.svg" alt="أَثَر" /></div>
          <div className="at-kicker"><Icon name="check" size={14} /> {t.kicker}</div>
          <div className="at-langs" role="group" aria-label="Language">{langs.map(l => <button key={l} type="button" className={`at-lang ${l === lang ? 'on' : ''}`} onClick={() => setLang(l)} aria-pressed={l === lang} lang={l}>{LANG_NAME[l]}</button>)}</div>
        </header>

        {state === 'loading' && <div className="at-card at-center">{t.loading}</div>}
        {state === 'none' && <div className="at-card at-center at-bad"><Icon name="alert" size={30} /><b>{t.none}</b></div>}
        {state === 'error' && <div className="at-card at-center at-bad"><Icon name="alert" size={30} /><b>{err}</b></div>}

        {state === 'ready' && info && (
          <>
            <section className="at-card at-info">
              <h1>{fr && lang === 'fr' ? attendTitleFr(info.session_date) : info.title}</h1>
              <p className="at-prog">{fr && lang === 'fr' ? ATTEND_PROGRAM_FR : lang === 'en' && info.program_name_en ? info.program_name_en : info.program_name}</p>
              <div className="at-meta">
                <span><Icon name="calendar" size={14} /> {t.date}: <b>{lang === 'fr' ? fmtDay(info.session_date, 'fr', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : info.session_date}</b></span>
                {(info.start_time || info.end_time) && <span><Icon name="clock" size={14} /> {t.time}: <b>{fmtTime(info.start_time)}{info.end_time ? ` – ${fmtTime(info.end_time)}` : ''}</b></span>}
                {info.classroom_code && <span><Icon name="school" size={14} /> {t.room}: <b>{info.classroom_code}</b></span>}
                {info.trainer_name && <span><Icon name="users" size={14} /> {t.trainer}: <b>{fr && lang === 'fr' ? FRANCE.trainer.fr : info.trainer_name}</b></span>}
                <span className="at-count"><Icon name="users" size={14} /> <b>{info.count}</b> {t.attendees}</span>
              </div>
            </section>

            {info.status !== 'open' && !result && <div className="at-card at-center at-warn"><Icon name={isFuture(info.session_date) ? 'calendar' : 'pause'} size={28} /><b>{isFuture(info.session_date) ? t.notyet : t.closed}</b>{isFuture(info.session_date) && <small className="at-muted">{t.date}: {info.session_date} · {info.start_time || '08:00'}</small>}</div>} {/* P87-ب: جلسة مستقبليّة ≠ منتهية */}

            {info.status === 'open' && !result && (
              <form className="at-card" onSubmit={submit} noValidate>
                <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}><SignHelpButton always step="checkin" lang={lang === 'ar' ? 'ar' : 'en'} /><VoiceFill lang={voiceLang} title={lang === 'ar' ? 'املأ النموذج بالكلام' : lang === 'fr' ? 'Remplir à la voix' : 'Fill by voice'} fields={[{ key: 'name', label: t.name, kind: 'name', required: true }, { key: 'email', label: t.email, kind: 'email' }, { key: 'phone', label: t.phone, kind: 'phone', required: !!info.require_phone }]} onFill={(v) => setForm({ name: v.name || form.name, email: v.email || form.email, phone: v.phone || form.phone })} /></div>
                <label><span>{t.name} <i>*</i> <MicButton kind="name" lang={voiceLang} onText={(v) => setForm({ ...form, name: v })} /></span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoComplete="name" required /></label>
                <label><span>{t.email} <small>({t.optional})</small> <MicButton kind="email" lang={voiceLang} onText={(v) => setForm({ ...form, email: v })} /></span><input type="email" inputMode="email" dir="ltr" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label>
                <label><span>{t.phone} <small>({info.require_phone ? t.required : t.optional})</small>{info.require_phone && <i>*</i>} <MicButton kind="phone" lang={voiceLang} onText={(v) => setForm({ ...form, phone: v })} /></span><input type="tel" inputMode="tel" dir="ltr" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></label>
                <p className="at-hint"><Icon name="question" size={14} /> {t.hint}</p>
                {err && <div className="at-err"><Icon name="alert" size={16} /> {err}</div>}
                <button type="submit" className="at-btn" disabled={saving}><Icon name="check" size={18} /> {saving ? t.saving : t.submit}</button>
                <p className="at-privacy">{t.privacy}</p>
              </form>
            )}

            {result && (
              <section className={`at-card at-done ${result.status === 'late' ? 'late' : ''}`}>
                <div className="at-ring"><Icon name="check" size={40} stroke={3} /></div>
                <h2>{result.already ? t.again : t.done}</h2>
                <p className="at-name">{result.name || form.name}</p>
                <div className="at-meta at-center">
                  <span>{t.status}: <b className={`at-pill ${result.status || 'present'}`}>{lang === 'fr' ? STATUS_FR[result.status || 'present'] : STATUS_LABEL[result.status || 'present'][lang]}</b></span>
                  <span>{t.at}: <b>{fmtAt(result.checked_in_at)}</b></span>
                </div>
                {result.status === 'late' && <p className="at-latenote">{t.late}</p>}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.at{min-height:100vh;background:radial-gradient(900px 500px at 90% -10%,rgba(212,97,74,.18),transparent 60%),#F6EBE0;font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif;color:#2A1626;padding:18px 14px 40px}
.at *{box-sizing:border-box}
.at-wrap{max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.at-head{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#fff;border:1px solid #EADFD6;border-top:4px solid #D9A866;border-radius:16px;padding:12px 16px}
.at-logos{display:flex;gap:10px;align-items:center}.at-logos img{height:36px;object-fit:contain}
.at-kicker{font-size:12.5px;font-weight:900;color:#D4614A;display:flex;align-items:center;gap:6px}
.at-langs{display:flex;gap:4px;background:#F6EBE0;border:1px solid #EADFD6;border-radius:999px;padding:3px}
.at-lang{border:0;background:transparent;border-radius:999px;padding:6px 11px;font:inherit;font-size:12px;font-weight:800;color:#6A3350;cursor:pointer}.at-lang.on{background:#3A1F36;color:#fff}
.at-card{background:#fff;border:1px solid #EADFD6;border-radius:16px;padding:18px 20px;display:flex;flex-direction:column;gap:12px}
.at-center{align-items:center;text-align:center;justify-content:center}
.at-bad{color:#9A3A2A;background:#FBEDE7;border-color:#F3C4B6}.at-warn{color:#9A3A2A;background:#FBF4EE;border-color:#F1D9A8}.at-warn .at-muted{display:block;margin-top:6px;color:#6A3350;font-weight:600}
.at-info h1{margin:0;font-size:22px;color:#3A1F36;line-height:1.4}.at-prog{margin:0;color:#D4614A;font-weight:800;font-size:14px}
.at-meta{display:flex;flex-wrap:wrap;gap:8px 14px;font-size:12.5px;color:#5C4858;font-weight:700}.at-meta span{display:inline-flex;align-items:center;gap:5px}.at-meta b{color:#3A1F36}
.at-count{background:#E6F3F1;border:1px solid #BFE1DC;border-radius:999px;padding:3px 10px;color:#2F6B66}
.at label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:800;color:#4A3645}.at label i{color:#B9544A;font-style:normal}.at label small{color:#B3A5AE;font-weight:700}
.at input{border:1px solid #D9CBC2;border-radius:12px;padding:13px 14px;font:inherit;font-size:16px;font-weight:700;color:#2A1626;background:#fff;min-width:0}
.at input:focus{outline:2px solid #D4614A;border-color:#D4614A}
.at-hint{margin:0;font-size:12.5px;color:#8E7F8A;font-weight:700;display:flex;gap:6px;align-items:flex-start;line-height:1.7}
.at-err{background:#FBEDE7;border:1px solid #F3C4B6;color:#9A3A2A;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:800;display:flex;gap:6px;align-items:center}
.at-btn{border:0;background:#3A1F36;color:#fff;border-radius:12px;padding:15px;font:inherit;font-size:16px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
.at-btn:disabled{opacity:.6;cursor:wait}
.at-privacy{margin:0;text-align:center;font-size:11.5px;color:#B3A5AE;font-weight:700}
.at-done{align-items:center;text-align:center;border-color:#BFE1DC;background:linear-gradient(180deg,#E6F3F1,#fff)}
.at-done.late{border-color:#F1D9A8;background:linear-gradient(180deg,#FBF4EE,#fff)}
.at-ring{width:84px;height:84px;border-radius:50%;background:#D4614A;color:#fff;display:grid;place-items:center;box-shadow:0 10px 30px rgba(212,97,74,.35)}
.at-done.late .at-ring{background:#8A5A1E;box-shadow:0 10px 30px rgba(217,119,6,.35)}
.at-done h2{margin:4px 0 0;font-size:21px;color:#3A1F36}.at-name{margin:0;font-size:16px;font-weight:800;color:#4A3645}
.at-pill{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:900;background:#E6F3F1;color:#2F6B66!important}
.at-pill.late{background:#FBF4EE;color:#8A5A1E!important}.at-pill.excused{background:#F3E8EF;color:#6A3350!important}.at-pill.absent{background:#FBEDE7;color:#B9544A!important}
.at-latenote{margin:0;font-size:12.5px;color:#9A3A2A;font-weight:700;line-height:1.7}
`;
