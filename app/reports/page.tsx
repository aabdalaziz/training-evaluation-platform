'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';

export default function ReportsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div style={{padding:40,fontFamily:'Cairo',textAlign:'center'}}>جارٍ التحميل...</div>;
  if (!data) return <div style={{padding:40,fontFamily:'Cairo',textAlign:'center'}}>يرجى تسجيل الدخول</div>;

  const daily = data.evals.filter((e:any) => e.kind === 'DAILY');
  const final_ = data.evals.filter((e:any) => e.kind === 'FINAL');
  const dailyAvg = daily.length > 0 ? (daily.reduce((s:number,e:any)=>s+Number(e.overall_rating||0),0)/daily.length) : 0;
  const finalAvg = final_.length > 0 ? (final_.reduce((s:number,e:any)=>s+Number(e.overall_rating||0),0)/final_.length) : 0;

  return (
    <div style={{direction:'rtl',fontFamily:'Cairo,sans-serif',padding:20,background:'#f8fafc',minHeight:'100vh'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'3px solid #0d9488',paddingBottom:15,marginBottom:25}}>
        <div>
          <span style={{background:'#f0fdfa',color:'#0d9488',padding:'4px 12px',borderRadius:99,fontSize:12,fontWeight:700}}>تقرير الأداء المطور</span>
          <h1 style={{color:'#0f172a',margin:'8px 0 4px',fontSize:28,fontWeight:800}}> التقارير التحليلية</h1>
          <p style={{color:'#64748b',margin:0,fontSize:14}}>فصل تام بين اليومي والنهائي مع مؤشرات ذكية</p>
        </div>
        <button onClick={()=>router.push('/dashboard')} style={{background:'#fff',border:'1px solid #cbd5e1',padding:'10px 18px',borderRadius:10,fontWeight:600,cursor:'pointer'}}>← لوحة التحكم</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:25}}>
        <div style={{background:'#fff',borderRight:'6px solid #2563eb',padding:22,borderRadius:14,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
            <b style={{color:'#334155'}}>التقييم اليومي</b>
            <span style={{background:'#f1f5f9',padding:'2px 10px',borderRadius:99,fontSize:11,fontWeight:700}}>{daily.length} استجابة</span>
          </div>
          <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:10}}>
            <strong style={{fontSize:36,fontWeight:800,color:'#0f172a'}}>{dailyAvg.toFixed(2)}</strong>
            <small style={{color:'#64748b',fontSize:16}}>/5</small>
          </div>
          <div style={{height:10,background:'#e2e8f0',borderRadius:99,overflow:'hidden',marginBottom:8}}>
            <div style={{height:'100%',width:`${(dailyAvg/5)*100}%`,background:'linear-gradient(90deg,#2563eb,#3b82f6)',borderRadius:99}}/>
          </div>
          <span style={{fontSize:13,fontWeight:700,color:'#334155'}}>معدل رضا {Math.round((dailyAvg/5)*100)}%</span>
        </div>

        <div style={{background:'#fff',borderRight:'6px solid #0d9488',padding:22,borderRadius:14,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
            <b style={{color:'#334155'}}>التقييم النهائي</b>
            <span style={{background:'#f1f5f9',padding:'2px 10px',borderRadius:99,fontSize:11,fontWeight:700}}>{final_.length} استجابة</span>
          </div>
          <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:10}}>
            <strong style={{fontSize:36,fontWeight:800,color:'#0f172a'}}>{finalAvg.toFixed(2)}</strong>
            <small style={{color:'#64748b',fontSize:16}}>/5</small>
          </div>
          <div style={{height:10,background:'#e2e8f0',borderRadius:99,overflow:'hidden',marginBottom:8}}>
            <div style={{height:'100%',width:`${(finalAvg/5)*100}%`,background:'linear-gradient(90deg,#0d9488,#0f766e)',borderRadius:99}}/>
          </div>
          <span style={{fontSize:13,fontWeight:700,color:'#334155'}}>معدل رضا {Math.round((finalAvg/5)*100)}%</span>
        </div>
      </div>

      <div style={{background:'#fff',padding:22,borderRadius:14,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',marginBottom:20}}>
        <h2 style={{color:'#0f172a',marginTop:0,fontSize:18,fontWeight:800,borderBottom:'1px solid #f1f5f9',paddingBottom:10}}>📊 نتائج المحاور</h2>
        {data.questions.map((q:any) => {
          const related = data.answers.filter((a:any) => a.question_id === q.id && a.rating_value != null);
          const avg = related.length ? related.reduce((s:number,a:any)=>s+Number(a.rating_value),0)/related.length : 0;
          return (
            <div key={q.id} style={{marginBottom:12,padding:12,background:'#f8fafc',borderRadius:10,border:'1px solid #e2e8f0'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8,alignItems:'center'}}>
                <div>
                  <span style={{background:'#f1f5f9',padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700,color:'#475569',marginLeft:8}}>{q.section_ar || 'عام'}</span>
                  <span style={{fontWeight:600,fontSize:13}}>{q.text_ar}</span>
                </div>
                <strong style={{color:'#0d9488',fontSize:14}}>{avg.toFixed(2)}/5</strong>
              </div>
              <div style={{height:8,background:'#e2e8f0',borderRadius:4,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${(avg/5)*100}%`,background:'linear-gradient(90deg,#2563eb,#0d9488)',borderRadius:4,transition:'width 0.5s'}}/>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{textAlign:'center',fontSize:12,color:'#94a3b8',marginTop:30,paddingTop:20,borderTop:'1px solid #e2e8f0'}}>
        جميع الحقوق محفوظة © 2026
      </div>
    </div>
  );
}
