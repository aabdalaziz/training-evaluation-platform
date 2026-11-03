// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/miaar/rating — «غرفة التصحيح» (م4-ب) + «هيئة التصحيح» (م4-ج)
 *  من يدخل: الطاقم (profiles.role) أو من يحمل صلاحية miaar.rate عبر طبقة الأدوار (دور «المصحّح» RATER) — المصحّح يرى هذه الغرفة فقط.
 *  GET ?status=pending|second|adjudicate|released|anchors|all → الطابور (بلا أسماء) + العدّادات + حال الاعتماد + «مرآتي»
 *  GET ?id=<uuid>                   → تفصيل أداء: النص أو رابط صوت موقَّع 5 دقائق · المهمة · سُلّم التقدير · القراءات (عمياء لمن لم يقرأ بعد)
 *  GET ?agreement=1 (طاقم)          → اتفاق المصحّحين: كابا لكل مهارة ولكل زوج · مرايا المصحّحين مقنَّعة
 *  POST {action}
 *   rate {id, scores, note, release, seconds, force} → قراءة (أولى/ثانية/تحكيم/تأهيل) ثم إصدار إن جاز
 *   release {id, force}              → إصدار تقدير مكتمل (force للطاقم فقط ويُقيَّد)
 *   unrelease {id}                   → سحب إصدار
 *   ai_suggest {id}                  → «عيّنة المصحّح»: اقتراح أولي للنصوص بموافقة المتقدّم — لا يُنشر
 *   transcript {id, text, from_draft} → حفظ نسخ (بشري أو مسودّة راجعها المصحّح)
 *   transcript_draft {id}            → مسودّة نسخ من المزوّد (بموافقة المتقدّم) — لا تُحفظ
 *   anchor {id, anchor} (طاقم)       → تعيين/إلغاء مرساة اعتماد
 *   calibration_exempt {email, note} (طاقم) → إعفاء مصحّح من التأهيل (مقيَّد)
 *   purge (طاقم)                     → حذف الصوت المستحقّ الآن (180 يومًا)
 *  لا اسم ولا بريد في أي استجابة.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../../lib/shield/body';
import { ratingQueue, performanceDetail, ratePerformance, releasePerformance, unreleasePerformance, aiSuggest, agreementSummary, setAnchor, exemptRater, purgeExpiredMedia, saveTranscript, transcriptDraft } from '../../../../../lib/miaar/rating';
import type { Actor, QueueFilter } from '../../../../../lib/miaar/rating';
import { myRoles, hasPermission, loadCatalog } from '../../../../../lib/portal/roles';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const NO = { 'Cache-Control': 'no-store' };
async function ctx(req: Request): Promise<{ db: any; user: Actor } | { error: NextResponse }> {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const me = { id: data.user.id, email: String(data.user.email || '').toLowerCase() };
  const { data: prof } = await userDb.from('profiles').select('role').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (STAFF.includes(role)) return { db, user: { ...me, role, kind: 'staff' } };
  /* م4-ج: دور «المصحّح» عبر طبقة الأدوار — صلاحية miaar.rate فقط */
  const catalog = await loadCatalog(db); const mine = await myRoles(db, me, catalog);
  if (hasPermission(mine.roles, 'miaar.rate', catalog)) return { db, user: { ...me, role: 'RATER', kind: 'rater' } };
  return { error: bad('غير مصرّح — للطاقم والمصحّحين فقط', 403) };
}
const uuid = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{20,40}$/i.test(v) ? v : '');
const FILTERS: QueueFilter[] = ['pending', 'second', 'adjudicate', 'released', 'anchors', 'all'];

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const u = new URL(req.url);
  const id = uuid(u.searchParams.get('id'));
  if (id) { const d = await performanceDetail(db, id, user).catch(() => null); return d ? NextResponse.json({ success: true, performance: d }, { headers: NO }) : bad('الأداء غير موجود', 404); }
  if (u.searchParams.get('agreement') === '1') { if (user.kind !== 'staff') return bad('اتفاق المصحّحين للطاقم فقط', 403); const a = await agreementSummary(db).catch(() => null); return a ? NextResponse.json({ success: true, ...a }, { headers: NO }) : bad('تعذّرت قراءة الاتفاق — هل شُغّلت هجرة م4-ج؟', 500); }
  const st = u.searchParams.get('status') as QueueFilter | null; const status: QueueFilter = st && FILTERS.includes(st) ? st : 'pending';
  const q = await ratingQueue(db, status, user).catch(() => null); if (!q) return bad('تعذّرت قراءة الطابور — هل شُغّلت هجرة م4-ج؟', 500);
  return NextResponse.json({ success: true, ...q, actor_kind: user.kind }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const j = await readJson(req, { maxBytes: 64 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>;
  const action = String(b.action || '');
  if (action === 'purge') { if (user.kind !== 'staff') return bad('للطاقم فقط', 403); const r = await purgeExpiredMedia(db, 200).catch(() => ({ purged: 0 })); return NextResponse.json({ success: true, ...r, note_ar: r.purged ? `حُذف صوت ${r.purged} أداءً تجاوز 180 يومًا — بقي النصّ والتقدير` : 'لا صوت مستحقًّا للحذف الآن' }, { headers: NO }); }
  if (action === 'calibration_exempt') { if (user.kind !== 'staff') return bad('للطاقم فقط', 403); const r = await exemptRater(db, String(b.email || ''), String(b.note || ''), user); return r.ok ? NextResponse.json({ success: true, note_ar: 'أُعفي المصحّح من التأهيل — سُجّل من أعفاه ولماذا' }, { headers: NO }) : bad(r.error); }
  const id = uuid(b.id); if (!id) return bad('معرّف أداء غير صالح');
  if (action === 'rate') {
    const r = await ratePerformance(db, id, { scores: b.scores, note: b.note, release: b.release === true, seconds: b.seconds, force: b.force === true }, user);
    if (!r.ok) return bad(r.error);
    const note_ar = r.reading === 0 ? (r.calibration?.passed ? `اعتُمدت مصحّحًا — ${r.calibration.ar}` : `سُجّلت قراءة التأهيل — ${r.calibration?.ar || ''}`) : r.status === 'released' ? 'أُصدر التقدير — ظهر «معتمد» في بطاقة المتقدّم' : r.blocked_ar ? `حُفظت قراءتك — لم يُصدر: ${r.blocked_ar}` : r.agreement ? `حُفظت القراءة — ${r.agreement.kind_ar}` : 'حُفظ التقدير (لم يُصدر بعد)';
    return NextResponse.json({ success: true, ...r, note_ar }, { headers: NO });
  }
  if (action === 'release') { const r = await releasePerformance(db, id, user, b.force === true); return r.ok ? NextResponse.json({ success: true, note_ar: 'أُصدر التقدير — ظهر «معتمد» في بطاقة المتقدّم' }, { headers: NO }) : bad(r.error); }
  if (action === 'unrelease') { const ok = await unreleasePerformance(db, id); return ok ? NextResponse.json({ success: true, note_ar: 'سُحب الإصدار — عاد «قيد التصحيح»' }, { headers: NO }) : bad('لا يمكن سحب هذا الأداء'); }
  if (action === 'ai_suggest') { const r = await aiSuggest(db, id, user); return r.ok ? NextResponse.json({ success: true, rating: r.rating, source: r.source, note_ar: r.source === 'ai' ? 'اقتراح أولي — راجعه وعدّله، القرار لك' : 'لا اقتراح متاح' }, { headers: NO }) : bad(r.error); }
  if (action === 'transcript') { const r = await saveTranscript(db, id, b.text, b.from_draft === true); return r.ok ? NextResponse.json({ success: true, fluency: r.fluency, note_ar: 'حُفظ النسخ — يبقى مع المتقدّم بعد حذف الصوت' }, { headers: NO }) : bad(r.error); }
  if (action === 'transcript_draft') { const r = await transcriptDraft(db, id, user); return r.ok ? NextResponse.json({ success: true, draft: r.draft, source: r.source, note_ar: 'مسودّة — راجعها وصحّحها ثم احفظ' }, { headers: NO }) : bad(r.error); }
  if (action === 'anchor') { if (user.kind !== 'staff') return bad('المراسي يعيّنها الطاقم', 403); const r = await setAnchor(db, id, b.anchor === true); return r.ok ? NextResponse.json({ success: true, band: r.band, note_ar: b.anchor === true ? `صار مرساةً بدرجة ${r.band} — يُقاس عليه المصحّحون الجدد` : 'أُلغيت المرساة' }, { headers: NO }) : bad(r.error); }
  return bad('إجراء غير معروف');
}
