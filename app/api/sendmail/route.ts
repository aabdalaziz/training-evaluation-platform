// @ts-nocheck
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { trainer_email, trainer_name, room_code, avg_score, total_responses } = body;

    console.log('Email request:', body);

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (!RESEND_API_KEY) {
      return NextResponse.json({ 
        success: false, 
        error: 'API Key missing',
        env: Object.keys(process.env).filter(k => k.includes('RESEND'))
      }, { status: 500 });
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
        subject: `تقرير القاعة ${room_code}`,
        html: `
          <div dir="rtl" style="font-family: Tahoma; padding: 20px;">
            <h1>مرحباً ${trainer_name}</h1>
            <p>تقرير القاعة ${room_code}</p>
            <p>متوسط الرضا: ${avg_score}/5</p>
            <p>عدد التقييمات: ${total_responses}</p>
          </div>
        `
      })
    });

    const result = await response.json();
    console.log('Resend response:', result);

    if (!response.ok) {
      return NextResponse.json({ success: false, error: result.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
