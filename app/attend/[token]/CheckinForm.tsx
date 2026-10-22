'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { STATUS_LABEL } from '../../../lib/attendance/model';
import type { RecordStatus } from '../../../lib/attendance/model';

type Info = {
  id: string; title: string; status: 'open' | 'closed'; session_date: string; start_time: string | null; end_time: string | null;
  late_after_min: number; require_phone: boolean; program_name: string | null; program_name_en: string | null; classroom_code: string | null; trainer_name: string | null; count: number;
};
type Result = { ok: boolean; error?: string; already?: boolean; status?: RecordStatus; checked_in_at?: string; name?: string };

const T = {
  ar: {
    kicker: 'تسجيل الحضور', loading: 'جارٍ التحميل…', none: 'الرابط غير صحيح أو انتهت صلاحيته.', closed: 'انتهى تسجيل الحضور لهذه الجلسة.',
    name: 'الاسم الثلاثي', email: 'البريد الإلكتروني', phone: 'رقم الجوال', optional: 'اختياري', required: 'مطلوب',
    hint: 'استخدم نفس البريد/الجوال في كل الجلسات حتى تُحتسب نسبة حضورك بدقة.', submit: 'تسجيل حضوري', saving: 'جارٍ التسجيل…',
    done: 'تم تسجيل حضورك', again: 'سبق تسجيل حضورك في هذه الجلسة', at: 'وقت التسجيل', status: 'الحالة', late: 'تم احتساب الحضور متأخرًا لأن التسجيل جاء بعد مهلة السماح.',
    attendees: 'حاضر حتى الآن', trainer: 'المدرب', room: 'القاعة', date: 'التاريخ', time: 'الوقت', privacy: 'تُستخدم بياناتك لأغراض الحضور وإصدار الشهادات فقط.',
    errors: { not_found: 'الرابط غير صحيح.', closed: 'انتهى تسجيل الحضور لهذه الجلسة.', bad_name: 'اكتب اسمك الكامل (3 أحرف على الأقل).', bad_email: 'البريد الإلكتروني غير صحيح.', bad_phone: 'رقم الجوال مطلوب (9 أرقام على الأقل).' } as Record<string, string>,
  },
  en: {
    kicker: 'Attendance check-in', loading: 'Loading…', none: 'Invalid or expired link.', closed: 'Check-in for this session has ended.',
    name: 'Full name', email: 'Email', phone: 'Mobile number', optional: 'optional', required: 'required',
    hint: 'Use the same email/mobile in every session so your attendance rate is calculated correctly.', submit: 'Check me in', saving: 'Saving…',
    done: 'You are checked in', again: 'You were already checked in for this session', at: 'Checked in at', status: 'Status', late: 'Marked late because check-in came after the grace period.',
    attendees: 'checked in so far', trainer: 'Trainer', room: 'Room', date: 'Date', time: 'Time', privacy: 'Your data is used for attendance and certificates only.',
    errors: { not_found: 'Invalid link.', closed: 'Check-in for this session has ended.', bad_name: 'Enter your full name (at least 3 characters).', bad_email: 'Invalid email address.', bad_phone: 'Mobile number is required (at least 9 digits).' } as Record<string, string>,
  },
};
const LS = 'tep.attend.me';

export function CheckinForm({ token }: { token: string }) {
  const db = supabase();
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const t = T[lang];
  const [info, setInfo] = useState<Info | null>(null);
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
  const fmtAt = (iso?: string) => iso ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(iso)) : '';

  return (
    <div className="at" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <style>{CSS}</style>
      <div className="at-wrap">
        <header className="at-head">
          <div className="at-logos"><img src="/logos/upm.png" alt="UPM" /><img src="/logos/gate.png" alt="Gate" /></div>
          <div className="at-kicker"><Icon name="check" size={14} /> {t.kicker}</div>
          <button type="button" className="at-lang" onClick={() => setLang(l => (l === 'ar' ? 'en' : 'ar'))}>{lang === 'ar' ? 'English' : 'العربية'}</button>
        </header>

        {state === 'loading' && <div className="at-card at-center">{t.loading}</div>}
        {state === 'none' && <div className="at-card at-center at-bad"><Icon name="alert" size={30} /><b>{t.none}</b></div>}
        {state === 'error' && <div className="at-card at-center at-bad"><Icon name="alert" size={30} /><b>{err}</b></div>}

        {state === 'ready' && info && (
          <>
            <section className="at-card at-info">
              <h1>{info.title}</h1>
              <p className="at-prog">{lang === 'en' && info.program_name_en ? info.program_name_en : info.program_name}</p>
              <div className="at-meta">
                <span><Icon name="calendar" size={14} /> {t.date}: <b>{info.session_date}</b></span>
                {(info.start_time || info.end_time) && <span><Icon name="clock" size={14} /> {t.time}: <b>{fmtTime(info.start_time)}{info.end_time ? ` – ${fmtTime(info.end_time)}` : ''}</b></span>}
                {info.classroom_code && <span><Icon name="school" size={14} /> {t.room}: <b>{info.classroom_code}</b></span>}
                {info.trainer_name && <span><Icon name="users" size={14} /> {t.trainer}: <b>{info.trainer_name}</b></span>}
                <span className="at-count"><Icon name="users" size={14} /> <b>{info.count}</b> {t.attendees}</span>
              </div>
            </section>

            {info.status !== 'open' && !result && <div className="at-card at-center at-warn"><Icon name="pause" size={28} /><b>{t.closed}</b></div>}

            {info.status === 'open' && !result && (
              <form className="at-card" onSubmit={submit} noValidate>
                <label><span>{t.name} <i>*</i></span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoComplete="name" required /></label>
                <label><span>{t.email} <small>({t.optional})</small></span><input type="email" inputMode="email" dir="ltr" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label>
                <label><span>{t.phone} <small>({info.require_phone ? t.required : t.optional})</small>{info.require_phone && <i>*</i>}</span><input type="tel" inputMode="tel" dir="ltr" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></label>
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
                  <span>{t.status}: <b className={`at-pill ${result.status || 'present'}`}>{STATUS_LABEL[result.status || 'present'][lang]}</b></span>
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
.at{min-height:100vh;background:radial-gradient(900px 500px at 90% -10%,rgba(11,138,131,.18),transparent 60%),#f3f6fa;font-family:Tajawal,Arial,sans-serif;color:#0f172a;padding:18px 14px 40px}
.at *{box-sizing:border-box}
.at-wrap{max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.at-head{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#fff;border:1px solid #e2e8f0;border-top:4px solid #c9a24b;border-radius:16px;padding:12px 16px}
.at-logos{display:flex;gap:10px;align-items:center}.at-logos img{height:36px;object-fit:contain}
.at-kicker{font-size:12.5px;font-weight:900;color:#0b8a83;display:flex;align-items:center;gap:6px}
.at-lang{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:6px 12px;font:inherit;font-size:12px;font-weight:800;color:#0f2a4e;cursor:pointer}
.at-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 20px;display:flex;flex-direction:column;gap:12px}
.at-center{align-items:center;text-align:center;justify-content:center}
.at-bad{color:#991b1b;background:#fef2f2;border-color:#fecaca}.at-warn{color:#9a3412;background:#fff7ed;border-color:#fed7aa}
.at-info h1{margin:0;font-size:22px;color:#0f2a4e;line-height:1.4}.at-prog{margin:0;color:#0b8a83;font-weight:800;font-size:14px}
.at-meta{display:flex;flex-wrap:wrap;gap:8px 14px;font-size:12.5px;color:#475569;font-weight:700}.at-meta span{display:inline-flex;align-items:center;gap:5px}.at-meta b{color:#0f2a4e}
.at-count{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:999px;padding:3px 10px;color:#047857}
.at label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:800;color:#334155}.at label i{color:#b91c1c;font-style:normal}.at label small{color:#94a3b8;font-weight:700}
.at input{border:1px solid #cbd5e1;border-radius:12px;padding:13px 14px;font:inherit;font-size:16px;font-weight:700;color:#0f172a;background:#fff;min-width:0}
.at input:focus{outline:2px solid #0b8a83;border-color:#0b8a83}
.at-hint{margin:0;font-size:12.5px;color:#64748b;font-weight:700;display:flex;gap:6px;align-items:flex-start;line-height:1.7}
.at-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:800;display:flex;gap:6px;align-items:center}
.at-btn{border:0;background:#0f2a4e;color:#fff;border-radius:12px;padding:15px;font:inherit;font-size:16px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
.at-btn:disabled{opacity:.6;cursor:wait}
.at-privacy{margin:0;text-align:center;font-size:11.5px;color:#94a3b8;font-weight:700}
.at-done{align-items:center;text-align:center;border-color:#a7f3d0;background:linear-gradient(180deg,#f0fdf9,#fff)}
.at-done.late{border-color:#fed7aa;background:linear-gradient(180deg,#fff7ed,#fff)}
.at-ring{width:84px;height:84px;border-radius:50%;background:#0b8a83;color:#fff;display:grid;place-items:center;box-shadow:0 10px 30px rgba(11,138,131,.35)}
.at-done.late .at-ring{background:#d97706;box-shadow:0 10px 30px rgba(217,119,6,.35)}
.at-done h2{margin:4px 0 0;font-size:21px;color:#0f2a4e}.at-name{margin:0;font-size:16px;font-weight:800;color:#334155}
.at-pill{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:900;background:#ecfdf5;color:#047857!important}
.at-pill.late{background:#fff7ed;color:#b45309!important}.at-pill.excused{background:#eff6ff;color:#1d4ed8!important}.at-pill.absent{background:#fef2f2;color:#b91c1c!important}
.at-latenote{margin:0;font-size:12.5px;color:#9a3412;font-weight:700;line-height:1.7}
`;
