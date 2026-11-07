// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P64 «أول يوم — قال من سبقك» — النواة: الطور والنافذة · اختيار السطور (k ≥ 5 أشخاص · ≤ 7 · خلط يومي ثابت · لا أسماء) · «لماذا جئتُ» · كلمة أَثَر · الإشعارات · الكرون (dedupe · لا رجعية) · شكل المصدر */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { P64_NAMES_AR, FIRST_LIMITS, FIRST_PATH, firstPhase, canWriteWhy, windowUntil, firstOpen, pickLines, validateWhy, atharWelcome, matesLineAr, whyCountLineAr, firstDayNotice, welcomeAskNotice, lineAwaitsNotice, ROAD, addDaysKey, daysBetweenKeys, WHY_CONTEXT, WHY_PROMPT_KEY } from '../lib/first/registry';
import { runFirstDays } from '../lib/first/store';
import { CARD_KEYS, PUBLIC_KEYS, CARD_AR, PUBLIC_AR, buildCards, publicFace, gradBody, programWindow } from '../lib/grad/registry';
import type { Sources } from '../lib/grad/registry';
import { parseCommand } from '../lib/portal/voice';
import { crumbsFor } from '../lib/portal/way';
import { DOORS_AR } from '../lib/letters/self';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const has = (p: string) => existsSync(new URL(`../${p}`, import.meta.url));

test('P64 · الأسماء والحدود · الطور والنافذة (لا رجعية؛ الصفحة تبقى حتى النهاية)', () => {
  assert.equal(P64_NAMES_AR.title, 'أول يوم'); assert.equal(P64_NAMES_AR.sub, 'قال من سبقك'); assert.equal(P64_NAMES_AR.official_ar, 'صفحة اليوم الأول للمتدرّب'); assert.equal(P64_NAMES_AR.athar, 'شكر وتقدير وأمنيات');
  assert.deepEqual(FIRST_LIMITS, { k: 5, show: 7, whyMin: 10, whyMax: 160, windowDays: 7, welcomeBeforeDays: 1, afterMax: 3 }); assert.equal(FIRST_PATH, '/me/first');
  assert.equal(firstPhase('2026-11-07', '2026-11-06'), 'before'); assert.equal(firstPhase('2026-11-07', '2026-11-07'), 'first'); assert.equal(firstPhase('2026-11-07', '2026-11-14'), 'week'); assert.equal(firstPhase('2026-11-07', '2026-11-15'), 'later'); assert.equal(firstPhase('', '2026-11-15'), 'later');
  assert.ok(canWriteWhy('first') && canWriteWhy('week') && !canWriteWhy('later') && !canWriteWhy('before')); assert.equal(windowUntil('2026-11-07'), '2026-11-14'); assert.equal(addDaysKey('2026-12-30', 3), '2027-01-02'); assert.equal(daysBetweenKeys('2026-11-01', '2026-11-07'), 6);
  assert.equal(firstOpen('2026-11-07', '2027-02-05', '2026-11-06'), false, 'قبل البداية لا'); assert.equal(firstOpen('2026-11-07', '2027-02-05', '2026-11-07'), true); assert.equal(firstOpen('2026-11-07', '2027-02-05', '2027-02-05'), true, 'يوم النهاية نعم'); assert.equal(firstOpen('2026-11-07', '2027-02-05', '2027-02-06'), false, 'بعد النهاية لا'); assert.equal(firstOpen('2026-11-07', null, '2028-01-01'), true, 'بلا نهاية تبقى'); assert.equal(firstOpen(null, null, '2026-11-07'), false);
});

test('P64 · «قال من سبقك»: أشخاص مختلفون ≥ 5 · ≤ 7 سطور · خلط يومي ثابت · لا أسماء · الفارغ يُستبعد', () => {
  const L = (user: string, line: string) => ({ user_id: user, line_ar: line, sealed_at: '2026-01-01T00:00:00Z' });
  const four = [L('a', 'س1'), L('b', 'س2'), L('c', 'س3'), L('d', 'س4'), L('a', 'س5 مكرّر لنفس الشخص'), L('e', '   ')];
  const r4 = pickLines(four, 'p:2026-11-07'); assert.equal(r4.shown, false); assert.equal(r4.n, 4, 'نفس المستخدم مرة واحدة · الفارغ لا يُحسب'); assert.deepEqual(r4.lines, []);
  const nine = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((u, i) => L(u, `سطر ${i + 1}`));
  const r9 = pickLines(nine, 'p:2026-11-07'); assert.equal(r9.shown, true); assert.equal(r9.n, 9); assert.equal(r9.lines.length, 7, 'سبعة كحدّ');
  assert.deepEqual(pickLines(nine, 'p:2026-11-07').lines, r9.lines, 'ثابت في اليوم نفسه'); assert.notDeepEqual(pickLines(nine, 'p:2026-11-08').lines, r9.lines, 'يتغيّر بتغيّر اليوم (احتمال التساوي ضئيل)');
  assert.equal(new Set(r9.lines).size, 7, 'لا تكرار'); for (const l of r9.lines) assert.ok(!/user|email|@/.test(l));
  const r5 = pickLines(nine.slice(0, 5), 'x'); assert.equal(r5.shown, true); assert.equal(r5.lines.length, 5);
  const o = JSON.stringify(r9); assert.ok(!o.includes('user_id') && !o.includes('sealed_at'), 'المخرج سطور فقط — لا معرّفات');
});

test('P64 · «لماذا جئتُ» 10–160 · سطور الشعبة k ≥ 5 · كلمة أَثَر تُخصَّص بالاسم الأول واسم البرنامج وتُوقَّع «— أَثَر»', () => {
  assert.match(validateWhy({ body_ar: 'قصير' })!, /10 أحرف/); assert.equal(validateWhy({ body_ar: 'جئتُ لأن أول طالب أعجز عن إيصال الصوت إليه' }), null); assert.match(validateWhy({ body_ar: 'ط'.repeat(161) })!, /160/); assert.equal(validateWhy({ body_ar: 'ط'.repeat(160) }), null);
  assert.equal(WHY_CONTEXT, 'first_day'); assert.equal(WHY_PROMPT_KEY, 'why_came'); assert.equal(DOORS_AR.first_day, 'أول يوم في البرنامج', 'باب P62 القائم يُستعمل كما هو');
  assert.equal(matesLineAr(4), null); assert.equal(matesLineAr(6), 'معك في شعبتك 6 متدرّبًا بدؤوا اليوم نفسه.'); assert.equal(whyCountLineAr(3), null); assert.equal(whyCountLineAr(5), '5 من شعبتك كتبوا «لماذا جئتُ»');
  const a = atharWelcome('نورة', 'دبلوم تعليم العربية'); assert.match(a.thanks_ar, /^شكرًا يا نورة\./); assert.match(a.appreciation_ar, /«دبلوم تعليم العربية»/); assert.match(a.wishes_ar, /لمن يأتي بعدك/); assert.equal(a.signed_ar, '— أَثَر');
  const b = atharWelcome('', 'برنامج'); assert.match(b.thanks_ar, /يا صديقنا/); for (const k of Object.values(a)) assert.ok(!/AI|ذكاء/.test(k), 'نصّ إنساني');
  assert.ok(ROAD.length >= 6 && ROAD.every((s) => s.href.startsWith('/') && s.when_ar && s.what_ar)); for (const s of ROAD) { const seg = s.href.replace(/[#?].*$/, ''); assert.ok(seg === '/me' || has(`app${seg}/page.tsx`), `صفحة موجودة: ${seg}`); }
});

test('P64 · نصوص الإشعارات · الطريق والصوت · بطاقات P63 الجديدة (welcome · first_why) والوجه العام', () => {
  const n = firstDayNotice('الدبلوم'); assert.match(n.title_ar, /اليوم يومك الأول/); assert.match(n.body_ar, /«الدبلوم»/);
  const w = welcomeAskNotice('الدبلوم', 'N-1', '2026-11-08'); assert.match(w.title_ar, /دفعة جديدة تبدأ .*— اكتب كلمة الاستقبال/); assert.match(w.body_ar, /شعبة N-1/);
  const la = lineAwaitsNotice('الدبلوم', 6); assert.match(la.title_ar, /سطرك ينتظر 6 متدرّبًا/); assert.ok(!/اسم/.test(la.title_ar)); assert.match(la.body_ar, /بلا اسمك/);
  assert.equal((parseCommand('افتح أول يوم') as any)?.href, '/me/first'); assert.equal((parseCommand('قال من سبقك') as any)?.href, '/me/first'); assert.equal((parseCommand('افتح يوم تخرجي') as any)?.href, '/me/grad', 'P63 كما هو');
  const c = crumbsFor('/me/first'); assert.equal(c[c.length - 1].label, 'أول يوم'); assert.equal(c[c.length - 1].current, true);
  assert.deepEqual(CARD_KEYS.slice(0, 3), ['farewell', 'welcome', 'first_why']); assert.equal(CARD_AR.welcome, 'قال مدرّبك في أول يوم'); assert.match(CARD_AR.first_why, /ما كتبتُه أول يوم/); assert.ok(PUBLIC_KEYS.includes('welcome') && PUBLIC_KEYS.includes('first_why')); assert.ok(PUBLIC_AR.first_why);
  const base: Sources = { threads: [], replies: [], chapters: [], cohort_line: null, grad_letter: null, map_code: null, farewell: null, stations: [], cohort_opened: false, threads_after: 0,
    welcome: { text_ar: 'أهلًا بكم — ابدؤوا بالسؤال', at: '2026-08-01T09:00:00Z', voice_sec: null, trainer_ar: 'أحمد' }, first_why: { id: 77, body_ar: 'جئتُ لأن أول طالب…', at: '2026-08-01T10:00:00Z', state: 'sealed', opens_ar: '7 نوفمبر 2026' } };
  const W = programWindow('2026-08-01', '2026-11-07'); const { cards } = buildCards(base, { id: 'p' }, W);
  assert.deepEqual(cards.map((x) => x.key), ['welcome', 'first_why']); assert.equal(cards[0].text_ar, 'أهلًا بكم — ابدؤوا بالسؤال'); assert.equal(cards[1].text_ar, null, 'المختوم لا يُقرأ'); assert.match(cards[1].state_ar!, /مختوم — يُفتح 7 نوفمبر 2026/); assert.equal(cards[1].href, '/me/letter#letter-77');
  const opened = buildCards({ ...base, first_why: { ...base.first_why!, state: 'opened' } }, { id: 'p' }, W).cards[1]; assert.equal(opened.text_ar, 'جئتُ لأن أول طالب…'); assert.equal(opened.state_ar, null);
  const body = gradBody({ code: 'ATH-GD-AAAA-BBBB', program: { id: 'p', name_ar: 'ب', start: '2026-08-01', end: '2026-11-07' }, name: 'نورة', line_ar: 'سطر', cards, keep: { welcome: true, first_why: true } as any, counts: { threads: 0, replies: 0, amanat: 0, chapters: 0, days: 0 }, sealed_at: '2026-11-07T10:00:00Z' });
  assert.deepEqual(publicFace(body, ['line', 'counts']).cards, [], 'الافتراضي: السطر والأعداد فقط'); assert.deepEqual(publicFace(body, ['line', 'welcome', 'first_why']).cards.map((x) => x.key), ['welcome', 'first_why']); assert.equal(publicFace(body, ['first_why']).cards[0].href, null, 'لا روابط خاصة على الوجه العام');
});

test('P64 · الكرون: 🌅 «اليوم يومك الأول» يوم start_date فقط (يُدفع) · «اكتب كلمة الاستقبال» قبلها بيوم · «سطرك ينتظر N» للخرّيج ذي الوجه العام (k ≥ 5 سطور ودفعة ≥ 5) · dedupe · لا رجعية', async () => {
  const now = new Date('2026-11-07T06:00:00Z'); /* 09:00 الرياض */
  const programs = [{ id: 'p64', name_ar: 'الدبلوم', start_date: '2026-11-07' }, { id: 'pOld', name_ar: 'الدبلوم', start_date: '2025-01-01' }, { id: 'pTmrw', name_ar: 'قريب', start_date: '2026-11-08' }, { id: 'pSmall', name_ar: 'صغير', start_date: '2026-11-07' }];
  const enroll = [...['a', 'b', 'c', 'd', 'e'].map((x, i) => ({ id: `e${i}`, program_id: 'p64', email: `${x}@x.sa`, user_id: `u${i}`, status: 'approved' })), { id: 'eDup', program_id: 'p64', email: 'A@x.sa', user_id: 'u0', status: 'approved' }, { id: 'eP', program_id: 'p64', email: 'z@x.sa', user_id: null, status: 'pending' }, { id: 'eOld', program_id: 'pOld', email: 'old@x.sa', user_id: null, status: 'approved' }, { id: 'eS', program_id: 'pSmall', email: 's@x.sa', user_id: null, status: 'approved' }];
  const rooms = [{ id: 'c1', code: 'N-2', program_id: 'pTmrw', trainer_id: 't1' }, { id: 'c2', code: 'N-3', program_id: 'pTmrw', trainer_id: 't9' }, { id: 'c3', code: 'N-1', program_id: 'p64', trainer_id: 't1' }];
  const trainers = [{ id: 't1', email: 'T1@x.sa' }, { id: 't9', email: null }];
  const grads: any[] = [1, 2, 3, 4, 5].map((i) => ({ id: 900 + i, user_id: `g${i}`, email: `g${i}@x.sa`, program_id: 'pOld', live_public: true, sealed_at: '2025-06-01T00:00:00Z', revoked_at: null, body: { line_ar: `سطر ${i}` } }))
    .concat([{ id: 906, user_id: 'g6', email: 'g6@x.sa', program_id: 'pOld', live_public: false, sealed_at: '2025-06-01T00:00:00Z', revoked_at: null, body: { line_ar: 'خاص' } }, { id: 907, user_id: 'g7', email: 'g7@x.sa', program_id: 'pOld', live_public: true, sealed_at: '2025-06-01T00:00:00Z', revoked_at: '2025-07-01T00:00:00Z', body: { line_ar: 'مُبطل' } }]);
  const notices: any[] = [];
  const db: any = { from: (t: string) => { const q: any = { _eq: {} as Record<string, string>, _in: {} as Record<string, string[]>, _isnull: [] as string[], _notnull: [] as string[] }; const chain = () => q;
    for (const op of ['select', 'gte', 'lte', 'neq', 'order']) q[op] = chain; q.eq = (k: string, v: any) => { q._eq[k] = String(v); return q; }; q.in = (k: string, v: string[]) => { q._in[k] = v; return q; }; q.is = (k: string, v: any) => { if (v === null) q._isnull.push(k); return q; }; q.not = (k: string, op: string, v: any) => { if (op === 'is' && v === null) q._notnull.push(k); return q; };
    const run = () => { let rows: any[] = t === 'programs' ? programs : t === 'portal_enrollments' ? enroll : t === 'classrooms' ? rooms : t === 'trainers' ? trainers : t === 'portal_grad_pages' ? grads : [];
      for (const [k, v] of Object.entries(q._eq)) rows = rows.filter((r) => String(r[k]) === v); for (const [k, v] of Object.entries(q._in)) rows = rows.filter((r) => (v as string[]).includes(String(r[k]))); for (const k of q._isnull) rows = rows.filter((r) => r[k] === null || r[k] === undefined); for (const k of q._notnull) rows = rows.filter((r) => r[k] !== null && r[k] !== undefined); return rows; };
    q.limit = () => Promise.resolve({ data: run(), error: null }); q.maybeSingle = () => Promise.resolve({ data: run()[0] || null, error: null });
    const ins = (p: any) => ({ select: () => { const go = async () => { if (notices.some((n) => n.dedupe_key === p.dedupe_key)) return { data: null, error: null }; notices.push(p); return { data: [{ id: notices.length, ...p }], error: null }; }; const pr = go(); return Object.assign(pr, { single: async () => { const r = await pr; return r.data ? { data: r.data[0], error: null } : { data: null, error: { code: '23505', message: 'dup' } }; }, maybeSingle: async () => { const r = await pr; return { data: r.data ? r.data[0] : null, error: null }; } }); }, then: (r: any) => r({ data: null, error: null }) });
    q.upsert = ins; q.insert = ins; return q; } };
  const r1 = await runFirstDays(db, { now, dry: false }); assert.deepEqual(r1.errors, []);
  assert.equal(r1.learners, 6, 'خمسة في p64 (التكرار يُجمع · pending لا) + واحد في pSmall · القديم لا'); assert.equal(r1.trainers, 1, 'شعبة واحدة لمدرّب له بريد — برنامج الغد فقط'); assert.equal(r1.graduates, 5, 'خمسة خرّيجين بوجه عام — الخاص والمُبطل لا؛ pSmall (متدرّب واحد) لا');
  const f = notices.find((n) => n.kind === 'first_day'); assert.equal(f.email, 'a@x.sa'); assert.equal(f.dedupe_key, 'first_day:e0'); assert.equal(f.url, '/me/first?program=p64');
  const w = notices.find((n) => n.kind === 'welcome_word'); assert.equal(w.email, 't1@x.sa'); assert.equal(w.dedupe_key, 'welcome_word:c1'); assert.equal(w.url, '/me/day?welcome=c1');
  const g = notices.filter((n) => n.kind === 'line_awaits'); assert.equal(g.length, 5); assert.equal(g[0].dedupe_key, 'line_awaits:901:2026-11-07'); assert.match(g[0].title_ar, /سطرك ينتظر 5 متدرّبًا/); assert.ok(!notices.some((n) => n.email === 'g6@x.sa' || n.email === 'g7@x.sa'));
  const r2 = await runFirstDays(db, { now, dry: false }); assert.equal(r2.learners + r2.trainers + r2.graduates, 0, 'مرّة واحدة');
  const cron = read('app/api/followups/send/route.ts'); assert.match(cron, /runFirstDays\(db, \{ site, dry \}\)/); assert.match(cron, /grad_days, first_days, evidence/);
});

test('P64 · شكل المصدر: صفر SQL · كلمة الاستقبال عبر P51 (welcome) · «لماذا جئتُ» عبر P62 خارج حدّ الثلاث · شريط صفحة البرنامج · التبويب · لا ذكاء اصطناعي', () => {
  assert.ok(!has('supabase/migrations/20270201_portal_p64_first_day.sql'), 'لا هجرة'); for (const f of ['lib/first/registry.ts', 'lib/first/store.ts', 'app/api/me/first/route.ts', 'app/me/first/page.tsx', 'app/me/first/FirstDesk.tsx']) assert.ok(has(f), f);
  const store = read('lib/first/store.ts'); assert.match(store, /dedupe_key: `first_day:\$\{e\.id\}`, push: true/); assert.match(store, /dedupe_key: `welcome_word:\$\{room\.id\}`, push: false/); assert.match(store, /dedupe_key: `line_awaits:\$\{g\.id\}:\$\{today\}`, push: false/, 'يُدفع «اليوم يومك الأول» وحده'); assert.match(store, /from\('portal_grad_pages'\)[\s\S]*eq\('live_public', true\)[\s\S]*not\('sealed_at', 'is', null\)[\s\S]*is\('revoked_at', null\)/, 'الوجه العام المختوم غير المُبطل فقط'); assert.doesNotMatch(store, /full_name|\.name_ar\b.*grad/, 'لا أسماء من صفحات التخرّج'); assert.doesNotMatch(store, /gemini|openai|generateContent/i);
  assert.match(store, /writeLetter\(db, me, \{ body_ar: [^}]*horizon: 'grad', program_id: p\.id, prompt_key: WHY_PROMPT_KEY, context_key: WHY_CONTEXT \}/, 'محرّك P62 نفسه');
  const ls = read('lib/letters/store.ts'); assert.match(ls, /firstDay \? validateWhy\(b\) : validateLetter\(b\)/); assert.match(ls, /context_key \|\| ''\) !== 'first_day'\);/); assert.match(ls, /!firstDay && sealed\.length >= LETTER_LIMITS\.maxSealed/);
  const day = read('lib/portal/day.ts'); assert.match(day, /welcome\?: boolean/); assert.match(day, /🌅 كلمة الاستقبال من مدرّبك/); assert.match(day, /welcome_word:\$\{room\.id\}:\$\{l\.email\}/); assert.match(day, /\/me\/first\$\{room\.program_id/);
  assert.match(read('app/api/me/day/route.ts'), /welcome: b\.welcome === true/); const book = read('app/me/day/DayBook.tsx'); assert.match(book, /data-testid="dy-welcome"/); assert.match(book, /sp\?\.get\('welcome'\)/);
  const gs = read('lib/grad/store.ts'); assert.match(gs, /\(x\.meta as any\)\.welcome/); assert.match(gs, /context_key \|\| ''\) === 'first_day'\)/); assert.match(gs, /c\.horizon === 'grad' && String\(c\.context_key \|\| ''\) !== 'first_day'/, 'رسالة التخرّج لا تختلط بسطر أول يوم');
  assert.match(read('lib/after/load.ts'), /import\('\.\.\/first\/store'\)/); assert.match(read('app/components/ProgramAfter.tsx'), /data-testid="pa-said"/);
  assert.match(read('app/me/page.tsx'), /href="\/me\/first" data-testid="me-first"/); assert.match(read('app/me/letter/SelfLetter.tsx'), /sealedCount = sealed\.filter\(\(l\) => l\.context_key !== 'first_day'\)\.length/);
  const desk = read('app/me/first/FirstDesk.tsx'); assert.match(desk, /data-testid="fd-athar"/); assert.ok(desk.indexOf('fd-athar') < desk.indexOf('fd-prog'), 'كلمة أَثَر أولًا'); assert.match(desk, /ssr: false|'use client'/); assert.doesNotMatch(desk, /from '\.\.\/\.\.\/\.\.\/lib\/first\/store'(?!;)/);
  assert.match(desk, /import type \{ FirstProgram, FirstView \} from '\.\.\/\.\.\/\.\.\/lib\/first\/store'/, 'أنواع فقط — لا تسرّب للمتصفح');
  const route = read('app/api/me/first/route.ts'); assert.match(route, /rateLimit\(db, `first:\$\{user\.id\}`, 3600, 20\)/); assert.match(route, /export const dynamic = 'force-dynamic'/);
});
