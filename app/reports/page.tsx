'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';

export default function ReportsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'daily' | 'final'>('daily');

  useEffect(() => {
    (async () => {
      try {
        const client = typeof supabase === 'function' ? supabase() : supabase;
        const { data: { session } } = await client.auth.getSession();
        if (!session) { setLoading(false); return; }

        const { data: evals } = await client.from('evaluations').select('*').order('submitted_at', { ascending: false });
        const { data: answers } = await client.from('evaluation_answers').select('*');
        const { data: questions } = await client.from('questions').select('*');

        setData({ evals: evals || [], answers: answers || [], questions: questions || [] });
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div style={{padding:40,fontFamily:'Cairo',textAlign:'center',background:'#f8fafc',minHeight:'100vh'}}>جارٍ التحميل...</div>;
  if (!data) return <div style={{padding:40,fontFamily:'Cairo',textAlign:'center',background:'#f8fafc',minHeight:'100vh'}}>يرجى تسجيل الدخول</div>;

  const daily = data.evals.filter((e:any) => e.kind === 'DAILY');
  const final_ = data.evals.filter((e:any) => e.kind === 'FINAL');
  const dailyAvg = daily.length > 0 ? (daily.reduce((s:number,e:any)=>s+Number(e.overall_rating||0),0)/daily.length) : 0;
  const finalAvg = final_.length > 0 ? (final_.reduce((s:number,e:any)=>s+Number(e.overall_rating||0),0)/final_.length) : 0;

  const getDailyQuestions = () => {
    const dailyEvalIds = new Set(daily.map((e:any) => e.id));
    const dailyAnswers = data.answers.filter((a:any) => dailyEvalIds.has(a.evaluation_id));
    const questionIds = new Set(dailyAnswers.map((a:any) => a.question_id));
    return data.questions.filter((q:any) => questionIds.has(q.id));
  };

  const getFinalQuestions = () => {
    const finalEvalIds = new Set(final_.map((e:any) => e.id));
    const finalAnswers = data.answers.filter((a:any) => finalEvalIds.has(a.evaluation_id));
    const questionIds = new Set(finalAnswers.map((a:any) => a.question_id));
    return data.questions.filter((q:any) => questionIds.has(q.id));
  };

  const getQuestionAvg = (qId:string, evals:any[]) => {
    const evalIds = new Set(evals.map((e:any) => e.id));
    const related = data.answers.filter((a:any) => a.question_id === qId && evalIds.has(a.evaluation_id) && a.rating_value != null);
    return related.length ? related.reduce((s:number,a:any)=>s+Number(a.rating_value),0)/related.length : 0;
  };

  const dailyQuestions = getDailyQuestions();
  const finalQuestions = getFinalQuestions();

  return (
    <div style={{direction:'rtl',fontFamily:'Cairo,sans-serif',background:'#f8fafc',minHeight:'100vh'}}>
      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)',padding:'30px 40px',color:'#fff',boxShadow:'0 4px 20px rgba(0,0,0,0.1)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <span style={{background:'#0d9488',padding:'6px 16px',borderRadius:99,fontSize:12,fontWeight:700,display:'inline-block',marginBottom:12}}>تقرير الأداء المطور</span>
            <h1 style={{margin:'8px 0 4px',fontSize:32,fontWeight:800}}> التقارير التحليلية</h1>
            <p style={{color:'#94a3b8',margin:0,fontSize:14}}>فصل تام بين التقييم اليومي والنهائي مع تحليل ذكي</p>
          </div>
          <button onClick={()=>router.push('/dashboard')} style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff',padding:'12px 24px',borderRadius:10,fontWeight:600,cursor:'pointer',fontSize:14}}>← لوحة التحكم</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,padding:'30px 40px',maxWidth:1400,margin:'0 auto'}}>
        <div style={{background:'#fff',borderRight:'6px solid #2563eb',padding:28,borderRadius:16,boxShadow:'0 4px 12px rgba(0,0,0,0.06)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div>
              <h3 style={{margin:'0 0 4px',color:'#2563eb',fontSize:18,fontWeight:700}}>📝 التقييم اليومي</h3>
              <span style={{background:'#eff6ff',padding:'4px 12px',borderRadius:99,fontSize:12,fontWeight:700,color:'#2563eb'}}>{daily.length} استجابة</span>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'baseline',gap:6,marginBottom:12}}>
            <strong style={{fontSize:48,fontWeight:800,color:'#0f172a'}}>{dailyAvg.toFixed(2)}</strong>
            <small style={{color:'#64748b',fontSize:18,fontWeight:600}}>/5</small>
          </div>
          <div style={{height:12,background:'#e2e8f0',borderRadius:99,overflow:'hidden',marginBottom:10}}>
            <div style={{height:'100%',width:`${(dailyAvg/5)*100}%`,background:'linear-gradient(90deg,#2563eb,#3b82f6)',borderRadius:99,transition:'width 0.6s'}}/>
          </div>
          <span style={{fontSize:14,fontWeight:700,color:'#334155'}}>معدل رضا {Math.round((dailyAvg/5)*100)}%</span>
        </div>

        <div style={{background:'#fff',borderRight:'6px solid #0d9488',padding:28,borderRadius:16,boxShadow:'0 4px 12px rgba(0,0,0,0.06)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div>
              <h3 style={{margin:'0 0 4px',color:'#0d9488',fontSize:18,fontWeight:700}}>🏁 التقييم النهائي</h3>
              <span style={{background:'#f0fdfa',padding:'4px 12px',borderRadius:99,fontSize:12,fontWeight:700,color:'#0d9488'}}>{final_.length} استجابة</span>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'baseline',gap:6,marginBottom:12}}>
            <strong style={{fontSize:48,fontWeight:800,color:'#0f172a'}}>{finalAvg.toFixed(2)}</strong>
            <small style={{color:'#64748b',fontSize:18,fontWeight:600}}>/5</small>
          </div>
          <div style={{height:12,background:'#e2e8f0',borderRadius:99,overflow:'hidden',marginBottom:10}}>
            <div style={{height:'100%',width:`${(finalAvg/5)*100}%`,background:'linear-gradient(90deg,#0d9488,#14b8a6)',borderRadius:99,transition:'width 0.6s'}}/>
          </div>
          <span style={{fontSize:14,fontWeight:700,color:'#334155'}}>معدل رضا {Math.round((finalAvg/5)*100)}%</span>
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{padding:'0 40px',maxWidth:1400,margin:'0 auto 24px'}}>
        <div style={{display:'flex',gap:12,background:'#fff',padding:8,borderRadius:12,boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
          <button onClick={()=>setActiveTab('daily')} style={{flex:1,padding:'14px 24px',borderRadius:8,border:'none',background:activeTab==='daily'?'#2563eb':'transparent',color:activeTab==='daily'?'#fff':'#64748b',fontWeight:700,cursor:'pointer',fontSize:15,transition:'all 0.3s'}}>📝 التقرير اليومي</button>
          <button onClick={()=>setActiveTab('final')} style={{flex:1,padding:'14px 24px',borderRadius:8,border:'none',background:activeTab==='final'?'#0d9488':'transparent',color:activeTab==='final'?'#fff':'#64748b',fontWeight:700,cursor:'pointer',fontSize:15,transition:'all 0.3s'}}>🏁 التقرير النهائي</button>
        </div>
      </div>

      {/* Report Content */}
      <div style={{padding:'0 40px 40px',maxWidth:1400,margin:'0 auto'}}>
        {activeTab === 'daily' ? (
          <div>
            <div style={{background:'#fff',padding:32,borderRadius:16,boxShadow:'0 4px 12px rgba(0,0,0,0.06)',marginBottom:24}}>
              <h2 style={{color:'#2563eb',marginTop:0,fontSize:22,fontWeight:800,borderBottom:'2px solid #eff6ff',paddingBottom:12,marginBottom:24}}> محاور التقييم اليومي</h2>
              {dailyQuestions.length > 0 ? dailyQuestions.map((q:any) => {
                const avg = getQuestionAvg(q.id, daily);
                return (
                  <div key={q.id} style={{marginBottom:16,padding:16,background:'#f8fafc',borderRadius:12,border:'1px solid #e2e8f0'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:10,alignItems:'center'}}>
                      <div>
                        <span style={{background:'#eff6ff',padding:'4px 12px',borderRadius:6,fontSize:11,fontWeight:700,color:'#2563eb',marginLeft:10}}>{q.section_ar || 'عام'}</span>
                        <span style={{fontWeight:600,fontSize:14,color:'#1e293b'}}>{q.text_ar}</span>
                      </div>
                      <strong style={{color:'#2563eb',fontSize:16}}>{avg.toFixed(2)}/5</strong>
                    </div>
                    <div style={{height:10,background:'#e2e8f0',borderRadius:99,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${(avg/5)*100}%`,background:'linear-gradient(90deg,#2563eb,#3b82f6)',borderRadius:99,transition:'width 0.6s'}}/>
                    </div>
                  </div>
                );
              }) : <p style={{textAlign:'center',color:'#64748b',padding:40}}>لا توجد بيانات يومية</p>}
            </div>

            {dailyQuestions.length > 0 && (
              <div style={{background:'#fff',padding:32,borderRadius:16,boxShadow:'0 4px 12px rgba(0,0,0,0.06)'}}>
                <h2 style={{color:'#2563eb',marginTop:0,fontSize:22,fontWeight:800,borderBottom:'2px solid #eff6ff',paddingBottom:12,marginBottom:24}}>🎯 التحليل الذكي والتوصيات</h2>
                {(() => {
                  const sorted = dailyQuestions.map((q:any) => ({q, avg: getQuestionAvg(q.id, daily)})).sort((a,b) => a.avg - b.avg);
                  const lowest = sorted[0];
                  const highest = sorted[sorted.length - 1];
                  return (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
                      <div style={{background:'#f0fdf4',border:'1px solid #dcfce7',padding:20,borderRadius:12}}>
                        <div style={{fontSize:28,marginBottom:8}}>✅</div>
                        <h4 style={{margin:'0 0 8px',color:'#166534',fontSize:14,fontWeight:700}}>المحور الأعلى أداءً</h4>
                        <p style={{margin:0,color:'#15803d',fontSize:13,fontWeight:600}}>{highest.q.text_ar}</p>
                        <p style={{margin:'8px 0 0',color:'#166534',fontSize:18,fontWeight:800}}>{highest.avg.toFixed(2)}/5</p>
                      </div>
                      <div style={{background:'#fffbeb',border:'1px solid #fef3c7',padding:20,borderRadius:12}}>
                        <div style={{fontSize:28,marginBottom:8}}>🎯</div>
                        <h4 style={{margin:'0 0 8px',color:'#92400e',fontSize:14,fontWeight:700}}>مجال التطوير</h4>
                        <p style={{margin:0,color:'#a16207',fontSize:13,fontWeight:600}}>{lowest.q.text_ar}</p>
                        <p style={{margin:'8px 0 0',color:'#92400e',fontSize:18,fontWeight:800}}>{lowest.avg.toFixed(2)}/5</p>
                      </div>
                      <div style={{background:'#eff6ff',border:'1px solid #dbeafe',padding:20,borderRadius:12}}>
                        <div style={{fontSize:28,marginBottom:8}}>📌</div>
                        <h4 style={{margin:'0 0 8px',color:'#1e40af',fontSize:14,fontWeight:700}}>التوصية</h4>
                        <p style={{margin:0,color:'#1d4ed8',fontSize:13,lineHeight:1.6}}>التركيز على "{lowest.q.text_ar}" في الجلسات القادمة لتحسين الأداء العام</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{background:'#fff',padding:32,borderRadius:16,boxShadow:'0 4px 12px rgba(0,0,0,0.06)',marginBottom:24}}>
              <h2 style={{color:'#0d9488',marginTop:0,fontSize:22,fontWeight:800,borderBottom:'2px solid #f0fdfa',paddingBottom:12,marginBottom:24}}>📊 محاور التقييم النهائي</h2>
              {finalQuestions.length > 0 ? finalQuestions.map((q:any) => {
                const avg = getQuestionAvg(q.id, final_);
                return (
                  <div key={q.id} style={{marginBottom:16,padding:16,background:'#f8fafc',borderRadius:12,border:'1px solid #e2e8f0'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:10,alignItems:'center'}}>
                      <div>
                        <span style={{background:'#f0fdfa',padding:'4px 12px',borderRadius:6,fontSize:11,fontWeight:700,color:'#0d9488',marginLeft:10}}>{q.section_ar || 'عام'}</span>
                        <span style={{fontWeight:600,fontSize:14,color:'#1e293b'}}>{q.text_ar}</span>
                      </div>
                      <strong style={{color:'#0d9488',fontSize:16}}>{avg.toFixed(2)}/5</strong>
                    </div>
                    <div style={{height:10,background:'#e2e8f0',borderRadius:99,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${(avg/5)*100}%`,background:'linear-gradient(90deg,#0d9488,#14b8a6)',borderRadius:99,transition:'width 0.6s'}}/>
                    </div>
                  </div>
                );
              }) : <p style={{textAlign:'center',color:'#64748b',padding:40}}>لا توجد بيانات نهائية</p>}
            </div>

            {finalQuestions.length > 0 && (
              <div style={{background:'#fff',padding:32,borderRadius:16,boxShadow:'0 4px 12px rgba(0,0,0,0.06)'}}>
                <h2 style={{color:'#0d9488',marginTop:0,fontSize:22,fontWeight:800,borderBottom:'2px solid #f0fdfa',paddingBottom:12,marginBottom:24}}> التحليل الذكي والتوصيات</h2>
                {(() => {
                  const sorted = finalQuestions.map((q:any) => ({q, avg: getQuestionAvg(q.id, final_)})).sort((a,b) => a.avg - b.avg);
                  const lowest = sorted[0];
                  const highest = sorted[sorted.length - 1];
                  return (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
                      <div style={{background:'#f0fdf4',border:'1px solid #dcfce7',padding:20,borderRadius:12}}>
                        <div style={{fontSize:28,marginBottom:8}}>✅</div>
                        <h4 style={{margin:'0 0 8px',color:'#166534',fontSize:14,fontWeight:700}}>المحور الأعلى أداءً</h4>
                        <p style={{margin:0,color:'#15803d',fontSize:13,fontWeight:600}}>{highest.q.text_ar}</p>
                        <p style={{margin:'8px 0 0',color:'#166534',fontSize:18,fontWeight:800}}>{highest.avg.toFixed(2)}/5</p>
                      </div>
                      <div style={{background:'#fffbeb',border:'1px solid #fef3c7',padding:20,borderRadius:12}}>
                        <div style={{fontSize:28,marginBottom:8}}>🎯</div>
                        <h4 style={{margin:'0 0 8px',color:'#92400e',fontSize:14,fontWeight:700}}>مجال التطوير</h4>
                        <p style={{margin:0,color:'#a16207',fontSize:13,fontWeight:600}}>{lowest.q.text_ar}</p>
                        <p style={{margin:'8px 0 0',color:'#92400e',fontSize:18,fontWeight:800}}>{lowest.avg.toFixed(2)}/5</p>
                      </div>
                      <div style={{background:'#f0fdfa',border:'1px solid #ccfbf1',padding:20,borderRadius:12}}>
                        <div style={{fontSize:28,marginBottom:8}}>📌</div>
                        <h4 style={{margin:'0 0 8px',color:'#115e59',fontSize:14,fontWeight:700}}>التوصية</h4>
                        <p style={{margin:0,color:'#0f766e',fontSize:13,lineHeight:1.6}}>تعزيز "{lowest.q.text_ar}" في البرامج القادمة لضمان استدامة التحسين</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{textAlign:'center',fontSize:12,color:'#94a3b8',padding:'20px 40px',borderTop:'1px solid #e2e8f0',background:'#fff'}}>
        جميع الحقوق محفوظة للمنصة الرقمية لتقييم التدريب © 2026
      </div>
    </div>
  );
}
