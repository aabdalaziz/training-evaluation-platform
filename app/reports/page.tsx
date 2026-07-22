// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

/* =========================
   Basic helpers
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

/* =========================
   Advanced analytics helpers
   ========================= */
function normalizeText(s = "") {
  return String(s)
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/[^\u0600-\u06FFa-z0-9]+/gi, " ")
    .trim();
}

const AXIS_FALLBACK = [
  {
    axisAr: "الوصول",
    axisEn: "Arrival",
    keys: [
      "تقييم الاستقبال في المطار",
      "airport reception",
      "تقييم حفل الاستقبال في الجامعة",
      "university welcome ceremony"
    ]
  },
  {
    axisAr: "التعليم",
    axisEn: "Education",
    keys: [
      "جودة التعلم والتعليم",
      "learning quality",
      "ملاءمة المحتوى والمستوى",
      "content and level suitability",
      "أداء المعلمين الإجمالي",
      "overall teachers performance",
      "وضوح شرح المعلمين",
      "teacher clarity",
      "تفاعل المعلمين مع الطلاب",
      "teacher student interaction"
    ]
  },
  {
    axisAr: "الخدمات",
    axisEn: "Services",
    keys: [
      "الضيافة وحسن الاستقبال",
      "hospitality",
      "الانتقالات والمواصلات",
      "transportation"
    ]
  },
  {
    axisAr: "السكن",
    axisEn: "Housing",
    keys: ["جودة السكن", "housing quality"]
  },
  {
    axisAr: "الجولات",
    axisEn: "Tours",
    keys: ["الجولات والزيارات", "tours and visits"]
  },
  {
    axisAr: "الرحلات",
    axisEn: "Trips",
    keys: ["تنظيم رحلة العمرة", "umrah trip organization"]
  },
  {
    axisAr: "الإدارة",
    axisEn: "Administration",
    keys: ["تعامل إدارة البرنامج", "program administration", "سرعة الاستجابة", "response speed"]
  },
  {
    axisAr: "الرضا",
    axisEn: "Satisfaction",
    keys: ["الرضا العام عن البرنامج", "overall satisfaction"]
  },
  {
    axisAr: "جودة الحصة",
    axisEn: "Session Quality",
    keys: [
      "ما مدى وضوح شرح الدرس",
      "how clear was the lesson",
      "كيف تقيم أسلوب التدريس",
      "teaching style"
    ]
  }
];

function inferAxisFromQuestion(q) {
  const secAr = q?.section_ar || "";
  const secEn = q?.section_en || "";
  const textAr = q?.text_ar || "";
  const textEn = q?.text_en || "";
  const bag = normalizeText(`${secAr} ${secEn} ${textAr} ${textEn}`);

  if (secAr || secEn) {
    return {
      axisAr: secAr || secEn || "غير مصنف",
      axisEn: secEn || secAr || "Uncategorized"
    };
  }

  for (const item of AXIS_FALLBACK) {
    for (const k of item.keys) {
      if (bag.includes(normalizeText(k))) {
        return { axisAr: item.axisAr, axisEn: item.axisEn };
      }
    }
  }

  return {
    axisAr: "غير مصنف",
    axisEn: "Uncategorized"
  };
}

function canonicalQuestionKey(q) {
  const axis = inferAxisFromQuestion(q);
  const label = normalizeText(q?.text_ar || q?.text_en || "");
  return `${axis.axisAr}||${label}`;
}

function dedupeAnswers(inAns, qs) {
  const qMap = new Map((qs || []).map((q) => [q.id, q]));
  const seen = new Set();
  const cleaned = [];

  for (const a of inAns || []) {
    if (!a || a.rating_value == null) continue;

    const q = qMap.get(a.question_id);
    const axis = inferAxisFromQuestion(q);
    const key = `${a.evaluation_id}||${canonicalQuestionKey(q)}`;

    if (seen.has(key)) continue;
    seen.add(key);

    cleaned.push({
      ...a,
      _q: q,
      _axis: axis
    });
  }

  return cleaned;
}

function mean(xs) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(xs) {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function variance(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return mean(xs.map((x) => (x - m) ** 2));
}

function stddev(xs) {
  return Math.sqrt(variance(xs));
}

function pctLow(xs) {
  if (!xs.length) return 0;
  return (xs.filter((x) => x <= 2).length / xs.length) * 100;
}

function pctHigh(xs) {
  if (!xs.length) return 0;
  return (xs.filter((x) => x >= 4).length / xs.length) * 100;
}

function riskLevel({ n, m, sd, lowPct }) {
  if (n < 5) {
    return {
      key: "NA",
      ar: "غير كافٍ",
      en: "Insufficient",
      bg: "#f1f5f9",
      fg: "#64748b",
      score: 0
    };
  }

  if (m < 3.0 || lowPct > 20 || sd >= 1.2) {
    return {
      key: "HIGH",
      ar: "قلق",
      en: "High risk",
      bg: "#fee2e2",
      fg: "#b91c1c",
      score: 3
    };
  }

  if (m < 3.7 || lowPct > 10 || sd >= 1.0) {
    return {
      key: "MED",
      ar: "مراقبة",
      en: "Watch",
      bg: "#fef3c7",
      fg: "#b45309",
      score: 2
    };
  }

  return {
    key: "LOW",
    ar: "مطمئن",
    en: "Good",
    bg: "#d1fae5",
    fg: "#047857",
    score: 1
  };
}

function axisCategory(axisAr = "", axisEn = "") {
  const s = `${axisAr} ${axisEn}`.toLowerCase();

  if (
    s.includes("مدرب") ||
    s.includes("teacher") ||
    s.includes("education") ||
    s.includes("التعليم") ||
    s.includes("جودة الحصة")
  )
    return "education";

  if (s.includes("استقبال") || s.includes("arrival") || s.includes("الوصول")) return "arrival";
  if (s.includes("خدمات") || s.includes("hospitality") || s.includes("transport") || s.includes("الخدمات")) return "services";
  if (s.includes("سكن") || s.includes("housing")) return "housing";
  if (s.includes("جولات") || s.includes("tours")) return "tours";
  if (s.includes("عمرة") || s.includes("trip") || s.includes("الرحلات")) return "trips";
  if (s.includes("إدارة") || s.includes("administration")) return "admin";
  if (s.includes("رضا") || s.includes("satisfaction")) return "satisfaction";

  return "general";
}

const RECOMMENDATIONS = {
  education: {
    ar: "رفع التفاعل داخل القاعة، استخدام أمثلة تطبيقية، تحسين وضوح الشرح، والتحقق من الفهم في نهاية الجلسة.",
    en: "Increase classroom engagement, use practical examples, improve clarity, and add end-of-session checks."
  },
  arrival: {
    ar: "تحسين آلية الاستقبال، تقليل وقت الانتظار، إرسال التعليمات المسبقة، وتوضيح نقاط الالتقاء.",
    en: "Improve reception workflow, reduce waiting time, send pre-arrival instructions, and clarify meeting points."
  },
  services: {
    ar: "توحيد معايير الضيافة والنقل، متابعة الالتزام بالمواعيد، وتفعيل قناة دعم فورية للمشاركين.",
    en: "Standardize hospitality and transport, improve punctuality, and activate a quick support channel."
  },
  housing: {
    ar: "مراجعة جودة السكن، تسريع معالجة الملاحظات، وتحسين معايير النظافة والراحة.",
    en: "Review housing quality, speed up issue handling, and improve cleanliness and comfort standards."
  },
  tours: {
    ar: "تحسين تنظيم الجولات، ضبط الوقت، وقياس رضا المشاركين بعد كل زيارة.",
    en: "Improve tour planning, time management, and measure satisfaction after each visit."
  },
  trips: {
    ar: "رفع جاهزية تنظيم الرحلات، وضوح الخطة الزمنية، وتوفير متابعة ميدانية أفضل.",
    en: "Improve trip readiness, clarify schedule, and provide better field coordination."
  },
  admin: {
    ar: "تحسين سرعة الاستجابة، توضيح الإجراءات، وتوحيد تجربة التواصل مع إدارة البرنامج.",
    en: "Improve response speed, clarify procedures, and standardize communication experience."
  },
  satisfaction: {
    ar: "تحسين المحاور الأدنى أداءً أولًا لأنها الأكثر تأثيرًا على الرضا العام.",
    en: "Improve the lowest-performing axes first, as they have the strongest impact on overall satisfaction."
  },
  general: {
    ar: "تنفيذ معالجة سريعة، ثم إعادة القياس خلال فترة قصيرة للتحقق من الأثر.",
    en: "Apply quick fixes, then re-measure within a short cycle to validate impact."
  }
};

function recommendationForAxis(axisAr, axisEn, riskKey, lang) {
  if (riskKey === "LOW") {
    return lang === "ar"
      ? "نقطة قوة: الاستمرار مع توثيق الممارسات الجيدة ومشاركتها."
      : "Strength: maintain and document best practices.";
  }

  if (riskKey === "NA") {
    return lang === "ar"
      ? "العينة غير كافية لاتخاذ قرار موثوق؛ يُفضّل زيادة الاستجابات."
      : "Sample is too small for a reliable decision; collect more responses.";
  }

  const cat = axisCategory(axisAr, axisEn);
  return RECOMMENDATIONS[cat]?.[lang] || RECOMMENDATIONS.general[lang];
}

function buildAxisStats(inAns, qs, lang) {
  const cleaned = dedupeAnswers(inAns, qs);
  const groups = new Map();

  for (const a of cleaned) {
    const v = Number(a.rating_value);
    if (Number.isNaN(v) || v < 1 || v > 5) continue;

    const axisAr = a?._axis?.axisAr || "غير مصنف";
    const axisEn = a?._axis?.axisEn || "Uncategorized";
    const axisKey = `${axisAr}||${axisEn}`;

    const g = groups.get(axisKey) || {
      axisAr,
      axisEn,
      values: [],
      questions: new Map()
    };

    g.values.push(v);

    const q = a._q;
    const qKey = canonicalQuestionKey(q);
    const qItem = g.questions.get(qKey) || {
      labelAr: q?.text_ar || q?.text_en || "سؤال",
      labelEn: q?.text_en || q?.text_ar || "Question",
      values: []
    };

    qItem.values.push(v);
    g.questions.set(qKey, qItem);
    groups.set(axisKey, g);
  }

  const out = [];

  for (const g of groups.values()) {
    const xs = g.values;
    const n = xs.length;
    const m = mean(xs);
    const med = median(xs);
    const vari = variance(xs);
    const sd = stddev(xs);
    const low = pctLow(xs);
    const high = pctHigh(xs);
    const risk = riskLevel({ n, m, sd, lowPct: low });

    const questionStats = [...g.questions.values()]
      .map((q) => ({
        label: lang === "ar" ? q.labelAr : q.labelEn,
        mean: mean(q.values),
        n: q.values.length
      }))
      .sort((a, b) => a.mean - b.mean);

    out.push({
      axisAr: g.axisAr,
      axisEn: g.axisEn,
      axisLabel: lang === "ar" ? g.axisAr : g.axisEn,
      n,
      mean: m,
      median: med,
      variance: vari,
      sd,
      lowPct: low,
      highPct: high,
      risk,
      rec: recommendationForAxis(g.axisAr, g.axisEn, risk.key, lang),
      questions: questionStats
    });
  }

  return out.sort(
    (a, b) =>
      b.risk.score - a.risk.score ||
      b.lowPct - a.lowPct ||
      a.mean - b.mean
  );
}

function buildNarrative(stats, lang) {
  const valid = (stats || []).filter((x) => x.risk.key !== "NA");
  if (!valid.length) return [];

  const risks = [...valid]
    .filter((x) => x.risk.key === "HIGH")
    .sort((a, b) => b.lowPct - a.lowPct || a.mean - b.mean);

  const strengths = [...valid]
    .filter((x) => x.risk.key === "LOW")
    .sort((a, b) => b.mean - a.mean);

  const watch = [...valid]
    .filter((x) => x.risk.key === "MED")
    .sort((a, b) => b.lowPct - a.lowPct || a.mean - b.mean);

  const out = [];

  if (risks[0]) {
    out.push({
      tone: "red",
      title: lang === "ar" ? "أعلى منطقة قلق" : "Top risk area",
      text:
        lang === "ar"
          ? `${risks[0].axisLabel}: متوسط ${risks[0].mean.toFixed(2)}، ونسبة منخفض ${risks[0].lowPct.toFixed(0)}%. ${risks[0].rec}`
          : `${risks[0].axisLabel}: mean ${risks[0].mean.toFixed(2)}, low ratings ${risks[0].lowPct.toFixed(0)}%. ${risks[0].rec}`
    });
  }

  if (strengths[0]) {
    out.push({
      tone: "green",
      title: lang === "ar" ? "أبرز نقطة قوة" : "Top strength",
      text:
        lang === "ar"
          ? `${strengths[0].axisLabel}: متوسط ${strengths[0].mean.toFixed(2)} مع استقرار جيد. يُوصى بالحفاظ على هذا المستوى وتوثيق الممارسات الجيدة.`
          : `${strengths[0].axisLabel}: mean ${strengths[0].mean.toFixed(2)} with good consistency. Maintain and document best practices.`
    });
  }

  if (watch[0]) {
    out.push({
      tone: "amber",
      title: lang === "ar" ? "محور يحتاج متابعة" : "Watchlist axis",
      text:
        lang === "ar"
          ? `${watch[0].axisLabel}: متوسط ${watch[0].mean.toFixed(2)} ويحتاج متابعة قبل أن يتحول إلى منطقة قلق.`
          : `${watch[0].axisLabel}: mean ${watch[0].mean.toFixed(2)} and should be monitored before it becomes a high-risk area.`
    });
  }

  return out;
}

/* =========================
   UI constants
   ========================= */
const TEAL = "#10b981";
const BLUE = "#2563eb";

const dict = {
  ar: {
    dir: "rtl",
    font: "'Tajawal', sans-serif",
    title: "لوحة ذكاء الأعمال",
    sub: "النظام المركزي للتحليلات",
    tab1: "الملخص التنفيذي",
    tab2: "التقرير اليومي",
    tab3: "التقرير النهائي",
    tab4: "سجل المشاركين",
    tab5: "شهادة التميز",
    lang: "English",
    totalRes: "حجم العينة",
    dailySat: "الرضا اليومي",
    finalSat: "الرضا النهائي",
    room: "القاعة",
    trainer: "المدرب",
    name: "الاسم",
    email: "البريد",
    phone: "الجوال",
    noData: "لا توجد بيانات.",
    filters: "الفلاتر",
    allTrainers: "كل المدربين",
    allRooms: "كل القاعات",
    reset: "إعادة تعيين",
    search: "بحث (اسم/بريد/جوال)",
    reveal: "إظهار البيانات",
    hide: "إخفاء البيانات",
    export: "تصدير CSV",
    executiveHint: "تقارير ذكية لمؤشرات الجودة والتقييم.",
    dailyHint: "تحليل أداء الحصص التدريبية.",
    finalHint: "رضا المتدربين عن البرنامج.",
    participantsHint: "فلترة حسب القاعة + المدرب + الفترة، مع بحث وتصدير.",
    print: "طباعة",
    minResponses: "حد أدنى للاستجابات",
    sample: "عدد الاستجابات"
  },
  en: {
    dir: "ltr",
    font: "'Inter', sans-serif",
    title: "BI Dashboard",
    sub: "Central Analytics",
    tab1: "Overview",
    tab2: "Daily Report",
    tab3: "Final Report",
    tab4: "Participants",
    tab5: "Certificate",
    lang: "العربية",
    totalRes: "Sample Size",
    dailySat: "Daily satisfaction",
    finalSat: "Final satisfaction",
    room: "Room",
    trainer: "Trainer",
    name: "Name",
    email: "Email",
    phone: "Phone",
    noData: "No data.",
    filters: "Filters",
    allTrainers: "All trainers",
    allRooms: "All rooms",
    reset: "Reset",
    search: "Search (name/email/phone)",
    reveal: "Show data",
    hide: "Hide data",
    export: "Export CSV",
    executiveHint: "Smart analytics for quality & evaluation.",
    dailyHint: "Daily session performance analysis.",
    finalHint: "Program satisfaction analysis.",
    participantsHint: "Filter by room + trainer + date range, with search and export.",
    print: "Print",
    minResponses: "Min responses",
    sample: "Responses"
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
.th { padding: 14px; font-weight: 800; font-size: 14px; color: #64748b; border-bottom: 2px solid #eef2f6; text-align: start; white-space: nowrap; }
.td { padding: 14px; font-size: 14px; border-bottom: 1px solid #f1f5f9; font-weight: 600; vertical-align: middle; }

.badge { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px; font-size:12px; font-weight:900; }

.sel, .inp{
  width:100%;
  padding:12px 12px;
  border-radius:12px;
  border:1px solid #cbd5e1;
  background:#fff;
  font-weight:800;
  outline:none;
}
.sel:focus, .inp:focus{ border-color:#2563eb; box-shadow:0 0 0 4px rgba(37,99,235,.12); }
.fgrid{ display:grid; grid-template-columns: repeat(5, 1fr); gap:12px; }

.btn{
  width:auto;
  padding:12px 16px;
  border-radius:12px;
  border:1px solid #cbd5e1;
  background:#0f172a;
  color:#fff;
  font-weight:900;
  cursor:pointer;
}
.btn2{
  width:auto;
  padding:12px 16px;
  border-radius:12px;
  border:1px solid #cbd5e1;
  background:#fff;
  color:#0f172a;
  font-weight:900;
  cursor:pointer;
}

.noprint{}
@media(max-width: 1100px){
  .g3 { grid-template-columns: 1fr; }
}
@media(max-width: 950px){
  .lay { flex-direction: column; }
  .side { width: 100%; position: static; }
  .g2, .g3 { grid-template-columns: 1fr; }
  .fgrid{ grid-template-columns: 1fr; }
}
@media print {
  .side, .noprint { display: none !important; }
  .rw { padding: 0; background: #fff; }
  .card { box-shadow: none !important; }
}
`;

function GaugeChart({ score, color }) {
  const pct = score ? (score / 5) * 100 : 0;
  const radius = 55;
  const circumference = Math.PI * radius;

  return (
    <div style={{ textAlign: "center", position: "relative", height: "85px", width: "150px", margin: "0 auto" }}>
      <svg width="150" height="85" viewBox="0 0 150 85">
        <path
          d="M 15 75 A 55 55 0 0 1 135 75"
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d="M 15 75 A 55 55 0 0 1 135 75"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (pct / 100) * circumference}
          style={{ transition: "stroke-dashoffset 1.5s" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          bottom: "-5px",
          left: 0,
          right: 0,
          fontSize: "28px",
          fontWeight: "900",
          direction: "ltr",
          unicodeBidi: "plaintext"
        }}
      >
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

  const ENABLE_EMAIL = false;

  const emptyRange = { from: "", to: "" };
  const [dashF, setDashF] = useState({ trainerId: "ALL", classroomId: "ALL", ...emptyRange });
  const [dailyF, setDailyF] = useState({ trainerId: "ALL", classroomId: "ALL", ...emptyRange });
  const [finalF, setFinalF] = useState({ trainerId: "ALL", classroomId: "ALL", ...emptyRange });

  const [partF, setPartF] = useState({ trainerId: "ALL", classroomId: "ALL", from: "", to: "", q: "" });
  const [revealPII, setRevealPII] = useState(false);

  const [certF, setCertF] = useState({ trainerId: "ALL", classroomId: "ALL", ...emptyRange, min: 3 });

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
      if (!s.data?.session) {
        router.push("/login");
        return;
      }

      if (on) {
        await fetchAllData();
        setLoad(false);
      }
    })();

    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusOf = (v) => {
    const val = Number(v) || 0;
    if (val >= 4) return { t: lang === "ar" ? "ممتاز" : "Excellent", bg: "#d1fae5", fg: "#047857" };
    if (val >= 3) return { t: lang === "ar" ? "جيد" : "Good", bg: "#fef3c7", fg: "#b45309" };
    return { t: lang === "ar" ? "يحتاج" : "Needs work", bg: "#fee2e2", fg: "#b91c1c" };
  };

  const calc = (inRows, inAns) => {
    const list = inRows || [];
    const ids = new Set(list.map((r) => r.id));
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    const filteredAns = (inAns || []).filter((a) => a && ids.has(a.evaluation_id));
    const cleaned = dedupeAnswers(filteredAns, qs);

    const g = {};
    cleaned.forEach((a) => {
      const v = Number(a.rating_value);
      if (Number.isNaN(v)) return;

      const q = a._q;
      const key = canonicalQuestionKey(q);
      const label =
        lang === "ar"
          ? q?.text_ar || q?.text_en || "سؤال"
          : q?.text_en || q?.text_ar || "Question";

      if (!g[key]) g[key] = { label, values: [] };
      g[key].values.push(v);
    });

    const axes = Object.values(g)
      .map((x) => ({
        label: x.label,
        value: avg(x.values)
      }))
      .sort((a, b) => b.value - a.value);

    const dist = [0, 0, 0, 0, 0];
    list.forEach((r) => {
      const v = Math.round(Number(r.overall_rating));
      if (v >= 1 && v <= 5) dist[v - 1] += 1;
    });

    const all = list.map((r) => Number(r.overall_rating)).filter((v) => v > 0);

    return {
      count: list.length,
      avg: avg(all),
      axes,
      dist
    };
  };

  /* =========================
     Dashboard filtered data
     ========================= */
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
      const id = r.classroom_id;
      if (!id) continue;
      const item = map.get(id) || { sum: 0, cnt: 0 };
      item.sum += Number(r.overall_rating || 0);
      item.cnt += 1;
      map.set(id, item);
    }

    const out = [];
    for (const c of classrooms) {
      const stat = map.get(c.id);
      if (!stat || !stat.cnt) continue;
      const tr = trainers.find((x) => x.id === c.trainer_id);
      out.push({
        id: c.id,
        code: c.code,
        trainer: tr?.name || "—",
        avg: stat.sum / stat.cnt,
        count: stat.cnt
      });
    }

    return out.sort((a, b) => b.avg - a.avg);
  }, [dashAllRows, classrooms, trainers]);

  /* =========================
     Daily filtered data
     ========================= */
  const dailyRowsF = useMemo(() => filterRowsBy(rows, classrooms, "DAILY", dailyF), [rows, classrooms, dailyF]);
  const dailyIdsF = useMemo(() => new Set(dailyRowsF.map((r) => r.id)), [dailyRowsF]);
  const dailyAnsF = useMemo(() => ans.filter((a) => a && dailyIdsF.has(a.evaluation_id)), [ans, dailyIdsF]);
  const daily = useMemo(() => calc(dailyRowsF, dailyAnsF), [dailyRowsF, dailyAnsF, qs, lang]);

  /* =========================
     Final filtered data
     ========================= */
  const finalRowsF = useMemo(() => filterRowsBy(rows, classrooms, "FINAL", finalF), [rows, classrooms, finalF]);
  const finalIdsF = useMemo(() => new Set(finalRowsF.map((r) => r.id)), [finalRowsF]);
  const finalAnsF = useMemo(() => ans.filter((a) => a && finalIdsF.has(a.evaluation_id)), [ans, finalIdsF]);
  const final = useMemo(() => calc(finalRowsF, finalAnsF), [finalRowsF, finalAnsF, qs, lang]);

  /* =========================
     Advanced axis analytics
     ========================= */
  const dashDailyAxisStats = useMemo(() => buildAxisStats(dashDailyAns, qs, lang), [dashDailyAns, qs, lang]);
  const dashFinalAxisStats = useMemo(() => buildAxisStats(dashFinalAns, qs, lang), [dashFinalAns, qs, lang]);
  const dailyAxisStats = useMemo(() => buildAxisStats(dailyAnsF, qs, lang), [dailyAnsF, qs, lang]);
  const finalAxisStats = useMemo(() => buildAxisStats(finalAnsF, qs, lang), [finalAnsF, qs, lang]);

  const executiveAxisStats = useMemo(() => {
    return dashFinalAxisStats.length ? dashFinalAxisStats : dashDailyAxisStats;
  }, [dashDailyAxisStats, dashFinalAxisStats]);

  const executiveInsights = useMemo(() => buildNarrative(executiveAxisStats, lang), [executiveAxisStats, lang]);
  const dailyInsights = useMemo(() => buildNarrative(dailyAxisStats, lang), [dailyAxisStats, lang]);
  const finalInsights = useMemo(() => buildNarrative(finalAxisStats, lang), [finalAxisStats, lang]);

  /* =========================
     Participants filtered data
     ========================= */
  const partRowsF = useMemo(() => filterRowsBy(rows, classrooms, null, partF), [rows, classrooms, partF]);

  const partRoomData = useMemo(() => {
    const byClass = new Map();

    for (const e of partRowsF) {
      const cid = e.classroom_id;
      if (!cid) continue;
      const s = {
        name: e.guest_name || e.profile?.full_name || "—",
        email: e.guest_email || e.profile?.email || "",
        phone: e.guest_phone || e.profile?.phone || ""
      };
      const arr = byClass.get(cid) || [];
      arr.push(s);
      byClass.set(cid, arr);
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
        ? uniq.filter((x) => {
            return (
              (x.name || "").toLowerCase().includes(q) ||
              (x.email || "").toLowerCase().includes(q) ||
              (x.phone || "").toLowerCase().includes(q)
            );
          })
        : uniq;

      const tr = trainers.find((x) => x.id === c.trainer_id);

      out.push({
        id: c.id,
        code: c.code,
        trainer: tr?.name || "—",
        trainer_id: c.trainer_id,
        students: filtered
      });
    }

    return out.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }, [partRowsF, classrooms, trainers, partF.q]);

  /* =========================
     Certificate filtered data
     ========================= */
  const certAllRows = useMemo(() => filterRowsBy(rows, classrooms, null, certF), [rows, classrooms, certF]);

  const certBest = useMemo(() => {
    const map = new Map();

    for (const r of certAllRows) {
      const cid = r.classroom_id;
      if (!cid) continue;
      const item = map.get(cid) || { sum: 0, cnt: 0 };
      item.sum += Number(r.overall_rating || 0);
      item.cnt += 1;
      map.set(cid, item);
    }

    const min = Number(certF.min || 0);
    let best = null;

    for (const c of classrooms) {
      const stat = map.get(c.id);
      if (!stat) continue;
      if (min && stat.cnt < min) continue;

      const avg = stat.sum / stat.cnt;
      if (!best || avg > best.avg) {
        const tr = trainers.find((x) => x.id === c.trainer_id);
        best = {
          classroomId: c.id,
          code: c.code,
          trainer: tr?.name || "—",
          avg,
          cnt: stat.cnt
        };
      }
    }

    return best;
  }, [certAllRows, classrooms, trainers, certF.min]);

  /* =========================
     UI sub-components
     ========================= */
  const FiltersBar = ({ value, setValue, count, withQuery = false, withMin = false }) => {
    const rooms =
      value?.trainerId && value.trainerId !== "ALL"
        ? classrooms.filter((c) => c.trainer_id === value.trainerId)
        : classrooms;

    useEffect(() => {
      if (!value) return;
      if (value.trainerId === "ALL") return;
      if (value.classroomId === "ALL") return;

      const ok = classrooms.some((c) => c.id === value.classroomId && c.trainer_id === value.trainerId);
      if (!ok) setValue((f) => ({ ...f, classroomId: "ALL" }));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value.trainerId]);

    const reset = () => {
      if (withQuery && withMin) {
        setValue({ trainerId: "ALL", classroomId: "ALL", from: "", to: "", q: "", min: 3 });
      } else if (withQuery) {
        setValue({ trainerId: "ALL", classroomId: "ALL", from: "", to: "", q: "" });
      } else if (withMin) {
        setValue({ trainerId: "ALL", classroomId: "ALL", from: "", to: "", min: 3 });
      } else {
        setValue({ trainerId: "ALL", classroomId: "ALL", from: "", to: "" });
      }
    };

    return (
      <div className="card noprint" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center", gap: 10 }}>
          <b style={{ color: "#0f172a" }}>{t.filters}</b>
          <span className="badge" style={{ background: "#eef2ff", color: "#3730a3", direction: "ltr", unicodeBidi: "plaintext" }}>
            {t.sample}: {count ?? 0}
          </span>
        </div>

        <div className="fgrid">
          <select
            className="sel"
            value={value.trainerId}
            onChange={(e) => setValue((f) => ({ ...f, trainerId: e.target.value, classroomId: "ALL" }))}
          >
            <option value="ALL">{t.allTrainers}</option>
            {trainers.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name}
              </option>
            ))}
          </select>

          <select
            className="sel"
            value={value.classroomId}
            onChange={(e) => setValue((f) => ({ ...f, classroomId: e.target.value }))}
            disabled={value.trainerId !== "ALL" && rooms.length === 0}
          >
            <option value="ALL">{t.allRooms}</option>
            {value.trainerId !== "ALL" && rooms.length === 0 ? (
              <option value="NONE" disabled>
                {lang === "ar" ? "لا توجد قاعات لهذا المدرب" : "No rooms for this trainer"}
              </option>
            ) : (
              rooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))
            )}
          </select>

          {"from" in value && (
            <input
              className="inp"
              type="date"
              value={value.from}
              onChange={(e) => setValue((f) => ({ ...f, from: e.target.value }))}
            />
          )}

          {"to" in value && (
            <input
              className="inp"
              type="date"
              value={value.to}
              onChange={(e) => setValue((f) => ({ ...f, to: e.target.value }))}
            />
          )}

          {withQuery && (
            <input
              className="inp"
              placeholder={t.search}
              value={value.q}
              onChange={(e) => setValue((f) => ({ ...f, q: e.target.value }))}
            />
          )}

          {withMin && (
            <input
              className="inp"
              type="number"
              min={1}
              placeholder={t.minResponses}
              value={value.min}
              onChange={(e) => setValue((f) => ({ ...f, min: e.target.value }))}
            />
          )}

          <button className="sel" onClick={reset}>
            {t.reset}
          </button>
        </div>
      </div>
    );
  };

  const DistBar = ({ low, high }) => {
    const neutral = Math.max(0, 100 - low - high);
    return (
      <div style={{ display: "flex", width: 150, height: 10, borderRadius: 999, overflow: "hidden", background: "#e2e8f0" }}>
        <div style={{ width: `${low}%`, background: "#ef4444" }} />
        <div style={{ width: `${neutral}%`, background: "#cbd5e1" }} />
        <div style={{ width: `${high}%`, background: "#10b981" }} />
      </div>
    );
  };

  const InsightStrip = ({ items }) => {
    if (!items?.length) return null;

    const tones = {
      red: { bg: "#fef2f2", bd: "#fecaca", fg: "#991b1b" },
      green: { bg: "#ecfdf5", bd: "#a7f3d0", fg: "#065f46" },
      amber: { bg: "#fffbeb", bd: "#fde68a", fg: "#92400e" }
    };

    return (
      <div className="g3">
        {items.map((x, i) => {
          const c = tones[x.tone] || tones.amber;
          return (
            <div key={i} className="card" style={{ background: c.bg, border: `1px solid ${c.bd}` }}>
              <div style={{ fontWeight: 900, color: c.fg, marginBottom: 8 }}>{x.title}</div>
              <div style={{ fontSize: 14, lineHeight: 1.9, color: "#334155" }}>{x.text}</div>
            </div>
          );
        })}
      </div>
    );
  };

  const AxisRiskTable = ({ title, items }) => {
    return (
      <div className="card">
        <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 16 }}>{title}</h3>

        {items?.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th className="th">{lang === "ar" ? "المحور" : "Axis"}</th>
                  <th className="th">N</th>
                  <th className="th">{lang === "ar" ? "المتوسط" : "Mean"}</th>
                  <th className="th">{lang === "ar" ? "الوسيط" : "Median"}</th>
                  <th className="th">{lang === "ar" ? "التباين" : "Variance"}</th>
                  <th className="th">{lang === "ar" ? "الانحراف" : "Std Dev"}</th>
                  <th className="th">{lang === "ar" ? "% منخفض" : "% Low"}</th>
                  <th className="th">{lang === "ar" ? "% مرتفع" : "% High"}</th>
                  <th className="th">{lang === "ar" ? "التوزيع" : "Distribution"}</th>
                  <th className="th">{lang === "ar" ? "الحالة" : "Risk"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((x, i) => (
                  <tr key={i}>
                    <td className="td" style={{ fontWeight: 900 }}>{x.axisLabel}</td>
                    <td className="td" style={{ direction: "ltr" }}>{x.n}</td>
                    <td className="td" style={{ direction: "ltr" }}>{x.mean.toFixed(2)}</td>
                    <td className="td" style={{ direction: "ltr" }}>{x.median.toFixed(2)}</td>
                    <td className="td" style={{ direction: "ltr" }}>{x.variance.toFixed(2)}</td>
                    <td className="td" style={{ direction: "ltr" }}>{x.sd.toFixed(2)}</td>
                    <td className="td" style={{ direction: "ltr", color: "#b91c1c", fontWeight: 900 }}>{x.lowPct.toFixed(0)}%</td>
                    <td className="td" style={{ direction: "ltr", color: "#047857", fontWeight: 900 }}>{x.highPct.toFixed(0)}%</td>
                    <td className="td"><DistBar low={x.lowPct} high={x.highPct} /></td>
                    <td className="td">
                      <span style={{ background: x.risk.bg, color: x.risk.fg, padding: "4px 10px", borderRadius: 999, fontWeight: 900, fontSize: 12 }}>
                        {lang === "ar" ? x.risk.ar : x.risk.en}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: "#94a3b8", textAlign: "center" }}>{t.noData}</p>
        )}
      </div>
    );
  };

  const ActionList = ({ title, items }) => {
    const targets = (items || [])
      .filter((x) => x.risk.key === "HIGH" || x.risk.key === "MED")
      .slice(0, 5);

    return (
      <div className="card">
        <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 16 }}>{title}</h3>

        {targets.length ? (
          <div style={{ display: "grid", gap: 12 }}>
            {targets.map((x, i) => (
              <div key={i} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <b>{x.axisLabel}</b>
                  <span style={{ background: x.risk.bg, color: x.risk.fg, padding: "4px 10px", borderRadius: 999, fontWeight: 900, fontSize: 12 }}>
                    {lang === "ar" ? x.risk.ar : x.risk.en}
                  </span>
                </div>
                <div style={{ color: "#475569", lineHeight: 1.9 }}>{x.rec}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "#047857", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 14, padding: 14 }}>
            {lang === "ar"
              ? "لا توجد مناطق قلق جوهرية في البيانات الحالية. يُوصى بالحفاظ على الأداء الحالي ومراقبة الاستمرارية."
              : "No major risk areas detected in the current data. Maintain the current level and monitor continuity."}
          </div>
        )}
      </div>
    );
  };

  if (!mounted || load) {
    return (
      <div className="rw" style={{ display: "flex", justifyContent: "center", alignItems: "center", background: "#0f172a" }}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div
          style={{
            width: 60,
            height: 60,
            border: "6px solid rgba(255,255,255,0.1)",
            borderTopColor: "#10b981",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}
        />
      </div>
    );
  }

  return (
    <div className="rw" style={{ direction: t.dir, fontFamily: t.font }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="lay">
        <aside className="side noprint">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "linear-gradient(135deg,#10b981,#0d9488)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px"
              }}
            >
              📊
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: "18px" }}>{t.title}</div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>{t.sub}</div>
            </div>
          </div>

          <button className={tab === "dashboard" ? "ton" : "tof"} onClick={() => setTab("dashboard")}>
            <span>{t.tab1}</span><span>🏢</span>
          </button>
          <button className={tab === "daily" ? "ton" : "tof"} onClick={() => setTab("daily")}>
            <span>{t.tab2}</span><span>📈</span>
          </button>
          <button className={tab === "final" ? "ton" : "tof"} onClick={() => setTab("final")}>
            <span>{t.tab3}</span><span>🏁</span>
          </button>
          <button className={tab === "participants" ? "ton" : "tof"} onClick={() => setTab("participants")}>
            <span>{t.tab4}</span><span>👥</span>
          </button>
          <button className={tab === "cert" ? "ton" : "tof"} onClick={() => setTab("cert")}>
            <span>{t.tab5}</span><span>🏆</span>
          </button>

          <div style={{ marginTop: "24px", borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: "16px" }}>
            <button
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.1)",
                border: "none",
                color: "#fff",
                padding: "12px",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                marginBottom: "8px"
              }}
            >
              🌐 {t.lang}
            </button>
            <button
              onClick={() => router.push("/admin/management")}
              style={{
                width: "100%",
                background: "transparent",
                border: "1px solid #334155",
                color: "#cbd5e1",
                cursor: "pointer",
                padding: "12px",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: 700
              }}
            >
              ⚙️ {lang === "ar" ? "الإدارة" : "Admin"}
            </button>
          </div>
        </aside>

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
                  <div style={{ fontSize: "44px", fontWeight: 900, direction: "ltr", unicodeBidi: "plaintext" }}>
                    {dashDaily.count + dashFinal.count}
                  </div>
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

              {ENABLE_EMAIL && <div className="card">Email section...</div>}

              <InsightStrip items={executiveInsights} />

              <AxisRiskTable
                title={lang === "ar" ? "خريطة المخاطر التنفيذية للمحاور" : "Executive axis risk map"}
                items={executiveAxisStats}
              />

              <ActionList
                title={lang === "ar" ? "أولويات التدخل والتطوير" : "Priority actions"}
                items={executiveAxisStats}
              />

              <div className="card">
                <h3 style={{ fontSize: "18px", fontWeight: 900, marginBottom: "16px" }}>
                  {lang === "ar" ? "🏫 ترتيب القاعات" : "🏫 Room ranking"}
                </h3>

                {dashRoomData.map((r, i) => (
                  <div key={r.id} style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "14px" }}>
                      <span>{(lang === "ar" ? "قاعة" : "Room") + " " + r.code} ({r.trainer})</span>
                      <span style={{ color: i === 0 ? "#10b981" : "#334155", fontWeight: 900, direction: "ltr", unicodeBidi: "plaintext" }}>
                        {r.avg.toFixed(2)}
                      </span>
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
                <h3 style={{ fontSize: "18px", fontWeight: 900, marginBottom: "16px" }}>
                  {lang === "ar" ? "📊 أداء المحاور" : "📊 Axes performance"}
                </h3>

                {daily.axes.map((a, i) => {
                  const s = statusOf(a.value);
                  return (
                    <div key={i} style={{ marginBottom: "16px", padding: "16px", background: "#f8fafc", borderRadius: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{ fontWeight: 900 }}>{a.label}</span>
                        <span style={{ background: s.bg, color: s.fg, padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 900 }}>
                          {s.t}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ flex: 1, height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{ width: `${(a.value / 5) * 100}%`, height: "100%", background: BLUE }} />
                        </div>
                        <b style={{ minWidth: "72px", textAlign: "left", direction: "ltr", unicodeBidi: "plaintext" }}>
                          {a.value.toFixed(2)}/5
                        </b>
                      </div>
                    </div>
                  );
                })}

                {daily.axes.length === 0 && <p style={{ color: "#94a3b8", textAlign: "center" }}>{t.noData}</p>}
              </div>

              <InsightStrip items={dailyInsights} />

              <AxisRiskTable
                title={lang === "ar" ? "خريطة المخاطر للمحاور" : "Axis risk map"}
                items={dailyAxisStats}
              />

              <ActionList
                title={lang === "ar" ? "التوصيات التنفيذية" : "Action recommendations"}
                items={dailyAxisStats}
              />
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
                <h3 style={{ fontSize: "18px", fontWeight: 900, marginBottom: "16px" }}>
                  {lang === "ar" ? "📊 أداء المحاور" : "📊 Axes performance"}
                </h3>

                {final.axes.map((a, i) => {
                  const s = statusOf(a.value);
                  return (
                    <div key={i} style={{ marginBottom: "16px", padding: "16px", background: "#f8fafc", borderRadius: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{ fontWeight: 900 }}>{a.label}</span>
                        <span style={{ background: s.bg, color: s.fg, padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 900 }}>
                          {s.t}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ flex: 1, height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{ width: `${(a.value / 5) * 100}%`, height: "100%", background: TEAL }} />
                        </div>
                        <b style={{ minWidth: "72px", textAlign: "left", direction: "ltr", unicodeBidi: "plaintext" }}>
                          {a.value.toFixed(2)}/5
                        </b>
                      </div>
                    </div>
                  );
                })}

                {final.axes.length === 0 && <p style={{ color: "#94a3b8", textAlign: "center" }}>{t.noData}</p>}
              </div>

              <InsightStrip items={finalInsights} />

              <AxisRiskTable
                title={lang === "ar" ? "خريطة المخاطر للمحاور" : "Axis risk map"}
                items={finalAxisStats}
              />

              <ActionList
                title={lang === "ar" ? "التوصيات التنفيذية" : "Action recommendations"}
                items={finalAxisStats}
              />
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
                  <button className="btn2" onClick={() => setRevealPII((v) => !v)}>
                    🔒 {revealPII ? t.hide : t.reveal}
                  </button>

                  <button
                    className="btn2"
                    onClick={() => {
                      const flat = [];
                      for (const r of partRoomData) {
                        for (const s of r.students) {
                          flat.push([r.code, r.trainer, s.name, s.phone, s.email]);
                        }
                      }
                      downloadCSV("participants.csv", [[t.room, t.trainer, t.name, t.phone, t.email], ...flat]);
                    }}
                  >
                    ⬇️ {t.export}
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
                    <span
                      style={{
                        background: "#dbeafe",
                        color: "#1d4ed8",
                        padding: "4px 12px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 900,
                        marginInlineStart: "auto"
                      }}
                    >
                      {r.students.length} {lang === "ar" ? "مشارك" : "participants"}
                    </span>
                  </div>

                  <table className="tbl">
                    <thead>
                      <tr>
                        <th className="th">{t.name}</th>
                        <th className="th">{t.phone}</th>
                        <th className="th">{t.email}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.students.map((s, i) => (
                        <tr key={i}>
                          <td className="td">{s.name || "—"}</td>
                          <td className="td" style={{ direction: "ltr", unicodeBidi: "plaintext" }}>
                            {revealPII ? s.phone || "—" : maskPhone(s.phone)}
                          </td>
                          <td className="td" style={{ direction: "ltr", unicodeBidi: "plaintext", color: "#2563eb" }}>
                            {revealPII ? s.email || "—" : maskEmail(s.email)}
                          </td>
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
                <p style={{ color: "#64748b", margin: 0 }}>
                  {lang === "ar" ? "اختر فترة ومعايير ثم اطبع الشهادة." : "Choose range and criteria, then print."}
                </p>
              </div>

              <FiltersBar value={certF} setValue={setCertF} count={certAllRows.length} withMin />

              {certBest ? (
                <div className="card" style={{ textAlign: "center", padding: "40px", background: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "4px solid #d97706" }}>
                  <h1 style={{ fontSize: "36px", fontWeight: 900, color: "#d97706", marginBottom: "8px" }}>
                    {lang === "ar" ? "شهادة تميز وإشادة" : "Certificate of Excellence"}
                  </h1>

                  <p style={{ color: "#64748b", marginBottom: "24px" }}>
                    {lang === "ar" ? "يمنح هذا التكريم لأفضل مدرب" : "This award is granted to the best trainer"}
                  </p>

                  <h2 style={{ fontSize: "48px", fontWeight: 900, color: "#10b981", marginBottom: "16px" }}>
                    {certBest.trainer}
                  </h2>

                  <p style={{ fontSize: "20px", color: "#334155" }}>
                    {lang === "ar" ? "قاعة" : "Room"} <b style={{ color: "#2563eb" }}>{certBest.code}</b> —{" "}
                    {lang === "ar" ? "معدل" : "Average"}:{" "}
                    <b style={{ color: "#d97706", direction: "ltr", unicodeBidi: "plaintext" }}>
                      {certBest.avg.toFixed(2)}/5
                    </b>{" "}
                    ({lang === "ar" ? "استجابات" : "responses"}: {certBest.cnt})
                  </p>

                  <button onClick={() => window.print()} className="btn noprint" style={{ marginTop: 24 }}>
                    🖨️ {t.print}
                  </button>
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
    </div>
  );
}
