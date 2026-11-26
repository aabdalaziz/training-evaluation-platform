// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P80 */ /** /security/mfa — التوثيق الثنائي: تفعيل تطبيق المصادقة · إدخال الرمز عند الدخول · إلغاء. */
import type { Metadata } from 'next';
import MfaClient from './MfaClient';

export const metadata: Metadata = { title: 'التوثيق الثنائي — أَثَر', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) { return <MfaClient challenge={searchParams.challenge === '1'} next={searchParams.next || null} />; }
