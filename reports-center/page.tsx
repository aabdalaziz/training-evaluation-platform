// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase as supabaseImp } from "../../lib/supabase/client";
const CSS = "@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap');.rc,.rc *{font-family:'Cairo',Tahoma,sans-serif;box-sizing:border-box}.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}@media(max-width:900px){.g2,.g4{grid-template-columns:1fr}}";
const TEAL = "#0d9488"; const NAVY = "#0b1220";
function getDb() { try { const f: any = supabaseImp; if (typeof f === "function") { try { const c = f(); if (c && c.from) return c; } catch {} return f; } return f; } catch { return supabaseImp as any; } }
function avgA(a: number[]) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
function today() { return new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" }); }

export default function ReportsCenter() {
  const [rows, setRows] = useState<any[]>([]); const [ans, setAns] = useState<any[]>([]); const [qs, setQs] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]); const [profs, setProfs] = useState<any[]>([]); const [programs, setPrograms] = useState<any[]>([]);
  const [load, setLoad] = useState(true); const [err, setErr] = useState(""); const [msg, setMsg] = useState("");
  const [modal, setModal] = useState<null | { kind: string; to: string; report: any }>(null); const [sending, setSending] = useState(false);

  useEffect(() => { let on = true; (async () => {
    try {
      const db = getDb();
      const [e, c, p, pr] = await Promise.all([db.from("evaluations").select("*").limit(5000), db.from("classrooms").select("*").limit(500), db.from("programs").select("*").limit(500), db.from("questions").select("*").limit(500)]);
      const ids = (e.data || []).map((x: any) => x.id);
      const a = ids.length ? await db.from("evaluation_answers").select("*").in("evaluation_id", ids) : { data: [] };
      let pp: any[] = []; const tIds = [...new Set((c.data || []).map((x: any) => x.trainer_id).filter(Boolean))]; if (tIds.length) { const r = await db.from("profiles").select("*").in("id", tIds); pp = r.data || []; }
      if (!on) return; setRows(e.data || []); setRooms(c.data || []); setPrograms(p.data || []); setQs(pr.data || []); setProfs(pp);
    } catch (ex: any) { if (on) setErr(ex.message); } finally { if (on) setLoad(false); }
  })(); return () => { on = false; }; }, []);

  const calc = (kind: string) => {
    const list = rows.filter((r) => r.kind === kind); const ids = new Set(list.map((r) => r.id));
    const qm: any = {}; qs.forEach((q) => { qm[q.id] = q; }); const g: any = {};
    ans.forEach((a) => { if (ids.has(a.evaluation_id) && a.rating_value != null) (g[a.question_id] = g[a.question_id] || []).push(Number(a.rating_value)); });
    const axes = Object.keys(g).map((id) => ({ label: qm[id]?.text_ar || "سؤال", section: qm[id]?.section_ar || "عام", value: avgA(g[id]) })).sort((a, b) => b.value - a.value);
    const all = list.map((r) => Number(r.overall_rating)).filter((v) => !isNaN(v) && v > 0);
    const comments = ans.filter((a) => ids.has(a.evaluation_id) && a.text_value && a.text_value.trim()).map((a) => a.text_value.trim()).slice(0, 6);
    const avg = avgA(all);
    const strengths = axes.slice(0, 3).map((a) => a.label + " (" + a.value.toFixed(2) + "/5)");
    const improvements = axes.slice(-3).reverse().map((a) => a.label + " (" + a.value.toFixed(2) + "/5)");
    return { count: list.length, avg, axes, comments, strengths, improvements };
  };
  const daily = useMemo(() => calc("DAILY"), [rows, ans, qs]);
  const final = useMemo(() => calc("FINAL"), [rows, ans, qs]);

  const trainerReports = useMemo(() => {
    const cMap: any = {}; rooms.forEach((c) => { cMap[c.id] = c; }); const pMap: any = {}; profs.forEach((p) => { pMap[p.id] = p.full_name || p.display_name || p.email || "مدرب"); });
    const prMap: any = {}; programs.forEach((p) => { prMap[p.id] = p.name || p.title || "برنامج"; });
    const g: any = {}; rows.forEach((ev) => { let cid = ev.classroom_id; if (!cid && ev.classroom_number) { const f = rooms.find((c) => String(c.code) === String(ev.classroom_number)); if (f) cid = f.id; } if (!cid) return; (g[cid] = g[cid] || []).push(ev); });
    return Object.entries(g).map(([cid, evs]: any) => {
      const c = cMap[cid]; const ids = new Set(evs.map((e: any) => e.id)); const qm: any = {}; qs.forEach((q) => { qm[q.id] = q; }); const gg: any = {};
      ans.forEach((a) => { if (ids.has(a.evaluation_id) && a.rating_value != null) (gg[a.question_id] = gg[a.question_id] || []).push(Number(a.rating_value)); });
      const axes = Object.keys(gg).map((id) => ({ label: qm[id]?.text_ar || "سؤال", value: avgA(gg[id]) })).sort((a, b) => b.value - a.value);
      const avg = avgA(evs.map((e: any) => Number(e.overall_rating)).filter((v: number) => !isNaN(v) && v > 0));
      const comments = ans.filter((a) => ids.has(a.evaluation_id) && a.text_value && a.text_value.trim()).map((a) => a.text_value.trim()).slice(0, 4);
      const name = c?.trainer_id ? pMap[c.trainer_id] : "غير معين"; const email = profs.find((p) => p.id === c?.trainer_id)?.email || "";
      return { id: cid, name, email, room: c?.code || "—", program: prMap[c?.program_id] || "—", count: evs.length, avg, axes, comments, strengths: axes.slice(0, 3).map((a) => a.label + " (" + a.value.toFixed(2) + ")"), improvements: axes.slice(-2).reverse().map((a) => a.label + " (" + a.value.toFixed(2) + ")") };
    }).sort((a, b) => b.avg - a.avg);
  }, [rows, ans, qs, rooms, profs, programs]);

  const execReport = useMemo(() => {
    const all = [...rows]; const avg = avgA(all.map((r) => Number(r.overall_rating)).filter((v) => !isNaN(v) && v > 0));
    const ranked = [...trainerReports].filter((t) => t.count > 0);
    return { count: all.length, avg, roomsCount: rooms.length, trainersCount: trainerReports.filter((t) => t.count > 0).length, top: ranked[0], low: ranked[ranked.length - 1], dailyAvg: daily.avg, finalAvg: final.avg };
  }, [rows, trainerReports, rooms, daily, final]);

  const send = async () => {
    if (!modal) return; setSending(true); setMsg(""); setErr("");
    const subject = modal.kind === "trainer" ? "تقرير أداء قاعتك التدريبية" : "التقرير التنفيذي الشامل";
    try {
      const db = getDb();
      const { data, error } = await db.functions.invoke("send-report-email", { body: { to: modal.to, subject, report: { ...modal.report, type: modal.kind, title: subject, date: today() } } });
      if (error) throw error;
      if (data && data.ok === false && data.fallback) { openMailto(modal.to, subject, modal.report); setMsg("⚠️ خدمة Resend غير مهيّأة بعد — فُتحت نافذة بريد بديلة. هيّئ RESEND_API_KEY للإرسال التلقائي."); }
      else if (data && data.ok === false) setErr("فشل الإرسال: " + data.error);
      else { setMsg("✅ تم إرسال التقرير إلى " + modal.to); setModal(null); }
    } catch (ex: any) { openMailto(modal.to, subject, modal.report); setMsg("⚠️ تعذّر الإرسال المباشر — فُتحت نافذة بريد بديلة (" + (ex.message || "") + ")"); }
    finally { setSending(false); }
  };

  const openMailto = (to: string, subject: string, r: any) => {
    const axes = (r.axes || []).map((a: any) => "- " + a.label + ": " + Number(a.value).toFixed(2) + "/5").join("%0A");
    const body = "البرنامج: " + (r.program || "—") + "%0Aالقاعة: " + (r.room || "—") + "%0Aعدد التقييمات: " + (r.count || 0) + "%0Aالمتوسط: " + (r.avg ? Number(r.avg).toFixed(2) : "—") + "%0A%0Aالمحاور:%0A" + axes;
    window.open("mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + body, "_blank");
  };

  const printReport = (r: any, title: string) => {
    const w = window.open("", "_blank"); if (!w) return;
    const axes = (r.axes || []).map((a: any) => `<div style="margin:6px 0"><b>${a.label}</b>: ${Number(a.value).toFixed(2)}/5</div>`).join("");
    w.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:Tahoma;padding:30px"><h1>${title}</h1><p>التاريخ: ${today()}</p><p>البرنامج: ${r.program || "—"} | القاعة: ${r.room || "—"}</p><p>عدد التقييمات: ${r.count || 0} | المتوسط: ${r.avg ? Number(r.avg).toFixed(2) : "—"}/5</p><h3>المحاور</h3>${axes}<script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  if (load) return <div className="rc" style={{ background: "#f1f5f9", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><style dangerouslySetInnerHTML={{ __html: CSS }} />جارٍ بناء مركز التقارير...</div>;

  return (
    <div className="rc" style={{ background: "#f1f5f9", minHeight: "100vh", padding: 20, direction: "rtl" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#0b1220,#0d9488)", borderRadius: 24, padding: 26, color: "#fff", marginBottom: 18 }}>
          <div style={{ position: "absolute", left: 18, top: -8, fontSize: 80, fontWeight: 900, color: "rgba(255,255,255,.05)" }}>REPORTS</div>
          <div style={{ position: "relative" }}><h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}> مركز التقارير والإرسال</h1><p style={{ margin: "6px 0 0", color: "#cbd5e1", fontSize: 13 }}>إرسال تقرير القاعة للمدرّب + التقرير الشامل للإدارة بالبريد الإلكتروني</p></div>
        </div>

        {err && <div style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 12, marginBottom: 12 }}>{err}</div>}
        {msg && <div style={{ background: "#dcfce7", color: "#065f46", padding: 12, borderRadius: 12, marginBottom: 12 }}>{msg}</div>}

        <div className="g4" style={{ marginBottom: 18 }}>
          {[["إجمالي التقييمات", rows.length], ["القاعات", rooms.length], ["المدربون النشطون", trainerReports.filter((t) => t.count > 0).length], ["متوسط المنصة", execReport.avg ? execReport.avg.toFixed(2) : "—"]].map((k, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 16, padding: 16, textAlign: "center", border: "1px solid #e2e8f0" }}><div style={{ fontSize: 12, color: "#94a3b8" }}>{k[0]}</div><div style={{ fontSize: 28, fontWeight: 900, color: NAVY }}>{k[1]}</div></div>
          ))}
        </div>

        <div style={{ background: NAVY, borderRadius: 20, padding: 18, marginBottom: 18, color: "#fff" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 900 }}>🏢 التقرير التنفيذي الشامل → للإدارة</h2>
          <div className="g2">
            <div><div style={{ color: "#94a3b8", fontSize: 12 }}>الأداء اليومي / النهائي</div><div style={{ fontSize: 22, fontWeight: 800 }}>{daily.avg.toFixed(2)} / {final.avg.toFixed(2)}</div></div>
            <div><div style={{ color: "#94a3b8", fontSize: 12 }}>أعلى قاعة / أقل قاعة</div><div style={{ fontSize: 16, fontWeight: 700 }}>{execReport.top ? execReport.top.room + " (" + execReport.top.avg.toFixed(2) + ")" : "—"} / {execReport.low ? execReport.low.room + " (" + execReport.low.avg.toFixed(2) + ")" : "—"}</div></div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button onClick={() => setModal({ kind: "exec", to: "", report: { ...execReport, axes: [...daily.axes, ...final.axes].slice(0, 8), comments: [...daily.comments, ...final.comments].slice(0, 5), program: "كل البرامج", room: "كل القاعات" } })} style={{ background: TEAL, color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>📧 إرسال للإدارة</button>
            <button onClick={() => printReport({ ...execReport, axes: [...daily.axes, ...final.axes].slice(0, 10) }, "التقرير التنفيذي الشامل")} style={{ background: "rgba(255,255,255,.12)", color: "#fff", border: "1px solid rgba(255,255,255,.2)", borderRadius: 10, padding: "10px 16px", cursor: "pointer" }}>🖨 طباعة / PDF</button>
          </div>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>👨‍🏫 تقارير القاعات → للمدرّبين ({trainerReports.filter((t) => t.count > 0).length})</h2>
        <div className="g2">
          {trainerReports.map((t) => (
            <div key={t.id} style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #e2e8f0", borderRight: "5px solid " + (t.count ? TEAL : "#cbd5e1") }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontWeight: 800, color: NAVY }}>{t.name}</div><div style={{ fontSize: 12, color: "#64748b" }}>قاعة {t.room} • {t.program}</div></div><div style={{ textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 900, color: t.avg >= 3.2 ? TEAL : "#ef4444" }}>{t.count ? t.avg.toFixed(2) : "—"}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{t.count} تقييم</div></div></div>
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                <button disabled={!t.count} onClick={() => setModal({ kind: "trainer", to: t.email || "", report: t })} style={{ background: t.count ? TEAL : "#e2e8f0", color: t.count ? "#fff" : "#94a3b8", border: "none", borderRadius: 8, padding: "8px 12px", fontWeight: 700, cursor: t.count ? "pointer" : "not-allowed", fontSize: 12 }}>📧 إرسال للمدرّب</button>
                <button disabled={!t.count} onClick={() => printReport(t, "تقرير القاعة " + t.room)} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: "8px 12px", cursor: t.count ? "pointer" : "not-allowed", fontSize: 12 }}>🖨 PDF</button>
              </div>
            </div>
          ))}
          {trainerReports.filter((t) => t.count > 0).length === 0 && <div style={{ color: "#94a3b8", padding: 20 }}>لا توجد تقييمات مربوطة بقاعات بعد. اربط التقييمات من لوحة الإدارة.</div>}
        </div>

        {modal && (
          <div onClick={() => !sending && setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, padding: 22, width: "100%", maxWidth: 440 }}>
              <h3 style={{ margin: "0 0 6px", fontWeight: 900 }}>{modal.kind === "trainer" ? "إرسال تقرير القاعة للمدرّب" : "إرسال التقرير التنفيذي للإدارة"}</h3>
              <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 12px" }}>البريد الإلكتروني للمستلم</p>
              <input value={modal.to} onChange={(e) => setModal({ ...modal, to: e.target.value })} placeholder="name@example.com" style={{ width: "100%", padding: 12, border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14 }} />
              <div style={{ background: "#f8fafc", borderRadius: 10, padding: 10, marginTop: 12, fontSize: 12, color: "#475569" }}>سيُرسَل تقرير بصيغة HTML احترافية يتضمن: البرنامج، القاعة، المتوسط، المحاور، نقاط القوة، فرص التحسين، والملاحظات.</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button onClick={() => setModal(null)} disabled={sending} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer" }}>إلغاء</button>
                <button onClick={send} disabled={sending || !modal.to} style={{ background: TEAL, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 800, cursor: sending || !modal.to ? "not-allowed" : "pointer", opacity: sending || !modal.to ? .6 : 1 }}>{sending ? "جارٍ الإرسال..." : "إرسال الآن"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
