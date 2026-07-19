// @ts-nocheck
export async function POST(req) {
  try {
    const body = await req.json();
    const { to, subject, html } = body;
    if (!to || !subject || !html) {
      return Response.json({ error: "بيانات ناقصة" }, { status: 400 });
    }
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      return Response.json({ error: "RESEND_API_KEY غير مضبوط في Vercel" }, { status: 500 });
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data.message || "فشل الإرسال" }, { status: res.status });
    }
    return Response.json({ ok: true, id: data.id });
  } catch (e) {
    return Response.json({ error: e.message || "خطأ" }, { status: 500 });
  }
}
