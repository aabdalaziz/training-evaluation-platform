import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, SECTORS, BUDGETS, STEPS, REQ_STATUS, QUOTE_STATUS, reqStatusLabel, areaLabel, sectorLabel, budgetLabel, TIMELINE, timelineIndex, EMPTY_FORM, validateRequest, quoteTotals, cleanItems, validateQuote, isQuoteExpired, lines, pipeline, requestsSheet, requestReceivedEmail, newRequestAdminEmail, quoteSentEmail, quoteRespondedAdminEmail, statusEmail, updateEmail, QW, QH } from '../lib/portal/consulting';
import type { ConsultingRequest, Quote, Update } from '../lib/portal/consulting';
import { invoiceEmail, receiptEmail } from '../lib/portal/payments';
import type { Invoice } from '../lib/portal/payments';
import { SERVICES, NAV, serviceBySlug } from '../lib/portal/content';

const REQ = (x: Partial<ConsultingRequest> = {}): ConsultingRequest => ({ id: 'a1b2c3d4-0000-4000-8000-000000000001', created_at: '2026-11-08T09:00:00Z', updated_at: '2026-11-08T09:00:00Z', user_id: 'u1', full_name: 'سارة العتيبي', email: 'sara@school.sa', phone: '0501234567', organization: 'مدارس النخبة', sector: 'school', area: 'quality', title: 'بناء نظام جودة داخلي استعدادًا للاعتماد', details: 'نحتاج إلى تشخيص الوضع الحالي وبناء دليل إجراءات ومؤشرات أداء قبل زيارة الاعتماد.', goals: 'الحصول على الاعتماد', timeline: 'الفصل القادم', budget_range: '25-100', lang: 'ar', status: 'new', ...x });
const QUOTE = (x: Partial<Quote> = {}): Quote => ({ id: 'q1', request_id: REQ().id, created_at: '2026-11-09T09:00:00Z', version: 1, currency: 'SAR', items: [{ d: 'التشخيص', q: 1, u: 20000 }, { d: 'ورش عمل', q: 4, u: 5000 }], subtotal: 40000, vat_rate: 15, vat_amount: 6000, total: 46000, valid_until: '2026-11-30', scope: 'تشخيص وبناء نظام جودة', deliverables: '- تقرير تشخيصي\n- دليل إجراءات\n3) لوحة مؤشرات', duration: '8 أسابيع', terms: 'الدفع مقدمًا', status: 'sent', sent_at: '2026-11-09T10:00:00Z', ...x });

test('consulting: catalogs + labels', () => {
  assert.equal(AREAS.length, 4); assert.deepEqual(AREAS.map(a => a.value), ['management', 'academic', 'educational', 'quality']);
  assert.ok(SECTORS.length >= 4 && BUDGETS.length >= 4 && STEPS.length === 4);
  assert.equal(Object.keys(REQ_STATUS).length, 9); assert.equal(Object.keys(QUOTE_STATUS).length, 5);
  assert.equal(reqStatusLabel('quoted', 'ar'), 'أُرسل عرض السعر'); assert.equal(reqStatusLabel('in_progress', 'en'), 'In progress'); assert.equal(reqStatusLabel('weird', 'ar'), 'weird');
  assert.equal(areaLabel('quality', 'en'), 'Quality & accreditation'); assert.equal(areaLabel(null, 'ar'), ''); assert.equal(sectorLabel('nope', 'ar'), 'nope'); assert.equal(budgetLabel(null, 'en'), '—');
});

test('consulting: timeline index', () => {
  assert.equal(TIMELINE.length, 6); assert.equal(timelineIndex('new'), 0); assert.equal(timelineIndex('in_progress'), 4); assert.equal(timelineIndex('completed'), 5); assert.equal(timelineIndex('closed'), 5);
  assert.equal(timelineIndex('declined'), -1); assert.equal(timelineIndex('cancelled'), -1);
});

test('consulting: request validation', () => {
  const ok = { ...EMPTY_FORM, full_name: 'سارة العتيبي', email: 'sara@school.sa', organization: 'مدارس النخبة', area: 'quality', title: 'بناء نظام جودة', details: 'نحتاج إلى تشخيص الوضع الحالي وبناء دليل إجراءات ومؤشرات أداء.' };
  assert.equal(validateRequest(ok, 'ar'), null);
  assert.match(validateRequest({ ...ok, full_name: 'أب' }, 'ar')!, /الاسم/); assert.match(validateRequest({ ...ok, email: 'x' }, 'en')!, /email/i);
  assert.match(validateRequest({ ...ok, organization: '' }, 'ar')!, /الجهة/); assert.match(validateRequest({ ...ok, area: 'legal' }, 'en')!, /area/);
  assert.match(validateRequest({ ...ok, title: 'قص' }, 'ar')!, /عنوان/); assert.match(validateRequest({ ...ok, details: 'قصير' }, 'ar')!, /30/);
  assert.match(validateRequest({ ...ok, phone: '12' }, 'ar')!, /الجوال/); assert.equal(validateRequest({ ...ok, phone: '' }, 'ar'), null);
});

test('consulting: quote math (VAT exclusive + inclusive) and item cleaning', () => {
  const items = cleanItems([{ d: ' التشخيص ', q: 1, u: 20000 }, { d: 'ورش', q: 4, u: 5000 }, { d: '', q: 1, u: 999 }, { d: 'صفر', q: 0, u: 100 }, { d: 'سالب', q: -2, u: -5 }]);
  assert.equal(items.length, 2); assert.equal(items[0].d, 'التشخيص');
  assert.deepEqual(quoteTotals(items, 15), { subtotal: 40000, vat: 6000, total: 46000 });
  assert.deepEqual(quoteTotals(items, 15, true), { subtotal: 34782.61, vat: 5217.39, total: 40000 });
  assert.deepEqual(quoteTotals([], 15), { subtotal: 0, vat: 0, total: 0 });
  const a = quoteTotals([{ d: 'x', q: 3, u: 333.33 }], 15); assert.equal(Math.round((a.subtotal + a.vat) * 100) / 100, a.total);
});

test('consulting: quote validation + expiry + lines', () => {
  const far = '2999-01-01';
  assert.equal(validateQuote({ items: [{ d: 'x', q: 1, u: 10 }], scope: 'نطاق عمل واضح ومفصل', valid_until: far }), null);
  assert.match(validateQuote({ items: [], scope: 'نطاق عمل واضح ومفصل' })!, /بندًا/);
  assert.match(validateQuote({ items: [{ d: 'x', q: 1, u: 10 }], scope: 'قصير' })!, /نطاق/);
  assert.match(validateQuote({ items: [{ d: 'x', q: 1, u: 10 }], scope: 'نطاق عمل واضح ومفصل', valid_until: '2020-01-01' })!, /الماضي/);
  assert.ok(isQuoteExpired(QUOTE(), '2026-12-01')); assert.ok(!isQuoteExpired(QUOTE(), '2026-11-30')); assert.ok(!isQuoteExpired(QUOTE({ status: 'accepted' }), '2027-01-01')); assert.ok(!isQuoteExpired(QUOTE({ valid_until: null }), '2027-01-01'));
  assert.deepEqual(lines(QUOTE().deliverables), ['تقرير تشخيصي', 'دليل إجراءات', 'لوحة مؤشرات']); assert.deepEqual(lines(null), []);
});

test('consulting: pipeline + Excel sheet', () => {
  const rows = [REQ(), REQ({ id: '2', status: 'reviewing' }), REQ({ id: '3', status: 'accepted' }), REQ({ id: '4', status: 'completed' }), REQ({ id: '5', status: 'cancelled' })];
  const p = pipeline(rows); assert.equal(p.total, 5); assert.equal(p.open, 3); assert.equal(p.needsAction, 2); assert.equal(p.byStatus.completed, 1);
  const sh = requestsSheet(rows.map(r => ({ ...r, quote_total: r.status === 'accepted' ? 46000 : null }))); assert.equal(sh.rows.length, 6); assert.equal(sh.rows[0].length, sh.widths.length); assert.ok(sh.rtl);
  assert.equal(sh.rows[1][1], 'مدارس النخبة'); assert.equal(sh.rows[1][8], 'جديد'); assert.equal(sh.rows[3][10], 46000);
});

test('consulting: client emails are bilingual and link to the request page', () => {
  const site = 'https://athar.example';
  const ar = requestReceivedEmail(REQ(), site); assert.match(ar.subject, /استلمنا/); assert.ok(ar.html.includes(`${site}/consulting/${REQ().id}`)); assert.ok(ar.html.includes('dir="rtl"'));
  const en = requestReceivedEmail(REQ({ lang: 'en' }), site); assert.match(en.subject, /received/); assert.ok(en.html.includes('dir="ltr"'));
  const adm = newRequestAdminEmail(REQ(), site); assert.ok(adm.html.includes(`/admin/consulting?open=${REQ().id}`)); assert.match(adm.subject, /مدارس النخبة/);
  const qs = quoteSentEmail(REQ(), QUOTE(), site); assert.ok(qs.html.includes('46,000.00')); assert.match(qs.subject, /عرض سعر/);
  const qe = quoteSentEmail(REQ({ lang: 'en' }), QUOTE(), site); assert.ok(qe.html.includes('SAR 46,000.00')); assert.ok(qe.html.includes('v1'));
  assert.match(quoteRespondedAdminEmail(REQ(), QUOTE(), true, site).subject, /قبول/); assert.match(quoteRespondedAdminEmail(REQ(), QUOTE(), false, site).subject, /اعتذار/);
  const st = statusEmail(REQ(), 'in_progress', 'نبدأ الأحد', site); assert.ok(st.html.includes('نبدأ الأحد')); assert.match(st.html, /بدأ تنفيذ/);
  const st2 = statusEmail(REQ({ lang: 'en' }), 'completed', null, site); assert.match(st2.html, /complete/i);
  const u: Update = { id: 'u1', request_id: REQ().id, created_at: '2026-11-10T09:00:00Z', author_name: 'أحمد', by_staff: true, body: 'رفعنا <التقرير> & الملاحق', visible_to_client: true };
  const ue = updateEmail(REQ(), u, site, true); assert.ok(ue.html.includes('&lt;التقرير&gt; &amp;')); assert.ok(ue.html.includes('/consulting/'));
  const ua = updateEmail(REQ(), { ...u, by_staff: false }, site, false); assert.ok(ua.html.includes('/admin/consulting?open='));
  assert.equal(QW, 1654); assert.equal(QH, 2339);
});

test('consulting: invoice emails/wording adapt when invoice has no program', () => {
  const inv: Invoice = { id: 'i1', invoice_no: 'ATH-2026-00009', created_at: '2026-11-09T12:00:00Z', enrollment_id: null, program_id: null, user_id: 'u1', customer_name: 'سارة', customer_email: 'sara@school.sa', description: 'خدمة استشارية: بناء نظام جودة', currency: 'SAR', subtotal: 40000, vat_rate: 15, vat_amount: 6000, total: 46000, status: 'unpaid', lang: 'ar' } as any;
  const e = invoiceEmail(inv, '', 'https://athar.example'); assert.ok(!e.html.includes('رسوم التسجيل')); assert.ok(e.html.includes('خدمة استشارية')); assert.ok(e.html.includes('/pay/i1'));
  const r = receiptEmail({ ...inv, status: 'paid' }, 'بناء نظام جودة', 'https://athar.example'); assert.ok(!r.html.includes('مقعدك')); assert.ok(r.html.includes('عن <b>بناء نظام جودة</b>'));
  const p = invoiceEmail({ ...inv, program_id: 'p1' }, 'دبلوم', 'https://athar.example'); assert.ok(p.html.includes('رسوم التسجيل في <b>دبلوم</b>'));
});

test('consulting: portal content now exposes consulting as live', () => {
  const s = serviceBySlug('consulting')!; assert.equal(s.status, 'live'); assert.equal(s.cta.href, '/consulting'); assert.equal((s as any).phase, undefined);
  assert.ok(NAV.some(n => n.href === '/consulting')); assert.equal(SERVICES.filter(x => x.status === 'live').length, 8);
});
