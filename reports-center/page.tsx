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
.tab-on { background: #10b981; color: #fff; border: none; border-radius: 12px; padding: 11px 16px; cursor: pointer; font-weight: 800; font-size: 13.5px; width: 100%; display: flex; align-items: center; justify-content: flex-end; gap: 10px; transition: .2s; border: 1px solid #10b981; }
.tab-off { background: transparent; color: #94a3b8; border: 1px solid transparent; border-radius: 12px; padding: 11px 16px; cursor: pointer; font-weight: 600; font-size: 13.5px; width: 100%; display: flex; align-items: center; justify-content: flex-end; gap: 10px; transition: .2s; }
.tab-off:hover { color: #f1f5f9; background: rgba(255,255,255,0.03); }
.inp { background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 11px 14px; color: #1e293b; font-size: 13.5px; fontFamily: inherit; outline: none; width: 100%; transition: .2s; margin-bottom: 10px; }
.inp:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }
.tbl { width: 100%; border-collapse: collapse; margin-top: 10px; }
.th { padding: 12px; text-align: right; font-weight: 700; font-size: 13px; color: #64748b; border-bottom: 2px solid #eef2f6; }
.td { padding: 14px 12px; font-size: 13.5px; border-bottom: 1px solid #f1f5f9; }
@media(max-width:920px){ .lay { flex-direction: column; } .side { width: 100%; position: static; } .g2, .g3, .k3 { grid-template-columns: 1fr; } }
@media print { .side, .np { display: none !important; } .lay { display: block; } .card { box-shadow: none !important; border: 1px solid #cbd5e1 !important; } }
`;

type Ev = { id: string; kind: string; overall_rating: number | null; submitted_at: string; classroom_id: string | null };
type An = { evaluation_id: string; question_id: string; rating_value: number | null; text_value: string | null };
type Qu = { id: string; text_ar: string; section_ar: string | null };
type Ax = { label: string; section: string; value: number };
type Day = { wd: string; dt: string; count: number };
type Rep = { count: number; avg: number; axes: Ax[]; comments: string[]; dist: number[]; days: Day[]; sections: { name: string; value: number }[] };

const TEAL = "#10b981";
const DARK = "#0b1220";

function statusOf(v: number): { t: string; bg: string; fg: string } {
  const val = Number(v) || 0;
  if (val >= 4) return { t: "ممتاز", bg: "#d1fae5", fg: "#047857" };
  if (val >= 3) return { t: "جيد", bg: "#fef3c7", fg: "#b45309" };
  return { t: "يحتاج تحسين", bg: "#fee2e2", fg: "#b91c1c" };
}

function pad(n: number): string { return n < 10 ? "0" + n : "" + n; }

export default function ReportsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<Ev[]>([]);
  const [ans, setAns] = useState<An[]>([]);
  const [qs, setQs] = useState<Qu[]>([]);
  
  // بيانات الهيكلة الجديدة
  const [programs, setPrograms] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [trainers, setTrainers] = useState([]);

  const [load, setLoad] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("dashboard");

  const db = supabase();

  const fetchAllData = async () => {
    try {
      const [e, a, q, progs, roomsList, trainersList] = await Promise.all([
        db.from("evaluations").select("*").order("submitted_at", { ascending: false }),
        db.from("evaluation_answers").select("*"),
        db.from("questions").select("*"),
        db.from("programs").select("*").order("name"),
        db.from("classrooms").select("*").order("code"),
        db.from("trainers").select("*").order("name"),
      ]);

      setRows(e.data || []);
      setAns(a.data || []);
      setQs(q.data || []);
      setPrograms(progs.data || []);
      setClassrooms(roomsList.data || []);
      setTrainers(trainersList.data || []);
    } catch (x: any) {
      setErr(x.message || "حدث خطأ في تحميل البيانات الهيكلية");
    }
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
  }, []);

  // ==========================================
  // معالجة بيانات التقارير والتحليلات الآمنة ضد الانهيار
  // ==========================================
  const calc = (kind: "DAILY" | "FINAL"): Rep => {
    const list = (rows || []).filter(r => r && r.kind === kind);
    const ids = new Set(list.map(r => r.id));
    const qm: Record<string, Qu> = {}; (qs || []).forEach(q => { if (q) qm[q.id] = q; });
    const avg = (a: number[]) => a.length ? a.reduce((p, c) => p + c, 0) / a.length : 0;
    
    const g: Record<string, number[]> = {};
    (ans || []).forEach(a => {
      if (a && ids.has(a.evaluation_id) && a.rating_value != null) {
        const v = Number(a.rating_value);
        if (!isNaN(v)) { (g[a.question_id] = g[a.question_id] || []).push(v); }
      }
    });

    const axes: Ax[] = Object.keys(g).map(id => ({
      label: qm[id] ? qm[id].text_ar : "سؤال التقييم",
      section: qm[id] && qm[id].section_ar ? qm[id].section_ar : "عام",
      value: avg(g[id])
    })).sort((a, b) => b.value - a.value);

    const dist = [0, 0, 0, 0, 0];
    list.forEach(r => {
      if (!r) return;
      const v = Math.round(Number(r.overall_rating));
      if (v >= 1 && v <= 5) dist[v - 1] += 1;
    });

    const dayMap: any = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      dayMap[key] = { wd: d.toLocaleDateString("ar-SA", { weekday: "long" }), dt: pad(d.getMonth() + 1) + "-" + pad(d.getDate()), count: 0 };
    }
    
    list.forEach(r => {
      if (!r || !r.submitted_at) return;
      const d = new Date(r.submitted_at);
      if (isNaN(d.getTime())) return;
      const key = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      if (dayMap[key]) dayMap[key].count += 1;
    });
    const days: Day[] = Object.keys(dayMap).map(k => dayMap[k]);

    const sm: any = {};
    axes.forEach(a => {
      if (!a) return;
      if (!sm[a.section]) sm[a.section] = { s: 0, n: 0 };
      sm[a.section].s += a.value;
      sm[a.section].n += 1;
    });
    const sections = Object.keys(sm).map(k => ({ name: k, value: sm[k].s / sm[k].n })).sort((a, b) => b.value - a.value).slice(0, 4);

    const comments: string[] = [];
    (ans || []).forEach(a => {
      if (a && ids.has(a.evaluation_id) && a.text_value && a.text_value.trim() && comments.length < 6) {
        comments.push(a.text_value.trim());
      }
    });

    const all = list.map(r => r && Number(r.overall_rating)).filter(v => v !== null && v !== undefined && !isNaN(v) && v > 0);
    return { count: list.length, avg: avg(all), axes, comments, dist, days, sections };
  };

  const daily = useMemo(() => calc("DAILY"), [rows, ans, qs]);
  const final = useMemo(() => calc("FINAL"), [rows, ans, qs]);

  // ==========================================
  // هيكلة تقرير أداء المدربين الفردي المرتبط بالقاعات والبرامج
  // ==========================================
  const teacherPerformance = useMemo(() => {
    return (trainers || []).map(t => {
      if (!t || !t.id) return null;
      const myRooms = (classrooms || []).filter(c => c && c.trainer_id === t.id);
      const roomIds = new Set(myRooms.map(c => c && c.id).filter(Boolean));
      
      const myEvals = (rows || []).filter(r => r && r.classroom_id && roomIds.has(r.classroom_id));
      const evalIds = new Set(myEvals.map(e => e.id));
      const avg = (a: number[]) => a.length ? a.reduce((p, c) => p + c, 0) / a.length : 0;

      const clarityScores: number[] = [];
      const teachScores: number[] = [];
      const driveScores: number[] = [];

      (ans || []).forEach(a => {
        if (!a || !evalIds.has(a.evaluation_id)) return;
        const v = Number(a.rating_value);
        if (isNaN(v)) return;
        const q = (qs || []).find(x => x && x.id === a.question_id);
        if (!q) return;

        const text = q.text_ar || "";
        if (text.includes("وضوح") || text.includes("شرح")) clarityScores.push(v);
        else if (text.includes("أسلوب") || text.includes("تدريس")) teachScores.push(v);
        else if (text.includes("دافعيتك") || text.includes("تفاعلك")) driveScores.push(v);
      });

      const overall = myEvals.map(r => r && Number(r.overall_rating)).filter(v => v !== null && v !== undefined && !isNaN(v) && v > 0);

      return {
        id: t.id,
        name: t.name,
        specialization: t.specialization || "لغويات",
        rooms: myRooms.map(r => r.code).join("، ") || "لم تُحدد قاعة",
        levels: Array.from(new Set(myRooms.map(r => r.level).filter(Boolean))).join("، ") || "—",
        count: myEvals.length,
        avg: avg(overall),
        clarity: avg(clarityScores),
        teach: avg(teachScores),
        drive: avg(driveScores)
      };
    }).filter(Boolean).sort((a, b) => b.avg - a.avg);
  }, [trainers, classrooms, rows, ans, qs]);

  const bestTeacher = useMemo(() => {
    const valid = (teacherPerformance || []).filter(t => t && t.count > 0);
    return valid.length > 0 ? valid[0] : null;
  }, [teacherPerformance]);

  if (!mounted || load) {
    return (
      <div className="rw" style={S.loading}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={S.spinner}></div>
        <p>جارٍ تحميل لوحة جودة الأداء والتحليلات...</p>
      </div>
    );
  }

  return (
    <div className="rw" style={S.wrap}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lay">
        
        {/* القائمة الجانبية الفاخرة للتحكم بالأقسام */}
        <aside className="side np">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#10b981,#0d9488)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🏆</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15 }}>لوحة الأداء والجودة</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>النظام المركزي الموحد</div>
            </div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button className={tab === "dashboard" ? "tab-on" : "tab-off"} onClick={() => setTab("dashboard")}><span>🏠 نظرة شاملة</span></button>
            <button className={tab === "daily" ? "tab-on" : "tab-off"} onClick={() => setTab("daily")}><span>📝 التقرير اليومي</span></button>
            <button className={tab === "final" ? "tab-on" : "tab-off"} onClick={() => setTab("final")}><span>⭐ التقرير النهائي</span></button>
            <button className={tab === "teachers" ? "tab-on" : "tab-off"} onClick={() => setTab("teachers")}><span>👨‍🏫 تقييم المعلمين والقاعات</span></button>
          </div>

          <div style={{ marginTop: 18, borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 14 }}>
            <button onClick={() => router.push("/admin/management")} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1", cursor: "pointer", padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🏫 إدارة القاعات والمدربين</button>
            <button onClick={() => router.push("/dashboard")} style={{ width: "100%", background: "transparent", border: "none", color: "#64748b", cursor: "pointer", textAlign: "right", padding: "8px 10px", fontSize: 13, fontWeight: 600 }}>← لوحة التحكم العامة</button>
          </div>
        </aside>

        {/* منطقة المحتوى المركزية */}
        <div className="main">
          
          {/* ترويسة الصفحة التنفيذية المقتبسة من مرجعك الفاخر */}
          <div style={S.headerCard}>
            <div style={S.headerBgText}>REPORT</div>
            <div style={{ position: "relative" }}>
              <span style={S.headerBadge}>تقرير الأداء السنوي والتحليلي المطور</span>
              <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>{tab === "dashboard" ? "التقرير العام المتكامل" : tab === "teachers" ? "أداء المعلمين المرتبط بالقاعة" : `تقييم ${tab === "daily" ? "الحصة اليومية" : "البرنامج النهائي"}`}</h1>
              <p style={{ color: "#94a3b8", margin: "4px 0 0", fontSize: 13 }}>توليد تلقائي فوري لمعايير الجودة والامتثال والرضا والتقييم الفردي</p>
            </div>
          </div>

          {/* 1. التبويب العام للوحة الشاملة */}
          {tab === "dashboard" && <Overview daily={daily} final={final} classrooms={classrooms} best={bestTeacher} />}

          {/* 2. تقرير الحصة اليومية */}
          {tab === "daily" && <ReportView rep={daily} accent="#2563eb" name="التقرير اليومي المطور" sub="تحليل وتقييم جلسات التدريب اليومية وتفاعل الحضور" />}

          {/* 3. تقرير البرنامج النهائي */}
          {tab === "final" && <ReportView rep={final} accent="#10b981" name="التقرير النهائي للبرنامج" sub="مؤشر رضا المستفيدين الأكاديمي الشامل عن البرنامج ككل" />}

          {/* 4. تقرير أداء المعلمين والقاعات */}
          {tab === "teachers" && <TeachersView data={teacherPerformance} best={bestTeacher} />}

        </div>
      </div>
    </div>
  );
}

// ==========================================
// المكونات الفرعية التفاعلية للوحة القيادة
// ==========================================
function Overview(p: { daily: Rep; final: Rep; classrooms: any[]; best: any }) {
  const d = p.daily; const f = p.final;
  const max = Math.max(5, d.avg, f.avg);
  return (
    <div>
      <div className="k3" style={{ marginBottom: 16 }}>
        <KpiCard label="إجمالي الاستجابات الحية" value={d.count + f.count} suffix=" استمارة" ghost={String(d.count + f.count)} />
        <KpiCard label="معدل الرضا اليومي" value={d.avg ? d.avg.toFixed(2) : "—"} suffix="/5" ghost={d.avg ? d.avg.toFixed(1) : "—"} />
        <KpiCard label="معدل الرضا النهائي" value={f.avg ? f.avg.toFixed(2) : "—"} suffix="/5" ghost={f.avg ? f.avg.toFixed(1) : "—"} />
      </div>

      <div className="g2">
        <Card>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>⚖️ مقارنة أداء الرضا الأكاديمي</h3>
          <svg viewBox="0 0 300 180" style={{ width: "100%", height: "auto" }}>
            {[0, 0.5, 1].map((fr, i) => { const y = 20 + 120 * (1 - fr); return (<g key={i}><line x1={40} y1={y} x2={280} y2={y} stroke="#ece4d4" strokeDasharray="3,3" /><text x={34} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{(max * fr).toFixed(1)}</text></g>); })}
            <g><rect x={80} y={140 - (d.avg / max) * 120} width={45} height={(d.avg / max) * 120} rx={6} fill="#2563eb" /><text x={102} y={140 - (d.avg / max) * 120 - 8} textAnchor="middle" fontSize="13" fontWeight="900" fill="#111">{d.avg ? d.avg.toFixed(2) : "—"}</text><text x={102} y={158} textAnchor="middle" fontSize="11" fill="#475569" fontWeight="700">اليومي</text></g>
            <g><rect x={175} y={140 - (f.avg / max) * 120} width={45} height={(f.avg / max) * 120} rx={6} fill="#10b981" /><text x={197} y={140 - (f.avg / max) * 120 - 8} textAnchor="middle" fontSize="13" fontWeight="900" fill="#111">{f.avg ? f.avg.toFixed(2) : "—"}</text><text x={197} y={158} textAnchor="middle" fontSize="11" fill="#475569" fontWeight="700">النهائي</text></g>
            <line x1={40} y1={140} x2={280} y2={140} stroke="#d6cdba" strokeWidth={1.5} />
          </svg>
        </Card>

        {p.best ? (
          <div style={S.bestCard}>
            <span style={{ fontSize: 44 }}>🏆</span>
            <span style={{ fontSize: 11, color: "#10b981", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5 }}>عضو هيئة التدريس الأكثر تميزاً</span>
            <h2 style={{ fontSize: 24, fontWeight: 900, margin: "6px 0 2px", color: "#fff" }}>{p.best.name || "—"}</h2>
            <p style={{ color: "#94a3b8", fontSize: 12, margin: "0 0 12px" }}>قاعة {p.best.rooms || "—"} ({p.best.levels || "—"})</p>
            <div style={{ background: "rgba(16,185,129,.15)", border: "1px solid #10b981", borderRadius: 12, padding: "8px 20px" }}>
              <span style={{ fontSize: 13, color: "#5eead4", fontWeight: 700 }}>متوسط التقييم العام: {p.best.avg ? p.best.avg.toFixed(2) : "0.00"} / 5</span>
            </div>
          </div>
        ) : (
          <Card><p style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>لا توجد تقييمات مسجلة للمدربين بعد.</p></Card>
        )}
      </div>
    </div>
  );
}

function ReportView(p: { rep: Rep; accent: string; name: string; sub: string }) {
  const r = p.rep;
  const pct = r.avg ? Math.round((r.avg / 5) * 100) : 0;
  const top = r.axes.length ? r.axes[r.axes.length - 1] : null;
  const low = r.axes.length ? r.axes[0] : null;
  const maxDi = Math.max(1, ...(r.dist || [1]));
  const dColors = ["#f43f5e", "#fb923c", "#facc15", "#34d399", "#10b981"];
  const daysLen = r.days && r.days.length ? r.days.length : 1;
  const bw = 360 / daysLen;
  const maxD = Math.max(1, ...(r.days || []).map((d: any) => d?.count || 0));
  return (
    <div>
      <div className="k3" style={{ marginBottom: 16 }}>
        <KpiCard label="إجمالي الاستجابات" value={r.count} suffix=" استمارة" ghost={String(r.count)} />
        <KpiCard label="متوسط الرضا العام" value={r.avg ? r.avg.toFixed(2) : "—"} suffix="/5" ghost={r.avg ? r.avg.toFixed(1) : "—"} />
        <KpiCard label="نسبة الرضا المئوية" value={pct} suffix="%" ghost={String(pct)} />
      </div>

      <div className="g2" style={{ marginBottom: 16 }}>
        <Card>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>🎯 توزيع التقييم الإجمالي بالنجوم</h3>
          {[5, 4, 3, 2, 1].map(s => {
            const idx = s - 1;
            const distVal = r.dist && r.dist[idx] ? r.dist[idx] : 0;
            const w = maxDi > 0 ? (distVal / maxDi) * 100 : 0;
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ width: 55, fontSize: 11, fontWeight: 700, color: "#7c6f5a" }}>{s} نجوم</span>
                <div style={{ flex: 1, height: 11, background: "#f0e9db", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ width: (isNaN(w) ? 0 : w) + "%", height: "100%", background: dColors[idx], borderRadius: 8 }} />
                </div>
                <b style={{ width: 20, textAlign: "left", fontSize: 12 }}>{distVal}</b>
              </div>
            );
          })}
        </Card>

        <Card>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>💡 التحليل الذكي والتوصيات</h3>
          <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 12, padding: 12, marginBottom: 10 }}><b style={{ color: "#047857", fontSize: 13 }}>✅ نقطة القوة المتميزة</b><p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#334155" }}>{top ? top.label + " (" + top.value.toFixed(2) + "/5)" : "—"}</p></div>
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: 12 }}><b style={{ color: "#b45309", fontSize: 13 }}>🎯 مجال التطوير المستهدف</b><p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#334155" }}>{low ? low.label + " (" + low.value.toFixed(2) + "/5)" : "—"}</p></div>
        </Card>
      </div>

      <div className="g2" style={{ marginBottom: 16 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📊 التوزيع اليومي</h3><span style={{ background: "#d1fae5", color: "#047857", borderRadius: 999, padding: "3px 12px", fontSize: 11, fontWeight: 800 }}>7 أيام</span></div>
          <svg viewBox="0 0 360 180" style={{ width: "100%", height: "auto" }}>
            <defs><linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#0d9488"/></linearGradient></defs>
            {(r.days || []).map((d, i) => {
              const x = i * bw + bw * 0.22;
              const w = bw * 0.56;
              const h = (d.count / maxD) * 120;
              const y = 140 - h;
              return (
                <g key={i}>
                  <text x={x + w / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="800" fill="#111">{d.count}</text>
                  <rect x={x} y={y} width={w} height={Math.max(4, h)} rx={6} fill="url(#chartGrad)" />
                  <text x={x + w / 2} y={156} textAnchor="middle" fontSize="9" fill="#64748b">{d.wd}</text>
                  <text x={x + w / 2} y={170} textAnchor="middle" fontSize="9" fill="#94a3b8">{d.dt}</text>
                </g>
              );
            })}
          </svg>
        </Card>
        
        <Card>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>⚖️ مقارنة المحاور الأساسية</h3>
          {(r.sections || []).length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {r.sections.map((s, i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid #ece4d4", borderRadius: 14, padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: "#9a8f7d", fontWeight: 700, marginBottom: 6 }}>{s.name}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#10b981" }}>{s.value.toFixed(1)}</div>
                </div>
              ))}
            </div>
          ) : <p style={{ color: "#9a8f7d", textAlign: "center", padding: 20 }}>لا توجد أقسام مسجلة.</p>}
        </Card>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>📈 نتائج أداء المحاور التفصيلي</h3>
        {r.axes.length > 0 ? r.axes.map((a, i) => {
          if (!a) return null;
          const s = statusOf(a.value);
          return (
            <div key={i} style={S.axisRow}>
              <div style={S.axisMeta}>
                <div style={S.axisLabelWrap}><span style={S.secTag}>{a.section}</span><span style={{ fontSize: 13.5, fontWeight: 700 }}>{a.label}</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ ...S.statusPill, background: s.bg, color: s.fg }}>{s.t}</span><b style={{ minWidth: 50, textAlign: "left", color: p.accent, fontSize: 15 }}>{a.value.toFixed(2)}/5</b></div>
              </div>
              <div style={S.track}><div style={{ ...S.fillGrad, width: (a.value / 5 * 100) + "%", background: "linear-gradient(90deg," + p.accent + ",#10b981)" }} /></div>
            </div>
          );
        }) : <p style={{ color: "#9a8f7d", textAlign: "center", padding: 20 }}>لا توجد بيانات لهذا التبويب حالياً.</p>}
      </Card>

      <Card>
        <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>💬 ملاحظات ومرئيات المشاركين النصية</h3>
        {r.comments.length > 0 ? r.comments.map((c, i) => (
          <div key={i} style={S.commentCard}>{c}</div>
        )) : <p style={{ color: "#9a8f7d", textAlign: "center", padding: 20 }}>لا توجد تعليقات أو ملاحظات نصية مسجلة.</p>}
      </Card>
    </div>
  );
}

function TeachersView(p: { data: any[]; best: any }) {
  const teacherList = p.data || [];
  return (
    <div>
      {p.best && (
        <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", borderRadius: 22, padding: 20, color: "#fff", marginBottom: 16, display: "flex", alignItems: "center", gap: 16, border: "1px solid #10b981" }}>
          <span style={{ fontSize: 40 }}>🏆</span>
          <div>
            <div style={{ fontSize: 11, color: "#10b981", fontWeight: 800 }}>عضو هيئة التدريس الأعلى أداءً بالقاعات</div>
            <h3 style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 900 }}>{p.best.name || "—"}</h3>
            <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>متوسط التقييم العام: {p.best.avg ? p.best.avg.toFixed(2) : "0.00"}/5 (إجمالي الاستجابات: {p.best.count} تقييم)</p>
          </div>
        </div>
      )}

      <Card>
        <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>📋 ترتيب المعلمين ومقارنة الأداء الأكاديمي المباشر</h3>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th className="th">الترتيب</th>
                <th className="th">المعلم / المحاضر</th>
                <th className="th">القاعة</th>
                <th className="th">المستوى</th>
                <th className="th">الاستجابات</th>
                <th className="th">وضوح الشرح</th>
                <th className="th">أسلوب التدريس</th>
                <th className="th">تفاعل الطلاب</th>
                <th className="th">المعدل العام</th>
                <th className="th">الحالة الأكاديمية</th>
              </tr>
            </thead>
            <tbody>
              {teacherList.map((t, idx) => {
                if (!t) return null;
                const s = statusOf(t.avg || 0);
                return (
                  <tr key={t.id || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td className="td" style={{ fontWeight: 800, color: idx === 0 ? "#10b981" : "#475569" }}>{idx + 1}</td>
                    <td className="td" style={{ fontWeight: 800, color: "#111" }}>{t.name || "—"}</td>
                    <td className="td" style={{ fontWeight: 700 }}>{t.rooms || "—"}</td>
                    <td className="td"><span style={{ background: "#e2e8f0", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{t.levels || "—"}</span></td>
                    <td className="td">{t.count || 0}</td>
                    <td className="td" style={{ color: "#2563eb", fontWeight: 700 }}>{t.count ? (t.clarity || 0).toFixed(2) : "—"}</td>
                    <td className="td" style={{ color: "#10b981", fontWeight: 700 }}>{t.count ? (t.teach || 0).toFixed(2) : "—"}</td>
                    <td className="td" style={{ color: "#b45309", fontWeight: 700 }}>{t.count ? (t.drive || 0).toFixed(2) : "—"}</td>
                    <td className="td" style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>{t.count ? (t.avg || 0).toFixed(2) : "—"}</td>
                    <td className="td">
                      <span style={{ background: t.count ? s.bg : "#f1f5f9", color: t.count ? s.fg : "#64748b", borderRadius: 999, padding: "3px 11px", fontSize: 11, fontWeight: 800 }}>
                        {t.count ? s.t : "لا يوجد تقييم"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function KpiCard(p: { label: string; value: any; suffix?: string; subtitle?: string; ghost: string }) {
  return (
    <div style={S.kpiCard}>
      <div style={S.kpiGhost}>{p.ghost || ""}</div>
      <div style={{ position: "relative" }}>
        <div style={S.kpiLabel}>{p.label || ""}</div>
        <div style={S.kpiVal}>{p.value}{p.suffix || ""}</div>
        {p.subtitle && <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{p.subtitle}</div>}
      </div>
    </div>
  );
}

function Card(p: { children: any; style?: any }) { 
  return (
    <div style={{ background: "#fffdf9", border: "1px solid #e8decb", borderRadius: 20, padding: 20, boxShadow: "0 4px 14px rgba(60,40,10,.05)", marginBottom: 14, ...p.style }}>
      {p.children}
    </div>
  ); 
}

function CD(p: { children: any; st?: any }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #ece4d4", borderRadius: 20, padding: 18, boxShadow: "0 4px 14px rgba(60,40,10,.05)", marginBottom: 14, ...p.st }}>
      {p.children}
    </div>
  );
}

// ==========================================
// الأنماط البرمجية المقاومة للـ Hydration والـ snake_case
// ==========================================
const S: Record<string, CSSProperties> = {
  wrap: { direction: "rtl", fontFamily: "Cairo, Tahoma, sans-serif", background: "#f2ecdf", minHeight: "100vh", padding: 16, color: "#1a1a1a" },
  loading: { background: "#f2ecdf", minHeight: "100vh", padding: 80, textAlign: "center", color: "#64748b" },
  spinner: { width: 48, height: 48, border: "5px solid #e2e8f0", borderTop: "5px solid #10b981", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" },
  headerCard: { position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#0b1220,#111827)", borderRadius: 24, padding: 24, color: "#fff", marginBottom: 16 },
  headerBgText: { position: "absolute", left: 16, top: 0, fontSize: 80, fontWeight: 900, color: "rgba(255,255,255,.04)", letterSpacing: 4 },
  headerBadge: { background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: "#e2e8f0", display: "inline-block", marginBottom: 6 },
  kpiCard: { position: "relative", overflow: "hidden", borderRight: "4px solid #10b981", background: "#fffdf9", borderTop: "1px solid #e8decb", borderBottom: "1px solid #e8decb", borderLeft: "1px solid #e8decb", borderRadius: 22, padding: 22, boxShadow: "0 6px 18px rgba(60,40,10,0.04)" },
  kpiGhost: { position: "absolute", left: 10, top: 4, fontSize: 60, fontWeight: 900, color: "rgba(16,185,129,0.04)" },
  kpiLabel: { fontSize: 13, color: "#9a8f7d", fontWeight: 700, marginBottom: 4 },
  kpiVal: { fontSize: 38, fontWeight: 900, color: "#0f172a", lineHeight: 1 },
  bestCard: { background: "linear-gradient(135deg, #0f172a, #1e293b)", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", border: "1px solid #10b981", borderRadius: 22, padding: 22 },
  axisRow: { background: "#fff", border: "1px solid #f0e9db", borderRadius: 14, padding: 13, marginBottom: 10 },
  axisMeta: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 },
  axisLabelWrap: { display: "flex", alignItems: "center", gap: 8 },
  secTag: { background: "#f0e9db", color: "#7c6f5a", borderRadius: 7, padding: "2px 9px", fontSize: 11, fontWeight: 700 },
  statusPill: { borderRadius: 999, padding: "3px 11px", fontSize: 11, fontWeight: 800 },
  track: { height: 10, background: "#f0e9db", borderRadius: 8, overflow: "hidden" },
  fillGrad: { height: "100%", borderRadius: 8 },
  commentCard: { background: "#fff", borderRight: "4px solid #10b981", borderRadius: 12, padding: 12, marginBottom: 8, fontSize: 13, color: "#475569", lineHeight: 1.7 }
};
