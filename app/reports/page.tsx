// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

/* =========================
   Helpers
   ========================= */
function filterRowsBy(baseRows, classrooms, fixedKind, f) {
  const fromD = f?.from ? new Date(f.from) : null;
  const toD = f?.to ? new Date(f.to) : null;
  if (toD) toD.setHours(23, 59, 59, 999);

  const trainerRoomIds =
    f?.trainerId && f.trainerId !== "ALL"
      ? new Set((classrooms || []).filter((c) => c.trainer_id === f.trainerId).map((c) => c.id))
      : null;

  return (baseRows || []).filter((r) => {
    if (!r) return false;
    if (fixedKind && r.kind !== fixedKind) return false;

    if (f?.classroomId && f.classroomId !== "ALL") {
      if (r.classroom_id !== f.classroomId) return false;
    } else if (trainerRoomIds) {
      if (!trainerRoomIds.has(r.classroom_id)) return false;
    }

    if ((fromD || toD) && r.submitted_at) {
      const d = new Date(r.submitted_at);
      if (fromD && d < fromD) return false;
      if (toD && d > toD) return false;
    }
    return true;
  });
}

function pickQuestionText(q, lang) {
  if (!q) return lang === "ar" ? "سؤال" : "Question";
  return lang === "ar" ? (q.text_ar || q.text_en || "سؤال") : (q.text_en || q.text_ar || "Question");
}

function maskEmail(email) {
  if (!email || !email.includes("@")) return "—";
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}***@${d}`;
}

function maskPhone(p) {
  if (!p) return "—";
  const cleaned = String(p).replace(/\s+/g, "");
  if (cleaned.length < 6) return "***";
  return cleaned.replace(/(\d{2})\d+(\d{2})/, "$1******$2");
}

function downloadCSV(filename, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const TEAL = "#10b981";
const BLUE = "#2563eb";

const dict = {
  ar: {
    dir: "rtl", font: "'Tajawal', sans-serif",
    title: "لوحة ذكاء الأعمال", sub: "النظام المركزي للتحليلات",
    tab1: "الملخص التنفيذي", tab2: "التقرير اليومي", tab3: "التقرير النهائي", tab4: "سجل المشاركين", tab5: "شهادة التميز",
    lang: "English",
    totalRes: "حجم العينة", dailySat: "الرضا اليومي", finalSat: "الرضا النهائي",
    room: "القاعة", trainer: "المدرب", name: "الاسم", email: "البريد", phone: "الجوال",
    noData: "لا توجد بيانات.", filters: "الفلاتر", allTrainers: "كل المدربين", allRooms: "كل القاعات",
    reset: "إعادة تعيين", search: "بحث (اسم/بريد/جوال)",
    reveal: "إظهار البيانات", hide: "إخفاء البيانات", export: "تصدير CSV",
    executiveHint: "تقارير ذكية لمؤشرات الجودة والتقييم.", dailyHint: "تحليل أداء الحصص التدريبية.",
    finalHint: "رضا المتدربين عن البرنامج.", participantsHint: "فلترة حسب القاعة + المدرب + الفترة، مع بحث وتصدير.",
    print: "طباعة", minResponses: "حد أدنى للاستجابات", sample: "عدد الاستجابات",
    clear: "إفراغ", purge: "حذف الاستجابات"
  },
  en: {
    dir: "ltr", font: "'Inter', sans-serif",
    title: "BI Dashboard", sub: "Central Analytics",
    tab1: "Overview", tab2: "Daily Report", tab3: "Final Report", tab4: "Participants", tab5: "Certificate",
    lang: "العربية",
    totalRes: "Sample Size", dailySat: "Daily satisfaction", finalSat: "Final satisfaction",
    room: "Room", trainer: "Trainer", name: "Name", email: "Email", phone: "Phone",
    noData: "No data.", filters: "Filters", allTrainers: "All trainers", allRooms: "All rooms",
    reset: "Reset", search: "Search (name/email/phone)",
    reveal: "Show data", hide: "Hide data", export: "Export CSV",
    executiveHint: "Smart analytics for quality & evaluation.", dailyHint: "Daily session performance analysis.",
    finalHint: "Program satisfaction analysis.", participantsHint: "Filter by room + trainer + date range, with search and export.",
    print: "Print", minResponses: "Min responses", sample: "Responses",
    clear: "Clear", purge: "Delete Responses"
  }
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.rw { background: #f4f6f8; min-height: 100vh; padding: 24px; }
.lay { display: flex; gap: 24px; }
.side { width: 300px; flex-shrink: 0; background: linear-gradient(145deg, #0b1220, #172554); border-radius: 24px; padding: 24px; color: #fff; position: sticky; top: 24px; height: fit-content; }
.main { flex: 1; min-width: 0; }
.ton { background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; border-radius: 14px; padding: 14px 18px; cursor: pointer; font-weight: 800; font-size: 15px; width: 100%; display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.tof { background: rgba(255,255,255,0.04); color: #94a3b8; border: none; border-radius: 14px; padding: 14px 18px; cursor: pointer; font-weight: 700; font-size: 15px; width: 100%; display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.tof:hover { background: rgba(255,255,255,0.1); color: #fff; }
.g3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 20px; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 28px; margin-bottom: 20px; }
.kpi { border-bottom: 5px solid #10b981; }
.tbl { width: 100%; border-collapse: collapse; }
.th { padding: 14px; font-weight: 800; font-size: 14px; color: #64748b; border-bottom: 2px solid #eef2f6; text-align: start; }
.td { padding: 14px; font-size: 14px; border-bottom: 1px solid #f1f5f9; font-weight: 600; }
.badge { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px; font-size:12px; font-weight:900; }
.sel, .inp{ width:100%; padding:12px 12px; border-radius:12px; border:1px solid #cbd5e1; background:#fff; font-weight:800; outline:none; }
.sel:focus, .inp:focus{ border-color:#2563eb; box-shadow:0 0 0 4px rgba(37,99,235,.12); }
.fgrid{ display:grid; grid-template-columns: repeat(5, 1fr); gap:12px; }
.btn2{ width:auto; padding:12px 16px; border-radius:12px; border:1px solid #cbd5e1; background:#fff; color:#0f172a; font-weight:900; cursor:pointer; }
.noprint{}

/* ===== Delete Warning Modal ===== */
.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; animation: fadeIn 0.2s ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.modal-box { background: #fff; border-radius: 24px; width: 100%; max-width: 520px; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.35); animation: slideUp 0.3s ease; }
.modal-head { background: linear-gradient(135deg, #7f1d1d, #dc2626); color: #fff; padding: 22px 26px; display: flex; align-items: center; gap: 14px; }
.modal-head-icon { width: 48px; height: 48px; border-radius: 14px; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
.modal-head h3 { margin: 0; font-size: 20px; font-weight: 900; }
.modal-head p { margin: 4px 0 0; font-size: 13px; opacity: 0.85; font-weight: 600; }
.modal-body { padding: 24px 26px; }
.modal-warning-list { background: #fef2f2; border: 1px solid #fecaca; border-radius: 14px; padding: 14px 18px; margin: 0 0 18px; padding-inline-start: 34px; }
.modal-warning-list li { color: #991b1b; font-size: 14px; font-weight: 700; margin-bottom: 6px; line-height: 1.7; }
.modal-warning-list li:last-child { margin-bottom: 0; }
.modal-label { display: block; font-size: 13px; font-weight: 900; color: #334155; margin-bottom: 6px; }
.kind-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 18px; }
.kind-option { border: 2px solid #e2e8f0; border-radius: 12px; padding: 12px 8px; text-align: center; cursor: pointer; font-weight: 800; font-size: 13px; color: #64748b; transition: all 0.15s ease; background: #fff; }
.kind-option:hover { border-color: #fca5a5; }
.kind-option.selected { border-color: #dc2626; background: #fef2f2; color: #dc2626; }
.code-input { width: 100%; padding: 14px; border-radius: 12px; border: 2px solid #e2e8f0; font-size: 22px; font-weight: 900; text-align: center; letter-spacing: 10px; direction: ltr; outline: none; transition: border 0.15s ease; }
.code-input:focus { border-color: #dc2626; box-shadow: 0 0 0 4px rgba(220,38,38,0.1); }
.code-input.error { border-color: #dc2626; background: #fef2f2; animation: shake 0.3s ease; }
@keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
.modal-footer { padding: 16px 26px 24px; display: flex; gap: 12px; }
.modal-btn-cancel { flex: 1; padding: 14px; border-radius: 12px; border: 1px solid #cbd5e1; background: #fff; color: #334155; font-weight: 900; font-size: 15px; cursor: pointer; font-family: inherit; }
.modal-btn-cancel:hover { background: #f1f5f9; }
.modal-btn-delete { flex: 1; padding: 14px; border-radius: 12px; border: none; background: #dc2626; color: #fff; font-weight: 900; font-size: 15px; cursor: pointer; font-family: inherit; transition: background 0.15s ease; }
.modal-btn-delete:hover:not(:disabled) { background: #b91c1c; }
.modal-btn-delete:disabled { background: #fca5a5; cursor: not-allowed; }
.modal-result { margin-top: 14px; padding: 12px 16px; border-radius: 12px; font-weight: 800; font-size: 14px; line-height: 1.7; }
.modal-result.success { background: #d1fae5; color: #047857; }
.modal-result.error { background: #fee2e2; color: #b91c1c; }

@media(max-width: 950px){ .lay { flex-direction: column; } .side { width: 100%; position: static; } .g2, .g3 { grid-template-columns: 1fr; } .fgrid{ grid-template-columns: 1fr; } }
@media print { .side, .noprint { display: none !important; } .rw { padding: 0; background: #fff; } .card { box-shadow: none !important; } }
`;

function GaugeChart({ score, color }) {
  const pct = score ? (score / 5) * 100 : 0;
  const radius = 55;
  const circumference = Math.PI * radius;
  return (
    <div style={{ textAlign: "center", position: "relative", height: "85px", width: "150px", margin: "0 auto" }}>
      <svg width="150" height="85" viewBox="0 0 150 85">
        <path d="M 15 75 A 55 55 0 0 1 135 75" fill="none" stroke="#f1f5f9" strokeWidth="16" strokeLinecap="round" />
        <path d="M 15 75 A 55 55 0 0 1 135 75" fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference - (pct / 100) * circumference}
          style={{ transition: "stroke-dashoffset 1.5s" }} />
      </svg>
      <div style={{ position: "absolute", bottom: "-5px", left: 0, right: 0, fontSize: "28px", fontWeight: "900", direction: "ltr", unicodeBidi: "plaintext" }}>
        {score ? score.toFixed(2) : "0.00"}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [lang, setLang] = useState("ar");
  const [mounted, setMounted] = useState(false);

  const [rows, setRows] = useState([]);
  const [ans, setAns] = useState([]);
  const [qs, setQs] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [trainers, setTrainers] = useState([]);

  const [load, setLoad] = useState(true);
  const [tab, setTab] = useState("dashboard");

  const emptyRange = { from: "", to: "" };
  const [dashF, setDashF] = useState({ trainerId: "ALL", classroomId: "ALL", ...emptyRange });
  const [dailyF, setDailyF] = useState({ trainerId: "ALL", classroomId: "ALL", ...emptyRange });
  const [finalF, setFinalF] = useState({ trainerId: "ALL", classroomId: "ALL", ...emptyRange });
  const [partF, setPartF] = useState({ trainerId: "ALL", classroomId: "ALL", from: "", to: "", q: "" });
  const [revealPII, setRevealPII] = useState(false);
  const [certF, setCertF] = useState({ trainerId: "ALL", classroomId: "ALL", ...emptyRange, min: 3 });

  // ===== حذف الاستجابات (Modal) =====
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeKind, setPurgeKind] = useState("BOTH");
  const [purgeCode, setPurgeCode] = useState("");
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState("");
  const [codeError, setCodeError] = useState(false);

  const t = dict[lang];
  const db = supabase();

  const fetchAllData = async () => {
    const [e, a, q, c, tr] = await Promise.all([
      db.from("evaluations").select("*").order("submitted_at", { ascending: false }),
      db.from("evaluation_answers").select("*"),
      db.from("questions").select("*"),
      db.from("classrooms").select("*"),
      db.from("trainers").select("*")
    ]);
    setRows(e.data || []);
    setAns(a.data || []);
    setQs(q.data || []);
    setClassrooms(c.data || []);
    setTrainers(tr.data || []);
  };

  useEffect(() => {
    setMounted(true);
    let on = true;
    (async () => {
      const s = await db.auth.getSession();
      if (!s.data?.session) { router.push("/login"); return; }
      if (on) { await fetchAllData(); setLoad(false); }
    })();
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== تنفيذ الحذف النهائي =====
  const executePurge = async () => {
    if (purgeCode !== "9999") {
      setCodeError(true);
      setTimeout(() => setCodeError(false), 500);
      return;
    }
    setPurgeBusy(true);
    setPurgeMsg("");
    try {
      const s = await db.auth.getSession();
      const token = s.data?.session?.access_token;
      if (!token) throw new Error(lang === "ar" ? "لا توجد جلسة" : "No session");

      const res = await fetch("/api/admin/purge-evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ confirmCode: purgeCode, kind: purgeKind, filters: partF })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed");

      setPurgeMsg(
        "success:" + (lang === "ar"
          ? `تم الحذف النهائي بنجاح: ${json.deleted.evaluations} استبانة و ${json.deleted.answers} إجابة.`
          : `Deleted: ${json.deleted.evaluations} evaluations, ${json.deleted.answers} answers.`)
      );
      await fetchAllData();
    } catch (e) {
      setPurgeMsg("error:" + ((lang === "ar" ? "خطأ: " : "Error: ") + (e.message || "Unknown")));
    } finally {
      setPurgeBusy(false);
    }
  };

  const closePurgeModal = () => {
    setPurgeOpen(false);
    setPurgeCode("");
    setPurgeMsg("");
    setCodeError(false);
  };

  const statusOf = (v) => {
    const val = Number(v) || 0;
    if (val >= 4) return { t: lang === "ar" ? "ممتاز" : "Excellent", bg: "#d1fae5", fg: "#047857" };
    if (val >= 3) return { t: lang === "ar" ? "جيد" : "Good", bg: "#fef3c7", fg: "#b45309" };
    return { t: lang === "ar" ? "يحتاج" : "Needs work", bg: "#fee2e2", fg: "#b91c1c" };
  };

  const calc = (inRows, inAns) => {
    const list = inRows || [];
    const ids = new Set(list.map((r) => r.id));
    const qm = {};
    (qs || []).forEach((q) => { if (q) qm[q.id] = q; });
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    const g = {};
    (inAns || []).forEach((a) => {
      if (a && ids.has(a.evaluation_id) && a.rating_value != null) {
        const v = Number(a.rating_value);
        if (!isNaN(v)) (g[a.question_id] = g[a.question_id] || []).push(v);
      }
    });

    const axes = Object.keys(g)
      .map((id) => ({ label: pickQuestionText(qm[id], lang), value: avg(g[id]) }))
      .sort((a, b) => b.value - a.value);

    const all = list.map((r) => Number(r.overall_rating)).filter((v) => v > 0);
    return { count: list.length, avg: avg(all), axes };
  };

  /* Dashboard */
  const dashDailyRows = useMemo(() => filterRowsBy(rows, classrooms, "DAILY", dashF), [rows, classrooms, dashF]);
  const dashFinalRows = useMemo(() => filterRowsBy(rows, classrooms, "FINAL", dashF), [rows, classrooms, dashF]);
  const dashDailyIds = useMemo(() => new Set(dashDailyRows.map((r) => r.id)), [dashDailyRows]);
  const dashFinalIds = useMemo(() => new Set(dashFinalRows.map((r) => r.id)), [dashFinalRows]);
  const dashDailyAns = useMemo(() => ans.filter((a) => a && dashDailyIds.has(a.evaluation_id)), [ans, dashDailyIds]);
  const dashFinalAns = useMemo(() => ans.filter((a) => a && dashFinalIds.has(a.evaluation_id)), [ans, dashFinalIds]);
  const dashDaily = useMemo(() => calc(dashDailyRows, dashDailyAns), [dashDailyRows, dashDailyAns, qs, lang]);
  const dashFinal = useMemo(() => calc(dashFinalRows, dashFinalAns), [dashFinalRows, dashFinalAns, qs, lang]);

  const dashAllRows = useMemo(() => filterRowsBy(rows, classrooms, null, dashF), [rows, classrooms, dashF]);
  const dashRoomData = useMemo(() => {
    const map = new Map();
    for (const r of dashAllRows) {
      if (!r.classroom_id) continue;
      const item = map.get(r.classroom_id) || { sum: 0, cnt: 0 };
      item.sum += Number(r.overall_rating || 0);
      item.cnt += 1;
      map.set(r.classroom_id, item);
    }
    const out = [];
    for (const c of classrooms) {
      const stat = map.get(c.id);
      if (!stat?.cnt) continue;
      const tr = trainers.find((x) => x.id === c.trainer_id);
      out.push({ id: c.id, code: c.code, trainer: tr?.name || "—", avg: stat.sum / stat.cnt, count: stat.cnt });
    }
    return out.sort((a, b) => b.avg - a.avg);
  }, [dashAllRows, classrooms, trainers]);

  /* Daily */
  const dailyRowsF = useMemo(() => filterRowsBy(rows, classrooms, "DAILY", dailyF), [rows, classrooms, dailyF]);
  const dailyIdsF = useMemo(() => new Set(dailyRowsF.map((r) => r.id)), [dailyRowsF]);
  const dailyAnsF = useMemo(() => ans.filter((a) => a && dailyIdsF.has(a.evaluation_id)), [ans, dailyIdsF]);
  const daily = useMemo(() => calc(dailyRowsF, dailyAnsF), [dailyRowsF, dailyAnsF, qs, lang]);

  /* Final */
  const finalRowsF = useMemo(() => filterRowsBy(rows, classrooms, "FINAL", finalF), [rows, classrooms, finalF]);
  const finalIdsF = useMemo(() => new Set(finalRowsF.map((r) => r.id)), [finalRowsF]);
  const finalAnsF = useMemo(() => ans.filter((a) => a && finalIdsF.has(a.evaluation_id)), [ans, finalIdsF]);
  const final = useMemo(() => calc(finalRowsF, finalAnsF), [finalRowsF, finalAnsF, qs, lang]);

  /* Participants */
  const partRowsF = useMemo(() => filterRowsBy(rows, classrooms, null, partF), [rows, classrooms, partF]);
  const partRoomData = useMemo(() => {
    const byClass = new Map();
    for (const e of partRowsF) {
      if (!e.classroom_id) continue;
      const s = {
        name: e.guest_name || e.profile?.full_name || "—",
        email: e.guest_email || e.profile?.email || "",
        phone: e.guest_phone || e.profile?.phone || ""
      };
      const arr = byClass.get(e.classroom_id) || [];
      arr.push(s);
      byClass.set(e.classroom_id, arr);
    }
    const out = [];
    const q = (partF.q || "").trim().toLowerCase();
    for (const c of classrooms) {
      const students = byClass.get(c.id) || [];
      if (!students.length) continue;
      const seen = new Set();
      const uniq = [];
      for (const s of students) {
        const key = s.email || s.phone || s.name;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        uniq.push(s);
      }
      const filtered = q
        ? uniq.filter((x) => (x.name || "").toLowerCase().includes(q) || (x.email || "").toLowerCase().includes(q) || (x.phone || "").toLowerCase().includes(q))
        : uniq;
      const tr = trainers.find((x) => x.id === c.trainer_id);
      out.push({ id: c.id, code: c.code, trainer: tr?.name || "—", students: filtered });
    }
    return out.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }, [partRowsF, classrooms, trainers, partF.q]);

  /* Certificate */
  const certAllRows = useMemo(() => filterRowsBy(rows, classrooms, null, certF), [rows, classrooms, certF]);
  const certBest = useMemo(() => {
    const map = new Map();
    for (const r of certAllRows) {
      if (!r.classroom_id) continue;
      const item = map.get(r.classroom_id) || { sum: 0, cnt: 0 };
      item.sum += Number(r.overall_rating || 0);
      item.cnt += 1;
      map.set(r.classroom_id, item);
    }
    const min = Number(certF.min || 0);
    let best = null;
    for (const c of classrooms) {
      const stat = map.get(c.id);
      if (!stat || (min && stat.cnt < min)) continue;
      const avg = stat.sum / stat.cnt;
      if (!best || avg > best.avg) {
        const tr = trainers.find((x) => x.id === c.trainer_id);
        best = { classroomId: c.id, code: c.code, trainer: tr?.name || "—", avg, cnt: stat.cnt };
      }
    }
    return best;
  }, [certAllRows, classrooms, trainers, certF.min]);

  /* FiltersBar */
  const FiltersBar = ({ value, setValue, count, withQuery = false, withMin = false }) => {
    const rooms = value?.trainerId && value.trainerId !== "ALL"
      ? classrooms.filter((c) => c.trainer_id === value.trainerId)
      : classrooms;

    useEffect(() => {
      if (!value) return;
      if (value.trainerId === "ALL" || value.classroomId === "ALL") return;
      const ok = classrooms.some((c) => c.id === value.classroomId && c.trainer_id === value.trainerId);
      if (!ok) setValue((f) => ({ ...f, classroomId: "ALL" }));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value.trainerId]);

    const reset = () => {
      const base = { trainerId: "ALL", classroomId: "ALL", from: "", to: "" };
      if (withQuery) base.q = "";
      if (withMin) base.min = 3;
      setValue(base);
    };

    return (
      <div className="card noprint" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center", gap: 10 }}>
          <b style={{ color: "#0f172a" }}>{t.filters}</b>
          <span className="badge" style={{ background: "#eef2ff", color: "#3730a3", direction: "ltr" }}>
            {t.sample}: {count ?? 0}
          </span>
        </div>
        <div className="fgrid">
          <select className="sel" value={value.trainerId} onChange={(e) => setValue((f) => ({ ...f, trainerId: e.target.value, classroomId: "ALL" }))}>
            <option value="ALL">{t.allTrainers}</option>
            {trainers.map((tr) => (<option key={tr.id} value={tr.id}>{tr.name}</option>))}
          </select>
          <select className="sel" value={value.classroomId} onChange={(e) => setValue((f) => ({ ...f, classroomId: e.target.value }))} disabled={value.trainerId !== "ALL" && rooms.length === 0}>
            <option value="ALL">{t.allRooms}</option>
            {value.trainerId !== "ALL" && rooms.length === 0
              ? (<option value="NONE" disabled>{lang === "ar" ? "لا توجد قاعات لهذا المدرب" : "No rooms for this trainer"}</option>)
              : (rooms.map((c) => (<option key={c.id} value={c.id}>{c.code}</option>)))}
          </select>
          {"from" in value && (<input className="inp" type="date" value={value.from} onChange={(e) => setValue((f) => ({ ...f, from: e.target.value }))} />)}
          {"to" in value && (<input className="inp" type="date" value={value.to} onChange={(e) => setValue((f) => ({ ...f, to: e.target.value }))} />)}
          {withQuery && (<input className="inp" placeholder={t.search} value={value.q} onChange={(e) => setValue((f) => ({ ...f, q: e.target.value }))} />)}
          {withMin && (<input className="inp" type="number" min={1} placeholder={t.minResponses} value={value.min} onChange={(e) => setValue((f) => ({ ...f, min: e.target.value }))} />)}
          <button className="sel" onClick={reset}>{t.reset}</button>
        </div>
      </div>
    );
  };

  if (!mounted || load) {
    return (
      <div className="rw" style={{ display: "flex", justifyContent: "center", alignItems: "center", background: "#0f172a" }}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ width: 60, height: 60, border: "6px solid rgba(255,255,255,0.1)", borderTopColor: "#10b981", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="rw" style={{ direction: t.dir, fontFamily: t.font }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="lay">
        {/* Sidebar */}
        <aside className="side noprint">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "linear-gradient(135deg,#10b981,#0d9488)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>📊</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: "18px" }}>{t.title}</div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>{t.sub}</div>
            </div>
          </div>

          <button className={tab === "dashboard" ? "ton" : "tof"} onClick={() => setTab("dashboard")}><span>{t.tab1}</span><span>🏢</span></button>
          <button className={tab === "daily" ? "ton" : "tof"} onClick={() => setTab("daily")}><span>{t.tab2}</span><span>📈</span></button>
          <button className={tab === "final" ? "ton" : "tof"} onClick={() => setTab("final")}><span>{t.tab3}</span><span>🏁</span></button>
          <button className={tab === "participants" ? "ton" : "tof"} onClick={() => setTab("participants")}><span>{t.tab4}</span><span>👥</span></button>
          <button className={tab === "cert" ? "ton" : "tof"} onClick={() => setTab("cert")}><span>{t.tab5}</span><span>🏆</span></button>

          <div style={{ marginTop: "24px", borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: "16px" }}>
            <button onClick={() => setLang(lang === "ar" ? "en" : "ar")} style={{ width: "100%", background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "12px", borderRadius: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginBottom: "8px" }}>🌐 {t.lang}</button>
            <button onClick={() => router.push("/admin/management")} style={{ width: "100%", background: "transparent", border: "1px solid #334155", color: "#cbd5e1", cursor: "pointer", padding: "12px", borderRadius: "12px", fontSize: "14px", fontWeight: 700 }}>⚙️ {lang === "ar" ? "الإدارة" : "Admin"}</button>
          </div>
        </aside>

        {/* Main */}
        <div className="main">

          {/* Dashboard */}
          {tab === "dashboard" && (
            <div>
              <div className="card" style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", color: "#fff" }}>
                <h1 style={{ fontSize: "32px", fontWeight: 900, margin: "0 0 8px" }}>{t.tab1}</h1>
                <p style={{ color: "#94a3b8", margin: 0 }}>{t.executiveHint}</p>
              </div>

              <FiltersBar value={dashF} setValue={setDashF} count={dashDaily.count + dashFinal.count} />

              <div className="g3">
                <div className="card kpi">
                  <div style={{ fontSize: "14px", color: "#64748b", fontWeight: 900 }}>{t.totalRes}</div>
                  <div style={{ fontSize: "44px", fontWeight: 900, direction: "ltr" }}>{dashDaily.count + dashFinal.count}</div>
                </div>
                <div className="card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "14px", color: "#64748b", fontWeight: 900, marginBottom: "10px" }}>{t.dailySat}</div>
                  <GaugeChart score={dashDaily.avg} color={BLUE} />
                </div>
                <div className="card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "14px", color: "#64748b", fontWeight: 900, marginBottom: "10px" }}>{t.finalSat}</div>
                  <GaugeChart score={dashFinal.avg} color={TEAL} />
                </div>
              </div>

              <div className="card">
                <h3 style={{ fontSize: "18px", fontWeight: 900, marginBottom: "16px" }}>{lang === "ar" ? "🏫 ترتيب القاعات" : "🏫 Room ranking"}</h3>
                {dashRoomData.map((r, i) => (
                  <div key={r.id} style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "14px" }}>
                      <span>{(lang === "ar" ? "قاعة" : "Room") + " " + r.code} ({r.trainer})</span>
                      <span style={{ color: i === 0 ? "#10b981" : "#334155", fontWeight: 900, direction: "ltr" }}>{r.avg.toFixed(2)}</span>
                    </div>
                    <div style={{ height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${(r.avg / 5) * 100}%`, height: "100%", background: i === 0 ? "#10b981" : "#2563eb" }} />
                    </div>
                  </div>
                ))}
                {dashRoomData.length === 0 && <p style={{ color: "#94a3b8", textAlign: "center" }}>{t.noData}</p>}
              </div>
            </div>
          )}

          {/* Daily */}
          {tab === "daily" && (
            <div>
              <div className="card" style={{ borderRight: "6px solid " + BLUE }}>
                <h1 style={{ fontSize: "28px", fontWeight: 900, marginBottom: "8px", color: BLUE }}>{t.tab2}</h1>
                <p style={{ color: "#64748b", margin: 0 }}>{t.dailyHint}</p>
              </div>

              <FiltersBar value={dailyF} setValue={setDailyF} count={daily.count} />

              <div className="card">
                <h3 style={{ fontSize: "18px", fontWeight: 900, marginBottom: "16px" }}>{lang === "ar" ? "📊 أداء المحاور" : "📊 Axes performance"}</h3>
                {daily.axes.map((a, i) => {
                  const s = statusOf(a.value);
                  return (
                    <div key={i} style={{ marginBottom: "16px", padding: "16px", background: "#f8fafc", borderRadius: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{ fontWeight: 900 }}>{a.label}</span>
                        <span style={{ background: s.bg, color: s.fg, padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 900 }}>{s.t}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ flex: 1, height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{ width: `${(a.value / 5) * 100}%`, height: "100%", background: BLUE }} />
                        </div>
                        <b style={{ minWidth: "72px", textAlign: "left", direction: "ltr" }}>{a.value.toFixed(2)}/5</b>
                      </div>
                    </div>
                  );
                })}
                {daily.axes.length === 0 && <p style={{ color: "#94a3b8", textAlign: "center" }}>{t.noData}</p>}
              </div>
            </div>
          )}

          {/* Final */}
          {tab === "final" && (
            <div>
              <div className="card" style={{ borderRight: "6px solid " + TEAL }}>
                <h1 style={{ fontSize: "28px", fontWeight: 900, marginBottom: "8px", color: TEAL }}>{t.tab3}</h1>
                <p style={{ color: "#64748b", margin: 0 }}>{t.finalHint}</p>
              </div>

              <FiltersBar value={finalF} setValue={setFinalF} count={final.count} />

              <div className="card">
                <h3 style={{ fontSize: "18px", fontWeight: 900, marginBottom: "16px" }}>{lang === "ar" ? "📊 أداء المحاور" : "📊 Axes performance"}</h3>
                {final.axes.map((a, i) => {
                  const s = statusOf(a.value);
                  return (
                    <div key={i} style={{ marginBottom: "16px", padding: "16px", background: "#f8fafc", borderRadius: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{ fontWeight: 900 }}>{a.label}</span>
                        <span style={{ background: s.bg, color: s.fg, padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 900 }}>{s.t}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ flex: 1, height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{ width: `${(a.value / 5) * 100}%`, height: "100%", background: TEAL }} />
                        </div>
                        <b style={{ minWidth: "72px", textAlign: "left", direction: "ltr" }}>{a.value.toFixed(2)}/5</b>
                      </div>
                    </div>
                  );
                })}
                {final.axes.length === 0 && <p style={{ color: "#94a3b8", textAlign: "center" }}>{t.noData}</p>}
              </div>
            </div>
          )}

          {/* Participants */}
          {tab === "participants" && (
            <div>
              <div className="card" style={{ borderRight: "6px solid #7c3aed" }}>
                <h1 style={{ fontSize: "28px", fontWeight: 900, marginBottom: "8px", color: "#7c3aed" }}>{t.tab4}</h1>
                <p style={{ color: "#64748b", margin: 0 }}>{t.participantsHint}</p>
              </div>

              <FiltersBar value={partF} setValue={setPartF} count={partRowsF.length} withQuery />

              <div className="card noprint" style={{ padding: 16, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button className="btn2" onClick={() => setRevealPII((v) => !v)}>🔒 {revealPII ? t.hide : t.reveal}</button>

                  <button className="btn2" onClick={() => {
                    const flat = [];
                    for (const r of partRoomData) {
                      for (const s of r.students) flat.push([r.code, r.trainer, s.name, s.phone, s.email]);
                    }
                    downloadCSV("participants.csv", [[t.room, t.trainer, t.name, t.phone, t.email], ...flat]);
                  }}>⬇️ {t.export}</button>

                  <button className="btn2" onClick={() => { setPartF({ trainerId: "ALL", classroomId: "ALL", from: "", to: "", q: "" }); setRevealPII(false); }}>
                    🧹 {t.clear}
                  </button>

                  <button className="btn2" style={{ borderColor: "#fca5a5", color: "#dc2626" }} onClick={() => setPurgeOpen(true)}>
                    🗑️ {t.purge}
                  </button>
                </div>

                <div className="badge" style={{ background: "#f1f5f9", color: "#0f172a" }}>
                  {lang === "ar" ? "قاعات" : "Rooms"}: {partRoomData.length}
                </div>
              </div>

              {partRoomData.map((r) => (
                <div key={r.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ background: "#f8fafc", padding: "16px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: "16px", alignItems: "center" }}>
                    <b style={{ fontSize: "18px", color: "#10b981" }}>{(lang === "ar" ? "قاعة " : "Room ") + r.code}</b>
                    <span style={{ color: "#64748b" }}>{(lang === "ar" ? "المدرب: " : "Trainer: ") + r.trainer}</span>
                    <span style={{ background: "#dbeafe", color: "#1d4ed8", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 900, marginInlineStart: "auto" }}>
                      {r.students.length} {lang === "ar" ? "مشارك" : "participants"}
                    </span>
                  </div>
                  <table className="tbl">
                    <thead>
                      <tr><th className="th">{t.name}</th><th className="th">{t.phone}</th><th className="th">{t.email}</th></tr>
                    </thead>
                    <tbody>
                      {r.students.map((s, i) => (
                        <tr key={i}>
                          <td className="td">{s.name || "—"}</td>
                          <td className="td" style={{ direction: "ltr" }}>{revealPII ? (s.phone || "—") : maskPhone(s.phone)}</td>
                          <td className="td" style={{ direction: "ltr", color: "#2563eb" }}>{revealPII ? (s.email || "—") : maskEmail(s.email)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {partRoomData.length === 0 && <p style={{ color: "#94a3b8", textAlign: "center" }}>{t.noData}</p>}
            </div>
          )}

          {/* Certificate */}
          {tab === "cert" && (
            <div>
              <div className="card" style={{ borderRight: "6px solid #d97706" }}>
                <h1 style={{ fontSize: "28px", fontWeight: 900, marginBottom: "8px", color: "#d97706" }}>{t.tab5}</h1>
                <p style={{ color: "#64748b", margin: 0 }}>{lang === "ar" ? "اختر فترة ومعايير ثم اطبع الشهادة." : "Choose range and criteria, then print."}</p>
              </div>

              <FiltersBar value={certF} setValue={setCertF} count={certAllRows.length} withMin />

              {certBest ? (
                <div className="card" style={{ textAlign: "center", padding: "40px", background: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "4px solid #d97706" }}>
                  <h1 style={{ fontSize: "36px", fontWeight: 900, color: "#d97706", marginBottom: "8px" }}>{lang === "ar" ? "شهادة تميز وإشادة" : "Certificate of Excellence"}</h1>
                  <p style={{ color: "#64748b", marginBottom: "24px" }}>{lang === "ar" ? "يمنح هذا التكريم لأفضل مدرب" : "This award is granted to the best trainer"}</p>
                  <h2 style={{ fontSize: "48px", fontWeight: 900, color: "#10b981", marginBottom: "16px" }}>{certBest.trainer}</h2>
                  <p style={{ fontSize: "20px", color: "#334155" }}>
                    {lang === "ar" ? "قاعة" : "Room"} <b style={{ color: "#2563eb" }}>{certBest.code}</b> — {lang === "ar" ? "معدل" : "Average"}:{" "}
                    <b style={{ color: "#d97706", direction: "ltr" }}>{certBest.avg.toFixed(2)}/5</b> ({lang === "ar" ? "استجابات" : "responses"}: {certBest.cnt})
                  </p>
                  <button onClick={() => window.print()} className="btn2 noprint" style={{ marginTop: 24, background: "#0f172a", color: "#fff" }}>🖨️ {t.print}</button>
                </div>
              ) : (
                <div className="card" style={{ textAlign: "center", padding: "60px" }}>
                  <p style={{ color: "#94a3b8", fontSize: "18px" }}>{t.noData}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== Delete Warning Modal ===== */}
      {purgeOpen && (
        <div className="modal-overlay noprint" onClick={closePurgeModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ direction: t.dir }}>

            <div className="modal-head">
              <div className="modal-head-icon">⚠️</div>
              <div>
                <h3>{lang === "ar" ? "حذف نهائي للاستجابات" : "Permanent Deletion"}</h3>
                <p>{lang === "ar" ? "هذا الإجراء غير قابل للاسترجاع" : "This action cannot be undone"}</p>
              </div>
            </div>

            <div className="modal-body">
              <ul className="modal-warning-list">
                <li>{lang === "ar" ? "سيتم حذف استجابات المتدربين نهائيًا من قاعدة البيانات." : "Trainee responses will be permanently deleted."}</li>
                <li>{lang === "ar" ? "الحذف يطبق على الفلاتر الحالية (المدرب / القاعة / الفترة)." : "Deletion applies to current filters (trainer / room / dates)."}</li>
                <li>{lang === "ar" ? "ستتأثر التقارير فورًا بعد الحذف." : "Reports will be affected immediately."}</li>
                <li>{lang === "ar" ? "يُوصى بشدة بتصدير البيانات قبل المتابعة." : "Strongly recommended to export data first."}</li>
              </ul>

              <label className="modal-label">{lang === "ar" ? "نوع الاستجابات المراد حذفها:" : "Response type to delete:"}</label>
              <div className="kind-options">
                {[
                  { key: "DAILY", ar: "اليومي", en: "Daily", icon: "📅" },
                  { key: "FINAL", ar: "الختامي", en: "Final", icon: "🏁" },
                  { key: "BOTH", ar: "كلاهما", en: "Both", icon: "🗂️" }
                ].map((opt) => (
                  <div key={opt.key} className={`kind-option ${purgeKind === opt.key ? "selected" : ""}`} onClick={() => setPurgeKind(opt.key)}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{opt.icon}</div>
                    {lang === "ar" ? opt.ar : opt.en}
                  </div>
                ))}
              </div>

              <label className="modal-label">{lang === "ar" ? "للمتابعة، اكتب كود التأكيد:" : "Type the confirmation code:"}</label>
              <input
                type="password"
                className={`code-input ${codeError ? "error" : ""}`}
                placeholder="••••"
                maxLength={4}
                value={purgeCode}
                onChange={(e) => setPurgeCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => { if (e.key === "Enter" && purgeCode.length === 4) executePurge(); }}
                disabled={purgeBusy}
              />

              {purgeMsg && (
                <div className={`modal-result ${purgeMsg.startsWith("success:") ? "success" : "error"}`}>
                  {purgeMsg.replace(/^(success:|error:)/, "")}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="modal-btn-cancel" onClick={closePurgeModal} disabled={purgeBusy}>
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button className="modal-btn-delete" onClick={executePurge} disabled={purgeBusy || purgeCode.length !== 4}>
                {purgeBusy ? (lang === "ar" ? "⏳ جاري الحذف..." : "⏳ Deleting...") : (lang === "ar" ? "🗑️ حذف نهائي" : "🗑️ Delete Permanently")}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
