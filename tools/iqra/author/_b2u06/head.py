# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# «اقْرَأْ — من أَثَر» B2-U06 «الفكرة الرئيسة والتفاصيل الداعمة» — مولّد الحزمة (المحتوى مؤلَّف يدويًّا هنا)
# المرجع الحاكم: CEFR Companion Volume 2020 — B2 (Reading for information and argument · Processing text · Note-taking) · ثمّ مِعيار RD-B2-02 · LI-B2-01
# python3 tools/iqra/author/b2-u06.py → tools/iqra/packs/iqra-pack-B2-U06.json
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import _h
from _h import mcq, match, order, pic, cloze, tf, tap, dic, seq, card, lesson
_h.UNIT_CODE = 'B2-U06'
OUT = os.path.join(os.path.dirname(__file__), '..', 'packs', 'iqra-pack-B2-U06.json')


UNIT = {'code': 'B2-U06', 'level': 'B2', 'idx': 6, 'title_ar': 'الفكرة الرئيسة والتفاصيل الداعمة', 'title_en': 'Main idea versus detail',
        'focus_ar': 'أتابع مقابلة صحفية في المعهد وأميّز في كلام كلّ متكلّم الادّعاء من الدليل، وأقرأ تقريرًا صحفيًّا طويلًا في جزأين من خمس فقرات وأستخرج الفكرة الرئيسة لكلّ فقرة وجملتها الرئيسة، وأميّز التفصيل الداعم من الاستطراد (ولو كان مقصودًا)، وأفهم البنية الهرمية للنصّ الطويل (فكرة رئيسة · أفكار فرعية · تفاصيل) وعلامات كلّ طبقة في اللغة، وأتّفق مع زميل في اجتماع على ما يُحتفظ به وما يُحذف، وأكتب ملخّصًا في ثلاث جمل لمجلس، وأدوّن ملاحظات دقيقة من نصّ مسموع',
        'domains': ['educational', 'professional']}
