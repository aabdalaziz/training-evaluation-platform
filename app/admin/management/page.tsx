// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";

export default function Management() {
  const router = useRouter();
  const [tab, setTab] = useState("rooms");
  const [rooms, setRooms] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // نماذج الإدخال
  const [roomForm, setRoomForm] = useState({ id: null, code: "", level: "A1", program_id: "", trainer_id: "" });
  const [trainerForm, setTrainerForm] = useState({ id: null, name: "", phone: "", email: "" });

  const loadData = async () => {
    const db = supabase();
    const [r, p, t] = await Promise.all([
      db.from("classrooms").select("*").order("code"),
      db.from("programs").select("*").order("name"),
      db.from("trainers").select("*").order("name"),
    ]);
    setRooms(r.data || []);
    setPrograms(p.data || []);
    setTrainers(t.data || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  // ربط تلقائي حسب طلبك
  const autoLink = async () => {
    const mappings = [
      { name: "ياسر", code: "208" },
      { name: "محمد الشرقاوي", code: "203" },
      { name: "بكر الأحمدي", code: "204" },
      { name: "شيماء", code: "205" },
      { name: "آلاء", code: "206" },
    ];

    const db = supabase();
    for (let m of mappings) {
      const trainer = trainers.find(t => t.name.includes(m.name));
      const room = rooms.find(r => r.code === m.code);
      if (trainer && room) {
        await db.from("classrooms").update({ trainer_id: trainer.id }).eq("id", room.id);
      }
    }
    setMsg("✅ تم الربط التلقائي بنجاح (ياسر-208، الشرقاوي-203، بكر-204، شيماء-205، آلاء-206)");
    loadData();
  };

  const saveTrainer = async () => {
    if (!trainerForm.name.trim()) return setErr("اسم المدرب مطلوب");
    const db = supabase();
    const payload = {
      name: trainerForm.name,
      phone: trainerForm.phone || null,
      email: trainerForm.email || null,
    };
    let error;
    if (trainerForm.id) {
      ({ error } = await db.from("trainers").update(payload).eq("id", trainerForm.id));
    } else {
      ({ error } = await db.from("trainers").insert(payload));
    }
    if (error) setErr(error.message);
    else {
      setMsg("✅ تم حفظ المدرب بنجاح");
      setTrainerForm({ id: null, name: "", phone: "", email: "" });
      loadData();
    }
  };

  const saveRoom = async () => {
    if (!roomForm.code.trim()) return setErr("رمز القاعة مطلوب");
    const db = supabase();
    const payload = {
      code: roomForm.code,
      level: roomForm.level,
      program_id: roomForm.program_id || null,
      trainer_id: roomForm.trainer_id || null,
    };
    let error;
    if (roomForm.id) {
      ({ error } = await db.from("classrooms").update(payload).eq("id", roomForm.id));
    } else {
      ({ error } = await db.from("classrooms").insert(payload));
    }
    if (error) setErr(error.message);
    else {
      setMsg("✅ تم حفظ القاعة وربطها بنجاح");
      setRoomForm({ id: null, code: "", level: "A1", program_id: "", trainer_id: "" });
      loadData();
    }
  };

  const editTrainer = (t) => setTrainerForm({ id: t.id, name: t.name, phone: t.phone || "", email: t.email || "" });
  const editRoom = (r) => setRoomForm({ id: r.id, code: r.code, level: r.level || "A1", program_id: r.program_id || "", trainer_id: r.trainer_id || "" });

  const deleteTrainer = async (id) => {
    if (!confirm("حذف المدرب؟")) return;
    const db = supabase();
    await db.from("classrooms").update({ trainer_id: null }).eq("trainer_id", id);
    await db.from("trainers").delete().eq("id", id);
    loadData();
  };

  const deleteRoom = async (id) => {
    if (!confirm("حذف القاعة؟")) return;
    const db = supabase();
    await db.from("classrooms").delete().eq("id", id);
    loadData();
  };

  return (
    <div style={{ 
      padding: "20px", 
      fontFamily: "Cairo, sans-serif", 
      direction: "rtl", 
      background: "#0b1220", 
      color: "#e2e8f0", 
      minHeight: "100vh" 
    }}>
      <h1 style={{ fontSize: "28px", fontWeight: "900", textAlign: "center", marginBottom: "24px" }}>
        🏛️ إدارة المنصة - SUPER_ADMIN
      </h1>

      {err && <div style={{ background: "#7f1d1d", color: "#fda4af", padding: "14px", borderRadius: "12px", marginBottom: "16px" }}>{err}</div>}
      {msg && <div style={{ background: "#14532d", color: "#86efac", padding: "14px", borderRadius: "12px", marginBottom: "16px" }}>{msg}</div>}

      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", background: "#1e2937", padding: "8px", borderRadius: "16px" }}>
        <button 
          onClick={() => setTab("rooms")} 
          style={{ 
            padding: "12px 24px", 
            borderRadius: "12px", 
            background: tab === "rooms" ? TEAL : "transparent", 
            color: tab === "rooms" ? "#fff" : "#cbd5e1", 
            border: "none", 
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          🏫 القاعات
        </button>
        <button 
          onClick={() => setTab("trainers")} 
          style={{ 
            padding: "12px 24px", 
            borderRadius: "12px", 
            background: tab === "trainers" ? TEAL : "transparent", 
            color: tab === "trainers" ? "#fff" : "#cbd5e1", 
            border: "none", 
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          👨‍🏫 المدربين
        </button>
      </div>

      {tab === "rooms" && (
        <div>
          <div style={{ background: "#1e2937", borderRadius: "16px", padding: "24px", marginBottom: "20px" }}>
            <h3 style={{ marginBottom: "16px", color: "#a5f3fc" }}>إنشاء قاعة جديدة + ربط ببرنامج ومدرب</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <input 
                placeholder="رمز القاعة (203)" 
                value={roomForm.code} 
                onChange={e => setRoomForm({ ...roomForm, code: e.target.value })} 
                style={{ padding: "12px", background: "#334155", border: "none", borderRadius: "10px", color: "#fff" }} 
              />
              <select 
                value={roomForm.program_id} 
                onChange={e => setRoomForm({ ...roomForm, program_id: e.target.value })} 
                style={{ padding: "12px", background: "#334155", border: "none", borderRadius: "10px", color: "#fff" }}
              >
                <option value="">اختر البرنامج</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select 
                value={roomForm.trainer_id} 
                onChange={e => setRoomForm({ ...roomForm, trainer_id: e.target.value })} 
                style={{ padding: "12px", background: "#334155", border: "none", borderRadius: "10px", color: "#fff" }}
              >
                <option value="">اختر المدرب</option>
                {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <button 
              onClick={saveRoom} 
              style={{ marginTop: "16px", width: "100%", background: TEAL, color: "#fff", padding: "14px", border: "none", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}
            >
              حفظ القاعة وربطها
            </button>
          </div>

          <button 
            onClick={autoLink} 
            style={{ 
              background: "#fbbf24", 
              color: "#000", 
              padding: "12px 24px", 
              border: "none", 
              borderRadius: "12px", 
              fontWeight: "bold", 
              marginBottom: "20px",
              width: "100%"
            }}
          >
            🔄 ربط تلقائي حسب الطلب (ياسر-208، الشرقاوي-203، بكر-204، شيماء-205، آلاء-206)
          </button>

          <div style={{ background: "#1e2937", borderRadius: "16px", padding: "4px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #334155" }}>
                  <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>كود القاعة</th>
                  <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>المستوى</th>
                  <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>المدرب</th>
                  <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>الحالة</th>
                  <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map(room => {
                  const trainer = trainers.find(t => t.id === room.trainer_id);
                  return (
                    <tr key={room.id} style={{ borderBottom: "1px solid #334155" }}>
                      <td style={{ padding: "12px", fontWeight: "700", color: "#67e8f9" }}>{room.code}</td>
                      <td style={{ padding: "12px" }}>{room.level || "—"}</td>
                      <td style={{ padding: "12px", color: trainer ? "#86efac" : "#f87171" }}>
                        {trainer ? trainer.name : "غير معين"}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ 
                          padding: "4px 12px", 
                          borderRadius: "999px", 
                          fontSize: "12px", 
                          fontWeight: "700",
                          background: trainer ? "#14532d" : "#450a0a",
                          color: trainer ? "#86efac" : "#fda4af"
                        }}>
                          {trainer ? "مرتبط" : "غير مرتبط"}
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <button onClick={() => editRoom(room)} style={{ background: "#334155", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "8px", marginRight: "6px" }}>تعديل</button>
                        <button onClick={() => deleteRoom(room.id)} style={{ background: "#7f1d1d", color: "#fda4af", border: "none", padding: "6px 12px", borderRadius: "8px" }}>حذف</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "trainers" && (
        <div>
          <div style={{ background: "#1e2937", borderRadius: "16px", padding: "20px", marginBottom: "20px" }}>
            <h3 style={{ marginBottom: "16px", color: "#a5f3fc" }}>إضافة مدرب جديد</h3>
            <input 
              placeholder="اسم المدرب (مثال: د/ ياسر)" 
              value={trainerForm.name} 
              onChange={e => setTrainerForm({ ...trainerForm, name: e.target.value })} 
              style={{ width: "100%", padding: "12px", background: "#334155", border: "none", borderRadius: "10px", color: "#fff", marginBottom: "12px" }} 
            />
            <input 
              placeholder="رقم الجوال" 
              value={trainerForm.phone} 
              onChange={e => setTrainerForm({ ...trainerForm, phone: e.target.value })} 
              style={{ width: "100%", padding: "12px", background: "#334155", border: "none", borderRadius: "10px", color: "#fff", marginBottom: "12px" }} 
            />
            <input 
              placeholder="الإيميل" 
              value={trainerForm.email} 
              onChange={e => setTrainerForm({ ...trainerForm, email: e.target.value })} 
              style={{ width: "100%", padding: "12px", background: "#334155", border: "none", borderRadius: "10px", color: "#fff", marginBottom: "20px" }} 
            />
            <button 
              onClick={saveTrainer} 
              style={{ width: "100%", background: "#10b981", color: "#fff", padding: "14px", border: "none", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}
            >
              حفظ المدرب
            </button>
          </div>

          <div style={{ background: "#1e2937", borderRadius: "16px", padding: "4px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #334155" }}>
                  <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>اسم المدرب</th>
                  <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>جوال</th>
                  <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>إيميل</th>
                  <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>القاعات المرتبطة</th>
                  <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {trainers.map(t => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #334155" }}>
                    <td style={{ padding: "12px", fontWeight: "700" }}>{t.name}</td>
                    <td style={{ padding: "12px" }}>{t.phone || "—"}</td>
                    <td style={{ padding: "12px" }}>{t.email || "—"}</td>
                    <td style={{ padding: "12px" }}>{rooms.filter(r => r.trainer_id === t.id).map(r => r.code).join(", ") || "لا توجد"}</td>
                    <td style={{ padding: "12px" }}>
                      <button onClick={() => editTrainer(t)} style={{ background: "#334155", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "8px", marginRight: "6px" }}>تعديل</button>
                      <button onClick={() => deleteTrainer(t.id)} style={{ background: "#7f1d1d", color: "#fda4af", border: "none", padding: "6px 12px", borderRadius: "8px" }}>حذف</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
