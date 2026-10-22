'use client';
/**
 * /student — بوابة المتدرب
 * دخول برابط آمن (OTP) للبريد المسجّل في برنامج نشط، ثم عرض البرامج المسجّل فيها مع روابط التقييم اليومي/النهائي.
 * المنطق كما كان (RPC student_email_registered → signInWithOtp → attach_existing_rostered_student → enrollments)؛ الجديد هو الهوية البصرية الموحّدة.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';

type Program = { id: string; name_ar: string; name_en?: string | null; status: string; is_final_open: boolean };
const STATUS_AR: Record<string, string> = { ACTIVE: 'نشط', DRAFT: 'مسودة', COMPLETED: 'مكتمل', CANCELLED: 'ملغى' };

export default function StudentPortal() {
  const db = supabase();
  const [email, setEmail] = useState(''); const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null); const [busy, setBusy] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]); const [logged, setLogged] = useState(false); const [userEmail, setUserEmail] = useState(''); const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { setLoading(false); return; }
      setLogged(true); setUserEmail(user.email || '');
      await db.rpc('attach_existing_rostered_student');
      const { data } = await db.from('enrollments').select('program:programs(id,name_ar,name_en,status,is_final_open)').eq('trainee_id', user.id).eq('is_active', true);
      setPrograms(((data || []) as any[]).map(x => x.program).filter(Boolean)); setLoading(false);
    })();
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage(null);
    const check = await db.rpc('student_email_registered', { candidate_email: email.trim() });
    if (check.error || !check.data) { setBusy(false); setMessage({ ok: false, text: 'هذا البريد غير مسجّل في أي برنامج نشط. تواصل مع إدارة البرنامج.' }); return; }
    const { error } = await db.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + '/student' } });
    setBusy(false);
    setMessage(error ? { ok: false, text: 'تعذر إرسال الرابط: ' + error.message } : { ok: true, text: 'أرسلنا رابط دخول آمن إلى بريدك. افتحه من الجهاز نفسه لإكمال التقييم.' });
  }

  const shell = (child: React.ReactNode) => <main className="st" dir="rtl"><style>{CSS}</style><div className="st-wrap">{child}</div></main>;
  const head = (kicker: string, title: string, sub: string) => (
    <header className="st-card st-head">
      <div className="st-logos"><img src="/logos/upm.png" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /><img src="/logos/gate.png" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /></div>
      <div className="st-kicker"><Icon name="school" size={14} /> {kicker}</div>
      <h1>{title}</h1>
      <p className="st-sub">{sub}</p>
    </header>
  );

  if (loading) return shell(<div className="st-card st-center st-muted">جارٍ التحقق…</div>);

  if (logged) return shell(<>
    {head('بوابة المتدرب', 'مرحبًا بك', `مسجّل الدخول بالبريد ${userEmail}. اختر التقييم المتاح للبرنامج المسجّل فيه.`)}
    {programs.length ? programs.map(p => (
      <section className="st-card st-prog" key={p.id}>
        <div className="st-prog-head">
          <div><h2>{p.name_ar}</h2>{p.name_en && <small className="st-muted ltr">{p.name_en}</small>}</div>
          <span className={`pill ${p.status === 'ACTIVE' ? 'ok' : p.status === 'COMPLETED' ? 'info' : 'neutral'}`}>{STATUS_AR[p.status] || p.status}</span>
        </div>
        <div className="st-actions">
          <a className="st-btn" href={`/evaluate/daily?program=${p.id}`}><Icon name="calendar" size={15} /> التقييم اليومي</a>
          {p.is_final_open ? <a className="st-btn gold" href={`/evaluate/final?program=${p.id}`}><Icon name="flag" size={15} /> التقييم النهائي</a> : <span className="st-closed"><Icon name="clock" size={13} /> التقييم النهائي يُفتح في ختام البرنامج</span>}
        </div>
      </section>
    )) : <section className="st-card st-center"><div className="st-empty"><Icon name="folder" size={28} /></div><b>لا يوجد برنامج مسجّل لهذا البريد.</b><p className="st-muted">تواصل مع إدارة البرنامج لإضافة بريدك إلى قائمة المتدربين.</p></section>}
    <div className="st-foot"><button className="st-link" onClick={() => db.auth.signOut().then(() => location.reload())}><Icon name="logout" size={14} /> تسجيل الخروج</button></div>
  </>);

  return shell(<>
    {head('بوابة المتدرب', 'بوابة التقييم', 'أدخل بريدك الإلكتروني المسجّل في البرنامج وسنرسل لك رابط دخول آمنًا — بلا كلمة مرور.')}
    <form className="st-card" onSubmit={send}>
      <h2><span className="st-n">1</span>البريد الإلكتروني</h2>
      {message && <div className={`st-msg ${message.ok ? 'ok' : 'bad'}`}><Icon name={message.ok ? 'check' : 'alert'} size={16} /><span>{message.text}</span></div>}
      <label className="st-field"><span>البريد المسجّل لدى إدارة البرنامج<span className="st-req"> *</span></span>
        <input required type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" />
      </label>
      <button className="st-btn primary" disabled={busy}><Icon name="mail" size={15} /> {busy ? 'جارٍ الإرسال…' : 'إرسال رابط الدخول الآمن'}</button>
      <small className="st-muted"><Icon name="shield" size={12} /> الرابط صالح لفترة قصيرة ويُستخدم مرة واحدة. لا نشارك بريدك مع أي جهة.</small>
    </form>
    <section className="st-card st-help">
      <b>هل وصلك رابط تقييم أو رمز QR من المدرب؟</b>
      <p className="st-muted">يمكنك فتحه مباشرة دون تسجيل دخول: <a href="/evaluate/daily">التقييم اليومي</a> · <a href="/evaluate/final">التقييم النهائي</a></p>
    </section>
  </>);
}

const CSS = `
.st{font-family:Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:18px 12px 60px;color:#0f172a}
.st-wrap{max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.st-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 20px;display:flex;flex-direction:column;gap:10px}
.st-head{border-top:5px solid #c9a24b;gap:4px}
.st-logos{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}.st-logos img{height:46px;object-fit:contain}
.st-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.st-head h1{margin:2px 0;font-size:22px;color:#0f2a4e}
.st-sub{margin:4px 0 0;font-size:13.5px;line-height:1.8;color:#334155;background:#f8fafc;border-radius:10px;padding:10px 12px}
.st-muted{color:#64748b;font-size:12.5px;font-weight:700;margin:0;display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap}.ltr{direction:ltr}
.st-card h2{margin:0;font-size:16px;color:#0f2a4e;display:flex;align-items:center;gap:8px}
.st-n{width:26px;height:26px;border-radius:8px;background:#0f2a4e;color:#fff;display:grid;place-items:center;font-size:13px;flex-shrink:0}
.st-field{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:800;color:#334155}.st-req{color:#b91c1c}
.st-field input{border:1px solid #cbd5e1;border-radius:10px;padding:11px;font:inherit;font-size:15px;font-weight:700;color:#0f172a;background:#fff;min-height:44px}
.st-field input:focus{outline:none;border-color:#0b8a83;box-shadow:0 0 0 3px rgba(11,138,131,.16)}
.st-msg{display:flex;gap:10px;align-items:flex-start;border-radius:12px;padding:12px 14px;font-size:13.5px;font-weight:800;line-height:1.8}
.st-msg.bad{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}.st-msg.ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46}.st-msg svg{flex-shrink:0;margin-top:4px}
.st-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#fff;color:#0f2a4e;border:1px solid #cbd5e1;border-radius:12px;padding:11px 18px;font:inherit;font-size:14px;font-weight:900;cursor:pointer;text-decoration:none}
.st-btn:hover{border-color:#0b8a83;color:#0b8a83}
.st-btn.primary{background:#0f2a4e;color:#fff;border-color:#0f2a4e;padding:13px 22px;font-size:15px}.st-btn.primary:hover{background:#163b6e;color:#fff}.st-btn:disabled{opacity:.5;cursor:not-allowed}
.st-btn.gold{background:#fbf5e4;border-color:#ead9a6;color:#8a6a14}.st-btn.gold:hover{border-color:#c9a24b;color:#6b5210}
.st-prog-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.st-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.st-closed{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800;color:#64748b;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:9px 12px}
.st-center{text-align:center;align-items:center;padding:30px 20px}
.st-empty{width:60px;height:60px;border-radius:999px;background:#eef2f7;color:#0f2a4e;display:grid;place-items:center;margin-bottom:4px}
.st-foot{display:flex;justify-content:center}
.st-link{border:0;background:none;color:#64748b;font:inherit;font-size:13px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px}.st-link:hover{background:#fff;color:#b91c1c}
.st-help{background:#f8fafc}.st-help b{font-size:13.5px;color:#0f2a4e}.st-help a{color:#0b8a83;font-weight:800}
`;
