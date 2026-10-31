// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/onair — «أَثَر معك — على الهواء» (الطاقم)
 *  GET  → الحاضرون الآن (بالأسماء والبريد) · الصفّ الحي · التصعيدات والاستشارات · آخر 50 لقاءً (بلا نصوص الخيوط) · المُنزَلون · إحصاءات الشهر · pending_sql
 *  POST ground {user_id, note} · unground {user_id} · interpreter {user_id, ok} · resolve {id, note?} · faq {id, question_ar, answer_ar} (يُحفظ كسؤال شائع معتمَد في meta — يُعرض في /on-air)
 *  الطاقم يرى التصعيدات لا الخيوط؛ خيط «عون سريع» لا يُفتح إلا إن صُعّد إليه.
 *  P34: golden_set {title_ar, weekday, from_min, duration_min} · golden_off {id} · echo_make {id} (الذكاء الاصطناعي يصوغ مسودّة «مهارة اليوم» من سؤال أذن صاحبه) · echo_set {id, status, day?, draft?}
 *       GET يضيف golden · echoes · echo_candidates · bottles
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FACE_AR, GRADE_LABEL, STATUS_AR, OUTCOME_AR, isOnAir, minutesLeft, avgResponseMin, cleanText, cleanGolden, goldenState, countdownAr, WEEKDAY_AR, hhmm, echoPrompt, localEcho, parseEcho, scrubPii, localSummary, isBottle } from '../../../../lib/onair/registry';
import type { EchoDraft } from '../../../../lib/onair/registry';
import { runAi, aiUsage, logAi } from '../../../../lib/ai/athar';
import type { Presence, Request as OnAirRequest } from '../../../../lib/onair/registry';
import { loadPeople, messagesOf, patchRequest, postMessage, upsertPresence, goldenList, echoList, echoCandidates, saveEcho, setEcho, getRequest } from '../../../../lib/onair/load';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const PUBLIC_BUCKET = 'athar-public';
const publicUrlOf = (db: any) => (path: string) => { try { return String(db.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl); } catch { return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PUBLIC_BUCKET}/${path}`; } };
async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!STAFF.includes(role)) return { error: bad('غير مصرّح — للطاقم فقط', 403) };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || '') } };
}
const COLS = 'id,kind,status,asker_user_id,asker_alias,domain,text_ar,receiver_user_id,room_code,taken_at,done_at,outcome,duration_min,meta,created_at';

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c; const now = new Date(); const pub = publicUrlOf(db);
  const { data: pres, error: e1 } = await db.from('portal_onair_presence').select('user_id,email,face,receives,domains,alt_link,on_air_until,grounded_at,grounded_note,meta,updated_at').order('updated_at', { ascending: false }).limit(300);
  if (e1) return NextResponse.json({ success: true, pending_sql: true, error: e1.message, present: [], queue: [], escalations: [], recent: [], grounded: [], stats: null });
  const rows = (pres || []) as Presence[]; const people = await loadPeople(db, rows.map(p => p.user_id), pub);
  const nameOf = (uid: string | null) => uid ? people[uid]?.name_ar || (rows.find(p => p.user_id === uid)?.face === 'staff' ? 'طاقم أَثَر' : uid.slice(0, 8)) : '—';
  const present = rows.filter(p => isOnAir(p, now.getTime())).map(p => ({ user_id: p.user_id, email: p.email, name_ar: nameOf(p.user_id), face_ar: FACE_AR[p.face], receives: p.receives, domains: p.domains, minutes_left: minutesLeft(p, now.getTime()), has_link: !!p.alt_link }));
  const grounded = rows.filter(p => p.grounded_at).map(p => ({ user_id: p.user_id, email: p.email, name_ar: nameOf(p.user_id), face_ar: FACE_AR[p.face], grounded_at: p.grounded_at, note: p.grounded_note }));
  const interpreters = rows.filter(p => p.meta?.interpreter_ok).map(p => ({ user_id: p.user_id, email: p.email, name_ar: nameOf(p.user_id) }));
  const since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data: reqs } = await db.from('portal_onair_requests').select(COLS).gte('created_at', since).order('created_at', { ascending: false }).limit(1000);
  const all = (reqs || []) as OnAirRequest[];
  const v = (r: OnAirRequest) => ({ id: r.id, kind: r.kind, kind_ar: GRADE_LABEL[r.kind].ar, status: r.status, status_ar: STATUS_AR[r.status], asker_alias: r.asker_alias, domain: r.domain, text_ar: r.text_ar, receiver_ar: nameOf(r.receiver_user_id), room_code: r.room_code, created_at: r.created_at, taken_at: r.taken_at, done_at: r.done_at, outcome_ar: r.outcome ? OUTCOME_AR[r.outcome] : null, duration_min: r.duration_min, staff_note: r.meta?.staff_note || null, faq: r.meta?.faq || null, interpreter_wanted: !!r.meta?.interpreter_wanted });
  const queue = all.filter(r => ['open', 'taken'].includes(r.status)).map(v);
  const escalations = all.filter(r => r.status === 'escalated' && !r.meta?.resolved_at).map(v);
  const recent = all.filter(r => ['done', 'expired', 'cancelled'].includes(r.status) || r.meta?.resolved_at).slice(0, 50).map(v);
  const done = all.filter(r => r.status === 'done');
  const stats = { month: { asked: all.length, done: done.length, expired: all.filter(r => r.status === 'expired').length, escalated: all.filter(r => r.status === 'escalated').length, avg_response_min: avgResponseMin(all.filter(r => r.taken_at)), minutes: done.reduce((a, r) => a + (Number(r.duration_min) || 0), 0) }, present: present.length, receivers_total: rows.length, grounded: grounded.length, interpreters: interpreters.length };
  // P34
  const golden = (await goldenList(db)).map(g => { const st = goldenState(g, now); return { ...g, weekday_ar: WEEKDAY_AR[g.weekday], from: hhmm(g.from_min), live: st.live, countdown_ar: countdownAr(st.minutes_to), starts_at: st.starts_at }; });
  const pledges = golden.length ? await db.from('portal_onair_golden_pledges').select('golden_id,week_key').in('golden_id', golden.map(g => g.id)).limit(2000).then((x: any) => (x.data || []) as any[], () => [] as any[]) : [];
  const goldenView = golden.map(g => ({ ...g, pledged: pledges.filter((p: any) => String(p.golden_id) === String(g.id) && p.week_key === goldenState(g, now).week_key).length }));
  const [echoes, cands] = await Promise.all([echoList(db), echoCandidates(db)]);
  const echoedIds = new Set(echoes.map((e: any) => String(e.request_id)));
  const echo_candidates = cands.filter(r => !echoedIds.has(String(r.id))).map(r => ({ id: r.id, kind_ar: GRADE_LABEL[r.kind].ar, domain: r.domain, text_ar: r.text_ar, receiver_ar: nameOf(r.receiver_user_id), done_at: r.done_at }));
  const bottles = all.filter(r => r.status === 'open' && isBottle(r)).length;
  return NextResponse.json({ success: true, pending_sql: false, present, queue, escalations, recent, grounded, interpreters, stats, golden: goldenView, echoes, echo_candidates, bottles });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const iso = new Date().toISOString();
  let b: any = {}; try { b = await req.json(); } catch { return bad('جسم الطلب غير صالح'); }
  const action = String(b.action || '');
  if (action === 'ground' || action === 'unground') {
    const uid = String(b.user_id || ''); if (!uid) return bad('المستخدم؟'); const { data: p } = await db.from('portal_onair_presence').select('user_id,email,meta').eq('user_id', uid).maybeSingle(); if (!p) return bad('لا حضور لهذا المستخدم', 404);
    const note = cleanText(b.note, 300); if (action === 'ground' && note.length < 5) return bad('اكتب سبب الإنزال — يصل العضو');
    const row = await upsertPresence(db, { user_id: uid, email: (p as any).email, on_air_until: null, grounded_at: action === 'ground' ? iso : null, grounded_note: action === 'ground' ? note : null, meta: { ...((p as any).meta || {}), [action === 'ground' ? 'grounded_by' : 'ungrounded_by']: user.id } });
    return NextResponse.json({ success: true, presence: row });
  }
  if (action === 'interpreter') {
    const uid = String(b.user_id || ''); const email = cleanText(b.email, 160).toLowerCase(); if (!uid && !email) return bad('المستخدم أو بريده؟');
    let target = uid; let mail = email;
    if (!target && email) {
      const { data: pr } = await db.from('profiles').select('id,email').ilike('email', email).maybeSingle();
      if (pr) { target = String((pr as any).id); mail = String((pr as any).email || email).toLowerCase(); }
      else { const { data: dp } = await db.from('portal_directory_profiles').select('user_id,email').ilike('email', email).maybeSingle(); if (dp?.user_id) { target = String((dp as any).user_id); mail = String((dp as any).email || email).toLowerCase(); } }
      if (!target) return bad('لا حساب بهذا البريد — يسجّل المترجم الدخول مرة أولًا', 404);
    }
    const { data: p } = await db.from('portal_onair_presence').select('user_id,email,meta').eq('user_id', target).maybeSingle();
    const row = await upsertPresence(db, { user_id: target, email: (p as any)?.email || mail || `${target}@unknown`, ...(p ? {} : { face: 'interpreter', receives: ['quick', 'session'], domains: ['sign_language'] }), meta: { ...((p as any)?.meta || {}), interpreter_ok: b.ok !== false, interpreter_by: user.id } });
    return NextResponse.json({ success: true, presence: row, note_ar: b.ok !== false ? 'اعتُمد مترجمًا — يستطيع الصعود إلى الهواء بوجه «مترجم لغة إشارة»' : 'أُلغي اعتماد المترجم' });
  }
  if (action === 'resolve') {
    const { data: r } = await db.from('portal_onair_requests').select(COLS).eq('id', b.id).maybeSingle(); if (!r) return bad('لا طلب', 404);
    const x = await patchRequest(db, (r as any).id, { meta: { ...((r as any).meta || {}), resolved_at: iso, resolved_by: user.id, staff_note: cleanText(b.note, 300) || null } });
    await postMessage(db, (r as any).id, 'system', `تولّاه الطاقم${b.note ? `: ${cleanText(b.note, 300)}` : ''}`).catch(() => null);
    return NextResponse.json({ success: true, request: x });
  }
  if (action === 'thread') { const { data: r } = await db.from('portal_onair_requests').select('id,status,meta').eq('id', b.id).maybeSingle(); if (!r) return bad('لا طلب', 404); if ((r as any).status !== 'escalated' && !(r as any).meta?.faq_candidate) return bad('الطاقم يفتح خيوط التصعيد فقط', 403); return NextResponse.json({ success: true, messages: await messagesOf(db, (r as any).id) }); }
  if (action === 'faq') {
    const { data: r } = await db.from('portal_onair_requests').select(COLS).eq('id', b.id).maybeSingle(); if (!r) return bad('لا طلب', 404);
    const q = cleanText(b.question_ar, 200), a = cleanText(b.answer_ar, 800); if (q.length < 8 || a.length < 12) return bad('السؤال والجواب بصياغة عامة — بلا أسماء ولا تفاصيل شخصية');
    const x = await patchRequest(db, (r as any).id, { meta: { ...((r as any).meta || {}), faq: { question_ar: q, answer_ar: a, approved_by: user.id, approved_at: iso } } });
    return NextResponse.json({ success: true, request: x, note_ar: 'أُضيف إلى «أسئلة أجاب عنها الهواء» في /on-air' });
  }
  // ── P34 ──
  if (action === 'golden_set') {   // 1) ساعة الهواء الذهبية — واحدة فعّالة
    const g = cleanGolden(b); if (!g.ok) return bad(g.error);
    await db.from('portal_onair_golden').update({ active: false }).eq('active', true);
    const { data, error } = await db.from('portal_onair_golden').insert({ ...g.g, active: true, created_by: user.id }).select('id,title_ar,weekday,from_min,duration_min,active').single(); if (error) return bad(error.message, 500);
    const st = goldenState(data, new Date()); return NextResponse.json({ success: true, golden: { ...data, weekday_ar: WEEKDAY_AR[data.weekday], from: hhmm(data.from_min), countdown_ar: countdownAr(st.minutes_to), live: st.live }, note_ar: `أُعلنت «${data.title_ar}» — ${WEEKDAY_AR[data.weekday]} ${hhmm(data.from_min)} (${data.duration_min} دقيقة)` });
  }
  if (action === 'golden_off') { await db.from('portal_onair_golden').update({ active: false }).eq('id', b.id); return NextResponse.json({ success: true }); }
  if (action === 'echo_make') {   // 3) صدى السؤال — مسودّة بالذكاء الاصطناعي من سؤال أذن صاحبه (مجهّلًا)
    const r = await getRequest(db, b.id); if (!r || r.status !== 'done') return bad('الصدى من سؤال محلول');
    if (!r.meta?.echo_ok) return bad('لم يأذن السائل بذلك', 403);
    const msgs = await messagesOf(db, r.id); const input = { text_ar: scrubPii(r.text_ar), summary_ar: scrubPii(localSummary(msgs)), domain: r.domain };
    const p = echoPrompt(input); const usage = await aiUsage(db, user.id, 'onair_echo');
    const res = usage.allowed ? await runAi<EchoDraft>({ system: p.system, user: p.user, parse: raw => parseEcho(JSON.parse(String(raw).replace(/^```json|```$/g, '').trim())), local: () => localEcho(input), budgetMs: 12000 }) : null;
    const draft: EchoDraft = { ...(res ? res.data : localEcho(input)), domain_code: r.domain || null };
    if (res) await logAi(db, { user_id: user.id, email: user.email, role: 'ADMIN', purpose: 'onair_echo', result: res, context: { request_id: r.id } });
    const e = await saveEcho(db, r.id, draft, res?.model || null, user.id);
    return NextResponse.json({ success: true, echo: e, source: res?.source || 'local', note_ar: 'صيغت المسودّة — راجعها واختر يومًا ثم اعتمد.' });
  }
  if (action === 'echo_set') {
    const status = ['draft', 'approved', 'rejected'].includes(String(b.status)) ? String(b.status) : undefined; const day = b.day === undefined ? undefined : (String(b.day || '').match(/^\d{4}-\d{2}-\d{2}$/) ? String(b.day) : null);
    const draft = b.draft ? parseEcho(b.draft) : undefined; if (b.draft && !draft) return bad('المسودّة ناقصة (عنوان · موقف · مطلوب · معياران على الأقل)');
    if (status === 'approved' && !(day || (await db.from('portal_onair_echoes').select('day').eq('id', b.id).maybeSingle()).data?.day)) return bad('اختر يوم النشر قبل الاعتماد');
    const e = await setEcho(db, b.id, { ...(status ? { status } : {}), ...(day !== undefined ? { day } : {}), ...(draft ? { draft: { ...draft, domain_code: b.draft?.domain_code || null } } : {}) });
    return NextResponse.json({ success: true, echo: e, note_ar: status === 'approved' ? 'اعتُمد — سيظهر «مهارة اليوم» في يومه.' : 'حُفظ.' });
  }
  return bad('إجراء غير معروف');
}
