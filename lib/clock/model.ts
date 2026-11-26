// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P81 */
/**
 * «ساعة البرنامج» — الطبقة النقيّة (بلا قاعدة بيانات؛ قابلة للاختبار):
 *  - الإزاحات والأنواع الخمسة: remind (T-7) · start (T0) · evaluate (T+1) · followup (T+30) · impact (T+90)
 *  - planEvents: تخطيط الأحداث من تواريخ البرنامج (مرآة الدالة SQL program_clock_generate)
 *  - validity: حتى متى يظلّ الحدث صالحًا للتنفيذ؛ ما فات موعده يُتجاوز بدل أن يُرسل بريدًا خاطئًا («يبدأ بعد 7 أيام» لبرنامج انتهى)
 *  - stageOf / nextEvent: مرحلة البرنامج على الساعة والحدث القادم (للوحة الإدارة وبطاقة البرنامج)
 *  - mailFor: نصوص الرسائل بالهوية لكلّ نوع ومستلم
 */
export type ClockKind = 'remind' | 'start' | 'evaluate' | 'followup' | 'impact';
export type ClockStatus = 'pending' | 'done' | 'skipped' | 'failed';
export type Offsets = Record<ClockKind, number>;
export type Channels = { participants: boolean; trainer: boolean; admin: boolean };
export type ClockConfig = { enabled: boolean; offsets: Offsets; channels: Channels };
export type ClockProgram = { id: string; name_ar: string; start_date?: string | null; end_date?: string | null; status?: string | null; delivery_mode?: string | null; location_ar?: string | null; hours?: number | null; is_final_open?: boolean | null };
export type ClockEvent = { id: string; program_id: string; kind: ClockKind; due_date: string; status: ClockStatus; result?: any; done_at?: string | null };
export type Audience = 'participant' | 'trainer' | 'admin';

export const KINDS: ClockKind[] = ['remind', 'start', 'evaluate', 'followup', 'impact'];
export const DEFAULT_OFFSETS: Offsets = { remind: -7, start: 0, evaluate: 1, followup: 30, impact: 90 };
export const DEFAULT_CHANNELS: Channels = { participants: true, trainer: true, admin: true };
export const KIND_AR: Record<ClockKind, { label: string; short: string; hint: string; anchor: 'start' | 'end' }> = {
  remind:   { label: 'تذكير ما قبل البداية', short: 'T-7', hint: 'بريد للمعتمدين والمدرّب والإدارة: الموعد والمكان وما يُحضَّر', anchor: 'start' },
  start:    { label: 'يوم الانطلاق', short: 'T0', hint: 'رابط الحضور والتقييم اليومي للمدرّب والإدارة · «ننطلق اليوم» للمشاركين', anchor: 'start' },
  evaluate: { label: 'فتح التقييم النهائي', short: 'T+1', hint: 'يفتح التقييم النهائي تلقائيًّا ويُرسل الرابط لمن لم يصله', anchor: 'end' },
  followup: { label: 'متابعة الأثر السلوكي', short: 'T+30', hint: 'تُنشأ حملة المتابعة وتُرسل للمتدرّبين؛ وتنتظر بريد المشرفين', anchor: 'end' },
  impact:   { label: 'قياس الأثر', short: 'T+90', hint: 'يفتح القياس البعدي إن وُجد، وإلّا تُنشأ حملة أثر بعد 90 يومًا', anchor: 'end' },
};
export const STATUS_AR: Record<ClockStatus, string> = { pending: 'بانتظار موعده', done: 'نُفِّذ', skipped: 'تُجووِز', failed: 'تعثّر' };

const DAY = 86400000;
export const ymd = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(date: string, n: number): string { return ymd(new Date(new Date(date + 'T00:00:00Z').getTime() + n * DAY)); }
export function daysBetween(a: string, b: string): number { return Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / DAY); }

export function normalizeConfig(raw: any): ClockConfig {
  const off: Offsets = { ...DEFAULT_OFFSETS }; for (const k of KINDS) { const v = Number(raw?.offsets?.[k]); if (Number.isFinite(v)) off[k] = Math.max(-60, Math.min(365, Math.round(v))); }
  const ch: Channels = { ...DEFAULT_CHANNELS }; for (const k of Object.keys(ch) as (keyof Channels)[]) if (typeof raw?.channels?.[k] === 'boolean') ch[k] = raw.channels[k];
  return { enabled: raw?.enabled !== false, offsets: off, channels: ch };
}

/** مرآة SQL: لا أحداث لبرنامج بلا تواريخ أو ملغى/مؤرشف */
export function planEvents(p: ClockProgram, offsets: Offsets = DEFAULT_OFFSETS): { kind: ClockKind; due_date: string }[] {
  if (!p.start_date && !p.end_date) return []; if (['CANCELLED', 'ARCHIVED'].includes(String(p.status || '').toUpperCase())) return [];
  const start = p.start_date || p.end_date!, end = p.end_date || p.start_date!;
  return KINDS.map((kind) => ({ kind, due_date: addDays(KIND_AR[kind].anchor === 'start' ? start : end, offsets[kind]) }));
}

/** حتى متى يصلح تنفيذ الحدث (بعدها يُتجاوز بسبب «فات موعده») */
export function validUntil(kind: ClockKind, p: ClockProgram): string | null {
  const start = p.start_date || p.end_date, end = p.end_date || p.start_date; if (!start || !end) return null;
  switch (kind) { case 'remind': return addDays(start, -1); case 'start': return addDays(start, 1); case 'evaluate': return addDays(end, 21); case 'followup': return addDays(end, 75); case 'impact': return addDays(end, 160); }
}
export type Decision = { event: ClockEvent; action: 'run' | 'skip' | 'wait'; reason?: string };
/** قرار اليوم لكلّ حدث معلّق */
export function decide(events: ClockEvent[], programs: Map<string, ClockProgram>, today: string): Decision[] {
  const out: Decision[] = [];
  for (const e of events) { if (e.status !== 'pending') continue; const p = programs.get(e.program_id); if (!p) { out.push({ event: e, action: 'skip', reason: 'البرنامج غير موجود' }); continue; }
    if (['CANCELLED', 'ARCHIVED'].includes(String(p.status || '').toUpperCase())) { out.push({ event: e, action: 'skip', reason: 'البرنامج ملغى/مؤرشف' }); continue; }
    if (e.due_date > today) { out.push({ event: e, action: 'wait' }); continue; }
    const vu = validUntil(e.kind, p); if (vu && today > vu) { out.push({ event: e, action: 'skip', reason: `فات موعده (كان صالحًا حتى ${vu})` }); continue; }
    out.push({ event: e, action: 'run' }); }
  return out;
}

export type Stage = 'no_dates' | 'before' | 'running' | 'after' | 'closed';
export function stageOf(p: ClockProgram, today: string): Stage {
  const s = p.start_date || p.end_date, e = p.end_date || p.start_date; if (!s || !e) return 'no_dates';
  if (today < s) return 'before'; if (today <= e) return 'running'; if (daysBetween(e, today) <= 160) return 'after'; return 'closed';
}
export const STAGE_AR: Record<Stage, string> = { no_dates: 'بلا تواريخ', before: 'قبل الانطلاق', running: 'جارٍ', after: 'ما بعد البرنامج', closed: 'مكتمل الدورة' };
export function nextEvent(events: ClockEvent[], today: string): ClockEvent | null { return events.filter((e) => e.status === 'pending' && e.due_date >= today).sort((a, b) => a.due_date.localeCompare(b.due_date))[0] || null; }

/* ───────── الرسائل ───────── */
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const fmt = (d?: string | null) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('ar-SA-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');
const first = (n?: string | null) => (n || '').trim().split(/\s+/)[0] || '';
export const wrap = (title: string, body: string, cta?: { href: string; label: string } | null) => `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#22101F;max-width:620px;margin:auto"><div style="border-top:4px solid #D9A866;padding:14px 0 4px"><b style="color:#D4614A;font-size:12px">بوّابة أَثَر · ساعة البرنامج</b><h2 style="margin:4px 0 10px;font-size:19px;color:#3A1F36">${esc(title)}</h2>${body}${cta ? `<p style="margin:16px 0"><a href="${esc(cta.href)}" style="background:#3A1F36;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:800">${esc(cta.label)}</a></p>` : ''}<p style="color:#8a7580;font-size:12px;border-top:1px solid #f0e4d8;padding-top:8px;margin-top:16px">بوّابة أَثَر للتعليم والتدريب والتطوير والجودة · athar-portal.com · «نبني القدرة ونُثبت الأثر»</p></div></div>`;

export type MailCtx = { site: string; program: ClockProgram; name?: string | null; counts?: { participants?: number; attendance?: number; responses?: number }; links?: Record<string, string>; extra?: Record<string, string | number | null | undefined> };
export function mailFor(kind: ClockKind, to: Audience, c: MailCtx): { subject: string; html: string; url: string } {
  const p = c.program; const nm = esc(p.name_ar); const remote = p.delivery_mode === 'remote' || /عن ب/.test(p.name_ar);
  const where = remote ? 'عن بُعد (سيصلك رابط الجلسة)' : p.location_ar ? esc(p.location_ar) : 'بحسب ما أُبلغت به';
  const dates = `<p><b>الموعد:</b> ${fmt(p.start_date)}${p.end_date && p.end_date !== p.start_date ? ` — ${fmt(p.end_date)}` : ''}${p.hours ? ` · ${p.hours} ساعة` : ''}<br/><b>المكان:</b> ${where}</p>`;
  const me = `${c.site}/me`; const hi = c.name ? `${esc(first(c.name))}، ` : '';
  const studio = `${c.site}/reports/studio?program=${encodeURIComponent(p.id)}`; const live = `${c.site}/reports/live?program=${encodeURIComponent(p.id)}`;
  switch (kind) {
    case 'remind':
      if (to === 'participant') return { subject: `بعد أسبوع نلتقي — ${p.name_ar}`, url: me, html: wrap(`بعد أسبوع نلتقي في «${p.name_ar}»`, `<p>${hi}مقعدك محجوز، ويسعدنا لقاؤك.</p>${dates}<p><b>ما تحضّره:</b> حضورك في الوقت، وجهازك إن كان البرنامج عن بُعد، وسؤالًا واحدًا تريد الإجابة عنه من البرنامج.</p><p>كلّ ما يخصّك — الحضور والتقييمات والشهادة — في مساحتك.</p>`, { href: me, label: 'افتح مساحتي' }) };
      if (to === 'trainer') return { subject: `بعد أسبوع: ${p.name_ar} — ${c.counts?.participants ?? 0} معتمدًا`, url: `${c.site}/admin/attendance`, html: wrap(`بعد أسبوع ينطلق «${p.name_ar}»`, `<p>${hi}تذكير ودّي من ساعة البرنامج.</p>${dates}<p><b>المعتمدون حتى الآن:</b> ${c.counts?.participants ?? 0}.</p><p>جهّز الحقيبة وروابط التقييم اليومي؛ ستصلك روابط الحضور صباح يوم الانطلاق.</p>`, { href: `${c.site}/admin/attendance`, label: 'الحضور والروابط' }) };
      return { subject: `ساعة البرنامج: ${p.name_ar} يبدأ بعد أسبوع (${c.counts?.participants ?? 0} معتمدًا)`, url: `${c.site}/admin/clock`, html: wrap(`يبدأ «${p.name_ar}» بعد أسبوع`, `${dates}<p>المعتمدون: <b>${c.counts?.participants ?? 0}</b>${c.extra?.pending ? ` · طلبات معلّقة: <b>${c.extra.pending}</b>` : ''}.</p><p>أُرسل التذكير للمشاركين والمدرّب. راجع المقاعد المعلّقة قبل الانطلاق.</p>`, { href: `${c.site}/admin/clock`, label: 'ساعة البرنامج' }) };
    case 'start':
      if (to === 'participant') return { subject: `اليوم ننطلق — ${p.name_ar}`, url: me, html: wrap(`اليوم ننطلق في «${p.name_ar}»`, `<p>${hi}نراك اليوم.</p>${dates}<p>سجّل حضورك بالرمز الذي يعرضه المدرّب، وقيّم يومك في نهايته من مساحتك.</p>`, { href: me, label: 'مساحتي' }) };
      if (to === 'trainer') return { subject: `ينطلق اليوم: ${p.name_ar}`, url: `${c.site}/admin/attendance`, html: wrap(`ينطلق اليوم «${p.name_ar}»`, `<p>${hi}يومًا موفّقًا.</p>${dates}<p>افتح شاشة الحضور لعرض رمز اليوم، وشارك رابط التقييم اليومي في نهاية الجلسة.</p>`, { href: `${c.site}/admin/attendance`, label: 'شاشة الحضور' }) };
      return { subject: `ساعة البرنامج: ينطلق اليوم ${p.name_ar}`, url: live, html: wrap(`ينطلق اليوم «${p.name_ar}»`, `${dates}<p>المعتمدون: <b>${c.counts?.participants ?? 0}</b>. التقرير الحيّ سيبدأ بالتحديث مع أوّل تقييم يومي.</p>`, { href: live, label: 'التقرير الحيّ' }) };
    case 'evaluate':
      if (to === 'participant') return { subject: `رأيك يصنع الفرق — تقييم ${p.name_ar}`, url: c.links?.final || me, html: wrap(`شكرًا لمشاركتك في «${p.name_ar}»`, `<p>${hi}انتهى البرنامج، ورأيك هو ما يطوّر الدفعة القادمة.</p><p>التقييم النهائي يستغرق ثلاث دقائق، ومجهول الهوية.</p>`, { href: c.links?.final || me, label: 'أقيّم البرنامج الآن' }) };
      if (to === 'trainer') return { subject: `فُتح التقييم النهائي: ${p.name_ar}`, url: studio, html: wrap(`فُتح التقييم النهائي لـ«${p.name_ar}»`, `<p>${hi}أُرسل رابط التقييم للمشاركين تلقائيًّا. نتائجك ستظهر في استوديو التحليل فور ورود الاستجابات.</p>`, { href: studio, label: 'استوديو التحليل' }) };
      return { subject: `ساعة البرنامج: فُتح التقييم النهائي لـ${p.name_ar}`, url: studio, html: wrap(`فُتح التقييم النهائي لـ«${p.name_ar}»`, `<p>أُرسل الرابط إلى <b>${c.counts?.participants ?? 0}</b> مشاركًا${c.counts?.attendance ? ` (منهم ${c.counts.attendance} من سجلّات الحضور)` : ''}. تابع نسبة الاستجابة خلال الأسبوع، وبعدها أصدر التقرير.</p>`, { href: studio, label: 'استوديو التحليل والتقارير' }) };
    case 'followup':
      if (to === 'admin') return { subject: `ساعة البرنامج: حملة متابعة الأثر (30 يومًا) — ${p.name_ar}`, url: `${c.site}/admin/followup`, html: wrap(`بدأت متابعة الأثر لـ«${p.name_ar}»`, `<p>${c.extra?.existing ? 'كانت حملة متابعة موجودة لهذا البرنامج؛ لم تُنشأ أخرى.' : `أُنشئت حملة المتابعة السلوكية وأُرسلت إلى <b>${c.counts?.participants ?? 0}</b> متدرّبًا.`}</p><p><b>المشرفون:</b> أضف بريد المشرف المباشر لكلّ متدرّب في صفحة الحملة لتُرسل نسخة المشرف تلقائيًّا؛ هذا ما يحوّل الانطباع إلى دليل أثر.</p>`, { href: `${c.site}/admin/followup`, label: 'نقل أثر التدريب' }) };
      return { subject: `ما الذي بقي معك؟ — ${p.name_ar}`, url: me, html: wrap(`بعد شهر من «${p.name_ar}»`, `<p>${hi}سيصلك رابط متابعة قصير حول ما طبّقته من البرنامج في عملك.</p>`, { href: me, label: 'مساحتي' }) };
    case 'impact':
      if (to === 'admin') return { subject: `ساعة البرنامج: قياس الأثر (90 يومًا) — ${p.name_ar}`, url: `${c.site}/admin/impact`, html: wrap(`حان قياس أثر «${p.name_ar}»`, `<p>${c.extra?.opened ? `فُتح القياس البعدي للأداة الموجودة وأُرسل الرابط إلى <b>${c.counts?.participants ?? 0}</b> مشاركًا.` : `لا أداة قياس قبلية لهذا البرنامج؛ أُنشئت حملة «أثر بعد 90 يومًا» وأُرسلت إلى <b>${c.counts?.participants ?? 0}</b> متدرّبًا.`}</p><p>النتائج تُلحق تلقائيًّا بالتقرير الحيّ (كيركباتريك 3–4) وتقرير الجهة.</p>`, { href: live, label: 'التقرير الحيّ' }) };
      return { subject: `بعد ثلاثة أشهر — أثر ${p.name_ar}`, url: c.links?.impact || me, html: wrap(`بعد ثلاثة أشهر من «${p.name_ar}»`, `<p>${hi}نقيس الآن ما بقي من أثر البرنامج في عملك — خمس دقائق تُثبت الأثر.</p>`, { href: c.links?.impact || me, label: 'أشارك في القياس' }) };
  }
}
