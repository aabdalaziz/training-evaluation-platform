// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/daily — «كل يوم مهارة» (بوابة أَثَر · P10)
 *  GET                      → درس اليوم {day, skill, lesson, source} (+ {answered, streak} إن كان Bearer صالحًا)
 *  POST { choice }          → تسجيل إجابة التحدي: للمستخدم تُحفظ مرة واحدة يوميًا وتُودَع حدث تعلّم (object_type=daily)؛ للزائر تُعاد النتيجة فقط
 *  التوليد: مهارة اليوم تُختار بتدوير حتمي على المهارات النشطة (نفس المهارة للجميع)، ويُكتب الدرس مرة واحدة ويُخزَّن في portal_daily_skill؛ بديل محلي إن تعذّر النموذج.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAi } from '../../../lib/ai/athar';
import { buildDailyPrompt, parseDaily, localDaily } from '../../../lib/ai/prompts';
import type { DailyLesson, DailySkillFacts } from '../../../lib/ai/prompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
/** يوم أَثَر بتوقيت الرياض (UTC+3) */
function riyadhDay(d = new Date()): string { return new Date(d.getTime() + 3 * 3600000).toISOString().slice(0, 10); }
const FALLBACK_SKILL = { id: '', code: 'ATH-PD-001', name_ar: 'تصميم البرامج التدريبية', name_en: 'Training program design', domain: 'pedagogy', description_ar: 'تحليل الاحتياج، صياغة الأهداف، بناء الحقيبة.' };

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { db, user: null as null | { id: string; email: string } };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { db, user: null };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase() } };
}

async function todayLesson(db: any): Promise<{ day: string; skill: DailySkillFacts['skill']; lesson: DailyLesson; source: string; model: string | null }> {
  const day = riyadhDay();
  const { data: cached } = await db.from('portal_daily_skill').select('day,skill_id,lesson,source,model').eq('day', day).maybeSingle();
  const { data: skills } = await db.from('portal_skills').select('id,code,name_ar,name_en,domain,description_ar').eq('active', true).order('code');
  const list: DailySkillFacts['skill'][] = (skills || []).length ? (skills as any[]) : [FALLBACK_SKILL];
  if (cached && (cached as any).lesson) { const sk = list.find(x => x.id === (cached as any).skill_id) || list[0]; return { day, skill: sk, lesson: (cached as any).lesson, source: (cached as any).source || 'cache', model: (cached as any).model || null }; }
  const dayIndex = Math.floor(new Date(day + 'T00:00:00Z').getTime() / 86400000); const skill = list[dayIndex % list.length];
  const facts: DailySkillFacts = { skill, day, weekday_ar: WEEKDAYS[new Date(day + 'T00:00:00Z').getUTCDay()] };
  const p = buildDailyPrompt(facts, 'ar');
  const res = await runAi<DailyLesson>({ system: p.system, user: p.user, parse: raw => parseDaily(raw), local: () => localDaily(facts), budgetMs: 25000 });
  // تخزين (تجاهل تعارض السباق)
  await db.from('portal_daily_skill').insert({ day, skill_id: skill.id || null, lesson: res.data, source: res.source, model: res.model });
  return { day, skill, lesson: res.data, source: res.source, model: res.model };
}
function streakOf(days: string[], today: string): number {
  const set = new Set(days); let n = 0; let d = new Date(today + 'T00:00:00Z');
  if (!set.has(today)) d = new Date(d.getTime() - 86400000);
  while (set.has(d.toISOString().slice(0, 10))) { n++; d = new Date(d.getTime() - 86400000); }
  return n;
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const t = await todayLesson(db);
  const pub = { ...t.lesson, challenge: { ...t.lesson.challenge, correct: -1, explain_ar: '' } }; // لا نكشف الإجابة قبل المحاولة
  let answered: null | { choice: number; correct: boolean } = null; let streak = 0; let total = 0;
  if (user) {
    const { data: rows } = await db.from('portal_daily_answers').select('day,choice,correct').eq('user_id', user.id).order('day', { ascending: false }).limit(120);
    const mine = (rows || []) as any[]; total = mine.length; const today = mine.find(r => r.day === t.day); if (today) answered = { choice: today.choice, correct: !!today.correct };
    streak = streakOf(mine.map(r => String(r.day).slice(0, 10)), t.day);
  }
  const { count } = await db.from('portal_daily_answers').select('id', { count: 'exact', head: true }).eq('day', t.day);
  return NextResponse.json({ success: true, day: t.day, skill: t.skill, lesson: answered ? t.lesson : pub, source: t.source, answered, streak, total, participants: count || 0 });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const choice = Number(body.choice); if (!Number.isInteger(choice) || choice < 0 || choice > 3) return bad('اختر إجابة');
  const t = await todayLesson(db); const correct = choice === t.lesson.challenge.correct;
  let streak = 0;
  if (user) {
    const { data: prev } = await db.from('portal_daily_answers').select('id,choice,correct').eq('user_id', user.id).eq('day', t.day).maybeSingle();
    if (!prev) {
      await db.from('portal_daily_answers').insert({ day: t.day, user_id: user.id, email: user.email, choice, correct });
      if (t.skill.id) await db.from('portal_learning_events').insert({ user_id: user.id, email: user.email, verb: 'assessed', object_type: 'daily', object_id: t.day, skills: [t.skill.id], context: { score: correct ? 100 : 40, day: t.day, skill_code: t.skill.code } });
    }
    const { data: rows } = await db.from('portal_daily_answers').select('day').eq('user_id', user.id).order('day', { ascending: false }).limit(120);
    streak = streakOf(((rows || []) as any[]).map(r => String(r.day).slice(0, 10)), t.day);
  } else {
    await db.from('portal_daily_answers').insert({ day: t.day, user_id: null, email: null, choice, correct });
  }
  return NextResponse.json({ success: true, correct, correct_index: t.lesson.challenge.correct, explain_ar: t.lesson.challenge.explain_ar, apply_ar: t.lesson.apply_ar, streak, saved: !!user });
}
