// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";

export default function Management() {
  const router = useRouter();
  const [rooms, setRooms] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [roomForm, setRoomForm] = useState({ code: "", level: "A1", program_id: "", trainer_id: "" });
  const [trainerForm, setTrainerForm] = useState({ name: "", phone: "", email: "" });

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

  // ربط تلقائي حسب طلبك بالضبط
  const autoLinkTrainers = async () => {
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
    setMsg("✅ تم الربط التلقائي بنجاح:\nياسر → 208\nمحمد الشرقاوي → 203\nبكر الأحمدي → 204\nشيماء → 205\nآلاء → 206");
    loadData();
  };

  const saveTrainer = async () => {
    if (!trainerForm.name.trim()) return setErr("اسم المدرب مطلوب");
    const db = supabase();
    const { error } = await db.from("trainers").insert({
      name: trainerForm.name,
      phone: trainerForm.phone || null,
      email: trainerForm.email || null,
    });
    if (error) setErr(error.message);
    else {
      setMsg("✅ تم إضافة المدرب بنجاح");
      setTrainerForm({ name: "", phone: "", email: "" });
      loadData();
    }
  };

  const saveRoom = async () => {
    if (!roomForm.code.trim()) return setErr("رمز القاعة مطلوب");
    const db = supabase();
    const { error } = await db.from("classrooms").insert({
      code: roomForm.code,
      level: roomForm.level,
      program_id: roomForm.program_id || null,
      trainer_id: roomForm.trainer_id || null,
    });
    if (error) setErr(error.message);
    else {
      setMsg("✅ تم إنشاء القاعة وربطها بنجاح");
      setRoomForm({ code: "", level: "A1", program_id: "", trainer_id: "" });
      loadData();
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Cairo, sans-serif", direction: "rtl", background: "#0b1220", color: "#e2e8f0", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "28px", fontWeight: "900", textAlign: "center", marginBottom: "30px", color: "#fff" }}>
        🏛️ إدارة المنصة - البرامج والقاعات والمدربين
      </h1>

      {err && <div style={{ background: "#7f1d1d", color: "#fda4af", padding: "14px", borderRadius: "12px", marginBottom: "16px" }}>{err}</div>}
      {msg && <div style={{ background: "#14532d", color: "#86efac", padding: "14px", borderRadius: "12px", marginBottom: "16px" }}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* إضافة مدرب */}
        <div style={{ background: "#1e2937", borderRadius: "20px", padding: "24px" }}>
          <h3 style={{ marginBottom: "20px", color: "#a5f3fc" }}>إضافة مدرب جديد</h3>
          <input 
            placeholder="اسم المدرب (مثال: د/ ياسر)" 
            value={trainerForm.name} 
            onChange={e => setTrainerForm({ ...trainerForm, name: e.target.value })} 
            style={{ width: "100%", padding: "14px", background: "#334155", border: "none", borderRadius: "12px", color: "#fff", marginBottom: "12px" }} 
          />
          <input 
            placeholder="رقم الجوال" 
            value={trainerForm.phone} 
            onChange={e => setTrainerForm({ ...trainerForm, phone: e.target.value })} 
            style={{ width: "100%", padding: "14px", background: "#334155", border: "none", borderRadius: "12px", color: "#fff", marginBottom: "12px" }} 
          />
          <input 
            placeholder="البريد الإلكتروني" 
            value={trainerForm.email} 
            onChange={e => setTrainerForm({ ...trainerForm, email: e.target.value })} 
            style={{ width: "100%", padding: "14px", background: "#334155", border: "none", borderRadius: "12px", color: "#fff", marginBottom: "20px" }} 
          />
          <button 
            onClick={saveTrainer} 
            style={{ width: "100%", background: "#10b981", color: "#fff", padding: "14px", border: "none", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}
          >
            حفظ المدرب
          </button>
        </div>

        {/* إنشاء قاعة + ربط */}
        <div style={{ background: "#1e2937", borderRadius: "20px", padding: "24px" }}>
          <h3 style={{ marginBottom: "20px", color: "#a5f3fc" }}>إنشاء قاعة جديدة + ربط ببرنامج ومدرب</h3>
          <input 
            placeholder="رمز القاعة (مثال: 208)" 
            value={roomForm.code} 
            onChange={e => setRoomForm({ ...roomForm, code: e.target.value })} 
            style={{ width: "100%", padding: "14px", background: "#334155", border: "none", borderRadius: "12px", color: "#fff", marginBottom: "12px" }} 
          />
          <select 
            value={roomForm.program_id} 
            onChange={e => setRoomForm({ ...roomForm, program_id: e.target.value })} 
            style={{ width: "100%", padding: "14px", background: "#334155", border: "none", borderRadius: "12px", color: "#fff", marginBottom: "12px" }}
          >
            <option value="">اختر البرنامج</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select 
            value={roomForm.trainer_id} 
            onChange={e => setRoomForm({ ...roomForm, trainer_id: e.target.value })} 
            style={{ width: "100%", padding: "14px", background: "#334155", border: "none", borderRadius: "12px", color: "#fff", marginBottom: "20px" }}
          >
            <option value="">اختر المدرب</option>
            {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button 
            onClick={saveRoom} 
            style={{ width: "100%", background: "#10b981", color: "#fff", padding: "14px", border: "none", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}
          >
            حفظ القاعة وربطها
          </button>
        </div>
      </div>

      <div style={{ marginTop: "30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ color: "#e2e8f0" }}>القاعات الحالية ({rooms.length})</h3>
          <button 
            onClick={autoLink}
            style={{ 
              background: "#fbbf24", 
              color: "#000", 
              padding: "12px 24px", 
              border: "none", 
              borderRadius: "12px", 
              fontWeight: "bold", 
              cursor: "pointer" 
            }}
          >
            🔄 ربط تلقائي (ياسر-208، الشرقاوي-203، بكر-204، شيماء-205، آلاء-206)
          </button>
        </div>

        <div style={{ background: "#1e2937", borderRadius: "16px", padding: "4px", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #334155" }}>
                <th style={{ textAlign: "right", padding: "14px", color: "#94a3b8" }}>كود القاعة</th>
                <th style={{ textAlign: "right", padding: "14px", color: "#94a3b8" }}>المستوى</th>
                <th style={{ textAlign: "right", padding: "14px", color: "#94a3b8" }}>المدرب</th>
                <th style={{ textAlign: "right", padding: "14px", color: "#94a3b8" }}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map(room => {
                const trainer = trainers.find(t => t.id === room.trainer_id);
                return (
                  <tr key={room.id} style={{ borderBottom: "1px solid #334155" }}>
                    <td style={{ padding: "14px", fontWeight: "700", color: "#67e8f9" }}>{room.code}</td>
                    <td style={{ padding: "14px" }}>{room.level || "—"}</td>
                    <td style={{ padding: "14px", color: trainer ? "#86efac" : "#f87171" }}>
                      {trainer ? trainer.name : "غير معين"}
                    </td>
                    <td style={{ padding: "14px" }}>
                      <span style={{ 
                        padding: "6px 14px", 
                        borderRadius: "999px", 
                        fontSize: "12px", 
                        background: trainer ? "#14532d" : "#450a0a",
                        color: trainer ? "#86efac" : "#fda4af"
                      }}>
                        {trainer ? "مرتبط" : "غير مرتبط"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
