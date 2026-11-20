#!/usr/bin/env python3
"""يطبع جدولي §6 (أطوال الأشرطة) و§7 (توجيه الأصوات) لوثيقة إصدار C2 (ج١ افتراضًا؛ مرّر أرقام المنازل لدفعة أخرى) من ملفّات cues الموجودة."""
import json, os, glob, collections, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
AUD = os.path.join(ROOT, 'public', 'iqra', 'audio')
V = json.load(open(os.path.join(ROOT, 'tools', 'iqra', 'voices.json'), encoding='utf-8'))
UNITS = tuple(int(x) for x in sys.argv[1:]) or (1, 2)  # مثال: _c2j1_release_tables.py 3 4 → ج٢
codes = [f'C2-U0{u}-{c}' for u in UNITS for c in ('L01', 'L02', 'L03', 'L04', 'L05', 'R01', 'R02', 'A01')]
def ar(n): return str(n).translate(str.maketrans('0123456789', '٠١٢٣٤٥٦٧٨٩'))
print('6) أطوال الأشرطة (ثوانٍ):'); tot_s = tot_kb = tot_c = 0
for c in codes:
    f = os.path.join(AUD, c + '.cues.json'); m = os.path.join(AUD, c + '.mp3')
    if not os.path.exists(f): print(f'   {c}: — (لم يُبنَ بعد)'); continue
    cues = json.load(open(f, encoding='utf-8')); cues = cues['cues'] if isinstance(cues, dict) else cues
    dur = round(max(x['e'] for x in cues)); kb = os.path.getsize(m) // 1024 if os.path.exists(m) else 0
    tot_s += dur; tot_kb += kb; tot_c += len(cues)
    print(f'   {c}: {len(cues)} مقطعًا · {dur} ث · {kb} ك.ب')
print(f'   المجموع: {tot_c} مقطعًا · {tot_s} ث ≈ {tot_s // 60} د · {tot_kb // 1024} م.ب')
print(); print('7) توجيه الأصوات (عدد المقاطع لكلّ دور في ملفّات cues):')
for c in codes:
    f = os.path.join(AUD, c + '.cues.json')
    if not os.path.exists(f): continue
    cues = json.load(open(f, encoding='utf-8')); cues = cues['cues'] if isinstance(cues, dict) else cues
    cnt = collections.Counter()
    for x in cues:
        r = x.get('r'); g = x.get('g')
        if r: cnt[f'{r}/{g}'] += 1
        elif g: cnt[f'الراوي/{g}'] += 1
        else: cnt['الراوي'] += 1
    print(f'   {c}: ' + ' · '.join(f'{k} {v}' for k, v in cnt.most_common()))
