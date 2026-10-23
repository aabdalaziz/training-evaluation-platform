/**
 * /api/reports/summary — الملخص التنفيذي الذكي عند الطلب
 *  POST { program?: string, days?: number }  — Bearer <access_token> لمستخدم من الطاقم
 *  يعيد { success, summary:{headline,bullets,risks,actions,source,model}, facts, ai:{configured,provider,error?} }
 *  يعمل بلا مفتاح AI (بديل محلي) — المفتاح AI_API_KEY اختياري
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateExecSummary } from '../../../../lib/ai/exec-summary';
import { loadSummaryFacts, aiCaller } from '../../../../lib/ai/summary-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST', 'TRAINER'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

export async function POST(req: Request) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !ANON) return bad('إعدادات الخادم غير مكتملة', 500);
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return bad('يرجى تسجيل الدخول أولاً', 401);
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: u, error: uErr } = await userClient.auth.getUser(token);
  if (uErr || !u?.user) return bad('جلسة المستخدم غير صالحة', 401);
  const { data: profile } = await userClient.from('profiles').select('role').eq('id', u.user.id).single();
  if (!ALLOWED.includes(String((profile as any)?.role || '').toUpperCase())) return bad('غير مصرح', 403);

  const body = await req.json().catch(() => ({}));
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY; const db = service ? createClient(SUPABASE_URL, service) : userClient;
  try {
    const facts = await loadSummaryFacts(db, { programId: body.program ? String(body.program) : undefined, days: Number(body.days) || 30 });
    const ai = body.ai === false ? { configured: false, provider: 'none' as string } : await aiCaller(30000);
    const summary = await generateExecSummary(facts, { callAi: ai.call }, 30000);
    if (service) { try { await db.from('audit_logs').insert({ actor_id: u.user.id, actor_email: u.user.email || null, actor_role: String((profile as any)?.role || ''), action: 'exec_summary', entity_type: 'ai', entity_label: facts.scope, source: 'app', metadata: { period: facts.period, source: summary.source, model: summary.model || null, provider: ai.provider } }); } catch { /* اختياري */ } }
    return NextResponse.json({ success: true, summary, facts, ai: { configured: ai.configured, provider: ai.provider, error: ai.error } });
  } catch (e: any) { return bad(e?.message || 'تعذر بناء الملخص', 500); }
}
