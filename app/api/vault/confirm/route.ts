// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/vault/confirm?t=<token>&a=undo — رابط التراجع عن النسيان من رسالة البريد (بلا تسجيل دخول؛ الرمز وحده يكفي ولا يُسجَّل)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { undoErasure } from '../../../../lib/vault/erasure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const page = (title: string, body: string, ok: boolean) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f2a4e;font-family:Tahoma,Arial,sans-serif;color:#0f2a4e}main{background:#fff;border-radius:18px;padding:28px 30px;max-width:520px;margin:20px;box-shadow:0 20px 60px rgba(0,0,0,.3)}h1{font-size:22px;margin:0 0 10px;color:${ok ? '#0b8a83' : '#b91c1c'}}p{line-height:1.9;color:#334155;font-size:15px}a{display:inline-block;margin-top:10px;background:#0f2a4e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px}small{color:#64748b}</style></head><body><main><h1>${title}</h1>${body}<small>خزنة أَثَر · نظام حماية البيانات الشخصية</small></main></body></html>`;

export async function GET(req: Request) {
  const u = new URL(req.url); const t = u.searchParams.get('t') || ''; const a = u.searchParams.get('a') || 'undo';
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!U || !S) return new NextResponse(page('إعدادات ناقصة', '<p>الخادم غير مهيأ.</p>', false), { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  const db = createClient(U, S);
  if (a !== 'undo') return new NextResponse(page('رابط غير معروف', '<p>لا نعرف هذا الإجراء.</p>', false), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  const r = await undoErasure(db, t);
  if (!r.ok) return new NextResponse(page('تعذّر التراجع', `<p>${r.error}</p><p>إن كان طلبك قد نُفِّذ فقد وصلك إيصال النسيان؛ وإن لم تكن أنت من طلب النسيان أصلًا فراسلنا فورًا.</p><a href="/me/data">ذاكرتي</a>`, false), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  return new NextResponse(page('أُوقف النسيان', `<p>حسابك وبياناتك باقية كما هي. لم يُحذف شيء.</p><p>يمكنك طلب النسيان مجددًا في أي وقت من صفحة «ذاكرتي».</p><a href="/me/data">ذاكرتي</a>`, true), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
