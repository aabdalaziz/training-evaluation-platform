# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# «اقْرَأْ — من أَثَر» B2-U04 «ضبط الإعراب» — مولّد الحزمة (المحتوى مؤلَّف يدويًّا هنا)
# المرجع الحاكم: CEFR Companion Volume 2020 — B2 (Grammatical accuracy: «تحكّم نحويّ جيّد… يستطيع تصحيح معظم أخطائه») · ثمّ مِعيار LU-B2-04
# python3 tools/iqra/author/b2-u04.py → tools/iqra/packs/iqra-pack-B2-U04.json
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import _h
from _h import mcq, match, order, pic, cloze, tf, tap, dic, seq, card, lesson
_h.UNIT_CODE = 'B2-U04'
OUT = os.path.join(os.path.dirname(__file__), '..', 'packs', 'iqra-pack-B2-U04.json')

UNIT = {'code': 'B2-U04', 'level': 'B2', 'idx': 4, 'title_ar': 'ضبط الإعراب', 'title_en': 'Case endings in context',
        'focus_ar': 'أتابع تدريبًا على القراءة الجهرية وبثًّا إذاعيًّا تُقرأ فيه نشرة مضبوطة، وأضبط آخر الكلمة في البنى الشائعة عند الحاجة: الفاعل والمفعول، واسم إنّ وأخواتها وخبر كان وأخواتها، والأسماء الخمسة (أبو · أبا · أبي)، والمثنّى وجمع المذكّر السالم (المعلّمان · المعلّمَين)، والممنوع من الصرف (في جدّةَ · مدارسَ)، وتمييز العدد 11–99، وأعرف ما يسقط عند الوقف وما يبقى، وأكتب نصًّا للقراءة الجهرية مضبوط الأواخر وأصحّح معظم أخطائي بنفسي',
        'domains': ['educational', 'public']}

