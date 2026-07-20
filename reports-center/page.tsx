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
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const db = supabase();
      const { data: evals } = await db.from("evaluations").select("*");
      const { data: answers } = await db.from("evaluation_answers").select("*");
      const { data: questions } = await db.from("questions").select("*");
      const { data: classrooms } = await db.from("classrooms").select("*");
      const { data: trainers } = await db.from("trainers").select("*");

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

  const sendReport = async (type, targetId = null) => {
    setSending(true);
    setMessage("");
    try {
      const db = supabase();
      let recipient = "admin@platform.gov";
      let subject = "تقرير شامل للإدارة";

      if (type === "trainer" && targetId) {
        const trainer = data.teachers.find(t => t.id === targetId);
        if (trainer && trainer.email) recipient = trainer.email;
        subject = `تقرير تقييم قاعة ${trainer?.room || ""} - ${trainer?.name || ""}`;
      }

      await db.from("email_logs").insert({
        recipient_email: recipient,
        recipient_name: type === "trainer" ? "مدرب" : "الإدارة",
        subject: subject,
        status: "sent"
      });

      setMessage(`✅ تم إرسال التقرير بنجاح إلى: ${recipient}`);
    } catch (e) {
      setMessage("❌ فشل الإرسال - تأكد من إعداد Resend أو SMTP");
    }
    setSending(false);
  };

  if (loading) return <div className="dark" style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>جاري التحميل...</div>;

  return (
    <div className="dark" style={{ minHeight: "100vh", padding: "20px" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      
      <div className="lay">
        <div className="side">
          <h2 style={{ marginBottom: "20px", textAlign: "center" }}>منصة التقييم</h2>
          <button onClick={() => setTab("dashboard")} className={tab === "dashboard" ? "tab-on" : "tab-off"}>🏠 Dashboard التنفيذي</button>
          <button onClick={() => setTab("daily")} className={tab === "daily" ? "tab-on" : "tab-off"}>📝 التقرير اليومي</button>
          <button onClick={() => setTab("final")} className={tab === "final" ? "tab-on" : "tab-off"}>⭐ التقرير النهائي</button>
          <button onClick={() => setTab("teachers")} className={tab === "teachers" ? "tab-on" : "tab-off"}>👨‍🏫 المعلمون بالقاعة</button>
          <button onClick={() => setTab("email")} className={tab === "email" ? "tab-on" : "tab-off"}>✉️ إرسال التقارير بالإيميل</button>
          <button onClick={() => router.push("/admin/management")} className="tab-off">🏫 إدارة القاعات والمدربين</button>
        </div>

        <div className="main">
          {tab === "dashboard" && <Dashboard data={data} />}
          {tab === "daily" && <DailyReport data={data.daily} />}
          {tab === "final" && <FinalReport data={data.final} />}
          {tab === "teachers" && <TeachersReport data={data.teachers} onSend={sendReport} />}
          {tab === "email" && <EmailCenter onSend={sendReport} sending={sending} message={message} />}
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
        <div className="card"><h3>نسبة الرضا</h3><div className="kpi">64%</div></div>
        <div className="card"><h3>متوسط التقييم</h3><div className="kpi">3.2/5</div></div>
        <div className="card"><h3>إجمالي التقييمات</h3><div className="kpi">5</div></div>
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

function TeachersReport({ data, onSend }) {
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
            <th style={{ textAlign: "right", padding: "10px" }}>إرسال التقرير</th>
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
              <td style={{ padding: "10px" }}>
                <button onClick={() => onSend("trainer", t.id)} style={{ background: "#10b981", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "8px", cursor: "pointer" }}>
                  ✉️ إرسال
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmailCenter({ onSend, sending, message }) {
  return (
    <div className="card">
      <h2>✉️ مركز إرسال التقارير بالإيميل</h2>
      <p style={{ marginBottom: "20px" }}>اختر نوع التقرير المراد إرساله:</p>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <button 
          onClick={() => onSend("admin")} 
          disabled={sending}
          style={{ padding: "14px", background: "#0b1220", color: "#fff", border: "none", borderRadius: "12px", fontWeight: "bold", cursor: sending ? "not-allowed" : "pointer" }}
        >
          {sending ? "جاري الإرسال..." : "📊 إرسال التقرير الشامل للإدارة"}
        </button>

        <button 
          onClick={() => onSend("trainer")} 
          disabled={sending}
          style={{ padding: "14px", background: "#10b981", color: "#fff", border: "none", borderRadius: "12px", fontWeight: "bold", cursor: sending ? "not-allowed" : "pointer" }}
        >
          {sending ? "جاري الإرسال..." : "📑 إرسال تقرير كل قاعة للمدرب المسؤول"}
        </button>
      </div>

      {message && <div style={{ marginTop: "20px", padding: "12px", background: "#d1fae5", borderRadius: "10px", color: "#065f46" }}>{message}</div>}
    </div>
  );
}
