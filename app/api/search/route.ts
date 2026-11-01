// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «دليل أَثَر» (P41) — GET /api/search?q=…&lang=ar|en[&ask=1]
 *  يبحث في المحتوى الحيّ بحسب صلاحية الطالب — ثلاث طبقات:
 *   · الزائر: البرامج المنشورة · الحقائب المنشورة · الجلسات القادمة · المحاكيات · هيئة أَثَر المعتمَدة.
 *   · الداخل: + شهاداتي · نتائج مِعيار ببريدي.
 *   · الطاقم: + المتدرّبون (اسم/بريد) · المؤسسات · دعوات مِعيار · بنود البنك.
 *  ask=1 (سؤال ينتهي بعلامة استفهام): «أثير» يجيب من النتائج فقط (لا يختلق) ويعيد المصادر — والإنسان يقرّر.
 *  الصفحات والأوامر تُفهرَس في المتصفح (lib/portal/search.ts) ولا تمرّ من هنا.
 *  درع أَثَر: 120 نداء/دقيقة/IP للبحث · 12/دقيقة للسؤال. كل مصدر داخل safe() — تعطّل جدول لا يُسقط اللوحة.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, ipOf, tooMany } from '../../../lib/shield/ratelimit';
import { normalizeAr, parseIntent, type Entry, type Group } from '../../../lib/portal/search';
import { runAi } from '../../../lib/ai/athar';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
type Ctx = { db: any; userDb: any; user: { id: string; email: string } | null; staff: boolean };
const safe = async <T,>(p: PromiseLike<{ data: T | null; error?: unknown }>, fb: T): Promise<T> => { try { const { data, error } = await p; return error || data == null ? fb : data; } catch { return fb; } };
/* مسار GET: يخزّن Next.js نداءات fetch (حتى POST مثل RPC الصمّام) في ذاكرة البيانات — نعطّلها صراحةً حتى لا يُعاد تقديم نتائج قديمة ولا يُتجاوز حدّ المعدل */
const noStore: typeof fetch = (input, init) => fetch(input, { ...(init || {}), cache: 'no-store' });
const esc = (s: string) => s.replace(/[%,()\\]/g, ' ').trim(); /* محارف PostgREST المحجوزة في or=() فقط */

async function ctxOf(req: Request): Promise<Ctx | null> {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL, A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, S = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!U || !A || !S) return null;
  const db = createClient(U, S, { auth: { persistSession: false }, global: { fetch: noStore } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { db, userDb: null, user: null, staff: false };
  try {
    const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` }, fetch: noStore } });
    const { data } = await userDb.auth.getUser(token); if (!data?.user) return { db, userDb: null, user: null, staff: false };
    const prof = await safe<any>(userDb.from('profiles').select('role').eq('id', data.user.id).maybeSingle(), null);
    return { db, userDb, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase() }, staff: STAFF.includes(String(prof?.role || '').toUpperCase()) };
  } catch { return { db, userDb: null, user: null, staff: false }; }
}

const E = (group: Group, id: string, href: string, ar: string, en: string, hint?: { ar: string; en: string }): Entry => ({ id, href, ar, en, group, hint });
const lvOf = (rep: any): string => String(rep?.['المستوى_العام']?.['الرمز'] || rep?.['المستوى_العام'] || rep?.final_level || rep?.level || '').slice(0, 8);
/* صيغ البحث في قاعدة البيانات: النص كما كُتب (بلا تشكيل) + نسخة بلا «ال» التعريف — لأن الجداول تحفظ الرسم الأصلي (ة/أ)، فلا نطبّعها كما نفعل في فهرس المتصفح */
const TASHKEEL_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
function variants(raw: string): string[] { const a = raw.replace(TASHKEEL_RE, '').trim(); const out = [a]; const b = a.replace(/^ال/, ''); if (b && b !== a && b.length >= 2) out.push(b); return out; }
const or = (cols: string[], q: string) => { const vs = variants(q); return cols.flatMap(c => vs.map(v => `${c}.ilike.%${v}%`)).join(','); };

async function search(c: Ctx, raw: string, lang: 'ar' | 'en'): Promise<Entry[]> {
  const q = esc(raw).slice(0, 80); if (q.length < 2) return [];
  const qn = normalizeAr(q); const like = q; const today = new Date().toISOString();
  const db = c.db; const L = 5; const jobs: Promise<Entry[]>[] = [];
  /* ---- الزائر ---- */
  jobs.push(safe<any[]>(db.from('programs').select('id,name_ar,name_en,cefr_level').eq('is_public', true).is('archived_at', null).or(or(['name_ar', 'name_en'], like)).limit(L), [])
    .then(r => r.map(p => E('program', `program-${p.id}`, `/programs/${p.id}`, p.name_ar, p.name_en || p.name_ar, p.cefr_level ? { ar: `المستوى ${p.cefr_level}`, en: `Level ${p.cefr_level}` } : undefined))));
  jobs.push(safe<any[]>(db.from('portal_resources').select('id,title_ar,title_en,type').eq('status', 'published').or(or(['title_ar', 'title_en', 'summary_ar'], like)).limit(L), [])
    .then(r => r.map(x => E('resource', `res-${x.id}`, `/resources/${x.id}`, x.title_ar, x.title_en || x.title_ar))));
  jobs.push(safe<any[]>(db.from('portal_sessions').select('id,title_ar,title_en,starts_at,kind').in('status', ['scheduled', 'live']).gte('starts_at', today).or(or(['title_ar', 'title_en', 'speaker_name'], like)).order('starts_at').limit(L), [])
    .then(r => r.map(x => E('session', `ses-${x.id}`, `/live/${x.id}`, x.title_ar, x.title_en || x.title_ar, { ar: new Date(x.starts_at).toLocaleDateString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeZone: 'Asia/Riyadh' }), en: new Date(x.starts_at).toLocaleDateString('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Riyadh' }) }))));
  jobs.push(safe<any[]>(db.from('portal_scenarios').select('id,slug,title_ar,level').eq('status', 'published').or(or(['title_ar', 'situation_ar'], like)).limit(L), [])
    .then(r => r.map(x => E('sim', `sim-${x.id}`, `/sim/${x.slug || x.id}`, x.title_ar, x.title_ar))));
  jobs.push(safe<any[]>(db.from('portal_directory_profiles').select('id,slug,name_ar,name_en,title_ar,title_en,faces').eq('status', 'approved').eq('listed', true).or(or(['name_ar', 'name_en', 'title_ar', 'search_plain'], like)).limit(L), [])
    .then(r => r.map(x => { const face = Array.isArray(x.faces) && x.faces.includes('trainer') && !x.faces.includes('expert') ? 'trainers' : 'experts'; return E('person', `dir-${x.id}`, `/${face}/${x.slug || x.id}`, x.name_ar, x.name_en || x.name_ar, { ar: x.title_ar || '', en: x.title_en || x.title_ar || '' }); })));
  /* ---- الداخل ---- */
  if (c.user) {
    jobs.push(safe<any[]>(db.from('portal_credentials').select('id,verify_code,title_ar,title_en,issued_at').eq('user_id', c.user.id).is('revoked_at', null).or(or(['title_ar', 'title_en', 'verify_code'], like)).limit(L), [])
      .then(r => r.map(x => E('credential', `cred-${x.id}`, `/credential/${x.verify_code}`, x.title_ar, x.title_en || x.title_ar, { ar: x.verify_code, en: x.verify_code }))));
    if (c.user.email) jobs.push(safe<any[]>(db.from('placement_reports').select('id,access_code,created_at,report').ilike('candidate_email', c.user.email).order('created_at', { ascending: false }).limit(3), [])
      .then(r => r.filter(x => x.access_code && (qn.includes('معيار') || qn.includes('نتيج') || qn.includes('miaar') || qn.includes('result') || qn.includes('مستو') || String(x.access_code).toLowerCase().includes(qn))).map(x => E('result', `rep-${x.id}`, `/miaar/result/${x.access_code}`, `تقرير مِعيار ${lvOf(x.report)}`.trim(), `Miaar report ${lvOf(x.report)}`.trim(), { ar: x.access_code, en: x.access_code }))));
  }
  /* ---- الطاقم ---- */
  if (c.staff) {
    jobs.push(safe<any[]>(db.from('profiles').select('id,full_name,email,role').or(or(['full_name', 'email'], like)).limit(6), [])
      .then(r => r.map(x => E('trainee', `prof-${x.id}`, `/admin/enrollments?q=${encodeURIComponent(x.email || x.full_name || '')}`, x.full_name || x.email, x.full_name || x.email, { ar: x.email || '', en: x.email || '' }))));
    jobs.push(safe<any[]>(db.from('portal_organizations').select('id,name_ar,name_en,city').or(or(['name_ar', 'name_en', 'email_domain'], like)).limit(L), [])
      .then(r => r.map(x => E('org', `org-${x.id}`, '/admin/skills', x.name_ar, x.name_en || x.name_ar, { ar: x.city || '', en: x.city || '' }))));
    jobs.push(safe<any[]>(db.from('placement_invites').select('id,code,label_ar,status').or(or(['code', 'label_ar'], like)).limit(L), [])
      .then(r => r.map(x => E('invite', `inv-${x.id}`, '/admin/miaar/invites', x.label_ar || x.code, x.label_ar || x.code, { ar: `/miaar/d/${x.code}`, en: `/miaar/d/${x.code}` }))));
    jobs.push(safe<any[]>(db.from('question_bank_items').select('id,item_code,level,status').or(or(['item_code', 'cefr_descriptor'], like)).limit(L), [])
      .then(r => r.map(x => E('item', `item-${x.id}`, `/admin/miaar/bank?q=${encodeURIComponent(x.item_code)}`, x.item_code, x.item_code, { ar: `${x.level} · ${x.status}`, en: `${x.level} · ${x.status}` }))));
  }
  const all = (await Promise.all(jobs)).flat();
  const seen = new Set<string>(); return all.filter(e => !seen.has(e.id) && seen.add(e.id)).slice(0, 40);
}

/* سؤال «؟»: نبحث بكلماته المفتاحية (حتى 3) لا بالجملة كاملة */
const STOP = new Set(['كيف', 'ما', 'ماذا', 'هل', 'اين', 'أين', 'متى', 'لماذا', 'من', 'في', 'على', 'الى', 'إلى', 'عن', 'مع', 'او', 'أو', 'ان', 'أن', 'هو', 'هي', 'هذا', 'هذه', 'يمكن', 'يمكنني', 'اريد', 'أريد', 'احصل', 'أحصل', 'how', 'what', 'where', 'when', 'why', 'can', 'the', 'for', 'and', 'with', 'get', 'do', 'is', 'are', 'my', 'me']);
function keywords(s: string): string[] { const out: string[] = []; for (const w0 of s.split(/\s+/)) { const w = w0.replace(/[؟?،,.!]/g, '').replace(/^[وفبك]?ال(?=.{3})/, ''); if (w.length >= 3 && !STOP.has(w) && !STOP.has(w0)) out.push(w); if (out.length >= 3) break; } return out.length ? out : [s.slice(0, 40)]; }

async function ask(question: string, sources: Entry[], lang: 'ar' | 'en'): Promise<{ text: string; source: 'ai' | 'local'; error: string | null; model: string | null; ms: number; provider: string | null }> {
  const list = sources.slice(0, 12).map((s, i) => `[${i + 1}] ${lang === 'ar' ? s.ar : s.en} — ${s.href}${s.hint ? ' — ' + (lang === 'ar' ? s.hint.ar : s.hint.en) : ''}`).join('\n');
  const local = () => (lang === 'ar' ? (sources.length ? `أقرب ما وجدته لسؤالك: ${sources.slice(0, 3).map(s => s.ar).join(' · ')}. افتح أيًّا منها من القائمة أدناه.` : 'لم أجد ما يطابق سؤالك داخل البوابة. جرّب كلمات أقل، أو اسأل فريق أَثَر من صفحة «تواصل معنا».') : (sources.length ? `Closest matches: ${sources.slice(0, 3).map(s => s.en).join(' · ')}.` : 'Nothing in the portal matches that. Try fewer words or contact the Athar team.'));
  const r = await runAi<string>({
    system: lang === 'ar' ? 'أنت «أثير»، مرشد بوابة أَثَر. أجب عن سؤال الزائر في جملتين أو ثلاث بالعربية الفصحى الواضحة، اعتمادًا على قائمة المصادر فقط. إن لم تكفِ المصادر فقل ذلك صراحة ووجّهه إلى «تواصل معنا». لا تختلق أرقامًا أو روابط. أشر إلى المصدر برقمه بين قوسين مربعين.' : 'You are Athir, the Athar portal guide. Answer in two or three clear sentences using ONLY the listed sources; if they are insufficient say so and point to Contact us. Never invent numbers or links. Cite sources as [n].',
    user: `${lang === 'ar' ? 'السؤال' : 'Question'}: ${question}\n\n${lang === 'ar' ? 'المصادر' : 'Sources'}:\n${list || '(none)'}`,
    parse: raw => { const t = String(raw || '').trim(); return t.length > 4 ? t.slice(0, 700) : null; }, local, budgetMs: 16000, fast: true,   // P42: كانت 9 ث فسقطت إلى المحلي على Vercel البارد
  });
  /* P42-ب: سبب السقوط إلى المحلي يُعاد (مقتطعًا) للتشخيص على Vercel — لا مفاتيح ولا نصوص المزوّد الكاملة */
  return { text: r.data, source: r.source, error: r.error ? String(r.error).replace(/key=[^&\s]+/gi, 'key=…').slice(0, 160) : null, model: r.model, ms: r.ms, provider: r.provider };
}

export async function GET(req: Request) {
  const u = new URL(req.url); const q = (u.searchParams.get('q') || '').trim().slice(0, 120); const lang = u.searchParams.get('lang') === 'en' ? 'en' : 'ar'; const wantAsk = u.searchParams.get('ask') === '1';
  const c = await ctxOf(req); if (!c) return NextResponse.json({ ok: false, error: 'server_config' }, { status: 500 });
  const rl = await rateLimit(c.db, `search:${wantAsk ? 'ask' : 'q'}:ip:${ipOf(req)}`, 60, wantAsk ? 12 : 120); if (!rl.allowed) return tooMany(rl);
  if (q.length < 2 || q === '__who__') return NextResponse.json({ ok: true, q, results: [], staff: c.staff, user: !!c.user }, { headers: { 'Cache-Control': 'private, no-store' } });
  const intent = parseIntent(q);
  const terms = intent.kind === 'ask' ? keywords(intent.value) : [intent.kind === 'email' ? intent.value : q];
  const lists = await Promise.all(terms.map(t => search(c, t, lang)));
  const seenIds = new Set<string>(); const results = lists.flat().filter(e => !seenIds.has(e.id) && seenIds.add(e.id)).slice(0, 40);
  const body: Record<string, unknown> = { ok: true, q, intent: intent.kind, results, staff: c.staff, user: !!c.user };
  if (wantAsk && intent.kind === 'ask') { const a = await ask(intent.value, results, lang); body.answer = a.text; body.answer_source = a.source; body.answer_ms = a.ms; body.answer_provider = a.provider || 'none'; if (a.model) body.answer_model = a.model; if (a.error) body.answer_error = a.error; }
  return NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
}
