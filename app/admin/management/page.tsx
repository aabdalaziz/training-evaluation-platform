// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";

const EMERALD = "#00897B", TEAL = "#1FA39A", NAVY = "#14466B", RED = "#dc2626";

/* Days of week — 0 = Sunday (matches class_schedules.day_of_week) */
const DAYS = [
  { v: 0, ar: "الأحد", en: "Sunday" }, { v: 1, ar: "الاثنين", en: "Monday" }, { v: 2, ar: "الثلاثاء", en: "Tuesday" },
  { v: 3, ar: "الأربعاء", en: "Wednesday" }, { v: 4, ar: "الخميس", en: "Thursday" }, { v: 5, ar: "الجمعة", en: "Friday" }, { v: 6, ar: "السبت", en: "Saturday" },
];
const fmtTime = (t) => (t || "").slice(0, 5);
const dayName = (v, ar) => { const d = DAYS.find(x => x.v === Number(v)); return d ? (ar ? d.ar : d.en) : ""; };

export default function ManagementPage() {
  const router = useRouter();
  const [lang, setLang] = useState("ar");
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("trainers");
  const [trainers, setTrainers] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [levels, setLevels] = useState([]);        // program_levels (single source of truth for levels)
  const [schedules, setSchedules] = useState([]);  // class_schedules (single source of truth for timings)
  // trainer form
  const [tName, setTName] = useState(""); const [tPhone, setTPhone] = useState(""); const [tEmail, setTEmail] = useState("");
  // room form
  const [cCode, setCCode] = useState(""); const [cProgram, setCProgram] = useState(""); const [cLevel, setCLevel] = useState("");
  const [cSection, setCSection] = useState(""); const [cTrainer, setCTrainer] = useState("");
  const [cSlots, setCSlots] = useState([]);                       // [{day,start,end}] for the new remote group
  const [slot, setSlot] = useState({ day: "0", start: "16:00", end: "17:40" });
  // per-room inline schedule drafts { [roomId]: {day,start,end} }
  const [rowSlot, setRowSlot] = useState({});
  // level form
  const [lCode, setLCode] = useState(""); const [lAr, setLAr] = useState(""); const [lEn, setLEn] = useState("");
  const [lProgram, setLProgram] = useState(""); const [lOrder, setLOrder] = useState("");
  const [msg, setMsg] = useState("");
  const [roomFilter, setRoomFilter] = useState("all");
  const ar = lang === "ar";
  const db = supabase();

  const loadAll = async () => {
    const [tr, cl, pg, lv, sc] = await Promise.all([
      db.from("trainers").select("*").order("name", { ascending: true }),
      db.from("classrooms").select("*").order("code", { ascending: true }),
      db.from("programs").select("id,name_ar,delivery_mode").order("name_ar"),
      db.from("program_levels").select("*").order("sort_order").order("code"),
      db.from("class_schedules").select("*").order("day_of_week").order("start_time"),
    ]);
    setTrainers(tr.data || []);
    setClassrooms(cl.data || []);
    setPrograms(pg.data || []);
    setLevels(lv.data || []);
    setSchedules(sc.data || []);
    if (lv.error || sc.error) flash(ar ? "⚠️ جداول المستويات/المواعيد غير موجودة — نفّذ ملف SQL الخاص بالاستطلاع في Supabase" : "⚠️ Levels/schedules tables missing — run the survey SQL in Supabase");
  };

  useEffect(() => {
    setMounted(true);
    let on = true;
    (async () => {
      const s = await db.auth.getSession();
      if (!s.data?.session) { router.push("/login"); return; }
      // deep link: /admin/management?tab=rooms|levels|trainers
      try { const t = new URLSearchParams(window.location.search).get("tab"); if (t && ["trainers", "rooms", "levels"].includes(t)) setTab(t); } catch {}
      if (on) { await loadAll(); setLoading(false); }
    })();
    return () => { on = false; };
  }, []);

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(""), 4000); };
  const linked = classrooms.filter(c => c.trainer_id).length;
  const unlinked = classrooms.filter(c => !c.trainer_id).length;

  /* ---------- helpers ---------- */
  const levelsFor = (programId) => levels.filter(l => l.is_active !== false && (!l.program_id || l.program_id === programId));
  const levelOf = (c) => {
    if (c.level_id) { const l = levels.find(x => x.id === c.level_id); if (l) return l; }
    const txt = (c.level || "").trim().toLowerCase();
    if (!txt) return null;
    return levelsFor(c.program_id).find(l => l.code.toLowerCase() === txt || (l.name_ar || "").toLowerCase() === txt || (l.name_en || "").toLowerCase() === txt) || null;
  };
  const schedOf = (roomId) => schedules.filter(s => s.classroom_id === roomId && s.is_active !== false);
  const slotText = (s) => `${dayName(s.day_of_week ?? s.day, ar)} ${fmtTime(s.start_time || s.start)}–${fmtTime(s.end_time || s.end)}`;
  const scheduleSummary = (slots) => slots.map(slotText).join(" | ");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const surveyLink = (roomId, schedId) => `${origin}/survey/remote-learning?classroom=${roomId}${schedId ? `&schedule=${schedId}` : ""}`;
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); flash(ar ? "✅ تم نسخ الرابط" : "✅ Link copied"); }
    catch { window.prompt(ar ? "انسخ الرابط:" : "Copy the link:", text); }
  };
  const openQR = (text) => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=10&data=${encodeURIComponent(text)}`, "_blank", "noopener");

  /* ---------- trainers ---------- */
  const addTrainer = async () => {
    if (!tName.trim()) { flash(ar ? "الاسم مطلوب" : "Name required"); return; }
    const { error } = await db.from("trainers").insert({ name: tName.trim(), phone: tPhone.trim() || null, email: tEmail.trim() || null });
    if (error) { flash(error.message); return; }
    setTName(""); setTPhone(""); setTEmail("");
    await loadAll(); flash(ar ? "تمت إضافة المدرب" : "Trainer added");
  };
  const deleteTrainer = async (id) => {
    if (!window.confirm(ar ? "حذف المدرب؟" : "Delete trainer?")) return;
    await db.from("classrooms").update({ trainer_id: null }).eq("trainer_id", id);
    const { error } = await db.from("trainers").delete().eq("id", id);
    if (error) { flash(error.message); return; }
    await loadAll(); flash(ar ? "تم الحذف" : "Deleted");
  };

  /* ---------- rooms / groups ---------- */
  const selectedProgram = programs.find(p => p.id === cProgram);
  const isRemote = selectedProgram?.delivery_mode === "remote";
  const validSlot = (s) => s.start && s.end && s.start < s.end;
  const addSlotToNew = () => {
    if (!validSlot(slot)) { flash(ar ? "تحقق من وقت البداية والنهاية" : "Check start/end time"); return; }
    setCSlots(x => [...x, { ...slot }]);
  };

  const addClassroom = async () => {
    if (!cProgram) { flash(ar ? "يرجى اختيار البرنامج" : "Please select a program"); return; }
    const lvl = levels.find(l => l.id === cLevel);
    let code = cCode.trim();
    if (isRemote) {
      if (!cLevel) { flash(ar ? "يرجى اختيار المستوى" : "Please select the level"); return; }
      if (!cTrainer) { flash(ar ? "يرجى اختيار المدرب للمجموعة عن بُعد" : "Please select the trainer of the remote group"); return; }
      if (!cSlots.length) { flash(ar ? "أضف موعدًا واحدًا على الأقل (اليوم + الوقت)" : "Add at least one schedule (day + time)"); return; }
      if (!code) code = [ar ? "عن بعد" : "Remote", lvl?.code || "", slotText(cSlots[0])].filter(Boolean).join(" - ");
    } else if (!code) { flash(ar ? "رقم / اسم القاعة مطلوب" : "Room number / name required"); return; }

    const { data: room, error } = await db.from("classrooms").insert({
      code,
      program_id: cProgram,
      level: lvl ? lvl.code : null,            // legacy text column kept in sync
      level_id: cLevel || null,
      section_name: cSection.trim() || null,
      trainer_id: cTrainer || null,
      delivery_mode: isRemote ? "remote" : "onsite",
      schedule: isRemote ? scheduleSummary(cSlots) : null,   // legacy text summary
    }).select("id").single();
    if (error) { flash(error.message); return; }

    if (isRemote && cSlots.length) {
      const { error: e2 } = await db.from("class_schedules").insert(
        cSlots.map(s => ({ classroom_id: room.id, day_of_week: Number(s.day), start_time: s.start, end_time: s.end }))
      );
      if (e2) flash(e2.message);
    }
    setCCode(""); setCProgram(""); setCLevel(""); setCSection(""); setCTrainer(""); setCSlots([]);
    await loadAll(); flash(ar ? "تمت إضافة القاعة/المجموعة" : "Room/group added");
  };

  const linkRoom = async (roomId, trainerId) => {
    const { error } = await db.from("classrooms").update({ trainer_id: trainerId || null }).eq("id", roomId);
    if (error) flash(error.message); else await loadAll();
  };
  const setRoomLevel = async (roomId, levelId) => {
    const lvl = levels.find(l => l.id === levelId);
    const { error } = await db.from("classrooms").update({ level_id: levelId || null, level: lvl ? lvl.code : null }).eq("id", roomId);
    if (error) flash(error.message); else await loadAll();
  };
  const addRowSchedule = async (room) => {
    const s = rowSlot[room.id] || { day: "0", start: "16:00", end: "17:40" };
    if (!validSlot(s)) { flash(ar ? "تحقق من وقت البداية والنهاية" : "Check start/end time"); return; }
    const { error } = await db.from("class_schedules").insert({ classroom_id: room.id, day_of_week: Number(s.day), start_time: s.start, end_time: s.end });
    if (error) { flash(error.message); return; }
    const all = [...schedOf(room.id), { day_of_week: Number(s.day), start_time: s.start, end_time: s.end }];
    await db.from("classrooms").update({ schedule: scheduleSummary(all) }).eq("id", room.id);
    await loadAll();
  };
  const deleteSchedule = async (room, sid) => {
    if (!window.confirm(ar ? "حذف هذا الموعد؟ (الإجابات السابقة تبقى محفوظة)" : "Delete this schedule? (previous answers are kept)")) return;
    const { error } = await db.from("class_schedules").delete().eq("id", sid);
    if (error) { flash(error.message); return; }
    await db.from("classrooms").update({ schedule: scheduleSummary(schedOf(room.id).filter(s => s.id !== sid)) || null }).eq("id", room.id);
    await loadAll();
  };
  const deleteClassroom = async (id) => {
    if (!window.confirm(ar ? "حذف القاعة/المجموعة ومواعيدها؟" : "Delete room/group and its schedules?")) return;
    const { error } = await db.from("classrooms").delete().eq("id", id);
    if (error) { flash(error.message); return; }
    await loadAll(); flash(ar ? "تم الحذف" : "Deleted");
  };

  /* ---------- levels ---------- */
  const addLevel = async () => {
    if (!lCode.trim() || !lAr.trim()) { flash(ar ? "الرمز والاسم العربي مطلوبان" : "Code and Arabic name are required"); return; }
    const { error } = await db.from("program_levels").insert({
      code: lCode.trim(), name_ar: lAr.trim(), name_en: lEn.trim() || lCode.trim(),
      program_id: lProgram || null, sort_order: Number(lOrder) || 0,
    });
    if (error) { flash(error.message); return; }
    setLCode(""); setLAr(""); setLEn(""); setLProgram(""); setLOrder("");
    await loadAll(); flash(ar ? "تمت إضافة المستوى" : "Level added");
  };
  const toggleLevel = async (l) => {
    const { error } = await db.from("program_levels").update({ is_active: !(l.is_active !== false) }).eq("id", l.id);
    if (error) flash(error.message); else await loadAll();
  };
  const deleteLevel = async (l) => {
    const used = classrooms.filter(c => c.level_id === l.id).length;
    if (used) { flash(ar ? `لا يمكن الحذف: المستوى مستخدم في ${used} قاعة — عطّله بدلًا من ذلك` : `Cannot delete: used by ${used} rooms — deactivate instead`); return; }
    if (!window.confirm(ar ? "حذف المستوى؟" : "Delete level?")) return;
    const { error } = await db.from("program_levels").delete().eq("id", l.id);
    if (error) { flash(error.message); return; }
    await loadAll(); flash(ar ? "تم الحذف" : "Deleted");
  };

  if (!mounted || loading) return (<div className="mg ls"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="sp" /></div>);

  const visibleRooms = classrooms.filter(c => roomFilter === "all" ? true : roomFilter === "remote" ? c.delivery_mode === "remote" : c.delivery_mode !== "remote");
  const remoteNoLevel = classrooms.filter(c => c.delivery_mode === "remote" && !levelOf(c)).length;
  const remoteNoSched = classrooms.filter(c => c.delivery_mode === "remote" && !schedOf(c.id).length).length;

  return (
    <div className="mg" style={{ direction: ar ? "rtl" : "ltr" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="top">
        <div className="top-in">
          <div className="brand-row">
            <div className="logo-box"><img src="/logos/upm.png" alt="UPM" /></div>
            <div>
              <div className="ttl">{ar ? "لوحة الإدارة المركزية" : "Central Admin Panel"}</div>
              <div className="sub">{ar ? "المدربون · القاعات والمجموعات · المستويات · المواعيد — مصدر واحد لكل المنصة" : "Trainers · Rooms & groups · Levels · Schedules — one source for the whole platform"}</div>
            </div>
          </div>
          <div className="top-actions">
            <button className="ghost" onClick={() => setLang(ar ? "en" : "ar")}>🌐 {ar ? "English" : "العربية"}</button>
            <button className="ghost" onClick={() => router.push("/reports/remote-survey")}>💻 {ar ? "نتائج استطلاع التعلم عن بُعد" : "Remote survey results"}</button>
            <button className="ghost" onClick={() => router.push("/reports")}>📊 {ar ? "التقارير" : "Reports"}</button>
          </div>
        </div>
      </header>

      {msg && <div className="toast">{msg}</div>}

      <div className="tabs">
        <button className={tab === "trainers" ? "tab-on" : "tab-off"} onClick={() => setTab("trainers")}>👨‍🏫 {ar ? `المدربون (${trainers.length})` : `Trainers (${trainers.length})`}</button>
        <button className={tab === "rooms" ? "tab-on" : "tab-off"} onClick={() => setTab("rooms")}>🏫 {ar ? `القاعات والمجموعات (${classrooms.length})` : `Rooms & Groups (${classrooms.length})`}</button>
        <button className={tab === "levels" ? "tab-on" : "tab-off"} onClick={() => setTab("levels")}>🎓 {ar ? `المستويات (${levels.length})` : `Levels (${levels.length})`}</button>
      </div>

      <main className="wrap">
        {/* ============================ TRAINERS ============================ */}
        {tab === "trainers" && (
          <div className="grid2">
            <div className="card">
              <h3 className="ct">➕ {ar ? "إضافة مدرب جديد" : "Add new trainer"}</h3>
              <label className="lb2">{ar ? "الاسم الكامل *" : "Full name *"}</label>
              <input className="inp" value={tName} onChange={e => setTName(e.target.value)} placeholder={ar ? "د/ اسم المدرب" : "Dr. Trainer name"} />
              <label className="lb2">{ar ? "رقم الجوال" : "Phone"}</label>
              <input className="inp" value={tPhone} onChange={e => setTPhone(e.target.value)} placeholder="05xxxxxxxx" />
              <label className="lb2">{ar ? "البريد الإلكتروني" : "Email"}</label>
              <input className="inp" value={tEmail} onChange={e => setTEmail(e.target.value)} placeholder="trainer@domain.com" />
              <button className="btn-primary" onClick={addTrainer}>{ar ? "حفظ المدرب" : "Save trainer"}</button>
            </div>
            <div className="card">
              <h3 className="ct">📌 {ar ? "إحصاءات سريعة" : "Quick stats"}</h3>
              <div className="stat-grid">
                <div className="stat"><div className="stat-n">{trainers.length}</div><div className="stat-l">{ar ? "إجمالي المدربين" : "Total trainers"}</div></div>
                <div className="stat"><div className="stat-n" style={{ color: EMERALD }}>{linked}</div><div className="stat-l">{ar ? "قاعات مربوطة" : "Linked rooms"}</div></div>
                <div className="stat"><div className="stat-n" style={{ color: RED }}>{unlinked}</div><div className="stat-l">{ar ? "قاعات بدون مدرب" : "Unlinked rooms"}</div></div>
              </div>
            </div>
            <div className="card full">
              <h3 className="ct">📋 {ar ? "قائمة المدربين ومجموعاتهم" : "Trainers and their groups"}</h3>
              <div className="tw">
                <table className="tbl">
                  <thead><tr><th className="th">{ar ? "الاسم" : "Name"}</th><th className="th">{ar ? "الجوال" : "Phone"}</th><th className="th">{ar ? "البريد" : "Email"}</th><th className="th">{ar ? "القاعات / المجموعات" : "Rooms / Groups"}</th><th className="th"></th></tr></thead>
                  <tbody>
                    {trainers.map(t => {
                      const rooms = classrooms.filter(c => c.trainer_id === t.id);
                      return (<tr key={t.id}>
                        <td className="td nm">{t.name}</td>
                        <td className="td lt">{t.phone || "—"}</td>
                        <td className="td lt em">{t.email || "—"}</td>
                        <td className="td">
                          {rooms.length ? rooms.map(c => {
                            const lv = levelOf(c);
                            return <span key={c.id} className={c.delivery_mode === "remote" ? "chip remote" : "chip onsite"}>{c.delivery_mode === "remote" ? "💻" : "🏫"} {c.code}{lv ? ` · ${lv.code}` : ""}</span>;
                          }) : <span className="muted">—</span>}
                        </td>
                        <td className="td"><button className="del" onClick={() => deleteTrainer(t.id)}>🗑️</button></td>
                      </tr>);
                    })}
                    {!trainers.length && <tr><td className="td es" colSpan={5}>{ar ? "لا يوجد مدربون" : "No trainers"}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================ ROOMS / GROUPS ============================ */}
        {tab === "rooms" && (
          <div className="grid2">
            <div className="card">
              <h3 className="ct">➕ {ar ? "إضافة قاعة / مجموعة" : "Add room / group"}</h3>
              <label className="lb2">{ar ? "البرنامج *" : "Program *"}</label>
              <select className="inp" value={cProgram} onChange={e => { setCProgram(e.target.value); setCCode(""); setCLevel(""); setCSlots([]); }}>
                <option value="">{ar ? "اختر البرنامج" : "Select program"}</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.delivery_mode === "remote" ? "💻 " : "🏫 "}{p.name_ar}</option>
                ))}
              </select>

              {cProgram && (
                <div className={isRemote ? "mode-badge remote" : "mode-badge onsite"}>
                  {isRemote ? (ar ? "💻 برنامج عن بعد — ستظهر المجموعة تلقائيًا في استطلاع التعلم عن بُعد" : "💻 Remote program — the group will appear automatically in the remote survey") : (ar ? "🏫 برنامج حضوري" : "🏫 On-site program")}
                </div>
              )}

              {cProgram && (
                <>
                  <label className="lb2">{isRemote ? (ar ? "اسم المجموعة (اختياري — يُولَّد تلقائيًا)" : "Group name (optional — auto-generated)") : (ar ? "رقم / اسم القاعة *" : "Room number / name *")}</label>
                  <input className="inp" value={cCode} onChange={e => setCCode(e.target.value)} placeholder={isRemote ? (ar ? "مثال: مجموعة 1" : "e.g. Group 1") : (ar ? "مثال: 101 أو قاعة الملك فهد" : "e.g. 101 or Main Hall")} />

                  <label className="lb2">{ar ? `المستوى ${isRemote ? "*" : ""}` : `Level ${isRemote ? "*" : ""}`}</label>
                  <select className="inp" value={cLevel} onChange={e => setCLevel(e.target.value)}>
                    <option value="">{ar ? "اختر المستوى" : "Select level"}</option>
                    {levelsFor(cProgram).map(l => <option key={l.id} value={l.id}>{l.code}{l.name_ar && l.name_ar !== l.code ? ` – ${ar ? l.name_ar : (l.name_en || l.name_ar)}` : ""}</option>)}
                  </select>
                  {!levelsFor(cProgram).length && <div className="hint">{ar ? "لا توجد مستويات — أضفها من تبويب «المستويات»" : "No levels yet — add them in the “Levels” tab"}</div>}

                  {isRemote && (
                    <>
                      <label className="lb2">{ar ? "الشعبة (اختياري)" : "Section (optional)"}</label>
                      <input className="inp" value={cSection} onChange={e => setCSection(e.target.value)} placeholder={ar ? "مثال: أ / مسائي" : "e.g. A / Evening"} />
                    </>
                  )}
                </>
              )}

              <label className="lb2">{ar ? `المدرب ${isRemote ? "*" : ""}` : `Trainer ${isRemote ? "*" : ""}`}</label>
              <select className="inp" value={cTrainer} onChange={e => setCTrainer(e.target.value)}>
                <option value="">{ar ? "بدون مدرب" : "No trainer"}</option>
                {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>

              {cProgram && isRemote && (
                <>
                  <label className="lb2">{ar ? "مواعيد المحاضرات * (توقيت الرياض)" : "Lecture schedules * (Riyadh time)"}</label>
                  <div className="slot-row">
                    <select className="inp" value={slot.day} onChange={e => setSlot({ ...slot, day: e.target.value })}>
                      {DAYS.map(d => <option key={d.v} value={d.v}>{ar ? d.ar : d.en}</option>)}
                    </select>
                    <input className="inp lt" type="time" value={slot.start} onChange={e => setSlot({ ...slot, start: e.target.value })} />
                    <input className="inp lt" type="time" value={slot.end} onChange={e => setSlot({ ...slot, end: e.target.value })} />
                    <button type="button" className="add" onClick={addSlotToNew}>➕</button>
                  </div>
                  <div className="chips">
                    {cSlots.map((s, i) => <span key={i} className="chip sched">{slotText(s)} <button type="button" className="x" onClick={() => setCSlots(cSlots.filter((_, j) => j !== i))}>✕</button></span>)}
                    {!cSlots.length && <span className="muted">{ar ? "لم تُضف مواعيد بعد — اختر اليوم والوقت ثم ➕" : "No schedules yet — pick day & time then ➕"}</span>}
                  </div>
                  <div className="preview">
                    {ar ? "سيُحفظ باسم: " : "Will be saved as: "}
                    <b>{cCode.trim() || [ar ? "عن بعد" : "Remote", levels.find(l => l.id === cLevel)?.code || "…", cSlots[0] ? slotText(cSlots[0]) : "…"].join(" - ")}</b>
                  </div>
                </>
              )}
              <button className="btn-primary" onClick={addClassroom}>{ar ? "حفظ" : "Save"}</button>
            </div>

            <div className="card">
              <h3 className="ct">📌 {ar ? "ملخص الربط" : "Linking summary"}</h3>
              <div className="stat-grid">
                <div className="stat"><div className="stat-n">{classrooms.length}</div><div className="stat-l">{ar ? "إجمالي القاعات" : "Total rooms"}</div></div>
                <div className="stat"><div className="stat-n" style={{ color: EMERALD }}>{linked}</div><div className="stat-l">{ar ? "مربوطة بمدرب" : "Linked to trainer"}</div></div>
                <div className="stat"><div className="stat-n" style={{ color: RED }}>{unlinked}</div><div className="stat-l">{ar ? "بدون مدرب" : "No trainer"}</div></div>
              </div>
              {(remoteNoLevel > 0 || remoteNoSched > 0) && (
                <div className="warn">
                  {ar ? "⚠️ مجموعات عن بُعد لن تظهر للطلاب في الاستطلاع حتى تكتمل بياناتها:" : "⚠️ Remote groups hidden from the survey until completed:"}
                  <ul>
                    {remoteNoLevel > 0 && <li>{ar ? `${remoteNoLevel} بدون مستوى` : `${remoteNoLevel} without level`}</li>}
                    {remoteNoSched > 0 && <li>{ar ? `${remoteNoSched} بدون مواعيد` : `${remoteNoSched} without schedules`}</li>}
                  </ul>
                </div>
              )}
              <div className="hint" style={{ marginTop: 12 }}>
                {ar ? "🔗 لكل موعد زر «نسخ الرابط» يُنتج رابطًا يملأ المجموعة والموعد تلقائيًا للطالب، وزر QR لعرضه في Teams." : "🔗 Each schedule has a “copy link” button that pre-fills group & schedule for students, and a QR button for Teams."}
              </div>
            </div>

            <div className="card full">
              <div className="row-between">
                <h3 className="ct" style={{ margin: 0 }}>🏫 {ar ? "القاعات والمجموعات — المستوى، المدرب، المواعيد" : "Rooms & groups — level, trainer, schedules"}</h3>
                <div className="seg">
                  {[["all", ar ? "الكل" : "All"], ["remote", ar ? "💻 عن بعد" : "💻 Remote"], ["onsite", ar ? "🏫 حضوري" : "🏫 On-site"]].map(([v, l]) => (
                    <button key={v} className={roomFilter === v ? "seg-on" : "seg-off"} onClick={() => setRoomFilter(v)}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="tw">
                <table className="tbl">
                  <thead><tr>
                    <th className="th">{ar ? "القاعة / المجموعة" : "Room / Group"}</th>
                    <th className="th">{ar ? "البرنامج" : "Program"}</th>
                    <th className="th">{ar ? "المستوى" : "Level"}</th>
                    <th className="th">{ar ? "المدرب" : "Trainer"}</th>
                    <th className="th">{ar ? "المواعيد وروابط الاستطلاع" : "Schedules & survey links"}</th>
                    <th className="th"></th>
                  </tr></thead>
                  <tbody>
                    {visibleRooms.map(c => {
                      const remote = c.delivery_mode === "remote";
                      const lv = levelOf(c);
                      const rs = rowSlot[c.id] || { day: "0", start: "16:00", end: "17:40" };
                      const list = schedOf(c.id);
                      return (
                        <tr key={c.id}>
                          <td className="td nm">
                            <span className={remote ? "pill remote" : "pill onsite"}>{remote ? "💻" : "🏫"}</span> {c.code}{c.section_name ? ` (${c.section_name})` : ""}
                          </td>
                          <td className="td lt">{programs.find(p => p.id === c.program_id)?.name_ar || "—"}</td>
                          <td className="td">
                            <select className="mini-sel" value={lv?.id || ""} onChange={e => setRoomLevel(c.id, e.target.value)}>
                              <option value="">{ar ? "— بدون —" : "— none —"}</option>
                              {levelsFor(c.program_id).map(l => <option key={l.id} value={l.id}>{l.code}{l.name_ar && l.name_ar !== l.code ? ` – ${ar ? l.name_ar : (l.name_en || l.name_ar)}` : ""}</option>)}
                            </select>
                            {!c.level_id && lv && <div className="hint">{ar ? "مطابق تلقائيًا من النص القديم — اختره لتثبيته" : "Auto-matched from legacy text — select to persist"}</div>}
                          </td>
                          <td className="td">
                            <select className="mini-sel" value={c.trainer_id || ""} onChange={e => linkRoom(c.id, e.target.value)}>
                              <option value="">{ar ? "بدون مدرب" : "No trainer"}</option>
                              {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </td>
                          <td className="td">
                            {remote ? (
                              <>
                                <div className="chips">
                                  {list.map(s => (
                                    <span key={s.id} className="chip sched">
                                      {slotText(s)}
                                      <button type="button" className="lnk" title={ar ? "نسخ رابط الاستطلاع" : "Copy survey link"} onClick={() => copy(surveyLink(c.id, s.id))}>🔗</button>
                                      <button type="button" className="lnk" title="QR" onClick={() => openQR(surveyLink(c.id, s.id))}>▦</button>
                                      <button type="button" className="x" onClick={() => deleteSchedule(c, s.id)}>✕</button>
                                    </span>
                                  ))}
                                  {!list.length && <span className="muted">{ar ? "لا مواعيد" : "No schedules"}</span>}
                                </div>
                                <div className="slot-row small">
                                  <select className="mini-sel" value={rs.day} onChange={e => setRowSlot({ ...rowSlot, [c.id]: { ...rs, day: e.target.value } })}>
                                    {DAYS.map(d => <option key={d.v} value={d.v}>{ar ? d.ar : d.en}</option>)}
                                  </select>
                                  <input className="mini-sel lt" type="time" value={rs.start} onChange={e => setRowSlot({ ...rowSlot, [c.id]: { ...rs, start: e.target.value } })} />
                                  <input className="mini-sel lt" type="time" value={rs.end} onChange={e => setRowSlot({ ...rowSlot, [c.id]: { ...rs, end: e.target.value } })} />
                                  <button type="button" className="add" onClick={() => addRowSchedule(c)}>➕</button>
                                </div>
                              </>
                            ) : <span className="muted">—</span>}
                          </td>
                          <td className="td"><button className="del" onClick={() => deleteClassroom(c.id)}>🗑️</button></td>
                        </tr>
                      );
                    })}
                    {!visibleRooms.length && <tr><td className="td es" colSpan={6}>{ar ? "لا توجد قاعات" : "No rooms"}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================ LEVELS ============================ */}
        {tab === "levels" && (
          <div className="grid2">
            <div className="card">
              <h3 className="ct">➕ {ar ? "إضافة مستوى" : "Add level"}</h3>
              <label className="lb2">{ar ? "الرمز *" : "Code *"}</label>
              <input className="inp lt" value={lCode} onChange={e => setLCode(e.target.value)} placeholder="A1 / B2 / L3" />
              <label className="lb2">{ar ? "الاسم بالعربية *" : "Arabic name *"}</label>
              <input className="inp" value={lAr} onChange={e => setLAr(e.target.value)} placeholder={ar ? "مبتدئ 1" : "مبتدئ 1"} />
              <label className="lb2">{ar ? "الاسم بالإنجليزية" : "English name"}</label>
              <input className="inp lt" value={lEn} onChange={e => setLEn(e.target.value)} placeholder="Beginner 1" />
              <label className="lb2">{ar ? "البرنامج" : "Program"}</label>
              <select className="inp" value={lProgram} onChange={e => setLProgram(e.target.value)}>
                <option value="">{ar ? "🌐 عام لكل البرامج" : "🌐 Global (all programs)"}</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
              </select>
              <label className="lb2">{ar ? "الترتيب" : "Sort order"}</label>
              <input className="inp lt" type="number" value={lOrder} onChange={e => setLOrder(e.target.value)} placeholder="1" />
              <button className="btn-primary" onClick={addLevel}>{ar ? "حفظ المستوى" : "Save level"}</button>
            </div>
            <div className="card">
              <h3 className="ct">ℹ️ {ar ? "كيف تُستخدم المستويات؟" : "How levels are used"}</h3>
              <ul className="info">
                <li>{ar ? "تُختار عند إضافة القاعة/المجموعة (بدل الكتابة اليدوية)." : "Selected when adding a room/group (instead of free text)."}</li>
                <li>{ar ? "يراها الطالب في استطلاع التعلم عن بُعد كسؤال «ما مستواك؟» وكأساس لتصفية المدرب والمجموعة." : "Shown to students in the remote survey (“What is your level?”) and used to filter trainer → group."}</li>
                <li>{ar ? "القاعات القديمة المكتوب مستواها نصًا (مثل B1) تُطابَق تلقائيًا إذا تطابق الرمز أو الاسم." : "Legacy rooms with free-text level (e.g. B1) are auto-matched by code or name."}</li>
                <li>{ar ? "عطّل المستوى بدل حذفه إذا كان مستخدمًا." : "Deactivate rather than delete a level that is in use."}</li>
              </ul>
            </div>
            <div className="card full">
              <h3 className="ct">🎓 {ar ? "قائمة المستويات" : "Levels list"}</h3>
              <div className="tw">
                <table className="tbl">
                  <thead><tr><th className="th">{ar ? "الرمز" : "Code"}</th><th className="th">{ar ? "الاسم" : "Name"}</th><th className="th">{ar ? "البرنامج" : "Program"}</th><th className="th">{ar ? "الترتيب" : "Order"}</th><th className="th">{ar ? "القاعات" : "Rooms"}</th><th className="th">{ar ? "الحالة" : "Status"}</th><th className="th"></th></tr></thead>
                  <tbody>
                    {levels.map(l => (
                      <tr key={l.id} style={{ opacity: l.is_active === false ? .55 : 1 }}>
                        <td className="td nm lt">{l.code}</td>
                        <td className="td">{l.name_ar}{l.name_en && l.name_en !== l.code ? <span className="muted"> / {l.name_en}</span> : null}</td>
                        <td className="td">{l.program_id ? (programs.find(p => p.id === l.program_id)?.name_ar || "—") : (ar ? "🌐 عام" : "🌐 Global")}</td>
                        <td className="td lt">{l.sort_order}</td>
                        <td className="td">{classrooms.filter(c => levelOf(c)?.id === l.id).length}</td>
                        <td className="td"><button className={l.is_active === false ? "tog off" : "tog on"} onClick={() => toggleLevel(l)}>{l.is_active === false ? (ar ? "معطّل" : "Inactive") : (ar ? "نشط" : "Active")}</button></td>
                        <td className="td"><button className="del" onClick={() => deleteLevel(l)}>🗑️</button></td>
                      </tr>
                    ))}
                    {!levels.length && <tr><td className="td es" colSpan={7}>{ar ? "لا توجد مستويات — نفّذ ملف SQL أو أضف مستوى" : "No levels — run the SQL file or add one"}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
*{box-sizing:border-box;}
:root{--upm-navy:#14466B;--upm-navy-2:#0d3049;--upm-emerald:#00897B;--upm-teal:#1FA39A;--upm-gold:#C9A24B;}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.mode-badge{margin:10px 0 4px;padding:8px 12px;border-radius:10px;font-weight:800;font-size:13px;display:inline-block;}
.mode-badge.onsite{background:#e0f2fe;color:#0369a1;}
.mode-badge.remote{background:#ede9fe;color:#6d28d9;}
.pill{padding:3px 8px;border-radius:999px;font-size:12px;font-weight:800;white-space:nowrap;}
.pill.onsite{background:#e0f2fe;color:#0369a1;}
.pill.remote{background:#ede9fe;color:#6d28d9;}
.chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:800;margin:2px;white-space:nowrap;}
.chip.onsite{background:#e0f2fe;color:#0369a1;}
.chip.remote{background:#ede9fe;color:#6d28d9;}
.chip.sched{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;}
.chip .x,.chip .lnk{border:0;background:transparent;cursor:pointer;font-size:12px;padding:0 2px;color:inherit;}
.chip .x{color:#b91c1c;}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0;}
.slot-row{display:grid;grid-template-columns:1.3fr 1fr 1fr auto;gap:6px;align-items:center;}
.slot-row.small{grid-template-columns:auto auto auto auto;justify-content:start;margin-top:6px;}
.slot-row.small .mini-sel{min-width:0;padding:6px 8px;}
.slot-row.small input[type=time]{min-width:118px;}
.add{border:1px solid #a7f3d0;background:#ecfdf5;color:#065f46;border-radius:10px;padding:8px 10px;cursor:pointer;font-weight:900;}
.preview{margin-top:10px;padding:10px 12px;border-radius:10px;background:#f1f5f9;color:#334155;font-size:13px;}
.hint{font-size:12px;color:#64748b;font-weight:700;margin-top:4px;}
.muted{color:#94a3b8;font-weight:700;font-size:12px;}
.warn{margin-top:14px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:12px;padding:12px;font-weight:800;font-size:13px;}
.warn ul{margin:6px 0 0;padding-inline-start:18px;}
.info{margin:0;padding-inline-start:18px;color:#334155;font-weight:700;font-size:14px;line-height:1.9;}
.row-between{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;}
.seg{display:flex;gap:4px;background:#f1f5f9;border-radius:12px;padding:4px;}
.seg-on,.seg-off{border:0;border-radius:9px;padding:7px 12px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;}
.seg-on{background:#fff;color:var(--upm-navy);box-shadow:0 2px 6px rgba(15,23,42,.08);}
.seg-off{background:transparent;color:#64748b;}
.tog{border:0;border-radius:999px;padding:5px 12px;font-family:inherit;font-weight:800;font-size:12px;cursor:pointer;}
.tog.on{background:#d1fae5;color:#047857;}
.tog.off{background:#f1f5f9;color:#64748b;}
body{margin:0;background:#f4f6f8;}
.mg{min-height:100vh;background:#f4f6f8;font-family:Tajawal,Arial,sans-serif;color:#0f172a;padding-bottom:40px;}
.ls{display:flex;align-items:center;justify-content:center;background:var(--upm-navy);}
.sp{width:64px;height:64px;border:6px solid rgba(255,255,255,.14);border-top-color:var(--upm-teal);border-radius:50%;animation:spin 1s linear infinite;}
.top{background:linear-gradient(135deg,var(--upm-navy),var(--upm-navy-2));color:#fff;padding:22px 28px;border-bottom:3px solid var(--upm-gold);}
.top-in{max-width:1240px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;}
.brand-row{display:flex;align-items:center;gap:16px;}
.logo-box{background:#fff;border:2px solid var(--upm-gold);border-radius:16px;padding:8px;box-shadow:0 6px 18px rgba(0,0,0,.25);}
.logo-box img{height:54px;width:auto;display:block;}
.ttl{font-size:24px;font-weight:900;}
.sub{color:#9fc3d6;font-size:13px;margin-top:4px;font-weight:700;}
.top-actions{display:flex;gap:10px;flex-wrap:wrap;}
.ghost{background:rgba(255,255,255,.10);border:1px solid rgba(201,162,75,.35);color:#fff;border-radius:12px;padding:10px 16px;font-family:inherit;font-weight:800;cursor:pointer;}
.ghost:hover{background:rgba(255,255,255,.18);}
.toast{max-width:1240px;margin:16px auto 0;padding:12px 18px;border-radius:12px;font-weight:800;text-align:center;background:#d1fae5;color:#047857;}
.tabs{max-width:1240px;margin:22px auto 0;padding:0 28px;display:flex;gap:10px;flex-wrap:wrap;}
.tab-on,.tab-off{border:0;border-radius:14px;padding:13px 20px;font-family:inherit;font-weight:900;font-size:15px;cursor:pointer;transition:.2s;}
.tab-on{background:linear-gradient(135deg,var(--upm-emerald),var(--upm-teal));color:#fff;box-shadow:0 10px 24px rgba(0,137,123,.30);border:1px solid rgba(201,162,75,.35);}
.tab-off{background:#fff;color:#475569;border:1px solid #e2e8f0;}
.tab-off:hover{background:#f8fafc;}
.wrap{max-width:1240px;margin:20px auto 0;padding:0 28px;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:24px;box-shadow:0 8px 28px rgba(15,23,42,.04);margin-bottom:20px;}
.card.full{grid-column:1 / -1;}
.ct{margin:0 0 16px;font-size:19px;font-weight:900;color:var(--upm-navy);}
.lb2{display:block;font-size:13px;font-weight:800;color:#475569;margin:12px 0 6px;}
.inp{width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:12px;font-family:inherit;font-weight:700;outline:none;background:#fff;color:#0f172a;margin-bottom:4px;}
.inp:focus{border-color:var(--upm-emerald);box-shadow:0 0 0 4px rgba(0,137,123,.12);}
.btn-primary{width:100%;margin-top:16px;border:0;border-radius:12px;padding:14px;background:linear-gradient(135deg,var(--upm-emerald),var(--upm-teal));color:#fff;font-family:inherit;font-weight:900;font-size:15px;cursor:pointer;box-shadow:0 10px 24px rgba(0,137,123,.25);}
.btn-primary:hover{filter:brightness(1.05);}
.stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:18px;text-align:center;}
.stat-n{font-size:34px;font-weight:900;color:var(--upm-navy);}
.stat-l{font-size:12px;font-weight:800;color:#64748b;margin-top:6px;}
.tw{width:100%;overflow-x:auto;}
.tbl{width:100%;border-collapse:collapse;min-width:720px;}
.th{padding:13px;font-weight:900;font-size:13px;color:#64748b;border-bottom:2px solid #eef2f6;text-align:start;}
.td{padding:13px;font-size:14px;border-bottom:1px solid #f1f5f9;font-weight:700;vertical-align:top;}
.nm{color:#0f172a;font-weight:900;}
.lt{direction:ltr;unicode-bidi:plaintext;}
.em{color:#2563eb;}
.es{color:#94a3b8;text-align:center;font-weight:800;}
.del{background:#fff;border:1px solid #fecaca;color:#b91c1c;border-radius:10px;padding:6px 10px;cursor:pointer;font-size:14px;}
.del:hover{background:#fee2e2;}
.mini-sel{border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font-family:inherit;font-weight:700;background:#fff;color:#0f172a;min-width:150px;outline:none;}
.mini-sel:focus{border-color:var(--upm-emerald);}
@media(max-width:900px){.grid2{grid-template-columns:1fr;}.stat-grid{grid-template-columns:1fr;}.top-in{flex-direction:column;align-items:flex-start;}.slot-row{grid-template-columns:1fr 1fr;}}
`;
