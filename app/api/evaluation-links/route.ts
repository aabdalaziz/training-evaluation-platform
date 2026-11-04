// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/evaluation-links — P49 «الرابط الذي لا يُخطئ»
 *  GET  ?code=XXXXXX            عام (بلا دخول): يحلّ الرمز → الرابط + البرنامج + الشعبة/الشعب المسموحة + حالة النافذة (ويزيد عدّاد الفتح)
 *  GET  ?list=1[&program=<id>]  للطاقم: قائمة الروابط مع أسماء البرامج/الشعب
 *  POST {action:'create'|'bulk'|'toggle'|'delete', ...}  للطاقم
 * القراءة والكتابة عبر مفتاح الخدمة (الجدول بلا سياسات عامة) + تحقّق الدور من profiles.role.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateLinkInput, linkCode, normalizeCode, linkState, allowedClassrooms, type EvalLink } from '../../../lib/evaluation/links';

export const dynamic = 'force-dynamic';
const STAFF_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const LINK_COLS = 'id,code,kind,program_id,classroom_id,level,label_ar,slot_ar,opens_at,closes_at,active,hits,last_hit_at,created_at';
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

function env() { const U = process.env.NEXT_PUBLIC_SUPABASE_URL, A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, S = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!U || !A || !S) return null; return { U, A, S }; }
async function staff(req: Request) {
  const e = env(); if (!e) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('سجّل الدخول أولًا', 401) };
  const { data } = await createClient(e.U, e.A).auth.getUser(token); const uid = data?.user?.id; if (!uid) return { error: bad('جلسة غير صالحة', 401) };
  const admin = createClient(e.U, e.S); const { data: prof } = await admin.from('profiles').select('role').eq('id', uid).maybeSingle();
  if (!prof || !STAFF_ROLES.includes(String((prof as any).role || '').toUpperCase())) return { error: bad('غير مصرّح (للطاقم فقط)', 403) };
  return { admin, uid };
}
async function names(admin: any, links: EvalLink[]) {
  const pids = Array.from(new Set(links.map(l => l.program_id))); const cids = Array.from(new Set(links.map(l => l.classroom_id).filter(Boolean) as string[]));
  const [{ data: progs }, { data: rooms }] = await Promise.all([
    pids.length ? admin.from('programs').select('id,name_ar,name_en').in('id', pids) : Promise.resolve({ data: [] }),
    cids.length ? admin.from('classrooms').select('id,code,section_name,level').in('id', cids) : Promise.resolve({ data: [] }),
  ]);
  return { programs: progs || [], classrooms: rooms || [] };
}

export async function GET(req: Request) {
  const e = env(); if (!e) return bad('إعدادات الخادم غير مكتملة', 500);
  const url = new URL(req.url); const code = normalizeCode(url.searchParams.get('code'));
  if (code) {
    const admin = createClient(e.U, e.S);
    const { data: link } = await admin.from('evaluation_links').select(LINK_COLS).eq('code', code).maybeSingle();
    if (!link) return NextResponse.json({ success: true, link: null, state: 'off' });
    const L = link as EvalLink; const state = linkState(L);
    const [{ data: program }, { data: rooms }] = await Promise.all([
      admin.from('programs').select('id,name_ar,name_en').eq('id', L.program_id).maybeSingle(),
      admin.from('classrooms').select('id,code,section_name,level,trainer_id').eq('program_id', L.program_id).order('code'),
    ]);
    const allowed = allowedClassrooms(L, (rooms || []) as any[]);
    void admin.from('evaluation_links').update({ hits: (Number(L.hits) || 0) + 1, last_hit_at: new Date().toISOString() }).eq('id', L.id).then(() => undefined, () => undefined);
    return NextResponse.json({ success: true, link: L, state, program: program || null, classrooms: allowed, classroom: L.classroom_id ? allowed.find(c => c.id === L.classroom_id) || null : null });
  }
  if (url.searchParams.get('list')) {
    const s = await staff(req); if ('error' in s) return s.error;
    let q = s.admin.from('evaluation_links').select(LINK_COLS).order('created_at', { ascending: false }).limit(300);
    const pid = url.searchParams.get('program'); if (pid) q = q.eq('program_id', pid);
    const { data, error } = await q; if (error) return bad(error.message, 500);
    const links = (data || []) as EvalLink[]; const nm = await names(s.admin, links);
    return NextResponse.json({ success: true, links: links.map(l => ({ ...l, state: linkState(l) })), ...nm });
  }
  return bad('حدّد ?code= أو ?list=1');
}

export async function POST(req: Request) {
  const s = await staff(req); if ('error' in s) return s.error;
  let b: any = {}; try { b = await req.json(); } catch { return bad('جسم الطلب غير صالح'); }
  const action = String(b.action || 'create');
  if (action === 'toggle') { if (!b.id) return bad('حدّد الرابط'); const { data, error } = await s.admin.from('evaluation_links').update({ active: !!b.active }).eq('id', String(b.id)).select(LINK_COLS).maybeSingle(); if (error) return bad(error.message, 500); if (!data) return bad('الرابط غير موجود', 404); return NextResponse.json({ success: true, link: { ...(data as EvalLink), state: linkState(data as EvalLink) } }); }
  if (action === 'delete') { if (!b.id) return bad('حدّد الرابط'); const { error } = await s.admin.from('evaluation_links').delete().eq('id', String(b.id)); if (error) return bad(error.message, 500); return NextResponse.json({ success: true }); }
  const v = validateLinkInput(b); if (!v.ok) return bad(v.error);
  const { data: program } = await s.admin.from('programs').select('id,name_ar').eq('id', v.value.program_id).maybeSingle(); if (!program) return bad('البرنامج غير موجود', 404);
  const admin = s.admin;
  async function freshCode() { for (let i = 0; i < 8; i++) { const c = linkCode(); const { data } = await admin.from('evaluation_links').select('id').eq('code', c).limit(1); if (!data?.length) return c; } return null; }
  if (action === 'bulk') {
    const { data: rooms } = await s.admin.from('classrooms').select('id,code,section_name,level').eq('program_id', v.value.program_id).order('code');
    const targets = v.value.level ? (rooms || []).filter((r: any) => String(r.level || '').trim() === v.value.level) : (rooms || []);
    if (!targets.length) return bad('لا توجد شعب لهذا البرنامج');
    const rows: any[] = []; for (const r of targets) { const code = await freshCode(); if (!code) return bad('تعذّر توليد رمز', 500); rows.push({ ...v.value, classroom_id: r.id, level: null, code, created_by: s.uid }); }
    const { data, error } = await s.admin.from('evaluation_links').insert(rows).select(LINK_COLS); if (error) return bad(error.message, 500);
    const links = (data || []) as EvalLink[]; const nm = await names(s.admin, links);
    return NextResponse.json({ success: true, links: links.map(l => ({ ...l, state: linkState(l) })), ...nm });
  }
  if (v.value.classroom_id) { const { data: room } = await s.admin.from('classrooms').select('id,program_id').eq('id', v.value.classroom_id).maybeSingle(); if (!room || String((room as any).program_id) !== v.value.program_id) return bad('الشعبة لا تتبع هذا البرنامج'); }
  const code = await freshCode(); if (!code) return bad('تعذّر توليد رمز', 500);
  const { data, error } = await s.admin.from('evaluation_links').insert({ ...v.value, code, created_by: s.uid }).select(LINK_COLS).maybeSingle(); if (error) return bad(error.message, 500);
  const L = data as EvalLink; const nm = await names(s.admin, [L]);
  return NextResponse.json({ success: true, link: { ...L, state: linkState(L) }, ...nm });
}
