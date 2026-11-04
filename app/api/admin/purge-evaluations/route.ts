// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { confirmCode, filters, kind, preview } = await req.json();
    const dryRun = preview === true;

    // رمز تأكيد الحذف (غير مطلوب في وضع المعاينة)
    const PURGE_CODE = process.env.PURGE_CONFIRM_CODE || "9999";
    if (!dryRun && String(confirmCode) !== PURGE_CODE) {
      return NextResponse.json(
        { success: false, error: "كود التأكيد غير صحيح" },
        { status: 400 }
      );
    }

    // نوع الاستجابات
    // P49: END (نهاية البرنامج) · ALL (الأنواع الثلاثة) · REMOTE (استطلاع التعلم عن بُعد) · LINKS (روابط التقويم) · EMPTY_ROOMS (شعب بلا استجابات)
    if (!["DAILY", "FINAL", "END", "BOTH", "ALL", "REMOTE", "LINKS", "EMPTY_ROOMS"].includes(String(kind))) {
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
      !["PLATFORM_ADMIN", "SUPER_ADMIN", "ADMIN"].includes(String(profile.role).toUpperCase())
    ) {
      return NextResponse.json(
        { success: false, error: "غير مصرح (للإدارة فقط)" },
        { status: 403 }
      );
    }

    /* ───────── P49: أقدم من N شهرًا → يتحوّل إلى حدّ أعلى للتاريخ ───────── */
    const olderThanMonths = Number(filters?.olderThanMonths || 0);
    if (olderThanMonths > 0) { const d = new Date(); d.setMonth(d.getMonth() - olderThanMonths); const iso = d.toISOString().slice(0, 10); if (!filters.to || filters.to > iso) filters.to = iso; }

    /* ───────── P49: أنواع غير «evaluations» ───────── */
    if (kind === "REMOTE" || kind === "LINKS" || kind === "EMPTY_ROOMS") {
      const r = await purgeOther(admin, String(kind), filters || {}, !!dryRun, authData.user.id, authData.user.email || null);
      return NextResponse.json(r);
    }

    // تحديد الاستبيانات المطلوب حذفها
    let query = admin.from("evaluations").select("id");

    if (kind === "DAILY") {
      query = query.eq("kind", "DAILY");
    }

    if (kind === "FINAL") {
      query = query.eq("kind", "FINAL");
    }

    if (kind === "END") {
      query = query.eq("kind", "END");
    }

    if (kind === "BOTH") {
      query = query.in("kind", ["DAILY", "FINAL"]);
    }

    if (kind === "ALL") {
      query = query.in("kind", ["DAILY", "FINAL", "END"]);
    }

    // فلترة البرنامج
    if (filters?.programId && filters.programId !== "ALL") {
      query = query.eq("program_id", filters.programId);
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

    // وضع المعاينة: إرجاع الأعداد فقط دون أي حذف
    if (dryRun) {
      let answersCount = 0;
      for (let index = 0; index < evaluationIds.length; index += 500) {
        const batch = evaluationIds.slice(index, index + 500);
        const { count } = await admin
          .from("evaluation_answers")
          .select("id", { count: "exact", head: true })
          .in("evaluation_id", batch);
        answersCount += count || 0;
      }
      return NextResponse.json({
        success: true,
        preview: true,
        counts: { evaluations: evaluationIds.length, answers: answersCount },
      });
    }

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


/* ============================================================ P49: تفريغ ما ليس «evaluations»
 *  REMOTE      → remote_learning_survey_responses (برنامج/قاعة/مدرّب/فترة على submitted_at)
 *  LINKS       → evaluation_links (برنامج · الموقوفة أو المغلقة فقط عند filters.onlyInactive) — الاستجابات تبقى (link_id يصبح null)
 *  EMPTY_ROOMS → classrooms بلا أيّ استجابة (evaluations/remote) وبلا روابط — داخل البرنامج المحدّد (قاعدة P49: لا حذف لشعبة فيها بيانات)
 */
async function purgeOther(admin: any, kind: string, filters: any, dryRun: boolean, uid: string, email: string | null) {
  const pid = filters?.programId && filters.programId !== "ALL" ? String(filters.programId) : null;
  const cid = filters?.classroomId && filters.classroomId !== "ALL" ? String(filters.classroomId) : null;
  const tid = !cid && filters?.trainerId && filters.trainerId !== "ALL" ? String(filters.trainerId) : null;
  let ids: string[] = []; let label = "";
  if (kind === "REMOTE") {
    let q = admin.from("remote_learning_survey_responses").select("id");
    if (pid) q = q.eq("program_id", pid); if (cid) q = q.eq("classroom_id", cid); if (tid) q = q.eq("trainer_id", tid);
    if (filters?.from) q = q.gte("submitted_at", new Date(filters.from).toISOString());
    if (filters?.to) { const e = new Date(filters.to); e.setHours(23, 59, 59, 999); q = q.lte("submitted_at", e.toISOString()); }
    const { data, error } = await q; if (error) throw error; ids = (data || []).map((x: any) => x.id); label = "remote_learning_survey_responses";
  } else if (kind === "LINKS") {
    let q = admin.from("evaluation_links").select("id,active,closes_at");
    if (pid) q = q.eq("program_id", pid); if (cid) q = q.eq("classroom_id", cid);
    const { data, error } = await q; if (error) throw error;
    const now = Date.now();
    ids = (data || []).filter((l: any) => !filters?.onlyInactive || l.active === false || (l.closes_at && new Date(l.closes_at).getTime() < now)).map((x: any) => x.id); label = "evaluation_links";
  } else {
    if (!pid) return { success: false, error: "حدّد البرنامج أولًا لحذف الشعب الفارغة" };
    const { data: rooms, error } = await admin.from("classrooms").select("id").eq("program_id", pid); if (error) throw error;
    const all = (rooms || []).map((x: any) => x.id);
    if (all.length) {
      const [ev, rm, lk] = await Promise.all([
        admin.from("evaluations").select("classroom_id").in("classroom_id", all),
        admin.from("remote_learning_survey_responses").select("classroom_id").in("classroom_id", all),
        admin.from("evaluation_links").select("classroom_id").in("classroom_id", all),
      ]);
      const used = new Set([...(ev.data || []), ...(rm.data || []), ...(lk.data || [])].map((x: any) => x.classroom_id));
      ids = all.filter((id: string) => !used.has(id));
    }
    label = "classrooms";
  }
  if (dryRun) return { success: true, preview: true, counts: { evaluations: ids.length, answers: 0 }, kind, table: label };
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500);
    const { data, error } = await admin.from(label).delete().in("id", batch).select("id"); if (error) throw error; deleted += Array.isArray(data) && data.length ? data.length : batch.length;
  }
  void email;
  await admin.from("audit_logs").insert({ actor_id: uid, action: "PURGE_" + kind, entity_type: label, metadata: { kind, filters: filters || {}, deleted_evaluations: deleted, deleted_answers: 0 } });
  return { success: true, deleted: { evaluations: deleted, answers: 0 }, kind, table: label };
}
