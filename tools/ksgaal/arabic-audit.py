# -*- coding: utf-8 -*-
"""أَثَر — فحص آلي لمؤشرات «معايير دعم اللغة العربية في التطبيقات الحاسوبية» (مجمع الملك سلمان، 1447هـ)
يقيس ما يمكن قياسه آليًا من المؤشرات ويطبع نسبًا: UTF-8 · RTL/lang · أسماء ملفات لاتينية · نصوص عربية تحوي لاتينية خارج الأقواس ·
اختصارات عربية · أرقام قبل الأسماء بدل المثنى/الجمع · التقويم الهجري والمنطقة الزمنية · الخطوط · الدعم بالعربية.
الاستعمال: python3 tools/ksgaal/arabic-audit.py [--list]"""
import os, re, sys, json
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LIST = '--list' in sys.argv
AR = r'[\u0621-\u064A]'
files = []
for d in ('app', 'lib'):
    for base, dirs, fs in os.walk(os.path.join(ROOT, d)):
        dirs[:] = [x for x in dirs if x not in ('node_modules', '.next')]
        for f in fs:
            if f.endswith(('.ts', '.tsx', '.css')): files.append(os.path.join(base, f))
rep = {}
# 1) UTF-8
bad_utf = []
for f in files:
    try: open(f, encoding='utf-8').read()
    except UnicodeDecodeError: bad_utf.append(f)
rep['utf8_ok_pct'] = round(100 * (1 - len(bad_utf) / max(1, len(files))), 1)
# 2) أسماء ملفات لاتينية
non_latin = [f for f in files if re.search(r'[^\x00-\x7F]', os.path.relpath(f, ROOT))]
rep['latin_filenames_pct'] = round(100 * (1 - len(non_latin) / max(1, len(files))), 1)
# 3) نصوص عربية فيها حروف لاتينية خارج الأقواس (داخل سلاسل نصية بين علامتي اقتباس)
mixed = []; ar_strings = 0
str_re = re.compile(r"""(['"`])((?:(?!\1).){6,200})\1""")
for f in files:
    s = open(f, encoding='utf-8', errors='ignore').read()
    for m in str_re.finditer(s):
        txt = m.group(2)
        if not re.search(AR, txt): continue
        ar_strings += 1
        t2 = re.sub(r'\([^)]*\)|«[^»]*»|\{[^}]*\}|\$\{[^}]*\}|<[^>]*>|https?://\S+|[\w.-]+@[\w.-]+|/[\w/-]+', '', txt)
        if re.search(r'[A-Za-z]{2,}', t2) and not re.search(r'\b(CEFR|QR|PDF|ID|API|SMS|OTP|URL|AI|CV|Zoom|Teams|Excel|Word|Hijri|AH|A1|A2|B1|B2|C1|C2|ATH)\b', t2):
            mixed.append((os.path.relpath(f, ROOT), txt[:90]))
rep['arabic_strings'] = ar_strings; rep['mixed_latin_outside_parens'] = len(mixed)
rep['mixed_free_pct'] = round(100 * (1 - len(mixed) / max(1, ar_strings)), 1)
# 4) اختصارات عربية (م ع س · ص.ب … )
abbr = []
for f in files:
    s = open(f, encoding='utf-8', errors='ignore').read()
    for m in re.finditer(r'(?<![\u0621-\u064A])(م ع س|م\.ع\.س|ص\.ب|د\.ت|إلخ\.)(?![\u0621-\u064A])', s): abbr.append((os.path.relpath(f, ROOT), m.group(0)))
rep['abbreviations'] = len(abbr)
# 5) رقم قبل اسم بدل المثنى (2 ملف / 2 ساعة) — مؤشر السلامة الصرفية
dual = []
for f in files:
    s = open(f, encoding='utf-8', errors='ignore').read()
    for m in re.finditer(r'(?<![\d.])2 (ملف|ساعة|جلسة|برنامج|شعبة|طالب|مشارك|يوم|أسبوع|شهر|سنة|مرة|نقطة|سؤال)(?![\u0621-\u064A])', s): dual.append((os.path.relpath(f, ROOT), m.group(0)))
rep['dual_as_digit'] = len(dual)
# 6) التوطين: هجري · منطقة زمنية · 24/12 ساعة · العملة
allsrc = '\n'.join(open(f, encoding='utf-8', errors='ignore').read() for f in files)
rep['hijri_calendar'] = bool(re.search(r'islamic-umalqura|umalqura|هجري', allsrc))
rep['timezone_riyadh'] = bool(re.search(r'Asia/Riyadh', allsrc))
rep['currency_sar'] = bool(re.search(r'SAR|ر\.س|ريال', allsrc))
rep['lang_dir_rtl'] = bool(re.search(r'lang="ar"\s+dir="rtl"', open(os.path.join(ROOT, 'app/layout.tsx'), encoding='utf-8').read()))
rep['arabic_fonts'] = re.findall(r'(IBM_Plex_Sans_Arabic|Noto_Naskh_Arabic)', open(os.path.join(ROOT, 'app/layout.tsx'), encoding='utf-8').read())
rep['arabic_support_pages'] = [p for p in ('app/help/page.tsx', 'app/contact/page.tsx', 'app/accessibility/page.tsx') if os.path.exists(os.path.join(ROOT, p))]
# 7) نص كصورة: صور تحمل نصًا عربيًا في public/logos أو brand (تقريبي: ملفات png/jpg تحوي "text" في اسمها)
print(json.dumps(rep, ensure_ascii=False, indent=1))
if LIST:
    print('\n--- نصوص عربية تحوي لاتينية خارج الأقواس (عيّنة 40):'); [print(' ', f, '|', t) for f, t in mixed[:40]]
    print('\n--- اختصارات:'); [print(' ', f, '|', t) for f, t in abbr[:20]]
    print('\n--- مثنى بالأرقام:'); [print(' ', f, '|', t) for f, t in dual[:20]]
