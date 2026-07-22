// @ts-nocheck
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { trainer_email, trainer_name, room_code, avg_score, total_responses } = await request.json();

    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      return NextResponse.json({ success: false, error: 'API Key not configured' }, { status: 500 });
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
          <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 30px;">
            <div style="background: #0f172a; color: #fff; padding: 30px; border-radius: 16px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">📊 تقرير الأداء الأسبوعي</h1>
            </div>
            <div style="padding: 20px;">
              <h2>مرحباً ${trainer_name} 👋</h2>
              <p>قاعتك: <strong>${room_code}</strong></p>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px;">
              <div style="background: #eff6ff; padding: 25px; border-radius: 12px; text-align: center;">
                <div>متوسط الرضا</div>
                <div style="font-size: 36px; font-weight: bold; color: #2563eb;">${avg_score}/5</div>
              </div>
              <div style="background: #ecfdf5; padding: 25px; border-radius: 12px; text-align: center;">
                <div>إجمالي التقييمات</div>
                <div style="font-size: 36px; font-weight: bold; color: #10b981;">${total_responses}</div>
              </div>
            </div>
          </div>
        `
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({ success: false, error: result.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
