import test from 'node:test';
import assert from 'node:assert/strict';
import { countBySeverity, kindIcon, kindLabel, openOnes, scanEmailHtml, timeAgo, unreadCount, type Notification } from '../lib/notifications/model';

const n = (id: string, severity: Notification['severity'], created_at: string, read = false, resolved = false): Notification =>
  ({ id, kind: 'followup_missing', severity, title: 't' + id, body: null, href: '/admin/followup', created_at, read_at: read ? created_at : null, resolved_at: resolved ? created_at : null });

test('openOnes sorts critical first then newest, excluding resolved', () => {
  const list = [n('a', 'info', '2026-10-20T00:00:00Z'), n('b', 'critical', '2026-10-10T00:00:00Z'), n('c', 'warn', '2026-10-22T00:00:00Z'), n('d', 'critical', '2026-10-21T00:00:00Z', false, true), n('e', 'info', '2026-10-23T00:00:00Z')];
  assert.deepEqual(openOnes(list).map(x => x.id), ['b', 'c', 'e', 'a']);
});

test('unreadCount and countBySeverity ignore resolved', () => {
  const list = [n('a', 'info', '2026-10-20T00:00:00Z'), n('b', 'critical', '2026-10-10T00:00:00Z', true), n('c', 'warn', '2026-10-22T00:00:00Z', false, true)];
  assert.equal(unreadCount(list), 1);
  assert.deepEqual(countBySeverity(list), { info: 1, warn: 0, critical: 1 });
});

test('timeAgo buckets', () => {
  const now = new Date('2026-10-23T12:00:00Z');
  assert.equal(timeAgo('2026-10-23T11:59:40Z', now), 'الآن');
  assert.equal(timeAgo('2026-10-23T11:30:00Z', now), 'قبل 30 دقيقة');
  assert.equal(timeAgo('2026-10-23T09:00:00Z', now), 'قبل 3 ساعة');
  assert.equal(timeAgo('2026-10-20T12:00:00Z', now), 'قبل 3 يومًا');
  assert.equal(timeAgo('2026-08-01T12:00:00Z', now), '2026-08-01');
});

test('kind labels/icons have fallbacks', () => {
  assert.equal(kindLabel('low_transfer'), 'نقل الأثر');
  assert.equal(kindIcon('session_unclosed'), 'check');
  assert.equal(kindLabel('something_else'), 'عام');
  assert.equal(kindIcon('something_else'), 'bell');
});

test('scanEmailHtml escapes and links', () => {
  const { subject, html } = scanEmailHtml('https://x.sa', [{ id: '1', kind: 'low_transfer', severity: 'critical', title: 'نقل <ضعيف>', href: '/reports/transfer?followup=1' }, { id: '2', kind: 'session_unclosed', severity: 'info', title: 'جلسة', href: null }], '2026-10-23T03:00:00Z');
  assert.equal(subject, 'منصة التقويم: 2 إشعار جديد (1 حرج)');
  assert.ok(html.includes('نقل &lt;ضعيف&gt;'));
  assert.ok(html.includes('https://x.sa/reports/transfer?followup=1'));
  assert.ok(html.includes('https://x.sa/admin/notifications'));
});
