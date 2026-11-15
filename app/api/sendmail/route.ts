// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/sendmail — مسار قديم (الإصدار الأول) أُوقف نهائيًا في الفحص الأمني 2026-11-15.
 *  كان يرسل بريدًا إلى أي عنوان يُمرَّر في الجسم دون تحقّق من الهوية — أي «مُرحِّل بريد مفتوح» باسم النطاق الرسمي.
 *  البديل المعتمد: lib/portal/notify.ts (هوية + سجلّ تسليم + قناة واحدة لكل مستلم) عبر /api/reports/email وبقية المسارات المحمية.
 *  يعيد 410 Gone دون قراءة الجسم ودون أي اتصال خارجي، ويُسجَّل الاستدعاء في سجلّ الخادم فقط (بلا بيانات شخصية).
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const gone = () => NextResponse.json({ success: false, error: 'gone', message: 'هذا المسار أُوقف. استخدم المسارات المحمية لإرسال البريد.' }, { status: 410, headers: { 'Cache-Control': 'no-store', Allow: '' } });

export async function POST() { console.warn('[sendmail] legacy route called — 410'); return gone(); }
export async function GET() { return gone(); }
