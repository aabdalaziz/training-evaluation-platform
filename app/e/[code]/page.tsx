// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /e/<الرمز> — الرابط القصير للتقييم (P49): يحلّ الرمز في الخادم ويحوّل إلى استبيان النوع الصحيح مع ?link= فتُقفل بيانات البرنامج/الشعبة */
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { KIND_PATH, normalizeCode, type LinkKind } from '../../../lib/evaluation/links';

export const dynamic = 'force-dynamic';

export default async function ShortEvalLink({ params }: { params: { code: string } }) {
  const code = normalizeCode(params.code); let kind: LinkKind = 'DAILY';
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL, S = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (code && U && S) { try { const { data } = await createClient(U, S).from('evaluation_links').select('kind').eq('code', code).maybeSingle(); if (data?.kind) kind = String((data as any).kind).toUpperCase() as LinkKind; } catch { /* يُعرض الخطأ في صفحة الاستبيان */ } }
  redirect(`/evaluate/${KIND_PATH[kind] || 'daily'}?link=${encodeURIComponent(code || params.code || '')}`);
}
