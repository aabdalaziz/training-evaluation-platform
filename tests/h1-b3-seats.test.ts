// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
/** هـ-1/3 — مقاعد اقْرَأْ: آلة الحالات، الأيّام المتبقّية، حساب الضريبة، الوفر، النصوص من المعجم المعتمد. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { seatState, daysLeft, currentSeat, lastSeat, planTotals, savingsPct, PAID, TRIAL, SEAT_COPY, SEAT_FREE_ROLES, type Seat, type Plan } from '../lib/portal/entitlements';

const NOW = Date.parse('2026-11-23T10:00:00Z');
const seat = (o: Partial<Seat>): Seat => ({ id: 'x', service: 'iqra', learner_email: 'a@b.c', plan_code: 'month', source: 'invoice', starts_at: '2026-11-01T00:00:00Z', ends_at: '2026-12-01T00:00:00Z', ...o });

test('آلة الحالات: guest → noLevel → pendingLevel → noSeat → paying → active → expired', () => {
  assert.equal(seatState({ signedIn: false, level: null, seats: [], now: NOW }), 'guest');
  assert.equal(seatState({ signedIn: true, level: null, seats: [], now: NOW }), 'noLevel');
  assert.equal(seatState({ signedIn: true, level: 'pending', seats: [], now: NOW }), 'pendingLevel');
  assert.equal(seatState({ signedIn: true, level: 'A2', seats: [], now: NOW }), 'noSeat');
  assert.equal(seatState({ signedIn: true, level: 'A2', seats: [], pendingInvoice: true, now: NOW }), 'paying');
  assert.equal(seatState({ signedIn: true, level: 'A2', seats: [seat({})], now: NOW }), 'active');
  assert.equal(seatState({ signedIn: true, level: 'A2', seats: [seat({ ends_at: '2026-11-20T00:00:00Z' })], now: NOW }), 'expired');
  // مقعد سارٍ يغلب الفاتورة المعلّقة
  assert.equal(seatState({ signedIn: true, level: 'A2', seats: [seat({})], pendingInvoice: true, now: NOW }), 'active');
  // مقعد مستقبلي (تمديد بعد النهاية) لا يُحسب ساريًا الآن
  assert.equal(seatState({ signedIn: true, level: 'A2', seats: [seat({ starts_at: '2026-12-01T00:00:00Z', ends_at: '2027-01-01T00:00:00Z' })], now: NOW }), 'expired');
});

test('الأيّام المتبقّية تُقرَّب لأعلى ولا تقلّ عن صفر', () => {
  assert.equal(daysLeft('2026-11-23T11:00:00Z', NOW), 1);
  assert.equal(daysLeft('2026-11-30T10:00:00Z', NOW), 7);
  assert.equal(daysLeft('2026-11-20T00:00:00Z', NOW), 0);
  assert.equal(daysLeft(null, NOW), 0); assert.equal(daysLeft('garbage', NOW), 0);
});

test('المقعد الحالي = الأطول نهايةً بين السارية؛ الأخير = الأحدث نهايةً', () => {
  const a = seat({ id: 'a', ends_at: '2026-11-25T00:00:00Z' }); const b = seat({ id: 'b', ends_at: '2026-12-25T00:00:00Z' }); const c = seat({ id: 'c', ends_at: '2026-11-01T00:00:00Z' });
  assert.equal(currentSeat([a, b, c], NOW)?.id, 'b'); assert.equal(currentSeat([c], NOW), null); assert.equal(lastSeat([a, c])?.id, 'a');
});

test('حساب الضريبة يطابق portal_issue_invoice (شاملة وغير شاملة)', () => {
  assert.deepEqual(planTotals(99, 15, false), { subtotal: 99, vat: 14.85, total: 113.85 });
  const inc = planTotals(99, 15, true); assert.equal(inc.total, 99); assert.equal(inc.subtotal, 86.09); assert.equal(Math.round((inc.subtotal + inc.vat) * 100) / 100, 99);
  assert.deepEqual(planTotals(799, 0, false), { subtotal: 799, vat: 0, total: 799 });
});

test('الوفر نسبةً إلى خطّة الشهر؛ التجربة والمدفوعة تُفرزان', () => {
  const plans: Plan[] = [
    { service: 'iqra', code: 'year', name_ar: 'سنة', blurb_ar: '', days: 365, price: 799, sort: 3, active: true },
    { service: 'iqra', code: 'trial', name_ar: 'تجربة', blurb_ar: '', days: 7, price: 0, sort: 0, active: true },
    { service: 'iqra', code: 'month', name_ar: 'شهر', blurb_ar: '', days: 30, price: 99, sort: 1, active: true },
    { service: 'iqra', code: 'quarter', name_ar: 'ثلاثة أشهر', blurb_ar: '', days: 90, price: 249, sort: 2, active: true },
    { service: 'iqra', code: 'old', name_ar: 'قديمة', blurb_ar: '', days: 30, price: 50, sort: 9, active: false },
  ];
  const paid = PAID(plans); assert.deepEqual(paid.map((p) => p.code), ['month', 'quarter', 'year']);
  assert.equal(TRIAL(plans)?.days, 7);
  assert.equal(savingsPct(paid[1], paid[0]), 16); assert.equal(savingsPct(paid[2], paid[0]), 34); assert.equal(savingsPct(paid[0], paid[0]), 0); assert.equal(savingsPct(paid[0], null), 0);
});

test('النصوص من المعجم: «قيّم نفسك» لا «قِس»، «الخبير المُصدِّق»، ولا «القياس»', () => {
  const all = Object.values(SEAT_COPY).map((c) => `${c.title} ${c.body} ${c.cta || ''}`).join(' ');
  assert.ok(all.includes('قيّم نفسك — 3 دقائق')); assert.ok(all.includes('الخبير المُصدِّق'));
  assert.ok(!/قِس|القياس/.test(all));
  assert.equal(SEAT_COPY.noLevel.href, '/miaar'); assert.equal(SEAT_COPY.active.href, '/iqra');
  assert.ok(SEAT_FREE_ROLES.includes('ITEM_AUTHOR') && SEAT_FREE_ROLES.includes('PLATFORM_ADMIN'));
});

test('الهجرة: الجداول والدوالّ والمحفّز وسياسات RLS والخطط الأربع', () => {
  const sql = fs.readFileSync(new URL('../supabase/migrations/20270217_portal_h1_b3_service_seats.sql', import.meta.url), 'utf8');
  for (const k of ['create table if not exists public.service_plans', 'create table if not exists public.service_entitlements', 'portal_issue_service_invoice(p_service text, p_plan text)', 'portal_start_trial(p_service text)', 'portal_grant_seat(', 'trg_service_invoice_paid', 'create trigger portal_invoices_service_seat', 'add column if not exists service', 'add column if not exists plan_code', 'enable row level security', "('iqra', 'trial'", "('iqra', 'month'", "('iqra', 'quarter'", "('iqra', 'year'"]) assert.ok(sql.includes(k), k);
  assert.ok(sql.includes("where source = 'trial'"), 'تجربة واحدة لكل بريد (فهرس فريد)');
  assert.ok(sql.includes('revoke all on function public.portal_grant_seat'), 'لا تنفيذ عامًّا لمنح المقاعد');
  assert.ok((sql.match(/security definer/g) || []).length >= 4);
});

test('API اقْرَأْ: بوّابة المقعد بعد بوّابة المستوى في GET وPOST، والطاقم معفًى، ومفتاح إيقاف', () => {
  const src = fs.readFileSync(new URL('../app/api/iqra/route.ts', import.meta.url), 'utf8');
  assert.equal((src.match(/const sg = await seatGate\(c\.db, c\.email, c\.role\); if \(sg\) return sg;/g) || []).length, 2);
  assert.ok(src.indexOf('gate(c.db, c.email, c.userId)') < src.indexOf('seatGate(c.db, c.email, c.role)'));
  assert.ok(src.includes("process.env.IQRA_SEATS === 'off'") && src.includes('SEAT_FREE_ROLES.includes(role)') && src.includes("href: '/iqra/start'"));
  const start = fs.readFileSync(new URL('../app/iqra/start/IqraStart.tsx', import.meta.url), 'utf8');
  for (const t of ['iqs-trial-btn', 'iqs-buy-', 'iqs-enter', 'iqs-pay', 'iqs-miaar', '<Flip', 'data-level']) assert.ok(start.includes(t), t);
  const doors = fs.readFileSync(new URL('../app/components/HomeDoors.tsx', import.meta.url), 'utf8'); assert.ok(doors.includes("id: 'iqra', href: '/iqra/start'"));
});
