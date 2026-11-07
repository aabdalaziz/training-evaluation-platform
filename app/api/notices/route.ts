/**
 * P39 «إشعارات المتعلّم» — واجهة «تنبيهاتي» (داخل أَثَر)
 *  GET  /api/notices?limit=20[&unread=1]   → إشعارات صاحب الجلسة (ببريده) + عدد غير المقروء
 *  POST /api/notices {action:'read', ids:[…] | all:true} → تعليم مقروء
 *  P53: GET يعيد لكل «كلمة» (trainer_word) can_reply + my_reply · POST {action:'word_reply', notice_id, chip?, text?} → ردّ المتعلّم (لمسة أو سطر ≤ 200)
 *  P54: GET يعيد حدود «الأمانة الصوتية» voice{max_sec,max_bytes,mimes} و my_reply.voice_sec/transcript — الرفع نفسه عبر POST /api/me/voice-reply
 *  المتقدّم بلا حساب يرى إشعاراته على بطاقة نتيجته (/api/miaar?result=ML-…) — لا هنا.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { listNotices, markRead, KIND_AR, KIND_ICON } from '../../../lib/portal/notices';
import { myReplies, submitReply, chipLabel, CHIPS, REPLY_MAX, REPLIES_PER_HOUR, VOICE_LIMITS, VOICE_MIMES } from '../../../lib/portal/word-reply'; /* P53 · P54 */
import { rateLimit, tooMany } from '../../../lib/shield/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO = { 'Cache-Control': 'no-store' };
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO });

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('سجّل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user?.email) return { error: bad('جلسة الدخول غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  return { db, user: { id: data.user.id, email: String(data.user.email).toLowerCase() } };
}

const shape = (n: any) => ({ id: n.id, kind: n.kind, kind_ar: KIND_AR[n.kind as keyof typeof KIND_AR] || 'تنبيه', icon: KIND_ICON[n.kind as keyof typeof KIND_ICON] || '🔔', title_ar: n.title_ar, body_ar: n.body_ar, url: n.url, pushed: !!n.pushed, read_at: n.read_at, created_at: n.created_at });

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const u = new URL(req.url); const limit = Math.min(50, Math.max(1, Number(u.searchParams.get('limit') || 20) || 20)); const unreadOnly = u.searchParams.get('unread') === '1';
  const rows = await listNotices(db, user.email, { limit, unreadOnly });
  const unread = unreadOnly ? rows.length : (await listNotices(db, user.email, { limit: 50, unreadOnly: true })).length;
  /* P53: ردودي على «كلمات» مدرّبي */
  const wordIds = rows.filter((n: any) => n.kind === 'trainer_word').map((n: any) => String(n.id)); let mine = new Map<string, any>(); try { mine = await myReplies(db, user.email, wordIds); } catch { /* بلا ردود */ }
  const notices = rows.map((n: any) => ({ ...shape(n), ...(n.kind === 'trainer_word' ? { can_reply: true, my_reply: mine.get(String(n.id)) || null } : {}) }));
  return NextResponse.json({ success: true, unread, notices, reply: { chips: CHIPS, max: REPLY_MAX }, voice: { max_sec: VOICE_LIMITS.maxSeconds, max_bytes: VOICE_LIMITS.maxBytes, transcript_max: VOICE_LIMITS.transcriptMax, mimes: VOICE_MIMES } }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || 'read');
  if (action === 'read') {
    const n = await markRead(db, user.email, body.all ? 'all' : (Array.isArray(body.ids) ? body.ids.map(String) : []));
    return NextResponse.json({ success: true, marked: n }, { headers: NO });
  }
  if (action === 'word_reply') { /* P53 */
    const rl = await rateLimit(db, `wordreply:${user.id}`, 3600, REPLIES_PER_HOUR); if (!rl.allowed) return tooMany(rl);
    const r = await submitReply(db, { email: user.email, name: (body.name && String(body.name).slice(0, 80)) || null }, { notice_id: String(body.notice_id || ''), chip: body.chip, text: body.text });
    if ('error' in r) return bad(r.error, r.status);
    try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: 'LEARNER', action: 'word_reply', entity_type: 'notice', entity_id: r.row.notice_id, entity_label: 'ردّ على كلمة', source: 'portal', metadata: { chip: r.row.chip, chars: (r.row.text || '').length, created: r.created } }); } catch { /* التدقيق لا يوقف الردّ */ }
    return NextResponse.json({ success: true, reply: { chip: r.row.chip, chip_ar: chipLabel(r.row.chip), text: r.row.text, at: r.row.updated_at, editable: true, voice_sec: (r.row.meta as any)?.voice?.sec ?? null, transcript: (r.row.meta as any)?.transcript ?? null }, created: r.created, message: r.created ? 'وصل ردّك إلى مدرّبك — له وحده.' : 'عُدِّل ردّك.' }, { headers: NO });
  }
  return bad('إجراء غير معروف');
}
