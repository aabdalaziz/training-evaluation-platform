// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { confirmCode, filters, kind } = await req.json();

    // 1) كود التأكيد
    if (String(confirmCode) !== "9999") {
      return NextResponse.json({ success: false, error: "كود التأكيد غير صحيح" }, { status: 400 });
    }

    // 2) الأنواع المسموحة فقط
    if (!["DAILY", "FINAL", "BOTH"].includes(String(kind))) {
      return NextResponse.json({ success: false, error: "نوع غير مسموح" }, { status: 400 });
    }

    // 3) التحقق من المستخدم
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ success: false, error: "Missing token" }, { status: 401 });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
      return NextResponse.json({ success: false, error: "Server not configured" }, { status: 500 });
    }

    const authClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: u, error: uErr } = await authClient.auth.getUser(token);
    if (uErr || !u?.user?.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const adminEmail = u.user.email.toLowerCase();
    if (!ADMIN_EMAILS.includes(adminEmail)) {
      return NextResponse.json({ success: false, error: "غير مصرح (للإدارة فقط)" }, { status: 403 });
    }

    // 4) عميل الحذف بصلاحية Service Role
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 5) تحديد الاستبانات المستهدفة حسب الفلاتر
    let q = admin.from("evaluations").select("id");

    if (kind === "DAILY") q = q.eq("kind", "DAILY");
    if (kind === "FINAL") q = q.eq("kind", "FINAL");
    if (kind === "BOTH") q = q.in("kind", ["DAILY", "FINAL"]);

    if (filters?.classroomId && filters.classroomId !== "ALL") {
      q = q.eq("classroom_id", filters.classroomId);
    } else if (filters?.trainerId && filters.trainerId !== "ALL") {
      const { data: rooms } = await admin.from("classrooms").select("id").eq("trainer_id", filters.trainerId);
      const roomIds = (rooms || []).map((r) => r.id);
      if (!roomIds.length) {
        return NextResponse.json({ success: true, deleted: { evaluations: 0, answers: 0 } });
      }
      q = q.in("classroom_id", roomIds);
    }

    if (filters?.from) q = q.gte("submitted_at", new Date(filters.from).toISOString());
    if (filters?.to) {
      const to = new Date(filters.to);
      to.setHours(23, 59, 59, 999);
      q = q.lte("submitted_at", to.toISOString());
    }

    const { data: evals, error: evalErr } = await q;
    if (evalErr) throw evalErr;

    const ids = (evals || []).map((e) => e.id);
    if (!ids.length) {
      return NextResponse.json({ success: true, deleted: { evaluations: 0, answers: 0 } });
    }

    // 6) حذف نهائي: الإجابات أولًا ثم الاستبانات
    let deletedAnswers = 0;
    let deletedEvals = 0;

    const CHUNK = 500;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);

      const aDel = await admin.from("evaluation_answers").delete().in("evaluation_id", chunk).select("id");
      if (aDel.error) throw aDel.error;
      deletedAnswers += (aDel.data || []).length;

      const eDel = await admin.from("evaluations").delete().in("id", chunk).select("id");
      if (eDel.error) throw eDel.error;
      deletedEvals += (eDel.data || []).length;
    }

    // 7) سجل تدقيق (اختياري — يعمل فقط إذا أنشأت الجدول)
    await admin.from("purge_logs").insert({
      admin_email: adminEmail, kind, filters,
      deleted_evaluations: deletedEvals,
      deleted_answers: deletedAnswers
    }).catch(() => {});

    return NextResponse.json({ success: true, deleted: { evaluations: deletedEvals, answers: deletedAnswers } });
  } catch (e) {
    return NextResponse.json({ success: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
