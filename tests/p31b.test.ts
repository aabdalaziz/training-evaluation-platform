// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P31-ب — «ابدأ من سيرتك الذاتية» + الصورة من الجهاز/الكاميرا:
//   قارئ .docx بلا حزم (ZIP مخزَّن ومضغوط) · تحويل XML إلى نص · المطالبة تحمل القوائم المغلقة · تنقية ناتج النموذج (معرّفات صحيحة فقط · حدود)
//   · البديل المحلي بالقواعد (اسم · ملخص · تعليم · شهادات · مهارات بالتطابق) · حدّ الاستخدام cv_extract مسجَّل · المرفقات تُمرَّر للمزوّد
import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { docxText, xmlToText, cvToText, buildCvPrompt, parseCvExtract, localCvExtract, filledKeys, CV_TYPES, CV_MAX_BYTES, CV_FIELDS } from '../lib/directory/cv';
import { AI_LIMITS, AI_PURPOSE_LABEL } from '../lib/ai/prompts';
import { SUMMARY_MAX, ACHIEVEMENTS_MAX, SKILLS_MAX } from '../lib/directory/registry';

const META = { skills: [{ id: 's1', name_ar: 'تصميم التعلم' }, { id: 's2', name_ar: 'قيادة الفرق' }, { id: 's3', name_ar: 'التحكيم المؤسسي' }], sectors: [{ code: 'education', name_ar: 'التعليم' }, { code: 'health', name_ar: 'الصحة' }] };

/** كاتب ZIP صغير للاختبار: method 0 (مخزَّن) أو 8 (deflate) */
function zip(entries: { name: string; data: Buffer; deflate?: boolean }[]): Buffer {
  const locals: Buffer[] = []; const centrals: Buffer[] = []; let off = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8'); const comp = e.deflate ? deflateRawSync(e.data) : e.data; const method = e.deflate ? 8 : 0;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(method, 8); lh.writeUInt32LE(0, 10); lh.writeUInt32LE(0, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(e.data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(method, 10); ch.writeUInt32LE(0, 12); ch.writeUInt32LE(0, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(e.data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(off, 42);
    locals.push(lh, name, comp); centrals.push(ch, name); off += lh.length + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals); const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, cd, eocd]);
}
const DOC_XML = '<?xml version="1.0"?><w:document xmlns:w="x"><w:body><w:p><w:r><w:t>د. نورة سعد الشهري</w:t></w:r></w:p><w:p><w:r><w:t>Noura Alshehri</w:t></w:r></w:p><w:p><w:r><w:t>ماجستير تصميم تعليمي</w:t><w:tab/><w:t>جامعة أَثَر 2018</w:t></w:r></w:p><w:p><w:r><w:t>R&amp;D &lt;lead&gt; &#1575;</w:t></w:r></w:p></w:body></w:document>';
const docx = (deflate: boolean) => zip([{ name: '[Content_Types].xml', data: Buffer.from('<Types/>'), deflate }, { name: 'word/document.xml', data: Buffer.from(DOC_XML, 'utf8'), deflate }, { name: 'word/styles.xml', data: Buffer.from('<w:styles/>'), deflate }]);

test('P31-ب: docxText يقرأ word/document.xml مخزَّنًا ومضغوطًا ويحوّله نصًّا بفقرات وكيانات مفكوكة', () => {
  for (const d of [false, true]) {
    const t = docxText(docx(d));
    assert.ok(t.includes('د. نورة سعد الشهري'), `name (deflate=${d})`);
    assert.ok(t.includes('ماجستير تصميم تعليمي\tجامعة أَثَر 2018'), `tab (deflate=${d})`);
    assert.ok(t.includes('R&D <lead> ا'), `entities (deflate=${d})`);
    assert.equal(t.split('\n').filter(Boolean).length, 4, `paragraphs (deflate=${d})`);
  }
  assert.equal(docxText(Buffer.from('not a zip at all, really not')), '', 'garbage → empty');
  assert.equal(docxText(zip([{ name: 'word/styles.xml', data: Buffer.from('<w:styles/>') }])), '', 'no document.xml → empty');
  assert.equal(xmlToText('<w:p><w:r><w:t>أ</w:t><w:br/><w:t>ب</w:t></w:r></w:p>'), 'أ\nب', 'br → newline');
});

test('P31-ب: cvToText — نص وdocx محليًا؛ PDF والصورة null (تُرفق للنموذج)', () => {
  assert.equal(cvToText('text', Buffer.from('a\r\nb\rc')), 'a\nb\nc');
  assert.ok((cvToText('docx', docx(true)) || '').includes('Noura Alshehri'));
  assert.equal(cvToText('docx', Buffer.from('zzz')), null, 'docx تالف → null');
  assert.equal(cvToText('pdf', Buffer.from('%PDF-1.4')), null); assert.equal(cvToText('image', Buffer.alloc(10)), null);
  assert.equal(CV_TYPES['application/pdf'], 'pdf'); assert.equal(CV_TYPES['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], 'docx'); assert.equal(CV_MAX_BYTES, 3 * 1024 * 1024);
});

test('P31-ب: المطالبة تحمل القوائم المغلقة بمعرّفاتها وتمنع الاختراع وتستبعد البريد/الهاتف/الأجر', () => {
  const p = buildCvPrompt(META, 'نص السيرة هنا', { has_attachment: false, file_kind: 'text' });
  assert.ok(p.user.includes('"id":"s1"') && p.user.includes('تصميم التعلم'), 'skills list');
  assert.ok(p.user.includes('"code":"education"'), 'sectors list'); assert.ok(p.user.includes('"code":"consulting"'), 'services list'); assert.ok(p.user.includes('"code":"onsite"'), 'modes'); assert.ok(p.user.includes('"code":"ar"'), 'languages');
  assert.ok(p.user.includes('نص السيرة هنا'), 'text embedded'); assert.ok(!p.user.includes('مرفقة كملف'), 'no attachment hint');
  assert.ok(p.system.includes('لا تخترع') && p.system.includes('لا تُخرج بريدًا ولا هاتفًا ولا أجرًا'), 'rules');
  const q = buildCvPrompt(META, null, { has_attachment: true, file_kind: 'pdf' }); assert.ok(q.user.includes('مرفقة كملف (pdf)') && !q.user.includes('نص السيرة'), 'attachment hint only');
});

test('P31-ب: parseCvExtract — معرّفات صحيحة فقط · حدود الطول والعدد · ملاحظات ≤ 4 · null إن لم يُستخرج شيء', () => {
  const raw = JSON.stringify({ name_ar: 'د. نورة', name_en: 'Noura', title_ar: 'مستشارة تطوير', city: 'المدينة المنورة', languages: ['ar', 'en', 'xx'], summary_ar: 'س'.repeat(SUMMARY_MAX + 500), achievements: Array.from({ length: 14 }, (_, i) => `إنجاز ${i} ` + 'ط'.repeat(300)), education: [{ degree: 'ماجستير', field: 'تصميم تعليمي', institution: 'جامعة أَثَر', year: '2018' }], experience: [{ role: 'مديرة', organization: 'جامعة أَثَر', from: '2019', to: 'الآن', line: 'قادت' }], certifications: [{ name: 'مدرب معتمد', issuer: 'ATD', year: '2020' }], publications: [{ title: 'ورقة', type: 'بحث', year: '2021', url: 'javascript:alert(1)' }], skill_ids: ['s1', 'bogus', 's3', 's2', 'zzz'], sectors: ['education', 'finance'], services: ['training', 'nonsense', 'consulting'], modes: ['remote', 'teleport'], coverage: ['المدينة المنورة', 'جدة'], notes_ar: ['أ', 'ب', 'ج', 'د', 'هـ'], email: 'x@y.z' });
  const r = parseCvExtract(raw, META); assert.ok(r, 'parsed');
  const f = r!.fields;
  assert.equal(f.name_ar, 'د. نورة'); assert.deepEqual(f.languages, ['ar', 'en']); assert.equal(f.summary_ar!.length, SUMMARY_MAX);
  assert.equal(f.achievements!.length, ACHIEVEMENTS_MAX); assert.ok(f.achievements![0].length <= 240);
  assert.deepEqual(f.skill_ids, ['s1', 's3', 's2']); assert.ok(f.skill_ids!.length <= SKILLS_MAX); assert.deepEqual(f.sectors, ['education']); assert.deepEqual(f.services, ['training', 'consulting']); assert.deepEqual(f.modes, ['remote']);
  assert.equal(f.publications![0].url, undefined, 'unsafe url dropped'); assert.equal((f as any).email, undefined, 'email never passes');
  assert.equal(r!.notes_ar.length, 4);
  assert.equal(parseCvExtract('{"name_ar":"","skill_ids":["bogus"]}', META), null, 'nothing usable → null (fallback)'); assert.equal(parseCvExtract('not json', META), null);
  assert.deepEqual(filledKeys({ name_ar: 'x', achievements: [], city: '  ' }), ['name_ar']);
  assert.equal(CV_FIELDS.length, 17);
});

test('P31-ب: البديل المحلي بالقواعد — اسم عربي/إنجليزي · ملخص · تعليم · شهادات · مهارات وقطاعات بالتطابق · لغات · ملاحظة صريحة', () => {
  const text = ['د. نورة سعد الشهري', 'Noura Saad Alshehri', 'noura@athar.university · 0555555555', '', 'مستشارة في تصميم التعلم وقيادة الفرق في قطاع التعليم، عملت أكثر من اثنتي عشرة سنة على تصميم برامج تطوير مهني للمعلمين والقيادات التربوية، وأشرفت على تقييم أثر التدريب في عدة جهات حكومية وخاصة داخل المملكة.', '', 'التعليم', 'ماجستير تصميم تعليمي – جامعة أَثَر 2018', 'بكالوريوس تربية – جامعة طيبة 2010', '', 'الشهادات', 'مدرب معتمد من ATD 2020', 'Certified Professional in Learning (2021)', '', 'اللغات: العربية والإنجليزية (English)'].join('\n');
  const r = localCvExtract(text, META); const f = r.fields;
  assert.equal(f.name_ar, 'د. نورة سعد الشهري'); assert.equal(f.name_en, 'Noura Saad Alshehri');
  assert.ok(f.summary_ar && f.summary_ar.startsWith('مستشارة في تصميم التعلم'), 'summary paragraph');
  assert.equal(f.education!.length, 2); assert.equal(f.education![0].degree, 'ماجستير'); assert.equal(f.education![0].year, '2018'); assert.ok(f.education![0].institution.includes('جامعة أَثَر'));
  assert.equal(f.certifications!.length, 2); assert.equal(f.certifications![0].year, '2020');
  assert.deepEqual(f.skill_ids, ['s1', 's2']); assert.deepEqual(f.sectors, ['education']); assert.deepEqual(f.languages, ['ar', 'en']);
  assert.ok(r.notes_ar[0].includes('غير مفعّل'), 'honest note');
  assert.ok(!JSON.stringify(f).includes('noura@') && !JSON.stringify(f).includes('0555'), 'no email/phone');
  const e = localCvExtract(null, META); assert.deepEqual(e.fields, {}); assert.ok(e.notes_ar[0].includes('تعذّرت'), 'null text → explicit note');
});

test('P31-ب: حوكمة الذكاء الاصطناعي — غرض cv_extract له حدّ يومي وتسمية', () => {
  assert.equal(AI_LIMITS.cv_extract, 8); assert.ok(AI_PURPOSE_LABEL.cv_extract.ar.includes('هيئة أَثَر'));
});

test('P31-ب: runAi يمرّر المرفقات إلى المزوّد (Gemini inlineData) ولا يحتسبها في input_chars', async () => {
  const calls: any[] = []; const realFetch = globalThis.fetch; process.env.GEMINI_API_KEY = 'AIzaTest'; process.env.AI_PROVIDER = 'gemini';
  (globalThis as any).fetch = async (url: string, init?: any) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    if (/\/models\?/.test(String(url))) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] }), { status: 200 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"name_ar":"د. نورة","notes_ar":[]}' }] } }] }), { status: 200 });
  };
  try {
    const { runAi } = await import('../lib/ai/athar');
    const r = await runAi({ system: 'S', user: 'U', attachments: [{ mime: 'application/pdf', data_b64: 'QUJD', name: 'cv.pdf' }], budgetMs: 40000, fast: false, parse: raw => parseCvExtract(raw, META), local: () => localCvExtract(null, META) });
    assert.equal(r.source, 'ai'); assert.equal(r.data.fields.name_ar, 'د. نورة'); assert.equal(r.input_chars, 2);
    const gen = calls.find(c => /generateContent/.test(c.url)); assert.ok(gen, 'generateContent called');
    const parts = gen.body.contents[0].parts; assert.equal(parts.length, 2); assert.equal(parts[0].text, 'U'); assert.deepEqual(parts[1].inlineData, { mimeType: 'application/pdf', data: 'QUJD' });
    assert.ok(!gen.body.generationConfig.thinkingConfig, 'fast=false → no thinkingBudget');
  } finally { (globalThis as any).fetch = realFetch; delete process.env.GEMINI_API_KEY; delete process.env.AI_PROVIDER; }
});
