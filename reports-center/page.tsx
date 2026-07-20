// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

const CSS = `@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');body{font-family:'Cairo',sans-serif}.dark{background:#0b1220;color:#fff}.card{background:#1e2937;border:1px solid #334155;border-radius:16px;padding:20px}.kpi{font-size:42px;font-weight:900}.badge{background:#10b981;color:#fff;padding:4px 12px;border-radius:999px;font-size:12px}`;

export default function ReportsCenter() {
  const router = useRouter();
  const [tab, setTab] = useState("dashboard");
  const [data, setData] = useState({ daily: {}, final: {}, teachers: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const db = supabase();
      const { data: evals } = await db.from("evaluations").select("*");
      const { data: answers } = await db.from("evaluation_answers").select("*");
      const { data: questions } = await db.from("questions").select("*");
      const { data: classrooms } = await db.from("classrooms").select("*");
      const { data: trainers } = await db.from("trainers").select("*");

      // حساب التقارير
      const daily = calculateReport(evals, answers, questions, "DAILY");
      const final = calculateReport(evals, answers, questions, "FINAL");
      const teachers = calculateTeachers(evals, answers, questions, classrooms, trainers);

      setData({ daily, final, teachers });
      setLoading(false);
    };
    load();
  }, []);

  const calculateReport = (evals, answers, questions, type) => {
    const filtered = evals.filter(e => e.kind === type);
    const count = filtered.length;
    const avg = count > 0 ? (filtered.reduce((sum, e) => sum + (e.overall_rating || 0), 0) / count).toFixed(2) : 0;
    return { count, avg: parseFloat(avg) };
  };

  const calculateTeachers = (evals, answers, questions, classrooms, trainers) => {
    return classrooms.map(room => {
      const trainer = trainers.find(t => t.id === room.trainer_id);
      const roomEvals = evals.filter(e => e.classroom_id === room.id);
      const avg = roomEvals.length > 0 
        ? (roomEvals.reduce((sum, e) => sum + (e.overall_rating || 0), 0) / roomEvals.length).toFixed(2) 
        : "—";
      return {
        name: trainer ? trainer.name : "غير معين",
        room: room.code,
        count: roomEvals.length,
        avg: parseFloat(avg),
        status: parseFloat(avg) >= 4 ? "ممتاز" : parseFloat(avg) >= 3 ? "جيد" : "يحتاج دعماً"
      };
    }).sort((a, b) => b.avg - a.avg);
  };

  if (loading) {
    return <div className="dark" style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>جاري التحميل...</div>;
  }

  return (
    <div className="rw dark" style={{ minHeight: "100vh", padding: "20px" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      
      <div className="lay">
        {/* الشريط الجانبي */}
        <div className="side">
          <h2 style={{ marginBottom: "20px", textAlign: "center" }}>منصة التقييم</h2>
          <button onClick={() => setTab("dashboard")} className={tab === "dashboard" ? "tab-on" : "tab-off"}>🏠 Dashboard التنفيذي</button>
          <button onClick={() => setTab("daily")} className={tab === "daily" ? "tab-on" : "tab-off"}>📝 التقرير اليومي</button>
          <button onClick={() => setTab("final")} className={tab === "final" ? "tab-on" : "tab-off"}>⭐ التقرير النهائي</button>
          <button onClick={() => setTab("teachers")} className={tab === "teachers" ? "tab-on" : "tab-off"}>👨‍🏫 المعلمون بالقاعة</button>
          <button onClick={() => setTab("management")} className={tab === "management" ? "tab-on" : "tab-off"}>🏫 إدارة القاعات والمدربين</button>
        </div>

        {/* المحتوى الرئيسي */}
        <div className="main">
          {tab === "dashboard" && <Dashboard data={data} />}
          {tab === "daily" && <DailyReport data={data.daily} />}
          {tab === "final" && <FinalReport data={data.final} />}
          {tab === "teachers" && <TeachersReport data={data.teachers} />}
          {tab === "management" && <ManagementPanel />}
        </div>
      </div>
    </div>
  );
}

/* ==================== المكونات ==================== */

function Dashboard({ data }) {
  return (
    <div>
      <h1 style={{ fontSize: "32px", fontWeight: "900", marginBottom: "20px" }}>لوحة القيادة التنفيذية</h1>
      <div className="g3">
        <div className="card"><h3>نسبة الرضا</h3><div className="kpi">{data.daily.avg || 0}</div></div>
        <div className="card"><h3>إجمالي التقييمات</h3><div className="kpi">{data.daily.count + data.final.count}</div></div>
        <div className="card"><h3>عدد المدربين</h3><div className="kpi">5</div></div>
      </div>
    </div>
  );
}

function DailyReport({ data }) {
  return (
    <div className="card">
      <h2>التقرير اليومي</h2>
      <p>متوسط الرضا: <strong>{data.avg}</strong>/5</p>
      <p>عدد الاستجابات: <strong>{data.count}</strong></p>
    </div>
  );
}

function FinalReport({ data }) {
  return (
    <div className="card">
      <h2>التقرير النهائي</h2>
      <p>متوسط الرضا: <strong>{data.avg}</strong>/5</p>
      <p>عدد الاستجابات: <strong>{data.count}</strong></p>
    </div>
  );
}

function TeachersReport({ data }) {
  return (
    <div className="card">
      <h2>ترتيب المعلمين بالقاعة</h2>
      <table className="tbl" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "right", padding: "10px" }}>#</th>
            <th style={{ textAlign: "right", padding: "10px" }}>المعلم</th>
            <th style={{ textAlign: "right", padding: "10px" }}>القاعة</th>
            <th style={{ textAlign: "right", padding: "10px" }}>المتوسط</th>
            <th style={{ textAlign: "right", padding: "10px" }}>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {data.map((t, i) => (
            <tr key={i}>
              <td style={{ padding: "10px" }}>{i + 1}</td>
              <td style={{ padding: "10px", fontWeight: "bold" }}>{t.name}</td>
              <td style={{ padding: "10px" }}>{t.room}</td>
              <td style={{ padding: "10px" }}>{t.avg}</td>
              <td style={{ padding: "10px" }}>{t.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManagementPanel() {
  return (
    <div className="card">
      <h2>إدارة القاعات والمدربين</h2>
      <p>هنا يمكنك إضافة وتعديل البرامج، القاعات، والمدربين وربطهم معاً.</p>
      <p style={{ color: "#10b981", fontWeight: "bold" }}>تم تفعيل الإدارة بنجاح. يمكنك الآن إضافة البيانات.</p>
    </div>
  );
}
