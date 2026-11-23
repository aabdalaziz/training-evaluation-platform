// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runKids } from '../lib/kids/cron';
import { weekStart } from '../lib/kids/parent';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** قاعدة وهمية صغيرة تحاكي سلسلة supabase-js التي يستعملها runKids وتسجّل الكتابات */
function fakeDb(tables: Record<string, any[]>) {
  const writes: { table: string; op: string; rows: any; filter?: any }[] = [];
  const q = (table: string) => {
    const f: { gte?: [string, string]; lt?: [string, string]; eq?: [string, any]; in?: [string, any[]]; isNull?: string } = {};
    const run = () => (tables[table] || []).filter(r =>
      (!f.lt || String(r[f.lt[0]]) < f.lt[1]) && (!f.gte || String(r[f.gte[0]]) >= f.gte[1]) && (!f.eq || r[f.eq[0]] === f.eq[1]) && (!f.in || f.in[1].includes(r[f.in[0]])) && (!f.isNull || r[f.isNull] == null));
    const b: any = {
      select() { return b; }, order() { return b; }, limit() { return Promise.resolve({ data: run(), error: null }); },
      lt(k: string, v: string) { f.lt = [k, v]; return b; }, gte(k: string, v: string) { f.gte = [k, v]; return b; }, eq(k: string, v: any) { f.eq = [k, v]; return b; },
      in(k: string, v: any[]) { f.in = [k, v]; return b; }, is(k: string, _v: null) { f.isNull = k; return b; },
      delete() { return { lt(k: string, v: string) { f.lt = [k, v]; writes.push({ table, op: 'delete', rows: run(), filter: f }); return Promise.resolve({ error: null }); } }; },
      insert(rows: any[]) { writes.push({ table, op: 'insert', rows }); return Promise.resolve({ error: null }); },
      upsert(rows: any[], o: any) { writes.push({ table, op: 'upsert', rows, filter: o }); return Promise.resolve({ error: null }); },
      then(res: any) { return Promise.resolve({ data: run(), error: null }).then(res); },
    };
    return b;
  };
  return { from: q, writes };
}

test('runKids: يمحو «قالَ لِلُؤلُؤ» بعد مهلته، ويطفئ الأمانة المنتهية بصفّ إلحاقي باسم وليّ الأمر، ويكتب رسالة الأسبوع الماضي مرّة', async () => {
  const now = new Date('2026-12-06T03:00:00Z'); // الأحد → الأسبوع الحالي يبدأ السبت 2026-12-05، والماضي 2026-11-28
  assert.equal(weekStart(now), '2026-12-05');
  const db = fakeDb({
    kids_children: [{ id: 'c1', parent_id: 'u1', nick: 'ريم', gender: 'f', archived_at: null }, { id: 'c2', parent_id: 'u2', nick: 'سعد', gender: 'm', archived_at: null }],
    kids_talks: [
      { id: 't-old', child_id: 'c1', purge_after: '2026-12-01T00:00:00Z', at: '2026-09-02T00:00:00Z', results: [] },
      { id: 't-new', child_id: 'c1', purge_after: '2027-02-20T00:00:00Z', at: '2026-11-30T10:00:00Z', results: [{ role: 'answer', matched: 'yes', attempts: 1, heard: 'أَنا أُرَتِّبُ غُرْفَتي' }] },
    ],
    kids_consents: [
      { child_id: 'c1', kind: 'save_text', granted: true, granted_at: '2026-08-01T00:00:00Z', expires_at: '2026-10-30T00:00:00Z', text_version: 1 },
      { child_id: 'c2', kind: 'speech_recog', granted: true, granted_at: '2026-11-01T00:00:00Z', expires_at: null, text_version: 1 },
    ],
    kids_progress: [{ child_id: 'c1', session_slug: 'bayt', started_at: '2026-11-30T09:00:00Z', badge: 'مُرَتِّبُ الْبَيْتْ', self_check: 'easy', home_task_done_at: null }],
    kids_letters: [{ child_id: 'c2', week_start: '2026-11-28' }],
  });
  const r = await runKids(db as any, { now });
  assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.purged, 1); assert.equal(r.expired, 1); assert.equal(r.letters, 1); assert.equal(r.week, '2026-11-28');
  const del = db.writes.find(w => w.table === 'kids_talks' && w.op === 'delete')!; assert.deepEqual(del.rows.map((x: any) => x.id), ['t-old']);
  const exp = db.writes.find(w => w.table === 'kids_consents')!; assert.equal(exp.rows[0].child_id, 'c1'); assert.equal(exp.rows[0].kind, 'save_text'); assert.equal(exp.rows[0].granted, false); assert.equal(exp.rows[0].granted_by, 'u1');
  const let1 = db.writes.find(w => w.table === 'kids_letters')!; assert.equal(let1.rows.length, 1); assert.equal(let1.rows[0].child_id, 'c1'); assert.equal(let1.rows[0].week_start, '2026-11-28');
  // أمانة النصّ منتهية ⇒ لا نصّ مسموع في الرسالة، لكن عدد الأحاديث يُذكر
  assert.ok(let1.rows[0].body_ar.includes('لعبت ريم')); assert.ok(let1.rows[0].body_ar.includes('ولم تأذنوا بحفظ الكلمات')); assert.ok(!let1.rows[0].body_ar.includes('أُرَتِّبُ غُرْفَتي'));
  assert.ok(let1.rows[0].body_ar.length <= 1200);
});

test('runKids: الوضع الجافّ يعدّ ولا يكتب، ولا أطفال ⇒ صفر بلا خطأ', async () => {
  const now = new Date('2026-12-06T03:00:00Z');
  const db = fakeDb({ kids_children: [{ id: 'c1', parent_id: 'u1', nick: 'ريم', gender: 'f', archived_at: null }], kids_talks: [{ id: 'x', child_id: 'c1', purge_after: '2026-01-01T00:00:00Z' }], kids_consents: [], kids_progress: [], kids_letters: [] });
  const r = await runKids(db as any, { now, dry: true }); assert.ok(r.ok && r.purged === 1 && r.letters === 1); assert.equal(db.writes.length, 0);
  const empty = fakeDb({ kids_children: [], kids_talks: [], kids_consents: [], kids_progress: [], kids_letters: [] });
  const r2 = await runKids(empty as any, { now }); assert.ok(r2.ok && r2.purged === 0 && r2.letters === 0 && r2.expired === 0);
});

test('السلسلة اليومية: runKids مربوط في /api/followups/send ويظهر في الاستجابة — بلا كرون جديد', () => {
  const s = read('app/api/followups/send/route.ts');
  assert.ok(/import \{ runKids \} from '\.\.\/\.\.\/\.\.\/\.\.\/lib\/kids\/cron'/.test(s));
  assert.ok(/kids = await runKids\(db, \{ dry \}\)/.test(s));
  assert.ok(/directory, kids \}\)/.test(s));
  assert.ok(!fs.existsSync(path.join(ROOT, 'vercel.json')) || !/kids/.test(read('vercel.json')));
});

test('منطقة اللعب /kids/play/[child]: بوّابة الكبار الحسابية ثمّ الجلسة بوضع الطفل، في جلسة وليّ الأمر', () => {
  const page = read('app/kids/play/[child]/page.tsx'); const kp = read('app/components/kids/KidPlay.tsx');
  assert.ok(/robots: \{ index: false/.test(page)); assert.ok(/<KidPlay childId=\{params\.child\}/.test(page));
  assert.ok(/adultGate\(\)/.test(kp) && /checkGate\(gate, ans\)/.test(kp));
  assert.ok(/api\(`\/api\/kids\?child=/.test(kp), 'يقرأ البذرة من /api/kids بجلسة وليّ الأمر');
  assert.ok(/action: 'progress', child: childId/.test(kp), 'يبلّغ نهاية الجلسة إلى /api/kids');
  assert.ok(/<BayanSession key=\{S\.slug\} session=\{S\} child=\{kid\}/.test(kp));
  assert.ok(/\/login\?next=/.test(kp), 'غير المسجَّل يُحال إلى الدخول');
  assert.ok(!/localStorage/.test(kp), 'لا تخزين محلّيًّا في وضع الطفل');
});

test('BayanSession بوضع الطفل: لا بوّابة اسم، التعرّف بأمانة speech_recog، النصّ بأمانة save_text، والمخرج إلى بذرة الطفل', () => {
  const s = read('app/components/kids/BayanSession.tsx'); const t = read('app/components/kids/Talk.tsx');
  assert.ok(/export type KidChild = \{ id: string; nick: string; gender: 'm' \| 'f'; consents: \{ speech_recog: boolean; save_text: boolean \}/.test(s));
  assert.ok(/useState<'gate' \| 'hello' \| 'anthem'>\(p\.child \|\| p\.name \? 'hello' : 'gate'\)/.test(s), 'الطفل المعروف يبدأ من الترحيب');
  assert.ok(/if \(child\) return; try \{ const s = localStorage\.getItem\('bayan_demo_child'\)/.test(s), 'لا قراءة من مفتاح العرض في وضع الطفل');
  assert.ok(/recogAllowed=\{p\.child \? p\.child\.consents\.speech_recog : undefined\}/.test(s));
  assert.ok(/\(recogAllowed \?\? talkRecogEnabled\(\)\) && !!speechRecognitionCtor\(\)/.test(t));
  assert.ok(/child\.consents\.save_text \? \{ role: r\.role, matched: r\.matched, attempts: r\.attempts, heard: r\.heard \} : \{ role: r\.role, matched: r\.matched, attempts: r\.attempts \}/.test(s), 'النصّ المسموع لا يغادر الجهاز بلا إذن');
  assert.ok(/href=\{child \? child\.exitHref : '\/kids'\}/.test(s));
  assert.ok(/p\.report\(\{ stations: \{ athari: true \} \}\)/.test(s) && /p\.report\(\{ talk: o\.results, selfVoice: o\.selfVoice \}\)/.test(s) && /p\.report\(\{ self: o\.key \}\)/.test(s));
  // التسجيل في «حَديثٌ مَعَ لُؤْلُؤ» يبقى في ذاكرة الجهاز (إعادة الاستماع) ولا يغادره: لا fetch/FormData في المكوّنين، والمخرج نصّ ووجه فقط
  assert.ok(!/fetch\(|FormData|XMLHttpRequest/.test(t) && !/fetch\(|FormData|XMLHttpRequest/.test(s), 'لا إرسال من مكوّني الجلسة والحوار');
  assert.ok(/onDone\(\{ results, selfVoice: face \}\)/.test(t) && /export type TalkOutcome = \{ results: TalkResult\[\]; selfVoice: string \| null \}/.test(t));
});

test('بَيْتُ بَيان: GET يعيد رسائل الأسابيع المخزَّنة، والصفحة تعرضها مطويّة', () => {
  const r = read('app/api/kids/route.ts'); const h = read('app/components/kids/ParentHome.tsx');
  assert.ok(/from\('kids_letters'\)\.select\('id,child_id,week_start,body_ar,sentence_ar,created_at'\)/.test(r));
  assert.ok(/letters: \(\(letters \|\| \[\]\) as any\[\]\)\.filter\(l => l\.child_id === v\.id\)\.slice\(0, 6\)/.test(r));
  assert.ok(/kp-past/.test(h) && /رسائل الأسابيع الماضية/.test(h));
  assert.ok(/export async function api\(/.test(h));
});
