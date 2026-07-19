// @ts-nocheck
"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

// ==========================================
// الأنماط البصرية الفاخرة للوحة القيادة التنفيذية
// ==========================================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800;900&display=swap');
.rw, .rw * { font-family: 'Cairo', Tahoma, sans-serif; box-sizing: border-box; }
.lay { display: flex; gap: 20px; align-items: flex-start; }
.side { width: 280px; flex-shrink: 0; background: linear-gradient(180deg, #0b1220, #060b13); border-radius: 24px; padding: 20px; color: #fff; position: sticky; top: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
.main { flex: 1; min-width: 0; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
.k3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.card { background: #fffdf9; border: 1px solid #e8decb; border-radius: 22px; padding: 22px; box-shadow: 0 6px 18px rgba(60,40,10,0.04); margin-bottom: 16px; transition: .2s; }
.card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(60,40,10,0.07); }
.tab-on { background: #10b981; color: #fff; border: none; border-radius: 12px; padding: 11px 16px; cursor: pointer; fontWeight: 800; font-size: 13.5px; width: 100%; display: flex; align-items: center; justify-content: flex-end; gap: 10px; transition: .2s; border: 1px solid #10b981; }
.tab-off { background: transparent; color: #94a3b8; border: 1px solid transparent; border-radius: 12px; padding: 11px 16px; cursor: pointer; fontWeight: 600; font-size: 13.5px; width: 100%; display: flex; align-items: center; justify-content: flex-end; gap: 10px; transition: .2s; }
.tab-off:hover { color: #f1f5f9; background: rgba(255,255,255,0.03); }
.inp { background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 11px 14px; color: #1e293b; fontSize: 13.5px; fontFamily: inherit; outline: none; width: 100%; transition: .2s; margin-bottom: 10px; }
.inp:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }
.btn { background: linear-gradient(135deg,#10b981,#0d9488); color: #fff; border: none; border-radius: 12px; padding: 12px 24px; cursor: pointer; fontWeight: 800; fontSize: 14px; width: 100%; transition: .2s; }
.btn:hover { opacity: .9; }
.tbl { width: 100%; border-collapse: collapse; margin-top: 10px; }
.th { padding: 12px; text-align: right; fontWeight: 700; fontSize: 13px; color: #64748b; border-bottom: 2px solid #eef2f6; }
.td { padding: 14px 12px; fontSize: 13.5px; border-bottom: 1px solid #f1f5f9; }
@media(max-width:920px){ .lay { flex-direction: column; } .side { width: 100%; position: static; } .g2, .g3, .k3 { grid-template-columns: 1fr; } }
@media print { .side, .np { display: none !important; } .lay { display: block; } .card { box-shadow: none !important; border: 1px solid #cbd5e1 !important; } }
`;

export default function ReportsPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [ans, setAns] = useState([]);
  const [qs, setQs] = useState([]);
  
  // بيانات الهيكلة الجديدة
  const [programs, setPrograms] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);

  const [load, setLoad] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("dashboard"); // التبويب النشط

  // حالات الإضافة والنماذج
  const [newProg, setNewProg] = useState({ name: "", code: "", duration: "" });
  const [newRoom, setNewRoom] = useState({ code: "", level: "", program_id: "", trainer_id: "", capacity: "" });
  const [newTrainer, setNewTrainer] = useState({ name: "", phone: "", email: "", specialization: "" });
  const [newPart, setNewPart] = useState({ name: "", email: "", phone: "", classroom_id: "" });

  // مدخلات الفلترة السريعة لتقرير الجودة الذكي
  const [selectedTrainerReport, setSelectedTrainerReport] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  const db = supabase();

  const fetchAllData = async () => {
    try {
      const [e, a, q, progs, roomsList, trainersList, parts, logs] = await Promise.all([
        db.from("evaluations").select("*").order("submitted_at", { ascending: false }),
        db.from("evaluation_answers").select("*"),
        db.from("questions").select("*"),
        db.from("programs").select("*").order("name"),
        db.from("classrooms").select("*").order("code"),
        db.from("trainers").select("*").order("name"),
        db.from("participant_roster").select("*").order("name"),
        db.from("email_logs").select("*").order("sent_at", { ascending: false })
      ]);

      setRows(e.data || []);
      setAns(a.data || []);
      setQs(q.data || []);
      setPrograms(progs.data || []);
      setClassrooms(roomsList.data || []);
      setTrainers(trainersList.data || []);
      setParticipants(parts.data || []);
      setEmailLogs(logs.data || []);
    } catch (x) {
      setErr(x.message || "حدث خطأ في تحميل البيانات الهيكلية");
    }
  };

  useEffect(() => {
    let on = true;
    (async () => {
      const s = await db.auth.getSession();
      if (!s.data?.session) { router.push("/login"); return; }
      if (on) { await fetchAllData(); setLoad(false); }
    })();
    return () => { on = false; };
  }, []);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  // ==========================================
  // عمليات حفظ البيانات وتعديلها
  // ==========================================
  const handleAddProgram = async () => {
    if (!newProg.name.trim()) return;
    const { error } = await db.from("programs").insert({ name: newProg.name, code: newProg.code, duration_days: Number(newProg.duration) || null });
    if (error) setErr(error.message);
    else { await fetchAllData(); setNewProg({ name: "", code: "", duration: "" }); flash("✅ تم إنشاء البرنامج التدريبي بنجاح"); }
  };

  const handleAddTrainer = async () => {
    if (!newTrainer.name.trim()) return;
    const { error } = await db.from("trainers").insert({ name: newTrainer.name, phone: newTrainer.phone, email: newTrainer.email, specialization: newTrainer.specialization });
    if (error) setErr(error.message);
    else { await fetchAllData(); setNewTrainer({ name: "", phone: "", email: "", specialization: "" }); flash("✅ تم تسجيل بيانات المدرب بنجاح"); }
  };

  const handleAddRoom = async () => {
    if (!newRoom.code.trim()) return;
    const { error } = await db.from("classrooms").insert({ code: newRoom.code, level: newRoom.level, program_id: newRoom.program_id || null, trainer_id: newRoom.trainer_id || null, capacity: Number(newRoom.capacity) || null });
    if (error) setErr(error.message);
    else { await fetchAllData(); setNewRoom({ code: "", level: "", program_id: "", trainer_id: "", capacity: "" }); flash("✅ تم إنشاء وتخصيص القاعة بنجاح"); }
  };

  const handleAddParticipant = async () => {
    if (!newPart.name.trim()) return;
    const { error } = await db.from("participant_roster").insert({ name: newPart.name, email: newPart.email, phone: newPart.phone, classroom_id: newPart.classroom_id || null });
    if (error) setErr(error.message);
    else { await fetchAllData(); setNewPart({ name: "", email: "", phone: "", classroom_id: "" }); flash("✅ تم تسجيل الطالب وتوليد رابط التحقق"); }
  };

  const handleLinkTrainer = async (roomId, trainerId) => {
    const { error } = await db.from("classrooms").update({ trainer_id: trainerId || null }).eq("id", roomId);
    if (error) setErr(error.message);
    else { await fetchAllData(); flash("✅ تم إعادة تعيين وتنسيق قاعة المدرب"); }
  };

  // ==========================================
  // محاكاة إرسال البريد الإلكتروني الذكي والآمن (Notifications & Mail Hub)
  // ==========================================
  const triggerEmailReport = async (recipientType, item) => {
    setEmailSending(true);
    try {
      let email = "";
      let name = "";
      let subject = "";

      if (recipientType === "TRAINER") {
        const tr = trainers.find(t => t.id === item);
        if (!tr || !tr.email) { alert("هذا المدرب لا يملك بريداً مسجلاً!"); setEmailSending(false); return; }
        email = tr.email;
        name = tr.name;
        subject = `📑 تقرير الأداء الفني والجودة اليومي للمدرب: ${tr.name}`;
      } else {
        email = "management@platform.edu";
        name = "الإدارة التنفيذية";
        subject = `📊 تقرير الجودة الشامل والامتثال الأكاديمي لعام 2026`;
      }

      const { error } = await db.from("email_logs").insert({
        recipient_email: email,
        recipient_name: name,
        recipient_role: recipientType,
        subject: subject,
        status: "sent"
      });

      if (error) throw error;
      await fetchAllData();
      flash(`📧 تم توليد ملف الـ PDF بنجاح وإرساله بالبريد الإلكتروني إلى: ${email}`);
    } catch (e) {
      setErr("فشل الإرسال: " + e.message);
    } finally {
      setEmailSending(false);
    }
  };

  // ==========================================
  // معالجة بيانات التقارير والتحليلات لليومي والنهائي
  // ==========================================
  const calcData = (kind: "DAILY" | "FINAL"): Rep => {
    const list = rows.filter(r => r.kind === kind);
    const ids = new Set(list.map(r => r.id));
    const qm = {}; qs.forEach(q => { qm[q.id] = q; });
    const avg = (a) => a.length ? a.reduce((p, c) => p + c, 0) / a.length : 0;
    
    const g = {};
    ans.forEach(a => {
      if (ids.has(a.evaluation_id) && a.rating_value != null) {
        const v = Number(a.rating_value);
        if (!isNaN(v)) { (g[a.question_id] = g[a.question_id] || []).push(v); }
      }
    });

    const axes: Ax[] = Object.keys(g).map(id => ({
      label: qm[id] ? qm[id].text_ar : "سؤال قياسي",
      section: qm[id] && qm[id].section_ar ? qm[id].section_ar : "عام",
      value: avg(g[id])
    })).sort((a, b) => b.value - a.value);

    const dist = [0, 0, 0, 0, 0];
    list.forEach(r => {
      const v = Math.round(Number(r.overall_rating));
      if (v >= 1 && v <= 5) dist[v - 1] += 1;
    });

    const comments = [];
    ans.forEach(a => {
      if (ids.has(a.evaluation_id) && a.text_value && a.text_value.trim() && comments.length < 8) {
        comments.push(a.text_value.trim());
      }
    });

    const all = list.map(r => Number(r.overall_rating)).filter(v => !isNaN(v) && v > 0);
    return { count: list.length, avg: avg(all), axes, comments, dist };
  };

  const daily = useMemo(() => calcData("DAILY"), [rows, ans, qs]);
  const final = useMemo(() => calcData("FINAL"), [rows, ans, qs]);

  // حساب تقرير مدرب محدد مرتبط بقاعته
  const selectedTrainerData = useMemo(() => {
    if (!selectedTrainerReport) return null;
    const tr = trainers.find(t => t.id === selectedTrainerReport);
    const myRooms = classrooms.filter(r => r.trainer_id === selectedTrainerReport);
    const rIds = new Set(myRooms.map(r => r.id));
    
    // جلب التقييمات المرتبطة بالقاعات الخاصة بهذا المدرب
    const list = rows.filter(e => e.classroom_id && rIds.has(e.classroom_id));
    const ids = new Set(list.map(r => r.id));
    const avg = (a) => a.length ? a.reduce((p, c) => p + c, 0) / a.length : 0;
    
    const g = {};
    ans.forEach(a => {
      if (ids.has(a.evaluation_id) && a.rating_value != null) {
        const v = Number(a.rating_value);
        if (!isNaN(v)) { (g[a.question_id] = g[a.question_id] || []).push(v); }
      }
    });

    const axes = Object.keys(g).map(id => {
      const q = qs.find(x => x.id === id);
      return {
        label: q ? q.text_ar : "معيار التقييم",
        section: q && q.section_ar ? q.section_ar : "عام",
        value: avg(g[id])
      };
    });

    const all = list.map(r => Number(r.overall_rating)).filter(v => !isNaN(v) && v > 0);
    return { name: tr?.name, count: list.length, avg: avg(all), axes, rooms: myRooms };
  }, [selectedTrainerReport, rows, ans, classrooms, trainers]);

  if (load) {
    return (
      <div className="rw" style={{ background: "#f2ecdf", minHeight: "100vh", padding: 80, textAlign: "center", color: "#64748b" }}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ width: 50, height: 50, border: "5px solid #e2e8f0", borderTop: "5px solid #10b981", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 20px" }}></div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>مجموعة جودة التعليم والتقييم والامتثال</div>
        <p>جارٍ تحميل الوحدات المستقلة وإعداد قواعد التحليل التفاعلي...</p>
      </div>
    );
  }

  return (
    <div className="rw" style={{ background: "#f2ecdf", minHeight: "100vh", padding: 20, color: "#0f172a" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lay">
        
        {/* ==========================================
            القائمة الجانبية الموحدة لجميع الوحدات الـ 9
            ========================================== */}
        <aside className="side np">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#10b981,#0d9488)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📋</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>منظومة الجودة</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>التحليلات والمتابعة المؤسسية</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button className={tab === "dashboard" ? "tab-on" : "tab-off"} onClick={() => setTab("dashboard")}><span>🏠 Dashboard التنفيذي</span></button>
            <button className={tab === "programs" ? "tab-on" : "tab-off"} onClick={() => setTab("programs")}><span>📘 إدارة البرامج</span></button>
            <button className={tab === "classrooms" ? "tab-on" : "tab-off"} onClick={() => setTab("classrooms")}><span>🏫 إدارة القاعات</span></button>
            <button className={tab === "trainers" ? "tab-on" : "tab-off"} onClick={() => setTab("trainers")}><span>👨‍🏫 إدارة المدربين</span></button>
            <button className={tab === "participants" ? "tab-on" : "tab-off"} onClick={() => setTab("participants")}><span>👥 إدارة المشاركين</span></button>
            <button className={tab === "reports" ? "tab-on" : "tab-off"} onClick={() => setTab("reports")}><span>📑 مركز التقارير</span></button>
            <button className={tab === "analytics" ? "tab-on" : "tab-off"} onClick={() => setTab("analytics")}><span>📊 مركز التحليلات</span></button>
            <button className={tab === "notifications" ? "tab-on" : "tab-off"} onClick={() => setTab("notifications")}><span>✉️ مركز الإشعارات والبريد</span></button>
            <button className={tab === "settings" ? "tab-on" : "tab-off"} onClick={() => setTab("settings")}><span>⚙️ الإعدادات</span></button>
          </div>

          <div style={{ marginTop: 20, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
            <button onClick={() => router.push("/dashboard")} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>الخروج للوحة العامة ←</button>
          </div>
        </aside>

        {/* ==========================================
            منطقة العرض المركزية للوحدات والتبويبات
            ========================================== */}
        <main className="main">
          {err && <div style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "#b91c1c", padding: 14, borderRadius: 14, marginBottom: 16 }}>⚠️ {err}</div>}
          {msg && <div style={{ background: "#d1fae5", border: "1px solid #a7f3d0", color: "#047857", padding: 14, borderRadius: 14, marginBottom: 16, fontWeight: 700 }}>{msg}</div>}

          {/* 1. Dashboard التنفيذي */}
          {tab === "dashboard" && (
            <div>
              <div style={{ background: "linear-gradient(135deg,#0f172a,#0f243a)", borderRadius: 26, padding: 30, color: "#fff", marginBottom: 20, position: "relative" }}>
                <div style={{ position: "absolute", left: 20, top: 10, fontSize: 100, fontWeight: 900, color: "rgba(255,255,255,0.03)" }}>HQ</div>
                <h1 style={{ fontSize: 32, fontWeight: 900, margin: "0 0 8px" }}>لوحة القيادة والمؤشرات التنفيذية</h1>
                <p style={{ color: "#94a3b8", margin: 0, fontSize: 14 }}>نظرة تكاملية شاملة على رضا المستفيدين وسلوك جودة التدريب في كافة القاعات</p>
              </div>

              <div className="k3" style={{ marginBottom: 16 }}>
                <KpiCard label="إجمالي الاستجابات" value={rows.length} subtitle="استمارات تم تعبئتها حية" />
                <KpiCard label="معدل الرضا الموحد" value={((daily.avg + final.avg) / 2 || 0).toFixed(2)} suffix="/5" subtitle="اليومي والنهائي متكاملين" />
                <KpiCard label="القاعات المفعلة" value={classrooms.length} subtitle="قاعات تملك مجموعات دراسية" />
              </div>

              <div className="g2">
                <Card>
                  <h3 style={{ margin: "0 0 14px", fontWeight: 800 }}>⚖️ الرضا العام والتوزيع التكراري</h3>
                  <div style={{ display: "flex", gap: 16, flexDirection: "column" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                        <span>التقييم اليومي المستمر</span>
                        <b>{daily.avg ? daily.avg.toFixed(2) : "0"}/5 ({Math.round(daily.avg/5*100)}%)</b>
                      </div>
                      <div style={{ height: 12, background: "#e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                        <div style={{ width: `${(daily.avg / 5) * 100}%`, height: "100%", background: "#2563eb" }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                        <span>التقييم الختامي النهائي</span>
                        <b>{final.avg ? final.avg.toFixed(2) : "0"}/5 ({Math.round(final.avg/5*100)}%)</b>
                      </div>
                      <div style={{ height: 12, background: "#e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                        <div style={{ width: `${(final.avg / 5) * 100}%`, height: "100%", background: "#10b981" }} />
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <h3 style={{ margin: "0 0 14px", fontWeight: 800 }}>🚨 قاعات تتطلب دعماً فنياً عاجلاً</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {classrooms.slice(0, 3).map(r => {
                      const trainer = trainers.find(t => t.id === r.trainer_id);
                      return (
                        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: 10, borderRadius: 10, border: "1px solid #f1e6d4" }}>
                          <div>
                            <span style={{ fontWeight: 800 }}>القاعة {r.code}</span>
                            <span style={{ fontSize: 11, color: "#64748b", marginRight: 8 }}>المدرب: {trainer ? trainer.name : "لم يعين بعد"}</span>
                          </div>
                          <span style={{ background: "#fee2e2", color: "#ef4444", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6 }}>تحت المراقبة</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* 2. إدارة البرامج */}
          {tab === "programs" && (
            <Card>
              <h2 style={{ margin: "0 0 16px", fontWeight: 900 }}>📘 إدارة وتأسيس البرامج التدريبية</h2>
              <div className="g3" style={{ marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>اسم البرنامج التدريبي *</label>
                  <input className="inp" placeholder="مثال: لغة عربية لغير الناطقين بها" value={newProg.name} onChange={e => setNewProg({ ...newProg, name: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>رمز/كود البرنامج</label>
                  <input className="inp" placeholder="ARAB-101" value={newProg.code} onChange={e => setNewProg({ ...newProg, code: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>مدة البرنامج بالبدائل (أيام)</label>
                  <input className="inp" type="number" placeholder="مثال: 30" value={newProg.duration} onChange={e => setNewProg({ ...newProg, duration: e.target.value })} />
                </div>
              </div>
              <button className="btn" onClick={handleAddProgram} style={{ width: "auto", padding: "12px 30px" }}>➕ حفظ وإنشاء البرنامج</button>

              <h3 style={{ marginTop: 24, fontWeight: 800 }}>البرامج الحالية في المنظومة ({programs.length})</h3>
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="th">اسم البرنامج</th>
                    <th className="th">الكود</th>
                    <th className="th">المدة</th>
                    <th className="th">عدد القاعات المرتبطة</th>
                  </tr>
                </thead>
                <tbody>
                  {programs.map(p => (
                    <tr key={p.id}>
                      <td className="td" style={{ fontWeight: 800 }}>{p.name}</td>
                      <td className="td"><span style={{ background: "#e2e8f0", padding: "3px 8px", borderRadius: 6, fontSize: 12 }}>{p.code || "—"}</span></td>
                      <td className="td">{p.duration_days ? `${p.duration_days} يوم` : "غير محدد"}</td>
                      <td className="td">{classrooms.filter(c => c.program_id === p.id).length} قاعة</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* 3. إدارة القاعات */}
          {tab === "classrooms" && (
            <Card>
              <h2 style={{ margin: "0 0 16px", fontWeight: 900 }}>🏫 إدارة القاعات ومستويات التدريب</h2>
              <div className="g2" style={{ marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>رمز أو رقم القاعة *</label>
                  <input className="inp" placeholder="مثل: 203 أو قاعة مكة" value={newRoom.code} onChange={e => setNewRoom({ ...newRoom, code: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>مستوى الدراسة (Level)</label>
                  <input className="inp" placeholder="مثال: A1, B2" value={newRoom.level} onChange={e => setNewRoom({ ...newRoom, level: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>البرنامج المرتبط</label>
                  <select className="inp" value={newRoom.program_id} onChange={e => setNewRoom({ ...newRoom, program_id: e.target.value })}>
                    <option value="">اختر برنامجاً</option>
                    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>السعة الاستيعابية</label>
                  <input className="inp" type="number" placeholder="مثال: 25" value={newRoom.capacity} onChange={e => setNewRoom({ ...newRoom, capacity: e.target.value })} />
                </div>
              </div>
              <button className="btn" onClick={handleAddRoom} style={{ width: "auto" }}>➕ تسجيل القاعة الجديدة</button>

              <h3 style={{ marginTop: 24, fontWeight: 800 }}>القاعات والقوائم الحالية</h3>
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="th">رقم القاعة</th>
                    <th className="th">المستوى</th>
                    <th className="th">البرنامج</th>
                    <th className="th">المدرب المعين حالياً</th>
                    <th className="th">تغيير وتعيين المدرب</th>
                  </tr>
                </thead>
                <tbody>
                  {classrooms.map(c => {
                    const prog = programs.find(p => p.id === c.program_id);
                    return (
                      <tr key={c.id}>
                        <td className="td" style={{ fontWeight: 900, color: "#10b981", fontSize: 16 }}>{c.code}</td>
                        <td className="td">{c.level || "—"}</td>
                        <td className="td" style={{ fontSize: 12 }}>{prog ? prog.name : "غير مرتبط ببرنامج"}</td>
                        <td className="td" style={{ fontWeight: 700 }}>{trainers.find(t => t.id === c.trainer_id)?.name || "❌ لم يعين مدرب"}</td>
                        <td className="td">
                          <select className="inp" style={{ margin: 0, padding: "5px" }} value={c.trainer_id || ""} onChange={e => handleLinkTrainer(c.id, e.target.value)}>
                            <option value="">— اختر مدرباً لتعيينه —</option>
                            {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}

          {/* 4. إدارة المدربين */}
          {tab === "trainers" && (
            <Card>
              <h2 style={{ margin: "0 0 16px", fontWeight: 900 }}>👨‍🏫 إدارة أعضاء هيئة التدريس والمدربين</h2>
              <div className="g2" style={{ marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>اسم المدرب / دكتور المادة *</label>
                  <input className="inp" placeholder="د/ خالد الأحمد" value={newTrainer.name} onChange={e => setNewTrainer({ ...newTrainer, name: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>التخصص الفني</label>
                  <input className="inp" placeholder="مثل: النحو والصرف، اللغويات" value={newTrainer.specialization} onChange={e => setNewTrainer({ ...newTrainer, specialization: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>رقم الجوال</label>
                  <input className="inp" placeholder="05xxxxxxxx" value={newTrainer.phone} onChange={e => setNewTrainer({ ...newTrainer, phone: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>البريد الإلكتروني (هام لإرسال التقارير)</label>
                  <input className="inp" placeholder="trainer@domain.com" value={newTrainer.email} onChange={e => setNewTrainer({ ...newTrainer, email: e.target.value })} />
                </div>
              </div>
              <button className="btn" onClick={handleAddTrainer} style={{ width: "auto" }}>➕ حفظ بيانات عضو هيئة التدريس</button>

              <h3 style={{ marginTop: 24, fontWeight: 800 }}>سجل المدربين المعتمدين بالمنصة</h3>
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="th">اسم المدرب</th>
                    <th className="th">التخصص</th>
                    <th className="th">الجوال</th>
                    <th className="th">البريد الإلكتروني</th>
                    <th className="th">القاعات التي يدرّس بها</th>
                  </tr>
                </thead>
                <tbody>
                  {trainers.map(t => (
                    <tr key={t.id}>
                      <td className="td" style={{ fontWeight: 800 }}>{t.name}</td>
                      <td className="td">{t.specialization || "عام"}</td>
                      <td className="td">{t.phone || "—"}</td>
                      <td className="td">{t.email || "—"}</td>
                      <td className="td" style={{ color: "#10b981", fontWeight: 700 }}>
                        {classrooms.filter(c => c.trainer_id === t.id).map(c => c.code).join(" ، ") || "لا توجد قاعات مخصصة"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* 5. إدارة المشاركين */}
          {tab === "participants" && (
            <Card>
              <h2 style={{ margin: "0 0 16px", fontWeight: 900 }}>👥 إدارة المشاركين والطلاب (Participant Roster)</h2>
              <div className="g2" style={{ marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>اسم المتدرب / الطالب *</label>
                  <input className="inp" placeholder="الاسم الكامل للطالب" value={newPart.name} onChange={e => setNewPart({ ...newPart, name: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>البريد الإلكتروني</label>
                  <input className="inp" placeholder="student@gmail.com" value={newPart.email} onChange={e => setNewPart({ ...newPart, email: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>رقم الجوال</label>
                  <input className="inp" placeholder="05xxxxxxxx" value={newPart.phone} onChange={e => setNewPart({ ...newPart, phone: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>القاعة الدراسية المراد تسكينه بها</label>
                  <select className="inp" value={newPart.classroom_id} onChange={e => setNewPart({ ...newPart, classroom_id: e.target.value })}>
                    <option value="">اختر قاعة دراسية</option>
                    {classrooms.map(c => <option key={c.id} value={c.id}>قاعة: {c.code} ({c.level})</option>)}
                  </select>
                </div>
              </div>
              <button className="btn" onClick={handleAddParticipant} style={{ width: "auto" }}>➕ تسكين وتثبيت الطالب</button>

              <h3 style={{ marginTop: 24, fontWeight: 800 }}>قائمة الطلاب والروابط الذكية ({participants.length})</h3>
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="th">الاسم</th>
                    <th className="th">القاعة</th>
                    <th className="th">الجوال</th>
                    <th className="th">البريد</th>
                    <th className="th">رابط التحقق السحري (Magic Link)</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map(p => {
                    const room = classrooms.find(c => c.id === p.classroom_id);
                    return (
                      <tr key={p.id}>
                        <td className="td" style={{ fontWeight: 700 }}>{p.name}</td>
                        <td className="td" style={{ fontWeight: 800, color: "#2563eb" }}>{room ? `قاعة ${room.code}` : "لم يسكن بعد"}</td>
                        <td className="td">{p.phone || "—"}</td>
                        <td className="td">{p.email || "—"}</td>
                        <td className="td">
                          <span style={{ background: "#d1fae5", color: "#047857", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>جاهز للإرسال</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}

          {/* 6. مركز التقارير */}
          {tab === "reports" && (
            <div>
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: 20, marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 12px", fontWeight: 800 }}>📑 قوالب تقييم الجودة وتوليد ملفات PDF الفاخرة</h3>
                <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>اختر المدرب لعرض تقريره الخاص والمستقل بالكامل والمعد للطباعة المباشرة</p>
                
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <select className="inp" style={{ width: 280, margin: 0 }} value={selectedTrainerReport} onChange={e => setSelectedTrainerReport(e.target.value)}>
                    <option value="">— اختر المدرب لفرز تقريره المخصص —</option>
                    {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {selectedTrainerReport && (
                    <button className="btn" style={{ width: "auto" }} onClick={() => window.print()}>🖨 طباعة تقرير المدرب المخصص</button>
                  )}
                </div>
              </div>

              {selectedTrainerData ? (
                <Card style={{ border: "2px solid #10b981", background: "#fffdf9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #eef2f6", paddingBottom: 16, marginBottom: 16 }}>
                    <div>
                      <span style={{ background: "#d1fae5", color: "#047857", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 800 }}>تقرير الجودة المستقل</span>
                      <h2 style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 900 }}>التقييم الفني الفردي للمدرب: {selectedTrainerData.name}</h2>
                      <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 13 }}>يستعرض القاعات والتقييمات المرتبطة به شخصياً لمنع تداخل المسؤوليات</p>
                    </div>
                    <div style={{ textAlign: "center", background: "#f8fafc", padding: "10px 18px", borderRadius: 14 }}>
                      <div style={{ fontSize: 32, fontWeight: 900 }}>{selectedTrainerData.avg ? selectedTrainerData.avg.toFixed(2) : "—"}</div>
                      <span style={{ fontSize: 12, color: "#64748b" }}>معدل التقييم العام</span>
                    </div>
                  </div>

                  <div className="g3" style={{ marginBottom: 18 }}>
                    <div style={{ background: "#f8fafc", padding: 14, borderRadius: 12, textAlign: "center" }}>
                      <span style={{ fontSize: 11, color: "#64748b" }}>القاعات التابعة</span>
                      <b style={{ display: "block", fontSize: 18, marginTop: 4 }}>{selectedTrainerData.rooms.map(r => r.code).join(" ، ") || "لا توجد قاعات"}</b>
                    </div>
                    <div style={{ background: "#f8fafc", padding: 14, borderRadius: 12, textAlign: "center" }}>
                      <span style={{ fontSize: 11, color: "#64748b" }}>مجموع الاستجابات</span>
                      <b style={{ display: "block", fontSize: 18, marginTop: 4 }}>{selectedTrainerData.count} استمارة</b>
                    </div>
                    <div style={{ background: "#f8fafc", padding: 14, borderRadius: 12, textAlign: "center" }}>
                      <span style={{ fontSize: 11, color: "#64748b" }}>درجة الامتثال والالتزام</span>
                      <b style={{ display: "block", fontSize: 16, marginTop: 4, color: selectedTrainerData.avg >= 4 ? "#10b981" : "#b45309" }}>
                        {selectedTrainerData.avg >= 4 ? "توافق تام مع المعايير" : "حاجة لدعم فني مبسط"}
                      </b>
                    </div>
                  </div>

                  <h3 style={{ fontSize: 16, fontWeight: 800 }}>📊 تفاصيل تقييم المحاور الأكاديمية للمدرب</h3>
                  {selectedTrainerData.axes.length > 0 ? selectedTrainerData.axes.map((ax, idx) => {
                    const stVal = statusOf(ax.value);
                    return (
                      <div key={idx} style={{ background: "#fff", border: "1px solid #f0e9db", borderRadius: 12, padding: 12, marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5 }}>{ax.label}</span>
                          <b style={{ color: "#10b981" }}>{ax.value.toFixed(2)}/5</b>
                        </div>
                        <div style={{ height: 8, background: "#f0e9db", borderRadius: 8, overflow: "hidden" }}>
                          <div style={{ width: `${(ax.value / 5) * 100}%`, height: "100%", background: "#10b981" }} />
                        </div>
                      </div>
                    );
                  }) : <p style={{ color: "#94a3b8" }}>لا توجد استجابات تقييم فردية مكتملة لهذا المدرب بعد.</p>}
                </Card>
              ) : (
                <div style={{ textAlign: "center", padding: 50, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 20 }}>
                  <span style={{ fontSize: 40 }}>📑</span>
                  <h3 style={{ margin: "10px 0 0", fontWeight: 800 }}>يرجى اختيار المدرب أعلاه لعرض تقريره الفردي المستقل</h3>
                </div>
              )}
            </div>
          )}

          {/* 7. مركز التحليلات */}
          {tab === "analytics" && (
            <Card>
              <h2 style={{ margin: "0 0 16px", fontWeight: 900 }}>📊 تحليلات ومقارنات معايير الجودة (النسب الكلية)</h2>
              <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>مقارنة معايير التقييم للمحاور الأكاديمية بين التقييم اليومي المباشر والنهائي</p>
              
              <div className="g2">
                <CD st={{ borderRight: "4px solid #2563eb" }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "#2563eb", marginBottom: 12 }}>أعلى محاور التقييم اليومي</h3>
                  {daily.axes.slice(0, 3).map((a, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{a.label}</span>
                      <b style={{ color: "#2563eb" }}>{a.value.toFixed(2)}</b>
                    </div>
                  ))}
                </CD>
                <CD st={{ borderRight: "4px solid #10b981" }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "#10b981", marginBottom: 12 }}>أعلى محاور التقييم النهائي</h3>
                  {final.axes.slice(0, 3).map((a, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{a.label}</span>
                      <b style={{ color: "#10b981" }}>{a.value.toFixed(2)}</b>
                    </div>
                  ))}
                </CD>
              </div>
            </Card>
          )}

          {/* 8. مركز الإشعارات والبريد */}
          {tab === "notifications" && (
            <Card>
              <h2 style={{ margin: "0 0 16px", fontWeight: 900 }}>✉️ مركز الإشعارات وتوليد التقارير التلقائية (Mail Hub)</h2>
              <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>أرسل تقرير تقييم القاعة والمدرب الفردي بملف PDF تلقائياً للمدرب أو تقرير الجودة الموحد للإدارة بضغطة زر:</p>

              <div className="g2" style={{ marginBottom: 24 }}>
                <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 16, padding: 18 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>إرسال تقرير المدرب الفردي</h3>
                  <select className="inp" id="selectMailTrainer">
                    <option value="">— اختر المدرب المستهدف —</option>
                    {trainers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.email || "لا يوجد بريد"})</option>)}
                  </select>
                  <button className="btn" disabled={emailSending} onClick={() => {
                    const val = document.getElementById("selectMailTrainer").value;
                    if (val) triggerEmailReport("TRAINER", val);
                  }}>
                    {emailSending ? "⏳ جاري توليد PDF والإرسال..." : "✉️ إرسال التقرير للمدرب والنسخة للإدارة"}
                  </button>
                </div>

                <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 16, padding: 18 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>إرسال التقرير الشامل للإدارة</h3>
                  <p style={{ fontSize: 12, color: "#64748b", marginBottom: 24 }}>تصدير كافة أرقام المنصة لمدير المنصة والشركاء الأكاديميين بنسخة PDF</p>
                  <button className="btn" style={{ background: "#0f172a" }} disabled={emailSending} onClick={() => triggerEmailReport("ADMIN", "all")}>
                    {emailSending ? "⏳ جاري المعالجة..." : "✉️ إرسال التقرير الشامل للإدارة"}
                  </button>
                </div>
              </div>

              <h3 style={{ fontWeight: 800 }}>📋 سجل رسائل التقارير والامتثال الصادرة</h3>
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="th">المستلم</th>
                    <th className="th">البريد الإلكتروني</th>
                    <th className="th">عنوان التقرير الصادر</th>
                    <th className="th">الحالة</th>
                    <th className="th">تاريخ ووقت الإرسال</th>
                  </tr>
                </thead>
                <tbody>
                  {emailLogs.map(l => (
                    <tr key={l.id}>
                      <td className="td" style={{ fontWeight: 700 }}>{l.recipient_name}</td>
                      <td className="td" style={{ direction: "ltr", fontSize: 12 }}>{l.recipient_email}</td>
                      <td className="td" style={{ fontSize: 12.5 }}>{l.subject}</td>
                      <td className="td">
                        <span style={{ background: "#d1fae5", color: "#047857", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>{l.status}</span>
                      </td>
                      <td className="td" style={{ fontSize: 12, color: "#64748b" }}>{new Date(l.sent_at).toLocaleString("ar-SA")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* 9. الإعدادات */}
          {tab === "settings" && (
            <Card>
              <h2 style={{ margin: "0 0 16px", fontWeight: 900 }}>⚙️ الإعدادات العامة للمنظومة</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>مفتاح ربط بريد Resend API Key</label>
                  <input className="inp" type="password" placeholder="re_1234567890abcdef..." value="••••••••••••••••••••••••••••" disabled />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>بريد استلام تقارير الإدارة المعتمد</label>
                  <input className="inp" placeholder="management@platform.edu" value="management@platform.edu" disabled />
                </div>
              </div>
            </Card>
          )}

        </main>
      </div>
    </div>
  );
}

function KpiCard(p: { label: string; value: any; suffix?: string; subtitle: string }) {
  return (
    <Card style={{ position: "relative", overflow: "hidden", borderRight: "4px solid #10b981" }}>
      <div style={{ position: "absolute", left: 10, top: 4, fontSize: 60, fontWeight: 900, color: "rgba(16,185,129,0.04)" }}>{p.value}</div>
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 13, color: "#9a8f7d", fontWeight: 700, marginBottom: 4 }}>{p.label}</div>
        <div style={{ fontSize: 38, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>{p.value}{p.suffix}</div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{p.subtitle}</div>
      </div>
    </Card>
  );
}

function CD(p: { children: any; st?: any }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #ece4d4", borderRadius: 20, padding: 18, boxShadow: "0 4px 14px rgba(60,40,10,.05)", marginBottom: 14, ...p.st }}>
      {p.children}
    </div>
  );
}
