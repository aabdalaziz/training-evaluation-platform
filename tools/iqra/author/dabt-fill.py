#!/usr/bin/env python3
"""dabt-fill.py <pack.json> <CODE> <vocalized.txt>
يقرأ المقاطع الخام الناقصة (كما يطبعها iqra-tts.py --plan) لحلقة/نصّ واحد، ويقرنها سطرًا بسطر
بالضبط الكامل الذي كتبه المؤلّف في الملف النصّي، ويتحقّق:
  - العدد متطابق
  - نزع الحركات من المضبوط = الخام (إلّا سطور المشاهد التي تبدأ برقم عربي)
  - لا حرف بلا حركة (dabt_lint)
ثمّ يكتب tools/iqra/dabt/<CODE>.json (يدمج مع الموجود)."""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..'))
sys.argv, keep = [sys.argv[0]], sys.argv[1:]
import importlib.util
spec = importlib.util.spec_from_file_location('tts', os.path.join(HERE, '..', '..', 'iqra-tts.py'))
tts = importlib.util.module_from_spec(spec); spec.loader.exec_module(tts)
pack, code, voc = keep
d = json.load(open(pack, encoding='utf-8'))
S = None
for l in d.get('lessons', []):
    if l['code'] == code: S = tts.segments_lesson(l)
for t in d.get('library', []):
    if t['code'] == code: S = tts.segments_library(t)
assert S is not None, code
raws = []
for key, text, w in S:
    for x in ([a for a, _ in text] if isinstance(text, list) else [text]):
        r = tts.speakable_raw(x)
        if r and r not in raws: raws.append(r)
force = os.path.exists(os.path.join(HERE, '..', 'dabt', code + '.json'))
miss = raws if force else [r for r in raws if tts.dabt_of(r) is None]
lines = [x.strip() for x in open(voc, encoding='utf-8').read().split('\n') if x.strip() and not x.startswith('#')]
if len(lines) != len(miss):
    print(f'عدد الأسطر {len(lines)} ≠ المقاطع الناقصة {len(miss)}')
    for i, r in enumerate(miss): print(i + 1, '|', r[:70], '|', (lines[i][:40] if i < len(lines) else '—'))
    sys.exit(1)
bad = 0
norm = lambda s: re.sub(r'\s+', ' ', s.replace('ـ', '')).strip()
for r, v in zip(miss, lines):
    sv = tts.strip_harakat(v)
    if not re.search('[٠-٩0-9]', r) and norm(sv) != norm(tts.strip_harakat(r)):  # الأرقام تُكتب كلماتٍ في الضبط
        bad += 1; print('≠ الخام  :', r); print('  المضبوط:', sv)
    b = tts.dabt_lint(v)
    if b: bad += 1; print('⚠ حروف بلا حركة', ''.join(b), '←', v[:60])
if bad: sys.exit(1)
out = os.path.join(HERE, '..', 'dabt', code + '.json')
cur = json.load(open(out, encoding='utf-8')) if os.path.exists(out) else {}
cur.update({tts.strip_harakat(r): v for r, v in zip(miss, lines)})
json.dump(cur, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok', code, len(lines), 'segments →', os.path.relpath(out))
