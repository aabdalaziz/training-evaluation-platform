// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { confirmCode, filters, kind } = await req.json();

    // رمز تأكيد الحذف
    if (String(confirmCode) !== "9999") {
      return NextResponse.json(
        { success: false, error: "كود التأكيد غير صحيح" },
        { status: 400 }
      );
    }

    // نوع الاستجابات
    if (!["DAILY", "FINAL", "BOTH"].includes(String(kind))) {
      return NextResponse.json(
        { success: false, error: "نوع استجابات غير مسموح" },
        { status: 400 }
      );
    }

    // التحقق من جلسة المستخدم الحالية
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "يرجى تسجيل الدخول أولاً" },
        { status: 401 }
      );
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
      return NextResponse.json(
        { success: false, error: "إعدادات الخادم غير مكتملة" },
        { status: 500 }
      );
    }

    // قراءة المستخدم من رمز الجلسة
    const authClient = createClient(SUPABASE_URL, ANON_KEY);

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData?.user?.id) {
      return NextResponse.json(
        { success: false, error: "جلسة المستخدم غير صالحة" },
        { status: 401 }
      );
    }

    // عميل خادمي فقط: لا يرسل للمتصفح
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // التحقق من الدور الحقيقي داخل قاعدة البيانات
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();

    if (
      profileError ||
      !profile ||
      !["SUPER_ADMIN", "ADMIN"].includes(profile.role)
    ) {
      return NextResponse.json(
        { success: false, error: "غير مصرح (للإدارة فقط)" },
        { status: 403 }
      );
    }

    // تحديد الاستبيانات المطلوب حذفها
    let query = admin.from("evaluations").select("id");

    if (kind === "DAILY") {
      query = query.eq("kind", "DAILY");
    }

    if (kind === "FINAL") {
      query = query.eq("kind", "FINAL");
    }

    if (kind === "BOTH") {
      query = query.in("kind", ["DAILY", "FINAL"]);
    }

    // فلترة القاعة
    if (filters?.classroomId && filters.classroomId !== "ALL") {
      query = query.eq("classroom_id", filters.classroomId);
    }

    // فلترة المدرب
    if (
      !filters?.classroomId &&
      filters?.trainerId &&
      filters.trainerId !== "ALL"
    ) {
      const { data: classrooms, error: classroomError } = await admin
        .from("classrooms")
        .select("id")
        .eq("trainer_id", filters.trainerId);

      if (classroomError) throw classroomError;

      const classroomIds = (classrooms || []).map((item) => item.id);

      if (!classroomIds.length) {
        return NextResponse.json({
          success: true,
          deleted: { evaluations: 0, answers: 0 },
        });
      }

      query = query.in("classroom_id", classroomIds);
    }

    // فلترة الفترة
    if (filters?.from) {
      query = query.gte(
        "submitted_at",
        new Date(filters.from).toISOString()
      );
    }

    if (filters?.to) {
      const endDate = new Date(filters.to);
      endDate.setHours(23, 59, 59, 999);

      query = query.lte("submitted_at", endDate.toISOString());
    }

    const { data: evaluations, error: evaluationsError } = await query;

    if (evaluationsError) throw evaluationsError;

    const evaluationIds = (evaluations || []).map((item) => item.id);

    if (!evaluationIds.length) {
      return NextResponse.json({
        success: true,
        deleted: { evaluations: 0, answers: 0 },
      });
    }

    let deletedAnswers = 0;
    let deletedEvaluations = 0;

    // حذف على دفعات
    const CHUNK_SIZE = 500;

    for (let index = 0; index < evaluationIds.length; index += CHUNK_SIZE) {
      const batch = evaluationIds.slice(index, index + CHUNK_SIZE);

      // حذف الإجابات أولاً
      const { data: answers, error: answersError } = await admin
        .from("evaluation_answers")
        .delete()
        .in("evaluation_id", batch)
        .select("id");

      if (answersError) throw answersError;

      deletedAnswers += (answers || []).length;

      // ثم حذف الاستبيانات
      const { data: deleted, error: deleteError } = await admin
        .from("evaluations")
        .delete()
        .in("id", batch)
        .select("id");

      if (deleteError) throw deleteError;

      deletedEvaluations += (deleted || []).length;
    }

    // تسجيل عملية الحذف في سجل التدقيق
    await admin.from("audit_logs").insert({
      actor_id: authData.user.id,
      action: "PURGE_EVALUATIONS",
      entity_type: "evaluations",
      metadata: {
        kind,
        filters: filters || {},
        deleted_evaluations: deletedEvaluations,
        deleted_answers: deletedAnswers,
      },
    });

    return NextResponse.json({
      success: true,
      deleted: {
        evaluations: deletedEvaluations,
        answers: deletedAnswers,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "حدث خطأ داخلي في الخادم",
      },
      { status: 500 }
    );
  }
}
