// @ts-ignore
Deno.serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  try {
    const { trainer_email, trainer_name, room_code, avg_score, total_responses } = await req.json();

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'API Key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Quality Platform <reports@resend.dev>',
        to: trainer_email,
        subject: `📊 تقرير أداء القاعة ${room_code}`,
        html: `
          <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 30px; background: #fff;">
            <div style="background: linear-gradient(135deg, #0f172a, #1e293b); color: #fff; padding: 30px; border-radius: 16px; text-align: center; margin-bottom: 30px;">
              <h1 style="margin: 0; font-size: 28px;">📊 تقرير الأداء الأسبوعي</h1>
              <p style="margin: 10px 0 0; opacity: 0.8;">منصة الجودة والتقييم التدريبي</p>
            </div>
            
            <div style="padding: 20px; background: #f8fafc; border-radius: 12px; margin-bottom: 20px;">
              <h2 style="color: #0f172a; margin-top: 0;">مرحباً ${trainer_name} 👋</h2>
              <p style="color: #475569; line-height: 1.8;">
                إليك ملخص أداء قاعتك <strong style="color: #10b981;">${room_code}</strong> لهذا الأسبوع:
              </p>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
              <div style="background: #eff6ff; padding: 25px; border-radius: 16px; text-align: center;">
                <div style="font-size: 14px; color: #64748b; margin-bottom: 8px;">متوسط الرضا</div>
                <div style="font-size: 42px; font-weight: 900; color: #2563eb;">${avg_score}<span style="font-size: 20px; color: #94a3b8;">/5</span></div>
              </div>
              <div style="background: #ecfdf5; padding: 25px; border-radius: 16px; text-align: center;">
                <div style="font-size: 14px; color: #64748b; margin-bottom: 8px;">إجمالي التقييمات</div>
                <div style="font-size: 42px; font-weight: 900; color: #10b981;">${total_responses}</div>
              </div>
            </div>
            
            <div style="background: #fffbeb; padding: 20px; border-radius: 12px; border-right: 4px solid #f59e0b; margin-bottom: 30px;">
              <p style="margin: 0; color: #92400e; font-weight: 600;">
                💡 نصيحة: استمر في بذل الجهد! ملاحظاتك القيّمة تساعدنا في تحسين جودة التدريب.
              </p>
            </div>
            
            <div style="text-align: center; padding-top: 30px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 13px;">
              <p>هذا التقرير مُولَّد تلقائياً من منصة الجودة والتقييم.</p>
            </div>
          </div>
        `
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: result.message || 'Failed to send email' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
