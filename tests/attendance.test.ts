import test from 'node:test';
import assert from 'node:assert/strict';
import { identityKey, lateStatus, makeToken, summarize, eligible, toMinutes } from '../lib/attendance/model';

test('identityKey prefers email, then phone, then name', () => {
  assert.equal(identityKey('أحمد علي', ' Ahmed@Example.com '), 'e:ahmed@example.com');
  assert.equal(identityKey('أحمد علي', '', '+966 50 123 4567'), 'p:501234567');
  assert.equal(identityKey('  أحمد   علي ', null, null), 'n:أحمد علي');
});

test('toMinutes / lateStatus follow start + grace rule', () => {
  assert.equal(toMinutes('09:30:00'), 570);
  assert.equal(toMinutes(null), null);
  assert.equal(lateStatus('09:40', '09:30', 15), 'present');
  assert.equal(lateStatus('09:45', '09:30', 15), 'present');
  assert.equal(lateStatus('09:46', '09:30', 15), 'late');
  assert.equal(lateStatus('12:00', null, 15), 'present');
});

test('makeToken is 8 chars without ambiguous letters', () => {
  let i = 0; const t = makeToken(() => ((i += 7) % 32) / 32);
  assert.equal(t.length, 8);
  assert.ok(!/[01IO]/.test(t));
});

test('summarize computes per-person attendance with excused not counted against', () => {
  const sessions = [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }];
  const rec = (session_id: string, full_name: string, email: string | null, status: any) => ({ session_id, full_name, email, phone: null, identity_key: identityKey(full_name, email), status });
  const records = [
    rec('s1', 'سارة', 'sara@x.sa', 'present'), rec('s2', 'سارة', 'sara@x.sa', 'late'), rec('s3', 'سارة', 'sara@x.sa', 'excused'),
    rec('s1', 'خالد', null, 'present'), rec('s2', 'خالد', null, 'absent'),
    rec('s1', 'خالد', null, 'late'), // تكرار لنفس الجلسة — يُتجاهل
    rec('s9', 'غريب', null, 'present'), // جلسة خارج النطاق — تُتجاهل
  ];
  const s = summarize(sessions, records);
  assert.equal(s.length, 2);
  const sara = s.find(p => p.name === 'سارة')!; const khalid = s.find(p => p.name === 'خالد')!;
  assert.deepEqual([sara.present, sara.late, sara.excused, sara.absent, sara.attended, sara.effective, sara.pct], [1, 1, 1, 1, 2, 3, 67]);
  assert.deepEqual([khalid.present, khalid.late, khalid.excused, khalid.absent, khalid.pct], [1, 0, 0, 3, 25]);
  assert.equal(s[0].name, 'سارة'); // الأعلى نسبة أولًا
  assert.deepEqual(eligible(s, 60).map(p => p.name), ['سارة']);
  assert.deepEqual(eligible(s, 0).map(p => p.name), ['سارة', 'خالد']);
});
