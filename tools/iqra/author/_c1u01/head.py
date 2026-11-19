# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# «اقْرَأْ — من أَثَر» C1-U01 «مرونة البنى ودقّتها» — مولّد الحزمة (المحتوى مؤلَّف يدويًّا هنا)
# المرجع الحاكم: CEFR Companion Volume 2020 — C1 (Grammatical accuracy: consistently maintains a high degree of grammatical accuracy · Flexibility: can reformulate ideas in differing linguistic forms to convey finer shades of meaning · Overall written production: clear, well-structured texts of complex subjects) · ثمّ مِعيار LU-C1-01
# python3 tools/iqra/author/c1-u01.py → tools/iqra/packs/iqra-pack-C1-U01.json
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import _h
from _h import mcq, match, order, pic, cloze, tf, tap, dic, seq, card, lesson
_h.UNIT_CODE = 'C1-U01'
OUT = os.path.join(os.path.dirname(__file__), '..', 'packs', 'iqra-pack-C1-U01.json')


UNIT = {'code': 'C1-U01', 'level': 'C1', 'idx': 1, 'title_ar': 'مرونة البنى ودقّتها', 'title_en': 'Structural flexibility and precision',
        'focus_ar': 'أعيد صياغة الفكرة الواحدة في أبنية مختلفة (مفعول مطلق · مفعول لأجله · استثناء · بدل وتوكيد · جملة اعتراضية · مبنيّ للمجهول · لولا ومهما وأيًّا · كاد وأخواتها · شرط مركّب) لأنقل ظلالًا أدقّ من المعنى، وأختار البناء المناسب للمقام (تقرير للجنة · ندوة أمام زملاء · رسالة إلى صديق)، وأحافظ على درجة عالية من الدقّة النحوية في نصّ طويل مركّب، وأراجع تقريرًا علميًّا في ثلاث مسودّات، وأكتب خلاصة تنفيذية ورسالة بالمحتوى نفسه في سجلّين مختلفين',
        'domains': ['educational', 'professional']}

