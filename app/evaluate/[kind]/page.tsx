// @ts-nocheck
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';

export default function GuestEvaluationPage() {
  const params = useParams();
  const kind = params.kind === 'final' ? 'final' : 'daily';
  const db = supabase();

  const [programs, setPrograms] = useState([]);
  const [programId, setProgramId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [classroomId, setClassroomId] = useState('');
  const [answers, setAnswers] = useState({});
  
  // بيانات الطالب (ستُستخدم لتمييز التقييم ومنع التكرار بدل حساب المستخدم)
  const [studentInfo, setStudentInfo] = useState({ full_name: '', phone: '', email: '', nationality: '' });
  const [templateId, setTemplateId] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false); // لإظهار شاشة الشكر النهائية

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const { data: progs } = await db.from('programs').select('id,name_ar').order('name_ar');
        if (!on) return;
        setPrograms(progs || []);
        if (progs && progs.length > 0) setProgramId(progs[0].id);
        setLoading(false);
      } catch (err) {
        if (on) { setMessage("خطأ في الاتصال بالخادم."); setLoading(false); }
      }
    })();
    return () => { on = false; };
  }, []);

  useEffect(() => {
    if (!programId) return;
    let on = true;
    (async () => {
      setMessage('');
      setQuestions([]);
      
      const { data: linkData } = await db.from('program_evaluation_templates').select('template_id').eq('program_id', programId).eq('is_active', true);

      if (!linkData || linkData.length === 0) {
        if (on) setMessage('لا توجد قوالب تقييم مفعلة لهذا البرنامج.');
        return;
      }

      const tIds = linkData.map(l => l.template_id);
      const { data: templates } = await db.from('evaluation_templates').select('id, kind').in('id', tIds).eq('kind', kind === 'daily' ? 'DAILY' : 'FINAL');
      const activeTemplateId = templates && templates.length > 0 ? templates[0].id : null;
      
      if (!activeTemplateId) {
        if (on) setMessage('لا يوجد قالب تقييم مطابق مرتبط بهذا البرنامج.');
        return;
      }

      if (on) setTemplateId(activeTemplateId);

      const [qRes, cRes] = await Promise.all([
        db.from('questions').select('*').eq('template_id', activeTemplateId).order('order_index'),
        db.from('classrooms').select('id,code,level').eq('program_id', programId).order('code')
      ]);

      if (!on) return;
      setQuestions((qRes.data || []).map(item => ({ ...item, options: Array.isArray(item.options) ? item.options : [] })));
      setClassrooms(cRes.data || []);
      if (cRes.data && cRes.data.length > 0) setClassroomId(cRes.data[0].id);
      setAnswers({});
    })();
    return () => { on = false; };
  }, [programId, kind]);

  const grouped = useMemo(() => questions.reduce((a, q) => {
    const k = q.section_ar || 'التقييم العام';
    if (!a[k]) a[k] = [];
    a[k].push(q);
    return a;
  }, {}), [questions]);

  const set = (id, v) => setAnswers(x => ({ ...x, [id]: v }));
  const requiredMissing = questions.filter(q => q.is_required && (!answers[q.id] || !answers[q.id].trim()));

  async function submit(e) {
    e.preventDefault();
    if (!studentInfo.full_name?.trim() || !studentInfo.phone?.trim() || !studentInfo.email?.trim()) {
      setMessage('يرجى تعبئة الاسم، رقم الجوال، والبريد الإلكتروني.');
      return;
    }
    if (kind === 'daily' && !classroomId) {
      setMessage('يرجى اختيار القاعة.');
      return;
    }
    if (requiredMissing.length > 0) {
      setMessage(`يرجى الإجابة على ${requiredMissing.length} سؤال إلزامي متبقي.`);
      return;
    }

    setSaving(true);
    setMessage('');
    
    try {
      // 1. حفظ أو تحديث بيانات الطالب في جدول الـ profiles كزائر (بدون Auth)
      // نستخدم الإيميل كمعرف فريد للزائر
      const traineeFakeId = studentInfo.email.trim().toLowerCase(); 
      
      const ratings = questions.map(q => Number(answers[q.id])).filter(x => !isNaN(x) && x > 0);
      const today = new Date().toISOString().slice(0, 10);
      
      // 2. منع التكرار بناءً على الإيميل واليوم والقاعة
      let duplicateQuery = db.from('evaluations').select('id').eq('program_id', programId).eq('trainee_id', traineeFakeId).eq('kind', kind === 'daily' ? 'DAILY' : 'FINAL');
      if (kind === 'daily') {
        duplicateQuery = duplicateQuery.eq('classroom_id', classroomId).eq('evaluation_date', today);
      }
      
      const { data: existing } = await duplicateQuery.maybeSingle();
      if (existing) {
        setSaving(false);
        setMessage(kind === 'daily' ? '⚠️ عذراً، سجلاتنا توضح أنك قمت بتقييم هذه الجلسة مسبقاً اليوم.' : '⚠️ عذراً، لقد قمت بتقديم التقييم النهائي مسبقاً.');
        return;
      }

      // 3. إدخال التقييم
      const { data: ev, error } = await db.from('evaluations').insert({
        program_id: programId,
        template_id: templateId,
        trainee_id: traineeFakeId, // نخزن الإيميل هنا لتمييز الطالب
        classroom_id: kind === 'daily' ? classroomId : null,
        kind: kind === 'daily' ? 'DAILY' : 'FINAL',
        evaluation_date: today,
        overall_rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
      }).select('id').single();

      if (error || !ev) throw error || new Error('تعذر حفظ التقييم');

      // 4. إدخال الإجابات
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
      if (answerError) throw answerError;
      
      setIsSuccess(true); // إخفاء النموذج وإظهار رسالة الشكر
    } catch (err) {
      setMessage(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main style={{ textAlign: "center", padding: "80px", fontFamily: "Cairo, sans-serif", color: "#64748b" }}>جارٍ تجهيز الاستبيان التدريبي…</main>;

  if (isSuccess) return (
    <main style={{ direction: "rtl", fontFamily: "Cairo, sans-serif", maxWidth: "600px", margin: "100px auto", padding: "40px", textAlign: "center", background: "#fff", borderRadius: "24px", boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize: "60px", marginBottom: "20px" }}>✅</div>
      <h1 style={{ color: "#047857", marginBottom: "10px" }}>شكراً لمشاركتك!</h1>
      <p style={{ color: "#64748b", fontSize: "15px", lineHeight: "1.6" }}>تم تسجيل تقييمك بنجاح. رأيك يهمنا جداً في تطوير وتحسين جودة البرامج التدريبية.<br/>يمكنك الآن إغلاق هذه الصفحة.</p>
    </main>
  );

  return (
    <main style={{ direction: "rtl", fontFamily: "Cairo, sans-serif", maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <header style={{ textAlign: "center", marginBottom: "30px", paddingBottom: "20px", borderBottom: "2px solid #e2e8f0" }}>
        <b style={{ fontSize: "20px", color: "#0f172a", display: "block" }}>{kind === 'daily' ? '📝 التقييم اليومي لجلسات التدريب' : '🏁 التقييم الختامي للبرنامج التدريبي'}</b>
        <div style={{ fontSize: "13px", color: "#64748b", marginTop: "5px" }}>Evaluation Form - منصة الجودة</div>
      </header>

      <form onSubmit={submit}>
        <p style={{ textAlign: "center", color: "#64748b", fontSize: "14px", marginBottom: "30px" }}>يُرجى تعبئة البيانات بدقة. الحقول المعلَّمة (*) إلزامية.</p>
        
        {message && (
          <div style={{ padding: "16px", borderRadius: "12px", marginBottom: "20px", fontWeight: "bold", textAlign: "center", background: message.includes('⚠️') ? "#fee2e2" : "#f1f5f9", color: message.includes('⚠️') ? "#b91c1c" : "#0f172a" }}>
            {message}
          </div>
        )}

        <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "24px", marginBottom: "20px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
          <h2 style={{ fontSize: "16px", color: "#0f172a", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px", marginBottom: "16px" }}>بيانات المشارك الأساسية</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "bold", color: "#475569" }}>
              الاسم الكامل الثلاثي *
              <input required style={{ padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none" }} value={studentInfo.full_name} onChange={e => setStudentInfo({ ...studentInfo, full_name: e.target.value })} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "bold", color: "#475569" }}>
              البريد الإلكتروني (لتأكيد المشاركة) *
              <input required style={{ padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", direction: "ltr" }} type="email" placeholder="example@email.com" value={studentInfo.email} onChange={e => setStudentInfo({ ...studentInfo, email: e.target.value })} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "bold", color: "#475569" }}>
              رقم الجوال *
              <input required style={{ padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", direction: "ltr" }} placeholder="05xxxxxxxx" value={studentInfo.phone} onChange={e => setStudentInfo({ ...studentInfo, phone: e.target.value })} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "bold", color: "#475569" }}>
              الجنسية
              <input style={{ padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none" }} value={studentInfo.nationality} onChange={e => setStudentInfo({ ...studentInfo, nationality: e.target.value })} />
            </label>
            
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "bold", color: "#475569", gridColumn: kind === 'daily' ? "1 / 2" : "1 / -1" }}>
              البرنامج التدريبي *
              <select required style={{ padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", background: "#f8fafc" }} value={programId} onChange={e => setProgramId(e.target.value)}>
                <option value="">- اختر البرنامج -</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
              </select>
            </label>
            
            {kind === 'daily' && (
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "bold", color: "#475569" }}>
                القاعة الدراسية التي حضرت بها *
                <select required style={{ padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", background: "#f8fafc" }} value={classroomId} onChange={e => setClassroomId(e.target.value)}>
                  <option value="">- اختر القاعة -</option>
                  {classrooms.map(c => <option key={c.id} value={c.id}>قاعة {c.code} {c.level ? `(${c.level})` : ''}</option>)}
                </select>
              </label>
            )}
          </div>
        </section>

        {questions.length > 0 && Object.keys(grouped).map((section) => (
          <section key={section} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "24px", marginBottom: "20px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
            <h2 style={{ fontSize: "16px", color: "#0f172a", borderBottom: "2px solid #10b981", paddingBottom: "10px", marginBottom: "20px", display: "inline-block" }}>{section}</h2>
            
            {grouped[section].map((q) => (
              <div key={q.id} style={{ marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid #f1f5f9" }}>
                <b style={{ display: "block", fontSize: "14.5px", color: "#1e293b", marginBottom: "4px" }}>
                  {q.text_ar} {q.is_required && <span style={{ color: "#ef4444" }}>*</span>}
                </b>
                {q.text_en && <small style={{ display: "block", color: "#64748b", marginBottom: "12px", direction: "ltr", textAlign: "left" }}>{q.text_en}</small>}
                
                {['RATING_5', 'STARS', 'LIKERT_5'].includes(q.kind) && (
                  <div style={{ display: "flex", gap: "10px", flexDirection: "row-reverse", justifyContent: "flex-end" }}>
                    {Array.from({ length: q.max_value || 5 }, (_, i) => i + 1).map(v => (
                      <button 
                        key={v} type="button" onClick={() => set(q.id, String(v))}
                        style={{ 
                          width: "45px", height: "45px", borderRadius: "10px", border: answers[q.id] === String(v) ? "2px solid #10b981" : "1px solid #cbd5e1",
                          background: answers[q.id] === String(v) ? "#d1fae5" : "#fff", color: answers[q.id] === String(v) ? "#047857" : "#475569",
                          fontSize: "16px", fontWeight: "bold", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transition: "0.2s" 
                        }}>
                        <span style={{ fontSize: "14px" }}>★</span>
                        <small style={{ fontSize: "11px" }}>{v}</small>
                      </button>
                    ))}
                  </div>
                )}
                
                {['SINGLE_CHOICE', 'YES_NO'].includes(q.kind) && (
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
                    {(q.kind === 'YES_NO' ? ['نعم', 'لا'] : q.options || []).map((o) => (
                      <button 
                        key={o} type="button" onClick={() => set(q.id, o)}
                        style={{ 
                          padding: "8px 20px", borderRadius: "20px", border: answers[q.id] === o ? "2px solid #2563eb" : "1px solid #cbd5e1",
                          background: answers[q.id] === o ? "#eff6ff" : "#fff", color: answers[q.id] === o ? "#1d4ed8" : "#475569",
                          fontSize: "13px", fontWeight: "bold", cursor: "pointer", transition: "0.2s" 
                        }}>
                        {o}
                      </button>
                    ))}
                  </div>
                )}
                
                {q.kind === 'SHORT_TEXT' && <input placeholder="اكتب إجابتك هنا..." value={answers[q.id] || ''} onChange={e => set(q.id, e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", marginTop: "8px" }} />}
                {q.kind === 'LONG_TEXT' && <textarea placeholder="اكتب ملاحظاتك وتفاصيلها هنا..." value={answers[q.id] || ''} onChange={e => set(q.id, e.target.value)} rows={4} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", marginTop: "8px", resize: "vertical" }} />}
              </div>
            ))}
          </section>
        ))}

        <button 
          disabled={saving || questions.length === 0}
          style={{ width: "100%", padding: "16px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg,#10b981,#0d9488)", color: "#fff", fontSize: "16px", fontWeight: "bold", cursor: saving || questions.length === 0 ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, marginTop: "10px", boxShadow: "0 4px 12px rgba(16,185,129,0.2)" }}>
          {saving ? '⏳ جارٍ إرسال التقييم بأمان...' : 'إرسال التقييم واعتماد النتيجة ✓'}
        </button>
      </form>
    </main>
  );
}
