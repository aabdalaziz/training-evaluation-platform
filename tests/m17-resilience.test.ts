/* م17-أ — درع الصمود: كشف خطأ تحميل الحزم (بعد نشر جديد) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isChunkError } from '../lib/ui/chunk';

test('م17-أ: isChunkError يلتقط أشكال ChunkLoadError كلّها ولا يلتقط أخطاء المنطق', () => {
  assert.ok(isChunkError({ name: 'ChunkLoadError', message: 'Loading chunk 123 failed.' }));
  assert.ok(isChunkError({ name: 'Error', message: 'Loading chunk 8731 failed. (timeout: https://athar-portal.com/_next/static/chunks/8731-abc.js)' }));
  assert.ok(isChunkError({ name: 'TypeError', message: 'Failed to fetch dynamically imported module: https://x/_next/static/chunks/app/page-abc.js' }));
  assert.ok(isChunkError({ name: 'Error', message: 'Loading CSS chunk 42 failed' }));
  assert.ok(isChunkError({ name: 'TypeError', message: 'Importing a module script failed.' }));
  assert.ok(!isChunkError({ name: 'TypeError', message: "Cannot read properties of undefined (reading 'map')" }));
  assert.ok(!isChunkError({ name: 'Error', message: 'session_not_active' }));
  assert.ok(!isChunkError(null)); assert.ok(!isChunkError(undefined));
});
