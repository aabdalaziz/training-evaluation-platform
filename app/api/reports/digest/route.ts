/**
 * GET /api/reports/digest — الملخص الأسبوعي الآلي (Vercel Cron: الأحد 08:00 بتوقيت الرياض)
 * يقرأ جدول report_subscriptions ويرسل لكل مشترك موجزًا بنفس محرّك التحليلات المستخدم في مركز التقارير.
 *
 * الحماية: Authorization: Bearer <CRON_SECRET> (ترسله Vercel تلقائيًا عند ضبط المتغير CRON_SECRET)،
 *           أو ?key=<CRON_SECRET> للتشغيل اليدوي من المتصفح.
 * يحتاج: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET, (اختياري) NEXT_PUBLIC_SITE_URL.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  addDays, applyFilters, buildEvaluations, buildFacts, groupBy, kpis, narrative, periodComparison, riskRegister, riyadhDate, timeSeries,
  type Filters, type Lang, type Lookups,
} from '../../../../lib/reports/analytics';
import { REPORTS } from '../../../../lib/reports/catalog';
import { buildReportEmailHtml, mailSubject } from '../../../../lib/email/report-mail';
import { sendViaResend } from '../../../../lib/email/resend';
import { generateExecSummary, summaryHtml, factsFrom } from '../../../../lib/ai/exec-summary';
import { aiCaller } from '../../../../lib/ai/summary-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || url.searchParams.get('key') || '';
  if (!secret || given !== secret) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL; const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return NextResponse.json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY مطلوب' }, { status: 500 });
  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const dryRun = url.searchParams.get('dry') === '1';
  const site = (process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`).replace(/\/$/, '');

  // تنظيف سجل التدقيق (الاحتفاظ AUDIT_RETENTION_DAYS، الافتراضي 730 يومًا) — أسبوعيًا مع هذا الكرون
  let auditCleanup: number | null = null;
  if (!dryRun) {
    try {
      const { data: n, error: cErr } = await db.rpc('audit_logs_cleanup', { p_days: Number(process.env.AUDIT_RETENTION_DAYS) || 730 });
      if (!cErr) { auditCleanup = Number(n) || 0; if (auditCleanup > 0) await db.from('audit_logs').insert({ actor_id: null, action: 'audit_cleanup', entity_type: 'system', source: 'cron', metadata: { deleted: auditCleanup } }).then(() => null, () => null); }
    } catch { /* الدالة اختيارية */ }
  }

  const { data: subs, error: sErr } = await db.from('report_subscriptions').select('*').eq('active', true);
  if (sErr) return NextResponse.json({ success: false, error: sErr.message }, { status: 500 });
  if (!subs?.length) return NextResponse.json({ success: true, sent: 0, auditCleanup, message: 'لا توجد اشتراكات نشطة' });

  // تحميل البيانات مرة واحدة
  const [ev, an, qs, cl, tr, pg] = await Promise.all([
    db.from('evaluations').select('*'), db.from('evaluation_answers').select('*'), db.from('questions').select('*'),
    db.from('classrooms').select('*'), db.from('trainers').select('*'), db.from('programs').select('*'),
  ]);
  const err = [ev, an, qs, cl, tr, pg].find(r => r.error)?.error;
  if (err) return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  const lk: Lookups = { classrooms: cl.data || [], trainers: tr.data || [], programs: pg.data || [], questions: qs.data || [] };
  const allEvals = buildEvaluations(ev.data || [], an.data || [], lk);
  const facts = buildFacts(an.data || [], qs.data || []);
  const today = riyadhDate(new Date().toISOString());

  // تجميع المشتركين حسب (التقرير + الفلاتر + اللغة) لإرسال رسالة واحدة لكل مجموعة
  const groups = new Map<string, { report_id: string; filters: Filters; lang: Lang; emails: string[]; ids: string[] }>();
  for (const s of subs as any[]) {
    const key = `${s.report_id}|${JSON.stringify(s.filters || {})}|${s.lang}`;
    const g = groups.get(key) || { report_id: String(s.report_id), filters: (s.filters || {}) as Filters, lang: (s.lang === 'en' ? 'en' : 'ar') as Lang, emails: [] as string[], ids: [] as string[] };
    g.emails.push(s.email); g.ids.push(s.id); groups.set(key, g);
  }

  const aiRef: { current: Awaited<ReturnType<typeof aiCaller>> | null } = { current: null };
  const results: { report: string; to: number; ok: boolean; error?: string }[] = [];
  for (const g of Array.from(groups.values())) {
    try {
      const ar = g.lang === 'ar';
      const report = REPORTS.find(r => r.id === g.report_id) || REPORTS[0];
      const days = Number((g.filters as any).days || 7);
      const f: Filters = { ...g.filters, from: addDays(today, -(days - 1)), to: today };
      const evals = applyFilters(allEvals, f, lk);
      const k = kpis(evals, facts);
      const axes = groupBy('axis', evals, facts, lk, g.lang);
      const daily = timeSeries(evals, facts, 'day', lk, g.lang);
      const cmp = periodComparison(allEvals, facts, f, lk);
      const actions = riskRegister(evals, facts, lk, g.lang);
      const story = narrative(k, axes, daily, cmp, g.lang, ar ? 'الملخص الأسبوعي' : 'This weekly digest');
      const programName = f.programId ? (lk.programs.find(p => p.id === f.programId)?.[ar ? 'name_ar' : 'name_en'] || lk.programs.find(p => p.id === f.programId)?.name_ar) : null;
      const scope = `${programName || (ar ? 'كل البرامج' : 'All programs')} · ${ar ? `آخر ${days} يومًا` : `last ${days} days`} (${f.from} → ${f.to})`;
      const title = `${ar ? 'الملخص الأسبوعي' : 'Weekly digest'} — ${report.title[g.lang]}`;
      const q = new URLSearchParams({ type: report.id, lang: g.lang, preset: days === 30 ? '30d' : days === 14 ? '14d' : '7d', compare: '1' });
      if (f.programId) q.set('program', f.programId); if (f.trainerId) q.set('trainer', f.trainerId); if (f.classroomId) q.set('classroom', f.classroomId);
      let html = buildReportEmailHtml({ lang: g.lang, title, scope, generatedAt: today, audience: report.audience[g.lang], k, deltaMean: cmp?.deltaMean ?? null, story, actions, link: `${site}/reports/center?${q.toString()}` });
      // الملخص التنفيذي الذكي (عربي) — يُدرج أعلى القراءة التحليلية؛ بديل محلي عند غياب AI_API_KEY
      if (ar && url.searchParams.get('ai') !== '0') {
        try {
          const programsG = groupBy('program', evals, facts, lk, 'ar'); const trainersG = groupBy('trainer', evals, facts, lk, 'ar');
          const sf = factsFrom({ scope: programName || 'كل البرامج', period: `آخر ${days} يومًا (${f.from} → ${f.to})`, generatedAt: today, k, cmp, axes, programs: programsG, trainers: trainersG, actions });
          aiRef.current = aiRef.current || await aiCaller(20000);
          const sum = await generateExecSummary(sf, { callAi: aiRef.current.call }, 20000);
          html = html.replace('<div style="height:14px"></div>', '<div style="height:14px"></div>' + summaryHtml(sum));
        } catch { /* الملخص اختياري */ }
      }
      const subject = mailSubject({ lang: g.lang, title, scope, k });
      if (!dryRun) {
        await sendViaResend({ to: g.emails, subject, html, tags: [{ name: 'kind', value: 'digest' }] });
        await db.from('report_subscriptions').update({ last_sent_at: new Date().toISOString() }).in('id', g.ids);
        await db.from('audit_logs').insert({ actor_id: null, action: 'report_digest', entity_type: 'report', source: 'cron', metadata: { report: report.id, to: g.emails, scope } }).then(() => null, () => null);
      }
      results.push({ report: report.id, to: g.emails.length, ok: true });
    } catch (e: any) {
      results.push({ report: g.report_id, to: g.emails.length, ok: false, error: e?.message });
    }
  }
  return NextResponse.json({ success: true, dryRun, auditCleanup, groups: results.length, sent: results.filter(r => r.ok).reduce((s, r) => s + r.to, 0), results });
}
