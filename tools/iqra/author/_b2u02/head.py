# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# «اقْرَأْ — من أَثَر» B2-U02 «الجملة المركّبة والحال والتمييز» — مولّد الحزمة (المحتوى مؤلَّف يدويًّا هنا)
# المرجع الحاكم: CEFR Companion Volume 2020 — B2 · ثمّ مِعيار LU-B2-02
# python3 tools/iqra/author/b2-u01.py → tools/iqra/packs/iqra-pack-B2-U02.json
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import _h
from _h import mcq, match, order, pic, cloze, tf, tap, dic, seq, card, lesson
_h.UNIT_CODE = 'B2-U02'
OUT = os.path.join(os.path.dirname(__file__), '..', 'packs', 'iqra-pack-B2-U02.json')

UNIT = {'code': 'B2-U02', 'level': 'B2', 'idx': 2, 'title_ar': 'الجملة المركّبة والحال والتمييز', 'title_en': 'Complex sentences, ḥāl and tamyīz',
        'focus_ar': 'أتابع عرضًا للأرقام أمام إدارة شركة وأفهم كيف تُقرأ النسب والمقارنات، وأقرأ تقرير رحلة عمل وتقريرًا ربع سنويًّا، وأستعمل الحال المفردة والجملة (دخل مبتسمًا · خرج وهو يضحك) والتمييز بعد الأعداد والنسب وأفعل التفضيل (ازداد الربح عشرة في المئة · أكثر خبرةً) وأبني جملة طويلة فيها صلة وشرط بلا لبس',
        'domains': ['occupational', 'public']}
