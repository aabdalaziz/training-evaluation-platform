// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P50 «توقيعي» — ما ينتظر توقيعي · الاسم الرسمي: «سجلّ التوقيعات المعلّقة» / Pending Signatures Register
 *  صفحة واحدة تجمع كل ما ينتظر توقيعًا بشريًّا في أَثَر ومِعيار: العدد · منذ متى · أين يُوقَّع · و«توقيع بلمسة» حيث يكون آمنًا.
 *  - لا يقرّر شيئًا: اللمسة تستدعي الواجهات القائمة نفسها (approve_all) بصلاحية المستخدم نفسه.
 *  - كلٌّ يرى ما يخصّه: الطاقم يرى الكلّ؛ المدرّب شُعبه فقط؛ أصحاب الأبواب (P42-ب) قرارات أبوابهم.
 *  - بلا أسماء في الأعداد. لا جدول جديد: كل شيء يُقرأ من مصادره.
 *  الجزء الصرف: ageDays · orderGroups · summarize · digestText · SIGN_ACTION_RE · touchFor — الغراء: collectRegister · runSignDigest
 */
import { eligibleReport } from '../miaar/practice';
import type { DoorSlug } from './hub';

type Db = any;
export const SIGN_TITLE = { ar: 'توقيعي', en: 'My signatures' } as const;
export const SIGN_OFFICIAL = { ar: 'سجلّ التوقيعات المعلّقة', en: 'Pending Signatures Register' } as const;
export const SIGN_PATH = '/admin/sign';
/** الأفعال التي تُعدّ «توقيعًا» في سجلّ التدقيق — لعدّاد «وقّعتَ اليوم» */
export const SIGN_ACTION_RE = /approve|decide|promote|verdict|release|rate|accept|reject|publish|sign|place|grant|resolve|close|deliver|invoice/i;
export const SIGN_CACHE_MS = 45_000;

export type SignArea = 'miaar' | 'portal';
export type SignTouch = { action: 'practice_approve_all'; body: Record<string, string> };
export type SignItem = { id: string; label_ar: string; count: number; oldest_at: string | null; href: string; touch?: SignTouch };
export type SignGroup = { key: string; area: SignArea; title_ar: string; hint_ar: string; count: number; oldest_at: string | null; href: string; urgent?: boolean; deadline_days?: number | null; items?: SignItem[] };
export type SignRegister = { total: number; today_signed: number | null; oldest_days: number | null; groups: SignGroup[]; scope: 'all' | 'trainer' | 'doors'; computed_at: string };

/* ---------- صرف ---------- */
export const ageDays = (iso: string | null | undefined, now = new Date()): number | null => { if (!iso) return null; const t = Date.parse(iso); return Number.isFinite(t) ? Math.max(0, Math.floor((now.getTime() - t) / 86400000)) : null; };
const minIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);
/** الأقدم أولًا؛ العاجل يسبق عند التساوي؛ الفارغ لا يُعرض */
export function orderGroups(groups: readonly SignGroup[]): SignGroup[] {
  return groups.filter((g) => g.count > 0).slice().sort((a, b) => { const ta = a.oldest_at ? Date.parse(a.oldest_at) : Infinity; const tb = b.oldest_at ? Date.parse(b.oldest_at) : Infinity; if (ta !== tb) return ta - tb; if (!!a.urgent !== !!b.urgent) return a.urgent ? -1 : 1; return a.title_ar.localeCompare(b.title_ar, 'ar'); });
}
export function summarize(groups: readonly SignGroup[], now = new Date()): { total: number; oldest_days: number | null; oldest_at: string | null } {
  let total = 0; let oldest: string | null = null; for (const g of groups) { if (g.count <= 0) continue; total += g.count; oldest = minIso(oldest, g.oldest_at); }
  return { total, oldest_days: ageDays(oldest, now), oldest_at: oldest };
}
/** نصّ «نبض الصباح» — بلا أسماء ولا نتائج */
export function digestText(total: number, oldestDays: number | null, topTitle: string | null): { title_ar: string; body_ar: string; url: string } {
  const old = oldestDays && oldestDays > 0 ? ` — الأقدم منذ ${oldestDays} ${oldestDays === 1 ? 'يوم' : oldestDays === 2 ? 'يومين' : oldestDays <= 10 ? 'أيام' : 'يومًا'}` : '';
  return { title_ar: `ينتظر توقيعك اليوم ${total}${old}`, body_ar: `${topTitle ? `أوّلها: ${topTitle}. ` : ''}كل ما يحتاج إنسانًا في مكان واحد — افتح «توقيعي» ووقّع ما تراه.`, url: SIGN_PATH };
}
/** ما الذي تستدعيه اللمسة — تُستخدم في الخادم للتحقّق وفي الواجهة للعرض */
export function touchFor(item: { touch?: SignTouch } | null | undefined): { path: string; body: Record<string, unknown> } | null {
  if (!item?.touch) return null; if (item.touch.action === 'practice_approve_all') return { path: '/api/admin/miaar/practice', body: { action: 'approve_all', ...item.touch.body } }; return null;
}
const isPending = (v: unknown) => v === 'submitted' || v === 'ai_rated' || v === 'rated';

/* ---------- الغراء ---------- */
export type SignMe = { id: string; email: string; role: string; staff: boolean; trainer: boolean; doors: DoorSlug[] };
const arr = (d: unknown): any[] => (Array.isArray(d) ? d : []);
const safe = async <T,>(p: Promise<T>, fb: T): Promise<T> => { try { return await p; } catch { return fb; } };

/** دعوات نهاية المستوى (عُبور) + تقاريرها — الأساس لثلاث مجموعات: مِران مسوَّد · عُبور بلا قرار · نزاهة تستحق مراجعة */
async function exitBase(db: Db) {
  const { data: inv } = await db.from('placement_invites').select('id, code, label_ar, level_target, classroom_id, status, created_at').not('level_target', 'is', null).order('created_at', { ascending: false }).limit(120);
  const invites = arr(inv); if (!invites.length) return { invites: [] as any[], reports: [] as any[], orders: new Set<string>() };
  const ids = invites.map((i) => String(i.id));
  const [{ data: reps }, { data: ords }] = await Promise.all([
    db.from('placement_reports').select('id, invite_id, submission_id, report, integrity_status, created_at').in('invite_id', ids).is('archived_at', null).limit(1500),
    db.from('miaar_service_orders').select('invite_id').in('invite_id', ids),
  ]);
  return { invites, reports: arr(reps), orders: new Set(arr(ords).map((o) => String(o.invite_id))) };
}
const inviteLabel = (i: any) => `${String(i.label_ar || i.code || '')}${i.level_target ? ` · ${i.level_target}` : ''}`.trim();

/** 3) طلبات الجهات (م12): طلب معلّق = لا خطّة اعتُمدت بعده — ودعواته تُستثنى من «مِران بعد عُبور» حتى لا يُعدّ المتعلّم مرّتين */
async function clientRequests(db: Db, now: Date): Promise<{ group: SignGroup; pendingInvites: Set<string> }> {
  { const { data: ords } = await db.from('miaar_service_orders').select('id, invite_id, client_name, status, events').order('created_at', { ascending: false }).limit(200);
    const { lastClientRequest } = await import('../miaar/practice'); const items: SignItem[] = [];
    const openOrders = arr(ords).filter((o) => !['delivered', 'invoiced', 'cancelled'].includes(String(o.status)));
    const reqs = openOrders.map((o) => ({ o, r: lastClientRequest(o.events) })).filter((x) => x.r);
    if (reqs.length) { const { data: pls } = await db.from('miaar_practice_plans').select('invite_id, approved_at').in('invite_id', reqs.map((x) => String(x.o.invite_id))).in('status', ['approved', 'done']).limit(2000);
      for (const { o, r } of reqs) { const answered = arr(pls).some((p) => String(p.invite_id) === String(o.invite_id) && p.approved_at && p.approved_at >= r!.at); if (answered) continue; items.push({ id: String(o.id), label_ar: `${String(o.client_name || 'جهة')} — ${r!.eligible} طالبًا${r!.message ? ' · برسالة' : ''}`, count: 1, oldest_at: r!.at, href: `/admin/miaar/exit?invite=${o.invite_id}#xb-practice` }); } }
    const s = summarize(items.map((i) => ({ key: i.id, area: 'miaar', title_ar: i.label_ar, hint_ar: '', count: 1, oldest_at: i.oldest_at, href: i.href })), now);
    const group: SignGroup = ({ key: 'client_requests', area: 'miaar', title_ar: 'جهات طلبت «مِران» لطلابها', hint_ar: 'اقرأ رسالتهم في اللوحة ثم وقّع — لا تُفتح خطّة بطلب الجهة وحده', count: s.total, oldest_at: s.oldest_at, href: '/admin/miaar/invites', urgent: s.total > 0, items });
    return { group, pendingInvites: new Set(reqs.filter((x) => items.some((i) => i.id === String(x.o.id))).map((x) => String(x.o.invite_id))) }; }
}
async function miaarGroups(db: Db, me: SignMe, site: string, now: Date): Promise<SignGroup[]> {
  const out: SignGroup[] = [];
  /* الاستعلامات المستقلّة تنطلق معًا (ثم تُقرأ في مكانها) — السجلّ يُحسب في زمن أطول استعلام لا مجموعها */
  const empty = { data: null as any, count: null as number | null };
  const pBase = safe(exitBase(db), { invites: [] as any[], reports: [] as any[], orders: new Set<string>() });
  const pDrafts = safe(Promise.resolve(db.from('miaar_practice_plans').select('id, report_id, created_at').eq('kind', 'placement').eq('status', 'draft').limit(1000)), empty);
  const pPerf = me.staff ? safe(Promise.resolve(db.from('miaar_performances').select('id, status, adjudication, created_at').in('status', ['submitted', 'ai_rated', 'rated']).order('created_at', { ascending: true }).limit(500)), empty) : Promise.resolve(empty);
  const pDec = me.staff ? safe(Promise.resolve(db.from('placement_decisions').select('report_id, deadline_at, decided_at').eq('decision_status', 'review').limit(500)), empty) : Promise.resolve(empty);
  const pBank = me.staff ? safe(Promise.resolve(db.from('question_bank_items').select('created_at', { count: 'exact' }).eq('status', 'in_review').order('created_at', { ascending: true }).limit(1)), empty) : Promise.resolve(empty);
  const base = await pBase;
  const repIds = base.reports.map((r) => String(r.id));
  const { data: pl } = repIds.length ? await db.from('miaar_practice_plans').select('id, report_id, invite_id, kind, status, created_at').in('report_id', repIds.slice(0, 1000)).limit(2000) : { data: [] };
  const planByRep = new Map<string, any>(); for (const p of arr(pl)) planByRep.set(String(p.report_id), p);
  const pCr = me.staff || !me.trainer ? safe(clientRequests(db, now), { group: { key: 'client_requests', area: 'miaar' as const, title_ar: 'جهات طلبت «مِران» لطلابها', hint_ar: '', count: 0, oldest_at: null, href: '/admin/miaar/invites', items: [] }, pendingInvites: new Set<string>() }) : Promise.resolve({ group: null as SignGroup | null, pendingInvites: new Set<string>() });
  const cr = await pCr;
  /* 1) مِران بعد عُبور: مؤهّل بلا خطّة معتمدة — لكل دعوة (دعوات الجهات ذات الطلب المعلّق تُعدّ في «طلبات الجهات») */
  { const per = new Map<string, { n: number; oldest: string | null }>();
    for (const r of base.reports) { if (cr.pendingInvites.has(String(r.invite_id))) continue; if (!eligibleReport(r.report).ok) continue; const p = planByRep.get(String(r.id)); if (p && p.status !== 'draft' && p.status !== 'cancelled') continue; const k = String(r.invite_id); const cur = per.get(k) || { n: 0, oldest: null }; cur.n += 1; cur.oldest = minIso(cur.oldest, r.created_at || null); per.set(k, cur); }
    const items: SignItem[] = []; for (const [invId, v] of per) { const inv = base.invites.find((i) => String(i.id) === invId); if (!inv) continue; items.push({ id: invId, label_ar: inviteLabel(inv), count: v.n, oldest_at: v.oldest, href: `/admin/miaar/exit?invite=${invId}#xb-practice`, touch: { action: 'practice_approve_all', body: { invite_id: invId } } }); }
    items.sort((a, b) => (a.oldest_at || '').localeCompare(b.oldest_at || ''));
    const s = summarize(items.map((i) => ({ key: i.id, area: 'miaar', title_ar: i.label_ar, hint_ar: '', count: i.count, oldest_at: i.oldest_at, href: i.href })), now);
    out.push({ key: 'practice_exit', area: 'miaar', title_ar: 'خطط مِران تنتظر توقيعك (بعد عُبور)', hint_ar: 'متعلّمون بحكم «مشروط» أو «لم يجتز» بلا خطّة معتمدة — 14 يومًا تبدأ بتوقيعك', count: s.total, oldest_at: s.oldest_at, href: '/admin/miaar/exit', items }); }
  /* 2) مِران البداية: مسوَّدات لكل شعبة (المدرّب يرى شُعبه فقط) */
  { const { data: dr } = await pDrafts; const drafts = arr(dr);
    const items: SignItem[] = [];
    if (drafts.length) { const { data: dec } = await db.from('placement_decisions').select('report_id, classroom_id').in('report_id', drafts.map((d) => String(d.report_id))); const roomOf = new Map<string, string>(); for (const d of arr(dec)) if (d.classroom_id) roomOf.set(String(d.report_id), String(d.classroom_id));
      const per = new Map<string, { n: number; oldest: string | null }>(); for (const d of drafts) { const c = roomOf.get(String(d.report_id)); if (!c) continue; const cur = per.get(c) || { n: 0, oldest: null }; cur.n += 1; cur.oldest = minIso(cur.oldest, d.created_at || null); per.set(c, cur); }
      if (per.size) { const { data: rooms } = await db.from('classrooms').select('id, code, section_name, trainer_id').in('id', [...per.keys()]); let mineRooms: Set<string> | null = null;
        if (me.trainer && !me.staff) { const tids = arr(rooms).map((r) => r.trainer_id).filter(Boolean); const { data: trs } = tids.length ? await db.from('trainers').select('id, email').in('id', tids) : { data: [] }; const myT = new Set(arr(trs).filter((t) => String(t.email || '').trim().toLowerCase() === me.email).map((t) => String(t.id))); mineRooms = new Set(arr(rooms).filter((r) => myT.has(String(r.trainer_id))).map((r) => String(r.id))); }
        for (const [cid, v] of per) { if (mineRooms && !mineRooms.has(cid)) continue; const room = arr(rooms).find((r) => String(r.id) === cid); items.push({ id: cid, label_ar: `شعبة ${String(room?.code || room?.section_name || cid)}${room?.section_name && room?.code ? ` — ${room.section_name}` : ''}`, count: v.n, oldest_at: v.oldest, href: `/admin/miaar/ledger?practice=${cid}`, touch: { action: 'practice_approve_all', body: { classroom_id: cid } } }); } } }
    items.sort((a, b) => (a.oldest_at || '').localeCompare(b.oldest_at || ''));
    const s = summarize(items.map((i) => ({ key: i.id, area: 'miaar', title_ar: i.label_ar, hint_ar: '', count: i.count, oldest_at: i.oldest_at, href: i.href })), now);
    out.push({ key: 'practice_start', area: 'miaar', title_ar: 'مسوَّدات «مِران البداية» تنتظر توقيعك', hint_ar: 'صيغت لحظة قرار التسكين — لا تُفتح للمتعلّم قبل أول أسبوعين إلا بتوقيع مدرّب', count: s.total, oldest_at: s.oldest_at, href: '/admin/miaar/ledger', items }); }
  if (me.trainer && !me.staff) return out.filter((g) => g.key === 'practice_start');
  if (cr.group) out.push(cr.group);
  /* 4) التصحيح البشري */
  { const { data: perf } = await pPerf; const rows = arr(perf).filter((r) => isPending(r.status) || r.adjudication === 'needed');
    out.push({ key: 'rating', area: 'miaar', title_ar: 'أداءات كتابة وتحدّث تنتظر قراءة إنسان', hint_ar: 'الذكاء يقترح درجة، والمصحّح المعايَر يوقّعها — ومنها ما يحتاج قارئًا ثانيًا أو تحكيمًا', count: rows.length, oldest_at: rows[0]?.created_at || null, href: '/admin/miaar/rating' }); }
  /* 5) التسكين: منطقة رمادية */
  { const { data: dec } = await pDec; const rows = arr(dec);
    const dl = rows.map((r) => r.deadline_at).filter(Boolean).sort()[0] || null; const dlDays = dl ? Math.ceil((Date.parse(dl) - now.getTime()) / 86400000) : null;
    out.push({ key: 'placement_review', area: 'miaar', title_ar: 'قرارات تسكين في المنطقة الرمادية', hint_ar: 'نتائج على الحدّ أو بإشارات — يقرّرها إنسان قبل أن تُسكَّن تلقائيًّا', count: rows.length, oldest_at: rows.map((r) => r.decided_at).filter(Boolean).sort()[0] || null, href: '/admin/miaar/ledger?decision=review', urgent: dlDays !== null && dlDays <= 2, deadline_days: dlDays }); }
  /* 6) عُبور: اجتازوا ولم يُرقَّوا (دعوات الشُّعب فقط — الجهات لا ترقية لها) */
  { const per = new Map<string, { n: number; oldest: string | null }>();
    for (const r of base.reports) { if (base.orders.has(String(r.invite_id))) continue; const ex = r.report?.exit; if (!ex || ex.الحالة !== 'final' || ex.النتيجة !== 'passed' || ex.قرار_العبور) continue; const k = String(r.invite_id); const cur = per.get(k) || { n: 0, oldest: null }; cur.n += 1; cur.oldest = minIso(cur.oldest, r.created_at || null); per.set(k, cur); }
    const items: SignItem[] = []; for (const [invId, v] of per) { const inv = base.invites.find((i) => String(i.id) === invId); if (!inv) continue; items.push({ id: invId, label_ar: inviteLabel(inv), count: v.n, oldest_at: v.oldest, href: `/admin/miaar/exit?invite=${invId}` }); }
    items.sort((a, b) => (a.oldest_at || '').localeCompare(b.oldest_at || ''));
    const s = summarize(items.map((i) => ({ key: i.id, area: 'miaar', title_ar: i.label_ar, hint_ar: '', count: i.count, oldest_at: i.oldest_at, href: i.href })), now);
    out.push({ key: 'exit_promote', area: 'miaar', title_ar: 'اجتازوا عُبور وينتظرون قرار الترقية', hint_ar: 'الحكم نهائي؛ الترقية إلى المستوى التالي توقيع بشري', count: s.total, oldest_at: s.oldest_at, href: '/admin/miaar/exit', items }); }
  /* 7) نزاهة «تستحق المراجعة» بلا حكم */
  { const cand = base.reports.filter((r) => !r.integrity_status && r.submission_id).slice(0, 200);
    let n = 0; let oldest: string | null = null;
    if (cand.length) { const { liveFor } = await import('../miaar/witness'); const live = await safe(liveFor(db, cand.map((r) => String(r.submission_id))), {} as Record<string, any>); for (const r of cand) { if (live[String(r.submission_id)]?.level === 'review') { n += 1; oldest = minIso(oldest, r.created_at || null); } } }
    out.push({ key: 'integrity', area: 'miaar', title_ar: 'جلسات «تستحق المراجعة» بلا حكم شاهِد', hint_ar: 'إشارات أثناء الاختبار — الحكم (سليم · ملاحظة · لاغٍ) يوقّعه إنسان', count: n, oldest_at: oldest, href: '/admin/miaar/witness' }); }
  /* 8) بنود البنك */
  { const { count, data } = await pBank; const n = typeof count === 'number' ? count : arr(data).length;
    out.push({ key: 'bank_review', area: 'miaar', title_ar: 'بنود بنك مِعيار قيد المراجعة', hint_ar: 'بند لا يدخل النماذج قبل اعتماد بشري', count: n, oldest_at: arr(data)[0]?.created_at || null, href: '/admin/miaar/bank' }); }
  return out;
}

/** قرارات الأبواب (P42-ب) للأبواب التي يملكها — بلا تكرار بالمفتاح */
async function doorGroups(db: Db, me: SignMe): Promise<SignGroup[]> {
  if (!me.doors.length) return [];
  const { doorLive } = await import('./hub'); const seen = new Map<string, SignGroup>();
  const lives = await Promise.all(me.doors.map((d) => safe(doorLive(db, d, { id: me.id, email: me.email }), null)));
  for (const l of lives) { if (!l) continue; for (const d of l.decisions) { if (d.key === 'bank') continue; /* مغطّى في مِعيار */ const k = `door:${d.key}`; if (seen.has(k)) continue; seen.set(k, { key: k, area: 'portal', title_ar: d.label, hint_ar: d.key === 'data' ? 'طلبات حقوق البيانات لها 30 يومًا نظامًا (PDPL) — الأقدم أولًا' : 'من مؤشّرات الباب', count: d.count, oldest_at: null, href: d.href, urgent: !!d.urgent }); } }
  return [...seen.values()];
}

async function signedToday(db: Db, me: SignMe, now: Date): Promise<number | null> {
  try { const day0 = new Date(now); day0.setHours(0, 0, 0, 0); const { data } = await db.from('audit_logs').select('action').eq('actor_id', me.id).gte('created_at', day0.toISOString()).limit(500); return arr(data).filter((a) => SIGN_ACTION_RE.test(String(a.action || ''))).length; } catch { return null; }
}

const CACHE = new Map<string, { at: number; v: SignRegister }>();
/** السجلّ كاملًا لمستخدم — مع ذاكرة 45 ث (العدّاد في الصدفة يسأل كثيرًا) */
export async function collectRegister(db: Db, me: SignMe, site: string, opts: { now?: Date; fresh?: boolean } = {}): Promise<SignRegister> {
  const now = opts.now || new Date(); const ck = `${me.id}:${me.staff ? 'S' : me.trainer ? 'T' : 'D'}:${me.doors.join(',')}`;
  const hit = CACHE.get(ck); if (!opts.fresh && hit && now.getTime() - hit.at < SIGN_CACHE_MS) return hit.v;
  const [mi, doors, today] = await Promise.all([me.staff || me.trainer ? safe(miaarGroups(db, me, site, now), [] as SignGroup[]) : Promise.resolve([] as SignGroup[]), safe(doorGroups(db, me), [] as SignGroup[]), signedToday(db, me, now)]);
  const groups = orderGroups([...mi, ...doors]); const s = summarize(groups, now);
  const v: SignRegister = { total: s.total, today_signed: today, oldest_days: s.oldest_days, groups, scope: me.staff ? 'all' : me.trainer ? 'trainer' : 'doors', computed_at: now.toISOString() };
  CACHE.set(ck, { at: now.getTime(), v }); return v;
}
export function invalidateSignCache() { CACHE.clear(); }

/** «نبض الصباح» — إشعار داخل أَثَر لكل طاقم له توقيعات معلّقة (مرّة في اليوم) — يُستدعى من الكرون اليومي القائم */
export const STAFF_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
export async function runSignDigest(db: Db, opts: { site?: string; dry?: boolean; now?: Date } = {}): Promise<{ staff: number; sent: number; total: number; errors: string[] }> {
  const now = opts.now || new Date(); const s = { staff: 0, sent: 0, total: 0, errors: [] as string[] };
  try {
    const { data: profs } = await db.from('profiles').select('id, email, role').in('role', STAFF_ROLES).limit(100); const staff = arr(profs).filter((p) => p.email);
    s.staff = staff.length; if (!staff.length) return s;
    const reg = await collectRegister(db, { id: 'digest', email: '', role: 'ADMIN', staff: true, trainer: false, doors: [] }, opts.site || '', { now, fresh: true }); s.total = reg.total; if (!reg.total) return s;
    const { pushNotice } = await import('./notices'); const t = digestText(reg.total, reg.oldest_days, reg.groups[0]?.title_ar || null); const day = now.toISOString().slice(0, 10);
    for (const p of staff) { try { const r = await pushNotice(db, { email: String(p.email), user_id: String(p.id), report_id: null, kind: 'sign_digest', ...t, ref_id: null, dedupe_key: `sign_digest:${String(p.email).toLowerCase()}:${day}`, push: false }, { dry: !!opts.dry }); if (r.inserted) s.sent += 1; } catch (e: any) { s.errors.push(String(e?.message || e)); } }
  } catch (e: any) { s.errors.push(String(e?.message || e)); }
  return s;
}
