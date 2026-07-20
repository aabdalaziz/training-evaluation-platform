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
  const [trainerForm, setTrainerForm] = useState({ full_name: "", email: "", phone: "" });

  const loadData = async () => {
    const db = supabase();
    const [r, p, t] = await Promise.all([
      db.from("classrooms").select("*").order("code"),
      db.from("programs").select("*").order("name"),
      db.from("profiles").select("*").order("full_name"),
    ]);
    setRooms(r.data || []);
    setPrograms(p.data || []);
    setTrainers(t.data || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveRoom = async () => {
    if (!roomForm.code) return setErr("رمز القاعة مطلوب (مثال: 203)");
    const db = supabase();
    const { error } = await db.from("classrooms").insert({
      code: roomForm.code,
      level: roomForm.level,
      program_id: roomForm.program_id || null,
      trainer_id: roomForm.trainer_id || null,
    });
    if (error) setErr(error.message);
    else {
      setMsg("✅ تم إنشاء القاعة وربطها بالبرنامج والمدرب بنجاح");
      setRoomForm({ code: "", level: "A1", program_id: "", trainer_id: "" });
      loadData();
    }
  };

  const saveTrainer = async () => {
    if (!trainerForm.full_name) return setErr("اسم المدرب مطلوب");
    const db = supabase();
    const { error } = await db.from("profiles").insert({
      full_name: trainerForm.full_name,
      email: trainerForm.email || null,
      phone: trainerForm.phone || null,
      role: "trainer",
    });
    if (error) setErr(error.message);
    else {
      setMsg("✅ تم حفظ بيانات المدرب بنجاح");
      setTrainerForm({ full_name: "", email: "", phone: "" });
      loadData();
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Cairo, sans-serif", direction: "rtl", background: "#f8fafc", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "28px", fontWeight: "900", marginBottom: "20px" }}>
        🏛️ إدارة المنصة - البرامج والقاعات والمدربين
      </h1>

      {err && <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "12px", borderRadius: "12px", marginBottom: "16px" }}>{err}</div>}
      {msg && <div style={{ background: "#d1fae5", color: "#065f46", padding: "12px", borderRadius: "12px", marginBottom: "16px" }}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* إضافة مدرب */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px", fontWeight: "800" }}>إضافة مدرب جديد</h3>
          <input
            placeholder="الاسم الكامل"
            value={trainerForm.full_name}
            onChange={(e) => setTrainerForm({ ...trainerForm, full_name: e.target.value })}
            style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "10px", marginBottom: "12px" }}
          />
          <input
            placeholder="رقم الجوال (05xxxxxxxx)"
            value={trainerForm.phone}
            onChange={(e) => setTrainerForm({ ...trainerForm, phone: e.target.value })}
            style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "10px", marginBottom: "12px" }}
          />
          <input
            placeholder="البريد الإلكتروني"
            value={trainerForm.email}
            onChange={(e) => setTrainerForm({ ...trainerForm, email: e.target.value })}
            style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "10px", marginBottom: "20px" }}
          />
          <button
            onClick={saveTrainer}
            style={{ width: "100%", background: "#0f172a", color: "#fff", padding: "14px", border: "none", borderRadius: "12px", fontWeight: "800", cursor: "pointer" }}
          >
            حفظ المدرب
          </button>
        </div>

        {/* إنشاء قاعة + ربط */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px", fontWeight: "800" }}>إنشاء قاعة جديدة + ربط ببرنامج ومدرب</h3>
          <input
            placeholder="رمز القاعة (مثال: 203)"
            value={roomForm.code}
            onChange={(e) => setRoomForm({ ...roomForm, code: e.target.value })}
            style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "10px", marginBottom: "12px" }}
          />
          <select
            value={roomForm.program_id}
            onChange={(e) => setRoomForm({ ...roomForm, program_id: e.target.value })}
            style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "10px", marginBottom: "12px" }}
          >
            <option value="">اختر البرنامج</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.title}
              </option>
            ))}
          </select>
          <select
            value={roomForm.trainer_id}
            onChange={(e) => setRoomForm({ ...roomForm, trainer_id: e.target.value })}
            style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "10px", marginBottom: "20px" }}
          >
            <option value="">اختر المدرب</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name || t.name || t.email}
              </option>
            ))}
          </select>
          <button
            onClick={saveRoom}
            style={{ width: "100%", background: "#10b981", color: "#fff", padding: "14px", border: "none", borderRadius: "12px", fontWeight: "800", cursor: "pointer" }}
          >
            حفظ القاعة وربطها
          </button>
        </div>
      </div>

      <div style={{ marginTop: "30px", background: "#0b1220", color: "#fff", borderRadius: "18px", padding: "20px" }}>
        <h3 style={{ margin: "0 0 16px" }}>القاعات الحالية ({rooms.length})</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #334155" }}>
                <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>كود القاعة</th>
                <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>المستوى</th>
                <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>البرنامج</th>
                <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>المدرب</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} style={{ borderBottom: "1px solid #334155" }}>
                  <td style={{ padding: "12px", fontWeight: "700" }}>{room.code}</td>
                  <td style={{ padding: "12px" }}>{room.level || "—"}</td>
                  <td style={{ padding: "12px" }}>{programs.find(p => p.id === room.program_id)?.name || "—"}</td>
                  <td style={{ padding: "12px", color: room.trainer_id ? "#10b981" : "#fbbf24" }}>
                    {trainers.find(t => t.id === room.trainer_id)?.full_name || "غير معين"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
