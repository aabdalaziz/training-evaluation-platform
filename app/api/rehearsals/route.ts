// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/rehearsals — P45 «بروفة» (التمرين التبادلي بين الممارسين)
 *  GET  ?meta=1                      → الأسماء · القطاعات · الحدود (عام)
 *  GET  ?public=1                    → «ما تعلّمناه من البروفات» k≥5 + سطر الشهر (عام · بلا أسماء)
 *  GET  ?program=<id>                → بروفات مفتوحة لزملاء برنامج (عام · عدد وأدوار فقط)
 *  GET  ?room=<code>                 → بروفة هذه الغرفة لطرفيها (الحالة · الأدوار · روابط الجملتين)
 *  GET  ?prefill=need:<id>|case:<id> → تعبئة مسبقة من حاجة معلَنة أو موقف «كل يوم مهارة» (مسجَّل)
 *  GET  ?admin=1                     → الطاقم: كل البروفات بلا الجمل الخاصة
 *  GET                               → لوحتي: طلبات تنتظر من يلعب الدور (بلا أسماء) · بروفاتي · جملي · أهليتي
 *  POST create {sector, situation_ar, my_role_ar?, other_role_ar, mode, scheduled_at?, real_at?, circle, circle_ref?, source?, source_ref?}
 *  POST accept {id} · cancel {id} · finish {id} · note {id, kind, text_ar, public_ok?} · how {id, how} · report {id} · delete {id} (طاقم)
 *  لا ذكاء اصطناعي هنا؛ لا أسماء قبل القبول؛ لا نصّ من الغرفة يُحفظ.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSite } from '../../../lib/portal/open';
import { P45_NAMES_AR, SITUATION_MIN, SITUATION_MAX, ROLE_MAX, KIND_MAX, SELF_MAX, ROOM_MINUTES, NOW_HOURS, SCHEDULE_DAYS, PUBLIC_K, QUESTION_AR, HINT_AR, STATUS_AR, MODE_AR, CIRCLE_AR, HOW_AR, SOURCE_AR, cleanRequest, situationFromNeed, situationFromCase, boardSummaryAr, toView, canNote, canAnswerHow, isParty } from '../../../lib/rehearsal/registry';
import { SECTOR_CODES, SECTOR_OPTIONS, sectorAr, enrich, board, publicBoard, openForProgram, adminBoard, rehByRoom, createRehearsal, acceptRehearsal, cancelRehearsal, finishRehearsal, writeNote, answerHow, reportRehearsal, deleteRehearsal, needText, caseText } from '../../../lib/rehearsal/load';
import type { Me } from '../../../lib/rehearsal/load';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 30;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false } }) : null; };
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
const ID = /^[0-9a-z-]{1,40}$/i;
const staffEmails = () => String(process.env.NOTIFY_EMAILS || process.env.ADMIN_EMAILS || '').split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);

async function who(req: Request, db: any): Promise<Me | null> {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !U || !A) return null; const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('full_name,role').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: lower(data.user.email), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || '').trim(), staff: STAFF.includes(String((prof as any)?.role || '').toUpperCase()) };
}

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const sp = new URL(req.url).searchParams; const site = siteOf(req);
  if (sp.get('meta')) return NextResponse.json({ success: true, names_ar: P45_NAMES_AR, sectors: SECTOR_OPTIONS, min: SITUATION_MIN, max: SITUATION_MAX, role_max: ROLE_MAX, kind_max: KIND_MAX, self_max: SELF_MAX, room_minutes: ROOM_MINUTES, now_hours: NOW_HOURS, schedule_days: SCHEDULE_DAYS, k: PUBLIC_K, question_ar: QUESTION_AR, hint_ar: HINT_AR, status_ar: STATUS_AR, mode_ar: MODE_AR, circle_ar: CIRCLE_AR, how_ar: HOW_AR, source_ar: SOURCE_AR });
  if (sp.get('public')) return NextResponse.json({ success: true, ...(await publicBoard(db)), names_ar: P45_NAMES_AR });
  if (sp.get('program')) { const id = String(sp.get('program') || '').trim(); if (!ID.test(id)) return bad('معرّف غير صالح'); return NextResponse.json({ success: true, ...(await openForProgram(db, id)) }); }
  const me0 = await who(req, db); if (!me0) return bad('سجّل الدخول', 401);
  if (sp.get('admin')) { if (!me0.staff) return bad('غير مصرّح', 403); return NextResponse.json({ success: true, ...(await adminBoard(db, site)), status_ar: STATUS_AR }); }
  if (sp.get('room')) {
    const code = String(sp.get('room') || '').toUpperCase(); const r = await rehByRoom(db, code); if (!r) return NextResponse.json({ success: true, rehearsal: null });
    if (!isParty(r, me0) && !me0.staff) return bad('لست طرفًا في هذه البروفة', 403);
    return NextResponse.json({ success: true, rehearsal: toView(r, { me: me0, sectorAr }), can_note: canNote(r, me0).ok, can_how: canAnswerHow(r, me0), names_ar: P45_NAMES_AR });
  }
  if (sp.get('prefill')) {
    const [kind, id] = String(sp.get('prefill') || '').split(':'); if (!ID.test(String(id || ''))) return bad('معرّف غير صالح');
    if (kind === 'need') { const n = await needText(db, id); if (!n) return bad('الحاجة غير موجودة', 404); return NextResponse.json({ success: true, prefill: { sector: n.sector, situation_ar: situationFromNeed(n.text_ar), source: 'need', source_ref: id, circle: 'need', circle_ref: id } }); }
    if (kind === 'case') { const c = await caseText(db, id); if (!c) return bad('الموقف غير موجود', 404); return NextResponse.json({ success: true, prefill: { sector: SECTOR_CODES.includes(String(c.domain_code)) ? c.domain_code : '', ...situationFromCase(c), source: 'case', source_ref: id, circle: 'all', circle_ref: null } }); }
    return bad('مصدر غير معروف');
  }
  const me = await enrich(db, me0); const b = await board(db, me, site);
  const progRows = (me.programs || []).length ? ((await db.from('programs').select('id,name_ar').in('id', me.programs!).limit(50)).data || []) : [];
  const programs = (progRows as any[]).filter(p => (me.programs || []).includes(String(p.id))).map(p => ({ id: String(p.id), name_ar: String(p.name_ar || '') }));
  return NextResponse.json({ success: true, open: b.open, mine: b.mine, notes: b.notes, programs, summary_ar: boardSummaryAr(b.summary_rows), me: { faculty: !!me.faculty, staff: me.staff, enrolled: !!me.enrolled, programs: me.programs || [], needs: me.needs || [] }, sectors: SECTOR_OPTIONS, names_ar: P45_NAMES_AR, question_ar: QUESTION_AR, hint_ar: HINT_AR, k: PUBLIC_K, room_minutes: ROOM_MINUTES });
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const me0 = await who(req, db); if (!me0) return bad('سجّل الدخول', 401); const site = siteOf(req);
  let body: any = {}; try { body = await req.json(); } catch { return bad('طلب غير صالح'); } const action = String(body.action || ''); const id = String(body.id || '').trim();
  if (action === 'create') {
    const c = cleanRequest(body, SECTOR_CODES); if (!c.ok) return bad(c.error); const me = await enrich(db, me0);
    const source = ['need', 'station', 'case', 'offer'].includes(String(body.source)) ? String(body.source) : 'free'; const ref = source === 'free' ? null : String(body.source_ref || '').slice(0, 60) || null;
    const r = await createRehearsal(db, me, c.r, { source, source_ref: ref }, site); if (!r.ok) return bad(r.error);
    return NextResponse.json({ success: true, id: r.reh.id, status: r.reh.status, note_ar: c.r.mode === 'now' ? `حُفظ طلبك — يبقى مفتوحًا ${NOW_HOURS === 2 ? 'ساعتين' : `${NOW_HOURS} ساعات`}. حين يقبله زميل تصلك الغرفة.` : 'حُفظ طلبك بموعده — حين يقبله زميل تصلك الغرفة، وتُفتح في موعدها.' });
  }
  if (!ID.test(id)) return bad('معرّف غير صالح');
  if (action === 'accept') { const me = await enrich(db, me0); const r = await acceptRehearsal(db, me, id, site); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, room_code: r.room_code, note_ar: `شكرًا — ستلعب دور «${r.reh.other_role_ar}». الغرفة ${r.reh.mode === 'now' ? 'جاهزة الآن' : 'تُفتح في موعدها'}.` }); }
  if (action === 'cancel') { const r = await cancelRehearsal(db, me0, id, site); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true }); }
  if (action === 'finish') { const r = await finishRehearsal(db, me0, id); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, note_ar: 'انتهت البروفة — اكتب جملتيك خلال 24 ساعة.' }); }
  if (action === 'note') { const kind = body.kind === 'to_self' ? 'to_self' : 'kind_to_partner'; const r = await writeNote(db, me0, id, kind, body.text_ar, !!body.public_ok, site); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, delivered: r.delivered, note_ar: kind === 'to_self' ? 'حُفظت لك — تُقترح عليك حين تكتب محطتك.' : r.delivered ? 'وصلت جملتك، ووصلتك جملته.' : 'حُفظت — تصله حين يكتب جملته لك (أو بعد 24 ساعة).' }); }
  if (action === 'how') { const r = await answerHow(db, me0, id, body.how); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true }); }
  if (action === 'report') { const r = await reportRehearsal(db, me0, id, site, staffEmails()); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, note_ar: 'أُغلقت الغرفة ووصل البلاغ إلى الطاقم.' }); }
  if (action === 'delete') { if (!me0.staff) return bad('غير مصرّح', 403); return NextResponse.json({ success: await deleteRehearsal(db, id) }); }
  return bad('إجراء غير معروف');
}
