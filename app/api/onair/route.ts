// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/onair — «أَثَر معك — على الهواء» (P33)
 *  GET  ?meta=1                 (عام)   → الدرجات والوجوه والحدود والشعار
 *  GET  ?now=1                  (عام)   → الحاضرون الآن (الأسماء والصور لمن سجّل الدخول فقط؛ للزائر: عدد ووجوه ومجالات) + أرقام عامة + النوافذ القادمة
 *  GET  ?mine=1                 (مسجّل) → حضوري · أوجهي المتاحة · نوافذي · ساعاتي وشهادتي · صفّي (مرتَّبًا) · ما أستقبله الآن · طلباتي
 *  GET  ?request=<id>[&t=token] (طالب/مُستقبِل/مجهول بتوكنه) → الطلب + الرسائل (+ الرابط البديل بعد القبول)
 *  POST {action}
 *   presence {on, minutes?, face, receives, domains, alt_link}  · off
 *   window_add {weekday, from_min, to_min, note_ar} · window_remove {id}
 *   ask {kind, domain?, text, alias?}   (المجهول: quick فقط، طلب واحد مفتوح، معدّل IP)
 *   take {id} · message {id, text, t?} · close {id, outcome, t?} · changed {id, what_changed, t?} · cancel {id, t?}
 *   block {user_id} · unblock {user_id} · handover {id, to} · cert
 *  لا يصل أي احتياج (P32) إلى هنا إلا عَلَم «مترجم إشارة مطلوب» الذي يختاره الطالب بنفسه في الطلب.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { normalizeSite } from '../../../lib/portal/open';
import { randomCode } from '../../../lib/portal/profile';
import { signerFromEnv } from '../../../lib/portal/vc-server';
import { didWeb } from '../../../lib/portal/vc';
import { rateLimit, ipOf, tooMany } from '../../../lib/shield/ratelimit';
import { notify } from '../../../lib/portal/notify';
import { runAi, aiUsage, logAi } from '../../../lib/ai/athar';
import { GRADES, GRADE_LABEL, GRADE_HINT, FACES, FACE_AR, FACE_EN, STATUS_AR, OUTCOME_AR, ON_AIR_MINUTES, ON_AIR_MAX_MINUTES, QUICK_TIMEOUT_MIN, QUICK_CLOSE_MIN, SESSION_MINUTES, SESSION_EXTEND_MINUTES, MAX_OPEN_PER_ASKER, MAX_OPEN_ANON, MAX_WINDOWS, TEXT_MIN, TEXT_MAX, MSG_MAX, CHANGED_MAX, CERT_HOURS, CERT_MEETINGS, WEEKDAY_AR, TAGLINE_AR, cleanGrades, cleanDomains, cleanLink, cleanText, cleanWindow, allowedFaces, goOnAir, isOnAir, minutesLeft, alias as mkAlias, canTake, canClose, nextStatus, rankQueue, nextWindowAt, hhmm, summaryPrompt, localSummary, sessionEndsAt } from '../../../lib/onair/registry';
import type { Face, Grade, Outcome, Presence, Request as OnAirRequest } from '../../../lib/onair/registry';
import { loadPeople, directoryFacesOf, presentNow, myPresence, upsertPresence, windowsOf, getRequest, openRequests, activeFor, askedBy, countOpenBy, insertRequest, patchRequest, settleStale, messagesOf, postMessage, hoursFor, existingCert, issueOnAirCert, loadPublicStats, presentView, callReceivers } from '../../../lib/onair/load';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const PUBLIC_BUCKET = 'athar-public';
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false } }) : null; };
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
const publicUrlOf = (db: any) => (path: string) => { try { return String(db.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl); } catch { return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PUBLIC_BUCKET}/${path}`; } };
const ipHash = (req: Request) => createHash('sha256').update(`onair|${ipOf(req)}`).digest('hex').slice(0, 24);
const anonToken = () => randomCode(10) + randomCode(10);

type Who = { id: string; email: string; name: string; staff: boolean };
async function who(req: Request, db: any): Promise<Who | null> {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !U || !A) return null; const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('full_name,role').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: lower(data.user.email), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || ''), staff: STAFF.includes(String((prof as any)?.role || '').toUpperCase()) };
}
const META = { tagline_ar: TAGLINE_AR, grades: GRADES.map(g => ({ key: g, label: GRADE_LABEL[g], hint: GRADE_HINT[g] })), faces: FACES.map(f => ({ key: f, ar: FACE_AR[f], en: FACE_EN[f] })), status_ar: STATUS_AR, outcome_ar: OUTCOME_AR, weekdays_ar: WEEKDAY_AR,
  limits: { on_air_minutes: ON_AIR_MINUTES, on_air_max_minutes: ON_AIR_MAX_MINUTES, quick_timeout_min: QUICK_TIMEOUT_MIN, quick_close_min: QUICK_CLOSE_MIN, session_minutes: SESSION_MINUTES, session_extend_minutes: SESSION_EXTEND_MINUTES, max_open: MAX_OPEN_PER_ASKER, max_open_anon: MAX_OPEN_ANON, max_windows: MAX_WINDOWS, text_min: TEXT_MIN, text_max: TEXT_MAX, cert_hours: CERT_HOURS, cert_meetings: CERT_MEETINGS } };
const PRIVACY_AR = 'الحضور معلَن بإرادة أصحابه؛ الأسماء خلف تسجيل الدخول. لا يصل احتياجك (إن كتبته في «احتياجاتي») إلى أحد هنا — إلا إن طلبت بنفسك مترجم إشارة. لا نجوم ولا تقييم: «ما الذي تغيّر؟» يقرؤه من ساعدك وحده.';

/** هل يملك الطالب هذا الطلب (مسجّل أو مجهول بتوكنه)؟ */
const ownsAsk = (r: OnAirRequest, me: Who | null, t: string) => (me && r.asker_user_id === me.id) || (!r.asker_user_id && !!t && r.meta?.anon_token === t);
function viewOf(r: OnAirRequest, me: Who | null, t: string, presence?: Presence | null) {
  const asker = ownsAsk(r, me, t); const receiver = !!me && r.receiver_user_id === me.id;
  const { meta, asker_email, ...rest } = r as any;
  return { ...rest, status_ar: STATUS_AR[r.status], kind_ar: GRADE_LABEL[r.kind].ar, outcome_ar: r.outcome ? OUTCOME_AR[r.outcome] : null, i_am: asker ? 'asker' : receiver ? 'receiver' : me?.staff ? 'staff' : 'none',
    what_changed_ar: receiver || asker || me?.staff ? r.what_changed_ar : null, alt_link: asker && r.status === 'taken' && presence?.alt_link ? presence.alt_link : null, interpreter_wanted: !!meta?.interpreter_wanted,
    session_ends_at: r.kind === 'session' && r.taken_at ? sessionEndsAt(r.taken_at, !!meta?.extended) : null, extended: !!meta?.extended, closes_at: r.kind === 'quick' && r.taken_at ? new Date(Date.parse(r.taken_at) + QUICK_CLOSE_MIN * 60000).toISOString() : null };
}

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const u = new URL(req.url); const now = new Date(); const pub = publicUrlOf(db);
  if (u.searchParams.get('meta') === '1') return NextResponse.json({ success: true, meta: META, privacy_ar: PRIVACY_AR });
  if (u.searchParams.get('now') === '1') {
    const me = await who(req, db); const present = await presentNow(db, now); const people = await loadPeople(db, present.map(p => p.user_id), pub);
    const view = presentView(present, people, now.getTime()).map(p => me ? p : { ...p, name_ar: null, slug: null, photo_url: null, title_ar: null, user_id: null });
    const stats = await loadPublicStats(db, now); const wins = await windowsOf(db); const wpeople = await loadPeople(db, wins.map(w => w.user_id), pub);
    const upcoming = wins.map(w => ({ id: w.id, weekday_ar: WEEKDAY_AR[w.weekday], from: hhmm(w.from_min), to: hhmm(w.to_min), note_ar: w.note_ar, at: nextWindowAt(w, now).toISOString(), name_ar: me ? (wpeople[w.user_id]?.name_ar || 'عضو هيئة أَثَر') : null, slug: me ? wpeople[w.user_id]?.slug || null : null })).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(0, 12);
    // «أسئلة أجاب عنها الهواء»: ما اعتمده الطاقم بصياغة عامة (بلا أسماء)
    const { data: fq } = await db.from('portal_onair_requests').select('id,domain,meta,done_at').in('status', ['done', 'escalated']).order('created_at', { ascending: false }).limit(300);
    const faq = ((fq || []) as any[]).filter(r => r.meta?.faq?.question_ar).slice(0, 30).map(r => ({ id: r.id, domain: r.domain, question_ar: r.meta.faq.question_ar, answer_ar: r.meta.faq.answer_ar, at: r.meta.faq.approved_at }));
    return NextResponse.json({ success: true, present: view, count: present.length, stats, upcoming, faq, signed_in: !!me, privacy_ar: PRIVACY_AR, tagline_ar: TAGLINE_AR });
  }
  const me = await who(req, db);
  if (u.searchParams.get('request')) {
    const t = String(u.searchParams.get('t') || ''); const r0 = await getRequest(db, u.searchParams.get('request')!); if (!r0) return bad('لا طلب بهذا الرقم', 404);
    const [r] = await settleStale(db, [r0], now.getTime());
    if (!ownsAsk(r, me, t) && !(me && (r.receiver_user_id === me.id || me.staff))) return bad('ليس طلبك', 403);
    const presence = r.receiver_user_id ? await myPresence(db, r.receiver_user_id) : null; const people = r.receiver_user_id ? await loadPeople(db, [r.receiver_user_id], pub) : {};
    const rp = r.receiver_user_id ? people[r.receiver_user_id] : null;
    return NextResponse.json({ success: true, request: viewOf(r, me, t, presence), messages: await messagesOf(db, r.id), receiver: r.receiver_user_id ? { name_ar: rp?.name_ar || (presence?.face === 'staff' ? 'طاقم أَثَر' : 'عضو هيئة أَثَر'), face_ar: presence ? FACE_AR[presence.face] : null, photo_url: rp?.photo_url || null, slug: rp?.slug || null } : null });
  }
  if (!me) return bad('يلزم تسجيل الدخول', 401);
  if (u.searchParams.get('mine') === '1') {
    const [presence, dirFaces, wins, hours, cert, active0, open0, asks0] = await Promise.all([myPresence(db, me.id), directoryFacesOf(db, me.id), windowsOf(db, me.id), hoursFor(db, me.id), existingCert(db, me.id), activeFor(db, me.id), openRequests(db), askedBy(db, me.id)]);
    const faces = allowedFaces({ directoryFaces: dirFaces, isStaff: me.staff, interpreterOk: !!presence?.meta?.interpreter_ok });
    const active = await settleStale(db, active0, now.getTime()); const open = (await settleStale(db, open0, now.getTime())).filter(r => r.status === 'open');
    const blocked: string[] = Array.isArray(presence?.meta?.blocked) ? presence!.meta.blocked : [];
    const queue = presence ? rankQueue(open.filter(r => !r.asker_user_id || (r.asker_user_id !== me.id && !blocked.includes(r.asker_user_id))), { receives: presence.receives, domains: presence.domains }) : [];
    const asks = await settleStale(db, asks0, now.getTime());
    return NextResponse.json({ success: true, me: { id: me.id, name: me.name, staff: me.staff }, presence: presence ? { ...presence, on_air: isOnAir(presence, now.getTime()), minutes_left: minutesLeft(presence, now.getTime()), alt_link: presence.alt_link, meta: { interpreter_ok: !!presence.meta?.interpreter_ok, blocked_n: blocked.length } } : null,
      faces: faces.map(f => ({ key: f, ar: FACE_AR[f] })), can_receive: faces.length > 0, windows: wins.map(w => ({ ...w, weekday_ar: WEEKDAY_AR[w.weekday], from: hhmm(w.from_min), to: hhmm(w.to_min) })),
      hours, cert: cert ? { code: cert.code, issued_at: cert.issued_at, verify_url: `${siteOf(req)}/verify/vc?code=${encodeURIComponent(cert.code)}` } : null,
      active: active.filter(r => r.status === 'taken').map(r => viewOf(r, me, '', presence)), queue: queue.map(r => viewOf(r, me, '', presence)), asks: asks.map(r => viewOf(r, me, '')), meta: META, privacy_ar: PRIVACY_AR });
  }
  return bad('طلب غير معروف');
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  let body: any = {}; try { body = await req.json(); } catch { return bad('جسم الطلب غير صالح'); }
  const action = String(body.action || ''); const now = new Date(); const iso = now.toISOString(); const site = siteOf(req); const me = await who(req, db); const t = String(body.t || '');

  // ── الطالب ──
  if (action === 'ask') {
    const kind = String(body.kind || '') as Grade; if (!GRADES.includes(kind)) return bad('اختر الدرجة: عونٌ سريع · جلسة دعم · استشارة');
    const text = cleanText(body.text, TEXT_MAX); if (text.length < TEXT_MIN) return bad(`اكتب سؤالك (${TEXT_MIN} أحرف على الأقل)`);
    const domain = cleanDomains([body.domain])[0] || null; const ipH = ipHash(req);
    if (!me) {
      if (kind !== 'quick') return bad('سجّل الدخول لطلب جلسة أو استشارة — «عونٌ سريع» متاح للجميع', 401);
      const rl = await rateLimit(db, `onair_anon:${ipOf(req)}`, 3600, 6); if (!rl.allowed) return tooMany(rl);
      if ((await countOpenBy(db, null, ipH)) >= MAX_OPEN_ANON) return bad('لديك طلب مفتوح بالفعل — انتظر ردّه أو ألغِه');
    } else if ((await countOpenBy(db, me.id, null)) >= MAX_OPEN_PER_ASKER) return bad(`لديك ${MAX_OPEN_PER_ASKER} طلبات مفتوحة — أغلق واحدًا أولًا`);
    const present = await presentNow(db, now);
    const anyone = present.some(p => p.receives.includes(kind));
    if (kind !== 'consult' && !anyone) return NextResponse.json({ success: false, nobody: true, error: 'لا أحد على الهواء لهذه الدرجة الآن', alternatives_ar: ['احجز نافذة قادمة من /on-air', 'اترك رسالة للطاقم من «تواصل»', 'اسأل أثير الآن (ذكاء اصطناعي — ليس إنسانًا)'] }, { status: 409 });
    const token = me ? null : anonToken();
    const r = await insertRequest(db, { kind, status: kind === 'consult' ? 'escalated' : 'open', asker_user_id: me?.id || null, asker_email: me?.email || null, asker_alias: cleanText(body.alias, 40) || (me?.name ? me.name.split(' ')[0] : mkAlias()), domain, text_ar: text, ip_hash: ipH, meta: { ...(token ? { anon_token: token } : {}), ...(body.interpreter_wanted === true ? { interpreter_wanted: true } : {}), site_lang: 'ar' } });
    await postMessage(db, r.id, 'asker', text).catch(() => null);
    let called = 0;
    if (kind === 'consult') { try { await notify(db, { kind: 'onair_consult', to: { email: process.env.ADMIN_EMAILS?.split(',')[0]?.trim() || null, name: 'طاقم أَثَر' }, ref: `onair:consult:${r.id}`, subject: `طلب استشارة من «على الهواء» — ${r.asker_alias}`, text: `${text}\n\nافتح: ${site}/admin/onair`, url: `${site}/admin/onair` }); } catch { /* يتابع */ } }
    else called = await callReceivers(db, r, present, site);
    return NextResponse.json({ success: true, request: viewOf(r, me, token || ''), t: token, called, note_ar: kind === 'consult' ? 'وصلت الطاقم؛ سيفتح عقد التعاون مع العضو ويعود إليك.' : `نادينا ${called} من الحاضرين — إن لم يردّ أحد خلال ${QUICK_TIMEOUT_MIN} دقائق نعرض البدائل.` });
  }
  if (['message', 'close', 'changed', 'cancel', 'extend'].includes(action)) {
    const r0 = await getRequest(db, body.id); if (!r0) return bad('لا طلب بهذا الرقم', 404); const [r] = await settleStale(db, [r0], now.getTime());
    const asker = ownsAsk(r, me, t); const receiver = !!me && r.receiver_user_id === me.id;
    if (!asker && !receiver && !me?.staff) return bad('ليس طلبك', 403);
    if (action === 'message') {
      if (r.status !== 'taken' && !(r.status === 'open' && asker)) return bad('الخيط مغلق');
      const text = cleanText(body.text, MSG_MAX); if (!text) return bad('اكتب رسالة');
      const m = await postMessage(db, r.id, asker ? 'asker' : 'receiver', text); return NextResponse.json({ success: true, message: m });
    }
    if (action === 'cancel') { if (!asker) return bad('الإلغاء للطالب'); if (!['open', 'taken'].includes(r.status)) return bad('الطلب مغلق'); const x = await patchRequest(db, r.id, { status: 'cancelled', done_at: iso }); return NextResponse.json({ success: true, request: viewOf(x!, me, t) }); }
    if (action === 'extend') { if (r.kind !== 'session' || r.status !== 'taken') return bad('التمديد لجلسة جارية'); if (r.meta?.extended) return bad('مُدّدت مرة واحدة'); const x = await patchRequest(db, r.id, { meta: { ...r.meta, extended: true } }); if (r.room_code) await db.from('portal_rooms').update({ minutes: SESSION_MINUTES + SESSION_EXTEND_MINUTES }).eq('code', r.room_code); await postMessage(db, r.id, 'system', `مُدّدت الجلسة ${SESSION_EXTEND_MINUTES} دقائق`).catch(() => null); return NextResponse.json({ success: true, request: viewOf(x!, me, t) }); }
    if (action === 'close') {
      const c = canClose(r, me?.id || '', !!me?.staff); if (!c.ok && !asker) return bad(c.error);
      const outcome = (['solved', 'needs_session', 'needs_staff'].includes(String(body.outcome)) ? String(body.outcome) : 'solved') as Outcome;
      const started = Date.parse(r.taken_at || r.created_at); const duration = Math.max(1, Math.min(240, Math.round((now.getTime() - started) / 60000)));
      const x = await patchRequest(db, r.id, { status: r.status === 'open' ? 'cancelled' : nextStatus(outcome), outcome, done_at: iso, duration_min: r.kind === 'session' ? Math.max(duration, 5) : duration });
      await postMessage(db, r.id, 'system', `أُغلق: ${OUTCOME_AR[outcome]}`).catch(() => null);
      if (outcome === 'needs_staff') { try { await notify(db, { kind: 'onair_escalate', to: { email: process.env.ADMIN_EMAILS?.split(',')[0]?.trim() || null, name: 'طاقم أَثَر' }, ref: `onair:esc:${r.id}`, subject: `تصعيد من «على الهواء» — ${r.asker_alias}`, text: `${r.text_ar}\n\nافتح: ${site}/admin/onair`, url: `${site}/admin/onair` }); } catch { /* يتابع */ } }
      // تلخيص للمُستقبِل (اختياري، يُرجع ولا يُحفظ إلا إن اعتمده الطالب)
      let summary: { summary_ar: string; source: string } | null = null;
      if (r.kind === 'quick' && receiver) {
        const msgs = await messagesOf(db, r.id); const p = summaryPrompt(msgs); const usage = await aiUsage(db, me!.id, 'onair_summary');
        const res = usage.allowed ? await runAi<{ summary_ar: string }>({ system: p.system, user: p.user, parse: raw => { const j = JSON.parse(String(raw).replace(/^```json|```$/g, '').trim()); const v = cleanText(j?.summary_ar, 600); return v ? { summary_ar: v } : null; }, local: () => ({ summary_ar: localSummary(msgs) }), budgetMs: 9000 }) : null;
        summary = res ? { summary_ar: res.data.summary_ar, source: res.source } : { summary_ar: localSummary(msgs), source: 'local' };
        if (res) await logAi(db, { user_id: me!.id, email: me!.email, role: 'USER', purpose: 'onair_summary', result: res, context: { request_id: r.id } });
      }
      return NextResponse.json({ success: true, request: viewOf(x!, me, t), summary });
    }
    if (action === 'changed') { if (!asker) return bad('«ما الذي تغيّر؟» للطالب وحده'); const w = cleanText(body.what_changed, CHANGED_MAX); const x = await patchRequest(db, r.id, { what_changed_ar: w || null }); return NextResponse.json({ success: true, request: viewOf(x!, me, t), note_ar: 'يقرؤها من ساعدك وحده، وتُحسب له لقاءً في «ما شهده أَثَر».' }); }
  }

  // ── المُستقبِل ──
  if (!me) return bad('يلزم تسجيل الدخول', 401);
  const presence = await myPresence(db, me.id);
  if (action === 'presence') {
    const dirFaces = await directoryFacesOf(db, me.id); const faces = allowedFaces({ directoryFaces: dirFaces, isStaff: me.staff, interpreterOk: !!presence?.meta?.interpreter_ok });
    if (!faces.length) return bad('الصعود إلى الهواء لأعضاء هيئة أَثَر المعتمَدين والطاقم — ابدأ بسيرتك في /me/directory', 403);
    if (presence?.grounded_at) return bad(`أُنزلت من الهواء بقرار الطاقم: ${presence.grounded_note || ''}`, 403);
    const face = (faces as string[]).includes(String(body.face)) ? String(body.face) as Face : faces[0];
    const receives = cleanGrades(body.receives ?? presence?.receives ?? ['quick', 'session']); if (!receives.length) return bad('اختر ما تستقبله');
    const domains = cleanDomains(body.domains ?? presence?.domains ?? []); const alt_link = body.alt_link === undefined ? presence?.alt_link || null : cleanLink(body.alt_link);
    if (body.alt_link && !alt_link) return bad('الرابط البديل يجب أن يبدأ بـ https://');
    const on = body.on !== false; const until = on ? goOnAir(Number(body.minutes) || ON_AIR_MINUTES, now.getTime()) : null;
    const row = await upsertPresence(db, { user_id: me.id, email: me.email, face, receives, domains, alt_link, on_air_until: until, meta: { ...(presence?.meta || {}), ...(on ? { last_on_at: iso } : {}) } });
    return NextResponse.json({ success: true, presence: { ...row, on_air: isOnAir(row!, now.getTime()), minutes_left: minutesLeft(row!, now.getTime()) }, note_ar: on ? `أنت على الهواء ${minutesLeft(row!, now.getTime())} دقيقة — ينطفئ وحده؛ جدّد متى شئت.` : 'نزلت من الهواء.' });
  }
  if (action === 'off') { if (!presence) return bad('لست على الهواء'); const row = await upsertPresence(db, { user_id: me.id, email: me.email, on_air_until: null }); return NextResponse.json({ success: true, presence: { ...row, on_air: false, minutes_left: 0 } }); }
  if (action === 'window_add') {
    if (!presence && !(await directoryFacesOf(db, me.id)).length && !me.staff) return bad('النوافذ لأعضاء الهيئة والطاقم', 403);
    const w = cleanWindow(body); if (!w.ok) return bad(w.error); const mine = await windowsOf(db, me.id); if (mine.length >= MAX_WINDOWS) return bad(`الحدّ ${MAX_WINDOWS} نوافذ`);
    const { data, error } = await db.from('portal_onair_windows').insert({ user_id: me.id, ...w.w }).select('id,user_id,weekday,from_min,to_min,note_ar').single(); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true, window: { ...data, weekday_ar: WEEKDAY_AR[data.weekday], from: hhmm(data.from_min), to: hhmm(data.to_min) } });
  }
  if (action === 'window_remove') { await db.from('portal_onair_windows').delete().eq('id', body.id).eq('user_id', me.id); return NextResponse.json({ success: true }); }
  if (action === 'take') {
    if (!presence || !isOnAir(presence, now.getTime())) return bad('اصعد إلى الهواء أولًا', 403);
    const r = await getRequest(db, body.id); if (!r) return bad('لا طلب بهذا الرقم', 404); const c = canTake(r, me.id); if (!c.ok) return bad(c.error, 409);
    if (!presence.receives.includes(r.kind)) return bad('لا تستقبل هذه الدرجة');
    let room_code: string | null = null;
    if (r.kind === 'session' && !presence.alt_link) { const code = randomCode(6); const { error } = await db.from('portal_rooms').insert({ code, title: `جلسة دعم · ${r.asker_alias}`, kind: 'support', created_by: me.id, prompt: r.text_ar.slice(0, 200), status: 'open', max_peers: 3, minutes: SESSION_MINUTES, notes: [] }); if (!error) room_code = code; }
    // سباق: أول من يحدّث الصف المفتوح
    const { data: x, error } = await db.from('portal_onair_requests').update({ status: 'taken', receiver_user_id: me.id, taken_at: iso, room_code }).eq('id', r.id).eq('status', 'open').select('id').maybeSingle();
    if (error || !x) return bad('سبقك زميل إلى هذا الطلب', 409);
    await postMessage(db, r.id, 'system', `${me.name ? me.name.split(' ')[0] : FACE_AR[presence.face]} معك الآن${room_code ? ` — الغرفة ${room_code}` : presence.alt_link && r.kind === 'session' ? ' — عبر رابط العضو' : ''}`).catch(() => null);
    if (r.asker_email) { try { await notify(db, { kind: 'onair_taken', to: { email: r.asker_email, name: null }, ref: `onair:taken:${r.id}`, subject: 'أحدهم معك الآن على الهواء', text: `ردّ على طلبك «${r.text_ar.slice(0, 80)}». افتح: ${site}/me/onair?r=${r.id}`, url: `${site}/me/onair?r=${r.id}` }); } catch { /* يتابع */ } }
    const full = await getRequest(db, r.id); return NextResponse.json({ success: true, request: viewOf(full!, me, '', presence), room_url: room_code ? `${site}/room/${room_code}` : null });
  }
  if (action === 'handover') {
    const r = await getRequest(db, body.id); if (!r || r.receiver_user_id !== me.id || r.status !== 'taken') return bad('ليس لديك هذا الطلب');
    const to = String(body.to || ''); const present = await presentNow(db, now); const target = present.find(p => p.user_id === to && p.receives.includes(r.kind)); if (!target) return bad('الزميل ليس على الهواء لهذه الدرجة');
    await patchRequest(db, r.id, { receiver_user_id: to, taken_at: iso, meta: { ...r.meta, handed_from: me.id } }); await postMessage(db, r.id, 'system', 'سُلّمت الراية إلى زميل على الهواء').catch(() => null);
    try { await notify(db, { kind: 'onair_handover', to: { email: target.email, name: null }, ref: `onair:hand:${r.id}:${to}`, subject: 'سُلّمت إليك راية على الهواء', text: `${r.asker_alias}: «${r.text_ar.slice(0, 120)}» — افتح ${site}/me/onair`, url: `${site}/me/onair` }); } catch { /* يتابع */ }
    return NextResponse.json({ success: true });
  }
  if (action === 'block' || action === 'unblock') {
    if (!presence) return bad('لست مُستقبِلًا'); const uid = String(body.user_id || ''); if (!uid) return bad('المستخدم؟');
    const blocked: string[] = Array.isArray(presence.meta?.blocked) ? presence.meta.blocked : []; const next = action === 'block' ? Array.from(new Set([...blocked, uid])).slice(0, 200) : blocked.filter(x => x !== uid);
    await upsertPresence(db, { user_id: me.id, email: me.email, meta: { ...presence.meta, blocked: next } }); return NextResponse.json({ success: true, blocked_n: next.length });
  }
  if (action === 'cert') {
    const hours = await hoursFor(db, me.id); const have = await existingCert(db, me.id);
    if (have && Number(have.vc?._athar?.hours || 0) >= hours.hours) return NextResponse.json({ success: true, code: have.code, verify_url: `${site}/verify/vc?code=${encodeURIComponent(have.code)}`, note_ar: 'شهادتك الحالية تغطّي ساعاتك' });
    const r = await issueOnAirCert(db, { id: me.id, email: me.email, name: me.name || 'عضو هيئة أَثَر', face: presence?.face || 'staff' }, hours, signerFromEnv(process.env, site), site, didWeb(site), () => randomCode(4), now);
    if (!r.ok) return bad(r.error);
    if (have?.id) await db.from('portal_vc_issuances').update({ revoked_at: iso }).eq('id', have.id).then(() => null, () => null);
    return NextResponse.json({ success: true, code: r.code, verify_url: r.verify_url, hours });
  }
  return bad('إجراء غير معروف');
}
