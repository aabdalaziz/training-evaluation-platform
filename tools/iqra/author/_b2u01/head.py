# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# «اقْرَأْ — من أَثَر» B2-U01 «الاستدراك والتوكيد والتفصيل» — مولّد الحزمة (المحتوى مؤلَّف يدويًّا هنا)
# المرجع الحاكم: CEFR Companion Volume 2020 — B2 · ثمّ مِعيار LU-B2-01
# python3 tools/iqra/author/b2-u01.py → tools/iqra/packs/iqra-pack-B2-U01.json
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import _h
from _h import mcq, match, order, pic, cloze, tf, tap, dic, seq, card, lesson
_h.UNIT_CODE = 'B2-U01'
OUT = os.path.join(os.path.dirname(__file__), '..', 'packs', 'iqra-pack-B2-U01.json')

UNIT = {'code': 'B2-U01', 'level': 'B2', 'idx': 1, 'title_ar': 'الاستدراك والتوكيد والتفصيل', 'title_en': 'Contrast, emphasis and elaboration',
        'focus_ar': 'أتابع اجتماعًا رسميًّا يعرض فيه المتكلّمون مقترحات ويستدركون عليها ويؤكّدون ويفصّلون، وألتقط موقف كلّ متكلّم ممّا سبقه، وأقرأ محضرًا ومذكّرة خطّة ومقالًا بموقف، وأستعمل بل وإنّما وأمّا… فـ ولا… بل وليس… وإنّما ولا سيّما بدقّة في النقاش والمحضر والمقال',
        'domains': ['educational', 'public']}
