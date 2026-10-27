// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/contracts — عقود الأثر (P12-ب) — مصادَق
 *  GET  ?admin=1                                  → الطاقم: كل العقود بحالتها الحية + ملخص المحفظة + الجهات والبرامج
 *  GET  ?admin=1&propose=1&org=ID&program=PID     → الطاقم: مقترح شريحة (تسجيلات البرنامج ∩ منسوبي الجهة/نطاقها)
 *  GET  ?org=ID                                   → مدير جهة مؤكَّد (أو طاقم): عقود الجهة بحالتها الحية (نسخة عامة: أعداد لا أسماء)
 *  POST { action:'create', form, cohort }          → WRITERS: مسودة عقد
 *  POST { action:'update', id, form, cohort }      → WRITERS: تعديل مسودة
 *  POST { action:'activate', id }                  → WRITERS: تفعيل + بريد للجهة برابط الصفحة الحية
 *  POST { action:'deliver', id, at? }              → WRITERS: إثبات التسليم (قرار بشري) → تُفتح نافذة الأثر
 *  POST { action:'release', id, milestone, note? } → WRITERS: الإفراج عن دفعة مستحقة بمذكرة مرقّمة + بريد
 *  POST { action:'cancel', id }                    → WRITERS: إلغاء
 *  POST { action:'pulse', dry? }                   → الطاقم: تشغيل/معاينة نبض العقود الآن
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSite } from '../../../lib/portal/open';
import { CONTRACT_COLS, rowToContract, stateFor, releaseMilestone, activateContract, runContractPulse } from '../../../lib/portal/contracts-cron';
import { validateContract, contractPayload, contractToken, publicContract, proposeCohort, portfolio } from '../../../lib/portal/contracts';
import type { Contract, ContractForm, CohortPerson, MilestoneKey } from '../../../lib/portal/contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const STAFF = [...WRITERS, 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const site = () => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL);

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return 
