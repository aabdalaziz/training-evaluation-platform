# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# «اقْرَأْ — من أَثَر» B2-U08 «الحجّة الممتدّة والعرض» — مولّد الحزمة (المحتوى مؤلَّف يدويًّا هنا)
# المرجع الحاكم: CEFR Companion Volume 2020 — B2 (Reading for information and argument · Understanding as a member of a live audience · Following complex lines of argument) · ثمّ مِعيار RD-B2-04 · LI-B2-01 · LI-B2-04
# python3 tools/iqra/author/b2-u08.py → tools/iqra/packs/iqra-pack-B2-U08.json
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import _h
from _h import mcq, match, order, pic, cloze, tf, tap, dic, seq, card, lesson
_h.UNIT_CODE = 'B2-U08'
OUT = os.path.join(os.path.dirname(__file__), '..', 'packs', 'iqra-pack-B2-U08.json')


UNIT = {'code': 'B2-U08', 'level': 'B2', 'idx': 8, 'title_ar': 'الحجّة الممتدّة والعرض', 'title_en': 'Extended argument and presentation',
        'focus_ar': 'أتابع حجّة ممتدّة في عرض تقديميّ أو مقال طويل وأرسم هيكلها (ادّعاء · أسباب · اعتراض وردّ · خلاصة)، وأميّز السبب من الدليل، والاعتراض المتوقَّع من الاعتراض الحقيقيّ، والتنازل الكامل من الجزئيّ، وأقرأ نصًّا في جزأين وأربط بين جزأيه، وأستعمل روابط الحجّة (بما أنّ · إذ · صحيح أنّ… لكنّ · وإن كان… فإنّ · قد يقال… والجواب أنّ · وعليه)، وأعرض مشروعًا في شرائح أمام لجنة وأردّ على اعتراض لم أتوقّعه، وأكتب مذكّرة في جزأين فيها القرار وأسبابه ثمّ الاعتراضات والردود',
        'domains': ['educational', 'professional']}
