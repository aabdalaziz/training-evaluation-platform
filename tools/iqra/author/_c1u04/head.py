# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# «اقْرَأْ — من أَثَر» C1-U04 «المصطلح الأكاديمي والمهني» — مولّد الحزمة (المحتوى مؤلَّف يدويًّا هنا)
# المرجع الحاكم: CEFR Companion Volume 2020 — C1 (Reading for information and argument: can understand in detail lengthy, complex texts in his/her field · Listening as a member of a live audience: can follow most lectures, discussions and debates with relative ease · Vocabulary range: broad lexical repertoire incl. specialised terminology · Explaining data: can interpret and describe reliably detailed information in complex diagrams and tables) · ثمّ مِعيار LU-C1-04 · RD-C1-02 · LI-C1-03
# python3 tools/iqra/author/c1-u04.py → tools/iqra/packs/iqra-pack-C1-U04.json
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import _h
from _h import mcq, match, order, pic, cloze, tf, tap, dic, seq, card, lesson
_h.UNIT_CODE = 'C1-U04'
OUT = os.path.join(os.path.dirname(__file__), '..', 'packs', 'iqra-pack-C1-U04.json')


UNIT = {'code': 'C1-U04', 'level': 'C1', 'idx': 4, 'title_ar': 'المصطلح الأكاديمي والمهني', 'title_en': 'Academic and professional terminology',
        'focus_ar': 'أفهم المصطلح الأكاديميّ والمهنيّ في سياقه وأستعمله بدقّة: بنية المقال المحكَّم (ملخّص · مقدّمة · منهج · نتائج · مناقشة · مراجع) ومصطلحات البحث (عيّنة · مجموعة ضابطة · متغيّر مستقلّ وتابع ودخيل · فرضية صفرية · دلالة إحصائية · حجم الأثر · صدق وثبات · تعميم)، ومصطلحات الإدارة والمال (جدوى · تدفّق نقديّ · هامش · نقطة التعادل · مخاطرة · عائد)، ومصطلحات العقود (بند · طرف · التزام · شرط جزائيّ · فسخ · إخلال · قوّة قاهرة · سريان · تحكيم)، وأتابع ندوة متخصّصة وأسئلتها، وأقرأ الجدول داخل النصّ وأعرف ما يقوله الرقم ولا يقوله النصّ، وأعرف كيف يُبنى المصطلح العربيّ، وأشرح نتيجة متخصّصة لغير المختصّ بلا تحريف',
        'domains': ['educational', 'professional']}

