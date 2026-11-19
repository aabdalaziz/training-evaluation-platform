# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# «اقْرَأْ — من أَثَر» B2-U05 «قضايا معاصرة ووجهات نظر» — مولّد الحزمة (المحتوى مؤلَّف يدويًّا هنا)
# المرجع الحاكم: CEFR Companion Volume 2020 — B2 (Reading for information and argument · Listening to audio media · Identifying cues and inferring) · ثمّ مِعيار RD-B2-01 · LI-B2-02
# python3 tools/iqra/author/b2-u05.py → tools/iqra/packs/iqra-pack-B2-U05.json
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import _h
from _h import mcq, match, order, pic, cloze, tf, tap, dic, seq, card, lesson
_h.UNIT_CODE = 'B2-U05'
OUT = os.path.join(os.path.dirname(__file__), '..', 'packs', 'iqra-pack-B2-U05.json')

UNIT = {'code': 'B2-U05', 'level': 'B2', 'idx': 5, 'title_ar': 'قضايا معاصرة ووجهات نظر', 'title_en': 'Contemporary issues and viewpoints',
        'focus_ar': 'أتابع نشرة أخبار وبرنامجًا حواريًّا عن قضية معاصرة (العمل عن بُعد) بوتيرة طبيعية، وأميّز الخبر من المصدر من الاقتباس، وأقرأ مقالًا طويلًا في جزأين يعرض أربع وجهات نظر وأحدّد موقف كلّ طرف وحجّته ورأي الكاتبة، وأفهم أفعال النقل ودرجاتها (قال · أكّد · زعم · نفى) وألفاظ الإسناد والتحوّط، وألتقط النبرة لا الكلمات (متحمّسة · متحفّظة · ساخرة · محايدة) والكلمة الكاشفة، وأعرض موقفي في نقاش بوجهتين واعتراض وردّ، وأكتب مقال رأي يوازن بين وجهات نظر',
        'domains': ['public', 'professional']}

