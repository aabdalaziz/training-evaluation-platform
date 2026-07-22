// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

/* =========================================================
   Constants
   ========================================================= */
const TEAL = "#10b981";
const BLUE = "#2563eb";
const RED = "#dc2626";
const ORANGE = "#d97706";
const PURPLE = "#7c3aed";

/* =========================================================
   General helpers
   ========================================================= */
function safeRating(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

function mean(values) {
  if (!values?.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (!values?.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/* Sample variance */
function variance(values) {
  if (!values || values.length < 2) return 0;
  const avg = mean(values);
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
}

function stdDev(values) {
  return Math.sqrt(variance(values));
}

function normalizedText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function dateKey(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* =========================================================
   Filtering helpers
   ========================================================= */
function filterRowsBy(baseRows, classrooms, fixedKind, filter) {
  const fromDate = filter?.from ? new Date(filter.from) : null;
  const toDate = filter?.to ? new Date(filter.to) : null;

  if (toDate) toDate.setHours(23, 59, 59, 999);

  const trainerRoomIds =
    filter?.trainerId && filter.trainerId !== "ALL"
      ? new Set(
          (classrooms || [])
            .filter((room) => room.trainer_id === filter.trainerId)
            .map((room) => room.id)
        )
      : null;

  return (baseRows || []).filter((row) => {
    if (!row) return false;

    if (fixedKind && row.kind !== fixedKind) return false;

    if (trainerRoomIds && !trainerRoomIds.has(row.classroom_id)) {
      return false;
    }

    if (filter?.classroomId && filter.classroomId !== "ALL") {
      if (row.classroom_id !== filter.classroomId) return false;
    }

    if (fromDate || toDate) {
      if (!row.submitted_at) return false;

      const submittedAt = new Date(row.submitted_at);
      if (Number.isNaN(submittedAt.getTime())) return false;

      if (fromDate && submittedAt < fromDate) return false;
      if (toDate && submittedAt > toDate) return false;
    }

    return true;
  });
}

/* =========================================================
   Historical duplicate handling
   يمنع تضخيم التحليل إذا ظهر السؤال نفسه أكثر من مرة
   في نفس الاستبانة التاريخية.
   ========================================================= */
function collapseDuplicateAnswers(answers, questions) {
  const questionMap = new Map((questions || []).map((question) => [question.id, question]));
  const buckets = new Map();

  for (const answer of answers || []) {
    const value = safeRating(answer?.rating_value);
    if (value === null) continue;

    const question = questionMap.get(answer.question_id);

    const sectionAr = question?.section_ar || "عام";
    const sectionEn = question?.section_en || sectionAr || "General";
    const textAr = question?.text_ar || "";
    const textEn = question?.text_en || "";

    const text = normalizedText(textAr || textEn || answer.question_id);
    const evaluationId = answer.evaluation_id || "unknown";

    const key = `${evaluationId}__${normalizedText(sectionAr)}__${text}`;

    const bucket = buckets.get(key) || {
      evaluation_id: evaluationId,
      question_id: answer.question_id,
      question,
      values: []
    };

    bucket.values.push(value);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values()).map((bucket) => ({
    evaluation_id: bucket.evaluation_id,
    question_id: bucket.question_id,
    question: bucket.question,
    rating_value: mean(bucket.values)
  }));
}

function answersForEvaluations(cleanAnswers, evaluationIds) {
  return (cleanAnswers || []).filter((answer) => evaluationIds.has(answer.evaluation_id));
}

/* =========================================================
   Statistical helpers
   ========================================================= */
function buildStats(values, respondentCount = 0) {
  const clean = (values || []).filter((value) => safeRating(value) !== null);

  const dist = [0, 0, 0, 0, 0];

  clean.forEach((value) => {
    const rounded = Math.round(value);
    if (rounded >= 1 && rounded <= 5) dist[rounded - 1] += 1;
  });

  const lowCount = clean.filter((value) => value <= 2).length;
  const neutralCount = clean.filter((value) => value > 2 && value < 4).length;
  const highCount = clean.filter((value) => value >= 4).length;

  return {
    measurements: clean.length,
    respondents: respondentCount,
    mean: mean(clean),
    median: median(clean),
    variance: variance(clean),
    stddev: stdDev(clean),
    lowPct: clean.length ? (lowCount / clean.length) * 100 : 0,
    neutralPct: clean.length ? (neutralCount / clean.length) * 100 : 0,
    highPct: clean.length ? (highCount / clean.length) * 100 : 0,
    lowCount,
    neutralCount,
    highCount,
    dist
  };
}

function riskLevel(stats, lang) {
  const n = stats?.respondents || 0;
  const avg = stats?.mean || 0;
  const sd = stats?.stddev || 0;
  const lowPct = stats?.lowPct || 0;

  if (n < 5) {
    return {
      key: "NA",
      score: 0,
      label: lang === "ar" ? "بيانات غير كافية" : "Insufficient data",
      bg: "#f1f5f9",
      fg: "#64748b"
    };
  }

  if (avg < 3 || lowPct >= 20 || sd >= 1.2) {
    return {
      key: "HIGH",
      score: 3,
      label: lang === "ar" ? "منطقة قلق" : "High risk",
      bg: "#fee2e2",
      fg: "#b91c1c"
    };
  }

  if (avg < 3.7 || lowPct >= 10 || sd >= 1) {
    return {
      key: "MED",
      score: 2,
      label: lang === "ar" ? "تحتاج مراقبة" : "Needs monitoring",
      bg: "#fef3c7",
      fg: "#b45309"
    };
  }

  return {
    key: "LOW",
    score: 1,
    label: lang === "ar" ? "مطمئن" : "Good",
    bg: "#d1fae5",
    fg: "#047857"
  };
}

function summaryFromAnswers(cleanAnswers, lang) {
  const values = (cleanAnswers || [])
    .map((answer) => safeRating(answer.rating_value))
    .filter((value) => value !== null);

  const respondents = new Set((cleanAnswers || []).map((answer) => answer.evaluation_id)).size;
  const stats = buildStats(values, respondents);

  return {
    ...stats,
    risk: riskLevel(stats, lang)
  };
}

/* =========================================================
   Axis / dimension analytics
   ========================================================= */
function axisCategory(axisAr = "", axisEn = "") {
  const source = `${axisAr} ${axisEn}`.toLowerCase();

  if (source.includes("مدرب") || source.includes("معلم") || source.includes("teacher") || source.includes("trainer")) {
    return "trainer";
  }

  if (
    source.includes("تعليم") ||
    source.includes("تعلم") ||
    source.includes("مادة") ||
    source.includes("محتوى") ||
    source.includes("درس") ||
    source.includes("learning") ||
    source.includes("content")
  ) {
    return "education";
  }

  if (
    source.includes("قاعة") ||
    source.includes("تجهيز") ||
    source.includes("صوت") ||
    source.includes("عرض") ||
    source.includes("facility") ||
    source.includes("room")
  ) {
    return "facility";
  }

  if (
    source.includes("وصول") ||
    source.includes("استقبال") ||
    source.includes("airport") ||
    source.includes("arrival") ||
    source.includes("reception")
  ) {
    return "arrival";
  }

  if (
    source.includes("ضيافة") ||
    source.includes("خدمات") ||
    source.includes("hospitality") ||
    source.includes("service")
  ) {
    return "hospitality";
  }

  if (
    source.includes("نقل") ||
    source.includes("انتقال") ||
    source.includes("مواصلات") ||
    source.includes("transport")
  ) {
    return "transport";
  }

  if (
    source.includes("سكن") ||
    source.includes("housing") ||
    source.includes("accommodation")
  ) {
    return "housing";
  }

  if (
    source.includes("جولات") ||
    source.includes("زيارة") ||
    source.includes("tour") ||
    source.includes("visit")
  ) {
    return "tours";
  }

  if (source.includes("عمرة") || source.includes("umrah")) {
    return "umrah";
  }

  if (
    source.includes("إدارة") ||
    source.includes("برنامج") ||
    source.includes("response") ||
    source.includes("administration") ||
    source.includes("management")
  ) {
    return "administration";
  }

  return "general";
}

const RECOMMENDATIONS = {
  trainer: {
    ar: "رفع التفاعل داخل القاعة، استخدام أمثلة تطبيقية، تخصيص وقت للأسئلة، وتلخيص أهم النقاط في نهاية الحصة.",
    en: "Increase in-class engagement, use practical examples, reserve time for questions, and provide an end-of-session summary."
  },
  education: {
    ar: "مراجعة وضوح المحتوى وملاءمته للمستوى، إضافة أنشطة تطبيقية قصيرة، وربط المحتوى بمخرجات التعلم.",
    en: "Review content clarity and level suitability, add short practical activities, and align content with learning outcomes."
  },
  facility: {
    ar: "تنفيذ فحص مسبق للصوت والعرض والإنترنت والإضاءة، وتفعيل آلية سريعة للإبلاغ عن الأعطال ومعالجتها.",
    en: "Pre-check AV, internet, lighting, and facilities; activate a fast issue reporting and resolution process."
  },
  arrival: {
    ar: "تأكيد ترتيبات الوصول قبل 24 ساعة، إرسال تعليمات موحدة، تحديد مسؤول ميداني، وتوفير رقم دعم فوري.",
    en: "Confirm arrival arrangements 24 hours ahead, send unified instructions, assign a field coordinator, and provide fast support."
  },
  hospitality: {
    ar: "توحيد معايير الضيافة، تقليل وقت الانتظار، ومتابعة جودة الخدمة من خلال قياس يومي للملاحظات.",
    en: "Standardize hospitality, reduce waiting time, and monitor service quality through daily feedback."
  },
  transport: {
    ar: "تثبيت جدول النقل، توضيح نقاط التجمع، إرسال تنبيهات قبل الرحلات، وتوفير قناة دعم عند التأخر.",
    en: "Stabilize transport schedules, clarify meeting points, send reminders, and provide support for delays."
  },
  housing: {
    ar: "إجراء فحص دوري للنظافة والراحة، تفعيل قناة بلاغات، وقياس سرعة الاستجابة للملاحظات.",
    en: "Conduct regular cleanliness and comfort checks, activate a reporting channel, and measure response time."
  },
  tours: {
    ar: "تحسين تنظيم الجولات، ضبط الوقت ونقاط التجمع، وقياس رضا المشاركين عن كل نشاط بصورة مستقلة.",
    en: "Improve tour organization, timing and meeting points, and measure satisfaction for each activity separately."
  },
  umrah: {
    ar: "توضيح خطة العمرة والخدمات المصاحبة، رفع الإرشاد الميداني، وتفعيل دعم فوري للمشاركين.",
    en: "Clarify the Umrah plan and related services, enhance field guidance, and activate immediate participant support."
  },
  administration: {
    ar: "تحسين وضوح التعليمات، توحيد قنوات التواصل، تحديد مسؤول خدمة واضح، ومتابعة الملاحظات حتى الإغلاق.",
    en: "Improve instruction clarity, unify communication channels, assign a clear service owner, and track issues to closure."
  },
  general: {
    ar: "تنفيذ تحسينات سريعة، ثم إعادة القياس خلال أسبوعين للتحقق من أثر التحسين.",
    en: "Apply quick improvements, then re-measure within two weeks to validate impact."
  }
};

function recommendationForAxis(axisAr, axisEn, riskKey, lang) {
  if (riskKey === "NA") {
    return lang === "ar"
      ? "العينة صغيرة؛ يفضّل زيادة عدد الاستجابات قبل اتخاذ قرار تشغيلي."
      : "The sample is small; collect more responses before making an operational decision.";
  }

  if (riskKey === "LOW") {
    return lang === "ar"
      ? "نقطة قوة: المحافظة على الممارسة الحالية وتوثيقها كنموذج يمكن تعميمه."
      : "Strength: maintain the current practice and document it as a model to replicate.";
  }

  const category = axisCategory(axisAr, axisEn);
  return RECOMMENDATIONS[category]?.[lang] || RECOMMENDATIONS.general[lang];
}

function buildAxisStats(cleanAnswers, lang) {
  const groups = new Map();

  for (const answer of cleanAnswers || []) {
    const value = safeRating(answer.rating_value);
    if (value === null) continue;

    const question = answer.question || {};
    const axisAr = question.section_ar || "عام";
    const axisEn = question.section_en || axisAr || "General";

    const key = `${axisAr}__${axisEn}`;

    const group = groups.get(key) || {
      axisAr,
      axisEn,
      values: [],
      respondents: new Set()
    };

    group.values.push(value);
    group.respondents.add(answer.evaluation_id);
    groups.set(key, group);
  }

  const output = [];

  for (const group of groups.values()) {
    const stats = buildStats(group.values, group.respondents.size);
    const risk = riskLevel(stats, lang);

    output.push({
      axisAr: group.axisAr,
      axisEn: group.axisEn,
      axisLabel: lang === "ar" ? group.axisAr : group.axisEn,
      ...stats,
      risk,
      recommendation: recommendationForAxis(group.axisAr, group.axisEn, risk.key, lang)
    });
  }

  return output.sort((a, b) => {
    return (
      b.risk.score - a.risk.score ||
      b.lowPct - a.lowPct ||
      a.mean - b.mean
    );
  });
}

/* =========================================================
   Trend analytics
   ========================================================= */
function buildTrend(rows, lang) {
  const validRows = (rows || [])
    .filter((row) => row?.submitted_at && safeRating(row?.overall_rating) !== null)
    .map((row) => ({
      ...row,
      submittedDate: new Date(row.submitted_at)
    }))
    .filter((row) => !Number.isNaN(row.submittedDate.getTime()));

  if (!validRows.length) return [];

  const latestDate = new Date(
    Math.max(...validRows.map((row) => row.submittedDate.getTime()))
  );

  latestDate.setHours(0, 0, 0, 0);

  const groups = new Map();

  for (let i = 6; i >= 0; i--) {
    const day = new Date(latestDate);
    day.setDate(latestDate.getDate() - i);

    const key = dateKey(day);

    groups.set(key, {
      key,
      date: day,
      values: []
    });
  }

  validRows.forEach((row) => {
    const key = dateKey(row.submittedDate);
    const bucket = groups.get(key);

    if (bucket) {
      bucket.values.push(Number(row.overall_rating));
    }
  });

  const locale = lang === "ar" ? "ar-SA" : "en-US";

  return Array.from(groups.values()).map((item) => ({
    label: new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric"
    }).format(item.date),
    count: item.values.length,
    avg: item.values.length ? mean(item.values) : null
  }));
}

/* =========================================================
   Room analytics
   ========================================================= */
function buildRoomRanking(cleanAnswers, rows, classrooms, trainers) {
  const evaluationRoomMap = new Map(
    (rows || []).map((row) => [row.id, row.classroom_id])
  );

  const evaluationRatings = new Map();

  for (const answer of cleanAnswers || []) {
    const value = safeRating(answer.rating_value);
    if (value === null) continue;

    const current = evaluationRatings.get(answer.evaluation_id) || [];
    current.push(value);
    evaluationRatings.set(answer.evaluation_id, current);
  }

  const roomStats = new Map();

  for (const [evaluationId, values] of evaluationRatings.entries()) {
    const roomId = evaluationRoomMap.get(evaluationId);
    if (!roomId) continue;

    const current = roomStats.get(roomId) || {
      sum: 0,
      count: 0
    };

    current.sum += mean(values);
    current.count += 1;

    roomStats.set(roomId, current);
  }

  const result = [];

  for (const room of classrooms || []) {
    const stats = roomStats.get(room.id);
    if (!stats?.count) continue;

    const trainer = (trainers || []).find(
      (item) => item.id === room.trainer_id
    );

    result.push({
      id: room.id,
      code: room.code || "—",
      trainer: trainer?.name || "—",
      avg: stats.sum / stats.count,
      count: stats.count
    });
  }

  return result.sort((a, b) => b.avg - a.avg);
}

/* =========================================================
   Heat map
   ========================================================= */
function buildHeatMap(cleanAnswers, rows, classrooms, lang) {
  const evaluationRoom = new Map(
    (rows || []).map((row) => [row.id, row.classroom_id])
  );

  const groups = new Map();
  const usedRoomIds = new Set();

  for (const answer of cleanAnswers || []) {
    const value = safeRating(answer.rating_value);
    const roomId = evaluationRoom.get(answer.evaluation_id);

    if (value === null || !roomId) continue;

    const question = answer.question || {};
    const axisAr = question.section_ar || "عام";
    const axisEn = question.section_en || axisAr || "General";
    const axisKey = `${axisAr}__${axisEn}`;

    const group = groups.get(axisKey) || {
      axisAr,
      axisEn,
      rooms: new Map()
    };

    const roomValues = group.rooms.get(roomId) || [];
    roomValues.push(value);

    group.rooms.set(roomId, roomValues);
    groups.set(axisKey, group);
    usedRoomIds.add(roomId);
  }

  const rooms = (classrooms || [])
    .filter((room) => usedRoomIds.has(room.id))
    .sort((a, b) => String(a.code).localeCompare(String(b.code)))
    .slice(0, 8);

  const axes = Array.from(groups.values())
    .map((axis) => {
      const allValues = [];

      axis.rooms.forEach((values) => allValues.push(...values));

      return {
        axisLabel: lang === "ar" ? axis.axisAr : axis.axisEn,
        overall: mean(allValues),
        cells: rooms.map((room) => {
          const values = axis.rooms.get(room.id) || [];
          return {
            roomId: room.id,
            avg: values.length ? mean(values) : null,
            count: values.length
          };
        })
      };
    })
    .sort((a, b) => a.overall - b.overall)
    .slice(0, 10);

  return { rooms, axes };
}

function heatColor(avg, count) {
  if (!count || avg === null) {
    return {
      bg: "#f8fafc",
      fg: "#94a3b8"
    };
  }

  if (avg < 3) {
    return {
      bg: "#fee2e2",
      fg: "#b91c1c"
    };
  }

  if (avg < 3.7) {
    return {
      bg: "#fef3c7",
      fg: "#b45309"
    };
  }

  if (avg < 4.2) {
    return {
      bg: "#dcfce7",
      fg: "#15803d"
    };
  }

  return {
    bg: "#bbf7d0",
    fg: "#166534"
  };
}

/* =========================================================
   Misc UI helpers
   ========================================================= */
function maskEmail(email) {
  if (!email || !email.includes("@")) return "—";
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone) {
  if (!phone) return "—";

  const cleaned = String(phone).replace(/\s+/g, "");

  if (cleaned.length < 6) return "***";

  return cleaned.replace(/(\d{2})\d+(\d{2})/, "$1******$2");
}

function downloadCSV(filename, rows) {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map(escape).join(",")).join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

/* =========================================================
   Shared Components
   ========================================================= */
function GaugeChart({ score, color }) {
  const value = Number(score || 0);
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const radius = 55;
  const circumference = Math.PI * radius;

  return (
    <div
      style={{
        textAlign: "center",
        position: "relative",
        height: "85px",
        width: "150px",
        margin: "0 auto"
      }}
    >
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
          style={{ transition: "stroke-dashoffset 1.2s ease" }}
        />
      </svg>

      <div
        style={{
          position: "absolute",
          bottom: "-5px",
          left: 0,
          right: 0,
          fontSize: "28px",
          fontWeight: 900,
          direction: "ltr",
          unicodeBidi: "plaintext"
        }}
      >
        {value ? value.toFixed(2) : "0.00"}
      </div>
    </div>
  );
}

function MetricCard({ title, value, sub, color = BLUE, icon = "📊" }) {
  return (
    <div className="metric-card" style={{ borderBottomColor: color }}>
      <div className="metric-top">
        <span className="metric-icon">{icon}</span>
        <span className="metric-title">{title}</span>
      </div>

      <div className="metric-value">{value}</div>

      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

function DistributionChart({ stats, lang }) {
  const isAr = lang === "ar";
  const total = stats?.measurements || 0;

  const items = [
    {
      label: isAr ? "منخفض 1–2" : "Low 1–2",
      value: stats?.lowCount || 0,
      pct: stats?.lowPct || 0,
      color: "#ef4444"
    },
    {
      label: isAr ? "محايد 3" : "Neutral 3",
      value: stats?.neutralCount || 0,
      pct: stats?.neutralPct || 0,
      color: "#f59e0b"
    },
    {
      label: isAr ? "مرتفع 4–5" : "High 4–5",
      value: stats?.highCount || 0,
      pct: stats?.highPct || 0,
      color: "#10b981"
    }
  ];

  if (!total) {
    return (
      <div className="empty-state">
        {isAr ? "لا توجد استجابات لعرض التوزيع." : "No responses to display distribution."}
      </div>
    );
  }

  return (
    <div>
      <div className="distribution-bar">
        {items.map((item) => (
          <div
            key={item.label}
            title={`${item.label}: ${item.pct.toFixed(1)}%`}
            style={{
              width: `${item.pct}%`,
              background: item.color,
              minWidth: item.pct > 0 ? "4px" : 0
            }}
          />
        ))}
      </div>

      <div className="distribution-list">
        {items.map((item) => (
          <div className="distribution-item" key={item.label}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: item.color,
                display: "inline-block"
              }}
            />
            <span>{item.label}</span>
            <b style={{ marginInlineStart: "auto", direction: "ltr" }}>
              {item.value} ({item.pct.toFixed(0)}%)
            </b>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ data, lang, color = BLUE }) {
  const isAr = lang === "ar";

  if (!data?.some((item) => item.count > 0)) {
    return (
      <div className="empty-state">
        {isAr ? "لا توجد بيانات كافية لرسم الاتجاه الزمني." : "No sufficient data for trend chart."}
      </div>
    );
  }

  const width = 680;
  const height = 260;
  const paddingX = 42;
  const paddingTop = 24;
  const paddingBottom = 42;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;

  const pointOf = (item, index) => {
    const x = paddingX + (index * chartWidth) / Math.max(data.length - 1, 1);
    const y =
      item.avg === null
        ? null
        : paddingTop + (1 - item.avg / 5) * chartHeight;

    return { x, y };
  };

  const points = data
    .map((item, index) => ({
      ...item,
      ...pointOf(item, index)
    }))
    .filter((point) => point.y !== null);

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", minWidth: 560, height: "auto" }}
      >
        {[1, 2, 3, 4, 5].map((value) => {
          const y = paddingTop + (1 - value / 5) * chartHeight;

          return (
            <g key={value}>
              <line
                x1={paddingX}
                x2={width - paddingX}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />
              <text
                x="12"
                y={y + 4}
                fill="#64748b"
                fontSize="12"
                direction="ltr"
              >
                {value}
              </text>
            </g>
          );
        })}

        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, index) => (
          <g key={index}>
            <circle
              cx={point.x}
              cy={point.y}
              r="6"
              fill="#fff"
              stroke={color}
              strokeWidth="4"
            />
            <text
              x={point.x}
              y={point.y - 14}
              textAnchor="middle"
              fill="#0f172a"
              fontSize="12"
              fontWeight="800"
            >
              {point.avg.toFixed(2)}
            </text>
            <text
              x={point.x}
              y={height - 16}
              textAnchor="middle"
              fill="#64748b"
              fontSize="11"
            >
              {point.label}
            </text>
            <text
              x={point.x}
              y={height - 2}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="10"
            >
              N={point.count}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function RiskTable({ title, items, lang }) {
  const isAr = lang === "ar";

  if (!items?.length) {
    return (
      <div className="card">
        <h3 className="card-title">{title}</h3>
        <div className="empty-state">
          {isAr ? "لا توجد بيانات للمحاور ضمن الفلاتر الحالية." : "No axis data for current filters."}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title">{title}</h3>

      <p className="card-description">
        {isAr
          ? "يتم الترتيب من مناطق القلق الأعلى إلى المحاور الأكثر استقرارًا."
          : "Items are sorted from highest risk to most stable."}
      </p>

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th className="th">{isAr ? "المحور" : "Axis"}</th>
              <th className="th">N</th>
              <th className="th">{isAr ? "المتوسط" : "Mean"}</th>
              <th className="th">{isAr ? "الوسيط" : "Median"}</th>
              <th className="th">{isAr ? "التباين" : "Variance"}</th>
              <th className="th">{isAr ? "الانحراف" : "Std. Dev."}</th>
              <th className="th">{isAr ? "منخفض" : "Low"}</th>
              <th className="th">{isAr ? "مرتفع" : "High"}</th>
              <th className="th">{isAr ? "الحالة" : "Risk"}</th>
              <th className="th">{isAr ? "التوصية" : "Recommendation"}</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.axisLabel}-${index}`}>
                <td className="td axis-name">{item.axisLabel}</td>
                <td className="td ltr">{item.respondents}</td>
                <td className="td ltr">{item.mean.toFixed(2)}</td>
                <td className="td ltr">{item.median.toFixed(2)}</td>
                <td className="td ltr">{item.variance.toFixed(2)}</td>
                <td className="td ltr">{item.stddev.toFixed(2)}</td>
                <td className="td ltr">{item.lowPct.toFixed(0)}%</td>
                <td className="td ltr">{item.highPct.toFixed(0)}%</td>
                <td className="td">
                  <span
                    className="risk-badge"
                    style={{
                      background: item.risk.bg,
                      color: item.risk.fg
                    }}
                  >
                    {item.risk.label}
                  </span>
                </td>
                <td className="td recommendation">{item.recommendation}</td>
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

  const concerns = (items || [])
    .filter((item) => item.risk.key === "HIGH" || item.risk.key === "MED")
    .slice(0, 3);

  const strengths = (items || [])
    .filter((item) => item.risk.key === "LOW")
    .slice(0, 3);

  return (
    <div className="card">
      <h3 className="card-title">
        {isAr ? "🧠 القراءة التنفيذية والتوصيات" : "🧠 Executive Insights & Recommendations"}
      </h3>

      <div className="insight-grid">
        <div className="insight-box danger">
          <h4>{isAr ? "مناطق تحتاج إلى تدخل" : "Areas requiring intervention"}</h4>

          {concerns.length ? (
            concerns.map((item, index) => (
              <div className="insight-row" key={index}>
                <b>{item.axisLabel}</b>
                <span>
                  {isAr
                    ? `متوسط ${item.mean.toFixed(2)}/5، وتقييم منخفض ${item.lowPct.toFixed(0)}%.`
                    : `Mean ${item.mean.toFixed(2)}/5, low ratings ${item.lowPct.toFixed(0)}%.`}
                </span>
                <small>{item.recommendation}</small>
              </div>
            ))
          ) : (
            <p>
              {isAr
                ? "لا توجد منطقة قلق واضحة ضمن البيانات الحالية."
                : "No clear high-risk area in the current data."}
            </p>
          )}
        </div>

        <div className="insight-box success">
          <h4>{isAr ? "نقاط القوة" : "Strengths"}</h4>

          {strengths.length ? (
            strengths.map((item, index) => (
              <div className="insight-row" key={index}>
                <b>{item.axisLabel}</b>
                <span>
                  {isAr
                    ? `متوسط ${item.mean.toFixed(2)}/5، ورضا مرتفع ${item.highPct.toFixed(0)}%.`
                    : `Mean ${item.mean.toFixed(2)}/5, high ratings ${item.highPct.toFixed(0)}%.`}
                </span>
                <small>{item.recommendation}</small>
              </div>
            ))
          ) : (
            <p>
              {isAr
                ? "لا توجد بيانات كافية لتحديد نقاط القوة."
                : "Insufficient data to identify strengths."}
            </p>
          )}
        </div>
      </div>

      <div className="confidence-note">
        <b>{isAr ? "ملاحظة جودة البيانات:" : "Data-quality note:"}</b>{" "}
        {summary.respondents < 5
          ? isAr
            ? "حجم العينة منخفض؛ يجب التعامل مع النتائج كإشارة أولية فقط."
            : "The sample is small; treat results as an early indication only."
          : isAr
          ? `التحليل مبني على ${summary.respondents} استبانة صالحة و${summary.measurements} قياسًا رقميًا.`
          : `Analysis is based on ${summary.respondents} valid forms and ${summary.measurements} numeric measurements.`}
      </div>
    </div>
  );
}

function HeatMap({ data, lang }) {
  const isAr = lang === "ar";

  if (!data?.axes?.length || !data?.rooms?.length) {
    return (
      <div className="card">
        <h3 className="card-title">
          {isAr ? "🗺️ الخريطة الحرارية للمحاور والقاعات" : "🗺️ Axis & Room Heat Map"}
        </h3>
        <div className="empty-state">
          {isAr ? "لا توجد بيانات كافية لعرض الخريطة الحرارية." : "Not enough data for heat map."}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title">
        {isAr ? "🗺️ الخريطة الحرارية للمحاور والقاعات" : "🗺️ Axis & Room Heat Map"}
      </h3>

      <p className="card-description">
        {isAr
          ? "الأحمر يشير إلى مستوى منخفض، والأصفر يحتاج متابعة، والأخضر يمثل أداءً أفضل."
          : "Red indicates low performance, yellow needs monitoring, and green indicates stronger performance."}
      </p>

      <div className="table-wrap">
        <table className="heat-table">
          <thead>
            <tr>
              <th>{isAr ? "المحور" : "Axis"}</th>
              {data.rooms.map((room) => (
                <th key={room.id}>
                  {isAr ? "قاعة" : "Room"} {room.code}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.axes.map((axis) => (
              <tr key={axis.axisLabel}>
                <td className="heat-axis">{axis.axisLabel}</td>

                {axis.cells.map((cell) => {
                  const style = heatColor(cell.avg, cell.count);

                  return (
                    <td key={cell.roomId}>
                      <span
                        className="heat-cell"
                        style={{
                          background: style.bg,
                          color: style.fg
                        }}
                        title={
                          cell.count
                            ? `${axis.axisLabel}: ${cell.avg.toFixed(2)} / 5`
                            : isAr
                            ? "لا توجد بيانات"
                            : "No data"
                        }
                      >
                        {cell.count ? cell.avg.toFixed(2) : "—"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FiltersBar({
  value,
  onChange,
  count,
  trainers,
  classrooms,
  lang,
  withSearch = false,
  withMin = false
}) {
  const isAr = lang === "ar";

  const rooms =
    value?.trainerId && value.trainerId !== "ALL"
      ? classrooms.filter((room) => room.trainer_id === value.trainerId)
      : classrooms;

  useEffect(() => {
    if (!value?.trainerId || value.trainerId === "ALL") return;
    if (!value?.classroomId || value.classroomId === "ALL") return;

    const isValidRoom = classrooms.some(
      (room) =>
        room.id === value.classroomId &&
        room.trainer_id === value.trainerId
    );

    if (!isValidRoom) {
      onChange((old) => ({
        ...old,
        classroomId: "ALL"
      }));
    }
  }, [value?.trainerId, value?.classroomId, classrooms, onChange]);

  const reset = () => {
    const base = {
      trainerId: "ALL",
      classroomId: "ALL",
      from: "",
      to: ""
    };

    if (withSearch) base.q = "";
    if (withMin) base.min = 3;

    onChange(base);
  };

  return (
    <div className="card noprint" style={{ padding: 16 }}>
      <div className="filter-title-row">
        <b>{isAr ? "الفلاتر والتحكم بالتقرير" : "Report Filters"}</b>

        <span className="sample-badge">
          {isAr ? "عدد الاستجابات" : "Responses"}: {count || 0}
        </span>
      </div>

      <div className="filter-grid">
        <select
          className="sel"
          value={value.trainerId}
          onChange={(event) =>
            onChange((old) => ({
              ...old,
              trainerId: event.target.value,
              classroomId: "ALL"
            }))
          }
        >
          <option value="ALL">
            {isAr ? "كل المدربين" : "All trainers"}
          </option>

          {trainers.map((trainer) => (
            <option key={trainer.id} value={trainer.id}>
              {trainer.name}
            </option>
          ))}
        </select>

        <select
          className="sel"
          value={value.classroomId}
          disabled={value.trainerId !== "ALL" && rooms.length === 0}
          onChange={(event) =>
            onChange((old) => ({
              ...old,
              classroomId: event.target.value
            }))
          }
        >
          <option value="ALL">
            {isAr ? "كل القاعات" : "All rooms"}
          </option>

          {value.trainerId !== "ALL" && rooms.length === 0 ? (
            <option value="NONE" disabled>
              {isAr
                ? "لا توجد قاعات لهذا المدرب"
                : "No rooms for this trainer"}
            </option>
          ) : (
            rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {isAr ? "قاعة " : "Room "} {room.code}
              </option>
            ))
          )}
        </select>

        {"from" in value && (
          <input
            className="inp"
            title={isAr ? "من تاريخ" : "From date"}
            type="date"
            value={value.from}
            onChange={(event) =>
              onChange((old) => ({
                ...old,
                from: event.target.value
              }))
            }
          />
        )}

        {"to" in value && (
          <input
            className="inp"
            title={isAr ? "إلى تاريخ" : "To date"}
            type="date"
            value={value.to}
            onChange={(event) =>
              onChange((old) => ({
                ...old,
                to: event.target.value
              }))
            }
          />
        )}

        {withSearch && (
          <input
            className="inp"
            placeholder={isAr ? "بحث بالاسم أو البريد أو الجوال" : "Search name, email or phone"}
            value={value.q}
            onChange={(event) =>
              onChange((old) => ({
                ...old,
                q: event.target.value
              }))
            }
          />
        )}

        {withMin && (
          <input
            className="inp"
            type="number"
            min={1}
            placeholder={isAr ? "الحد الأدنى للاستجابات" : "Minimum responses"}
            value={value.min}
            onChange={(event) =>
              onChange((old) => ({
                ...old,
                min: event.target.value
              }))
            }
          />
        )}

        <button className="reset-btn" onClick={reset}>
          ↻ {isAr ? "إعادة تعيين" : "Reset"}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   Page
   ========================================================= */
export default function ReportsPage() {
  const router = useRouter();

  const [lang, setLang] = useState("ar");
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");

  const [rows, setRows] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [trainers, setTrainers] = useState([]);

  const [revealPII, setRevealPII] = useState(false);

  const [dashF, setDashF] = useState({
    trainerId: "ALL",
    classroomId: "ALL",
    from: "",
    to: ""
  });

  const [dailyF, setDailyF] = useState({
    trainerId: "ALL",
    classroomId: "ALL",
    from: "",
    to: ""
  });

  const [finalF, setFinalF] = useState({
    trainerId: "ALL",
    classroomId: "ALL",
    from: "",
    to: ""
  });

  const [partF, setPartF] = useState({
    trainerId: "ALL",
    classroomId: "ALL",
    from: "",
    to: "",
    q: ""
  });

  const [certF, setCertF] = useState({
    trainerId: "ALL",
    classroomId: "ALL",
    from: "",
    to: "",
    min: 3
  });

  const isAr = lang === "ar";
  const db = supabase();

  const loadAllData = async () => {
    const [evaluationResult, answerResult, questionResult, classroomResult, trainerResult] =
      await Promise.all([
        db.from("evaluations").select("*").order("submitted_at", { ascending: false }),
        db.from("evaluation_answers").select("*"),
        db.from("questions").select("*"),
        db.from("classrooms").select("*"),
        db.from("trainers").select("*")
      ]);

    setRows(evaluationResult.data || []);
    setAnswers(answerResult.data || []);
    setQuestions(questionResult.data || []);
    setClassrooms(classroomResult.data || []);
    setTrainers(trainerResult.data || []);
  };

  useEffect(() => {
    setMounted(true);

    let active = true;

    (async () => {
      const session = await db.auth.getSession();

      if (!session.data?.session) {
        router.push("/login");
        return;
      }

      if (active) {
        await loadAllData();
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================================================
     Clean answers: protects reports from duplicated questions
     ========================================================= */
  const cleanAnswers = useMemo(
    () => collapseDuplicateAnswers(answers, questions),
    [answers, questions]
  );

  /* =========================================================
     Dashboard data
     ========================================================= */
  const dashRows = useMemo(
    () => filterRowsBy(rows, classrooms, null, dashF),
    [rows, classrooms, dashF]
  );

  const dashIds = useMemo(
    () => new Set(dashRows.map((row) => row.id)),
    [dashRows]
  );

  const dashAnswers = useMemo(
    () => answersForEvaluations(cleanAnswers, dashIds),
    [cleanAnswers, dashIds]
  );

  const dashDailyRows = useMemo(
    () => dashRows.filter((row) => row.kind === "DAILY"),
    [dashRows]
  );

  const dashFinalRows = useMemo(
    () => dashRows.filter((row) => row.kind === "FINAL"),
    [dashRows]
  );

  const dashDailyIds = useMemo(
    () => new Set(dashDailyRows.map((row) => row.id)),
    [dashDailyRows]
  );

  const dashFinalIds = useMemo(
    () => new Set(dashFinalRows.map((row) => row.id)),
    [dashFinalRows]
  );

  const dashDailyAnswers = useMemo(
    () => answersForEvaluations(cleanAnswers, dashDailyIds),
    [cleanAnswers, dashDailyIds]
  );

  const dashFinalAnswers = useMemo(
    () => answersForEvaluations(cleanAnswers, dashFinalIds),
    [cleanAnswers, dashFinalIds]
  );

  const dashSummary = useMemo(
    () => summaryFromAnswers(dashAnswers, lang),
    [dashAnswers, lang]
  );

  const dashDailySummary = useMemo(
    () => summaryFromAnswers(dashDailyAnswers, lang),
    [dashDailyAnswers, lang]
  );

  const dashFinalSummary = useMemo(
    () => summaryFromAnswers(dashFinalAnswers, lang),
    [dashFinalAnswers, lang]
  );

  const dashAxis = useMemo(
    () => buildAxisStats(dashAnswers, lang),
    [dashAnswers, lang]
  );

  const dashTrend = useMemo(
    () => buildTrend(dashRows, lang),
    [dashRows, lang]
  );

  const dashRanking = useMemo(
    () => buildRoomRanking(dashAnswers, dashRows, classrooms, trainers),
    [dashAnswers, dashRows, classrooms, trainers]
  );

  const dashHeatMap = useMemo(
    () => buildHeatMap(dashAnswers, dashRows, classrooms, lang),
    [dashAnswers, dashRows, classrooms, lang]
  );

  const dashHighRiskCount = useMemo(
    () => dashAxis.filter((item) => item.risk.key === "HIGH").length,
    [dashAxis]
  );

  /* =========================================================
     Daily report data
     ========================================================= */
  const dailyRows = useMemo(
    () => filterRowsBy(rows, classrooms, "DAILY", dailyF),
    [rows, classrooms, dailyF]
  );

  const dailyIds = useMemo(
    () => new Set(dailyRows.map((row) => row.id)),
    [dailyRows]
  );

  const dailyAnswers = useMemo(
    () => answersForEvaluations(cleanAnswers, dailyIds),
    [cleanAnswers, dailyIds]
  );

  const dailySummary = useMemo(
    () => summaryFromAnswers(dailyAnswers, lang),
    [dailyAnswers, lang]
  );

  const dailyAxis = useMemo(
    () => buildAxisStats(dailyAnswers, lang),
    [dailyAnswers, lang]
  );

  const dailyTrend = useMemo(
    () => buildTrend(dailyRows, lang),
    [dailyRows, lang]
  );

  /* =========================================================
     Final report data
     ========================================================= */
  const finalRows = useMemo(
    () => filterRowsBy(rows, classrooms, "FINAL", finalF),
    [rows, classrooms, finalF]
  );

  const finalIds = useMemo(
    () => new Set(finalRows.map((row) => row.id)),
    [finalRows]
  );

  const finalAnswers = useMemo(
    () => answersForEvaluations(cleanAnswers, finalIds),
    [cleanAnswers, finalIds]
  );

  const finalSummary = useMemo(
    () => summaryFromAnswers(finalAnswers, lang),
    [finalAnswers, lang]
  );

  const finalAxis = useMemo(
    () => buildAxisStats(finalAnswers, lang),
    [finalAnswers, lang]
  );

  const finalTrend = useMemo(
    () => buildTrend(finalRows, lang),
    [finalRows, lang]
  );

  /* =========================================================
     Participants data
     ========================================================= */
  const participantRows = useMemo(
    () => filterRowsBy(rows, classrooms, null, partF),
    [rows, classrooms, partF]
  );

  const participantRooms = useMemo(() => {
    const groups = new Map();

    participantRows.forEach((row) => {
      if (!row.classroom_id) return;

      const participant = {
        name: row.guest_name || row.profile?.full_name || "—",
        email: row.guest_email || row.profile?.email || "",
        phone: row.guest_phone || row.profile?.phone || ""
      };

      const items = groups.get(row.classroom_id) || [];
      items.push(participant);
      groups.set(row.classroom_id, items);
    });

    const search = normalizedText(partF.q);

    const output = [];

    classrooms.forEach((classroom) => {
      const rawParticipants = groups.get(classroom.id) || [];
      if (!rawParticipants.length) return;

      const unique = [];
      const used = new Set();

      rawParticipants.forEach((participant) => {
        const key =
          normalizedText(participant.email) ||
          normalizedText(participant.phone) ||
          normalizedText(participant.name);

        if (!key || used.has(key)) return;

        used.add(key);
        unique.push(participant);
      });

      const filtered = search
        ? unique.filter((participant) => {
            return (
              normalizedText(participant.name).includes(search) ||
              normalizedText(participant.email).includes(search) ||
              normalizedText(participant.phone).includes(search)
            );
          })
        : unique;

      if (!filtered.length) return;

      const trainer = trainers.find(
        (item) => item.id === classroom.trainer_id
      );

      output.push({
        id: classroom.id,
        code: classroom.code || "—",
        trainer: trainer?.name || "—",
        participants: filtered
      });
    });

    return output.sort((a, b) =>
      String(a.code).localeCompare(String(b.code))
    );
  }, [participantRows, classrooms, trainers, partF.q]);

  /* =========================================================
     Certificate data
     ========================================================= */
  const certificateRows = useMemo(
    () => filterRowsBy(rows, classrooms, null, certF),
    [rows, classrooms, certF]
  );

  const certificateIds = useMemo(
    () => new Set(certificateRows.map((row) => row.id)),
    [certificateRows]
  );

  const certificateAnswers = useMemo(
    () => answersForEvaluations(cleanAnswers, certificateIds),
    [cleanAnswers, certificateIds]
  );

  const certificateRanking = useMemo(
    () =>
      buildRoomRanking(
        certificateAnswers,
        certificateRows,
        classrooms,
        trainers
      ),
    [certificateAnswers, certificateRows, classrooms, trainers]
  );

  const certificateBest = useMemo(() => {
    const min = Number(certF.min || 3);

    return (
      certificateRanking.find((room) => room.count >= min) || null
    );
  }, [certificateRanking, certF.min]);

  /* =========================================================
     Loading state
     ========================================================= */
  if (!mounted || loading) {
    return (
      <div className="rw loading-screen">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="rw" style={{ direction: isAr ? "rtl" : "ltr" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="layout">
        {/* =====================================================
            Sidebar
            ===================================================== */}
        <aside className="side noprint">
          <div className="brand">
            <div className="brand-icon">📊</div>

            <div>
              <div className="brand-title">
                {isAr ? "لوحة ذكاء الأعمال" : "BI Dashboard"}
              </div>

              <div className="brand-sub">
                {isAr ? "النظام المركزي للتحليلات" : "Central Analytics"}
              </div>
            </div>
          </div>

          <button
            className={tab === "dashboard" ? "nav-active" : "nav"}
            onClick={() => setTab("dashboard")}
          >
            <span>{isAr ? "الملخص التنفيذي" : "Executive Summary"}</span>
            <span>🏢</span>
          </button>

          <button
            className={tab === "daily" ? "nav-active" : "nav"}
            onClick={() => setTab("daily")}
          >
            <span>{isAr ? "التقرير اليومي" : "Daily Report"}</span>
            <span>📈</span>
          </button>

          <button
            className={tab === "final" ? "nav-active" : "nav"}
            onClick={() => setTab("final")}
          >
            <span>{isAr ? "التقرير النهائي" : "Final Report"}</span>
            <span>🏁</span>
          </button>

          <button
            className={tab === "participants" ? "nav-active" : "nav"}
            onClick={() => setTab("participants")}
          >
            <span>{isAr ? "سجل المشاركين" : "Participants"}</span>
            <span>👥</span>
          </button>

          <button
            className={tab === "cert" ? "nav-active" : "nav"}
            onClick={() => setTab("cert")}
          >
            <span>{isAr ? "شهادة التميز" : "Certificate"}</span>
            <span>🏆</span>
          </button>

          <div className="side-footer">
            <button
              className="lang-btn"
              onClick={() => setLang(isAr ? "en" : "ar")}
            >
              🌐 {isAr ? "English" : "العربية"}
            </button>

            <button
              className="admin-btn"
              onClick={() => router.push("/admin/management")}
            >
              ⚙️ {isAr ? "الإدارة" : "Admin"}
            </button>
          </div>
        </aside>

        {/* =====================================================
            Main Content
            ===================================================== */}
        <main className="main">
          {/* ===================================================
              Executive Dashboard
              =================================================== */}
          {tab === "dashboard" && (
            <div>
              <section className="hero dark">
                <h1>{isAr ? "الملخص التنفيذي للإدارة العليا" : "Executive Summary"}</h1>
                <p>
                  {isAr
                    ? "قراءة تحليلية لمؤشرات الجودة والرضا ومناطق القلق والتوصيات التنفيذية."
                    : "Analytical view of quality, satisfaction, risk areas, and executive recommendations."}
                </p>
              </section>

              <FiltersBar
                value={dashF}
                onChange={setDashF}
                count={dashRows.length}
                trainers={trainers}
                classrooms={classrooms}
                lang={lang}
              />

              <div className="grid4">
                <MetricCard
                  icon="📝"
                  color={BLUE}
                  title={isAr ? "حجم العينة" : "Sample Size"}
                  value={dashRows.length}
                  sub={isAr ? "استبانة ضمن الفلاتر الحالية" : "Forms in current filters"}
                />

                <MetricCard
                  icon="📊"
                  color={TEAL}
                  title={isAr ? "المتوسط العام" : "Overall Mean"}
                  value={`${dashSummary.mean.toFixed(2)}/5`}
                  sub={isAr ? `الوسيط: ${dashSummary.median.toFixed(2)}` : `Median: ${dashSummary.median.toFixed(2)}`}
                />

                <MetricCard
                  icon="⚠️"
                  color={dashHighRiskCount ? RED : TEAL}
                  title={isAr ? "محاور القلق" : "Risk Areas"}
                  value={dashHighRiskCount}
                  sub={isAr ? "محاور تحتاج تدخلًا أو متابعة" : "Axes requiring action or monitoring"}
                />

                <MetricCard
                  icon="📉"
                  color={ORANGE}
                  title={isAr ? "التقييمات المنخفضة" : "Low Ratings"}
                  value={`${dashSummary.lowPct.toFixed(0)}%`}
                  sub={isAr ? "نسبة تقييمات 1–2 من 5" : "Ratings 1–2 out of 5"}
                />
              </div>

              <div className="grid2">
                <div className="card gauge-card">
                  <div className="gauge-title">
                    {isAr ? "الرضا اليومي" : "Daily Satisfaction"}
                  </div>
                  <GaugeChart score={dashDailySummary.mean} color={BLUE} />
                  <div className="gauge-sub">
                    {isAr ? `استجابات: ${dashDailySummary.respondents}` : `Responses: ${dashDailySummary.respondents}`}
                  </div>
                </div>

                <div className="card gauge-card">
                  <div className="gauge-title">
                    {isAr ? "الرضا النهائي" : "Final Satisfaction"}
                  </div>
                  <GaugeChart score={dashFinalSummary.mean} color={TEAL} />
                  <div className="gauge-sub">
                    {isAr ? `استجابات: ${dashFinalSummary.respondents}` : `Responses: ${dashFinalSummary.respondents}`}
                  </div>
                </div>
              </div>

              <div className="grid2">
                <div className="card">
                  <h3 className="card-title">
                    {isAr ? "📊 توزيع التقييمات" : "📊 Rating Distribution"}
                  </h3>
                  <DistributionChart stats={dashSummary} lang={lang} />
                </div>

                <div className="card">
                  <h3 className="card-title">
                    {isAr ? "📈 اتجاه الرضا - آخر 7 أيام من البيانات" : "📈 Satisfaction Trend - Last 7 Data Days"}
                  </h3>
                  <TrendChart data={dashTrend} lang={lang} color={BLUE} />
                </div>
              </div>

              <InsightsPanel
                items={dashAxis}
                summary={dashSummary}
                lang={lang}
              />

              <RiskTable
                title={isAr ? "🛡️ خريطة المخاطر للمحاور" : "🛡️ Axis Risk Map"}
                items={dashAxis}
                lang={lang}
              />

              <HeatMap data={dashHeatMap} lang={lang} />

              <div className="card">
                <h3 className="card-title">
                  {isAr ? "🏫 ترتيب القاعات حسب الأداء" : "🏫 Room Ranking by Performance"}
                </h3>

                {dashRanking.length ? (
                  dashRanking.map((room, index) => (
                    <div className="room-row" key={room.id}>
                      <div className="room-row-head">
                        <span>
                          {isAr ? "قاعة" : "Room"} {room.code} — {room.trainer}
                        </span>

                        <b className="ltr">
                          {room.avg.toFixed(2)}/5
                        </b>
                      </div>

                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(100, (room.avg / 5) * 100)}%`,
                            background: index === 0 ? TEAL : BLUE
                          }}
                        />
                      </div>

                      <small>
                        {isAr ? `عدد الاستبانات: ${room.count}` : `Forms: ${room.count}`}
                      </small>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    {isAr ? "لا توجد بيانات للقاعات ضمن الفلاتر الحالية." : "No room data for current filters."}
                  </div>
                )}
              </div>

              <div className="data-note">
                {isAr
                  ? "ملاحظة: تم توحيد الإجابات المرتبطة بالأسئلة النصية المكررة داخل الاستبانة نفسها؛ لتقليل أثر التكرار التاريخي على التحليل."
                  : "Note: Duplicate question text within the same evaluation is consolidated to reduce historical duplication bias."}
              </div>
            </div>
          )}

          {/* ===================================================
              Daily Report
              =================================================== */}
          {tab === "daily" && (
            <div>
              <section className="hero blue">
                <div>
                  <h1>{isAr ? "التحليل العميق للحصص اليومية" : "Daily Deep Analysis"}</h1>
                  <p>
                    {isAr
                      ? "تحليل إحصائي لأداء الحصص والمدربين وتجربة المتدرب اليومية."
                      : "Statistical analysis of sessions, trainers, and daily trainee experience."}
                  </p>
                </div>

                <button className="print-btn noprint" onClick={() => window.print()}>
                  🖨️ {isAr ? "طباعة التقرير" : "Print Report"}
                </button>
              </section>

              <FiltersBar
                value={dailyF}
                onChange={setDailyF}
                count={dailyRows.length}
                trainers={trainers}
                classrooms={classrooms}
                lang={lang}
              />

              <div className="grid4">
                <MetricCard
                  icon="📝"
                  color={BLUE}
                  title={isAr ? "الاستبانات" : "Forms"}
                  value={dailySummary.respondents}
                  sub={isAr ? "استجابات يومية صالحة" : "Valid daily responses"}
                />

                <MetricCard
                  icon="📊"
                  color={BLUE}
                  title={isAr ? "المتوسط" : "Mean"}
                  value={`${dailySummary.mean.toFixed(2)}/5`}
                  sub={isAr ? `الوسيط: ${dailySummary.median.toFixed(2)}` : `Median: ${dailySummary.median.toFixed(2)}`}
                />

                <MetricCard
                  icon="↔️"
                  color={ORANGE}
                  title={isAr ? "الانحراف المعياري" : "Std. Deviation"}
                  value={dailySummary.stddev.toFixed(2)}
                  sub={isAr ? "كلما ارتفع زاد تذبذب التجربة" : "Higher value means less consistency"}
                />

                <MetricCard
                  icon="⚠️"
                  color={RED}
                  title={isAr ? "منخفض 1–2" : "Low 1–2"}
                  value={`${dailySummary.lowPct.toFixed(0)}%`}
                  sub={isAr ? "نسبة عدم الرضا" : "Dissatisfaction rate"}
                />
              </div>

              <div className="grid2">
                <div className="card">
                  <h3 className="card-title">
                    {isAr ? "📊 توزيع تقييمات الحصص" : "📊 Session Rating Distribution"}
                  </h3>
                  <DistributionChart stats={dailySummary} lang={lang} />
                </div>

                <div className="card">
                  <h3 className="card-title">
                    {isAr ? "📈 اتجاه الرضا اليومي" : "📈 Daily Satisfaction Trend"}
                  </h3>
                  <TrendChart data={dailyTrend} lang={lang} color={BLUE} />
                </div>
              </div>

              <InsightsPanel
                items={dailyAxis}
                summary={dailySummary}
                lang={lang}
              />

              <RiskTable
                title={isAr ? "🛡️ خريطة مخاطر المحاور اليومية" : "🛡️ Daily Axis Risk Map"}
                items={dailyAxis}
                lang={lang}
              />
            </div>
          )}

          {/* ===================================================
              Final Report
              =================================================== */}
          {tab === "final" && (
            <div>
              <section className="hero green">
                <div>
                  <h1>{isAr ? "التقرير الختامي للبرنامج التدريبي" : "Final Program Report"}</h1>
                  <p>
                    {isAr
                      ? "تحليل رضا المشاركين عن التعليم والخدمات وإدارة البرنامج."
                      : "Analysis of participant satisfaction with education, services, and program management."}
                  </p>
                </div>

                <button className="print-btn noprint" onClick={() => window.print()}>
                  🖨️ {isAr ? "طباعة التقرير" : "Print Report"}
                </button>
              </section>

              <FiltersBar
                value={finalF}
                onChange={setFinalF}
                count={finalRows.length}
                trainers={trainers}
                classrooms={classrooms}
                lang={lang}
              />

              <div className="grid4">
                <MetricCard
                  icon="📝"
                  color={TEAL}
                  title={isAr ? "الاستبانات" : "Forms"}
                  value={finalSummary.respondents}
                  sub={isAr ? "استجابات ختامية صالحة" : "Valid final responses"}
                />

                <MetricCard
                  icon="📊"
                  color={TEAL}
                  title={isAr ? "المتوسط" : "Mean"}
                  value={`${finalSummary.mean.toFixed(2)}/5`}
                  sub={isAr ? `الوسيط: ${finalSummary.median.toFixed(2)}` : `Median: ${finalSummary.median.toFixed(2)}`}
                />

                <MetricCard
                  icon="↔️"
                  color={ORANGE}
                  title={isAr ? "الانحراف المعياري" : "Std. Deviation"}
                  value={finalSummary.stddev.toFixed(2)}
                  sub={isAr ? "تذبذب تجربة المشاركين" : "Participant experience consistency"}
                />

                <MetricCard
                  icon="⚠️"
                  color={RED}
                  title={isAr ? "منخفض 1–2" : "Low 1–2"}
                  value={`${finalSummary.lowPct.toFixed(0)}%`}
                  sub={isAr ? "نسبة عدم الرضا" : "Dissatisfaction rate"}
                />
              </div>

              <div className="grid2">
                <div className="card">
                  <h3 className="card-title">
                    {isAr ? "📊 توزيع تقييمات البرنامج" : "📊 Program Rating Distribution"}
                  </h3>
                  <DistributionChart stats={finalSummary} lang={lang} />
                </div>

                <div className="card">
                  <h3 className="card-title">
                    {isAr ? "📈 اتجاه الرضا الختامي" : "📈 Final Satisfaction Trend"}
                  </h3>
                  <TrendChart data={finalTrend} lang={lang} color={TEAL} />
                </div>
              </div>

              <InsightsPanel
                items={finalAxis}
                summary={finalSummary}
                lang={lang}
              />

              <RiskTable
                title={isAr ? "🛡️ خريطة مخاطر البرنامج" : "🛡️ Program Risk Map"}
                items={finalAxis}
                lang={lang}
              />
            </div>
          )}

          {/* ===================================================
              Participants
              =================================================== */}
          {tab === "participants" && (
            <div>
              <section className="hero purple">
                <h1>{isAr ? "سجل المشاركين" : "Participants Register"}</h1>
                <p>
                  {isAr
                    ? "عرض المشاركين حسب المدرب والقاعة والفترة مع حماية البيانات الحساسة."
                    : "Participants by trainer, room, and period with protected sensitive data."}
                </p>
              </section>

              <FiltersBar
                value={partF}
                onChange={setPartF}
                count={participantRows.length}
                trainers={trainers}
                classrooms={classrooms}
                lang={lang}
                withSearch
              />

              <div className="card noprint participant-toolbar">
                <button
                  className="secondary-btn"
                  onClick={() => setRevealPII((value) => !value)}
                >
                  🔒 {revealPII
                    ? isAr
                      ? "إخفاء البيانات"
                      : "Hide data"
                    : isAr
                    ? "إظهار البيانات"
                    : "Show data"}
                </button>

                <button
                  className="secondary-btn"
                  onClick={() => {
                    const confirmed = window.confirm(
                      isAr
                        ? "سيتم تصدير بيانات المشاركين الشخصية. هل تريد المتابعة؟"
                        : "Personal participant data will be exported. Do you want to continue?"
                    );

                    if (!confirmed) return;

                    const exportRows = [
                      [
                        isAr ? "القاعة" : "Room",
                        isAr ? "المدرب" : "Trainer",
                        isAr ? "الاسم" : "Name",
                        isAr ? "الجوال" : "Phone",
                        isAr ? "البريد الإلكتروني" : "Email"
                      ]
                    ];

                    participantRooms.forEach((room) => {
                      room.participants.forEach((participant) => {
                        exportRows.push([
                          room.code,
                          room.trainer,
                          participant.name,
                          participant.phone,
                          participant.email
                        ]);
                      });
                    });

                    downloadCSV("participants.csv", exportRows);
                  }}
                >
                  ⬇️ {isAr ? "تصدير CSV" : "Export CSV"}
                </button>

                <span className="sample-badge">
                  {isAr ? "القاعات الظاهرة" : "Visible rooms"}: {participantRooms.length}
                </span>
              </div>

              {participantRooms.length ? (
                participantRooms.map((room) => (
                  <div className="card participant-card" key={room.id}>
                    <div className="participant-card-head">
                      <div>
                        <b className="room-title">
                          {isAr ? "قاعة" : "Room"} {room.code}
                        </b>
                        <span>
                          {isAr ? "المدرب:" : "Trainer:"} {room.trainer}
                        </span>
                      </div>

                      <span className="sample-badge">
                        {room.participants.length} {isAr ? "مشارك" : "participants"}
                      </span>
                    </div>

                    <div className="table-wrap">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th className="th">{isAr ? "الاسم" : "Name"}</th>
                            <th className="th">{isAr ? "الجوال" : "Phone"}</th>
                            <th className="th">{isAr ? "البريد الإلكتروني" : "Email"}</th>
                          </tr>
                        </thead>

                        <tbody>
                          {room.participants.map((participant, index) => (
                            <tr key={index}>
                              <td className="td">{participant.name || "—"}</td>
                              <td className="td ltr">
                                {revealPII
                                  ? participant.phone || "—"
                                  : maskPhone(participant.phone)}
                              </td>
                              <td className="td ltr email">
                                {revealPII
                                  ? participant.email || "—"
                                  : maskEmail(participant.email)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              ) : (
                <div className="card">
                  <div className="empty-state">
                    {isAr ? "لا توجد بيانات مشاركين ضمن الفلاتر الحالية." : "No participants for current filters."}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================================================
              Certificate
              =================================================== */}
          {tab === "cert" && (
            <div>
              <section className="hero gold noprint">
                <h1>{isAr ? "شهادة التميز" : "Certificate of Excellence"}</h1>
                <p>
                  {isAr
                    ? "اختيار أفضل قاعة ومدرب وفقًا لمتوسط الأداء وحجم العينة."
                    : "Select the best room and trainer based on average performance and sample size."}
                </p>
              </section>

              <FiltersBar
                value={certF}
                onChange={setCertF}
                count={certificateRows.length}
                trainers={trainers}
                classrooms={classrooms}
                lang={lang}
                withMin
              />

              {certificateBest ? (
                <section className="certificate">
                  <div className="certificate-inner">
                    <div className="certificate-icon">🏆</div>

                    <h1>
                      {isAr ? "شهادة تميز وإشادة" : "Certificate of Excellence"}
                    </h1>

                    <p className="certificate-sub">
                      {isAr
                        ? "تُمنح هذه الشهادة تقديرًا للأداء المتميز وجودة التجربة التدريبية"
                        : "This certificate is awarded in recognition of outstanding performance and training quality."}
                    </p>

                    <div className="certificate-name">
                      {certificateBest.trainer}
                    </div>

                    <p className="certificate-text">
                      {isAr
                        ? `حقق أعلى متوسط أداء في قاعة ${certificateBest.code}`
                        : `Achieved the highest performance average in room ${certificateBest.code}`}
                    </p>

                    <div className="certificate-score">
                      <b className="ltr">{certificateBest.avg.toFixed(2)}/5</b>
                    </div>

                    <p className="certificate-meta">
                      {isAr
                        ? `عدد الاستبانات المعتمدة: ${certificateBest.count}`
                        : `Valid forms: ${certificateBest.count}`}
                    </p>

                    <div className="certificate-footer">
                      <span>
                        {isAr ? "إدارة الجودة والتقييم" : "Quality & Evaluation Department"}
                      </span>

                      <span>
                        {new Intl.DateTimeFormat(
                          isAr ? "ar-SA" : "en-US",
                          { year: "numeric", month: "long", day: "numeric" }
                        ).format(new Date())}
                      </span>
                    </div>

                    <button
                      className="print-btn noprint"
                      onClick={() => window.print()}
                    >
                      🖨️ {isAr ? "طباعة الشهادة" : "Print Certificate"}
                    </button>
                  </div>
                </section>
              ) : (
                <div className="card">
                  <div className="empty-state">
                    {isAr
                      ? "لا توجد بيانات كافية لإصدار شهادة وفق الحد الأدنى المحدد للاستجابات."
                      : "There is not enough data to issue a certificate based on the selected minimum responses."}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* =========================================================
   CSS
   ========================================================= */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');

* { box-sizing: border-box; }

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

body {
  margin: 0;
  background: #f4f6f8;
}

.rw {
  min-height: 100vh;
  background: #f4f6f8;
  padding: 24px;
  font-family: Tajawal, Arial, sans-serif;
  color: #0f172a;
}

.loading-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f172a;
}

.spinner {
  width: 64px;
  height: 64px;
  border: 6px solid rgba(255,255,255,.14);
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.layout {
  display: flex;
  gap: 24px;
}

.side {
  width: 300px;
  flex-shrink: 0;
  background: linear-gradient(145deg, #0b1220, #172554);
  border-radius: 24px;
  padding: 24px;
  color: #fff;
  position: sticky;
  top: 24px;
  height: fit-content;
  box-shadow: 0 18px 45px rgba(15, 23, 42, .18);
}

.main {
  flex: 1;
  min-width: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
}

.brand-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #10b981, #0d9488);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.brand-title {
  font-size: 18px;
  font-weight: 900;
}

.brand-sub {
  color: #94a3b8;
  font-size: 12px;
  margin-top: 3px;
}

.nav,
.nav-active {
  width: 100%;
  border: 0;
  border-radius: 14px;
  padding: 14px 18px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  font-family: inherit;
  font-weight: 800;
  font-size: 15px;
  transition: .2s ease;
}

.nav {
  background: rgba(255,255,255,.04);
  color: #cbd5e1;
}

.nav:hover {
  background: rgba(255,255,255,.10);
  color: #fff;
}

.nav-active {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
  box-shadow: 0 10px 24px rgba(16, 185, 129, .25);
}

.side-footer {
  border-top: 1px solid rgba(255,255,255,.12);
  padding-top: 16px;
  margin-top: 24px;
}

.lang-btn,
.admin-btn {
  width: 100%;
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 800;
  margin-bottom: 8px;
}

.lang-btn {
  border: 0;
  color: #fff;
  background: rgba(255,255,255,.10);
}

.admin-btn {
  color: #cbd5e1;
  background: transparent;
  border: 1px solid #334155;
}

.hero {
  border-radius: 24px;
  padding: 30px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.hero h1 {
  margin: 0 0 8px;
  font-size: 32px;
  font-weight: 900;
}

.hero p {
  margin: 0;
  font-weight: 600;
}

.hero.dark {
  color: #fff;
  background: linear-gradient(135deg, #0f172a, #1e293b);
}

.hero.dark p { color: #94a3b8; }

.hero.blue {
  color: #2563eb;
  background: #fff;
  border-inline-start: 6px solid #2563eb;
}

.hero.green {
  color: #059669;
  background: #fff;
  border-inline-start: 6px solid #10b981;
}

.hero.purple {
  color: #7c3aed;
  background: #fff;
  border-inline-start: 6px solid #7c3aed;
}

.hero.gold {
  color: #d97706;
  background: #fff;
  border-inline-start: 6px solid #d97706;
}

.hero.blue p,
.hero.green p,
.hero.purple p,
.hero.gold p {
  color: #64748b;
}

.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  padding: 26px;
  margin-bottom: 20px;
  box-shadow: 0 8px 28px rgba(15, 23, 42, .035);
}

.card-title {
  margin: 0 0 10px;
  font-size: 19px;
  font-weight: 900;
}

.card-description {
  color: #64748b;
  margin: 0 0 18px;
  font-size: 14px;
  font-weight: 600;
}

.grid2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.grid4 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.metric-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-bottom: 5px solid #2563eb;
  padding: 22px;
  border-radius: 22px;
  min-height: 150px;
  box-shadow: 0 8px 28px rgba(15, 23, 42, .035);
}

.metric-top {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
  font-weight: 900;
}

.metric-icon { font-size: 18px; }

.metric-title { font-size: 14px; }

.metric-value {
  font-size: 34px;
  font-weight: 900;
  margin-top: 14px;
  direction: ltr;
  unicode-bidi: plaintext;
}

.metric-sub {
  color: #94a3b8;
  font-size: 12px;
  margin-top: 7px;
  font-weight: 700;
}

.gauge-card {
  text-align: center;
  min-height: 190px;
}

.gauge-title {
  color: #64748b;
  font-size: 15px;
  font-weight: 900;
  margin-bottom: 14px;
}

.gauge-sub {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 800;
  margin-top: 10px;
}

.filter-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.sample-badge {
  background: #eef2ff;
  color: #3730a3;
  padding: 6px 11px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(155px, 1fr));
  gap: 12px;
}

.sel,
.inp,
.reset-btn {
  width: 100%;
  border-radius: 12px;
  padding: 12px;
  font-family: inherit;
  font-weight: 800;
  outline: none;
}

.sel,
.inp {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #0f172a;
}

.sel:focus,
.inp:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, .12);
}

.reset-btn {
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
  cursor: pointer;
}

.reset-btn:hover {
  background: #e2e8f0;
}

.distribution-bar {
  height: 22px;
  width: 100%;
  display: flex;
  overflow: hidden;
  border-radius: 999px;
  background: #f1f5f9;
  margin: 22px 0;
}

.distribution-list {
  display: grid;
  gap: 10px;
}

.distribution-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #334155;
  font-size: 14px;
  font-weight: 800;
}

.insight-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.insight-box {
  padding: 18px;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
}

.insight-box h4 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 900;
}

.insight-box.danger {
  background: #fff7f7;
  border-color: #fecaca;
}

.insight-box.success {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.insight-row {
  display: grid;
  gap: 5px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(148, 163, 184, .22);
}

.insight-row:last-child { border-bottom: 0; }

.insight-row span {
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

.insight-row small {
  color: #64748b;
  line-height: 1.7;
}

.confidence-note {
  margin-top: 16px;
  background: #f8fafc;
  border-radius: 12px;
  padding: 12px;
  color: #475569;
  font-size: 13px;
  line-height: 1.7;
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

.tbl,
.heat-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 900px;
}

.th {
  padding: 14px;
  font-weight: 900;
  font-size: 13px;
  color: #64748b;
  border-bottom: 2px solid #eef2f6;
  text-align: start;
  white-space: nowrap;
}

.td {
  padding: 14px;
  font-size: 13px;
  border-bottom: 1px solid #f1f5f9;
  font-weight: 700;
  vertical-align: top;
}

.axis-name {
  min-width: 150px;
  color: #0f172a;
  font-weight: 900;
}

.recommendation {
  min-width: 290px;
  color: #475569;
  line-height: 1.7;
}

.risk-badge {
  display: inline-block;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.ltr {
  direction: ltr;
  unicode-bidi: plaintext;
}

.email { color: #2563eb; }

.room-row {
  margin-bottom: 17px;
}

.room-row-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-weight: 800;
  margin-bottom: 7px;
}

.room-row small {
  color: #94a3b8;
  font-weight: 700;
  font-size: 12px;
}

.progress-track {
  width: 100%;
  height: 9px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 6px;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width .6s ease;
}

.heat-table {
  min-width: 720px;
}

.heat-table th {
  border-bottom: 2px solid #e2e8f0;
  padding: 12px;
  color: #64748b;
  text-align: center;
  font-size: 13px;
}

.heat-table td {
  border-bottom: 1px solid #f1f5f9;
  padding: 12px;
  text-align: center;
}

.heat-axis {
  text-align: start !important;
  min-width: 180px;
  color: #0f172a;
  font-weight: 900;
}

.heat-cell {
  display: inline-flex;
  min-width: 58px;
  justify-content: center;
  padding: 8px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 900;
  direction: ltr;
}

.participant-toolbar {
  padding: 16px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
}

.secondary-btn,
.print-btn {
  border: 0;
  border-radius: 12px;
  padding: 12px 16px;
  font-family: inherit;
  font-weight: 900;
  cursor: pointer;
}

.secondary-btn {
  background: #fff;
  color: #0f172a;
  border: 1px solid #cbd5e1;
}

.print-btn {
  background: #0f172a;
  color: #fff;
  white-space: nowrap;
}

.participant-card {
  padding: 0;
  overflow: hidden;
}

.participant-card-head {
  padding: 16px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.participant-card-head > div {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  color: #64748b;
  font-weight: 800;
}

.room-title {
  color: #10b981;
  font-size: 18px;
}

.certificate {
  background: linear-gradient(135deg, #fffbeb, #fef3c7);
  border: 4px solid #d97706;
  border-radius: 24px;
  padding: 12px;
  text-align: center;
}

.certificate-inner {
  background: rgba(255,255,255,.78);
  border: 2px solid #0f172a;
  border-radius: 16px;
  padding: 48px 30px;
}

.certificate-icon {
  font-size: 52px;
  margin-bottom: 8px;
}

.certificate h1 {
  color: #d97706;
  font-size: 42px;
  margin: 0 0 12px;
  font-weight: 900;
}

.certificate-sub {
  color: #64748b;
  font-size: 17px;
  font-weight: 700;
}

.certificate-name {
  color: #10b981;
  font-weight: 900;
  font-size: 45px;
  margin: 30px 0 16px;
}

.certificate-text {
  color: #334155;
  font-size: 20px;
  font-weight: 800;
}

.certificate-score {
  color: #d97706;
  font-size: 32px;
  margin: 12px 0;
}

.certificate-meta {
  color: #64748b;
  font-weight: 800;
}

.certificate-footer {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  color: #475569;
  font-weight: 800;
  margin-top: 46px;
  padding-top: 16px;
  border-top: 1px solid #cbd5e1;
}

.empty-state {
  color: #94a3b8;
  text-align: center;
  padding: 35px 15px;
  font-weight: 800;
}

.data-note {
  border-radius: 14px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  padding: 14px;
  line-height: 1.8;
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 1150px) {
  .grid4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 950px) {
  .rw { padding: 14px; }

  .layout { flex-direction: column; }

  .side {
    width: 100%;
    position: static;
  }

  .grid2,
  .grid4,
  .insight-grid {
    grid-template-columns: 1fr;
  }

  .hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .certificate h1 { font-size: 30px; }

  .certificate-name { font-size: 32px; }

  .certificate-footer {
    flex-direction: column;
    align-items: center;
  }
}

@media print {
  .noprint,
  .side {
    display: none !important;
  }

  .rw {
    padding: 0;
    background: #fff;
  }

  .layout {
    display: block;
  }

  .card,
  .certificate {
    box-shadow: none !important;
    break-inside: avoid;
  }

  .main {
    width: 100%;
  }
}
`;
