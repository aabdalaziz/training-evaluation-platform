/**
 * P39 «إشعارات المتعلّم» — أَثَر / مِعيار
 * قناة «داخل أَثَر»: كل حدث يخصّ المتعلّم يُحفظ صفًّا عربيًا في portal_learner_notices (بلا درجات ولا أسماء غير اسمه)،
 * ويُدفع أيضًا إشعارًا (Web Push) إن كان له اشتراك فعّال — بحسابه أو باشتراك «نبّهني» المجهول من بطاقة النتيجة.
 * القاعدة: لا بريد ولا واتساب هنا إطلاقًا (تُفعَّل لاحقًا بقرار المالك)؛ ولا يدخل شيء إلى «قائمة اليد».
 * dedupe_key فريد في القاعدة: إعادة التشغيل (cron/التحديث) لا تكرّر الإشعار أبدًا.
 */
import { sendPush, vapidFromEnv } from './push';
import { inQuietHours, pushSubsFor } from './notify';

export type NoticeKind = 'exit_final' | 'retake_open' | 'retake_rem3' | 'retake_rem1' | 'remedial_new' | 'remedial_tmrw' | 'promoted' | 'placed' | 'exit_summary' | 'practice_plan' | 'practice_day' | 'practice_nudge' | 'practice_idle' /* م10 مِران */ | 'practice_pending' /* م11 مِران البداية */ | 'practice_requested' /* م12 مِران للجهات */ | 'sign_digest' /* P50 توقيعي */ | 'custom' | 'trainer_word' | 'day_digest' /* P51 دفتر اليوم */ | 'org_letter' | 'org_letter_reply' | 'org_letter_due' /* P52 رسالة الشهر */ | 'word_reply' /* P53 ردّ على الكلمة */ | 'week_echo' /* P56 صدى الأسبوع */;

export type NoticeInput = {
  email: string; user_id?: string | null; report_id?: string | null;
  kind: NoticeKind; title_ar: string; body_ar?: string; url?: string | null; ref_id?: string | null;
  dedupe_key: string;
  /** false = داخل أَثَر فقط (مثل ملخّص المدرّب) */
  push?: boolean;
  /** true = إن وُجد المفتاح يُحدَّث نصّه بدل التجاهل (ملخّصات تتراكم) */
  merge?: boolean;
  /** P55: بيانات ملحقة (مثل voice لكلمة المدرّب الصوتية) — عمود meta jsonb */
  meta?: Record<string, unknown> | null;
};
export type NoticeRow = { id: string; email: string; user_id: string | null; report_id: string | null; kind: NoticeKind; title_ar: string; body_ar: string; url: string | null; ref_id: string | null; dedupe_key: string; pushed: boolean; read_at: string | null; created_at: string; meta?: Record<string, unknown> | null };
export type NoticeResult = { inserted: boolean; pushed: boolean; id: string | null; reason?: string };
export type NoticeOpts = { site?: string; env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; now?: Date; dry?: boolean };

export const KIND_AR: Record<NoticeKind, string> = {
  exit_final: 'حكم العبور', retake_open: 'إعادة مهارة', retake_rem3: 'تذكير بالإعادة', retake_rem1: 'تذكير أخير', remedial_new: 'جلسة تعويض', remedial_tmrw: 'جلسة غدًا',
  promoted: 'ترقية', placed: 'تسكين', exit_summary: 'ملخّص الشُّعبة', practice_plan: 'خطّة مِران', practice_day: 'مِران اليوم', practice_nudge: 'تذكير من مدرّبك', practice_idle: 'متعلّم متوقّف', practice_pending: 'خطط مِران بانتظارك', practice_requested: 'طلب مِران من جهة', sign_digest: 'نبض الصباح — توقيعي', trainer_word: 'كلمة من مدرّبك', day_digest: 'نبض الصباح — دفتر اليوم', org_letter: 'رسالة الشهر من أَثَر', org_letter_reply: 'ردّ الجهة على رسالة الشهر', org_letter_due: 'رسائل شهرية تنتظر توقيعك', word_reply: 'ردّ على كلمتك', custom: 'تنبيه', week_echo: 'صدى الأسبوع' };
export const KIND_ICON: Record<NoticeKind, string> = { exit_final: '⚖️', retake_open: '🔁', retake_rem3: '⏳', retake_rem1: '⏰', remedial_new: '🧭', remedial_tmrw: '📅', promoted: '🎓', placed: '🏫', exit_summary: '📋', practice_plan: '🗓️', practice_day: '💪', practice_nudge: '🤝', practice_idle: '💤', custom: '🔔' , practice_pending: '✍️', practice_requested: '🏢', sign_digest: '✍️', trainer_word: '💬', day_digest: '📒', org_letter: '✉️', org_letter_reply: '💌', org_letter_due: '🖋️', word_reply: '🗨️', week_echo: '🪞' };

export const SKILL_AR: Record<string, string> = { listening: 'الاستماع', reading: 'القراءة', grammar_vocab: 'القواعد والمفردات', writing: 'الكتابة', speaking: 'المحادثة' };

const norm = (e: unknown) => String(e || '').trim().toLowerCase();
export const isEmail = (e: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm(e));
export const fmtDay = (iso: string | null | undefined, tz = 'Asia/Riyadh') => { try { return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium', timeZone: tz }).format(new Date(String(iso))); } catch { return String(iso || '').slice(0, 10); } };
export const fmtWhen = (iso: string | null | undefined, tz = 'Asia/Riyadh') => { try { return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(new Date(String(iso))); } catch { return String(iso || '').slice(0, 16); } };

/* ====================================================================== نصوص الإشعارات (صافية — بلا درجات) */
export type NoticeTextInput =
  | { kind: 'exit_final'; level: string; outcome: 'passed' | 'conditional' | 'failed'; code: string }
  | { kind: 'retake_open'; skill: string; until: string | null; inviteUrl: string }
  | { kind: 'retake_rem3' | 'retake_rem1'; skill: string; until: string | null; inviteUrl: string; days: number }
  | { kind: 'remedial_new'; title: string; starts_at: string; units: string[]; joinUrl?: string | null }
  | { kind: 'remedial_tmrw'; title: string; starts_at: string; joinUrl?: string | null }
  | { kind: 'promoted'; from: string; to: string; code: string }
  | { kind: 'placed'; classroom: string; program?: string | null }
  | { kind: 'exit_summary'; invite: string; final: number; total: number; passed: number; conditional: number; failed: number; inviteId: string }
  /* م10 «مِران» */
  | { kind: 'practice_plan'; level: string; code: string; days: number }
  | { kind: 'practice_day'; day: number; unit_title: string; code: string }
  | { kind: 'practice_nudge'; trainer: string; code: string }
  | { kind: 'practice_idle'; name: string; days: number; inviteId: string }
  | { kind: 'practice_pending'; n: number; classroom: string; classroomId: string }
  | { kind: 'practice_requested'; client: string; n: number; inviteId: string; message: string | null };

export function noticeText(t: NoticeTextInput): { title_ar: string; body_ar: string; url: string } {
  switch (t.kind) {
    case 'exit_final': {
      const o = t.outcome === 'passed' ? 'اجتزت المستوى — مبارك.' : t.outcome === 'conditional' ? 'اجتياز مشروط: مهارة واحدة تحتاج إعادة، والطريق مفتوح.' : 'لم يُجتَز هذه المرة — وبطاقتك تبيّن ما تراجعه قبل الجولة القادمة.';
      return { title_ar: `صدر حكم عبورك من ${t.level}`, body_ar: `${o} افتح بطاقتك لترى التفاصيل.`, url: `/miaar/result/${t.code}` };
    }
    case 'retake_open': return { title_ar: `فُتحت لك إعادة مهارة ${SKILL_AR[t.skill] || t.skill}`, body_ar: `أعد هذه المهارة وحدها${t.until ? ` حتى ${fmtDay(t.until)}` : ' خلال 14 يومًا'}، وتُدمج النتيجة في حكمك الأصلي.`, url: t.inviteUrl };
    case 'retake_rem3': case 'retake_rem1': return { title_ar: t.days <= 1 ? `آخر يوم لإعادة ${SKILL_AR[t.skill] || t.skill}` : `بقي ${t.days} أيام على إعادة ${SKILL_AR[t.skill] || t.skill}`, body_ar: `${t.until ? `النافذة تُغلق ${fmtDay(t.until)}. ` : ''}ادخل الآن وأتمّها في جلسة واحدة.`, url: t.inviteUrl };
    case 'remedial_new': return { title_ar: `جلسة تعويض لك: ${t.title}`, body_ar: `${fmtWhen(t.starts_at)}${t.units.length ? ` · الوحدات: ${t.units.slice(0, 3).join('، ')}${t.units.length > 3 ? '…' : ''}` : ''}. حُجزت لك لأن خريطتك أشارت إلى هذه الوحدات.`, url: t.joinUrl || '/me' };
    case 'remedial_tmrw': return { title_ar: `غدًا: ${t.title}`, body_ar: `موعدها ${fmtWhen(t.starts_at)}. جهّز ما راجعته وتعال.`, url: t.joinUrl || '/me' };
    case 'promoted': return { title_ar: `رُقّيت من ${t.from} إلى ${t.to}`, body_ar: 'وقّع المشرف قرار عبورك. شهادتك جاهزة — وتنمو كلما تقدّمت.', url: `/miaar/certificate/${t.code}` };
    case 'placed': return { title_ar: `سُكِّنت في ${t.classroom}`, body_ar: `${t.program ? `برنامج ${t.program}. ` : ''}ستجد جلساتك وموادك في صفحتك «أنا».`, url: '/me' };
    case 'exit_summary': return { title_ar: `${t.invite}: صدرت ${t.final} من ${t.total} نتيجة`, body_ar: `اجتاز ${t.passed} · مشروط ${t.conditional} · لم يجتز ${t.failed}. اللوحة بانتظار قرارك.`, url: `/admin/miaar/exit?invite=${encodeURIComponent(t.inviteId)}` };
    case 'practice_plan': return { title_ar: `خطّة مِران جاهزة لك — ${t.days} يومًا`, body_ar: `اعتمد مدرّبك خطّة تمرين قصيرة من وحدات مستوى ${t.level} التي تحتاج مراجعة: بطاقة واحدة كل صباح (7–10 دقائق) ومرآة تُريك تحسّنك. مِران تدريب لا اختبار.`, url: `/miaar/practice/${t.code}` };
    case 'practice_day': return { title_ar: `مِران اليوم ${t.day}: ${t.unit_title} — 7 دقائق`, body_ar: t.day === 7 || t.day === 14 ? 'يوم المرآة: أضعف خمسة بنود من أيامك السابقة — لترى الفرق بعينك.' : 'خمسة بنود وتغذية راجعة فورية. اليوم الفائت لا يضيع — يعود إليك غدًا.', url: `/miaar/practice/${t.code}` };
    case 'practice_nudge': return { title_ar: `تذكير من مدرّبك ${t.trainer}: مِران اليوم بانتظارك`, body_ar: 'خمس دقائق الآن خير من ساعة ليلة الإعادة. افتح بطاقتك.', url: `/miaar/practice/${t.code}` };
    case 'practice_pending': return { title_ar: `${t.n} خطّة مِران البداية بانتظار توقيعك — شعبة ${t.classroom}`, body_ar: 'اقترحها النظام من خريطة التشخيص لطلابك الجدد. راجع الوحدات وأضف ملاحظتك ثم اعتمد — لا تُفتح للمتعلّم قبل توقيعك.', url: `/admin/miaar/ledger?practice=${encodeURIComponent(t.classroomId)}` };
    case 'practice_requested': return { title_ar: `طلبت ${t.client} «مِران» لـ ${t.n} من طلابها`, body_ar: `${t.message ? `رسالتهم للطلاب: «${t.message}» — ` : ''}راجع لوحة مِران في عُبور واعتمد ما تراه؛ لا تُفتح خطّة بطلب الجهة وحده.`, url: `/admin/miaar/exit?invite=${t.inviteId}#xb-practice` };
    case 'practice_idle': return { title_ar: `${t.name} لم يتدرّب منذ ${t.days} أيام — ذكّره؟`, body_ar: 'من لوحة العبور: «ذكّر» يرسل تذكيرًا إنسانيًا بتوقيعك.', url: `/admin/miaar/exit?invite=${encodeURIComponent(t.inviteId)}#xb-practice` };
  }
}

/* ====================================================================== الحفظ + الدفعة */
const abs = (site: string, u: string | null | undefined) => !u ? undefined : /^https?:/i.test(u) ? u : `${site.replace(/\/$/, '')}${u.startsWith('/') ? '' : '/'}${u}`;

/** يحفظ الإشعار (مرّة واحدة لكل dedupe_key) ثم يدفعه إن أمكن. لا يرمي أخطاء أبدًا. */
export async function pushNotice(db: any, n: NoticeInput, opts: NoticeOpts = {}): Promise<NoticeResult> {
  const email = norm(n.email); if (!isEmail(email)) return { inserted: false, pushed: false, id: null, reason: 'no_email' };
  const row = { email, user_id: n.user_id || null, report_id: n.report_id || null, kind: n.kind, title_ar: String(n.title_ar || '').slice(0, 160), body_ar: String(n.body_ar || '').slice(0, 600), url: n.url || null, ref_id: n.ref_id || null, dedupe_key: String(n.dedupe_key).slice(0, 120), ...(n.meta !== undefined ? { meta: n.meta || {} } : {}) };
  if (opts.dry) return { inserted: true, pushed: false, id: null, reason: 'dry' };
  let id: string | null = null;
  try {
    /* P55: لو لم يُطبَّق SQL عمود meta بعد، نعيد المحاولة بلا meta — لا تتوقّف الكلمات */
    const noMeta = (r: Record<string, unknown>) => { const { meta: _m, ...rest } = r; return rest; }; const metaErr = (e: any) => !!e && 'meta' in row && /meta/i.test(String(e.message || ''));
    if (n.merge) {
      const full = { ...row, read_at: null, created_at: new Date().toISOString() };
      let { data, error } = await db.from('portal_learner_notices').upsert(full, { onConflict: 'dedupe_key' }).select('id').single();
      if (metaErr(error)) ({ data, error } = await db.from('portal_learner_notices').upsert(noMeta(full), { onConflict: 'dedupe_key' }).select('id').single());
      if (error) return { inserted: false, pushed: false, id: null, reason: String(error.message || 'db') };
      id = String((data as any)?.id || '') || null;
    } else {
      let { data, error } = await db.from('portal_learner_notices').upsert(row, { onConflict: 'dedupe_key', ignoreDuplicates: true }).select('id');
      if (metaErr(error)) ({ data, error } = await db.from('portal_learner_notices').upsert(noMeta(row), { onConflict: 'dedupe_key', ignoreDuplicates: true }).select('id'));
      if (error) return { inserted: false, pushed: false, id: null, reason: String(error.message || 'db') };
      const first = Array.isArray(data) ? data[0] : data; id = String((first as any)?.id || '') || null;
      if (!id) return { inserted: false, pushed: false, id: null, reason: 'duplicate' };
    }
  } catch (e: any) { return { inserted: false, pushed: false, id: null, reason: String(e?.message || e) }; }
  if (n.push === false) return { inserted: true, pushed: false, id };
  const pushed = await pushOnly(db, { email, user_id: n.user_id || null, title: row.title_ar, body: row.body_ar, url: row.url, tag: n.kind }, opts);
  if (pushed && id) { try { await db.from('portal_learner_notices').update({ pushed: true }).eq('id', id); } catch { /* تجاهل */ } }
  return { inserted: true, pushed, id };
}

/** دفعة فقط (بلا صفّ): تحترم push_ok وساعات الهدوء، وتعطّل الاشتراكات الميتة كما في «موقف اليوم» */
export async function pushOnly(db: any, m: { email: string; user_id?: string | null; title: string; body: string; url?: string | null; tag?: string }, opts: NoticeOpts = {}): Promise<boolean> {
  const env = opts.env || process.env; const keys = vapidFromEnv(env); if (!keys) return false;
  const site = (opts.site || String(env.NEXT_PUBLIC_SITE_URL || '')).replace(/\/$/, '');
  try {
    let prefs: any = null; try { const { data } = await db.from('portal_contact_prefs').select('push_ok,quiet_from,quiet_to,user_id').eq('email', m.email).maybeSingle(); prefs = data || null; } catch { prefs = null; }
    if (prefs && prefs.push_ok === false) return false;
    if (prefs && inQuietHours(prefs, opts.now || new Date())) return false;
    const subs = await pushSubsFor(db, m.email, m.user_id || prefs?.user_id || null); if (!subs.length) return false;
    let ok = false;
    for (const s of subs) {
      const r = await sendPush(s, { title: m.title, body: m.body, url: abs(site, m.url), tag: `notice-${m.tag || 'x'}`, icon: site ? `${site}/icons/icon-192.png` : undefined }, keys, { fetchImpl: opts.fetchImpl, ttl: 24 * 3600 });
      if (r.ok) { ok = true; try { await db.from('portal_push_subscriptions').update({ last_sent_at: new Date().toISOString(), failures: 0, last_error: null }).eq('id', s.id); } catch { /* تجاهل */ } }
      else if (r.gone) { try { await db.from('portal_push_subscriptions').update({ active: false, last_error: r.error || 'gone' }).eq('id', s.id); } catch { /* تجاهل */ } }
      else { try { await db.from('portal_push_subscriptions').update({ failures: Number(s.failures || 0) + 1, last_error: r.error || 'error' }).eq('id', s.id); } catch { /* تجاهل */ } }
    }
    return ok;
  } catch { return false; }
}

/* ====================================================================== القراءة */
const NOTICE_COLS = 'id,email,user_id,report_id,kind,title_ar,body_ar,url,ref_id,dedupe_key,pushed,read_at,created_at';
export async function listNotices(db: any, email: string, opts: { limit?: number; report_id?: string | null; unreadOnly?: boolean } = {}): Promise<NoticeRow[]> {
  const em = norm(email); if (!isEmail(em)) return [];
  try {
    const build = (cols: string) => { let q = db.from('portal_learner_notices').select(cols).eq('email', em).order('created_at', { ascending: false }).limit(Math.min(50, Math.max(1, opts.limit || 20))); if (opts.report_id) q = q.eq('report_id', opts.report_id); if (opts.unreadOnly) q = q.is('read_at', null); return q; };
    const { data, error } = await build(NOTICE_COLS + ',meta'); /* P55: meta (كلمة صوتية) */
    if (error && /meta/i.test(String(error.message || ''))) { const r2 = await build(NOTICE_COLS); return ((r2.data || []) as NoticeRow[]); } /* قبل تطبيق SQL P55 يبقى كل شيء يعمل */
    return ((data || []) as NoticeRow[]);
  } catch { return []; }
}
export async function unreadCount(db: any, email: string): Promise<number> { const rows = await listNotices(db, email, { limit: 50, unreadOnly: true }); return rows.length; }
export async function markRead(db: any, email: string, ids: string[] | 'all'): Promise<number> {
  const em = norm(email); if (!isEmail(em)) return 0;
  try {
    let q = db.from('portal_learner_notices').update({ read_at: new Date().toISOString() }).eq('email', em).is('read_at', null);
    if (ids !== 'all') { const list = ids.filter(Boolean).slice(0, 100); if (!list.length) return 0; q = q.in('id', list); }
    const { data } = await q.select('id'); return Array.isArray(data) ? data.length : 0;
  } catch { return 0; }
}

/** للوحة العبور: هل أُبلغ كل متعلّم؟ email → {count, pushed, last_at, kinds} */
export type Reach = { count: number; pushed: boolean; last_at: string | null; last_kind: NoticeKind | null; sub: boolean };
export async function noticeReach(db: any, emails: string[]): Promise<Record<string, Reach>> {
  const list = Array.from(new Set(emails.map(norm).filter(isEmail))).slice(0, 300); const out: Record<string, Reach> = {};
  for (const e of list) out[e] = { count: 0, pushed: false, last_at: null, last_kind: null, sub: false };
  if (!list.length) return out;
  try {
    const { data } = await db.from('portal_learner_notices').select('email,kind,pushed,created_at').in('email', list).order('created_at', { ascending: false }).limit(2000);
    for (const r of (data || []) as any[]) { const o = out[norm(r.email)]; if (!o) continue; o.count++; if (r.pushed) o.pushed = true; if (!o.last_at) { o.last_at = r.created_at; o.last_kind = r.kind; } }
  } catch { /* تجاهل */ }
  try {
    const { data } = await db.from('portal_push_subscriptions').select('email').in('email', list).eq('active', true).limit(2000);
    for (const r of (data || []) as any[]) { const o = out[norm(r.email)]; if (o) o.sub = true; }
  } catch { /* تجاهل */ }
  return out;
}

/* ====================================================================== التذكيرات اليومية (تُستدعى من cron المتابعات القائم — بلا cron جديد) */
export type ReminderSummary = { retake: { checked: number; sent: number }; remedial: { checked: number; sent: number }; errors: string[] };
const dayDiff = (a: Date, b: Date) => Math.ceil((b.getTime() - a.getTime()) / 86400000);
/** يرسل: «بقي 3 أيام» و«آخر يوم» لإعادة المهارة · و«غدًا» لجلسات التعويض. المفاتيح الفريدة تمنع التكرار بين الأيام. */
export async function runNoticeReminders(db: any, opts: NoticeOpts = {}): Promise<ReminderSummary> {
  const now = opts.now || new Date(); const site = (opts.site || String((opts.env || process.env).NEXT_PUBLIC_SITE_URL || '')).replace(/\/$/, '');
  const s: ReminderSummary = { retake: { checked: 0, sent: 0 }, remedial: { checked: 0, sent: 0 }, errors: [] };
  // 1) إعادة المهارة: دعوات مفتوحة تنتهي خلال ≤ 3 أيام
  try {
    const until = new Date(now.getTime() + 3 * 86400000).toISOString();
    const { data: inv } = await db.from('placement_invites').select('id,code,status,expires_at,purpose,retake_of').eq('purpose', 'skill_retake').eq('status', 'open').gte('expires_at', now.toISOString()).lte('expires_at', until).limit(500);
    for (const i of (inv || []) as any[]) {
      s.retake.checked++;
      let rep: any = null; try { const { data } = await db.from('placement_reports').select('id,candidate_email,report,user_id').eq('id', i.retake_of).maybeSingle(); rep = data; } catch { rep = null; }
      if (!rep?.candidate_email) continue;
      // إن أُنجزت الإعادة (دُمجت) فلا تذكير
      if (rep.report?.exit?.الإعادة?.الحالة === 'merged') continue;
      const days = dayDiff(now, new Date(i.expires_at)); const kind: NoticeKind = days <= 1 ? 'retake_rem1' : 'retake_rem3';
      const skill = String(rep.report?.exit?.الإعادة?.المهارة || rep.report?.exit?.مهارة_الإعادة || ''); const t = noticeText({ kind, skill, until: i.expires_at, inviteUrl: `/miaar/d/${i.code}`, days: Math.max(1, days) });
      const r = await pushNotice(db, { email: rep.candidate_email, user_id: rep.user_id || null, report_id: rep.id, kind, ...t, ref_id: i.id, dedupe_key: `${kind}:${i.id}` }, { ...opts, site, now });
      if (r.inserted) s.retake.sent++;
    }
  } catch (e: any) { s.errors.push(`retake:${e?.message || e}`); }
  // 2) جلسة التعويض غدًا (بتوقيت الرياض): لكل متعلّم سبق إبلاغه بها (remedial_new) — نفس الجمهور
  try {
    const rToday = new Date(now.getTime() + 3 * 3600000).toISOString().slice(0, 10); const tm = new Date(new Date(rToday + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);
    const from = new Date(new Date(tm + 'T00:00:00Z').getTime() - 3 * 3600000).toISOString(); const to = new Date(new Date(tm + 'T00:00:00Z').getTime() + 21 * 3600000).toISOString();
    const { data: ses } = await db.from('portal_sessions').select('id,title_ar,starts_at,join_url,status').eq('kind', 'remedial').neq('status', 'cancelled').gte('starts_at', from).lte('starts_at', to).limit(200);
    for (const x of (ses || []) as any[]) {
      s.remedial.checked++;
      const { data: aud } = await db.from('portal_learner_notices').select('email,user_id,report_id').eq('kind', 'remedial_new').eq('ref_id', String(x.id)).limit(500);
      for (const a of (aud || []) as any[]) {
        const t = noticeText({ kind: 'remedial_tmrw', title: x.title_ar, starts_at: x.starts_at, joinUrl: x.join_url || '/me' });
        const r = await pushNotice(db, { email: a.email, user_id: a.user_id, report_id: a.report_id, kind: 'remedial_tmrw', ...t, ref_id: String(x.id), dedupe_key: `remedial_tmrw:${x.id}:${a.email}` }, { ...opts, site, now });
        if (r.inserted) s.remedial.sent++;
      }
    }
  } catch (e: any) { s.errors.push(`remedial:${e?.message || e}`); }
  return s;
}

/** صيغة آمنة لبطاقة النتيجة العامة (بلا بريد ولا معرّفات داخلية) */
export function publicNotice(n: NoticeRow) { return { id: n.id, النوع: n.kind, العنوان: n.title_ar, النصّ: n.body_ar, الرابط: n.url, في: n.created_at, دُفع: !!n.pushed, قُرئ: !!n.read_at }; }
