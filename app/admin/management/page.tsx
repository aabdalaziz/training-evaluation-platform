// @ts-nocheck
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { confirmCode, filters, kind } = body;

    if (String(confirmCode) !== "9999")
      return NextResponse.json({ success: false, error: "كود التأكيد غير صحيح (يجب 9999)" }, { status: 400 });

    const KIND = String(kind || "").toUpperCase();
    if (!new Set(["DAILY", "FINAL", "BOTH"]).has(KIND))
      return NextResponse.json({ success: false, error: "نوع غير مسموح: " + kind }, { status: 400 });

    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ success: false, error: "لا توجد جلسة دخول" }, { status: 401 });

    const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const missing = [];
    if (!URL_) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!ANON) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    if (!SERVICE) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    if (missing.length)
      return NextResponse.json({ success: false, error: "متغيرات ناقصة في Vercel: " + missing.join(", ") }, { status: 500 });

    const ADMINS = (process.env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

    const authClient = createClient(URL_, ANON);
    const { data: u, error: uErr } = await authClient.auth.getUser(token);
    if (uErr || !u?.user?.email)
      return NextResponse.json({ success: false, error: "تعذّر التحقق من الجلسة: " + (uErr?.message || "") }, { status: 401 });

    const email = u.user.email.toLowerCase();
    if (!ADMINS.length)
      return NextResponse.json({ success: false, error: "المتغير ADMIN_EMAILS فارغ في Vercel" }, { status: 403 });
    if (!ADMINS.includes(email))
      return NextResponse.json({ success: false, error: "بريدك غير مصرّح له: " + email }, { status: 403 });

    const admin = createClient(URL_, SERVICE);
    let q = admin.from("evaluations").select("id");
    if (KIND === "DAILY") q = q.eq("kind", "DAILY");
    else if (KIND === "FINAL") q = q.eq("kind", "FINAL");
    else q = q.in("kind", ["DAILY", "FINAL"]);

    if (filters?.classroomId && filters.classroomId !== "ALL") q = q.eq("classroom_id", filters.classroomId);
    else if (filters?.trainerId && filters.trainerId !== "ALL") {
      const { data: rooms } = await admin.from("classrooms").select("id").eq("trainer_id", filters.trainerId);
      const ids = (rooms || []).map(r => r.id);
      if (!ids.length) return NextResponse.json({ success: true, deleted: { evaluations: 0, answers: 0 } });
      q = q.in("classroom_id", ids);
    }
    if (filters?.from) q = q.gte("submitted_at", new Date(filters.from).toISOString());
    if (filters?.to) { const to = new Date(filters.to); to.setHours(23, 59, 59, 999); q = q.lte("submitted_at", to.toISOString()); }

    const { data: evals, error: eErr } = await q;
    if (eErr) return NextResponse.json({ success: false, error: "خطأ قراءة البيانات: " + eErr.message }, { status: 500 });

    const evalIds = (evals || []).map(e => e.id);
    if (!evalIds.length)
      return NextResponse.json({ success: false, error: "لا توجد استجابات مطابقة للفلاتر الحالية (تأكد من اختيار المدرب/القاعة/الفترة)" }, { status: 200 });

    let delAns = 0, delEval = 0;
    for (let i = 0; i < evalIds.length; i += 500) {
      const c = evalIds.slice(i, i + 500);
      const a = await admin.from("evaluation_answers").delete().in("evaluation_id", c).select("id");
      if (a.error) return NextResponse.json({ success: false, error: "فشل حذف الإجابات: " + a.error.message }, { status: 500 });
      delAns += (a.data || []).length;
      const e = await admin.from("evaluations").delete().in("id", c).select("id");
      if (e.error) return NextResponse.json({ success: false, error: "فشل حذف الاستبانات: " + e.error.message }, { status: 500 });
      delEval += (e.data || []).length;
    }

    await admin.from("purge_logs").insert({ admin_email: email, kind: KIND, filters, deleted_evaluations: delEval, deleted_answers: delAns }).catch(() => {});
    return NextResponse.json({ success: true, deleted: { evaluations: delEval, answers: delAns } });
  } catch (e) {
    return NextResponse.json({ success: false, error: "خطأ خادم: " + (e?.message || "unknown") }, { status: 500 });
  }
}
