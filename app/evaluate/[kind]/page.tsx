// @ts-nocheck
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';

type Kind = 'daily' | 'final';
type Program = { id: string; name_ar: string };
type Question = { id: string; text_ar: string; text_en: string | null; section_ar: string | null; kind: string; is_required: boolean; options: string[]; min_value: number | null; max_value: number | null; order_index: number };
type Classroom = { id: string; code: string; level: string | null };

export default function EvaluationPage() {
  const params = useParams<{ kind: string }>();
  const router = useRouter();
  const kind = (params.kind === 'final' ? 'final' : 'daily') as Kind;
  const db = supabase();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [programId, setProgramId] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [classroomId, setClassroomId] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  
  // أضفنا الإيميل لبيانات المشارك
  const [profile, setProfile] = useState({ full_name: '', nationality: '', phone: '', email: '' });
  const [templateId, setTemplateId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      
      const [p, pr] = await Promise.all([
        db.from('profiles').select('full_name,nationality,phone,email').eq('id', user.id).single(),
        db.from('programs').select('id,name_ar') // تمت إزالة حالة ACTIVE مؤقتاً لضمان ظهور البرنامج
      ]);
      
      setProfile(p.data || { full_name: '', nationality: '', phone: '', email: '' });
      setPrograms(pr.data || []);
      if (pr.data?.[0]) setProgramId(pr.data[0].id);
      
      setLoading(false);
    })();
  }, [router, db]);

  useEffect(() => {
    if (!programId) return;
    (async () => {
      setMessage('');
      setQuestions([]);
      
      // 1. جلب معرف القالب الصحيح من الجدول الرابط بناءً على نوع التقييم (DAILY/FINAL)
      const { data: linkData } = await db
        .from('program_evaluation_templates')
        .select('template_id')
        .eq('program_id', programId)
        .eq('is_active', true)
        .limit(10); // نجلب الكل لنفلتر محلياً للسرعة

      // جلب معلومات القوالب لنعرف أيهم Daily وأيهم Final
      if (!linkData || linkData.length === 0) {
        setMessage('لا توجد قوالب تقييم مفعلة لهذا البرنامج.');
        return;
      }

      const tIds = linkData.map(l => l.template_id);
      const { data: templates } = await db
        .from('evaluation_templates')
        .select('id, kind')
        .in('id', tIds)
        .eq('kind', kind === 'daily' ? 'DAILY' : 'FINAL');

      const activeTemplateId = templates?.[0]?.id;
      
      if (!activeTemplateId) {
        setMessage('لا يوجد قالب تقييم مطابق (يومي/نهائي) مرتبط بهذا البرنامج.');
        return;
      }

      setTemplateId(activeTemplateId);

      // 2. جلب الأسئلة والقاعات
      const [qRes, cRes] = await Promise.all([
        db.from('questions').select('*').eq('template_id', activeTemplateId).order('order_index'),
        db.from('classrooms').select('id,code,level').eq('program_id', programId).order('code')
      ]);

      setQuestions((qRes.data || []).map((item: any) => ({ ...item, options: Array.isArray(item.options) ? item.options : [] })));
      setClassrooms(cRes.data || []);
      if (cRes.data?.[0]) setClassroomId(cRes.data[0].id);
      
      setAnswers({});
    })();
  }, [programId, kind, db]);

  const grouped = useMemo(() => questions.reduce((a, q) => {
    const k = q.section_ar || 'التقييم';
    (a[k] ??= []).push(q);
    return a;
  }, {} as Record<string, Question[]>), [questions]);

  const set = (id: string, v: string) => setAnswers(x => ({ ...x, [id]: v }));
  
  const requiredMissing = questions.filter(q => q.is_required && !answers[q.id]?.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile.full_name.trim() || !profile.phone.trim() || !profile.email.trim()) {
      setMessage('يرجى تعبئة الاسم ورقم الجوال والبريد الإلكتروني.');
      return;
    }
    if (kind === 'daily' && !classroomId) {
      setMessage('يرجى اختيار القاعة.');
      return;
    }
    if (requiredMissing.length) {
      setMessage(`يرجى الإجابة على ${requiredMissing.length} سؤال إلزامي.`);
      return;
    }

    setSaving(true);
    setMessage('');
    
    const { data: { user } } = await db.auth.getUser();
    if (!user) { router.replace('/login'); return; }
    
    // تحديث بيانات المستخدم لتشمل الإيميل
    await db.from('profiles').update(profile).eq('id', user.id);
    
    const ratings = questions.map(q => Number(answers[q.id])).filter(x => x > 0);
    
    // فحص التكرار (منع تقييم نفس البرنامج في نفس اليوم لنفس القاعة)
    let duplicate = db.from('evaluations').select('id').eq('program_id', programId).eq('trainee_id', user.id).eq('kind', kind === 'daily' ? 'DAILY' : 'FINAL');
    if (kind === 'daily') {
      duplicate = duplicate.eq('classroom_id', classroomId).eq('evaluation_date', new Date().toISOString().slice(0, 10));
    }
    
    const { data: existing } = await duplicate.maybeSingle();
    
    if (existing) {
      setSaving(false);
      setMessage(kind === 'daily' ? '⚠️ عذراً، لقد قمت بتقييم هذه الجلسة مسبقاً.' : '⚠️ عذراً، لقد قمت بتقديم التقييم النهائي مسبقاً.');
      return;
    }

    // إدخال التقييم
    const { data: ev, error } = await db.from('evaluations').insert({
      program_id: programId,
      template_id: templateId,
      trainee_id: user.id,
      classroom_id: kind === 'daily' ? classroomId : null,
      kind: kind === 'daily' ? 'DAILY' : 'FINAL',
      evaluation_date: new Date().toISOString().slice(0, 10),
      overall_rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
    }).select('id').single();

    if (error || !ev) {
      setSaving(false);
      setMessage(error?.message || 'تعذر حفظ التقييم.');
      return;
    }

    // إدخال الإجابات
    const rows = questions.map(q => {
      const value = answers[q.id] || '';
      return {
        evaluation_id: ev.id,
        question_id: q.id,
        rating_value: ['RATING_5', 'STARS', 'LIKERT_5'].includes(q.kind) ? Number(value) || null : null,
        selected_option: ['SINGLE_CHOICE', 'YES_NO'].includes(q.kind) ? value || null : null,
        text_value: ['SHORT_TEXT', 'LONG_TEXT'].includes(q.kind) ? value || null : null
      };
    });

    const { error: answerError } = await db.from('evaluation_answers').insert(rows);
    setSaving(false);
    
    if (answerError) {
      setMessage(answerError.message);
      return;
    }
    
    setMessage('✅ تم إرسال التقييم بنجاح. شكراً لمساهمتك في التحسين.');
    setAnswers({});
  }

  if (loading) return <main className="center" style={{ textAlign: "center", padding: "50px", fontFamily: "Cairo" }}>جارٍ تحميل الاستبيان…</main>;

  return (
    <main className="survey" style={{ direction: "rtl", fontFamily: "Cairo, sans-serif", maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", paddingBottom: "15px", borderBottom: "2px solid #e2e8f0" }}>
        <div>
          <b style={{ fontSize: "18px", color: "#0f172a" }}>{kind === 'daily' ? '📝 التقييم اليومي' : '🏁 التقييم النهائي'}</b>
          <div style={{ fontSize: "12px", color: "#64748b" }}>Arabic / English Evaluation</div>
        </div>
        <button onClick={() => router.back()} style={{ background: "#fff", border: "1px solid #cbd5e1", padding: "6px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}>← رجوع</button>
      </header>

      <form onSubmit={submit}>
        <h1 style={{ textAlign: "center", color: "#0f172a", marginBottom: "8px" }}>{kind === 'daily' ? 'كيف كانت جلستك التدريبية اليوم؟' : 'شاركنا تقييمك الشامل للبرنامج'}</h1>
        <p style={{ textAlign: "center", color: "#64748b", fontSize: "14px", marginBottom: "30px" }}>الحقول المعلَّمة (*) إلزامية. Your feedback is confidential and valuable.</p>
        
        {message && (
          <div style={{ padding: "16px", borderRadius: "12px", marginBottom: "20px", fontWeight: "bold", textAlign: "center", background: message.startsWith('✅') ? "#d1fae5" : "#fee2e2", color: message.startsWith('✅') ? "#047857" : "#b91c1c" }}>
            {message}
          </div>
        )}

        <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "24px", marginBottom: "20px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
          <h2 style={{ fontSize: "16px", color: "#0f172a", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px", marginBottom: "16px" }}>بيانات المشارك</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "bold", color: "#475569" }}>
              الاسم الكامل *
              <input style={{ padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none" }} value={profile.full_name} onChange={e => setProfile({ ...profile, full_name: e.target.value })} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "bold", color: "#475569" }}>
              البريد الإلكتروني *
              <input style={{ padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", direction: "ltr" }} type="email" value={profile.email || ''} onChange={e => setProfile({ ...profile, email: e.target.value })} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "bold", color: "#475569" }}>
              رقم الجوال *
              <input style={{ padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", direction: "ltr" }} value={profile.phone || ''} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "bold", color: "#475569" }}>
              الجنسية
              <input style={{ padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none" }} value={profile.nationality || ''} onChange={e => setProfile({ ...profile, nationality: e.target.value })} />
            </label>
            
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "bold", color: "#475569", gridColumn: kind === 'daily' ? "1 / 2" : "1 / -1" }}>
              البرنامج *
              <select style={{ padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none" }} value={programId} onChange={e => setProgramId(e.target.value)}>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
              </select>
            </label>
            
            {kind === 'daily' && (
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "bold", color: "#475569" }}>
                القاعة الدراسية *
                <select style={{ padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none" }} value={classroomId} onChange={e => setClassroomId(e.target.value)}>
                  {classrooms.map(c => <option key={c.id} value={c.id}>قاعة {c.code} {c.level ? `(${c.level})` : ''}</option>)}
                </select>
              </label>
            )}
          </div>
        </section>

        {questions.length > 0 && Object.entries(grouped).map(([section, qs]) => (
          <section key={section} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "24px", marginBottom: "20px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
            <h2 style={{ fontSize: "16px", color: "#0f172a", borderBottom: "2px solid #10b981", paddingBottom: "10px", marginBottom: "20px", display: "inline-block" }}>{section}</h2>
            
            {qs.map(q => (
              <div key={q.id} style={{ marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid #f1f5f9" }}>
                <b style={{ display: "block", fontSize: "14.5px", color: "#1e293b", marginBottom: "4px" }}>
                  {q.text_ar} {q.is_required && <span style={{ color: "#ef4444" }}>*</span>}
                </b>
                {q.text_en && <small style={{ display: "block", color: "#64748b", marginBottom: "12px", direction: "ltr", textAlign: "left" }}>{q.text_en}</small>}
                
                {['RATING_5', 'STARS', 'LIKERT_5'].includes(q.kind) && (
                  <div style={{ display: "flex", gap: "10px", flexDirection: "row-reverse", justifyContent: "flex-end" }}>
                    {Array.from({ length: q.max_value || 5 }, (_, i) => i + 1).map(v => (
                      <button 
                        key={v} 
                        type="button" 
                        onClick={() => set(q.id, String(v))}
                        style={{ 
                          width: "45px", height: "45px", borderRadius: "10px", border: answers[q.id] === String(v) ? "2px solid #10b981" : "1px solid #cbd5e1",
                          background: answers[q.id] === String(v) ? "#d1fae5" : "#fff", color: answers[q.id] === String(v) ? "#047857" : "#475569",
                          fontSize: "16px", fontWeight: "bold", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" 
                        }}
                      >
                        <span style={{ fontSize: "14px" }}>★</span>
                        <small style={{ fontSize: "11px" }}>{v}</small>
                      </button>
                    ))}
                  </div>
                )}
                
                {['SINGLE_CHOICE', 'YES_NO'].includes(q.kind) && (
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
                    {(q.kind === 'YES_NO' ? ['نعم', 'لا'] : q.options).map(o => (
                      <button 
                        key={o} 
                        type="button" 
                        onClick={() => set(q.id, o)}
                        style={{ 
                          padding: "8px 20px", borderRadius: "20px", border: answers[q.id] === o ? "2px solid #2563eb" : "1px solid #cbd5e1",
                          background: answers[q.id] === o ? "#eff6ff" : "#fff", color: answers[q.id] === o ? "#1d4ed8" : "#475569",
                          fontSize: "13px", fontWeight: "bold", cursor: "pointer" 
                        }}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                )}
                
                {q.kind === 'SHORT_TEXT' && (
                  <input 
                    value={answers[q.id] || ''} 
                    onChange={e => set(q.id, e.target.value)}
                    style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", marginTop: "8px" }}
                  />
                )}
                
                {q.kind === 'LONG_TEXT' && (
                  <textarea 
                    value={answers[q.id] || ''} 
                    onChange={e => set(q.id, e.target.value)}
                    rows={4}
                    style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", marginTop: "8px", resize: "vertical" }}
                  />
                )}
              </div>
            ))}
          </section>
        ))}

        <button 
          disabled={saving || questions.length === 0}
          style={{ width: "100%", padding: "16px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg,#10b981,#0d9488)", color: "#fff", fontSize: "16px", fontWeight: "bold", cursor: saving || questions.length === 0 ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, marginTop: "10px" }}
        >
          {saving ? '⏳ جارٍ إرسال التقييم...' : 'إرسال التقييم ✓'}
        </button>
      </form>
    </main>
  );
}
