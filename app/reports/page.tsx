// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

/* =========================================================
   1) Helpers — Filtering & Stats
   ========================================================= */
function safeRating(v) { const n = Number(v); return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null; }
function mean(xs) { return xs?.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function median(xs) {
  if (!xs?.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function variance(xs) {
  if (!xs || xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
}
function stdDev(xs) { return Math.sqrt(variance(xs)); }
function normTxt(v) { return String(v || "").trim().toLowerCase().replace(/\s+/g, " "); }
function dateKey(d) {
  const x = new Date(d);
  if (isNaN(x.getTime())) return "";
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

function filterRowsBy(baseRows, classrooms, fixedKind, f) {
  const fromD = f?.from ? new Date(f.from) : null;
  const toD = f?.to ? new Date(f.to) : null;
  if (toD) toD.setHours(23, 59, 59, 999);
  const trainerRooms =
    f?.trainerId && f.trainerId !== "ALL"
      ? new Set((classrooms || []).filter((c) => c.trainer_id === f.trainerId).map((c) => c.id))
      : null;
  return (baseRows || []).filter((r) => {
    if (!r) return false;
    if (fixedKind && r.kind !== fixedKind) return false;
    if (f?.classroomId && f.classroomId !== "ALL") { if (r.classroom_id !== f.classroomId) return false; }
    else if (trainerRooms && !trainerRooms.has(r.classroom_id)) return false;
    if ((fromD || toD) && r.submitted_at) {
      const d = new Date(r.submitted_at);
      if (fromD && d < fromD) return false;
      if (toD && d > toD) return false;
    }
    return true;
  });
}

/* يمنع تضخيم التحليل من الأسئلة المكررة نصيًا داخل نفس الاستبانة */
function collapseDuplicateAnswers(answers, questions) {
  const qMap = new Map((questions || []).map((q) => [q.id, q]));
  const buckets = new Map();
  for (const a of answers || []) {
    const v = safeRating(a?.rating_value);
    if (v === null) continue;
    const q = qMap.get(a.question_id);
    const key = `${a.evaluation_id}__${normTxt(q?.section_ar)}__${normTxt(q?.text_ar || q?.text_en || a.question_id)}`;
    const b = buckets.get(key) || { evaluation_id: a.evaluation_id, question_id: a.question_id, question: q, values: [] };
    b.values.push(v);
    buckets.set(key, b);
  }
  return Array.from(buckets.values()).map((b) => ({
    evaluation_id: b.evaluation_id, question_id: b.question_id, question: b.question, rating_value: mean(b.values)
  }));
}
function answersFor(cleanAnswers, idsSet) { return (cleanAnswers || []).filter((a) => idsSet.has(a.evaluation_id)); }

function buildStats(values, respondents = 0) {
  const xs = (values || []).filter((v) => safeRating(v) !== null);
  const dist = [0, 0, 0, 0, 0];
  xs.forEach((v) => { const r = Math.round(v); if (r >= 1 && r <= 5) dist[r - 1] += 1; });
  const low = xs.filter((v) => v <= 2).length;
  const mid = xs.filter((v) => v > 2 && v < 4).length;
  const high = xs.filter((v) => v >= 4).length;
  return {
    measurements: xs.length, respondents,
    mean: mean(xs), median: median(xs), variance: variance(xs), stddev: stdDev(xs),
    lowPct: xs.length ? (low / xs.length) * 100 : 0,
    neutralPct: xs.length ? (mid / xs.length) * 100 : 0,
    highPct: xs.length ? (high / xs.length) * 100 : 0,
    lowCount: low, neutralCount: mid, highCount: high, dist
  };
}

function riskLevel(s, lang) {
  const n = s?.respondents || 0, m = s?.mean || 0, sd = s?.stddev || 0, low = s?.lowPct || 0;
  if (n < 5) return { key: "NA", score: 0, label: lang === "ar" ? "بيانات غير كافية" : "Insufficient", bg: "#f1f5f9", fg: "#64748b" };
  if (m < 3 || low >= 20 || sd >= 1.2) return { key: "HIGH", score: 3, label: lang === "ar" ? "منطقة قلق" : "High risk", bg: "#fee2e2", fg: "#b91c1c" };
  if (m < 3.7 || low >= 10 || sd >= 1) return { key: "MED", score: 2, label: lang === "ar" ? "تحتاج مراقبة" : "Watch", bg: "#fef3c7", fg: "#b45309" };
  return { key: "LOW", score: 1, label: lang === "ar" ? "مطمئن" : "Good", bg: "#d1fae5", fg: "#047857" };
}

function summaryFrom(cleanAnswers, lang) {
  const xs = (cleanAnswers || []).map((a) => safeRating(a.rating_value)).filter((v) => v !== null);
  const resp = new Set((cleanAnswers || []).map((a) => a.evaluation_id)).size;
  const s = buildStats(xs, resp);
  return { ...s, risk: riskLevel(s, lang) };
}

/* =========================================================
   2) Axes analytics + Recommendations
   ========================================================= */
function axisCategory(ar = "", en = "") {
  const s = `${ar} ${en}`.toLowerCase();
  if (s.includes("مدرب") || s.includes("معلم") || s.includes("teacher") || s.includes("trainer")) return "trainer";
  if (s.includes("تعليم") || s.includes("تعلم") || s.includes("مادة") || s.includes("محتوى") || s.includes("درس") || s.includes("حصة") || s.includes("learning") || s.includes("content")) return "education";
  if (s.includes("قاعة") || s.includes("تجهيز") || s.includes("facility") || s.includes("room")) return "facility";
  if (s.includes("وصول") || s.includes("استقبال") || s.includes("airport") || s.includes("arrival") || s.includes("reception")) return "arrival";
  if (s.includes("ضيافة") || s.includes("خدمات") || s.includes("hospitality") || s.includes("service")) return "hospitality";
  if (s.includes("نقل") || s.includes("انتقال") || s.includes("مواصلات") || s.includes("transport")) return "transport";
  if (s.includes("سكن") || s.includes("housing") || s.includes("accommodation")) return "housing";
  if (s.includes("جولات") || s.includes("زيارة") || s.includes("tour") || s.includes("visit")) return "tours";
  if (s.includes("عمرة") || s.includes("umrah")) return "umrah";
  if (s.includes("إدارة") || s.includes("برنامج") || s.includes("استجابة") || s.includes("admin") || s.includes("management")) return "administration";
  if (s.includes("رضا") || s.includes("satisfaction")) return "satisfaction";
  return "general";
}

const RECS = {
  trainer: { ar: "رفع التفاعل داخل القاعة، استخدام أمثلة تطبيقية، تخصيص وقت للأسئلة، وتلخيص أهم النقاط في نهاية الحصة.", en: "Increase engagement, use practical examples, reserve Q&A time, and summarize key points." },
  education: { ar: "مراجعة وضوح المحتوى وملاءمته للمستوى، إضافة أنشطة تطبيقية قصيرة، وربط المحتوى بمخرجات التعلم.", en: "Review content clarity and level fit, add short activities, align with learning outcomes." },
  facility: { ar: "فحص الصوت والعرض والإنترنت قبل الجلسة، وتفعيل قناة سريعة للإبلاغ عن الأعطال ومعالجتها.", en: "Pre-check AV/internet before sessions; activate a fast issue-reporting channel." },
  arrival: { ar: "تأكيد ترتيبات الوصول قبل 24 ساعة، إرسال تعليمات موحدة، تحديد مسؤول ميداني، وتوفير رقم دعم فوري.", en: "Confirm arrivals 24h ahead, send unified instructions, assign a field coordinator, provide live support." },
  hospitality: { ar: "توحيد معايير الضيافة، تقليل وقت الانتظار، ومتابعة جودة الخدمة بقياس يومي للملاحظات.", en: "Standardize hospitality, reduce waiting time, and monitor service quality daily." },
  transport: { ar: "تثبيت جدول النقل، توضيح نقاط التجمع، إرسال تنبيهات قبل الرحلات، وتوفير دعم عند التأخر.", en: "Stabilize transport schedule, clarify meeting points, send reminders, support delays." },
  housing: { ar: "فحص دوري للنظافة والراحة، تفعيل قناة بلاغات، وقياس سرعة الاستجابة للملاحظات.", en: "Regular cleanliness/comfort checks, reporting channel, measure response time." },
  tours: { ar: "تحسين تنظيم الجولات وضبط الوقت ونقاط التجمع، وقياس رضا كل نشاط بشكل مستقل.", en: "Improve tour organization and timing; measure satisfaction per activity." },
  umrah: { ar: "توضيح خطة العمرة والخدمات المصاحبة، رفع الإرشاد الميداني، وتفعيل دعم فوري للمشاركين.", en: "Clarify Umrah plan/services, enhance field guidance, activate immediate support." },
  administration: { ar: "تحسين وضوح التعليمات، توحيد قنوات التواصل، تحديد مسؤول خدمة واضح، ومتابعة الملاحظات حتى الإغلاق.", en: "Clarify instructions, unify communication, assign service owner, track issues to closure." },
  satisfaction: { ar: "تحليل مسببات الرضا/عدم الرضا عبر المحاور الأخرى ومعالجة الأعلى أثرًا أولًا.", en: "Analyze satisfaction drivers across other axes and act on the highest impact first." },
  general: { ar: "تنفيذ تحسينات سريعة ثم إعادة القياس خلال أسبوعين للتحقق من الأثر.", en: "Apply quick fixes and re-measure within two weeks." }
};

function recFor(ar, en, riskKey, lang) {
  if (riskKey === "NA") return lang === "ar" ? "العينة صغيرة؛ يفضّل زيادة الاستجابات قبل اتخاذ قرار." : "Small sample; collect more responses first.";
  if (riskKey === "LOW") return lang === "ar" ? "نقطة قوة: المحافظة على الممارسة الحالية وتوثيقها كنموذج." : "Strength: maintain and document as best practice.";
  const c = axisCategory(ar, en);
  return RECS[c]?.[lang] || RECS.general[lang];
}

function buildAxisStats(cleanAnswers, lang) {
  const groups = new Map();
  for (const a of cleanAnswers || []) {
    const v = safeRating(a.rating_value);
    if (v === null) continue;
    const q = a.question || {};
    const ar = q.section_ar || "عام";
    const en = q.section_en || ar || "General";
    const key = `${ar}__${en}`;
    const g = groups.get(key) || { ar, en, values: [], resp: new Set() };
    g.values.push(v);
    g.resp.add(a.evaluation_id);
    groups.set(key, g);
  }
  const out = [];
  for (const g of groups.values()) {
    const s = buildStats(g.values, g.resp.size);
    const risk = riskLevel(s, lang);
    out.push({
      axisAr: g.ar, axisEn: g.en, axisLabel: lang === "ar" ? g.ar : g.en,
      ...s, risk, recommendation: recFor(g.ar, g.en, risk.key, lang)
    });
  }
  return out.sort((a, b) => b.risk.score - a.risk.score || b.lowPct - a.lowPct || a.mean - b.mean);
}

function buildTrend(rows, lang) {
  const valid = (rows || [])
    .filter((r) => r?.submitted_at && safeRating(r?.overall_rating) !== null)
    .map((r) => ({ ...r, d: new Date(r.submitted_at) }))
    .filter((r) => !isNaN(r.d.getTime()));
  if (!valid.length) return [];
  const latest = new Date(Math.max(...valid.map((r) => r.d.getTime())));
  latest.setHours(0, 0, 0, 0);
  const map = new Map();
  for (let i = 6; i >= 0; i--) {
    const day = new Date(latest); day.setDate(latest.getDate() - i);
    map.set(dateKey(day), { date: day, values: [] });
  }
  valid.forEach((r) => { const b = map.get(dateKey(r.d)); if (b) b.values.push(Number(r.overall_rating)); });
  const locale = lang === "ar" ? "ar-SA" : "en-US";
  return Array.from(map.values()).map((x) => ({
    label: new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric" }).format(x.date),
    count: x.values.length,
    avg: x.values.length ? mean(x.values) : null
  }));
}

function buildRoomRanking(cleanAnswers, rows, classrooms, trainers) {
  const evalRoom = new Map((rows || []).map((r) => [r.id, r.classroom_id]));
  const evalVals = new Map();
  for (const a of cleanAnswers || []) {
    const v = safeRating(a.rating_value);
    if (v === null) continue;
    const arr = evalVals.get(a.evaluation_id) || [];
    arr.push(v); evalVals.set(a.evaluation_id, arr);
  }
  const roomAgg = new Map();
  for (const [eid, vals] of evalVals.entries()) {
    const rid = evalRoom.get(eid);
    if (!rid) continue;
    const cur = roomAgg.get(rid) || { sum: 0, cnt: 0 };
    cur.sum += mean(vals); cur.cnt += 1;
    roomAgg.set(rid, cur);
  }
  const out = [];
  for (const c of classrooms || []) {
    const st = roomAgg.get(c.id);
    if (!st?.cnt) continue;
    const tr = (trainers || []).find((t) => t.id === c.trainer_id);
    out.push({ id: c.id, code: c.code || "—", trainer: tr?.name || "—", avg: st.sum / st.cnt, count: st.cnt });
  }
  return out.sort((a, b) => b.avg - a.avg);
}

function buildHeatMap(cleanAnswers, rows, classrooms, lang) {
  const evalRoom = new Map((rows || []).map((r) => [r.id, r.classroom_id]));
  const groups = new Map();
  const usedRooms = new Set();
  for (const a of cleanAnswers || []) {
    const v = safeRating(a.rating_value);
    const rid = evalRoom.get(a.evaluation_id);
    if (v === null || !rid) continue;
    const q = a.question || {};
    const ar = q.section_ar || "عام", en = q.section_en || ar || "General";
    const key = `${ar}__${en}`;
    const g = groups.get(key) || { ar, en, rooms: new Map() };
    const arr = g.rooms.get(rid) || [];
    arr.push(v); g.rooms.set(rid, arr);
    groups.set(key, g); usedRooms.add(rid);
  }
  const rooms = (classrooms || []).filter((c) => usedRooms.has(c.id))
    .sort((a, b) => String(a.code).localeCompare(String(b.code))).slice(0, 8);
  const axes = Array.from(groups.values()).map((g) => {
    const all = []; g.rooms.forEach((vs) => all.push(...vs));
    return {
      axisLabel: lang === "ar" ? g.ar : g.en, overall: mean(all),
      cells: rooms.map((r) => { const vs = g.rooms.get(r.id) || []; return { roomId: r.id, avg: vs.length ? mean(vs) : null, count: vs.length }; })
    };
  }).sort((a, b) => a.overall - b.overall).slice(0, 10);
  return { rooms, axes };
}
function heatColor(avg, count) {
  if (!count || avg === null) return { bg: "#f8fafc", fg: "#94a3b8" };
  if (avg < 3) return { bg: "#fee2e2", fg: "#b91c1c" };
  if (avg < 3.7) return { bg: "#fef3c7", fg: "#b45309" };
  if (avg < 4.2) return { bg: "#dcfce7", fg: "#15803d" };
  return { bg: "#bbf7d0", fg: "#166534" };
}

function maskEmail(email) { if (!email || !email.includes("@")) return "—"; const [u, d] = email.split("@"); return `${u.slice(0, 2)}***@${d}`; }
function maskPhone(p) { if (!p) return "—"; const c = String(p).replace(/\s+/g, ""); if (c.length < 6) return "***"; return c.replace(/(\d{2})\d+(\d{2})/, "$1******$2"); }
function downloadCSV(filename, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* =========================================================
   3) Identity & i18n
   ========================================================= */
const TEAL = "#0d9488", TEAL_DARK = "#0f766e", BLUE = "#2563eb", NAVY = "#173a5e", GOLD = "#c19a3d", RED = "#dc2626", ORANGE = "#d97706";

const dict = {
  ar: {
    dir: "rtl", font: "'Tajawal', sans-serif",
    title: "لوحة ذكاء الأعمال", sub: "النظام المركزي للتحليلات",
    tab1: "الملخص التنفيذي", tab2: "التقرير اليومي", tab3: "التقرير النهائي", tab4: "سجل المشاركين", tab5: "شهادة التميز",
    lang: "English", noData: "لا توجد بيانات ضمن الفلاتر الحالية.",
    filters: "الفلاتر", allTrainers: "كل المدربين", allRooms: "كل القاعات", reset: "إعادة تعيين",
    search: "بحث (اسم/بريد/جوال)", reveal: "إظهار البيانات", hide: "إخفاء البيانات",
    export: "تصدير CSV", print: "طباعة", minResponses: "حد أدنى للاستجابات", sample: "عدد الاستبانات",
    clear: "إفراغ", purge: "حذف الاستجابات",
    executiveHint: "قراءة تحليلية لمؤشرات الجودة والرضا ومناطق القلق والتوصيات.",
    dailyHint: "تحليل إحصائي لأداء الحصص والمدربين والتجربة اليومية.",
    finalHint: "تحليل رضا المشاركين عن التعليم والخدمات وإدارة البرنامج.",
    participantsHint: "فلترة حسب القاعة + المدرب + الفترة، مع بحث وتصدير."
  },
  en: {
    dir: "ltr", font: "'Inter', sans-serif",
    title: "BI Dashboard", sub: "Central Analytics",
    tab1: "Executive Summary", tab2: "Daily Report", tab3: "Final Report", tab4: "Participants", tab5: "Certificate",
    lang: "العربية", noData: "No data for current filters.",
    filters: "Filters", allTrainers: "All trainers", allRooms: "All rooms", reset: "Reset",
    search: "Search (name/email/phone)", reveal: "Show data", hide: "Hide data",
    export: "Export CSV", print: "Print", minResponses: "Min responses", sample: "Forms",
    clear: "Clear", purge: "Delete Responses",
    executiveHint: "Analytical view of quality, satisfaction, risk areas and recommendations.",
    dailyHint: "Statistical analysis of sessions, trainers, and daily experience.",
    finalHint: "Satisfaction analysis for education, services, and program management.",
    participantsHint: "Filter by room + trainer + date range, with search and export."
  }
};

/* =========================================================
   4) Components
   ========================================================= */
function GaugeChart({ score, color }) {
  const v = Number(score || 0);
  const pct = Math.max(0, Math.min(100, (v / 5) * 100));
  const r = 55, C = Math.PI * r;
  return (
    <div style={{ textAlign: "center", position: "relative", height: 85, width: 150, margin: "0 auto" }}>
      <svg width="150" height="85" viewBox="0 0 150 85">
        <path d="M 15 75 A 55 55 0 0 1 135 75" fill="none" stroke="#f1f5f9" strokeWidth="16" strokeLinecap="round" />
        <path d="M 15 75 A 55 55 0 0 1 135 75" fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C - (pct / 100) * C} style={{ transition: "stroke-dashoffset 1.2s" }} />
      </svg>
      <div style={{ position: "absolute", bottom: -5, left: 0, right: 0, fontSize: 28, fontWeight: 900, direction: "ltr" }}>{v ? v.toFixed(2) : "0.00"}</div>
    </div>
  );
}

function MetricCard({ title, value, sub, color = BLUE, icon = "📊" }) {
  return (
    <div className="mcard" style={{ borderBottomColor: color }}>
      <div className="mtop"><span>{icon}</span><span className="mtitle">{title}</span></div>
      <div className="mval">{value}</div>
      {sub && <div className="msub">{sub}</div>}
    </div>
  );
}

function DistributionChart({ stats, lang }) {
  const isAr = lang === "ar";
  const total = stats?.measurements || 0;
  const items = [
    { label: isAr ? "منخفض 1–2" : "Low 1–2", value: stats?.lowCount || 0, pct: stats?.lowPct || 0, color: "#ef4444" },
    { label: isAr ? "محايد 3" : "Neutral 3", value: stats?.neutralCount || 0, pct: stats?.neutralPct || 0, color: "#f59e0b" },
    { label: isAr ? "مرتفع 4–5" : "High 4–5", value: stats?.highCount || 0, pct: stats?.highPct || 0, color: "#10b981" }
  ];
  if (!total) return <div className="empty">{isAr ? "لا توجد استجابات لعرض التوزيع." : "No responses."}</div>;
  return (
    <div>
      <div className="dbar">
        {items.map((it) => (<div key={it.label} style={{ width: `${it.pct}%`, background: it.color, minWidth: it.pct > 0 ? 4 : 0 }} title={`${it.label}: ${it.pct.toFixed(1)}%`} />))}
      </div>
      <div className="dlist">
        {items.map((it) => (
          <div className="ditem" key={it.label}>
            <span style={{ width: 12, height: 12, borderRadius: 999, background: it.color, display: "inline-block" }} />
            <span>{it.label}</span>
            <b style={{ marginInlineStart: "auto", direction: "ltr" }}>{it.value} ({it.pct.toFixed(0)}%)</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ data, lang, color = BLUE }) {
  const isAr = lang === "ar";
  if (!data?.some((d) => d.count > 0)) return <div className="empty">{isAr ? "لا توجد بيانات كافية للاتجاه الزمني." : "Not enough trend data."}</div>;
  const W = 680, H = 260, PX = 42, PT = 24, PB = 42;
  const cw = W - PX * 2, ch = H - PT - PB;
  const pts = data.map((d, i) => {
    const x = PX + (i * cw) / Math.max(data.length - 1, 1);
    const y = d.avg === null ? null : PT + (1 - d.avg / 5) * ch;
    return { ...d, x, y };
  }).filter((p) => p.y !== null);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 560, height: "auto" }}>
        {[1, 2, 3, 4, 5].map((v) => {
          const y = PT + (1 - v / 5) * ch;
          return (<g key={v}><line x1={PX} x2={W - PX} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" /><text x="12" y={y + 4} fill="#64748b" fontSize="12">{v}</text></g>);
        })}
        <path d={path} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="6" fill="#fff" stroke={color} strokeWidth="4" />
            <text x={p.x} y={p.y - 14} textAnchor="middle" fill="#0f172a" fontSize="12" fontWeight="800">{p.avg.toFixed(2)}</text>
            <text x={p.x} y={H - 16} textAnchor="middle" fill="#64748b" fontSize="11">{p.label}</text>
            <text x={p.x} y={H - 2} textAnchor="middle" fill="#94a3b8" fontSize="10">N={p.count}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function RiskTable({ title, items, lang }) {
  const isAr = lang === "ar";
  if (!items?.length) return (<div className="card"><h3 className="ctitle">{title}</h3><div className="empty">{isAr ? "لا توجد بيانات للمحاور." : "No axis data."}</div></div>);
  return (
    <div className="card">
      <h3 className="ctitle">{title}</h3>
      <p className="cdesc">{isAr ? "مرتّبة من الأعلى خطورة إلى الأكثر استقرارًا." : "Sorted from highest risk to most stable."}</p>
      <div className="twrap">
        <table className="tbl">
          <thead>
            <tr>
              <th className="th">{isAr ? "المحور" : "Axis"}</th>
              <th className="th">N</th>
              <th className="th">{isAr ? "المتوسط" : "Mean"}</th>
              <th className="th">{isAr ? "الوسيط" : "Median"}</th>
              <th className="th">{isAr ? "التباين" : "Var"}</th>
              <th className="th">{isAr ? "الانحراف" : "SD"}</th>
              <th className="th">{isAr ? "منخفض" : "Low"}</th>
              <th className="th">{isAr ? "مرتفع" : "High"}</th>
              <th className="th">{isAr ? "الحالة" : "Risk"}</th>
              <th className="th">{isAr ? "التوصية" : "Recommendation"}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x, i) => (
              <tr key={i}>
                <td className="td" style={{ fontWeight: 900, minWidth: 140 }}>{x.axisLabel}</td>
                <td className="td ltr">{x.respondents}</td>
                <td className="td ltr">{x.mean.toFixed(2)}</td>
                <td className="td ltr">{x.median.toFixed(2)}</td>
                <td className="td ltr">{x.variance.toFixed(2)}</td>
                <td className="td ltr">{x.stddev.toFixed(2)}</td>
                <td className="td ltr">{x.lowPct.toFixed(0)}%</td>
                <td className="td ltr">{x.highPct.toFixed(0)}%</td>
                <td className="td"><span className="rbadge" style={{ background: x.risk.bg, color: x.risk.fg }}>{x.risk.label}</span></td>
                <td className="td" style={{ minWidth: 280, color: "#475569", lineHeight: 1.7 }}>{x.recommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InsightsPanel({ items, summary, lang }) {
  const isAr = lang === "ar";
  const concerns = (items || []).filter((x) => x.risk.key === "HIGH" || x.risk.key === "MED").slice(0, 3);
  const strengths = (items || []).filter((x) => x.risk.key === "LOW").slice(0, 3);
  return (
    <div className="card">
      <h3 className="ctitle">{isAr ? "🧠 القراءة التنفيذية والتوصيات" : "🧠 Executive Insights"}</h3>
      <div className="igrid">
        <div className="ibox danger">
          <h4>{isAr ? "مناطق تحتاج تدخلًا" : "Areas requiring action"}</h4>
          {concerns.length ? concerns.map((x, i) => (
            <div className="irow" key={i}>
              <b>{x.axisLabel}</b>
              <span>{isAr ? `متوسط ${x.mean.toFixed(2)}/5، منخفض ${x.lowPct.toFixed(0)}%، انحراف ${x.stddev.toFixed(2)}` : `Mean ${x.mean.toFixed(2)}/5, low ${x.lowPct.toFixed(0)}%, SD ${x.stddev.toFixed(2)}`}</span>
              <small>{x.recommendation}</small>
            </div>
          )) : <p>{isAr ? "لا توجد منطقة قلق واضحة حاليًا." : "No clear risk area."}</p>}
        </div>
        <div className="ibox success">
          <h4>{isAr ? "نقاط القوة" : "Strengths"}</h4>
          {strengths.length ? strengths.map((x, i) => (
            <div className="irow" key={i}>
              <b>{x.axisLabel}</b>
              <span>{isAr ? `متوسط ${x.mean.toFixed(2)}/5، رضا مرتفع ${x.highPct.toFixed(0)}%` : `Mean ${x.mean.toFixed(2)}/5, high ${x.highPct.toFixed(0)}%`}</span>
              <small>{x.recommendation}</small>
            </div>
          )) : <p>{isAr ? "لا توجد بيانات كافية لتحديد نقاط القوة." : "Insufficient data."}</p>}
        </div>
      </div>
      <div className="cnote">
        <b>{isAr ? "ملاحظة جودة البيانات: " : "Data note: "}</b>
        {summary.respondents < 5
          ? (isAr ? "حجم العينة منخفض؛ النتائج إشارة أولية فقط." : "Small sample; treat as early indication.")
          : (isAr ? `التحليل مبني على ${summary.respondents} استبانة و ${summary.measurements} قياسًا رقميًا.` : `Based on ${summary.respondents} forms and ${summary.measurements} measurements.`)}
      </div>
    </div>
  );
}

function HeatMap({ data, lang }) {
  const isAr = lang === "ar";
  if (!data?.axes?.length || !data?.rooms?.length) {
    return (<div className="card"><h3 className="ctitle">{isAr ? "🗺️ الخريطة الحرارية (محاور × قاعات)" : "🗺️ Heat Map (Axes × Rooms)"}</h3><div className="empty">{isAr ? "لا توجد بيانات كافية." : "Not enough data."}</div></div>);
  }
  return (
    <div className="card">
      <h3 className="ctitle">{isAr ? "🗺️ الخريطة الحرارية (محاور × قاعات)" : "🗺️ Heat Map (Axes × Rooms)"}</h3>
      <p className="cdesc">{isAr ? "الأحمر منخفض، الأصفر يحتاج متابعة، الأخضر أداء جيد." : "Red low, yellow watch, green good."}</p>
      <div className="twrap">
        <table className="heat">
          <thead>
            <tr>
              <th>{isAr ? "المحور" : "Axis"}</th>
              {data.rooms.map((r) => (<th key={r.id}>{isAr ? "قاعة" : "Room"} {r.code}</th>))}
            </tr>
          </thead>
          <tbody>
            {data.axes.map((ax) => (
              <tr key={ax.axisLabel}>
                <td className="haxis">{ax.axisLabel}</td>
                {ax.cells.map((c) => {
                  const st = heatColor(c.avg, c.count);
                  return (<td key={c.roomId}><span className="hcell" style={{ background: st.bg, color: st.fg }}>{c.count ? c.avg.toFixed(2) : "—"}</span></td>);
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================
   5) Main Page
   ========================================================= */
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

  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeKind, setPurgeKind] = useState("BOTH");
  const [purgeCode, setPurgeCode] = useState("");
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState("");
  const [codeError, setCodeError] = useState(false);

  const t = dict[lang];
  const isAr = lang === "ar";
  const db = supabase();

  const fetchAllData = async () => {
    const [e, a, q, c, tr] = await Promise.all([
      db.from("evaluations").select("*").order("submitted_at", { ascending: false }),
      db.from("evaluation_answers").select("*"),
      db.from("questions").select("*"),
      db.from("classrooms").select("*"),
      db.from("trainers").select("*")
    ]);
    setRows(e.data || []); setAns(a.data || []); setQs(q.data || []);
    setClassrooms(c.data || []); setTrainers(tr.data || []);
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

  const executePurge = async () => {
    if (purgeCode !== "9999") { setCodeError(true); setTimeout(() => setCodeError(false), 500); return; }
    setPurgeBusy(true); setPurgeMsg("");
    try {
      const s = await db.auth.getSession();
      const token = s.data?.session?.access_token;
      if (!token) throw new Error(isAr ? "لا توجد جلسة" : "No session");
      const res = await fetch("/api/admin/purge-evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ confirmCode: purgeCode, kind: purgeKind, filters: partF })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed");
      setPurgeMsg("success:" + (isAr
        ? `تم الحذف النهائي: ${json.deleted.evaluations} استبانة و ${json.deleted.answers} إجابة.`
        : `Deleted: ${json.deleted.evaluations} evaluations, ${json.deleted.answers} answers.`));
      await fetchAllData();
    } catch (e) {
      setPurgeMsg("error:" + ((isAr ? "خطأ: " : "Error: ") + (e.message || "Unknown")));
    } finally { setPurgeBusy(false); }
  };
  const closePurgeModal = () => { setPurgeOpen(false); setPurgeCode(""); setPurgeMsg(""); setCodeError(false); };

  /* ===== Clean answers (anti-duplicate) ===== */
  const cleanAnswers = useMemo(() => collapseDuplicateAnswers(ans, qs), [ans, qs]);

  /* ===== Dashboard ===== */
  const dashRows = useMemo(() => filterRowsBy(rows, classrooms, null, dashF), [rows, classrooms, dashF]);
  const dashIds = useMemo(() => new Set(dashRows.map((r) => r.id)), [dashRows]);
  const dashAns = useMemo(() => answersFor(cleanAnswers, dashIds), [cleanAnswers, dashIds]);
  const dashDailyRows = useMemo(() => dashRows.filter((r) => r.kind === "DAILY"), [dashRows]);
  const dashFinalRows = useMemo(() => dashRows.filter((r) => r.kind === "FINAL"), [dashRows]);
  const dashDailyIds = useMemo(() => new Set(dashDailyRows.map((r) => r.id)), [dashDailyRows]);
  const dashFinalIds = useMemo(() => new Set(dashFinalRows.map((r) => r.id)), [dashFinalRows]);
  const dashDailySummary = useMemo(() => summaryFrom(answersFor(cleanAnswers, dashDailyIds), lang), [cleanAnswers, dashDailyIds, lang]);
  const dashFinalSummary = useMemo(() => summaryFrom(answersFor(cleanAnswers, dashFinalIds), lang), [cleanAnswers, dashFinalIds, lang]);
  const dashSummary = useMemo(() => summaryFrom(dashAns, lang), [dashAns, lang]);
  const dashAxis = useMemo(() => buildAxisStats(dashAns, lang), [dashAns, lang]);
  const dashTrend = useMemo(() => buildTrend(dashRows, lang), [dashRows, lang]);
  const dashRanking = useMemo(() => buildRoomRanking(dashAns, dashRows, classrooms, trainers), [dashAns, dashRows, classrooms, trainers]);
  const dashHeat = useMemo(() => buildHeatMap(dashAns, dashRows, classrooms, lang), [dashAns, dashRows, classrooms, lang]);
  const dashHighRisk = useMemo(() => dashAxis.filter((x) => x.risk.key === "HIGH").length, [dashAxis]);

  /* ===== Daily ===== */
  const dailyRows = useMemo(() => filterRowsBy(rows, classrooms, "DAILY", dailyF), [rows, classrooms, dailyF]);
  const dailyIds = useMemo(() => new Set(dailyRows.map((r) => r.id)), [dailyRows]);
  const dailyAns = useMemo(() => answersFor(cleanAnswers, dailyIds), [cleanAnswers, dailyIds]);
  const dailySummary = useMemo(() => summaryFrom(dailyAns, lang), [dailyAns, lang]);
  const dailyAxis = useMemo(() => buildAxisStats(dailyAns, lang), [dailyAns, lang]);
  const dailyTrend = useMemo(() => buildTrend(dailyRows, lang), [dailyRows, lang]);

  /* ===== Final ===== */
  const finalRows = useMemo(() => filterRowsBy(rows, classrooms, "FINAL", finalF), [rows, classrooms, finalF]);
  const finalIds = useMemo(() => new Set(finalRows.map((r) => r.id)), [finalRows]);
  const finalAns = useMemo(() => answersFor(cleanAnswers, finalIds), [cleanAnswers, finalIds]);
  const finalSummary = useMemo(() => summaryFrom(finalAns, lang), [finalAns, lang]);
  const finalAxis = useMemo(() => buildAxisStats(finalAns, lang), [finalAns, lang]);
  const finalTrend = useMemo(() => buildTrend(finalRows, lang), [finalRows, lang]);

  /* ===== Participants ===== */
  const partRows = useMemo(() => filterRowsBy(rows, classrooms, null, partF), [rows, classrooms, partF]);
  const partRoomData = useMemo(() => {
    const byClass = new Map();
    for (const e of partRows) {
      if (!e.classroom_id) continue;
      const s = { name: e.guest_name || e.profile?.full_name || "—", email: e.guest_email || e.profile?.email || "", phone: e.guest_phone || e.profile?.phone || "" };
      const arr = byClass.get(e.classroom_id) || []; arr.push(s); byClass.set(e.classroom_id, arr);
    }
    const out = [];
    const q = normTxt(partF.q);
    for (const c of classrooms) {
      const students = byClass.get(c.id) || [];
      if (!students.length) continue;
      const seen = new Set(); const uniq = [];
      for (const s of students) {
        const key = s.email || s.phone || s.name;
        if (!key || seen.has(key)) continue;
        seen.add(key); uniq.push(s);
      }
      const filtered = q ? uniq.filter((x) => normTxt(x.name).includes(q) || normTxt(x.email).includes(q) || normTxt(x.phone).includes(q)) : uniq;
      if (!filtered.length) continue;
      const tr = trainers.find((x) => x.id === c.trainer_id);
      out.push({ id: c.id, code: c.code, trainer: tr?.name || "—", students: filtered });
    }
    return out.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }, [partRows, classrooms, trainers, partF.q]);

  /* ===== Certificate ===== */
  const certRows = useMemo(() => filterRowsBy(rows, classrooms, null, certF), [rows, classrooms, certF]);
  const certIds = useMemo(() => new Set(certRows.map((r) => r.id)), [certRows]);
  const certAns = useMemo(() => answersFor(cleanAnswers, certIds), [cleanAnswers, certIds]);
  const certRanking = useMemo(() => buildRoomRanking(certAns, certRows, classrooms, trainers), [certAns, certRows, classrooms, trainers]);
  const certBest = useMemo(() => certRanking.find((r) => r.count >= Number(certF.min || 3)) || null, [certRanking, certF.min]);

  /* ===== FiltersBar ===== */
  const FiltersBar = ({ value, setValue, count, withQuery = false, withMin = false }) => {
    const rooms = value?.trainerId && value.trainerId !== "ALL" ? classrooms.filter((c) => c.trainer_id === value.trainerId) : classrooms;
    useEffect(() => {
      if (!value || value.trainerId === "ALL" || value.classroomId === "ALL") return;
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
          <span className="badge" style={{ background: "#eef2ff", color: "#3730a3", direction: "ltr" }}>{t.sample}: {count ?? 0}</span>
        </div>
        <div className="fgrid">
          <select className="sel" value={value.trainerId} onChange={(e) => setValue((f) => ({ ...f, trainerId: e.target.value, classroomId: "ALL" }))}>
            <option value="ALL">{t.allTrainers}</option>
            {trainers.map((tr) => (<option key={tr.id} value={tr.id}>{tr.name}</option>))}
          </select>
          <select className="sel" value={value.classroomId} onChange={(e) => setValue((f) => ({ ...f, classroomId: e.target.value }))} disabled={value.trainerId !== "ALL" && rooms.length === 0}>
            <option value="ALL">{t.allRooms}</option>
            {value.trainerId !== "ALL" && rooms.length === 0
              ? (<option value="NONE" disabled>{isAr ? "لا توجد قاعات لهذا المدرب" : "No rooms for this trainer"}</option>)
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
      <div className="rw" style={{ display: "flex", justifyContent: "center", alignItems: "center", background: NAVY }}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ width: 60, height: 60, border: "6px solid rgba(255,255,255,0.1)", borderTopColor: TEAL, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="rw" style={{ direction: t.dir, fontFamily: t.font }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="lay">
        {/* Sidebar */}
        <aside className="side noprint">
          <div className="brand-card">
            <div className="brand-logos">
              <img src="/logo-upm.png" alt="جامعة الأمير مقرن" className="brand-logo" />
              <div className="brand-divider" />
              <img src="/logo-center.png" alt="المركز العالمي" className="brand-logo" />
            </div>
            <div className="brand-name">{t.title}</div>
            <div className="brand-tag">{t.sub}</div>
          </div>

          <button className={tab === "dashboard" ? "ton" : "tof"} onClick={() => setTab("dashboard")}><span className="nav-label"><span className="nav-ico">📊</span>{t.tab1}</span></button>
          <button className={tab === "daily" ? "ton" : "tof"} onClick={() => setTab("daily")}><span className="nav-label"><span className="nav-ico">📅</span>{t.tab2}</span></button>
          <button className={tab === "final" ? "ton" : "tof"} onClick={() => setTab("final")}><span className="nav-label"><span className="nav-ico">🏁</span>{t.tab3}</span></button>
          <button className={tab === "participants" ? "ton" : "tof"} onClick={() => setTab("participants")}><span className="nav-label"><span className="nav-ico">👥</span>{t.tab4}</span></button>
          <button className={tab === "cert" ? "ton" : "tof"} onClick={() => setTab("cert")}><span className="nav-label"><span className="nav-ico">🏆</span>{t.tab5}</span></button>

          <div style={{ marginTop: 20, borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 16 }}>
            <button onClick={() => setLang(isAr ? "en" : "ar")} style={{ width: "100%", background: "rgba(193,154,61,.18)", border: "1px solid rgba(193,154,61,.45)", color: "#f0d9a8", padding: 12, borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", marginBottom: 8, fontFamily: "inherit" }}>🌐 {t.lang}</button>
            <button onClick={() => router.push("/admin/management")} style={{ width: "100%", background: "transparent", border: "1px solid #33465e", color: "#b6c6d8", cursor: "pointer", padding: 12, borderRadius: 12, fontSize: 14, fontWeight: 800, fontFamily: "inherit" }}>⚙️ {isAr ? "الإدارة" : "Admin"}</button>
          </div>
          <div className="side-copy">{isAr ? "جامعة الأمير مقرن بن عبدالعزيز" : "University of Prince Mugrin"}</div>
        </aside>

        {/* Main */}
        <div className="main">
          <div className="report-header">
            <img src="/logo-upm.png" alt="UPM" />
            <div className="report-header-text">
              <b>{isAr ? "جامعة الأمير مقرن بن عبدالعزيز" : "University of Prince Mugrin"}</b>
              <span>{isAr ? "المركز العالمي لتعليم اللغة العربية — منصة الجودة والتقييم" : "World Center for Arabic Language — Quality Platform"}</span>
            </div>
            <img src="/logo-center.png" alt="Center" />
          </div>

          {/* ============ Dashboard ============ */}
          {tab === "dashboard" && (
            <div>
              <div className="card" style={{ background: `linear-gradient(135deg, ${NAVY}, #1e293b)`, color: "#fff" }}>
                <h1 style={{ fontSize: 32, fontWeight: 900, margin: "0 0 8px" }}>{t.tab1}</h1>
                <p style={{ color: "#94a3b8", margin: 0 }}>{t.executiveHint}</p>
              </div>

              <FiltersBar value={dashF} setValue={setDashF} count={dashRows.length} />

              <div className="g4">
                <MetricCard icon="📝" color={BLUE} title={isAr ? "حجم العينة" : "Sample"} value={dashRows.length} sub={isAr ? "استبانة ضمن الفلاتر" : "Forms in filters"} />
                <MetricCard icon="📊" color={TEAL} title={isAr ? "المتوسط العام" : "Overall Mean"} value={`${dashSummary.mean.toFixed(2)}/5`} sub={isAr ? `الوسيط: ${dashSummary.median.toFixed(2)}` : `Median: ${dashSummary.median.toFixed(2)}`} />
                <MetricCard icon="⚠️" color={dashHighRisk ? RED : TEAL} title={isAr ? "محاور القلق" : "Risk Areas"} value={dashHighRisk} sub={isAr ? "تحتاج تدخلًا أو متابعة" : "Need action or monitoring"} />
                <MetricCard icon="📉" color={ORANGE} title={isAr ? "منخفض 1–2" : "Low 1–2"} value={`${dashSummary.lowPct.toFixed(0)}%`} sub={isAr ? "نسبة عدم الرضا" : "Dissatisfaction rate"} />
              </div>

              <div className="g2">
                <div className="card" style={{ textAlign: "center" }}>
                  <div className="gtitle">{isAr ? "الرضا اليومي" : "Daily Satisfaction"}</div>
                  <GaugeChart score={dashDailySummary.mean} color={BLUE} />
                  <div className="gsub">{isAr ? `استبانات: ${dashDailySummary.respondents}` : `Forms: ${dashDailySummary.respondents}`}</div>
                </div>
                <div className="card" style={{ textAlign: "center" }}>
                  <div className="gtitle">{isAr ? "الرضا النهائي" : "Final Satisfaction"}</div>
                  <GaugeChart score={dashFinalSummary.mean} color={TEAL} />
                  <div className="gsub">{isAr ? `استبانات: ${dashFinalSummary.respondents}` : `Forms: ${dashFinalSummary.respondents}`}</div>
                </div>
              </div>

              <div className="g2">
                <div className="card">
                  <h3 className="ctitle">{isAr ? "📊 توزيع التقييمات" : "📊 Rating Distribution"}</h3>
                  <DistributionChart stats={dashSummary} lang={lang} />
                </div>
                <div className="card">
                  <h3 className="ctitle">{isAr ? "📈 اتجاه الرضا — آخر 7 أيام بيانات" : "📈 Trend — Last 7 Data Days"}</h3>
                  <TrendChart data={dashTrend} lang={lang} color={BLUE} />
                </div>
              </div>

              <InsightsPanel items={dashAxis} summary={dashSummary} lang={lang} />
              <RiskTable title={isAr ? "🛡️ خريطة مخاطر المحاور" : "🛡️ Axis Risk Map"} items={dashAxis} lang={lang} />
              <HeatMap data={dashHeat} lang={lang} />

              <div className="card">
                <h3 className="ctitle">{isAr ? "🏫 ترتيب القاعات حسب الأداء" : "🏫 Room Ranking"}</h3>
                {dashRanking.length ? dashRanking.map((r, i) => (
                  <div key={r.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 14, fontWeight: 800 }}>
                      <span>{(isAr ? "قاعة" : "Room") + " " + r.code} ({r.trainer})</span>
                      <span style={{ color: i === 0 ? TEAL : "#334155", direction: "ltr", fontWeight: 900 }}>{r.avg.toFixed(2)}</span>
                    </div>
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${(r.avg / 5) * 100}%`, height: "100%", background: i === 0 ? TEAL : BLUE }} />
                    </div>
                    <small style={{ color: "#94a3b8", fontWeight: 700 }}>{isAr ? `استبانات: ${r.count}` : `Forms: ${r.count}`}</small>
                  </div>
                )) : <div className="empty">{t.noData}</div>}
              </div>
            </div>
          )}

          {/* ============ Daily ============ */}
          {tab === "daily" && (
            <div>
              <div className="card" style={{ borderInlineStart: `6px solid ${BLUE}` }}>
                <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, color: BLUE }}>{t.tab2}</h1>
                <p style={{ color: "#64748b", margin: 0 }}>{t.dailyHint}</p>
              </div>

              <FiltersBar value={dailyF} setValue={setDailyF} count={dailyRows.length} />

              <div className="g4">
                <MetricCard icon="📝" color={BLUE} title={isAr ? "الاستبانات" : "Forms"} value={dailySummary.respondents} sub={isAr ? "استجابات يومية صالحة" : "Valid daily forms"} />
                <MetricCard icon="📊" color={BLUE} title={isAr ? "المتوسط" : "Mean"} value={`${dailySummary.mean.toFixed(2)}/5`} sub={isAr ? `الوسيط: ${dailySummary.median.toFixed(2)}` : `Median: ${dailySummary.median.toFixed(2)}`} />
                <MetricCard icon="↔️" color={ORANGE} title={isAr ? "الانحراف المعياري" : "Std Dev"} value={dailySummary.stddev.toFixed(2)} sub={isAr ? "ارتفاعه = تذبذب التجربة" : "Higher = less consistent"} />
                <MetricCard icon="⚠️" color={RED} title={isAr ? "منخفض 1–2" : "Low 1–2"} value={`${dailySummary.lowPct.toFixed(0)}%`} sub={isAr ? "نسبة عدم الرضا" : "Dissatisfaction"} />
              </div>

              <div className="g2">
                <div className="card"><h3 className="ctitle">{isAr ? "📊 توزيع تقييمات الحصص" : "📊 Distribution"}</h3><DistributionChart stats={dailySummary} lang={lang} /></div>
                <div className="card"><h3 className="ctitle">{isAr ? "📈 الاتجاه اليومي" : "📈 Daily Trend"}</h3><TrendChart data={dailyTrend} lang={lang} color={BLUE} /></div>
              </div>

              <InsightsPanel items={dailyAxis} summary={dailySummary} lang={lang} />
              <RiskTable title={isAr ? "🛡️ خريطة مخاطر المحاور اليومية" : "🛡️ Daily Risk Map"} items={dailyAxis} lang={lang} />
            </div>
          )}

          {/* ============ Final ============ */}
          {tab === "final" && (
            <div>
              <div className="card" style={{ borderInlineStart: `6px solid ${TEAL}` }}>
                <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, color: TEAL_DARK }}>{t.tab3}</h1>
                <p style={{ color: "#64748b", margin: 0 }}>{t.finalHint}</p>
              </div>

              <FiltersBar value={finalF} setValue={setFinalF} count={finalRows.length} />

              <div className="g4">
                <MetricCard icon="📝" color={TEAL} title={isAr ? "الاستبانات" : "Forms"} value={finalSummary.respondents} sub={isAr ? "استجابات ختامية صالحة" : "Valid final forms"} />
                <MetricCard icon="📊" color={TEAL} title={isAr ? "المتوسط" : "Mean"} value={`${finalSummary.mean.toFixed(2)}/5`} sub={isAr ? `الوسيط: ${finalSummary.median.toFixed(2)}` : `Median: ${finalSummary.median.toFixed(2)}`} />
                <MetricCard icon="↔️" color={ORANGE} title={isAr ? "الانحراف المعياري" : "Std Dev"} value={finalSummary.stddev.toFixed(2)} sub={isAr ? "تذبذب تجربة المشاركين" : "Experience consistency"} />
                <MetricCard icon="⚠️" color={RED} title={isAr ? "منخفض 1–2" : "Low 1–2"} value={`${finalSummary.lowPct.toFixed(0)}%`} sub={isAr ? "نسبة عدم الرضا" : "Dissatisfaction"} />
              </div>

              <div className="g2">
                <div className="card"><h3 className="ctitle">{isAr ? "📊 توزيع تقييمات البرنامج" : "📊 Distribution"}</h3><DistributionChart stats={finalSummary} lang={lang} /></div>
                <div className="card"><h3 className="ctitle">{isAr ? "📈 اتجاه الرضا الختامي" : "📈 Final Trend"}</h3><TrendChart data={finalTrend} lang={lang} color={TEAL} /></div>
              </div>

              <InsightsPanel items={finalAxis} summary={finalSummary} lang={lang} />
              <RiskTable title={isAr ? "🛡️ خريطة مخاطر البرنامج" : "🛡️ Program Risk Map"} items={finalAxis} lang={lang} />
            </div>
          )}

          {/* ============ Participants ============ */}
          {tab === "participants" && (
            <div>
              <div className="card" style={{ borderInlineStart: "6px solid #7c3aed" }}>
                <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, color: "#7c3aed" }}>{t.tab4}</h1>
                <p style={{ color: "#64748b", margin: 0 }}>{t.participantsHint}</p>
              </div>

              <FiltersBar value={partF} setValue={setPartF} count={partRows.length} withQuery />

              <div className="card noprint" style={{ padding: 16, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button className="btn2" onClick={() => setRevealPII((v) => !v)}>🔒 {revealPII ? t.hide : t.reveal}</button>
                  <button className="btn2" onClick={() => {
                    const flat = [];
                    for (const r of partRoomData) for (const s of r.students) flat.push([r.code, r.trainer, s.name, s.phone, s.email]);
                    downloadCSV("participants.csv", [[isAr ? "القاعة" : "Room", isAr ? "المدرب" : "Trainer", isAr ? "الاسم" : "Name", isAr ? "الجوال" : "Phone", isAr ? "البريد" : "Email"], ...flat]);
                  }}>⬇️ {t.export}</button>
                  <button className="btn2" onClick={() => { setPartF({ trainerId: "ALL", classroomId: "ALL", from: "", to: "", q: "" }); setRevealPII(false); }}>🧹 {t.clear}</button>
                  <button className="btn2" style={{ borderColor: "#fca5a5", color: RED }} onClick={() => setPurgeOpen(true)}>🗑️ {t.purge}</button>
                </div>
                <div className="badge" style={{ background: "#f1f5f9", color: "#0f172a" }}>{isAr ? "قاعات" : "Rooms"}: {partRoomData.length}</div>
              </div>

              {partRoomData.map((r) => (
                <div key={r.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ background: "#f8fafc", padding: 16, borderBottom: "1px solid #e2e8f0", display: "flex", gap: 16, alignItems: "center" }}>
                    <b style={{ fontSize: 18, color: TEAL }}>{(isAr ? "قاعة " : "Room ") + r.code}</b>
                    <span style={{ color: "#64748b" }}>{(isAr ? "المدرب: " : "Trainer: ") + r.trainer}</span>
                    <span style={{ background: "#dbeafe", color: "#1d4ed8", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 900, marginInlineStart: "auto" }}>
                      {r.students.length} {isAr ? "مشارك" : "participants"}
                    </span>
                  </div>
                  <table className="tbl">
                    <thead><tr><th className="th">{isAr ? "الاسم" : "Name"}</th><th className="th">{isAr ? "الجوال" : "Phone"}</th><th className="th">{isAr ? "البريد" : "Email"}</th></tr></thead>
                    <tbody>
                      {r.students.map((s, i) => (
                        <tr key={i}>
                          <td className="td">{s.name || "—"}</td>
                          <td className="td ltr">{revealPII ? (s.phone || "—") : maskPhone(s.phone)}</td>
                          <td className="td ltr" style={{ color: BLUE }}>{revealPII ? (s.email || "—") : maskEmail(s.email)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {partRoomData.length === 0 && <div className="card"><div className="empty">{t.noData}</div></div>}
            </div>
          )}

          {/* ============ Certificate ============ */}
          {tab === "cert" && (
            <div>
              <div className="card" style={{ borderInlineStart: `6px solid ${GOLD}` }}>
                <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, color: GOLD }}>{t.tab5}</h1>
                <p style={{ color: "#64748b", margin: 0 }}>{isAr ? "اختر فترة ومعايير ثم اطبع الشهادة." : "Choose range and criteria, then print."}</p>
              </div>

              <FiltersBar value={certF} setValue={setCertF} count={certRows.length} withMin />

              {certBest ? (
                <div className="card" style={{ textAlign: "center", padding: 40, background: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: `4px solid ${GOLD}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <img src="/logo-upm.png" alt="UPM" style={{ height: 64 }} />
                    <img src="/logo-center.png" alt="Center" style={{ height: 64 }} />
                  </div>
                  <h1 style={{ fontSize: 36, fontWeight: 900, color: GOLD, marginBottom: 8 }}>{isAr ? "شهادة تميز وإشادة" : "Certificate of Excellence"}</h1>
                  <p style={{ color: "#64748b", marginBottom: 24 }}>{isAr ? "تُمنح لأفضل مدرب وفق متوسط الأداء وحجم العينة" : "Awarded to the best trainer by average and sample size"}</p>
                  <h2 style={{ fontSize: 48, fontWeight: 900, color: TEAL, marginBottom: 16 }}>{certBest.trainer}</h2>
                  <p style={{ fontSize: 20, color: "#334155" }}>
                    {isAr ? "قاعة" : "Room"} <b style={{ color: BLUE }}>{certBest.code}</b> — {isAr ? "معدل" : "Average"}:{" "}
                    <b style={{ color: GOLD, direction: "ltr" }}>{certBest.avg.toFixed(2)}/5</b> ({isAr ? "استجابات" : "responses"}: {certBest.count})
                  </p>
                  <button onClick={() => window.print()} className="btn2 noprint" style={{ marginTop: 24, background: NAVY, color: "#fff" }}>🖨️ {t.print}</button>
                </div>
              ) : (
                <div className="card" style={{ textAlign: "center", padding: 60 }}><p style={{ color: "#94a3b8", fontSize: 18 }}>{t.noData}</p></div>
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
                <h3>{isAr ? "حذف نهائي للاستجابات" : "Permanent Deletion"}</h3>
                <p>{isAr ? "هذا الإجراء غير قابل للاسترجاع" : "This action cannot be undone"}</p>
              </div>
            </div>
            <div className="modal-body">
              <ul className="modal-warning-list">
                <li>{isAr ? "سيتم حذف استجابات المتدربين نهائيًا من قاعدة البيانات." : "Responses will be permanently deleted."}</li>
                <li>{isAr ? "الحذف يطبق على الفلاتر الحالية (المدرب / القاعة / الفترة)." : "Applies to current filters (trainer / room / dates)."}</li>
                <li>{isAr ? "ستتأثر التقارير فورًا بعد الحذف." : "Reports will be affected immediately."}</li>
                <li>{isAr ? "يُوصى بشدة بتصدير البيانات قبل المتابعة." : "Export data first."}</li>
              </ul>
              <label className="modal-label">{isAr ? "نوع الاستجابات:" : "Response type:"}</label>
              <div className="kind-options">
                {[{ key: "DAILY", ar: "اليومي", en: "Daily", icon: "📅" }, { key: "FINAL", ar: "الختامي", en: "Final", icon: "🏁" }, { key: "BOTH", ar: "كلاهما", en: "Both", icon: "🗂️" }].map((o) => (
                  <div key={o.key} className={`kind-option ${purgeKind === o.key ? "selected" : ""}`} onClick={() => setPurgeKind(o.key)}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{o.icon}</div>
                    {isAr ? o.ar : o.en}
                  </div>
                ))}
              </div>
              <label className="modal-label">{isAr ? "للمتابعة، اكتب كود التأكيد:" : "Type confirmation code:"}</label>
              <input type="password" className={`code-input ${codeError ? "error" : ""}`} placeholder="••••" maxLength={4} value={purgeCode}
                onChange={(e) => setPurgeCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => { if (e.key === "Enter" && purgeCode.length === 4) executePurge(); }}
                disabled={purgeBusy} />
              {purgeMsg && (<div className={`modal-result ${purgeMsg.startsWith("success:") ? "success" : "error"}`}>{purgeMsg.replace(/^(success:|error:)/, "")}</div>)}
            </div>
            <div className="modal-footer">
              <button className="modal-btn-cancel" onClick={closePurgeModal} disabled={purgeBusy}>{isAr ? "إلغاء" : "Cancel"}</button>
              <button className="modal-btn-delete" onClick={executePurge} disabled={purgeBusy || purgeCode.length !== 4}>
                {purgeBusy ? (isAr ? "⏳ جاري الحذف..." : "⏳ Deleting...") : (isAr ? "🗑️ حذف نهائي" : "🗑️ Delete Permanently")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   6) CSS
   ========================================================= */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
* { box-sizing: border-box; }
@keyframes spin { to { transform: rotate(360deg); } }
.rw { background: #f4f6f8; min-height: 100vh; padding: 24px; }
.lay { display: flex; gap: 24px; }
.main { flex: 1; min-width: 0; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
.g4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 20px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 26px; margin-bottom: 20px; box-shadow: 0 8px 28px rgba(15,23,42,.035); }
.ctitle { margin: 0 0 10px; font-size: 19px; font-weight: 900; color: #0f172a; }
.cdesc { color: #64748b; margin: 0 0 16px; font-size: 13px; font-weight: 700; }
.empty { color: #94a3b8; text-align: center; padding: 32px 12px; font-weight: 800; }
.ltr { direction: ltr; unicode-bidi: plaintext; }
.badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 900; }
.tbl { width: 100%; border-collapse: collapse; }
.th { padding: 13px; font-weight: 900; font-size: 13px; color: #64748b; border-bottom: 2px solid #eef2f6; text-align: start; white-space: nowrap; }
.td { padding: 13px; font-size: 13px; border-bottom: 1px solid #f1f5f9; font-weight: 700; vertical-align: top; }
.twrap { width: 100%; overflow-x: auto; }
.twrap .tbl { min-width: 1000px; }
.sel, .inp { width: 100%; padding: 12px; border-radius: 12px; border: 1px solid #cbd5e1; background: #fff; font-weight: 800; outline: none; font-family: inherit; }
.sel:focus, .inp:focus { border-color: #2563eb; box-shadow: 0 0 0 4px rgba(37,99,235,.12); }
.fgrid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.btn2 { width: auto; padding: 12px 16px; border-radius: 12px; border: 1px solid #cbd5e1; background: #fff; color: #0f172a; font-weight: 900; cursor: pointer; font-family: inherit; }
.noprint {}

/* Sidebar identity */
.side { width: 300px; flex-shrink: 0; background: linear-gradient(160deg, #0f2740 0%, #173a5e 55%, #0d9488 130%); border-radius: 24px; padding: 22px; color: #fff; position: sticky; top: 24px; height: fit-content; box-shadow: 0 20px 50px rgba(15,39,64,.25); }
.brand-card { background: #fff; border-radius: 18px; padding: 16px 14px; margin-bottom: 22px; text-align: center; border-bottom: 4px solid #c19a3d; }
.brand-logos { display: flex; align-items: center; justify-content: center; gap: 12px; }
.brand-logo { height: 56px; width: auto; object-fit: contain; }
.brand-divider { width: 1px; height: 44px; background: #e2e8f0; }
.brand-name { color: #173a5e; font-weight: 900; font-size: 16px; margin-top: 10px; }
.brand-tag { color: #0d9488; font-weight: 800; font-size: 12px; margin-top: 2px; }
.ton { background: linear-gradient(135deg, #0d9488, #0f766e); color: #fff; border: none; border-inline-start: 4px solid #c19a3d; border-radius: 14px; padding: 13px 16px; cursor: pointer; font-weight: 800; font-size: 15px; width: 100%; display: flex; align-items: center; margin-bottom: 10px; box-shadow: 0 8px 20px rgba(13,148,136,.35); font-family: inherit; }
.tof { background: rgba(255,255,255,0.05); color: #b6c6d8; border: 1px solid rgba(255,255,255,0.06); border-inline-start: 4px solid transparent; border-radius: 14px; padding: 13px 16px; cursor: pointer; font-weight: 700; font-size: 15px; width: 100%; display: flex; align-items: center; margin-bottom: 10px; transition: all .15s ease; font-family: inherit; }
.tof:hover { background: rgba(255,255,255,0.12); color: #fff; border-inline-start-color: #c19a3d; }
.nav-label { display: flex; align-items: center; gap: 10px; }
.nav-ico { width: 30px; height: 30px; border-radius: 9px; background: rgba(255,255,255,0.14); display: inline-flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
.ton .nav-ico { background: rgba(255,255,255,0.22); }
.side-copy { margin-top: 16px; text-align: center; color: rgba(255,255,255,.45); font-size: 11px; font-weight: 700; }

/* Report header */
.report-header { background: #fff; border: 1px solid #e2e8f0; border-bottom: 4px solid #0d9488; border-radius: 18px; padding: 12px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.report-header img { height: 48px; width: auto; object-fit: contain; }
.report-header-text { text-align: center; }
.report-header-text b { display: block; color: #173a5e; font-size: 16px; font-weight: 900; }
.report-header-text span { color: #0d9488; font-size: 12px; font-weight: 800; }

/* Metric cards */
.mcard { background: #fff; border: 1px solid #e2e8f0; border-bottom: 5px solid #2563eb; padding: 20px; border-radius: 22px; min-height: 140px; box-shadow: 0 8px 28px rgba(15,23,42,.035); }
.mtop { display: flex; align-items: center; gap: 8px; color: #64748b; font-weight: 900; font-size: 14px; }
.mval { font-size: 32px; font-weight: 900; margin-top: 12px; direction: ltr; unicode-bidi: plaintext; }
.msub { color: #94a3b8; font-size: 12px; margin-top: 6px; font-weight: 700; }
.gtitle { color: #64748b; font-size: 15px; font-weight: 900; margin-bottom: 12px; }
.gsub { color: #94a3b8; font-size: 12px; font-weight: 800; margin-top: 10px; }

/* Distribution */
.dbar { height: 22px; width: 100%; display: flex; overflow: hidden; border-radius: 999px; background: #f1f5f9; margin: 20px 0; }
.dlist { display: grid; gap: 10px; }
.ditem { display: flex; align-items: center; gap: 8px; color: #334155; font-size: 14px; font-weight: 800; }

/* Insights */
.igrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.ibox { padding: 18px; border-radius: 16px; border: 1px solid #e2e8f0; }
.ibox h4 { margin: 0 0 12px; font-size: 16px; font-weight: 900; }
.ibox.danger { background: #fff7f7; border-color: #fecaca; }
.ibox.success { background: #f0fdf4; border-color: #bbf7d0; }
.irow { display: grid; gap: 5px; padding: 10px 0; border-bottom: 1px solid rgba(148,163,184,.22); }
.irow:last-child { border-bottom: 0; }
.irow span { color: #475569; font-size: 13px; font-weight: 700; }
.irow small { color: #64748b; line-height: 1.7; }
.cnote { margin-top: 16px; background: #f8fafc; border-radius: 12px; padding: 12px; color: #475569; font-size: 13px; line-height: 1.7; }

/* Risk badge */
.rbadge { display: inline-block; padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 900; white-space: nowrap; }

/* Heat map */
.heat { width: 100%; border-collapse: collapse; min-width: 700px; }
.heat th { border-bottom: 2px solid #e2e8f0; padding: 12px; color: #64748b; text-align: center; font-size: 13px; }
.heat td { border-bottom: 1px solid #f1f5f9; padding: 12px; text-align: center; }
.haxis { text-align: start !important; min-width: 170px; color: #0f172a; font-weight: 900; }
.hcell { display: inline-flex; min-width: 56px; justify-content: center; padding: 8px; border-radius: 10px; font-size: 13px; font-weight: 900; direction: ltr; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; animation: fadeIn .2s ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.modal-box { background: #fff; border-radius: 24px; width: 100%; max-width: 520px; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,.35); animation: slideUp .3s ease; }
.modal-head { background: linear-gradient(135deg, #7f1d1d, #dc2626); color: #fff; padding: 22px 26px; display: flex; align-items: center; gap: 14px; }
.modal-head-icon { width: 48px; height: 48px; border-radius: 14px; background: rgba(255,255,255,.15); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
.modal-head h3 { margin: 0; font-size: 20px; font-weight: 900; }
.modal-head p { margin: 4px 0 0; font-size: 13px; opacity: .85; font-weight: 600; }
.modal-body { padding: 24px 26px; }
.modal-warning-list { background: #fef2f2; border: 1px solid #fecaca; border-radius: 14px; padding: 14px 18px; margin: 0 0 18px; padding-inline-start: 34px; }
.modal-warning-list li { color: #991b1b; font-size: 14px; font-weight: 700; margin-bottom: 6px; line-height: 1.7; }
.modal-warning-list li:last-child { margin-bottom: 0; }
.modal-label { display: block; font-size: 13px; font-weight: 900; color: #334155; margin-bottom: 6px; }
.kind-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 18px; }
.kind-option { border: 2px solid #e2e8f0; border-radius: 12px; padding: 12px 8px; text-align: center; cursor: pointer; font-weight: 800; font-size: 13px; color: #64748b; transition: all .15s ease; background: #fff; }
.kind-option:hover { border-color: #fca5a5; }
.kind-option.selected { border-color: #dc2626; background: #fef2f2; color: #dc2626; }
.code-input { width: 100%; padding: 14px; border-radius: 12px; border: 2px solid #e2e8f0; font-size: 22px; font-weight: 900; text-align: center; letter-spacing: 10px; direction: ltr; outline: none; transition: border .15s ease; }
.code-input:focus { border-color: #dc2626; box-shadow: 0 0 0 4px rgba(220,38,38,.1); }
.code-input.error { border-color: #dc2626; background: #fef2f2; animation: shake .3s ease; }
@keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
.modal-footer { padding: 16px 26px 24px; display: flex; gap: 12px; }
.modal-btn-cancel { flex: 1; padding: 14px; border-radius: 12px; border: 1px solid #cbd5e1; background: #fff; color: #334155; font-weight: 900; font-size: 15px; cursor: pointer; font-family: inherit; }
.modal-btn-delete { flex: 1; padding: 14px; border-radius: 12px; border: none; background: #dc2626; color: #fff; font-weight: 900; font-size: 15px; cursor: pointer; font-family: inherit; }
.modal-btn-delete:disabled { background: #fca5a5; cursor: not-allowed; }
.modal-result { margin-top: 14px; padding: 12px 16px; border-radius: 12px; font-weight: 800; font-size: 14px; line-height: 1.7; }
.modal-result.success { background: #d1fae5; color: #047857; }
.modal-result.error { background: #fee2e2; color: #b91c1c; }

@media(max-width: 1150px){ .g4 { grid-template-columns: repeat(2, 1fr); } }
@media(max-width: 950px){
  .lay { flex-direction: column; }
  .side { width: 100%; position: static; }
  .g2, .g4, .igrid { grid-template-columns: 1fr; }
  .fgrid { grid-template-columns: 1fr; }
  .report-header { flex-direction: column; gap: 8px; }
}
@media print { .side, .noprint { display: none !important; } .rw { padding: 0; background: #fff; } .card { box-shadow: none !important; break-inside: avoid; } }
`;
