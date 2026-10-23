/**
 * صحة المنصة — نموذج التقييم (دوال نقية)
 */
export type Status = 'ok' | 'warn' | 'bad' | 'info';
export type Group = 'env' | 'cron' | 'mail' | 'data' | 'ai';

export type HealthCheck = { id: string; group: Group; label: string; status: Status; detail: string; hint?: string; href?: string };

export type EnvSpec = { key: string; label: string; required: boolean; breaks: string; public?: boolean };
export const ENV_SPECS: EnvSpec[] = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'رابط Supabase', required: true, breaks: 'المنصة كلها', public: true },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'مفتاح Supabase العام', required: true, breaks: 'تسجيل الدخول وكل الصفحات', public: true },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'مفتاح الخدمة (Service Role)', required: true, breaks: 'الكرون، البريد، تفريغ البيانات، سجل التدقيق التطبيقي، OTP بوابة المتدرب' },
  { key: 'CRON_SECRET', label: 'سرّ الكرون', required: true, breaks: 'التقرير الأسبوعي، المتابعات اليومية، فحص الإشعارات، بريد المتدربين' },
  { key: 'RESEND_API_KEY', label: 'مفتاح Resend للبريد', required: true, breaks: 'كل الرسائل: التقارير، الشهادات، المتابعات، الإشعارات، OTP' },
  { key: 'REPORTS_FROM_EMAIL', label: 'عنوان المُرسِل', required: true, breaks: 'إرسال البريد (يرفض Resend الرسائل بلا مُرسِل معتمد)' },
  { key: 'NEXT_PUBLIC_SITE_URL', label: 'رابط الموقع العام', required: false, breaks: 'روابط البريد قد تشير إلى نطاق المعاينة بدل النطاق الرسمي', public: true },
  { key: 'AI_API_KEY', label: 'مفتاح الذكاء الاصطناعي', required: false, breaks: 'توليد الأدوات والملخص التنفيذي بالنموذج (يعمل البديل المحلي)' },
  { key: 'AI_PROVIDER', label: 'مزوّد الذكاء الاصطناعي', required: false, breaks: 'يُكتشف تلقائيًا من شكل المفتاح' },
  { key: 'AI_MODEL', label: 'اسم النموذج', required: false, breaks: 'يُكتشف تلقائيًا (أحدث نموذج متاح)' },
  { key: 'NOTIFY_EMAILS', label: 'بريد تنبيهات الإدارة', required: false, breaks: 'تُرسل التنبيهات لمديري المنصة من جدول profiles' },
  { key: 'TRAINEE_MAIL', label: 'بريد المتدربين التلقائي', required: false, breaks: 'يعمل افتراضيًا؛ ضع 0 للتعطيل' },
  { key: 'AUDIT_RETENTION_DAYS', label: 'مدة الاحتفاظ بسجل التدقيق', required: false, breaks: 'الافتراضي 730 يومًا' },
];

export type HealthRaw = {
  now: string;
  env: Record<string, boolean>;
  db: { ok: boolean; latencyMs: number | null; error?: string };
  crons: { followups: string | null; digest: string | null; notificationScan: string | null };
  mail7d: { trainee_ok: number; trainee_failed: number; reports: number; certificates_sent: number; certificates_failed: number; last_failure?: string | null };
  counts: { programs: number; programs_active: number; classrooms: number; trainers: number; questions: number; evaluations: number; evaluations_7d: number; subscriptions_active: number; open_notifications: number; critical_notifications: number; profiles: number; profiles_no_role: number; audit_rows: number; outcome_kpis: number; certificates: number };
  integrity: { active_programs_without_rooms: string[]; rooms_without_trainer: string[]; trainers_without_rooms: string[]; active_programs_silent_14d: string[]; programs_ended_still_active: string[] };
  ai?: { configured: boolean; provider: string };
  backup?: { last: string | null; rows: number | null };
  errors: string[];
};

export const hoursSince = (iso: string | null | undefined, now: Date): number | null => { if (!iso) return null; const t = new Date(iso).getTime(); return isFinite(t) ? Math.round(((now.getTime() - t) / 36e5) * 10) / 10 : null; };

export function fmtHours(h: number | null): string {
  if (h == null) return 'لم يعمل بعد';
  if (h < 1) return 'قبل أقل من ساعة';
  if (h < 48) return `قبل ${Math.round(h)} ساعة`;
  return `قبل ${Math.round(h / 24)} يومًا`;
}

/** تقييم حداثة مهمة دورية: متوقعة كل expectedH ساعة */
export function cronStatus(lastIso: string | null, expectedH: number, now: Date): { status: Status; detail: string } {
  const h = hoursSince(lastIso, now);
  if (h == null) return { status: 'info', detail: 'لا يوجد تشغيل مسجَّل بعد — ينتظر أول تشغيل بعد هذا التحديث' };
  if (h <= expectedH * 1.25) return { status: 'ok', detail: `آخر تشغيل ${fmtHours(h)}` };
  if (h <= expectedH * 2.5) return { status: 'warn', detail: `آخر تشغيل ${fmtHours(h)} — متأخر عن الموعد المتوقع` };
  return { status: 'bad', detail: `آخر تشغيل ${fmtHours(h)} — يبدو أن المهمة متوقفة` };
}

const list = (a: string[], max = 4) => a.slice(0, max).join('، ') + (a.length > max ? ` و${a.length - max} أخرى` : '');

export function evaluateHealth(raw: HealthRaw): HealthCheck[] {
  const now = new Date(raw.now); const out: HealthCheck[] = [];
  // 1) البيئة
  for (const s of ENV_SPECS) {
    const present = !!raw.env[s.key];
    out.push({ id: `env:${s.key}`, group: 'env', label: s.label, status: present ? 'ok' : (s.required ? 'bad' : 'info'), detail: present ? 'مضبوط' : (s.required ? `مفقود — يتعطل: ${s.breaks}` : `غير مضبوط (اختياري) — ${s.breaks}`), hint: present ? undefined : `Vercel → Settings → Environment Variables → ${s.key}` });
  }
  // 2) قاعدة البيانات
  out.push({ id: 'db', group: 'data', label: 'الاتصال بقاعدة البيانات', status: raw.db.ok ? (raw.db.latencyMs != null && raw.db.latencyMs > 1500 ? 'warn' : 'ok') : 'bad', detail: raw.db.ok ? `يعمل · زمن الاستجابة ${raw.db.latencyMs ?? '—'} ms` : `فشل: ${raw.db.error || ''}` });
  // 3) الكرون
  const f = cronStatus(raw.crons.followups || raw.crons.notificationScan, 24, now);
  out.push({ id: 'cron:followups', group: 'cron', label: 'المهمة اليومية (06:00): المتابعات · فحص الإشعارات · بريد المتدربين', status: f.status, detail: f.detail, hint: f.status === 'bad' || f.status === 'warn' ? 'تحقق من CRON_SECRET وأن vercel.json يحتوي /api/followups/send، ثم Vercel → Cron Jobs → Run' : undefined });
  const d = cronStatus(raw.crons.digest, 24 * 7, now);
  out.push({ id: 'cron:digest', group: 'cron', label: 'المهمة الأسبوعية (الأحد 05:00): التقرير الدوري · الملخص الذكي · تنظيف السجل', status: d.status, detail: d.detail, hint: d.status === 'bad' || d.status === 'warn' ? 'تحقق من CRON_SECRET وأن vercel.json يحتوي /api/reports/digest' : undefined });
  if (raw.counts.subscriptions_active === 0) out.push({ id: 'cron:subs', group: 'cron', label: 'اشتراكات التقرير الأسبوعي', status: 'warn', detail: 'لا يوجد مشترك نشط — لن تصل رسالة الأحد لأحد', href: '/reports/center', hint: 'مركز التقارير → اشترك بالبريد' });
  else out.push({ id: 'cron:subs', group: 'cron', label: 'اشتراكات التقرير الأسبوعي', status: 'ok', detail: `${raw.counts.subscriptions_active} اشتراك نشط` });
  // 4) البريد
  const m = raw.mail7d; const failed = m.trainee_failed + m.certificates_failed; const sent = m.trainee_ok + m.reports + m.certificates_sent;
  out.push({ id: 'mail:7d', group: 'mail', label: 'البريد خلال 7 أيام', status: !raw.env.RESEND_API_KEY ? 'bad' : failed > 0 && failed >= sent ? 'bad' : failed > 0 ? 'warn' : 'ok', detail: !raw.env.RESEND_API_KEY ? 'لا يمكن إرسال أي بريد — RESEND_API_KEY مفقود' : `${sent} رسالة ناجحة (${m.reports} تقارير · ${m.certificates_sent} شهادات · ${m.trainee_ok} متدربين)${failed ? ` · ${failed} فاشلة` : ''}`, hint: failed ? `آخر خطأ: ${m.last_failure || '—'}` : undefined });
  // 5) البيانات
  const c = raw.counts;
  out.push({ id: 'data:questions', group: 'data', label: 'أسئلة التقييم', status: c.questions === 0 ? 'bad' : 'ok', detail: c.questions === 0 ? 'لا توجد أسئلة — نماذج التقييم فارغة' : `${c.questions} سؤالًا`, href: '/admin/management' });
  out.push({ id: 'data:evals', group: 'data', label: 'التقييمات', status: c.evaluations === 0 ? 'info' : c.programs_active > 0 && c.evaluations_7d === 0 ? 'warn' : 'ok', detail: `${c.evaluations} إجمالًا · ${c.evaluations_7d} خلال 7 أيام${c.programs_active > 0 && c.evaluations_7d === 0 ? ' — برامج نشطة بلا تقييمات هذا الأسبوع' : ''}` });
  const ig = raw.integrity;
  out.push({ id: 'data:rooms', group: 'data', label: 'برامج نشطة بلا قاعات/شُعب', status: ig.active_programs_without_rooms.length ? 'warn' : 'ok', detail: ig.active_programs_without_rooms.length ? list(ig.active_programs_without_rooms) : 'لا يوجد', href: '/admin/management?tab=rooms' });
  out.push({ id: 'data:trainer', group: 'data', label: 'قاعات بلا مدرب', status: ig.rooms_without_trainer.length ? 'warn' : 'ok', detail: ig.rooms_without_trainer.length ? list(ig.rooms_without_trainer) : 'لا يوجد', href: '/admin/management?tab=rooms' });
  out.push({ id: 'data:idle-trainers', group: 'data', label: 'مدربون بلا أي قاعة', status: ig.trainers_without_rooms.length ? 'info' : 'ok', detail: ig.trainers_without_rooms.length ? list(ig.trainers_without_rooms) : 'لا يوجد' });
  out.push({ id: 'data:silent', group: 'data', label: 'برامج نشطة بلا تقييمات منذ 14 يومًا', status: ig.active_programs_silent_14d.length ? 'warn' : 'ok', detail: ig.active_programs_silent_14d.length ? list(ig.active_programs_silent_14d) : 'لا يوجد', href: '/admin/attendance' });
  out.push({ id: 'data:ended', group: 'data', label: 'برامج انتهى تاريخها وما زالت «نشطة»', status: ig.programs_ended_still_active.length ? 'info' : 'ok', detail: ig.programs_ended_still_active.length ? list(ig.programs_ended_still_active) : 'لا يوجد', href: '/admin/management' });
  out.push({ id: 'data:roles', group: 'data', label: 'مستخدمون بلا دور', status: c.profiles_no_role ? 'warn' : 'ok', detail: c.profiles_no_role ? `${c.profiles_no_role} من ${c.profiles} — لن يستطيعوا الدخول للوحات` : `${c.profiles} مستخدمًا، كلهم بأدوار` });
  out.push({ id: 'data:notif', group: 'data', label: 'التنبيهات المفتوحة', status: c.critical_notifications ? 'warn' : 'ok', detail: `${c.open_notifications} مفتوحة · ${c.critical_notifications} حرجة`, href: '/admin/notifications' });
  out.push({ id: 'data:audit', group: 'data', label: 'سجل التدقيق', status: c.audit_rows >= 0 ? 'ok' : 'warn', detail: `${c.audit_rows} سجلًا`, href: '/admin/audit' });
  // 5ب) النسخ الاحتياطي الشامل (K2)
  if (raw.backup) {
    const days = hoursSince(raw.backup.last, now); const d = days == null ? null : Math.floor(days / 24);
    const hasData = c.evaluations > 0 || c.programs > 0;
    out.push({ id: 'data:backup', group: 'data', label: 'آخر نسخة احتياطية شاملة', href: '/admin/backup',
      status: d == null ? (hasData ? 'warn' : 'info') : d > 30 ? 'warn' : 'ok',
      detail: d == null ? 'لم تُؤخذ نسخة بعد' : d === 0 ? `اليوم · ${raw.backup.rows ?? 0} صفًا` : `منذ ${d} يومًا · ${raw.backup.rows ?? 0} صفًا`,
      hint: d == null || d > 30 ? 'افتح «النسخ الاحتياطي» وصدّر Excel أو JSON (يُنصح بنسخة شهرية).' : undefined });
  }
  // 6) الذكاء الاصطناعي
  out.push({ id: 'ai', group: 'ai', label: 'مزوّد الذكاء الاصطناعي', status: raw.ai?.configured ? 'ok' : 'info', detail: raw.ai?.configured ? `مضبوط (${raw.ai.provider}) — اضغط «اختبر النموذج» للتحقق الفعلي` : 'غير مضبوط — يُستخدم البديل المحلي القائم على القواعد' });
  for (const e of raw.errors) out.push({ id: `err:${e.slice(0, 20)}`, group: 'data', label: 'خطأ أثناء الفحص', status: 'warn', detail: e });
  return out;
}

export const STATUS_ORDER: Record<Status, number> = { bad: 0, warn: 1, info: 2, ok: 3 };
export const STATUS_LABEL: Record<Status, string> = { ok: 'سليم', warn: 'تنبيه', bad: 'عطل', info: 'معلومة' };
export const GROUP_LABEL: Record<Group, string> = { env: 'الإعدادات (Vercel)', cron: 'المهام المجدولة', mail: 'البريد', data: 'البيانات والسلامة', ai: 'الذكاء الاصطناعي' };

export function overall(checks: HealthCheck[]): { status: Status; score: number; bad: number; warn: number; ok: number } {
  const bad = checks.filter(c => c.status === 'bad').length; const warn = checks.filter(c => c.status === 'warn').length; const ok = checks.filter(c => c.status === 'ok').length;
  const scored = checks.filter(c => c.status !== 'info').length || 1;
  const score = Math.round(((ok + warn * 0.5) / scored) * 100);
  return { status: bad ? 'bad' : warn ? 'warn' : 'ok', score, bad, warn, ok };
}

export function healthCsv(checks: HealthCheck[]): string[][] {
  return [['المجموعة', 'الفحص', 'الحالة', 'التفاصيل', 'الإجراء'], ...checks.map(c => [GROUP_LABEL[c.group], c.label, STATUS_LABEL[c.status], c.detail, c.hint || ''])];
}

/** تنبيهات الجرس المشتقة من الفحص (dedupe ثابت لكل مشكلة) */
export function healthAlerts(checks: HealthCheck[]): { dedupe_key: string; severity: 'warn' | 'critical'; title: string; body: string; href: string }[] {
  const out: { dedupe_key: string; severity: 'warn' | 'critical'; title: string; body: string; href: string }[] = [];
  for (const c of checks) {
    if (c.status !== 'bad' && !(c.status === 'warn' && (c.group === 'cron' || c.id === 'data:backup'))) continue;
    if (c.group === 'env' || c.group === 'cron' || c.group === 'mail' || c.id === 'db' || c.id === 'data:backup') out.push({ dedupe_key: `health:${c.id}`, severity: c.status === 'bad' ? 'critical' : 'warn', title: `صحة المنصة: ${c.label}`, body: c.detail, href: '/admin/health' });
  }
  return out;
}
