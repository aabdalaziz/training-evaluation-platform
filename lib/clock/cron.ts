// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P81 */
/**
 * «ساعة البرنامج» — المنفّذ اليومي. يُستدعى من السلسلة الموجودة (/api/followups/send) قبل إرسال حملات المتابعة،
 * ومن /api/clock (تشغيل يدوي لحدث واحد أو معاينة dry).
 *  remind   → بريد المعتمدين + المدرّبين + ملخّص للإدارة
 *  start    → روابط الحضور للمدرّبين والإدارة · «ننطلق اليوم» للمشاركين
 *  evaluate → programs.is_final_open=true (فيرسل بريد المشاركين الموجود لمن في سجلّات الحضور) + رابط مباشر لمن ليس فيها
 *  followup → إنشاء حملة behavior_followups (open, auto_send, open_at=اليوم) بالمتدرّبين — تُرسل في الخطوة التالية من السلسلة نفسها
 *  impact   → فتح القياس البعدي إن وُجدت أداة أثر، وإلّا حملة «أثر بعد 90 يومًا»
 * لا يرمي أخطاء؛ كلّ حدث يُسجَّل done/failed/skipped مع result.
 */
import { notify } from '../portal/notify';
import { adminEmails } from '../notifications/scan';
import { TEMPLATE, makeToken } from '../behavior/model';
import { decide, normalizeConfig, mailFor, KIND_AR, type ClockConfig, type ClockEvent, type ClockKind, type ClockProgram, type Decision } from './model';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const safe = async <T,>(q: PromiseLike<{ data: T | null; error: any }>, fb: T): Promise<T> => { try { const { data, error } = await q; return error || data == null ? fb : data; } catch { return fb; } };
type Person = { name: string; email: string };
export type RunOpts = { site: string; dry?: boolean; now?: Date; limit?: number; eventId?: string | null };
export type EventResult = { event_id: string; program: string; kind: ClockKind; action: 'run' | 'skip' | 'wait'; ok?: boolean; sent?: Record<string, number>; note?: string; error?: string };
export type RunResult = { enabled: boolean; dry: boolean; generated: number; due: number; results: EventResult[]; error?: string };

export async function loadConfig(db: any): Promise<ClockConfig> { return normalizeConfig(await safe<any>(db.from('program_clock_config').select('*').eq('id', 1).maybeSingle(), null)); }

/** المشاركون: المعتمدون في البوّابة + بريد سجلّات الحضور (بلا تكرار) */
async function participantsOf(db: any, programId: string): Promise<{ approved: Person[]; attendance: Person[]; all: Person[]; pending: number; attendanceEmails: Set<string> }> {
  const enr = await safe<any[]>(db.from('portal_enrollments').select('full_name,email,status').eq('program_id', programId).limit(2000), []);
  const sessions = await safe<any[]>(db.from('attendance_sessions').select('id').eq('program_id', programId).limit(500), []);
  const recs = sessions.length ? await safe<any[]>(db.from('attendance_records').select('full_name,email').in('session_id', sessions.map((s) => s.id)).limit(5000), []) : [];
  const seen = new Set<string>(); const pick = (rows: any[]): Person[] => { const out: Person[] = []; for (const r of rows) { const em = String(r.email || '').trim().toLowerCase(); if (!EMAIL_RE.test(em) || seen.has(em)) continue; seen.add(em); out.push({ name: String(r.full_name || '').trim(), email: em }); } return out; };
  const approved = pick(enr.filter((e) => e.status === 'approved')); const attendance = pick(recs);
  const attendanceEmails = new Set(recs.map((r) => String(r.email || '').trim().toLowerCase()).filter((x) => EMAIL_RE.test(x)));
  return { approved, attendance, all: [...approved, ...attendance], pending: enr.filter((e) => e.status === 'pending').length, attendanceEmails };
}
async function trainersOf(db: any, programId: string): Promise<Person[]> {
  const rooms = await safe<any[]>(db.from('classrooms').select('trainer_id').eq('program_id', programId), []); const ids = Array.from(new Set(rooms.map((r) => r.trainer_id).filter(Boolean)));
  if (!ids.length) return []; const tr = await safe<any[]>(db.from('trainers').select('id,name,email').in('id', ids), []);
  return tr.filter((t) => EMAIL_RE.test(String(t.email || ''))).map((t) => ({ name: t.name, email: String(t.email).toLowerCase() }));
}
async function admins(db: any): Promise<Person[]> { try { return (await adminEmails(db)).map((email) => ({ name: '', email })); } catch { return []; } }

async function send(db: any, dry: boolean, kind: ClockKind, people: Person[], build: (p: Person) => { subject: string; html: string; url: string }, ref: string): Promise<number> {
  let n = 0; for (const p of people.slice(0, 400)) { const m = build(p); if (dry) { n++; continue; } try { const r = await notify(db, { kind: `clock_${kind}`, to: { email: p.email, name: p.name }, subject: m.subject, html: m.html, url: m.url, ref }); if (r.ok) n++; } catch { /* يُسجَّل في سجلّ الرسائل */ } } return n;
}

/** تنفيذ حدث واحد (بعد قرار run) */
export async function executeEvent(db: any, e: ClockEvent, p: ClockProgram, cfg: ClockConfig, o: RunOpts): Promise<EventResult> {
  const dry = !!o.dry; const today = (o.now || new Date()).toISOString().slice(0, 10); const base: EventResult = { event_id: e.id, program: p.name_ar, kind: e.kind, action: 'run' };
  try {
    const [pp, trs, adm] = await Promise.all([participantsOf(db, p.id), trainersOf(db, p.id), admins(db)]);
    const ch = cfg.channels; const sent: Record<string, number> = {}; const ref = `${p.id}:${e.kind}`; let note = '';
    const ctx = (name?: string | null, extra?: Record<string, any>, links?: Record<string, string>) => ({ site: o.site, program: p, name, counts: { participants: pp.approved.length || pp.all.length, attendance: pp.attendance.length }, extra: { pending: pp.pending, ...(extra || {}) }, links });
    if (e.kind === 'remind' || e.kind === 'start') {
      const people = e.kind === 'remind' ? pp.approved : pp.all;
      if (ch.participants) sent.participants = await send(db, dry, e.kind, people, (x) => mailFor(e.kind, 'participant', ctx(x.name)), ref);
      if (ch.trainer) sent.trainers = await send(db, dry, e.kind, trs, (x) => mailFor(e.kind, 'trainer', ctx(x.name)), ref);
      if (ch.admin) sent.admins = await send(db, dry, e.kind, adm, () => mailFor(e.kind, 'admin', ctx(null)), ref);
    } else if (e.kind === 'evaluate') {
      if (!p.is_final_open && !dry) { const { error } = await db.from('programs').update({ is_final_open: true }).eq('id', p.id); note = error ? `تعذّر فتح التقييم: ${error.message}` : 'فُتح التقييم النهائي'; } else note = p.is_final_open ? 'التقييم النهائي مفتوح أصلًا' : 'معاينة';
      const direct = pp.approved.filter((x) => !pp.attendanceEmails.has(x.email)); /* من في سجلّات الحضور يصله بريد المشاركين الموجود */
      const links = { final: `${o.site}/evaluate/final?program=${encodeURIComponent(p.id)}` };
      if (ch.participants) sent.participants = await send(db, dry, e.kind, direct, (x) => mailFor('evaluate', 'participant', ctx(x.name, {}, links)), ref);
      if (ch.trainer) sent.trainers = await send(db, dry, e.kind, trs, (x) => mailFor('evaluate', 'trainer', ctx(x.name)), ref);
      if (ch.admin) sent.admins = await send(db, dry, e.kind, adm, () => mailFor('evaluate', 'admin', ctx(null)), ref);
    } else if (e.kind === 'followup' || e.kind === 'impact') {
      const days = e.kind === 'followup' ? 30 : 90; let existing = false, opened = false; const links: Record<string, string> = {};
      if (e.kind === 'impact') { /* أداة أثر قبلية موجودة؟ افتح البعدي */
        const ia = await safe<any[]>(db.from('impact_assessments').select('id,token,post_open,status').eq('program_id', p.id).neq('status', 'closed').limit(1), []);
        if (ia[0]) { opened = true; links.impact = `${o.site}/impact/${ia[0].token}?phase=post`; if (!ia[0].post_open && !dry) await db.from('impact_assessments').update({ post_open: true }).eq('id', ia[0].id);
          if (ch.participants) sent.participants = await send(db, dry, 'impact', pp.all, (x) => mailFor('impact', 'participant', ctx(x.name, {}, links)), ref); }
      }
      if (!opened) {
        const prior = await safe<any[]>(db.from('behavior_followups').select('id,title_ar').eq('program_id', p.id).ilike('title_ar', `%${days} يوم%`).limit(1), []);
        if (prior[0]) { existing = true; note = `حملة موجودة: ${prior[0].title_ar}`; }
        else if (!dry) {
          const recipients = pp.all.map((x) => ({ name: x.name || x.email, email: x.email, role: 'trainee' }));
          const row = { program_id: p.id, classroom_id: null, title_ar: e.kind === 'followup' ? `متابعة أثر «${p.name_ar}» بعد ${days} يومًا` : `قياس أثر «${p.name_ar}» بعد ${days} يومًا`, title_en: null, intro_ar: e.kind === 'followup' ? 'بعد شهر من البرنامج نسألك عمّا طبّقته فعلًا في عملك، وما الذي أعانك أو أعاقك. إجاباتك تُجمَّع ولا تُنسب إليك.' : 'بعد ثلاثة أشهر نقيس ما بقي من أثر البرنامج في الأداء والنتائج. إجاباتك تُجمَّع ولا تُنسب إليك.', token: makeToken(), status: 'open', scale_max: 5, due_days: days, open_at: today, supervisor_open: true, trainee_open: true, auto_send: true, remind_after_days: 14, recipients, created_by: null, created_by_name: 'ساعة البرنامج' };
          const { data, error } = await db.from('behavior_followups').insert(row).select('id').single(); if (error) throw new Error(`إنشاء الحملة: ${error.message}`);
          const qs = TEMPLATE.map((q, i) => ({ followup_id: data.id, order_no: i + 1, kind: q.kind, audience: q.audience, domain_ar: q.domain_ar || null, text_ar: q.text_ar, text_en: q.text_en || null, options: q.kind === 'multi' ? q.options || null : null, required: q.required !== false }));
          const { error: qe } = await db.from('behavior_questions').insert(qs); if (qe) note = `الحملة أُنشئت لكن بنودها تعثّرت: ${qe.message}`; else note = `أُنشئت الحملة (${recipients.length} متدرّبًا) وستُرسل في السلسلة نفسها`;
          sent.participants = recipients.length;
        } else { note = `معاينة: ستُنشأ حملة بـ${pp.all.length} متدرّبًا`; sent.participants = pp.all.length; }
      }
      if (ch.admin) sent.admins = await send(db, dry, e.kind, adm, () => mailFor(e.kind, 'admin', ctx(null, { existing: existing ? 1 : 0, opened: opened ? 1 : 0 })), ref);
    }
    if (!dry) await db.from('program_clock_events').update({ status: 'done', done_at: new Date().toISOString(), result: { sent, note, at: today } }).eq('id', e.id);
    return { ...base, ok: true, sent, note };
  } catch (err: any) {
    const error = String(err?.message || err).slice(0, 300); if (!dry) await safe(db.from('program_clock_events').update({ status: 'failed', done_at: new Date().toISOString(), result: { error, at: today } }).eq('id', e.id), null);
    return { ...base, ok: false, error };
  }
}

export async function runProgramClock(db: any, o: RunOpts): Promise<RunResult> {
  const dry = !!o.dry; const today = (o.now || new Date()).toISOString().slice(0, 10); const out: RunResult = { enabled: true, dry, generated: 0, due: 0, results: [] };
  try {
    const cfg = await loadConfig(db); if (!cfg.enabled && !o.eventId) { out.enabled = false; return out; }
    if (!dry) { const { data } = await db.rpc('program_clock_generate_all'); out.generated = Number(data) || 0; }
    let q = db.from('program_clock_events').select('*').eq('status', 'pending').order('due_date', { ascending: true }).limit(o.limit || 25);
    q = o.eventId ? db.from('program_clock_events').select('*').eq('id', o.eventId) : q.lte('due_date', today);
    const events = await safe<ClockEvent[]>(q, []); if (!events.length) return out;
    const progs = await safe<ClockProgram[]>(db.from('programs').select('id,name_ar,start_date,end_date,status,delivery_mode,location_ar,hours,is_final_open').in('id', Array.from(new Set(events.map((e) => e.program_id)))), []);
    const pm = new Map(progs.map((p) => [p.id, p]));
    const decisions: Decision[] = o.eventId ? events.map((event) => ({ event, action: 'run' as const })) /* تشغيل يدوي: يتجاوز قرار الصلاحية */ : decide(events, pm, today);
    out.due = decisions.filter((d) => d.action === 'run').length;
    for (const d of decisions) {
      const p = pm.get(d.event.program_id);
      if (d.action === 'skip' || !p) { if (!dry) await safe(db.from('program_clock_events').update({ status: 'skipped', done_at: new Date().toISOString(), result: { reason: d.reason || 'بلا برنامج', at: today } }).eq('id', d.event.id), null); out.results.push({ event_id: d.event.id, program: p?.name_ar || '—', kind: d.event.kind, action: 'skip', note: d.reason }); continue; }
      if (d.action === 'wait') continue;
      out.results.push(await executeEvent(db, d.event, p, cfg, o));
    }
  } catch (e: any) { out.error = String(e?.message || e); }
  return out;
}
export { KIND_AR };
