// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P81 «ساعة البرنامج» — التخطيط والصلاحية والرسائل + تشغيل كامل على قاعدة بيانات وهمية */
import test from 'node:test';
import assert from 'node:assert/strict';
import { planEvents, validUntil, decide, stageOf, nextEvent, mailFor, normalizeConfig, DEFAULT_OFFSETS } from '../lib/clock/model';
import type { ClockEvent, ClockProgram } from '../lib/clock/model';
import { runProgramClock } from '../lib/clock/cron';

const P: ClockProgram = { id: 'p1', name_ar: 'برنامج العربية للناطقين بغيرها (عن بعد)', start_date: '2026-12-01', end_date: '2026-12-05', status: 'ACTIVE', delivery_mode: 'remote', hours: 20 };

test('planEvents: خمسة أحداث من تواريخ البرنامج، ولا شيء لبرنامج بلا تواريخ أو ملغى', () => {
  const ev = planEvents(P); assert.equal(ev.length, 5);
  const m = Object.fromEntries(ev.map((e) => [e.kind, e.due_date]));
  assert.deepEqual(m, { remind: '2026-11-24', start: '2026-12-01', evaluate: '2026-12-06', followup: '2027-01-04', impact: '2027-03-05' });
  assert.equal(planEvents({ id: 'x', name_ar: 'x' }).length, 0); assert.equal(planEvents({ ...P, status: 'CANCELLED' }).length, 0);
  assert.equal(planEvents({ ...P, end_date: null }).find((e) => e.kind === 'followup')!.due_date, '2026-12-31', 'بلا نهاية → النهاية = البداية');
  assert.equal(planEvents(P, { ...DEFAULT_OFFSETS, remind: -3 })[0].due_date, '2026-11-28');
});

test('decide: ينتظر قبل الموعد، ينفّذ في الموعد، ويتجاوز ما فات موعده (لا بريد «يبدأ بعد أسبوع» لبرنامج انتهى)', () => {
  const pm = new Map([[P.id, P]]);
  const evs: ClockEvent[] = planEvents(P).map((e, i) => ({ id: `e${i}`, program_id: P.id, status: 'pending', ...e }));
  const on = (today: string) => Object.fromEntries(decide(evs, pm, today).map((d) => [d.event.kind, d.action]));
  assert.deepEqual(on('2026-11-20'), { remind: 'wait', start: 'wait', evaluate: 'wait', followup: 'wait', impact: 'wait' });
  assert.equal(on('2026-11-24').remind, 'run'); assert.equal(on('2026-11-26').remind, 'run', 'متأخّر يومين لكنّه قبل البداية → ينفَّذ');
  assert.equal(on('2026-12-01').remind, 'skip', 'يوم البداية: التذكير فات'); assert.equal(on('2026-12-01').start, 'run');
  assert.equal(on('2026-12-20').evaluate, 'run'); assert.equal(on('2027-01-10').evaluate, 'skip', 'بعد 21 يومًا من النهاية');
  assert.equal(on('2027-01-20').followup, 'run'); assert.equal(on('2027-03-01').followup, 'skip'); assert.equal(on('2027-04-30').impact, 'run'); assert.equal(on('2027-06-30').impact, 'skip');
  assert.equal(validUntil('remind', P), '2026-11-30');
  const cancelled = decide(evs, new Map([[P.id, { ...P, status: 'CANCELLED' }]]), '2026-11-24'); assert.ok(cancelled.every((d) => d.action === 'skip'));
});

test('stageOf/nextEvent/normalizeConfig', () => {
  assert.equal(stageOf(P, '2026-11-20'), 'before'); assert.equal(stageOf(P, '2026-12-03'), 'running'); assert.equal(stageOf(P, '2027-01-03'), 'after'); assert.equal(stageOf(P, '2027-08-01'), 'closed'); assert.equal(stageOf({ id: 'x', name_ar: 'x' }, '2026-01-01'), 'no_dates');
  const evs: ClockEvent[] = planEvents(P).map((e, i) => ({ id: `e${i}`, program_id: P.id, status: i === 0 ? 'done' : 'pending', ...e }));
  assert.equal(nextEvent(evs, '2026-11-25')!.kind, 'start');
  const c = normalizeConfig({ enabled: false, offsets: { remind: -10, impact: 9999, bogus: 3 }, channels: { trainer: false } });
  assert.equal(c.enabled, false); assert.equal(c.offsets.remind, -10); assert.equal(c.offsets.impact, 365); assert.equal(c.offsets.start, 0); assert.equal(c.channels.trainer, false); assert.equal(c.channels.admin, true);
  assert.equal(normalizeConfig(null).enabled, true);
});

test('mailFor: لكلّ نوع وجمهور موضوع ورابط ونصّ عربي بالهوية بلا HTML مكسور', () => {
  const kinds = ['remind', 'start', 'evaluate', 'followup', 'impact'] as const; const auds = ['participant', 'trainer', 'admin'] as const;
  for (const k of kinds) for (const a of auds) { const m = mailFor(k, a, { site: 'https://athar-portal.com', program: P, name: 'سارة أحمد', counts: { participants: 12, attendance: 9 }, links: { final: 'https://athar-portal.com/evaluate/final?program=p1' } }); assert.ok(m.subject.length > 8 && m.url.startsWith('https://athar-portal.com'), `${k}/${a}`); assert.ok(m.html.includes('dir="rtl"') && m.html.includes('ساعة البرنامج'), `${k}/${a} html`); assert.ok(!/undefined|NaN|\[object/.test(m.html + m.subject), `${k}/${a} leak`); }
  assert.ok(mailFor('remind', 'participant', { site: 's', program: P, name: 'سارة أحمد' }).html.includes('سارة،'), 'الاسم الأوّل');
  assert.ok(mailFor('evaluate', 'participant', { site: 's', program: P, links: { final: 'https://x/evaluate/final?program=p1' } }).html.includes('https://x/evaluate/final?program=p1'));
  assert.ok(mailFor('remind', 'participant', { site: 's', program: P }).html.includes('عن بُعد'), 'البرنامج عن بُعد');
  const p2 = mailFor('followup', 'admin', { site: 's', program: P, extra: { existing: 1 } }); assert.ok(p2.html.includes('كانت حملة متابعة موجودة'));
});

/* ───────── قاعدة بيانات وهمية صغيرة تكفي سلاسل الاستعلام المستخدمة في cron.ts ───────── */
function fakeDb(T: Record<string, any[]>, log: string[]) {
  const q = (table: string) => { const rows = () => (T[table] = T[table] || []); let fs: ((r: any) => boolean)[] = []; let op: 'select' | 'update' | 'insert' = 'select'; let patch: any = null; let ins: any = null; let lim = 0;
    const run = () => { let out = rows().filter((r) => fs.every((f) => f(r))); if (op === 'update') { out.forEach((r) => Object.assign(r, patch)); log.push(`update ${table} ${JSON.stringify(patch).slice(0, 60)}`); } if (lim) out = out.slice(0, lim); return out; };
    const api: any = {
      select() { return api; }, eq(k: string, v: any) { fs.push((r) => r[k] === v); return api; }, neq(k: string, v: any) { fs.push((r) => r[k] !== v); return api; }, lte(k: string, v: any) { fs.push((r) => r[k] <= v); return api; }, in(k: string, vs: any[]) { fs.push((r) => vs.includes(r[k])); return api; }, is(k: string, v: any) { fs.push((r) => r[k] == v); return api; },
      ilike(k: string, pat: string) { const needle = pat.replace(/%/g, ''); fs.push((r) => String(r[k] || '').includes(needle)); return api; }, order() { return api; }, limit(n: number) { lim = n; return api; },
      update(p: any) { op = 'update'; patch = p; return api; }, insert(r: any) { op = 'insert'; ins = Array.isArray(r) ? r : [r]; for (const x of ins) rows().push({ id: `${table}-${rows().length + 1}`, ...x }); log.push(`insert ${table} x${ins.length}`); return api; },
      maybeSingle() { return Promise.resolve({ data: run()[0] || null, error: null }); }, single() { const d = op === 'insert' ? rows()[rows().length - 1] : run()[0]; return Promise.resolve({ data: d || null, error: d ? null : { message: 'none' } }); },
      then(res: any, rej: any) { return Promise.resolve({ data: op === 'insert' ? ins : run(), error: null }).then(res, rej); },
    }; return api; };
  return { from: q, rpc: async (fn: string) => { log.push(`rpc ${fn}`); return { data: 5, error: null }; } };
}

test('runProgramClock على قاعدة وهمية: T-7 يرسل للمعتمدين والمدرّب والإدارة · T+1 يفتح التقييم · T+30 ينشئ حملة ببنودها · ما فات يُتجاوز', async () => {
  const log: string[] = []; const sent: any[] = [];
  const T: Record<string, any[]> = {
    program_clock_config: [{ id: 1, enabled: true, offsets: DEFAULT_OFFSETS, channels: { participants: true, trainer: true, admin: true } }],
    programs: [{ ...P, is_final_open: false }, { id: 'p2', name_ar: 'برنامج قديم', start_date: '2026-09-01', end_date: '2026-09-03', status: 'ACTIVE' }],
    program_clock_events: [
      { id: 'e1', program_id: 'p1', kind: 'remind', due_date: '2026-11-24', status: 'pending' },
      { id: 'e2', program_id: 'p1', kind: 'start', due_date: '2026-12-01', status: 'pending' },
      { id: 'e3', program_id: 'p2', kind: 'remind', due_date: '2026-08-25', status: 'pending' }, /* فات */
      { id: 'e4', program_id: 'p2', kind: 'evaluate', due_date: '2026-09-04', status: 'pending' }, /* فات (>21 يومًا) */
    ],
    portal_enrollments: [{ program_id: 'p1', full_name: 'سارة أحمد', email: 'sara@example.com', status: 'approved' }, { program_id: 'p1', full_name: 'خالد', email: 'khaled@example.com', status: 'pending' }, { program_id: 'p1', full_name: 'بلا بريد', email: 'x', status: 'approved' }],
    attendance_sessions: [{ id: 's1', program_id: 'p1' }], attendance_records: [{ session_id: 's1', full_name: 'منى', email: 'mona@example.com' }, { session_id: 's1', full_name: 'سارة', email: 'SARA@example.com' }],
    classrooms: [{ program_id: 'p1', trainer_id: 't1' }], trainers: [{ id: 't1', name: 'أ. نورة', email: 'noura@example.com' }], profiles: [{ email: 'admin@athar-portal.com', role: 'ADMIN' }],
    behavior_followups: [], behavior_questions: [], impact_assessments: [], portal_message_log: [],
  };
  const db = fakeDb(T, log);
  /* نعترض notify عبر portal_message_log: الإرسال الحقيقي يفشل بلا RESEND → يصبح manual؛ يكفينا عدّ الصفوف المسجَّلة */
  const r1 = await runProgramClock(db, { site: 'https://athar-portal.com', now: new Date('2026-11-24T06:00:00Z') });
  assert.equal(r1.enabled, true); assert.ok(log.includes('rpc program_clock_generate_all'));
  const res1 = Object.fromEntries(r1.results.map((x) => [x.event_id, x]));
  assert.equal(res1.e1.action, 'run'); assert.equal(res1.e1.ok, true); assert.equal(res1.e3.action, 'skip'); assert.equal(res1.e4.action, 'skip'); assert.equal(res1.e2, undefined, 'الانطلاق ليس بعد');
  assert.equal(T.program_clock_events.find((e) => e.id === 'e1')!.status, 'done'); assert.equal(T.program_clock_events.find((e) => e.id === 'e3')!.status, 'skipped');
  const logged = T.portal_message_log; const toP = logged.filter((m) => m.kind === 'clock_remind').map((m) => m.to_email).sort();
  assert.deepEqual(toP, ['admin@athar-portal.com', 'noura@example.com', 'sara@example.com'], 'المعتمدون فقط (لا pending ولا بريد غير صالح) + المدرّب + الإدارة');
  /* T+1 */
  T.program_clock_events.push({ id: 'e5', program_id: 'p1', kind: 'evaluate', due_date: '2026-12-06', status: 'pending' });
  const r2 = await runProgramClock(db, { site: 'https://athar-portal.com', now: new Date('2026-12-06T06:00:00Z') });
  assert.equal(r2.results.find((x) => x.event_id === 'e5')!.ok, true); assert.equal(T.programs[0].is_final_open, true, 'فُتح التقييم النهائي');
  const evalTo = T.portal_message_log.filter((m) => m.kind === 'clock_evaluate').map((m) => m.to_email); assert.ok(!evalTo.includes('sara@example.com') && !evalTo.includes('mona@example.com'), 'من في سجلّات الحضور يصله بريد المشاركين الموجود لا بريد الساعة');
  /* T+30 */
  T.program_clock_events.push({ id: 'e6', program_id: 'p1', kind: 'followup', due_date: '2027-01-04', status: 'pending' });
  const r3 = await runProgramClock(db, { site: 'https://athar-portal.com', now: new Date('2027-01-04T06:00:00Z') });
  const f = T.behavior_followups[0]; assert.ok(f, 'أُنشئت الحملة'); assert.equal(f.status, 'open'); assert.equal(f.auto_send, true); assert.equal(f.open_at, '2027-01-04'); assert.equal(f.due_days, 30);
  assert.deepEqual(f.recipients.map((x: any) => x.email).sort(), ['mona@example.com', 'sara@example.com'], 'المعتمدون + الحضور بلا تكرار، بدور متدرّب'); assert.ok(f.recipients.every((x: any) => x.role === 'trainee'));
  assert.equal(T.behavior_questions.length, 10, 'بنود القالب'); assert.equal(r3.results.find((x) => x.event_id === 'e6')!.ok, true);
  /* تكرار T+90 بلا أداة أثر → حملة ثانية بعنوان 90، ولا تُكرَّر إن شُغِّل مرّتين */
  T.program_clock_events.push({ id: 'e7', program_id: 'p1', kind: 'impact', due_date: '2027-03-05', status: 'pending' });
  await runProgramClock(db, { site: 'https://athar-portal.com', now: new Date('2027-03-05T06:00:00Z') }); assert.equal(T.behavior_followups.length, 2); assert.ok(T.behavior_followups[1].title_ar.includes('90'));
  T.program_clock_events.find((e) => e.id === 'e7')!.status = 'pending'; const r5 = await runProgramClock(db, { site: 'https://athar-portal.com', now: new Date('2027-03-06T06:00:00Z') });
  assert.equal(T.behavior_followups.length, 2, 'لا حملة مكرّرة'); assert.ok(String(r5.results.find((x) => x.event_id === 'e7')!.note).includes('حملة موجودة'));
  /* dry: لا كتابة */
  const before = JSON.stringify(T.program_clock_events); T.program_clock_events.push({ id: 'e8', program_id: 'p1', kind: 'start', due_date: '2026-12-01', status: 'pending' });
  const d = await runProgramClock(db, { site: 's', dry: true, now: new Date('2026-12-01T06:00:00Z') }); assert.equal(d.dry, true); assert.equal(T.program_clock_events.find((e) => e.id === 'e8')!.status, 'pending'); assert.ok(before.length > 0 && d.results.some((x) => x.event_id === 'e8' && x.action === 'run'));
  /* متوقّفة */
  T.program_clock_config[0].enabled = false; const off = await runProgramClock(db, { site: 's', now: new Date('2026-12-01T06:00:00Z') }); assert.equal(off.enabled, false); assert.equal(off.results.length, 0);
});

test('P87-ب: مشاركة lang=en تصلها رسالة إنجليزيّة LTR بلا HTML مكسور؛ العربيّة والمدرّب والإدارة كما هي', () => {
  const P: any = { id: 'p1', name_ar: 'برنامج الانغماس', name_en: 'Arabic Immersion', start_date: '2026-12-06', end_date: '2026-12-26', delivery_mode: 'onsite', location_ar: 'المدينة', location_en: 'Madinah', hours: 60 };
  const kinds = ['remind', 'start', 'evaluate', 'followup', 'impact'] as const;
  for (const k of kinds) {
    const en = mailFor(k, 'participant', { site: 'https://athar-portal.com', program: P, name: 'Ines Della-Vittoria', lang: 'en', links: { final: 'https://x/f', impact: 'https://x/i' } });
    assert.ok(/Arabic Immersion/.test(en.subject) && !/[\u0600-\u06FF]/.test(en.subject), `${k}: موضوع إنجليزيّ`);
    assert.ok(en.html.includes('dir="ltr"') && en.html.includes('Ines,'), `${k}: LTR + الاسم الأوّل`);
    assert.equal((en.html.match(/<div/g) || []).length, (en.html.match(/<\/div>/g) || []).length, `${k}: HTML متوازن`);
    const ar = mailFor(k, 'participant', { site: 's', program: P, name: 'سارة', lang: 'ar' }); assert.ok(/[\u0600-\u06FF]/.test(ar.subject), `${k}: العربيّة كما هي`);
    const tr = mailFor(k, 'trainer', { site: 's', program: P, lang: 'en' }); assert.ok(/[\u0600-\u06FF]/.test(tr.subject), `${k}: المدرّب عربيّ دائمًا`);
  }
  assert.ok(mailFor('remind', 'participant', { site: 's', program: P, lang: 'en' }).html.includes('Madinah'), 'الموقع بالإنجليزيّة');
});

test('P88: رابط «مساحتي» في البريد الإنجليزيّ يصبح مساحة المجموعة إن مُرّر links.space', () => {
  const P: any = { id: 'p1', name_ar: 'ب', name_en: 'Program' };
  assert.ok(mailFor('remind', 'participant', { site: 'https://a', program: P, lang: 'en', links: { space: 'https://a/france' } }).html.includes('https://a/france'));
  assert.ok(mailFor('remind', 'participant', { site: 'https://a', program: P, lang: 'en' }).html.includes('https://a/me'));
});
