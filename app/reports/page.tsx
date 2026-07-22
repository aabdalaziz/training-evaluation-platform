// @ts-nocheck
"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

// ==========================================
// الأنماط البصرية المتقدمة (C-Level Dashboard)
// ==========================================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800;900&display=swap');
.rw, .rw * { font-family: 'Cairo', Tahoma, sans-serif; box-sizing: border-box; }
.lay { display: flex; gap: 20px; align-items: flex-start; }
.side { width: 280px; flex-shrink: 0; background: linear-gradient(180deg, #0b1220, #060b13); border-radius: 24px; padding: 20px; color: #fff; position: sticky; top: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
.main { flex: 1; min-width: 0; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.k3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.card { background: #fffdf9; border: 1px solid #e8decb; border-radius: 22px; padding: 24px; box-shadow: 0 6px 18px rgba(60,40,10,0.04); margin-bottom: 16px; transition: .2s; }
.card:hover { box-shadow: 0 10px 24px rgba(60,40,10,0.07); }
.tab-on { background: #10b981; color: #fff; border: none; border-radius: 12px; padding: 11px 16px; cursor: pointer; font-weight: 800; font-size: 13.5px; width: 100%; display: flex; align-items: center; justify-content: flex-end; gap: 10px; transition: .2s; border: 1px solid #10b981; margin-bottom: 4px;}
.tab-off { background: transparent; color: #94a3b8; border: 1px solid transparent; border-radius: 12px; padding: 11px 16px; cursor: pointer; font-weight: 600; font-size: 13.5px; width: 100%; display: flex; align-items: center; justify-content: flex-end; gap: 10px; transition: .2s; margin-bottom: 4px;}
.tab-off:hover { color: #f1f5f9; background: rgba(255,255,255,0.03); }
.tbl { width: 100%; border-collapse: collapse; margin-top: 10px; }
.th { padding: 12px; text-align: right; font-weight: 700; font-size: 13px; color: #64748b; border-bottom: 2px solid #eef2f6; }
.td { padding: 14px 12px; font-size: 13.5px; border-bottom: 1px solid #f1f5f9; }

/* 🖨️ هندسة الطباعة */
@media print {
  @page { size: A4; margin: 10mm; }
  body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .rw { background: #fff !important; padding: 0 !important; }
  .side, .print-hide { display: none !important; }
  .lay { display: block !important; }
  .main { width: 100% !important; margin: 0 !important; }
  .card { box-shadow: none !important; border: 1px solid #e2e8f0 !important; page-break-inside: avoid; break-inside: avoid; padding: 16px !important; }
  .hero-print { background: #0f172a !important; color: #fff !important; print-color-adjust: exact; }
  svg { max-width: 100% !important; }
}
`;

type Ax = { label: string; section: string; value: number };
type Day = { wd: string; dt: string; count: number };
type Rep = { count: number; avg: number; axes: Ax[]; comments: string[]; dist: number[]; days: Day[]; sections: { name: string; value: number }[] };

const TEAL = "#10b981";
const BLUE = "#2563eb";
const WEEKDAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// الذكاء التفسيري للأرقام
function getInterpretation(score: number): string {
  if (score >= 4.5) return "أداء استثنائي يعكس بيئة تدريبية محفزة ومحتوى عالي الجودة يلبي توقعات المستفيدين.";
  if (score >= 4.0) return "أداء متقدم ومستقر يحقق الأهداف المطلوبة، مع فرص طفيفة للتحسين والابتكار.";
  if (score >= 3.0) return "أداء متوسط يتطلب مراجعة وتدخلاً في بعض الجوانب الإجرائية لرفع مستوى الرضا.";
  if (score > 0) return "أداء حرج يستدعي تدخلاً إدارياً فورياً وإعادة تقييم شاملة للمنهجية المتبعة.";
  return "لا توجد بيانات كافية لاستخراج تفسير تحليلي.";
}

function statusOf(v: number): { t: string; bg: string; fg: string } {
  const val = Number(v) || 0;
  if (val >= 4) return { t: "ممتاز", bg: "#d1fae5", fg: "#047857" };
  if (val >= 3) return { t: "جيد", bg: "#fef3c7", fg: "#b45309" };
  return { t: "تدخل مطلوب", bg: "#fee2e2", fg: "#b91c1c" };
}

function pad(n: number): string { return n < 10 ? "0" + n : "" + n; }

export default function ReportsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [ans, setAns] = useState<any[]>([]);
  const [qs, setQs] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [load, setLoad] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("dashboard");

  const db = supabase();

  const fetchAllData = async () => {
    try {
      const [e, a, q, roomsList, trainersList] = await Promise.all([
        db.from("evaluations").select("*").order("submitted_at", { ascending: false }),
        db.from("evaluation_answers").select("*"),
        db.from("questions").select("*"),
        db.from("classrooms").select("*").order("code"),
        db.from("trainers").select("*").order("name"),
      ]);
      setRows(e.data || []);
      setAns(a.data || []);
      setQs(q.data || []);
      setClassrooms(roomsList.data || []);
      setTrainers(trainersList.data || []);
    } catch (x: any) { setErr(x.message || "حدث خطأ"); }
  };

  useEffect(() => {
    setMounted(true); let on = true;
    (async () => {
      const s = await db.auth.getSession();
      if (!s.data?.session) { router.push("/login"); return; }
      if (on) { await fetchAllData(); setLoad(false); }
    })();
    return () => { on = false; };
  }, []);

  const calc = (kind: "DAILY" | "FINAL"): Rep => {
    const list = (rows || []).filter(r => r && r.kind === kind);
    const ids = new Set(list.map(r => r.id));
    const qm: any = {}; (qs || []).forEach(q => { if (q) qm[q.id] = q; });
    const avg = (a: number[]) => a.length ? a.reduce((p, c) => p + c, 0) / a.length : 0;
    
    const g: any = {};
    (ans || []).forEach(a => {
      if (a && ids.has(a.evaluation_id) && a.rating_value != null) {
        const v = Number(a.rating_value);
        if (!isNaN(v)) { (g[a.question_id] = g[a.question_id] || []).push(v); }
      }
    });

    const axes: Ax[] = Object.keys(g).map(id => ({ label: qm[id] ? qm[id].text_ar : "سؤال", section: qm[id] && qm[id].section_ar ? qm[id].section_ar : "عام", value: avg(g[id]) })).sort((a, b) => b.value - a.value);
    const dist = [0, 0, 0, 0, 0];
    list.forEach(r => { if (!r) return; const v = Math.round(Number(r.overall_rating)); if (v >= 1 && v <= 5) dist[v - 1] += 1; });

    const dayMap: any = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      dayMap[key] = { wd: WEEKDAYS_AR[d.getDay()], dt: pad(d.getMonth() + 1) + "-" + pad(d.getDate()), count: 0 };
    }
    list.forEach(r => {
      if (!r || !r.submitted_at) return;
      const d = new Date(r.submitted_at); if (isNaN(d.getTime())) return;
      const key = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      if (dayMap[key]) dayMap[key].count += 1;
    });
    const days: Day[] = Object.keys(dayMap).map(k => dayMap[k]);

    const sm: any = {};
    axes.forEach(a => { if (!a) return; if (!sm[a.section]) sm[a.section] = { s: 0, n: 0 }; sm[a.section].s += a.value; sm[a.section].n += 1; });
    const sections = Object.keys(sm).map(k => ({ name: k, value: sm[k].s / sm[k].n })).sort((a, b) => b.value - a.value).slice(0, 4);

    const comments: string[] = [];
    (ans || []).forEach(a => { if (a && ids.has(a.evaluation_id) && a.text_value && a.text_value.trim() && comments.length < 6) { comments.push(a.text_value.trim()); } });

    const all = list.map(r => r && Number(r.overall_rating)).filter(v => v !== null && !isNaN(v) && v > 0);
    return { count: list.length, avg: avg(all), axes, comments, dist, days, sections };
  };

  const daily = useMemo(() => calc("DAILY"), [rows, ans, qs]);
  const final = useMemo(() => calc("FINAL"), [rows, ans, qs]);

  const teacherPerformance = useMemo(() => {
    return (trainers || []).map(t => {
      if (!t) return null;
      const myRooms = (classrooms || []).filter(c => c && c.trainer_id === t.id);
      const roomIds = new Set(myRooms.map(c => c.id).filter(Boolean));
      const myEvals = (rows || []).filter(r => r && r.classroom_id && roomIds.has(r.classroom_id));
      const evalIds = new Set(myEvals.map(e => e.id));
      const avg = (a: number[]) => a.length ? a.reduce((p, c) => p + c, 0) / a.length : 0;

      const cl: number[] = []; const te: number[] = []; const dr: number[] = [];
      (ans || []).forEach(a => {
        if (!a || !evalIds.has(a.evaluation_id)) return;
        const v = Number(a.rating_value); if (isNaN(v)) return;
        const q = (qs || []).find(x => x && x.id === a.question_id); if (!q) return;
        const text = q.text_ar || "";
        if (text.includes("وضوح") || text.includes("شرح")) cl.push(v);
        else if (text.includes("أسلوب") || text.includes("تدريس")) te.push(v);
        else if (text.includes("دافعيتك") || text.includes("تفاعلك")) dr.push(v);
      });

      const overall = myEvals.map(r => Number(r.overall_rating)).filter(v => !isNaN(v) && v > 0);
      return { id: t.id, name: t.name, rooms: myRooms.map(r => r.code).filter(Boolean).join("، ") || "لم تُحدد", count: myEvals.length, avg: avg(overall), clarity: avg(cl), teach: avg(te), drive: avg(dr) };
    }).filter(Boolean).sort((a, b) => b.avg - a.avg);
  }, [trainers, classrooms, rows, ans, qs]);

  const bestTeacher = useMemo(() => { const v = (teacherPerformance || []).filter(t => t && t.count > 0); return v.length > 0 ? v[0] : null; }, [teacherPerformance]);

  // ==========================================
  // وظائف الإدارة والتصدير
  // ==========================================
  const handleExportCSV = () => {
    let csv = '\uFEFF--- التقرير اليومي ---\nالمحور,القسم,المتوسط\n';
    daily.axes.forEach(a => { csv += `"${a.label}","${a.section}",${a.value.toFixed(2)}\n`; });
    csv += "\n--- التقرير النهائي ---\nالمحور,القسم,المتوسط\n";
    final.axes.forEach(a => { csv += `"${a.label}","${a.section}",${a.value.toFixed(2)}\n`; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `تقرير_${new Date().toISOString().slice(0,10)}.csv`; link.click();
  };

  const handleClearData = async () => {
    const code = window.prompt("تحذير: سيتم مسح كافة سجلات التقييمات نهائياً.\nللتأكيد، اكتب الرقم: 9999");
    if (code === "9999") {
      setLoad(true);
      try {
        await db.from('evaluation_answers').delete().neq('evaluation_id', '00000000-0000-0000-0000-000000000000');
        await db.from('evaluations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await fetchAllData();
        alert("تم مسح كافة البيانات بنجاح.");
      } catch(e) { alert("حدث خطأ أثناء المسح. راجع الصلاحيات."); }
      setLoad(false);
    } else if (code) { alert("الرقم غير صحيح. تم إلغاء العملية."); }
  };

  if (!mounted || load) return (<div className="rw" style={{ background: "#f2ecdf", minHeight: "100vh", padding: "80px", textAlign: "center", color: "#64748b" }}><style dangerouslySetInnerHTML={{ __html: CSS }} /><div style={{ width: "48px", height: "48px", borderWidth: "5px", borderStyle: "solid", borderColor: "#e2e8f0", borderTopColor: "#10b981", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }}></div><p>جاري تحميل النظام والمؤشرات...</p></div>);

  return (
    <div className="rw">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lay">
        
        {/* القائمة الجانبية */}
        <aside className="side np">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "linear-gradient(135deg,#10b981,#0d9488)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>🏆</div>
            <div>
              <div style={{ fontWeight: "900", fontSize: "15px" }}>لوحة الجودة والامتثال</div>
              <div style={{ fontSize: "11px", color: "#94a3b8" }}>النظام المركزي للتقييم</div>
            </div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column" }}>
            <button className={tab === "dashboard" ? "tab-on" : "tab-off"} onClick={() => setTab("dashboard")}><span>نظرة شاملة</span> 🏠</button>
            <button className={tab === "daily" ? "tab-on" : "tab-off"} onClick={() => setTab("daily")}><span>التقرير اليومي</span> 📝</button>
            <button className={tab === "final" ? "tab-on" : "tab-off"} onClick={() => setTab("final")}><span>التقرير النهائي</span> ⭐</button>
            <button className={tab === "teachers" ? "tab-on" : "tab-off"} onClick={() => setTab("teachers")}><span>أداء المعلمين</span> 👨‍🏫</button>
            <button className={tab === "settings" ? "tab-on" : "tab-off"} onClick={() => setTab("settings")}><span>البيانات والإعدادات</span> ⚙️</button>
          </div>

          <div style={{ marginTop: "18px", borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: "14px" }}>
            <button onClick={() => router.push("/admin/management")} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1", cursor: "pointer", padding: "10px", borderRadius: "10px", fontSize: "13px", fontWeight: "700", marginBottom: "8px" }}>🏫 إدارة القاعات</button>
            <button onClick={() => router.push("/")} style={{ width: "100%", background: "transparent", border: "none", color: "#64748b", cursor: "pointer", textAlign: "right", padding: "8px 10px", fontSize: "13px", fontWeight: "600" }}>← البوابة الرئيسية</button>
          </div>
        </aside>

        {/* المحتوى المركزي */}
        <div className="main">
          
          {/* شريط أدوات التصدير - مخفي في الطباعة */}
          <div className="print-hide" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginBottom: "16px" }}>
            <button onClick={handleExportCSV} style={{ background: "#2563eb", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>📊 تصدير Excel</button>
            <button onClick={() => window.print()} style={{ background: "#0f172a", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>🖨️ طباعة / PDF</button>
          </div>

          <div className="hero-print" style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#0b1220,#111827)", borderRadius: "24px", padding: "24px", color: "#fff", marginBottom: "16px" }}>
            <div style={{ position: "absolute", left: "16px", top: 0, fontSize: "80px", fontWeight: 900, color: "rgba(255,255,255,.04)", letterSpacing: "4px" }}>REPORT</div>
            <div style={{ position: "relative" }}>
              <span style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", borderRadius: "999px", padding: "4px 12px", fontSize: "11px", fontWeight: "700", color: "#e2e8f0", display: "inline-block", marginBottom: "6px" }}>وثيقة رسمية للإدارة التنفيذية</span>
              <h1 style={{ fontSize: "30px", fontWeight: "900", margin: 0 }}>{tab === "dashboard" ? "التقرير العام المتكامل" : tab === "teachers" ? "أداء المعلمين المرتبط بالقاعة" : tab === "settings" ? "إدارة سجلات النظام" : `تقييم ${tab === "daily" ? "الحصة اليومية" : "البرنامج النهائي"}`}</h1>
              <p style={{ color: "#94a3b8", margin: "4px 0 0", fontSize: "13px" }}>توليد تلقائي فوري لمعايير الجودة والامتثال والرضا والتقييم الفردي</p>
            </div>
          </div>

          {err && <div className="print-hide" style={{ background: "#fee2e2", color: "#b91c1c", padding: "12px", borderRadius: "14px", marginBottom: "14px", fontWeight: "bold" }}>⚠️ {err}</div>}

          {tab === "dashboard" && <Overview daily={daily} final={final} best={bestTeacher} />}
          {tab === "daily" && <ReportView rep={daily} accent={BLUE} name="التقرير اليومي المطور" />}
          {tab === "final" && <ReportView rep={final} accent={TEAL} name="التقرير النهائي للبرنامج" />}
          {tab === "teachers" && <TeachersView data={teacherPerformance} best={bestTeacher} />}
          
          {tab === "settings" && (
             <div className="card print-hide" style={{ border: "1px solid #fecaca", background: "#fff5f5" }}>
               <h3 style={{ color: "#b91c1c", fontSize: "18px", fontWeight: "900", marginBottom: "10px" }}>🚨 منطقة الخطر (تفريغ البيانات)</h3>
               <p style={{ color: "#7f1d1d", fontSize: "14px", marginBottom: "20px" }}>يتيح لك هذا الزر مسح جميع الاستجابات والتقييمات السابقة للبدء بدورة تدريبية جديدة. هذه العملية لا رجعة فيها.</p>
               <button onClick={handleClearData} style={{ background: "#ef4444", color: "#fff", border: "none", padding: "12px 24px", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}>🗑️ مسح كافة التقييمات نهائياً</button>
             </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// المكونات الفرعية التفاعلية المتقدمة (Gauge & Area Charts)
// ----------------------------------------------------
function GaugeChart({ score, color }: { score: number; color: string }) {
  const pct = score ? (score / 5) * 100 : 0;
  const radius = 60;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div style={{ textAlign: "center", position: "relative", height: "90px", width: "160px", margin: "0 auto" }}>
      <svg width="160" height="90" viewBox="0 0 160 90">
        <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke="#f1f5f9" strokeWidth="16" strokeLinecap="round" />
        <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke={color} strokeWidth="16" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={isNaN(strokeDashoffset) ? circumference : strokeDashoffset} style={{ transition: "stroke-dashoffset 1s ease-out" }} />
      </svg>
      <div style={{ position: "absolute", bottom: "0px", left: "0", right: "0", fontSize: "28px", fontWeight: "900", color: "#0f172a" }}>{score ? score.toFixed(2) : "0.00"}</div>
    </div>
  );
}

function Overview(p: { daily: Rep; final: Rep; best: any }) {
  const d = p.daily || { count: 0, avg: 0 };
  const f = p.final || { count: 0, avg: 0 };
  return (
    <div>
      <div className="k3" style={{ marginBottom: "16px" }}>
        <div className="card" style={{ textAlign: "center", padding: "30px 20px" }}>
          <div style={{ fontSize: "14px", fontWeight: "700", color: "#64748b", marginBottom: "10px" }}>إجمالي الاستمارات المستلمة</div>
          <div style={{ fontSize: "48px", fontWeight: "900", color: "#0f172a" }}>{Number(d.count || 0) + Number(f.count || 0)}</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "20px" }}>
          <div style={{ fontSize: "14px", fontWeight: "700", color: BLUE, marginBottom: "10px" }}>مؤشر التقييم اليومي</div>
          <GaugeChart score={d.avg} color={BLUE} />
        </div>
        <div className="card" style={{ textAlign: "center", padding: "20px" }}>
          <div style={{ fontSize: "14px", fontWeight: "700", color: TEAL, marginBottom: "10px" }}>مؤشر التقييم النهائي</div>
          <GaugeChart score={f.avg} color={TEAL} />
        </div>
      </div>

      <div className="g2">
        <div className="card">
          <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: "800" }}>📝 القراءة التحليلية للأداء اليومي</h3>
          <p style={{ color: "#334155", fontSize: "14px", lineHeight: "1.8", background: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
            {getInterpretation(d.avg)} بناءً على استجابة ({d.count}) متدرباً، يُعد مستوى الرضا البالغ ({d.avg.toFixed(2)}/5) مؤشراً دقيقاً على التفاعل.
          </p>
        </div>
        <div className="card">
          <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: "800" }}>⭐ القراءة التحليلية للبرنامج النهائي</h3>
          <p style={{ color: "#334155", fontSize: "14px", lineHeight: "1.8", background: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
            {getInterpretation(f.avg)} التقييم الختامي البالغ ({f.avg.toFixed(2)}/5) يعكس الانطباع الشامل للمستفيدين بعد اكتمال التجربة.
          </p>
        </div>
      </div>
    </div>
  );
}

function ReportView(p: { rep: Rep; accent: string; name: string }) {
  const r = p.rep || { count: 0, avg: 0, axes: [], comments: [], dist: [0,0,0,0,0], days: [], sections: [] };
  const top = r.axes && r.axes.length ? r.axes[r.axes.length - 1] : null;
  const low = r.axes && r.axes.length ? r.axes[0] : null;
  const maxD = Math.max(1, ...(r.days || []).map((d: any) => d?.count || 0));
  
  // رسم المساحة (Area Chart)
  const chartH = 120; const chartW = 340; const stepX = chartW / 6;
  const points = (r.days || []).map((d, i) => `${i * stepX},${chartH - ((d.count || 0) / maxD) * chartH}`);
  const pathD = `M 0,${chartH} L ${points.join(" L ")} L ${chartW},${chartH} Z`;
  const lineD = `M ${points.join(" L ")}`;

  return (
    <div>
      <div className="g2" style={{ marginBottom: "16px" }}>
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ flex: 1 }}>
             <h3 style={{ margin: "0 0 5px", fontSize: "18px", fontWeight: "900", color: p.accent }}>{p.name}</h3>
             <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#64748b" }}>الملخص الإحصائي المباشر</p>
             <div style={{ fontSize: "36px", fontWeight: "900", color: "#0f172a" }}>{r.avg ? Number(r.avg).toFixed(2) : "0.00"}<span style={{ fontSize: "16px", color: "#94a3b8" }}>/5</span></div>
          </div>
          <GaugeChart score={r.avg} color={p.accent} />
        </div>

        <div className="card">
          <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: "800" }}>💡 التوصيات الإجرائية (Action Plan)</h3>
          <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "12px", padding: "12px", marginBottom: "10px" }}>
            <b style={{ color: "#047857", fontSize: "13px" }}>✅ نقطة التميز الأبرز:</b>
            <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#334155" }}>محور <b>{top ? top.label : "—"}</b> حقق أعلى درجات الرضا ({top ? Number(top.value).toFixed(2) : "—"}). نوصي بتوثيق هذه الممارسة وتعميمها كقصة نجاح.</p>
          </div>
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "12px", padding: "12px" }}>
            <b style={{ color: "#b45309", fontSize: "13px" }}>🎯 التدخل المطلوب:</b>
            <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#334155" }}>محور <b>{low ? low.label : "—"}</b> سجل التقييم الأدنى ({low ? Number(low.value).toFixed(2) : "—"}). نوصي بعقد ورشة عمل تصحيحية ومراجعة المادة المخصصة لهذا الجزء فوراً.</p>
          </div>
        </div>
      </div>

      <div className="g2" style={{ marginBottom: "16px" }}>
        <div className="card">
          <h3 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: "800" }}>📈 مسار المشاركة (Area Chart) - 7 أيام</h3>
          <svg viewBox={`0 -10 ${chartW + 20} ${chartH + 40}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
            <defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={p.accent} stopOpacity="0.3"/><stop offset="100%" stopColor={p.accent} stopOpacity="0.0"/></linearGradient></defs>
            {/* خطوط الخلفية */}
            <line x1="0" y1={0} x2={chartW} y2={0} stroke="#f1f5f9" strokeDasharray="4,4" />
            <line x1="0" y1={chartH/2} x2={chartW} y2={chartH/2} stroke="#f1f5f9" strokeDasharray="4,4" />
            {/* الرسم البياني */}
            <path d={pathD} fill="url(#areaGrad)" />
            <path d={lineD} fill="none" stroke={p.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {/* النقاط والنصوص */}
            {(r.days || []).map((d, i) => {
              const x = i * stepX; const y = chartH - ((d.count || 0) / maxD) * chartH;
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="4" fill="#fff" stroke={p.accent} strokeWidth="2" />
                  <text x={x} y={y - 10} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">{d.count}</text>
                  <text x={x} y={chartH + 15} textAnchor="middle" fontSize="10" fill="#64748b">{d.wd}</text>
                </g>
              );
            })}
          </svg>
        </div>
        
        <div className="card">
          <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: "800" }}>📊 توزيع النجوم (الهرم التقييمي)</h3>
          {[5, 4, 3, 2, 1].map(s => {
            const idx = s - 1;
            const distVal = r.dist && r.dist[idx] ? r.dist[idx] : 0;
            const w = Math.max(1, ...(r.dist || [1])) > 0 ? (distVal / Math.max(1, ...(r.dist || [1]))) * 100 : 0;
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span style={{ width: "55px", fontSize: "12px", fontWeight: "700", color: "#64748b" }}>{s} نجوم</span>
                <div style={{ flex: 1, height: "14px", background: "#f1f5f9", borderRadius: "8px", overflow: "hidden" }}>
                  <div style={{ width: (isNaN(w) ? 0 : w) + "%", height: "100%", background: p.accent, borderRadius: "8px", opacity: s/5 }} />
                </div>
                <b style={{ width: "25px", textAlign: "left", fontSize: "13px", color: "#0f172a" }}>{distVal}</b>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: "16px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: "800" }}>📋 مصفوفة الأداء التفصيلية للمحاور</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {(r.axes || []).length > 0 ? r.axes.map((a, i) => {
            if (!a) return null;
            const s = statusOf(a.value);
            return (
              <div key={i} style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: "14px", padding: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a", marginBottom: "10px", minHeight: "40px" }}>{a.label}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ background: s.bg, color: s.fg, borderRadius: "6px", padding: "4px 8px", fontSize: "11px", fontWeight: "800" }}>{s.t}</span>
                  <b style={{ color: p.accent, fontSize: "16px" }}>{Number(a.value || 0).toFixed(2)}/5</b>
                </div>
                <div style={{ height: "6px", background: "#f1f5f9", borderRadius: "8px", overflow: "hidden" }}><div style={{ width: (Number(a.value || 0) / 5 * 100) + "%", height: "100%", background: p.accent }} /></div>
              </div>
            );
          }) : <p style={{ color: "#9a8f7d", textAlign: "center" }}>لا توجد بيانات.</p>}
        </div>
      </div>
    </div>
  );
}

function TeachersView(p: { data: any[] }) {
  return (
    <div className="card">
      <h3 style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: "800" }}>📋 مصفوفة تقييم أعضاء هيئة التدريس</h3>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th className="th">الترتيب</th>
              <th className="th">المعلم / المحاضر</th>
              <th className="th">القاعة</th>
              <th className="th">الاستجابات</th>
              <th className="th">المعدل العام</th>
              <th className="th">التفسير الإداري</th>
            </tr>
          </thead>
          <tbody>
            {(p.data || []).map((t, idx) => {
              if (!t || !t.count) return null;
              const s = statusOf(t.avg || 0);
              return (
                <tr key={t.id || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td className="td" style={{ fontWeight: "800", color: idx === 0 ? "#10b981" : "#475569" }}>{idx + 1}</td>
                  <td className="td" style={{ fontWeight: "800", color: "#111" }}>{t.name || "—"}</td>
                  <td className="td" style={{ fontWeight: "700" }}>{t.rooms || "—"}</td>
                  <td className="td">{t.count || 0}</td>
                  <td className="td" style={{ fontSize: "15px", fontWeight: "900", color: "#0f172a" }}>{Number(t.avg || 0).toFixed(2)}</td>
                  <td className="td"><span style={{ background: s.bg, color: s.fg, borderRadius: "999px", padding: "4px 12px", fontSize: "11px", fontWeight: "800" }}>{s.t}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
